/**
 * Somebody on no house's roll has no rung to name, and the sheet used to stop
 * at "you serve no house". A province still has a word for them - a loose
 * cultivator, a wandering senior - and `ROGUE_STANDING` holds it by height.
 * The status sheet now says which one applies.
 *
 * Driven through `status`, because the rule was written and never read: a
 * test that calls `whatTheyCallARogue` directly would pass with nothing wired.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { ROGUE_STANDING } from '../../src/data/cultivation/rogues';

const WORLD = 'status-names-a-rogue';

async function unbackedAt(seed: string, ordinal: number) {
    const h = await makeGameInWorld({ seed, worldSeed: WORLD, worldEnabled: true });
    const { cultivator } = await h.game.newRun('Wanderer');
    h.db.prepare('UPDATE cultivators SET realm_ordinal = ?, sect_id = NULL WHERE id = ?')
        .run(ordinal, cultivator.id);
    h.db.prepare('DELETE FROM sect_members WHERE cultivator_id = ?').run(cultivator.id);
    return h;
}

/** The band a province would put this height in, off the table itself. */
function calledAt(ordinal: number): string {
    return ROGUE_STANDING.filter(band => band.fromOrdinal <= ordinal).at(-1)!.called;
}

describe('status says what a province calls you with no house', () => {
    it('names the band for the height', async () => {
        const h = await unbackedAt('status-rogue-senior', 22);
        const said = (await h.game.act('status')).narration;
        expect(said, 'the sheet did not say the player serves no house').toMatch(/serve no house/i);
        expect(said, 'the band for this height did not reach the sheet').toContain(calledAt(22));
    }, 180_000);

    it('moves with the height rather than saying one word for everybody', async () => {
        const h = await unbackedAt('status-rogue-loose', 14);
        const said = (await h.game.act('status')).narration;
        expect(calledAt(14)).not.toBe(calledAt(22));
        expect(said).toContain(calledAt(14));
        expect(said).not.toContain(calledAt(22));
    }, 180_000);
});
