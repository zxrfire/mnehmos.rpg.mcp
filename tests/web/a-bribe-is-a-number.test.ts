/**
 * Money on the table has to actually be on the table.
 *
 * Measured in play:
 *
 *     > I bribe Kong Kelin
 *     Kong Kelin agreed. It was taken.
 *
 *     stones before  6043
 *     stones after   6043
 *
 * No sum named, no price, no record of what was bought. That is the softening
 * the agency rule forbids, and it is the invisible kind: the player believes
 * they spent something.
 *
 * The resolver's contract has carried `stonesOffered` from the start -
 * "spirit stones actually put down. Only spent when the attempt lands" - and
 * this caller never filled it. So the fix is not a new mechanic; it is the
 * caller doing what the field always said.
 */

import { describe, it, expect } from 'vitest';

import { makeGame } from './harness';
import { stonesNamedIn } from '../../src/web/game';
import { KnowledgeGate } from '../../src/web/knowledge';

describe('what counts as a sum', () => {
    it('reads the figure somebody actually said', () => {
        expect(stonesNamedIn('I bribe him with 200 spirit stones')).toBe(200);
        expect(stonesNamedIn('I bribe him with 200 stones')).toBe(200);
        expect(stonesNamedIn('I offer 1,500 spirit stones')).toBe(1500);
    });

    it('does not read a bare number as an offer', () => {
        // "I bribe the third guard" is not three stones, and reading it as one
        // would have somebody paying for a sentence about a person.
        expect(stonesNamedIn('I bribe the third guard')).toBeNull();
        expect(stonesNamedIn('I bribe Kong Kelin')).toBeNull();
        expect(stonesNamedIn('I bribe him with 0 stones')).toBeNull();
    });
});

describe('a coin approach with nothing on the table', () => {
    it('is refused, and the refusal names the hole and the purse', async () => {
        const { db, game } = makeGame({ seed: 'probe-c', worldEnabled: true });
        const { cultivator } = await game.newRun('Probe');
        const known = new KnowledgeGate(db)
            .awareness(cultivator.id)
            .find(row => row.kind === 'cultivator')!;

        const before = game.state().cultivator.spiritStones;
        const said = await game.act(`I bribe ${known.name}`) as { narration?: string };

        expect(said.narration ?? '').toContain('A bribe is a number');
        expect(said.narration ?? '').toContain(String(before));
        // Refused before the resolver, so no days and no mark either.
        expect(game.state().cultivator.spiritStones).toBe(before);
    }, 120_000);

    it('is refused when the figure is bigger than the purse', async () => {
        const { db, game } = makeGame({ seed: 'probe-c', worldEnabled: true });
        const { cultivator } = await game.newRun('Probe');
        const known = new KnowledgeGate(db)
            .awareness(cultivator.id)
            .find(row => row.kind === 'cultivator')!;

        const before = game.state().cultivator.spiritStones;
        const said = await game.act(
            `I bribe ${known.name} with 999999 spirit stones`
        ) as { narration?: string };

        expect(said.narration ?? '').toContain('short of what you have just promised');
        expect(game.state().cultivator.spiritStones).toBe(before);
    }, 120_000);

    it('never leaves the purse where a refusal found it after a named offer', async () => {
        // A refusal keeps the money - the resolver's own rule, and the reason
        // the debit is on `stonesSpent` rather than on what was offered. What
        // must not happen is a TAKE that costs nothing, and the only thing that
        // can produce one is this caller failing to pass the figure at all.
        const { db, game } = makeGame({ seed: 'probe-c', worldEnabled: true });
        const { cultivator } = await game.newRun('Probe');
        const known = new KnowledgeGate(db)
            .awareness(cultivator.id)
            .find(row => row.kind === 'cultivator')!;

        const before = game.state().cultivator.spiritStones;
        const said = await game.act(
            `I bribe ${known.name} with 5 spirit stones`
        ) as { narration?: string };
        const after = game.state().cultivator.spiritStones;

        const taken = (said.narration ?? '').includes('It was taken');
        if (taken) expect(after).toBeLessThan(before);
        else expect(after).toBe(before);
    }, 120_000);
});
