/**
 * 道心 - what a crossing asks, and the proof that it has no opinion about the
 * answer.
 *
 * The whole risk in this mechanic is stated in the module's own header: if
 * regret feeds heart demons then sparing an enemy is punished, and if a clean
 * ledger buys a clean crossing then the engine rewards virtue. Both are the
 * engine growing a view, and both are easy to write by accident.
 *
 * So the tests here are not "does the number go up". They are the four
 * statements that make the number honest:
 *
 *   1  MERCY AND REVENGE BUY THE SAME THING. `forgiven` and `avenged` are two
 *      ways of finishing and the crossing cannot tell them apart.
 *   2  NEITHER ROAD IS THE CHEAP ONE. The same deed, spared and killed, and
 *      killing does not empty the ledger.
 *   3  DIRECTION IS NOT READ. A thing owed and a thing owing weigh the same.
 *   4  AND A CALLER WITH NO LEDGER CHANGES NOTHING. The ladder is calibrated
 *      against the unaided sweeps and they must produce a byte-identical
 *      modifier list with this in.
 */

import { describe, expect, it } from 'vitest';
import {
    A_LIFE_THAT_IS_ALL_LOOSE_ENDS,
    MAX_DAO_HEART_STRAIN,
    whatACrossingAsksOfTheDaoHeart
} from '../../../src/engine/cultivation/what-a-crossing-asks-of-the-dao-heart';
import { computeBreakthroughOdds } from '../../../src/engine/cultivation/breakthrough';
import { isRealmBoundary } from '../../../src/engine/cultivation/realms';
import {
    type ObligationRecord,
    createGrudge,
    createFavor,
    inheritOnDeath,
    settleObligation
} from '../../../src/engine/social/grudges';
import { withNoNameOnIt } from '../../../src/engine/social/accounts-with-no-name';
import { createObligation } from '../../../src/engine/social/grudges';
import {
    type Party,
    whatADeedLeaves
} from '../../../src/engine/social-leverage/what-a-deed-leaves';
import type { Cultivator } from '../../../src/schema/cultivation';

const ME = 'them-that-climbs';
const THEM = 'the-other-party';

function grudgeAgainstMe(severityCost: 'slight' | 'serious' | 'grave' | 'unforgivable', day = 1): ObligationRecord {
    return createGrudge({
        holderId: THEM,
        subjectId: ME,
        cause: 'robbery',
        severity: severityCost,
        onDay: day,
        description: 'Took what was theirs.'
    });
}

/** A cultivator standing at a realm wall with nothing else remarkable about them. */
const AT_A_WALL = 12;

function standingAtAWall(ordinal = AT_A_WALL): Parameters<typeof computeBreakthroughOdds>[0] {
    return {
        realmOrdinal: ordinal,
        spiritRoot: 'single_fire',
        attributes: { might: 2, insight: 2, fortune: 2, presence: 2 },
        injuries: [],
        age: 30,
        cultivationProgress: 0
    } as unknown as Cultivator;
}

describe('what a crossing asks of the dao heart', () => {
    it('counts what is unfinished and nothing else about it', () => {
        const read = whatACrossingAsksOfTheDaoHeart({
            personId: ME,
            ledger: [grudgeAgainstMe('grave')]
        });
        expect(read.open).toBe(1);
        expect(read.heaviest).toBe('grave');
        expect(read.share).toBeGreaterThan(0);
        expect(read.line).toContain('unfinished');
    });

    it('reads nothing at all off an empty ledger', () => {
        const read = whatACrossingAsksOfTheDaoHeart({ personId: ME, ledger: [] });
        expect(read.open).toBe(0);
        expect(read.weight).toBe(0);
        expect(read.share).toBe(0);
        expect(read.heaviest).toBeNull();
    });

    // ── 1. THE SHARPEST PROOF THAT THE ENGINE HAS NO VIEW ──────────────────
    //
    // Mercy and revenge are two ways of finishing something. A crossing that
    // could tell them apart would be a crossing with a preference, and this
    // asserts directly that it cannot: the two settlements are byte-identical
    // in everything the dao heart reads.
    it('cannot tell forgiveness from revenge, because both are finished', () => {
        const open = grudgeAgainstMe('grave');
        const forgiven = settleObligation(open, {
            resolution: 'forgiven', onDay: 40, note: 'They let it go.'
        });
        const avenged = settleObligation(open, {
            resolution: 'avenged', onDay: 40, note: 'They took it back in blood.'
        });

        const carrying = whatACrossingAsksOfTheDaoHeart({ personId: ME, ledger: [open] });
        const afterMercy = whatACrossingAsksOfTheDaoHeart({ personId: ME, ledger: [forgiven] });
        const afterBlood = whatACrossingAsksOfTheDaoHeart({ personId: ME, ledger: [avenged] });

        expect(carrying.share).toBeGreaterThan(0);
        expect(afterMercy).toEqual(afterBlood);
        expect(afterMercy.share).toBe(0);
    });

    // ── 3. DIRECTION IS NOT READ ───────────────────────────────────────────
    it('weighs a thing owed and a thing owing the same', () => {
        const owedToMe = createFavor({
            holderId: ME,
            subjectId: THEM,
            cause: 'saved_life',
            severity: 'grave',
            onDay: 1,
            description: 'Pulled them out of it.'
        });
        const owingByMe = grudgeAgainstMe('grave');

        const oneWay = whatACrossingAsksOfTheDaoHeart({ personId: ME, ledger: [owedToMe] });
        const theOther = whatACrossingAsksOfTheDaoHeart({ personId: ME, ledger: [owingByMe] });

        expect(oneWay.weight).toBe(theOther.weight);
        expect(oneWay.share).toBe(theOther.share);
        expect(oneWay.open).toBe(theOther.open);
    });

    it('does not count an account with no name on it, because nobody is a party to it', () => {
        // The concealed road's whole shape. Something certainly happened and
        // the ledger holds it, and there is no name on the row - so it weighs
        // nothing at a wall and everything at the moment a name attaches.
        const nameless = createObligation(withNoNameOnIt({
            kind: 'grudge',
            holderId: THEM,
            subjectId: ME,
            cause: 'robbery',
            severity: 'unforgivable',
            onDay: 1,
            description: 'Somebody did this. Nobody knows who.'
        }));
        expect(nameless.subjectId).toBeNull();

        const read = whatACrossingAsksOfTheDaoHeart({ personId: ME, ledger: [nameless] });
        expect(read.open).toBe(0);
        expect(read.share).toBe(0);
    });

    it('collapses kin copies onto the deed, so a big family is not a heavier wrong', () => {
        const one = grudgeAgainstMe('grave');
        const copies = inheritOnDeath(one, THEM, [
            { id: 'brother', relation: 'descendant' },
            { id: 'sister', relation: 'descendant' },
            { id: 'cousin', relation: 'clan' }
        ], 200);
        expect(copies.length).toBeGreaterThan(1);

        const alone = whatACrossingAsksOfTheDaoHeart({ personId: ME, ledger: [one] });
        const inherited = whatACrossingAsksOfTheDaoHeart({ personId: ME, ledger: copies });
        expect(inherited.open).toBe(alone.open);
        expect(inherited.weight).toBe(alone.weight);
    });

    it('caps at a life of loose ends and never past it', () => {
        const many = Array.from({ length: 40 }, (_, i) => grudgeAgainstMe('unforgivable', i + 1));
        const read = whatACrossingAsksOfTheDaoHeart({ personId: ME, ledger: many });
        expect(read.weight).toBeGreaterThan(A_LIFE_THAT_IS_ALL_LOOSE_ENDS);
        expect(read.share).toBe(1);
    });

    it('ignores anything incurred after the day it is asked about', () => {
        const later = grudgeAgainstMe('grave', 500);
        expect(whatACrossingAsksOfTheDaoHeart({
            personId: ME, ledger: [later], asOfDay: 100
        }).open).toBe(0);
        expect(whatACrossingAsksOfTheDaoHeart({
            personId: ME, ledger: [later], asOfDay: 900
        }).open).toBe(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// 2. NEITHER ROAD IS THE CHEAP ONE
// ─────────────────────────────────────────────────────────────────────────

describe('neither road empties the ledger', () => {
    const actor: Party = {
        id: ME, name: 'The Climber',
        houseId: null, houseName: null, alignment: null, ranked: false
    };
    const subject: Party = {
        id: THEM, name: 'The Other',
        houseId: 'a-house', houseName: 'A House', alignment: 'righteous', ranked: true,
        kin: [
            { id: 'their-brother', relation: 'descendant' },
            { id: 'their-disciple', relation: 'disciple' }
        ]
    };

    /** The same wrong, both times, and the only thing that differs is the ending. */
    const wrong = {
        cause: 'robbery' as const,
        paidBy: 'subject' as const,
        cost: 0.6,
        onDay: 10,
        description: 'Took what they had.'
    };

    function daoHeartAfter(rows: ReturnType<typeof whatADeedLeaves>['opens']) {
        return whatACrossingAsksOfTheDaoHeart({
            personId: ME,
            ledger: rows.map(createObligation)
        });
    }

    it('leaves a real account whether the other party lived or not', () => {
        const spared = whatADeedLeaves({ deed: wrong, actor, subject, reach: 'answerable' });
        const killed = whatADeedLeaves({
            deed: { ...wrong, irreversible: true },
            actor,
            subject,
            reach: 'answerable',
            // They are in no position to hold anything. Their people hold it
            // from day one instead.
            principalCannotHoldIt: true
        });

        const afterSparing = daoHeartAfter(spared.opens);
        const afterKilling = daoHeartAfter(killed.opens);

        // The point of the whole design: finishing somebody is not a way of
        // emptying your own ledger. Neither reading is zero, and the decisive
        // road is not the lighter one.
        expect(afterSparing.share).toBeGreaterThan(0);
        expect(afterKilling.share).toBeGreaterThan(0);
        expect(afterKilling.weight).toBeGreaterThanOrEqual(afterSparing.weight);

        // And the difference between them is SHAPE, not size. The spared
        // account is held by the living counterparty, so there is somebody to
        // go to; the other one is held by people the actor has never met.
        expect(spared.opens[0].holderId).toBe(THEM);
        expect(killed.opens[0].holderId).not.toBe(THEM);
    });

    it('does not make being killed off the cheaper answer at any severity', () => {
        for (const cost of [0.2, 0.45, 0.8, 1]) {
            const spared = whatADeedLeaves({
                deed: { ...wrong, cost }, actor, subject, reach: 'answerable'
            });
            const killed = whatADeedLeaves({
                deed: { ...wrong, cost, irreversible: true },
                actor, subject, reach: 'answerable', principalCannotHoldIt: true
            });
            expect(
                daoHeartAfter(killed.opens).weight,
                `killing was cheaper at cost ${cost}`
            ).toBeGreaterThanOrEqual(daoHeartAfter(spared.opens).weight);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// 4. WHAT IT DOES TO THE ODDS
// ─────────────────────────────────────────────────────────────────────────

describe('what an unfinished record costs a crossing', () => {
    it('books no line at all for a caller that passes no ledger', () => {
        const without = computeBreakthroughOdds(standingAtAWall(), { ambient: 'normal' });
        const withZero = computeBreakthroughOdds(standingAtAWall(), {
            ambient: 'normal', daoHeart: 0, daoHeartOpen: 0
        });
        expect(withZero.modifiers).toEqual(without.modifiers);
        expect(without.modifiers.some(m => m.source.startsWith('dao_heart'))).toBe(false);
    });

    it('charges it at a realm wall and at no other rung', () => {
        expect(isRealmBoundary(AT_A_WALL)).toBe(true);
        const wall = computeBreakthroughOdds(standingAtAWall(AT_A_WALL), {
            ambient: 'normal', daoHeart: 1, daoHeartOpen: 4
        });
        expect(wall.modifiers.find(m => m.source === 'dao_heart:4_unfinished')?.delta)
            .toBeCloseTo(-MAX_DAO_HEART_STRAIN, 10);

        const step = AT_A_WALL - 1;
        expect(isRealmBoundary(step)).toBe(false);
        const between = computeBreakthroughOdds(standingAtAWall(step), {
            ambient: 'normal', daoHeart: 1, daoHeartOpen: 4
        });
        expect(between.modifiers.some(m => m.source.startsWith('dao_heart'))).toBe(false);
    });

    it('keeps the ledger summing to the final chance, which is the file invariant', () => {
        const odds = computeBreakthroughOdds(standingAtAWall(), {
            ambient: 'normal', daoHeart: 0.5, daoHeartOpen: 2
        });
        const summed = odds.modifiers.reduce((total, m) => total + m.delta, 0);
        expect(summed).toBeCloseTo(odds.finalChance, 10);
    });

    it('names the count and never the causes', () => {
        const odds = computeBreakthroughOdds(standingAtAWall(), {
            ambient: 'normal', daoHeart: 0.5, daoHeartOpen: 2
        });
        const line = odds.modifiers.find(m => m.source.startsWith('dao_heart'))!;
        expect(line.source).toBe('dao_heart:2_unfinished');
        expect(line.source).not.toContain('robbery');
    });
});
