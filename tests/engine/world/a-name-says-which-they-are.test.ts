/**
 * A name that says nothing about the person wearing it.
 *
 * `personName` drew from one pool of syllables and `createNpc` rolled the sex
 * separately, so every generated person in the world - hundreds per world -
 * had a name unrelated to who they were. The design owner, on a woman whose
 * catalog entry calls her "Half Cup Lian": *"that's a very weird name ... just
 * give the npc's masculine or feminine names. you know what they sound like."*
 *
 * IT COSTS MORE THAN THE READING. `senior sister` and `senior brother` are how
 * this genre addresses somebody whose name is all you have, and a player who
 * cannot tell which from the name cannot use either of them.
 *
 * SORTED, NOT REPLACED. Every syllable is one that was already in the two
 * pools - none added, none dropped - so the world's names read as they always
 * did, drawn in two halves instead of one. Ten and ten each way, so neither
 * sex has the narrower set of names.
 */

import { describe, expect, it } from 'vitest';

import {
    GIVEN_HEAD_FEMALE,
    GIVEN_HEAD_MALE,
    GIVEN_TAIL_FEMALE,
    GIVEN_TAIL_MALE,
    personName
} from '../../../src/engine/world/history';
import { forStream } from '../../../src/engine/cultivation/rng';
import { createNpc } from '../../../src/engine/world/npc-state';

/** The given name is what follows the surname. */
const given = (full: string): string => full.slice(full.indexOf(' ') + 1);

function drawnFrom(name: string, heads: readonly string[], tails: readonly string[]): boolean {
    const word = given(name);
    return heads.some(head =>
        word.startsWith(head) && tails.some(tail => word.slice(head.length).startsWith(tail)));
}

describe('the palette is split and not widened', () => {
    it('adds no syllable and drops none', () => {
        expect([...GIVEN_HEAD_MALE, ...GIVEN_HEAD_FEMALE].sort()).toEqual([
            'An', 'Ci', 'Fu', 'Hui', 'Jing', 'Ke', 'Lan', 'Lie', 'Min', 'Nuo',
            'Pei', 'Rong', 'Shu', 'Sui', 'Tian', 'Wan', 'Xu', 'Yao', 'Zhao', 'Zhen'
        ].sort());
        expect([...GIVEN_TAIL_MALE, ...GIVEN_TAIL_FEMALE].sort()).toEqual([
            'bo', 'chen', 'feng', 'he', 'kuan', 'lin', 'lu', 'ming', 'ping', 'qing',
            'ru', 'shan', 'shi', 'tao', 'wu', 'xue', 'ya', 'yan', 'yi', 'zhi'
        ].sort());
    });

    /** Neither sex gets the smaller set of names to be drawn from. */
    it('gives each of them the same number of syllables', () => {
        expect(GIVEN_HEAD_MALE.length).toBe(GIVEN_HEAD_FEMALE.length);
        expect(GIVEN_TAIL_MALE.length).toBe(GIVEN_TAIL_FEMALE.length);
    });
});

describe('a name says which they are', () => {
    it.each(['male', 'female'] as const)('draws %s names from that half alone', sex => {
        const heads = sex === 'male' ? GIVEN_HEAD_MALE : GIVEN_HEAD_FEMALE;
        const tails = sex === 'male' ? GIVEN_TAIL_MALE : GIVEN_TAIL_FEMALE;
        for (let i = 0; i < 200; i++) {
            const name = personName(forStream('names', sex, String(i)), sex);
            expect(drawnFrom(name, heads, tails), `${sex}: ${name}`).toBe(true);
        }
    });

    /**
     * AND THE PERSON THE ENGINE MAKES CARRIES IT. The two draws were
     * independent inside `createNpc`, which is where the defect actually lived:
     * the name was composed before the sex was decided.
     */
    it('names the person the engine actually made', () => {
        for (let i = 0; i < 200; i++) {
            const npc = createNpc('a-name-says-which', {
                id: `npc-${i}`,
                bornOnDay: 0,
                onDay: 0
            });
            const male = npc.identity.sex === 'male';
            expect(
                drawnFrom(
                    npc.name,
                    male ? GIVEN_HEAD_MALE : GIVEN_HEAD_FEMALE,
                    male ? GIVEN_TAIL_MALE : GIVEN_TAIL_FEMALE
                ),
                `${npc.name} is ${npc.identity.sex}`
            ).toBe(true);
        }
    });

    /**
     * AND A CALLER WITH NOBODY IN PARTICULAR IN MIND STILL GETS A NAME. Naming
     * a founder in a history line is not naming a person the world holds, and
     * being made to invent a sex for one would be worse than drawing from both.
     */
    it('still names somebody when no sex is given', () => {
        const name = personName(forStream('names', 'either', '1'));
        expect(name.split(' ')).toHaveLength(2);
    });
});
