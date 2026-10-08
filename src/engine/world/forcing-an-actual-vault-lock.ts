/** Physical lock adapter: actual vault entry is its own lock rating.
 * Owner interpretation 2026-10-03 follows architecture's own-lock comment.
 * This is no generic door catalog, admission waiver or ward/cycle tear-down.
 */
import { applyLocationChange, type LocationRecord, type ChangeResult } from './locations.js';
import { theDoorOnRecord } from './door-materials.js';
import { canUnmake, type UnmakingReach } from '../cultivation/whether-a-weapon-survives-being-used.js';

/** Derived from the ACTUAL target record; never the player's own allotted room. */
export function theActualVaultLock(location: LocationRecord): {
    locationId: string; name: string; standsAt: number;
    source: 'actual_vault_entry' | 'actual_reinforced_door';
} | null {
    if (!location.sealed || location.cycle !== null || location.kind !== 'vault'
        || !location.tags.includes('interior') || typeof location.data.purpose !== 'string'
        || typeof location.data.keyId !== 'string' || !location.data.keyId) return null;
    const reinforced = theDoorOnRecord(location);
    return { locationId: location.id, name: `The lock on ${location.name}`,
        standsAt: reinforced?.doorStandsAt ?? location.thresholds.entry,
        source: reinforced ? 'actual_reinforced_door' : 'actual_vault_entry' };
}

/** Read before any fact/clock mutation. Caller validates actual reach and current body. */
export function whetherTheActualVaultLockCanBeBroken(location: LocationRecord, strength: number):
    { lock: NonNullable<ReturnType<typeof theActualVaultLock>>; force: UnmakingReach } | null {
    const lock = theActualVaultLock(location);
    return lock ? { lock, force: canUnmake(strength, lock.standsAt) } : null;
}

/**
 * Bind the native factual breach receipt after it was actually appended. Caller
 * revalidates the same actual target/body/reach at this synchronous commit.
 * Only the removed lock's own entry bar goes: room work/harm/ward/stock remain.
 */
export function breakTheActualVaultLock(location: LocationRecord, input: {
    strength: number; onDay: number; byName: string; causeFactId: string;
}): ChangeResult | null {
    const answer = whetherTheActualVaultLockCanBeBroken(location, input.strength);
    if (!answer?.force.reaches) return null;
    return applyLocationChange(location, { onDay: input.onDay, kind: 'unsealed',
        summary: `${input.byName} broke the actual lock on ${location.name}.`,
        causeFactId: input.causeFactId, causeKnown: true,
        patch: { sealed: false, thresholds: { entry: 0 } } });
}
