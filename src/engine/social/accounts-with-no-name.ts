/**
 * An account held against nobody, and what it makes its holder want.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE STATE BETWEEN THE TWO OBVIOUS ONES
 * ═════════════════════════════════════════════════════════════════════════
 *
 * AGENTS.md, *a fact reaches a person, and reaching them is an event*, has
 * three states in it and only two of them are easy to see:
 *
 *   1  NOTHING KNOWN         The brother has heard nothing. No account.
 *   2  SOMETHING IS WRONG    He has not heard from him in two years. He holds
 *      AND NOBODY KNOWS WHO  an open account with no name on it.
 *   3  TOLD WHO              The account attaches to a name.
 *
 * The middle one is the design, and it does three things the other two cannot.
 *
 * **It makes a killing with no witness have a consequence.** Not the
 * consequence of being caught - the consequence of somebody knowing they were
 * wronged and not knowing by whom. Nobody informs the brother; he works it out
 * because the letters stopped.
 *
 * **It is a motive rather than a bookkeeping entry.** An account with no name
 * on it is a person asking questions, following a name, paying somebody who
 * might know. {@link theSearchItOpens} hands that to the goal machinery the
 * world already runs on rather than inventing a search system.
 *
 * **And it changes what silencing a witness buys.** Killing the only person who
 * could name you does not close the account; it converts a named one into an
 * unnamed one that hunts. You are not erasing the consequence - you are buying
 * time, and a wrong name. That is a better bargain than getting away with it,
 * and it is a worse one than it looks.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHICH WRONGS CAN BE HELD THIS WAY, AS A RULE AND NOT A LIST
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Not every wrong can be held anonymously, and the difference is not which
 * ones are grave. It is one question about the act:
 *
 *   COULD A STRANGER HAVE DONE IT?
 *
 * A theft in the dark could. A raid by a party wearing nothing could. A copy of
 * an art turning up where it should not could. **A betrayal could not** - being
 * betrayed means somebody you had something with turned on you, so the wronged
 * party has the name by definition, and an unnamed betrayal is a contradiction
 * rather than a state.
 *
 * {@link theWrongedPartyAlreadyHasTheName} is that question, and it is asked of
 * facts the deed already carries rather than of the deed's NAME. `cause` is
 * data everywhere in this layer and is data here: grep this file for a switch
 * on one and there is none. A tenth kind of wrong is holdable or not without
 * anybody adding a row.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * HOW A ROW SAYS IT HAS NO NAME ON IT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `obligations.subject_id` is `TEXT NOT NULL` in `migrations.social.ts`, which
 * is a shared registry, and relaxing a NOT NULL in SQLite is a table rebuild
 * rather than an idempotent ALTER - so an existing world would keep rejecting
 * the value while a fresh one accepted it, which is worse than either.
 *
 * **The honest column is `subject_id TEXT`, and that change is worth making.**
 * Until it is, the empty string carries it: no id anywhere in this world is
 * empty, both indexes on the column keep working, and old and new databases
 * behave identically.
 *
 * Nothing outside this file may compare to it. {@link hasANameOnIt} and
 * {@link NO_NAME_ON_IT} are the whole interface, precisely so that the day the
 * column changes there is one place to change.
 *
 * Pure. No state, no rolls, no I/O.
 */

import type { DayIndex } from './common.js';
import type { ObligationInput, ObligationRecord } from './grudges.js';

// ─────────────────────────────────────────────────────────────────────────
// THE ABSENCE OF A NAME
// ─────────────────────────────────────────────────────────────────────────

/**
 * The subject of an account nobody can put a name to.
 *
 * Read the header before touching this. It is the empty string because the
 * column is NOT NULL on a shared registry, and it is behind an exported name
 * because nothing else should ever know that.
 */
export const NO_NAME_ON_IT = '';

/** Whether this account is against somebody, or against whoever it was. */
export function hasANameOnIt(record: { subjectId: string }): boolean {
    return record.subjectId !== NO_NAME_ON_IT;
}

/** The tag every unnamed account carries, so the ledger is queryable for them. */
export const NO_NAME_TAG = 'no-name-on-it';

/** The tag a row gets on the day a name finally attaches to it. */
export const NAME_ATTACHED_TAG = 'name-attached';

// ─────────────────────────────────────────────────────────────────────────
// WHETHER IT CAN BE HELD WITHOUT ONE
// ─────────────────────────────────────────────────────────────────────────

/**
 * What the engine knows about how the wrong was done, for this one question.
 *
 * All three are facts the deed layer already carries or the caller already
 * holds. None of them is what the wrong was called.
 */
export interface HowItWasDone {
    /**
     * A word was given first. `Deed.promised`.
     *
     * A promise requires somebody to have made it, so the wronged party had the
     * name before anything happened. This is the field that makes a betrayal
     * name its own subject without anybody writing the word "betrayal" down.
     */
    promised?: boolean;
    /**
     * The two of them already had dealings.
     *
     * The relationship layer's answer, passed in. Somebody wronged by a person
     * they already knew is not looking for a name.
     */
    priorTie?: boolean;
    /**
     * Somebody who would tell them saw it.
     *
     * Not the same as a witness existing: a witness who will never speak to
     * this person leaves the account unnamed exactly as thoroughly as no
     * witness at all.
     */
    seenBySomebodyWhoWouldSay?: boolean;
}

/**
 * True when the wronged party has the name by the nature of the act.
 *
 * Where this is true, state 2 does not exist for them - they go from knowing
 * nothing to knowing who, with nothing in between, because there was never a
 * moment where the deed was legible and its author was not.
 */
export function theWrongedPartyAlreadyHasTheName(how: HowItWasDone): boolean {
    return Boolean(how.promised || how.priorTie || how.seenBySomebodyWhoWouldSay);
}

// ─────────────────────────────────────────────────────────────────────────
// OPENING ONE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Turn an account somebody would hold into one they hold against nobody.
 *
 * Takes the row that WOULD have been written had a name been available and
 * removes the name, rather than composing a second kind of row: an unnamed
 * account and a named one are the same account at two moments, and building
 * them separately is how the two drift.
 *
 * The weight is untouched. `grudges.ts` requires severity be decided once, at
 * creation, and not knowing who did a thing does not make it lighter - which is
 * the whole reason the middle state is worth having rather than deferring the
 * account until a name turns up.
 */
export function withNoNameOnIt(row: ObligationInput): ObligationInput {
    return {
        ...row,
        subjectId: NO_NAME_ON_IT,
        tags: [...(row.tags ?? []), NO_NAME_TAG]
    };
}

// ─────────────────────────────────────────────────────────────────────────
// A NAME ARRIVING LATER
// ─────────────────────────────────────────────────────────────────────────

export interface ANameArrives {
    /** The row to write back, at the same id, with the name on it. */
    row: ObligationInput;
    /** The name it attached to, as they were told it. Never checked. */
    againstAsTold: string;
    note: string;
}

/**
 * Put a name on an account that had none.
 *
 * The same row at the same id, so the ledger holds ONE account that acquired a
 * subject rather than two accounts about one wrong. `ObligationInput.id` exists
 * for exactly this - overriding the derived id when replaying a record - and
 * the derived id folds in the subject, so without it a name attaching would
 * silently fork the row.
 *
 * `incurredOnDay` does not move. The day they were wronged is the day the
 * account opened, and the day they found out who is a different fact that lands
 * in the tags. A reader in forty years can have both.
 *
 * The name is not checked against anything. It is whatever the telling supplied,
 * and it may be the wrong man - see `hearing-of-a-wrong.ts` for why there is
 * deliberately no comparison available here.
 */
export function aNameAttaches(
    held: ObligationRecord,
    input: { subjectId: string; onDay: DayIndex; fromHolderId?: string | null }
): ANameArrives {
    return {
        row: {
            id: held.id,
            kind: held.kind,
            holderId: held.holderId,
            subjectId: input.subjectId,
            cause: held.cause,
            severity: held.severity,
            onDay: held.incurredOnDay,
            triggeringEventId: held.triggeringEventId,
            description:
                `${held.description} A name was put to it on day ${input.onDay}`
                + (input.fromHolderId ? ` by ${input.fromHolderId}.` : '.'),
            participants: [
                ...held.participants,
                ...(input.fromHolderId ? [input.fromHolderId] : [])
            ],
            tags: [
                ...held.tags.filter(t => t !== NO_NAME_TAG),
                `${NAME_ATTACHED_TAG}:${input.onDay}`,
                ...(input.fromHolderId ? [`told-by:${input.fromHolderId}`] : [])
            ],
            terms: held.terms,
            dueOnDay: held.dueOnDay,
            // It rested on nothing but the fact of the loss; now it rests on
            // what somebody said. Either way it is not something they saw.
            fromBelief: true
        },
        againstAsTold: input.subjectId,
        note:
            `The account they have carried since day ${held.incurredOnDay} now has a name on `
            + `it, as of day ${input.onDay}. It is the same account, at the same weight, and `
            + 'the name is the one they were given.'
    };
}

// ─────────────────────────────────────────────────────────────────────────
// AND WHAT IT MAKES THEM DO
// ─────────────────────────────────────────────────────────────────────────

/**
 * One thing they now want, in the world's own vocabulary for wanting things.
 *
 * The shape is `npc-state.ts`'s `GoalInput` written out rather than imported,
 * because `src/engine/world/` imports this package and a value import the other
 * way would close a cycle. The caller hands it straight to `addGoal`.
 *
 * `targetId` is null and that is the content: `NpcGoal` already documents its
 * `progress` field with the example *"Has identified the killer's faction"*,
 * which is a sentence about somebody in exactly this state. The machinery for a
 * person pursuing something they cannot yet name was already here and had
 * nothing to open one.
 */
export interface TheSearchItOpens {
    kind: 'revenge';
    text: string;
    priority: number;
    progress: string;
    obstacles: string[];
    targetId: null;
    note: string;
}

/**
 * How hard somebody looks, by what it was worth.
 *
 * The one read of severity in this file, and it decides priority rather than
 * any outcome: what a person drops everything else for is a fact about the size
 * of the wrong, and it is the only honest thing to key it on.
 */
const PRIORITY_AT: Readonly<Record<string, number>> = Object.freeze({
    slight: 0.2,
    serious: 0.45,
    grave: 0.75,
    unforgivable: 0.95
});

/**
 * What an account with no name on it makes its holder want.
 *
 * Null where the account already has a name: somebody who knows who did it
 * wants something else, and what that is belongs to whatever module answers
 * what people do about wrongs they can point at. This one only answers the
 * question the middle state asks, which is *who was it*.
 *
 * ── NOT WIRED TO ANYTHING YET ────────────────────────────────────────────
 *
 * The caller this wants is the pass that opens unnamed accounts for the kin of
 * the war dead - thousands of them, most of whom will never get a name - which
 * is being built beside this. It hands the result to `addGoal` in
 * `npc-state.ts`, once, on the day the account opens.
 *
 * It is deliberately NOT called for a played cultivator, and that asymmetry is
 * principled rather than an omission. AGENTS.md's one exception - *madness takes
 * the choice, because the character lost it* - is the only place the engine
 * decides what a lucid person does. A player holding an account with no name on
 * it is a person with a reason to go asking; the asking is theirs. What the
 * engine owes them instead is to say plainly that they have no name for it and
 * that names come out of asking, which `factsForNews` does.
 */
export function theSearchItOpens(
    record: ObligationRecord,
    what: { lost: string }
): TheSearchItOpens | null {
    if (hasANameOnIt(record)) return null;
    return {
        kind: 'revenge',
        text: `Find out who is behind ${what.lost}.`,
        priority: PRIORITY_AT[record.severity] ?? 0.5,
        progress: 'Knows it was done. Has no name for it.',
        obstacles: ['Nobody has put a name to it.'],
        targetId: null,
        note:
            `Opened off an account carried since day ${record.incurredOnDay} with no subject `
            + 'on it.'
    };
}
