/**
 * Somebody kept walking around after the part that would say no is gone.
 *
 * The fourth of four, and the far end of the axis the other three sit on. A
 * poison puts a soul out and the body with it; this hollows one and keeps the
 * body. Same field, same direction, different setting - and the difference
 * that matters is not mechanical, it is that one of them is a choice the
 * person made and the other is a thing done to them.
 *
 * ── THERE IS NO REFUSAL STEP, AND THAT IS THE WHOLE VERB ─────────────────
 *
 * Not a refusal that always fails. Not a compliance cost of zero. NO REFUSAL
 * STEP AT ALL, because the part of them that would refuse is what the pill
 * removed. A held body is not persuaded, not commanded, and not coerced: it is
 * moved.
 *
 * That is why this does not go through `canOrder`, and the design owner's
 * ruling was explicit about it. `canOrder` encodes INSTITUTIONAL authority -
 * delegated, jurisdictional, refusable, and answerable to sect law - and the
 * mandate design turns on exactly that: an order can be refused, refusing an
 * illegitimate one is free, and "on what authority?" is the question that
 * makes it a political system rather than a rank check.
 *
 * The discriminator is that question. To an elder's order, "on what
 * authority?" is the whole point. To a held body there is no authority being
 * claimed - THERE IS A PILL. Two things that answer that question differently
 * are not the same mechanism, and putting a branch into `canOrder` where
 * authority is absolute and unaccountable would corrupt the thing it exists
 * to model.
 *
 * It would also hand your house authority over your zombie. A held body is
 * YOURS, not the sect's, and it is on nobody's ladder - routing it through the
 * roll would let the punishment elder give it instructions, which is not what
 * anybody means.
 *
 * ── WHERE THE HOLDER IS WRITTEN, AND WHY IT IS A TAG ─────────────────────
 *
 * `NpcRecord.tags` rather than a new column. Being held is rare, the field is
 * already persisted, and a migration on the world record for a state most
 * people will never be in is a cost paid by everybody for a few. If held
 * bodies ever stop being rare this wants promoting to a field, and the reason
 * it was not is written here rather than left to be guessed.
 *
 * ── AND A HELD BODY HAS NOTHING TO READ ──────────────────────────────────
 *
 * It falls out rather than being built: `identityContinuity` at zero already
 * reads as `nothing_left` to `whatASoulSearchTakes`. Somebody who hollows a
 * courier to walk them home has also destroyed what the courier knew, and
 * neither end of that had to be told about the other.
 *
 * ── WHICH MAKES IT A CHOICE, AND THE CHOICE IS THE POINT ─────────────────
 *
 * READ THIS BEFORE CHANGING EITHER END. That agreement is not an
 * implementation detail, it is a rule a player will feel:
 *
 *     YOU CANNOT BOTH CONTROL SOMEBODY AND READ THEM.
 *
 * Hollow the courier and you own a body that walks home. Read the courier and
 * you learn where the children were taken. Two things worth having and one
 * person to spend on them, and the spending is exclusive.
 *
 * Nobody wrote that. It fell out of two modules agreeing about what
 * `identityContinuity: 0` means, and it is the kind of decision this engine
 * should generate rather than script. Anybody touching `whatTheHollowingLeaves`
 * or the `nothing_left` branch is holding both sides of it: give a held body a
 * readable soul, or let a search survive a hollowing, and the choice quietly
 * stops existing.
 */

import type { ObligationInput } from './grudges.js';
import type { SoulState } from '../world/npc-state.js';

/** Namespace on `NpcRecord.tags`. One holder, written as one tag. */
const HELD_BY = 'held_by:';

export function tagForHolder(holderId: string): string {
    return `${HELD_BY}${holderId}`;
}

/** Whose hand this body is under, or null for everybody who is their own. */
export function whoseHandThisBodyIsUnder(tags: readonly string[]): string | null {
    const held = tags.find(tag => tag.startsWith(HELD_BY));
    return held ? held.slice(HELD_BY.length) : null;
}

export interface WhatIsLeftOfThem {
    readonly soulState: SoulState;
    readonly identityContinuity: number;
    readonly tags: readonly string[];
}

/**
 * What the pill leaves, on the record.
 *
 * `fragmented` rather than `fading`: the soul is not going out, it is broken
 * open and kept. That is the difference the states already carry, and it is
 * why the poison and this can share a field without sharing an outcome - one
 * ends, the other is held.
 *
 * `identityContinuity` at zero, which the record's own docstring already
 * frames: "how much of the original person this actually is". None of them.
 * That is the honest number and it is also what makes a held body unreadable,
 * which nobody had to arrange.
 */
export function whatTheHollowingLeaves(before: WhatIsLeftOfThem): WhatIsLeftOfThem {
    return {
        ...before,
        soulState: 'fragmented',
        identityContinuity: 0,
        tags: before.tags.filter(tag => !tag.startsWith(HELD_BY))
    };
}

/**
 * And whose hand it is under, which is a SEPARATE FACT.
 *
 * The pill hollows. It does not appoint anybody, and the split is not
 * bookkeeping: somebody who swallows one alone is emptied and belongs to
 * nobody, which is a real state and a bleak one. The hand arrives with
 * whoever put the pill in them, and it can be taken off without the
 * hollowing being undone.
 */
export function whatTheHandLeaves(
    before: WhatIsLeftOfThem,
    holderId: string
): WhatIsLeftOfThem {
    const hollow = whatTheHollowingLeaves(before);
    return { ...hollow, tags: [...hollow.tags, tagForHolder(holderId)] };
}

/** Undoing the holding. It does not undo the hollowing. */
export function takeTheHandOff(before: WhatIsLeftOfThem): WhatIsLeftOfThem {
    return { ...before, tags: before.tags.filter(tag => !tag.startsWith(HELD_BY)) };
}

export type WhatAHeldBodyDoes =
    /** Nobody is holding them. Every ordinary route applies and this one does not. */
    | 'their_own'
    /** Somebody else is holding them; an instruction from you is not theirs to take. */
    | 'held_by_another'
    /** It happens. There is nothing between the instruction and the act. */
    | 'it_happens';

/**
 * What a held body does with an instruction.
 *
 * Three answers and only one of them is about this verb. There is no fourth
 * where they decline, and no number anywhere in this function - no roll, no
 * loyalty, no standing, no cost. A held body does not weigh an instruction,
 * because weighing is the thing that was taken out.
 *
 * `held_by_another` is not a refusal either. It is a fact about whose hand
 * they are under, answered the way a locked door is answered.
 */
export function whatAHeldBodyDoesWith(
    tags: readonly string[],
    instructingId: string
): WhatAHeldBodyDoes {
    const holder = whoseHandThisBodyIsUnder(tags);
    if (holder === null) return 'their_own';
    return holder === instructingId ? 'it_happens' : 'held_by_another';
}

export interface WhatWasDoneToThem {
    readonly victimId: string;
    readonly holderId: string;
    readonly holderName: string;
    readonly victimName: string;
    readonly onDay: number;
    /** Anybody who saw it. A wrong nobody saw still happened to them. */
    readonly knownTo?: readonly string[];
}

/**
 * The row the ledger opens, which is the largest one it writes.
 *
 * `unforgivable`, and not computed from anything. Every other severity in this
 * engine is priced - what a theft took relative to what they had, what a wound
 * cost, how far a house was pushed - because those are matters of degree.
 * This is not a matter of degree. There is no amount of somebody being made
 * into a thing that is a slight version of it.
 *
 * `violated` is the cause and it already exists: "a grave wrong done to their
 * person", one row rather than several, with the account of what happened in
 * the description. The pill is only how.
 *
 * ── IT IS HELD BY THEM, AND IT OUTLIVES BOTH ENDS ────────────────────────
 *
 * Held by the victim, like every other wrong. Taking the hand off does not
 * settle it and neither does the holder dying - `grudges.ts` inheritance
 * carries an open account to whoever holds it next, and being made into a
 * thing is exactly the kind of account somebody's people take up. Freeing
 * somebody is not restitution; it is stopping.
 */
export function whatBeingMadeIntoAThingOpens(what: WhatWasDoneToThem): ObligationInput {
    return {
        kind: 'grudge',
        id: `grudge_${what.victimId}_${what.holderId}_violated`,
        holderId: what.victimId,
        subjectId: what.holderId,
        cause: 'violated',
        severity: 'unforgivable',
        onDay: what.onDay,
        description:
            `${what.holderName} put ${what.victimName} under their hand with a pill, and moved `
            + 'them about afterwards. What was taken was the part that would have said no.',
        participants: [],
        tags: [
            'wrong:held',
            'by:pill',
            // So a later reader can tell "is still held" from "was held once",
            // which are different facts about the same person, and the second
            // does not stop being true when the first stops.
            'irreversible:identity'
        ],
        ...(what.knownTo && what.knownTo.length > 0 ? { knownTo: [...what.knownTo] } : {})
    };
}
