/**
 * Who is given attention this year, by whom, and in what set.
 *
 * Guidance is attention given to a set, and a master with one disciple, a
 * master with several and a hall lecture are the same mechanic: a person whose
 * activity is `teaching` with the set in `withIds`. The set is CLOSED - the
 * disciples who hold a master tie to them and are standing where they stand -
 * or OPEN - everybody inside the house's own compound, any rank and any guest,
 * because a lecture is given inside the sect and reaches whoever is there. A
 * closed set is held where the master lives - *"the master calls his disciples
 * to his cave abode or room"* - which the placement read derives from this row
 * (`where-a-master-takes-their-own-disciples.ts`); nothing here writes a room.
 *
 * What the attention is worth is read elsewhere and once: `guidanceFor` in
 * `an-npc-striking-at-the-next-wall.ts` takes the listener's best teacher and
 * `guidanceMultiplier` thins it by the set's size. What it costs the teacher is
 * `whatTeachingLeavesOfAMastersRate`, the same whatever the set's size. And an
 * art comes across a shelf's gap only through somebody at this - see
 * `newlyEntitled`. The whole rule - both sets, who may give one, what it is worth to the
 * listener, to the teacher's own year and to the house - is written once, in
 * `how-far-up-the-world-reaches.md` under *A lecture, open and closed*.
 *
 * NOBODY IS PULLED OFF SOMETHING. A teacher is only somebody at the kind of
 * thing that stops for a lesson; an errand, a posting, a stall, a sickbed or a
 * conversation with somebody named in it stays what it was. Somebody away is
 * not there to be taught, which is why a house whose people are out in towns
 * gets less from its hall.
 */

import { forStream } from '../cultivation/rng.js';
import { isBelowTheLid } from './layers.js';
import {
    isAwayOnSomething,
    isTheWorldsToMove,
    type NpcActivity,
    type NpcRecord,
    whatStandsBetween,
    type NpcRelationship
} from './npc-state.js';
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

function freeToTeach(npc: NpcRecord, day: number): boolean {
    if (npc.status !== 'alive' || !isBelowTheLid(npc) || !isTheWorldsToMove(npc)) return false;
    if (npc.locationId === null) return false;
    const a = npc.activity;
    if (a === null) return true;
    if (isAwayOnSomething(a.kind)) return false;
    // Somebody in the middle of making a thing is busy with it until it is made.
    if (isMakingSomething(a, day)) return false;
    if (a.kind !== 'teaching' && a.withIds.length > 0) return false;
    return SETS_DOWN_FOR_A_LESSON.has(a.kind);
}

/**
 * Whether a master is free for their OWN, which is a lower bar than a lecture.
 *
 * The design owner: a master with personal disciples gives them their attention
 * as a matter of course - it is what the bond is, and what the oath to teach
 * assumes - and *"masters away or at a desk genuinely neglect them"*. So the work
 * of a rung, a conversation, a table of people: all of it is set down for their
 * own. Being away, or in the middle of making a thing, is not.
 */
function freeForTheirOwn(npc: NpcRecord, day: number): boolean {
    if (npc.status !== 'alive' || !isBelowTheLid(npc) || !isTheWorldsToMove(npc)) return false;
    if (npc.locationId === null) return false;
    const a = npc.activity;
    if (a === null) return true;
    return !isAwayOnSomething(a.kind) && !isMakingSomething(a, day);
}

function present(npc: NpcRecord): boolean {
    return npc.status === 'alive' && isBelowTheLid(npc) && npc.locationId !== null
        && !(npc.activity !== null && isAwayOnSomething(npc.activity.kind));
}

/**
 * How long attention counts as recent: a decade.
 *
 * It was one turn of this pass, a year, which is how long a set of lessons runs.
 * The design owner, on the neglect window and on this: *"cultivators' lives are
 * so, so long."* A year is a blink to somebody with three centuries left, and
 * the thing this measures is not the bookkeeping of a set but whether a person
 * feels they have lately given you their time: a master who spent a season on
 * you eight years ago remembers it, and it is still a reason to say the next ask
 * comes out of their own road. Read by what an ask costs somebody
 * (`gaveAttentionRecently`) and by {@link theStandingOfALongSilence}, which is
 * what a bond nobody tends now loses instead of the neglect charge that was
 * taken out; the world's own teaching pass runs on the year and does not read
 * this.
 */
export const ATTENTION_IS_RECENT_FOR_DAYS = 10 * 365;

/**
 * Whether attention passed along this tie, either way, recently enough to count.
 *
 * `within` for a caller measuring something else on its own clock: what a fresh
 * ask costs somebody is a question about this year, not about the decade this
 * constant measures. See `A_REPEAT_ASK_IS_WITHIN_DAYS`.
 */
export function gaveAttentionRecently(
    tie: Pick<NpcRelationship, 'lastAttentionOnDay'> | null | undefined,
    day: number,
    within: number = ATTENTION_IS_RECENT_FOR_DAYS
): boolean {
    const last = tie?.lastAttentionOnDay;
    return last !== null && last !== undefined && day - last <= within;
}

/**
 * How much a year of somebody's attention warms the tie it ran along, and how
 * much a decade of silence cools it.
 *
 * The design owner, on taking the neglect penalty out: *"how they feel about you
 * is still counted, however."* There is no mechanical charge for a master who
 * never teaches any more; what there is instead is the ordinary standing the
 * resolver already reads on every ask. A master who sat with you for two
 * centuries is warm and says yes; one who has not looked at you since the day
 * they took you on goes cold, and you ask from there. Small, because a bond is
 * made of decades of these and neither end should swing on one year.
 */
export const ATTENTION_WARMS_A_TIE_BY = 0.02;
export const A_LONG_SILENCE_COOLS_A_TIE_BY = 0.01;

/** How cold a bond nobody tends can get. Cold, never an enemy: silence is not a wrong. */
export const A_TIE_GONE_COLD_STOPS_AT = 0;

/**
 * The same person with attention recorded as passing between them and somebody
 * they hold a tie to, on this day, and the tie a little warmer for it. A person
 * they hold no tie to gets nothing written: a hall of strangers is not somebody
 * who gave you time.
 */
export function withAttentionRecorded(npc: NpcRecord, otherId: string, day: number): NpcRecord {
    // WHICH ROW IT LANDS ON. Rows are keyed by the pair and the kind, so a
    // master who is also this person's uncle holds two: the hours go on the one
    // the hours are about. Where nothing between them is a road, the most
    // defining row takes it, which is what a lecture to a hall writes.
    const theRoad = npc.relationships.filter(tie => tie.targetId === otherId
        && (tie.kind === 'master' || tie.kind === 'disciple'
            || tie.kind === 'teacher' || tie.kind === 'student'));
    const stamped = theRoad.length > 0 ? theRoad : whatStandsBetween(npc, otherId).slice(0, 1);
    if (stamped.length === 0) return npc;
    if (stamped.every(tie => (tie.lastAttentionOnDay ?? -Infinity) >= day)) return npc;
    const take = new Set(stamped.map(tie => tie.kind));
    return {
        ...npc,
        relationships: npc.relationships.map(tie =>
            tie.targetId === otherId && take.has(tie.kind)
                ? {
                    ...tie,
                    lastAttentionOnDay: day,
                    standing: Math.min(1, tie.standing + ATTENTION_WARMS_A_TIE_BY)
                }
                : tie)
    };
}

/**
 * The ties nobody has tended in a decade, gone one step colder. Mutates `state`.
 * Returns how many cooled.
 *
 * Only ties that carry an expectation of time: a master and their disciple, a
 * teacher and the junior they were handed. A friendship is not owed hours, and
 * an acquaintance you have not seen in a decade is exactly what an acquaintance
 * is.
 */
export function theStandingOfALongSilence(state: WorldState, day: number): number {
    let cooled = 0;
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i]!;
        if (npc.status !== 'alive') continue;
        let touched = false;
        const relationships = npc.relationships.map(tie => {
            if (tie.kind !== 'master' && tie.kind !== 'disciple'
                && tie.kind !== 'teacher' && tie.kind !== 'student') return tie;
            const last = tie.lastAttentionOnDay ?? tie.sinceDay;
            if (day - last <= ATTENTION_IS_RECENT_FOR_DAYS) return tie;
            if (tie.standing <= A_TIE_GONE_COLD_STOPS_AT) return tie;
            touched = true;
            cooled++;
            return {
                ...tie,
                standing: Math.max(A_TIE_GONE_COLD_STOPS_AT, tie.standing - A_LONG_SILENCE_COOLS_A_TIE_BY)
            };
        });
        if (touched) state.npcs[i] = { ...npc, relationships, updatedOnDay: day };
    }
    return cooled;
}

/** Whether this activity is work that makes a thing, still under way on this day. */
export function isMakingSomething(activity: NpcActivity | null, day: number): boolean {
    return activity !== null && typeof activity.thingId === 'string'
        && activity.untilDay !== null && activity.untilDay !== undefined && activity.untilDay > day;
}

/**
 * Stamp the ties last year's attention ran along, both ends, with the day it
 * ended. A set that is still standing when its term has run is a set that was
 * given. One whose activity something else replaced before then is not
 * stamped: nothing records how much of it happened, and claiming all of it
 * would be the engine inventing time somebody spent.
 */
function recordTheAttentionThatEnded(
    state: WorldState,
    byId: ReadonlyMap<string, number>,
    day: number
): void {
    for (let i = 0; i < state.npcs.length; i++) {
        const teacher = state.npcs[i]!;
        const a = teacher.activity;
        if (teacher.status !== 'alive' || a === null || a.kind !== 'teaching') continue;
        if (a.untilDay === null || a.untilDay === undefined || a.untilDay > day) continue;
        const ended = a.untilDay;
        for (const id of a.withIds) {
            const j = byId.get(id);
            if (j === undefined) continue;
            state.npcs[i] = withAttentionRecorded(state.npcs[i]!, id, ended);
            state.npcs[j] = withAttentionRecorded(state.npcs[j]!, teacher.id, ended);
        }
    }
}

/** Write this year's attention onto the teachers. Returns how many sets were given it. */
export function giveThisYearsAttention(state: WorldState, year: number, day: number): number {
    const untilDay = year * 365 + 364;
    const byId = new Map(state.npcs.map((n, i) => [n.id, i] as const));
    recordTheAttentionThatEnded(state, byId, day);
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
        // STAMPED WHEN IT IS GIVEN, and not only when the set ends. The end is
        // read off the teacher's activity a year later, and everything else in
        // the world writes activities too: a master whose row was moved on before
        // the next pass had given their disciples a year of their time and the
        // tie said nobody had. Measured on `afford-a`: 60 of 70 bonds seeded at
        // the opening read as neglected by year five, while the pass had put
        // their masters in front of them every year.
        for (const id of withIds) {
            const j = byId.get(id);
            if (j === undefined) continue;
            state.npcs[at] = withAttentionRecorded(state.npcs[at]!, id, day);
            state.npcs[j] = withAttentionRecorded(state.npcs[j]!, teacher.id, day);
        }
        teaching.add(teacher.id);
        sets++;
    };

    // ── CLOSED: A MASTER AND THE DISCIPLES STANDING WITH THEM ────────────
    const disciplesOf = new Map<string, string[]>();
    for (const npc of state.npcs) {
        // Everybody they carry, away or not: who is here decides the lesson, and
        // who is away decides whether the oath's clock runs. See below.
        if (npc.status !== 'alive' || !isBelowTheLid(npc)) continue;
        for (const tie of npc.relationships) {
            // The people somebody carries: the disciples they took on, and the
            // juniors the house has them carrying through a manual.
            if (tie.kind !== 'master' && tie.kind !== 'teacher') continue;
            const list = disciplesOf.get(tie.targetId) ?? [];
            list.push(npc.id);
            disciplesOf.set(tie.targetId, list);
        }
    }
    for (const [masterId, disciples] of disciplesOf) {
        const at = byId.get(masterId);
        if (at === undefined) continue;
        const master = state.npcs[at]!;
        if (!freeForTheirOwn(master, day)) continue;
        const here = disciples.filter(id => {
            const d = state.npcs[byId.get(id)!]!;
            if (!present(d)) return false;
            // THEIR OWN, WHEREVER THEY HAVE GOT TO. A master gives their
            // disciples their time as a matter of course; it is what the bond is
            // and what the oath to teach assumes. The rung they have reached is
            // not the question - a disciple who has caught their master up is
            // still theirs - so only being somewhere else stops it.
            return d.locationId === master.locationId;
        });
        // AND THE ONES THE HOUSE HAS SENT SOMEWHERE. A master free and standing
        // at home cannot sit with a disciple who is two provinces away on the
        // house's business, and is not neglecting them: the clock on the oath to
        // teach does not run while the disciple is away. What it runs on is a
        // master who is away themselves, or at a desk with a thing half made.
        for (const id of disciples) {
            const j = byId.get(id);
            if (j === undefined || here.includes(id)) continue;
            const away = state.npcs[j]!.activity;
            if (away === null || !isAwayOnSomething(away.kind)) continue;
            state.npcs[at] = withAttentionRecorded(state.npcs[at]!, id, day);
            state.npcs[j] = withAttentionRecorded(state.npcs[j]!, masterId, day);
        }
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
            if (n.factionId !== house.id || teaching.has(n.id) || !freeToTeach(n, day)) continue;
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

    // And the ties nobody tended this year, or in the ten before it, gone a step
    // colder. What used to be a charge on a master's dao heart is this now.
    theStandingOfALongSilence(state, day);
    return sets;
}
