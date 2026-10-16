/**
 * Review-only controls, 2026-10-03. Revision 7 returned a pre-world SQL sheet
 * on its non-retrieval branch and reclaimed a dead sitter's actual exposed
 * food into a local result bundle. The player would see stale ground/purse or
 * food disappearing after death. These controls exercise real repositories,
 * the native held-body iterator and canonical ration reader/writer.
 *
 * The substituted world callback deliberately supplies an external SQL change
 * at an actual appointment; it tests reconciliation, not natural encounter
 * selection or estate distribution. The ordinary receipt-linked activity is
 * explicit operator arrangement to select this adapter; it promises no stock
 * handover. Existing pure/played retrieval tests cover actual service dispatch.
 * Runtime control01: compiler passed all29 candidate TS files, then 1 test passed and
 * two custody tests failed because a ten-day native purchase bought only one
 * ration; the first hungry-body portion opened it and no unopened stock existed.
 * The fixture now buys a bundle for two native full-belly spans and requires
 * more than one real purchased ration, then asserts unopened stock before death.
 * The custody rule is unchanged; food is still bought through its sole authority.
 * Runtime roads06: actual unopened stock was reached, then the stop-only final
 * checkpoint reapplied the dead SQL row and violated native immutability. The
 * iterator must reconcile that completion without another body/clock write.
 * These same controls also retain the actual death cause and reached clock.
 * No test asserts query counts, memo identity or a generated actor's identity.
 */
import { expect, it, vi } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { ACTIONS_PER_FULL_SATIETY } from '../../src/engine/cultivation/survival.js';
import { isTheWorldsToMove } from '../../src/engine/world/npc-state.js';
import { spendAnOrdinarySpanAtTheActualClock } from '../../src/web/spending-an-ordinary-span-at-the-actual-clock.js';

async function arrangement(active: boolean, days: number) {
    const h = await makeGameInWorld({ seed: 'ordinary-span-custody', worldSeed: 'ordinary-span-custody-world' });
    const opened = await h.game.newRun('The actual sitter');
    const world = h.game.atHand ?? (await h.game.loadWorld())!;
    const actor = world.npcs.find(n => n.status === 'alive' && isTheWorldsToMove(n))!;
    expect(actor, 'the generated world must supply a real ordinary actor').toBeDefined();
    if (active) actor.activity = { kind: 'the_work_of_their_rank', note: 'Boundary fixture only', withIds: [],
        sinceDay: routineTime(world), untilDay: routineTime(world) + days,
        retrievalRequestId: 'explicit-boundary-control' };
    h.game.atHand = world;
    // Explicit low-food body arrangement; the reserved bundle is then bought
    // through the actual provision authority, not conjured in context.
    h.repos.cultivators.update(opened.cultivator.id, { satiety: 0, spiritStones: 100 });
    const provisionDays = ACTIONS_PER_FULL_SATIETY * 2;
    const purchased = h.game.buyProvisions(h.repos.cultivators.getById(opened.cultivator.id)!, provisionDays);
    const body = purchased.cultivator;
    expect(purchased.rations).toBeGreaterThan(1);
    expect(purchased.covered).toBeGreaterThanOrEqual(provisionDays);
    const run = h.repos.runs.getById(opened.run.id)!;
    const context = { seed: run.seed, locationId: body.location ?? '', turn: run.turn,
        startDay: Math.floor(run.elapsedDays), rations: purchased.rations, grainAbstinence: false,
        autoBreakthrough: false, randomEvents: false, options: { focusMultiplier: 0 } };
    return { ...h, body, run, world, context };
}

it('nonactive final observations use the actual post-world SQL ground and purse', async () => {
    const h = await arrangement(false, 1);
    const elsewhere = h.world.locations.find(l => l.name !== h.body.location)!;
    vi.spyOn(h.game, 'advancePreparedWorld').mockImplementation((_days, body) => {
        h.repos.cultivators.update(body.id, { location: elsewhere.name });
        h.repos.cultivators.applyDeltas(body.id, { spiritStones: 7 });
        return { lines: [], structure: [] };
    });
    const spent = await spendAnOrdinarySpanAtTheActualClock(h.game, h.run, h.body, 1, h.context, 'reserved');
    const actual = h.repos.cultivators.getById(h.body.id)!;
    expect(spent.applied.cultivator.location).toBe(elsewhere.name);
    expect(spent.applied.cultivator.spiritStones).toBe(actual.spiritStones);
    expect(actual.spiritStones).toBeGreaterThanOrEqual(h.body.spiritStones + 7);
    expect(spent.applied.run.elapsedDays).toBe(h.repos.runs.getById(h.run.id)!.elapsedDays);
});

for (const phase of ['intermediate', 'final'] as const) {
    it(`reserved food remains in actual custody when the body dies at the ${phase} boundary`, async () => {
        const due = 0.125;
        const h = await arrangement(true, due);
        let actualFoodAtDeath = -1;
        vi.spyOn(h.game, 'advancePreparedWorld').mockImplementation((days, body, run) => {
            // A real callback on an applied body portion, not an endpoint
            // delivery. The canonical moment becomes the reached appointment.
            h.world.currentDay = routineTime(h.world) + days;
            h.world.currentHour = (h.world.currentDay % 1) * 24;
            expect(h.game.rationsHeld(body), 'real unopened food must exist after the applied body portion and before death').toBeGreaterThan(0);
            h.repos.cultivators.markDead(body.id, 'lifespan_exhausted', run.turn, 'Explicit boundary consequence fixture');
            actualFoodAtDeath = h.game.rationsHeld(body);
            return { lines: [], structure: [] };
        });
        const spent = await spendAnOrdinarySpanAtTheActualClock(h.game, h.run, h.body,
            phase === 'final' ? due : due * 2, h.context, 'reserved');
        expect(actualFoodAtDeath).toBeGreaterThan(0);
        expect(h.repos.cultivators.getById(h.body.id)!.alive).toBe(false);
        expect(spent.applied.cultivator.alive).toBe(false);
        expect(spent.applied.cultivator.deathCause).toBe('lifespan_exhausted');
        expect(spent.applied.run.status).toBe('dead');
        expect(spent.applied.run.elapsedDays - h.run.elapsedDays).toBeCloseTo(due);
        expect(h.game.rationsHeld(h.body)).toBe(actualFoodAtDeath);
        expect(spent.skip.endState.rationsRemaining).toBe(0);
        expect(spent.skip.interrupted || spent.skip.died).toBe(true);
    });
}
