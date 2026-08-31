/**
 * The Cultivation Ladder - 46 ranks, ordinal 0 through 45.
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
    | 'tribulation_transcendence'
    | 'true_immortal';

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

/**
 * Lifespan stand-in for True Immortal.
 *
 * A billion years rather than `Infinity`: the value is carried in result
 * objects that get serialised, and `JSON.stringify(Infinity)` is `null`, which
 * would arrive downstream as "no lifespan recorded" rather than "unbounded".
 * Nothing in this engine ages anywhere near it.
 */
export const UNBOUNDED_LIFESPAN_YEARS = 1_000_000_000;

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
            'The approach to the Lid, not the summit. Survive the heavenly tribulation and ascend, or do not.'
    },
    {
        key: 'true_immortal',
        name: 'True Immortal',
        hanzi: '真仙',
        ordinalStart: 45,
        ordinalEnd: 45,
        // One rank, because there is nothing to be partway through. Either the
        // hole in the Lid was punched and the cultivator went through it, or it
        // was not.
        subRanks: ['Ascended'],
        lifespanYears: UNBOUNDED_LIFESPAN_YEARS,
        powerMultiplier: 1048576,
        description:
            'The crossing completed. The top of the ladder, and the only way a run ends that is not a death. Lifespan stops being a number that means anything.'
    }
] as const;

/**
 * Highest legal ordinal on the ladder: True Immortal.
 *
 * Note this is reachable only by completing the last crossing. A False Immortal
 * - the common outcome of attempting it - stays at 44 forever and is described
 * by `immortalStatus` rather than by an ordinal, because they did not arrive
 * anywhere. See `FALSE_IMMORTAL_*` below.
 */
export const MAX_ORDINAL = 45;
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

/**
 * Full display name, e.g. "Qi Condensation Layer 7", "Core Formation Perfection".
 *
 * A realm holding exactly one rank is named by the realm alone: "True Immortal"
 * rather than "True Immortal Ascended". There is nothing to be partway through
 * up there, so the sub-rank carries no information.
 */
export function rankName(ordinal: number): string {
    const tier = realmForOrdinal(ordinal);
    if (tier.subRanks.length === 1) return tier.name;
    return `${tier.name} ${subRankForOrdinal(ordinal)}`;
}

/** Lifespan ceiling in years for a cultivator standing at this ordinal. */
export function lifespanForOrdinal(ordinal: number): number {
    return realmForOrdinal(ordinal).lifespanYears;
}

export function powerMultiplierForOrdinal(ordinal: number): number {
    return realmForOrdinal(ordinal).powerMultiplier;
}

// ─────────────────────────────────────────────────────────────────────────
// THE FALSE IMMORTAL
//
// The half-failure of the last crossing, and deliberately NOT an ordinal. The
// tribulation was survived and the Lid was opened, but the crossing did not
// complete - the seam closed early, or the body would not follow the soul, or
// something on the other side declined to take them. What is left stays on
// this side permanently.
//
// Representing it as a status rather than a rank is the whole point. A False
// Immortal did not arrive anywhere; they are standing exactly where they were,
// changed. Giving them ordinal 45 would say they ascended, and giving them a
// rank of their own would put them on a ladder they are permanently off.
// ─────────────────────────────────────────────────────────────────────────

/** Whether a cultivator completed the last crossing, half-completed it, or has not tried. */
export type ImmortalStatus = 'none' | 'false_immortal' | 'true_immortal';

/**
 * Strictly above Tribulation Transcendence Perfection (65536) and strictly
 * below True Immortal (1048576). Part of the transformation did happen, and it
 * is the reason a False Immortal is one of the most dangerous things alive.
 */
export const FALSE_IMMORTAL_POWER_MULTIPLIER = 262144;

/**
 * Vast, and finite, and countable. They will die on this side having been most
 * of the way through, which is the entire tragedy of the Hollow Court.
 */
export const FALSE_IMMORTAL_LIFESPAN_YEARS = 300000;

/** Power multiplier accounting for a False Immortal's incomplete ascension. */
export function effectivePowerMultiplier(ordinal: number, status: ImmortalStatus = 'none'): number {
    if (status === 'false_immortal') return FALSE_IMMORTAL_POWER_MULTIPLIER;
    return powerMultiplierForOrdinal(ordinal);
}

/** Lifespan ceiling accounting for a False Immortal's extended, finite span. */
export function effectiveLifespanYears(ordinal: number, status: ImmortalStatus = 'none'): number {
    if (status === 'false_immortal') return FALSE_IMMORTAL_LIFESPAN_YEARS;
    return lifespanForOrdinal(ordinal);
}

/**
 * True for anyone who has already been through the last crossing, either way.
 *
 * The Lid does not open twice for the same name, so this is also the predicate
 * that permanently bars a re-attempt. It is a refusal by the engine, not a
 * small probability.
 */
export function hasCrossedTheLid(status: ImmortalStatus = 'none'): boolean {
    return status !== 'none';
}

/** Ordinal of the last crossing: the attempt from Tribulation Transcendence Perfection. */
export const LAST_CROSSING_ORDINAL = MAX_ORDINAL - 1;

/** Whether an attempt from this ordinal is the last crossing through the Lid. */
export function isLastCrossing(ordinal: number): boolean {
    return clampOrdinal(ordinal) === LAST_CROSSING_ORDINAL;
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
 * Whether an attempt FROM this ordinal summons heavenly lightning.
 *
 * Lightning is the Lid's seam discharging while it decides whether the hole you
 * are about to punch is worth the qi it will cost to seal behind you. It
 * therefore fires on every crossing INTO Tribulation Transcendence (40 -> 41),
 * on every step WITHIN it, and on the last crossing OUT of it (44 -> 45), which
 * is the one the whole realm is named for and the heaviest tribulation in the
 * game.
 *
 * Expressed as "origin or destination is Tribulation Transcendence" so that
 * both ends of the realm are covered. An earlier revision tested the origin
 * alone, which meant the entry crossing summoned nothing; testing only the
 * destination would now miss the exit crossing instead.
 */
export function triggersHeavenlyTribulation(ordinal: number): boolean {
    const clamped = clampOrdinal(ordinal);
    if (clamped >= MAX_ORDINAL) return false;
    return (
        realmForOrdinal(clamped).key === 'tribulation_transcendence' ||
        realmForOrdinal(clamped + 1).key === 'tribulation_transcendence'
    );
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
