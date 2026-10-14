/**
 * A member who has a wound seen to beside its working infirmary attendant is given the house's
 * own medicine, for contribution, and the count on the shelf goes down. Somebody
 * not on the roll standing in the same room gets nothing from it. This used
 * to buy care in the yard and invent a mortal physician for a stranger there.
 * Physical care now requires its provider; the stock and contribution rule is unchanged.
 * The fixture advances the run clock to the derived working hour: changing
 * world.currentHour alone was overwritten at load and checked a different shift.
 * The player's area is persisted with standIn, its sole writer, rather than update.
 *
 * Pinned world and seed. The house is the first live one with a seat and five or
 * more Clear Meridian Pills on its shelf, read off the world rather than named.
 * The universal-work ruling also permits that existing finite shelf in ordinary
 * quarters. The additional fixture omits the dedicated infirmary before the
 * played care turn; it supplies neither another room nor new medicine.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';
import { getPill } from '../../src/data/cultivation/pills.js';
import { onTheShelf, whatTheShelfChargesAMember } from '../../src/engine/world/house-wound-medicine.js';
import type { WorldState } from '../../src/engine/world/world-state.js';
import { purposeOf } from '../../src/engine/world/architecture.js';
import { roomForHouseWork } from '../../src/engine/world/where-a-house-does-its-work.js';
import { whoDispensesAtTheHouse } from '../../src/engine/world/who-is-actually-seeing-to-wounds.js';
import { npcsWhereTheyStand, theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';

const WORLD = 'a-member-is-seen-to';
const PILL = 'pill-clear-meridian';

async function standingInTheInfirmary(seed: string, member: boolean, dedicated = true) {
    const harness = await makeGameInWorld({ seed, worldSeed: WORLD });
    const { run, cultivator } = await harness.game.newRun('Hurt');
    const world = (await harness.game.loadWorld())! as WorldState;
    const house = world.factions.find(f =>
        f.dissolvedOnDay === null && f.seatLocationId !== null
        && harness.repos.sects.getById(f.id) !== null
        && onTheShelf(f, PILL) >= 5
        && world.locations.some(l => l.controllingFactionId === f.id && purposeOf(l) === 'infirmary')
        && Array.from({ length: 24 }, (_, i) => i).some(hour => {
            world.currentHour = hour;
            return whoDispensesAtTheHouse(world, f.id) !== null;
        }))!;
    expect(house, 'a house with a seat and Clear Meridian Pills on its shelf').toBeDefined();
    if (member) {
        harness.repos.sects.addMember(house.id, cultivator.id, 1);
        harness.repos.sects.addContribution(house.id, cultivator.id, 500);
    }
    if (!dedicated) world.locations = world.locations.filter(place =>
        !(place.controllingFactionId === house.id && purposeOf(place) === 'infirmary'));
    const infirmary = roomForHouseWork(world.locations, house.id, 'infirmary')!;
    expect(infirmary, 'the house must have actual care ground').toBeDefined();
    const dispenser = whoDispensesAtTheHouse(world, house.id)!;
    const area = theAreasOf(world, infirmary).whereIs.get(dispenser.id)!;
    expect(area, 'the attendant must actually stand in the infirmary').toBeDefined();
    harness.repos.cultivators.update(cultivator.id, { location: infirmary.name });
    harness.repos.cultivators.standIn(cultivator.id, area);
    harness.game.atHand = world;
    harness.game.theWorldMoved();
    harness.db.prepare('UPDATE runs SET elapsed_days = ? WHERE id = ?').run(Math.floor(run.elapsedDays) + world.currentHour! / 24, run.id);
    const playedWorld = (await harness.game.loadWorld())!;
    expect(whoDispensesAtTheHouse(playedWorld, house.id)?.id, `attendant at played hour ${playedWorld.currentHour}`).toBe(dispenser.id);
    const patient = harness.repos.cultivators.getById(cultivator.id)!;
    expect(patient.standingIn).toBe(area);
    expect(npcsWhereTheyStand(playedWorld, infirmary, patient.standingIn, { id: cultivator.id, sectId: member ? house.id : null })
        .some(n => n.id === dispenser.id), `attendant ${dispenser.id} beside patient in ${area}`).toBe(true);
    harness.db.prepare('UPDATE cultivators SET spirit_stones = 500 WHERE id = ?').run(cultivator.id);
    harness.db.prepare(
        `INSERT INTO cultivator_injuries
         (id, cultivator_id, severity, source, description, sustained_on_turn, treated,
          cultivation_penalty, breakthrough_penalty)
         VALUES (?, ?, 'serious', 'combat', 'A torn meridian.', 1, 0, 0.1, 0.05)`
    ).run(randomUUID(), cultivator.id);
    return { ...harness, run, cultivator, house };
}

const untreated = (h: Awaited<ReturnType<typeof standingInTheInfirmary>>): number =>
    (h.db.prepare('SELECT COUNT(*) AS n FROM cultivator_injuries WHERE cultivator_id = ? AND treated = 0')
        .get(h.cultivator.id) as { n: number }).n;

const shelf = (h: Awaited<ReturnType<typeof standingInTheInfirmary>>): number =>
    onTheShelf(h.game.atHand!.factions.find(f => f.id === h.house.id)!, PILL);

describe('a member beside their infirmary attendant', () => {
    it('uses its finite medicine in existing quarters when there is no dedicated infirmary', async () => {
        const h = await standingInTheInfirmary('seen-to-quarters', true, false);
        const before = shelf(h);
        const merit = h.repos.sects.getMembership(h.cultivator.id)!.contribution;
        const locations = h.game.atHand!.locations.length;
        expect(h.game.atHand!.locations.some(place => place.controllingFactionId === h.house.id
            && purposeOf(place) === 'infirmary')).toBe(false);
        expect(purposeOf(roomForHouseWork(h.game.atHand!.locations, h.house.id, 'infirmary')!)).toBe('dormitory');
        const turn = await h.game.act('I treat my injuries');
        expect(turn.toolCalls.some(call => call.name === 'world.whatTheShelfGivesAMember' && call.ok), turn.narration).toBe(true);
        expect(untreated(h)).toBe(0);
        expect(shelf(h)).toBe(before - 1);
        expect(merit - h.repos.sects.getMembership(h.cultivator.id)!.contribution)
            .toBe(whatTheShelfChargesAMember(getPill(PILL)!));
        expect(h.game.atHand!.locations.length).toBe(locations);
    }, 120_000);

    it('is given one from the house\'s shelf, for contribution, and the shelf is one lighter', async () => {
        const h = await standingInTheInfirmary('seen-to-member', true);
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
        const h = await standingInTheInfirmary('seen-to-member-short', true);
        h.repos.sects.addContribution(h.house.id, h.cultivator.id, -10_000);

        const turn = await h.game.act('I treat my injuries');

        expect(turn.toolCalls.some(c => c.name === 'world.whatTheShelfGivesAMember')).toBe(false);
        expect(turn.narration).toMatch(new RegExp(`${whatTheShelfChargesAMember(getPill(PILL)!)} contribution`));
    }, 120_000);
});

describe('somebody not on the roll, in the same infirmary', () => {
    it('gets nothing from the shelf and must visit an actual physician', async () => {
        const h = await standingInTheInfirmary('seen-to-stranger', false);
        const turn = await h.game.act('I treat my injuries');

        expect(turn.toolCalls.some(c => c.name === 'world.whatTheShelfGivesAMember')).toBe(false);
        expect(turn.toolCalls.some(c => c.name === 'engine.treatWorstInjuries')).toBe(false);
        expect(turn.narration).not.toMatch(/out of its own medicine/);
    }, 120_000);
});
