/**
 * Who arrives at the top of the ladder, and what takes them off it.
 *
 * Two questions, and they are the two halves of why a band's headcount is what
 * it is. A standing population is inflow minus outflow, and at Tribulation
 * Transcendence the design says outflow should be nearly zero: a hundred
 * thousand years of span, and people who mostly do not move. So the band should
 * ACCUMULATE even on a production rate of one per several centuries.
 *
 *   ARRIVALS   everybody NOT placed there by the seeder who has ever been seen
 *              at ordinal 41 or above, split 41-44 / 45 / 46 - because crossing
 *              the Lid removes somebody from the band by SUCCEEDING, and a
 *              count that stops at 44 reads a graduation as a failure to
 *              produce.
 *   DEPARTURES the cause of death of everybody who dies at 29 or above, taken
 *              off `endNote`, which is where the world writes what happened.
 *              The design's rule is that nothing ORDINARY may kill somebody at
 *              that height - not a hazard, not an encounter, not attrition -
 *              and only a sect war, a conspiracy, a chosen sacrifice or the
 *              tribulation itself. This says which of those the world is
 *              actually using.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import type { WorldState } from '../src/engine/world/world-state.js';

/** Extant means the engine knows they are out there, whatever the world can see. */
const EXTANT = new Set([
    'alive', 'missing', 'sealed', 'soul_preserved', 'possessing', 'reconstructed'
]);

function report(tag: string, state: WorldState, seeded: Set<string>) {
    const band = (lo: number, hi: number) => state.npcs.filter(
        n => EXTANT.has(n.status)
            && n.cultivation.realmOrdinal >= lo && n.cultivation.realmOrdinal <= hi);
    const arrived = (rows: typeof state.npcs) => rows.filter(n => !seeded.has(n.id)).length;

    const trib = band(41, 44);
    const half = band(45, 45);
    const full = band(46, 46);
    // Everybody the roster has EVER carried at that height, dead included, so a
    // band that produced somebody and lost them is not indistinguishable from a
    // band that produced nobody.
    const everAtTheTop = state.npcs.filter(n => n.cultivation.realmOrdinal >= 41);

    console.log(
        `${tag.padEnd(10)}`
        + `standing 41-44 ${String(trib.length).padStart(2)} (${arrived(trib)} arrived)`
        + `  45 ${String(half.length).padStart(2)} (${arrived(half)})`
        + `  46 ${String(full.length).padStart(2)} (${arrived(full)})`
        + `   ever at 41+ ${String(everAtTheTop.length).padStart(3)}`
        + ` of whom arrived ${everAtTheTop.filter(n => !seeded.has(n.id)).length}`
    );

    // ── And the same question asked only of the apex, where the design's
    // rule is sharpest: nothing ORDINARY may kill a Tribulation Transcender.
    const apexDead = state.npcs.filter(
        n => !EXTANT.has(n.status) && n.cultivation.realmOrdinal >= 41);
    if (apexDead.length > 0) {
        console.log(`           at 41+: ${apexDead.length} dead -`);
        for (const n of apexDead) {
            console.log(`             ordinal ${n.cultivation.realmOrdinal}  ${n.name}: `
                + `${(n.endNote || 'unrecorded').slice(0, 80)}`);
        }
    }

    // ── What takes people off the upper ladder ───────────────────────────
    const dead = state.npcs.filter(
        n => !EXTANT.has(n.status) && n.cultivation.realmOrdinal >= 29);
    if (dead.length === 0) {
        console.log('           nobody at 29+ has died');
        return;
    }
    const causes = new Map<string, number>();
    for (const n of dead) {
        const note = (n.endNote || 'unrecorded').replace(/\s+/g, ' ').trim();
        causes.set(note, (causes.get(note) ?? 0) + 1);
    }
    const live29 = state.npcs.filter(
        n => EXTANT.has(n.status) && n.cultivation.realmOrdinal >= 29).length;
    console.log(`           at 29+: ${live29} standing, ${dead.length} dead. How they ended:`);
    for (const [note, count] of [...causes].sort((a, b) => b[1] - a[1])) {
        console.log(`             ${String(count).padStart(3)}  ${note.slice(0, 96)}`);
    }
}

const catalog = await loadCultivationCatalog();
for (const seed of (process.env.SEEDS ?? 'a').split(',')) {
    const { state } = seedWorld({ seed: `top-${seed}`, catalog });
    const seeded = new Set(state.npcs.map(n => n.id));
    let done = 0;
    for (const h of (process.env.HORIZONS ?? '1500,5000').split(',').map(Number)) {
        advanceWorldYears(state, h - done, { stopOnInterrupt: false });
        done = h;
        report(`${seed} @${h}`, state, seeded);
    }
    console.log('');
}
