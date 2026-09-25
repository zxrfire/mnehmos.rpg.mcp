/**
 * Who stands behind a counter here - the inn, the landing, the carriage station - read off the people already in the place.
 *
 * Nobody is seeded for it. A counter is kept by somebody standing in the place,
 * the way a hall's staff is read off the roll in `who-works-in-an-elders-hall.ts`:
 * whoever is here at `trade` first, then the lowest rung, with ties settled on a
 * stream of the counter's own so nothing else shifts. A counter in a place with
 * nobody in it is kept by nobody the player can name.
 */

import { forStream } from '../engine/cultivation/rng.js';
import type { Cultivator } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';

export type ACounter = 'inn' | 'landing' | 'carriage_station';

/** The words a player calls the keeper of each counter by. */
const WHAT_THEY_ARE_CALLED: Readonly<Record<ACounter, RegExp>> = {
    inn: /\b(?:inn-?keepers?|landlord|landlady|host of the inn|keeper of the inn)\b/i,
    landing: /\b(?:boatman|boatmen|ferryman|ferrymen|landing clerk|harbour ?master|shipmaster)\b/i,
    carriage_station: /\b(?:carters?|coachman|coachmen|drivers?|station clerk|carriage clerk)\b/i
};

/** A clerk with no counter named is whichever ticket counter this place has. */
const A_TICKET_CLERK = /\b(?:ticket[- ]?clerks?|clerks?|ticket[- ]?sellers?|booth ?keepers?)\b/i;

export interface AKeeper {
    id: string;
    name: string;
}

/** The order counters are kept in, so one person keeps one counter where there are people enough. */
const IN_THIS_ORDER: readonly ACounter[] = ['inn', 'landing', 'carriage_station'];

/**
 * The person keeping this counter here, or null where nobody is standing in the place.
 *
 * `countersHere` is every counter the place keeps: each is dealt a keeper in
 * {@link IN_THIS_ORDER}, passing over whoever already keeps one, so the inn and
 * the station are two people wherever two people are standing.
 */
export function whoKeepsTheCounter(
    game: GameService,
    cultivator: Cultivator,
    counter: ACounter,
    countersHere: readonly ACounter[]
): AKeeper | null {
    const place = (cultivator.location ?? '').trim().toLowerCase();
    const seed = game.atHand?.seed ?? 'no-world';
    const atTrade = new Set(
        (game.atHand?.npcs ?? []).filter(npc => npc.activity?.kind === 'trade').map(npc => npc.id)
    );
    const here = game.present(cultivator);
    const taken = new Set<string>();
    for (const each of IN_THIS_ORDER.filter(one => one === counter || countersHere.includes(one))) {
        const ranked = here
            .filter(row => !taken.has(row.id))
            .map(row => ({
                row,
                trading: atTrade.has(row.id) ? 0 : 1,
                tie: forStream(seed, 'who-keeps-the-counter', each, place, row.id).next()
            }))
            .sort((a, b) => a.trading - b.trading
                || a.row.realmOrdinal - b.row.realmOrdinal
                || a.tie - b.tie);
        const kept = ranked[0]?.row;
        if (each === counter) return kept ? { id: kept.id, name: kept.name } : null;
        if (kept) taken.add(kept.id);
    }
    return null;
}

/** What each counter's keeper is called by somebody who has no name for them. */
const THE_KEEPER_UNNAMED: Readonly<Record<ACounter, string>> = {
    inn: 'the innkeeper',
    landing: 'the landing clerk',
    carriage_station: 'the station clerk'
};

/**
 * The keeper as the player can say them: by name only when the player has one.
 * Played: the engine printed a stranger's name for the innkeeper, beside a census
 * saying nobody here could be named, and the narrator went on naming strangers.
 */
export function theKeeperAsTheyAreKnown(
    game: GameService,
    cultivator: Cultivator,
    keeper: AKeeper,
    counter: ACounter
): string {
    return game.knowledge.isAwareOf(cultivator.id, 'cultivator', keeper.id)
        ? keeper.name
        : THE_KEEPER_UNNAMED[counter];
}

/**
 * The counter a phrase names its keeper by, where it names one this place has.
 */
export function theCounterThisKeeperKeeps(
    said: string,
    countersHere: readonly ACounter[]
): ACounter | null {
    for (const counter of countersHere) {
        if (WHAT_THEY_ARE_CALLED[counter].test(said)) return counter;
    }
    if (!A_TICKET_CLERK.test(said)) return null;
    return countersHere.find(counter => counter !== 'inn') ?? null;
}
