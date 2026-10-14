/**
 * A house's clay cauldrons sit where the house makes medicine.
 *
 * The original defect put cauldrons at the seat when no cauldron room existed.
 * The owner's Oct10 ruling overturned universal institutional crafts: supported
 * houses keep an alchemy hall and a cauldron room, and other houses buy medicine.
 * A real cauldron room is preferred; an alchemy hall is the physical fallback.
 * A house without alchemy support receives no institutional cauldron cupboard.
 * It also receives no house-made ordinary pill stock through the separate
 * treasury-object seeder. Its factor must buy the doses before it owns them.
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
    it('does not give a nonmaking house a free ordinary medicine cupboard', () => {
        const { state } = seedWorld({ seed: 'house-medicine-has-an-actual-source', catalog });
        const makers = new Set(state.locations.filter(room => purposeOf(room) === 'alchemy_hall')
            .map(room => room.data.factionId));
        const nonmakers = state.factions.filter(house => house.dissolvedOnDay === null && !makers.has(house.id));
        expect(nonmakers.length).toBeGreaterThan(0);
        const cupboards = state.objects.filter(row => row.tags.includes('pill')
            && row.possessorId === null && Number(row.data.quantity ?? 0) > 0);
        for (const house of nonmakers) {
            expect(cupboards.filter(row => row.ownerId === house.id), house.name).toEqual([]);
        }
        expect(cupboards.some(row => row.ownerId !== null && makers.has(row.ownerId))).toBe(true);
    }, 120_000);

    it('sit where each supported house makes medicine, with no cupboard at a nonmaker', () => {
        const { state } = seedWorld({ seed: 'cauldrons-in-their-room', catalog });
        const byId = new Map(state.locations.map(row => [row.id, row]));
        const lots = state.objects.filter(row => row.id.startsWith('cauldrons-plain-'));
        expect(lots.length, 'no house keeps clay cauldrons in this world').toBeGreaterThan(1);

        for (const lot of lots) {
            const where = lot.locationId === null ? undefined : byId.get(lot.locationId);
            const purpose = where ? purposeOf(where) : null;
            const ownsCauldronRoom = state.locations.some(room => room.data.factionId === lot.ownerId
                && purposeOf(room) === 'furnace_room');
            expect(purpose, `${lot.id} sits at ${where?.name ?? 'nowhere'}`)
                .toBe(ownsCauldronRoom ? 'furnace_room' : 'alchemy_hall');
        }
        for (const house of state.factions) {
            const supportsAlchemy = state.locations.some(room => room.data.factionId === house.id
                && purposeOf(room) === 'alchemy_hall');
            if (!supportsAlchemy) expect(lots.some(lot => lot.ownerId === house.id), house.name).toBe(false);
        }
    }, 120_000);
});
