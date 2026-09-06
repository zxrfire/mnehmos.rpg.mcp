/**
 * The type nouns a house in this world ends its name with.
 *
 * ONE LIST, BECAUSE THERE WERE TEN. Every place that had to recognise "the
 * Azure Dew Sect" as a house carried its own alternation of house words, hand
 * written, and no two of them agreed: `entities.ts` knew about pavilions and
 * `sect-phrasings.ts` did not, `acts-over-a-set.ts` knew about courts and
 * `verb-pattern-table.ts` did not, and not one of the ten had ever heard of a
 * guild.
 *
 * Measured, and it is not a hypothetical: "I take the Cinnabar Crucible Sect
 * intake" did not reach the intake at all, and had not since the guild was
 * written. The sentence came back as somebody taking a thing called "Cinnabar
 * Crucible Hall intake" out of a pouch. Four houses in the catalog end in
 * `Guild`, two in `Temple`, one each in `Grove`, `Cult`, `Caravan`, `Patrol`
 * and `Bureau`, and every one of them was invisible to half the parser.
 *
 * `the-nouns-a-house-ends-with.test.ts` is the ratchet: a house added to the
 * catalog whose last word is not on this list fails, which is the only way a
 * list like this stays true to the thing it describes.
 */

import { SECTS } from '../data/cultivation/sects.js';

/**
 * Every word a house's name ends in, lowercase.
 *
 * Ordered longest-first where one contains another, so an alternation built
 * from this never matches the short one inside the long one.
 */
export const HOUSE_TYPE_NOUNS: readonly string[] = Object.freeze([
    // `guild` is deliberately absent. It is a fantasy-RPG institution - an
    // independent professional association you register with - and this world
    // has none: a body here is a sect, a hall, a pavilion, an alliance, a
    // court, a clan or a temple, and which one it is says what it wants and
    // who it answers to.
    'pavilion', 'wanderers', 'alliance', 'caravan', 'register', 'market',
    'stronghold', 'fortress', 'temple', 'patrol', 'palace', 'terrace',
    'tower', 'valley', 'manor', 'court', 'grove', 'array', 'ward', 'peak',
    'sect', 'hall', 'cult', 'clan', 'order', 'school', 'house'
]);

/**
 * The alternation, for dropping into a pattern that already has its own shape.
 *
 * A fragment rather than a `RegExp`, because every caller wraps it differently
 * - some want it optional, some want a plural, one wants it anchored - and a
 * finished pattern here would be a fragment with a wrapper nobody uses.
 */
export const A_HOUSE_TYPE_NOUN = HOUSE_TYPE_NOUNS.join('|');

/**
 * The half of the list a player can say WITHOUT the house's name on it.
 *
 * "I resign from the hall" is a resignation and needs no name, because nothing
 * else in this world is "the hall" to somebody on a roll. "I leave the valley"
 * is not, because the map has an Orchid Valley in it and a player standing in
 * one says exactly that sentence about ground.
 *
 * Measured, when the whole list was dropped into the bare gates: `tell me
 * about the valley` stopped reaching `investigate` and became a house listing,
 * `I leave the market` and `where do I stand in the market` stopped reaching
 * the market, and `I give the sword to the ward` became a donation. That is
 * the same defect the site nouns had once - a word that lives in the NAMES of
 * places a player travels to, taken for a category - and the correction there
 * was to narrow to what was actually seen to fail.
 *
 * So the split is by whether the bare word is ambiguous with ground or with a
 * body that is not a house, and NOT by how the catalog happens to read this
 * week. It is here rather than in the four files that need it because ten
 * hand-written lists in ten files is the defect this module exists to close;
 * one list with a stated reason, checked against `HOUSE_TYPE_NOUNS` by
 * `the-nouns-a-house-ends-with.test.ts`, is not the same shape.
 */
export const HOUSE_TYPE_NOUNS_THAT_STAND_ALONE: readonly string[] = Object.freeze([
    'pavilion', 'alliance', 'temple', 'court', 'grove',
    'sect', 'hall', 'cult', 'clan', 'order', 'school', 'house'
]);

/** The standing-alone half as an alternation, with the plural. */
export const A_HOUSE_TYPE_NOUN_ALONE_OR_PLURAL =
    HOUSE_TYPE_NOUNS_THAT_STAND_ALONE.map(word => `${word}s?`).join('|');

/**
 * The houses of the catalog by their own names, longest first.
 *
 * The other half of the same question, and the half the type nouns cannot
 * answer: `Crimson Abyss Fortress`, `Verdant Spring Valley` and `Still Blade
 * Peak` all end in words a player says about ground, so a gate that fires on
 * the bare noun cannot have them - and measured, `I resign from Crimson Abyss
 * Fortress`, `I leave Verdant Spring Valley` and `who is in charge of
 * Clearwater Ward` all reached nothing at all, while `I resign from Silver
 * Island Market` reached the market stall. A whole name is unambiguous where
 * its last word is not, so it can be matched where the word cannot.
 *
 * A leading `The` is dropped so the name matches with or without it. A name of
 * one word after that is skipped: `The Severed` would put every severed
 * meridian and severed hand in the game on the sect verb, which is the reason
 * `the-nouns-a-house-ends-with.test.ts` already gives for keeping that word out
 * of the type nouns.
 */
export const A_HOUSE_BY_NAME = SECTS
    .map(house => house.name.trim().replace(/^the\s+/i, '').toLowerCase())
    .filter(name => name.includes(' '))
    .sort((a, b) => b.length - a.length)
    .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

/**
 * "A house of the catalog is named here, by name."
 *
 * The half a listing must NOT fire on. "tell me about the courts near here" is
 * a question about the category and "tell me about the Hollow Court" is a
 * question about one house, and the second reaches the read that answers about
 * a named thing.
 */
export const A_HOUSE_NAME_IS_SAID = new RegExp(`\\b(?:${A_HOUSE_BY_NAME})\\b`, 'i');

/**
 * Both halves as one alternation, for a pattern that has its own shape round it.
 */
export const A_HOUSE_BY_NAME_OR_KIND =
    `${A_HOUSE_TYPE_NOUN_ALONE_OR_PLURAL}|${A_HOUSE_BY_NAME}`;

/**
 * "A house is named in this sentence" - the finished question, both halves.
 *
 * Every gate that asks it should ask it here. There were ten hand-written
 * answers to it across `src/web/` before this module, and after it there was
 * one caller.
 */
export const A_HOUSE_IS_NAMED = new RegExp(`\\b(?:${A_HOUSE_BY_NAME_OR_KIND})\\b`, 'i');
