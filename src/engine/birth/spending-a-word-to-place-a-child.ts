/**
 * Spending a word to place a child - the favour that skips an admission bar.
 *
 * THREE THINGS ARE CALLED A FAVOUR AND THEY ARE NOT THE SAME. (1) admission,
 * which is this file; (2) internal patronage, which hands an already-admitted
 * disciple the top of the shelf and moves a shelf, never a gate; (3) the ledger
 * favour in `social/grudges.ts`. (1) and (3) meet exactly once, here: spending
 * an admission favour WRITES a ledger favour with the cause
 * `sponsored_admission`. (2) never touches either.
 *
 * `minOrdinal` is MEMBERSHIP and has never moved for anybody;
 * `guestFromOrdinal` is the real door.
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

// THE DOORS A HOUSE HAS

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

// HOW A CHILD AT ORDINAL ZERO GETS IN, IF THEY DO

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
 */
export function howAChildAtZeroGetsIn(factionId: string): HowAChildGetsIn | undefined {
    const stance = favourStanceOf(factionId);
    return stance ? FROM_STANCE[stance.answer] : undefined;
}

/**
 * The whole sect catalog, sorted by what a child at the floor would need.
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

// AT CHARACTER CREATION

/**
 * The doors a word would open that standing alone does not.
 *
 * The counterpart to `placementsWithinReach` and deliberately DISJOINT from it:
 * that returns houses the applicant already qualifies for, this returns the ones
 * they do not. A house appears in exactly one of the two, never both, so a
 * caller can concatenate them without deduplicating.
 *
 * Three conditions: within the family's `placement.reach`; the applicant does
 * NOT already meet the house's lowest door; and the house's own stance is that
 * a word moves its bar.
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
 * REQUIRED, and deliberately not the faction id: a favour runs through a person
 * and never through an institution, so a caller with no name to put here does
 * not have a favour, they have a letter.
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
 */
export interface WordSpent {
    houseId: string;
    askerId: string;
    childId: string;
    /**
     * The receipt. Held by the person who was asked, about the person who asked -
     * `kind: 'favor'` is an obligation owed TO its holder, and the cause
     * `sponsored_admission` is the vocabulary the ledger already has.
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
 * Who is told. Exactly one row, held by exactly one person. There is deliberately
 * no public-belief row and there must never be one: naming the asker burns the
 * namer's own face in front of the people whose trust is their whole position.
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
