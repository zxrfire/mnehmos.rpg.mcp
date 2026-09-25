/**
 * A cauldron or a refining furnace is something a counter sells, and the one you
 * carry is the one you work at.
 *
 *   THE BOARD    mortal and earth-grade vessels are on it, priced as the work of
 *                making one at the grade's gate; nothing above earth is; a
 *                villager's barrow carries the clay pot and never the earth grade
 *   BUYING       puts a row in your hands the vessel read can find
 *   REFINING     reads the cauldron you carry, and says so
 *   THE BENCH    reads the furnace you carry, rolls the work at the yard's odds
 *                plus the furnace, and a failed roll spends the stuff and makes
 *                nothing
 *
 * THE WORLD IS PINNED, because buying writes rows into it.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { makeGameInWorld, type Harness } from './harness';
import { PRICES, THE_MORTAL_BOARD, CASH_PER_STONE } from '../../src/data/cultivation/mortal-world';
import { whatACommissionComesTo } from '../../src/engine/social-leverage/commissioning-a-craft';
import { refiningOrdinalFor } from '../../src/engine/cultivation/who-can-refine-a-grade-of-medicine';
import { addToPouch } from '../../src/server/consolidated/cultivation-support';
import { theBestVesselToHand } from '../../src/engine/world/the-vessel-somebody-works-at';
import { landTheMaking, planTheMaking } from '../../src/web/making-a-thing-at-your-own-bench';
import { RECIPES } from '../../src/data/cultivation/recipes';
import type { WorldState } from '../../src/engine/world/world-state';
import { makeObject, transferPossession } from '../../src/engine/world/possessions';
import { whatHoldingItMeans } from '../../src/engine/world/a-house-holds-its-own';
import { REGIONS } from '../../src/data/cultivation/regions';
import { disciplineWorksIn } from '../../src/data/cultivation/regions/the-map';

const WORLD = 'a-vessel-you-carry';

/** A market town where a refinement sets: some provinces refuse alchemy outright. */
const WHERE_REFINING_WORKS = REGIONS.filter(region => disciplineWorksIn(region.id, 'alchemy'))
    .flatMap(region => region.places).find(place => place.kind === 'market_town')!.name;

describe('the board sells vessels', () => {
    const vessels = PRICES.filter(row => row.gives.kind === 'a_vessel');

    it('prices each at the work of making one at its grade\'s gate', () => {
        expect(vessels.length).toBeGreaterThanOrEqual(4);
        for (const row of vessels) {
            if (row.gives.kind !== 'a_vessel') continue;
            expect(row.cash, row.id).toBe(whatACommissionComesTo(row.gives.grade)! * CASH_PER_STONE);
        }
    });

    it('carries both kinds at mortal and earth grade and nothing above', () => {
        const said = vessels.map(row => row.gives.kind === 'a_vessel' ? `${row.gives.vessel}:${row.gives.grade}` : '');
        for (const one of ['cauldron:mortal', 'refining_furnace:mortal', 'cauldron:earth', 'refining_furnace:earth']) {
            expect(said).toContain(one);
        }
        expect(said.some(one => /heaven|immortal|chaos/.test(one))).toBe(false);
    });

    it('puts the clay pot on a villager\'s barrow and never the earth grade', () => {
        const onABarrow = THE_MORTAL_BOARD.filter(row => row.gives.kind === 'a_vessel');
        expect(onABarrow.length).toBeGreaterThan(0);
        expect(onABarrow.every(row => row.gives.kind === 'a_vessel' && row.gives.grade === 'mortal')).toBe(true);
    });
});

describe('the vessel you carry', () => {
    let h: Harness;
    let cultivatorId: string;
    const world = () => (h.game as unknown as { atHand: WorldState }).atHand;

    beforeAll(async () => {
        h = await makeGameInWorld({ seed: WORLD, worldSeed: WORLD, worldEnabled: true });
        const { cultivator } = await h.game.newRun('Apprentice');
        cultivatorId = cultivator.id;
        h.db.prepare('UPDATE cultivators SET realm_ordinal = ?, spirit_stones = 50000 WHERE id = ?')
            .run(refiningOrdinalFor('earth'), cultivatorId);
        h.repos.cultivators.update(cultivatorId, { location: WHERE_REFINING_WORKS });
        await h.game.act('I look around');
    }, 300_000);

    it('is bought off the board and is in your hands afterwards', async () => {
        const before = h.repos.cultivators.getById(cultivatorId)!.spiritStones;
        await h.game.act('I buy an Earth-grade cauldron');
        const carried = theBestVesselToHand(world().objects, cultivatorId, 'cauldron', refiningOrdinalFor('earth'));
        expect(carried?.grade).toBe('earth');
        expect(h.repos.cultivators.getById(cultivatorId)!.spiritStones).toBeLessThan(before);
    }, 300_000);

    it('is the cauldron a refinement is worked in, and the answer says so', async () => {
        const recipe = RECIPES.find(row => row.id === 'recipe-minor-healing')!;
        for (const ing of recipe.ingredients) addToPouch(h.db, cultivatorId, ing.itemId, 'herb', ing.quantity);
        const turn = await h.game.act(`I refine the ${recipe.name}`) as unknown as {
            narration: string; toolCalls: { summary: string }[];
        };
        const said = `${turn.narration} ${turn.toolCalls.map(c => c.summary).join(' ')}`;
        expect(said).toMatch(/Worked in Earth-grade cauldron, earth grade, which added 6/);
    }, 300_000);

    it('is the furnace a piece of work is rolled at, and a failed roll makes nothing', async () => {
        await h.game.act('I buy an Earth-grade refining furnace');
        const cultivator = h.repos.cultivators.getById(cultivatorId)!;
        const plan = planTheMaking({ db: h.db, objects: world().objects, cultivator, said: 'a sword' });
        expect(plan.kind).toBe('make');
        expect(plan.vessel?.grade).toBe('earth');
        expect(plan.odds?.rolled).toBe(true);
        expect(plan.odds!.fromTheVessel).toBeGreaterThan(0);

        const failed = landTheMaking({ db: h.db, objects: world().objects, cultivator, plan, today: 1, roll: 0.99999 });
        expect(failed.minted).toBeNull();
        expect(failed.lines.join(' ')).toMatch(/did not come off whole/);
        const made = landTheMaking({ db: h.db, objects: world().objects, cultivator, plan, today: 2, roll: 0 });
        expect(made.minted?.possessorId).toBe(cultivatorId);
    }, 300_000);

    it('and a furnace the house lent is said to be the house\'s', () => {
        const house = world().factions[0]!;
        const lent = transferPossession(makeObject({
            id: 'a-lent-furnace', name: 'the house furnace', kind: 'artifact',
            ownerId: house.id, ownerName: house.name, possessorId: null,
            tags: ['refining_furnace', 'grade:heaven'], data: { grade: 'heaven' }
        }), { onDay: 1, toHolderId: cultivatorId, toHolderName: 'Apprentice', how: 'lent' });
        const objects = [...world().objects.filter(o => o.possessorId !== cultivatorId || !o.tags.includes('refining_furnace')), lent];
        const cultivator = h.repos.cultivators.getById(cultivatorId)!;
        h.db.prepare('UPDATE cultivators SET realm_ordinal = ? WHERE id = ?').run(refiningOrdinalFor('heaven'), cultivatorId);
        const plan = planTheMaking({
            db: h.db, objects, cultivator: { ...cultivator, realmOrdinal: refiningOrdinalFor('heaven') }, said: 'a sword',
            houseIds: new Set(world().factions.map(f => f.id))
        });
        expect(plan.vessel?.objectId).toBe('a-lent-furnace');
        expect(plan.lines.join(' ')).toContain(whatHoldingItMeans('lent_by_their_house')!);
    });
});
