/**
 * What the player's house has issued them, settled after every turn.
 *
 * The player joins a house the way anybody does - where they stand - and is
 * given nothing for it until they are at its seat: robes, and a token with a
 * lamp lit for them where their rung carries one. Leaving hands both back, and
 * the house's communication talismans break with the token: they are keyed to
 * the player, so both halves of every pair marked with a house they are no longer
 * of break (`theirSlipsBreak`).
 *
 * ── THE SAME RULES AS EVERYBODY ELSE ─────────────────────────────────────
 *
 * `whatTheHouseGivesThem` in `a-recruit-is-given-their-lamp-at-the-house.ts`
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
 * all, so no player had ever carried a token or had a lamp lit for them, and
 * `sect_manage` joined a player to a house from anywhere without either.
 */

import {
    thisHouseCanIssue
} from '../engine/world/a-house-knows-its-own-by-a-lamp-and-a-token.js';
import {
    handBackWhatTheyNoLongerBelongTo,
    holdsTheTokenOf,
    isInsideTheCompound,
    theInternalAffairsElderIn,
    wearsTheRobesOf,
    whatTheHouseGivesThem,
    whereThisHouseBurnsItsLamps
} from '../engine/world/a-recruit-is-given-their-lamp-at-the-house.js';
import { theyAreEntered } from '../engine/world/a-house-expects-somebody-it-took-on.js';
import { theirSlipsBreak } from '../engine/world/a-communication-talisman-carries-word-home.js';
import { removeFromPouch } from '../server/consolidated/cultivation-support.js';
import {
    pouchIdForCommunicationTalismans,
    theCommunicationTalismansOnYou
} from './sending-word-on-a-communication-talisman.js';
import { upsertObject } from '../engine/world/world-state.js';
import type { Cultivator } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';
import { rankIndexOf, theHouseTakesYourWord } from './walking-up-to-a-house.js';

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
    for (const slips of theCommunicationTalismansOnYou(game.db, cultivator.id)) {
        if (slips.houseId === houseId) continue;
        if (!removeFromPouch(game.db, cultivator.id, pouchIdForCommunicationTalismans(slips.houseId), slips.count)) continue;
        theirSlipsBreak(world.objects, cultivator.id, slips.houseId);
        const name = world.factions.find(f => f.id === slips.houseId)?.name ?? 'a house that has ended';
        lines.push(`${slips.count} communication talisman${slips.count === 1 ? '' : 's'} marked with ${name} `
            + 'broke with its token: they were keyed to you as one of it.');
        structure.push(`communication talismans broken on leaving: ${slips.count} marked ${slips.houseId}.`);
    }

    // ── AND ENTERED, AT THE HOUSE ────────────────────────────────────────
    const house = houseId === null
        ? null
        : world.factions.find(f => f.id === houseId && f.dissolvedOnDay === null) ?? null;
    const seat = house?.seatLocationId ?? null;
    const here = game.worldPlaceOf(cultivator);
    const byId = new Map(world.locations.map(l => [l.id, l]));
    // NEVER ENTERED IS ENTERED ON THE HOUSE'S WORD, as it is for everybody in
    // the yearly pass: robed already, or let in on what the house makes of
    // them, which is what the gate reads too. See `theHouseTakesYourWord`.
    const robedAlready = house !== null && wearsTheRobesOf(world.objects, cultivator.id, house.id);
    if (house && seat && here && isInsideTheCompound(byId, here, seat)
        && (robedAlready || theHouseTakesYourWord(game, cultivator, house))) {
        const roll = world.npcs.filter(n => n.status === 'alive' && n.factionId === house.id);
        const lampRoomId = whereThisHouseBurnsItsLamps(world.locations, house.id) ?? seat;
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
            lampRoomId,
            internalAffairsElder: () => theInternalAffairsElderIn(
                world.locations, house, roll.map(n => ({ id: n.id, rankIndex: n.factionRankIndex }))
            ),
            onDay: Math.floor(world.currentDay)
        });
        if (given.robes) {
            Object.assign(world, upsertObject(world, given.robes));
            theyAreEntered(world, house.id, cultivator.id);
            lines.push(`Entered on the roll of ${house.name} at its seat: robes with the house's `
                + 'mark on them are yours to wear.');
            structure.push(`whatTheHouseGivesThem: robes ${given.robes.id}.`);
        }
        if (given.token && given.lamp) {
            Object.assign(world, upsertObject(world, given.token));
            Object.assign(world, upsertObject(world, given.lamp));
            const hall = byId.get(lampRoomId)?.name ?? 'the hall';
            lines.push(`A jade token with ${house.name} cut into it is yours, and a lamp for you `
                + `burns in ${hall}. A gate that asks for a token will read it.`);
            structure.push(`whatTheHouseGivesThem: token ${given.token.id}, lamp ${given.lamp.id} `
                + `in ${lampRoomId}, cut by ${String(given.token.data.cutById ?? 'nobody holding the roll room')}.`);
        }
    }

    if (lines.length === 0) return null;
    game.theWorldMoved();
    return { lines, structure: structure.join(' ') };
}
