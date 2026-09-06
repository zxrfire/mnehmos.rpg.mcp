/**
 * Somebody makes you a thing because of what you are to them, what you have
 * done for them, and what you put down - not because of a rule about crafting.
 *
 * Every assertion is a RATE over a population of real people, or an ORDERING
 * between two such rates. None of them pins the tie span, the price of a grade,
 * the fold floor or the rung a grade is made at: those are read out of the
 * engine where a test needs one, because any name or figure the game prints is
 * one the game must go on printing.
 */

import { describe, expect, it } from 'vitest';
import {
    askingSomebodyToMakeYouSomething,
    howBeingAskedToMakeItReads,
    howMuchOfTheirReachItAsksFor,
    whatACommissionComesTo,
    whetherTheirHandsCanDoIt,
    type WhatYouAskedThemToMake
} from '../../../src/engine/social-leverage/commissioning-a-craft';
import { whatTheBodyWants, type OnTheRoll } from '../../../src/engine/social-leverage/what-a-body-wants-is-what-its-deciders-want';
import { createFavor, createGrudge, createObligation, type ObligationRecord } from '../../../src/engine/social/grudges';
import type { Nearness } from '../../../src/engine/social/how-near-you-stand-to-somebody';
import { MAX_ORDINAL } from '../../../src/engine/cultivation/realms';
import {
    refiningOrdinalFor,
    refiningRealmNameFor
} from '../../../src/engine/cultivation/who-can-refine-a-grade-of-medicine';
import type { TechniqueGrade } from '../../../src/schema/cultivation';

/** Enough people that a rate is a rate. */
const PEOPLE = 400;

const GRADES: readonly TechniqueGrade[] = ['mortal', 'earth', 'heaven', 'immortal', 'chaos'];

const NEAREST_FIRST: readonly Nearness[] = [
    'household', 'house', 'tied', 'acquainted', 'nearby', 'distant'
];

interface Case {
    grade?: TechniqueGrade;
    slip?: 'a_strike' | 'a_way_out';
    ordinal?: number;
    nearness?: Nearness;
    stones?: number;
    onTheTable?: readonly { what: string; carriesThemTo: number; singular: boolean }[];
    ledgerFor?: (askerId: string, makerId: string) => ObligationRecord[];
}

function askOnce(n: number, c: Case) {
    const makerId = `maker-${n}`;
    const askerId = `asker-${n}`;
    const ask: WhatYouAskedThemToMake = {
        named: 'the thing',
        grade: c.grade ?? 'mortal',
        ...(c.slip === undefined ? {} : { slip: c.slip })
    };
    return askingSomebodyToMakeYouSomething({
        ask,
        askerId,
        maker: { id: makerId, ordinal: c.ordinal ?? 20 },
        nearness: c.nearness ?? 'distant',
        stonesOffered: c.stones ?? 0,
        onTheTable: c.onTheTable ?? [],
        ledger: c.ledgerFor ? c.ledgerFor(askerId, makerId) : [],
        onDay: 1000
    });
}

/** How much of the world agrees to this. */
function howOften(c: Case): number {
    let yes = 0;
    for (let n = 0; n < PEOPLE; n++) if (askOnce(n, c).agreed) yes++;
    return yes / PEOPLE;
}

// ═════════════════════════════════════════════════════════════════════════
// CAN THEY
// ═════════════════════════════════════════════════════════════════════════

describe('whether their hands can do it at all', () => {
    it('refuses a grade the hand cannot work, and names the realm that could', () => {
        const grade: TechniqueGrade = 'heaven';
        const tooLow = refiningOrdinalFor(grade) - 1;
        const said = whetherTheirHandsCanDoIt({ named: 'a slip', grade }, tooLow);
        expect(said.theyCan).toBe(false);
        // The realm is read out of the engine rather than typed in here: a
        // ladder rename must not fail a test about commissioning.
        expect(said.why).toContain(refiningRealmNameFor(grade));
    });

    it('and names what those hands could make instead, so the refusal has a route', () => {
        const said = whetherTheirHandsCanDoIt({ named: 'a slip', grade: 'heaven' }, 0);
        expect(said.theyCan).toBe(false);
        expect(said.insteadTheyCouldMake).not.toBeNull();
        // Whatever it is, they really can make it.
        expect(
            whetherTheirHandsCanDoIt(
                { named: 'a slip', grade: said.insteadTheyCouldMake as TechniqueGrade },
                0
            ).theyCan
        ).toBe(true);
    });

    it('opens each grade at exactly one rung and never closes it again', () => {
        for (const grade of GRADES) {
            const open = [];
            for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal++) {
                open.push(whetherTheirHandsCanDoIt({ named: 'x', grade }, ordinal).theyCan);
            }
            const first = open.indexOf(true);
            expect(first).toBeGreaterThanOrEqual(0);
            expect(open.slice(first).every(Boolean)).toBe(true);
        }
    });

    it('will not fold a road into paper for somebody who cannot walk it', () => {
        // Both gates read off the ladder, so the claim is the ORDERING: there
        // are hands that can cut a strike slip and cannot cut a way out, and
        // never the reverse.
        let strikeOnly = 0;
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal++) {
            const strike = whetherTheirHandsCanDoIt(
                { named: 'x', grade: 'mortal', slip: 'a_strike' }, ordinal).theyCan;
            const wayOut = whetherTheirHandsCanDoIt(
                { named: 'x', grade: 'mortal', slip: 'a_way_out' }, ordinal).theyCan;
            expect(wayOut && !strike).toBe(false);
            if (strike && !wayOut) strikeOnly++;
        }
        expect(strikeOnly).toBeGreaterThan(0);
    });

    it('and a refused pair of hands is asked for nothing and owes nothing', () => {
        const said = askOnce(0, { grade: 'heaven', ordinal: 0, nearness: 'household', stones: 10_000 });
        expect(said.agreed).toBe(false);
        expect(said.owed).toBeNull();
        expect(said.reading).toBeNull();
    });
});

// ═════════════════════════════════════════════════════════════════════════
// WILL THEY
// ═════════════════════════════════════════════════════════════════════════

describe('who is asking is most of the answer', () => {
    it('is warmer at every step from a stranger to somebody under the same roof', () => {
        const rates = NEAREST_FIRST.map(nearness => howOften({ nearness }));
        for (let i = 1; i < rates.length; i++) {
            expect(rates[i - 1]).toBeGreaterThan(rates[i]);
        }
    });

    it('so a master cuts their own disciple a roadside slip more often than not', () => {
        expect(howOften({ nearness: 'household' })).toBeGreaterThan(0.6);
    });

    it('and a stranger asking for free work is refused, with the route named', () => {
        expect(howOften({ nearness: 'distant' })).toBeLessThan(0.05);
        const said = askOnce(0, { nearness: 'distant' });
        expect(said.agreed).toBe(false);
        expect(said.line).toMatch(/spirit stones|favour|singular/i);
    });
});

describe('the ledger moves them, and it is the ledger everything else reads', () => {
    const favour = (askerId: string, makerId: string) => [createFavor({
        holderId: askerId,
        subjectId: makerId,
        cause: 'saved_life',
        severity: 'grave',
        onDay: 10,
        description: 'pulled them out of the water'
    })];
    const grudge = (askerId: string, makerId: string) => [createGrudge({
        holderId: makerId,
        subjectId: askerId,
        cause: 'other',
        severity: 'grave',
        onDay: 10,
        description: 'what happened at the ford'
    })];

    it('a favour owed moves them towards yes over identical people', () => {
        expect(howOften({ nearness: 'tied', ledgerFor: favour }))
            .toBeGreaterThan(howOften({ nearness: 'tied' }));
    });

    it('and a grudge held moves them the other way', () => {
        expect(howOften({ nearness: 'household', ledgerFor: grudge }))
            .toBeLessThan(howOften({ nearness: 'household' }));
    });

    it('a settled record moves nobody, because the account is closed', () => {
        const settled = (askerId: string, makerId: string) => [{
            ...createObligation({
                kind: 'favor',
                holderId: askerId,
                subjectId: makerId,
                cause: 'saved_life',
                severity: 'grave',
                onDay: 10,
                description: 'settled long ago'
            }),
            status: 'settled' as const
        }];
        expect(howOften({ nearness: 'tied', ledgerFor: settled }))
            .toBe(howOften({ nearness: 'tied' }));
    });

    it('and it reports which way it was moved, so a player knows what to work on', () => {
        const said = askOnce(3, { nearness: 'tied', ledgerFor: favour });
        expect(said.whatMovedThem.favoursOwed).toBe(1);
        expect(said.whatMovedThem.wrongsHeld).toBe(0);
        expect(said.whatMovedThem.heaviest).not.toBeNull();
    });
});

describe('how much of what they can do it asks for', () => {
    it('is heaviest for the hand that can only just make it and lightest at the top', () => {
        for (const grade of GRADES) {
            const gate = refiningOrdinalFor(grade);
            const atTheGate = howMuchOfTheirReachItAsksFor(grade, gate);
            const wellAbove = howMuchOfTheirReachItAsksFor(grade, MAX_ORDINAL);
            expect(atTheGate).toBeGreaterThanOrEqual(wellAbove);
            expect(atTheGate).toBeLessThanOrEqual(1);
            expect(wellAbove).toBeGreaterThanOrEqual(0);
        }
    });

    it('so the same house asked for its best work answers colder than for routine work', () => {
        // One grade, two makers: the one who can only just do it is being asked
        // for their whole reach, and the one far above it for an afternoon.
        const gate = refiningOrdinalFor('earth');
        const atTheGate = howOften({ grade: 'earth', ordinal: gate, nearness: 'household' });
        const wellAbove = howOften({ grade: 'earth', ordinal: MAX_ORDINAL, nearness: 'household' });
        expect(wellAbove).toBeGreaterThan(atTheGate);
    });

    it('and one maker asked for a deeper grade answers colder than for a shallow one', () => {
        const ordinal = refiningOrdinalFor('earth');
        expect(howOften({ grade: 'mortal', ordinal, nearness: 'household' }))
            .toBeGreaterThan(howOften({ grade: 'earth', ordinal, nearness: 'household' }));
    });
});

describe('the answer belongs to the person, not to the craft', () => {
    it('gives two different answers to the same commission from two dispositions', () => {
        const shared = {
            ask: { named: 'a slip', grade: 'mortal' as TechniqueGrade },
            askerId: 'asker',
            maker: { id: 'maker', ordinal: 20 },
            nearness: 'house' as Nearness,
            onDay: 100
        };
        expect(askingSomebodyToMakeYouSomething({ ...shared, readingOf: () => 1 }).agreed).toBe(true);
        expect(askingSomebodyToMakeYouSomething({ ...shared, readingOf: () => -1 }).agreed).toBe(false);
    });

    it('and keeps each person their own character as the ask changes', () => {
        const at = (readingOf: () => number, nearness: Nearness) => askingSomebodyToMakeYouSomething({
            ask: { named: 'a slip', grade: 'mortal' },
            askerId: 'asker',
            maker: { id: 'maker', ordinal: 20 },
            nearness,
            readingOf,
            onDay: 100
        }).reading ?? 0;
        const mean = () => -0.5;
        const openHanded = () => 0.5;
        expect(at(mean, 'household')).toBeGreaterThan(at(mean, 'distant'));
        expect(at(openHanded, 'household')).toBeGreaterThan(at(openHanded, 'distant'));
        expect(at(mean, 'household')).toBeLessThan(at(openHanded, 'household'));
    });
});

// ═════════════════════════════════════════════════════════════════════════
// WHAT IT COSTS
// ═════════════════════════════════════════════════════════════════════════

describe('paying for it', () => {
    it('the grades that carry a price are exactly the grades stones can move', () => {
        for (const grade of GRADES) {
            const price = whatACommissionComesTo(grade);
            const gate = refiningOrdinalFor(grade);
            if (gate > MAX_ORDINAL) continue;
            const nothing = howOften({ grade, ordinal: MAX_ORDINAL, nearness: 'nearby' });
            const aFortune = howOften({
                grade, ordinal: MAX_ORDINAL, nearness: 'nearby', stones: 1_000_000
            });
            if (price === null) {
                // "Not 'expensive' - not for sale." A purse of any size is the
                // same offer as an empty hand.
                expect(aFortune).toBe(nothing);
            } else {
                expect(aFortune).toBeGreaterThan(nothing);
            }
        }
    });

    it('rises with what is put down and stops rising once the price is met', () => {
        const price = whatACommissionComesTo('mortal') as number;
        const rates = [0, 0.25, 0.5, 0.75, 1]
            .map(share => howOften({ nearness: 'distant', stones: Math.round(price * share) }));
        for (let i = 1; i < rates.length; i++) {
            expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1] as number);
        }
        expect(rates[rates.length - 1] as number).toBeGreaterThan(rates[0] as number);
        // Nothing is bought twice: doubling a met price buys nothing more.
        expect(howOften({ nearness: 'distant', stones: price * 4 }))
            .toBe(howOften({ nearness: 'distant', stones: price }));
    });

    it('and a stranger who pays what it is worth is usually taken up on it', () => {
        const price = whatACommissionComesTo('mortal') as number;
        expect(howOften({ nearness: 'distant', stones: price })).toBeGreaterThan(0.5);
    });

    it('but paying does not buy somebody who has a real reason to refuse', () => {
        const price = whatACommissionComesTo('mortal') as number;
        const said = askingSomebodyToMakeYouSomething({
            ask: { named: 'a slip', grade: 'mortal' },
            askerId: 'asker',
            maker: { id: 'maker', ordinal: 20 },
            nearness: 'distant',
            stonesOffered: price * 100,
            readingOf: () => -1,
            onDay: 100
        });
        expect(said.paid).toBe(1);
        expect(said.agreed).toBe(false);
    });
});

describe('above the cash line the medium is a thing, not a purse', () => {
    const above: TechniqueGrade = 'heaven';
    const ordinal = refiningOrdinalFor(above);

    it('quotes no figure at all for it', () => {
        expect(whatACommissionComesTo(above)).toBeNull();
    });

    it('and something singular that reaches high enough moves them where money did not', () => {
        const bar = askOnce(0, { grade: above, ordinal, nearness: 'nearby' })
            .theTable?.theHeightToReach as number;
        const reaching = howOften({
            grade: above,
            ordinal,
            nearness: 'nearby',
            onTheTable: [{ what: 'a sealed blade', carriesThemTo: bar + 2, singular: true }]
        });
        const short = howOften({
            grade: above,
            ordinal,
            nearness: 'nearby',
            onTheTable: [{ what: 'a village sword', carriesThemTo: 0, singular: true }]
        });
        expect(reaching).toBeGreaterThan(short);
        expect(reaching).toBeGreaterThan(
            howOften({ grade: above, ordinal, nearness: 'nearby', stones: 1_000_000 })
        );
    });

    it('and a heap of fungible things is not singular and buys nothing', () => {
        expect(howOften({
            grade: above,
            ordinal,
            nearness: 'nearby',
            onTheTable: [{ what: 'a cart of ore', carriesThemTo: 99, singular: false }]
        })).toBe(howOften({ grade: above, ordinal, nearness: 'nearby' }));
    });

    it('and the refusal says what would reach, rather than quoting a figure', () => {
        const said = askOnce(1, { grade: above, ordinal, nearness: 'distant', stones: 10_000 });
        expect(said.agreed).toBe(false);
        expect(said.line).not.toMatch(/spirit stones/i);
        expect(said.line).toMatch(/singular|carries/i);
    });
});

// ═════════════════════════════════════════════════════════════════════════
// AND THE FAVOUR ROUTE, WHICH IS THE LEDGER AND NOT A FIELD
// ═════════════════════════════════════════════════════════════════════════

describe('work done for nothing is a debt', () => {
    function firstAgreement(c: Case) {
        for (let n = 0; n < PEOPLE; n++) {
            const said = askOnce(n, c);
            if (said.agreed) return said;
        }
        throw new Error('nobody agreed');
    }

    it('opens a row against the person who asked, held by the person who made it', () => {
        const said = firstAgreement({ nearness: 'household' });
        expect(said.owed).not.toBeNull();
        expect(said.owed?.kind).toBe('favor');
        expect(said.owed?.subjectId).toMatch(/^asker-/);
        expect(said.owed?.holderId).toMatch(/^maker-/);
    });

    it('and opens none where it was paid for', () => {
        const price = whatACommissionComesTo('mortal') as number;
        expect(firstAgreement({ nearness: 'household', stones: price }).owed).toBeNull();
    });

    it('a deeper grade leaves a heavier debt', () => {
        const shallow = firstAgreement({ nearness: 'household', grade: 'mortal' });
        const deep = firstAgreement({
            nearness: 'household', grade: 'earth', ordinal: MAX_ORDINAL
        });
        expect(shallow.owed?.severity).not.toBe(deep.owed?.severity);
    });

    it('and the row is one the NEXT ask reads, in the other direction', () => {
        // The whole of the favour route: nothing was added to a record and no
        // field was invented. The maker who worked for nothing is owed, and the
        // engine finds that out by reading the same ledger back the other way.
        const said = firstAgreement({ nearness: 'household' });
        const row = createObligation(said.owed!);
        const [askerId, makerId] = [row.subjectId as string, row.holderId];

        const cold = askingSomebodyToMakeYouSomething({
            ask: { named: 'a slip', grade: 'mortal' },
            askerId: makerId,
            maker: { id: askerId, ordinal: 20 },
            nearness: 'tied',
            onDay: 2000
        });
        const owed = askingSomebodyToMakeYouSomething({
            ask: { named: 'a slip', grade: 'mortal' },
            askerId: makerId,
            maker: { id: askerId, ordinal: 20 },
            nearness: 'tied',
            ledger: [row],
            onDay: 2000
        });
        expect(owed.reading as number).toBeGreaterThan(cold.reading as number);
        expect(owed.whatMovedThem.favoursOwed).toBe(1);
    });
});

// ═════════════════════════════════════════════════════════════════════════
// AND WHEN THE HANDS BELONG TO A HOUSE
// ═════════════════════════════════════════════════════════════════════════

describe('a commission put to a house runs through the room that already decides', () => {
    const RANKS = 6;
    const aHouse = (n: number): OnTheRoll[] => [
        { id: `house-${n}-head`, rankIndex: 5 },
        { id: `house-${n}-elder-a`, rankIndex: 4 },
        { id: `house-${n}-elder-b`, rankIndex: 4 },
        { id: `house-${n}-elder-c`, rankIndex: 4 }
    ];

    function howOftenTheHouseAgrees(input: {
        grade: TechniqueGrade;
        ordinal: number;
        nearness: Nearness;
        paid?: number;
    }): number {
        let yes = 0;
        for (let n = 0; n < 200; n++) {
            const answer = whatTheBodyWants({
                roll: aHouse(n),
                rankCount: RANKS,
                asking: `asker-${n}`,
                readingOf: howBeingAskedToMakeItReads({
                    ask: { named: 'a slip', grade: input.grade },
                    makerOrdinal: input.ordinal,
                    nearnessOf: () => input.nearness,
                    ...(input.paid === undefined ? {} : { paid: input.paid })
                })
            });
            if ((answer.leaning ?? 0) > 0) yes++;
        }
        return yes / 200;
    }

    it('answers, and names who in the room it turned on', () => {
        const answer = whatTheBodyWants({
            roll: aHouse(1),
            rankCount: RANKS,
            readingOf: howBeingAskedToMakeItReads({
                ask: { named: 'a slip', grade: 'mortal' },
                makerOrdinal: 20,
                nearnessOf: () => 'house'
            })
        });
        expect(answer.leaning).not.toBeNull();
        expect(answer.whoMovedIt).not.toBeNull();
        expect(answer.theRoom.length).toBeGreaterThan(0);
    });

    it('is warmer to its own than to a stranger, through the same room', () => {
        expect(howOftenTheHouseAgrees({ grade: 'mortal', ordinal: 20, nearness: 'house' }))
            .toBeGreaterThan(
                howOftenTheHouseAgrees({ grade: 'mortal', ordinal: 20, nearness: 'distant' })
            );
    });

    it('and colder when what is asked for is most of what its hands can do', () => {
        const gate = refiningOrdinalFor('earth');
        expect(howOftenTheHouseAgrees({ grade: 'earth', ordinal: MAX_ORDINAL, nearness: 'house' }))
            .toBeGreaterThan(
                howOftenTheHouseAgrees({ grade: 'earth', ordinal: gate, nearness: 'house' })
            );
    });

    it('and a paid commission moves the room the way a paid one moves a person', () => {
        expect(howOftenTheHouseAgrees({
            grade: 'mortal', ordinal: 20, nearness: 'distant', paid: 1
        })).toBeGreaterThan(
            howOftenTheHouseAgrees({ grade: 'mortal', ordinal: 20, nearness: 'distant' })
        );
    });
});
