/**
 * A house puts a price on somebody: a paper on its walls naming the person, the
 * purse, and the proof it pays on.
 *
 * The ruling: a price on a head is a piece of paper, and anybody can read it -
 * the person named on it included. It runs both ways: the player can take one up
 * and bring the proof, and the people who take one up against the player arrive
 * the way anybody with an account arrives. Nobody here is a kind of person. A
 * taker is whoever reads the paper and finds the purse worth the walk.
 *
 * ── WHAT IS STORED, AND WHY ONLY THAT ────────────────────────────────────
 *
 * Posting is a decision taken on a day with a purse committed out of a treasury
 * as it stood then, so it is written once, as a world fact (`bounty_posted`),
 * and everything else is read off it: whether it still stands (the named person
 * is alive, the span has not run out, nobody has been paid on it), which walls
 * carry it (the house's own reach, `reachesThisGround`), and who might take it
 * up. A purse paid is a `grudge_settled` fact naming the paper, which is what
 * closes it for everybody at once.
 *
 * ── WHERE THE ACCOUNT COMES FROM ─────────────────────────────────────────
 *
 * The house has to hold something heavy against a PERSON. Two sources, one
 * decision ({@link housesPutUpTheirPaper}):
 *
 *   the world's own killings  a worked-out killing of somebody on a house's
 *                             roll, by somebody not on it. The same reading the
 *                             bout layer makes when it opens the house's row
 *                             against whoever did it (`theAccountsAFightOpens`
 *                             names the actor, not the actor's house).
 *   the player's ledger       the SQL rows a house holds against the player,
 *                             which the world cannot see; the caller converts
 *                             them onto the world clock and hands them in.
 *
 * A house does not put paper up on its own member - that is the room's
 * business (`a-room-hands-one-down-to-you.ts`) - and a house that cannot afford
 * an address posts nothing in public (`demonicStandingOf`, the same gate the
 * intake wall uses).
 *
 * ── HONOURED ─────────────────────────────────────────────────────────────
 *
 * `BOUNTIES` in `rogues.ts` is the shape and the vocabulary, and a person-price
 * is a row of that shape with the person on it ({@link PersonBountySchema}).
 * Which word a house's paper earns is read off whoever holds its purse strings:
 * the head's open-handedness (`openHandednessOf`), a trait that already prices
 * what somebody parts with. What each word MEANS at the counter is
 * {@link WHETHER_A_HOUSE_PAYS}. The paper says the purse and never the word -
 * the catalog's own rule that the purse is not the payment.
 *
 * ── PROOF ────────────────────────────────────────────────────────────────
 *
 * The paper names a token, a head or a witnessed death. What the engine checks
 * is the one thing all three stand for: the world holds a death naming the
 * claimant as the killer and the named person as the victim. Killing them
 * through any ordinary road writes that row; nothing else does.
 */

import { z } from 'zod';
import { BountySchema } from '../../data/cultivation/rogues.js';
import { CASH_PER_STONE } from '../../data/cultivation/mortal-world.js';
import { demonicStandingOf } from '../../data/cultivation/demonic-sects-and-what-they-are-willing-to-do.js';
import { provinceForFaction } from '../../data/cultivation/regions.js';
import { forStream } from '../cultivation/rng.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { SEVERITY_ORDER, type ObligationCause, type ObligationRecord, type Severity } from '../social/grudges.js';
import { AGAINST_THEIR_OWN } from '../social-leverage/what-a-house-does-when-it-catches-you.js';
import { openHandednessOf } from '../social-leverage/how-freely-somebody-parts-with-what-they-have.js';
import { whatItWasWorth } from '../social-leverage/what-a-deed-leaves.js';
import { BILLS_A_WALL_CARRIES, reachesThisGround } from './houses-that-have-to-advertise-for-disciples.js';
import { postingGroundOf, provinceOfPlace } from './the-doors-and-walls-a-house-takes-people-at.js';
import { isTheWorldsToMove, type NpcRecord } from './npc-state.js';
import { isBelowTheLid } from './layers.js';
import { makeFact, type HistoricalFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { npcsInFaction, type FactionRecord, type WorldState } from './world-state.js';
import { whatAPriceIsWorthTo } from './why-one-cultivator-kills-another.js';

// ─────────────────────────────────────────────────────────────────────────
// THE NUMBERS
// ─────────────────────────────────────────────────────────────────────────

/** The two bands heavy enough to put on a wall. */
export type HeavyEnoughToPost = Extract<Severity, 'grave' | 'unforgivable'>;

/** The chance a house holding an account this heavy puts paper up over it. */
export const A_HOUSE_PUTS_A_PRICE_ON_IT: Readonly<Record<HeavyEnoughToPost, number>> = {
    grave: 0.35,
    unforgivable: 0.7
};

/**
 * The share of its treasury a house puts up, by how heavy the account is. The
 * purse is the house's means times the weight: on the seeded treasuries
 * (`price-probe`, 38 houses, median 31,023 stones, largest 62,790) a killed
 * member is ~930 stones at the median house and ~1,880 at the richest.
 */
export const WHAT_A_HOUSE_PUTS_UP_OF_ITS_PURSE: Readonly<Record<HeavyEnoughToPost, number>> = {
    grave: 0.01,
    unforgivable: 0.03
};

/** Below this a house with a thin treasury does not bother with paper. */
export const A_PURSE_NOBODY_CROSSES_A_ROAD_FOR = 50;

/** Days between the wrong and the paper: the house deciding, and the paper being written. */
export const A_HOUSE_TAKES_THIS_LONG_TO_PUT_UP_PAPER = { min: 10, max: 60 } as const;

/** How long a price stands before the paper is taken down unclaimed. */
export const A_PRICE_STANDS_FOR_DAYS = 10 * DAYS_PER_YEAR;

/**
 * Which honoured word a head earns, by how freely they part with things
 * (-1..+1). Read top down; the first floor they clear is the word.
 */
export const HOW_A_HEAD_HONOURS_THE_PAPER: readonly { atLeast: number; honoured: Honoured }[] = [
    { atLeast: 0.3, honoured: 'reliably' },
    { atLeast: -0.1, honoured: 'usually' },
    { atLeast: -0.5, honoured: 'if_witnessed' },
    { atLeast: -Infinity, honoured: 'rarely' }
];

/**
 * What each honoured word means when somebody brings the proof. `if_witnessed`
 * pays in full when the death was seen and not at all when it was not.
 */
export const WHETHER_A_HOUSE_PAYS: Readonly<Record<Honoured, number>> = {
    reliably: 1,
    usually: 0.75,
    if_witnessed: 1,
    rarely: 0.2
};

// ─────────────────────────────────────────────────────────────────────────
// THE SHAPE
// ─────────────────────────────────────────────────────────────────────────

export type Honoured = z.infer<typeof BountySchema>['honoured'];

/** A `BOUNTIES` row with the person on it. */
export const PersonBountySchema = BountySchema.extend({
    targetId: z.string(),
    targetName: z.string(),
    posterName: z.string(),
    severity: z.enum(['grave', 'unforgivable']),
    purseStones: z.number().int().min(1),
    postedOnDay: z.number(),
    lapsesOnDay: z.number(),
    /** What the house says it is for, in its own words on the paper. */
    forWhat: z.string()
});
export type PersonBounty = z.infer<typeof PersonBountySchema>;

/** Something a house holds against a person, on the world's clock. */
export interface AHouseAccount {
    /** Unique per wrong: the killing's fact id, or the ledger row's id. */
    key: string;
    houseId: string;
    subjectId: string;
    subjectName: string;
    severity: Severity;
    /** World day of the wrong. */
    onDay: number;
    /** What the house would say it is for. */
    forWhat: string;
    /**
     * The house the person answers to, where the caller knows it better than
     * the world's row does - the player's membership is on the ledger side.
     */
    subjectHouseId?: string | null;
}

const POSTED = 'bounty_posted';

// ─────────────────────────────────────────────────────────────────────────
// WHERE THE ACCOUNTS COME FROM
// ─────────────────────────────────────────────────────────────────────────

function roleIn(fact: HistoricalFact, role: string) {
    return fact.actors.find(a => a.role === role) ?? null;
}

function severityOf(value: unknown): Severity | null {
    return typeof value === 'string' && (SEVERITY_ORDER as readonly string[]).includes(value)
        ? value as Severity
        : null;
}

/** What a life taken is worth, asked of the one authority rather than restated. */
const A_LIFE_TAKEN: Severity = whatItWasWorth({
    cause: 'killed_sectmate', paidBy: 'subject', cost: 1, irreversible: true, onDay: 0, description: ''
});

/**
 * Accounts houses hold for their own dead against whoever killed them, read off
 * worked-out killings recent enough that a paper would still stand. The player
 * as killer is left out: their accounts are the ledger's, handed in by the caller.
 */
export function accountsHousesHoldForTheirDead(state: WorldState, day: number): AHouseAccount[] {
    const byId = new Map(state.npcs.map(n => [n.id, n] as const));
    const out: AHouseAccount[] = [];
    for (const fact of state.history.facts) {
        if (fact.day > day || fact.day < day - A_PRICE_STANDS_FOR_DAYS) continue;
        if (fact.visibility === 'secret' || fact.nearMiss) continue;
        const killed = roleIn(fact, 'victim');
        const killer = roleIn(fact, 'killer');
        if (!killed || !killer) continue;
        const victim = byId.get(killed.id);
        const doer = byId.get(killer.id);
        if (!victim?.factionId || !doer || !isTheWorldsToMove(doer)) continue;
        if (doer.factionId === victim.factionId) continue;
        out.push({
            key: fact.id,
            houseId: victim.factionId,
            subjectId: doer.id,
            subjectName: doer.name,
            severity: severityOf(fact.data.deedWeight) ?? A_LIFE_TAKEN,
            onDay: fact.day,
            forWhat: `for the death of ${victim.name}, who was theirs`
        });
    }
    return out;
}

/** What a house says a price is for, by the ledger's word for what happened. */
function whatTheHouseSaysItIsFor(cause: ObligationCause): string {
    if (cause === 'killed_kin' || cause === 'killed_sectmate' || cause === 'killed_master') {
        return 'for the death of one of its own';
    }
    if (cause === 'robbery' || cause === 'stolen_inheritance' || cause === 'harvested') {
        return 'for what was taken from it';
    }
    if (cause === 'destroyed_sect') return 'for what was done to the house';
    return 'for a wrong it has not let go of';
}

/**
 * The heavy accounts houses hold against the one being played, read off their
 * own ledger rows, which the world cannot see.
 *
 * THE LEDGER KEEPS TWO CLOCKS. A row a web verb writes is dated on the run's
 * day (`acceptDuty`, a house catching you) and a row a fight opens is dated on
 * the world's (`whatTheConfrontationDidToThem` is handed `world.currentDay`).
 * The run's day is a lifetime at most and the world's starts centuries in, so a
 * day below the run's first world day is a run day and is moved onto the
 * world's clock; anything at or past it already is.
 */
export function accountsHousesHoldAgainstThem(input: {
    rows: readonly ObligationRecord[];
    subject: { id: string; name: string; houseId: string | null };
    /** Houses the world holds. A holder that is not one is a person. */
    houseIds: ReadonlySet<string>;
    /** The world day the run began on. */
    runStartedOnDay: number;
}): AHouseAccount[] {
    return input.rows
        .filter(row =>
            (row.kind === 'grudge' || row.kind === 'blood_feud')
            && row.status === 'open'
            && row.subjectId === input.subject.id
            && input.houseIds.has(row.holderId)
            && row.holderId !== input.subject.houseId
            && !row.tags.includes(AGAINST_THEIR_OWN)
            && isHeavyEnough(row.severity))
        .map(row => ({
            key: row.id,
            houseId: row.holderId,
            subjectId: input.subject.id,
            subjectName: input.subject.name,
            subjectHouseId: input.subject.houseId,
            severity: row.severity,
            onDay: row.incurredOnDay >= input.runStartedOnDay
                ? row.incurredOnDay
                : input.runStartedOnDay + row.incurredOnDay,
            forWhat: whatTheHouseSaysItIsFor(row.cause)
        }));
}

// ─────────────────────────────────────────────────────────────────────────
// THE DECISION
// ─────────────────────────────────────────────────────────────────────────

function isHeavyEnough(severity: Severity): severity is HeavyEnoughToPost {
    return severity === 'grave' || severity === 'unforgivable';
}

/** Which honoured word a house's paper carries, off whoever heads it now. */
export function howThisHouseHonoursItsPaper(state: WorldState, houseId: string): Honoured {
    const head = npcsInFaction(state, houseId)[0];
    const hand = head ? openHandednessOf(head.id) : 0;
    return HOW_A_HEAD_HONOURS_THE_PAPER.find(row => hand >= row.atLeast)!.honoured;
}

/** What proof the paper asks for. All three are produced by one killing; see the header. */
export function whatProofThePaperAsksFor(honoured: Honoured, subjectHasAHouse: boolean): string {
    if (honoured === 'if_witnessed') return 'a death somebody the house trusts saw done';
    return subjectHasAHouse
        ? 'the token of the house they answer to, taken off the body'
        : 'the head, brought to its gate';
}

const THE_CATCH: Readonly<Record<Honoured, string>> = {
    reliably: 'It pays what the paper says to whoever brings what it asks for, and asks nothing about how.',
    usually: 'It pays most of the time. A season the treasury is short, a taker is told to come back, and some never are paid.',
    if_witnessed: 'It pays when somebody it trusts saw it done. A death nobody saw is a story, and the house does not pay for stories.',
    rarely: 'It put the purse up to be seen putting it up. Takers who came to collect have mostly been told the paper was somebody else\'s.'
};

function subjectsHouse(state: WorldState, subjectId: string): string | null {
    return state.npcs.find(n => n.id === subjectId)?.factionId ?? null;
}

/**
 * Whether this house puts a price on this person over this account, and the
 * paper if it does. Its own stream keyed on the account, so the answer is the
 * same whenever it is asked and no other draw in the world moves.
 */
export function whatAHouseWouldPost(
    state: WorldState,
    account: AHouseAccount
): PersonBounty | null {
    if (!isHeavyEnough(account.severity)) return null;
    const house = state.factions.find(f => f.id === account.houseId && f.dissolvedOnDay === null);
    if (!house || !isBelowTheLid(house)) return null;
    if (demonicStandingOf(house.id) !== undefined) return null;
    const theirHouse = account.subjectHouseId !== undefined
        ? account.subjectHouseId
        : subjectsHouse(state, account.subjectId);
    if (theirHouse === house.id) return null;

    const rng = forStream(state.seed, 'a-house-puts-a-price-on-somebody', account.key, house.id, account.subjectId);
    if (!rng.chance(A_HOUSE_PUTS_A_PRICE_ON_IT[account.severity])) return null;
    const postedOnDay = account.onDay + rng.int(
        A_HOUSE_TAKES_THIS_LONG_TO_PUT_UP_PAPER.min, A_HOUSE_TAKES_THIS_LONG_TO_PUT_UP_PAPER.max);

    const treasury = Math.max(0, Number(house.resources.spirit_stones ?? 0));
    const purseStones = Math.floor(treasury * WHAT_A_HOUSE_PUTS_UP_OF_ITS_PURSE[account.severity]);
    if (purseStones < A_PURSE_NOBODY_CROSSES_A_ROAD_FOR) return null;

    const honoured = howThisHouseHonoursItsPaper(state, house.id);
    return {
        id: '',
        what: `${account.subjectName}, named on a paper ${house.name} put up ${account.forWhat}`,
        posterFactionId: house.id,
        posterNote: `${house.name}, at its own gate and on every wall in the ground it answers for.`,
        purseCash: purseStones * CASH_PER_STONE,
        evidence: whatProofThePaperAsksFor(honoured, theirHouse !== null),
        honoured,
        catch: THE_CATCH[honoured],
        targetId: account.subjectId,
        targetName: account.subjectName,
        posterName: house.name,
        severity: account.severity,
        purseStones,
        postedOnDay,
        lapsesOnDay: postedOnDay + A_PRICE_STANDS_FOR_DAYS,
        forWhat: account.forWhat
    };
}

/**
 * Put up every paper that is due by `day` and not yet up. Safe to call as
 * often as anybody likes: an account already posted, or already decided
 * against, answers the same way every time.
 */
export function housesPutUpTheirPaper(
    state: WorldState,
    accounts: readonly AHouseAccount[],
    day: number
): PersonBounty[] {
    const already = new Set(state.history.facts
        .filter(f => f.kind === POSTED)
        .map(f => String(f.data.accountKey ?? '')));
    // ONE PAPER A HOUSE, A HEAD. A second death at the same hands is a second
    // account and not a second sheet beside the first: measured on `price-probe`
    // before this, one house had three papers up on one man at once.
    const standing = new Set(thePricesStanding(state, day).map(p => `${p.posterFactionId}|${p.targetId}`));
    const posted: PersonBounty[] = [];
    for (const account of accounts) {
        if (already.has(account.key)) continue;
        if (standing.has(`${account.houseId}|${account.subjectId}`)) continue;
        const paper = whatAHouseWouldPost(state, account);
        if (!paper || paper.postedOnDay > day || paper.lapsesOnDay <= day) continue;
        if (!theyAreStillAlive(state, paper.targetId)) continue;
        const house = state.factions.find(f => f.id === paper.posterFactionId)!;
        const fact = appendWorldFact(state, makeFact({
            day: paper.postedOnDay,
            kind: POSTED,
            scale: 'local',
            summary: `${house.name} put a price of ${paper.purseStones} spirit stones on `
                + `${paper.targetName}, ${paper.forWhat}.`,
            actors: [{ id: paper.targetId, name: paper.targetName, role: 'named' }],
            locationId: house.seatLocationId,
            factionIds: [house.id],
            visibility: 'regional',
            magnitude: 0.4,
            data: {
                accountKey: account.key,
                priceOn: paper.targetId,
                priceOnName: paper.targetName,
                purseStones: paper.purseStones,
                evidence: paper.evidence,
                honoured: paper.honoured,
                severity: paper.severity,
                lapsesOnDay: paper.lapsesOnDay,
                forWhat: paper.forWhat,
                unattributed: 'A house has put a price on somebody, and the paper is on the walls.'
            }
        }), { recur: false, bystanders: false });
        already.add(account.key);
        standing.add(`${account.houseId}|${account.subjectId}`);
        posted.push({ ...paper, id: fact.id });
    }
    return posted;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IS STANDING
// ─────────────────────────────────────────────────────────────────────────

function theyAreStillAlive(state: WorldState, personId: string): boolean {
    const npc = state.npcs.find(n => n.id === personId);
    if (npc) return npc.status === 'alive';
    return state.runs.some(r => r.cultivatorId === personId && r.endedOnDay === null);
}

function paperFrom(state: WorldState, fact: HistoricalFact): PersonBounty | null {
    const houseId = fact.factionIds[0];
    const house = houseId ? state.factions.find(f => f.id === houseId) : undefined;
    const severity = severityOf(fact.data.severity);
    if (!house || !severity || !isHeavyEnough(severity)) return null;
    const honoured = String(fact.data.honoured) as Honoured;
    const purseStones = Number(fact.data.purseStones);
    return {
        id: fact.id,
        what: `${String(fact.data.priceOnName)}, named on a paper ${house.name} put up ${String(fact.data.forWhat)}`,
        posterFactionId: house.id,
        posterNote: `${house.name}, at its own gate and on every wall in the ground it answers for.`,
        purseCash: purseStones * CASH_PER_STONE,
        evidence: String(fact.data.evidence),
        honoured,
        catch: THE_CATCH[honoured] ?? THE_CATCH.rarely,
        targetId: String(fact.data.priceOn),
        targetName: String(fact.data.priceOnName),
        posterName: house.name,
        severity,
        purseStones,
        postedOnDay: fact.day,
        lapsesOnDay: Number(fact.data.lapsesOnDay),
        forWhat: String(fact.data.forWhat)
    };
}

/** The papers somebody has already been paid on. */
function paidOn(state: WorldState): Set<string> {
    return new Set(state.history.facts
        .filter(f => f.kind === 'grudge_settled' && typeof f.data.priceFactId === 'string')
        .map(f => String(f.data.priceFactId)));
}

/**
 * Every price standing on `day`: posted, not run out, not paid on, and the
 * person on it still alive.
 */
export function thePricesStanding(state: WorldState, day: number): PersonBounty[] {
    const paid = paidOn(state);
    const out: PersonBounty[] = [];
    for (const fact of state.history.facts) {
        if (fact.kind !== POSTED || fact.day > day || paid.has(fact.id)) continue;
        const paper = paperFrom(state, fact);
        if (!paper || paper.lapsesOnDay <= day) continue;
        if (!theyAreStillAlive(state, paper.targetId)) continue;
        out.push(paper);
    }
    return out;
}

/**
 * Every paper nobody has been paid on, standing or not: a claim on one whose
 * person is dead is a claim on a paper that no longer stands.
 */
export function thePapersNotYetPaidOn(state: WorldState): PersonBounty[] {
    const paid = paidOn(state);
    return state.history.facts
        .filter(f => f.kind === POSTED && !paid.has(f.id))
        .flatMap(f => paperFrom(state, f) ?? []);
}

/** A price ever posted, standing or not, by the fact it was posted as. */
export function thePaperPostedAs(state: WorldState, factId: string): PersonBounty | null {
    const fact = state.history.facts.find(f => f.id === factId && f.kind === POSTED);
    return fact ? paperFrom(state, fact) : null;
}

/**
 * Whether somebody standing at this place can read this paper on a wall there:
 * a place with a wall, in ground the house's word reaches. The same two tests
 * `noticesOnTheWall` puts every paper through.
 */
export function thePaperHangsAt(paper: Pick<PersonBounty, 'posterFactionId'>, placeName: string | null): boolean {
    if (!paper.posterFactionId || !placeName) return false;
    if (BILLS_A_WALL_CARRIES[postingGroundOf(placeName)] <= 0) return false;
    return reachesThisGround(
        { provinceId: provinceForFaction(paper.posterFactionId)?.id ?? null },
        provinceOfPlace(placeName)
    );
}

// ─────────────────────────────────────────────────────────────────────────
// WHO TAKES ONE UP
// ─────────────────────────────────────────────────────────────────────────


/**
 * Somebody who has read this paper and would go after the person on it, where
 * the person is somebody the world does not move - the player. The least of
 * them who stands at or above the person, as a house sends; nobody where nobody
 * does, because somebody who expects to lose does not go for a purse. The same
 * person is named every time until they are dead, and then the next.
 */
export function whoTakesUpThePrice(
    state: WorldState,
    paper: PersonBounty,
    target: { id: string; realmOrdinal: number; houseId: string | null }
): NpcRecord | null {
    const places = new Map(state.locations.map(l => [l.id, l.name] as const));
    const candidates = state.npcs.filter(n =>
        n.status === 'alive'
        && isTheWorldsToMove(n)
        && isBelowTheLid(n)
        && n.id !== target.id
        && n.factionId !== paper.posterFactionId
        && (target.houseId === null || n.factionId !== target.houseId)
        && n.cultivation.realmOrdinal >= target.realmOrdinal
        && whatAPriceIsWorthTo(n, paper.purseStones) > 0
        && thePaperHangsAt(paper, n.locationId ? places.get(n.locationId) ?? null : null))
        .sort((a, b) => a.cultivation.realmOrdinal - b.cultivation.realmOrdinal || (a.id < b.id ? -1 : 1));
    if (candidates.length === 0) return null;
    const least = candidates[0]!.cultivation.realmOrdinal;
    const atThatRung = candidates.filter(n => n.cultivation.realmOrdinal === least);
    return atThatRung[forStream(state.seed, 'who-takes-up-a-price', paper.id).int(0, atThatRung.length - 1)]!;
}

// ─────────────────────────────────────────────────────────────────────────
// BRINGING IT IN
// ─────────────────────────────────────────────────────────────────────────

/** The death the world holds naming this killer and this victim, if it holds one. */
export function theDeathTheyAreHeldFor(
    state: WorldState,
    killerId: string,
    victimId: string
): HistoricalFact | null {
    return state.history.facts.find(f =>
        roleIn(f, 'killer')?.id === killerId && roleIn(f, 'victim')?.id === victimId) ?? null;
}

export interface APriceBroughtIn {
    paid: boolean;
    stones: number;
    fact: HistoricalFact;
    /** One engine line. Never narration. */
    line: string;
}

/**
 * Somebody brings the house the proof. Whether it pays is the paper's honoured
 * word, drawn on its own stream; a paid purse comes out of the treasury and the
 * paper is closed for everybody. A refusal closes it too - the person on it is
 * dead - and the fact says the house did not pay.
 */
export function aPriceIsBroughtIn(
    state: WorldState,
    input: {
        paper: PersonBounty;
        claimantId: string;
        claimantName: string;
        death: HistoricalFact;
        day: number;
    }
): APriceBroughtIn {
    const { paper } = input;
    const house = state.factions.find(f => f.id === paper.posterFactionId) as FactionRecord;
    const seen = input.death.visibility !== 'secret';
    const rng = forStream(state.seed, 'a-price-is-paid', paper.id, input.claimantId);
    const pays = paper.honoured === 'if_witnessed'
        ? seen
        : rng.chance(WHETHER_A_HOUSE_PAYS[paper.honoured]);
    const treasury = Math.max(0, Number(house.resources.spirit_stones ?? 0));
    const stones = pays ? Math.min(paper.purseStones, treasury) : 0;
    if (stones > 0) {
        house.resources.spirit_stones = treasury - stones;
        const taker = state.npcs.find(n => n.id === input.claimantId);
        if (taker && isTheWorldsToMove(taker)) taker.spiritStones = Number(taker.spiritStones ?? 0) + stones;
    }
    const summary = stones > 0
        ? `${house.name} paid ${input.claimantName} ${stones} spirit stones on the paper it had put up on ${paper.targetName}.`
        : `${input.claimantName} brought ${house.name} the proof it had asked for on ${paper.targetName}, and ${house.name} did not pay.`;
    const fact = appendWorldFact(state, makeFact({
        day: input.day,
        kind: 'grudge_settled',
        summary,
        actors: [
            { id: input.claimantId, name: input.claimantName, role: 'claimant' },
            { id: paper.targetId, name: paper.targetName, role: 'named' }
        ],
        locationId: house.seatLocationId,
        factionIds: [house.id],
        visibility: 'regional',
        magnitude: 0.35,
        data: {
            priceFactId: paper.id, purseStones: paper.purseStones, paid: stones > 0, deathFactId: input.death.id,
            unattributed: "Somebody went to a house's gate to be paid for a death."
        }
    }), { recur: false, bystanders: false });
    return { paid: stones > 0, stones, fact, line: summary };
}
