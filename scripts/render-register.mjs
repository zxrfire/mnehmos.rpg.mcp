/**
 * Write the standing register to a file.
 *
 *   npm run register                     -> build/standing-register.html
 *   npm run register -- path/to/out.html
 *
 * The same build the admin endpoint serves, so the file and the page can never
 * disagree. Run it after changing anything in `src/data/cultivation/` and the
 * sheet is current again; there is nothing to hand-edit and nothing to keep in
 * step.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { renderRegister } from '../dist/web/register.js';

const out = resolve(process.argv[2] ?? 'build/standing-register.html');
mkdirSync(dirname(out), { recursive: true });

const html = renderRegister();
writeFileSync(out, html, 'utf-8');

console.log(`standing register -> ${out} (${(html.length / 1024).toFixed(1)} kB)`);
