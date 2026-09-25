/**
 * "Grandmother, where would I find the Tranquil Oasis Sect?" said to the woman
 * who raised you reaches her, and she answers the way, free.
 *
 * Played (world a-fresh-start): the model read it right, the guard declined the
 * `request` as spending days, the fallback put it to "Grandmother", and the turn
 * was "Nobody by that name". Kinship words are about the tie, not age; the one
 * who raised you is father or mother, and a word that does not fit still
 * reaches them.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld, ScriptedProvider } from './harness';
import { theKinThisWordMeans } from '../../src/web/a-kinship-word-is-your-household';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';

type Played = { narration?: string; toolCalls: { name: string; action: string; summary: string; ok: boolean }[] };

describe('the word', () => {
    const household = [
        { id: 'm', name: 'Duan Shuping', sex: 'female' as const },
        { id: 'b', name: 'Duan Heng', sex: 'male' as const },
        { id: 'x', name: 'A Stranger', sex: 'female' as const }
    ];
    const tieOf = (id: string) => id === 'm' ? 'parent' as const : id === 'b' ? 'kin' as const : null;

    it('reaches the household member the tie fits, by relationship', () => {
        expect(theKinThisWordMeans('Mother', tieOf, household)).toMatchObject({ id: 'm', misnamed: null });
        expect(theKinThisWordMeans('elder brother', tieOf, household)).toMatchObject({ id: 'b', misnamed: null });
    });

    it('reaches her however she is misnamed, and says what she is', () => {
        const said = theKinThisWordMeans('Grandmother', tieOf, household);
        expect(said?.id).toBe('m');
        expect(said?.misnamed).toContain('is your mother');
    });

    it('is not a kinship word, or nobody of the household is here', () => {
        expect(theKinThisWordMeans('Elder', tieOf, household)).toBeNull();
        expect(theKinThisWordMeans('Mother', () => null, household)).toBeNull();
    });
});

describe('played', () => {
    it('reaches the one who raised you and answers the way, free', async () => {
        const plans: string[] = [];
        const provider = new ScriptedProvider({ plans, narrations: ['(scripted)'] });
        const harness = await makeGameInWorld({ seed: 'raised-by', worldSeed: 'a-fresh-start', provider });
        const { cultivator } = await harness.game.newRun('Wen Qiu');
        const raiser = harness.game.knowledge.awareness(cultivator.id, 'cultivator')
            .find(row => /raised you/.test(row.statement));
        expect(raiser, 'this life has nobody who raised them').toBeDefined();
        // ARRANGED: stood where they are, in the same area of the place, which is
        // what the played turn had.
        const world = harness.game.atHand!;
        const where = world.locations.find(row =>
            row.id === world.npcs.find(npc => npc.id === raiser!.id)?.locationId)!;
        const area = theAreasOf(world, where).whereIs.get(raiser!.id) ?? null;
        harness.repos.cultivators.update(cultivator.id, { location: where.name });
        harness.repos.cultivators.standIn(cultivator.id, area);
        expect(harness.game.present(harness.game.currentRun().cultivator).map(row => row.id))
            .toContain(raiser!.id);

        plans.push(JSON.stringify({
            action: 'request', intent: 'telling', target: raiser!.name, topic: 'Tranquil Oasis Sect'
        }));
        const done = await harness.game.act('Grandmother, where would I find the Tranquil Oasis Sect?') as Played;
        const names = done.toolCalls.map(call => call.name);
        expect(done.toolCalls.some(call => call.name === 'engine.resolveParty' && !call.ok)).toBe(false);
        expect(names).toContain('engine.theWayTo');
        expect(names).not.toContain('engine.simulateTimeSkip');
        expect(done.toolCalls.map(call => call.action)).not.toContain('name_dropped');
    }, 300_000);
});
