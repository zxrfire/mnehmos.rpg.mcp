import io

# ── 1. the field ────────────────────────────────────────────────────────
p = 'src/schema/cultivation.ts'
s = io.open(p, encoding='utf-8').read()
old = """    injuries: z.array(InjurySchema).default([]),"""
new = """    injuries: z.array(InjurySchema).default([]),

    /**
     * A qi seal laid on this person, or null for everybody who carries none.
     *
     * The design owner: *"seals already exist, so prisoners are just sealed and
     * thrown into a qi poor area"*, *"just do it as a person, make it easy."*
     *
     * STORED, because it changes - it goes on, it runs, and it comes off. It
     * takes the ability to DRAW and nothing else: not the pool, not the ceiling
     * on the pool, and not what is already in them. See
     * `a-qi-seal-is-put-on-a-person.ts`, which owns every rule about it.
     */
    qiSeal: z.object({
        liftsOnDay: z.number().nullable().default(null),
        byId: z.string().nullable().default(null),
        note: z.string().default(''),
        sinceDay: z.number().default(0)
    }).nullable().default(null),"""
assert old in s, 'injuries field not found'
s = s.replace(old, new, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)

# ── 2. the column ───────────────────────────────────────────────────────
p2 = 'src/storage/migrations.cultivation.ts'
s2 = io.open(p2, encoding='utf-8').read()
old2 = """    if (!cultivatorColumns.includes('achievements')) {"""
new2 = """    // NULL rather than a default object: carrying no seal is the ordinary case
    // and an empty seal is not the same thing as no seal. Nothing to backfill -
    // nobody in an older save was ever sealed, because nothing could seal them.
    if (!cultivatorColumns.includes('qi_seal')) {
        console.error('[Migration] Adding qi_seal column to cultivators table');
        db.exec('ALTER TABLE cultivators ADD COLUMN qi_seal TEXT;');
    }

    if (!cultivatorColumns.includes('achievements')) {"""
assert old2 in s2, 'achievements migration not found'
s2 = s2.replace(old2, new2, 1)
io.open(p2, 'w', encoding='utf-8', newline='').write(s2)

# ── 3. the repo ─────────────────────────────────────────────────────────
p3 = 'src/storage/repos/cultivator.repo.ts'
s3 = io.open(p3, encoding='utf-8').read()
s3 = s3.replace("    insights: string;", "    insights: string;\n    qi_seal: string | null;", 1)
s3 = s3.replace("                insights, achievements, battles_survived, battles_won,",
                "                insights, qi_seal, achievements, battles_survived, battles_won,", 1)
s3 = s3.replace("                @insights, @achievements, @battlesSurvived, @battlesWon,",
                "                @insights, @qiSeal, @achievements, @battlesSurvived, @battlesWon,", 1)
s3 = s3.replace("                insights = @insights, achievements = @achievements,",
                "                insights = @insights, qi_seal = @qiSeal, achievements = @achievements,", 1)
s3 = s3.replace("            insights: JSON.stringify(c.insights),",
                "            insights: JSON.stringify(c.insights),\n"
                "            // Null, not 'null': a seal nobody has is an absent row and not a\n"
                "            // stored word. `qiSeal` reads it straight back as null.\n"
                "            qiSeal: c.qiSeal ? JSON.stringify(c.qiSeal) : null,", 1)
s3 = s3.replace("            insights: JSON.parse(row.insights),",
                "            insights: JSON.parse(row.insights),\n"
                "            qiSeal: row.qi_seal ? JSON.parse(row.qi_seal) : null,", 1)
io.open(p3, 'w', encoding='utf-8', newline='').write(s3)
print('ok')
