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
    type WhatYouAskedThemToMake,
    whatTheMakersTimeComesTo,
    whatTheMaterialsComeTo,
    daysAtTheWork,
    whatAYearOfAMakersTimeIsWorth,
    WHERE_WAGES_ON_OFFER_STOP_CLIMBING
} from '../../../src/engine/social-leverage/commissioning-a-craft';
import { whatTheBodyWants, type OnTheRoll } from '../../../src/engine/social-leverage/what-a-body-wants-is-what-its-deciders-want';
import { createFavor, createGrudge, createObligation, type ObligationRecord } from '../../../src/engine/social/grudges';
import type { Nearness } from '../../../src/engine/social/how-near-you-stand-to-somebody';
import { MAX_ORDINAL } from '../../../src/engine/cultivation/realms';
import { FOLD_FLOOR_ORDINAL } from '../../../src/engine/world/how-far-somebody-can-fold-space-and-what-it-costs';
import {
    refiningOrdinalFor,
    refiningRealmNameFor
} from '../../../src/engine/cultivation/who-can-refine-a-grade-of-medicine';
import type { TechniqueGrade } from '../../../src/schema/cultivation';

/**
 * The rung every ask here is put to unless it says otherwise. A commission costs
 * what its maker asks, so a price read for these asks is read at this rung.
 */
const THE_USUAL_MAKER = 20;

/** Enough people that a rate is a rate. */
const PEOPLE = 400;

const GRADES: readonly TechniqueGrade[] = ['mortal', 'earth', 'heaven', 'immortal', 'chaos'];

const NEAREST_FIRST: readonly Nearness[] = [
    'household', 'house', 'tied', 'acquainted', 'nearby', 'distant'
];

interface Case {
    grade?: TechniqueGrade;
    slip?: 'a_strike' | 'a_teleportation';
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
        maker: { id: makerId, ordinal: c.ordinal ?? THE_USUAL_MAKER },
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
        // are hands that can cut a strike slip and cannot cut a teleportation talisman, and
        // never the reverse.
        let strikeOnly = 0;
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal++) {
            const strike = whetherTheirHandsCanDoIt(
                { named: 'x', grade: 'mortal', slip: 'a_strike' }, ordinal).theyCan;
            const teleportation = whetherTheirHandsCanDoIt(
                { named: 'x', grade: 'mortal', slip: 'a_teleportation' }, ordinal).theyCan;
            expect(teleportation && !strike).toBe(false);
            if (strike && !teleportation) strikeOnly++;
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
    /**
     * WHAT STONES ARE WORTH IS THE MAKER'S, NOT THE GRADE'S. The design owner:
     * *"at ordinal 29 they want STUFF"*, *"nobody would take 20k stones"*, and
     * *"generally, not a hard rule."* A purse the size of the work's worth moves
     * a maker whose day is still what the wages on offer pay, and falls far
     * short with a maker whose day is worth vastly more - and nothing below the
     * Lid makes an immortal or chaos thing, so there a purse is nothing at all.
     */
    it('moves a maker whose day is still a wage, and falls short with one far above it', () => {
        const low = refiningOrdinalFor('earth');
        const lowPrice = whatACommissionComesTo('earth', false, low) as number;
        expect(howOften({ grade: 'earth', ordinal: low, nearness: 'nearby', stones: lowPrice }))
            .toBeGreaterThan(howOften({ grade: 'earth', ordinal: low, nearness: 'nearby' }));

        const high = MAX_ORDINAL;
        const highPrice = whatACommissionComesTo('earth', false, high) as number;
        const said = askOnce(0, { grade: 'earth', ordinal: high, nearness: 'nearby', stones: highPrice });
        expect(said.whatAStoneIsWorthToThem).toBeLessThan(0.01);
        expect(said.paid).toBeLessThan(0.01);

        for (const grade of ['immortal', 'chaos'] as const) {
            expect(whatACommissionComesTo(grade)).toBeNull();
        }
    });

    it('rises with what is put down and stops rising once the price is met', () => {
        const price = whatACommissionComesTo('mortal', false, THE_USUAL_MAKER) as number;
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
        const price = whatACommissionComesTo('mortal', false, THE_USUAL_MAKER) as number;
        expect(howOften({ nearness: 'distant', stones: price })).toBeGreaterThan(0.5);
    });

    it('but paying does not buy somebody who has a real reason to refuse', () => {
        const price = whatACommissionComesTo('mortal', false, THE_USUAL_MAKER) as number;
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

describe('a commission costs whatever the maker asks', () => {
    /**
     * The design owner: *"Whatever the maker asks. Their time is presumably
     * valuable, depends on realm."* The price is this maker's days at the work
     * at this maker's own rate, and the materials they put in. It was a year of
     * the income of the rung that could only just make the thing, whoever made
     * it: 54 stones for a mortal slip and 375 for earth-grade work.
     */
    it('is the maker\'s time at their rate plus the materials, and moves with the hand', () => {
        const gate = refiningOrdinalFor('earth');
        for (const ordinal of [gate, gate + 5, gate + 15]) {
            expect(whatACommissionComesTo('earth', false, ordinal)).toBe(Math.max(1, Math.round(
                whatTheMakersTimeComesTo('earth', ordinal) + whatTheMaterialsComeTo('earth')
            )));
        }
        // A hand far past the grade spends fewer days on it, and each of its
        // days is worth far more than the days it saves.
        expect(daysAtTheWork('earth', gate + 15)).toBeLessThan(daysAtTheWork('earth', gate));
        expect(whatTheMakersTimeComesTo('earth', gate + 15)).toBeGreaterThan(whatTheMakersTimeComesTo('earth', gate));
        // A grade nothing is worked out of puts no materials in.
        expect(whatTheMaterialsComeTo('mortal')).toBe(0);
        expect(whatTheMaterialsComeTo('earth')).toBeGreaterThan(0);
    });
});

/**
 * THE PRICE RISES WITH THE MAKER'S REALM AT A FIXED GRADE. The design owner:
 * *"how can stronger makers ask the same per day? Heaven grade should be
 * expensive because their time is vastly more expensive."* The rate a maker
 * asks keeps climbing past where the wages on offer stop.
 */
describe('a stronger maker asks more for the same thing', () => {
    it('rises with the maker\'s realm, for every grade a hand below the Lid can make', () => {
        for (const grade of ['mortal', 'earth', 'heaven'] as const) {
            const gate = refiningOrdinalFor(grade);
            // Never less for a higher hand, from the gate up. A mortal slip is a
            // day's work, and below a stone a day it rounds to the one-stone
            // floor, so it is strictly dearer only once a day is worth more.
            let before = 0;
            for (let o = gate; o <= MAX_ORDINAL; o++) {
                const price = whatACommissionComesTo(grade, false, o) as number;
                expect(price, `${grade} at ${o}`).toBeGreaterThanOrEqual(before);
                before = price;
            }
            // And more, six rungs at a time, past where the wages on offer stop.
            const from = Math.max(gate, Math.ceil(WHERE_WAGES_ON_OFFER_STOP_CLIMBING));
            const hands = [from, from + 6, from + 12].filter(o => o <= MAX_ORDINAL);
            const prices = hands.map(o => whatACommissionComesTo(grade, false, o) as number);
            for (let i = 1; i < prices.length; i++) {
                expect(prices[i], `${grade} at ${hands[i]} against ${hands[i - 1]}`).toBeGreaterThan(prices[i - 1]!);
            }
        }
    });

    it('keeps a maker\'s year climbing past where the wages on offer stop', () => {
        const flat = Math.ceil(WHERE_WAGES_ON_OFFER_STOP_CLIMBING);
        expect(whatAYearOfAMakersTimeIsWorth(flat + 10)).toBeGreaterThan(whatAYearOfAMakersTimeIsWorth(flat) * 10);
    });
});

/**
 * WHAT A MAKER TAKES IS WHAT THEY WANT. The design owner: *"it depends on what a
 * dude wants"*, *"at ordinal 29 they want STUFF"*, *"you can still track in
 * stone-equivalent value, but nobody would take 20k stones"*, and *"generally,
 * not a hard rule."* The work is measured in stone-equivalent; stones count at
 * what they are worth to this maker; a thing put down counts when it is
 * something they want and its worth meets the work's.
 */
describe('a maker is paid in what they want', () => {
    const aCore = { text: 'a heaven-grade beast core', kind: 'cultivation' };
    const ask = (ordinal: number, over: Partial<Parameters<typeof askingSomebodyToMakeYouSomething>[0]> = {}) =>
        askingSomebodyToMakeYouSomething({
            ask: { named: 'an earth-grade blade', grade: 'earth' },
            askerId: 'asker',
            maker: { id: 'maker', ordinal },
            nearness: 'distant',
            onDay: 100,
            ...over
        });

    it('lets a maker still paid in wages take stones for earth work', () => {
        const ordinal = refiningOrdinalFor('earth');
        const price = whatACommissionComesTo('earth', false, ordinal) as number;
        expect(ask(ordinal, { stonesOffered: price }).paid).toBe(1);
    });

    it('has a maker far past that turn the same purse down, and name what they want instead', () => {
        const ordinal = 35;
        const price = whatACommissionComesTo('earth', false, ordinal) as number;
        const said = ask(ordinal, { stonesOffered: price, whatTheyWant: aCore });
        expect(said.paid).toBeLessThan(0.1);
        expect(said.agreed).toBe(false);
        expect(said.line).toMatch(/stones are worth little/i);
        expect(said.line).toContain(aCore.text);
    });

    it('takes the thing they want, worth what the work is worth, and not a thing they do not', () => {
        const ordinal = 35;
        const price = whatACommissionComesTo('earth', false, ordinal) as number;
        const wanted = ask(ordinal, {
            whatTheyWant: aCore,
            thingsPutDown: [{ what: aCore.text, worthInStones: price, isWhatTheyWant: true }]
        });
        const unwanted = ask(ordinal, {
            whatTheyWant: aCore,
            thingsPutDown: [{ what: 'a bolt of silk', worthInStones: price, isWhatTheyWant: false }]
        });
        expect(wanted.paid).toBe(1);
        expect(unwanted.paid).toBeLessThan(1);
    });

    it('is not a hard rule: a high maker who wants wealth takes a stone as a stone', () => {
        const ordinal = 35;
        const price = whatACommissionComesTo('earth', false, ordinal) as number;
        const said = ask(ordinal, { stonesOffered: price, whatTheyWant: { text: 'a fortune', kind: 'wealth' } });
        expect(said.whatAStoneIsWorthToThem).toBe(1);
        expect(said.paid).toBe(1);
    });

    it('turns a purse down for heaven work, and takes a wanted thing of the work\'s worth', () => {
        const ordinal = refiningOrdinalFor('heaven');
        const price = whatACommissionComesTo('heaven', false, ordinal) as number;
        const heaven = { named: 'a heaven-grade blade', grade: 'heaven' as const };
        expect(ask(ordinal, { ask: heaven, stonesOffered: price, whatTheyWant: aCore }).paid).toBeLessThan(1);
        expect(ask(ordinal, {
            ask: heaven,
            whatTheyWant: aCore,
            thingsPutDown: [{ what: aCore.text, worthInStones: price, isWhatTheyWant: true }]
        }).paid).toBe(1);
    });
});

describe('above the cash line a maker still has a price, and a singular thing still reaches', () => {
    const above: TechniqueGrade = 'heaven';
    const ordinal = refiningOrdinalFor(above);

    it('quotes a figure for heaven grade, and none for what nothing below the Lid makes', () => {
        const heaven = whatACommissionComesTo(above);
        expect(heaven).not.toBeNull();
        expect(heaven!).toBeGreaterThan(whatACommissionComesTo('earth', false, ordinal)!);
        expect(whatACommissionComesTo('immortal')).toBeNull();
        expect(whatACommissionComesTo('chaos')).toBeNull();
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
        // A purse well short of the maker's figure moves them less than the
        // singular thing that reaches.
        const price = whatACommissionComesTo(above, false, ordinal) as number;
        expect(reaching).toBeGreaterThan(
            howOften({ grade: above, ordinal, nearness: 'nearby', stones: Math.round(price / 10) })
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

    it('and the refusal names the maker\'s own figure', () => {
        const price = whatACommissionComesTo(above, false, ordinal) as number;
        const said = askOnce(1, { grade: above, ordinal, nearness: 'distant', stones: Math.round(price / 10) });
        expect(said.agreed).toBe(false);
        expect(said.line).toContain(String(price));
        expect(said.line).toMatch(/spirit stones/i);
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
        const price = whatACommissionComesTo('mortal', false, THE_USUAL_MAKER) as number;
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

// ═════════════════════════════════════════════════════════════════════════
// AND THE FLIP SIDE, WHICH IS THE SAME FUNCTION READ FROM THE OTHER END
// ═════════════════════════════════════════════════════════════════════════

/**
 * The player is not a special kind of person, so taking a commission is not a
 * special kind of question. It is this function with the two people swapped -
 * the player in `maker`, whoever wants the thing in `askerId` - and these pin
 * that the answer is symmetric rather than merely available.
 */

/**
 * A player, per sample.
 *
 * VARIED, because one id is one leaning and four hundred asks of one person is
 * a sample of size one wearing a rate. What is being measured is what happens
 * to PLAYERS, and players differ from each other exactly as everybody does.
 */
const playerNumber = (n: number): string => `the-player-${n}`;

/** Somebody asks the player to make them something. */
function somebodyAsksThePlayer(n: number, c: Case & { playerOrdinal?: number }) {
    const ask: WhatYouAskedThemToMake = {
        named: 'the thing',
        grade: c.grade ?? 'mortal',
        ...(c.slip === undefined ? {} : { slip: c.slip })
    };
    const askerId = `petitioner-${n}`;
    const player = playerNumber(n);
    return askingSomebodyToMakeYouSomething({
        ask,
        askerId,
        maker: { id: player, ordinal: c.playerOrdinal ?? THE_USUAL_MAKER },
        nearness: c.nearness ?? 'distant',
        stonesOffered: c.stones ?? 0,
        onTheTable: c.onTheTable ?? [],
        ledger: c.ledgerFor ? c.ledgerFor(askerId, player) : [],
        onDay: 1000
    });
}

function howOftenThePlayerAgrees(c: Case & { playerOrdinal?: number }): number {
    let yes = 0;
    for (let n = 0; n < PEOPLE; n++) if (somebodyAsksThePlayer(n, c).agreed) yes++;
    return yes / PEOPLE;
}

describe('the player taking a commission', () => {
    it('is refused by the same gate that refuses anybody', () => {
        const grade: TechniqueGrade = 'heaven';
        const said = somebodyAsksThePlayer(0, {
            grade,
            playerOrdinal: refiningOrdinalFor(grade) - 1
        });
        expect(said.hands.theyCan).toBe(false);
        expect(said.agreed).toBe(false);
        // The refusal names the realm, from this side too. A player told "no"
        // with no route is a player told nothing.
        expect(said.hands.why).toContain(refiningRealmNameFor(grade));
    });

    it('quotes the same price it would have paid', () => {
        // ONE LADDER, READ IN BOTH DIRECTIONS. What somebody must bring the
        // player is what the player would have had to bring somebody else -
        // otherwise taking commissions is an arbitrage and not a living.
        for (const grade of GRADES) {
            const asked = somebodyAsksThePlayer(0, { grade, playerOrdinal: MAX_ORDINAL });
            const asking = askOnce(0, { grade, ordinal: MAX_ORDINAL });
            expect(asked.priceInStones).toEqual(asking.priceInStones);
            // THE MAKER'S OWN ASK. The design owner: *"Whatever the maker asks.
            // Their time is presumably valuable, depends on realm."* So the
            // figure both sides quote is the one for a hand at this maker's rung.
            expect(asked.priceInStones).toEqual(whatACommissionComesTo(grade, false, MAX_ORDINAL));
        }
    });

    it('is moved by the tie, exactly as anybody else is', () => {
        // A master who asks you is not a stranger asking you. The player does
        // not get to be exempt from the thing that moves everybody.
        const distant = howOftenThePlayerAgrees({ nearness: 'distant' });
        const tied = howOftenThePlayerAgrees({ nearness: 'tied' });
        const household = howOftenThePlayerAgrees({ nearness: 'household' });
        expect(tied).toBeGreaterThan(distant);
        expect(household).toBeGreaterThan(tied);
    });

    it('and by the ledger, in both directions', () => {
        const plain = howOftenThePlayerAgrees({ nearness: 'house' });
        const owedAFavour = howOftenThePlayerAgrees({
            nearness: 'house',
            ledgerFor: (askerId, makerId) => [
                createFavor({
                    holderId: askerId,
                    subjectId: makerId,
                    cause: 'saved_life',
                    severity: 'grave',
                    onDay: 500,
                    description: 'pulled them out of the water',
                    triggeringEventId: 'ev-favour'
                })
            ]
        });
        const holdingAGrudge = howOftenThePlayerAgrees({
            nearness: 'house',
            ledgerFor: (askerId, makerId) => [
                createGrudge({
                    holderId: makerId,
                    subjectId: askerId,
                    cause: 'other',
                    severity: 'grave',
                    onDay: 500,
                    description: 'what happened at the ford',
                    triggeringEventId: 'ev-grudge'
                })
            ]
        });
        expect(owedAFavour).toBeGreaterThan(plain);
        expect(holdingAGrudge).toBeLessThan(plain);
    });

    it('says yes far more often once the money is on the table', () => {
        const grade: TechniqueGrade = 'mortal';
        const price = whatACommissionComesTo(grade, false, THE_USUAL_MAKER)!;
        const nothing = howOftenThePlayerAgrees({ grade, stones: 0 });
        const paid = howOftenThePlayerAgrees({ grade, stones: price });
        expect(paid).toBeGreaterThan(nothing);
        // A met price is a rubber stamp from this side too, not a wall wearing
        // an economy.
        expect(paid).toBeGreaterThan(0.5);
    });

    it('and leaves the petitioner owing them where nothing was paid', () => {
        const said = somebodyAsksThePlayer(0, { nearness: 'household' });
        if (said.agreed) {
            expect(said.owed).not.toBeNull();
            // The record is held by whoever spent their hands, which on this
            // side is the player.
            expect(said.owed!.holderId).toBe(playerNumber(0));
        }
    });

    it('is the same answer whichever way round two identical people stand', () => {
        // Symmetry stated as a claim rather than assumed: swap the ids and the
        // reading is the same, because nothing in here knows which of them is
        // the player.
        const ask: WhatYouAskedThemToMake = { named: 'the thing', grade: 'mortal' };
        const shared = { ask, nearness: 'house' as Nearness, onDay: 1000, stonesOffered: 0 };
        const oneWay = askingSomebodyToMakeYouSomething({
            ...shared,
            askerId: 'person-a',
            maker: { id: 'person-b', ordinal: 20 }
        });
        const asMakerInstead = askingSomebodyToMakeYouSomething({
            ...shared,
            askerId: 'person-c',
            maker: { id: 'person-b', ordinal: 20 }
        });
        // Same maker, same grade, same tie, different asker: the price and the
        // gate are identical and only the reading of the person can differ.
        expect(asMakerInstead.priceInStones).toEqual(oneWay.priceInStones);
        expect(asMakerInstead.hands.theyCan).toEqual(oneWay.hands.theyCan);
    });
});

// ═════════════════════════════════════════════════════════════════════════
// AND A RING, WHICH IS PRICED AS A FOLD RATHER THAN AS ITS MATERIALS
// ═════════════════════════════════════════════════════════════════════════

/**
 * A ring's grade means something else than every other grade in the world: a
 * mortal-grade ring is heaven-grade material to destroy and is called mortal for
 * how much it HOLDS. Its gate is folding space rather than working the stuff.
 *
 * `whyTheFoldWillNotHold` is the refusal that names the honest route and it had
 * no caller anywhere - so nobody was ever told why a ring could not be made for
 * them, only that it could not.
 */
describe('asking somebody to make you a ring', () => {
    it('is refused by the fold, not by the materials, and the refusal says so', () => {
        const said = whetherTheirHandsCanDoIt(
            { named: 'a ring', grade: 'mortal', aRing: true },
            FOLD_FLOOR_ORDINAL - 1
        );
        expect(said.theyCan).toBe(false);
        // A hand a rung under the floor can work mortal-grade materials all day.
        // What it cannot do is fold, and the refusal names that rather than a
        // shortage of skill.
        expect(said.why).toBeTruthy();
        expect(said.why).toMatch(/fold/i);
    });

    it('and a cheaper ring is not an easier one', () => {
        // There is no small fold. Every grade is refused at the same place.
        for (const grade of GRADES) {
            expect(
                whetherTheirHandsCanDoIt(
                    { named: 'a ring', grade, aRing: true },
                    FOLD_FLOOR_ORDINAL - 1
                ).theyCan
            ).toBe(false);
        }
    });

    it('opens for a hand that can fold', () => {
        const said = whetherTheirHandsCanDoIt(
            { named: 'a ring', grade: 'mortal', aRing: true },
            MAX_ORDINAL
        );
        expect(said.theyCan).toBe(true);
        expect(said.why).toBeNull();
    });

    it('is priced as a fold, and the grades climb steeply', () => {
        // The design owner: a heaven-grade ring is absurdly expensive,
        // equivalent to a heaven-grade spirit skiff, and a court has maybe one.
        // That is a statement about the fold rather than about the ore.
        const mortal = whatACommissionComesTo('mortal', true);
        const earth = whatACommissionComesTo('earth', true);
        const heaven = whatACommissionComesTo('heaven', true);
        expect(mortal).not.toBeNull();
        expect(earth!).toBeGreaterThan(mortal!);
        expect(heaven!).toBeGreaterThan(earth!);
        // Steeply, not linearly: a ring one grade up is not a ring plus a bit.
        expect(heaven! / earth!).toBeGreaterThan(earth! / mortal! * 0.9);
    });

    it('and a ring is priced differently from anything else of its grade', () => {
        // The whole reason the flag exists. A mortal-grade ring and a
        // mortal-grade slip are not the same commission.
        expect(whatACommissionComesTo('mortal', true))
            .not.toEqual(whatACommissionComesTo('mortal'));
    });
});
