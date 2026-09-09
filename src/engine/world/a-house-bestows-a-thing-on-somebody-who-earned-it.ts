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
    factions: readonly { id: string; name?: string; dissolvedOnDay: number | null }[];
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

/** The note a bestowal leaves on the chain. */
export function whyItIsTheirs(gift: AThingGivenAway): string {
    return `Given outright by ${gift.fromName}, and not owed back.`;
}
