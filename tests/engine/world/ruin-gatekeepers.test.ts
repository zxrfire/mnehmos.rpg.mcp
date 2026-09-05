/**
 * Who turns you away from a ruin, and how much of that you are told.
 *
 * Two design decisions live in this module as numbers, and a number nobody
 * reads twice gets silently reverted by whoever finds it surprising. Both are
 * pinned here with the reasoning attached:
 *
 *   AN ENTRY BAR IS A PERSON. *"a ruin only turns people away IF A SECT OWNS
 *   IT. if you stumble upon ruins with nobody near, who is there to turn you
 *   away?"* An unheld ruin does not refuse. It is not thereby safe: the
 *   survival bar is geology and applies to whoever walks in.
 *
 *   AND WHAT YOU ARE TOLD IS ABOUT YOU. *"you are low, and you know nothing.
 *   peak, you get told it's abc sect with authority derived from their court
 *   and apex."* Three readings, not two, because "nobody holds this" and
 *   "somebody holds this and you cannot be told who" are opposite facts.
 */

import { describe, it, expect } from 'vitest';
import { makeLocation, makeThresholds } from '../../../src/engine/world/locations.js';
import { whoTurnsYouAwayFrom } from '../../../src/engine/world/ruin-gatekeepers.js';
import { FOUNDATION_ORDINAL } from '../../../src/engine/cultivation/realms.js';
import { ELDER_FLOOR_ORDINAL } from '../../../src/data/cultivation/inheritance-trials.js';

const HOUSE = 'sect-azure-cloud-pavilion';

function ruin(controllingFactionId: string | null = null) {
    return makeLocation({
        id: 'loc-ruin-test',
        name: 'Cold Spring',
        kind: 'ruin',
        thresholds: makeThresholds(15, 19, 23, 25),
        controllingFactionId
    });
}

describe('an entry bar is a person', () => {
    it('has nobody behind it at a ruin nobody holds', () => {
        const keeper = whoTurnsYouAwayFrom(ruin(), 0);
        expect(keeper.barApplies).toBe(false);
        expect(keeper.claim).toBe('nobody');
        expect(keeper.factionId).toBeNull();
    });

    it('stands wherever a house holds the ground', () => {
        const keeper = whoTurnsYouAwayFrom(ruin(HOUSE), 0);
        expect(keeper.barApplies).toBe(true);
        expect(keeper.factionId).toBe(HOUSE);
    });

    // Narrowed to ruins on purpose. 27 of the world's 262 entry bars have no
    // holder and only 12 are ruins; the rest are ground that teaches something,
    // whose bar means the ground rather than a doorkeeper.
    it('stands on unheld ground that is not a ruin', () => {
        const wilds = makeLocation({
            id: 'loc-wilds-test',
            name: 'The Glass Field',
            kind: 'wilds',
            thresholds: makeThresholds(20, 24, 28, 32)
        });
        expect(whoTurnsYouAwayFrom(wilds, 0).barApplies).toBe(true);
    });

    // What the reader may know must never change what happens to their body.
    it('does not move with the reader\'s rung', () => {
        for (const ordinal of [0, FOUNDATION_ORDINAL, ELDER_FLOOR_ORDINAL, 40]) {
            expect(whoTurnsYouAwayFrom(ruin(), ordinal).barApplies).toBe(false);
            expect(whoTurnsYouAwayFrom(ruin(HOUSE), ordinal).barApplies).toBe(true);
        }
    });
});

describe('what a reader is told about the claim', () => {
    it('gives a nobody the warning and not the name', () => {
        const keeper = whoTurnsYouAwayFrom(ruin(HOUSE), FOUNDATION_ORDINAL - 1);
        expect(keeper.claim).toBe('somebody_unnamed');
        expect(keeper.factionName).toBeNull();
        expect(keeper.authority).toEqual([]);
        // The world's own answer is still on the record for the mechanical
        // channel. The gate is on what is said in words.
        expect(keeper.factionId).toBe(HOUSE);
    });

    it('gives the house from the foundation bar up', () => {
        const keeper = whoTurnsYouAwayFrom(ruin(HOUSE), FOUNDATION_ORDINAL);
        expect(keeper.claim).toBe('named');
        expect(keeper.factionName).toBe('Azure Cloud Pavilion');
        // The name, and not yet whose gift it is in.
        expect(keeper.authority).toEqual([]);
    });

    // Measured: 34 of 34 sects carry a parentage row, and the chain is 1 deep
    // for 19 of them, 2 for 4, 3 for 9 and 4 for 2. A length of 1 is not a hole
    // - it is an apex, an unaffiliated house or a Dao house that holds no vein
    // by nature - so both shapes are asserted here rather than only the deep one.
    it('gives the authority behind a house that holds under somebody', () => {
        const keeper = whoTurnsYouAwayFrom(ruin('sect-verdant-spring-hall'), ELDER_FLOOR_ORDINAL);
        expect(keeper.claim).toBe('named');
        // Outermost first, ending at the house standing here. Authority runs
        // apex -> court -> local, so a subsidiary's claim is never self-standing.
        expect(keeper.authority.length).toBe(4);
        expect(keeper.authority[keeper.authority.length - 1]).toBe('Verdant Spring Hall');
    });

    it('gives an apex house as standing on its own, which is what it does', () => {
        const keeper = whoTurnsYouAwayFrom(ruin(HOUSE), ELDER_FLOOR_ORDINAL);
        expect(keeper.claim).toBe('named');
        expect(keeper.authority).toEqual(['Azure Cloud Pavilion']);
    });

    // Two silences that were printed identically before this existed.
    it('keeps "nobody holds this" apart from "you cannot be told"', () => {
        const unheld = whoTurnsYouAwayFrom(ruin(), 0);
        const held = whoTurnsYouAwayFrom(ruin(HOUSE), 0);
        expect(unheld.factionName).toBeNull();
        expect(held.factionName).toBeNull();
        // Same absent name, opposite facts, and the claim is what separates them.
        expect(unheld.claim).not.toBe(held.claim);
    });
});
