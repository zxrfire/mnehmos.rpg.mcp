/**
 * Contention is derived, symmetric, and scarce.
 *
 * The three properties the register rests on. Symmetry is the one AGENTS.md
 * calls out by name - a claim pointed at one side and not the other is the
 * signature of an earlier draft - and here it is a property of an intersection
 * rather than of two rows, so the test is checking that nothing has grown a
 * side-dependent path rather than checking that an author kept two lists in
 * step.
 */

import { describe, it, expect } from 'vitest';

import {
    claimsOf,
    contentionBetween,
    contendersWith
} from '../../src/data/cultivation/what-two-houses-both-have-a-hand-on.js';
import { SECTS, DAO_HOUSES } from '../../src/data/cultivation/sects.js';
import { COURTS, idsForFaction } from '../../src/data/cultivation/governance-and-water-rights.js';

/** Every body in the world, once, collapsed across the ids it is filed under. */
const BODIES: string[] = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of [...SECTS.map(s => s.id), ...COURTS.map(c => c.id), ...DAO_HOUSES.map(h => h.id)]) {
        const key = idsForFaction(id).sort().join('|') || id;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(id);
    }
    return out;
})();

describe('what two houses both have a hand on', () => {
    it('finds the founding the Kiln Court and the Root Sill Court both claim', () => {
        // The worked case. Neither body carries the other in `rivals` - both
        // lists are empty - and neither carries an ambition, so nothing the
        // catalog states outright connects them. What connects them is the
        // event both are parties to, and the contention has to fall out of it
        // rather than being asserted beside it.
        const over = contentionBetween('sect-kiln-wardens', 'court-kiln');

        expect(over.length).toBeGreaterThan(0);
        expect(over.map(c => c.on)).toContain('event:event-the-reposting');
        expect(over.every(c => c.from.length > 0)).toBe(true);
    });

    it('reads the same from either end', () => {
        const forward = contentionBetween('sect-kiln-wardens', 'court-kiln').map(c => c.on).sort();
        const back = contentionBetween('court-kiln', 'sect-kiln-wardens').map(c => c.on).sort();
        expect(back).toEqual(forward);
    });

    it('is symmetric for every pair in the world', () => {
        const asymmetric: string[] = [];
        for (const a of BODIES) {
            for (const b of BODIES) {
                if (a === b) continue;
                const ab = contentionBetween(a, b).map(c => c.on).sort().join(',');
                const ba = contentionBetween(b, a).map(c => c.on).sort().join(',');
                if (ab !== ba) asymmetric.push(`${a} <-> ${b}: [${ab}] vs [${ba}]`);
            }
        }
        expect(asymmetric).toEqual([]);
    });

    it('never has a body contending with itself, under any of its ids', () => {
        for (const id of BODIES) {
            for (const alias of idsForFaction(id)) {
                expect(contentionBetween(id, alias)).toEqual([]);
            }
            expect(contendersWith(id).map(r => r.otherId)).not.toContain(id);
        }
    });

    it('drops the objects almost everybody holds', () => {
        // The two starter manuals are taught by twenty-four of thirty-seven
        // bodies, and the home province seats seventeen. Before scarcity
        // existed these produced about thirty contenders per house - every
        // house contending with every other, which says nothing. If one of
        // these comes back, the scarcity cut has stopped working.
        for (const id of BODIES) {
            const keys = claimsOf(id).map(c => c.on);
            expect(keys).not.toContain('road:lesser-qi-gathering-manual');
            expect(keys).not.toContain('road:foundation-tempering-scripture');
            expect(keys).not.toContain('ground:region-low-fall');
        }
    });

    it('leaves every house a number of contenders a reader can actually read', () => {
        // Pooled across the whole world rather than asserted on one house, so
        // that a single unusual body cannot fail it and a general collapse
        // cannot pass. The bar is about legibility, not about balance.
        const counts = BODIES.map(id => contendersWith(id).length);
        const mean = counts.reduce((a, b) => a + b, 0) / counts.length;

        expect(Math.max(...counts)).toBeLessThanOrEqual(20);
        expect(mean).toBeLessThan(10);
        // And it must not have collapsed to nothing: the contention axis is
        // the whole point, and a world where nobody contends over anything
        // would pass every assertion above.
        expect(counts.filter(n => n > 0).length).toBeGreaterThan(BODIES.length / 2);
    });

    it('names a checkable table for every contention it reports', () => {
        // A derived claim that cannot be traced back to the row it came from is
        // an assertion wearing a derivation's clothes.
        const sources = new Set<string>();
        for (const id of BODIES) for (const r of contendersWith(id)) for (const o of r.over) sources.add(o.from);

        expect(sources.size).toBeGreaterThan(1);
        for (const s of sources) expect(s).toMatch(/^the /);
    });
});
