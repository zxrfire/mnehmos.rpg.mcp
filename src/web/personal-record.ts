/**
 * What the world holds about one person, and what that makes them.
 *
 * The join between the ledger and the two readings over it:
 *
 *   `storage/repos/obligation.repo.ts`   the rows
 *   `engine/social-leverage/personal-alignment.ts`
 *                                        what they add up to
 *   `engine/social-leverage/being-hunted.ts`
 *                                        who is in a position to do something
 *                                        about them
 *
 * Nothing here decides anything. The two engine functions are pure and this
 * supplies them, which is the same seam every other verb in this layer keeps.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY THE PLAYER'S ALIGNMENT WAS NEVER THEIR OWN
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `web/game.ts` reads an alignment in six places and every one of them is
 * `mySect?.alignment ?? null` on a `Party`. Those six are CORRECT and stay
 * exactly where they are: every one is asking a question about a HOUSE - will
 * your house back you running this, what does a house do when this is done to
 * one of its own - and `what-a-house-will-do-about-it.ts` is right to read the
 * house's own field for it.
 *
 * What was missing was not a better read of that field. It was that the PERSON
 * had no alignment anywhere at all: no column, no derivation, no reader. So a
 * cultivator was whatever their roll was, and a cultivator on no roll was
 * nothing whatever - including a cultivator who had spent forty years taking
 * things off people. This module is the second, different source for the same
 * three words when the subject is a person, and the ledger is where it comes
 * from because the ledger is where the world already writes down what people
 * have done.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * AND IT IS THE SAME CALL FOR ANYBODY
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The input is an id, a rung and a lookup. There is nothing in the signature
 * that knows whether the subject is the player, which is the point: a world in
 * which only the player has a reputation is a world in which nobody else has
 * done anything. Ask it about an NPC and it answers about the NPC, off the same
 * rows, through the same functions.
 */

import type { ObligationRecord } from '../engine/social/grudges.js';
import {
    whatTheirRecordMakesThem,
    type WhatSomebodyIs
} from '../engine/social-leverage/personal-alignment.js';
import {
    whoIsComingForYou,
    type AHolder,
    type BeingHunted,
    type TheQuarry
} from '../engine/social-leverage/being-hunted.js';
import { ledgerAbout, type ObligationDb } from '../storage/repos/obligation.repo.js';

export interface APersonsRecord {
    /** What their deeds add up to. Never null, and `neutral` for an empty life. */
    is: WhatSomebodyIs;
    /** Who may act on the accounts against them, and who may not. */
    hunted: BeingHunted;
    /** Every row naming them, oldest first. Open and settled both. */
    ledger: readonly ObligationRecord[];
    /**
     * The names for the sheet's `Feuds` line, DERIVED.
     *
     * `Cultivator.feuds` is a stored JSON array with one writer in the whole of
     * `src/`, on the MCP combat path, so the played game has never written one
     * and the panel has always said *"No one is currently hunting you"*. This is
     * the same question asked of the ledger instead, and it is empty exactly
     * when nobody who holds something is in a position to use it.
     */
    feuds: readonly string[];
    /**
     * The people who hold something and can do nothing with it.
     *
     * Kept apart from `feuds` rather than folded in, because they are two
     * different facts about where somebody stands and collapsing them loses the
     * more interesting one. A name written down by a house that cannot reach
     * you is worth saying out loud.
     */
    namesWithNothingBehindThem: readonly string[];
    /** Engine truth, two lines, for the mechanical channel. Never narration. */
    line: string;
}

/**
 * Read a person's whole record, and both readings over it.
 *
 * `lookUpHolder` answers who an id on the ledger actually is. It returns null
 * for anybody the caller cannot place, and `whoIsComingForYou` then leaves that
 * record out of both lists - which is the honest answer rather than a
 * convenient one, because a holder nobody can price is a holder nobody has
 * shown to be in a position to act.
 */
export function whatTheWorldHoldsAbout(input: {
    db: ObligationDb;
    /** Who the record is about, and what a mover would have to get past. */
    person: TheQuarry;
    lookUpHolder: (id: string) => AHolder | null;
    /** Absolute day. Omit to read the whole record. */
    asOfDay?: number;
}): APersonsRecord {
    const ledger = ledgerAbout(input.db, input.person.id);

    const is = whatTheirRecordMakesThem({
        personId: input.person.id,
        ledger,
        ...(input.asOfDay === undefined ? {} : { asOfDay: input.asOfDay })
    });

    const holders = new Map<string, AHolder>();
    for (const record of ledger) {
        if (record.subjectId !== input.person.id) continue;
        if (holders.has(record.holderId)) continue;
        const holder = input.lookUpHolder(record.holderId);
        if (holder) holders.set(record.holderId, holder);
    }

    const hunted = whoIsComingForYou({
        quarry: input.person,
        ledger,
        holders,
        ...(input.asOfDay === undefined ? {} : { asOfDay: input.asOfDay })
    });

    return {
        is,
        hunted,
        ledger,
        // PEOPLE, not records. Somebody holding three separate accounts is one
        // person on the road behind you, and a panel that named them three
        // times would be reporting the ledger's row count as a crowd.
        feuds: distinct(hunted.coming.map(p => p.holderName)),
        namesWithNothingBehindThem: distinct(
            hunted.namesWithNothingBehindThem.map(p => p.holderName)
        ),
        line: `${is.line} ${hunted.line}`
    };
}

/** First occurrence wins, so the heaviest-first ordering is preserved. */
function distinct(names: readonly string[]): string[] {
    return [...new Set(names)];
}
