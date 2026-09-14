/**
 * What a sealed pocket still grows, which is what the open world stopped.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE RULING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The materials for the top of the craft ladder EXIST ON THIS SIDE. They are
 * sealed, in pockets nothing has drawn on since somebody shut them, and getting
 * into one and back out carrying something is the road to the top of the craft
 * ladder. A finished immortal- or chaos-grade dose in circulation came from
 * above because that road is HARD, not because it is closed.
 *
 * So the gate is the door and the material behind it. It is never a flag that
 * forbids the attempt. Every immortal and chaos formula in `recipes.ts` stays
 * readable, costable and attemptable, and what stops anybody is that the bill
 * names things only standing in ground somebody has to open.
 *
 * The one exception is already modelled and is not touched here.
 * `herb-thousand-autumn-chrysanthemum` is in `EXTINCT_HERB_IDS` and nothing
 * grows it anywhere, sealed ground included: a pocket preserves what was
 * growing when the door shut, it does not bring back what stopped growing
 * everywhere. That formula is the one nobody can fill at any price, and it is
 * why this file is about scarcity rather than about impossibility.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHICH GROUND, AND THE TWO READINGS THAT MEASURED ZERO FIRST
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A pocket holds a stand at this height where the door arc already says it is
 * worth six centuries of waiting: `worthBehindTheDoor` at its top step, which
 * is spirit-tide qi AND a hoard sealed in with it. One reading, already
 * written, already load-bearing - it is what sets a six-hundred-year cycle -
 * and no second number anywhere.
 *
 * TWO OTHER READINGS WERE TRIED AND BOTH SEEDED NOTHING. Recorded because they
 * are the two anybody would reach for, and the measurement is the reason not
 * to (`probe-what-is-standing-in-the-sealed-ground.ts`, six pinned worlds):
 *
 *   THE FIERCENESS OF THE GROUND. `harvestOrdinal` against `thresholds.survival`
 *   is nought everywhere: the deepest survival bar on any sealed ground in any
 *   world is 28 and the immortal band opens at 29. Against `thresholds.mastery`
 *   it is eight pieces of ground over six worlds, every one of them a ruin.
 *
 *   WHAT THE GROUND IS MADE OF. A ruin's ground is `ruins`, whose two rows at
 *   this height ask ordinal 33 and 37, against a deepest ruin bar of 30. Joined
 *   with the reading above it is zero stands in six worlds. And the joint is
 *   wrong on its own terms: the biome column says where a thing grows in the
 *   OPEN world, which is precisely the world these things have stopped growing
 *   in, and a sealed pocket is a piece of preserved elsewhere rather than a
 *   piece of the province it is buried under.
 *
 * WHICH MATERIAL is drawn on `rarityWeight`, which is the catalog's own
 * statement about what is commoner and is the same weighting `rollHerb` uses,
 * so chaos-grade rows come up at 3 in 26 against the immortal ones. Drawn off
 * the pocket's own id, so it is a fact about that pocket and gives the same
 * answer whenever anybody asks.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE QUANTITIES, AND WHAT THEY WERE PITCHED AGAINST
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ONE STAND PER POCKET, ONE OR TWO UNITS IN IT. A tracked row is one thing -
 * `howAGradeIsStored` puts everything above earth grade in the row tier - so
 * two units are two rows and there is no quantity field to drift.
 *
 * Pitched against what the door arc measured. Of sealed pocket ground, 23.7%
 * is on a season and 71% is shut until somebody goes and opens it; a door on a
 * season is not spent by the parties that walk one window of it, while the
 * finite half goes at 56.1% over three hundred years. Measured over twelve
 * pinned worlds (`probe-what-is-standing-in-the-sealed-ground.ts`): 9.7 undrawn
 * pockets a world, 1.8 of them worth six centuries, 2.1 units seeded, and 3 of
 * the 12 worlds hold enough for any one formula at all.
 *
 * WHAT THE CAP OF TWO BUYS, and it is the whole of the pitch. Every chaos
 * formula names at least two different things at this height, so no pocket ever
 * fills one. Four of the eight immortal formulas name one thing twice, so a
 * full pocket fills one of those and nothing else - and even then the
 * refinement fails four times in five, the shared immortal and chaos success
 * band running 0.05 to 0.3. That is the intended shape: one six-century door,
 * opened by somebody who was standing there on the day, is one attempt at the
 * shallowest medicine the lower realm cannot make. A determined cultivator gets
 * there. It is not a thing that happens.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IS NOT HERE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ANYTHING PER YEAR. Seeding runs once. Nothing in this module is called from
 * `applyPressure` and nothing walks a location table on a running pass, because
 * the world advance is already superlinear and a stand in a hole does not need
 * a tick to keep standing there. The consequence is stated rather than hidden:
 * the world's own people do not bring these out. `how-a-cultivator-comes-by-a-
 * road.ts` drains `unrecovered` comprehension materials and deliberately does
 * not see these - `isUnspent` wants the `single-use` tag and a stand of herbs
 * is not single-use - and the `emptied` sweep in `the-world-changing-on-its-
 * own.ts` only walks ground that never shut, which by construction is not
 * ground this module seeds. So the stock a world opens with is the stock it
 * has. That is an absence somebody may want to close, and closing it costs a
 * pass.
 *
 * AND ANY REGROWTH. `REGROWTH_YEARS_BY_GRADE` already says an immortal band
 * takes 3,000 years to come back and a chaos band 30,000, which is longer than
 * any run. A stand taken is gone. The GROUND is not: a door on a season shuts,
 * comes round, and is a race again, and what the race is for after the first
 * party is whatever else is behind it.
 */

import { getHerb, isExtinct, type Herb } from '../../data/cultivation/herbs.js';
import { getPill } from '../../data/cultivation/pills.js';
import { RECIPES } from '../../data/cultivation/recipes.js';
import { forStream } from '../cultivation/rng.js';
import {
    A_HOARD_WORTH_WAITING_FOR,
    CYCLE_YEARS_BY_WORTH,
    worthBehindTheDoor
} from './how-long-a-door-stays-shut.js';
import {
    aSealHereMeansAnUndrawnPocket,
    type LocationRecord
} from './locations.js';
import {
    howMuchAGradeIsWorthTracking,
    makeObject,
    type ObjectRecord
} from './possessions.js';
import type { WorldState } from './world-state.js';

/** The tag every row this module writes carries, so one filter finds them all. */
export const A_STAND_IN_SEALED_GROUND = 'sealed_stand';

/**
 * The materials the top of the craft ladder needs, derived from the formulas
 * that need them.
 *
 * Not an authored list. A recipe regraded, an ingredient swapped or a formula
 * added arrives here on its own, which is the only way this stays in step with
 * `recipes.ts` - a second list of ids would be the copy that goes stale the
 * first time the catalog moves.
 *
 * Two filters and both are already facts. The FORMULA has to be one the lower
 * realm cannot supply, which is its produced pill's grade. The INGREDIENT has
 * to be at that height itself, because the heaven-grade things in those bills
 * are got the ordinary way - a house stocks them and a cultivator at 27 can
 * stand where they grow.
 *
 * Extinct rows are dropped here rather than at the call site, for the reason
 * `findHerbsForOrdinal` gives: there is no reachability question about
 * something that is not there.
 *
 * Deriving off the bill rather than off the grade is also what keeps the Chaos
 * Seed out. It is chaos-grade and it is not in any formula, and it is scarce in
 * the way a famous object is scarce - four known, three accounted for - which
 * is not a thing that stands in a hole.
 */
export const WHAT_THE_TOP_OF_THE_LADDER_NEEDS: readonly Herb[] = (() => {
    const ids = new Set<string>();
    for (const recipe of RECIPES) {
        const grade = getPill(recipe.producesPillId)?.grade;
        if (grade !== 'immortal' && grade !== 'chaos') continue;
        for (const ingredient of recipe.ingredients) ids.add(ingredient.itemId);
    }
    const out: Herb[] = [];
    for (const id of [...ids].sort()) {
        const herb = getHerb(id);
        if (!herb) continue;
        if (herb.grade !== 'immortal' && herb.grade !== 'chaos') continue;
        if (isExtinct(herb.id)) continue;
        out.push(herb);
    }
    return out;
})();

/** The top step of {@link worthBehindTheDoor}: spirit-tide qi and a hoard. */
export const WORTH_SIX_CENTURIES = CYCLE_YEARS_BY_WORTH.length - 1;

/** Manuals and objects sealed in with a pocket, read off the record. */
function hoardIn(place: LocationRecord): number {
    return Number(place.data.techniqueCount ?? 0) + Number(place.data.treasureCount ?? 0);
}

/**
 * Whether this is ground nothing has drawn on.
 *
 * Closed ground AND still closed. A pocket standing open is a pocket the
 * province has been walking into, and the whole claim this file makes about
 * what is still growing in one rests on nobody having been. That takes ground
 * left standing open out by construction - a legacy is not a seal, and
 * `locationFromRuin` writes it with no seal and no cycle - which is also why
 * the `emptied` sweep that carries a never-shut ground's stock out to its
 * opener never meets one of these.
 *
 * The seal column is read rather than a day, because seeding is the one moment
 * where there is no schedule to have drifted from: `scheduleForAnAncientSite`
 * has just written the cycle and the column together.
 */
export function isAnUndrawnPocket(place: LocationRecord): boolean {
    return aSealHereMeansAnUndrawnPocket(place.kind)
        && (place.sealed || place.cycle !== null);
}

/**
 * Whether the top of the ladder is standing in this pocket at all.
 *
 * The same two facts `worthBehindTheDoor` reads and in the same call, so a
 * pocket that holds one of these is exactly a pocket the door arc prices at six
 * centuries. If that wait is ever retuned, this moves with it.
 */
export function aPocketWorthSixCenturies(place: LocationRecord): boolean {
    if (!isAnUndrawnPocket(place)) return false;
    return worthBehindTheDoor({
        qiDensity: place.qiDensity,
        hoardCount: hoardIn(place)
    }) >= WORTH_SIX_CENTURIES;
}

/**
 * What is standing in this pocket, or null where nothing is.
 *
 * Pure and stable: the draw is off the world's seed and the pocket's own id, so
 * asking twice gives one answer and a pocket's stand is a fact about the pocket.
 *
 * THE WORLD SEED IS IN IT AND HAS TO BE. Measured on the cut that keyed the
 * draw on the pocket alone: the ruins deep enough to qualify come out of the
 * same catalog in every world, so 25 stands over twelve worlds were four
 * materials and not one of them was chaos-grade - a gap covering 38% of the
 * draw never came up once. A stand keyed on the ruin row is the same stand in
 * every world there is, which is a property of the catalog rather than of any
 * world.
 */
export function whatThisPocketStillGrows(
    worldSeed: string,
    place: LocationRecord
): Herb | null {
    if (!aPocketWorthSixCenturies(place)) return null;
    const pool = WHAT_THE_TOP_OF_THE_LADDER_NEEDS;
    if (pool.length === 0) return null;
    const total = pool.reduce((sum, h) => sum + h.rarityWeight, 0);
    let cursor = forStream(worldSeed, 'sealed-pocket-stand', place.id).next() * total;
    for (const herb of pool) {
        cursor -= herb.rarityWeight;
        if (cursor < 0) return herb;
    }
    return pool[pool.length - 1];
}

/** Most units of one thing a single pocket is ever holding. */
export const MOST_IN_ONE_POCKET = 2;

/**
 * Put the stands in the ground.
 *
 * Returns the rows. Nothing is mutated, the same contract
 * `seedComprehensionMaterials` keeps, so the caller decides when they enter the
 * world and every stream above this line draws exactly what it drew before.
 */
export function seedWhatSealedPocketsStillGrow(state: WorldState): ObjectRecord[] {
    const rng = forStream(state.seed, 'sealed-pocket-stands');
    const out: ObjectRecord[] = [];

    for (const place of state.locations) {
        const herb = whatThisPocketStillGrows(state.seed, place);
        if (!herb) continue;

        // A second unit where the hoard says the pocket was closed in a hurry
        // with a great deal still in it. `A_HOARD_WORTH_WAITING_FOR` is the bar
        // the wait already steps on, read once more rather than halved into a
        // new one.
        const units = hoardIn(place) > A_HOARD_WORTH_WAITING_FOR && rng.chance(0.5)
            ? MOST_IN_ONE_POCKET
            : 1;

        for (let i = 0; i < units; i++) {
            out.push(makeObject({
                id: `stand-${place.id}-${herb.id}-${i}`,
                name: herb.name,
                kind: 'material',
                significance: howMuchAGradeIsWorthTracking(herb.grade),
                // NULL, AND THE RULE IS ABOVE `ObjectKind`. A material carries a
                // grade; what a thing made from it stands at is a fact about the
                // hand that works it. `power` is the fight column and a cutting
                // of heartwood does nothing in a fight.
                power: null,
                description: herb.description,
                // NOBODY HOLDS IT AND NOBODY OWNS IT, which is the exact triple
                // `whatIsStandingFreeAt` looks for, so whoever gets in can pick
                // it up through the taking verb with no new read anywhere.
                possessorId: null,
                ownerId: null,
                ownerName: '',
                locationId: place.id,
                tags: [
                    'material',
                    'herb',
                    A_STAND_IN_SEALED_GROUND,
                    `grade:${herb.grade}`,
                    `biome:${herb.biome}`
                ],
                data: {
                    // The key `objectForBeastMaterial` already uses for the same
                    // question - which catalog row is this - so anything that
                    // resolves a material off an object row reaches both.
                    materialId: herb.id,
                    grade: herb.grade,
                    value: herb.value,
                    harvestOrdinal: herb.harvestOrdinal,
                    biome: herb.biome
                }
            }));
        }
    }
    return out;
}
