/**
 * The world coming to somebody who is standing still.
 *
 * ── THE GAP THIS CLOSES, WRITTEN DOWN BY THE PASS THAT MADE IT ───────────
 *
 * `theRoomSitsOnYou` sits on rows the house was told about on an EARLIER day,
 * which is what makes being caught and being sentenced two events and is the
 * window an intercession lives in. Its cost, recorded honestly at the time: a
 * player who only ever takes free actions is never sentenced, because no day
 * passes and `incurredOnDay < onDay` is never true.
 *
 * The design owner's ruling is not that the free action should cost a day -
 * haggling is not a day and would not be one anywhere else either. It is that
 * the world can interrupt somebody who is only taking free actions. So the day
 * gate stays exactly where it is, and what changes is that the house does not
 * stand about waiting for the accused to decide to spend one.
 *
 * ── WHAT IS NEW HERE IS ONE SENTENCE, AND IT IS NOT A DECISION ───────────
 *
 * Who comes is `whoIsSentToCarryItOut` - the elder whose room it is and the
 * hands posted to it, read off the deal the house already has. Whether there is
 * anybody to decide the thing at the end of it is `whereAComplaintGoes`, the
 * same read the room itself asks. A house with nobody on either side sends
 * nobody, which is the same answer `theRoomSitsOnYou` gives for the same
 * shortage and is a real one.
 *
 * WHAT IT COSTS IS A DAY, AND THE WORLD SPENDS IT. Being walked up the hill is
 * not an act the player chose, so it is not charged against the free-action
 * ruling; it is the ordinary cost of being fetched, and the room can sit the
 * moment it is paid. One day, because the fetching is local by construction -
 * they came to where the accused is standing.
 */

import { severityRank, type ObligationRecord } from '../engine/social/grudges.js';
import { ledgerAbout } from '../storage/repos/obligation.repo.js';
import { isYourOwnHouseHoldingIt } from '../engine/social-leverage/what-a-house-does-when-it-catches-you.js';
import { whereAComplaintGoes } from '../engine/social-leverage/reporting-what-you-saw.js';
import type { APortfolio } from '../engine/social-leverage/what-an-elder-is-in-charge-of.js';
import type { APost } from '../engine/social-leverage/who-works-in-an-elders-hall.js';
import {
    whoIsSentToCarryItOut,
    type SomebodyWasSent
} from '../engine/social-leverage/somebody-is-sent-to-carry-it-out.js';
import type { CultivationRepos } from '../server/consolidated/cultivation-support.js';
import type { OnTheRollHere } from './a-room-hands-one-down-to-you.js';

/**
 * What being fetched costs.
 *
 * One, because they came to where the accused was standing. The number is here
 * rather than in the caller so the next person can find the judgement.
 */
export const WHAT_BEING_FETCHED_COSTS = 1;

export interface TheHouseCameForYou {
    complaint: ObligationRecord;
    sent: SomebodyWasSent;
    /** Who would sit on it once they have you. Never null: nobody, nobody comes. */
    decidedById: string;
    /** Days the fetching spends. The world's, not something the player chose. */
    daysTaken: number;
    /** Plain statements of fact. Present tense, second person. */
    lines: string[];
    /** The mechanical channel. Never narration. */
    structure: string;
}

/**
 * The row the house is holding and the room cannot sit on yet.
 *
 * The exact complement of `theComplaintTheRoomSitsOn`: same house, same person,
 * same open rows, and the day comparison the other way round. Heaviest first,
 * then oldest, then id, so the same pile is read the same way twice.
 */
export function theComplaintNoDayHasPassedOn(
    repos: CultivationRepos,
    houseId: string,
    aboutId: string,
    onDay: number
): ObligationRecord | null {
    const waiting = ledgerAbout(repos.db as never, houseId).filter(row =>
        row.status === 'open'
        && row.holderId === houseId
        && row.subjectId === aboutId
        && isYourOwnHouseHoldingIt(row)
        && row.incurredOnDay >= onDay);

    return waiting.sort((a, b) =>
        severityRank(b.severity) - severityRank(a.severity)
        || a.incurredOnDay - b.incurredOnDay
        || (a.id < b.id ? -1 : 1))[0] ?? null;
}

export interface TheHouseComingForYou {
    repos: CultivationRepos;
    accusedId: string;
    houseId: string;
    houseName: string;
    portfolios: readonly APortfolio[];
    posts: readonly APost[];
    roll: readonly OnTheRollHere[];
    headId: string | null;
    onDay: number;
}

/**
 * Somebody comes and gets you, or nobody does.
 *
 * Null is the ordinary answer and the one every turn gets: no row waiting, or
 * nobody in the house who could decide it, or nobody it could send.
 */
export function theHouseComesForYou(
    input: TheHouseComingForYou
): TheHouseCameForYou | null {
    const complaint = theComplaintNoDayHasPassedOn(
        input.repos, input.houseId, input.accusedId, input.onDay
    );
    if (complaint === null) return null;

    // NOBODY TO DECIDE IT, NOBODY COMES. A house that cannot sit on a thing has
    // no reason to have somebody brought in front of a room that is not there,
    // and fetching them every turn for a row nothing can close would be the
    // world spending a player's days on an errand with no end.
    const decidedById = whereAComplaintGoes({
        portfolios: input.portfolios,
        aboutId: input.accusedId,
        headId: input.headId
    });
    if (decidedById === null) return null;

    const sent = whoIsSentToCarryItOut({
        severity: complaint.severity,
        portfolios: input.portfolios,
        posts: input.posts
    });
    if (sent.partyIds.length === 0) return null;

    const nameOf = (id: string): string =>
        input.roll.find(person => person.id === id)?.name ?? 'somebody on the roll';
    const carriers = sent.partyIds.slice(0, 2).map(nameOf);
    const came = carriers.length === 1
        ? carriers[0]
        : `${carriers[0]} and ${carriers[1]}`;

    return {
        complaint,
        sent,
        decidedById,
        daysTaken: WHAT_BEING_FETCHED_COSTS,
        lines: [
            `${input.houseName} does not wait for you to be somewhere else. ${came} come to `
            + 'where you are standing and walk you up to the hall. That is the rest of the '
            + 'day.'
        ],
        structure:
            `a-house-does-not-wait: ${complaint.id} (${complaint.severity}) incurred on day `
            + `${complaint.incurredOnDay}, and the day has not turned. ${sent.line} `
            + `${nameOf(decidedById)} sits on it. ${WHAT_BEING_FETCHED_COSTS} day spent.`
    };
}
