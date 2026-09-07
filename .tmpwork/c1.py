import io

# ══════════════════════════════════════════════════════════════════════════
# COMMIT 1 - DELETE THE TIER NOTHING CAN POPULATE.
#
# `state.actors` and `state.processes` are structurally unpopulatable, not
# merely unused: makeActor has 0 src callers, nothing anywhere pushes a
# process, and upsertActorInPlace is reachable only through a getActor that
# could only return an actor already there. All three tables hold 0 rows.
# ══════════════════════════════════════════════════════════════════════════

def upto(s, start, end, label):
    """Cut from `start` up to but NOT including `end`."""
    a = s.find(start)
    assert a >= 0, 'start not found: ' + label
    b = s.find(end, a + len(start))
    assert b >= 0, 'end not found: ' + label
    return s[:a] + s[b:]

def thru(s, start, end, label):
    """Cut from `start` through `end` inclusive."""
    a = s.find(start)
    assert a >= 0, 'start not found: ' + label
    b = s.find(end, a + len(start))
    assert b >= 0, 'end not found: ' + label
    return s[:a] + s[b + len(end):]

p = 'src/engine/world/world-state.ts'
s = io.open(p, encoding='utf-8').read()

# ── the actor record and its constructor ────────────────────────────────
s = upto(s, "/**\n * The world-facing hard state of one actor.",
         "export type ScheduledEffectKind =", 'ActorWorldState block')

# ── the process record and its kinds ────────────────────────────────────
s = upto(s, "// ─────────────────────────────────────────────────────────────────────────\n// DURABLE PROCESSES",
         "// ─────────────────────────────────────────────────────────────────────────\n// THE WORLD", 'DurableProcess block')

# ── off the world ───────────────────────────────────────────────────────
s = s.replace("    actors: ActorWorldState[];\n", "", 1)
s = s.replace("    processes: DurableProcess[];\n", "", 1)

# ── the readers and writers ─────────────────────────────────────────────
s = thru(s, "export function getActor(state: WorldState, id: string): ActorWorldState | null {", "}\n\n", 'getActor')
s = thru(s, "export function upsertActor(state: WorldState, actor: ActorWorldState): WorldState {", "}\n\n", 'upsertActor')
s = upto(s, "/** Move an actor. The single write path",
         "export function grantKey(state: WorldState, actorId: string, keyId: string): WorldState {", 'moveActor..removeItem')
s = thru(s, "export function grantKey(state: WorldState, actorId: string, keyId: string): WorldState {", "}\n\n", 'grantKey')

s = s.replace("""export interface MutationResult {
    state: WorldState;
    changes: StateChange[];
}

""", "", 1)

# ── the three process functions, which sit together ─────────────────────
s = upto(s, "export interface ProcessInput {",
         "export function activeProcesses(state: WorldState, onDay = state.currentDay): DurableProcess[] {", 'process fns')
s = thru(s, "export function activeProcesses(state: WorldState, onDay = state.currentDay): DurableProcess[] {", "}\n\n", 'activeProcesses')

# ── recordEvent's actor half ────────────────────────────────────────────
s = s.replace("""        const actor = getActor(next, id);
        if (actor && !actor.historyFactIds.includes(stored.id)) {
            next = upsertActor(next, {
                ...actor,
                historyFactIds: actor.historyFactIds.concat(stored.id),
                updatedOnDay: fact.day
            });
        }
""", "", 1)

# ── the snapshot, whose every person-fact came from the deleted tier ────
s = upto(s, "// ─────────────────────────────────────────────────────────────────────────\n// SNAPSHOT",
         "/**\n * Deep copy.", 'WorldSnapshot')

# ── the empty world and the clone ───────────────────────────────────────
s = s.replace("        actors: [],\n", "", 1)
s = s.replace("        processes: [],\n", "", 1)
s = upto(s, "        actors: state.actors.map(a => ({", "        schedule:", 'clone actors')
s = s.replace("        processes: state.processes.map(p => ({ ...p, perDay: { ...p.perDay } })),\n", "", 1)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('world-state.ts cut')
