/**
 * An area status survives a save.
 *
 * Separate from `what-is-true-of-a-place-right-now.test.ts` because that file
 * tests the layer's arithmetic, which is pure, and this one tests the place the
 * layer is kept - `WorldState.statuses`, the `world_area_statuses` table, and
 * the repository between them.
 *
 * The reason it exists at all: **a field nothing persists reads as empty, and
 * empty reads as "nothing is wrong here" with complete confidence.** A world
 * that loads with no statuses looks exactly like a world where nothing is
 * happening, every query over it answers correctly, and every test passes over
 * an empty column. So the round trip is asserted with a status that has each of
 * the shapes that could be dropped on the way: a cause nothing chose, a cause
 * somebody chose, two list fields, and a lift.
 */

import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';

import { migrate } from '../../../src/storage/migrations.js';
import { WorldStateRepository } from '../../../src/storage/repos/world-state.repo.js';
import {
    createWorld, getAreaStatus, upsertAreaStatus
} from '../../../src/engine/world/world-state.js';
import {
    liftStatus, makeAreaStatus, type AreaStatus
} from '../../../src/engine/world/what-is-true-of-a-place-right-now.js';

const BEGAN = 365_000;

/** A cause nothing chose. */
function drought(areaId: string): AreaStatus {
    return makeAreaStatus({
        id: 'status-drought',
        areaId,
        kind: 'famine',
        statement: 'There is not enough food here and there will not be until the spring.',
        cause: {
            what: 'Two sowings failed on ground cropped without rest for nine years.',
            decidedById: null,
            factId: null
        },
        signs: [
            'the grain price at the weigh house moved twice in a month and did not come back',
            'the carters who bring millet up the gorge stopped taking return loads'
        ],
        causeKnownLocally: false,
        beganOnDay: BEGAN,
        reviewOnDay: BEGAN + 200,
        stops: ['millet', 'bread'],
        priceMultiplier: 3,
        dangerDelta: 0.05
    });
}

/** A cause somebody chose. The same row with one more field filled in. */
function theWater(areaId: string): AreaStatus {
    return makeAreaStatus({
        id: 'status-the-water',
        areaId,
        kind: 'war',
        statement: 'Two houses are fighting over the water here.',
        cause: {
            what: 'The Fordhall called in a crossing debt it had held for sixty years.',
            decidedById: 'sect-clear-river-fordhall',
            factId: null
        },
        signs: ['the ferries stopped running and nobody would say who told them to'],
        causeKnownLocally: true,
        beganOnDay: BEGAN,
        reviewOnDay: BEGAN + 90,
        stops: ['passage'],
        priceMultiplier: 2,
        dangerDelta: 0.3
    });
}

describe('a status survives a save', () => {
    it('round-trips with its cause, its signs and what it stops intact', () => {
        const db = new Database(':memory:');
        db.pragma('foreign_keys = ON');
        migrate(db);
        const repo = new WorldStateRepository(db);

        let state = createWorld({ seed: 'status-round-trip', regionCount: 2 });
        const area = state.locations[0].id;
        state = upsertAreaStatus(state, drought(area));
        state = upsertAreaStatus(state, theWater(area));

        repo.saveWorld(state);
        const loaded = repo.loadWorld(state.id);
        expect(loaded).not.toBeNull();
        expect(loaded!.statuses).toHaveLength(2);
        expect(loaded).toEqual(state);

        const back = getAreaStatus(loaded!, 'status-drought')!;
        // A cause nothing chose comes back as null, not as the string 'null'.
        expect(back.cause.decidedById).toBeNull();
        expect(back.cause.what).toBe(drought(area).cause.what);
        expect(back.signs).toEqual(drought(area).signs);
        expect(back.stops).toEqual(['millet', 'bread']);
        expect(back.causeKnownLocally).toBe(false);
        expect(back.liftedOnDay).toBeNull();
        expect(back.priceMultiplier).toBe(3);
        expect(back.dangerDelta).toBeCloseTo(0.05, 6);

        // And a cause somebody chose keeps who chose it.
        expect(getAreaStatus(loaded!, 'status-the-water')!.cause.decidedById)
            .toBe('sect-clear-river-fordhall');

        db.close();
    });

    it('persists a lift, which is the half that lets a status actually end', () => {
        const db = new Database(':memory:');
        db.pragma('foreign_keys = ON');
        migrate(db);
        const repo = new WorldStateRepository(db);

        let state = createWorld({ seed: 'status-lift', regionCount: 1 });
        state = upsertAreaStatus(state, drought(state.locations[0].id));
        repo.saveWorld(state);

        const running = getAreaStatus(repo.loadWorld(state.id)!, 'status-drought')!;
        repo.saveWorld(upsertAreaStatus(
            repo.loadWorld(state.id)!, liftStatus(running, BEGAN + 12)
        ));

        expect(getAreaStatus(repo.loadWorld(state.id)!, 'status-drought')!.liftedOnDay)
            .toBe(BEGAN + 12);
        db.close();
    });

    it('starts a fresh world with no statuses, so an empty column is the honest default', () => {
        expect(createWorld({ seed: 'status-empty', regionCount: 1 }).statuses).toEqual([]);
    });
});
