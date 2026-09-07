import io

def upto(s, start, end, label):
    a = s.find(start); assert a >= 0, 'start ' + label
    b = s.find(end, a + len(start)); assert b >= 0, 'end ' + label
    return s[:a] + s[b:]

# ── history.test.ts: the claim survives, the deleted wrapper does not ───
p = 'tests/engine/world/history.test.ts'
s = io.open(p, encoding='utf-8').read()
s = s.replace("    recordMajorEvent,\n", "", 1)
s = s.replace("""        const thin = recordMajorEvent(
            ledger,
            makeFact({ day: 10, kind: 'catastrophe', summary: 'A dramatic scene.' }),
            { immediate: 'Everyone was impressed.' }
        );
        expect(thin.fact.id).toBe('f1');
        expect(thin.warnings).toContain('What changed physically?');
        expect(thin.warnings).toContain('What is still true ten years later?');
""",
"""        const thinAnswers = { immediate: 'Everyone was impressed.' };
        const thin = appendFact(ledger, makeFact({
            day: 10,
            kind: 'catastrophe',
            summary: 'A dramatic scene.',
            consequences: fillConsequences(thinAnswers)
        }));
        expect(thin.id).toBe('f1');
        expect(missingConsequences(thinAnswers)).toContain('What changed physically?');
        expect(missingConsequences(thinAnswers))
            .toContain('What is still true ten years later?');
""", 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)

# ── world.test.ts: the three tests about the deleted tier ───────────────
p = 'tests/engine/world/world.test.ts'
s = io.open(p, encoding='utf-8').read()
for name in ['adjustResource,', 'getActor,', 'makeActor,', 'moveActor,',
             'recordEvent,', 'setActorFaction,', 'startProcess,', 'upsertActor,',
             'worldSnapshot']:
    s = s.replace('    ' + name + '\n', '', 1)
s = s.replace("            'world_actors', 'world_actor_inventory', 'world_memories',",
              "            'world_memories',", 1)
s = s.replace("            'world_memory_actors', 'world_scheduled_effects', 'world_processes',",
              "            'world_memory_actors', 'world_scheduled_effects',", 1)

s = upto(s, "    it('tracks location, faction, inventory and resources as hard state', () => {",
         "    it('derives the date from one clock', () => {", 'three actor tests')
s = upto(s, "    it('applies a durable process as a rate times a span, not a per-day loop', () => {",
         "    it('is decomposable: ten years then twenty equals thirty', () => {", 'process test')
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('tests cut')
