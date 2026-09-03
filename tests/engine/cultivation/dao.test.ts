/**
 * Your Dao: derived, access-gated, and never announced.
 *
 * Four things this file defends, in rough order of how badly a regression
 * would hurt:
 *
 *   1. A Dao cannot exist without the comprehension behind it, because there
 *      is nowhere to put one. It is derived, every time.
 *   2. Access is a HARD FILTER. Without exposure a Dao is absent, not harder,
 *      and effort does not widen the set.
 *   3. Affinity is rolled at creation, never surfaced, and is the slope rather
 *      than the filter.
 *   4. Nothing warns anyone about anything, ever.
 */

import { type Insight, type InsightDegree, type InsightDomain } from '../../../src/schema/cultivation.js';
import {
    AFFINITY_INITIAL_DEGREE,
    AFFINITY_WEIGHT,
    DAO_DEGREE,
    LEANING_DEGREE,
    NARROWING_PENALTY,
    affinityFor,
    daoGate,
    daoMatches,
    daoName,
    daoOf,
    isRecognition,
    narrowingWeight,
    pickNarrowed
} from '../../../src/engine/cultivation/dao.js';
import {
    bottleneckSubstitution,
    discoverableInsights,
    hasAccessTo,
    formInsight,
    recordAchievement
} from '../../../src/engine/cultivation/understanding.js';
import { CultivationRNG, forStream } from '../../../src/engine/cultivation/rng.js';
import { makeCultivator } from './fixtures.js';

const ACCESS = { kind: 'teacher' as const, label: 'a willing teacher' };

function insight(domain: InsightDomain, subject: string, degree: InsightDegree, seed = 's'): Insight {
    const achievement = recordAchievement(
        { kind: 'meditative_state', onDay: 1, turn: 1, summary: 'Something happened.' },
        new CultivationRNG(seed)
    );
    return formInsight({ domain, subject, opening: 'o', access: ACCESS }, degree, achievement);
}

describe('a Dao is derived, never stored', () => {
    it('is nothing for a cultivator who has comprehended nothing', () => {
        expect(daoOf([]).standing).toBe('none');
        expect(daoOf([]).subject).toBeNull();
        expect(daoOf([]).name).toBeNull();
    });

    it('is nothing for a scatter of shallow insights', () => {
        const scattered = [
            insight('element', 'fire', 1, 'a'),
            insight('weapon', 'sword', 2, 'b'),
            insight('karma', 'debt', 1, 'c')
        ];
        expect(daoOf(scattered).standing).toBe('none');
    });

    it('becomes a leaning at depth in one subject', () => {
        const dao = daoOf([insight('weapon', 'sword', LEANING_DEGREE)]);
        expect(dao.standing).toBe('leaning');
        expect(dao.subject).toBe('sword');
        // A leaning has no name. Others notice; nobody has named it yet.
        expect(dao.name).toBeNull();
    });

    it('becomes a Dao at heart degree, reinforced', () => {
        const dao = daoOf([
            insight('weapon', 'sword', DAO_DEGREE, 'a'),
            insight('weapon', 'spear', 2, 'b')
        ]);
        expect(dao.standing).toBe('dao');
        expect(dao.name).toBe('the Dao of the Sword');
        expect(dao.breadth).toBeGreaterThan(0);
    });

    it('refuses to name a towering insight that stands alone', () => {
        // Reinforced, not solitary: a remarkable thing a person knows is not a
        // road they walk.
        const solitary = daoOf([insight('weapon', 'sword', 5)]);
        expect(solitary.standing).toBe('leaning');
        expect(solitary.name).toBeNull();
    });

    it('names elements and abstractions without the article', () => {
        expect(daoName('water', 'element')).toBe('the Dao of Water');
        expect(daoName('sword', 'weapon')).toBe('the Dao of the Sword');
        expect(daoName('mortality', 'life_death')).toBe('the Dao of Mortality');
    });

    it('is stable regardless of the order rows came back in', () => {
        const set = [
            insight('weapon', 'sword', 4, 'a'),
            insight('weapon', 'spear', 3, 'b'),
            insight('element', 'fire', 2, 'c')
        ];
        const forward = daoOf(set);
        const reversed = daoOf([...set].reverse());
        expect(reversed).toEqual(forward);
    });

    it('has nowhere for a writer to put one', () => {
        // The structural claim: no field, no setter. A cultivator record
        // carries insights, and the Dao is recomputed from them every time.
        const cultivator = makeCultivator();
        expect('dao' in cultivator).toBe(false);
        expect('daoStanding' in cultivator).toBe(false);
    });
});

describe('it gates the highest arts', () => {
    const swordDao = daoOf([
        insight('weapon', 'sword', 5, 'a'),
        insight('weapon', 'spear', 2, 'b')
    ]);
    const none = daoOf([]);

    it('lets anyone learn the ordinary grades', () => {
        for (const grade of ['mortal', 'earth', 'heaven'] as const) {
            expect(daoGate(none, { grade }).permitted).toBe(true);
        }
    });

    it('refuses a top-grade art to someone who has walked no road', () => {
        const refused = daoGate(none, { grade: 'chaos', subjects: ['sword'] });
        expect(refused.permitted).toBe(false);
        expect(refused.reason).toBe('no_matching_dao');
        // The manual is legible. That is the point.
        expect(refused.detail).toContain('legible');
    });

    it('refuses a top-grade art to someone who walked a DIFFERENT road', () => {
        const refused = daoGate(swordDao, { grade: 'chaos', subjects: ['formation'] });
        expect(refused.permitted).toBe(false);
        expect(refused.reason).toBe('wrong_dao');
    });

    it('opens it to the matching road', () => {
        expect(daoGate(swordDao, { grade: 'chaos', subjects: ['sword'] }).permitted).toBe(true);
    });

    it('matches an elemental Dao against an art of that element', () => {
        const waterDao = daoOf([
            insight('element', 'water', 5, 'a'),
            insight('element', 'ice', 2, 'b')
        ]);
        expect(daoMatches(waterDao, { grade: 'chaos', element: 'water' })).toBe(true);
        expect(daoMatches(waterDao, { grade: 'chaos', element: 'fire' })).toBe(false);
    });

    it('opens forbidden arts to comprehensions about existence', () => {
        const karmaDao = daoOf([
            insight('karma', 'debt', 4, 'a'),
            insight('karma', 'obligation', 3, 'b')
        ]);
        expect(
            daoGate(karmaDao, { grade: 'chaos', category: 'forbidden' }).permitted
        ).toBe(true);
    });

    it('does not tell the refused reader which road would have opened it', () => {
        const refused = daoGate(swordDao, { grade: 'chaos', subjects: ['formation'] });
        expect(refused.detail).not.toMatch(/formation/i);
        expect(JSON.stringify(refused)).not.toMatch(/should|suited|instead|try/i);
    });
});

describe('it narrows as it deepens', () => {
    const deep = daoOf([
        insight('weapon', 'sword', 5, 'a'),
        insight('weapon', 'spear', 4, 'b'),
        insight('weapon', 'blade', 3, 'c')
    ]);

    it('leaves an uncommitted cultivator entirely open', () => {
        const open = daoOf([]);
        expect(narrowingWeight(open, { domain: 'alchemy', subject: 'refinement' })).toBe(1);
    });

    it('costs a far subject more than a near one', () => {
        const own = narrowingWeight(deep, { domain: 'weapon', subject: 'sword' });
        const near = narrowingWeight(deep, { domain: 'weapon', subject: 'fist' });
        const far = narrowingWeight(deep, { domain: 'alchemy', subject: 'refinement' });
        expect(own).toBeGreaterThan(near);
        expect(near).toBeGreaterThan(far);
        expect(own).toBe(1);
    });

    it('closes doors without ever locking them', () => {
        // Not forbidden. Increasingly foreign.
        const far = narrowingWeight(deep, { domain: 'alchemy', subject: 'refinement' });
        expect(far).toBeGreaterThan(0);
        expect(NARROWING_PENALTY.distant).toBeLessThan(1);
    });

    it('narrows more the further along the road goes', () => {
        const shallow = daoOf([insight('weapon', 'sword', 3, 'a'), insight('weapon', 'spear', 1, 'b')]);
        const distant = { domain: 'alchemy' as const, subject: 'refinement' };
        expect(narrowingWeight(deep, distant)).toBeLessThan(narrowingWeight(shallow, distant));
    });

    it('consumes exactly one sample however many candidates there are', () => {
        const a = forStream('align', 'pick', 1);
        const b = forStream('align', 'pick', 1);
        pickNarrowed(a, [{ domain: 'weapon' as const, subject: 'sword' }], daoOf([]));
        pickNarrowed(
            b,
            Array.from({ length: 30 }, (_, i) => ({ domain: 'karma' as const, subject: `d${i}` })),
            deep
        );
        expect(a.next()).toBe(b.next());
    });
});

describe('access is a hard filter', () => {
    const hermit = makeCultivator({ spiritRoot: 'single_fire' });

    it('gives an isolated cultivator only what they were born with', () => {
        const reach = discoverableInsights(hermit, {});
        expect(reach.length).toBeGreaterThan(0);
        for (const candidate of reach) {
            expect(candidate.access.kind).toBe('own_root');
            expect(candidate.domain).toBe('element');
        }
    });

    it('makes an unreachable Dao absent rather than merely hard', () => {
        // Not a low weight. Not in the list at all.
        expect(discoverableInsights(hermit, {}).some(c => c.subject === 'sword')).toBe(false);
        expect(hasAccessTo(hermit, { domain: 'weapon', subject: 'sword' }, {})).toBeNull();
    });

    it('does not widen with effort, only with exposure', () => {
        // There is no parameter here that time, diligence or wealth could move.
        const before = discoverableInsights(hermit, {}).length;
        const stillAlone = discoverableInsights(
            makeCultivator({ spiritRoot: 'single_fire', age: 900, spiritStones: 9_000_000, realmOrdinal: 30 }),
            {}
        ).length;
        expect(stillAlone).toBe(before);

        // A room is what changes it.
        const admitted = discoverableInsights(hermit, {
            tradition: { subject: 'debt', label: 'the Ninefold Pavilion' }
        });
        expect(admitted.length).toBeGreaterThan(before);
    });

    it('records which source put each candidate within reach', () => {
        const disciple = discoverableInsights(hermit, {
            teachers: [{ subject: 'sword', label: 'Elder Shu' }],
            readableManuals: [{ element: 'water', label: "the Pavilion's inner library" }],
            locationTags: ['tribulation_scar'],
            inheritances: [{ subject: 'formation', label: 'a sealed tomb' }]
        });
        const bySubject = new Map(disciple.map(c => [c.subject, c]));
        expect(bySubject.get('sword')!.access.kind).toBe('teacher');
        expect(bySubject.get('sword')!.access.label).toBe('Elder Shu');
        expect(bySubject.get('water')!.access.kind).toBe('manual');
        expect(bySubject.get('the seam')!.access.kind).toBe('site');
        expect(bySubject.get('formation')!.access.kind).toBe('inheritance');
        for (const candidate of disciple) {
            expect(candidate.opening.length).toBeGreaterThan(0);
        }
    });

    it('makes a house principle reachable only from inside the house', () => {
        const outside = discoverableInsights(hermit, {});
        const inside = discoverableInsights(hermit, {
            tradition: { subject: 'debt', label: 'the Ninefold Pavilion' }
        });
        expect(outside.some(c => c.subject === 'debt')).toBe(false);
        expect(inside.some(c => c.subject === 'debt')).toBe(true);
        expect(hasAccessTo(hermit, { domain: 'karma', subject: 'debt' }, {
            tradition: { subject: 'debt', label: 'the Ninefold Pavilion' }
        })!.kind).toBe('tradition');
    });

    it('folds the access source into the provenance account', () => {
        const achievement = recordAchievement(
            { kind: 'meditative_state', onDay: 5, turn: 1, summary: 'Sat very still.' },
            new CultivationRNG('prov')
        );
        const built = formInsight(
            {
                domain: 'karma',
                subject: 'debt',
                opening: 'standing inside the Ninefold Pavilion',
                access: { kind: 'tradition', label: 'the Ninefold Pavilion' }
            },
            1,
            achievement
        );
        expect(built.provenance.account).toContain('Ninefold Pavilion');
        expect(built.provenance.account).toContain('tradition');
    });
});

describe('affinity is rolled at creation and never surfaced', () => {
    it('is a pure function of the run seed and the cultivator, from birth', () => {
        const target = { domain: 'karma' as const, subject: 'debt' };
        const first = affinityFor('run-1', 'cultivator-a', target);
        for (let i = 0; i < 20; i++) {
            expect(affinityFor('run-1', 'cultivator-a', target)).toBe(first);
        }
        // Nothing about what happened later can enter it: there is nowhere for
        // history to go in the signature.
        expect(affinityFor.length).toBe(3);
    });

    it('differs by cultivator and by run', () => {
        const target = { domain: 'weapon' as const, subject: 'sword' };
        const people = Array.from({ length: 200 }, (_, i) =>
            affinityFor('run-1', `c-${i}`, target)
        );
        expect(new Set(people).size).toBeGreaterThan(1);
        const runs = Array.from({ length: 200 }, (_, i) =>
            affinityFor(`run-${i}`, 'c-1', target)
        );
        expect(new Set(runs).size).toBeGreaterThan(1);
    });

    it('is extraordinary only very rarely', () => {
        const target = { domain: 'karma' as const, subject: 'debt' };
        const N = 20_000;
        const counts = { none: 0, aptitude: 0, strong: 0, extraordinary: 0 };
        for (let i = 0; i < N; i++) counts[affinityFor('run', `c-${i}`, target)]++;
        expect(counts.none / N).toBeGreaterThan(0.85);
        expect(counts.extraordinary / N).toBeLessThan(0.01);
        expect(counts.extraordinary).toBeGreaterThan(0);
    });

    it('has no field anywhere a UI could read', () => {
        const cultivator = makeCultivator();
        const serialised = JSON.stringify(cultivator);
        expect(serialised).not.toMatch(/affinity/i);
        expect('affinity' in cultivator).toBe(false);
        expect('daoAffinity' in cultivator).toBe(false);
    });

    it('is the slope and never the filter', () => {
        // The critical separation. An extraordinary affinity for something out
        // of reach puts nothing whatsoever into the candidate set.
        const hermit = makeCultivator({ id: 'gifted', spiritRoot: 'single_fire' });
        let gifted: string | null = null;
        for (let i = 0; i < 4000 && gifted === null; i++) {
            const subject = `subject-${i}`;
            if (affinityFor('run', 'gifted', { domain: 'karma', subject }) === 'extraordinary') {
                gifted = subject;
            }
        }
        expect(gifted).not.toBeNull();
        // They are extraordinary at it. It is not in reach, so it is not there.
        expect(discoverableInsights(hermit, {}).some(c => c.subject === gifted)).toBe(false);
        expect(hasAccessTo(hermit, { domain: 'karma', subject: gifted! }, {})).toBeNull();
    });

    it('bends the odds only among things already within reach', () => {
        expect(AFFINITY_WEIGHT.none).toBe(1);
        expect(AFFINITY_WEIGHT.extraordinary).toBeGreaterThan(AFFINITY_WEIGHT.strong);
        expect(AFFINITY_WEIGHT.strong).toBeGreaterThan(AFFINITY_WEIGHT.aptitude);
    });

    it('makes an extraordinary first comprehension arrive already deep', () => {
        expect(AFFINITY_INITIAL_DEGREE.none).toBe(1);
        expect(AFFINITY_INITIAL_DEGREE.extraordinary).toBeGreaterThan(1);
    });

    it('announces itself only when extraordinary', () => {
        // A strong affinity is a real slope that arrives without fanfare,
        // which is why most gifted people simply seem to pick things up fast.
        expect(isRecognition('extraordinary')).toBe(true);
        expect(isRecognition('strong')).toBe(false);
        expect(isRecognition('aptitude')).toBe(false);
        expect(isRecognition('none')).toBe(false);
    });
});

describe('nothing warns anyone', () => {
    it('has no advisory field on a Dao assessment', () => {
        const dao = daoOf([insight('weapon', 'sword', 5, 'a'), insight('weapon', 'spear', 2, 'b')]);
        for (const forbidden of ['suited', 'mismatch', 'warning', 'advice', 'optimal', 'recommended']) {
            expect(Object.keys(dao)).not.toContain(forbidden);
        }
        expect(JSON.stringify(dao)).not.toMatch(/suit|mismatch|warn|should|instead/i);
    });

    it('does not reward a Dao the root never suited, and does not say so', () => {
        // A fire cultivator two centuries into water. Genuinely good at it.
        const misdirected = makeCultivator({
            spiritRoot: 'single_fire',
            realmOrdinal: 12,
            insights: [insight('element', 'water', 5, 'a'), insight('element', 'ice', 4, 'b')]
        });
        const dao = daoOf(misdirected.insights);
        expect(dao.standing).toBe('dao');
        expect(dao.name).toBe('the Dao of Water');

        // The wall does not move, and nothing anywhere explains why.
        const substitution = bottleneckSubstitution(misdirected);
        expect(substitution.substituted).toBe(0);
        expect(JSON.stringify(substitution)).not.toMatch(/suit|wrong|mismatch|warn/i);
    });
});
