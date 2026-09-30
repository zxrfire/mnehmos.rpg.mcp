/**
 * Saying where a house's missing person was seen once changed nothing: the
 * restart reader had no caller and accepted no place. A report now goes to a
 * listener in this area and stores a search lead, without moving the missing
 * person or declaring them found. The next dispatch reads the report, even
 * when the actual person is somewhere else. Returning clears the stale lead.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { createNpc } from '../../src/engine/world/npc-state';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { theHouseKnowsAgain } from '../../src/engine/world/who-a-house-has-lost-track-of';
import { theHousesSendSomebodyLooking } from '../../src/engine/world/a-house-sends-somebody-looking';
import { whoTheyWereSentAfter } from '../../src/engine/world/a-disciple-takes-work-off-the-board';
import { reportWhereTheHouseShouldLook } from '../../src/web/reporting-where-a-house-should-look';

async function aReport() {
    const h = await makeGameInWorld({ seed: 'search-lead', worldSeed: 'search-lead' });
    const { cultivator } = await h.game.newRun('Teller');
    const world = (await h.game.loadWorld())!;
    h.game.atHand = world;
    const house = world.factions.find(f => f.id === 'sect-azure-cloud-pavilion')!;
    const here = h.game.worldPlaceOf(cultivator)!;
    const place = world.locations.find(p => p.id === here)!;
    const reported = world.locations.find(p => p.kind === 'settlement' && p.id !== here)!;
    const listener = { ...createNpc(world.seed, { id: 'npc-listener', name: 'Listener',
        bornOnDay: world.currentDay - 20 * 365, onDay: world.currentDay }),
        factionId: house.id, factionRankIndex: 0, locationId: here, activity: null };
    const missing = { ...createNpc(world.seed, { id: 'npc-missing', name: 'Missing',
        bornOnDay: world.currentDay - 20 * 365, onDay: world.currentDay }),
        factionId: house.id, locationId: here, activity: null };
    world.npcs = [listener, missing];
    const at = world.factions.findIndex(f => f.id === house.id);
    world.factions[at] = { ...house, tags: [...house.tags, 'lost-track-of|npc-missing|0',
        'gave-up-looking-for|npc-missing', 'looked-and-found-nothing|npc-missing|3'] };
    h.repos.cultivators.standIn(cultivator.id, theAreasOf(world, place).whereIs.get(listener.id)!);
    for (const [kind, row] of [['cultivator', missing], ['place', reported]] as const) {
        h.game.knowledge.learnIfNew({ holderId: cultivator.id, kind, id: row.id,
            name: row.name, onDay: 0, sourceKind: 'witnessed', stage: 'encountered' });
    }
    return { ...h, world, run: h.game.currentRun().run,
        cultivator: h.repos.cultivators.getById(cultivator.id)!, listener, missing, reported, at };
}

describe('a search lead is told to somebody', () => {
    it('reopens the search at the reported place, preserving the missing person location', async () => {
        const h = await aReport();
        const answer = reportWhereTheHouseShouldLook(h.game, h.run, h.cultivator, h.missing.name, h.reported.name);
        expect(answer.facts.lines.join(' ')).toContain('records that place');
        expect(h.world.npcs.find(n => n.id === h.missing.id)!.locationId).toBe(h.missing.locationId);
        const went = theHousesSendSomebodyLooking(h.world, Math.floor(h.world.currentDay));
        const searcher = h.world.npcs.find(n => n.id === went.find(w => w.houseId === h.world.factions[h.at]!.id)!.searcherId)!;
        expect(whoTheyWereSentAfter(searcher)?.toldToLookAt).toBe(h.reported.id);
        const found = theHouseKnowsAgain(h.world.factions[h.at]!, h.missing.id);
        expect(found.tags.some(t => t.startsWith('told-to-look-at|npc-missing|'))).toBe(false);
    }, 120_000);
    it('refuses a distrusted report through the listener who actually hears it', async () => {
        const h = await aReport();
        h.world.npcs[0] = { ...h.world.npcs[0]!, relationships: [{ targetId: h.cultivator.id,
            targetName: h.cultivator.name, kind: 'enemy', standing: -1, note: 'Distrusted.',
            sinceDay: 0, lastChangedDay: 0, factIds: [], inheritedFromId: null }] };
        const before = h.world.factions[h.at]!.tags.slice();
        reportWhereTheHouseShouldLook(h.game, h.run, h.cultivator, h.missing.name, h.reported.name);
        expect(h.world.factions[h.at]!.tags).toEqual(before);
    }, 120_000);
});
