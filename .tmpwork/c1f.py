import io

# ── world.test.ts ───────────────────────────────────────────────────────
p = 'tests/engine/world/world.test.ts'
s = io.open(p, encoding='utf-8').read()

# The clock no longer reads an actor tier, so setting one up proved nothing.
s = s.replace("        world = upsertActor(world, makeActor({ actorId: 'pc', locationId: 'loc-region-0' }));\n", "")
s = s.replace("        w = upsertActor(w, makeActor({ actorId: 'pc', locationId: 'loc-region-0' }));\n", "")
s = s.replace("        world = startProcess(world, { actorId: 'pc', kind: 'cultivating', perDay: { progress: 1 } }).state;\n", "")

# A fact reaches the ledger through the ledger, which is the only path left.
s = s.replace("""        const out = recordEvent(world, makeFact({
            day: 100, kind: 'catastrophe', summary: 'The mountain at Stillshelf came down.'
        }));
        world = out.state;
        const s = createMemoryStore();
        rememberFact(s, 'pc', out.fact, { summary: 'There used to be a mountain here.' });""",
"""        const fact = appendFact(world.history, makeFact({
            day: 100, kind: 'catastrophe', summary: 'The mountain at Stillshelf came down.'
        }));
        const s = createMemoryStore();
        rememberFact(s, 'pc', fact, { summary: 'There used to be a mountain here.' });""", 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)

# ── history.test.ts: the second half of the same claim ──────────────────
p = 'tests/engine/world/history.test.ts'
s = io.open(p, encoding='utf-8').read()
a = s.index("        const full = recordMajorEvent(")
b = s.index("        expect(full.warnings).toHaveLength(0);")
s = s[:a] + """        const fullAnswers = {
            immediate: 'The ridge came down across the pass.',
            physical: 'The pass is closed; a sealed structure is exposed.',
            beneficiaries: [{ id: 'fac-1', name: 'Cold Kiln Hall', role: 'claimant' }],
            losers: [{ id: 'fac-2', name: 'Salt Bell Court', role: 'dispossessed' }],
            factionReactions: [{ factionId: 'fac-1', reaction: 'Sent forty disciples to hold the site.' }],
            relationshipChanges: [{ aId: 'fac-1', bId: 'fac-2', change: 'open hostility' }],
            opportunitiesOpened: ['The exposed structure can be entered.'],
            opportunitiesClosed: ['The pass route to the northern markets.'],
            rumours: ['That a Void Tribulation cultivator did it on purpose.'],
            tenYearsLater: 'A town of eight hundred serves the excavation.'
        };
        const full = appendFact(ledger, makeFact({
            day: 20,
            kind: 'catastrophe',
            summary: 'The Saltbell ridge came down.',
            consequences: fillConsequences(fullAnswers)
        }));
        expect(missingConsequences(fullAnswers)).toHaveLength(0);
""" + s[b:]
s = s.replace("        expect(full.warnings).toHaveLength(0);\n", "", 1)
s = s.replace("expect(full.fact.consequences?.tenYearsLater)", "expect(full.consequences?.tenYearsLater)", 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
