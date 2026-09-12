/**
 * Thirteen lanes over the whole verb surface.
 *
 * Measured over 744 played turns: the three verbs carrying no intent axis
 * produced 63% of everything the game came back unable to answer - `interact`
 * refused 150 of 162, `move` 20 of 20, `unclear` 186 - while every verb that
 * DID carry one refused nothing at all, `sect` 19/19, `look` 33/33,
 * `status` 36/36, `market`, `teacher`, `ceiling`, `list_techniques`.
 *
 * So the reader's difficulty was never the number of verbs. It was being asked
 * for one label out of the whole flat list, several of which fit the same
 * sentence. A lane is the outer choice and the intent is the inner one, and the
 * engine still decides everything after that.
 */

import { describe, expect, it } from 'vitest';
import { LANE_NAMES, THE_LANES, isALane, theVerbForThisLane } from '../../src/web/the-lanes-a-sentence-can-go-down';
import { validatePlan } from '../../src/web/planned-action';
import { ACTION_NAMES } from '../../src/web/action-set';

describe('a lane is a choice a model can make', () => {
    it('offers far fewer choices than the action set', () => {
        expect(LANE_NAMES.length).toBeLessThan(ACTION_NAMES.length / 3);
    });

    /**
     * The read family is the point. Ten verbs that never refused, and a player
     * who wanted to know what they were carrying had to be routed to whichever
     * one the engine happened to file the fact under.
     */
    it('puts every question about yourself in one lane', () => {
        const consult = THE_LANES.consult.intents;
        for (const verb of ['status', 'inventory', 'list_techniques', 'ceiling', 'teacher',
            'destinations', 'roads', 'recall', 'acquisition', 'news']) {
            expect(Object.values(consult), verb).toContain(verb);
        }
    });

    it('expands a lane and an intent to a verb the engine already has', () => {
        expect(theVerbForThisLane('consult', 'carried')).toBe('inventory');
        expect(theVerbForThisLane('travel', 'ride')).toBe('ride');
        expect(theVerbForThisLane('fight', 'strike')).toBe('attack');
        expect(theVerbForThisLane('house', 'join')).toBe('sect');
    });

    /**
     * A model that picked the right lane and a wrong word for the detail has
     * still said most of what the engine needed, so it lands rather than
     * refusing.
     */
    it('takes the lane ordinary reading when the intent is not one it carries', () => {
        expect(theVerbForThisLane('consult', 'what am I wearing')).toBe('status');
        expect(theVerbForThisLane('travel', undefined)).toBe('move');
    });

    it('names only verbs the action set actually has', () => {
        for (const lane of LANE_NAMES) {
            for (const verb of Object.values(THE_LANES[lane].intents)) {
                expect(ACTION_NAMES, `${lane} points at ${verb}`).toContain(verb);
            }
            expect(ACTION_NAMES).toContain(THE_LANES[lane].otherwise);
        }
    });

    it('knows a lane from anything else', () => {
        expect(isALane('consult')).toBe(true);
        expect(isALane('inventory')).toBe(false);
    });

    /**
     * Nothing downstream of the router knows lanes exist: by the time the
     * schema sees the object it carries an `action` like any other.
     */
    it('reaches the engine as an ordinary plan', () => {
        const said = validatePlan({ lane: 'consult', intent: 'carried', reason: 'asked' });
        expect(said.ok).toBe(true);
        if (said.ok) expect(said.action.action).toBe('inventory');
    });

    /** A response that named a verb outright still works, table readings included. */
    it('leaves a plan that named its verb alone', () => {
        const said = validatePlan({ action: 'cultivate', days: 30, reason: 'sat down' });
        expect(said.ok).toBe(true);
        if (said.ok) expect(said.action.action).toBe('cultivate');
    });
});
