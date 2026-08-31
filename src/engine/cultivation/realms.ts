/**
 * The Cultivation Ladder - 45 ranks, ordinal 0 through 44.
 *
 * This is the spine of the entire game. Every other cultivation system
 * (breakthrough odds, lifespan, combat power, sect standing, technique tiers)
 * is expressed as a function of a cultivator's ordinal rank.
 *
 * The ladder is deliberately flat and ordinal-addressed rather than a tree of
 * named enums: "is Core Formation stronger than Foundation Perfection" is a
 * question the engine answers thousands of times per session, and integer
 * comparison is the only representation that never gets it wrong.
 */

export type RealmKey =
    | 'qi_condensation'
    | 'foundation_establishment'
    | 'core_formation'
    | 'nascent_soul'
    | 'deity_transformation'
    | 'void_refinement'
    | 'body_integration'
    | 'grand_ascension'
    | 'tribulation_transcendence';

export interface RealmTier {
    key: RealmKey;
    /** Display name of the realm proper, e.g. "Core Formation". */
    name: string;
    /** Conventional xianxia rendering, shown in flavour text. */
    hanzi: string;
    /** First ordinal belonging to this realm. */
    ordinalStart: number;
    /** Last ordinal belonging to this realm (inclusive). */
    ordinalEnd: number;
    /** Names of the sub-ranks, indexed from ordinalStart. */
    subRanks: string[];
    /** Total lifespan in years granted on entering this realm. */
    lifespanYears: number;
    /**
     * Multiplier applied to raw combat/qi power. Cultivation fiction is
     * explicitly non-linear - a Core Formation cultivator is not "four ranks
     * above" a Foundation cultivator, they are categorically unfightable.
     */
    powerMultiplier: number;
    description: string;
}

export const REALM_TIERS: readonly RealmTier[] = [
    {
        key: 'qi_condensation',
        name: 'Qi Condensation',
        hanzi: '練氣',
        ordinalStart: 0,
        ordinalEnd: 12,
        subRanks: Array.from({ length: 13 }, (_, i) => `Layer ${i + 1}`),
        lifespanYears: 100,
        powerMultiplier: 1,
        description:
            'You can hold and circulate spiritual energy. You are still mortal in every way that matters.'
    },
    {
        key: 'foundation_establishment',
        name: 'Foundation Establishment',
        hanzi: '築基',
        ordinalStart: 13,
        ordinalEnd: 16,
        subRanks: ['Early', 'Mid', 'Late', 'Perfection'],
        lifespanYears: 200,
        powerMultiplier: 4,
        description:
            'Accumulated qi converts into a permanent foundation, and lifespan stops being a mortal question.'
    },
    {
        key: 'core_formation',
        name: 'Core Formation',
        hanzi: '結丹',
        ordinalStart: 17,
        ordinalEnd: 20,
        subRanks: ['Early', 'Mid', 'Late', 'Perfection'],
        lifespanYears: 500,
        powerMultiplier: 16,
        description:
            'The foundation condenses into a golden core. Sects stop recruiting you and start negotiating with you.'
    },
    {
        key: 'nascent_soul',
        name: 'Nascent Soul',
        hanzi: '元嬰',
        ordinalStart: 21,
        ordinalEnd: 24,
        subRanks: ['Early', 'Mid', 'Late', 'Perfection'],
        lifespanYears: 1000,
        powerMultiplier: 64,
        description:
            'The core births an infant soul that can survive the destruction of the body.'
    },
    {
        key: 'deity_transformation',
        name: 'Deity Transformation',
        hanzi: '化神',
        ordinalStart: 25,
        ordinalEnd: 28,
        subRanks: ['Early', 'Mid', 'Late', 'Perfection'],
        lifespanYears: 2000,
        powerMultiplier: 256,
        description:
            'Body and soul merge. You are no longer human, and a whole region learns your name.'
    },
    {
        key: 'void_refinement',
        name: 'Void Refinement',
        hanzi: '煉虛',
        ordinalStart: 29,
        ordinalEnd: 32,
        subRanks: ['Early', 'Mid', 'Late', 'Perfection'],
        lifespanYears: 5000,
        powerMultiplier: 1024,
        description:
            'Refining the self against emptiness. Most who reach here stop being described and start being rumoured.'
    },
    {
        key: 'body_integration',
        name: 'Body Integration',
        hanzi: '合體',
        ordinalStart: 33,
        ordinalEnd: 36,
        subRanks: ['Early', 'Mid', 'Late', 'Perfection'],
        lifespanYears: 10000,
        powerMultiplier: 4096,
        description:
            'Soul and body become indivisible. Damage stops meaning what it used to mean.'
    },
    {
        key: 'grand_ascension',
        name: 'Grand Ascension',
        hanzi: '大乘',
        ordinalStart: 37,
        ordinalEnd: 40,
        subRanks: ['Early', 'Mid', 'Late', 'Perfection'],
        lifespanYears: 30000,
        powerMultiplier: 16384,
        description:
            'The last realm of the mortal plane. Everything from here points at the sky.'
    },
    {
        key: 'tribulation_transcendence',
        name: 'Tribulation Transcendence',
        hanzi: '渡劫',
        ordinalStart: 41,
        ordinalEnd: 44,
        subRanks: ['Early', 'Mid', 'Late', 'Perfection'],
        lifespanYears: 100000,
        powerMultiplier: 65536,
        description:
            'Survive the heavenly tribulation and ascend, or do not.'
    }
] as const;

/** Highest legal ordinal on the ladder. */
export const MAX_ORDINAL = 44;
/** Total number of ranks, including ordinal 0. */
export const TOTAL_RANKS = MAX_ORDINAL + 1;

/**
 * Ordinal at which Foundation Establishment begins. Crossing it is the game's
 * first true gate: below it a character is a mortal with a party trick, above
 * it they are a cultivator.
 */
export const FOUNDATION_ORDINAL = 13;

export function clampOrdinal(ordinal: number): number {
    if (!Number.isFinite(ordinal)) return 0;
    return Math.max(0, Math.min(MAX_ORDINAL, Math.floor(ordinal)));
}

export function realmForOrdinal(ordinal: number): RealmTier {
    const clamped = clampOrdinal(ordinal);
    const tier = REALM_TIERS.find(t => clamped >= t.ordinalStart && clamped <= t.ordinalEnd);
    // The tiers cover 0..44 exhaustively, so this is unreachable. The throw
    // exists so a future edit that leaves a hole fails loudly instead of
    // silently handing back Qi Condensation.
    if (!tier) throw new Error(`No realm tier covers ordinal ${ordinal}`);
    return tier;
}

/** Sub-rank name within the realm, e.g. "Layer 7" or "Perfection". */
export function subRankForOrdinal(ordinal: number): string {
    const clamped = clampOrdinal(ordinal);
    const tier = realmForOrdinal(clamped);
    return tier.subRanks[clamped - tier.ordinalStart];
}

/** Full display name, e.g. "Qi Condensation Layer 7", "Core Formation Perfection". */
export function rankName(ordinal: number): string {
    const tier = realmForOrdinal(ordinal);
    return `${tier.name} ${subRankForOrdinal(ordinal)}`;
}

/** Lifespan ceiling in years for a cultivator standing at this ordinal. */
export function lifespanForOrdinal(ordinal: number): number {
    return realmForOrdinal(ordinal).lifespanYears;
}

export function powerMultiplierForOrdinal(ordinal: number): number {
    return realmForOrdinal(ordinal).powerMultiplier;
}

/**
 * True when advancing from `ordinal` crosses into a new realm rather than
 * stepping to the next sub-rank. Realm boundaries are the bottlenecks that
 * kill cultivators; sub-rank steps are merely expensive.
 */
export function isRealmBoundary(ordinal: number): boolean {
    const clamped = clampOrdinal(ordinal);
    if (clamped >= MAX_ORDINAL) return false;
    return realmForOrdinal(clamped).key !== realmForOrdinal(clamped + 1).key;
}

/**
 * Cultivation progress (in qi-units) required to attempt a breakthrough from
 * this ordinal. Grows super-linearly, so the overwhelming majority of runs end
 * somewhere in Qi Condensation.
 */
export function progressRequiredForOrdinal(ordinal: number): number {
    const clamped = clampOrdinal(ordinal);
    const tier = realmForOrdinal(clamped);
    const stepWithinRealm = clamped - tier.ordinalStart;
    const base = 100 * Math.pow(1.35, clamped);
    const boundaryTax = isRealmBoundary(clamped) ? 2.5 : 1;
    return Math.round((base + stepWithinRealm * 50) * boundaryTax);
}

/**
 * Base probability of surviving a breakthrough attempt from this ordinal,
 * before spirit root, attributes, ambient qi, injuries and pills apply.
 */
export function baseBreakthroughChance(ordinal: number): number {
    const clamped = clampOrdinal(ordinal);
    const linear = 0.9 - clamped * 0.014;
    const boundaryPenalty = isRealmBoundary(clamped) ? 0.45 : 1;
    return clamp01(Math.max(0.1, linear) * boundaryPenalty);
}

/**
 * Tribulation Transcendence breakthroughs summon heavenly lightning. Reports
 * whether an attempt at this ordinal triggers one.
 */
export function triggersHeavenlyTribulation(ordinal: number): boolean {
    return realmForOrdinal(ordinal).key === 'tribulation_transcendence';
}

function clamp01(n: number): number {
    return Math.max(0, Math.min(1, n));
}

export interface LadderEntry {
    ordinal: number;
    realm: string;
    realmKey: RealmKey;
    subRank: string;
    name: string;
    lifespanYears: number;
    isBoundary: boolean;
    progressRequired: number;
    baseBreakthroughChance: number;
}

/** Flat 0..44 table, for UIs and reference tooling. */
export function fullLadder(): LadderEntry[] {
    return Array.from({ length: TOTAL_RANKS }, (_, ordinal) => ({
        ordinal,
        realm: realmForOrdinal(ordinal).name,
        realmKey: realmForOrdinal(ordinal).key,
        subRank: subRankForOrdinal(ordinal),
        name: rankName(ordinal),
        lifespanYears: lifespanForOrdinal(ordinal),
        isBoundary: isRealmBoundary(ordinal),
        progressRequired: progressRequiredForOrdinal(ordinal),
        baseBreakthroughChance: Number(baseBreakthroughChance(ordinal).toFixed(4))
    }));
}
