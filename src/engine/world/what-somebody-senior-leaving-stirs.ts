/**
 * What somebody leaving a house stirs in the people it leaves behind.
 *
 * The design owner, on an elder walking out: *"that's like a top NBA star
 * transferring teams"*, *"it's rare AF"*, *"people rioted when LeBron left."* And
 * the other end of it: an outer disciple leaving is barely noticed. So how big a
 * departure is reads one thing, the rung they left from as a share of their
 * house's ladder, and everything it moves is proportional to it:
 *
 *   the news     the fact of it, at {@link howLoudALeavingIs}: under
 *                `WORTH_REPEATING` at the bottom rung, so nobody repeats it, and
 *                well over it at the top, so the ordinary fact paths carry it.
 *   the ties     everybody still on the roll who holds a warm tie to them - a
 *                master, a disciple, kin, an ally - has it cooled by that tie's
 *                own warmth times the same share. An ordinary relationship row
 *                changing, and it can go below nothing.
 *   the head     is left holding a grievance against a senior who went, sized by
 *                the same share, written as a tie from the head to them.
 *
 * Nothing here is a new system: every write is `upsertRelationship`.
 */

import { isElderRank } from '../cultivation/leadership.js';
import { WORTH_REPEATING } from './who-goes-out-for-a-house-and-what-comes-back.js';
import { relationshipWith, upsertRelationship, type NpcRecord, type RelationshipKind } from './npc-state.js';
import { andTheOtherEnd } from './a-tie-has-two-ends.js';
import type { FactionRecord, WorldState } from './world-state.js';

/** The ties a departure cools. Warm ones; an enemy is not sorry to see anybody go. */
const TIES_A_DEPARTURE_COOLS: ReadonlySet<RelationshipKind> = new Set([
    'master', 'disciple', 'kin', 'spouse', 'parent', 'child', 'ally', 'patron', 'client', 'acquaintance'
]);

/** How far up their house's ladder somebody stood, 0 at the bottom and 1 at its head. */
export function howHighTheyStood(rankIndex: number, rankCount: number): number {
    return rankCount <= 1 ? 0 : Math.max(0, Math.min(1, rankIndex / (rankCount - 1)));
}

/** How loud the news of a departure is: under repeating at the bottom, well over it at the top. */
export function howLoudALeavingIs(rankIndex: number, rankCount: number): number {
    const share = howHighTheyStood(rankIndex, rankCount);
    return Math.min(0.9, WORTH_REPEATING * 0.85 + share * 0.55 + (isElderRank(rankIndex, rankCount) ? 0.1 : 0));
}

/**
 * Write what this person going stirs in their house. Returns how many ties it
 * changed. `leaver` is the row as it stood before they went.
 */
export function whatTheirLeavingStirs(
    state: WorldState,
    leaver: Pick<NpcRecord, 'id' | 'name' | 'factionRankIndex'>,
    house: FactionRecord,
    day: number,
    goingWithThem: ReadonlySet<string> = new Set()
): number {
    const share = howHighTheyStood(leaver.factionRankIndex, house.ranks.length);
    if (!(share > 0)) return 0;
    const head = house.ranks.length - 1;
    let changed = 0;
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i]!;
        if (npc.id === leaver.id || goingWithThem.has(npc.id)) continue;
        if (npc.status !== 'alive' || npc.factionId !== house.id) continue;
        const tie = relationshipWith(npc, leaver.id);
        if (tie !== null && TIES_A_DEPARTURE_COOLS.has(tie.kind) && tie.standing > 0) {
            state.npcs[i] = upsertRelationship(npc, {
                targetId: leaver.id, targetName: leaver.name, kind: tie.kind,
                standing: tie.standing - tie.standing * share * 2,
                note: `${leaver.name} left the house.`
            }, day);
            changed++;
            continue;
        }
        if (tie === null && npc.factionRankIndex === head && isElderRank(leaver.factionRankIndex, house.ranks.length)) {
            state.npcs[i] = upsertRelationship(npc, {
                targetId: leaver.id, targetName: leaver.name, kind: 'rival',
                standing: -0.5 * share,
                note: `${leaver.name} walked out of the house from its own senior rungs.`
            }, day);
            andTheOtherEnd(state.npcs, npc, { targetId: leaver.id, kind: 'rival', standing: 0 }, day);
            changed++;
        }
    }
    return changed;
}
