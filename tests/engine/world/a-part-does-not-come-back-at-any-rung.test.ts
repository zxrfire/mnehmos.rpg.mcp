/**
 * WHAT COMES BACK AND WHAT DOES NOT ARE TWO QUESTIONS, AND ONE NUMBER WAS
 * ANSWERING BOTH.
 *
 * `whatGivingItCosts` priced a piece of a body as a share of the giver's
 * remaining span - years off `REGROWTH_YEARS_BY_GRADE` over
 * `lifespanForOrdinal` - and used that one figure for severity AND for
 * permanence: above a quarter of a span the wound was permanent, below it the
 * wound healed.
 *
 * Measured against the catalog, that made permanence a fact about the giver's
 * rung and nothing else:
 *
 *   mortal grade      1 year against a 100-year span at the bottom of the
 *                     ladder. One percent. A scratch, wherever it is standing.
 *   heaven grade      150 years against 5,000 at ordinal 29. Three percent.
 *   immortal grade    3,000 against 5,000. Sixty percent, and the ONLY band
 *                     that ever crossed the maiming threshold.
 *
 * So nothing below the immortal band could be maimed by this act at all, and a
 * Qi Condensation creature could hand over an eye and be told it would be back
 * inside the year. The ruling is that a permanent wound happens at any realm,
 * and that fur and a shell come back slowly while a limb does not come back at
 * all.
 *
 * What this file pins:
 *
 *   1. Permanence is read off the PART and does not move with the band. The
 *      same creature at ordinal 0 and at ordinal 40 loses the same thing
 *      permanently.
 *   2. A covering still costs years off the SHARED ladder, and what those
 *      years mean still moves with the span - the dial survives for the half
 *      it was right about.
 *   3. A piece that does not come back has no number of years. `null`, not a
 *      very large number, because a large number is a thing somebody could
 *      wait out.
 *   4. The wound is the flesh family out of `wounds.ts`, not the channel
 *      family it used to borrow.
 *   5. There is one medicine for it, it is craftable, it is past the cash
 *      line, and it reaches nothing else the catalog authored as untreatable.
 *
 * Red-checked: flipping `theBodyPutsItBack` to true for every part fails (1)
 * and (3); putting the share thresholds back in charge of permanence fails
 * (1); dropping `mends` off the pill fails (5).
 */

import { describe, it, expect } from 'vitest';

import { BEASTS, type Beast } from '../../../src/data/cultivation/beasts';
import {
    whatGivingItCosts,
    whatItCouldPartWith
} from '../../../src/engine/world/what-it-costs-to-give-away-a-piece-of-yourself';
import { REGROWTH_YEARS_BY_GRADE } from '../../../src/engine/world/what-a-place-still-has-in-the-ground';
import { isPermanentWound, WOUND_TYPES } from '../../../src/data/cultivation/wounds';
import { pillThatMends } from '../../../src/data/cultivation/pills';
import { RECIPES } from '../../../src/data/cultivation/recipes';
import { pillCashPrice, cashRefusalReason } from '../../../src/engine/cultivation/buying-and-bartering-pills';
import { MAX_ORDINAL } from '../../../src/engine/cultivation/realms';

/** Every rung the ladder runs, sampled at its three heights and its ends. */
const EVERY_BAND = [0, 6, 12, 20, 28, 36, MAX_ORDINAL];

function costOf(beast: Beast, seenBy: readonly string[] = []) {
    const piece = whatItCouldPartWith(beast)[0];
    return {
        piece,
        cost: whatGivingItCosts({
            beast,
            piece,
            subjectId: `${beast.id}-here`,
            turn: 1,
            onDay: 1,
            seenBy
        })
    };
}

/**
 * A creature whose piece the body remakes, and one whose piece it does not.
 *
 * Read out of the catalog rather than fabricated: any beast the catalog gives
 * no non-core material is one that mints, and the ability axis is what decides
 * which part it mints. If either side of this comes back empty the catalog has
 * lost a whole kind of creature and that is the finding.
 */
function aGiverWhose(comesBack: boolean): Beast {
    const found = BEASTS.find(beast => whatItCouldPartWith(beast)[0].theBodyPutsItBack === comesBack);
    expect(found, `no beast in the catalog parts with something that ${comesBack ? 'does' : 'does not'} come back`)
        .toBeTruthy();
    return found!;
}

describe('a part that is gone is gone at every rung', () => {
    it('does not change its mind about permanence as the giver climbs', () => {
        const base = aGiverWhose(false);
        for (const ordinal of EVERY_BAND) {
            const { cost } = costOf({ ...base, ordinal });
            expect(cost.doesNotComeBack, `a part came back at ordinal ${ordinal}`).toBe(true);
            expect(cost.growsBackInYears, `a part was given a regrowth figure at ordinal ${ordinal}`)
                .toBeNull();
            expect(cost.shareOfTheirSpan, `a share was computed for a thing with no years`)
                .toBeNull();
        }
    });

    it('is a maiming rather than a scratch, at the bottom of the ladder as much as the top', () => {
        const base = aGiverWhose(false);
        for (const ordinal of [0, MAX_ORDINAL]) {
            const { cost } = costOf({ ...base, ordinal });
            expect(cost.wound.severity, `a part cost only ${cost.wound.severity} at ordinal ${ordinal}`)
                .toBe('crippling');
        }
    });

    it('mints the flesh family and not the channel family it used to borrow', () => {
        const gone = costOf(aGiverWhose(false)).cost.wound.woundType!;
        const kept = costOf(aGiverWhose(true)).cost.wound.woundType!;
        for (const key of [gone, kept]) {
            expect(WOUND_TYPES.some(w => w.key === key), `${key} is not a row in wounds.ts`).toBe(true);
            expect(key, 'a piece of flesh was recorded as a meridian injury')
                .not.toContain('meridian');
        }
        expect(isPermanentWound(gone)).toBe(true);
        expect(isPermanentWound(kept)).toBe(false);
    });
});

describe('a covering comes back, and the span still says what that costs', () => {
    it('states the years off the shared ladder rather than a figure of its own', () => {
        const base = aGiverWhose(true);
        const { piece, cost } = costOf(base);
        expect(cost.growsBackInYears).toBe(REGROWTH_YEARS_BY_GRADE[piece.material.grade]);
        expect(cost.doesNotComeBack).toBe(false);
    });

    it('costs a short-lived giver more than a long-lived one for the same covering', () => {
        // The half the old dial was right about, and it survives untouched:
        // how long a covering takes is a fact about the material, and what that
        // length MEANS is a fact about who is waiting.
        const base = aGiverWhose(true);
        const young = costOf({ ...base, ordinal: 0 }).cost;
        const old = costOf({ ...base, ordinal: MAX_ORDINAL }).cost;
        expect(young.shareOfTheirSpan!).toBeGreaterThan(old.shareOfTheirSpan!);
    });
});

describe('the medicine, and the wounds it must not reach', () => {
    const MEDICINE = pillThatMends('severed-flesh');

    it('exists, and is the only thing that names this wound', () => {
        expect(MEDICINE, 'nothing in the catalog grows a part back').not.toBeNull();
        expect(MEDICINE!.effect, 'a permanent wound was handed to the graded treat-injury ladder')
            .toBe('mends_what_will_not_close');
    });

    it('is expensive in the way this world expresses expensive', () => {
        // Past the cash line, which is the counted/tracked line and the
        // barter line at once. A counter names no figure and says why.
        expect(pillCashPrice(MEDICINE!), 'a counter quoted a price for it').toBeNull();
        expect(cashRefusalReason(MEDICINE!), 'no sentence for a counter that will not quote')
            .not.toBeNull();
    });

    it('is craftable, so the supply is not a fixed and falling count', () => {
        const recipe = RECIPES.find(r => r.producesPillId === MEDICINE!.id);
        expect(recipe, 'the only medicine for a maiming has no formula').toBeTruthy();
        expect(recipe!.ingredients.length).toBeGreaterThan(0);
    });

    it('answers a permanent wound only where a medicine is NAMED for that wound', () => {
        // THE GUARD, AND WHY IT MOVED BY ONE.
        //
        // A rooted heart demon and a burnt span say in their own rows that
        // nothing answers them, and they mean it: a medicine that quietly
        // reached one would be rewriting a ruling nobody asked about. That
        // still holds and is the assertion below.
        //
        // A parted meridian is the exception, and it was the catalog's
        // exception before it was anybody's decision: `pill-severed-meridian-
        // restoration` has existed at immortal grade saying it "reverses damage
        // that every lesser medicine calls permanent", while being a
        // `treat_injury` row, which is graded by severity and skips permanent
        // wounds - so a pill named for a severed meridian could never touch
        // one. The row and the resolver disagreed and the row was not the part
        // that was wrong. The wound's own "nothing" is what physicians say, and
        // physicians are not the world.
        //
        // What keeps this from being a slope: the medicine has to NAME the
        // wound. Nothing reaches a permanent wound on a severity band, ever.
        const answered = WOUND_TYPES
            .filter(w => w.permanent)
            .filter(w => pillThatMends(w.key) !== null)
            .map(w => w.key)
            .sort();
        expect(answered).toEqual(['severed-flesh', 'severed-meridian']);

        // And every one of them is answered by a row that says which wound it
        // is for, rather than by the graded ladder.
        for (const key of answered) {
            expect([key, pillThatMends(key)!.effect])
                .toEqual([key, 'mends_what_will_not_close']);
        }
    });
});
