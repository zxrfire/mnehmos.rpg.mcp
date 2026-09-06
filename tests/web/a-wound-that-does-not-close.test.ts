/**
 * THE WORST SILENCE IN THE STATE READ.
 *
 * `whatIsWorthDoingStandingHere` splits wounds two ways - what a mortal
 * physician could close, and what is past mortal care - and BOTH filter
 * permanent wounds out, because neither of them is something to go and do
 * anything about. Nothing else in the read mentioned them.
 *
 * So a cultivator carrying a ruined dantian and nothing else was told there
 * was nothing wrong with them. On the one fact in this game that money does
 * not answer.
 *
 * `hasPermanentWound` existed in `injuries.ts` with no caller anywhere, beside
 * two more that were also unread:
 *
 *   `isCrippledByInjuries` the THRESHOLD. Below it the wounds are a list of
 *                          problems; at it the body has stopped mending itself
 *                          and everything costs more. One condition rather than
 *                          a longer list, and it needs saying in those terms.
 *   `woundsOfNature`       body against mind. `woundNature` splits them and
 *                          nothing asked it, so a read that adds them together
 *                          points a player at the wrong physician.
 *
 * ── AND THE THREE NAMES BECAME ONE ───────────────────────────────────────
 *
 * `isCrippledByInjuries` was an alias of `isLethalInjuryState` whose entire
 * comment was *the name `isLethalInjuryState` should have*, and `survival.ts`
 * has `isBleedingOut` asking the same question of a count. The alias is gone
 * and the rename is done. The remaining two are not folded together because
 * `survival.ts` already imports `injuries.ts` and a delegation either way is a
 * cycle - what makes them safe is that neither restates the threshold. Both
 * read `CRIPPLING_UNTREATED_INJURIES` out of the schema, so there is one number
 * and no way for them to disagree, which is pinned below.
 */

import { describe, expect, it } from 'vitest';

import {
    CRIPPLING_UNTREATED_INJURIES,
    LETHAL_UNTREATED_INJURIES,
    type Injury
} from '../../src/schema/cultivation';
import {
    hasPermanentWound,
    isCrippledByInjuries,
    woundsOfNature
} from '../../src/engine/cultivation/injuries';
import { isBleedingOut } from '../../src/engine/cultivation/survival';
import { WOUND_TYPES, isPermanentWound } from '../../src/data/cultivation/wounds';
import { linesFor, whatIsWorthDoingStandingHere } from '../../src/web/what-is-worth-doing-standing-here';

/** A wound the world has no medicine for, off the catalog rather than invented. */
const PERMANENT = WOUND_TYPES.find(w => isPermanentWound(w.key))!;
/** One that closes, for the contrast. */
const MENDABLE = WOUND_TYPES.find(w => !isPermanentWound(w.key))!;

function hurt(woundType: string, treated = false): Injury {
    return {
        severity: 'moderate',
        source: 'combat',
        description: 'a wound',
        sustainedOnTurn: 1,
        treated,
        woundType
    } as unknown as Injury;
}

/** The state read with nothing wrong but what is passed in. */
function standing(over: Partial<Parameters<typeof whatIsWorthDoingStandingHere>[0]>) {
    return whatIsWorthDoingStandingHere({
        satiety: 80,
        starvationTurns: 0,
        turnsUntilStarvation: 40,
        spiritStones: 100,
        mealCost: 1,
        treatableWounds: 0,
        woundsPastMortalCare: 0,
        cure: null,
        battered: false,
        bodyHasStoppedCoping: false,
        carriesAWoundNothingCloses: false,
        woundsOfTheBody: 0,
        woundsOfTheMind: 0,
        practisesAMethod: true,
        methodExhausted: false,
        breakthroughReady: false,
        inASect: false,
        sellableGoods: 0,
        pillsCarried: 0,
        peopleAboveHere: 0,
        peopleHere: 0,
        peopleHereWithSomethingToSell: 0,
        ambient: 'thin',
        peopleHereByName: [],
        thickerGroundWithinReach: [],
        goodsOnOfferHere: [],
        roadUnderfoot: null,
        paperOnTheWall: null,
        spanCounterHere: false,
        dutiesGoing: 0,
        groundThatTeachesARoad: 0,
        brokenSeclusion: null,
        fight: null,
        sitesYouCouldOpen: [],
        groundIsUnheld: false,
        aboveTheLid: false,
        ...over
    } as Parameters<typeof whatIsWorthDoingStandingHere>[0]);
}

describe('one threshold, two arities, no way to disagree', () => {
    /**
     * The two survivors of the three names agree at every count, because
     * neither restates the number. If this ever fails, one of them has been
     * given a constant of its own.
     */
    it('answers identically however it is asked', () => {
        for (let open = 0; open <= CRIPPLING_UNTREATED_INJURIES + 2; open++) {
            const injuries = Array.from({ length: open }, () => hurt(MENDABLE.key));
            expect(isCrippledByInjuries({ injuries }), `${open} open`)
                .toBe(isBleedingOut(open));
        }
    });

    it('reads one constant under both of its names', () => {
        expect(LETHAL_UNTREATED_INJURIES).toBe(CRIPPLING_UNTREATED_INJURIES);
    });

    /** And a treated wound is not an open one, which is the whole ratchet. */
    it('counts only what is still open', () => {
        const closed = Array.from(
            { length: CRIPPLING_UNTREATED_INJURIES + 1 },
            () => hurt(MENDABLE.key, true)
        );
        expect(isCrippledByInjuries({ injuries: closed })).toBe(false);
    });
});

describe('what is torn, told apart', () => {
    it('never adds the body and the mind together', () => {
        const physical = WOUND_TYPES.filter(w => w.nature === 'physical').slice(0, 2);
        const mental = WOUND_TYPES.filter(w => w.nature === 'mental').slice(0, 1);
        expect(physical.length + mental.length, 'the catalog has only one kind').toBeGreaterThan(2);

        const injuries = [...physical, ...mental].map(w => hurt(w.key));
        expect(woundsOfNature(injuries, 'physical')).toHaveLength(physical.length);
        expect(woundsOfNature(injuries, 'mental')).toHaveLength(mental.length);
    });

    it('knows a wound nothing closes from one that does', () => {
        expect(hasPermanentWound([hurt(PERMANENT.key)])).toBe(true);
        expect(hasPermanentWound([hurt(MENDABLE.key)])).toBe(false);
        expect(hasPermanentWound([])).toBe(false);
    });
});

describe('the read', () => {
    /**
     * THE SILENCE, CLOSED. Both wound counts are zero here - which is what the
     * read actually computes for somebody whose only injury is permanent - and
     * the answer must still say something.
     */
    it('says so when the only wound is one nothing closes', () => {
        const said = linesFor(standing({ carriesAWoundNothingCloses: true })).join(' ');
        expect(said).toMatch(/does not close/i);
        expect(said).toMatch(/no medicine for it/i);
    });

    /** And says nothing about it when there is nothing to say. */
    it('is silent about permanence for a whole body', () => {
        expect(linesFor(standing({})).join(' ')).not.toMatch(/does not close/i);
    });

    /**
     * PAST THE THRESHOLD IT IS ONE CONDITION AND NOT A LONGER LIST. Handing
     * somebody whose body has stopped mending a count of wounds is the wrong
     * shape of answer.
     */
    it('names the threshold rather than counting, once the body stops coping', () => {
        const said = linesFor(standing({
            bodyHasStoppedCoping: true,
            treatableWounds: 4,
            woundsOfTheBody: 4
        })).join(' ');
        expect(said).toMatch(/stopped coping/i);
        expect(said).toMatch(/no longer mends itself/i);
        // The ordinary count line is the else-branch and must not also fire.
        expect(said).not.toMatch(/untreated wounds? that ordinary care could close/i);
    });

    /** And it says which physician, because they are two different problems. */
    it('tells a torn body from a torn mind when both are open', () => {
        const both = linesFor(standing({
            bodyHasStoppedCoping: true, woundsOfTheBody: 2, woundsOfTheMind: 1
        })).join(' ');
        expect(both).toMatch(/two different physicians/i);

        const mindOnly = linesFor(standing({
            bodyHasStoppedCoping: true, woundsOfTheBody: 0, woundsOfTheMind: 3
        })).join(' ');
        expect(mindOnly).toMatch(/not the flesh/i);
    });
});
