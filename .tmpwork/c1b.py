import io

def upto(s, start, end, label):
    a = s.find(start)
    assert a >= 0, 'start not found: ' + label
    b = s.find(end, a + len(start))
    assert b >= 0, 'end not found: ' + label
    return s[:a] + s[b:]

def thru(s, start, end, label):
    a = s.find(start)
    assert a >= 0, 'start not found: ' + label
    b = s.find(end, a + len(start))
    assert b >= 0, 'end not found: ' + label
    return s[:a] + s[b + len(end):]

# ── world-state.ts: the imports the deleted tier was the only user of ───
p = 'src/engine/world/world-state.ts'
s = io.open(p, encoding='utf-8').read()
s = s.replace("import { rankName } from '../cultivation/realms.js';\n", "", 1)
s = s.replace("    placeName,\n    queryFacts,\n", "    placeName,\n", 1)
s = s.replace("import type { NpcRecord, NpcRelationship } from './npc-state.js';",
              "import type { NpcRecord } from './npc-state.js';", 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)

# ── time.ts: stage 2 goes, and everything it needed ─────────────────────
p = 'src/engine/world/time.ts'
s = io.open(p, encoding='utf-8').read()

s = s.replace("""import {
    cloneWorld,
    getActor,
    lineageOf,
    upsertActor,
    upsertNpc,""",
"""import {
    cloneWorld,
    lineageOf,
    upsertNpc,""", 1)

# stage 2 itself
s = upto(s, "    // ── 2. Durable processes, as a rate times a span. ────────────────────",
         "    // ── 3. Lifespans.", 'stage 2')

s = thru(s, "function upsertActorInPlace(state: WorldState, actor: ReturnType<typeof getActor>): void {",
         "}\n\n", 'upsertActorInPlace')

s = s.replace("export { upsertNpc, upsertActor };", "export { upsertNpc };", 1)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('time.ts cut')
