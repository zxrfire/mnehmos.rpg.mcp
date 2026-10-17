/** A body/calendar scenario needs a running world, without unrelated house politics.
 * Ordinary ground, roads and public residents are seeded by the engine.
 * This catalog has no houses, claimed veins or controlled settlements; a
 * retained vein would require an actual house able to grant it. Qi densities
 * and the player's whole requested span retain their ordinary authorities. */
import { makeGame } from '../web/harness.js';
import { loadCultivationCatalog } from '../../src/engine/world/catalog.js';
import { seedWorld } from '../../src/engine/world/seeding.js';
import { WorldStateRepository } from '../../src/storage/repos/world-state.repo.js';
import { resetCultivationWorlds } from '../../src/server/state/cultivation-world.js';

export async function makeQuietGameInWorld(options: { seed: string; worldSeed: string; adminMode?: boolean }) {
    const h = makeGame({ seed: options.seed, worldEnabled: true, adminMode: options.adminMode ?? false });
    const catalog = await loadCultivationCatalog();
    const { state } = seedWorld({ seed: options.worldSeed, presentYear: 1000,
        population: 0, catalog: { ...catalog, factions: [],
            regions: catalog.regions.map(region => ({ ...region, factionIds: [], veinStatus: '',
                places: region.places.map(place => ({ ...place, heldByFactionId: null })) })) } });
    new WorldStateRepository(h.db).saveWorld(state);
    resetCultivationWorlds();
    return h;
}
