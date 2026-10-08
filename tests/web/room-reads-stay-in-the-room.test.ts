/**
 * Observed in model probe lived-rooms-20261003-04: the infirmary and private
 * quarters were handed fourteen local board tasks, while inspecting the
 * servants' quarters resolved the embedded rank title instead of stored goods.
 * The narrator then invented an infirmary noticeboard and empty valuables.
 * A real mission hall keeps its board; other rooms cannot inherit it from
 * membership. A lodging inspection reads only actual visible belongings in
 * the occupied area, without moving, taking, or spending time. Rank questions
 * remain rank questions. World and run seeds are pinned together.
 * Paired red check: disabling only the non-board compound-room gate on this
 * fixture exposed twelve duties in the infirmary instead of zero. The current
 * arm passed, and the source was restored byte for byte.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { whereCompoundsAre } from '../../src/engine/world/where-inside-a-house-somebody-is-standing';
import { theLodgingsOfAHouse, whichRoomARungGets, whereAHouseLetsYouKeepThings } from '../../src/engine/world/the-room-a-house-gives-you';
import { aRoomOfTheirOwn } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { makeObject } from '../../src/engine/world/possessions';
import { standInTheWorld } from '../../src/web/the-player-as-a-row-the-world-can-invite';

describe('room observations stay local', () => {
    it('the hall board stays in the hall and inspecting quarters shows only their own stored belongings', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'local-room-read', worldSeed: 'road-world' });
        await game.newRun('Room reader');
        const world = (await game.loadWorld())!;
        const compound = [...whereCompoundsAre(world).bySeat.values()].find(c =>
            c.rooms.has('mission_hall') && c.rooms.has('infirmary') && c.rooms.has('dormitory'))!;
        const id = game.state().cultivator.id;
        repos.sects.addMember(compound.houseId, id, 0);
        const run = game.currentRun().run;
        for (const [purpose, hasBoard] of [['mission_hall', true], ['infirmary', false]] as const) {
            repos.cultivators.update(id, { location: compound.rooms.get(purpose)!.name });
            repos.cultivators.standIn(id, null);
            const me = repos.cultivators.getById(id)!;
            const read = game.whatIsLiveHere(me, game.ambientFor(me, run), run);
            if (hasBoard) expect(read.dutiesGoing).toBeGreaterThan(0);
            else expect(read.dutiesGoing).toBe(0);
        }
        const lodging = whichRoomARungGets(theLodgingsOfAHouse(world, compound.houseId), 0)!;
        const building = world.locations.find(p => p.id === lodging.locationId)!;
        repos.cultivators.update(id, { location: building.name });
        repos.cultivators.standIn(id, aRoomOfTheirOwn(building, id).id);
        standInTheWorld(world, repos.cultivators.getById(id)!, { factionId: compound.houseId, rankIndex: 0 }, world.currentDay);
        world.objects.push(makeObject({ id: 'room-read-own-stock', name: 'the folded test blanket', kind: 'other',
            ownerId: id, possessorId: whereAHouseLetsYouKeepThings(compound.houseId, id), locationId: compound.seat.id }));
        const other = world.npcs.find(n => n.status === 'alive' && n.factionId === compound.houseId)!;
        world.objects.push(makeObject({ id: 'room-read-neighbour-stock', name: 'the neighbouring test pouch', kind: 'other',
            ownerId: other.id, possessorId: whereAHouseLetsYouKeepThings(compound.houseId, other.id), locationId: compound.seat.id }));
        const me = repos.cultivators.getById(id)!;
        expect(game.whatIsLiveHere(me, game.ambientFor(me, run), run).dutiesGoing).toBe(0);
        const before = JSON.stringify(world.objects);
        for (const query of [building.name.split(':').at(-1)!.trim(), 'what is stored here']) {
            const read = game.investigate(run, me, game.ambientFor(me, run), query);
            expect(read.facts.lines.join(' ')).toContain('the folded test blanket');
            expect(read.facts.lines.join(' ')).not.toContain('the neighbouring test pouch');
            expect(read.timeDisposition).toBe('free_read');
            expect(read.facts.lines.join(' ')).not.toContain('holds the rank');
        }
        expect(JSON.stringify(world.objects)).toBe(before);
        expect(repos.cultivators.getById(id)!.standingIn).toBe(me.standingIn);
        const rank = repos.sects.getById(compound.houseId)!.ranks[0]!;
        const rankRead = game.investigate(run, me, game.ambientFor(me, run), rank);
        expect(rankRead.facts.lines.join(' ')).toContain(rank);
        expect(rankRead.facts.lines.join(' ')).not.toContain('the folded test blanket');
        const days = game.state().run.elapsedDays;
        const looked = await game.act('I inspect what is stored here.');
        expect(looked.narration).toContain('the folded test blanket');
        expect(looked.narration).not.toContain('the neighbouring test pouch');
        expect(game.state().run.elapsedDays).toBe(days);
    }, 180_000);
});
