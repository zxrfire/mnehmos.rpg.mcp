/**
 * Observed sea02's actual native MCP control: days=.125 returned no_duration,
 * before encounter input, while ordinary play had already sailed native .125.
 * totalDays truncated the accepted schema's fraction, and simply removing that
 * floor would leave a whole-day body and a pre-rolled future scene.
 *
 * These controls use the real MCP front door, actual pinned world/body and native
 * precise body oracle in the same invocation. Positive time must advance body,
 * paid food and world once. A longer fractional request uses current actual
 * frame inputs at each native calendar check, never a future opening cast.
 * A real boundary death preserves dead custody and cannot append another cost.
 * The owner's year-span ruling now puts whole-day callers through the same
 * prepared atomic span; the selected fault hooks use its synchronous world step.
 * Source/model prose is not
 * acceptance; no model is involved in this bounded native proof.
 */
import { describe, it, expect, vi } from 'vitest';
import { makeGame, makeGameInWorld } from './harness.js';
import { createWorld, prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { publicShipLinesFrom, quotePublicPassage, recordPublicPassage } from '../../src/engine/world/public-shipping.js';
import { ensureShipCrew, bindShipCrewToPassage } from '../../src/engine/world/ship-crew.js';
import { shipPassengerAt } from '../../src/engine/world/passenger-on-a-vessel.js';
import { writeTheVoyage } from '../../src/web/a-ship-at-sea.js';
import { passHours } from '../../src/web/routine-invitations.js';
import { journeyTimeHasReached } from '../../src/engine/world/places-on-the-way.js';
import { isWater } from '../../src/engine/world/places-on-the-way.js';
import { encounterPool } from '../../src/engine/encounters/select.js';
import { activityProfile, ENCOUNTER_GRID_DAYS } from '../../src/engine/encounters/activity.js';
import { handleCultivate } from '../../src/server/consolidated/cultivation-manage.js';
import { RATION_COST_STONES } from '../../src/server/consolidated/what-a-ration-costs.js';
import { simulateTimeSkipParts } from '../../src/engine/cultivation/time-skip.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import * as worldClock from '../../src/server/state/cultivation-world.js';
import * as encounters from '../../src/web/encounters.js';
import { worldLocationFor } from '../../src/web/entities.js';

async function fixture() {
    const h = await makeGameInWorld({ seed: 'native-fraction-body', worldSeed: 'native-fraction-world', worldEnabled: true });
    await h.game.newRun('Actual native fraction');
    const { cultivator } = h.game.currentRun();
    h.game.repos.cultivators.update(cultivator.id, { realmOrdinal: 0, satiety: 0, hp: 30, maxHp: 30,
        spiritStones: 40, injuries: [], cultivationProgress: 0 });
    return h;
}
function request(id: string, days: number, randomEvents = false) {
    return { action: 'cultivate' as const, cultivatorId: id, days, focus: 'idle' as const,
        rations: 1, carriedRations: 0, autoBreakthrough: false, randomEvents };
}
function lived(reply: object) {
    if (!('simulatedDays' in reply) || typeof reply.simulatedDays !== 'number')
        throw new Error('The native MCP reply omitted its actual lived span.');
    return reply.simulatedDays;
}

describe('the actual MCP tool can spend a positive fraction', () => {
    it('spends .125 native body, paid ration and actual world with one completion', async () => {
        const h = await fixture();
        try {
            const before = h.game.currentRun();
            const world = await h.game.loadWorld();
            if (!world) throw new Error('The native fractional fixture has no actual world.');
            const start = routineTime(world);
            const native = simulateTimeSkipParts(before.cultivator, .125, {
                seed: before.run.seed, rollIdentity: encounters.PLAYER_ROLL_IDENTITY,
                locationId: before.cultivator.location ?? 'unknown', turn: before.run.turn,
                startDay: before.run.elapsedDays, options: { focusMultiplier: 0 },
                randomEvents: false, autoBreakthrough: false, rations: 1
            }, { preciseDays: true, nextBoundary: () => null });
            let oracle = native.next();
            while (!oracle.done) oracle = native.next();
            const answer = await handleCultivate(request(before.cultivator.id, .125));
            expect(answer).not.toHaveProperty('error');
            expect(answer).toMatchObject({ cultivated: true, requestedDays: .125, simulatedDays: .125,
                rationsRemaining: oracle.value.endState.rationsRemaining });
            const after = h.game.currentRun();
            const worldAfter = await h.game.loadWorld();
            if (!worldAfter) throw new Error('Native MCP lost the actual world.');
            expect(after.run.elapsedDays).toBe(before.run.elapsedDays + .125);
            expect(after.run.turn).toBe(before.run.turn + 1);
            expect(routineTime(worldAfter) - start).toBe(.125);
            expect(after.cultivator.age).toBe(before.cultivator.age + oracle.value.deltas.age);
            expect(after.cultivator.satiety).toBe(before.cultivator.satiety + oracle.value.deltas.satiety);
            expect(oracle.value.endState.rationsRemaining).toBeLessThan(1);
            expect(after.cultivator.spiritStones).toBe(before.cultivator.spiritStones - RATION_COST_STONES);
        } finally { h.db.close(); }
    });

    it('preserves an existing played fraction and the whole-day native path', async () => {
        const h = await fixture();
        try {
            const id = h.game.currentRun().cultivator.id;
            const first = await handleCultivate(request(id, .125));
            expect(first).not.toHaveProperty('error');
            const before = h.game.currentRun();
            const second = await handleCultivate(request(id, 1.125));
            expect(second).not.toHaveProperty('error');
            expect(second).toMatchObject({ requestedDays: 1.125 });
            expect(lived(second)).toBe(1.125);
            expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays + 1.125);
            expect(h.game.currentRun().run.turn).toBe(before.run.turn + 1);
            const integralBefore = h.game.currentRun();
            const integralWorld = await h.game.loadWorld();
            if (!integralWorld) throw new Error('The native whole-day control lost its world.');
            const integralMoment = routineTime(integralWorld);
            const whole = await handleCultivate(request(id, 1, true));
            expect(whole).not.toHaveProperty('error');
            expect(h.game.currentRun().run.elapsedDays).toBe(integralBefore.run.elapsedDays + lived(whole));
            const integralAfter = h.game.currentRun();
            expect(integralAfter.run.turn).toBe(integralBefore.run.turn + 1);
            const integralWorldAfter = await h.game.loadWorld();
            if (!integralWorldAfter) throw new Error('The native whole-day result lost its world.');
            expect(routineTime(integralWorldAfter) - integralMoment).toBe(lived(whole));
            const retainedClock = integralAfter.run.elapsedDays - lived(whole);
            expect(journeyTimeHasReached(retainedClock, integralBefore.run.elapsedDays)
                && journeyTimeHasReached(integralBefore.run.elapsedDays, retainedClock)).toBe(true);
            expect(integralAfter.cultivator.spiritStones).toBe(integralBefore.cultivator.spiritStones - RATION_COST_STONES);
        } finally { h.db.close(); }
    });

    it('feeds every encounter check its current committed body and physical ground', async () => {
        const h = await fixture();
        const original = encounters.encounterInputFor;
        const observations: { played: number; requestedStart: number; physicalGround: string | null; readGround: string }[] = [];
        const capture = vi.spyOn(encounters, 'encounterInputFor').mockImplementation((deps, input) => {
            const read = original(deps, input);
            const actual = h.game.currentRun();
            observations.push({ played: actual.run.elapsedDays, requestedStart: input.startDay,
                physicalGround: deps.world ? worldLocationFor(deps.world, actual.cultivator.location)?.id ?? null : null,
                readGround: read.place.id });
            expect(input.cultivator).toEqual(actual.cultivator);
            return read;
        });
        try {
            const before = h.game.currentRun();
            // The actual outcome may interrupt early; never force an RNG draw
            // or waive it merely to make a later calendar check occur.
            const answer = await handleCultivate({ ...request(before.cultivator.id, 16.125, true), rations: 20 });
            expect(answer).not.toHaveProperty('error');
            expect(answer).toMatchObject({ requestedDays: 16.125 });
            expect(lived(answer)).toBeGreaterThanOrEqual(0);
            expect(lived(answer)).toBeLessThanOrEqual(16.125);
            expect(observations.length).toBeGreaterThan(0);
            const grid = activityProfile('labour').gridDays ?? ENCOUNTER_GRID_DAYS;
            if (lived(answer) >= grid) {
                expect(observations.some(one => one.played > before.run.elapsedDays)).toBe(true);
            } else {
                // A real earlier interruption cannot be waived to force a later
                // scene check; record its actual stopped receipt instead.
                expect(answer).toMatchObject({ stoppedEarly: true });
            }
            for (const observation of observations) {
                expect(observation.requestedStart).toBe(before.run.elapsedDays);
                expect(observation.readGround).toBe(observation.physicalGround);
                expect(observation.played).toBeGreaterThanOrEqual(before.run.elapsedDays);
                expect(observation.played).toBeLessThanOrEqual(h.game.currentRun().run.elapsedDays);
            }
            expect(h.game.currentRun().run.turn).toBe(before.run.turn + 1);
        } finally { capture.mockRestore(); h.db.close(); }
    });

    it('keeps actual boundary death, native lived receipt and completion without later body writes', async () => {
        const h = await fixture();
        const original = worldClock.advancePreparedWorldForCultivator;
        let boundarySeen = false;
        const capture = vi.spyOn(worldClock, 'advancePreparedWorldForCultivator').mockImplementation((world, run, body, days, options) => {
            const native = original(world, run, body, days, options);
            if (!boundarySeen) {
                boundarySeen = true;
                h.game.repos.cultivators.markDead(body.id, 'combat_defeat', run.turn, 'Killed at the actual committed world boundary.');
            }
            return native;
        });
        try {
            const before = h.game.currentRun();
            const answer = await handleCultivate(request(before.cultivator.id, 1.125));
            expect(answer).not.toHaveProperty('error');
            expect(boundarySeen).toBe(true);
            expect(answer).toMatchObject({ cultivated: true, requestedDays: 1.125, died: true, deathCause: 'combat_defeat', stoppedEarly: true });
            const after = h.game.currentRun();
            expect(after.cultivator.alive).toBe(false);
            expect(after.run.elapsedDays).toBe(before.run.elapsedDays + lived(answer));
            expect(after.run.turn).toBe(before.run.turn + 1);
            expect(capture.mock.calls.reduce((sum, call) => sum + call[3], 0)).toBe(lived(answer));
            expect(after.cultivator.spiritStones).toBe(before.cultivator.spiritStones - RATION_COST_STONES);
        } finally { capture.mockRestore(); h.db.close(); }
    });

    it('retains every actual native portion digest without reconstructing a final observer', async () => {
        const h = await fixture();
        const original = worldClock.advancePreparedWorldForCultivator;
        const portions: worldClock.WorldAdvance[] = [];
        const capture = vi.spyOn(worldClock, 'advancePreparedWorldForCultivator').mockImplementation((...args) => {
            const native = original(...args);
            if (native) portions.push(native);
            return native;
        });
        try {
            const before = h.game.currentRun();
            const answer = await handleCultivate(request(before.cultivator.id, 1.125));
            expect(answer).not.toHaveProperty('error');
            expect(portions.length).toBeGreaterThan(0);
            expect(answer).toHaveProperty('worldDigest');
            if (!('worldDigest' in answer)) throw new Error('The native tool omitted its actual world receipt.');
            const digest = answer.worldDigest;
            expect(digest).toHaveProperty('heard', portions.flatMap(part => part.result.digest?.lines ?? []));
            expect(digest).toHaveProperty('fromDay', portions[0].result.digest?.fromDay ?? portions[0].fromDay);
            const last = portions[portions.length - 1];
            expect(digest).toHaveProperty('toDay', last.result.digest?.toDay ?? last.toDay);
        } finally { capture.mockRestore(); h.db.close(); }
    });
});

/** The original sea02 failure is exercised at its actual paid/onboard front door. */
it('spends an actual MCP .125 aboard the same real accepted ship', async () => {
    const h = makeGame({ seed: 'precise-sea-replies', worldEnabled: true });
    const inputFor = encounters.encounterInputFor;
    const scenes: ReturnType<typeof encounters.encounterInputFor>[] = [];
    const capture = vi.spyOn(encounters, 'encounterInputFor').mockImplementation((deps, input) => {
        const scene = inputFor(deps, input); scenes.push(scene); return scene;
    });
    try {
        await createWorld({ seed: 'precise-sea-world', presentYear: 0 });
        await h.game.newRun('Actual MCP fractional passenger');
        let now = h.game.currentRun();
        h.game.repos.cultivators.update(now.cultivator.id, { location: 'Emerald Water City', standingIn: null,
            realmOrdinal: 20, spiritStones: 5000, hp: 1000, maxHp: 1000, satiety: 12 });
        now = h.game.currentRun();
        h.game.atHand = await prepareWorldClockForPreciseSpan(now.run, now.cultivator);
        const world = h.game.atHand;
        const from = worldLocationFor(world, now.cultivator.location);
        if (!from) throw new Error('The real native passenger has no departure port.');
        const line = publicShipLinesFrom(world, from.name, routineTime(world)).find(one => one.runsFromDay === null);
        if (!line) throw new Error('The actual fixture has no ordinary public sailing.');
        const to = worldLocationFor(world, line.to);
        if (!to) throw new Error('The actual public line has no destination.');
        const quote = quotePublicPassage(world, from.id, to.id, routineTime(world), 1);
        if (!quote) throw new Error('The actual public fare could not be quoted.');
        expect(quote.days).toBeGreaterThan(.125 + .125);
        const crew = ensureShipCrew(world, quote.lane, from.id, quote.departureDay);
        bindShipCrewToPassage(world, quote);
        const receipt = recordPublicPassage(world, quote, quote.departureDay, from.id,
            [now.cultivator.id, ...crew.map(one => one.id)]);
        h.game.repos.cultivators.applyDeltas(now.cultivator.id, { spiritStones: -quote.fareStones });
        writeTheVoyage(h.db, now.cultivator.id, { receiptId: receipt.id, from: from.name, bound: to.name,
            lane: quote.lane, sailed: 0, days: quote.days, quoted: quote.days,
            hullRationDays: quote.days, crew: crew.length });
        h.game.theWorldMoved();
        const boarding = h.game.currentRun();
        await passHours(h.game, boarding.run, boarding.cultivator, 3);
        const before = h.game.currentRun();
        const beforeWorld = await h.game.loadWorld();
        if (!beforeWorld) throw new Error('The actual passenger lost its world.');
        const beforeMoment = routineTime(beforeWorld);
        const actualBefore = shipPassengerAt(beforeWorld, receipt.id, routineTime(beforeWorld));
        if (!actualBefore) throw new Error('The actual paid passenger has no accepted passage.');
        expect(actualBefore.arrived).toBe(false);
        scenes.length = 0;
        const answer = await handleCultivate({ ...request(before.cultivator.id, .125, true), rations: 0, location: to.name });
        expect(answer).not.toHaveProperty('error');
        expect(answer).toMatchObject({ cultivated: true, requestedDays: .125, simulatedDays: .125 });
        const after = h.game.currentRun(), afterWorld = await h.game.loadWorld();
        if (!afterWorld) throw new Error('The native MCP passenger lost its actual world.');
        expect(answer).toHaveProperty('cultivator.standing.location', after.cultivator.location);
        const actualAfter = shipPassengerAt(afterWorld, receipt.id, routineTime(afterWorld));
        if (!actualAfter) throw new Error('The accepted public passage disappeared.');
        expect(after.run.elapsedDays).toBe(before.run.elapsedDays + .125);
        expect(after.run.turn).toBe(before.run.turn + 1);
        expect(journeyTimeHasReached(routineTime(afterWorld), beforeMoment + .125)).toBe(true);
        expect(journeyTimeHasReached(beforeMoment + .125, routineTime(afterWorld))).toBe(true);
        expect(actualAfter.vesselId).toBe(actualBefore.vesselId);
        expect(actualAfter.arrived).toBe(false);
        expect(actualAfter.unavailable).toBeNull();
        expect(worldLocationFor(afterWorld, after.cultivator.location)?.id).toBe(actualAfter.locationId);
        expect(isWater(worldLocationFor(afterWorld, after.cultivator.location)!)).toBe(true);
        expect(after.cultivator.spiritStones).toBe(before.cultivator.spiritStones);
        expect(scenes.length).toBeGreaterThan(0);
        for (const scene of scenes) {
            expect(scene.place.substrate).toBe('water');
            expect(encounterPool({ ordinal: 10, activity: scene.activity, place: scene.place })
                .some(one => one.entry.id === 'enc-sealed-cave-mouth')).toBe(false);
        }
    } finally { capture.mockRestore(); h.db.close(); }
});
