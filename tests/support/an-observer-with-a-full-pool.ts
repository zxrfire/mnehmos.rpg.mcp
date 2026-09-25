/**
 * Give an observer a full attentional pool, the way binding them would.
 *
 * Nothing in `src` binds an observer or creates their pool; the tests that bind
 * one do both. Returns false when the observer is missing or already has a pool.
 */

import {
    ATTENTIONAL_CAPACITY_KEY,
    read
} from '../../src/engine/perception/attentional-capacity.js';
import type { CharacterRepository } from '../../src/storage/repos/character.repo.js';

export function ensurePool(
    observerId: string,
    repo: CharacterRepository,
    when: string = new Date().toISOString()
): boolean {
    const character = repo.findById(observerId);
    const cap = read(observerId, repo);
    if (!character || !cap || cap.poolExists) return false;
    repo.update(observerId, {
        resourcePools: {
            ...(character.resourcePools ?? {}),
            [ATTENTIONAL_CAPACITY_KEY]: { current: cap.max, max: cap.max, lastRefilledAt: when }
        }
    });
    return true;
}
