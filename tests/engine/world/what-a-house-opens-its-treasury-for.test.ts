/**
 * A treasury is opened by people, not by a rule about treasuries.
 *
 * Every assertion here is on BEHAVIOUR: how often a vault opens, how much
 * leaves, and which way the answer moves when the war does. None of them pins
 * the shift table, the share constant or any other number this file could
 * change its mind about - the bands are measured over a population of real
 * houses, which is the only honest way to say "liberally", "moderately" and
 * "rarely".
 */

import { describe, expect, it } from 'vitest';
import {
    armItsOwn,
    howTheWarGoesFor,
    whatItWouldSpend,
    whetherTheVaultOpens,
    whyItLeftTheTreasury,
    type HowTheWarGoes
} from '../../../src/engine/world/what-a-house-opens-its-treasury-for';
import { whoseThisIs } from '../../../src/engine/world/a-house-holds-its-own';
import { makeObject, type ObjectRecord } from '../../../src/engine/world/possessions';
import type { OnTheRoll } from '../../../src/engine/social-leverage/what-a-body-wants-is-what-its-deciders-want';

/** Six rungs puts the elder rung at 4 and the head at 5. */
const RANKS = 6;

/** A hundred houses of real people, so a band is a rate and not an anecdote. */
const HOUSES = 100;

function aHouse(n: number): OnTheRoll[] {
    return [
        { id: `house-${n}-head`, rankIndex: 5 },
        { id: `house-${n}-elder-a`, rankIndex: 4 },
        { id: `house-${n}-elder-b`, rankIndex: 4 },
        { id: `house-${n}-elder-c`, rankIndex: 4 }
    ];
}

function howOftenItOpens(what: 'the_war' | 'a_reward' | 'arming_its_own', how: HowTheWarGoes): number {
    let opened = 0;
    for (let n = 0; n < HOUSES; n++) {
        if (whetherTheVaultOpens({ what, how, roll: aHouse(n), rankCount: RANKS }).opened) opened++;
    }
    return opened / HOUSES;
}

/** What a thousand-stone treasury actually parts with, summed over the world. */
function whatTheWorldSpends(how: HowTheWarGoes): number {
    let total = 0;
    for (let n = 0; n < HOUSES; n++) {
        const answer = whetherTheVaultOpens({
            what: 'the_war',
            how,
            roll: aHouse(n),
            rankCount: RANKS
        }).answer;
        total += whatItWouldSpend({ held: 1000, answer });
    }
    return total;
}

describe('how much of the world opens its vault for a war', () => {
    it('opens liberally when the war is being lost', () => {
        expect(howOftenItOpens('the_war', 'about_to_lose')).toBeGreaterThan(0.9);
    });

    it('opens moderately at war', () => {
        const atWar = howOftenItOpens('the_war', 'at_war');
        expect(atWar).toBeGreaterThan(0.4);
        expect(atWar).toBeLessThan(0.9);
    });

    it('opens rarely at peace', () => {
        expect(howOftenItOpens('the_war', 'at_peace')).toBeLessThan(0.15);
    });

    it('and the three are ordered, which is the whole claim', () => {
        expect(howOftenItOpens('the_war', 'about_to_lose'))
            .toBeGreaterThan(howOftenItOpens('the_war', 'at_war'));
        expect(howOftenItOpens('the_war', 'at_war'))
            .toBeGreaterThan(howOftenItOpens('the_war', 'at_peace'));
    });

    it('but peace is rare and not never, because some rooms are open-handed', () => {
        // Exemptions apply. A rule that made it impossible would be a rule
        // about treasuries again, and the point is that it is about people.
        expect(howOftenItOpens('the_war', 'at_peace')).toBeGreaterThan(0);
    });
});

describe('and how much actually leaves', () => {
    it('rises as the war goes worse, over identical treasuries', () => {
        const peace = whatTheWorldSpends('at_peace');
        const war = whatTheWorldSpends('at_war');
        const losing = whatTheWorldSpends('about_to_lose');
        expect(losing).toBeGreaterThan(war);
        expect(war).toBeGreaterThan(peace);
    });

    it('is ruinous when losing, and still not everything', () => {
        // Averaged over the world: a house about to lose parts with most of
        // what it has, and no house is left with nothing at all.
        const each = whatTheWorldSpends('about_to_lose') / HOUSES;
        expect(each).toBeGreaterThan(400);
        expect(each).toBeLessThan(750);
    });

    it('takes nothing at all from a room that refused', () => {
        const answer = whetherTheVaultOpens({
            what: 'the_war',
            how: 'at_peace',
            roll: aHouse(0),
            rankCount: RANKS,
            readingOf: () => -1
        }).answer;
        expect(whatItWouldSpend({ held: 100_000, answer })).toBe(0);
    });

    it('and nothing from a house with nobody to ask', () => {
        const answer = whetherTheVaultOpens({
            what: 'the_war',
            how: 'about_to_lose',
            roll: [],
            rankCount: RANKS
        }).answer;
        expect(answer.leaning).toBeNull();
        expect(whatItWouldSpend({ held: 100_000, answer })).toBe(0);
    });

    it('never more than the house is holding', () => {
        const answer = whetherTheVaultOpens({
            what: 'the_war',
            how: 'about_to_lose',
            roll: aHouse(1),
            rankCount: RANKS,
            readingOf: () => 1
        }).answer;
        expect(whatItWouldSpend({ held: 7, answer })).toBeLessThanOrEqual(7);
    });
});

describe('the decision belongs to the people, not to the treasury', () => {
    it('gives two different answers to the same war with two different rooms', () => {
        const shared = { what: 'the_war' as const, how: 'at_war' as const, rankCount: RANKS };
        const openHanded = whetherTheVaultOpens({
            ...shared,
            roll: aHouse(2),
            readingOf: () => 0.8
        });
        const tightFisted = whetherTheVaultOpens({
            ...shared,
            roll: aHouse(2),
            readingOf: () => -0.8
        });
        expect(openHanded.opened).toBe(true);
        expect(tightFisted.opened).toBe(false);
    });

    it('keeps a room its own character: the war moves both rooms, not one', () => {
        const mean = (how: HowTheWarGoes) => whetherTheVaultOpens({
            what: 'the_war', how, roll: aHouse(3), rankCount: RANKS, readingOf: () => -0.5
        }).answer.leaning ?? 0;
        const generous = (how: HowTheWarGoes) => whetherTheVaultOpens({
            what: 'the_war', how, roll: aHouse(3), rankCount: RANKS, readingOf: () => 0.5
        }).answer.leaning ?? 0;

        // Each room moves the same way with the war...
        expect(mean('about_to_lose')).toBeGreaterThan(mean('at_peace'));
        expect(generous('about_to_lose')).toBeGreaterThan(generous('at_peace'));
        // ...and the mean one is still meaner at every point on it.
        expect(mean('at_war')).toBeLessThan(generous('at_war'));
        expect(mean('about_to_lose')).toBeLessThan(generous('about_to_lose'));
    });

    it('names who it turned on, so a player knows which elder to work on', () => {
        const decision = whetherTheVaultOpens({
            what: 'the_war',
            how: 'at_war',
            roll: aHouse(4),
            rankCount: RANKS
        });
        expect(decision.answer.whoMovedIt).not.toBeNull();
        expect(decision.answer.theRoom.length).toBeGreaterThan(0);
    });
});

describe('a treasury is opened to reward, and it runs the other way', () => {
    it('rewards more readily at peace than while losing a war', () => {
        expect(howOftenItOpens('a_reward', 'at_peace'))
            .toBeGreaterThan(howOftenItOpens('a_reward', 'about_to_lose'));
    });

    it('and a house about to lose almost never rewards anybody', () => {
        expect(howOftenItOpens('a_reward', 'about_to_lose')).toBeLessThan(0.15);
    });

    it('which is the opposite of how it spends on the war itself', () => {
        const rewardSwing = howOftenItOpens('a_reward', 'about_to_lose')
            - howOftenItOpens('a_reward', 'at_peace');
        const warSwing = howOftenItOpens('the_war', 'about_to_lose')
            - howOftenItOpens('the_war', 'at_peace');
        expect(rewardSwing).toBeLessThan(0);
        expect(warSwing).toBeGreaterThan(0);
    });
});

describe('why it left, for the ledger', () => {
    it('is upkeep in a quiet year and the war itself in a loud one', () => {
        expect(whyItLeftTheTreasury({ what: 'the_war', how: 'at_peace' })).toBe('upkeep');
        expect(whyItLeftTheTreasury({ what: 'the_war', how: 'at_war' })).toBe('indemnity');
        expect(whyItLeftTheTreasury({ what: 'the_war', how: 'about_to_lose' })).toBe('indemnity');
    });

    it('and a reward says so however the war is going', () => {
        for (const how of ['at_peace', 'at_war', 'about_to_lose'] as const) {
            expect(whyItLeftTheTreasury({ what: 'a_reward', how })).toBe('reward');
        }
    });
});

describe('how a house reads its own war', () => {
    it('is at peace with no war on, whatever the compound looks like', () => {
        expect(howTheWarGoesFor({ atWar: false, hallsDown: 11 })).toBe('at_peace');
    });

    it('is at war until half the compound is down', () => {
        expect(howTheWarGoesFor({ atWar: true, hallsDown: 0 })).toBe('at_war');
        expect(howTheWarGoesFor({ atWar: true, hallsDown: 5, hallsInAll: 12 })).toBe('at_war');
    });

    it('and is losing once it is', () => {
        expect(howTheWarGoesFor({ atWar: true, hallsDown: 6, hallsInAll: 12 })).toBe('about_to_lose');
        expect(howTheWarGoesFor({ atWar: true, hallsDown: 12, hallsInAll: 12 })).toBe('about_to_lose');
    });
});

// ═════════════════════════════════════════════════════════════════════════
// AND THE ONE THAT IS AN EVENT
// ═════════════════════════════════════════════════════════════════════════

function aSword(id: string, power: number): ObjectRecord {
    return makeObject({
        id,
        name: `sword ${id}`,
        kind: 'artifact',
        significance: 'significant',
        power,
        ownerId: 'the-house',
        ownerName: 'The House'
    });
}

const TAKERS = [
    { id: 'disciple-strong', name: 'Strong', ordinal: 20 },
    { id: 'disciple-middling', name: 'Middling', ordinal: 12 },
    { id: 'disciple-weak', name: 'Weak', ordinal: 4 }
];

function arming(how: HowTheWarGoes, holds: ObjectRecord[] = [aSword('a', 30), aSword('b', 10)]) {
    return armItsOwn({
        how,
        roll: aHouse(5),
        rankCount: RANKS,
        holds,
        takers: TAKERS,
        houseName: 'The House',
        onDay: 400,
        readingOf: () => 0.2
    });
}

describe('a house arming its own', () => {
    it('is the coldest thing to ask for in a quiet year', () => {
        expect(howOftenItOpens('arming_its_own', 'at_peace'))
            .toBeLessThan(howOftenItOpens('the_war', 'at_peace'));
        // The house's tracked swords stay in the vault in a quiet year.
        expect(arming('at_peace').lent).toEqual([]);
    });

    it('and something a house losing will do', () => {
        expect(howOftenItOpens('arming_its_own', 'about_to_lose')).toBeGreaterThan(0.9);
        expect(arming('about_to_lose').opened).toBe(true);
    });

    it('hands out weapons rather than moving stones', () => {
        const armed = arming('about_to_lose');
        expect(armed.lent.length).toBe(2);
        expect(armed.objects.length).toBe(2);
    });

    it('puts the best sword in the strongest hand', () => {
        const armed = arming('about_to_lose');
        expect(armed.lent[0]?.toId).toBe('disciple-strong');
        expect(armed.lent[1]?.toId).toBe('disciple-middling');
    });

    it('LENDS them, so the house can call every one back in', () => {
        const armed = arming('about_to_lose');
        const houses = new Set(['the-house']);
        for (const moved of armed.objects) {
            expect(moved.ownerId).toBe('the-house');
            expect(whoseThisIs({
                ownerId: moved.ownerId,
                possessorId: moved.possessorId,
                houseIds: houses,
                provenance: moved.provenance
            })).toBe('lent_by_their_house');
        }
    });

    it('empties the iron rack too, because a rubber stamp is still a yes', () => {
        // The counted rack goes out on the armoury officer's say-so and the
        // tracked sword goes to the body. Both are asked; both can say yes.
        const armed = arming('about_to_lose', [
            aSword('tracked', 20),
            makeObject({
                id: 'iron',
                name: 'iron sword',
                kind: 'artifact',
                significance: 'mundane',
                power: 40,
                ownerId: 'the-house',
                ownerName: 'The House'
            })
        ]);
        expect(armed.lent.map(l => l.objectId).sort()).toEqual(['iron', 'tracked']);
    });

    it('and the tracked sword is the one a refusing room stops', () => {
        // The counted one is a rubber stamp and survives a room that will not
        // agree; the tracked one needs the body and does not. That is the
        // counted/tracked line doing its own work, not a rule about wars.
        const armed = armItsOwn({
            how: 'at_peace',
            roll: aHouse(6),
            rankCount: RANKS,
            holds: [
                aSword('tracked', 20),
                makeObject({
                    id: 'iron',
                    name: 'iron sword',
                    kind: 'artifact',
                    significance: 'mundane',
                    power: 40,
                    ownerId: 'the-house',
                    ownerName: 'The House'
                })
            ],
            takers: TAKERS,
            houseName: 'The House',
            onDay: 400,
            readingOf: () => -0.1
        });
        expect(armed.lent.map(l => l.objectId)).toEqual(['iron']);
    });

    it('does not hand out what somebody already has out', () => {
        const alreadyOut = aSword('lent-already', 50);
        const armed = arming('about_to_lose', [alreadyOut, aSword('spare', 10)]);
        expect(armed.lent.map(l => l.objectId)).toEqual(['lent-already', 'spare']);

        const held = { ...alreadyOut, possessorId: 'somebody-else' };
        const second = arming('about_to_lose', [held, aSword('spare', 10)]);
        expect(second.lent.map(l => l.objectId)).toEqual(['spare']);
    });

    it('hands out nothing when the room says no', () => {
        const refused = arming('at_peace');
        expect(refused.lent).toEqual([]);
        expect(refused.objects).toEqual([]);
    });

    it('and nothing when the vault is empty, without pretending it refused', () => {
        // Nobody was asked, so there is no answer - which is a different state
        // from a room that said no, and the caller can tell them apart.
        const empty = arming('about_to_lose', []);
        expect(empty.lent).toEqual([]);
        expect(empty.answer).toBeNull();

        const refused = arming('at_peace');
        expect(refused.lent).toEqual([]);
        expect(refused.answer).not.toBeNull();
    });
});
