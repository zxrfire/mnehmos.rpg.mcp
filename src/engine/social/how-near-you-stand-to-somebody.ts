/**
 * How near one person stands to another, which is the only thing that decides
 * whether they get the story or the fact.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE RULE
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   TRUTH DEPENDS ON PROXIMITY.
 *
 * At a distance you get the story. It may be true, it may be flattering, it may
 * be slander, and **from out there you cannot tell which** - a bad report about
 * a decent person and a bad report about a monster look identical at range.
 * Close in you get the fact: the people around somebody who did something real
 * know, whether or not the province ever hears. Evidence does not travel. It
 * stays where it happened.
 *
 * That one asymmetry produces every reputation this world needs without a
 * taxonomy of them: the deserved good name, the fake one, the decent person
 * nobody speaks well of, and the wrongdoer whose own house knows exactly what
 * he is. There is no `reputationType` field anywhere in this directory and
 * there must never be one.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * PROXIMITY IS SOCIAL FIRST AND GEOGRAPHIC SECOND
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A stranger standing in the same square is not near anybody. Somebody's
 * junior brother two provinces away is. So the primary axis is the ledger's
 * own ties - `relationships.ts` already stores what two people are to each
 * other, directed, with a strength that means *how consequential*, and that is
 * exactly the right number - and place is a weak final term.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * AND IT IS SOMETHING A PLAYER CAN CHANGE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * This is what makes the model worth having rather than merely true. Learning
 * the truth about somebody is not a roll and there is no investigation verb:
 * it is **getting nearer to the people who are already near them**. Turn up,
 * come back wanting nothing, and a tie forms; the tie moves this function's
 * answer; the answer changes what you are told. The investigation system IS the
 * social system, and building a second one would be the mistake this whole
 * directory exists to avoid.
 *
 * Nothing here ranks anybody by cultivation, in keeping with the directory's
 * standing prohibition: this module imports no realm, no ordinal and no power.
 * A patriarch and a porter are equally near to the person they share a roof
 * with.
 *
 * Pure. No state, no rolls, no I/O.
 */

import type { Relationship, RelationshipType } from './relationships.js';

// ─────────────────────────────────────────────────────────────────────────
// THE SCALE
// ─────────────────────────────────────────────────────────────────────────

/**
 * How near, as a word.
 *
 * Words rather than a float for the reason `Severity` is words: so that nothing
 * downstream is tempted to do arithmetic on it and quietly turn a description
 * into a coefficient. The order is fixed and is the only thing anybody may read
 * off it.
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

// ─────────────────────────────────────────────────────────────────────────
// WHAT MAKES SOMEBODY NEAR
// ─────────────────────────────────────────────────────────────────────────

/**
 * Tie types that put two people under the same roof, whatever the register.
 *
 * Blood, household, and the teaching relation - which in this world is a
 * household relation and is often closer than the blood one. `former_` is
 * deliberately in the list: a disciple who left eleven years ago still knows
 * what they saw, and the whole design of `relationships.ts` is that an ended
 * tie is kept rather than deleted.
 */
const UNDER_THE_SAME_ROOF: readonly RelationshipType[] = Object.freeze([
    'parent', 'child', 'sibling', 'elder_sibling', 'younger_sibling', 'spouse', 'kin',
    'master', 'disciple', 'former_master', 'former_disciple',
    'senior_brother', 'junior_brother', 'sworn_sibling'
] as const);

/**
 * The strength at which a tie is a fact about somebody's life.
 *
 * `strength` is documented as how CONSEQUENTIAL the other person is, not how
 * warm the tie is, which is exactly the right reading here: a sworn enemy you
 * have watched for thirty years is somebody you know well.
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
     * The observer's own ties, in any order.
     *
     * Only rows whose `fromId` is the observer are read. Passing the whole
     * ledger is fine and is the ordinary case.
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
     * Why, in the order that decided it, nearest reason first.
     *
     * Kept because the reason is what a caller wants to say out loud - "his
     * junior brother", "somebody at the same house" - and because a band with
     * no reason attached is a number in a coat.
     */
    reasons: string[];
}

/**
 * How near this observer stands to this person.
 *
 * The bands are checked nearest-first and the first one that is true wins, so
 * the answer is always the closest true statement about the two of them.
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
        // Deliberately weak, and it is the whole of what geography buys. Being
        // in the same market as somebody is how you hear more ABOUT them; it is
        // not how you find out what they did.
        return { nearness: 'nearby', reasons: ['the same ground'] };
    }

    return { nearness: 'distant', reasons: [] };
}

/**
 * How near somebody would have to stand to hold this as a fact rather than a
 * story.
 *
 * The rule in one line: **evidence stays where it happened.** Somebody who was
 * there, or who lives with somebody who was, holds the thing itself. Everybody
 * else is downstream of a telling, however confident they sound.
 *
 * `heldBy` is the authority and it is checked first, because a short list of
 * people who know is a fact about that record rather than about anybody's
 * position - a shame two people hold on purpose stays with those two whatever
 * anybody's ties look like.
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
    // Nothing on the record restricts it, so position decides. `house` rather
    // than `household` on purpose: a house's own business is known inside the
    // house, which is precisely the owner's case of the people near a chosen
    // knowing exactly what he is while the province does not.
    return atLeastAsNearAs(input.proximity, 'house');
}

/** Exported so a probe can print the bar without restating it. */
export const PROXIMITY_CONSTANTS = Object.freeze({
    A_TIE_THAT_MEANS_SOMETHING,
    UNDER_THE_SAME_ROOF,
    KNOWING_REQUIRES: 'house' as Nearness
});
