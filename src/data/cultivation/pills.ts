/**
 * Alchemy - the pill catalog.
 */

import type { Pill, PillEffect, TechniqueGrade } from '../../schema/cultivation.js';
import { REALM_TIERS } from '../../engine/cultivation/realms.js';
import type { Band } from './techniques.js';

/** Human-readable unit for each effect's `potency`. Also asserted in tests. */
export const POTENCY_UNITS: Record<PillEffect, string> = {
    heal_hp: 'hp',
    restore_qi: 'qi',
    treat_injury: 'injuries treated',
    mends_what_will_not_close: 'what does not close, closed',
    boost_breakthrough: 'flat probability',
    advance_progress: 'cultivation progress (qi-units)',
    extend_lifespan: 'years',
    sate_hunger: 'satiety points',
    grain_abstinence: 'days without hunger',
    cleanse_deviation: 'deviation severity levels',
    // Nothing. A soul is out or it is not, and there is no amount of it.
    end_the_soul: 'none - the effect is absolute',
    // Nothing either. What is left is a state, not a quantity.
    hollow_the_soul: 'none - what is left is a state'
} as const;

/**
 * Spirit-stone value window per grade. Ascending and disjoint UP TO THE PEERS,
 * where the two windows deliberately overlap.
 */
export const PILL_VALUE_BANDS: Record<TechniqueGrade, Band> = {
    mortal: { min: 5, max: 99 },
    earth: { min: 100, max: 999 },
    heaven: { min: 1_000, max: 9_999 },
    // ── THE PEERS SHARE A CEILING TOO, AND THE COMMENT ABOVE SAID WHY ───
    //
    // Immortal topped out at 99,999 while chaos ran to a million, and the
    // reconciliation in `cultivation-content.test.ts` already stated the
    // reason for the gap: *"what carries the dearest of them past the immortal
    // ceiling is scarcity, which is not a power claim."* Scarcity is not a
    // property of chaos. It is a property of a thing there are four of, and the
    // Immortal Longevity Pill - whose only ingredient stopped growing
    // everywhere at once - is the clearest instance in the catalog. Its grade
    // moved to immortal on the design owner's ruling and the ceiling was the
    // only thing standing in the way of a correct grade.
    //
    // So the two windows are now identical, which is what "peers" already
    // meant on the floor. The ladder of POWER is unchanged and still strictly
    // rising: heaven tops out below immortal's floor, and the peer pair is the
    // one place two grades share a window because they share a rung.
    immortal: { min: 10_000, max: 1_000_000 },
    chaos: { min: 10_000, max: 1_000_000 }
} as const;

// WHAT MODERN ALCHEMY CAN DO ABOUT A LIFESPAN

/** The end of Nascent Soul, read off the ladder rather than retyped. */
const NASCENT_SOUL_END_ORDINAL = REALM_TIERS
    .find(t => t.key === 'nascent_soul')!.ordinalEnd;

export const MODERN_REFINEMENT = {
    /** Most years any living alchemist can put into a pill that holds. */
    maxLifespanYears: 300,
    /** Above this, a refinement does not take at all. */
    lifespanCeilingOrdinal: NASCENT_SOUL_END_ORDINAL,
    why:
        'A refinement has to set in the body it is given to, and past Nascent Soul the body has stopped being the kind of thing it was made for. Every hall has tried. The Cinnabar Crucible has the failures written up and the Furnace Script on its wall does not help, because the script is a transcription of somebody who could and the difficult step is missing.',
    whatItMeansAtTheTop:
        'Nobody above Nascent Soul can buy a year. Not expensively, not at auction, not from a house that owes them: the thing does not exist to be bought, and every apex in the world has established that independently and stopped asking.'
} as const;

/**
 * ═══════════════════════════════════════════════════════════════════════
 * WHAT STOPS SOMEBODY MAKING AN IMMORTAL OR CHAOS PILL IS THE MATERIALS
 * ═══════════════════════════════════════════════════════════════════════
 *
 * The ruling, written down here because this is where the next reader will
 * look for it and re-derive it otherwise.
 *
 * A finished dose above heaven grade is, in circulation, almost always
 * something that came down. That is a statement about how HARD the road is and
 * never about what is possible. The design owner: **the materials for those
 * formulas exist on this side too, sealed in pocket realms** - so somebody who
 * gets into one and back out with what is in it can refine the pill.
 *
 * So there is no grade gate on refining and there must not be one. The
 * fourteen immortal and chaos formulas are readable, learnable and attemptable:
 * *"people maybe have the recipes for some of them, they just don't have the
 * materials."* What refuses an attempt is `handleRefine`'s ingredient check,
 * which already names what is short, where it grows and what it would take -
 * and that is the honest refusal, because it is the true one.
 *
 * This is the same rule one rung up from where the crafting ladder already
 * uses it: a heaven-grade artifact wants heaven-grade materials, and the Root
 * Cauldron's whole point is skipping the hunt for them. Scarcity of materials
 * is how this world gates the top of a craft ladder, and it is a content loop
 * rather than a wall - it joins up with sealed ruins, doors on long seasons,
 * and the race when a window opens.
 *
 * ── AND THE ONE THING THAT IS GENUINELY IMPOSSIBLE IS ALREADY A MATERIAL ─
 *
 * This set is NOT the rule above, and it is down to one member because the
 * rule enforces itself. `pill-immortal-longevity` has a complete, readable
 * formula whose first ingredient is `herb-thousand-autumn-chrysanthemum`, and
 * that herb is in `EXTINCT_HERB_IDS`: filtered out of `FORAGEABLE_HERBS`, in
 * no world, in no pocket realm, gone everywhere at once. Nobody below the Lid
 * can make one and nobody above it can either, and that is expressed where the
 * design owner wants it expressed - in the material, not in a flag.
 *
 * What this set is still for is a DIFFERENT fact that happened to share it: a
 * pill made before modern refinement existed is not bound by what modern
 * refinement can do, so {@link lifespanYearsFor} does not put it under the
 * Nascent Soul ceiling. Membership means "this predates the ceiling", and
 * adding a row here because it is expensive or rare would be the mistake.
 */
export const NOT_REFINABLE_BELOW_THE_LID_PILL_IDS: ReadonlySet<string> = new Set([
    'pill-immortal-longevity'
]);

export const NOT_REFINABLE_NOTES: Readonly<Record<string, string>> = {
    'pill-immortal-longevity':
        'The formula survives complete, is not secret, and can be read by any alchemist with the standing to be shown it. Its first ingredient stopped growing before any institution now standing was founded, and it stopped growing everywhere at once - so nobody below the Lid can make one, and nobody above it can either. What exists was made when there were flowers.'
} as const;

/**
 * The years a lifespan pill actually buys this body, which is not always the years
 * printed on it.
 */
export function lifespanYearsFor(pill: Pill, ordinal: number): number {
    if (pill.effect !== 'extend_lifespan') return 0;
    if (NOT_REFINABLE_BELOW_THE_LID_PILL_IDS.has(pill.id)) return pill.potency;
    if (ordinal > MODERN_REFINEMENT.lifespanCeilingOrdinal) return 0;
    return Math.min(pill.potency, MODERN_REFINEMENT.maxLifespanYears);
}

/** Why it did nothing, or null where it did what it says. */
export function lifespanRefusalReason(pill: Pill, ordinal: number): string | null {
    if (pill.effect !== 'extend_lifespan') return null;
    if (NOT_REFINABLE_BELOW_THE_LID_PILL_IDS.has(pill.id)) return null;
    if (ordinal > MODERN_REFINEMENT.lifespanCeilingOrdinal) {
        return 'The refinement does not set. Nothing any living alchemist can make holds in a body past Nascent Soul, and this one is no exception - it is spent, and it did nothing.';
    }
    return null;
}

/** Every run starts holding exactly one of these. */
/**
 * The one pill in the catalog nobody is meant to want.
 */
export const SOUL_QUENCHING_PILL_ID = 'pill-soul-quenching';

/** The other end of the same axis. See `SOUL_QUENCHING_PILL_ID`. */
export const HOLLOWING_PILL_ID = 'pill-hollowing';

export const MINOR_HEALING_PILL_ID = 'pill-minor-healing';

/**
 * ── THE ONE ABSTINENCE PILL, AND WHY THERE IS ONLY ONE ──────────────────
 *
 * There were three - mortal, heaven and immortal - and the ladder read as a
 * mid-game objective: ten years without a meal at heaven grade for 9,000
 * stones, and an effectively permanent one at immortal for 90,000.
 *
 * THE ENGINE HAD ALREADY MADE THE TOP TWO WORTHLESS AND NOBODY HAD LOOKED.
 * `SATIETY_BURN_BY_REALM` tapers what a day of hunger costs - 1 at Qi
 * Condensation, 1/24 at Foundation Establishment, 1/120 at Core Formation,
 * 1/600 at Nascent Soul - and then it is **0 from Deity Transformation up**,
 * with `stillNeedsToEat` as the predicate. Set against `pillBandOrdinal`, which
 * says what rung each grade is pitched at:
 *
 *   mortal    Foundation Establishment   1/24 of a mortal's hunger
 *   heaven    Nascent Soul               1/600. Ten years buys almost nothing
 *   immortal  Void Tribulation           ZERO. It buys literally nothing
 *
 * So the immortal pill sold, for 90,000 spirit stones, a thing the engine
 * already grants free at that rung, and the heaven pill sold a rounding error.
 * The design owner, independently and from the fiction: *"the abstinence pills
 * are useless. mortal grade at minimum cuz high ranking cultivators don't need
 * it"*, then *"also i mean maximum"*, then *"def not heaven grade"*.
 *
 * WHAT SURVIVES IS THE ONE NARROW USE. *"The abstinence pill lets low ranking
 * cultivators not need supplies. That's it, it's not very useful."* That is a
 * logistics answer rather than a saving: somebody at Qi Condensation walking
 * between provinces does not have to carry or find food for a year. It is worth
 * something exactly where hunger still binds, which is the bottom, and nothing
 * anywhere else - which is why a ceiling of mortal is the shape rather than a
 * taste.
 */
export const GRAIN_ABSTINENCE_PILL_ID = 'pill-hollow-reed-fasting';

/** Days it grants. One year, and then it is over. */
export const GRAIN_ABSTINENCE_DAYS = 365;

export const PILLS: readonly Pill[] = [
    // ═══════════════════════════════════════════════════════════════════
    // MORTAL - what a Qi Condensation cultivator can actually afford
    // ═══════════════════════════════════════════════════════════════════
    {
        id: MINOR_HEALING_PILL_ID,
        name: 'Lesser Healing Pill',
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
        id: SOUL_QUENCHING_PILL_ID,
        name: 'Soul-Quenching Pill',
        grade: 'mortal',
        effect: 'end_the_soul',
        // A soul is out or it is not. `POTENCY_UNITS` says the figure means
        // nothing here, and it is 1 rather than 0 so that a reader who sorts
        // the catalog by potency does not find it filed with the inert.
        potency: 1,
        // Not a poison it survives. The toxicity model prices what a body
        // carries afterwards, and there is no afterwards.
        toxicity: 0,
        // An ordinary mortal-grade price, beside a Blood-Replenishing Pill at
        // 35, and that is the point rather than an accident. It is not rare
        // and it is not dear: a house that sends people into other houses can
        // issue one to everybody it sends without noticing the expense. What
        // makes it hard to carry was never the money.
        value: 40,
        description:
            'Grey, chalky, and small enough to hold behind a tooth. Houses that send people into other houses issue them without comment, and the instruction that comes with it is not about when to take it but about what is worth more than the person carrying it.'
    },
    {
        id: HOLLOWING_PILL_ID,
        name: 'Hollowing Pill',
        grade: 'earth',
        effect: 'hollow_the_soul',
        potency: 1,
        // There is no body afterwards that carries anything, in the sense the
        // toxicity model means. What it leaves is not a burden on a person.
        toxicity: 0,
        // Dearer than the quiet pill and not by much, which is the whole
        // uncomfortable fact about it. Nothing here is priced by what it does.
        value: 400,
        description:
            'Pale and slightly warm, and it does not dissolve so much as go. Whoever refined the first one wrote down that the difficult part was keeping the body breathing, which tells you what the easy part was.'
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
        name: 'Lesser Longevity Pill',
        grade: 'mortal',
        effect: 'extend_lifespan',
        potency: 5,
        toxicity: 0.6,
        value: 80,
        description:
            'Five more years, bought with thousand-day tuber. Mortals ruin families for these. Cultivators past Foundation Establishment consider them a rounding error.'
    },
    {
        // THE WHOLE OF THE ABSTINENCE LINE. It was the bottom rung of three.
        id: GRAIN_ABSTINENCE_PILL_ID,
        name: 'Empty Reed Fasting Pill',
        grade: 'mortal',
        effect: 'grain_abstinence',
        potency: GRAIN_ABSTINENCE_DAYS,
        // Still the dearest and hardest on the body of any mortal pill, which
        // is what the advancement rule requires of it and also what it is: a
        // crude version of an art, and the body notices.
        toxicity: 0.7,
        // ── THE TOP OF THE MORTAL BAND, AND THAT IS A RULE RATHER THAN A
        //    LEFTOVER ────────────────────────────────────────────────────
        //
        // Ninety is dear against the economy a beginner is in - a run opens
        // with 30 stones, a year of portering nets about 12 after board, and a
        // first manual runs 8 to 23 - and the gap is deliberate rather than an
        // oversight. `grain_abstinence` is ADVANCEMENT, and two rules follow:
        // advancement costs more than survival inside a grade, and this sits at
        // the top of its own. The mortal survival tier tops out at 60.
        //
        // So it is a thing a beginner saves for rather than picks up, which is
        // the correct shape for what it actually buys: not the meals, but the
        // time that would have gone on finding them.
        value: 90,
        description:
            'A year without eating, compressed into something a village alchemist can actually make. It works, it is unpleasant for the first month, and it has to be taken again next year. What it is really for is the road: somebody who does not have to stop for food does not have to stop.'
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
        name: 'Lesser Satiety Pill',
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
        name: 'Greater Longevity Pill',
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
        name: 'Lesser Condensed Pill',
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
        name: 'Iceheart Lotus Pill',
        grade: 'heaven',
        effect: 'extend_lifespan',
        potency: 100,
        toxicity: 6.5,
        value: 8_800,
        description:
            'A century, distilled from the glacial heart flower. Bought almost exclusively by cultivators who have run out of realm and are running out of time.'
    },
    // A heaven-grade `Grain Abstinence Pill` stood here at 9,000 stones for ten
    // years without a meal. Heaven grade is pitched at Nascent Soul, where the
    // engine already charges 1/600 of a mortal's hunger, so it sold a rounding
    // error at the price of a house's stock. See the note on
    // `GRAIN_ABSTINENCE_PILL_ID`.

    // ═══════════════════════════════════════════════════════════════════
    // IMMORTAL - Void Tribulation and Body Integration
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
            'Draws on the emptiness a Void Tribulation cultivator has learned to breathe. The pill contains almost nothing, at enormous expense.'
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
        name: 'Empty Sky Clear Mind Pill',
        grade: 'immortal',
        effect: 'cleanse_deviation',
        potency: 5,
        toxicity: 9.0,
        value: 36_000,
        description:
            'Empties the mind of the deviation and, for some days afterwards, of most other things. Practitioners are attended during the recovery by someone they trust absolutely.'
    },
    {
        id: 'pill-returning-spring',
        name: 'Returning Spring Pill',
        grade: 'immortal',
        // THE IMMORTAL RUNG OF THE ORDINARY LADDER, AND IT WENT MISSING FOR AN
        // HOUR. It was briefly `mends_what_will_not_close` and named for a
        // parted channel, on the reading that a permanent wound had no answer
        // and needed one written. The design owner overruled that: permanent
        // injuries are the structural repair medicine's job, by rank. With the
        // reason gone the row comes back to what it has always been - what
        // closes an ordinary tear on a body too big for anything cheaper - and
        // the ladder has its top rung again. What did not come back is the
        // name: `Severed Meridian Restoration Pill` is a diagnosis with a price
        // on it, and a thing sold in this world is named for what it gives
        // back.
        effect: 'treat_injury',
        potency: 1,
        toxicity: 10.0,
        value: 42_000,
        description:
            'Closes damage nothing cheaper will hold on a body this size, using soulreturn dew that condenses only where someone very strong died very badly. The supply chain is exactly as grim as it sounds.'
    },
    {
        id: 'pill-condensed-century',
        name: 'Greater Condensed Pill',
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
        name: 'Void Tribulation Guiding Pill',
        grade: 'immortal',
        effect: 'boost_breakthrough',
        potency: 0.25,
        toxicity: 12.0,
        value: 60_000,
        description:
            'Twenty-five points at the boundary into Void Tribulation. Fewer than a hundred are believed to exist, and their owners are all known to each other.'
    },
    // A `pill-limb-rebirth` stood here for an hour and has been withdrawn. It
    // was written on the reading that `structural-repair-medicine.ts` answers a
    // structure that did not SET and nothing else, so a body short an arm had
    // no medicine anywhere and one had to be invented. The design owner
    // overruled the premise: the repair medicine answers every permanent injury
    // at its rank, and a second module doing what the first already did is the
    // defect rather than the fix. Nothing was lost with the row - what grows a
    // part back is a Second Pour, a Core-Knitting, a Soul-Seating or an Unbroken
    // Pattern Pill, whichever reaches the rung the body is standing on.
    {
        id: 'pill-thousand-year-cypress',
        name: 'Thousand-Ring Cypress Pill',
        grade: 'immortal',
        effect: 'extend_lifespan',
        potency: 300,
        toxicity: 15.0,
        value: 88_000,
        description:
            'Three hundred years, taken from a tree that will not miss them and paid for by someone who will. The toxicity is the tree\'s opinion of the transaction, and three hundred is the end of the line: no living alchemist has ever set a refinement that held longer, and none has ever made one hold in a body past Nascent Soul.'
    },
    // A `Perpetual Grain Abstinence Pill` stood here at 90,000 stones. Immortal
    // grade is pitched at Void Tribulation, where `SATIETY_BURN_BY_REALM` is
    // already 0 - so it charged ninety thousand spirit stones for a thing the
    // engine grants free at that rung, and had done since the table was
    // written. See the note on `GRAIN_ABSTINENCE_PILL_ID`.

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
        id: 'pill-sky-mending',
        name: 'Sky-Mending Pill',
        grade: 'chaos',
        // ── NO `mends`, AND THAT IS THE ROW SAYING SOMETHING ─────────────
        //
        // Nobody made it for anything. It is chaos grade, and chaos is the only
        // grade in `GRADE_SPREAD` whose effect is drawn when it is USED rather
        // than settled when it was made - so it closes ONE of whatever the body
        // is carrying that nothing closes, and which one is a draw. That is the
        // rung the design owner kept when the rest of this line was withdrawn:
        // *"KEEP THE CHAOS ONE WHICH REPAIRS A RANDOM ONE AT ANY RANK."*
        //
        // ── AND IT WAS THE HEAVEN-MENDING PILL UNTIL AN HOUR AGO ────────
        //
        // A NAME MUST NOT COLLIDE WITH THE VOCABULARY OF THE COLUMN BESIDE IT.
        // Every row here carries `grade: mortal | earth | heaven | immortal |
        // chaos`, and a register or a market board is a list somebody scans - so
        // a chaos row whose name begins with "Heaven" reads as a heaven-grade
        // row before anybody gets to the grade column. The design owner:
        // *"heaven mending makes me think heaven grade."* The grade words are
        // load-bearing here, which makes this the same rule as the type-noun
        // rule in AGENTS.md rather than a preference about sound.
        effect: 'mends_what_will_not_close',
        potency: 9,
        toxicity: 25.0,
        value: 480_000,
        description:
            'Closes one of the things about a body that nothing closes. Which one is drawn when it is taken and is not announced beforehand: somebody carrying a single such wound knows which will close, and somebody carrying four knows only that one of the four will. Two are known to have been refined; one was used, and its user is still walking.'
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
        // THE RUIN MEDICINE, and it was always this row.
        id: 'pill-immortal-longevity',
        name: 'Immortal Longevity Pill',
        // ── IMMORTAL, AND IT SAID CHAOS WHILE ITS NAME SAID OTHERWISE ───
        //
        // The same collision the Sky-Mending rename was about, pointing the
        // other way: a row whose NAME carries a grade word its `grade` column
        // disagreed with. Here the name was the correct half. The design owner:
        // *"up this one to immortal not chaos."*
        //
        // AND THAT MAKES IT DETERMINISTIC, WHICH IS A BEHAVIOUR CHANGE AND IS
        // STATED RATHER THAN DISCOVERED. Chaos is the only grade in
        // `GRADE_SPREAD` with more than one outcome, drawn at the moment of
        // use; immortal is `AS_MADE`. So this stops being a lottery: you take
        // it, you get the thousand years. For a lifespan medicine that is the
        // right shape - the whole of what somebody is buying is a number of
        // years, and a number of years drawn from a hat is a different product.
        grade: 'immortal',
        effect: 'extend_lifespan',
        potency: 1_000,
        toxicity: 0,
        value: 1_000_000,
        description:
            'A thousand years, flat, to anybody who swallows it, and it does no harm on the way in. It has not been refined on either side of the Lid for an age: the flower it needs stopped growing everywhere at once, so every one still in the world was made when there were flowers, and nobody anywhere has a complete count.'
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

export function getPillsByEffect(effect: PillEffect): readonly Pill[] {
    return PILLS_BY_EFFECT.get(effect) ?? [];
}

export function getPillsByGrade(grade: TechniqueGrade): readonly Pill[] {
    return PILLS_BY_GRADE.get(grade) ?? [];
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

// A `pillThatMends(woundKey)` stood here and is gone with the rows it read.
// It answered "which pill NAMES this permanent wound", which was the whole of
// how a permanent injury was found for an hour. The design owner ruled that
// structural repair medicine answers one by RANK, so no pill names a wound any
// more and the lookup had nothing left to find. What replaced it is
// `cheapestMedicineFor` in `what-structural-repair-medicine-can-reach.ts`,
// which asks the rung rather than the name.
