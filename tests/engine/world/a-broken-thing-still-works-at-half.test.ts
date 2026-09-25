/**
 * A broken thing is still used, at half.
 *
 * Owner ruling 2026-09-25: "you can always use a broken sword, a broken heaven
 * grade sword is still hard ... at durability 0, just at lower effectiveness."
 * At the floor a thing is kept, keeps its grade, and works at half.
 *
 * Grades are the one scale (`which-rungs-a-grade-covers.ts`): heaven covers 21
 * to 28, earth 13 to 20.
 */

import { describe, expect, it } from 'vitest';
import { assessPower, type CarriedObject, type CombatantInput } from '../../../src/engine/cultivation/combat.js';
import { GRADE_ORDINAL_BANDS } from '../../../src/engine/cultivation/which-rungs-a-grade-covers.js';
import { theRungItWorksAt } from '../../../src/engine/world/object-damage.js';
import { makeObject, type ObjectRecord } from '../../../src/engine/world/possessions.js';
import { theWeaponTheyFightWith } from '../../../src/engine/world/what-somebody-fights-with.js';

const HEAVEN = GRADE_ORDINAL_BANDS.heaven.min;
const EARTH = GRADE_ORDINAL_BANDS.earth.min;
const IMMORTAL = GRADE_ORDINAL_BANDS.heaven.max + 1;
const range = (from: number, below: number) => Array.from({ length: below - from }, (_, i) => from + i);

function holding(weapon: CarriedObject | null): CombatantInput {
    return {
        id: 'wu', name: 'Wu', realmOrdinal: 20, spiritRoot: 'single_fire',
        attributes: { might: 2, insight: 2, fortune: 2, charm: 2 },
        injuries: [], hp: 100, maxHp: 100, qi: 100, maxQi: 100, weapon
    };
}
const total = (weapon: CarriedObject | null) => assessPower(holding(weapon), { ambient: 'normal' }).total;

describe('a broken heaven-grade weapon against an intact earth-grade one', () => {
    it('is never weaker, and is stronger everywhere but the one rung where the two grades meet', () => {
        let ties = 0;
        for (const h of range(HEAVEN, IMMORTAL)) {
            const broken = total({ id: 'h', name: 'a heaven-grade sword', power: h, broken: true });
            for (const e of range(EARTH, HEAVEN)) {
                const intact = total({ id: 'e', name: 'an earth-grade sword', power: e });
                expect(broken, `heaven ${h} broken vs earth ${e}`).toBeGreaterThanOrEqual(intact - 1e-9);
                if (Math.abs(broken - intact) < 1e-9) ties++;
            }
        }
        // The one tie: heaven's lowest rung at half is exactly earth's highest,
        // because a realm is four times the one below and a realm's peak is
        // twice its floor.
        expect(ties).toBe(1);
        expect(total({ id: 'h', name: 'h', power: HEAVEN, broken: true }))
            .toBeCloseTo(total({ id: 'e', name: 'e', power: HEAVEN - 1 }), 9);
    });

    it('works at half, which is less than whole and more than nothing', () => {
        const whole = total({ id: 'h', name: 'h', power: HEAVEN + 3 });
        const broken = total({ id: 'h', name: 'h', power: HEAVEN + 3, broken: true });
        expect(broken).toBeLessThan(whole);
        expect(broken).toBeGreaterThan(total(null));
    });

    it('reads the same on the ladder, for a ward or a hull', () => {
        for (const h of range(HEAVEN, IMMORTAL)) {
            expect(theRungItWorksAt(h, h, true)).toBeGreaterThanOrEqual(HEAVEN - 1);
        }
    });

    it('is the one they reach for, over an intact lesser blade', () => {
        const objects: ObjectRecord[] = [
            makeObject({ id: 'earth', name: 'an earth-grade sword', kind: 'artifact', power: HEAVEN - 2, possessorId: 'wu' }),
            makeObject({ id: 'heaven', name: 'a heaven-grade sword', kind: 'artifact', power: HEAVEN + 2, possessorId: 'wu', tags: ['broken'] })
        ];
        const swung = theWeaponTheyFightWith(objects, 'wu');
        expect(swung?.id).toBe('heaven');
        expect(swung?.broken).toBe(true);
    });
});
