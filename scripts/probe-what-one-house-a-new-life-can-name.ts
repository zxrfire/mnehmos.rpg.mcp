/**
 * Why every life in the world starts knowing the same one house.
 *
 * Measured after a played finding: eight fresh lives, eight different seeds,
 * and all eight could name exactly one house - Azure Dew Sect - out of a world
 * with thirteen doors standing at rung 2 or below. The question this answers is
 * WHY, because "add more open houses" and "fix what a new life knows" are very
 * different pieces of work and the world already had the houses.
 *
 * Run: node --loader ts-node/esm scripts/probe-what-one-house-a-new-life-can-name.ts
 */
import { SECTS, getSect, intakeRouteOf } from '../src/data/cultivation/sects.js';
import { commonlyNamedHouse, housesWithinEarshot } from '../src/engine/birth/birth.js';
import { ORIGIN_TIERS } from '../src/engine/cultivation/origin.js';
import { prefectureForFaction, provinceForFaction } from '../src/data/cultivation/regions.js';
import { publishedDoorOf } from '../src/engine/encounters/what-a-house-will-teach-somebody-it-has-not-taken.js';

const houses = SECTS.map(s => ({
    id: s.id,
    name: s.name,
    admissionOrdinal: s.admissionOrdinal,
    powerOrdinal: s.powerOrdinal,
    recruits: s.recruits
}));

// ── 1. HOW MANY DOORS ACTUALLY STAND OPEN AT THE BOTTOM ──────────────────
const open = SECTS.filter(s => s.recruits && s.admissionOrdinal <= 2)
    .sort((a, b) => a.admissionOrdinal - b.admissionOrdinal || a.id.localeCompare(b.id));
console.log(`DOORS AT RUNG 2 OR BELOW: ${open.length} of ${SECTS.length} houses\n`);
for (const s of open) {
    const province = provinceForFaction(s.id);
    const prefecture = prefectureForFaction(s.id);
    console.log(
        `  bar=${s.admissionOrdinal}  ${s.name.padEnd(30)} `
        + `${(province?.name ?? '(no province)').padEnd(18)} `
        + `${(prefecture?.name ?? '-').padEnd(20)} intake=${intakeRouteOf(s.id)}`
    );
}

// ── 2. WHAT A LIFE WITH NO STANDING IS TOLD ──────────────────────────────
const common = commonlyNamedHouse(houses);
console.log(`\nTHE ONE NAME EVERY UNPLACED LIFE GETS: ${common?.name ?? '(none)'}`);
console.log(
    '  `commonlyNamedHouse` = lowest admissionOrdinal among recruiters, tie-broken by id.\n'
    + `  Houses tied at that bar: ${open.filter(s => s.admissionOrdinal === (common ? getSect(common.id)!.admissionOrdinal : -1)).length}. `
    + 'The tie-break is alphabetical on the id, so the other ones are\n'
    + '  unreachable to every player in every run, forever.'
);
console.log(
    `  Tied, in id order: ${SECTS
        .filter(s => s.recruits && s.admissionOrdinal === (common ? getSect(common.id)!.admissionOrdinal : -1))
        .map(s => s.id).sort().join(', ')}`
);

// ── 3. AND WHAT STANDING BUYS, WHICH IS THE OTHER HALF ───────────────────
console.log('\nWHAT EACH ORIGIN TIER HEARS AT HOME (housesWithinEarshot):');
for (const [key, tier] of Object.entries(ORIGIN_TIERS)) {
    const heard = housesWithinEarshot(tier as never, houses);
    console.log(
        `  ${key.padEnd(18)} reach=${String((tier as any).placement.reach).padStart(3)} `
        + `houses named at home: ${heard.length}`
    );
}

// ── 4. THE ONE DOOR A HOUSE PUBLISHES BELOW ITS OWN BAR ──────────────────
const published = SECTS.filter(s => publishedDoorOf(s.id) !== null);
console.log(`\nHOUSES PUBLISHING A DOOR BELOW THEIR MEMBERSHIP BAR: ${published.length}`);
for (const s of published) {
    const door = publishedDoorOf(s.id)!;
    console.log(
        `  ${s.name}: door at ${door.atOrdinal}, membership bar at ${door.membershipOrdinal}, `
        + `only one in the world = ${door.theOnlyOneInTheWorld}, `
        + `a favour buys nothing = ${door.aFavourBuysNothingHere}`
    );
}
