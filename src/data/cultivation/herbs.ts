/**
 * Spirit herbs - the ingredient layer under alchemy.
 *
 * A pill is only ever as obtainable as its rarest ingredient, so this file is
 * where the real cost of the alchemy system lives. `recipes.ts` references
 * these ids and nothing else; if a herb is not in this catalog, no recipe may
 * name it.
 *
 * There is no herb schema in `src/schema/cultivation.ts` - herbs are content
 * with no engine-side persistence contract yet - so the Zod schema is declared
 * here and exported, ready to be lifted into the shared schema module if and
 * when storage needs it.
 *
 * BALANCE
 * -------
 * Herbs use the same five-grade ladder as techniques and pills. Grade drives
 * three things monotonically: value rises, `rarityWeight` (drawn against, so
 * bigger means more common) falls, and the minimum realm needed to survive the
 * place it grows rises. A mortal cultivator can pick qi grass by the roadside;
 * chaos-grade ingredients grow where a Grand Ascension cultivator dies for
 * reaching them.
 */

import { z } from 'zod';
import {
    RegardProfileSchema,
    TechniqueGradeSchema,
    type TechniqueGrade
} from '../../schema/cultivation.js';
import { MAX_ORDINAL } from '../../engine/cultivation/realms.js';
import {
    narrowToOffered,
    regardOf,
    type Regard,
    type RegardAskerInput
} from '../../engine/cultivation/regard.js';
import type { Band } from './techniques.js';

/**
 * Where a herb grows. Coarse, biome-ish tags rather than named locations, so
 * worldgen can attach them to generated regions without a lore dependency.
 */
export const HerbBiomeSchema = z.enum([
    'roadside',
    'farmland',
    'forest',
    'deep_forest',
    'bamboo_sea',
    'marsh',
    'riverbank',
    'lake_bottom',
    'cave',
    'mountain',
    'high_peak',
    'glacier',
    'volcanic',
    'desert',
    'ruins',
    'battlefield',
    'spirit_vein',
    'abyss',
    'sky_island'
]);
export type HerbBiome = z.infer<typeof HerbBiomeSchema>;

export const HerbSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    grade: TechniqueGradeSchema.describe('Same five-tier ladder as techniques and pills'),
    biome: HerbBiomeSchema,
    /** Draw weight when foraging. Larger is commoner; chaos herbs sit at 1. */
    rarityWeight: z.number().int().min(1),
    /** Base market value in spirit stones. */
    value: z.number().int().min(1),
    /** Realm ordinal below which the place it grows will simply kill you. */
    harvestOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    description: z.string().min(1),
    /**
     * The generic column. Absent on every herb here, because `harvestOrdinal`
     * already says what rung the ground is pitched at and the ordinary bands
     * read it. Present only where a herb outlives its band or is never put
     * forward.
     */
    regard: RegardProfileSchema.optional()
});
export type Herb = z.infer<typeof HerbSchema>;

/** Value window per grade. Disjoint and ascending, asserted in the tests. */
export const HERB_VALUE_BANDS: Record<TechniqueGrade, Band> = {
    mortal: { min: 1, max: 49 },
    earth: { min: 50, max: 499 },
    heaven: { min: 500, max: 4_999 },
    immortal: { min: 5_000, max: 49_999 },
    chaos: { min: 50_000, max: 500_000 }
} as const;

/** Commonest a herb of each grade may be. Strictly falling, asserted in tests. */
export const HERB_RARITY_CEILING: Record<TechniqueGrade, number> = {
    mortal: 400,
    earth: 90,
    heaven: 25,
    immortal: 6,
    chaos: 1
} as const;

export const HERBS: readonly Herb[] = [
    // ═══════════════════════════════════════════════════════════════════
    // MORTAL - pickable by anyone with a knife and a free afternoon
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'herb-qi-grass',
        name: 'Qi Grass',
        grade: 'mortal',
        biome: 'roadside',
        rarityWeight: 400,
        value: 2,
        harvestOrdinal: 0,
        description:
            'A grey-green grass that grows anywhere a cultivator has ever exhaled. Every alchemy manual opens with it, and every alchemist is sick of the sight of it.'
    },
    {
        id: 'herb-blood-millet',
        name: 'Blood Millet',
        grade: 'mortal',
        biome: 'farmland',
        rarityWeight: 300,
        value: 4,
        harvestOrdinal: 0,
        description:
            'Dark red grain that farmers weed out and alchemists buy back at four times the price. Restores what bleeding takes.'
    },
    {
        id: 'herb-hollow-reed',
        name: 'Hollow Reed',
        grade: 'mortal',
        biome: 'marsh',
        rarityWeight: 160,
        value: 10,
        harvestOrdinal: 0,
        description:
            'The stem is empty and holds qi the way a jar holds water. Used as the carrier in half the mortal-grade pills in circulation.'
    },
    {
        id: 'herb-nine-node-calamus',
        name: 'Nine-Node Calamus',
        grade: 'mortal',
        biome: 'riverbank',
        rarityWeight: 260,
        value: 6,
        harvestOrdinal: 0,
        description:
            'Counted by its nodes; nine is the useful count and eight is worth nothing, which has supported a small industry in fraud.'
    },
    {
        id: 'herb-cloudcap-mushroom',
        name: 'Cloudcap Mushroom',
        grade: 'mortal',
        biome: 'forest',
        rarityWeight: 220,
        value: 8,
        harvestOrdinal: 0,
        description:
            'Pale, fleshy, and faintly cold to the touch. Eaten raw it fills the belly for a day; refined properly it does rather better than that.'
    },
    {
        id: 'herb-iron-thread-moss',
        name: 'Iron Thread Moss',
        grade: 'mortal',
        biome: 'cave',
        rarityWeight: 200,
        value: 9,
        harvestOrdinal: 1,
        description:
            'Grows on ore seams and carries a thread of metal qi through every strand. Toughens flesh in pill form and blunts knives in leaf form.'
    },
    {
        id: 'herb-morning-dew-orchid',
        name: 'Morning Dew Orchid',
        grade: 'mortal',
        biome: 'forest',
        rarityWeight: 180,
        value: 12,
        harvestOrdinal: 1,
        description:
            'Must be cut before the dew burns off or the qi goes with it. Alchemists\' apprentices are woken for this and resent it lifelong.'
    },
    {
        id: 'herb-bitter-frost-berry',
        name: 'Bitter Frost Berry',
        grade: 'mortal',
        biome: 'high_peak',
        rarityWeight: 150,
        value: 15,
        harvestOrdinal: 3,
        description:
            'Sour enough to make the eyes water and cold enough to numb the tongue. Settles a heart that has begun to race the wrong way.'
    },
    {
        id: 'herb-emberleaf',
        name: 'Emberleaf',
        grade: 'mortal',
        biome: 'volcanic',
        rarityWeight: 140,
        value: 18,
        harvestOrdinal: 4,
        description:
            'Holds heat for three days after cutting. Carried by travellers in cold country, and burned by the careless ones.'
    },
    {
        id: 'herb-grave-lily',
        name: 'Grave Lily',
        grade: 'mortal',
        biome: 'ruins',
        rarityWeight: 120,
        value: 20,
        harvestOrdinal: 5,
        description:
            'White, waxy, and only found where a good many people stopped. Draws poison out of a body, which is a use that comes with implications.'
    },
    {
        id: 'herb-thousand-day-root',
        name: 'Thousand-Day Root',
        grade: 'mortal',
        biome: 'mountain',
        rarityWeight: 110,
        value: 28,
        harvestOrdinal: 6,
        description:
            'Named for how long it takes to be worth digging up, not for anything it does. The wait is the whole product.'
    },
    {
        id: 'herb-clearwater-lotus-seed',
        name: 'Clearwater Lotus Seed',
        grade: 'mortal',
        biome: 'lake_bottom',
        rarityWeight: 100,
        value: 36,
        harvestOrdinal: 8,
        description:
            'Retrieved from silt at the bottom of a spirit lake by someone able to hold their breath for a long time. Clarifies muddled qi.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // EARTH - Foundation and Core alchemy
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'herb-goldvein-ginseng',
        name: 'Goldvein Ginseng',
        grade: 'earth',
        biome: 'mountain',
        rarityWeight: 90,
        value: 60,
        harvestOrdinal: 13,
        description:
            'Threaded through with hair-fine gold. Older specimens are said to move when not observed, which is folklore, and which every digger nonetheless believes at night.'
    },
    {
        id: 'herb-crimson-marrow-fungus',
        name: 'Crimson Marrow Fungus',
        grade: 'earth',
        biome: 'cave',
        rarityWeight: 80,
        value: 80,
        harvestOrdinal: 13,
        description:
            'Grows on bone in the dark. Replaces what a serious wound spends, and tastes precisely as its origin suggests.'
    },
    {
        id: 'herb-jade-bamboo-heart',
        name: 'Jade Bamboo Heart',
        grade: 'earth',
        biome: 'bamboo_sea',
        rarityWeight: 75,
        value: 95,
        harvestOrdinal: 14,
        description:
            'The pith of a bamboo stalk that has turned green-white through age. One stalk in ten thousand has it, and the sea is very large.'
    },
    {
        id: 'herb-moonwell-lotus',
        name: 'Moonwell Lotus',
        grade: 'earth',
        biome: 'lake_bottom',
        rarityWeight: 65,
        value: 120,
        harvestOrdinal: 15,
        description:
            'Opens only under a full moon and closes at any light brighter than that, including a torch, including yours.'
    },
    {
        id: 'herb-thunder-struck-peach-wood',
        name: 'Thunder-Struck Peach Wood',
        grade: 'earth',
        biome: 'high_peak',
        rarityWeight: 55,
        value: 150,
        harvestOrdinal: 16,
        description:
            'Peach wood that took a lightning strike and kept growing. Holds a charge indefinitely and refuses to hold anything else.'
    },
    {
        id: 'herb-corpse-silver-flower',
        name: 'Corpse Silver Flower',
        grade: 'earth',
        biome: 'battlefield',
        rarityWeight: 50,
        value: 170,
        harvestOrdinal: 16,
        description:
            'Blooms in the third year after a battle, one flower to roughly forty dead. Sect historians have used it to date engagements that nobody survived to report.'
    },
    {
        id: 'herb-magma-heart-coral',
        name: 'Magma-Heart Coral',
        grade: 'earth',
        biome: 'volcanic',
        rarityWeight: 45,
        value: 220,
        harvestOrdinal: 17,
        description:
            'Grown in flowing stone rather than water. Harvesting requires either a fire root or a very short life expectancy.'
    },
    {
        id: 'herb-frostvein-lichen',
        name: 'Frostvein Lichen',
        grade: 'earth',
        biome: 'glacier',
        rarityWeight: 40,
        value: 260,
        harvestOrdinal: 17,
        description:
            'Blue lichen that grows on the underside of glacier ice, drawing on cold the way other plants draw on light.'
    },
    {
        id: 'herb-hundred-year-snow-ginseng',
        name: 'Hundred-Year Snow Ginseng',
        grade: 'earth',
        biome: 'glacier',
        rarityWeight: 35,
        value: 320,
        harvestOrdinal: 18,
        description:
            'A century under ice concentrates it to the point where an unprepared mortal who eats it dies of the qi rather than the cold.'
    },
    {
        id: 'herb-spiritvein-quartz-bloom',
        name: 'Spiritvein Quartz Bloom',
        grade: 'earth',
        biome: 'spirit_vein',
        rarityWeight: 30,
        value: 400,
        harvestOrdinal: 19,
        description:
            'Mineral in every respect except that it grows, flowers, and dies. Sects that own a spirit vein count these before and after every visitor.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // HEAVEN - Nascent Soul and above
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'herb-purple-cloud-fruit',
        name: 'Purple Cloud Fruit',
        grade: 'heaven',
        biome: 'sky_island',
        rarityWeight: 25,
        value: 600,
        harvestOrdinal: 21,
        description:
            'Ripens only above the height where clouds are made. Reaching the tree requires flight; taking the fruit requires the tree\'s indifference.'
    },
    {
        id: 'herb-dragonwhisker-vine',
        name: 'Dragonwhisker Vine',
        grade: 'heaven',
        biome: 'abyss',
        rarityWeight: 20,
        value: 900,
        harvestOrdinal: 21,
        description:
            'Hangs in rifts too deep for daylight, each strand fine as wire and strong enough to hold a cultivator\'s full weight, which is regularly tested.'
    },
    {
        id: 'herb-nine-leaf-soul-grass',
        name: 'Nine-Leaf Soul Grass',
        grade: 'heaven',
        biome: 'deep_forest',
        rarityWeight: 18,
        value: 1_200,
        harvestOrdinal: 22,
        description:
            'Puts out one leaf a century. At nine leaves it can hold a nascent soul steady; at eight it is an expensive weed.'
    },
    {
        id: 'herb-phoenix-marrow-blossom',
        name: 'Phoenix Marrow Blossom',
        grade: 'heaven',
        biome: 'volcanic',
        rarityWeight: 14,
        value: 1_800,
        harvestOrdinal: 23,
        description:
            'Burns continuously without consuming itself. Whether any phoenix was involved is a question the trade has agreed not to pursue.'
    },
    {
        id: 'herb-void-mist-fungus',
        name: 'Void Mist Fungus',
        grade: 'heaven',
        biome: 'ruins',
        rarityWeight: 12,
        value: 2_200,
        harvestOrdinal: 24,
        description:
            'Fruits in places where space has been damaged and not properly repaired. Its presence is how surveyors find such places, usually too late.'
    },
    {
        id: 'herb-glacial-heart-flower',
        name: 'Glacial Heart Flower',
        grade: 'heaven',
        biome: 'glacier',
        rarityWeight: 10,
        value: 2_800,
        harvestOrdinal: 25,
        description:
            'A single white bloom at the centre of an ice field that never thaws. The field is the flower; the bloom is only where it is looking.'
    },
    {
        id: 'herb-thunder-pool-algae',
        name: 'Thunder Pool Algae',
        grade: 'heaven',
        biome: 'sky_island',
        rarityWeight: 9,
        value: 3_200,
        harvestOrdinal: 26,
        description:
            'Grows in standing water on floating stone, charged and recharged by every storm that passes beneath. Essentially the only reagent a lightning root can use.'
    },
    {
        id: 'herb-millennium-blood-ganoderma',
        name: 'Millennium Blood Ganoderma',
        grade: 'heaven',
        biome: 'deep_forest',
        rarityWeight: 8,
        value: 4_000,
        harvestOrdinal: 27,
        description:
            'A thousand years in one shaded hollow. Every known specimen has had something large and territorial living beside it, and this is not thought to be coincidence.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // IMMORTAL - the reagents wars are fought over
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'herb-jade-pool-spring-lotus',
        name: 'Jade Pool Spring Lotus',
        grade: 'immortal',
        biome: 'sky_island',
        rarityWeight: 6,
        value: 6_000,
        harvestOrdinal: 29,
        description:
            'Rooted in a spring whose water is already a heaven-grade reagent. Taking the lotus ends the spring, and everyone knows it.'
    },
    {
        id: 'herb-primordial-earth-marrow',
        name: 'Primordial Earth Marrow',
        grade: 'immortal',
        biome: 'spirit_vein',
        rarityWeight: 5,
        value: 9_000,
        harvestOrdinal: 30,
        description:
            'Not a plant. It is what a spirit vein has instead of blood, and drawing it is done in thimbles, once a century, by agreement between sects that agree on nothing else.'
    },
    {
        id: 'herb-soulreturn-dew',
        name: 'Soulreturn Dew',
        grade: 'immortal',
        biome: 'abyss',
        rarityWeight: 4,
        value: 14_000,
        harvestOrdinal: 31,
        description:
            'Condenses on the walls of rifts where a Deity Transformation cultivator died badly. One vial per death, and no other source is known.'
    },
    {
        id: 'herb-nine-transformation-fungus',
        name: 'Nine-Transformation Fungus',
        grade: 'immortal',
        biome: 'deep_forest',
        rarityWeight: 3,
        value: 22_000,
        harvestOrdinal: 32,
        description:
            'Changes form eight times before it is worth anything and rots within a day of the ninth. Timing a harvest correctly is a lifetime\'s specialisation.'
    },
    {
        id: 'herb-star-fallen-iron-blossom',
        name: 'Star-Fallen Iron Blossom',
        grade: 'immortal',
        biome: 'ruins',
        rarityWeight: 3,
        value: 30_000,
        harvestOrdinal: 33,
        description:
            'Grows out of metal that arrived from somewhere else at speed. The blossom is metal too, and it is warm.'
    },
    {
        id: 'herb-immortal-cypress-heartwood',
        name: 'Immortal Cypress Heartwood',
        grade: 'immortal',
        biome: 'high_peak',
        rarityWeight: 2,
        value: 40_000,
        harvestOrdinal: 34,
        description:
            'Cut from a tree that has outlived four dynasties and shows no sign of considering the matter closed. Every cut is recorded; there are eleven.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // CHAOS - one of each is a plot, not a purchase
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'herb-kalpa-surviving-branch',
        name: 'Kalpa-Surviving Branch',
        grade: 'chaos',
        biome: 'ruins',
        rarityWeight: 1,
        value: 80_000,
        harvestOrdinal: 37,
        description:
            'A branch from something that was standing before the last calamity and was still standing afterwards. It is not charred. That is the remarkable part.'
    },
    {
        id: 'herb-origin-qi-crystal-lotus',
        name: 'Origin Qi Crystal Lotus',
        grade: 'chaos',
        biome: 'spirit_vein',
        rarityWeight: 1,
        value: 150_000,
        harvestOrdinal: 39,
        description:
            'Forms at the terminus of a spirit vein once the vein has finished. Harvesting one is indistinguishable, from a distance, from killing a region.'
    },
    {
        id: 'herb-heavenly-tribulation-cinder-fruit',
        name: 'Heavenly Tribulation Cinder Fruit',
        grade: 'chaos',
        biome: 'high_peak',
        rarityWeight: 1,
        value: 250_000,
        harvestOrdinal: 41,
        description:
            'Fruits only on scar ground, where a crossing failed and the qi never came back. It carries the shape of the lightning that ended them, and it keeps it.'
    },
    {
        id: 'herb-chaos-seed',
        name: 'Chaos Seed',
        grade: 'chaos',
        biome: 'abyss',
        rarityWeight: 1,
        value: 400_000,
        harvestOrdinal: 43,
        description:
            'Round, matte, and entirely without qi signature, which is precisely why it terrifies anyone qualified to examine it. Four are known. Three are accounted for.'
    }
] as const;

// ─────────────────────────────────────────────────────────────────────────
// INDICES + LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

const HERB_BY_ID: ReadonlyMap<string, Herb> = new Map(HERBS.map(h => [h.id, h]));

const HERBS_BY_BIOME: ReadonlyMap<HerbBiome, readonly Herb[]> = (() => {
    const map = new Map<HerbBiome, Herb[]>();
    for (const h of HERBS) {
        const bucket = map.get(h.biome);
        if (bucket) bucket.push(h);
        else map.set(h.biome, [h]);
    }
    return map;
})();

const HERBS_BY_GRADE: ReadonlyMap<TechniqueGrade, readonly Herb[]> = (() => {
    const map = new Map<TechniqueGrade, Herb[]>();
    for (const h of HERBS) {
        const bucket = map.get(h.grade);
        if (bucket) bucket.push(h);
        else map.set(h.grade, [h]);
    }
    return map;
})();

export function getHerb(id: string): Herb | undefined {
    return HERB_BY_ID.get(id);
}

export function requireHerb(id: string): Herb {
    const h = HERB_BY_ID.get(id);
    if (!h) throw new Error(`Unknown herb: ${id}`);
    return h;
}

export function getHerbsByBiome(biome: HerbBiome): readonly Herb[] {
    return HERBS_BY_BIOME.get(biome) ?? [];
}

export function getHerbsByGrade(grade: TechniqueGrade): readonly Herb[] {
    return HERBS_BY_GRADE.get(grade) ?? [];
}

/** Everything a cultivator at this ordinal can reach the growing site of. */
export function findHerbsForOrdinal(ordinal: number, biome?: HerbBiome): Herb[] {
    const cap = Math.max(0, Math.min(MAX_ORDINAL, Math.floor(ordinal)));
    const pool = biome ? getHerbsByBiome(biome) : HERBS;
    return pool.filter(h => h.harvestOrdinal <= cap);
}

/**
 * Everything the world would actually put in front of this asker.
 *
 * `findHerbsForOrdinal` answers a question about survival: can they stand where
 * it grows. This answers a different one: is it still worth their bending down.
 * A cultivator at Nascent Soul walks past qi grass the way anybody walks past a
 * weed, and the draw should walk past it too. The narrowing is the ordinary
 * `offeredTo` rule and nothing herb-specific: a herb whose gap has reached
 * `dismissed` is not offered.
 *
 * If nothing survives the narrowing - a biome where the only reachable herbs
 * are all far below them - the reachable set comes back rather than nothing,
 * because refusing to answer would be a worse lie than answering with a weed.
 */
export function findOfferedHerbs(
    asker: RegardAskerInput,
    biome?: HerbBiome
): readonly Herb[] {
    const ordinal = typeof asker === 'number' ? asker : asker.ordinal;
    const reachable = findHerbsForOrdinal(ordinal, biome);
    return narrowToOffered(reachable, asker);
}

/**
 * Weighted forage draw from a uniform [0,1) sample. Takes the sample rather
 * than an RNG so the caller owns seeding, matching `rollSpiritRoot`.
 * Returns undefined when nothing in this biome is reachable at this ordinal.
 *
 * The pool is what the world offers, not merely what the asker can survive.
 * That single change is what makes forty-five rungs of ladder visible in a
 * verb that used to hand a False Immortal the same stalk of qi grass it handed
 * a beginner.
 */
export function rollHerb(
    ordinal: RegardAskerInput,
    sample: number,
    biome?: HerbBiome
): Herb | undefined {
    const pool = findOfferedHerbs(ordinal, biome);
    if (pool.length === 0) return undefined;
    const total = pool.reduce((sum, h) => sum + h.rarityWeight, 0);
    let cursor = Math.max(0, Math.min(0.999999999, sample)) * total;
    for (const h of pool) {
        cursor -= h.rarityWeight;
        if (cursor < 0) return h;
    }
    return pool[pool.length - 1];
}

/** Days a foraging pass takes for somebody the ground is pitched at. */
export const FORAGE_BASE_DAYS = 7;

export interface ForageResult {
    /** What the ground gave up, or null when nothing here is reachable. */
    readonly herb: Herb | null;
    /** How many of it. One for somebody the ground is pitched at. */
    readonly quantity: number;
    /** How long it took, in days. Never below one. */
    readonly days: number;
    /** The whole banded answer, including the reaction line and the gap. */
    readonly regard: Regard | null;
}

/**
 * One foraging pass, priced.
 *
 * The draw, the count and the duration all come off the same regard, so the
 * three move together and none of them is a separate arithmetic. A beginner
 * gets one common stalk over a full week. Somebody ten rungs past what the
 * ground is pitched at strips it in under two days and comes back with an
 * armful, because that is what ten rungs means everywhere else in this engine
 * and there is no reason for the ground to be the exception.
 */
export function forage(
    asker: RegardAskerInput,
    sample: number,
    options: { biome?: HerbBiome; baseDays?: number } = {}
): ForageResult {
    const herb = rollHerb(asker, sample, options.biome);
    if (!herb) return { herb: null, quantity: 0, days: options.baseDays ?? FORAGE_BASE_DAYS, regard: null };

    const regard = regardOf(herb, asker);
    const baseDays = options.baseDays ?? FORAGE_BASE_DAYS;
    return {
        herb,
        quantity: Math.max(1, Math.round(regard.yieldMultiplier)),
        days: Math.max(1, Math.round(baseDays * regard.durationMultiplier)),
        regard
    };
}
