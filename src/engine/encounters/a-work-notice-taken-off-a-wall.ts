/**
 * Hired work a house has put up on a town's wall, as a line anybody standing there may take.
 *
 * The owner: "they post NOTICES for external", and a notice asks only for what the house "doesn't
 * need to put stuff upfront" for. So a work notice is taken like a contract: by anybody, on a roll
 * or off it, paid on completion, and buying no place on anybody's roll. Played blind: the disciple
 * on the Azure Dew gate named the house's hired work, and no verb could take it.
 *
 * The notice is the house's sending, hired out: its task and its handle are the sending's own
 * (`SENDING_REASONS`), so "I'll do the materials trip" at a wall reaches it the way the same words
 * reach the house's own board from inside.
 */

import type { EncounterEntry } from '../../data/cultivation/encounters.js';
import { SENDING_REASONS, type SendingReason } from '../../data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import { MAX_ORDINAL, clampOrdinal } from '../cultivation/realms.js';
import { aTaskAsPosted, postedForTag } from './how-a-task-is-worded.js';

const A_WORK_NOTICE = 'notice:';

/** A work notice as a line on the wall: the sending's task, for the house, pitched at its floor. */
export function aWorkNoticeAsAnOffer(
    notice: { houseId: string; houseName: string },
    reason: SendingReason
): EncounterEntry {
    return {
        id: `${A_WORK_NOTICE}${notice.houseId}:${reason.id}`,
        name: aTaskAsPosted(reason.task, { house: notice.houseName, place: null }, reason.days),
        kind: 'opportunity',
        simEventKind: 'opportunity',
        weight: 1,
        minOrdinal: 0,
        maxOrdinal: MAX_ORDINAL,
        interrupts: false,
        threatOrdinal: clampOrdinal(reason.floorOrdinal ?? 0),
        summaryTemplate: reason.what,
        tokens: [],
        tags: ['notice', postedForTag(notice.houseName)]
    };
}

/** The house and the sending a board line was made from, or null for any other line. */
export function theNoticeBehind(entryId: string): { houseId: string; reason: SendingReason } | null {
    if (!entryId.startsWith(A_WORK_NOTICE)) return null;
    const [houseId, reasonId] = entryId.slice(A_WORK_NOTICE.length).split(':');
    const reason = SENDING_REASONS.find(row => row.id === reasonId);
    return houseId && reason ? { houseId, reason } : null;
}
