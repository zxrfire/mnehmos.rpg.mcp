/**
 * ONE ANSWER TO "WHAT WOULD CLOSE THIS", AND IT KNOWS BOTH ROADS.
 *
 * `whatWouldCloseThisWound` filtered `PILLS` to `effect: 'treat_injury'`, which
 * is graded by severity and skips a permanent injury at every grade. So a
 * permanent wound reached the player down a line of its own - `pillThatMends`,
 * walked by hand in `situated-reads.ts` - and the two ends of one question
 * disagreed about what medicine exists in the world.
 *
 * ── AND THE ROAD ITSELF MOVED WHILE THIS WAS BEING WRITTEN ───────────────
 *
 * The first cut of this file pinned a pill written for a named permanent wound.
 * The design owner overruled the premise under it: **structural repair medicine
 * answers every permanent injury, by RANK**, and a bespoke pill beside it was a
 * second module doing the first one's job. So the wound rows and the medicine
 * rows no longer have to agree by name - the four rungs reach to 16, 20, 28 and
 * 40, and which one answers is a fact about the body rather than about the
 * injury.
 *
 * The fifth rung is the chaos one: it reaches ANY rank and picks which injury
 * it closes rather than letting the taker pick. It is asked last, and only where
 * the rank ladder runs out, because a dose you can point at a particular wound
 * is worth more than one that chooses for you.
 *
 * WHAT MUST NOT MOVE, AND IS THE LAST DESCRIBE BLOCK: unifying the roads must
 * not un-gate the naming. A beginner is told which GRADE would answer and never
 * what it is called - `told-nothing-can-be-done-and-told-otherwise-later.test.ts`
 * holds that rule for the graded road, and it now has to hold for the other one,
 * because a maiming is the case the whole trope was built around.
 *
 * RED-CHECKED. Putting the `effect === 'treat_injury'` filter back in
 * `whatSomebodyWouldGoAndGet` fails the first block; making `repairRefusalReason`
 * demand a named `mends` again fails it the same way; passing `undefined` for
 * `asking` fails the last.
 */

import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { makeGame } from './harness';
import { KnowledgeGate } from '../../src/web/knowledge';
import {
    whatToSayAboutTheCure,
    whatWouldCloseThisWound
} from '../../src/web/what-would-close-this-wound';
import {
    STRUCTURAL_REPAIR_MEDICINES
} from '../../src/data/cultivation/structural-repair-medicine';
import {
    NOTHING_REPAIRS_ABOVE_ORDINAL,
    theRungsThatRepairAPermanentInjury
} from '../../src/engine/cultivation/what-structural-repair-medicine-can-reach';
import { WOUND_TYPES } from '../../src/data/cultivation/wounds';
import { HOME_REGION_ID } from '../../src/data/cultivation/regions';
import { MAX_ORDINAL } from '../../src/engine/cultivation/realms';
import type { Injury } from '../../src/schema/cultivation';

/** A wound the body never closes. Read out of the catalog, never named here. */
const PERMANENT = WOUND_TYPES.find(w => w.key === 'severed-flesh')!;

/** The cheapest rung, and the rung that reaches furthest without being chaos. */
const LOWEST = [...STRUCTURAL_REPAIR_MEDICINES]
    .sort((a, b) => a.reachesUpToOrdinal - b.reachesUpToOrdinal)[0]!;

function hurt(woundType: string | null, severity: Injury['severity'] = 'crippling'): Injury {
    return {
        id: `wound-${woundType ?? 'plain'}`,
        severity,
        source: 'other',
        turn: 1,
        sustainedOnTurn: 1,
        woundType,
        description: 'Written by the engine, read by this test.',
        treated: false
    } as unknown as Injury;
}

/** A gate over a real schema with no rows in it: somebody nobody has told. */
function gateOverAFreshRun(): { db: Database.Database; gate: KnowledgeGate } {
    const { db } = makeGame({ seed: 'one-answer-to-what-would-close-this' });
    return { db, gate: new KnowledgeGate(db) };
}

describe('the road for a permanent injury is five rungs and the read is on it', () => {
    it('runs mortal to chaos, and only the top one refuses to choose', () => {
        const rungs = theRungsThatRepairAPermanentInjury();
        expect(rungs.length).toBe(STRUCTURAL_REPAIR_MEDICINES.length + 1);
        // Four that reach a stated rung and let the taker point at a wound, and
        // one that reaches any rank and does not.
        const anyRank = rungs.filter(r => r.reachesUpToOrdinal === null);
        expect(anyRank.length).toBe(1);
        expect(anyRank[0]!.grade).toBe('chaos');
        expect(anyRank[0]!.choosesTheWound).toBe(false);
        expect(rungs.filter(r => r.choosesTheWound).length).toBe(STRUCTURAL_REPAIR_MEDICINES.length);
    });

    it('names the cheapest rung that reaches the body carrying it', () => {
        const cure = whatWouldCloseThisWound(
            [hurt(PERMANENT.key)], LOWEST.reachesUpToOrdinal, 10_000, HOME_REGION_ID);
        expect(cure, 'a permanent wound came back with no answer at all').not.toBeNull();
        expect(cure!.name).toBe(LOWEST.name);
        // The wound is not on that rung's `mends` list. Rank is the axis now,
        // and this is the assertion that says so.
        expect(LOWEST.mends).not.toContain(PERMANENT.key);
    });

    it('moves up the ladder as the body does', () => {
        const low = whatWouldCloseThisWound(
            [hurt(PERMANENT.key)], LOWEST.reachesUpToOrdinal, 10_000, HOME_REGION_ID)!;
        const high = whatWouldCloseThisWound(
            [hurt(PERMANENT.key)], LOWEST.reachesUpToOrdinal + 1, 10_000, HOME_REGION_ID)!;
        expect(high.name, 'the same dose answered a body past its reach').not.toBe(low.name);
    });

    it('hands the one that reaches any rank to a body past the rank ladder', () => {
        expect(NOTHING_REPAIRS_ABOVE_ORDINAL).toBeLessThan(MAX_ORDINAL);
        const cure = whatWouldCloseThisWound(
            [hurt(PERMANENT.key)], NOTHING_REPAIRS_ABOVE_ORDINAL + 1, 10_000, HOME_REGION_ID);
        expect(cure, 'nothing answered a permanent wound above the rank ladder').not.toBeNull();
        expect(cure!.grade).toBe('chaos');
    });

    it('quotes no counter for any of it, and says why', () => {
        for (const ordinal of [LOWEST.reachesUpToOrdinal, NOTHING_REPAIRS_ABOVE_ORDINAL + 1]) {
            const cure = whatWouldCloseThisWound(
                [hurt(PERMANENT.key)], ordinal, 10_000, HOME_REGION_ID)!;
            expect(cure.stones, `a counter quoted a figure at ordinal ${ordinal}`).toBeNull();
            expect(cure.notForSale, `no sentence for a counter that will not quote`).not.toBeNull();
            expect(cure.affordable).toBe(false);
        }
    });

    it('says which wound it is talking about, and not that it is a tear', () => {
        const cure = whatWouldCloseThisWound(
            [hurt(PERMANENT.key)], LOWEST.reachesUpToOrdinal, 10_000, HOME_REGION_ID)!;
        expect(cure.forWound).toBe(PERMANENT.name);
        expect(whatToSayAboutTheCure(cure)).toContain(PERMANENT.name.toLowerCase());
    });

    it('keeps a permanent wound off the physician, whatever its severity says', () => {
        const cure = whatWouldCloseThisWound(
            [hurt(PERMANENT.key, 'serious')], LOWEST.reachesUpToOrdinal, 10_000, HOME_REGION_ID)!;
        expect(cure.physicianReaches).toBe(false);
    });

    it('still answers an ordinary tear off the graded line', () => {
        // The two roads meet in one function, so the other one has to keep
        // working: this is the case that was never broken and would be the
        // first thing a rewrite of this size would lose.
        const cure = whatWouldCloseThisWound([hurt('torn-meridians', 'minor')], 0, 10_000, HOME_REGION_ID);
        expect(cure).not.toBeNull();
        expect(cure!.grade).toBe('mortal');
        expect(cure!.stones, 'an ordinary tear should be answered at a counter').not.toBeNull();
    });
});

describe('and unifying the roads did not un-gate the naming', () => {
    it('tells somebody who has never heard of it nothing they could type', () => {
        const { db, gate } = gateOverAFreshRun();
        try {
            const cure = whatWouldCloseThisWound(
                [hurt(PERMANENT.key)], 0, 10_000, HOME_REGION_ID, 1,
                { gate, holderId: 'nobody-has-told-them', realmOrdinal: 0 })!;
            expect(cure.heardOf).toBe(false);
            const said = whatToSayAboutTheCure(cure);
            expect(said).not.toContain(cure.name);
            expect(said).toMatch(/nothing you can reach/i);
            // Not a hint either. A sentence that gestured at it would be the
            // engine winking, and then refusing the verdict is not something
            // the player chose to do.
            expect(said).not.toMatch(/medicine exists|there is one|somewhere out there/i);
        } finally {
            db.close();
        }
    });

    it('names it to somebody who has been told', () => {
        const { db, gate } = gateOverAFreshRun();
        try {
            const holderId = 'told-by-an-elder';
            const truth = whatWouldCloseThisWound(
                [hurt(PERMANENT.key)], 0, 10_000, HOME_REGION_ID)!;
            const row = STRUCTURAL_REPAIR_MEDICINES.find(m => m.name === truth.name)!;
            gate.learn({
                holderId,
                kind: 'thing',
                id: row.id,
                name: row.name,
                onDay: 3,
                sourceKind: 'told',
                sourceNote: 'Said once, by somebody who works far enough up to know.',
                statement: `${row.name} exists.`
            });
            const cure = whatWouldCloseThisWound(
                [hurt(PERMANENT.key)], 0, 10_000, HOME_REGION_ID, 1,
                { gate, holderId, realmOrdinal: 0 })!;
            expect(cure.heardOf).toBe(true);
            expect(whatToSayAboutTheCure(cure)).toContain(row.name);
        } finally {
            db.close();
        }
    });
});
