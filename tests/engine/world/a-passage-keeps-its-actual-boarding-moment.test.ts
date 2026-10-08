/**
 * Cadence initially reconstructed a past played clock by subtracting elapsed
 * world days from current run.elapsedDays. This is false when another actual
 * run advances the shared world: catchUp never rewinds it and never charges
 * the first body that unasked span. Accepted boarding now captures its real
 * run moment in the existing immutable event. Changed courses derive that
 * moment from causes; old receipts remain explicitly unknown, not migrated by
 * guessing. These are pure authority controls, not proof of played resumption.
 */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { appendFact, makeFact } from '../../../src/engine/world/history.js';
import { passageRunMoment, passageCheckFrame } from '../../../src/engine/world/passage-moment.js';

it('keeps the recorded first-run moment when the shared world moves ahead independently', () => {
    const world = createWorld({ seed: 'boarding-moment-world', regionCount: 0, skipPriorAges: true });
    const boarded = appendFact(world.history, makeFact({ day: 100.5, kind: 'gathering',
        summary: 'Actual accepted boarding.', data: { publicPassage: true, vesselId: 'actual-hull', seaLaneId: 'actual-lane',
            departureDay: 100.5, runId: 'first-run', boardingRunElapsedDays: 2.125 } }));
    const moment = passageRunMoment(world, boarded.id);
    expect(moment).toEqual({ runId: 'first-run', elapsedDays: 2.125, boardedOnDay: 100.5 });
    // A second body's world advance does not add four days to the first run.
    const frame = passageCheckFrame(moment, 104.5, 2.125, 3);
    expect(frame.runStart).toBe(2);
    expect(frame.afterDay).toBe(6);
    expect(frame.throughDay).toBe(9);
    expect(frame.boardedOnDay + (7 - frame.runStart)).toBe(105.5);
    expect(frame.legacyUnknownMoment).toBe(false);
});

it('derives a changed course from the accepted event without copying its historic clock', () => {
    const world = createWorld({ seed: 'boarding-moment-world', regionCount: 0, skipPriorAges: true });
    const boarded = appendFact(world.history, makeFact({ day: 100.5, kind: 'gathering', summary: 'Actual boarding.',
        data: { publicPassage: true, vesselId: 'hull', seaLaneId: 'lane', departureDay: 100.5,
            runId: 'run', boardingRunElapsedDays: .125 } }));
    const turned = appendFact(world.history, makeFact({ day: 103.5, kind: 'gathering', summary: 'Actual changed course.',
        causes: [boarded.id], data: { publicPassage: true, vesselId: 'hull', seaLaneId: 'lane', departureDay: 103.5 } }));
    expect(turned.data.runId).toBeUndefined();
    expect(passageRunMoment(world, turned.id)).toEqual(passageRunMoment(world, boarded.id));
    const unrelated = appendFact(world.history, makeFact({ day: 104.5, kind: 'gathering', summary: 'Different hull.',
        causes: [turned.id], data: { publicPassage: true, vesselId: 'other-hull', seaLaneId: 'lane', departureDay: 104.5 } }));
    expect(passageRunMoment(world, unrelated.id)).toBeNull();
});

it('keeps an old unknown boarding explicit and starts only a fresh departure-suppressed frame', () => {
    const world = createWorld({ seed: 'boarding-moment-world', regionCount: 0, skipPriorAges: true });
    const old = appendFact(world.history, makeFact({ day: 100, kind: 'gathering', summary: 'Old boarding.',
        data: { publicPassage: true, vesselId: 'hull', seaLaneId: 'lane', departureDay: 100 } }));
    expect(passageRunMoment(world, old.id)).toBeNull();
    expect(passageCheckFrame(null, 200.25, .125, 2)).toEqual({ runStart: 0, boardedOnDay: 200.25,
        elapsedOnThisCrossing: 0, afterDay: 0, throughDay: 2, legacyUnknownMoment: true });
});
