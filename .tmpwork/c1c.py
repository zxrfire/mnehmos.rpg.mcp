import io

def upto(s, start, end, label):
    a = s.find(start)
    assert a >= 0, 'start not found: ' + label
    b = s.find(end, a + len(start))
    assert b >= 0, 'end not found: ' + label
    return s[:a] + s[b:]

def drop_lines(s, pred):
    return '\n'.join(l for l in s.split('\n') if not pred(l))

def cut_range(path, ranges):
    """ranges are 1-indexed inclusive line spans, applied high-to-low."""
    lines = io.open(path, encoding='utf-8').read().split('\n')
    for lo, hi in sorted(ranges, reverse=True):
        del lines[lo - 1:hi]
    io.open(path, 'w', encoding='utf-8', newline='').write('\n'.join(lines))

# ── time.ts: ProcessOutcome is lines 66-73, plus the blank after ────────
p = 'src/engine/world/time.ts'
cut_range(p, [(66, 74)])
s = io.open(p, encoding='utf-8').read()
s = s.replace("    processOutcomes: ProcessOutcome[];\n", "", 1)
s = s.replace("        processOutcomes,\n", "", 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)

# ── the repo: the row shapes and converters, by exact span ──────────────
p = 'src/storage/repos/world-state.repo.ts'
cut_range(p, [
    (2302, 2311),   # interface ProcessRow
    (2245, 2266),   # interface ActorRow + InventoryRow
    (1739, 1750),   # rowToProcess
    (1690, 1699),   # rowToInventoryItem
    (1669, 1689),   # rowToActor
])

s = io.open(p, encoding='utf-8').read()
s = s.replace("""import type {
    ActorWorldState,
    DurableProcess,
    FactionRecord,
    InventoryItem,
    ScheduledEffect,
    WorldState
} from '../../engine/world/world-state.js';""",
"""import type {
    FactionRecord,
    ScheduledEffect,
    WorldState
} from '../../engine/world/world-state.js';""", 1)

s = upto(s, "        this.insertActorStmt = db.prepare(`", "        this.insertEffectStmt", 'insertActor..insertProcess head')
s = upto(s, "        this.insertProcessStmt = db.prepare(`", "        this.insertLineageStmt", 'insertProcessStmt')

s = drop_lines(s, lambda l: l.strip().startswith('private readonly insertActorStmt')
                          or l.strip().startswith('private readonly insertInventoryStmt')
                          or l.strip().startswith('private readonly insertProcessStmt')
                          or l.strip().startswith('private readonly selectActorsStmt')
                          or l.strip().startswith('private readonly selectProcessesStmt')
                          or l.strip().startswith('this.selectActorsStmt = db.prepare')
                          or l.strip().startswith('this.selectProcessesStmt = db.prepare')
                          or l.strip() == 'this.writeActors(s);'
                          or l.strip() == 'this.writeProcesses(s);')

s = upto(s, "        const inventoryByActor = groupBy(", "        const edgesByLineage = groupBy(", 'inventoryByActor')
s = upto(s, "            actors: (this.selectActorsStmt.all(worldId) as ActorRow[]).map(row =>",
         "            schedule:", 'load actors')
s = drop_lines(s, lambda l: l.strip().startswith('processes: (this.selectProcessesStmt'))

s = upto(s, "    private writeActors(s: WorldState): void {",
         "    private writeEffects(s: WorldState): void {", 'writeActors')
s = upto(s, "    private writeProcesses(s: WorldState): void {",
         "    private writeLineages(s: WorldState): void {", 'writeProcesses')

s = s.replace("            'world_actor_inventory', 'world_actors',\n", "", 1)
s = s.replace("            'world_scheduled_effects', 'world_processes',",
              "            'world_scheduled_effects',", 1)

io.open(p, 'w', encoding='utf-8', newline='').write(s)

# ── and world-state's own InventoryItem, whose only holder was an actor ─
p = 'src/engine/world/world-state.ts'
s = io.open(p, encoding='utf-8').read()
s = upto(s, "export interface InventoryItem {", "\n/**", 'InventoryItem')
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('cut')
