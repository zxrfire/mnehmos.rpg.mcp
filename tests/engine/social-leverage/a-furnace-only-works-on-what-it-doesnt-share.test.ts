/**
 * The furnace trope: eligibility on sex alone, consent reported not rolled, a
 * grudge that opens only for a coerced use, a bigger draw and a death risk
 * once consent is gone - and the other road, where the same art is practised
 * together and both sides come away ahead.
 */

import {
    FURNACE_CONCEPTION_CHANCE,
    FURNACE_COERCED_DEATH_CHANCE,
    FURNACE_DAYS_STOLEN_COERCED,
    FURNACE_DAYS_STOLEN_WILLING,
    PAIRED_CULTIVATION_DAYS_BONUS,
    useAFurnaceTechnique,
    usePairedCultivation,
    worksBetween
} from '../../../src/engine/social-leverage/a-furnace-only-works-on-what-it-doesnt-share';

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

describe('usePairedCultivation', () => {
    it('gives both partners the same small bonus when the art works between them', () => {
        const result = usePairedCultivation({
            aSex: 'male',
            bSex: 'female',
            sharedTechniqueId: 'twin-lotus-cultivation-method'
        });
        expect(result.eligible).toBe(true);
        expect(result.daysBonus).toBe(PAIRED_CULTIVATION_DAYS_BONUS);
    });

    it('gives nothing between two people of the same sex', () => {
        const result = usePairedCultivation({
            aSex: 'male',
            bSex: 'male',
            sharedTechniqueId: 'twin-lotus-cultivation-method'
        });
        expect(result.eligible).toBe(false);
        expect(result.daysBonus).toBe(0);
    });
});
