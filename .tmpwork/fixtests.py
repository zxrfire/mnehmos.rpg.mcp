import io

p = 'tests/engine/world/what-a-house-opens-its-treasury-for.test.ts'
s = io.open(p, encoding='utf-8').read()

old = """    it('reaches past the counted rack for the things it keeps a record of', () => {
        const armed = arming('about_to_lose', [
            aSword('tracked', 20),
            makeObject({
                id: 'iron',
                name: 'iron sword',
                kind: 'artifact',
                significance: 'mundane',
                power: 40,
                ownerId: 'the-house',
                ownerName: 'The House'
            })
        ]);
        expect(armed.lent.map(l => l.objectId)).toEqual(['tracked']);
    });"""
new = """    it('empties the iron rack too, because a rubber stamp is still a yes', () => {
        // The counted rack goes out on the armoury officer's say-so and the
        // tracked sword goes to the body. Both are asked; both can say yes.
        const armed = arming('about_to_lose', [
            aSword('tracked', 20),
            makeObject({
                id: 'iron',
                name: 'iron sword',
                kind: 'artifact',
                significance: 'mundane',
                power: 40,
                ownerId: 'the-house',
                ownerName: 'The House'
            })
        ]);
        expect(armed.lent.map(l => l.objectId).sort()).toEqual(['iron', 'tracked']);
    });

    it('and the tracked sword is the one a refusing room stops', () => {
        // The counted one is a rubber stamp and survives a room that will not
        // agree; the tracked one needs the body and does not. That is the
        // counted/tracked line doing its own work, not a rule about wars.
        const armed = armItsOwn({
            how: 'at_peace',
            roll: aHouse(6),
            rankCount: RANKS,
            holds: [
                aSword('tracked', 20),
                makeObject({
                    id: 'iron',
                    name: 'iron sword',
                    kind: 'artifact',
                    significance: 'mundane',
                    power: 40,
                    ownerId: 'the-house',
                    ownerName: 'The House'
                })
            ],
            takers: TAKERS,
            houseName: 'The House',
            onDay: 400,
            readingOf: () => -0.1
        });
        expect(armed.lent.map(l => l.objectId)).toEqual(['iron']);
    });"""
assert old in s
s = s.replace(old, new, 1)

old2 = """    it('and nothing when the vault is empty, without pretending it refused', () => {
        const empty = arming('about_to_lose', []);
        expect(empty.opened).toBe(true);
        expect(empty.lent).toEqual([]);
    });"""
new2 = """    it('and nothing when the vault is empty, without pretending it refused', () => {
        // Nobody was asked, so there is no answer - which is a different state
        // from a room that said no, and the caller can tell them apart.
        const empty = arming('about_to_lose', []);
        expect(empty.lent).toEqual([]);
        expect(empty.answer).toBeNull();

        const refused = arming('at_peace');
        expect(refused.lent).toEqual([]);
        expect(refused.answer).not.toBeNull();
    });"""
assert old2 in s
s = s.replace(old2, new2, 1)

# the peace case now hands out the counted rack, so the fixture must be tracked-only
s = s.replace("""    it('is the coldest thing to ask for in a quiet year', () => {
        expect(howOftenItOpens('arming_its_own', 'at_peace'))
            .toBeLessThan(howOftenItOpens('the_war', 'at_peace'));
        expect(arming('at_peace').opened).toBe(false);
    });""",
"""    it('is the coldest thing to ask for in a quiet year', () => {
        expect(howOftenItOpens('arming_its_own', 'at_peace'))
            .toBeLessThan(howOftenItOpens('the_war', 'at_peace'));
        // The house's tracked swords stay in the vault in a quiet year.
        expect(arming('at_peace').lent).toEqual([]);
    });""")

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
