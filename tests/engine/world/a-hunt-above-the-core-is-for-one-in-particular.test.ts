/**
 * The hunt was still asking the catalog what was standing on the ground.
 *
 * `a-beast-climbs-by-sitting-where-it-is.ts` moves an individual up the ladder
 * over world time, and `a-beast-with-a-core-is-somebody-in-particular.ts` gives
 * it an id, a place and a name. The hunt knew about none of it:
 * `whatIsOnThisGround` filtered on the CATALOG ordinal, so a hawk minted at 17
 * that had sat on a vein for nine hundred years was still offered as a rung-17
 * encounter, fought at 17, and its core priced at what 17 yields. Every one of
 * those is the same defect, and it is the one this file pins.
 *
 * ── AND THE LINE IS THE ONE THE REPO ALREADY DRAWS ──────────────────────
 *
 * `BEAST_CORE_ORDINAL`. Below it the draw is right as it was - the design
 * owner: *"if you're hunting something without a core, SURE, whatever that's
 * standing there"*. At or above it there is ONE of them on this ledge, so it is
 * never drawn and has to be gone out after by name, and the going costs days:
 * *"you have to put in EFFORT."*
 *
 * RED-CHECKED. Dropping the `standingAt` argument fails the rung assertions;
 * putting cored species back in the draw pool fails the first; returning
 * `ordinaryHunt` from `daysToFindTheOneHere` fails the last three.
 */

import { describe, it, expect } from 'vitest';

import {
    A_PARTICULAR_ONE_IS_NOT_MET_BY_WALKING,
    beastsOnThisGround,
    daysToFindTheOneHere,
    hasACore,
    whatIsOnThisGround
} from '../../../src/engine/world/hunting-a-spirit-beast.js';
import { BEASTS } from '../../../src/data/cultivation/beasts.js';
import { MAX_ORDINAL } from '../../../src/engine/cultivation/realms.js';

const SEALED = { sealed: true, onAVein: true };
const VEIN = { sealed: false, onAVein: true };

/** The cored species that can actually stand behind a seal, for the fixtures. */
const coredHere = beastsOnThisGround(SEALED).filter(hasACore);

describe('the draw is for what has no core, and nothing else', () => {
    it('never offers one of the counted ones however the sample falls', () => {
        for (const ordinal of [0, 13, 20, 29, 40, MAX_ORDINAL]) {
            for (const sample of [0, 0.2, 0.4, 0.6, 0.8, 0.999999]) {
                const met = whatIsOnThisGround(SEALED, ordinal, sample).met;
                if (!met) continue;
                expect(hasACore(met), `${met.id} was drawn at ordinal ${ordinal}`).toBe(false);
            }
        }
    });

    it('says what is here to be gone after instead of hiding it', () => {
        // The other half of the same rule, and the reason the draw may drop
        // them: a player never told what carries a core here has no way to
        // learn there is anything to name.
        const found = whatIsOnThisGround(SEALED, MAX_ORDINAL, 0.5);
        expect(found.worthGoingAfter.length).toBeGreaterThan(0);
        for (const one of found.worthGoingAfter) expect(hasACore(one)).toBe(true);
        // And never above the hunter: that half is `above`, which prices itself.
        const low = whatIsOnThisGround(SEALED, 0, 0.5);
        expect(low.worthGoingAfter).toEqual([]);
        expect(low.above.length).toBeGreaterThan(0);
    });
});

describe('what the ground holds is the individual, not its kind', () => {
    const one = coredHere[0]!;

    it('reads a climbed one at the rung it climbed to', () => {
        const climbed = Math.min(MAX_ORDINAL, one.ordinal + 6);
        const standingAt = new Map([[one.id, climbed]]);
        const asCatalog = whatIsOnThisGround(SEALED, MAX_ORDINAL, 0.5);
        const asItIs = whatIsOnThisGround(SEALED, MAX_ORDINAL, 0.5, { standingAt });
        expect(asCatalog.worthGoingAfter.find(b => b.id === one.id)?.ordinal).toBe(one.ordinal);
        expect(asItIs.worthGoingAfter.find(b => b.id === one.id)?.ordinal).toBe(climbed);
    });

    it('puts one that has climbed past the hunter above them rather than in reach', () => {
        const standingAt = new Map([[one.id, MAX_ORDINAL]]);
        const found = whatIsOnThisGround(SEALED, one.ordinal, 0.5, { standingAt });
        expect(found.worthGoingAfter.map(b => b.id)).not.toContain(one.id);
        expect(found.above.map(b => b.id)).toContain(one.id);
        expect(found.above.find(b => b.id === one.id)?.ordinal).toBe(MAX_ORDINAL);
    });

    it('takes the one that is dead off the ground entirely', () => {
        // One ledge holds one of them - every cored row is `groupSize: 1` and
        // its id is a function of the species and the ground - so the one that
        // was here WAS the species here.
        const gone = new Set([one.id]);
        const found = whatIsOnThisGround(SEALED, MAX_ORDINAL, 0.5, { gone });
        expect(found.worthGoingAfter.map(b => b.id)).not.toContain(one.id);
        expect(found.above.map(b => b.id)).not.toContain(one.id);
    });

    it('leaves ground with no rows on it reading exactly as it did', () => {
        for (const ordinal of [5, 17, 25, 35]) {
            const bare = whatIsOnThisGround(VEIN, ordinal, 0.31);
            const empty = whatIsOnThisGround(VEIN, ordinal, 0.31, { standingAt: new Map() });
            expect(empty.met?.id).toBe(bare.met?.id);
            expect(empty.above.map(b => b.id)).toEqual(bare.above.map(b => b.id));
        }
    });
});

describe('going out after one in particular is the effort', () => {
    const one = coredHere[0]!;

    it('costs strictly more than a walk over the same ground', () => {
        const days = daysToFindTheOneHere(one, one.ordinal, 10);
        expect(days).toBeGreaterThanOrEqual(10 * A_PARTICULAR_ONE_IS_NOT_MET_BY_WALKING);
    });

    it('costs more the longer it has been sitting here unfound', () => {
        let previous = 0;
        for (const climbed of [0, 2, 4, 8]) {
            const days = daysToFindTheOneHere(
                one, Math.min(MAX_ORDINAL, one.ordinal + climbed), 10
            );
            expect(days).toBeGreaterThan(previous);
            previous = days;
        }
    });

    it('reads the species axis the catalog already authors and nothing else', () => {
        // Two species at the same rung with different abilities cost different
        // amounts to find, and the difference is `ability.kind`. Nothing new
        // says what a species is like; this is the column that already did.
        const hidden = BEASTS.filter(b => b.ability.kind === 'concealment');
        const plain = BEASTS.filter(b => b.ability.kind === 'strength');
        expect(hidden.length).toBeGreaterThan(0);
        expect(plain.length).toBeGreaterThan(0);
        expect(daysToFindTheOneHere(hidden[0]!, hidden[0]!.ordinal, 10))
            .toBeGreaterThan(daysToFindTheOneHere(plain[0]!, plain[0]!.ordinal, 10));
    });

    it('is a whole number of days at every species and every rung', () => {
        for (const beast of BEASTS.filter(hasACore)) {
            for (const climbed of [0, 3, 11]) {
                const days = daysToFindTheOneHere(
                    beast, Math.min(MAX_ORDINAL, beast.ordinal + climbed), 10
                );
                expect(Number.isInteger(days), `${beast.id} at +${climbed}`).toBe(true);
                expect(days).toBeGreaterThan(0);
            }
        }
    });
});
