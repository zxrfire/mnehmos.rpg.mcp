import { writeFileSync } from 'node:fs';
import { buildRegister, renderRegisterHtml } from '../dist/web/register.js';
import { defaultProsePath, loadProse } from '../dist/web/register-prose.js';
import { getDbPath } from '../dist/storage/index.js';

const reg = buildRegister();
const cache = loadProse(defaultProsePath(getDbPath()));
const stale = Object.values(cache.blocks).filter(b => b.stale).length;
const html = renderRegisterHtml(reg, cache.blocks);
const out = process.argv[2];
writeFileSync(out, html, 'utf-8');
console.log(`blocks: ${Object.keys(cache.blocks).length}, stale: ${stale}, ${(html.length/1024).toFixed(1)} kB -> ${out}`);
