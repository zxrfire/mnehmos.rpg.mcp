/**
 * Technique (art) library.
 */

import type {
    InsightDomain,
    ManualQuality,
    Technique,
    TechniqueClass,
    TechniqueFuel,
    TechniqueGrade,
    TechniqueCategory,
    Element
} from '../../schema/cultivation.js';
import { isOnRoad } from '../../schema/cultivation.js';
import {
    FALSE_IMMORTAL_ORDINAL,
    LAST_CROSSING_ORDINAL,
    MAX_ORDINAL,
    TOTAL_RANKS,
    TRUE_IMMORTAL_ORDINAL,
} from '../../engine/cultivation/realms.js';
import { ordinaryCapFor } from '../../engine/cultivation/cultivation.js';

// PROVENANCE - the Late Age rule The world is poorer than it was. Veins that ran
// rich for a thousand years have been drawn down, old wars killed whole regions
// outright, and what the fallen civilisations did not consume they monopolised.
// Nobody has ascended in living memory, and the manuals describing the upper realms
// were written by people who are not available to explain them.

/**
 * Where a copy came from.
 */
export type TechniqueProvenance = 'taught' | 'ruin' | 'grave' | 'derived';

/**
 * Which age an art was written in. See `era` on `TechniqueEntry` for why this
 * is independent of `class` and of `provenance`, and `docs/world/history/ancient.md`
 * for what the distinction is for.
 */
export type TechniqueEra = 'modern' | 'ancient';

// SHOWN OR READ - the rule underneath provenance

/** Which of the two channels a copy of an art offers its holder. */
export type TransmissionMode = 'shown' | 'read';

/** Shown or read, from where the art came from. */
export function transmissionModeOf(provenance: TechniqueProvenance): TransmissionMode {
    // `derived` is shown, and the reasoning is the rule rather than an
    // exception to it: the channel loses what it loses because somebody has to
    // put an understanding into a form and somebody else has to take it back
    // out. A cultivator who wrote the continuation themselves never encoded it
    // for anybody, so there is no half-second missing and nothing to recover.
    // It is the only art in the world with no transmission loss at all.
    return provenance === 'taught' || provenance === 'derived' ? 'shown' : 'read';
}

// OPACITY - and why the two channels do not differ by a fixed amount

/**
 * How much of an art fails to survive being written down, 0..1.
 */
export type Opacity = number;

/**
 * What an art of this grade is usually like, absent a reason to say otherwise.
 */
export const GRADE_BASELINE_OPACITY: Record<TechniqueGrade, Opacity> = {
    mortal: 0.15,
    earth: 0.3,
    heaven: 0.45,
    immortal: 0.6,
    chaos: 0.75
} as const;

/** The entry's own figure where it has one, otherwise its grade's baseline. */
export function opacityOf(entry: { grade: TechniqueGrade; opacity?: Opacity }): Opacity {
    return entry.opacity ?? GRADE_BASELINE_OPACITY[entry.grade];
}

/**
 * How much longer this copy of this art takes to learn than the same art shown by a
 * master who has it.
 */
export function learningCostMultiplier(
    entry: { grade: TechniqueGrade; opacity?: Opacity },
    mode: TransmissionMode
): number {
    if (mode === 'shown') return 1;
    return 1 + opacityOf(entry) * 2;
}

export interface TechniqueEntry extends Technique {
    /**
     * How much of this art fails to survive being written down, 0..1. Omitted
     * on entries that are ordinary for their grade; set explicitly where the
     * art is notably plainer or notably more opaque than its grade suggests,
     * because that is the fact worth knowing before buying a manual.
     */
    opacity?: Opacity;
    provenance: TechniqueProvenance;
    /**
     * Whether a copy of this art is anywhere in the world at all.
     */
    survivingCopy: boolean;
    /**
     * Why a sufficient dao could NOT reconstruct this one, or null.
     */
    notDerivableReason: string | null;
    /** One factual line on where a copy is actually obtained. */
    sourceNote: string;
    /**
     * Id of the destroyed Dao house whose discipline this art is a fragment of,
     * or null. Cross-checked against `DESTROYED_DAO_HOUSES` in `sects.ts` by the
     * catalog test rather than by an import, so the technique catalog stays free
     * of any dependency on the faction catalog.
     */
    fragmentOf: string | null;
    /**
     * Which age the art was written in, and it is a SECOND AND INDEPENDENT AXIS
     * from `class`.
     */
    era: TechniqueEra;
}

/**
 * Arts that are pieces of a discipline whose house no longer exists. A house
 * dies; the thing that made it dangerous does not. These survive as partial
 * manuals in the ruins of the seat that was burned, and they are partial in
 * ways their finders do not discover until later.
 */
export const FRAGMENT_TECHNIQUE_ORIGINS: Readonly<Record<string, string>> = {
    'severed-thread-audit': 'house-tally-court',
    'unpayable-tally-brand': 'house-tally-court',
    'debt-collection-in-arrears': 'house-tally-court',
    'anchor-nail-of-the-broken-girdle': 'house-girdle-of-nine-stones',
    'nameless-witness-stance': 'house-girdle-of-nine-stones',
    'gate-that-was-closed': 'house-unlit-gate'
} as const;

/**
 * Arts no living institution can transmit. Every chaos-grade art is here by
 * rule, along with most of immortal grade and the heaven-grade arts the
 * surviving sects lost the manual for.
 */
export const RUIN_ONLY_TECHNIQUE_IDS: ReadonlySet<string> = new Set([
    // fragments of destroyed Dao houses - see FRAGMENT_TECHNIQUE_ORIGINS
    'severed-thread-audit',
    'unpayable-tally-brand',
    'nameless-witness-stance',
    'anchor-nail-of-the-broken-girdle',
    'gate-that-was-closed',
    // heaven - the sects held these once and cannot read their own copies now
    'worldroot-strangling-vine',
    // immortal - a handful of sects still transmit theirs; these are not among them
    'star-quenching-blade-domain',
    'abyssal-gate-torrent',
    'cinder-of-the-first-sun',
    'void-fold-pilgrimage',
    'lifespring-of-the-jade-pool',
    'severed-fate-mending-art',
    'void-tide-breathing-canon',
    // chaos - nobody alive has ever seen one of these used correctly
    'calamity-word-of-the-open-sky',
    'dragonbone-severing-decree',
    'kalpa-fire-that-eats-heaven',
    'undying-kalpa-body',
    'immovable-heaven-pillar',
    'one-thought-ten-thousand-li',
    'rebirth-in-the-lotus-furnace',
    // the ancient roads Written for a richer age, intact, and not taught anywhere,
    // because the era that could feed them is over and the era that followed built
    // the elemental line instead. Ruin provenance is the whole of what places them:
    // no living teacher, copies in sealed sites and in a small number of very old
    // archives, and nothing about them that a sect could transmit even if it wanted
    // to. See `docs/world/history/ancient.md` and `lost-ages.ts`.
    'hundred-pace-step',
    'sealed-field-of-the-shut-hour',
    'thousand-spear-summoning',
    'vessel-borrowing-palm',
    'sixteen-thread-command',
    'hollow-second-body',
    'paired-breath-canon',
    'quenching-of-the-standing-air',
    'stillness-of-the-turning-year',
    'unsaying-of-a-given-name',
    'severance-of-the-standing-thread',
    'the-hour-that-was-not-taken',
    'unfixing-of-the-set-mark',
    // The two decrees. Ruin-only is a structural requirement of the top rung
    // rather than a flavour choice: nothing alive teaches a decree, and the
    // guard in the escalation suite asserts it.
    'the-road-that-was-always-there',
    'the-witness-who-was-always-there',
    // Above the Lid, and here for the same reason everything else in this list
    // is: no living institution transmits them. The two rungs differ in where
    // the copy is rather than in what kind of thing it is - three faces one man
    // cut where he had been lecturing, and three sets of writings an ascended
    // founder sent back down to a house that cannot read them. Both are the
    // read channel, both are ordinary rows, and neither is taught by anybody.
    'the-seam-that-did-not-close',
    'what-came-back-instead',
    'the-second-question',
    'one-crossing-of-a-courtyard',
    'canon-of-the-unwritten-span',
    'the-fifteenth-breath',
    // Ruin by classification and unobtainable in fact: no living institution
    // transmits it and no site holds it either. See
    // `NO_SURVIVING_COPY_TECHNIQUE_IDS`, which is the half of the statement
    // this list cannot make.
    'word-of-continuance',
    'heaven-conversing-primordial-canon',
    'chaos-origin-scripture',
    // The wide-span treasure. Nobody teaches a book that makes four of
    // their own manuals redundant, and no house has ever held a copy long
    // enough to decide whether it would.
    'single-road-treatise'
]);

/** Arts that only ever surface in a grave deposit. */
// THE CORRIDOR ABOVE THE MIDDLE

/**
 * Manuals that exist in parts, and the OBJECT rows those parts are.
 */
export const SCATTERED_MANUAL_VOLUMES: Readonly<Record<string, readonly string[]>> = {
    'heaven-conversing-primordial-canon': [
        'volume-heaven-conversing-first',
        'volume-heaven-conversing-second',
        'volume-heaven-conversing-third'
    ]
};

/**
 * Manuals a sufficient dao could write the continuation of.
 */
export const DERIVABLE_TECHNIQUE_IDS: ReadonlySet<string> = new Set([
    // Elementless accumulation. Nothing in it is anybody's secret; it is the
    // plainest statement of a thing every cultivator does badly by instinct,
    // and somebody who understands what they are doing badly can write it.
    'five-breath-circulation-scripture',
    // Water-line accumulation off a well. Ordinary enough that two houses have
    // independently written versions of it and neither claims to have invented
    // anything.
    'moonlit-well-absorption-art',
    // And one that is derivable to nobody's benefit. A method for eating
    // your own meridians is arrived at by experiment on the only subject
    // available, which is how it keeps being reinvented by people who were
    // not taught it and did not need to be.
    'meridian-devouring-art',

    // THE RUNGS WHERE DERIVATION COSTS SOMETHING

    // Taught, and not to you. The Rime Heart is transmitted by houses with
    // admission standards, so a cultivator those houses will not take has
    // exactly one other way to it - and stillness is the most walkable road in
    // the catalog, arrived at by sitting still for a very long time, which is
    // a thing nobody can be prevented from doing.
    'rime-heart-stillness-canon',

    // The clearest case in the catalog, and the one that composes with everything
    // else the entry says about itself. Spending your own allotted years as
    // ammunition is a thing a person arrives at alone, at the top of the ladder,
    // with nothing left to spend but time - and there is no victim in it anywhere,
    // which is why it reads as abandoned rather than condemned and why it keeps
    // being rewritten by people who would have been appalled to be handed it. Two
    // books stand above the rung it is written for. It costs most of what a mortal
    // life would have been.
    'lifespan-devouring-heaven-theft'
]);

/**
 * Why a particular manual cannot be reconstructed, however deep the reader.
 */
export const NOT_DERIVABLE_NOTES: Readonly<Record<string, string>> = {
    'canon-of-the-unwritten-span':
        'It is written for a condition the reader is not in and cannot simulate. Every house that has worked through it agrees it is correct and that there is nothing in it they can do, which is also the reason nobody can reconstruct the missing half: you would have to already be past the Lid to know what it was describing, and anybody past the Lid has no use for it.',
    'heaven-conversing-primordial-canon':
        'Not a method but a transcript of one side of a conversation, and the other side was had by somebody who is no longer in the world. A reader deep enough to follow it is deep enough to establish that the missing half cannot be inferred from the half that survives - which is precisely what the three people who have tried each concluded, separately, and wrote down.',
    'chaos-origin-scripture':
        'The one manual whose difficulty is not comprehension. It describes what to do at the last crossing, and the only way to check a reconstruction is to attempt the crossing, which is not a thing anybody gets to do twice.'
};

export const GRAVE_ONLY_TECHNIQUE_IDS: ReadonlySet<string> = new Set([
    // The top prize. Taken off a body, which is the only way it has ever
    // moved: no house has held it long enough to shelve it and the one
    // person known to have carried it stopped twelve rungs short of its end.
    'first-and-last-breath-canon',
    'heart-of-the-ten-thousand-corpses',
    'lifespan-devouring-heaven-theft',
    'debt-collection-in-arrears'
]);

/**
 * Arts the record attests and no copy of which is anywhere in the world.
 */
export const NO_SURVIVING_COPY_TECHNIQUE_IDS: ReadonlySet<string> = new Set([
    'word-of-continuance'
]);

/**
 * Why, per art. One entry per id in the set above, asserted by the catalog
 * test, because a marker with no reason attached is the same silence in a
 * different place.
 */
export const NO_SURVIVING_COPY_NOTES: Readonly<Record<string, string>> = {
    'word-of-continuance':
        'Attested and unobtainable. What survives is the outcome record and nothing else: a short list of occasions on which somebody standing at the last crossing argued for a death that had already been decided, kept by the parties who were watching rather than by the parties who spoke. Everyone who could perform it was at the top of the ladder with their own crossing still ahead of them, and not one of them wrote the working out, because at that rung the reader they would have been writing for does not exist. There is no manual, no fragment and no site, and a cultivator who reaches the rung the art asks for will find nothing there to read.'
} as const;

/**
 * The arts written in the categorical idiom.
 */
export const ANCIENT_TECHNIQUE_IDS: ReadonlySet<string> = new Set([
    // The categorical roads, at rungs the modern line also reaches. Small on
    // purpose: an ancient art at a low rung is a thing a player can be handed,
    // and the tier is worth what its scarcity is worth.
    'hundred-pace-step',
    'sealed-field-of-the-shut-hour',
    'thousand-spear-summoning',
    'vessel-borrowing-palm',
    'sixteen-thread-command',
    'hollow-second-body',
    'paired-breath-canon',
    // Above the Lid. Every one of these was filed `modern` BY OMISSION for as long
    // as the era axis has existed - the set was written before they were and never
    // extended upward - so the axis has been reporting the opposite of the design
    // at the top of the ladder, and the register has been rendering that. They are
    // categorical on their face: a seam held open from underneath, a defence made
    // of being permitted to remain, a strike that arrives before the answer to the
    // first.
    'the-seam-that-did-not-close',
    'what-came-back-instead',
    'the-second-question',
    'one-crossing-of-a-courtyard',
    'canon-of-the-unwritten-span',
    'the-fifteenth-breath',
    // The two decrees, which are categorical by definition: a statement, and
    // the world is obliged.
    'the-road-that-was-always-there',
    'the-witness-who-was-always-there'
]);

/**
 * Arts above the Lid that are deliberately MODERN, with the reason each.
 */
export const MODERN_ABOVE_THE_LID_NOTES: Readonly<Record<string, string>> = {};

/**
 * When an art was written, and it is a statement about IDIOM rather than about a
 * century or a height.
 */
export function eraOf(t: Pick<Technique, 'id'>): TechniqueEra {
    return ANCIENT_TECHNIQUE_IDS.has(t.id) ? 'ancient' : 'modern';
}

/**
 * Every art the prosperous age wrote, derived rather than listed.
 */


const SOURCE_NOTES: Record<TechniqueProvenance, string> = {
    taught: 'Transmitted by at least one living sect. A teacher exists and can be paid, joined, or robbed.',
    ruin: 'Recovered, not taught. Copies survive only in sealed sites, and no living cultivator learned it from a person.',
    grave: 'Taken off a body. Somebody died carrying it, somewhere remote enough that it stayed where they fell, and their sect very likely knows where that was.',
    derived: 'Written rather than found. Nobody transmitted this: a cultivator whose own road had gone far enough set down the continuation out of their understanding, and what they produced is suited to them by construction because it came out of them. There is no second copy unless they made one.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// BANDS
// The balance invariants this catalog commits to, expressed as data so the
// tests assert against the same table the content was authored from.
// ─────────────────────────────────────────────────────────────────────────

export interface Band {
    readonly min: number;
    readonly max: number;
}

/**
 * The highest ordinal this catalog authors content for.
 */
export const CONTENT_MAX_ORDINAL = MAX_ORDINAL;

/**
 * The two rungs above the Lid, one per channel.
 */
export const ABOVE_THE_LID_TRANSMISSION = {
    falseImmortal: {
        ordinal: FALSE_IMMORTAL_ORDINAL,
        mode: 'shown' as TransmissionMode,
        soleTeacher: 'wanderer-lu-sheng',
        howItExists:
            'He built these himself, over six centuries, out of what came back rather than out of anything he was taught. Nobody trained him at this rung because there was nobody at it, and there is no manual because he never had a reason to write one for a reader who does not exist.',
        /**
         * The constraint that keeps him the sole source rather than merely the
         * first: he cannot take another False Immortal's work, so the art at
         * this rung never pools into a body anybody could inherit.
         */
        cannotReceive:
            'He cannot learn another False Immortal\'s arts and has never seriously tried. They are not his path - they came out of somebody else\'s crossing failing in somebody else\'s specific way, and the part of him that would have to hold them is the part that did not come back. So this rung has no canon. It is one man\'s, it ends with him, and all of it that ever gets out gets out through a student.',
        howAStudentGets:
            'By being his student, and there is no substitute - not a manual, not a sect, not money. He shows it, which is the fast channel, and it is the only art above the Lid anybody can get without somebody on the far side of it taking an interest in them. It is also the narrowest supply in the world: one man\'s attention, spent out of a finite number of years.',
        /**
         * The one thing a later reader can walk up to, and why it does not make
         * this rung a read one.
         */
        andTheFacesHeLeavesBehind:
            'Where he lectures he cuts, and the stone stays. It is not the durable form and he is not writing for posterity - it is the surface an afternoon was worked out on, left where the afternoon happened, in a hand anybody can read. Which is why a face of his is worth something and worth much less than the afternoon: whoever finds it is reading, at this rung, without the half-second, from somebody who is still alive and could simply have been asked. The opacity figures on his entries are what that costs, and they are the highest in the catalog.',
        /**
         * And the fact the arts are actually load-bearing for, which is a fact
         * about what he does NOT have. See `THE_ARTS_ARE_THE_WHOLE_INVENTORY`
         * in `false-immortals.ts`, where it is stated against the measurement.
         */
        heCarriesNothing:
            'He holds no object at all, which is the reason these entries matter more than a strong man\'s arts usually would. Everybody else at the top of the world is a person plus something they were given; he was close to the Hollow Court once and is not now, nothing of theirs is his to carry, and nothing else in the world would be handed to him. So the arts are the whole account of him, and the one apex head who can fight him to a draw does it on an object rather than on a rung.'
    },
    trueImmortal: {
        ordinal: TRUE_IMMORTAL_ORDINAL,
        mode: 'read' as TransmissionMode,
        howItExists:
            'A True Immortal can send writings down. That is the whole of the channel, and it is not a small thing - every sect that has ever received one has built four centuries of curriculum on top of it.',
        /**
         * The ordinary penalty of the read channel, at the one rung where there
         * is no shown alternative to compare it against.
         */
        readingNotShowing:
            'It arrives as reading, so it arrives slowly, and it arrives with the half-second missing the way every read art does. Nobody can ask the author. Houses that hold one describe the wait as reverence; it is not reverence, it is the format, and four hundred years is what the format costs at this grade.',
        theExceptionStillApplies:
            'Unless the immortal comes down and acts, and is seen doing it. Ten to fifteen breaths of an immortal acting is worth more than the manual a house took four centuries to work through - not because the breaths are magic, but because being shown always beats reading and this is the only demonstration that rung will ever give. See `crossings.ts` for what those breaths cost the immortal, which is why so few have ever been spent.'
    }
} as const;

/**
 * Realm-ordinal window in which each grade is learnable. Aligned to realm
 * boundaries: mortal manuals are Qi Condensation, earth manuals carry you through
 * Foundation and Core, heaven through Nascent Soul and Deity Transformation,
 * immortal through Void Refinement and Body Integration, and chaos manuals only
 * exist for Grand Ascension and above.
 */
// AND THE TOP TWO BANDS OVERLAP, BECAUSE THE GRADES ARE PEERS
export const GRADE_ORDINAL_BANDS: Record<TechniqueGrade, Band> = {
    mortal: { min: 0, max: 12 },
    earth: { min: 13, max: 20 },
    heaven: { min: 21, max: 28 },
    immortal: { min: 29, max: 36 },
    chaos: { min: 29, max: CONTENT_MAX_ORDINAL }
} as const;

/**
 * Qi cost window per grade. The top two overlap, because the grades are peers: a
 * chaos art may cost what an immortal art costs, and firing one is not dearer for
 * being unpredictable. The qi pool a cultivator has at a given realm is what gates
 * how often any of them is usable.
 */
export const GRADE_QI_BANDS: Record<TechniqueGrade, Band> = {
    mortal: { min: 2, max: 14 },
    earth: { min: 15, max: 49 },
    heaven: { min: 50, max: 129 },
    immortal: { min: 130, max: 349 },
    chaos: { min: 130, max: 1500 }
} as const;

// THE LADDER, AND THE TIE AT THE TOP OF IT

/** Grades in listing order. Enumeration and display; NOT a power ordering. */
export const GRADE_ORDER: readonly TechniqueGrade[] = ['mortal', 'earth', 'heaven', 'immortal', 'chaos'] as const;

/**
 * Where each grade stands in POWER. Immortal and chaos are peers.
 *
 * The numbers are positions on a ladder rather than magnitudes, so the only
 * meaningful operations on them are comparison and equality.
 */
export const GRADE_POWER: Readonly<Record<TechniqueGrade, number>> = {
    mortal: 0,
    earth: 1,
    heaven: 2,
    immortal: 3,
    chaos: 3
} as const;

/**
 * Rank of a grade by power, for comparisons.
 */
export function gradeRank(grade: TechniqueGrade): number {
    return GRADE_POWER[grade];
}

/**
 * Which of two grades is stronger: -1, 0 or 1, with 0 meaning peers.
 *
 * Exists so a consumer can be explicit about a tie instead of discovering one
 * by subtracting two ranks and getting zero.
 */
export function compareGrades(a: TechniqueGrade, b: TechniqueGrade): number {
    return Math.sign(gradeRank(a) - gradeRank(b));
}

// ─────────────────────────────────────────────────────────────────────────
// CATALOG
// ─────────────────────────────────────────────────────────────────────────

// THE TWO KINDS OF ART, AND THE CEILING ON ONE OF THEM

/**
 * Arts that raise a rank despite not being filed under `cultivation`.
 */
const CULTIVATION_CLASS_TECHNIQUE_IDS: ReadonlySet<string> = new Set([
    // Forbidden methods that ARE progression: they raise a rank, by means the
    // orthodox road does not use and at prices it will not pay.
    'nine-abyss-demon-transformation',
    'heart-of-the-ten-thousand-corpses',
    'lifespan-devouring-heaven-theft',
    'meridian-devouring-art',
    // An ancient road you practise rather than use. It is filed `cultivation`
    // by category too, so this entry is belt and braces - but the set is what
    // `classOf` reads first and a road this unusual should be named in it.
    'paired-breath-canon'
]);

/** Which of the two kinds an art is. One rule, plus a named override set. */
export function classOf(t: Pick<Technique, 'id' | 'category'>): TechniqueClass {
    if (CULTIVATION_CLASS_TECHNIQUE_IDS.has(t.id)) return 'cultivation';
    return t.category === 'cultivation' ? 'cultivation' : 'dao';
}

/**
 * The rung a manual stops at, or null when it stops at nothing.
 */
export function capOf(t: Pick<Technique, 'id' | 'category' | 'requiredOrdinal'>): number | null {
    if (classOf(t) !== 'cultivation') return null;
    // Delegated rather than restated. Realm geometry is the engine's and the
    // data layer owns which books exist; two copies of how a cap relates to a
    // realm is one copy too many, and `realmsSpannedBy` depends on there being
    // exactly one.
    return ordinaryCapFor(t.requiredOrdinal);
}

/**
 * Whether a manual reaches further than its own realm geometry would give it.
 */
export function isWideSpan(t: Pick<Technique, 'id' | 'category' | 'requiredOrdinal' | 'cap'>): boolean {
    if (classOf(t) !== 'cultivation' || t.cap === null) return false;
    const ordinary = capOf(t);
    return ordinary !== null && t.cap > ordinary;
}

// HOW WELL EACH BOOK IS WRITTEN

/** What a row that is not named below is. The identity element. */
export const DEFAULT_MANUAL_QUALITY: ManualQuality = 'sound';

export const MANUAL_QUALITY: Readonly<Record<string, ManualQuality>> = {
    // Qi Condensation. The one band where the same rungs are sold at a stall and
    // taught in a courtyard, so it carries the whole spread. The flower road, and
    // the spread is the house saying what it is.
    'cold-bed-foundation-canon': 'sound',
    'overwintering-canon': 'sound',
    'second-flowering-canon': 'sound',
    'late-opening-canon': 'refined',
    'unhurried-canon': 'refined',

    'lesser-qi-gathering-manual': 'crude',
    'azure-dew-gathering-canon': 'refined',
    'five-breath-circulation-scripture': 'sound',
    'moonlit-well-absorption-art': 'refined',

    // ── Foundation Establishment. Common at worst: the world's workhorse
    // crossing, taught everywhere, and nobody's private property. ──
    'foundation-tempering-scripture': 'sound',
    'verdant-longevity-canon': 'refined',
    'paired-breath-canon': 'sound',
    'slack-water-foundation-canon': 'sound',
    // The purest case of the mass-copy tier after the stall primer, and it
    // gets there by a route the table has not had an example of: not copied
    // by cultivators at all. Building gangs in four prefectures have been
    // writing it out for each other for generations, none of them mastered
    // it, and `crude` is what that produces.
    'footing-and-fill-canon': 'crude',
    // Damage, with the cause in the entry's own description. Most of the
    // people who worked the method out did not come back from working it out,
    // so what exists was assembled from notes by people who were not there.
    'struck-ground-foundation-canon': 'corrupt',

    // ── Core Formation. The last band where `crude` is possible at all, and
    // the poorest road in it is the one that takes it. ──
    'molten-core-refinement-scripture': 'sound',
    'iron-silt-settling-canon': 'crude',
    'undyed-core-canon': 'sound',
    'standing-mirror-first-register': 'refined',
    // Generations of people who each took it to its end and wrote down what
    // they found, which is what the tier is for and what the entry claims
    // about its own practitioners.
    'heartwood-forming-canon': 'refined',

    // ── Nascent Soul and above. No `crude` past here, by the rule above. ──
    'nascent-lotus-canon': 'refined',
    'mountain-vein-devouring-canon': 'sound',
    // A terrace method rewritten by one man for water the terraces had
    // finished with, and never revised by anybody since. `sound` is what one
    // careful pass produces: it works, it is his, and nobody has taken it
    // further because the Azure Mist has never held anybody who could.
    'mist-runoff-canon': 'sound',
    'held-under-canon': 'sound',
    'interred-soul-canon': 'sound',
    'grafted-form-canon': 'sound',
    'drawn-wire-canon': 'refined',
    // A partial manual assembled out of what eleven people who died working
    // the method left behind. Above Core Formation the only bad tier
    // available is damage, and this is what damage looks like.
    'twice-struck-canon': 'corrupt',
    'meridian-devouring-art': 'corrupt',
    'void-tide-breathing-canon': 'pristine',
    'nine-abyss-demon-transformation': 'corrupt',
    'rime-heart-stillness-canon': 'refined',
    'cinder-lung-tempering-canon': 'sound',
    'heart-of-the-ten-thousand-corpses': 'corrupt',
    'heaven-conversing-primordial-canon': 'refined',
    'chaos-origin-scripture': 'pristine',
    'lifespan-devouring-heaven-theft': 'corrupt',

    // ── The four roads that reach the top of the ladder. Refined at the three
    // apexes, because each was written once by one person for one successor
    // and has been kept rather than improved. Pristine at the Hollow Court,
    // which is the only body that has had generation after generation of
    // people take the same road to its end and write down what they found -
    // and that difference is the same difference the `opening` field states.
    'clear-terrace-ascension-canon': 'refined',
    'arterial-sounding-canon': 'refined',
    'driven-ground-endurance-canon': 'refined',
    'protected-crossing-canon': 'pristine',

    // ── The treasures. Wide-span books are pristine BECAUSE they are wide: a
    // work that carries a reader across a boundary was finished by somebody
    // who had stood on both sides of it, and nobody has copied it since. ──
    'single-road-treatise': 'pristine',
    'first-and-last-breath-canon': 'pristine',
    'canon-of-the-unwritten-span': 'pristine'
};

/**
 * The road a category is on, when an entry does not name one itself.
 */
const SUBJECT_BY_CATEGORY: Readonly<Record<string, string | null>> = {
    attack: 'weapon',
    defense: 'body',
    movement: 'movement',
    support: 'alchemy',
    cultivation: null,
    forbidden: 'life_death',
    dual_cultivation: 'body'
};

/**
 * The default road, as the one-element set the row now stores.
 */
function roadsFromCategory(category: string): string[] {
    const road = SUBJECT_BY_CATEGORY[category] ?? null;
    return road === null ? [] : [road];
}

/**
 * Authoring helper. Mastery is per-cultivator state, never catalog state, so every
 * entry starts at zero and the factory keeps that out of the literals. Provenance
 * is resolved from the id sets above rather than repeated on every entry, so the
 * Late Age rule reads as one block instead of eighty-odd scattered flags. Whether a
 * copy exists at all is resolved the same way, and an art with none carries its own
 * reason in place of the generic note.
 */
function art(
    t: Omit<Technique, 'mastery' | 'class' | 'cap' | 'quality' | 'rootGrades' | 'domain' | 'domainDegree' | 'volumes' | 'derivable' | 'opening' | 'subjects' | 'requiresPeople' | 'runsOn'>
        & {
            opacity?: Opacity;
            class?: TechniqueClass;
            cap?: number | null;
            rootGrades?: readonly string[];
            domain?: InsightDomain | null;
            domainDegree?: number;
            opening?: { rungs: number; rateMultiplier: number } | null;
            /**
             * Roads this art is on, primary first. Omit and the category
             * supplies the one road every art is on; name them and the first
             * is that road, with anything after it an ability the art happens
             * to grant as well.
             */
            subjects?: readonly string[];
            /**
             * How many living people one practice needs, the practitioner included,
             * and where its qi comes from. Defaults `1` and `'self'`, which is what
             * almost the whole catalog is - see `TechniqueSchema.requiresPeople`
             * and `.runsOn` for why these are a count and an enum rather than a
             * boolean naming a trope.
             */
            requiresPeople?: number;
            runsOn?: TechniqueFuel;
        }
): TechniqueEntry {
    const provenance: TechniqueProvenance = GRAVE_ONLY_TECHNIQUE_IDS.has(t.id)
        ? 'grave'
        : RUIN_ONLY_TECHNIQUE_IDS.has(t.id)
            ? 'ruin'
            : 'taught';
    const survivingCopy = !NO_SURVIVING_COPY_TECHNIQUE_IDS.has(t.id);
    return {
        ...t,
        mastery: 0,
        provenance,
        survivingCopy,
        sourceNote: survivingCopy ? SOURCE_NOTES[provenance] : NO_SURVIVING_COPY_NOTES[t.id],
        fragmentOf: FRAGMENT_TECHNIQUE_ORIGINS[t.id] ?? null,
        // Resolved here rather than repeated on every entry, exactly as
        // provenance is: the split between the two kinds of art, and the
        // ceiling on one of them, read as one block instead of a hundred
        // scattered flags that a new entry could forget.
        class: t.class ?? classOf(t),
        cap: t.cap !== undefined ? t.cap : capOf(t),
        // The second axis. Resolved from `MANUAL_QUALITY` rather than repeated
        // on the entries, exactly as provenance and derivability are, so the
        // whole spread across the catalog reads as one table that can be
        // argued with instead of eighty scattered opinions.
        quality: MANUAL_QUALITY[t.id] ?? DEFAULT_MANUAL_QUALITY,
        // Authored per entry: what a manual demands of a reader is content
        // rather than a derivation. Defaulted to "asks nothing", so an art
        // that genuinely takes any reader does not have to say so.
        rootGrades: [...(t.rootGrades ?? [])],
        domain: t.domain ?? null,
        domainDegree: t.domainDegree ?? 1,
        // Resolved from the named sets, exactly as provenance and surviving
        // copies are, so a new entry cannot forget them.
        volumes: SCATTERED_MANUAL_VOLUMES[t.id] ? [...SCATTERED_MANUAL_VOLUMES[t.id]] : null,
        derivable: DERIVABLE_TECHNIQUE_IDS.has(t.id),
        // Same block as provenance and surviving copies, and for the same
        // reason: a hundred and some entries, and none of them has to
        // remember. See `eraOf` and `MODERN_GRADE_CEILING`.
        era: eraOf(t),
        opening: t.opening ?? null,
        // The road the art is on. Defaults from the category, so the ninety
        // entries that never named one still answer the question, and an
        // entry that wants to be specific overrides it.
        subjects: t.subjects ? [...t.subjects] : roadsFromCategory(t.category),
        requiresPeople: t.requiresPeople ?? 1,
        runsOn: t.runsOn ?? 'self',
        notDerivableReason: NOT_DERIVABLE_NOTES[t.id] ?? null
    };
}

export const TECHNIQUES: readonly TechniqueEntry[] = [
    // ═══════════════════════════════════════════════════════════════════
    // ATTACK - MORTAL (Qi Condensation)
    // Cheap, small dice, and the only thing standing between a new
    // cultivator and a roadside knife.
    // ═══════════════════════════════════════════════════════════════════
    art({
        id: 'cross-meridian-strike',
        name: 'Cross-Meridian Strike',
        category: 'attack',
        grade: 'mortal',
        element: null,
        requiredOrdinal: 0,
        qiCost: 2,
        damage: '1d4+1',
        cooldown: 0,
        description:
            'The first thing any sect teaches, and the only thing some disciples ever learn. Qi is pushed along a single meridian and released through the heel of the palm. It is not impressive. It has ended a great many arguments.'
    }),
    art({
        id: 'iron-thread-finger',
        name: 'Iron Thread Finger',
        category: 'attack',
        grade: 'mortal',
        element: 'metal',
        requiredOrdinal: 1,
        qiCost: 3,
        damage: '1d6+1',
        cooldown: 0,
        description:
            'Metal qi is drawn to a thread no thicker than a hair and flicked from the fingertip. Practitioners are known by the pale scars on their own knuckles, earned in the years before the thread learned to leave.'
    }),
    art({
        id: 'green-sprout-lash',
        name: 'Green Sprout Lash',
        category: 'attack',
        grade: 'mortal',
        element: 'wood',
        requiredOrdinal: 2,
        qiCost: 4,
        damage: '1d6',
        cooldown: 0,
        description:
            'A whip of living wood qi that grows from the wrist and rots away within a breath. Farmers who stumbled into cultivation invented it, and it still smells faintly of cut grass.'
    }),
    art({
        id: 'scarlet-ember-palm',
        name: 'Scarlet Ember Palm',
        category: 'attack',
        grade: 'mortal',
        element: 'fire',
        requiredOrdinal: 2,
        qiCost: 5,
        damage: '1d8+1',
        cooldown: 1,
        description:
            'Fire qi is banked in the palm until the skin glows the colour of a stirred hearth, then spent in one strike. Burns the user as often as the target, which is why the manual is cheap.'
    }),
    art({
        id: 'gutter-rain-palm',
        name: 'Gutter Rain Palm',
        category: 'attack',
        grade: 'mortal',
        element: 'water',
        requiredOrdinal: 3,
        qiCost: 4,
        damage: '1d8',
        cooldown: 1,
        description:
            'Water qi struck downward in a sheet, taught in the flooded lower wards of river towns. It is a poor killing art and an excellent art for making a larger opponent lose their footing.'
    }),
    art({
        id: 'loam-crusher-fist',
        name: 'Loam Crusher Fist',
        category: 'attack',
        grade: 'mortal',
        element: 'earth',
        requiredOrdinal: 4,
        qiCost: 6,
        damage: '2d4+2',
        cooldown: 1,
        description:
            'Earth qi sinks into the forearm until the limb weighs like a fence post. Slow, obvious, and it breaks ribs through armour.'
    }),
    art({
        id: 'hundred-cut-flying-blade',
        // `subjects` is what an art is ABOUT, and the sword arts are the only
        // rows in this catalog that name one. See the note beside
        // `SWORD_SUBJECT` below for why these five and nothing else.
        //
        // One sliver of metal steered by intent for ten paces. A moving edge,
        // and nothing that stands anywhere - so the sword road and no other.
        subjects: ['sword'],
        name: 'Hundred-Cut Flying Blade',
        category: 'attack',
        grade: 'mortal',
        // Opaque far past its grade. The manual is four pages and they are
        // accurate; what they cannot carry is the interval between the cuts, which
        // is the entire art. Readers arrive at a hundred separate strikes and never
        // at the one thing that makes them a hundred cuts.
        opacity: 0.62,
        element: 'metal',
        requiredOrdinal: 7,
        qiCost: 9,
        damage: '2d6+2',
        cooldown: 1,
        description:
            'A hand-length sliver of metal qi is thrown and steered by intent for perhaps ten paces. The hundred cuts are advertising; six is a good day.'
    }),
    art({
        id: 'bitter-frost-needle',
        name: 'Bitter Frost Needle',
        category: 'attack',
        grade: 'mortal',
        element: 'ice',
        requiredOrdinal: 8,
        qiCost: 10,
        damage: '2d6+3',
        cooldown: 2,
        description:
            'One of the very few ice manuals a mortal-grade cultivator will ever see. The needle is drawn from the moisture of the user\'s own breath, and leaves the throat raw for days.'
    }),
    art({
        id: 'drumming-thunder-clap',
        // Two palms struck together hard enough that the air between them tears - a thing that happens to a space, not to a person.
        reach: 'several',
        name: 'Drumming Thunder Clap',
        category: 'attack',
        grade: 'mortal',
        element: 'lightning',
        requiredOrdinal: 9,
        qiCost: 12,
        damage: '2d8',
        cooldown: 2,
        description:
            'Two palms struck together hard enough that the air between them tears. Copied from a fragment of a lightning manual by someone who could not use it, and sold to someone who could.'
    }),
    art({
        id: 'ashfall-crescent',
        // A low arc swept along the ground. The arc is the art; anybody standing in it is in it.
        reach: 'several',
        name: 'Ashfall Crescent',
        category: 'attack',
        grade: 'mortal',
        element: 'fire',
        requiredOrdinal: 11,
        qiCost: 13,
        damage: '3d6+2',
        cooldown: 2,
        description:
            'A low arc of fire qi swept along the ground, leaving a crescent of grey cinders that stays warm until morning. The last art most Qi Condensation cultivators bother to master before their bottleneck.'
    }),

    // ═══════════════════════════════════════════════════════════════════
    // ATTACK - EARTH (Foundation Establishment / Core Formation)
    // ═══════════════════════════════════════════════════════════════════
    art({
        id: 'nine-rivers-sword-chant',
        // Nine consecutive cuts, and the art is the interval between them.
        // About timing rather than about ground. Sword road only.
        subjects: ['sword'],
        name: 'Nine Rivers Sword Chant',
        category: 'attack',
        grade: 'earth',
        element: 'water',
        requiredOrdinal: 13,
        qiCost: 18,
        damage: '3d8+4',
        cooldown: 1,
        description:
            'Nine consecutive cuts, each carrying the weight of the last, in the way a river carries the rain that fell upstream a month ago. The chant is not mystical; it is how the count is kept.'
    }),
    art({
        id: 'white-tiger-rend',
        name: 'White Tiger Rend',
        category: 'attack',
        grade: 'earth',
        element: 'metal',
        requiredOrdinal: 14,
        qiCost: 20,
        damage: '4d6+5',
        cooldown: 1,
        description:
            'Metal qi extends past the fingers as four hooked lengths and closes. Foundation-stage bodyguards favour it because it works in a corridor, and because it frightens people who have only read about it.'
    }),
    art({
        id: 'cinder-lotus-blossom',
        name: 'Cinder Lotus Blossom',
        category: 'attack',
        grade: 'earth',
        element: 'fire',
        requiredOrdinal: 15,
        qiCost: 24,
        damage: '4d8+4',
        cooldown: 2,
        description:
            'Fire qi is folded into eight compressed petals which open all at once at arm\'s length. The bloom is briefly beautiful. Whatever is standing in it is not.'
    }),
    art({
        id: 'tectonic-seal-palm',
        name: 'Tectonic Seal Palm',
        category: 'attack',
        grade: 'earth',
        element: 'earth',
        requiredOrdinal: 16,
        qiCost: 26,
        damage: '5d6+6',
        cooldown: 2,
        description:
            'The palm is pressed to the ground and the ground is asked to answer. It answers under the target, which is a distinction the target rarely appreciates in time.'
    }),
    art({
        id: 'bramble-crown-spear',
        name: 'Bramble Crown Spear',
        category: 'attack',
        grade: 'earth',
        element: 'wood',
        requiredOrdinal: 17,
        qiCost: 28,
        damage: '4d10+5',
        cooldown: 2,
        description:
            'A thorned shaft of hardened wood qi thrown flat and fast, which splits into a crown of barbs on impact. Removing it is a second injury.'
    }),
    art({
        id: 'formless-severing-intent',
        name: 'Formless Severing Intent',
        category: 'attack',
        grade: 'earth',
        // Almost untransmissible on a page. Intent is the whole content and intent
        // is what writing is worst at - houses that hold only a copy produce people
        // who can describe it at length and cannot do it once.
        opacity: 0.78,
        element: null,
        requiredOrdinal: 18,
        qiCost: 30,
        damage: '4d8+8',
        cooldown: 2,
        description:
            'No element, no gesture, no light. The cultivator decides that a thing should be cut and spends qi on the decision. Elementless arts of this quality are expensive precisely because anyone can learn them.'
    }),
    art({
        id: 'glacial-tomb-slash',
        name: 'Glacial Tomb Slash',
        category: 'attack',
        grade: 'earth',
        element: 'ice',
        requiredOrdinal: 19,
        qiCost: 36,
        damage: '6d8+6',
        cooldown: 3,
        description:
            'The stroke does not cut so much as arrive already having cut, the wound frozen shut before the blood reaches it. Two complete copies of this manual are known to exist.'
    }),
    art({
        id: 'arcstep-thunder-lance',
        name: 'Arcstep Thunder Lance',
        category: 'attack',
        grade: 'earth',
        element: 'lightning',
        requiredOrdinal: 20,
        qiCost: 44,
        damage: '5d10+10',
        cooldown: 3,
        description:
            'Lightning qi is grounded through the user\'s own spine and thrown as a lance that arrives before the sound. Every practitioner on record has burn scars tracing the same path down the back.'
    }),

    // ═══════════════════════════════════════════════════════════════════
    // ATTACK - HEAVEN (Nascent Soul / Deity Transformation)
    // ═══════════════════════════════════════════════════════════════════
    art({
        id: 'void-piercing-sword-domain',
        // ONE OF THE TWO ARTS IN THE CATALOG THAT ALSO RAISES FORMATIONS
        subjects: ['sword', 'formation'],
        name: 'Void-Piercing Sword Domain',
        category: 'attack',
        grade: 'heaven',
        element: 'metal',
        requiredOrdinal: 21,
        qiCost: 60,
        damage: '6d10+15',
        cooldown: 2,
        description:
            'Sword intent is spread as a standing field rather than thrown as a strike. Inside it, distance stops protecting anyone. Nascent Soul sword cultivators consider anything less to be a hobby.'
    }),
    art({
        id: 'samsara-tide-crush',
        name: 'Samsara Tide Crush',
        category: 'attack',
        grade: 'heaven',
        element: 'water',
        requiredOrdinal: 23,
        qiCost: 72,
        damage: '8d8+18',
        cooldown: 3,
        description:
            'Water qi drawn in a closing spiral that returns to itself, so the target is struck by the same tide four times without it ever leaving. Coastal sects will not teach it to outsiders.'
    }),
    art({
        id: 'sunfeather-conflagration',
        name: 'Sunfeather Conflagration',
        category: 'attack',
        grade: 'heaven',
        element: 'fire',
        requiredOrdinal: 24,
        qiCost: 80,
        damage: '7d12+20',
        cooldown: 3,
        description:
            'Fire qi shed as a fan of burning plumes, each one continuing to burn after the strike lands. The manual warns, twice, against using it indoors, and the second warning is more emphatic.'
    }),
    art({
        id: 'worldroot-strangling-vine',
        name: 'Worldroot Strangling Vine',
        category: 'attack',
        grade: 'heaven',
        element: 'wood',
        requiredOrdinal: 25,
        qiCost: 88,
        damage: '8d10+16',
        cooldown: 3,
        description:
            'Wood qi driven into the earth surfaces beneath the target as a root that has been growing there, patiently, for the last half-second. It tightens on qi, not on flesh.'
    }),
    art({
        id: 'hollow-mountain-decree',
        // The one the catalog says people have politely asked its holders not to use where anybody lives, which is a sentence about area and nothing else.
        reach: 'field',
        name: 'Hollow Mountain Decree',
        category: 'attack',
        grade: 'heaven',
        element: 'earth',
        requiredOrdinal: 27,
        qiCost: 104,
        damage: '10d8+24',
        cooldown: 4,
        description:
            'The user names a mountain that is not there and lets it fall. Deity Transformation cultivators who fight in inhabited places are asked, politely and by many people, not to know this art.'
    }),
    art({
        id: 'severed-name-finger',
        name: 'Severed Name Finger',
        category: 'attack',
        grade: 'heaven',
        // The technique operates on something the reader has to already believe is
        // a real object. Shown, it is obvious within an afternoon. Read, most people
        // never get past deciding the text is a metaphor.
        opacity: 0.8,
        element: null,
        requiredOrdinal: 28,
        qiCost: 120,
        damage: '8d12+28',
        cooldown: 4,
        description:
            'A single pointed finger, no element, no display. What it severs is the target\'s hold on their own qi, and the body follows shortly after out of habit.'
    }),

    // ═══════════════════════════════════════════════════════════════════
    // ATTACK - IMMORTAL (Void Refinement / Body Integration)
    // ═══════════════════════════════════════════════════════════════════
    art({
        id: 'star-quenching-blade-domain',
        // A domain that comes down as a lattice of falling edges. It is named for the volume it occupies.
        reach: 'field',
        // THE SECOND, AND THE ROW ALREADY SAID SO IN THREE PLACES
        subjects: ['sword', 'formation'],
        name: 'Star-Quenching Blade Domain',
        category: 'attack',
        grade: 'immortal',
        element: 'metal',
        requiredOrdinal: 29,
        qiCost: 150,
        damage: '10d12+40',
        cooldown: 3,
        description:
            'The domain is cast upward first and comes down as a lattice of falling edges. It is called star-quenching because of what witnesses reported seeing in the sky above the first recorded use, not because of any verified effect on stars.'
    }),
    art({
        id: 'abyssal-gate-torrent',
        // A gate onto deep water held open for four breaths. What comes through does not choose.
        reach: 'field',
        name: 'Abyssal Gate Torrent',
        category: 'attack',
        grade: 'immortal',
        element: 'water',
        requiredOrdinal: 31,
        qiCost: 190,
        damage: '12d12+45',
        cooldown: 4,
        description:
            'A hand-span gate is opened onto deep water that has never seen light, and then not closed for four full breaths. The pressure does most of the work; the cold does the rest.'
    }),
    art({
        id: 'nine-heaven-scourging-bolt',
        // Its own text: the heavens are not required to stop at one.
        reach: 'several',
        name: 'Nine-Heaven Scourging Bolt',
        category: 'attack',
        grade: 'immortal',
        element: 'lightning',
        requiredOrdinal: 33,
        qiCost: 240,
        damage: '12d20+60!',
        cooldown: 5,
        description:
            'Not a bolt the user makes, but one the user requests. The heavens are not required to stop at one, and the manual is explicit that they frequently do not. Only a mutated lightning root survives the asking.'
    }),
    art({
        id: 'cinder-of-the-first-sun',
        name: 'Cinder of the First Sun',
        category: 'attack',
        grade: 'immortal',
        element: 'fire',
        requiredOrdinal: 35,
        qiCost: 300,
        damage: '14d20+70',
        cooldown: 5,
        description:
            'Fire qi refined past light and past heat into something that simply ends processes. What is left is a fine pale powder that will not scatter in wind and is cold to the touch.'
    }),

    // ═══════════════════════════════════════════════════════════════════
    // ATTACK - CHAOS (Grand Ascension / Tribulation Transcendence)
    // ═══════════════════════════════════════════════════════════════════
    art({
        id: 'calamity-word-of-the-open-sky',
        // One syllable, spoken outdoors. The qualifier is the mechanic.
        reach: 'field',
        name: 'Calamity Word of the Open Sky',
        category: 'attack',
        grade: 'chaos',
        element: null,
        requiredOrdinal: 38,
        qiCost: 420,
        damage: '20d20+120',
        cooldown: 6,
        description:
            'One syllable, spoken outdoors, elementless. Grand Ascension cultivators do not describe what the syllable means, and the four who could agree on its pronunciation are no longer available to ask.'
    }),
    art({
        id: 'dragonbone-severing-decree',
        name: 'Dragonbone Severing Decree',
        category: 'attack',
        grade: 'chaos',
        element: 'metal',
        requiredOrdinal: 40,
        qiCost: 560,
        damage: '24d20+160',
        cooldown: 6,
        description:
            'A cut aimed at the spine of something enormous and mythic, applied instead to whatever is in front of the user. The scale is wrong for the target on purpose.'
    }),
    art({
        id: 'kalpa-fire-that-eats-heaven',
        // Its own text: it does not stop when the target does.
        reach: 'field',
        name: 'Kalpa Fire That Eats Heaven',
        category: 'attack',
        grade: 'chaos',
        element: 'fire',
        requiredOrdinal: 43,
        qiCost: 800,
        damage: '30d20+240!',
        cooldown: 8,
        description:
            'The fire that ends an age, borrowed early and briefly. It does not stop when the target does; it stops when the qi runs out, which is why the cooldown in the manual is written in red.'
    }),

    // ═══════════════════════════════════════════════════════════════════
    // DEFENSE - body-tempering, shrouds, wards
    // ═══════════════════════════════════════════════════════════════════
    art({
        id: 'iron-shirt-tempering',
        name: 'Iron Shirt Tempering',
        category: 'defense',
        grade: 'mortal',
        element: null,
        requiredOrdinal: 1,
        qiCost: 3,
        damage: null,
        cooldown: 0,
        description:
            'Qi is pushed outward into the skin and held there. Elementless, unglamorous, and responsible for more surviving Qi Condensation cultivators than every attack manual in this catalog combined.'
    }),
    art({
        id: 'stone-hide-mantle',
        name: 'Stone Hide Mantle',
        category: 'defense',
        grade: 'mortal',
        element: 'earth',
        requiredOrdinal: 5,
        qiCost: 7,
        damage: null,
        cooldown: 2,
        description:
            'Earth qi crusts over the shoulders and back in overlapping grey plates. It sheds on movement, so a practitioner leaves a trail of gravel behind them for an hour afterwards.'
    }),
    art({
        id: 'bark-armor-circulation',
        name: 'Bark Armour Circulation',
        category: 'defense',
        grade: 'mortal',
        element: 'wood',
        requiredOrdinal: 8,
        qiCost: 10,
        damage: null,
        cooldown: 2,
        description:
            'Wood qi is circulated just under the skin until it toughens like winter bark. It also slows bleeding, which is the reason most travellers carry the manual.'
    }),
    art({
        id: 'golden-bell-shroud',
        name: 'Golden Bell Shroud',
        category: 'defense',
        grade: 'earth',
        element: 'metal',
        requiredOrdinal: 14,
        qiCost: 22,
        damage: null,
        cooldown: 3,
        description:
            'Metal qi rung outward as a standing shell that hums when struck. Every practitioner has one seam where the bell does not close, and finding a rival\'s seam is a recognised discipline in itself.'
    }),
    art({
        id: 'still-water-mirror-guard',
        name: 'Still Water Mirror Guard',
        category: 'defense',
        grade: 'earth',
        element: 'water',
        requiredOrdinal: 16,
        qiCost: 28,
        damage: null,
        cooldown: 3,
        description:
            'A skin of motionless water qi that takes an incoming strike and hands part of it back along its own line. Fails badly against earth arts, as water always does.'
    }),
    art({
        id: 'rimeglass-carapace',
        name: 'Rimeglass Carapace',
        category: 'defense',
        grade: 'earth',
        element: 'ice',
        requiredOrdinal: 19,
        qiCost: 40,
        damage: null,
        cooldown: 4,
        description:
            'Ice qi grown outward in clear plates that shatter loudly and take the blow with them. The user is left standing in a ring of melting glass and, usually, alive.'
    }),
    art({
        id: 'unyielding-mountain-body',
        name: 'Unyielding Mountain Body',
        category: 'defense',
        grade: 'heaven',
        // A body art that is exactly what it says. There is no half-second to miss
        // and nothing behind the words, which is why it is the one heaven-grade art
        // a dug-up copy is nearly as good as a teacher for.
        opacity: 0.2,
        element: 'earth',
        requiredOrdinal: 22,
        qiCost: 70,
        damage: null,
        cooldown: 3,
        description:
            'Body-tempering taken to the point where the cultivator stops being a thing that is struck and becomes a thing that is climbed. Movement suffers for as long as it holds.'
    }),
    art({
        id: 'cinder-ward-of-the-burning-heart',
        name: 'Cinder Ward of the Burning Heart',
        category: 'defense',
        grade: 'heaven',
        element: 'fire',
        requiredOrdinal: 26,
        qiCost: 96,
        damage: null,
        cooldown: 4,
        description:
            'A defensive art that burns the incoming attack rather than blocking it, which means the user must keep their own heart-fire hotter than whatever is arriving. Losing that race is its own kind of death.'
    }),
    art({
        id: 'void-hollow-body',
        name: 'Void Hollow Body',
        category: 'defense',
        grade: 'immortal',
        element: null,
        requiredOrdinal: 30,
        qiCost: 160,
        damage: null,
        cooldown: 4,
        description:
            'The cultivator hollows their own presence so that strikes pass through the space where a person is understood to be. Elementless, and the single most-copied manual in Void Refinement.'
    }),
    art({
        id: 'thunder-scale-aegis',
        name: 'Thunder Scale Aegis',
        category: 'defense',
        grade: 'immortal',
        element: 'lightning',
        requiredOrdinal: 34,
        qiCost: 260,
        damage: null,
        cooldown: 5,
        description:
            'Overlapping scales of live lightning qi that answer contact with contact. Only a mutated lightning root can wear it without the aegis grounding itself through the wearer.'
    }),
    art({
        id: 'undying-kalpa-body',
        name: 'Undying Kalpa Body',
        category: 'defense',
        grade: 'chaos',
        element: null,
        requiredOrdinal: 39,
        qiCost: 480,
        damage: null,
        cooldown: 6,
        description:
            'The body is refined against the memory of every calamity it has already survived. Wounds still open. They simply stop being decisive.'
    }),
    art({
        id: 'immovable-heaven-pillar',
        name: 'Immovable Heaven Pillar',
        category: 'defense',
        grade: 'chaos',
        // The famous exception, and the reason the readable third of a False
        // Immortal's yard carving was worth anything: it is one idea, stated once,
        // and the idea does not need a demonstration to land. Chaos grade and
        // plainer on the page than most earth-grade attack forms.
        opacity: 0.22,
        element: 'earth',
        requiredOrdinal: 42,
        qiCost: 700,
        damage: null,
        cooldown: 7,
        description:
            'Earth qi driven down until the cultivator is, in the only sense that matters to physics, part of the world\'s foundation. Heavenly tribulation has been recorded striking this art four times without result.'
    }),

    // ═══════════════════════════════════════════════════════════════════
    // MOVEMENT - qinggong and, eventually, worse things
    // ═══════════════════════════════════════════════════════════════════
    art({
        id: 'swallow-skimming-step',
        name: 'Swallow-Skimming Step',
        category: 'movement',
        grade: 'mortal',
        element: null,
        requiredOrdinal: 0,
        qiCost: 2,
        damage: null,
        cooldown: 0,
        description:
            'The beginner\'s qinggong: qi is vented through the soles at the moment of push-off. It will carry a person over a wall, a stream, or a bandit, and it has done all three in the same evening.'
    }),
    art({
        id: 'reed-crossing-qinggong',
        name: 'Reed-Crossing Qinggong',
        category: 'movement',
        grade: 'mortal',
        element: 'water',
        requiredOrdinal: 4,
        qiCost: 5,
        damage: null,
        cooldown: 1,
        description:
            'Water qi spread beneath the foot for exactly as long as the foot is there. Crossing a river this way is a recognised rite in the river sects, and the ones who fail are fished out downstream.'
    }),
    art({
        id: 'windborne-willow-step',
        name: 'Windborne Willow Step',
        category: 'movement',
        grade: 'mortal',
        element: 'wood',
        requiredOrdinal: 9,
        qiCost: 11,
        damage: null,
        cooldown: 1,
        description:
            'The body is made briefly as light and as difficult to strike as a willow branch. Excellent for leaving. Sect elders note, drily, that it is the most diligently practised art among outer disciples.'
    }),
    art({
        id: 'shadow-splitting-gait',
        name: 'Shadow-Splitting Gait',
        category: 'movement',
        grade: 'earth',
        element: null,
        requiredOrdinal: 13,
        qiCost: 16,
        damage: null,
        cooldown: 1,
        description:
            'Movement fast enough that the eye keeps the previous position for half a heartbeat. There are no real duplicates, whatever the survivors insist.'
    }),
    art({
        id: 'gale-riding-sword-flight',
        // The design owner named flight as the ANALOGY for what an incidental
        // ability looks like - *"like how sword cultivator techniques let you
        // fly"* - so this row is the example rather than a case. Standing on
        // your own blade is transport; nothing about it stands on ground.
        // Taking it would be mistaking the illustration for the thing.
        subjects: ['sword'],
        name: 'Gale-Riding Sword Flight',
        category: 'movement',
        grade: 'earth',
        element: 'metal',
        requiredOrdinal: 15,
        qiCost: 25,
        damage: null,
        cooldown: 2,
        description:
            'The first true flight most cultivators achieve: standing on one\'s own sword and letting metal qi carry both. Slow, cold, and the reason Foundation cultivators are so insufferable about it.'
    }),
    art({
        id: 'emberstep-mirage',
        name: 'Emberstep Mirage',
        category: 'movement',
        grade: 'earth',
        element: 'fire',
        requiredOrdinal: 18,
        qiCost: 32,
        damage: null,
        cooldown: 2,
        description:
            'Heat is thrown ahead of the body so the air bends and the pursuer aims at where the shimmer says. Leaves scorched footprints, which rather undermines the disappearance.'
    }),
    art({
        id: 'thousand-li-cloud-tread',
        name: 'Thousand-Li Cloud Tread',
        category: 'movement',
        grade: 'heaven',
        element: null,
        requiredOrdinal: 22,
        qiCost: 66,
        damage: null,
        cooldown: 2,
        description:
            'Sustained flight at the height where the air thins and the birds stop. A journey that costs a caravan two months costs a Nascent Soul cultivator an afternoon and a headache.'
    }),
    art({
        id: 'frostmirror-displacement',
        name: 'Frostmirror Displacement',
        category: 'movement',
        grade: 'heaven',
        element: 'ice',
        requiredOrdinal: 26,
        qiCost: 100,
        damage: null,
        cooldown: 3,
        description:
            'A sheet of ice is raised, stepped into, and stepped out of somewhere the user can see. The mirror keeps a faint impression of the passenger, which has ended at least one very careful assassination.'
    }),
    art({
        id: 'lightning-gate-transposition',
        name: 'Lightning Gate Transposition',
        category: 'movement',
        grade: 'immortal',
        // Terrifying to use and simple to understand, which are not the same axis.
        // The manual is honest, complete, and short; the reason few hold it is that
        // few survive practising it, not that few can read it.
        opacity: 0.3,
        element: 'lightning',
        requiredOrdinal: 30,
        qiCost: 170,
        damage: null,
        cooldown: 3,
        description:
            'The user becomes the arc rather than the thing struck by it, and arrives wherever the arc terminates. Mutated lightning roots only; every other root arrives as a smell.'
    }),
    art({
        id: 'void-fold-pilgrimage',
        name: 'Void-Fold Pilgrimage',
        category: 'movement',
        grade: 'immortal',
        element: null,
        requiredOrdinal: 35,
        qiCost: 310,
        damage: null,
        cooldown: 4,
        description:
            'Space between two known places is folded until they touch, walked across, and let go. Folding a place one has never seen is possible exactly once per cultivator.'
    }),
    art({
        id: 'one-thought-ten-thousand-li',
        name: 'One Thought, Ten Thousand Li',
        category: 'movement',
        grade: 'chaos',
        element: null,
        requiredOrdinal: 41,
        qiCost: 640,
        damage: null,
        cooldown: 5,
        description:
            'Arrival precedes intention by a margin too small to measure. At this grade the difficulty is no longer travel; it is remembering to bring the body.'
    }),

    // ═══════════════════════════════════════════════════════════════════
    // SUPPORT - healing, meridian repair, buffs
    // `damage` on these entries is the healing magnitude.
    // ═══════════════════════════════════════════════════════════════════
    art({
        id: 'green-mercy-mending-palm',
        name: 'Green Mercy Mending Palm',
        category: 'support',
        grade: 'mortal',
        element: 'wood',
        requiredOrdinal: 3,
        qiCost: 6,
        damage: '1d8+2',
        cooldown: 2,
        description:
            'Wood qi pushed into a wound to hurry what the body would have done anyway. Cheap, safe, and the single most valuable thing a wandering cultivator can offer a village.'
    }),
    art({
        id: 'warm-current-qi-transfer',
        name: 'Warm Current Qi Transfer',
        category: 'support',
        grade: 'mortal',
        element: null,
        requiredOrdinal: 6,
        qiCost: 8,
        damage: null,
        cooldown: 2,
        description:
            'The user\'s own qi is fed into an ally\'s meridians at a loss of roughly a third in transit. Elementless, so it will not conflict with the recipient\'s root - which is the entire reason it is taught.'
    }),
    art({
        id: 'clear-spring-detoxification',
        name: 'Clear Spring Detoxification',
        category: 'support',
        grade: 'mortal',
        element: 'water',
        requiredOrdinal: 10,
        qiCost: 12,
        damage: null,
        cooldown: 3,
        description:
            'Water qi circulated through the organs to carry out poison and pill toxicity. Alchemists who cannot perform it tend not to reach Foundation Establishment.'
    }),
    art({
        id: 'hundred-herb-restoration-art',
        name: 'Hundred-Herb Restoration Art',
        category: 'support',
        grade: 'earth',
        element: 'wood',
        requiredOrdinal: 14,
        qiCost: 24,
        damage: '3d8+8',
        cooldown: 3,
        description:
            'The practitioner holds the properties of a hundred spirit herbs in mind and reproduces the useful ones directly in wood qi. Requires a memory that most cultivators would rather spend on attack manuals.'
    }),
    art({
        id: 'meridian-knitting-needle-art',
        name: 'Meridian-Knitting Needle Art',
        category: 'support',
        grade: 'earth',
        element: null,
        requiredOrdinal: 17,
        qiCost: 34,
        damage: null,
        cooldown: 4,
        description:
            'Fine threads of elementless qi are stitched along a torn meridian and left to dissolve as the channel closes. One of the few arts that treats an injury rather than covering it, which is why healers eat.'
    }),
    art({
        id: 'bloodwarm-battle-chant',
        name: 'Bloodwarm Battle Chant',
        category: 'support',
        grade: 'earth',
        element: 'fire',
        requiredOrdinal: 19,
        qiCost: 42,
        damage: null,
        cooldown: 3,
        description:
            'Fire qi raised in an ally\'s blood so that fear thins and strikes land harder. The chant runs out, and what it borrowed is repaid afterwards with interest, in exhaustion.'
    }),
    art({
        id: 'spring-returning-life-art',
        name: 'Spring-Returning Life Art',
        category: 'support',
        grade: 'heaven',
        element: 'wood',
        requiredOrdinal: 23,
        qiCost: 84,
        damage: '6d10+30',
        cooldown: 4,
        description:
            'Wood qi at Nascent Soul quality can persuade flesh that the season has turned. Bone knits in minutes. Sects that hold this manual do not lend it out and do not need to explain why.'
    }),
    art({
        id: 'soul-anchoring-invocation',
        name: 'Soul-Anchoring Invocation',
        category: 'support',
        grade: 'heaven',
        element: null,
        requiredOrdinal: 27,
        qiCost: 118,
        damage: null,
        cooldown: 5,
        description:
            'Pins a nascent soul to its body while the body is being ruined, buying the time in which a rescue becomes possible. Does nothing for the body. That is somebody else\'s art.'
    }),
    art({
        id: 'lifespring-of-the-jade-pool',
        name: 'Lifespring of the Jade Pool',
        category: 'support',
        grade: 'immortal',
        element: 'water',
        requiredOrdinal: 31,
        qiCost: 200,
        damage: '10d12+80',
        cooldown: 5,
        description:
            'Water qi condensed to the quality found only in spirit springs, poured directly through the meridians. Whole sects have been founded on a single practitioner of this art.'
    }),
    art({
        id: 'severed-fate-mending-art',
        name: 'Severed-Fate Mending Art',
        category: 'support',
        grade: 'immortal',
        element: null,
        requiredOrdinal: 36,
        qiCost: 330,
        damage: null,
        cooldown: 6,
        description:
            'Treats crippling meridian damage that no pill below immortal grade will touch, at the cost of a portion of the healer\'s own foundation. Healers who use it often are easy to identify: they stopped advancing years ago.'
    }),
    art({
        id: 'rebirth-in-the-lotus-furnace',
        name: 'Rebirth in the Lotus Furnace',
        category: 'support',
        grade: 'chaos',
        element: 'fire',
        requiredOrdinal: 39,
        qiCost: 520,
        damage: '20d20+200',
        cooldown: 8,
        description:
            'The body is burned down to what is essential and reassembled from the cinders by fire qi that has been taught the shape. Survivors describe it as the worst hour of their several thousand years.'
    }),
    art({
        id: 'word-of-continuance',
        name: 'Word of Continuance',
        category: 'support',
        grade: 'chaos',
        element: null,
        requiredOrdinal: 44,
        qiCost: 880,
        damage: null,
        cooldown: 9,
        description:
            'Spoken over someone whose death has already been decided, it argues. The heavens are not obliged to listen, and the record of outcomes is not encouraging, but it is not empty either.'
    }),

    // ═══════════════════════════════════════════════════════════════════
    // CULTIVATION - qi-gathering manuals that raise cultivation rate
    // The real progression currency. These are what a run is actually
    // shopping for.
    // ═══════════════════════════════════════════════════════════════════
    art({
        id: 'lesser-qi-gathering-manual',
        name: 'Lesser Qi-Gathering Manual',
        category: 'cultivation',
        grade: 'mortal',
        element: null,
        requiredOrdinal: 0,
        qiCost: 2,
        damage: null,
        cooldown: 0,
        description:
            'Six pages, block-printed, sold at every market town for the price of a meal. It teaches one to draw ambient qi in a way that accumulates rather than dissipates. On thin ground it accumulates nothing, which the manual does not mention, and nine in ten cultivators never learn anything better.'
    }),
    // THE COMPARISON THE QUALITY AXIS EXISTS FOR, and the reason it is not `grade`.
    // Identical coverage to the block-printed primer above - opens at ordinal 0,
    // stops at Qi Condensation Perfection, elementless so any root may work it -
    // and both are `mortal`, because `GRADE_ORDINAL_BANDS` binds grade to
    // `requiredOrdinal` and they open at the same rung. The only thing that
    // separates them is `MANUAL_QUALITY`: crude against refined.
    art({
        id: 'azure-dew-gathering-canon',
        name: 'Azure Dew Gathering Canon',
        category: 'cultivation',
        grade: 'mortal',
        element: null,
        requiredOrdinal: 0,
        qiCost: 3,
        damage: null,
        cooldown: 0,
        description:
            'The same road as the block-printed primer and not the same book. Four hundred years of Dew teachers have written into it what each of them learned working a village: which errors a body makes in its first winter, what a shallow vein feels like on a cold morning and why that is not the same as a deep one, and the eleven pages on settling that the market copy does not have because nobody who sold one ever had to explain it twice. It is issued at the gate rather than earned, which the Dew is quietly proud of and the terraces regard as an eccentricity.'
    }),
    art({
        id: 'five-breath-circulation-scripture',
        name: 'Five-Breath Circulation Scripture',
        category: 'cultivation',
        grade: 'mortal',
        element: null,
        requiredOrdinal: 5,
        qiCost: 6,
        damage: null,
        cooldown: 0,
        description:
            'Elementless, patient, and forgiving of a muddled root. It does not make anyone fast; it makes almost anyone steady, which over forty years is the same thing.'
    }),
    art({
        id: 'moonlit-well-absorption-art',
        name: 'Moonlit Well Absorption Art',
        category: 'cultivation',
        grade: 'mortal',
        element: 'water',
        requiredOrdinal: 10,
        qiCost: 12,
        damage: null,
        cooldown: 0,
        description:
            'Cultivation performed at a still water surface under moonlight, drawing the qi that settles there overnight. Requires the water, the moon, and the discipline to be awake for both.'
    }),
    art({
        id: 'foundation-tempering-scripture',
        name: 'Foundation-Tempering Scripture',
        category: 'cultivation',
        grade: 'earth',
        element: null,
        // The most-walked crossing in the world, and it is walked with the
        // body. Open to any root; closed to anybody who has never paid
        // attention to the thing they live in.
        domain: 'body',
        requiredOrdinal: 13,
        qiCost: 16,
        damage: null,
        cooldown: 0,
        description:
            'Written for the exact moment after Foundation Establishment, when a cultivator discovers their new foundation is full of the flaws they hurried past. It fixes some of them.'
    }),
    art({
        id: 'verdant-longevity-canon',
        name: 'Verdant Longevity Canon',
        category: 'cultivation',
        grade: 'earth',
        element: 'wood',
        // A wood line held steady for two centuries. A muddled root cannot
        // hold one steady for two months.
        rootGrades: ['single', 'dual'],
        requiredOrdinal: 16,
        qiCost: 26,
        damage: null,
        cooldown: 0,
        description:
            'Wood-attuned accumulation that grows slowly and does not stop. Practitioners age visibly slower than their peers, which makes them conspicuous in ways they rarely enjoy.'
    }),
    art({
        id: 'molten-core-refinement-scripture',
        name: 'Molten Core Refinement Scripture',
        category: 'cultivation',
        grade: 'earth',
        element: 'fire',
        // The choke at 17-20, and now it refuses on two axes rather than
        // one. A water root is turned away for being the wrong element; a
        // fire root with no comprehension of what fire IS is turned away
        // for a different reason and hears a different sentence. That
        // difference is the whole point of populating this field.
        domain: 'element',
        // 19 -> 17, the first rung of Core Formation. A realm's manual has to
        // be learnable ON that realm's first rung or the succession has a hole
        // in it: the previous book caps at 17 and this one could not be opened
        // until 19, so a cultivator arrived at the wall with nothing to turn
        // to. Five realms had that hole. See THE TWO KINDS OF ART.
        requiredOrdinal: 17,
        qiCost: 40,
        damage: null,
        cooldown: 0,
        description:
            'Accumulation by burning off impurity rather than filtering it. Fast, hot, and the cause of a well-documented share of Core Formation qi deviations.'
    }),
    art({
        id: 'nascent-lotus-canon',
        name: 'Nascent Lotus Canon',
        category: 'cultivation',
        grade: 'heaven',
        element: null,
        requiredOrdinal: 21,
        qiCost: 55,
        damage: null,
        cooldown: 0,
        description:
            'The standard Nascent Soul accumulation canon, elementless and copied in every major sect library, which does not make the copies affordable.'
    }),
    art({
        id: 'mountain-vein-devouring-canon',
        name: 'Mountain-Vein Devouring Canon',
        category: 'cultivation',
        grade: 'heaven',
        element: 'earth',
        // Eating a vein is formation work before it is anything else.
        domain: 'formation',
        // 26 -> 25, the first rung of Deity Transformation. Same hole.
        requiredOrdinal: 25,
        qiCost: 100,
        damage: null,
        cooldown: 0,
        description:
            'Draws directly on the spirit vein a mountain sits upon. Enormously effective, and the reason sects treat their veins as territory worth killing over.'
    }),
    art({
        // THE BOOK THAT WALKED DOWN THE GORGE WITH A PUNISHED MAN.
        id: 'mist-runoff-canon',
        name: 'Mist Runoff Canon',
        category: 'cultivation',
        grade: 'heaven',
        element: 'metal',
        // Formation, and shallow. The method is reading a channel that is
        // carrying somebody else's overflow, which is what the Court does for
        // a living and what it is standing on.
        domain: 'formation',
        domainDegree: 1,
        requiredOrdinal: 25,
        qiCost: 112,
        damage: null,
        cooldown: 0,
        description:
            'A Pavilion method rewritten for water the Pavilion had finished with, by the Sword Elder who was sent down the gorge as a punishment nobody wrote down and spent forty years turning a posting into an institution. It is the terrace method with every assumption of a clean root taken out of it, which cost most of its elegance and none of its reach, and it is the only thing the Azure Mist Court holds that the terraces above did not hand it. The Pavilion has never asked for it back and has never been offered a copy.'
    }),
    art({
        id: 'void-tide-breathing-canon',
        name: 'Void-Tide Breathing Canon',
        category: 'cultivation',
        grade: 'immortal',
        element: null,
        // Breathing a tide that is not there.
        domain: 'void',
        requiredOrdinal: 29,
        qiCost: 140,
        damage: null,
        cooldown: 0,
        description:
            'Accumulation from the emptiness between ambient qi rather than from the qi itself. Works in thin-qi regions where every other canon starves, and only there is it obviously worth its price.'
    }),
    art({
        id: 'rime-heart-stillness-canon',
        name: 'Rime-Heart Stillness Canon',
        category: 'cultivation',
        grade: 'immortal',
        element: 'ice',
        // The narrowest door on the ladder, and the catalog already said so in
        // prose: the Frostmirror Court admits mutated ice roots and nobody else.
        // Written into the manual rather than into the house, because it is a fact
        // about the book - the Court refuses applicants it could not teach, rather
        // than teaching applicants it refuses. Ice is a mutated element, so this is
        // consistent with `element` rather than stricter than it.
        rootGrades: ['mutated'],
        domain: 'element',
        domainDegree: 2,
        // 34 -> 33, the first rung of Body Integration. Same hole.
        requiredOrdinal: 33,
        qiCost: 270,
        damage: null,
        cooldown: 0,
        description:
            'The only known ice-attuned accumulation canon above heaven grade. It slows the heart to four beats a minute and the mind to something the manual declines to describe.'
    }),

    // THE ELEMENTAL ROADS
    art({
        id: 'slack-water-foundation-canon',
        name: 'Slack Water Foundation Canon',
        category: 'cultivation',
        grade: 'earth',
        element: 'water',
        requiredOrdinal: 13,
        qiCost: 25,
        damage: null,
        cooldown: 0,
        description:
            'The foundation is laid at slack water, in the quarter hour either side of the turn, when the river is neither running out nor coming in. It works anywhere the tide reaches and nowhere else, so a practitioner\'s whole life is arranged around a timetable that moves fifty minutes later every day, and ferrymen find them extremely easy to recognise and extremely difficult to employ.'
    }),
    art({
        id: 'held-under-canon',
        name: 'Held-Under Canon',
        category: 'cultivation',
        grade: 'earth',
        element: 'water',
        // Pitched at Core Formation rather than at Nascent Soul, and the reason is
        // the shelf it has to sit on. Every water house in the catalog is shallow -
        // the Alliance topped out at thirteen - so a water road opening at
        // twenty-one would have had to go to a house with no water in it, and the
        // one place it fits leaves a four-rung hole between the book below it and
        // this one. At seventeen it joins the Slack Water canon with no seam and
        // the Alliance has an actual water career: thirteen, seventeen, twenty-one.
        domain: 'element',
        requiredOrdinal: 17,
        qiCost: 44,
        damage: null,
        cooldown: 0,
        description:
            'The core is formed submerged, on one breath, and brought up finished or not at all. The argument is that a core made where the body was already in trouble is a core that holds when the body is in trouble again, and the Alliance has four hundred years of ferrymen to suggest that the argument is sound. It is taught at the weirs where the water is slow and somebody is always standing on the bank, and the Alliance is candid that the places it is taught badly are the places nobody is.'
    }),
    art({
        id: 'heartwood-forming-canon',
        name: 'Heartwood Forming Canon',
        category: 'cultivation',
        grade: 'earth',
        element: 'wood',
        // A wood line held steady long enough to lay down rings, which is what
        // the Verdant Longevity Canon below it is already asking for.
        rootGrades: ['single', 'dual'],
        requiredOrdinal: 17,
        qiCost: 36,
        damage: null,
        cooldown: 0,
        description:
            'A core laid down the way a tree lays down heartwood, in rings, from the outside in, out of material that is dead by the time it is load-bearing. It is the slowest road to Core Formation anybody teaches and the least likely to deviate, and its practitioners are insufferable about both facts.'
    }),
    art({
        id: 'grafted-form-canon',
        name: 'Grafted Form Canon',
        category: 'cultivation',
        grade: 'heaven',
        element: 'wood',
        domain: 'body',
        // Pitched at Nascent Soul rather than at Deity Transformation, and the
        // reason is `peakOrdinal` rather than taste. A cap of 29 has to sit in
        // a house that has produced somebody near 29, the two wood houses peak
        // at 26 and 27, and the houses that could carry it are elementless by
        // doctrine or earth to the bone. A wood road nobody wooden could teach
        // would have been an entry in a catalog rather than a road.
        requiredOrdinal: 21,
        qiCost: 105,
        damage: null,
        cooldown: 0,
        description:
            'The infant soul is raised as a scion rather than born: cut, bound into the stock while both are still open, and left a season to find out whether it took. The Hall regards this as the plainest available description of what Nascent Soul actually does to a person, and everybody else regards it as an unusually literal one. A graft that fails does not kill the cultivator. It leaves them with the join.'
    }),
    art({
        id: 'footing-and-fill-canon',
        name: 'Footing and Fill Canon',
        category: 'cultivation',
        grade: 'earth',
        element: 'earth',
        requiredOrdinal: 13,
        qiCost: 22,
        damage: null,
        cooldown: 0,
        description:
            'Written by stonewrights for stonewrights, in the vocabulary of a trade rather than of a sect: dig to something that will hold, fill in courses, let each course set before you load it. There is nothing in it about qi that a mason would not already say about a wall, which is why it has been copied by every building gang in four prefectures and why no sect has ever been proud of teaching it.'
    }),
    art({
        id: 'interred-soul-canon',
        name: 'Interred Soul Canon',
        category: 'cultivation',
        grade: 'heaven',
        element: 'earth',
        domain: 'formation',
        requiredOrdinal: 21,
        qiCost: 78,
        damage: null,
        cooldown: 0,
        description:
            'The infant soul is set into worked stone and left in the ground for the years it takes, and the cultivator goes on with their life around the place it is buried. It produces an exceptionally durable Nascent Soul and one obvious vulnerability, which is that everybody in the house knows the location and the practitioner cannot move it. Houses that teach this are houses that do not expect to be driven off their ground.'
    }),
    art({
        id: 'drawn-wire-canon',
        name: 'Drawn Wire Canon',
        category: 'cultivation',
        grade: 'immortal',
        element: 'metal',
        // Void Refinement is the same self put back into the emptiness and
        // taken out smaller and harder. Drawing wire is that, with tongs.
        domain: 'element',
        domainDegree: 2,
        requiredOrdinal: 29,
        qiCost: 210,
        damage: null,
        cooldown: 0,
        description:
            'The self drawn through a smaller opening, then a smaller one, then a smaller one, for as many temperings as the realm asks. Nothing is added at any stage and a great deal is lost at every stage, which the canon states on its first page rather than at the end. What comes out the far side is the same length of metal it always was and will no longer bend for anything.'
    }),
    art({
        id: 'struck-ground-foundation-canon',
        name: 'Struck-Ground Foundation Canon',
        category: 'cultivation',
        grade: 'earth',
        element: 'lightning',
        // See the block comment: the element gates nobody here, because
        // lightning is outside the overcoming cycle. This does.
        rootGrades: ['mutated'],
        requiredOrdinal: 13,
        qiCost: 30,
        damage: null,
        cooldown: 0,
        description:
            'The foundation is laid standing on ground that has already been struck, in the glass the strike left behind, during the weather that made it. It is not a metaphor and there is no safer version. The first lightning road anybody has written down in an age, and the reason there are so few is not that the method is obscure - it is that the people who worked it out were mostly not available to write it up.'
    }),
    art({
        id: 'twice-struck-canon',
        name: 'Twice-Struck Canon',
        category: 'cultivation',
        grade: 'immortal',
        element: 'lightning',
        rootGrades: ['mutated'],
        domain: 'element',
        domainDegree: 2,
        requiredOrdinal: 29,
        qiCost: 240,
        damage: null,
        cooldown: 0,
        description:
            'Everybody knows lightning does not strike the same place twice. The Court has the bodies of forty-one people who established that it does, a partial manual assembled out of what the last eleven of them left, and a standing position that the saying is the single most expensive piece of folk wisdom in the province. Sixteen rungs above the only other lightning road in the world, with nothing whatsoever in between.'
    }),

    art({
        id: 'heaven-conversing-primordial-canon',
        name: 'Heaven-Conversing Primordial Canon',
        category: 'cultivation',
        grade: 'chaos',
        element: null,
        // One side of a conversation. Following it needs the reader to
        // understand what is being answered, which is karma at depth.
        domain: 'karma',
        domainDegree: 2,
        requiredOrdinal: 37,
        qiCost: 360,
        damage: null,
        cooldown: 0,
        description:
            'At Grand Ascension, accumulation stops being extraction and becomes negotiation. This canon teaches the terms. It does not promise they will be accepted.'
    }),
    art({
        id: 'chaos-origin-scripture',
        name: 'Chaos Origin Scripture',
        category: 'cultivation',
        grade: 'chaos',
        element: null,
        domain: 'void',
        domainDegree: 2,
        // 44 -> 41, the first rung of Tribulation Transcendence. Same hole,
        // and the most consequential one: it is the only book that bridges
        // Grand Ascension to the last crossing, and it has to be dug up.
        requiredOrdinal: 41,
        qiCost: 900,
        damage: null,
        cooldown: 0,
        description:
            'One incomplete copy is known. It came out of a sealed vault under a collapsed compound, in a grade nobody has been taught in living memory, and it is incomplete in the way a map of a coastline is incomplete. Cultivating from it at Tribulation Transcendence Perfection is the last thing anyone in this world can be said to be doing.'
    }),

    // THE FOUR ROADS THAT REACH THE TOP OF THE LADDER
    art({
        id: 'clear-terrace-ascension-canon',
        name: 'Clear Terrace Ascension Canon',
        category: 'cultivation',
        grade: 'chaos',
        element: 'metal',
        // Sword intent at depth, because the road is one a swordswoman walked
        // and she wrote it in the only vocabulary she had.
        domain: 'weapon',
        domainDegree: 3,
        requiredOrdinal: 41,
        qiCost: 880,
        damage: null,
        cooldown: 0,
        // Three rungs of private shorthand. It was written in the decades
        // spent divesting, for a reader who was in the room, and its author
        // never found out what it reads like to anybody else.
        opening: { rungs: 3, rateMultiplier: 0.4 },
        description:
            'The road the Azure Cloud Pavilion actually holds, and the one nobody outside the inner hall has been shown a page of. It was written by the woman who crossed, during the decades she spent settling what was outstanding rather than getting stronger, and it is addressed throughout to a single reader who was in the room - so the first three rungs are a stretch of private shorthand, and after those it is the clearest metal road anybody has set eyes on. The Pavilion holds two copies and neither leaves the hall.'
    }),
    art({
        id: 'arterial-sounding-canon',
        name: 'Arterial Sounding Canon',
        category: 'cultivation',
        grade: 'chaos',
        element: null,
        // Formation at depth: the road is a method for reading what is under
        // the reader, and at this height that is the arterial system itself.
        domain: 'formation',
        domainDegree: 3,
        requiredOrdinal: 41,
        qiCost: 900,
        damage: null,
        cooldown: 0,
        opening: { rungs: 4, rateMultiplier: 0.35 },
        description:
            'The Deep Survey\'s own road, and a survey instrument before it is a method of advancement. It teaches a cultivator at the top of the ladder to take the measure of the vein they are standing on rather than to draw harder on it, on the argument that at this height the limit is never the qi and is always what the reader has understood about where it comes from. The opening is four rungs of unannotated figures, because the Survey writes everything the way it writes a datum.'
    }),
    art({
        id: 'driven-ground-endurance-canon',
        name: 'Driven Ground Endurance Canon',
        category: 'cultivation',
        grade: 'chaos',
        element: null,
        domain: 'body',
        domainDegree: 3,
        requiredOrdinal: 41,
        qiCost: 920,
        damage: null,
        cooldown: 0,
        opening: { rungs: 4, rateMultiplier: 0.3 },
        description:
            'The Long Cut\'s road, written like a schedule because everything the Long Cut writes is a schedule. It carries a reader to the top of the ladder by treating the last realm as a face to be worked rather than a state to be attained: so many rungs, in this order, with the failure modes listed and dated. The four rungs of the opening are the hardest start of any road in the world, and the house does not regard that as a defect, on the stated ground that anybody who cannot get through them was going to die further up.'
    }),
    art({
        id: 'protected-crossing-canon',
        name: 'Protected Crossing Canon',
        category: 'cultivation',
        grade: 'chaos',
        element: null,
        domain: 'void',
        domainDegree: 3,
        requiredOrdinal: 41,
        qiCost: 860,
        damage: null,
        cooldown: 0,
        // No opening, and it is the only road at this height without one. The
        // reason is institutional rather than magical - see the section
        // comment above - and it is the whole of what "best paved" means here.
        opening: null,
        description:
            'The best-paved road in the world, and it does not reach a rung further than the other three. What it has is no bad stretch anywhere in it: every transition between realms is written out by somebody who had just made it and was asked to explain how, every place a reader has historically stopped has an answer beside it, and there is nothing in it a student is expected to work out alone. That is what a body with exactly one purpose produces after enough centuries of it. The Hollow Court exists to get its own members over the last crossing and has spent everything it has on the question, and the road is where the spending shows.'
    }),


    // DAO HOUSE DISCIPLINES What the ancient houses actually teach. None of these
    // is a good way to win a fight; every one of them is a good way to make a fight
    // pointless, expensive, or impossible to walk away from. A house's strength is
    // thousands of years of one principle, and the strength is legible here as
    // reach rather than damage.
    art({
        id: 'thread-reading-stance',
        name: 'Thread-Reading Stance',
        category: 'support',
        grade: 'earth',
        element: null,
        requiredOrdinal: 14,
        qiCost: 22,
        damage: null,
        cooldown: 3,
        description:
            'Holds still and reads what a person is attached to: who is owed, who is owed by, what was inherited and from whom. It resolves nothing and proves nothing in law. It is simply that the reader now knows, and the read party can tell they know.'
    }),
    art({
        id: 'convergence-sighting',
        name: 'Convergence Sighting',
        category: 'support',
        grade: 'earth',
        element: null,
        requiredOrdinal: 17,
        qiCost: 30,
        damage: null,
        cooldown: 4,
        description:
            'Not prophecy. The practitioner sights along the possibilities already in motion and picks out which two or three of them are load-bearing. Useless where nothing has been set in motion yet, and worse than useless where somebody is deliberately setting things in motion to be seen.'
    }),
    art({
        id: 'name-holding-recitation',
        name: 'Name-Holding Recitation',
        category: 'support',
        grade: 'earth',
        element: null,
        requiredOrdinal: 15,
        qiCost: 24,
        damage: null,
        cooldown: 3,
        description:
            'A name is spoken into the register and held there by someone other than its owner. When a crossing takes a name at a realm boundary, the register still has it, and the holder can give it back - slowly, incompletely, and at whatever price the house has decided that year.'
    }),
    art({
        id: 'anchor-stance-of-fixed-ground',
        name: 'Anchor Stance of Fixed Ground',
        category: 'defense',
        grade: 'earth',
        element: 'earth',
        requiredOrdinal: 16,
        qiCost: 27,
        damage: null,
        cooldown: 3,
        description:
            'Fixes a patch of ground to itself so that nothing folds into it and nothing folds out. Against a sword it is nearly worthless. Against anyone whose whole doctrine is arriving somewhere else, it is the end of the argument.'
    }),
    art({
        id: 'span-folding-survey',
        name: 'Span-Folding Survey',
        category: 'movement',
        grade: 'earth',
        element: null,
        requiredOrdinal: 19,
        qiCost: 38,
        damage: null,
        cooldown: 2,
        description:
            'Measures the true distance between two places rather than the walked one, and then takes the shorter figure. Surveyors of this house are the reason a courier route exists at all, and the reason nobody can price one without asking them.'
    }),
    art({
        id: 'binding-word-seal',
        name: 'Binding Word Seal',
        category: 'support',
        grade: 'heaven',
        element: null,
        requiredOrdinal: 21,
        qiCost: 52,
        damage: null,
        cooldown: 5,
        description:
            'Witnesses an oath so that breaking it is not a moral event but a structural one. The seal does not punish; it simply means the promise is now part of how the sworn party is put together, and removing it removes some of them with it.'
    }),
    art({
        id: 'quiet-cut-severing-stroke',
        name: 'Quiet Cut Severing Stroke',
        category: 'forbidden',
        grade: 'heaven',
        element: null,
        requiredOrdinal: 23,
        qiCost: 70,
        damage: '6d10+16',
        cooldown: 4,
        description:
            'Cuts the connection rather than the person: the debt, the oath, the inheritance, the fact that two people ever met. The body it is used on usually survives. What does not survive is whatever was holding that person to anyone else, and the practitioner cannot put it back, and neither can anyone else.'
    }),

    // ═══════════════════════════════════════════════════════════════════
    // FRAGMENTS OF DESTROYED HOUSES
    // A house dies and its discipline does not. These are partial manuals
    // out of burned seats, and the parts that are missing are not marked.
    // ═══════════════════════════════════════════════════════════════════
    art({
        id: 'severed-thread-audit',
        name: 'Severed Thread Audit',
        category: 'support',
        grade: 'heaven',
        element: null,
        requiredOrdinal: 22,
        qiCost: 58,
        damage: null,
        cooldown: 5,
        description:
            'Reads the place where a connection used to be. A cut thread leaves an edge, and the edge keeps the shape of what was removed, so the auditor can describe a debt that no longer legally exists and name who benefited from its removal. Three quarters of the surviving manual is a procedure for not being noticed doing this.'
    }),
    art({
        id: 'nameless-witness-stance',
        name: 'Nameless Witness Stance',
        category: 'defense',
        grade: 'heaven',
        element: null,
        requiredOrdinal: 24,
        qiCost: 76,
        damage: null,
        cooldown: 5,
        description:
            'The practitioner stands present, acts, and is not entered anywhere: no register takes them, no divination sights them, no oath finds a party to bind. The recovered pages do not mention what it costs to be nobody for an afternoon, because the pages that mentioned it did not survive the fire.'
    }),
    art({
        id: 'unpayable-tally-brand',
        name: 'Unpayable Tally Brand',
        category: 'forbidden',
        grade: 'heaven',
        element: null,
        requiredOrdinal: 26,
        qiCost: 96,
        damage: '7d10+18',
        cooldown: 5,
        description:
            'Writes a debt onto someone that no amount of anything will settle, and then lets the ordinary machinery of consequence do the rest. The house that developed it was dissolved for selling it. Every recovered copy is missing the closing procedure, so the brand is also written, faintly, onto whoever applies it.'
    }),
    art({
        id: 'anchor-nail-of-the-broken-girdle',
        name: 'Anchor Nail of the Broken Girdle',
        category: 'defense',
        grade: 'immortal',
        element: 'earth',
        requiredOrdinal: 31,
        qiCost: 180,
        damage: null,
        cooldown: 5,
        description:
            'Drives a fixed point into a region and holds it there against every force that would move, fold, open or relocate it. It was made for containment, by people whose containment was working when it was broken. The nail holds. The recovered method for drawing it back out does not.'
    }),
    art({
        id: 'gate-that-was-closed',
        name: 'The Gate That Was Closed',
        category: 'movement',
        grade: 'immortal',
        element: null,
        requiredOrdinal: 33,
        qiCost: 230,
        damage: null,
        cooldown: 6,
        description:
            'Opens one of the gates that were shut when their house ended. Travel is instantaneous and the destination is one of the old terminals rather than anywhere the traveller chose. Nine terminals are known to survive. Four of them are known to be somewhere a person can breathe.'
    }),
    art({
        id: 'debt-collection-in-arrears',
        name: 'Collection in Arrears',
        category: 'forbidden',
        grade: 'immortal',
        element: null,
        requiredOrdinal: 34,
        qiCost: 260,
        damage: '12d12+50',
        cooldown: 7,
        description:
            'Collects an inherited debt from whoever currently stands at the end of the thread, in full, at once, regardless of whether that person has ever heard of the original transaction. Copies turn up on bodies rather than in ruins, because the last people who could use it were made to pay for it themselves, somewhere remote.'
    }),

    // ═══════════════════════════════════════════════════════════════════
    // FORBIDDEN - powerful, and every one of them costs something the
    // cultivator will miss later. Never taught; only inherited, stolen,
    // or found somewhere they should have left it.
    // ═══════════════════════════════════════════════════════════════════
    art({
        id: 'crimson-tithe-palm',
        name: 'Crimson Tithe Palm',
        category: 'forbidden',
        grade: 'earth',
        element: null,
        requiredOrdinal: 15,
        qiCost: 20,
        damage: '5d8+10',
        cooldown: 2,
        // Same tithe, taken off the user rather than off anybody else.
        runsOn: 'own_lifespan',
        description:
            'Strikes hard for its grade and returns a portion of what it takes to the user\'s own wounds. The tithe is collected from the user\'s lifespan, quietly, and the manual does not mention this until the last page.'
    }),
    art({
        id: 'crimson-bound-union-rite',
        name: 'Crimson-Bound Union Rite',
        category: 'dual_cultivation',
        grade: 'earth',
        element: null,
        requiredOrdinal: 15,
        qiCost: 18,
        damage: null,
        cooldown: 30,
        requiresPeople: 2,
        runsOn: 'the_others',
        description:
            'Two channels are opened at once and one is made to run the wrong way. It works only between a man and a woman - the manual is honest about the mechanism and dishonest about everything around it - and it does not ask whether the second channel was offered. What is drawn off the unwilling side is called a tithe on the Hall\'s own ledgers, the same word it uses for coin. Every righteous register in the province lists this rite by name and calls for the head of anybody caught administering it; the Hall teaches it anyway, and its own people are, without exception, spending something they were not told about at the time.'
    }),
    art({
        id: 'twin-lotus-cultivation-method',
        name: 'Twin Lotus Cultivation Method',
        category: 'dual_cultivation',
        grade: 'mortal',
        element: null,
        requiredOrdinal: 5,
        qiCost: 8,
        damage: null,
        cooldown: 10,
        requiresPeople: 2,
        runsOn: 'everyone',
        description:
            'Two channels are opened at once and both are left running the right way. Practised with a spouse or a bonded partner - the manual is explicit that a stranger gets nothing out of it worth the trouble - and the reason it is one of the oldest, plainest arguments any house has for why a cultivator should marry rather than merely ally: cultivating the same art side by side moves both of them along a hair faster than cultivating it alone. No register anywhere bans it. It works only between a man and a woman, and the manual never claims to know why.'
    }),
    art({
        id: 'lotus-nurturing-canon',
        name: 'Lotus-Nurturing Canon',
        category: 'dual_cultivation',
        grade: 'mortal',
        element: null,
        requiredOrdinal: 13,
        qiCost: 4,
        damage: null,
        cooldown: 0,
        requiresPeople: 1,
        runsOn: 'own_lifespan',
        description:
            'The half that is drawn from. It opens a channel and keeps it open, spending the body it is cultivated in to do it, and it gives the holder nothing whatever: no blow, no defence, no progress of their own. What it produces is a person who can be drawn off, and the deeper it is taken the more there is to draw - which is why nobody has ever begun it willingly, and why the ones who hold it at any depth were brought to it over years by somebody else. A technique list is not a private thing, and anybody who can read one can see a life spent as fuel.'
    }),
    art({
        id: 'lotus-plucking-rite',
        name: 'Lotus-Plucking Rite',
        category: 'dual_cultivation',
        grade: 'earth',
        element: null,
        requiredOrdinal: 13,
        qiCost: 12,
        damage: null,
        cooldown: 20,
        requiresPeople: 2,
        runsOn: 'the_others',
        description:
            'The half that draws. It answers only against somebody cultivating the Lotus-Nurturing Canon, which is the whole of why the two are taught as a pair and never separately: without the other half there is nothing on the far end for it to run into. It carries no blow of its own - a cultivator who has spent their life on this and nothing else is beaten by anybody who spent theirs on a sword - and what it returns is qi, in the amount the other side has been brought to hold. Every righteous register lists it. The houses that teach it teach the Canon first, to somebody else.'
    }),
    art({
        id: 'corpse-lantern-soul-forging',
        name: 'Corpse-Lantern Soul Forging',
        category: 'forbidden',
        grade: 'heaven',
        element: null,
        requiredOrdinal: 24,
        qiCost: 90,
        damage: '8d10+22',
        cooldown: 4,
        // It runs on somebody who cannot be asked, which is the whole objection.
        runsOn: 'the_dead',
        description:
            'The residue of a recently killed cultivator is bound into a lantern of cold light and spent as a weapon. Righteous sects execute for possession of this manual, and demonic sects charge for it.'
    }),
    art({
        id: 'meridian-devouring-art',
        name: 'Meridian-Devouring Art',
        category: 'forbidden',
        grade: 'heaven',
        element: null,
        domain: 'life_death',
        // 27 -> 25, the first rung of Deity Transformation.
        requiredOrdinal: 25,
        qiCost: 110,
        damage: null,
        cooldown: 6,
        // A drain, on the same axis the furnace rite is on: it runs on a
        // second living cultivator, who gains nothing by it. The rite and this
        // art are one mechanic through two channels, and `runsOn` is where
        // that is stated so something can read it.
        requiresPeople: 2,
        runsOn: 'the_others',
        description:
            'Takes cultivation directly out of a living cultivator and puts it in the user. The stolen foundation never fully sets, so every rank gained this way makes the next breakthrough worse.'
    }),
    art({
        id: 'nine-abyss-demon-transformation',
        name: 'Nine-Abyss Demon Transformation',
        category: 'forbidden',
        grade: 'immortal',
        element: 'fire',
        domain: 'life_death',
        domainDegree: 2,
        requiredOrdinal: 32,
        qiCost: 220,
        damage: '14d12+55',
        cooldown: 5,
        description:
            'The body is opened to something patient that has been waiting for exactly this offer. Power arrives immediately. The terms are collected across the remaining centuries, in instalments.'
    }),
    art({
        id: 'heart-of-the-ten-thousand-corpses',
        name: 'Heart of the Ten Thousand Corpses',
        category: 'forbidden',
        grade: 'immortal',
        element: null,
        domain: 'life_death',
        domainDegree: 2,
        requiredOrdinal: 36,
        qiCost: 340,
        damage: null,
        cooldown: 8,
        description:
            'Converts accumulated slaughter into cultivation progress at a rate no legitimate canon can approach. The count is kept by the art, not by the user, and it is never satisfied.'
    }),
    art({
        id: 'lifespan-devouring-heaven-theft',
        name: 'Lifespan-Devouring Heaven Theft',
        category: 'forbidden',
        grade: 'chaos',
        element: null,
        domain: 'life_death',
        domainDegree: 3,
        requiredOrdinal: 42,
        qiCost: 780,
        damage: '26d20+180',
        cooldown: 10,
        // The tithe is the practitioner's own span, collected quietly.
        runsOn: 'own_lifespan',
        description:
            'Spends years off the end of the user\'s own allotted lifespan as ammunition. At Tribulation Transcendence there is a great deal of lifespan to spend, and cultivators who reach the tribulation with this art rarely have enough left to survive it.'
    }),

    // THE ANCIENT ROADS - categorical, costly, and frequently the wrong thing to be
    // holding
    art({
        id: 'hundred-pace-step',
        name: 'Hundred-Pace Step',
        category: 'movement',
        grade: 'earth',
        element: null,
        requiredOrdinal: 16,
        // Nearly the top of the earth band, against about twenty-six for the
        // ordinary movement art at this ordinal. It is expensive because it is
        // not a fast way of running; it is not running.
        qiCost: 46,
        damage: null,
        cooldown: 4,
        description:
            'The user is somewhere else, about a hundred paces off, without having crossed the distance. Ordinary qinggong at this rung is faster over any journey, cheaper, and can be done all day; this can be done four or five times before the user starts coughing, and each use takes a little off the far end of their life. What it is for is the hundred paces that cannot be crossed - a closed gate, a collapsed shaft, the far side of a formation, a room with one door and somebody standing in it.'
    }),
    art({
        id: 'sealed-field-of-the-shut-hour',
        name: 'Sealed Field of the Shut Hour',
        category: 'defense',
        grade: 'heaven',
        element: null,
        // It lands on a location and everybody in it is in it, which is the
        // definition of the second rung. Legal at twenty-six and not a gift
        // for being ancient: a fire art at the same rung may address a place
        // too. What is ancient about this one is what it does to the place.
        reach: 'field',
        addresses: 'place',
        requiredOrdinal: 26,
        qiCost: 128,
        damage: null,
        cooldown: 10,
        description:
            'Takes a piece of ground out of the world for an hour. Nothing enters it, nothing leaves it, and nothing outside it can be reached from within - no messenger, no formation, no ally, no retreat. It is not a shield and it will not stop anything already standing inside with you, which is the mistake people make about it: raised badly it is a way of being alone with a stronger opponent and no road out. The coating the working needs comes off a fern that stopped growing eleven hundred years ago, so each raising spends a measure of something nobody can replace.'
    }),
    art({
        id: 'thousand-spear-summoning',
        name: 'Thousand-Spear Summoning',
        category: 'attack',
        grade: 'immortal',
        element: null,
        // The spears are still there afterwards, which is what makes the
        // subject the ground rather than whoever was standing on it.
        reach: 'field',
        addresses: 'place',
        requiredOrdinal: 31,
        // Against the ordinary immortal art at this exact ordinal - twelve
        // dice of twelve plus forty-five, at a hundred and ninety qi, on a
        // four-round cooldown. This does less, costs more and waits longer.
        qiCost: 320,
        damage: '9d10+25',
        cooldown: 6,
        description:
            'Spears. Real ones, of a metal nobody smelts, standing in the ground where they fall and remaining there. As a way of hurting one person it is plainly worse than the elemental arts of its own rung and every practitioner knows it. What it is for is that the spears are still there afterwards: they hold a line, they close a road, they can be pulled out of the ground and handed to somebody, and a wall of them across a valley is a thing no fire art of any grade has ever left behind. The user pays in blood, at the moment of the summoning, and it does not come back quickly.'
    }),
    art({
        id: 'vessel-borrowing-palm',
        name: 'Vessel-Borrowing Palm',
        category: 'attack',
        grade: 'heaven',
        element: null,
        requiredOrdinal: 24,
        qiCost: 110,
        damage: '5d8+10',
        cooldown: 5,
        description:
            'Takes vitality out of the person struck and puts it into the person striking. Nothing in the modern catalogue moves a resource between two bodies at all, which is the whole of what it is; as a way of winning a fight it is worse than the ordinary heaven-grade palm at the same rung, which hits harder for less qi on a shorter cooldown. What it buys is fights you should not have survived. The borrowing does not settle cleanly - what is taken sits badly, and the taker is a little less able to hold what is theirs each time they do it.'
    }),
    art({
        id: 'sixteen-thread-command',
        name: 'Sixteen-Thread Command',
        category: 'attack',
        grade: 'immortal',
        element: null,
        requiredOrdinal: 33,
        qiCost: 340,
        damage: null,
        cooldown: 9,
        description:
            'Makes a person do something. Not persuasion and not illusion: the body acts and the person inside it watches. It does no damage, cannot be used twice in a fight worth the name, and against anybody within a rung of the user it usually fails outright - so as a weapon it is poor and unreliable. As a problem for a world that runs on oaths, testimony and witnessed agreement it is close to unanswerable, which is why the era that could use it stopped, and why every institution that keeps a treaty vault has an opinion about it. Each use costs the user a measure of their own span, and the measure gets larger the more of them there have been.'
    }),
    art({
        // THE CLONE, and it is the entry where the material requirement stops
        // needing to be argued for. A second body is not a bigger anything; it
        // is a categorical impossibility for the elemental line, and a reader
        // supplies the judgement that of course it would consume something
        // extraordinary without the catalog having to say so.
        id: 'hollow-second-body',
        name: 'Hollow Second Body',
        category: 'support',
        grade: 'immortal',
        element: null,
        requiredOrdinal: 35,
        qiCost: 348,
        damage: null,
        cooldown: 12,
        description:
            'A second body, standing where it was made, doing what the practitioner does. It is not a duplicate and it is not the person: it holds nothing of what they know, cannot be left alone with a decision, and what it feels is not reported back. What it can do is be in a second place, which is a thing no art of the elemental line has ever offered at any rung. It is also, obviously and immediately, a question every house and every oath has to answer about the person who made it - whether the thing that signed is the thing that swore - and no two houses have answered it the same way. Making one consumes a lotus that stopped growing before any institution now standing was founded, and the practitioner does not get back what the making takes out of them.'
    }),

    // an ancient road you PRACTISE The quadrant that was empty, and the more
    // interesting half. An ancient dao art changes what you can do in a fight; an
    // ancient cultivation road changes what kind of cultivator you become,
    // permanently, at a price.
    art({
        id: 'paired-breath-canon',
        name: 'Paired-Breath Canon',
        category: 'cultivation',
        grade: 'earth',
        element: null,
        requiredOrdinal: 15,
        qiCost: 34,
        damage: null,
        cooldown: 0,
        description:
            'Two people cultivate as one circuit. Progress is drawn twice and divided once, so a pair climbs faster than either would alone - and everything else is shared on the same terms. A deviation is both of your deviations. An injury takes its years off both clocks. What one of you spends of a life, the other has spent. The canon is explicit that it cannot be undone and does not soften it: the pairing outlives falling out, outlives distance, and ends when one of you does, which the survivor does not reliably survive. Nothing in the modern catalogue couples two cultivators at all, and no orthodox road asks you to decide at Foundation Establishment who you are willing to be half of for the rest of your life.'
    }),

    // CONDITION: what a place is LIKE, rather than who is standing in it The third
    // rung, and the floor is Body Integration for the reason the schema gives:
    // damage stops meaning what it used to mean, and an art whose subject is no
    // longer damage has stopped addressing what is standing there. Both entries
    // below take a location and change a property of it that outlasts everybody who
    // was present.
    art({
        id: 'quenching-of-the-standing-air',
        name: 'Quenching of the Standing Air',
        category: 'attack',
        grade: 'immortal',
        element: null,
        reach: 'field',
        addresses: 'condition',
        requiredOrdinal: 34,
        qiCost: 330,
        damage: null,
        cooldown: 12,
        description:
            'The qi goes out of the air over a stretch of ground and does not come back. Nobody present is harmed and nothing is destroyed; what changes is what the place IS, permanently, for everybody who ever stands there afterwards. It does not win a fight - anybody it was used against walks away, and walks away able to fight - so as a weapon it is close to useless and was never meant as one. What it is for is denying ground to whoever comes next, which is a thing an age with sieges wanted and this one has no use for. The practitioner cannot draw there either, ever again, and the quenching takes a share of their own span on the way out. Every dead zone anybody has ever surveyed is either this art or something that behaved exactly like it.'
    }),
    art({
        id: 'stillness-of-the-turning-year',
        name: 'Stillness of the Turning Year',
        category: 'support',
        grade: 'chaos',
        element: null,
        reach: 'field',
        addresses: 'condition',
        requiredOrdinal: 38,
        qiCost: 470,
        damage: null,
        cooldown: 14,
        description:
            'The season stops turning over a place. Nothing grows there and nothing rots, wounds neither heal nor worsen, and food keeps for as long as it is inside. It is not a stopping of time and anybody who describes it that way has misunderstood it: people age normally, and only the ground has been taken out of the year. Held for a season it is the single best thing in the catalog for a siege, an archive or a sickbed. Held for a decade it kills a district, because a field that does not turn does not crop, and the places it has been used are known by their famines rather than by their battles. The practitioner holds it, continuously, and holds nothing else while they do.'
    }),

    // SETTLED: a fact the world has already fixed The fourth rung, and the floor is
    // the last crossing: the one place below the Lid from which somebody is looking
    // at the boundary rather than up at it. Four arts, one per Dao house principle,
    // and every one of them is bounded in the way the schema insists on - it needs
    // something to ALREADY BE TRUE, and no magnitude widens that bound.
    art({
        id: 'unsaying-of-a-given-name',
        name: 'Unsaying of a Given Name',
        category: 'support',
        grade: 'chaos',
        element: null,
        addresses: 'settled',
        requiredOrdinal: 44,
        qiCost: 860,
        damage: null,
        cooldown: 20,
        description:
            'A name that was given is ungiven, and everything fastened to it comes loose: the register entry, the inheritance, the oath sworn under it, the debt recorded against it. WHAT HAD TO ALREADY BE TRUE is that somebody named them, once, out loud, and that the naming was kept - so it does nothing whatsoever to a person who was never named, which is most people who have ever lived and every foundling in the province. It does not kill and it does not harm. It removes a person from the paperwork of the world, and the world is largely paperwork.'
    }),
    art({
        id: 'severance-of-the-standing-thread',
        name: 'Severance of the Standing Thread',
        category: 'support',
        grade: 'chaos',
        element: null,
        addresses: 'settled',
        requiredOrdinal: 44,
        qiCost: 880,
        damage: null,
        cooldown: 22,
        description:
            'A connection that was made is unmade - a lineage, a master and disciple, a debt, a thing owed between two people who both know it is owed. WHAT HAD TO ALREADY BE TRUE is that the connection exists and that both ends of it are real; it cannot invent a severance where there was no thread, and against two people who merely dislike each other it does precisely nothing. Both ends feel it go. Neither can say afterwards what it was, only that there was one.'
    }),
    art({
        id: 'the-hour-that-was-not-taken',
        name: 'The Hour That Was Not Taken',
        category: 'support',
        grade: 'chaos',
        element: null,
        addresses: 'settled',
        requiredOrdinal: 44,
        qiCost: 900,
        damage: null,
        cooldown: 24,
        description:
            'A decision that was taken becomes one that was not taken, and the world proceeds from the other branch. WHAT HAD TO ALREADY BE TRUE is that somebody decided, deliberately, at a moment that can be identified - so it is useless against drift, against accident, against everything that merely happened, and useless against a decision nobody can now point to. It does not choose the other branch on anybody\'s behalf. It returns the chooser to the doorway, and they are perfectly free to walk through it again, which is what most of them do.'
    }),
    art({
        id: 'unfixing-of-the-set-mark',
        name: 'Unfixing of the Set Mark',
        category: 'support',
        grade: 'chaos',
        element: null,
        addresses: 'settled',
        requiredOrdinal: 44,
        qiCost: 840,
        damage: null,
        cooldown: 20,
        description:
            'A boundary that was set stops being set. A perimeter, a survey line, a seal, a datum - anything somebody fixed on purpose and that has held because it was fixed. WHAT HAD TO ALREADY BE TRUE is that a person set it, knowing they were setting it; a border that grew out of custom has never been fixed and is untouched, and a wall is just a wall. Nothing moves and nothing falls down. The line simply stops being the line, and every claim that was resting on it is resting on nothing.'
    }),

    // DECREE: a statement, and the world is obliged The top rung, one ordinal wide,
    // and the thing that separates it from the rung below is not size. A settled
    // art reaches a fact the world has already fixed. A decree needs nothing to
    // have been true.
    art({
        id: 'the-road-that-was-always-there',
        // Declared rather than defaulted, which every art above the Lid is
        // required to do. A decree has no headcount by construction: it is a
        // statement, and a statement that kills a number of people is a
        // tier-four art wearing the wrong label.
        reach: 'single',
        name: 'The Road That Was Always There',
        category: 'movement',
        grade: 'chaos',
        element: null,
        addresses: 'decree',
        requiredOrdinal: 46,
        qiCost: 1_400,
        damage: null,
        cooldown: 30,
        description:
            'There is a road here. There always was; the maps have it, the villages along it remember the tolls, and the families who have kept the waystations have kept them for nine generations. NOTHING HAD TO BE TRUE BEFOREHAND, which is the whole of the difference between this and the rung beneath it - no path, no track, no intention, no surveyor, nobody who ever walked it. The statement is made and the road has been there the entire time. It cannot be revised, so a road laid through a place that later needs to not have a road through it is a permanent fact about that place, and the two occasions anybody can point to are both remembered as disasters rather than as feats.'
    }),
    art({
        id: 'the-witness-who-was-always-there',
        // Declared rather than defaulted, which every art above the Lid is
        // required to do. A decree has no headcount by construction: it is a
        // statement, and a statement that kills a number of people is a
        // tier-four art wearing the wrong label.
        reach: 'single',
        name: 'The Witness Who Was Always There',
        category: 'support',
        grade: 'chaos',
        element: null,
        addresses: 'decree',
        requiredOrdinal: 46,
        qiCost: 1_450,
        damage: null,
        cooldown: 32,
        description:
            'Somebody saw it. They were standing there, they have always been the person who was standing there, and they will say so - because it is what happened. NOTHING HAD TO BE TRUE BEFOREHAND: no observer, no vantage, no plausible reason for anybody to have been present. In a world whose oaths, inheritances, treaties and executions all rest on testimony, an art that manufactures a witness out of nothing is the most dangerous sentence anybody has ever written down, and every house that keeps a treaty vault has known of it for an age and has never once been able to devise a check against it. The flat reading is the danger: the witness is real, they are not lying, and there is nothing to detect.'
    }),

    // ABOVE THE LID Six rows with large numbers in them and nothing else different
    // about them. They are chaos grade like everything at the top, they are read by
    // the same lookups, and no code anywhere asks what rung they sit at before
    // doing anything - which is the whole reason it is safe to have written them
    // down. See `WHAT_AN_ART_BUYS`: the best art in the world at full mastery buys
    // nothing across the Lid, so a manual up here is paper and an object up here is
    // not, and only one of those two things is in this file.

    // 45: three faces, one man, and no object anywhere behind them Everything at
    // this rung is Lu Sheng's, because the rung is one person wide - see
    // `ABOVE_THE_LID_TRANSMISSION.falseImmortal`. He built these out of what came
    // back from a crossing that did not complete, he holds nothing else at all, and
    // the opacity figures are the highest in the catalog because a face cut where a
    // lecture happened is the read channel operating at a rung that has exactly one
    // teacher who could simply have been asked.
    art({
        id: 'the-seam-that-did-not-close',
        name: 'The Seam That Did Not Close',
        category: 'attack',
        grade: 'chaos',
        // The one that makes him what the measurement says he is. A hole in
        // the boundary is a thing that happens to a place; everybody standing
        // in the place is standing in it.
        reach: 'field',
        // Barely transmissible. The art is a shape he only knows because the
        // Lid made it against his own name and then shut, and a reader who has
        // not been through a crossing is rebuilding it out of a description of
        // somewhere they have never been.
        opacity: 0.9,
        element: null,
        requiredOrdinal: 45,
        qiCost: 1_020,
        damage: '34d20+320!',
        cooldown: 8,
        description:
            'The seam a crossing opens, made downward over ground instead of upward over a person, and held open rather than survived. He is the only being who has ever had a good look at one from underneath, which is the entire reason the art exists and the entire reason nobody else could have written it.'
    }),
    art({
        id: 'what-came-back-instead',
        name: 'What Came Back Instead',
        category: 'defense',
        grade: 'chaos',
        // One person, and it is his own. A defence at this rung is not a wall
        // over a place; it is the fact that the thing standing there is not
        // going to be moved off it.
        reach: 'single',
        opacity: 0.88,
        element: null,
        requiredOrdinal: 45,
        qiCost: 960,
        damage: null,
        cooldown: 7,
        description:
            'Half of a transformation completed and the rest of it did not, and the half that stays is the half that cannot be sent anywhere. Cultivated deliberately for six centuries by the only person the lower realm has ever declined to expel, it is a defence made out of being permitted to remain.'
    }),
    art({
        id: 'the-second-question',
        name: 'The Second Question',
        category: 'attack',
        grade: 'chaos',
        // The man he meant and whoever is holding the position with him,
        // because a position is rarely held by one person.
        reach: 'several',
        // The plainest thing he has, and still not plain. It is one idea,
        // stated once, and the idea is a habit of mind rather than a working -
        // which is exactly the sort of thing a face carries badly.
        opacity: 0.72,
        element: null,
        requiredOrdinal: 45,
        qiCost: 890,
        damage: '28d20+240',
        cooldown: 6,
        description:
            'The first strike is the question and the art is the second one, asked differently, arriving before the answer to the first. Anybody holding a position has to hold it twice, and the second time is the one that fails. His inheritors know him by the habit long before anybody tells them what he is.'
    }),

    // ── 46: three sets of writings, sent down, held by a house that cannot
    // read them. What a True Immortal actually uses, at second hand and in
    // the slow format - see `ABOVE_THE_LID_TRANSMISSION.trueImmortal`. The
    // objects that go with these arts are not down here and never will be,
    // which is `OBJECT_CEILING_BELOW_THE_LID` and the reason this file can
    // carry the rung and `artifacts.ts` carries it differently.
    art({
        id: 'one-crossing-of-a-courtyard',
        name: 'One Crossing of a Courtyard',
        category: 'attack',
        grade: 'chaos',
        // A place, and it is the only reach that makes sense of the accounts:
        // eleven witnesses, one traverse, and nothing left standing that had
        // been standing.
        reach: 'field',
        opacity: 0.84,
        element: null,
        requiredOrdinal: 46,
        qiCost: 1_460,
        damage: '44d20+440!',
        cooldown: 9,
        description:
            'Named from below, after the only occasion anybody down here has watched the rung work: something came down into a courtyard, crossed it, and the matter was finished. The writings are not an account of that afternoon and the sender has never been asked whether they are related. Three archives hold the incident and none of them holds this.'
    }),
    art({
        // A SECOND ROAD AT 17-20, which had exactly one and wanted fire.
        id: 'iron-silt-settling-canon',
        name: 'Iron-Silt Settling Canon',
        category: 'cultivation',
        grade: 'earth',
        element: 'metal',
        requiredOrdinal: 17,
        qiCost: 38,
        damage: null,
        cooldown: 0,
        description:
            'Accumulation by precipitation rather than by draw: the practitioner sits in moving water carrying metal silt and lets the core form around what settles. It is slower than the fire road and enormously more forgiving of being interrupted, which is why it is the method of choice for anybody whose life contains other people.'
    }),
    art({
        // A THIRD ROAD AT 17-20, AND THE FIRST THAT ASKS NOTHING OF THE READER.
        id: 'undyed-core-canon',
        name: 'Undyed Core Canon',
        category: 'cultivation',
        grade: 'earth',
        element: null,
        requiredOrdinal: 17,
        qiCost: 30,
        damage: null,
        cooldown: 0,
        description:
            'Core Formation with no element to gather the core around: slower than either attuned road going in, and the core it leaves takes an attunement badly for the rest of the cultivator\'s life. It exists because the two attuned roads want a fire root or a metal root and the province is mostly neither. Copied so often and so carelessly that no house claims it - houses that will not sit in the same room teach the same edition, errata and all, because each of them bought a copy rather than being handed one.'
    }),
    art({
        // A SECOND ROAD AT 33-35, which had exactly one, wanted a mutated ice root,
        // and was held by a single house that admits nobody else.
        id: 'cinder-lung-tempering-canon',
        name: 'Cinder-Lung Tempering Canon',
        category: 'cultivation',
        grade: 'immortal',
        element: 'fire',
        requiredOrdinal: 33,
        qiCost: 300,
        damage: null,
        cooldown: 0,
        domain: 'body',
        domainDegree: 2,
        description:
            'The body integrated through heat rather than through stillness, which the orthodox road regards as a shortcut and which is in fact simply a different and worse-documented amount of work. The practitioner breathes hot cinder until the lungs stop objecting, and the ones it does not kill come out the far side able to do something the still road cannot teach at all.'
    }),
    art({
        // THE WIDE-SPAN BOOK. The one manual in the catalog that lets somebody
        // skip, and the shape of what a treasure has to be.
        id: 'single-road-treatise',
        name: 'Treatise on the Single Road',
        category: 'cultivation',
        grade: 'earth',
        element: null,
        requiredOrdinal: 13,
        cap: 33,
        opening: { rungs: 8, rateMultiplier: 0.2 },
        domain: 'void',
        domainDegree: 3,
        qiCost: 44,
        damage: null,
        cooldown: 0,
        opacity: 0.85,
        description:
            'One method, held without substitution from the foundation to the integrated body, written by somebody who evidently never changed books and appears not to have understood that everybody else does. It is the only surviving argument that the succession of manuals is a convenience rather than a law, and the reason nobody has been able to check is that the argument cannot be started without an understanding of absence that almost nobody at Foundation has any way to have acquired.'
    }),
    art({
        // THE FIRST WIDE-SPAN BOOK ANYBODY ACTUALLY TEACHES.
        id: 'standing-mirror-first-register',
        name: 'Standing Mirror Canon, First Register',
        category: 'cultivation',
        grade: 'earth',
        element: null,
        requiredOrdinal: 17,
        cap: 29,
        opening: { rungs: 6, rateMultiplier: 0.3 },
        // The reader has to keep re-founding the same method through two realm
        // boundaries that ordinarily demand a new book at each. That is a
        // demand on the body they live in rather than on anything they own.
        domain: 'body',
        domainDegree: 2,
        qiCost: 46,
        damage: null,
        cooldown: 0,
        opacity: 0.62,
        description:
            'One method held from the forming of the core to the far side of Deity Transformation without ever being put down, written by a court whose disciples cannot use the attuned succession because every book in it was written for somebody else\'s root. It is slower than the plain road for the first six rungs and then it is simply never replaced again, which is worth more than the six rungs and is the reason the Court produces what it produces out of an intake nobody else will take. The Second Register, which continued it from the far boundary, is not in the Court\'s hands and has not been for four hundred years. Applicants are told this at the gate, along with what happens after it, which is nothing the Court can promise.'
    }),
    art({
        // THE TOP PRIZE, AND THE ONE BOOK THAT TAKES THE BAND EXEMPTION.
        id: 'first-and-last-breath-canon',
        name: 'Canon of the First and Last Breath',
        category: 'cultivation',
        grade: 'chaos',
        element: null,
        requiredOrdinal: 5,
        cap: 45,
        opening: { rungs: 13, rateMultiplier: 0.1 },
        domain: 'time',
        domainDegree: 3,
        qiCost: 1_100,
        damage: null,
        cooldown: 0,
        opacity: 0.9,
        description:
            'One breath cycle, described once, and then forty rungs of what that same cycle becomes as the body around it stops being a mortal body. It does not teach a foundation method and a core method and a soul method; it teaches a breath, and then it explains for six hundred pages that there was never more than one thing to learn. Every alchemist and every sword house that has read it agrees it is correct. Nobody has ever met a person who was using it.'
    }),
    art({
        id: 'canon-of-the-unwritten-span',
        name: 'Canon of the Unwritten Span',
        category: 'cultivation',
        grade: 'chaos',
        // A gathering canon lands on the person practising it, which is one
        // person, and stays one person at every rung of the ladder.
        reach: 'single',
        // The plainest of the three and the most useless, because what it is
        // plain about is a condition the reader is not in.
        opacity: 0.55,
        element: null,
        // Written for somebody whose remaining years have stopped being a
        // quantity. The demand is the condition, and nothing below the Lid
        // meets it - which is why every house that has read it agrees it is
        // correct and that there is nothing in it they can do.
        domain: 'time',
        domainDegree: 3,
        // Left at 46, deliberately, and it is the one manual the succession rule
        // does not apply to.
        requiredOrdinal: 46,
        qiCost: 1_380,
        damage: null,
        cooldown: 0,
        description:
            'Accumulation written for somebody whose remaining years have stopped being a quantity anybody would bother recording. It is short, it is orderly, and every house that has worked through it has come out the far side agreeing that it is correct and that there is nothing in it they can do.'
    }),
    art({
        id: 'the-fifteenth-breath',
        name: 'The Fifteenth Breath',
        category: 'movement',
        grade: 'chaos',
        // The traveller, and only the traveller. Nothing about the going up
        // takes anybody else with it, which is most of what the entry is for.
        reach: 'single',
        opacity: 0.8,
        element: null,
        requiredOrdinal: 46,
        qiCost: 1_300,
        damage: null,
        cooldown: 9,
        description:
            'Not the coming down, which needs no art and costs a great deal. This is the going back, taken deliberately and on the practitioner\'s own count rather than waiting to be taken, and it is why nothing from up there is ever left lying about afterwards - what a visitor is carrying goes with them, on the breath they chose, every time it has ever happened.'
    }),
    // THE FLOWER ROAD
    art({
        id: 'frost-setting-bud',
        // The road's premise, taught first and never taught again: a thing is
        // set, and then left. Everything above this is the same act at more
        // cost.
        subjects: ['flower'],
        name: 'Frost-Setting Bud',
        category: 'support',
        grade: 'mortal',
        element: 'wood',
        requiredOrdinal: 3,
        qiCost: 5,
        damage: null,
        cooldown: 2,
        description:
            'A cutting is held alive through a night on ground that freezes, by putting a little of the practitioner into it and then leaving it alone until morning. It is the first thing a bed hand is shown and the only one they are made to fail at repeatedly, because the failure is always the same failure: going back to look.'
    }),
    art({
        id: 'nine-night-opening',
        subjects: ['flower'],
        name: 'Nine-Night Opening',
        category: 'support',
        grade: 'mortal',
        element: 'wood',
        requiredOrdinal: 9,
        qiCost: 11,
        damage: null,
        // Nine nights, and the cooldown is the art rather than a cost on it.
        cooldown: 4,
        description:
            'A wound is set the way a cutting is set and opened over nine nights instead of closed over one. It is slower than any mending palm in the world and it leaves nothing behind, which is the trade, and it is why the people who can afford to wait send for the valley rather than for a physician.'
    }),
    art({
        id: 'cold-set-petal-cut',
        // The house's one weapon, and it is a bed hand's knife. The petal is
        // set in the air and opens when it is CROSSED - so it strikes
        // whoever moves rather than whoever was aimed at, which is the road's
        // premise used against somebody instead of on a plant.
        subjects: ['flower'],
        name: 'Cold-Set Petal Cut',
        category: 'attack',
        grade: 'earth',
        element: 'ice',
        requiredOrdinal: 15,
        qiCost: 22,
        damage: '3d8+3',
        cooldown: 3,
        description:
            'A dozen edges are set in the standing air and left there, and they open when something crosses them. It cannot be aimed and does not need to be: whoever moves first is who it was for. The valley teaches it to anybody who walks the path after dark, which is a sentence the Court has never seen any reason to say more gently.'
    }),
    art({
        id: 'standing-bed-array',
        // NOT ON THE FORMATION ROAD, and it was drafted that way and taken back
        // off. The frost channels along the valley floor genuinely are an array, so
        // the crossover read as obvious - but raising arrays is two arts in the
        // whole catalog by an owner ruling ("not every sword art is also a
        // formation art, maybe one or two is"), and a second school picking it up
        // doubles that as a SIDE EFFECT of building a road.
        // `a-formation-stands-at-the-lower-of-the-art-and-the-builder.ts` says to
        // change that count deliberately, with the rows, and the ruling was made
        // about the sword. Whether a second school may raise arrays is a question
        // for the design owner, not a thing to take while nobody is looking.
        subjects: ['flower'],
        name: 'Standing Bed Array',
        category: 'defense',
        grade: 'earth',
        element: 'wood',
        requiredOrdinal: 19,
        qiCost: 40,
        damage: null,
        cooldown: 4,
        description:
            'The bed is laid as the array and the array is the bed: nodes set at the spacing a plant wants rather than at the spacing a formation wants, holding cold where the cold is needed and holding it off everything else. Anybody who has seen a working one says the same thing about it, which is that it does not look like a formation, it looks like farming.'
    }),
    art({
        id: 'hundred-bloom-opening',
        // A whole bed set and opened at once. `reach: 'several'` because it
        // is still a thing done to people standing near each other rather
        // than to the ground they are on - the field version is the Domain.
        reach: 'several',
        subjects: ['flower'],
        name: 'Hundred-Bloom Opening',
        category: 'attack',
        grade: 'heaven',
        element: 'wood',
        requiredOrdinal: 24,
        qiCost: 85,
        damage: '6d10+12',
        cooldown: 4,
        description:
            'A season of setting spent in one breath. The whole bed opens together and the practitioner has nothing left set anywhere afterwards, which is the honest limit of the art and the reason it is the last thing tried rather than the first.'
    }),
    art({
        id: 'unclosing-bloom',
        // The art `soul-anchoring-invocation` names and declines: it pins a
        // nascent soul to a body being ruined and its own description ends
        // "Does nothing for the body. That is somebody else's art." This is
        // that art, and it belongs to a house that holds things open for a
        // living.
        subjects: ['flower'],
        name: 'Unclosing Bloom',
        category: 'support',
        grade: 'heaven',
        element: 'wood',
        requiredOrdinal: 27,
        qiCost: 120,
        damage: null,
        cooldown: 5,
        description:
            'A wound that is closing wrong is held open instead, the way a cut stem is held, until somebody who knows what they are doing can finish it properly. It buys hours and it costs the practitioner every one of them, and the Court is careful to say out loud that it saves nobody by itself - it only stops the body from settling the question early.'
    }),
    art({
        id: 'orchid-domain',
        // The valley as an art. `reach: 'field'` is the immortal-grade end of
        // the same idea the Standing Bed Array opens at Foundation, and that
        // relation is carried by reach alone rather than by the formation
        // road - see the note on the Array for why this school does not raise
        // arrays.
        reach: 'field',
        subjects: ['flower'],
        name: 'Orchid Domain',
        category: 'attack',
        grade: 'immortal',
        element: 'ice',
        requiredOrdinal: 31,
        qiCost: 200,
        damage: '9d12+30',
        cooldown: 5,
        description:
            'A standing cold laid over ground, inside which nothing opens until the practitioner allows it - a held breath, a drawn blade, a wound, a decision. It does not stop anybody doing anything. It decides when the doing arrives, and against most people that is the same thing said politely.'
    }),

    // the climb, wood end to end One element the whole way, which is deliberate and
    // is the difference between this house and the physician house one province
    // over: the Verdant Spring Hall's wood line runs 16, 17, 21, 25 and stops, so a
    // wood root there has a real career and a real ceiling. Here the same root goes
    // to thirty-three. Which road you are on decides nothing inside these walls;
    // the door does.
    art({
        id: 'cold-bed-foundation-canon',
        subjects: ['flower'],
        name: 'Cold-Bed Foundation Canon',
        category: 'cultivation',
        grade: 'earth',
        element: 'wood',
        domain: 'element',
        requiredOrdinal: 13,
        qiCost: 30,
        damage: null,
        cooldown: 0,
        description:
            'The foundation is set in the cold and left to take, over a winter rather than over a season, and the book is unusually frank that this is slower than every other road to the same rung and produces nothing better at the end of it. What it produces is somebody who has done the thing the whole road is made of, which is waiting on purpose.'
    }),
    art({
        id: 'overwintering-canon',
        subjects: ['flower'],
        name: 'Overwintering Canon',
        category: 'cultivation',
        grade: 'earth',
        element: 'wood',
        domain: 'element',
        requiredOrdinal: 17,
        qiCost: 46,
        damage: null,
        cooldown: 0,
        description:
            'A core formed by keeping something alive through a season that is trying to end it, rather than by forcing it in a furnace or holding it under. The valley supplies the season; the book is mostly about what not to do in it, and about half of the text is a list of interventions that have killed people who could not leave a thing alone.'
    }),
    art({
        id: 'second-flowering-canon',
        subjects: ['flower'],
        name: 'Second-Flowering Canon',
        category: 'cultivation',
        grade: 'heaven',
        element: 'wood',
        domain: 'element',
        requiredOrdinal: 21,
        qiCost: 78,
        damage: null,
        cooldown: 0,
        description:
            'The soul is brought up as a second flowering off a stem that has already flowered once, which is a thing plants do and bodies are not supposed to. The Court holds that this is why its people take so long over Nascent Soul and why so few of them break in the attempt, and it has the roll to argue it with.'
    }),
    art({
        id: 'late-opening-canon',
        subjects: ['flower'],
        name: 'Late-Opening Canon',
        category: 'cultivation',
        grade: 'heaven',
        element: 'wood',
        domain: 'element',
        requiredOrdinal: 25,
        qiCost: 128,
        damage: null,
        cooldown: 0,
        description:
            'Written for somebody who has already been at a rung long enough to be told they are finished at it. Its argument is that a late opening is not a delayed one - that what opens late opens having been fed longer - and it is the only book in the valley that argues with the reader rather than instructing them.'
    }),
    art({
        id: 'unhurried-canon',
        subjects: ['flower'],
        name: 'Unhurried Canon',
        category: 'cultivation',
        grade: 'immortal',
        element: 'wood',
        domain: 'element',
        requiredOrdinal: 29,
        qiCost: 210,
        damage: null,
        cooldown: 0,
        description:
            'The top of the road, and it stops one rung short of where the Matriarch stands. The book does not pretend otherwise: its last section is about what it cannot carry anybody through, and the Court has never claimed that the woman at the top of its ladder got there out of this volume. Everybody in the valley knows what she did instead, which was to stay in it.'
    }),
] as const;

// ─────────────────────────────────────────────────────────────────────────
// DERIVED INDICES
// Prebuilt so lookups are O(1) and never re-scan the array.
// ─────────────────────────────────────────────────────────────────────────


const TECHNIQUE_BY_ID: ReadonlyMap<string, TechniqueEntry> = new Map(TECHNIQUES.map(t => [t.id, t]));

const TECHNIQUES_BY_CATEGORY: ReadonlyMap<TechniqueCategory, readonly TechniqueEntry[]> = buildGroups(t => t.category);
const TECHNIQUES_BY_GRADE: ReadonlyMap<TechniqueGrade, readonly TechniqueEntry[]> = buildGroups(t => t.grade);
const TECHNIQUES_BY_PROVENANCE: ReadonlyMap<TechniqueProvenance, readonly TechniqueEntry[]> =
    buildGroups(t => t.provenance);
/** Key is the element name, or the literal string 'none' for elementless arts. */
const TECHNIQUES_BY_ELEMENT: ReadonlyMap<Element | 'none', readonly TechniqueEntry[]> =
    buildGroups(t => (t.element ?? 'none') as Element | 'none');

function buildGroups<K>(key: (t: TechniqueEntry) => K): ReadonlyMap<K, readonly TechniqueEntry[]> {
    const map = new Map<K, TechniqueEntry[]>();
    for (const t of TECHNIQUES) {
        const k = key(t);
        const bucket = map.get(k);
        if (bucket) bucket.push(t);
        else map.set(k, [t]);
    }
    return map;
}

/**
 * Techniques bucketed by the ordinal at which they become available, indexed
 * 0..44. `findTechniquesForOrdinal` walks a prefix of this rather than
 * filtering the whole catalog.
 */
const TECHNIQUES_BY_REQUIRED_ORDINAL: readonly (readonly TechniqueEntry[])[] = (() => {
    const buckets: TechniqueEntry[][] = Array.from({ length: TOTAL_RANKS }, () => []);
    for (const t of TECHNIQUES) buckets[t.requiredOrdinal].push(t);
    return buckets;
})();

// ─────────────────────────────────────────────────────────────────────────
// LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

export function getTechnique(id: string): TechniqueEntry | undefined {
    return TECHNIQUE_BY_ID.get(id);
}

/**
 * The sword is a school, and flight on a blade belongs to it.
 */
export const SWORD_SUBJECT = 'sword';

/** Every art whose subject is the blade, strongest requirement last. */
export const SWORD_ARTS: readonly TechniqueEntry[] = TECHNIQUES
    .filter(t => isOnRoad(t, SWORD_SUBJECT))
    .slice()
    .sort((a, b) => a.requiredOrdinal - b.requiredOrdinal || (a.id < b.id ? -1 : 1));

/** Whether this art is one of the school's. Read off the row, never a list. */
export function isSwordArt(techniqueId: string): boolean {
    const t = getTechnique(techniqueId);
    return t !== undefined && isOnRoad(t, SWORD_SUBJECT);
}

/**
 * The flower is a school, and taking without ending the stand belongs to it.
 */
export const FLOWER_SUBJECT = 'flower';

/** Every art whose subject is the bed, strongest requirement last. */
export const FLOWER_ARTS: readonly TechniqueEntry[] = TECHNIQUES
    .filter(t => isOnRoad(t, FLOWER_SUBJECT))
    .slice()
    .sort((a, b) => a.requiredOrdinal - b.requiredOrdinal || (a.id < b.id ? -1 : 1));

/** Whether this art is one of the school's. Read off the row, never a list. */
export function isFlowerArt(techniqueId: string): boolean {
    const t = getTechnique(techniqueId);
    return t !== undefined && isOnRoad(t, FLOWER_SUBJECT);
}

/**
 * Whether this cultivator takes from a bed the way the school takes.
 */
export function takesWithoutEndingTheStand(input: {
    /** Every art they hold. Order is not read. */
    knownTechniqueIds: readonly string[];
    /** `dao.subject` from `assessDao`. Null for almost everybody. */
    daoSubject?: string | null;
}): boolean {
    if (input.daoSubject === FLOWER_SUBJECT) return true;
    return input.knownTechniqueIds.some(isFlowerArt);
}

/** Throwing variant, for engine paths where a missing id is a bug, not input. */
export function requireTechnique(id: string): TechniqueEntry {
    const t = TECHNIQUE_BY_ID.get(id);
    if (!t) throw new Error(`Unknown technique: ${id}`);
    return t;
}

export function getTechniquesByCategory(category: TechniqueCategory): readonly TechniqueEntry[] {
    return TECHNIQUES_BY_CATEGORY.get(category) ?? [];
}

export function getTechniquesByGrade(grade: TechniqueGrade): readonly TechniqueEntry[] {
    return TECHNIQUES_BY_GRADE.get(grade) ?? [];
}

/** Pass null for the elementless arts every root may safely cultivate. */
export function getTechniquesByElement(element: Element | null): readonly TechniqueEntry[] {
    return TECHNIQUES_BY_ELEMENT.get(element ?? 'none') ?? [];
}

/**
 * Arts by how they are obtained. `getTechniquesByProvenance('ruin')` is the
 * loot table for sealed sites - the reason a talentless cultivator digs.
 */
export function getTechniquesByProvenance(provenance: TechniqueProvenance): readonly TechniqueEntry[] {
    return TECHNIQUES_BY_PROVENANCE.get(provenance) ?? [];
}

/**
 * Arts the world can name and cannot produce. Nothing hands one of these over
 * and nothing is supposed to: they are here so that an art with no route is a
 * stated fact rather than a hole nobody has noticed yet.
 */
export function getTechniquesWithNoSurvivingCopy(): TechniqueEntry[] {
    return TECHNIQUES.filter(t => !t.survivingCopy);
}

/**
 * Fragments of a destroyed house's discipline. Pass a house id to get just
 * that house's remains, or omit it for every fragment in the catalog.
 */
export function getFragmentTechniques(destroyedHouseId?: string): TechniqueEntry[] {
    return TECHNIQUES.filter(t => t.fragmentOf !== null
        && (destroyedHouseId === undefined || t.fragmentOf === destroyedHouseId));
}

/** Everything no living teacher can transmit: ruin and grave sources together. */
export function getRecoveredTechniques(): TechniqueEntry[] {
    return [...getTechniquesByProvenance('ruin'), ...getTechniquesByProvenance('grave')];
}

export interface TechniqueQuery {
    category?: TechniqueCategory;
    grade?: TechniqueGrade;
    /** Elements the cultivator can channel. Elementless arts always match. */
    elements?: readonly Element[];
    /** When true, only arts with no element are returned. */
    elementlessOnly?: boolean;
    /**
     * Exclude forbidden arts, which are never legitimately taught - and, with them,
     * any art that `runsOn: 'the_others'`.
     */
    excludeForbidden?: boolean;
    /** Restrict to one source: what a sect can teach, or what must be dug up. */
    provenance?: TechniqueProvenance;
}

/**
 * Every technique a cultivator at `ordinal` is high enough to begin learning.
 * Walks the prefix buckets, so cost is proportional to what is returned rather
 * than to the size of the catalog.
 */
export function findTechniquesForOrdinal(ordinal: number, opts: TechniqueQuery = {}): TechniqueEntry[] {
    const cap = Math.max(0, Math.min(MAX_ORDINAL, Math.floor(ordinal)));
    const out: TechniqueEntry[] = [];
    for (let i = 0; i <= cap; i++) {
        for (const t of TECHNIQUES_BY_REQUIRED_ORDINAL[i]) {
            if (opts.category && t.category !== opts.category) continue;
            if (opts.grade && t.grade !== opts.grade) continue;
            if (opts.provenance && t.provenance !== opts.provenance) continue;
            if (opts.excludeForbidden && (t.category === 'forbidden' || t.runsOn === 'the_others')) continue;
            if (opts.elementlessOnly && t.element !== null) continue;
            if (opts.elements && t.element !== null && !opts.elements.includes(t.element)) continue;
            out.push(t);
        }
    }
    return out;
}

/**
 * The highest-grade arts a cultivator can currently reach, which is what a shop, a
 * sect library, or an inheritance should actually be offering.
 */
export function findBestTechniquesForOrdinal(ordinal: number, opts: TechniqueQuery = {}): TechniqueEntry[] {
    const eligible = findTechniquesForOrdinal(ordinal, opts);
    if (eligible.length === 0) return [];
    const best = eligible.reduce((max, t) => Math.max(max, gradeRank(t.grade)), 0);
    return eligible.filter(t => gradeRank(t.grade) === best);
}

/** Grade band a given ordinal currently sits in. */
export function gradeForOrdinal(ordinal: number): TechniqueGrade {
    const clamped = Math.max(0, Math.min(MAX_ORDINAL, Math.floor(ordinal)));
    for (const grade of GRADE_ORDER) {
        const band = GRADE_ORDINAL_BANDS[grade];
        if (clamped >= band.min && clamped <= band.max) return grade;
    }
    // Only reachable at True Immortal, which is above every content band. A
    // cultivator who completed the crossing is past manuals; report the top.
    return 'chaos';
}

// LIVING TEACHERS

export interface LivingTransmission {
    /** The person, by their row in `members.ts`. */
    memberId: string;
    /** What they can personally carry somebody through. Real technique ids. */
    techniqueIds: readonly string[];
    /** What they want for it. Never money alone - see rule 2. */
    wants: string;
    /**
     * Why the person and not the shelf they stand next to.
     *
     * The load-bearing field. If a house teaches the same art off its own
     * shelf, the individual adds nothing and this row should not exist.
     */
    whyNotTheShelf: string;
}

export const LIVING_TRANSMISSIONS: readonly LivingTransmission[] = [
    {
        memberId: 'member-xu-zhenshan',
        techniqueIds: ['mountain-vein-devouring-canon'],
        wants:
            'To be taken to a perimeter he has not surveyed, and left alone at it for a season. He will not say which perimeters he has already done and he keeps the list on him.',
        whyNotTheShelf:
            'The Anchorhold teaches the canon and teaches it badly, because the house understands it as a method for drawing on a vein and Xu Zhenshan is the only person in either province who has worked out that it is a method for measuring one. The shelf version works. His version tells the student what they are standing on, which is a different art wearing the same title.'
    },
    {
        // Was the Flame Sovereign, who stands at 34 and cannot walk anybody to
        // 37. The guard caught it, which is the guard doing its job: a teacher
        // who has not stood where the book ends cannot take a student there,
        // and the whole value of a person over a shelf is that they have.
        memberId: 'member-the-one-who-introduces-herself-as-four-bonds-and-a-name',
        techniqueIds: ['cinder-lung-tempering-canon'],
        wants:
            'That the student keeps whatever they came in holding. She will not take a severance and will not witness one, and she has never explained why to anybody who did not already know.',
        whyNotTheShelf:
            'The Severed shelve this canon and will teach it to their own, at the Severed price: the house takes something first, itemised, in advance, and the itemisation is the point of the house. She teaches the same canon and takes nothing, which is not a discount - it is the single largest disagreement inside a house that agrees on almost everything, and everybody involved understands that she is allowed to do it because of what she paid to be allowed to.'
    },
    {
        memberId: 'member-court-sovereign-yan-shu',
        techniqueIds: ['rime-heart-stillness-canon'],
        wants:
            'Nothing that can be given. She teaches the two or three people a century who arrive already holding a mutated ice root and already at Body Integration, and what she wants from them is that they stay, which most of them do.',
        whyNotTheShelf:
            'This is the narrowest door in the world and it is a door rather than a wall only because of her. The Frostmirror Court will not open its library to anybody without a mutated ice root, so the library is not a route for the overwhelming majority of the ladder - and the Sovereign is the reason the remaining few do not simply have to steal it.'
    },
    {
        memberId: 'member-pei-hanzhang',
        techniqueIds: ['void-tide-breathing-canon'],
        wants:
            'The name of who opened the site he took it out of, which he does not have and has wanted for two hundred years. He will teach on the strength of a credible lead and has twice taught on an incredible one.',
        whyNotTheShelf:
            'No shelf anywhere holds it. It is a ruin manual and its only other route is a trial calibrated for the disciples of a house that no longer exists - so a living person who dug it up, read it, and survived it is the single most valuable thing at Void Refinement that a cultivator can actually walk up to and talk to.'
    },
    {
        memberId: 'member-ru-anwei',
        techniqueIds: ['heaven-conversing-primordial-canon'],
        wants:
            'To be asked in person, which is the entire difficulty. She has not left the inner hall in three hundred and eighty years and the whole of the Pavilion exists to make sure nobody needs her to.',
        whyNotTheShelf:
            'There is no shelf. The canon is a parting gift in a shed and three loose volumes in three houses, and she is the only living person known to have read the whole of it. She is also, and not coincidentally, the reason the 37-40 stretch is survivable at all: the alternative to a dead woman\'s estate is a living woman\'s attention, and the second is harder to get and worth more.'
    }
];

const TRANSMISSIONS_BY_TECHNIQUE: ReadonlyMap<string, readonly LivingTransmission[]> = (() => {
    const map = new Map<string, LivingTransmission[]>();
    for (const t of LIVING_TRANSMISSIONS) {
        for (const id of t.techniqueIds) {
            const bucket = map.get(id);
            if (bucket) bucket.push(t);
            else map.set(id, [t]);
        }
    }
    return map;
})();

/** Who could personally carry somebody through this art. */
export function teachersOf(techniqueId: string): readonly LivingTransmission[] {
    return TRANSMISSIONS_BY_TECHNIQUE.get(techniqueId) ?? [];
}

/**
 * The highest rung TEACHING can put somebody on, for this book.
 */
export function teachableEndOf(techniqueId: string): number | null {
    const art = getTechnique(techniqueId);
    if (!art || art.class !== 'cultivation') return null;
    return art.cap === null
        ? LAST_CROSSING_ORDINAL
        : Math.min(art.cap, LAST_CROSSING_ORDINAL);
}

/**
 * How far this teacher can actually take a student in this art.
 */
export function carriesTo(memberOrdinal: number, techniqueId: string): number | null {
    const end = teachableEndOf(techniqueId);
    if (end === null) return null;
    return Math.min(memberOrdinal, end);
}

/** Everything this person can transmit. */
export function transmissionsBy(memberId: string): readonly LivingTransmission[] {
    return LIVING_TRANSMISSIONS.filter(t => t.memberId === memberId);
}

