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
import { everythingInThePouch } from '../server/consolidated/cultivation-support.js';
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
    if (said.length === 0 || A_VEHICLE_WORD.test(said)) return rows[0]!;
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
    const holds = vehicle.volume;
    const inside = whatIsInTheVehicle(world.objects, vehicle.id);
    if (intent === 'load') {
        const thing = theOneNamed(world.objects.filter(o => o.possessorId === cultivator.id && !isWorn(o)), named);
        if (thing === null) return no(`You have no ${named ?? 'such thing'}.`, `You have no ${named ?? 'such thing'} to put in it.`, 'load: nothing named.');
        const taken = inside.reduce((sum, o) => sum + o.volume, 0);
        if (taken + thing.volume > holds) {
            return no(`${thing.name} will not fit.`, `${vehicle.name} holds ${holds} litres and ${taken} of them are taken.`, 'load: no room.');
        }
        const at = world.objects.findIndex(o => o.id === thing.id);
        world.objects[at] = { ...hadAs(thing, 'inventory'), possessorId: vehicle.id };
        game.theWorldMoved();
        return done(`${thing.name} is in ${vehicle.name}.`, `carry/load: ${thing.id} into ${vehicle.id}.`);
    }

    const thing = theOneNamed(inside, named);
    if (thing === null) return no(`There is no ${named ?? 'such thing'} in it.`, `There is no ${named ?? 'such thing'} in ${vehicle.name}.`, 'unload: not in it.');
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
        const inside = whatIsInTheVehicle(objects, vehicle.id);
        const load = inside.length === 0 ? '' : `, holding ${inside.map(o => o.name).join(', ')}`;
        return isWithThem(vehicle, cultivator.id, here)
            ? `With you: ${vehicle.name}${load}.`
            : `Left at ${placeName(whereItStands(vehicle))}: ${vehicle.name}${load}. Not reachable from where you are standing.`;
    });
}
