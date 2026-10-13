/**
 * The unchanged 300-year played war-ledger control has its own whole file.
 * It passed in the committed-head census and the subsequent full parent file.
 * Separating it keeps focused player-account checks bounded without removing
 * the horizon, its six ordinary fifty-year spans, or any acceptance assertion.
 */
import { beforeAll, afterAll } from 'vitest';
import { makeGameInWorld } from './harness';
import { obligationFromRow } from '../../src/storage/repos/obligation.repo';
import { whatTheirRecordMakesThem } from '../../src/engine/social-leverage/personal-alignment';

function withAdmin(): void {
    const before = process.env.ADMIN_MODE;
    beforeAll(() => { process.env.ADMIN_MODE = 'true'; });
    afterAll(() => {
        if (before === undefined) delete process.env.ADMIN_MODE;
        else process.env.ADMIN_MODE = before;
    });
}

describe('and the world\'s own killers are on the ledger too', () => {
    withAdmin();

    /**
     * The design owner, on a war leaving nothing where a played killing left a
     * grudge: *this is bespoke. a war death is still a grudge. fix it.*
     *
     * Played, because that is the only way this was ever going to be found:
     * the world's wars ran for centuries writing an inherited tie into
     * `WorldState` and nothing at all into the table this reading is over. So
     * the reading measured the player alone, in a world full of killers no
     * record knew about.
     *
     * The span is arranged with ADMIN and nothing else is: the player sits
     * still, and every row asserted on was written by the world fighting its
     * own wars.
     */
    it('writes a war\'s dead into the same table a player\'s killing reaches', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'war-ledger', worldSeed: 'vol-a', adminMode: true
        });
        const { cultivator } = await game.newRun('Bystander');
        // Rations for the span, and a rung that survives it. Arranging.
        db.prepare('UPDATE cultivators SET spirit_stones = 90000000 WHERE id = ?')
            .run(cultivator.id);
        await game.act('ADMIN set_realm 30');

        expect((db.prepare('SELECT COUNT(*) AS n FROM obligations')
            .get() as { n: number }).n).toBe(0);

        for (let i = 0; i < 6; i++) {
            await game.act('ADMIN advance_days years=50 rations=9000');
            await game.act('ADMIN set_realm 30');
        }

        const rows = (db.prepare('SELECT * FROM obligations').all() as never[])
            .map(obligationFromRow);
        const fromAFight = rows.filter(r => r.tags.includes('bout'));
        expect(fromAFight.length).toBeGreaterThan(0);

        // Nobody arranged a war, so every one of them is priced as the open
        // killing it was - the same band a killing in a square gets.
        for (const row of fromAFight) {
            expect(row.tags).toContain('open');
            expect(row.subjectId).not.toBe(cultivator.id);
            expect(['grave', 'serious']).toContain(row.severity);
        }
        expect(fromAFight.some(r => r.severity === 'grave')).toBe(true);

        // One battle, many dead, and each death ONE deed rather than one row
        // per griever. This is the dedupe the reading depends on: without it a
        // victim's family size would price the killer's character.
        const deeds = new Set(fromAFight.map(r => r.triggeringEventId));
        expect(deeds.size).toBeGreaterThan(0);
        expect(deeds.size).toBeLessThan(fromAFight.length);

        // And the reading answers about them, off the same rows and the same
        // function the player is read with. A world in which only the player
        // has a reputation is a world in which nobody else has done anything.
        // A ledger row can name nobody to answer for it, and nobody has no
        // record to read. Proved non-empty so the two assertions below cannot
        // pass on an empty list.
        const killers = [...new Set(fromAFight.map(r => r.subjectId))]
            .filter((id): id is string => id !== null);
        expect(killers.length, 'no fight row names anybody to answer for it')
            .toBeGreaterThan(0);
        const readings = killers.map(id =>
            whatTheirRecordMakesThem({ personId: id, ledger: rows }));
        expect(readings.some(r => r.alignment === 'demonic')).toBe(true);
        expect(readings.every(r => r.alignment !== 'righteous')).toBe(true);
    }, 900_000);
});
