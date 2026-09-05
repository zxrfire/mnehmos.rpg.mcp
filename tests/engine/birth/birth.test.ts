/**
 * Design guards for the origin axis, now that it is wired in.
 *
 * Two halves, and the second is the one that matters. `docs/world/houses/origin.md`:
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
    commonlyNamedHouses,
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
import {
    discipleBarOf,
    houseFloorsOf
} from '../../../src/data/cultivation/the-three-floors-a-house-admits-at.js';
import { seedWorld, sectGroundId } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
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
    it('puts a Dao house bloodline in an actual Dao house', () => {
        // ── THIS USED TO ASSERT THE OPPOSITE, AND IT WAS ENCODING A DEFECT ──
        //
        // The old version required 'The Hollow Court' to be in this tier's
        // band, because the band was derived from `placement.reach` and the
        // top tier reaches 38. Measured over 200 forced births: a tier named
        // "A Dao house, by blood" drew a Dao house ZERO times, and drew the
        // Azure Cloud Pavilion, the Hollow Court or the Severed every time.
        // The bar this test was holding was the bug.
        //
        // A family's word and a family's house are different facts, and the
        // table now carries both. The seven houses stand at 29 to 35 and their
        // word travels to 38.
        const band = housesAtStanding(getOrigin('dao_house_bloodline'), world.houses);
        expect(band.length).toBeGreaterThan(0);
        for (const house of band) {
            expect(house.roster, `${house.name} is not a lineage`).toBe('adoption');
        }

        // Still vanishingly rare: about one run in forty thousand, divided
        // again by which of the houses it turns out to be.
        const odds = originProbability('dao_house_bloodline') / band.length;
        expect(odds).toBeGreaterThan(0);
        expect(odds).toBeLessThan(0.0001);
    });

    it('leaves the Hollow Court unreachable as anybody\'s birth house', () => {
        // Not because it is the Hollow Court. Because
        // `NO_PLACE_FOR_THEIR_OWN` says three bodies have nowhere to put their
        // own members' children, and that catalog's whole subject is where
        // those children go INSTEAD - which is `fostered_on_a_word`, at the
        // receiving house. A run cannot open as somebody who grew up in a
        // place nobody grows up in.
        for (const tier of ORIGIN_TIERS) {
            expect(housesAtStanding(tier, world.houses).map(h => h.name),
                `${tier.key} was born at a house with no place for its own`)
                .not.toContain('The Hollow Court');
        }
    });

    it('puts a family in a house at its own standing rather than anywhere', () => {
        for (const tier of ORIGIN_TIERS) {
            const band = houseBandFor(tier);
            if (band === null) {
                expect(housesAtStanding(tier, world.houses)).toHaveLength(0);
                continue;
            }
            for (const house of housesAtStanding(tier, world.houses)) {
                expect(house.powerOrdinal, `${tier.key} reached below its standing`)
                    .toBeGreaterThanOrEqual(band.from);
            }
        }
    });

    it('puts an apex member\'s child in a house standing at apex height', () => {
        // The row's reach is 29 on purpose - "an apex will not lend its name to
        // a placement" - and reading the family's house off that number gave a
        // sixteen-house band with no apex in it.
        const band = housesAtStanding(getOrigin('apex_sect_members_child'), world.houses);
        expect(band.length).toBeGreaterThan(0);
        for (const house of band) {
            expect(house.powerOrdinal, `${house.name} is not standing at apex height`)
                .toBeGreaterThanOrEqual(38);
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

    it('never claims a rung of the house somebody was born into', () => {
        // The claim this used to make was that a birth never claims MEMBERSHIP,
        // and that was too strong: a Dao house's roll is its own family, so
        // being born to the line is being on it and saying otherwise was the
        // fiction. What a birth must never claim is a RUNG, which is the thing
        // that is climbed rather than inherited.
        for (const tier of ORIGIN_TIERS) {
            const birth = drawBirth('membership', { world, origin: tier.key });
            if (!birth.house) continue;
            const row = birth.knowledge.find(k => k.id === birth.house!.id)!;
            expect(row.statement, `${tier.key} claimed a rank`)
                .not.toMatch(/disciple|elder|inner|core|as a [a-z]+ of/i);
            if (birth.raisedInside?.onTheRoll) {
                expect(row.statement).toContain('at no rank in it');
            } else {
                expect(row.statement).toContain('family belongs to');
            }
        }
    });

    it('leaves every floor of the house standing in front of a born member', () => {
        // THE CONSTRAINT THIS WHOLE CHANGE IS BOUND BY: being born inside must
        // not become a way to skip a bar somebody else has to clear. Measured
        // against the house's own floors, unmodified, at the ordinal a run
        // opens at.
        for (const tier of ORIGIN_TIERS) {
            const birth = drawBirth('floors-still-there', { world, origin: tier.key });
            const inside = birth.raisedInside;
            if (!inside) continue;

            const floors = houseFloorsOf(inside.house.id)!;
            const expected = [
                ...(floors.guest !== null && floors.guest > 0
                    ? [{ door: 'guest', ordinal: floors.guest }] : []),
                ...(floors.servant !== null && floors.servant > 0
                    ? [{ door: 'servant', ordinal: floors.servant }] : []),
                ...(floors.disciple > 0
                    ? [{ door: 'disciple', ordinal: floors.disciple }] : [])
            ];
            expect(inside.stillToClear, `${tier.key} had a bar removed`).toEqual(expected);
        }
    });

    it('does not move the one bar that has never moved for anybody', () => {
        // The Azure Cloud Pavilion is reachable as a birth house now, as the
        // house an apex member's child grew up in. `origin.md`: "Being handed
        // the same child by somebody at the top of the world gets exactly what
        // walking up the mountain gets." So the born child stands where the
        // walk-up stands, and the catalog's own figure is what says so.
        const pavilion = world.houses.find(h => h.id === 'sect-azure-cloud-pavilion')!;
        const born = { realmOrdinal: 0 };
        expect(born.realmOrdinal).toBeLessThan(pavilion.floors.disciple);
        expect(pavilion.floors.disciple).toBe(discipleBarOf('sect-azure-cloud-pavilion'));

        // And a member's child is on no roll there at all, because an apex is
        // joined rather than born into.
        const apexBirths = Array.from({ length: 40 }, (_, i) =>
            drawBirth(`apex-${i}`, { world, origin: 'apex_sect_members_child' }));
        for (const birth of apexBirths) {
            expect(birth.raisedInside?.onTheRoll ?? null).toBeNull();
        }
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
// BORN AT THE HOUSE, NOT NEAR IT
// ─────────────────────────────────────────────────────────────────────────

describe('a run can open inside a house rather than beside one', () => {
    it('opens at the house\'s own ground when the family lives there', () => {
        for (const tier of ORIGIN_TIERS) {
            const birth = drawBirth('at-the-seat', { world, origin: tier.key });
            const livesThere = tier.familyHouse?.whereTheyLive === 'inside it';
            if (!livesThere || !birth.house?.seat) {
                expect(birth.raisedInside, `${tier.key} was raised somewhere it does not live`)
                    .toBeNull();
                continue;
            }
            expect(birth.place.kind, `${tier.key} did not open at a seat`).toBe('sect_seat');
            expect(birth.place.name).toBe(birth.house.seat.name);
            expect(birth.raisedInside?.house.id).toBe(birth.house.id);
        }
    });

    it('does not put an ordinary birth on anybody\'s ground', () => {
        // The measurement this replaces: 400 births landed 147 city, 112 market
        // town, 77 village, 43 SECT TOWN and 21 hamlet, and zero at a seat. A
        // sect town is a town beside a house; that half was never the gap and
        // must not move.
        for (const birth of births) {
            if (birth.raisedInside !== null) continue;
            expect(birth.place.kind, `${birth.origin} opened on ground it does not live on`)
                .not.toBe('sect_seat');
        }
        expect(share(b => b.place.kind === 'sect_town')).toBeGreaterThan(0);

        // And the whole of it stays rare, because the tiers that live inside a
        // house are rare. Measured at about one birth in six hundred, which is
        // very nearly all the retainer families.
        expect(share(b => b.place.kind === 'sect_seat')).toBeLessThan(0.01);
    });

    it('leaves a clan with a hall of its own in a town', () => {
        // Two tiers hold their own vein and their own hall, and the house on
        // their row is one they are attached to rather than one they are in.
        // Reading the seat off membership instead put a small cultivating
        // family inside a salvage company's sorting yard.
        for (const key of ['minor_clan', 'established_clan'] as OriginTierKey[]) {
            const birth = drawBirth('own-hall', { world, origin: key });
            expect(birth.house, `${key} lost its house`).not.toBeNull();
            expect(birth.place.kind, `${key} was born on somebody else's ground`)
                .not.toBe('sect_seat');
            expect(birth.raisedInside).toBeNull();
        }
    });

    it('opens at a name the world will answer to', async () => {
        // ONE STRING, TWO WRITERS. A run's location is matched against the
        // world's own table by name, so a seat name composed differently here
        // opens the run at an address nothing has ever heard of - which reads
        // exactly like a working game until somebody looks around.
        const { state } = seedWorld({ seed: 'seat-names', catalog: await loadCultivationCatalog() });
        let checked = 0;
        for (const house of world.houses) {
            if (!house.seat) continue;
            const built = state.locations.find(l => l.id === sectGroundId(house.id));
            expect(built, `${house.id} has a birth seat the world never built`).toBeDefined();
            expect(built!.name, `${house.id} seat name disagrees with the world`)
                .toBe(house.seat.name);
            checked++;
        }
        // And every house the world seats has one here, not just the ones a
        // prefecture happens to hold.
        expect(checked).toBe(state.locations.filter(l => l.kind === 'sect_seat').length);
    });
});

describe('a member from birth is on a roll and not on a rung', () => {
    it('carries somebody on the roll only where the roll can carry them', () => {
        for (const tier of ORIGIN_TIERS) {
            const birth = drawBirth('roll', { world, origin: tier.key });
            const inside = birth.raisedInside;
            if (!inside) continue;
            if (inside.onTheRoll === 'by blood') {
                // Nothing was skipped: a lineage has no admission for its own,
                // and the door it keeps is adoption, which is for outsiders.
                expect(inside.house.roster).toBe('adoption');
            }
            if (inside.onTheRoll === null) {
                expect(inside.house.roster).toBe('open');
            }
        }
    });

    it('keeps a born member and an intake probationer visibly different', () => {
        // Same roll, same ladder, different route - and the difference is what
        // the house is owed. A child of the line needed nobody; a child taken
        // in against a bar cost somebody a word, and somebody is carrying it.
        const blood = drawBirth('blood', { world, origin: 'dao_house_bloodline' });
        expect(blood.raisedInside?.onTheRoll).toBe('by blood');
        expect(blood.raisedInside?.somebodyIsOwedForIt).toBe(false);

        const wards = Array.from({ length: 200 }, (_, i) =>
            drawBirth(`ward-${i}`, { world, origin: 'fostered_on_a_word' }));
        for (const ward of wards) {
            expect(ward.raisedInside?.onTheRoll).toBe('by taking');
        }
        // BOTH ARMS HAVE TO EXIST. `origin.md` turns on the asymmetry: a
        // placement at a house whose door already stands at the floor is "the
        // one placement in the world where nobody is carrying a debt", because
        // there was nothing to buy. Everywhere else a fostering is a favour and
        // somebody owes for it. A run in which every ward is owed for has
        // quietly erased the passage.
        const owed = wards.filter(w => w.raisedInside!.somebodyIsOwedForIt).length;
        expect(owed).toBeGreaterThan(0);
        expect(owed).toBeLessThan(wards.length);
    });

    it('carries no rank index anywhere on the object', () => {
        for (const tier of ORIGIN_TIERS) {
            const birth = drawBirth('no-rung', { world, origin: tier.key });
            const json = JSON.stringify(birth);
            expect(json).not.toMatch(/"rankIndex"|"sectRank"|"realmOrdinal"/);
            expect(birth.raisedInside === null
                || 'stillToClear' in birth.raisedInside).toBe(true);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE KNOWLEDGE GATE
// ─────────────────────────────────────────────────────────────────────────

describe('what you have heard of falls out of who your family corresponded with', () => {
    it('leaves a farm child with their own village and the doors their county talks about', () => {
        // This used to assert exactly two rows, and the second was
        // `commonlyNamedHouse` - one house, chosen as the world's lowest bar
        // and tie-broken ALPHABETICALLY ON THE FACTION ID. Seven houses are
        // tied at zero, so six of them were unreachable in every run ever
        // played, and a child born in one province was told the name of a
        // house in another. The test encoded that: "the two names they have
        // always had" is the defect, written down as an expectation.
        const birth = drawBirth('farm', { world, origin: 'thin_county' });
        expect(birth.knowledge[0].kind).toBe('place');
        expect(birth.knowledge[0].name).toBe(birth.place.name);

        const houses = birth.knowledge.filter(k => k.kind === 'sect').map(k => k.id).sort();
        const expected = commonlyNamedHouses(world.houses, birth.place.regionId)
            .map(h => h.id).sort();
        expect(houses).toEqual(expected);
        // A life with no standing still starts with something to walk towards.
        expect(houses.length).toBeGreaterThan(0);
    });

    it('grows the list monotonically with what the family reaches', () => {
        // ORDERED BY REACH, NOT BY TABLE POSITION. Those were the same thing
        // while the table was one ladder; they stopped being the same when the
        // top row split into three routes, because an apex sect member's child
        // is rarer than a Dao house's blood and their name reaches far less
        // far - the apex will not lend its name to a placement, so what the
        // parent has is a word to spend rather than standing to trade on. The
        // claim being made here is about reach and it is unchanged.
        // POOLED, AND GROUPED BY REACH, and both halves are the fix rather
        // than a widened bar. This drew ONE birth per tier and compared the
        // counts in order, which is two samples and not a measurement: a
        // birth's knowledge carries every place in the province it was drawn
        // into, the provinces hold different numbers of places, and three
        // tiers sit at reach 29 - so the comparison between those three was
        // reading which province the draw landed in. Adding one village row to
        // the Jade Gorge turned it red with nothing about reach having moved.
        //
        // Measured over 200 seeds a tier: reach 0 -> 5.5 names, 12 -> 9.9,
        // 20 -> 13.2, 29 -> 24.5, 38 -> 39.2. The steps are large and the
        // ordering across them is the claim; inside a reach it is a draw.
        const POOL = 200;
        const meanNames = (key: OriginTierKey): number => {
            let total = 0;
            for (let i = 0; i < POOL; i++) {
                total += drawBirth(`ladder-of-names-${i}`, { world, origin: key }).knowledge.length;
            }
            return total / POOL;
        };

        const byReach = new Map<number, number[]>();
        for (const tier of ORIGIN_TIERS) {
            const at = byReach.get(tier.placement.reach) ?? [];
            at.push(meanNames(tier.key));
            byReach.set(tier.placement.reach, at);
        }

        let previous = -1;
        for (const reach of [...byReach.keys()].sort((a, b) => a - b)) {
            const means = byReach.get(reach)!;
            const mean = means.reduce((sum, one) => sum + one, 0) / means.length;
            expect(mean, `reach ${reach} knows fewer names than a shorter reach`)
                .toBeGreaterThanOrEqual(previous);
            previous = mean;
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
            // "at no rank in it" is the state and is allowed to be said; what
            // is refused is a claim to have been admitted somewhere.
            expect(row.statement).not.toMatch(/has been admitted|holds the rank|ranked/i);
            if (row.kind === 'sect' && birth.house && row.id !== birth.house.id) {
                expect(row.statement).not.toMatch(/is a member/i);
            }
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
        expect(groundDensityFor('Burnt Earth', world)).toBe(densityForBand('thin'));
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
