/**
 * A sentence was handed down and nobody carried it out.
 *
 * `whatTheRoomDecides` has decided seven sentences since it was written and
 * `handDownWhatTheRoomDecided` has moved the state for all seven, and between
 * the two there was nobody at all: the thing a house seized changed hands with
 * no hand in it. The design owner's ruling is that a seizure is a PUNISHMENT
 * and that *"it sends the punishment disciples or even the elder to enforce"*,
 * which is the half a player would actually meet.
 *
 * ── WHAT THESE ASSERTIONS ENCODE ─────────────────────────────────────────
 *
 * THE PARTY IS THE HOUSE'S OWN PEOPLE AND THERE IS NO NEW ROLE. Everything
 * asserted below is read off `whoIsInChargeOfWhat` and `whoStaffsWhat`, which
 * already put an elder over the punishment hall and ordinary disciples in it.
 * A house nobody has ever asked this question already has an answer.
 *
 * SENIORITY FOLLOWS THE SANCTION, AND IT IS THE SEVERITY THAT SAYS SO. The
 * band is read off `THE_ELDER_GOES_IN_PERSON_AT` and the two bands either side
 * of it rather than off the word `grave`, so re-banding severity moves this
 * test with it instead of failing it on a name.
 *
 * AND WHAT THE ERRAND IS SAYS SO TOO. That was the whole rule while the seizure
 * was the only sentence anybody was sent for, and it stopped being enough when
 * the seal, the crippling and the death came through the same door. The two
 * ladders come apart: the sentence is the severity put through the house's
 * alignment, so a house can answer a row UNDER the band with a sentence carried
 * out on the person - and severity alone sent two ordinary disciples to seal a
 * cultivator. `THE_ELDER_GOES_IN_PERSON_FOR` is the second reading, read off
 * `SENTENCES_IN_ORDER`, and neither reading can keep the elder home. The last
 * case below asserts the disagreement is REACHABLE rather than theoretical: if
 * no house can ever answer a light row with a heavy sentence, the second
 * reading buys nothing and should come out.
 *
 * A SHORTAGE IS ANSWERED BY THE OTHER RUNG, NOT BY NOBODY. A house with no
 * elder over the room still has hands in it, and a house with no hands still
 * has the elder. Only a house with neither has nobody, and saying so beats
 * inventing a bailiff.
 *
 * RED-CHECKED, all ten. Holding `wantsTheElder` at false fails the two band
 * assertions; dropping either fallback fails the shortage pair; returning the
 * holder in `partyIds` when the disciples go fails the first; dropping the
 * sentence half of `wantsTheElder` fails the errand pair; making it the only
 * half fails the light-sentence case.
 */

import { describe, it, expect } from 'vitest';
import {
    THE_ELDER_GOES_IN_PERSON_AT,
    THE_ELDER_GOES_IN_PERSON_FOR,
    whoIsSentToCarryItOut
} from '../../../src/engine/social-leverage/somebody-is-sent-to-carry-it-out';
import { THE_ROOM_COMPLAINTS_GO_TO } from '../../../src/engine/social-leverage/reporting-what-you-saw';
import {
    SENTENCES_IN_ORDER,
    whatTheRoomDecides,
    type Sentence
} from '../../../src/engine/social-leverage/what-a-room-decides-about-one-of-its-own';
import { SEVERITY_ORDER, severityRank, type Severity } from '../../../src/engine/social/grudges';

const AT = severityRank(THE_ELDER_GOES_IN_PERSON_AT);
const BELOW = SEVERITY_ORDER[AT - 1] as Severity;
const ABOVE = SEVERITY_ORDER[AT + 1] as Severity;

const room = (holderId: string | null) =>
    [{ purpose: THE_ROOM_COMPLAINTS_GO_TO, holderId, depth: 0.65 }];

const staff = (...ids: string[]) =>
    ids.map(personId => ({
        purpose: THE_ROOM_COMPLAINTS_GO_TO, personId, selectedById: 'elder'
    }));

describe('who the house sends', () => {
    it('sends the posted disciples below the band, and the elder stays out of it', () => {
        const sent = whoIsSentToCarryItOut({
            severity: BELOW, portfolios: room('elder'), posts: staff('hand-a', 'hand-b')
        });
        expect(sent.who).toBe('disciples posted to the room');
        expect(sent.partyIds).toEqual(['hand-a', 'hand-b']);
        expect(sent.theOtherRungWent).toBe(false);
        // The room is still theirs. Not going is not the same as having no say,
        // which is what the notice half then reads off.
        expect(sent.holderId).toBe('elder');
    });

    it('sends the elder at the band and above, and the hands go with them', () => {
        for (const severity of [THE_ELDER_GOES_IN_PERSON_AT, ABOVE]) {
            const sent = whoIsSentToCarryItOut({
                severity, portfolios: room('elder'), posts: staff('hand-a')
            });
            expect(sent.who).toBe('the elder whose room it is');
            expect(sent.partyIds).toEqual(['elder', 'hand-a']);
            expect(sent.theOtherRungWent).toBe(false);
        }
    });

    it('sends the hands when the room is held by nobody', () => {
        const sent = whoIsSentToCarryItOut({
            severity: ABOVE, portfolios: room(null), posts: staff('hand-a')
        });
        expect(sent.who).toBe('disciples posted to the room');
        expect(sent.partyIds).toEqual(['hand-a']);
        expect(sent.theOtherRungWent).toBe(true);
    });

    it('sends the elder when nobody is posted to the room', () => {
        const sent = whoIsSentToCarryItOut({
            severity: BELOW, portfolios: room('elder'), posts: []
        });
        expect(sent.who).toBe('the elder whose room it is');
        expect(sent.partyIds).toEqual(['elder']);
        expect(sent.theOtherRungWent).toBe(true);
    });

    it('has nobody to send where the house has neither', () => {
        const sent = whoIsSentToCarryItOut({
            severity: ABOVE, portfolios: room(null), posts: []
        });
        expect(sent.who).toBe('nobody the house could send');
        expect(sent.partyIds).toEqual([]);
        expect(sent.holderId).toBeNull();
    });

    it('does not reach into a room this is not about', () => {
        // Somebody posted to the archive is not a hand the punishment hall has.
        const sent = whoIsSentToCarryItOut({
            severity: BELOW,
            portfolios: [{ purpose: 'archive', holderId: 'elder', depth: 0.8 }],
            posts: [{ purpose: 'archive', personId: 'hand-a', selectedById: 'elder' }]
        });
        expect(sent.who).toBe('nobody the house could send');
    });
});

const HEAVY = SENTENCES_IN_ORDER.indexOf(THE_ELDER_GOES_IN_PERSON_FOR);
/** The heaviest errand the hands are still sent on alone. */
const THE_RUNG_BELOW = SENTENCES_IN_ORDER[HEAVY - 1] as Sentence;

describe('and what the errand is', () => {
    it('sends the elder for a sentence carried out on the person, under the band', () => {
        const sent = whoIsSentToCarryItOut({
            severity: BELOW,
            sentence: THE_ELDER_GOES_IN_PERSON_FOR,
            portfolios: room('elder'),
            posts: staff('hand-a')
        });
        expect(sent.who).toBe('the elder whose room it is');
        expect(sent.partyIds).toEqual(['elder', 'hand-a']);
    });

    it('sends the hands alone for every sentence below that rung', () => {
        for (const sentence of SENTENCES_IN_ORDER.slice(0, HEAVY)) {
            const sent = whoIsSentToCarryItOut({
                severity: BELOW, sentence, portfolios: room('elder'), posts: staff('hand-a')
            });
            expect(sent.who, sentence).toBe('disciples posted to the room');
        }
    });

    it('still sends the elder on the severity alone, for the lightest errand', () => {
        // Neither reading subsumes the other. A house that weighs a row as
        // grave sends the person whose room it is, whatever it then decided to
        // do about it.
        const sent = whoIsSentToCarryItOut({
            severity: ABOVE,
            sentence: THE_RUNG_BELOW,
            portfolios: room('elder'),
            posts: staff('hand-a')
        });
        expect(sent.who).toBe('the elder whose room it is');
    });

    it('answers on the severity alone where the caller is not carrying one out', () => {
        expect(whoIsSentToCarryItOut({
            severity: BELOW, portfolios: room('elder'), posts: staff('hand-a')
        }).who).toBe('disciples posted to the room');
    });

    it('is answering a disagreement a house can actually produce', () => {
        // The whole justification for the second reading. If no house can ever
        // answer a row under the band with a sentence over it, the sentence
        // half buys nothing and should come out.
        const found = SEVERITY_ORDER
            .filter(severity =>
                severityRank(severity) < severityRank(THE_ELDER_GOES_IN_PERSON_AT))
            .flatMap(severity => (['righteous', 'neutral', 'demonic'] as const)
                .map(alignment => whatTheRoomDecides({
                    what: { does: 'reports', toId: 'somebody', line: 'it was brought' },
                    theirsToPunish: true,
                    alignment,
                    severity,
                    houseId: null,
                    theHouseGaveThemSomething: false
                }).sentence))
            .some(sentence => SENTENCES_IN_ORDER.indexOf(sentence) >= HEAVY);
        expect(found).toBe(true);
    });
});
