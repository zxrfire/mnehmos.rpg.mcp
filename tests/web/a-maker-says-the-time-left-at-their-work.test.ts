/**
 * A fractional commission keeps its actual remaining work in the answer.
 * The busy reader clamped three hours left to a full day after commissions
 * gained the real clock. A player waiting for that answer would miss the end.
 * Whole work and completed work keep their existing readings.
 */
import { describe, expect, it } from 'vitest';
import { whatTheMakerIsAlreadyMaking } from '../../src/web/a-commission-placed-with-a-maker';
import type { NpcRecord } from '../../src/engine/world/npc-state';

const maker: Pick<NpcRecord, 'activity' | 'name'> = {
    name: 'The maker',
    activity: { kind: 'the_work_of_their_rank', note: 'Making a passage tally.',
        thingId: 'the-work', withIds: [], sinceDay: 10.75, untilDay: 11.75 }
};

describe('the time left at the bench', () => {
    it('reports three actual hours without inventing another day', () => {
        expect(whatTheMakerIsAlreadyMaking(maker, 11.625)).toContain('done in 3 hours');
    });
    it('reports a whole day when a whole day remains', () => {
        expect(whatTheMakerIsAlreadyMaking(maker, 10.75)).toContain('done in 1 day');
    });
    it('has no busy refusal when the actual work has ended', () => {
        expect(whatTheMakerIsAlreadyMaking(maker, 11.75)).toBeNull();
    });
});
