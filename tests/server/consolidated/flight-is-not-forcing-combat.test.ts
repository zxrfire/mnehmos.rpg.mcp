/**
 * Gemma finding 32 (2026-10-20): a failed escape left 3/50 HP, yet settlement
 * killed the fleeing aggressor as somebody who forced a fight while barely
 * standing. Settlement must read the choice and condition BEFORE the round.
 * These are final-result boundary arrangements; ordinary damage still kills.
 */
import { expect, it } from 'vitest';
import { makeGame } from '../../web/harness.js';
import { combatantFromCultivator, settleAFight } from '../../../src/server/consolidated/combat-manage.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { resolveConfrontation } from '../../../src/engine/cultivation/combat.js';
import { AN_ORDINARY_SWING } from '../../../src/engine/cultivation/how-a-blow-was-thrown.js';

it.each([
    { act: 'break_off', before: 3, after: 3, aggressor: true, cause: null },
    { act: 'strike', before: 25, after: 3, aggressor: true, cause: null },
    { act: 'strike', before: 3, after: 3, aggressor: true, cause: 'obviously_fatal_choice' },
    { act: 'break_off', before: 3, after: 0, aggressor: true, cause: 'combat_defeat' },
    { act: 'strike', before: 3, after: 3, aggressor: false, cause: null }
] as const)('$act at $before HP ending on $after (aggressor=$aggressor)', async row => {
    const h = makeGame({ seed: 'reading-flight-settlement' });
    try {
        await h.game.newRun('Traveller');
        const current = h.game.currentRun();
        h.repos.cultivators.update(current.cultivator.id, { hp: row.before, maxHp: 50 });
        const body = h.repos.cultivators.getById(current.cultivator.id)!;
        const self = combatantFromCultivator(body, h.repos);
        const opponent = { ...self, id: 'other', name: 'The other fighter', hp: 50, maxHp: 50 };
        const priced = resolveConfrontation(self, opponent, {
            rng: forStream('reading-flight-settlement', 'arrange'), ambient: 'normal', turn: 1,
            intent: { thrown: AN_ORDINARY_SWING, willWithdraw: true }
        });
        const result = { ...priced, outcome: 'stalemate' as const, finished: false,
            winnerId: null, loserId: null, exchanges: [], obligations: [],
            hp: { [self.id]: row.after, [opponent.id]: 50 },
            injuries: { [self.id]: [], [opponent.id]: [] } };
        const receipt = settleAFight({ repos: h.repos, run: current.run, cultivator: body,
            self, opponent, technique: null, result, nextTurn: 1, day: 0,
            opponentIdOnRecord: null, edges: [], playerIsAggressor: row.aggressor,
            choiceBeforeRound: { act: row.act, hp: row.before }
        }) as { death: { cause: string; description: string } | null };
        expect(receipt.death?.cause ?? null).toBe(row.cause);
        expect(h.repos.cultivators.getById(body.id)!.alive).toBe(row.cause === null);
        if (row.cause === 'obviously_fatal_choice') expect(receipt.death!.description).toContain('barely able to stand');
    } finally { h.db.close(); }
});
