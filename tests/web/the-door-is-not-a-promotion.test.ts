/**
 * Leaving a house and walking back in was a free promotion.
 *
 * Measured in play, two consecutive actions on the same turn:
 *
 *   "I leave the sect"           -> "No longer of Azure Dew Sect, where the rank
 *                                    was Dew Servant."
 *   "I ask about joining a sect" -> "Taken on by Azure Dew Sect, ranked Dew Elder."
 *
 * Dew Servant is rank 0 and Dew Elder is rank 3. Entry rank is computed from
 * ordinal ALONE - deliberately, because what a stranger is seated by is what
 * they visibly are - while promotion additionally requires contribution and
 * SPENDS it. So a member who had climbed but not served could convert ordinal
 * into rank by using the door twice, bypassing the entire contribution economy
 * that missions exist to feed.
 *
 * The entry rule is not the defect and is not changed here. The defect is that
 * `removeMember` deleted the row outright, so a returning member read as a
 * stranger to a house that knows exactly what they were.
 */

import { makeGame } from './harness';

function seatOf(db: ReturnType<typeof makeGame>['db'], id: string) {
    return db.prepare(
        'SELECT rank_index, rank_title FROM sect_members WHERE cultivator_id = ?'
    ).get(id) as { rank_index: number; rank_title: string } | undefined;
}

describe('the revolving door', () => {
    it('does not seat a returning member above the rank they left', async () => {
        const { db, game } = makeGame({ seed: 'revolving', worldEnabled: true });
        const { cultivator } = await game.newRun('Door');
        db.prepare('UPDATE cultivators SET spirit_stones = 500 WHERE id = ?').run(cultivator.id);

        await game.act('I join the Azure Dew Sect');
        const joined = seatOf(db, cultivator.id)!;
        expect(joined.rank_index).toBe(0);

        // Climb, without earning a single point of contribution. This is the
        // exact state the exploit converted into rank.
        db.prepare('UPDATE cultivators SET realm_ordinal = 16 WHERE id = ?').run(cultivator.id);

        await game.act('I leave the sect');
        const back = await game.act('I ask about joining a sect');

        expect(seatOf(db, cultivator.id)!.rank_index, 'the door handed out free ranks')
            .toBe(joined.rank_index);
        // And it says why, or the house looks as though it misjudged them.
        expect(back.narration).toMatch(/has had .* before|takes them back at the seat/i);
    }, 120_000);

    /**
     * The cap only ever caps. Somebody who left a house they had never risen in
     * is unaffected, and a genuine stranger is still seated by what they are -
     * which is the rule that stops a False Immortal enrolling as an outer
     * disciple, and it is not being undone.
     */
    it('still seats a genuine stranger by what they visibly are', async () => {
        const { db, game } = makeGame({ seed: 'stranger', worldEnabled: true });
        const { cultivator } = await game.newRun('Stranger');
        db.prepare(
            'UPDATE cultivators SET spirit_stones = 500, realm_ordinal = 16 WHERE id = ?'
        ).run(cultivator.id);

        await game.act('I join the Azure Dew Sect');

        expect(seatOf(db, cultivator.id)!.rank_index, 'a stranger was capped by nothing')
            .toBeGreaterThan(0);
    }, 120_000);
});
