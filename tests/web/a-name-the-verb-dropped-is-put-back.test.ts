/**
 * A name the player wrote survives a verb that lost it - for every verb.
 *
 * Measured at 16% of turns arriving with a bare target: the verb chosen
 * correctly and the person it was against gone. Half of those were `coerce`
 * and had a different cause, since fixed at the root - `validatePlan` was
 * deleting the target because `coerce` was missing from `TARGETED_ACTIONS`.
 * The rest are spread thinly across verbs, which is the harder half to find by
 * playing, and this is the pass that answers them.
 *
 * `attack` used to recover it for itself and nothing else did. The recovery
 * now lives in `carryWhatOnlyTheSentenceKnows` with the roster supplied by the
 * dispatch, which is the only caller that holds the room - so there is one
 * mechanism rather than one per verb that happened to need it.
 *
 * ── WHAT IS PINNED HERE IS THE TWO PROPERTIES ────────────────────────────
 *
 * They are what make it safe to widen from one verb to forty-four, and
 * loosening either turns this into a machine for acting on people nobody
 * named - at 16% of turns, far more often than it would help.
 *
 *   NOT KNOWLEDGE-GATED. The player supplied the name. Nothing is revealed
 *   that they did not write down themselves, so this is a recovery rather
 *   than a lookup, and it needs no discovery check.
 *
 *   NO GUESSING. Whole words, exact, one person or nobody. Two different
 *   people named is null - not the nearer one, not the first one.
 */

import { describe, expect, it } from 'vitest';

import { carryWhatOnlyTheSentenceKnows } from '../../src/web/planned-action.js';
import type { PlannedAction } from '../../src/web/planned-action.js';
import { TARGETED_ACTIONS } from '../../src/web/action-set.js';

const ROOM = [
    { id: 'npc-1', name: 'Ru Anwei' },
    { id: 'npc-2', name: 'Ru' },
    { id: 'npc-3', name: 'Cao Antao' }
];

const bare = (action: string): PlannedAction => ({ action } as PlannedAction);

describe('a name the verb dropped is put back', () => {
    /**
     * THE GENERALISATION. `interact` and `give` never had this and are the
     * ordinary case: a verb that takes a target, arriving without one, over a
     * sentence that names somebody standing there.
     */
    it.each([
        ['interact', 'I speak to Cao Antao about the road'],
        ['give', 'I hand Cao Antao the manual'],
        ['investigate', 'I take a close look at Cao Antao'],
        ['assess', 'I size Cao Antao up']
    ])('recovers the name for %s', (action, said) => {
        expect(carryWhatOnlyTheSentenceKnows(bare(action), said, ROOM).target).toBe('Cao Antao');
    });

    /** And still for the verb that used to do it alone. */
    it('recovers the name for coerce, which used to do this for itself', () => {
        const plan = carryWhatOnlyTheSentenceKnows(
            bare('coerce'), 'I coerce Ru Anwei into handing over her stuff', ROOM
        );
        expect(plan.target).toBe('Ru Anwei');
    });

    /**
     * A verb with nowhere to put a person does not acquire one.
     *
     * ── AND THIS ONE IS A SEAM BETWEEN TWO CHANGES ───────────────────────
     *
     * `cultivate` grew a `target` at the same time as this pass landed, and it
     * means somebody named as SITTING THE STRETCH WITH YOU - a dao partner.
     * The recovery is gated on `TARGETED_ACTIONS`, which `cultivate` is not
     * in, so the two do not touch today.
     *
     * If it is ever added there, this recovery starts reading any name in the
     * sentence as a partner, and "I sit and cultivate while Cao Antao watches"
     * becomes a shared sitting with a man who was watching. That is not a bug
     * in either change; it is the seam between them, and it is pinned here
     * rather than left for somebody to find in play.
     */
    it('does not give a target to a verb that does not take one', () => {
        const plan = carryWhatOnlyTheSentenceKnows(
            bare('cultivate'), 'I sit and cultivate while Cao Antao watches', ROOM
        );
        expect(plan.target).toBeUndefined();
        expect(
            TARGETED_ACTIONS.includes('cultivate'),
            'cultivate has been added to TARGETED_ACTIONS. A bystander named in the sentence '
            + 'will now be recovered as the person sitting the stretch with the player. Either '
            + 'exclude it from the recovery or gate the shared sitting on something narrower '
            + 'than "a name appears in the sentence".'
        ).toBe(false);
    });

    it('never overwrites a target that survived', () => {
        const plan = carryWhatOnlyTheSentenceKnows(
            { action: 'interact', target: 'Ru Anwei' } as PlannedAction,
            'I speak to Cao Antao',
            ROOM
        );
        expect(plan.target).toBe('Ru Anwei');
    });

    /**
     * NO GUESSING, and this is the assertion that matters most. Two different
     * people named is a sentence the engine has no business picking a victim
     * out of.
     */
    it('recovers nobody when the sentence names two people', () => {
        const plan = carryWhatOnlyTheSentenceKnows(
            bare('interact'), 'I tell Cao Antao what Ru Anwei said', ROOM
        );
        expect(plan.target).toBeUndefined();
    });

    /** Whole words only, or a large roster starts matching inside names. */
    it('does not match a name inside another word', () => {
        const plan = carryWhatOnlyTheSentenceKnows(
            bare('interact'), 'I ask about the ruins', [{ id: 'npc-9', name: 'Rui' }]
        );
        expect(plan.target).toBeUndefined();
    });

    /**
     * Longest wins, which is the player being specific rather than naming two
     * people: "Ru Anwei" also matches the "Ru" standing beside her.
     */
    it('prefers the full name over a shorter one inside it', () => {
        const plan = carryWhatOnlyTheSentenceKnows(
            bare('interact'), 'I speak to Ru Anwei', ROOM
        );
        expect(plan.target).toBe('Ru Anwei');
    });

    /** A possessive is the commonest way a player names somebody. */
    it('survives a possessive', () => {
        const plan = carryWhatOnlyTheSentenceKnows(
            bare('interact'), "I ask about Cao Antao's debt", ROOM
        );
        expect(plan.target).toBe('Cao Antao');
    });

    /**
     * THE PLACEMENT, WHICH IS DELIBERATE AND IS THE ONE EXCEPTION IN THIS
     * FUNCTION.
     *
     * Every other field is carried only when both readings agree on the verb,
     * because a `leverage` read off a sentence the table understood as a
     * different action is a fact about a different action. A NAME is not like
     * that: the matcher reads the raw sentence rather than any parse of it,
     * and somebody the player named is named however the rest was read.
     */
    it('carries the name even where the two readings disagree on the verb', () => {
        const said = 'I speak to Cao Antao about the road';
        const asIfAModelPickedAnotherVerb = bare('investigate');
        expect(
            carryWhatOnlyTheSentenceKnows(asIfAModelPickedAnotherVerb, said, ROOM).target
        ).toBe('Cao Antao');
    });

    /**
     * And the callers with no room in scope are unchanged. The narrator and
     * the sentence splitter both call this without a roster; they must go on
     * carrying every other field and simply not recover a name.
     */
    it('changes nothing for a caller that has no roster', () => {
        const said = 'I threaten the steward into handing over the ledger';
        const withoutARoom = carryWhatOnlyTheSentenceKnows(bare('interact'), said);
        expect(withoutARoom.target).toBeUndefined();
        // The fields that never needed a room still arrive.
        expect(withoutARoom.leverage).toBeDefined();
    });
});
