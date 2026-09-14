/**
 * The room had moved a sentence for an intercession since it was written, and
 * nobody had ever interceded.
 *
 * `whatTheRoomDecides` reads `brought.intercession`, moves the sentence one rung
 * down where the offer is the right KIND of thing, and reports which rung it
 * would have been. `AnIntercession` was constructed nowhere in `src/`: grepping
 * the type gave the definition, the reader, and no builder. The one call site,
 * in `complaintsBrought`, omitted the field - so the branch was reachable by
 * construction and unreached by anything anybody could type.
 *
 * ── WHAT THESE ASSERTIONS ENCODE ─────────────────────────────────────────
 *
 * A PURSE DOES NOT BUY LENIENCY, AND NO RULE SAYS SO IN WORDS. Asking for a
 * sentence to be moved runs against the body's own interest, and `PURSE_REACH`
 * at that weight is where `whatTheyWillTakeFor` stops accepting money. Asserted
 * over two hundred people rather than one, because the claim is a property of
 * the ASK: a person's disposition moves the rung one either way and the floor
 * holds under both. The second assertion is that the ladder is still being read
 * at all - one answer for everybody would pass the first one and mean nothing.
 *
 * TWO PEOPLE CANNOT SPEAK, AND THEY ARE THE TWO ENDS OF THE CASE. The accused,
 * because a plea from the dock is a defence, which is the same refusal
 * `complaintsBrought` makes at the deciding end; and whoever holds the room,
 * whose word IS the sentence rather than a request to move it.
 *
 * RED-CHECKED. Pricing the word at `a_courtesy` - the mistake that would be made
 * by somebody reading a plea as a conversation rather than as an ask against the
 * body's interest - puts money back on the list and fails the first. Returning
 * null from `whyTheWordIsNotTheirsToSay` fails the second.
 */

import { describe, it, expect } from 'vitest';
import {
    anIntercessionFor,
    whatSpeakingForSomebodyWouldTake,
    whyTheWordIsNotTheirsToSay
} from '../../../src/engine/social-leverage/somebody-speaks-for-the-accused';
import { THE_ROOM_COMPLAINTS_GO_TO } from '../../../src/engine/social-leverage/reporting-what-you-saw';
import type { WhoseCallItIs } from '../../../src/engine/social-leverage/what-an-elder-is-in-charge-of';

const ROOM: WhoseCallItIs = {
    purpose: THE_ROOM_COMPLAINTS_GO_TO,
    holderId: 'elder',
    answer: {} as never,
    theirCallAlone: true,
    line: ''
};

describe('what a word for somebody is made of', () => {
    it('is never money, whoever is asked', () => {
        const asked = Array.from({ length: 200 }, (_, at) => `npc-${at}`)
            .map(id => whatSpeakingForSomebodyWouldTake(id));

        expect(asked).not.toContain('stones');
        expect(new Set(asked).size).toBeGreaterThan(1);
    });

    it('refuses the two people whose word is not an intercession', () => {
        expect(whyTheWordIsNotTheirsToSay({
            speakerId: 'accused', accusedId: 'accused', room: ROOM
        })).toBe('the accused cannot speak for themselves');
        expect(whyTheWordIsNotTheirsToSay({
            speakerId: 'elder', accusedId: 'accused', room: ROOM
        })).toBe('the room is already theirs');
        expect(whyTheWordIsNotTheirsToSay({
            speakerId: 'friend', accusedId: 'accused', room: ROOM
        })).toBeNull();
    });

    it('carries the offer back unchanged when nobody holds the room', () => {
        // Nothing is being asked of anybody, so what would have been wanted is
        // not a fact about a person, and the room answers 'nobody to speak to'
        // before it is read.
        const word = anIntercessionFor(null, 'stones');

        expect(word.room).toBeNull();
        expect(word.wants).toBe('stones');
    });

    it('prices the word off whoever holds the room', () => {
        const word = anIntercessionFor(ROOM, 'stones');

        expect(word.wants).toBe(whatSpeakingForSomebodyWouldTake('elder'));
        expect(word.offered).toBe('stones');
    });
});
