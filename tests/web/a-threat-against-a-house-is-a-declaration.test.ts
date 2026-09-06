/**
 * THERE IS NOBODY TO THREATEN IN A HOUSE.
 *
 * Measured on the trope corpus against a live narrator, in the scenario named
 * for a declaration travelling. The player typed *I will end the Azure Cloud
 * Pavilion*, phase 1 planned a person-shaped act at a house, the house resolved
 * - and what came back was `engine.resolveInteraction` with `ok: false` and its
 * own confession attached:
 *
 *     Attempt recorded; outcome not resolvable yet. No agreement, no exchange,
 *     no change of standing. The intent label was carried to the narrator and
 *     read by no conditional.
 *
 * An approach made and nothing settled, about a sentence that says you will end
 * somebody.
 *
 * ── WHY IT COULD NOT BE THE ATTEMPT MACHINE ──────────────────────────────
 *
 * `pressSomebody` is gated on `party.kind === 'cultivator'` and correctly so:
 * `resolveAttempt` weighs a person against a person, off their rungs, their
 * ties and the ledger between them. A house has no rung and no charm and is not
 * standing anywhere. Widening that gate would have been the wrong mechanic said
 * confidently, which is the failure this repo keeps unpicking.
 *
 * ── SO IT GOES WHERE THE GENRE PUTS IT ───────────────────────────────────
 *
 * A hostile act aimed at a whole house is a DECLARATION, and `housePosture` has
 * answered it since it was written: it reads where the speaker stands, tells an
 * outsider what a war actually requires, and puts the deed into the world
 * whether or not the war was refused. The two paths now meet - what a player
 * types at a person goes to the attempt machine, and the same words aimed at a
 * house go to the one that knows what a house is.
 *
 * Nothing new decides which. `WRONG_BEHIND_INTENT` already says which intents
 * carry a wrong behind them, and it is read rather than restated - so the day a
 * tenth hostile intent is added, this needs no edit.
 *
 * ── AND IT MATTERS THAT IT IS THE PLANNER'S PATH ─────────────────────────
 *
 * The pattern table already sent `I will end the Azure Cloud Pavilion` to
 * `posture/war` on its own. What did not was PHASE 1, which is a model, plans
 * in its own words, and reached `interact` with a hostile intent instead. A fix
 * in the table alone would have measured green in a unit test and stayed broken
 * against every live narrator, which is what the corpus is for.
 */

import { describe, expect, it } from 'vitest';

import { WRONG_BEHIND_INTENT } from '../../src/web/turn-constants';
import { makeGameInWorld } from './harness';

const THE_PAVILION = 'sect-azure-cloud-pavilion';

function calls(result: unknown): string {
    return ((result as { toolCalls?: { name: string }[] }).toolCalls ?? [])
        .map(c => c.name).join(' ');
}
function said(result: unknown): string {
    return String((result as { narration?: string }).narration ?? '');
}

/**
 * Somebody who has heard of the house.
 *
 * The knowledge gate is real and is not what this file measures: you cannot
 * declare against a house you have never heard of, and that is the same rule
 * for every house in the game.
 */
async function somebodyWhoHasHeardOfThem(seed: string) {
    const harness = await makeGameInWorld({
        seed, worldSeed: `world-${seed}`, adminMode: true
    });
    await harness.game.newRun('Declarer');
    await harness.game.act('I look around');
    process.env.ADMIN_MODE = 'true';
    await harness.game.act(`ADMIN grant_knowledge kind=sect id=${THE_PAVILION}`);
    return harness;
}

describe('a hostile act aimed at a house', () => {
    it('reaches the declaration rather than an approach that settles nothing', async () => {
        const harness = await somebodyWhoHasHeardOfThem('threat-at-a-house');
        try {
            const answer = await harness.game.act('I threaten the Azure Cloud Pavilion');

            expect(calls(answer), said(answer)).toContain('engine.housePosture');
            // The dead end, by name. It must never be what this reaches again.
            expect(calls(answer)).not.toContain('engine.resolveInteraction');
            expect(said(answer)).not.toMatch(/Nothing is settled by it/i);

            // AND IT TRAVELS, which is what the scenario is named for.
            expect(calls(answer)).toContain('world.aDeedEntersTheWorld');
            // The honest answer about what a war needs, from the house layer.
            expect(said(answer)).toMatch(/a war is a thing between two houses/i);
        } finally {
            delete process.env.ADMIN_MODE;
        }
    }, 200_000);

    /**
     * AND AN ORDINARY APPROACH IS UNTOUCHED. Walking up to a house to talk to
     * it is not a declaration, and routing every faction interaction to war
     * would be worse than the dead end it replaces.
     */
    it('leaves a peaceable approach to a house exactly as it was', async () => {
        const harness = await somebodyWhoHasHeardOfThem('talk-to-a-house');
        try {
            const answer = await harness.game.act('I talk to the Azure Cloud Pavilion');
            expect(calls(answer)).not.toContain('engine.housePosture');
        } finally {
            delete process.env.ADMIN_MODE;
        }
    }, 200_000);
});

describe('what decides it', () => {
    /**
     * READ AND NOT RESTATED. The branch asks `WRONG_BEHIND_INTENT`, which is
     * the table that already says which intents carry a wrong behind them - so
     * a tenth hostile intent needs no edit here.
     */
    it('is the table that already knew which intents are hostile', () => {
        expect(WRONG_BEHIND_INTENT.threaten).toBeDefined();
        expect(WRONG_BEHIND_INTENT.talk).toBeUndefined();
    });
});
