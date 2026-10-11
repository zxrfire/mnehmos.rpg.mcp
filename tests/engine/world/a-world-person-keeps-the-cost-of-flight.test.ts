/** Automatic flight now pays within the fight, but the world writer kept only
 * wounds after a player fight and discarded its body charge. These ordinary
 * seeded rounds reach both successful and failed flight. Their actual receipts
 * must debit the world person's existing body, including a normalized bout's
 * pool; ordinary strike damage remains under the existing write contract. */
import { expect, it } from 'vitest';
import { CultivationRNG } from '../../../src/engine/cultivation/rng.js';
import { assessPower, resolveConfrontationRound, type CombatantInput, type RoundParty } from '../../../src/engine/cultivation/combat.js';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { bodyStandingOn, createNpc, maxBodyOf } from '../../../src/engine/world/npc-state.js';
import { whatTheirFlightsCost, whatTheConfrontationDidToThem } from '../../../src/engine/world/what-a-confrontation-does-to-somebody-the-world-holds.js';
import type { Injury } from '../../../src/schema/cultivation.js';

it('keeps every native flight charge on the real body, whether the person escaped or was caught', () => {
    const successes = new Set<boolean>();
    for (let sample = 0; sample < 64; sample++) {
        const state = createWorld({ seed: 'world-flight-cost', skipPriorAges: true, regionCount: 0 });
        state.currentDay = 4000;
        const npc = createNpc(state.seed, { id: 'fleeing-person', name: 'Ren Shu',
            bornOnDay: 3900, onDay: state.currentDay, cultivation: { realmOrdinal: 10 } });
        state.npcs.push(npc);
        const defender: CombatantInput = { id: npc.id, name: npc.name, realmOrdinal: 10,
            spiritRoot: 'single_fire', attributes: { might: 2, insight: 2, fortune: 1, charm: 2 },
            injuries: [], hp: 24, maxHp: 100, qi: 50, maxQi: 50 };
        const attacker = { ...defender, id: 'pursuer', name: 'Pursuer', hp: 100 };
        const side = (input: CombatantInput, act: RoundParty['act']): RoundParty => ({
            input, act, power: assessPower(input, { ambient: 'normal' }), edges: [], vector: 'body' });
        const hp = { [attacker.id]: attacker.hp, [defender.id]: defender.hp };
        const injuries: Record<string, Injury[]> = { [attacker.id]: [], [defender.id]: [] };
        const round = resolveConfrontationRound(side(attacker, 'strike'), side(defender, 'guard'),
            hp, injuries, { rng: new CultivationRNG('world-flight-' + sample), ambient: 'normal',
                turn: 1, opening: true, fromConcealment: false, willWithdraw: true });
        const receipt = round.exchanges.find(exchange => exchange.defenderId === npc.id && exchange.flight);
        if (!receipt?.flight) continue;
        successes.add(receipt.flight.escaped);
        const before = bodyStandingOn(npc, state.currentDay);
        whatTheConfrontationDidToThem(state, { npcId: npc.id, byId: attacker.id, byName: attacker.name,
            day: state.currentDay, wounds: injuries[npc.id]!, outcome: 'withdrawal', lost: true, finished: false,
            flight: whatTheirFlightsCost(round.exchanges, npc.id, defender.maxHp) });
        expect(bodyStandingOn(state.npcs[0]!, state.currentDay)).toBe(Math.max(0,
            before - Math.round(receipt.flight.damage * maxBodyOf(npc) / defender.maxHp)));
        expect(state.npcs[0]!.cultivation.injuries).toEqual(injuries[npc.id]);
        expect(state.npcs[0]!.status).toBe('alive');
    }
    expect([...successes].sort(), 'both native flight outcomes must be exercised').toEqual([false, true]);
});
