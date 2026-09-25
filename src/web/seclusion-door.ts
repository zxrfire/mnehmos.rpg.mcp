/**
 * The door a sitter shuts on a sealed seclusion, and reinforcing it with beast parts.
 *
 * Which door it is follows whose ground it is (`door-materials.ts` holds the
 * materials and their rungs): the room the sitter's own house gives them at their
 * rank, a place that is theirs - a residence, or ground no house holds - or, in a
 * settlement or somebody else's compound, a room they are let. Only the second
 * is theirs to improve, and they improve it themselves: every sitter is an
 * artisan, the part and their own hands decide how far, and the result is a
 * record on the place.
 */

import { getBeast, getBeastMaterial } from '../data/cultivation/beasts.js';
import { forStream } from '../engine/cultivation/rng.js';
import { rankName } from '../engine/cultivation/realms.js';
import {
    aDoorReinforcedWith,
    aHouseRoomDoor,
    anInnDoor,
    whatThePartCouldMakeOfIt,
    yourOwnDoor,
    type ADoorOnRecord,
    type TheDoor
} from '../engine/world/door-materials.js';
import { whoHoldsTheGround } from '../engine/world/ground-holder.js';
import { residenceOf } from '../engine/world/somewhere-that-is-theirs.js';
import { theQuartersOf } from '../engine/world/the-room-a-house-gives-you.js';
import { getLocation, indexById } from '../engine/world/world-state.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { removeFromPouch } from '../server/consolidated/cultivation-support.js';
import { matchScore } from './entities.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import { positionIn } from './standing.js';
import { refused } from './tool-result-prose.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

/**
 * The door this cultivator would shut, sitting where they stand.
 */
export function theDoorYouSitBehind(service: GameService, cultivator: Cultivator): TheDoor {
    const world = service.atHand;
    const placeId = service.worldPlaceOf(cultivator);
    const here = world && placeId ? getLocation(world, placeId) : null;
    if (!world || !here) return anInnDoor();

    const position = positionIn(service.repos, cultivator.id);
    const ground = whoHoldsTheGround(world.locations, here.id);
    const atHome = position !== null && ground.holding === 'held'
        && ground.holderFactionId === position.sectId;
    if (atHome) {
        const quarters = theQuartersOf(world, {
            factionId: position.sectId,
            personId: cultivator.id,
            rankIndex: position.rankIndex,
            stipendAtRung: 0,
            stipendAtEntry: 0
        });
        return quarters ? aHouseRoomDoor(quarters) : anInnDoor();
    }
    if (residenceOf(world, cultivator.id)?.id === here.id) return yourOwnDoor(here);
    if (here.kind === 'settlement' || here.controllingFactionId) return anInnDoor();
    return yourOwnDoor(here);
}

/** Whether a sentence given to `craft` is about reinforcing a door. */
export const REINFORCING_A_DOOR = /\bdoor\b/i;

/** The beast part a sentence names, among the parts in the pouch. */
function thePartTheyNamed(
    service: GameService,
    cultivator: Cultivator,
    said: string
): { parts: { itemId: string; name: string; rung: number }[]; named: { itemId: string; name: string; rung: number } | null } {
    const rows = service.db
        .prepare('SELECT item_id FROM cultivator_pouch WHERE holder_id = ? AND quantity > 0')
        .all(cultivator.id) as { item_id: string }[];
    const parts = rows.flatMap(row => {
        const material = getBeastMaterial(row.item_id);
        if (!material) return [];
        const rung = getBeast(material.sourceBeastId)?.ordinal ?? material.harvestOrdinal;
        return [{ itemId: material.id, name: material.name, rung }];
    });
    const withWhat = /\bwith\s+(.+)$/i.exec(said)?.[1] ?? '';
    let named: (typeof parts)[number] | null = null;
    let best = 0;
    for (const part of parts) {
        const score = withWhat ? matchScore(withWhat, part.name) : 0;
        if (score >= 60 && score > best) {
            best = score;
            named = part;
        }
    }
    return { parts, named };
}

/**
 * "I reinforce the cave door with the Ironhide Plate", which `craft` hands here.
 */
export function reinforcingYourDoor(
    service: GameService,
    run: Run,
    cultivator: Cultivator,
    said: string
): Execution {
    const world = service.atHand;
    const placeId = service.worldPlaceOf(cultivator);
    const door = theDoorYouSitBehind(service, cultivator);

    if (door.whose !== 'yours' || !world || !placeId) {
        const whose = door.whose === 'the_house'
            ? `This is ${door.name}, and it is the house's: the room comes with your rank, and a `
              + 'higher rank is given a better room.'
            : `This is ${door.name}, and it is the inn's, not yours to rebuild. A door of your own `
              + 'is one on a cave, a residence, or ground no house holds.';
        return refused('engine.reinforceADoor', 'craft', factsForRefusal(
            'It is not your door to reinforce.', whose,
            `Door here: ${door.material}, standing at ${door.standsAt}, whose=${door.whose}.`
        ));
    }

    const { parts, named } = thePartTheyNamed(service, cultivator, said);
    if (named === null) {
        const carried = parts.length === 0
            ? 'You are carrying no beast parts. What a hunt brings back is what a door is reinforced with.'
            : `Name the part to work into it. You are carrying ${parts.map(p => p.name).join(', ')}.`;
        return refused('engine.reinforceADoor', 'craft', factsForRefusal(
            'Reinforce it with what?', carried,
            `Beast parts in the pouch: ${parts.length}. None was named.`
        ));
    }

    const best = whatThePartCouldMakeOfIt(named.rung, cultivator.realmOrdinal);
    if (best <= door.standsAt) {
        return refused('engine.reinforceADoor', 'craft', factsForRefusal(
            `${named.name} would add nothing to this door.`,
            `${door.name} already holds against anybody below ${rankName(door.standsAt)}, and `
            + `${named.name} worked by your hands comes to no more than that.`,
            `Door stands at ${door.standsAt}; the part (${named.rung}) in hands at `
            + `${cultivator.realmOrdinal} reaches ${best}. Nothing spent.`
        ));
    }

    const today = Math.floor(run.elapsedDays);
    const mastery = 0.5 + 0.5 * forStream(run.seed, 'door-reinforcing', cultivator.id, today, named.itemId).next();
    const worked = aDoorReinforcedWith({
        doorStandsAt: door.standsAt,
        partRung: named.rung,
        handRung: cultivator.realmOrdinal,
        mastery
    });
    removeFromPouch(service.db, cultivator.id, named.itemId, 1);

    const at = indexById(world.locations, placeId);
    const location = world.locations[at]!;
    const record: ADoorOnRecord = {
        doorStandsAt: worked.standsAt,
        doorReinforcedWith: named.itemId,
        doorReinforcedOnDay: Math.floor(world.currentDay)
    };
    world.locations[at] = { ...location, data: { ...location.data, ...record } };
    service.theWorldMoved();

    const line = `You work the ${named.name} into the door yourself. It held against anybody `
        + `below ${rankName(door.standsAt)}; it now holds against anybody below `
        + `${rankName(worked.standsAt)}.`;
    const facts = factsForToolResult('The door is reinforced.', [line]);
    facts.required = [line];
    facts.structure.push(
        `Door at ${location.id}: ${door.standsAt} -> ${worked.standsAt}. Part ${named.itemId} at `
        + `${named.rung}, hands at ${cultivator.realmOrdinal}, lower of the two ${worked.theLowerOfTheTwo} `
        + `(${worked.limitedBy}); the work went ${Math.round(mastery * 100)}% and cost `
        + `${worked.rungsTheWorkCost} rung(s). One ${named.itemId} spent.`
    );
    return service.freeAction(run, 'craft', facts);
}
