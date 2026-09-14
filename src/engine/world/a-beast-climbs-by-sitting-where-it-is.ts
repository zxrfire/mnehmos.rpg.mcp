/**
 * What three hundred years on one ledge does to the thing standing on it.
 *
 * The catalog's ordinal says where a KIND is usually found. Nothing anywhere
 * said what the individual on this particular ground had got to, so the top of
 * the ladder could only grow by somebody authoring another row - and the design
 * owner's ruling is the opposite of that: *"the top doesn't have to grow but
 * beasts should eventually hit 29 naturally."*
 *
 * ── IT IS A READING, NOT A PASS ─────────────────────────────────────────
 *
 * The world advance is already superlinear and a separate piece of work is
 * bounding it, so nothing here may add a sweep. A rung is a FUNCTION of three
 * things the caller already holds - the species, the ground, and how long the
 * thing has been sitting on it - so it is computed when somebody asks, stored
 * nowhere, and never accumulated. A row asked at year nine hundred gets what
 * nine hundred years did rather than what sixty-six reviews added up to, which
 * is why the answer cannot drift and why the pass costs the same at every
 * horizon.
 *
 * The rows this moves are the ones minted on contact by
 * `a-beast-with-a-core-is-somebody-in-particular.ts`, and it moves them on the
 * yearly advance that already runs, where it REPLACES the human branch rather
 * than adding to it: a beast has no book, no teacher, no house ground and no
 * province ceiling, so `applyAdvancement` was computing four of those for it
 * and then refusing it at a ceiling of 20. One call is cheaper than what the
 * pass already does, so the world advance got no dearer for this.
 *
 * Nothing sweeps ground nobody has met, and that is the trade rather than an
 * oversight - see the header of the file that mints a row for what a store
 * keyed on ground was measured to cost.
 *
 * ── THE YEARS COME OFF THE LADDER, NOT OFF A NEW CONSTANT ───────────────
 *
 * `whatItSpentGettingHere` already priced a beast's whole method: it sat on the
 * best ground it could hold and did not die, and what that cost is a life at
 * the band below. That function lived privately in the file that stands one up
 * and is exported from here now, because running it FORWARD is the climb and a
 * second expression of it would drift.
 *
 * Read off `lifespanForOrdinal`, a beast is 200 years old at Core Formation,
 * 500 at Nascent Soul, 1,000 at Deity Transformation and 2,000 at the change.
 * Those are band figures and the rungs inside a band are free of them, so the
 * jump into a band is spread across the rungs of the band below it - 125 years
 * a rung through Nascent Soul, 250 through Deity Transformation. A thing found
 * at 24 is then 1,125 years of sitting from standing up as a person, and one
 * found at 17 is 1,800. That is the register the catalog itself is written in
 * and the genre's own figure for this: the change is a thing that happens to
 * something that has been on its mountain for a millennium.
 *
 * ── AND MOST OF THEM NEVER DO ───────────────────────────────────────────
 *
 * "Simulate less and hardcode more with odds" is the sanctioned method, so the
 * variation is one draw rather than a per-year roll. Half of them never move at
 * all, and the rest are paced between {@link SLOWEST} and {@link FASTEST} of
 * the ladder's figure. The draw is keyed on the world seed, the species and the
 * ground, which is the same pair that identifies the individual everywhere
 * else, so two White Tigers on two mountains are two different animals and
 * walking back onto the same mountain finds the same one.
 */

import { anythingAtThisRungSpeaks, type Beast } from '../../data/cultivation/beasts.js';
import { forStream } from '../cultivation/rng.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { MAX_ORDINAL, clampOrdinal, lifespanForOrdinal } from '../cultivation/realms.js';

/**
 * How old a beast is when it arrives at a rung: a whole life at the band below.
 *
 * THE BAND AND NOT THE RUNG, and the difference is load-bearing. The ladder's
 * lifespans come in steps, so "a life at the rung below" hands a Glacier Lynx
 * at 19 exactly the five hundred years it is allowed and it arrives already
 * dead. Reading down to where the number actually changes leaves every one of
 * them old and still standing.
 */
export function whatItSpentGettingHere(ordinal: number): number {
    const allowed = lifespanForOrdinal(ordinal);
    for (let rung = ordinal - 1; rung >= 0; rung--) {
        const below = lifespanForOrdinal(rung);
        if (below < allowed) return below;
    }
    return 0;
}

/**
 * The same figure with the rungs inside a band filled in.
 *
 * `whatItSpentGettingHere` is a step function, so four rungs of a realm share
 * one age and three of every four rungs would cost nothing at all. The jump
 * into the next band is spread evenly across the rungs that lead to it, which
 * leaves the band edges exactly where the step function put them and makes the
 * curve between them monotone.
 */
export function yearsOfSittingToReach(ordinal: number): number {
    const rung = clampOrdinal(ordinal);
    const here = whatItSpentGettingHere(rung);
    // The top of this band, and what standing on the first rung above it costs.
    let top = rung;
    while (top < MAX_ORDINAL && whatItSpentGettingHere(top + 1) === here) top++;
    if (top >= MAX_ORDINAL) return here;
    const next = whatItSpentGettingHere(top + 1);
    // How far into the band this rung is, out of the rungs the band holds.
    let bottom = rung;
    while (bottom > 0 && whatItSpentGettingHere(bottom - 1) === here) bottom--;
    const width = top - bottom + 1;
    return here + ((next - here) * (rung - bottom)) / width;
}

/**
 * What the ground gives it, off the column that says what it does with ground.
 *
 * Not a second opinion about qi: `veinRelation` is the catalog's own statement
 * of a species' relation to what is underfoot, `beastsOnThisGround` already
 * uses `persistence` to decide what can stand on a vein at all, and this is the
 * rate the same fact implies. A thing that takes from a vein continuously gets
 * more out of a year than a thing that wants nothing from the earth.
 */
export const WHAT_THE_GROUND_GIVES_IT: Readonly<Record<Beast['veinRelation'], number>> =
    Object.freeze({
        drains: 1.25,
        holds: 1,
        follows: 1,
        indifferent: 0.6
    });

/** What a vein is worth on top of that, where the ground it sits on is one. */
export const A_VEIN_IS_WORTH = 1.4;

/**
 * The share that stay animals.
 *
 * Stated as odds rather than simulated, which is the sanctioned method. It is
 * the figure that decides how much the top of the ladder grows, and the ruling
 * it encodes is that it does not have to: half of every species on every piece
 * of ground in the world is standing exactly where the catalog put it, for as
 * long as the world runs.
 */
export const MOST_NEVER_DO = 0.5;

/** The slowest and fastest pace a climber can be dealt. */
export const SLOWEST = 0.7;
export const FASTEST = 1.5;

export interface TheOneSittingHere {
    beast: Beast;
    /** The ground it holds. Half of what identifies it, so never optional. */
    locationId: string;
    /** The world's seed. The run's seed would make one animal two. */
    worldSeed: string;
    /** The ground is a vein, or close enough to one to matter. */
    onAVein?: boolean;
}

/**
 * How fast this one climbs, or zero for the ones that never will.
 *
 * ONE DRAW FOR THE LIFE OF THE ANIMAL. A per-year roll would be a pass, and a
 * pace that changed when it was asked twice would make the same creature two
 * different ages depending on who looked.
 */
export function thePaceThisOneKeeps(input: TheOneSittingHere): number {
    const rng = forStream(input.worldSeed, 'beast-climb', input.beast.id, input.locationId);
    const drawn = rng.next();
    if (drawn < MOST_NEVER_DO) return 0;
    const along = (drawn - MOST_NEVER_DO) / (1 - MOST_NEVER_DO);
    const pace = SLOWEST + along * (FASTEST - SLOWEST);
    return pace
        * WHAT_THE_GROUND_GIVES_IT[input.beast.veinRelation]
        * (input.onAVein ? A_VEIN_IS_WORTH : 1);
}

export interface WhatTheYearsDidToIt {
    /** Where it is now. Never below where the catalog places its kind. */
    ordinal: number;
    /** How many rungs the world moved it. Zero for most of them. */
    rungsClimbed: number;
    /** Whether it is past the change and is therefore a person. */
    crossed: boolean;
    /** Zero for one that never will, which is the commonest answer. */
    pace: number;
}

/**
 * What the one standing on this ground has climbed to, after this many years.
 *
 * `years` is how long it has SAT, not how old it is: the catalog's ordinal
 * already carries the life it spent getting there, and this adds what has
 * happened since. {@link yearsItHasSatSinceItsRowWasWritten} is where that
 * figure comes from for a row the world holds.
 *
 * IT STOPS WHEN IT WOULD HAVE DIED. A rung allows a number of years and the
 * total sitting to reach it is what this thing has spent; where the second
 * exceeds the first there is nothing standing there to have climbed. That gate
 * does not bite below the change and does bite at the top of the ladder, which
 * is the correct shape: the ordinary end of this is a beast that grew very old
 * on its mountain and never took a shape.
 */
export function whatTheYearsDidToTheOneHere(
    input: TheOneSittingHere & { years: number }
): WhatTheYearsDidToIt {
    const from = clampOrdinal(input.beast.ordinal);
    const pace = thePaceThisOneKeeps(input);
    const spent = Math.max(0, input.years) * pace;

    let ordinal = from;
    while (ordinal < MAX_ORDINAL) {
        const next = ordinal + 1;
        const owed = yearsOfSittingToReach(next) - yearsOfSittingToReach(from);
        if (owed > spent) break;
        if (yearsOfSittingToReach(next) > lifespanForOrdinal(next)) break;
        ordinal = next;
    }

    return {
        ordinal,
        rungsClimbed: ordinal - from,
        // The boundary is never restated here. `anythingAtThisRungSpeaks` is
        // where it lives and a fourth expression of it is how three that exist
        // start to disagree.
        crossed: anythingAtThisRungSpeaks(ordinal),
        pace
    };
}

/**
 * How long a row has been sitting there since anybody established where it was.
 *
 * THE CLOCK STARTS AT THE ROW, NOT AT THE WORLD'S OPENING DAY, and the
 * difference was measured. A world opens at calendar year 1,000, so a clock
 * anchored there mints every beast at what a thousand years does and rebalances
 * every encounter in the game before anybody has played a turn - which is a
 * balance change wearing a simulation's clothes. See the header of
 * `a-beast-with-a-core-is-somebody-in-particular.ts` for the test that caught
 * it.
 *
 * DERIVED FROM THE ROW'S AGE AND THE CATALOG, so nothing is stored and it is
 * exactly zero at the moment the row is written: `standUpTheOneOnThisGround`
 * sets `bornOnDay` back by {@link whatItSpentGettingHere} of the catalog's
 * rung, and this subtracts the same figure through the same function. Two
 * expressions of one number cannot disagree when there is only one of them.
 */
export function yearsItHasSatSinceItsRowWasWritten(
    bornOnDay: number,
    beast: Beast,
    day: number
): number {
    const age = (day - bornOnDay) / DAYS_PER_YEAR;
    return Math.max(0, age - whatItSpentGettingHere(clampOrdinal(beast.ordinal)));
}

/**
 * Where a row that already exists should be standing today.
 *
 * Never below where it already stands: a rung reached by any other road - an
 * operator, a gift, something the world did - is a fact, and nothing here may
 * take one back.
 */
export function theRungThisRowShouldBeAt(input: TheOneSittingHere & {
    /** The row's own `identity.bornOnDay`. */
    bornOnDay: number;
    /** Absolute world day. */
    day: number;
    standingAt: number;
}): number {
    return Math.max(
        clampOrdinal(input.standingAt),
        whatTheYearsDidToTheOneHere({
            ...input,
            years: yearsItHasSatSinceItsRowWasWritten(input.bornOnDay, input.beast, input.day)
        }).ordinal
    );
}

/**
 * The species row read at the rung this individual actually got to.
 *
 * The trick `whatItIsNow` already uses, named once so callers stop spelling it
 * out: `bandOf`, `abilityAt` and `readsAsSomebody` all take a `Beast` and all
 * of them want THIS one's rung rather than the catalog's.
 */
export function asItStandsNow(beast: Beast, ordinal: number): Beast {
    return { ...beast, ordinal: clampOrdinal(ordinal) };
}
