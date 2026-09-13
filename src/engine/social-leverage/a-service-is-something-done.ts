/**
 * A service: something done, by you, that they cannot do themselves.
 *
 * The offer ladder in `what-they-will-take-instead-of-money.ts` runs
 * `stones < goods < a favour < a service < a hold`, and four of its five rungs
 * had somewhere to live. A favour has a store, a write and a read - an
 * `ObligationRecord` of kind `favor`, opened by the verbs that do somebody a
 * kindness and read by `whoWouldWalkYouIn` and by the beast ask. A service had
 * none of the three, so a person on that rung was asking for a thing nothing in
 * the engine could notice had been done.
 *
 * Measured: the one changed beast reachable everywhere in the world is on the
 * service rung 93% of the time, which made the most available high-end content
 * in the game unwalkable.
 *
 * ── WHY THIS IS THE SAME LEDGER AND NOT A SECOND STORE ───────────────────
 *
 * The row already exists and is already written this shape. `acceptDuty` and
 * `completeDuty` in `src/web/encounters.ts` open an `oath` at cause
 * `service_term`, hold it by the person who gave their word, carry the length
 * in `terms` and the deadline in `dueOnDay`, and close it `oath_fulfilled` when
 * the days are served. That is work taken off a house's board. Work asked for
 * by a PERSON is the identical row with nobody's house on it, so a second
 * table would be one fact kept twice.
 *
 * ── AND A SERVICE IS NOT A FAVOUR ────────────────────────────────────────
 *
 * They are two rungs apart on the ladder and they differ in what discharges
 * them, which is what makes one cost more than the other:
 *
 *     a favour    kind `favor`, held by whoever did the kindness. It is a
 *                 CLAIM, it sits open until it is called in, and what closes it
 *                 is the holder deciding it is closed.
 *     a service   kind `oath`, held by whoever gave their word. It is WORK, it
 *                 names a span of days, and what closes it is the days being
 *                 served. Nobody can forgive it into existence.
 *
 * Which is also why a service outranks a favour as payment. Owing somebody an
 * account costs you nothing today; going and spending a season on their
 * business costs you the season.
 *
 * ── A SERVICE DONE BUYS ONE THING ────────────────────────────────────────
 *
 * `turn-engine.ts` settles a favour `repaid` the moment it buys something,
 * because leaving it open would let one kindness buy a body twice. A service
 * cannot be settled twice - it is already settled, `oath_fulfilled` - so what
 * it bought is written on its own tag list, which `grudges.ts` calls "free
 * handles for querying" and which `daysServedOn` already uses as an extension
 * point for the same kind of fact.
 */

import { ORDINARY_DUTY_DAYS } from '../encounters/duties.js';
import type { DayIndex } from '../social/common.js';
import {
    SEVERITY_ORDER,
    type ObligationInput,
    type ObligationRecord,
    type Severity
} from '../social/grudges.js';
import {
    LEVERAGE_ATTEMPT_CONSTANTS,
    type AskWeight
} from './an-attempt-to-move-somebody.js';

/** What marks a row as one of these. The only place that fact lives. */
export const SERVICE_TAG = 'service';

/** What a service that has already bought something is marked with. */
const SPENT = 'spent:';

/**
 * The ask weights, mildest first.
 *
 * Declared here because nothing else ordered them and the order is a fact about
 * the vocabulary rather than about this file - `ASK_RESISTANCE`, `ASK_DAYS` and
 * `PURSE_REACH` all move monotonically along it.
 */
export const ASK_WEIGHTS_IN_ORDER: readonly AskWeight[] =
    ['a_courtesy', 'a_real_favour', 'against_their_interest', 'a_betrayal'];

/**
 * How many days a service for an ask of this weight runs to.
 *
 * `ORDINARY_DUTY_DAYS` is the repo's unit of work - what one errand off a
 * board comes to - and `PURSE_REACH` is how far a purse reaches for an ask of
 * this weight. Dividing one by the other says the thing the ladder already
 * says: where money stops reaching, work is what is left, and the less it
 * reaches the more work it is.
 *
 * Measured over the four weights: 20, 33, 100 and 400 days. Only the middle two
 * are reachable, because a courtesy never leaves the stones rung and a betrayal
 * is floored at `a hold`.
 */
export function howLongAServiceRuns(ask: AskWeight): number {
    const reach = LEVERAGE_ATTEMPT_CONSTANTS.PURSE_REACH[ask];
    if (!(reach > 0)) return ORDINARY_DUTY_DAYS;
    return Math.max(1, Math.round(ORDINARY_DUTY_DAYS / reach));
}

/**
 * How heavy the word is, which is how heavy the ask it pays for is.
 *
 * Both vocabularies are four words ordered safe to dangerous, so the rung is
 * read across rather than mapped in a table that could disagree with either.
 */
export function howHeavyAServiceIs(ask: AskWeight): Severity {
    const at = ASK_WEIGHTS_IN_ORDER.indexOf(ask);
    return SEVERITY_ORDER[Math.max(0, Math.min(SEVERITY_ORDER.length - 1, at))];
}

export interface AServiceUndertaken {
    /** Who is going to do it. */
    doerId: string;
    /** Who it is for. A service is done FOR somebody, never in the air. */
    forWhomId: string;
    /** Their name, for the row's own words. */
    forWhomName: string;
    /** What they want done, in whoever's words said it. Never parsed. */
    what: string;
    /** How heavy the thing this pays for is. Decides the days and the weight. */
    ask: AskWeight;
    onDay: DayIndex;
}

/**
 * The row a word given to go and do something opens.
 *
 * `terms` carries what was undertaken and how long, because `grudges.ts` is
 * explicit that an oath's terms are prose written by whoever swore it: the
 * engine decides the days, the discharge and what it buys, and the narrator
 * says what the thing IS. That is the authority line, kept.
 */
export function undertakingAService(input: AServiceUndertaken): ObligationInput {
    const days = howLongAServiceRuns(input.ask);
    return {
        kind: 'oath',
        holderId: input.doerId,
        subjectId: input.forWhomId,
        cause: 'service_term',
        severity: howHeavyAServiceIs(input.ask),
        onDay: input.onDay,
        description: `Gave their word to ${input.forWhomName} on day ${input.onDay}.`,
        terms: `${input.what} ${days} days.`,
        dueOnDay: input.onDay + days,
        tags: [SERVICE_TAG, `ask:${input.ask}`]
    };
}

/**
 * How heavy the thing this word was given for was, off the row's own tag.
 *
 * The term's length is a function of it, so reading it back rather than storing
 * the number is what stops a row and the arithmetic disagreeing.
 */
export function theAskThisServiceIsFor(record: ObligationRecord): AskWeight {
    const tag = record.tags.find(t => t.startsWith('ask:'))?.slice('ask:'.length);
    return ASK_WEIGHTS_IN_ORDER.find(weight => weight === tag) ?? 'a_real_favour';
}

/** Whether this row is a service at all. */
export function isAService(record: ObligationRecord): boolean {
    return record.kind === 'oath'
        && record.cause === 'service_term'
        && record.tags.includes(SERVICE_TAG);
}

/** What a service already bought, or null where it is still standing. */
export function whatThisServiceAlreadyBought(record: ObligationRecord): string | null {
    const tag = record.tags.find(t => t.startsWith(SPENT));
    return tag ? tag.slice(SPENT.length) : null;
}

/**
 * The word already given by this person to that one, or null.
 *
 * One at a time, deliberately. Somebody who has given their word to go and do a
 * thing and has not done it has nothing to offer the same person a second word
 * for, and stacking them would let a player promise their way up the ladder
 * without leaving the square.
 */
export function theServiceYouGaveYourWordOn(
    ledger: readonly ObligationRecord[],
    doerId: string,
    forWhomId: string
): ObligationRecord | null {
    return ledger.find(row =>
        isAService(row)
        && row.status === 'open'
        && row.holderId === doerId
        && row.subjectId === forWhomId) ?? null;
}

/**
 * Services this person has DONE for that one and has not yet spent.
 *
 * The read the offer ladder wants: standing on the service rung means having
 * gone and done something, not having said you would.
 */
export function servicesYouHaveDoneFor(
    ledger: readonly ObligationRecord[],
    doerId: string,
    forWhomId: string
): ObligationRecord[] {
    return ledger.filter(row =>
        isAService(row)
        && row.status === 'settled'
        && row.settlement?.resolution === 'oath_fulfilled'
        && row.holderId === doerId
        && row.subjectId === forWhomId
        && whatThisServiceAlreadyBought(row) === null);
}

/**
 * The one a caller would spend, or null where there is nothing to spend.
 *
 * Oldest first, which is what `ledgerAbout` already orders by: a thing done
 * years ago is spent before a thing done last month, so the standing somebody
 * has been carrying longest is the standing that goes.
 */
export function theServiceYouWouldSpend(
    ledger: readonly ObligationRecord[],
    doerId: string,
    forWhomId: string
): ObligationRecord | null {
    return servicesYouHaveDoneFor(ledger, doerId, forWhomId)[0] ?? null;
}

/**
 * The same question with the ends swapped: what has been done FOR this person,
 * by anybody, and what they have given their word to do.
 *
 * `AGENTS.md`: if the engine can answer "what have you done for them", it must
 * answer "what has anybody done for you". This is the half that lets a person
 * being asked see what the asker is standing on.
 */
export function servicesDoneForYou(
    ledger: readonly ObligationRecord[],
    personId: string
): ObligationRecord[] {
    return ledger.filter(row =>
        isAService(row)
        && row.status === 'settled'
        && row.subjectId === personId
        && whatThisServiceAlreadyBought(row) === null);
}

/** Words this person has given and not yet served out, to anybody. */
export function servicesYouOwe(
    ledger: readonly ObligationRecord[],
    personId: string
): ObligationRecord[] {
    return ledger.filter(row =>
        isAService(row) && row.status === 'open' && row.holderId === personId);
}

/**
 * How long this term runs in total, read back off the row.
 *
 * Never off `dueOnDay - incurredOnDay`: a term broken off and picked up again
 * is served from where it stopped, and a deadline that has already gone by
 * would otherwise say the work was zero days long.
 */
export function howLongThisTermRuns(record: ObligationRecord): number {
    return howLongAServiceRuns(theAskThisServiceIsFor(record));
}

/**
 * The row, marked as having bought something.
 *
 * Returns a record rather than writing one: nothing in `engine/` persists.
 */
export function aServiceSpentOn(
    record: ObligationRecord,
    what: string
): ObligationRecord {
    if (whatThisServiceAlreadyBought(record) !== null) return record;
    return { ...record, tags: [...record.tags, `${SPENT}${what}`] };
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE ENGINE SAYS ABOUT ONE
// ─────────────────────────────────────────────────────────────────────────

/** What the word now standing commits this cultivator to. */
export function whatWasUndertaken(
    forWhomName: string,
    what: string,
    days: number,
    dueOnDay: DayIndex
): string {
    return `You have given ${forWhomName} your word: ${what} It runs ${days} days and it is `
        + `due on day ${dueOnDay}. It is not discharged by being owed. It is discharged by `
        + 'the days being served.';
}

/** What a served term leaves behind. */
export function whatServingItLeft(forWhomName: string, days: number): string {
    return `${days} days are spent and the term is served. ${forWhomName} has what was asked `
        + 'for, and the ledger holds that you did it.';
}

/** A term broken off part way. Nothing is discharged and the word still stands. */
export function whatABrokenTermLeft(
    forWhomName: string,
    served: number,
    days: number,
    dueOnDay: DayIndex
): string {
    return `${served} of ${days} days went into it and the rest did not. The word given to `
        + `${forWhomName} is still open and still due on day ${dueOnDay}. Nothing was done, so `
        + 'nothing is owed for it.';
}

/**
 * What a player on the service rung with nothing done has to do about it.
 *
 * The refusal that names the honest route, which is what every refusal in this
 * engine owes: not that they said no, but that what would change it is a
 * stretch of days rather than a bigger offer.
 */
export function whatWouldPutYouOnTheServiceRung(theirName: string): string {
    return `Nothing you are carrying is what ${theirName} wants. What they want is something `
        + 'done, and saying you will do it is not the same as having done it. Give your word, '
        + 'go and serve the term out, and come back.';
}
