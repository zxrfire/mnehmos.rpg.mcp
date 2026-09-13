# Open questions

**Short on purpose.** The reasoning behind every ruling is in git
(`git log -p OPEN-QUESTIONS.md`) and in the header comments of the modules that carry it.
Ask me for any of it rather than reading for it here.

---

## Decisions only you can make

Six. Everything else below is work, not a question.

1. **Should giving a piece of yourself be permanent?** Today 150 years' regrowth against a
   5,000-year span reads serious-but-treatable. `isPermanentWound` is wired and fires only at
   the immortal band. Two thresholds are the dial.
2. **Does a species authored `speaks: false` keep its silence after crossing 29?** Ruled as
   gaining a voice, on the grounds that the catalog only spoke about kinds already above the
   line. One function changes if you meant otherwise.
3. **When prospecting unseals a cycled ruin for good, which state wins?** It then reads "shut
   until its season" while `sealed` is false, and nothing re-shuts it. Related: ground the
   discovery engine uncovers at runtime never gets a cycle at all — only catalog ruins do — so
   a door only ever opens on ground that was authored.
4. **Does an NPC body carry wounds?** `NpcRecord` has no injuries array, so the wound from
   giving a piece away is computed, reported, and has nowhere to live.
5. **May a house seize back a thing it BESTOWED, or only call in what it loaned?** You said
   *"the house takes back an artifact they bestowed"*, so both are built, with the loan as the
   preferred route and the seizure as a named, on-the-record escalation. Say if you meant
   loans only.
6. **Compaction, or fewer simulated steps.** You sanctioned both. The world advance is still
   superlinear — 3.7x flatter than it was, and at 400 years 539 of 2,905 people are alive, so
   81% of every population sweep walks the dead. Bounding that array is the cheap half.

---

## Work, queued with what is needed to start

**Wrong, and small**
- **A changed beast cannot name what it wants done.** `createNpc` gives a stood-up beast
  `goals: []`, so a service asked for by one falls back to the player's own sentence for its
  terms. The engine states no want there.
- **`I ask the ape for a tuft of its fur` does not reach the encounter** — `I ask the White Ape
  of the Gorge ...` does. The guard wants nearly the whole catalog name and is shared with the
  haggle road, whose header argues for the strictness.
- **`cultivator.sectRank` is a third copy of your rung**, a mirrored string, and it is still
  what every reader but `status` asks.
- **Nothing writes `knowledge_records.fact_id`** — it is NULL on every row anybody writes, so
  "does this holder hold THIS event" is unanswerable and the telling gate uses a proxy.
- `whereASendingGoes` falls back to `elsewhere` when a reason's houses have no seats, so a
  tribute errand for a seatless subsidiary quietly becomes a ground errand.

**Gaps worth knowing before designing around them**
- **The map has no volcanic ground.** Three herbs grow on it and no province declares it, so
  nothing can ever draw them and no volcanic beast was written. Either somewhere is volcanic
  or the rows want moving — inventing a volcano is lore, so it is yours.
- **Nothing new was added at or above ordinal 29.** The changed-beast population is still 6,
  pinned by `house-protector-pairing.test.ts`, and the sealed-only invariant wants those rows
  strictly above the open-world ceiling. Growing the top is its own decision.
- A sub-rank advance files nothing, so the widened witness pool covers realm crossings only.
- **Nothing in the world acts on two accounts that disagree.** A lie about yourself is written
  now and `provenanceOf` makes the disagreement readable; no NPC reads it, so nobody is ever
  caught.
- **62% of houses cannot reach an open door inside its window**, 1.8% need a fold. That is a
  property of the map — house seats against the link graph — and routing cannot move it. The
  62% are told why now; whether the map should change is a question.
- A sentenced world NPC cannot be sealed: `qiSeal` is a `cultivators` column and `NpcRecord`
  has no equivalent. And a death sentence does not settle the estate, so their artifacts stay
  on the corpse.
- 521 type errors in `tests/`: `tsconfig.json` excludes it and vitest strips types, so a test
  file is checked by neither command anybody runs. Has already hidden one live bug.
