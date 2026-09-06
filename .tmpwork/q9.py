import io
p = 'tests/web/a-target-can-be-a-description.test.ts'
s = io.open(p, encoding='utf-8').read()
i = s.rindex('});')
add = '''
describe('a realm answers to what it is called and to what it was', () => {
    /**
     * The rename that made this necessary: Void Refinement became Void
     * Tribulation when alchemy took the word. The key never moved.
     *
     * BOTH RESOLVE, and only one is ever printed. A run's transcript is the
     * classifier's context, so somebody forty turns in has forty turns of
     * narration behind them saying the old name, and both they and the model
     * reading for them will go on saying it. Answering "no such realm" to a
     * word the game itself printed an hour ago is being wrong about its own
     * history rather than being precise.
     */
    it.each([
        ['you, void tribulation cultivator', 'the name now'],
        ['you, void refinement cultivator', 'the name it was']
    ])('%s reaches the same rung (%s)', said => {
        expect(theDescriptionThisIs(said)).toMatchObject({ realmKey: 'void_refinement' });
    });

    it('prints only the name it has now', () => {
        expect(realmForOrdinal(29).name).toBe('Void Tribulation');
        expect(Object.values(A_REALM_ANSWERS_TO)).toContain('void_refinement');
        // A retired name is never a tier's own name, or it would be printed.
        for (const retired of Object.keys(A_REALM_ANSWERS_TO)) {
            expect(REALM_TIERS.some(t => t.name.toLowerCase() === retired), retired).toBe(false);
        }
    });
});
'''
s = s[:i + 3] + '\n' + add
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
