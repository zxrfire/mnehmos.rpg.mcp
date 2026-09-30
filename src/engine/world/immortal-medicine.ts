/** Opening counts become individual doses once; every later holding is read from objects. */
import { IMMORTAL_HOLDINGS, IMMORTAL_ITEMS, RECEIPT_HISTORIES, getHoldingsOf, type ImmortalGrade, type Holding } from '../../data/cultivation/immortal-items.js';
import { SITES, readAdmission } from '../../data/cultivation/inheritance-trials.js';
import { forStream } from '../cultivation/rng.js';
import { isBelowTheLid } from './layers.js';
import { PROSPECTING_FLOOR_ORDINAL } from './how-the-world-keeps-finding-more-ruins.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { makeFact } from './history.js';
import { makeObject, ruin, transferPossession, type ObjectRecord } from './possessions.js';
import type { WorldState } from './world-state.js';

function dose(id: string, itemId: string, grade: ImmortalGrade, holderId: string | null, holderName: string, locationId: string | null): ObjectRecord {
    const item = IMMORTAL_ITEMS.find(i => i.id === itemId)!;
    return makeObject({ id, name: item.name, kind: item.form === 'golden_pill' ? 'pill' : 'other', significance: 'legendary',
        possessorId: holderId, ownerId: holderId, ownerName: holderName, locationId,
        tags: ['immortal-medicine', `grade:${grade}`],
        data: { medicineId: itemId, grade, spent: false },
        provenance: [{ onDay: 0, holderId, holderName, how: 'found', source: locationId ?? holderName,
            previousHolderId: null, previousHolderName: null, factId: null, note: 'opening holding' }]
    });
}

export function seedImmortalMedicine(state: WorldState): ObjectRecord[] {
    const rows: ObjectRecord[] = [];
    const opening = [...IMMORTAL_HOLDINGS, ...RECEIPT_HISTORIES.filter(h => !h.countedByTheRegisters)
        .map(h => ({ factionId: h.factionId, itemId: h.itemId, byGrade: h.stillHeld }))];
    for (const h of opening) {
        const house = state.factions.find(f => f.id === h.factionId);
        for (const grade of ['higher', 'middle', 'lower'] as const) for (let n = 0; n < h.byGrade[grade]; n++) {
            rows.push(dose(`immortal-dose:${h.factionId}:${h.itemId}:${grade}:${n}`, h.itemId, grade,
                h.factionId, house?.name ?? h.factionId, house?.seatLocationId ?? null));
        }
    }
    for (const site of SITES) {
        if (site.kind === 'trial') continue;
        site.interior.contents.forEach((good, n) => {
            if (!good.immortalItemId) return;
            const row = dose(`grave-dose:${site.id}:${n}`, good.immortalItemId, 'lower', null, site.name, site.id);
            row.data.siteId = site.id;
            rows.push(row);
        });
    }
    return rows;
}

export function immortalHoldings(state: WorldState, factionId: string): Holding[] {
    const held = immortalInventory(state, factionId);
    return getHoldingsOf(factionId).map(h => ({ ...h, ...held.find(row => row.itemId === h.itemId)! }));
}

export function immortalInventory(state: WorldState, holderId: string): Pick<Holding, 'itemId' | 'count' | 'byGrade'>[] {
    return IMMORTAL_ITEMS.map(item => {
        const rows = state.objects.filter(o => o.possessorId === holderId && o.data.medicineId === item.id
            && o.tags.includes('immortal-medicine') && o.data.spent !== true && !o.tags.includes('ruined'));
        const byGrade = { higher: 0, middle: 0, lower: 0 };
        for (const row of rows) byGrade[row.data.grade as ImmortalGrade]++;
        return { itemId: item.id, count: rows.length, byGrade };
    });
}

export function takeGraveMedicine(state: WorldState, siteId: string, holderId: string, holderName: string, onDay: number): ObjectRecord[] {
    const taken: ObjectRecord[] = [];
    state.objects = state.objects.map(o => {
        if (o.data.siteId !== siteId || o.possessorId !== null || o.data.spent === true || o.tags.includes('ruined')) return o;
        const moved = { ...transferPossession(o, { toHolderId: holderId, toHolderName: holderName,
            onDay, how: 'looted', source: siteId, transfersOwnership: true }), locationId: null };
        taken.push(moved);
        return moved;
    });
    return taken;
}

/** A party finding other ground can also reach a grave nobody came looking for. */
export function findMedicineOnAnotherErrand(state: WorldState, regionId: string, year: number, onDay: number): void {
    const under = (locationId: string | null): boolean => {
        const seen = new Set<string>();
        let cursor = locationId;
        while (cursor && !seen.has(cursor)) {
            if (cursor === regionId) return true;
            seen.add(cursor);
            cursor = state.locations.find(l => l.id === cursor)?.parentId ?? null;
        }
        return false;
    };
    const local = state.npcs.filter(n => n.status === 'alive' && isBelowTheLid(n)
        && n.cultivation.realmOrdinal >= PROSPECTING_FLOOR_ORDINAL && under(n.locationId));
    if (!local.length) return;
    const rng = forStream(state.seed, 'incidental-grave', regionId, year);
    // One remote grave among a hundred successful searches for other ground.
    if (!rng.chance(0.01)) return;
    const finder = local[rng.int(0, local.length - 1)]!;
    for (const site of SITES) {
        if (site.kind === 'trial' || site.interior.gates.some(g => g.kind !== 'fate'
            || g.coincidence !== 'arrived_without_looking')) continue;
        const homes = site.factionIds.map(id => state.factions.find(f => f.id === id)?.seatLocationId ?? null);
        if (!homes.some(under) || !readAdmission(site.access, finder.cultivation.realmOrdinal).survives) continue;
        const taken = takeGraveMedicine(state, site.id, finder.id, finder.name, onDay);
        if (!taken.length) continue;
        appendWorldFact(state, makeFact({ day: onDay, kind: 'treasure_found', scale: 'local', visibility: 'secret',
            locationId: finder.locationId, actors: [{ id: finder.id, name: finder.name, role: 'finder' }],
            summary: `${finder.name} recovered goods from a grave reached while searching for other ground.`,
            magnitude: 0.2, data: { siteId: site.id, arrival: 'arrived_without_looking',
                objectIds: taken.map(o => o.id).join(',') } }));
    }
}

export function spendImmortalMedicine(state: WorldState, objectId: string, holderId: string, onDay: number): boolean {
    const at = state.objects.findIndex(o => o.id === objectId && o.possessorId === holderId
        && o.tags.includes('immortal-medicine') && o.data.spent !== true && !o.tags.includes('ruined'));
    if (at < 0) return false;
    state.objects[at] = ruin({ ...state.objects[at], data: { ...state.objects[at].data, spent: true } },
        { onDay, source: `swallowed by ${holderId}` });
    return true;
}
