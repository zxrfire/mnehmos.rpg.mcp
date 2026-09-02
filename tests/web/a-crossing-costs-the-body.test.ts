/**
 * A crossing deals damage, and the two things that do not.
 *
 * The design owner's ruling, verbatim:
 *
 *   > don't forget that crossing deals damage too (unless via admin panel) or
 *   > the immortal pill that lets you skip a ordinal - that's the diff between
 *   > the immortal pill and the ones that give you qi, the qi ones you still
 *   > have to cross and risk it.
 *
 * Measured before it existed: six commanded crossings, ordinal 0 to 6, health
 * 40 of 40 the whole way. `attemptBreakthrough` returned no body cost at all;
 * a successful crossing was free on both paths. So the sentence that separates
 * the Unearned Step from a qi pill separated nothing, because the thing the qi
 * pill makes you pay was not being charged.
 *
 * The two exemptions come from the shape rather than from a flag. Both the
 * admin panel's `set_realm` and the Step go through `advanceRealm`, which
 * re-derives the pools and does nothing else; neither ever reaches
 * `attemptBreakthrough`, so neither can be charged by it.
 */

import { describe, it, expect } from 'vitest';
import { makeGameInWorld } from './harness';
import { addToPouch } from '../../src/server/consolidated/cultivation-support';
import {
    BODY_COST_OF_A_CROSSING,
    BODY_COST_OF_A_STEP,
    bodyCostOfArriving
} from '../../src/engine/cultivation/breakthrough';
import { isRealmBoundary } from '../../src/engine/cultivation/realms';
import { HP_RECOVERY_FRACTION_PER_DAY } from '../../src/schema/cultivation';
import { humanDays, theBodyIsNearlyGone } from '../../src/web/facts';

const WORLD = 'a-crossing-costs-the-body';

describe('what arriving costs', () => {
    it('prices a realm boundary above a rung inside one', () => {
        // Not a tuning assertion - an ordering one. The rest of this file's
        // design rests on a boundary being a different kind of event, the way
        // `REALM_BOUNDARY_STRAIN`, the failure table and the toll all do.
        expect(BODY_COST_OF_A_CROSSING).toBeGreaterThan(BODY_COST_OF_A_STEP);
        expect(bodyCostOfArriving(12), 'ordinal 12 is a wall').toBe(BODY_COST_OF_A_CROSSING);
        expect(isRealmBoundary(12)).toBe(true);
        expect(bodyCostOfArriving(1), 'ordinal 1 is a rung').toBe(BODY_COST_OF_A_STEP);
    });

    /**
     * The played verb, which is where it bites hardest: `strikeBarrier` spends
     * NO DAYS, so somebody with banked progress can strike several times in an
     * afternoon and never mend a point between them.
     */
    it('takes it out of the body on the path a player types', async () => {
        const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'commanded' });
        const opened = await h.game.newRun('Shen Wu');
        const id = opened.cultivator.id;

        let crossings = 0;
        let charged = 0;
        for (let i = 0; i < 8 && crossings < 3; i++) {
            h.repos.cultivators.update(id, { cultivationProgress: 100_000 } as never);
            const before = h.game.state().cultivator;
            const { narration } = await h.game.act('I break through');
            const after = h.game.state().cultivator;
            if (after.realmOrdinal === before.realmOrdinal) continue;  // a failure, which is free
            crossings++;

            // The share of the pool went DOWN, which is the whole claim: the
            // vessel grew and what is standing in it did not keep up.
            expect(after.hp / after.maxHp, 'a crossing costs')
                .toBeLessThan(before.hp / before.maxHp);
            expect(narration, 'and the turn says so').toContain('Getting through it took');
            charged += 1;
        }
        expect(crossings, 'three crossings actually landed').toBe(3);
        expect(charged).toBe(3);
    }, 60_000);

    /**
     * The same rule inside a seclusion, through the auto-breakthrough. Two
     * implementations of one price is where the two would drift, and a player
     * who could dodge the toll by choosing the other door would be playing a
     * different game from the one the world plays.
     */
    it('takes it out of the body inside a seclusion too', async () => {
        const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'secluded' });
        await h.game.newRun('Shen Wu');
        await h.game.act('I buy the Lesser Qi-Gathering Manual');
        await h.game.act('I learn the Lesser Qi-Gathering Manual');

        const { narration } = await h.game.act('I cultivate for 30 years');
        const after = h.game.state().cultivator;

        if (after.realmOrdinal > 0 && after.alive) {
            expect(narration, 'the digest says what arriving took')
                .toMatch(/took \d+ of the body/);
        }
    }, 120_000);

    /**
     * A crossing that SUCCEEDED must not end the run by arithmetic, or
     * `success` and `death` stop being separate answers. What it may do is
     * leave somebody on almost nothing - which is the risk the ruling is about,
     * and which the turn now says out loud.
     */
    it('never kills the cultivator it just carried across', async () => {
        const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'not-lethal' });
        const opened = await h.game.newRun('Shen Wu');
        const id = opened.cultivator.id;

        for (let i = 0; i < 12; i++) {
            h.repos.cultivators.update(id, { cultivationProgress: 100_000 } as never);
            const before = h.game.state().cultivator;
            if (!before.alive) break;
            await h.game.act('I break through');
            const after = h.game.state().cultivator;
            // A crossing may leave them on one point. It may not take the last.
            if (after.realmOrdinal > before.realmOrdinal) {
                expect(after.hp, 'a crossing leaves at least one point').toBeGreaterThanOrEqual(1);
                expect(after.alive, 'and does not close the run').toBe(true);
            }
        }
    }, 120_000);

    /** A failure has its own wound table. Charging both prices one event twice. */
    it('charges nothing for an attempt that did not arrive', async () => {
        const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'failures' });
        const opened = await h.game.newRun('Shen Wu');
        const id = opened.cultivator.id;

        let sawAFailure = false;
        for (let i = 0; i < 12 && !sawAFailure; i++) {
            h.repos.cultivators.update(id, { cultivationProgress: 100_000 } as never);
            const before = h.game.state().cultivator;
            const { narration } = await h.game.act('I break through');
            const after = h.game.state().cultivator;
            if (after.realmOrdinal !== before.realmOrdinal) continue;
            sawAFailure = true;
            expect(narration).not.toContain('Getting through it took');
        }
        expect(sawAFailure, 'a failure landed in twelve attempts').toBe(true);
    }, 120_000);
});

describe('the route the warning names has to be a route', () => {
    /**
     * PLAYED, and it is the failure `AGENTS.md`'s refusal rule exists to
     * prevent. A player at 1 of 40 with 2 spirit stones was refused a physician
     * correctly - *"price-splint-and-month = 7 stone(s); purse holds 2"* - and
     * told by the engine's own required line that sitting still mends it back.
     * They sat still. Forty-four days, the last two stones gone on rations:
     *
     *     HP after 44 days: 1 of 40. Unchanged.
     *
     * Measured afterwards on the same numbers, which is what settles which of
     * the three candidate faults it was:
     *
     *     44 days at 1 of 40  ->  1 of 40    (0.02/day, floored to nothing)
     *     50 days at 1 of 50  ->  2 of 50
     *
     * The body IS mending, the block is NOT gated on untreated wounds, and
     * `wait` and `seclude` run identical arithmetic - so the verb is not the
     * explanation either. `HP_RECOVERY_FRACTION_PER_DAY` is denominated in
     * YEARS on purpose, and its own ruling says why it must not be raised: a
     * faster calendar hands back more than a month of care does and makes the
     * whole healing ladder pointless.
     *
     * So the rate is right and the sentence was wrong. A real route with its
     * span withheld is a bare refusal that took six weeks to arrive.
     */
    async function atDeathsDoor(seed: string, spiritStones: number) {
        const h = await makeGameInWorld({ worldSeed: WORLD, seed });
        const opened = await h.game.newRun('Shen Wu');
        h.repos.cultivators.update(
            opened.cultivator.id, { hp: 1, spiritStones } as never
        );
        return h;
    }

    it('says how long sitting still actually takes', async () => {
        const h = await atDeathsDoor('how-long', 200);
        const { narration } = await h.game.act('I wait 44 days');

        expect(narration).toContain('There is almost nothing left in the body');
        // The span, computed off the same constant the skip mends by rather
        // than asserted, so the two cannot drift.
        expect(narration).toMatch(/about [\d.]+ years of quiet to be whole again/);
        // And the gate that ate the played stretch.
        expect(narration).toContain('empty belly');
    }, 60_000);

    it('does not point a player with two stones at a physician', async () => {
        const h = await atDeathsDoor('too-poor', 2);
        const { narration } = await h.game.act('I wait 44 days');

        expect(narration).toContain('not enough to be asked for');
        expect(narration, 'and names what is').toContain('Earning is the move');
    }, 60_000);

    it('does point one who can afford it', async () => {
        const h = await atDeathsDoor('can-pay', 200);
        const { narration } = await h.game.act('I wait 44 days');
        expect(narration).toContain('you can afford to ask');
    }, 60_000);

    /**
     * The measurement itself, kept as a test because the sentence above is only
     * honest while it is true. If somebody raises the rate, this goes red and
     * the span in the prose is recomputed rather than left lying.
     */
    /**
     * The span in the prose is computed off the constant the skip mends by, and
     * this is the guard that keeps the two from drifting.
     *
     * Deliberately a test of the SENTENCE and not of the engine's rate. The rate
     * is `care-ladder.test.ts`'s, and its own ruling explains at length why it
     * must not move; what this file is responsible for is that the figure the
     * player is handed is derived from it rather than written beside it. A first
     * attempt at measuring the rate here through a played turn measured the FOOD
     * ECONOMY instead - only seclusion tops the pack up at the door, so a long
     * `wait` runs the belly to zero and mending is gated on a belly. That gate
     * is the other half of what ate the played stretch, and it is why the
     * sentence names it.
     */
    it('computes the span from the constant rather than asserting one', () => {
        for (const [hp, maxHp] of [[1, 40], [1, 50], [20, 40], [300, 1280]] as const) {
            const said = theBodyIsNearlyGone({ hp, maxHp });
            const expected = humanDays(
                Math.ceil((maxHp - hp) / (maxHp * HP_RECOVERY_FRACTION_PER_DAY))
            );
            expect(said, `${hp} of ${maxHp}`).toContain(`about ${expected} of quiet`);
        }
        // The played case, in the numbers the run had. Five years, not a turn.
        expect(theBodyIsNearlyGone({ hp: 1, maxHp: 40 })).toContain('5.3 years');
    });
});

describe('the immortal pill is the exemption, and it is the point', () => {
    /**
     * `promote_realm` had ZERO consumers in `src/` outside the catalog that
     * declares it and one test that reads the catalog, so the exemption the
     * owner's sentence names had nothing to name it with. See
     * `taking-the-unearned-step.ts`.
     */
    it('crosses a wall without touching the body', async () => {
        const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'the-step' });
        const opened = await h.game.newRun('Shen Wu');
        const id = opened.cultivator.id;

        // Standing at the top of Qi Condensation, which is a wall.
        h.repos.cultivators.update(id, { realmOrdinal: 12 } as never);
        addToPouch(h.db, id, 'immortal-unearned-step:lower', 'pill', 1);

        const before = h.game.state().cultivator;
        const { narration } = await h.game.act('I take the pill');
        const after = h.game.state().cultivator;

        expect(after.realmOrdinal, 'one boundary, and exactly one')
            .toBe(before.realmOrdinal + 1);
        // The share is untouched. `advanceRealm` carries it across and nothing
        // subtracts from it, because no crossing was attempted.
        expect(after.hp / after.maxHp).toBeCloseTo(before.hp / before.maxHp, 2);
        expect(narration).toContain('without an attempt and without a roll');
        expect(narration).not.toContain('Getting through it took');
    }, 60_000);

    /** "It never grants a within-realm rung." And the refusal names the route. */
    it('is worth nothing anywhere but at a wall, and says where the wall is', async () => {
        const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'not-a-wall' });
        const opened = await h.game.newRun('Shen Wu');
        const id = opened.cultivator.id;
        addToPouch(h.db, id, 'immortal-unearned-step:lower', 'pill', 1);

        const { narration } = await h.game.act('I take the pill');
        const after = h.game.state().cultivator;

        expect(after.realmOrdinal, 'nothing moved').toBe(0);
        expect(narration).toContain('is not a wall');
        expect(narration, 'and it names where it would work')
            .toContain('Qi Condensation Layer 13');
        // Aiming it is not spending it.
        expect(narration).toContain('still in the pouch');
    }, 60_000);

    /** Grade caps the destination, not the distance. */
    it('will not put a lower grade past the realm its grade reaches', async () => {
        const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'the-ceiling' });
        const opened = await h.game.newRun('Shen Wu');
        const id = opened.cultivator.id;
        // Body Integration Marrow: the wall into Grand Ascension, which only a
        // higher grade reaches.
        h.repos.cultivators.update(id, { realmOrdinal: 36 } as never);
        addToPouch(h.db, id, 'immortal-unearned-step:lower', 'pill', 1);

        const { narration } = await h.game.act('I take the pill');

        expect(h.game.state().cultivator.realmOrdinal).toBe(36);
        expect(narration).toContain('delivers nobody past Deity Transformation');
        // "It is simply consumed against a body that will not take it twice" -
        // and against a wall it was never going to reach either.
        expect(narration).toContain('gone either way');
    }, 60_000);

    /** One per person, ever, and the second is consumed doing nothing. */
    it('carries one body across once', async () => {
        const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'once-in-a-life' });
        const opened = await h.game.newRun('Shen Wu');
        const id = opened.cultivator.id;
        h.repos.cultivators.update(id, { realmOrdinal: 12 } as never);
        addToPouch(h.db, id, 'immortal-unearned-step:lower', 'pill', 1);

        await h.game.act('I take the pill');
        const afterFirst = h.game.state().cultivator.realmOrdinal;

        h.repos.cultivators.update(id, { realmOrdinal: 16 } as never);
        addToPouch(h.db, id, 'immortal-unearned-step:higher', 'pill', 1);
        const { narration } = await h.game.act('I take the pill');

        expect(h.game.state().cultivator.realmOrdinal, 'the second moved nothing').toBe(16);
        expect(narration).toContain('will not be carried again');
        expect(afterFirst).toBe(13);
    }, 60_000);
});
