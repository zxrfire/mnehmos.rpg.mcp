/**
 * Is the standing distribution a pyramid, or is it seeded survivors on top of a
 * floor that nothing ever leaves?
 *
 * `probe-pyramid-seeds.ts` reports the band table and calls a band occupied when
 * anybody is standing in it. That is not the question. A band held entirely by
 * people who were placed there at seeding is a band that is DYING, however
 * healthy its headcount reads today, because when the last of them goes there is
 * no one behind them. So every count here is split two ways:
 *
 *     survivors   alive now and present at seeding
 *     arrivals    born since, and therefore evidence that the rung is reachable
 *
 * And because the reachable ceiling is what decides whether anybody arrives, it
 * also tracks the supply side: how many distinct cultivation manuals are still
 * held by somebody alive, how many houses still hold a living master who can
 * carry a disciple over a gap in their own shelf, and what the effective ceiling
 * looks like across the living roster.
 *
 * A book supply that only falls is a ratchet, and a ratchet on the ceiling is
 * indistinguishable from decline while it is happening.
 */
import { seedWorld, deriveOrdinal } from '../src/engine/world/seeding.js';
import { forStream } from '../src/engine/cultivation/rng.js';
import { MAX_ORDINAL } from '../src/engine/cultivation/realms.js';
import type { OriginTierKey } from '../src/engine/cultivation/origin.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { shelfOf, reachableCeilingFor, BOOKLESS_CEILING } from '../src/engine/world/manuals.js';
import { isBelowTheLid } from '../src/engine/world/layers.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const BANDS: [string, number, number][] = [
    ['mortal', 0, 0], ['qi', 1, 12], ['found', 13, 16], ['core', 17, 20],
    ['nascent', 21, 24], ['deity', 25, 28], ['void', 29, 32],
    ['body', 33, 36], ['grand', 37, 40], ['trib', 41, 44]
];

const SEEDS = (process.env.SEEDS ?? 'a,b,c').split(',');
const MARKS = (process.env.MARKS ?? '0,500,1500,3000,6000').split(',').map(Number);

function ceilingOf(state: WorldState, npc: WorldState['npcs'][number]): number {
    const regionTag = npc.tags.find(t => t.startsWith('region:'))?.slice(7);
    const region = state.locations.find(
        l => l.kind === 'region' && isBelowTheLid(l) &&
            String(l.data.catalogRegionId ?? '') === regionTag
    ) ?? state.locations.find(l => l.id === npc.locationId);
    const regionCeiling = Number(region?.data.localCeilingOrdinal ?? 20);
    const manual = reachableCeilingFor(state, npc) || BOOKLESS_CEILING;
    return Math.min(regionCeiling, manual);
}

/** How deep the shelves standing in the world reach, by the cap of their top book. */
function shelfDepths(state: WorldState): { withShelf: number; total: number; depths: number[] } {
    let withShelf = 0, total = 0;
    const depths: number[] = [];
    for (const f of state.factions) {
        if (f.dissolvedOnDay !== null || !isBelowTheLid(f)) continue;
        total++;
        const shelf = shelfOf(state, f.id);
        if (shelf.length === 0) continue;
        withShelf++;
        depths.push(shelf[shelf.length - 1].cap);
    }
    return { withShelf, total, depths: depths.sort((a, b) => b - a) };
}

const catalog = await loadCultivationCatalog();

for (const seed of SEEDS) {
    let { state } = seedWorld({ seed: `refill-${seed}`, catalog });
    const seeded = new Set(state.npcs.map(n => n.id));

    console.log(`\n══ seed ${seed} ══`);
    console.log('  ' + 'years'.padEnd(8) + 'alive'.padStart(6)
        + BANDS.map(([n]) => n.padStart(9)).join('')
        + '   (survivors of the seeding in brackets)');

    let at = 0;
    for (const mark of MARKS) {
        if (mark > at) { state = advanceWorldYears(state, mark - at).state; at = mark; }
        const alive = state.npcs.filter(n => n.status === 'alive' && isBelowTheLid(n));
        const cells = BANDS.map(([, lo, hi]) => {
            const inBand = alive.filter(n =>
                n.cultivation.realmOrdinal >= lo && n.cultivation.realmOrdinal <= hi);
            const surv = inBand.filter(n => seeded.has(n.id)).length;
            return `${inBand.length}(${surv})`;
        });
        console.log('  ' + String(mark).padEnd(8) + String(alive.length).padStart(6)
            + cells.map(c => c.padStart(9)).join(''));

        const books = new Set<string>();
        for (const n of alive) for (const id of n.cultivation.techniqueIds) books.add(id);
        const ceilings = alive.map(n => ceilingOf(state, n)).sort((a, b) => a - b);
        const med = ceilings[Math.floor(ceilings.length / 2)] ?? 0;
        const p90 = ceilings[Math.floor(ceilings.length * 0.9)] ?? 0;
        const reaches13 = ceilings.filter(c => c >= 13).length;
        const reaches17 = ceilings.filter(c => c >= 17).length;
        // THE DECISIVE SPLIT. `applyAdvancement` hands the life-walk an age, a
        // region rate and a ceiling. Running the same walk with the ceiling
        // taken away says which of the two is the wall: if the uncapped walk
        // lands far above where somebody is standing, the ceiling is what stops
        // them and the books are the subject. If it lands on top of them, the
        // ladder's own cost curve is, and no amount of library work will move it.
        let ceilingBound = 0, walkBound = 0, lagging = 0;
        const uncapped: number[] = [];
        for (const npc of alive) {
            const age = Math.floor((state.currentDay - npc.identity.bornOnDay) / 365);
            const tier: OriginTierKey = !npc.factionId
                ? 'thin_county'
                : npc.factionRankIndex >= 3 ? 'dao_house_bloodline'
                    : npc.factionRankIndex >= 1 ? 'established_clan'
                        : 'sect_retainer';
            const free = deriveOrdinal(
                npc.cultivation.spiritRoot, npc.cultivation.attributes, age, 1,
                MAX_ORDINAL, forStream(`${seed}-uncapped`, 'advance-npc', npc.id), { origin: tier });
            uncapped.push(free);
            const held = npc.cultivation.realmOrdinal;
            const ceil = ceilingOf(state, npc);
            if (free <= held) walkBound++;
            else if (ceil <= held) ceilingBound++;
            else lagging++;
        }
        uncapped.sort((a, b) => a - b);

        const { withShelf, total, depths } = shelfDepths(state);
        console.log('  ' + ''.padEnd(8)
            + `books still held by the living ${String(books.size).padStart(3)}`
            + `   ceiling median ${String(med).padStart(2)} p90 ${String(p90).padStart(2)}`
            + `   reaching 13+ ${String(reaches13).padStart(3)}  17+ ${String(reaches17).padStart(3)}`);
        console.log('  ' + ''.padEnd(8)
            + `houses standing ${String(total).padStart(3)}`
            + `   holding a shelf ${String(withShelf).padStart(3)}`
            + `   shelf tops (deepest first) ${depths.slice(0, 12).join(' ')}`);
        console.log('  ' + ''.padEnd(8)
            + `walk with no ceiling at all: median `
            + `${uncapped[Math.floor(uncapped.length / 2)]} p90 ${uncapped[Math.floor(uncapped.length * 0.9)]} `
            + `max ${uncapped[uncapped.length - 1]}`
            + `   stopped by the ceiling ${ceilingBound}  by the walk itself ${walkBound}`
            + `  merely not sampled yet ${lagging}`);
    }
}
