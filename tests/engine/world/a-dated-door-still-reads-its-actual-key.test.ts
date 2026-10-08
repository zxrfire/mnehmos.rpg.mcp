/**
 * 2026-10-03 retrieval virtual acceptance: all11 pure preparations and all5
 * played arrangements refused before any actual retrieval. Source audit found
 * evaluateAccess passed a dated noncyclic sealed door through isOpenOn, whose
 * noncyclic answer is !sealed, then ORed that into closed even with its key.
 * A real held key must answer the lock; a cyclic site's opening window is a
 * different authority. No missing-key, actual entry bar or timed cycle waiver.
 * These controls exercise native access independently of retrieval fixtures.
 * Before the repair, both matching-key controls failed; the missing/wrong-key,
 * cyclic-window and unsealed-ground controls passed. The repair separates the
 * actual lock from the opening schedule without waiving either entry authority.
 * The existing cyclic-ruin regression then exposed the missing second half:
 * absence of a recorded key is not an opening. The added keyless-seal control
 * failed before that guard was corrected, on dated and undated access alike.
 */
import { describe, it, expect } from 'vitest';
import { evaluateAccess, makeLocation, makeThresholds } from '../../../src/engine/world/locations.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
import { theDoorKeysTheyActuallyCarry } from '../../../src/web/the-door-keys-they-actually-carry.js';
function door() {
    return makeLocation({ id: 'door', name: 'Locked room', kind: 'vault', sealed: true,
        controllingFactionId: 'house', data: { keyId: 'actual-lock' } });
}
const key = makeObject({ id: 'actual-key-row', name: 'Room key', kind: 'key',
    possessorId: 'visitor', data: { keyId: 'actual-lock' } });
describe('dated room access uses the real lock authority', () => {
    it('admits the actual held matching key on dated noncyclic ground', () => {
        const keys = theDoorKeysTheyActuallyCarry([key], 'visitor');
        const read = evaluateAccess(door(), { realmOrdinal: 0, keyIds: keys, onDay: 7.25 });
        expect(read.closed).toBe(false);
        expect(read.level).toBe('mastered');
    });
    it('keeps a missing or wrong key shut even at a sufficient body rung', () => {
        for (const keyIds of [[], ['wrong-lock'], theDoorKeysTheyActuallyCarry([key], 'someone-else')])
            expect(evaluateAccess(door(), { realmOrdinal: 0, keyIds, onDay: 7.25 }).closed).toBe(true);
    });
    it('keeps a noncyclic seal without a keyed opening closed on dated and undated reads', () => {
        const room = makeLocation({ id: 'sealed-site', name: 'Sealed site', kind: 'ruin', sealed: true });
        expect(evaluateAccess(room, { realmOrdinal: 0, onDay: 7.25 }).closed).toBe(true);
        expect(evaluateAccess(room, { realmOrdinal: 0 }).closed).toBe(true);
    });
    it('does not let a matching key override a real closed cyclic window', () => {
        const room = door();
        room.cycle = { periodDays: 10, openDays: 2, phaseDay: 0 };
        const keys = theDoorKeysTheyActuallyCarry([key], 'visitor');
        expect(evaluateAccess(room, { realmOrdinal: 0, keyIds: keys, onDay: 7 }).closed).toBe(true);
        expect(evaluateAccess(room, { realmOrdinal: 0, keyIds: keys, onDay: 1 }).closed).toBe(false);
    });
    it('keeps the actual entry bar after the lock is satisfied', () => {
        const room = { ...door(), thresholds: makeThresholds(5) };
        const read = evaluateAccess(room, { realmOrdinal: 0,
            keyIds: theDoorKeysTheyActuallyCarry([key], 'visitor'), onDay: 7 });
        expect(read.closed).toBe(false);
        expect(read.level).toBe('barred');
    });
    it('keeps dated unsealed ground and its body assessment unchanged', () => {
        const room = makeLocation({ id: 'public', name: 'Public room', kind: 'hall' });
        const dated = evaluateAccess(room, { realmOrdinal: 0, onDay: 7.25 });
        const undated = evaluateAccess(room, { realmOrdinal: 0 });
        expect(dated).toEqual(undated);
    });
});
