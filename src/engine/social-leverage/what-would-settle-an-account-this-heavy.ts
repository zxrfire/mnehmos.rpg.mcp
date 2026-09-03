/**
 * What can discharge an account, what it costs the people used to discharge it,
 * and what happens when somebody walks out of the arrangement.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NOTHING NEW IS BEING BUILT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `grudges.ts` already has {@link Settlement} with eight resolutions, and it is
 * already emphatic that a record leaves the open ledger exactly one way:
 * something happens and somebody writes down what. This file does not add a
 * ninth resolution and does not add a system. It answers one question the
 * ledger deliberately does not:
 *
 *   WHICH OF THE DISCHARGES IT ALREADY HAS CAN AN ACCOUNT THIS HEAVY, BETWEEN
 *   THESE PARTIES, ACTUALLY AFFORD?
 *
 * A slight grudge is forgiven over a drink. An unforgivable one between two
 * houses is not, and offering money for it is an insult on top of the original.
 * That is a property of the record - its weight, its kind, whether the people
 * on it are institutions, whether the person it happened to is still alive to
 * accept anything - and not a property of what the deed was called. Grep this
 * file for a cause: there isn't one.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * A BINDING IS ONE OF THE DISCHARGES, AND IT IS THE INTERESTING ONE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner's case, and it is worth stating in full because the whole
 * point of it is easy to lose:
 *
 *   A grave wrong between two houses. The wronged house extracts a binding
 *   rather than a body. The wrongdoer's house agrees, because a feud costs it
 *   more than a marriage does. AND THE PERSON WHO DID IT IS BOUND TO SOMEBODY
 *   HE DID NOT CHOOSE AND DOES NOT LIKE.
 *
 * The transaction is not the content. **The relationship is.** Two people now
 * have a permanent, unchosen, unequal tie that neither of them asked for, and
 * everything downstream reads it: how each of them answers an ask, what their
 * houses expect of them, and - the sharpest part - what people say about it at
 * a distance against what the people in the two houses actually know.
 *
 * This is NOT a marriage system and there is no marriage system anywhere in
 * this repository. What is here is an `oath` record with cause `marriage_pact`,
 * which is a row `grudges.ts` has had the vocabulary for since it was written
 * and which nothing has ever produced. A binding is one possible discharge
 * among several and must stay that way: a rule that applies to exactly one
 * situation is the thing AGENTS.md opens by warning against, and most heavy
 * accounts in this world are settled some other way or never settled at all.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * AND WHAT HAPPENS WHEN SOMEBODY WALKS OUT OF IT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Somebody living inside two houses' arithmetic can leave. The engine does not
 * stop them - AGENTS.md, *agency: do not ban it, and do not soften it* - and
 * what it does instead is say what it costs, which is the entire content of
 * {@link whatWalkingOutOfItCosts}:
 *
 *   THE ORIGINAL ACCOUNT REOPENS. It was discharged by an arrangement and the
 *   arrangement is not being kept, so the discharge was not one.
 *   AND IT IS NOW PERSONAL. The old record named a house. The new one names the
 *   person who left, and its cause is the ledger's own `broken_oath`.
 *
 * A run in which somebody flees the marriage their grandfather's crime bought
 * is a run in which a two-generation-old feud comes back live, worse, and
 * pointed at them. Nobody authored that. It falls out of two records.
 *
 * Pure. No state, no rolls, no I/O, no ladder.
 */

import type { DayIndex } from '../social/common.js';
import type {
    ObligationInput,
    ObligationRecord,
    Settlement,
    Severity
} from '../social/grudges.js';
import { SEVERITY_ORDER, severityRank } from '../social/grudges.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT AN ACCOUNT THIS HEAVY CAN BE CLOSED WITH
// ─────────────────────────────────────────────────────────────────────────

/**
 * Who the two sides of a record are, as far as this question needs to know.
 *
 * Institutions and people settle differently and that is the only distinction
 * drawn here. A house can be paid; a house cannot be forgiven over a drink,
 * because there is nobody in it whose forgiveness is the house's.
 */
export interface AccountParties {
    /** True when the holder is a body rather than a person. */
    holderIsAHouse: boolean;
    /** True when the subject is a body rather than a person. */
    subjectIsAHouse: boolean;
    /** False when the person it happened to is dead or otherwise gone. */
    principalIsStillHere: boolean;
    /**
     * True when the two sides have people who could be bound to each other.
     *
     * A fact about the two households, supplied by the caller, and the ONLY
     * gate on the binding discharge. It is not a moral test and it is not
     * about anybody's rank - two bodies with nobody spare cannot make this
     * bargain whatever they would like to.
     */
    couldBeBound: boolean;
}

/**
 * The discharges this record can afford, heaviest bargain last.
 *
 * Every value is one of `Settlement['resolution']`, unchanged. The list is
 * derived from the record rather than looked up, which is what makes a tenth
 * kind of wrong need no edit here either: it arrives with a severity and gets
 * whatever a record of that severity can be closed with.
 */
export function whatWouldCloseIt(
    record: Pick<ObligationRecord, 'kind' | 'severity' | 'status' | 'fromBelief'>,
    parties: AccountParties
): Settlement['resolution'][] {
    if (record.status !== 'open') return [];

    const out: Settlement['resolution'][] = [];

    // A record written on a belief can always turn out to be about nothing,
    // whatever it weighs. `grudges.ts` keeps `fromBelief` for exactly this and
    // is explicit that it is not a discount: a feud founded on a lie kills
    // people just as thoroughly until the day somebody proves it.
    if (record.fromBelief) out.push('proven_false');

    if (record.kind === 'oath') {
        out.push('oath_fulfilled', 'oath_released');
        return out;
    }
    if (record.kind === 'leverage') {
        // Three exits, and none of them is using it - which is the whole of
        // what makes this kind different. `renounced` is the fact becoming
        // public and the asset therefore being worth nothing; `compensated` is
        // the buyout, which the caller should pair with an `oath` not to speak
        // of it, since that is what inverts the position rather than ending it;
        // `forgiven` is the holder simply letting it go.
        out.push('renounced', 'compensated', 'forgiven');
        return out;
    }
    if (record.kind === 'favor' || record.kind === 'debt') {
        // What is owed can be given back, and the person owed can decide they
        // are not owed. Nothing heavier applies: a favour is not avenged.
        out.push('repaid', 'forgiven');
        return out;
    }

    const heaviness = severityRank(record.severity);

    // Forgiveness needs somebody whose forgiveness it is. An institution has
    // nobody like that, and neither has a dead person.
    if (parties.principalIsStillHere && !parties.holderIsAHouse
        && heaviness < severityRank('unforgivable')) {
        out.push('forgiven');
    }

    // Paying for it. Available up to the point where being offered money for it
    // is worse than being offered nothing.
    if (heaviness < severityRank('grave')) out.push('compensated');

    // Somebody acts on it. Always available, at every weight, in both
    // directions - this is the one the ledger exists to make possible forty
    // years later.
    out.push('avenged');

    // And the bargain. Only where an account is heavy enough that nothing
    // smaller would close it, and only where there are people to bind.
    if (heaviness >= severityRank('grave') && parties.couldBeBound) {
        out.push('renounced');
    }

    return out;
}

/** Whether a binding is one of the things that would close this. */
export function couldBeSettledByABinding(
    record: Pick<ObligationRecord, 'kind' | 'severity' | 'status' | 'fromBelief'>,
    parties: AccountParties
): boolean {
    return whatWouldCloseIt(record, parties).includes('renounced')
        && record.kind !== 'favor' && record.kind !== 'debt' && record.kind !== 'oath';
}

// ─────────────────────────────────────────────────────────────────────────
// THE BARGAIN
// ─────────────────────────────────────────────────────────────────────────

export interface TheBargain {
    /** The original account, closed. */
    settled: Settlement;
    /**
     * The binding, as an `oath` on the ledger.
     *
     * Held by the person who is bound, about the house that extracted it,
     * because that is who they are answerable to and who comes looking if they
     * stop. `terms` is prose, as `grudges.ts` requires for an oath, and it is
     * what somebody reads in eighty years when they are trying to work out why
     * these two families are like this with each other.
     */
    binding: ObligationInput;
    /**
     * What the two of them now are to each other, in plain words.
     *
     * The relationship IS the point, and this is the sentence the tie carries.
     * Deliberately not warm and deliberately not hostile: it is unchosen and
     * unequal, and both of those are worse than dislike.
     */
    tie: string;
    /** One factual line for the mechanical channel. */
    note: string;
}

/**
 * Close a heavy account with a binding, and write down what it bound.
 *
 * Both records at once, because they are one event: the account is discharged
 * BY the arrangement, so an arrangement that is written without the settlement
 * leaves a feud running that everybody believes is over, and a settlement
 * written without the arrangement is a house forgiving something for nothing.
 */
export function settleItWithABinding(input: {
    record: ObligationRecord;
    /** The person being bound - usually, though not necessarily, the wrongdoer. */
    boundId: string;
    boundName: string;
    /** Who they are bound to. */
    toId: string;
    toName: string;
    /** The house that extracted it. The oath is owed to a body, not to a person. */
    owedToHouseId: string;
    onDay: DayIndex;
}): TheBargain {
    const terms =
        `Settled the account ${input.record.holderId} held, on day ${input.record.incurredOnDay}, `
        + `at ${input.record.severity}. ${input.boundName} is bound to ${input.toName}. `
        + 'Neither of them asked for it and both houses have agreed it stands.';

    return {
        settled: {
            resolution: 'renounced',
            onDay: input.onDay,
            byId: input.owedToHouseId,
            note:
                `Closed by arrangement rather than by anything being put right. ${input.boundName} `
                + `is bound to ${input.toName}, and the two houses have written it down as the `
                + 'end of it.'
        },
        binding: {
            kind: 'oath',
            holderId: input.boundId,
            subjectId: input.owedToHouseId,
            cause: 'marriage_pact',
            // The binding is exactly as heavy as what it closed. It has to be:
            // a lighter oath would be cheaper to break than the account it
            // replaced, and then the arrangement is not a settlement at all.
            severity: input.record.severity,
            onDay: input.onDay,
            description:
                `${input.boundName} is bound to ${input.toName}. It closed something, and it was `
                + 'not either of their idea.',
            terms,
            dueOnDay: null,
            // A nameless account has no subject to name here. `subject_id` is
            // nullable since `optional-obligation-subject.ts`: somebody who
            // knows they were wronged and cannot say by whom holds one, and a
            // participants list is a list of people rather than of slots.
            participants: [input.toId, input.record.holderId, input.record.subjectId]
                .filter((id): id is string => id !== null),
            tags: ['binding', 'settlement', `closed:${input.record.id}`],
            triggeringEventId: input.record.triggeringEventId
        },
        tie:
            'Bound to somebody they did not choose, by an agreement between two houses that was '
            + 'about something else entirely. It is permanent, it is not equal, and both of them '
            + 'know exactly what it is for.',
        note:
            `The account is closed and neither party is satisfied. What is running now is an oath `
            + `at ${input.record.severity}, held by ${input.boundName}, and the houses will read `
            + 'it as kept for exactly as long as it is kept.'
    };
}

// ─────────────────────────────────────────────────────────────────────────
// AND WHEN SOMEBODY DOES NOT KEEP IT
// ─────────────────────────────────────────────────────────────────────────

export interface WalkingOut {
    /**
     * The original account, reopened as it stood - or null when there was none.
     *
     * NULL IS THE COMMON CASE AND IS NOT A DEGENERATE ONE. Most arranged
     * marriages in this world settle nothing: two houses with adjacent ground,
     * a family custom, an alliance nobody was wronged over. And most people who
     * leave one are not escaping a punishment - they simply do not want it,
     * which is a whole and sufficient reason. A model that could only produce
     * the ugly kind would be a claim about the world that nobody has made.
     *
     * What is the same in both cases is the oath: a word was given and is not
     * being kept, and that costs what a broken word costs whatever it was
     * given for.
     *
     * Same severity, same cause, same day incurred, same description. Nothing
     * is recalculated - `grudges.ts`'s second rule - and the date is the
     * ORIGINAL one, because the wrong happened when it happened and a feud that
     * appears to date from last spring is a feud the narrator will misread.
     */
    reopened: ObligationInput | null;
    /**
     * And the new one, which is personal.
     *
     * The old record named a house on at least one side. This one names the
     * person who left, and its cause is `broken_oath` - the ledger's own word,
     * which is what makes this findable beside every other broken word in the
     * world rather than only beside marriages.
     */
    opened: ObligationInput;
    note: string;
}

/**
 * What it costs to walk out of an arrangement that was closing something.
 *
 * Nothing here prevents it and nothing here softens it. The person leaves; the
 * world answers.
 *
 * The one thing this function will not do is invent an escalation. The reopened
 * account comes back at the weight it was written at, because the original
 * wrong did not get worse - what got worse is that there are now two records
 * instead of one, and the second names somebody the first did not.
 */
export function whatWalkingOutOfItCosts(input: {
    /** The oath being broken. */
    /**
     * The oath being walked out of.
     *
     * Its subject is the house that was owed the word, and a word is always
     * given TO somebody - so unlike a grudge, this one is never nameless. Stated
     * in the type rather than checked, because a binding with no beneficiary is
     * a corrupt row and not a state the fiction has.
     */
    binding: ObligationRecord & { subjectId: string };
    /**
     * The account it was closing, when it was closing one.
     *
     * Omit for an arrangement that settled nothing, which is most of them.
     */
    closed?: ObligationRecord | null;
    /** Who is walking out. Usually `binding.holderId`. */
    leaverId: string;
    leaverName: string;
    onDay: DayIndex;
}): WalkingOut {
    const { binding } = input;
    const closed = input.closed ?? null;

    return {
        reopened: closed === null ? null : {
            kind: closed.kind,
            holderId: closed.holderId,
            subjectId: closed.subjectId,
            cause: closed.cause,
            severity: closed.severity,
            onDay: closed.incurredOnDay,
            description:
                `${closed.description} It was closed by an arrangement on day `
                + `${binding.incurredOnDay}, and the arrangement was not kept.`,
            triggeringEventId: closed.triggeringEventId,
            participants: [...closed.participants, input.leaverId],
            tags: [...closed.tags, 'reopened'],
            terms: null,
            dueOnDay: null,
            fromBelief: closed.fromBelief
        },
        opened: {
            kind: 'grudge',
            // The house that was owed the oath holds it. It is the party that
            // gave something up for an arrangement and did not get it.
            holderId: binding.subjectId,
            subjectId: input.leaverId,
            cause: 'broken_oath',
            // As heavy as the oath was, and the oath was as heavy as the
            // account. A binding worth less than what it closed would make
            // walking out the cheap move, which it is emphatically not.
            severity: binding.severity,
            onDay: input.onDay,
            description: closed === null
                ? `${input.leaverName} was bound by an arrangement between two houses and did `
                  + 'not stay in it. Nothing was being settled by it. They simply did not want it.'
                : `${input.leaverName} was bound by an arrangement that closed something `
                  + 'and did not stay in it. What it was closing is open again.',
            participants: [
                binding.holderId,
                binding.subjectId,
                ...(closed === null ? [] : [closed.holderId])
            ],
            tags: ['binding', 'walked_out', `broke:${binding.id}`],
            triggeringEventId: binding.triggeringEventId
        },
        note: closed === null
            ? 'A word was given and is not being kept. That is one account, held by the house '
              + 'that was given it, and there is nothing behind it that has come back.'
            : 'The arrangement was the settlement. There is no settlement now, and there is a '
              + 'second account besides, with one name on it instead of a house.'
    };
}

/**
 * The heaviest weight a binding can be used to close.
 *
 * There is not one, and saying so is the point: `unforgivable` accounts are
 * closed this way in this world, and that is precisely what makes the
 * arrangement worth resenting. Exported as a stated absence rather than a
 * constant so nobody adds a ceiling later on the assumption one was intended.
 */
export const NO_CEILING_ON_WHAT_A_BINDING_CAN_CLOSE: Severity =
    SEVERITY_ORDER[SEVERITY_ORDER.length - 1];
