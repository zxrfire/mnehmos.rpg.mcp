/**
 * What a party arrives on, what that does to the days, and what anybody
 * watching the gate reads off it.
 *
 * THE RULING THIS IMPLEMENTS
 * --------------------------
 * Walking is the floor. Above it sit a tamed beast and a drawn carriage, which
 * are COUNTED - a house has some number of them and nobody records which one -
 * and above those sit a very small number of TRACKED craft, which are objects
 * with an ordinal on the same 0..46 ladder a person stands on. That split is
 * not a rule about transport. It is `docs/world/things/items.md`'s
 * counted-or-tracked line met from the travel side, and the grade at which it
 * flips is the grade at which it flips for everything else.
 *
 * `docs/world/houses/trust.md` already names a retinue of spirit boats as the
 * canonical expensive signal - believed because assembling one is beyond almost
 * everybody, and worth exactly what it costs to fake. That passage was
 * aspirational while a boat was a figure of speech. This module and
 * `data/cultivation/what-a-house-moves-its-people-on.ts` are the half that
 * makes it true: the craft is an object, somebody built it, and arriving on one
 * is a fact a witness can read.
 *
 * RANGE IS AN AXIS, NOT A RUNG
 * ----------------------------
 * The commonest way to get this wrong is to read the table as worst-to-best and
 * conclude that a house holding a carriage is a house too poor for a boat. It
 * is not. A carriage is for getting across a district without mounting an
 * expedition, and a boat is for crossing a province; a house at the top of the
 * world holds both, because nobody takes the expensive thing out for the short
 * trip. That is an ordinary economy and it is why the drawn carriage stays
 * common at every level of wealth.
 *
 * So `range` and `power` are separate fields and neither implies the other, and
 * `unsuitedFor` below is the function that says what the wrong choice costs.
 *
 * ONE ROW IS NOT AN OBJECT AT ALL
 * -------------------------------
 * Flight on a blade is a technique somebody knows - `gale-riding-sword-flight`
 * in `data/cultivation/techniques.ts`, `requiredOrdinal` 15, taught by the
 * region's orthodox sword house and already written into that house's character
 * as daily practice. It is in this table because it is a way of getting there,
 * and it is unlike every other row: it cannot be bought, lent, inherited,
 * moored, taken off you or found abandoned, and it carries exactly one person.
 * Nothing here re-implements it. `ownership` says `personal` and the technique
 * catalog stays the authority on what it is and who may learn it.
 *
 * WHAT THE ORDINAL BUYS, AND WHAT IT DELIBERATELY DOES NOT
 * -------------------------------------------------------
 * A craft rated at N is worth what a cultivator at N is worth, the same
 * sentence `artifacts.ts` writes about `power`. It buys days, heads, the ground
 * it can cross and how far it goes before it has to be fed. It does not buy a
 * fight: a craft is moored rather than carried, which is why `possessorId` is
 * null on every one of them in the catalog and why `bestObjectHeldBy` in
 * `gatherings.ts` can never hand somebody a boat to swing.
 *
 * PURE. State in, deltas out. No I/O, no DB, no mutation of inputs.
 */

import type { TechniqueGrade } from '../../schema/cultivation.js';
import { REALM_TIERS, OBJECT_CEILING_BELOW_THE_LID } from '../cultivation/realms.js';
import { refiningOrdinalFor } from '../cultivation/who-can-refine-a-grade-of-medicine.js';

// ─────────────────────────────────────────────────────────────────────────
// THE SHAPE
// ─────────────────────────────────────────────────────────────────────────

/**
 * What distance a conveyance is FOR.
 *
 * Not how good it is. A house holds one of each because the jobs are different,
 * and taking the wrong one is a real and ordinary mistake rather than an error
 * the engine refuses.
 */
export type ConveyanceRange = 'district' | 'province' | 'crossing';

/**
 * How a conveyance is held, which decides everything about how it is stored.
 *
 * `none`     nothing is held. Walking, which is the floor and is free.
 * `counted`  a line on the entity: this house has four at earth grade. No id,
 *            no provenance, nothing to recognise. Losing one decrements a
 *            number. These must never be routed through `transferPossession`.
 * `tracked`  an `ObjectRecord` with an id, an ordinal and a history somebody
 *            can be asked about two centuries later.
 * `personal` neither. A technique in somebody's head, which is nobody's
 *            property and cannot change hands at all.
 */
export type ConveyanceHolding = 'none' | 'counted' | 'tracked' | 'personal';

/**
 * A KIND of conveyance. Not an instance.
 *
 * The counted kinds have no instances anywhere by design - a house's holding of
 * them is a number. The tracked kinds have instances, and those instances are
 * ordinary `ObjectRecord`s in the catalog.
 */
export interface Conveyance {
    id: string;
    name: string;
    /**
     * What the thing is made of. Null only for walking, which is made of
     * nothing.
     *
     * This is the field the counted/tracked split reads: heaven grade and above
     * is tracked, everything under it is a quantity.
     *
     * For a `personal` row it is the ART'S grade rather than a material, which
     * is not a fudge - an art is graded on the same four-step ladder a material
     * is, by the same catalog, and reading the technique's own grade is the
     * alternative to inventing a speed number for it.
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

// ─────────────────────────────────────────────────────────────────────────
// SPEED
//
// The unit is a walking day, because that is the unit every road in the
// catalog is already quoted in: `travelDays` on a `RegionConnection` is what
// it takes on foot.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Walking days done in one day, by what the thing is made of.
 *
 * Four numbers and they are a decision rather than a measurement, so
 * `tests/engine/world/what-a-conveyance-does-to-a-journey.test.ts` states the
 * decision in the names of its cases. The shape being defended is that the
 * ordinary rungs are worth having and none of them is worth a boat: a mule and
 * a cart genuinely halve a road, an earth-grade carriage genuinely thirds it,
 * and the gap that matters opens at heaven grade where almost nobody is.
 *
 * The hazard if you move these: `what-a-sea-crossing-costs.ts` is a whole
 * subsystem whose stakes are a lane running longer than it was provisioned
 * for. Push the top of this table high enough and a passage is over before the
 * water runs out, which deletes that module's entire threat model for whoever
 * holds the craft. At the figures below the best hull in the world still takes
 * four days over the longest lane, so the sum still has to be right.
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
 *
 * The increment is per REALM rather than per rung, and that is the whole reason
 * this is not an invented curve: the ladder already has boundaries in it, they
 * are where everything else in the engine steps, and a per-rung figure would be
 * a second opinion about how far apart two rungs are.
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
 *
 * `power` is read only for a tracked craft, and it is the one place the ordinal
 * touches speed. Everything below heaven grade has no ordinal at all, which is
 * not a gap in the data - it is the counted side of the line, where the
 * question "which one" has no answer.
 */
export function walkingDaysPerDay(conveyance: Conveyance, power: number | null = null): number {
    if (conveyance.grade === null) return ON_FOOT_SPEED;
    const base = WALKING_DAYS_PER_DAY_BY_GRADE[conveyance.grade];
    if (conveyance.holding !== 'tracked' || power === null) return base;
    return base + realmsAboveTheTrackedFloor(power);
}

/**
 * What a journey quoted in walking days actually takes.
 *
 * Never less than one day, and never fractional. A road is a road: arriving in
 * a third of a day and arriving in a day are the same day to everybody waiting
 * at the other end, and pretending otherwise invents a precision the world does
 * not have.
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
 *
 * These are not refusals. A party may take a district carriage across a
 * province and the engine will price it; what it will not do is pretend the
 * choice was sensible. AGENTS.md: the correct answer to "may I" is always "yes,
 * and here is what it costs".
 */
export const REACH_IN_WALKING_DAYS: Readonly<Record<ConveyanceRange, number>> = {
    district: 3,
    province: 25,
    crossing: Number.MAX_SAFE_INTEGER
};

/**
 * Why this is the wrong thing to have taken, in words, or null where it is not.
 *
 * Both directions are named, because taking too much is as real a mistake as
 * taking too little and is the one a rich house actually makes. A boat brought
 * out for an afternoon's errand is a boat everybody in the district saw, and
 * being seen is not free.
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
 *
 * This is the same read as a token or a retinue and belongs on the same axis,
 * so it points at `docs/world/houses/trust.md`'s expensive-signal section
 * rather than restating it. The one thing worth saying here that is not said
 * there: the read runs in BOTH directions. A delegation on foot has told
 * everybody at the gate what its house can afford, and it did not get to choose
 * whether to.
 *
 * Engine-authored, one sentence, no branch on faction or alignment anywhere.
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
 *
 * The inverse of `seenComing`, stated as its own function because it is the
 * question a party actually has, and because a boat's single largest drawback
 * is that the answer is no. There is no version of a spirit boat that arrives
 * quietly, and that is a condition on the capability rather than an oversight -
 * every advantage in this world has one.
 */
export function couldArriveUnremarked(conveyance: Conveyance): boolean {
    return !conveyance.seenComing;
}

// ─────────────────────────────────────────────────────────────────────────
// THE ROW THAT IS NOT AN OBJECT
// ─────────────────────────────────────────────────────────────────────────

/**
 * The art whose subject decides whether flight is open to somebody.
 *
 * Named here rather than imported so this module stays free of the content
 * layer, the same discipline `SeaLane` keeps next door: the engine says what
 * the rule is and the catalog says which rows satisfy it.
 */
export const FLIGHT_SUBJECT = 'sword';

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
 *
 * Ruled by the design owner: flight on a sword belongs to sword cultivators, to
 * sword schools with sword arts. Not to anybody with a metal root who has
 * reached the rung. `techniques.ts` carries the gate as `subject` on five rows
 * and the argument for why those five; this is the predicate that reads it.
 *
 * Two ways to be of the school and they are the ordinary two: your road is the
 * sword, or your shelf is. The first is `dao.ts`'s standing in the weapon
 * domain and costs a life to acquire; the second is having been taught by
 * somebody who teaches this, which is how almost every flier in the world got
 * there. Requiring the first alone would close the art to the house that
 * invented it, since a Foundation disciple has no Dao standing at all.
 *
 * THIS IS THE ONE CONVEYANCE THAT IS NOT PROPERTY. It cannot be bought, lent,
 * inherited, moored, taken off a body or found abandoned, which is why it sits
 * in the ladder as `holding: 'personal'` and why a sword house that cannot
 * afford a hull still moves faster than a richer neighbour that can.
 */
export function couldFlyOnTheirOwnBlade(input: {
    realmOrdinal: number;
    /** Every art they hold, with its subject. Order is not read. */
    known: readonly HeldArt[];
    /** The flight art itself, and the rung it opens at. */
    flightArt: { id: string; requiredOrdinal: number };
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
    const roadIsTheSword = input.daoSubject === FLIGHT_SUBJECT;
    const shelfIsTheSword = input.known.some(
        a => a.id !== input.flightArt.id && a.subject === FLIGHT_SUBJECT
    );
    if (!roadIsTheSword && !shelfIsTheSword) {
        return {
            can: false,
            reason: 'not_of_the_school',
            detail: 'Standing on a blade is not a trick performed with a blade, it is what a '
                + 'sword school does with the whole of its practice, and this is somebody '
                + 'holding one page out of it. Another art of the school, or a road that is '
                + 'the sword, and the page stops being a page.'
        };
    }
    return {
        can: true,
        reason: 'flies',
        detail: roadIsTheSword
            ? 'The road is the sword, so the sword holds them up.'
            : 'They came up through a sword school and the flight is the rest of what they were taught.'
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
 *
 * Deterministic, and deliberately so: how long a road takes is not a roll.
 * What happens ON the road is somebody else's question and is asked by the
 * systems that already ask it - the encounter layer for what is met, and
 * `what-a-sea-crossing-costs.ts` for the one route where the duration itself
 * is a distribution because the weather is.
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
 * The best of what is available for this road, or null where nothing offered
 * suits it and the party is walking.
 *
 * "Best" IS NOT FASTEST, and that is the whole of this function. A hull is
 * faster than a named carriage over a district and no house sends one, because
 * the days saved are two and the cost is that everybody between here and there
 * now knows what this house owns and that it is out. So the right conveyance
 * for the road is chosen first, and something `unsuitedFor` has flagged is
 * reached for only when nothing suitable is held at all.
 *
 * Within the suitable ones it is fewest days, then the one that carries more,
 * then the one not seen coming.
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
