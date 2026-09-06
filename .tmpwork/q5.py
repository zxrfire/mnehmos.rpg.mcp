import io

p = 'src/web/site-phrasings.ts'
s = io.open(p, encoding='utf-8').read()

old = """export function siteStep(text: string, input: string): PlannedAction | null {
    if (WEIGHING_RATHER_THAN_GOING.test(text)) return null;

    const named = siteNamed(text);
    const noun = SITE_NOUNS.test(text);"""

new = """export function siteStep(text: string, input: string): PlannedAction | null {
    if (WEIGHING_RATHER_THAN_GOING.test(text)) return null;

    const named = siteNamed(text);
    // A CATEGORY NOUN INSIDE A NAME IS NOT A CATEGORY. See `outsideAnyName`.
    const noun = SITE_NOUNS.test(outsideAnyName(input));"""
assert old in s, 'siteStep head not found'
s = s.replace(old, new, 1)

helper = '''
/**
 * THE SENTENCE WITH ITS PROPER NAMES TAKEN OUT.
 *
 * Measured, on a played turn: "I travel to Four Graves" never moved anybody. It
 * came back as the site LISTING - eighteen catalogued grounds - because `graves`
 * is a site noun and Four Graves is a town. Zero days passed, the player stayed
 * where they were, and every later turn reasoned about the wrong square.
 *
 * This file's own header already states the discipline that would have caught
 * it. `scars` and `spirit veins` were tried as site nouns and REVERTED, because
 * *"those words appear in the names and descriptions of places a player travels
 * to rather than walks into"*, and `old ground` was admitted only after passing
 * the test that *"it names no place in the catalog"*. `graves` never passed that
 * test: `place-names.ts` carries FOUR_GRAVES, and the region catalog carries The
 * Four Graves Terminal.
 *
 * So rather than removing the noun - which would lose "what graves are near" -
 * the ANCHOR is asked of the sentence with its names taken out. A word doing
 * duty inside a proper name is not that word being used as a category, and this
 * is true of every category noun this parser has, not only of graves:
 *
 *   "I travel to Four Graves"          -> "I travel to"           not a site
 *   "I travel to the Four Graves ruin" -> "I travel to the ruin"  a site
 *   "what graves are near"             -> unchanged               a site
 *
 * A NAME IS TWO CAPITALISED WORDS OR MORE, deliberately. One would take the
 * first word of every sentence and every over-capitalised noun a player types.
 * Two is what a place in this world is actually called, and a named site the
 * catalog knows is unaffected either way because `siteNamed` anchors it
 * separately and is asked first.
 *
 * KNOWN LIMIT, stated rather than hidden: somebody typing entirely in lower
 * case gives no signal to read, and "i travel to four graves" still anchors.
 * That is the state before this change rather than a regression, and fixing it
 * wants the world's own place list, which this table does not have and should
 * not hold a copy of.
 */
function outsideAnyName(input: string): string {
    return input.replace(A_NAME_RATHER_THAN_A_NOUN, ' ').toLowerCase();
}

/** Two or more capitalised words in a row. What a place in this world is called. */
const A_NAME_RATHER_THAN_A_NOUN = /\\b[A-Z][a-z'']+(?:\\s+(?:of|the|and|a)\\s+|\\s+)(?:[A-Z][a-z'']+)(?:\\s+[A-Z][a-z'']+)*\\b/g;

'''

anchor = 'export function siteStep(text: string, input: string): PlannedAction | null {'
s = s.replace(anchor, helper.lstrip('\n') + anchor, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
