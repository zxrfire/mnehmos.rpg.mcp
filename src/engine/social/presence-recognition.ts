/**
 * Whether somebody's presence registers on you at all.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS CLOSES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Played at the Azure Cloud Pavilion, at ordinal 25, asking who could teach:
 *
 *   1 stand above Deity Transformation First Turn (ordinal 25) on the roll and
 *   in the room. 0 can be named, 0 of those teach, and 1 are counted without a
 *   name because this cultivator has never met them.
 *
 * and the narrator rendered it as *"the presence of someone standing far above
 * ..., a height sixteen rungs beyond the deepest person you have ever
 * encountered."* The person is Ru Anwei, at ordinal 41, who has not left her
 * inner hall in three hundred and eighty years.
 *
 * THE GATE WITHHELD THE NAME AND HANDED OVER THE COUNT. A player who can name
 * nobody was still told there is exactly one person above them, and measured
 * exactly how far. The design owner:
 *
 *   > "this you shouldn't even know btw"
 *   > "you can only count those you know about (even if you don't know their
 *   >  names)"
 *   > "a DT wouldn't even make himself visible to you for no reason"
 *
 * So a name gate is not enough. Somebody you have never met and could not have
 * noticed is not *counted without a name* - they are **not counted**.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AND IT IS DERIVED, NOT A NEW RULE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `REGARD_BANDS` already answers "how does one rung meet another", and the
 * band at the top of it already says this in as many words:
 *
 *   unreachable   gap of nine rungs or more. *"far enough above that it is not
 *                 put in front of them. Asking does not produce it, and being
 *                 told so is the whole answer."*
 *
 * That is exactly the sentence the owner is asking for, already in the schema,
 * already the world's answer everywhere else a gap this size comes up. So this
 * module subtracts two ordinals, asks `regardFor`, and returns a boolean. It
 * introduces no threshold of its own.
 *
 * ── WHY NOT `concealmentScale` ───────────────────────────────────────────
 *
 * `concealmentScale` is the other candidate and is the right instrument for a
 * different question. It returns the SHARE of the population standing at or
 * above a rung, which prices a hidden door - how much of the world you have
 * excluded by concealing an entrance. It is a population figure, and turning
 * one into a per-person yes-or-no needs a threshold that would have to be
 * picked here. `regardFor` is already per-person, already rung-exact, and
 * already carries the refusal sentence. Where the two disagree they are
 * answering different questions, and this one is about a face rather than a
 * door.
 *
 * ── WHAT THIS MUST NOT DO ────────────────────────────────────────────────
 *
 * Not blindness. The owner was explicit: *"a visible elder holding court,
 * somebody who has spoken to you, a figure whose presence is the whole point of
 * a scene"* all stay visible. Every one of those is a knowledge row, so the
 * knowledge gate is checked FIRST and wins: somebody you know of is noticed at
 * any height. What this refuses is only the case where the roster or the room
 * would have handed you a person you have no way to have noticed.
 *
 * The unnamed-but-known case survives untouched and is the point of the split:
 * `KNOWING_STAGES` runs `unaware -> whisper -> named -> ...`, so a whisper is a
 * live row and a person you can count without naming. That is what "even if you
 * don't know their names" means, and it is a different fact from never having
 * heard of somebody at all.
 *
 * Pure. Two integers and a predicate in, a boolean out.
 */

import { regardFor } from '../cultivation/regard.js';

/**
 * Whether somebody standing at `theirOrdinal` registers on somebody standing at
 * `yourOrdinal`, ignoring anything either of them knows about the other.
 *
 * False only in the `unreachable` band, which is nine or more rungs up. Note
 * the asymmetry, and that it is correct: the band is read on the gap from the
 * OBSERVER to the OBSERVED, so standing higher lets you notice more people and
 * not fewer, and nobody is ever hidden from you by being beneath you.
 */
export function heightAloneWouldHideThem(
    theirOrdinal: number,
    yourOrdinal: number
): boolean {
    // `regardFor(gate, asker)` reads the gap as asker minus gate, so the person
    // being looked AT is the gate and the person doing the looking is the
    // asker. Getting these the wrong way round hides everybody beneath you,
    // which is the mirror-image bug and reads identically from the call site.
    //
    // `band` and not `physicalBand`: noticing somebody is a fact about what the
    // room reads, so a concealment that held should hide its holder here too.
    // With no approach declared the two are the same value and this is inert.
    return regardFor(theirOrdinal, yourOrdinal).band === 'unreachable';
}

/**
 * Whether this cultivator can notice that one is there at all.
 *
 * `known` is any live knowledge row about them - `isAwareOf`, the same
 * predicate the room read already uses for a face. It wins outright, because
 * being told about somebody, having met them, or having watched them hold a
 * hall are all rows, and none of them stops being true because of a rung gap.
 */
export function noticesThatTheyAreThere(input: {
    theirOrdinal: number;
    yourOrdinal: number;
    known: boolean;
}): boolean {
    if (input.known) return true;
    return !heightAloneWouldHideThem(input.theirOrdinal, input.yourOrdinal);
}
