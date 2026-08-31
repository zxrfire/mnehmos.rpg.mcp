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
 * ── And a third gate: knowledge ───────────────────────────────────────────
 * Existing is not enough. docs/world/discovery.md: never reference an entity
 * the player has no knowledge record for. So resolution of people, factions and
 * places is scoped to a `KnowledgeScope` - what this cultivator has heard of,
 * plus whoever is physically standing in front of them. A sect the player has
 * never heard the name of does not resolve, and the refusal is worded so that
 * it does not confirm the sect exists either. Ignorance has to be real to be
 * worth anything.
 *
 * The item catalogs (techniques, pills, herbs, formulas) are not scoped; see
 * the note on `KnownEntityKind` for why.
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
import type { KnowledgeGate } from './knowledge.js';

export type EntityKind =
    | 'cultivator'
    | 'sect'
    | 'technique'
    | 'pill'
    | 'herb'
    | 'recipe'
    | 'place';

/**
 * Who is asking, and what they have heard of.
 *
 * `here` is the whole reason this is not simply a knowledge lookup: you can see
 * who is in the room with you whether or not anyone ever said their name.
 * discovery.md calls that stage `encountered`, and the caller turns it into a
 * real knowledge record with source `witnessed` once it resolves.
 */
export interface KnowledgeScope {
    gate: KnowledgeGate;
    holderId: string;
    /** Where the holder is standing. Anyone else here is perceivable. */
    here: string | null;
}

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
// REDACTION
//
// Resolving an entity the player knows about is not the end of it. The facts
// ABOUT that entity name other entities - the sect a person belongs to, the
// territory a sect is seated in, the rivals it feuds with - and those are
// exactly the ancient names discovery.md is protecting. A leak through the
// facts of a permitted lookup is still a leak, and it is the subtle one.
//
// So every name inside a fact goes through here first. What comes back for an
// unknown name is not a blank: it is the shape of the thing without the label,
// which is what the player would actually perceive.
// ─────────────────────────────────────────────────────────────────────────

/** A name the holder has heard, or a description of it that names nothing. */
function nameOrShape(
    scope: KnowledgeScope | undefined,
    kind: 'cultivator' | 'sect' | 'place',
    id: string,
    name: string,
    shape: string
): string {
    if (!scope) return name;
    return scope.gate.isAwareOf(scope.holderId, kind, id) ? name : shape;
}

/** A place name, or an admission that the player could not name it. */
function placeOrShape(scope: KnowledgeScope | undefined, place: string | null): string {
    if (!place) return 'unrecorded';
    if (!scope) return place;
    const here = (scope.here ?? '').trim().toLowerCase();
    if (here.length > 0 && place.trim().toLowerCase() === here) return place;
    return scope.gate.isAwareOf(scope.holderId, 'place', place)
        ? place
        : 'somewhere this cultivator could not name';
}

/**
 * Keep only the names the holder has heard, and report the rest by count.
 *
 * "It has standing feuds with three parties, none of whom this cultivator could
 * name" is a better sentence than the list, and it is the only honest one.
 */
function knownNamesOnly(
    scope: KnowledgeScope | undefined,
    kind: 'cultivator' | 'sect',
    entries: readonly { id: string; name: string }[]
): { named: string[]; hidden: number } {
    if (!scope) return { named: entries.map(e => e.name), hidden: 0 };
    const named: string[] = [];
    let hidden = 0;
    for (const entry of entries) {
        if (scope.gate.isAwareOf(scope.holderId, kind, entry.id)) named.push(entry.name);
        else hidden++;
    }
    return { named, hidden };
}

/** One line for a list that may be wholly or partly unnameable. */
function describeParties(label: string, named: string[], hidden: number): string | null {
    if (named.length === 0 && hidden === 0) return null;
    if (named.length === 0) {
        return `${label}: ${hidden}, none of whom this cultivator could name.`;
    }
    return hidden === 0
        ? `${label}: ${named.join(', ')}.`
        : `${label}: ${named.join(', ')}, and ${hidden} more this cultivator could not name.`;
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
    selfId: string,
    scope?: KnowledgeScope
): ResolvedEntity | null {
    const here = scope?.here?.trim().toLowerCase() ?? null;
    const rows = repos.cultivators.roster().filter(entry => {
        if (entry.id === selfId) return false;
        if (!scope) return true;
        // Standing in the same place counts: you do not need to have been told
        // a stranger's name to see that they are there.
        if (here !== null && (entry.location ?? '').trim().toLowerCase() === here) return true;
        return scope.gate.isAwareOf(scope.holderId, 'cultivator', entry.id);
    });

    const match = best(query, rows, row => row.name);
    if (!match) return null;

    // Every name inside these facts is redacted independently. Being able to
    // see a person does not mean being able to name the faction they serve.
    const affiliation = match.sectId && match.sectName
        ? nameOrShape(
            scope, 'sect', match.sectId, match.sectName,
            'a sect whose name means nothing to this cultivator')
        : null;

    const facts = [
        `${match.name} is a ${match.kind} at ${rankName(match.realmOrdinal)}, age ${Math.floor(match.age)}.`,
        match.alive ? `${match.name} is alive.` : `${match.name} is dead: ${match.deathCause ?? 'cause unrecorded'}.`,
        affiliation
            ? `Affiliation: ${affiliation}${match.sectRank ? `, ${match.sectRank}` : ''}.`
            : `${match.name} is unaffiliated.`,
        `Whereabouts on record: ${placeOrShape(scope, match.location)}. ` +
        `Spirit stones: ${match.spiritStones}. Untreated injuries: ${match.untreatedInjuries}.`
    ];

    // Feuds are stored as free-text party labels rather than ids, so there is
    // nothing to check them against. They are withheld wholesale rather than
    // guessed at: a grudge the player cannot name is still a grudge.
    if (match.feuds.length > 0) {
        const feudLine = scope
            ? describeParties('Standing grudges on record', [], match.feuds.length)
            : describeParties('Standing grudges on record', [...match.feuds], 0);
        if (feudLine) facts.push(feudLine);
    }

    return { kind: 'cultivator', id: match.id, name: match.name, facts };
}

/**
 * A faction: a sect written into this database, or one from the shipped
 * catalog. The database wins, so an operator's own edits are what is seen.
 */
export function resolveSect(
    repos: CultivationRepos,
    query: string,
    scope?: KnowledgeScope
): ResolvedEntity | null {
    const heard = (id: string): boolean =>
        !scope || scope.gate.isAwareOf(scope.holderId, 'sect', id);

    const stored = best(query, repos.sects.list().filter(sect => heard(sect.id)), sect => sect.name);
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

    const catalogued = best(query, SECTS.filter(sect => heard(sect.id)), sect => sect.name);
    if (!catalogued) return null;

    const seat = placeOrShape(scope, catalogued.territory);
    const facts = [
        `${catalogued.name} is a ${catalogued.alignment} sect seated at ${seat}.`,
        `It admits from ${rankName(catalogued.admissionOrdinal)}; its strongest member stands at ${rankName(catalogued.powerOrdinal)}.`,
        catalogued.recruits ? 'It takes applicants.' : 'It takes no applicants at all.',
        `Ranks, outer to inner: ${catalogued.ranks.join(', ')}.`
    ];

    // Rivals are the classic leak: asking about the one sect a villager has
    // heard of should not hand back the names of the four it fights with.
    if (catalogued.rivals.length > 0) {
        const rivals = catalogued.rivals.map(id => ({
            id,
            name: SECTS.find(sect => sect.id === id)?.name ?? id
        }));
        const { named, hidden } = knownNamesOnly(scope, 'sect', rivals);
        const line = describeParties('It has standing feuds with', named, hidden);
        if (line) facts.push(line);
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

    // Deliberately does NOT volunteer which sect holds the ground. That is one
    // of the most consequential facts in the world and it is not free for
    // standing on a road; it has to be learned from a source.
    return {
        kind: 'place',
        id: cleaned,
        name: cleaned,
        facts: [
            `${cleaned} is a place name the engine records but does not model. ` +
            'Nothing about it is simulated, and who holds the ground is not on record here.'
        ]
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
    self: Cultivator,
    scope?: KnowledgeScope
): ResolvedEntity | null {
    return (
        resolveCultivator(repos, query, self.id, scope) ??
        resolveSect(repos, query, scope) ??
        resolveKnownPlace(query, self, scope) ??
        resolveTechnique(repos, query, self.id) ??
        resolveRecipe(query) ??
        resolvePill(query) ??
        resolveHerb(query)
    );
}

/**
 * A place the holder has actually heard of, or the one they are standing in.
 *
 * Distinct from `resolvePlace`, which accepts any name because walking in a
 * direction does not require having been told where you are going. Examining a
 * place you have never heard of is a different claim, and it is refused.
 */
export function resolveKnownPlace(
    query: string,
    self: Cultivator,
    scope?: KnowledgeScope
): ResolvedEntity | null {
    const here = (self.location ?? '').trim();
    if (here.length >= 2 && matchScore(query, here) >= MATCH_THRESHOLD) {
        return resolvePlace(here);
    }
    if (!scope) return null;

    const known = scope.gate.awareness(scope.holderId, 'place');
    const match = best(query, known, row => row.name);
    return match ? resolvePlace(match.name) : null;
}

/** A person or a faction. The two things `interact` can be pointed at. */
export function resolveParty(
    repos: CultivationRepos,
    query: string,
    self: Cultivator,
    scope?: KnowledgeScope
): ResolvedEntity | null {
    return resolveCultivator(repos, query, self.id, scope)
        ?? resolveSect(repos, query, scope);
}

/**
 * Names worth suggesting when a subject resolved to nothing.
 *
 * Scoped, and this one matters more than it looks: the old version fell back to
 * listing every recruiting sect in the catalog, which handed the player - and
 * then the narrator - the answer key inside an error message. A refusal that
 * leaks the world is worse than a refusal that does not help.
 *
 * What is offered instead: people standing in the same place, and names this
 * cultivator has actually heard. If that list is empty, the honest answer is
 * that they know of nobody, and the caller says so.
 */
export function nearbyNames(
    repos: CultivationRepos,
    self: Cultivator,
    scope?: KnowledgeScope,
    limit = 6
): string[] {
    const here = (self.location ?? '').trim().toLowerCase();
    const colocated = repos.cultivators
        .roster()
        .filter(row =>
            row.id !== self.id &&
            row.alive &&
            here.length > 0 &&
            (row.location ?? '').trim().toLowerCase() === here)
        .map(row => row.name);

    const heardOf = scope
        ? scope.gate
            .awareness(scope.holderId)
            .filter(row => row.kind === 'cultivator' || row.kind === 'sect')
            .map(row => row.name)
        : [];

    const seen = new Set<string>();
    const out: string[] = [];
    for (const name of [...colocated, ...heardOf]) {
        if (seen.has(name)) continue;
        seen.add(name);
        out.push(name);
        if (out.length >= limit) break;
    }
    return out;
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
