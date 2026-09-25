import { writeFileSync } from 'node:fs';
import { buildRegister, renderRegisterHtml } from '../dist/web/register.js';
const html = renderRegisterHtml(buildRegister());
writeFileSync(process.argv[2], html, 'utf8');
console.log('bytes', html.length);
