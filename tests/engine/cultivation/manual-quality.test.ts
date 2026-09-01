/**
 * The second axis of a manual: how well it is written, and what the reader
 * takes out of it.
 *
 * The properties here are the design, not the tuning. Every number in
 * `MANUAL_QUALITY_TIERS` may be retuned; none of these inequalities may stop
 * holding, because each of them is a sentence somebody said about the world.
 */

import { describe, it, expect } from 'vitest';
import {
    MANUAL_QUALITY_ORDER,
    MANUAL_QUALITY_TIERS,
    canTellApart,
    degradedCopy,
    manualQualityRank,
    readManual,
    readerComprehension
} from '../../../src/engine/cultivation/manual-quality.js';
import {
    DAYS_PER_YEAR,
    computeCultivationRate
} from '../../../src/engine/cultivation/cultivation.js';
import { computeBreakthroughOdds } from '../../../src/engine/cultivation/breakthrough.js';
import { TECHNIQUES, MANUAL_QUALITY } from '../../../src/data/cultivation/techniques.js';
import { ORIGIN_TIERS } from '../../../src/engine/cultivation/origin.js';
import { ManualQualitySchema, type InnateAttributes } from '../../../src/schema/cultivation.js';

const MEDIOCRE: InnateAttributes = { might: 2, insight: 2, fortune: 1, charm: 2 };
const PRODIGY: InnateAttributes = { might: 3, insight: 4, fortune: 2, charm: 2 };

const reader = (attributes: InnateAttributes) => ({
    spiritRoot: 'dual_metal_wood' as const,
    attributes
});

const ratePerYear = (
    attributes: InnateAttributes,
    quality: (typeof MANUAL_QUALITY_ORDER)[number] | undefined,
    ordinal = 17
) => computeCultivationRate(
    { spiritRoot: 'dual_metal_wood', injuries: [], realmOrdinal: ordinal, attributes },
    'normal',
    quality === undefined ? {} : { techniqueQuality: quality }
).perDay * DAYS_PER_YEAR;

describe('the tier ladder', () => {
    it('is ordered on every effect it has', () => {
        for (let i = 1; i < MANUAL_QUALITY_ORDER.length; i++) {
            const lower = MANUAL_QUALITY_TIERS[MANUAL_QUALITY_ORDER[i - 1]];
            const higher = MANUAL_QUALITY_TIERS[MANUAL_QUALITY_ORDER[i]];
            expect(higher.rate).toBeGreaterThan(lower.rate);
            expect(higher.preparation).toBeGreaterThan(lower.preparation);
            expect(higher.power).toBeGreaterThan(lower.power);
            expect(higher.demand).toBeGreaterThanOrEqual(lower.demand);
        }
        expect(MANUAL_QUALITY_ORDER.map(manualQualityRank)).toEqual([0, 1, 2, 3, 4]);
        expect([...MANUAL_QUALITY_ORDER].sort())
            .toEqual([...ManualQualitySchema.options].sort());
    });

    it('has `sound` as the identity element on all three effects', () => {
        const t = MANUAL_QUALITY_TIERS.sound;
        expect(t.rate).toBe(1);
        expect(t.preparation).toBe(0);
        expect(t.power).toBe(1);
    });

    it('asks nothing at the bottom, so a bad book is slow and never a trap', () => {
        // The guarantee that keeps ordinary cultivators in the world. If a
        // plain book could punish a dull reader for being dull, nobody without
        // talent could climb at all and the setting would have no population.
        expect(MANUAL_QUALITY_TIERS.corrupt.demand).toBe(0);
        expect(MANUAL_QUALITY_TIERS.crude.demand).toBe(0);
        for (const attrs of [MEDIOCRE, PRODIGY]) {
            for (const q of ['corrupt', 'crude'] as const) {
                expect(readManual({ quality: q }, reader(attrs)).realised).toBe(1);
            }
        }
    });
});

describe('what the reader takes out of it', () => {
    it('leaves an undeclared manual completely inert', () => {
        // Not the same as a `sound` one: `sound` has a demand, so conflating
        // them would make a caller that never heard of this axis start paying a
        // shortfall on a manual it never named.
        const none = readManual(null, reader({ ...MEDIOCRE, insight: 1 }));
        expect(none.rateMultiplier).toBe(1);
        expect(none.breakthroughModifier).toBe(0);
        expect(none.powerMultiplier).toBe(1);
        expect(ratePerYear(MEDIOCRE, undefined)).toBeCloseTo(ratePerYear(MEDIOCRE, 'sound'), 8);
    });

    it('gives a prodigy the whole of a great book and a mediocre reader a fraction', () => {
        const good = readManual({ quality: 'pristine' }, reader(PRODIGY));
        const poor = readManual({ quality: 'pristine' }, reader(MEDIOCRE));
        expect(poor.shortfall).toBeGreaterThan(good.shortfall);
        expect(poor.realised).toBeLessThan(good.realised);
        expect(poor.rateMultiplier).toBeLessThan(good.rateMultiplier);
    });

    it('makes a manual far above the reader WORSE than one pitched at them', () => {
        // The rule that stops the axis being a shopping list. The years were
        // spent and nothing was understood, so the great canon is not merely
        // wasted - it is a loss against the plain book they could have read.
        const plain = readManual({ quality: 'sound' }, reader(MEDIOCRE));
        const overHead = readManual({ quality: 'pristine' }, reader(MEDIOCRE));
        expect(overHead.rateMultiplier).toBeLessThan(plain.rateMultiplier);
        expect(ratePerYear(MEDIOCRE, 'pristine')).toBeLessThan(ratePerYear(MEDIOCRE, 'sound'));
        // And the same book is a straight gain to somebody who can read it.
        expect(ratePerYear(PRODIGY, 'pristine')).toBeGreaterThan(ratePerYear(PRODIGY, 'sound'));
    });

    it('never makes a book somebody cannot read a liability in a fight', () => {
        // The deliberate asymmetry with the rate. An art you do not understand
        // is an art you do not use; time on the wrong canon is lost, strength
        // you never had was never yours to lose.
        for (const q of MANUAL_QUALITY_ORDER) {
            const r = readManual({ quality: q }, reader(MEDIOCRE));
            const floor = Math.min(1, MANUAL_QUALITY_TIERS[q].power);
            expect(r.powerMultiplier).toBeGreaterThanOrEqual(floor - 1e-9);
        }
    });

    it('counts insight, what has actually been seen, and the foundation', () => {
        const bare = readerComprehension(reader(MEDIOCRE));
        expect(bare.degrees).toBe(2);

        const founded = readerComprehension({
            ...reader(MEDIOCRE), foundationQuality: 'exceptional'
        });
        expect(founded.degrees).toBeGreaterThan(bare.degrees);

        const seen = readerComprehension({
            ...reader(MEDIOCRE),
            insights: [{
                id: 'i1', subject: 'metal', domain: 'element', degree: 3,
                formedOnDay: 0, sourceNote: 'test'
            }]
        }, { techniqueElement: 'metal' });
        expect(seen.fromSeen).toBeGreaterThan(0);
        expect(seen.degrees).toBeGreaterThan(bare.degrees);
    });
});

describe('the crossing', () => {
    it('moves the odds by preparation, at every boundary, in tier order', () => {
        const odds = (q: (typeof MANUAL_QUALITY_ORDER)[number], at: number) =>
            computeBreakthroughOdds(
                {
                    realmOrdinal: at, spiritRoot: 'dual_metal_wood',
                    attributes: MEDIOCRE, injuries: [], cultivationProgress: 0
                },
                { ambient: 'normal', pill: null, manualQuality: q }
            ).finalChance;
        for (const at of [12, 20, 28]) {
            for (let i = 1; i < MANUAL_QUALITY_ORDER.length; i++) {
                expect(odds(MANUAL_QUALITY_ORDER[i], at))
                    .toBeGreaterThan(odds(MANUAL_QUALITY_ORDER[i - 1], at));
            }
        }
    });

    it('books the line beside the foundation and never beside the tribulation', () => {
        const odds = computeBreakthroughOdds(
            {
                realmOrdinal: 20, spiritRoot: 'dual_metal_wood',
                attributes: MEDIOCRE, injuries: [], cultivationProgress: 0
            },
            { ambient: 'normal', pill: null, manualQuality: 'refined' }
        );
        const sources = odds.modifiers.map(m => m.source);
        expect(sources).toContain('manual:refined');
        // The ledger must still sum exactly to the final chance.
        expect(odds.modifiers.reduce((s, m) => s + m.delta, 0))
            .toBeCloseTo(odds.finalChance, 10);
    });
});

describe('a copy made by somebody who never mastered it', () => {
    it('comes out one step down, and no further than a damaged text', () => {
        expect(degradedCopy('pristine')).toBe('refined');
        expect(degradedCopy('sound')).toBe('crude');
        expect(degradedCopy('crude')).toBe('corrupt');
        expect(degradedCopy('corrupt')).toBe('corrupt');
    });
});

describe('telling two books apart', () => {
    it('is possible for a reader who could have used the better one', () => {
        const stall = { quality: 'crude' as const };
        const worked = { quality: 'refined' as const };
        expect(canTellApart(stall, worked, reader(PRODIGY))).toBe(true);
        expect(canTellApart(stall, stall, reader(PRODIGY))).toBe(false);
    });

    it('is symmetric in its arguments', () => {
        const a = { quality: 'crude' as const };
        const b = { quality: 'pristine' as const };
        for (const attrs of [MEDIOCRE, PRODIGY]) {
            expect(canTellApart(a, b, reader(attrs))).toBe(canTellApart(b, a, reader(attrs)));
        }
    });
});

describe('the catalog', () => {
    const manuals = TECHNIQUES.filter(t => t.class === 'cultivation');

    it('authors a quality on every cultivation manual', () => {
        for (const m of manuals) {
            expect(MANUAL_QUALITY[m.id], `${m.id} is not in MANUAL_QUALITY`).toBeDefined();
            expect(ManualQualitySchema.safeParse(m.quality).success).toBe(true);
        }
    });

    it('does not let quality collapse onto grade', () => {
        // The whole reason the field exists. If quality were a function of
        // grade it would be `grade` with extra steps, and the market primer
        // against an apex intake canon - identical rungs, therefore identical
        // grade - could never be expressed.
        const byGrade = new Map<string, Set<string>>();
        for (const m of manuals) {
            if (!byGrade.has(m.grade)) byGrade.set(m.grade, new Set());
            byGrade.get(m.grade)!.add(m.quality);
        }
        const spread = [...byGrade.values()].filter(s => s.size > 1).length;
        expect(spread, 'no grade holds two different qualities').toBeGreaterThan(1);
    });

    it('separates the market primer from a house intake canon over identical rungs', () => {
        const stall = manuals.find(m => m.id === 'lesser-qi-gathering-manual')!;
        const house = manuals.find(m => m.id === 'azure-dew-gathering-canon')!;
        expect(house.requiredOrdinal).toBe(stall.requiredOrdinal);
        expect(house.cap).toBe(stall.cap);
        expect(house.grade).toBe(stall.grade);
        expect(house.element).toBe(stall.element);
        expect(manualQualityRank(house.quality))
            .toBeGreaterThan(manualQualityRank(stall.quality));
    });

    it('lets a chaos-grade manual be poor or excellent', () => {
        // A standing question when chaos was ruled to be a SHAPE - what a
        // demonic method looks like at any altitude - rather than a sixth rung
        // on a five-rung height ladder. A shoddy demonic method and a superb
        // one are both demonic, so `chaos` cannot itself be a quality value.
        // Because quality is its own field, this needs no special handling and
        // is simply true of the catalog as authored.
        const chaos = manuals.filter(m => m.grade === 'chaos').map(m => m.quality);
        expect(new Set(chaos).size, 'every chaos manual is the same quality')
            .toBeGreaterThan(1);
        expect(Math.min(...chaos.map(manualQualityRank)))
            .toBeLessThan(manualQualityRank('sound'));
        expect(Math.max(...chaos.map(manualQualityRank)))
            .toBeGreaterThan(manualQualityRank('sound'));
    });

    it('keeps the mass-copy tier at the bottom of the ladder', () => {
        // `crude` takes a crowd of non-masters copying for each other, and that
        // crowd stops existing above Core Formation - anybody who reached
        // Nascent Soul is already an exception. So a bad book up there is
        // `corrupt` (damaged), never `crude` (worn out by copying).
        for (const m of manuals) {
            if (m.quality !== 'crude') continue;
            expect(m.cap, `${m.id} is crude above Core Formation`).not.toBeNull();
            expect(m.cap!, `${m.id} is crude above Core Formation`).toBeLessThanOrEqual(21);
        }
    });
});

describe('an origin hands over a book', () => {
    it('says which one, for every tier, and better standing never means worse', () => {
        let previous = -1;
        for (const tier of ORIGIN_TIERS) {
            expect(ManualQualitySchema.safeParse(tier.roadQuality).success).toBe(true);
            const rank = manualQualityRank(tier.roadQuality);
            expect(rank, `${tier.key} holds a worse road than a poorer origin`)
                .toBeGreaterThanOrEqual(previous);
            previous = rank;
        }
    });

    it('leaves an unbacked birth on a book that still works', () => {
        const road = ORIGIN_TIERS[0].roadQuality;
        expect(MANUAL_QUALITY_TIERS[road].rate).toBeGreaterThan(0);
        expect(MANUAL_QUALITY_TIERS[road].demand).toBe(0);
    });
});
