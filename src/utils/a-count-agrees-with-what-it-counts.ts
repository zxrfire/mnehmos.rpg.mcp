/**
 * A COUNT AND THE THING IT COUNTS.
 *
 * Every `${n} thing${n === 1 ? '' : 's'}` written by hand in this repo is
 * correct, because whoever wrote it could see both forms. The bug class is the
 * other one: a count printed in front of a noun that arrives at runtime, from
 * the catalog or from a house's own rank list, where the author never saw the
 * word at all.
 *
 * Measured, playing as a Sword Elder and giving an order:
 *
 *     3 core disciple went out for 7 days on Sword Elder's word
 *
 * The rank came out of `Sect.ranks`, which holds titles as a house writes them
 * on a plate, and a plate names one person. The same shape sits in the yard
 * listing, where the noun is a conveyance name out of the catalog.
 *
 * ── A NAME IS NOT ALWAYS PLURAL AT THE END ───────────────────────────────
 *
 * A dozen of the two hundred-odd rank titles in `sects.ts` carry a preposition -
 * `Keeper of Names`, `Elder of the Hour`, `Warden of the Six Li`,
 * `Under-Warden of the Weir` - and the head noun stands in front of it. Adding
 * an s to the last word gives `Keeper of Nameses`. The head is what agrees.
 *
 * ── KNOWN LIMIT, STATED RATHER THAN HIDDEN ───────────────────────────────
 *
 * This is a rule and two small tables, not a dictionary. A word nobody in this
 * world says falls through to the regular rule and may come out wrong. The
 * tables cover what the catalogs actually print; when a catalog gains a word the
 * rule mishandles, the word goes in a table here rather than the printing site
 * gaining a special case.
 */

/** Plurals no rule makes. */
const NOT_BY_ANY_RULE: Readonly<Record<string, string>> = {
    person: 'people',
    man: 'men',
    woman: 'women',
    child: 'children',
    foot: 'feet',
    tooth: 'teeth',
    ox: 'oxen',
    mouse: 'mice',
    goose: 'geese',
    die: 'dice',
    life: 'lives',
    wife: 'wives',
    knife: 'knives',
    leaf: 'leaves',
    thief: 'thieves',
    wolf: 'wolves',
    self: 'selves',
    half: 'halves',
    // The compounds this world actually writes on a plate or a roster.
    waterman: 'watermen',
    swordsman: 'swordsmen',
    guardsman: 'guardsmen',
    horseman: 'horsemen',
    headman: 'headmen',
    craftsman: 'craftsmen',
    boatman: 'boatmen'
};

/**
 * The other side of {@link NOT_BY_ANY_RULE}: a plural no rule makes is not a
 * word a rule can read either, and `watermen` came back `watermens`.
 */
const ALREADY_THE_IRREGULAR_PLURAL: ReadonlySet<string> =
    new Set(Object.values(NOT_BY_ANY_RULE));

/**
 * Words that are already however many there are.
 *
 * Two kinds. Mass and collective nouns, which have no separate plural; and the
 * participles a house uses AS a rank - `Bound`, `Chosen`, `Ticketed`, `The
 * Severed` - where the word names the condition and the roster is a list of
 * people in it. `3 chosens` is not a thing a house writes down.
 */
const THE_SAME_HOWEVER_MANY: ReadonlySet<string> = new Set([
    'folk', 'kin', 'gentry', 'clergy', 'offspring', 'staff', 'sheep', 'deer',
    'fish', 'series', 'species', 'jade', 'rice', 'grain', 'cash', 'coin',
    'bound', 'chosen', 'severed', 'sworn', 'fallen', 'nameless', 'ticketed',
    'kindling', 'dead', 'missing', 'young', 'wounded', 'unnamed', 'unranked'
]);

/**
 * A `ch` that is said as a k, and takes a plain s.
 *
 * The Orchid Terrace's head is a Matriarch and the Iron Bell Order's is a
 * Patriarch, and the ch rule minted Matriarches for both.
 */
const A_HARD_CH = /(?:arch|och|mach)$/;

/**
 * The words that put the head noun in front of them.
 *
 * `at` and `to` are deliberately absent: no title in the catalog uses either,
 * and both turn up inside the phrases that reach here from elsewhere.
 */
const A_TAIL_THE_HEAD_CARRIES =
    /\s+(?:of|among|amongst|in|on|over|under|beneath|within|beyond|before|behind|against|for|from|by|with)\s+/i;

/**
 * A phrase's own article, which a count replaces.
 *
 * {@link howMany} strips it; {@link pluralOf} does not. A rank titled `The
 * Severed Themselves` is three words in every house that writes it down, and
 * only a number in front of it makes the article wrong.
 */
const ITS_OWN_ARTICLE = /^\s*(?:an?|the)\s+/i;

/**
 * The one word that agrees, and what came after it.
 */
function headAndTail(noun: string): readonly [string, string] {
    const at = A_TAIL_THE_HEAD_CARRIES.exec(noun);
    // A phrase that OPENS with a preposition - "on foot" - has no head in front
    // of one, and splitting there would agree with nothing.
    if (!at || at.index === 0) return [noun, ''];
    return [noun.slice(0, at.index), noun.slice(at.index)];
}

/**
 * More than one of it.
 */
export function pluralOf(noun: string): string {
    const [head, tail] = headAndTail(noun);
    const space = head.lastIndexOf(' ');
    const before = space < 0 ? '' : head.slice(0, space + 1);
    const word = space < 0 ? head : head.slice(space + 1);
    return `${before}${moreThanOne(word)}${tail}`;
}

/**
 * One word, in whatever case it arrived.
 */
function moreThanOne(word: string): string {
    const lower = word.toLowerCase();
    if (lower.length === 0) return word;
    if (THE_SAME_HOWEVER_MANY.has(lower)) return word;
    if (ALREADY_THE_IRREGULAR_PLURAL.has(lower)) return word;

    const irregular = NOT_BY_ANY_RULE[lower];
    if (irregular !== undefined) return writtenTheWayTheWordWas(word, irregular);

    // Already plural. `ss` is the exception that proves it needs the check:
    // a Witness is one person and Witnesses are several.
    if (lower.endsWith('s') && !lower.endsWith('ss') && !lower.endsWith('us')) return word;

    if (/[^aeiou]y$/.test(lower)) return `${word.slice(0, -1)}${inTheCaseItArrivedIn(word, 'ies')}`;
    if (/(?:s|x|z|ch|sh)$/.test(lower) && !A_HARD_CH.test(lower)) {
        return `${word}${inTheCaseItArrivedIn(word, 'es')}`;
    }
    return `${word}${inTheCaseItArrivedIn(word, 's')}`;
}

/**
 * A whole word replaced, keeping the capital the roster wrote it with.
 */
function writtenTheWayTheWordWas(word: string, replacement: string): string {
    const letters = word.replace(/[^A-Za-z]/g, '');
    if (letters.length > 1 && letters === letters.toUpperCase()) return replacement.toUpperCase();
    if (/^[A-Z]/.test(word)) return `${replacement[0]?.toUpperCase() ?? ''}${replacement.slice(1)}`;
    return replacement;
}

/**
 * A TITLE IS PRINTED BOTH WAYS.
 *
 * `Sect.ranks` holds `Core Disciple` and the order line lowercases it, so the
 * ending has to follow the word it is stuck to rather than assume either.
 */
function inTheCaseItArrivedIn(word: string, ending: string): string {
    const letters = word.replace(/[^A-Za-z]/g, '');
    const allCaps = letters.length > 1 && letters === letters.toUpperCase();
    return allCaps ? ending.toUpperCase() : ending;
}

/**
 * A count and the thing it counts, agreeing.
 *
 * The noun is given in the singular, as a catalog or a roster holds it. A
 * leading article goes: a count is one, and "5 a shod carriages" was a real
 * line in the yard listing before the site learned to strip it.
 */
export function howMany(count: number, noun: string): string {
    const one = noun.replace(ITS_OWN_ARTICLE, '');
    return `${count} ${count === 1 ? one : pluralOf(one)}`;
}
