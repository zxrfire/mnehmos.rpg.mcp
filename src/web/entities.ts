/**
 * Target resolution.
 */

import type Database from 'better-sqlite3';
import type { Cultivator } from '../schema/cultivation.js';
import { whatTheyRecogniseAboutIt } from '../engine/world/artifact-recognition.js';
import { keptAs, type ObjectRecord } from '../engine/world/possessions.js';
import type { RosterEntry } from '../storage/repos/cultivator.repo.js';
import { describePhysique, physiqueOrNull } from '../engine/cultivation/physiques.js';
import {
    A_FACE_YOU_HAVE_SOMETHING_BEHIND
} from '../engine/social/what-a-look-at-somebody-reaches.js';
import { isAtLeast } from '../engine/social/discovery.js';
import { SPIRIT_ROOTS } from '../engine/cultivation/spirit-roots.js';
import { rankName } from '../engine/cultivation/realms.js';
import { describeStanding, rungAndOrdinal } from './facts.js';
import type { ObligationDb } from '../storage/repos/obligation.repo.js';
import { whatTheWorldHoldsAbout } from './personal-record.js';
import {
    HERBS,
    PILLS,
    RECIPES,
    SECTS,
    TECHNIQUES
} from '../data/cultivation/index.js';
import { PRICES, type Price } from '../data/cultivation/mortal-world.js';
import type { CultivationRepos } from '../server/consolidated/cultivation-support.js';
import { copiesHeldBy } from '../server/consolidated/technique-manage.js';
import { loosePlaceKey, placeKey, type KnowledgeGate } from './knowledge.js';
import { awarenessOfSite, faceOf, nameableSites, resolveSite } from './trials.js';
import { getMembersOf } from '../data/cultivation/members.js';
import { getSect } from '../data/cultivation/sects.js';
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
    /**
     * A ruin, a trial or a grave, resolved to its PRE-ENTRY FACE.
     */
    | 'site'
    /**
     * A RUNG on a house's ladder, used as a way of referring to whoever holds it -
     * *the grand elder*, *the Pavilion Master*.
     */
    | 'rank'
    /**
     * A thing in the world, resolved off its own row.
     */
    | 'object'
    /** A line on the mortal price board. Not gated: the player was shown it. */
    | 'price'
    /**
     * The asker, looking at themselves. Deliberately NOT `cultivator`.
     */
    | 'self';

/**
 * Who is asking, and what they have heard of.
 */
export interface KnowledgeScope {
    gate: KnowledgeGate;
    holderId: string;
    /** Where the holder is standing. Anyone else here is perceivable. */
    here: string | null;
    /**
     * Everybody standing in the same place, from both populations.
     */
    present?: readonly RosterEntry[];
    /**
     * The world's own object rows.
     */
    objects?: readonly ObjectRecord[];
}

/**
 * The world location a free-text place name refers to.
 */
export function worldLocationFor(world: WorldState, place: string | null): LocationRecord | null {
    const wanted = (place ?? '').trim().toLowerCase();
    if (wanted.length === 0) return null;

    const exact = world.locations.find(l => l.name.trim().toLowerCase() === wanted);
    if (exact) return exact;

    // "the Jade Gorge" against "Green Water City", and the id form for anything
    // that reached us already keyed.
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
     */
    party?: {
        realmOrdinal: number;
        factionId: string | null;
        /** True when they hold a rank inside that house, not merely a badge. */
        ranked: boolean;
        charm?: number;
    };
}

// THE STRUCTURE CHANNEL, IN WORDS

/**
 * The display name for a spirit-root key, falling back to the key.
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
 */
export function matchScore(query: string, candidate: string): number {
    const q = normalise(query);
    const c = normalise(candidate);
    if (q.length === 0 || c.length === 0) return 0;
    if (q === c) return 100;

    // ONE WORD IS NOT A NAME
    const oneWordAgainstAName = !q.includes(' ') && c.includes(' ');
    if (!oneWordAgainstAName || carriesHalfTheName(q, c)) {
        if (c.startsWith(q) || q.startsWith(c)) return 80;
    // Containment needs the shorter side to be distinctive, or a two-letter
    // fragment buried in the middle of a word wins outright at 60 - above
    // MATCH_THRESHOLD. Played: after buying the Lesser Qi-Gathering Manual, `I
    // learn it` resolved to Bitter Frost Needle, because "it" is inside "B-it-ter",
    // and answered about a rung-8 art the cultivator had never heard of. `I learn
    // the manual` was correct all along.
        if (Math.min(q.length, c.length) > 2 && (c.includes(q) || q.includes(c))) return 60;
    }

    const qWords = new Set(q.split(' ').filter(w => w.length > 2));
    const cWords = c.split(' ').filter(w => w.length > 2);
    const shared = cWords.filter(w => qWords.has(w)).length;
    if (shared === 0) return 0;
    return 20 + shared * 10;
}

/**
 * Whether one word accounts for half of what a name is made of.
 */
function carriesHalfTheName(q: string, c: string): boolean {
    const words = c.split(' ').filter(w => w.length > 2);
    if (words.length === 0) return true;
    return words.filter(w => w === q).length * 2 >= words.length;
}

/** Lowest score that counts as a match. Below this the target is unresolved. */
export const MATCH_THRESHOLD = 55;

/**
 * The ways somebody refers to their own house without naming it.
 */
export const MY_OWN_HOUSE =
    /^(?:my|our)\s+(?:own\s+)?(?:sect|house|order|school|clan|hall|pavilion|court)$/i;

/**
 * Words that stand in for a thing rather than naming one.
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

/**
 * The one thing they are carrying that answers to the word, or nothing.
 */
function theOneTheyHold<T>(query: string, items: readonly T[], nameOf: (item: T) => string): T | null {
    if (STANDS_IN_FOR_A_THING.test(query.trim())) return null;
    const hits = items.filter(item => matchScore(query, nameOf(item)) > 0);
    return hits.length === 1 ? hits[0]! : null;
}

// REDACTION

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

/**
 * One line saying what somebody's own record makes them, and who can use it.
 */
function whatTheirRecordSays(
    repos: CultivationRepos,
    match: RosterEntry,
    candidates: readonly RosterEntry[]
): string {
    const byId = new Map(candidates.map(row => [row.id, row]));
    const read = whatTheWorldHoldsAbout({
        db: repos.db as unknown as ObligationDb,
        person: {
            id: match.id,
            ordinal: match.realmOrdinal,
            backing: match.sectId === null
                ? 'none'
                : match.sectRank
                    ? 'backed'
                    : 'unclaimable'
        },
        lookUpHolder: id => {
            const row = byId.get(id);
            return row
                ? { id: row.id, name: row.name, ordinal: row.realmOrdinal, houseId: row.sectId ?? null }
                : null;
        }
    });
    return `Their own record reads ${read.is.alignment}. ${read.line}`;
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

    // WHAT THEIR BODY IS, AND THE ONE THING THAT GATES IT
    const theirPhysique = physiqueOrNull(match.physique);
    if (theirPhysique) {
        const met = !scope || isAtLeast(
            scope.gate.stageOf(scope.holderId, 'cultivator', match.id),
            A_FACE_YOU_HAVE_SOMETHING_BEHIND
        );
        facts.push(
            met
                ? `${match.name} is ${theirPhysique.tell}. It is a ${theirPhysique.name}, and `
                  + 'there are people who would cross a province for one.'
                : `Whatever ${match.name}'s body is, it is not something anybody has learned `
                  + 'at second hand. It would take standing in front of them.'
        );
    }

    if (match.untreatedInjuries > 0) {
        // "1 injuries are open", found in play. A count printed against a fixed
        // plural is the engine reading its own column out loud, and this is a
        // line about how somebody is standing.
        facts.push(
            'Something is wrong with the way they hold themselves. '
            + (match.untreatedInjuries === 1
                ? 'One wound is open.'
                : `${match.untreatedInjuries} wounds are open.`)
        );
    }

    // what the name is worth
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
            + `. ${rootName(match.spiritRoot)}. `
            + (theirPhysique ? `${theirPhysique.name}. ` : '')
            + `${match.spiritStones} spirit stones and `
            + `${match.untreatedInjuries} untreated `
            + `injur${match.untreatedInjuries === 1 ? 'y' : 'ies'}. Last recorded at `
            + `${match.location ?? 'nowhere the row states'}.`,
            // WHAT THEIR OWN RECORD MAKES THEM
            whatTheirRecordSays(repos, match, candidates)
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

    // "my sect"
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

/**
 * WHAT THEY ARE HOLDING BEATS WHAT IS IN THE BOOK.
 */
export function resolveTechnique(
    repos: CultivationRepos,
    query: string,
    cultivatorId: string
): ResolvedEntity | null {
    const heldIds = new Set([
        ...copiesHeldBy(repos.db, cultivatorId),
        ...TECHNIQUES.filter(t => repos.techniques.getKnown(cultivatorId, t.id)).map(t => t.id)
    ]);
    const held = TECHNIQUES.filter(technique => heldIds.has(technique.id));

    const match = theOneTheyHold(query, held, technique => technique.name)
        ?? best(query, TECHNIQUES, technique => technique.name);
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
 * A thing somebody is holding, or a thing with a name. ── THE ROW, NEVER THE
 * CATALOG ───────────────────────────────────────────
 */
export function resolveObject(
    query: string,
    self: Cultivator,
    scope?: KnowledgeScope
): ResolvedEntity | null {
    const wanted = query.trim();
    if (wanted.length < 3 || !scope?.objects || scope.objects.length === 0) return null;

    const named = best(wanted, scope.objects, object => object.name);
    // By the person holding it. Their best rated thing, which is the one a
    // sentence about "the sword in his hand" is about - and the same ordering
    // `bestObjectHeldBy` arms somebody with, because there is one answer to
    // which of two things somebody is holding up.
    const byHolder = named ? null : (() => {
        const who = best(wanted, scope.present ?? [], row => row.name);
        if (!who) return null;
        return scope.objects!
            .filter(object => object.possessorId === who.id && object.power !== null)
            .reduce<ObjectRecord | null>(
                (bestSoFar, object) =>
                    bestSoFar === null || (object.power ?? 0) > (bestSoFar.power ?? 0)
                        ? object
                        : bestSoFar,
                null
            );
    })();

    const thing = named ?? byHolder;
    if (!thing) return null;

    const read = whatTheyRecogniseAboutIt(thing, {
        id: self.id,
        factionId: self.sectId ?? null,
        realmOrdinal: self.realmOrdinal,
        referenceFor: (factionId: string) =>
            scope.gate.stageOf(scope.holderId, 'sect', factionId)
    });

    return {
        kind: 'object',
        id: thing.id,
        // THE NAME IS PART OF THE ANSWER, NOT A LABEL ON IT
        name: read.reading === 'nothing' && !read.nothingToRecognise
            ? 'Something you cannot place'
            : thing.name,
        facts: whatTheySeeLookingAtIt(thing, read),
        structure: [
            `${thing.name} (${thing.id}), ${keptAs(thing.significance)}, `
            + `rated ${thing.power ?? 'nothing in a fight'}. Holder `
            + `${thing.possessorId ?? 'nobody'}; owner ${thing.ownerId ?? 'nobody'}. Those are two `
            + 'facts and the row keeps them apart.',
            `Realm afforded ${read.fromRealm}; reference afforded ${read.fromReference} at stage `
            + `${read.reference}. Identification is the lower of the two, ${read.reading}. The gap `
            + `itself: ${read.outOfTheirDepth.account}`
        ]
    };
}

/**
 * What a reader actually comes away with, graded.
 */
function whatTheySeeLookingAtIt(
    thing: ObjectRecord,
    read: ReturnType<typeof whatTheyRecogniseAboutIt>
): string[] {
    // A kind, not a thing. Several hundred exist and there is nothing to know.
    // The name is not repeated in any of these. The caller prints
    // `ResolvedEntity.name` ahead of the facts, and saying it again gave
    // *"The Standing Edge. The Standing Edge. It settles who somebody is..."*
    // in play - the same fact twice, which is what a dump reads like.
    if (read.nothingToRecognise) {
        return [
            thing.description,
            'One of a great many, and nothing about this one says otherwise.'
        ];
    }

    const gone = thing.tags.includes('ruined')
        ? ['What is left of it is a record. The thing itself did not survive what was done with it.']
        : [];

    if (read.reading === 'nothing') {
        // The correction the design owner made to the realm axis: being unable
        // to read a thing is itself a reading, and at this end it is the only
        // one that matters.
        if (read.outOfTheirDepth.beyondThem) {
            return [
                'It is beyond you, and there is nothing uncertain about that. You could not say '
                + 'what it is, whose it is, or what it has done. You can say that it would end '
                + 'you, and you would not be guessing.',
                ...gone
            ];
        }
        return [
            'You can see what it is made of and how it is held, and nothing about it tells you '
            + 'whose it was or what it has been used for.',
            ...gone
        ];
    }

    const lines = [thing.description];
    if (read.ownerName) {
        lines.push(
            read.inTheWrongHands
                ? `It is ${read.ownerName}'s, and the person holding it is not them.`
                : `It is ${read.ownerName}'s, and it is where it belongs.`
        );
    }
    if (read.outOfTheirDepth.beyondThem) {
        lines.push('And it is well past anything you could stand in front of.');
    }
    return [...lines, ...gone];
}

/**
 * A line on the price board.
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
 */
/**
 * The one subject in the world that never needed resolving, and did not resolve.
 */
function resolveTheAskerThemselves(
    query: string,
    self: Cultivator
): ResolvedEntity | null {
    const text = query.trim().toLowerCase().replace(/^(?:at|on|over)\s+/, '');
    if (!SELF_AS_A_SUBJECT.test(text)) return null;

    const untreated = self.injuries.filter(injury => !injury.treated).length;
    const facts = [
        `${rankName(self.realmOrdinal)}, ${Math.floor(self.age)} years old, standing in `
        + `${self.location ?? 'nowhere anybody has a name for'}.`,
        `The root is ${rootName(self.spiritRoot)}. Might ${self.attributes.might}, `
        + `Insight ${self.attributes.insight}, Fortune ${self.attributes.fortune}, `
        + `Charm ${self.attributes.charm}.`,
        self.hp >= self.maxHp
            ? `Unmarked, ${self.maxHp} of ${self.maxHp} in the body.`
            : `${self.hp} of ${self.maxHp} left in the body.`,
        untreated === 0
            ? 'The meridians are whole.'
            : untreated === 1
                ? 'One channel is open and has not closed. It does not close on its own.'
                : `${untreated} channels are open and none of them has closed. They do not `
                  + 'close on their own.',
        `${self.spiritStones} spirit stone${self.spiritStones === 1 ? '' : 's'} in the purse`
        + `${self.satiety >= 100 ? ', and no hunger to speak of' : `, and the belly at ${self.satiety} of 100`}.`,
        // The two facts a player is most often looking for when they look at
        // themselves at all, and the two the sheet is quietest about.
        self.knownTechniques.length === 0
            ? 'No method is being practised, which is why nothing has been accumulating.'
            : `Practising ${self.knownTechniques.length} `
              + `method${self.knownTechniques.length === 1 ? '' : 's'}.`,
        self.sectId === null
            ? 'On no house\'s roll. Nothing is owed and nothing is asked.'
            : `On a roll${self.sectRank ? `, addressed as ${self.sectRank}` : ', at no rank in it'}.`
    ];

    // AND WHAT THIS BODY IS, WHICH THEY HAVE ALWAYS KNOWN
    const ownPhysique = physiqueOrNull(self.physique);
    if (ownPhysique) {
        facts.push(
            `${describePhysique(ownPhysique)} They have known since they were small, and so `
            + 'has everybody who ever touched them.'
        );
    }

    return {
        kind: 'self',
        id: self.id,
        name: self.name,
        facts,
        structure: [
            `The asker's own sheet: ${rungAndOrdinal(self.realmOrdinal)}, `
            + `${self.cultivationProgress} qi-units accumulated, foundation `
            + `${self.foundationQuality}, ${untreated} untreated of ${self.injuries.length} `
            + `injur${self.injuries.length === 1 ? 'y' : 'ies'} on record.`
        ]
    };
}

/**
 * Ways of saying "me".
 */
const SELF_AS_A_SUBJECT = new RegExp(
    '^(?:the\\s+)?(?:'
    + 'me|myself|my\\s*self|self'

    // -- AND THE DEICTIC, WHICH IS HOW SOMEBODY POINTS AT THEMSELVES ------
    + '|(?:my|this|these)\\s+(?:'
        + 'body|condition|state|health|standing|situation|sheet'
        + '|injur(?:y|ies)|wound|wounds|meridian|meridians|channels?'
        + '|cultivation|progress|realm|rank|rung|level'
        + '|spirit\\s*root|root|foundation|dantian'
        + '|qi|attributes|stats'
    + ')'
    + ')$'
);

export function resolveAnything(
    repos: CultivationRepos,
    query: string,
    self: Cultivator,
    scope?: KnowledgeScope
): ResolvedEntity | null {
    return (
        // First, and it can only ever win on a sentence that is about the
        // asker: `SELF_AS_A_SUBJECT` is anchored at both ends and every branch
        // is a possessive or a reflexive, so no name in any catalog reaches it.
        // Ahead of the roster rather than behind it because a cultivator called
        // "Self" is not a reason for a player to be unable to look at their own
        // hands.
        resolveTheAskerThemselves(query, self) ??
        resolveCultivator(repos, query, self.id, scope, self.realmOrdinal) ??
        // After a person's own name, so somebody actually called Abbot is
        // still themselves, and before the house, so a rung whose title
        // echoes a house name is read as the rung the asker serves under.
        resolveRankOnALadder(query, self, scope) ??
        resolveSect(repos, query, scope, self.sectId) ??
        // AHEAD OF THE ORDINARY PLACE, and that ordering is the fix rather than a
        // preference. Measured: `tell me about The Tended Tomb` with this branch
        // behind `resolveKnownPlace` came back *"The Tended Tomb, which is a name
        // and a road and not much else that anyone here can tell you"* - the
        // generic place fallback, about a grave whose marker the engine can read
        // out in full.
        resolveNameableSite(query, scope) ??
        resolveKnownPlace(query, self, scope) ??
        resolveTechnique(repos, query, self.id) ??
        // After the person, so a bare name is still a person, and after the
        // art, so a house's signature is still an art. Before the consumable
        // catalogs, because a thing standing in front of somebody is a better
        // answer than a pill with a similar name that is nowhere near them.
        resolveObject(query, self, scope) ??
        resolveRecipe(query) ??
        resolvePill(query) ??
        resolveHerb(query)
    );
}

/**
 * A rung on the asker's own house's ladder, and whoever stands on it.
 */
export function resolveRankOnALadder(
    query: string,
    self: Cultivator,
    scope?: KnowledgeScope
): ResolvedEntity | null {
    const house = self.sectId;
    if (!house || !scope) return null;
    const sect = getSect(house);
    if (!sect || sect.ranks.length === 0) return null;

    // "the grand elder here" is the rung plus two words that mean nothing to a
    // ladder. Stripped rather than matched around, because a rank title is a
    // short phrase and the noise is longer than the signal.
    const wanted = query
        .trim()
        .replace(/^(?:the|a|an)\s+/i, '')
        .replace(/\s+(?:here|of\s+(?:my|our|the)\s+(?:sect|house|order))\s*$/i, '')
        .trim();
    if (wanted.length < 3) return null;

    // ---- THE PLAYER SAYS THE SHORT FORM, AND THE LADDER SAYS THE LONG ----
    const said = wanted.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    const singular = (word: string) => word.replace(/s$/, '');

    let rankIndex = -1;
    let winning = 0;
    sect.ranks.forEach((title, index) => {
        const words = title.toLowerCase().split(/\s+/);
        const containsAll = said.every(
            word => words.some(other => singular(other) === singular(word))
        );
        const score = matchScore(wanted, title);
        // A containment match still has to beat the others on score, so the
        // longest title never wins by merely being long enough to contain the
        // query.
        const reaches = score >= MATCH_THRESHOLD || containsAll;
        if (reaches && score > winning) {
            winning = score;
            rankIndex = index;
        }
    });
    if (rankIndex < 0) return null;

    const title = sect.ranks[rankIndex]!;
    const holders = getMembersOf(house).filter(member => member.rankIndex === rankIndex);

    // ---- WHO OF THEM THIS ASKER MAY BE TOLD ABOUT ------------------------
    const nameable = holders.filter(
        member => scope.gate.isAwareOf(scope.holderId, 'cultivator', member.id)
    );

    const unnamed = holders.length - nameable.length;
    // No article anywhere in these, deliberately. "There is a Inner Disciple"
    // was what composing one produced, and a rank title can be singular, plural,
    // vowel-initial or a bare office - so the sentence is built to not need one
    // rather than to get four cases right.
    const facts = holders.length === 0
        ? [`${sect.name} has the rank of ${title}, and nobody standing at it.`]
        : nameable.length === 0
            ? [
                `Somebody at ${sect.name} holds the rank of ${title}. You could not say `
                + 'which of them it is.'
            ]
            : [
                nameable.length === 1
                    ? `${nameable[0]!.name} is ${title} of ${sect.name}.`
                    : `${nameable.map(m => m.name).join(', ')} hold the rank of ${title} at `
                      + `${sect.name}.`
            ];
    if (unnamed > 0 && nameable.length > 0) {
        facts.push(
            `${unnamed} other${unnamed === 1 ? '' : 's'} stand at that rank whom you could `
            + 'not name.'
        );
    }

    return {
        kind: 'rank',
        // The rung, not the person: this is not a cultivator id, so nothing
        // downstream can mistake it for a resolved person and act on somebody
        // the asker cannot name.
        id: `${house}#rank-${rankIndex}`,
        name: title,
        facts,
        structure: [
            `rank read: "${wanted}" matched ${title} (index ${rankIndex} of `
            + `${sect.ranks.length}) on ${sect.name}'s own ladder, scoring ${winning}. `
            + `${holders.length} holder(s), ${nameable.length} nameable by this cultivator.`,
            'Resolving the rung is not naming the holder. The office is what the sentence '
            + 'named; who stands on it is gated on the knowledge row and the presence gate.'
        ]
    };
}

/**
 * A ruin, a trial or a grave the holder could put a name to.
 */
export function resolveNameableSite(
    query: string,
    scope?: KnowledgeScope
): ResolvedEntity | null {
    const wanted = query.trim();
    if (wanted.length < 3 || !scope) return null;

    const permitted = nameableSites(
        siteId => scope.gate.isAwareOf(scope.holderId, 'place', siteId)
    );
    const site = resolveSite(wanted, permitted);
    if (!site) return null;

    const view = faceOf(site, awarenessOfSite(
        site, scope.gate.isAwareOf(scope.holderId, 'place', site.id)
    ));
    // `nameableSites` has already required a nameable awareness, so a view that
    // does not come back is a catalog that changed under us rather than a
    // reading. Answering null is right either way: nothing to say is nothing.
    if (!view) return null;

    const facts = [view.outside.marker];
    if (view.outside.rumour) facts.push(view.outside.rumour);
    if (view.outside.attributedTo) facts.push(`It is put down to ${view.outside.attributedTo}.`);
    facts.push(
        'That is what it looks like from outside. Going in is a different sentence.'
    );

    return {
        kind: 'site',
        id: site.id,
        name: view.name ?? (site.kind === 'grave' ? 'A grave nobody has attributed' : 'An unattributed site'),
        facts,
        structure: [
            `${site.id}: a ${site.kind}, ${site.character} at ${site.scale}, origin ${site.origin}. `
            + `Resolved through nameableSites and resolveSite - the same gate and the same matcher `
            + `\`site\` uses, so the two cannot disagree about what exists.`,
            'Pre-entry face only. `faceOf` returns a type with no interior key.'
        ]
    };
}

/**
 * A place the holder has actually heard of, or the one they are standing in.
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

    // AND THE GROUND, WHICH THIS COULD NEVER MENTION
    const sites = scope
        ? nameableSites(id => scope.gate.isAwareOf(scope.holderId, 'place', id))
            .map(site => site.name)
        : [];

    // ROUND-ROBIN ACROSS THE THREE GROUPS rather than in order.
    // Concatenated, people fill the whole allowance every time and the ground
    // is never reached - which is the defect above with an extra step in it.
    const groups = [colocated, heardOf, sites];
    const seen = new Set<string>();
    const out: string[] = [];
    for (let i = 0; out.length < limit; i++) {
        let tookAny = false;
        for (const group of groups) {
            if (i >= group.length) continue;
            tookAny = true;
            const name = group[i];
            if (seen.has(name)) continue;
            seen.add(name);
            out.push(name);
            if (out.length >= limit) break;
        }
        if (!tookAny) break;
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
