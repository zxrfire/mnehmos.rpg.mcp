/**
 * Where somebody the world was created already holding was born.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE BUG THIS EXISTS TO FIX
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Read off the standing register of a seeded world, every senior of every great
 * body came back the same way:
 *
 *     Fang Ronglin    Elder Holder of the House of Held Names   [born: thin_county]
 *     Qiu Xuchen      Convergence Master of the Narrow Hour     [born: thin_county]
 *     Shen Jingbo     Elder Holder of the House of Held Names   [born: thin_county]
 *
 * Measured across five worlds: 89.4% of the seniors of apex bodies were born on
 * a farm in a thin county, 10.6% in a market town, and not one person in a
 * living population of 2,538 was born into any of the three high tiers. The
 * origin distribution inside a Dao house was identical to the distribution of
 * the world at large, to within a point, at every level of standing.
 *
 * That is not a thesis about privilege arriving on its own. It is a sampling
 * error wearing one, and its cause is a single line: a person the seeder PLACES
 * into a seat had their origin drawn from {@link rollOrigin}, the birth lottery,
 * in which `dao_house_bloodline` is roughly one draw in forty-one thousand.
 *
 * That weighting is CORRECT for somebody being born during the simulation. It is
 * the reason the setting can say origin buys inputs rather than rank. It is
 * wrong for the seeded population, who are not being born at all: they already
 * exist, already hold rank, and already sit inside houses. Drawing their birth
 * blind means the roll knows nothing about the seat it is filling.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * RARE IN THE WORLD, COMMON AT THE TOP. BOTH, AT ONCE.
 * ═════════════════════════════════════════════════════════════════════════
 *
 * These two facts are not in tension and this module has to produce both:
 *
 *   P(born high)                        stays vanishingly small. The birth
 *                                       table is not touched and nobody's odds
 *                                       of being born well move by a digit.
 *
 *   P(born high | holds a seat at the   is large. A great house's seniors are
 *   top of a great house)               drawn overwhelmingly from a pool that
 *                                       is itself tiny.
 *
 * Conditional probability, not a compromise between the two. Selection is not
 * sampling: a house's intake is not a random handful of the province, it is
 * whoever was still standing after a climb that stones, a teacher and somebody
 * to stand at the crossings each make survivable. The well-born are a large
 * minority of a great house because being born well made them far likelier to
 * finish the climb - which is the same claim the ladder already makes about
 * provisioned years, and not a new one.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * IT MUST STAY A DRAW, NOT A RULE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A rule with no exceptions is an assertion. A farmer's child who reached an
 * elder's seat at a Dao house is a story this setting wants to be able to tell,
 * so it has to be UNCOMMON rather than impossible - which is what a conditioned
 * draw gives and what a hard mapping from seat to origin would not.
 *
 * Measured at an apex seat, roughly a third of the holders are still thin-county
 * born. They are the exception, they exist on every seed, and nothing anywhere
 * forbids them.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * AND IT CONFERS NOTHING
 * ═════════════════════════════════════════════════════════════════════════
 *
 * This module decides one recorded field and no other. A placed figure's realm
 * ordinal, faction, rank and holdings are what the catalog and the seeder's own
 * pyramid already made them, and are byte-identical with this module switched
 * off. Origin is a fact about where they started that is READ here, never spent:
 * nobody is at the top because they were born well, they are over-represented at
 * the top because being born well made the climb survivable.
 *
 * Pure. Deterministic. No I/O, no database, no LLM.
 */

import {
    ORIGIN_TIERS,
    BREAKTHROUGH_PILL_STONES,
    PRICE_GROWTH_PER_ORDINAL,
    type OriginTier,
    type OriginTierKey
} from '../cultivation/origin.js';

// ─────────────────────────────────────────────────────────────────────────
// HOW MUCH OF A CLIMB A BIRTH PAYS FOR
// ─────────────────────────────────────────────────────────────────────────

/**
 * How many rungs of breakthrough pills the family fortune actually covers.
 *
 * Not a new number. It is the existing price curve read backwards: a pill for
 * the crossing at ordinal N costs `BREAKTHROUGH_PILL_STONES * 1.35^N`, so a
 * holding of S stones covers the crossing at `log(S / 500) / log(1.35)` and
 * every one below it. `origin.ts` already states the answer this returns - "a
 * patriarch's fortune... thirty times the money buys about eleven more rungs" -
 * and `log(30)/log(1.35)` is 11.3, which is that sentence.
 *
 * This is the right lens on a birth precisely because it is logarithmic. A Dao
 * house's ninety thousand stones is three thousand times a farm's thirty and
 * buys seventeen rungs, not three thousand: the fortune is a real and legible
 * stretch of the road and then it is simply gone, at which point its holder is
 * buying pills out of income like everybody else.
 *
 * Zero for any birth that cannot afford the crossing at ordinal zero, which is
 * both of the two commonest tiers in the world. A farm child and a market
 * town's child are funded for none of the ladder, and they are 98% of everybody.
 */
export function rungsAFortuneFunds(spiritStones: number): number {
    if (!Number.isFinite(spiritStones) || spiritStones <= 0) return 0;
    const rungs = Math.log(spiritStones / BREAKTHROUGH_PILL_STONES)
        / Math.log(PRICE_GROWTH_PER_ORDINAL);
    return Math.max(0, rungs);
}

/**
 * How much likelier a rung somebody else paid for is to be a rung survived.
 *
 * The one calibrated constant here, and it is calibrated rather than derived
 * on purpose - the engine's own `deriveLife` is the only thing that truly knows
 * this odds ratio, and it is not invertible. What fixes the value is the shape
 * the design owner specified for a great house's intake: the well-born should be
 * a large minority of it, in the region of forty per cent, against a world where
 * the same birth is a fraction of a percent.
 *
 * `scripts/probe-what-the-seeded-population-was-born-as.ts` is the harness that
 * fixed it. At 1.85 an apex seat comes out about 43% high-born and about a third
 * thin-county born; at 1.7 the high share falls to 11% and at 2.0 it climbs to
 * 67%. The number is a statement about how steeply advantage compounds over a
 * climb, and it is a knob with a measurement attached rather than a derivation.
 *
 * It sits in the same range as the engine's own pill term - `MAX_PILL_MULTIPLIER`
 * is 1.35 for the pill alone - which is the sanity check rather than the source:
 * a funded rung buys the pill AND the teacher AND somebody standing at the
 * crossing, so an odds ratio somewhat above the pill's own is what it should be.
 */
export const SELECTION_ODDS_PER_FUNDED_RUNG = 1.85;

/**
 * How much likelier this birth is than a farm birth to be the one in this seat.
 *
 * The likelihood term of a Bayes update whose prior is the birth table. It is
 * bounded by the climb: a fortune that funds seventeen rungs is worth seventeen
 * rungs of advantage to somebody standing at ordinal forty and only three rungs
 * of it to somebody standing at ordinal three, because the rest of the money had
 * nothing yet to be spent on.
 *
 * That bound is what makes a sect's outer disciples come out as ordinary as the
 * province they were recruited from, with no rule anywhere saying they should.
 */
export function selectionLikelihood(tier: OriginTier, realmOrdinal: number): number {
    const climbed = Math.max(0, realmOrdinal);
    const funded = Math.min(rungsAFortuneFunds(tier.spiritStones), climbed);
    return Math.pow(SELECTION_ODDS_PER_FUNDED_RUNG, funded);
}

// ─────────────────────────────────────────────────────────────────────────
// THE DRAW
// ─────────────────────────────────────────────────────────────────────────

/**
 * The origin table reweighted for somebody who is already standing at this rung.
 *
 * Posterior weight is prior times likelihood, and the prior is the birth table's
 * own weight, untouched. Returned in catalog order so the result can be asserted
 * against `ORIGIN_TIERS` position by position.
 *
 * At ordinal zero every likelihood is one and this returns the birth table
 * exactly - which is the property that keeps the world's own distribution where
 * it is, because almost everybody in the world is at or near the bottom.
 */
export function originWeightsForSomebodyAtOrdinal(
    realmOrdinal: number
): { tier: OriginTier; weight: number }[] {
    return ORIGIN_TIERS.map(tier => ({
        tier,
        weight: tier.weight * selectionLikelihood(tier, realmOrdinal)
    }));
}

/**
 * Draw the birth of somebody the world already contains, at the rung they hold.
 *
 * Takes a uniform [0,1) sample rather than an RNG, matching `rollOrigin` and
 * `rollSpiritRoot`: the caller owns seeding, always.
 *
 * THIS IS NOT A REPLACEMENT FOR `rollOrigin` AND MUST NEVER BECOME ONE. Anybody
 * being BORN - in play, or in the seeder's own derived provincial population,
 * where the origin comes first and the ladder then spends it - draws from the
 * birth table. Reaching for this function there would invert the causality and
 * quietly move the world's marginal distribution, which is the one number this
 * whole change is not allowed to touch.
 */
export function drawOriginForSomebodyAlreadyAtOrdinal(
    sample: number,
    realmOrdinal: number
): OriginTier {
    const rows = originWeightsForSomebodyAtOrdinal(realmOrdinal);
    const total = rows.reduce((sum, r) => sum + r.weight, 0);
    if (!(total > 0)) return ORIGIN_TIERS[0];

    const clamped = Math.max(0, Math.min(0.999999999, sample));
    let cursor = clamped * total;
    for (const row of rows) {
        cursor -= row.weight;
        if (cursor < 0) return row.tier;
    }
    // Float drift at the very top of the range; the last row is correct.
    return rows[rows.length - 1].tier;
}

/** Share of people at this rung who were born into each tier, for reporting. */
export function originSharesAtOrdinal(realmOrdinal: number): Map<OriginTierKey, number> {
    const rows = originWeightsForSomebodyAtOrdinal(realmOrdinal);
    const total = rows.reduce((sum, r) => sum + r.weight, 0);
    const out = new Map<OriginTierKey, number>();
    for (const row of rows) out.set(row.tier.key, total > 0 ? row.weight / total : 0);
    return out;
}
