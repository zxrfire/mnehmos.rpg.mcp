/**
 * Being worth a rung and being a weapon are different facts.
 *
 * Every finished artifact carries an ordinal - that is what an ordinal is, and
 * `possessions.ts` states the rule - so "the strongest object this person is
 * holding" stopped meaning "the best thing they would raise in a fight" the
 * moment the ordinal population was completed. A carriage was already excluded
 * by name; the general form was not stated anywhere.
 *
 * The case that made it urgent: a departure talisman cut by a hand at 32 stands
 * at 32. Swinging it is not what it is for. It was dormant only because nothing
 * yet puts one in anybody's hands, and a dormant hazard is a hazard.
 */

import { describe, expect, it } from 'vitest';
import { isSomethingYouWouldSwing } from '../../../src/engine/world/gatherings';
import { cutATalisman } from '../../../src/engine/world/a-talisman-is-one-act-somebody-already-paid-for';
import { makeObject } from '../../../src/engine/world/possessions';

function aSlip(what: 'a_strike' | 'a_way_out') {
    return cutATalisman({
        id: `slip-${what}`,
        name: 'a slip',
        grade: 'earth',
        what,
        crafterId: null,
        crafterOrdinal: 32,
        onDay: 0
    });
}

describe('what somebody would raise in a fight', () => {
    it('a sword, which is the ordinary case', () => {
        expect(isSomethingYouWouldSwing(makeObject({
            id: 'sword', name: 'a sword', kind: 'artifact', power: 30
        }))).toBe(true);
    });

    it('not a slip, whichever act is folded into it', () => {
        // Both stand at 32 and neither is a weapon slot. A strike slip is used
        // once and gone, which is a different move from carrying a thing into
        // every exchange.
        for (const what of ['a_strike', 'a_way_out'] as const) {
            const slip = aSlip(what);
            expect(slip.power).not.toBeNull();
            expect(isSomethingYouWouldSwing(slip)).toBe(false);
        }
    });

    it('not a carriage, which was the only case anybody had written down', () => {
        expect(isSomethingYouWouldSwing(makeObject({
            id: 'boat', name: 'a spirit boat', kind: 'artifact', power: 40,
            tags: ['conveyance']
        }))).toBe(false);
    });

    it('and not a thing that stands where it was made', () => {
        expect(isSomethingYouWouldSwing(makeObject({
            id: 'array', name: 'a formation', kind: 'formation', power: 44
        }))).toBe(false);
        expect(isSomethingYouWouldSwing(makeObject({
            id: 'ground', name: 'a holding', kind: 'territory', power: 20
        }))).toBe(false);
    });

    it('and the rung it stands at never decides it', () => {
        // The whole claim: a slip at the top of the ladder is still not a
        // weapon, and a plain sword at the bottom still is.
        const mighty = cutATalisman({
            id: 'slip-high', name: 'a slip', grade: 'heaven', what: 'a_strike',
            crafterId: null, crafterOrdinal: 46, onDay: 0
        });
        const humble = makeObject({ id: 'iron', name: 'an iron sword', kind: 'artifact', power: 1 });
        expect(isSomethingYouWouldSwing(mighty)).toBe(false);
        expect(isSomethingYouWouldSwing(humble)).toBe(true);
    });
});
