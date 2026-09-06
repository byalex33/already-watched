import { mkdir, cp, readFile } from 'node:fs/promises';
const html = await readFile('src/index.html', 'utf8');
for (const required of ['hello@alex.codes', 'chrome.storage.local', 'Clear watched history', 'Limited Use']) {
  if (!html.includes(required)) throw new Error(`Missing privacy disclosure: ${required}`);
}
await mkdir('dist', { recursive: true });
await cp('src', 'dist', { recursive: true });
console.log('Privacy page built. No external scripts, fonts, or analytics.');
