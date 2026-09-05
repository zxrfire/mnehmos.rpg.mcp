/**
 * What a party arrives on, what that does to the days, and what anybody watching
 * the gate reads off it.
 */

import type { TechniqueGrade } from '../../schema/cultivation.js';
import { REALM_TIERS, OBJECT_CEILING_BELOW_THE_LID } from '../cultivation/realms.js';
import { refiningOrdinalFor } from '../cultivation/who-can-refine-a-grade-of-medicine.js';

// ─────────────────────────────────────────────────────────────────────────
// THE SHAPE
// ─────────────────────────────────────────────────────────────────────────

/**
 * What distance a conveyance is FOR.
 */
export type ConveyanceRange = 'district' | 'province' | 'crossing';

/**
 * How a conveyance is held, which decides everything about how it is stored.
 */
export type ConveyanceHolding = 'none' | 'counted' | 'tracked' | 'personal';

/**
 * A KIND of conveyance. Not an instance.
 */
export interface Conveyance {
    id: string;
    name: string;
    /**
     * What the thing is made of. Null only for walking, which is made of nothing.
     */
    grade: TechniqueGrade | null;
    range: ConveyanceRange;
    holding: ConveyanceHolding;
    /** How many people it moves, the person driving it included. */
    heads: number;
    /**
     * Whether it goes where there is no ground: open water, a burnt scar, a
     * face nothing walks up. Everything below heaven grade answers no, which is
     * most of why the map is the shape it is.
     */
    crossesGroundThatCannotBeWalked: boolean;
    /**
     * Whether a stranger at the gate can tell what arrived before anybody
     * speaks. The whole of the expensive-signal argument rests on this being
     * true at the top and false in the middle.
     */
    seenComing: boolean;
    /**
     * The beast in the traces or under the saddle, where there is one. Always
     * strictly below `BEAST_CHANGE_ORDINAL`: at and above it a beast has a
     * shape and a voice and can decline, so what looks like taming is either an
     * arrangement between two parties or it is keeping a person.
     */
    drawnByBeast: boolean;
    description: string;
}

// SPEED

/**
 * Walking days done in one day, by what the thing is made of.
 */
export const WALKING_DAYS_PER_DAY_BY_GRADE: Readonly<Record<TechniqueGrade, number>> = {
    mortal: 2,
    earth: 3,
    heaven: 5,
    immortal: 5,
    chaos: 5
};

/** On foot, which is the unit and is what a conveyance is measured against. */
export const ON_FOOT_SPEED = 1;

/**
 * Realms a rating stands above the floor at which a craft becomes trackable.
 */
export function realmsAboveTheTrackedFloor(power: number): number {
    const floor = refiningOrdinalFor('heaven');
    const clamped = Math.max(0, Math.min(OBJECT_CEILING_BELOW_THE_LID, Math.floor(power)));
    if (clamped < floor) return 0;
    const index = (ordinal: number): number =>
        REALM_TIERS.findIndex(t => ordinal >= t.ordinalStart && ordinal <= t.ordinalEnd);
    return Math.max(0, index(clamped) - index(floor));
}

/**
 * Walking days this conveyance covers in one day.
 */
export function walkingDaysPerDay(conveyance: Conveyance, power: number | null = null): number {
    if (conveyance.grade === null) return ON_FOOT_SPEED;
    const base = WALKING_DAYS_PER_DAY_BY_GRADE[conveyance.grade];
    if (conveyance.holding !== 'tracked' || power === null) return base;
    return base + realmsAboveTheTrackedFloor(power);
}

/**
 * What a journey quoted in walking days actually takes.
 */
export function daysByConveyance(
    walkingDays: number,
    conveyance: Conveyance,
    power: number | null = null
): number {
    const days = Math.max(0, Math.ceil(walkingDays));
    if (days === 0) return 0;
    return Math.max(1, Math.ceil(days / walkingDaysPerDay(conveyance, power)));
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IT CANNOT DO
// ─────────────────────────────────────────────────────────────────────────

/**
 * How far a range reaches, in walking days, before the choice is the wrong one.
 */
export const REACH_IN_WALKING_DAYS: Readonly<Record<ConveyanceRange, number>> = {
    district: 3,
    province: 25,
    crossing: Number.MAX_SAFE_INTEGER
};

/**
 * Why this is the wrong thing to have taken, in words, or null where it is not.
 */
export function unsuitedFor(
    conveyance: Conveyance,
    walkingDays: number,
    crossesGroundThatCannotBeWalked = false
): string | null {
    const days = Math.max(0, Math.ceil(walkingDays));
    if (crossesGroundThatCannotBeWalked && !conveyance.crossesGroundThatCannotBeWalked) {
        return `${conveyance.name} needs ground under it. Where the ground stops it stops, `
            + 'and the party is on the bank looking at the far side like everybody else.';
    }
    if (days > REACH_IN_WALKING_DAYS[conveyance.range]) {
        return `${conveyance.name} is a ${conveyance.range} conveyance and this is `
            + `${days} days on foot. It will get there, and it will arrive late, worn and `
            + 'having been overtaken by anybody who chose better.';
    }
    // Only a tracked craft can be too much. Walking also reaches everywhere
    // and nobody has ever been remarked on for it, which is why the branch is
    // on what is held rather than on the range.
    if (conveyance.holding === 'tracked'
        && conveyance.range === 'crossing'
        && days <= REACH_IN_WALKING_DAYS.district) {
        return `Taking ${conveyance.name} on an errand of ${days} day`
            + `${days === 1 ? '' : 's'} is not fast, it is loud. Everybody between here and `
            + 'there now knows what this house owns and that it is out.';
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT A WITNESS READS
// ─────────────────────────────────────────────────────────────────────────

/**
 * What arriving on this says about the party, before a word is spoken.
 */
export function whatArrivingOnThisSays(conveyance: Conveyance, power: number | null = null): string {
    if (conveyance.holding === 'personal') {
        return 'One person, on their own art, and the art is a house\'s. Anybody who has seen '
            + 'that school move knows which house before the party is close enough to hail.';
    }
    if (conveyance.holding === 'tracked') {
        const rung = power === null ? '' : ` rated at ${power}`;
        return `A thing that had to be built${rung}, by a hand almost nobody has, out of materials `
            + 'somebody went out and took. Nobody at this gate can check any of that and nobody '
            + 'needs to: the cost of faking it is the whole of why it is believed.';
    }
    if (conveyance.grade === null) {
        return 'They walked. That is not nothing said about them - it is the most legible thing '
            + 'anybody at the gate will learn today, and the house did not get to choose it.';
    }
    return `${conveyance.name}, which is what an ordinary house on ordinary ground brings out, `
        + 'and which tells a watcher only that somebody paid for it. Nobody remarks on it, '
        + 'which is most of its value to a party that would rather not be remarked on.';
}

/**
 * Whether a party on this can arrive without the district knowing.
 */
export function couldArriveUnremarked(conveyance: Conveyance): boolean {
    return !conveyance.seenComing;
}

// ─────────────────────────────────────────────────────────────────────────
// THE ROW THAT IS NOT AN OBJECT
// ─────────────────────────────────────────────────────────────────────────

/**
 * The road a flight art asks you to have come up through, where it asks at all.
 *
 * This was `'sword'`, a constant, and the ONE art the caller consulted was the
 * sword one - so the rule read "you need a sword road" for every art in the
 * game, and there are sixteen movement arts. The design note on the sword row
 * says it plainly: the design owner named flight as the ANALOGY for what an
 * incidental ability looks like, so that row is the EXAMPLE and not the case.
 *
 * The rule is the same rule; what it asks about is the art in front of it.
 * Standing on a blade is what a sword school does with the whole of its
 * practice; treading cloud is what a wind school does with the whole of its
 * practice. An art with no subject at all asks nobody for anything.
 */
export function roadAFlightArtAsksFor(art: { subject?: string | null }): string | null {
    return art.subject ?? null;
}

/** What the gate needs to know about an art somebody holds. */
export interface HeldArt {
    id: string;
    subject?: string | null;
}

export interface FlightGateResult {
    can: boolean;
    /** Machine-readable, for a caller that wants to branch. */
    reason: 'flies' | 'does_not_know_it' | 'not_of_the_school' | 'rung_too_low';
    /** Engine-authored account. Always names what would open it. */
    detail: string;
}

/**
 * Whether this cultivator can put themselves in the air on their own blade.
 */
export function couldFlyOnTheirOwnBlade(input: {
    realmOrdinal: number;
    /** Every art they hold, with its subject. Order is not read. */
    known: readonly HeldArt[];
    /** The flight art itself: the rung it opens at, and the road it stands on. */
    flightArt: { id: string; requiredOrdinal: number; subject?: string | null };
    /** `dao.subject` from `assessDao`. Null for almost everybody. */
    daoSubject?: string | null;
}): FlightGateResult {
    const holdsFlight = input.known.some(a => a.id === input.flightArt.id);
    if (!holdsFlight) {
        return {
            can: false,
            reason: 'does_not_know_it',
            detail: 'They have never been shown it. The art is taught, by one house in the '
                + 'region, to its own, and there is no version of it somebody works out in a cave.'
        };
    }
    if (input.realmOrdinal < input.flightArt.requiredOrdinal) {
        return {
            can: false,
            reason: 'rung_too_low',
            detail: `They hold it and cannot hold themselves up on it. The art opens at ordinal `
                + `${input.flightArt.requiredOrdinal} and they stand at ${input.realmOrdinal}.`
        };
    }
    // WHAT THE ART ITSELF STANDS ON, not a constant. An art with no subject
    // asks for nothing and carries whoever holds it.
    const asksFor = roadAFlightArtAsksFor(input.flightArt);
    if (asksFor === null) {
        return {
            can: true,
            reason: 'flies',
            detail: 'The art stands on nothing in particular, so holding it is the whole of it.'
        };
    }
    const roadIsTheirs = input.daoSubject === asksFor;
    const shelfIsTheirs = input.known.some(
        a => a.id !== input.flightArt.id && a.subject === asksFor
    );
    if (!roadIsTheirs && !shelfIsTheirs) {
        return {
            can: false,
            reason: 'not_of_the_school',
            detail: `Carrying yourself on ${asksFor} is not a trick performed with ${asksFor}, `
                + 'it is what such a school does with the whole of its practice, and this is '
                + `somebody holding one page out of it. Another art of the ${asksFor}, or a road `
                + `that is the ${asksFor}, and the page stops being a page.`
        };
    }
    return {
        can: true,
        reason: 'flies',
        detail: roadIsTheirs
            ? `The road is the ${asksFor}, so the ${asksFor} holds them up.`
            : `They came up through a ${asksFor} school and this is the rest of what they were taught.`
    };
}

// ─────────────────────────────────────────────────────────────────────────
// PUTTING A PARTY ON THE ROAD
// ─────────────────────────────────────────────────────────────────────────

export interface JourneyInput {
    /** What the road costs on foot. `travelDays` on a `RegionConnection`. */
    walkingDays: number;
    conveyance: Conveyance;
    /** The craft's rung, for a tracked one. Null for everything else. */
    power?: number | null;
    /** How many are going. More than the conveyance holds means two trips. */
    heads: number;
    /** Whether any part of the route has no ground under it. */
    crossesGroundThatCannotBeWalked?: boolean;
}

export interface JourneyCost {
    daysOneWay: number;
    /**
     * Trips needed to move everybody. A conveyance that holds four and a party
     * of nine is three trips, and the days are what the last of them arrives
     * on rather than what the first does.
     */
    trips: number;
    daysForEverybody: number;
    /** Days saved against walking. The figure that makes a rung legible. */
    daysSavedAgainstWalking: number;
    /** Null where the choice was a reasonable one. */
    wrongToolNote: string | null;
    /** What a watcher at the far gate reads off the arrival. */
    arrivalReads: string;
}

/**
 * Price one journey.
 */
export function priceJourney(input: JourneyInput): JourneyCost {
    const power = input.power ?? null;
    const heads = Math.max(1, Math.floor(input.heads));
    const capacity = Math.max(1, Math.floor(input.conveyance.heads));
    const trips = Math.ceil(heads / capacity);
    const daysOneWay = daysByConveyance(input.walkingDays, input.conveyance, power);
    // Two extra legs per additional trip: back for the next load, and out
    // again. The party that went first is already there and is not counted
    // twice, which is why this is 2n-1 legs rather than 2n.
    const daysForEverybody = daysOneWay * (2 * trips - 1);
    return {
        daysOneWay,
        trips,
        daysForEverybody,
        daysSavedAgainstWalking: Math.max(0, Math.ceil(input.walkingDays) - daysOneWay),
        wrongToolNote: unsuitedFor(
            input.conveyance,
            input.walkingDays,
            input.crossesGroundThatCannotBeWalked ?? false
        ),
        arrivalReads: whatArrivingOnThisSays(input.conveyance, power)
    };
}

/**
 * The best of what is available for this road, or null where nothing offered suits
 * it and the party is walking.
 */
export function bestForThisRoad(
    available: readonly { conveyance: Conveyance; power: number | null }[],
    walkingDays: number,
    heads: number,
    crossesGroundThatCannotBeWalked = false
): { conveyance: Conveyance; power: number | null } | null {
    const usable = available.filter(
        a => !crossesGroundThatCannotBeWalked || a.conveyance.crossesGroundThatCannotBeWalked
    );
    if (usable.length === 0) return null;
    const suited = usable.filter(
        a => unsuitedFor(a.conveyance, walkingDays, crossesGroundThatCannotBeWalked) === null
    );
    const pool = suited.length > 0 ? suited : usable;
    const scored = pool.map(a => ({
        a,
        days: priceJourney({
            walkingDays,
            conveyance: a.conveyance,
            power: a.power,
            heads,
            crossesGroundThatCannotBeWalked
        }).daysForEverybody
    }));
    scored.sort((x, y) =>
        x.days - y.days
        || y.a.conveyance.heads - x.a.conveyance.heads
        || Number(x.a.conveyance.seenComing) - Number(y.a.conveyance.seenComing)
        || (x.a.conveyance.id < y.a.conveyance.id ? -1 : 1)
    );
    return scored[0].a;
}
