/**
 * Somebody walking up the hill with your name, and the room they take it to.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTICE ORDERING, THE SAME AS THE THEFT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     the false claim happened      because the player made it
 *     being reported is decided     separately, off what that person holds
 *     the record opens              only if it was reported
 *
 * The decree is already spent and already failed before anything here runs.
 * Inverting this would make an unreported forgery into a forgery that did not
 * happen, which is the same error the theft verb exists to avoid.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AND IT RUNS IN BOTH DIRECTIONS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `complaintsBroughtTo` and `settleAComplaint` are the same rows read from the
 * other end. A player holding the punishment hall is somebody complaints are
 * brought TO, and building only the reported-on half would be the officeless
 * elder problem again - a punishment that happens to the player and never
 * through them, standing with no jurisdiction attached.
 *
 * Nobody is brought a complaint about themselves: `whereAComplaintGoes` sends
 * it over the offender's head where the offender holds the room.
 */

import {
    type IfCaught,
    ifCaughtAtSomethingTheHousePunishes,
    isYourOwnHouseHoldingIt,
    whatYourOwnHouseOpensAboutYou
} from '../engine/social-leverage/what-a-house-does-when-it-catches-you.js';
import {
    type TheWitness,
    type WhatHappensNext,
    whatTheWitnessDoesAboutIt,
    whatStandsBetween,
    whereAComplaintGoes
} from '../engine/social-leverage/reporting-what-you-saw.js';
import type { APortfolio } from '../engine/social-leverage/what-an-elder-is-in-charge-of.js';
import {
    type ObligationRecord,
    createObligation,
    settleObligation
} from '../engine/social/grudges.js';
import { ledgerAbout } from '../storage/repos/obligation.repo.js';
import type { ContactPerson } from '../engine/encounters/contact.js';
import type { SectAlignment } from '../schema/cultivation.js';
import type { CultivationRepos } from '../server/consolidated/cultivation-support.js';
import { type DatabaseHandle, writeObligation } from './encounters.js';

/** The tag that says a row came out of somebody watching and telling. */
export const REPORTED_BY_A_WITNESS = 'reported_by_a_witness';
/** A row the witness keeps to themselves. Held by them, not by the house. */
export const KEPT_TO_THEMSELVES = 'kept_to_themselves';

/**
 * Who was standing there.
 *
 * The senior person on the rung the order was given to, chosen by rank then id
 * so the same decree in the same house always has the same witness. Not drawn:
 * a player has to be able to learn that who they tried it on mattered, and a
 * random witness would make that unlearnable - the same reason
 * `whoIsInChargeOfWhat` deals portfolios rather than rolling them.
 */
export function whoSawIt(
    roster: readonly ContactPerson[],
    sentRankIndex: number,
    exceptId: string
): ContactPerson | null {
    const there = roster
        .filter(person => person.id !== exceptId && person.rankIndex === sentRankIndex)
        .sort((a, b) => b.realmOrdinal - a.realmOrdinal || a.id.localeCompare(b.id));
    // Nobody named on that exact rung: the house still has people on it, but
    // the catalog does not name them, and an unnamed hand is not a witness
    // anybody can be reported by. That is a real answer rather than a gap.
    return there[0] ?? null;
}

export interface TheReport {
    witness: ContactPerson;
    what: WhatHappensNext;
    /** What the house would do about it. `nothing` unless it was reported. */
    doing: IfCaught;
    /** Written where it was reported, or where the witness kept it. */
    record: ObligationRecord | null;
    /** Who the complaint went to. */
    toId: string | null;
}

export interface ReportInput {
    repos: CultivationRepos;
    offenderId: string;
    offenderName: string;
    offenderOrdinal: number;
    houseId: string;
    houseName: string;
    alignment: SectAlignment | null;
    portfolios: readonly APortfolio[];
    headId: string | null;
    witness: ContactPerson;
    onDay: number;
    /** What they were seen doing, factually. */
    what: string;
}

/**
 * Resolve what the witness does, and write whichever row follows.
 *
 * Two rows are possible and they are different objects, which is the point:
 *
 *   REPORTED   the HOUSE holds it, through `whatYourOwnHouseOpensAboutYou`, and
 *              it is the same `AGAINST_THEIR_OWN` shape the library theft
 *              writes. There is one ledger for what a house holds against its
 *              own and this goes in it.
 *   REMEMBERED the WITNESS holds it. Not the house's business, because the
 *              house was never told - and a lever that person has for as long
 *              as it stays open.
 */
export function reportWhatTheySaw(input: ReportInput): TheReport {
    const { witness } = input;

    const between = whatStandsBetween(
        ledgerAbout(input.repos.db as never, input.offenderId),
        witness.id,
        input.offenderId
    );
    const toId = whereAComplaintGoes({
        portfolios: input.portfolios,
        aboutId: input.offenderId,
        headId: input.headId
    });

    const asWitness: TheWitness = {
        id: witness.id,
        name: witness.name,
        standing: witness.standing?.strength ?? null,
        role: witness.role,
        grievance: witness.grievance ?? null
    };
    const what = whatTheWitnessDoesAboutIt({
        witness: asWitness,
        theyOweYou: between.theyOweYou,
        theyHoldAboutYou: between.theyHoldAboutYou,
        toId,
        rungsAbove: Math.max(0, input.offenderOrdinal - witness.realmOrdinal)
    });

    // ── THE HOUSE IS TOLD ────────────────────────────────────────────────
    if (what.does === 'reports') {
        const doing = ifCaughtAtSomethingTheHousePunishes({
            // The claim was on the house's own authority, so the house is the
            // party with something to answer about. A property question, not a
            // moral one, and here the property is the house's own name.
            theirsToPunish: true,
            alignment: input.alignment
        });
        const opened = whatYourOwnHouseOpensAboutYou({
            houseId: input.houseId,
            memberId: input.offenderId,
            cause: 'betrayal',
            severity: 'serious',
            onDay: input.onDay,
            description:
                `${input.what} ${witness.name} saw it and took it to the room complaints go to.`,
            doing,
            knownTo: what.toId === null ? [witness.id] : [witness.id, what.toId]
        });
        if (opened === null) return { witness, what, doing, record: null, toId: what.toId };

        const record = createObligation({
            ...opened,
            tags: [...(opened.tags ?? []), REPORTED_BY_A_WITNESS]
        });
        writeObligation(input.repos.db as unknown as DatabaseHandle, record);
        return { witness, what, doing, record, toId: what.toId };
    }

    // ── OR THEY KEEP IT ──────────────────────────────────────────────────
    //
    // "says nothing and remembers", and the remembering is a row rather than a
    // mood. Held by the witness, so it is theirs to spend, and it is not the
    // house's - the house was never told.
    if (what.does === 'says_nothing_and_remembers') {
        const record = createObligation({
            kind: 'grudge',
            holderId: witness.id,
            subjectId: input.offenderId,
            cause: 'betrayal',
            severity: 'slight',
            onDay: input.onDay,
            description: `${input.what} ${witness.name} watched, said nothing, and did not forget.`,
            participants: [witness.id],
            tags: [KEPT_TO_THEMSELVES]
        });
        writeObligation(input.repos.db as unknown as DatabaseHandle, record);
        return { witness, what, doing: 'nothing', record, toId: null };
    }

    return { witness, what, doing: 'nothing', record: null, toId: what.toId };
}

// ─────────────────────────────────────────────────────────────────────────
// THE OTHER END OF IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * What has been brought to this house about its own.
 *
 * Open `AGAINST_THEIR_OWN` rows, which is the one ledger a house keeps about
 * its members - written by the library theft and by a reported decree, and read
 * here for the first time. `isYourOwnHouseHoldingIt` had no reader at all.
 */
export function complaintsBroughtTo(
    repos: CultivationRepos,
    houseId: string
): ObligationRecord[] {
    return ledgerAbout(repos.db as never, houseId)
        .filter(row => row.status === 'open'
            && row.holderId === houseId
            && isYourOwnHouseHoldingIt(row));
}

/**
 * Settle one, as the person the room belongs to.
 *
 * `upheld` and `dismissed` are `grudges.ts`' own resolutions rather than new
 * words: a complaint acted on is `avenged` and one thrown out is `proven_false`.
 * Nothing new is invented for a decision the ledger already had vocabulary for.
 */
export function settleAComplaint(
    repos: CultivationRepos,
    record: ObligationRecord,
    input: { verdict: 'upheld' | 'dismissed'; byId: string; onDay: number; note: string }
): ObligationRecord {
    const settled = settleObligation(record, {
        resolution: input.verdict === 'upheld' ? 'avenged' : 'proven_false',
        onDay: input.onDay,
        byId: input.byId,
        note: input.note
    });
    writeObligation(repos.db as unknown as DatabaseHandle, settled);
    return settled;
}
