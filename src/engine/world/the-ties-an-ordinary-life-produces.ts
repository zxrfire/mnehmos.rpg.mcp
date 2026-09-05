/**
 * The ties an ordinary life produces.
 */

import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import { DAYS_PER_YEAR, GUIDANCE_FULL_GAP } from '../cultivation/cultivation.js';
import { isBelowTheLid } from './layers.js';
// The one number the whole file is calibrated against, imported rather than
// retyped for the reason `time.ts` states: a threshold that exists in two
// places has already started to drift.
import { FRIENDSHIP_STANDING } from './gatherings.js';
import {
    admissionOffer,
    manualCeilingOf,
    shelfOf,
    shelfReach,
    suitsRoot,
    type Manual
} from './manuals.js';
import type { Blocked, Promotion } from './promotion-inside-a-house.js';
import { recordMasterTaken } from './recording-where-somebody-stands-in-a-house.js';
import {
    upsertRelationship,
    type NpcRecord,
    type RelationshipKind
} from './npc-state.js';
import type { FactionRecord, WorldState } from './world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// STANDINGS
//
// Every one of these is a stored fact about how consequential the tie is, not a
// warmth score and not a function of anybody's cultivation. The numbers matter
// against exactly two thresholds, both owned elsewhere and both imported by the
// consumers rather than restated here: `FRIENDSHIP_STANDING` (0.4), above which
// a tie of a waiting kind produces a `reunion` goal, and `DEFINING_STANDING`
// (0.8), above which somebody waits twice as long.
// ─────────────────────────────────────────────────────────────────────────

/**
 * A household, and the only tie in this file placed above the defining line.
 */
export const SPOUSE_STANDING = 0.85;

/** A parent's view of a child. Slightly the heavier half of the pair. */
export const CHILD_STANDING = 0.75;
/** A child's view of a parent. */
export const PARENT_STANDING = 0.7;
/** Siblings. Real, and routinely not the strongest tie in either life. */
export const SIBLING_STANDING = 0.5;

/** What a student thinks of the person carrying them. */
export const MASTER_STANDING = 0.6;
/** What the teacher thinks of the student. Lower: they have others. */
export const DISCIPLE_STANDING = 0.5;

/** Where a tie starts when two people have done nothing but share a hall. */
export const SERVICE_OPENING_STANDING = 0.15;
/** What another decade of it adds. Crossing the friendship line takes five. */
export const SERVICE_PER_DEEPENING = 0.06;
/** Service alone never makes somebody the person you would wait a life for. */
export const SERVICE_CEILING = 0.55;

/** Somebody took the seat you had met the bar for. */
export const PASSED_OVER_STANDING = -0.3;

// ─────────────────────────────────────────────────────────────────────────
// BOUNDS AND RATES
// ─────────────────────────────────────────────────────────────────────────

/**
 * Children in one household before the world stops offering that parent.
 */
export const SIBLINGS_PER_HOUSEHOLD = 4;

/** Age at which the world will pair somebody off. */
export const HOUSEHOLD_MIN_AGE = 18;

/**
 * Chance per unattached adult per year of forming a household.
 */
export const HOUSEHOLD_PER_YEAR = 0.03;

/**
 * Students one person is carrying at a time.
 */
export const STUDENTS_AT_ONCE = 3;

/**
 * Master ties one student may hold at once.
 */
export const MASTERS_AT_ONCE = 3;

/**
 * Students one person carries at a time, priced by how far they are reaching DOWN
 * to do it.
 */
export function studentsAtOnce(gap: number): number {
    if (gap >= 8) return 1;
    if (gap >= 5) return 2;
    if (gap >= 3) return 4;
    return 6;
}

/**
 * Chance per year that a pair who serve together get any further with it.
 */
export const SERVICE_PER_YEAR = 0.08;

/** Pairs one house looks at in a year. A hall is not a mixer. */
export const SERVICE_PAIRS_PER_HOUSE = 2;

// ─────────────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────────────────

/** Ties that mean these two are already family. Nobody marries into one. */
const BLOOD_KINDS = new Set<RelationshipKind>(['spouse', 'kin', 'parent', 'child']);

function ageInYears(npc: NpcRecord, onDay: number): number {
    return Math.floor((onDay - npc.identity.bornOnDay) / DAYS_PER_YEAR);
}

function isHere(npc: NpcRecord): boolean {
    return npc.status === 'alive' && isBelowTheLid(npc);
}

/**
 * One walk of the roster, shared by every pass in the file.
 */
export interface Roster {
    /** Index into `state.npcs`, for writing a record back in place. */
    at: Map<string, number>;
    /** Everybody acting in the lower world right now. Bounded. */
    living: NpcRecord[];
}

export function rosterOf(state: WorldState): Roster {
    const at = new Map<string, number>();
    const living: NpcRecord[] = [];
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i];
        at.set(npc.id, i);
        if (isHere(npc)) living.push(npc);
    }
    return { at, living };
}

/**
 * Write one half of a tie, in place.
 *
 * Never lowers a standing that is already higher: these passes run every year
 * over the same people, and a service roll must not quietly demote a marriage.
 */
function bind(
    state: WorldState,
    at: Map<string, number>,
    fromId: string,
    to: NpcRecord,
    kind: RelationshipKind,
    standing: number,
    note: string,
    day: number
): void {
    const i = at.get(fromId);
    if (i === undefined) return;
    const holder = state.npcs[i];
    const prev = holder.relationships.find(r => r.targetId === to.id);
    if (prev && prev.standing >= standing && prev.kind === kind) return;
    state.npcs[i] = upsertRelationship(holder, {
        targetId: to.id,
        targetName: to.name,
        kind,
        standing: prev ? Math.max(prev.standing, standing) : standing,
        note
    }, day);
}

// ─────────────────────────────────────────────────────────────────────────
// KIN
// ─────────────────────────────────────────────────────────────────────────

/** Everybody a birth attached the newborn to. Reported, never re-derived. */
export interface Household {
    /**
     * The child, with its half of every tie on it.
     */
    child: NpcRecord;
    parentIds: string[];
    siblingIds: string[];
}

/**
 * Somebody already in this world who could be a parent to a newborn here.
 */
export function couldParent(candidates: readonly NpcRecord[], childAge: number, day: number): NpcRecord[] {
    return candidates.filter(n =>
        isHere(n) &&
        ageInYears(n, day) >= childAge + HOUSEHOLD_MIN_AGE &&
        n.relationships.filter(r => r.kind === 'child').length < SIBLINGS_PER_HOUSEHOLD
    );
}

/**
 * Write the household a birth actually creates.
 */
export function bindNewbornToHousehold(
    state: WorldState,
    child: NpcRecord,
    parentId: string,
    day: number,
    roster: Roster = rosterOf(state)
): Household {
    const { at } = roster;
    // Re-read rather than trusting the caller's snapshot: a birth pass places
    // several children in one year and an earlier one may already have added a
    // sibling to this parent's record.
    const parentAt = at.get(parentId);
    if (parentAt === undefined) return { child, parentIds: [], siblingIds: [] };
    const parent = state.npcs[parentAt];
    const parents: NpcRecord[] = [parent];

    // A household, when there is one. The second parent is not invented: it is
    // whoever this person is already married to, and if they are not married
    // the child has one parent, which is common and is not a gap.
    const spouseTie = parent.relationships.find(r => r.kind === 'spouse');
    if (spouseTie) {
        const j = at.get(spouseTie.targetId);
        const spouse = j === undefined ? null : state.npcs[j];
        if (spouse && isHere(spouse)) parents.push(spouse);
    }

    const siblingIds = new Set<string>();
    for (const p of parents) {
        for (const tie of p.relationships) {
            if (tie.kind !== 'child' || tie.targetId === child.id) continue;
            const j = at.get(tie.targetId);
            if (j !== undefined && isHere(state.npcs[j])) siblingIds.add(tie.targetId);
        }
    }

    let updated = child;
    for (const p of parents) {
        bind(state, at, p.id, child, 'child', CHILD_STANDING, 'Their child.', day);
        updated = upsertRelationship(updated, {
            targetId: p.id,
            targetName: p.name,
            kind: 'parent',
            standing: PARENT_STANDING,
            note: 'Raised them.'
        }, day);
    }
    for (const id of siblingIds) {
        const j = at.get(id);
        if (j === undefined) continue;
        const sibling = state.npcs[j];
        bind(state, at, sibling.id, child, 'kin', SIBLING_STANDING, 'Same household.', day);
        updated = upsertRelationship(updated, {
            targetId: sibling.id,
            targetName: sibling.name,
            kind: 'kin',
            standing: SIBLING_STANDING,
            note: 'Same household.'
        }, day);
    }

    return {
        child: updated,
        parentIds: parents.map(p => p.id),
        siblingIds: [...siblingIds].sort()
    };
}

// ─────────────────────────────────────────────────────────────────────────
// HOUSEHOLDS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Two unattached adults standing in the same place.
 */
export function applyHouseholds(
    state: WorldState,
    year: number,
    day: number,
    roster: Roster = rosterOf(state)
): number {
    const rng = forStream(state.seed, 'households', year);
    const { at, living } = roster;

    const byPlace = new Map<string, NpcRecord[]>();
    for (const npc of living) {
        if (npc.locationId === null) continue;
        if (ageInYears(npc, day) < HOUSEHOLD_MIN_AGE) continue;
        if (npc.relationships.some(r => r.kind === 'spouse')) continue;
        const list = byPlace.get(npc.locationId);
        if (list) list.push(npc); else byPlace.set(npc.locationId, [npc]);
    }

    let made = 0;
    // Sorted so the pass is a function of the world and not of push order.
    for (const placeId of [...byPlace.keys()].sort()) {
        const free = byPlace.get(placeId)!.sort((a, b) => (a.id < b.id ? -1 : 1));
        const spoken = new Set<string>();
        for (let i = 0; i < free.length; i++) {
            const one = free[i];
            if (spoken.has(one.id)) continue;
            if (!rng.chance(HOUSEHOLD_PER_YEAR)) continue;
            for (let j = i + 1; j < free.length; j++) {
                const other = free[j];
                if (spoken.has(other.id)) continue;
                // Nobody marries into their own household. Read off the ties
                // this module has already written, in both directions, because
                // one half can exist without the other after an inheritance.
                if (one.relationships.some(r => r.targetId === other.id && BLOOD_KINDS.has(r.kind))) continue;
                if (other.relationships.some(r => r.targetId === one.id && BLOOD_KINDS.has(r.kind))) continue;

                bind(state, at, one.id, other, 'spouse', SPOUSE_STANDING, 'Their household.', day);
                bind(state, at, other.id, one, 'spouse', SPOUSE_STANDING, 'Their household.', day);
                spoken.add(one.id);
                spoken.add(other.id);
                made++;
                break;
            }
        }
    }
    return made;
}

// ─────────────────────────────────────────────────────────────────────────
// TEACHING LINES
// ─────────────────────────────────────────────────────────────────────────

export interface TeachingLine {
    studentId: string;
    teacherId: string;
    factionId: string;
    /** The teacher's rank in the house. The number the ruling turns on. */
    teacherRankIndex: number;
    studentRankIndex: number;
    teacherOrdinal: number;
    /** The house's own strongest member, for reading the two textures apart. */
    housePowerOrdinal: number;
    manualId: string;
}

/**
 * What this student needs a person for.
 */
function whatTheyNeedTaught(
    state: WorldState,
    student: NpcRecord,
    shelf: readonly Manual[],
    rankCount: number
): Manual[] {
    if (!student.factionId || shelf.length === 0) return [];
    const reach = student.tags.includes('chosen')
        ? shelf.length
        : shelfReach(student.factionRankIndex, rankCount, shelf.length);

    const bookless =
        manualCeilingOf(student) === 0 &&
        admissionOffer(student.factionId, state.seed) === 'a_teacher';

    const held = new Set(student.cultivation.techniqueIds);
    return shelf.slice(0, reach).filter(m =>
        !held.has(m.id) &&
        suitsRoot(student.cultivation.spiritRoot, m.element) &&
        (bookless || m.requiredOrdinal > student.cultivation.realmOrdinal)
    );
}

/**
 * Who can open a given manual, closest in rank first.
 */
function teachersByManual(members: readonly NpcRecord[], shelf: readonly Manual[]): Map<string, NpcRecord[]> {
    const wanted = new Map<string, Manual>();
    for (const m of shelf) wanted.set(m.id, m);

    const out = new Map<string, NpcRecord[]>();
    for (const npc of members) {
        for (const id of npc.cultivation.techniqueIds) {
            const m = wanted.get(id);
            if (!m || npc.cultivation.realmOrdinal < m.requiredOrdinal) continue;
            const list = out.get(id);
            if (list) list.push(npc); else out.set(id, [npc]);
        }
    }
    for (const list of out.values()) {
        list.sort((a, b) =>
            a.factionRankIndex - b.factionRankIndex ||
            a.cultivation.realmOrdinal - b.cultivation.realmOrdinal ||
            (a.id < b.id ? -1 : 1)
        );
    }
    return out;
}

/**
 * Name the person behind every transmission the world was already modelling.
 */
export function applyTeachingLines(
    state: WorldState,
    day: number,
    roster: Roster = rosterOf(state)
): TeachingLine[] {
    const { at, living } = roster;
    const byHouse = new Map<string, NpcRecord[]>();
    for (const npc of living) {
        if (!npc.factionId || npc.factionRankIndex < 0) continue;
        const list = byHouse.get(npc.factionId);
        if (list) list.push(npc); else byHouse.set(npc.factionId, [npc]);
    }

    const lines: TeachingLine[] = [];
    for (const factionId of [...byHouse.keys()].sort()) {
        const members = byHouse.get(factionId)!;
        // The shelf the house HAS, not the one the catalog gave it - so a hall
        // founded by people who walked out with their books has teaching lines
        // in it, the same as anywhere else. See `shelfOf`.
        const shelf = shelfOf(state, factionId);
        if (shelf.length === 0) continue;
        const faction = state.factions.find(f => f.id === factionId);
        if (!faction || faction.dissolvedOnDay !== null) continue;

        const index = teachersByManual(members, shelf);
        if (index.size === 0) continue;

        // Live load, counted against students still alive and still in the
        // house. A teacher whose disciples have died or left is free again.
        const load = new Map<string, number>();
        const here = new Set(members.map(m => m.id));
        for (const npc of members) {
            let n = 0;
            for (const tie of npc.relationships) {
                if (tie.kind === 'disciple' && here.has(tie.targetId)) n++;
            }
            load.set(npc.id, n);
        }

        const power = Number(faction.resources.power_ordinal ?? 0);
        const rankCount = Math.max(1, faction.ranks.length);
        // The deepest LIVING master already standing above each student, which
        // is what `guideOrdinalFor` will read and therefore the only thing that
        // decides whether another master is worth anything to them.
        const guideOf = (n: NpcRecord): number | null => {
            let best: number | null = null;
            for (const tie of n.relationships) {
                if (tie.kind !== 'master') continue;
                const i = at.get(tie.targetId);
                if (i === undefined) continue;
                const m = state.npcs[i];
                if (m.status !== 'alive') continue;
                if (best === null || m.cultivation.realmOrdinal > best) {
                    best = m.cultivation.realmOrdinal;
                }
            }
            return best;
        };

        // Juniors first, so the scarce capacity in a thin house goes to the
        // people who cannot move at all without it.
        //
        // A student used to be dropped from this list the moment they held any
        // master at all, which is what made a tie a one-time event and let the
        // gap decay to nothing as they climbed past whoever taught them. They
        // are now dropped only when there is nothing left to gain: they already
        // hold the full complement, or somebody living is already far enough
        // above them to be worth the whole guidance term.
        const students = members
            .filter(n => {
                if (n.relationships.filter(r => r.kind === 'master').length >= MASTERS_AT_ONCE) {
                    return false;
                }
                const guide = guideOf(n);
                return guide === null || guide - n.cultivation.realmOrdinal < GUIDANCE_FULL_GAP;
            })
            .sort((a, b) =>
                a.factionRankIndex - b.factionRankIndex ||
                a.cultivation.realmOrdinal - b.cultivation.realmOrdinal ||
                (a.id < b.id ? -1 : 1)
            );

        for (const student of students) {
            const needs = whatTheyNeedTaught(state, student, shelf, rankCount);
            if (needs.length === 0) continue;

            // Masters accumulate UPWARD or not at all. A second teacher who is
            // no deeper than the one already standing over them adds nothing to
            // `guideOrdinalFor`, which reads the deepest living master - so
            // binding one would spend a teacher's hours to move no number, and
            // fill the student's three slots with people who cannot help.
            const already = guideOf(student);
            const floor = already ?? student.cultivation.realmOrdinal;

            let teacher: NpcRecord | null = null;
            let taught: Manual | null = null;
            for (const manual of needs) {
                for (const candidate of index.get(manual.id) ?? []) {
                    if (candidate.id === student.id) continue;
                    if (candidate.factionRankIndex < student.factionRankIndex) continue;
                    if (candidate.cultivation.realmOrdinal <= floor) continue;
                    // Already teaching them. `bind` upserts on target id, so
                    // without this the same pair is rebound every year and the
                    // student's slots read as one person three times.
                    if (student.relationships.some(r =>
                        r.kind === 'master' && r.targetId === candidate.id)) continue;
                    // The hours, priced by how far down the teacher is reaching.
                    const gap = candidate.cultivation.realmOrdinal - student.cultivation.realmOrdinal;
                    if ((load.get(candidate.id) ?? 0) >= studentsAtOnce(gap)) continue;
                    // Nobody is taught by their own child, and nobody is
                    // apprenticed to the person they are married to. Those are
                    // already relationships and the teaching kind would
                    // overwrite them.
                    if (student.relationships.some(r =>
                        r.targetId === candidate.id && BLOOD_KINDS.has(r.kind))) continue;
                    teacher = candidate;
                    taught = manual;
                    break;
                }
                if (teacher) break;
            }
            if (!teacher || !taught) continue;

            bind(state, at, student.id, teacher, 'master', MASTER_STANDING,
                `Teaches them ${taught.name}.`, day);
            bind(state, at, teacher.id, student, 'disciple', DISCIPLE_STANDING,
                `Carrying them through ${taught.name}.`, day);
            load.set(teacher.id, (load.get(teacher.id) ?? 0) + 1);
            // The tie carried `sinceDay` and the ledger said nothing, so a life
            // could hold a master and never record having taken one. Taking a
            // master is a life event at every altitude, and a life now takes at
            // most MASTERS_AT_ONCE of them, each strictly deeper than the last -
            // so this is a row that accumulates, three times at the very most,
            // and the sequence of them is the account of who carried this person
            // and how far.
            recordMasterTaken(state, student, teacher, taught.name, day);

            lines.push({
                studentId: student.id,
                teacherId: teacher.id,
                factionId,
                teacherRankIndex: teacher.factionRankIndex,
                studentRankIndex: student.factionRankIndex,
                teacherOrdinal: teacher.cultivation.realmOrdinal,
                housePowerOrdinal: power,
                manualId: taught.id
            });
        }
    }
    return lines;
}

// ─────────────────────────────────────────────────────────────────────────
// SERVED TOGETHER
// ─────────────────────────────────────────────────────────────────────────

/**
 * People at the same rank in the same house, year after year.
 */
export function applyServedTogether(
    state: WorldState,
    year: number,
    day: number,
    roster: Roster = rosterOf(state)
): number {
    const rng = forStream(state.seed, 'served-together', year);
    const { at, living } = roster;

    const byHouse = new Map<string, NpcRecord[]>();
    for (const npc of living) {
        if (!npc.factionId || npc.factionRankIndex < 0) continue;
        const list = byHouse.get(npc.factionId);
        if (list) list.push(npc); else byHouse.set(npc.factionId, [npc]);
    }

    let touched = 0;
    for (const factionId of [...byHouse.keys()].sort()) {
        const members = byHouse.get(factionId)!.sort((a, b) => (a.id < b.id ? -1 : 1));
        if (members.length < 2) continue;
        const inHouse = new Set(members.map(m => m.id));

        for (let draw = 0; draw < SERVICE_PAIRS_PER_HOUSE; draw++) {
            if (!rng.chance(SERVICE_PER_YEAR)) continue;
            const one = members[rng.int(0, members.length - 1)];

            // Deepen before opening. The person they already half-know, if any.
            const existing = one.relationships.find(r =>
                inHouse.has(r.targetId) &&
                (r.kind === 'acquaintance' || r.kind === 'ally') &&
                r.standing < SERVICE_CEILING
            );
            const other = existing
                ? members.find(m => m.id === existing.targetId) ?? null
                : pickPeer(members, one, rng);
            if (!other || other.id === one.id) continue;
            if (one.relationships.some(r => r.targetId === other.id && BLOOD_KINDS.has(r.kind))) continue;

            deepenService(state, at, one, other, day);
            deepenService(state, at, other, one, day);
            touched++;
        }
    }
    return touched;
}

/** Somebody standing at the same rung. Bounded scan, not a sort. */
function pickPeer(members: readonly NpcRecord[], one: NpcRecord, rng: CultivationRNG): NpcRecord | null {
    const peers = members.filter(m =>
        m.id !== one.id && m.factionRankIndex === one.factionRankIndex);
    if (peers.length === 0) return null;
    return peers[rng.int(0, peers.length - 1)];
}

function deepenService(
    state: WorldState,
    at: Map<string, number>,
    from: NpcRecord,
    to: NpcRecord,
    day: number
): void {
    const i = at.get(from.id);
    if (i === undefined) return;
    const holder = state.npcs[i];
    const prev = holder.relationships.find(r => r.targetId === to.id);
    // Never touches a tie this pass did not make. A rival is not softened by
    // sharing a hall with the person they lost the seat to, and a marriage is
    // not re-rated by the colleague roll.
    if (prev && prev.kind !== 'acquaintance' && prev.kind !== 'ally') return;
    const next = Math.min(
        SERVICE_CEILING,
        prev ? prev.standing + SERVICE_PER_DEEPENING : SERVICE_OPENING_STANDING
    );
    if (prev && next <= prev.standing) return;
    state.npcs[i] = upsertRelationship(holder, {
        targetId: to.id,
        targetName: to.name,
        // `ally` only once it has actually crossed the line the world calls a
        // friendship. Promoting the kind on the second roll, at 0.21, made
        // every hall in the world read as full of allies while none of the
        // standings behind them were anywhere near it.
        kind: next >= FRIENDSHIP_STANDING ? 'ally' : 'acquaintance',
        standing: next,
        note: 'Years in the same hall.'
    }, day);
}

// ─────────────────────────────────────────────────────────────────────────
// PASSED OVER
// ─────────────────────────────────────────────────────────────────────────

/**
 * Somebody took the seat you had already met the bar for.
 */
const PASSED_OVER_NOTE = 'Took the seat.';
export function applyPassedOver(
    state: WorldState,
    promotions: readonly Promotion[],
    blocked: readonly Blocked[],
    day: number,
    roster: Roster = rosterOf(state)
): number {
    if (blocked.length === 0 || promotions.length === 0) return 0;
    const { at } = roster;

    // Who was raised out of each queue, keyed the way the queue is keyed.
    const raised = new Map<string, string[]>();
    for (const p of promotions) {
        const key = `${p.factionId}:${p.fromRank}`;
        const list = raised.get(key);
        if (list) list.push(p.npcId); else raised.set(key, [p.npcId]);
    }

    let opened = 0;
    for (const b of blocked) {
        if (b.reason !== 'outranked') continue;
        const i = at.get(b.npcId);
        if (i === undefined) continue;
        const holder = state.npcs[i];
        if (!isHere(holder)) continue;
        if (holder.relationships.some(r => r.note === PASSED_OVER_NOTE)) continue;

        for (const winnerId of raised.get(`${b.factionId}:${b.atRank}`) ?? []) {
            if (winnerId === b.npcId) continue;
            if (holder.relationships.some(r => r.targetId === winnerId)) continue;
            const j = at.get(winnerId);
            if (j === undefined) continue;
            const winner = state.npcs[j];
            state.npcs[i] = upsertRelationship(state.npcs[i], {
                targetId: winner.id,
                targetName: winner.name,
                kind: 'rival',
                standing: PASSED_OVER_STANDING,
                note: PASSED_OVER_NOTE
            }, day);
            opened++;
            // One grievance per passing-over. The queue is not a list of
            // enemies; the person who got the seat is.
            break;
        }
    }
    return opened;
}

// ─────────────────────────────────────────────────────────────────────────
// THE YEARLY PASS
// ─────────────────────────────────────────────────────────────────────────

export interface OrdinaryLifeYear {
    households: number;
    teachingLines: TeachingLine[];
    serviceTouched: number;
}

/**
 * Everything in this file, on one walk of the roster.
 */
export function applyOrdinaryLifeTies(
    state: WorldState,
    year: number,
    day: number
): OrdinaryLifeYear {
    const roster = rosterOf(state);
    return {
        teachingLines: applyTeachingLines(state, day, roster),
        households: applyHouseholds(state, year, day, roster),
        serviceTouched: applyServedTogether(state, year, day, roster)
    };
}

// ─────────────────────────────────────────────────────────────────────────
// READING
// ─────────────────────────────────────────────────────────────────────────

export interface TieSupply {
    /** Directed rows held by living people, whoever they point at. */
    ties: number;
    /**
     * Rows pointing at somebody still in the world.
     */
    liveTies: number;
    byKind: Record<string, number>;
    /**
     * People with at least one LIVING tie at or above the friendship standing.
     * The population an absence can actually cost something.
     */
    withSomebody: number;
    /**
     * People with no living tie above that standing.
     */
    withNobody: number;
    living: number;
    /** Living ties per living person. The inflation number. */
    perHead: number;
}

/**
 * What the world currently has to lose.
 */
export function tieSupply(state: WorldState, friendshipStanding: number): TieSupply {
    const alive = new Set<string>();
    for (const npc of state.npcs) if (isHere(npc)) alive.add(npc.id);

    const byKind: Record<string, number> = {};
    let ties = 0;
    let liveTies = 0;
    let withSomebody = 0;
    let withNobody = 0;

    for (const npc of state.npcs) {
        if (!isHere(npc)) continue;
        let any = false;
        for (const rel of npc.relationships) {
            ties++;
            if (!alive.has(rel.targetId)) continue;
            liveTies++;
            byKind[rel.kind] = (byKind[rel.kind] ?? 0) + 1;
            if (rel.standing >= friendshipStanding) any = true;
        }
        if (any) withSomebody++; else withNobody++;
    }
    const living = alive.size;
    return {
        ties,
        liveTies,
        byKind,
        withSomebody,
        withNobody,
        living,
        perHead: living === 0 ? 0 : Math.round((liveTies / living) * 100) / 100
    };
}

/** The house a tie was produced inside, for reading the teaching textures apart. */
export function houseStrength(state: WorldState, factionId: string | null): number {
    if (!factionId) return 0;
    const faction: FactionRecord | undefined = state.factions.find(f => f.id === factionId);
    return Number(faction?.resources.power_ordinal ?? 0);
}
