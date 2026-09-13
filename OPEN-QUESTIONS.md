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

**Reachability — things built that nothing routes to**
- `I ask X for Y` does not reach the give-a-piece encounter; only haggle-shaped sentences do.
- **The service rung is unwalkable — nothing records that you did somebody a service.** The one
  changed beast reachable everywhere wants one 93% of the time. Widest gap of the night.

**Wrong, and small**
- Where a posting goes: `aPostingAsAnOffer` takes a `placeName` nobody passes. An elder travels
  to friendly sects in their own faction — a court elder down for the best seedlings, a lower
  elder sending seedlings up.
- `status` should name your house rank when you have one.
- The stallholder should resolve from what happened before in the scene.
- `hunt` cannot spare — it throws `force: 'everything'`, so mercy is unreachable through the
  one verb named for going out after something.

**Gaps worth knowing before designing around them**
- **The beast catalog is 19 species and it is now the binding constraint.** A place resolves to
  a ground as of tonight, so provinces differ (1 → 15 distinct pools). But the Drowned Sea has
  **1** beast, the Yellow Plain and Burial Sands **2** each, and some squares have none. The
  ground work is only worth what the catalog can fill.
- `volcanic` has 3 herbs and no province on the map is volcanic ground, so nothing can ever
  draw them. Either the map wants a volcanic province or the rows want moving.
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
