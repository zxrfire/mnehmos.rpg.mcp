/**
 * Streaming an encounter at elapsed day 3 used to pass that current day into
 * the recorder while retaining full-window offset 3. The standing summons was
 * consequently stamped day 6. Resumed voyages have the same double-offset risk.
 * Heard-state uses the actual supplied run-relative moment, floored by the
 * existing contract; full-window event offsets/identity remain unchanged.
 * Legacy calls retain their old timestamp behavior until separately migrated.
 * SCRATCH control, not run. Removing the explicit timestamp use must make the
 * 3-not-6 and 13-not-26 assertions fail in the same invocation.
 */
import { expect, it } from 'vitest';
import { makeGame } from './harness.js';
import { SECTS } from '../../src/data/cultivation/index.js';
import { summonsPool } from '../../src/engine/encounters/duties.js';
import { dutyFromOffer, membershipFor, recordEncounters } from '../../src/web/encounters.js';
import { readPendingSummons } from '../../src/web/pending-summons.js';
import type { EncounterRoll } from '../../src/engine/encounters/types.js';

it('keeps a streamed summons at its actual hearing day without altering the original event offset', async () => {
    const { game, db } = makeGame({ seed: 'actual-hearing-day' });
    try {
        await game.newRun('Member hearing a summons');
        const id = game.currentRun().cultivator.id;
        const house = SECTS.filter(sect => sect.recruits)
            .reduce((best, one) => one.admissionOrdinal < best.admissionOrdinal ? one : best);
        game.repos.cultivators.update(id, { realmOrdinal: 8 });
        game.repos.sects.addMember(house.id, id, 0);
        const body = game.repos.cultivators.getById(id)!;
        const member = membershipFor({ repos: game.repos, knowledge: game.knowledge, world: null }, body);
        const pool = summonsPool(body.realmOrdinal, member);
        expect(pool.length).toBeGreaterThan(0);
        const candidate = pool[0]!;
        const duty = dutyFromOffer(candidate, member, 0);
        for (const moment of [3, 3.875, 13.875]) {
            const offset = Math.floor(moment);
            const roll: EncounterRoll = { firstInterruptDay: offset, checks: 1, poolSize: pool.length,
                occurrences: [{ id: candidate.entry.id, entryId: candidate.entry.id,
                    kind: candidate.entry.kind, valence: 'neutral', dayOffset: offset, absoluteDay: offset,
                    interrupts: true, stance: 'none', event: { kind: 'encounter', dayOffset: offset,
                        summary: candidate.entry.name + ', put to this member.', interrupts: true, occurrences: 1, data: {} },
                    deltas: { hp: 0, spiritStones: 0, satiety: 0, rations: 0 },
                    confrontation: null, duty, scene: null, contact: null, grants: [], castIds: [], source: 'summons' }] };
            recordEncounters(game.knowledge, body, moment, roll, game.repos, moment);
            expect(readPendingSummons(game.repos, id)!.spokenOnDay).toBe(Math.floor(moment));
            expect(roll.occurrences[0]!.dayOffset).toBe(offset);
            expect(roll.occurrences[0]!.event.dayOffset).toBe(offset);
            expect(roll.occurrences[0]!.absoluteDay).toBe(offset);
            recordEncounters(game.knowledge, body, moment, roll, game.repos);
            expect(readPendingSummons(game.repos, id)!.spokenOnDay).toBe(Math.floor(moment) + offset);
        }
    } finally { db.close(); }
});
