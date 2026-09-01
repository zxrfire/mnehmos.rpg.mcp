/**
 * Technique (art) library.
 *
 * Content, not engine. Every entry here is inert data that the cultivation
 * engine resolves against; nothing in this file decides anything.
 *
 * TIERING CONTRACT
 * ----------------
 * The five technique grades map onto disjoint, ordered bands of the 47-rank
 * ladder (see `GRADE_ORDINAL_BANDS`). A manual is never learnable before its
 * band opens, so at every point on the ladder there is a visible next tier the
 * cultivator cannot yet touch. Qi costs are banded the same way, so grade is a
 * single number the player can reason about: higher grade means later, costlier
 * and stronger, with no exceptions anywhere in this catalog.
 *
 * ELEMENTS
 * --------
 * `element` must be one of the seven in `ElementSchema`, or null. Null means
 * elementless: any spirit root may cultivate the art without wuxing conflict,
 * which is why elementless arts are usually a little weaker per qi spent than
 * an elemental art of the same grade used by a matching root.
 *
 * The two mutated elements (lightning, ice) are deliberately starved. A mutated
 * root cultivates faster and hits harder than anyone, and then discovers that
 * the world contains almost no manuals it can use - see
 * `techniqueAvailability` on the mutated roots in `spirit-roots.ts`. This file
 * is where that scarcity is actually made true: every wuxing element has
 * strictly more arts than either mutated element does.
 *
 * DAMAGE
 * ------
 * `damage` is a dice expression the existing dice engine can parse
 * (`src/math/dice.ts`): `NdX`, with an optional flat modifier and an optional
 * trailing `!` for exploding dice. Compound expressions such as "2d6+1d4" are
 * NOT parseable and must never appear here. Healing arts express their
 * magnitude in the same field - the engine reads the category to know whether
 * the rolled number is taken off a target or put back into one.
 */

import type {
    InsightDomain,
    Technique,
    TechniqueClass,
    TechniqueGrade,
    TechniqueCategory,
    Element
} from '../../schema/cultivation.js';
import {
    FALSE_IMMORTAL_ORDINAL,
    MAX_ORDINAL,
    TOTAL_RANKS,
    TRUE_IMMORTAL_ORDINAL,
    realmForOrdinal
} from '../../engine/cultivation/realms.js';

// ─────────────────────────────────────────────────────────────────────────
// PROVENANCE - the Late Age rule
// The world is poorer than it was. Veins that ran rich for a thousand years
// have been drawn down, old wars killed whole regions outright, and what the
// fallen civilisations did not consume they monopolised. Nobody has ascended
// in living memory, and the manuals describing the upper realms were written
// by people who are not available to explain them.
//
// So a technique is not simply "available at ordinal N". It has a source, and
// above a certain grade that source is never a teacher:
//
//   taught → a living sect holds a working transmission of it.
//   ruin   → recovered from a sealed site. No living teacher exists; the manual
//            is the teacher, and it was not written for a reader like you.
//   grave  → taken off a body. Cultivators die carrying everything they own,
//            most of them die somewhere remote, and what they were part-way
//            through is still on them. Disreputable, extremely profitable, and
//            it attracts attention, because sects keep records of where their
//            people fell.
//
// This is what makes digging a viable path for a cultivator born without
// talent, or born somewhere poor. You will not out-cultivate a single-root
// prodigy on the ambient qi of a late age. You might out-dig them.
// ─────────────────────────────────────────────────────────────────────────

export type TechniqueProvenance = 'taught' | 'ruin' | 'grave';

// ─────────────────────────────────────────────────────────────────────────
// SHOWN OR READ - the rule underneath provenance
//
// This applies to every art in the catalog, at every grade, from the first
// mortal breathing method to whatever is above the Lid. There are two ways an
// art gets into somebody, and they are not two speeds of one thing:
//
//   shown - a master performs it in front of you. They answer the question you
//           did not know to ask, they correct the hand before the error sets,
//           and they can repeat the half-second the whole art turns on until
//           you have it. Most of what a teacher transmits was never in any
//           manual, because most of it is not language.
//
//   read  - the manual is the teacher. It cannot answer, cannot correct, and
//           cannot repeat anything; the reader rebuilds the missing half-second
//           themselves, out of a description written by somebody who was not
//           imagining them. It works. It takes far longer, it fails in ways
//           that leave no explanation, and the failures are usually discovered
//           at the point of use.
//
// `provenance` decides which one a given copy of an art offers: `taught` is a
// shown art, `ruin` and `grave` are read ones. That is the real reason the
// upper grades are harder to acquire than their ordinal band suggests, and the
// reason a poor cultivator with a dug-up manual stays behind a sect disciple
// holding the same art even after both of them have it.
//
// It is also the rule the ten-to-fifteen breath exception is a limiting case
// of. Seeing an immortal act is the shown channel operating at a rung that has
// no teachers, and it is worth what it is worth for the ordinary reason - not
// because immortals are special, but because being shown always beats reading,
// and that is the only demonstration anyone up there will ever give.
// ─────────────────────────────────────────────────────────────────────────

/** Which of the two channels a copy of an art offers its holder. */
export type TransmissionMode = 'shown' | 'read';

/** Shown or read, from where the art came from. */
export function transmissionModeOf(provenance: TechniqueProvenance): TransmissionMode {
    return provenance === 'taught' ? 'shown' : 'read';
}

// ─────────────────────────────────────────────────────────────────────────
// OPACITY - and why the two channels do not differ by a fixed amount
//
// Arts are not equally hard to understand, and the difference is not their
// grade. A blunt art with one idea in it can be taken off a page by a competent
// reader with very little lost. An art whose whole content is timing, or
// intent, or a relationship between two things the writer could only gesture
// at, loses most of itself on the way onto the page and has to be rebuilt by
// the reader out of almost nothing.
//
// So opacity is what decides how much the read channel actually costs. A plain
// art is nearly as good read as shown. An opaque one is barely transmissible in
// writing at all, which is why some famous manuals have been held for centuries
// by houses full of people who can recite them and cannot perform them.
//
// This runs across the grades rather than with them. Most upper-grade arts are
// opaque, which is the baseline below - but the interesting entries are the
// ones that are not: a mortal-grade art nobody can read their way into, and a
// chaos-grade art that turns out to be shockingly plain once somebody finally
// sees the trick done. Those are set per entry.
// ─────────────────────────────────────────────────────────────────────────

/**
 * How much of an art fails to survive being written down, 0..1.
 *
 * 0 is an art that loses nothing on the page. 1 is an art that is functionally
 * untransmissible in writing - the manual is real, complete, honest, and will
 * not get a reader there.
 */
export type Opacity = number;

/**
 * What an art of this grade is usually like, absent a reason to say otherwise.
 *
 * Higher grades are generally more opaque because more of what they contain is
 * the part that is not language. A baseline, not a rule: an entry that says
 * otherwise overrides it, and those entries are the ones worth writing.
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
 * How much longer this copy of this art takes to learn than the same art shown
 * by a master who has it.
 *
 * A shown art is the reference: 1. A read art pays its opacity - a perfectly
 * plain art read is barely slower than shown, and a fully opaque one takes
 * three times as long and may not land at all.
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
     *
     * True for all but a handful. `provenance` answers how a copy would reach
     * somebody if one reached them; this answers the prior question, which the
     * catalog used to leave to silence. See `NO_SURVIVING_COPY_TECHNIQUE_IDS`.
     */
    survivingCopy: boolean;
    /**
     * Why a sufficient dao could NOT reconstruct this one, or null.
     *
     * The counterpart to `derivable`, held to the same discipline as
     * `NO_SURVIVING_COPY_NOTES`: an absence with a reason attached is a
     * design statement, and an absence without one is missing content.
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
// ─────────────────────────────────────────────────────────────────────────
// THE CORRIDOR ABOVE THE MIDDLE
//
// Measured in `docs/world/escapes.md`: the ladder above ordinal 17 is not a
// ladder, it is a single-file corridor. At most heights the world offers
// exactly ONE cultivation manual that continues, and usually wants a specific
// element for it. Three of the choke points are single-source; one is a house
// that will not open its library to anybody without a mutated ice root.
//
// That narrowness is the design and it is not a defect. What WOULD be a
// defect is a choke point with one route, because a route is a thing that can
// fail to be found, and a corridor whose only door is somebody else's estate
// is a corridor that reads as missing content rather than as scarcity.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Manuals that exist in parts, and the OBJECT rows those parts are.
 *
 * A volume is a physical copy of a piece of a book: it has a holder, a
 * provenance and a power one rung below the whole, by `shardPower`. So it
 * lives in the object catalog rather than here, and this is the join.
 *
 * There is deliberately no second cap field. A partial set's ceiling is
 * DERIVED from how many volumes are held, by the engine, using the same
 * arithmetic that turns a broken blade into a worse blade.
 *
 * WHY THIS ONE. `heaven-conversing-primordial-canon` is the only continuation
 * anywhere between ordinal 37 and 40, and its only route was a parting gift -
 * a dead man's estate in a shed with a bad roof. One route, at the narrowest
 * point on the ladder. Rather than delete that (it is the best-written route
 * in the catalog: the largest body of chaos-grade transmission in two
 * provinces, safe because the people holding it stand at Core Formation and
 * cannot read a character of it), the work is scattered. The shed holds the
 * complete set. Three separate volumes are also loose in three houses, none
 * of which has all three and two of which do not know what they are holding.
 *
 * So the corridor now has two doors: take the estate, or find three people.
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
 *
 * Opt-in, and deliberately short. Derivation is the prodigy's road, not the
 * way missing content gets papered over - the same discipline
 * `NO_SURVIVING_COPY_TECHNIQUE_IDS` is held to. If this set ever grows to
 * cover the choke points, the corridor has been quietly abolished rather than
 * opened, and the routes suite says so.
 *
 * What makes one derivable is that its road is walked rather than transmitted:
 * an art whose method a person could arrive at from their own comprehension,
 * given enough of it. What makes one not is written on the entry.
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
    'meridian-devouring-art'
]);

/**
 * Why a particular manual cannot be reconstructed, however deep the reader.
 *
 * A stated absence, in the idiom `NO_SURVIVING_COPY_NOTES` established. These
 * are the interesting refusals - the ones where "you cannot derive this" is a
 * fact about the book rather than about the reader.
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
    'heart-of-the-ten-thousand-corpses',
    'lifespan-devouring-heaven-theft',
    'debt-collection-in-arrears'
]);

/**
 * Arts the record attests and no copy of which is anywhere in the world.
 *
 * The three provenances above all assume a copy exists somewhere and argue
 * about how it would reach a reader. This set is the case they cannot state:
 * an art the world can name, date and describe the effect of, and cannot
 * produce, because every party who held the working died holding it and none
 * of them wrote it out. Nothing anywhere hands one of these over, and the
 * catalog says so here rather than by leaving the entry unreferenced and
 * hoping somebody notices - which is exactly how it went wrong before.
 *
 * Keep it small and keep the reason specific. An art belongs here only where
 * the entry's own description already says the transmission is gone; an art
 * that is merely hard to find belongs in a sealed site, and the audit will
 * make that argument for it if nobody else does.
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

const SOURCE_NOTES: Record<TechniqueProvenance, string> = {
    taught: 'Transmitted by at least one living sect. A teacher exists and can be paid, joined, or robbed.',
    ruin: 'Recovered, not taught. Copies survive only in sealed sites, and no living cultivator learned it from a person.',
    grave: 'Taken off a body. Somebody died carrying it, somewhere remote enough that it stayed where they fell, and their sect very likely knows where that was.'
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
 *
 * It used to be the last crossing, on the reasoning that above it nothing
 * circulates. That reasoning was half right and the half it got wrong is the
 * interesting one. Nothing circulates up there in the ordinary sense - no sect
 * teaches these, no ruin was stocked with them and nobody is walking around
 * with one on a body - but each of the two rungs above the Lid has exactly one
 * channel, both channels are real, and both now have entries at the far end of
 * them. So the ceiling is the ladder's own top and the scarcity is carried by
 * how few arts sit up there and how narrow the way to them is, rather than by
 * the catalog declining to write them down.
 *
 * What has NOT changed is why this constant is separate from the Lid. A manual
 * is paper: `MANUALS_MAY_EXCEED_THE_LID` is true, an art may sit anywhere on
 * the ladder and still be handed over down here, and the reader is exactly the
 * rung they were afterwards - see `WHAT_AN_ART_BUYS`. The ceiling on what can
 * be HELD is `OBJECT_CEILING_BELOW_THE_LID` and it is a different number about
 * a different kind of thing. This one is a statement about authoring and
 * nothing else.
 *
 * It is also not the bound on anything but arts. Encounters, sites and the
 * rest cover the playable ladder, which stops at `LAST_CROSSING_ORDINAL`,
 * because nobody above the Lid is rolling for what they meet on the road.
 *
 * See `ABOVE_THE_LID_TRANSMISSION` for the two channels.
 */
export const CONTENT_MAX_ORDINAL = MAX_ORDINAL;

/**
 * The two rungs above the Lid, one per channel.
 *
 * Nothing new is invented here. Both entries are the shown-or-read rule applied
 * to a rung where only one of the two channels exists at all, which is why they
 * are worth stating: 45 is shown and never read, 46 is read and almost never
 * shown, and what those two produce is the rule's clearest demonstration
 * anywhere in the world.
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
         *
         * `mode` above is a statement about the transmission and it stands. What
         * the faces are is the residue of it: a lecture needs a surface, he does
         * not take the stone away with him afterwards, and what is left is
         * legible in the ordinary hand of the province because it was cut for
         * the people who were in the room. That is a different act from the
         * durable carving in `CARVING`, which is what path three does when there
         * is nobody left to hand anything to, and he has not done that one.
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
 * boundaries: mortal manuals are Qi Condensation, earth manuals carry you
 * through Foundation and Core, heaven through Nascent Soul and Deity
 * Transformation, immortal through Void Refinement and Body Integration, and
 * chaos manuals only exist for Grand Ascension and above.
 *
 * The chaos band runs to the top of the ladder rather than to the last
 * crossing, which is a consequence of `CONTENT_MAX_ORDINAL` and not a sixth
 * grade: the arts above the Lid are ordinary rows with large numbers in them,
 * in the same band as everything else at the top, and nothing anywhere reads
 * their ordinal to decide anything.
 */
export const GRADE_ORDINAL_BANDS: Record<TechniqueGrade, Band> = {
    mortal: { min: 0, max: 12 },
    earth: { min: 13, max: 20 },
    heaven: { min: 21, max: 28 },
    immortal: { min: 29, max: 36 },
    chaos: { min: 37, max: CONTENT_MAX_ORDINAL }
} as const;

/**
 * Qi cost window per grade. Bands do not overlap, so a chaos art is never
 * cheaper than an immortal one, and the qi pool a cultivator has at a given
 * realm is what gates how often the art is usable.
 *
 * The chaos ceiling was 900, which was the whole band when the band stopped at
 * the last crossing. It was widened rather than reused when the catalog took in
 * the two rungs above the Lid, for the ordinary reason the bands exist at all:
 * an art nine rungs up from the bottom of its band should not cost what the art
 * at the bottom of it costs. Nothing above the Lid pays in this currency in any
 * case - `progressRequiredForOrdinal` returns null up there and says why - so
 * the figures on those entries are the band being honest about ordering rather
 * than a price anybody settles.
 */
export const GRADE_QI_BANDS: Record<TechniqueGrade, Band> = {
    mortal: { min: 2, max: 14 },
    earth: { min: 15, max: 49 },
    heaven: { min: 50, max: 129 },
    immortal: { min: 130, max: 349 },
    chaos: { min: 350, max: 1500 }
} as const;

/** Grades in ascending order. Used by lookups and by the balance tests. */
export const GRADE_ORDER: readonly TechniqueGrade[] = ['mortal', 'earth', 'heaven', 'immortal', 'chaos'] as const;

/** Index of a grade in the ladder, for comparisons. */
export function gradeRank(grade: TechniqueGrade): number {
    return GRADE_ORDER.indexOf(grade);
}

// ─────────────────────────────────────────────────────────────────────────
// CATALOG
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// THE TWO KINDS OF ART, AND THE CEILING ON ONE OF THEM
//
// A cultivation manual is what you PRACTISE to rank up. A dao art is what you
// USE to fight. The catalog had been conflating them under `category`, which
// answers a different question - what the art does mechanically - and only one
// of the two kinds carries a ceiling.
//
// ── Why the cap belongs to the book ──────────────────────────────────────
//
// The faction catalog already says what each house can produce:
// `production.reliableOrdinal`, on 38 factions, and `members.ts` already
// generates their rosters against it. So the NPCs obey the ceiling and only
// the player was exempt - climbing to ordinal 44 on the roll of a house whose
// catalog reads `reliableOrdinal: 14`.
//
// The fix is NOT a per-house rule. It is that a low-tier house teaches a
// low-tier manual, and the manual stops. Nothing anywhere branches on the
// sect; the cap is a fact about the paper in your hands, and it is the same
// fact whoever handed it over - a teacher, a corpse, a tomb, or a False
// Immortal's leavings.
//
// That also disposes of the Hollow Court, which reads `reliableOrdinal: 0`
// while sitting at power ordinal 40. Its own note says why: "Produces nobody,
// by construction: it takes no disciples." Zero is a statement about INTAKE,
// not about the quality of anything it could teach, and a cap derived from the
// house would have handed the strongest institution in the world a ceiling of
// zero. Deriving from the manual instead means the question never arises.
//
// ── One realm per book ───────────────────────────────────────────────────
//
// The cap is the end of the realm the manual is pitched at, plus one - so a
// manual carries a cultivator through its realm, one step over the boundary,
// and then stops dead. The ordinary progression is therefore a SUCCESSION of
// manuals, each needing to be replaced at a realm boundary, which is what
// sends a player looking for the next volume.
//
// Independent of suitability, deliberately. A manual has both a cap and a fit
// to a spirit root, and they do not interact: a perfectly suited manual still
// runs out, and an ill-suited one teaches nothing at any height.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Arts that raise a rank despite not being filed under `cultivation`.
 *
 * The override exists because `category` and `class` are genuinely different
 * axes and a demonic qi-gathering method is both forbidden AND a manual you
 * practise to climb. Everything not named here follows its category.
 */
const CULTIVATION_CLASS_TECHNIQUE_IDS: ReadonlySet<string> = new Set([
    // Forbidden methods that ARE progression: they raise a rank, by means the
    // orthodox road does not use and at prices it will not pay.
    'nine-abyss-demon-transformation',
    'heart-of-the-ten-thousand-corpses',
    'lifespan-devouring-heaven-theft',
    'meridian-devouring-art'
]);

/** Which of the two kinds an art is. One rule, plus a named override set. */
export function classOf(t: Pick<Technique, 'id' | 'category'>): TechniqueClass {
    if (CULTIVATION_CLASS_TECHNIQUE_IDS.has(t.id)) return 'cultivation';
    return t.category === 'cultivation' ? 'cultivation' : 'dao';
}

/**
 * The rung a manual stops at, or null when it stops at nothing.
 *
 * Null is reserved for a manual whose realm band runs to the top of the
 * ladder. `MANUALS_MAY_EXCEED_THE_LID` is true in `realms.ts` - a manual is
 * paper, it may be rated anywhere, and studying one to full mastery leaves the
 * reader exactly the rung they were - so a book that carries somebody the
 * whole way is legal where no OBJECT below ordinal 45 is. It is the top prize
 * in the setting and there is exactly one route to each such book, all of them
 * `ruin` or `grave`. Nobody teaches these.
 */
export function capOf(t: Pick<Technique, 'id' | 'category' | 'requiredOrdinal'>): number | null {
    if (classOf(t) !== 'cultivation') return null;
    const band = realmForOrdinal(t.requiredOrdinal);
    const cap = band.ordinalEnd + 1;
    return cap > MAX_ORDINAL ? null : cap;
}

/**
 * Whether a manual reaches further than its own realm geometry would give it.
 *
 * `capOf` is `realmEnd + 1`, so an ordinary book carries a reader through one
 * realm and one rung over the boundary. A manual whose `cap` exceeds that is
 * a WIDE-SPAN book: it lets somebody skip, which nothing else in the catalog
 * does, and it is the reason a ruin is worth entering rather than a way to
 * save four rungs.
 *
 * Derived rather than flagged, so nothing can claim to be a treasure without
 * actually reaching further than one.
 */
export function isWideSpan(t: Pick<Technique, 'id' | 'category' | 'requiredOrdinal' | 'cap'>): boolean {
    if (classOf(t) !== 'cultivation' || t.cap === null) return false;
    const ordinary = capOf(t);
    return ordinary !== null && t.cap > ordinary;
}

/**
 * Authoring helper. Mastery is per-cultivator state, never catalog state, so
 * every entry starts at zero and the factory keeps that out of the literals.
 * Provenance is resolved from the id sets above rather than repeated on every
 * entry, so the Late Age rule reads as one block instead of eighty-odd
 * scattered flags. Whether a copy exists at all is resolved the same way, and
 * an art with none carries its own reason in place of the generic note.
 */
function art(
    t: Omit<Technique, 'mastery' | 'class' | 'cap' | 'rootGrades' | 'domain' | 'domainDegree' | 'volumes' | 'derivable' | 'opening'>
        & {
            opacity?: Opacity;
            class?: TechniqueClass;
            cap?: number | null;
            rootGrades?: readonly string[];
            domain?: InsightDomain | null;
            domainDegree?: number;
            opening?: { rungs: number; rateMultiplier: number } | null;
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
        opening: t.opening ?? null,
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
        // The narrowest door on the ladder, and the catalog already said so
        // in prose: the Frostmirror Court admits mutated ice roots and
        // nobody else. Written into the manual rather than into the house,
        // because it is a fact about the book - the Court refuses
        // applicants it could not teach, rather than teaching applicants it
        // refuses. Ice is a mutated element, so this is consistent with
        // `element` rather than stricter than it.
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

    // ═══════════════════════════════════════════════════════════════════
    // DAO HOUSE DISCIPLINES
    // What the ancient houses actually teach. None of these is a good
    // way to win a fight; every one of them is a good way to make a fight
    // pointless, expensive, or impossible to walk away from. A house's
    // strength is thousands of years of one principle, and the strength
    // is legible here as reach rather than damage.
    // ═══════════════════════════════════════════════════════════════════
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
        description:
            'Strikes hard for its grade and returns a portion of what it takes to the user\'s own wounds. The tithe is collected from the user\'s lifespan, quietly, and the manual does not mention this until the last page.'
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
        requiredOrdinal: 27,
        qiCost: 110,
        damage: null,
        cooldown: 6,
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
        description:
            'Spends years off the end of the user\'s own allotted lifespan as ammunition. At Tribulation Transcendence there is a great deal of lifespan to spend, and cultivators who reach the tribulation with this art rarely have enough left to survive it.'
    }),

    // ═══════════════════════════════════════════════════════════════════
    // ABOVE THE LID
    // Six rows with large numbers in them and nothing else different about
    // them. They are chaos grade like everything at the top, they are read
    // by the same lookups, and no code anywhere asks what rung they sit at
    // before doing anything - which is the whole reason it is safe to have
    // written them down. See `WHAT_AN_ART_BUYS`: the best art in the world
    // at full mastery buys nothing across the Lid, so a manual up here is
    // paper and an object up here is not, and only one of those two things
    // is in this file.
    //
    // All six are elementless, and that is not a coincidence being dressed
    // up as a rule. The wuxing is an account of how a body draws, both of
    // these rungs are reached by a crossing rather than by drawing, and
    // nobody who has been through one has ever written an elemental art
    // afterwards. It also keeps the mutated-root scarcity where the catalog
    // put it, which is a good check on the reasoning rather than the reason.
    //
    // REACH IS DECLARED ON EVERY ONE OF THEM, DELIBERATELY
    // The harness is blunt about it: somebody at the top of the ladder
    // holding a single-target art does not take a mobilised apex at all,
    // and the same person holding a wide one takes it in about two rounds.
    // So reach is what decides whether the top rungs mean anything, and an
    // entry up here that left the field off would be quietly deciding that
    // they do not.
    // ═══════════════════════════════════════════════════════════════════

    // ── 45: three faces, one man, and no object anywhere behind them ─────
    // Everything at this rung is Lu Sheng's, because the rung is one person
    // wide - see `ABOVE_THE_LID_TRANSMISSION.falseImmortal`. He built these
    // out of what came back from a crossing that did not complete, he holds
    // nothing else at all, and the opacity figures are the highest in the
    // catalog because a face cut where a lecture happened is the read
    // channel operating at a rung that has exactly one teacher who could
    // simply have been asked.
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
        //
        // The corridor above the middle is single-file by design and was
        // single-file to the point of being uninhabitable: a metal root
        // standing at Core Formation had one book in the entire world and it
        // was written for somebody else. Two roads is not a menu; it is the
        // difference between a narrow world and a closed one.
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
        // A SECOND ROAD AT 33-35, which had exactly one, wanted a mutated ice
        // root, and was held by a single house that admits nobody else.
        //
        // That was the narrowest point on the whole ladder and the clearest
        // case of the corridor being too thin to be a world: a fire root
        // arriving at Body Integration had nothing at all in front of it, in
        // any house, at any price.
        id: 'ash-lung-tempering-canon',
        name: 'Ash-Lung Tempering Canon',
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
            'The body integrated through heat rather than through stillness, which the orthodox road regards as a shortcut and which is in fact simply a different and worse-documented amount of work. The practitioner breathes fire-ash until the lungs stop objecting, and the ones it does not kill come out the far side able to do something the still road cannot teach at all.'
    }),
    art({
        // THE WIDE-SPAN BOOK. The one manual in the catalog that lets somebody
        // skip, and the shape of what a treasure has to be.
        //
        // Every other manual carries a reader through exactly one realm and one
        // rung over the boundary, because `capOf` is realm geometry. This one
        // opens at Foundation and closes at Body Integration - twenty rungs,
        // five ordinary books' worth - which is why finding it is worth a ruin
        // rather than worth four rungs.
        //
        // WHAT IT IS GATED ON IS NOT RANK. `requiredOrdinal` is the wrong
        // instrument for a treasure: put a cap-33 book behind ordinal 29 and it
        // can no longer skip anything, which is the whole of what it is for. So
        // it opens at 13, where its grade band opens, and the gate is
        // comprehension instead - `domain: 'void'` at the deepest degree the
        // catalog uses. That is the one axis money cannot buy, because it comes
        // from what has happened to somebody rather than from how long they
        // have sat, and a well-funded heir at Foundation is exactly as far from
        // it as a beggar.
        //
        // AND THE OPENING IS BRUTAL. Eight rungs at a fifth rate: somebody
        // handed this at thirteen crawls to twenty-one on a book that should
        // have carried them there in a third of the time, and only then does it
        // open up. It cannot be coasted on. That is the second half of the
        // price, and it is why the book is a decision rather than a windfall.
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
        // Left at 46, deliberately, and it is the one manual the succession
        // rule does not apply to.
        //
        // Every other realm needs a manual learnable on its first rung or the
        // chain of books dead-ends there. Above the Lid there is no chain:
        // `progressRequiredForOrdinal` returns null from ordinal 45 upward, so
        // there is no progress currency, nothing to accrue, and a gathering
        // canon is not how anybody gets there. Rating this at 45 would also
        // put it on Lu Sheng's rung, where the setting says an art can only
        // have come off one of his faces - and this one came out of a ruin.
        //
        // It is still the one manual in the world with no cap: its band runs
        // to the top of the ladder, so `capOf` returns null and it never runs
        // out. Legal because `MANUALS_MAY_EXCEED_THE_LID` - paper may be rated
        // anywhere, where no object below ordinal 45 may be.
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
    })
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
    /** Exclude forbidden arts, which are never legitimately taught. */
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
            if (opts.excludeForbidden && t.category === 'forbidden') continue;
            if (opts.elementlessOnly && t.element !== null) continue;
            if (opts.elements && t.element !== null && !opts.elements.includes(t.element)) continue;
            out.push(t);
        }
    }
    return out;
}

/**
 * The highest-grade arts a cultivator can currently reach, which is what a
 * shop, a sect library, or an inheritance should actually be offering.
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

// ─────────────────────────────────────────────────────────────────────────
// LIVING TEACHERS
//
// A sixth route, and the one the catalog had no way to express. `provenance`
// answers how a COPY would reach a reader - a shelf, a tomb, a body, a face,
// an estate - and every one of those is paper. A person is not paper.
//
// The engine has always known the difference and said so twice. `opacity` is
// how much of an art fails to survive being written down, which is why the
// catalog can describe famous manuals "held for centuries by houses full of
// people who can recite them and cannot perform them". And `guidanceMultiplier`
// prices a master by the gap between them and the student. Both of those said
// a person transmits better than a book, and neither could be used to GET a
// method, because nothing in the data said which person held which one.
//
// This is that. It is a join table, not a second technique catalog: the arts
// are the same rows read by the same code, and what is new is a name attached
// to one, and a price that is not money.
//
// THREE RULES, and they are what keep this from being a shop.
//
//   1. A teacher stands at or above the manual's cap. Guidance is priced on
//      the gap between guide and guided, and somebody who has not stood where
//      the book ends cannot walk anybody to it. This is checked.
//   2. What they want is never only stones. Every price here is a thing about
//      the student or about the teacher's own unfinished business, because a
//      method somebody can buy is a shelf with extra steps.
//   3. A teacher is not a shortcut past the corridor's shape. They hold arts
//      that exist, at rungs the corridor already gates, and being taught by
//      one is a way THROUGH a choke point rather than around it.
// ─────────────────────────────────────────────────────────────────────────

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
        techniqueIds: ['ash-lung-tempering-canon'],
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
 * How far this teacher can actually take a student in this art.
 *
 * Their own rung or the book's cap, whichever is lower - because guidance is
 * priced on the gap between guide and guided, so nobody walks anybody past
 * where they themselves have stood.
 *
 * That produces a fact worth having rather than a rounding error. The
 * Rime-Heart Stillness Canon ends at 37 and the Frostmirror Court's highest
 * living member stands at 36, so the last rung of the narrowest book in the
 * world has no living teacher anywhere and has to be walked alone. Nobody
 * authored that; it fell out of the two numbers.
 */
export function carriesTo(memberOrdinal: number, techniqueId: string): number | null {
    const art = getTechnique(techniqueId);
    if (!art || art.class !== 'cultivation') return null;
    if (art.cap === null) return memberOrdinal;
    return Math.min(memberOrdinal, art.cap);
}

/** Everything this person can transmit. */
export function transmissionsBy(memberId: string): readonly LivingTransmission[] {
    return LIVING_TRANSMISSIONS.filter(t => t.memberId === memberId);
}

