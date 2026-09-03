/**
 * A column whose every row says the same thing is said once.
 *
 * The rule `facts.ts` states with the measurement behind it, applied to the
 * standing register's tables. These assertions are about the MECHANISM rather
 * than about any one table, because the whole point of computing it is that a
 * catalog edit moves it: a hand-written caption saying "all of these are sent
 * down" is a lie waiting for the first row that is not.
 */

import { describe, it, expect } from 'vitest';
import { hoistConstantColumns, hoistedLine } from '../../src/web/register-constant-columns';
import { renderRegister } from '../../src/web/register';

describe('a constant column is lifted out of the grid', () => {
    it('takes the columns that never vary and leaves the ones that do', () => {
        const { heads, rows, kept, hoisted } = hoistConstantColumns(
            ['Name', 'Grade', 'Kept as', 'Ord'],
            [
                ['a', 'none', 'tracked', '1'],
                ['b', 'none', 'tracked', '2'],
                ['c', 'none', 'tracked', '3']
            ]
        );
        expect(heads).toEqual(['Name', 'Ord']);
        expect(rows).toEqual([['a', '1'], ['b', '2'], ['c', '3']]);
        expect(kept).toEqual([0, 3]);
        expect(hoisted).toEqual([
            { head: 'Grade', value: 'none' },
            { head: 'Kept as', value: 'tracked' }
        ]);
    });

    it('never hoists the identity column, whatever it holds', () => {
        // A table whose first column had one value would be a bug rather than
        // a saving: it is what a reader looks a row up BY.
        const { heads, hoisted } = hoistConstantColumns(
            ['Name', 'Ord'],
            [['same', '1'], ['same', '2'], ['same', '3']]
        );
        expect(heads).toEqual(['Name', 'Ord']);
        expect(hoisted).toEqual([]);
    });

    it('leaves a short table alone, because reading it twice is cheaper', () => {
        const { hoisted } = hoistConstantColumns(
            ['Name', 'Kept as'],
            [['a', 'tracked'], ['b', 'tracked']]
        );
        expect(hoisted).toEqual([]);
    });

    it('keeps a table whole rather than emptying it to one column', () => {
        // Every column constant but the name is not a table that has been
        // improved. It is one that has been deleted and described.
        const { heads, hoisted } = hoistConstantColumns(
            ['Name', 'Grade'],
            [['a', 'none'], ['b', 'none'], ['c', 'none']]
        );
        expect(heads).toEqual(['Name', 'Grade']);
        expect(hoisted).toEqual([]);
    });

    it('says the head as well as the value, so the fact can be placed', () => {
        // "tracked" on its own is not an answer to a question a reader has
        // asked yet.
        const line = hoistedLine([{ head: 'Kept as', value: 'tracked' }], 7);
        expect(line).toContain('all 7');
        expect(line).toContain('kept as');
        expect(line).toContain('tracked');
    });

    it('reindexes so widths and cell classes follow their own column', () => {
        // `kept` is returned rather than recovered from the head text, because
        // a caller carries a width and a class per column and matching on the
        // name would break the first time two columns shared one.
        const { kept, rows } = hoistConstantColumns(
            ['Name', 'A', 'B', 'C'],
            [['n1', 'x', 'same', 'y'], ['n2', 'x2', 'same', 'y2'], ['n3', 'x3', 'same', 'y3']]
        );
        expect(kept).toEqual([0, 1, 3]);
        expect(rows[0]).toEqual(['n1', 'x', 'y']);
    });
});

describe('the register stopped printing its constants per row', () => {
    const HTML = renderRegister();

    it('says the comprehension materials are all alike once, not seven times', () => {
        // Measured before this pass: four of the six columns identical on all
        // seven rows, 28 cells carrying four facts.
        expect(HTML).toContain('The same on all 7');
        expect([...HTML.matchAll(/not for cash: a favour owed, or another singular thing/g)])
            .toHaveLength(1);
    });

    it('says what a derived contention has instead of a date once', () => {
        // Three sentences that used to be stamped onto every derived row -
        // 154, 152 and 152 copies. Each still appears, exactly once, in the
        // legend where a reader first meets a row it applies to.
        for (const line of [
            'It is read off what both of them hold rather than off anything either of them wrote',
            'Neither body has said anything about the other that the catalog records',
            'Nothing either of them has written down'
        ]) {
            expect([...HTML.matchAll(new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')),
            ], line).toHaveLength(1);
        }
    });

    it('does not repeat the rule about whose entry an account is on', () => {
        // The lead note states it. It used to be restated on every tie row,
        // with a second link to the target the card heading already links to.
        expect(HTML).toContain('is on its entry and not on this one');
        expect([...HTML.matchAll(/and says why on/g)]).toHaveLength(0);
    });

    it('glosses the node fraction where the column is explained, not per house', () => {
        expect([...HTML.matchAll(/how much of its own inheritance/g)]).toHaveLength(1);
    });
});
