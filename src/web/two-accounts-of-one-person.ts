/**
 * Two accounts of one person, and either holder may be the one who notices.
 *
 * `recordAnAccountGiven` could write a lie down and nothing could ever read it
 * back: the row sat in the hearer's head with `fabricated` on it, no person in
 * the world compared it against anything, and a player could give a different
 * house to every gate guard in the province without once being asked.
 *
 * ── IT RUNS BOTH WAYS, AND NEITHER WAY IS THE SPECIAL CASE ───────────────
 *
 * The account itself is written at both ends for this reason - the hearer holds
 * the claim, the speaker holds having given it - and a challenge is the same
 * shape one rung up. The world's own people gainsay an account put to them
 * (`tell`), and the player gainsays one that was put to them (`challenge`).
 * Both are the read below, run from opposite ends: two holders, one subject,
 * two statements that cannot both stand.
 *
 * ── WHAT IS COMPARED, AND WHY NOT THE STATEMENT ──────────────────────────
 *
 * `KnowledgeLedger.disagreementsAbout` groups held claims by their exact
 * statement, which is the right read for "what versions of this are going
 * about" and the wrong one here: a holder's rows about one person include the
 * bare existence row - `X exists.` - beside an account of them, and those two
 * strings differ without disagreeing about anything. So the comparison is over
 * the PARTS of an account, which is `whereTwoAccountsDisagree`, and a row that
 * is not an account is skipped rather than counted as a second version.
 *
 * ── TWO ACCOUNTS DISAGREEING SETTLES NOTHING ─────────────────────────────
 *
 * Nothing in this file reads a `sourceKind` for a verdict or puts one account
 * above another. Who was lying was settled where the world settles it - at the
 * moment the row was written, by a comparison against the speaker's own row -
 * and {@link whatTheyCaught} is the one place that answer is allowed to be
 * joined to a disagreement. Where the two do not meet, the engine has two
 * claims and no opinion, which is exactly what a person in the room would have.
 */

import type { EngineFacts } from './facts.js';
import type { AwarenessRow } from './knowledge.js';
import {
    theAccountInAStatement,
    whereTwoAccountsDisagree,
    type AnAccountOfThemselves,
    type PartOfAnAccount
} from './an-account-of-yourself.js';

/** One account of one person, and who is holding it. */
export interface AnAccountHeld {
    holderId: string;
    /** Who they are, as a reader would say it. Null where nobody needs naming. */
    holderName: string | null;
    account: AnAccountOfThemselves;
    /** The row's own words, quoted rather than rebuilt. */
    statement: string;
    onDay: number;
    /** How they came by it, in their own terms. Never says whether it is so. */
    note: string;
}

/**
 * The accounts among a holder's rows about one person, oldest first.
 *
 * Rows that are not accounts - the bare existence row, a note about where
 * somebody was seen - come back out of this empty-handed, which is what keeps
 * an ordinary encounter from reading as a contradiction.
 */
export function theAccountsAmong(
    rows: readonly AwarenessRow[],
    holderId: string,
    holderName: string | null = null
): AnAccountHeld[] {
    const held: AnAccountHeld[] = [];
    for (const row of rows) {
        const account = theAccountInAStatement(row.statement);
        if (account === null) continue;
        held.push({
            holderId,
            holderName,
            account,
            statement: row.statement,
            onDay: row.acquiredOnDay,
            note: row.sourceNote
        });
    }
    return held;
}

/** An account, and the parts of it another account cannot agree with. */
export interface AnAccountContradicted {
    held: AnAccountHeld;
    apart: PartOfAnAccount[];
}

/**
 * What is held that this account cannot be squared with, newest first.
 *
 * Newest first because the newest is what somebody would say out loud: a hearer
 * who was told something yesterday says so before going back through everything
 * they have ever heard.
 */
export function whatIsHeldAgainstThisAccount(
    held: readonly AnAccountHeld[],
    given: AnAccountOfThemselves
): AnAccountContradicted[] {
    const against: AnAccountContradicted[] = [];
    for (const row of held) {
        const apart = whereTwoAccountsDisagree(row.account, given);
        if (apart.length > 0) against.push({ held: row, apart });
    }
    return against.sort((a, b) => b.held.onDay - a.held.onDay);
}

/**
 * Whether being gainsaid actually caught anything.
 *
 * BOTH HALVES ARE REQUIRED AND NEITHER IS ENOUGH. The world has to know the
 * account is not so - `notSo` is the omniscient comparison, made once, where
 * the row was written - and the person gainsaying it has to have something that
 * lands on the SAME part. Somebody who disagrees about a rung has not caught a
 * false name, and somebody who disagrees about a true account has simply got it
 * wrong. That second case is why this returns a list rather than a boolean: an
 * empty one is a challenge that missed, and a challenge that misses is a thing
 * the player did to somebody.
 */
export function whatTheyCaught(
    against: readonly AnAccountContradicted[],
    notSo: readonly PartOfAnAccount[]
): PartOfAnAccount[] {
    const caught = new Set<PartOfAnAccount>();
    for (const row of against) {
        for (const part of row.apart) {
            if (notSo.includes(part)) caught.add(part);
        }
    }
    return [...caught];
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IS SAID ABOUT IT, EITHER WAY ROUND
// ─────────────────────────────────────────────────────────────────────────

/**
 * What somebody says when what they are being told is not what they have.
 *
 * One plain sentence and the row quoted. It does not say the speaker is lying,
 * because the hearer does not know that and neither does the room: what there
 * is, is two accounts, and only one of them can stand.
 */
export function whatTheHearerSaysBack(
    hearerName: string,
    against: AnAccountContradicted
): string {
    return `${hearerName} says that is not what they have of you. What they have, from day `
        + `${against.held.onDay}: ${against.held.statement}`;
}

/**
 * The engine channel for a gainsaying, either direction. `caught` is the
 * omniscient half and stays here, where the narrator cannot reach it.
 */
export function howTheGainsayingReads(
    who: string,
    against: AnAccountContradicted,
    caught: readonly PartOfAnAccount[]
): string {
    return `account gainsaid: ${who} holds "${against.held.statement}" (day `
        + `${against.held.onDay}), which disagrees on ${against.apart.join(', ')}. `
        + (caught.length === 0
            ? 'Nothing in the account being gainsaid is untrue, so the disagreement belongs to '
              + 'whoever is holding the other row and nothing opens against the speaker.'
            : `Not so: ${caught.join(', ')}.`);
}

/** What the player is told back when they put a challenge to somebody. */
export function factsForAChallenge(input: {
    subject: string;
    /** The account being gainsaid, quoted. */
    challenged: AnAccountHeld;
    /** What the player had to put against it. Empty is a bare accusation. */
    against: readonly AnAccountContradicted[];
    /** The parts the world knows are not so and the player has landed on. */
    caught: readonly PartOfAnAccount[];
}): EngineFacts {
    const lines: string[] = [
        `You put it to ${input.subject} that what they told you does not stand. What they told `
        + `you: ${input.challenged.statement}`
    ];

    for (const row of input.against) {
        lines.push(
            `What you have against it: ${row.held.statement}`
            + (row.held.holderName === null ? '' : ` ${row.held.holderName} is the source.`)
        );
    }

    if (input.against.length === 0) {
        lines.push(
            `You have nothing to put against it. ${input.subject} hears you call them a liar in `
            + 'front of whoever is standing here, and says what anybody says.'
        );
    } else if (input.caught.length === 0) {
        lines.push(
            `${input.subject} does not give way. The two accounts still cannot both stand, and `
            + 'nothing here decides which of them does.'
        );
    } else {
        lines.push(
            `${input.subject} has no answer for it. ${theParts(input.caught)} they gave you was `
            + 'not theirs to give.'
        );
    }

    return {
        headline: input.caught.length === 0
            ? `You call ${input.subject} on their account of themselves.`
            : `${input.subject} is caught in it.`,
        lines,
        prose: lines.join('\n'),
        structure: [
            `challenge: ${input.against.length} contradicting account(s) held about `
            + `${input.subject}. `
            + (input.caught.length === 0
                ? 'Nothing landed on a part the world holds as untrue, so nothing is settled '
                  + 'and the engine does not know which account the player should believe. '
                  + 'What was said to somebody in public is what the ledger records.'
                : `Caught on ${input.caught.join(', ')}, off the row the world wrote when the `
                  + 'account was given.')
        ]
    };
}

// ─────────────────────────────────────────────────────────────────────────
// AND THE SENTENCE THAT REACHES IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * The words that say a claim is denied rather than a deed alleged.
 *
 * `never was` and `made it up` are here for the same reason the negations are:
 * they deny a claim about the speaker's own identity. A deed - "he killed my
 * brother" - carries none of them and stays with `tell`.
 */
const WHAT_THEY_CLAIMED_IS_DENIED =
    /\b(?:is|are|was|were|isn'?t|aren'?t|wasn'?t|weren'?t)\s+(?:not|no\b)|\bisn'?t\b|\baren'?t\b|\bwasn'?t\b|\bnever\s+(?:was|were|been)\b|\bmade\s+(?:that|it|the|his|her|their)\s+\w*\s*up\b|\b(?:does\s+not|doesn'?t|do\s+not|don'?t)\s+hold\b/i;

/**
 * What the denial has to be ABOUT, or the reader takes any contradiction.
 *
 * The three parts of an account plus the words people use for them. Without
 * this, "I tell him that is not what happened" is a challenge to somebody's
 * identity, which it is not.
 */
const THE_THING_THEY_CLAIMED_TO_BE =
    /\b(?:sect|house|clan|court|order|school|roll|rank|rung|realm|name|named|disciple|elder|story|account)\b/i;

/**
 * "that is not your house", said to whoever is standing there.
 *
 * No addressee in the words at all, which is how somebody actually says it
 * when there is one person in front of them. The verb resolves it off the
 * square and refuses with the room attached where there is more than one.
 */
const A_DENIAL_WITH_NOBODY_NAMED = new RegExp(
    String.raw`^\s*(?:and\s+)?(?:that|this|it)\s+(?:is|was)\s+not\s+`
    + String.raw`(?:your|his|her|their)\b|^\s*(?:i\s+)?(?:you|you'?re)\s+(?:are\s+)?not\s+`,
    'i'
);

/**
 * "I say he made that name up" - the denial with the person as its subject
 * rather than its addressee.
 */
const A_DENIAL_ABOUT_SOMEBODY = new RegExp(
    String.raw`^\s*(?:i\s+|i'?ll\s+|i\s+will\s+)?(?:says?|claims?|reckons?)\s+`
    + String.raw`(he|she|they|[a-z][a-z' -]{1,40}?)\s+`
    + String.raw`((?:made\s+.*?\bup\b|is\s+not\b.*|are\s+not\b.*|`
    + String.raw`never\s+(?:was|were|been)\b.*|was\s+never\b.*))$`,
    'i'
);

/** "I call him a liar", with or without what about. */
const CALLING_SOMEBODY_A_LIAR =
    /^\s*(?:i\s+|i'?ll\s+|i\s+will\s+)?(?:calls?|calling)\s+(.+?)\s+a\s+liar\b/i;

/**
 * "I tell him he is not of that sect" - the denial put to the person it is
 * about, which is the only form that can be a challenge.
 *
 * The pronoun after the addressee is load-bearing and is what keeps this off
 * `tell`: "I tell him that Cao Antao killed his brother" puts a name there and
 * "I tell the guard that I am of the Iron Sect" puts `I` there. Neither
 * reaches this - and the possessives are in the set for "I tell him his story
 * does not hold", held off the first of those two by the denial and the
 * account noun both being required after the pronoun.
 */
const A_DENIAL_PUT_TO_SOMEBODY = new RegExp(
    String.raw`^\s*(?:i\s+|i'?ll\s+|i\s+will\s+)?`
    + String.raw`(?:tells?|telling|says?\s+to|put\s+it\s+to|puts\s+it\s+to|accuses?|accusing)\s+`
    + String.raw`(.+?)\s+(?:that\s+)?(?:he|she|they|you|his|her|their|your)\b(.*)$`,
    'i'
);

/**
 * Whose account is being challenged, or null where the sentence is not one.
 *
 * Kept beside the comparison rather than in the pattern table for
 * `whatIsBeingGivenAsAnAccount`'s reason: the words that reach a mechanic and
 * the mechanic move together, and a phrasing list six thousand lines away from
 * what it routes to is a phrasing list nobody updates.
 */
export function whoseAccountIsBeingChallenged(
    input: string
): { person: string | null } | null {
    const said = input.trim();

    const liar = CALLING_SOMEBODY_A_LIAR.exec(said);
    if (liar) {
        const person = liar[1].replace(/\s+/g, ' ').trim();
        return person.length < 2 ? null : { person: person.slice(0, 80) };
    }

    for (const reader of [A_DENIAL_PUT_TO_SOMEBODY, A_DENIAL_ABOUT_SOMEBODY]) {
        const denial = reader.exec(said);
        if (denial === null) continue;
        if (!bothGuards(denial[2])) continue;
        const person = denial[1].replace(/\s+/g, ' ').trim();
        if (person.length >= 2) return { person: person.slice(0, 80) };
    }

    // Nobody named, and the square is where the answer is.
    if (A_DENIAL_WITH_NOBODY_NAMED.test(said) && THE_THING_THEY_CLAIMED_TO_BE.test(said)) {
        return { person: null };
    }
    return null;
}

/** Both halves, always together: a denial, and a denial OF an account. */
function bothGuards(tail: string): boolean {
    return WHAT_THEY_CLAIMED_IS_DENIED.test(tail) && THE_THING_THEY_CLAIMED_TO_BE.test(tail);
}

/** `The house` / `The name and the rung`, so the sentence reads as English. */
function theParts(parts: readonly PartOfAnAccount[]): string {
    const words = parts.map(part => `the ${part}`);
    const joined = words.length === 1
        ? words[0]
        : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
    return joined.charAt(0).toUpperCase() + joined.slice(1);
}
