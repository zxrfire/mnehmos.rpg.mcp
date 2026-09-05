<!-- tier: 3 -->

# The repositories

One class per table, each owning the SQL for it. Nothing above this layer writes SQL, and
nothing here decides anything: a repository stores what it is given and returns what it
holds.

The two rules that matter when adding one:

- **A backtick inside a SQL template literal terminates the literal** and takes the whole
  module out at transform time, with an error pointing nowhere useful. It has happened
  twice. See the rule in [`AGENTS.md`](../../../AGENTS.md).
- **Migrations live in [`../migrations.ts`](../migrations.ts) and its siblings**, not here.
  `CREATE TABLE IF NOT EXISTS` silently no-ops on a name collision and surfaces as `no such
  column` hundreds of lines away, which is why the migration files carry that warning.

| file | what it is |
|---|---|
| [`agent.repo.ts`](./agent.repo.ts) | ROW TYPES (snake_case from SQLite) |
| [`calculation.repo.ts`](./calculation.repo.ts) | - |
| [`character.repo.ts`](./character.repo.ts) | - |
| [`combat.repo.ts`](./combat.repo.ts) | Persistence for confrontations. |
| [`concentration.repo.ts`](./concentration.repo.ts) | - |
| [`corpse.repo.ts`](./corpse.repo.ts) | - |
| [`cultivator.repo.ts`](./cultivator.repo.ts) | - |
| [`custom-effects.repo.ts`](./custom-effects.repo.ts) | CustomEffectsRepository Handles CRUD operations for custom effects (divine boons, curses, transformations). |
| [`diplomacy.repo.ts`](./diplomacy.repo.ts) | - |
| [`encounter.repo.ts`](./encounter.repo.ts) | - |
| [`event-inbox.repo.ts`](./event-inbox.repo.ts) | EVENT INBOX REPOSITORY Manages the event queue for "autonomous" NPC actions. |
| [`inventory.repo.ts`](./inventory.repo.ts) | - |
| [`item.repo.ts`](./item.repo.ts) | - |
| [`nation.repo.ts`](./nation.repo.ts) | - |
| [`npc-memory.repo.ts`](./npc-memory.repo.ts) | - |
| [`obligation.repo.ts`](./obligation.repo.ts) | The obligation ledger's rows, read back. |
| [`party.repo.ts`](./party.repo.ts) | Row returned from the join query with character data |
| [`perception-assessment.repo.ts`](./perception-assessment.repo.ts) | Perception-Assessment Repository (INSERT-only ledger). |
| [`poi.repo.ts`](./poi.repo.ts) | - |
| [`quest.repo.ts`](./quest.repo.ts) | Extended types for full quest log |
| [`region.repo.ts`](./region.repo.ts) | - |
| [`run.repo.ts`](./run.repo.ts) | - |
| [`scene.repo.ts`](./scene.repo.ts) | Scene repository - DM-committed shared narrative frames. |
| [`secret.repo.ts`](./secret.repo.ts) | - |
| [`sect.repo.ts`](./sect.repo.ts) | - |
| [`spatial.repo.ts`](./spatial.repo.ts) | - |
| [`structure.repo.ts`](./structure.repo.ts) | - |
| [`technique.repo.ts`](./technique.repo.ts) | - |
| [`turn-action.repo.ts`](./turn-action.repo.ts) | - |
| [`turn-state.repo.ts`](./turn-state.repo.ts) | - |
| [`world-snapshot.repo.ts`](./world-snapshot.repo.ts) | - |
| [`world-state.repo.ts`](./world-state.repo.ts) | PARAMETER BUILDERS |
| [`world.repo.ts`](./world.repo.ts) | - |
