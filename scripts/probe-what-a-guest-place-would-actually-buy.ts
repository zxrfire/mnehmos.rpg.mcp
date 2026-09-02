/**
 * What is actually behind the membership gate, and therefore what a guest
 * place could be worth.
 *
 * `technique-manage.learn` refuses on two lines, both of which read
 * `house.teaches.includes(id)` and nothing else:
 *
 *   no_road_to_this_book   not commonly held, and your house does not teach it
 *   no_copy_of_this_book   below the stall line, no copy owned, house does not
 *                          teach it
 *
 * So the question this answers is: for each house, how much of its teach list
 * is unreachable to somebody standing outside it with no money, and how much of
 * THAT is shallow enough that the house could show it to a guest?
 *
 * Run: node --loader ts-node/esm scripts/probe-what-a-guest-place-would-actually-buy.ts
 */
import { SECTS } from '../src/data/cultivation/sects.js';
import { getTechnique, classOf, capOf } from '../src/data/cultivation/techniques.js';
import { isCommonlyHeld, COMMON_MANUAL_CAP, manualsOf } from '../src/engine/world/manuals.js';
import { getProductionTier } from '../src/data/cultivation/faction-character.js';

let anyGated = 0;
const rows: string[] = [];
for (const s of SECTS as any[]) {
    const gated: string[] = [];
    const free: string[] = [];
    for (const id of (s.teaches ?? []) as string[]) {
        const t = getTechnique(id) as any;
        if (!t) continue;
        const common = isCommonlyHeld(id);
        const writtenTo = t.cap ?? capOf(t);
        const belowStall =
            classOf(t) === 'cultivation' && writtenTo != null && writtenTo <= COMMON_MANUAL_CAP;
        // Outside the house, with no purchased copy and no provenance.
        const blocked = !common || belowStall;
        (blocked ? gated : free).push(
            `${t.name}[${t.class}/${t.grade}/cap=${t.cap ?? '-'}/need=${t.requiredOrdinal ?? 0}]`
        );
    }
    if (gated.length > 0) anyGated += 1;
    const shelf = manualsOf(s.id);
    const top = shelf.length > 0 ? shelf[shelf.length - 1].cap : null;
    const reliable = getProductionTier(s.id)?.reliableOrdinal ?? null;
    rows.push(
        `${s.id.padEnd(38)} gated=${String(gated.length).padStart(2)} free=${String(free.length).padStart(2)}`
        + ` top=${String(top ?? '-').padStart(3)} reliable=${String(reliable ?? '-').padStart(3)}`
        + (gated.length ? `\n      GATED: ${gated.join(', ')}` : '')
        + (free.length ? `\n      FREE:  ${free.join(', ')}` : '')
    );
}
rows.sort();
console.log(rows.join('\n'));
console.log(`\n${anyGated} of ${SECTS.length} houses hold something an outsider cannot reach.`);
