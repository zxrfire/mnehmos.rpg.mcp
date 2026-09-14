/**
 * Somebody weighs a report and says what happens to the person it is about.
 *
 * Both ends of this arc were already built and the middle was not.
 * `reporting-what-you-saw.ts` walks a witness up the hill and
 * `false-decree-reports.ts` writes the row the room receives; every sentence a
 * room can hand down is already a module - a rebuke is an `ObligationRecord`, a
 * fine is contribution and stones, taking back what was given is
 * `a-house-takes-back-what-it-handed-over.ts`, years sealed is
 * `whatLayingASealTakes` in the `punishment_hall`, crippling is `'crippling'`
 * severity and a permanent wound, and death is the ordinary act anybody can do
 * to anybody. What was missing was one function between them.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THREE INPUTS, AND NONE OF THEM IS A LIST OF CRIMES
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A table of offences with punishments beside them would be a bespoke copy of
 * two facts the catalogs already carry, so there is none here and there is no
 * `switch` on what was done anywhere in this file. What is read:
 *
 *   CAN IT BE SHOWN   `whatTheWitnessDoesAboutIt` already answered whether the
 *                     witness speaks. A thing nobody carried up the hill is not
 *                     a lighter offence, it is no case.
 *   HOW BAD IT WAS    `Severity` on the row that was opened, decided once at
 *                     creation by `grudges.ts` and never re-decided here.
 *   WHAT KIND OF
 *   HOUSE THIS IS     `SectAlignment`. How far a house is willing to go to a
 *                     person is the whole subject of
 *                     `demonic-sects-and-what-they-are-willing-to-do.ts`, and it
 *                     is why the same offence gets sealed by one house, crippled
 *                     by the next and ended by the third.
 *
 * The reading is the severity's own rung on the ladder of sentences, moved by
 * how far this house goes. That is one index and three numbers, argued here,
 * rather than a row per thing a person can do.
 *
 *     righteous    rebuke  fine    taken back  sealed
 *     neutral      fine    t/back  sealed      crippled
 *     demonic      t/back  sealed  crippled    death
 *                  slight  serious grave       unforgivable
 *
 * A righteous house does not end one of its own over an internal matter and a
 * demonic one will; that is the difference the alignment is FOR, and neither
 * answer is the world's opinion of the act.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * INTERCESSION IS THE SAME SHAPE ONE STEP FURTHER
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `whoseCallItIs` already narrows a room's question to its holder plus the head,
 * and `whatTheBodyWants` already knows a head can overrule elders. What an
 * intercessor spends is a favour rung from
 * `what-they-will-take-instead-of-money.ts`, and whether it lands is
 * `whereTheOfferLanded` - the KIND of thing offered, never the amount.
 *
 * IT MOVES ONE RUNG. Not the distance between the rungs offered, because then a
 * hold put up on somebody's behalf would buy a death down to a fine and the
 * sentence would be a price list. One rung, once, and only where the offer is
 * the right kind of thing.
 *
 * And some bodies no word reaches, which is the precedent
 * `a-favour-skips-the-admission-bar.ts` sets and the half that makes the rest
 * mean anything: a house whose door does not open for a favour is a house whose
 * room does not either, and it is the same stance read for the same reason
 * rather than a second list.
 */

import {
    favourStanceOf
} from '../../data/cultivation/a-favour-skips-the-admission-bar.js';
import type { SectAlignment } from '../../schema/cultivation.js';
import { SEVERITY_IN_WORDS, severityRank, type Severity } from '../social/grudges.js';
import type { WhatHappensNext } from './reporting-what-you-saw.js';
import type { WhoseCallItIs } from './what-an-elder-is-in-charge-of.js';
import {
    howFarUpTheLadder,
    whereTheOfferLanded,
    type WhatTheyWillTake
} from './what-they-will-take-instead-of-money.js';

// ─────────────────────────────────────────────────────────────────────────
// THE LADDER OF SENTENCES
// ─────────────────────────────────────────────────────────────────────────

export type Sentence =
    /** Nothing written. The ledger gains no row and the person is not told off. */
    | 'no case'
    /** A record and nothing else. It costs them the next time anything is read. */
    | 'a rebuke'
    /** Contribution and stones move. */
    | 'a fine'
    /** What the house gave is taken back. Nothing happens where it gave nothing. */
    | 'what the house gave is taken back'
    /** A term in the room the house holds people in, renewed as it runs out. */
    | 'years sealed and held'
    /** What they climbed, removed, and it does not come back. */
    | 'the capability taken'
    /** The end of it. */
    | 'death';

/**
 * Ordered, lightest first, and the order is the whole mechanism: a sentence is a
 * position on this list and everything below decides which position.
 */
export const SENTENCES_IN_ORDER: readonly Sentence[] = Object.freeze([
    'no case',
    'a rebuke',
    'a fine',
    'what the house gave is taken back',
    'years sealed and held',
    'the capability taken',
    'death'
]);

/**
 * Which module carries each one out.
 *
 * Names rather than does, for the five this file does not run itself. A sentence
 * with nothing behind it is a verdict the world never applies, and writing down
 * where each lands is what stops the next person inventing a second one.
 *
 * WHO GOES is a separate question with one answer, and it is written here rather
 * than four times below: `somebody-is-sent-to-carry-it-out.ts` names the party
 * for the four that are carried out on a person - what the house gave taken
 * back, the seal, the crippling, the death. The fine and the rebuke move inside
 * the house's own books, and nobody is sent for them.
 */
export const WHO_CARRIES_IT_OUT: Readonly<Record<Sentence, string>> = Object.freeze({
    'no case': 'nothing is written',
    'a rebuke': 'grudges.ts, as one ObligationRecord held by the house',
    'a fine': 'sect.repo.addContribution and cultivator.repo.applyDeltas, priced off duties.ts',
    'what the house gave is taken back':
        'a-house-takes-back-what-it-handed-over.ts, whose gift-and-loan split decides whether '
        + 'this is a loan called in or a seizure',
    'years sealed and held':
        'what-laying-a-qi-seal-takes.ts, in the punishment_hall, renewed at each expiry',
    'the capability taken':
        'wounds.ts, at crippling severity, through theStructureTheyHave in '
        + 'what-a-house-does-when-it-catches-you.ts',
    death: 'the ordinary act, which anybody can do to anybody'
});

/**
 * How far past the offence this house is willing to go.
 *
 * Three numbers, and they are the only judgement in this file. An unknown
 * alignment reads as neutral, which is what `theYearsTaken` already does with
 * the same field for the same reason.
 */
export function howFarThisHouseWillGo(alignment: SectAlignment | null): number {
    switch (alignment ?? 'neutral') {
        case 'righteous': return 0;
        case 'demonic': return 2;
        default: return 1;
    }
}

// ─────────────────────────────────────────────────────────────────────────
// SOMEBODY SPEAKING FOR THEM
// ─────────────────────────────────────────────────────────────────────────

export type HowTheWordLanded =
    | 'none offered'
    /** No room, or the only seat is the offender's own. */
    | 'nobody to speak to'
    /** This house does not open for a word, and its room does not either. */
    | 'no word reaches this body'
    /** They wanted a different kind of thing. Amount was never the question. */
    | 'the wrong kind of thing'
    | 'it moved one rung';

export interface AnIntercession {
    /** Whose call it is, from `whoseCallItIs`. Null where nobody holds the room. */
    room: WhoseCallItIs | null;
    /** What the intercessor put up. */
    offered: WhatTheyWillTake;
    /** What the person holding the room will take, from `whatTheyWillTakeFor`. */
    wants: WhatTheyWillTake;
}

export interface WhatWasBrought {
    /** What the witness did with it. Only `reports` reaches a room at all. */
    what: WhatHappensNext;
    /** Whether this house has any claim on what was done. */
    theirsToPunish: boolean;
    alignment: SectAlignment | null;
    /** How bad it was, off the row. Decided at creation and not re-decided here. */
    severity: Severity;
    /** The house, for whether a word reaches it. Null where there is no house. */
    houseId: string | null;
    /**
     * Whether this house ever gave them anything.
     *
     * The one precondition a sentence on this ladder has, and it is the
     * gift-and-loan split doing real work: a room that decides to take back what
     * it gave, to somebody it gave nothing, has decided nothing, and the sentence
     * falls to the rung below rather than being a sanction that does not happen.
     */
    theHouseGaveThemSomething?: boolean;
    intercession?: AnIntercession | null;
}

export interface TheSentence {
    sentence: Sentence;
    /** Where it stood before anybody spoke for them. */
    beforeAnybodySpoke: Sentence;
    word: HowTheWordLanded;
    /** Where the sentence is carried out. See {@link WHO_CARRIES_IT_OUT}. */
    carriedOutBy: string;
    /** Engine truth, one line, for the mechanical channel. Never narration. */
    line: string;
}

/**
 * What the room decides.
 *
 * Pure. No RNG, no write, and no branch on what was done - every branch reads a
 * field that exists for another reason, which is the contract
 * `reporting-what-you-saw.ts` holds and this is the other half of.
 */
export function whatTheRoomDecides(brought: WhatWasBrought): TheSentence {
    const noCase = (line: string): TheSentence => ({
        sentence: 'no case',
        beforeAnybodySpoke: 'no case',
        word: 'none offered',
        carriedOutBy: WHO_CARRIES_IT_OUT['no case'],
        line
    });

    if (brought.what.does !== 'reports') {
        return noCase(
            'Nobody brought it. There is no case, which is not the same as nothing having '
            + `happened: ${brought.what.line}`
        );
    }
    if (!brought.theirsToPunish) {
        return noCase(
            'It is brought to a house with no claim on it. Being disapproved of is not a '
            + 'record, and the room writes nothing.'
        );
    }

    const reached = severityRank(brought.severity) + 1 + howFarThisHouseWillGo(brought.alignment);
    let at = Math.min(SENTENCES_IN_ORDER.length - 1, Math.max(1, reached));
    // Nothing was ever given, so there is nothing to take back. The rung below
    // is what the room can actually do, and it does that instead.
    if (SENTENCES_IN_ORDER[at] === 'what the house gave is taken back'
        && brought.theHouseGaveThemSomething !== true) {
        at -= 1;
    }
    const beforeAnybodySpoke = SENTENCES_IN_ORDER[at];

    const word = howTheWordLanded(brought);
    const sentence = word === 'it moved one rung'
        ? SENTENCES_IN_ORDER[Math.max(1, at - 1)]
        : beforeAnybodySpoke;

    return {
        sentence,
        beforeAnybodySpoke,
        word,
        carriedOutBy: WHO_CARRIES_IT_OUT[sentence],
        line:
            `The room reads it as ${SEVERITY_IN_WORDS[brought.severity]}. `
            + (sentence === beforeAnybodySpoke
                ? `It settles on ${sentence}.`
                : `It would have been ${beforeAnybodySpoke}; somebody spoke for them, and it `
                  + `is ${sentence}.`)
    };
}

/**
 * What a word from somebody else did to it.
 *
 * The bodies no word reaches are read off the favour stance rather than listed
 * again: a house whose admission bar does not move for a favour is a house whose
 * punishment room does not move for one either, and a house with no door to
 * speak of has no room to be spoken to.
 */
function howTheWordLanded(brought: WhatWasBrought): HowTheWordLanded {
    const asked = brought.intercession;
    if (!asked) return 'none offered';

    const stance = brought.houseId === null ? undefined : favourStanceOf(brought.houseId);
    if (stance?.answer === 'no, and the bar does not move'
        || stance?.answer === 'no bar to skip, because there is no door') {
        return 'no word reaches this body';
    }
    if (asked.room === null || asked.room.holderId === null) return 'nobody to speak to';
    return whereTheOfferLanded(asked.wants, asked.offered).theRightKindOfThing
        ? 'it moved one rung'
        : 'the wrong kind of thing';
}

/**
 * How far above what they wanted an offer stood, for a caller reporting on one.
 *
 * Exported because the rung is the thing a player learns from - an offer that
 * was two rungs short reads differently from one that was refused outright - and
 * because deriving it a second time at the call site is how the two readings
 * would come to disagree.
 */
export function howFarTheOfferStood(asked: AnIntercession): number {
    return howFarUpTheLadder(asked.offered) - howFarUpTheLadder(asked.wants);
}
