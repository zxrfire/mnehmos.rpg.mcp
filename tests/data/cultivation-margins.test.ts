/**
 * The margins: the fallen, and the unaffiliated.
 *
 * Two catalogs about the middle of society, validated together because they
 * make the same two promises and can fail them the same way.
 *
 *   THE ECONOMY IS ONE ECONOMY. Every wage, purse, bond, markup and fee here
 *   resolves against `mortal-world.ts` - 100 cash to the spirit stone, a
 *   30-stone starting purse - or is computed from it. A second set of numbers
 *   in this corner of the world would make both files useless.
 *
 *   A MISFORTUNE IS NOT A CHARACTER. Every fallen entry must carry work, place
 *   and attitude. An entry that names only what was lost is a prop, and the
 *   test below refuses it.
 *
 * Everything else asserted here is cross-reference hygiene: ids unique, and
 * every faction, place, occupation and price named by id actually exists.
 */

import { describe, it, expect } from 'vitest';

import { STARTING_SPIRIT_STONES } from '../../src/schema/cultivation.js';
import { NASCENT_SOUL_ORDINAL, isTheSamePerson } from '../../src/engine/cultivation/existence.js';
import { getSect } from '../../src/data/cultivation/sects.js';
import { REGIONS, getRegion } from '../../src/data/cultivation/regions.js';
import {
    OCCUPATIONS,
    PRICES,
    CASH_PER_STONE,
    MORTAL_WORK_CEILING_ORDINAL,
    getOccupation,
    getPrice,
    stonesToCash
} from '../../src/data/cultivation/mortal-world.js';
import {
    FALLEN,
    FallenSchema,
    FallenKindSchema,
    getFallen,
    fallenByKind,
    fallenInRegion,
    fallenWorkingAs,
    dangerousFallen,
    monthsOfWorkToAfford
} from '../../src/data/cultivation/fallen.js';
import {
    ROGUE_TRADES,
    RogueTradeSchema,
    BOUNTIES,
    BountySchema,
    DEALERS,
    DealerSchema,
    AUCTION_VENUES,
    AuctionVenueSchema,
    ROAD_CUSTOMS,
    RoadCustomSchema,
    WHY_UNAFFILIATED,
    WhyUnaffiliatedSchema,
    AUCTION_ACCESS,
    DEALER_MARKUP,
    UNBACKED,
    UNBACKED_DEDUCTION,
    UNDERWRITTEN_OCCUPATION_IDS,
    getRogueTrade,
    getBounty,
    getDealer,
    getAuctionVenue,
    tradesForOrdinal,
    bountiesFrom,
    bountiesHonoured,
    dealersIn,
    venuesAffordableWith,
    bondInCash,
    roadPrice,
    unbackedMonthlyFor,
    monthsToAffordOnTheRoad
} from '../../src/data/cultivation/rogues.js';

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

/** Every place name in the world, keyed by the region that holds it. */
const PLACES_BY_REGION: ReadonlyMap<string, Set<string>> = new Map(
    REGIONS.map(r => [r.id, new Set(r.places.map(p => p.name))])
);

// The WAGE economy, which is what a rogue trade competes against.
//
// `OCCUPATIONS` now runs the whole ladder: the commissions above the mortal
// ceiling are the same rows in the same table, and one of them pays five
// million cash a month. Measuring "a season of wage work" against that would
// compare a ruin diver's share to a False Immortal's retainer, which is not
// what any of these assertions is about. The wage economy is the half of the
// table at or below the ceiling, and it is the half a rogue can actually reach.
const WAGE_ECONOMY = OCCUPATIONS.filter(o => o.minOrdinal <= MORTAL_WORK_CEILING_ORDINAL);
const MIN_OCCUPATION_WAGE = Math.min(...WAGE_ECONOMY.map(o => o.cashPerMonth));
const MAX_OCCUPATION_WAGE = Math.max(...WAGE_ECONOMY.map(o => o.cashPerMonth));

function expectFactionsResolve(ids: readonly string[], label: string): void {
    for (const id of ids) {
        expect(getSect(id), `${label} names unknown faction ${id}`).toBeDefined();
    }
}

function expectPlacesResolve(regionId: string, places: readonly string[], label: string): void {
    expect(getRegion(regionId), `${label} names unknown region ${regionId}`).toBeDefined();
    const known = PLACES_BY_REGION.get(regionId)!;
    for (const place of places) {
        expect(known.has(place), `${label} names ${place}, which is not in ${regionId}`).toBe(true);
    }
}

// ─────────────────────────────────────────────────────────────────────────
// IDS
// ─────────────────────────────────────────────────────────────────────────

describe('ids', () => {
    it('are unique inside every catalog, and across all of them', () => {
        const sets: [string, readonly { id: string }[]][] = [
            ['fallen', FALLEN],
            ['rogue trade', ROGUE_TRADES],
            ['bounty', BOUNTIES],
            ['dealer', DEALERS],
            ['auction venue', AUCTION_VENUES],
            ['road custom', ROAD_CUSTOMS],
            ['reason for being unaffiliated', WHY_UNAFFILIATED]
        ];
        const all: string[] = [];
        for (const [label, entries] of sets) {
            const ids = entries.map(e => e.id);
            expect(new Set(ids).size, `duplicate ${label} ids`).toBe(ids.length);
            all.push(...ids);
        }
        expect(new Set(all).size, 'an id is reused across catalogs').toBe(all.length);
    });

    it('are reachable through their own lookups', () => {
        expect(getFallen(FALLEN[0].id)).toBeDefined();
        expect(getFallen('fallen-nobody')).toBeUndefined();
        expect(getRogueTrade(ROGUE_TRADES[0].id)).toBeDefined();
        expect(getBounty(BOUNTIES[0].id)).toBeDefined();
        expect(getDealer(DEALERS[0].id)).toBeDefined();
        expect(getAuctionVenue(AUCTION_VENUES[0].id)).toBeDefined();
        expect(getRogueTrade('rogue-nobody')).toBeUndefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE FALLEN
// ─────────────────────────────────────────────────────────────────────────

describe('the fallen', () => {
    it('parses, and is common enough to be the evidence it is meant to be', () => {
        for (const f of FALLEN) expect(() => FallenSchema.parse(f), f.id).not.toThrow();
        expect(FALLEN.length, 'too few to be the texture of a declining age')
            .toBeGreaterThanOrEqual(12);
        const common = FALLEN.filter(f => f.rarity === 'common');
        expect(common.length, 'most of the fallen must be cheap to meet')
            .toBeGreaterThanOrEqual(FALLEN.length / 3);
    });

    it('covers every way the world finishes with somebody', () => {
        for (const kind of FallenKindSchema.options) {
            expect(fallenByKind(kind).length, `nothing of kind ${kind}`).toBeGreaterThan(0);
        }
    });

    it('carries work, place and attitude on every entry, not only a misfortune', () => {
        for (const f of FALLEN) {
            expect(f.work.doing.trim().length, `${f.id} has no work`).toBeGreaterThan(39);
            expect(f.place.places.length, `${f.id} is nowhere`).toBeGreaterThan(0);
            expect(f.place.settlements.length, `${f.id} fits no settlement`).toBeGreaterThan(0);
            expect(f.attitude.trim().length, `${f.id} has no attitude`).toBeGreaterThan(59);
            // What happened is the smallest part of the entry, not the whole of it.
            const carried = f.work.doing.length + f.attitude.length;
            expect(carried, `${f.id} is a misfortune with a person attached`)
                .toBeGreaterThan(f.what.length);
        }
    });

    it('seats everybody in a real place inside a real region', () => {
        for (const f of FALLEN) {
            expectPlacesResolve(f.place.regionId, f.place.places, f.id);
            expectFactionsResolve(f.factionIds, f.id);
        }
        expect(fallenInRegion('region-low-fall').length).toBeGreaterThan(0);
        expect(fallenInRegion('region-quiet-marches').length).toBeGreaterThan(0);
    });

    it('holds jobs the occupation table would actually give them', () => {
        for (const f of FALLEN) {
            expect(f.currentOrdinal, `${f.id} is stronger now than it ever was`)
                .toBeLessThanOrEqual(f.lastOrdinal);
            if (f.work.occupationId === null) continue;
            const job = getOccupation(f.work.occupationId);
            expect(job, `${f.id} works an unknown job ${f.work.occupationId}`).toBeDefined();
            expect(
                job!.minOrdinal,
                `${f.id} holds ${job!.id}, which needs ordinal ${job!.minOrdinal} and they have ${f.currentOrdinal}`
            ).toBeLessThanOrEqual(f.currentOrdinal);
        }
        // And the mesh is live in both directions.
        expect(fallenWorkingAs('job-beast-culler').length).toBeGreaterThan(0);
        expect(fallenWorkingAs('job-nonexistent').length).toBe(0);
    });

    it('quotes prices out of the mortal economy and never a second one', () => {
        for (const f of FALLEN) {
            if (f.work.quotesPriceId === null) continue;
            expect(getPrice(f.work.quotesPriceId), `${f.id} quotes unknown price`).toBeDefined();
        }
        // The arithmetic that keeps the maimed maimed, computed rather than told.
        const months = monthsOfWorkToAfford('price-clear-meridian-pill', 'job-beast-culler')!;
        expect(months).toBeGreaterThan(4);
        expect(months).toBeLessThan(6);
        expect(monthsOfWorkToAfford('price-clear-meridian-pill', 'job-nobody')).toBeUndefined();
    });

    it('uses the engine\'s existence states only where they are legal', () => {
        for (const f of FALLEN) {
            if (f.existenceState === 'alive') {
                expect(f.identityContinuity, `${f.id} is alive and has a continuity figure`).toBeNull();
                continue;
            }
            expect(
                f.lastOrdinal,
                `${f.id} is ${f.existenceState} below Nascent Soul, which the engine forbids`
            ).toBeGreaterThanOrEqual(NASCENT_SOUL_ORDINAL);
            expect(f.identityContinuity, `${f.id} needs a continuity figure`).not.toBeNull();
        }
        const remnants = FALLEN.filter(f => f.existenceState === 'remnant');
        expect(remnants.length, 'no remnant anywhere').toBeGreaterThan(0);
        for (const r of remnants) {
            expect(isTheSamePerson(r), `${r.id} is being treated as the person`).toBe(false);
            expect(r.company, 'a remnant is not company').toBe('not_company');
        }
        // Somebody who came back changed is still themselves to the engine.
        const changed = FALLEN.filter(
            f => f.identityContinuity !== null && f.existenceState !== 'remnant');
        expect(changed.length).toBeGreaterThan(0);
        for (const c of changed) expect(isTheSamePerson(c), c.id).toBe(true);
    });

    it('leaves the unnameable damage unexplained', () => {
        const unexplained = FALLEN.filter(f => f.unexplained !== null);
        expect(unexplained.length, 'nothing came back wrong in a way nobody can name')
            .toBeGreaterThan(0);
        for (const f of unexplained) {
            expect(f.unexplained!.length).toBeGreaterThan(39);
        }
    });

    it('has dangerous ones, and at least one who is dangerous by being written off', () => {
        expect(dangerousFallen().length, 'nobody here is dangerous').toBeGreaterThanOrEqual(3);
        expect(
            dangerousFallen({ underestimatedOnly: true }).length,
            'nobody is dangerous precisely because they are written off'
        ).toBeGreaterThanOrEqual(1);
        for (const f of dangerousFallen()) expect(f.danger!.how.length).toBeGreaterThan(59);
    });

    it('has people worth an evening, and flags nobody as important', () => {
        expect(
            FALLEN.filter(f => f.company === 'good').length,
            'none of the fallen is better company than the people who succeeded'
        ).toBeGreaterThanOrEqual(3);

        const forbidden = /prodig|destined|chosen one|secretly|hidden (master|talent|realm)|unmatched/i;
        for (const f of FALLEN) {
            const text = [f.what, f.attitude, f.work.doing, f.unexplained ?? '', f.asked ?? ''].join(' ');
            expect(forbidden.test(text), `${f.id} flags itself as important`).toBe(false);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// ROGUE TRADES
// ─────────────────────────────────────────────────────────────────────────

describe('rogue trades', () => {
    it('parses, and covers the work the brief actually asks for', () => {
        for (const t of ROGUE_TRADES) expect(() => RogueTradeSchema.parse(t), t.id).not.toThrow();
        for (const id of [
            'rogue-ruin-diver',
            'rogue-bounty-taker',
            'rogue-dealer',
            'rogue-escort',
            'rogue-formation-hand'
        ]) {
            expect(getRogueTrade(id), `${id} is missing`).toBeDefined();
        }
    });

    it('meshes with the occupation table rather than duplicating it', () => {
        for (const t of ROGUE_TRADES) {
            for (const id of t.occupationIds) {
                const job = getOccupation(id);
                expect(job, `${t.id} names unknown occupation ${id}`).toBeDefined();
                expect(
                    job!.minOrdinal,
                    `${t.id} opens at ${t.minOrdinal} but ${id} needs ${job!.minOrdinal}`
                ).toBeLessThanOrEqual(t.minOrdinal);
            }
            expectFactionsResolve(t.factionIds, t.id);
        }
    });

    it('pays inside the mortal economy, per month and per job alike', () => {
        for (const t of ROGUE_TRADES) {
            if (t.pay.basis === 'monthly') {
                expect(t.pay.cash, `${t.id} pays below every listed wage`)
                    .toBeGreaterThanOrEqual(MIN_OCCUPATION_WAGE);
                expect(t.pay.cash, `${t.id} pays above every listed wage`)
                    .toBeLessThanOrEqual(MAX_OCCUPATION_WAGE);
            } else {
                // Piece work can beat a wage, and should - it is why anyone digs.
                expect(t.pay.cash).toBeGreaterThan(0);
                expect(t.pay.cash % 1).toBe(0);
            }
        }
    });

    it('prices being unbacked as a deduction off the underwritten trades only', () => {
        expect(UNBACKED_DEDUCTION).toBeGreaterThan(0);
        expect(UNBACKED_DEDUCTION).toBeLessThan(0.5);
        for (const id of UNDERWRITTEN_OCCUPATION_IDS) {
            const job = getOccupation(id)!;
            expect(job, id).toBeDefined();
            expect(unbackedMonthlyFor(id)).toBe(Math.round(job.cashPerMonth * (1 - UNBACKED_DEDUCTION)));
            expect(unbackedMonthlyFor(id)!).toBeLessThan(job.cashPerMonth);
        }
        // Piece work is not discounted: the goods are the proof.
        expect(unbackedMonthlyFor('job-beast-culler')).toBe(getOccupation('job-beast-culler')!.cashPerMonth);
        expect(unbackedMonthlyFor('job-nobody')).toBeUndefined();

        // The monthly trades quote the deducted figure they claim to quote.
        for (const t of ROGUE_TRADES) {
            if (t.pay.basis !== 'monthly') continue;
            const underwritten = t.occupationIds.filter(id => UNDERWRITTEN_OCCUPATION_IDS.includes(id));
            if (underwritten.length !== 1) continue;
            expect(t.pay.cash, `${t.id} does not quote the unbacked rate for ${underwritten[0]}`)
                .toBe(unbackedMonthlyFor(underwritten[0]));
        }
    });

    it('opens at the bottom of the ladder, where a run actually lives', () => {
        const early = tradesForOrdinal(4);
        expect(early.length, 'a Qi Condensation rogue has nothing to do').toBeGreaterThanOrEqual(4);
        expect(tradesForOrdinal(0).every(t => t.minOrdinal === 0)).toBe(true);
        expect(tradesForOrdinal(45).length).toBe(ROGUE_TRADES.length);
    });

    it('says what the digging costs the diggers', () => {
        const diver = getRogueTrade('rogue-ruin-diver')!;
        expect(diver.risk).toBe('lethal');
        expect(diver.deathRate, 'a ruin-diver with no mortality rate').not.toBeNull();
        expect(diver.deathRate!.length).toBeGreaterThan(40);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// BOUNTIES
// ─────────────────────────────────────────────────────────────────────────

describe('bounties', () => {
    it('parses, and names posters that exist', () => {
        for (const b of BOUNTIES) {
            expect(() => BountySchema.parse(b), b.id).not.toThrow();
            if (b.posterFactionId !== null) expectFactionsResolve([b.posterFactionId], b.id);
        }
        expect(BOUNTIES.length).toBeGreaterThanOrEqual(8);
    });

    it('has purses a mortal economy could pay, and mostly honours them', () => {
        const monthOfCulling = getOccupation('job-beast-culler')!.cashPerMonth;
        for (const b of BOUNTIES) {
            expect(b.purseCash, `${b.id} pays less than a bowl of millet`)
                .toBeGreaterThanOrEqual(getPrice('price-millet')!.cash);
            // Nothing on this board is worth more than a decade of the best
            // work available to a Qi Condensation cultivator.
            expect(b.purseCash, `${b.id} is a fortune nobody in this economy has`)
                .toBeLessThanOrEqual(monthOfCulling * 120);
        }
        expect(bountiesHonoured('reliably').length).toBeGreaterThan(BOUNTIES.length / 3);
        expect(bountiesHonoured('rarely').length, 'nothing on the board ever goes wrong')
            .toBeGreaterThan(0);
    });

    it('has both institutional and unbacked posters, and a catch on every one', () => {
        expect(BOUNTIES.some(b => b.posterFactionId === null), 'no village or private posting')
            .toBe(true);
        expect(BOUNTIES.some(b => b.posterFactionId !== null), 'no institutional posting').toBe(true);
        for (const b of BOUNTIES) expect(b.catch.length, b.id).toBeGreaterThan(39);
        expect(bountiesFrom('sect-gleaners-company').length).toBeGreaterThan(0);
        expect(bountiesFrom('sect-nobody').length).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// DEALERS AND THE ROAD MARKUP
// ─────────────────────────────────────────────────────────────────────────

describe('itinerant dealers', () => {
    it('parses, and stands in real places', () => {
        for (const d of DEALERS) {
            expect(() => DealerSchema.parse(d), d.id).not.toThrow();
            expectPlacesResolve(d.regionId, d.places, d.id);
            expectFactionsResolve(d.factionIds, d.id);
        }
        expect(dealersIn('region-low-fall').length).toBeGreaterThan(0);
        expect(dealersIn('region-quiet-marches').length).toBeGreaterThan(0);
        // Somebody has to be on the buying side, or the diggers sell to nobody.
        expect(DEALERS.some(d => d.side !== 'sells'), 'nobody buys anything').toBe(true);
        expect(dealersIn('region-quiet-marches', 'buys').length).toBeGreaterThan(0);
    });

    it('marks everything up, and never marks anything down', () => {
        for (const [kind, entry] of Object.entries(DEALER_MARKUP)) {
            expect(entry.multiplier, `${kind} is cheaper on the road than over a counter`)
                .toBeGreaterThan(1);
            expect(entry.multiplier, `${kind} markup is not a price, it is a robbery`)
                .toBeLessThanOrEqual(3);
        }
        // Advancement costs more than survival on the road too.
        expect(DEALER_MARKUP.manual.multiplier).toBeGreaterThan(DEALER_MARKUP.medicine.multiplier);
        // And stones barely move, because the Consortium sets that rate.
        expect(DEALER_MARKUP.stones.multiplier).toBeLessThan(DEALER_MARKUP.medicine.multiplier);
    });

    it('computes the road price off the catalog price', () => {
        const counter = getPrice('price-minor-healing-pill')!.cash;
        const road = roadPrice('price-minor-healing-pill', 'medicine')!;
        expect(road).toBeGreaterThan(counter);
        expect(road).toBe(Math.round(counter * DEALER_MARKUP.medicine.multiplier));
        // Thirty stones on the road for the pill every run starts with one of.
        expect(road / CASH_PER_STONE).toBe(30);
        expect(roadPrice('price-nothing', 'medicine')).toBeUndefined();

        const months = monthsToAffordOnTheRoad(
            'price-minor-healing-pill', 'medicine', 'job-beast-culler')!;
        expect(months).toBeGreaterThan(1);
        expect(months).toBeLessThan(4);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE AUCTION CIRCUIT
// ─────────────────────────────────────────────────────────────────────────

describe('the auction circuit', () => {
    it('parses, meets somewhere real, and says who runs it', () => {
        for (const v of AUCTION_VENUES) {
            expect(() => AuctionVenueSchema.parse(v), v.id).not.toThrow();
            expectPlacesResolve(v.regionId, v.places, v.id);
            if (v.runByFactionId !== null) expectFactionsResolve([v.runByFactionId], v.id);
            expect(v.protections.length, `${v.id} lists no protections at all`).toBeGreaterThan(0);
        }
        expect(AUCTION_VENUES.length).toBeGreaterThanOrEqual(4);
    });

    it('lets a starting purse onto a public floor and not into the back room', () => {
        const affordable = venuesAffordableWith(STARTING_SPIRIT_STONES);
        expect(affordable.length, 'a starting cultivator can attend nothing').toBeGreaterThan(1);
        const reserved = getAuctionVenue('auction-low-fall-reserved')!;
        expect(reserved.entryBondStones, 'the reserved floor is affordable, which it must not be')
            .toBeGreaterThan(STARTING_SPIRIT_STONES);
        expect(affordable).not.toContain(reserved);

        const publicFloor = getAuctionVenue('auction-low-fall-floor')!;
        expect(publicFloor.entryBondStones).toBeLessThanOrEqual(STARTING_SPIRIT_STONES);
        expect(bondInCash('auction-low-fall-floor')).toBe(
            stonesToCash(publicFloor.entryBondStones));
        expect(bondInCash('auction-nowhere')).toBeUndefined();
    });

    it('has a venue with no bond and no protection, which is where most selling happens', () => {
        const kerb = AUCTION_VENUES.filter(v => v.entryBondStones === 0);
        expect(kerb.length, 'every venue charges a bond, so the poor sell nowhere')
            .toBeGreaterThan(0);
    });

    it('is honest about what a sectless bidder cannot have', () => {
        expect(AUCTION_ACCESS.canBid.length).toBeGreaterThan(1);
        expect(AUCTION_ACCESS.cannotBid.length).toBeGreaterThan(1);
        expect(AUCTION_ACCESS.theWayAround.length).toBeGreaterThan(1);
        expect(AUCTION_ACCESS.theRealConstraint.length).toBeGreaterThan(80);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// CUSTOMS AND THE THROUGH-LINE
// ─────────────────────────────────────────────────────────────────────────

describe('the unaffiliated as a class', () => {
    it('keeps customs that cost something to break', () => {
        for (const c of ROAD_CUSTOMS) {
            expect(() => RoadCustomSchema.parse(c), c.id).not.toThrow();
            expect(c.breakingIt.length, `${c.id} has no consequence`).toBeGreaterThan(39);
        }
        expect(ROAD_CUSTOMS.length).toBeGreaterThanOrEqual(6);
    });

    it('states both halves of the through-line', () => {
        expect(UNBACKED.lacks.length, 'being unbacked costs nothing').toBeGreaterThanOrEqual(5);
        expect(UNBACKED.has.length, 'being unbacked buys nothing').toBeGreaterThanOrEqual(3);
        for (const l of UNBACKED.lacks) expect(l.cost.length, l.what).toBeGreaterThan(59);
    });

    it('records why they are out there, and does not flatter them', () => {
        for (const w of WHY_UNAFFILIATED) {
            expect(() => WhyUnaffiliatedSchema.parse(w), w.id).not.toThrow();
        }
        const chosen = WHY_UNAFFILIATED.filter(w => w.share === 'a few' && /chose/i.test(w.reason));
        expect(chosen.length, 'nobody chose it').toBe(1);
        expect(
            WHY_UNAFFILIATED.some(w => w.share === 'most'),
            'no single commonest reason, which makes the distribution decorative'
        ).toBe(true);
        // Most did not choose it: the chosen entry is never the commonest.
        expect(chosen[0].share).not.toBe('most');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// ONE ECONOMY
// ─────────────────────────────────────────────────────────────────────────

describe('one economy, not two', () => {
    it('holds the conversion rate the mortal world holds', () => {
        expect(CASH_PER_STONE).toBe(100);
        expect(stonesToCash(STARTING_SPIRIT_STONES)).toBe(3_000);
    });

    it('names only prices and occupations that exist', () => {
        const priceIds = new Set(PRICES.map(p => p.id));
        const jobIds = new Set(OCCUPATIONS.map(o => o.id));
        const quoted = FALLEN
            .map(f => f.work.quotesPriceId)
            .filter((id): id is string => id !== null);
        for (const id of quoted) expect(priceIds.has(id), `unknown price ${id}`).toBe(true);
        const worked = [
            ...FALLEN.map(f => f.work.occupationId).filter((id): id is string => id !== null),
            ...ROGUE_TRADES.flatMap(t => t.occupationIds)
        ];
        for (const id of worked) expect(jobIds.has(id), `unknown occupation ${id}`).toBe(true);
    });

    it('keeps the auction bonds, purses and shares on the same scale as a wage', () => {
        const startingPurse = stonesToCash(STARTING_SPIRIT_STONES);
        const publicBond = bondInCash('auction-low-fall-floor')!;
        expect(publicBond, 'the public bond exceeds the whole starting purse')
            .toBeLessThanOrEqual(startingPurse);

        // A diver's good share is worth more than a season of wage work and
        // less than the pill that is the whole point of the run's economy.
        const share = getRogueTrade('rogue-ruin-diver')!.pay.cash;
        expect(share).toBeGreaterThan(MAX_OCCUPATION_WAGE);
        expect(share).toBeLessThan(getPrice('price-farmland-mu')!.cash * 2);
    });
});
