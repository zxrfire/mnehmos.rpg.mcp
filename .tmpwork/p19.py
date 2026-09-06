import io

# ── the columns ──────────────────────────────────────────────────────────
p = 'src/storage/migrations.world.ts'
s = io.open(p, encoding='utf-8').read()
old = """        if (!columns.includes('activity')) {
            console.error(`[Migration] Adding activity column to ${table} table`);
            db.exec(`ALTER TABLE ${table} ADD COLUMN activity TEXT;`);
        }
    }"""
new = """        if (!columns.includes('activity')) {
            console.error(`[Migration] Adding activity column to ${table} table`);
            db.exec(`ALTER TABLE ${table} ADD COLUMN activity TEXT;`);
        }
    }

    // HOW MUCH ROOM A THING TAKES AND WHAT IT WEIGHS. Litres and kilograms on
    // every object, because what somebody can carry is limited by both and they
    // bind differently - see `what-a-body-can-carry-and-what-a-ring-holds.ts`.
    // Defaulted to a thing carried in one hand, which is what a row written
    // before the columns existed almost certainly is.
    {
        const columns = columnsOf('world_objects');
        if (!columns.includes('volume')) {
            console.error('[Migration] Adding volume column to world_objects table');
            db.exec('ALTER TABLE world_objects ADD COLUMN volume REAL NOT NULL DEFAULT 2;');
        }
        if (!columns.includes('weight')) {
            console.error('[Migration] Adding weight column to world_objects table');
            db.exec('ALTER TABLE world_objects ADD COLUMN weight REAL NOT NULL DEFAULT 1.5;');
        }
    }"""
assert old in s
io.open(p, 'w', encoding='utf-8', newline='').write(s.replace(old, new, 1))

# ── the table definition, for a fresh database ───────────────────────────
p2 = 'src/storage/migrations.world.ts'
s2 = io.open(p2, encoding='utf-8').read()
old2 = """      power INTEGER,
      possessor_id TEXT,                             -- who is physically holding it"""
new2 = """      power INTEGER,
      -- Litres and kilograms. Both, because they bind differently: a purse of
      -- spirit stones is heavy and small and a bundle of herbs is the reverse,
      -- and which of the two stops somebody carrying it is a different problem
      -- with a different answer.
      volume REAL NOT NULL DEFAULT 2,
      weight REAL NOT NULL DEFAULT 1.5,
      possessor_id TEXT,                             -- who is physically holding it"""
assert old2 in s2
io.open(p2, 'w', encoding='utf-8', newline='').write(s2.replace(old2, new2, 1))

# ── the repo ─────────────────────────────────────────────────────────────
p3 = 'src/storage/repos/world-state.repo.ts'
s3 = io.open(p3, encoding='utf-8').read()
s3 = s3.replace("""                id, world_id, name, kind, significance, description, power,
                possessor_id, owner_id, owner_name, known_ownership_by,
                location_id, tags, data, next_claim_seq
            ) VALUES (
                @id, @worldId, @name, @kind, @significance, @description, @power,
                @possessorId, @ownerId, @ownerName, @knownOwnershipBy,
                @locationId, @tags, @data, @nextClaimSeq
            )""",
"""                id, world_id, name, kind, significance, description, power,
                volume, weight,
                possessor_id, owner_id, owner_name, known_ownership_by,
                location_id, tags, data, next_claim_seq
            ) VALUES (
                @id, @worldId, @name, @kind, @significance, @description, @power,
                @volume, @weight,
                @possessorId, @ownerId, @ownerName, @knownOwnershipBy,
                @locationId, @tags, @data, @nextClaimSeq
            )""")
s3 = s3.replace("""    power: number | null;
    possessor_id: string | null;
    owner_id: string | null;""",
"""    power: number | null;
    volume: number | null;
    weight: number | null;
    possessor_id: string | null;
    owner_id: string | null;""")
s3 = s3.replace("""        description: row.description,
        power: row.power,
        possessorId: row.possessor_id,""",
"""        description: row.description,
        power: row.power,
        // A save written before the columns existed says nothing about size,
        // and a thing carried in one hand is what such a row almost certainly
        // is. Same figure the column default carries.
        volume: row.volume ?? WHAT_A_CARRIED_THING_TAKES,
        weight: row.weight ?? WHAT_A_CARRIED_THING_WEIGHS,
        possessorId: row.possessor_id,""")
io.open(p3, 'w', encoding='utf-8', newline='').write(s3)
print('ok')
