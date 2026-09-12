<!-- tier: 3 -->

# writing

How this world is written, rather than what is in it.

**Start here before writing player-facing prose.** The narrator constitution
itself is [`../NARRATOR-CORE.md`](../NARRATOR-CORE.md), which stays at the top
of `docs/world` because the engine loads it at run time.

| File | What it answers |
|---|---|
| [`escapes.md`](escapes.md) | characters that must not appear in prose |
| [`place-names.md`](place-names.md) | what a place, house, item or art is called, and the two renames that were rejected |
| [`how-the-prose-moves.md`](how-the-prose-moves.md) | how the prose MOVES: paragraph length, clause shape, who talks, where the beats fall |
| [`tone.md`](tone.md) | the voice: what it does and what it never does |
| [`what-changes-as-the-ladder-is-climbed.md`](what-changes-as-the-ladder-is-climbed.md) | what the register owes to height: rung is reach, and knowledge belongs to whoever is asked |

---

Indexes: [`../INDEX.md`](../INDEX.md) by situation,
[`../BY-HOUSE.md`](../BY-HOUSE.md) by house.
Both also reach the design prose in `src/data/cultivation/`.

---

## Where else to look

- [`../../../src/web/README.md`](../../../src/web/README.md) - where these rules are enforced
  in code. `prompt.ts` is the one module to tune when the prose is wrong; `narrator.ts` is the
  wall between what the engine decided and what the narrator may say.
- [`../../../AGENTS.md`](../../../AGENTS.md) - the repo-wide version of the same discipline:
  the engine states facts and the narrator writes sentences, and an engine string that
  forecasts, infers or sets a mood is the immersion defect.
- [`../../verbs.md`](../../verbs.md) - every verb a player can reach, in a player's own words.
- [`../../../src/web/what-each-verb-is-for-in-the-players-words.ts`](../../../src/web/what-each-verb-is-for-in-the-players-words.ts) -
  the same thing as code, which is what the model is actually shown.
- [`../NARRATOR-CORE.md`](../NARRATOR-CORE.md) - the text that IS auto-injected, as opposed to
  everything else in this tree, which is reference for people and agents.

