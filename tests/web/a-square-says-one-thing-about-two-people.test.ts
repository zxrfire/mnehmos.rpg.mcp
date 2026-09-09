/**
 * Three people in a room, and nothing true of any two of them.
 *
 * FOUND BY PLAYING, and the design owner named it: *"do novels introduce
 * characters like this? no. not at all."* Then, after the first fix improved the
 * sentences but not the shape: *"the world doesn't feel alive nor narrative at
 * all."*
 *
 * The census had already stopped emitting a name list. What it still emitted
 * was one self-contained sentence per person, and a model handed three
 * self-contained sentences writes a queue with spatial connectives:
 *
 *     Bai Wanchen stands at a stall...
 *     Nearby, Mo Yaozhi is counting...
 *     Further along, Han Ciya is eating.
 *
 * The prompt has told the narrator to place people against each other since the
 * previous fix (`prompt.ts`, HOW PEOPLE ENTER THE PROSE). It could not obey.
 * The ONLY predicate over a pair the facts could express was `withNames`, and
 * that arrives already flattened inside the `at` clause. **The queue was in the
 * facts**, so no prompt change could have reached it.
 *
 * Three claims, and the third is what stops this becoming the next thing a
 * player learns to skip.
 */

import { describe, it, expect } from 'vitest';

import { factsForCompany } from '../../src/web/facts';

const CULTIVATOR = {
    name: 'Wen Shu', realmOrdinal: 6, location: 'Sweet Spring Island', injuries: []
} as never;

const person = (name: string, over: Partial<{
    ordinal: number; at: string | null; looksUp: boolean; houseId: string | null;
    rankIndex: number; ties: { name: string; kind: string }[]; chewing: string | null;
}> = {}) => ({
    name,
    ordinal: over.ordinal ?? 8,
    sex: null,
    age: 40,
    rank: null,
    at: over.at === undefined ? 'at a stall' : over.at,
    looksUp: over.looksUp ?? true,
    playsToTheRoom: 0,
    withNames: [],
    tiesHere: over.ties ?? [],
    houseId: over.houseId === undefined ? null : over.houseId,
    rankIndex: over.rankIndex ?? -1,
    chewing: over.chewing ?? null,
    like: null
});

const square = (named: unknown[]) => factsForCompany(
    CULTIVATOR,
    { named, strangers: [], total: named.length } as never
);

const prose = (named: unknown[]) => square(named).lines.join(' ');

describe('a square says one thing about two of the people in it', () => {
    it('states a tie the world actually wrote, in the direction it wrote it', () => {
        // `master` is the row a STUDENT holds and it points UP, so the sentence
        // has to run the other way round from `disciple`. Getting this backwards
        // would quietly invert every teaching relationship in the game.
        expect(prose([
            person('Bai Wanchen', { ties: [{ name: 'Mo Yaozhi', kind: 'master' }] }),
            person('Mo Yaozhi')
        ])).toContain('Bai Wanchen studies under Mo Yaozhi.');

        expect(prose([
            person('Bai Wanchen', { ties: [{ name: 'Mo Yaozhi', kind: 'disciple' }] }),
            person('Mo Yaozhi')
        ])).toContain('Mo Yaozhi studies under Bai Wanchen.');
    });

    it('falls back to the roll, then to the house, and says nothing beyond that', () => {
        // A rung between two people of one house is the commonest relation in
        // the setting.
        expect(prose([
            person('Elder Qiu', { houseId: 'sect-azure-cloud-pavilion', rankIndex: 5 }),
            person('Jin Wenqi', { houseId: 'sect-azure-cloud-pavilion', rankIndex: 1 })
        ])).toContain('Elder Qiu stands above Jin Wenqi on the same roll.');

        // Same house, same rung: still a relation, and still worth the clause.
        expect(prose([
            person('Jin Wenqi', { houseId: 'sect-azure-cloud-pavilion', rankIndex: 2 }),
            person('Qiu Yuxi', { houseId: 'sect-azure-cloud-pavilion', rankIndex: 2 })
        ])).toMatch(/answer to the same house/);

        // TWO STRANGERS TO EACH OTHER GET NOTHING. Inventing a connection
        // between two people the world never connected is the failure this
        // whole channel exists to avoid.
        const unrelated = prose([person('Bai Wanchen'), person('Han Ciya')]);
        expect(unrelated).not.toMatch(/studies under|stands above|answer to the same/);
    });

    /**
     * ONE PER SQUARE, which is the same discipline `chewing` follows and for the
     * same reason. A room where every pair has a history is a soap opera, and
     * the third one a player reads is the one they stop reading. The ambient qi
     * line is the worked example of what happens without this cap.
     */
    it('says it once, however many pairs in the room have something between them', () => {
        const said = prose([
            person('A', { houseId: 'h', rankIndex: 5, ties: [{ name: 'B', kind: 'disciple' }] }),
            person('B', { houseId: 'h', rankIndex: 3, ties: [{ name: 'C', kind: 'rival' }] }),
            person('C', { houseId: 'h', rankIndex: 1, ties: [{ name: 'A', kind: 'debtor' }] })
        ]);
        const relations = [
            /studies under/g, /stands above/g, /answer to the same house/g,
            /owes/g, /set against each other/g
        ].reduce((total, pattern) => total + (said.match(pattern) ?? []).length, 0);
        expect(relations, said).toBe(1);
    });

    it('never names somebody who is not standing here', () => {
        // The caller filters ties to the square, and this is the second lock on
        // it: a tie pointing at an absent person must produce no sentence
        // rather than a sentence about a stranger.
        const said = prose([
            person('Bai Wanchen', { ties: [{ name: 'Somebody Elsewhere', kind: 'master' }] }),
            person('Han Ciya')
        ]);
        expect(said).not.toContain('Somebody Elsewhere');
    });

    it('leaves a square of one person alone', () => {
        const said = prose([person('Bai Wanchen', { houseId: 'h', rankIndex: 4 })]);
        expect(said).not.toMatch(/studies under|stands above|answer to the same/);
    });

    /**
     * AND THE CENSUS SENTENCES STAY HARVESTABLE.
     *
     * Two integration tests read names back out of this prose with
     * `/^([^.]+?) is (?:here\b|.*\bhas not looked up\b)/` per sentence. A
     * relation sentence must not masquerade as one of those, or it puts a
     * two-name string into a list of people.
     */
    it('does not produce a sentence the name harvester would misread', () => {
        const said = prose([
            person('Bai Wanchen', { ties: [{ name: 'Mo Yaozhi', kind: 'disciple' }] }),
            person('Mo Yaozhi')
        ]);
        const harvested = said
            .split(/(?<=\.)\s+/)
            .map(sentence => /^([^.]+?) is (?:here\b|.*\bhas not looked up\b)/.exec(sentence.trim()))
            .filter((found): found is RegExpExecArray => found !== null)
            .map(found => found[1].trim());
        expect(harvested).toEqual(['Bai Wanchen', 'Mo Yaozhi']);
    });
});
