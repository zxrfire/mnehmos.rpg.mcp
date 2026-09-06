import io
p = 'tests/web/practices.test.ts'
s = io.open(p, encoding='utf-8').read()
old = """    it('never lets an unheard-of faction be named by one', async () => {
        const { db, game } = makeGame({ seed: 'practice-gate' });
        const { cultivator } = await game.newRun('Villager');
        const gate = new KnowledgeGate(db);

        for (const observed of PRACTICES.values()) {
            if (mayObserve(observed, gate, cultivator.id)) {
                // Anything a stranger may see has to name nothing at all.
                expect(observed.namesFaction, observed.factionId).toBe(false);
            }
        }
    });"""
assert old in s, 'block not found'
new = """    /**
     * ── UNHEARD-OF, WHICH IS NOT THE SAME AS UNAFFILIATED ────────────────
     *
     * This asserted that anything a fresh cultivator may see names NO faction
     * at all, which was true when it was written and stopped being true when
     * birth knowledge landed. The design owner's ruling: *"knowing 3 of 6 makes
     * sense cuz even as a mortal you start SOMEWHERE."* A villager is born
     * holding the names of the houses around where they were born.
     *
     * Measured on this seed: the Villager is born knowing SEVEN of the
     * thirty-eight houses that have a practice - the Sweptground Temple, the
     * Azure Dew Sect, the Hollow Bell Wanderers, the Six Li Patrol and three
     * caravans and markets - which is exactly the shape that ruling asks for.
     * One practice that names its house was visible to them, and it was the
     * Hollow Bell Wanderers, whose name they already had.
     *
     * So the claim worth holding is the GATE, not the count: nothing names a
     * house to somebody who could not already name it. That is what the feature
     * does, it is what the old assertion was reaching for, and it does not
     * quietly break the next time the birth draw is retuned.
     */
    it('never lets an unheard-of faction be named by one', async () => {
        const { db, game } = makeGame({ seed: 'practice-gate' });
        const { cultivator } = await game.newRun('Villager');
        const gate = new KnowledgeGate(db);

        let checked = 0;
        for (const observed of PRACTICES.values()) {
            if (!mayObserve(observed, gate, cultivator.id)) continue;
            if (!observed.namesFaction) continue;
            // Visible AND naming its house: only ever a house already held.
            expect(gate.isAwareOf(cultivator.id, 'sect', observed.factionId),
                observed.factionId).toBe(true);
            checked++;
        }

        // And the other half, which is what makes the above non-vacuous: a
        // house this cultivator has never heard of stays shut.
        const stranger = [...PRACTICES.values()].find(observed =>
            observed.namesFaction && !gate.isAwareOf(cultivator.id, 'sect', observed.factionId));
        expect(stranger, 'no unheard-of house left to check the gate with').toBeDefined();
        expect(mayObserve(stranger!, gate, cultivator.id), stranger!.factionId).toBe(false);
        void checked;
    });"""
io.open(p, 'w', encoding='utf-8', newline='').write(s.replace(old, new, 1))
print('ok')
