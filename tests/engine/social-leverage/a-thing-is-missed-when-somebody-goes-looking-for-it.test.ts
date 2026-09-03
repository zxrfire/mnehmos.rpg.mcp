/**
 * A house finds out when somebody goes looking, and not on a clock.
 *
 * Every assertion is on state - who would open it, the odds, and what the
 * house can say afterwards - and none is on prose.
 */

import { forStream } from '../../../src/engine/cultivation/rng';
import {
    DAYS_BETWEEN_ONE_READER_LOOKING,
    oddsItIsMissed,
    whatTheHouseLearns,
    whoWouldOpenIt,
    yearsBeforeSomebodyLooks
} from '../../../src/engine/social-leverage/a-thing-is-missed-when-somebody-goes-looking-for-it';

/** The working road: most of a house sits inside its band. */
const WORKING = { requiredOrdinal: 4, cap: 20 };
/** The deep book: almost nobody in the house clears its bar. */
const DEEP = { requiredOrdinal: 34, cap: 44 };

const HOUSE = [2, 5, 8, 9, 12, 14, 17, 19, 21, 28];

describe('who would open it', () => {
    it('counts the band between the bar and the ceiling', () => {
        // 5, 8, 9, 12, 14, 17, 19 are inside; 2 is below, 21 and 28 are past.
        expect(whoWouldOpenIt(WORKING, HOUSE)).toBe(7);
    });

    it('does not count somebody who has finished with it', () => {
        expect(whoWouldOpenIt({ requiredOrdinal: 4, cap: 12 }, [12])).toBe(0);
        expect(whoWouldOpenIt({ requiredOrdinal: 4, cap: 12 }, [11])).toBe(1);
    });

    it('gives the deepest book in a house almost no readers', () => {
        expect(whoWouldOpenIt(DEEP, HOUSE)).toBe(0);
    });
});

describe('when it is missed', () => {
    it('is never, for a book nobody has business with', () => {
        // Not a small number. Zero: there is no occasion on which anybody looks.
        expect(oddsItIsMissed({ readers: 0, daysElapsed: 100_000 })).toBe(0);
        expect(yearsBeforeSomebodyLooks(0)).toBeNull();
    });

    it('rises with how many people work from it', () => {
        const one = oddsItIsMissed({ readers: 1, daysElapsed: 30 });
        const six = oddsItIsMissed({ readers: 6, daysElapsed: 30 });
        expect(six).toBeGreaterThan(one);
        // Six readers make it near certain inside a month.
        expect(six).toBeGreaterThan(0.8);
    });

    it('rises with time, and never past certainty', () => {
        const short = oddsItIsMissed({ readers: 2, daysElapsed: 10 });
        const long = oddsItIsMissed({ readers: 2, daysElapsed: 4000 });
        expect(long).toBeGreaterThan(short);
        expect(long).toBeLessThanOrEqual(1);
    });

    it('is a coin flip for one reader over a season', () => {
        const odds = oddsItIsMissed({
            readers: 1, daysElapsed: DAYS_BETWEEN_ONE_READER_LOOKING
        });
        expect(odds).toBeGreaterThan(0.5);
        expect(odds).toBeLessThan(0.7);
    });

    it('tells a player what they are gambling before they take it', () => {
        const busy = yearsBeforeSomebodyLooks(6)!;
        const quiet = yearsBeforeSomebodyLooks(1)!;
        expect(busy).toBeLessThan(quiet);
    });
});

describe('what the house learns', () => {
    const rng = () => forStream('probe-seed', 'a-shelf-is-read', 'test');

    it('knows nothing at all until somebody goes looking', () => {
        const learned = whatTheHouseLearns({
            book: DEEP, memberOrdinals: HOUSE,
            couldHaveReachedIt: ['the-thief'],
            daysElapsed: 10_000, onDay: 500, rng: rng()
        });
        // Nobody clears the bar, so nobody ever opens it.
        expect(learned.missed).toBe(false);
        expect(learned.stage).toBe('unaware');
        expect(learned.yearsItWouldTake).toBeNull();
    });

    it('points at one person when only one could have reached it', () => {
        const learned = whatTheHouseLearns({
            book: WORKING, memberOrdinals: HOUSE,
            couldHaveReachedIt: ['the-thief'],
            daysElapsed: 4000, onDay: 500, rng: rng()
        });
        expect(learned.missed).toBe(true);
        expect(learned.stage).toBe('named');
    });

    it('holds the wrong and no name when several could have', () => {
        const learned = whatTheHouseLearns({
            book: WORKING, memberOrdinals: HOUSE,
            couldHaveReachedIt: ['a', 'b', 'c'],
            daysElapsed: 4000, onDay: 500, rng: rng()
        });
        expect(learned.missed).toBe(true);
        expect(learned.stage).toBe('whisper');
        expect(learned.couldHaveTakenIt).toHaveLength(3);
    });

    it('is a list and never an accusation', () => {
        const learned = whatTheHouseLearns({
            book: WORKING, memberOrdinals: HOUSE,
            couldHaveReachedIt: ['a', 'b'],
            daysElapsed: 4000, onDay: 500, rng: rng()
        });
        // No field anywhere says who did it. The house has a set and a stage.
        expect(Object.keys(learned).sort()).toEqual(
            ['couldHaveTakenIt', 'line', 'missed', 'stage', 'yearsItWouldTake']
        );
    });

    it('reads no insight and no concealment - this is an inventory, not a secret', () => {
        // The whole input is the book, the roster, the suspects, the clock and
        // the stream. There is nowhere to pass how carefully anybody hid it.
        const learned = whatTheHouseLearns({
            book: WORKING, memberOrdinals: HOUSE,
            couldHaveReachedIt: ['a'], daysElapsed: 4000, onDay: 500, rng: rng()
        });
        expect(learned.missed).toBe(true);
    });

    it('answers the same twice on the same stream', () => {
        const call = () => whatTheHouseLearns({
            book: WORKING, memberOrdinals: HOUSE,
            couldHaveReachedIt: ['a', 'b'], daysElapsed: 200, onDay: 500, rng: rng()
        });
        expect(JSON.stringify(call())).toBe(JSON.stringify(call()));
    });
});
