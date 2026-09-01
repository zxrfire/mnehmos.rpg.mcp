/**
 * Can the people a house is made of actually practise the road it teaches?
 *
 * `conflictsWithRoot` refuses an element whenever the root carries what that
 * element OVERCOMES, so a metal road is refused to every root carrying wood -
 * which is most of the weight in the root table. The seeder rolls a root from
 * that table independently of the house it is placing somebody into, so a
 * house's own Sword Elder is refused its own sword road about half the time,
 * on every seed, at every house with an element.
 *
 * Three reads, because three different things are supposed to produce them:
 *
 *   ROOT FIT BY RUNG    does the fit improve with the height of the seat? An
 *                       outer disciple may be anything. A head who spent
 *                       centuries on the road should not be someone it refuses.
 *   WHAT THEY HOLD      `newlyEntitled` already refuses a conflicting book, so
 *                       the damage is not a contradiction in the register - it
 *                       is people standing in a house holding NOTHING of it.
 *   THE ROOT HISTOGRAM  the reverse failure. If conditioning the root on the
 *                       road tilts the world's roots toward whatever the big
 *                       houses teach, the fix is worse than the defect.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { suitsRoot, shelfOf } from '../src/engine/world/manuals.js';
import { SPIRIT_ROOTS, conflictsWithRoot, getSpiritRoot } from '../src/engine/cultivation/spirit-roots.js';
import { houseRoadOf, reachableCeiling, roadRefuses } from '../src/engine/world/what-root-a-seeded-house-member-has.js';
import { TECHNIQUES } from '../src/data/cultivation/techniques.js';
import type { NpcRecord } from '../src/engine/world/npc-state.js';

const catalog = await loadCultivationCatalog();
const seeds = ['a', 'b', 'c', 'd', 'e'];
const elementOf = new Map<string, string | null>();
for (const t of TECHNIQUES) elementOf.set(t.id, (t as { element?: string | null }).element ?? null);

/**
 * The element a house actually teaches, or null.
 *
 * The commonest non-null element on its own curriculum. A house whose shelf is
 * elementless has no road to refuse anybody and is excluded from every fit
 * figure below - which is most of the point of the elementless houses.
 */
/**
 * The PRIMARY road: the elemental road that carries highest on the shelf.
 *
 * Not the commonest element. A house is a shelf - a primary road that carries
 * high and secondary roads that stop lower - and it is the primary one the top
 * of the house has to be able to walk. Somebody who can only walk a secondary
 * road is legitimately in the house and legitimately capped, so counting them
 * as a misfit measures the wrong thing.
 */
function houseRoad(f: { teachesRoads: { element: string | null; cap: number }[] }): string | null {
    let best: string | null = null, cap = -1;
    for (const r of f.teachesRoads) {
        if (r.element && r.cap > cap) { best = r.element; cap = r.cap; }
    }
    return best;
}

const BANDS: [string, number, number][] = [
    ['ord 0-6', 0, 6], ['ord 7-12', 7, 12], ['ord 13-20', 13, 20],
    ['ord 21-28', 21, 28], ['ord 29-36', 29, 36], ['ord 37+', 37, 99]
];

const fitByBand = BANDS.map(() => ({ fit: 0, n: 0 }));
const rankTop = { fit: 0, n: 0 };      // top two rungs of an elemental house
const rankBottom = { fit: 0, n: 0 };   // rung zero of an elemental house
let heldConflicts = 0, holdersChecked = 0;
let emptyHanded = 0, inElementalHouse = 0;
let onRoad = 0, offRoad = 0, refusedSeniors = 0;
let refusedAtAll = 0, refusedAboveServantRung = 0, pastTheirCeiling = 0, pastCeilingClosed = 0;
const rootTally = new Map<string, number>();
const rootTallyDerived = new Map<string, number>();
let placedTotal = 0, placedFit = 0, placedElemental = 0;

for (const seed of seeds) {
    const { state } = seedWorld({ seed: `road-${seed}`, catalog });
    const roadById = new Map(catalog.factions.map(f => [f.id, houseRoad(f)]));
    const ranksById = new Map(state.factions.map(f => [f.id, f.ranks.length]));

    for (const npc of state.npcs) {
        if (npc.status !== 'alive') continue;
        rootTally.set(npc.cultivation.spiritRoot, (rootTally.get(npc.cultivation.spiritRoot) ?? 0) + 1);
        const placed = npc.tags.some(t => t.startsWith('catalog:'));
        if (!placed) {
            rootTallyDerived.set(npc.cultivation.spiritRoot,
                (rootTallyDerived.get(npc.cultivation.spiritRoot) ?? 0) + 1);
        }

        // What they HOLD, against what their own root allows. The guard in
        // `newlyEntitled` should make this zero; it is measured rather than
        // assumed, because a contradiction here is worse than a poor fit.
        for (const id of npc.cultivation.techniqueIds) {
            holdersChecked++;
            const el = elementOf.get(id) ?? null;
            if (el && conflictsWithRoot(getSpiritRoot(npc.cultivation.spiritRoot), el as never)) {
                heldConflicts++;
            }
        }

        const road = npc.factionId ? roadById.get(npc.factionId) ?? null : null;
        if (!road) continue;
        inElementalHouse++;
        const fits = suitsRoot(npc.cultivation.spiritRoot, road);
        if (npc.cultivation.techniqueIds.length === 0) emptyHanded++;
        // THE SHARP QUESTION. Not "do they hold a book" - they all do - but
        // "do they hold THIS HOUSE'S ROAD". Somebody in a metal house
        // practising an elementless primer is not a contradiction and is not
        // the house's own art either.
        if (npc.cultivation.techniqueIds.some(id => elementOf.get(id) === road)) onRoad++;
        else offRoad++;
        // THE INVARIANT THIS FIX ACTUALLY ENFORCES. Not "everybody walks the
        // primary road" - a secondary road is a real career - but "nobody
        // stands above the end of every road their own root can walk here".
        const cfx = catalog.factions.find(f => f.id === npc.factionId);
        if (cfx) {
            const hr = houseRoadOf(cfx);
            const root = getSpiritRoot(npc.cultivation.spiritRoot);
            // Only a teaching narrowness is a bar; a stated preference is strong
            // but soft. Must match the seeder's own test.
            const closed = hr.regime === 'single_road';
            if (roadRefuses(hr, root)) {
                refusedAtAll++;
                // The hard rule applies only where the house has one road and
                // nothing else to promote anybody on. An open or demonic house
                // promoting somebody its dominant road refuses is the design.
                if (closed && npc.factionRankIndex > 0) refusedAboveServantRung++;
            }
            const ceil = reachableCeiling(hr, root);
            if (Number.isFinite(ceil) && npc.cultivation.realmOrdinal > ceil) {
                pastTheirCeiling++;
                if (closed) pastCeilingClosed++;
            }
        }
        if (!fits) {
            // Of the people the road refuses, how many are senior enough that
            // the house would have had to raise them on something else?
            const ladder0 = ranksById.get(npc.factionId!) ?? 1;
            if (npc.factionRankIndex >= ladder0 - 2) refusedSeniors++;
        }

        const ord = npc.cultivation.realmOrdinal;
        for (let i = 0; i < BANDS.length; i++) {
            if (ord >= BANDS[i][1] && ord <= BANDS[i][2]) {
                fitByBand[i].n++; if (fits) fitByBand[i].fit++;
            }
        }
        const ladder = ranksById.get(npc.factionId!) ?? 1;
        if (npc.factionRankIndex >= ladder - 2) { rankTop.n++; if (fits) rankTop.fit++; }
        if (npc.factionRankIndex === 0) { rankBottom.n++; if (fits) rankBottom.fit++; }
        if (placed) { placedElemental++; placedTotal++; if (fits) placedFit++; }
    }
}

const pc = (a: number, b: number) => b === 0 ? '   -  ' : (100 * a / b).toFixed(1).padStart(6);

console.log(`\nWorlds: ${seeds.length}, read at creation.\n`);
console.log('CAN THEY READ THE ROAD THEIR OWN HOUSE TEACHES?');
console.log('  band            n    fit%');
for (let i = 0; i < BANDS.length; i++) {
    console.log('  ' + BANDS[i][0].padEnd(12) + String(fitByBand[i].n).padStart(6)
        + pc(fitByBand[i].fit, fitByBand[i].n));
}
console.log('  ' + 'rung 0'.padEnd(12) + String(rankBottom.n).padStart(6) + pc(rankBottom.fit, rankBottom.n));
console.log('  ' + 'top 2 rungs'.padEnd(12) + String(rankTop.n).padStart(6) + pc(rankTop.fit, rankTop.n));
console.log('  ' + 'catalog-placed'.padEnd(12) + String(placedTotal).padStart(6) + pc(placedFit, placedTotal));

console.log('\nWHAT THEY ACTUALLY HOLD');
console.log(`  techniques held, total          ${holdersChecked}`);
console.log(`  held against their own root     ${heldConflicts}`);
console.log(`  in an elemental house           ${inElementalHouse}`);
console.log(`  ...holding nothing at all       ${emptyHanded} (${pc(emptyHanded, inElementalHouse).trim()}%)`);
console.log(`  ...holding the HOUSE'S OWN road ${onRoad} (${pc(onRoad, onRoad + offRoad).trim()}%)`);
console.log(`  refused by their own road, and still senior  ${refusedSeniors}`);
console.log('\nTHE INVARIANTS');
console.log(`  refused by their house's road, total        ${refusedAtAll}`);
console.log(`  ...of those, above the servant rung         ${refusedAboveServantRung}   <- must be 0 in a closed house`);
console.log(`  standing above every road they can walk     ${pastTheirCeiling} (in a closed house: ${pastCeilingClosed})`);

console.log('\nWORLD ROOT HISTOGRAM (the reverse-failure guard)');
console.log('  root                          all%   derived%    table%');
const allN = [...rootTally.values()].reduce((a, b) => a + b, 0);
const derN = [...rootTallyDerived.values()].reduce((a, b) => a + b, 0);
const wTotal = SPIRIT_ROOTS.reduce((s, r) => s + r.weight, 0);
for (const r of SPIRIT_ROOTS) {
    console.log('  ' + r.key.padEnd(28)
        + pc(rootTally.get(r.key) ?? 0, allN)
        + pc(rootTallyDerived.get(r.key) ?? 0, derN)
        + (100 * r.weight / wTotal).toFixed(1).padStart(10));
}
