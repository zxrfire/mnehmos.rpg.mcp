/**
 * Whoever finds a thing in a ruin decides what happens to it.
 *
 * Ruled by the design owner: *"if you found it, you can read it, or you can turn
 * it into the sect for merit"*, and *"you earn merit for turning into the sect
 * things that the sect wants."* Before this a house's party carried every book
 * home unread and the house decided who read it.
 *
 * What these encode: reading spends one use off the row the house then gets;
 * turning a book in hands the house every use and credits the finder what the
 * book is worth to that house; a rogue has no house to turn anything in to; a
 * house that already holds a thing wants no second; and a ruin's goods follow
 * what the ruin was, with the house taking the ones it cannot buy for itself.
 *
 * Red-checked: carrying every find to the house unread (the old behaviour) fails
 * the read, turn-in, second-copy and goods assertions, five of the six.
 */

import { describe, it, expect } from 'vitest';

import { fixtureCatalog } from './fixtures.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { makeLocation, makeThresholds } from '../../../src/engine/world/locations.js';
import type { NpcRecord } from '../../../src/engine/world/npc-state.js';
import { makeFaction, type WorldState } from '../../../src/engine/world/world-state.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
import { whatIsLeftIn } from '../../../src/engine/world/what-a-manual-has-left-in-it.js';
import { meritWith } from '../../../src/engine/world/what-a-house-counts-in-somebodys-favour.js';
import { requiredContributionForRank } from '../../../src/engine/cultivation/what-each-rung-of-a-house-ladder-requires.js';
import {
    applyWhatThePartyCarriedOut,
    shelveWhatItWasHolding,
    theBooksBehindTheirDoor,
    theGoodsLeftIn
} from '../../../src/engine/world/what-a-ruin-has-on-its-shelves.js';
import { whatTheHouseMakesOf } from '../../../src/engine/world/what-a-house-gives-merit-for.js';

/** A heaven-grade road nothing teaches: three reads, opens at 22, carries to 25, no element. */
const HEAVEN_BOOK = 'karmic-thread-reading-art';
const HOUSE_ID = 'house-finders';

function world(seed: string): WorldState {
    const { state } = seedWorld({ seed, catalog: fixtureCatalog(), presentYear: 1000, population: 60 });
    state.factions.push(makeFaction({
        id: HOUSE_ID, name: 'The Finders Hall',
        ranks: ['Outer', 'Inner', 'Core', 'True', 'Elder', 'Grand Elder', 'Head'],
        resources: { spirit_stones: 100_000 }
    }));
    return state;
}

function ground(id: string, standsAt: number) {
    return makeLocation({
        id,
        name: 'The Shut Store',
        kind: 'ruin',
        parentId: null,
        description: 'A store room nobody has opened since the house that kept it stopped.',
        thresholds: makeThresholds(
            Math.max(0, standsAt - 4), Math.max(0, standsAt - 3), Math.max(0, standsAt - 1), standsAt),
        sealed: true
    });
}

function person(state: WorldState, tag: string, ordinal: number, houseId: string | null): NpcRecord {
    const row = state.npcs.find(n => n.status === 'alive')!;
    const made: NpcRecord = {
        ...row,
        id: `finder-${tag}`,
        name: `Finder ${tag}`,
        factionId: houseId,
        factionRankIndex: houseId === null ? -1 : 0,
        merit: null,
        tags: [],
        activity: null,
        cultivation: { ...row.cultivation, realmOrdinal: ordinal, techniqueIds: [] }
    };
    state.npcs.push(made);
    return made;
}

function aHeavenBookIn(state: WorldState, doorId: string): string {
    const dead = person(state, `dead-${doorId}`, 40, null);
    const door = ground(doorId, 40);
    const [book] = theBooksBehindTheirDoor({
        location: door, occupant: { ...dead, cultivation: { ...dead.cultivation, techniqueIds: [HEAVEN_BOOK] } }, onDay: 0
    });
    shelveWhatItWasHolding(state, [book!]);
    return door.id;
}

const HOUSE = { id: HOUSE_ID, name: 'The Finders Hall', seatLocationId: null };

describe('a book somebody on a roll finds', () => {
    it('is read by the finder where it carries them, one use off it, and the house gets the rest', () => {
        const state = world('finders-read');
        const door = aHeavenBookIn(state, 'loc-read');
        const finder = person(state, 'reader', 30, HOUSE_ID);

        const [row] = applyWhatThePartyCarriedOut(state, {
            locationId: door, house: HOUSE, readers: [finder], onDay: 500
        });

        expect(row!.readById).toBe(finder.id);
        expect(row!.turnedInById).toBeNull();
        expect(state.npcs.find(n => n.id === finder.id)!.cultivation.techniqueIds).toContain(HEAVEN_BOOK);
        const book = state.objects.find(o => o.id === row!.objectId)!;
        expect(book.ownerId).toBe(HOUSE_ID);
        expect(whatIsLeftIn(book, 'heaven').left).toBe(2);
        expect(meritWith(state.npcs.find(n => n.id === finder.id)!, HOUSE_ID)).toBe(0);
    });

    it('is turned in whole by a finder it would not carry, for merit on the order of a promotion', () => {
        const state = world('finders-turn-in');
        const door = aHeavenBookIn(state, 'loc-turn-in');
        const finder = person(state, 'giver', 10, HOUSE_ID);
        const factsBefore = state.history.facts.length;

        const [row] = applyWhatThePartyCarriedOut(state, {
            locationId: door, house: HOUSE, readers: [finder], onDay: 500
        });

        expect(row!.readById).toBeNull();
        expect(row!.turnedInById).toBe(finder.id);
        const book = state.objects.find(o => o.id === row!.objectId)!;
        expect(book.ownerId).toBe(HOUSE_ID);
        expect(whatIsLeftIn(book, 'heaven').left).toBe(3);
        const merit = meritWith(state.npcs.find(n => n.id === finder.id)!, HOUSE_ID);
        expect(merit).toBe(row!.meritForIt);
        expect(merit).toBeGreaterThanOrEqual(requiredContributionForRank(2));
        expect(state.history.facts.length).toBeGreaterThan(factsBefore);
    });

    it('cannot be turned in by a rogue, who keeps it', () => {
        const state = world('finders-rogue');
        const door = aHeavenBookIn(state, 'loc-rogue');
        const rogue = person(state, 'rogue', 10, null);

        const [row] = applyWhatThePartyCarriedOut(state, {
            locationId: door, house: null, readers: [rogue], onDay: 500
        });

        expect(row!.turnedInById).toBeNull();
        expect(row!.meritForIt).toBe(0);
        const book = state.objects.find(o => o.id === row!.objectId)!;
        expect(book.possessorId).toBe(rogue.id);
        expect(whatIsLeftIn(book, 'heaven').left).toBe(3);
    });

    it('is not wanted by a house that already holds one, and the finder keeps it', () => {
        const state = world('finders-second-copy');
        const door = aHeavenBookIn(state, 'loc-second');
        state.objects.push(makeObject({
            id: 'house-finders-own-copy', name: 'The house copy', kind: 'manual', significance: 'significant',
            description: 'Theirs already.', possessorId: HOUSE_ID, ownerId: HOUSE_ID, ownerName: 'The Finders Hall',
            locationId: null, tags: ['manual', 'library'], data: { techniqueId: HEAVEN_BOOK, copies: 1 }
        }));
        const finder = person(state, 'second', 10, HOUSE_ID);

        const [row] = applyWhatThePartyCarriedOut(state, {
            locationId: door, house: HOUSE, readers: [finder], onDay: 500
        });

        expect(row!.turnedInById).toBeNull();
        expect(state.objects.find(o => o.id === row!.objectId)!.ownerId).toBe(finder.id);
        expect(meritWith(state.npcs.find(n => n.id === finder.id)!, HOUSE_ID)).toBe(0);
    });
});

describe('the goods a ruin was left holding', () => {
    it('follow what the ruin was, and the house takes what it cannot buy', () => {
        const state = world('finders-goods');
        const vault = ground('loc-vault', 40);
        const goods = theGoodsLeftIn({ location: vault, character: 'vault', onDay: 0 });
        expect(goods.length).toBeGreaterThan(0);
        expect(theGoodsLeftIn({ location: vault, character: 'archive', onDay: 0 })).toEqual([]);
        shelveWhatItWasHolding(state, goods);
        const wanted = goods.filter(g => whatTheHouseMakesOf(state, HOUSE_ID, g).wanted);
        expect(wanted.length).toBeGreaterThan(0);
        const finder = person(state, 'goods', 40, HOUSE_ID);

        applyWhatThePartyCarriedOut(state, { locationId: vault.id, house: HOUSE, readers: [finder], onDay: 500 });

        for (const g of wanted) expect(state.objects.find(o => o.id === g.id)!.ownerId).toBe(HOUSE_ID);
        expect(meritWith(state.npcs.find(n => n.id === finder.id)!, HOUSE_ID)).toBeGreaterThan(0);
    });

    it('that any market sells are kept by whoever carried them, in a house that can buy its own', () => {
        const state = world('finders-common');
        const store = ground('loc-common', 8);
        const goods = theGoodsLeftIn({ location: store, character: 'vault', onDay: 0 });
        expect(goods.length).toBeGreaterThan(0);
        shelveWhatItWasHolding(state, goods);
        const finder = person(state, 'common', 8, HOUSE_ID);

        applyWhatThePartyCarriedOut(state, { locationId: store.id, house: HOUSE, readers: [finder], onDay: 500 });

        for (const g of goods) expect(state.objects.find(o => o.id === g.id)!.ownerId).toBe(finder.id);
        expect(meritWith(state.npcs.find(n => n.id === finder.id)!, HOUSE_ID)).toBe(0);
    });
});
