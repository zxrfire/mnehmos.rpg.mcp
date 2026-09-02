/**
 * Where the repair medicine actually is, right now, in a world that has been
 * running.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS SEPARATELY FROM THE CATALOG
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `STRUCTURAL_REPAIR_HOLDINGS` in the catalog is a fact about the BEGINNING of
 * the world: what each house had when the world was made. That is not the
 * question anybody actually asks. The question is what a house is holding
 * today, after however many centuries of spending, gifting and losing, and a
 * hand-written catalog line can never answer it.
 *
 * So the holdings are LIVE STATE. Every dose is seeded into the world the world
 * already has for objects - `state.objects` for the tracked ones, `resources`
 * counts for the fungible ones - and every question here is answered by reading
 * that state rather than the catalog. Spend one and the count moves. Give one
 * away and the record follows it. Ask two hundred years later where a
 * particular dose went and the provenance chain says.
 *
 * THIS IS NOT A SECOND INVENTORY. It is the same `ObjectRecord` table the
 * artifacts, the manuals and the barter pills live in, read through a filter.
 * A parallel possessions store for one category of object is the exact mistake
 * `docs/world/things/items.md` warns about, and it would mean nothing downstream ever
 * noticed a dose moving, because nothing downstream reads a second table.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TRACKED OR COUNTED, ON THE LINE THAT ALREADY EXISTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `items.md`: a thing is cash-priced exactly where it is fungible and
 * barter-only exactly where it is singular, and the counted/tracked line should
 * be the SAME line. So {@link repairStorageModel} asks one question -
 * `repairCashPrice`, which is already the trade-tier answer - and takes both
 * consequences from it. There is no second threshold here to drift.
 *
 *   COUNT  mortal and earth grade. A house keeping two of the cheap one is
 *          keeping a number, not two stories. `significance: 'mundane'`, which
 *          `possessions.ts` documents as the marker for a thing that gets no
 *          provenance at all.
 *   ROW    heaven and immortal grade. A holder, a provenance chain, and a
 *          record that outlives the object being swallowed - because where a
 *          specific one went is exactly the sort of thing somebody should be
 *          able to find out two centuries later.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SEEDED FROM THE CATALOG, NOT SCATTERED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `seedPillStock` next door places barter pills on any house working near their
 * band, at 18% a house, which is right for medicine that a trade actually makes.
 * It is exactly wrong here. These are supposed to be almost nowhere, so there is
 * NO RANDOM PLACEMENT IN THIS MODULE AT ALL: the seeder reads the authored
 * holdings and puts down precisely those, on precisely those bodies. A house not
 * in that table holds none, forever, unless somebody gives it one during the
 * run.
 *
 * That is the first of the two scarcities. The second - that almost nobody
 * stands in a relationship where a dose would be spent on them - is
 * `engine/cultivation/who-a-house-will-spend-a-repair-dose-on.ts`, and both are
 * needed. Either one alone lets the medicine become ordinary.
 */

import type { WorldState } from './world-state.js';
import {
    makeObject,
    transferPossession,
    type ObjectRecord,
    type ObjectSignificance
} from './possessions.js';
import {
    STRUCTURAL_REPAIR_HOLDINGS,
    STRUCTURAL_REPAIR_MEDICINES,
    getStructuralRepairMedicine,
    type StructuralRepairMedicine
} from '../../data/cultivation/structural-repair-medicine.js';
import {
    repairCashPrice,
    repairWeightInStones,
    mendsThisBreak
} from '../cultivation/what-structural-repair-medicine-can-reach.js';
import { APEX_INSTITUTIONS, COURTS } from '../../data/cultivation/governance-and-water-rights.js';

// ─────────────────────────────────────────────────────────────────────────
// HOW A DOSE IS KEPT
// ─────────────────────────────────────────────────────────────────────────

/** A quantity on a holder, or a row of its own. See the banner. */
export type RepairStorageModel = 'count' | 'row';

/**
 * One threshold, both consequences.
 *
 * Deliberately `repairCashPrice` and nothing else. If these two ever need to
 * disagree, the disagreement is the design question and it should be answered
 * out loud rather than by letting a second constant drift in beside the first.
 */
export function repairStorageModel(medicine: StructuralRepairMedicine): RepairStorageModel {
    return repairCashPrice(medicine) === null ? 'row' : 'count';
}

/** Where a house's count of the fungible grades lives. One key, one number. */
export function repairStockKey(medicineId: string): string {
    return `repair_stock:${medicineId}`;
}

/**
 * How much bookkeeping a dose deserves.
 *
 * Never `mundane` for a tracked one and never anything else for a counted one,
 * exactly as `significanceOfPill` does it next door. The sent-down grade is
 * `legendary` because there are seven of them in the world.
 */
export function significanceOfDose(medicine: StructuralRepairMedicine): ObjectSignificance {
    if (repairStorageModel(medicine) === 'count') return 'mundane';
    return medicine.madeBelowTheLid ? 'significant' : 'legendary';
}

/** The id a seeded dose row gets. Stable, so a reseed does not duplicate. */
export function doseId(factionId: string, medicineId: string, index: number): string {
    return `repair-dose-${factionId}-${medicineId}-${index + 1}`;
}

// ─────────────────────────────────────────────────────────────────────────
// SEEDING
// ─────────────────────────────────────────────────────────────────────────

/**
 * The name of a holder, whether or not this world instantiates it as a faction.
 *
 * TWO OF THE FIVE TRACKED HOLDERS ARE NOT FACTIONS AND CANNOT BE. The Deep
 * Survey and the Long Cut carry `factionId: null` in the governance catalog on
 * purpose - they are bodies nobody can join, they have no seat in the province,
 * and the world seeder therefore never makes a faction row for them. The same is
 * true of two of the four courts. That is a fact about the setting rather than a
 * defect, and it is why this module resolves a holder's name through the
 * governance catalog instead of assuming `state.factions` has everybody.
 */
function holderNameOf(state: WorldState, holderId: string): string {
    const faction = state.factions.find(f => f.id === holderId);
    if (faction) return faction.name;
    const apex = APEX_INSTITUTIONS.find(a => a.id === holderId || a.factionId === holderId);
    if (apex) return apex.name;
    const court = COURTS.find(c => c.id === holderId || c.embodiedByFactionId === holderId);
    if (court) return court.name;
    return holderId;
}

/**
 * Put the authored holdings into the world.
 *
 * Returns the tracked rows; the counted grades are written onto the factions in
 * place, the same way every other `resources` figure is. Deterministic and
 * seed-free: there is nothing to roll, because the whole point is that these are
 * in exactly the places the catalog says and nowhere else.
 *
 * A TRACKED DOSE IS PLACED WHETHER OR NOT ITS HOLDER IS A FACTION, because two
 * of the holders never will be - see {@link holderNameOf} - and the sent-down
 * count is the figure the world is supposed to be able to state. A COUNTED
 * holding needs a `resources` bag to live in, so it is placed only where the
 * world has a faction row; {@link openingStockThisWorldCannotHold} reports the
 * ones that fell out, so nothing goes missing silently.
 */
export function seedStructuralRepairMedicine(state: WorldState): ObjectRecord[] {
    const byId = new Map(state.factions.map(f => [f.id, f]));
    const out: ObjectRecord[] = [];

    for (const holding of STRUCTURAL_REPAIR_HOLDINGS) {
        const medicine = getStructuralRepairMedicine(holding.medicineId);
        if (!medicine) continue;
        const house = byId.get(holding.factionId);

        if (repairStorageModel(medicine) === 'count') {
            // A quantity, and nothing else. No row, no provenance, no question
            // about which one.
            if (!house) continue;
            house.resources[repairStockKey(medicine.id)] =
                Number(house.resources[repairStockKey(medicine.id)] ?? 0) + holding.count;
            continue;
        }

        const holderName = holderNameOf(state, holding.factionId);
        for (let i = 0; i < holding.count; i++) {
            out.push(makeObject({
                id: doseId(holding.factionId, medicine.id, i),
                name: medicine.name,
                kind: 'pill',
                significance: significanceOfDose(medicine),
                // Worth nothing in a fight, which is the point. There is no
                // second hierarchy of force in this table.
                power: null,
                description: medicine.description,
                possessorId: holding.factionId,
                ownerId: holding.factionId,
                ownerName: holderName,
                locationId: house?.seatLocationId ?? null,
                tags: [
                    'pill',
                    'structural-repair',
                    `grade:${medicine.grade}`,
                    `medicine:${medicine.id}`,
                    medicine.madeBelowTheLid ? 'refined-below-the-lid' : 'sent-down'
                ],
                data: {
                    medicineId: medicine.id,
                    reachesUpToOrdinal: medicine.reachesUpToOrdinal,
                    weightInStones: repairWeightInStones(medicine),
                    terms: medicine.terms,
                    spent: false,
                    whyStillHeld: holding.whyStillHeld,
                    whoDecides: holding.whoDecides
                },
                provenance: [{
                    onDay: 0,
                    holderId: holding.factionId,
                    holderName: holderName,
                    how: medicine.madeBelowTheLid ? 'bought' : 'found',
                    source: holding.howGot,
                    previousHolderId: null,
                    previousHolderName: null,
                    factId: null,
                    note: holding.whyStillHeld
                }]
            }));
        }
    }
    return out;
}

// ─────────────────────────────────────────────────────────────────────────
// THE LIVE ANSWER
// Every function below reads the world. None reads the catalog for a count.
// ─────────────────────────────────────────────────────────────────────────

/** A tracked dose nobody has swallowed yet. */
export function isUnspentDose(object: ObjectRecord): boolean {
    return object.tags.includes('structural-repair') && object.data?.spent !== true;
}

/** Every tracked dose in the world, spent or not. */
export function allDoses(state: WorldState): ObjectRecord[] {
    return state.objects.filter(o => o.tags.includes('structural-repair'));
}

export interface LiveHolding {
    factionId: string;
    medicineId: string;
    /** What they have on the shelf right now. */
    count: number;
    storage: RepairStorageModel;
    /** Row ids, for the tracked grades. Empty for the counted ones. */
    doseIds: string[];
}

/**
 * What this house is holding today.
 *
 * THE FUNCTION THE WHOLE MODULE EXISTS FOR. Tracked doses are counted off
 * unspent rows whose possessor is this house; counted grades are read off its
 * `resources`. A house that has spent everything returns an empty array, which
 * is a different and more interesting answer than never having had any - the
 * spent rows are still there to be found.
 */
export function repairMedicineHeldBy(state: WorldState, factionId: string): LiveHolding[] {
    const out: LiveHolding[] = [];
    const house = state.factions.find(f => f.id === factionId);

    for (const medicine of STRUCTURAL_REPAIR_MEDICINES) {
        if (repairStorageModel(medicine) === 'count') {
            const count = house ? Number(house.resources[repairStockKey(medicine.id)] ?? 0) : 0;
            if (count > 0) {
                out.push({ factionId, medicineId: medicine.id, count, storage: 'count', doseIds: [] });
            }
            continue;
        }
        const rows = state.objects.filter(
            o => o.possessorId === factionId
                && o.data?.medicineId === medicine.id
                && isUnspentDose(o)
        );
        if (rows.length > 0) {
            out.push({
                factionId,
                medicineId: medicine.id,
                count: rows.length,
                storage: 'row',
                doseIds: rows.map(o => o.id)
            });
        }
    }
    return out;
}

/** How many of one medicine stand in the whole world right now. */
export function worldCountOfRepairMedicine(state: WorldState, medicineId: string): number {
    const medicine = getStructuralRepairMedicine(medicineId);
    if (!medicine) return 0;
    if (repairStorageModel(medicine) === 'row') {
        return state.objects.filter(
            o => o.data?.medicineId === medicineId && isUnspentDose(o)
        ).length;
    }
    return state.factions.reduce(
        (n, f) => n + Number(f.resources[repairStockKey(medicineId)] ?? 0),
        0
    );
}

/**
 * The count the standing register carries: how many sent-down doses are left.
 *
 * The only medicine that reaches a break above ordinal 28, summed live off the
 * world. It never goes up. If it reads lower than the catalog's opening figure,
 * somebody has spent one, and the row that says who is still in `state.objects`.
 */
export function sentDownDosesStanding(state: WorldState): number {
    return STRUCTURAL_REPAIR_MEDICINES
        .filter(m => !m.madeBelowTheLid)
        .reduce((n, m) => n + worldCountOfRepairMedicine(state, m.id), 0);
}

/**
 * Counted stock belonging to a body this world has no faction row for.
 *
 * Reported rather than dropped. A count has to live in a `resources` bag and
 * two of the catalog's holders never get one, so their cheap doses exist in the
 * setting and not in the simulation. Anybody reconciling the world against the
 * catalog should read this first, because the alternative is a discrepancy that
 * looks like a bug and is a fact about which bodies the world instantiates.
 */
export function openingStockThisWorldCannotHold(
    state: WorldState
): { factionId: string; medicineId: string; count: number }[] {
    const have = new Set(state.factions.map(f => f.id));
    return STRUCTURAL_REPAIR_HOLDINGS
        .filter(h => {
            const medicine = getStructuralRepairMedicine(h.medicineId);
            return !!medicine && repairStorageModel(medicine) === 'count' && !have.has(h.factionId);
        })
        .map(h => ({ factionId: h.factionId, medicineId: h.medicineId, count: h.count }));
}

/** Every house in this world holding anything, in catalog order. */
export function everyRepairHolding(state: WorldState): LiveHolding[] {
    // Factions first, then anybody holding a tracked row who is not a faction -
    // which is two apexes and a court, and they hold most of what matters.
    const holders: string[] = state.factions.map(f => f.id);
    const seen = new Set(holders);
    for (const object of allDoses(state)) {
        const id = object.possessorId;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        holders.push(id);
    }
    return holders.flatMap(id => repairMedicineHeldBy(state, id));
}

/**
 * The dose this house would reach for, or null where it has nothing that
 * reaches.
 *
 * Cheapest that works, never the most impressive thing on the shelf - the same
 * discipline `findCheapestPillFor` keeps. A house does not spend a sent-down
 * object on a cracked core.
 */
export function doseAHouseWouldUse(
    state: WorldState,
    factionId: string,
    woundKey: string,
    atOrdinal: number
): { medicine: StructuralRepairMedicine; holding: LiveHolding } | null {
    let best: { medicine: StructuralRepairMedicine; holding: LiveHolding } | null = null;
    for (const holding of repairMedicineHeldBy(state, factionId)) {
        const medicine = getStructuralRepairMedicine(holding.medicineId);
        if (!medicine) continue;
        if (!mendsThisBreak(medicine, woundKey, atOrdinal)) continue;
        if (!best || repairWeightInStones(medicine) < repairWeightInStones(best.medicine)) {
            best = { medicine, holding };
        }
    }
    return best;
}

// ─────────────────────────────────────────────────────────────────────────
// SPENDING ONE
// ─────────────────────────────────────────────────────────────────────────

export interface DoseSpent {
    medicineId: string;
    /** The row that was spent, for the tracked grades. Null for a count. */
    doseId: string | null;
    onWhomId: string;
    onDay: number;
}

/**
 * Spend a dose out of a house's holdings, in place.
 *
 * Returns what was spent, or null where the house had nothing that reaches -
 * which callers must treat as a refusal rather than retrying with something
 * else, because there is nothing else.
 *
 * THE ROW STAYS. A dose that vanishes cleanly from the record is a dose nobody
 * can ever be asked about, and the fact that this house held one and spent it on
 * that person is precisely what somebody should be able to discover two hundred
 * years later. The same discipline `swallow` keeps for barter pills, and for the
 * same reason - here it matters more, because for the sent-down grade the row is
 * the only evidence that one of the eleven ever existed.
 */
export function spendRepairDose(
    state: WorldState,
    factionId: string,
    onWhomId: string,
    onWhomName: string,
    woundKey: string,
    atOrdinal: number,
    onDay: number
): DoseSpent | null {
    const choice = doseAHouseWouldUse(state, factionId, woundKey, atOrdinal);
    if (!choice) return null;
    const { medicine, holding } = choice;

    if (holding.storage === 'count') {
        const house = state.factions.find(f => f.id === factionId);
        if (!house) return null;
        const key = repairStockKey(medicine.id);
        const left = Number(house.resources[key] ?? 0) - 1;
        if (left > 0) house.resources[key] = left;
        else delete house.resources[key];
        return { medicineId: medicine.id, doseId: null, onWhomId, onDay };
    }

    const rowId = holding.doseIds[0];
    const index = state.objects.findIndex(o => o.id === rowId);
    if (index < 0) return null;
    const moved = transferPossession(state.objects[index], {
        onDay,
        toHolderId: null,
        toHolderName: onWhomName,
        how: 'gifted',
        source: `Spent on ${onWhomName} for ${woundKey}`,
        note: 'Swallowed. The row is kept: what a house spent, on whom, and on what day is the part of this that outlives the object.'
    });
    state.objects[index] = {
        ...moved,
        tags: [...moved.tags, 'spent'],
        data: { ...moved.data, spent: true, spentBy: onWhomId, spentOnDay: onDay, spentOn: woundKey }
    };
    return { medicineId: medicine.id, doseId: rowId, onWhomId, onDay };
}
