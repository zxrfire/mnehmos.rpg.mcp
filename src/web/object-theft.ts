/**
 * Taking one named thing off somebody who is not your own house.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT WAS MISSING, AND IT WAS WRITTEN DOWN BEFORE IT WAS BUILT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `whatALiftTook` moves SPIRIT STONES and says so in its own docstring: taking
 * a tracked thing off a person "is a different event and is not done here...
 * That is worth building and it is worth building deliberately." So a player
 * could rob somebody of a year of their earnings and could not take the boat
 * they were standing next to, at any phrasing.
 *
 * The two neighbours are both already right and neither reaches this:
 *
 *   `takeFromYourOwnHouse`  the tracked tier, off a shelf, and only a house
 *                           YOU ARE ON THE ROLL OF. Its own refusal says
 *                           "what you are describing is robbing strangers,
 *                           and walking into a compound you do not belong to
 *                           is a different sentence."
 *   coercion                takes EVERYTHING a beaten person is carrying,
 *                           because they are standing there handing it over.
 *
 * This is the third: one thing, named, off somebody who did not agree to it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * CARRIED AND MOORED ARE BOTH WITHIN REACH, AND ONLY ONE OF THEM WAS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A carriage and a spirit boat are never carried. `mintCraft` leaves
 * `possessorId` null on every one of them and records where it is in
 * `data.mooredAt`, so a query on possession sees no craft anywhere in the
 * world - which is why the coercion sweep above, which is a possession query,
 * takes a sword off somebody and leaves their boat at the dock.
 *
 * So a thing is within reach if they are CARRYING it, or if they OWN it and it
 * is moored where the two of you are standing. Nothing else: a hull three
 * provinces away is not something anybody puts a hand on, and a rule that let
 * it be taken would be a theft with no geography in it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * POSSESSION MOVES. OWNERSHIP DOES NOT. THE MOORING FOLLOWS THE THING
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The first two are `transferPossession`'s own ruling and are not decided here.
 * The third is this file's and it is the one thing a moored object needs that a
 * carried one does not: a hull whose possessor moved and whose `mooredAt` did
 * not is a register saying the boat is at its owner's dock and in the thief's
 * hands at once. Whoever reads it next has to pick one, and either answer is
 * wrong.
 *
 * What deliberately does NOT change is `ownerId`, `ownerName` or
 * `knownOwnershipBy`. The people who built it can still name it on sight, which
 * is the whole of what `docs/world/things/items.md` means by *a stolen blade
 * with a name on it is a confession that walks into the room ahead of you*.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THIS DOES NOT DECIDE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Whether it came off, what it costs, who is owed what, what they do about it,
 * and how heavy the record is. Every one of those is already decided by the
 * path this hangs off: `resolveAttempt` says whether the lift landed,
 * `whatTheyDoAboutBeingWronged` says what the wronged party does, and
 * `createObligation` writes one row. This file moves the object and reports how
 * badly it will be missed, off `significance`, through the same
 * `howBadlyThisIsMissed` the house path uses - so a severity is not decided
 * twice and not decided here.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * ONE THING THE SCENE LAYER CANNOT SEE YET, WRITTEN DOWN RATHER THAN PATCHED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `movementOf` in `scene-person-readings.ts` reads how much of what somebody
 * had moved this turn off TWO COLUMNS - the purse and untreated injuries - and
 * a tracked object is neither. So after a boat changes hands the bearing line
 * reads *"Nothing of theirs moved. They are the one it was put to, and it came
 * to nothing"*, in the same paragraph as the boat coming off its mooring.
 *
 * And one asymmetry left standing on purpose, so it is a decision rather than
 * an oversight: **coercion still takes only what is carried.** Its sweep in
 * `combat-verbs.ts` is a possession query, so somebody beaten into submission
 * hands over their sword and keeps their boat, while somebody merely robbed can
 * lose it. Whether a yielding should reach a mooring is a question about what
 * yielding MEANS - handing a thing over, or ceasing to defend everything you
 * have - and it belongs to whoever owns that verb.
 *
 * The channel for it already exists and is the right one: `DeclaredMovement`,
 * which is documented as being for exactly the case a roster snapshot cannot
 * see, and is how a fight's damage reads as heavily as it should. What is
 * missing is a caller declaring one, and the call site that would do it -
 * `sayWhoWasInIt` in `turn-engine.ts` - was being rewritten by somebody else
 * while this was written. Reported rather than raced.
 */

import {
    type HouseHolding,
    howBadlyThisIsMissed,
    whichHoldingTheyMeant
} from './house-property-theft.js';
import {
    isRuined,
    isTracked,
    transferPossession,
    type ObjectRecord
} from '../engine/world/possessions.js';
import type { Severity } from '../engine/social/grudges.js';
import type { WorldState } from '../engine/world/world-state.js';

/** A tracked thing this person has, and how they have it. */
export interface WithinReach {
    object: ObjectRecord;
    /** On them, or standing on the ground the two of you are standing on. */
    because: 'carried' | 'moored';
}

/**
 * Everything of theirs somebody could put a hand on, standing here.
 *
 * Read off `possessorId` and `ownerId` rather than off any kind-specific field,
 * so a sword, a manual, a token and a hull all answer the same question.
 * `isTracked` is the tier gate and `isRuined` is the other one: a thing that
 * has been broken keeps its row forever and there is nothing left to take.
 */
export function whatIsWithinReachOf(
    world: WorldState | null,
    holderId: string,
    here: string | null
): WithinReach[] {
    if (!world) return [];
    const found: WithinReach[] = [];
    for (const object of world.objects) {
        if (!isTracked(object) || isRuined(object)) continue;
        if (object.possessorId === holderId) {
            found.push({ object, because: 'carried' });
            continue;
        }
        // Moored, and only where the two of you are. `mooredAt` is the free
        // text `Cultivator.location` is, compared the way every other reader of
        // that field compares it, which is exactly.
        if (object.ownerId === holderId
            && object.possessorId === null
            && here !== null
            && typeof object.data?.mooredAt === 'string'
            && object.data.mooredAt === here) {
            found.push({ object, because: 'moored' });
        }
    }
    return found;
}

/**
 * The one they named, or null.
 *
 * `whichHoldingTheyMeant` rather than a matcher of its own: a player must be
 * able to type back what the game printed, and there is one answer to what that
 * means in this package. `takeable` is true for everything here because
 * `whatIsWithinReachOf` has already applied the tier gate.
 */
export function whichThingTheyMeant(
    within: readonly WithinReach[],
    said: string
): WithinReach | null {
    // ── THE ARTICLE COMES OFF BOTH SIDES ─────────────────────────────────
    //
    // The catalog's names carry their own - "A drawn carriage", "A spirit
    // boat" - which `describeCountedHoldings` already strips for the same
    // reason, and a player types "the spirit boat". Measured against
    // `matchScore`: "spirit boat" against "A spirit boat" is 60 and clears the
    // threshold; "the spirit boat" is 40 and does not. So the name the game
    // printed was the one phrasing that could not reach the row it named,
    // which is the defect AGENTS.md states as its own rule.
    //
    // Stripped rather than matched a second way: there is one matcher in this
    // package and this hands it a query and a candidate that are comparable.
    const asked = withoutTheArticle(said);
    const holdings: HouseHolding[] = within.map(row => ({
        object: { ...row.object, name: withoutTheArticle(row.object.name) },
        takeable: true
    }));
    const hit = whichHoldingTheyMeant(holdings, asked);
    if (!hit) return null;
    return within.find(row => row.object.id === hit.object.id) ?? null;
}

function withoutTheArticle(text: string): string {
    return text.trim().replace(/^(?:an?|the)\s+/i, '');
}

export interface LiftInput {
    thiefId: string;
    thiefName: string;
    fromName: string;
    onDay: number;
    /** Where the thief is. A moored thing is moored here afterwards. */
    here: string | null;
}

export interface LiftedThing {
    /** The row after the move. The caller writes it back into the world. */
    object: ObjectRecord;
    /** How badly it will be missed, off the row's own `significance`. */
    severity: Severity;
    because: 'carried' | 'moored';
}

/**
 * Take it.
 *
 * Pure: state in, a new row out, no I/O and no mutation of the input. The
 * caller writes the object back.
 */
export function liftIt(reach: WithinReach, input: LiftInput): LiftedThing {
    const moved = transferPossession(reach.object, {
        onDay: input.onDay,
        toHolderId: input.thiefId,
        toHolderName: input.thiefName,
        how: 'stolen',
        source: input.fromName,
        note: reach.because === 'moored'
            ? `Taken off ${input.fromName}'s mooring by ${input.thiefName}, who was standing `
                + 'where it was tied up.'
            : `Taken off ${input.fromName} by ${input.thiefName}.`
    });
    return {
        object: reach.because === 'moored'
            ? { ...moved, data: { ...moved.data, mooredAt: input.here } }
            : moved,
        severity: howBadlyThisIsMissed(reach.object),
        because: reach.because
    };
}
