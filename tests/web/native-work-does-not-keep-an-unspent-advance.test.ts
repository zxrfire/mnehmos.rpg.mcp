/** Oct7 source audit: Work writes a food advance before invoking native cultivate,
 * then returns a native error without settling that advance. Precise-clock
 * preparation can fail before provision debit; actual ground admission can refuse
 * after it. No wage was earned and no ration/body time was spent in either case.
 * These controls call native MCP with a real printed profession. The first injects
 * only a canonical clock I/O failure, explicitly not a spontaneous-world claim;
 * the second reads a genuinely barred ground and uses its actual admission answer.
 * No body result, wage, price, actor or ground threshold is fabricated. Normal
 * interrupted/lived spans must still settle actual receipts, not be rolled back.
 * Native baseline33369: both real errors reached; clock refusal retained purse2
 * versus entry0, barred-ground refusal left purse0 versus entry1 (2FAIL15.28s).
 * Candidate moves native admission before provision debit and advances only at
 * its internal readiness seam. These assertions remain unchanged for red/green.
 * This successor is uncompiled/unrun; no model acceptance is claimed.
 * Requires the native fractional MCP composition, not parser-only duration changes.
 */
import { expect, it, vi } from 'vitest';
import { z } from 'zod';
import { makeGameInWorld } from './harness.js';
import type { Cultivator } from '../../src/schema/cultivation.js';
import { handleCultivationManage } from '../../src/server/consolidated/cultivation-manage.js';
import { groundStandingFor, everythingInThePouch } from '../../src/server/consolidated/cultivation-support.js';
import { standingOf } from '../../src/server/consolidated/where-a-cultivator-is-standing.js';
import * as nativeClock from '../../src/server/state/cultivation-world.js';

function payload(response: { content: Array<{ text?: string }> }): unknown {
    const text = response.content[0]?.text;
    if (!text) throw new Error('Native Work returned no receipt.');
    const embedded = /<!-- [A-Z_]+_JSON\n([\s\S]*?)\n[A-Z_]+_JSON -->/.exec(text);
    return JSON.parse(embedded?.[1] ?? text);
}
const boardReceipt = z.object({ work: z.array(z.object({ id: z.string(), name: z.string() })) });
const errorReceipt = z.object({ error: z.string() });
async function fixture() {
    const h = await makeGameInWorld({ seed: 'native-work-error', worldSeed: 'native-fraction-world', worldEnabled: true });
    await h.game.newRun('Actual refused worker');
    const world = await h.game.loadWorld();
    if (!world) throw new Error('Native Work fixture has no actual world.');
    const player = h.game.currentRun().cultivator;
    h.repos.cultivators.update(player.id, { realmOrdinal: 0, injuries: [], satiety: 100, hp: 30, maxHp: 30 });
    return { ...h, world, id: player.id };
}
function observableBody(body: Cultivator) {
    const { updatedAt: _updatedAt, ...facts } = body;
    void _updatedAt;
    return facts;
}
it('native clock refusal keeps no unspent Work advance or provision debit', async () => {
    const h = await fixture();
    let restoreClock: (() => void) | undefined;
    try {
        const town = h.world.locations.find(row => standingOf({ ...h.game.currentRun().cultivator, location: row.name }).settlementKind !== null);
        if (!town) throw new Error('Actual world has no native hiring settlement.');
        h.repos.cultivators.update(h.id, { location: town.name, standingIn: null, spiritStones: 0 });
        const board = boardReceipt.parse(payload(await handleCultivationManage({ action: 'work', cultivatorId: h.id })));
        const job = board.work[0];
        if (!job) throw new Error('Actual native board offers this worker no profession.');
        const before = h.game.currentRun(), pouch = everythingInThePouch(h.db, h.id);
        const worldBefore = JSON.stringify(h.world);
        const clockFailure = vi.spyOn(nativeClock, 'prepareWorldClockForPreciseSpan').mockRejectedValue(new Error('Controlled native clock persistence failure'));
        restoreClock = () => clockFailure.mockRestore();
        const receipt = errorReceipt.parse(payload(await handleCultivationManage({ action: 'work', cultivatorId: h.id,
            occupationId: job.id, days: .125 })));
        expect(clockFailure).toHaveBeenCalled();
        expect(receipt.error).toBe('world_clock_unavailable');
        const after = h.game.currentRun();
        expect(after.cultivator.spiritStones).toBe(before.cultivator.spiritStones);
        expect(observableBody(after.cultivator)).toEqual(observableBody(before.cultivator));
        expect(after.run).toEqual(before.run);
        expect(everythingInThePouch(h.db, h.id)).toEqual(pouch);
        expect(JSON.stringify(h.world)).toBe(worldBefore);
    } finally { restoreClock?.(); h.db.close(); }
}, 120_000);
it('actual barred-ground Work refusal spends no board money, rations or body time', async () => {
    const h = await fixture();
    try {
        let job: { id: string; name: string } | undefined;
        for (const place of h.world.locations) {
            h.repos.cultivators.update(h.id, { location: place.name, standingIn: null, spiritStones: 1 });
            const current = h.game.currentRun();
            const ground = await groundStandingFor(current.run, current.cultivator);
            if (!ground || ground.consequence.admitted) continue;
            const board = boardReceipt.parse(payload(await handleCultivationManage({ action: 'work', cultivatorId: h.id })));
            if (board.work[0]) { job = board.work[0]; break; }
        }
        if (!job) throw new Error('Actual world provides no barred ground with a genuinely offered native profession.');
        const before = h.game.currentRun(), pouch = everythingInThePouch(h.db, h.id);
        const ground = await groundStandingFor(before.run, before.cultivator);
        expect(ground?.consequence.admitted).toBe(false);
        const worldBefore = JSON.stringify(h.world);
        const receipt = errorReceipt.parse(payload(await handleCultivationManage({ action: 'work', cultivatorId: h.id,
            occupationId: job.id, days: 1 })));
        expect(receipt.error).toBe('turned_away_at_the_door');
        const after = h.game.currentRun();
        expect(after.cultivator.spiritStones).toBe(before.cultivator.spiritStones);
        expect(observableBody(after.cultivator)).toEqual(observableBody(before.cultivator));
        expect(after.run).toEqual(before.run);
        expect(everythingInThePouch(h.db, h.id)).toEqual(pouch);
        expect(JSON.stringify(h.world)).toBe(worldBefore);
    } finally { h.db.close(); }
}, 120_000);

it('an admitted penniless worker receives only the native food advance and settles actual spent receipts', async () => {
    const h = await fixture();
    try {
        const town = h.world.locations.find(row => standingOf({ ...h.game.currentRun().cultivator, location: row.name }).settlementKind !== null);
        if (!town) throw new Error('Actual world has no native hiring settlement.');
        h.repos.cultivators.update(h.id, { location: town.name, standingIn: null, spiritStones: 0, satiety: 0 });
        const board = boardReceipt.parse(payload(await handleCultivationManage({ action: 'work', cultivatorId: h.id })));
        const job = board.work[0];
        if (!job) throw new Error('Actual native board offers this body no profession.');
        const before = h.game.currentRun();
        const receipt = z.object({ worked: z.literal(true), daysWorked: z.number(), boardCostStones: z.number(),
            boardAdvancedStones: z.number(), spiritStonesEarned: z.number(),
            span: z.object({ simulatedDays: z.number(), rationsRemaining: z.number(), died: z.boolean() }) })
            .parse(payload(await handleCultivationManage({ action: 'work', cultivatorId: h.id,
                occupationId: job.id, days: .125 })));
        expect(receipt.span.died).toBe(false);
        expect(receipt.daysWorked).toBe(receipt.span.simulatedDays);
        expect(receipt.daysWorked).toBeGreaterThan(0);
        expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays + receipt.span.simulatedDays);
        expect(h.game.currentRun().run.turn).toBe(before.run.turn + 1);
        expect(receipt.boardCostStones).toBeGreaterThan(0);
        expect(receipt.boardAdvancedStones).toBe(receipt.boardCostStones);
        expect(h.game.currentRun().cultivator.spiritStones).toBe(receipt.spiritStonesEarned);
        expect(h.game.currentRun().cultivator.satiety).toBeGreaterThan(before.cultivator.satiety);
    } finally { h.db.close(); }
}, 120_000);
