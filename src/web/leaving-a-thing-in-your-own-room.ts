/**
 * The `stow` verb: putting a thing in the room a house gave you, and getting
 * it back.
 *
 * The rule lives in `the-room-a-house-gives-you.ts`. This file is the doorway:
 * it reads the roll, asks the compound which room that rung gets, and moves
 * rows between two holders of one store.
 *
 * WHAT WAS MISSING WAS THE DOORWAY, AND IT WAS MISSING TWICE OVER.
 * `whereTheyKeepTheirThings` has handed out a holder key for a residence since
 * the residence layer was written, and had NO caller in `src/web` or
 * `src/server` at all - so no sentence a player could type ever put anything
 * anywhere. And below the Lid nobody had a residence in the first place, which
 * is the half `the-room-a-house-gives-you.ts` closes.
 *
 * THE ROOM DOES NOT COME TO YOU. Leaving and collecting both want the house's
 * ground under your feet, because the alternative is a pouch with a longer
 * reach than a body. Travelling away is what the room is FOR: the rows stay in
 * SQLite under a key derived from the house and the person, so a decade on the
 * road and a reload both leave them exactly where they were put.
 *
 * NOT DONE, AND WRITTEN DOWN RATHER THAN LICENSED: this verb reaches the room a
 * HOUSE gives you and not the ground somebody cut for themselves.
 * `whereTheyKeepTheirThings` still hands out a holder key for a settled abode
 * and still has no sentence that reaches it, so a rogue with an abode has a
 * pack nothing can open. What stops it being three lines is the capacity: a
 * house states, per rung, what it will spend on somebody, and nobody states
 * what a cave you cut yourself holds. Answer that and this verb takes the
 * residence on the same footing.
 */

import type { Cultivator, Run } from '../schema/cultivation.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import { refused } from './tool-result-prose.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';
import { positionIn } from './standing.js';
import { countedHoldings, whichHoldingTheyNamed } from './breaking-a-thing-you-are-holding.js';
import { addToPouch, removeFromPouch } from '../server/consolidated/cultivation-support.js';
import {
    theQuartersOf,
    type Quarters
} from '../engine/world/the-room-a-house-gives-you.js';
import {
    whatABodyCanCarry,
    whatAllOfThatTakes,
    whatStopsThemCarryingIt
} from '../engine/world/what-a-body-can-carry-and-what-a-ring-holds.js';
import type { WorldState } from '../engine/world/world-state.js';

/** Which way a thing is going. A room read from both ends is still one room. */
export type StowIntent = 'leave' | 'collect' | 'look';

/**
 * What the quarters read needs off the run, resolved in one place.
 *
 * Exported because `move` answers "I go home" out of the same two facts and a
 * second resolution of them would be a second opinion about where somebody
 * lives.
 */
export function theQuartersThisCultivatorHas(
    game: GameService,
    world: WorldState,
    cultivator: Cultivator
): {
    quarters: Quarters;
    factionId: string;
    houseName: string;
    rankTitle: string;
    stipend: number;
} | null {
    const position = positionIn(game.repos, cultivator.id);
    if (!position) return null;
    const stipend = game.repos.sects.stipendForRank(position.sectId, position.rankIndex);
    const quarters = theQuartersOf(world, {
        factionId: position.sectId,
        personId: cultivator.id,
        rankIndex: position.rankIndex,
        stipendAtRung: stipend,
        stipendAtEntry: game.repos.sects.stipendForRank(position.sectId, 0)
    });
    if (!quarters) return null;
    return {
        quarters,
        factionId: position.sectId,
        houseName: position.sectName,
        rankTitle: position.rankTitle,
        stipend
    };
}

/**
 * Whether the house's ground is under them.
 *
 * `controllingFactionId` is on the seat and on everything built inside it, so
 * the walk up the parent chain is one hop in practice and costs nothing when
 * the player is standing somewhere else entirely.
 */
function standingOnTheirHousesGround(
    world: WorldState,
    placeId: string | null,
    factionId: string
): boolean {
    let at = placeId ? world.locations.find(row => row.id === placeId) ?? null : null;
    const seen = new Set<string>();
    while (at && !seen.has(at.id)) {
        if (at.controllingFactionId === factionId) return true;
        seen.add(at.id);
        at = at.parentId ? world.locations.find(row => row.id === at!.parentId) ?? null : null;
    }
    return false;
}

/** What is in the room, as a sentence, or a plain statement that it is empty. */
function whatIsInThere(game: GameService, quarters: Quarters): string {
    const held = countedHoldings(game.db, quarters.holderId);
    if (held.length === 0) return 'There is nothing in it.';
    return held
        .map(row => (row.quantity > 1 ? `${row.name} (${row.quantity})` : row.name))
        .join(', ');
}

/** Litres left, after what is already in there. */
function roomLeftIn(game: GameService, quarters: Quarters): number {
    const load = whatAllOfThatTakes(countedHoldings(game.db, quarters.holderId));
    return Math.max(0, Math.round((quarters.room - load.volume) * 100) / 100);
}

/** How good the room is, said the way somebody living in it would say it. */
function whatTheRoomIsLike(quarters: Quarters): string {
    return quarters.shareWith > 0
        ? `${quarters.name}, which you share with ${quarters.shareWith} others.`
        : `${quarters.name}, which is yours alone.`;
}

export const stowVerbs = {
    /**
     * Leave a thing in your room, take one back, or look at what is in there.
     *
     * Free of the clock: crossing your own floor is not a span of days, and
     * the journey that got you to the house already cost what it cost.
     */
    async stow(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        intent: StowIntent | undefined,
        target: string | undefined
    ): Promise<Execution> {
        const said = (target ?? '').trim();
        const which: StowIntent = intent ?? (said.length > 0 ? 'leave' : 'look');

        this.atHand = this.atHand ?? await this.loadWorld();
        const world = this.atHand;
        if (!world) {
            return refused('engine.noWorld', 'stow', factsForRefusal(
                'No compound to have a room in.',
                'The house you belong to is a name on a roll and not a place with walls in it, '
                + 'so there is nowhere in it to put anything down.',
                'stow: the world layer is not running, so no compound exists and no quarters '
                + 'can be read off one. Nothing moved.'
            ));
        }

        const mine = theQuartersThisCultivatorHas(this, world, cultivator);
        if (!mine) {
            // NOT ON A ROLL IS A CONDITION, NOT A MISREAD. A rogue has nowhere
            // to put anything and that is the ordinary state of a rogue; the
            // refusal says what would change it rather than pretending the
            // sentence was unreadable.
            return refused('engine.noQuarters', 'stow', factsForRefusal(
                'Nobody has given you a room.',
                'You are on nobody\'s roll. A house quarters its own and the room comes with '
                + 'the rung, so what you are carrying is what you have, and it stays on your '
                + 'back until somebody takes you in or you cut ground of your own.',
                `stow: no membership for ${cultivator.id}, or the house lodges nobody. Quarters `
                + 'are read off the roll and the compound; neither answered. Nothing moved.'
            ));
        }
        const { quarters, factionId, houseName, rankTitle, stipend } = mine;

        if (which === 'look') {
            const facts = factsForToolResult(`${quarters.name}.`, [
                whatTheRoomIsLike(quarters),
                whatIsInThere(this, quarters),
                `It holds ${quarters.room} litres and ${roomLeftIn(this, quarters)} of that is `
                + 'still free.'
            ]);
            facts.structure.push(
                `quarters ${quarters.locationId} (${quarters.purpose}, precinct `
                + `${quarters.precinctIndex}, ${houseName} ${rankTitle}); holder `
                + `${quarters.holderId}; ${quarters.room}L off a stipend of ${stipend} stones a `
                + `month; ${quarters.shareWith} others quartered there.`
            );
            return this.freeAction(run, 'stow', facts);
        }

        const here = this.worldPlaceOf(cultivator);
        if (!standingOnTheirHousesGround(world, here, factionId)) {
            return refused('engine.notAtYourHouse', 'stow', factsForRefusal(
                'Your room is not here.',
                `${whatTheRoomIsLike(quarters)} It is at ${houseName}, and a room does not `
                + 'reach across a province. Go there, and what you left in it will be where '
                + 'you left it.',
                `stow: standing at ${here ?? 'nowhere the world holds'}, which is not ground `
                + `${factionId} controls. Quarters are at ${quarters.locationId}. Nothing moved.`
            ));
        }

        const onTheBody = countedHoldings(this.db, cultivator.id);
        const inTheRoom = countedHoldings(this.db, quarters.holderId);
        const from = which === 'leave' ? onTheBody : inTheRoom;

        if (said.length < 2) {
            return refused('engine.nothingNamed', 'stow', factsForRefusal(
                'Nothing named.',
                from.length > 0
                    ? `You have not said which: ${from.map(row => row.name).join(', ')}.`
                    : which === 'leave'
                        ? 'You are carrying nothing to put down.'
                        : `${whatTheRoomIsLike(quarters)} There is nothing in it to take.`,
                `stow/${which} with no target. Available: `
                + `${from.map(row => row.itemId).join(', ') || 'nothing'}.`
            ));
        }

        const lot = whichHoldingTheyNamed(from, said);
        if (!lot) {
            return refused('engine.nothingCalledThat', 'stow', factsForRefusal(
                `Nothing called ${said}.`,
                which === 'leave'
                    ? `You are not carrying anything by that name.${from.length > 0
                        ? ` What you have on you: ${from.map(row => row.name).join(', ')}.`
                        : ' You are carrying nothing.'}`
                    : `${whatTheRoomIsLike(quarters)} ${whatIsInThere(this, quarters)}`,
                `stow/${which}: "${said}" matched nothing in `
                + `${which === 'leave' ? 'the pouch' : quarters.holderId}. Nothing moved.`
            ));
        }

        const to = which === 'leave' ? quarters.holderId : cultivator.id;
        const fromHolder = which === 'leave' ? cultivator.id : quarters.holderId;

        // ── AND THE THING HAS TO FIT WHERE IT IS GOING ───────────────────
        //
        // Both directions, and both read the same pair of functions the pouch
        // reads. A room is bounded by volume and not by weight - the floor
        // holds whatever is put on it - so the weight limit going into a room
        // is deliberately not a limit at all, and `whatStopsThemCarryingIt`
        // then reports the only one that can bind.
        const load = whatAllOfThatTakes([{ kind: lot.kind, quantity: 1 }]);
        const already = whatAllOfThatTakes(countedHoldings(this.db, to));
        const capacity = which === 'leave'
            ? { volume: quarters.room, weight: Number.MAX_SAFE_INTEGER }
            : whatABodyCanCarry(cultivator.realmOrdinal);
        const stopped = whatStopsThemCarryingIt(
            { volume: already.volume + load.volume, weight: already.weight + load.weight },
            capacity
        );
        if (stopped !== null) {
            return refused('engine.willNotFit', 'stow', factsForRefusal(
                which === 'leave' ? 'The room is full.' : 'You cannot carry it.',
                which === 'leave'
                    ? `${quarters.name} holds ${quarters.room} litres at your rung and there is `
                      + `${roomLeftIn(this, quarters)} of it left. A better rung is a bigger `
                      + 'room, and that is most of what a rung is for.'
                    : stopped === 'too_heavy'
                        ? `${lot.name} is more than this body will carry on top of what is `
                          + 'already on it.'
                        : `There is no room on you for ${lot.name} until something comes off.`,
                `stow/${which}: ${stopped} moving ${lot.itemId}. Capacity `
                + `${Math.round(capacity.volume)}L, load ${already.volume + load.volume}L.`
            ));
        }

        if (!removeFromPouch(this.db, fromHolder, lot.itemId, 1)) {
            return refused('engine.notThereAnyMore', 'stow', factsForRefusal(
                `${lot.name} is not there.`,
                'What you reached for is not where you thought it was.',
                `stow/${which}: ${lot.itemId} was short at ${fromHolder}. Nothing moved.`
            ));
        }
        addToPouch(this.db, to, lot.itemId, lot.kind, 1);

        const facts = factsForToolResult(
            which === 'leave' ? `${lot.name}: left in your room.` : `${lot.name}: taken back.`,
            which === 'leave'
                ? [
                    `${lot.name} goes into ${whatTheRoomIsLike(quarters)}`,
                    `It will be there when you come back. Room left: ${roomLeftIn(this, quarters)} `
                    + `litres of ${quarters.room}.`
                ]
                : [`${lot.name} comes off the shelf and onto you.`]
        );
        facts.structure.push(
            `stow/${which}: ${lot.itemId} x1 ${fromHolder} -> ${to}. Quarters `
            + `${quarters.locationId} at ${quarters.room}L; ${quarters.shareWith} others `
            + 'quartered there.'
        );
        return this.freeAction(run, 'stow', facts);
    }
};
