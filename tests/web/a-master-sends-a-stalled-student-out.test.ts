/**
 * The send-off had no live reader. The ceiling read now asks a master in this
 * area for an assessment, using the real cultivation gate. Without one it
 * states the observed limit and invents no corpse, traveller, or destination.
 * The assessor's hidden accuracy never enters the narrator's facts.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { canAttemptBreakthrough } from '../../src/engine/cultivation/breakthrough';
import { MAX_ORDINAL, progressRequiredForOrdinal } from '../../src/engine/cultivation/realms';
import { createNpc } from '../../src/engine/world/npc-state';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';

async function stalled(withMaster: boolean) {
    const h = await makeGameInWorld({ seed: 'send-off-live', worldSeed: 'send-off-live' });
    const { cultivator } = await h.game.newRun('Student');
    const world = (await h.game.loadWorld())!;
    h.game.atHand = world;
    const place = world.locations.find(p => p.id === h.game.worldPlaceOf(cultivator))!;
    const ordinal = Array.from({ length: MAX_ORDINAL }, (_, o) => o).find(o =>
        canAttemptBreakthrough({ realmOrdinal: o, cultivationProgress: progressRequiredForOrdinal(o) ?? 0,
            alive: true, knownTechniques: [], insights: [] }).reason === 'insufficient_dao')!;
    expect(ordinal).toBeDefined();
    h.repos.cultivators.update(cultivator.id, { realmOrdinal: ordinal,
        cultivationProgress: progressRequiredForOrdinal(ordinal)!, insights: [], knownTechniques: [] });
    world.npcs = [];
    if (withMaster) {
        const base = createNpc(world.seed, { id: 'npc-master', name: 'Master',
            bornOnDay: world.currentDay - 20 * 365, onDay: world.currentDay,
            cultivation: { realmOrdinal: ordinal + 12 } });
        const master = { ...base, locationId: place.id, activity: null,
            cultivation: { ...base.cultivation, realmOrdinal: ordinal + 12 },
            relationships: [{ targetId: cultivator.id, targetName: cultivator.name, kind: 'disciple' as const,
                standing: 0.5, note: 'Taken as a disciple.', sinceDay: 0, lastChangedDay: 0,
                factIds: [], inheritedFromId: null }] };
        world.npcs.push(master);
        h.repos.cultivators.standIn(cultivator.id, theAreasOf(world, place).whereIs.get(master.id)!);
        h.game.knowledge.learnIfNew({ holderId: cultivator.id, kind: 'cultivator', id: master.id,
            name: master.name, onDay: 0, sourceKind: 'witnessed', stage: 'encountered' });
    }
    const person = h.repos.cultivators.getById(cultivator.id)!;
    return h.game.ceiling(h.game.currentRun().run, person, 'thin');
}

describe('a master sends a stalled student out', () => {
    it('gives advice through the master here without dictating a destination or an outcome', async () => {
        const answer = await stalled(true);
        expect(answer.facts.lines.join(' ')).toContain('Master says there is nothing further');
        expect(answer.facts.lines.join(' ')).toContain('You may stay');
        expect(JSON.stringify(answer.facts)).not.toContain('"correct"');
    }, 120_000);
    it('states a noticed limit without inventing a person or a death', async () => {
        const answer = await stalled(false);
        expect(answer.facts.lines.join(' ')).toContain('No master is assessing you here');
        expect(answer.facts.lines.join(' ')).not.toMatch(/body well off|somebody passing through|marks where they sit/i);
    }, 120_000);
});
