/**
 * The death engine.
 *
 * The point of these tests is EXACTNESS. Every death condition must fire on the
 * documented number and not one turn, one year or one hit point before it. A
 * permadeath game that kills you early is a bug report; one that kills you late
 * is a lie.
 */

import {
    CRIPPLING_UNTREATED_INJURIES,
    SATIETY_COST_PER_ACTION,
    SATIETY_MAX,
    STAGNATION_YEARS,
    STARVATION_TURNS,
    SUICIDAL_HP_FRACTION
} from '../../../src/schema/cultivation.js';
import {
    ACTIONS_PER_FULL_SATIETY,
    SATIETY_BURN_BY_REALM,
    assessSuicidalCombat,
    burnSatiety,
    describeDeath,
    eat,
    evaluateDeathConditions,
    lifespanRemaining,
    satietyBurnMultiplier,
    stagnationRemaining,
    stillNeedsToEat,
    turnsUntilStarvation
} from '../../../src/engine/cultivation/survival.js';
import { REALM_TIERS, lifespanForOrdinal } from '../../../src/engine/cultivation/realms.js';
import { treatInjury } from '../../../src/engine/cultivation/injuries.js';
import { makeCultivator, makeInjuries } from './fixtures.js';

describe('satiety', () => {
    it('buys exactly ACTIONS_PER_FULL_SATIETY actions from a full belly', () => {
        expect(ACTIONS_PER_FULL_SATIETY).toBe(SATIETY_MAX / SATIETY_COST_PER_ACTION);
        const after = burnSatiety({ satiety: SATIETY_MAX, starvationTurns: 0 }, ACTIONS_PER_FULL_SATIETY);
        expect(after.satiety).toBe(0);
        expect(after.starvationTurns).toBe(0);
    });

    it('starts the starvation counter only on actions taken with an empty belly', () => {
        const empty = burnSatiety({ satiety: SATIETY_MAX, starvationTurns: 0 }, ACTIONS_PER_FULL_SATIETY + 3);
        expect(empty.satiety).toBe(0);
        expect(empty.starvationTurns).toBe(3);
    });

    it('resets the counter the moment there is food again', () => {
        const starving = { satiety: 0, starvationTurns: 4 };
        expect(burnSatiety(eat(starving), 1).starvationTurns).toBe(0);
        expect(eat(starving).satiety).toBe(SATIETY_MAX);
    });

    it('is a no-op for zero actions and never mutates its input', () => {
        const state = { satiety: 40, starvationTurns: 2 };
        expect(burnSatiety(state, 0)).toEqual(state);
        burnSatiety(state, 10);
        expect(state).toEqual({ satiety: 40, starvationTurns: 2 });
    });

    it('reports the exact number of turns left before starvation kills', () => {
        expect(turnsUntilStarvation({ satiety: SATIETY_MAX, starvationTurns: 0 })).toBe(
            ACTIONS_PER_FULL_SATIETY + STARVATION_TURNS
        );
        expect(turnsUntilStarvation({ satiety: 0, starvationTurns: STARVATION_TURNS - 1 })).toBe(1);
        expect(turnsUntilStarvation({ satiety: 0, starvationTurns: STARVATION_TURNS })).toBe(0);
    });
});

// A crossing that only partly took. `failed-transformation` is a permanent
// wound, so `treated` stays false for life and the lock never lifts.
const partialTransformation = makeInjuries(1, 'crippling')
    .map(i => ({ ...i, woundType: 'failed-transformation' }));

describe('a failed transformation takes the meals back', () => {
    // Each realm-boundary wound locks the ability its realm exists to grant,
    // and for Deity Transformation the one the engine genuinely enforces is
    // that hunger stops. "It's only partial, they don't have the full abilities
    // of a DT" - so the meals come back.
    const DT = REALM_TIERS.find(t => t.key === 'deity_transformation')!.ordinalStart;

    it('leaves a whole Deity Transformation cultivator free of food', () => {
        expect(satietyBurnMultiplier(DT)).toBe(0);
        expect(stillNeedsToEat(DT)).toBe(false);
        expect(satietyBurnMultiplier(DT, [])).toBe(0);
    });

    it('puts one who only partly transformed back on the Nascent Soul rate', () => {
        // The realm they actually completed, not a mortal's. What failed was
        // the last crossing rather than everything under it.
        expect(satietyBurnMultiplier(DT, partialTransformation))
            .toBe(SATIETY_BURN_BY_REALM.nascent_soul);
        expect(stillNeedsToEat(DT, partialTransformation)).toBe(true);
    });

    it('never makes anybody hungrier than the realm below them already is', () => {
        // The lock only ever denies a grant. Below Deity Transformation the
        // burn is already non-zero and the wound must not touch it.
        for (const ordinal of [0, 12, 20]) {
            expect(satietyBurnMultiplier(ordinal, partialTransformation))
                .toBe(satietyBurnMultiplier(ordinal));
        }
    });

    it('lets them starve, which is a fair death with a clock and a cure', () => {
        // Deliberately NOT the thing being retired alongside it. Channel wounds
        // stopped killing anybody; starvation is a live cause with a visible
        // countdown and a meal you can buy in any settlement.
        const starved = makeCultivator({
            realmOrdinal: DT,
            injuries: partialTransformation,
            satiety: 0,
            starvationTurns: STARVATION_TURNS
        });
        expect(evaluateDeathConditions(starved)).toBe('starvation');
        // And a whole one at the same rung and the same empty belly does not,
        // because nothing about them is spending itself on food.
        expect(evaluateDeathConditions({ ...starved, injuries: [] })).toBeNull();
    });

    it('burns satiety for them where a whole one burns none', () => {
        const full = { satiety: SATIETY_MAX, starvationTurns: 0 };
        expect(burnSatiety(full, 10_000, DT).satiety).toBe(SATIETY_MAX);
        expect(burnSatiety(full, 10_000, DT, partialTransformation).satiety)
            .toBeLessThan(SATIETY_MAX);
    });
});

describe('aging accessors', () => {
    it('reports lifespan against the realm ceiling', () => {
        const cultivator = makeCultivator({ realmOrdinal: 0, age: 40 });
        expect(lifespanRemaining(cultivator)).toBe(lifespanForOrdinal(0) - 40);
    });

    it('reports stagnation against the STAGNATION_YEARS budget', () => {
        expect(stagnationRemaining(makeCultivator({ yearsAtCurrentRealm: 12 }))).toBe(
            STAGNATION_YEARS - 12
        );
    });
});

describe('evaluateDeathConditions', () => {
    it('returns null for a healthy, fed, young cultivator', () => {
        expect(evaluateDeathConditions(makeCultivator())).toBeNull();
    });

    it('kills at exactly 0 HP and not at 1', () => {
        expect(evaluateDeathConditions(makeCultivator({ hp: 1 }))).toBeNull();
        expect(evaluateDeathConditions(makeCultivator({ hp: 0 }))).toBe('combat_defeat');
    });

    it('kills by starvation at exactly STARVATION_TURNS', () => {
        for (let t = 0; t < STARVATION_TURNS; t++) {
            expect(
                evaluateDeathConditions(makeCultivator({ satiety: 0, starvationTurns: t }))
            ).toBeNull();
        }
        expect(
            evaluateDeathConditions(
                makeCultivator({ satiety: 0, starvationTurns: STARVATION_TURNS })
            )
        ).toBe('starvation');
    });

    it('kills by lifespan at exactly the realm ceiling', () => {
        const ceiling = lifespanForOrdinal(0);
        expect(evaluateDeathConditions(makeCultivator({ age: ceiling - 0.001 }))).toBeNull();
        expect(evaluateDeathConditions(makeCultivator({ age: ceiling }))).toBe(
            'lifespan_exhausted'
        );
    });

    it('grants a longer lifespan at a higher realm', () => {
        const age = lifespanForOrdinal(0) + 10;
        expect(evaluateDeathConditions(makeCultivator({ realmOrdinal: 0, age }))).toBe(
            'lifespan_exhausted'
        );
        expect(
            evaluateDeathConditions(makeCultivator({ realmOrdinal: 13, age }))
        ).toBeNull();
    });

    it('kills by stagnation at exactly STAGNATION_YEARS', () => {
        const base = { age: 60, realmOrdinal: 0 };
        expect(
            evaluateDeathConditions(
                makeCultivator({ ...base, yearsAtCurrentRealm: STAGNATION_YEARS - 0.001 })
            )
        ).toBeNull();
        expect(
            evaluateDeathConditions(
                makeCultivator({ ...base, yearsAtCurrentRealm: STAGNATION_YEARS })
            )
        ).toBe('stagnation_aging');
    });

    it('does not kill for untreated injuries, even with a fight forced', () => {
        // INVERTED. This asserted that forcing a fight at the threshold was an
        // immediate death, which was true and is not any more. Design owner:
        // "torn meridians should not kill... it should be the same as a torn
        // muscle irl. very VERY annoying, but you don't die."
        //
        // The full guard, in both directions, is
        // `a-torn-meridian-does-not-kill-you.test.ts` - which is this file's
        // old `bleeding.test.ts` with every death assertion turned over.
        const injuries = makeInjuries(CRIPPLING_UNTREATED_INJURIES);
        const atThreshold = makeCultivator({ injuries });

        expect(evaluateDeathConditions(atThreshold)).toBeNull();
        expect(evaluateDeathConditions(atThreshold, { forcingCombat: true })).toBeNull();
    });

    it('does not kill below the threshold either, treated or not', () => {
        const injuries = makeInjuries(CRIPPLING_UNTREATED_INJURIES - 1);
        expect(
            evaluateDeathConditions(makeCultivator({ injuries }), { forcingCombat: true })
        ).toBeNull();

        const healed = treatInjury(makeInjuries(CRIPPLING_UNTREATED_INJURIES), injuries[0].id);
        expect(
            evaluateDeathConditions(makeCultivator({ injuries: healed }), { forcingCombat: true })
        ).toBeNull();
    });

    it('kills for fighting below the suicidal HP fraction, at exactly that line', () => {
        const maxHp = 100;
        const atLine = makeCultivator({ maxHp, hp: maxHp * SUICIDAL_HP_FRACTION });
        const belowLine = makeCultivator({ maxHp, hp: maxHp * SUICIDAL_HP_FRACTION - 1 });
        expect(evaluateDeathConditions(atLine, { forcingCombat: true })).toBeNull();
        expect(evaluateDeathConditions(belowLine, { forcingCombat: true })).toBe(
            'obviously_fatal_choice'
        );
        // Not fighting is not fatal.
        expect(evaluateDeathConditions(belowLine)).toBeNull();
    });

    it('reports the most immediate cause when several apply at once', () => {
        const doomed = makeCultivator({
            hp: 0,
            satiety: 0,
            starvationTurns: STARVATION_TURNS,
            age: 999,
            yearsAtCurrentRealm: STAGNATION_YEARS + 10,
            injuries: makeInjuries(CRIPPLING_UNTREATED_INJURIES)
        });
        expect(evaluateDeathConditions(doomed, { forcingCombat: true })).toBe('combat_defeat');

        const starving = makeCultivator({
            satiety: 0,
            starvationTurns: STARVATION_TURNS,
            age: 999
        });
        expect(evaluateDeathConditions(starving)).toBe('starvation');
    });

    it('leaves an already-dead cultivator alone', () => {
        expect(evaluateDeathConditions(makeCultivator({ hp: 0, alive: false }))).toBeNull();
    });
});

describe('assessSuicidalCombat', () => {
    it('flags nothing for a healthy cultivator', () => {
        expect(assessSuicidalCombat(makeCultivator())).toEqual({ suicidal: false, reasons: [] });
    });

    it('names the HP line, and no longer counts wounds among the reasons', () => {
        // There were two reasons and there is one. Untreated wounds were the
        // other, back when forcing a fight at the threshold was an immediate
        // death; it is not, and a function reporting "suicidal" for a state
        // nothing kills anybody for is a warning with nothing behind it.
        //
        // Fighting wounded is still a bad idea and is still priced - in the
        // condition line of `assessPower` and in the damage a wounded attacker
        // lands. It makes losing likelier, and losing has always been fatal.
        const assessment = assessSuicidalCombat(
            makeCultivator({ hp: 1, maxHp: 100, injuries: makeInjuries(CRIPPLING_UNTREATED_INJURIES) })
        );
        expect(assessment.suicidal).toBe(true);
        expect(assessment.reasons).toHaveLength(1);
        expect(assessment.reasons[0]).toMatch(/HP/);

        // And wounds alone, on a body that can stand, are not suicide at all.
        expect(assessSuicidalCombat(
            makeCultivator({ hp: 100, maxHp: 100, injuries: makeInjuries(CRIPPLING_UNTREATED_INJURIES) })
        ).suicidal).toBe(false);
    });
});

describe('describeDeath', () => {
    it('writes a factual account for every cause', () => {
        const cultivator = makeCultivator({ name: 'Lin Yao', realmOrdinal: 14, age: 87.6 });
        const causes = [
            'combat_defeat', 'obviously_fatal_choice', 'lifespan_exhausted', 'stagnation_aging',
            'untreated_injuries', 'starvation', 'failed_breakthrough', 'qi_deviation',
            'heavenly_tribulation'
        ] as const;
        for (const cause of causes) {
            const text = describeDeath(cause, cultivator);
            expect(text).toContain('Lin Yao');
            expect(text).toContain('87');
            expect(text.length).toBeGreaterThan(20);
        }
    });
});
