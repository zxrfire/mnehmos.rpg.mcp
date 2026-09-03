/**
 * STANDING ABOVE SOMEBODY IS NOT THE SAME FACT AS HOLDING A ROAD.
 *
 * ── THE MEASUREMENT THAT MADE THIS NECESSARY ─────────────────────────────
 *
 * Five seeded worlds, asked how many people could carry a cultivator standing
 * at ordinal 38 any further. The answer is the same on every seed:
 *
 *   6 people in the world, standing in 2 places.
 *   5 of the 6 on the Hollow Court's ground - the First, Second, Third and
 *     Fourth Seats, and Shen Quan.
 *   1 is Ru Anwei, at 41, in a hall she has not left in 380 years.
 *
 * That is the top of the ladder working exactly as designed, and it is not
 * what this file is about. What this file is about is that the read a player
 * types - `who can teach me` - never said any of it. It answered "N stand
 * above you, M of those teach" and stopped, so a player standing in front of
 * the one person in the province who could take them to 41 was told she was
 * above them and nothing else.
 *
 * The ASK path has priced this correctly since it was written:
 * `what-asking-this-person-for-this-would-cost-them.ts` reads `carriesTo` off
 * what somebody is actually carrying and prices what handing it over would
 * cost them. What was missing was any read that pointed a player at it, so the
 * only way to find the road was to spend a turn walking up to each person
 * above you in turn.
 *
 * ── AND `willTeach` IS NOT THE SAME QUESTION ─────────────────────────────
 *
 * The distinction the measurement forced. `willTeach` is `role: 'master'` on a
 * catalog row - the author saying somebody teaches. `carriesYouTo` is
 * arithmetic off what they hold. They come apart in both directions, and the
 * interesting direction is the one the seeded world produced: Shen Quan is
 * marked a master nowhere and is one of the six people alive who could take a
 * cultivator at 38 any further. A read that only prints masters loses him.
 */

import { describe, expect, it } from 'vitest';

import { whoWouldTeach, type SomebodyAbove } from '../../src/web/who-would-teach-this-cultivator';

const AT = 38;

const ABOVE = (over: Partial<SomebodyAbove> = {}): SomebodyAbove => ({
    name: 'Ru Anwei',
    realmOrdinal: 41,
    rankTitle: null,
    willTeach: false,
    knows: null,
    mayNotSay: null,
    costsThem: null,
    here: false,
    carriesYouTo: null,
    ...over
});

const readOf = (above: SomebodyAbove[]) => whoWouldTeach({
    name: 'Probe',
    ordinal: AT,
    placeName: 'the terraces',
    sectName: null,
    above,
    manualState: 'exhausted'
});

describe('a person carrying a road', () => {
    it('is said to be one, in the rung it reaches', () => {
        const read = readOf([ABOVE({ carriesYouTo: 41 })]);
        expect(read.lines.join(' ')).toContain('could take you to');
        // The rung, not the ordinal, because this is the player-facing half.
        expect(read.lines.join(' ')).toMatch(/could take you to \w/);
    });

    it('says it for somebody the roll does not mark a teacher', () => {
        // Shen Quan's case, and the reason the field is not folded into
        // `willTeach`. He is carrying the Heaven-Conversing Primordial Canon,
        // which no shelf in the world holds, and nothing anywhere calls him a
        // master.
        const read = readOf([ABOVE({ name: 'Shen Quan', realmOrdinal: 39, carriesYouTo: 39 })]);
        const whole = read.lines.join(' ');
        expect(whole).toContain('Nothing on record says they teach.');
        expect(whole).toContain('could take you to');
    });

    it('says nothing of the kind about somebody carrying nothing further', () => {
        // The ordinary case, and it is by far the commonest: most people above
        // you hold a book that stops below where you already are.
        const read = readOf([ABOVE({ carriesYouTo: null })]);
        expect(read.lines.join(' ')).not.toContain('could take you to');
    });
});

describe('what the engine channel counts', () => {
    it('counts roads separately from headcount and from masters', () => {
        const read = readOf([
            ABOVE({ name: 'Ru Anwei', realmOrdinal: 41, carriesYouTo: 41 }),
            ABOVE({ name: 'An elder', realmOrdinal: 40, willTeach: true, carriesYouTo: null }),
            ABOVE({ name: 'Another', realmOrdinal: 39, carriesYouTo: null })
        ]);
        const structure = read.structure.join(' ');
        expect(structure).toContain('3 stand above');
        expect(structure).toContain('3 can be named');
        expect(structure).toContain('1 of those teach');
        // The number that actually answers the question, and the one that was
        // not being reported at all: one road among three people above.
        expect(structure).toContain('1 are carrying a road that goes past');
    });

    it('never counts a road for somebody the player cannot name', () => {
        // The gate, restated as a property of the answer rather than of the
        // caller: what somebody practises is not legible across a yard, so an
        // unnamed person contributes to the headcount and to nothing else.
        const read = readOf([ABOVE({ name: null, carriesYouTo: null })]);
        expect(read.structure.join(' ')).toContain('0 are carrying a road');
        expect(read.lines.join(' ')).not.toContain('could take you to');
    });
});
