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

/**
 * One rite, said the short way.
 *
 * The two-person case is a one-element `subjects` list, and every assertion
 * below reads `each[0]` - which is the point of the shape: nothing about a
 * pair is special-cased, a pair is a list of length one.
 */
function rite(opts: {
    actorSex: 'male' | 'female';
    subjectSexes: readonly ('male' | 'female')[];
    type: 'offered' | 'coerced';
    conceptionSample?: number;
    deathSample?: number;
}) {
    return useAFurnaceTechnique({
        actor: { personId: 'a1', name: 'Actor', sex: opts.actorSex },
        subjects: opts.subjectSexes.map((sex, i) => ({
            personId: `s${i + 1}`,
            name: `Subject ${i + 1}`,
            sex,
            conceptionSample: opts.conceptionSample ?? 0.9,
            deathSample: opts.deathSample ?? 0.99
        })),
        onDay: 100,
        type: opts.type
    });
}

describe('useAFurnaceTechnique', () => {
    it('does nothing between two people of the same sex, offered or not', () => {
        const offered = rite({
            actorSex: 'male', subjectSexes: ['male'], type: 'offered', conceptionSample: 0
        });
        expect(offered.eligible).toBe(false);
        expect(offered.happened).toBe(false);
        expect(offered.each[0].conceived).toBe(false);
        expect(offered.each[0].died).toBe(false);
        expect(offered.grudges).toEqual([]);

        const coerced = rite({
            actorSex: 'female', subjectSexes: ['female'], type: 'coerced', conceptionSample: 0
        });
        expect(coerced.eligible).toBe(false);
        expect(coerced.grudges).toEqual([]);
    });

    it('opens no grudge and never kills the furnace on a willing use', () => {
        const result = rite({ actorSex: 'male', subjectSexes: ['female'], type: 'offered' });
        expect(result.eligible).toBe(true);
        expect(result.happened).toBe(true);
        expect(result.grudges).toEqual([]);
        expect(result.each[0].died).toBe(false);
    });

    it('opens an unforgivable violation grudge, held by the subject, on a coerced use', () => {
        const result = rite({ actorSex: 'male', subjectSexes: ['female'], type: 'coerced' });
        expect(result.happened).toBe(true);
        expect(result.grudges).toHaveLength(1);
        expect(result.grudges[0].kind).toBe('grudge');
        expect(result.grudges[0].cause).toBe('violated');
        expect(result.grudges[0].severity).toBe('unforgivable');
        expect(result.grudges[0].holderId).toBe('s1');
        expect(result.grudges[0].subjectId).toBe('a1');
    });

    it('rolls conception against the fixed threshold, on its own sample', () => {
        expect(rite({
            actorSex: 'male', subjectSexes: ['female'], type: 'offered',
            conceptionSample: FURNACE_CONCEPTION_CHANCE - 0.001
        }).each[0].conceived).toBe(true);

        expect(rite({
            actorSex: 'male', subjectSexes: ['female'], type: 'offered',
            conceptionSample: FURNACE_CONCEPTION_CHANCE + 0.001
        }).each[0].conceived).toBe(false);
    });

    it('steals more days on a coerced use than on a willing one', () => {
        const offered = rite({ actorSex: 'male', subjectSexes: ['female'], type: 'offered' });
        const coerced = rite({ actorSex: 'male', subjectSexes: ['female'], type: 'coerced' });
        expect(offered.daysStolen).toBe(FURNACE_DAYS_STOLEN_WILLING);
        expect(coerced.daysStolen).toBe(FURNACE_DAYS_STOLEN_COERCED);
        expect(coerced.daysStolen).toBeGreaterThan(offered.daysStolen);
    });

    it('never rolls death on a willing use, however the death sample lands', () => {
        const result = rite({
            actorSex: 'male', subjectSexes: ['female'], type: 'offered', deathSample: 0
        });
        expect(result.each[0].died).toBe(false);
    });

    it('rolls death against the fixed threshold on a coerced use, and drops conception when it kills', () => {
        const died = rite({
            actorSex: 'male', subjectSexes: ['female'], type: 'coerced',
            conceptionSample: 0, deathSample: FURNACE_COERCED_DEATH_CHANCE - 0.001
        });
        expect(died.each[0].died).toBe(true);
        expect(died.each[0].conceived).toBe(false);
        expect(died.grudges[0].tags).toContain('killed');

        const survived = rite({
            actorSex: 'male', subjectSexes: ['female'], type: 'coerced',
            conceptionSample: 0, deathSample: FURNACE_COERCED_DEATH_CHANCE + 0.001
        });
        expect(survived.each[0].died).toBe(false);
        expect(survived.grudges[0].tags).not.toContain('killed');
    });

    it('never conceives when the art was not eligible to happen at all', () => {
        expect(rite({
            actorSex: 'male', subjectSexes: ['male'], type: 'offered', conceptionSample: 0
        }).each[0].conceived).toBe(false);
    });

    // ── AND THE SAME STATEMENT WITH A DIFFERENT NUMBER IN IT ─────────────

    it('draws off every eligible subject, and the days scale with how many', () => {
        const three = rite({
            actorSex: 'male', subjectSexes: ['female', 'female', 'female'], type: 'offered'
        });
        expect(three.each).toHaveLength(3);
        expect(three.daysStolen).toBe(FURNACE_DAYS_STOLEN_WILLING * 3);
    });

    it('keeps a row for somebody the art could not work on, rather than dropping them', () => {
        // A missing row and a refused one are different facts, and a list that
        // silently drops the refusals cannot be counted against the one handed in.
        const mixed = rite({
            actorSex: 'male', subjectSexes: ['female', 'male', 'female'], type: 'offered'
        });
        expect(mixed.each).toHaveLength(3);
        expect(mixed.each.map(row => row.eligible)).toEqual([true, false, true]);
        expect(mixed.eligible).toBe(true);
        expect(mixed.daysStolen).toBe(FURNACE_DAYS_STOLEN_WILLING * 2);
    });

    it('opens one grudge per coerced subject it worked on, and none for the rest', () => {
        const mixed = rite({
            actorSex: 'male', subjectSexes: ['female', 'male', 'female'], type: 'coerced'
        });
        expect(mixed.grudges).toHaveLength(2);
        expect(mixed.grudges.map(g => g.holderId)).toEqual(['s1', 's3']);
    });

    it('refuses the whole rite only when it answers between the actor and nobody', () => {
        const none = rite({
            actorSex: 'male', subjectSexes: ['male', 'male'], type: 'coerced', conceptionSample: 0
        });
        expect(none.eligible).toBe(false);
        expect(none.happened).toBe(false);
        expect(none.daysStolen).toBe(0);
        expect(none.grudges).toEqual([]);
    });

    it('gives each body its own draws, so two furnaces are not one coin flip', () => {
        const result = useAFurnaceTechnique({
            actor: { personId: 'a1', name: 'Actor', sex: 'male' },
            subjects: [
                { personId: 's1', name: 'One', sex: 'female', conceptionSample: 0, deathSample: 0.99 },
                { personId: 's2', name: 'Two', sex: 'female', conceptionSample: 0.99, deathSample: 0.99 }
            ],
            onDay: 100,
            type: 'offered'
        });
        expect(result.each.map(row => row.conceived)).toEqual([true, false]);
    });

    it('says a sentence about a person for one, and about a count for more', () => {
        const one = rite({ actorSex: 'male', subjectSexes: ['female'], type: 'coerced' });
        expect(one.line).toContain('Subject 1');

        const many = rite({
            actorSex: 'male', subjectSexes: ['female', 'female'], type: 'coerced'
        });
        expect(many.line).toContain('2 of them');
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
