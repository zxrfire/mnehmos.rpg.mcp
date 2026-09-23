/**
 * A house gives a thing away, and stops owning it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY IT HAD TO EXIST BEFORE PEOPLE COULD LEND
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner: *"and don't forget, PEOPLE lend too. Like you might lend
 * your treasure to a junior brother or sister."*
 *
 * Which turned out to need something built first. **Nobody in this world owned
 * anything.** Measured on two seeded worlds off the production catalog: of 1452
 * and 1468 objects, the number whose `ownerId` named a person was **zero**, in
 * both. Every object anybody held belonged to a house. So "lend your treasure"
 * had no treasure to reach for, and a person-to-person lending pass would have
 * returned an empty list on every seed forever.
 *
 * `what-a-house-keeps-in-its-treasury.ts` names this case as one of the three
 * it was written to make possible - *"lending a disciple a furnace, BESTOWING
 * SOMETHING ON SOMEBODY WHO EARNED IT, and being robbed of anything that
 * mattered"* - and it is the one that had never happened.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * A GIFT IS NOT A LOAN, AND THE DIFFERENCE IS THE POINT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `a-house-holds-its-own.ts` already draws the line and says why it matters:
 * `whoseThisIs` returns `their_own` the moment the owner is not a house,
 * *"and a bestowed thing is exactly this: the house is no longer in the
 * field."* A lent cauldron is owed back. A bestowed one is theirs, and the
 * house has spent it.
 *
 * So this transfers OWNERSHIP where the lending pass transfers only possession,
 * and it writes `how: 'awarded'` on the chain where lending writes `how:
 * 'lent'`. Both go through `transferPossession`, because a field somebody
 * forgets to set is how a gift silently becomes a loan.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * AND IT IS RARER THAN LENDING
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A house lends a furnace to whoever needs one this decade. A house gives
 * something away once in a long while, to somebody it has already decided
 * about. So this fires on fewer houses, hands over one thing, and takes the
 * person the house already picked rather than looking for one.
 */

import { forStream } from '../cultivation/rng.js';
import {
    aPairOfCommunicationJade,
    theJadeBetween,
    whoMakesJadeForTheElders
} from './a-pair-of-communication-jade.js';
import type { ObjectRecord } from './possessions.js';
import type { WorldState } from './world-state.js';

/** How many of a world's houses have ever given something away outright. */
export const HOUSES_THAT_HAVE_GIVEN_SOMETHING_AWAY = 0.3;

export interface AThingGivenAway {
    objectId: string;
    toNpcId: string;
    toName: string;
    /** The house that gave it, for the chain. */
    fromName: string;
}

interface AThingAHouseOwns {
    id: string;
    kind: string;
    significance: string;
    ownerId: string | null;
    possessorId: string | null;
}

interface SomebodyOnARoll {
    id: string;
    name: string;
    factionId: string | null;
    factionRankIndex: number;
    status: string;
    tags: readonly string[];
    cultivation: { realmOrdinal: number };
    /** Where they are, where the caller knows: read by {@link awayFromTheHouse}. */
    locationId?: string | null;
}

/**
 * Whether the person a house marked is away from its seat, which is what makes
 * its gift a pair of jade rather than a thing out of its stores: a line kept open
 * to somebody it is not standing beside. Unknown where the caller carries no
 * places, which leaves the ordinary gift.
 */
export function awayFromTheHouse(
    house: { seatLocationId?: string | null },
    person: { locationId?: string | null }
): boolean {
    return house.seatLocationId !== undefined && house.seatLocationId !== null
        && person.locationId !== undefined && person.locationId !== house.seatLocationId;
}

/**
 * WHAT EACH HOUSE HAS ALREADY GIVEN AWAY.
 *
 * Pure: it decides, and the caller writes through `transferPossession`.
 *
 * Who gets it is not a draw. A house gives its good thing to the person it has
 * already marked, and `chosen` is that decision, written by the world at
 * seeding. A house with nobody marked gives nothing, which is most of them.
 */
export function whatEachHouseHasGivenAway(state: {
    factions: readonly { id: string; name?: string; dissolvedOnDay: number | null; seatLocationId?: string | null }[];
    npcs: readonly SomebodyOnARoll[];
    objects: readonly AThingAHouseOwns[];
}): AThingGivenAway[] {
    const given: AThingGivenAway[] = [];

    for (const house of [...state.factions].sort((a, b) => (a.id < b.id ? -1 : 1))) {
        if (house.dissolvedOnDay !== null) continue;

        // Not a draw over the roll: the person the house already decided
        // about. If it has not decided about anybody, it has nothing to mark
        // and gives nothing.
        const marked = state.npcs
            .filter(npc => npc.status === 'alive'
                && npc.factionId === house.id
                && npc.tags.includes('chosen'))
            .sort((a, b) =>
                b.cultivation.realmOrdinal - a.cultivation.realmOrdinal
                || (a.id < b.id ? -1 : 1));
        if (marked.length === 0) continue;

        const worthGiving = state.objects
            .filter(thing => thing.ownerId === house.id
                && thing.possessorId === null
                && thing.kind !== 'token'
                && thing.significance !== 'mundane')
            .sort((a, b) => (a.id < b.id ? -1 : 1));
        if (worthGiving.length === 0) continue;

        // Most houses have never done this. The ones that have, did it once.
        const draw = forStream(house.id, 'a-house-bestows-what-it-owns');
        if (draw.next() > HOUSES_THAT_HAVE_GIVEN_SOMETHING_AWAY) continue;

        given.push({
            objectId: worthGiving[0].id,
            toNpcId: marked[0].id,
            toName: marked[0].name,
            fromName: house.name ?? 'their house'
        });
    }
    return given;
}

// ═════════════════════════════════════════════════════════════════════════
// AND A PAIR OF JADE, WHICH IS TWO THINGS AND NOT ONE
// ═════════════════════════════════════════════════════════════════════════

/** A pair of communication jade a house had made for the person it marked. */
export interface APairOfJadeBestowed {
    /** Both halves, as the jade module makes them: the marked person's and the maker's twin. */
    halves: [ObjectRecord, ObjectRecord];
    toNpcId: string;
    toName: string;
    fromName: string;
}

/**
 * WHAT A HOUSE GIVES AS A PAIR OF JADE: to the person it marked where they are
 * away from its seat, or where its stores hold nothing tracked to hand over, and
 * its hands can make a pair.
 *
 * The same house, the same marked person and the same draw as
 * {@link whatEachHouseHasGivenAway}, so a house decides once whether it has ever
 * given anything; this is only what the gift is. Measured over three seeded
 * worlds before the away rule: every house with a marked person had something
 * tracked in its stores, so a jade was never the gift - which is why the person
 * being away is what decides it. AND IT IS STILL RARE: over five seeded worlds,
 * one to four houses a world had their marked person away, the draw passed for at
 * most one, and none of those had a hand at their seat that could work earth
 * grade, so no pair was bestowed at world open in any of the five. A jade is a pair, so it cannot be a row moved out of a
 * treasury: it is made, through the jade module's own maker
 * (`aPairOfCommunicationJade`), by whoever makes the house's jade
 * (`whoMakesJadeForTheElders`), who keeps the twin as they do for an elder.
 * Pure: the caller pushes the halves.
 */
export function whatEachHouseGivesAsAPairOfJade(
    state: Pick<WorldState, 'factions' | 'npcs' | 'objects' | 'locations'>,
    /** What each house's stores hold, which is what decides that it had nothing else to give. */
    stores: readonly AThingAHouseOwns[],
    onDay: number
): APairOfJadeBestowed[] {
    const out: APairOfJadeBestowed[] = [];
    for (const house of [...state.factions].sort((a, b) => (a.id < b.id ? -1 : 1))) {
        if (house.dissolvedOnDay !== null) continue;
        const marked = state.npcs
            .filter(npc => npc.status === 'alive' && npc.factionId === house.id && npc.tags.includes('chosen'))
            .sort((a, b) => b.cultivation.realmOrdinal - a.cultivation.realmOrdinal || (a.id < b.id ? -1 : 1))[0];
        if (!marked) continue;
        const somethingElse = stores.some(thing => thing.ownerId === house.id && thing.possessorId === null
            && thing.kind !== 'token' && thing.significance !== 'mundane');
        if (somethingElse && !awayFromTheHouse(house, marked)) continue;
        const draw = forStream(house.id, 'a-house-bestows-what-it-owns');
        if (draw.next() > HOUSES_THAT_HAVE_GIVEN_SOMETHING_AWAY) continue;
        const maker = whoMakesJadeForTheElders(state, house);
        if (maker === null || maker.id === marked.id) continue;
        if (theJadeBetween(state, maker.id, marked.id) !== null) continue;
        out.push({
            halves: aPairOfCommunicationJade({
                maker: { id: maker.id, name: maker.name, ordinal: maker.cultivation.realmOrdinal },
                keeps: { id: maker.id, name: maker.name },
                gives: { id: marked.id, name: marked.name },
                onDay,
                locationId: house.seatLocationId
            }),
            toNpcId: marked.id,
            toName: marked.name,
            fromName: house.name ?? 'their house'
        });
    }
    return out;
}

/** The note a bestowal leaves on the chain. */
export function whyItIsTheirs(gift: AThingGivenAway): string {
    return `Given outright by ${gift.fromName}, and not owed back.`;
}
