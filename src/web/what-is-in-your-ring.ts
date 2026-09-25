/**
 * Putting a thing into a storage ring, taking it out, and breaking the mark on somebody else's.
 *
 * The ring is `a-storage-ring.ts`: an item worn on the hand, whose contents are the ring's and go
 * where it goes, reachable only while it is on and the mark on it is yours. These are the three
 * sentences that act on it. None of them spends a day.
 */

import { forStream } from '../engine/cultivation/rng.js';
import {
    breakTheMark,
    canReachInto,
    howFullTheRingIs,
    isAStorageRing,
    putIntoTheRing,
    takeOutOfTheRing,
    whatIsInTheRing,
    whoseMarkIsOn
} from '../engine/world/a-storage-ring.js';
import { hadAs, isWorn, type ObjectRecord } from '../engine/world/possessions.js';
import { isAVehicle, isWithThem } from '../engine/world/a-vehicle.js';
import { whatABodyCanCarry, whatAllOfThatTakes } from '../engine/world/what-a-body-can-carry-and-what-a-ring-holds.js';
import {
    howManyHeld,
    together,
    whatTheirThingsTake,
    whereItWouldGo
} from '../engine/world/what-somebody-is-carrying-takes.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { everythingInThePouch } from '../server/consolidated/cultivation-support.js';
import { factsForRefusal, observable } from './facts.js';
import { refused } from './tool-result-prose.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

/** Which of their rings they meant: the one on their hand first. */
function theRingMeant(objects: readonly ObjectRecord[], personId: string): ObjectRecord | null {
    const rings = objects.filter(object => object.possessorId === personId && isAStorageRing(object))
        .sort((a, b) => Number(isWorn(b)) - Number(isWorn(a)));
    return rings[0] ?? null;
}

/** The thing a sentence names among `rows`, by a word of its name. */
function theThingNamed(rows: readonly ObjectRecord[], named: string | undefined): ObjectRecord | null {
    const words = (named ?? '').toLowerCase().replace(/^(?:my|the|a|an)\s+/, '')
        .split(/\s+/).filter(word => word.length > 2);
    if (words.length === 0) return null;
    return rows.find(row => words.some(word => row.name.toLowerCase().includes(word))) ?? null;
}

function done(name: string, line: string, structure: string): Execution {
    return {
        facts: observable(line, [line], line, [structure]),
        events: [],
        timeSkip: null,
        breakthrough: null,
        outcome: 'executed',
        calls: [{ name, action: 'carry', summary: structure, ok: true }]
    };
}

function no(name: string, headline: string, prose: string, structure: string): Execution {
    return refused(name, 'carry', factsForRefusal(headline, prose, `carry/${structure} Nothing written and no day passed.`));
}

/** Why a ring cannot be reached into, in the player's terms. */
function whyItWillNotOpen(ring: ObjectRecord, personId: string): string {
    const mark = whoseMarkIsOn(ring);
    if (mark !== null && mark.by !== personId) {
        return `Somebody else's mark is on ${ring.name}, and it will not open for you until the mark is broken.`;
    }
    return `${ring.name} is not on your hand, and nothing in it can be reached until it is.`;
}

export function whatTheRingDoes(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    intent: 'store' | 'retrieve' | 'unmark',
    named: string | undefined
): Execution {
    const world = game.atHand;
    const ring = world ? theRingMeant(world.objects, cultivator.id) : null;
    if (world === null || world === undefined || ring === null) {
        return no('engine.ring', 'You have no storage ring.', 'You have no storage ring.', `${intent}: no ring.`);
    }

    if (intent === 'unmark') {
        const roll = forStream(run.seed, `unmark:${ring.id}:${run.turn}`).next();
        const broke = breakTheMark(world.objects, ring, { id: cultivator.id, ordinal: cultivator.realmOrdinal }, roll);
        if (broke.whoseItWas === null || broke.whoseItWas === cultivator.id) {
            return no('engine.ring', 'The mark on it is yours.', `The only mark on ${ring.name} is your own.`, 'unmark: already theirs.');
        }
        game.theWorldMoved();
        const line = broke.lifted
            ? `The mark on ${ring.name} gives way, and yours is on it now. Whoever laid the first one felt it go.`
            : broke.odds === 0
                ? `The mark on ${ring.name} holds: whoever laid it is further along than you, and nothing you have moves it.`
                : `The mark on ${ring.name} holds this time. Whoever laid it felt somebody try.`;
        return done('engine.ring', line, `carry/unmark: ${ring.id}. ${broke.line} Rolled ${roll.toFixed(2)}.`);
    }

    if (!canReachInto(ring, cultivator.id)) {
        return no('engine.ring', `${ring.name} will not open.`, whyItWillNotOpen(ring, cultivator.id), `${intent}: cannot reach into ${ring.id}.`);
    }

    if (intent === 'store') {
        // What they carry, and a vehicle they are with: "unless you fit it in a storage ring".
        const here = game.worldPlaceOf(cultivator);
        const mine = world.objects.filter(object => object.id !== ring.id
            && (object.possessorId === cultivator.id
                || (isAVehicle(object) && object.ownerId === cultivator.id && isWithThem(object, cultivator.id, here))));
        const thing = theThingNamed(mine, named);
        if (thing !== null && isAVehicle(thing)) {
            const { holds, taken } = howFullTheRingIs(world.objects, ring);
            if (taken + thing.volume > holds) {
                return no('engine.ring', `${thing.name} will not fit.`,
                    `${thing.name} will not go into ${ring.name}: it holds ${holds} litres and ${taken} of them are taken.`, 'store: no room.');
            }
            const at = world.objects.findIndex(object => object.id === thing.id);
            world.objects[at] = { ...thing, possessorId: ring.id, data: { ...thing.data, withId: null } };
            game.theWorldMoved();
            return done('engine.ring', `${thing.name} is in ${ring.name}.`, `carry/store: vehicle ${thing.id} into ${ring.id}.`);
        }
        if (thing === null) {
            return no('engine.ring', `You have no ${named ?? 'such thing'}.`, `You have no ${named ?? 'such thing'} to put in it.`, 'store: nothing named.');
        }
        const stored = putIntoTheRing(world.objects, cultivator.id, ring, thing);
        if (stored === 'no_room') {
            const { holds, taken } = howFullTheRingIs(world.objects, ring);
            return no('engine.ring', `${thing.name} will not fit.`,
                `${thing.name} will not go into ${ring.name}: it holds ${holds} litres and ${taken} of them are taken.`, 'store: no room.');
        }
        game.theWorldMoved();
        return done('engine.ring', `${thing.name} is in ${ring.name}.`, `carry/store: ${thing.id} into ${ring.id}.`);
    }

    const thing = theThingNamed(whatIsInTheRing(world.objects, ring.id), named);
    if (thing === null) {
        return no('engine.ring', `There is no ${named ?? 'such thing'} in it.`, `There is no ${named ?? 'such thing'} in ${ring.name}.`, 'retrieve: not in it.');
    }
    if (isAVehicle(thing)) {
        // Out of a ring, a vehicle stands where they are, going with them: never in a pack.
        const at = world.objects.findIndex(object => object.id === thing.id);
        world.objects[at] = {
            ...thing,
            possessorId: null,
            locationId: game.worldPlaceOf(cultivator) ?? thing.locationId,
            data: { ...thing.data, withId: cultivator.id }
        };
        game.theWorldMoved();
        return done('engine.ring', `${thing.name} is out of ${ring.name} and standing beside you.`,
            `carry/retrieve: vehicle ${thing.id} out of ${ring.id}, with ${cultivator.id}.`);
    }
    takeOutOfTheRing(world.objects, cultivator.id, ring, thing);
    // Out of a folded space and into the world: the inventory if it fits, held if not.
    const at = world.objects.findIndex(object => object.id === thing.id);
    const out = world.objects[at]!;
    const lands = whereItWouldGo(
        together(whatAllOfThatTakes(everythingInThePouch(game.db, cultivator.id)),
            whatTheirThingsTake(world.objects.filter(object => object.id !== out.id), cultivator.id)),
        out, whatABodyCanCarry(cultivator.realmOrdinal), howManyHeld(world.objects, cultivator.id));
    if (lands === 'held') world.objects[at] = hadAs(out, 'held');
    if (lands === 'too_heavy' || lands === 'hands_full') {
        world.objects[at] = { ...out, possessorId: null, locationId: game.worldPlaceOf(cultivator) ?? out.locationId };
    }
    game.theWorldMoved();
    const line = lands === 'inventory'
        ? `${thing.name} is out of ${ring.name} and in your pack.`
        : lands === 'held'
            ? `${thing.name} is out of ${ring.name} and in your hand: it will not go in your pack.`
            : `${thing.name} comes out of ${ring.name} onto the ground at your feet: you cannot carry it.`;
    return done('engine.ring', line, `carry/retrieve: ${thing.id} out of ${ring.id}, landed ${lands}.`);
}

/** The inventory's lines for somebody's rings: what is in the ones they can reach, and why not the rest. */
export function theLinesForTheirRings(objects: readonly ObjectRecord[], personId: string): string[] {
    return objects.filter(object => object.possessorId === personId && isAStorageRing(object)).map(ring => {
        if (!canReachInto(ring, personId)) return whyItWillNotOpen(ring, personId);
        const inside = whatIsInTheRing(objects, ring.id);
        const { holds, taken } = howFullTheRingIs(objects, ring);
        return inside.length === 0
            ? `In ${ring.name}: nothing (${holds} litres of room).`
            : `In ${ring.name}: ${inside.map(object => object.name).join(', ')} (${taken} of ${holds} litres).`;
    });
}
