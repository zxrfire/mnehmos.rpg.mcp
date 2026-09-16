/**
 * A house is seeded with the people it raised, and what that must not cost.
 *
 * ── THE DEFECT, AS IT WAS SEEN ───────────────────────────────────────────
 *
 * Nothing seeded a house's rank and file. A house held the people the CATALOG
 * names plus whoever the wandering population happened to roll into it, and the
 * intake offers each derived person ONE local house at random and drops them if
 * that house's bar is above them. Measured at world open on seed `afford-a`:
 * 306 people over 38 rolls, of which 207 were catalog figures and 99 everything
 * else - 2.6 unnamed people per house, and thirteen houses with none at all.
 *
 * ── MEASURED ─────────────────────────────────────────────────────────────
 *
 * `scripts/probe-how-many-people-a-house-is-worth-modelling.ts`, five seeds,
 * both arms in one process off one tree - `rollWorthModelling: 0` seeds the
 * identical world with the pass doing nothing. The century half, where the
 * party-size figure comes from, is
 * `scripts/probe-what-a-deeper-roll-does-over-a-century.ts`.
 *
 *   living roll per seated house    before              after
 *     min / p10 / MED / p90 / max   4 / 5 / 7-8 / 11-12 / 15-22
 *                                -> 5 / 9-11 / 14-15 / 17-18 / 22
 *     houses under 5                3-4    ->  0
 *     houses at 5-9                 21-27  ->  3-6
 *     houses at 10-20               9-13   ->  30-33
 *     houses over 20                0-1    ->  2-3
 *   distinct realms on a roll, MED  6-7    ->  9
 *   rows in the world               616    ->  845-856
 *   power_ordinal moved             0 houses of 38, on all five seeds
 *   standing order moved            0 places, on all five seeds
 *   party size at 100y, mean        3.38/3.49/3.37 -> 4.65/4.36/4.25
 *
 * The party is what the roll was actually costing. `whoTheHouseCanSend` takes
 * the errand's `hands` off whoever the house can spare, so a thin roll was what
 * every bound on sending bit against first - and three out of fifteen is the
 * errand the design owner called ordinary.
 *
 * WHAT DID NOT MOVE, said because it would otherwise read as a claim: the RANK
 * rungs. 60 of 245 stood empty before and after this pass, and they were rungs
 * 2 to 5. That was `rosterByRung`'s taper rather than the roll - rung 3 of a
 * seven-rung ladder got its first seat at a roll of 26 and rung 5 at 162, so no
 * roll a player could hold in their head reached them. The REALM ladder is the
 * half this pass filled. Nor does it reach the gate at a century: by then most
 * houses have nobody at the seat because of town postings never recalled, which
 * `a-house-keeps-somebody-at-its-own-gate` already recorded.
 *
 * THE RUNGS HAVE SINCE FILLED, and not from here: `rosterByRung` stopped
 * tapering a POST the way it tapers a band. Same five seeds, same rolls,
 * measured at world open: 60 of 245 empty -> 2 of 245, and 45 of 110 empty
 * ELDER slots -> 1. The roll is untouched by that change, which is the point
 * of recording both numbers in one place.
 *
 * THE SPREAD IS THE RESULT, not the median. A world where every house holds
 * fifteen would be worse than one that runs thin, so the assertions below bound
 * the spread from BOTH sides.
 *
 * ── WHAT THIS PASS MAY NOT DO ────────────────────────────────────────────
 *
 * Three things, and each is asserted rather than described:
 *
 *  - it may not move `power_ordinal`, which is the strongest person on a roll.
 *    Deepening the rank and file would otherwise re-order the whole catalog by
 *    standing, quietly, for a reason that has nothing to do with standing.
 *  - it may not fill a posting. The Kiln Wardens and the Deeproot Court teach
 *    nothing and take nobody by standing ruling; `recruits: false` is what
 *    holds them, and it has to keep holding them here.
 *  - it may not outnumber the catalog's own people into irrelevance. Every
 *    authored figure is still on the roll they were authored onto.
 */

import { describe, it, expect } from 'vitest';
import {
    A_ROLL_A_PLAYER_COULD_KNOW,
    AN_ORDINARY_LADDER,
    AN_ORDINARY_HOUSES_STANDING,
    aRollWorthModelling,
    theBandARaisedMemberStandsIn
} from '../../../src/engine/world/a-house-raises-its-own.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { isBelowTheLid } from '../../../src/engine/world/layers.js';
import { SECTS } from '../../../src/data/cultivation/sects.js';
import { MEMBERS } from '../../../src/data/cultivation/members.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';
import type { NpcRecord } from '../../../src/engine/world/npc-state.js';

const catalog = await loadCultivationCatalog();
const SEEDS = ['afford-a', 'afford-b', 'afford-c'];

/** Living members per seated house below the lid, by faction id. */
function rollsOf(state: WorldState): Map<string, NpcRecord[]> {
    const living = new Map<string, NpcRecord[]>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !npc.factionId) continue;
        const bucket = living.get(npc.factionId);
        if (bucket) bucket.push(npc); else living.set(npc.factionId, [npc]);
    }
    const out = new Map<string, NpcRecord[]>();
    for (const faction of state.factions) {
        if (faction.dissolvedOnDay !== null || !isBelowTheLid(faction)) continue;
        if (faction.seatLocationId === null) continue;
        const roll = living.get(faction.id);
        if (roll && roll.length > 0) out.set(faction.id, roll);
    }
    return out;
}

function quantile(values: readonly number[], q: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const at = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)));
    return sorted[at]!;
}

// ─────────────────────────────────────────────────────────────────────────

describe('the figure is the owner\'s, and everything that varies it is the catalog\'s', () => {
    it('states the scale once and reads what ordinary means off the catalog', () => {
        // The one number that is not derived. AGENTS.md is explicit that this
        // is where it has to come from: what a player can hold in their head.
        expect(A_ROLL_A_PLAYER_COULD_KNOW).toBeGreaterThanOrEqual(10);
        expect(A_ROLL_A_PLAYER_COULD_KNOW).toBeLessThanOrEqual(20);

        // And the two the catalog decides. Computed, so adding a house moves
        // them rather than leaving a stale literal here.
        const recruiting = SECTS.filter(s => s.recruits);
        const ladders = recruiting.map(s => s.ranks.length).sort((a, b) => a - b);
        expect(AN_ORDINARY_LADDER).toBe(ladders[ladders.length >> 1]);
        expect(AN_ORDINARY_HOUSES_STANDING).toBeGreaterThan(0);
    });

    it('gives an ordinary house the stated figure, and scales the rest off it', () => {
        const ordinary = {
            rankCount: AN_ORDINARY_LADDER,
            powerOrdinal: AN_ORDINARY_HOUSES_STANDING,
            admissionOrdinal: 3,
            recruits: true,
            yearsStanding: 10_000
        };
        expect(aRollWorthModelling(ordinary)).toBe(A_ROLL_A_PLAYER_COULD_KNOW);

        // A shorter ladder holds fewer; a stronger house holds more. Both are
        // the owner's own caveat on the guideline, not a dial.
        expect(aRollWorthModelling({ ...ordinary, rankCount: AN_ORDINARY_LADDER - 3 }))
            .toBeLessThan(A_ROLL_A_PLAYER_COULD_KNOW);
        expect(aRollWorthModelling({ ...ordinary, powerOrdinal: AN_ORDINARY_HOUSES_STANDING + 12 }))
            .toBeGreaterThan(A_ROLL_A_PLAYER_COULD_KNOW);
    });

    it('holds a house founded inside a lifetime short of a full roll', () => {
        const ordinary = {
            rankCount: AN_ORDINARY_LADDER,
            powerOrdinal: AN_ORDINARY_HOUSES_STANDING,
            admissionOrdinal: 3,
            recruits: true,
            yearsStanding: 10_000
        };
        expect(aRollWorthModelling({ ...ordinary, yearsStanding: 40 }))
            .toBeLessThan(aRollWorthModelling(ordinary));
        // And a house older than that has already had the time. It does not go
        // on growing with its age - the roll is what a player can know, and
        // that does not get bigger because the house is old.
        expect(aRollWorthModelling({ ...ordinary, yearsStanding: 900 }))
            .toBe(aRollWorthModelling(ordinary));
    });

    it('raises nobody at all into a house that takes nobody', () => {
        expect(aRollWorthModelling({
            rankCount: 7,
            powerOrdinal: 44,
            admissionOrdinal: 29,
            recruits: false,
            yearsStanding: 900
        })).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────

describe('a raised member never outranks the people the house already has', () => {
    it('refuses a rung whose band has no room under the strongest already there', () => {
        const house = SECTS.find(s => s.recruits && s.ranks.length > 3)!;
        // Nobody may be raised at or above the head's own rung, so a house
        // whose strongest stands at the bottom can be given nobody at all.
        expect(theBandARaisedMemberStandsIn(house.id, 0, 0)).toBeNull();
        expect(theBandARaisedMemberStandsIn(house.id, 0, -5)).toBeNull();
    });

    it('caps the band below the strongest rather than widening it', () => {
        const house = SECTS.find(s => s.recruits && s.admissionOrdinal <= 2)!;
        const band = theBandARaisedMemberStandsIn(house.id, 0, 40);
        expect(band).not.toBeNull();
        expect(band!.maxOrdinal).toBeLessThan(40);
        expect(band!.minOrdinal).toBeLessThanOrEqual(band!.maxOrdinal);
    });
});

// ─────────────────────────────────────────────────────────────────────────

describe('what a seeded world holds once its houses have raised their own', () => {
    for (const seed of SEEDS) {
        it(`${seed}: fills the rolls out without flattening them`, () => {
            const rolls = [...rollsOf(seedWorld({ seed, catalog }).state).values()]
                .map(r => r.length);

            // The MEDIAN moved to the figure the owner named. Bounded on both
            // sides: a world sitting at 25 would be carrying a population.
            expect(quantile(rolls, 0.5)).toBeGreaterThanOrEqual(12);
            expect(quantile(rolls, 0.5)).toBeLessThanOrEqual(18);

            // AND THE SPREAD SURVIVED, which is the actual result. Measured
            // 5 to 22 on five seeds; a world where every house holds the same
            // number is the failure this bounds, so the gap is asserted rather
            // than the endpoints.
            expect(Math.max(...rolls) - Math.min(...rolls)).toBeGreaterThanOrEqual(10);

            // Nobody is left at the roll the ruling calls too thin to play.
            expect(rolls.filter(n => n < 5).length).toBe(0);
        });

        it(`${seed}: leaves power_ordinal and the standing order exactly where they were`, () => {
            const without = seedWorld({ seed, catalog, rollWorthModelling: 0 }).state;
            const with_ = seedWorld({ seed, catalog }).state;

            const powerOf = (state: WorldState) => new Map(
                state.factions
                    .filter(f => f.dissolvedOnDay === null && isBelowTheLid(f))
                    .map(f => [f.id, f.resources.power_ordinal])
            );
            const before = powerOf(without);
            const after = powerOf(with_);
            expect([...after.keys()].sort()).toEqual([...before.keys()].sort());
            for (const [id, power] of after) expect([id, power]).toEqual([id, before.get(id)]);
        });

        it(`${seed}: raises nobody into a house that takes nobody`, () => {
            const closed = SECTS.filter(s => !s.recruits);
            expect(closed.length).toBeGreaterThan(0);
            const rolls = rollsOf(seedWorld({ seed, catalog }).state);
            const without = rollsOf(seedWorld({ seed, catalog, rollWorthModelling: 0 }).state);
            for (const house of closed) {
                expect([house.id, rolls.get(house.id)?.length ?? 0])
                    .toEqual([house.id, without.get(house.id)?.length ?? 0]);
                for (const npc of rolls.get(house.id) ?? []) {
                    expect(npc.id.startsWith('npc-raised-')).toBe(false);
                }
            }
        });

        it(`${seed}: keeps every authored figure on the roll they were authored onto`, () => {
            const state = seedWorld({ seed, catalog }).state;
            const byName = new Map(state.npcs.map(n => [n.name, n]));
            for (const member of MEMBERS) {
                const row = byName.get(member.name);
                expect([member.name, row?.factionId ?? null])
                    .toEqual([member.name, member.factionId]);
            }
        });

        it(`${seed}: puts the people it raised on their own house's ground`, () => {
            const state = seedWorld({ seed, catalog }).state;
            const seatOf = new Map(state.factions.map(f => [f.id, f.seatLocationId]));
            const raised = state.npcs.filter(n => n.id.startsWith('npc-raised-'));
            expect(raised.length).toBeGreaterThan(0);
            for (const npc of raised) {
                expect([npc.id, npc.locationId]).toEqual([npc.id, seatOf.get(npc.factionId ?? '')]);
            }
        });
    }
});
