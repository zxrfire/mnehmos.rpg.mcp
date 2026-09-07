/**
 * The ledger, read from the side the player is standing on.
 *
 * ── THE HALF THAT HAD NO READER ───────────────────────────────────────────
 *
 * The obligation ledger is written from everywhere: a landed approach leaves a
 * favour, a refused one leaves a grudge, a bout past what was agreed leaves a
 * blood feud, an oath leaves a bound word. `whatYouBringToBear` prices those
 * rows on every later approach, and `whoIsHuntingThisCultivator` reads them to
 * decide who is coming.
 *
 * What no sentence reached was the player asking. `oath` with intent `read`
 * came closest and answers a narrower question than its own name: it lists
 * `openOathsHeldBy`, which is oaths THE PLAYER SWORE - one kind out of five,
 * one direction out of two. Measured on the played corpus, every one of these
 * came back `unclear`:
 *
 *     what am I owed          who owes me           what do I owe
 *     what does he owe me     what is between us
 *
 * So a debt the world had written down, and would charge the player for, was a
 * thing the player could not ask about in any words at all.
 *
 * `AGENTS.md`: every read runs both ways unless there is a reason it cannot.
 * There is no reason this one cannot.
 *
 * ── FOUR BUCKETS, AND WHY THEY ARE NOT TWO ────────────────────────────────
 *
 * A row is either something to make good or something not forgiven -
 * `whichWayItPoints` decides which, and it is the only thing that may - and
 * each of those runs in two directions. Four is the whole of it, and the
 * player wants them apart: what you owe is a bill, what you are owed is an
 * asset, what is held against you is a hazard, and what you hold is a lever.
 * One list of "obligations" would be all four at once and useful for none.
 *
 * Pure. Rows and a name resolver in, sentences out.
 */

import {
    SEVERITY_IN_WORDS,
    whichWayItPoints,
    type ObligationRecord
} from '../engine/social/grudges.js';

/** What one row is, said as a person would say it. */
export interface OneRowOfTheLedger {
    /** The other party, by name where there is one. */
    readonly withWhom: string;
    /** The line itself. */
    readonly line: string;
    /** For the mechanical channel. */
    readonly structure: string;
}

export interface WhatStandsBetweenYouAndEverybody {
    /** Bills: things this person has to make good. */
    readonly youOwe: readonly OneRowOfTheLedger[];
    /** Assets: things somebody has to make good to them. */
    readonly owedToYou: readonly OneRowOfTheLedger[];
    /** Hazards: what somebody has not forgiven them for. */
    readonly heldAgainstYou: readonly OneRowOfTheLedger[];
    /** Levers: what they have not forgiven, or know. */
    readonly youHold: readonly OneRowOfTheLedger[];
    /** True when all four are empty. */
    readonly nothingAtAll: boolean;
}

/** An account with no name on it is still an account. */
const NOBODY_IN_PARTICULAR = 'somebody whose name is not written down';

/** The cause, in words rather than in a column value. */
function inWords(record: ObligationRecord): string {
    return record.cause.replace(/_/g, ' ');
}

/** The terms where a row carries them, and what happened where it does not. */
function whatItSays(record: ObligationRecord): string {
    const said = (record.terms ?? record.description ?? '').trim();
    return said.length > 0 ? said : 'Nothing further is written down about it.';
}

function rowFor(
    record: ObligationRecord,
    otherId: string | null,
    nameOf: (id: string) => string,
    lead: string
): OneRowOfTheLedger {
    const withWhom = otherId === null ? NOBODY_IN_PARTICULAR : nameOf(otherId);
    return {
        withWhom,
        // `at grave` was the band's own key with a preposition in front of
        // it. `SEVERITY_IN_WORDS` is where that fact lives, and the deed
        // line reads the same table.
        line: `${lead} ${withWhom}: ${inWords(record)}, and the world holds it as `
            + `${SEVERITY_IN_WORDS[record.severity]}. ${whatItSays(record)}`,
        structure: `${record.id}:${record.kind}:${record.cause}:${record.severity}`
    };
}

/**
 * What stands between this person and everybody, or between them and one named
 * party when the sentence named one.
 *
 * Open rows only. A settled account is history, and the question *what am I
 * owed* is not a question about history - `ledgerAbout` keeps both statuses on
 * purpose so a caller looking at a whole life can have the closed ones, and
 * this caller is not that one.
 */
export function whatStandsBetweenYouAndEverybody(input: {
    readonly rows: readonly ObligationRecord[];
    readonly meId: string;
    readonly nameOf: (id: string) => string;
    /** Narrow to one party, when the sentence named somebody. */
    readonly onlyWithId?: string | null;
}): WhatStandsBetweenYouAndEverybody {
    const youOwe: OneRowOfTheLedger[] = [];
    const owedToYou: OneRowOfTheLedger[] = [];
    const heldAgainstYou: OneRowOfTheLedger[] = [];
    const youHold: OneRowOfTheLedger[] = [];

    for (const record of input.rows) {
        if (record.status !== 'open') continue;

        const points = whichWayItPoints(record);
        const me = input.meId;

        // The other end of this row, whichever end the player is on. Computed
        // before the filter so a row the player is not party to at all - which
        // `ledgerAbout` does not return, and a caller could still pass - falls
        // out of every bucket rather than into a wrong one.
        if (points.sense === 'owes') {
            const mine = points.owerId === me ? 'owe' : points.owedId === me ? 'owed' : null;
            if (mine === null) continue;
            const other = mine === 'owe' ? points.owedId : points.owerId;
            if (input.onlyWithId && other !== input.onlyWithId) continue;
            (mine === 'owe' ? youOwe : owedToYou).push(rowFor(
                record, other, input.nameOf,
                mine === 'owe' ? 'Owed by you to' : 'Owed to you by'
            ));
            continue;
        }

        const mine = points.offenderId === me
            ? 'against'
            : points.aggrievedId === me ? 'held' : null;
        if (mine === null) continue;
        const other = mine === 'against' ? points.aggrievedId : points.offenderId;
        if (input.onlyWithId && other !== input.onlyWithId) continue;
        (mine === 'against' ? heldAgainstYou : youHold).push(rowFor(
            record, other, input.nameOf,
            mine === 'against' ? 'Held against you by' : 'Held by you against'
        ));
    }

    return {
        youOwe,
        owedToYou,
        heldAgainstYou,
        youHold,
        nothingAtAll: youOwe.length === 0 && owedToYou.length === 0
            && heldAgainstYou.length === 0 && youHold.length === 0
    };
}

/**
 * The four buckets as the lines a player reads, in the order that matters to
 * somebody deciding what to do next: what can be called in, what is coming for
 * them, what they can lean on, what they have to settle.
 */
export function theLedgerAsLines(
    stands: WhatStandsBetweenYouAndEverybody,
    /** The name the question was asked about, when it named one. */
    aboutWhom: string | null
): string[] {
    if (stands.nothingAtAll) {
        return [
            aboutWhom === null
                ? 'Nothing, in either direction. Nobody has your name written against '
                  + 'anything and you have nobody\'s against yours, which is a lighter thing '
                  + 'to be than it sounds and does not last.'
                : `Nothing stands between you and ${aboutWhom}. No account is open either `
                  + 'way, so whatever passes next passes between strangers.'
        ];
    }

    const lines: string[] = [];
    const section = (heading: string, rows: readonly OneRowOfTheLedger[]): void => {
        if (rows.length === 0) return;
        lines.push(heading);
        for (const row of rows) lines.push(`  ${row.line}`);
    };

    section('Owed to you. Somebody has to make these good, and asking is how.',
        stands.owedToYou);
    section('Held against you. Nobody has forgiven these, and they cost you on every '
        + 'approach to the person holding them.', stands.heldAgainstYou);
    section('Held by you. What you have not forgiven, and what you know.', stands.youHold);
    section('Owed by you. These are bills, and the world collects.', stands.youOwe);
    return lines;
}

/**
 * The one-line answer, which has to cover both halves.
 *
 * A cultivator bound by nothing who is owed four favours is not "bound by
 * nothing" in any sense they care about, and that was the whole headline this
 * read used to give them.
 */
export function headlineForTheLedger(
    openOaths: number,
    stands: WhatStandsBetweenYouAndEverybody,
    aboutWhom: string | null
): string {
    const counted = stands.owedToYou.length + stands.heldAgainstYou.length
        + stands.youHold.length + stands.youOwe.length;

    if (aboutWhom !== null) {
        return counted === 0
            ? `Nothing open between you and ${aboutWhom}.`
            : `${counted} open between you and ${aboutWhom}.`;
    }
    if (openOaths === 0 && counted === 0) return 'Nothing open, either way.';

    const parts: string[] = [];
    if (openOaths > 0) parts.push(`${openOaths} open oath${openOaths === 1 ? '' : 's'}`);
    if (stands.owedToYou.length > 0) parts.push(`${stands.owedToYou.length} owed to you`);
    if (stands.heldAgainstYou.length > 0) {
        parts.push(`${stands.heldAgainstYou.length} held against you`);
    }
    if (stands.youHold.length > 0) parts.push(`${stands.youHold.length} you hold`);
    if (stands.youOwe.length > 0) parts.push(`${stands.youOwe.length} owed by you`);
    return `${parts.join(', ')}.`;
}
