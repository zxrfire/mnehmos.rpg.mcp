/**
 * Somebody finding out, and the account that opens because they did.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE ONE IDEA
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   THE KILLING DOES NOT OPEN THE ACCOUNT. THE TELLING DOES.
 *
 * AGENTS.md, *a fact reaches a person, and reaching them is an event*. The deed
 * was already true and already on the record; what was missing was somebody who
 * could act on it, and being told supplies exactly that. So a wrong nobody
 * witnessed stays true, stays findable, and opens nothing - which is what makes
 * doing a thing quietly worth doing, and what makes a witness worth silencing.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE DOES NOT DO, AND THE TWO ARE THE WHOLE DISCIPLINE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * IT DOES NOT PRICE ANYTHING. `whatADeedLeaves` decided the weight on the day,
 * and `grudges.ts` requires severity be decided exactly once at creation. The
 * weight arrives here on {@link TheDeedAsItStands} and is carried onto the row
 * untouched. Grep this file: there is no call to `whatItWasWorth` and no
 * arithmetic over a cost. Finding out later does not make a thing worse or
 * cheaper; it makes it HELD.
 *
 * IT DOES NOT MAKE THE RECORD CONDITIONAL ON KNOWLEDGE. The deed happened, the
 * world's history holds it, its provenance holds it, and none of that is
 * touched from here. What is conditional is who holds an ACCOUNT about it.
 * Conflating the two would delete the thread that makes a quiet wrong
 * discoverable later, which is the whole point of doing it this way.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THREE STATES, AND THE MIDDLE ONE IS THE DESIGN
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   1  NOTHING KNOWN         No account.
 *   2  SOMETHING IS WRONG    An open account with no name on it.
 *      AND NOBODY KNOWS WHO
 *   3  TOLD WHO              The account attaches to a name.
 *
 * *Nothing happens until somebody is told* is too coarse, and the state it
 * skips is the one worth having: somebody who knows they were wronged, cannot
 * say by whom, and is therefore looking. `accounts-with-no-name.ts` owns what
 * such an account is and what it makes its holder want; this file owns the two
 * transitions a TELLING can produce.
 *
 *   1 -> 2   a telling that names what was lost and nobody for it. The
 *            consequence arrived with no author attached, which is
 *            `discovery.md`'s "the world may act on a player who cannot name
 *            what acted", stated in the ledger.
 *   1 -> 3   a telling that names both. The ordinary case.
 *   2 -> 3   a telling that supplies the name they were missing. ONE account
 *            acquiring a subject, at the same id and the same weight, never a
 *            second account about the same wrong.
 *
 * Whether state 2 is reachable at all is a property of the ACT rather than of
 * this file: a wrong the wronged party could only have suffered at the hands of
 * somebody they already knew names its own subject, and
 * `theWrongedPartyAlreadyHasTheName` is that question.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE ACCOUNT OPENS AGAINST WHOEVER THE TELLING NAMED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Not against whoever really did it. There is no check anywhere in this file
 * that the name was right, and there must not be: a hearer who could tell a
 * true telling from a false one is a hearer with access to `KnowledgeLedger`'s
 * omniscient view, and the whole knowledge layer exists so that nobody has it.
 *
 * That is not a defect being tolerated. It is the most valuable thing the news
 * layer buys, and it costs nothing to have: `retell` already swaps the doer
 * under `misattributed`, so a grudge opening against the wrong name and being
 * held with complete conviction falls straight out of machinery that was
 * already running. `recordAccuracy` and `isGroundless` are how the engine, and
 * only the engine, can later say what actually happened.
 *
 * Three shapes follow from it, and none of them needed a branch:
 *
 *   NAMED           they can say who. The account opens against that person.
 *   PARTIAL         they can say some of it. The account opens against the
 *                   doer if the telling named one, and against nobody if it
 *                   named only what was lost.
 *   UNATTRIBUTED    they cannot say anything about it. Nothing of theirs is
 *                   legible in it, so nothing opens - this is a consequence
 *                   they felt and cannot connect to themselves at all.
 *
 * Note where the line moved. *No name for the doer* is state 2 and opens an
 * account; *no name for anything* is state 1 and opens none. The difference is
 * whether the telling let them see that something of theirs was in it.
 *
 * And the story with no event under it opens an account too, against a real
 * person, resting on nothing. `triggeringEventId` is null on that row and
 * `isGroundless` answers for it. Refusing to write it would be the engine
 * quietly declining to let anybody be wrong, which is the softening the agency
 * rule forbids.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * CARRYING THE NEWS IS AN ACT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The person who tells the brother has done something - to the brother, to the
 * person they named, and to their own standing with both. This file does not
 * enumerate what any of them does about it, because
 * AGENTS.md's *what NPCs do is emergent* forbids the list. What it does is make
 * the carrier ANSWERABLE: the teller is named in `participants` and tagged
 * `told-by:<id>` on every row their telling opened, so the question *who told
 * him* has an answer that a person in the world can reach. Whatever anybody
 * does with that answer is an ordinary deed with ordinary consequences, priced
 * by the module that prices every other one.
 *
 * Pure. No state, no rolls, no I/O, no ladder, no clock of its own.
 */

import type { DayIndex } from './common.js';
import type {
    ObligationCause,
    ObligationInput,
    ObligationKind,
    ObligationRecord,
    Severity
} from './grudges.js';
import {
    aNameAttaches,
    hasANameOnIt,
    NO_NAME_ON_IT,
    theWrongedPartyAlreadyHasTheName,
    withNoNameOnIt,
    type HowItWasDone
} from './accounts-with-no-name.js';
// Type-only, deliberately. `src/engine/world/` imports this package, so a value
// import here would close a cycle at the package level. The vocabulary is
// digest.ts's because the news layer is where a telling comes from, and
// restating the three forms next to it would be the second copy that drifts.
import type { ReportChannel, ReportForm } from '../world/digest.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT REACHED THEM
// ─────────────────────────────────────────────────────────────────────────

/**
 * One person finding out one thing, on a day, off somebody.
 *
 * Everything here is a fact about the TELLING. Nothing about the deed is in
 * it, because a telling can be wrong about every part of the deed and still be
 * a telling that happened.
 */
export interface TheTelling {
    /** Who is finding out. */
    hearerId: string;
    /** The day they were told. This becomes the account's `onDay`, and it is the ruling. */
    onDay: DayIndex;
    /**
     * The world's own row for what is being repeated, or null.
     *
     * Null is the interesting value: a story with nothing under it. It lands on
     * `triggeringEventId` exactly as it arrives, so a reader in forty years can
     * ask what the account rests on and be told, truthfully, nothing.
     */
    factId: string | null;
    /**
     * Who the telling put it on, or null where it named nobody for it.
     *
     * Null is state 2 and is not a degenerate case: *your brother is dead*
     * names what was lost and nobody for it. The caller decides this rather
     * than the engine inferring it from how many names came through, because
     * arity does not answer it - a telling with one name in it is *X is dead*
     * in one template and *X turned on their own* in another, and those are
     * opposite answers to this question.
     *
     * Where the telling was bent, this is the BENT name. A `misattributed`
     * telling arrives here with the wrong man in it and the engine is none the
     * wiser, which is correct.
     */
    blamedId: string | null;
    /**
     * Everybody else the telling named - who it was done to, and who was with
     * them.
     *
     * No distortion in the rumour layer moves these, so they are the names the
     * hearer really was given.
     */
    alsoNamedIds: readonly string[];
    /** How much of it a name could be got out of. */
    form: ReportForm;
    /** How it reached them. Only `witnessed` is first hand. */
    channel: ReportChannel;
    /** Who said it. Null for something read, inferred or simply noticed. */
    fromHolderId?: string | null;
    /** 0..1, what survived to reach them. Goes on the row as a tag, never as a weight. */
    fidelity?: number;
}

/**
 * The deed as the world already holds it.
 *
 * Every field was decided elsewhere and is carried through. The caller reads
 * them off the history row and the record that priced it; this file never
 * re-derives one.
 */
export interface TheDeedAsItStands {
    /** Decided once, at the deed. Never re-decided here. */
    weight: Severity;
    /** The ledger's own word for it. DATA: carried onto the row, never read. */
    cause: ObligationCause;
    /** `grudge`, or `blood_feud` where the deed was written to descend. */
    kind: ObligationKind;
    /** Plain words for the ledger. The caller's; never parsed. */
    description: string;
    /** Anybody else the event touched, so the row is findable from them. */
    participants?: readonly string[];
    /** Handles on top of the ones this file adds. */
    tags?: readonly string[];
    /**
     * How it was done, for the one question state 2 turns on.
     *
     * Omit and a stranger could have done it, which is the common case and the
     * one that makes the middle state reachable. See
     * `theWrongedPartyAlreadyHasTheName`.
     */
    how?: HowItWasDone;
    /** Plain words for what was lost, for the goal an unnamed account opens. */
    whatWasLost?: string;
}

/**
 * Who this hearer would hold an account on behalf of.
 *
 * Themselves, always, and whoever else they carry for - kin, a chosen disciple,
 * a house's own. The caller supplies it because the caller is the one holding
 * the ties; nothing in this file looks a relation up, and nothing in it decides
 * that a relation is close enough to care.
 *
 * It is the standing test and it is deliberately the whole of the standing
 * test. Everybody in the province hears that somebody was killed; the brother
 * is the one who now holds something, and the difference between them is not
 * how much either of them minds.
 */
export interface WhoTheyCarryFor {
    hearerId: string;
    /** Ids the hearer would open an account about. Includes the hearer unless it does not. */
    ids: readonly string[];
    /**
     * The relation, for the row's tag, keyed by id.
     *
     * Absent means the hearer is the principal. `grudges.ts` is explicit that
     * inheritance does not discount and neither does this: the brother holds
     * what the brother holds, at the weight the deed was priced at.
     */
    relationOf?: Readonly<Record<string, string>>;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT COMES OF IT
// ─────────────────────────────────────────────────────────────────────────

/** Why nothing opened. Never a silent empty list. */
export type NothingOpened =
    /**
     * Nothing of theirs was legible in it.
     *
     * A consequence they felt and cannot connect to themselves. Everybody in
     * the province hears; the brother holds, and only because he could tell it
     * was about his brother.
     */
    | 'nothing of theirs in it'
    /** They already hold this, with a name on it. Being told twice is not twice. */
    | 'they already had it'
    /** The telling named the hearer as the one who did it. */
    | 'it names them'
    /**
     * No name for the doer, and this wrong could not have been done by a
     * stranger.
     *
     * So there is no state 2 for them and never was: they either had the name
     * from the moment they knew anything, or the telling is about somebody
     * else's business.
     */
    | 'a wrong like this comes with a name';

/** Which of the three transitions this telling produced. */
export type WhatItDid =
    /** Nothing. `heldBack` says why. */
    | 'nothing'
    /** State 1 to 3. A new account, against a name. */
    | 'opened against a name'
    /** State 1 to 2. A new account, against nobody. */
    | 'opened against nobody'
    /** State 2 to 3. The account they were already carrying acquired a subject. */
    | 'put a name on what they carried';

export interface WhatBeingToldOpens {
    /** What this telling did. */
    did: WhatItDid;
    /**
     * The row to write, or null.
     *
     * For `put a name on what they carried` it carries the HELD row's id, so
     * writing it updates the account rather than forking it.
     */
    opens: ObligationInput | null;
    /** Why nothing opened, when nothing did. Null when something did. */
    heldBack: NothingOpened | null;
    /**
     * Who the account is against, as the telling named them.
     *
     * Null for an account with no name on it. Named `asTold` because that is
     * exactly what it is: the engine is not claiming this person did anything.
     */
    againstAsTold: string | null;
    /** Engine truth, one line, for the mechanical channel. Never narration. */
    note: string;
}

// ─────────────────────────────────────────────────────────────────────────
// THE JOIN
// ─────────────────────────────────────────────────────────────────────────

/**
 * Read a telling and say what the hearer now holds.
 *
 * The order is the order of the argument: could a name be got out of it, was
 * any of it theirs, do they already have it - and then the row, at the weight
 * that was decided on the day, dated to the day they were told.
 */
export function whatBeingToldOpens(input: {
    telling: TheTelling;
    deed: TheDeedAsItStands;
    carriesFor: WhoTheyCarryFor;
    /**
     * The account this hearer already carries about this event, or null.
     *
     * An unnamed one is the state-2 row waiting for a name, and a telling that
     * supplies one puts it on THAT row rather than opening a second. A named one
     * means they already had this, and being told again is not being wronged
     * again.
     */
    held?: ObligationRecord | null;
}): WhatBeingToldOpens {
    const { telling, deed, carriesFor } = input;

    // ── WHAT THE SENTENCE PUT A NAME TO ──────────────────────────────────
    //
    // `unattributed` is the digest's word for a telling that could carry no
    // name at all, so it collapses both fields: nothing was blamed and nothing
    // was named, and the hearer cannot even see that any of it was theirs.
    const blamed = telling.form === 'unattributed' ? null : telling.blamedId;
    const spokenOf = telling.form === 'unattributed' ? [] : telling.alsoNamedIds;

    if (blamed !== null && blamed === telling.hearerId) {
        return nothing('it names them',
            'The telling puts it on them. Nobody opens an account about themselves.');
    }

    // ── AND WAS ANY OF IT THEIRS ─────────────────────────────────────────
    //
    // Everybody within earshot hears it. The person who now holds something is
    // the one it was done to, or the one who carries for them. Read off the
    // names that are not the doer's, because that slot is who is being blamed
    // and never who is being mourned.
    const mine = new Set(carriesFor.ids);
    const theirs = spokenOf.find(id => mine.has(id)) ?? null;
    if (theirs === null || theirs === blamed) {
        return nothing('nothing of theirs in it',
            'They have heard it. Nothing in it was theirs that they could see, so nothing '
            + 'about it is theirs to hold.');
    }

    const firstHand = telling.channel === 'witnessed';
    const relation = carriesFor.relationOf?.[theirs];

    // ── STATE 2 TO 3: THE NAME THEY WERE MISSING ─────────────────────────
    //
    // One account acquiring a subject. Not a second account, not a heavier one,
    // and not a re-dated one: what changes is who it is against.
    if (input.held && !hasANameOnIt(input.held)) {
        if (blamed === null) {
            return nothing('they already had it',
                'They already carry this, and this telling has no name in it either. Being '
                + 'told the same nothing twice is not a second account.');
        }
        const attached = aNameAttaches(input.held, {
            subjectId: blamed,
            onDay: telling.onDay,
            fromHolderId: telling.fromHolderId
        });
        return {
            did: 'put a name on what they carried',
            opens: attached.row,
            heldBack: null,
            againstAsTold: attached.againstAsTold,
            note: attached.note
        };
    }

    if (input.held) {
        return nothing('they already had it',
            'They already had this, with a name on it. Being told a second time is not a '
            + 'second account.');
    }

    // ── THE ACCOUNT ──────────────────────────────────────────────────────
    //
    // Dated to the day they were told, and that field is the whole ruling. The
    // weight is the deed's and is not touched.
    const row: ObligationInput = {
        kind: deed.kind,
        holderId: telling.hearerId,
        // Overwritten by `withNoNameOnIt` where nobody was named. Kept here
        // rather than branched on so that the two states are demonstrably one
        // row with one field different.
        subjectId: blamed ?? NO_NAME_ON_IT,
        cause: deed.cause,
        severity: deed.weight,
        onDay: telling.onDay,
        triggeringEventId: telling.factId,
            // True for anything that did not arrive first hand, which is
            // almost everything. `grudges.ts` carries the field so a reader can
        // tell an account resting on a confirmed fact from one resting on
        // what somebody said, and a telling is the second by construction.
        fromBelief: !firstHand,
        description:
            `${deed.description} `
            + (theirs === telling.hearerId
                ? `They were told on day ${telling.onDay}`
                : `${theirs} was theirs, and they were told on day ${telling.onDay}`)
            + (telling.fromHolderId ? ` by ${telling.fromHolderId}.` : '.'),
        participants: dedupe([
            theirs,
            ...(telling.fromHolderId ? [telling.fromHolderId] : []),
            ...(deed.participants ?? [])
        ]),
        tags: [
            ...(deed.tags ?? []),
            // The date the account opened is not the date the deed did, and a
            // reader should be able to see that from the row rather than by
            // comparing it with the history table.
            'opened-on-being-told',
            `heard:${telling.channel}`,
            `told:${telling.form}`,
            ...(relation ? [`carried:${relation}`] : []),
            // Who said it, so the question a house asks first has an answer.
            // This is the whole of what makes carrying news an act with
            // consequences: nothing here decides what anybody does about it,
            // and the name is on the record either way.
            ...(telling.fromHolderId ? [`told-by:${telling.fromHolderId}`] : []),
            // Nothing under it. Not hidden from the row, because the day
            // somebody works out that an account rests on a story is a dated
            // event with its own weight.
            ...(telling.factId === null ? ['rests-on-nothing'] : [])
        ]
    };

    // ── STATE 1 TO 2: THEY KNOW, AND THEY DO NOT KNOW WHO ────────────────
    if (blamed === null) {
        // Unless the act names its own subject, in which case there was never a
        // moment where the wrong was legible and its author was not - so a
        // version of it with nobody in it is not a version of theirs.
        if (theWrongedPartyAlreadyHasTheName(deed.how ?? {})) {
            return nothing('a wrong like this comes with a name',
                'A wrong of this kind cannot have been done by a stranger, so a telling of '
                + 'it with nobody in it is a telling about somebody else.');
        }
        return {
            did: 'opened against nobody',
            opens: withNoNameOnIt(row),
            heldBack: null,
            againstAsTold: null,
            note:
                `They hold a ${deed.weight} ${deed.kind} as of day ${telling.onDay} with no `
                + 'name on it. They know it was done and cannot say by whom, which is a '
                + 'person with a reason to go asking rather than a person with nothing.'
        };
    }

    return {
        did: 'opened against a name',
        opens: row,
        heldBack: null,
        againstAsTold: blamed,
        note:
            `They hold a ${deed.weight} ${deed.kind} about ${blamed} as of day `
            + `${telling.onDay}, which is the day they were told and not the day it `
            + `happened. `
            + (firstHand
                ? 'They saw it themselves.'
                : `It reached them ${telling.channel === 'market' ? 'off the square'
                    : `via ${telling.channel}`}, in ${telling.form} form, `
                  + 'and the name on it is the name they were given.')
    };
}

function nothing(heldBack: NothingOpened, note: string): WhatBeingToldOpens {
    return { did: 'nothing', opens: null, heldBack, againstAsTold: null, note };
}

function dedupe(ids: readonly string[]): string[] {
    return [...new Set(ids.filter(id => id.length > 0))];
}
