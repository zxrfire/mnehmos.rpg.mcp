/**
 * A famine raised the price of food to four times and never stopped selling it.
 *
 * `AreaStatus.stops` is, in the field's own words, *what is simply not to be had
 * here while this is true*. The world writes three things into it and exactly
 * one was ever asked about:
 *
 *     STOPS_PASSAGE    read by `passageStoppedInArea`
 *     STOPS_GATHERING  written when a house closes its ground, read by nothing
 *     STOPS_FOOD       written when a harvest fails, read by nothing
 *
 * So the PRICE half of a status ran and the STOP half did not, and the two
 * halves of one status contradicted each other on the same screen. The famine
 * is the sharp case because its own authored signs say what should have been
 * true:
 *
 *     The stalls that sell cooked food have shut, and the ones that have not
 *     are selling something else.
 *
 * and its price note says *there is food, and it is not for sale at any price a
 * person who works for a living can meet* - while the player bought rations off
 * those shut stalls, at four times, every time.
 *
 * `isStoppedInArea` is the engine's own answer to this and had no caller
 * anywhere. It takes no `KnowingStage` on purpose, and the module says why: a
 * famine stops the millet for somebody who has never heard the word.
 *
 * ── WHAT A STOP DOES AND DOES NOT REACH ──────────────────────────────────
 *
 * A famine is a fact about the MARKET, not about the pack. Somebody who walked
 * in carrying provisions still has them, and the only half that goes is the
 * buying, because that is the half that needed a stall.
 *
 * And an empty market is not an empty purse. Saying the second about the first
 * sends a player away to earn money that would buy them nothing, so the two
 * have separate sentences.
 *
 * ── AND CLOSED GROUND IS REFUSED BEFORE THE DAYS, NOT AFTER ──────────────
 *
 * A house that closes its ground says so out loud - the status's signs are
 * people on the paths who are not from here, turning other people around. The
 * cost of a closed district is not being turned back at the end of a day spent
 * in it, so the gather verb asks before it spends.
 */

import { describe, it, expect } from 'vitest';

import {
    isStoppedInArea,
    liftStatus,
    makeAreaStatus,
    priceMultiplierInArea,
    stoppedInArea,
    STOPS_PASSAGE
} from '../../../src/engine/world/what-is-true-of-a-place-right-now';
import {
    STOPS_FOOD,
    STOPS_GATHERING
} from '../../../src/engine/world/what-goes-wrong-with-a-place-and-what-ends-it';
import { makeLocation } from '../../../src/engine/world/locations';

const DAY = 1000;
const HERE = 'settlement-here';

const ground = () => [
    makeLocation({ id: 'region-here', name: 'The Province', kind: 'region', qiDensity: 0.4 }),
    makeLocation({
        id: HERE, name: 'Six Li', kind: 'settlement', parentId: 'region-here', qiDensity: 0.4
    })
];

const aStatusThatStops = (what: string, over: Record<string, unknown> = {}) => [
    makeAreaStatus({
        id: `status-${what}`,
        areaId: 'region-here',
        kind: 'famine',
        beganOnDay: DAY - 10,
        reviewOnDay: DAY + 100,
        stops: [what],
        ...over
    })
];

describe('a status stops what it says it stops', () => {
    it.each([STOPS_FOOD, STOPS_GATHERING, STOPS_PASSAGE])(
        'reports %s as stopped where a status stops it',
        what => {
            expect(
                isStoppedInArea(aStatusThatStops(what), ground(), HERE, DAY, what)
            ).toBe(true);
        }
    );

    it('stops nothing where no status is running', () => {
        for (const what of [STOPS_FOOD, STOPS_GATHERING, STOPS_PASSAGE]) {
            expect(isStoppedInArea([], ground(), HERE, DAY, what)).toBe(false);
        }
    });

    /**
     * ONE STOP IS NOT ANOTHER. A closed hunting district does not shut the
     * grain stalls, and a status that stopped everything would pass every
     * assertion above.
     */
    it('does not stop a thing it did not name', () => {
        const closed = aStatusThatStops(STOPS_GATHERING);
        expect(isStoppedInArea(closed, ground(), HERE, DAY, STOPS_GATHERING)).toBe(true);
        expect(isStoppedInArea(closed, ground(), HERE, DAY, STOPS_FOOD)).toBe(false);
        expect(stoppedInArea(closed, ground(), HERE, DAY)).toEqual([STOPS_GATHERING]);
    });

    /**
     * IT REACHES DOWN THE CHAIN. A status is set on the AREA and the player
     * stands in a settlement inside it, so a read that only matched the exact
     * id would answer false everywhere anybody actually stands.
     */
    it('is true in a settlement inside the area it was set on', () => {
        expect(
            isStoppedInArea(aStatusThatStops(STOPS_FOOD), ground(), HERE, DAY, STOPS_FOOD)
        ).toBe(true);
    });

    /**
     * AND IT LIFTS. A stop that outlived its status would be worse than one
     * that never ran.
     */
    it('stops nothing before it began or after it lifted', () => {
        const famine = aStatusThatStops(STOPS_FOOD);
        expect(isStoppedInArea(famine, ground(), HERE, DAY - 500, STOPS_FOOD)).toBe(false);

        // Through `liftStatus`, which is the module's own way to end one. The
        // factory ignores a `liftedOnDay` handed to it and always begins a
        // status running, so building a lifted one by hand tests nothing.
        const lifted = famine.map(status => liftStatus(status, DAY - 1));
        expect(isStoppedInArea(lifted, ground(), HERE, DAY, STOPS_FOOD)).toBe(false);
    });
});

/**
 * THE TWO HALVES OF ONE STATUS, WHICH USED TO DISAGREE.
 *
 * The price half was live all along. That is what made the contradiction
 * legible rather than merely absent: the game moved the number and left the
 * shelf full.
 */
describe('the price half and the stop half agree', () => {
    it('a famine both moves the price of food and stops it', () => {
        const famine = [
            makeAreaStatus({
                id: 'status-famine',
                areaId: 'region-here',
                kind: 'famine',
                beganOnDay: DAY - 10,
                reviewOnDay: DAY + 100,
                stops: [STOPS_FOOD],
                priceMultiplier: 1,
                priceMultiplierByCategory: { food: 4 }
            })
        ];

        expect(priceMultiplierInArea(famine, ground(), HERE, DAY, 'food'))
            .toBeGreaterThan(1);
        expect(isStoppedInArea(famine, ground(), HERE, DAY, STOPS_FOOD)).toBe(true);
    });
});
