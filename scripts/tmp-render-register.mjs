import { writeFileSync } from 'node:fs';
import { renderRegister } from '../dist/web/register.js';
const html = renderRegister();
writeFileSync(process.argv[2], html, 'utf8');
console.log('bytes', html.length);
