/**
 * Spirit Roots - the talent you are dealt once and never get to redraw.
 *
 * A spirit root is rolled at character creation and is permanent. There is no
 * respec, no reroll, no item that changes it. This is the single most
 * consequential number in a run, and the player has no agency over it: that is
 * the point of the genre, and of this engine.
 *
 * Weights are expressed as integers out of WEIGHT_TOTAL rather than floats, so
 * the distribution is exactly reproducible from a seed and can be asserted in
 * tests without float tolerance. Every weight is a multiple of 9 and they sum
 * to 999, so a weight read aloud is very nearly its own percentage: 81 is
 * 8.1%, 144 is 14.4%. Adding a root means taking its share out of the
 * neighbouring buckets, never restating the total.
 */

export type Element = 'metal' | 'wood' | 'water' | 'fire' | 'earth' | 'lightning' | 'ice';

export type SpiritRootKey =
    | 'single_metal'
    | 'single_wood'
    | 'single_water'
    | 'single_fire'
    | 'single_earth'
    | 'dual_water_fire'
    | 'dual_metal_wood'
    | 'triple_metal_wood_earth'
    | 'quad_metal_wood_earth_water'
    | 'muddled_five_element'
    | 'mutated_lightning'
    | 'mutated_ice';

/**
 * Grades run worst-to-best in element count, not in element count's favour:
 * `single` is the prize, and every element after the first is one more mouth
 * on the same intake. `dual` through `muddled` is a single descending gradient
 * - speed, matched-art bonus and breakthrough odds all fall along it, and
 * commonness rises along it. `mutated` is off that axis entirely.
 */
export type SpiritRootGrade = 'single' | 'dual' | 'triple' | 'quad' | 'muddled' | 'mutated';

export interface SpiritRoot {
    key: SpiritRootKey;
    name: string;
    grade: SpiritRootGrade;
    /** Elements this root can channel. */
    elements: Element[];
    /** Selection weight out of WEIGHT_TOTAL. */
    weight: number;
    /**
     * Multiplier on cultivation progress gained per unit of time spent
     * cultivating. The dominant term in how far a run gets.
     */
    cultivationSpeed: number;
    /**
     * Per-turn probability of qi deviation while cultivating an art whose
     * element opposes this root. Conflicting dual roots carry this
     * permanently; clean roots only risk it via mismatched techniques.
     */
    deviationRisk: number;
    /** Multiplier applied to techniques matching one of `elements`. */
    matchedTechniqueBonus: number;
    /**
     * How commonly techniques for this root are found in the world. Mutated
     * roots are devastating and nearly unsupported - the power is real, the
     * manuals are not.
     */
    techniqueAvailability: number;
    description: string;
}

/**
 * Elements that destroy each other in the wuxing cycle. Cultivating an art of
 * an element that overcomes your root's element is what tears meridians.
 */
export const OVERCOMES: Record<Element, Element | null> = {
    metal: 'wood',
    wood: 'earth',
    earth: 'water',
    water: 'fire',
    fire: 'metal',
    lightning: null,
    ice: null
};

export const SPIRIT_ROOTS: readonly SpiritRoot[] = [
    {
        key: 'single_metal',
        name: 'Single Metal Root',
        grade: 'single',
        elements: ['metal'],
        weight: 81,
        cultivationSpeed: 1.5,
        deviationRisk: 0,
        matchedTechniqueBonus: 2.0,
        techniqueAvailability: 1,
        description: 'Pure metal affinity. Metal arts advance twice as fast.'
    },
    {
        key: 'single_wood',
        name: 'Single Wood Root',
        grade: 'single',
        elements: ['wood'],
        weight: 81,
        cultivationSpeed: 1.5,
        deviationRisk: 0,
        matchedTechniqueBonus: 2.0,
        techniqueAvailability: 1,
        description: 'Long vitality, strong at healing.'
    },
    {
        key: 'single_water',
        name: 'Single Water Root',
        grade: 'single',
        elements: ['water'],
        weight: 81,
        cultivationSpeed: 1.5,
        deviationRisk: 0,
        matchedTechniqueBonus: 2.0,
        techniqueAvailability: 1,
        description: 'Dense, sustained qi.'
    },
    {
        key: 'single_fire',
        name: 'Single Fire Root',
        grade: 'single',
        elements: ['fire'],
        weight: 81,
        cultivationSpeed: 1.5,
        deviationRisk: 0,
        matchedTechniqueBonus: 2.0,
        techniqueAvailability: 1,
        description: 'Sharp offensive power.'
    },
    {
        key: 'single_earth',
        name: 'Single Earth Root',
        grade: 'single',
        elements: ['earth'],
        weight: 81,
        cultivationSpeed: 1.5,
        deviationRisk: 0,
        matchedTechniqueBonus: 2.0,
        techniqueAvailability: 1,
        description: 'A rock-solid foundation.'
    },
    {
        key: 'dual_water_fire',
        name: 'Water-Fire Dual Root',
        grade: 'dual',
        elements: ['water', 'fire'],
        weight: 90,
        cultivationSpeed: 1.0,
        deviationRisk: 0.08,
        matchedTechniqueBonus: 1.3,
        techniqueAvailability: 1,
        description:
            'Two elements that put each other out. Cultivating either art risks qi deviation every turn.'
    },
    {
        key: 'dual_metal_wood',
        name: 'Metal-Wood Dual Root',
        grade: 'dual',
        elements: ['metal', 'wood'],
        weight: 90,
        cultivationSpeed: 1.0,
        deviationRisk: 0.08,
        matchedTechniqueBonus: 1.3,
        techniqueAvailability: 1,
        description:
            'Metal cuts wood, and it does so inside your meridians. Qi deviation is a standing risk.'
    },
    {
        // Three links of the overcoming cycle, in order: metal cuts wood, wood
        // breaks earth. Nothing in the set overcomes metal and nothing is
        // overcome by earth, so the chain has two ends instead of closing -
        // earth arts are the one clean thing this root can hold, and the
        // cultivator finds that out by trying everything else first.
        key: 'triple_metal_wood_earth',
        name: 'Metal-Wood-Earth Triple Root',
        grade: 'triple',
        elements: ['metal', 'wood', 'earth'],
        weight: 99,
        cultivationSpeed: 0.85,
        deviationRisk: 0.06,
        matchedTechniqueBonus: 1.2,
        techniqueAvailability: 1,
        description:
            'Three elements in an overcoming chain. Two of them fight on the way in; only earth arrives clean.'
    },
    {
        // Four links of the same chain, one short of closing it. Fire is what
        // is missing, and its absence is worth nothing: a root is judged by
        // what it holds, not by what it was spared.
        key: 'quad_metal_wood_earth_water',
        name: 'Metal-Wood-Earth-Water Quad Root',
        grade: 'quad',
        elements: ['metal', 'wood', 'earth', 'water'],
        weight: 117,
        cultivationSpeed: 0.7,
        deviationRisk: 0.04,
        matchedTechniqueBonus: 1.1,
        techniqueAvailability: 1,
        description:
            'Four elements and one gap where fire should be. The gap saves nothing; the intake is already divided four ways.'
    },
    {
        key: 'muddled_five_element',
        name: 'Five-Element Muddled Root',
        grade: 'muddled',
        elements: ['metal', 'wood', 'water', 'fire', 'earth'],
        weight: 144,
        cultivationSpeed: 0.55,
        deviationRisk: 0.02,
        matchedTechniqueBonus: 1.0,
        techniqueAvailability: 1,
        description: 'All five elements, none of them clean. Cultivation crawls.'
    },
    {
        key: 'mutated_lightning',
        name: 'Mutated Lightning Root',
        grade: 'mutated',
        elements: ['lightning'],
        weight: 27,
        cultivationSpeed: 1.8,
        deviationRisk: 0.05,
        matchedTechniqueBonus: 2.5,
        techniqueAvailability: 0.15,
        description:
            'Lightning attacks with nothing standing behind them. Techniques for this root are extremely scarce.'
    },
    {
        key: 'mutated_ice',
        name: 'Mutated Ice Root',
        grade: 'mutated',
        elements: ['ice'],
        weight: 27,
        cultivationSpeed: 1.8,
        deviationRisk: 0.1,
        matchedTechniqueBonus: 2.5,
        techniqueAvailability: 0.15,
        description: 'Freezes all things, but backlash comes easily.'
    }
] as const;

/** Sum of all weights. Roots are drawn uniformly from [0, WEIGHT_TOTAL). */
export const WEIGHT_TOTAL = SPIRIT_ROOTS.reduce((sum, r) => sum + r.weight, 0);

export function getSpiritRoot(key: SpiritRootKey): SpiritRoot {
    const root = SPIRIT_ROOTS.find(r => r.key === key);
    if (!root) throw new Error(`Unknown spirit root: ${key}`);
    return root;
}

/**
 * Roll a spirit root from a uniform [0,1) sample.
 *
 * Takes the sample rather than calling a RNG so the caller owns seeding -
 * every stochastic system in this engine is reproducible from the run seed.
 */
export function rollSpiritRoot(sample: number): SpiritRoot {
    const clamped = Math.max(0, Math.min(0.999999999, sample));
    let cursor = clamped * WEIGHT_TOTAL;
    for (const root of SPIRIT_ROOTS) {
        cursor -= root.weight;
        if (cursor < 0) return root;
    }
    // Float drift at the very top of the range; the last root is correct.
    return SPIRIT_ROOTS[SPIRIT_ROOTS.length - 1];
}

/** Probability of drawing this root, as a fraction of 1. */
export function rootProbability(key: SpiritRootKey): number {
    return getSpiritRoot(key).weight / WEIGHT_TOTAL;
}

/**
 * Whether cultivating a technique of `element` conflicts with this root.
 * Conflict means the technique's element overcomes one the root holds, or the
 * root is internally conflicted (dual) and the element is one of its own.
 *
 * The dual clause exists because two opposed elements are too few for the
 * cycle to catch on its own - water overcomes fire, but nothing in the pair
 * overcomes water. Triple, quad and muddled roots need no such clause: they
 * hold enough of the cycle that it turns on them by itself, which is exactly
 * what having more elements costs.
 */
export function conflictsWithRoot(root: SpiritRoot, element: Element): boolean {
    if (root.grade === 'dual' && root.elements.includes(element)) return true;
    return root.elements.some(own => OVERCOMES[element] === own);
}

// ─────────────────────────────────────────────────────────────────────────
// INNATE ATTRIBUTES
// Rolled once at creation, locked forever. There is no training montage.
// ─────────────────────────────────────────────────────────────────────────

export type AttributeKey = 'might' | 'insight' | 'fortune' | 'charm';

export interface AttributeDef {
    key: AttributeKey;
    name: string;
    min: number;
    max: number;
    description: string;
}

export const ATTRIBUTES: readonly AttributeDef[] = [
    {
        key: 'might',
        name: 'Might',
        min: 1,
        max: 3,
        description: 'Physical force - what you can take, and what you can put through someone.'
    },
    {
        key: 'insight',
        name: 'Insight',
        min: 1,
        max: 4,
        description: 'Comprehension - how quickly you understand techniques and situations.'
    },
    {
        key: 'fortune',
        name: 'Fortune',
        min: 0,
        max: 3,
        description: 'Luck. It can legally come up zero, and for most people it does.'
    },
    {
        key: 'charm',
        name: 'Charm',
        min: 1,
        max: 3,
        description: "How the world's people respond to you before you have proved anything."
    }
] as const;

export interface InnateAttributes {
    might: number;
    insight: number;
    fortune: number;
    charm: number;
}

export function getAttributeDef(key: AttributeKey): AttributeDef {
    const def = ATTRIBUTES.find(a => a.key === key);
    if (!def) throw new Error(`Unknown attribute: ${key}`);
    return def;
}

/**
 * Roll the four innate attributes from four uniform [0,1) samples, keyed in
 * the fixed order might, insight, fortune, charm.
 */
export function rollAttributes(samples: [number, number, number, number]): InnateAttributes {
    const [m, i, f, c] = samples;
    return {
        might: rollInRange(m, 1, 3),
        insight: rollInRange(i, 1, 4),
        fortune: rollInRange(f, 0, 3),
        charm: rollInRange(c, 1, 3)
    };
}

function rollInRange(sample: number, min: number, max: number): number {
    const clamped = Math.max(0, Math.min(0.999999999, sample));
    return min + Math.floor(clamped * (max - min + 1));
}

/** Clamp an attribute set to its legal ranges (defensive, for loaded saves). */
export function clampAttributes(attrs: InnateAttributes): InnateAttributes {
    return {
        might: clampTo(attrs.might, 1, 3),
        insight: clampTo(attrs.insight, 1, 4),
        fortune: clampTo(attrs.fortune, 0, 3),
        charm: clampTo(attrs.charm, 1, 3)
    };
}

function clampTo(n: number, min: number, max: number): number {
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, Math.floor(n)));
}
