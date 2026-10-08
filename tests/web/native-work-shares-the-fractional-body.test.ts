/**
 * MCP totalDays was flooring .125 to zero. Work shares that read and passes
 * the requested duration into the actual cultivate route; it must not acquire
 * another fractional clock or wage formula. This front-door control reads the
 * real offered board where the actual arranged body stands, chooses its printed
 * occupation id, and compares work's span with direct native cultivation in the
 * SAME invocation and pinned world/run. Existing receipt amounts settle the
 * purse; no catalog wage arithmetic is reimplemented here. A tiny ordinary
 * span may legitimately round its wage to zero, while its body/food/time remain
 * real. This proves that composition, not long-term income or model acceptance.
 * Work's advance-before-error return is a separately source-observed rollback
 * gap; this well-funded successful control does not claim to close or measure it.
 */
import { expect, it } from 'vitest';
import { z } from 'zod';
import { makeGameInWorld } from './harness.js';
import { handleCultivationManage } from '../../src/server/consolidated/cultivation-manage.js';
import { standingOf } from '../../src/server/consolidated/where-a-cultivator-is-standing.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { worldLocationFor } from '../../src/web/entities.js';

function payload(response: { content: Array<{ text?: string }> }): unknown {
    const text = response.content[0]?.text;
    if (!text) throw new Error('The native MCP tool returned no receipt.');
    const embedded = /<!-- [A-Z_]+_JSON\n([\s\S]*?)\n[A-Z_]+_JSON -->/.exec(text);
    return JSON.parse(embedded?.[1] ?? text);
}
const spanReceipt = z.object({ requestedDays: z.number(), simulatedDays: z.number(),
    rationsRemaining: z.number(), died: z.boolean(), deltas: z.record(z.string(), z.unknown()) });
const boardReceipt = z.object({ work: z.array(z.object({ id: z.string(), name: z.string() })) });
const workReceipt = z.object({ worked: z.literal(true), daysWorked: z.number(),
    spiritStonesEarned: z.number(), boardCostStones: z.number(), boardAdvancedStones: z.number(),
    spiritStonesNow: z.number(), span: spanReceipt });

async function arrangement() {
    const h = await makeGameInWorld({ seed: 'native-fraction-body', worldSeed: 'native-fraction-world', worldEnabled: true });
    await h.game.newRun('Actual native fractional work');
    const opened = h.game.currentRun();
    const world = await h.game.loadWorld();
    if (!world) throw new Error('The real work fixture has no actual world.');
    const place = world.locations.find(one => standingOf({ ...opened.cultivator, location: one.name }).settlementKind !== null);
    if (!place) throw new Error('The real world has no ordinary catalog settlement.');
    // Explicit operator arrangement in a real settlement, not fabricated hiring.
    h.game.repos.cultivators.update(opened.cultivator.id, { location: place.name, standingIn: null,
        realmOrdinal: 0, satiety: 0, hp: 30, maxHp: 30, spiritStones: 40, injuries: [], cultivationProgress: 0 });
    const before = h.game.currentRun();
    expect(worldLocationFor(world, before.cultivator.location)?.id).toBe(place.id);
    const start = routineTime(world);
    const board = boardReceipt.parse(payload(await handleCultivationManage({ action: 'work', cultivatorId: before.cultivator.id })));
    const offered = board.work[0];
    if (!offered) throw new Error('The actual board offers no work to this actual body.');
    expect(h.game.currentRun()).toEqual(before);
    return { ...h, before, start, offered };
}

it('native MCP work spends its offered .125 through the same body span and settles its actual receipt', async () => {
    const worker = await arrangement();
    let actualSpan: z.infer<typeof spanReceipt>;
    let actualBody: { age: number; satiety: number; hp: number };
    try {
        const raw = payload(await handleCultivationManage({ action: 'work',
            cultivatorId: worker.before.cultivator.id, occupationId: worker.offered.id, days: .125 }));
        expect(raw).not.toHaveProperty('error');
        const receipt = workReceipt.parse(raw);
        actualSpan = receipt.span;
        expect(actualSpan).toMatchObject({ requestedDays: .125, simulatedDays: .125 });
        expect(receipt.daysWorked).toBe(actualSpan.simulatedDays);
        expect(receipt.boardAdvancedStones).toBe(0);
        const after = worker.game.currentRun();
        const world = await worker.game.loadWorld();
        if (!world) throw new Error('The actual working span lost its world.');
        expect(after.run.elapsedDays).toBe(worker.before.run.elapsedDays + actualSpan.simulatedDays);
        expect(after.run.turn).toBe(worker.before.run.turn + 1);
        expect(routineTime(world) - worker.start).toBe(actualSpan.simulatedDays);
        expect(after.cultivator.spiritStones).toBe(worker.before.cultivator.spiritStones
            - receipt.boardCostStones + receipt.spiritStonesEarned);
        expect(receipt.spiritStonesNow).toBe(after.cultivator.spiritStones);
        expect(after.cultivator.satiety).toBeGreaterThan(worker.before.cultivator.satiety);
        actualBody = { age: after.cultivator.age, satiety: after.cultivator.satiety, hp: after.cultivator.hp };
    } finally { worker.db.close(); }
    // Direct native arm follows in this same invocation with an identical actual
    // opening world/body. It is the control for the composed work span, not a stub.
    const native = await arrangement();
    try {
        const raw = payload(await handleCultivationManage({ action: 'cultivate',
            cultivatorId: native.before.cultivator.id, days: .125, focus: 'idle',
            rations: 1, autoBreakthrough: true, randomEvents: true }));
        expect(raw).not.toHaveProperty('error');
        expect(spanReceipt.parse(raw)).toEqual(actualSpan);
        const after = native.game.currentRun();
        expect({ age: after.cultivator.age, satiety: after.cultivator.satiety, hp: after.cultivator.hp }).toEqual(actualBody);
        expect(after.run.elapsedDays).toBe(native.before.run.elapsedDays + .125);
        expect(after.run.turn).toBe(native.before.run.turn + 1);
    } finally { native.db.close(); }
});
