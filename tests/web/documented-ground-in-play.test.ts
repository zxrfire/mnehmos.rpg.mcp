/**
 * The audit found geography and ownership features present only in documents.
 * These turns protect the observable routes: a road reaches people, a sighting
 * can be followed without its name, spent goods leave the hand, and a living
 * cultivator can leave something behind a gate. Both seeds are pinned.
 * Disabling the town route, house catalog, graded slips, core retirement,
 * comprehension reads, sighting target or ground establishment makes these red.
 * The authored archive's ordinal gate was also seeded as a permanent seal, so
 * entering it could never reach the charter. The gate is tested through entry.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { makeObject, isRuined } from '../../src/engine/world/possessions.js';
import { residenceOf } from '../../src/engine/world/somewhere-that-is-theirs.js';
import { aLongRangeCommunicationSlip, theTwinOfALongSlip } from '../../src/engine/world/a-long-range-communication-slip.js';
import { howFarFromTheSeat } from '../../src/engine/world/a-communication-talisman-carries-word-home.js';
import { addToPouch, pouchQuantity, readJsonFlag, writeFlag } from '../../src/server/consolidated/cultivation-support.js';
import { recordACopyHeld, holdsACopyOf } from '../../src/server/consolidated/technique-manage.js';
import { GRAVES } from '../../src/data/cultivation/inheritance-trials.js';
import { getSect } from '../../src/data/cultivation/sects.js';
import { PLACE } from '../../src/data/cultivation/place-names.js';
import { getPill } from '../../src/data/cultivation/pills.js';
import { formInsight, recordAchievement } from '../../src/engine/cultivation/understanding.js';
import { forStream } from '../../src/engine/cultivation/rng.js';
import { HERBS } from '../../src/data/cultivation/herbs.js';
import { FLAG_RATIONS_HELD } from '../../src/web/flag-keys.js';
import { theyOweTheHouseAReport, doesTheHouseExpect } from '../../src/engine/world/a-house-expects-somebody-it-took-on.js';
import { countedHoldingKey } from '../../src/data/cultivation/what-a-house-moves-its-people-on.js';

async function arrange(seed: string, ordinal = 25) {
    const harness = await makeGameInWorld({ seed, worldSeed: 'documented-ground-world' });
    const { cultivator } = await harness.game.newRun('Lin Qiaozhen');
    harness.repos.cultivators.update(cultivator.id, { realmOrdinal: ordinal, spiritStones: 100_000,
        hp: 10_000, maxHp: 10_000, qi: 100_000, maxQi: 100_000,
        attributes: { ...cultivator.attributes, insight: 1 } });
    writeFlag(harness.db, cultivator.id, FLAG_RATIONS_HELD, '100');
    const world = (await harness.game.loadWorld())!;
    harness.game.atHand = world;
    return { ...harness, cultivator, world };
}

function learned(subject: string) {
    const achievement = recordAchievement({ kind: 'witnessed_phenomenon', onDay: 0, turn: 0,
        summary: 'Studied the writing with a reader.' }, forStream('documented-reader', 'study', subject));
    return { achievements: [achievement], insights: [formInsight({ domain: 'formation', subject,
        access: { kind: 'site', label: subject }, opening: 'Studied the writing with a reader.' }, 1, achievement)] };
}

describe('documented ground reached in play', () => {
    it('walks from a gate to its town, meets residents, buys food and reads public notices', async () => {
        const { game, db, repos, cultivator, world } = await arrange('gate-town');
        const opening = world.locations.find(place => place.name === game.state().cultivator.location)!;
        const town = world.locations.find(place => place.tags.includes('gate_town') && place.parentId !== opening.parentId)!;
        const gate = world.locations.find(place => place.id === town.data.gateId)!;
        repos.cultivators.update(cultivator.id, { location: gate.name });
        const arrived = await game.act('I travel to the town');
        expect(game.state().cultivator.location, arrived.narration).toBe(town.name);
        const company = await game.act('who is here');
        expect(company.toolCalls.some(call => call.ok)).toBe(true);
        expect(game.present(game.state().cultivator).length, JSON.stringify({
            people: game.atHand!.npcs.filter(n => n.id.includes(town.id)).map(n => [n.locationId, n.status, n.activity?.kind]),
            standingIn: game.state().cultivator.standingIn, narration: company.narration
        })).toBeGreaterThan(0);
        const wall = await game.act('I read the notices');
        expect(wall.narration.toLowerCase()).toMatch(/notice|intake|bring|want|recruit|posted/);
        writeFlag(db, cultivator.id, FLAG_RATIONS_HELD, '0');
        const food = await game.act('I buy one ration');
        expect(Number(readJsonFlag(db, cultivator.id, FLAG_RATIONS_HELD)), food.narration).toBe(1);
        const directions = await game.act('where can I go');
        const province = world.locations.find(place => place.id === town.parentId)!;
        expect(directions.narration).toContain(`${town.name}, ${province.name}`);
        const returned = await game.act('I travel to the gate');
        expect(game.state().cultivator.location, returned.narration).toBe(gate.name);
    }, 120_000);

    it('reaches the fixed spring, its painted cliff and both seated houses', async () => {
        const { game, repos, cultivator, world } = await arrange('spring');
        const spring = world.locations.find(place => place.name === PLACE.SAND_WELL)!;
        repos.cultivators.update(cultivator.id, { location: spring.name });
        const arrived = await game.act(`I travel to ${PLACE.PAINTED_ESCARPMENT}`);
        expect(game.state().cultivator.location, arrived.narration).toBe(PLACE.PAINTED_ESCARPMENT);
        const read = await game.act('I investigate the inscription');
        expect(read.narration).toContain('donors');
        await game.act(`I travel to ${PLACE.SPRING_ARCHIVE}`);
        const lintel = await game.act('I investigate the inscription');
        expect(lintel.narration).not.toContain('predecessors');
        await game.act('I enter the ruins');
        const recovered = await game.act('I take the contents');
        expect(recovered.narration).toContain('Western Road Edict');
        const charter = await game.act('I investigate Western Road Edict');
        expect(charter.narration).toContain('cannot establish an unbroken succession');
        for (const id of ['sect-moonwater', 'sect-five-grains']) {
            expect(world.factions.find(house => house.id === id)?.seatLocationId).toBeTruthy();
            expect(getSect(id)).toBeDefined();
        }
    }, 120_000);

    it('burns an owned heaven slip to send word beyond an ordinary slip\'s reach', async () => {
        const { game, repos, cultivator, world } = await arrange('long-word');
        const house = world.factions.find(house => house.seatLocationId)!;
        const far = world.locations.find(place => {
            const distance = howFarFromTheSeat(world.locations)(house.seatLocationId!, place.id);
            return distance !== null && distance > 12 && distance <= 120;
        })!;
        expect(far).toBeDefined();
        repos.sects.addMember(house.id, cultivator.id, 1);
        repos.cultivators.update(cultivator.id, { location: far.name });
        const slip = aLongRangeCommunicationSlip({ id: 'obj-played-long-slip',
            makerId: cultivator.id, makerName: cultivator.name, holderId: cultivator.id,
            holderName: cultivator.name, houseId: house.id, onDay: world.currentDay });
        world.objects.push(slip, theTwinOfALongSlip(slip, house.seatLocationId!));
        game.theWorldMoved();
        const sent = await game.act('I send word to my sect that the pass is held');
        expect(sent.narration).toContain('the pass is held');
        const retired = game.atHand!.objects.find(object => object.id === slip.id)!;
        expect(isRuined(retired)).toBe(true);
        expect(retired.possessorId).toBeNull();
        expect(retired.provenance.at(-1)?.previousHolderId).toBe(cultivator.id);
        const again = await game.act('I send word to my sect that the pass is held');
        expect(again.toolCalls.some(call => !call.ok)).toBe(true);
    }, 120_000);

    it('cuts a tracked heaven slip from materials and keeps its twin at the hall', async () => {
        const { game, db, repos, cultivator, world } = await arrange('cut-long-word', 45);
        const house = world.factions.find(house => house.seatLocationId)!;
        repos.sects.addMember(house.id, cultivator.id, 1);
        repos.cultivators.update(cultivator.id, { location: world.locations.find(p => p.id === house.seatLocationId)!.name });
        const herb = HERBS.find(herb => herb.grade === 'earth')!;
        addToPouch(db, cultivator.id, herb.id, 'herb', 1);
        addToPouch(db, cultivator.id, 'mat-tiger-fang', 'herb', 1);
        addToPouch(db, cultivator.id, 'mat-tiger-core', 'herb', 1);
        world.objects.push(makeObject({ id: 'obj-slip-heart', name: 'White Tiger Core', kind: 'material',
            possessorId: cultivator.id, ownerId: cultivator.id, ownerName: cultivator.name,
            data: { materialId: 'mat-tiger-core', grade: 'heaven' } }));
        game.theWorldMoved();
        const cut = await game.act('I cut a heaven-grade communication talisman');
        const made = game.atHand!.objects.find(row => row.possessorId === cultivator.id && row.tags.includes('long-range-communication'));
        expect(made, cut.narration).toBeDefined();
        expect(made!.provenance.at(-1)?.how).toBe('crafted');
        expect(game.atHand!.objects.find(row => row.id === made!.data.twinId)?.locationId).toBe(house.seatLocationId);
    }, 120_000);

    it('lets a living NPC burn the same tracked slip in the yearly report pass', async () => {
        const { game, cultivator, world } = await arrange('npc-long-word');
        const slip = world.objects.find(row => row.tags.includes('long-range-communication') && row.possessorId)!;
        const house = world.factions.find(house => house.id === slip.data.markedBy)!;
        const sender = world.npcs.find(npc => npc.id === slip.possessorId)!;
        const far = world.locations.find(place => {
            const days = howFarFromTheSeat(world.locations)(house.seatLocationId!, place.id);
            return days !== null && days > 12 && days <= 120;
        })!;
        sender.locationId = far.id;
        sender.activity = { kind: 'stationed', note: 'Keeping a posting.', withIds: [], sinceDay: world.currentDay, untilDay: null };
        theyOweTheHouseAReport(world, sender.id, { houseId: house.id, person: { id: cultivator.id, name: cultivator.name },
            placeId: far.id, onDay: world.currentDay });
        game.theWorldMoved();
        await game.act('I wait 60 days');
        await game.act('I wait 60 days');
        await game.act('I wait 60 days');
        await game.act('I wait 60 days anyway');
        expect(isRuined(game.atHand!.objects.find(row => row.id === slip.id)!)).toBe(true);
        expect(doesTheHouseExpect(game.atHand!.factions.find(row => row.id === house.id)!, cultivator.id)).not.toBeNull();
    }, 120_000);

    it('delivers and retires an individually held core into a carriage', async () => {
        const { game, db, cultivator, world } = await arrange('core-hull', 21);
        for (const [id, count] of [['mat-tiger-fang', 16], ['mat-ox-horn', 8], ['mat-tiger-core', 1]] as const)
            addToPouch(db, cultivator.id, id, 'herb', count);
        const core = makeObject({ id: 'obj-played-core', name: 'Tiger Core', kind: 'material',
            possessorId: cultivator.id, ownerId: cultivator.id, ownerName: cultivator.name,
            data: { materialId: 'mat-tiger-core', grade: 'heaven' } });
        world.objects.push(core);
        game.theWorldMoved();
        const built = await game.act('I build an iron-rimmed carriage');
        expect(pouchQuantity(db, cultivator.id, 'mat-tiger-core'), built.narration).toBe(0);
        const spent = game.atHand!.objects.find(object => object.id === core.id)!;
        expect(isRuined(spent)).toBe(true);
        expect(spent.provenance.at(-1)?.source).toContain('carriage');
    }, 120_000);

    it('keeps marker facts readable but gives grave appraisal to a reader', async () => {
        const { game, repos, cultivator } = await arrange('grave-reader', 0);
        const grave = GRAVES.find(grave => grave.occupantOrdinal > 30)!;
        game.knowledge.learn({ holderId: cultivator.id, kind: 'place', id: grave.id,
            name: grave.name, onDay: 0, sourceKind: 'witnessed', stage: 'known' });
        const first = await game.act(`I approach ${grave.name}`);
        expect(first.narration).toContain('grave-reading');
        repos.cultivators.update(cultivator.id, learned('grave-reading'));
        const read = await game.act(`I approach ${grave.name}`);
        expect(read.narration).toMatch(/proven|intact crypt/);
        expect(read.narration).not.toContain('requires grave-reading');
    }, 120_000);

    it("retires a house's tracked core when its people build in the yearly pass", async () => {
        const { game, world } = await arrange('npc-core-hull');
        const house = world.factions.find(house => house.seatLocationId)!;
        house.resources[countedHoldingKey('conv-carriage-mortal')] = 100;
        house.resources[countedHoldingKey('conv-carriage-earth')] = 0;
        house.resources['yard.material.earth'] = 24;
        const core = makeObject({ id: 'obj-house-yard-core', name: 'White Tiger Core', kind: 'material',
            ownerId: house.id, ownerName: house.name, locationId: house.seatLocationId,
            tags: ['yard-stock'], data: { materialId: 'mat-tiger-core', core: true, grade: 'heaven' } });
        world.objects.push(core);
        game.theWorldMoved();
        await game.act('I wait 180 days');
        await game.act('I wait 180 days');
        const spent = game.atHand!.objects.find(object => object.id === core.id)!;
        expect(isRuined(spent)).toBe(true);
        expect(spent.provenance.at(-1)?.source).toContain('carriage');
    }, 120_000);

    it('returns the missing inscription knowledge and accepts a learned reading', async () => {
        const { game, repos, cultivator, world } = await arrange('inscription-reader', 0);
        const cliff = world.locations.find(place => place.name === PLACE.PAINTED_ESCARPMENT)!;
        repos.cultivators.update(cultivator.id, { location: cliff.name });
        const first = await game.act('I investigate the inscription');
        expect(first.narration).toContain('western road script');
        expect(first.narration).not.toContain('donors paid');
        repos.cultivators.update(cultivator.id, learned('western-road-script'));
        const read = await game.act('I investigate the inscription');
        expect(read.narration).toContain('donors paid');
    }, 120_000);

    it('retains and follows a sighting without first learning the place\'s name', async () => {
        const { game, db, cultivator, world } = await arrange('sighting');
        const view = await game.act('where can I go');
        const sightings = readJsonFlag<{ id: string; description: string }[]>(db, cultivator.id, 'located_places')!;
        expect(sightings.length).toBeGreaterThan(0);
        const at = sightings.findIndex(sighting => world.locations.some(place => place.id === sighting.id
            && !view.narration.includes(place.name)));
        expect(at).toBeGreaterThanOrEqual(0);
        const destination = world.locations.find(place => place.id === sightings[at]!.id)!;
        await game.act(`I travel to sighting ${at + 1}`);
        expect(game.state().cultivator.location).toBe(destination.name);
    }, 120_000);

    it('establishes a rogue residence below the Lid and stores goods there', async () => {
        const { game, db, repos, cultivator, world } = await arrange('own-ground');
        const ground = world.locations.find(place => place.kind === 'wilds' && !place.data.factionId)!;
        repos.cultivators.update(cultivator.id, { location: ground.name });
        await game.act('I establish a residence');
        const home = residenceOf(game.atHand!, cultivator.id)!;
        expect(home).not.toBeNull();
        expect(game.state().cultivator.location).toBe(home.name);
        const directions = await game.act('where can I go');
        const province = world.locations.find(place => place.id === ground.parentId)!;
        expect(directions.narration).toContain(`${home.name}, ${province.name}`);
        addToPouch(db, cultivator.id, 'pill-minor-healing', 'pill', 1);
        await game.act(`I leave ${getPill('pill-minor-healing')!.name} in my residence`);
        expect(pouchQuantity(db, home.id, 'pill-minor-healing')).toBe(1);
        expect(world.locations.some(place => place.tags.includes('residence') && place.data.heldById !== cultivator.id)).toBe(true);
        repos.cultivators.update(cultivator.id, { location: ground.name });
        const again = await game.act('I establish a residence');
        expect(again.narration).toContain('already hold');
        expect(game.state().cultivator.location).toBe(ground.name);
    }, 120_000);

    it('leaves a manual and artifact in a gated inheritance while still alive', async () => {
        const { game, db, repos, cultivator, world } = await arrange('living-inheritance', 17);
        const ground = world.locations.find(place => place.kind === 'wilds' && !place.data.factionId)!;
        repos.cultivators.update(cultivator.id, { location: ground.name });
        recordACopyHeld(db, cultivator.id, 'lesser-qi-gathering-manual');
        const blade = makeObject({ id: 'obj-inherited-blade', name: 'An inherited blade', kind: 'artifact', power: 17,
            possessorId: cultivator.id, ownerId: cultivator.id, ownerName: cultivator.name });
        const owner = world.factions[0]!;
        const borrowed = makeObject({ id: 'obj-borrowed-inheritance', name: 'A borrowed blade', kind: 'artifact', power: 13,
            possessorId: cultivator.id, ownerId: owner.id, ownerName: owner.name });
        world.objects.push(blade, borrowed);
        game.theWorldMoved();
        await game.act('I leave an inheritance for ordinal 17');
        const site = game.atHand!.locations.find(place => place.data.builtById === cultivator.id)!;
        expect(site).toBeDefined();
        expect(game.state().cultivator.alive).toBe(true);
        expect(holdsACopyOf(db, cultivator.id, 'lesser-qi-gathering-manual')).toBe(false);
        expect(game.atHand!.objects.find(object => object.id === blade.id)?.locationId).toBe(site.id);
        expect(game.atHand!.objects.find(object => object.id === borrowed.id)?.ownerId).toBe(owner.id);
        await game.act(`I travel to ${site.name}`);
        repos.cultivators.update(cultivator.id, { realmOrdinal: 21 });
        const blocked = await game.act('I enter the ruins');
        expect(blocked.narration).toContain('nobody above');
        repos.cultivators.update(cultivator.id, { realmOrdinal: 17 });
        await game.act('I enter the ruins');
        await game.act('I take the contents');
        expect(holdsACopyOf(db, cultivator.id, 'lesser-qi-gathering-manual')).toBe(true);
    }, 120_000);
});
