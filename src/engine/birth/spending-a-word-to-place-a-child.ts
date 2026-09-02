/**
 * Spending a word to place a child - the favour that skips an admission bar.
 *
 * `src/data/cultivation/a-favour-skips-the-admission-bar.ts` says WHAT a
 * favour is and which houses will take one. It is a catalog and it states
 * plainly that nothing reads it. This is the module that reads it, and it does
 * exactly two things with it:
 *
 *   AT CHARACTER CREATION   which doors a family's word could open that the
 *                           applicant's own ordinal does not, which is the
 *                           counterpart to `placementsWithinReach` in
 *                           `engine/cultivation/origin.ts`
 *   IN A LIFE               what it costs to spend one on your own child, as
 *                           ordinary rows for the social ledgers
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE PROBLEM, MEASURED RATHER THAN ASSERTED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `placementsWithinReach` applies two hard conditions: the house is within the
 * family's `placement.reach`, AND the applicant already meets the house's own
 * admission ordinal. A child has an ordinal of zero until they have cultivated,
 * so at the age the top tier is placed, the second condition throws away every
 * house with a bar above the floor. What survives is the handful that admit at
 * zero - and those take anybody, so the greatest name in the province buys a
 * place its holder could have had by walking up.
 *
 * That is what the favour exists to fix, and this module is where the fix is
 * legible from code rather than from prose.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NOTHING HERE IS A NEW RULE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * No bar is altered, no ordinal is conferred, no faction gets a branch. Every
 * answer below is derived from `favourStanceOf`, which is itself derived from
 * `SECT_ADMISSION`, so a change to a house's bar moves this with it and there
 * is no second copy of anybody's admission figure anywhere in this file.
 *
 * What a word buys is the BAR AND NOTHING ELSE. It confers no rank - the
 * receiving house's ladder is climbed from the bottom like everybody else's,
 * which is `OriginPlacement.entryRankIndex` being nailed to 0 and asserted -
 * and it confers no progress. The child still has to survive the teaching, and
 * `WASHING_OUT` in `bodies-that-cannot-keep-their-members-children.ts` says
 * what happens to them when they do not.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE THREE THINGS CALLED A FAVOUR, WHICH ARE NOT THE SAME THING
 * ═════════════════════════════════════════════════════════════════════════
 *
 * This word is overloaded in this repository and the three senses have been
 * conflated before. They are:
 *
 *   1. THIS ONE, the admission favour. Somebody high enough says a word and a
 *      house suspends its own bar for one person, once, at the gate. It is
 *      spent from OUTSIDE a house, by somebody who is not in it, on somebody
 *      who is not in it yet.
 *
 *   2. INTERNAL PATRONAGE - `docs/world/climbing/manuals.md`, "The chosen". A house
 *      that has decided a disciple is worth it hands them the top of the shelf
 *      years before their rank reaches it. That happens INSIDE a house, to
 *      somebody already admitted, and it is bounded by how many copies of the
 *      top book the house owns. It moves a shelf, never a gate.
 *
 *   3. THE LEDGER ENTRY - `ObligationKind` `'favor'` in
 *      `engine/social/grudges.ts`, an obligation owed TO its holder. That is
 *      not an act at all, it is the record an act leaves behind.
 *
 * (1) and (3) meet exactly once, here: spending an admission favour WRITES a
 * ledger favour, with the cause `sponsored_admission` that vocabulary already
 * carries. They are cause and receipt, not rivals. (2) never touches either.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE PAVILION HAS TWO DOORS AND ONLY ONE OF THEM IS THE DOOR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * This has been got wrong twice, so {@link doorsOf} exists to make it hard to
 * get wrong a third time.
 *
 *   `minOrdinal`         MEMBERSHIP. It has never moved, for anybody, ever.
 *   `guestFromOrdinal`   THE REAL DOOR, standing at the floor, and it is the
 *                        only one in the world.
 *
 * The Pavilion's `powerOrdinal` also stands above every origin's placement
 * reach, including the top tier's - so no family's name reaches it, nobody is
 * ever placed there, and a child of the strongest house in the world has not
 * heard it named at home. That makes it simultaneously the most open door in
 * the setting and the only one that cannot be opened for anybody, and the way
 * to say it without contradicting yourself is:
 *
 *   IT IS ALREADY OPEN AND NEEDS NO OPENING.
 *
 * A favour buys nothing there because there is nothing to buy. You walk up.
 *
 * Pure. Deterministic. No I/O, no database, no LLM.
 */

import {
    favourStanceOf,
    type FavourAnswer
} from '../../data/cultivation/a-favour-skips-the-admission-bar.js';
import { SECTS, SECT_ADMISSION } from '../../data/cultivation/sects.js';
import { getOrigin, type OriginTierKey, type PlacementCandidate } from '../cultivation/origin.js';
import type { DayIndex } from '../social/common.js';
import { createFavor, type ObligationRecord } from '../social/grudges.js';
import type { KnowledgeInput } from '../social/knowledge.js';
import { createRelationship, type Relationship } from '../social/relationships.js';

// ─────────────────────────────────────────────────────────────────────────
// THE DOORS A HOUSE HAS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Every way into one house, kept apart.
 *
 * Two fields rather than one because exactly one house in the catalog has two
 * doors, and collapsing them is the specific error this type exists to stop.
 */
export interface Doors {
    factionId: string;
    /**
     * The membership bar - what it takes to be a disciple of this house.
     * `SECT_ADMISSION` where it has an entry, the sect row's own figure
     * otherwise. Never restated here.
     */
    membershipOrdinal: number;
    /**
     * A lower door into the same house, where the house has one. Null
     * everywhere but the Azure Cloud Pavilion, and a second entry appearing
     * here later is a fact about the catalog rather than a change to this
     * module.
     */
    guestFromOrdinal: number | null;
    /**
     * The lowest ordinal that gets somebody inside the walls at all. The
     * probation door where there is one, the membership bar otherwise - and
     * the number every question below is actually asking about.
     */
    lowestDoor: number;
}

/** Every door this house has, or undefined where the catalog has no such house. */
export function doorsOf(factionId: string): Doors | undefined {
    const sect = SECTS.find(s => s.id === factionId);
    if (!sect) return undefined;

    const admission = SECT_ADMISSION[factionId];
    const membershipOrdinal = admission?.minOrdinal ?? sect.admissionOrdinal;
    const probation = admission?.guestFromOrdinal;
    const guestFromOrdinal = typeof probation === 'number' ? probation : null;

    return {
        factionId,
        membershipOrdinal,
        guestFromOrdinal,
        lowestDoor: guestFromOrdinal !== null
            ? Math.min(guestFromOrdinal, membershipOrdinal)
            : membershipOrdinal
    };
}

/** Houses with a second, lower door. Derived, so it cannot go stale. */
export function housesWithTwoDoors(): Doors[] {
    return SECTS
        .map(s => doorsOf(s.id))
        .filter((d): d is Doors => d !== undefined && d.guestFromOrdinal !== null);
}

// ─────────────────────────────────────────────────────────────────────────
// HOW A CHILD AT ORDINAL ZERO GETS IN, IF THEY DO
// ─────────────────────────────────────────────────────────────────────────

/**
 * The four answers, in the terms a parent standing at a gate is asking in.
 *
 * A restatement of {@link FavourAnswer} from the child's side rather than the
 * house's, and mapped rather than re-authored so the two cannot disagree.
 */
export type HowAChildGetsIn =
    /** The door is already at the floor. Walk up. A word buys nothing. */
    | 'walks up'
    /** There is a bar, a word skips it, and everybody knows the price. */
    | 'needs a word'
    /** There is a bar and it does not move. The reason is never squeamishness. */
    | 'bar will not move'
    /** Nobody is admitted at all. Arrival is by appointment to a posting. */
    | 'no door to skip';

const FROM_STANCE: Record<FavourAnswer, HowAChildGetsIn> = {
    'no bar to speak of': 'walks up',
    'yes, at a price': 'needs a word',
    'no, and the bar does not move': 'bar will not move',
    'no bar to skip, because there is no door': 'no door to skip'
};

/**
 * What it would take to get a person at ordinal zero into this house.
 *
 * Answers for any body the favour catalog knows, which is wider than `SECTS`:
 * the Kiln Court is a court rather than a sect and has an authored stance, so
 * asking about it here gets the right answer rather than `undefined`.
 */
export function howAChildAtZeroGetsIn(factionId: string): HowAChildGetsIn | undefined {
    const stance = favourStanceOf(factionId);
    return stance ? FROM_STANCE[stance.answer] : undefined;
}

/**
 * The whole sect catalog, sorted by what a child at the floor would need.
 *
 * Reported rather than counted: a caller that wants a number takes the length
 * of the list it cares about, and no number is written down in this file or in
 * any prose that quotes it. The catalog is the authority on its own size.
 *
 * NOTE THAT THIS IS THE SECTS ONLY, and the world has one more body that
 * cannot take a child: the Kiln Court is in `COURTS`, not in `SECTS`, so it is
 * absent from every list here while having exactly the same answer as the Root
 * Sill. Ask {@link howAChildAtZeroGetsIn} about it by id. A tally that treats
 * the two postings as two rows of the sect catalog is off by one and has been
 * written down that way before.
 */
export interface WhoCanHoldAChildAtZero {
    /** No word needed. The door is already at the floor. */
    walksUp: string[];
    /** A word skips the bar, at a price. */
    needsAWord: string[];
    /** The bar does not move, and each of these has its own reason. */
    barWillNotMove: string[];
    /** No door for a word to skip. Arrival is by appointment. */
    noDoorToSkip: string[];
}

export function whoCanHoldAChildAtZero(): WhoCanHoldAChildAtZero {
    const out: WhoCanHoldAChildAtZero = {
        walksUp: [],
        needsAWord: [],
        barWillNotMove: [],
        noDoorToSkip: []
    };
    for (const sect of SECTS) {
        switch (howAChildAtZeroGetsIn(sect.id)) {
            case 'walks up': out.walksUp.push(sect.id); break;
            case 'needs a word': out.needsAWord.push(sect.id); break;
            case 'bar will not move': out.barWillNotMove.push(sect.id); break;
            case 'no door to skip': out.noDoorToSkip.push(sect.id); break;
            default: break;
        }
    }
    return out;
}

/**
 * Every house that could hold a person at ordinal zero, by either route.
 *
 * The one list that answers "where could this child go at all", and the reason
 * the mechanic matters: without it the answer is `walksUp` alone.
 */
export function couldHoldAChildAtZero(): string[] {
    const { walksUp, needsAWord } = whoCanHoldAChildAtZero();
    return [...walksUp, ...needsAWord];
}

// ─────────────────────────────────────────────────────────────────────────
// AT CHARACTER CREATION
// ─────────────────────────────────────────────────────────────────────────

/**
 * The doors a word would open that standing alone does not.
 *
 * The counterpart to `placementsWithinReach`, and deliberately DISJOINT from
 * it. That function returns houses the applicant already qualifies for; this
 * one returns houses they do not, and only the ones a word actually reaches.
 * A house appears in exactly one of the two lists, never both, so a caller can
 * concatenate them without deduplicating and a reader can see at a glance what
 * the word was worth.
 *
 * Three conditions, all hard:
 *
 *   1. The house is within the family's `placement.reach`. A word does not
 *      travel further than the name behind it, and reach is origin.ts's number.
 *   2. The applicant does NOT already meet the house's lowest door. Where they
 *      do, there is nothing to buy - which is the whole of the Pavilion's
 *      answer and the reason it never appears here.
 *   3. The house's own stance is that a word moves its bar.
 */
export function placementsAWordWouldOpen(
    key: OriginTierKey,
    applicantOrdinal: number,
    houses: readonly PlacementCandidate[]
): PlacementCandidate[] {
    const reach = getOrigin(key).placement.reach;
    if (reach <= 0) return [];
    return houses.filter(h => {
        if (h.powerOrdinal > reach) return false;
        const doors = doorsOf(h.id);
        // A house the catalog does not carry is judged on the figure the
        // caller handed us rather than being silently dropped.
        const lowest = doors ? doors.lowestDoor : h.admissionOrdinal;
        if (applicantOrdinal >= lowest) return false;
        return howAChildAtZeroGetsIn(h.id) === 'needs a word';
    });
}

/**
 * What this origin's name is worth at this age, said in one object.
 *
 * The honest account of the opening position that `openingPosition` cannot
 * give, because it reports `vouchers` as a count and says nothing about what a
 * voucher reaches. A tier with vouchers and no `wordWouldOpen` has capacity it
 * cannot spend.
 */
export interface WhatTheNameReaches {
    origin: OriginTierKey;
    applicantOrdinal: number;
    /** Highest house power ordinal the name reaches. origin.ts's number. */
    reach: number;
    /** Houses that would take them on the family's word and their own ordinal. */
    alreadyQualified: string[];
    /** Houses only a word opens. Empty at every tier with no standing. */
    wordWouldOpen: string[];
    /** Words this origin starts with. `OriginTier.vouchers`, unchanged. */
    vouchers: number;
}

export function whatTheNameReaches(
    key: OriginTierKey,
    applicantOrdinal: number,
    houses: readonly PlacementCandidate[]
): WhatTheNameReaches {
    const tier = getOrigin(key);
    const reach = tier.placement.reach;
    const alreadyQualified = reach <= 0
        ? []
        : houses
            .filter(h => {
                if (h.powerOrdinal > reach) return false;
                const doors = doorsOf(h.id);
                const lowest = doors ? doors.lowestDoor : h.admissionOrdinal;
                return applicantOrdinal >= lowest;
            })
            .map(h => h.id);

    return {
        origin: key,
        applicantOrdinal,
        reach,
        alreadyQualified,
        wordWouldOpen: placementsAWordWouldOpen(key, applicantOrdinal, houses).map(h => h.id),
        vouchers: tier.vouchers
    };
}

// ─────────────────────────────────────────────────────────────────────────
// IN A LIFE: SPENDING ONE ON YOUR OWN CHILD
//
// The other half of the mechanic, and the half that had nowhere to live. A
// favour is not only something that happened to you before you could talk. It
// is something you may DO, once you have standing and a child, and that puts
// it in the relationship layer rather than only in world generation.
//
// The worked example is already authored and this must stay consistent with
// it rather than run parallel to it: `NO_PLACE_FOR_THEIR_OWN` in
// `bodies-that-cannot-keep-their-members-children.ts` has a Hollow Court Seat
// placing a child on a friend's word, with the identity going to the friend
// and to nobody else. That is this function, with `told` set to the one person
// asked - which is the default and, on that case, the whole of the drama.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Why the word could not be spent, when it could not.
 *
 * Refusals are data. A caller that gets one has the house's own reason to hand
 * to a narrator, and `favourStanceOf(houseId)?.why` is where the sentence is.
 */
export type WordRefused =
    /** The house is already open at the floor. Nothing to buy - walk up. */
    | 'already open'
    /** The bar does not move. Not for this asker, not for anybody. */
    | 'bar will not move'
    /** There is no door. A word is the wrong instrument; a nomination is not. */
    | 'no door to skip'
    /** The child already meets the house's own door on their own ordinal. */
    | 'child already qualifies'
    /** The catalog has never heard of this house. */
    | 'no such house';

export interface SpendAWordInput {
    /** Whose standing is being spent. The parent, in the family case. */
    askerId: string;
    /** Who is being placed. Ordinal zero is the extreme and ordinary case. */
    childId: string;
    /** The house being asked. */
    houseId: string;
    /**
     * The one person who is asked, personally, and who will hold the record.
     *
     * REQUIRED, and deliberately not the faction id. A favour runs through a
     * person and never through an institution - "nobody writes to the Hollow
     * Court about a child" - so a caller that has no name to put here does not
     * have a favour, they have a letter.
     */
    askedOfId: string;
    onDay: DayIndex;
    /** The child's ordinal at the gate. Zero for a newborn, which is the point. */
    childOrdinal?: number;
    /** What was actually said, for the record. Narrator prose, never parsed. */
    note?: string;
}

/**
 * Everything one spent word produces, as rows for the ledgers that own them.
 *
 * Deltas out, nothing written. This module holds no ledger and mutates
 * nothing: the caller owns the `ObligationLedger`, the `RelationshipLedger`
 * and the knowledge table, and decides whether any of this is committed.
 */
export interface WordSpent {
    houseId: string;
    askerId: string;
    childId: string;
    /**
     * The receipt. Held by the person who was asked, about the person who
     * asked - `kind: 'favor'` is an obligation owed TO its holder, and the
     * cause `sponsored_admission` is the vocabulary the ledger already has.
     *
     * `terms` is null and `dueOnDay` is null on purpose, and that is the
     * catalog's own position rather than an omission: houses at this level do
     * not name a price, because naming one makes it a transaction that ends.
     */
    obligation: ObligationRecord;
    /**
     * What the asker now is to the person who took the child in. `client` of
     * a `patron`, in the ledger's existing vocabulary, and one direction only
     * - the other half is the receiving side's to write, and it will not be
     * the mirror of this one.
     */
    tie: Relationship;
    /**
     * Who is told. Exactly one row, held by exactly one person.
     *
     * There is deliberately no public-belief row here and there must never be
     * one. A word is spent in private between two people, and the discretion
     * needs no enforcement because naming the asker burns the namer's own face
     * in front of the people whose trust is their entire position. The child
     * is not on this list either - `whatTheChildKnows` on the Hollow Court's
     * row is the statement of that, and it is the sharpest thing the mechanic
     * produces.
     */
    told: KnowledgeInput[];
}

/**
 * Spend a word on a child, or say why it cannot be spent.
 *
 * Returns the refusal rather than throwing, because a refusal is the more
 * interesting outcome and a narrator needs to be handed it.
 */
export function spendAWord(input: SpendAWordInput): WordSpent | WordRefused {
    const stance = favourStanceOf(input.houseId);
    if (!stance) return 'no such house';

    const answer = FROM_STANCE[stance.answer];
    if (answer === 'walks up') return 'already open';
    if (answer === 'bar will not move') return 'bar will not move';
    if (answer === 'no door to skip') return 'no door to skip';

    const childOrdinal = Math.max(0, input.childOrdinal ?? 0);
    const doors = doorsOf(input.houseId);
    if (doors && childOrdinal >= doors.lowestDoor) return 'child already qualifies';

    const description = input.note ??
        'A word was said, personally, by somebody the house could not comfortably refuse, ' +
        'and the house suspended its own admission bar for one person. It bought the bar ' +
        'and nothing else: no rank, no progress, and no guarantee the child survives the ' +
        'teaching.';

    const obligation = createFavor({
        // The person who was asked carries it. What they are owed is unstated
        // and uncollected, which is what makes it worth more than a price.
        holderId: input.askedOfId,
        subjectId: input.askerId,
        cause: 'sponsored_admission',
        severity: 'serious',
        onDay: input.onDay,
        description,
        // The child is indexed so the record can be found from them later,
        // which is the only route a placed child has back to their own story.
        participants: [input.childId, input.houseId],
        tags: ['admission_favour', 'private', `house:${input.houseId}`],
        terms: null,
        dueOnDay: null
    });

    const tie = createRelationship({
        fromId: input.askerId,
        toId: input.askedOfId,
        type: 'client',
        onDay: input.onDay,
        label: 'asked, and was not refused',
        // Consequential rather than warm, which is what `strength` measures.
        strength: 0.6,
        significance: 'defining',
        attitude: 'owes something unnamed, and knows it',
        roles: ['owes_a_favour', 'placed_a_child'],
        history: description
    });

    const told: KnowledgeInput[] = [
        {
            holderId: input.askedOfId,
            holderKind: 'character',
            claimKey: `placement:${input.childId}`,
            stance: 'knows',
            statement:
                `${input.childId} was placed at ${input.houseId} on a word from ` +
                `${input.askerId}, and the bar was not met.`,
            onDay: input.onDay,
            source: { kind: 'witnessed', note: 'Was the person asked.' },
            detail: {
                houseId: input.houseId,
                askerId: input.askerId,
                childOrdinal
            },
            confidence: 1,
            tags: ['admission_favour', 'private']
        }
    ];

    return { houseId: input.houseId, askerId: input.askerId, childId: input.childId, obligation, tie, told };
}

/** Whether a call to {@link spendAWord} came back with a placement. */
export function wasPlaced(result: WordSpent | WordRefused): result is WordSpent {
    return typeof result !== 'string';
}
