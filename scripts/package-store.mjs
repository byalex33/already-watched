// Build and validate a fixed source snapshot so concurrent workspace edits cannot
// produce an extension ZIP containing a mix of build revisions.
import { cp, mkdir, mkdtemp, readFile, readdir, writeFile, symlink } from 'node:fs/promises';
import { resolve, join, posix } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = resolve('.');
const pythonCommand = process.env.ALREADY_WATCHED_PYTHON || 'python3';
const pythonCheck = spawnSync(pythonCommand, ['-c', 'import sys, zipfile; assert sys.version_info >= (3, 8)'], { encoding: 'utf8' });
if (pythonCheck.error || pythonCheck.status !== 0) {
  throw new Error('Store packaging requires Python 3.8+ with zipfile. Install python3 or set ALREADY_WATCHED_PYTHON to your Python executable path. No release files were changed.');
}
const snapshot = await mkdtemp(join(tmpdir(), 'already-watched-release-'));
const entries = ['src', 'public', 'tests', 'scripts/build.mjs', 'package.json', 'package-lock.json', 'manifest.json', 'tsconfig.json', 'vitest.config.ts'];
async function filesIn(path, prefix='') {
  const files=[];
  for(const e of await readdir(path,{withFileTypes:true})) {
    const rel=posix.join(prefix,e.name);
    if(e.isDirectory()) files.push(...await filesIn(join(path,e.name),rel));
    else if(e.isFile()) files.push(rel);
  }
  return files.sort();
}
const hashes={};
for(const entry of entries) {
  await mkdir(resolve(snapshot,entry,'..'),{recursive:true});
  await cp(resolve(root,entry),resolve(snapshot,entry),{recursive:true});
}
for(const file of await filesIn(snapshot)) hashes[file]=createHash('sha256').update(await readFile(join(snapshot,file))).digest('hex');
// If any source changed while it was being copied, stop rather than release it.
for(const [file,hash] of Object.entries(hashes)) {
  if(createHash('sha256').update(await readFile(join(root,file))).digest('hex')!==hash) throw new Error(`Source changed during snapshot: ${file}. Run packaging again once editing settles.`);
}
await symlink(join(root,'node_modules'),join(snapshot,'node_modules'),process.platform === 'win32' ? 'junction' : 'dir');
const result=spawnSync('npm',['run','check'],{cwd:snapshot,encoding:'utf8',shell:process.platform === 'win32'});
process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');
if(result.status!==0) throw new Error('Snapshot validation failed; no release ZIP created.');
const manifest=JSON.parse(await readFile(join(snapshot,'dist/manifest.json'),'utf8'));
const expected=['background.js','content.js','content.css','popup.html','popup.js','popup.css','manifest.json',...new Set(Object.values(manifest.icons))].sort();
const actual=await filesIn(join(snapshot,'dist'));
if(JSON.stringify(expected)!==JSON.stringify(actual)) throw new Error(`Unexpected build contents: ${JSON.stringify(actual)}`);
if(manifest.manifest_version!==3||manifest.description.length>132) throw new Error('Invalid store metadata');
const out=join(root,'store');await mkdir(out,{recursive:true});
const zip=join(out,`already-watched-${manifest.version}.zip`);
const python=`import sys,zipfile,pathlib\nroot=pathlib.Path(sys.argv[1])\nwith zipfile.ZipFile(sys.argv[2], 'w', zipfile.ZIP_DEFLATED) as z:\n for p in sorted(root.rglob('*')):\n  if p.is_file(): z.write(p,p.relative_to(root).as_posix())\nwith zipfile.ZipFile(sys.argv[2]) as z:\n assert z.testzip() is None\n assert 'manifest.json' in z.namelist()\nprint('Validated extension ZIP:',sys.argv[2])`;
const archive=spawnSync(pythonCommand,['-c',python,join(snapshot,'dist'),zip],{encoding:'utf8'});
process.stdout.write(archive.stdout??'');process.stderr.write(archive.stderr??'');
if(archive.status!==0) throw new Error('ZIP validation failed');
await writeFile(join(out,'release-validation.txt'),`${result.stdout}\n${result.stderr}\nZIP files:\n${actual.join('\n')}\n`);
const report={version:manifest.version,builtAt:new Date().toISOString(),snapshotDirectory:snapshot,zip:zip,zipSha256:createHash('sha256').update(await readFile(zip)).digest('hex'),sourceSha256:hashes,validation:'npm run check passed in fixed source snapshot',liveYouTubeSmokeTest:'Not performed as part of this packaging run'};
await writeFile(join(out,'release-manifest.json'),JSON.stringify(report,null,2)+'\n');
console.log('Source snapshot retained:',snapshot);
