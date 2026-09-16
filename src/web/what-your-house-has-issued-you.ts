/**
 * What the player's house has issued them, settled after every turn.
 *
 * The player joins a house the way anybody does - where they stand - and is
 * given nothing for it until they are at its seat: robes, and a token with a
 * plate on the wall where their rung carries one. Leaving hands both back.
 *
 * ── THE SAME RULES AS EVERYBODY ELSE ─────────────────────────────────────
 *
 * `whatTheHouseGivesThem` in `a-recruit-is-given-their-plate-at-the-house.ts`
 * is the one answer, asked by the world's yearly pass for its own people and
 * here for the player. The robes and the token are the world's own rows with the
 * player's id as possessor - the form every tracked thing the player carries
 * already takes (`whatYouAreCarrying` reads them) - so a gate, a look and an
 * estate read the player's exactly as they read anybody's.
 *
 * ── WHY AFTER EVERY TURN AND NOT AT EACH VERB ────────────────────────────
 *
 * Being at the seat and being on the roll are both facts a dozen verbs change:
 * four ways of arriving, joining, being promoted, leaving, being expelled,
 * being recalled, a house's room handing down a sentence. Hooking each would
 * be a list somebody forgets to extend. So this is a reading of the two facts as
 * they stand when the turn is over, which covers every one of them and the next
 * one added, and costs a pass over the world's objects.
 *
 * Measured before this existed: `issueTo` had no caller on the played side at
 * all, so no player had ever carried a token or had a plate hung for them, and
 * `sect_manage` joined a player to a house from anywhere without either.
 */

import {
    thisHouseCanIssue
} from '../engine/world/a-house-knows-its-own-by-a-plate-and-a-token.js';
import {
    handBackWhatTheyNoLongerBelongTo,
    holdsTheTokenOf,
    isInsideTheCompound,
    theKeeperOfTheRollIn,
    wearsTheRobesOf,
    whatTheHouseGivesThem,
    whereThisHouseHangsItsPlates
} from '../engine/world/a-recruit-is-given-their-plate-at-the-house.js';
import { upsertObject } from '../engine/world/world-state.js';
import type { Cultivator } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';
import { rankIndexOf } from './walking-up-to-a-house.js';

export interface WhatYourHouseIssued {
    /** Facts for the player. What changed hands, and nothing else. */
    lines: string[];
    /** Inspector only. */
    structure: string;
}

/**
 * Hand back what a house they have left issued them, and enter them on their
 * house's roll if they are standing in its compound. Null where nothing changed.
 */
export function settleWhatYourHouseHasIssuedYou(
    game: GameService,
    cultivator: Cultivator
): WhatYourHouseIssued | null {
    const world = game.atHand;
    if (!world || !cultivator.alive) return null;

    const membership = game.repos.sects.getMembership(cultivator.id);
    const houseId = membership?.sectId ?? null;
    const lines: string[] = [];
    const structure: string[] = [];

    // ── LEAVING MEANS HANDING IT BACK ────────────────────────────────────
    const leaving = world.objects.filter(o =>
        o.possessorId === cultivator.id
        && o.tags.includes('issued')
        && o.data?.memberId === cultivator.id
        && o.ownerId !== houseId);
    if (handBackWhatTheyNoLongerBelongTo(world.objects, id => (id === cultivator.id ? houseId : undefined)) > 0) {
        const byHouse = new Map<string, string[]>();
        for (const row of leaving) {
            const names = byHouse.get(row.ownerName) ?? [];
            names.push(row.tags.includes('uniform') ? 'its robes' : 'its token');
            byHouse.set(row.ownerName, names);
        }
        for (const [name, what] of byHouse) {
            lines.push(`You are not on the roll of ${name} any more, and ${what.join(' and ')} `
                + `went back to it.`);
        }
        structure.push(`handBackWhatTheyNoLongerBelongTo: ${leaving.map(o => o.id).join(', ')}.`);
    }

    // ── AND ENTERED, AT THE HOUSE ────────────────────────────────────────
    const house = houseId === null
        ? null
        : world.factions.find(f => f.id === houseId && f.dissolvedOnDay === null) ?? null;
    const seat = house?.seatLocationId ?? null;
    const here = game.worldPlaceOf(cultivator);
    const byId = new Map(world.locations.map(l => [l.id, l]));
    if (house && seat && here && isInsideTheCompound(byId, here, seat)) {
        const roll = world.npcs.filter(n => n.status === 'alive' && n.factionId === house.id);
        const plateRoomId = whereThisHouseHangsItsPlates(world.locations, house.id) ?? seat;
        const given = whatTheHouseGivesThem({
            house,
            person: {
                id: cultivator.id,
                name: cultivator.name,
                rankIndex: rankIndexOf(game, cultivator.id, house.ranks.length)
            },
            wearsItsRobes: wearsTheRobesOf(world.objects, cultivator.id, house.id),
            holdsItsToken: holdsTheTokenOf(world.objects, cultivator.id, house.id),
            canCut: thisHouseCanIssue(roll.map(n => n.cultivation.realmOrdinal)),
            plateRoomId,
            keeperOfTheRoll: () => theKeeperOfTheRollIn(
                world.locations, house, roll.map(n => ({ id: n.id, rankIndex: n.factionRankIndex }))
            ),
            onDay: Math.floor(world.currentDay)
        });
        if (given.robes) {
            Object.assign(world, upsertObject(world, given.robes));
            lines.push(`Entered on the roll of ${house.name} at its seat: robes with the house's `
                + 'mark on them are yours to wear.');
            structure.push(`whatTheHouseGivesThem: robes ${given.robes.id}.`);
        }
        if (given.token && given.plate) {
            Object.assign(world, upsertObject(world, given.token));
            Object.assign(world, upsertObject(world, given.plate));
            const hall = byId.get(plateRoomId)?.name ?? 'the hall';
            lines.push(`A jade token with ${house.name} cut into it is yours, and a plate for you `
                + `hangs in ${hall}. A gate that asks for a token will read it.`);
            structure.push(`whatTheHouseGivesThem: token ${given.token.id}, plate ${given.plate.id} `
                + `in ${plateRoomId}, cut by ${String(given.token.data.cutById ?? 'nobody holding the roll room')}.`);
        }
    }

    if (lines.length === 0) return null;
    game.theWorldMoved();
    return { lines, structure: structure.join(' ') };
}
