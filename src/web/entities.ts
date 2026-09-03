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
import { whatTheyRecogniseAboutIt } from '../engine/world/artifact-recognition.js';
import { keptAs, type ObjectRecord } from '../engine/world/possessions.js';
import type { RosterEntry } from '../storage/repos/cultivator.repo.js';
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
     *
     * Distinct from `place` because a site is not somewhere anybody lives
     * and, today, is not anywhere at all - the catalog carries no locational
     * field on either half of `SiteSchema`. See `resolveNameableSite`.
     */
    | 'site'
    /**
     * A RUNG on a house's ladder, used as a way of referring to whoever
     * holds it - *the grand elder*, *the Pavilion Master*.
     *
     * Not `cultivator`, deliberately. The subject of the sentence is the
     * office, and resolving the office must not hand over the person: the
     * asker may be entitled to know the rung exists and entitled to nothing
     * about whoever stands on it. See `resolveRankOnALadder`.
     */
    | 'rank'
    /**
     * A thing in the world, resolved off its own row.
     *
     * Not gated, for the reason `resolveObject` gives at length: the player
     * receives the reading their rung and their reference support, never the
     * catalog entry, so naming a thing hands nobody an answer key.
     */
    | 'object'
    /** A line on the mortal price board. Not gated: the player was shown it. */
    | 'price'
    /**
     * The asker, looking at themselves. Deliberately NOT `cultivator`.
     *
     * A caller that sees `cultivator` writes a knowledge record for the subject
     * and reads the trust ladder against it, and both are nonsense pointed at
     * the person doing the looking: it would put the player in their own list
     * of people they have heard of. A kind nothing switches on gets the facts
     * narrated and none of that.
     */
    | 'self';

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
    /**
     * The world's own object rows.
     *
     * Supplied rather than looked up, for the same reason `present` is: the
     * world is loaded once per action and not once per lookup. An empty list
     * means the world holds nothing here; an absent one means nobody asked, and
     * `resolveObject` answers null to both rather than reaching for the catalog
     * - see the note there on why a catalog answer would be a lie.
     */
    objects?: readonly ObjectRecord[];
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

    // ── ONE WORD IS NOT A NAME ───────────────────────────────────────────
    //
    // FOUND BY PLAYING, and it is the same defect the two-letter rule below
    // was written for, one size up. Reproduced against a live world:
    //
    //   "origin"     -> Chaos Origin Scripture              60, matched
    //   "name"       -> Nameless Witness Stance             80, matched
    //   "manual"     -> Lesser Qi-Gathering Manual          60, matched
    //   "court"      -> Storm Tyrant Court                  60, matched
    //   "scripture"  -> Five-Breath Circulation Scripture   60, matched
    //
    // What that cost in play: `I ask the tortoise where it came from` had its
    // topic reduced to the word "origin", which resolved to an art nobody had
    // mentioned, and the asking gate then correctly refused - so the player was
    // told that this person had never heard of the Chaos Origin Scripture. Two
    // turns spent, nothing learned, and a beautifully written wrong answer,
    // because the model in front of it made the nonsense convincing.
    //
    // A single common word carried in a long catalog name is not evidence the
    // player meant that row; it is evidence the catalog is large. So a one-word
    // query wins on a longer name only when it supplies HALF that name's own
    // significant words - which is what makes "wheatgate" reach Wheatgate
    // Market and "lanshi" reach Ning Lanshi, while leaving "storm" and
    // "manual" unresolved, as they should be. A multi-word query is unchanged.
    //
    // Below the bar it does not score zero; it falls through to the word
    // overlap, which is the honest reading of one word in common.
    const oneWordAgainstAName = !q.includes(' ') && c.includes(' ');
    if (!oneWordAgainstAName || carriesHalfTheName(q, c)) {
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
    }

    const qWords = new Set(q.split(' ').filter(w => w.length > 2));
    const cWords = c.split(' ').filter(w => w.length > 2);
    const shared = cWords.filter(w => qWords.has(w)).length;
    if (shared === 0) return 0;
    return 20 + shared * 10;
}

/**
 * Whether one word accounts for half of what a name is made of.
 *
 * The name's own significant words are the denominator, not its characters: a
 * character ratio reads "nine peaks" against the Nine Peaks Ascetic Order as
 * 42% and refuses a fragment the game itself prints, while reading "origin"
 * against the Chaos Origin Scripture as 30% and refusing it for the right
 * reason. Words are what a person types and words are what a name is.
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

/**
 * The one thing they are carrying that answers to the word, or nothing.
 *
 * ── WHY THIS IS NOT `best` WITH A LOWER BAR ──────────────────────────────
 *
 * `matchScore`'s one-word rule - a bare word wins on a longer name only when it
 * supplies half that name's own significant words - exists because a common
 * word carried in a long catalog name is evidence the CATALOG IS LARGE rather
 * than evidence the player meant that row. It is right, and it is the reason
 * "manual" no longer reaches a book nobody mentioned.
 *
 * Over what somebody is carrying, that reasoning inverts. A pouch holds one or
 * two things; there is no largeness for a common word to be evidence of, and a
 * player who says "the manual" while holding exactly one manual has named it as
 * precisely as anybody can. So a shared significant word is enough here.
 *
 * The safety property is UNIQUENESS rather than a score. If two things they are
 * carrying answer to the word, this returns nothing and the caller refuses -
 * because "which one" is a question the player can answer and a guess is not.
 * That is the same rule `nearestVocabularyWord` follows for a tie, for the same
 * reason: an ambiguity's honest answer is the refusal, not a coin toss.
 */
function theOneTheyHold<T>(query: string, items: readonly T[], nameOf: (item: T) => string): T | null {
    if (STANDS_IN_FOR_A_THING.test(query.trim())) return null;
    const hits = items.filter(item => matchScore(query, nameOf(item)) > 0);
    return hits.length === 1 ? hits[0]! : null;
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

/**
 * One line saying what somebody's own record makes them, and who can use it.
 *
 * The live read of `personal-record.ts`, and it runs for ANYBODY the resolver
 * finds - the player, an NPC in a square, a name off the roster - because the
 * question and the rows are the same for all of them. A world in which only the
 * player has a reputation is a world in which nobody else has done anything.
 *
 * `backing` is read off the roll rather than supplied: `Backing`'s own three
 * values are somebody nobody answers for, somebody on a roll their house would
 * not put its weight behind, and somebody a house would have to be dealt with
 * over - which is a rank on a roll, no rank on a roll, and no roll.
 *
 * Holders are placed from the same candidate list the resolver already built,
 * so a holder this reader cannot place is left out rather than invented.
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
            + `${match.location ?? 'nowhere the row states'}.`,
            // ── WHAT THEIR OWN RECORD MAKES THEM ─────────────────────────
            //
            // Righteous, neutral or demonic off the obligation ledger rather
            // than off whose roll they are on, and who among the people
            // holding something is in a position to use it. Derived on every
            // read, because what somebody IS changes every time they do
            // something and a stored word would be stale the moment after it
            // was written - `engine/social-leverage/personal-alignment.ts`.
            //
            // On the MECHANICAL channel and not in `facts`, on this file's own
            // precedent two entries up: the inspector states what the prose
            // gate withholds. Who is coming for somebody is exactly the kind
            // of thing a stranger does not learn by looking at them.
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

/**
 * WHAT THEY ARE HOLDING BEATS WHAT IS IN THE BOOK.
 *
 * ── THE TURN THIS WAS FOUND ON ───────────────────────────────────────────
 *
 * A player at Qi Condensation Layer 1 had one thing in the world: the Lesser
 * Qi-Gathering Manual, bought two turns earlier, the only book they held. They
 * typed *"I open the manual and start learning it"*. The ruling:
 *
 *   Azure Dew Gathering Canon: refused.
 *   The engine declined, and the reason it filed is no copy of this book.
 *
 * "the manual" reached a book they had never seen, off a catalog of hundreds,
 * while the one in their hands was never considered - and the refusal was then
 * perfectly reasoned about the wrong object: *"There is no such book to be
 * found on any stall in the market; it is a thing kept in private houses."*
 * Naming it exactly worked. So the only way through was to know and type the
 * catalog title of the object in their own pouch, which is the
 * you-must-know-a-string failure `AGENTS.md` rules out, sitting on the single
 * most load-bearing turn in the game: the whole opening is one blocker, and it
 * is *"a book, or somebody willing to teach them one"*.
 *
 * ── THE ORDER, AND WHY IT IS AN ORDER RATHER THAN A BETTER MATCHER ───────
 *
 * A matcher will always find something plausible in a catalog of hundreds, and
 * plausible is exactly how a book nobody had seen beat the copy in the pouch.
 * What fixes it is precedence, not scoring:
 *
 *   1. what the player HOLDS
 *   2. what is standing in front of them
 *   3. the catalog
 *
 * A bare noun - "the manual", "the sword", "the pill" - means the thing in
 * their own hands every time, and the catalog is where you go only when nothing
 * they hold answers to the word. This function implements 1 and 3; 2 has no
 * meaning for a book. The general form belongs to one resolver every verb goes
 * through - `learn the manual`, `read the manual`, `sell the manual` and `give
 * him the manual` all have the same right answer - and it is written up in
 * `AGENTS.md` under "The parser names the act. The engine is the one that says
 * no". This is the demonstrated case, fixed where it was demonstrated.
 *
 * The held set is not a second catalog: `copiesHeldBy` returns technique ids,
 * and they are looked up in `TECHNIQUES` like everything else. What changes is
 * which rows are searched first.
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
 * A thing somebody is holding, or a thing with a name.
 *
 * ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────
 *
 * `resolveAnything` walked self, cultivator, sect, place, technique, recipe,
 * pill, herb - and OBJECTS WERE NOT IN IT AT ALL, so `I examine the Unearned
 * Step`, `I look at the sword in his hand` and `I examine my sword` all reached
 * the generic refusal. Every ingredient of the answer existed; nothing asked.
 *
 * ── THE ROW, NEVER THE CATALOG ───────────────────────────────────────────
 *
 * Resolved out of `scope.objects`, which is the world's own table, and never
 * out of `artifacts.ts`. Two different reasons and both matter: `possessorId`
 * and `ownerId` are separate facts that only a row carries, and a catalog
 * lookup would describe a thing that is not anywhere - silently confirming an
 * artifact exists in a world where it may have been destroyed, or was never
 * placed. A ruined row still resolves, because being able to find out that the
 * thing is gone is the whole of why the row is kept.
 *
 * ── UNGATED, AND THE GRADING DOES THE WORK A GATE WOULD DO BADLY ─────────
 *
 * Naming any object is allowed, exactly as naming any technique or pill is. It
 * hands nobody the answer key, because THE PLAYER DOES NOT RECEIVE THE CATALOG
 * ENTRY - they receive the reading their own rung and their own reference
 * support, out of `artifact-recognition.ts`. A carter naming the Standing Edge
 * gets a carter's answer. The design owner's ruling, in one line:
 *
 *   *"if you inspect a counted but untracked artifact you get a generic
 *   description. ownership of this IS tracked. a tracked one, and you are aware
 *   of what it is, you get a damn good one. all dependent on your own
 *   cultivation and awareness, ofc."*
 *
 * ── AND `possessorId` IS HOW "THE SWORD IN HIS HAND" RESOLVES ────────────
 *
 * That phrasing names a thing THROUGH the person holding it, which is a lookup
 * by possessor rather than by name and is what a player actually types. It runs
 * second, so a bare person's name is still a person: `resolveCultivator` is
 * ahead of this in `resolveAnything` and takes them first.
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
        // ── THE NAME IS PART OF THE ANSWER, NOT A LABEL ON IT ────────────
        //
        // Callers print this, so handing back the catalog name for a thing the
        // reader cannot place would give away the entry the grading exists to
        // withhold - and it reads as a contradiction on the page: *"The
        // Standing Edge. You could not say what it is."* Played, that is
        // exactly what came out.
        //
        // `id` is untouched, so an inspector, a log line and any caller that
        // needs to find the row again still can. What is withheld is only what
        // the player is told.
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
 *
 * Four answers and they are not degrees of one thing. The counted one and the
 * out-of-your-depth one in particular are real readings rather than softer
 * versions of the good one - see `artifact-recognition.ts` on why the two axes
 * do not fail the same way.
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
/**
 * The one subject in the world that never needed resolving, and did not resolve.
 *
 * ── WHAT IT COST ────────────────────────────────────────────────────────
 *
 * Fifteen examine sentences typed on a fresh run, deterministic reader, no
 * model. Ten of them came back with the same sentence:
 *
 *   > I examine myself
 *   > I examine my injuries
 *   > I examine my meridians
 *   > I examine my body
 *   > I examine my spirit root
 *   > I examine my foundation
 *   > I examine my cultivation
 *       "You go over Millrun looking for it and it is not the kind of place
 *        that has one. Either it is somewhere else, or it is nowhere, and
 *        standing here turning it over is not going to settle which."
 *
 * The engine held every one of those facts and printed them, in full and
 * well, one sentence earlier for "who am I". What it could not do was find
 * the person asking, because `resolveAnything` searches the roster with the
 * asker excluded by id, then the houses, then the map, then three catalogs,
 * and the asker is in none of them.
 *
 * Two rules broken at once, and the second is the worse. The refusal names no
 * route - it does not even repeat the words that failed - and it says the
 * place does not have one, about a body that is standing in it. A player
 * reading that learns that the game cannot see them.
 *
 * ── WHY THE WHOLE STANDING RATHER THAN THE PART ASKED FOR ────────────────
 *
 * "my injuries", "my spirit root" and "my foundation" are three questions and
 * this returns one answer to all three, which is deliberate: slicing the sheet
 * by which noun was typed means a player who says "my qi" and gets a line
 * about qi cannot tell whether the rest exists. The sheet is short, it is
 * theirs, and a person taking stock of themselves takes stock of all of it.
 * What is withheld here is what is withheld everywhere - the rule behind each
 * number - and that is `structure`'s business, not this function's.
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
 *
 * A possessive plus almost any noun off the sheet is the asker talking about
 * themselves, and the list of nouns is short because the sheet is short. Bare
 * "my sword" and "my pack" are deliberately absent: those are objects, they may
 * one day resolve to objects, and answering them with a standing read would be
 * the deflection this codebase keeps finding - a good answer to a question
 * nobody asked, which is worse than a refusal because it reads like an answer.
 */
const SELF_AS_A_SUBJECT = new RegExp(
    '^(?:the\\s+)?(?:'
    + 'me|myself|my\\s*self|self'

    // -- AND THE DEICTIC, WHICH IS HOW SOMEBODY POINTS AT THEMSELVES ------
    //
    // FOUND BY PLAYING, wounded, 25 of 50, with `I see a physician` in the
    // live strip at that moment:
    //
    //   I need someone to look at this wound
    //   -> "You go over Ninewatch, searching for the place the name implies,
    //      but nothing here answers to it."
    //
    // It looked for a town called "this wound". The engine was holding that
    // wound - the grade, the untreated status, the 25 of 50, and that a month
    // under a physician closes it - and the resolver read the phrase as a
    // proper noun to look up in the gazetteer.
    //
    // The pattern already had `wound`. It required the POSSESSIVE, so `my
    // wound` answered with the body read and `this wound` fell through to
    // the place refusal. Measured on one run, two lines apart.
    //
    // `this` and `these` only. A person can point at their own body and at
    // nobody else's, which is what makes the deixis safe here - `that wound`
    // and `the wound` are things you say about somebody else, and they stay
    // exactly where they are.
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
        // AHEAD OF THE ORDINARY PLACE, and that ordering is the fix rather
        // than a preference. Measured: `tell me about The Tended Tomb` with
        // this branch behind `resolveKnownPlace` came back *"The Tended Tomb,
        // which is a name and a road and not much else that anyone here can
        // tell you"* - the generic place fallback, about a grave whose marker
        // the engine can read out in full.
        //
        // It steals nothing, because `nameableSites` can only ever return the
        // authored sites: no settlement, province or road is in that set, so a
        // place keeps its own name in every case where it has one. What this
        // wins is exactly the names where a site is the more specific answer.
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
 *
 * -- THE DEFECT THIS EXISTS FOR -------------------------------------------
 *
 * Played as a Sword Elder of the Azure Cloud Pavilion, one turn after the house
 * gained a `Grand Sword Elder` rung:
 *
 *   who is the grand elder here?
 *   Nothing here answers to it.
 *   Unresolved subject "grand elder here": no knowledge record and nothing
 *   co-located.
 *
 * **The parser took a rank as a name** and went looking for a person called
 * "grand elder here".
 *
 * -- AND THE TOLD-THE-STRUCTURE GRANT IS WHAT MAKES IT WRONG ---------------
 *
 * `what-joining-tells-you.ts` landed the rule that being enrolled tells you the
 * ladder - the shape of the house and who is on the rungs that matter. So a
 * member KNOWS there is a grand elder. They know the rank exists, they know
 * somebody holds it, and they may hold nothing at all about the person.
 *
 * **Asking by the rung is the natural thing to type in exactly that state**, and
 * it is the state that grant produces at the bottom of a house. A player who
 * knows the structure and not the roster has no other way to refer to anybody.
 *
 * -- IT IS PER-HOUSE VOCABULARY, NOT A GLOBAL ONE -------------------------
 *
 * "The grand elder" means nothing in general and means one person at the
 * Pavilion. Every house names its own rungs - Pavilion Master, Hall Sovereign,
 * Order Patriarch, Abbot - and `sect.ranks` is already that list, so the
 * vocabulary is data and no table is added here.
 *
 * The house is the asker's own. Standing on somebody's ground is the other
 * context that should reach this and does not yet: `KnowledgeScope` carries a
 * place NAME and not the location rows, so the holder of the ground cannot be
 * read from here. A non-member asking after "the abbot" while standing in the
 * Temple is the case that is still missing, and it wants a scope field rather
 * than a second rule.
 *
 * -- RESOLVING THE RUNG IS NOT NAMING THE HOLDER --------------------------
 *
 * The two silences, and they are the same shape as the ground holder's. Being
 * told the ladder entitles somebody to ask; whether a NAME comes back is a
 * separate question answered by what they hold about the person:
 *
 *   nobody holds it     a real answer about the house, and useful.
 *   somebody does and   the rung resolves, the person does not. "There is one,
 *   you cannot say who  and you do not know who" is the honest sentence, and it
 *                       is worth more than a refusal.
 *   you can name them   the ordinary case for a member of any standing.
 *
 * KNOWING AN OFFICE EXISTS IS NEVER A ROUTE TO THE PERSON HOLDING IT, and the
 * knowledge row is what enforces that rather than a second check. Somebody the
 * asker holds nothing about is not named however plainly the rung resolves, so
 * the office can be common knowledge while its holder is not - which is exactly
 * the state a new member is in and the reason this exists.
 *
 * A height gate was written here and removed: see the note at the filter for why
 * it could not fire, and why knowledge winning over the gap is the right rule
 * for a row somebody was handed rather than one they perceived.
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
    //
    // Measured on the sentence that produced this: `who is the grand elder` did
    // NOT reach `Grand Sword Elder` on a score alone, because the house's idiom
    // puts its own word in the middle of the title and a player naturally leaves
    // it out. Everybody says "the grand elder"; nobody says "the grand sword
    // elder".
    //
    // So a title also matches when it CONTAINS every word the player used, and
    // the score is still what chooses between the ones that do - which is what
    // keeps `sword elder` on `Sword Elder` rather than on `Grand Sword Elder`,
    // where both contain the words and only one is what was said.
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
    //
    // The knowledge row, and only that. A presence check was written here and
    // taken out again, because it could not fire: `noticesThatTheyAreThere`
    // answers true outright for anybody `known`, and everybody reaching it had
    // already passed `isAwareOf`. A gate that cannot fail is worse than no gate
    // - it reviews as a check and is a no-op.
    //
    // And removing it is right rather than merely tidy. The rule everywhere else
    // is that KNOWLEDGE WINS OVER THE GAP: a row about somebody survives any
    // number of rungs, because being told who leads your house is not a claim to
    // have perceived them. The height gate belongs where a name would otherwise
    // arrive by arithmetic - the roster read, the room read - and a member
    // naming their own Pavilion Master off a row they were given on their first
    // day is not that case.
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
 *
 * ── THE DEFECT THIS EXISTS FOR ───────────────────────────────────────────
 *
 * The suggestion strip offers `I go into <site>`, and typing **"what is <that
 * site>?"** came back *"Nothing here answers to it. Unresolved subject: no
 * knowledge record and nothing co-located."* **The strip offered a thing the
 * inspect path denied existed**, and the refusal then listed six things it
 * could see, all of them people and houses.
 *
 * `resolveAnything` walked asker, cultivator, sect, known place, technique,
 * object, recipe, pill, herb. No site, ever.
 *
 * ── THE ACTUAL BUG IS THE TWO GATES, NOT THE MISSING BRANCH ──────────────
 *
 * `go into` resolves through `siteMeant`, which filters on `nameableSites` and
 * the awareness record. `what is` resolved through a chain that could not see a
 * site at all. Two surfaces answering the same noun from different gates can
 * disagree, and did. So this calls the SAME `nameableSites` with the SAME
 * awareness predicate and hands the query to the SAME `resolveSite` matcher -
 * which scores on the display name and on the id slug, because "the eighth
 * stone" is the whole of `trial-the-eighth-stone` and none of "The Chamber Under
 * the Eighth Stone". Sharing all three makes the two verbs agree by
 * construction rather than by both being written correctly.
 *
 * ── AND IT STOPS AT THE THRESHOLD ────────────────────────────────────────
 *
 * `faceOf` returns a type with no `interior` key, so the compiler refuses the
 * leak before a test has to catch it. What comes back is the marker, and the
 * rumour and the attribution where awareness permits them - the same pre-entry
 * face the `site` verb shows, at the same awareness. Asking what a place is has
 * never been the same act as going into it, and this does not make it one.
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

    // ── AND THE GROUND, WHICH THIS COULD NEVER MENTION ───────────────
    //
    // The awareness filter above admits `cultivator` and `sect` and nothing
    // else, so a refusal listing what the player could have meant printed six
    // people and houses however many ruins and graves they could name. That
    // read as *the parser only knows people*, and it was the line an agent used
    // to conclude that `resolveAnything` could not see a site - correctly, at
    // the time, and it would have gone on saying so after the branch landed.
    //
    // The same gate the resolver uses, so the two say the same thing.
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
