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

/** The same, with the plurals somebody types when they mean the category. */
export const A_HOUSE_TYPE_NOUN_OR_PLURAL =
    HOUSE_TYPE_NOUNS.map(word => `${word}s?`).join('|');
