/** NPCs spend the same medicine and live through its recovery before a break closes. */
import { getStructuralRepairMedicine } from '../../data/cultivation/structural-repair-medicine.js';
import { brokenStatusOf } from '../cultivation/what-goes-wrong-at-a-realm-boundary.js';
import { applyStructuralRepair } from '../cultivation/what-structural-repair-medicine-can-reach.js';
import { willTheHouseSpendOnThem } from '../cultivation/who-a-house-will-spend-a-repair-dose-on.js';
import { untreatedInjuryCount } from '../cultivation/injuries.js';
import { isTheWorldsToMove } from './npc-state.js';
import { doseAHouseWouldUse, spendRepairDose, whoTheyAreToTheHouse } from './who-holds-the-structural-repair-medicine.js';
import type { WorldState } from './world-state.js';

export function beginStructuralRepairs(state: WorldState, day: number): number {
    let begun = 0;
    for (let at = 0; at < state.npcs.length; at++) {
        const npc = state.npcs[at]!;
        if (npc.status !== 'alive' || !isTheWorldsToMove(npc) || !npc.factionId) continue;
        if (npc.activity?.untilDay != null && npc.activity.untilDay > day) continue;
        const woundKey = brokenStatusOf(npc.cultivation.injuries);
        if (!woundKey) continue;
        const house = state.factions.find(f => f.id === npc.factionId && f.dissolvedOnDay === null);
        if (!house || npc.locationId !== house.seatLocationId) continue;
        const toThem = whoTheyAreToTheHouse(state, house.id,
            { id: npc.id, realmOrdinal: npc.cultivation.realmOrdinal }, day);
        const decision = willTheHouseSpendOnThem({
            id: npc.id, realmOrdinal: npc.cultivation.realmOrdinal, woundKey,
            houseId: house.id, onTheHouseRoll: true,
            kinOfSomebodyWhoMatters: toThem.kin, chosenOfTheHouse: toThem.chosen,
            yearsTheHouseHasSpent: toThem.years
        });
        if (!decision.meetsTheStandard) continue;
        const choice = doseAHouseWouldUse(state, house.id, woundKey, npc.cultivation.realmOrdinal);
        if (!choice || !spendRepairDose(state, house.id, npc.id, npc.name,
            woundKey, npc.cultivation.realmOrdinal, day)) continue;
        state.npcs[at] = { ...npc, activity: {
            kind: 'mending', thingId: choice.medicine.id,
            note: `Recovering from ${choice.medicine.name}.`, withIds: [],
            sinceDay: day, untilDay: day + choice.medicine.recoveryDays
        } };
        begun++;
    }
    return begun;
}

/** A death or an activity that displaced recovery leaves the spent dose ineffective. */
export function finishStructuralRecoveries(state: WorldState, day: number): void {
    for (let at = 0; at < state.npcs.length; at++) {
        const npc = state.npcs[at]!;
        const doing = npc.activity;
        if (npc.status !== 'alive' || doing?.kind !== 'mending' || doing.untilDay == null
            || doing.untilDay > day || !doing.thingId) continue;
        const medicine = getStructuralRepairMedicine(doing.thingId);
        const wound = brokenStatusOf(npc.cultivation.injuries);
        if (!medicine || !wound) continue;
        const injuries = applyStructuralRepair(npc.cultivation.injuries, medicine, wound, npc.cultivation.realmOrdinal);
        state.npcs[at] = { ...npc, activity: null, updatedOnDay: doing.untilDay,
            cultivation: { ...npc.cultivation, injuries,
                untreatedInjuries: untreatedInjuryCount(injuries),
                accumulatingSinceDay: npc.cultivation.accumulatingSinceDay + medicine.recoveryDays,
                lastAdvancedOnDay: npc.cultivation.lastAdvancedOnDay + medicine.recoveryDays
            } };
    }
}
