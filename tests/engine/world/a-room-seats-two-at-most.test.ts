/**
 * A cultivation room seats one, two at most, and a second person halves it.
 * The house seats by standing; past two a room, the rest get no room time.
 */
import { describe, expect, it } from 'vitest';

import {
    groundBudgetOf,
    groundTimeShares,
    type GroundClaimant
} from '../../../src/engine/world/the-ground-somebody-is-actually-standing-on.js';
import type { LocationRecord } from '../../../src/engine/world/locations.js';

const room = (id: string, qiDensity: number) =>
    ({ id, name: id, qiDensity, controllingFactionId: 'h', data: {} }) as unknown as LocationRecord;
const member = (id: string, rank: number): GroundClaimant =>
    ({ id, tags: [], factionRankIndex: rank, cultivation: { realmOrdinal: 5 } });

const VEIN = room('vein', 100);
const CELL = room('cell', 99);
const HALL = room('hall', 60);

describe('a house seats its best ground two to a room', () => {
    it('counts two seats a room, and only on the best ground', () => {
        expect(groundBudgetOf([VEIN, CELL, HALL])).toBe(4);
        expect(groundBudgetOf([HALL])).toBe(2);
        expect(groundBudgetOf([])).toBe(0);
    });

    it('gives each a room alone while there are rooms to spare', () => {
        const shares = groundTimeShares([member('a', 3), member('b', 0)], [VEIN, CELL, HALL]);
        expect(shares.get('a')).toBe(1);
        expect(shares.get('b')).toBe(1);
    });

    it('doubles up the lowest seated, and they get half each', () => {
        const shares = groundTimeShares(
            [member('low', 0), member('top', 4), member('mid', 2)], [VEIN, CELL, HALL]);
        expect(shares.get('top')).toBe(1);
        expect(shares.get('mid')).toBe(0.5);
        expect(shares.get('low')).toBe(0.5);
    });

    it('leaves everybody past the seats without room time', () => {
        const members = [0, 1, 2, 3, 4, 5].map(r => member(`r${r}`, r));
        const shares = groundTimeShares(members, [VEIN]);
        expect(shares.get('r5')).toBe(0.5);
        expect(shares.get('r4')).toBe(0.5);
        for (const r of [0, 1, 2, 3]) expect(shares.get(`r${r}`)).toBe(0);
        // A room is one person's year of qi, however it is split.
        expect([...shares.values()].reduce((a, b) => a + b, 0)).toBe(1);
    });

    it('seats favour ahead of the rung it sits on', () => {
        const chosen = { ...member('chosen', 1), tags: ['chosen'] };
        const shares = groundTimeShares([member('elder', 2), chosen, member('x', 0)], [VEIN]);
        expect(shares.get('chosen')).toBe(0.5);
        expect(shares.get('elder')).toBe(0.5);
        expect(shares.get('x')).toBe(0);
    });
});
