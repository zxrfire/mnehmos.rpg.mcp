/**
 * What is on them, for the character sheet: equipment (worn and held) and inventory.
 *
 * The owner: "i need to know what's on me", and "add an inventory tab on the right too,
 * inventory, equipment", below techniques. Off the same sources the `inventory` read uses, so
 * the sheet and the game never disagree about what somebody is carrying.
 *
 * Pure, and handed the pouch rather than reading it: the engine's server modules sit in an import
 * cycle that a new importer of them can trip at startup.
 */

import { getArtifact } from '../data/cultivation/artifacts.js';
import { getPill } from '../data/cultivation/pills.js';
import { getTechnique } from '../data/cultivation/techniques.js';
import { whatAnIngredientIs } from '../engine/cultivation/what-a-cauldron-will-take.js';
import { canReachInto, isAStorageRing, whatIsInTheRing } from '../engine/world/a-storage-ring.js';
import { isAVehicle, isWithThem, whatIsInTheVehicle } from '../engine/world/a-vehicle.js';
import { howItIsHad, type ObjectRecord } from '../engine/world/possessions.js';
import { theConditionItIsIn } from '../engine/world/object-damage.js';

/** A row's name, with its condition where it is not whole. */
const named = (row: ObjectRecord): string => {
    const condition = theConditionItIsIn(row);
    return condition ? `${row.name} (${condition})` : row.name;
};

export interface TheThingsOnTheSheet {
    worn: string[];
    held: string[];
    /** In the pouch: a name, with a count when there is more than one. */
    inventory: string[];
    /** A ring worn, what is in it, or null when it will not open to them. */
    rings: { name: string; inside: string[] | null }[];
    vehicles: { name: string; inside: string[] }[];
}

interface ACountedEntry { kind: string; itemId: string; quantity: number }

const counted = (name: string, quantity: number) => (quantity > 1 ? `${name} x${quantity}` : name);

export function theThingsOnTheSheet(input: {
    objects: readonly ObjectRecord[];
    personId: string;
    /** Their world place id, which is where a vehicle with them stands. */
    here: string | null;
    /** Counted stock: pills, herbs and beast material. */
    pouch: readonly ACountedEntry[];
    /** Rated objects kept in the pouch table. */
    artifacts: readonly ACountedEntry[];
    /** Technique ids they hold a copy of. */
    books: readonly string[];
    rations: number;
}): TheThingsOnTheSheet {
    const { objects, personId, here } = input;
    const theirs = objects.filter(row => row.possessorId === personId && !isAVehicle(row)
        && row.kind !== 'formation' && row.kind !== 'territory'
        && !row.tags.includes('never-carried'));
    const worn = theirs.filter(row => howItIsHad(row) === 'worn');

    const inventory = [
        ...theirs.filter(row => howItIsHad(row) === 'inventory').map(named),
        ...input.pouch.map(entry => counted(
            entry.kind === 'pill'
                ? getPill(entry.itemId)?.name ?? entry.itemId
                : whatAnIngredientIs(entry.itemId)?.name ?? entry.itemId,
            entry.quantity
        )),
        ...input.artifacts.map(entry => {
            // A pouch artifact the world keeps a row for is that row, holes and all.
            const row = objects.find(object => object.id === entry.itemId);
            const name = getArtifact(entry.itemId)?.name ?? entry.itemId;
            const condition = row ? theConditionItIsIn(row) : null;
            return counted(condition ? `${name} (${condition})` : name, entry.quantity);
        }),
        ...input.books.map(id => `A copy of ${getTechnique(id)?.name ?? id}`),
        ...(input.rations > 0 ? [counted('Ration', input.rations)] : [])
    ];

    return {
        worn: worn.map(named),
        held: theirs.filter(row => howItIsHad(row) === 'held').map(named),
        inventory,
        rings: worn.filter(isAStorageRing).map(ring => ({
            name: ring.name,
            inside: canReachInto(ring, personId) ? whatIsInTheRing(objects, ring.id).map(row => row.name) : null
        })),
        vehicles: objects.filter(row => isAVehicle(row)
            && (row.ownerId === personId || row.possessorId === personId)
            && isWithThem(row, personId, here)).map(vehicle => ({
            name: named(vehicle),
            inside: whatIsInTheVehicle(objects, vehicle.id).map(row => row.name)
        }))
    };
}
