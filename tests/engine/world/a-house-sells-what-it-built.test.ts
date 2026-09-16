/**
 * A house built a thing, and a house can sell it.
 *
 * The design owner, on sects trading with each other: *"why should they not?"*
 *
 * ── THREE THINGS WERE MISSING AND EACH HID THE NEXT ──────────────────────
 *
 *   no hull in any world     `TRACKED_CRAFT` is five rows and the seeder read
 *                            none of them. Measured on three seeds at three
 *                            hundred years: zero spirit boats, and none ever
 *                            built either, because a heaven-grade bill wants six
 *                            cores and the materials errand is capped below the
 *                            rung that brings one home. The only thing in the
 *                            world that crosses open water existed in a catalog
 *                            nothing read.
 *   no way to buy anything   `ownership-transfer.ts` names four routes and had
 *                            functions for the two contested ones. The
 *                            uncontested one - bought - had none, so the
 *                            commonest way a thing changes hands could not be
 *                            performed.
 *   no price for a hull      and correctly so: `WHAT_A_CRAFT_COSTS_TO_COMMISSION`
 *                            has no boat row because nobody commissions 2,400
 *                            days of work. A sale is not a commission, so the
 *                            price is derived from the bills rather than added
 *                            as a fourth row that would disagree with them.
 *
 * ── WHAT THE FIGURE IS ───────────────────────────────────────────────────
 *
 * A named carriage is 700 work-days and 40,000 stones; a hull is 2,400, so a
 * hull is 137,143. Against the world that produced it: seeded purses run 200 to
 * 1,400, and the measured median purse at a hundred years is around 150,000. So
 * nobody can buy one in a fresh world at any price, a middling house spends
 * everything it has, and the top tenth does not notice.
 */

import { describe, expect, it } from 'vitest';

import {
    whatACraftWouldFetch,
    whatAHouseWouldSell
} from '../../../src/engine/world/a-house-sells-what-it-built.js';
import { boughtFromItsOwner } from '../../../src/engine/world/ownership-transfer.js';
import {
    TRACKED_CRAFT,
    WHAT_A_CRAFT_COSTS_TO_COMMISSION,
    getConveyanceRecipe,
    recipeForConveyance
} from '../../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import { seedTheCraftThatAreObjects } from '../../../src/engine/world/artifact-placement.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import {
    A_STIPEND_PER_MEMBER_PER_YEAR,
    applyPressure
} from '../../../src/engine/world/the-world-changing-on-its-own.js';
import { createNpc, setRealm } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { createWorld, makeFaction, type WorldState } from '../../../src/engine/world/world-state.js';
import type { ObjectRecord } from '../../../src/engine/world/possessions.js';

const YEAR = 365;
const DAY = 200 * YEAR;

function aHull(ownerId: string | null): ObjectRecord {
    const row = TRACKED_CRAFT.find(c => c.data.conveyanceId === 'conv-spirit-boat')!;
    return { ...row, id: 'craft-under-test', ownerId, ownerName: ownerId ?? '', claims: [] };
}

/**
 * A province with a house that cannot pay, a house that can, and a hull.
 *
 * Arranged rather than played. The sibling arm is the seeded world below, which
 * reaches the same state the long way: the craft catalog is in it by the same
 * seeder every world uses.
 */
function build(opts: { sellerPurse: number; buyerPurse: number }): WorldState {
    const state = createWorld({ seed: 'sells-what-it-built', skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;
    state.locations.push(makeLocation({ id: 'loc-region', name: 'The Province', kind: 'region' }));
    let seq = 0;
    for (const [id, purse] of [['house-poor', opts.sellerPurse], ['house-rich', opts.buyerPurse]] as const) {
        state.locations.push(makeLocation({
            id: `seat-${id}`, name: `${id} seat`, kind: 'sect_seat', parentId: 'loc-region'
        }));
        state.factions.push(makeFaction({
            id, name: id, seatLocationId: `seat-${id}`, foundedOnDay: 0,
            resources: { spirit_stones: purse, power_ordinal: 25, reliable_ordinal: 20 }
        }));
        for (let i = 0; i < 10; i++) {
            let npc = createNpc(state.seed, {
                id: `npc-${seq++}`,
                bornOnDay: DAY - 365 * 80,
                onDay: DAY,
                locationId: `seat-${id}`,
                occupation: 'disciple'
            });
            npc = setRealm(npc, 18 + (i % 3), DAY);
            state.npcs.push({ ...npc, factionId: id, factionRankIndex: 1 });
        }
    }
    // Seated in one province and on terms, which is what `circleCandidatesFor`
    // asks. Nothing here is a trade-partner rule of its own.
    state.factions[0]!.standing['house-rich'] = 0.5;
    state.factions[1]!.standing['house-poor'] = 0.5;
    state.objects.push(aHull('house-poor'));
    return state;
}

describe('what a craft would fetch', () => {
    it('quotes the commission table where the table has a row', () => {
        for (const [id, price] of Object.entries(WHAT_A_CRAFT_COSTS_TO_COMMISSION)) {
            expect(whatACraftWouldFetch(id)).toBe(price);
        }
    });

    it('prices a hull off the bills rather than off a row of its own', () => {
        expect(WHAT_A_CRAFT_COSTS_TO_COMMISSION['conv-spirit-boat']).toBeUndefined();
        const hull = getConveyanceRecipe('build-spirit-boat')!;
        const anchor = recipeForConveyance('conv-carriage-heaven')!;
        expect(whatACraftWouldFetch('conv-spirit-boat')).toBe(Math.round(
            WHAT_A_CRAFT_COSTS_TO_COMMISSION['conv-carriage-heaven']!
            * (hull.workDays / anchor.workDays)
        ));
    });

    it('is dearer than anything the world commissions, because of what it takes', () => {
        const dearest = Math.max(...Object.values(WHAT_A_CRAFT_COSTS_TO_COMMISSION));
        expect(whatACraftWouldFetch('conv-spirit-boat')!).toBeGreaterThan(dearest);
    });

    /** Not property, and saying zero would be saying it is free. */
    it('says nothing at all about a thing that is not property', () => {
        expect(whatACraftWouldFetch('conv-sword-flight')).toBeNull();
        expect(whatACraftWouldFetch('conv-on-foot')).toBeNull();
        expect(whatACraftWouldFetch('conv-nothing-of-the-sort')).toBeNull();
    });
});

describe('who sells, and to whom', () => {
    const seller = { id: 'house-poor', name: 'poor', purse: 10 };
    const rich = { id: 'house-rich', name: 'rich', purse: 500_000 };

    it('does not ask a house that can pay its people', () => {
        expect(whatAHouseWouldSell({
            seller, owns: [aHull('house-poor')], circle: [rich], shortBy: 0
        })).toBeNull();
    });

    it('sells to somebody it would sit down with who can actually pay', () => {
        const deal = whatAHouseWouldSell({
            seller, owns: [aHull('house-poor')], circle: [rich], shortBy: 400
        });
        expect(deal).not.toBeNull();
        expect(deal!.buyer.id).toBe('house-rich');
        expect(deal!.price).toBe(whatACraftWouldFetch('conv-spirit-boat'));
    });

    it('sells nothing when nobody in the circle can cover it', () => {
        expect(whatAHouseWouldSell({
            seller,
            owns: [aHull('house-poor')],
            circle: [{ id: 'house-broke', name: 'broke', purse: 12 }],
            shortBy: 400
        })).toBeNull();
    });

    /**
     * A house does not hand over the only craft in the province to settle a
     * debt a lesser thing would clear.
     */
    it('sells the cheapest thing that covers what it is short of', () => {
        const carriage: ObjectRecord = {
            ...aHull('house-poor'),
            id: 'craft-carriage',
            data: { ...aHull('house-poor').data, conveyanceId: 'conv-carriage-heaven' }
        };
        const deal = whatAHouseWouldSell({
            seller, owns: [aHull('house-poor'), carriage], circle: [rich], shortBy: 400
        });
        expect(deal!.craft.id).toBe('craft-carriage');
    });

    /** Losing the hull AND still not making payroll is nobody's decision. */
    it('will not sell something that does not cover the shortfall', () => {
        const carriage: ObjectRecord = {
            ...aHull('house-poor'),
            id: 'craft-carriage',
            data: { ...aHull('house-poor').data, conveyanceId: 'conv-carriage-mortal' }
        };
        const deal = whatAHouseWouldSell({
            seller, owns: [carriage], circle: [rich], shortBy: 9_000
        });
        expect(deal).toBeNull();
    });
});

describe('the route nobody argues about', () => {
    it('moves the register, the holding and the provenance in one call', () => {
        const before = aHull('house-poor');
        const after = boughtFromItsOwner(before, {
            buyer: { id: 'house-rich', name: 'rich' },
            seller: { id: 'house-poor', name: 'poor' },
            onDay: DAY,
            price: 137_143,
            source: 'poor\'s yard'
        });
        expect(after.ownerId).toBe('house-rich');
        const last = after.provenance[after.provenance.length - 1]!;
        expect(last.how).toBe('bought');
        expect(last.holderId).toBe('house-rich');
        expect(last.previousHolderId).toBe(before.possessorId);
    });

    /**
     * A sale moves the register; whether it puts the thing in anybody's HAND is
     * the separate fact this module is built on. A hull is moored and never
     * carried - `a-house-builds-something-out-of-what-came-back.test.ts` states
     * that invariant, and a craft with a possessor is one `bestObjectHeldBy`
     * would arm somebody with. So a thing nobody was carrying is a thing nobody
     * is carrying after it changes hands, and the chain still names the buyer.
     */
    it('does not put a moored thing into anybody\'s hand', () => {
        const moored = aHull('house-poor');
        expect(moored.possessorId).toBeNull();
        const after = boughtFromItsOwner(moored, {
            buyer: { id: 'house-rich', name: 'rich' },
            seller: { id: 'house-poor', name: 'poor' },
            onDay: DAY, price: 1, source: 'a yard'
        });
        expect(after.possessorId).toBeNull();
    });

    it('does move what somebody was actually carrying', () => {
        const carried = { ...aHull('house-poor'), possessorId: 'npc-someone' };
        const after = boughtFromItsOwner(carried, {
            buyer: { id: 'house-rich', name: 'rich' },
            seller: { id: 'house-poor', name: 'poor' },
            onDay: DAY, price: 1, source: 'a hand'
        });
        expect(after.possessorId).toBe('house-rich');
    });

    /**
     * The load-bearing half. Force of arms needs everybody else to accept it
     * and standing over a thing needs nobody left to argue; a sale needs one
     * party's word and has it by construction.
     */
    it('is acknowledged by the person who handed it over', () => {
        const after = boughtFromItsOwner(aHull('house-poor'), {
            buyer: { id: 'house-rich', name: 'rich' },
            seller: { id: 'house-poor', name: 'poor' },
            onDay: DAY,
            price: 1,
            source: 'a yard'
        });
        const claim = after.claims[after.claims.length - 1]!;
        expect(claim.basis).toBe('purchase');
        expect(claim.strength).toBe(1);
        expect(claim.acknowledgedByIds).toContain('house-poor');
    });

    /**
     * A SALE IS NOT ALWAYS FOR STONES.
     *
     * This route is what the player-facing barter path closes on now, and above
     * the cash line money is not the medium at all - so the price handed in is
     * genuinely zero, and the claim read "Bought from X for 0 stones". That is
     * a false line in the one record a later claimant argues off: it says a
     * price was agreed and names it as nothing. Said plainly instead, in both
     * the claim and the chain.
     */
    it('records a trade that was not for stones as one', () => {
        const after = boughtFromItsOwner(aHull('house-poor'), {
            buyer: { id: 'house-rich', name: 'rich' },
            seller: { id: 'house-poor', name: 'poor' },
            onDay: DAY,
            price: 0,
            source: 'a yard'
        });
        const claim = after.claims[after.claims.length - 1]!;
        expect(claim.basis).toBe('purchase');
        expect(claim.note).not.toMatch(/0 stones/);
        expect(claim.note).toMatch(/not stones/);
        expect(after.provenance[after.provenance.length - 1]!.note).not.toMatch(/0 stones/);
        // And a real figure still reads as one.
        const paid = boughtFromItsOwner(aHull('house-poor'), {
            buyer: { id: 'house-rich', name: 'rich' },
            seller: { id: 'house-poor', name: 'poor' },
            onDay: DAY, price: 137_143, source: 'a yard'
        });
        expect(paid.claims[paid.claims.length - 1]!.note).toMatch(/137143 stones/);
    });
});

describe('the world does it', () => {
    it('puts the craft catalog into the world, which nothing did', () => {
        const state = createWorld({ seed: 'craft-seed', skipPriorAges: true, regionCount: 0 });
        for (const row of TRACKED_CRAFT) {
            if (row.ownerId === null) continue;
            state.factions.push(makeFaction({
                id: row.ownerId, name: row.ownerName, seatLocationId: null, foundedOnDay: 0
            }));
        }
        const seated = seedTheCraftThatAreObjects(state);
        expect(seated).toHaveLength(TRACKED_CRAFT.length);
        expect(seated.filter(c => c.data.conveyanceId === 'conv-spirit-boat').length)
            .toBeGreaterThan(0);
    });

    /**
     * A HULL THAT EXISTS ON DAY ONE WAS BUILT BY SOMEBODY, and the chain has to
     * say so before anything can append to it. The catalog's `craft()` pushes no
     * provenance - a catalog row has no absolute day to date one with - so a
     * seeded hull arrived with an empty chain and a sale would have written a
     * second link onto a chain that starts nowhere. The seeder writes the first
     * link, because the seeder is what knows the day.
     *
     * The builder is NOT invented. The catalog states an owner and no wright,
     * so the link says the thing was built and that the record does not carry
     * by whom - which is what the Dry Hull's own description already argues
     * for, its chain having a hole where the builder and the owner both belong.
     */
    it('gives a craft the world opened holding a chain that starts somewhere', () => {
        const state = createWorld({ seed: 'craft-chain', skipPriorAges: true, regionCount: 0 });
        state.currentDay = DAY;
        for (const row of TRACKED_CRAFT) {
            if (row.ownerId === null) continue;
            state.factions.push(makeFaction({
                id: row.ownerId, name: row.ownerName, seatLocationId: null, foundedOnDay: 0
            }));
        }
        for (const seated of seedTheCraftThatAreObjects(state)) {
            expect(seated.provenance.length).toBeGreaterThan(0);
            const first = seated.provenance[0]!;
            expect(first.how).toBe('crafted');
            expect(first.onDay).toBeLessThanOrEqual(DAY);
            expect(first.previousHolderId).toBeNull();
            expect(first.holderId).toBe(seated.ownerId);
        }
    });

    /**
     * And the seeder CALLS it, which is the half the arm above cannot see.
     * `seedArtifacts` was written for exactly this defect one catalog over, and
     * a function that works and is never called is the defect, not the fix.
     */
    it('so an ordinary seeded world has hulls in it', async () => {
        const catalog = await loadCultivationCatalog();
        const { state } = seedWorld({ seed: 'craft-is-in-the-world', catalog });
        const craft = state.objects.filter(o => typeof o.data.conveyanceId === 'string');
        expect(craft.length).toBe(TRACKED_CRAFT.length);
        const hulls = craft.filter(o => o.data.conveyanceId === 'conv-spirit-boat');
        expect(hulls.length).toBeGreaterThan(0);
        // Owned by houses this world actually contains, through the same join
        // `seedArtifacts` makes. A craft entered against an id no faction
        // answers to is a craft nothing can read.
        const houses = new Set(state.factions.map(f => f.id));
        const owned = craft.filter(o => o.ownerId !== null);
        expect(owned.length).toBeGreaterThan(0);
        for (const one of owned) expect(houses.has(one.ownerId!)).toBe(true);
    });

    /**
     * BOTH ARMS IN ONE COMMAND, and they differ in one number: what the seller
     * had in hand. Everything else about the two worlds is identical, so the
     * gap between the two buyers' purses is the sale and nothing else - a year
     * of wages and a carriage bought out of the yard move both arms alike and
     * cancel. A single-arm assertion here pinned the whole year's economy to a
     * figure and failed on the first unrelated change to it.
     */
    it('sells a hull out of a yard when the house cannot pay its own people', () => {
        const price = whatACraftWouldFetch('conv-spirit-boat')!;
        const sold = build({ sellerPurse: 10, buyerPurse: 500_000 });
        const kept = build({ sellerPurse: 500_000, buyerPurse: 500_000 });
        applyPressure(sold, DAY, DAY + YEAR, { intensity: 0 });
        applyPressure(kept, DAY, DAY + YEAR, { intensity: 0 });

        expect(sold.objects.find(o => o.id === 'craft-under-test')!.ownerId).toBe('house-rich');
        expect(kept.objects.find(o => o.id === 'craft-under-test')!.ownerId).toBe('house-poor');

        // AT LEAST the price, and not exactly it: the buyer now owns a hull and
        // a hull burns stones on the road, so the arm that bought one is also
        // the arm that paid to run one. That second difference is the burn
        // firing, and it is pinned on its own below.
        const buyerIn = (state: WorldState) =>
            Number(state.factions.find(f => f.id === 'house-rich')!.resources.spirit_stones);
        expect(buyerIn(kept) - buyerIn(sold)).toBeGreaterThanOrEqual(price);

        const row = sold.history.facts.find(f => f.data?.craftId === 'craft-under-test');
        expect(row, 'the world said nothing about a hull changing hands').toBeDefined();
        expect(row!.data.price).toBe(price);
        expect(row!.factionIds).toContain('house-rich');
    });

    /**
     * `whatTheChestBurns` was written, exported and tested with nothing in the
     * world charging it to anybody, and this is the arm that says it is charged
     * now. Two worlds identical but for a hull in one yard, twenty years each:
     * the house that runs a hull pays for every day it spends over ground that
     * is not there, and the house that walks pays nothing. Nothing else here
     * differs, and a carriage burns nothing, so the gap is the burn.
     */
    it('charges a house for running the thing over ground it cannot walk', () => {
        const withHull = build({ sellerPurse: 500_000, buyerPurse: 500_000 });
        const without = build({ sellerPurse: 500_000, buyerPurse: 500_000 });
        without.objects = without.objects.filter(o => o.id !== 'craft-under-test');
        applyPressure(withHull, DAY, DAY + 20 * YEAR, { intensity: 0 });
        applyPressure(without, DAY, DAY + 20 * YEAR, { intensity: 0 });

        const purseOf = (state: WorldState) =>
            Number(state.factions.find(f => f.id === 'house-poor')!.resources.spirit_stones);
        expect(purseOf(without)).toBeGreaterThan(purseOf(withHull));
    });

    /** The seller stops being short, which is the whole of why it went. */
    it('leaves the seller able to pay its people', () => {
        const state = build({ sellerPurse: 10, buyerPurse: 500_000 });
        applyPressure(state, DAY, DAY + YEAR, { intensity: 0 });
        const poor = state.factions.find(f => f.id === 'house-poor')!;
        expect(Number(poor.resources.spirit_stones))
            .toBeGreaterThan(10 * A_STIPEND_PER_MEMBER_PER_YEAR);
    });
});
