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
import { regardFor, type Regard } from '../cultivation/regard.js';
import { clampOrdinal } from '../cultivation/realms.js';
import type { CultivationRNG } from '../cultivation/rng.js';
import type { RegardBand } from '../../schema/cultivation.js';
import { makeFact, type PendingFact } from './history.js';
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
     * Whether somebody has recently found something worth opening.
     */
    hasAFind: boolean;
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
    a_find: house => house.hasAFind
};

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
    posting: Posting,
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
            role: sending.lost.some(l => l.id === member.id) ? 'lost' : 'sent'
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
