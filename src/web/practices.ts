/**
 * What the people standing in front of you do, and do not think worth
 * mentioning.
 *
 * ── A different channel from names, and the difference is the whole file ──
 * `lore.ts` and `hearsay.ts` handle names: things a player is TOLD, which are
 * governed by `discovery.md`'s hard rule and may not be spoken until the player
 * has a knowledge record. This file handles the opposite kind of content -
 * things a player SEES - and it is governed by the other half of the doctrine,
 * from NARRATOR-CORE:
 *
 *   > Show the world, never explain it. Render these as behaviour and let the
 *   > player infer.
 *
 * A practice names nothing. "Disciples stand when a sword is drawn anywhere in
 * earshot, including in a kitchen" identifies no faction, no person and no
 * place. It is the single best kind of content in the repo for a stranger,
 * because it can be shown to somebody who cannot name a single thing in the
 * world and it still tells them something true. Being in the room is enough.
 *
 * That is why this is not a `lore.ts` catalog. A practice is not speakable and
 * would be wrong as a name-drop; it is observable, and the observing is the
 * point.
 *
 * ── The one place it does have to be gated ────────────────────────────────
 * Eight of the thirty practices use their own faction's short name in the
 * middle of a sentence - "a Consortium negotiation", "a Pavilion member", "the
 * Wanderers", "the Office". Those cannot be shown to somebody with no record
 * for the faction, because the sentence would hand them the name.
 *
 * So the gate is narrow and computed rather than asserted: a practice is
 * unrestricted unless it capitalises one of its own faction's name tokens
 * away from a sentence start, and those unlock when the player learns the
 * name. Which is the correct shape anyway - knowing what to call these people
 * changes what you are able to notice about them.
 */

import { FACTION_CHARACTER, getSect } from '../data/cultivation/index.js';
import type { RosterEntry } from '../storage/repos/cultivator.repo.js';
import type { KnowledgeGate } from './knowledge.js';

/** One thing the people here do, as an outsider sees it in ten minutes. */
export interface Observation {
    factionId: string;
    /** The behaviour, verbatim from the catalog. Never paraphrased. */
    practice: string;
    /**
     * Whether the sentence uses the faction's own name.
     *
     * True means it may only be shown to somebody who already holds the name.
     * False means it names nothing at all and is safe for a total stranger,
     * which is true of most of them.
     */
    namesFaction: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// THE NARROW GATE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Whether a practice says its own faction's name out loud.
 *
 * Detected from the text rather than maintained by hand, so a rewritten
 * practice cannot silently start leaking a name that the catalog author did
 * not think of as a name.
 *
 * The signal is a capitalised word, away from a sentence start, matching a
 * token of the faction's own name. That separates the two cases that look
 * alike and are not: "Wardens carry paint and a brush" opens a sentence and is
 * a role - it identifies nobody - whereas "a Consortium negotiation begins
 * with somebody unpacking scales" is the institution, named.
 */
function detectNamesFaction(factionId: string, practice: string): boolean {
    const name = getSect(factionId)?.name ?? '';
    // Short words are articles and prepositions and match everything.
    const tokens = name.split(/\s+/)
        .filter(word => word.length >= 4)
        .map(word => word.toLowerCase());
    if (tokens.length === 0) return false;

    let previous = '';
    for (const word of practice.split(/\s+/)) {
        const bare = word.replace(/[^A-Za-z]/g, '');
        const sentenceInitial =
            previous === '' || previous === '-' || /[.?!]$/.test(previous);
        if (!sentenceInitial && /^[A-Z]/.test(bare)
            && tokens.some(token => bare.toLowerCase().startsWith(token.slice(0, 5)))) {
            return true;
        }
        previous = word;
    }
    return false;
}

/** Every practice, with its gate resolved. Built once at module load. */
export const PRACTICES: ReadonlyMap<string, Observation> = (() => {
    const out = new Map<string, Observation>();
    for (const [factionId, character] of Object.entries(FACTION_CHARACTER)) {
        const practice = character.practice?.trim();
        if (!practice) continue;
        out.set(factionId, {
            factionId,
            practice,
            namesFaction: detectNamesFaction(factionId, practice)
        });
    }
    return out;
})();

/** The practice for one faction, when the catalog carries one. */
export function practiceOf(factionId: string): Observation | null {
    return PRACTICES.get(factionId) ?? null;
}

/**
 * Whether this holder is allowed to see this one.
 *
 * Unrestricted unless the sentence would name the faction, in which case the
 * holder has to already hold the name.
 */
export function mayObserve(
    observation: Observation,
    gate: KnowledgeGate,
    holderId: string
): boolean {
    if (!observation.namesFaction) return true;
    return gate.isAwareOf(holderId, 'sect', observation.factionId);
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IS VISIBLE IN THIS SCENE
// ─────────────────────────────────────────────────────────────────────────

export interface ObservableInput {
    /** Who is standing here. Only their affiliation is read. */
    present: readonly RosterEntry[];
    gate: KnowledgeGate;
    holderId: string;
    /** Seeded, so the same square on the same day shows the same thing. */
    rng: { int(min: number, max: number): number };
}

/**
 * One thing worth noticing about the people here, or nothing.
 *
 * Deliberately at most one. A scene that lists what three different factions do
 * is a briefing with people standing in it, and the value of a practice is that
 * it is a single concrete thing a player carries away and only understands
 * later - two sects apart, on the fourth or fifth time they see it.
 *
 * Returns null when nobody present belongs to anything, which is most of the
 * world most of the time.
 */
export function observableHere(input: ObservableInput): Observation | null {
    const { present, gate, holderId, rng } = input;

    // Deduped and sorted before the draw, so the result depends on who is here
    // and on the seed, and never on the order a query happened to return rows.
    const factionIds = [...new Set(
        present
            .map(person => person.sectId)
            .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )].sort();

    const candidates: Observation[] = [];
    for (const factionId of factionIds) {
        const observation = PRACTICES.get(factionId);
        if (!observation) continue;
        if (!mayObserve(observation, gate, holderId)) continue;
        candidates.push(observation);
    }
    if (candidates.length === 0) return null;

    return candidates[rng.int(0, candidates.length - 1)];
}

/**
 * The observation as a line of engine prose.
 *
 * The practice is quoted verbatim, never paraphrased: it is authored content
 * and this layer's job is to deliver it, not to rewrite it. The lead is fixed
 * rather than sampled, because the register that carries a practice is that
 * nobody doing it considers it remarkable - and a lead that varied every turn
 * would be the narrator drawing attention to the thing the fiction says nobody
 * draws attention to.
 */
export function observedLine(observation: Observation): string {
    return `Something the people here do without appearing to notice they do it. ${observation.practice}`;
}
