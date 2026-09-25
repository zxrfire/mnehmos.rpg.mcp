/**
 * A vehicle's sentences: leaving it, taking it along, and putting things in it and out of it.
 *
 * The vehicle is `a-vehicle.ts`: an item that goes with its owner until it is left, reachable
 * only when they are with it. None of these spends a day.
 */

import {
    isAVehicle,
    isWithThem,
    leaveItHere,
    takeItAlong,
    whatAVehicleHolds,
    whatIsInTheVehicle,
    whereItStands
} from '../engine/world/a-vehicle.js';
import { hadAs, isWorn, type ObjectRecord } from '../engine/world/possessions.js';
import { whatABodyCanCarry, whatAllOfThatTakes } from '../engine/world/what-a-body-can-carry-and-what-a-ring-holds.js';
import {
    howManyHeld,
    together,
    whatTheirThingsTake,
    whereItWouldGo
} from '../engine/world/what-somebody-is-carrying-takes.js';
import type { Cultivator } from '../schema/cultivation.js';
import { addToPouch, everythingInThePouch, removeFromPouch } from '../server/consolidated/cultivation-support.js';
import { whatAnIngredientIs } from '../engine/cultivation/what-a-cauldron-will-take.js';
import { getPill } from '../data/cultivation/pills.js';
import { whatABeastPartTakes, whereAKillIsLeft } from '../engine/world/what-a-beast-part-takes.js';
import { factsForRefusal, observable } from './facts.js';
import { refused } from './tool-result-prose.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

export type VehicleIntent = 'load' | 'unload' | 'leave_behind' | 'take_along';

/** Words for a vehicle, in the player's own vocabulary. */
const A_VEHICLE_WORD = /\b(?:cart|carts|carriage|carriages|wagon|waggon|boat|boats|ship|skiff|mount|mounts|mule|horse|beast|ride)\b/i;

function theOneNamed(rows: readonly ObjectRecord[], named: string | undefined): ObjectRecord | null {
    const said = (named ?? '').toLowerCase().replace(/^(?:my|the|a|an)\s+/, '').trim();
    if (rows.length === 0) return null;
    if (said.length === 0) return rows[0]!;
    // "the boat" is the boat when there is a carriage too; any vehicle word is the first one only
    // when none of them is called by it.
    const word = A_VEHICLE_WORD.exec(said)?.[0];
    if (word) {
        // A hull is a hull whatever a player calls it: the row is "A spirit boat"
        // and "the boat" is the same craft.
        const stem = word.replace(/s$/, '');
        const sameCraft = /^(?:boat|ship|skiff)$/.test(stem) ? ['boat', 'ship', 'skiff'] : [stem];
        return rows.find(row => sameCraft.some(w => row.name.toLowerCase().includes(w))) ?? rows[0]!;
    }
    const words = said.split(/\s+/).filter(word => word.length > 2);
    return rows.find(row => words.some(word => row.name.toLowerCase().includes(word))) ?? null;
}

function done(line: string, structure: string): Execution {
    return {
        facts: observable(line, [line], line, [structure]),
        events: [],
        timeSkip: null,
        breakthrough: null,
        outcome: 'executed',
        calls: [{ name: 'engine.vehicle', action: 'carry', summary: structure, ok: true }]
    };
}

function no(headline: string, prose: string, structure: string): Execution {
    return refused('engine.vehicle', 'carry', factsForRefusal(headline, prose, `carry/${structure} Nothing written and no day passed.`));
}

export function whatTheVehicleDoes(
    game: GameService,
    cultivator: Cultivator,
    intent: VehicleIntent,
    named: string | undefined,
    /** For load and unload, the vehicle the sentence named, where it named one apart from the thing. */
    vehicleNamed?: string
): Execution {
    const world = game.atHand;
    const here = game.worldPlaceOf(cultivator);
    const theirs = (world?.objects ?? []).filter(o => isAVehicle(o)
        && ((o.ownerId === cultivator.id && o.possessorId === null) || o.possessorId === cultivator.id));
    if (world === null || world === undefined || theirs.length === 0) {
        return no('You have no vehicle.', 'You own nothing to ride or load.', `${intent}: no vehicle.`);
    }

    if (intent === 'leave_behind' || intent === 'take_along') {
        const along = intent === 'take_along';
        const vehicle = theOneNamed(theirs.filter(o => isWithThem(o, cultivator.id, here)), named);
        if (vehicle === null) {
            return no(along ? 'It is not here.' : 'It is not with you.',
                along ? 'What you own is not standing where you are.' : 'Nothing of yours is with you to leave.',
                `${intent}: nothing of theirs here.`);
        }
        if (along) takeItAlong(world.objects, vehicle, cultivator.id);
        else leaveItHere(world.objects, vehicle, here);
        game.theWorldMoved();
        return done(along
            ? `${vehicle.name} goes with you from here.`
            : `${vehicle.name} stays here, and what is in it stays with it. It will be here when you come back for it.`,
        `carry/${intent}: ${vehicle.id} ${along ? `with ${cultivator.id}` : `left at ${here}`}.`);
    }

    const vehicle = theOneNamed(theirs.filter(o => isWithThem(o, cultivator.id, here)), vehicleNamed);
    if (vehicle === null) {
        const elsewhere = theirs[0]!;
        return no('It is not here.', `${elsewhere.name} is not with you, and nothing in it can be reached from here.`,
            `${intent}: ${elsewhere.id} stands at ${whereItStands(elsewhere)}.`);
    }
    // Its hold, not its size. See `whatAVehicleHolds`.
    const holds = whatAVehicleHolds(vehicle);
    const inside = whatIsInTheVehicle(world.objects, vehicle.id);
    if (intent === 'load') {
        const thing = theOneNamed(world.objects.filter(o => o.possessorId === cultivator.id && !isWorn(o)), named);
        if (thing === null) {
            // COUNTED STOCK: a pelt in the pack, or one left where the beast fell, here.
            const counted = loadCountedStock(game, cultivator, vehicle, holds, named, here);
            if (counted !== null) return counted;
            return no(`You have no ${named ?? 'such thing'}.`, `You have no ${named ?? 'such thing'} to put in it.`, 'load: nothing named.');
        }
        // What is in it already: things, and counted stock such as pelts off a kill.
        const stock = whatAllOfThatTakes(everythingInThePouch(game.db, vehicle.id));
        const taken = inside.reduce((sum, o) => sum + o.volume, 0) + stock.volume;
        const weighs = inside.reduce((sum, o) => sum + o.weight, 0) + stock.weight;
        if (taken + thing.volume > holds.volume || weighs + thing.weight > holds.weight) {
            return no(`${thing.name} will not fit.`, `${vehicle.name} is full: what is in it already takes up its hold.`,
                `load: no room (${taken} of ${holds.volume} litres, ${weighs} of ${holds.weight} weight).`);
        }
        const at = world.objects.findIndex(o => o.id === thing.id);
        world.objects[at] = { ...hadAs(thing, 'inventory'), possessorId: vehicle.id };
        game.theWorldMoved();
        return done(`${thing.name} is in ${vehicle.name}.`, `carry/load: ${thing.id} into ${vehicle.id}.`);
    }

    const thing = theOneNamed(inside, named);
    if (thing === null) {
        const counted = unloadCountedStock(game, cultivator, vehicle, named);
        if (counted !== null) return counted;
        return no(`There is no ${named ?? 'such thing'} in it.`, `There is no ${named ?? 'such thing'} in ${vehicle.name}.`, 'unload: not in it.');
    }
    const lands = whereItWouldGo(
        together(whatAllOfThatTakes(everythingInThePouch(game.db, cultivator.id)), whatTheirThingsTake(world.objects, cultivator.id)),
        thing, whatABodyCanCarry(cultivator.realmOrdinal), howManyHeld(world.objects, cultivator.id));
    if (lands === 'too_heavy' || lands === 'hands_full') {
        return no('You cannot carry it.', `${thing.name} is more than you can carry just now; it stays in ${vehicle.name}.`, `unload: ${lands}.`);
    }
    const at = world.objects.findIndex(o => o.id === thing.id);
    world.objects[at] = hadAs({ ...thing, possessorId: cultivator.id }, lands);
    game.theWorldMoved();
    return done(`${thing.name} is out of ${vehicle.name} and ${lands === 'held' ? 'in your hand' : 'in your pack'}.`,
        `carry/unload: ${thing.id} out of ${vehicle.id}, landed ${lands}.`);
}

/** The inventory's lines for somebody's vehicles: what is with them, and what was left where. */
export function theLinesForTheirVehicles(game: GameService, objects: readonly ObjectRecord[], cultivator: Cultivator): string[] {
    const here = game.worldPlaceOf(cultivator);
    const placeName = (id: string | null) => game.atHand?.locations.find(l => l.id === id)?.name ?? id ?? 'somewhere';
    return objects.filter(o => isAVehicle(o)
        && ((o.ownerId === cultivator.id && o.possessorId === null) || o.possessorId === cultivator.id)).map(vehicle => {
        const inside = [...whatIsInTheVehicle(objects, vehicle.id).map(o => o.name), ...theStockIn(game, vehicle.id)];
        const load = inside.length === 0 ? '' : `, holding ${inside.join(', ')}`;
        return isWithThem(vehicle, cultivator.id, here)
            ? `With you: ${vehicle.name}${load}.`
            : `Left at ${placeName(whereItStands(vehicle))}: ${vehicle.name}${load}. Not reachable from where you are standing.`;
    });
}

/** A counted item's name, as the player would say it. */
function theNameOf(itemId: string, kind: string): string {
    return kind === 'pill' ? getPill(itemId)?.name ?? itemId : whatAnIngredientIs(itemId)?.name ?? itemId;
}

/** Counted stock under a holder, as lines. */
function theStockIn(game: GameService, holderId: string): string[] {
    return everythingInThePouch(game.db, holderId).filter(entry => entry.kind !== 'ration')
        .map(entry => `${theNameOf(entry.itemId, entry.kind)}${entry.quantity > 1 ? ` x${entry.quantity}` : ''}`);
}

/** The counted row a name points at, under one holder. */
function theStockNamed(game: GameService, holderId: string, named: string | undefined) {
    const said = (named ?? '').toLowerCase().replace(/^(?:my|the|a|an|some)\s+/, '').trim();
    const words = said.split(/\s+/).filter(word => word.length > 2);
    if (words.length === 0) return null;
    return everythingInThePouch(game.db, holderId).filter(entry => entry.kind !== 'ration')
        .find(entry => words.some(word => theNameOf(entry.itemId, entry.kind).toLowerCase().includes(word))) ?? null;
}

/** Putting one counted thing, from the pack or from a kill left here, into a vehicle's hold. */
function loadCountedStock(
    game: GameService,
    cultivator: Cultivator,
    vehicle: ObjectRecord,
    holds: { volume: number; weight: number },
    named: string | undefined,
    here: string | null
): Execution | null {
    const left = here ? whereAKillIsLeft(here, cultivator.id) : null;
    const fromThePack = theStockNamed(game, cultivator.id, named);
    const fromTheGround = left ? theStockNamed(game, left, named) : null;
    const entry = fromThePack ?? fromTheGround;
    if (entry === null) return null;
    const from = fromThePack ? cultivator.id : left!;
    const size = whatABeastPartTakes(entry.itemId) ?? whatAllOfThatTakes([{ kind: entry.kind, quantity: 1 }]);
    const already = together(
        whatAllOfThatTakes(everythingInThePouch(game.db, vehicle.id)),
        whatIsInTheVehicle(game.atHand?.objects ?? [], vehicle.id).reduce(
            (sum, o) => ({ volume: sum.volume + o.volume, weight: sum.weight + o.weight }), { volume: 0, weight: 0 }));
    const name = theNameOf(entry.itemId, entry.kind);
    if (already.volume + size.volume > holds.volume || already.weight + size.weight > holds.weight) {
        return no(`${name} will not fit.`, `${vehicle.name} is full: what is in it already takes up its hold.`,
            `load: no room for ${entry.itemId} (${already.volume} of ${holds.volume} litres).`);
    }
    removeFromPouch(game.db, from, entry.itemId, 1);
    addToPouch(game.db, vehicle.id, entry.itemId, entry.kind, 1);
    return done(`${name} is in ${vehicle.name}.`, `carry/load: ${entry.itemId} from ${from} into ${vehicle.id}.`);
}

/** Taking one counted thing out of a vehicle into the pack, where it fits. */
function unloadCountedStock(game: GameService, cultivator: Cultivator, vehicle: ObjectRecord, named: string | undefined): Execution | null {
    const entry = theStockNamed(game, vehicle.id, named);
    if (entry === null) return null;
    const size = whatABeastPartTakes(entry.itemId) ?? whatAllOfThatTakes([{ kind: entry.kind, quantity: 1 }]);
    const carrying = together(whatAllOfThatTakes(everythingInThePouch(game.db, cultivator.id)),
        whatTheirThingsTake(game.atHand?.objects ?? [], cultivator.id));
    const body = whatABodyCanCarry(cultivator.realmOrdinal);
    const name = theNameOf(entry.itemId, entry.kind);
    if (carrying.volume + size.volume > body.volume || carrying.weight + size.weight > body.weight) {
        return no('You cannot carry it.', `${name} is more than you can carry just now; it stays in ${vehicle.name}.`,
            `unload: ${entry.itemId} does not fit the pack.`);
    }
    removeFromPouch(game.db, vehicle.id, entry.itemId, 1);
    addToPouch(game.db, cultivator.id, entry.itemId, entry.kind, 1);
    return done(`${name} is out of ${vehicle.name} and in your pack.`, `carry/unload: ${entry.itemId} out of ${vehicle.id}.`);
}
