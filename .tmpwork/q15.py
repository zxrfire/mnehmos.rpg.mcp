import io
p = 'src/web/verb-pattern-table.ts'
s = io.open(p, encoding='utf-8').read()

# ── the sentence with its names out, computed once ──────────────────────
old = """function planIntent(input: string): PlannedAction {
    const text = input.toLowerCase().trim();
"""
new = """function planIntent(input: string): PlannedAction {
    const text = input.toLowerCase().trim();
    // THE SAME SENTENCE WITH ITS PROPER NAMES TAKEN OUT, for the branches that
    // anchor on a CATEGORY noun. A word doing duty inside a name is not that
    // word being used as a category - five catalogued places were measurably
    // eaten this way before it was generalised. See `outsideAnyName`, which
    // states each of them and what it cost.
    //
    // Used narrowly and never as a replacement for `text`: a branch that reads
    // a verb, a number or a whole phrasing wants the sentence somebody typed.
    // Only the noun ANCHORS read this.
    const bare = outsideAnyName(input);
"""
assert old in s, 'planIntent head'
s = s.replace(old, new, 1)

# ── 1. the market's own noun ────────────────────────────────────────────
old1 = """        || (usedAsVerb(text, 'browse|shop|buy|sell|barter|haggle|price|visit|check|see|show|find|go to|look at|look over|head to|walk to')
            && /\\b(?:market|marketplace|bazaar|stalls?|prices?|shops?|traders?)\\b/.test(text))"""
new1 = """        // The noun read off `bare`: "I go to Wind Market" reached the board and
        // never moved anybody, seven phrasings in twelve, because a town was
        // called Market. The verb is still read off the sentence as typed.
        || (usedAsVerb(text, 'browse|shop|buy|sell|barter|haggle|price|visit|check|see|show|find|go to|look at|look over|head to|walk to')
            && /\\b(?:market|marketplace|bazaar|stalls?|prices?|shops?|traders?)\\b/.test(bare))"""
assert old1 in s, 'market noun'
s = s.replace(old1, new1, 1)

# ── 2. the move intent table: `shadow` is a verb and a place ────────────
old2 = "matchIntent(text, MOVE_INTENT_PATTERNS)"
n2 = s.count(old2)
assert n2 >= 1, 'move intent call'
s = s.replace(old2, "matchIntent(bare, MOVE_INTENT_PATTERNS)")

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print(f'ok (move intent call sites: {n2})')
