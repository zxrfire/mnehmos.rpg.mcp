import io

# ── 1. the helper moves to sentence-parts, where every table can reach it ──
p = 'src/web/sentence-parts.ts'
s = io.open(p, encoding='utf-8').read()
helper = '''
/**
 * THE SENTENCE WITH ITS PROPER NAMES TAKEN OUT.
 *
 * A word doing duty inside a NAME is not that word being used as a category,
 * and this table is full of branches that anchor on a category noun. Every one
 * of them is a place a proper name can be eaten.
 *
 * ── MEASURED, FIVE TIMES, BEFORE IT WAS GENERALISED ──────────────────────
 *
 * It was found once - "I travel to Four Graves" reached the inheritance-site
 * listing and never moved anybody, because `graves` is a site noun - and fixed
 * locally, inside `siteStep`. A pass over the whole catalog immediately found
 * four more that the local fix did not reach, each with the same shape and a
 * different verb family:
 *
 *   Knife Edge     `knife`    12 of 12 phrasings became an ATTACK on "Edge"
 *   Wind Market    `market`   7 of 12 reached the board and never moved
 *   Stone Shadow   `shadow`   every travel phrasing became move/FOLLOW
 *   Iron Ridge Mission `mission`  "what does it teach" reached the errand board
 *
 * Those names were changed, which fixes those names. This fixes the CLASS: any
 * branch that anchors on a category noun can ask the sentence with its names
 * removed, and stop eating the next one somebody writes.
 *
 * ── A NAME IS TWO CAPITALISED WORDS OR MORE ──────────────────────────────
 *
 * Deliberately. One would take the first word of every sentence and every
 * over-capitalised noun a player types. Two is what a place in this world is
 * actually called - and a name the catalog knows is unaffected either way,
 * because the readers that resolve a name by name run first and anchor it.
 *
 * KNOWN LIMIT, stated rather than hidden: somebody typing entirely in lower
 * case gives no signal to read, and "i travel to four graves" still anchors.
 * Fixing that wants the world's own place list, which a pattern table does not
 * have and should not hold a copy of. It is the reason those five names moved
 * as well: this narrows the class, and a name that carries no category word
 * cannot be eaten by either route.
 */
export function outsideAnyName(input: string): string {
    return input.replace(A_NAME_RATHER_THAN_A_NOUN, ' ').toLowerCase();
}

/** Two or more capitalised words in a row. What a place in this world is called. */
const A_NAME_RATHER_THAN_A_NOUN =
    /\\b[A-Z][a-z']+(?:\\s+(?:of|the|and|a)\\s+|\\s+)(?:[A-Z][a-z']+)(?:\\s+[A-Z][a-z']+)*\\b/g;
'''
s = s.rstrip() + '\n' + helper
io.open(p, 'w', encoding='utf-8', newline='').write(s)

# ── 2. site-phrasings uses the shared one ───────────────────────────────
p2 = 'src/web/site-phrasings.ts'
s2 = io.open(p2, encoding='utf-8').read()
a = s2.index('/**\n * THE SENTENCE WITH ITS PROPER NAMES TAKEN OUT.')
b = s2.index('export function siteStep(')
s2 = s2[:a] + s2[b:]
# import it
import re
m = re.search(r"import \{([^}]*)\} from '\./sentence-parts\.js';", s2)
if m:
    s2 = s2[:m.start(1)] + m.group(1).rstrip() + ', outsideAnyName\n' + s2[m.end(1):]
else:
    s2 = s2.replace("import { PlannedAction }", "import { outsideAnyName } from './sentence-parts.js';\nimport { PlannedAction }", 1)
io.open(p2, 'w', encoding='utf-8', newline='').write(s2)
print('ok')
