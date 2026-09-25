<!-- tier: 3 -->

# `src/engine/people` - there is one kind of person

> **Tier 3 - reference.** The contract of the code beside it. Never auto-injected into a
> narration prompt.

A human being is stored in **two** places in this repo - a `Cultivator` row for anybody a run
is being played through, and an `NpcRecord` in world state for everybody else. That is drift
being worked off, not a design, and it is **not** merged here.

**What is merged is the READ**, one question at a time, so that a question asked of a person
is answered the same way whichever table they came out of:

| export | what it answers |
|---|---|
| `everybodyDrawingHere(...)` | everybody standing on this ground, both tables at once |

A general `Person` read (name, age, rung, where) was written beside it and nothing asked it, so
it went. The next question both stores have to answer the same way belongs here.

**Why the read and not the storage.** The storage merge is expensive and the read is cheap,
and every verb written before the read is unified has to be written twice - once with an
`if (stored)` inside it, and again when the tables merge.

**Where the two genuinely disagree:** satiety, starvation, bleeding, cultivation progress,
battle counters and achievements are a RUN's facts about a person, not the person's own. The
run sheet wins where there is one; where there is none, the world's derivation answers.
Nothing here invents a value for a fact only a run can hold.

## Where else to look

- [`../world/README.md`](../world/README.md) - the other half: `NpcRecord` and every function
  over it live in `world/npc-state.ts`, and `world-state.ts` is how you get one
  (`getNpc`). `PLAYER_ROW_TAG` and `isTheWorldsToMove` are how a world row that is the player
  is told apart from one the world moves.
- [`../../schema/README.md`](../../schema/README.md) - the run side: `Cultivator` is a Zod
  shape in `schema/cultivation.ts`. `NpcRecord` deliberately is **not** a schema type, which
  is why grepping `schema/` for the NPC shape finds nothing.
- [`../../web/README.md`](../../web/README.md) - the only consumer today
  (`web/turn-engine.ts` calls `everybodyDrawingHere`). A verb that asks "who is here" should
  come through this file rather than reading either table directly.
- [`../../storage/repos/README.md`](../../storage/repos/README.md) - `cultivator.repo.ts` and
  `world-state.repo.ts` are the two tables under the split, and
  `folding-a-persons-two-knowledge-keys-into-one.ts` in `../../storage/` is the same problem
  on the knowledge side.
- [`../social/README.md`](../social/README.md) - what a person knows, believes and remembers
  about other people. Identity is here; everything social about that identity is there.
