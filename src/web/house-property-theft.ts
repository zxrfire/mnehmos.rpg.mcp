/**
 * Taking a thing your own house owns, without asking for it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Found by playing. A Sword Elder of the Azure Cloud Pavilion typed *"I take a
 * manual from the sect library without asking"* and was told, in prose, that
 * his hand closed around a manual and he took it. **Nothing moved.** No object
 * changed hands, nobody noticed, and no ledger row opened.
 *
 * Three facts behind it, none of them a bug in isolation:
 *
 *   `steal` IS AN INTENT, NOT A VERB. It rides on `interact`, and
 *   `factsForInteraction`'s own comment says the intent is "carried for the
 *   narrator; read by no conditional." Honest, and the reason nothing ran.
 *
 *   `transferPossession` IS THE ONE FUNCTION THAT MOVES A ROW, and its callers
 *   are trade, bequest, estate settlement, the hunt and the legacy path. Not
 *   one of them is a taking.
 *
 *   SO THERE WAS NO ACT. The house's shelf is real - `libraryObjectId` mints an
 *   object per manual per house, held by the faction and seated at its
 *   compound - and there was no way for anybody to take one off it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHERE THE LINE IS, AND WHY IT IS NOT ARBITRARY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `siphon` already exists and already steals from a house. It takes from the
 * RESERVES, over months, at a pace. So the question this file had to answer
 * first was what is left for it to do, and `items.md`'s three tiers answer it
 * without anything being invented:
 *
 *   A COUNTED THING is an amount on a holder. What moves it is TAKING, and
 *   taking stones from the treasury is `siphon`, which is finished.
 *   A TRACKED THING is one object with a provenance. What moves it is a
 *   DECISION - and until now the only decisions available were somebody's
 *   agreement, somebody's death, or somebody's will.
 *
 * `keptAs(significance)` is the existing single answer to which tier a row is
 * in, so this verb takes exactly what `siphon` cannot and refuses exactly what
 * `siphon` owns. Neither had to learn about the other.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POSSESSION MOVES. OWNERSHIP DOES NOT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `transferPossession`'s own docstring is the ruling: "Possession moves.
 * Ownership moves only when the caller says so, which for `stolen` and `looted`
 * it never should. The provenance chain gains a link either way, so the theft
 * is on the record even while everyone involved behaves as though it is not."
 *
 * That is what makes a stolen manual a different object from a bought one
 * forever, and it is why `knownOwnershipBy` exists - the record already
 * distinguishes "a player holding a stolen artifact nobody can identify" from
 * one "holding an artifact the owning sect can name on sight".
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE ORDER, WHICH IS EASY TO GET BACKWARDS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     the object moves          because the player took it
 *     notice is decided         separately, and only then
 *     the record opens          only if it was noticed
 *
 * Wiring it the other way turns an unnoticed theft into a theft that did not
 * happen, which is the same error as the narrator reporting an act that never
 * ran - the defect this file exists to close.
 *
 * ── AND NOTICE IS NOT A TIMER ────────────────────────────────────────────
 *
 * Ruled: a theft is noticed when somebody next READS THE SHELF, not on a
 * schedule. So nothing here counts down and nothing here rolls. Notice is a
 * state read - whether one of the house's own people is standing where the
 * taking happened - and everything else is left open on purpose. The
 * provenance link this writes is precisely what a later reader of the shelf
 * would find, so building the read later needs nothing rebuilt here, and the
 * fact that WHAT you take decides how badly it is missed stays available: a
 * manual six disciples are working from and one nobody has opened since the
 * last age are already different rows.
 */

import {
    type IfCaught,
    ifCaughtAtSomethingTheHousePunishes,
    whatYourOwnHouseOpensAboutYou
} from '../engine/social-leverage/what-a-house-does-when-it-catches-you.js';
import type { ObligationInput, Severity } from '../engine/social/grudges.js';
import {
    type ObjectRecord,
    isTracked,
    transferPossession
} from '../engine/world/possessions.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { SectAlignment } from '../schema/cultivation.js';
import { MATCH_THRESHOLD, matchScore } from './entities.js';

/** What a house is holding that somebody could put a hand on. */
export interface HouseHolding {
    object: ObjectRecord;
    /** False where the row is the counted tier, which `siphon` owns. */
    takeable: boolean;
}

/**
 * Everything this house is holding, in the world's own object table.
 *
 * Read off `possessorId` rather than off any shelf-specific field, so a house's
 * library, its armoury and anything it has been given all answer the same
 * question. `seedSectLibraries` seats the manuals here; nothing else had to be
 * told about them.
 */
export function whatThisHouseHolds(
    world: WorldState | null,
    factionId: string
): HouseHolding[] {
    if (!world) return [];
    return world.objects
        .filter(object => object.possessorId === factionId)
        .map(object => ({ object, takeable: isTracked(object) }));
}

/**
 * The one they named, out of what the house holds.
 *
 * The same fuzzy match every other named-thing resolution in this layer uses,
 * so a player can type back what the game printed. Null is a real answer and
 * the caller owes a refusal that names what IS there.
 */
export function whichHoldingTheyMeant(
    holdings: readonly HouseHolding[],
    wanted: string
): HouseHolding | null {
    const asked = wanted.trim();
    if (asked.length < 3) return null;
    let best: HouseHolding | null = null;
    let bestScore = MATCH_THRESHOLD;
    for (const holding of holdings) {
        const score = matchScore(asked, holding.object.name);
        if (score > bestScore) {
            best = holding;
            bestScore = score;
        }
    }
    return best;
}

/**
 * How badly the house takes losing this, from what the row already says.
 *
 * `significance` is the world's own measure of how much a thing matters and it
 * is set where the object is made, so nothing is scored here - which is what
 * `grudges.ts` requires: severity is decided once, by whoever knows what was
 * done. A legendary holding is the house's inheritance; a significant one is
 * somebody's working copy.
 */
export function howBadlyThisIsMissed(object: ObjectRecord): Severity {
    switch (object.significance) {
        case 'legendary': return 'grave';
        case 'significant': return 'serious';
        default: return 'slight';
    }
}

/**
 * What each answer sounds like, in the house's own voice.
 *
 * A lookup keyed on `IfCaught` rather than a branch, so a fifth answer over in
 * `what-a-house-does-when-it-catches-you.ts` is a row here and nothing else.
 * Nothing is decided in this table - the decision arrived with the value, and
 * these are renderings of it.
 */
export const THE_HOUSE_ANSWERS: Readonly<Record<IfCaught, (houseName: string) => string>> = {
    killed: house =>
        `${house} does not hold an inquiry about this. Somebody will be sent, and what they `
        + 'are sent to do is not to bring you back.',
    questioned_about_the_source: house =>
        `${house} will want to know where you got it, and will keep asking. The question is `
        + 'not rhetorical and there is a right answer you do not have.',
    priced: house =>
        `${house} has put a number on it. What happens next depends on what you are worth to `
        + 'them against what it was worth, and that is a calculation rather than a verdict.',
    nothing: () =>
        'Nobody with a claim saw it, so there is nothing for anybody to answer yet.'
};

export interface TakingInput {
    /** The thief. Their own house is the one being taken from. */
    takerId: string;
    takerName: string;
    houseId: string;
    houseName: string;
    alignment: SectAlignment | null;
    holding: HouseHolding;
    onDay: number;
    /**
     * Somebody of this house standing where the taking happened, if anybody is.
     *
     * Supplied by the caller rather than computed here, because who is present
     * is a fact about the played world and this function is pure. Null is the
     * ordinary case and is exactly the interesting one: the object has still
     * moved.
     */
    seenBy: { id: string; name: string } | null;
}

export interface TakingResult {
    /** The row after the move. The caller writes it back into the world. */
    object: ObjectRecord;
    /** What the house would do about it. `nothing` when it was not seen. */
    doing: IfCaught;
    /** The record to write, or null where nothing was noticed. */
    record: ObligationInput | null;
    severity: Severity;
    seenBy: { id: string; name: string } | null;
}

/**
 * Take it.
 *
 * Pure: state in, a new row and a decision out, no I/O and no mutation of the
 * input. The caller writes the object back and writes the record, in that
 * order.
 */
export function takeFromYourOwnHouse(input: TakingInput): TakingResult {
    const { holding, seenBy } = input;
    const severity = howBadlyThisIsMissed(holding.object);

    // ── THE OBJECT MOVES FIRST, AND UNCONDITIONALLY ──────────────────────
    //
    // `transfersOwnership` is left at its default of false, which
    // `transferPossession` says is "the entire point: taking a thing does not
    // make it yours". The house goes on owning it, the player is holding it,
    // and the provenance link says which of those is which.
    const moved = transferPossession(holding.object, {
        onDay: input.onDay,
        toHolderId: input.takerId,
        toHolderName: input.takerName,
        how: 'stolen',
        source: input.houseName,
        note: `Taken off ${input.houseName}'s own holdings by ${input.takerName}, `
            + `who is on its roll.`
    });

    // ── THEN WHETHER ANYBODY SAW IT ──────────────────────────────────────
    //
    // `theirsToPunish` is the property question the punishment layer asks, and
    // here it is answered by the row rather than by a judgement: the house owns
    // the thing, so it has a claim. What it DOES about the claim is the
    // alignment's, and none of that is decided in this file.
    const doing = seenBy === null
        ? 'nothing'
        : ifCaughtAtSomethingTheHousePunishes({
            theirsToPunish: true,
            alignment: input.alignment
        });

    const record = whatYourOwnHouseOpensAboutYou({
        houseId: input.houseId,
        memberId: input.takerId,
        cause: 'robbery',
        severity,
        onDay: input.onDay,
        description:
            `${input.takerName} took ${holding.object.name} off ${input.houseName}'s own `
            + `holdings without asking`
            + (seenBy ? `, and ${seenBy.name} was standing there.` : '.'),
        doing,
        ...(seenBy ? { knownTo: [seenBy.id] } : {})
    });

    return { object: moved, doing, record, severity, seenBy };
}
