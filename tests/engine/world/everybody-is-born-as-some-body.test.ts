/**
 * The world's people get a body the same way the player does.
 *
 * AGENTS.md's mirror-image rule: a rule that binds the player and not NPCs is
 * the same failure as one that binds nobody. There is exactly one constructor
 * of a world person - `createNpc` - and every path into the world goes through
 * it, so the whole of the guarantee is that the roll lives inside it and that
 * the lifespan stamp reads it.
 *
 * The stamp is the part worth testing rather than assuming. A world person's
 * lifespan is DENORMALISED as a day on their row rather than recomputed, so a
 * body that does not last has to be written as not lasting on the day it is
 * made. Miss that and the cost happens only to the player, which is exactly the
 * asymmetry this file exists to refuse.
 */

import { describe, it, expect } from 'vitest';

import { createNpc, setRealm } from '../../../src/engine/world/npc-state.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { rollSpiritRoot } from '../../../src/engine/cultivation/spirit-roots.js';
import {
    PHYSIQUES,
    getPhysique,
    rollPhysique
} from '../../../src/engine/cultivation/physiques.js';
import { DAYS_PER_YEAR } from '../../../src/engine/cultivation/cultivation.js';
import { lifespanForOrdinal } from '../../../src/engine/cultivation/realms.js';

const born = (id: string, opts: Parameters<typeof createNpc>[1] | null = null) =>
    createNpc('a-world-of-bodies', {
        id, bornOnDay: 0, onDay: 0, ...(opts ?? {})
    } as Parameters<typeof createNpc>[1]);

describe('a world person is born as some body', () => {
    it('draws it on its own stream, so no already-seeded world moved', () => {
        // The guarantee is structural rather than historical: the physique
        // stream is separate from the root stream, so a root drawn from a seed
        // is the root that seed always drew. Asserted against the root's own
        // stream rather than against a remembered value, which would go stale.
        for (const id of ['npc-1', 'npc-2', 'npc-77', 'npc-4001']) {
            const npc = born(id);
            expect(npc.cultivation.spiritRoot)
                .toBe(rollSpiritRoot(forStream('a-world-of-bodies', 'npc-root', id).next()).key);
        }
    });

    it('is deterministic in the seed and the id', () => {
        expect(born('npc-9').identity.physique).toBe(born('npc-9').identity.physique);
    });

    it('agrees with the catalog roll for the stream it is drawn on', () => {
        for (const id of ['npc-1', 'npc-2', 'npc-3', 'npc-40']) {
            expect(born(id).identity.physique).toBe(
                rollPhysique(forStream('a-world-of-bodies', 'npc-physique', id).next())?.key ?? null
            );
        }
    });

    it('leaves almost everybody as nothing in particular', () => {
        const carried = Array.from({ length: 2000 }, (_, i) => born(`npc-${i}`))
            .filter(npc => npc.identity.physique !== null).length;
        // 200 in ten thousand, and a sample of 2000 should land near 40. Wide
        // bars because this is a rare draw and the point is the order of
        // magnitude, not the figure - see AGENTS.md on pooling rather than
        // widening, and note that the exact rate is asserted against the
        // catalog in `tests/engine/cultivation/physiques.test.ts` instead.
        expect(carried).toBeGreaterThan(10);
        expect(carried).toBeLessThan(90);
    });

    it('takes an override, for importing somebody who already exists', () => {
        expect(born('npc-import', { id: 'npc-import', bornOnDay: 0, onDay: 0,
            physique: 'hollow_marrow' } as never).identity.physique).toBe('hollow_marrow');
        expect(born('npc-import', { id: 'npc-import', bornOnDay: 0, onDay: 0,
            physique: null } as never).identity.physique).toBeNull();
    });
});

describe('a body that an age already disproves', () => {
    const at = (ageYears: number, physique: string | null) => createNpc('ages', {
        id: 'npc-aged', bornOnDay: 0, onDay: ageYears * DAYS_PER_YEAR, physique
    } as never);

    it('is discarded, because somebody standing here could not have got here in it', () => {
        // A Profound Yin body at Qi Condensation is finished at 35. Seeding
        // places people at whatever age their station needs, so without this a
        // sixty-year-old arrives in the world already past their own span.
        expect(at(20, 'profound_yin').identity.physique).toBe('profound_yin');
        expect(at(60, 'profound_yin').identity.physique).toBeNull();
        expect(at(60, 'pure_yang').identity.physique).toBeNull();
    });

    it('is a comparison of two numbers and not a rule about any one body', () => {
        // The long-lived row survives an age the short-lived rows do not, and
        // nothing anywhere had to be told which is which.
        expect(at(60, 'hollow_marrow').identity.physique).toBe('hollow_marrow');
        expect(at(60, null).identity.physique).toBeNull();
        // And the long-lived row is discarded too, at the age its own ceiling
        // cannot reach - 100 years at this rung, times 1.8. The rule is the
        // same arithmetic for every row and knows none of their names.
        expect(at(150, 'hollow_marrow').identity.physique).toBe('hollow_marrow');
        expect(at(200, 'hollow_marrow').identity.physique).toBeNull();
    });

    it('leaves nobody in a fresh world past their own span', () => {
        for (let i = 0; i < 3000; i++) {
            const npc = born(`npc-${i}`, {
                id: `npc-${i}`, bornOnDay: 0, onDay: (i % 90) * DAYS_PER_YEAR
            } as never);
            const p = npc.identity.physique;
            if (!p) continue;
            expect(npc.cultivation.lifespanEndsOnDay).toBeGreaterThan(npc.identity.bornOnDay);
            // The stamp is in their future on the day they are made.
            expect(npc.cultivation.lifespanEndsOnDay).toBeGreaterThan((i % 90) * DAYS_PER_YEAR);
        }
    });
});

describe('the lifespan stamp reads it', () => {
    const stampFor = (physique: string | null) => born('npc-stamp', {
        id: 'npc-stamp', bornOnDay: 0, onDay: 0, physique
    } as never).cultivation.lifespanEndsOnDay;

    it('is the rung on its own for an ordinary body', () => {
        expect(stampFor(null)).toBeCloseTo(lifespanForOrdinal(0) * DAYS_PER_YEAR, 6);
    });

    it('is shortened for a body that does not last', () => {
        const yin = getPhysique('profound_yin');
        expect(stampFor('profound_yin'))
            .toBeCloseTo(lifespanForOrdinal(0) * yin.lifespan * DAYS_PER_YEAR, 6);
        expect(stampFor('profound_yin')).toBeLessThan(stampFor(null));
    });

    it('is lengthened for one that does', () => {
        expect(stampFor('hollow_marrow')).toBeGreaterThan(stampFor(null));
    });

    it('gives the yin and yang bodies the same day', () => {
        expect(stampFor('pure_yang')).toBe(stampFor('profound_yin'));
    });

    it('still reads it after a crossing moves the rung', () => {
        // `setRealm` restamps off the new rung. A physique folded in once at
        // creation and not again would be a body that outgrows its own cost the
        // first time it climbs.
        const npc = born('npc-climb', {
            id: 'npc-climb', bornOnDay: 0, onDay: 0, physique: 'profound_yin'
        } as never);
        const climbed = setRealm(npc, 13, 100);
        const yin = getPhysique('profound_yin');
        expect(climbed.cultivation.lifespanEndsOnDay)
            .toBeCloseTo(lifespanForOrdinal(13) * yin.lifespan * DAYS_PER_YEAR, 6);
        // And it is still short of what the rung alone would have given.
        expect(climbed.cultivation.lifespanEndsOnDay)
            .toBeLessThan(lifespanForOrdinal(13) * DAYS_PER_YEAR);
    });

    it('is proportional to the catalog figure for every row there is', () => {
        // No row is special-cased, including any added after this was written.
        for (const p of PHYSIQUES) {
            expect(stampFor(p.key)).toBeCloseTo(stampFor(null) * p.lifespan, 6);
        }
    });
});
