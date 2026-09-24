/**
 * What a house's relation kind and its parent must agree about.
 *
 * FIXES NOTHING TODAY. It passes on all 38 houses and is written as a guard
 * rather than a repair, which is the good kind: it cost an hour of two agents
 * and two rulings from the design owner to establish that this table was clean,
 * and this check would have said so in one second.
 *
 * The rule in words, because the field names do not say which half to fix:
 *
 *   AN APEX IS THE TOP OF A CHAIN, so a parent on one is either a fossil - a
 *   relationship that ended and was recorded in the present tense - or a mistake
 *   about which kind of house it is.
 *
 *   A SUBSIDIARY WITH NO PARENT answers to somebody nobody named, which is the
 *   mirror of the same defect: the relation kind asserts a link the data does
 *   not carry.
 *
 * `unaffiliated` and `bloodline` are deliberately unasserted. A house that holds
 * from nobody is the ordinary case and says so by having no parent; a bloodline
 * is a family's own arrangement and the catalog uses it both ways.
 *
 * ── THE STORY THIS GUARDS, WHICH IS WORTH KNOWING ────────────────────────
 *
 * The Azure Cloud Pavilion's prose says it *"was a Third Sill tenant for fifteen
 * hundred years and stopped being one in the year Ru Anjing crossed"* - so a
 * reader meeting that sentence beside a `parentFactionId` of `court-third-sill`
 * would have every reason to think the data was recording history in a current
 * field. It is not: the Pavilion's row is `apex` with no parent and always was.
 * What produced the scare was a FIXTURE house, `sect-azure-cloud`, which
 * legitimately answers to the Third Sill and differs from the real
 * `sect-azure-cloud-pavilion` by its id alone.
 */

import { describe, expect, it } from 'vitest';

import { FACTION_PARENTAGE } from '../../src/data/cultivation/governance-and-water-rights.js';

/** Relation kinds that assert a house above this one, so a parent is required. */
const HOLDS_FROM_SOMEBODY = ['subsidiary', 'court', 'administration', 'contracted'];

describe('a relation kind and a parent say the same thing or the table is wrong', () => {
    it('gives no apex a parent, because an apex is the top of its chain', () => {
        const parented = Object.values(FACTION_PARENTAGE)
            .filter(row => row.relation === 'apex' && row.parentFactionId !== null)
            .map(row => `${row.factionId} holds from ${row.parentFactionId}`);
        expect(parented,
            'an apex with a parent is either a fossil or a house filed under the wrong kind')
            .toEqual([]);
    });

    it('gives every house that holds from somebody a somebody to hold from', () => {
        const orphans = Object.values(FACTION_PARENTAGE)
            .filter(row => HOLDS_FROM_SOMEBODY.includes(row.relation) && row.parentFactionId === null)
            .map(row => `${row.factionId} is ${row.relation} and names nobody`);
        expect(orphans, 'a subsidiary with no parent answers to somebody nobody named')
            .toEqual([]);
    });

    it('names a parent that is itself a house in the table', () => {
        const dangling: string[] = [];
        for (const row of Object.values(FACTION_PARENTAGE)) {
            const parent = row.parentFactionId;
            if (parent === null) continue;
            // Apexes and courts are carried under their own ids elsewhere in the
            // catalog; what must not happen is a parent nothing anywhere names.
            if (FACTION_PARENTAGE[parent] !== undefined) continue;
            if (parent.startsWith('apex-') || parent.startsWith('court-')) continue;
            dangling.push(`${row.factionId} holds from ${parent}, which is nobody`);
        }
        expect(dangling, 'a house cannot answer to somebody the world does not have').toEqual([]);
    });
});
