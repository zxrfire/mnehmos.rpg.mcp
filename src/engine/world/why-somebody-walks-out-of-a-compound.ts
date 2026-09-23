/**
 * Why somebody on a house's roll walks out of it, and where they go.
 *
 * A compound is safe, and that is not what a cultivator is for. Everything the
 * world already does with people on the road is a HOUSE dispatching them - a
 * door opens and houses race teams at it, a posting runs for twelve years, an
 * errand has a term and a place to come back to. Nobody has ever decided for
 * themselves that staying is the thing costing them.
 *
 * So the test for anything in this file: **who decided it?** The answer is the
 * person, every time. A house that loses somebody this way finds out afterwards.
 *
 * THE OTHER HALF OF LEAVING is written for a reader rather than for the engine:
 * `docs/world/climbing/past-the-ceiling.md`, *Leaving, and what it costs*, on
 * what a departure is negotiated over - the book rather than the person - and
 * why going to the Hollow Court is the one departure that costs nothing. This
 * file holds the rate; that holds the decision.
 *
 * ── THE REASONS ARE READ, NEVER INVENTED ─────────────────────────────────
 *
 * There is no wanderlust score and there must not be. Every reason below is a
 * fact the world already holds about this person, and two of the readers it
 * comes off had no caller at all:
 *
 *   `houseTeachingCeiling`   the highest rung anything a house teaches could
 *                            carry somebody to. Authored, tested, and read by
 *                            NOTHING in `src/` - so a disciple standing at the
 *                            top of everything their house has was
 *                            indistinguishable from one at the bottom of it.
 *   `shortBy: 'somewhere_else'`  `howSomebodyStandsToAGround` answers, of every
 *                            dao ground in the world, that an outsider is short
 *                            of it BY BEING IN THE WRONG PROVINCE. The engine
 *                            has been saying "they would have this if they went
 *                            there" since it was written, and nothing in the
 *                            world has ever gone. `roadsInReachOf` is read by
 *                            `applyAdvancement` off the person's CURRENT
 *                            location, so walking there is the whole of the
 *                            fix: no new machinery, and the payoff is already
 *                            wired.
 *   `blocked`                `assessPromotions`' list of people who have
 *                            outgrown their rung and cannot be raised. It was
 *                            computed every year and thrown away, and the only
 *                            reason here about having no place in a house fired
 *                            on the bottom rung alone. Now it is its own reason
 *                            at any rung, weighed by how long and how far
 *                            (`being-held-back-in-a-house.ts`).
 *
 * ── AND THEY GO FOR SOMETHING ────────────────────────────────────────────
 *
 * Not out. TO something, and the first choice is the road they are a province
 * short of, because that is the one destination whose reward the engine already
 * computes. A place is preferred over a direction, and nothing here draws.
 *
 * ── A SMALL GROUP IS PEOPLE, NOT A UNIT ──────────────────────────────────
 *
 * Two or three who each had their own reason and hold a tie to each other. No
 * roster, no leader, no standing order: the party is `NpcActivity.withIds`,
 * which `who-is-on-the-road-with-you.ts` argues at length is the only place a
 * party may live, and it is read rather than stored.
 */

import type { CultivationRNG } from '../cultivation/rng.js';
import { getTechnique } from '../../data/cultivation/techniques.js';
import { whoseArt, yearsToWriteOutACopy } from './manuals.js';
import { meritWith } from './what-a-house-counts-in-somebodys-favour.js';
import { whatSomebodyIsLike } from './what-somebody-is-like-and-where-it-came-from.js';
import { requiredContributionForRank } from '../cultivation/what-each-rung-of-a-house-ladder-requires.js';
import type { NpcRecord } from './npc-state.js';
import type { FactionRecord } from './world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT STAYING IS COSTING THEM
// ─────────────────────────────────────────────────────────────────────────

/**
 * The reasons somebody leaves, in the words somebody in the world could say.
 *
 * A closed set, and every entry is a reading of a fact rather than a mood. The
 * point of the phrasing is that the fact of a departure can be reported with
 * its reason attached - a house short of hands can say WHY it is short.
 */
export type WhyTheyWentOut =
    /** Everything the house teaches tops out at or below where they stand. */
    | 'the house cannot teach them further'
    /** The house did not pay the stipend this year. */
    | 'the house did not pay them'
    /** There is ground that would teach them a road, and it is not near here. */
    | 'a road a province away'
    /** Somebody they knew went out for the house and never came back. */
    | 'somebody they knew did not come back'
    /** No room, no office, and nothing in the purse. */
    | 'nothing in the hall is theirs'
    /**
     * Past the bar of the rung above, and the house cannot raise them - no
     * seat, somebody ahead, not enough service, or no room for another elder
     * without an office. At any rung. `being-held-back-in-a-house.ts`.
     */
    | 'the house has no room for them to rise';

export interface WhatStayingIsCostingThem {
    ordinal: number;
    /**
     * The top of what their house teaches, or null where nothing is written
     * down about it. `houseTeachingCeiling` is the one reading.
     */
    houseTeachingCeiling: number | null;
    /** Whether the house could pay its people this year. */
    theHousePaidThem: boolean;
    /** Ties of theirs whose other end is missing or dead. */
    peopleTheyKnewWhoDidNotComeBack: number;
    /** Their rung on the house's own ladder. Zero is the bottom of it. */
    factionRankIndex: number;
    /** What they are carrying. */
    spiritStones: number;
    /** Whether the world holds a road they are short of only by distance. */
    aRoadAProvinceAway: boolean;
    /**
     * How many reasons' worth being held back in the house is, or zero where
     * they are not. `howHardBeingHeldBackPresses`: it grows with how long they
     * have waited and how far past the bar they stand, and reads no rung.
     */
    beingHeldBack?: number;
}

/**
 * What somebody is carrying nothing at.
 *
 * A month of the stipend, which is the figure the economy already pays and
 * mostly takes straight back: somebody below it has not put anything by, which
 * is the fact this reason is about.
 */
export const NOTHING_PUT_BY = 4;

/**
 * Why this person would leave. Empty for somebody with no reason to.
 *
 * Order is stable so the first entry is the one a report leads with, and the
 * teaching ceiling is first because it is the one that never resolves itself:
 * a house that cannot teach you further will not start.
 */
export function whyTheyWouldLeave(
    them: WhatStayingIsCostingThem
): readonly WhyTheyWentOut[] {
    const why: WhyTheyWentOut[] = [];
    if (them.houseTeachingCeiling !== null && them.houseTeachingCeiling <= them.ordinal) {
        why.push('the house cannot teach them further');
    }
    // Second, because it is the other one that does not resolve itself: a hall
    // full of people who will not die for six centuries does not empty.
    if ((them.beingHeldBack ?? 0) > 0) why.push('the house has no room for them to rise');
    if (them.aRoadAProvinceAway) why.push('a road a province away');
    if (!them.theHousePaidThem) why.push('the house did not pay them');
    if (them.peopleTheyKnewWhoDidNotComeBack > 0) {
        why.push('somebody they knew did not come back');
    }
    // The bottom of the ladder AND nothing put by. Either alone is ordinary.
    if (them.factionRankIndex <= 0 && them.spiritStones < NOTHING_PUT_BY) {
        why.push('nothing in the hall is theirs');
    }
    return why;
}

/**
 * How likely one reason is to move somebody in one year of a mortal's hundred.
 *
 * Deliberately small, and it multiplies. Somebody with one grievance mostly
 * stays; somebody with four is on the road inside a working lifetime, which is
 * the shape the reasons are for. There is no threshold anywhere - the
 * difference between staying and going is how much is wrong.
 *
 * A YEAR IS A SHARE OF A LIFE. The design owner: *"people can leave but they
 * don't leave easily. Cultivators live a long time."* So the chance is read
 * against the span the person has (`lifespanForOrdinal`): somebody with a
 * thousand years weighs a grievance a tenth as often a year, and leaves as often
 * over their life as a mortal does over theirs.
 */
export const WHAT_ONE_REASON_IS_WORTH_IN_A_YEAR = 0.012;

/** The life the rate above is stated in: a mortal's, `lifespanForOrdinal(0)`. */
export const THE_LIFE_THE_RATE_IS_STATED_IN = 100;

/**
 * How many reasons' worth of grievance this is.
 *
 * One apiece, except being held back, which weighs what
 * `howHardBeingHeldBackPresses` says - nothing in the first year it is true and
 * up to four grievances after long enough - because how long somebody has been
 * passed over is the whole of how much it costs them.
 */
export function howMuchTheirReasonsWeigh(
    reasons: readonly WhyTheyWentOut[],
    beingHeldBack = 0
): number {
    const others = reasons.filter(r => r !== 'the house has no room for them to rise').length;
    return others + (reasons.includes('the house has no room for them to rise') ? beingHeldBack : 0);
}

/** Whether they go this year. Seeded on the person and the year by the caller. */
export function whetherTheyGoThisYear(
    reasons: readonly WhyTheyWentOut[],
    rng: CultivationRNG,
    /** `howMuchTheirReasonsWeigh`. One per reason where the caller has nothing better. */
    weight: number = reasons.length,
    /** Their span, `lifespanForOrdinal`. Omitted, a mortal's. */
    lifespanYears: number = THE_LIFE_THE_RATE_IS_STATED_IN,
    /** What leaving would cost them, in the same unit: `whatLeavingTheirHouseCosts`. */
    cost = 0
): boolean {
    if (reasons.length === 0) return false;
    const net = weight - Math.max(0, cost);
    if (!(net > 0)) return false;
    const ofALife = THE_LIFE_THE_RATE_IS_STATED_IN / Math.max(THE_LIFE_THE_RATE_IS_STATED_IN, lifespanYears);
    return rng.chance(Math.min(1, net * WHAT_ONE_REASON_IS_WORTH_IN_A_YEAR * ofALife));
}

/**
 * What a lifetime of belonging to a house weighs, in grievances.
 *
 * The design owner: *"most people have loyalty"*, *"think Japan-type companies"*
 * - lifetime membership, *"not IMPOSSIBLE, but very rare."* So belonging is the
 * default a departure has to overcome. It is read off two things the world
 * already holds, each a share from nothing to all of it, and this is what both
 * together weigh:
 *
 *   time       how long they have had ties to the people on this roll (the
 *              earliest `sinceDay` of a tie to somebody living on it), as a
 *              share of a fifth of their own life
 *   people     how many warm ties they hold on the roll, three being all of it
 */
export const WHAT_BELONGING_WEIGHS = 3;

/**
 * What everything a person would have to build again weighs, in grievances.
 *
 * The design owner: *"you have to build up goodwill, merit and relationships all
 * over again."* Merit does not travel (*"Contribution does not travel"*), and
 * neither does a rung. Read as two shares: how far up its ladder the house
 * raised them, and how much of the price of their next rung they already hold
 * (`meritWith` against `requiredContributionForRank`).
 */
export const WHAT_STARTING_OVER_WEIGHS = 2;

/*
 * AND WHAT THE TWO FIGURES ABOVE ARE MEASURED AGAINST. Together they put what
 * leaving costs at 1.15 to 2.69 across the bands, which is above what being held
 * back weighs for most people and under what it weighs for somebody held at the
 * same rung for a long share of their own life. Two hundred years is not the
 * unit to judge that on - the owner: *"200 years again is not a long time"* -
 * and a world can go a century or two with nobody going anywhere. The unit is a
 * career: how many of the people who are ever on a roll are ever on a second
 * one, measured by rung over millennia, and why each of them went.
 */

/**
 * How strongly a house holds its people, by what kind of house it is.
 *
 * The design owner: *"demonic cultivators probably swap at will"*, *"even
 * neutral sects have loyalty to the sect"*, neutral *"might be slightly less"*
 * than righteous, and a family holds people by kinship, strongest of all. Read
 * off `alignment` and the `bloodline` governance tag.
 */
export const HOW_A_HOUSE_HOLDS_ITS_PEOPLE = {
    bloodline: 1.3,
    righteous: 1,
    neutral: 0.9,
    demonic: 0.2
} as const;

/**
 * How hard somebody of this kind of house counts what they would give up.
 *
 * The design owner: *"neutral sects are realpolitik. But that doesn't mean you'd
 * abandon your post at a neutral sect."* So a neutral house holds with the
 * ledger what it holds less with sentiment, and a demonic cultivator counts the
 * same losses and has less to lose.
 */
export const HOW_HARD_THEY_COUNT_WHAT_THEY_LOSE = {
    bloodline: 1,
    righteous: 1,
    neutral: 1.25,
    demonic: 0.5
} as const;

/**
 * How much the person moves their own loyalty, around the kind of house.
 *
 * The design owner: *"loyalty also does depend on the person."* Read off the
 * disposition the world already derives for everybody, `howHardTheyPush`
 * (`what-somebody-is-like-and-where-it-came-from.ts`): somebody who goes at
 * things directly and climbed a long way from their birth weighs what they owe
 * a house lighter, and somebody who waits and lets it come to them weighs it
 * heavier. At the far ends, half again or half as much.
 */
export const HOW_MUCH_THE_PERSON_MOVES_IT = 0.5;

/**
 * WHAT LEAVING PRODUCES, MEASURED ON `afford-a` AT 1,000 YEARS, before the
 * standing term below was added:
 *
 *   departures a millennium, by the rung they left from
 *       r0 89   r1 119   r2 85   r3 67   r4 144   r5+ 17
 *   of everybody ever on a roll, the share ever on a second one
 *       7.0% overall; by the rung they left from, r0 0.8%, r1 1.2%, r2 1.6%,
 *       r3 4.0%, r4 9.2%, r5+ 5.9%
 *   why they went, a millennium
 *       a road a province away 135, the house has no room for them to rise 130,
 *       somebody they knew did not come back 109, the house did not pay them 6,
 *       the house cannot teach them further 2
 *
 * The level is the owner's - most people never move - and the SHAPE read as
 * wrong: the elder band came out at nine percent a career against a disciple's
 * under one. WHAT THE SHAPE ACTUALLY IS, taken apart by route at 1,000 years on
 * the same seed, per millennium:
 *
 *                        r0    r1    r2    r3    r4   r5+
 *   written off as lost  118    88    44    18    68    12
 *   went with a founder    5    22    29    33    55     9
 *   walked out            17    33    12     8    14     0
 *   founded their own      0     0     6     9    15     0
 *   expelled               1     2     0     0     6     1
 *
 * THE DECISION-SHAPED ROUTE ALREADY FALLS WITH THE RUNG. Walking out is a
 * junior's move, 33 a millennium at the second rung against 14 at the elder
 * band - and out of far more juniors than elders. What climbs with the rung is
 * founding a house of your own and taking your people with you, which is the one
 * departure the owner says a strong person makes readily, and being WRITTEN OFF
 * AS LOST, which is nobody's decision at all and is the commonest way off a roll
 * in the world at 348 a millennium (`whatHousesLearnOfTheirOwn`).
 *
 * AND THE INSTRUMENT FLATTERED THE TOP. Nobody in this world goes from one
 * house's roll straight onto another's - measured, the house-to-house transfer
 * rate is exactly zero at every rung - so "ever on a second roll" counts
 * founding your own house and being hired back after a spell on the road. Both
 * are elder-shaped. A career measure that calls founding a transfer cannot show
 * the shape the ruling is about.
 *
 * WHAT IS LEFT FOR WHOEVER TAKES THIS NEXT: whether elders accumulate more
 * reasons than juniors or weigh each one harder (the rate itself is thinned by
 * lifespan for everybody, `whetherTheyGoThisYear`, so it is not the rate), and
 * whether 348 people a millennium being quietly written off by their own houses
 * is the intended shape of that pass. On a seed where nothing went wrong at all
 * (`purse-a`, 200 years) there were 19 departures, every one of them alone.
 */

/**
 * What the standing somebody holds in a house costs them to leave behind.
 *
 * THE TERM THAT WAS MISSING, and the reason the pyramid came out upside down.
 * Measured on `afford-a` at a thousand years: of everybody ever on a roll, the
 * share ever on a second one ran 0.8% for those who left from the bottom rung
 * and 9.2% for those who left from the elder band. The owner: people *"HARDLY
 * leave"*, *"esp at elder level"*, *"that's like a top NBA star transferring
 * teams"*.
 *
 * AND WHY IT IS NOT THE GRIEVANCE THAT WAS WRONG. Being held back is already
 * read against the span the person has, so an elder's wait presses a fiftieth as
 * hard per year as a disciple's; what an elder has that a disciple does not is
 * YEARS to spend at those odds - centuries of them - and over a career that is
 * what the inversion is made of. So the fix is on the other side of the scale:
 * an office, a say in the room and a following do not travel, and they are worth
 * more the higher up they sit. Quadratic in the rung, so a disciple's cost is
 * untouched and an elder's goes past what any grievance can weigh.
 *
 * MEASURED, on `afford-a` at 1,000 years: what leaving costs now runs from a
 * mean of 2.94 at the bottom rung to 5.34 at the top, where before it was flat.
 * The ever-moved shape did NOT follow - r0 0.84% to 1.2%, r4 9.2% to 8.5% - and
 * the block at the top of this file says why: the measure counts a founding as a
 * transfer. Splinters survived the term at 2.4 foundings a century. The term
 * stays because what it prices is real; the shape is not settled, and the commit
 * that carries it is held for that reason.
 */
export const WHAT_STANDING_COSTS_TO_LEAVE_BEHIND = 2.5;

/** The ties a person holds to a house's people that make them of it. */
const WARM_TIES: ReadonlySet<string> = new Set(['master', 'disciple', 'kin', 'spouse', 'parent', 'child', 'ally']);

/**
 * What leaving their house would cost somebody, in grievances.
 *
 * Weighed against what staying costs them, so a departure needs a grievance
 * bigger than all of it:
 *
 *   belonging   {@link WHAT_BELONGING_WEIGHS}, times how the house holds its
 *               people ({@link HOW_A_HOUSE_HOLDS_ITS_PEOPLE}) and how the person
 *               moves that ({@link HOW_MUCH_THE_PERSON_MOVES_IT}).
 *   starting    {@link WHAT_STARTING_OVER_WEIGHS}, times how hard they count it
 *   over        ({@link HOW_HARD_THEY_COUNT_WHAT_THEY_LOSE}): the rung and the
 *               merit that stay behind.
 *   the arts    *"leaving a sect means having to learn the arts of the new
 *               sect"*: taking up another road as deep as the one they walk takes
 *               what a lesson or a copy takes (`yearsToWriteOutACopy`), counted
 *               as a share of a fifth of their life, as waiting is.
 *   the oath    *"likely you'd have to swear an oath not to leak your arts"*:
 *               somebody who holds an art that is their house's property owes
 *               the house either their silence or their enmity, and neither is
 *               free. One grievance, weighted as the house holds its people,
 *               because an oath counts for less where nobody expects it kept.
 */
export function whatLeavingTheirHouseCosts(input: {
    npc: Pick<NpcRecord, 'id' | 'identity' | 'factionId' | 'factionRankIndex' | 'cultivation' | 'relationships' | 'merit'>;
    house: Pick<FactionRecord, 'id' | 'alignment' | 'tags' | 'ranks'>;
    lifespanYears: number;
    day: number;
    /** Whether a person is alive and on this house's roll. */
    onTheRoll: (personId: string) => boolean;
}): number {
    const { npc, house } = input;
    if (npc.factionId !== house.id) return 0;
    const kind = house.tags.includes('bloodline') ? 'bloodline' : house.alignment;
    const person = 1 - HOW_MUCH_THE_PERSON_MOVES_IT * whatSomebodyIsLike(npc).push;
    const holds = HOW_A_HOUSE_HOLDS_ITS_PEOPLE[kind] * person;
    const counts = HOW_HARD_THEY_COUNT_WHAT_THEY_LOSE[kind] * person;
    const aFifthOfALife = Math.max(1, input.lifespanYears / 5);

    let since = Infinity;
    // PEOPLE, NOT ROWS. Rows are keyed by the pair and the kind, so one person
    // who is both an ally and an uncle holds two of them, and counting rows
    // would say this person has twice the house to lose that they have.
    const warmOnes = new Set<string>();
    for (const tie of npc.relationships) {
        if (!input.onTheRoll(tie.targetId)) continue;
        since = Math.min(since, tie.sinceDay);
        if (WARM_TIES.has(tie.kind) && tie.standing > 0) warmOnes.add(tie.targetId);
    }
    const warm = warmOnes.size;
    const time = Number.isFinite(since) ? Math.min(1, Math.max(0, (input.day - since) / 365) / aFifthOfALife) : 0;
    const people = Math.min(1, warm / 3);
    const belonging = WHAT_BELONGING_WEIGHS * holds * (time + people) / 2;
    const rung = house.ranks.length <= 1 ? 0 : Math.max(0, npc.factionRankIndex) / (house.ranks.length - 1);
    const merit = Math.min(1, meritWith(npc, house.id) / requiredContributionForRank(Math.max(1, npc.factionRankIndex + 1)));
    const startingOver = WHAT_STARTING_OVER_WEIGHS * counts * (rung + merit) / 2;

    let ownArt = false;
    let deepest = 0;
    for (const id of npc.cultivation.techniqueIds) {
        const art = getTechnique(id);
        if (art === undefined || art.cap == null) continue;
        if (whoseArt(id).includes(house.id)) ownArt = true;
        deepest = Math.max(deepest, yearsToWriteOutACopy(id) ?? 0);
    }
    const relearning = Math.min(1, deepest / aFifthOfALife);
    const oath = ownArt ? holds : 0;
    // What an office, a say and a following cost to walk away from, none of
    // which travels. See {@link WHAT_STANDING_COSTS_TO_LEAVE_BEHIND}.
    const standing = WHAT_STANDING_COSTS_TO_LEAVE_BEHIND * counts * rung * rung;
    return belonging + startingOver + relearning + oath + standing;
}

// ─────────────────────────────────────────────────────────────────────────
// WHERE THEY GO
// ─────────────────────────────────────────────────────────────────────────

/**
 * A place somebody would set out for, and what it asks of them.
 *
 * `why` is a sentence, because the requirement on this whole feature is that
 * of anybody out in the world you can say what they went for.
 */
export interface SomewhereWorthGoing {
    locationId: string;
    name: string;
    why: string;
    /**
     * The rung the ground asks of anybody standing on it. Below it, they do not
     * come back from the trip - which is the same `thresholds.survival` every
     * other reader of a place uses and not a second notion of danger.
     */
    survivalOrdinal: number;
}

/**
 * Where this person would set out for, or null where there is nowhere.
 *
 * A ROAD BEFORE A RUIN, and both before nothing. The road is the destination
 * whose reward the engine already computes - stand there and `roadsInReachOf`
 * answers differently at the next review - and a ruin is a chance at one. A
 * person with neither has nowhere worth walking to and stays, which is why
 * most people stay.
 */
export function whereTheyWouldGo(
    roads: readonly SomewhereWorthGoing[],
    ruins: readonly SomewhereWorthGoing[]
): SomewhereWorthGoing | null {
    return roads[0] ?? ruins[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────
// AND WHO GOES WITH THEM
// ─────────────────────────────────────────────────────────────────────────

/** How many can leave together before it stops being a few people. */
export const A_FEW_PEOPLE = 3;

export interface SomebodyElseLeaving {
    id: string;
    /** They set out for the same place. */
    goingTheSameWay: boolean;
    /** They already knew each other, or walked off the same roll. */
    knownToThem: boolean;
}

/**
 * The two ways a few people end up on one road.
 *
 * NOT A PARTY BEING RAISED. Each of these had their own reason and each could
 * have gone alone. There is no leader, no roster and no standing order: this is
 * a list of who is walking the same way, and the caller writes it onto each of
 * their own activities, which is the only place a party lives.
 */
export interface WhoElseIsWalkingThisWay {
    /** Left together, because they already knew each other. */
    setOutTogether: readonly string[];
    /**
     * Fell in on the road, because they were going the same way and nothing
     * else. Two people out of two different halls for two different reasons,
     * which is the version of this the genre is actually about.
     */
    fellInOnTheRoad: readonly string[];
}

/**
 * Who is on this road too.
 *
 * Known first, because somebody you already trust is who you set out with, and
 * a stranger going the same way is somebody you end up with.
 */
export function whoWouldGoWithThem(
    others: readonly SomebodyElseLeaving[]
): WhoElseIsWalkingThisWay {
    const together: string[] = [];
    const road: string[] = [];
    for (const other of others) {
        if (!other.goingTheSameWay) continue;
        if (together.length + road.length >= A_FEW_PEOPLE - 1) break;
        if (other.knownToThem) together.push(other.id); else road.push(other.id);
    }
    return { setOutTogether: together, fellInOnTheRoad: road };
}
