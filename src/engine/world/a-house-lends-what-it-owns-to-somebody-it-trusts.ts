/**
 * A house puts one of its own things in one of its own people's hands.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `what-a-house-keeps-in-its-treasury.ts` was written because a house held
 * stones and no THINGS, and its header names the three cases that had nothing
 * to operate on: *"lending a disciple a furnace, bestowing something on
 * somebody who earned it, and being robbed of anything that mattered"*. The
 * treasuries landed. **Nothing ever lent anything out of them.**
 *
 * Measured on three seeded worlds before this: of 415 people, 28 to 31 carried
 * an object owned by somebody else, and every single one of them was a `token`
 * - the identity plate every member of a house wears, from
 * `a-house-knows-its-own-by-a-plate-and-a-token.ts`. A plate is not a loan. So
 * the honest count of people in this world carrying something a house lent them
 * was **zero**, in every world, always.
 *
 * That matters because of what it costs the setting. The design owner, asking
 * for the register the game was missing: *"a senior brother monologue about how
 * nice his borrowed sword is"*. The promising disciple carrying the house's
 * good blade is one of the stock figures of the genre, and the terms are the
 * whole of why he is interesting: it is his while he is useful, and the house
 * can take it back.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT IT DOES NOT DO
 * ═════════════════════════════════════════════════════════════════════════
 *
 * No new table and no new field. `ownerId` and `possessorId` have been separate
 * columns on the possessions table since it was written, for exactly this, and
 * a loan is the state where they disagree. Nothing here records that a loan
 * "happened" beyond the object saying who has it, because that is what a loan
 * is.
 *
 * And it stays rare on purpose. Two per house at the outside, only out of what
 * a house tracks, and only to somebody the house has a reason to hand it to -
 * so most people carry nothing that is not theirs, and the one who does is
 * worth a sentence.
 */

import { forStream } from '../cultivation/rng.js';

/** At most this many of a house's tracked things are out on loan at once. */
export const WHAT_A_HOUSE_WILL_HAVE_OUT = 2;

/**
 * A thing a house owns and does not have in a room, because somebody is
 * carrying it.
 */
export interface ALoanAHouseHasMade {
    objectId: string;
    /** Who is holding it. They do not own it and are not told they might. */
    toNpcId: string;
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
    factionId: string | null;
    status: string;
    tags: readonly string[];
    cultivation: { realmOrdinal: number };
}

/**
 * WHO A HOUSE WOULD HAND IT TO, in order.
 *
 * The house's own pick first, because that is what being picked means and the
 * world already writes the tag. Then depth, because a house does not lend its
 * good cauldron to somebody who cannot use it. Ties break on id so two worlds
 * built from one seed agree.
 */
function whoWouldBeTrustedWithIt(
    members: readonly SomebodyOnARoll[]
): readonly SomebodyOnARoll[] {
    return [...members].sort((a, b) => {
        const picked = Number(b.tags.includes('chosen')) - Number(a.tags.includes('chosen'));
        if (picked !== 0) return picked;
        const deeper = b.cultivation.realmOrdinal - a.cultivation.realmOrdinal;
        if (deeper !== 0) return deeper;
        return a.id < b.id ? -1 : 1;
    });
}

/**
 * WHAT IS WORTH LENDING, which is not everything a house owns.
 *
 * A lot of fired clay cauldrons is `mundane` and nobody tracks whose the third
 * one is, so lending one is not an event. A token is an identity plate and
 * every member has one already. What is left is the tracked half of the
 * treasury, which is the half a house would notice the absence of.
 */
function whatIsWorthLending(
    things: readonly AThingAHouseOwns[], houseId: string
): readonly AThingAHouseOwns[] {
    return things
        .filter(thing =>
            thing.ownerId === houseId
            && thing.possessorId === null
            && thing.kind !== 'token'
            && thing.significance !== 'mundane')
        .sort((a, b) => (a.id < b.id ? -1 : 1));
}

/**
 * Every loan the houses of a world have outstanding.
 *
 * Pure: it decides, and the caller writes `possessorId`. Its own named RNG
 * stream, so nothing already drawn in any seeded world moves.
 */
export function whatEachHouseHasOutOnLoan(state: {
    seed?: string;
    factions: readonly { id: string; dissolvedOnDay: number | null }[];
    npcs: readonly SomebodyOnARoll[];
    objects: readonly AThingAHouseOwns[];
}): ALoanAHouseHasMade[] {
    const loans: ALoanAHouseHasMade[] = [];
    const byHouse = new Map<string, SomebodyOnARoll[]>();
    for (const npc of state.npcs) {
        if (npc.factionId === null || npc.status !== 'alive') continue;
        const roll = byHouse.get(npc.factionId) ?? [];
        roll.push(npc);
        byHouse.set(npc.factionId, roll);
    }

    for (const house of [...state.factions].sort((a, b) => (a.id < b.id ? -1 : 1))) {
        if (house.dissolvedOnDay !== null) continue;
        const members = byHouse.get(house.id) ?? [];
        if (members.length === 0) continue;

        const lendable = whatIsWorthLending(state.objects, house.id);
        if (lendable.length === 0) continue;

        // Not every house has something out. A house with one good cauldron
        // and a use for it keeps the cauldron, and the draw is what decides -
        // otherwise every house in every world lends the same number of things
        // and the world reads like a table again.
        const draw = forStream(house.id, 'a-house-lends-what-it-owns');
        const outAtOnce = Math.min(
            lendable.length,
            members.length,
            Math.floor(draw.next() * (WHAT_A_HOUSE_WILL_HAVE_OUT + 1))
        );
        if (outAtOnce <= 0) continue;

        const trusted = whoWouldBeTrustedWithIt(members);
        for (let at = 0; at < outAtOnce; at++) {
            loans.push({ objectId: lendable[at].id, toNpcId: trusted[at].id });
        }
    }
    return loans;
}
