// Store artwork only. No demo data or preview code is included in the extension ZIP.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { build } from 'esbuild';
const root = resolve('.');
const extensionRoot = process.argv.includes('--release')
  ? JSON.parse(await readFile(resolve(root, 'store/release-manifest.json'), 'utf8')).snapshotDirectory
  : root;
const mock = `const listeners=new Set();let settings={enabled:true,displayMode:'badge-dim',threshold:70,useYouTubeProgress:true,applyToShorts:true,showWatchedDate:true,hidePromotionalSections:false,hideHomeShorts:false,hidePlaylists:false,minimumViews:0,blockedTitleTerms:[]};window.chrome={storage:{onChanged:{addListener:f=>listeners.add(f),removeListener:f=>listeners.delete(f)}},runtime:{sendMessage:async m=>{if(m.type==='settings'){settings={...settings,...m.settings};listeners.forEach(f=>f())}return {ok:true,data:{settings,watchedCount:12,filteredToday:4,filteredAllTime:28,totalMarked:12,storageBytes:16384}}}},tabs:{query:async()=>[{id:1,url:'https://www.youtube.com/'}],sendMessage:async()=>({ok:true,data:{imported:0,detected:0}})}};`;
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.png':'image/png' };
createServer(async (req,res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if(pathname === '/demo-api.js') { res.setHeader('Content-Type','text/javascript'); res.end(mock); return; }
    if(pathname === '/feed.js') {
      const result=await build({entryPoints:['store/feed.ts'],bundle:true,write:false,format:'iife',target:'chrome114'});
      res.setHeader('Content-Type','text/javascript');res.end(result.outputFiles[0].contents);return;
    }
    const mapping={'/':'store/settings.html','/settings':'store/settings.html','/feed':'store/feed.html','/promo':'store/promo.html','/popup.html':'dist/popup.html','/popup.js':'dist/popup.js','/popup.css':'dist/popup.css','/content.css':'dist/content.css','/brand.png':'public/icons/128.png','/art.css':'store/art.css'};
    const relative=mapping[pathname];
    if(!relative){res.writeHead(404).end('Not found');return;}
    let body=await readFile(resolve(relative.startsWith('dist/') ? extensionRoot : root,relative));
    if(pathname==='/popup.html') body=Buffer.from(body.toString().replace('<script src="popup.js"','<script src="demo-api.js"></script><script src="popup.js"'));
    res.setHeader('Content-Type',types[extname(relative)]??'text/plain');res.end(body);
  }catch(error){console.error(error.message);res.writeHead(500).end('Preview failed');}
}).listen(4181,'127.0.0.1',()=>console.log('Store artwork preview: http://127.0.0.1:4181'));
