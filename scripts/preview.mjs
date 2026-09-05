// Browser-only UI preview. The mock API is never copied into the extension.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { build } from 'esbuild';
const root = resolve('dist');
const mock = `
const listeners = new Set();
let settings = { enabled:true, displayMode:'badge-dim', threshold:70, useYouTubeProgress:true, applyToShorts:true, showWatchedDate:true, hidePromotionalSections:false, hideHomeShorts:false, hidePlaylists:false };
let watchedCount = 1248, filteredToday = 32, filteredAllTime = 864;
window.chrome = {
  storage: { onChanged: { addListener:fn=>listeners.add(fn), removeListener:fn=>listeners.delete(fn) } },
  runtime: { sendMessage: async message => {
    if(message.type==='settings') { settings = message.settings; listeners.forEach(fn=>fn()); }
    if(message.type==='clear') { watchedCount=0; filteredToday=0; filteredAllTime=0; listeners.forEach(fn=>fn()); }
    return { ok:true, data:{ settings, watchedCount, filteredToday, filteredAllTime, totalMarked:watchedCount, storageBytes:248512 } };
  } },
  tabs: { query: async()=>[{id:1,url:'https://www.youtube.com/'}], sendMessage:async()=>({ok:true,data:{imported:0,detected:0}}) }
};`;
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png' };
createServer(async (req, res) => {
  try {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (path === '/continuation-fixture' || path === '/grid-fixture') {
      const fixture = path === '/grid-fixture' ? 'grid' : 'continuation';
      res.setHeader('Content-Type', 'text/html'); res.end(await readFile(`tests/browser/${fixture}.html`)); return;
    }
    if (path === '/continuation-fixture.js' || path === '/grid-fixture.js') {
      const fixture = path === '/grid-fixture.js' ? 'grid' : 'continuation';
      const result = await build({ entryPoints: [`tests/browser/${fixture}.ts`], bundle: true, write: false, format: 'iife', target: 'chrome114' });
      res.setHeader('Content-Type', 'text/javascript'); res.end(result.outputFiles[0].contents); return;
    }
    if (path === '/preview-api.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(mock); return; }
    const file = resolve(root, '.' + (path === '/' ? '/popup.html' : path));
    if (!file.startsWith(root + '/')) { res.writeHead(403).end(); return; }
    let content = await readFile(file);
    if (file.endsWith('popup.html')) content = Buffer.from(content.toString().replace('<script src="popup.js"', '<script src="preview-api.js"></script><script src="popup.js"'));
    res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
    res.end(content);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(4177, '127.0.0.1', () => console.log('Popup preview with synthetic data: http://127.0.0.1:4177'));
