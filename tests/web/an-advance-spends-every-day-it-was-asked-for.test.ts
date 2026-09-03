/**
 * `ADMIN advance_days years=N` has to actually advance N years.
 *
 * ══ WHY THIS IS A RATE TEST AND NOT A UNIT ONE ═════════════════════════════
 *
 * Nothing here is about whether the time skip computes the right thing. It is
 * about whether the span an operator ASKS FOR is the span that happens - which
 * is invisible to every unit test in the tree, silently corrupts every
 * measurement taken through this surface, and has already gone wrong once.
 *
 * What went wrong: the deviation check fired on a thirty-day grid against the
 * calendar rather than against an act, so a body doing nothing whatever tore
 * its own meridians open and hit `lethal_injury_threshold`. Measured through
 * this exact surface, `years=120` at ordinal 20: **780 of 43800 days simulated,
 * 2.14 of the 120 years asked for, three untreated `qi_deviation` wounds, on
 * four world seeds identically.** The number came back in the digest and
 * nothing made anybody read it, so a test that wanted a century of world got a
 * fortnight and could not tell. That was fixed in `time-skip.ts` - see the
 * banner over `DEVIATION_CHECK_DAYS`, and AGENTS.md's *a wound has a cause you
 * can point at* - and nothing guarded it afterwards. This is the guard.
 *
 * ── The expectations are closed form, not sampled ─────────────────────────
 *
 * Above `SATIETY_BURN_BY_REALM.deity_transformation` a body burns no satiety at
 * all, so the hunger clock cannot stop the span; a span shorter than
 * `stagnationYearsForOrdinal` and than the realm's lifespan cannot be stopped
 * by settling or by age. With `randomEvents: false` - which is what
 * `advance_days` passes - nothing else is left, so the exact answer is
 * `years * DAYS_PER_YEAR` and the exact wound count is zero. Both are derived
 * from the constants rather than typed in, so editing one of those constants
 * fails here rather than quietly moving the bar.
 *
 * ── And both edges, because a floor would pass on a dead system ───────────
 *
 * A test that only asserted "the whole span ran" would also pass if deviation
 * had been switched off everywhere, which is the opposite defect and just as
 * bad. So the third case pins that the roll still fires for somebody who IS
 * drawing qi, and the second pins that the span still stops for an empty pack -
 * a decision the operator has not made, and the one thing `time-skip.ts` says
 * this loop must never drive past.
 *
 * Pinned worlds, four of them, because the brief that produced this measured
 * the defect as world-seed independent and that property is worth keeping.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';
import { DAYS_PER_YEAR } from '../../src/engine/cultivation/cultivation.js';
import { MAX_ORDINAL, lifespanForOrdinal } from '../../src/engine/cultivation/realms.js';
import { stillNeedsToEat } from '../../src/engine/cultivation/survival.js';
import { stagnationYearsForOrdinal } from '../../src/schema/cultivation.js';
import { DEVIATION_CHECK_DAYS, simulateTimeSkip } from '../../src/engine/cultivation/time-skip.js';
import type { CultivatorState } from '../../src/schema/cultivation.js';

const WORLDS = ['a-world-that-has-lived', 'war-1', 'pyr-a', 'pyr-c'];

/**
 * The lowest rung that does not have to eat, read off the burn table rather
 * than written down. Everything above it burns zero too, so this is the whole
 * band and picking the bottom of it keeps the body as ordinary as possible.
 */
const NO_HUNGER_ORDINAL = (() => {
    for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal += 1) {
        if (!stillNeedsToEat(ordinal)) return ordinal;
    }
    throw new Error('no rung on the ladder is free of the hunger clock');
})();

/** A span the body at that rung can neither starve, settle nor age out of. */
const SPAN_YEARS = 120;

beforeAll(() => {
    process.env.ADMIN_MODE = 'true';
});

interface Said { narration?: string; error?: string }

describe('an advance spends every day it was asked for', () => {
    it('is asked for a span nothing in the body can stop', () => {
        // The premise of the first case, stated rather than assumed: if a later
        // change to either constant makes this span reachable by settling or by
        // age, the case below would start measuring that instead and would look
        // like a regression in the advance.
        expect(SPAN_YEARS).toBeLessThan(stagnationYearsForOrdinal(NO_HUNGER_ORDINAL));
        expect(SPAN_YEARS).toBeLessThan(lifespanForOrdinal(NO_HUNGER_ORDINAL));
        expect(stillNeedsToEat(NO_HUNGER_ORDINAL)).toBe(false);
    });

    it('simulates the whole span, to the day, and takes no wounds doing it', async () => {
        const expected = SPAN_YEARS * DAYS_PER_YEAR;
        for (const worldSeed of WORLDS) {
            const { game } = await makeGameInWorld({ seed: 'wrong-a', worldSeed });
            await game.newRun('Walker');
            const say = (s: string) => game.act(s) as Promise<Said>;
            await say(`ADMIN set_realm ordinal=${NO_HUNGER_ORDINAL}`);
            const said = (await say(`ADMIN advance_days years=${SPAN_YEARS}`)).narration ?? '';

            const where = `${worldSeed}: ${said.slice(0, 400)}`;
            expect(said, where).toContain(`Requested: ${expected} day(s)`);
            // To the day. Not "most of it" - the whole point of this file is
            // that a shortfall reads as a plausible number.
            expect(said, where).toContain(`Simulated: ${expected} day(s), ${SPAN_YEARS} years`);
            expect(said, where).toContain('Stopped short by: nothing; the whole span ran');
            // And nothing was hurt by the calendar.
            expect(said, where).not.toContain('qi_deviation');
            expect(said, where).not.toContain('lethal_injury_threshold');

            const cultivator = (game as unknown as {
                atHand: { cultivator?: { injuries?: unknown[] } };
            }).atHand?.cultivator;
            expect(cultivator?.injuries ?? [], where).toHaveLength(0);
        }
    }, 900_000);

    it('still stops for an empty pack, and not for wounds it invented', async () => {
        // The other half of the contract. A body that DOES eat, unprovisioned,
        // must stop - an empty pack is a decision the operator has not made -
        // and the reason it stops must be the pack rather than three meridian
        // wounds it gave itself. Core Formation Perfection is the rung the
        // original report used; the figure is the same on every world seed
        // because hunger is arithmetic and nothing else is running.
        for (const worldSeed of WORLDS) {
            const { game } = await makeGameInWorld({ seed: 'wrong-a', worldSeed });
            await game.newRun('Walker');
            const say = (s: string) => game.act(s) as Promise<Said>;
            await say('ADMIN set_realm ordinal=20');
            const said = (await say(`ADMIN advance_days years=${SPAN_YEARS}`)).narration ?? '';

            const where = `${worldSeed}: ${said.slice(0, 400)}`;
            expect(said, where).toContain('starvation_begun');
            expect(said, where).not.toContain('lethal_injury_threshold');
            const cultivator = (game as unknown as {
                atHand: { cultivator?: { injuries?: unknown[] } };
            }).atHand?.cultivator;
            expect(cultivator?.injuries ?? [], where).toHaveLength(0);
        }
    }, 900_000);

    it('has not simply switched the deviation roll off for everybody', () => {
        // Both arms in one command, same body, same seed, same span: the only
        // thing that differs is whether the time is spent drawing qi. A guard
        // with only the idle arm in it would certify a dead subsystem.
        const body: CultivatorState = {
            id: 'rate-test-body',
            name: 'Arm',
            age: 30,
            realmOrdinal: 10,
            realmKey: 'qi_condensation',
            cultivationProgress: 0,
            spiritRoot: 'muddled_five_element',
            hp: 100,
            maxHp: 100,
            qi: 100,
            maxQi: 100,
            satiety: 100,
            starvationTurns: 0,
            bleedingTurns: 0,
            injuries: [],
            spiritStones: 0,
            yearsAtCurrentRealm: 0,
            attributes: { might: 1, insight: 1, fortune: 1, resolve: 1 }
        } as unknown as CultivatorState;

        const span = 20 * DAYS_PER_YEAR;
        const ctx = {
            seed: 'both-arms',
            ambientQi: 'normal' as const,
            startDay: 0,
            randomEvents: false,
            autoBreakthrough: false,
            grainAbstinence: true
        };
        const cultivating = simulateTimeSkip(body, span, ctx);
        const idle = simulateTimeSkip(body, span, { ...ctx, options: { focusMultiplier: 0 } });

        const deviations = (r: { events: { kind: string }[] }) =>
            r.events.filter(e => e.kind === 'qi_deviation').length;

        // Twenty years is 240 checks on the thirty-day grid for the arm that is
        // drawing qi, and none at all for the arm that is not.
        expect(span / DEVIATION_CHECK_DAYS).toBeGreaterThan(100);
        expect(deviations(cultivating)).toBeGreaterThan(0);
        expect(deviations(idle)).toBe(0);
    });
});
