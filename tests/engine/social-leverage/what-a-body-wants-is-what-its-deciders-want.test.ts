/**
 * A body has no preferences of its own.
 *
 * Every assertion is on state - which tier answered, where it landed, and who
 * it turned on - and none is on prose.
 */

import {
    createObligation,
    settleObligation,
    type ObligationRecord,
    type Severity
} from '../../../src/engine/social/grudges';
import { openHandednessOf } from '../../../src/engine/social-leverage/how-freely-somebody-parts-with-what-they-have';
import {
    A_REAL_DISAGREEMENT,
    whatTheBodyWants,
    whatTheyCarryAbout,
    whoDecidesIn,
    type OnTheRoll
} from '../../../src/engine/social-leverage/what-a-body-wants-is-what-its-deciders-want';

/**
 * A six-rung ladder, which puts the elder rung at 4 and the seat at 5.
 * `elderRungOf(6)` is `ceil(5 * 2/3)` = 4, and that is not restated - the
 * fixtures below simply use rungs the engine's own answer includes.
 */
const RANKS = 6;

/** A reading fixed per id, so a test can pin the room without pinning a draw. */
function readingsFrom(table: Readonly<Record<string, number>>): (id: string) => number {
    return (id: string) => table[id] ?? 0;
}

function roll(...people: [string, number][]): OnTheRoll[] {
    return people.map(([id, rankIndex]) => ({ id, rankIndex }));
}

const ASKER = 'the-one-asking';

function favourOwedBy(who: string, severity: Severity, event?: string): ObligationRecord {
    return createObligation({
        kind: 'favor',
        // `grudges.ts`: a favour is owed TO the holder, so the asker paid.
        holderId: ASKER,
        subjectId: who,
        cause: 'saved_life',
        severity,
        onDay: 10,
        description: 'The asker paid for them once.',
        triggeringEventId: event ?? null
    });
}

function wrongHeldBy(who: string, severity: Severity, event?: string): ObligationRecord {
    return createObligation({
        kind: 'grudge',
        holderId: who,
        subjectId: ASKER,
        cause: 'robbery',
        severity,
        onDay: 10,
        description: 'The asker took something of theirs.',
        triggeringEventId: event ?? null
    });
}

// ─────────────────────────────────────────────────────────────────────────

describe('who is in the room', () => {
    it('is the elder rungs and the seat, and nobody else', () => {
        const room = whoDecidesIn({
            roll: roll(['outer', 0], ['inner', 2], ['elder', 4], ['head', 5]),
            rankCount: RANKS
        });
        expect(room.map(p => p.id).sort()).toEqual(['elder', 'head']);
        expect(room.find(p => p.id === 'head')!.holdsTheSeat).toBe(true);
        expect(room.find(p => p.id === 'elder')!.holdsTheSeat).toBe(false);
    });

    it('weighs a senior voice more, by the weight the world already shares followings with', () => {
        const room = whoDecidesIn({ roll: roll(['elder', 4], ['head', 5]), rankCount: RANKS });
        expect(room.find(p => p.id === 'elder')!.weight).toBe(25);
        expect(room.find(p => p.id === 'head')!.weight).toBe(36);
        // Heaviest voice first, deterministically.
        expect(room[0].id).toBe('head');
    });

    it('has nobody to ask when the body has no ladder', () => {
        const answer = whatTheBodyWants({ roll: roll(['somebody', 0]), rankCount: 0 });
        expect(answer.leaning).toBeNull();
        expect(answer.settledBy).toBeNull();
        expect(answer.whoMovedIt).toBeNull();
    });

    it('says nothing rather than neutral when nobody stands high enough', () => {
        const answer = whatTheBodyWants({ roll: roll(['outer', 0], ['inner', 1]), rankCount: RANKS });
        // Null and not zero: no house to ask is not a house with no opinion.
        expect(answer.leaning).toBeNull();
    });
});

describe('the player sits in the room', () => {
    it('reads an id the world has never seen exactly like any other', () => {
        const asPlayer = whatTheBodyWants({
            roll: roll(['cultivator-brand-new', 5], ['elder-a', 4]),
            rankCount: RANKS
        });
        const asAnybody = whatTheBodyWants({
            roll: roll(['npc-someone-else', 5], ['elder-a', 4]),
            rankCount: RANKS
        });
        // Different people, so different numbers - but both answered, both at
        // the same tier, and neither needed a roster.
        expect(asPlayer.leaning).not.toBeNull();
        expect(asPlayer.theRoom).toHaveLength(2);
        expect(asAnybody.theRoom).toHaveLength(2);
        expect(asPlayer.theRoom[0].baseline).toBe(
            Math.round(openHandednessOf('cultivator-brand-new') * 1e4) / 1e4
        );
    });

    it('gives the seat to whoever holds the top rung, player or not', () => {
        const answer = whatTheBodyWants({
            roll: roll(['the-player', 5], ['elder-a', 4], ['elder-b', 4]),
            rankCount: RANKS,
            readingOf: readingsFrom({ 'the-player': 0.9, 'elder-a': -0.9, 'elder-b': 0.7 })
        });
        // Not unanimous - elder-b is inside the bar - so the seat's overrule stands.
        expect(answer.settledBy).toBe('the seat');
        expect(answer.leaning).toBe(0.9);
        expect(answer.whoMovedIt!.id).toBe('the-player');
    });
});

describe('tier one - the elders', () => {
    it('is the weighted mean when nobody is far from anybody', () => {
        const answer = whatTheBodyWants({
            roll: roll(['head', 5], ['elder-a', 4], ['elder-b', 4]),
            rankCount: RANKS,
            readingOf: readingsFrom({ head: 0.2, 'elder-a': 0.1, 'elder-b': 0.0 })
        });
        expect(answer.settledBy).toBe('the elders');
        // (0.2*36 + 0.1*25 + 0*25) / 86
        expect(answer.leaning).toBeCloseTo(9.7 / 86, 4);
        expect(answer.against).toHaveLength(0);
    });

    it('names the elder pulling hardest, not merely the most senior', () => {
        const answer = whatTheBodyWants({
            roll: roll(['head', 5], ['elder-a', 4], ['elder-b', 4]),
            rankCount: RANKS,
            readingOf: readingsFrom({ head: 0.05, 'elder-a': 0.3, 'elder-b': 0.0 })
        });
        expect(answer.settledBy).toBe('the elders');
        // The head is heaviest and sits nearest the mean; elder-a moved it.
        expect(answer.whoMovedIt!.id).toBe('elder-a');
    });

    it('lets an elder dislike a thing and be outvoted', () => {
        const answer = whatTheBodyWants({
            roll: roll(['head', 5], ['elder-a', 4], ['elder-b', 4]),
            rankCount: RANKS,
            readingOf: readingsFrom({ head: 0.5, 'elder-a': 0.5, 'elder-b': -0.5 })
        });
        // elder-b is a full unit from the seat and does not stop the house.
        expect(answer.leaning!).toBeGreaterThan(0);
        expect(answer.settledBy).not.toBe('the elders, unanimous against the seat');
    });
});

describe('tier two - the seat overrules', () => {
    it('takes the head\'s own answer over the room\'s', () => {
        const answer = whatTheBodyWants({
            roll: roll(['head', 5], ['elder-a', 4], ['elder-b', 4], ['elder-c', 4]),
            rankCount: RANKS,
            readingOf: readingsFrom({
                // elder-c stands with the head, so the room is not unanimous
                // and the overrule is not taken back off them.
                head: -0.8, 'elder-a': 0.6, 'elder-b': 0.5, 'elder-c': -0.7
            })
        });
        expect(answer.settledBy).toBe('the seat');
        expect(answer.leaning).toBe(-0.8);
        expect(answer.whoMovedIt!.id).toBe('head');
    });

    it('names who was overruled, so the caller can charge it', () => {
        const answer = whatTheBodyWants({
            roll: roll(['head', 5], ['elder-a', 4], ['elder-b', 4], ['elder-c', 4]),
            rankCount: RANKS,
            readingOf: readingsFrom({
                head: -0.8, 'elder-a': 0.6, 'elder-b': 0.5, 'elder-c': -0.7
            })
        });
        expect(answer.settledBy).toBe('the seat');
        // elder-c is within the bar of the head and is not on the losing side.
        expect(answer.against.map(p => p.id).sort()).toEqual(['elder-a', 'elder-b']);
    });

    it('spends nothing itself - the losing side is reported, never priced', () => {
        const answer = whatTheBodyWants({
            roll: roll(['head', 5], ['elder-a', 4], ['elder-b', 4]),
            rankCount: RANKS,
            readingOf: readingsFrom({ head: -0.9, 'elder-a': -0.2, 'elder-b': -0.7 })
        });
        // elder-b stands with the head, so this is an overrule rather than a
        // room taking the house back - and every field of the answer is a
        // reading rather than a charge.
        expect(answer.settledBy).toBe('the seat');
        expect(Object.keys(answer)).not.toContain('standingCost');
    });

    it('does not fire when the head agrees with the room', () => {
        const answer = whatTheBodyWants({
            roll: roll(['head', 5], ['elder-a', 4], ['elder-b', 4]),
            rankCount: RANKS,
            readingOf: readingsFrom({ head: 0.3, 'elder-a': 0.35, 'elder-b': 0.25 })
        });
        expect(answer.settledBy).toBe('the elders');
    });
});

describe('tier three - all the elders, over a head who is alone', () => {
    it('takes the house back off a patriarch nobody agrees with', () => {
        const answer = whatTheBodyWants({
            roll: roll(['head', 5], ['elder-a', 4], ['elder-b', 4], ['elder-c', 4]),
            rankCount: RANKS,
            readingOf: readingsFrom({
                head: -0.9, 'elder-a': 0.6, 'elder-b': 0.5, 'elder-c': 0.4
            })
        });
        expect(answer.settledBy).toBe('the elders, unanimous against the seat');
        // The elders' own weighted mean, not the whole room's.
        expect(answer.leaning).toBeCloseTo(0.5, 4);
        expect(answer.against.map(p => p.id)).toEqual(['head']);
    });

    it('names the elder standing furthest from the seat', () => {
        const answer = whatTheBodyWants({
            roll: roll(['head', 5], ['elder-a', 4], ['elder-b', 4]),
            rankCount: RANKS,
            readingOf: readingsFrom({ head: -0.9, 'elder-a': 0.2, 'elder-b': 0.7 })
        });
        expect(answer.settledBy).toBe('the elders, unanimous against the seat');
        expect(answer.whoMovedIt!.id).toBe('elder-b');
    });

    it('needs ALL of them, not a majority', () => {
        const answer = whatTheBodyWants({
            roll: roll(['head', 5], ['elder-a', 4], ['elder-b', 4], ['elder-c', 4]),
            rankCount: RANKS,
            readingOf: readingsFrom({
                head: -0.9, 'elder-a': 0.6, 'elder-b': 0.5, 'elder-c': -0.8
            })
        });
        // Two of three would have it and the third stands with the head.
        expect(answer.settledBy).toBe('the seat');
    });

    it('needs them on the SAME side - a room split both ways agrees about nothing', () => {
        const answer = whatTheBodyWants({
            roll: roll(['head', 5], ['elder-a', 4], ['elder-b', 4]),
            rankCount: RANKS,
            readingOf: readingsFrom({ head: 0.0, 'elder-a': 0.9, 'elder-b': -0.9 })
        });
        expect(answer.settledBy).not.toBe('the elders, unanimous against the seat');
    });

    it('does not fire on a disagreement too small to have been mentioned', () => {
        const justUnder = A_REAL_DISAGREEMENT - 0.01;
        const answer = whatTheBodyWants({
            roll: roll(['head', 5], ['elder-a', 4], ['elder-b', 4]),
            rankCount: RANKS,
            readingOf: readingsFrom({ head: 0, 'elder-a': justUnder, 'elder-b': justUnder })
        });
        expect(answer.settledBy).toBe('the elders');
    });
});

describe('what has been done to them', () => {
    it('is zero for everybody when nobody has asked for anything', () => {
        const room = whoDecidesIn({ roll: roll(['head', 5], ['elder-a', 4]), rankCount: RANKS });
        expect(room.every(p => p.moved === 0)).toBe(true);
        expect(room.every(p => p.reading === p.baseline)).toBe(true);
    });

    it('moves a decider toward somebody they owe', () => {
        const before = whoDecidesIn({ roll: roll(['elder-a', 4]), rankCount: RANKS })[0];
        const after = whoDecidesIn({
            roll: roll(['elder-a', 4]),
            rankCount: RANKS,
            asking: ASKER,
            ledger: [favourOwedBy('elder-a', 'grave', 'ev-1')]
        })[0];
        expect(after.moved).toBeGreaterThan(0);
        expect(after.reading).toBeGreaterThan(before.reading);
        expect(after.whatMovedThem.favoursOwed).toBe(1);
    });

    it('moves a decider away from somebody they hold a wrong about', () => {
        const before = whoDecidesIn({ roll: roll(['elder-a', 4]), rankCount: RANKS })[0];
        const after = whoDecidesIn({
            roll: roll(['elder-a', 4]),
            rankCount: RANKS,
            asking: ASKER,
            ledger: [wrongHeldBy('elder-a', 'grave', 'ev-2')]
        })[0];
        expect(after.moved).toBeLessThan(0);
        expect(after.reading).toBeLessThan(before.reading);
        expect(after.whatMovedThem.wrongsHeld).toBe(1);
    });

    it('is one deed once, however many rows the world copied it onto', () => {
        const one = whatTheyCarryAbout({
            deciderId: 'elder-a',
            askerId: ASKER,
            ledger: [favourOwedBy('elder-a', 'grave', 'ev-3')]
        });
        const copied = whatTheyCarryAbout({
            deciderId: 'elder-a',
            askerId: ASKER,
            ledger: [
                favourOwedBy('elder-a', 'grave', 'ev-3'),
                favourOwedBy('elder-a', 'grave', 'ev-3'),
                favourOwedBy('elder-a', 'serious', 'ev-3')
            ]
        });
        // A decider with nine brothers is not nine times the favour.
        expect(copied.moved).toBe(one.moved);
        expect(copied.whatMovedThem.favoursOwed).toBe(1);
    });

    it('stops counting a record the world has settled', () => {
        const open = favourOwedBy('elder-a', 'grave', 'ev-4');
        const answered = settleObligation(open, {
            kind: 'repaid',
            onDay: 40,
            description: 'It was repaid, and the world stopped holding it.'
        });
        const after = whatTheyCarryAbout({
            deciderId: 'elder-a',
            askerId: ASKER,
            ledger: [answered]
        });
        expect(after.moved).toBe(0);
        expect(after.whatMovedThem.favoursOwed).toBe(0);
    });

    it('reads nothing off a debt, an oath or a piece of leverage', () => {
        const leverage = createObligation({
            kind: 'leverage',
            holderId: ASKER,
            subjectId: 'elder-a',
            cause: 'robbery',
            severity: 'grave',
            onDay: 10,
            description: 'Something held over them, which the resolver already prices.'
        });
        const after = whatTheyCarryAbout({
            deciderId: 'elder-a',
            askerId: ASKER,
            ledger: [leverage]
        });
        expect(after.moved).toBe(0);
    });

    it('ignores a wrong the asker holds about THEM - what moves somebody is what they carry', () => {
        const theOtherWay = createObligation({
            kind: 'grudge',
            holderId: ASKER,
            subjectId: 'elder-a',
            cause: 'robbery',
            severity: 'grave',
            onDay: 10,
            description: 'The asker holds it about the elder, not the other way round.'
        });
        expect(whatTheyCarryAbout({
            deciderId: 'elder-a',
            askerId: ASKER,
            ledger: [theOtherWay]
        }).moved).toBe(0);
    });

    it('lets a favour flip which tier answers, which is the bribery case working', () => {
        const roomRoll = roll(['head', 5], ['elder-a', 4], ['elder-b', 4]);
        const readingOf = readingsFrom({ head: -0.9, 'elder-a': -0.9, 'elder-b': -0.9 });

        const cold = whatTheBodyWants({ roll: roomRoll, rankCount: RANKS, readingOf });
        expect(cold.settledBy).toBe('the elders');
        expect(cold.leaning).toBeCloseTo(-0.9, 4);

        // The asker has done something unforgivably large for both elders and
        // nothing at all for the head. Now the room is unanimous against them.
        const warm = whatTheBodyWants({
            roll: roomRoll,
            rankCount: RANKS,
            readingOf,
            asking: ASKER,
            ledger: [
                favourOwedBy('elder-a', 'unforgivable', 'ev-5'),
                favourOwedBy('elder-b', 'unforgivable', 'ev-6')
            ]
        });
        expect(warm.settledBy).toBe('the elders, unanimous against the seat');
        expect(warm.leaning!).toBeGreaterThan(cold.leaning!);
        expect(warm.against.map(p => p.id)).toEqual(['head']);
    });

    it('holds the reading to the axis while still reporting the whole of what was put in', () => {
        const after = whoDecidesIn({
            roll: roll(['elder-a', 4]),
            rankCount: RANKS,
            asking: ASKER,
            ledger: [
                favourOwedBy('elder-a', 'unforgivable', 'ev-7'),
                favourOwedBy('elder-a', 'unforgivable', 'ev-8'),
                favourOwedBy('elder-a', 'unforgivable', 'ev-9')
            ]
        })[0];
        expect(after.reading).toBeLessThanOrEqual(1);
        // Unclamped, so a player can see that the third one bought nothing.
        expect(after.moved).toBeGreaterThan(1);
    });

    it('does not read a record incurred after the day asked about', () => {
        const late = favourOwedBy('elder-a', 'grave', 'ev-10');
        expect(whatTheyCarryAbout({
            deciderId: 'elder-a',
            askerId: ASKER,
            ledger: [late],
            asOfDay: 5
        }).moved).toBe(0);
    });
});

describe('a family and a sect are the same call', () => {
    it('answers a four-rung family exactly as it answers a six-rung sect', () => {
        // `elderRungOf(4)` is 2 and the seat is 3, so a family's seniors are
        // the same two positions a sect's elders are. Same call, same tiers,
        // no second aggregation anywhere.
        const family = whatTheBodyWants({
            roll: roll(['head', 3], ['senior', 2], ['cousin', 0]),
            rankCount: 4,
            readingOf: readingsFrom({ head: -0.9, senior: 0.6, cousin: 0.9 })
        });
        // The cousin is on the roll and does not decide anything.
        expect(family.theRoom.map(p => p.id)).toEqual(['head', 'senior']);
        expect(family.settledBy).toBe('the elders, unanimous against the seat');
        expect(family.leaning).toBeCloseTo(0.6, 4);
        expect(family.against.map(p => p.id)).toEqual(['head']);
    });
});

describe('determinism', () => {
    it('answers identically twice, and orders the room identically', () => {
        const call = () => whatTheBodyWants({
            roll: roll(['head', 5], ['elder-a', 4], ['elder-b', 4], ['elder-c', 4]),
            rankCount: RANKS,
            asking: ASKER,
            ledger: [favourOwedBy('elder-b', 'serious', 'ev-11')]
        });
        expect(JSON.stringify(call())).toBe(JSON.stringify(call()));
    });
});
