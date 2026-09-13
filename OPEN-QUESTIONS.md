# Open questions

**Short on purpose.** The reasoning behind every ruling is in git
(`git log -p OPEN-QUESTIONS.md`) and in the header comments of the modules that carry it.
Ask me for any of it rather than reading for it here.

---

## Being built right now

| | |
|---|---|
| a compound you can travel to, the town outside it, the gate, the guest road, sneaking in | agent |
| inviting somebody to travel with you, and a party the engine can state | agent |
| a beast with a core is somebody, and helping one leaves a trace | agent |
| the sim getting dearer as the world ages: compaction, indexes, fewer simulated steps | agent |
| a recipe gates on material and consumes what it names | agent |
| asking a changed beast for its own fur or shell, and what giving costs it | agent |

---

## Queued, with everything needed to start

- **A cycled ruin that prospecting unseals for good is never re-shut.** `applyConvergences`
  needs `sealed` to re-open one and the `open_now` tag to re-shut it, so a ruin the
  prospecting pass opens permanently reads as "shut until its season" while `sealed` is
  false. Pre-existing; needs a ruling on which state wins.
- **The two roads to a door are priced and not routed.** `beingAtADoorOnTheDayItOpens`
  has no caller — a senior escorting juniors deep enough, or a junior spending a slip to
  arrive. Measured: 36.2% of houses can walk in and out inside a window, 1.8% need a
  fold, 62.1% cannot make it; at a 7-day window the walkable share is 0-8%.
- **The map has no distance in it.** 1,638 of 2,486 links cost 0 days and only 12 links
  in the world cost more than 2, so nothing can be tight against a crossing. Worth
  knowing before any feature is designed around travel time.
- **Five of the seven sentences have no instrument.** Judgement decides correctly and only
  the rebuke and the fine are carried out. The gap worth knowing: taking back what a
  house gave has NO recall function anywhere — the gift/loan split is real (`how:
  'awarded'` vs `'lent'`) and nothing claws anything back. The rest are routed by name in
  `WHO_CARRIES_IT_OUT` and surface as `notCarriedOutHere`, never as a silent success.
- **A sub-rank advance files nothing at all.** `worthRecording` excludes ordinal
  promotions deliberately — 13 rows per Qi Condensation life — so the widened witness
  pool only applies to realm crossings. Flagging because the ruling mentioned them.
- **Where a posting goes.** `aPostingAsAnOffer` takes a `placeName` nobody passes. Ruled:
  an elder travels to friendly sects in their own faction, above their apex or below — a
  court elder going down to pick the best seedlings, a lower elder sending seedlings up.
- **`status` should name your house rank** when you have one.
- **The stallholder should resolve from what happened before** in the scene rather than
  needing a roster row.
- **`TIER_NAMES.dismissed` is `'Not posted'`** for work that is now posted and takeable.
- **Nothing writes a `fabricated` knowledge row for somebody inventing an account of
  themselves** — the cover story, and the only thing that would let a local catch a changed
  beast or a wanderer under a false name later.
- **521 type errors in `tests/`.** `tsconfig.json` excludes `tests/` and vitest strips types
  without checking, so a test file is checked by neither command anybody runs. It has
  already hidden one live bug.
