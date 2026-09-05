/**
 * How much of the world can reach you while you do a thing. One table rather
 * than a set of branches: `exposure` (against 1.0 for standing in the open),
 * `unreachable` by the catalog's own tags and kinds, and `lean` toward a
 * direction before the entries are looked at.
 *
 * `sealed` has exposure zero and that is load-bearing. Closed-door seclusion is
 * the game's existing bargain - safety bought with every chance that would have
 * found you - and a sealed door produces no occurrences, ever.
 *
 * `seclusion` is the other end and the reason this module exists: at 0.06
 * exposure something finds the cave roughly once every four years, so a
 * twenty-year open-door seclusion is a handful of arrivals and one or two
 * returns of control. That is the intended rate.
 */

import type { EncounterEntry, EncounterKind } from '../../data/cultivation/encounters.js';
import type {
    EncounterActivity,
    EncounterPlace,
    EncounterValence,
    Locatability
} from './types.js';

// CADENCE

/**
 * Days between checks across a long span.
 */
export const ENCOUNTER_GRID_DAYS = 15;

/** Probability of a grid check producing something, at exposure 1.0. */
export const SPAN_ENCOUNTER_CHANCE = 0.18;

/**
 * Probability that the ACT of doing something produces an encounter, at exposure
 * 1.0, independent of how many days it took.
 */
export const TURN_ENCOUNTER_CHANCE = 0.11;

/** Hard ceiling on occurrences from one window, whatever the arithmetic says. */
export const MAX_OCCURRENCES_PER_WINDOW = 6;

/**
 * Probability that one unheard world event turns up on the cultivator.
 */
export const ARRIVAL_PER_FACT_CHANCE = 0.06;

/**
 * How many unheard facts one window may draw against.
 *
 * `ARRIVAL_PER_FACT_CHANCE` is calibrated on the world's EVENT VOLUME, but the
 * list handed here is the unheard BACKLOG, which grows for as long as the run
 * lasts. Measured on 20-year windows, 40 seeds:
 *
 *     pending    sealed cut    open cut    open median days lived
 *           0       3 / 40      30 / 40                     2117
 *          40       5 / 40      38 / 40                     1557
 *         150      11 / 40      40 / 40                      756
 *         400      23 / 40      40 / 40                      256
 *
 * A player who has been alive a while cannot sit. The rest STAY PENDING -
 * nothing is consumed that did not arrive - so the bound is on how much of the
 * backlog can land on one sitting, not on what the world remembers.
 */
export const MAX_ARRIVAL_CANDIDATES = 24;

/**
 * How much a door stops the world, which is much less than it stops the road. A
 * separate exposure from `PROFILES`: that asks whether the cultivator walked
 * into something, this asks whether something already happening reached here.
 *
 * `sealed` is LOW AND NOT ZERO, and the difference matters more than the size.
 * At zero, closed-door seclusion stopped being a trade and became a dominant
 * strategy - everything that can end a run arrives through these tables, so a
 * player who sealed was simply safe.
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
 */
export function sealedDoorFraction(): number {
    return PROFILES.sealed.exposure / PROFILES.seclusion.exposure;
}

/**
 * What is left of the world once you have hidden the door. Not a rate reduction
 * but a RUNG FILTER: after it, only somebody at your own realm or above can find
 * the place at all, so the value of hiding scales with who you are.
 *
 * Read off the ladder's own population shape rather than chosen - the realm
 * bands fall by roughly an order of magnitude as they climb, measured across
 * seeded worlds as 306, 73, 33, 22, 11, 7, 4, 2, 2. Floored, so a hidden door is
 * never perfectly safe: near the top the people who remain are precisely the
 * ones you cannot refuse.
 */
export function concealmentScale(ordinal: number): number {
    // Cumulative share at or above the first rung of each realm, from the
    // measured band counts. Index is the realm, not the rung.
    const AT_OR_ABOVE = [1, 0.335, 0.155, 0.085, 0.045, 0.026, 0.013, 0.008, 0.004];
    const realm = Math.max(0, Math.min(AT_OR_ABOVE.length - 1, Math.floor(ordinal / 4)));
    return Math.max(0.004, AT_OR_ABOVE[realm]);
}

export function arrivalExposure(activity: EncounterActivity): number {
    return ARRIVAL_EXPOSURE[activity] ?? 1;
}

// THE TABLE

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

// WHERE THEY ARE STANDING

/**
 * What the place does to the rate.
 */
export function placeRateMultiplier(place: EncounterPlace): number {
    const danger = clamp01(place.danger ?? 0.25);
    return 0.75 + 0.9 * danger;
}

/**
 * What the place does to the pool.
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
    // INTERIORS
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

// REACH

/**
 * Can this entry get to somebody doing this, here.
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

// WHO KNOWS WHERE YOU ARE

/**
 * Kinds that need to know your name, or at least your address.
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
 */
export function interruptsThrough(entry: EncounterEntry, activity: EncounterActivity): boolean {
    if (!entry.interrupts) return false;
    if (activity !== 'seclusion') return true;
    if (entry.tags.includes('unavoidable')) return true;
    if (entry.threatOrdinal !== null) return true;
    return entry.simEventKind === 'qi_deviation' || entry.simEventKind === 'injury_sustained';
}

// WHO ELSE IS ON THE GROUND, AND WHICH WAY IT CUTS
//
// The design owner's rule: "the encounter rate isn't simply a function of
// people - it's a function of people / people in seclusion." And, separately:
// "two people could fight outside your cave and spill poison gas, so being the
// only cave in an area isn't BAD, especially cuz its concealed."
//
// Those are three different things and they do not move together, which is why
// a single "danger" number could never express any of them correctly:
//
//   TARGETED     somebody comes for YOU. Falls as the place fills up and as
//                more of it sits: nobody walks into a mountain of sealed
//                cultivators to rob one of them. `bandits`, `rival_cultivator`.
//   COLLATERAL   you were simply near something. Rises with how much is
//                HAPPENING - the numerator, not the denominator - because a
//                fight outside your door does not care that you were not in it.
//                `misfortune`, `spirit_beast`.
//   CONCEALMENT  nothing finds you because nothing is looking. Already
//                modelled: `locatability` is `hidden` on undiscovered ground
//                and `locatabilityApplies` gates on it. Not duplicated here.
//
// So a mountain full of sealed cultivators is the slowest ground AND the safest
// from being singled out; a busy unsealed market is poor on rate and the worst
// for collateral; and the only cave in an empty region is close to best on
// every count - which is correct, because FINDING one is the hard part.
//
// DELIBERATELY SMALL. The owner's scoping note: "its not as bad as it looks cuz
// the danger encounter rate in a cave is already low." A sealed door already
// passes about 8.6% of an open cave's rate, and a year behind one is silent
// across 40 seeds. These are modifiers on an already-tiny base, meant to make
// the choice legible and correct in DIRECTION rather than to create a swing.
// Both terms are clamped so a sealed cave can never reach zero - a shut door is
// not a ward, that is committed and tested, and this must not make it one by
// arithmetic.

/** Kinds that come looking for a person. Bounded below by COMPANY_FLOOR. */
const TARGETED_KINDS: ReadonlySet<EncounterKind> = new Set<EncounterKind>([
    'bandits',
    'rival_cultivator'
]);

/** Kinds that were going to happen anyway and you were near them. */
const COLLATERAL_KINDS: ReadonlySet<EncounterKind> = new Set<EncounterKind>([
    'misfortune',
    'spirit_beast'
]);

/**
 * The company a place is keeping, as a headcount the terms below can read.
 */
const COMPANY_FULL_AT = 12;

/** Neither term may move a weight further than this, in either direction. */
const COMPANY_FLOOR = 0.55;
const COMPANY_CEILING = 1.45;

/**
 * What the company on this ground does to one entry's weight.
 */
export function companyEffect(entry: EncounterEntry, place: EncounterPlace): number {
    const company = place.company;
    if (!company) return 1;

    const heads = Math.max(0, company.heads);
    if (heads <= 1) return 1;

    // How full, and how much of it is moving about. `settled` is the
    // denominator the owner named: people in seclusion draw hardest and bother
    // you least.
    const busy = Math.min(1, heads / COMPANY_FULL_AT);
    const settled = Math.max(0, Math.min(1, company.settledShare));
    const moving = busy * (1 - settled);

    if (TARGETED_KINDS.has(entry.kind)) {
        // Mass deters, and mass that is sitting deters most: an intruder there
        // is not picking on one person, they are walking into a house full of
        // them. Scaled by how full the place is so an empty cave is untouched.
        return clampCompany(1 - busy * (0.35 + 0.35 * settled));
    }
    if (COLLATERAL_KINDS.has(entry.kind)) {
        // The numerator. What can spill on you is what is actually happening,
        // which is the people who are OUT - so a hundred sealed cultivators
        // raise this barely at all and a hundred moving ones raise it a lot.
        return clampCompany(1 + moving * 0.45);
    }
    return 1;
}

function clampCompany(n: number): number {
    return Math.max(COMPANY_FLOOR, Math.min(COMPANY_CEILING, n));
}

/** The weight multiplier this activity and place put on an entry's kind. */
export function biasFor(
    entry: EncounterEntry,
    activity: EncounterActivity,
    place: EncounterPlace
): number {
    const fromActivity = activityProfile(activity).kindBias[entry.kind] ?? 1;
    const fromPlace = placeKindBias(place)[entry.kind] ?? 1;
    return fromActivity * fromPlace * companyEffect(entry, place);
}

function clamp01(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}
