> # 天道无情
>
> The Way of Heaven is without feeling.
>
> Heaven does not reward a good act or punish a bad one. Both are acts. Each has
> effects, and the effects follow from what was done, not from what it deserved.

A rescue and a killing are the same kind of event here. Each is written down, each is
held by whoever holds it, each is read by whatever reads it. The engine computes what
follows. It does not grade.

The world already runs this way:

- A grudge is an account, not a verdict. It records who did what to whom, and what it
  would cost to settle.
- A house's response is read off its alignment and its interest. A righteous house and a
  demonic one both answer; they answer differently, and neither answer is the world's
  opinion of the act.
- Reputation is what people know, not what is true about somebody's character.
- Talent is rolled once. How somebody plays does not change it.
- A rung buys advantage, not exemption.
- Death is permanent for the virtuous and the wicked alike.
- The same seed rules the same way with a model attached and without.

In the code: anything that decides what somebody deserves is a defect. That includes a
fallback that hands out an answer, a narrator that settles an outcome, a check that is
always true, and any figure moved because the attempt was admirable or the sentence was
well put.

This is not an instruction to make the game harsh. Harshness is also a view. The engine
does not have one.

---

# Working agreement

Read [context.md](context.md) first. This is a cultivation RPG exposed over MCP,
retaining the fork's dice, SQLite, worldgen, action-routed tools and NPC runtime.
The model plays the world; deterministic engine code owns persistent consequences.

Read the nearest README before editing a directory; update it with contract changes.
Keep design beside code and setting material in [docs/world/](docs/world/README.md).
`context.md` is an entry point, not a design document. General rules live here;
area instructions live below. Each CLAUDE.md imports its sibling with `@AGENTS.md`.

## The one rule that overrides everything

**The AI narrates. The engine decides.** Before coding, check the boundary:

| Engine authority, backed by SQLite | Model authorship |
|---|---|
| Statistics, progress, realms, probability, breakthroughs, combat, inventory, currency, health, lifespan, death, NPC state and event resolution | Intent interpretation, dialogue, description, presentation and summaries of resolved state |

No model response decides a persisted number or asserts an outcome before its database
change. Keep mechanics pure where possible: state in, deltas out; no input mutation or I/O.
Use seeded samples or named RNG streams, never bare `Math.random()`. New draws get their
own streams; verify existing draws stay identical in a single-command base/change check.
Runs need not replay identically: preserve the sets and purposes of RNG streams, not a
global replay promise. World seeding remains useful and separate from the run seed;
`src/server/state/cultivation-world.ts` owns the persisted world seed. Pin both in tests
that rely on outcomes; use `createWorld({ seed })` to carry a world to another installation.

## The model is the game

LLM play is primary. Judge it by playing with a model, especially conversations;
engine-only play is a debugging/test floor and may be dry and require explicit commands.
The shape is conversation (roughly 30-50%), movement, fighting and cultivation; a conversation
is one-to-one and a face has no name until given. See [the shape of play](docs/world/writing/the-shape-of-play.md).
The engine supplies facts about each person's character, activity, concerns and relationships;
the model voices them. Distinguish people with facts, not atmosphere in engine strings.
If narration reads like engine lines, check `source` on `narrator.narrate` for fallback,
timeout or discarded output before changing prompts. Provider code/name interpretation
belong to [the provider boundary](src/agent/provider/README.md); saved worlds survive switches.

## The agency rule

**Only the world and body limit attempts, never sentence shape.** A limit must name
a world fact (a shut door, missing goods, an interruption) or a bodily fact (lifespan,
rung, root). Refusals carry the actual bound and an honest route, not a vague prohibition.
Seclusion until death is valid; a span beyond remaining life is not. Do not silently
shorten spans, bundle decisions, choose for a lucid player or waive physical cost.
The world interrupts every kind of span and need not wait for a plan to finish.
Intent changes social meaning and consequences, never physical truth: an agreed bout
can kill and leave accounts for breaking its terms.
NPC and player capabilities use the same code in both directions. Check the played path
of every world mechanic; an asymmetry needs its reason beside it. Madness alone removes
choice when the character has lost it; see [engine guidance](src/engine/AGENTS.md#agency-and-madness).
Faction-specific rulings stay scoped to that faction; ask before generalising them.

### A locked door can be broken

Lacking a key does not prohibit force. Resolve against the actual door or seal, using
`src/engine/world/door-materials.ts` and `canUnmake` in
`src/engine/cultivation/whether-a-weapon-survives-being-used.ts`; retain existing seal
strength authorities. Success changes the real barrier and follows ordinary consequences.

## The engine states what can be perceived, not what the record holds

Before adding a scene fact, ask whether somebody standing there could work it out.
Otherwise make it visibly marked, route it through a knowledgeable speaker, or give
observable behaviour and let the reader conclude. Ownership, years spent and ordinal
gaps are not visible merely because stored. Marked house property uses existing plates,
tokens and `house:<id>` tags. Testimony says who knows; observations must not borrow it.
Not being entitled to act is not being unable to see: an accessible shelf/board remains
visible. A refusal states what is here, the gate, and what would change it; access belongs
to the place, not a bespoke visibility rule for each thing inside.

### Player knowledge and character knowledge are different

Human learning survives runs. Named requests for ordinary local facilities, services,
items and practices need no repeated introduction; resolve the route and actual access.
Remembering a house's admission route helps planning, not rung, travel, membership or entry.
A distant name alone supplies no road: let the player ask directions, read that person's
actual knowledge, and teach a route only from an answer through existing knowledge writers.
Use locality, upbringing, occupation, travel, house and learned-event readers, not a new
catalog of who knows destinations. Local facilities and signposted routes keep their access.
An informed request invents no encounter, relationship or record. Hidden/private facts
still need discovery; unsolicited description and testimony stay within perception/learning.

## One thing holds state, everything else derives from it

Derive first; store only what changes independently, once. Before adding any field,
counter or per-entity record, prove it cannot be read from existing state, or explain why.
Track only entities needing identity; a crowd is not a remembered person. Selectors
recompute; do not add notification or mirrored-state schemes. A field answering two
different questions is a defect: separate meanings rather than tune one row around it.
List all writers and count actual values before trusting a field; a reader with no writer
can confidently interpret an empty column. A stored value nobody maintains is the same bug.
Export/import shared facts, names, IDs and constants instead of retyping them. Unrelated
equal values need not share a constant; authored prose still needs a rename sweep.
Guard critical shared literals with a test that rejects copies outside their owning module.
Balance constants live in `src/schema/cultivation.ts`; ladder bounds in
`src/engine/cultivation/realms.ts`. Import them and never restate the ladder's size in prose.
SQL and save lifecycle rules are in [storage guidance](src/storage/AGENTS.md).

## Nothing in the lore is bespoke

Lore describes generic systems, never adds exceptions or arithmetic. No faction-, title-
or importance-specific combat rule and no parallel catalog for special objects: use
`src/data/cultivation/artifacts.ts`, `makeObject` and ordinary `power`. Remove the object
and its holder must be ordinary at their ordinal. When resolver and prose disagree,
correct prose in the same change and cite the harness; do not tune the world to a story.

**Nothing in this world is invincible: a rung or capability buys advantage, never exemption from being killed.**
Combat/injury details are in [engine guidance](src/engine/AGENTS.md).

## A name evokes what it is, and is tellable from every other name

Read [tone](docs/world/writing/tone.md#naming-conventions), [place names](docs/world/writing/place-names.md)
and the header of `src/data/cultivation/regions/ruin-and-scar-names.ts` before naming.
A name evokes its effect and keeps the word a player would type (healing sounds restorative).
Check distinctive words against houses, ranks, places, regions, arts, items, beasts and
people, including inflections, phrase words, synonyms and translated meanings. Names
are English; surnames and units may retain their own forms. Type nouns belong to one
kind and may repeat within it; address words such as Elder, Master, Servant and Disciple
may repeat. Distinctive words may not collide, even in different contexts.
Names, including generated word lists, must not collide with verbs, everyday question
words or fuzzy/one-edit matches. Verbs win over items; rename the item if needed.
Replace generated words one for one to preserve draws. Rename consistently across catalogs,
prose, IDs and tests, guarding against replacement inside longer names.

### One word, one meaning, everywhere

A word has one meaning across fields, verbs, categories, IDs, names and prose. Context
does not free a taken word. Keep its established/common owner; rename other uses with
genre vocabulary. Check new category words against existing names. A generous target
resolver and an exact reader deciding what happened ask different questions: document
why they differ and never reuse permissive matching as evidence of an event.
Reserved meanings: cauldron/pill furnace = alchemy vessel; cultivation furnace = person;
artifact furnace = forge. Bare furnace names nothing.

## Look before you build

Start with [the situation index](docs/world/INDEX.md), using its `trigger` questions;
use [BY-HOUSE](docs/world/BY-HOUSE.md) for a house. Read the target doc in full and the
comment beside any catalog value before changing it. Search all `src/` by concept,
state and genre synonyms, not just identifiers or the consumer's directory. Read plausible
owners' READMEs. If a search misses an existing answer, add its question to the index.
Say "I did not find it", not "it does not exist"; raise doc/brief conflicts before building.
Reuse the answer or move it completely; do not write another opinion beside it.
Name the live caller before building and reach it in play afterwards: an import, register
page or test is not proof of execution. `scripts/find-unwired-exports.mjs` helps find gaps.
Enforce realm grants at their actual consumers, including abilities broken crossings deny.
Inspect literal fallbacks (`?? '...'`) for unfinished lookups; check guards against the
callee's actual return type (`null` differs from `undefined`; `== null` covers both).
Fix the demonstrated gap; avoid speculative categories that swallow adjacent verbs.
Reads run both ways unless information loss or absent source facts prevent inversion; write why.

## The smallest test that keeps it true

Pin observable behaviour, not chosen names, IDs, rank indices, counts or order unless that
choice is the rule under test. Ask the engine for arrangements and read names from output.
Use focused mechanics tests, fewer integrations and few played tests; use live models only
for what needs them. Prove a new guard can fail by breaking its covered behaviour.
Deliberate numeric design decisions need named tests and reasons. Tests may be rewritten
or removed when design changes; state the replacement rule and update name/header together.
Never loosen a test merely for green. See [tests/AGENTS.md](tests/AGENTS.md).

## Measuring, and being honest about what you measured

Check `git status --short` before measuring. Name revision, build, configuration and
relevant uncommitted work; rebuild/restart stale `dist/` before reporting. Measure state/DB,
not narration. Check real fields, endpoint errors (including a live run's 409), and caller
configuration; missing fields are not zero. Reproduce reports before acting or relaying;
correct wrong reports with evidence, especially before retuning shared constants.
Use legal sheets from `src/schema/cultivation.ts` (Might <= 3, Insight <= 4), equal treatment
of both sides, filtered joins and controlled tables. A stalemate is not a loss. When a
complicated probe disagrees with a simple control, inspect the harness first.
Run both comparison arms back-to-back in one command on identified trees; never stash/rerun
or revert a shared file as a control. Registered detached worktrees belong under
`.claude/worktrees/<task>`; use `git worktree`, not copies, and remove them when done.
If isolation is impossible, report no delta; use a tree-independent proof instead.
Pool both arms over enough fixed seeds for rare/individual outcomes; never compare a new
arm only against the old arm's spread or widen a bar to absorb noise. Large populations
can disprove an ordering on one seed. Separate seeded residents, real arrivals, inflow,
outflow and volume. Changes to draw consumption date a new world; post-advance figures
across that boundary are incomparable, while unaffected seeding figures may compare.
For bulk edits count actual entities before/after, not just diff lines. Mid-write readings
are not measurements; mark unreproduced findings unresolved and investigate them.
Validate new checkers on known answers, including coverage/partition, before trusting
unknowns. Success says a command ran, not what it inspected. Update contradicted prose with
traceable evidence; record engine absences beside affected material, not as tuning facts.

## Conventions and brevity

- TypeScript ESM/NodeNext: relative imports end in `.js`; named exports only.
- Zod defines boundary contracts; persisted state round-trips through it.
- Give files one reason to change and a short descriptive noun phrase, usually 2-3 words.
  Split subjects; a one-list catalog is fine, a multi-kind catalog mirrors its structure.
  Barrels only re-export. Leave old sentence filenames for a separate naming sweep.
- Split by moving, never rewriting: no incidental fixes, function renames or reordered
  logic. Compare serialized catalogs before/after data moves. In a busy tree leave a
  re-export at the old path rather than edit others' importers.
- Say it once, in the fewest words that keep it true, across docs, comments, tests and commits.
  Comments explain why, hazards, measurements or necessary ordering, not the code beneath.
  Prefer clear names to explanations. Section banners may separate long files' concerns.
- Keep findings/provenance; cut retellings and paraphrase owner rulings. One short
  quotation earns a place only when exact words matter. Files state current rules; git
  holds history. An attractive failed approach may survive as a concise forward warning.
- Use plain hyphens, never em-dashes or en-dashes, anywhere in the repository.
- Re-read prose around changes and grep for affected claims elsewhere. Update stale
  comments, examples, measurements and docs in the same change; rules stand without examples.
- Indexes point in one line; they do not restate. Generate large indexes and check links.
  Every code folder has a README; group large directories by subject. File tables come
  from opening lines via `scripts/folder-index.ts`.
- The coordinator keeps `OPEN-QUESTIONS.md` for unanswered owner decisions: one-line-answerable
  items with needed facts and blockers; delete answered items and put rulings by enforcement.
  A short in-flight table is allowed. No completed-work narrative or measurement archive.
- Scratch names include the task; the scratchpad is shared. Capture significant numbers in reports.

## Commands and shared machine

Use PowerShell for npm/git on Windows and `npx.cmd` to avoid execution-policy blocks.
Tests, builds, typechecks, benchmarks, simulations and local-model calls run sequentially;
capture output to a file and wait for existing work, never rerun to recover a summary.
Budget current free RAM including resident models and the owner's work, not installed RAM.
Coordinate heavy-run ownership; idle appearance is not a handover. Keep worker fan-out
bounded (a handful, never multiplicative); all processes count. Work yourself at capacity.

Wrap heavy commands with `node C:/Users/hi/.claude/tools/heavy-run.mjs -- <command>`.
The runner's slot/RAM gates do not authorise extra concurrent heavy work. After any
pattern/regex edit, run [the control-character check](src/web/AGENTS.md#after-editing-any-pattern-run-the-control-character-check).

```powershell
# Prefix each command with the heavy runner above.
npx.cmd vitest run tests/engine/cultivation  # your area + affected integrations
npm.cmd test                               # full suite once before landing
npm.cmd run typecheck                      # production only
npm.cmd run typecheck:all                   # tests/scripts via tsconfig.all.json
npm.cmd run build
npm.cmd run build:binaries                  # dist-bundle/
```

While iterating, run affected integrations (`tests/web`, `tests/server`) as well as units.
Before landing code, verify full suite and typecheck in one unchanged pass in a clean
detached worktree; wait if others are editing. `VITEST_MAX_FORKS` defaults to 4; raise only
when the machine is yours alone. Docs-only work needs appropriate link/content checks.
Record PIDs at launch and kill only your own trees (`taskkill /F /T /PID <pid>` or
`kill -- -<pgid>`). Never kill by image name or sweep Node/Vitest processes. If ownership
is unclear, ask. Launch/play commands are in [README.md](README.md).

## Commits and parallel ownership

Commit messages use `feat(scope):`, `fix(scope):`, `test(scope):` or `refactor(scope):`.
Local passing work may be committed without asking, subject to the current task's permissions.
`origin` is `zxrfire/mnehmos.rpg.mcp`; work normally lands on `feat/xianxia-cultivation`.
Use isolated branches only when needed and land promptly. Never push/open PRs against
`upstream` (`Mnehmos/mnehmos.rpg.mcp`); it is read-only, and commands naming it need the
owner's explicit request. Preserve ancestry: no orphan branch, re-init or squash to a new
root. Necessary history cleanup rewrites in place; force only an authorised branch,
never `main` or `upstream`.

The coordinator assigns files and owns merges. Work only in your set; request cross-file
changes through the holder/coordinator. Do not fix another owner's mid-edit errors, revert
their work for green tests, or commit their dirty paths; deliver the rest and report the block.
Shared schema/realms/spirit-roots changes are proposals; shared migration/tool registries
receive only the minimal addition. Before discarding, inspect every hunk; undo only yours.
Never use repository-wide stash for arms. Commit new modules with their first importers.

Read `git status --short` in its own call before staging/committing. No `git add -A`,
`git commit -a` or bare shared-index commit. Ignore generated artifacts by pattern, not deletion.
A commit pathspec still takes others' unstaged edits in shared files; it is insufficient.
Use a task-private `GIT_INDEX_FILE`; refresh from HEAD immediately before staging your
blobs and committing. For contested files, reverse-apply others' hunks with normal context
to a compiling copy; never `git apply --cached --unidiff-zero`. Edit the working file too:
hashing/staging a blob does not update disk. Verify the staged blob before committing.
Afterwards inspect the actual commit's files/count/blobs and compare disk; refresh the
shared index for only your committed paths with `GIT_INDEX_FILE` unset, then verify their
cached diff is empty, including after push. `MM` can expose a staged revert. If a commit
sweeps others' work, tell them immediately; do not rewrite a pushed commit they may use.
An unpushed accidental commit can recover with `git reset --soft HEAD~1`; verify
others' index entries and untracked files survived. Use shell-appropriate quoting and
`git commit -F <message-file>` for multiline messages.
Before diagnosing `--ff-only`, inspect the current branch and worktree list; rebase onto
the named target, not assumed HEAD. Move a target ref with `git branch -f` only if it is
checked out nowhere. Verify landing by `git branch --contains <hash>`, not a report.

## Area guidance

Load the applicable file when crossing into an area, including tests or catalogs for it:

| Path | Covers |
|---|---|
| [src/engine/AGENTS.md](src/engine/AGENTS.md) | Traits, combat, injury, madness, knowledge, wants and institutions |
| [src/engine/world/AGENTS.md](src/engine/world/AGENTS.md) | Population, shelves, simulation clocks, rates and draws; also seeding/advancement changes elsewhere |
| [src/web/AGENTS.md](src/web/AGENTS.md) | Turn phases, intent, plans, fallback, narration, prompts, verb surface and ADMIN |
| [tests/AGENTS.md](tests/AGENTS.md) | Behaviour, living headers, long walks, rate tests, corpus, harness and TDD |
| [src/storage/AGENTS.md](src/storage/AGENTS.md) | State authorities, transactions, SQL literals and disposable saves |
| [src/server/AGENTS.md](src/server/AGENTS.md) | MCP tools and handlers spending world days |
| [docs/bastion/AGENTS.md](docs/bastion/AGENTS.md) | Separate game's vocabulary and sweep boundary |

Build-wrapper rules are in [scripts/README.md](scripts/README.md#the-shipped-binary).
No new subsystem until the [500-year acceptance test](src/engine/world/AGENTS.md#the-acceptance-test) holds.
