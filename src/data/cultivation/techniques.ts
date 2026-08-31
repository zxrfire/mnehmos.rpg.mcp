/**
 * Technique (art) library.
 *
 * Content, not engine. Every entry here is inert data that the cultivation
 * engine resolves against; nothing in this file decides anything.
 *
 * TIERING CONTRACT
 * ----------------
 * The five technique grades map onto disjoint, ordered bands of the 45-rank
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

import type { Technique, TechniqueGrade, TechniqueCategory, Element } from '../../schema/cultivation.js';
import { MAX_ORDINAL, TOTAL_RANKS, LAST_CROSSING_ORDINAL } from '../../engine/cultivation/realms.js';

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

export interface TechniqueEntry extends Technique {
    provenance: TechniqueProvenance;
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
    'ash-of-the-first-sun',
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
    'word-of-continuance',
    'heaven-conversing-primordial-canon',
    'chaos-origin-scripture'
]);

/** Arts that only ever surface in a grave deposit. */
export const GRAVE_ONLY_TECHNIQUE_IDS: ReadonlySet<string> = new Set([
    'heart-of-the-ten-thousand-corpses',
    'lifespan-devouring-heaven-theft',
    'debt-collection-in-arrears'
]);

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
 * The ladder's true top is `MAX_ORDINAL` (True Immortal), but that rank is
 * reached only by completing the last crossing, and a cultivator who has gone
 * through the Lid is not in the world any more to read a manual, join a sect
 * or dig a ruin. Content therefore covers 0 through the last crossing, and the
 * chaos band's ceiling is that ordinal rather than the ladder's.
 */
export const CONTENT_MAX_ORDINAL = LAST_CROSSING_ORDINAL;

/**
 * Realm-ordinal window in which each grade is learnable. Aligned to realm
 * boundaries: mortal manuals are Qi Condensation, earth manuals carry you
 * through Foundation and Core, heaven through Nascent Soul and Deity
 * Transformation, immortal through Void Refinement and Body Integration, and
 * chaos manuals only exist for Grand Ascension and above.
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
 */
export const GRADE_QI_BANDS: Record<TechniqueGrade, Band> = {
    mortal: { min: 2, max: 14 },
    earth: { min: 15, max: 49 },
    heaven: { min: 50, max: 129 },
    immortal: { min: 130, max: 349 },
    chaos: { min: 350, max: 900 }
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

/**
 * Authoring helper. Mastery is per-cultivator state, never catalog state, so
 * every entry starts at zero and the factory keeps that out of the literals.
 * Provenance is resolved from the two id sets above rather than repeated on
 * every entry, so the Late Age rule reads as one block instead of eighty-odd
 * scattered flags.
 */
function art(t: Omit<Technique, 'mastery'>): TechniqueEntry {
    const provenance: TechniqueProvenance = GRAVE_ONLY_TECHNIQUE_IDS.has(t.id)
        ? 'grave'
        : RUIN_ONLY_TECHNIQUE_IDS.has(t.id)
            ? 'ruin'
            : 'taught';
    return {
        ...t,
        mastery: 0,
        provenance,
        sourceNote: SOURCE_NOTES[provenance],
        fragmentOf: FRAGMENT_TECHNIQUE_ORIGINS[t.id] ?? null
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
        name: 'Ashfall Crescent',
        category: 'attack',
        grade: 'mortal',
        element: 'fire',
        requiredOrdinal: 11,
        qiCost: 13,
        damage: '3d6+2',
        cooldown: 2,
        description:
            'A low arc of fire qi swept along the ground, leaving a crescent of grey ash that stays warm until morning. The last art most Qi Condensation cultivators bother to master before their bottleneck.'
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
        id: 'ash-of-the-first-sun',
        name: 'Ash of the First Sun',
        category: 'attack',
        grade: 'immortal',
        element: 'fire',
        requiredOrdinal: 35,
        qiCost: 300,
        damage: '14d20+70',
        cooldown: 5,
        description:
            'Fire qi refined past light and past heat into something that simply ends processes. What is left is a fine pale ash that will not scatter in wind and is cold to the touch.'
    }),

    // ═══════════════════════════════════════════════════════════════════
    // ATTACK - CHAOS (Grand Ascension / Tribulation Transcendence)
    // ═══════════════════════════════════════════════════════════════════
    art({
        id: 'calamity-word-of-the-open-sky',
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
            'The body is burned down to what is essential and reassembled from the ash by fire qi that has been taught the shape. Survivors describe it as the worst hour of their several thousand years.'
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
        requiredOrdinal: 19,
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
        requiredOrdinal: 26,
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
        requiredOrdinal: 34,
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
        requiredOrdinal: 44,
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
        requiredOrdinal: 42,
        qiCost: 780,
        damage: '26d20+180',
        cooldown: 10,
        description:
            'Spends years off the end of the user\'s own allotted lifespan as ammunition. At Tribulation Transcendence there is a great deal of lifespan to spend, and cultivators who reach the tribulation with this art rarely have enough left to survive it.'
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
