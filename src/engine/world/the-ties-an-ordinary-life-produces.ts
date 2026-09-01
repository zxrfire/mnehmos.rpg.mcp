/**
 * The ties an ordinary life produces.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE MEASUREMENT THIS EXISTS FOR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `when-somebody-does-not-come-back.ts` models what a long seclusion costs the
 * people who knew you. On a controlled cast of four it works: 63% of the ties
 * are given up across a forty-year absence. On a real seeded world it fired
 * almost never, and `scripts/audit-absence.ts` reported why. After 120 years,
 * 498 living people:
 *
 *     73 ties in the entire world
 *        33 enemies   19 rivals   18 allies at 0.3 ("Serves under")   3 acquaintances
 *
 *     ties at or above the friendship standing:  6
 *     spouse ties:   0
 *     kin ties:      0
 *     master ties:   0
 *     disciple ties: 0
 *
 * A world of five hundred people with six friendships and no families at all.
 * The absence pass was correct and inert, because there was nobody to lose.
 * The right response was not to lower the waiting bar until the number moved -
 * that would have made a shortage of relationships look like a working
 * mechanic - it was to supply the ties.
 *
 * ── The rule this module holds ───────────────────────────────────────────
 *
 * **Nothing here is authored between two named people.** Every tie is the
 * by-product of something the world was already doing and already had state
 * for, and every one of them is written by a pass whose cost per year does not
 * grow with the population:
 *
 *   KIN            `applyDemography` already picks a living parent for every
 *                  newborn and writes a lineage edge. It threw the person away.
 *                  Now the birth writes the household: parent, child, the other
 *                  parent when there is a household, and the siblings already
 *                  in it.
 *   HOUSEHOLDS     Two unattached adults standing in the same place. The only
 *                  source of `spouse`, which is the tie the absence pass treats
 *                  as defining and the only one that can be replaced.
 *   TEACHING       `manuals.ts` has always modelled being carried over a gap in
 *                  a shelf by "somebody in the house who holds it", as an
 *                  anonymous set of technique ids. That somebody is a person.
 *                  Naming them is the whole of `applyTeachingLines`, and
 *                  `reachableCeilingFor`'s own comment asked for it: a disciple
 *                  on a house's teaching terms is "not stuck, they are
 *                  dependent, which is a different and more interesting problem,
 *                  and it is the relationship layer's."
 *   SERVED         People at the same rank in the same house, year after year.
 *   TOGETHER       Slow, and it has to be: it is the only tie here that is
 *                  earned by nothing but time.
 *   PASSED OVER    `assessPromotions` already returns everybody it could not
 *                  raise and why. `outranked` means a specific person took the
 *                  seat, and that person had a name the whole time.
 *
 * ── Who teaches you is what a house's name actually buys ─────────────────
 *
 * The teacher is **the lowest-ranked person in the house who can actually carry
 * this student**, and that one rule produces two completely different social
 * textures without branching on how good the house is.
 *
 * A child admitted at rank 0 to an apex sect is not taught by an elder. They are
 * taught by that house's outer disciples - and an apex's outer disciples are
 * formidable people, because `rankRealmBand` puts a rank's expected ordinal
 * against what the house can produce. So the search stops one rung up, and the
 * tie is between people close in rank and often close in age.
 *
 * A farmer's child at a small sect is taught by that sect's masters and elders,
 * because a shallow shelf (`admissionOffer` forces `a_teacher` at one book) has
 * a high `requiredOrdinal` on the only thing it holds, and nobody below the
 * elders stands at it. The search climbs, and the tie is deep and vertical.
 *
 * The instruction the poor sect's elder gives is WORSE than the instruction the
 * apex's outer disciple gives, and neither this module nor any other says so
 * anywhere. It falls out of who is standing there. That is why placement in a
 * strong house is worth so much at an identical admission bar: the name does not
 * buy a rank, it buys who is in front of you on the first morning, and that
 * shows up in outcomes decades later.
 *
 * A near-peer teacher is also still climbing, so the tie has a clock on it. They
 * are promoted, posted, or die, and this module never re-pairs a student who
 * already has a master. Being abandoned by the person who was teaching you is
 * an outcome, not a bug, and it is why some people end up with nobody.
 *
 * ── What that makes a favour worth, and why the ladder is recursive ──────
 *
 * Two consequences follow from "the teacher's calibre is a fact about the
 * house". Neither is code in this file; both are things this file's output is
 * the evidence for, written down here because the arrangement is one mechanism
 * and reading half of it explains nothing.
 *
 * A FAVOUR BUYS THE TEACHERS, NOT THE RANK. A favour from somebody high enough
 * skips an admission bar - it can place a child at the Frostmirror Court, which
 * admits at Foundation Establishment and would otherwise refuse them outright,
 * or at an apex. What it does NOT buy is a rank: they still enter at the bottom.
 * What it buys is who is standing in front of them on the first morning, and at
 * a house like that the outer disciples doing the teaching outclass the elders
 * of a small sect entirely. That is the whole return on the favour, and it is
 * why one from a Tribulation Transcendence cultivator is worth what it is: a
 * decade of instruction from people who are themselves going somewhere.
 *
 * The Azure Cloud Pavilion is the exception and should stay one. Its bar is
 * already 0 and it refuses nobody at the gate, so a favour buys nothing there
 * and it will not grant one either. A child placed there arrives on exactly the
 * terms a farmer's child does and gets the same formidable teachers - the one
 * house in the world where the favour is worthless and the outcome is identical.
 *
 * EACH TIER'S FLOOR IS STOCKED FROM THE TIER BELOW'S CEILING. An apex's outer
 * disciples are not novices who wandered in; a large share of them were the
 * chosen, or near it, at a court, and were taken upward. A court's are a sect's
 * chosen, and so on down. `gatherings.ts` already does this - a competition
 * winner from a house that answers to the host changes colours, lands at rank 0
 * and loses the `chosen` tag - and because relationships live on the person's
 * own record, everyone selected upward arrives still holding their ties to the
 * house they left. Cross-house supply, for free, out of movement that already
 * happens.
 *
 * The claim is about PROPORTION, not composition. Most people at the bottom of
 * an apex are ordinary intake who walked in the gate, and this module must not
 * turn every outer disciple into a former favourite. What rises with the house
 * is the share of formidable people at a given rank, which is exactly what
 * `rankRealmBand` already encodes and what the supply table reports: teacher
 * rank and teacher ordinal bucketed by house `power_ordinal`.
 *
 * ── Not inflating ────────────────────────────────────────────────────────
 *
 * A world where everybody has twenty friends is worse than one with six. Every
 * pass here is bounded so that a person ends with A FEW people who would notice
 * they were gone: a household is capped at {@link SIBLINGS_PER_HOUSEHOLD}
 * children, a teacher at {@link STUDENTS_AT_ONCE} students, and the marriage and
 * service rolls are per-year chances rather than sweeps. Some people finish with
 * nobody at all, which is a real state and an interesting one.
 *
 * ── Cost ─────────────────────────────────────────────────────────────────
 *
 * The world driver walks 500 years routinely and 12,000 in some probes, so ties
 * are the classic O(people²) trap. Nothing here compares two arbitrary people.
 * Each pass builds one index over the roster (O(n)), then does bounded work per
 * house or per drawn person. The measured per-year cost is flat in the
 * population - see `scripts/audit-absence.ts`.
 */

import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { isBelowTheLid } from './layers.js';
// The one number the whole file is calibrated against, imported rather than
// retyped for the reason `time.ts` states: a threshold that exists in two
// places has already started to drift.
import { FRIENDSHIP_STANDING } from './gatherings.js';
import {
    admissionOffer,
    manualCeilingOf,
    manualsOf,
    shelfReach,
    suitsRoot,
    type Manual
} from './manuals.js';
import type { Blocked, Promotion } from './promotion-inside-a-house.js';
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
 *
 * Deliberately the highest number here. It is the one the absence pass can
 * REPLACE - `NEW_HOUSEHOLD_CHANCE` only reaches a tie that was a household -
 * so a spouse both waits the longest and is the one whose giving up costs the
 * most, which is the shape the fiction wants.
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
 *
 * The bound exists because the birth pass draws a parent from whoever is
 * standing in the right place, and over three centuries an unbounded draw makes
 * one long-lived cultivator the parent of forty people. Four is a household;
 * forty is a bug wearing a family.
 */
export const SIBLINGS_PER_HOUSEHOLD = 4;

/** Age at which the world will pair somebody off. */
export const HOUSEHOLD_MIN_AGE = 18;

/**
 * Chance per unattached adult per year of forming a household.
 *
 * Low on purpose. At 0.03 somebody who reaches adulthood unattached is about
 * evens to still be unattached twenty-three years later, and a meaningful
 * minority never pair at all - which is the population this whole module is
 * trying not to erase, because "nobody would notice" has to remain a state a
 * person can be in.
 */
export const HOUSEHOLD_PER_YEAR = 0.03;

/**
 * Students one person is carrying at a time.
 *
 * `members.ts` gives every teaching figure in the catalog a `teaching` object
 * with three limits on it - what they know, what they may not say, and what a
 * straight answer costs them - and the third is the one that binds here. Nobody
 * teaches an unbounded number of people, because the hours come off something.
 * Counted against students who are still alive and still in the house, so a
 * teacher whose disciples have died or left is free again.
 */
export const STUDENTS_AT_ONCE = 3;

/**
 * Chance per year that a pair who serve together get any further with it.
 *
 * The slowest thing in the file. Two people at the same rank in the same house
 * need roughly five of these to reach the standing at which the world calls it
 * a friendship, so a service tie that matters is a tie somebody spent decades
 * standing next to.
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
 *
 * `state.npcs` holds the dead as well as the living and grows without bound -
 * by year 500 it is about four thousand records behind five hundred living
 * people - so a pass that walks it is O(the whole history), not O(the world.)
 * Four passes each taking their own walk showed up directly in the harness:
 * `audit-gatherings.ts`'s cost row went from a flat 0.4-0.5 seconds per hundred
 * simulated years to 0.5 rising to 0.7 across five centuries, and a rising row
 * is the exact thing that column exists to catch.
 *
 * So the walk happens once a year and everything downstream reads `living`,
 * which is bounded by the population target.
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
     *
     * Returned rather than written, because a newborn is not in `state.npcs`
     * until the birth pass is finished with it. The other halves ARE written -
     * the parents and siblings are already in the world.
     */
    child: NpcRecord;
    parentIds: string[];
    siblingIds: string[];
}

/**
 * Somebody already in this world who could be a parent to a newborn here.
 *
 * Two conditions and both are already facts about the world: old enough, and
 * not already holding {@link SIBLINGS_PER_HOUSEHOLD} children. The second is
 * read off the parent's own relationship rows rather than off the lineage
 * record - `childrenOf` scans every edge a surname has ever accumulated, which
 * over five centuries is thousands, while a person's own ties are a handful.
 *
 * Callers pass the candidates they have; this only sorts out who is eligible.
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
 *
 * The birth pass has picked a parent and written a lineage edge since long
 * before this existed. What it never did was say that the two people know each
 * other, so a world could hold four hundred descendants and zero families, and
 * an absence could cost a man his sect rank but never his children.
 *
 * Both halves of every pair, because the halves are allowed to disagree later:
 * a child who leaves still has a parent, and the parent's view of that is its
 * own row.
 *
 * Siblings come off the parent's existing `child` ties, which is both cheap and
 * correct - it is exactly the set of people already in this household - and it
 * is bounded by {@link SIBLINGS_PER_HOUSEHOLD}, so the sibling web inside one
 * family never exceeds a dozen rows however long the parent lives.
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
 *
 * The only source of `spouse` in the world, and therefore the only thing that
 * puts a tie above `DEFINING_STANDING` for the absence pass to act on. It is
 * also the only tie in the world that can be replaced, which is what makes
 * `took_another_household` a consequence somebody comes home to rather than a
 * branch that never runs.
 *
 * Same PLACE, not same province: a household is people who live together, and
 * pairing across a province would also have quietly broken the absence harness,
 * which draws the people who were told from those standing where the absentee
 * was. Nothing about this is a matchmaking model - there is no compatibility, no
 * preference and no ranking. Two people were there and neither was spoken for.
 *
 * O(n) per year: one grouping pass over the roster, then a bounded walk down
 * each place's list.
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
 *
 * Two cases, and both are already in `manuals.ts` rather than invented here:
 *
 *   THE BOOKLESS   A house whose admission terms are `a_teacher` hands its
 *                  newest people no object at all. Everything on its shelf that
 *                  suits them has to come through somebody.
 *   THE GAP        Twenty of thirty-two houses hold a shelf a disciple cannot
 *                  walk end to end - the usual shape is a primer capping at 13
 *                  and the next book wanting 21. `newlyEntitled` already lets a
 *                  house carry somebody across that gap if it still has a living
 *                  master of the higher manual. This is the same condition,
 *                  asked so that the master has a name.
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
 *
 * THE ORDERING IS THE WHOLE RULING. Sorting by rank ASCENDING - the lowest rank
 * that can do the job - is what makes an apex sect's new intake the student of
 * an outer disciple and a poor sect's the student of its elder, off one rule and
 * with no branch anywhere on how good the house is.
 *
 * In a deep house the primer is held by dozens of people at rank 0 and 1 who
 * stand well above its `requiredOrdinal`, so the search stops immediately and
 * the tie is near-peer. In a one-book house - which `admissionOffer` forces onto
 * `a_teacher` terms - the only manual has a high requirement and only the
 * elders meet it, so the search climbs the whole ladder.
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
 *
 * `reachableCeilingFor` builds a set of technique ids somebody in the house can
 * teach and then discards who. That anonymity was doing real damage: 26 houses
 * teach in person, 219 people belonged to them, and not one of those people had
 * a relationship with the person their entire progress ran through.
 *
 * A student is paired ONCE. If the teacher is later promoted, posted or dies,
 * the tie stays and nothing replaces it - being abandoned by the person who was
 * teaching you is an outcome, and a world where everybody always has a current
 * master is a world with no stakes in having one.
 *
 * O(n) per year: one grouping pass, then per house one index over its members'
 * techniques and a bounded lookup per student.
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
        const shelf = manualsOf(factionId);
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
        // Juniors first, so the scarce capacity in a thin house goes to the
        // people who cannot move at all without it.
        const students = members
            .filter(n => !n.relationships.some(r => r.kind === 'master'))
            .sort((a, b) =>
                a.factionRankIndex - b.factionRankIndex ||
                a.cultivation.realmOrdinal - b.cultivation.realmOrdinal ||
                (a.id < b.id ? -1 : 1)
            );

        for (const student of students) {
            const needs = whatTheyNeedTaught(state, student, shelf, rankCount);
            if (needs.length === 0) continue;

            let teacher: NpcRecord | null = null;
            let taught: Manual | null = null;
            for (const manual of needs) {
                for (const candidate of index.get(manual.id) ?? []) {
                    if (candidate.id === student.id) continue;
                    if (candidate.factionRankIndex < student.factionRankIndex) continue;
                    if (candidate.cultivation.realmOrdinal <= student.cultivation.realmOrdinal) continue;
                    if ((load.get(candidate.id) ?? 0) >= STUDENTS_AT_ONCE) continue;
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
 *
 * The only tie in this file earned by nothing but time, and it is deliberately
 * the slowest and the most tightly capped. Two people who share a hall open at
 * {@link SERVICE_OPENING_STANDING} and gain {@link SERVICE_PER_DEEPENING} on a
 * roll that comes up about twice a decade, so reaching the standing the world
 * calls a friendship takes roughly thirty years of standing next to each other -
 * and it stops at {@link SERVICE_CEILING}, below the line at which somebody
 * would wait a lifetime. Service makes colleagues. It does not make family.
 *
 * Bounded at {@link SERVICE_PAIRS_PER_HOUSE} draws per house per year, and a
 * draw prefers to DEEPEN a tie that already exists over opening a new one -
 * without that preference a few centuries of random pairs produce a house where
 * everybody vaguely knows everybody, which is the inflation this module is not
 * allowed to cause.
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
 *
 * `assessPromotions` has always returned this and the caller has always thrown
 * it away. `outranked` is the case with a person in it: the house had room and
 * gave it to somebody else who was standing in the same queue at the same rank.
 * `no_seat` is not written, because there is nobody to hold it against - the
 * hall above is simply full, and that is a grievance against the house rather
 * than against a person.
 *
 * Written once, and once PER PERSON rather than once per pair. A queue produces
 * the same standoff every year for decades with a different winner each time,
 * so a per-pair guard still gave a long-serving disciple a new enemy annually -
 * 1,260 rival rows among 498 people, which is a house full of vendettas rather
 * than a promotion ladder. Somebody who has been passed over is already a person
 * with a grievance; being passed over again deepens the one they have.
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
 *
 * The driver's entry point. Each pass is separately exported and separately
 * testable, and each will build its own {@link Roster} if called alone - but the
 * yearly line should take this one, because the walk is the expensive part and
 * doing it four times is what put a rising row into the cost harness.
 *
 * ORDER MATTERS ONCE. Teaching runs before households so that a year's students
 * are bound to whoever can carry them before the marriage roll moves anybody's
 * relationships around; the other two are independent. Births are NOT here -
 * they happen inside `applyDemography`, which has the parent in hand.
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
     *
     * The number that matters, and it is not the one above. A dead master is
     * still a master and the row is deliberately kept, but a row pointing at a
     * grave is not somebody who would notice you were gone - and after three
     * centuries most of a long-lived cultivator's address book is graves. An
     * audit that counted rows would report a rich social world made almost
     * entirely of the dead.
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
     *
     * Not a failure. Somebody whose household has died and whose house has
     * moved on has nobody, and that is one of the states this world is supposed
     * to be able to put a person in.
     */
    withNobody: number;
    living: number;
    /** Living ties per living person. The inflation number. */
    perHead: number;
}

/**
 * What the world currently has to lose.
 *
 * The number `scripts/audit-absence.ts` reports, exported so that the audit and
 * the tests ask the same question of the same fields rather than keeping two
 * copies of a filter that can drift.
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
