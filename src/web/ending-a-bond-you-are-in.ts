/**
 * Putting down a master-disciple bond, from either end.
 *
 * The design owner, taking the neglect rule out: *"the master neglect thing, get
 * rid of it. Either they terminate the relationship or they don't."* A master
 * who never teaches costs nobody anything mechanically; what costs something is
 * ENDING it, and ending it is an act somebody performs. The world's own people
 * do it too (`aBondSomebodyEnds` in `the-disciples-a-world-opens-with.ts`); this
 * is the player's end of the same act, in both directions:
 *
 *   CAST OUT    the player is the master and the other is their disciple
 *   WALK OUT    the player is the disciple and the other is their master
 *
 * The rule both ends stand in is written once in
 * `src/engine/world/what-stands-between-a-master-and-a-disciple.md`.
 *
 * What it leaves is `whatEndingABondLeaves` and nothing this file invents: a
 * `former_` tie at each end - harder on whoever was left than on whoever left -
 * and a `broken_oath` against the end that ended it, weighed by how long the
 * bond had stood. The tie is not deleted at either end, because *"a disciple who
 * left eleven years ago still knows what they saw"*.
 *
 * Both stores, like the taking: the world rows are what the world's passes and
 * "my master" read, the relationship rows are what the resolver reads.
 */

import { whatEndingABondLeaves } from '../engine/social-leverage/taking-somebody-as-your-own.js';
import { SEVERITY_IN_WORDS } from '../engine/social/grudges.js';
import { theTieBecomes } from '../engine/world/npc-state.js';
import { recordABondEnded } from '../engine/world/recording-where-somebody-stands-in-a-house.js';
import { writeOneObligation } from '../storage/repos/obligation.repo.js';
import { endTheTieOfAKind, recordABondBothWays } from './encounters.js';
import type { CultivationRepos } from '../server/consolidated/cultivation-support.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { RelationshipType } from '../engine/social/relationships.js';

/** Which end the person doing it is standing at. */
export type WhichEnd = 'master' | 'disciple';

export interface WhatTheEndingLeft {
    lines: string[];
    structure: string;
    endedBy: WhichEnd;
}

/**
 * The bond between these two, as the player's own rows hold it, or null where
 * there is none to end.
 *
 * Read off the world row first because that is where both the world's passes and
 * the player's own side are written; several masters is ordinary, so this asks
 * about ONE named person rather than about "my master".
 */
export function theBondBetween(
    world: WorldState | null,
    repos: CultivationRepos,
    playerId: string,
    otherId: string
): { end: WhichEnd; sinceDay: number } | null {
    const row = world?.npcs.find(npc => npc.id === playerId);
    const tie = row?.relationships.find(r => r.targetId === otherId
        && (r.kind === 'master' || r.kind === 'disciple'));
    if (tie) return { end: tie.kind === 'master' ? 'disciple' : 'master', sinceDay: tie.sinceDay };

    const stored = (repos.db as unknown as {
        prepare(sql: string): { get(...args: unknown[]): unknown };
    }).prepare(
        'SELECT type, established_on_day AS since FROM relationships '
        + 'WHERE from_character_id = ? AND to_character_id = ? AND active = 1 '
        + "AND type IN ('master', 'disciple') LIMIT 1"
    ).get(playerId, otherId) as { type: string; since: number } | undefined;
    if (!stored) return null;
    return { end: stored.type === 'master' ? 'disciple' : 'master', sinceDay: stored.since };
}

/**
 * End it. Writes both ties in both stores, files the broken oath, and puts the
 * day on both their lives. Returns what to say, or null where there was no bond.
 */
export function endTheBond(input: {
    world: WorldState | null;
    repos: CultivationRepos;
    player: { id: string; name: string; ordinal: number };
    other: { id: string; name: string; ordinal: number };
    onDay: number;
    /** The world's own day, where a world is loaded. */
    worldDay?: number;
}): WhatTheEndingLeft | null {
    const { world, repos, player, other, onDay } = input;
    const bond = theBondBetween(world, repos, player.id, other.id);
    if (!bond) return null;

    const master = bond.end === 'master' ? player : other;
    const student = bond.end === 'master' ? other : player;
    const left = whatEndingABondLeaves({
        master, student, onDay, walkedAway: bond.end,
        stoodForDays: Math.max(0, onDay - bond.sinceDay)
    });

    // THE RELATIONSHIP ROWS, which is what the resolver reads on every later ask.
    // The live halves are ENDED first: rows there are keyed by the pair and the
    // kind too, so writing the former ties beside a standing `master` row would
    // leave somebody still answering to a master they walked out on.
    endTheTieOfAKind(repos, student.id, master.id, 'master', 'severed', onDay);
    endTheTieOfAKind(repos, master.id, student.id, 'disciple', 'severed', onDay);
    recordABondBothWays(
        repos,
        left.ties.map(tie => ({
            fromId: tie.holderId,
            toId: tie.targetId,
            type: tie.kind as RelationshipType,
            strength: tie.standing
        })),
        onDay,
        left.ties[0]?.note ?? 'The bond ended.'
    );
    for (const grudge of left.grudges) {
        writeOneObligation(repos.db as unknown as Parameters<typeof writeOneObligation>[0], grudge);
    }

    // AND THE WORLD ROWS, where the world holds either of them.
    if (world) {
        const day = Math.floor(input.worldDay ?? world.currentDay);
        for (const tie of left.ties) {
            const at = world.npcs.findIndex(npc => npc.id === tie.holderId);
            if (at < 0) continue;
            // The live kind becomes the former one: see `theTieBecomes`.
            const was = tie.kind === 'former_disciple' ? 'disciple' : 'master';
            world.npcs[at] = theTieBecomes(world.npcs[at]!, tie.targetId, was, tie.kind, day, {
                standing: tie.standing, note: tie.note
            });
        }
        const masterRow = world.npcs.find(npc => npc.id === master.id);
        const studentRow = world.npcs.find(npc => npc.id === student.id);
        if (masterRow && studentRow) {
            recordABondEnded(world, studentRow, masterRow, bond.end, day);
        }
    }

    const years = Math.round(Math.max(0, onDay - bond.sinceDay) / 365);
    const lines = bond.end === 'master'
        ? [`You cast ${other.name} out. They are not yours any more, and what stood between you `
            + `for ${years} year${years === 1 ? '' : 's'} is what they hold against you now.`]
        : [`You walk out on ${other.name}. The bond had stood ${years} year`
            + `${years === 1 ? '' : 's'}.`];
    // AND WHAT IT COSTS, SAID RATHER THAN LEFT ON THE LEDGER. Nothing here
    // refuses an ending: a bond runs for life, so ending one is a decision and
    // the price is the record it leaves. The severity is the ledger's own word
    // for how long it had stood.
    const oath = left.grudges[0];
    if (oath) {
        lines.push(
            `${other.name} holds it against you as a broken oath, and the ledger's word for it is `
            + `${SEVERITY_IN_WORDS[oath.severity]}. What you were to each other stays on both records.`
        );
    }
    return {
        lines,
        structure: `whatEndingABondLeaves: ended by the ${bond.end} after ${years} year`
            + `${years === 1 ? '' : 's'}. ${left.ties.length} former ties written in both stores, `
            + `${left.grudges.length} broken oath against ${bond.end === 'master' ? master.name : student.name}. `
            + 'Ties kept, not deleted.',
        endedBy: bond.end
    };
}
