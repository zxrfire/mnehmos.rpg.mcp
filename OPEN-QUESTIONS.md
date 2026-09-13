# Open questions

**Short on purpose.** The reasoning behind every ruling is in git
(`git log -p OPEN-QUESTIONS.md`) and in the header comments of the modules that carry it.
Ask me for any of it rather than reading for it here.

---

## Decisions only you can make

Five. Everything else below is work, not a question.

1. **Should giving a piece of yourself be permanent?** Today 150 years' regrowth against a
   5,000-year span reads serious-but-treatable. `isPermanentWound` is wired and fires only at
   the immortal band. Two thresholds are the dial.
2. **Does a species authored `speaks: false` keep its silence after crossing 29?** Ruled as
   gaining a voice, on the grounds that the catalog only spoke about kinds already above the
   line. One function changes if you meant otherwise.
3. **When prospecting unseals a cycled ruin for good, which state wins?** It then reads "shut
   until its season" while `sealed` is false, and nothing re-shuts it.
4. **Does an NPC body carry wounds?** `NpcRecord` has no injuries array, so the wound from
   giving a piece away is computed, reported, and has nowhere to live.
5. **Compaction, or fewer simulated steps.** You sanctioned both. The world advance is still
   superlinear — 3.7x flatter than it was, and at 400 years 539 of 2,905 people are alive, so
   81% of every population sweep walks the dead. Bounding that array is the cheap half.

---

## Work, queued with what is needed to start

**Reachability — things built that nothing routes to**
- ~~The two roads to an open door. `beingAtADoorOnTheDayItOpens` has no caller.~~ Routed:
  `walking-up-to-a-door-that-closes.ts`, called from the travel arrival and from standing
  outside found ground. The 36% / 1.8% / 62% is a property of the MAP, unchanged by routing
  and re-measured at 36.2 / 1.8 / 62.1; what moved is that the 62% are now told why.
- Five of judgement's seven sentences have no instrument. Notably, taking back what a house
  gave has **no recall function anywhere** — the gift/loan split is real and nothing claws back.
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
- Interior links cost 0 days by design (a hall to the next room is not a day), so the old
  "1,638 of 2,486 links cost 0" reading was mostly correct and mostly not a defect. What WAS
  one is now fixed: the catalog stated 2 intra-province roads in the whole world, so every
  journey inside a province cost a flat day. 102 pairs are priced now, 1-32 days.
- **The beast catalog is 19 species and it is now the binding constraint.** A place resolves to
  a ground as of tonight, so provinces differ (1 → 15 distinct pools). But the Drowned Sea has
  **1** beast, the Yellow Plain and Burial Sands **2** each, and some squares have none. The
  ground work is only worth what the catalog can fill.
- `volcanic` has 3 herbs and no province on the map is volcanic ground, so nothing can ever
  draw them. Either the map wants a volcanic province or the rows want moving.
- A sub-rank advance files nothing, so the widened witness pool covers realm crossings only.
- ~~Nothing writes a `fabricated` knowledge row for somebody inventing an account of
  themselves~~ — closed. `an-account-of-yourself.ts`: `tell` carries an account of the
  speaker, the hearer holds it and the speaker holds having given it, and the world's own
  people do it at a seeded rate where they give their name. What is still missing is a way
  for a hearer to ACT on two accounts that disagree - `provenanceOf` makes the disagreement
  readable and nothing in the world reads it yet.
- 521 type errors in `tests/`: `tsconfig.json` excludes it and vitest strips types, so a test
  file is checked by neither command anybody runs. Has already hidden one live bug.
