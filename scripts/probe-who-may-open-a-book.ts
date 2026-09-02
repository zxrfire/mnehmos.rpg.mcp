/**
 * Does the player have to GET a manual, or only qualify for one?
 *
 * The world simulation runs on a books economy. `manuals.ts` seeds sect
 * libraries, hands copies to members, decides what a house will teach an
 * outsider, prices the betrayal of selling one, and caps every NPC's ceiling at
 * the best book they actually hold. `docs/world/things/items.md` states the
 * player-facing half plainly: common manuals sell at a market stall, and a poor
 * cultivator's first real decision is whether the money goes on a book or on
 * food.
 *
 * This asks whether any of that reaches the player. Standing at the right rung,
 * with an empty pouch, no house and no copy of anything - what does the engine
 * actually refuse?
 *
 * The answer is not uniform, and the first version of this probe got it wrong
 * by ignoring the dao gate: it reported `Canon of the First and Last Breath` as
 * needing nothing but ordinal 5, when it is chaos grade and needs a walked Dao,
 * carries a thirteen-rung opening at a tenth of the rate, and is described in
 * its own entry as something nobody has ever met a person using. The top of the
 * ladder IS gated. The middle is the part that is not.
 *
 *   npx tsx scripts/probe-who-may-open-a-book.ts
 */

import { TECHNIQUES } from '../src/data/cultivation/techniques.js';
import { GRADE_REQUIREMENT } from '../src/engine/cultivation/dao.js';
import { isCommonlyHeld, COMMON_MANUAL_CAP } from '../src/engine/world/manuals.js';
import { PRICES } from '../src/data/cultivation/mortal-world.js';
import { rankName } from '../src/engine/cultivation/realms.js';

const line = (s = '') => console.log(s);
const rule = (t: string) => { line(); line('='.repeat(86)); line('  ' + t); line('='.repeat(86)); };

interface Road {
    id: string; name: string; cap: number; requiredOrdinal: number;
    grade: keyof typeof GRADE_REQUIREMENT;
}

const roads = (TECHNIQUES as unknown as Array<Record<string, unknown>>)
    .filter(t => t.cap != null && Number(t.cap) > 0)
    .map(t => ({
        id: String(t.id), name: String(t.name), cap: Number(t.cap),
        requiredOrdinal: Number(t.requiredOrdinal),
        grade: t.grade as Road['grade']
    }))
    .sort((a, b) => b.cap - a.cap);

/** The only gate that asks for anything other than a rung. */
const daoGated = (r: Road) => GRADE_REQUIREMENT[r.grade] !== 'none';

rule('WHAT THE MARKET SELLS');
const categories = [...new Set((PRICES as unknown as { category: string }[]).map(p => p.category))].sort();
line();
line(`  ${PRICES.length} priced lines, in ${categories.length} categories:`);
line(`    ${categories.join(', ')}`);
line();
line(categories.some(c => /book|manual|technique|method|text/i.test(c))
    ? '  Books are on the board.'
    : '  NO CATEGORY SELLS A BOOK. The market cannot be asked for one, so the choice\n'
      + '  between a book and food - the first decision the design gives a poor\n'
      + '  cultivator - cannot be made at a stall, and the seven commonly-held\n'
      + '  manuals below have no price anywhere in the game.');

rule('WHERE THE LADDER IS GATED BY SOMETHING OTHER THAN A RUNG');
line();
line('  cap  req  grade      asks for      name');
line('  ' + '-'.repeat(80));
for (const r of roads) {
    const need = GRADE_REQUIREMENT[r.grade];
    line(`  ${String(r.cap).padStart(3)} ${String(r.requiredOrdinal).padStart(4)}  `
        + `${r.grade.padEnd(9)} ${(need === 'none' ? 'the rung only' : `a Dao (${need})`).padEnd(13)} ${r.name}`);
}

const free = roads.filter(r => !daoGated(r));
const gated = roads.filter(daoGated);
const freeCeiling = Math.max(...free.map(r => r.cap));

rule('WHAT THE PLAYER MUST HAVE TO OPEN ONE');
line();
line('  Every gate in `handleLearn`, in the order it applies:');
line('    1. the art exists            4. the dao gate, immortal and chaos grades only');
line('    2. it is not already known   5. the spirit root can channel the element');
line('    3. requiredOrdinal is met    6. a per-root scarcity roll off the run seed');
line();
line('  NOT among them: holding a copy, being taught it, belonging to the house that');
line('  owns it, or paying anything at all.');
line();
line(`  ${gated.length} of the ${roads.length} roads ask for a walked Dao, and those are genuinely gated.`);
line(`  ${free.length} ask for nothing but the rung, and they carry as far as ${freeCeiling}.`);

rule('THE WIDEST FREE STEP IN THE CATALOG');
const widest = free.slice().sort((a, b) => (b.cap - b.requiredOrdinal) - (a.cap - a.requiredOrdinal))[0];
line();
line(`  ${widest.name} (${widest.grade} grade)`);
line(`    open at ${rankName(widest.requiredOrdinal)} (ordinal ${widest.requiredOrdinal}), `
    + `carries to ${widest.cap}.`);
line(`    ${widest.cap - widest.requiredOrdinal} rungs, for nothing, held by nobody, taught by no one.`);
line();
line(`  \`docs/world/things/items.md\` holds that a Core Formation manual should be uncommon at`);
line('  worst and a Nascent Soul one rare at minimum, and that every road above the');
line('  Void Refinement line is taught by exactly one house. All of that is true of the');
line(`  WORLD - ${roads.filter(r => !isCommonlyHeld(r.id)).length} of these ${roads.length} roads are above the commonly-held line of `
    + `${COMMON_MANUAL_CAP}, and the`);
line('  simulation gates every NPC on the book they actually hold. None of it is true');
line('  of the player, who needs only to stand high enough to ask.');
line();
