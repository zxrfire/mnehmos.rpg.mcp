import io
p = 'src/web/match-phrasings.ts'
s = io.open(p, encoding='utf-8').read()

old = """export const PLACING_A_CHILD =
    /\\b(?:place|places|placing|send|sends|sending|enrol|enrols|enroll|enrolls|enrolling|apprentice|apprentices|apprenticing)\\b/;"""
assert old in s, 'PLACING_A_CHILD not found'

new = """export const PLACING_A_CHILD = new RegExp(
    '\\\\b(?:place|places|placing|send|sends|sending|enrol|enrols|enroll|enrolls'
    + '|enrolling|apprentice|apprentices|apprenticing)\\\\b'
    // ── AND THE WAY SOMEBODY ACTUALLY ASKS FOR IT ────────────────────────
    //
    // Caught by the corpus check: this file's own exemplar for the verb - "I
    // call in a favour to get my child into that house" - reached `interact`
    // and not `child`. Which is the exemplar the doc comment above is ABOUT,
    // the favour reaching a player for the first time, so the table was wrong
    // and the sentence was right.
    //
    // Nobody says "I enrol my son at the Pavilion" when they are calling in a
    // favour. They say they are GETTING him in. The formal verbs above are how
    // a clerk writes it down afterwards.
    //
    // CONSTRAINED, because `get` and `put` are the two commonest verbs in the
    // language. A destination preposition has to follow within a clause, so "I
    // get a child with her" - which is conceiving one and belongs to
    // `HAVING_A_CHILD` - does not match, and the branch that reads this also
    // demands a child noun and a destination of its own.
    + '|\\\\b(?:get|gets|getting|put|puts|putting)\\\\b[^.!?]{0,30}?\\\\b(?:into|in|at)\\\\b'
);"""
s = s.replace(old, new, 1)

old_t = """                target: extractSubject(
                    input,
                    /place .{0,40} (?:at|with|in|into)|send .{0,40} to|enrol .{0,40} (?:at|in|with)|apprentice .{0,40} to|at|with/
                )"""
assert old_t in s, 'child place target extractor not found'
new_t = """                target: extractSubject(
                    input,
                    /place .{0,40} (?:at|with|in|into)|send .{0,40} to|enrol .{0,40} (?:at|in|with)|apprentice .{0,40} to|(?:get|put) .{0,40} (?:into|in|at)|at|with/
                )"""
s = s.replace(old_t, new_t, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
