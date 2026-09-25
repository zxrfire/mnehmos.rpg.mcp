/**
 * A part off a kill goes where it fits: the pack, a vehicle with them, or the ground where the beast
 * fell. The owner: "we need bulky stuff to give spirit boats and carriages a reason to exist".
 */
import { describe, expect, it } from 'vitest';

import { aVehicleOf } from '../../src/engine/world/a-vehicle';
import { whatABeastPartTakes, whereAKillIsLeft, whereAPartGoes } from '../../src/engine/world/what-a-beast-part-takes';
import { whatABodyCanCarry } from '../../src/engine/world/what-a-body-can-carry-and-what-a-ring-holds';
import { addToPouch, pouchQuantity } from '../../src/server/consolidated/cultivation-support';
import { makeGameInWorld } from './harness';

const NOTHING = { volume: 0, weight: 0 };

describe('where a part off a kill goes', () => {
    it('is the pack for a boar\'s plate, and a cart or the ground for a tiger\'s pelt', () => {
        const body = whatABodyCanCarry(0);
        expect(whereAPartGoes({ part: whatABeastPartTakes('mat-boar-hide')!, carrying: NOTHING, body, vehicles: [] }).where).toBe('pack');
        const pelt = whatABeastPartTakes('mat-tiger-pelt')!;
        expect(whereAPartGoes({ part: pelt, carrying: NOTHING, body, vehicles: [] }).where).toBe('ground');
        expect(whereAPartGoes({ part: pelt, carrying: NOTHING, body,
            vehicles: [{ id: 'cart', name: 'a drawn carriage', free: { volume: 1000, weight: 800 } }] }).where).toBe('vehicle');
        // And the thousand-year tortoise's belly-plate wants more than a carriage.
        expect(whereAPartGoes({ part: whatABeastPartTakes('mat-tortoise-plastron')!, carrying: NOTHING, body,
            vehicles: [{ id: 'cart', name: 'a drawn carriage', free: { volume: 1000, weight: 800 } }] }).where).toBe('ground');
    });

    it('is loaded off the ground into a carriage, and will not come out into a pack', async () => {
        const { game, db } = await makeGameInWorld({ seed: 'a-tiger-left', worldSeed: 'a-xianxia-run' });
        const { cultivator } = await game.newRun('Ke Yan');
        const here = game.worldPlaceOf(cultivator)!;
        const left = whereAKillIsLeft(here, cultivator.id);
        addToPouch(db, left, 'mat-tiger-pelt', 'herb', 1);
        game.atHand!.objects.push(aVehicleOf({ id: 'carriage', conveyanceId: 'conv-carriage-mortal',
            ownerId: cultivator.id, ownerName: 'Ke Yan', at: here }));

        await game.act('i load the tiger pelt into my carriage');
        expect(pouchQuantity(db, left, 'mat-tiger-pelt')).toBe(0);
        expect(pouchQuantity(db, 'carriage', 'mat-tiger-pelt')).toBe(1);

        const out = await game.act('i take the tiger pelt out of my carriage');
        expect(out.toolCalls.some(call => call.action === 'carry' && !call.ok)).toBe(true);
        expect(pouchQuantity(db, 'carriage', 'mat-tiger-pelt')).toBe(1);
    }, 180_000);
});
