import { describe, it, expect } from 'vitest';
import { SECT_ANCESTRY } from '../../src/data/cultivation/sects.js';
import { HELD_INSTRUMENTS } from '../../src/data/cultivation/sealed-ancestors.js';

/**
 * Where the same fact is stored twice, it must not be able to drift.
 *
 * A sealed ancestor's resting place is written in two catalogs: the sect's own
 * ancestral roll in `sects.ts`, and the detailed entry in
 * `sealed-ancestors.ts`. Three of them are byte-identical today and none of
 * them has to be - nothing stops somebody editing one and leaving the other,
 * and both read as authoritative to whoever finds them first.
 *
 * Deriving one from the other was the obvious fix and is the wrong one here.
 * These catalogs are deliberately declarative: a reader opens the file and
 * sees the world, and replacing a sentence with a lookup call buys
 * single-sourcing at the cost of the thing the file is for. So both copies
 * stay and this test makes divergence loud instead of silent.
 *
 * If you are here because this failed: decide which file is wrong, fix that
 * one, and do not "fix" it by deleting the assertion.
 */
describe('a sealed ancestor', () => {
    it('rests in the same place in both catalogs that name it', () => {
        const disagreements: string[] = [];
        let compared = 0;

        for (const ancestor of HELD_INSTRUMENTS) {
            // `dormant` is the one still in the world and wakeable - at most one
            // per house, which is exactly the population this file details.
            const onTheRoll = SECT_ANCESTRY[ancestor.holderFactionId]?.dormant;
            if (!onTheRoll) continue;
            const sameName = onTheRoll.name === ancestor.name
                || ancestor.name.startsWith(`${onTheRoll.name},`)
                || onTheRoll.name.startsWith(`${ancestor.name},`);
            if (!sameName) continue;
            compared++;
            if (onTheRoll.restingPlace !== ancestor.restingPlace) {
                disagreements.push(
                    `${ancestor.name} (${ancestor.holderFactionId}):\n`
                    + `  sects.ts:            ${onTheRoll.restingPlace}\n`
                    + `  sealed-ancestors.ts: ${ancestor.restingPlace}`
                );
            }
        }

        expect(disagreements.join('\n\n')).toBe('');
        // A guard on the guard: if the name matching stops finding anybody,
        // this test would pass by comparing nothing at all.
        expect(compared, 'no ancestor was matched across the two catalogs').toBeGreaterThan(0);
    });
});
