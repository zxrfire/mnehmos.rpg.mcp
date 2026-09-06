import io
p = 'AGENTS.md'
s = io.open(p, encoding='utf-8').read()

anchor = "## Nothing in the lore is bespoke"
block = '''## One thing holds state, everything else derives from it

> **A fact lives in exactly one place. Everything that wants it asks; nothing keeps
> its own copy.**

This is the rule the repo most often breaks, and the breakages are expensive because
they do not look like breakages. A second copy of a fact does not fail loudly — it
drifts, and then the world quietly says two different things.

**Measured, in one working session:**

| The fact | Where it was kept twice | What it cost |
|---|---|---|
| What a place's qi is worth | `qiDensity`, `environment.spiritualDensity`, and a hash of the place's NAME | The band was wrong at **78%** of 1065 locations; a ten-year seclusion on the best ground returned 27% of its worth |
| What `sealed` means | An undrawn qi pocket, a locked door, and "this room is an office" — one field, three jobs | **101 of 112** locked rooms reported the richest qi in the game. The discipline hall was the best cultivation ground in the world |
| Whether a life plate is whole | Nearly stored on the plate, beside the person's own `status` | `markDead` has **six** call sites. The one that forgot would leave a whole plate for a dead disciple — which is this world's signature for *somebody is holding them prisoner*. The bug would have read as a kidnapping |
| Who is on a house's roll | `repos.sects` in SQLite, and `NpcRecord.factionId` in world state | A test helper rebuilt the roll from the wrong one and reported that no rung could hold an office when several could |

**So, in order of preference:**

1. **Derive it.** If a fact is a function of another fact, write the function. A plate's
   wholeness *is* its holder's aliveness. A person's disposition *is* what the world
   rolled for them at birth. Deriving cannot drift and has no call site that can forget.
2. **Store it once** — only where the thing genuinely *changes over time* and is not a
   function of anything else. An activity is stored because it changes; a personality is
   derived because it does not.
3. **Never store a second copy** to make a read convenient. Write the read.

**The test that decides which:** *if this drifted from its source, would anything fail?*
If nothing would fail, it is a second copy and it will drift.

### Observers are not the answer

The instinct to reach for an observer or event-bus when state is scattered is
understandable and is the wrong medicine here. Listeners mutating state in response to
other mutations produce order-dependent behaviour, and this engine's core promise is
that a run is reproducible — there is a test by that name. Hidden fan-out is *more*
interaction, not less.

What the projects that solved this actually do is **one store plus pure derived reads**:
Redux keeps a single store with pure reducers and computes the rest in selectors, and
warns specifically against putting derived state in the store; the Elm architecture has
one Model and derives the view; entity-component systems keep components as the only
store and let systems query it; event-sourced designs keep the log as truth and treat
every read as a projection. None of them notify. They recompute.

That is the shape to move toward here, and it is one this repo already uses well in
places — and badly in exactly the places listed in the table above.

## Tests test behaviour, not implementation

> **Pin what the player would notice. Never pin how the engine happened to arrive at it.**

A test that asserts an implementation detail fails when the implementation changes
correctly, and it fails *somewhere else*, which is the expensive part — the failure
names a subsystem that is not the one that moved.

**Worked example, measured.** `reporting-a-false-decree.test.ts` promoted the player to
`ranks.length - 2` and asserted the narration contained the name `Wen Shu`. Both are
implementation: offices are dealt round-robin over the sealed rooms sorted deepest-first,
so *which* rung holds *which* room is an artefact of how many sealed rooms exist. Sealing
one more room — a correct change, made for an unrelated reason — shifted every holder by
one, and the test failed on a name, two subsystems from the edit, having said nothing
about the rule it was there to protect.

The rule it was protecting is: **holding the room is what lets you decide, and holding
the rank is not.** That is behaviour. It could have been asserted directly, and the
sibling test three lines above does exactly that — it checks the refusal says *"the room,
not the rank"* and passes through every reshuffle.

**Concretely:**

- **Pin the observable claim.** "A refusal names the honest route." "A look does not
  write a knowledge record." "The pouch is short and the refusal says of what."
- **Do not pin a name, an id, a rank index, a room, an ordering, or a count** that the
  engine chose for you — unless the choosing is itself what the test is about.
- **Read names out of the output** rather than hard-coding them: *any name the game
  prints is a name the game must accept.*
- **When a test needs a particular arrangement, ask the engine for it** rather than
  reconstructing it. A helper that rebuilds the deal is a second copy of the deal, and
  it will disagree with the real one.
- **A test that cannot fail is worse than no test.** After writing one, break the thing
  it covers and confirm it goes red. Several tests in this repo were written that way and
  say so in their headers.

'''
assert anchor in s
s = s.replace(anchor, block + anchor, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
