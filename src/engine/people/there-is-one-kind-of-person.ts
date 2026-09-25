/**
 * THERE IS ONE KIND OF PERSON.
 *
 * A human being in this world is stored in two places - a `Cultivator` row for
 * anybody a run is being played through, and an `NpcRecord` in the world state
 * for everybody else - and that is drift being worked off, not a design. It is
 * not being merged here. What is being merged is the READ: the questions you can
 * ask about a person are answered the same way whichever table they came out of.
 *
 * ── WHY THE READ AND NOT THE STORAGE ─────────────────────────────────────
 *
 * Because the storage merge is expensive and the read is cheap, and every verb
 * written before the read is unified has to be written twice: once with an
 * `if (stored)` inside it, and again when the tables merge. The read is what
 * makes the second version unnecessary.
 *
 * The one question asked of both stores here is who is drawing on a piece of
 * ground. A general person read (name, age, rung, where) was written beside it
 * and nothing asked it, so it went; the next question both stores have to
 * answer the same way belongs in this file.
 *
 * ── WHERE THE TWO GENUINELY DISAGREE ─────────────────────────────────────
 *
 * Satiety, starvation, bleeding, cultivation progress, battle counters and
 * achievements are A RUN'S FACTS ABOUT A PERSON, not the person's own. THE RUN
 * SHEET WINS WHERE THERE IS ONE; WHERE THERE IS NONE, THE WORLD'S DERIVATION
 * ANSWERS. Nothing here invents a value for a fact only a run can hold.
 */

import type { Cultivator } from '../../schema/cultivation.js';
import type { NpcRecord } from '../world/npc-state.js';

/**
 * EVERYBODY DRAWING ON ONE PIECE OF GROUND.
 *
 * The one answer, and it exists because there were two. Measured in the play
 * loop before this:
 *
 *   `othersPresent`  world NPCs PLUS stored cultivators, minus the asker
 *   `groundFor`      world NPCs plus the asker, and NO stored cultivators
 *
 * so a square holding another played character was one person for the purposes
 * of who you could talk to and a different number for the purposes of how thin
 * the qi was - and `how-crowded-this-ground-is.ts` states in its own input type
 * that it wants "everyone drawing on this ground, this cultivator INCLUDED".
 * The crowding read was the one that was wrong, and it is the one that feeds the
 * largest multiplier in the seclusion model.
 *
 * SELF IS INCLUDED, because the question is about the ground and a person
 * standing on it draws from it. A caller that wants the crowd rather than the
 * draw filters the asker out itself, where the reader can see it happen.
 */
export function everybodyDrawingHere(input: {
    /** World people standing here. */
    inTheWorld: readonly NpcRecord[];
    /** Run-sheet people standing here, the asker among them. */
    onRunSheets: readonly Pick<Cultivator, 'id' | 'realmOrdinal' | 'alive'>[];
    onDay: number;
}): number[] {
    const seen = new Set<string>();
    const out: number[] = [];
    // Run sheets first, because a person on one is the authority about
    // themselves and the world's copy of them is the one to drop.
    for (const row of input.onRunSheets) {
        if (!row.alive || seen.has(row.id)) continue;
        seen.add(row.id);
        out.push(row.realmOrdinal);
    }
    for (const npc of input.inTheWorld) {
        if (npc.status !== 'alive') continue;
        // The world's row for somebody who also has a run sheet is the same
        // person twice, and counting them twice is what put four different
        // answers on one square.
        const bare = npc.id.startsWith('npc-') ? npc.id.slice(4) : npc.id;
        if (seen.has(npc.id) || seen.has(bare)) continue;
        seen.add(npc.id);
        out.push(npc.cultivation.realmOrdinal);
    }
    return out.sort((a, b) => a - b);
}
