import io

# ── 1. the observers digression goes ────────────────────────────────────
p = 'AGENTS.md'
s = io.open(p, encoding='utf-8').read()
a = s.index('### Observers are still not the shape to reach for')
b = s.index('That is the shape to move toward here')
keep = """### One store, and the reads are computed

Redux keeps a single store with pure reducers and computes the rest in selectors, and
warns specifically against putting derived state in the store. The Elm architecture has
one Model and derives the view. Entity-component systems keep components as the only
store and let systems query it. Event-sourced designs keep the log as truth and treat
every read as a projection. **None of them notify. They recompute.**

"""
s = s[:a] + keep + s[b:]

# ── 2. and the rule about quoting ───────────────────────────────────────
old = """What this does NOT mean: stripping the measurements. The headers that record *what was
played, what broke, and what the number was* are the most valuable prose here and they are
why this engine is not full of re-introduced defects. Keep the finding; cut the retelling."""
new = """What this does NOT mean: stripping the measurements. The headers that record *what was
played, what broke, and what the number was* are the most valuable prose here and they are
why this engine is not full of re-introduced defects. Keep the finding; cut the retelling.

**And quoting the design owner is retelling.** A ruling belongs in the code as the rule it
is, not as a transcript of the conversation that produced it. One short quote earns its
place when the exact words carry something a paraphrase loses - a distinction, a refusal, a
word chosen over an obvious alternative. Three quotes in one header is a chat log.

Measured, on files written in a single session: seven files carried **72 quoted passages**
between them and ran 51-72% comment by line. The findings in them were worth keeping; the
quotation around the findings was not."""
assert old in s
s = s.replace(old, new, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)

# ── 3. the worst header, trimmed ────────────────────────────────────────
p2 = 'src/engine/cultivation/what-you-refine-in.ts'
s2 = io.open(p2, encoding='utf-8').read()
head_end = s2.index(' */\n\nimport') + len(' */\n')
new_head = """/**
 * WHAT YOU REFINE IN.
 *
 * `recipes.ts` named cauldron quality as an input to a refinement from the day
 * it was written, and there was no cauldron. Every alchemist in the world
 * worked out of the same nothing, and a hall with a six-hundred-year furnace
 * could not be told from a disciple with a clay pot.
 *
 * WHAT IS HERE AND WHAT IS NOT. This file owns what a cauldron is WORTH. Who is
 * allowed to be holding one is `a-house-holds-its-own.ts` - a lent furnace, a
 * lent manual and a lent sword are one fact with three nouns in front of it,
 * and the ruling is that none of it is bespoke to cauldrons.
 *
 * Counted or tracked is `possessions.ts`, unchanged: a mortal-grade pot is one
 * you buy again, and anything above it was made by somebody for somebody and
 * both are answerable.
 *
 * AND IT IS A TREASURE, NOT ONLY A TOOL. The first cut gave every furnace
 * `power: null`, which is the engine saying it is worth nothing in a fight. A
 * cauldron is a sealed vessel of graded material with somebody's qi already
 * running through it; they get thrown up overhead, people get shut inside them,
 * and the good ones are fought over. `defensive` is a tag the ward code already
 * reads, so nothing new says what a stance is.
 *
 * Immortal and chaos grades are sent down rather than made, which
 * `madeBelowTheLid` already decides off the same table it decides for medicine.
 */
"""
s2 = new_head + s2[head_end:]
io.open(p2, 'w', encoding='utf-8', newline='').write(s2)
print('ok')
