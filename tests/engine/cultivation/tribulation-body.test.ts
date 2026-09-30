/**
 * The capability sheet promised a body which learned harms, but combat priced only power.
 * The same seeded landed blow now gets smaller with exposure, learns one kind at a time,
 * and still costs HP. An imperfect body learns less and loses its old closure sooner.
 * Calibration: 32 seeds produced no transcendent finish or victory against twenty
 * elemental Grand Perfection bodies; all 16 peer fights ended with a body at zero HP.
 * Bodily death still follows the existing soul rules, so a remnant is not final death.
 */
import { describe, it, expect } from 'vitest';
import { assessPower, resolveExchange, resolveMelee, type CombatantInput } from '../../../src/engine/cultivation/combat';
import { CultivationRNG } from '../../../src/engine/cultivation/rng';
import { REALM_TIERS } from '../../../src/engine/cultivation/realms';
import { getTechnique, TECHNIQUES } from '../../../src/data/cultivation/techniques';
import type { Adaptation } from '../../../src/engine/cultivation/tribulation-defence';
import { A_BLOW_MEANT_TO_END_IT } from '../../../src/engine/cultivation/how-a-blow-was-thrown';
import { createInjury } from '../../../src/engine/cultivation/injuries';

const ordinal = REALM_TIERS.find(t => t.key === 'tribulation_transcendence')!.ordinalStart;
const fire = TECHNIQUES.find(t => t.element === 'fire' && t.category === 'attack')!;
const body = (id: string, art = fire): CombatantInput => ({ id, name: id, realmOrdinal: ordinal,
    spiritRoot: 'single_fire', attributes: { might: 3, insight: 3, fortune: 1, charm: 1 },
    hp: 10000, maxHp: 10000, qi: 10000, maxQi: 10000, injuries: [], technique: getTechnique(art.id) });
const power = (id: string, art = fire) => assessPower(body(id, art), { ambient: 'normal' });

describe('a tribulation body in the ordinary exchange', () => {
    it('learns repeated harm without ever erasing a landed blow', () => {
        const slots: Record<string, Adaptation> = {};
        const attacker = power('attacker');
        const defender = { ...power('defender'), practisedHarm: null };
        const strike = () => resolveExchange(attacker, defender, 10000, {
            rng: new CultivationRNG('one-identical-blow'), ambient: 'normal', turn: 1,
            adaptations: slots, defenderId: 'defender'
        }).damage;
        const first = strike();
        expect(strike()).toBe(first);
        const exposed = Array.from({ length: 8 }, strike);
        expect(exposed.at(-1)).toBeLessThan(first);
        expect(exposed.every(d => d >= 1)).toBe(true);
        const below = { ...defender, ordinal: ordinal - 1 };
        expect(resolveExchange(attacker, below, 10000, { rng: new CultivationRNG('one-identical-blow'),
            ambient: 'normal', turn: 1 }).damage).toBeGreaterThan(first);
    });

    it('opens its old closure before learning a different harm', () => {
        const slots: Record<string, Adaptation> = {};
        const hit = (harm: 'fire' | 'bludgeoning') => resolveExchange({ ...power('a'), harm }, power('d'), 10000,
            { rng: new CultivationRNG('same'), ambient: 'normal', turn: 1, adaptations: slots, defenderId: 'd' });
        for (let n = 0; n < 8; n++) hit('fire');
        const freshOther = hit('bludgeoning').damage;
        expect(hit('bludgeoning').damage).toBe(freshOther);
        for (let n = 0; n < 10; n++) hit('bludgeoning');
        expect(hit('bludgeoning').damage).toBeLessThan(freshOther);
        expect(hit('fire').damage).toBeGreaterThan(hit('bludgeoning').damage);
    });

    it('the imperfect body closes less of the same attack', () => {
        const fullSlots: Record<string, Adaptation> = {};
        const crackedSlots: Record<string, Adaptation> = {};
        const strike = (imperfectBody: boolean, adaptations: Record<string, Adaptation>) => resolveExchange(
            power('a'), { ...power('d'), imperfectBody }, 10000,
            { rng: new CultivationRNG('same'), ambient: 'normal', turn: 1, adaptations, defenderId: 'd' }).damage;
        let full = 0, cracked = 0;
        for (let n = 0; n < 10; n++) { full = strike(false, fullSlots); cracked = strike(true, crackedSlots); }
        expect(cracked).toBeGreaterThan(full);
    });

    it('a failed transformation channels one directed pulse, without a passive presence', () => {
        const deity = REALM_TIERS.find(t => t.key === 'deity_transformation')!.ordinalStart;
        const input = { ...body('failed'), realmOrdinal: deity,
            injuries: [createInjury({ severity: 'crippling', source: 'failed_breakthrough', turn: 0,
                woundType: 'failed-transformation' }, new CultivationRNG('failed'))] };
        const failed = assessPower(input, { ambient: 'normal' });
        expect(failed.suppressesLesser).toBe(false);
        expect(failed.suppressionPulse).toBe(true);
        expect(assessPower({ ...input, qi: 0 }, { ambient: 'normal' }).suppressionPulse).toBe(false);
        const pulses: Record<string, boolean> = {};
        const lower = assessPower({ ...body('lower'), realmOrdinal: deity - 1 }, { ambient: 'normal' });
        const strike = () => resolveExchange(failed, lower, 10000, { rng: new CultivationRNG('pulse'),
            ambient: 'normal', turn: 1, suppressionPulses: pulses, attackerId: input.id });
        const first = strike();
        const next = strike();
        expect(first.advantage).toBeGreaterThan(next.advantage);
        expect(next.modifiers.some(m => m.source === 'channelled_suppression')).toBe(false);
    });

    it('twenty elemental Grand cultivators deny a win without reliably finishing the early body', () => {
        const grand = REALM_TIERS.find(t => t.key === 'grand_ascension')!;
        let finished = 0;
        let wins = 0;
        for (let seed = 0; seed < 32; seed++) {
            const result = resolveMelee([
                { id: 'grand', name: 'grand', members: Array.from({ length: 20 }, (_, n) =>
                    ({ ...body(`grand-${n}`), realmOrdinal: grand.ordinalEnd })) },
                { id: 'body', name: 'body', members: [body('transcendent')] }
            ], { rng: new CultivationRNG(`summit-calibration-${seed}`), ambient: 'normal', turn: 1,
                intent: { thrown: A_BLOW_MEANT_TO_END_IT, willWithdraw: true } });
            if (result.combatants.find(c => c.id === 'transcendent')!.finished) finished++;
            if (result.winningSideId === 'body') wins++;
        }
        expect(finished).toBe(0);
        expect(wins).toBe(0);
    });

    it('two whole elemental bodies given the body-sized fight budget still end with a fallen body', () => {
        for (let seed = 0; seed < 16; seed++) {
            const result = resolveMelee([
                { id: 'a', name: 'a', members: [body('a')] },
                { id: 'b', name: 'b', members: [body('b')] }
            ], { rng: new CultivationRNG(`body-peer-${seed}`), ambient: 'normal', turn: 1,
                intent: { thrown: A_BLOW_MEANT_TO_END_IT, willWithdraw: false } });
            expect(Object.values(result.hp).some(hp => hp === 0), `${seed}: ${result.narrationHint}`).toBe(true);
            expect(result.winningSideId).not.toBeNull();
        }
    });
});
