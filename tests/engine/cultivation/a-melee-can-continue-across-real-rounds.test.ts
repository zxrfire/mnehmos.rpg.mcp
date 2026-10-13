/**
 * A party fighting one attacker used to leave every companion idle: the played
 * handler reserved an ally only for a second attacker. A shared melee must be
 * pausable for the player's next choice without restarting initiative, healing
 * anybody, repeating an art, or changing the result of the existing whole fight.
 * Both comparisons use the same tree and their own identical seeded stream.
 */
import { describe, it, expect } from 'vitest';
import { openMelee, takeMeleeRound, resolveMelee, assessPower, assessGap, type CombatantInput, type SideInput } from '../../../src/engine/cultivation/combat.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { AN_ORDINARY_SWING } from '../../../src/engine/cultivation/how-a-blow-was-thrown.js';

function body(id: string, ordinal: number): CombatantInput {
    const hp = 20 + ordinal * 12;
    return { id, name: id, realmOrdinal: ordinal, spiritRoot: 'muddled_five_element',
        attributes: { might: 2, insight: 2, fortune: 1, charm: 2 }, injuries: [], hp, maxHp: hp,
        qi: hp, maxQi: hp, artifactGrade: 0, battlesSurvived: 0, technique: null, techniqueMastery: 0 };
}
const context = (seed: string) => ({ rng: forStream(seed, 'melee', 1), ambient: 'normal' as const,
    turn: 1, intent: { thrown: AN_ORDINARY_SWING } });

describe('a melee continued across rounds', () => {
    it('preserves the actual result and leaves the previous round untouched', () => {
        const sides: SideInput[] = [
            { id: 'party', name: 'party', members: [body('traveller', 3), body('companion', 4)] },
            { id: 'attackers', name: 'attackers', members: [body('attacker', 4)] }
        ];
        for (let seed = 0; seed < 12; seed++) {
            const ctx = context(`continued-melee-${seed}`);
            let turn = openMelee(sides, ctx);
            let paused = false;
            while (turn.state) {
                const before = structuredClone(turn.state);
                const old = turn.state;
                turn = takeMeleeRound(old, ctx);
                expect(old).toEqual(before);
                if (turn.state) {
                    paused = true;
                    turn = { state: structuredClone(turn.state), result: null };
                }
            }
            expect(paused).toBe(true);
            expect(turn.result).toEqual(resolveMelee(sides, context(`continued-melee-${seed}`)));
            expect(turn.result.exchanges.some(exchange => exchange.attackerId === 'companion')).toBe(true);
        }
    });
    it('a companion can face someone the traveller cannot reach', () => {
        const sides: SideInput[] = [
            { id: 'party', name: 'party', members: [body('traveller', 0), body('companion', 30)] },
            { id: 'attackers', name: 'attackers', members: [body('attacker', 17)] }
        ];
        expect(assessGap(assessPower(body('traveller', 0), { ambient: 'normal' }),
            assessPower(body('attacker', 17), { ambient: 'normal' })).verdict).toBe('helpless');
        const ctx = context('a-real-protecting-companion');
        let turn = openMelee(sides, ctx);
        while (turn.state) turn = takeMeleeRound(turn.state, ctx);
        expect(turn.result.winningSideId).toBe('party');
        expect(turn.result.exchanges.some(exchange => exchange.attackerId === 'companion')).toBe(true);
        expect(turn.result.combatants.find(person => person.id === 'traveller')?.fate).toBe('bystander');
        expect(turn.result.combatants.find(person => person.id === 'attacker')?.felledBy).toBe('companion');
    });

    it('guarding leaves the companion able to fight the shared attacker', () => {
        const sides: SideInput[] = [
            { id: 'party', name: 'party', members: [body('traveller', 4), body('companion', 3)] },
            { id: 'attackers', name: 'attackers', members: [body('attacker', 3)] }
        ];
        for (let seed = 0; seed < 8; seed++) {
            const ctx = { ...context(`a-guarded-party-round-${seed}`), acts: { traveller: 'guard' as const } };
            const opened = openMelee(sides, ctx);
            expect(opened.state).not.toBeNull();
            const round = takeMeleeRound(opened.state!, ctx);
            const exchanges = round.state?.exchanges ?? round.result!.exchanges;
            expect(exchanges.some(exchange => exchange.attackerId === 'traveller')).toBe(false);
            expect(exchanges.some(exchange => exchange.attackerId === 'companion')).toBe(true);
        }
    });

    it("a dominant guard is not credited with the companion's unopposed act", () => {
        const sides: SideInput[] = [
            { id: 'party', name: 'party', members: [body('traveller', 20), body('companion', 20)] },
            { id: 'attackers', name: 'attackers', members: [body('attacker', 3)] }
        ];
        const result = resolveMelee(sides, { ...context('the-guard-does-not-strike'),
            acts: { traveller: 'guard' } });
        expect(result.combatants.find(person => person.id === 'attacker')?.felledBy).toBe('companion');
        const guarded = resolveMelee(sides, { ...context('the-party-only-guards'),
            acts: { traveller: 'guard', companion: 'guard' } });
        expect(guarded.winningSideId).toBeNull();
        expect(guarded.hp.attacker).toBe(20 + 3 * 12);
    });

});
