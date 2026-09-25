/**
 * Somebody you had heard of, standing in front of you.
 *
 * The owner's ruling, in two halves. SAID ALOUD - "oh, you're X, I've heard of
 * you" - the reaction follows the reputation: known for a victory, being known
 * for it flatters them; known for a disgrace, it stings. KEPT TO YOURSELF, the
 * player knows who they are and they do not know they were recognised, so
 * nothing changes between them; whether the face is placed at all is a matter
 * of perception.
 *
 * Either way the player is now sure it is them, which is what lets the narrator
 * use the name (`thePlayerIsSureItIsThem`).
 */

import type { HistoricalEventKind, HistoricalFact } from '../engine/world/history.js';
import type { WorldState } from '../engine/world/world-state.js';

/** What somebody is known for, in words, and which way hearing it cuts. */
export interface KnownFor {
    what: string;
    cuts: 'flatters' | 'stings';
}

/** Deeds a person is glad to be known for. */
const FLATTERS: Partial<Record<HistoricalEventKind, string>> = {
    breakthrough: 'a breakthrough',
    realm_crossing: 'crossing into a higher realm',
    promotion: 'being raised in their house',
    succession: 'taking the chair of their house'
};

/** Deeds a person would rather nobody had heard of. */
const STINGS: Partial<Record<HistoricalEventKind, string>> = {
    expulsion: 'being put out of their house',
    betrayal: 'a betrayal'
};

/** Only what went round: a secret nobody could have heard is nobody's reputation. */
const HEARD_OF: ReadonlySet<HistoricalFact['visibility']> = new Set(['public', 'regional']);

/**
 * The latest thing this person is known for, off their own record, or null
 * where nothing they did went round either way.
 */
export function whatTheyAreKnownFor(state: Pick<WorldState, 'history' | 'npcs'>, personId: string): KnownFor | null {
    const npc = state.npcs.find(n => n.id === personId);
    if (!npc || npc.historyFactIds.length === 0) return null;
    const theirs = new Set(npc.historyFactIds);
    let latest: { fact: HistoricalFact; known: KnownFor } | null = null;
    for (const fact of state.history.facts) {
        if (!theirs.has(fact.id) || !HEARD_OF.has(fact.visibility)) continue;
        if (!fact.actors.some(actor => actor.id === personId)) continue;
        const known: KnownFor | null = FLATTERS[fact.kind] !== undefined
            ? { what: FLATTERS[fact.kind]!, cuts: 'flatters' }
            : STINGS[fact.kind] !== undefined
                ? { what: STINGS[fact.kind]!, cuts: 'stings' }
                : null;
        if (known && (!latest || fact.day >= latest.fact.day)) latest = { fact, known };
    }
    return latest?.known ?? null;
}

/** The ruling line for a name said aloud to somebody known for something. */
export function whatNamingThemDoes(name: string, known: KnownFor | null): string {
    if (known === null) return `You call ${name} by name, and they have not told it to you.`;
    return `You call ${name} by name. They are known for ${known.what}, and hear that you know it: `
        + (known.cuts === 'flatters' ? 'it pleases them.' : 'it stings.');
}

/**
 * How likely a face heard of is placed on sight, off the one attribute that is
 * about taking things in. Insight runs one to four.
 */
export function chanceOfPlacingAFace(insight: number): number {
    return Math.min(0.85, 0.2 + 0.15 * Math.max(1, Math.min(4, insight)));
}
