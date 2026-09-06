import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
createServer(async (req, res) => {
  if (req.url !== '/' && req.url !== '/index.html') { res.writeHead(404).end('Not found'); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(await readFile('src/index.html'));
}).listen(4179, '127.0.0.1', () => console.log('Privacy page: http://127.0.0.1:4179'));
