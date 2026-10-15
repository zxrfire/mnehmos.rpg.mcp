/** Owner ruling, 2026-10-03: a missing key closes ordinary entry but does
 * not prohibit a physical attempt. This candidate binds explicit destroy to
 * the ACTUAL generated vault own-lock grade, not a player's allotted room.
 * All six controls passed on the frozen virtual implementation, 2026-10-03.
 * The normal game.act breach persisted on SQLite reload, cost 0.125 day,
 * retained actual goods and other gates, and refused the remote door.
 * The played operator arrangement selects real generated ground, actual
 * qualifying roll knowledge and a below-Lid body; no stock, key, door or
 * permission is minted. Breaking changes only that actual lock. Wards,
 * working thresholds, other gates, property custody and private rights stay.
 * Front-door successor submits the exact explicit destroy plan through
 * normal game.act and records its native routed calls, then reads actual
 * persisted world state. Provider prose never proves a physical breach.
 * Factual history is recorded; monetary property-damage settlement is a gap.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { makeLocation, evaluateAccess } from '../../src/engine/world/locations.js';
import { pathTo, reachThrough, roomStageFor } from '../../src/engine/world/architecture.js';
import { isAtLeast } from '../../src/engine/social/discovery.js';
import { FALSE_IMMORTAL_ORDINAL } from '../../src/engine/cultivation/realms.js';
import { theActualVaultLock, whetherTheActualVaultLockCanBeBroken, breakTheActualVaultLock }
    from '../../src/engine/world/forcing-an-actual-vault-lock.js';
import { howThisCultivatorStandsInTheHouseHolding } from '../../src/web/how-this-cultivator-stands-on-this-ground.js';
import { whereCompoundsAre } from '../../src/engine/world/where-inside-a-house-somebody-is-standing.js';
import { WorldStateRepository } from '../../src/storage/repos/world-state.repo.js';
import { whatTheyCouldBreakADoorWith } from '../../src/web/who-comes-to-settle-an-account.js';
import { retell } from '../../src/engine/world/what-people-are-saying.js';

function ratedLock() {
    return makeLocation({ id: 'actual-vault', name: 'Actual vault', kind: 'vault', sealed: true,
        tags: ['interior'], hazards: ['formation'], data: { purpose: 'treasury', keyId: 'actual-key', privacy: 1 },
        thresholds: { entry: 8, survival: 2, operational: 8, mastery: 12 } });
}
it('names the actual required grade and leaves an insufficient attempt unchanged', () => {
    const room = ratedLock();
    const before = structuredClone(room);
    expect(whetherTheActualVaultLockCanBeBroken(room, 7)?.force).toMatchObject({ reaches: false, needs: 8 });
    expect(whetherTheActualVaultLockCanBeBroken(room, 7)?.force.cause).toContain('8');
    expect(breakTheActualVaultLock(room, { strength: 7, onDay: 1, byName: 'Breaker', causeFactId: 'fact' })).toBeNull();
    expect(room).toEqual(before);
});
it('removes the actual own-lock entry while preserving unrelated requirements and formation hazards', () => {
    const room = ratedLock();
    const before = structuredClone(room);
    const changed = breakTheActualVaultLock(room, { strength: 8, onDay: 1, byName: 'Breaker', causeFactId: 'fact' })!;
    expect(changed.location.sealed).toBe(false);
    expect(changed.location.thresholds).toEqual({ ...before.thresholds, entry: 0 });
    expect(changed.location.hazards).toEqual(before.hazards);
    expect(changed.location.data).toEqual(before.data);
    expect(room).toEqual(before);
});
it('reads actual reinforcement on the target instead of the bare own-lock rating', () => {
    const room = ratedLock();
    room.data.doorStandsAt = 11;
    expect(whetherTheActualVaultLockCanBeBroken(room, 8)?.force).toMatchObject({ reaches: false, needs: 11 });
    expect(theActualVaultLock(room)?.source).toBe('actual_reinforced_door');
});
it('does not smash away a cyclical admission window or treat an office as a dormitory door', () => {
    const room = ratedLock();
    const cyclic = { ...room, cycle: { periodDays: 10, openDays: 1, phaseDay: 0 } };
    expect(theActualVaultLock(cyclic)).toBeNull();
    expect(theActualVaultLock({ ...room, kind: 'hall' })).toBeNull();
});

async function actualDoor() {
    const plans: string[] = [];
    const h = await makeGameInWorld({ seed: 'actual-door', worldSeed: 'ordinary-store-requests',
        provider: new ScriptedProvider({ plans, narrations: ['The actual scene.'] }) });
    const opened = await h.game.newRun('Door visitor');
    const world = (await h.game.loadWorld())!;
    const compounds = whereCompoundsAre(world);
    let arrangement: { room: typeof world.locations[number]; parent: typeof world.locations[number]; houseId: string; rank: number } | undefined;
    for (const room of world.locations) {
        const lock = theActualVaultLock(room);
        if (!lock || lock.standsAt > FALSE_IMMORTAL_ORDINAL) continue;
        const parent = world.locations.find(p => p.id === room.parentId);
        const seatId = compounds.seatOf.get(room.id);
        const compound = seatId ? compounds.bySeat.get(seatId) : null;
        const house = compound ? h.repos.sects.getById(compound.houseId) : null;
        if (!parent || !compound || !house) continue;
        const body = { ...opened.cultivator, realmOrdinal: FALSE_IMMORTAL_ORDINAL };
        const rank = house.ranks.findIndex((_rank, rankIndex) => {
            const standing = { sectId: house.id, rankIndex, rankCount: house.ranks.length, joinedOnDay: world.currentDay };
            const read = howThisCultivatorStandsInTheHouseHolding({ ground: room, cultivator: body,
                standing, objects: world.objects, onDay: world.currentDay });
            const reach = reachThrough(pathTo(world.locations, parent.id), read.access, { enteredAt: compound.seat.id });
            return isAtLeast(roomStageFor(room, read.viewer), 'placed') && reach.stoppedAt === null && reach.level !== 'barred';
        });
        if (rank >= 0) { arrangement = { room, parent, houseId: house.id, rank }; break; }
    }
    expect(arrangement, 'a real known generated vault with an accessible outside parent').toBeDefined();
    const a = arrangement!;
    h.repos.sects.addMember(a.houseId, opened.cultivator.id, a.rank);
    h.repos.cultivators.update(opened.cultivator.id, { realmOrdinal: FALSE_IMMORTAL_ORDINAL, location: a.parent.name });
    h.repos.cultivators.standIn(opened.cultivator.id, null);
    h.game.theWorldMoved();
    // Normal free read refreshes the real player membership/body projection.
    await h.game.act('I look around');
    // The opening span establishes normal background counted-stock retention
    // before the breach's full-world no-goods-transfer comparison.
    await h.game.act('I wait for 3 hours');
    const currentWorld = h.game.atHand!;
    h.repos.cultivators.update(opened.cultivator.id, { location: a.parent.name });
    h.repos.cultivators.standIn(opened.cultivator.id, null);
    expect(h.game.worldPlaceOf(h.game.currentRun().cultivator)).toBe(a.parent.id);
    return { ...h, ...opened, ...a, plans, world: currentWorld,
        room: currentWorld.locations.find(place => place.id === a.room.id)!,
        parent: currentWorld.locations.find(place => place.id === a.parent.id)! };
}
it('the generic destroy doorway commits the actual breach, persists it and transfers no goods', async () => {
    const h = await actualDoor();
    const goods = structuredClone(h.world.objects);
    const roomBefore = structuredClone(h.room);
    const otherGates = h.world.locations.filter(row => row.id !== h.room.id).map(row => [row.id, row.sealed, row.thresholds.entry]);
    const body = h.repos.cultivators.getById(h.cultivator.id)!;
    const keyless = { realmOrdinal: body.realmOrdinal, onDay: h.world.currentDay, keyIds: [] };
    expect(evaluateAccess(roomBefore, keyless).closed).toBe(true);
    h.plans.push(JSON.stringify({ action: 'destroy', target: `door of ${h.room.name}` }));
    const turn = await h.game.act(`I break the door of ${h.room.name}`);
    console.error('VAULT_FORCE_FRONT_DOOR', JSON.stringify({ toolCalls: turn.toolCalls, events: turn.events }));
    const persisted = new WorldStateRepository(h.db).loadWorld(h.world.id)!;
    const after = persisted.locations.find(row => row.id === h.room.id)!;
    expect(after.sealed).toBe(false);
    expect(after.thresholds).toEqual({ ...roomBefore.thresholds, entry: 0 });
    expect(after.hazards).toEqual(roomBefore.hazards);
    expect(after.data).toEqual(roomBefore.data);
    // The ordinary entry read now sees the removed lock without granting a key.
    expect(evaluateAccess(after, keyless).closed).toBe(false);
    expect(evaluateAccess(after, keyless).level).not.toBe('barred');
    expect(persisted.objects).toEqual(goods);
    expect(persisted.locations.filter(row => row.id !== h.room.id).map(row => [row.id, row.sealed, row.thresholds.entry])).toEqual(otherGates);
    expect(persisted.history.facts.some(f => f.data.doorLocationId === h.room.id && f.kind === 'object_destroyed')).toBe(true);
    // Successor 2026-10-03: native rumours read brokeWhat, never the deed summary.
    const deed = persisted.history.facts.find(f => f.data.doorLocationId === h.room.id
        && f.kind === 'object_destroyed')!;
    const told = retell(persisted, deed, { id: body.id, name: body.name,
        realmOrdinal: body.realmOrdinal, locationId: h.parent.id,
        regionId: null, factionId: null }, deed.day);
    expect(told.text).toContain(theActualVaultLock(roomBefore)!.name);

    expect(h.repos.cultivators.getById(body.id)!.location).toBe(body.location);
});
it('a known vault elsewhere is not reachable merely because its name was supplied', async () => {
    const h = await actualDoor();
    const compounds = whereCompoundsAre(h.world);
    const compound = compounds.bySeat.get(compounds.seatOf.get(h.room.id)!)!;
    const membership = h.repos.sects.getMembership(h.cultivator.id)!;
    const house = h.repos.sects.getById(membership.sectId)!;
    const body = h.repos.cultivators.getById(h.cultivator.id)!;
    const elsewhere = h.world.locations.find(row => row.id !== h.parent.id && row.id !== h.room.id
        && (row.id === compound.seat.id || compound.inside.has(row.id))
        && (() => {
            const read = howThisCultivatorStandsInTheHouseHolding({ ground: row, cultivator: body,
                standing: { sectId: membership.sectId, rankIndex: membership.rankIndex,
                    rankCount: house.ranks.length, joinedOnDay: membership.joinedOnDay },
                objects: h.world.objects, onDay: h.world.currentDay });
            const reach = reachThrough(pathTo(h.world.locations, row.id), read.access, { enteredAt: compound.seat.id });
            return reach.stoppedAt === null && reach.level !== 'barred';
        })());
    expect(elsewhere, 'another genuinely accessible point in the same known compound').toBeDefined();
    h.repos.cultivators.update(h.cultivator.id, { location: elsewhere!.name });
    h.repos.cultivators.standIn(h.cultivator.id, null);
    const before = structuredClone(h.world.locations);
    const goods = structuredClone(h.world.objects);
    h.plans.push(JSON.stringify({ action: 'destroy', target: `door of ${h.room.name}` }));
    const turn = await h.game.act(`I break the door of ${h.room.name}`);
    console.error('VAULT_FORCE_FRONT_DOOR', JSON.stringify({ toolCalls: turn.toolCalls, events: turn.events }));
    expect(h.world.locations).toEqual(before);
    expect(h.world.objects).toEqual(goods);
    expect(h.repos.cultivators.getById(h.cultivator.id)!.location).toBe(elsewhere!.name);
});

/** The earlier six native controls supplied bare action:destroy. They remain
 * intact. These controls instead submit the active phase1 make/break shape
 * through the real provider router. The actual generated door is still the
 * target and its native own-lock/reinforcement grade still decides the breach;
 * no model assertion of success is accepted as evidence. Reinforcement is an
 * explicit controlled arrangement of the existing door-rating field, not a
 * new force rule, key, object, movement or admission grant.
 */
it('the active breaking lane reaches the actual generated door and persists only its breach', async () => {
    const h = await actualDoor();
    const before = structuredClone(h.room);
    const goods = structuredClone(h.world.objects);
    const body = h.repos.cultivators.getById(h.cultivator.id)!;
    h.plans.push(JSON.stringify({ lane: 'make', intent: 'break', target: `door of ${h.room.name}` }));
    const turn = await h.game.act(`I break the door of ${h.room.name}`);
    expect(turn.toolCalls.find(call => call.name === 'narrator.plan')).toMatchObject({ action: 'destroy', source: 'model' });
    const saved = new WorldStateRepository(h.db).loadWorld(h.world.id)!;
    const after = saved.locations.find(row => row.id === h.room.id)!;
    expect(after.sealed).toBe(false);
    expect(after.thresholds).toEqual({ ...before.thresholds, entry: 0 });
    expect(after.hazards).toEqual(before.hazards);
    expect(after.data).toEqual(before.data);
    expect(saved.objects).toEqual(goods);
    expect(saved.history.facts.some(f => f.kind === 'object_destroyed' && f.data.doorLocationId === h.room.id)).toBe(true);
    expect(h.repos.cultivators.getById(body.id)!.location).toBe(body.location);
});
it('choosing the breaking lane cannot overcome the actual reinforced door grade', async () => {
    const h = await actualDoor();
    const body = h.repos.cultivators.getById(h.cultivator.id)!;
    const required = whatTheyCouldBreakADoorWith(h.world, body) + 1;
    h.room.data.doorStandsAt = required;
    h.game.theWorldMoved();
    const before = structuredClone(h.room);
    const goods = structuredClone(h.world.objects);
    const answer = whetherTheActualVaultLockCanBeBroken(h.room, required - 1)!;
    expect(answer.force).toMatchObject({ reaches: false, needs: required });
    h.plans.push(JSON.stringify({ lane: 'make', intent: 'break', target: `door of ${h.room.name}` }));
    const turn = await h.game.act(`I break the door of ${h.room.name}`);
    expect(JSON.stringify(turn.toolCalls)).toContain('engine.actualVaultLock');
    expect(turn.toolCalls.find(call => call.name === 'engine.actualVaultLock')).toMatchObject({ ok: false });
    const saved = new WorldStateRepository(h.db).loadWorld(h.world.id)!;
    expect(saved.locations.find(row => row.id === h.room.id)).toEqual(before);
    expect(saved.objects).toEqual(goods);
    expect(saved.history.facts.some(f => f.kind === 'object_destroyed' && f.data.doorLocationId === h.room.id)).toBe(false);
    expect(h.repos.cultivators.getById(body.id)!.location).toBe(body.location);
});
