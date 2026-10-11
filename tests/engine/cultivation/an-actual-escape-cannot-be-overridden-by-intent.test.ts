/** After automatic flight was priced, conclusion still replaced a successful
 * escape with submission, execution or humiliation because the aggressor had
 * wanted that ending. The actual escape must bind the conclusion. These paired
 * native streams keep every exchange, cost and injury identical; only the
 * aggressor's goal changes. No escape sample or yielding answer is substituted.
 */
import { expect, it } from 'vitest';
import { resolveConfrontation, type CombatantInput, type ConfrontationIntent } from '../../../src/engine/cultivation/combat.js';
import { AN_ORDINARY_SWING } from '../../../src/engine/cultivation/how-a-blow-was-thrown.js';
import { CultivationRNG } from '../../../src/engine/cultivation/rng.js';

function body(id: string, hp: number): CombatantInput {
    return { id, name: id, realmOrdinal: 10, spiritRoot: 'single_fire',
        attributes: { might: 2, insight: 2, fortune: 1, charm: 2 },
        injuries: [], hp, maxHp: 1000, qi: 50, maxQi: 50 };
}

it('keeps an actual surviving escape when the pursuer wanted submission or humiliation', () => {
    let escapes = 0;
    const pursuer = body('pursuer', 1000), runner = body('runner', 249);
    for (let sample = 0; sample < 64; sample++) {
        const seed = `intent-after-escape-${sample}`;
        const play = (intent: ConfrontationIntent) => resolveConfrontation(pursuer, runner, {
            rng: new CultivationRNG(seed), ambient: 'normal', turn: 1, intent });
        const ordinary = play({ thrown: AN_ORDINARY_SWING });
        if (!ordinary.exchanges.some(exchange => exchange.defenderId === runner.id && exchange.flight?.escaped)
            || ordinary.hp[runner.id] <= 0) continue;
        escapes++;
        for (const intent of [
            { thrown: AN_ORDINARY_SWING, toMakeThemComply: true, yields: { willYield: true, because: 'ordinary' } },
            { thrown: AN_ORDINARY_SWING, toMakeThemComply: true, yields: { willYield: false, because: 'territorial' } },
            { thrown: AN_ORDINARY_SWING, toMakeAnExampleOfThem: true }
        ] satisfies ConfrontationIntent[]) {
            const wanted = play(intent);
            expect(wanted.exchanges).toEqual(ordinary.exchanges);
            expect(wanted.outcome, 'the pursuer cannot undo an actual escape').toBe(ordinary.outcome);
            expect(wanted.hp).toEqual(ordinary.hp);
            expect(wanted.injuries).toEqual(ordinary.injuries);
            expect(wanted.finished).toBe(false);
        }
    }
    expect(escapes, 'ordinary seeded flight must actually escape in this control').toBeGreaterThan(0);
});
