/**
 * The condition that kills most runs, and whether anything in the world answers it.
 *
 * Statistical playtesting on this build: of twelve rogue runs, six died of
 * `untreated_injuries` and six of starvation, median peak ordinal 3 of 47,
 * median age at death 22. Of six sect runs, five died of untreated injuries.
 * Every sample is dominated by torn meridians, so what a player can actually DO
 * about one is the most load-bearing question in the game.
 *
 * These assert the routes exist and are honest, not that they are cheap.
 */

import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { makeGame, planned, cultivatorRow } from './harness';
import { PILLS } from '../../src/data/cultivation/pills';
import { PRICES } from '../../src/data/cultivation/mortal-world';

/** A cultivator carrying the three wounds the report carried, with money. */
async function wounded(seed = 'meridian-routes') {
    const { db, game } = makeGame({ seed, worldEnabled: true });
    const { cultivator } = await game.newRun('Torn');
    db.prepare('UPDATE cultivators SET spirit_stones = 5000 WHERE id = ?').run(cultivator.id);
    for (const [severity, source] of [
        ['crippling', 'qi_deviation'],
        ['serious', 'qi_deviation'],
        ['minor', 'qi_deviation']
    ] as const) {
        db.prepare(
            `INSERT INTO cultivator_injuries
             (id, cultivator_id, severity, source, description, sustained_on_turn, treated,
              cultivation_penalty, breakthrough_penalty)
             VALUES (?, ?, ?, ?, ?, 1, 0, 0.1, 0.05)`
        ).run(randomUUID(), cultivator.id, severity, source, `A ${severity} meridian injury.`);
    }
    return { db, game, cultivator };
}

const untreated = (db: Database.Database, id: string): number =>
    (db.prepare(
        'SELECT COUNT(*) AS n FROM cultivator_injuries WHERE cultivator_id = ? AND treated = 0'
    ).get(id) as { n: number }).n;

const stones = (db: Database.Database, id: string): number =>
    Number(cultivatorRow(db, id).spirit_stones);

describe('the catalog holds a cure', () => {
    it('has pills that close meridians, and prices them on the mortal board', () => {
        expect(PILLS.some(p => p.effect === 'treat_injury')).toBe(true);
        expect(PRICES.some(p => p.category === 'medicine' && /pill/i.test(p.name))).toBe(true);
    });
});

describe('the market board', () => {
    /**
     * The board is sorted cheapest-first and read out eight lines deep, so
     * medicine at 2,000-6,000 cash sat below millet, a ferry crossing and a
     * night at an inn and was never once shown. Reported from play as "no
     * settlement sells pills at all"; they were on the board the whole time and
     * off the bottom of the page.
     */
    it('shows medicine to somebody who asks for medicine', async () => {
        const { game } = await wounded('board-medicine');
        const asked = await game.act('what medicine is for sale');
        expect(planned(asked).action).toBe('market');
        expect(asked.narration).toMatch(/Pill/i);
    }, 60_000);

    it('answers "what pills are for sale" at all', async () => {
        const { game } = await wounded('board-pills');
        expect(planned(await game.act('what pills are for sale')).action).toBe('market');
    }, 60_000);
});

describe('mortal care and a torn meridian', () => {
    /**
     * The defect that mattered most: the game charged 27 spirit stones for
     * three courses of splints against three meridian wounds, and the course's
     * own catalog note says it "cannot touch a meridian". Selling somebody a
     * treatment you have told them will not work, for the condition about to
     * kill them, is worse than refusing the sale.
     */
    it('does not quietly sell splints as an answer to torn meridians', async () => {
        const { db, game, cultivator } = await wounded('care-vs-meridian');
        const before = untreated(db, cultivator.id);
        const stonesBefore = stones(db, cultivator.id);

        const acted = await game.act('I treat my injuries');

        const after = untreated(db, cultivator.id);
        const stonesAfter = stones(db, cultivator.id);

        // Either it closed them, or it did not take the money. What must not
        // happen is money out and wounds unchanged.
        const closed = after < before;
        const charged = stonesAfter < stonesBefore;
        expect(
            closed || !charged,
            `charged ${stonesBefore - stonesAfter} stones and closed nothing: ${acted.narration}`
        ).toBe(true);
    }, 60_000);

    /**
     * And whichever way that resolves, the player has to be told what WOULD
     * work. A refusal that names no route is the ceiling-message defect again.
     */
    it('names what would actually close one', async () => {
        const { game } = await wounded('care-names-the-cure');
        const acted = await game.act('I treat my injuries');
        expect(acted.narration).toMatch(/pill|alchem|refine/i);
    }, 60_000);
});
