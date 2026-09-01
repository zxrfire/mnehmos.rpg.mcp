/**
 * How much of the world can reach you while you do a thing.
 *
 * This is the whole of the "weighted by what they are doing" half of the
 * selection, and it is one table rather than a set of branches. Each row says
 * three things and nothing else:
 *
 *   exposure       how often anything happens at all, against 1.0 for standing
 *                  in the open in an ordinary place
 *   unreachable    what cannot get to you here, by the catalog's OWN tags and
 *                  kinds - there is no road entry in a cave because you are not
 *                  on the road, and no market in a cave because there is no
 *                  market
 *   lean           which direction this activity tends, before the entries are
 *                  looked at. See `valence.ts` for why direction is drawn first
 *
 * ── The one number that matters ──────────────────────────────────────────
 *
 * `sealed` has exposure zero, and that is load-bearing rather than tidy.
 * Closed-door seclusion is the game's existing bargain - safety bought with
 * every chance that would have found you - and this layer must not quietly
 * take the safety half away. A sealed door produces no occurrences, ever.
 *
 * `seclusion` is the other end of the same idea and the reason this module
 * exists. An open-door decade is not a black box: at 0.06 exposure something
 * finds the cave roughly once every four years, which over a twenty-year
 * seclusion is a handful of arrivals and, because most of what can reach a
 * sitting cultivator interrupts, one or two returns of control. That is the
 * intended rate. It is not "you will be left alone", and it is not "you may
 * never sit down".
 */

import type { EncounterEntry, EncounterKind } from '../../data/cultivation/encounters.js';
import type {
    EncounterActivity,
    EncounterPlace,
    EncounterValence,
    Locatability
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────
// CADENCE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Days between checks across a long span.
 *
 * A divisor of the 30-day ambient block and of the 90-day encounter grid the
 * time-skip already uses, so an encounter day is always a day the simulation
 * was going to stop on anyway.
 */
export const ENCOUNTER_GRID_DAYS = 15;

/** Probability of a grid check producing something, at exposure 1.0. */
export const SPAN_ENCOUNTER_CHANCE = 0.18;

/**
 * Probability that the ACT of doing something produces an encounter, at
 * exposure 1.0, independent of how many days it took.
 *
 * Two cadences rather than one, because the honest denominator changes. For a
 * decade in a cave the denominator is elapsed time; for walking to the next
 * village it is the walk. A single per-day rate makes a one-day action almost
 * eventless and a long one relentless, and the world does not work either way.
 */
export const TURN_ENCOUNTER_CHANCE = 0.11;

/** Hard ceiling on occurrences from one window, whatever the arithmetic says. */
export const MAX_OCCURRENCES_PER_WINDOW = 6;

/**
 * Probability that one unheard world event turns up on the cultivator.
 *
 * Per FACT, not per day, and that is the whole calibration. The world's own
 * event volume is what should decide how often the world reaches somebody: a
 * quiet decade produces few candidates and few arrivals, a war produces many of
 * both, and nothing has to be tuned twice. A grid-based rate had the opposite
 * property - it made a long seclusion relentless regardless of whether anything
 * was actually happening out there.
 */
export const ARRIVAL_PER_FACT_CHANCE = 0.06;

/**
 * How much a door stops the world, which is much less than it stops the road.
 *
 * A separate exposure from the one above, and the separation is the point.
 * `exposure` asks "did the cultivator walk into something"; a door answers that
 * almost completely. This asks "did something already happening reach here",
 * and a war crossing the valley, a vein failing, or a sect arriving to look for
 * a cave does not care that the cave is shut. Seclusion is 0.55 rather than
 * 0.06 for exactly that reason - it is the mechanism behind "you surface to a
 * world that moved".
 *
 * `sealed` is LOW AND NOT ZERO, and the difference matters more than the size
 * of the number. A shut door is not a ward: a rogue cultivator barges into the
 * cave, somebody arrives at it needing help, a house comes looking. At zero,
 * closed-door seclusion stopped being a trade and became a dominant strategy -
 * everything that can end a run arrives through these tables, so a player who
 * sealed was simply safe, and the correct play was to never open the door.
 *
 * A twentieth of an open seclusion. Over a month it is nothing; over the thirty
 * years somebody actually seals for, something eventually happens, which is the
 * point.
 */
const ARRIVAL_EXPOSURE: Readonly<Record<EncounterActivity, number>> = {
    seclusion: 0.55,
    sealed: 0.03,
    travel: 1,
    abroad: 1.2,
    gathering: 0.9,
    labour: 1.1,
    convalescence: 0.8
};

/**
 * How much of an open seclusion a shut door lets through.
 *
 * Read off the table rather than chosen, because TWO separate systems have to
 * agree about the door: the encounter tables here, and the time-skip's own
 * random events, which run on their own grid and knew nothing about sealing
 * until they were handed this. A second hand-written constant over there
 * would have drifted from this one within a month, and the symptom would have
 * been a door that was airtight in one system and ordinary in the other.
 */
export function sealedDoorFraction(): number {
    return PROFILES.sealed.exposure / PROFILES.seclusion.exposure;
}

export function arrivalExposure(activity: EncounterActivity): number {
    return ARRIVAL_EXPOSURE[activity] ?? 1;
}

// ─────────────────────────────────────────────────────────────────────────
// THE TABLE
// ─────────────────────────────────────────────────────────────────────────

export interface ActivityProfile {
    readonly id: EncounterActivity;
    /** Multiplier on both cadences. Zero means nothing ever happens. */
    readonly exposure: number;
    /** Catalog tags that cannot reach this activity. */
    readonly unreachableTags: readonly string[];
    /** Catalog kinds that cannot reach this activity. */
    readonly unreachableKinds: readonly EncounterKind[];
    /** Relative pull per direction, before the pool is consulted. */
    readonly lean: Readonly<Record<EncounterValence, number>>;
    /** Kinds this activity puts you in the way of, as weight multipliers. */
    readonly kindBias: Readonly<Partial<Record<EncounterKind, number>>>;
}

const PROFILES: Readonly<Record<EncounterActivity, ActivityProfile>> = {
    seclusion: {
        id: 'seclusion',
        exposure: 0.035,
        // Nothing that requires the cultivator to be walking, trading or
        // standing in a crowd. What is left is what comes to a shut door.
        unreachableTags: ['road', 'trade', 'auction', 'ordinary'],
        unreachableKinds: ['commerce'],
        // What finds a sitting cultivator is mostly not good news, and saying
        // so is more honest than an even split would be. It is not one-sided:
        // a vein shifting under the cave and a sect arriving to recruit are
        // both things that happen to somebody who sat still long enough.
        lean: { good: 30, neutral: 20, bad: 50 },
        kindBias: { misfortune: 1.6, spirit_beast: 1.2, sect_event: 1.1, opportunity: 1.1 }
    },
    sealed: {
        id: 'sealed',
        // Rare, and not none. A door changes the odds that somebody gets in and
        // does not decide whether anybody tries. A twelfth of an open
        // seclusion, so a month behind a shut door is quiet and thirty years is
        // not - which is the length people actually seal for.
        //
        // MEASURE THIS AGAINST THE LINE ABOVE, NOT AGAINST ZERO. It was first
        // written as 0.05, which reads small and is HIGHER than the 0.035 an
        // open cave carries - the formation was making the cultivator easier
        // to reach. A fraction is only small next to the thing it is a
        // fraction of.
        exposure: 0.003,
        // A SEALED CAVE IS NOT MORE REACHABLE THAN AN OPEN ONE. These were
        // briefly emptied when the door stopped being a ward, and the result
        // was that sealing let the market caravan in that sitting with the
        // door open kept out - the pool got WIDER as the formation went up.
        // The door's rarity lives in `exposure` above. Everything seclusion
        // cannot reach, this cannot reach either, and the road is doubly out.
        unreachableTags: ['road', 'trade', 'auction', 'ordinary'],
        unreachableKinds: ['commerce'],
        // What DOES get through is skewed, because getting through a formation
        // takes either somebody strong enough not to care or somebody desperate
        // enough to try. The ordinary passer-by is exactly who the door stops.
        lean: { good: 1, neutral: 1, bad: 2 },
        kindBias: { rival_cultivator: 1.5, misfortune: 1.3, sect_event: 1.2 }
    },
    travel: {
        id: 'travel',
        exposure: 1.3,
        unreachableTags: ['auction'],
        unreachableKinds: [],
        lean: { good: 38, neutral: 20, bad: 42 },
        kindBias: { bandits: 1.8, rival_cultivator: 1.3, spirit_beast: 1.3, commerce: 0.7 }
    },
    abroad: {
        id: 'abroad',
        exposure: 1.05,
        // A grave off the road is not something you trip over in a market.
        unreachableTags: ['sealed', 'ruin-only'],
        unreachableKinds: ['grave'],
        lean: { good: 44, neutral: 26, bad: 30 },
        kindBias: { commerce: 2, dao_house: 1.8, sect_event: 1.6, bandits: 0.5, spirit_beast: 0.4 }
    },
    gathering: {
        id: 'gathering',
        exposure: 1.2,
        unreachableTags: ['auction'],
        unreachableKinds: ['commerce'],
        lean: { good: 46, neutral: 18, bad: 36 },
        kindBias: { ruin: 1.6, grave: 1.5, opportunity: 1.6, spirit_beast: 1.4, dao_house: 0.5 }
    },
    labour: {
        id: 'labour',
        exposure: 0.85,
        unreachableTags: ['sealed', 'ruin-only'],
        unreachableKinds: [],
        lean: { good: 40, neutral: 30, bad: 30 },
        kindBias: { commerce: 1.5, dao_house: 1.4, sect_event: 1.2, ruin: 0.6 }
    },
    convalescence: {
        id: 'convalescence',
        exposure: 0.45,
        unreachableTags: ['road', 'sealed', 'ruin-only'],
        unreachableKinds: ['ruin', 'grave'],
        // Lying up wounded is when a debt collector calls and when somebody
        // decides the odds have improved.
        lean: { good: 30, neutral: 26, bad: 44 },
        kindBias: { dao_house: 1.6, misfortune: 1.4, rival_cultivator: 1.3 }
    }
};

export function activityProfile(activity: EncounterActivity): ActivityProfile {
    return PROFILES[activity] ?? PROFILES.abroad;
}

/** Every activity, for the design guards. */
export const ENCOUNTER_ACTIVITIES: readonly EncounterActivity[] =
    Object.keys(PROFILES) as EncounterActivity[];

// ─────────────────────────────────────────────────────────────────────────
// WHERE THEY ARE STANDING
// ─────────────────────────────────────────────────────────────────────────

/**
 * What the place does to the rate.
 *
 * One multiplier off `environment.danger`, which the world layer already
 * maintains per location. Deliberately shallow - a quiet county lane is 0.75
 * and the worst ground in the world is 1.65, a spread of about two. Danger
 * should change WHAT happens far more than HOW OFTEN, and the pool bias below
 * is where that belongs; a steep rate curve here made an ordinary road twice
 * as eventful as a village and buried the composition difference under it.
 * Nothing here reads a place name.
 */
export function placeRateMultiplier(place: EncounterPlace): number {
    const danger = clamp01(place.danger ?? 0.25);
    return 0.75 + 0.9 * danger;
}

/**
 * What the place does to the pool.
 *
 * A ruin puts ruins in front of you; a settlement puts people and paperwork.
 * Keyed off `LocationKind`, which every location already carries, so a new
 * place needs no encounter work at all - it inherits the row for its kind.
 */
const PLACE_KIND_BIAS: Readonly<Record<string, Partial<Record<EncounterKind, number>>>> = {
    settlement: { commerce: 2.2, dao_house: 2, sect_event: 1.5, spirit_beast: 0.3, ruin: 0.6 },
    sect_seat: { sect_event: 3, dao_house: 1.6, rival_cultivator: 1.5, commerce: 1.2, bandits: 0.2 },
    wilds: { spirit_beast: 2.2, bandits: 1.5, opportunity: 1.4, commerce: 0.15, dao_house: 0.2 },
    cave: { ruin: 2, spirit_beast: 1.5, misfortune: 1.3, commerce: 0.1, dao_house: 0.15 },
    ruin: { ruin: 3, grave: 2, misfortune: 1.2, commerce: 0.1, dao_house: 0.15 },
    grave: { grave: 3, ruin: 1.8, commerce: 0.1, dao_house: 0.15 },
    vein: { sect_event: 1.8, rival_cultivator: 1.6, opportunity: 1.5, spirit_beast: 1.4 },
    scar: { misfortune: 2, ruin: 1.5, commerce: 0.2 },
    forbidden_zone: { misfortune: 2, spirit_beast: 1.8, dao_house: 1.5, commerce: 0.1 },
    secret_realm: { ruin: 2.5, opportunity: 2, spirit_beast: 1.6, commerce: 0.05 },
    sealed_domain: { ruin: 2.5, misfortune: 1.5, commerce: 0.05 },
    region: {},
    portal: {},
    // ── INTERIORS ────────────────────────────────────────────────────────
    // Being inside a compound is not being on its ground. There are no
    // bandits in a scripture pavilion and no spirit beasts in a refectory;
    // what is in there is the house, which is why every interior row is
    // dominated by `sect_event` and `rival_cultivator` and has almost no
    // commerce in it - the market is outside the wall by definition.
    precinct: { sect_event: 3.5, rival_cultivator: 2, bandits: 0.05, spirit_beast: 0.1, commerce: 0.3 },
    hall: { sect_event: 3.5, rival_cultivator: 1.8, dao_house: 1.4, bandits: 0.02, spirit_beast: 0.05, commerce: 0.2 },
    // A room cut over a vein is where people meet each other competing for it.
    chamber: { sect_event: 2.5, rival_cultivator: 2.6, opportunity: 1.5, bandits: 0.02, spirit_beast: 0.1, commerce: 0.05 },
    // A shut room has nobody in it. What it has is what is in it.
    vault: { ruin: 2, opportunity: 1.8, misfortune: 1.2, commerce: 0.02, dao_house: 0.1, bandits: 0.02 }
};

export function placeKindBias(place: EncounterPlace): Partial<Record<EncounterKind, number>> {
    return PLACE_KIND_BIAS[place.kind] ?? {};
}

// ─────────────────────────────────────────────────────────────────────────
// REACH
// ─────────────────────────────────────────────────────────────────────────

/**
 * Can this entry get to somebody doing this, here.
 *
 * Only exclusions, and every one of them reads a column the catalog already
 * has. A predicate that needed a new column would be a sign that the exclusion
 * is really a set piece.
 */
export function reaches(
    entry: EncounterEntry,
    activity: EncounterActivity,
    place: EncounterPlace
): boolean {
    const profile = activityProfile(activity);
    if (profile.exposure <= 0) return false;
    if (profile.unreachableKinds.includes(entry.kind)) return false;
    for (const tag of entry.tags) {
        if (profile.unreachableTags.includes(tag)) return false;
    }

    // A sealed pocket has nobody in it and no market outside it. What is left
    // is the site itself, which is the only thing that was ever the hazard.
    if (place.sealed) {
        if (entry.kind === 'commerce' || entry.kind === 'dao_house') return false;
        if (entry.tags.includes('road') || entry.tags.includes('trade')) return false;
    }

    return true;
}

// ─────────────────────────────────────────────────────────────────────────
// WHO KNOWS WHERE YOU ARE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Kinds that need to know your name, or at least your address.
 *
 * A sect messenger, an auditor, a rival with a grudge, a debt collector and a
 * press gang all have to FIND you. A landslide does not, a beast does not, and
 * your own circulation reversing certainly does not. That distinction is the
 * whole of locatability and it needs no new column: the catalog's `kind`
 * already separates the people from the world.
 */
const NEEDS_TO_FIND_YOU: readonly EncounterKind[] = [
    'sect_event',
    'dao_house',
    'rival_cultivator',
    'bandits',
    'commerce'
];

/**
 * Share of the people-shaped entries that get through, by locatability.
 *
 * `hidden` is not zero on purpose. Somebody stumbles across a cave now and
 * again, and a world where disappearing is perfect is a world where the
 * correct play is always to disappear. It is low enough that going somewhere
 * nobody knows is a real and legible choice with a real cost: nothing social
 * reaches you, including the help.
 */
const SOCIAL_REACH: Readonly<Record<Locatability, number>> = {
    known: 1,
    private: 0.45,
    hidden: 0.08
};

export function socialReach(locatability: Locatability): number {
    return SOCIAL_REACH[locatability] ?? SOCIAL_REACH.private;
}

/** True when this entry has to know where somebody is to happen to them. */
export function needsToFindYou(entry: EncounterEntry): boolean {
    return NEEDS_TO_FIND_YOU.includes(entry.kind);
}

/**
 * Whether locatability is even a question for this activity.
 *
 * Standing in a market is being findable, by definition. The question only
 * arises behind a door.
 */
export function locatabilityApplies(activity: EncounterActivity): boolean {
    return activity === 'seclusion' || activity === 'sealed' || activity === 'convalescence';
}

/**
 * Whether this entry stops what the cultivator was doing.
 *
 * The catalog's `interrupts` column is the entry's own answer, and for anybody
 * out in the world it is the whole answer. A shut door is the one thing that
 * changes it, and it changes it in one direction only.
 *
 * A cultivator in seclusion is not participating. Something that came FOR them
 * still gets them up - a body at the mouth of the cave, a formation that
 * failed, their own circulation reversing - because none of that required them
 * to go and look. Everything else did: a sealed hall two valleys over
 * interrupts a traveller because the traveller can walk to it, and does not
 * interrupt somebody sitting in a cave, because they did not. It is reported
 * when they come out, which is what "you surface to a world that moved" is
 * made of.
 *
 * Stated over columns the catalog already has, so a new entry inherits the
 * behaviour without anybody deciding anything about it.
 */
export function interruptsThrough(entry: EncounterEntry, activity: EncounterActivity): boolean {
    if (!entry.interrupts) return false;
    if (activity !== 'seclusion') return true;
    if (entry.tags.includes('unavoidable')) return true;
    if (entry.threatOrdinal !== null) return true;
    return entry.simEventKind === 'qi_deviation' || entry.simEventKind === 'injury_sustained';
}

/** The weight multiplier this activity and place put on an entry's kind. */
export function biasFor(
    entry: EncounterEntry,
    activity: EncounterActivity,
    place: EncounterPlace
): number {
    const fromActivity = activityProfile(activity).kindBias[entry.kind] ?? 1;
    const fromPlace = placeKindBias(place)[entry.kind] ?? 1;
    return fromActivity * fromPlace;
}

function clamp01(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}
