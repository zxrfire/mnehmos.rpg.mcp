/**
 * "Grandmother, where would I find the Tranquil Oasis Sect?" said to the woman
 * who raised you reaches her, and she answers the way.
 *
 * Played (world a-fresh-start): the model read it right, the guard declined the
 * `request` as spending days, the fallback put it to "Grandmother", and the turn
 * was "Nobody by that name". Kinship words are about the tie, not age; the one
 * who raised you is father or mother, and a word that does not fit still
 * reaches them.
 * Knowledge uses a catalog person's canonical id while their physical world
 * row uses its native id. The former fixture confused those keys and found no
 * location. Resolve the same person through the shared identity authority,
 * then arrange contact through the merged presence reader used in play.
 * The later reply-clock ruling charges one eighth of a day for the answer;
 * the original free-reply assertion predates it. This is still one reply,
 * without the long pressure campaign the original defect accidentally chose.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld, ScriptedProvider } from './harness';
import { theKinThisWordMeans } from '../../src/web/a-kinship-word-is-your-household';
import { peopleInThisPlace } from '../../src/web/hearsay';
import { worldLocationFor } from '../../src/web/entities';
import { routineLocationOf } from '../../src/engine/world/npc-routines';
import { theOneIdAPersonIsKnownBy } from '../../src/engine/world/a-catalog-person-and-their-world-row';

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
    it('reaches the one who raised you and answers within one ordinary reply', async () => {
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
        const stored = harness.repos.cultivators.getById(raiser!.id);
        const person = world.npcs.find(npc => theOneIdAPersonIsKnownBy(npc.id) === raiser!.id);
        const personId = stored?.id ?? person?.id;
        expect(personId, 'the remembered parent needs an actual living row').toBeDefined();
        const where = stored ? worldLocationFor(world, stored.location)
            : person ? world.locations.find(row => row.id === routineLocationOf(world, person)) : null;
        expect(where, 'the actual parent needs a physical place').toBeTruthy();
        harness.repos.cultivators.update(cultivator.id, { location: where!.name });
        const body = harness.repos.cultivators.getById(cultivator.id)!;
        const area = peopleInThisPlace(harness.repos, body, world, where!).whereIs.get(personId!);
        expect(area, 'the actual parent needs a physical area').toBeDefined();
        harness.repos.cultivators.standIn(cultivator.id, area!);
        expect(harness.game.present(harness.game.currentRun().cultivator).map(row => row.id))
            .toContain(personId!);

        plans.push(JSON.stringify({
            action: 'request', intent: 'telling', target: raiser!.name, topic: 'Tranquil Oasis Sect'
        }));
        const before = harness.game.currentRun().run.elapsedDays;
        const done = await harness.game.act('Grandmother, where would I find the Tranquil Oasis Sect?') as Played;
        const names = done.toolCalls.map(call => call.name);
        expect(done.toolCalls.some(call => call.name === 'engine.resolveParty' && !call.ok)).toBe(false);
        expect(names).toContain('engine.theWayTo');
        expect(harness.game.currentRun().run.elapsedDays - before).toBeCloseTo(0.125);
        expect(done.toolCalls.map(call => call.action)).not.toContain('name_dropped');
    }, 300_000);
});
