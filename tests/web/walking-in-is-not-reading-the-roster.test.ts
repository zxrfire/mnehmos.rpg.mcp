/**
 * WALKING IN IS NOT READING THE ROSTER.
 *
 * The design owner: *"when you show up to a new area, you typically encounter 1
 * person (or his party if he's in one, so more than one) and that's your person
 * you talk to. If there's more people, you have to specifically ask: who else
 * is here? [...] you don't necessarily know everyone who is here right off the
 * bat."*
 *
 * And the two edges of it: *"not every place has people too it could be
 * empty"*, *"or it could have too many people to name independently all at
 * once"*, *"like even if it holds too many you can find an individual."*
 *
 * TWO READINGS OF ONE SQUARE, and not two squares. Nothing is hidden from the
 * asked read that the walked-in one saw, and nothing is invented for it. What
 * these pin is that walking in does not hand over a census, that asking does,
 * and that the person the ground hands you is chosen by facts about them rather
 * than by whoever the roster happens to sort first.
 */

import { describe, it, expect } from 'vitest';

import {
    factsForCompany,
    factsForLook,
    whoTheGroundHandsYou,
    type Company,
    type SomebodyInTheSquare
} from '../../src/web/facts';
import type { Cultivator } from '../../src/schema/cultivation';

function standingIn(place: string, ordinal: number): Cultivator {
    // `factsForLook` reads the body as well as the square, unlike
    // `factsForCompany`. Only the fields it actually touches are filled.
    return {
        location: place,
        realmOrdinal: ordinal,
        name: 'You',
        age: 20,
        injuries: [],
        hp: 100,
        maxHp: 100,
        satiety: 100,
        spiritStones: 0,
        spiritRoot: 'single_water',
        attributes: { might: 2, insight: 2, fortune: 1, charm: 2 },
        techniques: [],
        sect: null,
        yearsAtCurrentRealm: 1,
        qi: 50,
        maxQi: 50,
        foundation: 'stable',
        realmProgress: 0
    } as unknown as Cultivator;
}

const AMBIENT = 'thin' as never;

function somebody(over: Partial<SomebodyInTheSquare> & { name: string }): SomebodyInTheSquare {
    return {
        ordinal: 6,
        sex: 'male',
        age: 40,
        rank: null,
        at: 'at a counter',
        looksUp: true,
        playsToTheRoom: 0,
        withNames: [],
        like: null,
        ...over
    };
}

function squareOf(named: SomebodyInTheSquare[], strangers = 0, total?: number): Company {
    return {
        named,
        strangers: Array.from({ length: strangers }, () => ({ ordinal: 5 })),
        total: total ?? named.length + strangers
    };
}

describe('walking into a square', () => {
    it('hands over one person and a count, not four names', () => {
        const square = squareOf([
            somebody({ name: 'Yan Shuling', playsToTheRoom: 0.8 }),
            somebody({ name: 'Cen Qingzhi', playsToTheRoom: 0.1 }),
            somebody({ name: 'Mu Yanling', playsToTheRoom: -0.2 }),
            somebody({ name: 'Cai Ruzhen', playsToTheRoom: -0.6 })
        ]);
        const prose = factsForLook(standingIn('Azure Cloud Pavilion', 6), AMBIENT, square).prose;

        expect(prose).toContain('Yan Shuling');
        for (const other of ['Cen Qingzhi', 'Mu Yanling', 'Cai Ruzhen']) {
            expect(prose).not.toContain(other);
        }
        // And the rest are not concealed - saying they are there is the
        // invitation to ask. It was a COUNT that said so, `/three others|are
        // here besides/`, until the design owner ruled that a group is named
        // rather than tallied: the named person carries the rest, which is the
        // reference corpus's own construction. See
        // `a-group-of-people-is-named-not-counted.test.ts`.
        expect(prose).toMatch(/The others are here too/);
    });

    it('gives the same square up in full when you actually ask', () => {
        const square = squareOf([
            somebody({ name: 'Yan Shuling', playsToTheRoom: 0.8 }),
            somebody({ name: 'Cen Qingzhi', playsToTheRoom: 0.1 }),
            somebody({ name: 'Mu Yanling', playsToTheRoom: -0.2 })
        ]);
        const asked = factsForCompany(standingIn('Azure Cloud Pavilion', 6), square).prose;
        for (const each of ['Yan Shuling', 'Cen Qingzhi', 'Mu Yanling']) {
            expect(asked).toContain(each);
        }
    });

    it('brings their party with them, because a party is who they are at it with', () => {
        const square = squareOf([
            somebody({
                name: 'Cai Ruzhen',
                playsToTheRoom: 0.5,
                at: 'putting a party together, and Shi Weiran and Hou Baiyu have said yes',
                withNames: ['Shi Weiran', 'Hou Baiyu']
            }),
            somebody({ name: 'Shi Weiran', playsToTheRoom: 0.1 }),
            somebody({ name: 'Hou Baiyu', playsToTheRoom: -0.4 })
        ]);
        const prose = factsForLook(standingIn('Azure Cloud Pavilion', 6), AMBIENT, square).prose;

        // The party comes over inside the clause rather than as a second list.
        expect(prose).toContain('Shi Weiran');
        expect(prose).toContain('Hou Baiyu');
        expect(prose).toContain('not on their own');
        // And they are not then counted a second time as strangers behind them.
        expect(prose).not.toMatch(/here besides/);
    });

    it('is quiet about a place with nobody in it', () => {
        const prose = factsForLook(standingIn('a dry ridge', 6), AMBIENT, squareOf([])).prose;
        expect(prose).not.toMatch(/is here|are about|are here besides/);
    });

    it('still finds you an individual in a place too full to name', () => {
        // *"It could have too many people to name independently all at once"*
        // and *"even if it holds too many you can find an individual."* Both,
        // in one square: one person handed over by name and the rest folded in
        // behind them.
        //
        // This asserted `'99 people'` in the prose. The design owner ruled the
        // headcount out - a group is named, not tallied - and the figure moved
        // to `structure`, which is the channel a player does not read. Both
        // halves are asserted here, because the split is the whole rule.
        const square = squareOf([somebody({ name: 'Ji Suilu', playsToTheRoom: 0.9 })], 0, 100);
        const facts = factsForLook(standingIn('the market', 6), AMBIENT, square);
        const prose = facts.prose;
        expect(prose).toContain('Ji Suilu');
        expect(prose).toMatch(/The others are here too/);
        expect(prose).not.toMatch(/\b\d+\s+people\b/);
        expect(facts.structure.join(' ')).toMatch(/\b100\b/);
    });
});

describe('who the ground hands you', () => {
    it('is somebody facing out of it, whatever the roster order', () => {
        // The deepest person in a square is not the person who greets you at
        // the gate. Somebody behind a shut door is still here and is not it.
        const shutIn = somebody({ name: 'The Grand Sword Elder', ordinal: 40, looksUp: false, playsToTheRoom: 0.9 });
        const atACounter = somebody({ name: 'Duan Cishi', ordinal: 4, looksUp: true, playsToTheRoom: -0.3 });
        expect(whoTheGroundHandsYou([shutIn, atACounter])?.name).toBe('Duan Cishi');
    });

    it('is whoever was going to make sure of it, between two who are', () => {
        const quiet = somebody({ name: 'Liang Zhenming', playsToTheRoom: -0.5 });
        const loud = somebody({ name: 'Ji Suilu', playsToTheRoom: 0.4 });
        expect(whoTheGroundHandsYou([quiet, loud])?.name).toBe('Ji Suilu');
        expect(whoTheGroundHandsYou([loud, quiet])?.name).toBe('Ji Suilu');
    });

    it('hands you nobody when the whole hall has its back to the door', () => {
        // A real state and a common one on a house's own ground: a hall of
        // people at their own practice. You have to ask.
        const backsTurned = [
            somebody({ name: 'Mu Yanling', looksUp: false }),
            somebody({ name: 'Hou Baiyu', looksUp: false })
        ];
        expect(whoTheGroundHandsYou(backsTurned)).toBeNull();

        // And the look still says what a glance CAN see rather than nothing.
        const prose = factsForLook(standingIn('a hall', 6), AMBIENT, squareOf(backsTurned)).prose;
        expect(prose.length).toBeGreaterThan(0);
    });
});
