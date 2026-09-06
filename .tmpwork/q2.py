import io

VPT = 'src/web/verb-pattern-table.ts'
SP = 'src/web/sect-phrasings.ts'

vpt = io.open(VPT, encoding='utf-8').read()

# ── lift the intake matcher out of the table ────────────────────────────
start = vpt.index('// TAKING AN INTAKE THE GAME ITSELF JUST POSTED')
end = vpt.index('/**\n * Asking who would have you, in a sentence that names no house at all.\n */')
block = vpt[start:end]
assert 'whoseIntakeItIs' in block and 'TAKING_A_POSTED_INTAKE' in block

vpt = vpt[:start] + """// TAKING AN INTAKE THE GAME ITSELF JUST POSTED
//
// The matcher itself lives in `sect-phrasings.ts` beside
// `ASKING_TO_BE_TAKEN_IN`, because both of them answer the same question -
// whether the speaker is the house or the candidate - and two copies of that
// question is how they came to disagree. Re-exported here because this table
// has always been where callers look for it.

""" + vpt[end:]

# ── and re-export it from where it used to live ─────────────────────────
vpt = vpt.replace("    ASKING_TO_BE_TAKEN_IN,", "    ASKING_TO_BE_TAKEN_IN,\n    TAKING_A_POSTED_INTAKE,\n    whoseIntakeItIs,", 1)
assert 'TAKING_A_POSTED_INTAKE,\n    whoseIntakeItIs,' in vpt

vpt = vpt.replace("""// TAKING AN INTAKE THE GAME ITSELF JUST POSTED
//""",
"""export { TAKING_A_POSTED_INTAKE, whoseIntakeItIs };

// TAKING AN INTAKE THE GAME ITSELF JUST POSTED
//""", 1)

io.open(VPT, 'w', encoding='utf-8', newline='').write(vpt)

# ── put it in sect-phrasings, and widen the candidate guard ─────────────
sp = io.open(SP, encoding='utf-8').read()
old_guard = """export const ASKING_TO_BE_TAKEN_IN =
    /\\b(?:take me|takes me|taking me|taken on|taken in|admit me|accept me|have me|be admitted|join|joins|joining)\\b/;"""
assert old_guard in sp

new_guard = block.rstrip() + """

/**
 * WHICH SIDE OF THE DOOR THE SPEAKER IS ON.
 *
 * A house takes people in and a candidate turns up to be taken in, and English
 * gives both of them the verb `take`. Every branch that prices a house's
 * intake power has to know which of the two it is looking at, so the question
 * is asked once, here, and the branches read the answer.
 *
 * MEASURED, AND THIS IS WHY IT IS ONE PATTERN AND NOT TWO. "I take the intake
 * at the Silver Island Market" came back as the house RECRUITING somebody
 * called "intake at the Silver Island Market" - a person who does not exist,
 * out of a purse the speaker does not control. `take` is a recruiting verb and
 * `intake` is an intake noun, so the branch that prices taking on a disciple
 * fired on a sentence about turning up to be considered for one.
 *
 * `TAKING_A_POSTED_INTAKE` was already written and already correct, and it was
 * in the other file - so the recruit branch could not consult it. Moving it
 * here is the whole fix.
 */
export const ASKING_TO_BE_TAKEN_IN = new RegExp(
    '\\\\b(?:take me|takes me|taking me|taken on|taken in|admit me|accept me|have me'
    + '|be admitted|join|joins|joining)\\\\b'
    // AND TURNING UP TO ONE, which is the same request made by walking to it.
    + `|${TAKING_A_POSTED_INTAKE.source}`,
    'i'
);"""

sp = sp.replace(old_guard, new_guard, 1)
io.open(SP, 'w', encoding='utf-8', newline='').write(sp)
print('ok')
