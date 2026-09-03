/**
 * An absence survives a save.
 *
 * The sibling of `a-status-survives-a-save.test.ts`, and it exists for exactly
 * the same reason: **a field nothing persists reads as empty, and empty reads
 * as an answer.** A world that loads with no absences looks precisely like a
 * world where nobody has ever gone missing - every query over it is correct,
 * every test passes, and the yearly pass has nothing to do.
 *
 * The absence-specific half is `settledThroughDay`. It is the idempotence key:
 * the pass runs from there to now, so a world that loaded it back as the day
 * the person left would replay a century of people giving up, every restart,
 * writing the same chronicle facts and the same ledger rows again with new
 * dates on them. So the round trip is asserted on a HALF-SETTLED absence, not
 * on a fresh one.
 */

import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';

import { migrate } from '../../../src/storage/migrations.js';
import { WorldStateRepository } from '../../../src/storage/repos/world-state.repo.js';
import { createWorld, type WorldState } from '../../../src/engine/world/world-state.js';
import { createNpc, markMissing, upsertRelationship } from '../../../src/engine/world/npc-state.js';
import {
    applyAbsence,
    beginAbsence,
    openAbsencesForTheUnaccountedFor
} from '../../../src/engine/world/when-somebody-does-not-come-back.js';

const YEAR = 365;

function worldWithAVanishing(seed: string): WorldState {
    const state = createWorld({ seed, presentYear: 1000, regionCount: 2 });
    const day = state.currentDay;
    const at = (id: string) => state.npcs.findIndex(n => n.id === id);

    for (const id of ['him', 'her', 'cousin', 'nobody']) {
        state.npcs.push(createNpc(state.seed, {
            id, name: id, bornOnDay: day - 20 * YEAR, onDay: day, locationId: state.locations[0].id
        }));
    }
    state.npcs[at('her')] = upsertRelationship(
        state.npcs[at('her')], { targetId: 'him', targetName: 'him', kind: 'spouse', standing: 0.9 }, day
    );
    state.npcs[at('cousin')] = upsertRelationship(
        state.npcs[at('cousin')], { targetId: 'him', targetName: 'him', kind: 'kin', standing: 0.6 }, day
    );
    state.npcs[at('him')] = markMissing(state.npcs[at('him')], day, 'Went into the hills.');
    return state;
}

function fresh(): { db: Database.Database; repo: WorldStateRepository } {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    migrate(db);
    return { db, repo: new WorldStateRepository(db) };
}

describe('an absence survives a save', () => {
    it('round-trips whole, ties and lists and all', () => {
        const { db, repo } = fresh();
        const state = worldWithAVanishing('abs-save-round-trip');
        openAbsencesForTheUnaccountedFor(state, state.currentDay);
        // Half-settled: some ties decided, some not, and the write-off may or
        // may not have happened. That is the shape a restart actually meets.
        applyAbsence(state, state.absences[0], state.currentDay + 30 * YEAR);

        repo.saveWorld(state);
        const loaded = repo.loadWorld(state.id);

        expect(loaded).not.toBeNull();
        expect(loaded!.absences).toHaveLength(1);
        expect(loaded).toEqual(state);

        const back = loaded!.absences[0];
        expect(back.absenteeId).toBe('him');
        expect(back.ties.map(t => t.holderId)).toEqual(['cousin', 'her']);
        expect(back.ties.every(t => t.waiting)).toBe(true);
        // Both empty is the state that matters, and it must not come back as
        // ['']: an absence nobody can account for is what opens a nameless
        // account, and the test for it is these two lists being empty.
        expect(back.witnessIds).toEqual([]);
        expect(back.toldIds).toEqual([]);
        db.close();
    });

    it('keeps the day the pass has settled through, so a restart does not replay it', () => {
        const { db, repo } = fresh();
        const state = worldWithAVanishing('abs-save-settled');
        openAbsencesForTheUnaccountedFor(state, state.currentDay);
        applyAbsence(state, state.absences[0], state.currentDay + 80 * YEAR);
        const settledThrough = state.absences[0].settledThroughDay;
        expect(settledThrough).toBeGreaterThan(state.absences[0].leftOnDay);

        repo.saveWorld(state);
        const loaded = repo.loadWorld(state.id)!;
        expect(loaded.absences[0].settledThroughDay).toBe(settledThrough);

        // The same span again on the reloaded world decides nothing further.
        const replay = applyAbsence(loaded, loaded.absences[0], state.currentDay + 80 * YEAR);
        expect(replay.yearsStepped).toBe(0);
        expect(replay.consequences).toEqual([]);
        expect(replay.opens).toEqual([]);
        db.close();
    });

    it('keeps a witness list and a told list when there was one', () => {
        const { db, repo } = fresh();
        const state = worldWithAVanishing('abs-save-explained');
        // Not the swept kind: somebody sealed a door and said so.
        const { absence } = beginAbsence(state, {
            absenteeId: 'nobody',
            absenteeName: 'nobody',
            onDay: state.currentDay,
            witnessIds: ['cousin'],
            toldIds: ['her']
        });
        state.absences.push(absence);

        repo.saveWorld(state);
        const back = repo.loadWorld(state.id)!.absences.find(a => a.absenteeId === 'nobody')!;
        expect(back.witnessIds).toEqual(['cousin']);
        expect(back.toldIds).toEqual(['her']);
        expect(back.writtenOffOnDay).toBeNull();
        expect(back.claimKey).toBe('fate:nobody');
        db.close();
    });

    it('and the append path writes them too, because a tick is where they move', () => {
        const { db, repo } = fresh();
        const state = worldWithAVanishing('abs-save-append');
        repo.saveWorld(state);

        openAbsencesForTheUnaccountedFor(state, state.currentDay);
        applyAbsence(state, state.absences[0], state.currentDay + 60 * YEAR);
        repo.appendWorld(state);

        const back = repo.loadWorld(state.id)!.absences;
        expect(back).toHaveLength(1);
        expect(back[0].settledThroughDay).toBe(state.absences[0].settledThroughDay);
        db.close();
    });

    it('starts a fresh world with none, so an empty list is the honest default', () => {
        expect(createWorld({ seed: 'abs-save-empty', regionCount: 1 }).absences).toEqual([]);
    });
});
