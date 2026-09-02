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
 * Existing is not enough. docs/world/houses/discovery.md: never reference an entity
 * the player has no knowledge record for. So resolution of people, factions and
 * places is scoped to a `KnowledgeScope` - what this cultivator has heard of,
 * plus whoever is physically standing in front of them. A sect the player has
 * never heard the name of does not resolve, and the refusal is worded so that
 * it does not confirm the sect exists either. Ignorance has to be real to be
 * worth anything.
 *
 * The item catalogs (techniques, pills, herbs, formulas) are not scoped; see
 * the note on `KnownEntityKind` for why.
 *
 * ── And a fourth: structure ───────────────────────────────────────────────
 * docs/world/writing/tone.md: nobody tells the protagonist how anything works. Knowing
 * that a sect exists is not knowing that it admits from ordinal 3, that its
 * ranks run Barrow Hand to Company Master, or that it is neutral rather than
 * righteous - those are schema categories, and a category handed to a narrator
 * becomes a briefing, because that is what a category in a prompt is for.
 *
 * So every resolver returns two channels. `facts` is what a person would
 * perceive or has been told, and is the only thing a prompt ever sees.
 * `structure` is the governance, the ladder, the ordinals and the grades, and
 * goes to the inspector, where mechanical precision is the entire point.
 */

import type Database from 'better-sqlite3';
import type { Cultivator } from '../schema/cultivation.js';
import type { RosterEntry } from '../storage/repos/cultivator.repo.js';
import { SPIRIT_ROOTS } from '../engine/cultivation/spirit-roots.js';
import { describeStanding, rungAndOrdinal } from './facts.js';
import {
    HERBS,
    PILLS,
    RECIPES,
    SECTS,
    TECHNIQUES
} from '../data/cultivation/index.js';
import { PRICES, type Price } from '../data/cultivation/mortal-world.js';
import type { CultivationRepos } from '../server/consolidated/cultivation-support.js';
import { loosePlaceKey, placeKey, type KnowledgeGate } from './knowledge.js';
import type { LocationRecord } from '../engine/world/locations.js';
import {
    readALineageOffAName,
    readTheRollFor
} from '../engine/world/reading-a-lineage-off-a-name.js';
import type { WorldState } from '../engine/world/world-state.js';

export type EntityKind =
    | 'cultivator'
    | 'sect'
    | 'technique'
    | 'pill'
    | 'herb'
    | 'recipe'
    | 'place'
    /** A line on the mortal price board. Not gated: the player was shown it. */
    | 'price';

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
    /**
     * Everybody standing in the same place, from both populations.
     *
     * Supplied rather than looked up because resolving it needs the world, and
     * the world is loaded once per action rather than once per lookup. An empty
     * list means nobody is about; an absent list means nobody asked.
     */
    present?: readonly RosterEntry[];
}

/**
 * The world location a free-text place name refers to.
 *
 * A cultivator's `location` is free text by design - the schema says the engine
 * stores it and never computes with it - while world NPCs stand at location
 * ids like `loc-region-low-fall-sweptground`. Nineteen people were standing in
 * Sweptground and the player could not see one of them, because "Sweptground"
 * and that id never compared equal.
 *
 * The join is by NAME, because the name is the one thing both sides genuinely
 * agree on: the world's locations carry the display names the content authored,
 * and the display name is what the player typed. An unmatched name is not an
 * error - it is a road, or a hillside, or somewhere the gazetteer does not
 * name, and the honest answer is that there is nobody there.
 */
export function worldLocationFor(world: WorldState, place: string | null): LocationRecord | null {
    const wanted = (place ?? '').trim().toLowerCase();
    if (wanted.length === 0) return null;

    const exact = world.locations.find(l => l.name.trim().toLowerCase() === wanted);
    if (exact) return exact;

    // "the Low Fall" against "Low Fall", and the id form for anything that
    // reached us already keyed.
    //
    // This comment was here before the code did it. `placeKey` keeps the
    // article and the parser strips it, so the two sides could never agree for
    // any location whose name begins with "the" - which in a generated world is
    // 26 of 33, including every ruin, every scar and all four sites at the qi
    // ceiling. `loosePlaceKey` drops the article on BOTH sides; the stored key
    // is untouched, because changing that orphans every knowledge record ever
    // written.
    const key = placeKey(wanted);
    const loose = loosePlaceKey(wanted);
    return world.locations.find(l =>
        placeKey(l.name) === key
        || loosePlaceKey(l.name) === loose
        || l.id === wanted
        || l.id.endsWith(`-${key}`)
        || l.id.endsWith(`-${loose}`)) ?? null;
}

export interface ResolvedEntity {
    kind: EntityKind;
    /** The row or catalog id. What a repository call would be given. */
    id: string;
    /** Display name, from the row or the catalog. Never the player's spelling. */
    name: string;
    /**
     * What this cultivator perceives or has been told. Narratable.
     *
     * Every one is read from state, and every one is phrased as observation.
     * If a line here would teach the player a rule, it belongs in `structure`.
     */
    facts: string[];
    /** Categories, ladders, ordinals, grades. Inspector only, never prompted. */
    structure: string[];
    /**
     * The numbers a resolver needs, when this entity is a person.
     *
     * Everything above is either narratable prose or an inspector string, and
     * a caller that needs the rung to price something against was reduced to
     * parsing `structure` for it. These are the same values that line already
     * carries, exposed as numbers so `engine/social-leverage/` can be handed a
     * party without re-fetching the row.
     *
     * Absent for a sect or a place, and absent for a person the player has not
     * resolved to a real row. Nothing here is ever narrated: it is the same
     * inspector-only material as `structure`, in a shape code can read.
     */
    party?: {
        realmOrdinal: number;
        factionId: string | null;
        /** True when they hold a rank inside that house, not merely a badge. */
        ranked: boolean;
        charm?: number;
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE STRUCTURE CHANNEL, IN WORDS
//
// This channel goes to the inspector AND to the play log, so a player reads
// it - see the `structure` field comment in facts.ts for the standard it is
// written to. Every resolver below states its catalog row as sentences with
// the figures intact rather than as `Object.entries` joined with commas.
//
// What resolving the enum keys buys: `spiritRoot=single_metal` is a database
// key and "Single Metal Root" is the thing it names, and the second is not
// less precise than the first. Where there is no name to resolve to, the raw
// key is passed through rather than guessed at.
//
// And an ordinal always arrives with its rung. `ordinal` is a field name, not
// a rank, and every other surface in the game says "Qi Condensation Layer 1".
// ─────────────────────────────────────────────────────────────────────────

/**
 * The display name for a spirit-root key, falling back to the key.
 *
 * `getSpiritRoot` throws on an unknown key, and an inspector read must never be
 * the thing that takes a turn down. A root the catalog has never heard of reads
 * oddly instead of reading wrongly.
 */
function rootName(key: string): string {
    return SPIRIT_ROOTS.find(root => root.key === key)?.name ?? key;
}

/** `a` or `an`, so a grade band reads as English rather than as a field. */
function article(word: string): string {
    return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

/** The same, at the head of a sentence. */
function articleCapitalised(word: string): string {
    return article(word) === 'a' ? 'A' : 'An';
}

/** A schema band at the head of a sentence, which is where several of them sit. */
function capitalised(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

/** A list, rendered the way somebody would say it. */
function andList(items: readonly string[]): string {
    if (items.length === 0) return 'nothing';
    if (items.length === 1) return items[0];
    return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
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
    // Containment needs the shorter side to be distinctive, or a two-letter
    // fragment buried in the middle of a word wins outright at 60 - above
    // MATCH_THRESHOLD. Played: after buying the Lesser Qi-Gathering Manual,
    // `I learn it` resolved to Bitter Frost Needle, because "it" is inside
    // "B-it-ter", and answered about a rung-8 art the cultivator had never
    // heard of. `I learn the manual` was correct all along.
    //
    // Two characters is not a guess: the word-overlap branch immediately below
    // already discards words of two letters or fewer for exactly this reason,
    // so this makes one rule out of two halves that disagreed.
    if (Math.min(q.length, c.length) > 2 && (c.includes(q) || q.includes(c))) return 60;

    const qWords = new Set(q.split(' ').filter(w => w.length > 2));
    const cWords = c.split(' ').filter(w => w.length > 2);
    const shared = cWords.filter(w => qWords.has(w)).length;
    if (shared === 0) return 0;
    return 20 + shared * 10;
}

/** Lowest score that counts as a match. Below this the target is unresolved. */
export const MATCH_THRESHOLD = 55;

/**
 * The ways somebody refers to their own house without naming it.
 *
 * Anchored, so a real house called "The Sect of Our Own Making" is still
 * matched by name rather than swallowed here. `own` is included because "my own
 * sect" is as natural as "my sect"; a bare "the sect" is NOT, and deliberately:
 * standing in front of a stranger's compound and saying "the sect" means that
 * one, and answering with the player's own would be the substitution bug in a
 * different coat.
 */
export const MY_OWN_HOUSE =
    /^(?:my|our)\s+(?:own\s+)?(?:sect|house|order|school|clan|hall|pavilion|court)$/i;

/**
 * Words that stand in for a thing rather than naming one.
 *
 * A bare pronoun is never an entity's name, so it must never be scored against
 * the catalog - the best it can do is find something that happens to contain
 * its letters. Resolving what "it" refers to is a different job from matching a
 * name, and this file does not do that job; returning null is the honest answer
 * and lets the caller refuse in words the player can act on.
 */
export const STANDS_IN_FOR_A_THING = /^(?:it|them|they|him|her|he|she|that|this|those|these|one|its)$/i;

function best<T>(query: string, items: readonly T[], nameOf: (item: T) => string): T | null {
    if (STANDS_IN_FOR_A_THING.test(query.trim())) return null;

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

/**
 * A place name, or an admission that the player could not name it.
 *
 * The value handed in is whatever that roster row carries, and the two
 * populations carry different things: a `cultivators` row's `location` is free
 * text - a display name - and a world NPC's is a location id. Both reach here.
 *
 * So a gate that passes is not licence to print the argument. Where the holder
 * holds a record under the id, the record's own NAME is what gets said, because
 * nobody in this world says `loc-sect-azure-dew-sect-ground`. Found the moment
 * sect grounds became somewhere a player could learn about: the read went
 * straight from "somewhere this cultivator could not name" to printing the id,
 * which is the same defect as naming a ruin by its slug and breaks the rule
 * that a name the game prints is a name the game must accept.
 */
function placeOrShape(scope: KnowledgeScope | undefined, place: string | null): string {
    if (!place) return 'unrecorded';
    if (!scope) return place;
    const here = (scope.here ?? '').trim().toLowerCase();
    if (here.length > 0 && place.trim().toLowerCase() === here) return place;
    if (!scope.gate.isAwareOf(scope.holderId, 'place', place)) {
        return 'somewhere this cultivator could not name';
    }
    const held = scope.gate
        .awareness(scope.holderId, 'place')
        .find(row => row.id === place);
    return held?.name ?? place;
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
    scope?: KnowledgeScope,
    observerOrdinal = 0
): ResolvedEntity | null {
    const here = scope?.here?.trim().toLowerCase() ?? null;

    // Everybody the holder could be talking about: the table, plus whoever is
    // standing in front of them. The second half is where the world's people
    // come in, and without it a populated square resolves to nobody.
    const candidates = [...repos.cultivators.roster(), ...(scope?.present ?? [])];
    const seen = new Set<string>();
    const rows = candidates.filter(entry => {
        if (entry.id === selfId || seen.has(entry.id)) return false;
        seen.add(entry.id);
        if (!scope) return true;
        // Standing in the same place counts: you do not need to have been told
        // a stranger's name to see that they are there.
        if (here !== null && (entry.location ?? '').trim().toLowerCase() === here) return true;
        if ((scope.present ?? []).some(p => p.id === entry.id)) return true;
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

    // Rank is not stated. A cultivator perceives a gap, not an ordinal, and
    // handing a narrator "Nascent Soul Mid" produces power-level exposition,
    // which Tier 1 bans outright. The engine does the arithmetic; the prose
    // reports what it feels like to stand next to the answer.
    const facts = [
        `${match.name} is here, and reads as ${describeStanding(observerOrdinal, match.realmOrdinal)}.`,
        match.alive
            ? `They carry ${Math.floor(match.age)} years, however many of those show.`
            : `${match.name} is dead. Whatever ended them is not written where this cultivator can read it.`,
        affiliation
            ? `They wear the marks of ${affiliation}${match.sectRank ? `, and are addressed as ${match.sectRank}` : ''}.`
            : `${match.name} answers to nobody visible.`,
        `Last known to be at ${placeOrShape(scope, match.location)}.`
    ];

    if (match.untreatedInjuries > 0) {
        facts.push(`Something is wrong with the way they hold themselves. ${match.untreatedInjuries} injuries are open.`);
    }

    // ── what the name is worth ──
    //
    // `docs/world/houses/trust.md` puts names third in the hierarchy - below the arts
    // and below the objects - and this is the whole of what that rung buys: a
    // surname that carries a house on its own, which almost none do. Reading a
    // face gives nothing; reading a name gives corroboration at best.
    //
    // Gated on having heard of the house, like every other name in these
    // facts. A reserved name is a fact about the world and the LINK from it to
    // a house is knowledge, so a cultivator who has never heard of the Pavilion
    // learns nothing from meeting a Ru - which is correct rather than coy, and
    // is why this sits behind the same gate `affiliation` does.
    const lineage = readALineageOffAName(match.name);
    if (lineage.settles
        && lineage.houseIdItCarriesOnItsOwn
        && (!scope || scope.gate.isAwareOf(scope.holderId, 'sect', lineage.houseIdItCarriesOnItsOwn))) {
        facts.push(
            `${lineage.surname} is not a name people are simply born with. It belongs to `
            + `${lineage.houseItCarriesOnItsOwn}, and nobody carries it who is not of that line.`
        );
    }

    // Feuds are stored as free-text party labels rather than ids, so there is
    // nothing to check them against. They are withheld wholesale rather than
    // guessed at: a grudge the player cannot name is still a grudge.
    if (match.feuds.length > 0) {
        const feudLine = scope
            ? describeParties('There are parties who will not be in a room with them', [], match.feuds.length)
            : describeParties('Standing grudges on record', [...match.feuds], 0);
        if (feudLine) facts.push(feudLine);
    }

    return {
        kind: 'cultivator',
        id: match.id,
        name: match.name,
        facts,
        structure: [
            `Stands at ${rungAndOrdinal(match.realmOrdinal)}, carrying ${match.age} years, on `
            + `the roster as ${match.kind}. `
            + (match.alive
                ? 'Alive.'
                : `Dead${match.deathCause ? `, of ${match.deathCause}` : ', of nothing the row names'}.`),
            // What the name is worth against the house they stand on, stated
            // in the inspector even where the gate withholds it from the
            // prose. `corroborates` and never `settles` is the ordinary
            // answer, and it is the answer the design wants: names sit low.
            (() => {
                const reading = match.sectId
                    ? readTheRollFor(match.name, match.sectId)
                    : readALineageOffAName(match.name);
                return 'worth' in reading
                    ? `The name reads ${reading.worth} against ${match.sectId}.`
                    : `The name reads ${reading.reading}${reading.housesWithThisLine.length > 0
                        ? `, with a line of it on ${reading.housesWithThisLine.length} house roll(s)` : ''}.`;
            })(),
            (match.sectId
                ? `On the roll of ${match.sectId}`
                  + `${match.sectRank ? `, at the rank of ${match.sectRank}` : ', at no rank in it'}`
                : 'On no house\'s roll, and so at no rank in one')
            + `. ${rootName(match.spiritRoot)}. ${match.spiritStones} spirit stones and `
            + `${match.untreatedInjuries} untreated `
            + `injur${match.untreatedInjuries === 1 ? 'y' : 'ies'}. Last recorded at `
            + `${match.location ?? 'nowhere the row states'}.`
        ],
        // The same three values the line above prints, as numbers. See the
        // field's own comment on `ResolvedEntity`.
        party: {
            realmOrdinal: match.realmOrdinal,
            factionId: match.sectId ?? null,
            ranked: Boolean(match.sectId && match.sectRank)
        }
    };
}

/**
 * A faction: a sect written into this database, or one from the shipped
 * catalog. The database wins, so an operator's own edits are what is seen.
 */
export function resolveSect(
    repos: CultivationRepos,
    query: string,
    scope?: KnowledgeScope,
    memberOf: string | null = null
): ResolvedEntity | null {
    const heard = (id: string): boolean =>
        !scope || scope.gate.isAwareOf(scope.holderId, 'sect', id);

    // ── "my sect" ──
    //
    // A possessive is not a name and cannot be matched like one, so "I ask my
    // sect for a technique" resolved to nobody while the refusal printed
    // "Known to this cultivator: Azure Dew Sect" in the same breath - the
    // membership row was right there. Nobody says the name of their own house
    // when they mean their own house.
    //
    // It bypasses the knowledge gate, and that is correct rather than a leak:
    // the gate exists so a name has to reach a cultivator before they can use
    // it, and somebody's own house is the one name they cannot fail to hold.
    // A possessive from somebody who serves nothing still resolves to nothing.
    if (memberOf && MY_OWN_HOUSE.test(query.trim())) {
        const own = repos.sects.getById(memberOf);
        if (own) {
            return {
                kind: 'sect',
                id: own.id,
                name: own.name,
                facts: sectFacts(own.name, own.admissionOrdinal, true, own.ranks),
                structure: [
                    `"${query.trim()}" was resolved through this cultivator\'s own membership `
                    + `row rather than by name, and it named ${own.name}. Not gated on `
                    + 'awareness: a member holds their own house\'s name by standing in it.'
                ]
            };
        }
    }

    const stored = best(query, repos.sects.list().filter(sect => heard(sect.id)), sect => sect.name);
    if (stored) {
        return {
            kind: 'sect',
            id: stored.id,
            name: stored.name,
            facts: sectFacts(stored.name, stored.admissionOrdinal, memberOf === stored.id, stored.ranks),
            structure: [
                `${capitalised(stored.alignment)} on the schema\'s alignment axis. It admits from `
                + `${rungAndOrdinal(stored.admissionOrdinal)}, and the house itself is weighed `
                + `at ${rungAndOrdinal(stored.powerOrdinal)}.`,
                `${stored.ranks.length} rank${stored.ranks.length === 1 ? '' : 's'}, lowest `
                + `first: ${andList(stored.ranks)}.`
            ]
        };
    }

    const catalogued = best(query, SECTS.filter(sect => heard(sect.id)), sect => sect.name);
    if (!catalogued) return null;

    const seat = placeOrShape(scope, catalogued.territory);
    const facts = sectFacts(
        catalogued.name, catalogued.admissionOrdinal, memberOf === catalogued.id, catalogued.ranks
    );
    facts.push(
        seat === catalogued.territory
            ? `They are seated at ${seat}.`
            : 'Where they are seated is not something this cultivator could point to on any road they know.'
    );
    if (!catalogued.recruits) {
        facts.push('Nobody has ever heard of them taking anyone on.');
    }

    // Rivals are the classic leak: asking about the one sect a villager has
    // heard of should not hand back the names of the four it fights with.
    if (catalogued.rivals.length > 0) {
        const rivals = catalogued.rivals.map(id => ({
            id,
            name: SECTS.find(sect => sect.id === id)?.name ?? id
        }));
        const { named, hidden } = knownNamesOnly(scope, 'sect', rivals);
        const line = describeParties('There are parties they will not deal with', named, hidden);
        if (line) facts.push(line);
    }

    return {
        kind: 'sect',
        id: catalogued.id,
        name: catalogued.name,
        facts,
        structure: [
            `${capitalised(catalogued.alignment)} on the schema\'s alignment axis. It admits from `
            + `${rungAndOrdinal(catalogued.admissionOrdinal)}, the house itself is weighed at `
            + `${rungAndOrdinal(catalogued.powerOrdinal)}, and it `
            + `${catalogued.recruits ? 'does take people on' : 'does not take people on'}.`,
            `Seated at ${catalogued.territory.replace(/\.\s*$/, '')}. ${catalogued.ranks.length} `
            + `rank${catalogued.ranks.length === 1 ? '' : 's'}, lowest first: `
            + `${andList(catalogued.ranks)}. ${catalogued.rivals.length} `
            + `house${catalogued.rivals.length === 1 ? '' : 's'} it will not deal with. What it `
            + `is known for: ${andList(catalogued.specialities)}.`
        ]
    };
}

/**
 * A sect, as somebody outside it perceives it.
 *
 * Alignment is never stated: "righteous" and "demonic" are the schema's words,
 * and a person forms that judgement by watching what a sect does, if they ever
 * form it at all. The rank ladder is stated only to a member, because a member
 * lives inside it - to everybody else it is a set of titles overheard without
 * an explanation, which is exactly the texture tone.md asks for.
 */
function sectFacts(
    name: string,
    admissionOrdinal: number,
    isMember: boolean,
    ranks: readonly string[]
): string[] {
    const facts = [
        admissionOrdinal <= 4
            ? `${name} takes people on early enough that being taken is not something anyone boasts about.`
            : `${name} does not look at anyone who has not already got somewhere on their own.`
    ];

    facts.push(isMember
        ? `From the inside, the order runs ${ranks.join(', then ')}, and everyone knows where they sit in it.`
        : `Titles get used around them - ${ranks.slice(0, 2).join(', ')} and others - and nobody explains what they mean to anyone who is not one.`);

    return facts;
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
        `${match.name}${match.element ? `, an art of ${match.element}` : ', an art of no element'}. ${match.description}`,
        known
            ? known.mastery >= 0.99
                ? 'They have it whole. There is nothing further in it for them.'
                : `They have some of it. ${(known.mastery * 100).toFixed(0)}% of the way to holding it whole.`
            : 'They have never been taught it, and reading it would not be the same as knowing it.'
    ];
    return {
        kind: 'technique',
        id: match.id,
        name: match.name,
        facts,
        structure: [
            `${articleCapitalised(match.grade)} ${match.grade}-grade ${match.category} art`
            + `${match.element ? ` of ${match.element}` : ' of no element'}. It opens at `
            + `${rungAndOrdinal(match.requiredOrdinal)}. `
            + (known
                ? `This cultivator holds it at ${known.mastery.toFixed(2)} mastery, where 1.00 `
                  + 'is whole.'
                : 'This cultivator has never been taught it, so no mastery is recorded.')
        ]
    };
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
            `It calls for ${match.ingredients.map(i => `${i.quantity} x ${HERBS.find(h => h.id === i.itemId)?.name ?? i.itemId}`).join(', ') || 'nothing'}.`,
            match.baseSuccessRate >= 0.6
                ? 'People who work this formula mostly get a pill out of it.'
                : 'People who work this formula mostly get slag out of it.'
        ],
        structure: [
            `It works ${Math.round(match.baseSuccessRate * 100)}% of the time before anything `
            + `about the alchemist is counted, and it cannot be attempted below `
            + `${rungAndOrdinal(match.requiredOrdinal)}. What comes out of it is `
            + `${pill?.name ?? match.producesPillId}.`
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
            `${match.name}. ${match.description}`,
            `It grows where the ${match.biome} is, and it goes for about ${match.value} spirit stones to anyone buying.`
        ],
        structure: [
            `${articleCapitalised(match.grade)} ${match.grade}-grade herb of the ${match.biome}, `
            + `drawn at `
            + `weight ${match.rarityWeight} against everything else that grows there. It can be `
            + `taken from ${rungAndOrdinal(match.harvestOrdinal)} and is valued at `
            + `${match.value} spirit stones.`
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
            `${match.name}. ${match.description}`,
            `It goes for about ${match.value} spirit stones, when anyone has one to sell.`
        ],
        structure: [
            `${articleCapitalised(match.grade)} ${match.grade}-grade pill. What it does is `
            + `${match.effect.replace(/_/g, ' ')}, `
            + `at potency ${match.potency} against toxicity ${match.toxicity}. Valued at `
            + `${match.value} spirit stones.`
        ]
    };
}

/**
 * A line on the price board.
 *
 * The board is the only list in the game the player has actually been shown -
 * `market` prints it verbatim - so a name off it is the one free-text subject
 * a player can be sure they typed correctly, and it must resolve. Until this
 * existed "a visit from the mortal physician" went to the party resolver,
 * which looked for somebody standing in the square with that name and reported
 * that nobody by it was there.
 *
 * Matched against the name and against the name with its qualifying clause
 * stripped, because the board reads "Mortal physician, one visit" and nobody
 * types the comma.
 */
export function resolvePrice(query: string): ResolvedEntity | null {
    const wanted = query.trim();
    if (wanted.length < 3) return null;

    let winner: Price | null = null;
    let winning = 0;
    for (const price of PRICES) {
        const score = Math.max(
            matchScore(wanted, price.name),
            matchScore(wanted, price.name.replace(/,.*$/, '').trim())
        );
        if (score > winning) {
            winner = price;
            winning = score;
        }
    }
    if (!winner || winning < MATCH_THRESHOLD) return null;

    return {
        kind: 'price',
        id: winner.id,
        name: winner.name,
        facts: [`${winner.name}, ${winner.cash} cash the ${winner.unit}. ${winner.note}`],
        structure: [
            `${articleCapitalised(winner.category)} ${winner.category} line on the board at `
            + `${winner.cash} `
            + `cash the ${winner.unit}. That is the base figure; the region multiplier is `
            + 'applied where it is charged.'
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
        facts: [`${cleaned}, which is a name and a road and not much else that anyone here can tell you.`],
        structure: ['Places are free text in this engine; nothing about them is simulated.']
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
        resolveCultivator(repos, query, self.id, scope, self.realmOrdinal) ??
        resolveSect(repos, query, scope, self.sectId) ??
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
    // The key comparison first, and it is not a fallback. `best` scores on the
    // words, and a two-word settlement scores easily while "the sealed compound
    // at Blackbank" - typed correctly, held as a knowledge record - scored
    // below the threshold against its own name because the parser had already
    // taken the article off one side. Twenty-six of thirty-three locations in a
    // generated world are in that shape.
    const wanted = loosePlaceKey(query);
    const keyed = known.find(row =>
        loosePlaceKey(row.name) === wanted || loosePlaceKey(row.id) === wanted);
    if (keyed) return resolvePlace(keyed.name);

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
    return resolveCultivator(repos, query, self.id, scope, self.realmOrdinal)
        ?? resolveSect(repos, query, scope, self.sectId);
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
