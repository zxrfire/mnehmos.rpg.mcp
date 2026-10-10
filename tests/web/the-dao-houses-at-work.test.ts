/**
 * The owner's rulings on the Dao houses, 2026-10-09, played:
 * - the Jade Register Hall registers who comes into a city that matters, for a small yearly fee;
 * - the Flowing Star office tells you where to find somebody or something, or gives its best guess;
 * - the Ninefold Karma Palace is one place people visit to learn karma.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { shopfrontSitesOf } from '../../src/engine/world/a-dao-house-shopfront';
import { askingTheFlowingStarOffice, AN_OFFICE_QUESTION_STONES, THE_STAR_HOUSE_ID } from '../../src/web/asking-the-flowing-star-office';
import { enteringAtTheJadeGate } from '../../src/web/entering-a-city-at-the-jade-gate';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { routineOf } from '../../src/engine/world/npc-routines';

async function opened(seed: string) {
    const h = await makeGameInWorld({ seed, worldSeed: 'capital-play' });
    const { cultivator } = await h.game.newRun('Visitor');
    const world = h.game.atHand ?? (await h.game.loadWorld())!;
    return { ...h, world, cultivator };
}

describe('the Jade Register gate', () => {
    it('enters whoever comes into a city that matters, and takes the year\'s fee once', async () => {
        const h = await opened('jade-gate');
        const city = shopfrontSitesOf(h.world, 'house-jade-register')[0]!;
        h.repos.cultivators.update(h.cultivator.id, { spiritStones: 30 });
        const before = { id: h.cultivator.id, location: 'somewhere else' };
        h.repos.cultivators.update(h.cultivator.id, { location: city.name });
        const first = enteringAtTheJadeGate(h.game, before);
        expect(first.join(' ')).toMatch(/Jade Register/);
        const paid = h.repos.cultivators.getById(h.cultivator.id)!.spiritStones;
        expect(paid).toBeLessThan(30);
        const again = enteringAtTheJadeGate(h.game, before);
        expect(again.join(' ')).toMatch(/already on the register/);
        expect(h.repos.cultivators.getById(h.cultivator.id)!.spiritStones).toBe(paid);
        // Nothing happens where the player did not move.
        expect(enteringAtTheJadeGate(h.game, { id: h.cultivator.id, location: city.name })).toEqual([]);
    }, 180_000);
});

describe('the Flowing Star office', () => {
    it('places a living person for a fee, from where they are this hour', async () => {
        const h = await opened('star-office');
        const office = shopfrontSitesOf(h.world, THE_STAR_HOUSE_ID)[0]!;
        const clerk = h.world.npcs.find(n => n.status === 'alive' && n.factionId === THE_STAR_HOUSE_ID
            && n.activity?.kind === 'stationed' && n.locationId === office.id)!;
        expect(clerk, 'nobody keeps the office').toBeDefined();
        const area = theAreasOf(h.world, office).whereIs.get(clerk.id)!;
        h.repos.cultivators.update(h.cultivator.id, { location: office.name, spiritStones: 50 });
        h.repos.cultivators.standIn(h.cultivator.id, area);
        h.game.theWorldMoved();
        const sought = h.world.npcs.find(n => n.status === 'alive' && n.id !== clerk.id
            && routineOf(h.world, n).locationId !== null && n.factionId !== null)!;
        const me = h.repos.cultivators.getById(h.cultivator.id)!;
        const answer = askingTheFlowingStarOffice(h.game, me, clerk.id, `where can I find ${sought.name}`)!;
        expect(answer, 'the office did not answer a where-question').not.toBeNull();
        const where = h.world.locations.find(l => l.id === routineOf(h.world, sought).locationId)!;
        expect(answer.facts.lines.join(' ')).toContain(where.name);
        expect(h.repos.cultivators.getById(h.cultivator.id)!.spiritStones).toBe(50 - AN_OFFICE_QUESTION_STONES);
        // Something nobody can place gets a guess, said as one.
        const guess = askingTheFlowingStarOffice(h.game, h.repos.cultivators.getById(h.cultivator.id)!, clerk.id,
            'where can I find a dao partner')!;
        expect(guess.facts.lines.join(' ')).toMatch(/best guess/i);
    }, 180_000);
});

describe('the Ninefold Karma Palace', () => {
    it('opens karma to a visitor standing on its ground, and no other Dao house does to a stranger', async () => {
        const h = await opened('karma-palace');
        const palace = h.world.factions.find(f => f.id === 'house-ninefold-karma')!;
        const ground = h.world.locations.find(l => l.id === palace.seatLocationId)!;
        h.repos.cultivators.update(h.cultivator.id, { location: ground.name });
        const visitor = h.repos.cultivators.getById(h.cultivator.id)!;
        const context = h.game.understandingFor(h.game.currentRun().run, visitor);
        expect(context.tradition?.subject).toBe('karma');

        const tower = h.world.factions.find(f => f.id === 'house-flowing-light')!;
        h.repos.cultivators.update(h.cultivator.id, { location: h.world.locations.find(l => l.id === tower.seatLocationId)!.name });
        const stranger = h.repos.cultivators.getById(h.cultivator.id)!;
        expect(h.game.understandingFor(h.game.currentRun().run, stranger).tradition ?? null).toBeNull();
    }, 180_000);
});
