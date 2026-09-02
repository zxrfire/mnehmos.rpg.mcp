/**
 * The term of the social resolver that had never once been supplied.
 *
 * `resolveAttempt` prices seven things and `wants` was the last of them with no
 * caller anywhere - so "they have an open goal you could move" was false in
 * every social attempt any player had ever made. What is pinned here is the
 * shape of the reading rather than any rate:
 *
 *   1. It is read off ROWS. A goal pointed at the asker by id fires; the same
 *      goal pointed at anybody else does not.
 *   2. The purse is priced against the SUBJECT's year, not against a constant.
 *   3. The shelf is the lever available to somebody with nothing, so a nobody
 *      carrying one art the elder has not carries the term against the elder.
 *   4. The gap in rung is NOT read, in either direction. That is the whole
 *      reason the term is worth having.
 */

import { describe, it, expect } from 'vitest';

import { earningsPerYear } from '../../../src/engine/cultivation/origin.js';
import { addGoal, createNpc } from '../../../src/engine/world/npc-state.js';
import type { NpcGoal } from '../../../src/engine/world/npc-state.js';
import {
    A_NEED_IS_PRESENT_WITHIN_DAYS,
    HOW_FAR_BENEATH_THEM_IT_MAY_BE,
    MOST_A_NEED_BENDS_A_PRICE,
    aWantThatCannotWait,
    goalsHeldBy,
    theDayTheClimbRunsOut,
    whatTheirNeedDoesToThePriceOf,
    whatTheyWantThatYouCouldReach,
    whenThisWantRunsOut
} from '../../../src/engine/world/what-an-open-need-does-to-an-ask-and-to-a-price.js';
import type {
    SomebodyWithGoals,
    TheClocksSomebodyIsUnder,
    WhatTheAskerBrings
} from '../../../src/engine/world/what-an-open-need-does-to-an-ask-and-to-a-price.js';

const goal = (over: Partial<NpcGoal> = {}): NpcGoal => ({
    id: 'g1',
    kind: 'wealth',
    text: 'Put together enough spirit stones to stop worrying about food.',
    priority: 0.45,
    progress: '',
    obstacles: [],
    deadlineOnDay: null,
    status: 'active',
    targetId: null,
    openedOnDay: 0,
    closedOnDay: null,
    note: '',
    inheritedFromId: null,
    originHolderId: 'them',
    generation: 0,
    ...over
});

const them = (over: Partial<SomebodyWithGoals> = {}): SomebodyWithGoals => ({
    id: 'them',
    ordinal: 6,
    factionId: null,
    holds: [],
    goals: [goal()],
    ...over
});

const you = (over: Partial<WhatTheAskerBrings> = {}): WhatTheAskerBrings => ({
    id: 'you',
    factionId: null,
    ranked: false,
    spiritStones: 0,
    holds: [],
    ...over
});

describe('what they want that you could reach', () => {
    it('is null when nothing the asker carries touches what they want', () => {
        expect(whatTheyWantThatYouCouldReach(them(), you())).toBeNull();
    });

    it('fires on a goal pointed at the asker by id', () => {
        const pointed = them({ goals: [goal({ kind: 'status', targetId: 'you' })] });
        expect(whatTheyWantThatYouCouldReach(pointed, you())?.because).toBe('it_is_about_you');
    });

    it('does not fire on the same goal pointed at somebody else', () => {
        const pointed = them({ goals: [goal({ kind: 'status', targetId: 'a-third-party' })] });
        expect(whatTheyWantThatYouCouldReach(pointed, you())).toBeNull();
    });

    it('fires on a goal pointed at the asker\'s house', () => {
        const pointed = them({ goals: [goal({ kind: 'status', targetId: 'iron-bell' })] });
        expect(whatTheyWantThatYouCouldReach(pointed, you({ factionId: 'iron-bell' }))?.because)
            .toBe('your_house');
    });

    it('prices the purse against the subject\'s own year and not a constant', () => {
        const poor = them({ ordinal: 0 });
        const rich = them({ ordinal: 30 });
        const theirYear = Math.ceil(earningsPerYear(0));
        const carrying = you({ spiritStones: theirYear });

        expect(whatTheyWantThatYouCouldReach(poor, carrying)?.because).toBe('your_purse');
        // The same purse against somebody who earns far more is not money.
        expect(whatTheyWantThatYouCouldReach(rich, carrying)).toBeNull();
    });

    it('an empty purse reaches a goal about money not at all', () => {
        expect(whatTheyWantThatYouCouldReach(them({ ordinal: 0 }), you())).toBeNull();
    });

    it('a road they have not is the lever available to somebody with nothing', () => {
        const climbing = them({ ordinal: 34, goals: [goal({ kind: 'cultivation' })] });
        const nobody = you({ holds: ['iron-bell-body'] });
        expect(whatTheyWantThatYouCouldReach(climbing, nobody)?.because).toBe('your_shelf');
    });

    it('does not fire when they already hold everything the asker does', () => {
        const climbing = them({
            holds: ['iron-bell-body'],
            goals: [goal({ kind: 'cultivation' })]
        });
        expect(whatTheyWantThatYouCouldReach(climbing, you({ holds: ['iron-bell-body'] })))
            .toBeNull();
    });

    it('reads a rank rather than a rung for a goal about standing', () => {
        const climbing = them({ factionId: null, goals: [goal({ kind: 'status' })] });
        expect(whatTheyWantThatYouCouldReach(climbing, you({ ranked: true, factionId: 'iron-bell' }))?.because)
            .toBe('your_house');
        // A badge with no rank behind it is not somebody who matters locally.
        expect(whatTheyWantThatYouCouldReach(climbing, you({ ranked: false, factionId: 'iron-bell' })))
            .toBeNull();
        // And their own house is not somebody else's regard.
        expect(whatTheyWantThatYouCouldReach(
            them({ factionId: 'iron-bell', goals: [goal({ kind: 'status' })] }),
            you({ ranked: true, factionId: 'iron-bell' })
        )).toBeNull();
    });

    it('never reads the gap in rung, in either direction', () => {
        const wanting = them({ ordinal: 3, goals: [goal({ kind: 'cultivation' })] });
        // Standing far above them buys nothing at all on its own.
        expect(whatTheyWantThatYouCouldReach(wanting, you())).toBeNull();
        // And standing far below them costs nothing, once something is carried.
        expect(whatTheyWantThatYouCouldReach(wanting, you({ holds: ['a-road'] }))?.because)
            .toBe('your_shelf');
    });

    it('answers with the goal they have held longest at the top priority', () => {
        const many = them({
            ordinal: 0,
            goals: [
                goal({ id: 'g-old', kind: 'wealth', priority: 0.6, openedOnDay: 10 }),
                goal({ id: 'g-new', kind: 'wealth', priority: 0.6, openedOnDay: 900 })
            ]
        });
        const reach = whatTheyWantThatYouCouldReach(
            many, you({ spiritStones: Math.ceil(earningsPerYear(0)) })
        );
        expect(reach?.goal.id).toBe('g-old');
    });

    it('nobody is their own lever', () => {
        const self = them({ id: 'you', goals: [goal({ targetId: 'you' })] });
        expect(whatTheyWantThatYouCouldReach(self, you())).toBeNull();
    });

    it('reads open rows off a real record, including blocked ones', () => {
        let npc = createNpc('seed', { id: 'npc-1', bornOnDay: 0, onDay: 0 });
        npc = addGoal(npc, { kind: 'wealth', text: 'Money.', priority: 0.4 }, 0);
        npc = addGoal(npc, { kind: 'revenge', text: 'A killing.', priority: 0.9 }, 0);
        const open = goalsHeldBy(npc);
        expect(open.map(g => g.kind)).toEqual(['revenge', 'wealth']);
    });
});

/**
 * The same rows, read from the market.
 *
 * The design owner's ruling is that this is ONE model seen from two sides, so
 * these tests share the fixtures above deliberately: if the ask side and the
 * price side ever need different rows, the shape has gone wrong.
 *
 * And there is no list of reasons to test. What is pinned is that the SHAPE
 * holds - direction from holding, urgency from the deadline, discretion above
 * both - for a want the file has never heard of.
 */
describe('the same need, seen from the market', () => {
    const singular = { significance: 'significant', forOrdinal: 20 } as const;

    it('leaves counted stock alone entirely', () => {
        const needy = them({ ordinal: 20, goals: [goal({ kind: 'survival' })] });
        expect(whatTheirNeedDoesToThePriceOf(
            needy, { significance: 'mundane', forOrdinal: 20 }, false, 0
        )).toBeNull();
    });

    it('makes somebody who has not got it pay above the going rate', () => {
        const needy = them({ ordinal: 20, goals: [goal({ kind: 'survival', priority: 1 })] });
        const read = whatTheirNeedDoesToThePriceOf(needy, singular, false, 0);
        expect(read?.effect).toBe('pays_above_the_going_rate');
        expect(read?.multiplier).toBeCloseTo(MOST_A_NEED_BENDS_A_PRICE);
    });

    it('reads the elasticity off priority and off nothing else', () => {
        const mild = them({ ordinal: 20, goals: [goal({ kind: 'survival', priority: 0 })] });
        expect(whatTheirNeedDoesToThePriceOf(mild, singular, false, 0)?.multiplier).toBeCloseTo(1);
    });

    it('a present need is a refusal at any price', () => {
        const dying = them({
            ordinal: 20,
            goals: [goal({ kind: 'protection', deadlineOnDay: 100 })]
        });
        expect(whatTheirNeedDoesToThePriceOf(dying, singular, true, 0)?.effect)
            .toBe('will_not_part_with_it_at_any_price');
    });

    it('a reserved need is a price nobody has met yet', () => {
        const putBy = them({
            ordinal: 20,
            goals: [goal({ kind: 'protection', deadlineOnDay: null })]
        });
        expect(whatTheirNeedDoesToThePriceOf(putBy, singular, true, 0)?.effect)
            .toBe('held_against_a_need_not_yet_come');
        // And a deadline far enough out is a store put by, not an emergency.
        const distant = them({
            ordinal: 20,
            goals: [goal({ kind: 'protection', deadlineOnDay: A_NEED_IS_PRESENT_WITHIN_DAYS + 2 })]
        });
        expect(whatTheirNeedDoesToThePriceOf(distant, singular, true, 0)?.effect)
            .toBe('held_against_a_need_not_yet_come');
    });

    it('says there is no trade at all where the answer was not theirs to give', () => {
        const dying = them({
            ordinal: 20,
            goals: [goal({ kind: 'protection', deadlineOnDay: 100 })]
        });
        const read = whatTheirNeedDoesToThePriceOf(dying, singular, true, 0, false);
        expect(read?.effect).toBe('the_answer_is_not_theirs_to_give');
        expect(read?.goal).toBeNull();
    });

    it('ignores a thing made far beneath the person holding it', () => {
        const high = them({ ordinal: 40, goals: [goal({ kind: 'survival' })] });
        const beneath = {
            significance: 'significant',
            forOrdinal: 40 - HOW_FAR_BENEATH_THEM_IT_MAY_BE - 1
        } as const;
        expect(whatTheirNeedDoesToThePriceOf(high, beneath, false, 0)).toBeNull();
    });

    it('answers a want it has never heard of, which is the whole point', () => {
        // `reunion` appears in no table in the module. It works because the
        // model reads the row rather than a list of cases.
        const looking = them({ ordinal: 20, goals: [goal({ kind: 'reunion', priority: 0.5 })] });
        expect(whatTheirNeedDoesToThePriceOf(looking, singular, false, 0)?.effect)
            .toBe('pays_above_the_going_rate');
    });

    it('leaves a want money answers to money', () => {
        const broke = them({ ordinal: 20, goals: [goal({ kind: 'wealth' })] });
        expect(whatTheirNeedDoesToThePriceOf(broke, singular, false, 0)).toBeNull();
    });
});

/**
 * WHERE A DATE ON A WANT COMES FROM.
 *
 * Found by playing: nothing in this world has ever written a `deadlineOnDay`.
 * Not `goalFor` in the seeder, not `openAmbition`, not the birth goal. So the
 * present/reserved split - the design owner's central distinction - had no
 * present side at all, and the one case they cared about most could not occur.
 *
 * A module nothing calls is this project's oldest defect. This is the same
 * failure one size smaller: **a field nothing writes**, which reads even more
 * like a finished feature because the schema, the predicate and the tests are
 * all correct and the column is empty.
 *
 * What is pinned here is that the date is DERIVED and therefore cannot go
 * stale, and that nothing in the derivation asks what the want is.
 */
describe('a want acquires its date from the clocks its people are under', () => {
    const clocks = (over: Partial<TheClocksSomebodyIsUnder> = {}): TheClocksSomebodyIsUnder => ({
        ordinal: 0,
        lastAdvancedOnDay: 0,
        lifespanEndsOnDay: 100 * 365,
        ...over
    });

    it('dates an undated want by the soonest clock its holder is under', () => {
        // Qi Condensation: a fifty-year plateau, which lands long before a
        // hundred-year body does.
        const runsOut = whenThisWantRunsOut(goal(), clocks());
        expect(runsOut).toBe(theDayTheClimbRunsOut(clocks()));
        expect(runsOut).toBeLessThan(100 * 365);
    });

    it('takes the body where the body runs out first', () => {
        const old = clocks({ lifespanEndsOnDay: 400 });
        expect(whenThisWantRunsOut(goal(), old)).toBe(400);
    });

    it('lets an authored date win, because an authored fact beats a derived one', () => {
        expect(whenThisWantRunsOut(goal({ deadlineOnDay: 77 }), clocks())).toBe(77);
    });

    it('dates a want about somebody else by THAT person, the case the owner named', () => {
        // The holder has decades. The person it is about has months.
        const child = clocks({ lifespanEndsOnDay: 200 });
        expect(whenThisWantRunsOut(goal({ targetId: 'the-child' }), clocks(), child)).toBe(200);
    });

    it('says nothing where there is no clock to read, rather than guessing', () => {
        expect(whenThisWantRunsOut(goal(), null, null)).toBeNull();
        expect(aWantThatCannotWait(goal(), null, null, 0)).toBe(false);
    });

    it('is the plateau and not the calendar that makes a want urgent', () => {
        // Two people, same want, same age of want. One advanced last year and
        // one is at the end of what the realm allows.
        const fresh = clocks({ lastAdvancedOnDay: 40 * 365 });
        const stuck = clocks({ lastAdvancedOnDay: 0 });
        const today = 49 * 365;
        expect(aWantThatCannotWait(goal(), stuck, null, today)).toBe(true);
        expect(aWantThatCannotWait(goal(), fresh, null, today)).toBe(false);
    });

    it('never asks what the want is', () => {
        // The same clocks, six different kinds, one answer. If a kind ever
        // changes this, a list has grown back.
        const stuck = clocks({ lastAdvancedOnDay: 0 });
        const today = 49 * 365 + 200;
        const kinds = ['cultivation', 'revenge', 'protection', 'reunion', 'discovery', 'other'] as const;
        for (const kind of kinds) {
            expect(aWantThatCannotWait(goal({ kind }), stuck, null, today), kind).toBe(true);
        }
    });

    it('drives the market reading, so a pressing want is a refusal at any price', () => {
        const singular = { significance: 'significant', forOrdinal: 20 } as const;
        const stuck = clocks({ ordinal: 20, lastAdvancedOnDay: 0 });
        const today = theDayTheClimbRunsOut(stuck) - 30;
        const desperate = them({
            ordinal: 20, goals: [goal({ kind: 'protection' })], clocks: stuck
        });
        expect(whatTheirNeedDoesToThePriceOf(desperate, singular, true, today)?.effect)
            .toBe('will_not_part_with_it_at_any_price');

        // The same person, the same want, earlier in the plateau.
        expect(whatTheirNeedDoesToThePriceOf(desperate, singular, true, 0)?.effect)
            .toBe('held_against_a_need_not_yet_come');
    });
});
