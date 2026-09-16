/**
 * Who goes out for a house, and what comes back.
 */

import {
    SENDING_REASONS,
    TIER_NAMES,
    type AtStake,
    type ReasonNeed,
    type SendingReason
} from '../../data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import { getParentage, getSubsidiariesOf } from '../../data/cultivation/governance-and-water-rights.js';
import { containmentHeldBy } from '../../data/cultivation/artifacts.js';
import { regardFor, type Regard } from '../cultivation/regard.js';
import { clampOrdinal } from '../cultivation/realms.js';
import type { CultivationRNG } from '../cultivation/rng.js';
import type { RegardBand } from '../../schema/cultivation.js';
import {
    canPointAt,
    highestStage,
    stageCeilingFor,
    stageRank,
    type KnowingStage
} from '../social/discovery.js';
import type { OnTheRoll } from '../social-leverage/what-a-body-wants-is-what-its-deciders-want.js';
import {
    whatThisHouseKnowsOf,
    type WhatAHouseKnows
} from './a-beast-that-took-a-shape-is-somebody.js';
import { makeFact, type HistoricalFact, type PendingFact } from './history.js';
import { theProvinceAround } from './ground-holder.js';
import {
    isOpenOn,
    nextOpeningDay,
    populationWeightOf,
    whatATownPaysItsHolder,
    type LocationRecord
} from './locations.js';
import { isBelowTheLid } from './layers.js';
import { couldHostAGuest } from './standing-at-the-gate-of-a-house.js';
import {
    daysByConveyance,
    whatTheChestBurns,
    type Conveyance
} from './what-a-conveyance-does-to-a-journey.js';

// ─────────────────────────────────────────────────────────────────────────
// THE HOUSE, AS THE BINDING PASS NEEDS IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * What has to be true about a house before it can want anything.
 */
export interface HouseAsItStands {
    id: string;
    name: string;
    /** True when it controls any location at all. */
    holdsGround: boolean;
    /** Standing toward other houses, -1..1. The record's own map. */
    standing: Readonly<Record<string, number>>;
    /**
     * Whether this house knows of open ground near it worth putting a party into.
     *
     * KNOWS, NOT HOLDS, and {@link aFindThisHouseCouldSendFor} is the one
     * reading of it. A ruin is public by agreement - that is the genre's
     * default and the world's - so what a house legitimately has over its
     * neighbours is better information, not a claim. The reason's own text has
     * said so since it was written: somebody has found a door, and the house
     * means to be the body that opens it rather than the body that hears about
     * it.
     */
    hasAFind: boolean;
    /**
     * Ids of the houses this one would sit down with, in the world's own order.
     *
     * `circleCandidatesFor` in `gatherings.ts` is the one answer to that
     * question - allies, plus bodies seated in the same province, minus anybody
     * hostile either way - and the caller that holds the world asks it. A second
     * ally rule written here would be a second opinion about who a house talks
     * to, and the world already holds gatherings off the first one.
     *
     * Absent where the caller has no world, which is the honest answer and not a
     * simplification: a catalog knows the houses and not who they are currently
     * on terms with.
     */
    sitsDownWith?: readonly string[];
    /**
     * Whether the world has closed ground in this house's own province.
     *
     * Scoped to the province deliberately. The thing that makes a house walk its
     * people out to a line is the line being near enough to walk to, and a fact
     * about the far side of the world is not a reason this house has.
     */
    standsNearForbiddenGround?: boolean;
    /**
     * Whether this house failed to pay its own people.
     *
     * `howThePurseIsRunning` is the one reading of it and the yearly economy
     * holds both terms it takes. Absent where the caller has no world, which is
     * the honest answer rather than a simplification - a catalog knows what a
     * house earns and not what it is currently holding.
     */
    cannotPayItsPeople?: boolean;
    /**
     * Whether the world holds ground in this house's province that would pay
     * them, and that somebody it owes nothing to is standing on.
     *
     * A SEPARATE FACT from the one above and deliberately not folded into it.
     * A house that cannot pay and has nowhere to reach is a house that scatters
     * or folds, and a single boolean would have said it was about to march.
     */
    knowsGroundThatWouldPayIt?: boolean;
}

/**
 * Standing above which a house is somebody's ally, and below which somebody's
 * rival.
 */
export const ALLIED_STANDING = 0.3;
export const RIVAL_STANDING = -0.3;

/**
 * One predicate per NEED KEY. Not one per reason.
 */
export const NEED_PREDICATES: Record<ReasonNeed, (house: HouseAsItStands) => boolean> = {
    nothing: () => true,
    ground: house => house.holdsGround,
    a_subsidiary: house => getSubsidiariesOf(house.id).length > 0,
    a_parent: house => getParentage(house.id)?.parentFactionId != null,
    an_ally: house => Object.values(house.standing).some(v => v >= ALLIED_STANDING),
    a_rival: house => Object.values(house.standing).some(v => v <= RIVAL_STANDING),
    a_find: house => house.hasAFind,
    a_containment: house => containmentHeldBy(house.id).length > 0,
    a_counterpart: house => (house.sitsDownWith?.length ?? 0) > 0,
    forbidden_ground: house => house.standsNearForbiddenGround === true,
    ground_that_pays_somebody_else: house =>
        house.cannotPayItsPeople === true && house.knowsGroundThatWouldPayIt === true
};

/**
 * Whether the world holds ground it has closed, in one house's own province.
 *
 * ONE READING, asked by the world's own sendings and by the board a player
 * reads, so the two cannot come to different conclusions about whether this
 * house has a line to walk anybody out to. `forbidZone` is the only writer of
 * `forbidden_zone` and it fires from the yearly pass and from a cascade, so a
 * freshly seeded world holds none: measured on twelve seeded worlds, zero at day
 * 0, zero at fifty years, and five and two at two hundred.
 *
 * Filtered before the walk because there are usually no forbidden zones at all,
 * and this is asked once per house per board read.
 */
export function forbiddenGroundInTheProvinceOf(
    locations: readonly LocationRecord[],
    seatLocationId: string | null
): boolean {
    const forbidden = locations.filter(l => l.kind === 'forbidden_zone');
    if (forbidden.length === 0) return false;
    const province = theProvinceAround(locations, seatLocationId);
    if (province === null) return false;
    return forbidden.some(l => theProvinceAround(locations, l.id) === province);
}

// ─────────────────────────────────────────────────────────────────────────
// A FIND IS SOMETHING A HOUSE KNOWS, NOT SOMETHING IT HOLDS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Where the open ground is, gathered once.
 *
 * `theProvinceAround` builds a map over EVERY location on every call, and the
 * reading below wants it once per ruin per house per year - which on a
 * long-lived world is O(ruins x locations) ten thousand times over. Both halves
 * come off one walk, so the index and the seat lookup cannot disagree about
 * which province anything is in, and `provinceOf` is the module's own reading
 * memoised rather than a second spelling of it.
 */
export interface WhereTheOpenGroundIs {
    /** The province a place sits in. Null where it sits in none. */
    provinceOf(locationId: string | null): string | null;
    /** Ruins standing open in one province, in the world's own order. */
    openGroundIn(province: string): readonly LocationRecord[];
}

export function whereTheOpenGroundIs(
    locations: readonly LocationRecord[],
    /**
     * The day being asked about. Omitted falls back to the column, which is
     * the honest answer for a caller that has no day and is what every caller
     * got before the schedule became the authority.
     */
    onDay?: number | null
): WhereTheOpenGroundIs {
    const province = new Map<string, string | null>();
    const provinceOf = (locationId: string | null): string | null => {
        if (locationId === null) return null;
        const had = province.get(locationId);
        if (had !== undefined) return had;
        const found = theProvinceAround(locations, locationId);
        province.set(locationId, found);
        return found;
    };

    const byProvince = new Map<string, LocationRecord[]>();
    for (const ground of locations) {
        // Standing, and not shut today. Nothing about whose name is on it -
        // and that survived monopoly being built: a house shut out of a ruin
        // still knows where it is, and being unable to walk in is not the same
        // fact as not having found it. A filter on `controllingFactionId` here
        // was tried and reverted for exactly that.
        // ── THE SCHEDULE, WHERE THERE IS ONE ────────────────────────────
        //
        // This read `ground.sealed` and argued that the column covers both
        // states a ruin can be shut in - a door nobody has opened, and one on a
        // season - because both mean nobody gets in now. That was true while
        // the column was the authority. It is not any more: the cycle decides,
        // and `sealed` is the world's RECORD that a door moved, refreshed at a
        // year boundary. So a ruin standing open today could carry a stale
        // `true` for up to a year and a shut one a stale `false` - and this
        // reading is what decides where a house sends a party, so the cost of
        // being wrong is somebody walking to a door that is not there.
        //
        // `isOpenOn` is the one answer and falls back to the column itself for
        // ground with no cycle, so nothing about the unscheduled case changes.
        const standingOpen = onDay === undefined || onDay === null
            ? !ground.sealed
            : isOpenOn(ground, Math.floor(onDay));
        if (ground.kind !== 'ruin' || !standingOpen) continue;
        const where = provinceOf(ground.id);
        if (where === null) continue;
        const bucket = byProvince.get(where);
        if (bucket) bucket.push(ground); else byProvince.set(where, [ground]);
    }

    return { provinceOf, openGroundIn: where => byProvince.get(where) ?? [] };
}

/**
 * Every way a name on a roll could have come by a piece of ground, at the best
 * rung any of them reaches.
 *
 * Composed in one named place rather than at each call site, because a caller
 * that forgets one of the readings gets `unaware` and no error - which is
 * exactly the failure this whole set of readings exists to end.
 */
export function whatAnybodyCouldHaveOfTheGround(
    ...readings: readonly ((holderId: string, locationId: string) => KnowingStage)[]
): (holderId: string, locationId: string) => KnowingStage {
    return (holderId, locationId) => {
        let stage: KnowingStage = 'unaware';
        for (const read of readings) stage = highestStage(stage, read(holderId, locationId));
        return stage;
    };
}

/** Open ground this house could put a party into, and where it stands on it. */
export interface AFindThisHouseHas {
    locationId: string;
    name: string;
    /** What the house stands at on it, and who carries that. */
    knows: WhatAHouseKnows;
}

/**
 * The stage a house's own people are at, off the world's own record of who was
 * standing where.
 *
 * NOT A SECOND KNOWLEDGE STORE. `knowledge_records` is the authority on what a
 * person holds and this does not write one, read one, or disagree with one: it
 * is the reading `howFarOff` already takes of the same two columns - an actor
 * or a witness on a fact sited somewhere WAS there - expressed as a rung
 * instead of as a distance. The rung is `stageCeilingFor('witnessed')` rather
 * than a literal, so the ladder keeps owning what having been somewhere is
 * worth.
 *
 * IT WAS THE ONLY SOURCE THE WORLD SIM HAD, and it is now one of three.
 * Nothing anywhere writes a knowledge row for a world NPC - every writer of
 * that table names the player or somebody an operator spawned - and nothing
 * should: see {@link whatTheAirCarriesOfTheGround} for the table that would
 * have been, and the README for what all three cost.
 *
 * What this one reaches is the person who WENT, which is the narrowest of the
 * three and the highest-rung. {@link whatAnybodyCouldHaveOfTheGround} composes
 * them, and every caller takes the composition rather than this alone.
 *
 * Built once over the ledger and handed round: the walk is per house per ruin
 * and the ledger of a long-lived world is long.
 *
 * THE ROLL FOR A PLACE IS GATHERED WHEN THE PLACE IS ASKED ABOUT. The rows are
 * sited once - one push each - and who stood on a piece of ground is worked out
 * the first time anybody asks about that ground, then kept for the rest of the
 * pass. Every caller asks about a handful of places and the ledger is sited all
 * over the world, so building every roll eagerly was building thousands that
 * nothing would read. Measured with `--cpu-prof` on one seed at 1,200 years:
 * 6.5ms per simulated year, the largest remaining term in the world advance,
 * nearly all of it adding actors and witnesses to sets nobody queried.
 */
export function whatStandingOnItGives(
    facts: readonly Pick<HistoricalFact, 'locationId' | 'actors' | 'witnessIds'>[]
): (holderId: string, locationId: string) => KnowingStage {
    const sited = new Map<string, Pick<HistoricalFact, 'actors' | 'witnessIds'>[]>();
    for (const fact of facts) {
        if (fact.locationId === null) continue;
        const here = sited.get(fact.locationId);
        if (here) here.push(fact); else sited.set(fact.locationId, [fact]);
    }
    const wasThere = new Map<string, Set<string>>();
    const rollFor = (locationId: string): Set<string> => {
        let roll = wasThere.get(locationId);
        if (roll) return roll;
        roll = new Set<string>();
        for (const fact of sited.get(locationId) ?? []) {
            for (const actor of fact.actors) roll.add(actor.id);
            for (const id of fact.witnessIds) roll.add(id);
        }
        wasThere.set(locationId, roll);
        return roll;
    };
    const beingThere = stageCeilingFor('witnessed');
    return (holderId, locationId) =>
        rollFor(locationId).has(holderId) ? beingThere : 'unaware';
}

/**
 * What a party's role on the row says about whether it came home.
 *
 * One spelling, read by {@link whatAHousesOwnErrandsBringBack} and written by
 * {@link newsOfASending}. A role is a free string on `HistoricalActor`, so the
 * two would otherwise agree by nothing but a typo nobody would notice: the
 * reading would go quietly empty and every house would go back to knowing
 * nothing about where it had sent people.
 */
export const WENT_AND_CAME_BACK = 'sent';
export const WENT_AND_DID_NOT = 'lost';
/**
 * And the third state, which is neither and is not an outcome at all.
 *
 * A party whose term runs past the end of the span being simulated has not come
 * back and has not failed to. {@link whatAHousesOwnErrandsBringBack} reads
 * `sent` and nothing else, so a house hears nothing off this row - which is
 * correct, because nobody has reported to it.
 */
export const WENT_AND_IS_NOT_BACK = 'out';

/**
 * Where a house's own parties have been, off the same ledger and the same two
 * columns.
 *
 * THE HALF OF BEING THERE THAT REACHES THE PEOPLE WHO DID NOT GO.
 * {@link whatStandingOnItGives} answers who stood on a piece of ground, and
 * whoever did is usually an outer disciple: a house ACTS through its deciders,
 * and its deciders stayed at home. Measured on three seeded worlds at two
 * hundred years, before this existed - of the houses with open ground in their
 * own province, 26 of 28, 26 of 35 and 25 of 40 had somebody on the roll who had
 * stood on some of it, and only 21, 20 and 22 could point at it. The houses in
 * that gap had sent people and had not heard from them.
 *
 * A PARTY THAT CAME BACK REPORTED. That is what an errand is, and it is the one
 * acquisition in this layer that is not somebody having been somewhere - so the
 * rung is `stageCeilingFor('told')` rather than the witness ceiling. `told` is
 * `placed`, which is exactly `REACHABLE_FROM`: the house can now say where the
 * ground is and set out for it, and has no more than that.
 *
 * WHO ON THE ROLL HEARS IT IS EVERYBODY, and that is the smallest honest rule
 * rather than a convenience. The errand was posted on the house's own wall, the
 * party was seen to go and seen to come back, and the report is made in the
 * house's own hall. A house's own sendings are the one thing its whole roll
 * does know about. Nothing outside the house is touched: a neighbour's errand
 * is a neighbour's business and leaves this reading empty.
 *
 * NOT A SECOND STORE, for the same reason its sibling is not: `factionIds` and
 * the actor roles are already on the row, written by the sending's own news, and
 * this reads them. Nothing is kept, so nothing can disagree with the ledger.
 */
export function whatAHousesOwnErrandsBringBack(
    facts: readonly Pick<HistoricalFact, 'locationId' | 'actors' | 'factionIds'>[]
): (factionId: string, locationId: string) => KnowingStage {
    const sited = new Map<string, Pick<HistoricalFact, 'actors' | 'factionIds'>[]>();
    for (const fact of facts) {
        if (fact.locationId === null || fact.factionIds.length === 0) continue;
        const here = sited.get(fact.locationId);
        if (here) here.push(fact); else sited.set(fact.locationId, [fact]);
    }
    // Worked out per place, the first time the place is asked about, for the
    // reason {@link whatStandingOnItGives} carries: the ledger is sited all
    // over the world and a caller asks about a handful of pieces of ground.
    const reported = new Map<string, Set<string>>();
    const housesTold = (locationId: string): Set<string> => {
        let told = reported.get(locationId);
        if (told) return told;
        told = new Set<string>();
        for (const fact of sited.get(locationId) ?? []) {
            // Somebody came back. A party that did not is on the same row with
            // every actor marked lost, and a house that lost everybody it sent
            // was told nothing - which is the whole of why the outcome is on
            // the roles.
            if (!fact.actors.some(a => a.role === WENT_AND_CAME_BACK)) continue;
            for (const houseId of fact.factionIds) told.add(houseId);
        }
        reported.set(locationId, told);
        return told;
    };
    const beingTold = stageCeilingFor('told');
    return (factionId, locationId) =>
        housesTold(locationId).has(factionId) ? beingTold : 'unaware';
}

/**
 * What the air where somebody is standing carries about a piece of ground.
 *
 * THE THIRD WAY A NAME REACHES A ROLL, and the only one that reaches a house
 * none of whose people has ever been anywhere near the place. Measured on three
 * seeded worlds at two hundred years, with only the other two: 35, 32 and 42
 * houses had open ground in their own province and 24, 20 and 22 of them could
 * point at any of it. The rest were houses in a province where a door had
 * opened, that the whole province was talking about, and that they were
 * structurally unaware of because nobody on their roll had happened to die
 * there.
 *
 * CIRCULATION IS DERIVED AND STAYS DERIVED. There is no row per person per
 * rumour here and there must never be: at two hundred years that table is
 * roughly 2,000 sited facts against 440 living people, which is the
 * combinatorial store the working agreement forbids, growing with the square of
 * a world's age. This asks the circulation module its own question - `is this
 * fact being said out loud where this person stands` - about the handful of
 * facts sited on the ground actually being considered, and keeps nothing.
 *
 * The rung is `stageCeilingFor('told')`, which is `placed`, which is exactly
 * `REACHABLE_FROM`: hearing the province talk about a barrow tells you the
 * barrow is there and roughly where, and gives you nothing else. Somebody who
 * has actually stood on it is answered by {@link whatStandingOnItGives} at a
 * higher rung, and nothing here can lower that.
 */
export function whatTheAirCarriesOfTheGround(input: {
    /** Every fact the ledger holds. Indexed here by where it happened. */
    facts: readonly HistoricalFact[];
    /**
     * Whether this fact is being said out loud where this person stands.
     * `isInTheAirFor` in `what-people-are-saying.ts`, bound to the world and
     * the day. Passed in rather than imported so this module stays a reading
     * over facts and does not acquire a `WorldState`.
     */
    inTheAirFor: (fact: HistoricalFact, holderId: string) => boolean;
}): (holderId: string, locationId: string) => KnowingStage {
    const here = new Map<string, HistoricalFact[]>();
    for (const fact of input.facts) {
        if (fact.locationId === null) continue;
        const bucket = here.get(fact.locationId);
        if (bucket) bucket.push(fact); else here.set(fact.locationId, [fact]);
    }
    const beingTold = stageCeilingFor('told');
    return (holderId, locationId) => {
        const said = here.get(locationId);
        if (!said) return 'unaware';
        return said.some(fact => input.inTheAirFor(fact, holderId)) ? beingTold : 'unaware';
    };
}

/**
 * Open ground near this house that its deciders could point at.
 *
 * A RUIN IS PUBLIC BY AGREEMENT, which is why nothing here reads
 * `controllingFactionId`. The reading this replaces asked whether a house
 * CONTROLLED an unsealed ruin - a correct reading of control and the wrong
 * question. Monopolising open ground is a political act that costs a house
 * every neighbour it shut out, not the ordinary state of one, and nothing in
 * the world performs it: measured on twelve seeded worlds, 144 ruins at day 0
 * and 379 at two hundred years, 12 and 282 of them unsealed, and NOT ONE at
 * either horizon carrying that column. So the errand was content nothing could
 * reach. `OPEN-QUESTIONS.md` carries what the column should mean instead.
 *
 * What a house has over its neighbours is INFORMATION, and two things decide
 * whether it is enough to walk anybody out on:
 *
 *   where it is       ground in the province the house is seated in.
 *                     {@link forbiddenGroundInTheProvinceOf} is the same
 *                     scoping for the same reason, composed rather than
 *                     restated as a distance rule of its own.
 *   who knows it      `REACHABLE_FROM`, which is `placed` - you know where it
 *                     is and can set out for it. Named rather than numbered, so
 *                     the rung moves when the ladder does.
 *
 * WHOSE KNOWING COUNTS: the deciders'. `whatThisHouseKnowsOf` draws the line
 * this needs - a house whose gate porter has heard something has heard it, and
 * a house whose elders have can act on it - and putting a party on the road is
 * acting. `anybody` would have opened the errand to 198 of 422 houses at two
 * hundred years against 151, and would have had a porter deciding. Both halves
 * come back on the result.
 *
 * AND THE TWO WAYS A NAME REACHES THE ROLL ARE BOTH ASKED.
 * {@link whatStandingOnItGives} is the person who was there;
 * {@link whatAHousesOwnErrandsBringBack} is the party that came back and said
 * so, which is the only one of the two that reaches somebody who stayed at
 * home. Composed with `highestStage` rather than chosen between, because
 * nothing on this ladder falls.
 *
 * ONE READING, asked by the world's own sendings and by the board a player
 * reads, so the two cannot disagree about what this house has.
 *
 * The strongest find first; ties break on the world's own order.
 */
export function aFindThisHouseCouldSendFor(input: {
    /** The world's open ground, gathered once. {@link whereTheOpenGroundIs}. */
    ground: WhereTheOpenGroundIs;
    /** Whose knowing is being asked about. The key the errand reading takes. */
    houseId: string;
    /** The house's seat. Ground in its province is its business. */
    seatLocationId: string | null;
    roll: readonly OnTheRoll[];
    /** The house's own ladder length. `whoDecidesIn` takes it too. */
    rankCount: number;
    /** Where one person stands on one piece of ground. {@link whatStandingOnItGives}. */
    stageFor: (holderId: string, locationId: string) => KnowingStage;
    /** Where this house's parties have been. {@link whatAHousesOwnErrandsBringBack}. */
    errands: (factionId: string, locationId: string) => KnowingStage;
}): AFindThisHouseHas | null {
    const province = input.ground.provinceOf(input.seatLocationId);
    if (province === null) return null;

    let best: AFindThisHouseHas | null = null;
    for (const ground of input.ground.openGroundIn(province)) {
        // Said in the hall, so it reached everybody on the roll alike. Read
        // once per piece of ground rather than once per name.
        const reported = input.errands(input.houseId, ground.id);
        const knows = whatThisHouseKnowsOf({
            roll: input.roll,
            rankCount: input.rankCount,
            stageFor: holderId => highestStage(input.stageFor(holderId, ground.id), reported)
        });
        if (!canPointAt(knows.deciders)) continue;
        if (best !== null && stageRank(knows.deciders) <= stageRank(best.knows.deciders)) continue;
        best = { locationId: ground.id, name: ground.name, knows };
    }
    return best;
}

/**
 * The reasons this house actually has right now.
 */
export function reasonsOpenTo(house: HouseAsItStands): readonly SendingReason[] {
    return SENDING_REASONS.filter(r => NEED_PREDICATES[r.needs](house));
}

// ─────────────────────────────────────────────────────────────────────────
// THE POSTING
// ─────────────────────────────────────────────────────────────────────────

/**
 * The two bands at which nobody is expected to come back.
 */
export const IMPOSSIBLE_TIERS: readonly RegardBand[] = ['overmatched', 'unreachable'];

export function isImpossibleTier(band: RegardBand): boolean {
    return IMPOSSIBLE_TIERS.includes(band);
}

export interface Posting {
    reason: SendingReason;
    houseId: string;
    houseName: string;
    /** The rung the posting is pitched at. */
    pitchOrdinal: number;
    /**
     * Days the party is gone if it goes as stated.
     */
    days: number;
    /**
     * What they went on, or null where they walked.
     *
     * Carried rather than re-derived so a caller can say what a shorter term
     * was bought with. Nothing in this module branches on it.
     */
    conveyanceId: string | null;
    /** The reason's term before the conveyance was applied. */
    walkingDays: number;
    /**
     * How many the house means to put on it.
     *
     * THE WORK STATES A FLOOR AND THE CONVEYANCE STATES THE REST.
     * `reason.hands` is what the errand needs - three walk a leak down, forty
     * fight a war - and it used to be the whole answer, so a house that owned a
     * thing holding thirty sent five and twenty-five seats went out empty.
     *
     * A house sends once in five years (`SENDINGS_PER_HOUSE_YEAR`, unchanged),
     * so one party is meant to be substantial - and what makes it substantial is
     * what is carrying it, which is also what the treasury decides. The size of
     * the party and the cost of the journey therefore come off one column rather
     * than off a multiplier picked to make the figure look right. Walking is
     * heads 1 and changes nothing.
     *
     * AND THE CHEST IS THE OTHER BOUND: a house with a hull and a thin purse
     * sails with twelve rather than thirty. {@link howManyTheChestWillCarry}.
     */
    hands: number;
    /** Above this nobody is sent. Null where the errand has no ceiling. */
    ceilingOrdinal: number | null;
    atStake: AtStake;
    /** The place, when the caller knows one. Carried for the sighting. */
    locationId: string | null;
    /**
     * Spirit stones this journey burns, out of whoever's chest is paying.
     *
     * Zero for everything that stands on ground, which is every carriage and
     * every mount in the world - `whatTheChestBurns` is the one reading and it
     * is asked here rather than in each caller, so the figure a house is
     * charged and the figure a board quotes cannot disagree.
     *
     * REPORTED, NOT CHARGED. Nothing in this module holds a purse.
     */
    stonesBurned: number;
}

/**
 * Trips this craft needs to move this many people.
 */
function tripsFor(heads: number, conveyance: Conveyance): number {
    return Math.ceil(Math.max(1, heads) / Math.max(1, Math.floor(conveyance.heads)));
}

/**
 * How many of a party a chest will actually pay to carry.
 *
 * Between the floor the work asks for and the ceiling the craft holds, the
 * largest number this purse covers. A purse of null is a caller with no chest
 * in hand and prices nothing out, which is the same convention
 * `bestForThisRoad` keeps for the same reason.
 *
 * Asked one head at a time rather than solved. The burn is
 * `whatTheChestBurns`'s answer and a closed form here would be a second
 * spelling of it, which is the copy that disagrees the first time either moves.
 * The loop is at most the capacity of the largest craft in the world.
 */
export function howManyTheChestWillCarry(input: {
    conveyance: Conveyance;
    daysOneWay: number;
    floor: number;
    ceiling: number;
    purse: number | null;
}): number {
    const floor = Math.max(1, Math.floor(input.floor));
    const ceiling = Math.max(floor, Math.floor(input.ceiling));
    if (input.purse === null) return ceiling;
    for (let heads = ceiling; heads > floor; heads--) {
        const burn = whatTheChestBurns({
            conveyance: input.conveyance,
            daysOneWay: input.daysOneWay,
            heads,
            trips: tripsFor(heads, input.conveyance)
        });
        if (burn <= input.purse) return heads;
    }
    return floor;
}

/**
 * A posting off a reason and a rung.
 */
export function postingFor(input: {
    reason: SendingReason;
    /**
     * Only the two columns a posting carries. Narrowed from the whole house
     * because it was always only these: a caller with a house that is not
     * standing in front of a board - a door that just opened, say - should not
     * have to invent a standing table and a find to write one down.
     */
    house: Pick<HouseAsItStands, 'id' | 'name'>;
    pitchOrdinal: number;
    locationId?: string | null;
    /** What they went on. Null or absent is walking, which changes nothing. */
    conveyance?: Conveyance | null;
    /** The craft's rung, for a tracked one. Ignored below heaven grade. */
    conveyancePower?: number | null;
    /**
     * What the chest holds, where the caller holds one. Bounds the party on
     * anything that burns stones; omitted prices nothing out.
     */
    purse?: number | null;
    /**
     * How many go, where that was settled by something other than the work.
     *
     * A place at a counted door is dealt by the holder and then dealt again by
     * the house's own conclave, so the number going is the door's and neither
     * the errand's nor the craft's. Given, the craft does not grow it and the
     * chest does not shrink it - what it does change is what the journey burns,
     * which is priced on the party that is actually going.
     */
    hands?: number | null;
    /**
     * How many the house actually has for this errand.
     *
     * `whoTheHouseCanSend` is the reading - `hands: Number.MAX_SAFE_INTEGER`
     * against the roster gives it without a second copy of the eligibility
     * filter. Passed so that `stonesBurned` is priced on the party that goes
     * rather than on the seats: a house with a hull and eight people pays to
     * move eight, and a posting that charged for thirty would be charging for
     * twenty-two empty benches.
     */
    available?: number | null;
}): Posting {
    const walkingDays = input.reason.days;
    const conveyance = input.conveyance ?? null;
    const power = input.conveyancePower ?? null;
    const days = conveyance
        ? daysByConveyance(walkingDays, conveyance, power)
        : walkingDays;
    // See `Posting.hands`. The work's floor, filled out to what is carrying it,
    // and back down to what the chest will pay to carry.
    const settled = input.hands ?? null;
    const wanted = settled !== null
        ? Math.max(1, Math.floor(settled))
        : conveyance === null
        ? input.reason.hands
        : howManyTheChestWillCarry({
            conveyance,
            daysOneWay: days,
            floor: input.reason.hands,
            ceiling: Math.max(input.reason.hands, conveyance.heads),
            purse: input.purse ?? null
        });
    // AND NEVER MORE THAN THE HOUSE HAS. A posting for more people than exist
    // on the roll prices a journey for benches nobody sits on - see
    // `available`. A caller with no roster in hand is not capped, which is the
    // honest answer for one writing a posting before it knows who is going.
    const hands = input.available === null || input.available === undefined
        ? wanted
        : Math.max(1, Math.min(wanted, Math.floor(input.available)));
    return {
        reason: input.reason,
        houseId: input.house.id,
        houseName: input.house.name,
        pitchOrdinal: clampOrdinal(input.pitchOrdinal),
        days,
        walkingDays,
        conveyanceId: conveyance?.id ?? null,
        hands,
        ceilingOrdinal: input.reason.ceilingOrdinal,
        atStake: input.reason.atStake,
        locationId: input.locationId ?? null,
        stonesBurned: conveyance === null ? 0 : whatTheChestBurns({
            conveyance,
            daysOneWay: days,
            heads: hands,
            trips: tripsFor(hands, conveyance)
        })
    };
}

export interface Candidate {
    id: string;
    name: string;
    ordinal: number;
}

// ─────────────────────────────────────────────────────────────────────────
// AND THE FOURTH BOUND, WHICH IS WHAT THE HOUSE CAN SPARE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Somebody on a roll, with the two facts that decide whether they can go.
 *
 * Both are read off the world's own rows by the caller and neither is stored
 * here: where they are standing is `NpcRecord.locationId`, and what they are
 * already committed to is the term on `NpcRecord.activity`.
 */
export interface OnTheRollForAnErrand extends Candidate {
    /** Where they stand on their own house's ladder. */
    rankIndex: number;
    /** Where they are standing now. */
    locationId: string | null;
    /**
     * The day a commitment already made runs out, or null for somebody free.
     *
     * The caller decides which activities take somebody away - the yearly pass
     * has one predicate for it, and an errand and a station are both "gone,
     * until" - so nothing here is a second opinion about what being spent is.
     */
    committedUntilDay: number | null;
}

export interface WhatTheHouseCanSpare {
    /** The roster an errand may actually be drawn out of. */
    free: readonly Candidate[];
    /**
     * Who is held at the gate, where anybody could be. Null where nobody who
     * could host was standing there to begin with, which is a fact about the
     * house rather than a decision taken here.
     */
    keptAtTheGate: Candidate | null;
    /** How many of the roll were already out on something when this was asked. */
    alreadySpent: number;
}

/**
 * Who a house can actually spare, which is the bound nothing was applying.
 *
 * ── THE DEFECT, MEASURED ─────────────────────────────────────────────────
 *
 * A party's size was bounded by the errand's `hands`, the conveyance's `heads`
 * and the purse, and by nothing about the house. So a house put every living
 * name on its roll on one road at once, and the world's own chronicle said so:
 * *"Azure Cloud Pavilion sent 9 on looking for disciples, a fair going at
 * ordinal 38. The term is 22 days and they are not back."* That house had
 * eleven modelled people and the other two had died of old age.
 *
 * Measured on three seeded worlds after one advanced year, seated houses with
 * every living member standing in one place that is not their own seat: 3 of
 * 38, 4 of 37, 1 of 38. And with nobody at all at the seat: 4, 5 and 1, every
 * one of them a house with somebody out with a party.
 *
 * AND NOBODY CHECKED WHETHER SOMEBODY WAS ALREADY OUT. A roster was built off
 * `status` and `factionId` alone, so a name still on the road when the year
 * turned was posted to a second errand and the first party's rows went on
 * naming them.
 *
 * ── WHAT A HOUSE HAS TO KEEP, AND WHERE THAT CAME FROM ───────────────────
 *
 * Not a number. Three readers in three unrelated subsystems already fail when a
 * house's seat is empty, and between them they say what has to stay:
 *
 *   the gate      `standingAtTheGateOf` filters whoever is at hand through
 *                 `couldHostAGuest`, and with nobody left tells a visitor
 *                 *"Nobody of the house is out here to ask."* An empty house
 *                 has stopped being reachable by a sentence.
 *   the yard      `runChallenge` builds the people in a host's courtyard from
 *                 whoever is alive AT THE SEAT, and `whoCouldHaveStoppedIt`
 *                 reads it. A host house that is away does not get a hand in,
 *                 and a bout kills somebody it would have stopped.
 *   the ground    the kill read sets a house's stage to `placed` when any of
 *                 its people are standing there and `named` when none are, so
 *                 a house with nobody home cannot put a name to a killing on
 *                 its own ground and opens no account for it.
 *
 * The gate's is the strongest of the three and satisfies all of them: SOMEBODY
 * WHO COULD HOST A GUEST IS STANDING AT THE SEAT. `couldHostAGuest` is that
 * reading and this does not restate it, so the rung moves when the ladder does.
 *
 * ONE, BECAUSE THE RULE IS "NOT THE LAST ONE" RATHER THAN A QUOTA. The gate
 * asks whether the set is empty and nothing asks how big it is, so what the
 * errand may not do is empty it. A house with four elders at home sends three
 * and a house with one sends none of them.
 *
 * AND IT IS THE CHEAPEST ONE WHO STAYS. `whoTheHouseCanSend` takes the
 * strongest first, so holding back the weakest host costs the party the head it
 * would have taken last, and costs it nothing at all wherever the party was not
 * going to take everybody anyway.
 *
 * WHAT THIS CANNOT REACH, stated rather than left to be discovered: a house
 * with nobody at its seat before the errand keeps nobody, and the answer comes
 * back with `keptAtTheGate: null`. Measured on one seeded world, members
 * standing at their own seat: 207 of 306 at world open, 64 of 321 at
 * twenty-five years, 42 of 363 at a hundred - the rest in settlements on town
 * postings that are never recalled. So the gate figure this closes completely
 * after one year is only a fifth of it a century in. That is a different
 * defect in a different pass and saying so is the whole of what this does
 * about it.
 */
export function whatTheHouseCanSpare(input: {
    roster: readonly OnTheRollForAnErrand[];
    /** The house's own ladder length, which is what makes a rung an elder. */
    rankCount: number;
    /** The house's seat. Null for a house with no hall, which keeps nobody. */
    seatLocationId: string | null;
    /** The day being asked about, against the terms already running. */
    onDay: number;
}): WhatTheHouseCanSpare {
    const free = input.roster.filter(
        p => p.committedUntilDay === null || p.committedUntilDay <= input.onDay);
    const alreadySpent = input.roster.length - free.length;

    const atTheGate = input.seatLocationId === null ? [] : free.filter(
        p => p.locationId === input.seatLocationId
            && couldHostAGuest(p.rankIndex, input.rankCount));
    const kept = atTheGate.reduce<OnTheRollForAnErrand | null>(
        (held, p) => held === null
            || p.ordinal < held.ordinal
            || (p.ordinal === held.ordinal && p.id < held.id)
            ? p
            : held,
        null
    );

    return {
        free: kept === null ? free : free.filter(p => p.id !== kept.id),
        keptAtTheGate: kept === null
            ? null
            : { id: kept.id, name: kept.name, ordinal: kept.ordinal },
        alreadySpent
    };
}

/**
 * Who the house may put on this, strongest first.
 */
export function whoTheHouseCanSend(
    // Only the two columns it reads, so the escort pass can ask the same
    // question off a board row without building a whole Posting to do it.
    posting: Pick<Posting, 'ceilingOrdinal' | 'hands'>,
    roster: readonly Candidate[]
): readonly Candidate[] {
    const ceiling = posting.ceilingOrdinal;
    const eligible = ceiling === null
        ? [...roster]
        : roster.filter(c => c.ordinal <= ceiling);
    eligible.sort((a, b) => b.ordinal - a.ordinal || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return eligible.slice(0, posting.hands);
}

// ─────────────────────────────────────────────────────────────────────────
// THE TIER, AND WHAT IT COSTS
// ─────────────────────────────────────────────────────────────────────────

/**
 * The rung the party is judged at.
 */
export function partyOrdinal(party: readonly Candidate[]): number {
    let best = 0;
    for (const member of party) best = Math.max(best, clampOrdinal(member.ordinal));
    return best;
}

/** The tier, which is the regard band and nothing else. */
export function tierFor(posting: Posting, party: readonly Candidate[]): Regard {
    return regardFor(posting.pitchOrdinal, partyOrdinal(party));
}

/**
 * A board's own word for a tier.
 */
export function tierNameFor(band: RegardBand): string {
    return TIER_NAMES[band];
}

/**
 * The share of attempts at this band that do not finish.
 */
export function notFinishedChance(regard: Regard): number {
    const damage = regard.damageMultiplier;
    if (!Number.isFinite(damage) || damage <= 1) return 0;
    return Math.max(0, Math.min(1, 1 - 1 / damage));
}

/**
 * The share of an unfinished party that does not come back.
 */
export function lostChance(regard: Regard): number {
    const notFinished = notFinishedChance(regard);
    return notFinished * notFinished;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT COMES BACK
// ─────────────────────────────────────────────────────────────────────────

export type SendingOutcome =
    /** They did the thing. */
    | 'finished'
    /** They did not, and somebody came back to say what they saw. */
    | 'came_back_short'
    /** They did not, and nobody came back. */
    | 'did_not_come_back';

/**
 * What a party saw and could not take.
 */
export interface Sighted {
    locationId: string | null;
    /** Absolute day the ground next stands open, or null when it never shuts. */
    opensAgainOnDay: number | null;
    /** Who got close enough to see it. Empty when nobody came back. */
    seenBy: readonly Candidate[];
}

export interface Sending {
    posting: Posting;
    party: readonly Candidate[];
    tier: Regard;
    outcome: SendingOutcome;
    /** Present on `came_back_short`. The whole point of that outcome. */
    sighted: Sighted | null;
    /** Who did not come back. Empty on `finished`. */
    lost: readonly Candidate[];
    /** The day the party is due back, whatever happened. */
    returnsOnDay: number;
}

/** When an errand happened, against the span the pass reports on. */
export interface WhenTheErrandHappened {
    departsOnDay: number;
    returnsOnDay: number;
    /** True when the term runs past the last day the world has reached. */
    stillOut: boolean;
}

/**
 * When the errand happened, which is not the instant the pass ran.
 *
 * ── THE DEFECT, MEASURED ─────────────────────────────────────────────────
 *
 * The yearly pass dated every sending's news at `departsOnDay + term` with
 * `departsOnDay` set to the day the pass ran, so the news of a return was
 * written before the return. `applyPressure` derived its year index as
 * `yearOfDay(fromDay) + 1`, one year AHEAD of the span it was handed, so the
 * sending line's nominal day - `year*365+175` - was ALWAYS past the end of a
 * one-year span and `withinSpan` always clamped it to the last day of it. Every
 * party in the world therefore left on the final day of the span and came back
 * after it. On one seed the tail of that shows up as one to two facts dated up
 * to 150 days past the world's own clock at every horizon tried - 100, 200, 300
 * and 497 through 502 years - which is what `driver.test.ts > nothing is
 * incoherent` refuses, correctly.
 *
 * That year index has since been corrected to the years the span actually
 * covers, so the nominal day is inside the span and nothing is clamped. This
 * function stays, because it is the honest record independently of the bug that
 * exposed it, and because the clamp is still reachable on a span that does not
 * run to a whole year.
 *
 * ── AND THE RECORD THAT IS HONEST ────────────────────────────────────────
 *
 * A yearly pass reports on a year. Every other line in it is dated inside the
 * span by construction; this one projected forward. So an errand whose term
 * fits inside the span is an errand that HAPPENED inside it: the party left
 * `term` days before the day being reported on and is back on it. Nothing is
 * clamped - the return is the day it is reported, and the departure moves to
 * where it must have been for that to be true.
 *
 * An errand whose term does NOT fit is a party that is still out, and that is a
 * different fact rather than a worse date. {@link newsOfAPartyStillOut} is what
 * the world says about one, and nothing about the errand is resolved: no
 * outcome, nobody lost, nothing taken off the house, because none of it has
 * happened yet. `bringHomeWhoeverIsDue` ends the term off the party's own
 * activity when the day comes.
 *
 * WHAT THE WORLD STILL HAS NO ANSWER FOR: the outcome of an errand longer than
 * one span is never written at all. On the yearly slices `advanceWorldForPlay`
 * runs, that is the war errand alone - 720 days against a 365-day span, one row
 * of fifteen at weight 4 - and its party comes home with nothing said. Carrying
 * a resolved-but-unreported sending between passes needs a store this layer
 * does not have, and inventing one was not worth what it buys.
 */
export function whenTheErrandHappened(input: {
    /**
     * The earliest day the party could have left. A year start, or a door.
     *
     * Never the calling span's start: the pass reports a year at a time, and a
     * bound read off the caller's chunking makes the errand's dates depend on
     * how many years somebody asked for in one call.
     */
    notBefore: number;
    /** The day the pass is reporting on. */
    reportedOn: number;
    /** The last day the world will have reached when the pass is over. */
    spanEndsOn: number;
    /** The errand's term, in days. */
    term: number;
}): WhenTheErrandHappened {
    const departsOnDay = Math.max(input.notBefore, input.reportedOn - input.term);
    const returnsOnDay = departsOnDay + input.term;
    return { departsOnDay, returnsOnDay, stillOut: returnsOnDay > input.spanEndsOn };
}

/**
 * Resolve one sending.
 */
export function resolveSending(input: {
    posting: Posting;
    party: readonly Candidate[];
    departsOnDay: number;
    rng: CultivationRNG;
    /** The ground, when the caller has the record. For the sighting's date. */
    location?: LocationRecord | null;
}): Sending {
    const { posting, party, departsOnDay, rng } = input;
    const tier = tierFor(posting, party);
    const returnsOnDay = departsOnDay + posting.days;

    if (!rng.chance(notFinishedChance(tier))) {
        return { posting, party, tier, outcome: 'finished', sighted: null, lost: [], returnsOnDay };
    }

    // Nobody went, so nobody came back. Not a special case: an empty party
    // cannot produce a witness and the arithmetic below would say so anyway.
    const anybodyBack = party.length > 0 && rng.chance(1 - Math.pow(0.5, party.length));
    if (!anybodyBack) {
        return {
            posting, party, tier, outcome: 'did_not_come_back',
            sighted: null, lost: party, returnsOnDay
        };
    }

    // Somebody is back. Who is lost is the same draw read differently: the
    // deeper the gap, the more of the party stays out there.
    const lostCount = Math.min(
        Math.max(0, party.length - 1),
        Math.round(party.length * lostChance(tier))
    );
    const lost = party.slice(party.length - lostCount);
    const returned = party.slice(0, party.length - lostCount);

    return {
        posting, party, tier, outcome: 'came_back_short',
        sighted: {
            locationId: posting.locationId,
            opensAgainOnDay: input.location
                ? nextOpeningDay(input.location, returnsOnDay)
                : null,
            seenBy: returned
        },
        lost,
        returnsOnDay
    };
}

// ─────────────────────────────────────────────────────────────────────────
// AND THEN PEOPLE TALK ABOUT IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * How heavy the fact is.
 */
export function magnitudeOf(sending: Sending): number {
    const difficulty = notFinishedChance(sending.tier);
    const base = 0.2 + difficulty * 0.8;
    // What almost happened is talked about, and less than what did.
    const carried = sending.outcome === 'finished' ? 1 : 0.6;
    return Math.max(0, Math.min(1, base * carried));
}

/**
 * The ledger row for a sending, ready for `appendWorldFact`.
 */
export function newsOfASending(sending: Sending, opts: {
    /** Absolute day the news is dated. Usually the party's return. */
    onDay?: number;
} = {}): PendingFact {
    const { posting, tier, outcome } = sending;
    const day = opts.onDay ?? sending.returnsOnDay;
    const impossible = isImpossibleTier(tier.band);

    // The board's own word for the tier, then the rung, then what happened.
    // Factual throughout: every clause is something the engine decided.
    const called = tierNameFor(tier.band).toLowerCase();
    const sent = `${posting.houseName} sent ${sending.party.length} on `
        + `${posting.reason.name.toLowerCase()}, `
        // "a open posting" was printing for two of the six band names, which is
        // the sort of thing a chronicle read in two centuries should not have
        // in it. The article is derived rather than authored, because the names
        // are catalog content and the next one added must not need this line
        // edited.
        + `${/^[aeiou]/.test(called) ? 'an' : 'a'} ${called} `
        + `at ordinal ${posting.pitchOrdinal}`;

    const what = outcome === 'finished'
        ? `${sent}, and it was done.`
        : outcome === 'came_back_short'
            ? `${sent}. ${sending.sighted!.seenBy.length} came back and `
                + `${sending.lost.length} did not. It was not finished.`
            : `${sent}. None of them came back.`;

    return makeFact({
        day,
        kind: posting.reason.factKind,
        scale: posting.reason.scale,
        summary: what,
        locationId: posting.locationId,
        factionIds: [posting.houseId],
        actors: sending.party.map(member => ({
            id: member.id,
            name: member.name,
            role: sending.lost.some(l => l.id === member.id)
                ? WENT_AND_DID_NOT
                : WENT_AND_CAME_BACK
        })),
        // A house's ordinary errands are its own business. Something nobody
        // was expected to survive is not, whichever way it went.
        visibility: impossible ? 'public' : 'regional',
        magnitude: magnitudeOf(sending),
        nearMiss: outcome === 'came_back_short',
        nearMissNote: outcome === 'came_back_short'
            ? `Reached it and did not take it. ${sending.sighted!.seenBy.length} saw it.`
            : ''
    });
}

/**
 * The ledger row for a party that went out and is not back.
 *
 * Filed under the errand's own word, because a departure and its return are one
 * errand and the digest and the rumour layer read that word and nothing else.
 * `truth: 'unresolved'` is the whole of the difference: the world is saying
 * where its people went and declining to say what became of them, which is the
 * only honest thing it can say about a party still on the road.
 *
 * The actors carry {@link WENT_AND_IS_NOT_BACK}, so
 * {@link whatAHousesOwnErrandsBringBack} reads nothing off this row. A house
 * learns where ground is from a party that came back and reported; nobody has.
 */
export function newsOfAPartyStillOut(input: {
    posting: Posting;
    party: readonly Candidate[];
    departsOnDay: number;
    /** The day the term is up. Stated, because it is a term and not a guess. */
    dueOnDay: number;
}): PendingFact {
    const { posting, party } = input;
    // The board's own word for the tier, which is a property of the posting and
    // the party rather than of an outcome, so it is as true of a party still on
    // the road as of one that came back.
    const called = tierNameFor(tierFor(posting, party).band).toLowerCase();
    return makeFact({
        day: input.departsOnDay,
        kind: posting.reason.factKind,
        scale: posting.reason.scale,
        summary: `${posting.houseName} sent ${party.length} on `
            + `${posting.reason.name.toLowerCase()}, `
            + `${/^[aeiou]/.test(called) ? 'an' : 'a'} ${called} `
            + `at ordinal ${posting.pitchOrdinal}. `
            + `The term is ${posting.days} days and they are not back.`,
        locationId: posting.locationId,
        factionIds: [posting.houseId],
        actors: party.map(member => ({
            id: member.id,
            name: member.name,
            role: WENT_AND_IS_NOT_BACK
        })),
        visibility: 'regional',
        truth: 'unresolved',
        magnitude: 0.2,
        data: { dueOnDay: input.dueOnDay, atStake: posting.atStake }
    });
}

// ─────────────────────────────────────────────────────────────────────────
// AND WHAT A FAILURE TAKES OFF THE HOUSE THAT SENT THEM
// ─────────────────────────────────────────────────────────────────────────

/**
 * Which of a house's own columns a stake is stated in.
 *
 * A COLUMN RATHER THAN A CASE, for the reason the reason table gives: a stake
 * added to `AtStakeSchema` does not compile until it has said where a loss of
 * it lands. What differs between stakes is where the loss goes, never whether a
 * failure costs anything.
 */
export type WhereAStakeLands =
    /** The people, and nothing else. Taken before anything here runs. */
    | 'the_party'
    /** What the house put on the road and does not get back. */
    | 'the_purse'
    /** What the house the errand was about thinks of it now. */
    | 'a_neighbours_regard'
    /** Ground the house holds, and was sent to hold. */
    | 'the_ground'
    /** The terms between this house and the body below it. */
    | 'an_instrument';

export const WHERE_A_STAKE_LANDS: Record<AtStake, WhereAStakeLands> = {
    nothing_but_the_party: 'the_party',
    stones: 'the_purse',
    standing_with_a_house: 'a_neighbours_regard',
    the_ground_itself: 'the_ground',
    the_grant: 'an_instrument'
};

/**
 * What a failure with everybody back still costs, as a share of a total loss.
 *
 * NOT ZERO, and that is the whole of what the three outcomes buy. A party that
 * comes back short did not do the thing: the material was not fetched, the
 * leak was not walked down, the hall was arrived at and embarrassed. A party
 * that does not come back at all pays the full share. Between the two the cost
 * is the share of the party that stayed out there, so `did_not_come_back` is
 * exactly 1 and every degree of coming back short sits under it.
 *
 * A quarter because `lostChance` puts most short returns at one or two of five,
 * and a failure that cost less than the people it cost would be saying the
 * errand was worth less than the bodies.
 */
export const A_FAILURE_WITH_EVERYBODY_BACK = 0.25;

/**
 * How badly it went, 0..1. Zero on an errand that finished.
 */
export function howBadlyItWent(sending: Sending): number {
    if (sending.outcome === 'finished') return 0;
    if (sending.party.length === 0) return 1;
    return Math.max(
        A_FAILURE_WITH_EVERYBODY_BACK,
        sending.lost.length / sending.party.length
    );
}

/**
 * The most of a purse one errand can take.
 *
 * THE ANTI-SPIRAL, and it is the only reason this constant exists. A house that
 * fails once and can then do nothing ever again is a worse world than one where
 * nothing was ever at risk: the failure has to be felt and survived. A quarter
 * leaves a house that has just lost its best party able to pay its people and
 * mount another errand, and four consecutive total failures still do not empty
 * a vault.
 */
export const A_SINGLE_ERRAND_CANNOT_TAKE_MORE_THAN = 0.25;

/**
 * What a botched errand costs in the standing table's own units.
 *
 * Under the 0.3 the world already charges for walking onto somebody's ground
 * and under `RIVAL_STANDING`, deliberately: arriving badly at a house that
 * agreed to receive you is not the same as taking its vein, and one failure may
 * not by itself make a rival of somebody who was sitting down with you.
 */
export const WHAT_A_FAILURE_COSTS_IN_REGARD = 0.2;

/**
 * What a grant not collected on loses off its own terms.
 *
 * A quarter of the yearly figure, for the reason the row states: it is
 * renegotiated, not torn up. A body below that was not collected from this year
 * pays less next year, and says so.
 */
export const WHAT_A_LAPSE_TAKES_OFF_THE_TERMS = 0.25;

/**
 * What one failed sending takes, in the columns the world already reads.
 *
 * Deltas out, no mutation, no world: the caller applies them. Every field is
 * empty or zero except the one the stake lands in, and {@link nothingToTake}
 * says the stake named something the world holds nothing of for this house.
 */
export interface WhatAFailureTakes {
    landsOn: WhereAStakeLands;
    /** 0 on an errand that finished. */
    howBadly: number;
    /** Stones off the house's own purse. */
    stones: number;
    /** Houses whose regard for this one falls. */
    regardFalls: readonly string[];
    /** How far, in the standing table's own units. */
    regardBy: number;
    /** Ground the house stops holding. */
    groundGivenUp: readonly string[];
    /** Bodies below whose terms toward this house are renegotiated. */
    instrumentsLapsed: readonly string[];
    /** The share of the stated yearly figure that lapses. */
    instrumentLapsedBy: number;
    /**
     * True where the stake is stated in a form the world holds nothing of for
     * this house.
     *
     * NOT TRANSLATED INTO A GENERIC LOSS. A reason that declares the ground
     * itself and sends a party onto ground the house does not hold has
     * declared something nothing can take, and the honest thing is to say so
     * and count it rather than to charge the purse instead.
     */
    nothingToTake: boolean;
}

/**
 * What a failed sending takes off the house that opened it.
 *
 * ── THE DECLARATIONS WERE THERE AND NOTHING READ THEM ────────────────────
 *
 * Every reason in `why-a-house-puts-a-party-on-the-road.ts` states what the
 * house loses if the party does not come back, and until this existed the only
 * readers were two board modules using it to LABEL a posting. A house sent
 * people after a thing, they died, and the house was exactly as it had been -
 * so a sending had an upside and no downside, which is not a gamble.
 *
 * ── AND THE STAKE IS READ, NEVER SUBSTITUTED ─────────────────────────────
 *
 * The stake decides which column the loss lands in;
 * {@link howBadlyItWent} decides how much. Nothing branches on which REASON it
 * was, which is the same ruling the reason table keeps: what a house is strong
 * enough for, how long it is gone and whether anybody comes back never consult
 * the reason either.
 */
export function whatAFailedSendingTakes(input: {
    sending: Sending;
    /** Ground this house holds today, by location id. */
    holds: readonly string[];
    /** What is in its purse today. */
    purse: number;
    /** Names on its roll. What went out is measured against it. */
    onTheRoll: number;
    /**
     * The houses this errand was actually with.
     *
     * `whichHousesAReasonIsAbout` narrowed to whoever was at the far end of
     * this particular errand. Empty for every errand that is about nobody, and
     * that emptiness is a finding rather than a reason to charge something
     * else.
     */
    counterparties: readonly string[];
}): WhatAFailureTakes {
    const { sending } = input;
    const landsOn = WHERE_A_STAKE_LANDS[sending.posting.atStake];
    const howBadly = howBadlyItWent(sending);
    const nothing: WhatAFailureTakes = {
        landsOn,
        howBadly,
        stones: 0,
        regardFalls: [],
        regardBy: 0,
        groundGivenUp: [],
        instrumentsLapsed: [],
        instrumentLapsedBy: 0,
        nothingToTake: false
    };
    if (howBadly <= 0) return nothing;

    switch (landsOn) {
        case 'the_party':
            // Already taken, by `markMissing`: the party IS the loss and the
            // roll is shorter by exactly the people who did not come back. So
            // an errand that staked only the party and lost nobody genuinely
            // cost the house nothing, and says so rather than claiming a loss.
            return { ...nothing, nothingToTake: sending.lost.length === 0 };

        case 'the_purse': {
            // WHAT THE HOUSE PUT ON THE ROAD, which is the share of the house
            // that went. A house outfits the party it can afford: eight hands
            // out of a roll of sixteen is half the house on the road and half
            // of what the house could put behind it. Nothing new is priced -
            // `what-a-house-opens-its-treasury-for.ts` already states what
            // leaves a treasury as a share of what is in it.
            const share = input.onTheRoll > 0
                ? Math.min(1, sending.party.length / input.onTheRoll)
                : 1;
            const purse = Math.max(0, Math.floor(input.purse));
            const stones = Math.floor(Math.min(
                purse * A_SINGLE_ERRAND_CANNOT_TAKE_MORE_THAN,
                purse * share * howBadly
            ));
            return { ...nothing, stones, nothingToTake: stones <= 0 };
        }

        case 'a_neighbours_regard':
            return {
                ...nothing,
                regardFalls: input.counterparties,
                regardBy: WHAT_A_FAILURE_COSTS_IN_REGARD * howBadly,
                nothingToTake: input.counterparties.length === 0
            };

        case 'the_ground': {
            // THE GROUND THE ERRAND WAS ABOUT, and only where the house holds
            // it. A house that fails to stand to over its own vein stops
            // holding the vein. A house walked out to a line it never held, or
            // onto ground between itself and a rival, has no ground in the
            // errand for the world to take - and that is reported rather than
            // converted into stones.
            const where = sending.posting.locationId;
            const ours = where !== null && input.holds.includes(where);
            return {
                ...nothing,
                groundGivenUp: ours ? [where] : [],
                nothingToTake: !ours
            };
        }

        case 'an_instrument':
            return {
                ...nothing,
                instrumentsLapsed: input.counterparties,
                instrumentLapsedBy: WHAT_A_LAPSE_TAKES_OFF_THE_TERMS * howBadly,
                nothingToTake: input.counterparties.length === 0
            };
    }
}

// ═════════════════════════════════════════════════════════════════════════
// AND WHERE THEY ACTUALLY GO
// ═════════════════════════════════════════════════════════════════════════

/**
 * WHERE A SENDING GOES, off the reason's own `needs` key.
 *
 * A posting used to be pitched at the house's own seat, which is not a place
 * anybody is sent TO - it is where they left from. Measured: 74 of 76 NPCs who
 * survived two hundred years never changed location once, because the only
 * pass that moves anybody filters `factionId === null` and half the world is in
 * a house.
 *
 * Nothing new decides this. `needs` already names what the errand is about, and
 * the predicate for each is already written in `NEED_PREDICATES` - a house that
 * has no rival cannot be sent at one. So the destination falls out of the same
 * key that decides whether the reason is open at all:
 *
 * {@link WHERE_A_NEED_SENDS_YOU} is that reading, as a column rather than a
 * condition: a new key does not compile until it has said which of the two it
 * is, which is cheaper than a reader finding the disjunction and guessing.
 *
 *     an_ally        their seat. You are received: a marriage happens at a house.
 *     a_subsidiary   their seat. Tribute is collected from a place.
 *     a_parent       their seat. A call comes from somewhere and you go to it.
 *     a_counterpart  their seat. A visit and a meet are both somebody receiving
 *                    you, and being seen arriving is most of what they are for.
 *
 *     a_rival        NOT their seat. You do not camp in the courtyard of the
 *                    house you are at war with; you stand on ground between.
 *     ground         ground, which is what standing to means.
 *     a_find         out where the find is.
 *     forbidden_ground  the line itself. Nobody receives you at a place that
 *                    stopped being a place.
 *     nothing        out. Materials, recruits and escorts are errands whose
 *                    destination is not stated, and the honest answer is
 *                    somewhere that is not this hall - which is also what makes
 *                    a recruiting trip reach a lesser house.
 *
 * `elsewhere` MUST be ground somebody can stand on. A region is a container -
 * `populationWeightOf` is zero for one and `demography.test.ts` holds the line
 * that nobody is ever placed on a map node nobody can stand on - and sending a
 * party to one put nineteen people inside the map rather than on it.
 *
 * Null where the world holds nowhere to go, and a caller must read that as
 * "they went out and the record does not say where" rather than as home.
 */
/** Whether the errand ends at somebody's hall or out on ground. */
export const WHERE_A_NEED_SENDS_YOU: Record<ReasonNeed, 'a_seat' | 'ground'> = {
    nothing: 'ground',
    ground: 'ground',
    a_subsidiary: 'a_seat',
    a_parent: 'a_seat',
    an_ally: 'a_seat',
    a_counterpart: 'a_seat',
    a_rival: 'ground',
    a_find: 'ground',
    a_containment: 'ground',
    forbidden_ground: 'ground',
    // The ground itself, and never the hall of whoever is standing on it. A
    // house walking onto a town it means to take is not being received.
    ground_that_pays_somebody_else: 'ground'
};

/**
 * The houses one reason is about, by id.
 *
 * `whereASendingGoes` has asked for *seats of the houses this reason is about*
 * since it was written, and every caller handed it every seat in the world - so
 * a party sent to collect on a grant was received at a hall drawn at random and
 * the subsidiary that owed the grant never saw anybody. The design owner, on
 * where a posting actually goes: an elder travels to friendly houses in their
 * own faction, a court's elder down and a lesser house's elder up.
 *
 * Nothing new decides which. `NEED_PREDICATES` already tests exactly these
 * relations to make the reason available at all, and this is the same test read
 * as the list it filtered on - so a house cannot be sent to visit somebody the
 * reason was not open toward.
 *
 * The rung of whoever travels is what makes it a trip down or a trip up, and it
 * is already in the key: a subsidiary is below, a parent is above, and an ally
 * or a counterpart is neither.
 *
 * A column rather than a disjunction, for the reason {@link WHERE_A_NEED_SENDS_YOU}
 * is one: a new key does not compile until it has said who it is about. Empty
 * for every errand that ends on ground, which is what that table already says of
 * the same keys.
 */
const WHO_A_NEED_IS_ABOUT:
    Record<ReasonNeed, (house: HouseAsItStands) => readonly string[]> = {
    nothing: () => [],
    ground: () => [],
    a_find: () => [],
    a_containment: () => [],
    forbidden_ground: () => [],
    // A rival is a house and the errand still ends on ground between the two:
    // you do not camp in the courtyard of the house you are at war with.
    a_rival: () => [],
    // The ground names itself, and whoever is standing on it is not receiving
    // anybody. The caller knows which piece and says so.
    ground_that_pays_somebody_else: () => [],
    an_ally: house => Object.entries(house.standing)
        .filter(([, regard]) => regard >= ALLIED_STANDING)
        .map(([id]) => id),
    a_subsidiary: house => getSubsidiariesOf(house.id).map(p => p.factionId),
    a_parent: house => {
        const parent = getParentage(house.id)?.parentFactionId ?? null;
        return parent === null ? [] : [parent];
    },
    a_counterpart: house => house.sitsDownWith ?? []
};

export function whichHousesAReasonIsAbout(
    needs: ReasonNeed,
    house: HouseAsItStands
): readonly string[] {
    return WHO_A_NEED_IS_ABOUT[needs](house);
}

/**
 * Ground a party can be sent to stand on, by id.
 *
 * The `elsewhere` contract {@link whereASendingGoes} states, as the filter it
 * describes: not a hall, not above the lid, and somewhere with people on it. A
 * region is a container and a party posted to one is inside the map rather than
 * on it.
 */
/**
 * Ground these houses hold, for a party sent to a house that has no hall.
 *
 * `controllingFactionId` is the world's own statement of whose ground a place
 * is - the field's own comment says null is not "nobody holds it" - so this is
 * that read filtered to the houses in question. No second store and no guess:
 * a house that holds nothing comes back empty and the sending says so.
 */
export function groundTheseHousesHold(
    locations: readonly LocationRecord[],
    houseIds: readonly string[]
): readonly string[] {
    if (houseIds.length === 0) return [];
    const theirs = new Set(houseIds);
    return locations
        .filter(l => l.controllingFactionId !== null
            && theirs.has(l.controllingFactionId)
            && l.kind !== 'sect_seat'
            && isBelowTheLid(l)
            && populationWeightOf(l) > 0)
        .map(l => l.id);
}

/**
 * The ground a house actually holds, as against the rooms inside its walls.
 *
 * ONE READING, taken by the errand that is about a house's own ground and by
 * the failure that costs it that ground, so the two cannot disagree about which
 * places are in play.
 *
 * `controllingFactionId` is on a great deal more than ground. A compound's
 * precincts, halls, chambers and vaults all carry it and all have somebody
 * standing in them, so the first cut of this sent parties to stand to at their
 * own infirmary and had a house forfeit its practice yard: of eight pieces of
 * ground given up across three seeded centuries, seven were rooms inside the
 * sending house's own walls and the eighth was a city.
 *
 * A vein or somewhere that pays, and nothing else. Both are what the errand's
 * own row is about - something moving toward the settlements under the vein -
 * and both are read by the yearly economy, so a house that loses one is poorer
 * in the same column the rest of the world already reads it in.
 */
export function theGroundAHouseHolds(
    locations: readonly LocationRecord[],
    houseId: string
): readonly string[] {
    return locations
        .filter(l => l.controllingFactionId === houseId
            && isBelowTheLid(l)
            && (l.kind === 'vein' || whatATownPaysItsHolder(l) > 0))
        .map(l => l.id);
}

export function groundAPartyCanBeSentTo(
    locations: readonly LocationRecord[]
): readonly string[] {
    return locations
        .filter(l => l.kind !== 'sect_seat'
            && isBelowTheLid(l)
            && populationWeightOf(l) > 0)
        .map(l => l.id);
}

export function whereASendingGoes(input: {
    needs: ReasonNeed;
    /** The house's own seat, so it can be excluded. */
    fromLocationId: string | null;
    /** Seats of the houses this reason is about, in the world's own order. */
    seatsInPlay: readonly string[];
    /** Places that are neither this house's nor anybody's seat. */
    elsewhere: readonly string[];
    /**
     * Ground the houses this reason is about actually hold, for the seat
     * errands where one of them has no hall.
     *
     * A HOUSE WITHOUT A SEAT IS STILL SOMEWHERE. Both callers map the reason's
     * houses to `seatLocationId` and drop the nulls, so a seatless subsidiary
     * vanished out of `seatsInPlay` and the errand fell through to `elsewhere`
     * - which is ground picked at random anywhere in the world. A tribute
     * errand quietly became a ground errand and the house that owed the tribute
     * never saw anybody, which is the same defect `seatsInPlay` was just fixed
     * for, one rung further down.
     */
    groundNearThem?: readonly string[];
    /**
     * The ground the house's find is on, when the reason is the find.
     *
     * The table above has said `a_find  out where the find is` since it was
     * written and the code drew from `elsewhere` like every other ground
     * errand, so a house that opened an errand BECAUSE it knew of a door sent
     * the party to a place picked at random and the door was never visited.
     * Nothing in the ledger then said anybody had been near it, which is what
     * made a house's knowledge of its own province stop at whoever happened to
     * die there. {@link aFindThisHouseCouldSendFor} already answers which
     * ground, and the caller already asked it to decide the reason was open.
     */
    theFind?: string | null;
    /**
     * Ground this house holds, for the errand that is about it.
     *
     * `needs: 'ground'` is open to a house BECAUSE it holds ground, and the one
     * row on it says so outright: the house that holds the vein is the only
     * body that can read the ground under the settlements. The party was
     * nonetheless drawn from every populated place in the world, so a house
     * standing to over its own vein was walked onto somebody else's district -
     * which is the same defect `theFind` and `seatsInPlay` above were each
     * fixed for, and it is what left `atStake: 'the_ground_itself'` with no
     * ground of the house's in the errand for a failure to take.
     *
     * Filtered by the caller with `groundTheseHousesHold`, so a seat and a
     * place nobody can stand on are out by the same rule that keeps them out of
     * `elsewhere`. Falls through to `elsewhere` when the house holds none that
     * qualifies, which is the honest answer and not a hall.
     */
    ownGround?: readonly string[];
    /** Picks one. The caller's stream, so no draw anywhere else moves. */
    pick: (count: number) => number;
}): string | null {
    if (input.needs === 'a_find' && input.theFind) return input.theFind;

    const notHome = (ids: readonly string[]): string[] =>
        ids.filter(id => id !== input.fromLocationId);

    const pickOne = (from: readonly string[]): string | null =>
        from[Math.min(from.length - 1, Math.max(0, input.pick(from.length)))] ?? null;

    if (input.needs === 'ground') {
        const ours = notHome(input.ownGround ?? []);
        if (ours.length > 0) return pickOne(ours);
    }

    // Only the errands where a house RECEIVES you go to a hall.
    const pool = WHERE_A_NEED_SENDS_YOU[input.needs] === 'a_seat'
        ? notHome(input.seatsInPlay)
        : notHome(input.elsewhere);

    // ── AND A SEAT ERRAND DOES NOT FALL BACK ONTO THE WHOLE MAP ─────────
    //
    // The old fallback sent anything with an empty pool to `elsewhere`, and the
    // note beside it argued the rival case - a house that cannot find its
    // rival's seat still sends the party. But `a_rival` is a GROUND errand in
    // the table above and never reads `seatsInPlay`, so that note described a
    // path it could not take. What it actually caught was the four errands
    // where a house RECEIVES you and one of them has no hall, and sending that
    // party to a place drawn at random is not a worse address, it is a
    // different errand.
    //
    // So: their ground if the caller knows any, and otherwise nothing. Null
    // already means "they went out and the record does not say where", which is
    // the honest answer and is a great deal better than a hall nobody meant.
    const seatErrand = WHERE_A_NEED_SENDS_YOU[input.needs] === 'a_seat';
    const chosen = pool.length > 0
        ? pool
        : notHome(seatErrand ? (input.groundNearThem ?? []) : input.elsewhere);
    if (chosen.length === 0) return null;
    return pickOne(chosen);
}
