/**
 * A pinned world and an actual open practice, for tests of care rather than availability.
 * The played clock comes from run.elapsedDays; changing only world.currentHour
 * made the initial provider check run at the opening hour and correctly refuse care.
 * Area presence is written through standIn; update does not persist that flag.
 */
import { expect } from 'vitest';
import { makeGameInWorld, type HarnessOptions } from './harness.js';
import { isAMortalPhysician, physicianIsWorking } from '../../src/engine/world/who-is-actually-seeing-to-wounds.js';
import { npcsWhereTheyStand, theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';

export async function atAWorkingPhysician(seed: string, narrator: Pick<HarnessOptions, 'provider' | 'narrator'> = {}) {
    const h = await makeGameInWorld({ ...narrator, seed, worldSeed: 'actual-clinical-care' });
    const { run, cultivator } = await h.game.newRun('Patient');
    const world = (await h.game.loadWorld())!;
    const physician = world.npcs.find(n => n.status === 'alive' && isAMortalPhysician(n))!;
    expect(physician, 'the occupation catalog must produce an actual mortal physician').toBeDefined();
    const place = world.locations.find(l => l.id === physician.locationId)!;
    const hour = Array.from({ length: 24 }, (_, i) => i).find(hour => {
        world.currentHour = hour;
        return physicianIsWorking(world, physician);
    });
    expect(hour, 'the physician must work during some part of their ordinary day').toBeDefined();
    world.currentHour = hour!;
    const area = theAreasOf(world, place).whereIs.get(physician.id)!;
    expect(area, 'the working physician must have a real area').toBeDefined();
    h.repos.cultivators.update(cultivator.id, { location: place.name });
    h.repos.cultivators.standIn(cultivator.id, area);
    h.game.atHand = world;
    h.game.theWorldMoved();
    h.db.prepare('UPDATE runs SET elapsed_days = ? WHERE id = ?').run(Math.floor(run.elapsedDays) + hour! / 24, run.id);
    const playedWorld = (await h.game.loadWorld())!;
    expect(physicianIsWorking(playedWorld, physician), `provider ${physician.id} at played hour ${playedWorld.currentHour}`).toBe(true);
    const patient = h.repos.cultivators.getById(cultivator.id)!;
    expect(patient.standingIn).toBe(area);
    expect(npcsWhereTheyStand(playedWorld, place, patient.standingIn, { id: cultivator.id })
        .some(n => n.id === physician.id), `provider ${physician.id} beside patient in ${area}`).toBe(true);
    return { ...h, cultivator, world, physician, place, area };
}
