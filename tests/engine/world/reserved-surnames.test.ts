import { describe, it, expect } from 'vitest';
import { RESERVED_SURNAMES, SURNAMES, surnameOf } from '../../../src/engine/world/history.js';

/**
 * A reserved surname is a lineage, and a lineage is only readable if it cannot
 * also arrive on a stranger by a dice roll.
 *
 * This asserts the property the generator relies on rather than sampling it:
 * the two sets are disjoint, so `personName` physically cannot produce one. A
 * sampling test would pass by luck on the day somebody widened the pool.
 */
describe('reserved surnames', () => {
    it('are never in the pool the name generator draws from', () => {
        const pool = new Set<string>(SURNAMES);
        const collisions = [...RESERVED_SURNAMES.keys()].filter(name => pool.has(name));
        expect(collisions).toEqual([]);
    });

    it('each name the house it belongs to', () => {
        for (const [name, house] of RESERVED_SURNAMES) {
            expect(name.length).toBeGreaterThan(0);
            expect(house.length).toBeGreaterThan(0);
        }
    });

    it('read back off a full name the way a roll would be read', () => {
        expect(surnameOf('Ru Anwei')).toBe('Ru');
        expect(RESERVED_SURNAMES.has(surnameOf('Ru Anwei'))).toBe(true);
        expect(RESERVED_SURNAMES.has(surnameOf('Cai Ruzhen'))).toBe(false);
    });
});
