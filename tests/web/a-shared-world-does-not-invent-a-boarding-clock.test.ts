/**
 * MCP run.start is scoped to a cultivator, so two living runs can share a real
 * world even though the web newRun front door permits only one active run.
 * The second body's native cultivation span advances that shared world; it
 * does not age or increment the first SQL run. Original boarding cadence must
 * therefore use its actual receipt moment, never elapsed-minus-world-distance.
 * This control uses the real repositories, accepted carriage, MCP run and body
 * handler, and world catchUp/promotion. It does not claim front-door resumption
 * or quiet journey completion; those remain separate pending played controls.
 */
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { handleStart } from '../../src/server/consolidated/run-manage.js';
import { handleCultivate } from '../../src/server/consolidated/cultivation-manage.js';
import { beginRunInWorld, prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { whatRunsFromHere, stonesFor } from '../../src/web/a-seat-on-a-ship-or-a-carriage.js';
import { quotePublicCarriage, commitPublicCarriage } from '../../src/engine/world/public-carriages.js';
import { worldLocationFor } from '../../src/engine/world/place-lookup.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { passageRunMoment, passageCheckFrame } from '../../src/engine/world/passage-moment.js';

it('keeps a real accepted first-run moment after a second actual body advances their shared world', async () => {
    const { game, db } = await makeGameInWorld({ seed: 'shared-boarding-run', worldSeed: 'road-world' });
    try {
        await game.newRun('First boarding body');
        const first = game.currentRun();
        game.repos.cultivators.update(first.cultivator.id, { location: 'Emerald Water City', standingIn: null, spiritStones: 1000 });
        const body = game.repos.cultivators.getById(first.cultivator.id)!;
        const world = await prepareWorldClockForPreciseSpan(first.run, body);
        game.atHand = world;
        const line = whatRunsFromHere(game, body, first.run.elapsedDays).find(row => row.service === 'carriage')!;
        expect(line).toBeDefined();
        const from = worldLocationFor(world, body.location)!, to = worldLocationFor(world, line.to)!;
        const quote = quotePublicCarriage(world, { fromId: from.id, toId: to.id, day: routineTime(world),
            conveyanceId: 'conv-carriage-mortal', passengerIds: [body.id], fareStones: stonesFor(line.cashPerSeat), hired: false,
            playedPassenger: { id: body.id, locationId: from.id, alive: true } })!;
        expect(quote).not.toBeNull();
        const receipt = commitPublicCarriage(world, quote, { runId: first.run.id, elapsedDays: first.run.elapsedDays })!;
        expect(receipt).not.toBeNull();
        game.repos.cultivators.applyDeltas(body.id, { spiritStones: -quote.fareStones });
        game.theWorldMoved();
        const other = game.repos.cultivators.create({ ...body, id: randomUUID(), name: 'Second shared body',
            kind: 'pc', realmOrdinal: 0, sectId: null });
        await handleStart({ action: 'start', cultivatorId: other.id, seed: 'second-actual-run' });
        const second = game.repos.runs.getActiveRun(other.id)!;
        expect(second.id).not.toBe(first.run.id);
        await beginRunInWorld(second, other);
        // Native debug body span: randomEvents false affects this second body's
        // own encounter window, not the booked carriage or either route horizon.
        await handleCultivate({ action: 'cultivate', cultivatorId: other.id, days: 1,
            focus: 'idle', rations: 0, carriedRations: 0, autoBreakthrough: false, randomEvents: false });
        const unchangedFirst = game.repos.runs.getById(first.run.id)!;
        expect(unchangedFirst.elapsedDays).toBe(first.run.elapsedDays);
        const current = await prepareWorldClockForPreciseSpan(unchangedFirst, game.repos.cultivators.getById(body.id)!);
        expect(routineTime(current)).toBeGreaterThan(quote.departureDay);
        const moment = passageRunMoment(current, receipt.id)!;
        expect(moment.runId).toBe(first.run.id);
        expect(moment.elapsedDays).toBe(first.run.elapsedDays);
        const frame = passageCheckFrame(moment, routineTime(current), unchangedFirst.elapsedDays, quote.arrivalDay - quote.departureDay);
        expect(frame.runStart).toBe(Math.floor(first.run.elapsedDays));
        expect(frame.afterDay).toBeGreaterThan(frame.runStart);
        expect(frame.legacyUnknownMoment).toBe(false);
    } finally { db.close(); }
}, 200_000);
