/**
 * What "common" means once the shelves have been fixed.
 *
 * `COMMON_MANUAL_CAP = 13` said a manual is common when it carries no further
 * than Qi Condensation. That was true when it was written. Bridge manuals have
 * since put books capping ABOVE 13 onto many shelves at once, so the constant
 * now calls the province's standard crossing somebody's private property:
 * `unauthorisedPractice` reports a cultivator practising it as answerable to
 * every house that teaches it, and `betrayalOfSelling` treats copying it as
 * theft.
 *
 * Commonness was never about height. It is about HOW MANY PEOPLE HOLD IT. This
 * measures the real distribution so the replacement is read off the world.
 */
import { SECTS } from '../src/data/cultivation/sects.js';
import { getTechnique } from '../src/data/cultivation/techniques.js';

const shelves = new Map<string, number>();
for (const s of SECTS as any[]) {
    for (const id of (s.teaches ?? []) as string[]) {
        const t: any = getTechnique(id);
        if (!t || t.class !== 'cultivation' || t.cap == null) continue;
        shelves.set(id, (shelves.get(id) ?? 0) + 1);
    }
}
const rows = [...shelves].map(([id, houses]) => {
    const t: any = getTechnique(id);
    return { name: t.name as string, cap: Number(t.cap), grade: String(t.grade), houses };
}).sort((a, b) => b.houses - a.houses || a.cap - b.cap);

console.log('manual'.padEnd(42) + 'cap'.padStart(5) + 'grade'.padStart(10) + 'houses teaching it'.padStart(20));
for (const r of rows) {
    console.log(r.name.slice(0, 41).padEnd(42) + String(r.cap).padStart(5)
        + r.grade.padStart(10) + String(r.houses).padStart(20));
}
console.log(`\nby cap band - how many houses teach the typical manual there:`);
for (const [lo, hi] of [[0, 13], [14, 21], [22, 29], [30, 46]] as const) {
    const band = rows.filter(r => r.cap >= lo && r.cap <= hi);
    if (band.length === 0) continue;
    const houses = band.map(r => r.houses).sort((a, b) => a - b);
    const mid = houses[Math.floor(houses.length / 2)];
    console.log(`  cap ${String(lo).padStart(2)}-${String(hi).padStart(2)}: `
        + `${String(band.length).padStart(2)} manual(s), taught by median ${mid} house(s), `
        + `max ${Math.max(...houses)}`);
}

// ── Who is answerable for practising what ───────────────────────────────────
const { isCommonlyHeld, housesTeaching, whoseArt } = await import('../src/engine/world/manuals.js');
console.log('\nIS IT SOMEBODY\'S PROPERTY?');
for (const r of rows) {
    const id = (SECTS as any[]).flatMap(s => (s.teaches ?? []) as string[])
        .find(t => (getTechnique(t) as any)?.name === r.name)!;
    const common = isCommonlyHeld(id);
    console.log(`  ${r.name.slice(0, 40).padEnd(41)} cap ${String(r.cap).padStart(2)}  `
        + `${String(housesTeaching(id)).padStart(2)} house(s)  `
        + (common ? 'nobody\'s' : `answerable to ${whoseArt(id).length}`));
}
