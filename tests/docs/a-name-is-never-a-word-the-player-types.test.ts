/**
 * No word of a name is a word the player types, or a typo of one.
 *
 * The design owner: "rename all the place names to not conflict with verbs even
 * fuzzy", after "what is your name?" was read as a question about Four Names.
 * Names are matched with typo tolerance, so a name built from everyday words is
 * reachable from sentences that never meant it. See AGENTS.md, "A name evokes
 * what it is".
 *
 * A verb word is one the table itself acts on: "I <word>" or "I <word> him"
 * reads as an act. The function words are the ones every question is made of.
 *
 * And the owner, on how far it reaches: "NOTHING LEFT ALONE". Every name a
 * player can type is held to it - places and houses, and every other named
 * catalog entry (ranks, arts, items, pills, beasts, conveyances, institutions,
 * offices, people), and the generator's word lists, which name everything a
 * seeded world adds. Where a verb and an item want one word, "verbs win over
 * items cuz verbs are more generic and commonly used": the item is renamed.
 */

import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { REGIONS } from '../../src/data/cultivation/regions.js';
import { SECTS } from '../../src/data/cultivation/sects.js';
import {
    ERA_ADJ, FACTION_ADJ, FACTION_FORM, GIVEN_HEAD_FEMALE, GIVEN_HEAD_MALE, GIVEN_TAIL_FEMALE,
    GIVEN_TAIL_MALE, PLACE_HEAD, PLACE_TAIL, SURNAMES
} from '../../src/engine/world/history.js';
import { PHYSIQUES } from '../../src/engine/cultivation/physiques.js';
import { REALM_TIERS } from '../../src/engine/cultivation/realms.js';
import { SPIRIT_ROOTS } from '../../src/engine/cultivation/spirit-roots.js';
import { NAMES_BY_CHARACTER } from '../../src/engine/world/how-the-world-keeps-finding-more-ruins.js';
import { HOUSE_FORMS } from '../../src/engine/world/immortal-world.js';
import { createWorld } from '../../src/engine/world/world-state.js';
import { HOW_A_PLAYER_SAYS_EACH_VERB } from '../../src/web/how-a-player-says-each-verb.js';
import { aTypoAway } from '../../src/web/names-as-they-are-spelled.js';
import { parseIntent } from '../../src/web/verb-pattern-table.js';
import { HOW_A_PLAYER_SAYS_EACH_MOVE, HOW_A_PLAYER_SAYS_EACH_SECT_ASK } from '../web/exemplars/how-a-player-says-each-intent.js';

const FUNCTION_WORDS = [
    'your', 'yours', 'you', 'what', 'where', 'when', 'who', 'whom', 'whose', 'why', 'how', 'here',
    'there', 'this', 'that', 'these', 'those', 'will', 'would', 'could', 'should', 'have', 'with',
    'from', 'into', 'about', 'they', 'them', 'their', 'name', 'names'
];

/**
 * Words that repeat across a whole kind and are not a collision, by the owner's
 * ruling in AGENTS.md: *"elder master and servant aren't collisions. they're
 * pronouns as well as rank names"*, and a kind's type nouns are the same case.
 */
const NOT_A_COLLISION: ReadonlyMap<string, string> = new Map([
    ['master', 'a form of address as well as a rank'],
    ['elder', 'a form of address as well as a rank'],
    ['servant', 'a form of address as well as a rank'],
    ['disciple', 'a form of address as well as a rank'],
    ['seat', 'a form of address as well as a rank - "Third Seat" is how the Court is spoken to'],
    ['pill', 'the type noun of every pill'],
    ['beast', 'the type noun of the beast kind'],
    ['cultivator', 'the type noun of every person on the road, the player included'],
    // The owner's own genre word: "spirit boat = genre flying boat". A player types it
    // to mean exactly the thing, and it is not to be renamed away.
    ['boat', 'the owner\'s term for the flying vessel, "spirit boat"'],
    // "Act as dao protector" is the owner's verb and heads the mission's title. The guard verb
    // wins the sentence and routes it to the mission by id, so the shared word is the point.
    ['protector', 'the owner\'s idiom: acting as dao protector is the guard verb, which takes the mission']
]);

/**
 * Catalog exports whose `name` is a description in the player's own words, not
 * a proper name. A price row called "Hot meal at an inn" is reached by "I eat a
 * meal" and should be; the rule is about names built from everyday words, and
 * these ARE the everyday words, for the everyday thing.
 */
const NOT_NAMES: ReadonlyMap<string, string> = new Map([
    ['PRICES', 'a board row: what the thing is, in the words a buyer uses'],
    ['THE_MORTAL_BOARD', 'the same rows as PRICES'],
    ['OCCUPATIONS', 'a line of work, described'],
    ['SETTLEMENTS', 'a kind of settlement, not a settlement'],
    ['WOUND_TYPES', 'a kind of wound, described'],
    ['SENDING_REASONS', 'why a party goes out, described'],
    ['ROGUE_STANDING', 'what a loose cultivator is called, which is a description'],
    ['ROGUE_TRADES', 'a trade, described'],
    ['DEALERS', 'a kind of dealer, described'],
    ['ENCOUNTERS', 'a situation the engine rolls, described; nothing a player names'],
    ['FALLEN', 'how a life ended, as a sentence']
]);

/** A name that is a sentence about somebody nobody can name is not a name either. */
const A_DESCRIPTION = /^a |\b(?:[Ww]ho|[Ww]hose|[Ww]hoever|[Ww]hich|[Nn]obody)\b|,/;

const NAME_KEYS = new Set(['name', 'title', 'called', 'rank', 'said']);

/**
 * `said` is the handle a player names a posted piece of work by, so it is a name
 * even on a row whose own `name` is a description.
 */
const A_HANDLE = new Set(['said']);

/** The words the verb table acts on, out of what players are recorded saying. */
function theVerbWords(): Set<string> {
    const said = [
        ...Object.values(HOW_A_PLAYER_SAYS_EACH_VERB).flat(),
        ...Object.values(HOW_A_PLAYER_SAYS_EACH_MOVE).flat(),
        ...Object.values(HOW_A_PLAYER_SAYS_EACH_SECT_ASK).flat()
    ];
    const words = new Set(said.flatMap(s => String(s).toLowerCase().replace(/[^a-z' ]+/g, ' ').split(/\s+/)));
    const verbs = new Set<string>();
    for (const w of words) {
        if (w.length < 3 || FUNCTION_WORDS.includes(w) || w === 'the' || w === 'and') continue;
        if (parseIntent(`I ${w}`).action !== 'unclear' || parseIntent(`I ${w} him`).action !== 'unclear') verbs.add(w);
    }
    return verbs;
}

/** Every `name`, `title`, `called` and `rank`, and every rank ladder, in one catalog value. */
function namesIn(
    value: unknown, where: string, into: Map<string, string>, seen = new Set<unknown>(), keys: ReadonlySet<string> = NAME_KEYS
): void {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (value instanceof Map) {
        for (const v of value.values()) namesIn(v, where, into, seen, keys);
        return;
    }
    if (Array.isArray(value)) {
        for (const v of value) namesIn(v, where, into, seen, keys);
        return;
    }
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
        if (typeof v === 'string' && keys.has(key)) {
            if (!into.has(v)) into.set(v, `${where}.${key}`);
        } else if (key === 'ranks' && Array.isArray(v) && keys === NAME_KEYS) {
            for (const rank of v) if (typeof rank === 'string' && !into.has(rank)) into.set(rank, `${where}.ranks`);
            namesIn(v, where, into, seen, keys);
        } else namesIn(v, where, into, seen, keys);
    }
}

function catalogFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
        entry.isDirectory() ? catalogFiles(join(dir, entry.name))
            : entry.name.endsWith('.ts') ? [join(dir, entry.name)] : []);
}

/** Every name a player can type for anything, catalog and generated. */
async function everyName(): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    for (const region of REGIONS) {
        names.set(region.name, 'province');
        for (const place of region.places) names.set(place.name, 'place');
    }
    for (const sect of SECTS) names.set(sect.name, 'house');

    const root = join(process.cwd(), 'src/data/cultivation');
    for (const file of catalogFiles(root)) {
        const module = await import(pathToFileURL(file).href) as Record<string, unknown>;
        for (const [exported, value] of Object.entries(module)) {
            const where = `${relative(root, file)}:${exported}`;
            if (NOT_NAMES.has(exported)) namesIn(value, where, names, new Set(), A_HANDLE);
            else namesIn(value, where, names);
        }
    }

    // The engine's own named kinds, which live beside the code that reads them.
    for (const realm of REALM_TIERS) names.set(realm.name, 'realm');
    for (const physique of PHYSIQUES) names.set(physique.name, 'physique');
    for (const root of SPIRIT_ROOTS) names.set(root.name, 'spirit root');

    const lists: Record<string, readonly string[]> = {
        PLACE_HEAD, PLACE_TAIL, FACTION_ADJ, FACTION_FORM, ERA_ADJ, HOUSE_FORMS
    };
    for (const [list, words] of Object.entries(lists)) {
        for (const word of words) if (!names.has(word)) names.set(word, `generator ${list}`);
    }
    // What a ruin found later is called; `%P` is a place name, held above.
    for (const [character, templates] of Object.entries(NAMES_BY_CHARACTER)) {
        for (const template of templates) names.set(template.replace('%P', '').replace(/\s+/g, ' ').trim(), `generator NAMES_BY_CHARACTER.${character}`);
    }
    for (const seed of ['wander-world', 'self-knowledge-world', 'road-world']) {
        for (const row of createWorld({ seed } as Parameters<typeof createWorld>[0]).locations) {
            if (!names.has(row.name)) names.set(row.name, `generated ${row.kind}`);
        }
    }
    return names;
}

/**
 * A spirit root's name is built from the kind's own vocabulary and nothing
 * else: the elements it holds, how many (Dual, Triple, Quad), and the word
 * `Root`. Those are categories the engine reads - a technique's element, a
 * root's grade - rather than words chosen for a name, so they are the type
 * nouns of that kind and are exempt there only. `fire` in any other name is
 * still a typo of *hire*.
 */
const A_ROOTS_OWN_WORDS = new Set(['root', 'metal', 'wood', 'water', 'fire', 'earth', 'dual', 'triple', 'quad']);

function clashesOf(names: Iterable<[string, string]>, verbs: Set<string>): string[] {
    const typedAnyway = [...verbs, ...FUNCTION_WORDS];
    const clashes: string[] = [];
    for (const [name, kind] of names) {
        if (A_DESCRIPTION.test(name)) continue;
        for (const word of name.toLowerCase().replace(/[^a-z' ]+/g, ' ').split(/\s+/)) {
            if (word.length < 3 || word === 'the' || /'s$/.test(word)) continue;
            if (NOT_A_COLLISION.has(word) || NOT_A_COLLISION.has(word.replace(/s$/, ''))) continue;
            if (kind === 'spirit root' && A_ROOTS_OWN_WORDS.has(word)) continue;
            if (verbs.has(word)) clashes.push(`${name} (${kind}): "${word}" is a verb`);
            const near = typedAnyway.filter(typed => typed !== word && aTypoAway(word, typed));
            if (near.length > 0) clashes.push(`${name} (${kind}): "${word}" is a typo of ${near.join(', ')}`);
        }
    }
    return clashes;
}

/**
 * A personal name is drawn from syllables, and four of them are one letter from
 * a word the player types: `Shen` and `Zhen` from *when*, `Shan` from *span*,
 * `Chai` from *chat*. They are REPORTED to the owner rather than renamed - a
 * surname is a person's, and several of the catalog's people carry one - so
 * they are pinned here: the list may shrink and may not grow.
 */
const PERSONAL_NAMES_REPORTED: readonly string[] = [
    'Chai Xilian (person): "chai" is a typo of chat, chain',
    'Old Shen of the Third Ferry (person): "shen" is a typo of when',
    'Keeper Fu Zhen (person): "zhen" is a typo of when',
    'Keeper Shen Muyan (person): "shen" is a typo of when',
    'Shan Ruyi (person): "shan" is a typo of span',
    'Shen Guyi (person): "shen" is a typo of when',
    'Shen Quan (person): "shen" is a typo of when',
    'Shen Yuandao (person): "shen" is a typo of when',
    'Warden Qiu Shen (person): "shen" is a typo of when',
    'Shen (generated surname): "shen" is a typo of when'
];

/**
 * A person, whose name carries a surname. Said of where the name is kept, since
 * the catalog does not tag it: every name in the rolls of people, and the
 * officers of a court, who are named there beside the court itself. Both are
 * still checked, by the second test, against the list above.
 */
const ROLLS_OF_PEOPLE = /:(?:MEMBERS|FOUNDERS|NAMED_FIGURES|IMMORTAL_ANCESTORS|HISTORICAL_FIGURES|GUEST_ELDERS|HOLLOW_COURT_ROSTER|SECT_ANCESTRY|IMMORTAL_CHANNELS|LINEAGE_STANDINGS|WANDERERS)\.name$/;
const isAPerson = ([name, kind]: readonly [string, string]): boolean =>
    ROLLS_OF_PEOPLE.test(kind) || (/:COURTS\.name$/.test(kind) && /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(name));

describe('a name is never a word the player types', () => {
    it('has no word that is a verb, or a typo of a verb or a question word', async () => {
        const verbs = theVerbWords();
        const names = await everyName();
        const clashes = clashesOf([...names].filter(entry => !isAPerson(entry)), verbs);
        expect(clashes, clashes.join('\n')).toEqual([]);
    }, 300_000);

    it('has no personal name that clashes beyond the ones reported to the owner', async () => {
        const verbs = theVerbWords();
        const names = await everyName();
        const people: [string, string][] = [...names].filter(isAPerson).map(([name]) => [name, 'person']);
        for (const surname of SURNAMES) people.push([surname, 'generated surname']);
        for (const [heads, tails] of [[GIVEN_HEAD_MALE, GIVEN_TAIL_MALE], [GIVEN_HEAD_FEMALE, GIVEN_TAIL_FEMALE]] as const) {
            for (const head of heads) for (const tail of tails) people.push([`${head}${tail}`, 'generated given name']);
        }
        const unreported = clashesOf(people, verbs).filter(line => !PERSONAL_NAMES_REPORTED.includes(line));
        expect(unreported, unreported.join('\n')).toEqual([]);
    }, 300_000);
});
