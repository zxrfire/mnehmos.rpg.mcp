/**
 * Food is bought where somebody sells it, and the pack is what there is anywhere else.
 *
 * Played blind: a starving outsider at the Azure Dew Sect's gate said "i need to eat something
 * before i pass out", and a bowl was bought for a spirit stone with nothing saying where, so the
 * narration still had them starving. The town below the wall was selling it all along.
 */
import { describe, expect, it } from 'vitest';

import { REGIONS } from '../../src/data/cultivation/regions';
import { FLAG_RATIONS_HELD } from '../../src/web/flag-keys';
import { readFlag, writeFlag } from '../../src/server/consolidated/cultivation-support.js';
import { makeGameInWorld } from './harness';

const A_WAYSTATION = REGIONS.flatMap(region => region.places).find(place => place.kind === 'waystation')!;

async function hungry(seed: string, where: (world: NonNullable<Awaited<ReturnType<typeof makeGameInWorld>>['game']['atHand']>) => string) {
    const { game, repos, db } = await makeGameInWorld({ seed, worldSeed: 'a-xianxia-run' });
    const { cultivator } = await game.newRun('Ke Yan');
    repos.cultivators.update(cultivator.id, { location: where(game.atHand!), satiety: 20, spiritStones: 10 });
    return { game, repos, db, id: cultivator.id };
}

describe('food is bought where somebody sells it', () => {
    it('is bought at the inn below a house gate, and says so', async () => {
        const at = await hungry('food-gate', world => world.locations.find(row => row.kind === 'sect_seat')!.name);
        const ate = await at.game.act('I eat');
        expect(ate.narration).toMatch(/in the town below the gate/);
        expect(at.repos.cultivators.getById(at.id)!.spiritStones).toBe(9);
    }, 240_000);

    it('comes out of the pack where nobody sells it, and costs nothing', async () => {
        expect(A_WAYSTATION, 'the catalog has no waystation').toBeDefined();
        const at = await hungry('food-pack', () => A_WAYSTATION.name);
        writeFlag(at.db, at.id, FLAG_RATIONS_HELD, '3');
        const ate = await at.game.act('I eat');
        expect(ate.narration).toMatch(/open a sack of dry food from your pack/);
        expect(readFlag(at.db, at.id, FLAG_RATIONS_HELD)).toBe('2');
        expect(at.repos.cultivators.getById(at.id)!.spiritStones).toBe(10);
        expect(at.repos.cultivators.getById(at.id)!.satiety).toBe(100);
    }, 240_000);

    it('is refused with an empty pack where nobody sells it, and dry food is not bought there', async () => {
        const at = await hungry('food-none', () => A_WAYSTATION.name);
        const ate = await at.game.act('I eat');
        expect(ate.narration).toMatch(/Nobody here sells food/);
        expect(at.repos.cultivators.getById(at.id)!.satiety).toBe(20);
        const bought = await at.game.act('I buy food for the road');
        expect(bought.narration).toMatch(/Nobody here sells food|Nobody here sells dry food/);
        expect(at.repos.cultivators.getById(at.id)!.spiritStones).toBe(10);
    }, 240_000);
});
