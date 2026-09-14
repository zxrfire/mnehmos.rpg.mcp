/**
 * Where somebody stands on a house's roll. One answer, and every reader asks it.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────
 *
 * The rung had THREE copies and they disagreed:
 *
 *   `cultivators.sect_rank`   a string mirrored onto the cultivator row by
 *                             `sect.repo.ts`. It said nothing where nothing set
 *                             the mirror, and said the JOINING rung wherever
 *                             the world had since moved somebody. It was what
 *                             every reader but `status` asked.
 *   `sect_members.rank_index` the roll itself, for a stored cultivator
 *   `NpcRecord.factionRankIndex`  the rung a world person carries on their own row
 *
 * The mirror is gone. What is left is two STORES, and they are two because a
 * person exists in two places: a stored cultivator is on a roll in SQLite, and
 * somebody the world holds carries their rung on their world row. Neither is
 * derivable from the other, so neither can be dropped - and that is exactly why
 * the read has to be one function rather than a choice every caller makes.
 *
 * ── THE ORDER IS LOAD-BEARING ────────────────────────────────────────────
 *
 * The world row is asked FIRST. Measured: asking the membership table first
 * read a house's own people a rung or two low, so a conclave disciple came back
 * as an outer one and could not host. Do not reverse it without re-measuring.
 *
 * For the player the two agree by construction - `refreshThePlayerRow` writes
 * the membership onto their world row every turn - so the order costs nothing
 * there and buys the world's own people being read correctly.
 *
 * ── A RUNG NAME IS THE HOUSE'S OWN ───────────────────────────────────────
 *
 * `faction.ranks ?? catalog.ranks`. A generic ladder here would be a second one
 * beside the house's, and the two would part company the first time a world
 * seeded a house with words of its own.
 */

import { getSect } from '../../data/cultivation/sects.js';
import type { WorldState } from './world-state.js';

/** A roll row as the membership table holds it, narrowed to what is read. */
export interface ARollRow {
    sectId: string;
    rankIndex: number;
}

/**
 * The two stores, as little of them as this read needs.
 *
 * Structural rather than a service handle so the question can be asked from the
 * play layer, the tool surface and the world advance without any of the three
 * importing the others.
 */
export interface TheRollsToRead {
    /** The world, where one is open. Null for a run with none. */
    world: WorldState | null;
    /** The membership table, asked per person. */
    rollRowFor(personId: string): ARollRow | null;
}

/**
 * The stores as a caller holding only the roll can see them.
 *
 * The tool surface is synchronous and every way of reaching a world is not, so
 * these callers genuinely cannot ask the world row. That costs nothing for the
 * PLAYER, whose world row is written from their roll on every turn by
 * `refreshThePlayerRow` - the two agree by construction. It would cost
 * something for one of the world's own people, and no caller of this asks about
 * one: this is the sheet, the panel and the roster, all of them about
 * cultivators the database holds.
 */
export function theRollAlone(
    roll: { getMembership(cultivatorId: string): ARollRow | null }
): TheRollsToRead {
    return { world: null, rollRowFor: id => roll.getMembership(id) };
}

/** A rung held on a house's roll, in that house's own word for it. */
export interface WhereTheyStandOnARoll {
    factionId: string;
    factionName: string;
    /** The house's own name for the rung. Never a generic ladder. */
    rungName: string;
    rankIndex: number;
    rankCount: number;
}

/** The rungs this house names, its own before the catalog's. */
export function theRungsOfTheHouse(
    world: WorldState | null,
    factionId: string
): readonly string[] {
    const faction = world?.factions.find(row => row.id === factionId) ?? null;
    return faction?.ranks ?? getSect(factionId)?.ranks ?? [];
}

/** What this house is called, its own name before the catalog's. */
export function theNameOfTheHouse(
    world: WorldState | null,
    factionId: string
): string {
    const faction = world?.factions.find(row => row.id === factionId) ?? null;
    return faction?.name ?? getSect(factionId)?.name ?? factionId;
}

/**
 * Where somebody sits on a house's ladder, or -1 where nothing says.
 *
 * `rankCount` clamps: a world row carrying a rung past the end of a house's
 * ladder reads as its top rung rather than as an index nothing can name.
 */
export function rankIndexOnAHousesRoll(
    rolls: TheRollsToRead,
    personId: string,
    rankCount: number
): number {
    const top = Math.max(0, rankCount - 1);
    const npc = rolls.world?.npcs.find(row => row.id === personId) ?? null;
    if (npc && typeof npc.factionRankIndex === 'number' && npc.factionRankIndex >= 0) {
        return Math.min(npc.factionRankIndex, top);
    }
    const roll = rolls.rollRowFor(personId);
    if (roll && typeof roll.rankIndex === 'number' && roll.rankIndex >= 0) {
        return Math.min(roll.rankIndex, top);
    }
    return -1;
}

/**
 * The rung this person holds, named, or null where they hold none.
 *
 * Null is a fact about them and not a gap: somebody born on a house's roll has
 * a `sectId` and no roll row, which this world says out loud as "at no rank in
 * it". Being on a roll is not being on a rung, and only the roll puts you on
 * one - so the house is taken from the roll row, and a world row's house is
 * read only for somebody the world holds who has no roll row at all.
 */
export function whereSomebodyStandsOnAHousesRoll(
    rolls: TheRollsToRead,
    personId: string
): WhereTheyStandOnARoll | null {
    const roll = rolls.rollRowFor(personId);
    const npc = rolls.world?.npcs.find(row => row.id === personId) ?? null;
    const factionId = roll?.sectId
        ?? (npc && npc.factionRankIndex >= 0 ? npc.factionId : null)
        ?? null;
    if (factionId === null) return null;

    const ranks = theRungsOfTheHouse(rolls.world, factionId);
    if (ranks.length === 0) return null;

    const rankIndex = rankIndexOnAHousesRoll(rolls, personId, ranks.length);
    if (rankIndex < 0) return null;

    return {
        factionId,
        factionName: theNameOfTheHouse(rolls.world, factionId),
        rungName: ranks[rankIndex]!,
        rankIndex,
        rankCount: ranks.length
    };
}
