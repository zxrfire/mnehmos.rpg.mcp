/**
 * Target resolution.
 *
 * `interact`, `investigate`, `move`, `refine`, `gather` and `train_technique`
 * all take a free-text subject, and free text is exactly where a hallucinated
 * entity would get in. So nothing here trusts the string: it is matched against
 * real rows and real catalog entries, and a subject that matches nothing
 * resolves to nothing. The caller then refuses the action rather than narrating
 * an encounter with a person who does not exist.
 *
 * That is the second half of the closed-enum protection. The enum stops a model
 * inventing an ACTION; this stops it inventing a THING to do it to.
 *
 * The one deliberate exception is a place name, and it is documented at
 * `resolvePlace`.
 */

import type Database from 'better-sqlite3';
import type { Cultivator } from '../schema/cultivation.js';
import { rankName } from '../engine/cultivation/realms.js';
import {
    HERBS,
    PILLS,
    RECIPES,
    SECTS,
    TECHNIQUES
} from '../data/cultivation/index.js';
import type { CultivationRepos } from '../server/consolidated/cultivation-support.js';

export type EntityKind =
    | 'cultivator'
    | 'sect'
    | 'technique'
    | 'pill'
    | 'herb'
    | 'recipe'
    | 'place';

export interface ResolvedEntity {
    kind: EntityKind;
    /** The row or catalog id. What a repository call would be given. */
    id: string;
    /** Display name, from the row or the catalog. Never the player's spelling. */
    name: string;
    /** Engine-sourced statements about it. Every one is read from state. */
    facts: string[];
}

// ─────────────────────────────────────────────────────────────────────────
// MATCHING
// ─────────────────────────────────────────────────────────────────────────

function normalise(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Score a candidate name against what the player typed.
 *
 * Exact beats prefix beats containment beats shared words, and anything below
 * one shared word scores zero. Deliberately conservative: a near-miss that
 * resolves to the wrong sect is worse than a miss that asks the player to be
 * clearer, because the near-miss becomes a real state change.
 */
export function matchScore(query: string, candidate: string): number {
    const q = normalise(query);
    const c = normalise(candidate);
    if (q.length === 0 || c.length === 0) return 0;
    if (q === c) return 100;
    if (c.startsWith(q) || q.startsWith(c)) return 80;
    if (c.includes(q) || q.includes(c)) return 60;

    const qWords = new Set(q.split(' ').filter(w => w.length > 2));
    const cWords = c.split(' ').filter(w => w.length > 2);
    const shared = cWords.filter(w => qWords.has(w)).length;
    if (shared === 0) return 0;
    return 20 + shared * 10;
}

/** Lowest score that counts as a match. Below this the target is unresolved. */
export const MATCH_THRESHOLD = 55;

function best<T>(query: string, items: readonly T[], nameOf: (item: T) => string): T | null {
    let winner: T | null = null;
    let winningScore = 0;
    for (const item of items) {
        const score = matchScore(query, nameOf(item));
        if (score > winningScore) {
            winner = item;
            winningScore = score;
        }
    }
    return winningScore >= MATCH_THRESHOLD ? winner : null;
}

// ─────────────────────────────────────────────────────────────────────────
// RESOLVERS
// ─────────────────────────────────────────────────────────────────────────

/**
 * A person: a real `cultivators` row, matched by name.
 *
 * The whole world is in one table, so this finds NPCs, rivals and the dead
 * alike. The self is excluded: "interact with myself" is a `status`.
 */
export function resolveCultivator(
    repos: CultivationRepos,
    query: string,
    selfId: string
): ResolvedEntity | null {
    const rows = repos.cultivators.roster().filter(entry => entry.id !== selfId);
    const match = best(query, rows, row => row.name);
    if (!match) return null;

    const facts = [
        `${match.name} is a ${match.kind} at ${rankName(match.realmOrdinal)}, age ${Math.floor(match.age)}.`,
        match.alive ? `${match.name} is alive.` : `${match.name} is dead: ${match.deathCause ?? 'cause unrecorded'}.`,
        match.sectName
            ? `Affiliation: ${match.sectName}${match.sectRank ? `, ${match.sectRank}` : ''}.`
            : `${match.name} is unaffiliated.`,
        `Whereabouts on record: ${match.location ?? 'unrecorded'}. Spirit stones: ${match.spiritStones}. Untreated injuries: ${match.untreatedInjuries}.`
    ];
    if (match.feuds.length > 0) {
        facts.push(`Standing grudges on record: ${match.feuds.join(', ')}.`);
    }

    return { kind: 'cultivator', id: match.id, name: match.name, facts };
}

/**
 * A faction: a sect written into this database, or one from the shipped
 * catalog. The database wins, so an operator's own edits are what is seen.
 */
export function resolveSect(repos: CultivationRepos, query: string): ResolvedEntity | null {
    const stored = best(query, repos.sects.list(), sect => sect.name);
    if (stored) {
        return {
            kind: 'sect',
            id: stored.id,
            name: stored.name,
            facts: [
                `${stored.name} is a ${stored.alignment} sect.`,
                `It admits from ${rankName(stored.admissionOrdinal)}; its strongest member stands at ${rankName(stored.powerOrdinal)}.`,
                `Ranks, outer to inner: ${stored.ranks.join(', ')}.`
            ]
        };
    }

    const catalogued = best(query, SECTS, sect => sect.name);
    if (!catalogued) return null;

    const facts = [
        `${catalogued.name} is a ${catalogued.alignment} sect seated at ${catalogued.territory}.`,
        `It admits from ${rankName(catalogued.admissionOrdinal)}; its strongest member stands at ${rankName(catalogued.powerOrdinal)}.`,
        catalogued.recruits ? 'It takes applicants.' : 'It takes no applicants at all.',
        `Ranks, outer to inner: ${catalogued.ranks.join(', ')}.`
    ];
    if (catalogued.rivals.length > 0) {
        facts.push(`It has standing feuds with: ${catalogued.rivals.join(', ')}.`);
    }
    return { kind: 'sect', id: catalogued.id, name: catalogued.name, facts };
}

/** An art, from the catalog. Mastery is read from the join table when known. */
export function resolveTechnique(
    repos: CultivationRepos,
    query: string,
    cultivatorId: string
): ResolvedEntity | null {
    const match = best(query, TECHNIQUES, technique => technique.name);
    if (!match) return null;

    const known = repos.techniques.getKnown(cultivatorId, match.id);
    const facts = [
        `${match.name} is a ${match.grade}-grade ${match.category} art${match.element ? ` of ${match.element}` : ', elementless'}.`,
        `It requires ${rankName(match.requiredOrdinal)} to begin.`,
        known
            ? `Mastery: ${(known.mastery * 100).toFixed(0)}%.`
            : 'It is not known to this cultivator.',
        match.description
    ];
    return { kind: 'technique', id: match.id, name: match.name, facts };
}

/** A formula, from the recipe catalog. */
export function resolveRecipe(query: string): ResolvedEntity | null {
    const byRecipe = best(query, RECIPES, recipe => recipe.name);
    // Players name the pill far more often than the formula, so a pill name
    // resolves to the formula that produces it.
    const byPill = byRecipe
        ? null
        : (() => {
            const pill = best(query, PILLS, p => p.name);
            return pill ? RECIPES.find(r => r.producesPillId === pill.id) ?? null : null;
        })();

    const match = byRecipe ?? byPill;
    if (!match) return null;

    const pill = PILLS.find(p => p.id === match.producesPillId);
    return {
        kind: 'recipe',
        id: match.id,
        name: match.name,
        facts: [
            `${match.name} produces ${pill?.name ?? match.producesPillId}.`,
            `Base success ${(match.baseSuccessRate * 100).toFixed(0)}%, and it needs ${rankName(match.requiredOrdinal)}.`,
            `Ingredients: ${match.ingredients.map(i => `${i.quantity} x ${HERBS.find(h => h.id === i.itemId)?.name ?? i.itemId}`).join(', ') || 'none'}.`
        ]
    };
}

/** A herb, from the catalog. */
export function resolveHerb(query: string): ResolvedEntity | null {
    const match = best(query, HERBS, herb => herb.name);
    if (!match) return null;
    return {
        kind: 'herb',
        id: match.id,
        name: match.name,
        facts: [
            `${match.name} is a ${match.grade}-grade herb of the ${match.biome}.`,
            `Harvesting it safely wants ${rankName(match.harvestOrdinal)}. Market value about ${match.value} spirit stones.`,
            match.description
        ]
    };
}

/** A pill, from the catalog. */
export function resolvePill(query: string): ResolvedEntity | null {
    const match = best(query, PILLS, pill => pill.name);
    if (!match) return null;
    return {
        kind: 'pill',
        id: match.id,
        name: match.name,
        facts: [
            `${match.name} is a ${match.grade}-grade pill: ${match.effect}, potency ${match.potency}.`,
            `Toxicity ${match.toxicity}. Market value about ${match.value} spirit stones.`,
            match.description
        ]
    };
}

/**
 * A place.
 *
 * The deliberate exception to "resolve or fail". `Cultivator.location` is
 * documented in the schema as free text that the engine stores and lists but
 * never reasons about, and there is no gazetteer to check a name against yet -
 * so a plain, non-empty place name resolves to itself. What is checked is that
 * a name was given at all: "I set out." names nowhere, and sending the
 * cultivator to a place called "I set out." would quietly corrupt the run.
 *
 * TODO(world): once the world layer's `world_locations` store and
 * `assessCapability` are available, resolve against real locations and route
 * the attempt through the capability predicates instead, so that entering a
 * sealed ruin is answered by "what happens when you try" rather than by whether
 * a string was non-empty.
 */
export function resolvePlace(query: string | undefined): ResolvedEntity | null {
    const cleaned = (query ?? '').trim().slice(0, 80);
    if (cleaned.length < 2) return null;

    const catalogued = best(cleaned, SECTS, sect => sect.territory);
    return {
        kind: 'place',
        id: cleaned,
        name: cleaned,
        facts: catalogued
            ? [`${cleaned} lies in ${catalogued.territory}, which ${catalogued.name} holds.`]
            : [`${cleaned} is a place name the engine records but does not model. Nothing about it is simulated.`]
    };
}

// ─────────────────────────────────────────────────────────────────────────
// COMPOSITE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Anything at all: a person, a faction, an art, a formula, a herb, a pill.
 *
 * Order is by how consequential a mistaken match would be. Resolving a person
 * wrongly is worse than resolving a herb wrongly, so people are checked first
 * and the first entity to clear the threshold wins.
 */
export function resolveAnything(
    repos: CultivationRepos,
    query: string,
    self: Cultivator
): ResolvedEntity | null {
    return (
        resolveCultivator(repos, query, self.id) ??
        resolveSect(repos, query) ??
        resolveTechnique(repos, query, self.id) ??
        resolveRecipe(query) ??
        resolvePill(query) ??
        resolveHerb(query)
    );
}

/** A person or a faction. The two things `interact` can be pointed at. */
export function resolveParty(
    repos: CultivationRepos,
    query: string,
    self: Cultivator
): ResolvedEntity | null {
    return resolveCultivator(repos, query, self.id) ?? resolveSect(repos, query);
}

/**
 * Names worth suggesting when a subject resolved to nothing.
 *
 * Sourced from real rows and real catalog entries, so a refusal is useful
 * rather than merely a refusal: it tells the player what is actually there.
 */
export function nearbyNames(repos: CultivationRepos, self: Cultivator, limit = 6): string[] {
    const people = repos.cultivators
        .roster()
        .filter(row => row.id !== self.id && row.alive)
        .slice(0, limit)
        .map(row => row.name);
    if (people.length > 0) return people;
    return SECTS.filter(sect => sect.recruits).slice(0, limit).map(sect => sect.name);
}

/** Arts this cultivator actually knows, for a refusal that helps. */
export function knownTechniqueNames(repos: CultivationRepos, cultivatorId: string): string[] {
    return repos.techniques.listKnown(cultivatorId).map(known => known.name);
}

/** Herbs the pouch actually holds, for a refusal that helps. */
export function pouchNames(db: Database.Database, cultivatorId: string): string[] {
    const rows = db
        .prepare('SELECT item_id, quantity FROM cultivator_pouch WHERE cultivator_id = ? AND quantity > 0')
        .all(cultivatorId) as Array<{ item_id: string; quantity: number }>;
    return rows.map(row => {
        const name = HERBS.find(h => h.id === row.item_id)?.name
            ?? PILLS.find(p => p.id === row.item_id)?.name
            ?? row.item_id;
        return `${row.quantity} x ${name}`;
    });
}
