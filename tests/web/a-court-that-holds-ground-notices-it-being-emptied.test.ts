/**
 * Who notices a site being emptied, when the claimant is not a sect.
 *
 * `attentionFor` built its list of claimants by mapping `site.factionIds`
 * through `repos.sects.getById`, and that repository is seeded from `SECTS`
 * alone - so a claimant id belonging to `COURTS` or `APEX_INSTITUTIONS` was
 * silently dropped. Everything downstream is gated on the list being non-empty,
 * so what went with it was the deed, the grudge and every player-facing line,
 * including the nameless fallback - which counts only claimants that survived
 * the filter.
 *
 * Measured over the thirty sites: The Tended Tomb, an ordinal-44 grave tended
 * by a court and by nobody else, produced TOTAL SILENCE when emptied. So did
 * The Counted Stair and The Inward Faces, and The Stopped Ground lost half its
 * claim. That is the defect the block's own comment says it exists to close -
 * "taking was strictly better than not taking, every time" - still live on four
 * of thirty.
 *
 * What is deliberately still dropped: a claimant in `DESTROYED_DAO_HOUSES`. A
 * house that ended two thousand years ago holds nothing and sends nobody. And
 * the WORLD FACT takes a narrower list than the ledger does - see the second
 * half of the test, and the measurement that put it there.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';
import { SITES } from '../../src/data/cultivation/inheritance-trials';
import { getCourt } from '../../src/data/cultivation/hierarchy';

const TENDED_BY_A_COURT = 'grave-shen-guyi';

interface Held { holder_id: string; cause: string; severity: string }

describe('a court that holds ground', () => {
    it('notices it being emptied, and opens an account about it', async () => {
        const site = SITES.find(row => row.id === TENDED_BY_A_COURT)!;
        expect(site, 'the catalog no longer carries this grave').toBeDefined();
        // The claim is a COURT and nothing else, which is what made this the
        // measurable case rather than a half-silent one.
        expect(site.factionIds.every(id => getCourt(id) !== undefined)).toBe(true);

        const { db, game } = await makeGameInWorld({
            seed: 'court-notices', worldSeed: 'world-court-notices'
        });
        const { cultivator } = await game.newRun('Robber');
        const run = (game as any).currentRun().run;

        const noticed = (game as any).attentionFor(run, cultivator, site);

        // A line the player actually reads, naming what it can name.
        expect(noticed.lines.length).toBeGreaterThan(0);
        // And a record held BY the court ABOUT this cultivator.
        const held = db.prepare(
            'SELECT holder_id, cause, severity FROM obligations WHERE subject_id = ?'
        ).all(cultivator.id) as Held[];
        const row = held.find(r => site.factionIds.includes(r.holder_id));
        expect(row, 'the court holds nothing about it').toBeDefined();
        expect(row!.cause).toBe('robbery');
        // Ordinal 44 is over the unforgivable band, and the band is read off
        // the pitch rather than off who the claimant is.
        expect(row!.severity).toBe('unforgivable');

        // ── AND THE WORLD FACT IS NOT WRITTEN, WHICH IS THE OTHER FINDING ──
        //
        // Measured while fixing the above: the world seeds 36 factions and not
        // one court or apex is among them. A history fact's `factionIds` is a
        // CHANNEL - the digest hands over the engine's own summary only when
        // every body the fact names is one the reader has a record for - so
        // naming a court on the fact took the Clearwater Ward disciple who
        // shares the claim on The Stopped Ground from `named` down to
        // `unattributed`, and the theft stopped reaching the one house that
        // could hear it.
        //
        // So the ledger takes every claimant and the fact takes the ones the
        // world contains. For a site claimed by a court and nobody else that
        // means an account with nobody to repeat it, and the reason is a gap in
        // the SEEDER rather than in this read: a court is a body the catalog
        // has and the world does not.
        expect(noticed.calls.some((call: { name: string }) =>
            call.name === 'world.aDeedEntersTheWorld')).toBe(false);
    }, 300_000);
});
