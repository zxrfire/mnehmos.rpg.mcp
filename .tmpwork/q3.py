import io
VPT = 'src/web/verb-pattern-table.ts'
SP  = 'src/web/sect-phrasings.ts'

vpt = io.open(VPT, encoding='utf-8').read()
old = """/** The nouns a posted intake is pointed at by. No house is named any of them. */
const A_POSTED_INTAKE =
    '(?:intakes?|recruiting (?:events?|days?|drives?)|admission days?|open days?'
    + '|recruit(?:ing|ment) (?:bills?|notices?|posters?))';

/**
 * Going to one, as opposed to reading about it.
 */
const GOING_TO_AN_INTAKE =
    'take|takes|taking|go to|goes to|going to|attend|attends|attending|'
    + 'sign up (?:at|for|with)|signs up (?:at|for|with)|signing up (?:at|for|with)|'
    + 'put myself (?:forward|in front of)|present myself (?:at|to|for)|'
    + 'turn up (?:at|to|for)|show up (?:at|to|for)|apply at|be there for|'
    + 'walk in at|walk into';

export const TAKING_A_POSTED_INTAKE = new RegExp(
    `\\b(?:${GOING_TO_AN_INTAKE})\\b[^.!?]{0,40}?\\b${A_POSTED_INTAKE}\\b`,
    'i'
);
"""
assert old in vpt, 'intake pattern block not found'
new = """// The two patterns live in `sect-phrasings.ts`, beside `ASKING_TO_BE_TAKEN_IN`,
// because they answer the same question - whether the speaker is the house or
// the candidate - and the branch that prices a house's intake power has to be
// able to consult them. Re-exported here, which is where callers look.
export { A_POSTED_INTAKE, TAKING_A_POSTED_INTAKE };
"""
vpt = vpt.replace(old, new, 1)
vpt = vpt.replace("    ASKING_TO_BE_TAKEN_IN,",
                  "    A_POSTED_INTAKE,\n    ASKING_TO_BE_TAKEN_IN,\n    TAKING_A_POSTED_INTAKE,", 1)
io.open(VPT, 'w', encoding='utf-8', newline='').write(vpt)

sp = io.open(SP, encoding='utf-8').read()
old_guard = """export const ASKING_TO_BE_TAKEN_IN =
    /\b(?:take me|takes me|taking me|taken on|taken in|admit me|accept me|have me|be admitted|join|joins|joining)\b/;"""
assert old_guard in sp, 'guard not found'
new_guard = """/** The nouns a posted intake is pointed at by. No house is named any of them. */
export const A_POSTED_INTAKE =
    '(?:intakes?|recruiting (?:events?|days?|drives?)|admission days?|open days?'
    + '|recruit(?:ing|ment) (?:bills?|notices?|posters?))';

/**
 * Going to one, as opposed to reading about it.
 */
const GOING_TO_AN_INTAKE =
    'take|takes|taking|go to|goes to|going to|attend|attends|attending|'
    + 'sign up (?:at|for|with)|signs up (?:at|for|with)|signing up (?:at|for|with)|'
    + 'put myself (?:forward|in front of)|present myself (?:at|to|for)|'
    + 'turn up (?:at|to|for)|show up (?:at|to|for)|apply at|be there for|'
    + 'walk in at|walk into';

export const TAKING_A_POSTED_INTAKE = new RegExp(
    `\\b(?:${GOING_TO_AN_INTAKE})\\b[^.!?]{0,40}?\\b${A_POSTED_INTAKE}\\b`,
    'i'
);

/**
 * WHICH SIDE OF THE DOOR THE SPEAKER IS ON.
 *
 * A house takes people in, and a candidate turns up to be taken in, and English
 * hands both of them the verb `take`. Every branch that prices a house's intake
 * POWER has to know which of the two it is looking at, so the question is asked
 * once and the branches read the answer.
 *
 * MEASURED, AND IT IS WHY THE TWO PATTERNS NOW SIT TOGETHER. "I take the intake
 * at the Silver Island Market" came back as the house RECRUITING somebody
 * called "intake at the Silver Island Market" - a person who does not exist,
 * paid for out of a purse the speaker does not control. `take` is a recruiting
 * verb and `intake` is an intake noun, so the branch that prices taking on a
 * disciple fired on a sentence about turning up to be considered as one.
 *
 * `TAKING_A_POSTED_INTAKE` was already written and already right, and it lived
 * in the other file - so the recruit branch could not consult it. Moving it
 * beside this one is the whole fix, and the guard below is what it buys.
 */
export const ASKING_TO_BE_TAKEN_IN = new RegExp(
    '\\b(?:take me|takes me|taking me|taken on|taken in|admit me|accept me|have me'
    + '|be admitted|join|joins|joining)\\b'
    // AND TURNING UP TO ONE, which is the same request made by walking to it.
    + `|${TAKING_A_POSTED_INTAKE.source}`,
    'i'
);"""
sp = sp.replace(old_guard, new_guard, 1)
io.open(SP, 'w', encoding='utf-8', newline='').write(sp)
print('ok')
