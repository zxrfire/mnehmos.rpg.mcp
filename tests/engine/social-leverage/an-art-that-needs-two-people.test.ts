/**
 * The two roads out of an art that needs two people.
 *
 * The drain: eligibility on sex alone, consent reported not rolled, a grudge
 * that opens only for a coerced use, a bigger draw and a death risk once
 * consent is gone.
 *
 * The partnership: all four conditions required and the failing one reported,
 * the one behind taking the larger share, and an insight that only ever moves
 * down the ladder.
 */

import {
    FURNACE_CONCEPTION_CHANCE,
    FURNACE_COERCED_DEATH_CHANCE,
    FURNACE_DAYS_STOLEN_COERCED,
    FURNACE_DAYS_STOLEN_WILLING,
    DAO_PARTNER_DAYS_BONUS,
    DAO_PARTNER_INSIGHT_CHANCE,
    DAO_PARTNER_RUNGS_DRAWN_ON,
    cultivateWithADaoPartner,
    useAFurnaceTechnique,
    worksBetween
} from '../../../src/engine/social-leverage/an-art-that-needs-two-people';

const BASE = {
    actorId: 'a1',
    actorName: 'Actor',
    subjectId: 's1',
    subjectName: 'Subject',
    onDay: 100,
    deathSample: 0.99
} as const;

describe('worksBetween', () => {
    it('answers true for two different sexes', () => {
        expect(worksBetween('male', 'female')).toBe(true);
        expect(worksBetween('female', 'male')).toBe(true);
    });

    it('answers false for the same sex', () => {
        expect(worksBetween('male', 'male')).toBe(false);
        expect(worksBetween('female', 'female')).toBe(false);
    });
});

describe('useAFurnaceTechnique', () => {
    it('does nothing between two people of the same sex, offered or not', () => {
        const offered = useAFurnaceTechnique({
            ...BASE,
            actorSex: 'male',
            subjectSex: 'male',
            consent: 'offered',
            conceptionSample: 0
        });
        expect(offered.eligible).toBe(false);
        expect(offered.happened).toBe(false);
        expect(offered.conceived).toBe(false);
        expect(offered.subjectDied).toBe(false);
        expect(offered.grudge).toBeNull();

        const coerced = useAFurnaceTechnique({
            ...BASE,
            actorSex: 'female',
            subjectSex: 'female',
            consent: 'coerced',
            conceptionSample: 0
        });
        expect(coerced.eligible).toBe(false);
        expect(coerced.grudge).toBeNull();
    });

    it('opens no grudge and never kills the furnace on a willing use', () => {
        const result = useAFurnaceTechnique({
            ...BASE,
            actorSex: 'male',
            subjectSex: 'female',
            consent: 'offered',
            conceptionSample: 0.9
        });
        expect(result.eligible).toBe(true);
        expect(result.happened).toBe(true);
        expect(result.grudge).toBeNull();
        expect(result.subjectDied).toBe(false);
    });

    it('opens an unforgivable violation grudge, held by the subject, on a coerced use', () => {
        const result = useAFurnaceTechnique({
            ...BASE,
            actorSex: 'male',
            subjectSex: 'female',
            consent: 'coerced',
            conceptionSample: 0.9
        });
        expect(result.happened).toBe(true);
        expect(result.grudge).not.toBeNull();
        expect(result.grudge?.kind).toBe('grudge');
        expect(result.grudge?.cause).toBe('violated');
        expect(result.grudge?.severity).toBe('unforgivable');
        expect(result.grudge?.holderId).toBe(BASE.subjectId);
        expect(result.grudge?.subjectId).toBe(BASE.actorId);
    });

    it('rolls conception against the fixed threshold, on its own sample', () => {
        const took = useAFurnaceTechnique({
            ...BASE,
            actorSex: 'male',
            subjectSex: 'female',
            consent: 'offered',
            conceptionSample: FURNACE_CONCEPTION_CHANCE - 0.001
        });
        expect(took.conceived).toBe(true);

        const didNotTake = useAFurnaceTechnique({
            ...BASE,
            actorSex: 'male',
            subjectSex: 'female',
            consent: 'offered',
            conceptionSample: FURNACE_CONCEPTION_CHANCE + 0.001
        });
        expect(didNotTake.conceived).toBe(false);
    });

    it('steals more days on a coerced use than on a willing one', () => {
        const offered = useAFurnaceTechnique({
            ...BASE,
            actorSex: 'male',
            subjectSex: 'female',
            consent: 'offered',
            conceptionSample: 0.9
        });
        expect(offered.daysStolen).toBe(FURNACE_DAYS_STOLEN_WILLING);

        const coerced = useAFurnaceTechnique({
            ...BASE,
            actorSex: 'male',
            subjectSex: 'female',
            consent: 'coerced',
            conceptionSample: 0.9
        });
        expect(coerced.daysStolen).toBe(FURNACE_DAYS_STOLEN_COERCED);
        expect(coerced.daysStolen).toBeGreaterThan(offered.daysStolen);
    });

    it('never rolls death on a willing use, however the death sample lands', () => {
        const result = useAFurnaceTechnique({
            ...BASE,
            actorSex: 'male',
            subjectSex: 'female',
            consent: 'offered',
            conceptionSample: 0.9,
            deathSample: 0
        });
        expect(result.subjectDied).toBe(false);
    });

    it('rolls death against the fixed threshold on a coerced use, and drops conception when it kills', () => {
        const died = useAFurnaceTechnique({
            ...BASE,
            actorSex: 'male',
            subjectSex: 'female',
            consent: 'coerced',
            conceptionSample: 0,
            deathSample: FURNACE_COERCED_DEATH_CHANCE - 0.001
        });
        expect(died.subjectDied).toBe(true);
        expect(died.conceived).toBe(false);
        expect(died.grudge?.tags).toContain('killed');

        const survived = useAFurnaceTechnique({
            ...BASE,
            actorSex: 'male',
            subjectSex: 'female',
            consent: 'coerced',
            conceptionSample: 0,
            deathSample: FURNACE_COERCED_DEATH_CHANCE + 0.001
        });
        expect(survived.subjectDied).toBe(false);
        expect(survived.grudge?.tags).not.toContain('killed');
    });

    it('never conceives when the art was not eligible to happen at all', () => {
        const result = useAFurnaceTechnique({
            ...BASE,
            actorSex: 'male',
            subjectSex: 'male',
            consent: 'offered',
            conceptionSample: 0
        });
        expect(result.conceived).toBe(false);
    });
});

describe('cultivateWithADaoPartner', () => {
    const road = { subject: 'sword', domain: 'weapon' as const };
    const walking = {
        standing: 'dao' as const,
        subject: road.subject,
        domain: road.domain,
        name: 'the Dao of the Sword',
        depth: 4,
        breadth: 2,
        intensity: 0.6
    };
    const noRoad = {
        standing: 'none' as const,
        subject: null,
        domain: null,
        name: null,
        depth: 0,
        breadth: 0,
        intensity: 0
    };
    const partner = (
        personId: string,
        sex: 'male' | 'female',
        reachesTo: number,
        dao: typeof walking | typeof noRoad = walking
    ) => ({ personId, sex, reachesTo, dao });
    const ALL_THREE = {
        sharedTechniqueId: 'twin-lotus-cultivation-method',
        sameHouse: true,
        married: true,
        insightSample: 0.99
    } as const;

    it('gives two partners level with each other the same small bonus', () => {
        const result = cultivateWithADaoPartner({
            one: partner('a', 'male', 15),
            other: partner('b', 'female', 15),
            ...ALL_THREE
        });
        expect(result.areDaoPartners).toBe(true);
        expect(result.daysBonus.a).toBe(DAO_PARTNER_DAYS_BONUS);
        expect(result.daysBonus.b).toBe(DAO_PARTNER_DAYS_BONUS);
        expect(result.insight).toBeNull();
    });

    // The whole reason somebody would take a partner from lower down the
    // ladder, and the reason the one lower down would say yes.
    it('gives the one behind more than the one ahead', () => {
        const result = cultivateWithADaoPartner({
            one: partner('ahead', 'male', 20),
            other: partner('behind', 'female', 16),
            ...ALL_THREE
        });
        expect(result.daysBonus.ahead).toBe(DAO_PARTNER_DAYS_BONUS);
        expect(result.daysBonus.behind).toBe(DAO_PARTNER_DAYS_BONUS * 5);
        expect(result.daysBonus.behind).toBeGreaterThan(result.daysBonus.ahead);
    });

    // A cap and not a taper: past two realms apart they are not walking one
    // road any more, whatever the two of them call each other.
    it('does not pay out past the rungs a gap can be drawn on', () => {
        const result = cultivateWithADaoPartner({
            one: partner('ahead', 'male', 40),
            other: partner('behind', 'female', 5),
            ...ALL_THREE
        });
        expect(result.daysBonus.behind).toBe(
            DAO_PARTNER_DAYS_BONUS * (1 + DAO_PARTNER_RUNGS_DRAWN_ON)
        );
    });

    it('hands the one behind an insight on the shared road when the draw lands', () => {
        const result = cultivateWithADaoPartner({
            one: partner('ahead', 'male', 20),
            other: partner('behind', 'female', 16),
            ...ALL_THREE,
            insightSample: DAO_PARTNER_INSIGHT_CHANCE - 0.001
        });
        expect(result.insight).toEqual({
            forPersonId: 'behind',
            subject: road.subject,
            domain: road.domain
        });
    });

    // Never up the ladder and never between equals: there is nothing on this
    // road the one ahead has not already stood on.
    it('never hands an insight to the one ahead, or to either of two equals', () => {
        const uphill = cultivateWithADaoPartner({
            one: partner('ahead', 'male', 20),
            other: partner('behind', 'female', 16),
            ...ALL_THREE,
            insightSample: 0
        });
        expect(uphill.insight?.forPersonId).toBe('behind');

        const level = cultivateWithADaoPartner({
            one: partner('a', 'male', 18),
            other: partner('b', 'female', 18),
            ...ALL_THREE,
            insightSample: 0
        });
        expect(level.insight).toBeNull();
    });

    describe('all four conditions, and which one is reported', () => {
        it('refuses two people of the same sex on the art itself', () => {
            const result = cultivateWithADaoPartner({
                one: partner('a', 'male', 15),
                other: partner('b', 'male', 15),
                ...ALL_THREE
            });
            expect(result.areDaoPartners).toBe(false);
            expect(result.missing).toBe('the_art');
            expect(result.daysBonus).toEqual({});
        });

        it('refuses a pair on two different rolls', () => {
            const result = cultivateWithADaoPartner({
                one: partner('a', 'male', 15),
                other: partner('b', 'female', 15),
                ...ALL_THREE,
                sameHouse: false
            });
            expect(result.missing).toBe('the_house');
        });

        it('refuses a pair who are not married', () => {
            const result = cultivateWithADaoPartner({
                one: partner('a', 'male', 15),
                other: partner('b', 'female', 15),
                ...ALL_THREE,
                married: false
            });
            expect(result.missing).toBe('the_marriage');
        });

        // The condition that makes the term mean anything at all. Married, of
        // one house, and on two roads is an ordinary marriage.
        it('refuses a married pair of one house walking two different roads', () => {
            const result = cultivateWithADaoPartner({
                one: partner('a', 'male', 15),
                other: partner('b', 'female', 15, {
                    ...walking,
                    subject: 'water',
                    domain: 'element' as const,
                    name: 'the Dao of Water'
                }),
                ...ALL_THREE
            });
            expect(result.areDaoPartners).toBe(false);
            expect(result.missing).toBe('the_dao');
        });

        it('refuses a pair where either of them is on no road at all', () => {
            expect(cultivateWithADaoPartner({
                one: partner('a', 'male', 15, noRoad),
                other: partner('b', 'female', 15),
                ...ALL_THREE
            }).missing).toBe('the_dao');
            expect(cultivateWithADaoPartner({
                one: partner('a', 'male', 15),
                other: partner('b', 'female', 15, noRoad),
                ...ALL_THREE
            }).missing).toBe('the_dao');
        });
    });

    // The caller is playing one side. A function that answered differently
    // depending on which side asked would be one two callers could disagree
    // about, which is the defect `whatTheChildIs` has its own directional test
    // for.
    it('reads the same in both directions', () => {
        const forwards = cultivateWithADaoPartner({
            one: partner('ahead', 'male', 20),
            other: partner('behind', 'female', 16),
            ...ALL_THREE
        });
        const backwards = cultivateWithADaoPartner({
            one: partner('behind', 'female', 16),
            other: partner('ahead', 'male', 20),
            ...ALL_THREE
        });
        expect(backwards.daysBonus).toEqual(forwards.daysBonus);
        expect(backwards.areDaoPartners).toBe(forwards.areDaoPartners);
        expect(backwards.missing).toBe(forwards.missing);
    });
});
