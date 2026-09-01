/**
 * Reading a tie against the roster: what the other end of it actually is now.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE MEASUREMENT THIS EXISTS FOR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A seeded world advanced four hundred years holds 24,026 relationships. 20,146
 * of them - 84% - point at somebody who is no longer alive, and that is not a
 * defect. The dead are never removed from `state.npcs`, deliberately: a grudge
 * opened in year 744 has to keep reading -0.9 in year 812, an heir has to be
 * able to inherit an account against somebody who died before they were born,
 * and `settleNpcDeath` hands unfinished goals on precisely so a revenge can
 * outlive the person who opened it. Every one of those ids resolves. Measured
 * across three seeds and four hundred years, ties that point at nobody: zero.
 *
 * What did not exist was any way to READ one. A reader that walks a tie and
 * looks the target up among the living finds nothing four times in five and has
 * to say something; and whatever it says - "no longer in the world", or worse,
 * just the name - is the same sentence for a master who died two centuries ago,
 * a sister who walked into a ruin in year 1122 and has not been seen since, and
 * a rival who is alive and standing in the next province.
 *
 * Those are three completely different facts and the world already knows which
 * is which. `npcBrief` - the bundle an LLM is handed to reason about somebody -
 * printed the stored `targetName` and nothing else, so the most common tie in
 * the world rendered exactly like the rarest one, and an agent reasoning from it
 * would go looking for a man who has been dead since before it was born.
 *
 * ── What this is not ─────────────────────────────────────────────────────
 *
 * Not a filter. A tie to somebody dead is a legitimate thing to hold and is not
 * dropped, downgraded or hidden; it is the single largest category of tie in the
 * world and hiding it would hide most of what the world remembers. This only
 * says what the other end IS, in one factual clause the narrator renders.
 */

import { yearOfDay } from './history.js';
import type { NpcRecord, NpcRelationship } from './npc-state.js';
import type { WorldState } from './world-state.js';

/**
 * What became of the person on the other end.
 *
 * Coarser than `ExistenceState` on purpose: a reader wants to know whether they
 * can be spoken to, mourned, or looked for, and the ten existence states answer
 * a different question. `unrecorded` is the only one that indicates a defect,
 * and it exists so that a dangling id reads as a dangling id rather than as a
 * death nobody can date.
 */
export type TieStanding = 'living' | 'dead' | 'unaccounted' | 'bodiless' | 'unrecorded';

export interface ResolvedTie {
    tie: NpcRelationship;
    /** The roster record, when the world holds one. */
    target: NpcRecord | null;
    standing: TieStanding;
    /** Year they died, or were last confirmed. Null where neither applies. */
    year: number | null;
    /**
     * The other end, in one factual clause. Engine-authored: it states what the
     * roster holds and nothing about how anybody feels about it.
     */
    description: string;
}

const BODILESS = new Set(['soul_preserved', 'remnant', 'sealed', 'possessing', 'reconstructed']);

/**
 * Who this person is NOW, given the roster record and the name a tie stored.
 *
 * Split from {@link readTie} so that a caller holding one record - and not the
 * whole world - can still say the true thing. `npcBrief` is the case: it takes
 * a person and a day, not a state.
 */
export function whoTheyAreNow(target: NpcRecord | null, storedName: string): {
    standing: TieStanding;
    year: number | null;
    description: string;
} {
    const name = target?.name ?? storedName;

    if (!target) {
        // The one case that means something is wrong. Named as such, so it can
        // be counted rather than mistaken for an ordinary absence.
        return {
            standing: 'unrecorded', year: null,
            description: `${name}, whom the world holds no record of`
        };
    }

    if (target.status === 'alive') {
        return { standing: 'living', year: null, description: name };
    }

    if (target.status === 'physically_dead') {
        const year = target.diedOnDay === null ? null : yearOfDay(target.diedOnDay);
        return {
            standing: 'dead', year,
            description: year === null ? `${name}, dead` : `${name}, dead since year ${year}`
        };
    }

    if (target.status === 'missing' || target.status === 'unknown') {
        const year = yearOfDay(target.lastConfirmedOnDay);
        return {
            standing: 'unaccounted', year,
            // Not "dead". The engine does not know, and saying so is the whole
            // reason `missing` is a state rather than a flavour of death.
            description: `${name}, not accounted for since year ${year}`
        };
    }

    if (BODILESS.has(target.status)) {
        const year = target.diedOnDay === null ? null : yearOfDay(target.diedOnDay);
        return {
            standing: 'bodiless', year,
            description: year === null
                ? `${name}, no longer in their own body`
                : `${name}, no longer in their own body since year ${year}`
        };
    }

    return { standing: 'living', year: null, description: name };
}

export function readTie(state: WorldState, tie: NpcRelationship): ResolvedTie {
    const target = state.npcs.find(n => n.id === tie.targetId) ?? null;
    return { tie, target, ...whoTheyAreNow(target, tie.targetName) };
}

/** Every tie this person holds, each read against the roster. */
export function readTies(state: WorldState, npc: NpcRecord): ResolvedTie[] {
    return npc.relationships.map(tie => readTie(state, tie));
}

/**
 * The ties that are still a live account with a live person.
 *
 * For callers that want who somebody has to deal with TODAY. Everything else is
 * still on the record; this is a question, not a pruning.
 */
export function livingTies(state: WorldState, npc: NpcRecord): ResolvedTie[] {
    return readTies(state, npc).filter(r => r.standing === 'living');
}
