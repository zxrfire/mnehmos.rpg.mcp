/**
 * The same sentence, at three heights, through the real tool surface.
 *
 * The engine suite pins the band table. This one pins what a PLAYER gets, by
 * driving `cultivation_manage` exactly as a narrator would and asserting that
 * ordinal 5, ordinal 25 and ordinal 45 do not come back with the same answer.
 *
 * That is the whole defect this exists to prevent returning: across a sixteen
 * position by thirty ask sweep, twenty-three of the thirty asks gave an
 * identical answer at every height on the ladder, and `I take any work I can
 * get` was strictly WORSE at height than at the bottom.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleCultivationManage } from '../../src/server/consolidated/cultivation-manage.js';
import { adminResult } from '../../src/server/consolidated/admin-manage.js';
import { closeDb, getDb } from '../../src/storage/index.js';

const ctx = { sessionId: 'test' };

function payload(response: { content: Array<{ text: string }> }): any {
    const text = response.content[0].text;
    const match = /<!-- [A-Z_]+_JSON\n([\s\S]*?)\n[A-Z_]+_JSON -->/.exec(text);
    if (match) return JSON.parse(match[1]);
    return JSON.parse(text);
}

const cultivation = async (args: Record<string, unknown>) =>
    payload(await handleCultivationManage(args, ctx));
// ADMIN embeds no machine payload in its text any more - the blob used to be
// dumped straight into the player's narrative log. `adminResult` is the door
// for a caller that wants the object.
const admin = async (args: Record<string, unknown>) => (await adminResult(args)) as any;

/** A cultivator standing in a named market town at a chosen rung. */
async function standingAt(ordinal: number, seed: string) {
    process.env.ADMIN_MODE = 'true';
    const created = await cultivation({
        action: 'create_cultivator',
        name: `Probe ${ordinal}`,
        seed,
        location: 'Sweptground'
    });
    expect(created.error).toBeUndefined();
    if (ordinal > 0) {
        const set = await admin({ action: 'set_realm', ordinal });
        expect(set.error).toBeUndefined();
    }
    return created;
}

describe('the world answers by height, through the tools', () => {
    beforeEach(() => {
        closeDb();
        getDb(':memory:');
        delete process.env.ADMIN_MODE;
    });

    afterEach(() => {
        delete process.env.ADMIN_MODE;
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('I gather what herbs I can find', () => {
        it('gives 5, 25 and 45 different rows, different counts and different spans', async () => {
            const answers: Record<number, any> = {};
            for (const ordinal of [5, 25, 45]) {
                closeDb();
                getDb(':memory:');
                await standingAt(ordinal, `forage-${ordinal}`);
                const result = await cultivation({ action: 'forage' });
                expect(result.error, `ordinal ${ordinal}`).toBeUndefined();
                answers[ordinal] = result;
            }

            // Not the same herb.
            const ids = [answers[5].herb.id, answers[25].herb.id, answers[45].herb.id];
            expect(new Set(ids).size).toBe(3);

            // Not the same grade, and rising.
            expect(answers[5].herb.grade).toBe('mortal');
            expect(['heaven', 'earth']).toContain(answers[25].herb.grade);
            expect(['immortal', 'chaos']).toContain(answers[45].herb.grade);

            // Not the same haul. This is the half that never moved.
            expect(answers[25].quantityFound).toBeGreaterThan(1);
            expect(answers[45].valueTaken).toBeGreaterThan(answers[5].valueTaken * 1_000);

            // And the ground it has stopped searching is reported rather than
            // silently dropped.
            expect(answers[45].walkedPast).toBeGreaterThan(0);
            expect(answers[5].regard.band).toBeDefined();
            expect(answers[45].regard.reaction.length).toBeGreaterThan(40);
        });

        it('shortens the pass when the narrator says they were hurried', async () => {
            await standingAt(25, 'forage-patience');
            const unhurried = await cultivation({
                action: 'forage',
                approach: { patience: 'unhurried', intent: 'I take my time over the ridge' }
            });
            closeDb();
            getDb(':memory:');
            await standingAt(25, 'forage-patience');
            const hurried = await cultivation({
                action: 'forage',
                approach: { patience: 'hurried', intent: 'I grab what I can and go' }
            });

            expect(hurried.daysAsked).toBeLessThan(unhurried.daysAsked);
            expect(hurried.quantityFound).toBeLessThanOrEqual(unhurried.quantityFound);
            // Echoed back untouched, and it decided nothing.
            expect(hurried.regard.intent).toBe('I grab what I can and go');
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('I take any work I can get', () => {
        it('is not worse at height, and never answers with unexplained silence', async () => {
            for (const ordinal of [5, 25, 45]) {
                closeDb();
                getDb(':memory:');
                await standingAt(ordinal, `work-${ordinal}`);
                const board = await cultivation({ action: 'work' });
                expect(board.error, `ordinal ${ordinal}`).toBeUndefined();
                expect(board.work.length, `ordinal ${ordinal} has offers`).toBeGreaterThan(0);
                expect(board.note.length).toBeGreaterThan(40);
                if (board.withheldCount > 0) {
                    expect(board.withheld[0].reason.length).toBeGreaterThan(40);
                }
            }
        });

        it('offers a Tribulation Transcendence cultivator entirely different work', async () => {
            closeDb();
            getDb(':memory:');
            await standingAt(5, 'work-low');
            const low = await cultivation({ action: 'work' });

            closeDb();
            getDb(':memory:');
            await standingAt(45, 'work-high');
            const high = await cultivation({ action: 'work' });

            const lowIds = low.work.map((o: any) => o.id);
            const highIds = high.work.map((o: any) => o.id);
            expect(highIds.filter((id: string) => lowIds.includes(id))).toHaveLength(0);
            // And they are told what is on the board that is not for them.
            expect(high.withheldCount).toBeGreaterThan(0);
        });

        it('refuses a porter\'s job at height with the measured reason, not a shrug', async () => {
            await standingAt(45, 'work-refusal');
            const refused = await cultivation({
                action: 'work',
                occupationId: 'job-porter',
                months: 1
            });
            expect(refused.error).toBe('work_not_put_to_them');
            expect(refused.band).toBe('dismissed');
            expect(refused.gap).toBeGreaterThan(16);
            expect(refused.message.length).toBeGreaterThan(60);
        });

        it('pays the same job differently to somebody far past what it is pitched at', async () => {
            closeDb();
            getDb(':memory:');
            await standingAt(0, 'wage-low');
            const low = await cultivation({ action: 'work', occupationId: 'job-porter', months: 3 });

            closeDb();
            getDb(':memory:');
            await standingAt(12, 'wage-high');
            const high = await cultivation({ action: 'work', occupationId: 'job-porter', months: 3 });

            expect(low.worked).toBe(true);
            expect(high.worked).toBe(true);
            expect(high.regard.band).not.toBe(low.regard.band);
            expect(high.cashEarned).toBeGreaterThan(low.cashEarned);
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    describe('what does this cost', () => {
        it('quotes the board differently to somebody the counter can read', async () => {
            closeDb();
            getDb(':memory:');
            await standingAt(0, 'market-low');
            const low = await cultivation({ action: 'market', category: 'food' });

            closeDb();
            getDb(':memory:');
            await standingAt(30, 'market-high');
            const high = await cultivation({ action: 'market', category: 'food' });

            expect(low.regard.priceMultiplier).toBe(1);
            expect(high.regard.priceMultiplier).toBeLessThan(1);
            const lowMillet = low.prices.find((p: any) => p.id === 'price-millet');
            const highMillet = high.prices.find((p: any) => p.id === 'price-millet');
            expect(highMillet.cash).toBeLessThanOrEqual(lowMillet.cash);
            // The list price is still reported, so nothing is hidden.
            expect(highMillet.listCash).toBe(lowMillet.listCash);
        });

        it('lets a concealed rung be met as the rung it presents', async () => {
            closeDb();
            getDb(':memory:');
            await standingAt(30, 'market-concealed');
            const open = await cultivation({ action: 'market', category: 'food' });
            const hidden = await cultivation({
                action: 'market',
                category: 'food',
                approach: { concealed: true, presentedAs: 1, audience: 'crowd' }
            });

            expect(open.regard.concealed).toBe(false);
            expect(hidden.regard.concealed).toBe(true);
            expect(hidden.regard.apparentOrdinal).toBe(1);
            expect(hidden.regard.priceMultiplier).toBeGreaterThan(open.regard.priceMultiplier);
            // The room is fooled. The ladder is not.
            expect(hidden.regard.actualOrdinal).toBe(30);
        });

        it('sees through a concealment in front of people who can read it', async () => {
            closeDb();
            getDb(':memory:');
            await standingAt(30, 'market-seen');
            const seen = await cultivation({
                action: 'market',
                approach: { concealed: true, presentedAs: 1, audience: 'peers' }
            });
            expect(seen.regard.concealed).toBe(false);
            expect(seen.regard.apparentOrdinal).toBe(30);
        });
    });
});
