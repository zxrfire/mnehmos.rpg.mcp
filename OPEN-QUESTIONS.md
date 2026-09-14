# Open questions

**Short on purpose.** The reasoning behind every ruling is in git
(`git log -p OPEN-QUESTIONS.md`) and in the header comments of the modules that carry it.
Ask me for any of it rather than reading for it here.

---

## Decisions only you can make

Three, and all three are consequences of work that landed rather than things left undone.

1. **Should a hunt offer the beast that is actually standing there?** A beast climbs over world
   time now — a reading off species, ground and years sat, 9.9µs and nothing on the advance.
   The hunt does not know: `whatIsOnThisGround` filters on the **catalog** ordinal, so a hawk
   that has sat on a vein for nine hundred years is still offered and priced at what it was
   minted as. Wiring it changes encounter balance everywhere at once, which is why nobody did
   it without asking.
2. **Should the world be able to take a legacy?** Ground that never shuts is 15.3% of ruins and
   the world has emptied **0 of 10** across 1,800 years, because the gate is a trial and the
   world does not model sitting one. Either that is right — a legacy waits for a person — or
   the world wants a way to consume them.
3. **Is there a lid on the climb?** At a 5,000-year horizon a hawk found at 17 reads as 35 and a
   dragon at 26 as 37. The catalog holds a 38 so it is in range, and nothing caps it.

---

## Work, queued

**Wrong, and known**
- **731 type errors in `tests/`.** `tsconfig.json` excludes it and vitest strips types, so a
  test file is checked by neither command anybody runs. It has now hidden two things: one live
  bug earlier, and — measured this session — that deleting a member of `KnownEntityKind` turns
  no test red. 226 argument-type, 96 unused, 93 unknown-property, 76 possibly-null,
  concentrated in about a dozen files.
- `cultivator.sectRank` is a third copy of your rung, a mirrored string, and it is still what
  every reader but `status` asks.
- A sub-rank advance files nothing, so the widened witness pool covers realm crossings only.
- **A renamed beast does not answer to its old name.** `theNamesThisOneAnswersTo` returns both,
  but `resolveCultivator` scores against `row.name` alone and its candidates carry no tags.
- **Nothing stores a house's knowledge of a door's schedule**, so houses race on the "hears it
  is open" arm rather than the "knows the date" one. That gap is currently the player's edge.
- `whatWouldCloseThisWound` considers only `treat_injury` pills, so the two medicines that
  answer a permanent wound reach the player down a different line.
- A crossing that enriches a ruin's vein moves `qiDensity` and leaves
  `environment.spiritualDensity` where it was — a genuine second copy, predating this session.

**Gaps worth knowing before designing around them**
- A player who only ever takes free actions is never sentenced, because no day passes.
- `whatThisPurchaseWillNotReach` and `alchemy-manage` build a `KnowledgeGate` with no world
  supplier, so if either is ever asked about an NPC it answers off stored rows only.
- Ground nobody has ever walked does not climb, because nothing tracks it. That follows from
  the measured "minted on contact, never seeded" ruling.
