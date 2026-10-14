/**
 * Completion audit, 2026-10-03: ordinary treasury approval existed in
 * whetherItLeavesTheStore, but player petition(stock) read immortal forms and
 * request(a_thing) negotiated without moving a stored row. A real room look
 * could show a treasury object without a played approved request reaching it.
 *
 * These tests arrange an OPEN storage door in one pinned catalog world and
 * read the real office, roll, traits and working mouth. The existing office
 * holder is arranged to work INSIDE that open store through their ordinary
 * location, rather than left at their shallowest other office. This is an operator
 * fixture. Opening keys now exist and the separate custody cases below borrow
 * those actual rows; no operator key is granted in those cases. Staff
 * fetching for juniors outside a sealed store remains unimplemented. Requests
 * must preserve stock/id/loan ownership, and refuse missing mouths or access.
 * The alchemy extension targets a real seeded graded cauldron: standing near
 * house equipment alone gives no carried-vessel benefit; an approved ordinary
 * loan lets the existing refine receipt identify that same vessel. No special
 * equipment permission or guaranteed pill outcome is introduced. Root review
 * corrected the old MAX_ORDINAL operator fixture to False Immortal: a True
 * Immortal is beyond the Lid and cannot petition a mortal-world store. The
 * operator remains a strong actual body below the Lid; no gate is bypassed.
 */
import { theBestVesselToHand } from '../../src/engine/world/the-vessel-somebody-works-at.js';
import { handleRefine } from '../../src/server/consolidated/alchemy-manage.js';
import { getRecipe } from '../../src/data/cultivation/recipes.js';
import { addToPouch } from '../../src/server/consolidated/cultivation-support.js';
import { expect, it } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { askingYourHouseForAStoredObject } from '../../src/web/asking-your-house-for-a-stored-object.js';
import { portfoliosIn } from '../../src/engine/social-leverage/authority-for-an-order.js';
import { whetherItLeavesTheStore } from '../../src/engine/social-leverage/who-has-to-agree-before-it-leaves-the-store.js';
import { isRuined, isTracked, makeObject } from '../../src/engine/world/possessions.js';
import { pathTo, purposeOf, reachThrough } from '../../src/engine/world/architecture.js';
import { howThisCultivatorStandsInTheHouseHolding } from '../../src/web/how-this-cultivator-stands-on-this-ground.js';
import { routineOf } from '../../src/engine/world/npc-routines.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { FALSE_IMMORTAL_ORDINAL } from '../../src/engine/cultivation/realms.js';
import { rankIndexOf } from '../../src/web/walking-up-to-a-house.js';

async function atAStore(allowed: boolean, seed: string, cauldron = false) {
    const h = await makeGameInWorld({ seed, worldSeed: 'ordinary-store-requests' });
    const { run, cultivator } = await h.game.newRun('Store Visitor');
    const world = (await h.game.loadWorld())!;
    // Choose the required actual answer once from the finite actual house roll,
    // rather than prescribe somebody's personality or duplicate its approval.
    const candidates = world.factions.filter(f => f.dissolvedOnDay === null && h.repos.sects.getById(f.id));
    let chosen: { house: typeof candidates[number]; room: typeof world.locations[number];
        object: typeof world.objects[number]; receiver: typeof world.npcs[number]; hour: number } | undefined;
    for (const house of candidates) {
        const room = world.locations.find(p => p.controllingFactionId === house.id && purposeOf(p) === 'treasury');
        const object = world.objects.find(o => o.ownerId === house.id && o.locationId === room?.id && o.possessorId === null
            && (o.kind === 'artifact' || o.kind === 'manual') && isTracked(o) && !isRuined(o) && o.data.spent !== true
            && !o.tags.includes('conveyance') && !o.tags.includes('never-carried') && !o.tags.includes('single-use')
            && (!cauldron || o.tags.includes('cauldron')));
        if (!room || !object) continue;
        const roll = [...world.npcs.filter(n => n.status === 'alive' && n.factionId === house.id)
            .map(n => ({ id: n.id, rankIndex: rankIndexOf(h.game, n.id, house.ranks.length) }))
            .filter(n => n.rankIndex >= 0), { id: cultivator.id, rankIndex: 0 }];
        const portfolios = portfoliosIn({ npcs: world.npcs, locations: world.locations, sectId: house.id, roll, rankCount: house.ranks.length });
        const decision = whetherItLeavesTheStore({ significance: object.significance, meaning: 'use_it_and_return_it',
            room: 'treasury', roll, portfolios, rankCount: house.ranks.length, askerId: cultivator.id });
        if (decision.allowed !== allowed) continue;
        const receiver = world.npcs.find(n => n.id === portfolios.find(p => p.purpose === 'treasury')?.holderId)!;
        if (!receiver || receiver.activity?.redirect) continue;
        const hour = Array.from({ length: 24 }, (_, i) => i).find(hour => {
            world.currentHour = hour;
            const work = routineOf(world, receiver);
            return !work.home && work.activity?.kind === 'the_work_of_their_rank'
                && !work.activity.thingId && work.activity.withIds.length === 0;
        });
        if (hour === undefined) continue;
        chosen = { house, room, object, receiver, hour };
        break;
    }
    expect(chosen, `an actual house with a ${allowed ? 'permissive' : 'refusing'} tracked store decision and working receiver`).toBeDefined();
    const { house, room, object, receiver, hour } = chosen!;
    room.sealed = false;
    receiver.locationId = room.id;
    world.currentHour = hour;
    h.repos.sects.addMember(house.id, cultivator.id, 0);
    h.repos.cultivators.update(cultivator.id, { location: room.name, realmOrdinal: FALSE_IMMORTAL_ORDINAL });
    const area = theAreasOf(world, room).whereIs.get(receiver.id)!;
    expect(area, 'the actual office holder is in the opened store during work').toBeDefined();
    h.repos.cultivators.standIn(cultivator.id, area);
    h.game.theWorldMoved();
    h.db.prepare('UPDATE runs SET elapsed_days = ? WHERE id = ?').run(Math.floor(run.elapsedDays) + hour / 24, run.id);
    await h.game.loadWorld();
    // Operator edits arrange a body, not a refreshed world projection or
    // knowledge. The normal free look commits the turn's canonical projection
    // and learns the house/ground actually seen, before a named petition.
    const clockBeforeLook = h.game.currentRun().run.elapsedDays;
    await h.game.act('I look around');
    expect(h.game.currentRun().run.elapsedDays).toBe(clockBeforeLook);
    const player = h.repos.cultivators.getById(cultivator.id)!;
    expect(h.game.present(player).some(p => p.id === receiver.id)).toBe(true);
    return { ...h, house, room, object, receiver, player };
}

it('a played petition lends the actual stored object without creating stock, ownership, contribution or debt', async () => {
    const h = await atAStore(true, 'store-loan');
    const count = h.game.atHand!.objects.length;
    const merit = h.repos.sects.getMembership(h.player.id)!.contribution;
    const purse = h.player.spiritStones;
    const obligations = JSON.stringify(h.game.atHand!.obligations);
    const turn = await h.game.act(`I petition ${h.house.name} for permission to borrow ${h.object.name}`);
    expect(turn.toolCalls.some(c => c.name === 'world.whetherItLeavesTheStore' && c.ok), turn.narration).toBe(true);
    const moved = h.game.atHand!.objects.find(o => o.id === h.object.id)!;
    expect(moved.possessorId).toBe(h.player.id);
    expect(moved.ownerId).toBe(h.house.id);
    expect(moved.provenance.at(-1)?.how).toBe('lent');
    expect(moved.tags).toEqual(h.object.tags.filter(t => t !== 'held' && t !== 'worn'));
    expect(h.game.atHand!.objects.length).toBe(count);
    expect(h.repos.sects.getMembership(h.player.id)!.contribution).toBe(merit);
    expect(h.game.state().cultivator.spiritStones).toBe(purse);
    expect(JSON.stringify(h.game.atHand!.obligations)).toBe(obligations);
}, 120_000);

it('door access reads a real held key, and loses that permission when the key is put down or ruined', async () => {
    const h = await atAStore(true, 'store-held-key');
    // A key fixture tests the existing door contract, not natural key acquisition.
    h.room.sealed = true;
    const keyId = String(h.room.data.keyId);
    expect(h.room.data.keyId, 'the actual generated treasury has a lock id').toBeDefined();
    const key = makeObject({ id: 'operator-key', name: 'Operator key fixture', kind: 'key',
        possessorId: h.player.id, ownerId: h.house.id, data: { keyId } });
    h.game.atHand!.objects.push(key);
    const door = () => {
        const { access } = howThisCultivatorStandsInTheHouseHolding({ ground: h.room, cultivator: h.player,
            standing: null, objects: h.game.atHand!.objects });
        return reachThrough(pathTo(h.game.atHand!.locations, h.room.id), access);
    };
    expect(door().stoppedAt).toBeNull();
    key.possessorId = null;
    expect(door().stoppedAt).not.toBeNull();
    key.possessorId = h.player.id;
    key.tags.push('ruined');
    expect(door().stoppedAt).not.toBeNull();
}, 120_000);

it('an approved request still refuses an object this actual body cannot carry', async () => {
    const h = await atAStore(true, 'store-body-capacity');
    const beforeHolder = h.object.possessorId;
    const beforeOwner = h.object.ownerId;
    h.object.weight = Number.MAX_SAFE_INTEGER;
    const result = await askingYourHouseForAStoredObject(h.game, h.game.currentRun().run, h.player,
        h.house.name, h.object.name, `I ask to borrow ${h.object.name}`);
    expect(result?.facts.headline).toContain('cannot carry');
    expect(h.object.possessorId).toBe(beforeHolder);
    expect(h.object.ownerId).toBe(beforeOwner);
}, 120_000);

it('an explicit gift transfers ownership through the same actual store approval', async () => {
    const h = await atAStore(true, 'store-gift');
    const result = await askingYourHouseForAStoredObject(h.game, h.game.currentRun().run, h.player,
        h.house.name, h.object.name, `I ask the house to give me ${h.object.name}`);
    expect(result?.outcome).toBe('executed');
    const moved = h.game.atHand!.objects.find(o => o.id === h.object.id)!;
    expect(moved.ownerId).toBe(h.player.id);
    expect(moved.possessorId).toBe(h.player.id);
    expect(moved.provenance.at(-1)?.how).toBe('gifted');
}, 120_000);

it('the existing body can refuse a tracked loan without changing the object or purse', async () => {
    const h = await atAStore(false, 'store-refusal');
    const before = JSON.stringify(h.game.atHand!.objects);
    const result = await askingYourHouseForAStoredObject(h.game, h.game.currentRun().run, h.player,
        h.house.name, h.object.name, `I ask to borrow ${h.object.name}`);
    expect(result?.outcome).toBe('refused');
    expect(result?.facts.structure.join(' ')).toContain('tracked:');
    expect(JSON.stringify(h.game.atHand!.objects)).toBe(before);
    expect(h.game.state().cultivator.spiritStones).toBe(h.player.spiritStones);
}, 120_000);

it('missing mouth, remote stock, sealed access and personal property cannot acquire a house object', async () => {
    const h = await atAStore(true, 'store-physical-guards');
    const ask = () => askingYourHouseForAStoredObject(h.game, h.game.currentRun().run,
        h.repos.cultivators.getById(h.player.id)!, h.house.name, h.object.name, `I ask to borrow ${h.object.name}`);
    const before = JSON.stringify(h.object);
    h.receiver.activity = { kind: 'at_a_table', withIds: [], note: 'Eating.', sinceDay: h.game.atHand!.currentDay,
        untilDay: h.game.atHand!.currentDay + 1 };
    expect((await ask())?.facts.headline).toContain('Nobody here receives');
    expect(JSON.stringify(h.object)).toBe(before);
    h.room.sealed = true;
    expect((await ask())?.facts.headline).toContain('storage door');
    h.room.sealed = false;
    h.repos.cultivators.update(h.player.id, { location: h.house.name });
    expect((await ask())?.facts.headline).toContain('not here');
    h.repos.cultivators.update(h.player.id, { location: h.room.name });
    h.object.possessorId = h.receiver.id;
    h.object.ownerId = h.receiver.id;
    expect(await ask()).toBeNull();
    expect(h.object.ownerId).toBe(h.receiver.id);
}, 120_000);

// With opening keys applied, no fixture grants a key to the player. Their loan
// still reaches the existing house-body answer beside the actual custodian.
async function besideTheKeyCustodian(allowed: boolean, seed: string) {
    const h = await atAStore(allowed, seed);
    const world = h.game.atHand!;
    const key = world.objects.find(o => o.kind === 'key' && o.ownerId === h.house.id
        && o.data.keyId === h.room.data.keyId)!;
    expect(key, 'a real opening key for this actual lock').toBeDefined();
    expect(key.possessorId, 'opening custody used this actual office holder').toBe(h.receiver.id);
    const outside = world.locations.find(p => p.id === h.room.parentId)!;
    expect(outside, 'the actual ordinary ground outside the locked room').toBeDefined();
    h.room.sealed = true;
    h.receiver.locationId = outside.id;
    h.repos.cultivators.update(h.player.id, { location: outside.name });
    const area = theAreasOf(world, outside).whereIs.get(h.receiver.id)!;
    expect(area).toBeDefined();
    h.repos.cultivators.standIn(h.player.id, area);
    h.game.theWorldMoved();
    const player = h.repos.cultivators.getById(h.player.id)!;
    expect(h.game.present(player).some(p => p.id === h.receiver.id)).toBe(true);
    return { ...h, player, key };
}

it('the actual opening key can be borrowed outside its locked room through ordinary house approval', async () => {
    const h = await besideTheKeyCustodian(true, 'opening-key-loan');
    const id = h.key.id;
    const result = await askingYourHouseForAStoredObject(h.game, h.game.currentRun().run, h.player,
        h.receiver.name, h.key.name, `I ask to borrow ${h.key.name}`, h.receiver.id);
    expect(result?.outcome).toBe('executed');
    const key = h.game.atHand!.objects.find(o => o.id === id)!;
    expect(key.possessorId).toBe(h.player.id);
    expect(key.ownerId).toBe(h.house.id);
    expect(key.provenance.at(-1)?.how).toBe('lent');
    expect(key.data.keyId).toBe(h.room.data.keyId);
    expect(h.game.atHand!.objects.filter(o => o.id === id)).toHaveLength(1);
}, 120_000);

it('holding the office key does not override the existing house-body refusal', async () => {
    const h = await besideTheKeyCustodian(false, 'opening-key-refusal');
    const before = JSON.stringify(h.key);
    const result = await askingYourHouseForAStoredObject(h.game, h.game.currentRun().run, h.player,
        h.receiver.name, h.key.name, `I ask to borrow ${h.key.name}`, h.receiver.id);
    expect(result?.outcome).toBe('refused');
    expect(result?.facts.headline).toContain('does not release');
    expect(JSON.stringify(h.key)).toBe(before);
}, 120_000);

it('a changed responsible office does not replace the actual custodian for physical handover', async () => {
    const h = await besideTheKeyCustodian(true, 'opening-key-new-office');
    const world = h.game.atHand!;
    h.receiver.factionRankIndex = 0;
    const workingHour = Array.from({ length: 24 }, (_, hour) => hour).find(hour => {
        world.currentHour = hour;
        const work = routineOf(world, h.receiver);
        return !work.home && work.activity?.kind === 'the_work_of_their_rank'
            && !work.activity.thingId && work.activity.withIds.length === 0;
    });
    expect(workingHour, 'the former office holder is currently doing ordinary work').toBeDefined();
    world.currentHour = workingHour!;
    h.db.prepare('UPDATE runs SET elapsed_days = ? WHERE id = ?')
        .run(Math.floor(h.game.currentRun().run.elapsedDays) + workingHour! / 24, h.game.currentRun().run.id);
    const roll = world.npcs.filter(n => n.status === 'alive' && n.factionId === h.house.id && n.id !== h.player.id)
        .map(n => ({ id: n.id, rankIndex: rankIndexOf(h.game, n.id, h.house.ranks.length) }))
        .filter(n => n.rankIndex >= 0);
    roll.push({ id: h.player.id, rankIndex: rankIndexOf(h.game, h.player.id, h.house.ranks.length) });
    const offices = portfoliosIn({ npcs: world.npcs, locations: world.locations, sectId: h.house.id, roll, rankCount: h.house.ranks.length });
    const responsible = offices.find(p => p.purpose === 'treasury')?.holderId;
    expect(responsible).toBeTruthy();
    expect(responsible).not.toBe(h.receiver.id);
    expect(h.key.possessorId).toBe(h.receiver.id);
    h.game.theWorldMoved();
    expect(h.game.present(h.player).some(p => p.id === h.receiver.id)).toBe(true);
    const decision = whetherItLeavesTheStore({ significance: h.key.significance, meaning: 'use_it_and_return_it',
        room: 'treasury', roll, portfolios: offices, rankCount: h.house.ranks.length, askerId: h.player.id });
    const result = await askingYourHouseForAStoredObject(h.game, h.game.currentRun().run, h.player,
        h.receiver.name, h.key.name, `I ask to borrow ${h.key.name}`, h.receiver.id);
    expect(result?.facts.headline).not.toContain('Nobody here receives');
    expect(result?.outcome).toBe(decision.allowed ? 'executed' : 'refused');
    expect(world.objects.find(k => k.id === h.key.id)?.possessorId)
        .toBe(decision.allowed ? h.player.id : h.receiver.id);
}, 120_000);


it('an ordinary approved loan equips the actual seeded cauldron used by the refinement receipt', async () => {
    const h = await atAStore(true, 'store-cauldron-loan', true);
    const before = theBestVesselToHand(h.game.atHand!.objects, h.player.id, 'cauldron', h.player.realmOrdinal);
    expect(before?.objectId).not.toBe(h.object.id);
    const borrowed = await askingYourHouseForAStoredObject(h.game, h.game.currentRun().run, h.player,
        h.receiver.name, h.object.name, `I ask to borrow ${h.object.name}`, h.receiver.id);
    expect(borrowed?.outcome, borrowed?.facts.prose).toBe('executed');
    const vessel = h.game.atHand!.objects.find(o => o.id === h.object.id)!;
    expect(vessel.ownerId).toBe(h.house.id);
    expect(vessel.possessorId).toBe(h.player.id);
    expect(vessel.provenance.at(-1)?.how).toBe('lent');
    const toHand = theBestVesselToHand(h.game.atHand!.objects, h.player.id, 'cauldron', h.player.realmOrdinal)!;
    expect(toHand.objectId).toBe(vessel.id);
    const recipe = getRecipe('recipe-minor-healing')!;
    for (const ingredient of recipe.ingredients)
        addToPouch(h.db, h.player.id, ingredient.itemId, 'herb', ingredient.quantity);
    const refined = await handleRefine({ action: 'refine', cultivatorId: h.player.id,
        recipeId: recipe.id, supplements: [] }) as { cauldron?: { objectId: string; grade: string } };
    expect(refined.cauldron).toMatchObject({ objectId: vessel.id, grade: toHand.grade });
    expect(h.game.atHand!.objects.find(o => o.id === vessel.id)!.ownerId).toBe(h.house.id);
}, 120_000);

it('a refused cauldron loan leaves the same house vessel unavailable to the hands and refinement', async () => {
    const h = await atAStore(false, 'store-cauldron-refusal', true);
    const before = theBestVesselToHand(h.game.atHand!.objects, h.player.id, 'cauldron', h.player.realmOrdinal);
    const owner = h.object.ownerId, holder = h.object.possessorId;
    const refused = await askingYourHouseForAStoredObject(h.game, h.game.currentRun().run, h.player,
        h.receiver.name, h.object.name, `I ask to borrow ${h.object.name}`, h.receiver.id);
    expect(refused?.outcome).toBe('refused');
    expect(h.game.atHand!.objects.find(o => o.id === h.object.id)).toMatchObject({ ownerId: owner, possessorId: holder });
    expect(theBestVesselToHand(h.game.atHand!.objects, h.player.id, 'cauldron', h.player.realmOrdinal)).toEqual(before);
    const recipe = getRecipe('recipe-minor-healing')!;
    for (const ingredient of recipe.ingredients)
        addToPouch(h.db, h.player.id, ingredient.itemId, 'herb', ingredient.quantity);
    const refined = await handleRefine({ action: 'refine', cultivatorId: h.player.id,
        recipeId: recipe.id, supplements: [] }) as { cauldron?: { objectId: string } | null };
    expect(refined.cauldron?.objectId).not.toBe(h.object.id);
}, 120_000);
