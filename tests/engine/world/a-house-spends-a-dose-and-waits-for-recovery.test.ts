/**
 * Structural medicine previously repaired players instantly and never reached
 * NPC house care. These arranged stocks and wounds go through the live driver:
 * an elder's child spends a real dose, carries the break for nine days, and
 * can lose the repair to a confrontation before it finishes. Recovery survives
 * a SQLite restart and does not create cultivation progress.
 * Red-checked by removing completion of NPC structural recovery.
 */
import { describe, expect, it } from 'vitest';
import { fixtureCatalog } from './fixtures';
import { seedWorld } from '../../../src/engine/world/seeding';
import { advanceWorldForPlay } from '../../../src/engine/world/driver';
import { createNpc, carryingWounds } from '../../../src/engine/world/npc-state';
import { createInjury } from '../../../src/engine/cultivation/injuries';
import { forStream } from '../../../src/engine/cultivation/rng';
import { brokenStatusOf } from '../../../src/engine/cultivation/what-goes-wrong-at-a-realm-boundary';
import { repairStockKey } from '../../../src/engine/world/who-holds-the-structural-repair-medicine';
import { getStructuralRepairMedicine } from '../../../src/data/cultivation/structural-repair-medicine';
import { whatTheConfrontationDidToThem } from '../../../src/engine/world/what-a-confrontation-does-to-somebody-the-world-holds';
import { WorldStateRepository } from '../../../src/storage/repos/world-state.repo';
import { makeDb } from '../../web/harness';
import { getSect } from '../../../src/data/cultivation/sects';
import { elderRungOf } from '../../../src/engine/cultivation/leadership';

const medicine = getStructuralRepairMedicine('repair-second-pour')!;
function beforeCare() {
    const state = seedWorld({ seed: 'structural-care', catalog: fixtureCatalog(),
        presentYear: 1000, population: 0 }).state;
    state.currentDay += 178;
    const house = state.factions[0]!;
    house.id = 'sect-cinnabar-crucible-sect';
    house.resources[repairStockKey(medicine.id)] = 1;
    state.factions = [house];
    state.schedule = [];
    state.populationTarget = 0;
    state.locations.forEach(place => { place.cycle = null; place.controllingFactionId = null; });
    const person = createNpc(state.seed, { id: 'broken-chosen', name: 'Lin Yu',
        bornOnDay: state.currentDay - 30 * 365, onDay: state.currentDay,
        factionId: house.id, locationId: house.seatLocationId,
        cultivation: { realmOrdinal: medicine.pricedAtOrdinal } });
    state.npcs = [carryingWounds(person, [createInjury({ severity: 'crippling',
        source: 'failed_breakthrough', turn: 0, woundType: 'broken-foundation' },
        forStream(state.seed, 'arranged-break'))], state.currentDay)];
    const senior = createNpc(state.seed, { id: 'elder-parent', name: 'Lin Qing',
        bornOnDay: state.currentDay - 100 * 365, onDay: state.currentDay,
        factionId: house.id, factionRankIndex: elderRungOf(getSect(house.id)!.ranks.length),
        locationId: house.seatLocationId, cultivation: { realmOrdinal: 21 } });
    senior.relationships.push({ targetId: person.id, targetName: person.name,
        kind: 'child', standing: 0.8, note: 'Their child.', sinceDay: person.identity.bornOnDay,
        lastChangedDay: state.currentDay, factIds: [], inheritedFromId: null });
    state.npcs.push(senior);
    return state;
}
const move = (state: ReturnType<typeof beforeCare>, days: number) =>
    advanceWorldForPlay(state, { days, pressure: { intensity: 0 } });

describe('the house waits for its medicine to work', () => {
    it('spends its stock and closes the break only when the recovery days have passed', () => {
        const state = beforeCare();
        move(state, 1);
        expect(state.factions[0]!.resources[repairStockKey(medicine.id)] ?? 0).toBe(0);
        expect(state.npcs[0]!.activity?.kind).toBe('mending');
        expect(brokenStatusOf(state.npcs[0]!.cultivation.injuries)).toBe('broken-foundation');
        const ordinal = state.npcs[0]!.cultivation.realmOrdinal;
        const db = makeDb();
        const repo = new WorldStateRepository(db);
        repo.saveWorld(state);
        const resumed = repo.loadWorld(state.id)!;
        move(resumed, medicine.recoveryDays - 1);
        expect(brokenStatusOf(resumed.npcs[0]!.cultivation.injuries)).toBe('broken-foundation');
        move(resumed, 1);
        expect(brokenStatusOf(resumed.npcs[0]!.cultivation.injuries)).toBeNull();
        expect(resumed.npcs[0]!.activity).toBeNull();
        expect(resumed.npcs[0]!.cultivation.realmOrdinal).toBe(ordinal);
        db.close();
    });

    it('loses the repair when somebody fights them during recovery, even without a new wound', () => {
        const state = beforeCare();
        move(state, 1);
        whatTheConfrontationDidToThem(state, { npcId: state.npcs[0]!.id,
            byId: 'somebody', byName: 'Shen Yu', day: state.currentDay,
            wounds: [], outcome: 'withdrawal', lost: true, finished: false });
        move(state, medicine.recoveryDays);
        expect(brokenStatusOf(state.npcs[0]!.cultivation.injuries)).toBe('broken-foundation');
        expect(state.factions[0]!.resources[repairStockKey(medicine.id)] ?? 0).toBe(0);
    });
});
