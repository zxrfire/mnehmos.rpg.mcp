/**
 * A house sends for its own, at every rung, and the head's word is not a request.
 *
 * ── WHAT WAS MEASURED ────────────────────────────────────────────────────
 *
 * `summonsPool` and `commissionBoard` were walked at every even ordinal from 0
 * to MAX_ORDINAL, at the bottom rung of a house and at the top rung of the same
 * house, before any of this was written:
 *
 *     ordinal 0-32    2 to 5 summonses          identical at rankIndex 0 and 5
 *     ordinal 34-46   NOTHING, at either rung
 *     board           empty from ordinal 18 up
 *
 * Two defects in one table.
 *
 * THE POOL IS BLIND TO RANK. `summonsPool` reads the eight hand-authored
 * `SUMMONS_ENTRIES` and filters them on the ORDINAL window alone, so an outer
 * disciple and the patriarch of the same house at the same rung on the ladder
 * are sent for about the same things. Nothing anywhere in the summons path
 * reads `rankIndex` except `cohortFor` and `postureFor`, which price an ask
 * that has already been drawn.
 *
 * AND IT RUNS OUT. Thirteen rungs of the ladder - every rung above Void
 * Tribulation, which is most of what an elder's life is spent at - have no
 * summons at all. The house stops sending for you at exactly the point you
 * become the person it would send.
 *
 * The generator that fixes both already existed and was pointed elsewhere.
 * `whatAHouseHasOnItsBoard` pitches the house's OWN reasons at whatever rung
 * the reader stands on, so it cannot run out, and `reasonsOpenTo` gates each
 * reason on the house's actual state - it holds ground, it has a rival, it has
 * a subsidiary. It was wired to the commission board and to nothing else, so
 * the house could be browsed and could not send for anybody.
 *
 * ── AND THE POSTURE LADDER RAN THE WRONG WAY FOR AN ORDER ────────────────
 *
 * `postureFor` reads told / assigned / consulted off the listener's share of
 * the ladder: told at the bottom, consulted at the top. That is right for a
 * notice nailed to a wall, which has no speaker, and it is backwards for the
 * head of the house speaking to you. The design owner: *"once you hit elder the
 * sect isn't going to ask you for stuff, the patriarch just tells you to do
 * things."*
 *
 * So posture is read off the GAP between the speaker and the listener rather
 * than off where the listener sits. A board notice keeps the old ladder because
 * it has nobody speaking. The head speaking to you is `told`, at every rung,
 * including the one below their own.
 *
 * ── WHAT WENT RED FIRST ──────────────────────────────────────────────────
 *
 *   x the house sends for its own above the hand-authored ceiling
 *       -> summonsPool is empty at ordinal 40
 *   x what it sends for is what the house is actually dealing with
 *       -> both houses produced the same empty pool
 *   x the head's word is told and not consulted, at the top of the ladder
 *       -> postureFor returned 'consulted'
 */

import { describe, expect, it } from 'vitest';

import {
    dutyTermsFor,
    postureFor,
    summonsPool,
    whatAHouseWouldSendYouOn
} from '../../../src/engine/encounters/duties.js';
import type { HouseAsItStands } from '../../../src/engine/world/who-goes-out-for-a-house-and-what-comes-back.js';
import type { Membership } from '../../../src/engine/encounters/types.js';

const RANKS = 6;

const memberAt = (rankIndex: number): Membership => ({
    factionId: 'house-under-test',
    factionName: 'Azure Dew Sect',
    rankIndex,
    rankCount: RANKS,
    contribution: 0
});

const houseAtPeace: HouseAsItStands = {
    id: 'house-under-test',
    name: 'Azure Dew Sect',
    holdsGround: true,
    standing: {},
    hasAFind: false
};

const houseAtWar: HouseAsItStands = {
    ...houseAtPeace,
    standing: { 'some-other-house': -0.8 }
};

describe('a house sends for its own at every rung', () => {
    it('sends for somebody above the rung the hand-authored list stops at', () => {
        const elder = memberAt(RANKS - 2);
        expect(summonsPool(40, elder)).toEqual([]);

        const sent = whatAHouseWouldSendYouOn({
            ordinal: 40,
            membership: elder,
            house: houseAtPeace,
            reachOfTheHouse: 40
        });
        expect(sent.length).toBeGreaterThan(0);
    });

    it('sends for what the house is actually dealing with', () => {
        const elder = memberAt(RANKS - 2);
        const atPeace = whatAHouseWouldSendYouOn({
            ordinal: 40, membership: elder, house: houseAtPeace, reachOfTheHouse: 40
        });
        const atWar = whatAHouseWouldSendYouOn({
            ordinal: 40, membership: elder, house: houseAtWar, reachOfTheHouse: 40
        });

        const war = (rows: readonly { entry: { id: string } }[]): boolean =>
            rows.some(row => row.entry.id.includes('sending-to-a-war'));

        expect(war(atPeace)).toBe(false);
        expect(war(atWar)).toBe(true);
    });

    it('does not send anybody on work the house has nobody able to reach', () => {
        const elder = memberAt(RANKS - 2);
        const beyondIt = whatAHouseWouldSendYouOn({
            ordinal: 40, membership: elder, house: houseAtPeace, reachOfTheHouse: 4
        });
        for (const row of beyondIt) {
            expect(row.terms.pitchOrdinal).toBeLessThanOrEqual(4);
        }
    });
});

describe('the head speaking is not the board speaking', () => {
    it('tells an elder, where the board would consult them', () => {
        const elder = memberAt(RANKS - 1);
        expect(postureFor(elder)).toBe('consulted');
        expect(postureFor(elder, { rankIndex: RANKS - 1, isHead: true })).toBe('told');
    });

    it('tells the bottom rung too, so nothing about this is a promotion', () => {
        const outer = memberAt(0);
        expect(postureFor(outer, { rankIndex: RANKS - 1, isHead: true })).toBe('told');
    });

    it('leaves the wall alone: a notice with nobody speaking keeps its ladder', () => {
        expect(postureFor(memberAt(0))).toBe('told');
        expect(postureFor(memberAt(2))).toBe('assigned');
        expect(postureFor(memberAt(RANKS - 1))).toBe('consulted');
    });

    it('does not read a peer as the head', () => {
        const elder = memberAt(RANKS - 2);
        expect(postureFor(elder, { rankIndex: RANKS - 2, isHead: false })).toBe(
            postureFor(elder)
        );
    });
});

/**
 * AND AN ORDER YOU CANNOT REFUSE IS WHAT MAKES IT AN ORDER.
 *
 * Sampled across 4,770 paragraphs of the genre: the most characteristic elder
 * moment in it is high standing and still being unable to act - a room of
 * furious senior people who say nothing, because the person who spoke outranks
 * every one of them. That is only possible if declining what the head told you
 * to do costs more than declining what the house put on a wall.
 *
 * It did not. `refusalFor` read the scale and the tags and nothing else, so an
 * order from the patriarch and a notice nobody signed carried the same word in
 * the ledger and the same price against standing. The posture was already
 * computed one line above it and was not consulted.
 *
 * RED FIRST: every severity below came back identical with and without the
 * head speaking.
 */
describe('and an order weighs more than a notice', () => {
    const anErrand = {
        id: 'test-errand', name: 'An errand', kind: 'opportunity' as const,
        simEventKind: 'opportunity' as const, weight: 1,
        minOrdinal: 0, maxOrdinal: 46, interrupts: false,
        threatOrdinal: null, summaryTemplate: 'x', tokens: [], tags: []
    };

    const ORDER = { rankIndex: RANKS - 1, isHead: true };

    it('costs more to refuse what the head told you than what the wall asked', () => {
        const member = memberAt(RANKS - 2);
        const asked = dutyTermsFor(anErrand as never, 10, member, 'summons');
        const told = dutyTermsFor(anErrand as never, 10, member, 'summons', ORDER);

        expect(asked.posture).not.toBe('told');
        expect(told.posture).toBe('told');
        expect(told.refusal.severity).not.toBe(asked.refusal.severity);
    });

    it('and says in the ledger that it was an order', () => {
        const member = memberAt(RANKS - 2);
        const told = dutyTermsFor(anErrand as never, 10, member, 'summons', ORDER);
        expect(told.refusal.description.toLowerCase()).toContain('order');
    });

    it('and does not reach past desertion, which a war already owns', () => {
        const member = memberAt(RANKS - 2);
        const war = { ...anErrand, tags: ['war'] };
        const told = dutyTermsFor(war as never, 10, member, 'summons', ORDER);
        expect(told.refusal.severity).toBe('unforgivable');
    });

    it('and a rogue off every roll is ordered by nobody', () => {
        const asked = dutyTermsFor(anErrand as never, 10, null, 'commission');
        const told = dutyTermsFor(anErrand as never, 10, null, 'commission', ORDER);
        expect(told.refusal.severity).toBe(asked.refusal.severity);
    });
});
