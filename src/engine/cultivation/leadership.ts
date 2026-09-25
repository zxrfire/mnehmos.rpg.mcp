/**
 * Authority inside a house: what a rung can make other people do, and what it costs
 * with the people it does it to.
 */

import { A_ROLL_A_PLAYER_COULD_KNOW } from '../world/a-house-raises-its-own.js';

// AUTHORITY

/**
 * The elders are the top three rungs, and never the bottom two. Measured across
 * the catalog when this landed: unchanged for the four four-rung bodies, and
 * correct for all thirty-one that took a grand elder.
 */
export function elderRungOf(rankCount: number): number {
    if (rankCount <= 0) return 0;
    return Math.max(ELDER_RUNG_FLOOR, rankCount - RUNGS_THAT_RUN_SOMETHING);
}

/** Elder, grand elder, head. The three seats that run a house. */
const RUNGS_THAT_RUN_SOMETHING = 3;

/**
 * No house makes an elder of its outer or inner disciples, whatever it calls
 * them, so the elder rung never sits below index 2.
 */
export const ELDER_RUNG_FLOOR = 2;

/** Whether this rung is an elder rung. The top rung is one too. */
export function isElderRank(rankIndex: number, rankCount: number): boolean {
    if (rankCount <= 0) return false;
    return rankIndex >= elderRungOf(rankCount);
}

/**
 * Whether this rung is the head of the house. Named for the position, not for
 * anybody's title: `ranks[rankCount - 1]` is Clan Chief in the Cinder Clan, Abbot
 * in the Quiet Hall, Order Patriarch on the mountain and Seat at the Hollow
 * Court, which is why this must not be called `holdsTheSeat`.
 */
export function isHeadOfHouse(rankIndex: number, rankCount: number): boolean {
    return rankCount > 0 && rankIndex === rankCount - 1;
}

/**
 * The old name, kept so importers migrate as they come free rather than in
 * one sweep through other agents' open files. Prefer `isHeadOfHouse`.
 */
export const holdsTheSeat = isHeadOfHouse;

/**
 * What a rung is, in one word, for the narrator.
 */
export type AuthorityTier = 'ordered' | 'ordering' | 'elder' | 'head';

export function authorityTier(rankIndex: number, rankCount: number): AuthorityTier {
    if (isHeadOfHouse(rankIndex, rankCount)) return 'head';
    if (isElderRank(rankIndex, rankCount)) return 'elder';
    return rankIndex >= 1 ? 'ordering' : 'ordered';
}

export type LeadershipPower =
    | 'order'
    | 'recruit_disciples'
    | 'recruit_elders'
    | 'set_admission'
    | 'set_curriculum'
    | 'expel_elder'
    | 'grow';

/** Cumulative: each tier holds everything the tier below it holds. */
export const POWERS_BY_TIER: Readonly<Record<AuthorityTier, readonly LeadershipPower[]>> = {
    ordered: [],
    ordering: ['order'],
    elder: ['order', 'recruit_disciples'],
    head: [
        'order',
        'recruit_disciples',
        'recruit_elders',
        'set_admission',
        'set_curriculum',
        'expel_elder',
        'grow'
    ]
};

export function powersAt(rankIndex: number, rankCount: number): readonly LeadershipPower[] {
    return POWERS_BY_TIER[authorityTier(rankIndex, rankCount)];
}

export function mayExercise(
    power: LeadershipPower,
    rankIndex: number,
    rankCount: number
): boolean {
    return powersAt(rankIndex, rankCount).includes(power);
}

/**
 * The general rule, in one line: you can order anybody below you on your own
 * house's ladder, and nobody at or above.
 */
export function canOrder(giverRankIndex: number, receiverRankIndex: number): boolean {
    return receiverRankIndex >= 0 && receiverRankIndex < giverRankIndex;
}

// THE SHAPE OF A HOUSE
// A roster is bottom-heavy, which is the only reason authority is worth
// anything: the rung you can send has more people on it than the rung you hold.
//
// ── A LADDER HOLDS TWO KINDS OF RUNG AND THEY DO NOT TAPER ALIKE ──────────
//
// The first version of this tapered every rung the same way, which reads as
// correct and is wrong about half of them. A rank ladder holds:
//
//   BANDS    Outer Disciple, Inner Disciple, Core Disciple - AND ELDER. Many
//            people, and a taper is the right idea: more low than high.
//   POSTS    the grand elder and the head of the house. A post is a CHAIR
//            SOMEBODY SITS IN, not the top slice of a population, so it holds
//            one person and does not grow when the house does.
//
// THE ELDER RUNG IS A BAND, and this file had it in the second list capped at
// three. That caps the RANK. The design owner: *"don't cap the elder rank at
// 3"*, *"cap the elder with offices rank at the # of offices"*. An elder is a
// rank, an office is an elder WITH A POSTING, and it is the postings that are
// finite - a house's office rooms, counted off its own compound and dealt by
// `whoIsInChargeOfWhat`. An elder that deal does not reach is an elder without
// an office, which the doc says is allowed and not a flag.
//
// Tapering a post as though it were a band is what emptied the middle of every
// house in the world. At a taper of 0.4 on a seven-rung ladder, rung 3 got its
// first occupant at a roll of 26 and rung 5 at 162, and a house holds about
// fifteen people - so measured at world open, 60 of 245 rank slots stood empty
// and they were rungs 2 to 5, with 45 of 110 ELDER slots among them. A post
// nobody holds is not a thin roster; it is a house with no punishment elder.
//
// AGENTS.md, "And the shape is a slice, not a triangle", has the ruling: a
// modelled roster is a narrow vertical slice through a sect's pyramid rather
// than the pyramid, because that is the shape of what one person comes to know.
// So every rung a house has gets somebody on it while the house has anybody to
// put there, bands carry the bulk, and the posts above them stay singular.
//
// Which posts a house HAS is read off its own ladder and never assumed:
// `elderRungOf` says where the posts start - the top three rungs, floored at
// index 2, which `sects.ts` states and says nothing may re-derive from a
// fraction - and four bodies carry no grand elder and do not grow one here.
//
// THE PROTECTOR IS NOT ONE OF THESE AND MUST NOT BE SEATED FROM HERE. That
// chair is `protector` on the catalog entry and is deliberately NOT in `ranks`,
// because an office is not a position in an order of precedence. It has its own
// policy, its own occupant and its own vacancy, `house-protector-pairing.ts` is
// what fills it, and `THE_OFFICE` in `false-immortals.ts` is where the empty
// ones are argued: at the top of the world a vacant protector's chair is the
// content rather than a gap, held open for somebody who stopped rather than
// finished. Nothing in this file may fill one.

/**
 * Share of the rung below that each rung up holds.
 *
 * A SLICE IS MUCH FLATTER THAN THE PYRAMID IT WAS CUT FROM, and this was 0.4,
 * which is a pyramid's own curve applied inside one house. The design owner:
 * *"while the sects are a vertical slice, adding it all up still makes a
 * pyramid"* - so the shape is what the houses sum to, and enforcing it again
 * within each house applies it twice. That is what emptied the middle: at 0.4
 * on a seven-rung ladder a rung's share fell under one person by rung 3, so
 * every seat above that had to be forced by arithmetic written for the purpose.
 *
 * What a slice actually is: a few peers, your senior, their senior. More low
 * than high, and nothing like a census. *"Vaguely"*, *"which is enough"*,
 * *"this is a game"*.
 */
export const ROSTER_TAPER = 0.75;

/** How many of a house's people stand at each rung, bottom first. */
export function rosterByRung(houseSize: number, rankCount: number): number[] {
    if (rankCount <= 0 || houseSize <= 0) return [];
    const out = new Array<number>(rankCount).fill(0);
    let left = Math.max(1, Math.round(houseSize));

    const head = rankCount - 1;
    const grandRung = rankCount - 2;
    // `elderRungOf` is the authority on where the elders start; it is clamped
    // here only for a one-rung body, whose single rung is its head.
    const hasGrand = grandRung > Math.min(elderRungOf(rankCount), head);

    // THE ELDER RUNG IS A BAND AND NOT A CHAIR. An elder is a rank and a rank
    // is not slot-limited - a house may have any number of elders. What is
    // finite is the POSTINGS, and an office is an elder with one, so the cap
    // belongs where the postings are dealt: `whoIsInChargeOfWhat` hands out one
    // room per office room the compound actually has, and the elders it does
    // not reach are elders without an office. Nothing here may re-derive that
    // number, and a constant standing in for it was this function's defect.
    //
    // So the only chairs left in this function are the two that really are one
    // person: the head of the house, and the grand elder where a house has one.
    const bands = hasGrand ? grandRung : head;

    // The head's chair, filled while the house has anybody at all: the top rung
    // is one person, not three tenths of one.
    out[head] = 1;
    left -= 1;

    // Then one on each band before anybody stands second on one. This is the
    // slice rule doing the work - a house of fifteen has somebody at most of
    // its rungs rather than a heap at the door.
    for (let rung = 0; rung < bands && left > 0; rung++) { out[rung] = 1; left -= 1; }

    // Then the grand elder's single seat. A house too small to staff it is a
    // house that cannot staff it, which is a real outcome rather than a
    // rounding error.
    if (hasGrand && left > 0) { out[grandRung] = 1; left -= 1; }

    // Everybody else stands on a band, and the taper decides which one.
    if (left > 0) {
        if (bands <= 0) out[0] += left;
        else spreadOverBands(out, bands, left);
    }

    return out;
}

/**
 * Hands the surplus to the bands, bottom-heavy.
 *
 * Largest remainder rather than round-down-and-dump-the-rest-at-the-bottom: the
 * old rounding was the other half of the empty middle, because a rung whose
 * share came out at 0.79 of a person got nobody and its fraction was paid to
 * the bottom rung, which already had the most.
 */
function spreadOverBands(out: number[], bands: number, surplus: number): void {
    const weights = Array.from({ length: bands }, (_, i) => Math.pow(ROSTER_TAPER, i));
    const total = weights.reduce((a, b) => a + b, 0);
    const share = weights.map(w => (surplus * w) / total);

    let placed = 0;
    for (let i = 0; i < bands; i++) { out[i] += Math.floor(share[i]); placed += Math.floor(share[i]); }

    const byFraction = share
        .map((s, i) => ({ i, fraction: s - Math.floor(s) }))
        .sort((a, b) => b.fraction - a.fraction || a.i - b.i);
    for (let k = 0; k < byFraction.length && placed < surplus; k++, placed++) {
        out[byFraction[k].i] += 1;
    }
}

export function rosterAtRung(houseSize: number, rung: number, rankCount: number): number {
    return rosterByRung(houseSize, rankCount)[rung] ?? 0;
}

/**
 * How many people a house of this many rungs holds, before anybody grows it.
 */
export function impliedHouseSize(rankCount: number): number {
    if (rankCount <= 0) return 0;
    let total = 0;
    for (let i = 0; i < rankCount; i++) total += Math.pow(1 / ROSTER_TAPER, i);
    return Math.round(total);
}

/**
 * Share of the people one person can keep track of that each rung of seniority
 * buys them, and it is a share of THAT rather than of the rung.
 *
 * RETUNED WHEN `houseSize` STOPPED MEANING THE SLICE. It was a share of the
 * rung below, which is a fraction of a person while the house is the dozen the
 * world models and a crowd once the house is its real size: measured on the
 * Azure Cloud Pavilion, one rung of seniority bought 1 person at a house of 19
 * and 46 at its real 574, and its head 5 against 187. Neither is an order
 * somebody gives - the first is nobody and the second is a small army.
 *
 * What actually bounds it is the giver, not the house: you can send people you
 * know, and `A_ROLL_A_PLAYER_COULD_KNOW` is this world's own figure for how
 * many that is - *"even if it's huge, you only know like 10-20 people tops"*.
 * So seniority buys a share of that, and the rung's own population is the cap,
 * which is what keeps a small house small. Four rungs of gap reaches everybody
 * you know; at the Pavilion's real size one rung now buys 3 and its head 15.
 */
export const CALL_FRACTION_PER_RUNG = 0.25;

/** Hands a giver at this rung can send from that rung, at most. */
export function commandableHands(
    giverRankIndex: number,
    toRankIndex: number,
    houseSize: number,
    rankCount: number
): number {
    if (!canOrder(giverRankIndex, toRankIndex)) return 0;
    const onTheRung = rosterAtRung(houseSize, toRankIndex, rankCount);
    const gap = giverRankIndex - toRankIndex;
    const share = Math.min(1, CALL_FRACTION_PER_RUNG * gap);
    return Math.max(0, Math.min(onTheRung, Math.floor(A_ROLL_A_PLAYER_COULD_KNOW * share)));
}

// ERRANDS
// What ordering somebody actually buys, which is their time instead of yours.
// The herbs get gathered while the player cultivates, and time is the currency
// this whole game runs on.

export type Errand = 'gather' | 'carry' | 'labour';

export interface ErrandProfile {
    /** Units one pair of hands delivers in one day at the bottom rung. */
    perHandDay: number;
    /** Standing spent per hand-day. People notice being used. */
    standingPerHandDay: number;
    /** What a unit is, so the caller knows what to credit. */
    unit: string;
    description: string;
}

export const ERRANDS: Readonly<Record<Errand, ErrandProfile>> = {
    gather: {
        perHandDay: 0.05,
        standingPerHandDay: 0.02,
        unit: 'herb',
        description:
            'Sent out for herbs. Twenty hand-days a plant, because most of foraging is walking. What comes back is bounded by where that rung can survive standing about, which is why a servant returns qi grass and an inner disciple returns something worth refining.'
    },
    carry: {
        perHandDay: 0.3,
        standingPerHandDay: 0.015,
        unit: 'spirit stone',
        description:
            'Haulage for the house, which pays badly and pays reliably. The oldest thing a sect has ever asked of anyone, and the cheapest in goodwill because everybody understands it.'
    },
    labour: {
        perHandDay: 0.08,
        standingPerHandDay: 0.025,
        unit: 'contribution',
        description:
            'Work booked against your own name: the wall repaired, the beds turned, the yard swept. It is the house that credits it, and the house credits the rung that ordered it, which is exactly why it is the dearest of the three in goodwill.'
    }
};

/** How much more a senior rung delivers per hand-day than the bottom one. */
export const RUNG_OUTPUT_STEP = 0.5;

export interface ErrandOrder {
    errand: Errand;
    hands: number;
    days: number;
    /** Rung the order is given to. */
    toRankIndex: number;
}

export interface ErrandResult {
    handDays: number;
    /** Units delivered if the order is carried out in full. */
    delivered: number;
    /** Standing this order spends, before any discount for a following. */
    standingCost: number;
}

/**
 * What an order is worth and what it costs, before backlash.
 */
export function resolveErrand(order: ErrandOrder): ErrandResult {
    const profile = ERRANDS[order.errand];
    const hands = Math.max(0, Math.floor(order.hands));
    const days = Math.max(0, Math.floor(order.days));
    const handDays = hands * days;
    const rungBonus = 1 + Math.max(0, order.toRankIndex) * RUNG_OUTPUT_STEP;
    return {
        handDays,
        delivered: Math.floor(handDays * profile.perHandDay * rungBonus),
        standingCost: handDays * profile.standingPerHandDay
    };
}

/**
 * What fraction of an order gets done anyway when the rung below is obstructing.
 */
export const OBSTRUCTED_DELIVERY_FRACTION = 0.25;

// STANDING

/** Credit at its best. Nobody is more popular than this. */
export const STANDING_CEILING = 100;
/** Below this nothing gets worse, because everything has already happened. */
export const STANDING_FLOOR = -120;
/** What a new member has with the people below them, which is nothing owed. */
export const STANDING_ON_JOINING = 50;
/** Recovered per in-world year of not spending it. Slow on purpose. */
export const STANDING_PER_YEAR = 1.5;

export function clampStanding(standing: number): number {
    return Math.max(STANDING_FLOOR, Math.min(STANDING_CEILING, standing));
}

/** What time alone repairs. A house forgets slowly and never entirely. */
export function standingAfterYears(standing: number, years: number): number {
    return clampStanding(standing + Math.max(0, years) * STANDING_PER_YEAR);
}

/**
 * How much of a cost a personal following absorbs, and the share past which it
 * stops helping.
 */
export const FOLLOWING_SHIELD = 0.9;
export const SHIELD_SHARE_CAP = 0.6;

export function followingShare(following: number, houseSize: number): number {
    if (houseSize <= 0) return 0;
    return Math.max(0, Math.min(1, following / houseSize));
}

/** What an act actually costs this cultivator, given who in the house is theirs. */
export function shieldedCost(rawCost: number, ownFollowing: number, houseSize: number): number {
    const share = Math.min(SHIELD_SHARE_CAP, followingShare(ownFollowing, houseSize));
    return Math.max(0, rawCost) * (1 - FOLLOWING_SHIELD * share);
}

// FOLLOWINGS
// Who brought whom in. The link matters more than the individuals.

export interface ElderFollowing {
    /** Member id, or a synthetic id for an elder taken on from outside. */
    id: string;
    rankIndex: number;
    /** Disciples in this elder's line. */
    following: number;
    /** Whether the house made them or the head of the house bought them in. */
    source: 'house' | 'outside';
}

/** How much harder seniority pulls when a house's intake is divided up. */
export const FOLLOWING_SENIORITY_EXPONENT = 2;

/**
 * Divide a house's unattached disciples among its elders.
 */
export function distributeFollowing(
    elderRungs: readonly number[],
    unattached: number
): number[] {
    if (elderRungs.length === 0) return [];
    const people = Math.max(0, Math.floor(unattached));
    const weights = elderRungs.map(r =>
        Math.pow(Math.max(0, r) + 1, FOLLOWING_SENIORITY_EXPONENT)
    );
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) return elderRungs.map(() => 0);

    const out = weights.map(w => Math.floor((people * w) / total));
    // The remainder goes to the most senior, which is how it goes.
    let remainder = people - out.reduce((a, b) => a + b, 0);
    const order = elderRungs
        .map((r, i) => ({ r, i }))
        .sort((a, b) => b.r - a.r || a.i - b.i);
    for (let k = 0; remainder > 0; k = (k + 1) % order.length) {
        out[order[k].i] += 1;
        remainder -= 1;
    }
    return out;
}

// WHAT THE ACTS COST
// Every number here is a statement about whose life's work is being touched.

export type LeadershipAct =
    | 'order'
    | 'recruit_disciples'
    | 'recruit_elders'
    | 'set_admission'
    | 'set_curriculum'
    | 'expel_elder'
    | 'grow'
    /**
     * Being asked and saying no, which is the only act on this list that the bottom
     * rung can perform.
     */
    | 'refuse';

export interface ActCost {
    act: LeadershipAct;
    /** Standing, before the discount a personal following buys. */
    standingCost: number;
    /** Standing earned rather than spent. Growth is the only source. */
    standingEarned: number;
    /** In-world years before the act is done being done. */
    years: number;
    /** Whose work this is, in one line, for the narrator. */
    insult: string;
}

/** Standing per ordinal the admission bar moves, in either direction. */
export const COST_PER_ADMISSION_ORDINAL = 6;
/** Years before a changed standard has actually changed who is in the house. */
export const ADMISSION_YEARS = 3;

/**
 * The recruitment standard, and why moving it either way is an insult.
 */
export function admissionChangeCost(from: number, to: number): ActCost {
    const moved = Math.abs(Math.round(to) - Math.round(from));
    const raising = to > from;
    return {
        act: 'set_admission',
        standingCost: moved * COST_PER_ADMISSION_ORDINAL,
        standingEarned: 0,
        years: moved === 0 ? 0 : ADMISSION_YEARS,
        insult: raising
            ? 'Every disciple admitted under the old bar has just been told, in writing, that they would not be admitted now.'
            : 'Every elder who cleared the old bar has just watched the only distinction they hold be handed to the next person through the gate.'
    };
}

/**
 * The highest bar a house can set without stranding its own top rung.
 */
export function admissionCeilingFor(
    rankCount: number,
    ordinalsPerRank: number,
    maxOrdinal: number
): number {
    return Math.max(0, maxOrdinal - Math.max(0, rankCount - 1) * ordinalsPerRank);
}

/** Standing per method added to the working library. Cheap; it takes nothing away. */
export const COST_PER_METHOD_ADDED = 4;
/** Standing per method retired. Somebody has taught that for a century. */
export const COST_PER_METHOD_RETIRED = 14;
/** On top, for retiring the art the house is known for. */
export const COST_SIGNATURE_RETIRED = 30;
/**
 * Years before a changed curriculum is what the house is.
 */
export const CURRICULUM_GENERATION_YEARS = 30;

export function curriculumChangeCost(
    current: readonly string[],
    next: readonly string[],
    signatureTechniqueId: string | null
): ActCost {
    const before = new Set(current);
    const after = new Set(next);
    const added = [...after].filter(id => !before.has(id));
    const retired = [...before].filter(id => !after.has(id));
    const droppedSignature =
        signatureTechniqueId !== null &&
        before.has(signatureTechniqueId) &&
        !after.has(signatureTechniqueId);

    const standingCost =
        added.length * COST_PER_METHOD_ADDED +
        retired.length * COST_PER_METHOD_RETIRED +
        (droppedSignature ? COST_SIGNATURE_RETIRED : 0);

    return {
        act: 'set_curriculum',
        standingCost,
        standingEarned: 0,
        years: standingCost === 0 ? 0 : CURRICULUM_GENERATION_YEARS,
        insult: droppedSignature
            ? 'The art the house is known for has been struck off its own library list. Every elder who teaches it has been told what the rest of their career is for.'
            : retired.length > 0
                ? 'A scripture somebody has taught for their whole life is no longer taught here, and they were not asked.'
                : 'A new manual on the shelf, which costs nobody anything except the certainty that the shelf was finished.'
    };
}

/** Standing for the first elder brought in from outside. */
export const COST_PER_EXTERNAL_ELDER = 18;
/** Multiplier per elder already bought in. The insult compounds. */
export const EXTERNAL_ELDER_ESCALATION = 1.5;
/** Years to find one, negotiate, and install them. */
export const EXTERNAL_ELDER_YEARS = 2;

/**
 * Hiring an elder from outside, which is its own specific insult: there was an
 * internal candidate, and the house has just been told what they are worth.
 */
export function externalElderCost(count: number, alreadyRecruited: number): ActCost {
    const wanted = Math.max(0, Math.floor(count));
    let standingCost = 0;
    for (let i = 0; i < wanted; i++) {
        standingCost +=
            COST_PER_EXTERNAL_ELDER *
            Math.pow(EXTERNAL_ELDER_ESCALATION, Math.max(0, alreadyRecruited) + i);
    }
    return {
        act: 'recruit_elders',
        standingCost,
        standingEarned: 0,
        years: wanted * EXTERNAL_ELDER_YEARS,
        insult:
            'There was somebody inside who had waited thirty years for that place, and the house has been told in public what the waiting was worth.'
    };
}

/** Standing for dismissing an elder with nobody behind them. */
export const BASE_EXPULSION_COST = 22;
/** How much the elder's share of the house multiplies that. */
export const EXPULSION_FOLLOWING_WEIGHT = 2.5;
/** Multiplier per elder already dismissed. The rest can count. */
export const EXPULSION_ESCALATION = 1.6;

/**
 * Firing an elder.
 */
export function expulsionCost(
    following: number,
    houseSize: number,
    alreadyExpelled: number
): ActCost {
    const share = followingShare(following, houseSize);
    const standingCost =
        BASE_EXPULSION_COST *
        (1 + EXPULSION_FOLLOWING_WEIGHT * share) *
        Math.pow(EXPULSION_ESCALATION, Math.max(0, alreadyExpelled));
    return {
        act: 'expel_elder',
        standingCost,
        standingEarned: 0,
        years: 0,
        insult:
            share > 0.25
                ? 'A third of the yard answers to that man, and the yard has just watched him walk out of the gate with a letter.'
                : 'Every elder left standing has just learned the terms on which they hold their own place.'
    };
}

// GROWTH
// The one act that earns standing, which is why it is slow and expensive.

/**
 * Who does the recruiting, which is the best decision available to a leader.
 */
export type GrowthChannel = 'head' | 'elders';

/** Share of the house one leader can add per decade, recruiting alone. */
export const INTAKE_PER_DECADE_HEAD = 0.08;
/** Share the elders can add per decade when it is handed to them. */
export const INTAKE_PER_DECADE_ELDERS = 0.22;
/** Months of entry stipend a new intake is carried before they are worth anything. */
export const GROWTH_MONTHS_CARRIED = 120;
/** Extra intake per method in the working library. A wider door draws more people. */
export const INTAKE_PER_METHOD = 0.02;
/** Standing earned per recruit brought in personally. */
export const STANDING_PER_RECRUIT_BY_HEAD = 1.2;
/** Standing earned per recruit when the elders did it and everybody knows. */
export const STANDING_PER_RECRUIT_BY_ELDERS = 0.4;

export interface GrowthPlan {
    channel: GrowthChannel;
    intake: number;
    stonesRequired: number;
    years: number;
    standingEarned: number;
    /** Where the new people attach. The whole of the trade. */
    attachesTo: 'the leader' | 'the elders';
}

/**
 * What a decade of deliberate growth costs and returns.
 */
export function planGrowth(
    houseSize: number,
    entryStipend: number,
    methodCount: number,
    decades: number,
    channel: GrowthChannel
): GrowthPlan {
    const periods = Math.max(0, Math.floor(decades));
    const base = channel === 'head' ? INTAKE_PER_DECADE_HEAD : INTAKE_PER_DECADE_ELDERS;
    const rate = base + Math.max(0, methodCount) * INTAKE_PER_METHOD;

    let size = Math.max(0, houseSize);
    let intake = 0;
    for (let d = 0; d < periods; d++) {
        const added = Math.max(size > 0 ? 1 : 0, Math.floor(size * rate));
        intake += added;
        size += added;
    }

    return {
        channel,
        intake,
        stonesRequired: Math.round(intake * Math.max(0, entryStipend) * GROWTH_MONTHS_CARRIED),
        years: periods * 10,
        standingEarned:
            intake *
            (channel === 'head' ? STANDING_PER_RECRUIT_BY_HEAD : STANDING_PER_RECRUIT_BY_ELDERS),
        attachesTo: channel === 'head' ? 'the leader' : 'the elders'
    };
}

/** Years to find, vet and place one disciple in a house that admits at nothing. */
export const RECRUIT_BASE_YEARS = 1;
/**
 * Additional years per ordinal of the house's own admission bar.
 */
export const RECRUIT_YEARS_PER_ADMISSION_ORDINAL = 0.5;

export interface IntakePlan {
    count: number;
    years: number;
    stonesRequired: number;
}

/**
 * Taking disciples in under your own line, which is what an elder rung is for.
 */
export function planDiscipleIntake(
    count: number,
    admissionOrdinal: number,
    entryStipend: number
): IntakePlan {
    const heads = Math.max(0, Math.floor(count));
    const perHead =
        RECRUIT_BASE_YEARS +
        Math.max(0, admissionOrdinal) * RECRUIT_YEARS_PER_ADMISSION_ORDINAL;
    return {
        count: heads,
        years: heads * perHead,
        stonesRequired: Math.round(heads * Math.max(0, entryStipend) * GROWTH_MONTHS_CARRIED)
    };
}

/**
 * Whether the head of the house holds it when they are challenged.
 */
export function challengeOutcome(
    defenderOrdinal: number,
    strongestChallengerOrdinal: number
): { held: boolean; margin: number } {
    return {
        held: defenderOrdinal > strongestChallengerOrdinal,
        margin: defenderOrdinal - strongestChallengerOrdinal
    };
}

/** Rungs of `powerOrdinal` a house may drift from where the catalog left it. */
export const MAX_POWER_DRIFT = 4;

/**
 * What a change in size does to how hard the house hits.
 */
export function powerOrdinalDrift(size: number, baseSize: number): number {
    if (size <= 0 || baseSize <= 0) return 0;
    const rungs = Math.round(Math.log2(size / baseSize));
    return Math.max(-MAX_POWER_DRIFT, Math.min(MAX_POWER_DRIFT, rungs));
}

// BACKLASH

export type BacklashLevel =
    | 'none'
    | 'grumbling'
    | 'obstruction'
    | 'departure'
    | 'challenge'
    | 'removal';

/** Standing at or below which each level begins. Strictly descending. */
export const GRUMBLING_AT = 20;
export const OBSTRUCTION_AT = 0;
export const DEPARTURE_AT = -30;
export const CHALLENGE_AT = -60;
export const REMOVAL_AT = -90;

/**
 * Where the house currently is, read straight off standing.
 */
export function backlashLevel(standing: number, hasPatron: boolean): BacklashLevel {
    if (hasPatron && standing <= REMOVAL_AT) return 'removal';
    if (standing <= CHALLENGE_AT) return 'challenge';
    if (standing <= DEPARTURE_AT) return 'departure';
    if (standing <= OBSTRUCTION_AT) return 'obstruction';
    if (standing <= GRUMBLING_AT) return 'grumbling';
    return 'none';
}

/**
 * How far into a level the house has gone, as a fraction. Used to make the
 * consequences graduated rather than a step function.
 */
export const OBSTRUCTION_RAMP_EXPONENT = 1;

/**
 * Odds an order is not carried out.
 */
export function obstructionChance(standing: number): number {
    if (standing > OBSTRUCTION_AT) return 0;
    const span = OBSTRUCTION_AT - DEPARTURE_AT;
    const depth = Math.min(1, (OBSTRUCTION_AT - standing) / span);
    return Math.max(0, Math.min(1, Math.pow(depth, OBSTRUCTION_RAMP_EXPONENT)));
}

/**
 * Who walks, read off state rather than rolled.
 */
export function departureDepth(standing: number): number {
    if (standing > DEPARTURE_AT) return 0;
    const span = DEPARTURE_AT - CHALLENGE_AT;
    return Math.max(0, Math.min(1, (DEPARTURE_AT - standing) / span));
}

export function departuresAt(
    standing: number,
    elders: readonly ElderFollowing[]
): { leaving: ElderFollowing[]; disciplesLost: number } {
    const depth = departureDepth(standing);
    if (depth <= 0 || elders.length === 0) {
        return { leaving: [], disciplesLost: 0 };
    }
    const count = Math.min(elders.length, Math.max(1, Math.ceil(elders.length * depth)));

    const leaving = [...elders]
        .sort((a, b) => b.following - a.following || a.id.localeCompare(b.id))
        .slice(0, count);
    return {
        leaving,
        disciplesLost: leaving.reduce((sum, e) => sum + Math.max(0, e.following), 0)
    };
}

export interface HouseState {
    /** Standing this cultivator holds with the people below them, in this house. */
    standing: number;
    /** Every elder in the house except the cultivator, with their followings. */
    elders: readonly ElderFollowing[];
    /** Everybody in the house, elders included. */
    houseSize: number;
    /** Disciples this cultivator personally brought in. Their armour. */
    ownFollowing: number;
    /** Whether somebody stands above this house and can simply replace its head. */
    hasPatron: boolean;
    /**
     * Whether this cultivator is the head of the house.
     */
    isHead: boolean;
}

export interface ActOutcome {
    act: LeadershipAct;
    standingBefore: number;
    /** Cost after the discount the cultivator's own following buys. */
    standingSpent: number;
    standingEarned: number;
    standingAfter: number;
    level: BacklashLevel;
    /** Odds the thing is simply not done. The caller rolls it. */
    obstructionChance: number;
    /** Read off state, not rolled. Empty until the departure threshold. */
    eldersLeaving: readonly ElderFollowing[];
    disciplesLeaving: number;
    /** Disciples of the cultivator's own line who walk. The lower-rung version. */
    ownFollowingLost: number;
    headChallenged: boolean;
    removedByPatron: boolean;
    /** The house dismisses a rung nobody below it will work for. */
    dismissedFromTheHouse: boolean;
    years: number;
    insult: string;
}

/**
 * Price an act, spend the standing, and report what the house does about it.
 */
export function resolveAct(house: HouseState, cost: ActCost): ActOutcome {
    const spent = shieldedCost(cost.standingCost, house.ownFollowing, house.houseSize);
    const standingAfter = clampStanding(
        house.standing - spent + Math.max(0, cost.standingEarned)
    );
    const level = backlashLevel(standingAfter, house.hasPatron && house.isHead);
    const departures = house.isHead
        ? departuresAt(standingAfter, house.elders)
        : { leaving: [], disciplesLost: 0 };

    return {
        act: cost.act,
        standingBefore: house.standing,
        standingSpent: spent,
        standingEarned: Math.max(0, cost.standingEarned),
        standingAfter,
        level,
        obstructionChance: obstructionChance(standingAfter),
        eldersLeaving: departures.leaving,
        disciplesLeaving: departures.disciplesLost,
        ownFollowingLost: house.isHead
            ? 0
            : Math.floor(Math.max(0, house.ownFollowing) * departureDepth(standingAfter)),
        headChallenged: house.isHead && standingAfter <= CHALLENGE_AT,
        removedByPatron:
            house.isHead && house.hasPatron && standingAfter <= REMOVAL_AT,
        dismissedFromTheHouse: !house.isHead && standingAfter <= CHALLENGE_AT,
        years: Math.max(0, cost.years),
        insult: cost.insult
    };
}

// SAYING NO

/**
 * How bad the house wrote it down as.
 */
export type RefusalSeverity = 'slight' | 'serious' | 'grave' | 'unforgivable';

/**
 * What being turned down costs the person who did it, by the band the house itself
 * wrote on the ask.
 */
export const REFUSAL_COST_BY_SEVERITY: Readonly<Record<RefusalSeverity, number>> = {
    slight: 6,
    serious: 14,
    grave: 30,
    unforgivable: 60
};

/**
 * Price a refusal as an act, so being turned down and being obeyed run on one
 * spine - the same reason {@link errandCost} exists. None of it is free and none
 * of it is instant, which is the two things the design owner asked for: standing
 * must move down, and one bad day must not be the end of a membership.
 * `shieldedCost` still applies on top.
 */
export function refusalCost(
    severity: RefusalSeverity,
    /**
     * Whether the house asked for this person by name, or they signed for it off a
     * wall.
     */
    origin: 'summons' | 'commission'
): ActCost {
    return {
        act: 'refuse',
        standingCost: REFUSAL_COST_BY_SEVERITY[severity],
        standingEarned: 0,
        years: 0,
        insult: origin === 'summons'
            ? 'Somebody was sent to ask you by name, went back without you, and had to say so out loud to the person who sent them.'
            : 'You put your name to it and the work went undone, which the people who covered it will know about before you are back through the gate.'
    };
}

/** Price an errand as an act, so ordering and governing run on one spine. */
export function errandCost(errand: Errand, result: ErrandResult): ActCost {
    return {
        act: 'order',
        standingCost: result.standingCost,
        standingEarned: 0,
        years: 0,
        insult:
            ERRANDS[errand].unit === 'contribution'
                ? 'The work is booked against your name and done with somebody else\'s back.'
                : 'People notice being used, and the rung below keeps its own count.'
    };
}

/**
 * What a leader can still afford, given where their standing sits.
 *
 * Exposed so a tool can answer "what would this cost me" without committing to
 * anything, which is the difference between a decision and a surprise.
 */
export function affordable(house: HouseState, cost: ActCost): {
    spends: number;
    wouldLandAt: number;
    wouldTrigger: BacklashLevel;
    safe: boolean;
} {
    const spends = shieldedCost(cost.standingCost, house.ownFollowing, house.houseSize);
    const wouldLandAt = clampStanding(
        house.standing - spends + Math.max(0, cost.standingEarned)
    );
    const wouldTrigger = backlashLevel(wouldLandAt, house.hasPatron && house.isHead);
    return {
        spends,
        wouldLandAt,
        wouldTrigger,
        safe: wouldLandAt > OBSTRUCTION_AT
    };
}
