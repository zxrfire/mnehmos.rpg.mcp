/**
 * A house's clay cauldrons sit where the house makes medicine.
 *
 * The design owner: every house makes pills and a few focus on them. Only a house
 * focused on medicine has a furnace floor - the Cinnabar Crucible Sect - and the
 * cupboard of clay cauldrons a house keeps was put on the furnace floor, so in
 * every other house it fell back to the seat. It now sits on the Crucible's
 * furnace floor and in the alchemy hall everywhere else, which every compound
 * has.
 *
 * Red-checked: dropping the alchemy-hall fallback from the treasury's room choice
 * puts every other house's cauldrons back at its seat.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog, type WorldCatalog } from '../../../src/engine/world/catalog.js';
import { purposeOf } from '../../../src/engine/world/architecture.js';

let catalog: WorldCatalog;
beforeAll(async () => { catalog = await loadCultivationCatalog(); });

describe('a house\'s clay cauldrons', () => {
    it('sit on the medicine house\'s furnace floor, and in the alchemy hall of every other house', () => {
        const { state } = seedWorld({ seed: 'cauldrons-in-their-room', catalog });
        const byId = new Map(state.locations.map(row => [row.id, row]));
        const lots = state.objects.filter(row => row.id.startsWith('cauldrons-plain-'));
        expect(lots.length, 'no house keeps clay cauldrons in this world').toBeGreaterThan(1);

        for (const lot of lots) {
            const where = lot.locationId === null ? undefined : byId.get(lot.locationId);
            const purpose = where ? purposeOf(where) : null;
            if (lot.ownerId === 'sect-cinnabar-crucible-sect') {
                expect(purpose, lot.id).toBe('furnace_room');
            } else {
                expect(purpose, `${lot.id} sits at ${where?.name ?? 'nowhere'}`).toBe('alchemy_hall');
            }
        }
    }, 120_000);
});
