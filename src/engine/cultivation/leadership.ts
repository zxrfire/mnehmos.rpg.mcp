/**
 * Authority inside a house: what a rung can make other people do, and what it costs
 * with the people it does it to.
 */

// AUTHORITY

/**
 * The fraction of a house's ladder above which a rung runs something.
 */
export const ELDER_RUNG_FRACTION = 2 / 3;

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
const ELDER_RUNG_FLOOR = 2;

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

/** Share of the rung below that each rung up holds. A pyramid, not a column. */
export const ROSTER_TAPER = 0.4;

/** How many of a house's people stand at each rung, bottom first. */
export function rosterByRung(houseSize: number, rankCount: number): number[] {
    if (rankCount <= 0 || houseSize <= 0) return [];
    const weights = Array.from({ length: rankCount }, (_, i) => Math.pow(ROSTER_TAPER, i));
    const total = weights.reduce((a, b) => a + b, 0);
    const raw = weights.map(w => (houseSize * w) / total);

    // Everybody has to stand somewhere, and the top rung is one person, not
    // three tenths of one. Round down, place the head, and hand the remainder to
    // the bottom, which is where a house that cannot afford another elder puts
    // people.
    const out = raw.map(r => Math.floor(r));
    out[rankCount - 1] = Math.max(1, out[rankCount - 1]);
    const seated = out.reduce((a, b) => a + b, 0);
    out[0] = Math.max(0, out[0] + (Math.round(houseSize) - seated));
    return out;
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
 * Share of a rung one giver can actually call on, per rung of seniority between
 * them.
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
    return Math.max(0, Math.floor(onTheRung * share));
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

/** Ascending severity. Index into this is the escalation ordering. */
export const BACKLASH_ORDER: readonly BacklashLevel[] = [
    'none',
    'grumbling',
    'obstruction',
    'departure',
    'challenge',
    'removal'
];

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
