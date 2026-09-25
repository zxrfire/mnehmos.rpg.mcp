/**
 * A member who has a wound seen to at their house's seat is given the house's
 * own medicine, for contribution, and the count on the shelf goes down. Somebody
 * not on the roll standing in the same yard gets nothing from it.
 *
 * Pinned world and seed. The house is the first live one with a seat and five or
 * more Clear Meridian Pills on its shelf, read off the world rather than named.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';
import { getPill } from '../../src/data/cultivation/pills.js';
import { onTheShelf, whatTheShelfChargesAMember } from '../../src/engine/world/house-wound-medicine.js';
import type { WorldState } from '../../src/engine/world/world-state.js';

const WORLD = 'a-member-is-seen-to';
const PILL = 'pill-clear-meridian';

async function standingInTheYard(seed: string, member: boolean) {
    const harness = await makeGameInWorld({ seed, worldSeed: WORLD });
    const { run, cultivator } = await harness.game.newRun('Hurt');
    const world = (await harness.game.loadWorld())! as WorldState;
    const house = world.factions.find(f =>
        f.dissolvedOnDay === null && f.seatLocationId !== null
        && harness.repos.sects.getById(f.id) !== null
        && onTheShelf(f, PILL) >= 5)!;
    expect(house, 'a house with a seat and Clear Meridian Pills on its shelf').toBeDefined();
    if (member) {
        harness.repos.sects.addMember(house.id, cultivator.id, 1);
        harness.repos.sects.addContribution(house.id, cultivator.id, 500);
    }
    const seat = world.locations.find(l => l.id === house.seatLocationId)!;
    harness.repos.cultivators.update(cultivator.id, { location: seat.name });
    harness.db.prepare('UPDATE cultivators SET spirit_stones = 500 WHERE id = ?').run(cultivator.id);
    harness.db.prepare(
        `INSERT INTO cultivator_injuries
         (id, cultivator_id, severity, source, description, sustained_on_turn, treated,
          cultivation_penalty, breakthrough_penalty)
         VALUES (?, ?, 'serious', 'combat', 'A torn meridian.', 1, 0, 0.1, 0.05)`
    ).run(randomUUID(), cultivator.id);
    return { ...harness, run, cultivator, house };
}

const untreated = (h: Awaited<ReturnType<typeof standingInTheYard>>): number =>
    (h.db.prepare('SELECT COUNT(*) AS n FROM cultivator_injuries WHERE cultivator_id = ? AND treated = 0')
        .get(h.cultivator.id) as { n: number }).n;

const shelf = (h: Awaited<ReturnType<typeof standingInTheYard>>): number =>
    onTheShelf(h.game.atHand!.factions.find(f => f.id === h.house.id)!, PILL);

describe('a member at their seat', () => {
    it('is given one from the house\'s shelf, for contribution, and the shelf is one lighter', async () => {
        const h = await standingInTheYard('seen-to-member', true);
        await h.game.loadWorld();
        const before = shelf(h);
        const merit = h.repos.sects.getMembership(h.cultivator.id)!.contribution;

        const turn = await h.game.act('I treat my injuries');

        expect(turn.toolCalls.some(c => c.name === 'world.whatTheShelfGivesAMember' && c.ok), turn.narration)
            .toBe(true);
        expect(untreated(h)).toBe(0);
        expect(shelf(h)).toBe(before - 1);
        expect(merit - h.repos.sects.getMembership(h.cultivator.id)!.contribution)
            .toBe(whatTheShelfChargesAMember(getPill(PILL)!));
        expect(turn.narration).toMatch(/Clear Meridian Pill/);
    }, 120_000);

    it('is told the price and sent on to a physician when they have not the contribution', async () => {
        const h = await standingInTheYard('seen-to-member-short', true);
        h.repos.sects.addContribution(h.house.id, h.cultivator.id, -10_000);

        const turn = await h.game.act('I treat my injuries');

        expect(turn.toolCalls.some(c => c.name === 'world.whatTheShelfGivesAMember')).toBe(false);
        expect(turn.narration).toMatch(new RegExp(`${whatTheShelfChargesAMember(getPill(PILL)!)} contribution`));
    }, 120_000);
});

describe('somebody not on the roll, in the same yard', () => {
    it('gets nothing from the shelf and goes to a physician', async () => {
        const h = await standingInTheYard('seen-to-stranger', false);
        const turn = await h.game.act('I treat my injuries');

        expect(turn.toolCalls.some(c => c.name === 'world.whatTheShelfGivesAMember')).toBe(false);
        expect(turn.toolCalls.some(c => c.name === 'engine.treatWorstInjuries')).toBe(true);
        expect(turn.narration).not.toMatch(/out of its own medicine/);
    }, 120_000);
});
