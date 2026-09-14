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
 *   5. What answers it is structural repair medicine, by RANK, out of reach in
 *      the way this world expresses out of reach - and nothing on the graded
 *      treat-injury ladder ever reaches a permanent wound. This claim used to
 *      read "there is one medicine for it, it is craftable, and it names this
 *      wound", which was a bespoke pill written on a premise the design owner
 *      has since overruled. See the block's own header.
 *
 * Red-checked: flipping `theBodyPutsItBack` to true for every part fails (1)
 * and (3); putting the share thresholds back in charge of permanence fails
 * (1); making `repairRefusalReason` demand a named `mends` again fails (5).
 */

import { describe, it, expect } from 'vitest';

import { BEASTS, type Beast } from '../../../src/data/cultivation/beasts';
import {
    whatGivingItCosts,
    whatItCouldPartWith
} from '../../../src/engine/world/what-it-costs-to-give-away-a-piece-of-yourself';
import { REGROWTH_YEARS_BY_GRADE } from '../../../src/engine/world/what-a-place-still-has-in-the-ground';
import { isPermanentWound, WOUND_TYPES } from '../../../src/data/cultivation/wounds';
import { PILLS } from '../../../src/data/cultivation/pills';
import {
    anIndividualCouldPay,
    cheapestMedicineFor,
    NOTHING_REPAIRS_ABOVE_ORDINAL,
    repairWeightInStones,
    theRungsThatRepairAPermanentInjury
} from '../../../src/engine/cultivation/what-structural-repair-medicine-can-reach';
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

/**
 * WHAT ANSWERS IT, AND THE PREMISE THAT WAS OVERTURNED UNDER THIS BLOCK.
 *
 * This block used to pin a bespoke pill - one medicine that NAMED `severed-
 * flesh` and reached nothing else - written because `repairRefusalReason` said
 * in as many words that structural repair medicine mends a structure that did
 * not set at a realm wall and refuses everything else. The design owner
 * overruled that premise rather than the reading of it: **a dose repairs every
 * permanent injury at its rank.** So the pill went, and what a maiming is
 * answered by is the road every permanent injury is answered by.
 *
 * What survives from the old block is the claim worth keeping: a part that is
 * gone is not handed to the graded treat-injury ladder, and the thing that does
 * answer it is out of reach in the way this world expresses out of reach.
 */
describe('what answers a part that is gone', () => {
    const AT = 10;
    const MEDICINE = cheapestMedicineFor('severed-flesh', AT);

    it('is structural repair medicine, at the rung the body is standing on', () => {
        expect(MEDICINE, 'nothing in the world answers a maiming').not.toBeNull();
        // Rank and not the named break: this wound is on no rung's `mends`
        // list, and that is the whole of what the ruling changed.
        expect(MEDICINE!.mends).not.toContain('severed-flesh');
        expect(AT).toBeLessThanOrEqual(MEDICINE!.reachesUpToOrdinal);
        // And a bigger body wants a bigger dose.
        const higher = cheapestMedicineFor('severed-flesh', MEDICINE!.reachesUpToOrdinal + 1);
        expect(higher?.id, 'the same dose answered a body past its reach').not.toBe(MEDICINE!.id);
    });

    it('is out of reach in the way this world expresses out of reach', () => {
        // Counted in single digits, held by named bodies, and worth more than
        // everything the patient will ever accumulate.
        expect(repairWeightInStones(MEDICINE!)).toBeGreaterThan(0);
        expect(anIndividualCouldPay(MEDICINE!, AT),
            'a maiming is answered by something an individual could save up for').toBe(false);
    });

    it('leaves nothing on the graded treat-injury ladder claiming to reach a permanent wound', () => {
        // THE GUARD. The graded line is severity against the body carrying it
        // and it must never reach a permanent injury, or a medicine for a
        // missing arm reaches a rooted heart demon on the same band. Rank is
        // the axis for what does not close; severity is the axis for what does.
        for (const pill of PILLS) {
            if (pill.effect !== 'treat_injury') continue;
            expect(pill.mends ?? [], `${pill.id} names a wound on the graded ladder`).toEqual([]);
        }
    });

    it('has one rung above the rank ladder, and it does not let the taker choose', () => {
        const anyRank = theRungsThatRepairAPermanentInjury()
            .filter(rung => rung.reachesUpToOrdinal === null);
        expect(anyRank.length, 'the chaos rung is missing or doubled').toBe(1);
        expect(anyRank[0]!.choosesTheWound).toBe(false);
        expect(cheapestMedicineFor('severed-flesh', NOTHING_REPAIRS_ABOVE_ORDINAL + 1),
            'the rank ladder reached past its own ceiling').toBeNull();
    });
});
