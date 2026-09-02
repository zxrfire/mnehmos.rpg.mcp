/**
 * A child their own house will not keep, placed with somebody their parent knows.
 *
 * Fostering. It is not a Hollow Court mechanic and this file contains no
 * faction name: the Court is the strictest instance of a thing ordinary people
 * do, and the reason it reads as an exception is that it is the one house
 * where the ordinary route - a word from somebody high enough - buys nothing.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NOTHING HERE IS A NEW MECHANIC
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Every part of this already existed and was unreachable. This module is the
 * decision layer that joins them and the world driver is what calls it:
 *
 *   WHETHER          `howAChildAtZeroGetsIn` in
 *                    `engine/birth/spending-a-word-to-place-a-child.ts`, which
 *                    derives from `SECT_ADMISSION` and the favour catalog. A
 *                    house whose own bar does not move, or that has no door at
 *                    all, cannot keep its members' children. No list, no
 *                    branch on a faction id, and a catalog change moves this
 *                    with it.
 *   WHO IS ASKED     the person's own ties. `NpcRelationship.standing` is the
 *                    world's personal ledger and `ObligationRecord` is the
 *                    social layer's; a fostering runs on one or the other and
 *                    never on a hardcoded destination list. THIS IS THE POINT:
 *                    where a child goes falls out of who is placing them.
 *   THE PLACEMENT    `spendAWord`, unchanged. It writes the receipt, the tie
 *                    and the one knowledge row, and it refuses in the house's
 *                    own words when the bar will not move.
 *   THE TERMS        `fosterageTermsOf` in `data/cultivation/sects.ts`. A
 *                    house may attach terms to a child of its own that it
 *                    placed elsewhere - a rung and a deadline at which they
 *                    may come back. Exactly one house in the catalog does, and
 *                    it supplies its own numbers rather than the mechanic's.
 *   THE SHAME        `engine/social/shame.ts`, which this is the first caller
 *                    of, and which exists because the second reason a child
 *                    gets fostered has nothing to do with a bar.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE TWO REASONS, AND WHY THEY BEHAVE DIFFERENTLY
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   THE HOUSE     Its bar does not move for anybody, or nobody joins it at
 *                 all. Nothing is concealed and nobody is at fault. The child
 *                 grows up not knowing WHOSE they are, because the word was
 *                 said in private, but the placement itself is not a secret.
 *   THE BIRTH     The household will not own this child. That is a shame
 *                 record, and the concealment and the shame are one object:
 *                 the fact naming what would be lost carries the short list of
 *                 people who already know.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THE FAVOUR BUYS, AND WHY IT IS SPENT RATHER THAN READ
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A fostered child enters a house WITHOUT MEETING ITS ADMISSION ORDINAL. That
 * is the whole of what the word buys and it is `a-favour-skips-the-admission-
 * bar.ts`'s own statement of itself. {@link Fostered.barSkipped} records the
 * figure that was not met, so a later reader can see the exception rather than
 * having to infer it.
 *
 * And it is worth it exactly once. An obligation the fosterer HOLDS is
 * SETTLED by the fostering - `resolution: 'repaid'`, through the ledger's own
 * `settleObligation` - so it leaves the open ledger and cannot carry a second
 * child. A fosterer who holds nothing to spend still gets the placement and
 * now OWES one, which is `spendAWord`'s ordinary receipt and is the same
 * mechanic pointing the other way.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE CHILD DOES NOT KNOW
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The parents and the foster parent hold the origin; the child is `unaware` on
 * `discovery.ts`'s ladder, which is the same ladder every other withheld thing
 * in this world sits on. There is deliberately no `wasFostered` flag: a
 * boolean on the child would throw away the asymmetry, which is the entire
 * content of the fact. {@link Fostered.withheldFrom} is not an instruction to
 * anybody - it is the list of people who have no record, and a person with no
 * record cannot be told a name they were never given.
 *
 * The world layer expresses the same asymmetry in state it already has: the
 * LINEAGE EDGE is written, because blood is blood and an heir still inherits,
 * and the personal `parent` TIE is not, because they never met. Somebody can
 * therefore inherit a grudge from a parent whose name they do not hold, which
 * is the sharpest thing this produces and needed no new field to say.
 *
 * Pure. Deterministic. No I/O, no database, no LLM. Deltas out, nothing
 * written - the caller owns every ledger this hands rows to.
 */

import {
    howAChildAtZeroGetsIn,
    doorsOf,
    spendAWord,
    wasPlaced,
    type WordRefused
} from '../birth/spending-a-word-to-place-a-child.js';
import { fosterageTermsOf, type Fosterage } from '../../data/cultivation/sects.js';
import type { DayIndex } from '../social/common.js';
import {
    settleObligation,
    type ObligationRecord
} from '../social/grudges.js';
import type { KnowledgeInput } from '../social/knowledge.js';
import type { KnowingStage } from '../social/discovery.js';
import { createShame, type ShameRecord } from '../social/shame.js';
import type { Relationship } from '../social/relationships.js';

// ─────────────────────────────────────────────────────────────────────────
// WHETHER A CHILD HAS TO GO SOMEWHERE ELSE AT ALL
// ─────────────────────────────────────────────────────────────────────────

/**
 * Why a parent's own house will not keep their child, or null when it will.
 *
 * The normal answer across the whole world is null, and it must stay that way:
 * everywhere else a cultivator raises their child in their own house, and a
 * mechanism that fired generally would turn a sharp fact about a handful of
 * bodies into an explanation for every anomalous placement in the catalog.
 *
 * Read off the house's own admission stance rather than a list. A house that
 * would take the child on the parent's word is a house that keeps its own -
 * the parent IS the word - so `needs a word` and `walks up` both answer null.
 */
export type HouseWillNotKeepThem =
    /** Its bar does not move. Not for this member, not for anybody. */
    | 'the bar'
    /** Nobody joins it at all. Arrival is by appointment to a posting. */
    | 'no door';

export function whyTheirOwnHouseWillNotKeepThem(
    houseId: string | null | undefined
): HouseWillNotKeepThem | null {
    if (!houseId) return null;
    switch (howAChildAtZeroGetsIn(houseId)) {
        case 'bar will not move': return 'the bar';
        case 'no door to skip': return 'no door';
        default: return null;
    }
}

/**
 * Every reason a child ends up placed with somebody else.
 *
 * The two are not variants of one thing. One is a property of an institution
 * and is nobody's fault; the other is a fact about a birth that somebody would
 * rather was not known, and only the second is concealed as a shame.
 */
export type FosteringReason = HouseWillNotKeepThem | 'the birth';

/** True for the reason that carries a shame record with it. */
export function isConcealed(reason: FosteringReason): boolean {
    return reason === 'the birth';
}

// ─────────────────────────────────────────────────────────────────────────
// WHO WOULD TAKE THEM
// ─────────────────────────────────────────────────────────────────────────

/**
 * The standing at which somebody would take your child.
 *
 * Not a friendship bar and not a warmth measure - it is the point at which one
 * person will absorb a cost and an obligation for another, which is a long way
 * above knowing them. `the-ties-an-ordinary-life-produces.ts` puts a household
 * at 0.7 and up and a long service tie at 0.55; this sits under the second, so
 * a decade of standing beside somebody is enough and a civil afternoon at a
 * gathering is not.
 */
export const WOULD_TAKE_A_CHILD = 0.5;

/**
 * One person the fosterer could ask, in the terms the caller already holds.
 *
 * A candidate is a PERSON, never a house. A favour runs through somebody and
 * never through an institution, so a caller with no name to put here does not
 * have a fostering - they have a letter.
 */
export interface FosterCandidate {
    personId: string;
    personName: string;
    /** The house they could place a child into. Null means they cannot. */
    houseId: string | null;
    /** The personal tie, on the world's own -1..1 scale. */
    standing: number;
    /**
     * An open obligation the FOSTERER holds against this person - something
     * they owe. Spending it is what buys the bar, and it is settled by the
     * placement rather than read and left open.
     */
    owesTheFosterer?: ObligationRecord | null;
    /** True when a word has already been spent on this person. Once means once. */
    alreadyAsked?: boolean;
}

export interface WhoCouldBeAskedOptions {
    /** The fosterer's own house. Their own people are not the answer here. */
    fostererHouseId?: string | null;
    /** Override the standing bar. Callers should not; tests do. */
    minStanding?: number;
}

/**
 * The people who would take this child, best claim first.
 *
 * Four conditions, and every one of them is a fact the caller already had:
 *
 *   1. There is a personal tie strong enough. Somebody who owes the fosterer
 *      an open obligation qualifies at any standing - that is what an
 *      obligation is for, and it is the case the ledger exists to carry.
 *   2. They are in a house, and it is not the fosterer's own.
 *   3. That house takes a child at the floor, on a word or without one.
 *   4. They have not already been asked.
 *
 * Sorted by whether they owe something, then by standing, then by id, so the
 * answer is stable for a seeded world and does not depend on roster order.
 */
export function whoCouldBeAsked(
    candidates: readonly FosterCandidate[],
    opts: WhoCouldBeAskedOptions = {}
): FosterCandidate[] {
    const floor = opts.minStanding ?? WOULD_TAKE_A_CHILD;
    return candidates
        .filter(c => {
            if (c.alreadyAsked) return false;
            if (!c.houseId) return false;
            if (opts.fostererHouseId && c.houseId === opts.fostererHouseId) return false;
            const owed = c.owesTheFosterer && c.owesTheFosterer.status === 'open';
            if (!owed && c.standing < floor) return false;
            const answer = howAChildAtZeroGetsIn(c.houseId);
            return answer === 'needs a word' || answer === 'walks up';
        })
        .sort((a, b) => {
            const owedA = a.owesTheFosterer && a.owesTheFosterer.status === 'open' ? 1 : 0;
            const owedB = b.owesTheFosterer && b.owesTheFosterer.status === 'open' ? 1 : 0;
            if (owedA !== owedB) return owedB - owedA;
            if (a.standing !== b.standing) return b.standing - a.standing;
            return a.personId < b.personId ? -1 : a.personId > b.personId ? 1 : 0;
        });
}

// ─────────────────────────────────────────────────────────────────────────
// PLACING THEM
// ─────────────────────────────────────────────────────────────────────────

export interface FosterChildInput {
    /** The parent. Whose standing is spent, and who will not be named to the child. */
    fostererId: string;
    /** Who is asked, personally, and the house they can place the child into. */
    askedOf: FosterCandidate;
    childId: string;
    reason: FosteringReason;
    onDay: DayIndex;
    /** Zero for a newborn, which is the ordinary case and the whole difficulty. */
    childOrdinal?: number;
    /** The fosterer's own house, for the terms it may attach. */
    fostererHouseId?: string | null;
    /** The other parent, where the world has one. Told, like the first. */
    otherParentId?: string | null;
    /** What was actually said. Narrator prose, never parsed. */
    note?: string;
}

/** Why the child could not be placed. Refusals are data, and they are the house's own. */
export type FosteringRefused = WordRefused | 'nobody to ask';

export interface Fostered {
    childId: string;
    fostererId: string;
    askedOfId: string;
    houseId: string;
    reason: FosteringReason;
    /**
     * The admission ordinal the child did not meet and was admitted anyway.
     * Null where the house had no bar to skip, which is the one placement in
     * the catalog where nobody ends up carrying anything.
     */
    barSkipped: number | null;
    /**
     * The obligation the fostering SPENT, already settled. Null when the
     * fosterer held nothing and incurred one instead.
     */
    spent: ObligationRecord | null;
    /** The receipt, when a word was spent on credit. `spendAWord`'s own row. */
    incurred: ObligationRecord | null;
    /** What the fosterer now is to the person who took the child in. */
    tie: Relationship;
    /** Everybody who holds the origin: the parents, and the person asked. */
    told: KnowledgeInput[];
    /**
     * Who does not hold it. The child is always on this list.
     *
     * Not a permission check and not an instruction - it is the statement that
     * these people have no record, which is what `unaware` means and is the
     * only thing that keeps the fact from being narratable to them.
     */
    withheldFrom: string[];
    /** The child's stage on the knowing ladder. `unaware`, and that is the fact. */
    childStage: KnowingStage;
    /**
     * The terms the fosterer's own house attaches, where it attaches any. Its
     * numbers, not the mechanic's, and null for almost every house in the world.
     */
    terms: Fosterage | null;
    /** Written only for the birth that a household will not own. */
    shame: ShameRecord | null;
}

const DEFAULT_NOTE =
    'A word was said, privately, to one person, and a house took a child it would ' +
    'have refused at the gate. It bought the bar and nothing else: no rank, no ' +
    'progress, and no promise the child survives the teaching.';

/**
 * Place a child with somebody their parent knows, or say why it cannot be done.
 *
 * The placement itself is `spendAWord` and is not reimplemented here. What this
 * adds is the three things a fostering is that a bare admission favour is not:
 * the terms the sending house attaches, the concealment, and the shame.
 */
export function fosterTheChild(input: FosterChildInput): Fostered | FosteringRefused {
    const houseId = input.askedOf.houseId;
    if (!houseId) return 'nobody to ask';

    const childOrdinal = Math.max(0, input.childOrdinal ?? 0);
    const placed = spendAWord({
        askerId: input.fostererId,
        childId: input.childId,
        houseId,
        askedOfId: input.askedOf.personId,
        onDay: input.onDay,
        childOrdinal,
        note: input.note ?? DEFAULT_NOTE
    });
    if (!wasPlaced(placed)) return placed;

    // What was actually skipped. Reported rather than restated: the figure
    // comes from `doorsOf`, which comes from `SECT_ADMISSION`.
    const doors = doorsOf(houseId);
    const barSkipped = doors && doors.lowestDoor > childOrdinal ? doors.lowestDoor : null;

    // The favour, spent or incurred. A held obligation leaves the open ledger
    // here and can never carry a second child; where nothing was held, the
    // fosterer now owes, which is the receipt `spendAWord` already writes.
    const held = input.askedOf.owesTheFosterer;
    const spendable = held && held.status === 'open' ? held : null;
    const spent = spendable
        ? settleObligation(spendable, {
            resolution: 'repaid',
            onDay: input.onDay,
            note: 'Called in to place a child. It was worth exactly this once.',
            byId: input.askedOf.personId
        })
        : null;

    const parents = [input.fostererId, input.otherParentId]
        .filter((id): id is string => typeof id === 'string' && id.length > 0);

    // Everybody who holds it. `spendAWord` writes the row for the person
    // asked; the parents' own rows are added here, because a fostering is a
    // thing two households know and an admission favour is a thing one person
    // was asked for.
    const told: KnowledgeInput[] = [...placed.told];
    for (const parentId of parents) {
        told.push({
            holderId: parentId,
            holderKind: 'character',
            claimKey: `fostering:${input.childId}`,
            stance: 'knows',
            statement:
                `${input.childId} was placed at ${houseId} through ` +
                `${input.askedOf.personId}, and is not told whose they are.`,
            onDay: input.onDay,
            source: { kind: 'witnessed', note: 'Was a parent to the child.' },
            detail: { houseId, askedOfId: input.askedOf.personId, reason: input.reason },
            confidence: 1,
            tags: ['fostering', 'private']
        });
    }

    const shame = isConcealed(input.reason)
        ? createShame({
            subjectId: input.fostererId,
            cause: 'birth_outside_the_household',
            severity: 'serious',
            onDay: input.onDay,
            description:
                'A child born to somebody whose household will not own them. The ' +
                'placement is the whole of what was done about it, and the people ' +
                'who know are the people who arranged it.',
            heldBy: [...parents, input.askedOf.personId],
            common: false
        })
        : null;

    return {
        childId: input.childId,
        fostererId: input.fostererId,
        askedOfId: input.askedOf.personId,
        houseId,
        reason: input.reason,
        barSkipped,
        spent,
        incurred: spent ? null : placed.obligation,
        tie: placed.tie,
        told,
        withheldFrom: [input.childId],
        childStage: 'unaware',
        terms: fosterageTermsOf(input.fostererHouseId ?? null) ?? null,
        shame
    };
}

/** Whether a call to {@link fosterTheChild} came back with a placement. */
export function wasFostered(result: Fostered | FosteringRefused): result is Fostered {
    return typeof result !== 'string';
}

// ─────────────────────────────────────────────────────────────────────────
// AND WHETHER THEY EVER GO BACK
// ─────────────────────────────────────────────────────────────────────────

export interface ReturnAssessment {
    /** The one answer, given once, on the day it was always going to be given. */
    returns: boolean;
    /** Whether they reached the rung. */
    metOrdinal: boolean;
    /** And whether they reached it in time, which is the harder half. */
    inTime: boolean;
    /** The terms they were assessed against. Their sending house's, not a default. */
    terms: Fosterage;
}

/**
 * Assess a fostered child against the terms their own house set.
 *
 * Both conditions, and the age one is the one that actually decides. A house
 * that attaches terms is not asking whether they are strong; it is asking
 * whether the rest of the road fits in the life they have left, so reaching
 * the rung long after the deadline is a magnificent career answering the wrong
 * question.
 *
 * No faction is named here and no number is restated. Every figure comes off
 * the terms object the sending house supplied.
 */
export function assessTheReturn(
    terms: Fosterage,
    ordinal: number,
    ageInYears: number
): ReturnAssessment {
    const metOrdinal = ordinal >= terms.returnOrdinal;
    const inTime = ageInYears <= terms.returnByAge;
    return { returns: metOrdinal && inTime, metOrdinal, inTime, terms };
}
