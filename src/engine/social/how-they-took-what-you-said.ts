/**
 * What the person who heard it takes it for, which is not what the speaker
 * meant by it.
 *
 * The same sentence is a different act in every square it is said in. *I am
 * from the Dawn Sect* is an introduction to a stranger, a deterrent to bandits,
 * a claim on hospitality inside an allied house, and a threat to somebody who
 * killed a Dawn Sect disciple last week. Nothing in the words separates those,
 * and a classifier that answers from the words alone is answering a question
 * nobody asked.
 *
 * ── WHERE THE LINE IS DRAWN ──────────────────────────────────────────────
 *
 * The reader chooses the SPEECH ACT: it has the square, the roster, the ledger
 * and what the player has been doing, and picking which of those a sentence is
 * meant as is exactly the judgement a model is good at. This file decides the
 * other half, which a model must not: whether the person on the receiving end
 * PERCEIVES it that way. Those are different questions with different answers -
 * a threat nobody is frightened by is not a threat, and a pleasantry from
 * somebody who buried your brother is not a pleasantry - and the second one is
 * a fact about the world rather than about language.
 *
 * ── AND IT IS READ FROM BOTH ENDS OF THE LEDGER ──────────────────────────
 *
 * What the hearer holds against the speaker is one ground. What the hearer DID
 * to whatever the words named is the other, and it is the more interesting one:
 * a man who killed three Dawn Sect disciples hears *I am from the Dawn Sect* as
 * a reckoning arriving, and the man beside him who killed nobody hears an
 * introduction. Same sentence, same square, same speaker, and the two of them
 * are in different scenes.
 *
 * These are the same rows read from opposite ends - `whatTheyFeelAboutYou`
 * takes the records this person HOLDS, and deliberately skips the ones they are
 * the subject of, because what somebody did is not what they feel. This file
 * needs both, so the second comes in as its own input and the caller reads it
 * off the same ledger with the ends swapped.
 *
 * ── AND SO A MISREADING UPSTREAM COSTS NOTHING ───────────────────────────
 *
 * The reader's label is an INPUT here and never an authority. Nothing below
 * returns a wrong because the reader called it one: the hearer's own situation
 * is asked first and can answer on its own, and where it cannot, the label is
 * one of two grounds rather than a verdict. So a reader that calls a boast a
 * threat has not made it one, and a reader that misses a threat has not
 * unmade it - what happens is what the person standing there took it for. That
 * is what makes the layer above cheap to be wrong in, which is the only way a
 * layer above a model is ever safe.
 *
 * ── WHY THERE IS ALMOST NOTHING HERE ─────────────────────────────────────
 *
 * Every input already existed. `WRONG_BEHIND_INTENT` says which acts are wrongs
 * at all, `whatTheyFeelAboutYou` reads what stands between two people off the
 * ledger, the reach list says whether the words named anything this person
 * answers to, and `whatTheyDoAboutBeingWronged` decides what they do next. This
 * is the joint between them and it holds four rules. Anything longer would be a
 * second model of the world beside the one that already works.
 */

import { HELPLESS_REALM_GAP } from '../cultivation/combat.js';
import type { WhatTheyFeel } from '../social-leverage/what-they-feel-about-you.js';
import type { Wrong } from '../social-leverage/what-somebody-does-about-being-wronged.js';

/**
 * What the hearer makes of it, and why - the second half being what a narrator
 * writes and what an operator reads when the answer looks wrong.
 */
export interface HowTheyTookIt {
    /**
     * The wrong they take it for, or null where they take it for nothing.
     *
     * Null is the ordinary answer and it is not a failure: most of what is said
     * in front of most people is not about them.
     */
    readonly took: Wrong | null;
    readonly because: string;
}

/**
 * Feelings that mean something already stands between these two.
 *
 * Read off `whatTheyFeelAboutYou`, so it moves when the ledger moves and there
 * is no second notion of what people have against each other. Conflicted is in
 * it because somebody holding two things at once hears the worse one.
 */
const ALREADY_STANDS_BETWEEN_THEM: ReadonlySet<WhatTheyFeel> =
    new Set<WhatTheyFeel>(['sore', 'bitter', 'despondent', 'conflicted']);

export function howTheyTookIt(input: {
    /**
     * The wrong the speaker's own act carries, from `WRONG_BEHIND_INTENT`, or
     * null for an act that is not one. Never re-derived from the words here.
     */
    readonly wrongInTheAct: Wrong | null;
    /**
     * The words named this person, or a house they answer to, or something else
     * of theirs. False is the common case and it ends the question.
     */
    readonly aboutThem: boolean;
    /** What the ledger already says they feel about the speaker. */
    readonly feeling: WhatTheyFeel;
    /** Major realms, theirs minus the speaker's. Positive is looking down. */
    readonly realmsOverTheSpeaker: number;
    /** Whether anybody standing here would answer for the speaker. */
    readonly speakerIsBacked: boolean;
    /**
     * Something was actually done, rather than said.
     *
     * THE ONE THING PERCEPTION DOES NOT GOVERN. What a sentence was is a
     * question about the person who heard it; what a hand did is not a question
     * at all. Somebody four realms above who was actually robbed has been
     * robbed, and the gap that makes a threat from down there empty makes no
     * difference to the purse. Defaults to false, because this file exists for
     * the case where nothing happened but words.
     */
    readonly landed?: boolean;
    /**
     * Open records where THIS hearer is the subject and the injured party is
     * what the words named - their house, their dead, their ground.
     *
     * Guilt rather than grievance, and it is what makes an introduction sound
     * like a reckoning to the one man in the room it should. Read off the same
     * ledger as `feeling` with the holder and subject swapped.
     */
    readonly theyHaveSomethingToAnswerFor?: boolean;
}): HowTheyTookIt {
    if (!input.aboutThem) {
        return {
            took: null,
            because: 'The words named nothing they answer to, so whatever they were, they '
                + 'were not to them.'
        };
    }

    // NOBODY IS FRIGHTENED FROM DOWN THERE, and this is the branch that makes
    // a declaration funny rather than serious. At the gap where a fight is
    // over in one exchange, the person on the receiving end is not being
    // threatened - they are watching somebody who cannot reach them say
    // something about them, which is a different scene and reads as one. The
    // gap is `combat.ts`'s own, because that file already decided where being
    // able to answer stops, and a second figure here would drift from it.
    const cannotReachThem =
        input.realmsOverTheSpeaker >= HELPLESS_REALM_GAP
        && !input.speakerIsBacked
        && input.landed !== true;
    if (cannotReachThem) {
        return {
            took: null,
            because: 'It was about them and it came from somebody who could not do it, with '
                + 'nobody standing behind them. What is on the other side of that is not fear.'
        };
    }

    // TWO GROUNDS, AND NEITHER OF THEM IS THE SPEAKER. The act carrying a
    // wrong is one; something already standing between these two is the other,
    // and it is the one the words cannot carry - the same sentence, heard
    // through what the ledger says has passed. Either is enough on its own,
    // which is why a reader that guesses the act wrong changes nothing about
    // somebody who was already owed an answer.
    const held = ALREADY_STANDS_BETWEEN_THEM.has(input.feeling);
    const owed = input.theyHaveSomethingToAnswerFor === true;
    const history = held || owed;
    if (input.wrongInTheAct === null && !history) {
        return {
            took: null,
            because: 'It was about them, and there is nothing between these two for it to land on.'
        };
    }

    return {
        // The act's own wrong where it had one, and a threat where the grounds
        // are the history instead. `threatened` rather than a truer word for
        // it because that is what the ledger can hold: force offered as the
        // reason to comply is what somebody with cause hears in a pleasantry.
        took: input.wrongInTheAct ?? 'threatened',
        because: input.wrongInTheAct !== null
            ? 'It was aimed at them, and they are in a position to answer it.'
            : owed
                ? 'Nothing in the words was a wrong. This one has something to answer for to '
                  + 'whatever was named, and what they heard was it arriving.'
                : 'Nothing in the words was a wrong. Something already stands between these '
                  + 'two, and it is heard through that.'
    };
}
