/**
 * The theft path moved a book, but nobody ever checked its old shelf in play.
 * The annual pass must let readers discover the loss without identifying a
 * thief from the engine's provenance. Returned books and loans are not thefts;
 * a book above every member's reach gives nobody occasion to find it missing.
 * Removing only the annual shelf call fails the first test; restoring it
 * passes. Both arms ran in one command against the same pinned world.
 */
import { describe, expect, it } from 'vitest';
import { TECHNIQUES } from '../../../src/data/cultivation/techniques.js';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { makeObject, transferPossession } from '../../../src/engine/world/possessions.js';
import { housesFindEmptyShelves } from '../../../src/engine/world/a-house-finds-an-empty-shelf.js';
import { applyPressure } from '../../../src/engine/world/pressure.js';

function fixture() {
    const state = createWorld({ seed: 'shelves-in-play', skipPriorAges: true, presentYear: 0 });
    const art = TECHNIQUES.find(row => row.requiredOrdinal === 0 && (row.cap ?? 0) >= 4)!;
    const house = makeFaction({ id: 'house-shelf', name: 'The test house',
        resources: { spirit_stones: 1_000_000 }, seatLocationId: state.locations[0].id });
    state.factions = [house];
    state.npcs = Array.from({ length: 12 }, (_, n) => createNpc(state.seed, {
        id: `shelf-reader-${n}`, bornOnDay: -20 * 365, onDay: 0,
        cultivation: { realmOrdinal: 0 }, factionId: house.id, locationId: house.seatLocationId
    }));
    const book = makeObject({ id: 'library-copy', name: art.name, kind: 'manual',
        ownerId: house.id, possessorId: house.id, locationId: house.seatLocationId,
        tags: ['library', 'manual'], data: { techniqueId: art.id, cap: art.cap } });
    state.objects = [transferPossession(book, { onDay: -1, toHolderId: 'unseen-taker',
        toHolderName: 'The unseen taker', how: 'stolen', source: house.name })];
    return { state, book, house };
}

describe('a house goes back to its shelves', () => {
    it('discovers a loss in the running annual pass without discovering a thief', () => {
        const { state } = fixture();
        applyPressure(state, 0, 365, { intensity: 0,
            housesActOnAnEmptyPurse: false, peopleWalkOutOnTheirOwnAccount: false });
        const news = state.history.facts.filter(fact => fact.data.missingShelfObject === 'library-copy');
        expect(news).toHaveLength(1);
        expect(news[0].summary).toContain('missing');
        expect(news[0].summary).not.toContain('unseen taker');
        expect(news[0].actors).toEqual([]);
        expect(news[0].visibility).toBe('faction');
        housesFindEmptyShelves(state, 365, 730);
        expect(state.history.facts.filter(fact => fact.data.missingShelfObject === 'library-copy')).toHaveLength(1);
    });

    it('does not mistake a returned book or a subsequent loan for a missing theft', () => {
        const { state, book, house } = fixture();
        state.objects = [book];
        housesFindEmptyShelves(state, 0, 10_000);
        expect(state.history.facts.some(fact => fact.data.missingShelfObject)).toBe(false);
        const stolen = fixture().state.objects[0];
        const returned = transferPossession(stolen, { onDay: 0, toHolderId: house.id,
            toHolderName: house.name, how: 'confiscated', source: 'Recovered' });
        state.objects = [transferPossession(returned, { onDay: 1, toHolderId: 'borrower',
            toHolderName: 'A borrower', how: 'lent', source: house.name })];
        housesFindEmptyShelves(state, 1, 10_000);
        expect(state.history.facts.some(fact => fact.data.missingShelfObject)).toBe(false);
    });

    it('leaves a shelf unexamined when nobody can work from that book', () => {
        const { state } = fixture();
        const beyondThem = TECHNIQUES.find(row => row.requiredOrdinal > 20)!;
        state.objects[0].data.techniqueId = beyondThem.id;
        housesFindEmptyShelves(state, 0, 10_000);
        expect(state.history.facts.some(fact => fact.data.missingShelfObject)).toBe(false);
    });
});
