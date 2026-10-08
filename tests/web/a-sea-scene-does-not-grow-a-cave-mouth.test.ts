/**
 * A correct sea encounter frame still admitted a literal sealed cave mouth:
 * the web scene carried only LocationKind (open water is a region), while the
 * catalog had no substrate prerequisite. This operator fixture accepts a real
 * seeded public vessel, pays its actual fare and lets the native fractional
 * passage clock project this passenger. The scene and pool are then read from
 * that actual body, not a fabricated 'water' location or injected encounter.
 * Direct MCP cultivation already shares encountersFor/placeFor; the recording
 * wrapper delegates its actual roll and proves it receives this same current
 * water scene, rather than requiring a second time-skip substrate authority.
 * Root sea02 paired control: red2 failures; green3 passes and this MCP read
 * never reached encountersFor. Source audit found totalDays floors .125 to0,
 * so handleCultivate returns no_duration before the catalog read. Use its
 * currently supported one-day request and require a real accepted response;
 * retain the preceding native three-hour ship projection unchanged. Direct MCP
 * fractional-duration truncation is a separate gap, not licensed or fixed here.
 * It does not claim live-model narration or complete ocean habitat rules.
 */
import { expect, it, vi } from 'vitest';
import { makeGame } from './harness.js';
import { createWorld, resetCultivationWorlds, prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { publicShipLinesFrom, quotePublicPassage, recordPublicPassage } from '../../src/engine/world/public-shipping.js';
import { ensureShipCrew, bindShipCrewToPassage } from '../../src/engine/world/ship-crew.js';
import { shipPassengerAt } from '../../src/engine/world/passenger-on-a-vessel.js';
import { worldLocationFor } from '../../src/engine/world/place-lookup.js';
import { writeTheVoyage } from '../../src/web/a-ship-at-sea.js';
import { passHours } from '../../src/web/routine-invitations.js';
import { isWater } from '../../src/engine/world/places-on-the-way.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { placeFor } from '../../src/web/encounters.js';
import * as encounterReads from '../../src/web/encounters.js';
import { handleCultivate } from '../../src/server/consolidated/cultivation-manage.js';
import { encounterPool } from '../../src/engine/encounters/select.js';

it('distinguishes a real onboard water pool after native passage time from the actual departure port', async () => {
    const { game, db } = makeGame({ seed: 'precise-sea-replies', worldEnabled: true });
    try {
        await createWorld({ seed: 'precise-sea-world', presentYear: 0 });
        await game.newRun('Physical sea substrate passenger');
        let now = game.currentRun();
        game.repos.cultivators.update(now.cultivator.id, { location: 'Emerald Water City', standingIn: null,
            realmOrdinal: 20, spiritStones: 5000, hp: 1000, maxHp: 1000, satiety: 12 });
        now = game.currentRun();
        game.atHand = await prepareWorldClockForPreciseSpan(now.run, now.cultivator);
        const world = game.atHand;
        const from = worldLocationFor(world, now.cultivator.location)!;
        const line = publicShipLinesFrom(world, from.name, routineTime(world)).find(one => one.runsFromDay === null)!;
        expect(line).toBeDefined();
        const to = worldLocationFor(world, line.to)!;
        const quote = quotePublicPassage(world, from.id, to.id, routineTime(world), 1)!;
        expect(quote).not.toBeNull();
        // The native3h scene plus the supported1-day MCP span stays before this real landfall.
        expect(quote.days).toBeGreaterThan(.125 + 1);
        const crew = ensureShipCrew(world, quote.lane, from.id, quote.departureDay);
        bindShipCrewToPassage(world, quote);
        const receipt = recordPublicPassage(world, quote, quote.departureDay, from.id,
            [now.cultivator.id, ...crew.map(one => one.id)]);
        game.repos.cultivators.applyDeltas(now.cultivator.id, { spiritStones: -quote.fareStones });
        writeTheVoyage(db, now.cultivator.id, { receiptId: receipt.id, from: from.name, bound: to.name,
            lane: quote.lane, sailed: 0, days: quote.days, quoted: quote.days,
            hullRationDays: quote.days, crew: crew.length });
        game.theWorldMoved();
        const before = game.currentRun();
        await passHours(game, before.run, before.cultivator, 3);
        const after = game.currentRun();
        const actual = shipPassengerAt(game.atHand!, receipt.id, routineTime(game.atHand!))!;
        expect(actual.unavailable).toBeNull();
        expect(actual.arrived).toBe(false);
        expect(actual.sailed).toBeGreaterThan(0);
        expect(actual.crew.length).toBeGreaterThan(0);
        const ground = worldLocationFor(game.atHand!, after.cultivator.location)!;
        expect(ground.id).toBe(actual.locationId);
        expect(isWater(ground)).toBe(true);
        const scene = placeFor(game.atHand!, after.cultivator);
        expect(scene.substrate).toBe('water');
        const pool = encounterPool({ ordinal: 10, activity: 'travel', place: scene });
        expect(pool.some(one => one.entry.id === 'enc-sealed-cave-mouth')).toBe(false);
        expect(pool.some(one => one.entry.id === 'enc-sealed-tomb')).toBe(false);
        expect(pool.some(one => one.entry.id === 'enc-grave-reader-partnership')).toBe(true);
        expect(pool.some(one => one.entry.id === 'enc-travelling-pill-merchant')).toBe(true);
        // Read the actual departure port without moving or claiming a landing.
        const shore = placeFor(game.atHand!, { ...after.cultivator, location: from.name });
        expect(shore.substrate).toBe('land');
        expect(encounterPool({ ordinal: 10, activity: 'travel', place: shore })
            .some(one => one.entry.id === 'enc-sealed-cave-mouth')).toBe(true);
        expect(game.currentRun()).toEqual(after);
        const seen: ReturnType<typeof encounterReads.encounterInputFor>[] = [];
        const native = encounterReads.encountersFor;
        const capture = vi.spyOn(encounterReads, 'encountersFor').mockImplementation((deps, request) => {
            seen.push(encounterReads.encounterInputFor(deps, request));
            return native(deps, request);
        });
        try {
            const mcpBefore = game.currentRun();
            const worldMomentBefore = routineTime(game.atHand!);
            const mcpReply = await handleCultivate({ action: 'cultivate', cultivatorId: after.cultivator.id,
                days: 1, focus: 'idle', rations: 0, carriedRations: 0,
                autoBreakthrough: false, randomEvents: true });
            expect(mcpReply).not.toHaveProperty('error');
            expect(mcpReply).toMatchObject({ cultivated: true, requestedDays: 1 });
            if (!('simulatedDays' in mcpReply) || typeof mcpReply.simulatedDays !== 'number')
                throw new Error('Native MCP reply omitted its actual lived duration.');
            const mcpAfter = game.currentRun();
            expect(mcpAfter.run.elapsedDays).toBe(mcpBefore.run.elapsedDays + mcpReply.simulatedDays);
            const worldAfter = await game.loadWorld();
            if (!worldAfter) throw new Error('Native MCP lost actual world');
            expect(routineTime(worldAfter) - worldMomentBefore).toBe(mcpReply.simulatedDays);
            const stillAboard = shipPassengerAt(worldAfter, receipt.id, routineTime(worldAfter))!;
            expect(stillAboard.unavailable).toBeNull();
            expect(stillAboard.vesselId).toBe(actual.vesselId);
            expect(stillAboard.arrived).toBe(false);
            expect(worldLocationFor(worldAfter, mcpAfter.cultivator.location)!.id).toBe(stillAboard.locationId);
            expect(seen).toHaveLength(1);
            expect(seen[0].place.id).toBe(ground.id);
            expect(seen[0].place.substrate).toBe('water');
            expect(encounterPool({ ordinal: 10, activity: seen[0].activity, place: seen[0].place })
                .some(one => one.entry.id === 'enc-abandoned-cave-dwelling')).toBe(false);
        } finally { capture.mockRestore(); }
    } finally { db.close(); resetCultivationWorlds(); }
}, 200_000);
