/**
 * A body kept walking after the part that would say no is gone.
 *
 * The far end of the axis the poison sits on: one puts a soul out and the body
 * with it, the other hollows one and keeps the body. What is pinned here is
 * mostly the absences - there is no refusal step, no roll, no cost and no
 * fourth answer where a held body declines, because declining is what was
 * taken out.
 */

import { describe, expect, it } from 'vitest';

import {
    takeTheHandOff,
    tagForHolder,
    whatAHeldBodyDoesWith,
    whatBeingMadeIntoAThingOpens,
    whatTheHandLeaves,
    whatTheHollowingLeaves,
    whoseHandThisBodyIsUnder
} from '../../../src/engine/social/a-body-under-somebody-elses-hand.js';
import { whatASoulSearchTakes } from '../../../src/engine/social/what-a-soul-search-takes.js';

const THEM = { soulState: 'intact' as const, identityContinuity: 1, tags: ['courier'] };

describe('what the pill leaves', () => {
    it('hollows without appointing anybody', () => {
        const after = whatTheHollowingLeaves(THEM);
        expect(after.soulState).toBe('fragmented');
        expect(after.identityContinuity).toBe(0);
        expect(whoseHandThisBodyIsUnder(after.tags)).toBeNull();
        // Everything else about them survives. They are emptied, not replaced.
        expect(after.tags).toContain('courier');
    });

    it('puts them under a hand when somebody put it in them', () => {
        const after = whatTheHandLeaves(THEM, 'npc-holder');
        expect(whoseHandThisBodyIsUnder(after.tags)).toBe('npc-holder');
        expect(after.identityContinuity).toBe(0);
    });

    it('holds one hand at a time', () => {
        const first = whatTheHandLeaves(THEM, 'npc-a');
        const second = whatTheHandLeaves(first, 'npc-b');
        expect(second.tags.filter(t => t.startsWith('held_by:'))).toEqual([tagForHolder('npc-b')]);
    });

    /**
     * FREEING SOMEBODY IS NOT RESTITUTION. IT IS STOPPING. The hand comes off
     * and the hollowing does not, which is the whole reason the ledger row is
     * what it is.
     */
    it('takes the hand off without giving them back', () => {
        const freed = takeTheHandOff(whatTheHandLeaves(THEM, 'npc-holder'));
        expect(whoseHandThisBodyIsUnder(freed.tags)).toBeNull();
        expect(freed.soulState).toBe('fragmented');
        expect(freed.identityContinuity).toBe(0);
    });

    /**
     * AND IT FALLS OUT THAT A HELD BODY HAS NOTHING TO READ. Nobody arranged
     * this: `identityContinuity` at zero already reads as `nothing_left`.
     * Somebody who hollows a courier to walk them home has also destroyed what
     * the courier knew.
     */
    it('leaves nothing for a soul search to find', () => {
        const after = whatTheHandLeaves(THEM, 'npc-holder');
        const search = whatASoulSearchTakes({
            searcherOrdinal: 44,
            subjectOrdinal: 14,
            subject: after,
            held: [{
                id: 'k1', claimKey: 'c', statement: 's',
                stance: 'knows', confidence: 0.9, stage: 'known'
            }]
        });
        expect(search.why).toBe('nothing_left');
        expect(search.took).toEqual([]);
    });
});

describe('what a held body does with an instruction', () => {
    /** There is nothing between the instruction and the act. */
    it('does it, with nothing in between', () => {
        const held = whatTheHandLeaves(THEM, 'npc-holder');
        expect(whatAHeldBodyDoesWith(held.tags, 'npc-holder')).toBe('it_happens');
    });

    it('is nobody else\'s to instruct', () => {
        const held = whatTheHandLeaves(THEM, 'npc-holder');
        expect(whatAHeldBodyDoesWith(held.tags, 'npc-someone-else')).toBe('held_by_another');
    });

    it('leaves everybody who is their own alone', () => {
        expect(whatAHeldBodyDoesWith(THEM.tags, 'npc-holder')).toBe('their_own');
    });

    /**
     * THE ABSENCE THAT IS THE VERB. Three answers and no fourth. Nothing here
     * weighs an instruction, because weighing is what was taken out - so there
     * is no rung, no standing, no loyalty and no roll anywhere in the inputs.
     */
    it('takes nothing that could be weighed', () => {
        expect(whatAHeldBodyDoesWith.length).toBe(2);
        const answers = new Set([
            whatAHeldBodyDoesWith(THEM.tags, 'a'),
            whatAHeldBodyDoesWith(whatTheHandLeaves(THEM, 'a').tags, 'a'),
            whatAHeldBodyDoesWith(whatTheHandLeaves(THEM, 'a').tags, 'b')
        ]);
        expect(answers).toEqual(new Set(['their_own', 'it_happens', 'held_by_another']));
    });
});

describe('the row the ledger opens', () => {
    const opened = whatBeingMadeIntoAThingOpens({
        victimId: 'npc-victim',
        holderId: 'npc-holder',
        holderName: 'Ru Anwei',
        victimName: 'Cao Antao',
        onDay: 400
    });

    /**
     * Not computed from anything. Every other severity here is priced by
     * degree; there is no amount of being made into a thing that is a slight
     * version of it.
     */
    it('is unforgivable and is not a matter of degree', () => {
        expect(opened.severity).toBe('unforgivable');
        expect(opened.cause).toBe('violated');
        expect(opened.kind).toBe('grudge');
    });

    /** Held by them, like every other wrong. */
    it('is held by the person it was done to', () => {
        expect(opened.holderId).toBe('npc-victim');
        expect(opened.subjectId).toBe('npc-holder');
    });

    /**
     * Keyed on the cause, so it sits beside whatever else the holder has done
     * to them rather than overwriting it - and so that doing it twice is one
     * standing fact rather than two.
     */
    it('is one account however many times it happens', () => {
        const again = whatBeingMadeIntoAThingOpens({
            victimId: 'npc-victim', holderId: 'npc-holder',
            holderName: 'Ru Anwei', victimName: 'Cao Antao', onDay: 900
        });
        expect(again.id).toBe(opened.id);
    });

    it('says the holding is over before it says the person is back', () => {
        expect(opened.tags).toContain('irreversible:identity');
    });
});
