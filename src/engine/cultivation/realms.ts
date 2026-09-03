/**
 * The Cultivation Ladder - 47 ranks, ordinal 0 through 46.
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
    | 'immortal';

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
     * Per-rung overrides, indexed from `ordinalStart`, for the one realm whose
     * rungs do not share a grant. Sparse: an absent or undefined entry means
     * the realm's headline figure applies. Only the Immortal realm needs these,
     * and it needs them because its two rungs are landings of one attempt
     * rather than steps of a climb - a False Immortal's span is enormous and
     * countable, a True Immortal's is not a number that means anything.
     */
    rungLifespanYears?: readonly (number | undefined)[];
    rungPowerMultiplier?: readonly (number | undefined)[];
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
        // Counted in turns, because that is what the realm does: the form is
        // taken apart and put back together, four times, and each time it comes
        // back less like the thing that was born.
        subRanks: ['First Turn', 'Second Turn', 'Third Turn', 'Final Turn'],
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
        // Temperings, not stages. Nothing is added here; the same self is put
        // back into the emptiness and taken out smaller and harder.
        subRanks: ['First Tempering', 'Second Tempering', 'Third Tempering', 'Final Tempering'],
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
        // Named for what has been joined, outermost inward. A cultivator at
        // Organ has soul in three of the four and is still cuttable at the
        // fourth, which is precisely how people at this realm are killed.
        subRanks: ['Sinew', 'Bone', 'Organ', 'Marrow'],
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
        // Four ascensions, not four degrees of one. Each raises a different
        // thing, and the order is fixed: the body goes first because it is the
        // easiest, the dao last because there is nothing after it to raise.
        subRanks: ['Rising Body', 'Rising Soul', 'Rising Name', 'Rising Dao'],
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
        key: 'immortal',
        name: 'Immortal',
        hanzi: '仙',
        ordinalStart: 45,
        ordinalEnd: 46,
        // Two rungs, and only one of them can be climbed off. The crossing is
        // attempted once from 44 and lands on one of them; a False Immortal is
        // above every mortal rank and permanently below the rung it was
        // reaching for. See the note on the last crossing below.
        subRanks: ['False', 'True'],
        // Entry to this realm is ordinal 45, so the headline figures are the
        // False Immortal's. The rung above overrides both.
        lifespanYears: FALSE_IMMORTAL_LIFESPAN_YEARS,
        powerMultiplier: FALSE_IMMORTAL_POWER_MULTIPLIER,
        rungLifespanYears: [undefined, UNBOUNDED_LIFESPAN_YEARS],
        rungPowerMultiplier: [undefined, 1048576],
        description:
            'Above the Lid, on one side of it or the other. The only realm entered by surviving a crossing rather than by accumulating enough of anything.'
    }
] as const;

/**
 * Highest legal ordinal on the ladder: True Immortal.
 *
 * Reachable only by completing the last crossing. The rung below it, 45, is the
 * other outcome of the same attempt and is reachable no other way either - so
 * the top of the ladder is the one stretch of it that cannot be climbed into.
 */
export const MAX_ORDINAL = 46;
/** Total number of ranks, including ordinal 0. */
export const TOTAL_RANKS = MAX_ORDINAL + 1;

/**
 * The two rungs of the Immortal realm, named because almost every rule about
 * the top of the ladder needs to tell them apart. Both are landings of the same
 * single attempt; neither is reachable by cultivating into it.
 */
export const FALSE_IMMORTAL_ORDINAL = 45;
export const TRUE_IMMORTAL_ORDINAL = 46;

/**
 * How long anything above the Lid may remain below it, in breaths.
 *
 * The rule that stops the whole setting collapsing, and it applies to people
 * and to objects alike: cross, and the lower realm stops being somewhere you
 * can be. Come back down and tribulation lightning takes you back up again in
 * ten to fifteen breaths - not as a punishment, not as an enforcement anybody
 * arranges, but the way water finds a level. A True Immortal in the mortal
 * world is a thing being expelled, and the expulsion is already happening for
 * the whole time they are here.
 *
 * FORTY-FIVE IS THE LINE, AND IT IS WHY THE LINE IS THERE
 * A False Immortal is at forty-five and may stay. That is the entire practical
 * difference between the two rungs, and it is why the world has False
 * Immortals living in it and has never had a True one living in it. Lu Sheng
 * can hold an office, teach, carve a legacy and be met. Somebody one rung above
 * him gets a quarter of a minute.
 *
 * WHAT THAT MAKES OF THE LARGEST THREAT IN THE WORLD
 * A retaliation from above the Lid is absolute and is also over almost before
 * it starts. Ten to fifteen breaths at that rung is enough to end a faction and
 * is not enough to take one, hold ground, occupy a province, install anybody or
 * govern for an afternoon. It cannot conquer. It can only answer, once, very
 * fast, and then it is gone whether it finished or not - which is exactly why
 * it deters and exactly why nobody above the Lid rules anything down here.
 */
export const BREATHS_IN_THE_LOWER_REALM = { min: 10, max: 15 } as const;

/**
 * What a technique can and cannot buy you, measured.
 *
 * A cultivator may practise an art rated above their own rung - there is no
 * rule against it and the catalog contains arts nobody in the world can use
 * properly. The question is what that is worth, and the answer is sharp:
 *
 *   a 44 with the best art in the world beats a bare 44        97%
 *   the same 44 against a bare 45                               0%
 *   the same 44 against a 45 who also has the art               0%
 *   a 44 with the art AND an object of the immortal band      100%
 *
 * So an art is worth an enormous amount INSIDE a realm and buys nothing
 * across the Lid. Practise the highest art in existence at full mastery and
 * you are still a mortal thing to a False Immortal. Hand the same person an
 * object made on the other side and they win.
 *
 * That is the whole shape of the boundary: it is not a power threshold that
 * enough training crosses, it is a category, and the only things that cross
 * it are things that were made on the far side. Dao and technique are how far
 * you get up the ladder. They are not how you get off it.
 */
/**
 * Why a manual may be rated at forty-six and a weapon may not.
 *
 * They are not the same kind of object and the difference is what the thing
 * DOES in a hand. A manual is paper: an immortal can send one down, somebody
 * below the Lid can study it, and what they get is an art they can practise
 * to its full depth while remaining exactly as strong as they were. Nothing
 * about holding it makes them anything. The measurement above is the proof -
 * the best art in the world at full mastery buys nothing across the Lid.
 *
 * A weapon is the opposite by definition. A weapon rated at a rung is a thing
 * that lets whoever holds it strike at that rung, which is exactly why an
 * object crosses where an art does not. So a forty-six weapon in the lower
 * realm would be a way for somebody at forty-four to injure a True Immortal,
 * and there is no such thing: what a True Immortal carries goes back up with
 * them inside fifteen breaths, and nothing at that rung is ever left behind,
 * lost, looted or inherited. The ceiling on any object that can be HELD down
 * here is forty-five, and it is a ceiling for a reason rather than by
 * accident of what has turned up.
 */
export const OBJECT_CEILING_BELOW_THE_LID = FALSE_IMMORTAL_ORDINAL;

/** A manual is paper. It may be rated anywhere, including above the Lid. */
export const MANUALS_MAY_EXCEED_THE_LID = true;

export const WHAT_AN_ART_BUYS = {
    insideARealm: 'decisive - the best art in the world is worth most of a rung',
    acrossTheLid: 'nothing at all, at any mastery',
    whatDoesCross: 'an object made above the Lid, and only that'
} as const;

/** True where crossing has made the lower realm something that expels you. */
export function isExpelledFromBelow(ordinal: number): boolean {
    return ordinal > FALSE_IMMORTAL_ORDINAL;
}

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

/** Sub-rank name within the realm, e.g. "Layer 7", "Perfection", "Marrow". */
export function subRankForOrdinal(ordinal: number): string {
    const clamped = clampOrdinal(ordinal);
    const tier = realmForOrdinal(clamped);
    return tier.subRanks[clamped - tier.ordinalStart];
}

/**
 * Full display name, e.g. "Qi Condensation Layer 7", "Body Integration Marrow".
 *
 * A realm holding exactly one rank is named by the realm alone: "True Immortal"
 * rather than "True Immortal Ascended". There is nothing to be partway through
 * up there, so the sub-rank carries no information.
 */
export function rankName(ordinal: number): string {
    const tier = realmForOrdinal(ordinal);
    if (tier.subRanks.length === 1) return tier.name;
    // The only realm whose sub-rank is an adjective rather than a stage, so it
    // reads in front: "False Immortal", not "Immortal False".
    if (tier.key === 'immortal') return `${subRankForOrdinal(ordinal)} ${tier.name}`;
    return `${tier.name} ${subRankForOrdinal(ordinal)}`;
}

/** Lifespan ceiling in years for a cultivator standing at this ordinal. */
export function lifespanForOrdinal(ordinal: number): number {
    const clamped = clampOrdinal(ordinal);
    const tier = realmForOrdinal(clamped);
    return tier.rungLifespanYears?.[clamped - tier.ordinalStart] ?? tier.lifespanYears;
}

export function powerMultiplierForOrdinal(ordinal: number): number {
    const clamped = clampOrdinal(ordinal);
    const tier = realmForOrdinal(clamped);
    return tier.rungPowerMultiplier?.[clamped - tier.ordinalStart] ?? tier.powerMultiplier;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT A RUNG BUYS IN BODY
//
// The third curve on the ladder, beside power and lifespan, and the one that
// says how much a cultivator can HOLD: hit points and the qi in the aperture.
//
// ── WHY THE POOL HAS TO GROW AT ALL ──────────────────────────────────────
//
// Not because a bigger pool wins fights. It does not, and that is worth
// stating plainly because it is the intuition everybody arrives with:
// `resolveExchange` charges damage as a fraction of the DEFENDER'S OWN
// maximum, so two combatants with identical power settle in the same number of
// exchanges whether they hold fifty points or fifty thousand. Scaling both
// pools changes no confrontation anywhere.
//
// What the pool decides is everything the world prices in ABSOLUTE numbers,
// and the qi half of it is a hard contract rather than a matter of taste.
// `GRADE_QI_BANDS` in the technique catalog bands `qiCost` by grade - mortal
// 2-14, earth 15-49, heaven 50-129, immortal 130-349, chaos 350-1500 - and
// `GRADE_ORDINAL_BANDS` says which rung each grade opens at: 0, 13, 21, 29, 37.
// `canUseTechnique` refuses an art the cultivator cannot pay for. So the pool
// curve is not free: at the rung a grade opens, the aperture must hold that
// grade's costs, or the catalog above that line is unreachable by anybody.
//
// ── THE CALIBRATION, AND WHERE THE NUMBER COMES FROM ─────────────────────
//
// A grade band opens every eight rungs and its ceiling rises about x3.5 each
// time (14, 49, 129, 349, 1500). x3.5 over eight rungs is x1.165 a rung, which
// over the four rungs of a major realm is x1.84 - so the pool has to roughly
// DOUBLE every realm to keep pace with what that realm lets you learn. Hence
// the one number below. It is derived from the catalog's own banding, not
// chosen: measured before this existed, 86 of the 138 arts in the catalog cost
// more qi than any player could ever hold, and 38 of them more than any NPC.
//
// ── AND WHY IT IS TWO AND NOT FOUR ───────────────────────────────────────
//
// Power is x4 a realm. The body is x2. The gap between them is deliberate and
// it is the whole reason a cultivation world stays lethal as it climbs: force
// outruns the vessel by a factor of two every realm, so a fight between peers
// is settled in the same handful of exchanges at the top of the ladder as at
// the bottom, and nobody anywhere accumulates enough body to stop dying. See
// AGENTS.md, "nothing in this world is invincible" - this is that law
// expressed as a curve rather than as a branch.
// ─────────────────────────────────────────────────────────────────────────

/**
 * What a major realm multiplies the body and the aperture by.
 *
 * Against `powerMultiplier`'s x4. Changing this without re-reading
 * `GRADE_QI_BANDS` will silently put part of the technique catalog out of
 * reach of everybody in the world, which is the state this constant was added
 * to end.
 */
export const BODY_REALM_MULTIPLIER = 2;

/**
 * What the sub-ranks of one realm are worth to the body.
 *
 * The same shape as `WITHIN_REALM_PEAK` in `combat.ts`, and set to the same
 * value for a reason that is arithmetic rather than aesthetic: at 2 against a
 * realm multiplier of 2, a realm's Perfection lands exactly on the next
 * realm's Early, so the pool curve is CONTINUOUS across every boundary. A
 * crossing enlarges nothing on its own; the rungs did it. Power is
 * deliberately not continuous - there the step is the point.
 */
export const WITHIN_REALM_BODY_PEAK = 2;

/**
 * How much body a cultivator at this ordinal holds, as a multiple of a
 * newborn's.
 *
 * Interpolated across the sub-ranks rather than stepped at the realm, so that
 * every rung buys something. `combatPowerForOrdinal` is the model.
 */
export function bodyMultiplierForOrdinal(ordinal: number): number {
    const clamped = clampOrdinal(ordinal);
    const tier = realmForOrdinal(clamped);
    const index = REALM_TIERS.findIndex(t => t.key === tier.key);
    const base = Math.pow(BODY_REALM_MULTIPLIER, index);
    const span = tier.ordinalEnd - tier.ordinalStart;
    if (span <= 0) return base;
    const position = (clamped - tier.ordinalStart) / span;
    return base * (1 + position * (WITHIN_REALM_BODY_PEAK - 1));
}

/**
 * A newborn's body, before the ladder multiplies it.
 *
 * These four are the values a run opens on at ordinal 0, and
 * `maxHpForOrdinal(might, 0)` must equal what the birth path writes.
 * `tests/engine/cultivation/what-a-rung-buys-in-body.test.ts` pins that
 * equality against the played layer's own constants.
 */
export const BASE_BODY_HP = 20;
export const HP_PER_MIGHT = 10;
export const BASE_APERTURE_QI = 10;
export const QI_PER_INSIGHT = 5;

/**
 * The one derivation of a cultivator's HP pool. Nobody may write another.
 *
 * Derived, not chosen: a body holds what Might and the rung it stands on let
 * it hold. Everything that mints or advances a cultivator - the player's birth,
 * an NPC spawn, a rank change - goes through this, which is what stops the
 * world running one formula and the player another.
 */
export function maxHpForOrdinal(might: number, ordinal: number): number {
    return Math.round((BASE_BODY_HP + might * HP_PER_MIGHT) * bodyMultiplierForOrdinal(ordinal));
}

/** The one derivation of a cultivator's qi pool. An aperture's throughput follows Insight. */
export function maxQiForOrdinal(insight: number, ordinal: number): number {
    return Math.round((BASE_APERTURE_QI + insight * QI_PER_INSIGHT) * bodyMultiplierForOrdinal(ordinal));
}

/**
 * Carry a pool across a change of rung, keeping the share rather than the number.
 *
 * A crossing is not a heal and never fills anybody, so the fraction is what
 * survives: whole stays whole, half stays half, and somebody who was nearly
 * finished is still nearly finished in a larger body. Rounds up off zero so a
 * living cultivator cannot be rounded into a corpse, and returns the new
 * maximum when the old one is missing or zero, which is the only reading
 * available when there is no share to take.
 *
 * IT LIVES HERE BECAUSE THE POOLS DO. The two functions above are "the one
 * derivation of a cultivator's HP pool. Nobody may write another", and how that
 * pool survives a rung change is the same question asked at the moment the rung
 * moves. It was in `storage/repos/cultivator.repo.ts`, which still re-exports it
 * for the callers that ask there, and that address put an engine-layer rule
 * behind a module that opens a database - so the world layer could not reach it
 * without pulling SQLite into `engine/`, and would have written a second copy.
 */
export function carriedAcross(current: number, wasMax: number, nowMax: number): number {
    if (!Number.isFinite(wasMax) || wasMax <= 0) return nowMax;
    const share = Math.min(1, Math.max(0, current / wasMax));
    return Math.min(nowMax, Math.max(current > 0 ? 1 : 0, Math.round(share * nowMax)));
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
// It is a rank of its own, ordinal 45, under the Immortal realm. Something
// did happen to them - they are strictly stronger than anything still under the
// Lid, and the strongest thing most of the world will ever have to fight. What
// they are not is finished: 46 is one rung up and permanently out of reach,
// because the Lid does not open twice for the same name. `immortalStatus`
// still records which way the crossing went, since 'has crossed' is what bars
// the re-attempt, and an ordinal alone cannot say it.
// ─────────────────────────────────────────────────────────────────────────

/** Whether a cultivator completed the last crossing, half-completed it, or has not tried. */
export type ImmortalStatus = 'none' | 'false_immortal' | 'true_immortal';

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

/**
 * Ordinal of the last crossing: the attempt from Tribulation Transcendence
 * Perfection. Written out rather than derived from `MAX_ORDINAL`, because the
 * attempt has two possible landings above it and pinning it to the ceiling
 * would silently follow the wrong one.
 */
export const LAST_CROSSING_ORDINAL = 44;


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
    // 45 -> 46 is not a step. A False Immortal is not partway to True Immortal;
    // they are done, at the rung the crossing left them on.
    if (clamped === FALSE_IMMORTAL_ORDINAL) return false;
    return realmForOrdinal(clamped).key !== realmForOrdinal(clamped + 1).key;
}

/** Qi-units required at ordinal 0. Every other rung is derived from it. */
export const BASE_PROGRESS = 100;

/** What one rung costs relative to the rung below it, before the floor. */
export const PROGRESS_GROWTH = 1.35;

/**
 * What the crossing itself costs, over and above the rung's position.
 *
 * This is the wall. A cultivator does not fail at a realm boundary because the
 * curve got gently steeper; they fail because one specific rung costs several
 * times what the rung below it did, and the years that takes run past what the
 * realm allows them to stand still. Flattening it into the growth rate spreads
 * the same total across four rungs and dissolves the wall - which is exactly
 * what the ceiling tests catch.
 */
export const CROSSING_TAX = 2.5;

/**
 * What the LAST crossing costs, replacing the ordinary crossing tax at
 * ordinal 44.
 *
 * The two numbers moved together and for opposite reasons, so they are worth
 * reading as a pair.
 *
 * The ordinary tax came DOWN, from 2.5, because at 2.5 the boundary rung of the
 * upper realms cost between two thirds and three quarters of everything the
 * settling clock at that rung would ever allow. That does not make the wall
 * harder to cross - it makes a single bad roll at the wall unrecoverable, and a
 * cultivator who took a qi deviation at Body Integration Marrow was not killed
 * by it, they were STRANDED by it. Measured, that was producing more than twice
 * as many people plateaued halfway up as the setting wants, and it was doing it
 * by arithmetic rather than by anything that happened to them. A wall should
 * kill; being unable to afford another go at it is a different and much duller
 * story.
 *
 * The last crossing's went UP, because there the price IS the story. Nothing
 * about ordinal 44 is a wall to be re-struck: it is a sum of qi so large that
 * gathering it consumes most of the century-thousand the rung grants, and the
 * commonest end at the top of the ladder is a cultivator who stood on the last
 * rung for their whole enormous life and never gathered enough to summon
 * anything. Three times the untaxed rung is what puts the price at roughly
 * seven eighths of that clock for a cultivator in perfect condition - which
 * means anyone who arrived worn cannot pay it at all, and knows it.
 */
export const LAST_CROSSING_TAX = 3;

/**
 * The least a rung may cost relative to the rung below it, once the crossing
 * tax has been paid.
 *
 * The tax makes the boundary rung a local spike, and a local spike used to mean
 * the first rung of the next realm cost roughly half the last rung of the one
 * below it. Nine times up the ladder, advancing got cheaper as the cultivator
 * got stronger; the monotonicity test carved the boundaries out rather than
 * reporting it.
 *
 * A price that has been paid does not come back down. Once the crossing has set
 * the level, the rungs after it hold at that level and creep, until the
 * underlying curve overtakes them again partway through the realm. Those first
 * rungs above a boundary are consolidation - re-earning what the crossing cost
 * before making any actual headway - and they are the cheapest part of a realm
 * only in the sense that they are not more expensive than getting into it.
 */
export const FLOOR_GROWTH = 1.02;

/**
 * The curve before the floor: position on the ladder, plus the crossing tax on
 * the rungs where a realm is actually crossed.
 */
function untaxedProgressAt(ordinal: number): number {
    const tier = realmForOrdinal(ordinal);
    const stepWithinRealm = ordinal - tier.ordinalStart;
    const tax = isLastCrossing(ordinal)
        ? LAST_CROSSING_TAX
        : isRealmBoundary(ordinal)
          ? CROSSING_TAX
          : 1;
    return (BASE_PROGRESS * Math.pow(PROGRESS_GROWTH, ordinal) + stepWithinRealm * 50) * tax;
}

/**
 * The climbable rungs, priced once at module load. Each is the larger of what
 * its own position asks and what the rung below it already cost, so the series
 * is strictly increasing by construction rather than by tuning.
 */
const PROGRESS_LADDER: readonly number[] = (() => {
    const out: number[] = [];
    for (let ordinal = 0; ordinal < FALSE_IMMORTAL_ORDINAL; ordinal++) {
        const floor = ordinal === 0 ? 0 : out[ordinal - 1] * FLOOR_GROWTH;
        out.push(Math.round(Math.max(untaxedProgressAt(ordinal), floor)));
    }
    return out;
})();

/**
 * Cultivation progress (in qi-units) required to attempt a breakthrough from
 * this ordinal, or `null` above the Lid.
 *
 * Strictly increasing across all 45 climbable rungs - a higher rung is never
 * cheaper than a lower one. That is a property of how `PROGRESS_LADDER` is
 * built rather than of the numbers in it, so the ladder test asserts it over
 * the whole range instead of skipping the boundaries the way it used to.
 *
 * It grows super-linearly, which is why the overwhelming majority of runs end
 * somewhere in Qi Condensation, and it spikes at each realm boundary, which is
 * why most of the rest end at one.
 *
 * Above the Lid it returns `null` rather than a number. Immortal qi is not this
 * currency and there is no exchange rate worth writing down - a figure here
 * would be a lie with a lot of digits in it. Nothing can attempt from 45 or 46
 * in any case: 46 is the summit and 45 is barred by `hasCrossedTheLid`.
 */
export function progressRequiredForOrdinal(ordinal: number): number | null {
    const clamped = clampOrdinal(ordinal);
    if (clamped >= FALSE_IMMORTAL_ORDINAL) return null;
    return PROGRESS_LADDER[clamped];
}

/**
 * The same figure with the "not in this currency" case collapsed to zero, for
 * the callers that only ever ask about cultivators who are still climbing and
 * would otherwise all repeat the same null check. Never use it to decide
 * whether an attempt is legal - use `canAttemptBreakthrough`.
 */
export function progressRequiredOrZero(ordinal: number): number {
    return progressRequiredForOrdinal(ordinal) ?? 0;
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
    /** Null on the two rungs above the Lid. See `progressRequiredForOrdinal`. */
    progressRequired: number | null;
    baseBreakthroughChance: number;
}

/** Flat 0..46 table, for UIs and reference tooling. */
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
