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
 * ── AND WHY IT CONVERGES ON THE WORLD'S SHAPE ────────────────────────────
 *
 * The NPC side DERIVES what the player side STORES. An NPC's age is a birth day
 * and today; a cultivator's age is a number somebody has to remember to
 * increment. Converging on the derived form deletes writes rather than adding
 * them, which is the direction this engine's own rule points.
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

/** One person, from either store, reduced to what both can answer. */
export interface Person {
    id: string;
    name: string;
    /** The rung. The one field neither store disagrees about. */
    realmOrdinal: number;
    /** Years lived. Derived on the world side, stored on the run side. */
    age: number;
    /** Whether they are standing. Not the same as "not dead": see `isAlive`. */
    alive: boolean;
    /** Where they are, as the store that holds them names it. */
    where: string | null;
    /** Which store answered. For a caller that genuinely needs to know. */
    from: 'a_run' | 'the_world';
}

/** Days in a year, for the one derivation that needs it. */
const DAYS_PER_YEAR = 365;

/** How old somebody in the world is, on a given day. */
export function ageOf(npc: NpcRecord, onDay: number): number {
    return Math.max(0, Math.floor((onDay - npc.identity.bornOnDay) / DAYS_PER_YEAR));
}

/**
 * Whether somebody is standing.
 *
 * `status === 'alive'` and not `status !== 'dead'`, because the world has a
 * third state: `soul_preserved` is not dead and is not somebody you can talk to
 * in a square. A caller that wants the wider question asks for the status.
 */
export function isAlive(who: { status?: string; alive?: boolean }): boolean {
    if (typeof who.alive === 'boolean') return who.alive;
    return who.status === 'alive';
}

/** A world person, read as a person. */
export function personFromTheWorld(npc: NpcRecord, onDay: number): Person {
    return {
        id: npc.id,
        name: npc.name,
        realmOrdinal: npc.cultivation.realmOrdinal,
        age: ageOf(npc, onDay),
        alive: npc.status === 'alive',
        where: npc.locationId ?? null,
        from: 'the_world'
    };
}

/** A run's person, read as a person. */
export function personFromARun(cultivator: Cultivator): Person {
    return {
        id: cultivator.id,
        name: cultivator.name,
        realmOrdinal: cultivator.realmOrdinal,
        age: cultivator.age,
        alive: cultivator.alive,
        where: cultivator.location ?? null,
        from: 'a_run'
    };
}

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
