/**
 * WHAT A HOUSE TEACHES, WHICH IS THE QUESTION ASKED BEFORE JOINING ONE.
 *
 * `what does the Azure Cloud Pavilion have` has been answerable for a while
 * and `what does the Azure Cloud Pavilion teach` has not, which is the wrong
 * way round: a purse is what you ask about a house you mean to rob, and a
 * shelf is what you ask about one you mean to spend a century in.
 *
 * Every part of the answer was already in the catalog and none of it had a
 * reader. `SECTS[].teaches` is a list of technique ids - 37 of the world's 45
 * bodies carry a real one, no id in any of them dangles - and each id resolves
 * to a road with the rung it OPENS at and the rung it ENDS at. Nothing outside
 * `getSectsTeaching`, a reverse index used for a different question entirely,
 * had ever asked a house what was on its shelf.
 *
 * ── THE SHELF IS PUBLIC, AND THAT IS NOT A CONCESSION ────────────────────
 *
 * `who-stands-behind-them.ts` and `what-a-house-has-to-its-name.ts` both band
 * their answer by the reader's rung, because who is above a house and what is
 * in its vault are things people guess at and get wrong. A curriculum is not
 * like that. A house RECRUITS on its curriculum; it is the notice on the wall.
 * Gating it would put the one question a mortal most needs answered behind a
 * rung a mortal does not have, which is the opposite of what the bands are for.
 *
 * What is withheld is the thing a house would not say about its own shelf:
 * whether anybody there can still teach the top of it. That is read off the
 * roster rather than the catalog, and it is the fact a house has every reason
 * to keep quiet - see `ROADS_NOBODY_THERE_CAN_OPEN` below.
 *
 * ── AND EIGHT BODIES TEACH NOTHING ───────────────────────────────────────
 *
 * Measured over all 45: the Kiln Wardens, four courts and three apex
 * institutions have empty shelves. For the Wardens that is the standing ruling
 * - a posting is not a sect, it teaches nothing and takes nobody - and for the
 * others it is what an administrative body is. Saying so plainly is a real
 * answer and a better one than an empty list, so each gets its own sentence.
 */

import { getSpiritRoot, type SpiritRootKey } from '../engine/cultivation/spirit-roots.js';
import { getTechnique } from '../data/cultivation/techniques.js';
import { rankName } from '../engine/cultivation/realms.js';
import type { WorldState } from '../engine/world/world-state.js';

/** One road on a house's shelf, as somebody asking would be told it. */
export interface ARoadAHouseTeaches {
    id: string;
    name: string;
    /** Null for the elementless roads, which most primers are. */
    element: string | null;
    grade: string;
    /** The rung it can first be opened at. */
    opensAt: number;
    /**
     * The rung it carries a reader to, and stops.
     *
     * NULL IS NOT UNKNOWN, IT IS NO CEILING. The catalog's capless rows all
     * open at the top of the ladder and state no end, which is the thing that
     * makes them what they are. Said as such rather than folded into a number.
     */
    endsAt: number | null;
    /** Whether the asker's own root walks this road without fighting it. */
    suitsTheAsker: boolean;
}

export interface WhatAHouseTeaches {
    factionId: string;
    houseName: string;
    roads: ARoadAHouseTeaches[];
    /** The deepest rung anything on the shelf reaches, or null for an empty shelf
     * and for one whose deepest road states no ceiling at all. */
    shelfEndsAt: number | null;
    /** The deepest rung the asker's own root could reach here, or null. */
    endsForTheAskerAt: number | null;
    /**
     * The highest rung anybody on the house's roll actually stands at, or null
     * where the world holds nobody for them. See `ROADS_NOBODY_THERE_CAN_OPEN`.
     */
    tallestThere: number | null;
    /** Roads whose opening rung is above everybody currently on the roll. */
    unopenable: ARoadAHouseTeaches[];
    lines: string[];
    structure: string;
}

/**
 * A HOUSE CAN HOLD A BOOK NOBODY THERE CAN OPEN, AND USUALLY DOES AT THE TOP.
 *
 * The shelf is catalog and the roster is world, so the two drift apart the
 * moment a world runs: a road opening at 41 is still on the shelf of a house
 * whose tallest member stands at 33, and the house goes on naming it. That gap
 * is the single most useful thing about the answer - it is the difference
 * between a shelf that is an offer and a shelf that is a boast - and it is
 * exactly what the house would not volunteer.
 *
 * So it is said, and said as a fact about who is standing there rather than
 * about the book, because the book is fine and the people are the problem.
 */
function roadsNobodyThereCanOpen(
    roads: readonly ARoadAHouseTeaches[],
    tallestThere: number | null
): ARoadAHouseTeaches[] {
    if (tallestThere === null) return [];
    return roads.filter(road => road.opensAt > tallestThere);
}

/** The rung of the highest person the world currently has on that house's roll. */
export function theTallestOnTheRoll(
    world: WorldState | null,
    factionId: string
): number | null {
    if (world === null) return null;
    const rungs = world.npcs
        .filter(npc => npc.factionId === factionId && npc.status === 'alive')
        .map(npc => npc.cultivation.realmOrdinal);
    return rungs.length === 0 ? null : Math.max(...rungs);
}

export function whatAHouseTeaches(input: {
    world: WorldState | null;
    houseName: string;
    factionId: string;
    /** Technique ids off the catalog row for this body. */
    teaches: readonly string[];
    askersRoot: SpiritRootKey;
}): WhatAHouseTeaches {
    const mine = new Set<string>(getSpiritRoot(input.askersRoot)?.elements ?? []);
    const roads: ARoadAHouseTeaches[] = [];
    for (const id of input.teaches) {
        const row = getTechnique(id);
        if (row === undefined) continue;
        roads.push({
            id,
            name: row.name,
            element: row.element ?? null,
            grade: row.grade,
            opensAt: row.requiredOrdinal,
            endsAt: row.cap,
            // AN ELEMENTLESS ROAD SUITS EVERYBODY, which is why every house's
            // primer is one. It is not a road your root is good at, it is a
            // road your root is not consulted about.
            suitsTheAsker: row.element === null || mine.has(row.element)
        });
    }
    // A capless road sorts last on a tie, which is where it belongs: it is the
    // one that states no end, and the shelf reads as a ladder up to it.
    const last = Number.MAX_SAFE_INTEGER;
    roads.sort((a, b) =>
        a.opensAt - b.opensAt || (a.endsAt ?? last) - (b.endsAt ?? last));

    const tallestThere = theTallestOnTheRoll(input.world, input.factionId);
    const unopenable = roadsNobodyThereCanOpen(roads, tallestThere);
    const shelfEndsAt = deepest(roads);
    const forMe = roads.filter(road => road.suitsTheAsker);
    const endsForTheAskerAt = deepest(forMe);

    const lines: string[] = [];

    if (roads.length === 0) {
        lines.push(
            `${input.houseName} teaches nothing. There is no shelf there to be put on - `
            + 'whatever else it is, it is not a place somebody goes to be taught, and '
            + 'presenting yourself at its door to learn would be a misreading of what it is.'
        );
        return {
            factionId: input.factionId, houseName: input.houseName, roads: [],
            shelfEndsAt: null, endsForTheAskerAt: null, tallestThere, unopenable: [],
            lines, structure: theStructure(input.factionId, 0, null, null, tallestThere, 0)
        };
    }

    lines.push(
        `${input.houseName} teaches ${roads.length === 1 ? 'one road' : `${roads.length} roads`}, `
        + `and the deepest of them ${shelfEndsAt === null
            ? 'states no end at all'
            : `ends at ${rankName(shelfEndsAt)}`}.`
    );
    for (const road of roads) {
        lines.push(
            `${road.name} - ${road.element ?? 'no element'}, ${road.grade} grade. `
            + `Opens at ${rankName(road.opensAt)} and ${road.endsAt === null
                ? 'states no end'
                : `ends at ${rankName(road.endsAt)}`}.`
        );
    }

    // ── AND WHAT IT MEANS FOR THE PERSON ASKING ──────────────────────────
    //
    // The catalog answer is the same for everybody and the useful answer is
    // not. A wood-rooted asker at a water house has a real career with a real
    // ceiling and it is their root that put it there - the rule
    // `what-root-a-seeded-house-member-has.ts` applies to the house's own
    // people, said to the person standing at the door.
    lines.push(howFarItGoesForYou(forMe.length, endsForTheAskerAt, shelfEndsAt));

    if (unopenable.length > 0) {
        lines.push(
            `${unopenable.length === roads.length ? 'Every road on it' : `${unopenable.length} of `
            + 'them'} opens above the highest person they have. `
            + `Nobody at ${input.houseName} stands past ${rankName(tallestThere!)}, so what is on `
            + 'the shelf above that is a book they own and cannot read out.'
        );
    }

    return {
        factionId: input.factionId,
        houseName: input.houseName,
        roads,
        shelfEndsAt,
        endsForTheAskerAt,
        tallestThere,
        unopenable,
        lines,
        structure: theStructure(
            input.factionId, roads.length, shelfEndsAt, endsForTheAskerAt,
            tallestThere, unopenable.length
        )
    };
}

/**
 * The deepest rung a set of roads reaches, or null where none of them state one.
 *
 * A capless road is deliberately NOT treated as the deepest. It has no stated
 * end, so calling it the deepest would be inventing a number the catalog
 * refused to write, and every capless row opens at the top of the ladder
 * anyway - a reader who can reach one is past the question.
 */
function howFarItGoesForYou(
    walkable: number,
    endsForTheAskerAt: number | null,
    shelfEndsAt: number | null
): string {
    if (walkable === 0) {
        return 'Not one of those roads is one your root walks. You would be taught here and '
            + 'you would be fighting the instruction the whole way.';
    }
    // THE ASKER'S OWN ROADS STATE NO END. Rare, and it is not the same sentence
    // as the shelf ending where it ends for anybody - it means the roads open
    // to this root are the ones the catalog refused to put a ceiling on.
    if (endsForTheAskerAt === null) {
        return 'What your root walks here states no end at all, which is the whole of what '
            + 'those roads are and the reason nobody says how far they go.';
    }
    if (endsForTheAskerAt === shelfEndsAt) {
        return 'Your root walks the deepest of them, so the shelf ends where it ends for '
            + 'anybody.';
    }
    return `Your root walks as far as ${rankName(endsForTheAskerAt)} of it. The rest of the `
        + 'shelf is somebody else\'s road, and no amount of standing here changes that.';
}

function deepest(roads: readonly ARoadAHouseTeaches[]): number | null {
    const ends = roads.map(road => road.endsAt).filter((n): n is number => n !== null);
    return ends.length === 0 ? null : Math.max(...ends);
}

function theStructure(
    factionId: string,
    roads: number,
    shelfEndsAt: number | null,
    endsForTheAskerAt: number | null,
    tallestThere: number | null,
    unopenable: number
): string {
    return `whatAHouseTeaches(${factionId}): ${roads} road(s) on the shelf, ending at `
        + `${shelfEndsAt ?? 'nothing'}; for this root, ${endsForTheAskerAt ?? 'nothing'}. `
        + `Tallest on the roll ${tallestThere ?? 'unknown'}, ${unopenable} road(s) above them. `
        + 'Read only, nothing spent.';
}
