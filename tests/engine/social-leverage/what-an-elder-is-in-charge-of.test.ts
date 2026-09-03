/**
 * An elder is somebody whose climb stopped, holding a room with a bar on it.
 *
 * Every assertion is on state - which rooms are offices, who holds them, who
 * answers first, and what the house makes of somebody - and none is on prose.
 */

import { ROOM_PURPOSES, roomAuthorityOf } from '../../../src/engine/world/architecture';
import { stagnationYearsForOrdinal } from '../../../src/schema/cultivation';
import {
    READ_AS_FINISHED_AT,
    howFinishedTheyLook,
    mayDirectAtTheSameRung,
    whatTheHouseMakesOfThem,
    whatTheyHold,
    whoAnswersAbout,
    whoIsInChargeOfWhat,
    officePressureIn,
    turningThemOutOfTheirRoom,
    whoseCallItIs
} from '../../../src/engine/social-leverage/what-an-elder-is-in-charge-of';

const RANKS = ['Servant', 'Outer', 'Inner', 'Core', 'Sword Elder', 'Pavilion Master'];
const LADDER = RANKS.length;

/** A house with three sealed rooms and two people who decide. */
const ROOMS = ['forecourt', 'practice_yard', 'treasury', 'archive', 'punishment_hall'] as const;
const ROLL = [
    { id: 'head', rankIndex: 5 },
    { id: 'elder-a', rankIndex: 4 },
    { id: 'outer', rankIndex: 1 }
];

describe('a portfolio is a room with a bar on it', () => {
    it('hands out only sealed rooms', () => {
        const portfolios = whoIsInChargeOfWhat({ rooms: ROOMS, roll: ROLL, rankCount: LADDER });
        const given = portfolios.map(p => p.purpose).sort();
        expect(given).toEqual(['archive', 'punishment_hall', 'treasury']);
        // Nobody is Elder of the Forecourt.
        expect(given).not.toContain('forecourt');
        expect(given).not.toContain('practice_yard');
    });

    it('gives the deepest room to the heaviest voice', () => {
        const portfolios = whoIsInChargeOfWhat({ rooms: ROOMS, roll: ROLL, rankCount: LADDER });
        const deepest = [...portfolios].sort((a, b) => b.depth - a.depth)[0];
        expect(deepest.holderId).toBe('head');
    });

    it('lets one person hold several when there are more rooms than people', () => {
        const portfolios = whoIsInChargeOfWhat({ rooms: ROOMS, roll: ROLL, rankCount: LADDER });
        const counts = new Map<string, number>();
        for (const p of portfolios) {
            counts.set(p.holderId!, (counts.get(p.holderId!) ?? 0) + 1);
        }
        expect(Math.max(...counts.values())).toBeGreaterThan(1);
    });

    it('never gives one room two holders', () => {
        const portfolios = whoIsInChargeOfWhat({ rooms: ROOMS, roll: ROLL, rankCount: LADDER });
        const purposes = portfolios.map(p => p.purpose);
        // A room two people both have first refusal on has no first refusal.
        expect(new Set(purposes).size).toBe(purposes.length);
    });

    it('leaves a room unheld rather than inventing somebody, in a house with no deciders', () => {
        const portfolios = whoIsInChargeOfWhat({
            rooms: ROOMS, roll: [{ id: 'outer', rankIndex: 1 }], rankCount: LADDER
        });
        expect(portfolios.every(p => p.holderId === null)).toBe(true);
        expect(whoAnswersAbout(portfolios, 'treasury')).toBeNull();
    });

    it('is deterministic - the same house deals the same rooms twice', () => {
        const a = whoIsInChargeOfWhat({ rooms: ROOMS, roll: ROLL, rankCount: LADDER });
        const b = whoIsInChargeOfWhat({ rooms: ROOMS, roll: ROLL, rankCount: LADDER });
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it('agrees with the room table about which purposes are offices', () => {
        const sealed = ROOM_PURPOSES.filter(p => roomAuthorityOf(p).sealed);
        const portfolios = whoIsInChargeOfWhat({
            rooms: ROOM_PURPOSES, roll: ROLL, rankCount: LADDER
        });
        expect(portfolios.map(p => p.purpose).sort()).toEqual([...sealed].sort());
    });
});

describe('the jail is a room somebody is over', () => {
    it('is sealed, so it is an office', () => {
        expect(roomAuthorityOf('punishment_hall').sealed).toBe(true);
    });

    it('is cut to be bad ground, which is what makes holding somebody a punishment', () => {
        // The only room in the table with a negative lift. Everything else
        // leaves the ground alone or improves it.
        const lifts = ROOM_PURPOSES.map(p => ({ p, ...roomAuthorityOf(p) }));
        expect(lifts.find(l => l.p === 'punishment_hall')).toBeTruthy();
    });

    it('is not the under hall - one seals a person, the other a thing', () => {
        expect(roomAuthorityOf('under_hall').depth)
            .toBeGreaterThan(roomAuthorityOf('punishment_hall').depth);
    });
});

describe('has the climb stopped', () => {
    it('reads somebody fresh at a rung as still rising', () => {
        const read = howFinishedTheyLook({ realmOrdinal: 12, yearsHeld: 0 });
        expect(read.looksFinished).toBe(false);
        expect(read.spent).toBe(0);
    });

    it('reads somebody who has spent what the rung credits as finished', () => {
        const credited = stagnationYearsForOrdinal(12);
        const read = howFinishedTheyLook({ realmOrdinal: 12, yearsHeld: credited });
        expect(read.looksFinished).toBe(true);
        expect(read.yearsCredited).toBe(credited);
    });

    it('turns over exactly at the bar and not before', () => {
        const credited = stagnationYearsForOrdinal(12);
        const just = howFinishedTheyLook({
            realmOrdinal: 12, yearsHeld: credited * READ_AS_FINISHED_AT
        });
        const under = howFinishedTheyLook({
            realmOrdinal: 12, yearsHeld: credited * READ_AS_FINISHED_AT - 1
        });
        expect(just.looksFinished).toBe(true);
        expect(under.looksFinished).toBe(false);
    });

    it('does not cap the reading, so how far past is visible', () => {
        const credited = stagnationYearsForOrdinal(12);
        const read = howFinishedTheyLook({ realmOrdinal: 12, yearsHeld: credited * 3 });
        expect(read.spent).toBeGreaterThan(1);
    });

    it('is a belief and never a permission - nothing here returns one', () => {
        const read = howFinishedTheyLook({ realmOrdinal: 12, yearsHeld: 1_000_000 });
        // "An elder still might, out of luck." If this ever grows a field a
        // breakthrough path could read as a refusal, that is the bug.
        expect(Object.keys(read).sort())
            .toEqual(['line', 'looksFinished', 'spent', 'yearsCredited', 'yearsHeld']);
    });
});

describe('what the house makes of them', () => {
    const credited = stagnationYearsForOrdinal(20);

    it('calls a rising person at an elder rung still rising, and uses the house word', () => {
        const read = whatTheHouseMakesOfThem({
            ranks: RANKS, rankIndex: 4, realmOrdinal: 20, yearsHeld: 0
        });
        expect(read.is).toBe('still rising');
        expect(read.title).toBe('Sword Elder');
    });

    it('calls a settled person with a room in charge of something', () => {
        const read = whatTheHouseMakesOfThem({
            ranks: RANKS, rankIndex: 4, realmOrdinal: 20, yearsHeld: credited,
            holds: ['treasury']
        });
        expect(read.is).toBe('settled, and in charge of something');
        expect(read.holds).toEqual(['treasury']);
    });

    it('calls a settled person with no room carried rather than worthless', () => {
        const read = whatTheHouseMakesOfThem({
            ranks: RANKS, rankIndex: 4, realmOrdinal: 20, yearsHeld: credited
        });
        expect(read.is).toBe('settled, carried for what they are');
        // The office field is declared and empty. An absence needs a slot.
        expect(read.holds).toEqual([]);
    });

    it('gives every elder the right to take disciples, office or not', () => {
        const withRoom = whatTheHouseMakesOfThem({
            ranks: RANKS, rankIndex: 4, realmOrdinal: 20, yearsHeld: credited,
            holds: ['treasury']
        });
        const without = whatTheHouseMakesOfThem({
            ranks: RANKS, rankIndex: 4, realmOrdinal: 20, yearsHeld: credited
        });
        // Strictly worse, not a different bargain: a room is additive.
        expect(withRoom.mayTakeDisciples).toBe(true);
        expect(without.mayTakeDisciples).toBe(true);
    });
});

describe('an elder directs a conclave disciple at the same rung', () => {
    const settled = { rankIndex: 4, looksFinished: true };
    const rising = { rankIndex: 4, looksFinished: false };

    it('lets the settled one direct the rising one', () => {
        expect(mayDirectAtTheSameRung(settled, rising)).toBe(true);
    });

    it('does not let it run the other way', () => {
        expect(mayDirectAtTheSameRung(rising, settled)).toBe(false);
    });

    it('says nothing between two settled people, or two rising ones', () => {
        expect(mayDirectAtTheSameRung(settled, { ...settled })).toBe(false);
        expect(mayDirectAtTheSameRung(rising, { ...rising })).toBe(false);
    });

    it('is silent across rungs, where the ladder already answers', () => {
        expect(mayDirectAtTheSameRung(settled, { rankIndex: 1, looksFinished: false }))
            .toBe(false);
    });
});

describe('first refusal', () => {
    const portfolios = whoIsInChargeOfWhat({ rooms: ROOMS, roll: ROLL, rankCount: LADDER });

    it('asks the person whose room it is', () => {
        const holder = whoAnswersAbout(portfolios, 'punishment_hall');
        const call = whoseCallItIs({
            purpose: 'punishment_hall', portfolios, roll: ROLL, rankCount: LADDER
        });
        expect(call.holderId).toBe(holder);
        expect(call.holderId).not.toBeNull();
    });

    it('narrows the room to the holder and whoever stands above them', () => {
        const call = whoseCallItIs({
            purpose: 'punishment_hall', portfolios, roll: ROLL, rankCount: LADDER
        });
        // Never the whole house: an outer disciple has no say about the jails.
        expect(call.answer.theRoom.length).toBeLessThanOrEqual(2);
        expect(call.answer.theRoom.map(p => p.id)).not.toContain('outer');
    });

    it('keeps the head in the room, so a portfolio is not a veto', () => {
        const held = whatTheyHold(portfolios, 'elder-a');
        expect(held.length).toBeGreaterThan(0);
        const call = whoseCallItIs({
            purpose: held[0], portfolios, roll: ROLL, rankCount: LADDER
        });
        expect(call.answer.theRoom.some(p => p.isHead)).toBe(true);
    });

    it('lets the whole room answer when nobody holds the room', () => {
        const call = whoseCallItIs({
            purpose: 'forecourt', portfolios, roll: ROLL, rankCount: LADDER
        });
        expect(call.holderId).toBeNull();
        expect(call.theirCallAlone).toBe(false);
    });
});

describe('office scarcity is what makes anybody leave', () => {
    const yearsFor = (n: number) => stagnationYearsForOrdinal(20) * n;

    it('reports a queue when more people have settled than there are rooms', () => {
        const pressure = officePressureIn({
            rooms: ['treasury'],
            roll: [
                { id: 'head', rankIndex: 5 },
                { id: 'elder-a', rankIndex: 4 },
                { id: 'elder-b', rankIndex: 4 }
            ],
            rankCount: LADDER,
            yearsHeldById: { head: yearsFor(1), 'elder-a': yearsFor(1), 'elder-b': yearsFor(1) },
            realmOrdinalById: { head: 20, 'elder-a': 20, 'elder-b': 20 }
        });
        expect(pressure.offices).toBe(1);
        expect(pressure.settled).toBe(3);
        expect(pressure.waiting).toBe(2);
        expect(pressure.whoIsWaiting).toHaveLength(2);
    });

    it('counts nobody as waiting while they are still climbing', () => {
        const pressure = officePressureIn({
            rooms: ['treasury'],
            roll: [{ id: 'head', rankIndex: 5 }, { id: 'elder-a', rankIndex: 4 }],
            rankCount: LADDER,
            // Fresh at the rung: the house has not written either off.
            yearsHeldById: { head: 0, 'elder-a': 0 },
            realmOrdinalById: { head: 20, 'elder-a': 20 }
        });
        expect(pressure.settled).toBe(0);
        expect(pressure.waiting).toBe(0);
    });

    it('empties the queue when there are rooms enough to go round', () => {
        const pressure = officePressureIn({
            rooms: ['treasury', 'archive', 'punishment_hall'],
            roll: [{ id: 'head', rankIndex: 5 }, { id: 'elder-a', rankIndex: 4 }],
            rankCount: LADDER,
            yearsHeldById: { head: yearsFor(1), 'elder-a': yearsFor(1) },
            realmOrdinalById: { head: 20, 'elder-a': 20 }
        });
        expect(pressure.waiting).toBe(0);
    });

    it('is pressure and never a departure - nothing here decides anybody goes', () => {
        const pressure = officePressureIn({
            rooms: [],
            roll: [{ id: 'head', rankIndex: 5 }, { id: 'elder-a', rankIndex: 4 }],
            rankCount: LADDER,
            yearsHeldById: { head: yearsFor(9), 'elder-a': yearsFor(9) },
            realmOrdinalById: { head: 20, 'elder-a': 20 }
        });
        // Nine times what the rung credits, and no room at all: still only a
        // count and a sentence. No rate, no threshold, nobody leaving.
        expect(Object.keys(pressure).sort())
            .toEqual(['line', 'offices', 'settled', 'waiting', 'whoIsWaiting']);
    });
});

describe('a head turning an elder out of their room', () => {
    it('is available rather than blocked, and priced by leadership.ts', () => {
        const out = turningThemOutOfTheirRoom({
            personId: 'elder-a', purpose: 'treasury',
            theirFollowing: 20, houseSize: 60, alreadyDone: 0
        });
        expect(out.cost.standingCost).toBeGreaterThan(0);
        expect(out.purpose).toBe('treasury');
    });

    it('costs more for an elder with more people behind them', () => {
        const small = turningThemOutOfTheirRoom({
            personId: 'a', purpose: 'treasury',
            theirFollowing: 2, houseSize: 60, alreadyDone: 0
        });
        const large = turningThemOutOfTheirRoom({
            personId: 'b', purpose: 'treasury',
            theirFollowing: 30, houseSize: 60, alreadyDone: 0
        });
        expect(large.cost.standingCost).toBeGreaterThan(small.cost.standingCost);
    });

    it('compounds, so a head emptying the council pays more each time', () => {
        const first = turningThemOutOfTheirRoom({
            personId: 'a', purpose: 'treasury',
            theirFollowing: 10, houseSize: 60, alreadyDone: 0
        });
        const third = turningThemOutOfTheirRoom({
            personId: 'c', purpose: 'treasury',
            theirFollowing: 10, houseSize: 60, alreadyDone: 2
        });
        expect(third.cost.standingCost).toBeGreaterThan(first.cost.standingCost);
    });

    it('leaves them an elder rather than nothing', () => {
        const out = turningThemOutOfTheirRoom({
            personId: 'elder-a', purpose: 'treasury',
            theirFollowing: 5, houseSize: 40, alreadyDone: 0
        });
        // The rare, earned, strictly-worse seat, reached by being pushed.
        expect(out.theyBecome).toBe('settled, carried for what they are');
    });

    it('names who remembers it, which is what the head keeps paying', () => {
        const out = turningThemOutOfTheirRoom({
            personId: 'elder-a', purpose: 'treasury',
            theirFollowing: 5, houseSize: 40, alreadyDone: 0,
            others: ['elder-b', 'elder-a']
        });
        expect(out.whoResents).toEqual(['elder-a', 'elder-b']);
    });

    it('has no cooldown and no cap - the cost is the limiter', () => {
        const out = turningThemOutOfTheirRoom({
            personId: 'a', purpose: 'treasury',
            theirFollowing: 10, houseSize: 60, alreadyDone: 99
        });
        // Still returns a price rather than a refusal, however many times.
        expect(out.cost.standingCost).toBeGreaterThan(0);
    });
});
