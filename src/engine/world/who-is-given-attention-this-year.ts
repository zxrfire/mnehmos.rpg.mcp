/**
 * Who is given attention this year, by whom, and in what set.
 *
 * Guidance is attention given to a set, and a master with one disciple, a
 * master with several and a hall lecture are the same mechanic: a person whose
 * activity is `teaching` with the set in `withIds`. The set is CLOSED - the
 * disciples who hold a master tie to them and are standing where they stand -
 * or OPEN - everybody inside the house's own compound, any rank and any guest,
 * because a lecture is given inside the sect and reaches whoever is there.
 *
 * What the attention is worth is read elsewhere and once: `guidanceFor` in
 * `an-npc-striking-at-the-next-wall.ts` takes the listener's best teacher and
 * `guidanceMultiplier` thins it by the set's size. What it costs the teacher is
 * `whatTeachingLeavesOfAMastersRate`, the same whatever the set's size. And an
 * art comes across a shelf's gap only through somebody at this - see
 * `newlyEntitled`.
 *
 * NOBODY IS PULLED OFF SOMETHING. A teacher is only somebody at the kind of
 * thing that stops for a lesson; an errand, a posting, a stall, a sickbed or a
 * conversation with somebody named in it stays what it was. Somebody away is
 * not there to be taught, which is why a house whose people are out in towns
 * gets less from its hall.
 */

import { forStream } from '../cultivation/rng.js';
import { isBelowTheLid } from './layers.js';
import { isAwayOnSomething, isTheWorldsToMove, type NpcActivity, type NpcRecord } from './npc-state.js';
import type { WorldState } from './world-state.js';
import { creditMerit, whatAttentionIsWorth } from './what-a-house-counts-in-somebodys-favour.js';

/**
 * How often a house holds a lecture, as a share of years.
 *
 * Routine rather than rare - the design owner's word - and not every year,
 * because the most advanced person free in a compound has their own
 * cultivation to see to. Half.
 */
export const A_HOUSE_LECTURES_THIS_SHARE_OF_YEARS = 0.5;

/** The kinds a person will set down to teach. Everything else keeps them. */
const SETS_DOWN_FOR_A_LESSON: ReadonlySet<NpcActivity['kind']> = new Set([
    'idle', 'their_practice', 'the_work_of_their_rank', 'at_the_shelves',
    'comprehending', 'drawing_on_the_ground', 'teaching'
]);

function freeToTeach(npc: NpcRecord): boolean {
    if (npc.status !== 'alive' || !isBelowTheLid(npc) || !isTheWorldsToMove(npc)) return false;
    if (npc.locationId === null) return false;
    const a = npc.activity;
    if (a === null) return true;
    if (isAwayOnSomething(a.kind)) return false;
    if (a.kind !== 'teaching' && a.withIds.length > 0) return false;
    return SETS_DOWN_FOR_A_LESSON.has(a.kind);
}

function present(npc: NpcRecord): boolean {
    return npc.status === 'alive' && isBelowTheLid(npc) && npc.locationId !== null
        && !(npc.activity !== null && isAwayOnSomething(npc.activity.kind));
}

/** Write this year's attention onto the teachers. Returns how many sets were given it. */
export function giveThisYearsAttention(state: WorldState, year: number, day: number): number {
    const untilDay = year * 365 + 364;
    const byId = new Map(state.npcs.map((n, i) => [n.id, i] as const));
    const teaching = new Set<string>();
    let sets = 0;

    const teach = (at: number, withIds: string[], note: string): void => {
        const teacher = state.npcs[at]!;
        // Attention given is service to the teacher's own house, priced as a
        // player's talk is: see `what-a-house-counts-in-somebodys-favour.ts`.
        const ofTheHouse = withIds.filter(id => {
            const i = byId.get(id);
            return i !== undefined && state.npcs[i]!.factionId === teacher.factionId;
        }).length;
        const worth = whatAttentionIsWorth(
            teacher.cultivation.realmOrdinal, untilDay - day, ofTheHouse, withIds.length);
        state.npcs[at] = {
            ...creditMerit(teacher, worth),
            activity: { kind: 'teaching', note, withIds, sinceDay: day, untilDay },
            updatedOnDay: day
        };
        teaching.add(teacher.id);
        sets++;
    };

    // ── CLOSED: A MASTER AND THE DISCIPLES STANDING WITH THEM ────────────
    const disciplesOf = new Map<string, string[]>();
    for (const npc of state.npcs) {
        if (!present(npc)) continue;
        for (const tie of npc.relationships) {
            if (tie.kind !== 'master') continue;
            const list = disciplesOf.get(tie.targetId) ?? [];
            list.push(npc.id);
            disciplesOf.set(tie.targetId, list);
        }
    }
    for (const [masterId, disciples] of disciplesOf) {
        const at = byId.get(masterId);
        if (at === undefined) continue;
        const master = state.npcs[at]!;
        if (!freeToTeach(master)) continue;
        const here = disciples.filter(id => {
            const d = state.npcs[byId.get(id)!]!;
            return d.locationId === master.locationId
                && d.cultivation.realmOrdinal < master.cultivation.realmOrdinal;
        });
        if (here.length === 0) continue;
        teach(at, here, 'taking their disciples through what they have');
    }

    // ── OPEN: A LECTURE INSIDE THE HOUSE'S OWN COMPOUND ──────────────────
    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null || !isBelowTheLid(house) || house.seatLocationId === null) continue;
        if (!forStream(state.seed, 'a-lecture', house.id, year).chance(A_HOUSE_LECTURES_THIS_SHARE_OF_YEARS)) continue;
        const inside = state.npcs.filter(n => n.locationId === house.seatLocationId && present(n));
        // The most advanced of the house who is free: an elder, an inner
        // disciple, an outer one if nobody else is.
        let lecturerAt = -1;
        for (const n of inside) {
            if (n.factionId !== house.id || teaching.has(n.id) || !freeToTeach(n)) continue;
            const at = byId.get(n.id)!;
            if (lecturerAt < 0 || n.cultivation.realmOrdinal > state.npcs[lecturerAt]!.cultivation.realmOrdinal) {
                lecturerAt = at;
            }
        }
        if (lecturerAt < 0) continue;
        const lecturer = state.npcs[lecturerAt]!;
        const hall = inside
            .filter(n => n.id !== lecturer.id && n.cultivation.realmOrdinal < lecturer.cultivation.realmOrdinal)
            .map(n => n.id);
        if (hall.length === 0) continue;
        teach(lecturerAt, hall, 'giving a lecture to whoever in the compound came to hear it');
    }
    return sets;
}
