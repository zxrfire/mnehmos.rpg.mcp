/**
 * What can discharge an account, what it costs the people used to discharge it, and
 * what happens when somebody walks out of the arrangement.
 */

import type { DayIndex } from '../social/common.js';
import type {
    ObligationInput,
    ObligationRecord,
    Settlement,
    Severity
} from '../social/grudges.js';
import { SEVERITY_ORDER, severityRank } from '../social/grudges.js';

/**
 * Who the two sides of a record are, as far as this question needs to know.
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
     * A fact about the two households, supplied by the caller, and the ONLY gate
     * on the binding discharge. Not a moral test and not about anybody's rank.
     */
    couldBeBound: boolean;
}

/**
 * The discharges this record can afford, heaviest bargain last.
 */
export function whatWouldCloseIt(
    record: Pick<ObligationRecord, 'kind' | 'severity' | 'status' | 'fromBelief'>,
    parties: AccountParties
): Settlement['resolution'][] {
    if (record.status !== 'open') return [];

    const out: Settlement['resolution'][] = [];

    // A record written on a belief can always turn out to be about nothing,
    // whatever it weighs. Not a discount: a feud founded on a lie kills people
    // just as thoroughly until the day somebody proves it.
    if (record.fromBelief) out.push('proven_false');

    if (record.kind === 'oath') {
        out.push('oath_fulfilled', 'oath_released');
        return out;
    }
    if (record.kind === 'leverage') {
        // Three exits, and none of them is using it. `renounced` is the fact
        // becoming public and the asset therefore being worth nothing;
        // `compensated` is the buyout, which the caller should pair with an
        // `oath` not to speak of it, since that is what inverts the position
        // rather than ending it; `forgiven` is the holder letting it go.
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
    // directions - the one the ledger exists to make possible forty years later.
    out.push('avenged');

    // And the bargain. Only where an account is heavy enough that nothing
    // smaller would close it, and only where there are people to bind.
    if (heaviness >= severityRank('grave') && parties.couldBeBound) {
        out.push('renounced');
    }

    return out;
}

/**
 * Whether a binding is one of the things that would close this.
 */
export function couldBeSettledByABinding(
    record: Pick<ObligationRecord, 'kind' | 'severity' | 'status' | 'fromBelief'>,
    parties: AccountParties
): boolean {
    return whatWouldCloseIt(record, parties).includes('renounced')
        && record.kind !== 'favor' && record.kind !== 'debt' && record.kind !== 'oath';
}

export interface TheBargain {
    /** The original account, closed. */
    settled: Settlement;
    /**
     * The binding, as an `oath` on the ledger.
     */
    binding: ObligationInput;
    /**
     * What the two of them now are to each other, in plain words.
     *
     * Deliberately not warm and deliberately not hostile: the tie is unchosen and
     * unequal, and both of those are worse than dislike.
     */
    tie: string;
    /** One factual line for the mechanical channel. */
    note: string;
}

/**
 * Close a heavy account with a binding, and write down what it bound.
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
            // Exactly as heavy as what it closed. It has to be: a lighter oath
            // would be cheaper to break than the account it replaced, and then
            // the arrangement is not a settlement at all.
            severity: input.record.severity,
            onDay: input.onDay,
            description:
                `${input.boundName} is bound to ${input.toName}. It closed something, and it was `
                + 'not either of their idea.',
            terms,
            dueOnDay: null,
            // A nameless account has no subject to name here. `subject_id` is
            // nullable: somebody who knows they were wronged and cannot say by
            // whom holds one, and a participants list is a list of people
            // rather than of slots.
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

export interface WalkingOut {
    /**
     * The original account, reopened as it stood - or null when there was none.
     */
    reopened: ObligationInput | null;
    /**
     * And the new one, which is personal.
     */
    opened: ObligationInput;
    note: string;
}

/**
 * What it costs to walk out of an arrangement that was closing something.
 */
export function whatWalkingOutOfItCosts(input: {
    /**
     * The oath being walked out of.
     */
    binding: ObligationRecord & { subjectId: string };
    /**
     * The account it was closing, when it was closing one. Omit for an
     * arrangement that settled nothing, which is most of them.
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
 */
export const NO_CEILING_ON_WHAT_A_BINDING_CAN_CLOSE: Severity =
    SEVERITY_ORDER[SEVERITY_ORDER.length - 1];
