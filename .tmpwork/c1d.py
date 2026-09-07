import io, re

def upto(s, start, end, label):
    a = s.find(start)
    assert a >= 0, 'start not found: ' + label
    b = s.find(end, a + len(start))
    assert b >= 0, 'end not found: ' + label
    return s[:a] + s[b:]

p = 'src/storage/migrations.world.ts'
s = io.open(p, encoding='utf-8').read()

# ── the two tables and their indexes ────────────────────────────────────
s = upto(s, "    -- ── ACTORS: WORLD-FACING HARD STATE ──────────────────────────────────",
         "    -- ── DURABLE MEMORY ───────────────────────────────────────────────────", 'actor tables')
s = upto(s, "    -- ── DURABLE PROCESSES ────────────────────────────────────────────────",
         "    -- ── LINEAGE ──────────────────────────────────────────────────────────", 'process table')

# ── and the ALTERs that kept them current ───────────────────────────────
s = s.replace("for (const table of ['world_locations', 'world_factions', 'world_npcs', 'world_actors']) {",
              "for (const table of ['world_locations', 'world_factions', 'world_npcs']) {")
s = s.replace("for (const table of ['world_npcs', 'world_actors']) {",
              "for (const table of ['world_npcs']) {")

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('migrations cut')
