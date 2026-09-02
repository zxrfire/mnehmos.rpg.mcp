/**
 * What a fight teaches - the rate, the ceiling, and where it stops.
 *
 * Design owner: *"Fighting should give you comprehension of your art (and your
 * cultivation too, to some extent). You can't get to 46 only by fighting but
 * you do learn."*
 *
 * Both halves of that sentence are numbers, and AGENTS.md is explicit that a
 * design decision living only as a number needs a test with the reasoning in
 * it. This is that test. The three decisions it pins:
 *
 *   THE RATE          `FIGHT_INSIGHT_CHANCE` 0.02 and `FIGHT_PROGRESS_SHARE`
 *                     0.002. About fifty real fights for one degree of
 *                     comprehension; five hundred to carry a rung, if it could
 *                     carry a whole one.
 *   THE CEILING       `FIGHT_CARRIES_AT_MOST` 0.6. It cannot. Fighting stops
 *                     paying at three fifths of a rung and the rest has to be
 *                     cultivated, structurally and with nothing stored.
 *   WHERE IT STOPS    Four rungs below you, which is where `REGARD_BANDS`'
 *                     `assured` window already starts. Not a new scale.
 *
 * ── THE MEASUREMENT ──────────────────────────────────────────────────────
 *
 * Taken by this file, back to back in one process, so no other agent's tree is
 * in it:
 *
 *   fights to carry one rung, at your own height          500
 *   fights to carry one rung, against somebody above      250
 *   fights fighting will actually pay for, from empty     300  (then zero)
 *   fights for one degree of comprehension, at height      50
 *   fights from nothing to a `dao` comprehension          250
 *
 * Five hundred fights a rung against forty-six rungs is twenty-three thousand
 * fights, every one of which can leave a wound that does not close on its own -
 * and it does not matter, because the ceiling makes the total unreachable at
 * any number. That is the shape the owner's sentence asks for: the number is
 * absurd in the right direction AND the road is closed at the end, so nobody
 * has to trust the rate alone.
 */

import { describe, it, expect } from 'vitest';
import {
    FIGHT_CARRIES_AT_MOST,
    FIGHT_INSIGHT_CHANCE,
    FIGHT_PROGRESS_SHARE,
    FIGHT_TEACHING_BY_BAND,
    fightsBeforeTheRungStopsPaying,
    fightsToCarryARung,
    whatAFightTaught,
    type AFightThatHappened
} from '../../../src/engine/cultivation/what-a-fight-teaches.js';
import { bandForGap } from '../../../src/engine/cultivation/regard.js';
import { progressRequiredForOrdinal } from '../../../src/engine/cultivation/realms.js';
import { MAX_DEGREE, MAX_SUBSTITUTION } from '../../../src/engine/cultivation/understanding.js';

function aFight(over: Partial<AFightThatHappened> = {}): AFightThatHappened {
    return {
        yourOrdinal: 10,
        theirOrdinal: 10,
        exchanges: 4,
        outcome: 'withdrawal',
        subject: 'sword',
        element: null,
        cultivationProgress: 0,
        ...over
    };
}

describe('a fight has to have been a fight', () => {
    it('teaches nothing when nothing was exchanged', () => {
        const taught = whatAFightTaught(aFight({ exchanges: 0 }));
        expect(taught.progress).toBe(0);
        expect(taught.comprehensionChance).toBe(0);
        expect(taught.why).toMatch(/nothing to learn from/);
    });

    it('teaches nothing when the gap ended it before anything was contested', () => {
        const taught = whatAFightTaught(aFight({ outcome: 'no_contest', exchanges: 2 }));
        expect(taught.progress).toBe(0);
        expect(taught.comprehensionChance).toBe(0);
    });

    it('teaches nothing about an art to somebody who fought bare', () => {
        const taught = whatAFightTaught(aFight({ subject: null }));
        expect(taught.about).toBeNull();
        expect(taught.comprehensionChance).toBe(0);
        // The body still learned something about being in a fight, which is
        // what the accumulation half is.
        expect(taught.progress).toBeGreaterThan(0);
    });
});

describe('where it stops is REGARD_BANDS own line, not a new one', () => {
    it('beating somebody four rungs below teaches nothing at all', () => {
        // Four is where `assured` starts. It is the table's boundary and this
        // test exists to say the boundary was reached for rather than invented.
        expect(bandForGap(4)).toBe('assured');
        const taught = whatAFightTaught(aFight({ yourOrdinal: 14, theirOrdinal: 10 }));
        expect(taught.band).toBe('assured');
        expect(taught.weight).toBe(0);
        expect(taught.progress).toBe(0);
        expect(taught.comprehensionChance).toBe(0);
        expect(taught.why).toMatch(/practice against a post/);
    });

    it('beating somebody three rungs below still teaches, because the table says matched', () => {
        expect(bandForGap(3)).toBe('matched');
        const taught = whatAFightTaught(aFight({ yourOrdinal: 13, theirOrdinal: 10 }));
        expect(taught.band).toBe('matched');
        expect(taught.weight).toBe(1);
        expect(taught.comprehensionChance).toBeCloseTo(FIGHT_INSIGHT_CHANCE, 10);
    });

    it('fighting somebody above you is worth double and never more', () => {
        for (const gap of [-1, -3, -5, -12]) {
            const taught = whatAFightTaught(aFight({ yourOrdinal: 20, theirOrdinal: 20 - gap }));
            expect(taught.weight).toBe(2);
        }
        // Double, and not quadruple. Paying more would make a series of
        // suicidal fights the correct play, which is a different sentence from
        // "you learn most from a hard fight".
        expect(Math.max(...Object.values(FIGHT_TEACHING_BY_BAND))).toBe(2);
    });

    it('every band has a decision recorded against it', () => {
        // Exhaustiveness is a compile-time property of the Record; this asserts
        // the runtime table has not been half-filled, and that a band added to
        // REGARD_BANDS forces somebody to decide here.
        const bands = Object.keys(FIGHT_TEACHING_BY_BAND);
        expect(bands).toHaveLength(7);
        expect(new Set(bands)).toEqual(new Set([
            'unreachable', 'overmatched', 'stretch', 'matched', 'assured', 'beneath', 'dismissed'
        ]));
    });
});

describe('the rate, stated so it cannot be quietly moved', () => {
    it('is five hundred fights to a rung at your own height', () => {
        expect(fightsToCarryARung('matched')).toBe(500);
    });

    it('is two hundred and fifty against somebody above you', () => {
        expect(fightsToCarryARung('stretch')).toBe(250);
    });

    it('is never, against somebody far below', () => {
        expect(fightsToCarryARung('assured')).toBe(Infinity);
        expect(fightsToCarryARung('beneath')).toBe(Infinity);
    });

    it('is about fifty fights for one degree of comprehension', () => {
        const taught = whatAFightTaught(aFight());
        expect(1 / taught.comprehensionChance).toBeCloseTo(50, 6);
    });

    it('is about two hundred and fifty fights from nothing to a dao comprehension', () => {
        const taught = whatAFightTaught(aFight());
        expect(MAX_DEGREE / taught.comprehensionChance).toBeCloseTo(250, 6);
    });
});

describe('the ceiling: you cannot get to 46 only by fighting', () => {
    it('stops paying at three fifths of the rung', () => {
        const required = progressRequiredForOrdinal(10)!;
        const atTheLine = whatAFightTaught(aFight({
            cultivationProgress: required * FIGHT_CARRIES_AT_MOST
        }));
        expect(atTheLine.progress).toBe(0);
        expect(atTheLine.why).toMatch(/carries nobody further/);
    });

    it('pays a partial amount right up to the line and nothing over it', () => {
        const required = progressRequiredForOrdinal(10)!;
        // Just under, with less room left than one fight is worth: it gets the
        // room and not the full share, so the ceiling is exact rather than
        // being overshot by whatever the last fight happened to be worth.
        const room = required * FIGHT_PROGRESS_SHARE * 0.3;
        const nearly = whatAFightTaught(aFight({
            cultivationProgress: required * FIGHT_CARRIES_AT_MOST - room
        }));
        expect(nearly.progress).toBeCloseTo(room, 6);
        expect(nearly.progress).toBeLessThan(required * FIGHT_PROGRESS_SHARE);
    });

    it('leaves the last two fifths of every rung to be cultivated, at every rung', () => {
        for (let ordinal = 0; ordinal < 46; ordinal++) {
            const required = progressRequiredForOrdinal(ordinal);
            if (required === null) continue;
            const full = whatAFightTaught(aFight({
                yourOrdinal: ordinal,
                theirOrdinal: ordinal,
                cultivationProgress: required
            }));
            expect(full.progress).toBe(0);
            // And the strongest possible fight, against somebody far above, is
            // still refused past the line.
            const hardest = whatAFightTaught(aFight({
                yourOrdinal: ordinal,
                theirOrdinal: ordinal + 8,
                cultivationProgress: required * FIGHT_CARRIES_AT_MOST
            }));
            expect(hardest.weight).toBe(2);
            expect(hardest.progress).toBe(0);
        }
    });

    it('needs no stored counter to hold, which is why it cannot rot', () => {
        // The same fight, twice, with only the progress already accumulated
        // differing. Nothing about "how much of this came from fighting" is
        // read, because nothing writes it - see AGENTS.md, a field nothing
        // writes. The ceiling is a function of state the world already keeps.
        const required = progressRequiredForOrdinal(10)!;
        const empty = whatAFightTaught(aFight({ cultivationProgress: 0 }));
        const nearlyFull = whatAFightTaught(aFight({ cultivationProgress: required * 0.99 }));
        expect(empty.progress).toBeGreaterThan(0);
        expect(nearlyFull.progress).toBe(0);
    });

    it('and comprehension bought entirely with blood still cannot cross a rung', () => {
        // The other ceiling, and it was already enforced before this module
        // existed. A cultivator who fought their way to a perfect comprehension
        // of their own road has bought at most a third of any requirement.
        expect(MAX_SUBSTITUTION).toBeLessThan(0.5);
        expect(MAX_SUBSTITUTION + 0).toBeLessThan(1);
    });

    it('pays for three hundred fights from an empty rung and none after', () => {
        expect(fightsBeforeTheRungStopsPaying('matched')).toBe(300);
        expect(fightsBeforeTheRungStopsPaying('stretch')).toBe(150);
    });
});

describe('what it teaches is about the art that was actually used', () => {
    it('files the sword under weapon, off understanding.ts own table', () => {
        const taught = whatAFightTaught(aFight({ subject: 'sword' }));
        expect(taught.about).toEqual({ domain: 'weapon', subject: 'sword' });
    });

    it('files a formation under formation', () => {
        const taught = whatAFightTaught(aFight({ subject: 'formation' }));
        expect(taught.about).toEqual({ domain: 'formation', subject: 'formation' });
    });
});
