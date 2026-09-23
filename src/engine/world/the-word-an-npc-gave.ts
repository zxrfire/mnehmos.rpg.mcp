/**
 * THE WORD AN NPC GAVE, and what happens when they do not keep it.
 *
 * `the-oath-a-house-offers-at-its-door.ts` has built the departure oath since it
 * was written - a `silence` oath not to transmit the house's arts - and only the
 * played layer ever called it, because only the player had a ledger. The world
 * pass had nowhere to put an `ObligationRecord`, so every NPC who walked out of
 * a house walked out of it having sworn nothing, and an NPC teaching a house's
 * own art broke nothing by doing it.
 *
 * ── WHY A STORE AND NOT THE TIE LEDGER ───────────────────────────────────
 *
 * The other way was to write the oath as a relationship, which NPCs already
 * have. A tie holds a kind, a standing and a note, and NOTHING that can be
 * resolved: the design owner's requirement is that breaking an oath *"resolves
 * as broken and opens `broken_oath` for the beneficiary"*, and a status, a
 * settlement, a day and a beneficiary are exactly what a tie has not got. Doing
 * it in a tie's note would be a second oath system wearing a relationship's
 * clothes, with its own rules for what a broken one looks like.
 *
 * So: {@link WorldState.obligations}, one array of the ledger's own
 * `ObligationRecord`, written by the ledger's own makers (`createOath`,
 * `createGrudge`) and closed by the ledger's own `settleObligation`. Nothing
 * here is a new kind of account. The cost is one world array and one table; what
 * it buys is that an NPC's word and a player's word are the same object, so
 * every reader of one reads the other.
 *
 * ── AND IT IS THE SAME OATH ──────────────────────────────────────────────
 *
 * The record comes out of `theOathAHouseOffersAtItsDoor` unchanged, terms and
 * all. Breaking it settles it `broken` and opens a `broken_oath` grudge held by
 * the house that was owed it. Teaching is the break, not holding: the oath
 * forbids transmission and says so in its own terms.
 */

import { createGrudge, settleObligation, type ObligationRecord } from '../social/grudges.js';
import { theOathAHouseOffersAtItsDoor, type AnswerAtTheDoor } from '../social/the-oath-a-house-offers-at-its-door.js';
import { forStream } from '../cultivation/rng.js';
import { openHandednessOf } from '../social-leverage/how-freely-somebody-parts-with-what-they-have.js';
import type { NpcRecord } from './npc-state.js';
import type { FactionRecord, WorldState } from './world-state.js';

/** The tag every departure oath and its breaking carries, with the house id beside it. */
export const A_WORD_GIVEN_AT_A_DOOR = 'left-a-house';

/**
 * How often somebody refuses the oath on their way out, before who they are is
 * read into it.
 *
 * Most people swear: it costs nothing to somebody who was not going to teach the
 * road anyway, and refusing means the house holds it against them from that day.
 * The ones who refuse are the close-fisted end of `openHandednessOf` - the same
 * disposition that decides what somebody will part with decides whether they
 * will hand over their silence.
 */
export const WHO_WILL_NOT_SWEAR = 0.25;

/** Whether this person swears at the door or refuses. Deterministic, off who they are. */
export function whetherTheySwear(
    seed: string,
    npc: Pick<NpcRecord, 'id'>,
    house: Pick<FactionRecord, 'id'>
): AnswerAtTheDoor {
    // Close-fisted doubles the refusal, open-handed halves it; nobody is certain.
    const them = 1 - openHandednessOf(npc.id);
    return forStream(seed, 'the-oath-at-the-door', npc.id, house.id)
        .chance(Math.min(0.6, WHO_WILL_NOT_SWEAR * them)) ? 'refuse' : 'swear';
}

/**
 * Put a record on the world's ledger. The one writer, so a record that reaches
 * the world always reaches the save.
 */
export function writeItDown(state: WorldState, record: ObligationRecord): ObligationRecord {
    state.obligations ??= [];
    const at = state.obligations.findIndex(o => o.id === record.id);
    if (at >= 0) state.obligations[at] = record;
    else state.obligations.push(record);
    return record;
}

/**
 * The house offers the oath at the door and this person answers it. Returns the
 * record written, whichever way they answered.
 */
export function theOathOnTheWayOut(
    state: WorldState,
    npc: Pick<NpcRecord, 'id' | 'name'>,
    house: Pick<FactionRecord, 'id' | 'name'>,
    onDay: number
): { answer: AnswerAtTheDoor; record: ObligationRecord } {
    const answer = whetherTheySwear(state.seed, npc, house);
    const said = theOathAHouseOffersAtItsDoor({
        leaverId: npc.id,
        leaverName: npc.name,
        houseId: house.id,
        houseName: house.name,
        answer,
        onDay
    });
    return { answer, record: writeItDown(state, said.record) };
}

/** The open word this person gave this house, or null. */
export function theWordTheyGave(
    state: WorldState,
    personId: string,
    houseId: string
): ObligationRecord | null {
    for (const record of state.obligations ?? []) {
        if (record.kind !== 'oath' || record.cause !== 'silence') continue;
        if (record.status !== 'open') continue;
        if (record.holderId === personId && record.subjectId === houseId) return record;
    }
    return null;
}

/** What a broken word left behind. */
export interface AWordNotKept {
    /** The oath, settled `broken`. */
    settled: ObligationRecord;
    /** The `broken_oath` the house holds from that day. */
    opened: ObligationRecord;
}

/**
 * This person transmitted an art of a house they swore silence to.
 *
 * Settles the oath as broken and opens a `broken_oath` for the house, which is
 * the beneficiary named in the oath's own `subjectId`. Returns null when they
 * never swore, which is the ordinary case.
 */
export function theyTaughtWhatTheySworeNotTo(
    state: WorldState,
    teacher: Pick<NpcRecord, 'id' | 'name'>,
    houseId: string,
    houseName: string,
    onDay: number,
    whatTheyTaught: string
): AWordNotKept | null {
    const oath = theWordTheyGave(state, teacher.id, houseId);
    if (oath === null) return null;
    const settled = writeItDown(state, settleObligation(oath, {
        resolution: 'broken',
        onDay,
        byId: teacher.id,
        note: `${teacher.name} transmitted ${whatTheyTaught}, which is what the oath forbade.`
    }));
    const opened = writeItDown(state, createGrudge({
        holderId: houseId,
        subjectId: teacher.id,
        cause: 'broken_oath',
        // As heavy as the oath was: a house that took a grave word and reads its
        // breaking as a slight did not need the word.
        severity: oath.severity,
        onDay,
        description:
            `${teacher.name} swore not to transmit the arts of ${houseName} and taught `
            + `${whatTheyTaught} anyway.`,
        participants: [teacher.id],
        tags: [A_WORD_GIVEN_AT_A_DOOR, houseId, 'broke-the-oath']
    }));
    return { settled, opened };
}

/** Whether this person has ever broken their word to this house. */
export function theyBrokeTheirWordTo(state: WorldState, personId: string, houseId: string): boolean {
    return (state.obligations ?? []).some(o =>
        o.kind === 'oath' && o.holderId === personId && o.subjectId === houseId
        && o.settlement?.resolution === 'broken');
}
