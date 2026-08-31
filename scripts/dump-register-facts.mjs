import { buildRegister } from '../dist/web/register.js';
import { PROSE_SECTIONS, fingerprintFacts } from '../dist/web/register-prose.js';

const reg = buildRegister();
for (const s of PROSE_SECTIONS) {
    const facts = s.facts(reg);
    console.log('=====', s.id, fingerprintFacts(facts));
    console.log(JSON.stringify(facts));
}
