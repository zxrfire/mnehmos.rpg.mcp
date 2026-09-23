/**
 * The ties an ordinary life produces.
 */

import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import { DAYS_PER_YEAR, GUIDANCE_FULL_GAP } from '../cultivation/cultivation.js';
import { FOUNDATION_ORDINAL } from '../cultivation/realms.js';
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
import { recordATeachingLine } from './recording-where-somebody-stands-in-a-house.js';
import {
    isATemperature,
    isTheWorldsToMove,
    upsertRelationship,
    type NpcRecord,
    type RelationshipKind
} from './npc-state.js';
import { andTheOtherEnd } from './a-tie-has-two-ends.js';
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

/**
 * What being carried through a manual by somebody of your own house is worth as
 * a tie, at each end.
 *
 * Below the line a friendship is read at (`FRIENDSHIP_STANDING`) on purpose: an
 * instructor is somebody you know and owe nothing to. A bond somebody took on is
 * {@link MASTER_STANDING} and {@link DISCIPLE_STANDING}, and this is not one.
 */
export const TAUGHT_BY_STANDING = 0.3;

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
 * Old enough, and not already carrying a household's worth of children.
 *
 * The half of {@link couldParent} that is about the person rather than about
 * whether they are still standing - extracted because the SECOND parent is
 * taken off a marriage rather than drawn, and a spouse who has died is still a
 * parent while a spouse younger than the child is not one.
 */
export function couldHaveBeenAParentTo(
    candidate: NpcRecord,
    childAge: number,
    day: number
): boolean {
    // AND THEY HAVE TO HAVE BEEN ALIVE WHEN THE CHILD WAS BORN.
    //
    // This asked the candidate's AGE and never their death, which is the whole
    // of the check for the parent that is DRAWN - `couldParent` asks `isHere`
    // first, so a corpse never reaches it. The second parent is INHERITED off a
    // spouse tie and reaches this function directly, so nothing stood between a
    // household and somebody who had been dead for years.
    //
    // Played, on `probe-w19`: a sixteen-year-old opened being told *"Ye Puxian.
    // Family. Did the raising. Killed 25 years ago."* - a person who died nine
    // years before the player existed, credited with having raised them. Two of
    // four such households in a thirty-thousand-birth sweep were like that.
    //
    // This is the asymmetry the banner on `bindNewbornToHousehold` is about,
    // caught a third time: every condition the drawn parent is held to, the
    // inherited one has to be held to here.
    const died = whenTheyDied(candidate);
    if (died !== null && died < day - childAge * DAYS_PER_YEAR) return false;
    return ageInYears(candidate, day) >= childAge + HOUSEHOLD_MIN_AGE
        && candidate.relationships.filter(r => r.kind === 'child').length < SIBLINGS_PER_HOUSEHOLD;
}

/**
 * The day somebody died, or null for anybody still standing or merely lost.
 *
 * `missing` and `unknown` are not deaths - `isUnadjudicated` says outright that
 * they mean the engine does not know what happened - and somebody unaccounted
 * for may perfectly well have fathered a child before they vanished.
 */
function whenTheyDied(npc: NpcRecord): number | null {
    return npc.status === 'physically_dead' ? npc.diedOnDay ?? null : null;
}

/**
 * The other children already in a household, whoever else is in it.
 *
 * WHO IS IN A HOUSEHOLD IS A READ, AND THE WRITE IS A SEPARATE QUESTION.
 * Extracted so a caller that only wants to NAME a household gets the same
 * answer as the one that binds it - `the-family-a-life-opens-with.ts` mentions
 * a mortal household without writing a row for it, and a second walk of the
 * parents' children there would be a second opinion about who somebody's
 * family is.
 *
 * AND A BROTHER WHO DIED IS STILL A BROTHER, IF HE CULTIVATED. The design
 * owner, generalising the mortal ruling to death: *"if sibling dies as a
 * mortal, drop. if dies as a cultivator, mark as dead in entities. this is true
 * for everyone."* So this asks {@link isBelowTheLid} and the realm rather than
 * {@link isHere}: somebody past {@link FOUNDATION_ORDINAL} who has died is a
 * person the world still holds and can still be asked about, and the opening
 * already knows how to say `Dead these 40 years.` A dead mortal is dropped,
 * because there is nothing to name - which is the same ruling, not a different
 * one.
 */
export function theOtherChildrenOf(
    state: WorldState,
    at: Map<string, number>,
    parents: readonly NpcRecord[],
    childId: string
): NpcRecord[] {
    const out = new Map<string, NpcRecord>();
    for (const parent of parents) {
        for (const tie of parent.relationships) {
            if (tie.kind !== 'child' || tie.targetId === childId) continue;
            const j = at.get(tie.targetId);
            if (j === undefined) continue;
            const them = state.npcs[j];
            if (!isBelowTheLid(them)) continue;
            if (them.status !== 'alive'
                && them.cultivation.realmOrdinal < FOUNDATION_ORDINAL) continue;
            out.set(tie.targetId, them);
        }
    }
    return [...out.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}

/**
 * The second parent a household gives, or null where it gives one.
 *
 * The same extraction {@link theOtherChildrenOf} is, for the same reason: a
 * caller that only wants to NAME a household has to get the answer the one that
 * binds it gets. `the-family-a-life-opens-with.ts` names a mortal household
 * without writing a row for it, and it named ONE parent - not because a mortal
 * household has one, but because the read for the other lived inside the write
 * and could not be asked. A killed mortal parent was invisible for that reason
 * alone.
 *
 * It is not invented: it is whoever this person is already married to, held to
 * every condition the drawn parent is held to except being alive, which is the
 * half a widowed household must not ask. {@link nothingElseBetween} is NOT asked
 * here - that is a rule about writing a row, and who is in a household does not
 * change because a row is in the way.
 */
export function theOtherParentOf(
    state: WorldState,
    at: Map<string, number>,
    parent: NpcRecord,
    childAge: number,
    day: number
): NpcRecord | null {
    const spouseTie = parent.relationships.find(r => r.kind === 'spouse');
    if (!spouseTie) return null;
    const j = at.get(spouseTie.targetId);
    const spouse = j === undefined ? null : state.npcs[j];
    if (!spouse || !isBelowTheLid(spouse)) return null;
    return couldHaveBeenAParentTo(spouse, childAge, day) ? spouse : null;
}

/**
 * Somebody already in this world who could be a parent to a newborn here.
 */
export function couldParent(candidates: readonly NpcRecord[], childAge: number, day: number): NpcRecord[] {
    return candidates.filter(n => isHere(n) && couldHaveBeenAParentTo(n, childAge, day));
}

/**
 * Whether these two already have something between them that a household must
 * not write over.
 *
 * `bind` upserts on the target id, so every tie this pass writes can overwrite
 * one somebody else wrote. That was guarded at the call site while the only
 * pair this pass touched was one it had chosen - and marriages broke it three
 * ways at once, all of them through the second parent and the siblings that
 * come with them: an `ally` between two house members became `parent`, and a
 * married couple who were both children of one household became each other's
 * `kin` at the spouse's own standing. A tie of the kind being written is fine;
 * anything else is somebody else's.
 *
 * EVERY ROW, AND ANY OTHER KIND REFUSES. Rows are keyed by the pair AND the
 * kind, so several things stand between two people at once and they sort with
 * the most defining first. Reading one row asked the sort: where the row on top
 * happened to BE the kind about to be written, the guard called the pair clear
 * and never saw the bond underneath - a household written over two people who
 * were already master and disciple. The store holding both is not permission
 * for both; this is a rule about what may stand between two people, not about
 * what an upsert would flatten.
 *
 * AND IT REFUSES RATHER THAN REASONS. A guard is the one place to be
 * conservative, because the costs are not symmetrical: a wrong pass writes an
 * incest or a household over a bond, and a wrong refusal is one sibling tie
 * that does not form in a world that makes thousands.
 *
 * THE TEMPERATURES ARE EXEMPT, AND THIS IS NOT A LOOSENING.
 *
 * `acquaintance`, `ally`, `rival` and `enemy` are one tie at four heats
 * (`isATemperature`), not four things standing between two people, and they sit
 * beside every structure by design - that is the whole reason they are keyed as
 * their own family. So what this guard is for is two STRUCTURES standing where
 * only one may: a master who is also a husband, a household written over a
 * bond. Two siblings who are also friends is not that, and refusing it is the
 * guard answering a question nobody asked.
 *
 * Do not restore a bare "any other kind refuses" here. It reads like the
 * careful choice and it is not one: it declines ordinary households on the
 * strength of how warm two people happen to be, which is a fact about their
 * feelings and never about what may stand between them.
 */
function nothingElseBetween(
    state: WorldState,
    at: Map<string, number>,
    child: NpcRecord,
    otherId: string,
    childWouldHold: RelationshipKind,
    theyWouldHold: RelationshipKind
): boolean {
    for (const row of child.relationships) {
        if (row.targetId !== otherId || isATemperature(row.kind)) continue;
        if (row.kind !== childWouldHold) return false;
    }
    const j = at.get(otherId);
    if (j === undefined) return true;
    for (const row of state.npcs[j].relationships) {
        if (row.targetId !== child.id || isATemperature(row.kind)) continue;
        if (row.kind !== theyWouldHold) return false;
    }
    return true;
}

/**
 * Write the household a birth actually creates.
 *
 * ONE PARENT IS DRAWN AND THE OTHER IS INHERITED, AND THAT ASYMMETRY IS WHERE
 * THE BUGS ARE. The caller picks the first parent and has already put them
 * through `couldParent`. The second is whoever that person is married to, and
 * for as long as nobody in any world was married it was taken on trust. The
 * first world to open holding marriages broke three things at once, all of them
 * on the inherited side:
 *
 *   a spouse born AFTER the child came back as their parent - `couldParent`
 *   checks the age of the one it draws and nothing checked the one it inherits
 *
 *   an `ally` between two house members was overwritten with `parent`, because
 *   `bind` upserts on the target id and the caller's guard covered only the
 *   pair it had chosen
 *
 *   a married couple attached to one household became each other's `kin` at
 *   0.85, because `bind` keeps the higher standing and a spouse's outranks a
 *   sibling's
 *
 * So every condition the drawn parent is held to, the inherited one is held to
 * here: {@link couldHaveBeenAParentTo} for the age and the household size, and
 * {@link nothingElseBetween} for anything already written between them. If you
 * add a rule about who may be a parent, it goes in both places or in neither.
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

    // Who the second parent is, and whether a row may be written for them, are
    // two questions. {@link theOtherParentOf} answers the first - including for
    // a spouse who has died, which is the half a widowed household must not ask
    // and which this site once got wrong in three ways at once. What stays here
    // is the second: `nothingElseBetween`, because a tie somebody else wrote is
    // a reason not to WRITE and never a reason to say the household is smaller
    // than it is.
    const childAge = ageInYears(child, day);
    const spouse = theOtherParentOf(state, at, parent, childAge, day);
    if (spouse && nothingElseBetween(state, at, child, spouse.id, 'parent', 'child')) {
        parents.push(spouse);
    }

    const siblingIds = new Set<string>();
    for (const sibling of theOtherChildrenOf(state, at, parents, child.id)) {
        // Two children of one household are siblings unless they are already
        // something to each other - which, since marriages exist, includes
        // being married. A `kin` row written over that is an incest the pass
        // invented out of an upsert. Asked here rather than in the membership
        // read, because it is a rule about WRITING: who is in the household
        // does not change because a row is in the way.
        if (!nothingElseBetween(state, at, child, sibling.id, 'kin', 'kin')) continue;
        siblingIds.add(sibling.id);
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
 * What a caller brings to the pairing rule, and nothing else.
 *
 * EXTRACTED SO TWO CALLERS REACH ONE STATE. `applyHouseholds` is the yearly
 * roll; `the-marriages-a-world-opens-holding.ts` is the same rule asked of a
 * world that has been going on without anybody. Who may be paired with whom,
 * in what order, at what standing and under what note live here and are not
 * restated at either call site - a seeded marriage is byte-identical to a
 * lived one, which is the requirement the families pass already states.
 */
export interface HouseholdPairing {
    /** Everybody this caller is willing to pair. Filtering is the caller's. */
    candidates: readonly NpcRecord[];
    /** Whether this person ever forms one at all. The caller's own rate. */
    wouldPair: (one: NpcRecord) => boolean;
    /** Anything else about the pair the caller cares about. Blood is refused here. */
    couldPair?: (one: NpcRecord, other: NpcRecord) => boolean;
    /** The day the household began, which is what the tie is dated from. */
    beganOn: (one: NpcRecord, other: NpcRecord) => number;
}

/**
 * Write both halves of one household, at the standing and under the note every
 * marriage in this world carries.
 *
 * Exported because a third caller cannot go through {@link formHouseholds} and
 * must still land on the same rows: `the-marriages-a-world-opens-holding.ts`
 * writes the marriages the catalog STATES, and a stated marriage is not a
 * pairing - there is nobody to draw, no place to group by and no rate to ask.
 * What it shares with a drawn one is everything downstream reads.
 */
export function bindHousehold(
    state: WorldState,
    at: Map<string, number>,
    one: NpcRecord,
    other: NpcRecord,
    began: number
): void {
    bind(state, at, one.id, other, 'spouse', SPOUSE_STANDING, 'Their household.', began);
    bind(state, at, other.id, one, 'spouse', SPOUSE_STANDING, 'Their household.', began);
}

/**
 * Write both halves of one tie of blood that is not a household.
 *
 * Exported for the reason {@link bindHousehold} is: `the-kin-a-world-opens-
 * holding.ts` writes the ties the catalog STATES, where there is nobody to draw
 * and no household to form, and it must still land on the rows every reader
 * already knows how to read.
 *
 * AT {@link SIBLING_STANDING}, WHATEVER THE DEGREE. This engine has one `kin`
 * kind and one number for it, and a second constant saying how much nearer a
 * sister stands than a cousin would be a mechanic invented to carry three rows.
 * The degree is in the note, which is where a reader gets it.
 */
export function bindKin(
    state: WorldState,
    at: Map<string, number>,
    one: NpcRecord,
    other: NpcRecord,
    otherIsToOne: string,
    oneIsToOther: string,
    since: number
): void {
    bind(state, at, one.id, other, 'kin', SIBLING_STANDING, otherIsToOne, since);
    bind(state, at, other.id, one, 'kin', SIBLING_STANDING, oneIsToOther, since);
}

/**
 * Two unattached adults standing in the same place, bound into a household.
 */
export function formHouseholds(
    state: WorldState,
    at: Map<string, number>,
    input: HouseholdPairing
): number {
    const byPlace = new Map<string, NpcRecord[]>();
    for (const npc of input.candidates) {
        if (npc.locationId === null) continue;
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
            // Asked here rather than before the loop, and the order is
            // load-bearing: the yearly caller's rate is a draw off a per-year
            // stream, so moving this line moves every marriage in every world
            // already seeded.
            if (!input.wouldPair(one)) continue;
            for (let j = i + 1; j < free.length; j++) {
                const other = free[j];
                if (spoken.has(other.id)) continue;
                // Nobody marries into their own household. Read off the ties
                // this module has already written, in both directions, because
                // one half can exist without the other after an inheritance.
                if (one.relationships.some(r => r.targetId === other.id && BLOOD_KINDS.has(r.kind))) continue;
                if (other.relationships.some(r => r.targetId === one.id && BLOOD_KINDS.has(r.kind))) continue;
                if (input.couldPair && !input.couldPair(one, other)) continue;

                bindHousehold(state, at, one, other, input.beganOn(one, other));
                spoken.add(one.id);
                spoken.add(other.id);
                made++;
                break;
            }
        }
    }
    return made;
}

/**
 * The yearly roll: two unattached adults who have now been in one place a year.
 */
export function applyHouseholds(
    state: WorldState,
    year: number,
    day: number,
    roster: Roster = rosterOf(state)
): number {
    const rng = forStream(state.seed, 'households', year);
    const { at, living } = roster;

    return formHouseholds(state, at, {
        candidates: living.filter(npc =>
            npc.locationId !== null
            && ageInYears(npc, day) >= HOUSEHOLD_MIN_AGE
            && !npc.relationships.some(r => r.kind === 'spouse')),
        wouldPair: () => rng.chance(HOUSEHOLD_PER_YEAR),
        beganOn: () => day
    });
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
                if ((tie.kind === 'student' || tie.kind === 'disciple') && here.has(tie.targetId)) n++;
            }
            load.set(npc.id, n);
        }

        const power = Number(faction.resources.power_ordinal ?? 0);
        const rankCount = Math.max(1, faction.ranks.length);
        // The deepest LIVING master already standing above each student. A tie
        // is who would give a student attention; `guideOrdinalFor` pays only
        // for attention actually being given - a lesson in progress, in the
        // same place - so this decides whether another master is worth binding,
        // not what the rate reads.
        const guideOf = (n: NpcRecord): number | null => {
            let best: number | null = null;
            for (const tie of n.relationships) {
                if (tie.kind !== 'master' && tie.kind !== 'teacher') continue;
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
                // FINDING A MASTER IS THE PLAYER'S OWN ROAD AND THE WORLD DOES
                // NOT WALK IT FOR THEM.
                //
                // Every other pass that decides something for a cultivator asks
                // `isTheWorldsToMove` first - see the note on the child a house
                // will not keep, which calls a world pass making that decision
                // *the exact shape the agency rule forbids*. This one never
                // did, so from the day a player joined a house the yearly pass
                // could bind them a master and write the life event, without
                // the player having asked anybody for anything.
                //
                // The design owner: *"the player needs to find a master, that
                // doesn't change"* - said while ruling that a life is born
                // holding kin and the people it grew up around, and nothing
                // else. A master handed over at a review is the road the game
                // is about, taken away in a pass nobody watched.
                if (!isTheWorldsToMove(n)) return false;
                // How many PEOPLE stand over them, not how many rows: a master
                // who is also carrying them through a book is one person.
                const standingOver = new Set(n.relationships
                    .filter(r => r.kind === 'master' || r.kind === 'teacher')
                    .map(r => r.targetId));
                if (standingOver.size >= MASTERS_AT_ONCE) return false;
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
            // no deeper than the one already standing over them could add
            // nothing the deeper one's lesson would not - so
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
                        (r.kind === 'master' || r.kind === 'teacher') && r.targetId === candidate.id)) continue;
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

            // A LINE, NOT A BOND. Somebody of the house opens a manual for
            // somebody junior; nobody knelt and nobody acknowledged anybody. The
            // design owner: *"a master has to acknowledge the master-disciple
            // relationship"*, and most outer and inner disciples have no master.
            // What writes `master` and `disciple` is somebody taking somebody on:
            // `the-disciples-a-world-opens-with.ts` and the discipleship path.
            bind(state, at, student.id, teacher, 'teacher', TAUGHT_BY_STANDING,
                `Teaches them ${taught.name}.`, day);
            bind(state, at, teacher.id, student, 'student', TAUGHT_BY_STANDING,
                `Carrying them through ${taught.name}.`, day);
            load.set(teacher.id, (load.get(teacher.id) ?? 0) + 1);
            // The line is a life event: the sequence of them is the account of
            // who carried this person and how far.
            recordATeachingLine(state, student, teacher, taught.name, day);

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
            andTheOtherEnd(state.npcs, holder, { targetId: winner.id, kind: 'rival', standing: PASSED_OVER_STANDING }, day);
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
