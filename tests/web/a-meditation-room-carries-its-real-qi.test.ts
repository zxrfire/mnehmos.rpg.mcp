/**
 * Lived-room audit, 2026-10-03: a cultivation room must affect the cultivation
 * ground, not only provide a destination name. Architecture already cuts its
 * real density, and the walk already changes the physical LocationRecord.
 * This controls one world/body/clock against those existing sources. Weather
 * is sampled per place, so no claim requires each realized room band or yield
 * to beat the yard on every turn. A seal belongs to the person and still limits
 * what they draw after reaching richer ground. No room bonus is fabricated.
 * The original rank-zero fixture was unplaced under the earlier discovery
 * prerequisite. The owner's later player/character ruling removes that
 * prerequisite for explicit ordinary facility requests; its replay behavior is
 * covered next door. This density fixture retains native placed/reachable
 * standing to isolate the actual ground calculation rather than discovery.
 * Root review corrected MAX_ORDINAL to False Immortal: a True Immortal is beyond
 * the Lid and cannot be the physical operator of this mortal-world room.
 */
import { it, expect } from 'vitest';
import { makeGameInWorld } from './harness';
import { whereCompoundsAre } from '../../src/engine/world/where-inside-a-house-somebody-is-standing';
import { aWalkInsideTheWalls } from '../../src/web/walking-inside-the-walls';
import { ambientForBlock } from '../../src/engine/cultivation/ambient';
import { whatThisPersonCanDrawFrom } from '../../src/engine/cultivation/a-qi-seal-is-put-on-a-person';
import { FALSE_IMMORTAL_ORDINAL } from '../../src/engine/cultivation/realms';
import { pathTo, roomStageFor, reachThrough } from '../../src/engine/world/architecture';
import { isAtLeast } from '../../src/engine/social/discovery';
import { howThisCultivatorStandsInTheHouseHolding } from '../../src/web/how-this-cultivator-stands-on-this-ground';

it("an actual meditation-room walk uses its generated density and retains the same person's seal", async () => {
    const h = await makeGameInWorld({ seed: 'meditation-ground', worldSeed: 'road-world' });
    const { cultivator } = await h.game.newRun('Sitter');
    const world = h.game.atHand!;
    const qualified = [...whereCompoundsAre(world).bySeat.values()].flatMap(compound => {
        const room = compound.rooms.get('meditation_cell');
        const house = h.repos.sects.getById(compound.houseId);
        if (!room || !house || room.sealed || room.environment.spiritualDensity <= compound.seat.environment.spiritualDensity) return [];
        const rankIndex = house.ranks.findIndex((_, rankIndex) => {
            const standing = howThisCultivatorStandsInTheHouseHolding({ ground: room,
                cultivator: { ...cultivator, realmOrdinal: FALSE_IMMORTAL_ORDINAL }, objects: world.objects,
                standing: { sectId: house.id, rankIndex, rankCount: house.ranks.length, joinedOnDay: world.currentDay },
                onDay: Math.floor(world.currentDay) });
            const reach = reachThrough(pathTo(world.locations, room.id), standing.access, { enteredAt: compound.seat.id });
            return isAtLeast(roomStageFor(room, standing.viewer), 'placed') && reach.stoppedAt === null && reach.level !== 'barred';
        });
        return rankIndex < 0 ? [] : [{ compound, room, rankIndex }];
    })[0];
    expect(qualified, 'an actual richer room placed and reachable for its arranged standing').toBeDefined();
    const { compound, room, rankIndex } = qualified!;
    h.repos.sects.addMember(compound.houseId, cultivator.id, rankIndex);
    h.repos.cultivators.update(cultivator.id, { location: compound.seat.name, realmOrdinal: FALSE_IMMORTAL_ORDINAL });
    // Refresh the arranged operator through the actual free turn boundary;
    // a direct handler must not inherit the birth projection's village ground.
    const clockBeforeLook = h.game.currentRun().run.elapsedDays;
    await h.game.act('I look around');
    expect(h.game.currentRun().run.elapsedDays).toBe(clockBeforeLook);
    const me = h.repos.cultivators.getById(cultivator.id)!;
    const before = h.game.groundFor(me)!.density;
    const walked = await aWalkInsideTheWalls(h.game, h.game.currentRun().run, me, 'cultivation rooms');
    expect(walked).not.toBeNull();
    expect(walked?.outcome, walked?.facts.prose).toBe('executed');
    const now = h.repos.cultivators.getById(me.id)!;
    const fixedRun = h.repos.runs.getById(h.game.currentRun().run.id)!;
    expect(now.location).toBe(room.name);
    expect(h.game.groundFor(now)!.density).toBe(room.environment.spiritualDensity);
    expect(h.game.groundFor(now)!.density).toBeGreaterThan(before);
    for (const ground of [compound.seat, room]) {
        const standing = { ...now, location: ground.name };
        expect(h.game.ambientFor(standing, fixedRun)).toBe(ambientForBlock(fixedRun.seed, ground.name,
            Math.floor(fixedRun.elapsedDays), { density: ground.environment.spiritualDensity }));
    }
    const seal = { sinceDay: Math.floor(world.currentDay), liftsOnDay: null, byId: null, note: 'Existing personal seal fixture' };
    h.repos.cultivators.update(now.id, { qiSeal: seal });
    const sealed = h.repos.cultivators.getById(now.id)!;
    expect(sealed.qiSeal).toEqual(seal);
    const expected = whatThisPersonCanDrawFrom({ density: room.environment.spiritualDensity,
        seal, onDay: Math.floor(h.game.atHand!.currentDay) });
    expect(h.game.groundFor(sealed)!.density).toBe(expected);
    expect(expected).toBeLessThan(room.environment.spiritualDensity);
});
