/**
 * Physiques - the catalog, the roll, and the rule the whole design rests on.
 *
 * The rule is that NOTHING BRANCHES ON WHICH PHYSIQUE SOMEBODY HAS, and it is
 * asserted here three ways rather than trusted:
 *
 *   1. The pair is equal field by field. A Profound Yin body and a Pure Yang
 *      body differ in prose and in nothing a resolver can see.
 *   2. The two of them produce byte-identical output from every consumer.
 *   3. A scan of `src/` for the catalog's own key strings, which must appear in
 *      the catalog and the wire schema and nowhere else. That is the one that
 *      catches a branch somebody adds next year.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
    PHYSIQUES,
    PHYSIQUE_WEIGHT_CARRIED,
    PHYSIQUE_WEIGHT_TOTAL,
    cultivationSpeedOf,
    describePhysique,
    drawnOffMultiplierOf,
    getPhysique,
    lifespanWithPhysique,
    physiqueOrNull,
    physiqueProbability,
    rollPhysique,
    type Physique
} from '../../../src/engine/cultivation/physiques.js';
import { PhysiqueKeySchema } from '../../../src/schema/cultivation.js';
import { UNBOUNDED_LIFESPAN_YEARS } from '../../../src/engine/cultivation/realms.js';
import { computeCultivationRate } from '../../../src/engine/cultivation/cultivation.js';
import {
    evaluateDeathConditions,
    lifespanCeilingFor,
    lifespanRemaining
} from '../../../src/engine/cultivation/survival.js';
import { useAFurnaceTechnique } from '../../../src/engine/social-leverage/an-art-that-needs-two-people.js';

// ─────────────────────────────────────────────────────────────────────────
// THE CATALOG
// ─────────────────────────────────────────────────────────────────────────

describe('the catalog', () => {
    it('agrees with the wire schema, in both directions', () => {
        expect([...PhysiqueKeySchema.options].sort())
            .toEqual(PHYSIQUES.map(p => p.key).sort());
    });

    it('leaves the overwhelming majority of births carrying nothing', () => {
        expect(PHYSIQUE_WEIGHT_CARRIED).toBeLessThan(PHYSIQUE_WEIGHT_TOTAL / 10);
        // The statement the file makes about itself, checked rather than trusted.
        expect(PHYSIQUE_WEIGHT_CARRIED / PHYSIQUE_WEIGHT_TOTAL).toBeCloseTo(0.02, 4);
    });

    it('gives every row all three of the things a physique is', () => {
        for (const p of PHYSIQUES) {
            expect(p.weight).toBeGreaterThan(0);
            expect(p.cultivationSpeed).toBeGreaterThan(0);
            expect(p.lifespan).toBeGreaterThan(0);
            expect(p.drawnOff).toBeGreaterThanOrEqual(0);
            // Something a person standing next to them would notice. A physique
            // that showed nowhere could not be learned about, which is the
            // reachability defect this file exists on the other side of.
            expect(p.tell.length).toBeGreaterThan(8);
        }
    });

    it('prices at least one body as costing its owner years', () => {
        // The genre's whole point: a physique is never a bonus. If the day comes
        // that every row is above 1 on all three axes, the axis has become a
        // talent table with a different name.
        expect(PHYSIQUES.some(p => p.lifespan < 1)).toBe(true);
        expect(PHYSIQUES.some(p => p.cultivationSpeed < 1)).toBe(true);
    });

    it('resolves a key, and answers null for one it has never heard of', () => {
        expect(getPhysique('profound_yin').name).toBe('Profound Yin Body');
        expect(() => getPhysique('nine-yin' as never)).toThrow();
        expect(physiqueOrNull('profound_yin')?.key).toBe('profound_yin');
        expect(physiqueOrNull('a-body-nobody-authored')).toBeNull();
        expect(physiqueOrNull(null)).toBeNull();
        expect(physiqueOrNull(undefined)).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE ROLL
// ─────────────────────────────────────────────────────────────────────────

describe('rollPhysique', () => {
    it('takes a sample and no person, which is what makes it symmetric', () => {
        // A signature that cannot see whose body this is cannot favour anybody.
        // The whole of the sex-symmetry guarantee is this arity.
        expect(rollPhysique.length).toBe(1);
    });

    it('is the ordinary case for almost everybody', () => {
        expect(rollPhysique(0.5)).toBeNull();
        expect(rollPhysique(0.999999)).toBeNull();
    });

    it('lands inside each row on the sample range the weights describe', () => {
        // Weights are per ten thousand and are walked in catalog order.
        let floor = 0;
        for (const p of PHYSIQUES) {
            const mid = (floor + p.weight / 2) / PHYSIQUE_WEIGHT_TOTAL;
            expect(rollPhysique(mid)?.key).toBe(p.key);
            floor += p.weight;
        }
    });

    it('reproduces the catalog distribution over a swept range', () => {
        const counts = new Map<string, number>();
        const N = 100_000;
        for (let i = 0; i < N; i++) {
            const key = rollPhysique(i / N)?.key ?? 'none';
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        for (const p of PHYSIQUES) {
            expect((counts.get(p.key) ?? 0) / N).toBeCloseTo(physiqueProbability(p.key), 3);
        }
    });

    it('clamps rather than throwing on a sample outside [0,1)', () => {
        expect(rollPhysique(-1)?.key).toBe(PHYSIQUES[0].key);
        expect(rollPhysique(2)).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────
// NOTHING BRANCHES ON THE NAME
// ─────────────────────────────────────────────────────────────────────────

/** The pair the design owner asked to be kept symmetric. */
const YIN = getPhysique('profound_yin');
const YANG = getPhysique('pure_yang');

describe('nothing branches on which physique somebody has', () => {
    it('keeps the yin and yang rows identical in every number', () => {
        expect(YANG.weight).toBe(YIN.weight);
        expect(YANG.cultivationSpeed).toBe(YIN.cultivationSpeed);
        expect(YANG.lifespan).toBe(YIN.lifespan);
        expect(YANG.drawnOff).toBe(YIN.drawnOff);
    });

    it('gives them the same answer out of every modifier accessor', () => {
        expect(cultivationSpeedOf(YANG)).toBe(cultivationSpeedOf(YIN));
        expect(lifespanWithPhysique(100, YANG)).toBe(lifespanWithPhysique(100, YIN));
        expect(drawnOffMultiplierOf(YANG)).toBe(drawnOffMultiplierOf(YIN));
    });

    it('names each key in the catalog and the wire schema and nowhere else', () => {
        // THE ONE THAT CATCHES A BRANCH ADDED LATER. Everything above compares
        // two rows that happen to agree today; this asserts that no line of
        // source anywhere can tell them apart, which is the actual rule.
        const allowed = new Set([
            join('src', 'engine', 'cultivation', 'physiques.ts'),
            join('src', 'schema', 'cultivation.ts')
        ]);
        const offenders: string[] = [];
        for (const file of everyTypeScriptFileUnder('src')) {
            if (allowed.has(file)) continue;
            const text = readFileSync(file, 'utf8');
            for (const p of PHYSIQUES) {
                if (text.includes(`'${p.key}'`) || text.includes(`"${p.key}"`)) {
                    offenders.push(`${file} names ${p.key}`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });
});

function everyTypeScriptFileUnder(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) out.push(...everyTypeScriptFileUnder(path));
        else if (entry.endsWith('.ts')) out.push(path);
    }
    return out;
}

// ─────────────────────────────────────────────────────────────────────────
// THE THREE CONSUMERS
// ─────────────────────────────────────────────────────────────────────────

/** A physique that is in no catalog. Every consumer must still price it. */
const NOT_IN_ANY_CATALOG: Physique = {
    key: 'a-body-nobody-authored' as never,
    name: 'A Body Nobody Authored',
    weight: 1,
    cultivationSpeed: 2.5,
    lifespan: 0.5,
    drawnOff: 7,
    tell: 'nothing anybody has written down',
    description: 'A row that exists only in this test.'
};

const BARE = {
    spiritRoot: 'single_metal' as const,
    injuries: [],
    realmOrdinal: 0
};

describe('the cultivation rate reads it off the person', () => {
    it('carries a physique factor even for an ordinary body', () => {
        const rate = computeCultivationRate({ ...BARE, physique: null }, 'normal');
        const factor = rate.factors.find(f => f.source === 'physique');
        expect(factor).toBeDefined();
        expect(factor!.multiplier).toBe(1);
    });

    it('multiplies by exactly the catalog figure and nothing else', () => {
        const plain = computeCultivationRate({ ...BARE, physique: null }, 'normal');
        const yin = computeCultivationRate({ ...BARE, physique: 'profound_yin' }, 'normal');
        expect(yin.perDay).toBeCloseTo(plain.perDay * YIN.cultivationSpeed, 10);
    });

    it('gives yin and yang identical rates', () => {
        const a = computeCultivationRate({ ...BARE, physique: 'profound_yin' }, 'normal');
        const b = computeCultivationRate({ ...BARE, physique: 'pure_yang' }, 'normal');
        expect(b.perDay).toBe(a.perDay);
        expect(b.factors.map(f => f.multiplier)).toEqual(a.factors.map(f => f.multiplier));
    });

    it('reads a key it has never heard of as an ordinary body', () => {
        const rate = computeCultivationRate(
            { ...BARE, physique: 'a-body-nobody-authored' as never },
            'normal'
        );
        expect(rate.factors.find(f => f.source === 'physique')!.multiplier).toBe(1);
    });
});

describe('the lifespan ceiling', () => {
    const BODY = { realmOrdinal: 0, age: 20 };

    it('is the rung on its own for an ordinary body', () => {
        expect(lifespanCeilingFor({ ...BODY, physique: null })).toBe(100);
        expect(lifespanCeilingFor(BODY)).toBe(100);
    });

    it('is the rung times the physique otherwise', () => {
        expect(lifespanCeilingFor({ ...BODY, physique: 'profound_yin' }))
            .toBeCloseTo(100 * YIN.lifespan, 10);
        expect(lifespanCeilingFor({ ...BODY, physique: 'hollow_marrow' }))
            .toBeCloseTo(100 * getPhysique('hollow_marrow').lifespan, 10);
    });

    it('leaves an unbounded span unbounded', () => {
        expect(lifespanWithPhysique(UNBOUNDED_LIFESPAN_YEARS, YIN))
            .toBe(UNBOUNDED_LIFESPAN_YEARS);
    });

    it('shortens what is left, which is what makes the cost real', () => {
        expect(lifespanRemaining({ ...BODY, physique: null })).toBe(80);
        expect(lifespanRemaining({ ...BODY, physique: 'profound_yin' }))
            .toBeCloseTo(100 * YIN.lifespan - 20, 10);
    });

    it('ends a life the rung would not have ended', () => {
        // 40 at Qi Condensation is a young cultivator. It is not a young one of
        // these, and the death check is the same check for both.
        const at40 = {
            hp: 50, maxHp: 50, satiety: 100, starvationTurns: 0, age: 40,
            realmOrdinal: 0, yearsAtCurrentRealm: 0, injuries: [], alive: true
        };
        expect(evaluateDeathConditions({ ...at40, physique: null })).toBeNull();
        expect(evaluateDeathConditions({ ...at40, physique: 'profound_yin' }))
            .toBe('lifespan_exhausted');
        expect(evaluateDeathConditions({ ...at40, physique: 'pure_yang' }))
            .toBe('lifespan_exhausted');
    });
});

describe('what a body is worth to draw on', () => {
    const drawn = (drawnOff: number | undefined, subjectSex: 'male' | 'female' = 'female') =>
        useAFurnaceTechnique({
            actor: { personId: 'a', name: 'The one drawing', sex: 'male' },
            subjects: [{
                personId: 'b', name: 'The one drawn off', sex: subjectSex,
                conceptionSample: 0.99, deathSample: 0.99,
                ...(drawnOff === undefined ? {} : { drawnOff })
            }],
            onDay: 1,
            type: 'coerced'
        });

    it('reads an omitted multiplier as an ordinary body', () => {
        expect(drawn(undefined).daysStolen).toBe(drawn(1).daysStolen);
    });

    it('multiplies the draw, which is the reason anybody comes looking', () => {
        const ordinary = drawn(1).daysStolen;
        expect(drawn(YIN.drawnOff).daysStolen).toBeCloseTo(ordinary * YIN.drawnOff, 10);
        expect(drawn(0.5).daysStolen).toBeCloseTo(ordinary * 0.5, 10);
    });

    it('reports what each body gave up separately, because they differ now', () => {
        const result = useAFurnaceTechnique({
            actor: { personId: 'a', name: 'The one drawing', sex: 'male' },
            subjects: [
                { personId: 'b', name: 'Ordinary', sex: 'female',
                  conceptionSample: 0.99, deathSample: 0.99 },
                { personId: 'c', name: 'Not ordinary', sex: 'female',
                  conceptionSample: 0.99, deathSample: 0.99, drawnOff: YIN.drawnOff }
            ],
            onDay: 1,
            type: 'coerced'
        });
        const [ordinary, rare] = result.each;
        expect(rare.daysGivenUp).toBeCloseTo(ordinary.daysGivenUp * YIN.drawnOff, 10);
        expect(result.daysStolen).toBeCloseTo(ordinary.daysGivenUp + rare.daysGivenUp, 10);
        // The stale rule this replaced: a caller dividing the total by the
        // number of people would have charged the ordinary body for what the
        // other one gave.
        expect(ordinary.daysGivenUp).not.toBeCloseTo(result.daysStolen / 2, 5);
    });

    it('is worth the same whichever way round the two sexes are', () => {
        // The furnace mechanic is sex-neutral by construction and a physique
        // must not smuggle a preference into it.
        const drawnFromAWoman = drawn(YIN.drawnOff, 'female').daysStolen;
        const other = useAFurnaceTechnique({
            actor: { personId: 'a', name: 'The one drawing', sex: 'female' },
            subjects: [{
                personId: 'b', name: 'The one drawn off', sex: 'male',
                conceptionSample: 0.99, deathSample: 0.99, drawnOff: YANG.drawnOff
            }],
            onDay: 1,
            type: 'coerced'
        });
        expect(other.daysStolen).toBe(drawnFromAWoman);
    });

    it('charges a body that did not survive the draw for what it gave', () => {
        const killed = useAFurnaceTechnique({
            actor: { personId: 'a', name: 'The one drawing', sex: 'male' },
            subjects: [{
                personId: 'b', name: 'The one drawn off', sex: 'female',
                conceptionSample: 0.99, deathSample: 0, drawnOff: YIN.drawnOff
            }],
            onDay: 1,
            type: 'coerced'
        });
        expect(killed.each[0].died).toBe(true);
        expect(killed.each[0].daysGivenUp).toBeGreaterThan(0);
        expect(killed.daysStolen).toBe(killed.each[0].daysGivenUp);
    });

    it('prices a body nobody authored, because it reads a number and not a key', () => {
        expect(drawn(NOT_IN_ANY_CATALOG.drawnOff).daysStolen)
            .toBeCloseTo(drawn(1).daysStolen * NOT_IN_ANY_CATALOG.drawnOff, 10);
        expect(cultivationSpeedOf(NOT_IN_ANY_CATALOG)).toBe(2.5);
        expect(lifespanWithPhysique(100, NOT_IN_ANY_CATALOG)).toBe(50);
        expect(describePhysique(NOT_IN_ANY_CATALOG)).toContain('A Body Nobody Authored');
    });
});
