/** Automatic withdrawal ended a fight below a quarter of the body without
 * calling the player's priced flight attempt. The same turn of the back must
 * cost a world person their body, whether they escape or are caught. These
 * ordinary seeded rounds measure the body left after the actual strike;
 * samples and outcomes are not replaced. */
import { expect, it } from 'vitest';
import { CultivationRNG } from '../../../src/engine/cultivation/rng.js';
import { assessPower, attemptFlight, resolveConfrontationRound, resolveMelee, WITHDRAW_HP_FRACTION,
    type CombatantInput, type RoundParty } from '../../../src/engine/cultivation/combat.js';
import { AN_ORDINARY_SWING } from '../../../src/engine/cultivation/how-a-blow-was-thrown.js';
import type { Injury } from '../../../src/schema/cultivation.js';

function body(id: string): CombatantInput {
    return { id, name: id, realmOrdinal: 10, spiritRoot: 'single_fire',
        attributes: { might: 2, insight: 2, fortune: 1, charm: 2 },
        injuries: [], hp: 24, maxHp: 100, qi: 50, maxQi: 50 };
}
const ambient = 'normal' as const;
function side(input: CombatantInput, act: RoundParty['act'] = 'strike'): RoundParty {
    return { input, power: assessPower(input, { ambient }), act, edges: [], vector: 'body' };
}

it('charges automatic flight instead of ending a fight with a free escape', () => {
    let attempts = 0;
    for (let sample = 0; sample < 16; sample++) {
        const attacker = body('pursuer'), defender = body('world-person');
        const hp = { [attacker.id]: attacker.hp, [defender.id]: defender.hp };
        const wounds: Record<string, Injury[]> = { [attacker.id]: [], [defender.id]: [] };
        const actual = resolveConfrontationRound(side(attacker), side(defender, 'guard'), hp,
            wounds, {
                rng: new CultivationRNG('automatic-flight-' + sample), ambient, turn: 1,
                opening: true, fromConcealment: false, willWithdraw: true
            });
        // The first strike is recomputed with the same native stream and with
        // withdrawal disabled; it does not include the later attempt to flee.
        const comparisonHp = { [attacker.id]: attacker.hp, [defender.id]: defender.hp };
        const comparisonRng = new CultivationRNG('automatic-flight-' + sample);
        const ordinary = resolveConfrontationRound(side(attacker), side(defender, 'guard'), comparisonHp,
            { [attacker.id]: [], [defender.id]: [] }, {
                rng: comparisonRng, ambient, turn: 1,
                opening: true, fromConcealment: false, willWithdraw: false
            });
        const first = ordinary.exchanges[0]!;
        expect(first.defenderId).toBe(defender.id);
        const afterStrike = Math.max(0, defender.hp - first.result.damage);
        if (afterStrike <= 0 || afterStrike >= defender.maxHp * WITHDRAW_HP_FRACTION) continue;
        attempts++;
        const flight = attemptFlight(assessPower({ ...defender, hp: afterStrike,
            injuries: first.result.injury ? [first.result.injury] : [] }, { ambient }),
            assessPower(attacker, { ambient }), { rng: comparisonRng, turn: 1, maxHp: defender.maxHp });
        expect(hp[defender.id], 'automatic flight must pay the same actual price as player flight')
            .toBe(Math.max(0, afterStrike - flight.damage));
        expect(actual.exchanges[0]!.flight).toEqual(flight);
        expect(wounds[defender.id]).toEqual([
            ...(first.result.injury ? [first.result.injury] : []),
            ...(flight.injury ? [flight.injury] : [])
        ]);
        expect(actual.ending).toBe(hp[defender.id] <= 0 ? 'down' : flight.escaped ? 'withdrew' : null);
    }
    expect(attempts, 'the native sample set must actually reach an attempted withdrawal').toBeGreaterThan(0);
});

it('a failed flight costs the round without granting an escape to somebody still standing', () => {
    let caught = 0;
    for (let sample = 0; sample < 128; sample++) {
        const attacker = { ...body('pursuer'), hp: 100 }, defender = { ...body('world-person'), hp: 40 };
        const hp = { [attacker.id]: attacker.hp, [defender.id]: defender.hp };
        const round = resolveConfrontationRound(side(attacker), side(defender), hp,
            { [attacker.id]: [], [defender.id]: [] }, {
                rng: new CultivationRNG('caught-flight-' + sample), ambient, turn: 1,
                opening: false, fromConcealment: false, willWithdraw: true
            });
        const flight = round.exchanges[0]?.flight;
        if (!flight || flight.escaped || hp[defender.id] <= 0) continue;
        caught++;
        expect(round.ending).toBeNull();
        expect(round.winnerId).toBeNull();
        expect(round.exchanges).toHaveLength(1);
        expect(hp[attacker.id]).toBe(attacker.hp);
    }
    expect(caught, 'the native samples must reach a failed flight with a body remaining').toBeGreaterThan(0);
});

it('melee charges actual flight damage and carries its actual wounds', () => {
    let attempts = 0;
    for (let sample = 0; sample < 16; sample++) {
        const attacker = { ...body('pursuer'), hp: 100 }, defender = { ...body('world-person'), hp: 100 };
        const result = resolveMelee([
            { id: 'pursuers', name: 'pursuers', members: [attacker] },
            { id: 'travellers', name: 'travellers', members: [defender] }
        ], { rng: new CultivationRNG('melee-flight-' + sample), ambient, turn: 1,
            intent: { thrown: AN_ORDINARY_SWING } });
        const running = { [attacker.id]: attacker.hp, [defender.id]: defender.hp };
        for (const exchange of result.exchanges) {
            running[exchange.defenderId] = Math.max(0, running[exchange.defenderId] - exchange.result.damage);
            if (exchange.flight) {
                attempts++;
                running[exchange.defenderId] = Math.max(0, running[exchange.defenderId] - exchange.flight.damage);
                if (exchange.flight.injury) expect(result.injuries[exchange.defenderId])
                    .toContainEqual(exchange.flight.injury);
            }
            expect(exchange.defenderHpAfter).toBe(running[exchange.defenderId]);
        }
        expect(result.hp).toEqual(running);
    }
    expect(attempts, 'ordinary melees must actually try to withdraw').toBeGreaterThan(0);
});
