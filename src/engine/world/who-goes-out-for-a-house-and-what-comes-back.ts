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
import { nextOpeningDay, type LocationRecord } from './locations.js';
import { daysByConveyance, type Conveyance } from './what-a-conveyance-does-to-a-journey.js';

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
    forbidden_ground: house => house.standsNearForbiddenGround === true
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
    locations: readonly LocationRecord[]
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
        // `sealed` carries two states on a ruin - a door nobody has opened yet,
        // and one on an `OpeningCycle` that shuts again between seasons - and
        // both mean nobody gets in now, which is all this needs.
        // `a-door-that-closes-is-not-a-door-nobody-opened.ts` tells them apart
        // for anything that wants to WAIT for one.
        if (ground.kind !== 'ruin' || ground.sealed) continue;
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
    /** How many the house means to put on it. */
    hands: number;
    /** Above this nobody is sent. Null where the errand has no ceiling. */
    ceilingOrdinal: number | null;
    atStake: AtStake;
    /** The place, when the caller knows one. Carried for the sighting. */
    locationId: string | null;
}

/**
 * A posting off a reason and a rung.
 */
export function postingFor(input: {
    reason: SendingReason;
    house: HouseAsItStands;
    pitchOrdinal: number;
    locationId?: string | null;
    /** What they went on. Null or absent is walking, which changes nothing. */
    conveyance?: Conveyance | null;
    /** The craft's rung, for a tracked one. Ignored below heaven grade. */
    conveyancePower?: number | null;
}): Posting {
    const walkingDays = input.reason.days;
    const conveyance = input.conveyance ?? null;
    return {
        reason: input.reason,
        houseId: input.house.id,
        houseName: input.house.name,
        pitchOrdinal: clampOrdinal(input.pitchOrdinal),
        days: conveyance
            ? daysByConveyance(walkingDays, conveyance, input.conveyancePower ?? null)
            : walkingDays,
        walkingDays,
        conveyanceId: conveyance?.id ?? null,
        hands: input.reason.hands,
        ceilingOrdinal: input.reason.ceilingOrdinal,
        atStake: input.reason.atStake,
        locationId: input.locationId ?? null
    };
}

export interface Candidate {
    id: string;
    name: string;
    ordinal: number;
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
    forbidden_ground: 'ground'
};

export function whereASendingGoes(input: {
    needs: ReasonNeed;
    /** The house's own seat, so it can be excluded. */
    fromLocationId: string | null;
    /** Seats of the houses this reason is about, in the world's own order. */
    seatsInPlay: readonly string[];
    /** Places that are neither this house's nor anybody's seat. */
    elsewhere: readonly string[];
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
    /** Picks one. The caller's stream, so no draw anywhere else moves. */
    pick: (count: number) => number;
}): string | null {
    if (input.needs === 'a_find' && input.theFind) return input.theFind;

    const notHome = (ids: readonly string[]): string[] =>
        ids.filter(id => id !== input.fromLocationId);

    // Only the errands where a house RECEIVES you go to a hall.
    const pool = WHERE_A_NEED_SENDS_YOU[input.needs] === 'a_seat'
        ? notHome(input.seatsInPlay)
        : notHome(input.elsewhere);

    // A house with a rival it cannot find the seat of still sends the party.
    // Falling back to elsewhere rather than to home, because the one thing that
    // is certainly wrong is a party posted to the hall it left.
    const chosen = pool.length > 0 ? pool : notHome(input.elsewhere);
    if (chosen.length === 0) return null;
    return chosen[Math.min(chosen.length - 1, Math.max(0, input.pick(chosen.length)))] ?? null;
}
