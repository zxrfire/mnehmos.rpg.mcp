/**
 * How near one person stands to another, which is the only thing that decides
 * whether they get the story or the fact.
 */

import type { Relationship, RelationshipType } from './relationships.js';

/**
 * How near, as a word. Words and not a float for the reason `Severity` is
 * words: so nothing downstream turns a description into a coefficient. The
 * order is fixed and is the only thing anybody may read off it.
 */
export type Nearness =
    /** Same roof, same blood, same master. They see them most days. */
    | 'household'
    /** Same house. They do not necessarily like them; they know them. */
    | 'house'
    /** A standing tie of their own, of whatever kind, that means something. */
    | 'tied'
    /** They have met. A name and a face and not much else. */
    | 'acquainted'
    /** Same ground. They could have been in the same room and were not. */
    | 'nearby'
    /** A name they have heard, at best. */
    | 'distant';

export const NEARNESS_ORDER: readonly Nearness[] = Object.freeze([
    'distant',
    'nearby',
    'acquainted',
    'tied',
    'house',
    'household'
] as const);

/** For comparison and filtering only. Never for weighting a decision. */
export function nearnessRank(nearness: Nearness): number {
    return NEARNESS_ORDER.indexOf(nearness);
}

/** True when `a` is at least as near as `b`. */
export function atLeastAsNearAs(a: Nearness, b: Nearness): boolean {
    return nearnessRank(a) >= nearnessRank(b);
}

/**
 * Tie types that put two people under the same roof, whatever the register.
 * `former_` is deliberately in the list: a disciple who left eleven years ago
 * still knows what they saw.
 */
const UNDER_THE_SAME_ROOF: readonly RelationshipType[] = Object.freeze([
    'parent', 'child', 'sibling', 'elder_sibling', 'younger_sibling', 'spouse', 'kin',
    'master', 'disciple', 'former_master', 'former_disciple',
    'senior_brother', 'junior_brother', 'sworn_sibling'
] as const);

/**
 * The strength at which a tie is a fact about somebody's life. `strength` is
 * how CONSEQUENTIAL the other person is and not how warm the tie is: a sworn
 * enemy watched for thirty years is somebody you know well.
 */
const A_TIE_THAT_MEANS_SOMETHING = 0.3;

export interface WhereTheyStand {
    /** Whose view this is. */
    observerId: string;
    /** The house they answer to, or null. */
    houseId: string | null;
    /** Where they are, at whatever grain the caller keeps. Null for unknown. */
    placeId?: string | null;
    /**
     * The observer's own ties, in any order. Only rows whose `fromId` is the
     * observer are read, so passing the whole ledger is fine and is ordinary.
     */
    ties?: readonly Relationship[];
}

export interface TheOtherPerson {
    id: string;
    houseId: string | null;
    placeId?: string | null;
}

export interface Proximity {
    nearness: Nearness;
    /**
     * Why, in the order that decided it, nearest reason first. Kept because a
     * band with no reason attached is a number in a coat.
     */
    reasons: string[];
}

/**
 * How near this observer stands to this person. Bands are checked nearest-first
 * and the first true one wins, so the answer is always the closest true
 * statement about the two of them.
 */
export function howNearTheyStand(
    observer: WhereTheyStand,
    other: TheOtherPerson
): Proximity {
    if (observer.observerId === other.id) {
        return { nearness: 'household', reasons: ['themselves'] };
    }

    const reasons: string[] = [];
    const tie = (observer.ties ?? []).find(
        t => t.fromId === observer.observerId && t.toId === other.id
    );

    if (tie && UNDER_THE_SAME_ROOF.includes(tie.type)) {
        reasons.push(tie.active ? tie.type : `${tie.type} (ended)`);
        return { nearness: 'household', reasons };
    }

    if (observer.houseId !== null && observer.houseId === other.houseId) {
        reasons.push('the same house');
        if (tie) reasons.push(tie.type);
        return { nearness: 'house', reasons };
    }

    if (tie && tie.strength >= A_TIE_THAT_MEANS_SOMETHING) {
        reasons.push(tie.type);
        return { nearness: 'tied', reasons };
    }

    if (tie) {
        reasons.push(tie.type === 'stranger' ? 'met once' : tie.type);
        return { nearness: 'acquainted', reasons };
    }

    const place = observer.placeId ?? null;
    if (place !== null && place === (other.placeId ?? null)) {
        // Deliberately weak, and the whole of what geography buys: the same
        // market is how you hear more ABOUT somebody, not what they did.
        return { nearness: 'nearby', reasons: ['the same ground'] };
    }

    return { nearness: 'distant', reasons: [] };
}

/**
 * Whether they hold this as a fact rather than a story. Somebody who was there, or
 * lives with somebody who was, holds the thing itself; everybody else is downstream
 * of a telling, however confident they sound.
 */
export function closeEnoughToKnow(input: {
    proximity: Nearness;
    /** Everybody the record itself says holds it. Empty when it says nothing. */
    heldBy?: readonly string[];
    observerId: string;
    /** True when the observer is a principal or a participant on the record. */
    wasThere?: boolean;
}): boolean {
    if (input.wasThere) return true;
    if (input.heldBy && input.heldBy.length > 0) {
        return input.heldBy.includes(input.observerId);
    }
    // Nothing on the record restricts it, so position decides. `house` and not
    // `household` on purpose: the owner's case is the people near a chosen
    // knowing what he is while the province does not.
    return atLeastAsNearAs(input.proximity, 'house');
}

/** Exported so a probe can print the bar without restating it. */
export const PROXIMITY_CONSTANTS = Object.freeze({
    A_TIE_THAT_MEANS_SOMETHING,
    UNDER_THE_SAME_ROOF,
    KNOWING_REQUIRES: 'house' as Nearness
});
