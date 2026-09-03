/**
 * The world pays for its rungs in the same coin the player does.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS PINS, AND WHY IT IS A TEST RATHER THAN A COMMENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `BreakthroughResult.bodyCost` charges a share of the pool at every rung and
 * three times that at a realm boundary. For a while it bound the PLAYER and
 * nobody else, and not because anybody decided that: `NpcCultivation` had no
 * body, so there was nothing on a record for the toll to come out of and the
 * charge was silently dropped. Every cultivator in the world climbed for free
 * while the player paid blood for each rung, and every comparison the world
 * made between them - a bout, a competition placing, who is overmatched - was
 * made against a population that had never been charged.
 *
 * `AGENTS.md` states the rule this violates in its checkable form: *"any
 * capability the world gives a non-player is a capability the player has,
 * through the same code"*, and the mirror image - a rule that binds the player
 * and not NPCs - is the same failure. It also names the neighbouring field as
 * the worked example: *"`untreatedInjuries` is an integer, so no NPC can carry
 * a typed wound the player can carry."*
 *
 * So what is asserted here is not a number. It is that ONE derivation answers
 * for both sides, at four separate joints:
 *
 *   THE POOL      `maxHpForOrdinal`, which `realms.ts` says nobody may write a
 *                 second of. The world stores what is STANDING and derives the
 *                 maximum, so a cache cannot disagree with the ordinal on the
 *                 row next to it.
 *   THE CARRY     `carriedAcross`, so a rung change keeps the share and not the
 *                 number - the same arithmetic `strikeBarrier` runs.
 *   THE CHARGE    `whatACrossingTakesFrom`, including its clamp, so a crossing
 *                 can leave somebody standing on nothing and can never be the
 *                 thing that finishes them.
 *   THE MENDING   `HP_RECOVERY_FRACTION_PER_DAY`, so a boundary's toll is
 *                 repaid in a little under a year here exactly as it is there.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THE TOLL IS WORTH TO THE WORLD, MEASURED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Close to nothing in aggregate, and that is a fact about how the world climbs
 * rather than about the price. The toll was written for SPEED - somebody who
 * banks progress and strikes four times in an afternoon, which `strikeBarrier`
 * permits because it spends no days. The world cannot reach that state: the
 * advancement pass visits a person once every twelve years and `readyToStrike`
 * refuses anybody who has not stood at the rung long enough to hold the whole
 * requirement, so one crossing per review is the ceiling and a review is long
 * enough to mend several pools over.
 *
 * Measured, `scripts/probe-what-a-crossing-costs-the-world.ts`, five seeds at
 * 200 years - it walks the world a year at a time and watches every living
 * body, so a charge is observed rather than inferred:
 *
 *     1,319 charges over 1,000 world-years   mean 0.058 of the pool, deepest 0.150
 *     4 of 2,680 alive carrying one          0.15% of the world, at any instant
 *
 * So the toll is written more than once a world-year and read almost always
 * against a whole body, because a realm boundary's share is repaid in under a
 * year. The population pyramid is consequently insensitive to it: taken
 * back-to-back in one command on one tree, base against change, both arms read
 * 2364 / 234 / 82 bottom/middle/top with every adjacent inversion identical.
 *
 * Do not read that as the charge being dropped again - the probe and the tests
 * below are what say it is not.
 */
import { describe, expect, it } from 'vitest';

import {
    BODY_COST_OF_A_CROSSING,
    BODY_COST_OF_A_STEP,
    whatACrossingTakesFrom
} from '../../../src/engine/cultivation/breakthrough.js';
import {
    carriedAcross,
    isRealmBoundary,
    maxHpForOrdinal
} from '../../../src/engine/cultivation/realms.js';
import { HP_RECOVERY_FRACTION_PER_DAY } from '../../../src/schema/cultivation.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import {
    bodyStandingOn,
    bodyTaken,
    createNpc,
    maxBodyOf,
    setRealm,
    type NpcRecord
} from '../../../src/engine/world/npc-state.js';
import {
    readyToStrike,
    strikeAtTheWall
} from '../../../src/engine/world/an-npc-striking-at-the-next-wall.js';

const YEAR = 365;

const CONDITIONS = {
    ambient: 'dense' as const,
    rateMultiplier: 1,
    guideOrdinal: null,
    manualCeiling: 44
};

/** Somebody standing at a rung, having stood there long enough to strike. */
function standing(ordinal: number, yearsHere: number, id = 'toll-1'): NpcRecord {
    const npc = createNpc('npc-crossing-toll', {
        id,
        bornOnDay: -400 * YEAR,
        onDay: 0,
        cultivation: { realmOrdinal: ordinal }
    });
    return {
        ...npc,
        cultivation: {
            ...npc.cultivation,
            realmOrdinal: ordinal,
            lastAdvancedOnDay: -yearsHere * YEAR,
            accumulatingSinceDay: -yearsHere * YEAR,
            bodyOnDay: -yearsHere * YEAR
        }
    };
}

describe('the world holds a body, and it is not a second one', () => {
    it('derives the pool from the one derivation at every rung', () => {
        for (const ordinal of [0, 6, 12, 13, 20, 29, 40, 44]) {
            const npc = standing(ordinal, 0);
            expect(maxBodyOf(npc), `pool at ordinal ${ordinal}`)
                .toBe(maxHpForOrdinal(npc.cultivation.attributes.might, ordinal));
        }
    });

    it('opens whole, and stores no maximum to go stale', () => {
        const npc = standing(17, 0);
        expect(npc.cultivation.hp).toBe(maxBodyOf(npc));
        expect(JSON.stringify(npc)).not.toMatch(/"maxHp"/);
    });

    it('reads a record with no body on it as whole rather than as a corpse', () => {
        // Saves written before the column existed load with nothing on them, and
        // so does a fixture assembled by hand. Reading that as zero would turn a
        // whole seeded population into corpses on load, which is not a
        // migration - the repository has the matching sentinel.
        const npc = standing(9, 0);
        const bare = {
            ...npc,
            cultivation: {
                ...npc.cultivation,
                hp: undefined as unknown as number,
                bodyOnDay: undefined as unknown as number
            }
        };
        expect(bodyStandingOn(bare, 500)).toBe(maxBodyOf(npc));
    });
});

describe('a rung change carries the share, not the number', () => {
    /**
     * The pool is CONTINUOUS across a realm boundary and this test does not use
     * one, which is worth saying because it looks like the obvious case.
     * `WITHIN_REALM_BODY_PEAK` and `BODY_REALM_MULTIPLIER` are both 2, so a
     * realm's Perfection lands exactly on the next realm's Early - "a crossing
     * enlarges nothing on its own; the rungs did it". Where the pool actually
     * moves is a multi-rung jump, which is what `applyAdvancement` writes every
     * time `deriveOrdinal` walks a life forward several rungs at one review.
     */
    it('leaves a whole body whole and a half body half across a jump', () => {
        const before = standing(12, 0);
        const wasMax = maxBodyOf(before);
        const half = bodyTaken(before, Math.floor(wasMax / 2), 0);

        const jumpedWhole = setRealm(before, 16, 0);
        const jumpedHalf = setRealm(half, 16, 0);
        const nowMax = maxBodyOf(jumpedWhole);

        expect(nowMax).toBeGreaterThan(wasMax);
        expect(jumpedWhole.cultivation.hp).toBe(nowMax);
        expect(jumpedHalf.cultivation.hp)
            .toBe(carriedAcross(half.cultivation.hp, wasMax, nowMax));
        expect(jumpedHalf.cultivation.hp / nowMax)
            .toBeCloseTo(half.cultivation.hp / wasMax, 1);
    });

    it('and a bare boundary moves the pool not at all, by construction', () => {
        const before = standing(12, 0);
        expect(maxBodyOf(setRealm(before, 13, 0))).toBe(maxBodyOf(before));
    });
});

describe('what a crossing takes out of an NPC', () => {
    /**
     * Walk streams until one lands a success, so this measures the arrival path
     * rather than whichever way the first roll happened to go. The rung is one
     * inside Foundation Establishment, which is a STEP, and 12 -> 13, which is a
     * BOUNDARY - the whole point being that the two are priced differently and
     * by the same function the player's crossing is priced by.
     */
    function firstArrival(ordinal: number) {
        const before = standing(ordinal, 40);
        const readiness = readyToStrike(before, 0, CONDITIONS);
        for (let i = 0; i < 400; i++) {
            const out = strikeAtTheWall(
                before, 0,
                { ...readiness, ready: true, settled: false },
                forStream('npc-crossing-toll', 'attempt', ordinal, i),
                'dense'
            );
            if (out && !out.died && out.result.outcome === 'success') return { before, out };
        }
        return null;
    }

    it('charges the same fraction, through the same clamp, as the played verb', () => {
        for (const ordinal of [14, 12]) {
            const landed = firstArrival(ordinal);
            expect(landed, `no arrival in four hundred attempts at ordinal ${ordinal}`)
                .not.toBeNull();
            const { before, out } = landed!;

            // The player's order, exactly: the pool grows, the share carries,
            // and the toll is charged against the NEW pool afterwards - so it
            // means the same thing at every rung and is not partly refunded by
            // the vessel growing underneath it.
            const nowMax = maxHpForOrdinal(
                before.cultivation.attributes.might,
                out.result.toOrdinal
            );
            const carried = carriedAcross(before.cultivation.hp, maxBodyOf(before), nowMax);
            const owed = whatACrossingTakesFrom(carried, nowMax, out.result.bodyCost);

            expect(owed, `a crossing out of ${ordinal} took nothing`).toBeGreaterThan(0);
            expect(out.npc.cultivation.hp, `body after arriving from ${ordinal}`)
                .toBe(carried - owed);
            expect(out.npc.cultivation.bodyOnDay).toBe(0);
        }
    });

    it('prices a realm boundary three times a rung inside one', () => {
        // Read off the result the engine returned rather than off the constants,
        // so this fails if `bodyCostOfArriving` and `isRealmBoundary` ever come
        // apart - which is the failure the shared key exists to prevent.
        const step = firstArrival(14);
        const boundary = firstArrival(12);
        expect(step).not.toBeNull();
        expect(boundary).not.toBeNull();
        expect(isRealmBoundary(12)).toBe(true);
        expect(isRealmBoundary(14)).toBe(false);
        expect(step!.out.result.bodyCost).toBe(BODY_COST_OF_A_STEP);
        expect(boundary!.out.result.bodyCost).toBe(BODY_COST_OF_A_CROSSING);
    });

    it('never leaves an NPC on nothing, however little they walked in with', () => {
        // THE LAW THIS REPO ALREADY HAS, pointed at a cost: a charge reduces and
        // never zeroes. `root-cliff.test.ts` found the played version of this -
        // a crossing dropped the body to almost nothing and the next deviation
        // finished what the crossing started, so the toll never killed anybody
        // and was the reason they died.
        const max = maxHpForOrdinal(3, 13);
        for (const hp of [1, 2, 3, 8, max]) {
            const taken = whatACrossingTakesFrom(hp, max, BODY_COST_OF_A_CROSSING);
            expect(hp - taken, `${hp} of ${max} walking into a boundary`)
                .toBeGreaterThanOrEqual(1);
        }
    });
});

describe('a wounded NPC mends, at the rate a player mends', () => {
    it('repays a realm boundary in a little under a year', () => {
        const npc = standing(13, 0);
        const max = maxBodyOf(npc);
        const spent = bodyTaken(npc, Math.round(max * BODY_COST_OF_A_CROSSING), 0);

        expect(bodyStandingOn(spent, 0)).toBeLessThan(max);
        // The rate is a fraction of the POOL per day and is denominated in years
        // on purpose - a whole pool back from empty is about five and a half of
        // them. A boundary's share is a fifth of that.
        const days = Math.ceil(
            (max - spent.cultivation.hp) / (max * HP_RECOVERY_FRACTION_PER_DAY)
        );
        expect(days).toBeLessThan(YEAR);
        expect(bodyStandingOn(spent, days)).toBe(max);
        // And the derivation is the constant's, not a curve of the world's own.
        const midway = Math.floor(days / 2);
        expect(bodyStandingOn(spent, midway)).toBe(
            Math.min(max, Math.floor(spent.cultivation.hp + max * HP_RECOVERY_FRACTION_PER_DAY * midway))
        );
    });

    it('banks the mending before charging, so healing is not silently discarded', () => {
        const npc = standing(13, 0);
        const max = maxBodyOf(npc);
        const spent = bodyTaken(npc, Math.round(max * 0.4), 0);
        const later = 200;
        const standingLater = bodyStandingOn(spent, later);
        expect(standingLater).toBeGreaterThan(spent.cultivation.hp);

        const chargedAgain = bodyTaken(spent, 3, later);
        expect(chargedAgain.cultivation.hp).toBe(standingLater - 3);
    });

    it('never mends above the pool', () => {
        const npc = standing(21, 0);
        expect(bodyStandingOn(npc, 100_000)).toBe(maxBodyOf(npc));
    });
});
