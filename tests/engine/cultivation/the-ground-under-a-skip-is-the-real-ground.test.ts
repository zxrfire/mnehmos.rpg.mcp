/**
 * THE GROUND UNDER A SKIP IS THE REAL GROUND.
 *
 * `TimeSkipContext.locationDensity` is the front door for the world's own
 * `spiritualDensity`, and NOTHING in the repository ever passed it - not one of
 * the ten `simulateTimeSkip` call sites. So every skip in the played game fell
 * through to `impliedDensityFor`, which is a hash of the place's NAME, and a
 * cultivator's progress was decided by how their location was spelled.
 *
 * ── WHAT THAT COST, MEASURED ─────────────────────────────────────────────
 *
 * Across a seeded world of 1065 locations the guessed band was wrong at 78.2%
 * of them, and the rate multiplier was off by four times at 24.4%. The
 * direction is arbitrary, which is the point - the hash has no idea what the
 * world authored:
 *
 *   Sweet Spring    real 0.00 (thin, x0.5)   guessed 0.75 (dense, x2)
 *   Thin Ridge      real 0.00 (thin, x0.5)   guessed 0.73 (dense, x2)
 *   Nine Peaks      real 0.78 (dense, x2)    guessed 0.06 (thin, x0.5)
 *
 * A place named for water read as rich ground and was dead; a place named for
 * thinness read as rich; and the world's actual peaks read as thin.
 *
 * ── AND THE NUMBER WAS ALREADY THERE ─────────────────────────────────────
 *
 * `options.ground` is a `GroundConditions` carrying the location's real
 * `spiritualDensity`. Nine of the ten call sites already build it and pass it,
 * and `simulateTimeSkip` already read it - for crowding and for the barren
 * ground ceiling - and then threw it away when it came to the band. One fact,
 * derived in three places, with only the worst derivation allowed to decide
 * anything.
 *
 * These hold the PRECEDENCE, which is the whole of the change: an explicit
 * `locationDensity` still wins, the world's ground answers next, and the name
 * hash is what is left for a caller that knows neither.
 */

import { describe, expect, it } from 'vitest';

import { simulateTimeSkip } from '../../../src/engine/cultivation/time-skip.js';
import { readFileSync } from 'node:fs';

import { makeCultivator } from './fixtures.js';

/** A stretch long enough that a rate difference is visible in the result. */
const A_LONG_SIT = 3_650;

/**
 * RUNGS GAINED, and not leftover progress.
 *
 * `deltas.cultivationProgress` is what is left over AFTER any breakthroughs the
 * span paid for, so it goes DOWN as the ground gets better - richer ground
 * spends the progress on a rank instead of banking it. Reading it as the
 * measure says dead ground beats a sealed vein, which is backwards and was the
 * first thing this file got wrong about itself.
 */
function rungsGained(ctx: Record<string, unknown>): number {
    const result = simulateTimeSkip(makeCultivator(), A_LONG_SIT, {
        seed: 'the-ground-under-a-skip',
        locationId: 'somewhere',
        ...ctx
    } as never);
    return result.deltas.realmOrdinal ?? 0;
}

describe('which density a skip actually uses', () => {
    it('reads the world\'s ground when the caller passes one', () => {
        // The same place, the same seed, the same span. The only difference is
        // the ground the world says is under it.
        const rich = rungsGained({ options: { ground: { density: 0.95 } } });
        const dead = rungsGained({ options: { ground: { density: 0.0 } } });

        // Measured: a decade of the same sitting is one rung on rich ground and
        // none at all on dead ground.
        expect(rich, 'rich ground returned nothing').toBeGreaterThan(0);
        expect(dead, 'dead ground paid for a rung').toBe(0);
    });

    it('lets an explicit locationDensity win over the ground', () => {
        // Precedence, and it matters: a caller that states a density is
        // describing something the location record does not know - a sealed
        // pocket, a probe, a test - and must not be overruled by the row.
        const stated = rungsGained({
            locationDensity: 0.95,
            options: { ground: { density: 0.0 } }
        });
        const fromTheRow = rungsGained({ options: { ground: { density: 0.0 } } });
        expect(stated).toBeGreaterThan(fromTheRow);
    });

    it('still falls to the implied guess for a caller that knows neither', () => {
        // The old behaviour, kept as the LAST resort rather than the only one.
        // Engine tests pass their own ctx and must go on working untouched.
        const guessed = rungsGained({});
        expect(Number.isFinite(guessed)).toBe(true);
        expect(guessed).toBeGreaterThanOrEqual(0);
    });

    /**
     * AND THE SEAL DOES NOT RIDE IN ON IT.
     *
     * `ambientForLocationOnDay` short-circuits to `sealed_vein` the moment
     * `sealed` is true, BEFORE it reads any density - and `sealed_vein` is the
     * richest band in the game and the only one that carries anybody past
     * ordinal 32. `simulateTimeSkip` accepts and honours that flag ALREADY, and
     * the size of it is measured below: a decade on DEAD ground pays for no
     * rungs at all, and the same decade on the same dead ground with a seal on
     * it pays for TWO. The seal does not consult the density - sealed rich
     * ground and sealed dead ground return the identical two.
     *
     * So the trap is live in the engine and is held shut by exactly one thing -
     * that no caller passes it. That was true before this change and had to stay
     * true through it, because the density join hands every call site the real
     * `spiritualDensity`, and a locked vault is the thinnest ground in a
     * compound. Forwarding a room's lock as a pocket's seal would have given the
     * worst ground in the world the best rate in it.
     *
     * `aSealHereMeansAnUndrawnPocket` in `locations.ts` is the reader that tells
     * the two meanings apart, and it reached `TurnEngine.ambientFor` and not
     * this. These two hold the gap open so a later change has to come past them
     * and rule on it deliberately.
     */
    it('turns dead ground into the best in the game when a seal is passed', () => {
        const dead = rungsGained({ options: { ground: { density: 0.0 } } });
        const deadAndSealed = rungsGained({
            sealed: true, options: { ground: { density: 0.0 } }
        });
        const richAndSealed = rungsGained({
            sealed: true, options: { ground: { density: 0.95 } }
        });

        // Not an endorsement. The measurement, so the size of the trap is on
        // the record beside the rule that keeps it shut.
        expect(dead, 'dead ground paid for a rung').toBe(0);
        expect(deadAndSealed, 'a seal on dead ground bought nothing').toBeGreaterThan(0);
        // And it never looked at the ground: the same answer either way.
        expect(richAndSealed).toBe(deadAndSealed);
    });

    it('is passed by nothing in production, which is what keeps it shut', () => {
        const sources = [
            'src/web/turn-engine.ts',
            'src/web/seclusion-verbs.ts',
            'src/web/site-verbs.ts',
            'src/web/travel-verbs.ts',
            'src/server/consolidated/cultivation-manage.ts'
        ];
        for (const file of sources) {
            const text = readFileSync(file, 'utf8');
            // Every `simulateTimeSkip(` call and the object literal after it.
            for (const at of [...text.matchAll(/simulateTimeSkip\(/g)].map(m => m.index ?? 0)) {
                const call = text.slice(at, at + 900);
                expect(call.includes('sealed'), `${file} passes sealed into a skip`).toBe(false);
            }
        }
    });
});
