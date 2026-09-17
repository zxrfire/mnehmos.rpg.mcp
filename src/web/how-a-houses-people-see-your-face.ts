/**
 * How the people of one house, here, read the player's face.
 *
 * The half of `how-a-house-reads-a-face.ts` that needs the stores: whether each
 * witness has dealt with the player (a tie, or an account open between them),
 * whether the player is in the house's robes, how big the house really is, who
 * is strongest in it, and whether the ground is having a bad year. Asked by the
 * lecture hall (`a-teacher-giving-you-their-attention.ts`) and by the gate
 * (`walking-up-to-a-house.ts`), so the two read one face one way.
 */

import {
    aFaceAsOneOfTheHouseSeesIt,
    howManyAHouseReallyHas,
    type AFaceBeingLookedAt
} from '../engine/social/how-a-house-reads-a-face.js';
import { theGroundUnderYou } from '../engine/social-leverage/ground-trust.js';
import { wearsTheRobesOf } from '../engine/world/a-recruit-is-given-their-lamp-at-the-house.js';
import { whoHoldsTheGround } from '../engine/world/ground-holder.js';
import { statusesInArea } from '../engine/world/what-is-true-of-a-place-right-now.js';
import type { Cultivator } from '../schema/cultivation.js';
import { openLedgerBetween, tieFrom } from './encounters.js';
import type { GameService } from './turn-engine.js';

export interface AWitness {
    id: string;
    name: string;
    realmOrdinal: number;
}

/** Each witness and the face as they see it. Empty where there is no world. */
export function howTheirPeopleSeeYourFace<W extends AWitness>(
    game: GameService,
    cultivator: Cultivator,
    input: {
        houseId: string;
        witnesses: readonly W[];
        /** A concealment the sentence declared, where there was a sentence. */
        keepingItToThemselves: boolean;
    }
): { witness: W; face: AFaceBeingLookedAt }[] {
    const world = game.atHand;
    if (!world || input.witnesses.length === 0) return [];

    const today = Math.floor(world.currentDay);
    const placeId = game.worldPlaceOf(cultivator);
    const ground = theGroundUnderYou(
        whoHoldsTheGround(world.locations, placeId),
        statusesInArea(world.statuses, world.locations, placeId ?? '', today)
    );
    const inTheRobes = wearsTheRobesOf(world.objects, cultivator.id, input.houseId);
    const houseSize = howManyAHouseReallyHas(world, input.houseId);
    const strongestOfTheHouse = world.npcs
        .filter(npc => npc.status === 'alive' && npc.factionId === input.houseId)
        .reduce<number | null>(
            (top, npc) => top === null || npc.cultivation.realmOrdinal > top ? npc.cultivation.realmOrdinal : top,
            null
        );

    return input.witnesses.map(witness => ({
        witness,
        face: aFaceAsOneOfTheHouseSeesIt({
            witnessOrdinal: witness.realmOrdinal,
            theirOrdinal: cultivator.realmOrdinal,
            knowsThem: tieFrom(game.repos, witness.id, cultivator.id) !== null
                || openLedgerBetween(game.repos, cultivator.id, witness.id).length > 0,
            keepingItToThemselves: input.keepingItToThemselves,
            inTheRobes,
            strongestOfTheHouse,
            houseSize,
            groundUnderDuress: ground.underDuress
        })
    }));
}
