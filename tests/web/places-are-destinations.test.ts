/**
 * Owner ruling, 2026-10-03: a sect needs its mission hall, your assigned quarters,
 * training grounds and an exit into town; a city needs its auction house, inn and
 * ordinary xianxia destinations. Existing elder offices and craft rooms are reused.
 * Places must fit the other rulings: known is not permitted, private quarters are
 * isolated, company is actual same-area company, and local walks spend a quarter day.
 *
 * Defects: empty destinations disappeared from the scene; 'my room' at the sect
 * seat made a second home unrelated to rank-assigned lodging; night arrivals could
 * land in the first sleeping resident's private room; training grounds had no route.
 * A live boarding profile later spent 6.97 seconds of a 12-second CPU window
 * surveying room stock for architectural affordances that consumed only visible
 * building and enclosure counts. Those counts must agree with an actual look;
 * the look still sees finite stock and respects every private-room boundary.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { theAreasOf, aRoomOfTheirOwn, whereInThisPlaceTheyStand } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { whereCompoundsAre } from '../../src/engine/world/where-inside-a-house-somebody-is-standing';
import { theLodgingsOfAHouse, whichRoomARungGets } from '../../src/engine/world/the-room-a-house-gives-you';
import { aWalkAcrossThePlace, crossToWhoeverTheyNamed, theRestOfThisPlace } from '../../src/web/walking-across-a-place';
import { theDoorsOffThisYard } from '../../src/web/walking-inside-the-walls';
import { aWalkInsideTheWalls, aRoomsOwnName } from '../../src/web/walking-inside-the-walls';
import { walkIntoTheRoomTheWorkIsDoneIn } from '../../src/web/walking-inside-the-walls';
import { seedTownPhysicians, givePhysiciansTheirOpeningWork, isAMortalPhysician } from '../../src/engine/world/who-is-actually-seeing-to-wounds';
import { routineOf } from '../../src/engine/world/npc-routines';
import { MAX_ORDINAL } from '../../src/engine/cultivation/realms';
import { SECTS } from '../../src/data/cultivation/sects';
import { theBuiltArchitectureUnder, theBuiltGroundUnder, theThingsVisibleInThisRoom } from '../../src/web/what-is-built-where-you-are-standing';
import { makeObject } from '../../src/engine/world/possessions';
import { whereAHouseLetsYouKeepThings } from '../../src/engine/world/the-room-a-house-gives-you';

async function insideAHouse(seed: string) {
    const h = await makeGameInWorld({ seed, worldSeed: 'road-world' });
    await h.game.newRun('Walker');
    const world = (await h.game.loadWorld())!;
    const compound = [...whereCompoundsAre(world).bySeat.values()].find(c =>
        c.rooms.has('mission_hall') && c.rooms.has('practice_yard') && c.rooms.has('dormitory'))!;
    const me = h.game.state().cultivator;
    h.repos.sects.addMember(compound.houseId, me.id, 0);
    h.repos.cultivators.update(me.id, { location: compound.seat.name });
    const forecourt = theAreasOf(world, compound.seat).areas.find(a => a.for === 'forecourt')!;
    h.repos.cultivators.standIn(me.id, forecourt.id);
    return { ...h, world, compound, me: h.repos.cultivators.getById(me.id)! };
}

describe('places are destinations', () => {
    it('a house without a medical speciality still gives its newest member a reachable infirmary', async () => {
        const { game, repos, world, me } = await insideAHouse('places-ordinary-care');
        const compound = [...whereCompoundsAre(world).bySeat.values()].find(c => {
            const house = SECTS.find(h => h.id === c.houseId);
            return house?.recruits && !house.specialities.some(s => ['support', 'defense'].includes(s.toLowerCase()));
        })!;
        expect(compound).toBeDefined();
        expect(compound.rooms.get('infirmary')).toBeDefined();
        repos.sects.removeMember(repos.sects.getMembership(me.id)!.sectId, me.id);
        repos.sects.addMember(compound.houseId, me.id, 0);
        repos.cultivators.update(me.id, { location: compound.seat.name });
        const before = repos.cultivators.getById(me.id)!;
        expect(theDoorsOffThisYard(game, before)).toContain(aRoomsOwnName(compound.rooms.get('infirmary')!));
        const walked = await aWalkInsideTheWalls(game, game.currentRun().run, before, 'infirmary');
        expect(walked?.outcome).toBe('executed');
        expect(repos.cultivators.getById(me.id)!.location).toBe(compound.rooms.get('infirmary')!.name);
    }, 180_000);

    it('medical, pill and cultivation destinations reuse real rooms and the treasury still needs its key', async () => {
        const { game, repos, world, me } = await insideAHouse('places-working-rooms');
        const compound = [...whereCompoundsAre(world).bySeat.values()].find(c =>
            (['infirmary', 'alchemy_hall', 'meditation_cell', 'treasury'] as const).every(p => c.rooms.has(p)))!;
        expect(compound).toBeDefined();
        const house = repos.sects.getById(compound.houseId)!;
        repos.sects.removeMember(repos.sects.getMembership(me.id)!.sectId, me.id);
        repos.sects.addMember(compound.houseId, me.id, house.ranks.length - 1);
        repos.cultivators.update(me.id, { location: compound.seat.name, realmOrdinal: MAX_ORDINAL });
        for (const [spoken, purpose] of [
            ['infirmary', 'infirmary'], ['pill refining room', 'alchemy_hall'], ['cultivation rooms', 'meditation_cell']
        ] as const) {
            const before = repos.cultivators.getById(me.id)!;
            const room = compound.rooms.get(purpose)!;
            expect(theDoorsOffThisYard(game, before)).toContain(aRoomsOwnName(room));
            const walked = await aWalkInsideTheWalls(game, game.currentRun().run, before, spoken);
            expect(walked?.outcome, spoken).toBe('executed');
            expect(repos.cultivators.getById(me.id)!.location).toBe(room.name);
        }
        const before = repos.cultivators.getById(me.id)!;
        const atBench = game.state().run.elapsedDays;
        const approached = await walkIntoTheRoomTheWorkIsDoneIn(game, game.currentRun().run, before, 'an_artifact');
        expect(approached?.outcome).toBe('executed');
        expect(game.state().run.elapsedDays - atBench).toBeCloseTo(0.25);
        expect(await walkIntoTheRoomTheWorkIsDoneIn(game, game.currentRun().run,
            repos.cultivators.getById(me.id)!, 'an_artifact')).toBeNull();
        const atTreasury = repos.cultivators.getById(me.id)!;
        const days = game.state().run.elapsedDays;
        const treasury = await aWalkInsideTheWalls(game, game.currentRun().run, atTreasury, 'treasury');
        expect(treasury?.outcome).toBe('refused');
        expect(repos.cultivators.getById(me.id)!.location).toBe(atTreasury.location);
        expect(game.state().run.elapsedDays).toBe(days);
    }, 180_000);

    it('a clinic remains a destination at night while its actual physician goes home', async () => {
        const { game, repos, world, me } = await insideAHouse('places-clinic');
        seedTownPhysicians(world, Math.floor(world.currentDay));
        givePhysiciansTheirOpeningWork(world, Math.floor(world.currentDay));
        world.currentHour = 22;
        const physician = world.npcs.find(n => isAMortalPhysician(n) && routineOf(world, n).home)!;
        expect(physician).toBeDefined();
        const town = world.locations.find(l => l.id === physician.locationId)!;
        repos.cultivators.update(me.id, { location: town.name });
        game.theWorldMoved();
        const visitor = repos.cultivators.getById(me.id)!;
        const clinic = theAreasOf(world, town).areas.find(a => a.for === 'clinic')!;
        expect(theRestOfThisPlace(game, visitor)).toContain(clinic.name);
        world.currentHour = 22;
        const night = theAreasOf(world, town);
        expect(night.areas.map(a => a.id)).toContain(clinic.id);
        const asleepAt = night.whereIs.get(physician.id);
        expect(night.areas.find(a => a.id === asleepAt)?.for).toBe('room');
        expect(asleepAt).not.toBe(clinic.id);
    }, 180_000);

    it('a junior reaches the existing mission office and training ground through their spoken names', async () => {
        const { game, repos, compound, me } = await insideAHouse('places-junior');
        const start = game.state().run.elapsedDays;
        expect(theDoorsOffThisYard(game, me)).toContain('your quarters');
        const missions = await game.act('I go to the missions hall');
        expect(missions.toolCalls.some(c => c.name === 'world.walkInsideTheWalls' && c.ok)).toBe(true);
        expect(repos.cultivators.getById(me.id)!.location).toBe(compound.rooms.get('mission_hall')!.name);
        const training = await game.act('I go to the training grounds');
        expect(training.toolCalls.some(c => c.name === 'world.walkInsideTheWalls' && c.ok)).toBe(true);
        expect(repos.cultivators.getById(me.id)!.location).toBe(compound.rooms.get('practice_yard')!.name);
        expect(game.state().run.elapsedDays - start).toBeCloseTo(0.5);
    }, 180_000);

    it('my quarters is the rank-assigned lodging, with a separate holder area, and leads out to town', async () => {
        const { game, repos, compound, me, world } = await insideAHouse('places-home');
        const assigned = whichRoomARungGets(theLodgingsOfAHouse(world, compound.houseId), 0)!;
        const done = await game.act('I go to my quarters');
        expect(done.toolCalls.some(c => c.name === 'world.walkInsideTheWalls' && c.ok)).toBe(true);
        const after = repos.cultivators.getById(me.id)!;
        const room = world.locations.find(l => l.id === assigned.locationId)!;
        expect(after.location).toBe(room.name);
        expect(after.standingIn).toBe(aRoomOfTheirOwn(room, me.id).id);
        expect(game.present(after)).toHaveLength(0);
        const town = world.locations.find(l => l.data.gateId === compound.seat.id)!;
        expect(theDoorsOffThisYard(game, after)).toContain(town.name);
        await game.act('I go to town');
        expect(repos.cultivators.getById(me.id)!.location).toBe(town.name);
    }, 180_000);

    it('every living member keeps an assigned private area while working elsewhere, with rank deciding the building', async () => {
        const { world, compound } = await insideAHouse('places-roll');
        const lodgings = theLodgingsOfAHouse(world, compound.houseId);
        const roll = world.npcs.filter(n => n.status === 'alive' && n.factionId === compound.houseId);
        expect(roll.length).toBeGreaterThan(1);
        for (const person of roll) {
            const assigned = whichRoomARungGets(lodgings, person.factionRankIndex)!;
            const building = world.locations.find(l => l.id === assigned.locationId)!;
            for (const currentHour of [8, 12, 22]) {
                expect(theAreasOf({ ...world, currentHour }, building).areas.map(a => a.id))
                    .toContain(aRoomOfTheirOwn(building, person.id).id);
            }
        }
    }, 180_000);

    it('a city offers empty public destinations and its auction house without moving the city venue', async () => {
        const { game, repos, world, me } = await insideAHouse('places-city');
        const city = world.locations.find(l => l.kind === 'settlement' && l.tags.includes('city'))!;
        world.npcs = world.npcs.filter(n => n.locationId !== city.id);
        game.theWorldMoved();
        repos.cultivators.update(me.id, { location: city.name });
        const visitor = repos.cultivators.getById(me.id)!;
        expect(theRestOfThisPlace(game, visitor)).toEqual(expect.arrayContaining(['the inn', 'the teahouse', 'the herb stalls', 'the auction house']));
        const start = game.state().run.elapsedDays;
        const walked = await aWalkAcrossThePlace(game, game.currentRun().run, visitor, 'auction house');
        expect(walked?.outcome).toBe('executed');
        const after = repos.cultivators.getById(me.id)!;
        expect(after.location).toBe(city.name);
        expect(after.standingIn).toBe(theAreasOf(game.atHand!, city).areas.find(a => a.name === 'the auction house')!.id);
        expect(game.state().run.elapsedDays - start).toBeCloseTo(0.25);
        expect(game.present(after)).toHaveLength(0);
    }, 180_000);

    it('the room look reads finite treasury and craft stock, while carried and neighbouring private belongings stay elsewhere', async () => {
        const { game, repos, world, compound, me } = await insideAHouse('places-stock');
        for (const purpose of ['treasury', 'alchemy_hall', 'artifact_refining_hall'] as const) {
            const room = compound.rooms.get(purpose)!;
            expect(room, purpose).toBeDefined();
            const actual = world.objects.filter(o => o.locationId === room.id && o.possessorId === null);
            expect(actual.length, `${purpose} must have actual seeded stock`).toBeGreaterThan(0);
            repos.cultivators.update(me.id, { location: room.name });
            const visitor = repos.cultivators.getById(me.id)!;
            const architecture = theBuiltArchitectureUnder(game, visitor)!;
            const look = theBuiltGroundUnder(game, visitor)!;
            expect(architecture).not.toBeNull();
            expect(look).not.toBeNull();
            expect(architecture.seen.length - architecture.named).toBe(look.reading.seen.length - look.reading.named);
            expect(architecture.enclosuresSeen - architecture.enclosuresOpen)
                .toBe(look.reading.enclosuresSeen - look.reading.enclosuresOpen);
            const read = theThingsVisibleInThisRoom(game, visitor).join(' ');
            const first = actual[0]!;
            expect(read).toContain(typeof first.data.resource === 'string' ? first.data.resource : first.name);
            expect(look.lines.join(' ')).toContain(typeof first.data.resource === 'string' ? first.data.resource : first.name);
            first.possessorId = world.npcs.find(n => n.status === 'alive' && n.id !== me.id)!.id;
            first.name = 'the carried test item';
            expect(theThingsVisibleInThisRoom(game, visitor).join(' ')).not.toContain(first.name);
        }
        const person = world.npcs.find(n => n.status === 'alive' && n.factionId === compound.houseId)!;
        const lodging = whichRoomARungGets(theLodgingsOfAHouse(world, compound.houseId), person.factionRankIndex)!;
        const building = world.locations.find(l => l.id === lodging.locationId)!;
        world.objects.push(makeObject({ id: 'places-private-item', name: 'the stored test item', kind: 'other',
            ownerId: person.id, possessorId: whereAHouseLetsYouKeepThings(compound.houseId, person.id), locationId: compound.seat.id }));
        repos.cultivators.update(me.id, { location: building.name });
        expect(theThingsVisibleInThisRoom(game, repos.cultivators.getById(me.id)!).join(' ')).not.toContain('the stored test item');
        repos.cultivators.standIn(me.id, aRoomOfTheirOwn(building, person.id).id);
        expect(theThingsVisibleInThisRoom(game, repos.cultivators.getById(me.id)!).join(' ')).toContain('the stored test item');
        repos.cultivators.standIn(me.id, aRoomOfTheirOwn(building, me.id).id);
        expect(theThingsVisibleInThisRoom(game, repos.cultivators.getById(me.id)!).join(' ')).not.toContain('the stored test item');
    }, 180_000);

    it('private sleeping doors are neither advertised nor an uninvited named-person shortcut', async () => {
        const { game, repos, world, me } = await insideAHouse('places-private');
        const town = world.locations.find(l => l.kind === 'settlement' && world.npcs.some(n => n.locationId === l.id))!;
        world.currentHour = 22;
        game.theWorldMoved();
        repos.cultivators.update(me.id, { location: town.name });
        const visitor = repos.cultivators.getById(me.id)!;
        const read = theAreasOf(world, town);
        const room = read.areas.find(a => a.for === 'room')!;
        const host = world.npcs.find(n => read.whereIs.get(n.id) === room.id)!;
        expect(room).toBeDefined();
        expect(read.areas[0]!.for).not.toBe('room');
        expect(whereInThisPlaceTheyStand(world, town, null, null).for).toBe('street');
        expect(theRestOfThisPlace(game, visitor)).not.toContain(room.name);
        const start = game.state().run.elapsedDays;
        expect((await aWalkAcrossThePlace(game, game.currentRun().run, visitor, room.name))?.outcome).toBe('refused');
        expect(crossToWhoeverTheyNamed(game, visitor, host.name)).toBeNull();
        expect(repos.cultivators.getById(me.id)!.standingIn).toBeNull();
        expect(game.state().run.elapsedDays).toBe(start);
    }, 180_000);
});
