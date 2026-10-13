/**
 * A ship stopped part-way leaves its passenger at sea, and the voyage goes on from there.
 *
 * Before this, a band that stopped a ship put the passenger back at the port they sailed from,
 * whatever the day: stopped on day 17 of 27, and standing on the quay they left. The owner's
 * ruling was an ocean area for the ship to be in mid-voyage. So a stop leaves them aboard, on
 * open water (`a-ship-at-sea.ts`), among whoever the world has on that water, three at most in
 * the foreground. Time aboard is time the ship sails, on the hull's rations and then the pack,
 * and it carries on to where it was bound on the days that were left. It turns back only when
 * the stop cost it the crew while going back is still the shorter way (`canTurnBack`).
 *
 * Played on `road-world`, with the seeds found by sweeping: `sea-6` is the one stop in forty on
 * the Estuary Tideway (the crew lost on day 6, past the middle); on the Eastern Tideway out of
 * Sweet Spring Island on day 100, `east-333` is stopped past the middle out on the Bitter
 * Crossing, `east-64` loses its crew early and turns back, and `east-12` is stopped by a band
 * whose leader comes at the passenger.
 *
 * RE-PINNED when the ship's named crew took the place of four unnamed guards: three or four
 * defenders is a different escort, so the band that attacks is drawn differently. `east-46`,
 * `east-58` and `east-27` stopped nothing afterwards; the new seeds were found by sweeping 420.
 * The later suite's early seed retains a named foreground defender even though
 * its background crew loses. Integration exposed the earlier fixture correction's
 * mistaken assumption that any survivor means the escort held. The actual background
 * defeat still turns the ship back before the midpoint; no death of the whole crew
 * is required. The late seed has no ordinary aboard crowd; sharing its ocean
 * does not put strangers aboard. Read the actual surviving crew and course.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';
import { recordedVoyage } from '../../src/web/a-ship-at-sea';
import { shipPassengerAt } from '../../src/engine/world/passenger-on-a-vessel';
import { routineTime } from '../../src/engine/world/npc-routines';

const WORLD = 'road-world';
const AT_SEA = /At sea on [^,]+, day (\d+) of (\d+), bound for ([^.]+)\./;

async function stoppedOnTheRiverPassage(rations = 0) {
    const harness = await makeGameInWorld({ seed: 'sea-6', worldSeed: WORLD });
    await harness.game.newRun('Rider');
    const id = harness.game.state().cultivator.id;
    harness.db.prepare("UPDATE cultivators SET location = 'Emerald Water City', spirit_stones = 500 WHERE id = ?").run(id);
    if (rations > 0) {
        harness.db.prepare(`
            INSERT INTO cultivator_flags (cultivator_id, key, value, updated_at)
            VALUES (?, 'rations_held', ?, datetime('now'))
            ON CONFLICT(cultivator_id, key) DO UPDATE SET value = excluded.value
        `).run(id, String(rations));
    }
    const stopped = await harness.game.act('I take the ship to Sweet Spring Island');
    return { ...harness, id, stopped };
}

async function stoppedOnTheEasternPassage(seed: string) {
    const harness = await makeGameInWorld({ seed, worldSeed: WORLD });
    await harness.game.newRun('Rider');
    const id = harness.game.state().cultivator.id;
    harness.db.prepare("UPDATE cultivators SET location = 'Sweet Spring Island', spirit_stones = 500 WHERE id = ?").run(id);
    harness.db.prepare('UPDATE runs SET elapsed_days = 100 WHERE cultivator_id = ?').run(id);
    const stopped = await harness.game.act('I take the ship to Cloud Gate');
    return { ...harness, id, stopped };
}

describe('a ship at sea', () => {
    it('leaves the passenger aboard where the ship stopped, and the sheet and a look say where', async () => {
        const { game, stopped } = await stoppedOnTheRiverPassage();

        const where = AT_SEA.exec(stopped.narration);
        expect(where).not.toBeNull();
        const [, day, , bound] = where!;
        expect(bound).toBe('Sweet Spring Island');
        // Days sailed are whole days; the run's clock also holds the walk to the landing and the hour it left.
        expect(Math.floor(game.state().run.elapsedDays)).toBe(Number(day));
        expect(['Emerald Water City', 'Sweet Spring Island']).not.toContain(game.state().cultivator.location);

        expect((await game.act('look around')).narration).toContain(where![0]);
        const sheet = (await game.act('status')).narration;
        expect(sheet).toContain(where![0]);
        expect(sheet).toMatch(/The hull's rations cover \d+ more days?\./);
    }, 120_000);

    it('goes nowhere but where it is bound, and waiting sails it on to port on the days that were left', async () => {
        const { game, stopped } = await stoppedOnTheRiverPassage();
        const [, day, days] = AT_SEA.exec(stopped.narration)!;

        const elsewhere = await game.act('I go to Cloud Gate');
        expect(elsewhere.narration).toMatch(/puts in nowhere before Sweet Spring Island/);
        // Days sailed are whole days; the run's clock also holds the walk to the landing and the hour it left.
        expect(Math.floor(game.state().run.elapsedDays)).toBe(Number(day));

        const waited = await game.act('I wait 2 days');
        expect(AT_SEA.exec(waited.narration)?.[1]).toBe(String(Number(day) + 2));
        expect(Math.floor(game.state().run.elapsedDays)).toBe(Number(day) + 2);

        const landed = await game.act('I wait until we arrive');
        expect(game.state().cultivator.location).toBe('Sweet Spring Island');
        expect(Math.floor(game.state().run.elapsedDays)).toBe(Number(days));
        expect(landed.narration).toMatch(new RegExp(`${days} days by ship from Emerald Water City to Sweet Spring Island`));
    }, 120_000);

    it('feeds the passenger from the hull while it lasts and then from the pack', async () => {
        const { game, db, id } = await stoppedOnTheRiverPassage(1);
        // Empty, so the day the hull's rations do not cover is eaten out of the pack.
        db.prepare('UPDATE cultivators SET satiety = 0 WHERE id = ?').run(id);

        const landed = await game.act('I sail on to Sweet Spring Island');

        expect(game.state().cultivator.location).toBe('Sweet Spring Island');
        // The hull feeds them while its rations last; after that the pack, as much as the belly needs.
        const ran = /The ship's rations ran out on day (\d+) of (\d+); (\d+) rations? came out of the pack/.exec(landed.narration);
        expect(ran).not.toBeNull();
        expect(Number(ran![1])).toBeLessThan(Number(ran![2]));
        const held = db.prepare("SELECT value FROM cultivator_flags WHERE cultivator_id = ? AND key = 'rations_held'")
            .get(id) as { value: string };
        expect(Number(held.value)).toBe(1 - Number(ran![3]));
    }, 120_000);

    it('a sitting aboard sails the ship too, and one longer than the passage ends in port', async () => {
        const { game } = await stoppedOnTheRiverPassage();

        const sat = await game.act('I cultivate for 30 days');

        expect(game.state().cultivator.location).toBe('Sweet Spring Island');
        expect(sat.narration).toMatch(/30 days were asked for; the ship put in at Sweet Spring Island after \d+ days?, and the sitting ended there/);
    }, 120_000);

    it('past the middle of the passage, a ship that lost its crew goes on, among the people on that water', async () => {
        const { game, stopped } = await stoppedOnTheEasternPassage('east-29');

        expect(stopped.narration).toMatch(/The crew did not hold the ship\. It is past the middle of the passage and goes on\./);
        expect(AT_SEA.exec(stopped.narration)?.[3]).toBe('Cloud Gate');
        const aboard = game.present(game.state().cultivator);
        expect(aboard.length).toBeLessThanOrEqual(3);

        // With the crew beaten, the band's leader comes at the passenger, who is no match for them;
        // water bandits may stop it again on the way. Each time, yield and take the seat again.
        for (let leg = 0; leg < 4 && game.state().cultivator.location !== 'Cloud Gate'; leg++) {
            for (let round = 0; round < 3 && game.state().fight; round++) await game.act('I yield');
            await game.act('sail on');
        }
        expect(game.state().cultivator.location).toBe('Cloud Gate');
    }, 120_000);

    it('short of the middle, a background defeat turns back despite a surviving foreground defender', async () => {
        const { game, stopped } = await stoppedOnTheEasternPassage('east-8');

        const claim = recordedVoyage(game.db, game.state().cultivator.id)!;
        const actual = shipPassengerAt(game.atHand!, claim.receiptId!, routineTime(game.atHand!))!;
        expect(actual.crew.some(person => person.status === 'alive')).toBe(true);
        expect(stopped.narration).toMatch(/held: of the crew nobody fell and nobody broke off/);
        expect(stopped.narration).toMatch(/the band had the better of it/);
        expect(stopped.narration).toMatch(/The crew did not hold the ship\. It turns back/);
        expect(AT_SEA.exec(stopped.narration)?.[3]).toBe('Sweet Spring Island');
        expect(actual.toId).toBe(game.atHand!.locations.find(place => place.name === 'Sweet Spring Island')!.id);
    }, 120_000);

    it('a leader who comes at the passenger is fought at sea', async () => {
        const { game, stopped } = await stoppedOnTheEasternPassage('east-8');

        expect(stopped.narration).toMatch(/attacks you/);
        expect(stopped.narration).toMatch(/The fight is open/);
        expect(stopped.narration).toMatch(AT_SEA);
        expect(['Sweet Spring Island', 'Cloud Gate']).not.toContain(game.state().cultivator.location);
    }, 120_000);
});
