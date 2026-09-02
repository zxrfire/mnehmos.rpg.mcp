/**
 * A prompt the player cannot type is worse than no prompt at all.
 *
 * `what-is-worth-doing-standing-here.ts` hands the player sentences and invites
 * them to submit them. Every one of those is a promise, and the way this file
 * would rot is silent: somebody tunes a regex in `actions.ts`, one of these
 * stops routing where it did, and the game starts offering a player a sentence
 * that comes back "the thought does not resolve" - which teaches them that the
 * game is broken rather than that they guessed wrong. That is strictly worse
 * than the refusal this whole feature exists to delete.
 *
 * So the load-bearing test here is the first one: every `say` is driven through
 * the real parser and has to land on the action the catalog says it lands on.
 *
 * The rest asserts the shape of the read - that it is SITUATED (the lines
 * offered change with the state, and a starving cultivator is not being told
 * about the news) and that it is never a dump and never empty.
 */

import { describe, it, expect } from 'vitest';
import { parseIntent } from '../../src/web/actions.js';
import {
    whatIsWorthDoingStandingHere,
    theMostPressing,
    linesFor,
    ASKING_WHAT_IS_POSSIBLE,
    ABOUT_A_MANUAL,
    type StandingHere
} from '../../src/web/what-is-worth-doing-standing-here.js';
import { STARVATION_TURNS } from '../../src/schema/cultivation.js';
import {
    whatWouldCloseThisWound,
    whatToSayAboutTheCure
} from '../../src/web/what-would-close-this-wound.js';
import { medicineReaches } from '../../src/engine/cultivation/what-grade-of-medicine-a-wound-needs.js';
import {
    HOME_REGION_ID,
    SOUTH_REGION_ID,
    localPrice
} from '../../src/data/cultivation/regions.js';
import { PRICES, cashToStones } from '../../src/data/cultivation/mortal-world.js';

/**
 * The cure a torn meridian actually has, read off the catalogs rather than
 * typed in here. If the catalog moves, these tests move with it.
 *
 * ── THESE FIXTURES USED TO BE A CRIPPLING TEAR AT ORDINAL 8 ──────────────
 *
 * And they were measuring a defect. The pill path applied no grade gate, so a
 * crippling tear on a novice came back answered by a 60-stone mortal Clear
 * Meridian Pill - purchasable, affordable, and refused by the physician in the
 * same breath. `treat_injury` now passes `medicineReaches`, the two paths
 * agree, and that wound's honest answer is a heaven-grade pill nobody sells.
 * Asserting the old answer would be asserting the bug, so the case moved rather
 * than the bar: it has its own test below, under the name it deserves.
 *
 * The pair here is now the case the tests were always ABOUT - a wound a
 * physician cannot reach whose medicine is still on a board - and it is the
 * REALM axis rather than the severity one that produces it. An ordinary serious
 * tear on a Core Formation body wants earth grade; mortal care does not touch
 * it; the Marrow-Washing Pill does, at 420 stones.
 */
const HURT_AT_CORE_FORMATION = [
    { id: 'i1', severity: 'serious', source: 'qi_deviation', treated: false } as never
];
const CORE_FORMATION_ORDINAL = 17;
const CURE_IN_REACH = whatWouldCloseThisWound(
    HURT_AT_CORE_FORMATION, CORE_FORMATION_ORDINAL, 500, HOME_REGION_ID)!;
const CURE_OUT_OF_REACH = whatWouldCloseThisWound(
    HURT_AT_CORE_FORMATION, CORE_FORMATION_ORDINAL, 0, HOME_REGION_ID)!;

/**
 * A cultivator with nothing wrong. Every test below moves one field off this,
 * so what is being asserted is always the difference the field made.
 */
const WELL: StandingHere = {
    satiety: 100,
    starvationTurns: 0,
    turnsUntilStarvation: 50,
    spiritStones: 200,
    mealCost: 1,
    treatableWounds: 0,
    woundsPastMortalCare: 0,
    cure: null,
    battered: false,
    practisesAMethod: true,
    methodExhausted: false,
    breakthroughReady: false,
    inASect: true,
    sellableGoods: 0,
    pillsCarried: 0,
    peopleAboveHere: 0,
    peopleHere: 0,
    peopleHereWithSomethingToSell: 0,
    thinGround: false,
    paperOnTheWall: null,
    spanCounterHere: false,
    dutiesGoing: 0,
    groundThatTeachesARoad: 0,
    brokenSeclusion: null,
    aboveTheLid: false
};

const ids = (here: StandingHere): string[] =>
    whatIsWorthDoingStandingHere(here).map(a => a.id);

const byId = (here: StandingHere, id: string) =>
    whatIsWorthDoingStandingHere(here).find(a => a.id === id);

describe('every sentence offered is a sentence the parser understands', () => {
    // Drawn from the module rather than restated, so a line added to the
    // catalog is covered the moment it exists rather than when somebody
    // remembers to come back here.
    const everySentence = () => {
        const seen = new Map<string, string>();
        for (const state of [
            WELL,
            { ...WELL, satiety: 0, starvationTurns: 2, turnsUntilStarvation: 3, spiritStones: 0 },
            { ...WELL, practisesAMethod: false, inASect: false, thinGround: true },
            { ...WELL, methodExhausted: true, breakthroughReady: true },
            { ...WELL, treatableWounds: 2, woundsPastMortalCare: 1, battered: true, cure: CURE_IN_REACH },
            { ...WELL, sellableGoods: 3, spiritStones: 0, peopleAboveHere: 4 },
            // Somebody in the square with surplus. `SAY.market` sat in this
            // module unreferenced by any rule until the sellers landed, so
            // "what is for sale" was a sentence the game printed nowhere.
            { ...WELL, peopleHereWithSomethingToSell: 2 },
            // The square as it actually was in the run that produced this
            // pass: paper on the wall, somebody standing in it, a counter, and
            // work going. Every one of those was true and none of them was
            // offered.
            {
                ...WELL,
                paperOnTheWall: { bills: 2, withinReach: 1, daysToTheSoonest: 35 },
                spanCounterHere: true,
                dutiesGoing: 3,
                peopleHere: 1,
                pillsCarried: 2,
                groundThatTeachesARoad: 1
            },
            { ...WELL, brokenSeclusion: { daysRemaining: 900, canWithdraw: true } }
        ]) {
            for (const a of whatIsWorthDoingStandingHere(state)) seen.set(a.say, a.routesTo);
        }
        return [...seen];
    };

    it('routes each one to the action the catalog claims', () => {
        for (const [say, routesTo] of everySentence()) {
            expect(parseIntent(say).action, `"${say}"`).toBe(routesTo);
        }
    });

    it('offers no sentence that falls through to unclear', () => {
        for (const [say] of everySentence()) {
            expect(parseIntent(say).action, `"${say}"`).not.toBe('unclear');
        }
    });

    it('covers every line in the catalog across those states', () => {
        // Cheap guard against a rule that can never fire: a sentence nobody can
        // reach is a sentence nobody tests.
        expect(everySentence().length).toBeGreaterThanOrEqual(15);
    });
});

describe('asking what there is to do', () => {
    it('recognises the two universal inputs and their near neighbours', () => {
        for (const said of [
            'help', 'HELP', 'help me', '/help', '?',
            'what can I do', 'what can i do here', 'what could I do',
            'what do I do', 'what should I do now', 'what now', 'what next',
            'what are my options', 'what are the options', "what's my options",
            'my options', 'I do not know what to do', 'how do I play',
            'what is there to do here', 'what can be done'
        ]) {
            expect(ASKING_WHAT_IS_POSSIBLE.test(said), `"${said}"`).toBe(true);
        }
    });

    it('does not swallow a question about the world that happens to contain the words', () => {
        // Every one of these has a real verb behind it. Widening this regex
        // until it eats them is exactly the mistake `AGENTS.md` calls stealing
        // sentences from a neighbouring verb.
        for (const said of [
            'help me carry this',
            'what can I do about the Azure Dew Sect',
            'who can help me',
            'I ask the elder for help',
            'what can I do with this manual',
            'what should I do about the Ashen Forge Clan',
            'I help the farmer with his roof'
        ]) {
            expect(ASKING_WHAT_IS_POSSIBLE.test(said), `"${said}"`).toBe(false);
        }
    });

    it('leaves a question that is genuinely about a book to the book read', () => {
        // "what are my options" alone is somebody asking what the game is.
        // "my options at this ceiling" is somebody asking how their manual goes
        // further, which already had a good answer and keeps it.
        expect(ABOUT_A_MANUAL.test('what are my options')).toBe(false);
        expect(ABOUT_A_MANUAL.test('my options at this ceiling')).toBe(true);
        expect(ABOUT_A_MANUAL.test('how do I get further with this manual')).toBe(true);
    });
});

describe('the read is situated', () => {
    it('surfaces the recovery loop for somebody broke, starving and wounded', () => {
        // The exact corner a real run died in: qi deviation at Qi Condensation
        // Layer 9, three untreated wounds, every stone spent, satiety at zero.
        // There was a way out and the interface never mentioned it.
        const crisis: StandingHere = {
            ...WELL,
            satiety: 0,
            starvationTurns: 2,
            turnsUntilStarvation: STARVATION_TURNS - 2,
            spiritStones: 0,
            treatableWounds: 3,
            battered: true
        };
        const offered = ids(crisis);
        expect(offered).toContain('eat');
        expect(offered).toContain('work');
        expect(offered).toContain('gather');
        expect(offered).toContain('treat');

        // And the whole recovery loop is inside what a cramped panel shows.
        const pressing = theMostPressing(whatIsWorthDoingStandingHere(crisis), 3)
            .map(a => a.id);
        expect(pressing.every(id => ['eat', 'work', 'gather', 'treat', 'sell'].includes(id)))
            .toBe(true);
    });

    it('says the purse cannot cover it rather than only that food exists', () => {
        const broke = { ...WELL, satiety: 0, starvationTurns: 1, turnsUntilStarvation: 4, spiritStones: 0 };
        expect(byId(broke, 'eat')?.because).toMatch(/purse|Something has to be sold or earned/i);
        expect(byId(broke, 'eat')?.urgency).toBe('now');
    });

    it('does not talk about food to somebody who has eaten', () => {
        expect(ids(WELL)).not.toContain('eat');
        expect(ids(WELL)).not.toContain('work');
    });

    it('surfaces the teacher and the arts for somebody practising no method', () => {
        const stalled = { ...WELL, practisesAMethod: false, inASect: false };
        expect(ids(stalled)).toContain('teacher');
        expect(ids(stalled)).toContain('arts');
        expect(ids(stalled)).toContain('sects');
        // And does not offer sitting down, which is the one thing that cannot work.
        expect(ids(stalled)).not.toContain('cultivate');
    });

    it('offers seclusion only to a body that could survive it', () => {
        expect(ids(WELL)).toContain('cultivate');
        expect(ids({ ...WELL, treatableWounds: 1 })).not.toContain('cultivate');
        expect(ids({ ...WELL, satiety: 0, turnsUntilStarvation: 1 })).not.toContain('cultivate');
    });

    it('offers the crossing exactly when the engine says it is ready', () => {
        expect(ids(WELL)).not.toContain('breakthrough');
        expect(ids({ ...WELL, breakthroughReady: true })).toContain('breakthrough');
    });

    it('points a stalled manual at the ceiling and the three routes past it', () => {
        const capped = { ...WELL, methodExhausted: true };
        expect(ids(capped)).toContain('ceiling');
        expect(ids(capped)).toContain('further');
    });

    // ── the medicine, by name ─────────────────────────────────────────────
    //
    // The sharpest case found in play, and the one this half of the file is
    // for: the whole medicine system is correct, affordable and in the
    // player's reach, and its NAME appears nowhere except `pills.ts`. A player
    // cannot read the source. Every assertion below is that they no longer
    // have to.
    it('names the medicine, at its price, to somebody who can afford it', () => {
        const crippled = {
            ...WELL, spiritStones: 500, treatableWounds: 0,
            woundsPastMortalCare: 1, cure: CURE_IN_REACH
        };
        const medicine = byId(crippled, 'medicine');
        expect(medicine, 'a wound past mortal care must surface the cure').toBeTruthy();
        // The NAME, in a sentence the player can submit unchanged.
        expect(medicine!.say).toContain(CURE_IN_REACH.name);
        expect(medicine!.routesTo).toBe('buy');
        expect(parseIntent(medicine!.say).action).toBe('buy');
        // The PRICE, and that the purse covers it.
        expect(medicine!.because).toContain(String(CURE_IN_REACH.stones));
        expect(medicine!.because).toMatch(/carrying enough/i);
        expect(medicine!.urgency).toBe('now');
    });

    it('names it, and the two ways to afford it, to somebody who cannot', () => {
        const broke = {
            ...WELL, spiritStones: 0, treatableWounds: 0,
            woundsPastMortalCare: 1, cure: CURE_OUT_OF_REACH
        };
        const offered = ids(broke);
        expect(offered).toContain('medicine');
        expect(offered).toContain('work');
        expect(offered).toContain('gather');
        expect(byId(broke, 'medicine')!.because).toMatch(/not carrying enough/i);
        // And the reason for working is the cure, not hunger. A player who is
        // fed and wounded needs a different sentence from one who is starving.
        expect(byId(broke, 'work')!.because).toContain(CURE_OUT_OF_REACH.name);
    });

    it('does not send a wounded player to a counter that will refuse them', () => {
        // Where money is not the medium, the verb offered is the physician,
        // because the physician's refusal is where that sentence is said in
        // full. Pointing at a market stall would be pointing at a shrug.
        const pastMoney = {
            ...WELL,
            treatableWounds: 0,
            woundsPastMortalCare: 1,
            cure: { ...CURE_IN_REACH, stones: null, affordable: false, notForSale: 'Nobody sells one.' }
        };
        expect(ids(pastMoney)).not.toContain('medicine');
        expect(ids(pastMoney)).toContain('treat');
    });

    it('says nothing about medicine to somebody a physician can mend', () => {
        const ordinary = { ...WELL, treatableWounds: 2, woundsPastMortalCare: 0, cure: CURE_IN_REACH };
        expect(ids(ordinary)).toContain('treat');
        expect(ids(ordinary)).not.toContain('medicine');
    });
});

describe('the cure is read off the catalog, never invented', () => {
    it('finds a purchasable medicine for an ordinary torn meridian', () => {
        const cure = whatWouldCloseThisWound(
            [{ id: 'i1', severity: 'serious', source: 'qi_deviation', treated: false } as never],
            0,
            100,
            HOME_REGION_ID
        );
        expect(cure).toBeTruthy();
        expect(cure!.stones).toBeGreaterThan(0);
        expect(cure!.notForSale).toBeNull();
        expect(cure!.affordable).toBe(true);
    });

    it('answers nothing at all when nothing is torn', () => {
        expect(whatWouldCloseThisWound([], 8, 500, HOME_REGION_ID)).toBeNull();
    });

    it('says the price and the purse in the same sentence', () => {
        const said = whatToSayAboutTheCure(CURE_OUT_OF_REACH);
        expect(said).toContain(CURE_OUT_OF_REACH.name);
        expect(said).toMatch(/not carrying enough/i);
    });

    it('reports what a physician needs separately from what a pill costs', () => {
        // These two used to DISAGREE in the live engine - the pill path applied
        // no grade gate and the physician did - and both were carried so that a
        // player told only one of them did not learn the game contradicts
        // itself. They now agree, and both are still carried, because the
        // refusal has to state what it is refusing on.
        expect(CURE_IN_REACH.physicianReaches).toBe(false);
        expect(CURE_IN_REACH.physicianNeeds).toBe('earth');
        expect(CURE_IN_REACH.stones).toBe(420);
    });

    /**
     * The quote and the charge are one number.
     *
     * This is the guard for a defect that was pre-existing, documented in place
     * as acceptable, and only became visible when a catalog row put it on a
     * large absolute figure: the advice quoted the BOARD price and `buy`
     * charged `localPrice`, so a player standing in a province with a
     * multiplier was told one number and asked another. Told 420 and charged
     * 924 is being lied to, whichever of the two is "correct".
     *
     * Asserted against `localPrice` rather than a typed-in figure, so the
     * multipliers can be retuned without this going stale - what is being
     * pinned is that the two surfaces do the same arithmetic, not what the
     * arithmetic currently comes to.
     */
    it('quotes what a counter in THIS province charges, not the board base', () => {
        const row = PRICES.find(price => price.name === CURE_IN_REACH.name)!;
        const asBuyWouldCharge = (regionId: string): number =>
            Math.max(1, Math.ceil(cashToStones(localPrice(regionId, row.cash))));

        for (const regionId of [HOME_REGION_ID, SOUTH_REGION_ID]) {
            const cure = whatWouldCloseThisWound(
                HURT_AT_CORE_FORMATION, CORE_FORMATION_ORDINAL, 10_000, regionId)!;
            expect(cure.name, regionId).toBe(CURE_IN_REACH.name);
            expect(cure.stones, regionId).toBe(asBuyWouldCharge(regionId));
            expect(whatToSayAboutTheCure(cure)).toContain(`${cure.stones} spirit stones`);
        }

        // And the province multiplier is doing something, or the assertion
        // above would pass on two identical numbers and prove nothing.
        expect(asBuyWouldCharge(SOUTH_REGION_ID))
            .toBeGreaterThan(asBuyWouldCharge(HOME_REGION_ID));
    });

    /**
     * Affordability is a claim about a purse against a price, so it has to be
     * against the price actually asked. The same 500 stones that covers this
     * cure at home does not cover it in the Drowned Reach, and the sentence has
     * to say so rather than promising "you are carrying enough for one".
     */
    it('decides affordability against the local figure', () => {
        const row = PRICES.find(price => price.name === CURE_IN_REACH.name)!;
        const purse = Math.max(1, Math.ceil(cashToStones(localPrice(HOME_REGION_ID, row.cash))));

        const here = whatWouldCloseThisWound(
            HURT_AT_CORE_FORMATION, CORE_FORMATION_ORDINAL, purse, HOME_REGION_ID)!;
        const away = whatWouldCloseThisWound(
            HURT_AT_CORE_FORMATION, CORE_FORMATION_ORDINAL, purse, SOUTH_REGION_ID)!;

        expect(here.affordable).toBe(true);
        expect(away.affordable).toBe(false);
        expect(whatToSayAboutTheCure(away)).toMatch(/not carrying enough/i);
    });

    it('never names a medicine that would be refused at the point of use', () => {
        // The whole of what the grade gate changed about this file. For every
        // wound on every body, the pill named has to be one `medicineReaches`
        // accepts - otherwise the sentence sends somebody to a counter, takes
        // their stones, and hands them something the resolver will not spend.
        for (const severity of ['minor', 'serious', 'crippling'] as const) {
            for (const ordinal of [0, 8, 13, 17, 21, 26, 29, 33, 41]) {
                const cure = whatWouldCloseThisWound(
                    [{ id: 'i1', severity, source: 'qi_deviation', treated: false } as never],
                    ordinal,
                    1_000_000,
                    HOME_REGION_ID
                );
                expect(cure, `${severity} at ${ordinal} has no named cure`).toBeTruthy();
                expect(
                    medicineReaches(cure!.grade, severity, ordinal),
                    `${cure!.name} (${cure!.grade}) does not reach a ${severity} tear at ${ordinal}`
                ).toBe(true);
            }
        }
    });

    it('names a heaven-grade pill nobody sells for a crippling tear, and says so', () => {
        // The case the fixtures above used to occupy, kept because it is the
        // honest high corner and it is now the answer rather than a bug: the
        // catalog says the Meridian Rebirth Pill is the only medicine below
        // immortal grade that touches crippling damage, and heaven grade is
        // past the cash line. So the player is told the name, told it is not
        // bought with money, and told what IS listened to instead.
        const cure = whatWouldCloseThisWound(
            [{ id: 'i1', severity: 'crippling', source: 'qi_deviation', treated: false } as never],
            8,
            194,
            HOME_REGION_ID
        )!;
        expect(cure.grade).toBe('heaven');
        expect(cure.stones).toBeNull();
        expect(cure.affordable).toBe(false);
        expect(cure.notForSale).toBeTruthy();
        // A refusal is finished when it names the alternative, and the
        // alternative here is a medium rather than a price.
        expect(whatToSayAboutTheCure(cure)).toContain(cure.name);
        expect(whatToSayAboutTheCure(cure)).toMatch(/favour owed/i);
    });
});

describe('the read is bounded, ordered and never empty', () => {
    it('answers a cultivator with nothing wrong at all', () => {
        expect(whatIsWorthDoingStandingHere(WELL).length).toBeGreaterThan(0);
    });

    it('is never a dump', () => {
        // A wall of text is how a player learns to stop reading. Every state
        // has to fit on a screen next to the thing that caused it.
        for (const state of [
            WELL,
            { ...WELL, satiety: 0, starvationTurns: 3, turnsUntilStarvation: 1, spiritStones: 0, treatableWounds: 3, woundsPastMortalCare: 2, sellableGoods: 4, practisesAMethod: false, methodExhausted: false, inASect: false, thinGround: true, peopleAboveHere: 6, battered: true }
        ]) {
            expect(whatIsWorthDoingStandingHere(state).length).toBeLessThanOrEqual(8);
        }
    });

    it('says each sentence once', () => {
        const offered = ids({
            ...WELL, satiety: 0, starvationTurns: 2, turnsUntilStarvation: 2,
            spiritStones: 0, sellableGoods: 2, peopleAboveHere: 3, practisesAMethod: false
        });
        expect(new Set(offered).size).toBe(offered.length);
    });

    it('puts what is killing them first', () => {
        const dying = {
            ...WELL, satiety: 0, starvationTurns: 3, turnsUntilStarvation: 1,
            spiritStones: 0, thinGround: true, peopleAboveHere: 2
        };
        const order = whatIsWorthDoingStandingHere(dying);
        expect(order[0].urgency).toBe('now');
        // `open` reads never outrank a body that is being taken apart.
        const firstOpen = order.findIndex(a => a.urgency === 'open');
        const lastNow = order.map(a => a.urgency).lastIndexOf('now');
        expect(lastNow).toBeLessThan(firstOpen);
    });

    it('renders each line as the sentence to type and the reason it is live', () => {
        for (const line of linesFor(whatIsWorthDoingStandingHere(WELL))) {
            expect(line).toMatch(/^".+" - .+/);
        }
    });
});

/**
 * The row has to CHANGE, and the three axes it has to change along.
 *
 * ── The report this describe block exists to answer ──────────────────────
 *
 * From the design owner, playing in the browser: across a fresh run, several
 * turns and two locations, the row under the prose offered the same three
 * every time - "who can teach me", "what arts can I learn", "what sects are
 * there". *"It must change with the player's rung, with what they know, and
 * with where they are standing."*
 *
 * The cause was not that the module had nothing else to say. It was that those
 * three fire off one condition that holds for the whole opening of the game,
 * all three sat at the same urgency, and the client shows the top of the list -
 * so nothing that was actually happening could get above them. Two houses were
 * holding intakes in the square, somebody was standing an arm's length away,
 * and a counter was selling passage out of the province.
 *
 * So what is asserted here is a PROPERTY rather than a list: that a fact about
 * the place outranks a read that is true in every square in the world, and
 * that two different places do not produce the same row.
 */
describe('the row moves with the place, the rung and the state', () => {
    /** What the client actually shows: the head of the ordering. */
    const row = (here: StandingHere, n = 3): string[] =>
        theMostPressing(whatIsWorthDoingStandingHere(here), n).map(a => a.id);

    // The state the report was taken in: a nobody with no method, standing
    // somewhere. Every case below moves ONE fact off it.
    const NOBODY: StandingHere = { ...WELL, practisesAMethod: false, inASect: false };

    it('offered the same three in every place before this, and does not now', () => {
        const wheatgate: StandingHere = {
            ...NOBODY,
            // Two houses holding intakes, one of them at a bar this cultivator
            // clears, the nearer in 35 days. All four numbers are the run's.
            paperOnTheWall: { bills: 2, withinReach: 1, daysToTheSoonest: 35 },
            peopleHere: 1
        };
        const plain: StandingHere = { ...NOBODY };

        expect(row(wheatgate)).not.toEqual(row(plain));
        expect(row(wheatgate)).toContain('bills');
    });

    it('puts the wall and the square ahead of a read that is true everywhere', () => {
        const busy: StandingHere = {
            ...NOBODY,
            paperOnTheWall: { bills: 2, withinReach: 1, daysToTheSoonest: 35 },
            peopleHere: 3,
            spanCounterHere: true
        };
        const shown = row(busy, 5);
        // The floor - reads that are true in every square in the world - must
        // not be at the head of the row while any of this is true.
        expect(shown).toContain('bills');
        expect(shown).toContain('room');
        for (const evergreen of ['news', 'hunt']) {
            expect(shown, evergreen).not.toContain(evergreen);
        }
    });

    it('says nothing about a wall where there is no wall', () => {
        expect(ids({ ...NOBODY, paperOnTheWall: null })).not.toContain('bills');
        expect(ids({ ...NOBODY, paperOnTheWall: { bills: 0, withinReach: 0, daysToTheSoonest: null } }))
            .not.toContain('bills');
    });

    it('counts the paper and dates the intake without naming a house', () => {
        const said = byId(
            { ...NOBODY, paperOnTheWall: { bills: 2, withinReach: 1, daysToTheSoonest: 35 } },
            'bills'
        )!;
        expect(said.because).toContain('2 bills');
        expect(said.because).toContain('35 days');
        expect(said.urgency).toBe('soon');
        // A bar nobody standing here clears is worth reading and is not an
        // opportunity, so it drops a band rather than disappearing.
        expect(byId(
            { ...NOBODY, paperOnTheWall: { bills: 3, withinReach: 0, daysToTheSoonest: 70 } },
            'bills'
        )!.urgency).toBe('open');
    });

    it('offers the counter only where there is a counter', () => {
        expect(ids(WELL)).not.toContain('passage');
        expect(ids({ ...WELL, spanCounterHere: true })).toContain('passage');
    });

    it('offers the mission board on what is going, not on who you serve', () => {
        // Both halves of the old gate were wrong. A member - the person the
        // whole board exists for - was never offered it; a nobody in front of
        // an empty wall was offered a sentence that answers "you belong to
        // nothing, so there is no wall", which is a refusal with a button on
        // it.
        expect(ids({ ...WELL, inASect: true, dutiesGoing: 4 })).toContain('duties');
        expect(ids({ ...WELL, inASect: false, dutiesGoing: 4 })).toContain('duties');
        expect(ids({ ...WELL, inASect: false, dutiesGoing: 0 })).not.toContain('duties');
    });

    it('mentions the person standing in the square rather than only the ladder', () => {
        // The Stone-Shell Tortoise case: present, at ordinal 29, and nothing
        // offered looking at it. `peopleAboveHere` was the only roster figure
        // this module read, so somebody at or below the player's rung was
        // invisible to it.
        const alone = byId(WELL, 'room')!;
        const notAlone = byId({ ...WELL, peopleHere: 1 }, 'room')!;
        expect(notAlone.because).not.toBe(alone.because);
        expect(notAlone.because).toContain('1 person');
        expect(notAlone.whatItIsAbout).toBe('here');
        expect(alone.whatItIsAbout).toBe('always');
    });

    it('tells somebody carrying a pill that a pill does nothing until it is taken', () => {
        expect(byId({ ...WELL, pillsCarried: 2 }, 'inventory')!.because)
            .toMatch(/not been swallowed/i);
        expect(ids({ ...WELL, pillsCarried: 0, sellableGoods: 0 })).not.toContain('inventory');
    });

    it('stops saying "what arts can I learn" the moment there is a method', () => {
        expect(ids({ ...WELL, practisesAMethod: false })).toContain('arts');
        expect(ids({ ...WELL, practisesAMethod: true })).not.toContain('arts');
    });

    it('does not let one condition own the whole row', () => {
        // Three lines fired off `practisesAMethod: false` at one urgency, and
        // a row with room for three showed those three for the entire opening
        // of the game. They all still fire; what changed is that they cannot
        // all outrank whatever is happening.
        const shown = row({
            ...NOBODY,
            paperOnTheWall: { bills: 1, withinReach: 1, daysToTheSoonest: 12 },
            peopleHere: 2,
            spanCounterHere: true
        }, 5);
        const roadReads = shown.filter(id => ['teacher', 'arts', 'sects'].includes(id));
        expect(roadReads.length).toBeLessThan(3);
    });
});

describe('a line is about the square, about the body, or about nothing', () => {
    it('marks the floor as the floor and everything gated by where it was gated', () => {
        // The axis the client leads with. If the floor were ever marked live
        // the row would be padded with reads that are true in every square in
        // the world, which is the defect this pass was for.
        for (const a of whatIsWorthDoingStandingHere(WELL)) {
            if (['ceiling', 'destinations', 'hunt', 'room', 'news'].includes(a.id)) {
                expect(a.whatItIsAbout, a.id).toBe('always');
            }
        }
        const busy = whatIsWorthDoingStandingHere({
            ...WELL,
            paperOnTheWall: { bills: 1, withinReach: 1, daysToTheSoonest: 4 },
            spanCounterHere: true,
            dutiesGoing: 2,
            peopleHere: 1
        });
        for (const id of ['bills', 'passage', 'duties', 'room']) {
            expect(busy.find(a => a.id === id)?.whatItIsAbout, id).toBe('here');
        }
        // And a fact about the body is not dressed up as a fact about the
        // square. `arts` fires on practising no method and is just as true in
        // the next province.
        expect(whatIsWorthDoingStandingHere({ ...WELL, practisesAMethod: false })
            .find(a => a.id === 'arts')?.whatItIsAbout).toBe('you');
    });

    it('orders the square, then the body, then the floor inside one urgency band', () => {
        const order = whatIsWorthDoingStandingHere({
            ...WELL, practisesAMethod: false, peopleHere: 2,
            spanCounterHere: true, dutiesGoing: 1
        });
        const RANK = { here: 0, you: 1, always: 2 } as const;
        for (const band of ['now', 'soon', 'open'] as const) {
            const inBand = order.filter(a => a.urgency === band).map(a => RANK[a.whatItIsAbout]);
            expect([...inBand].sort((x, y) => x - y), band).toEqual(inBand);
        }
    });

    it('never names anybody or any house it was only handed a count of', () => {
        // The discovery gate, applied to this surface. Every figure below is a
        // count, and the lines they produce route to reads that do their own
        // granting - so nothing here may hand over a record the player has not
        // been given.
        const counted = whatIsWorthDoingStandingHere({
            ...WELL,
            paperOnTheWall: { bills: 3, withinReach: 2, daysToTheSoonest: 9 },
            peopleHere: 4,
            peopleAboveHere: 2,
            peopleHereWithSomethingToSell: 1,
            dutiesGoing: 2
        });
        for (const a of counted) {
            // A house or a person would arrive as a capitalised proper noun in
            // the middle of a sentence. The only ones legitimately there are
            // the two the catalog puts in a sentence of its own.
            const proper = a.because.match(/(?<![.!?"] )(?<!^)\b[A-Z][a-z]{2,}\b/g) ?? [];
            expect(proper.filter(w => !['Span', 'Measured', 'Work', 'Nothing', 'Something',
                'About', 'Enough', 'Ground', 'Whether', 'Sitting', 'Putting', 'The',
                'Every', 'Where', 'What', 'Who', 'Reading', 'A'].includes(w)), a.id)
                .toEqual([]);
        }
    });
});

describe('above the Lid is a different world, and is not offered a market stall', () => {
    const immortal: StandingHere = {
        ...WELL,
        aboveTheLid: true,
        // Deliberately hostile: every mortal-world trigger set at once. None of
        // them may fire, because every one would be a refusal.
        satiety: 0,
        starvationTurns: 4,
        turnsUntilStarvation: 0,
        spiritStones: 0,
        treatableWounds: 3,
        woundsPastMortalCare: 2,
        battered: true,
        sellableGoods: 5,
        pillsCarried: 3,
        thinGround: true,
        peopleAboveHere: 1,
        peopleHere: 4,
        paperOnTheWall: { bills: 3, withinReach: 3, daysToTheSoonest: 2 },
        dutiesGoing: 4,
        practisesAMethod: false,
        inASect: false
    };

    it('offers nothing that would be refused up there', () => {
        const offered = ids(immortal);
        for (const mortal of ['eat', 'work', 'gather', 'sell', 'treat', 'market',
            'teacher', 'sects', 'duties', 'room', 'news', 'inventory', 'bills']) {
            expect(offered, mortal).not.toContain(mortal);
        }
    });

    it('still answers rather than going silent', () => {
        expect(whatIsWorthDoingStandingHere(immortal).length).toBeGreaterThan(0);
    });
});
