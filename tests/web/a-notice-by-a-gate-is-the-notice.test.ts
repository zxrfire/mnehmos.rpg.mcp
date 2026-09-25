/**
 * A paper posted by a gate is the paper, not the gate.
 *
 * Played: "I read the notice pinned by the gate" read the gate from outside as
 * a ruin, answered that no site had been approached, and the narrator made up
 * a wind that took the notice away. The wall's own read has it.
 */

import { describe, expect, it } from 'vitest';
import { parseIntent } from '../../src/web/verb-pattern-table.js';

describe('a notice by a gate', () => {
    it.each([
        'I read the notice pinned by the gate',
        'I read the paper nailed to the gate',
        'what does the notice by the gate say'
    ])('is the wall: %s', said => {
        expect(parseIntent(said)).toEqual({ action: 'look', intent: 'bills' });
    });

    it.each([
        'I look at the gate',
        'I go and look at the old gate',
        'I read the inscription on the headstone'
    ])('while the gate itself is still read from outside: %s', said => {
        expect(parseIntent(said)).toMatchObject({ action: 'site', intent: 'outside' });
    });
});
