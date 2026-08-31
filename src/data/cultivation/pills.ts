/**
 * Alchemy - the pill catalog.
 *
 * Pills are the only reliable way to undo damage in this game, and the reason
 * a run's economy exists. Every entry satisfies `PillSchema`.
 *
 * POTENCY UNITS
 * -------------
 * `potency` is deliberately effect-relative; `POTENCY_UNITS` below is the
 * authoritative statement of what the number means per effect, so the engine
 * and the runtime agent never have to guess:
 *
 *   heal_hp            → HP restored
 *   restore_qi         → qi restored
 *   treat_injury       → number of injuries marked treated, worst first
 *   boost_breakthrough → flat addition to breakthrough probability (0..1)
 *   advance_progress   → cultivation progress in qi-units
 *   extend_lifespan    → years added to the lifespan ceiling
 *   sate_hunger        → satiety points restored (max is SATIETY_MAX = 100)
 *   grain_abstinence   → days during which hunger stops accruing at all
 *   cleanse_deviation  → severity levels of qi deviation cleared
 *
 * BALANCE
 * -------
 * Grade drives value and toxicity together. A higher-grade pill is strictly
 * more expensive (disjoint, ascending value bands) and may be strictly more
 * poisonous (rising toxicity ceilings), so spamming heaven-grade medicine at
 * Foundation Establishment is a way to die of the cure. Within a grade, the
 * pills that touch progression - breakthrough odds, cultivation progress,
 * lifespan - sit at the top of both the value and toxicity ranges, because
 * buying advancement should always cost more than buying survival.
 *
 * THE TWO THE GAME NAMES DIRECTLY
 * -------------------------------
 * `MINOR_HEALING_PILL_ID` is in every starting inventory: one pill, twelve HP,
 * and then the player is on their own.
 *
 * `GRAIN_ABSTINENCE_PILL_ID` is the answer to the hunger logistics problem -
 * ten years without eating - and it is priced at the very top of heaven grade
 * on purpose. Acquiring it is a mid-game goal, not a shopping trip: nine
 * thousand spirit stones is three hundred times the starting purse.
 */

import type { Pill, PillEffect, TechniqueGrade } from '../../schema/cultivation.js';
import type { Band } from './techniques.js';

/** Human-readable unit for each effect's `potency`. Also asserted in tests. */
export const POTENCY_UNITS: Record<PillEffect, string> = {
    heal_hp: 'hp',
    restore_qi: 'qi',
    treat_injury: 'injuries treated',
    boost_breakthrough: 'flat probability',
    advance_progress: 'cultivation progress (qi-units)',
    extend_lifespan: 'years',
    sate_hunger: 'satiety points',
    grain_abstinence: 'days without hunger',
    cleanse_deviation: 'deviation severity levels'
} as const;

/** Spirit-stone value window per grade. Disjoint and ascending. */
export const PILL_VALUE_BANDS: Record<TechniqueGrade, Band> = {
    mortal: { min: 5, max: 99 },
    earth: { min: 100, max: 999 },
    heaven: { min: 1_000, max: 9_999 },
    immortal: { min: 10_000, max: 99_999 },
    chaos: { min: 100_000, max: 1_000_000 }
} as const;

/** Most toxic a pill of each grade may be. Strictly rising. */
export const PILL_TOXICITY_CEILING: Record<TechniqueGrade, number> = {
    mortal: 1.5,
    earth: 4,
    heaven: 9,
    immortal: 18,
    chaos: 40
} as const;

/** Every run starts holding exactly one of these. */
export const MINOR_HEALING_PILL_ID = 'pill-minor-healing';

/** The hunger problem's real solution, and a genuine mid-game objective. */
export const GRAIN_ABSTINENCE_PILL_ID = 'pill-grain-abstinence';

/**
 * Days of grain abstinence granted by the immortal-grade pill. Long enough
 * relative to any realistic run that the engine may treat it as permanent.
 */
export const PERPETUAL_GRAIN_ABSTINENCE_DAYS = 36_500;

export const PILLS: readonly Pill[] = [
    // ═══════════════════════════════════════════════════════════════════
    // MORTAL - what a Qi Condensation cultivator can actually afford
    // ═══════════════════════════════════════════════════════════════════
    {
        id: MINOR_HEALING_PILL_ID,
        name: 'Minor Healing Pill',
        grade: 'mortal',
        effect: 'heal_hp',
        potency: 12,
        toxicity: 0.1,
        value: 20,
        description:
            'A brown lozenge the size of a fingernail, smelling of blood millet and dust. One is pressed into every new disciple\'s hand along with the advice that it will not be enough, which is correct.'
    },
    {
        id: 'pill-blood-replenishing',
        name: 'Blood-Replenishing Pill',
        grade: 'mortal',
        effect: 'heal_hp',
        potency: 24,
        toxicity: 0.2,
        value: 35,
        description:
            'Made from blood millet and crimson marrow, and it tastes like both. Standard issue for sect patrols who expect to be bleeding by evening.'
    },
    {
        id: 'pill-qi-gathering',
        name: 'Qi-Gathering Pill',
        grade: 'mortal',
        effect: 'restore_qi',
        potency: 15,
        toxicity: 0.1,
        value: 18,
        description:
            'Refined qi grass, pressed. Returns roughly what one hour of meditation would, in the time it takes to swallow, which is the entire commercial proposition.'
    },
    {
        id: 'pill-hunger-quelling',
        name: 'Hunger-Quelling Pill',
        grade: 'mortal',
        effect: 'sate_hunger',
        potency: 40,
        toxicity: 0.1,
        value: 12,
        description:
            'Compressed cloudcap mushroom. Sits in the stomach like a stone and stops it complaining. Cheaper than a meal, and nobody eats one who has the choice.'
    },
    {
        id: 'pill-dust-clearing',
        name: 'Dust-Clearing Pill',
        grade: 'mortal',
        effect: 'cleanse_deviation',
        potency: 1,
        toxicity: 0.2,
        value: 50,
        description:
            'Taken at the first sign that circulating qi has begun to run the wrong way. Effective only while the deviation is still mild, which is a window most cultivators notice in hindsight.'
    },
    {
        id: 'pill-clear-meridian',
        name: 'Clear Meridian Pill',
        grade: 'mortal',
        effect: 'treat_injury',
        potency: 1,
        toxicity: 0.3,
        value: 60,
        description:
            'Treats one torn meridian, worst first. Three untreated injuries is a death sentence, so this pill is priced by people who understand arithmetic.'
    },
    {
        id: 'pill-spirit-dew',
        name: 'Spirit Dew Pill',
        grade: 'mortal',
        effect: 'advance_progress',
        potency: 60,
        toxicity: 0.5,
        value: 70,
        description:
            'Condensed morning-dew orchid. Worth about a fortnight of honest cultivation, and every alchemist has met someone who tried to live on them.'
    },
    {
        id: 'pill-foundation-guiding',
        name: 'Foundation-Guiding Pill',
        grade: 'mortal',
        effect: 'boost_breakthrough',
        potency: 0.05,
        toxicity: 0.4,
        value: 75,
        description:
            'Taken in the hour before an attempt. Five points of probability, which does not sound like much until you have watched the alternative.'
    },
    {
        id: 'pill-decade-lengthening',
        name: 'Decade-Lengthening Pill',
        grade: 'mortal',
        effect: 'extend_lifespan',
        potency: 5,
        toxicity: 0.6,
        value: 80,
        description:
            'Five more years, bought with thousand-day root. Mortals ruin families for these. Cultivators past Foundation Establishment consider them a rounding error.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // EARTH - Foundation Establishment and Core Formation
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'pill-jade-mending',
        name: 'Jade Mending Pill',
        grade: 'earth',
        effect: 'heal_hp',
        potency: 60,
        toxicity: 0.6,
        value: 160,
        description:
            'Pale green, cool on the tongue, and closes wounds in the time it takes to sit down. The standard field medicine of every sect that can afford a standard.'
    },
    {
        id: 'pill-azure-qi-return',
        name: 'Azure Qi-Return Pill',
        grade: 'earth',
        effect: 'restore_qi',
        potency: 90,
        toxicity: 0.5,
        value: 140,
        description:
            'Returns most of a Foundation cultivator\'s pool at once. Duellists carry two and are known by the blue stain it leaves at the corner of the mouth.'
    },
    {
        id: 'pill-lean-month-fasting',
        name: 'Lean-Month Fasting Pill',
        grade: 'earth',
        effect: 'sate_hunger',
        potency: 100,
        toxicity: 0.3,
        value: 100,
        description:
            'Fills the belly completely and keeps it that way through a full journey. Caravan guards buy them by the jar and complain about the price the whole way.'
    },
    {
        id: 'pill-heart-settling',
        name: 'Heart-Settling Pill',
        grade: 'earth',
        effect: 'cleanse_deviation',
        potency: 2,
        toxicity: 1.0,
        value: 380,
        description:
            'Pulls qi that has begun to circulate backwards into line, at the cost of a day spent unable to stand. Cheaper than a deviation and far cheaper than a cripple.'
    },
    {
        id: 'pill-marrow-washing',
        name: 'Marrow-Washing Pill',
        grade: 'earth',
        effect: 'treat_injury',
        potency: 2,
        toxicity: 1.2,
        value: 420,
        description:
            'Flushes two torn meridians clean and rebuilds the walls from crimson marrow fungus. The process is conducted entirely inside the patient, who is awake for it.'
    },
    {
        id: 'pill-thousand-day-condensation',
        name: 'Thousand-Day Condensation Pill',
        grade: 'earth',
        effect: 'advance_progress',
        potency: 400,
        toxicity: 1.8,
        value: 500,
        description:
            'Roughly three years of diligent cultivation, folded into a pill the size of a plum stone. The body still has to be able to take three years at once.'
    },
    {
        id: 'pill-golden-core-guiding',
        name: 'Golden Core Guiding Pill',
        grade: 'earth',
        effect: 'boost_breakthrough',
        potency: 0.12,
        toxicity: 1.5,
        value: 650,
        description:
            'Taken at the Foundation-to-Core bottleneck, where base odds are cruel and twelve points of probability is the difference between a sect elder and a story.'
    },
    {
        id: 'pill-two-decade-longevity',
        name: 'Two-Decade Longevity Pill',
        grade: 'earth',
        effect: 'extend_lifespan',
        potency: 20,
        toxicity: 2.2,
        value: 900,
        description:
            'Twenty years, at a toxicity that means the second one is worth appreciably less than the first and the third may be worth nothing at all.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // HEAVEN - Nascent Soul and Deity Transformation
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'pill-boundless-source',
        name: 'Boundless Source Pill',
        grade: 'heaven',
        effect: 'restore_qi',
        potency: 400,
        toxicity: 2.0,
        value: 1_800,
        description:
            'Refined from purple cloud fruit gathered above the weather. Fills a Nascent Soul pool from empty, once, and then the alchemist wants another fruit.'
    },
    {
        id: 'pill-nine-turn-restoration',
        name: 'Nine-Turn Restoration Pill',
        grade: 'heaven',
        effect: 'heal_hp',
        potency: 300,
        toxicity: 2.5,
        value: 2_200,
        description:
            'Nine refinement passes, each one of which the cauldron may fail. Closes wounds that should have been fatal and leaves a faint gold sheen under the new skin.'
    },
    {
        id: 'pill-still-heart-nectar',
        name: 'Still-Heart Nectar Pill',
        grade: 'heaven',
        effect: 'cleanse_deviation',
        potency: 3,
        toxicity: 3.5,
        value: 4_000,
        description:
            'Reaches a deviation that has already taken hold and argues it back out. Sects keep exactly as many of these as they have elders they cannot afford to lose.'
    },
    {
        id: 'pill-meridian-rebirth',
        name: 'Meridian Rebirth Pill',
        grade: 'heaven',
        effect: 'treat_injury',
        potency: 3,
        toxicity: 4.0,
        value: 5_200,
        description:
            'Regrows torn channels rather than patching them, using nine-leaf soul grass as the template. The only medicine below immortal grade that touches crippling damage.'
    },
    {
        id: 'pill-condensed-decade',
        name: 'Condensed Decade Pill',
        grade: 'heaven',
        effect: 'advance_progress',
        potency: 2_500,
        toxicity: 5.5,
        value: 6_000,
        description:
            'A decade of accumulation, delivered in one afternoon of extremely unpleasant circulation. Sect core disciples are given one and watched carefully afterwards.'
    },
    {
        id: 'pill-nascent-soul-guiding',
        name: 'Nascent Soul Guiding Pill',
        grade: 'heaven',
        effect: 'boost_breakthrough',
        potency: 0.2,
        toxicity: 5.0,
        value: 7_500,
        description:
            'Twenty points of probability at the realm boundary where most promising cultivators stop existing. Priced accordingly, and still considered a bargain by the ones who survive.'
    },
    {
        id: 'pill-century-lotus',
        name: 'Century Lotus Pill',
        grade: 'heaven',
        effect: 'extend_lifespan',
        potency: 100,
        toxicity: 6.5,
        value: 8_800,
        description:
            'A century, distilled from the glacial heart flower. Bought almost exclusively by cultivators who have run out of realm and are running out of time.'
    },
    {
        id: GRAIN_ABSTINENCE_PILL_ID,
        name: 'Grain Abstinence Pill',
        grade: 'heaven',
        effect: 'grain_abstinence',
        potency: 3_650,
        toxicity: 1.0,
        value: 9_000,
        description:
            'Ten years without a single meal. The body stops asking, the mouth stops mattering, and the cultivator stops carrying food, stops needing towns, and stops being interruptible. Every cultivator who has ever had to walk back down a mountain for rice knows exactly what this pill is worth, which is why it costs what it costs.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // IMMORTAL - Void Refinement and Body Integration
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'pill-void-source-return',
        name: 'Void Source Return Pill',
        grade: 'immortal',
        effect: 'restore_qi',
        potency: 1_600,
        toxicity: 6.0,
        value: 15_000,
        description:
            'Draws on the emptiness a Void Refinement cultivator has learned to breathe. The pill contains almost nothing, at enormous expense.'
    },
    {
        id: 'pill-undying-flesh',
        name: 'Undying Flesh Pill',
        grade: 'immortal',
        effect: 'heal_hp',
        potency: 1_200,
        toxicity: 7.0,
        value: 18_000,
        description:
            'Rebuilds a body from whatever fraction of it is still present and willing. Refined with immortal cypress heartwood, of which there is a fixed and dwindling amount.'
    },
    {
        id: 'pill-clear-mind-of-the-hollow-sky',
        name: 'Clear Mind of the Hollow Sky Pill',
        grade: 'immortal',
        effect: 'cleanse_deviation',
        potency: 5,
        toxicity: 9.0,
        value: 36_000,
        description:
            'Empties the mind of the deviation and, for some days afterwards, of most other things. Practitioners are attended during the recovery by someone they trust absolutely.'
    },
    {
        id: 'pill-severed-meridian-restoration',
        name: 'Severed Meridian Restoration Pill',
        grade: 'immortal',
        effect: 'treat_injury',
        potency: 5,
        toxicity: 10.0,
        value: 42_000,
        description:
            'Reverses damage that every lesser medicine calls permanent, using soulreturn dew that condenses only where someone very strong died very badly. The supply chain is exactly as grim as it sounds.'
    },
    {
        id: 'pill-condensed-century',
        name: 'Condensed Century Pill',
        grade: 'immortal',
        effect: 'advance_progress',
        potency: 20_000,
        toxicity: 13.0,
        value: 55_000,
        description:
            'A hundred years of accumulation. Bodies that cannot hold it burst, and the alchemists who sell it are careful to say so in writing beforehand.'
    },
    {
        id: 'pill-void-refinement-guiding',
        name: 'Void Refinement Guiding Pill',
        grade: 'immortal',
        effect: 'boost_breakthrough',
        potency: 0.25,
        toxicity: 12.0,
        value: 60_000,
        description:
            'Twenty-five points at the boundary into Void Refinement. Fewer than a hundred are believed to exist, and their owners are all known to each other.'
    },
    {
        id: 'pill-thousand-year-cypress',
        name: 'Thousand-Year Cypress Pill',
        grade: 'immortal',
        effect: 'extend_lifespan',
        potency: 500,
        toxicity: 15.0,
        value: 88_000,
        description:
            'Five hundred years, taken from a tree that will not miss them and paid for by someone who will. The toxicity is the tree\'s opinion of the transaction.'
    },
    {
        id: 'pill-perpetual-grain-abstinence',
        name: 'Perpetual Grain Abstinence Pill',
        grade: 'immortal',
        effect: 'grain_abstinence',
        potency: PERPETUAL_GRAIN_ABSTINENCE_DAYS,
        toxicity: 4.0,
        value: 90_000,
        description:
            'The full form of the art: hunger does not return, on any horizon a mortal-born cultivator will meet. Refined from the jade pool spring lotus, which means the price includes killing a spring.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // CHAOS - Grand Ascension and the tribulation
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'pill-primordial-qi-source',
        name: 'Primordial Qi Source Pill',
        grade: 'chaos',
        effect: 'restore_qi',
        potency: 8_000,
        toxicity: 16.0,
        value: 180_000,
        description:
            'Refined from an origin qi crystal lotus, which forms once per exhausted spirit vein. Every one of these represents a region that will not recover.'
    },
    {
        id: 'pill-kalpa-surviving',
        name: 'Kalpa-Surviving Pill',
        grade: 'chaos',
        effect: 'heal_hp',
        potency: 6_000,
        toxicity: 18.0,
        value: 200_000,
        description:
            'Kept in the sleeve during a tribulation and swallowed between strikes. The heavens have not yet objected to this practice in any way that could be written down.'
    },
    {
        id: 'pill-soul-returning-clarity',
        name: 'Soul-Returning Clarity Pill',
        grade: 'chaos',
        effect: 'cleanse_deviation',
        potency: 9,
        toxicity: 22.0,
        value: 400_000,
        description:
            'Reverses a deviation that has already rewritten who the cultivator is. The person who wakes afterwards agrees, mostly, that they are the same person.'
    },
    {
        id: 'pill-heaven-mending',
        name: 'Heaven-Mending Pill',
        grade: 'chaos',
        effect: 'treat_injury',
        potency: 9,
        toxicity: 25.0,
        value: 480_000,
        description:
            'Treats every injury a body is carrying, including the ones it has stopped registering. Two are known to have been refined; one was used, and its user is still walking.'
    },
    {
        id: 'pill-millennium-condensation',
        name: 'Millennium Condensation Pill',
        grade: 'chaos',
        effect: 'advance_progress',
        potency: 150_000,
        toxicity: 32.0,
        value: 700_000,
        description:
            'A thousand years. Nothing below Grand Ascension survives taking it, and the survival of anything above is a matter of record rather than of expectation.'
    },
    {
        id: 'pill-tribulation-guiding',
        name: 'Tribulation Guiding Pill',
        grade: 'chaos',
        effect: 'boost_breakthrough',
        potency: 0.35,
        toxicity: 30.0,
        value: 750_000,
        description:
            'Thirty-five points of probability against the heavenly tribulation itself. There is no more valuable object in the mortal world, and its price is set by the only market that has ever mattered.'
    },
    {
        id: 'pill-immortal-longevity',
        name: 'Immortal Longevity Pill',
        grade: 'chaos',
        effect: 'extend_lifespan',
        potency: 3_000,
        toxicity: 35.0,
        value: 880_000,
        description:
            'Three thousand years, refined with a chaos seed, at a toxicity that has killed the recipient outright on at least one recorded occasion. It is still bought.'
    }
] as const;

// ─────────────────────────────────────────────────────────────────────────
// INDICES + LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

const PILL_BY_ID: ReadonlyMap<string, Pill> = new Map(PILLS.map(p => [p.id, p]));

const PILLS_BY_EFFECT: ReadonlyMap<PillEffect, readonly Pill[]> = (() => {
    const map = new Map<PillEffect, Pill[]>();
    for (const p of PILLS) {
        const bucket = map.get(p.effect);
        if (bucket) bucket.push(p);
        else map.set(p.effect, [p]);
    }
    return map;
})();

const PILLS_BY_GRADE: ReadonlyMap<TechniqueGrade, readonly Pill[]> = (() => {
    const map = new Map<TechniqueGrade, Pill[]>();
    for (const p of PILLS) {
        const bucket = map.get(p.grade);
        if (bucket) bucket.push(p);
        else map.set(p.grade, [p]);
    }
    return map;
})();

export function getPill(id: string): Pill | undefined {
    return PILL_BY_ID.get(id);
}

export function requirePill(id: string): Pill {
    const p = PILL_BY_ID.get(id);
    if (!p) throw new Error(`Unknown pill: ${id}`);
    return p;
}

export function getPillsByEffect(effect: PillEffect): readonly Pill[] {
    return PILLS_BY_EFFECT.get(effect) ?? [];
}

export function getPillsByGrade(grade: TechniqueGrade): readonly Pill[] {
    return PILLS_BY_GRADE.get(grade) ?? [];
}

/** The pill every run begins with. */
export function getStartingPill(): Pill {
    return requirePill(MINOR_HEALING_PILL_ID);
}

/**
 * Weakest pill of the requested effect whose potency meets `atLeast`. This is
 * how a shop or an NPC healer should pick what to hand over: the cheapest thing
 * that solves the problem, not the most impressive thing on the shelf.
 */
export function findCheapestPillFor(effect: PillEffect, atLeast: number): Pill | undefined {
    let best: Pill | undefined;
    for (const p of getPillsByEffect(effect)) {
        if (p.potency < atLeast) continue;
        if (!best || p.value < best.value) best = p;
    }
    return best;
}
