/**
 * Somebody finding out, and the account that opens because they did.
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
// Type-only, deliberately: `src/engine/world/` imports this package, so a value
// import here would close a cycle at the package level.
import type { ReportChannel, ReportForm } from '../world/digest.js';

/**
 * One person finding out one thing, on a day, off somebody. Everything here is
 * a fact about the TELLING - a telling can be wrong about every part of the
 * deed and still be a telling that happened.
 */
export interface TheTelling {
    /** Who is finding out. */
    hearerId: string;
    /** The day they were told. This becomes the account's `onDay`, and it is the ruling. */
    onDay: DayIndex;
    /**
     * The world's own row for what is being repeated, or null - a story with
     * nothing under it, which lands on `triggeringEventId` as it arrives.
     */
    factId: string | null;
    /**
     * Who the telling put it on, or null where it named nobody for it.
     */
    blamedId: string | null;
    /**
     * Everybody else the telling named. No distortion in the rumour layer moves
     * these, so they are the names the hearer really was given.
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
 * The deed as the world already holds it. Every field was decided elsewhere and
 * is carried through; this file never re-derives one.
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
     * How it was done, for the one question state 2 turns on. Omit and a
     * stranger could have done it, which is the common case and the one that
     * makes the middle state reachable. See `theWrongedPartyAlreadyHasTheName`.
     */
    how?: HowItWasDone;
    /** Plain words for what was lost, for the goal an unnamed account opens. */
    whatWasLost?: string;
}

/**
 * Who this hearer would hold an account on behalf of: themselves, and whoever else
 * they carry for. The caller supplies it because the caller holds the ties; nothing
 * here looks a relation up or decides one is close enough.
 */
export interface WhoTheyCarryFor {
    hearerId: string;
    /** Ids the hearer would open an account about. Includes the hearer unless it does not. */
    ids: readonly string[];
    /**
     * The relation, for the row's tag, keyed by id. Absent means the hearer is
     * the principal. Carrying for somebody does not discount the weight, on the
     * same rule `grudges.ts` states for inheritance.
     */
    relationOf?: Readonly<Record<string, string>>;
}

/** Why nothing opened. Never a silent empty list. */
export type NothingOpened =
    /** A consequence they felt and cannot connect to themselves at all. */
    | 'nothing of theirs in it'
    /** They already hold this, with a name on it. Being told twice is not twice. */
    | 'they already had it'
    /** The telling named the hearer as the one who did it. */
    | 'it names them'
    /**
     * No name for the doer, and this wrong could not have been done by a
     * stranger - so there is no state 2 for them and never was.
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
     * The row to write, or null. For `put a name on what they carried` it
     * carries the HELD row's id, so writing it updates the account rather than
     * forking it.
     */
    opens: ObligationInput | null;
    /** Why nothing opened, when nothing did. Null when something did. */
    heldBack: NothingOpened | null;
    /**
     * Who the account is against, as the telling named them; null for an
     * account with no name on it. `asTold` because the engine is not claiming
     * this person did anything.
     */
    againstAsTold: string | null;
    /** Engine truth, one line, for the mechanical channel. Never narration. */
    note: string;
}

/**
 * Read a telling and say what the hearer now holds.
 */
export function whatBeingToldOpens(input: {
    telling: TheTelling;
    deed: TheDeedAsItStands;
    carriesFor: WhoTheyCarryFor;
    /**
     * The account this hearer already carries about this event, or null. An
     * unnamed one is the state-2 row waiting for a name, and a telling that
     * supplies one puts it on THAT row rather than opening a second.
     */
    held?: ObligationRecord | null;
}): WhatBeingToldOpens {
    const { telling, deed, carriesFor } = input;

    // `unattributed` is the digest's word for a telling that could carry no
    // name at all, so it collapses both fields: the hearer cannot even see that
    // any of it was theirs.
    const blamed = telling.form === 'unattributed' ? null : telling.blamedId;
    const spokenOf = telling.form === 'unattributed' ? [] : telling.alsoNamedIds;

    if (blamed !== null && blamed === telling.hearerId) {
        return nothing('it names them',
            'The telling puts it on them. Nobody opens an account about themselves.');
    }

    // Read off the names that are not the doer's, because that slot is who is
    // being blamed and never who is being mourned.
    const mine = new Set(carriesFor.ids);
    const theirs = spokenOf.find(id => mine.has(id)) ?? null;
    if (theirs === null || theirs === blamed) {
        return nothing('nothing of theirs in it',
            'They have heard it. Nothing in it was theirs that they could see, so nothing '
            + 'about it is theirs to hold.');
    }

    const firstHand = telling.channel === 'witnessed';
    const relation = carriesFor.relationOf?.[theirs];

    // State 2 to 3: one account acquiring a subject. Not a second account, not
    // a heavier one, and not a re-dated one - only who it is against changes.
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

    // Dated to the day they were told, and that field is the whole ruling. The
    // weight is the deed's and is not touched.
    const row: ObligationInput = {
        kind: deed.kind,
        holderId: telling.hearerId,
        // Overwritten by `withNoNameOnIt` where nobody was named. Kept here
        // rather than branched on so the two states are one row with one field
        // different.
        subjectId: blamed ?? NO_NAME_ON_IT,
        cause: deed.cause,
        severity: deed.weight,
        onDay: telling.onDay,
        triggeringEventId: telling.factId,
        // True for anything that did not arrive first hand, which is almost
        // everything: a telling is belief by construction.
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
            // reader should see that from the row rather than by comparing it
            // with the history table.
            'opened-on-being-told',
            `heard:${telling.channel}`,
            `told:${telling.form}`,
            ...(relation ? [`carried:${relation}`] : []),
            // Who said it, so the question a house asks first has an answer.
            // This is the whole of what makes carrying news an act.
            ...(telling.fromHolderId ? [`told-by:${telling.fromHolderId}`] : []),
            // Nothing under it, and not hidden from the row: the day somebody
            // works out that an account rests on a story is its own event.
            ...(telling.factId === null ? ['rests-on-nothing'] : [])
        ]
    };

    // State 1 to 2: they know, and they do not know who.
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
