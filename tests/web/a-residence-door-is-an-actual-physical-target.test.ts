/**
 * Owner force ruling, 2026-10-03. The vault coverage did not cover an actual owned
 * residence slab. Native residence location identity/material already exist;
 * private invitation alone still proves no locked physical bedroom door.
 * These controls use actual seeded residences, native force/material,
 * normal game.act destroy and a real ledger-triggered closed-door seclusion.
 * Residence02 native run: 8 passed, 3 failed because a fixed scripted narration
 * was asserted. Residence03 then passed16/19 including vault controls but the same
 * three refused receipt summaries carried only structure[0], not the reason.
 * Residence05 keeps scripted action routing and requests empty narration so the
 * native fallback renders actual engine facts. !ok is asserted separately from
 * the grade/reach reason. This is engine-authority fact acceptance, not live-LLM
 * prose acceptance; state/time/custody assertions and arrangements are unchanged.
 * Operator body/position arrangements are explicit and refresh through free look.
 * No residence, actor, door material, key or approval is manufactured.
 * Reinforcement06 explicitly adds one existing native catalog beast part to the
 * pouch via addToPouch; this operator arrangement is not a narrated hunt or grant.
 * Native NPC damage must commit only from the cut-to-happened selected arrival,
 * before a fight/death estate can conclude, never from rolling a future window.
 * Broken material persists with the location through sitter/title change, while
 * the cave's qi seal/cycle and ordinary stock/title remain separate authorities.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { FALSE_IMMORTAL_ORDINAL, maxHpForOrdinal } from '../../src/engine/cultivation/realms.js';
import { theActualResidenceDoor } from '../../src/engine/world/a-residence-door-that-was-broken.js';
import { whoHoldsThisPlace } from '../../src/engine/world/somewhere-that-is-theirs.js';
import { pathTo, reachThrough } from '../../src/engine/world/architecture.js';
import { howThisCultivatorStandsInTheHouseHolding } from '../../src/web/how-this-cultivator-stands-on-this-ground.js';
import { WorldStateRepository } from '../../src/storage/repos/world-state.repo.js';
import { whatTheyCouldBreakADoorWith, accountsComingDue } from '../../src/web/who-comes-to-settle-an-account.js';
import { theDoorYouSitBehind } from '../../src/web/seclusion-door.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { createObligation } from '../../src/engine/social/grudges.js';
import { writeOneObligation } from '../../src/storage/repos/obligation.repo.js';
import { encountersFor, PLAYER_ROLL_IDENTITY } from '../../src/web/encounters.js';
import { walkingRouteFrom } from '../../src/engine/world/locations.js';
import { positionOnRoad } from '../../src/engine/world/road-course.js';
import { writeFlag, addToPouch } from '../../src/server/consolidated/cultivation-support.js';
import { BEAST_MATERIALS, getBeast } from '../../src/data/cultivation/beasts.js';
import { whatThePartCouldMakeOfIt } from '../../src/engine/world/door-materials.js';
import { LESSER_ACTION_DAYS } from '../../src/web/lesser-action-costs.js';
import { FLAG_ROAD_STOPPED } from '../../src/web/a-road-stopped-partway.js';
import { retell } from '../../src/engine/world/what-people-are-saying.js';

async function outsideADoor(ordinal = FALSE_IMMORTAL_ORDINAL, seed = 'actual-residence-door') {
    const plans: string[] = [];
    const h = await makeGameInWorld({ seed, worldSeed: 'road-world',
        provider: new ScriptedProvider({ plans, narrations: [] }) });
    const opened = await h.game.newRun('Residence visitor');
    const world = (await h.game.loadWorld())!;
    const arranged = { ...opened.cultivator, realmOrdinal: ordinal };
    const matches = world.locations.filter(row => theActualResidenceDoor(row))
        .map(target => ({ target, parent: world.locations.find(row => row.id === target.parentId) }))
        .filter(pair => pair.parent && world.locations.filter(row => row.name === pair.target.name).length === 1)
        .filter(pair => {
            const access = howThisCultivatorStandsInTheHouseHolding({ ground: pair.parent!,
                cultivator: arranged, standing: null, objects: world.objects, onDay: routineTime(world) }).access;
            const reach = reachThrough(pathTo(world.locations, pair.parent!.id), access,
                { enteredAt: pair.parent!.id });
            return reach.stoppedAt === null && reach.level !== 'barred';
        });
    const chosen = matches[0];
    expect(chosen, 'an actual seeded residence with a genuinely accessible outside parent').toBeDefined();
    const a = chosen!;
    const hp = maxHpForOrdinal(opened.cultivator.attributes.might, ordinal);
    h.repos.cultivators.update(opened.cultivator.id, { realmOrdinal: ordinal,
        hp, maxHp: hp, location: a.parent!.name });
    h.repos.cultivators.standIn(opened.cultivator.id, null);
    h.game.theWorldMoved();
    await h.game.act('I look around');
    return { ...h, ...opened, plans, world, target: a.target, parent: a.parent! };
}

it('ordinary destroy breaks the actual residence door and persists damage without taking its goods', async () => {
    const h = await outsideADoor();
    const body = h.repos.cultivators.getById(h.cultivator.id)!;
    const before = structuredClone(h.target);
    const goods = structuredClone(h.world.objects);
    expect(whatTheyCouldBreakADoorWith(h.world, body)).toBeGreaterThanOrEqual(theActualResidenceDoor(before)!.material.standsAt);
    h.plans.push(JSON.stringify({ action: 'destroy', target: `door of ${h.target.name}` }));
    const turn = await h.game.act(`I break the door of ${h.target.name}`);
    expect(turn.toolCalls.some(call => call.action === 'destroy' && call.ok && call.summary.includes('physical door'))).toBe(true);
    const loaded = new WorldStateRepository(h.db).loadWorld(h.world.id)!;
    const target = loaded.locations.find(row => row.id === before.id)!;
    expect(theActualResidenceDoor(target)!.brokenOnDay).not.toBeNull();
    expect(target.sealed).toBe(before.sealed);
    expect(target.cycle).toEqual(before.cycle);
    expect(target.thresholds).toEqual(before.thresholds);
    expect(target.hazards).toEqual(before.hazards);
    expect(whoHoldsThisPlace(target)).toBe(whoHoldsThisPlace(before));
    expect(loaded.objects).toEqual(goods);
    expect(loaded.history.facts.some(fact => fact.kind === 'object_destroyed'
        && fact.data.doorLocationId === target.id)).toBe(true);
    const deed = loaded.history.facts.find(fact => fact.kind === 'object_destroyed'
        && fact.data.doorLocationId === target.id)!;
    const saying = retell(loaded, deed, { id: body.id, name: body.name,
        realmOrdinal: body.realmOrdinal, locationId: h.parent.id,
        regionId: null, factionId: null }, deed.day);
    expect(saying.text).toContain(theActualResidenceDoor(before)!.material.name);
    expect(h.repos.cultivators.getById(body.id)!.location).toBe(body.location);
    // Explicit operator sitter/title change: same stored physical target, no rebuilt door.
    const later = { ...target, data: { ...target.data, heldById: body.id, heldByName: body.name } };
    loaded.locations[loaded.locations.indexOf(target)] = later;
    new WorldStateRepository(h.db).saveWorld(loaded);
    h.game.atHand = loaded;
    h.repos.cultivators.update(body.id, { location: later.name });
    h.repos.cultivators.standIn(body.id, null);
    await h.game.act('I look around');
    expect(theDoorYouSitBehind(h.game, h.repos.cultivators.getById(body.id)!)).toBeNull();
});

it('insufficient native force names the requirement and changes no physical state', async () => {
    const h = await outsideADoor(0);
    const body = h.repos.cultivators.getById(h.cultivator.id)!;
    const grade = theActualResidenceDoor(h.target)!.material.standsAt;
    expect(whatTheyCouldBreakADoorWith(h.world, body), 'native carried force remains below this actual slab').toBeLessThan(grade);
    const before = structuredClone(h.world.locations);
    const goods = structuredClone(h.world.objects);
    const start = h.game.currentRun().run.elapsedDays;
    h.plans.push(JSON.stringify({ action: 'destroy', target: `door of ${h.target.name}` }));
    const turn = await h.game.act(`I break the door of ${h.target.name}`);
    expect(turn.toolCalls.some(call => call.action === 'destroy' && !call.ok)).toBe(true);
    expect(turn.narration).toContain(`rated ${grade}`);
    expect(h.game.atHand!.locations).toEqual(before);
    expect(h.game.atHand!.objects).toEqual(goods);
    expect(h.game.currentRun().run.elapsedDays).toBe(start);
});

it('a supplied actual residence name elsewhere does not put its door within reach', async () => {
    const h = await outsideADoor();
    const another = h.world.locations.find(row => theActualResidenceDoor(row)
        && row.id !== h.target.id && row.parentId !== h.parent.id);
    expect(another, 'a real remote residence').toBeDefined();
    const before = structuredClone(h.world.locations);
    h.plans.push(JSON.stringify({ action: 'destroy', target: `door of ${another!.name}` }));
    const turn = await h.game.act(`I break the door of ${another!.name}`);
    expect(turn.toolCalls.some(call => call.action === 'destroy' && !call.ok)).toBe(true);
    expect(turn.narration).toContain('not within reach');
    expect(h.game.atHand!.locations).toEqual(before);
});

it('an admitted unfinished edge cannot use its coarse endpoint name to reach a residence door', async () => {
    const h = await outsideADoor();
    const route = walkingRouteFrom(h.world.locations, h.parent.id, h.target.id);
    expect(route && route.length > 1, 'an actual priced edge to the seeded residence').toBeTruthy();
    const firstDays = route![1]!.days;
    const walked = firstDays / 2;
    const position = positionOnRoad(route!, walked);
    expect(position.kind).toBe('edge');
    // Explicit operator arrangement of the sole native flag, using the actual route.
    writeFlag(h.db, h.cultivator.id, FLAG_ROAD_STOPPED, JSON.stringify({
        from: h.parent.name, to: h.target.name, road: route!.at(-1)!.days, walked, position }));
    const before = structuredClone(h.world.locations);
    const start = h.game.currentRun().run.elapsedDays;
    h.plans.push(JSON.stringify({ action: 'destroy', target: `door of ${h.target.name}` }));
    const turn = await h.game.act(`I break the door of ${h.target.name}`);
    expect(turn.toolCalls.some(call => call.action === 'destroy' && !call.ok)).toBe(true);
    expect(turn.narration).toContain('between road endpoints');
    expect(h.game.atHand!.locations).toEqual(before);
    expect(h.game.currentRun().run.elapsedDays).toBe(start);
});

it('a real resolved NPC door breach persists, while merely rolling the native future window does not damage it', async () => {
    const h = await outsideADoor(10, 'door-inn-2');
    h.repos.cultivators.update(h.cultivator.id, { location: h.target.name, spiritStones: 5000 });
    h.repos.cultivators.standIn(h.cultivator.id, null);
    await h.game.act('I look around');
    const body = h.repos.cultivators.getById(h.cultivator.id)!;
    const nativeDoor = theDoorYouSitBehind(h.game, body)!;
    expect(nativeDoor.locationId).toBe(h.target.id);
    const armed = new Set(h.world.objects.filter(row => row.power !== null).map(row => row.possessorId));
    const holder = h.world.npcs.find(npc => npc.status === 'alive' && npc.id !== body.id
        && !armed.has(npc.id) && npc.cultivation.realmOrdinal >= nativeDoor.standsAt
        && npc.cultivation.realmOrdinal >= body.realmOrdinal
        && npc.cultivation.realmOrdinal <= body.realmOrdinal + 4);
    expect(holder, 'an actual living sender whose ordinary rung can breach this slab and engage the sitter').toBeDefined();
    writeOneObligation(h.db, createObligation({ kind: 'grudge', holderId: holder!.id,
        subjectId: body.id, cause: 'humiliation', severity: 'unforgivable', onDay: 0,
        description: 'The sitter humiliated this actual sender in front of their people.' }));
    const start = h.game.currentRun().run;
    const before = structuredClone(h.game.atHand!.locations);
    const proposed = encountersFor({ repos: h.repos, knowledge: h.game.knowledge, world: h.game.atHand }, {
        seed: start.seed, startDay: Math.floor(start.elapsedDays), days: 365,
        activity: 'sealed', cultivator: body, door: nativeDoor,
        rollIdentity: PLAYER_ROLL_IDENTITY,
        comingForYou: accountsComingDue(h.game, body) });
    expect(proposed.occurrences.some(occurrence => occurrence.door?.what === 'broke_in'
        && occurrence.door.locationId === h.target.id), 'a native proposed physical breach exists before time is spent').toBe(true);
    expect(h.game.atHand!.locations).toEqual(before);
    // The actual front door performs the sitting, cuts to happened, then resolves the attack.
    h.plans.push(JSON.stringify({ action: 'seclude', days: 365 }));
    const turn = await h.game.act('I go into closed-door seclusion for one year anyway.');
    const reopened = new WorldStateRepository(h.db).loadWorld(h.world.id)!;
    const target = reopened.locations.find(row => row.id === h.target.id)!;
    expect(typeof theActualResidenceDoor(target)?.brokenOnDay, JSON.stringify(turn.toolCalls)).toBe('number');
    expect(reopened.history.facts.some(fact => fact.kind === 'object_destroyed'
        && fact.data.doorLocationId === target.id
        && fact.actors.some(actor => actor.id === holder!.id))).toBe(true);
    expect(target.sealed).toBe(before.find(row => row.id === target.id)!.sealed);
    expect(target.cycle).toEqual(before.find(row => row.id === target.id)!.cycle);
    // Fresh physical read after the resolved arrival, independent of who sits next.
    expect(theActualResidenceDoor(target)!.brokenOnDay).toBeGreaterThanOrEqual(0);
    expect(target.data.heldById).toBe(before.find(row => row.id === target.id)!.data.heldById);
});

/** After actual destruction, reinforcement must refuse the missing slab before parts are considered. */
it('reinforcement refuses an actually broken residence without spending or repairing it', async () => {
    const h = await outsideADoor();
    h.plans.push(JSON.stringify({ action: 'destroy', target: `door of ${h.target.name}` }));
    const broken = await h.game.act(`I break the door of ${h.target.name}`);
    expect(broken.toolCalls.some(call => call.action === 'destroy' && call.ok)).toBe(true);
    const world = h.game.atHand!;
    const at = world.locations.findIndex(row => row.id === h.target.id);
    const current = world.locations[at]!;
    // Explicit operator title/position arrangement on the existing physical location.
    world.locations[at] = { ...current, data: { ...current.data,
        heldById: h.cultivator.id, heldByName: h.cultivator.name } };
    h.game.theWorldMoved();
    h.repos.cultivators.update(h.cultivator.id, { location: current.name });
    h.repos.cultivators.standIn(h.cultivator.id, null);
    await h.game.act('I look around');
    const before = structuredClone(h.game.atHand!.locations);
    const objects = structuredClone(h.game.atHand!.objects);
    // Residence06: explicit operator pouch arrangement uses an existing catalog part.
    // Its native beast/harvest rung and these hands genuinely exceed the slab,
    // so the old missing guard would spend it and report reinforcement.
    const body = h.repos.cultivators.getById(h.cultivator.id)!;
    const slab = theActualResidenceDoor(h.game.atHand!.locations[at]!)!.material;
    const part = BEAST_MATERIALS.find(material => whatThePartCouldMakeOfIt(
        getBeast(material.sourceBeastId)?.ordinal ?? material.harvestOrdinal,
        body.realmOrdinal) > slab.standsAt);
    expect(part, 'an existing catalog part genuinely eligible to reinforce this native slab').toBeDefined();
    addToPouch(h.db, body.id, part!.id, 'herb', 1);
    const inventory = h.db.prepare('SELECT * FROM cultivator_pouch WHERE holder_id = ? ORDER BY item_id').all(h.cultivator.id);
    const elapsed = h.game.currentRun().run.elapsedDays;
    h.plans.push(JSON.stringify({ action: 'craft', target: `reinforce the door with the ${part!.name}` }));
    const turn = await h.game.act(`I reinforce the door with the ${part!.name}`);
    expect(turn.toolCalls.some(call => call.action === 'craft' && !call.ok),
        JSON.stringify({ toolCalls: turn.toolCalls, narration: turn.narration,
            scriptedPlan: h.plans.at(-1), actualSentence: `I reinforce the door with the ${part!.name}` })).toBe(true);
    expect(turn.narration).toContain('There is no intact slab here to reinforce. Repair must be an actual modeled action.');
    expect(h.game.atHand!.locations).toEqual(before);
    expect(h.game.atHand!.objects).toEqual(objects);
    expect(h.db.prepare('SELECT * FROM cultivator_pouch WHERE holder_id = ? ORDER BY item_id').all(h.cultivator.id)).toEqual(inventory);
    expect(h.game.currentRun().run.elapsedDays).toBe(elapsed);
});

/** Craft target ownership serves a normal intact slab too; it is not a broken-door waiver. */
it('a named native part reinforces an intact residence and spends its actual part and action clock once', async () => {
    const h = await outsideADoor(9, 'intact-native-reinforcement');
    const world = h.game.atHand!;
    const at = world.locations.findIndex(row => row.id === h.target.id);
    const original = world.locations[at]!;
    // Explicit operator title/physical sitter arrangement on an existing intact location.
    world.locations[at] = { ...original, data: { ...original.data,
        heldById: h.cultivator.id, heldByName: h.cultivator.name } };
    h.game.theWorldMoved();
    h.repos.cultivators.update(h.cultivator.id, { location: original.name });
    h.repos.cultivators.standIn(h.cultivator.id, null);
    await h.game.act('I look around');
    const body = h.repos.cultivators.getById(h.cultivator.id)!;
    const slab = theActualResidenceDoor(h.game.atHand!.locations[at]!)!;
    expect(slab.brokenOnDay).toBeNull();
    const part = BEAST_MATERIALS.find(material => whatThePartCouldMakeOfIt(
        getBeast(material.sourceBeastId)?.ordinal ?? material.harvestOrdinal,
        body.realmOrdinal) > slab.material.standsAt);
    expect(part, 'an actual catalog part that native hands can work above this slab').toBeDefined();
    addToPouch(h.db, body.id, part!.id, 'herb', 1);
    const beforeRun = h.game.currentRun().run;
    h.plans.push(JSON.stringify({ action: 'craft', target: `reinforce the door with the ${part!.name}` }));
    const turn = await h.game.act(`I reinforce the door with the ${part!.name}`);
    expect(turn.toolCalls.some(call => call.action === 'craft' && call.ok
        && call.summary.includes('door is reinforced')), JSON.stringify({ toolCalls: turn.toolCalls,
            narration: turn.narration, scriptedPlan: h.plans.at(-1) })).toBe(true);
    const stored = new WorldStateRepository(h.db).loadWorld(h.world.id)!;
    const actual = stored.locations.find(row => row.id === original.id)!;
    expect(actual.data.doorStandsAt).toBeGreaterThan(slab.material.standsAt);
    expect(actual.data.doorReinforcedWith).toBe(part!.id);
    expect(theActualResidenceDoor(actual)!.brokenOnDay).toBeNull();
    expect(actual.sealed).toBe(original.sealed);
    expect(actual.cycle).toEqual(original.cycle);
    const left = h.db.prepare('SELECT quantity FROM cultivator_pouch WHERE holder_id = ? AND item_id = ?')
        .get(body.id, part!.id) as { quantity: number } | undefined;
    expect(left?.quantity ?? 0).toBe(0);
    expect(h.game.currentRun().run.elapsedDays).toBe(beforeRun.elapsedDays + LESSER_ACTION_DAYS.craft);
    expect(h.game.currentRun().run.turn).toBe(beforeRun.turn + 1);
    expect(h.repos.cultivators.getById(body.id)!.alive).toBe(true);
});
