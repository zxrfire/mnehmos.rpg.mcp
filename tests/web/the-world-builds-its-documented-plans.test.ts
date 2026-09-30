/**
 * The audit found offer-shaped Dao reads with no transaction, scout lore with
 * no children placed, and rumours with no planner. One played day invokes the
 * world's yearly passes. These arrangements isolate the records each pass owes.
 * Talent remains the child's rolled fact; probation is not membership.
 * Removing the three yearly writers made all four tests fail. Restoring those
 * writes passed in the same command against the same pinned world.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { createNpc } from '../../src/engine/world/npc-state.js';
import { groundAtLocation, daoGroundsInReachOf, DAO_GROUND_TAG } from '../../src/engine/world/how-a-cultivator-comes-by-a-road.js';
import { feeForSittingOn, whatTheyCouldWriteOutForAHouse } from '../../src/engine/world/what-a-house-asks-of-somebody-not-of-it.js';
import { TECHNIQUES } from '../../src/data/cultivation/techniques.js';
import { roadsWalkedBy } from '../../src/engine/cultivation/what-a-road-in-reach-costs-to-walk.js';
import { forStream } from '../../src/engine/cultivation/rng.js';
import { FOUNDATION_ORDINAL } from '../../src/engine/cultivation/realms.js';
import { makeFact, fillConsequences } from '../../src/engine/world/history.js';
import { appendWorldFact } from '../../src/engine/world/who-was-there-when-it-happened.js';

async function game(seed: string) {
    const h = await makeGameInWorld({ seed, worldSeed: 'documented-world-plans' });
    const opened = await h.game.newRun('Observer');
    return { ...h, ...opened, world: h.game.atHand! };
}

describe('the yearly pass reached by waiting', () => {
    it('delivers an ordinary manual as barter rather than treating a known art as an admission', async () => {
        const h = await game('a-bartering-visitor');
        const place = h.world.locations.find(l => groundAtLocation(l)?.admits === 'a copy')!;
        const ground = groundAtLocation(place)!;
        const ordinal = Math.max(20, ground.fromOrdinal);
        const art = TECHNIQUES.find(t => whatTheyCouldWriteOutForAHouse(ground.heldByFactionId!, ordinal, [t.id])
            && !roadsWalkedBy({ knownTechniques: [t.id], age: 30 }).some(r => r.domain === ground.domain))!;
        expect(art).toBeDefined();
        const visitor = createNpc(h.world.seed, { id: 'bartering-visitor', name: 'Copyist',
            bornOnDay: h.world.currentDay - 30 * 365, onDay: h.world.currentDay });
        visitor.locationId = place.id;
        visitor.cultivation.realmOrdinal = ordinal;
        visitor.cultivation.techniqueIds = [art.id];
        const keeper = createNpc(h.world.seed, { id: 'barter-keeper', name: 'Keeper',
            bornOnDay: h.world.currentDay - 30 * 365, onDay: h.world.currentDay });
        keeper.factionId = ground.heldByFactionId;
        keeper.locationId = h.world.factions.find(f => f.id === ground.heldByFactionId)!.seatLocationId;
        keeper.cultivation.realmOrdinal = 3;
        keeper.factionRankIndex = 0;
        keeper.activity = { kind: 'the_work_of_their_rank', note: 'Receiving visitors at the gate.',
            withIds: [], sinceDay: h.world.currentDay, untilDay: null };
        h.world.npcs = [visitor, keeper];
        h.world.locations = h.world.locations.filter(l => l.id === place.id || !l.tags.includes(DAO_GROUND_TAG));
        expect(daoGroundsInReachOf(h.world, visitor).some(g => g.sourceId === place.id)).toBe(false);
        h.game.theWorldMoved();
        await h.game.act('I wait one day');
        const receipt = h.world.history.facts.find(f => f.data.daoAdmission === true && f.data.visitorId === visitor.id)!;
        expect(receipt).toBeDefined();
        const copy = h.world.objects.find(o => o.data.writtenOutBy === visitor.id && o.data.techniqueId === art.id)!;
        expect(copy.kind).toBe('manual');
        expect(copy.possessorId).toBe(ground.heldByFactionId);
        expect(copy.data.copies).toBe(1);
        expect(h.world.npcs.find(n => n.id === visitor.id)!.cultivation.techniqueIds).toContain(art.id);
        expect(receipt.data.stones).toBe(0);
    }, 120_000);

    it('charges an NPC visitor and credits the other house before admitting them to Dao ground', async () => {
        const h = await game('a-paid-visitor');
        const today = h.world.currentDay;
        const place = h.world.locations.find(l => groundAtLocation(l)?.admits === 'a fee')!;
        const ground = groundAtLocation(place)!;
        const house = h.world.factions.find(f => f.id === ground.heldByFactionId)!;
        const visitor = { ...createNpc(h.world.seed, { id: 'paid-visitor', name: 'Guest',
            bornOnDay: today - 20 * 365, onDay: today }), locationId: place.id, spiritStones: 1_000_000 };
        visitor.cultivation.realmOrdinal = ground.fromOrdinal;
        visitor.cultivation.techniqueIds = [];
        const keeper = createNpc(h.world.seed, { id: 'fee-keeper', name: 'Keeper', bornOnDay: today - 30 * 365, onDay: today });
        keeper.factionId = house.id;
        keeper.locationId = house.seatLocationId;
        keeper.cultivation.realmOrdinal = 3;
        keeper.factionRankIndex = 0;
        keeper.activity = { kind: 'the_work_of_their_rank', note: 'Receiving visitors at the gate.',
            withIds: [], sinceDay: today, untilDay: null };
        h.world.npcs = [visitor, keeper];
        expect(daoGroundsInReachOf(h.world, visitor).some(g => g.sourceId === place.id)).toBe(false);
        h.game.theWorldMoved();
        await h.game.act('I wait one day');
        const receipt = h.world.history.facts.find(f => f.data.daoAdmission === true && f.data.visitorId === visitor.id)!;
        expect(receipt, 'the played pass did not offer admission').toBeDefined();
        expect(receipt.data.stones).toBe(feeForSittingOn(ground.fromOrdinal));
        expect(h.world.npcs.find(n => n.id === visitor.id)!.spiritStones).toBeLessThan(visitor.spiritStones);
        expect(h.world.factions.find(f => f.id === house.id)!.resources.spirit_stones).toBeGreaterThan(0);
        expect(daoGroundsInReachOf(h.world, h.world.npcs.find(n => n.id === visitor.id)!, receipt.day))
            .toEqual(expect.arrayContaining([expect.objectContaining({ sourceId: place.id })]));
        expect(daoGroundsInReachOf(h.world, h.world.npcs.find(n => n.id === visitor.id)!, Number(receipt.data.untilDay)))
            .not.toEqual(expect.arrayContaining([expect.objectContaining({ sourceId: place.id })]));
    }, 120_000);

    it('places a talented child from a poor origin below membership and carries their actual probation start', async () => {
        const h = await game('a-scouted-child');
        const today = h.world.currentDay;
        const house = h.world.factions.find(f => f.id === 'sect-azure-cloud-pavilion')!;
        const market = h.world.locations.find(l => l.kind === 'settlement' && l.discovered && !l.sealed
            && l.thresholds.entry === 0 && l.thresholds.survival === 0)!;
        const scouts = Array.from({ length: 6 }, (_, index) => {
            const n = createNpc(h.world.seed, { id: `scout-${index}`, name: `Scout ${index}`,
                bornOnDay: today - 30 * 365, onDay: today });
            return { ...n, locationId: house.seatLocationId, factionId: house.id, factionRankIndex: 1,
                cultivation: { ...n.cultivation, realmOrdinal: FOUNDATION_ORDINAL }, activity: null };
        });
        let id = '';
        for (let index = 0; !id; index++) {
            const candidate = `scout-child-${index}`;
            if (forStream(h.world.seed, 'pavilion-scout', candidate, Math.floor(today / 365)).chance(0.03)) id = candidate;
        }
        const child = createNpc(h.world.seed, { id, name: 'Child', bornOnDay: today - 9 * 365, onDay: today });
        child.locationId = market.id;
        child.identity.origin = 'thin_county';
        child.cultivation.spiritRoot = 'single_metal';
        child.cultivation.realmOrdinal = 0;
        child.cultivation.techniqueIds = [];
        h.world.npcs = [...scouts, child];
        house.resources.spirit_stones = 100_000;
        h.game.theWorldMoved();
        await h.game.act('I wait one day');
        const placed = h.world.npcs.find(n => n.id === id)!;
        expect(placed.tags.some(t => t.startsWith('scouted-probation|'))).toBe(true);
        expect(placed.factionId).toBeNull();
        expect(placed.factionRankIndex).toBe(-1);
        expect(placed.locationId).toBe(house.seatLocationId);
        expect(placed.cultivation.spiritRoot).toBe(child.cultivation.spiritRoot);
        const paper = h.world.history.facts.find(f => f.data.scoutPlacement === true && f.data.probation === true)!;
        expect(paper.data.age).toBeGreaterThanOrEqual(7);
        expect(paper.data.age).toBeLessThanOrEqual(14);
        expect(placed.tags).toContain(`scouted-probation|${paper.data.sinceDay}|${market.id}`);
        expect(h.repos.sects.getMembership(id)).toBeNull();
    }, 120_000);

    it('turns a rumour the house can hear into a decider’s investigation goal without making the claim true', async () => {
        const h = await game('rumour-planning');
        const today = h.world.currentDay;
        const house = h.world.factions.find(f => f.seatLocationId !== null)!;
        const seat = h.world.locations.find(l => l.id === house.seatLocationId)!;
        const ruin = h.world.locations.find(l => l.kind === 'ruin' && l.discovered && !l.sealed)!;
        ruin.parentId = seat.parentId;
        const decider = createNpc(h.world.seed, { id: 'rumour-decider', name: 'Decider', bornOnDay: today - 30 * 365, onDay: today });
        decider.factionId = house.id;
        decider.locationId = seat.id;
        decider.factionRankIndex = house.ranks.length - 1;
        decider.cultivation.realmOrdinal = 30;
        h.world.npcs = [decider];
        const rumour = appendWorldFact(h.world, makeFact({ day: today - 365, kind: 'treasure_found', scale: 'regional',
            visibility: 'regional', magnitude: 1, locationId: ruin.id, summary: 'A traveller reported a buried archive.',
            consequences: fillConsequences({ rumours: ['An unclaimed archive lies beneath the ruin.'] }) }));
        h.game.theWorldMoved();
        await h.game.act('I wait one day');
        const goal = h.world.npcs.find(n => n.id === decider.id)!.goals.find(g => g.note === `rumour-plan:${rumour.id}`)!;
        expect(goal, 'the report did not alter a decider’s intention').toBeDefined();
        expect(goal.targetId).toBe(ruin.id);
        expect(goal.text).toContain('Verify the report');
        expect(h.world.history.facts.find(f => f.data.rumourPlan === true)!.causes).toContain(rumour.id);
        expect(h.world.history.facts.find(f => f.id === rumour.id)!.summary).toBe(rumour.summary);
    }, 120_000);
});
