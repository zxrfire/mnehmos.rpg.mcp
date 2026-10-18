/** The played sheet owns membership and accounts; the world owns the property. */
import type { Cultivator, Run } from '../../schema/cultivation.js';
import { settleLeavingHouse } from '../../engine/world/leaving-a-house.js';
import { ledgerAbout, writeOneObligation } from '../../storage/repos/obligation.repo.js';
import { worldForRun, writeTheWorldNow } from '../state/cultivation-world.js';
import { ensureCultivationDb } from './cultivation-support.js';
import { offTheRoll } from '../../engine/world/what-becomes-of-a-houses-people-when-it-is-gone.js';
import { isCatalogPerson, worldIdForCatalogPerson } from '../../engine/world/a-catalog-person-and-their-world-row.js';

export async function settlePlayedHouseDeparture(run: Run, person: Cultivator, houseId: string) {
    const repos = ensureCultivationDb();
    const world = await worldForRun(run);
    const result = settleLeavingHouse(world, { ...person,
        atLocationId: world.locations.find(place => place.name === person.location)?.id ?? null
    }, houseId, world.currentDay, {
        rows: ledgerAbout(repos.db, person.id),
        put: row => { writeOneObligation(repos.db, row); }
    });
    writeTheWorldNow(world);
    return result;
}

/** Legacy house counts name some real people; only those actual rows can leave a roll. */
export async function settleNamedHouseDepartures(run: Run, houseId: string, ids: readonly string[], tag: string): Promise<void> {
    if (ids.length === 0) return;
    const world = await worldForRun(run);
    for (const id of ids) {
        const actualId = isCatalogPerson(id) ? worldIdForCatalogPerson(id) : id;
        const at = world.npcs.findIndex(person => person.id === actualId && person.factionId === houseId);
        if (at >= 0) world.npcs[at] = offTheRoll(world, world.npcs[at]!, world.currentDay, `${tag}${houseId}`);
    }
    writeTheWorldNow(world);
}
