import { build, context } from 'esbuild';
import { mkdir, copyFile, cp } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await copyFile('manifest.json', 'dist/manifest.json');
await copyFile('LICENSE', 'dist/LICENSE');
await cp('public', 'dist', { recursive: true });
await copyFile('src/content/styles.css', 'dist/content.css');
const common = { bundle: true, minify: !process.argv.includes('--watch'), target: 'chrome114', logLevel: 'info' };
const jobs = [
  { ...common, entryPoints: ['src/background/service-worker.ts'], outfile: 'dist/background.js', format: 'esm' },
  { ...common, entryPoints: ['src/content/index.ts'], outfile: 'dist/content.js', format: 'iife' },
  { ...common, entryPoints: ['src/popup/main.tsx'], outfile: 'dist/popup.js', format: 'iife', define: { 'process.env.NODE_ENV': JSON.stringify(process.argv.includes('--watch') ? 'development' : 'production') } }
];
if (process.argv.includes('--watch')) {
  for (const job of jobs) await (await context(job)).watch();
  console.log('Watching source. Re-run for manifest/content CSS changes; reload extension and YouTube tabs after changes.');
} else await Promise.all(jobs.map(job => build(job)));
