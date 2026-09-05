/**
 * No catalog name has been damaged by a global rename.
 *
 * Renaming is done across the whole tree at once, because a name lives in the
 * catalog, in forty pieces of prose about it, in the ids, and in the tests. That
 * is the only way it stays consistent - and it has exactly one failure mode,
 * which this file is for: a replacement that fires INSIDE a longer name.
 *
 * Three real ones, all caught late and one of them only by a parser test:
 *
 *   The Root         -> Root Hollow    made `Root Hollow-Recasting Talisman`
 *   Iron Gate        -> Iron Peak Sect made `Iron Peak Sect Sect`
 *   The Root Sill Court -> Deeproot Court made `Deeproot Court Court`
 *
 * The tell in every case is a word repeated next to itself, or a name that has
 * grown a second type noun. Neither is ever intentional, and both are cheap to
 * look for.
 */

import { describe, expect, it } from 'vitest';

import { ARTIFACTS } from '../../src/data/cultivation/artifacts';
import { BEASTS } from '../../src/data/cultivation/beasts';
import { HERBS } from '../../src/data/cultivation/herbs';
import { IMMORTAL_ITEMS } from '../../src/data/cultivation/immortal-items';
import { PILLS } from '../../src/data/cultivation/pills';
import { SECTS } from '../../src/data/cultivation/sects';
import { TECHNIQUES } from '../../src/data/cultivation/techniques';

/** Every proper noun the game prints, from every catalog that holds one. */
function everyName(): { where: string; name: string }[] {
    const out: { where: string; name: string }[] = [];
    const add = (where: string, rows: readonly { name?: string }[]): void => {
        for (const row of rows) if (typeof row.name === 'string') out.push({ where, name: row.name });
    };
    add('sects', SECTS as readonly { name?: string }[]);
    add('techniques', TECHNIQUES as readonly { name?: string }[]);
    add('artifacts', ARTIFACTS as readonly { name?: string }[]);
    add('pills', PILLS as readonly { name?: string }[]);
    add('herbs', HERBS as readonly { name?: string }[]);
    add('beasts', BEASTS as readonly { name?: string }[]);
    add('immortal items', IMMORTAL_ITEMS as readonly { name?: string }[]);
    return out;
}

describe('a rename did not mangle a name', () => {
    it('never repeats a word next to itself', () => {
        const mangled = everyName().filter(({ name }) => {
            const words = name.toLowerCase().split(/[\s-]+/).filter(Boolean);
            return words.some((word, at) => at > 0 && word === words[at - 1]);
        });
        expect(
            mangled.map(row => `${row.where}: "${row.name}"`),
            'A word repeated next to itself is what a global rename leaves when it '
            + 'fires inside a longer name. Fix the name, not this test.'
        ).toEqual([]);
    });

    /**
     * And no name carries two of the words a house's name ends with. `Iron Peak
     * Sect Sect` is the obvious shape; `Deeproot Court Court` is the same bug
     * with the article stripped first.
     */
    it('never grows a second type noun', () => {
        const doubled = everyName().filter(({ name }) => {
            const ending = name.toLowerCase().split(/\s+/)
                .filter(word => ['sect', 'hall', 'court', 'pavilion', 'temple',
                    'clan', 'tower', 'peak', 'palace', 'terrace'].includes(word));
            return ending.length > 1;
        });
        expect(doubled.map(row => `${row.where}: "${row.name}"`)).toEqual([]);
    });
});
