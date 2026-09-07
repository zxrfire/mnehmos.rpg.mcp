FINAL BUILD PLAN — 13 commits. Corrections to all three judgements are marked [CORRECTION].

═══════════════════════════════════════════════════
WHAT I MEASURED, AND WHAT IT BREAKS
═══════════════════════════════════════════════════

[CORRECTION 1 — DECISIVE] All three judgements open with "delete the actor/process tier, get the ratchet green, no architecture lands until then." That gate is arithmetically impossible and would block the refactor permanently.

Measured now, deterministic across three runs on the current tree:
  dead = 191, testOnly = 566   against   DEAD = 171, TEST_ONLY = 496
  red by 20 and by 70.

The actor/process tier contributes exactly 3 dead (activeProcesses, endProcess, grantKey) and 5 test-only (makeActor, moveActor, setActorFaction, startProcess, adjustResource). That is 3 of 20 and 5 of 70. Of the 566 test-only exports, 254 are in src/data/cultivation/* — authored catalogue content, which the ratchet's own header names as one of its three legitimate categories ("design deliberately stated as data"). Deleting them is a content regression, not a refactor. No subtraction available anywhere inside this refactor closes 70.

So the gate is restated: THIS REFACTOR NEVER RAISES EITHER NUMBER, AND EVERY STRUCTURAL COMMIT LOWERS `dead` WHERE IT CAN. Whether the ceilings are wrong is a separate question for a separate commit, and the evidence says the tree regressed after they were set rather than that they were mis-measured — the file itself asks for a re-measure on a quiet tree, and the quiet-tree number is HIGHER.

Also: the number is not stable across minutes. I read 188 then 191 on the same tree within one session, and there is an untracked `src/engine/world/what-a-house-will-spend-on-the-war-it-is-in.ts` carrying 3 dead exports that was not there when this session started. Another agent is landing on this tree right now. Treating the ratchet as a per-commit gate on a shared tree reproduces exactly the failure its own header describes.

[CORRECTION 2] The suite is ALREADY RED. `tests/docs/design-does-not-go-unwired.test.ts` fails today, before anything is written. "Every commit leaves the suite green" cannot be the acceptance criterion. The honest one, from commit 1: `npm test` shows THE SAME FAILURES BEFORE AND AFTER, PLUS THE NEW TEST THE COMMIT ADDS. Commit 1 is the one that makes that legible.

[CORRECTION 3] The death transition double-flushes the world. `settleTheEstateIfTheyDied` ends `if (settled.worldDirty) this.worldDirty = true;` (turn-engine.ts:12159) and `act()` then flushes at :2013. Wrap the death in a transition that calls appendWorld and the turn writes the world twice; the "one death, one commit" test reads 2 and nobody knows why. The death transition must clear `this.worldDirty` on success. No judgement says this.

[CORRECTION 4] The async decomposition nobody stated, without which commit 7 stalls at its first await. `commitOneTransition` is synchronous — correct, better-sqlite3 cannot span an await. `advanceWorldForCultivator` is async, but ONLY for `worldHandleFor` and `beginRunInWorld`; `catchUp`, `advanceWorldForPlay`, `appendWorld` and `writeObligations` are all synchronous (verified, cultivation-world.ts:375-416). The fold therefore requires splitting it into an ASYNC PROLOGUE (acquire handle, record run) and a SYNC BODY the transition runs. State it or the step fails on contact.

[CORRECTION 5] `settleWhatTheyWereCarrying` and `settleTheEstateIfTheyDied` are both synchronous (verified). Commit 3 is therefore genuinely landable without touching `act()`'s await structure — the one place all three plans were right and none had checked.

[CORRECTION 6] Judgement 3's recount is wrong. `worldLocationFor(` is 34 call sites, not 48. `present(`/`othersPresent(` is 60, not 52 or 57. `worldDirty = true` is 29, `.transaction(` is 85, test files 617 — those three are right.

═══════════════════════════════════════════════════
THE COMMITS
═══════════════════════════════════════════════════

── COMMIT 1 — DELETE THE TIER NOTHING CAN POPULATE. Lands today. Nothing is added. ──
WHAT: The actor/process tier is structurally unpopulatable, not merely unused: `makeActor` has 0 src callers, `state.processes` has no pusher anywhere, `upsertActorInPlace` is reachable only with an actor `getActor` could only return if it were already there, and all three tables hold 0 rows. Delete ActorWorldState, DurableProcess, ProcessOutcome, state.actors, state.processes, makeActor, upsertActor, moveActor, setActorFaction, adjustResource, addItem, removeItem, grantKey, getActor, startProcess, endProcess, activeProcesses, upsertActorInPlace; `advanceTime` stage 2 (time.ts:355-384); `writeActors` and `writeProcesses` and their loader reads; the three tables, via the additive-migration pattern already used in migrations.world.ts. Also delete `recordEvent` (world-state.ts:758), `recordMajorEvent` (history.ts:359) and `event_logs` (0 rows, 0 writers), and rewrite the A5 row of docs/bastion/02-engine-integration-spec.md in the same commit so nothing points at a deleted ledger. KEEP `StateChange`/`MutationResult` — retargeted in commit 4.
FILES: src/engine/world/world-state.ts, time.ts, history.ts; src/storage/repos/world-state.repo.ts; src/storage/migrations.world.ts, migrations.ts; docs/bastion/02-engine-integration-spec.md. ~8 src files.
PROVES: `node scripts/find-unwired-exports.mjs` falls by 3 dead and 5 test-only, measured before and after IN THE SAME MINUTE (the tree moves). Several hundred lines out, zero in.
GREEN AFTER: everything that was green stays green. `tests/engine/world/world.test.ts` loses ~15 assertions (the only test file in the repo touching actors or processes — verified). The ratchet still fails, by 17 and 65 instead of 20 and 70, and the commit message says so in those words.
DRIFT: 5, outright and permanently.

── COMMIT 2 — THE PACKAGED BINARY CAN NEST. ──
WHAT: `esbuild.config.mjs:200-243` replaces `Database.prototype.transaction` with bare BEGIN/COMMIT/ROLLBACK, no SAVEPOINT, no depth counter, no `inTransaction` getter (read, confirmed). Nesting is ALREADY load-bearing: sect-manage.ts:583 wraps sect.repo.ts:200; apply.ts:78 wraps cultivator.repo.ts:602 and :649. So joining a sect, and any seclusion that gains a realm or kills the player, throws `cannot start a transaction within a transaction` in the shipped binary today and vitest is blind to it by construction because it loads the real module. Extract to scripts/packaged-better-sqlite3-driver.mjs; give transaction a depth counter with SAVEPOINT tx_n / RELEASE tx_n / ROLLBACK TO tx_n, plus inTransaction.
FILES: esbuild.config.mjs, scripts/packaged-better-sqlite3-driver.mjs (new, net neutral — it is moved code), tests/storage/a-transaction-inside-a-transaction-still-rolls-back.test.ts (new).
PROVES: one test imports BOTH drivers and runs the same three-deep nest with an inner throw against each. It fails on the shim before this commit.
GREEN AFTER: same as commit 1, plus one new passing test. NON-NEGOTIABLY BEFORE COMMIT 3 — every commit after this one makes nesting universal.

── COMMIT 3 — THE BOUNDARY, AND DEATH THROUGH IT. ──
WHAT: Three files in src/server/state/, which is already the only door to world persistence and the only place that can hold `CultivationRepos` and the world repo at once. [CORRECTION] THREE, not four — `domain-commands.ts` and `domain-events.ts` collapse into one `src/schema/transitions.ts` until there are four members between them; two schema files for one union member each is the shape the ratchet exists to catch.
  transition-context.ts — TransitionContext { repos, world, run, revision, onDay, emit, markWorldChanged }. No store. The owner's sentence at the top: SQLite is the state; Redux is only the model for how it changes.
  transition-runner.ts — commitOneTransition, SYNCHRONOUS BY CONSTRUCTION, and the type says so. Reserve revision → db.transaction(body → project events → appendWorld if marked → write revision) → on throw, forgetWorld(worldId) and rethrow, because SQLite rolls back and a JavaScript object does not (turn-engine.ts:8004 is the bug this exists to make impossible).
  world-revision.ts — a NEW guarded-ALTER column on world_runtime. NEVER world_runtime.version: verified live at world-state.repo.ts:652 (loadWorld) and :664 (listWorlds), written at :1289 — it is the schema version the loader migrates against, and putting a second meaning on it commits drift 2's sin while claiming to fix drift 6.
  [CORRECTION] world_revision LANDS WITH ITS READER IN THIS COMMIT, not two phases later. The reader is a staleness check in `worldHandleFor`: `loaded` is a process-global Map (cultivation-world.ts:54) and nothing revalidates it, so a cached handle whose stored revision is behind the row is evicted rather than trusted. Without that, `readWorldRevision` is a dead export added by a refactor whose first commit was supposed to lower the count.
  Two hard rulings, written into transition-runner.ts: (a) WorldAtHand.write is `appendWorld` and only ever `appendWorld` — `saveWorld` clears 25 tables before re-inserting and stays lifecycle-only at its four sites; a reviewer who "unifies the two write modes" destroys a world. (b) No new event table. `event_logs` was deleted in commit 1, not promoted.
  First cut: `settleTheEstateIfTheyDied`. `settleWhatTheyWereCarrying` is NOT touched — its writes are byte-identical, only the commit boundary moves, which is why its existing 244-line test passes unmodified. Verified: today it commits five times with zero transactions — enshrineRun (RAM), upsertObject (RAM), upsertNpc (RAM), ledger.write (bare), emptyTheBody (two bare statements). And the transition CLEARS this.worldDirty on success (Correction 3).
FILES: 3 new in src/server/state, 1 new in src/schema, edits to turn-engine.ts (2 methods), cultivation-world.ts (export writeTheWorldNow/forgetWorld), migrations.world.ts. ~7 files.
PROVES: tests/web/a-death-commits-once.test.ts — three assertions. Green path: revision advances by exactly 1, and the grave and the fact read back through a FRESH WorldStateRepository, not off the in-memory handle. Torn path: make emptyTheBody's second statement throw — the cache is NOT written, the pouch is NOT empty, the revision did NOT advance. That assertion fails on its first line today. Idempotence: settle twice, nothing moves twice.
GREEN AFTER: tests/web/estate-settlement.test.ts unmodified. First time in this codebase a SQLite write and a WorldState write have shared a commit.

── COMMIT 4 — ONE OBLIGATION WRITER, AND EVENTS BECOME A SHAPE. ──
WHAT: Delete `writeObligation` (encounters.ts:662, 33 call sites) in favour of `writeObligations` (obligation.repo.ts:141) — identical 23-column INSERT OR REPLACE, and the repo header already asks for it — and give the survivor a transaction; it is a bare loop of N autocommits today. Retarget `StateChange` off the deleted state.actors onto npcs/factions/locations/objects as `FieldChanged`. `projectEvent` writes ONLY where a reader already exists: `appendWorldFact` (the 37-caller chokepoint) for the fact, `writeObligations` for the accounts, both inside the transition's transaction. Strike docs/bastion/02-engine-integration-spec.md:54 ("Phase 2: invert") in this commit with the reason written in: event sourcing requires that replaying the log reproduce the state, and the owner released reproducibility, so a log of what happened is a record and not a recipe.
FILES: encounters.ts + ~12 src/web call sites, obligation.repo.ts, world-state.ts, event-projections.ts (new), the spec doc. ~16 files. Net: one writer deleted, one small file added.
PROVES: grep for the second INSERT returns nothing; an existing obligation test passes against the surviving writer.
GREEN AFTER: green. Adds nothing the ratchet counts (projectEvent has a caller in the same commit).

── COMMIT 5 — ONE TIME-SKIP WRITER. This is a behaviour change wearing a refactor's clothes. ──
WHAT: cultivation-manage.ts:686-782 is a second copy of apply.ts:78-199, differing in six ways. Fold the three load-bearing ones into applyTimeSkip FIRST — persistImmortalStatus, persistVisions, recordRankGained — then delete the copy and collapse the third route at crossing.ts:248 with its `as never` cast. The play loop does not write immortal_status today and migrations.cultivation.ts:68-72 says that column is what enforces the Lid bar, so this makes the play loop start enforcing a bar it has never enforced.
FILES: apply.ts, cultivation-manage.ts, crossing.ts. 3 src files.
PROVES: one test asserts a last crossing resolved on the PLAY loop writes immortal_status. It fails before.
GREEN AFTER: NOT green without argument. `handleCultivate` has zero direct test references, but tests/server/cultivation-tools.test.ts, tests/web/game.test.ts, tests/web/misparse.test.ts, tests/engine/cultivation/crossing.test.ts and last-crossing.test.ts all reference immortalStatus and some pin the play loop's current wrong behaviour. EACH RED TEST IS AN ARGUMENT IN THE COMMIT MESSAGE, NOT AN ADJUSTMENT.

── COMMIT 6 — THE SPAN AND THE CLOCK. Largest correctness win. ──
WHAT: Split `advanceWorldForCultivator` per Correction 4 into an async prologue and a sync `advanceTheWorldNow(handle, …)`. `applyTimeSkip` takes the runner and the world; its transaction, appendWorld and writeObligations become one commit instead of three. Convert the 4 `runs.advanceDays` sites that never tick the world (alchemy-manage.ts:688, sect-leadership.ts:158, sect-manage.ts:969, technique-manage.ts:731) or the reconciler comes back. LAND THE INVARIANT TEST BEFORE DELETING catchUp: `state.currentDay === record.startedOnDay + Math.floor(run.elapsedDays)` after every verb — nothing asserts this today. Then delete `catchUp` (discards its own return, no observer, no digest, reachable from 26 unmarked loadWorld sites).
FILES: apply.ts, cultivation-world.ts, turn-engine.ts, 4 handler files. ~10 src files.
PROVES: a spy handle counts ONE COMMIT for a plain cultivate turn, against a measured minimum of six today. tests/engine/world/driver.test.ts's 10y+30y == 40y decomposition stays green.
GREEN AFTER: NOT green. [CORRECTION — the file nobody named] tests/web/a-run-is-reproducible-inside-a-world.test.ts (158 lines) pins "same run seed, same world seed → the same life, exchange for exchange." Deleting catchUp changes the order in which world years simulate relative to the run, and pressure binds to whoever is alive when it fires. That test IS the constraint the owner released. It is rewritten in this commit to the new promise — same SETS of rng, may differ run to run — with the owner's sentence quoted in the header. 39 test files reference currentDay/advanceWorldForCultivator/catchUp; expect world-content snapshots to move.

── COMMIT 7 — THE PERSON, AS A READ. [CORRECTION: this moves here, before the write commands.] ──
WHAT: The judgements' disagreement about the person is a false one caused by conflating two jobs. The READ unification is cheap; the STORAGE merge is expensive. Split them, and put the read here — otherwise Hand, Take, Enroll, Promote, Expel and Strike are each written with `if (stored)` inside them and then rewritten at commit 12. Writing every discrete transition body twice is why commit 12 gets abandoned.
  src/engine/people/there-is-one-kind-of-person.ts — Person is NpcRecord WIDENED, not Cultivator widened: the NPC side already derives what the player side stores (bodyStandingOn is a stamp plus a rate; accumulatingSinceDay is a span), so converging on it DELETES writes. Export ONLY ageOf, isAlive, untreatedWounds, maxBodyOf, bodyStandingIn — the ones with a caller in this commit. lifespanEndsOn, maxQiOf and inHouse wait for theirs.
  src/server/state/everybody-the-game-can-name.ts — PersonBook { get, at, heldBy }.
  First conversion: `othersPresent`/`oneCrowd` (hearsay.ts:182-215, 34 lines) — the only place in the tree where the two populations are already merged under a stated total order, so there is a byte-for-byte correct answer to compare against. Signature unchanged; none of the 60 present() sites move.
  Ruling in the file, because two progress models meet here: satiety, starvationTurns, bleedingTurns, cultivationProgress, battle counters, achievements and runId are A RUN'S FACTS ABOUT A PERSON. THE RUN SHEET WINS WHERE THERE IS ONE; WHERE THERE IS NONE THE WORLD'S OWN DERIVATION ANSWERS.
FILES: 2 new, hearsay.ts. 3 files. CLOSES NO DRIFT — it is the pin. It earns its slot because after it a second person representation cannot be added without a test going red.
PROVES: tests/web/a-square-holds-the-same-people-whichever-store-they-are-in.test.ts — identical ids, identical order, identical realmOrdinal.
GREEN AFTER: green.

── COMMIT 8 — Hand / Take. ONE WRITER FOR POSSESSIONS. ──
WHAT: src/server/state/person-writes.ts — a PersonScribe (move/credit/debit/wound/mend/climb/enroll/end) branching internally on heldBy ONCE, each method running inside the caller's open transaction. Hand absorbs give/buy/sell/donate/offer/provision; Take absorbs steal/take/siphon/site-take/legacy-dig/loot. DO NOT MERGE THE TABLES, MERGE THE WRITERS: a counted stack and a tracked individual are different kinds of thing. Rename cultivator_pouch.cultivator_id to holder_id and drop its FK, which is what lets a looted player's herbs change hands instead of ceasing to exist (estate-settlement.ts:314 documents that bug against itself). asking-verbs.ts:796-810 becomes two scribe calls, which deletes the money-creation window, not just the branch.
FILES: person-writes.ts (new), turn-engine.ts, asking-verbs.ts, a-taking-is-decided-by-ownership.ts, sect-manage.ts, site-verbs.ts, cultivation-support.ts, estate-settlement.ts, migrations. ~12 files.
PROVES: five of the nine BOTH functions commit once, asserted by COMMIT count on a spy handle.
GREEN AFTER: green, bar inventory snapshot moves.
DRIFT: 4.

── COMMIT 9 — Enroll / Promote / Expel. ONE ROLL. ──
WHAT: sole writers of sect_members, NpcRecord.factionId/factionRankIndex and both copies of house power. Delete mirrorOnCultivatorStmt and the cultivators.sect_id/sect_rank columns. Fix rankIndexOf (cultivation-world.ts:428 — `typeof cultivator.sectRank === 'number'` against z.string().nullable(), always false, so every player's digest rank is 0 forever). Add the missing isTheWorldsToMove guard to applyPromotions, the one unguarded world pass that writes the player's row and appends a chronicle fact the next refresh cannot take back. Route applyProbation through Enroll so the status verb stops putting players on sect rolls.
  [CORRECTION — the convergence test nobody set] `applyPromotions` (aggregate) and `Promote` (discrete) must end up calling THE SAME transition body, not two bodies writing one field. If they do not, this commit closes three copies of the rank and leaves the two ROUTES intact, which is the thing the owner asked to stop.
FILES: sect.repo.ts, sect-manage.ts, sect-leadership.ts, sect-probation.ts, cultivation-world.ts, the-world-changing-on-its-own.ts, promotion-inside-a-house.ts, standing.ts, migrations. ~10 files.
PROVES: a Sect Head's digest threshold differs from an outer disciple's.
GREEN AFTER: NOT green, and worse, GREEN WOULD NOT PROVE IT. This moves the authority layer's roll off the 187-row authored MEMBERS catalog (rosterFor → getMembersOf) onto live world rows carrying no authored wants, fears or rivalries, across 44 OnTheRoll consumers. MEASURE the roll population and a leverage sample before and after and write the ruling in. tests/web/api.test.ts, asking-is-not-doing.test.ts, a-target-can-be-a-description.test.ts, tests/storage/cultivation-repos.test.ts move.
DRIFT: 3, three copies of four.

── COMMIT 10 — Strike / Die. ──
WHAT: Move the 7 worldDirty sites, 2 aDeedEntersTheWorld calls, 5 obligation writes and 2 removeFromPouch calls inside settleAFight's existing transaction. Bring the 6 markDead sites that skip settleNpcDeath onto Die. Collapse enshrineRun's parallel inheritance onto settleNpcDeath — the player's accounts loop sits inside `if (heirs.length > 0 && goals.length > 0)`, so a player who dies with heirs but no unfinished goals passes on no grudges at all. Wire endRunInWorld (0 callers) so world_runs.outcome stops reading 'active' forever — REQUIRED BEFORE COMMIT 12, because assertNoResurrection throws and is the first statement in both world write paths. Also fix appendWorld's omission of writeAscensions and its dropping of every in-place mutation to an already-persisted fact.
  Same convergence test as commit 9: applyAdvancement and Cross must share a body, or two rateMultiplier derivations on two seed roots keep deciding one crossing.
FILES: combat-manage.ts, combat-verbs.ts, standing-guard.ts, legacy.ts, time.ts, immortal-world.ts, cultivation-world.ts, world-state.repo.ts, the-world-changing-on-its-own.ts. ~10 files.
PROVES: the remaining four BOTH functions commit once.
GREEN AFTER: combat and confrontation tests move; the world half of a killing is strictly better recorded.

── COMMIT 11 — `sealed` BECOMES THREE FIELDS. ──
WHAT: undrawnPocket / lockedBy / officeOf. [CORRECTION] Only genuinely closes drift 2 if `whoIsInChargeOfWhat` is repointed at officeOf IN THIS COMMIT; otherwise it goes on reading a field that no longer means what it read. Here and not earlier because it rewrites ~110 world_locations rows and is safe only once one writer holds the world inside one commit.
FILES: locations.ts, architecture.ts, whoIsInChargeOfWhat, world-state.repo.ts, migrations, seeding. ~6 files.
PROVES: locked doors stop reporting the richest qi band.
DRIFT: 2.

── COMMIT 12 — THE PERSON, AS STORAGE. HARD GATE. ──
GATE: do not start until `grep -c "worldDirty = true" src` is under 5 (29 today). Both schemas are already in one SQLite file, so this is a table merge, not a cross-store migration.
WHAT: world_npcs → people; cultivators → run_sheets keyed by person id. Delete what-a-confrontation-does-to-somebody-the-world-holds.ts (433), the-player-as-a-row-the-world-can-invite.ts (230), a-catalog-person-and-their-world-row.ts (109), residentAbove, worldRosterRow, the three CombatantInput adapters, worldLocationFor and its 34 sites — roughly 2,370 lines of src out. Re-decide all 12 npcsAt sites IN ONE COMMIT against the contract how-crowded-this-ground-is.ts:97 already states; converting eleven double-counts the player in the largest multiplier in the seclusion model.
FILES: ~60.
PROVES: tests/web/there-is-one-kind-of-person.test.ts carries the four audit defects as assertions — the admin roster listing the player twice, four headcounts giving three answers, woundsCarriedBy inventing injuries from an integer, rankIndexOf.
GREEN AFTER: the ~1,330 lines of bridge-pinning tests (4 files) are REWRITTEN TO THE BEHAVIOURAL CLAIM in this commit, not deleted and not patched to the new shape.
DRIFT: 6.

── COMMIT 13 — PROVE IT FINISHED. Acceptance by grep. ──
Delete worldDirty and its 29 sites and both flush points; the 15 unprotected applyDeltas sites; READ_ONLY_ACTIONS becomes a type (a verb that produces no command is a read, and the compiler says so). Acceptance, all falsifiable: grep -c worldDirty src → 0; .transaction( materially below 85 with every survivor inside a transition body; one player turn = one COMMIT on a spy handle; the nine BOTH functions each committing once; exactly one person type, one rank field, one owner key, one clock. If those greps do not go to zero, the refactor did not happen — and a strangler that stops halfway leaves seven stores instead of six.

═══════════════════════════════════════════════════
TWO STANDING CONSTRAINTS
═══════════════════════════════════════════════════
1. THE NARRATOR STAYS OUTSIDE EVERY BOUNDARY. act() awaits at :1833 and :2061 and a transaction cannot span them. Prefer verb-wide commits; multi-clause sentences commit per step. Before any commit widens a transition past one verb, classify every await reachable from carryOut's 56 arms — no design has done this, and it is the precondition for a turn-wide commit.
2. SERIALISE turn-engine.ts. 12,650 lines, and commits 6, 8, 9, 10, 12 and 13 all land in it. One agent at a time. This tree already has a second agent landing files on it during this session.