import io

VPT = 'src/web/verb-pattern-table.ts'
SP = 'src/web/sect-phrasings.ts'

vpt = io.open(VPT, encoding='utf-8').read()

A = '/** The nouns a posted intake is pointed at by.'
B = "/**\n * Which house's intake the sentence means, where it says.\n */"
ia = vpt.index(A)
ib = vpt.index(B)
assert ia < ib
patterns = vpt[ia:ib].rstrip() + '\n'
assert 'TAKING_A_POSTED_INTAKE' in patterns and 'GOING_TO_AN_INTAKE' in patterns

note = (
    "// The two patterns live in `sect-phrasings.ts`, beside\n"
    "// `ASKING_TO_BE_TAKEN_IN`, because all three answer one question - whether\n"
    "// the speaker is the house or the candidate - and the branch that prices a\n"
    "// house's intake POWER has to be able to consult them. Re-exported here,\n"
    "// which is where every caller already looks for them.\n"
    "export { A_POSTED_INTAKE, TAKING_A_POSTED_INTAKE };\n\n"
)
vpt = vpt[:ia] + note + vpt[ib:]
vpt = vpt.replace(
    "    ASKING_TO_BE_TAKEN_IN,",
    "    A_POSTED_INTAKE,\n    ASKING_TO_BE_TAKEN_IN,\n    TAKING_A_POSTED_INTAKE,",
    1)
io.open(VPT, 'w', encoding='utf-8', newline='').write(vpt)

# ── and into sect-phrasings, exporting the pattern const ────────────────
patterns = patterns.replace('const A_POSTED_INTAKE =', 'export const A_POSTED_INTAKE =', 1)

sp = io.open(SP, encoding='utf-8').read()
GA = 'export const ASKING_TO_BE_TAKEN_IN ='
ga = sp.index(GA)
gb = sp.index('\n', sp.index('joins|joining)\\b/;', ga)) + 1

doc = '''/**
 * WHICH SIDE OF THE DOOR THE SPEAKER IS ON.
 *
 * A house takes people in, and a candidate turns up to be taken in, and English
 * hands both of them the verb `take`. Every branch that prices a house's intake
 * POWER has to know which of the two it is looking at, so the question is asked
 * once and the branches read the answer off it.
 *
 * MEASURED, AND IT IS WHY THE PATTERNS NOW SIT TOGETHER. "I take the intake at
 * the Silver Island Market" came back as the house RECRUITING somebody called
 * "intake at the Silver Island Market" - a person who does not exist, paid for
 * out of a purse the speaker does not control. `take` is a recruiting verb and
 * `intake` is an intake noun, so the branch that prices taking a disciple ON
 * fired on a sentence about turning up to be considered AS one. The two
 * readings are exact opposites and they matched the same words.
 *
 * `TAKING_A_POSTED_INTAKE` was already written and already right, and it lived
 * in the other file - so the recruit branch could not consult it. Moving it
 * beside this one is the whole fix, and this guard is what it buys.
 */
export const ASKING_TO_BE_TAKEN_IN = new RegExp(
    THE_WORDS_A_CANDIDATE_USES
    // AND TURNING UP TO ONE, which is the same request made by walking to it.
    + '|' + TAKING_A_POSTED_INTAKE.source,
    'i'
);
'''

candidate_words = (
    "/** Saying it in so many words. */\n"
    "const THE_WORDS_A_CANDIDATE_USES =\n"
    "    '\\\\b(?:take me|takes me|taking me|taken on|taken in|admit me|accept me'\n"
    "    + '|have me|be admitted|join|joins|joining)\\\\b';\n\n"
)

sp = sp[:ga] + patterns + '\n' + candidate_words + doc + sp[gb:]
io.open(SP, 'w', encoding='utf-8', newline='').write(sp)
print('ok')
