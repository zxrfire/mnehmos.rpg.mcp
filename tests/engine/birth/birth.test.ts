/**
 * Design guards for the origin axis, now that it is wired in.
 *
 * Two halves, and the second is the one that matters. `docs/world/origin.md`:
 *
 *   > A privileged origin should be VISIBLE IN THE RUN'S OPENING POSITION and
 *   > NOT VISIBLE IN ITS OUTCOME DISTRIBUTION, except at the very top where it
 *   > is one required term among several. If being well-born reliably produces
 *   > high-realm cultivators, the axis has been implemented wrong.
 *
 * So this file asserts that a birth moves the opening position a great deal,
 * and then re-measures the outcome distribution through the harness that
 * already existed to confirm the wiring did not turn the axis into a
 * difficulty slider.
 */

import { describe, it, expect } from 'vitest';
import {
    betterGround,
    catalogBirthWorld,
    commonlyNamedHouse,
    densityForBand,
    describeBirth,
    drawBirth,
    groundDensityFor,
    houseBandFor,
    housesAtStanding,
    housesWithinEarshot,
    type Birth,
    type BirthWorld
} from '../../../src/engine/birth/birth.js';
import {
    ORIGIN_TIERS,
    getOrigin,
    originProbability,
    type OriginTierKey
} from '../../../src/engine/cultivation/origin.js';
import { AMBIENT_QI_RATE_MULTIPLIER } from '../../../src/schema/cultivation.js';
import { measureOriginOutcomes } from '../../../src/engine/world/origin-odds.js';

const world = catalogBirthWorld();

/** A sweep of ordinary births, which is what a player actually meets. */
const SWEEP = 4_000;
const births: Birth[] = [];
for (let i = 0; i < SWEEP; i++) births.push(drawBirth(`birth-sweep-${i}`, { world }));

const share = (predicate: (b: Birth) => boolean): number =>
    births.filter(predicate).length / births.length;

// ─────────────────────────────────────────────────────────────────────────
// THE COMPLAINT THIS EXISTS TO ANSWER
// ─────────────────────────────────────────────────────────────────────────

describe('where you are born varies', () => {
    it('does not open every run in the same place', () => {
        const places = new Set(births.map(b => b.place.name));
        expect(places.size).toBeGreaterThan(2);
        // And no single address dominates the way one used to hold all of it.
        for (const name of places) {
            expect(share(b => b.place.name === name), `${name} is nearly every run`)
                .toBeLessThan(0.5);
        }
    });

    it('keeps thin and unremarkable ground the common case', () => {
        // The world is late and mostly drawn down. A birth that usually lands
        // on a vein would undo the whole economy, whoever it lands on.
        expect(share(b => b.ground === 'thin')).toBeGreaterThan(0.4);
        expect(share(b => b.ground === 'dense')).toBeLessThan(0.12);
    });

    it('opens the overwhelming majority of runs with nobody behind them', () => {
        // The default, and it stays the default: about nine births in ten.
        expect(share(b => b.origin === 'thin_county')).toBeGreaterThan(0.85);
        expect(share(b => b.house === null)).toBeGreaterThan(0.9);
    });

    it('draws the tiers at the frozen table odds and not at odds of its own', () => {
        for (const tier of ORIGIN_TIERS) {
            const expected = originProbability(tier.key);
            const measured = share(b => b.origin === tier.key);
            // Loose: the rare tiers are single-digit counts at this sample and
            // the assertion is "the table is what is being drawn", not a
            // goodness-of-fit test.
            expect(Math.abs(measured - expected), `${tier.key} is off its weight`)
                .toBeLessThan(0.04);
        }
    });
});

describe('who you are born to varies, and reaches the top of the world', () => {
    it('can be born under the strongest house there is, and almost never is', () => {
        // Drawn rather than asserted: the top tier's band is open at the top,
        // so whether the Hollow Court is in it is a fact about the catalog.
        const top = getOrigin('dao_house_bloodline');
        const band = housesAtStanding(top, world.houses);
        const names = band.map(h => h.name);
        expect(names).toContain('The Hollow Court');

        // And it is out of reach of every tier below, because the bands
        // partition the catalog by standing.
        for (const tier of ORIGIN_TIERS) {
            if (tier.key === 'dao_house_bloodline') continue;
            expect(housesAtStanding(tier, world.houses).map(h => h.name))
                .not.toContain('The Hollow Court');
        }

        // Which makes it a birth of roughly one run in seventy-five thousand.
        const odds = originProbability('dao_house_bloodline') / band.length;
        expect(odds).toBeGreaterThan(0);
        expect(odds).toBeLessThan(0.0001);
    });

    it('puts a family in a house at its own standing rather than anywhere', () => {
        for (const tier of ORIGIN_TIERS) {
            const band = houseBandFor(tier);
            for (const house of housesAtStanding(tier, world.houses)) {
                expect(house.powerOrdinal, `${tier.key} reached below its standing`)
                    .toBeGreaterThanOrEqual(band.from);
            }
        }
    });

    it('gives a family with no standing no house at all', () => {
        for (const key of ['thin_county', 'market_town'] as OriginTierKey[]) {
            expect(housesAtStanding(getOrigin(key), world.houses)).toHaveLength(0);
            expect(drawBirth('no-standing', { world, origin: key }).house).toBeNull();
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE LINE: INPUTS, NEVER RANK
// ─────────────────────────────────────────────────────────────────────────

describe('an origin buys inputs and never rank', () => {
    it('carries no position on any ladder at all', () => {
        const birth = drawBirth('rank-check', { world, origin: 'dao_house_bloodline' });
        for (const field of [
            'realmOrdinal',
            'cultivationProgress',
            'sectId',
            'sectRank',
            'foundationQuality',
            'insights',
            'attributes',
            'spiritRoot'
        ]) {
            expect(Object.prototype.hasOwnProperty.call(birth, field), `${field} leaked into a birth`)
                .toBe(false);
        }
    });

    it('never claims membership of the house somebody was born under', () => {
        const birth = drawBirth('membership', { world, origin: 'dao_house_bloodline' });
        expect(birth.house).not.toBeNull();
        const row = birth.knowledge.find(k => k.id === birth.house!.id)!;
        expect(row.statement).toContain('their family belongs to');
        expect(row.statement).not.toMatch(/disciple|elder|member of|admitted/i);
    });

    it('hands out exactly the stones the frozen table says and nothing more', () => {
        for (const tier of ORIGIN_TIERS) {
            expect(drawBirth('purse', { world, origin: tier.key }).spiritStones)
                .toBe(tier.spiritStones);
        }
    });

    it('never puts anybody on a band the world does not roll', () => {
        for (const birth of births) {
            expect(birth.ground).not.toBe('sealed_vein');
            expect(birth.ground).not.toBe('spirit_tide');
        }
    });

    it('floors the ground on the family holding without ever falling below it', () => {
        for (const birth of births) {
            const floor = getOrigin(birth.origin).ground;
            expect(
                AMBIENT_QI_RATE_MULTIPLIER[birth.ground],
                `${birth.origin} was born below its own floor`
            ).toBeGreaterThanOrEqual(AMBIENT_QI_RATE_MULTIPLIER[floor]);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE KNOWLEDGE GATE
// ─────────────────────────────────────────────────────────────────────────

describe('what you have heard of falls out of who your family corresponded with', () => {
    it('leaves a farm child with the two names they have always had', () => {
        const birth = drawBirth('farm', { world, origin: 'thin_county' });
        expect(birth.knowledge).toHaveLength(2);
        expect(birth.knowledge[0].kind).toBe('place');
        expect(birth.knowledge[0].name).toBe(birth.place.name);
        expect(birth.knowledge[1].id).toBe(commonlyNamedHouse(world.houses)!.id);
    });

    it('grows the list monotonically with what the family reaches', () => {
        // ORDERED BY REACH, NOT BY TABLE POSITION. Those were the same thing
        // while the table was one ladder; they stopped being the same when the
        // top row split into three routes, because an apex sect member's child
        // is rarer than a Dao house's blood and their name reaches far less
        // far - the apex will not lend its name to a placement, so what the
        // parent has is a word to spend rather than standing to trade on. The
        // claim being made here is about reach and it is unchanged.
        const byReach = [...ORIGIN_TIERS].sort(
            (a, b) => a.placement.reach - b.placement.reach
        );
        let previous = -1;
        for (const tier of byReach) {
            const count = drawBirth('ladder-of-names', { world, origin: tier.key })
                .knowledge.length;
            expect(count, `${tier.key} knows fewer names than a shorter reach`)
                .toBeGreaterThanOrEqual(previous);
            previous = count;
        }
    });

    it('stops at the family reach, so the top of the world stays unheard of', () => {
        const birth = drawBirth('earshot', { world, origin: 'dao_house_bloodline' });
        const reach = getOrigin('dao_house_bloodline').placement.reach;
        const heard = new Set(birth.knowledge.filter(k => k.kind === 'sect').map(k => k.id));

        for (const house of world.houses) {
            if (house.powerOrdinal <= reach) continue;
            // The one exception is the house they were born inside, which they
            // have heard of because they live in it - not because of reach.
            if (birth.house && house.id === birth.house.id) continue;
            expect(heard.has(house.id), `${house.name} was heard of above the family reach`)
                .toBe(false);
        }
    });

    it('never lets earshot become admission', () => {
        // Reach opens a conversation. Every house in the catalog with a bar
        // above zero still refuses a sixteen-year-old at ordinal zero, and
        // nothing in a birth says otherwise.
        const birth = drawBirth('admission', { world, origin: 'dao_house_bloodline' });
        const barred = housesWithinEarshot(getOrigin('dao_house_bloodline'), world.houses)
            .filter(h => h.admissionOrdinal > 0);
        expect(barred.length).toBeGreaterThan(0);
        for (const row of birth.knowledge) {
            expect(row.stance).not.toBe('ignorant');
            expect(row.statement).not.toMatch(/is a member|has been admitted|rank/i);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// PLUMBING
// ─────────────────────────────────────────────────────────────────────────

describe('the draw itself', () => {
    it('is deterministic in the run seed', () => {
        expect(drawBirth('repeat-me', { world })).toEqual(drawBirth('repeat-me', { world }));
    });

    it('does not collapse when the world has one place and no houses', () => {
        const tiny: BirthWorld = {
            places: [{
                name: 'Nowhere',
                ground: 'thin',
                kind: 'hamlet',
                regionId: 'region-nowhere',
                note: 'A shed.'
            }],
            houses: []
        };
        const birth = drawBirth('tiny', { world: tiny, origin: 'dao_house_bloodline' });
        expect(birth.place.name).toBe('Nowhere');
        // The ground reported is the ground somebody is standing on, not the
        // one the draw wanted. An honest downgrade beats a fictional vein.
        expect(birth.ground).toBe('thin');
        expect(birth.house).toBeNull();
    });

    it('reports a place density the ambient roll can use', () => {
        expect(groundDensityFor('Nine Peaks', world)).toBe(densityForBand('dense'));
        expect(groundDensityFor('Sweptground', world)).toBe(densityForBand('thin'));
        expect(groundDensityFor('nowhere at all', world)).toBeNull();
    });

    it('orders ground by what it is worth', () => {
        expect(betterGround('thin', 'dense')).toBe('dense');
        expect(betterGround('normal', 'thin')).toBe('normal');
    });

    it('describes the opening position without assessing it', () => {
        const line = describeBirth(drawBirth('prose', { world, origin: 'established_clan' }));
        expect(line).toMatch(/Born in /);
        expect(line).not.toMatch(/lucky|fortunate|promising|hopeless|advantage/i);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// AND THE HALF THAT MATTERS: IT DID NOT MOVE THE OUTCOMES
// ─────────────────────────────────────────────────────────────────────────

describe('privilege is still not visible in the outcome distribution', () => {
    // Re-measured here rather than trusted from the neighbouring file, because
    // this is the file that made the axis real. Smaller sample; the bounds are
    // correspondingly loose, and the neighbouring sweep is the precise one.
    const report = measureOriginOutcomes('birth-wiring', { perTierSampleSize: 600 });

    it('moves the median by less than a realm and a half across the whole table', () => {
        expect(report.privilegeLift.medianLift).toBeLessThanOrEqual(8);
        expect(report.privilegeLift.meanLift).toBeLessThanOrEqual(8);
    });

    it('leaves every tier overwhelmingly short of the ladder, best birth included', () => {
        // The Void Refinement bar moved from 2% to 5%, in step with the same
        // bar in `origin-outcomes.test.ts` and for the same reason, which is
        // written down beside `FAILURE_LOSS_SHAPE` in `breakthrough.ts`: the
        // cost of a failed crossing now leans toward the shallow end of its
        // range, so a career survives more failures and the lower-middle of the
        // ladder widens. Measured, dense-band Foundation Establishment went
        // 44-46% to 46-48% and Core Formation 18% to 19-20%, with nothing above
        // Deity Transformation moving at all.
        //
        // The claim is "overwhelmingly short" and 95% is overwhelming. The bar
        // sits where the claim stops being true, not where the measurement is.
        for (const row of report.rows) {
            expect(row.reachedAtLeast[29], `${row.origin} reaches Void Refinement too often`)
                .toBeLessThan(0.05);
            expect(row.medianPeakOrdinal, `${row.origin} median is above Core Formation`)
                .toBeLessThan(21);
            expect(row.reachedAtLeast[45], `${row.origin} reaches the last realm routinely`)
                .toBeLessThan(0.01);
        }
    });

    it('keeps the run-level population where the world says it is', () => {
        expect(report.runLevel[13]).toBeGreaterThan(0.005);
        expect(report.runLevel[13]).toBeLessThan(0.15);
        expect(report.runLevel[21]).toBeLessThan(0.01);
    });

    it('leaves the opening position, and only the opening position, transformed', () => {
        // The two ends of the axis, side by side. Enormous at the open and
        // measured as nothing by the sweep above.
        const poor = drawBirth('two-ends', { world, origin: 'thin_county' });
        const rich = drawBirth('two-ends', { world, origin: 'dao_house_bloodline' });
        expect(rich.spiritStones / poor.spiritStones).toBeGreaterThan(100);
        expect(rich.knowledge.length).toBeGreaterThan(poor.knowledge.length * 5);
        expect(rich.house).not.toBeNull();
        expect(poor.house).toBeNull();
    });
});
