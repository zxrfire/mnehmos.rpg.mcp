/**
 * The two roads, and what each of them requires to be ended.
 *
 * These live in the engine rather than in the content catalog because they are
 * a resolution rule: combat.ts consults `killRequirement` at the moment a
 * lethal blow lands. The catalog re-exports them, and this file proves the two
 * are the same function rather than two copies that will drift.
 */

import {
    DEFAULT_TRADITION,
    SOUL_PERSISTS_FROM_ORDINAL,
    TRADITION_DEATH_RULES,
    TraditionIdSchema,
    killRequirement,
    soulAttacksAffect,
    traditionOrDefault
} from '../../../src/engine/cultivation/tradition.js';
import {
    TRADITIONS,
    killRequirement as catalogKillRequirement,
    TraditionIdSchema as CatalogTraditionIdSchema
} from '../../../src/data/cultivation/traditions.js';
import { MAX_ORDINAL, realmForOrdinal } from '../../../src/engine/cultivation/realms.js';

describe('tradition ids', () => {
    it('holds exactly two roads, because two is a quarrel and three is a taxonomy', () => {
        expect(TraditionIdSchema.options).toEqual(['tradition-drawn', 'tradition-cut']);
    });

    it('defaults to the Drawn Road, which is what every legacy row always was', () => {
        expect(DEFAULT_TRADITION).toBe('tradition-drawn');
        expect(traditionOrDefault(undefined)).toBe('tradition-drawn');
        expect(traditionOrDefault('nonsense')).toBe('tradition-drawn');
        expect(traditionOrDefault('tradition-cut')).toBe('tradition-cut');
    });

    it('anchors soul persistence to Nascent Soul rather than to a literal', () => {
        expect(SOUL_PERSISTS_FROM_ORDINAL).toBe(realmForOrdinal(21).ordinalStart);
        expect(realmForOrdinal(SOUL_PERSISTS_FROM_ORDINAL).key).toBe('nascent_soul');
    });
});

describe('killRequirement', () => {
    it('makes a body enough for a Drawn cultivator below Nascent Soul', () => {
        for (const ordinal of [0, 5, 12, 13, SOUL_PERSISTS_FROM_ORDINAL - 1]) {
            const req = killRequirement('tradition-drawn', ordinal);
            expect(req.bodyIsEnough, `ordinal ${ordinal}`).toBe(true);
            expect(req.soulAttackWorks).toBe(true);
            expect(req.remnant).toBeNull();
        }
    });

    it('stops the body being enough for a Drawn cultivator from Nascent Soul upward', () => {
        for (let ordinal = SOUL_PERSISTS_FROM_ORDINAL; ordinal <= MAX_ORDINAL; ordinal++) {
            const req = killRequirement('tradition-drawn', ordinal);
            expect(req.bodyIsEnough, `ordinal ${ordinal}`).toBe(false);
            expect(req.soulAttackWorks).toBe(true);
            expect(req.remnant).toBe('soul');
        }
    });

    it('never lets a soul attack touch a Cut cultivator, at any rank at all', () => {
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal++) {
            const req = killRequirement('tradition-cut', ordinal);
            expect(req.soulAttackWorks, `ordinal ${ordinal}`).toBe(false);
            expect(req.remnant).toBe('seam');
        }
        expect(soulAttacksAffect('tradition-cut')).toBe(false);
        expect(soulAttacksAffect('tradition-drawn')).toBe(true);
    });

    it('never lets a Cut cultivator be finished by the body alone', () => {
        // The seam persists in material. A carver who is merely killed may be
        // back in nine years, which is why the Silent Cliffs distinguishes a funeral
        // from a scattering.
        for (const ordinal of [0, 12, 21, 33, MAX_ORDINAL]) {
            expect(killRequirement('tradition-cut', ordinal).bodyIsEnough).toBe(false);
        }
    });

    it('is the inverse of the other road at every rank, which is the whole point', () => {
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal++) {
            const drawn = killRequirement('tradition-drawn', ordinal);
            const cut = killRequirement('tradition-cut', ordinal);
            expect(drawn.soulAttackWorks).not.toBe(cut.soulAttackWorks);
        }
    });

    it('clamps an out-of-range ordinal rather than answering from nonsense', () => {
        expect(killRequirement('tradition-drawn', -5).bodyIsEnough).toBe(true);
        expect(killRequirement('tradition-drawn', 9999).bodyIsEnough).toBe(false);
        expect(killRequirement('tradition-drawn', Number.NaN).bodyIsEnough).toBe(true);
    });
});

describe('the catalog and the engine are one rule, not two', () => {
    it('re-exports the engine function rather than keeping a copy', () => {
        expect(catalogKillRequirement).toBe(killRequirement);
        expect(CatalogTraditionIdSchema).toBe(TraditionIdSchema);
    });

    it('derives the catalog prose from the engine rule so they cannot drift', () => {
        for (const tradition of TRADITIONS) {
            expect(tradition.death.persistsFromOrdinal)
                .toBe(TRADITION_DEATH_RULES[tradition.id].persistsFromOrdinal);
        }
    });
});
