/**
 * Authority inside a house: what a rung can make other people do, and what it
 * costs with the people it does it to.
 *
 * Found by playtesting, twice over. A cultivator driven to the top rung of a
 * sect could do nothing with it - "I order the disciples to gather herbs"
 * routed to a personal foraging action and the head of the house went and
 * picked herbs himself, "I expel an elder" did not parse, and `promote` refused
 * a further step with `at_highest_rank` and left nothing behind that refusal.
 * The top of the ladder was a title and a bigger stipend.
 *
 * ── THE GENERAL RULE ──────────────────────────────────────────────────────
 *
 * AUTHORITY IS THE RANK INDEX, AND IT REACHES EVERY LOWER ONE IN THE SAME
 * HOUSE. Not a tier table with special cases. An Outer Disciple can send
 * servants; an Inner Disciple can send outer disciples and servants; the head
 * of the house can send anybody. That single rule is the first thing membership
 * actually buys, and it arrives at rung one rather than at the end of a run.
 *
 * Two additions sit on top of it, both derived from the ladder rather than
 * hardcoded, because houses here run three rungs to six and the elder rung sits
 * at a different index in each:
 *
 *   ELDER RUNGS       may take disciples in under their own line.
 *   THE TOP RUNG      may set the recruitment standard, change the foundational
 *                     methods, hire and fire elders, and grow the house.
 *
 * `ELDER_RUNG_FRACTION` is the same two thirds `canReachReserves` uses in
 * `embezzlement.ts`, and that is not a coincidence worth hiding: the rungs that
 * can sign for the reserves are the rungs that run something. Checked against
 * the catalog it lands exactly on Dew Elder, Sword Elder, Road Elder and the
 * Hollow Court's Elder without a single special case.
 *
 * ── STANDING IS THE RESOURCE, AND IT IS ONE RESOURCE ──────────────────────
 *
 * Every act here is an act against people. Ordering somebody spends a little of
 * what they think of you. Raising the admission bar insults everyone who came
 * in under the old one; lowering it insults everyone who thinks the house is
 * being cheapened. Retiring a foundational method tells every elder who teaches
 * it that their life's work is being wound up. Bringing an elder in from
 * outside tells the internal candidate what they are worth. Firing one tells
 * the rest they can be next.
 *
 * So there is one number per house per cultivator - credit with the people
 * below you - and it is spent by an Outer Disciple sending servants for herbs
 * and by a Sect Warden retiring a scripture, on the same scale, against the
 * same escalation.
 *
 * ── FOLLOWINGS ARE WHY ANY OF THIS HAS ARITHMETIC ─────────────────────────
 *
 * Because elders recruit, every elder has a following, and its size is a real
 * number. Three things fall out of that and they are the load-bearing half of
 * the design:
 *
 *   FIRING AN ELDER COSTS YOU THEIR DISCIPLES. They do not leave alone.
 *   Dismissing one who brought in forty people is not the same act as
 *   dismissing one who brought in two, and the player can price both before
 *   acting.
 *
 *   AN ELDER'S WEIGHT AGAINST YOU IS THEIR FOLLOWING. A house where one elder
 *   recruited half the roster has a head who cannot touch them. That is a
 *   genuinely interesting seat to inherit and it needed no new state to say.
 *
 *   YOUR OWN FOLLOWING IS YOUR ARMOUR. Every cost here is discounted by the
 *   share of the house you personally brought in, which is the whole reason to
 *   spend decades as an elder recruiting before making a bid for the seat.
 *   Growth can be done from the seat, slowly and to your own credit, or handed
 *   to the elders, which is faster and builds exactly the power base that will
 *   later refuse you. That trade is the best decision in this file.
 *
 * ── BACKLASH IS GRADUATED, AND IT ESCALATES ───────────────────────────────
 *
 *   grumbling     nothing happens yet. This is the telegraph, and it fires
 *                 while standing is still positive so nobody is ambushed.
 *   obstruction   the order is simply not carried out, or is carried out
 *                 slowly. The only rung of the ladder that is a roll, and the
 *                 odds come from accumulated standing rather than a table.
 *   departure     elders leave and take their followings with them, which
 *                 shrinks the house the leader was trying to grow. Read off
 *                 state: the elders with the largest followings go first,
 *                 because an elder with somewhere to go is the one who can
 *                 afford to walk.
 *   challenge     the seat is challenged. Deterministic at its threshold.
 *   removal       the patron replaces you, and there is no fight to win.
 *
 * The last rung is why the governance stack matters. A head who answers to
 * somebody has one more and worse thing above them than a head who does not:
 * an apex or an unbacked house tops out at a challenge, which can be survived,
 * and a client sect tops out at a letter, which cannot.
 *
 * ── NONE OF IT IS INSTANT ─────────────────────────────────────────────────
 *
 * Time is the other cost and it is charged per act. An expulsion lands the day
 * it is spoken, which is exactly why it is the dearest thing in the file to pay
 * for. Changing what a house teaches is generational and does not reach the
 * house's own strength for `CURRICULUM_GENERATION_YEARS`, because the effect of
 * a curriculum is the intake raised on it.
 *
 * Pure throughout. State in, deltas out, no I/O, no rolls: the caller supplies
 * the seeded stream for the one place a roll is needed.
 */

// ═══════════════════════════════════════════════════════════════════════════
// AUTHORITY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The fraction of a house's ladder above which a rung runs something.
 *
 * Two thirds, matching the rung the reserves open at, and expressed as a
 * fraction because "the elders" has to mean the same thing in a four-rung court
 * and a six-rung pavilion.
 */
export const ELDER_RUNG_FRACTION = 2 / 3;

/** Lowest rung index that counts as an elder in a ladder of this length. */
export function elderRungOf(rankCount: number): number {
    if (rankCount <= 0) return 0;
    return Math.ceil((rankCount - 1) * ELDER_RUNG_FRACTION);
}

/** Whether this rung is an elder rung. The top rung is one too. */
export function isElderRank(rankIndex: number, rankCount: number): boolean {
    if (rankCount <= 0) return false;
    return rankIndex >= elderRungOf(rankCount);
}

/** Whether this rung is the head of the house. */
export function holdsTheSeat(rankIndex: number, rankCount: number): boolean {
    return rankCount > 0 && rankIndex === rankCount - 1;
}

/**
 * What a rung is, in one word, for the narrator.
 *
 *   ordered   the bottom rung. Everybody above can send you somewhere.
 *   ordering  can send the rungs below and nothing more.
 *   elder     the above, and takes disciples in under their own line.
 *   seat      the above, and the standard, the methods, and who is an elder.
 */
export type AuthorityTier = 'ordered' | 'ordering' | 'elder' | 'seat';

export function authorityTier(rankIndex: number, rankCount: number): AuthorityTier {
    if (holdsTheSeat(rankIndex, rankCount)) return 'seat';
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
    seat: [
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

// ═══════════════════════════════════════════════════════════════════════════
// THE SHAPE OF A HOUSE
// A roster is bottom-heavy, which is the only reason authority is worth
// anything: the rung you can send has more people on it than the rung you hold.
// ═══════════════════════════════════════════════════════════════════════════

/** Share of the rung below that each rung up holds. A pyramid, not a column. */
export const ROSTER_TAPER = 0.4;

/** How many of a house's people stand at each rung, bottom first. */
export function rosterByRung(houseSize: number, rankCount: number): number[] {
    if (rankCount <= 0 || houseSize <= 0) return [];
    const weights = Array.from({ length: rankCount }, (_, i) => Math.pow(ROSTER_TAPER, i));
    const total = weights.reduce((a, b) => a + b, 0);
    const raw = weights.map(w => (houseSize * w) / total);

    // Everybody has to stand somewhere, and the top rung is one person, not
    // three tenths of one. Round down, seat the head, and hand the remainder to
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
 *
 * The member catalog is a named cast rather than a census - eight people at the
 * Azure Cloud Pavilion, three at the Azure Dew Sect - and a head count taken
 * from it would say that a sect running four villages is three people. So the
 * census is derived from the ladder instead, by the same taper the roster uses,
 * with exactly one person on the top rung. A five-rung house comes out around
 * sixty and a six-rung house around a hundred and fifty, which is the right
 * order of magnitude for a world where a sect describes itself as having eleven
 * disciples and a courtyard cut for two hundred.
 */
export function impliedHouseSize(rankCount: number): number {
    if (rankCount <= 0) return 0;
    let total = 0;
    for (let i = 0; i < rankCount; i++) total += Math.pow(1 / ROSTER_TAPER, i);
    return Math.round(total);
}

/**
 * Share of a rung one giver can actually call on, per rung of seniority
 * between them.
 *
 * A quarter per rung of gap. An Outer Disciple one rung above the servants gets
 * a quarter of them; an Inner Disciple two rungs up gets half; the head of a
 * five-rung house gets all of them. This is the mechanical answer to why
 * climbing is worth anything before the top.
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

// ═══════════════════════════════════════════════════════════════════════════
// ERRANDS
// What ordering somebody actually buys, which is their time instead of yours.
// The herbs get gathered while the player cultivates, and time is the currency
// this whole game runs on.
// ═══════════════════════════════════════════════════════════════════════════

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
 *
 * Deliberately linear in hands and days: this is delegation, not a wish, and a
 * player who wants ten times the herbs has to be senior enough to send ten
 * times the people.
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
 *
 * Not zero, because an obstructed order is not a mutiny - it is people being
 * slow, losing the message, and doing the part that was witnessed. That is what
 * an unpopular Inner Disciple actually experiences.
 */
export const OBSTRUCTED_DELIVERY_FRACTION = 0.25;

// ═══════════════════════════════════════════════════════════════════════════
// STANDING
// ═══════════════════════════════════════════════════════════════════════════

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
 *
 * Capped because a following is insulation and never immunity: even a head who
 * recruited most of the house pays real money to retire a scripture, and the
 * people they did not recruit are exactly the ones who will not be talked
 * round.
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

// ═══════════════════════════════════════════════════════════════════════════
// FOLLOWINGS
// Who brought whom in. The link matters more than the individuals.
// ═══════════════════════════════════════════════════════════════════════════

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
 *
 * Deterministic, because a player has to be able to inherit a house and read
 * off which elder they cannot afford to cross before they cross them. Weighted
 * by the square of the rung so a house with one senior elder and three junior
 * ones lands in the interesting position by itself rather than by authoring.
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

// ═══════════════════════════════════════════════════════════════════════════
// WHAT THE ACTS COST
// Every number here is a statement about whose life's work is being touched.
// ═══════════════════════════════════════════════════════════════════════════

export type LeadershipAct =
    | 'order'
    | 'recruit_disciples'
    | 'recruit_elders'
    | 'set_admission'
    | 'set_curriculum'
    | 'expel_elder'
    | 'grow';

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
 *
 * Raising it says that everybody admitted under the old bar would not be
 * admitted now. Lowering it says the house is being cheapened, to the people
 * whose only distinction is having cleared a bar that no longer exists. There
 * is no free direction, which is the point of charging the distance rather than
 * the sign.
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
 *
 * `promote` requires the admission ordinal plus a fixed step per rung, so a bar
 * set too high makes the last promotion unreachable and quietly breaks the
 * ladder for everybody. The engine refuses rather than discovering it later.
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
 *
 * A generation, because the effect of a curriculum is the intake raised on it,
 * and nothing about the people already standing in the yard changes on the day
 * the decree is read.
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
/** Years to find one, negotiate, and seat them. */
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
            'There was somebody inside who had waited thirty years for that seat, and the house has been told in public what the waiting was worth.'
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
 *
 * The only act in the file that lands the day it is spoken, which is exactly
 * why the whole of its cost is on the other side of it. Priced off the
 * following rather than a flat penalty, so dismissing an elder who brought in
 * half the roster is visibly a different act from dismissing one who brought in
 * two - and the player can read both prices before choosing.
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
                : 'Every elder left standing has just learned the terms on which they hold their own seat.'
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// GROWTH
// The one act that earns standing, which is why it is slow and expensive.
// ═══════════════════════════════════════════════════════════════════════════

/** Who does the recruiting, which is the best decision available to a leader. */
export type GrowthChannel = 'seat' | 'elders';

/** Share of the house one leader can add per decade, recruiting alone. */
export const INTAKE_PER_DECADE_SEAT = 0.08;
/** Share the elders can add per decade when it is handed to them. */
export const INTAKE_PER_DECADE_ELDERS = 0.22;
/** Months of entry stipend a new intake is carried before they are worth anything. */
export const GROWTH_MONTHS_CARRIED = 120;
/** Extra intake per method in the working library. A wider door draws more people. */
export const INTAKE_PER_METHOD = 0.02;
/** Standing earned per head brought in personally. */
export const STANDING_PER_HEAD_SEAT = 1.2;
/** Standing earned per head when the elders did it and everybody knows. */
export const STANDING_PER_HEAD_ELDERS = 0.4;

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
 *
 * Compounding, because a house recruits through the people it already has, so
 * the first decade of a small house is grindingly slow and the fifth is not.
 * That is the honest shape and it is also the one that rewards a patient
 * leader over a loud one.
 *
 * Delegating is roughly three times faster and earns a third of the credit, and
 * every head it brings in attaches to an elder rather than to you. A leader who
 * grows the house that way gets the bigger house and the smaller shield, and
 * finds out what that means the first time they try to fire somebody.
 */
export function planGrowth(
    houseSize: number,
    entryStipend: number,
    methodCount: number,
    decades: number,
    channel: GrowthChannel
): GrowthPlan {
    const periods = Math.max(0, Math.floor(decades));
    const base = channel === 'seat' ? INTAKE_PER_DECADE_SEAT : INTAKE_PER_DECADE_ELDERS;
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
            (channel === 'seat' ? STANDING_PER_HEAD_SEAT : STANDING_PER_HEAD_ELDERS),
        attachesTo: channel === 'seat' ? 'the leader' : 'the elders'
    };
}

/** Years to find, vet and seat one disciple in a house that admits at nothing. */
export const RECRUIT_BASE_YEARS = 1;
/**
 * Additional years per ordinal of the house's own admission bar.
 *
 * This is the coupling between the two powers, and it is the reason the
 * standard is a decision rather than a preference. A house that admits at
 * nothing fills its yard in a year a head; a house that admits at Void
 * Refinement waits fifteen for each one, and the head who raised the bar is the
 * person who has to live in the emptier compound.
 */
export const RECRUIT_YEARS_PER_ADMISSION_ORDINAL = 0.5;

export interface IntakePlan {
    count: number;
    years: number;
    stonesRequired: number;
}

/**
 * Taking disciples in under your own line, which is what an elder rung is for.
 *
 * Priced per head rather than as a share of the house, because this is one
 * person going out and finding people, and it is how a player builds the
 * following that will later make a bid for the seat survivable.
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
 * Whether the seat is held when it is challenged.
 *
 * Read off state rather than rolled, because a challenge for the leadership of
 * a cultivation sect is not a negotiation: the strongest elder in the house
 * stands up, and either the head is above them or they are not. A leader who
 * spent a century governing and no time cultivating loses the seat to arithmetic
 * they could have checked at any point.
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
 *
 * A doubling is worth one rung, which is deliberately unimpressive: numbers are
 * not power in this setting, and a leader who wants a stronger house rather than
 * a bigger one is going to have to change what it teaches. Bounded in both
 * directions, because a sect that quadruples is still the same sect and one
 * that halves has not stopped existing.
 */
export function powerOrdinalDrift(size: number, baseSize: number): number {
    if (size <= 0 || baseSize <= 0) return 0;
    const rungs = Math.round(Math.log2(size / baseSize));
    return Math.max(-MAX_POWER_DRIFT, Math.min(MAX_POWER_DRIFT, rungs));
}

// ═══════════════════════════════════════════════════════════════════════════
// BACKLASH
// ═══════════════════════════════════════════════════════════════════════════

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
 *
 * `hasPatron` is the governance stack doing real work: an unbacked house or an
 * apex tops out at a challenge to the seat, which is a fight and can be won. A
 * house that holds its ground from somebody else has one more rung above that,
 * and it is a letter rather than a fight.
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
 *
 * Zero while standing is positive, certain by the point elders start leaving.
 * The only roll in the file, and its odds come entirely from accumulated
 * standing, so a player who reads the number before acting has been told
 * exactly what they are gambling.
 */
export function obstructionChance(standing: number): number {
    if (standing > OBSTRUCTION_AT) return 0;
    const span = OBSTRUCTION_AT - DEPARTURE_AT;
    const depth = Math.min(1, (OBSTRUCTION_AT - standing) / span);
    return Math.max(0, Math.min(1, Math.pow(depth, OBSTRUCTION_RAMP_EXPONENT)));
}

/**
 * Who walks, read off state rather than rolled.
 *
 * The elders with the largest followings go first, which is not cruelty for its
 * own sake: an elder with forty disciples behind them has somewhere to go and a
 * reason to be wanted there, and an elder with two does not. So the departures
 * take the biggest bite out of the house first, and the leader loses precisely
 * the part they were trying to build.
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
     *
     * The escalation runs the same numbers either way and lands on different
     * people. A head who has spent their credit loses elders and then the seat.
     * An Inner Disciple who has spent theirs loses the disciples they brought in
     * and then their place, because a house does not keep a rung nobody below it
     * will work for. Same ladder, same thresholds, different thing at the end.
     */
    holdsTheSeat: boolean;
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
    seatChallenged: boolean;
    removedByPatron: boolean;
    /** The house dismisses a rung nobody below it will work for. */
    dismissedFromTheHouse: boolean;
    years: number;
    insult: string;
}

/**
 * Price an act, spend the standing, and report what the house does about it.
 *
 * Pure. The obstruction roll belongs to the caller, which is what keeps every
 * stochastic outcome on a seeded stream and out of this module.
 *
 * The standing is spent whether or not the act lands, and that is deliberate:
 * an order that was ignored was still given, and the giving is what cost.
 */
export function resolveAct(house: HouseState, cost: ActCost): ActOutcome {
    const spent = shieldedCost(cost.standingCost, house.ownFollowing, house.houseSize);
    const standingAfter = clampStanding(
        house.standing - spent + Math.max(0, cost.standingEarned)
    );
    const level = backlashLevel(standingAfter, house.hasPatron && house.holdsTheSeat);
    const departures = house.holdsTheSeat
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
        ownFollowingLost: house.holdsTheSeat
            ? 0
            : Math.floor(Math.max(0, house.ownFollowing) * departureDepth(standingAfter)),
        seatChallenged: house.holdsTheSeat && standingAfter <= CHALLENGE_AT,
        removedByPatron:
            house.holdsTheSeat && house.hasPatron && standingAfter <= REMOVAL_AT,
        dismissedFromTheHouse: !house.holdsTheSeat && standingAfter <= CHALLENGE_AT,
        years: Math.max(0, cost.years),
        insult: cost.insult
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
    const wouldTrigger = backlashLevel(wouldLandAt, house.hasPatron && house.holdsTheSeat);
    return {
        spends,
        wouldLandAt,
        wouldTrigger,
        safe: wouldLandAt > OBSTRUCTION_AT
    };
}
