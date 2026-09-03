/**
 * What the outside of a grave tells anybody who stops and reads it.
 *
 * The design owner's questions about a tomb, in the owner's own order:
 *
 *   "A TOMB? WHAT CULTIVATION LEVEL IS THE EXPERT? IS THERE A TRIAL!!!? GO GO
 *    GO!!!"
 *
 * The second is the load-bearing one, and the engine already held the answer -
 * `Grave.occupantOrdinal` is on the pre-entry face, ungated, because the rank is
 * cut into the lintel. What it printed was `"at ordinal 44"`.
 *
 * And `WHAT_THE_LIGHTNING_TOOK` / `GRAVE_CONTENTS_BANDS` had zero readers
 * outside the file that declares them, so the setting's sharpest ruling about
 * tombs - the one that runs opposite to intuition - had never once been said to
 * a player.
 */

import {
    headstoneStructure,
    whatTheStoneSays,
    type HeadstoneFacts
} from '../../src/web/headstone-reading';
import {
    GRAVES,
    GRAVE_CONTENTS_BANDS,
    MannerOfDeathSchema,
    BurialSchema
} from '../../src/data/cultivation/inheritance-trials';

function stone(over: Partial<HeadstoneFacts> = {}): HeadstoneFacts {
    return {
        mannerOfDeath: 'old_age',
        burial: 'interred_by_a_sect',
        occupantOrdinal: 44,
        yearsDead: 160,
        ...over
    };
}

describe('what cultivation level the expert was', () => {
    /**
     * Every other surface in the package puts a rung through `rankName`. This
     * one printed the column.
     */
    it('names the rung rather than printing the ordinal', () => {
        const said = whatTheStoneSays(stone()).join(' ');
        expect(said).toContain('Tribulation Transcendence Perfection');
        expect(said).not.toMatch(/ordinal/i);
    });

    /** The number is kept where an operator sorts on it, and only there. */
    it('keeps the number in the mechanical channel', () => {
        const line = headstoneStructure(stone());
        expect(line).toContain('ordinal 44');
        expect(line).toContain('Tribulation Transcendence Perfection');
    });

    it('says how they died and what became of them, in words rather than in enums', () => {
        const said = whatTheStoneSays(stone({ burial: 'left_where_they_fell' })).join(' ');
        expect(said).not.toMatch(/_/);
        expect(said).toContain('Nobody came for the body');
    });

    /**
     * A widened type would let a new manner of death or burial ship with no
     * sentence for it, which is how a fallback written in ordinary English
     * becomes invisible.
     */
    it('has a sentence for every value both enums can take', () => {
        for (const manner of MannerOfDeathSchema.options) {
            for (const burial of BurialSchema.options) {
                const said = whatTheStoneSays(stone({ mannerOfDeath: manner, burial })).join(' ');
                expect(said, `${manner}/${burial}`).not.toMatch(/undefined|_/);
                expect(said.length, `${manner}/${burial}`).toBeGreaterThan(80);
            }
        }
    });
});

describe('what the lightning took', () => {
    /**
     * The ruling runs opposite to intuition: a tribulation grave is a short list
     * of proven things, and anybody who died in bed leaves a full inventory that
     * nothing has ever tested. The bands are the catalog's own table.
     */
    // Asserted THROUGH the function the game calls rather than through an
    // exported mapping only this file would read: an export a test is the sole
    // reader of is a rule that looks maintained and is reached by nobody.
    const profileIn = (manner: HeadstoneFacts['mannerOfDeath']) =>
        /GRAVE_CONTENTS_BANDS\.(\w+):/.exec(headstoneStructure(stone({ mannerOfDeath: manner })))?.[1];

    it('reads the profile off the manner of death, the way the table says', () => {
        expect(profileIn('heavenly_tribulation')).toBe('tribulation');
        expect(profileIn('failed_crossing')).toBe('tribulation');
        for (const manner of ['old_age', 'duel', 'killed_in_a_fight', 'died_of_injuries'] as const) {
            expect(profileIn(manner), manner).toBe('intact');
        }
    });

    it('tells opposite stories about a tribulation grave and a quiet one', () => {
        const struck = whatTheStoneSays(stone({ mannerOfDeath: 'heavenly_tribulation' })).join(' ');
        const abed = whatTheStoneSays(stone({ mannerOfDeath: 'old_age' })).join(' ');
        expect(struck).toMatch(/short list/);
        expect(abed).toMatch(/Nothing tested what they had/);
        expect(struck).not.toBe(abed);
    });

    /** The one case with no body at all, and the shortest list in the world. */
    it('says there is no body where the last crossing failed', () => {
        const said = whatTheStoneSays(stone({ mannerOfDeath: 'failed_crossing' })).join(' ');
        expect(said).toMatch(/no body/);
    });

    it('quotes the band off the same table the entries were authored from', () => {
        const line = headstoneStructure(stone({ mannerOfDeath: 'heavenly_tribulation' }));
        expect(line).toContain(`${GRAVE_CONTENTS_BANDS.tribulation.minItems}-${GRAVE_CONTENTS_BANDS.tribulation.maxItems}`);
        expect(line).toContain('allProven=true');
    });

    /**
     * And it holds against the authored catalog rather than only against a
     * fixture: the bands do not overlap, which is the point of them.
     */
    it('agrees with every grave in the catalog', () => {
        for (const grave of GRAVES) {
            const profile = profileIn(grave.mannerOfDeath) as 'tribulation' | 'intact';
            const band = GRAVE_CONTENTS_BANDS[profile];
            const held = grave.interior.contents.length;
            expect(held, `${grave.name} (${grave.mannerOfDeath})`).toBeGreaterThanOrEqual(band.minItems);
            expect(held, `${grave.name} (${grave.mannerOfDeath})`).toBeLessThanOrEqual(band.maxItems);
        }
    });
});
