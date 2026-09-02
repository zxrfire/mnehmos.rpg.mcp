/**
 * Can a disciple actually walk a house's shelf end to end?
 *
 * Each manual has a `cap` (how far it carries you) and a `requiredOrdinal` (how
 * high you must already be to open it). A shelf only works if the next book can
 * be opened from where the last one left you. Where it cannot, there is a gap
 * nobody inside the house can cross, however favoured they are - and the house
 * quietly stops producing anybody above the last reachable cap.
 */
import { SECTS } from '../src/data/cultivation/sects.js';
import { getTechnique } from '../src/data/cultivation/techniques.js';

let gapped = 0, walkable = 0, empty = 0;
const rows: string[] = [];
for (const s of SECTS as any[]) {
    const shelf = ((s.teaches ?? []) as string[])
        .map(id => getTechnique(id) as any)
        .filter(t => t && t.class === 'cultivation' && t.cap != null)
        .map(t => ({ name: t.name, cap: Number(t.cap), need: Number(t.requiredOrdinal ?? 0) }))
        .sort((a, b) => a.cap - b.cap);
    if (shelf.length === 0) { empty++; continue; }

    let reach = 6;   // BOOKLESS_CEILING: where somebody arrives at the gate
    const steps: string[] = [];
    for (const b of shelf) {
        if (b.need > reach) { steps.push(`GAP need ${b.need} > reach ${reach}`); break; }
        reach = Math.max(reach, b.cap);
        steps.push(`->${b.cap}`);
    }
    const isGapped = steps.some(x => x.startsWith('GAP'));
    if (isGapped) gapped++; else walkable++;
    rows.push(`${s.name.slice(0, 30).padEnd(31)} top ${String(shelf[shelf.length - 1].cap).padStart(2)}  `
        + `reachable ${String(reach).padStart(2)}   ${steps.join(' ')}`);
}
for (const r of rows) console.log(r);
console.log(`\nshelves a disciple can walk end to end: ${walkable}`);
console.log(`shelves with an unreachable step:       ${gapped}`);
console.log(`houses with no cultivation manual:      ${empty}`);

// What each gapped house actually needs: the reachable ceiling, the step it
// cannot take, and what element the bridge would have to be to suit its intake.
console.log('\nTHE BRIDGES THAT ARE MISSING');
const { SECTS: S2 } = await import('../src/data/cultivation/sects.js');
const need = new Map<string, string[]>();
for (const s of S2 as any[]) {
    const shelf = ((s.teaches ?? []) as string[])
        .map(id => getTechnique(id) as any)
        .filter(t => t && t.class === 'cultivation' && t.cap != null)
        .map(t => ({ cap: Number(t.cap), need: Number(t.requiredOrdinal ?? 0), el: t.element ?? 'none' }))
        .sort((a, b) => a.cap - b.cap);
    if (shelf.length === 0) continue;
    let reach = 6;
    for (const b of shelf) {
        if (b.need > reach) {
            const key = `from ${reach} to ${b.need}, element ${b.el}`;
            const list = need.get(key) ?? [];
            list.push(s.name);
            need.set(key, list);
            break;
        }
        reach = Math.max(reach, b.cap);
    }
}
for (const [k, houses] of [...need].sort()) {
    console.log(`  ${k.padEnd(38)} ${houses.length} house(s): ${houses.slice(0, 3).join(', ')}${houses.length > 3 ? ', ...' : ''}`);
}
