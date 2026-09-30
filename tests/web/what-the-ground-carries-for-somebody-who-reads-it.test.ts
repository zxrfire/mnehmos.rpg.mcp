/**
 * Investigating a place: how many people its ground carries in the reader's own
 * band, and how many work it. A surveyor's figure, so it waits for `READS_A_VEIN`.
 */

import { describe, expect, it } from 'vitest';

import { makeLocation } from '../../src/engine/world/locations';
import { QI_DENSITY_DEFAULT } from '../../src/engine/world/qi-scale';
import { createNpc, setRealm } from '../../src/engine/world/npc-state';
import { peopleThisGroundCanCarry } from '../../src/engine/world/what-a-place-still-has-in-the-ground';
import type { WorldState } from '../../src/engine/world/world-state';
import { howManyThisGroundCarries } from '../../src/web/investigate-verb';
import { READS_A_VEIN } from '../../src/web/what-you-can-tell-about-the-ground';

const DAY = 365 * 500;

function aValleyWith(ordinals: readonly number[]): { world: WorldState; place: ReturnType<typeof makeLocation> } {
    const place = makeLocation({
        id: 'loc-valley', name: 'Blackwater Valley', kind: 'wilds', qiDensity: QI_DENSITY_DEFAULT
    });
    const npcs = ordinals.map((ordinal, i) => setRealm(createNpc('ground-carries', {
        id: `npc-${i}`, name: `Worker ${i}`, bornOnDay: DAY - 365 * 60, onDay: DAY,
        locationId: place.id, occupation: 'disciple'
    }), ordinal, DAY));
    return { world: { npcs } as unknown as WorldState, place };
}

describe('what the ground carries, for somebody who can read it', () => {
    it('says nothing below the rung that reads a vein', () => {
        const { world, place } = aValleyWith([2, 3]);
        expect(howManyThisGroundCarries(world, place, READS_A_VEIN - 1)).toBeNull();
    });

    it('says the reader\'s own band: how many it carries and how many work it', () => {
        const { world, place } = aValleyWith([READS_A_VEIN, READS_A_VEIN + 1, 2]);
        const said = howManyThisGroundCarries(world, place, READS_A_VEIN)!;
        expect(said).toContain('earth-grade ground around Blackwater Valley');
        // Two work the reader's band; the mortal at rung 2 works another.
        expect(said).toContain('2 people work it');
        // Ordinary ground cannot carry one earth-grade worker a year.
        expect(peopleThisGroundCanCarry(place, 'earth')).toBeLessThan(1);
        expect(said).toMatch(/not grow back fast enough for even one person/);
    });
});
