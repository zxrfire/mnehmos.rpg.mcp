/**
 * Where a master takes their own disciples through what they have.
 *
 * The design owner: *"closed lectures fall out because the master calls his
 * disciples to his cave abode or room."* A lesson to a master's own set is not
 * held in the lecture hall with whoever wanders in; it is held where the master
 * lives, and the people in it are the ones who were called there.
 *
 * NOTHING NEW IS STORED. A lesson is already the one row it has always been - a
 * `teaching` activity with the set in `withIds` (`who-is-given-attention-this-year.ts`)
 * - and where somebody lives is already two reads:
 *
 *   a residence      ground they took and made theirs (`residenceOf`)
 *   their quarters   the room of the compound their rung is lodged in
 *                    (`whichRoomARungGets` over `theLodgingsOfAHouse`)
 *
 * So whether a lesson is closed is read off who is in it: every one of the
 * world's people in the set holds a master tie to the teacher. And where it is
 * held is read off the teacher. The placement read
 * (`where-inside-a-house-somebody-is-standing.ts`) asks both, and the lesson is
 * found in that room without anybody's `locationId` being written.
 *
 * The player is not one of the world's people for this read. Their row holds no
 * ties the world writes and stands nowhere, so somebody the player's sitting in
 * adds to a set is left out of the question of whether the set is closed.
 *
 * The whole rule - both sets, who may give one, what it is worth to the
 * listener, to the teacher's own year and to the house - is written once, in
 * `how-far-up-the-world-reaches.md` under *A lecture, open and closed*.
 */

import { residenceOf } from './somewhere-that-is-theirs.js';
import { theLodgingsOfAHouse, whichRoomARungGets } from './the-room-a-house-gives-you.js';
import type { LocationRecord } from './locations.js';
import { PLAYER_ROW_TAG, type NpcRecord } from './npc-state.js';
import type { WorldState } from './world-state.js';

/** Where this master lives: ground of their own first, then the room their rung is lodged in. */
export function whereAMasterLives(
    state: Pick<WorldState, 'locations' | 'npcs'>,
    master: Pick<NpcRecord, 'id' | 'factionId' | 'factionRankIndex'>
): LocationRecord | null {
    const own = residenceOf(state as WorldState, master.id);
    if (own) return own;
    if (master.factionId === null) return null;
    const room = whichRoomARungGets(theLodgingsOfAHouse(state as WorldState, master.factionId), master.factionRankIndex);
    return room ? state.locations.find(l => l.id === room.locationId) ?? null : null;
}

/** Whether this person is at a lesson on this day. */
function teachingOn(npc: Pick<NpcRecord, 'status' | 'activity'>, day: number): boolean {
    const a = npc.activity;
    if (npc.status !== 'alive' || a === null || a.kind !== 'teaching' || a.withIds.length === 0) return false;
    return a.untilDay === null || a.untilDay === undefined || a.untilDay >= day;
}

/**
 * Whether this teacher's set is their own disciples and nobody else of the
 * world's people: a closed lesson. False for a hall lecture, for a lesson with
 * a stranger in it, and for anybody not teaching today.
 */
export function isAClosedLesson(
    byId: ReadonlyMap<string, Pick<NpcRecord, 'relationships' | 'tags'>>,
    teacher: Pick<NpcRecord, 'id' | 'status' | 'activity'>,
    day: number
): boolean {
    if (!teachingOn(teacher, day)) return false;
    let disciples = 0;
    for (const id of teacher.activity!.withIds) {
        const row = byId.get(id);
        if (row === undefined || row.tags.includes(PLAYER_ROW_TAG)) continue;
        if (!row.relationships.some(r => r.kind === 'master' && r.targetId === teacher.id)) return false;
        disciples++;
    }
    return disciples > 0;
}

/**
 * Everybody at a closed lesson inside one compound, to the room it is held in.
 *
 * The teacher and every one of the set standing at the seat. A lesson whose
 * master lives outside these walls is not placed here: the room is not in them.
 */
export function whoIsAtAClosedLesson(
    state: Pick<WorldState, 'locations' | 'npcs'>,
    input: { seatId: string; inside: ReadonlySet<string>; day: number }
): Map<string, string> {
    const at = new Map<string, string>();
    const byId = new Map(state.npcs.map(n => [n.id, n] as const));
    for (const teacher of state.npcs) {
        if (teacher.locationId !== input.seatId || !isAClosedLesson(byId, teacher, input.day)) continue;
        const room = whereAMasterLives(state, teacher);
        if (room === null || !input.inside.has(room.id)) continue;
        at.set(teacher.id, room.id);
        for (const id of teacher.activity!.withIds) {
            if (byId.get(id)?.locationId === input.seatId) at.set(id, room.id);
        }
    }
    return at;
}
