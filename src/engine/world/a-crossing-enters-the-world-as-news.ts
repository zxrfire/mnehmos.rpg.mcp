/**
 * Somebody crossed a realm, and the world hears about it.
 *
 * `aDeedEntersTheWorld` was called from fights and from sites and never from the
 * crossing path, so a cultivator could go through a wall and nothing appended to
 * `state.history.facts` - the only table `circulating`, `retell` and
 * `buildPlayerDigest` read. The largest thing that happens to a person in this
 * genre was, to everybody not in the room, something that had not happened.
 *
 * HOW FAR IT GOES IS THE RUNG, and it is decided here in one table so it can be
 * argued with in one place. The ruling: a Qi Condensation to Foundation
 * Establishment crossing spreads among people near that rung and stays local;
 * somebody hitting Tribulation Transcendence spreads across the land.
 *
 * That is three separate axes and this file supplies two of them. The third was
 * already there.
 *
 *   `scale`    how far the PHYSICAL consequence reached, which is what
 *              `EventScale` means and not a synonym for how interesting it was.
 *              A Foundation Establishment crossing happens inside one body and
 *              is `personal`. A tribulation crossing puts weather over a
 *              mountain and is `continental`. This is the term that decides
 *              whether the story survives crossing a province, because
 *              `airtimeOf` spends it against the distance cost.
 *   `weight`   how heavily the world takes it. `aDeedEntersTheWorld` turns it
 *              into the `magnitude` the digest filters on, so it is what decides
 *              whether a stranger with no connection hears at all.
 *   the gap    who it means something to, and nothing here touches it:
 *              `airtimeOf` already scores how far above the teller the people in
 *              a fact stand, so a Foundation Establishment crossing is loud to a
 *              Qi Condensation disciple and nothing to an elder by the same term
 *              that makes the market talk about the top of the world.
 *
 * NOTHING HERE BRANCHES ON HOW THE CROSSING WAS REACHED. A wall struck on
 * command, a wall crossed inside a ten-year sitting and an NPC's own advance are
 * the same event, and the file follows `a-thing-somebody-ended-is-a-fact.ts` in
 * taking an actor rather than a player.
 */

import { realmIndexOf, clampOrdinal, rankName } from '../cultivation/realms.js';
import {
    aDeedEntersTheWorld,
    type TheWorldNowHoldsIt
} from './a-deed-enters-the-world-as-a-fact.js';
import type { EventScale, HistoricalActor } from './history.js';
import type { Severity } from '../social/grudges.js';
import type { WorldState } from './world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// THE LADDER, AS NEWS
// ─────────────────────────────────────────────────────────────────────────

/** What a crossing is worth, on the two axes the news layer already reads. */
export interface WhatACrossingIsWorth {
    weight: Severity;
    scale: EventScale;
}

/**
 * One row per realm a crossing can land in, indexed by `realmIndexOf`.
 *
 * Index 0 is Qi Condensation, which nothing arrives in from below, so the row is
 * the one unreachable entry and is written rather than left undefined - a hole
 * here would read as a missing case instead of as a realm nobody climbs into.
 */
const ARRIVING_IN: readonly WhatACrossingIsWorth[] = Object.freeze([
    { weight: 'slight', scale: 'personal' },        // Qi Condensation
    { weight: 'slight', scale: 'personal' },        // Foundation Establishment
    { weight: 'slight', scale: 'personal' },        // Core Formation
    { weight: 'serious', scale: 'local' },          // Nascent Soul
    { weight: 'serious', scale: 'local' },          // Deity Transformation
    { weight: 'serious', scale: 'local' },          // Void Refinement
    { weight: 'grave', scale: 'local' },            // Body Integration
    { weight: 'grave', scale: 'regional' },         // Grand Ascension
    { weight: 'unforgivable', scale: 'continental' }, // Tribulation Transcendence
    { weight: 'unforgivable', scale: 'world' }      // Immortal
]);

/**
 * The line a stranger who cannot name anybody is handed, by how far the crossing
 * physically reached.
 *
 * Authored beside the event the way `digest.ts` asks, and keyed on the scale
 * rather than on the rung, because the scale IS what somebody outside the room
 * could have perceived. A reader standing in the street sees the qi behave and
 * nothing else; that is the whole of what is honest to give them.
 */
const WHAT_AN_OUTSIDER_SAW: Readonly<Record<EventScale, string>> = Object.freeze({
    personal:
        'The qi over one roof leaned in for a night and then let go, and whoever was '
        + 'under it has not come out yet.',
    local:
        'Something drew on this place hard enough that the lamps guttered for a day, and '
        + 'then gave it back all at once.',
    regional:
        'The wells dropped across the whole valley for a season and came back, and nobody '
        + 'will say what was drinking.',
    continental:
        'There was weather over one mountain that was not weather, and it was aimed at '
        + 'somebody.',
    world:
        'Something went out through the top of the sky, and the people who were watching '
        + 'have not agreed since on what they saw.'
});

/**
 * What a crossing from one rung to another is worth as news.
 *
 * Null where the rung is inside a realm: a layer is a private matter and the
 * ruling is about realms. Null also where nothing moved.
 */
export function howFarACrossingCarries(
    fromOrdinal: number,
    toOrdinal: number
): WhatACrossingIsWorth | null {
    const from = clampOrdinal(fromOrdinal);
    const to = clampOrdinal(toOrdinal);
    if (to <= from) return null;
    const arrived = realmIndexOf(to);
    if (arrived === realmIndexOf(from)) return null;
    return ARRIVING_IN[arrived] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────
// THE WRITE
// ─────────────────────────────────────────────────────────────────────────

export interface ACrossing {
    /** Whoever went through. The role is the caller's word. */
    who: HistoricalActor;
    fromOrdinal: number;
    toOrdinal: number;
    /** Absolute WORLD day. Not the run's elapsed days. */
    day: number;
    locationId: string | null;
    place?: string | null;
    /** The house it is on the books of, whose people a faction fact reaches. */
    factionIds?: readonly string[];
}

/**
 * Put one crossing into the world's own record.
 *
 * Returns null where the crossing was not a realm boundary, which is the common
 * case: most rungs are layers and a layer is nobody's business. Mutates `state`
 * in place, as every write in this layer does.
 */
export function aCrossingEntersTheWorld(
    state: WorldState,
    input: ACrossing
): TheWorldNowHoldsIt | null {
    const worth = howFarACrossingCarries(input.fromOrdinal, input.toOrdinal);
    if (worth === null) return null;

    const rung = rankName(clampOrdinal(input.toOrdinal));
    return aDeedEntersTheWorld(state, {
        kind: 'realm_crossing',
        day: input.day,
        locationId: input.locationId,
        place: input.place ?? null,
        actors: [input.who],
        factionIds: input.factionIds ?? [],
        weight: worth.weight,
        scale: worth.scale,
        summary: `${input.who.name} came through the wall into ${rung}.`,
        unattributed: WHAT_AN_OUTSIDER_SAW[worth.scale],
        data: {
            crossedIntoOrdinal: clampOrdinal(input.toOrdinal),
            crossedFromOrdinal: clampOrdinal(input.fromOrdinal),
            rung
        }
    });
}
