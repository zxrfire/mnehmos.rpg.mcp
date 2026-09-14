/**
 * Who the house sends to carry a sentence out.
 *
 * The room decided and `a-room-hands-down-what-it-decided.ts` moved the state,
 * and between the two there was nobody. The object changed hands with no hand in
 * it, which is a state change wearing a judgement.
 *
 * ── THE ENFORCERS ARE THE HOUSE'S OWN PEOPLE, AND THERE IS NO NEW ROLE ───
 *
 * `whoIsInChargeOfWhat` already puts an elder over the punishment hall and
 * `whoStaffsWhat` already posts ordinary disciples to it. The party is read off
 * that deal and off nothing else, so a house that has never been asked this
 * question already has an answer to it and no row anywhere has to be kept.
 *
 * ── WHO GOES IS TWO READINGS, AND EITHER ONE SENDS THE ELDER ─────────────
 *
 * Severity alone decided this while the seizure was the only sentence anybody
 * was sent for, and it stopped being enough the moment the seal, the crippling
 * and the death came through the same door. `whatTheRoomDecides` puts the
 * severity through the house's alignment, so the two ladders come apart: a
 * demonic house answers a SERIOUS row with a seal, and severity alone sent two
 * ordinary disciples to seal a cultivator, while a righteous house's GRAVE row
 * sent the elder in person to collect a blade. Both readings are real and
 * neither subsumes the other, so both are read and neither can keep the elder
 * home:
 *
 *   WHAT WAS DONE     `severityRank` against {@link THE_ELDER_GOES_IN_PERSON_AT}.
 *                     A house that weighs a row as grave sends the person whose
 *                     room it is, whatever it then decides to do about it.
 *   WHAT THE ERRAND   The sentence's own rung on `SENTENCES_IN_ORDER`, decided
 *   IS                by the room and not re-decided here. From the seal upward
 *                     the sentence is carried out on the person rather than on
 *                     what they are holding, and a house does not have that
 *                     done to one of its own by hands alone.
 *
 * Two comparisons against two named rungs of two ladders that already existed,
 * and no table. A caller asking who a house COULD send rather than carrying a
 * sentence out passes no sentence, and then the severity answers on its own.
 *
 * An elder going does not send the hands home. The posted disciples do the
 * carrying either way and what changes is whether the person who decided is
 * standing there while it happens.
 *
 * ── AND A SHORTAGE IS ANSWERED BY THE OTHER RUNG ─────────────────────────
 *
 * A house with nobody over the room sends the people in it, and a house with
 * nobody in the room sends whoever holds it. Neither, and there is nobody to
 * send - the same answer `whoTakesAReportAt` gives for the same shortage, and it
 * is a real one: a body with no punishment hall staffed by anybody cannot go and
 * take a thing off somebody, and saying so beats inventing a bailiff.
 *
 * The backward read is already built: `wherePostedTo` says every room a person
 * works in and `whatTheyHold` says every room they are over, so asking what
 * somebody could be sent on needs nothing added here.
 */

import { severityRank, type Severity } from '../social/grudges.js';
import type { RoomPurpose } from '../world/architecture.js';
import { whoAnswersAbout, type APortfolio } from './what-an-elder-is-in-charge-of.js';
import { THE_ROOM_COMPLAINTS_GO_TO } from './reporting-what-you-saw.js';
import { whoWorksIn, type APost } from './who-works-in-an-elders-hall.js';
import {
    SENTENCES_IN_ORDER,
    type Sentence
} from './what-a-room-decides-about-one-of-its-own.js';

/**
 * The band of offence at which the person who holds the room stops sending
 * people and goes.
 *
 * Named rather than typed into the comparison, because it is one of the two
 * judgements in this file and the next person should be able to find them.
 */
export const THE_ELDER_GOES_IN_PERSON_AT: Severity = 'grave';

/**
 * The lightest sentence the holder of the room goes along for.
 *
 * The line falls where the sentence stops being carried out on what somebody is
 * holding and starts being carried out on the person.
 */
export const THE_ELDER_GOES_IN_PERSON_FOR: Sentence = 'years sealed and held';

export type WhoWent =
    /** The holder of the room, and the hands posted to it. */
    | 'the elder whose room it is'
    /** The hands posted to it, on their own. */
    | 'disciples posted to the room'
    /** Nobody holds the room and nobody works in it. */
    | 'nobody the house could send';

export interface SomebodyWasSent {
    who: WhoWent;
    /** Everybody who goes, the holder first where one does. Empty means nobody. */
    partyIds: readonly string[];
    /** Who reads the sentence out, where the house has somebody to. */
    holderId: string | null;
    purpose: RoomPurpose;
    /** True where the rung the severity asked for was empty and the other went. */
    theOtherRungWent: boolean;
    /** Engine truth, one line, for the mechanical channel. Never narration. */
    line: string;
}

export function whoIsSentToCarryItOut(input: {
    /** Off the complaint row. Never re-decided here. */
    severity: Severity;
    /**
     * What the room settled on, from `whatTheRoomDecides`. Omitted by a caller
     * asking who a house could send rather than sending them.
     */
    sentence?: Sentence;
    portfolios: readonly APortfolio[];
    posts: readonly APost[];
    /** Defaults to the room complaints go to, which is where this arc lives. */
    purpose?: RoomPurpose;
}): SomebodyWasSent {
    const purpose = input.purpose ?? THE_ROOM_COMPLAINTS_GO_TO;
    const holderId = whoAnswersAbout(input.portfolios, purpose);
    const posted = whoWorksIn(input.posts, purpose).filter(id => id !== holderId);
    const wantsTheElder =
        severityRank(input.severity) >= severityRank(THE_ELDER_GOES_IN_PERSON_AT)
        || (input.sentence !== undefined
            && SENTENCES_IN_ORDER.indexOf(input.sentence)
                >= SENTENCES_IN_ORDER.indexOf(THE_ELDER_GOES_IN_PERSON_FOR));

    if (holderId === null && posted.length === 0) {
        return {
            who: 'nobody the house could send',
            partyIds: [],
            holderId: null,
            purpose,
            theOtherRungWent: false,
            line: `Nobody holds ${purpose} and nobody is posted to it. The house has nobody `
                + 'to send.'
        };
    }

    const elderGoes = wantsTheElder ? holderId !== null : posted.length === 0;
    const theOtherRungWent = elderGoes !== wantsTheElder;

    if (elderGoes) {
        return {
            who: 'the elder whose room it is',
            partyIds: [holderId!, ...posted],
            holderId,
            purpose,
            theOtherRungWent,
            line: theOtherRungWent
                ? `Nobody is posted to ${purpose}, so the elder who holds it goes.`
                : `The elder who holds ${purpose} goes in person, and the disciples posted `
                  + 'there go with them.'
        };
    }

    return {
        who: 'disciples posted to the room',
        partyIds: posted,
        holderId,
        purpose,
        theOtherRungWent,
        line: theOtherRungWent
            ? `Nobody holds ${purpose}, so the disciples posted to it go.`
            : `The disciples posted to ${purpose} are sent. The elder does not go.`
    };
}
