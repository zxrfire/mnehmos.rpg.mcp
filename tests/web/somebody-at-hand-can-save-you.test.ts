/**
 * The owner: ending a fight you forced while barely standing kills you, and "medicine from someone at
 * hand may save you" - "anyone if they want to", and "some people might be genuinely kind too".
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { somebodyAtHandSavesYou } from '../../src/web/somebody-at-hand-saves-you';
import { openHandednessOf } from '../../src/engine/social-leverage/how-freely-somebody-parts-with-what-they-have';
import { makeObject } from '../../src/engine/world/possessions';
import { MINOR_HEALING_PILL_ID } from '../../src/data/cultivation/pills';
import { routineOf } from '../../src/engine/world/npc-routines';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { standWhereThePeopleAre } from './standing-where-the-people-are';

async function dying(seed: string) {
    const h = await makeGameInWorld({ seed, worldSeed: 'road-world' });
    const { cultivator } = await h.game.newRun('Fallen');
    h.repos.cultivators.update(cultivator.id, { hp: 1 });
    const world = h.game.atHand ?? (await h.game.loadWorld())!;
    return { ...h, world, body: h.repos.cultivators.getById(cultivator.id)! };
}

describe('somebody at hand can save you', () => {
    it('does nothing where nobody standing here carries medicine', async () => {
        const h = await dying('rescue-none');
        const here = new Set(h.game.present(h.body).map(row => row.id));
        h.world.objects = h.world.objects.filter(o => !(o.possessorId && here.has(o.possessorId) && o.kind === 'pill'));
        expect(somebodyAtHandSavesYou(h.game, h.game.currentRun().run, h.body)).toBeNull();
    }, 180_000);

    it('a kind stranger carrying a healing pill spends it on you, and you owe them a life', async () => {
        const h = await dying('rescue-kind');
        // A genuinely kind person out in a town this hour, and the player fallen beside them.
        const inTown = (id: string) => {
            const npc = h.world.npcs.find(n => n.id === id)!;
            const routine = routineOf(h.world, npc);
            const town = !routine.home && h.world.locations.find(l => l.id === routine.locationId && l.kind === 'settlement');
            return town && theAreasOf(h.world, town).whereIs.has(id) ? town : null;
        };
        const kindest = h.world.npcs.filter(n => n.status === 'alive' && openHandednessOf(n.id) > 0.6 && inTown(n.id))
            .sort((a, b) => openHandednessOf(b.id) - openHandednessOf(a.id))[0]!;
        expect(kindest, 'nobody kind is out in a town').toBeDefined();
        h.repos.cultivators.update(h.body.id, { location: inTown(kindest.id)!.name });
        await standWhereThePeopleAre(h, h.body.id, new Set([kindest.id]));
        h.body = h.repos.cultivators.getById(h.body.id)!;
        const here = h.game.present(h.body).map(row => row.id);
        expect(here).toContain(kindest.id);
        h.world.objects.push(makeObject({ id: 'a-pill-for-a-stranger', name: 'Lesser Healing Pill', kind: 'pill',
            ownerId: kindest.id, ownerName: kindest.name, possessorId: kindest.id, locationId: kindest.locationId,
            data: { pillId: MINOR_HEALING_PILL_ID, quantity: 2 } }));
        // Their nature is fixed and their roll is seeded per turn: across a few turns a kind person helps.
        let saved = null;
        for (let turn = 0; turn < 12 && !saved; turn++) {
            saved = somebodyAtHandSavesYou(h.game, { ...h.game.currentRun().run, turn }, h.body, here.filter(id => id !== kindest.id));
        }
        expect(saved?.rescuerId).toBe(kindest.id);
        expect(h.repos.cultivators.getById(h.body.id)!.hp).toBeGreaterThan(1);
        expect(h.world.objects.find(o => o.id === 'a-pill-for-a-stranger')?.data.quantity).toBe(1);
        expect(h.world.history.facts.some(f => f.data.lifeSaved === true && f.data.rescuerId === kindest.id)).toBe(true);
    }, 180_000);
});
