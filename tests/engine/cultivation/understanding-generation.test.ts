/**
 * Where understanding actually comes from.
 *
 * The rule this file exists to defend: achievements EMERGE FROM EVENTS THAT
 * ACTUALLY OCCURRED. Never a scheduler, never a flat probability, never
 * because a cultivator is due one. So the tests are mostly about what does
 * NOT happen - an ordinary decade produces nothing, a rich decade produces
 * nothing, and the only things that produce insight are things the simulation
 * had already resolved.
 */

import { simulateTimeSkip, type TimeSkipContext } from '../../../src/engine/cultivation/time-skip.js';
import { DAYS_PER_YEAR } from '../../../src/engine/cultivation/cultivation.js';
import {
    INSIGHT_CHECK_DAYS,
    VISION_CHECK_DAYS,
    isTraceable
} from '../../../src/engine/cultivation/understanding.js';
import { progressRequiredForOrdinal } from '../../../src/engine/cultivation/realms.js';
import { makeCultivator } from './fixtures.js';

const TEN_YEARS = 10 * DAYS_PER_YEAR;

function ctx(overrides: Partial<TimeSkipContext> = {}): TimeSkipContext {
    return {
        seed: 'understanding-run',
        locationId: 'azure-cloud-peak',
        grainAbstinence: true,
        ...overrides
    };
}

/** A cultivator whose progress bar cannot fill, so skips stay uneventful. */
function secluded(overrides = {}) {
    return makeCultivator({ spiritRoot: 'single_fire', realmOrdinal: 20, ...overrides });
}

/** Aggregate a seed sweep. */
function sweep(runs: number, build: (i: number) => { cultivator: ReturnType<typeof makeCultivator>; context: TimeSkipContext }) {
    let achievements = 0;
    let insights = 0;
    let visions = 0;
    let withAny = 0;
    for (let i = 0; i < runs; i++) {
        const { cultivator, context } = build(i);
        const result = simulateTimeSkip(cultivator, TEN_YEARS, context);
        achievements += result.achievements.length;
        insights += result.insightsGained.length;
        visions += result.visions.length;
        if (result.insightsGained.length > 0) withAny++;
    }
    return { achievements, insights, visions, withAny, runs };
}

describe('most cultivators comprehend nothing, and that is correct', () => {
    it('gives an ordinary decade in ordinary qi exactly nothing', () => {
        const result = simulateTimeSkip(
            secluded(),
            TEN_YEARS,
            ctx({ randomEvents: false, autoBreakthrough: false })
        );
        expect(result.achievements).toEqual([]);
        expect(result.insightsGained).toEqual([]);
        expect(result.visions).toEqual([]);
    });

    it('gives a wealthy, high-ranked, long-lived idler nothing either', () => {
        // There is no term anywhere for stones, rank or time served.
        const result = simulateTimeSkip(
            secluded({ spiritStones: 5_000_000, age: 400, realmOrdinal: 30 }),
            TEN_YEARS,
            ctx({ randomEvents: false, autoBreakthrough: false })
        );
        expect(result.insightsGained).toEqual([]);
    });

    it('leaves most of a large sweep with nothing, even under good conditions', () => {
        const swept = sweep(120, i => ({
            cultivator: secluded({ attributes: { might: 2, insight: 4, fortune: 1, charm: 2 } }),
            context: ctx({
                seed: `ordinary-${i}`,
                randomEvents: false,
                autoBreakthrough: false,
                techniqueElement: 'fire',
                understanding: { techniqueElement: 'fire', techniqueSubjects: ['sword'] }
            })
        }));
        // Some get there. Most do not.
        expect(swept.withAny).toBeGreaterThan(0);
        expect(swept.withAny / swept.runs).toBeLessThan(0.5);
    });
});

describe('deliberate arrangement is rewarded, and never guaranteed', () => {
    it('makes a prepared decade at a site of understanding measurably better', () => {
        const bare = sweep(120, i => ({
            cultivator: secluded(),
            context: ctx({ seed: `bare-${i}`, randomEvents: false, autoBreakthrough: false })
        }));
        const arranged = sweep(120, i => ({
            cultivator: secluded({ attributes: { might: 2, insight: 4, fortune: 1, charm: 2 } }),
            context: ctx({
                seed: `bare-${i}`,
                randomEvents: false,
                autoBreakthrough: false,
                techniqueElement: 'fire',
                understanding: {
                    techniqueElement: 'fire',
                    techniqueSubjects: ['sword'],
                    locationTags: ['forbidden_river']
                }
            })
        }));
        expect(arranged.insights).toBeGreaterThan(bare.insights);
        // Still not a certainty for anyone.
        expect(arranged.withAny).toBeLessThan(arranged.runs);
    });

    it('checks on a fixed grid, so nothing can be produced off it', () => {
        const swept = [];
        for (let i = 0; i < 200; i++) {
            const result = simulateTimeSkip(
                secluded({ attributes: { might: 2, insight: 4, fortune: 1, charm: 2 } }),
                TEN_YEARS,
                ctx({
                    seed: `grid-${i}`,
                    randomEvents: false,
                    autoBreakthrough: false,
                    understanding: { locationTags: ['forbidden_river'] }
                })
            );
            swept.push(...result.events.filter(e => e.kind === 'achievement'));
        }
        expect(swept.length).toBeGreaterThan(0);
        for (const event of swept) {
            expect(event.dayOffset % INSIGHT_CHECK_DAYS).toBe(0);
        }
    });
});

describe('achievements come from things that actually happened', () => {
    it('produces one from a survived tribulation, and records the event', () => {
        let found = null;
        for (let i = 0; i < 600 && found === null; i++) {
            const result = simulateTimeSkip(
                makeCultivator({ realmOrdinal: 41, cultivationProgress: 1e12 }),
                1,
                ctx({ seed: `trib-${i}`, randomEvents: false, toll: { candidates: [] } })
            );
            if (result.achievements.some(a => a.kind === 'survived_extraordinary')) found = result;
        }
        expect(found).not.toBeNull();

        const achievement = found!.achievements.find(a => a.kind === 'survived_extraordinary')!;
        expect(achievement.summary).toContain('tribulation');
        expect(achievement.detail.strikes).toBeGreaterThan(0);
        // The tribulation genuinely happened in the same skip.
        expect(
            found!.events.some(
                e => e.kind === 'breakthrough_success' && e.data.tribulation !== null
            )
        ).toBe(true);
    });

    it('opens comprehensions that only surviving lightning could open', () => {
        let found = null;
        for (let i = 0; i < 600 && found === null; i++) {
            const result = simulateTimeSkip(
                makeCultivator({ realmOrdinal: 41, cultivationProgress: 1e12 }),
                1,
                ctx({ seed: `trib-i-${i}`, randomEvents: false, toll: { candidates: [] } })
            );
            if (result.insightsGained.length > 0) found = result;
        }
        expect(found).not.toBeNull();
        const insight = found!.insightsGained[0];
        expect(['life_death', 'void', 'element']).toContain(insight.domain);
        expect(insight.provenance.account).toContain('tribulation');
    });

    it('produces one from a crippling qi deviation survived', () => {
        let found = null;
        for (let i = 0; i < 200 && found === null; i++) {
            const result = simulateTimeSkip(
                makeCultivator({
                    spiritRoot: 'dual_water_fire',
                    realmOrdinal: 20,
                    maxHp: 5000,
                    hp: 5000
                }),
                50 * DAYS_PER_YEAR,
                ctx({ seed: `dev-${i}`, randomEvents: false, autoBreakthrough: false })
            );
            if (result.achievements.some(a => a.kind === 'profound_principle')) found = result;
        }
        expect(found).not.toBeNull();
        const achievement = found!.achievements.find(a => a.kind === 'profound_principle')!;
        expect(achievement.detail.severity).toBe('crippling');
        // The deviation is in the same digest, at the same day.
        expect(
            found!.events.some(
                e => e.kind === 'qi_deviation' && e.dayOffset === achievement.onDay
            )
        ).toBe(true);
    });

    it('never emits an insight without the achievement that produced it', () => {
        for (let i = 0; i < 200; i++) {
            const result = simulateTimeSkip(
                secluded({ attributes: { might: 2, insight: 4, fortune: 1, charm: 2 } }),
                TEN_YEARS,
                ctx({
                    seed: `trace-${i}`,
                    randomEvents: false,
                    autoBreakthrough: false,
                    understanding: { locationTags: ['forbidden_river'] }
                })
            );
            expect(isTraceable(result.insightsGained)).toBe(true);
            const ids = new Set(result.achievements.map(a => a.id));
            for (const insight of result.insightsGained) {
                expect(ids.has(insight.provenance.achievementId)).toBe(true);
            }
            // Never more insights than achievements: each one had a cause.
            expect(result.insightsGained.length).toBeLessThanOrEqual(result.achievements.length);
        }
    });
});

describe('temporal phenomena', () => {
    it('are exceptionally rare, and arrive as beliefs rather than power', () => {
        let found = null;
        let totalVisions = 0;
        const runs = 400;
        for (let i = 0; i < runs; i++) {
            const result = simulateTimeSkip(
                secluded(),
                TEN_YEARS,
                ctx({
                    seed: `vision-${i}`,
                    randomEvents: false,
                    autoBreakthrough: false,
                    understanding: { locationTags: ['tribulation_scar'] }
                })
            );
            totalVisions += result.visions.length;
            if (result.visions.length > 0 && found === null) found = result;
        }
        expect(found).not.toBeNull();
        // Profound events, not a mechanic anyone relies on.
        expect(totalVisions / runs).toBeLessThan(0.25);

        const vision = found!.visions[0];
        expect(vision.factId).toBeNull();
        expect(vision.stance).toBe('believes');
        expect(vision.source.kind).toBe('divined');
        expect(vision.holderId).toBe(found!.visions[0].holderId);
    });

    it('grant no capability whatsoever', () => {
        // The structural claim, not a coincidence check: the vision path mints
        // no achievement, and every insight traces to one. So however many
        // visions a run produces, none of them can have become capability.
        let sawVisions = 0;
        for (let i = 0; i < 400; i++) {
            const result = simulateTimeSkip(
                secluded(),
                TEN_YEARS,
                ctx({
                    seed: `nocap-${i}`,
                    randomEvents: false,
                    autoBreakthrough: false,
                    understanding: { locationTags: ['tribulation_scar'] }
                })
            );
            if (result.visions.length === 0) continue;
            sawVisions++;

            // Achievements are exactly the recorded 'achievement' events:
            // visions add none, so they cannot enter the insight pipeline.
            expect(result.achievements.length).toBe(
                result.events.filter(e => e.kind === 'achievement').length
            );
            const achievementIds = new Set(result.achievements.map(a => a.id));
            for (const insight of result.insightsGained) {
                expect(achievementIds.has(insight.provenance.achievementId)).toBe(true);
            }
            // And the seed itself carries nothing the engine reads back.
            for (const vision of result.visions) {
                expect(vision.factId).toBeNull();
                expect(Object.keys(vision)).not.toContain('degree');
                expect(Object.keys(vision)).not.toContain('insight');
            }
        }
        expect(sawVisions).toBeGreaterThan(0);
    });

    it('checks on its own much rarer grid', () => {
        expect(VISION_CHECK_DAYS).toBeGreaterThan(INSIGHT_CHECK_DAYS);
        for (let i = 0; i < 200; i++) {
            const result = simulateTimeSkip(
                secluded(),
                TEN_YEARS,
                ctx({
                    seed: `vgrid-${i}`,
                    randomEvents: false,
                    autoBreakthrough: false,
                    understanding: { locationTags: ['tribulation_scar'] }
                })
            );
            for (const event of result.events.filter(e => e.kind === 'vision')) {
                expect(event.dayOffset % VISION_CHECK_DAYS).toBe(0);
            }
        }
    });
});

describe('NPCs acquire understanding the same way', () => {
    it('runs the identical path for an npc-kind cultivator', () => {
        // Nothing anywhere in the subsystem reads `kind`. A weaker-ranked NPC
        // can be genuinely dangerous for exactly this reason.
        const shared = {
            realmOrdinal: 20,
            spiritRoot: 'single_fire' as const,
            attributes: { might: 2, insight: 4, fortune: 1, charm: 2 }
        };
        const context = ctx({
            seed: 'npc-parity',
            randomEvents: false,
            autoBreakthrough: false,
            understanding: { locationTags: ['forbidden_river'] }
        });
        const pc = simulateTimeSkip(makeCultivator({ ...shared, kind: 'pc' }), TEN_YEARS, context);
        const npc = simulateTimeSkip(makeCultivator({ ...shared, kind: 'npc' }), TEN_YEARS, context);

        expect(npc.insightsGained.length).toBe(pc.insightsGained.length);
        expect(npc.achievements.map(a => a.kind)).toEqual(pc.achievements.map(a => a.kind));
    });
});

describe('understanding changes what a skip does', () => {
    it('lets an insight carry a cultivator across a bottleneck during a skip', () => {
        const required = progressRequiredForOrdinal(12);
        const shared = {
            spiritRoot: 'single_fire' as const,
            realmOrdinal: 12,
            cultivationProgress: required * 0.85
        };
        const context = ctx({ randomEvents: false, toll: { candidates: [] } });

        // Understanding is applied by hand here rather than waited for: the
        // question is whether the substitution reaches the skip's own
        // eligibility check, not whether an insight can be farmed.
        const shallow = simulateTimeSkip(makeCultivator(shared), 1, context);
        const deep = simulateTimeSkip(
            makeCultivator({
                ...shared,
                insights: [
                    {
                        id: 'insight:ach-1:life_death:mortality',
                        domain: 'life_death',
                        subject: 'mortality',
                        degree: 5,
                        provenance: {
                            achievementId: 'ach-1',
                            achievementKind: 'survived_extraordinary',
                            onDay: 1,
                            deepenedBy: [],
                            account: 'Survived something that kills people.'
                        }
                    }
                ]
            }),
            1,
            context
        );

        expect(shallow.events.some(e => e.kind.startsWith('breakthrough_'))).toBe(false);
        expect(deep.events.some(e => e.kind.startsWith('breakthrough_'))).toBe(true);
    });
});
