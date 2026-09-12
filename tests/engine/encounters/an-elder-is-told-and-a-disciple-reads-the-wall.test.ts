/**
 * The board is for disciples. An elder is told.
 *
 * ── WHAT WAS WRONG, AND IT ARRIVED WITH A CORRECT CHANGE ─────────────────
 *
 * `whatAHouseHasOnItsBoard` was pointed at summonses as well as at the
 * commission board, which fixed the game thinning as you climb - acts per square
 * went 4.0 / 3.4 / 3.4 to 4.0 / 4.3 / 4.3. The generator is right. The DELIVERY
 * was not split, so the same rows reached the same person twice: once as a
 * notice they walk up and read, once as somebody arriving at their door.
 *
 * The design owner: *"tasks for elders aren't on the board, they're word of
 * mouth"* and *"the board is for disciples"*.
 *
 * An elder finding their orders pinned to a wall is the wrong world. A disciple
 * reads a wall: postings, terms, what it pays. An elder is sent for - by the
 * patriarch, by a peer at a council - and that somebody is a person with a name
 * and a standing, which is what `Duty.spokenBy` already carries and what
 * `pending-summons.ts` is already for.
 *
 * ── THE SPLIT IS DERIVED, NOT A NEW NUMBER ───────────────────────────────
 *
 * A posting is pitched at a rung and a notice reads two rungs either side -
 * `HOW_WIDE_A_NOTICE_READS`, which already existed for exactly that. So a
 * posting whose readable band reaches the top of what the house can field IS the
 * top of that house's work, and the top of a house's work is not posted. Take
 * that constant away and there is no rule left over.
 *
 * This falls out correctly at both ends without a second branch. Somebody far
 * below their house's ceiling is pitched at their own rung and reads a wall.
 * Somebody standing AT their house's ceiling is the person the house would send,
 * and nobody nails a notice up to tell the patriarch what to do.
 *
 * ── AND TAKING IT OFF THE WALL MUST NOT TAKE IT OUT OF THE WORLD ─────────
 *
 * NOT HAVING THE STANDING TO DO SOMETHING IS NOT THE SAME AS SEEING NOTHING,
 * and this is the same rule one step along: a thing that reaches you by a
 * different road has not stopped existing. So the wall still says the work is
 * there and says how it actually reaches somebody, and the summons channel still
 * offers it. The last assertion here is the one that would catch this being
 * "fixed" by dropping the rows.
 *
 * ── WHAT WENT RED FIRST ──────────────────────────────────────────────────
 *
 *   x work pitched below a house's ceiling is read off a wall
 *       -> howAnAskReaches is not a function
 *   x work pitched at a house's ceiling comes by word of mouth
 *       -> howAnAskReaches is not a function
 *   x the boundary is the band a notice already reads
 *       -> howAnAskReaches is not a function
 *   x a caller with no world still gets a wall
 *       -> howAnAskReaches is not a function
 *   x the wall names the road it comes by instead of going quiet
 *       -> whyItIsNotOnTheWall is not a function
 *   x what came off the wall is still offered by the channel that does carry it
 *       -> (passed already; pins that the fix is a split and not a deletion)
 */

import { describe, expect, it } from 'vitest';

import {
    howAnAskReaches,
    whyItIsNotOnTheWall
} from '../../../src/engine/encounters/how-an-ask-reaches-somebody.js';
import {
    HOW_WIDE_A_NOTICE_READS
} from '../../../src/engine/encounters/what-a-house-has-on-its-board.js';
import { whatAHouseWouldSendYouOn } from '../../../src/engine/encounters/duties.js';

const HOUSE = {
    id: 'house',
    name: 'Azure Cloud Pavilion',
    holdsGround: true,
    standing: 0.5,
    hasAFind: true
};

function membership(rankIndex: number) {
    return {
        factionId: HOUSE.id,
        factionName: HOUSE.name,
        rankIndex,
        rankCount: 6,
        contribution: 0
    };
}

describe('how an ask reaches somebody', () => {
    it('puts work pitched below the house ceiling on a wall', () => {
        expect(howAnAskReaches({ pitchOrdinal: 4, reachOfTheHouse: 30 })).toBe('the_wall');
    });

    it('carries work pitched at the house ceiling by word of mouth', () => {
        expect(howAnAskReaches({ pitchOrdinal: 30, reachOfTheHouse: 30 })).toBe('word_of_mouth');
    });

    it('takes its boundary from the band a notice already reads', () => {
        const reach = 30;
        const justInside = reach - HOW_WIDE_A_NOTICE_READS - 1;
        const justTouching = reach - HOW_WIDE_A_NOTICE_READS;
        expect(howAnAskReaches({ pitchOrdinal: justInside, reachOfTheHouse: reach }))
            .toBe('the_wall');
        expect(howAnAskReaches({ pitchOrdinal: justTouching, reachOfTheHouse: reach }))
            .toBe('word_of_mouth');
    });

    it('gives a caller that does not know the house a wall', () => {
        // A caller with no world knows no ceiling, and the honest answer there is
        // the ordinary one rather than silence.
        expect(howAnAskReaches({ pitchOrdinal: 40 })).toBe('the_wall');
    });

    it('names the road it comes by rather than going quiet about the work', () => {
        const said = whyItIsNotOnTheWall(HOUSE.name);
        expect(said).toContain(HOUSE.name);
        // What is actually here, and what would change it. A blank look carries
        // neither, and an empty list carries neither.
        expect(said.length).toBeGreaterThan(40);
    });
});

describe('what comes off the wall is still in the world', () => {
    it('is still offered by the channel that does carry it', () => {
        const sent = whatAHouseWouldSendYouOn({
            ordinal: 30,
            membership: membership(5),
            house: HOUSE,
            reachOfTheHouse: 30
        });
        expect(sent.length).toBeGreaterThan(0);
        // Every one of them is word of mouth at this rung, which is the whole
        // claim: the work did not go away, it changed how it arrives.
        for (const candidate of sent) {
            expect(howAnAskReaches({
                pitchOrdinal: candidate.terms.pitchOrdinal,
                reachOfTheHouse: 30
            })).toBe('word_of_mouth');
            expect(candidate.terms.origin).toBe('summons');
        }
    });
});
