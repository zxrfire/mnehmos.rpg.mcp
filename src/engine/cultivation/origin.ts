/**
 * Origin - the third thing a cultivator is dealt.
 *
 * A run draws a spirit root, four attributes, and a place to have been born
 * into. The first two decide what someone could become. The third decides
 * whether they will ever be in a position to find out.
 *
 * See `docs/world/origin.md`, which this file implements.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE HARD RULE: ORIGIN BUYS INPUTS, NEVER RANK
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Nothing in this module confers a realm ordinal, cultivation progress,
 * admission to an institution, a rank inside one, a foundation, an insight, or
 * any other position on the ladder. There is deliberately no field on
 * {@link OriginTier} that could. The Hollow Court's own admission text is the
 * statement of the rule: a Void Refinement floor and evidence you could cross,
 * and nothing else counts, which explicitly includes being somebody's child -
 * the children of the seated are fostered out to allied sects at whatever rank
 * they happen to be.
 *
 * What an origin buys is the five inputs the ladder actually runs on:
 *
 *   RESOURCES     spirit stones, and therefore pills, and therefore a
 *                 seclusion that is a plan rather than a way to starve
 *   PLACEMENT     a sect that will take you at an age when it matters, with a
 *                 teacher who answers and elders who stand at your crossings
 *   ACCESS        which is what gates comprehension, and is expressed through
 *                 the existing AccessSource set in understanding.ts rather
 *                 than through any mechanism of this module's own
 *   STANDING      somebody's word, which is worth more than stones and is
 *                 spent rather than kept
 *   SURVIVABLE    a well-supplied expedition into something lethal is a
 *   RISK          different act from a poor cultivator's
 *
 * None of it is a shortcut. It is the difference between a road being long and
 * a road being closed.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THIS MODULE DOES NOT DO
 * ═════════════════════════════════════════════════════════════════════════
 *
 * It does not advise. Nothing here says an origin is good, bad, promising or
 * hopeless, and nothing recommends a path from one. The table below is a
 * factual account of what a family can put behind a child, in the same voice
 * `SPIRIT_ROOTS` describes an aperture.
 *
 * It also grants nothing that has to be found. A great house can put a child
 * on dense ground; it cannot put them on a sealed vein, because a sealed vein
 * is not a thing anybody owns - it carries weight zero in the ambient roll and
 * has to be walked into. That is why `MAX_ORIGIN_AMBIENT` is `dense`, and it
 * is the reason privilege alone cannot reach the top of the ladder.
 *
 * Pure. Deterministic. No I/O, no database, no LLM.
 */

import type { AmbientQi, ManualQuality } from '../../schema/cultivation.js';
import type { DiscoveryContext, ExposureInput } from './understanding.js';

// ─────────────────────────────────────────────────────────────────────────
// THE TIERS
// ─────────────────────────────────────────────────────────────────────────

export type OriginTierKey =
    | 'thin_county'
    | 'market_town'
    | 'minor_clan'
    | 'sect_retainer'
    | 'established_clan'
    | 'great_house';

/**
 * What a family's word reaches, and what standing inside a house is worth.
 *
 * `reach` is the highest `powerOrdinal` of a sect that will take this person
 * on the family's name alone. It is NOT admission: an institution's own
 * `admissionOrdinal` still binds, and a house whose bar this person does not
 * meet does not take them however loud the name. Placement decides which
 * doors are worth knocking on, and the door decides who comes in.
 *
 * `entryRankIndex` is fixed at 0 for every tier and is asserted to be so. A
 * fostered child of a great house starts in the outer court beside everyone
 * else, and the sect's own ladder is climbed the ordinary way.
 */
export interface OriginPlacement {
    /** Highest sect `powerOrdinal` the family's word reaches. 0 means nobody. */
    reach: number;
    /** Age the placement happens at. Earlier means more of the life spent inside. */
    atAge: number;
    /** Always 0. Placement is not rank, and the constant is here to be tested. */
    entryRankIndex: 0;
    /** Multiplier on cultivation rate from arrays, guidance and not foraging. */
    sectBonus: number;
    /**
     * How much of a realm boundary the house will stand between this person and,
     * as a reduction in toll risk. Bounded by `MAX_SECT_PROTECTION` in toll.ts,
     * which this must never exceed.
     */
    tollProtection: number;
    /** Spirit stones a year the placement is worth, at the entry rank. */
    stipendPerYear: number;
}

/**
 * What the family can put a child near.
 *
 * Shaped as `DiscoveryContext` fragments on purpose: origin does not have an
 * access mechanism of its own, it supplies rows to the one that already
 * exists. Every entry becomes an `AccessSource` with a real label, and an
 * origin with nothing here reaches its own spirit root and nothing else -
 * which is the ordinary case and most of what this axis is for.
 */
export interface OriginAccess {
    teachers: readonly ExposureInput[];
    readableManuals: readonly ExposureInput[];
    /** The house's own principle, reachable only from inside the house. */
    tradition: ExposureInput | null;
}

/** What the family will fund somebody walking into somewhere lethal. */
export interface OriginExpeditions {
    /** How many supplied expeditions the family will pay for over a life. */
    supplied: number;
    /**
     * Added to the base survival probability of a supplied attempt, and
     * capped by `MAX_EXPEDITION_MARGIN`. It never makes a lethal place safe,
     * and it never touches what is found there.
     */
    survivalMargin: number;
}

export interface OriginTier {
    key: OriginTierKey;
    name: string;
    /** Selection weight out of {@link ORIGIN_WEIGHT_TOTAL}. */
    weight: number;
    /** Spirit stones the family starts them with. */
    spiritStones: number;
    /** Best ground the family can put them on. Never `sealed_vein`. */
    ground: AmbientQi;
    /**
     * WHAT BOOK THEY ARE ACTUALLY HANDED, on the quality axis rather than the
     * coverage one - see `engine/cultivation/manual-quality.ts`.
     *
     * The same kind of fact as `ground` and `placement.sectBonus`: a material
     * circumstance of the life, decided before the person had any say in it,
     * and the single most consequential of the three because it is what they
     * spend every day on. Coverage is NOT here on purpose. The rungs a road
     * covers are for sale at a stall - `lesser-qi-gathering-manual` costs the
     * price of a meal - so what an origin buys is not access to a range but a
     * better-taught version of the same range.
     *
     * It also stops being worth anything to somebody who cannot read it. A
     * great house hands out a worked canon whose demand a mediocre child of the
     * house cannot meet, so the house's advantage is CONDITIONAL ON TALENT
     * rather than flat - which is the correct answer to "a mediocre person
     * wouldn't understand a manual from a Tribulation Transcendence cultivator
     * either", applied at the bottom of the ladder where most lives happen.
     */
    roadQuality: ManualQuality;
    placement: OriginPlacement;
    access: OriginAccess;
    /**
     * Times somebody's word opens a door that standing would not. Spent rather
     * than kept: whichever system opens the door owns the ledger, this is the
     * capacity it starts from.
     */
    vouchers: number;
    expeditions: OriginExpeditions;
    /** Factual account of the position. Not an assessment of it. */
    description: string;
}

/**
 * Ceiling on what any origin can put underfoot.
 *
 * Ordinary ground, and no better. A family's holding removes the RISK of being
 * born on a thin hillside; it does not put anybody somewhere exceptional. The
 * bands above this are contested holdings that get fought over rather than
 * inherited, and the band above those is a sealed vein, which nobody owns.
 *
 * This matters more than it looks. Thin to dense is a fourfold multiplier on
 * cultivation rate - larger than the gap between the best spirit root and the
 * worst - so an origin that handed out dense ground would be a bigger term
 * than talent, and talent is supposed to decide nearly everything.
 */
export const MAX_ORIGIN_AMBIENT: AmbientQi = 'normal';

/** Ceiling on the expedition margin standing can buy. */
export const MAX_EXPEDITION_MARGIN = 0.2;

/**
 * The table.
 *
 * Weights are integers out of 100,000 rather than floats, matching
 * `SPIRIT_ROOTS`: the distribution is then exactly reproducible from a seed
 * and can be asserted without float tolerance. Nine runs in ten are a farm in
 * a thin county, and that is the point rather than a tuning artefact.
 */
export const ORIGIN_TIERS: readonly OriginTier[] = [
    {
        key: 'thin_county',
        name: 'A farm in a thin county',
        weight: 90_000,
        spiritStones: 30,
        ground: 'thin',
        // The block-printed primer off a market stall, if anything at all.
        roadQuality: 'crude',
        placement: {
            reach: 0,
            atAge: 0,
            entryRankIndex: 0,
            sectBonus: 1,
            tollProtection: 0,
            stipendPerYear: 0
        },
        access: { teachers: [], readableManuals: [], tradition: null },
        vouchers: 0,
        expeditions: { supplied: 0, survivalMargin: 0 },
        description:
            'No teacher, no manual, no vein, and nobody outside the valley who knows the family name. Whatever this person comprehends, they will comprehend from their own root or from something they walked into.'
    },
    {
        key: 'market_town',
        name: 'A trade in a market town',
        weight: 8_000,
        spiritStones: 150,
        ground: 'thin',
        // The same six pages the farm has. Money is not a shelf.
        roadQuality: 'crude',
        placement: {
            reach: 0,
            atAge: 0,
            entryRankIndex: 0,
            sectBonus: 1,
            tollProtection: 0,
            stipendPerYear: 0
        },
        access: { teachers: [], readableManuals: [], tradition: null },
        vouchers: 0,
        expeditions: { supplied: 0, survivalMargin: 0 },
        description:
            'A family with a shopfront, letters, and enough put by that a bad year is not the end of it. Nothing a cultivator can read, and nobody who could teach them.'
    },
    {
        key: 'minor_clan',
        name: 'A small cultivating family',
        weight: 1_700,
        spiritStones: 900,
        ground: 'normal',
        // A hall copy, written out by relatives who never finished it.
        roadQuality: 'crude',
        placement: {
            reach: 12,
            atAge: 14,
            entryRankIndex: 0,
            sectBonus: 1.1,
            tollProtection: 0.05,
            stipendPerYear: 12
        },
        access: {
            teachers: [],
            readableManuals: [
                { subject: 'body', label: "the family art, copied by hand and missing two pages" }
            ],
            tradition: null
        },
        vouchers: 1,
        expeditions: { supplied: 0, survivalMargin: 0.05 },
        description:
            'A hall, a hillside with some qi in it, and one relative who reached Foundation Establishment and is spoken of constantly. A local sect will look at a child sent by them.'
    },
    {
        key: 'sect_retainer',
        name: 'A retainer family, attached to a sect',
        weight: 260,
        spiritStones: 1_800,
        ground: 'normal',
        // The outer library's working book, with somebody alive who read it to the end.
        roadQuality: 'sound',
        placement: {
            reach: 20,
            atAge: 11,
            entryRankIndex: 0,
            sectBonus: 1.25,
            tollProtection: 0.12,
            stipendPerYear: 40
        },
        access: {
            teachers: [
                { subject: 'formation', label: 'the outer court instructor, who answers questions' }
            ],
            readableManuals: [
                { subject: 'sword', label: 'the outer library, which is small and open' }
            ],
            tradition: null
        },
        vouchers: 1,
        expeditions: { supplied: 1, survivalMargin: 0.05 },
        description:
            'Generations of service, and the standing arrangement that comes with it: a child of the household is looked at by the sect at eleven, and is inside the walls whether or not anything comes of it.'
    },
    {
        key: 'established_clan',
        name: 'An established cultivating clan',
        weight: 36,
        spiritStones: 15_000,
        ground: 'normal',
        // A catalogued library, and the road in it is a proper one.
        roadQuality: 'sound',
        placement: {
            reach: 29,
            atAge: 9,
            entryRankIndex: 0,
            sectBonus: 1.45,
            tollProtection: 0.2,
            stipendPerYear: 260
        },
        access: {
            teachers: [
                { subject: 'sword', label: 'a clan elder who takes two students a century' }
            ],
            readableManuals: [
                { subject: 'formation', label: 'the clan library, which is catalogued' },
                { subject: 'alchemy', label: "the clan's own pill records" },
                { subject: 'body', label: 'the tempering manuals, complete' }
            ],
            tradition: { subject: 'debt', label: "the clan's own principle, practised in the hall" }
        },
        vouchers: 3,
        expeditions: { supplied: 3, survivalMargin: 0.12 },
        description:
            'A vein the clan holds outright, a catalogued library, elders who will stand at a crossing, and a name that several sects will take a letter from. Its children are placed at nine.'
    },
    {
        key: 'great_house',
        name: 'A great house',
        weight: 4,
        spiritStones: 90_000,
        ground: 'normal',
        // The house's own worked canon - and a demand most of its children cannot meet.
        roadQuality: 'refined',
        placement: {
            reach: 38,
            atAge: 7,
            entryRankIndex: 0,
            // Bounded by MAX_SECT_PROTECTION in toll.ts. A house at this scale
            // spends what a crossing costs and tells you exactly what it spent.
            tollProtection: 0.3,
            sectBonus: 1.6,
            stipendPerYear: 1_400
        },
        access: {
            teachers: [
                { subject: 'sword', label: 'a house elder, assigned' },
                { subject: 'formation', label: 'the array master the house retains' }
            ],
            readableManuals: [
                { subject: 'formation', label: 'the inner library, which is not catalogued because nobody needs it to be' },
                { subject: 'alchemy', label: 'four centuries of pill records' },
                { subject: 'body', label: 'the tempering canon, complete and annotated' },
                { subject: 'sword', label: 'the house sword records' },
                { subject: 'mortality', label: 'the death registers, kept since the founding' }
            ],
            tradition: { subject: 'debt', label: "the house's own principle, practised at every hour" }
        },
        vouchers: 6,
        expeditions: { supplied: 8, survivalMargin: 0.2 },
        description:
            'Resources on a patriarch\'s scale, a vein under the compound, teachers assigned rather than sought, and a name that opens a door in any province anyone has heard of. It buys none of the ladder, and everyone in the house knows somebody it did not save.'
    }
] as const;

/** Sum of all weights. Origins are drawn uniformly from [0, ORIGIN_WEIGHT_TOTAL). */
export const ORIGIN_WEIGHT_TOTAL = ORIGIN_TIERS.reduce((sum, t) => sum + t.weight, 0);

/** The default, and the overwhelming majority. */
export const DEFAULT_ORIGIN: OriginTierKey = 'thin_county';

export function getOrigin(key: OriginTierKey): OriginTier {
    const tier = ORIGIN_TIERS.find(t => t.key === key);
    if (!tier) throw new Error(`Unknown origin tier: ${key}`);
    return tier;
}

/**
 * Roll an origin from a uniform [0,1) sample.
 *
 * Takes the sample rather than an RNG, matching `rollSpiritRoot`: the caller
 * owns seeding, always, and the same run seed produces the same birth.
 */
export function rollOrigin(sample: number): OriginTier {
    const clamped = Math.max(0, Math.min(0.999999999, sample));
    let cursor = clamped * ORIGIN_WEIGHT_TOTAL;
    for (const tier of ORIGIN_TIERS) {
        cursor -= tier.weight;
        if (cursor < 0) return tier;
    }
    // Float drift at the very top of the range; the last tier is correct.
    return ORIGIN_TIERS[ORIGIN_TIERS.length - 1];
}

/** Probability of being born into this tier, as a fraction of 1. */
export function originProbability(key: OriginTierKey): number {
    return getOrigin(key).weight / ORIGIN_WEIGHT_TOTAL;
}

/** Whether a stored value is a tier this build knows. */
export function isOriginTierKey(value: unknown): value is OriginTierKey {
    return typeof value === 'string' && ORIGIN_TIERS.some(t => t.key === value);
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IT BUYS: RESOURCES
//
// Stones are finite and they are spent. That is the whole of why a great
// house does not simply win: a thousand-year climb eats a patriarch's fortune
// the same way it eats everyone else's, only later.
// ─────────────────────────────────────────────────────────────────────────

/** Spirit stones a year of sealed seclusion costs: food, rent, replacements. */
export const STONES_PER_YEAR_OF_SECLUSION = 60;

/** Stones for a breakthrough pill at full potency, at ordinal zero. */
export const BREAKTHROUGH_PILL_STONES = 500;

/** Stones for a foundation-grade pill at full potency. A different market. */
export const FOUNDATION_PILL_STONES = 1_200;

/** Stones a healer wants for one torn meridian, at ordinal zero. */
export const TREATMENT_STONES = 120;

/**
 * How steeply the price of everything climbs with the rank it is for.
 *
 * The single most important number on this page, and the reason a patriarch's
 * fortune does not simply win.
 *
 * A pill that carries a Qi Condensation cultivator through a crossing is not
 * the same object as one that carries a Nascent Soul cultivator through one,
 * and it is not priced like it either: the ingredients are rarer by the same
 * order the ladder's own cost curve climbs.
 *
 * It is set to EXACTLY the ladder's own 1.35 rank-cost growth, and that
 * identity is the whole point. When price and cost climb together, the number
 * of ranks a fortune covers is logarithmic in the fortune: thirty times the
 * money buys about eleven more rungs, not thirty times the road. So a
 * patriarch's holding is worth a real and legible stretch of the climb and
 * then it is simply gone, at which point its holder is buying pills out of
 * income like everybody else. Resources on a patriarch's scale, spent rather
 * than hoarded.
 */
export const PRICE_GROWTH_PER_ORDINAL = 1.35;

/** What a breakthrough pill for this rank actually costs. */
export function breakthroughPillPrice(ordinal: number): number {
    return BREAKTHROUGH_PILL_STONES * Math.pow(PRICE_GROWTH_PER_ORDINAL, Math.max(0, ordinal));
}

/** What clearing one torn meridian at this rank actually costs. */
export function injuryTreatmentPrice(ordinal: number): number {
    return TREATMENT_STONES * Math.pow(PRICE_GROWTH_PER_ORDINAL, Math.max(0, ordinal));
}

/**
 * Years of uninterrupted seclusion a holding funds.
 *
 * The concrete meaning of "provisions that make a forty-year seclusion a plan
 * rather than a way to starve". Below what a plan needs, the cultivator has to
 * come out and work, which is a focus multiplier rather than a moral failing.
 */
export function provisionedYears(spiritStones: number): number {
    if (!Number.isFinite(spiritStones) || spiritStones <= 0) return 0;
    return spiritStones / STONES_PER_YEAR_OF_SECLUSION;
}

/**
 * Potency of the best pill a holding can pay for, 0..1.
 *
 * Linear and honest: half the price buys half the pill. Feeds
 * `ConsumedPill.potency` (scaled by `MAX_PILL_BONUS` at the call site) and
 * `FoundationConditions.pillPotency`, both of which already clamp.
 */
export function affordablePillPotency(spiritStones: number, priceAtFullPotency: number): number {
    if (!Number.isFinite(spiritStones) || spiritStones <= 0) return 0;
    if (!Number.isFinite(priceAtFullPotency) || priceAtFullPotency <= 0) return 0;
    return Math.max(0, Math.min(1, spiritStones / priceAtFullPotency));
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IT BUYS: ACCESS
//
// Wired into the access set that already exists. There is no second
// mechanism, and there must never be one: an origin that opened
// comprehension by any route other than an AccessSource would be a Dao
// granted without provenance, which understanding.ts refuses by construction.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The rows an origin contributes to a `DiscoveryContext`.
 *
 * Callers merge this with whatever else the cultivator is currently near - a
 * sect they joined later, a ruin they opened, the ground they are standing on.
 * A `thin_county` origin contributes nothing, so the merge is a no-op and the
 * cultivator reaches their own root and nothing else.
 */
export function originDiscoveryContext(
    key: OriginTierKey
): Pick<DiscoveryContext, 'teachers' | 'readableManuals' | 'tradition'> {
    const { access } = getOrigin(key);
    return {
        teachers: access.teachers.slice(),
        readableManuals: access.readableManuals.slice(),
        tradition: access.tradition
    };
}

/**
 * Merge an origin's access into an existing context without losing anything.
 *
 * A tradition already held wins: you can only stand inside one house, and the
 * one you are actually in is the one that counts.
 */
export function withOriginAccess(
    key: OriginTierKey,
    ctx: DiscoveryContext = {}
): DiscoveryContext {
    const from = originDiscoveryContext(key);
    return {
        ...ctx,
        teachers: [...(ctx.teachers ?? []), ...(from.teachers ?? [])],
        readableManuals: [...(ctx.readableManuals ?? []), ...(from.readableManuals ?? [])],
        tradition: ctx.tradition ?? from.tradition
    };
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IT BUYS: PLACEMENT
// ─────────────────────────────────────────────────────────────────────────

/** A house the family's word reaches, described without recommending it. */
export interface PlacementCandidate {
    /** Institution id. */
    id: string;
    /** Its `powerOrdinal`. */
    powerOrdinal: number;
    /** Its own admission floor, which placement does not move. */
    admissionOrdinal: number;
}

/**
 * Which of these houses would take this person on the family's word.
 *
 * Two conditions, both hard. The house has to be within the family's reach,
 * and the applicant has to meet the house's OWN floor - placement opens the
 * conversation and never the door. This is why a great house child cannot be
 * placed at the Hollow Court: its floor is Void Refinement, and a seven year
 * old is at ordinal zero like everybody else.
 *
 * Returns matches in catalog order. It does not rank them, and it does not
 * recommend one.
 */
export function placementsWithinReach(
    key: OriginTierKey,
    applicantOrdinal: number,
    houses: readonly PlacementCandidate[]
): PlacementCandidate[] {
    const reach = getOrigin(key).placement.reach;
    if (reach <= 0) return [];
    return houses.filter(
        h => h.powerOrdinal <= reach && applicantOrdinal >= h.admissionOrdinal
    );
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IT BUYS: SURVIVABLE RISK
// ─────────────────────────────────────────────────────────────────────────

/**
 * Survival odds for a supplied expedition into somewhere lethal.
 *
 * Three properties this must keep:
 *
 *   1. It moves survival and NOTHING else. It does not touch what is in the
 *      ruin, whether the vein is there, or whether it is still unopened. A
 *      house can pay for the escorts and the talismans; it cannot pay for the
 *      place to contain something.
 *   2. It is bounded. `MAX_EXPEDITION_MARGIN` keeps the worst places lethal
 *      to everybody, which is the reason the poor road exists at all.
 *   3. It runs out. `expeditions.supplied` is a count over a whole life, and
 *      an unsupplied attempt gets the base number like anyone else's.
 */
export function expeditionSurvival(
    key: OriginTierKey,
    baseSurvival: number,
    supplied: boolean
): number {
    const base = Math.max(0, Math.min(1, baseSurvival));
    if (!supplied) return base;
    const margin = Math.min(MAX_EXPEDITION_MARGIN, getOrigin(key).expeditions.survivalMargin);
    return Math.max(0, Math.min(1, base + margin));
}

// ─────────────────────────────────────────────────────────────────────────
// THE OPENING POSITION
//
// Everything an origin is worth, in one factual object. This is what a
// character sheet prints. It contains no ordinal, no rank, no progress and no
// judgement, and the shape is the enforcement.
// ─────────────────────────────────────────────────────────────────────────

export interface OpeningPosition {
    origin: OriginTierKey;
    name: string;
    /** Share of births that land here. */
    probability: number;
    spiritStones: number;
    /** Years of sealed seclusion the stones fund, before anything is spent on pills. */
    provisionedYears: number;
    /** Best ground the family can put them on. */
    ground: AmbientQi;
    /** Highest sect power ordinal the name reaches. 0 means nobody. */
    placementReach: number;
    /** Age the placement happens at. 0 means it does not. */
    placementAge: number;
    /** Comprehensions this birth puts within reach at all, by access kind. */
    accessCount: { teachers: number; manuals: number; tradition: boolean };
    vouchers: number;
    suppliedExpeditions: number;
    description: string;
}

/**
 * The opening position, and only the opening position.
 *
 * Deliberately not a summary of prospects. A player reading this learns what
 * they were handed on the day they were born; nothing here tells them what it
 * is worth, because the world does not know either.
 */
export function openingPosition(key: OriginTierKey): OpeningPosition {
    const tier = getOrigin(key);
    return {
        origin: tier.key,
        name: tier.name,
        probability: tier.weight / ORIGIN_WEIGHT_TOTAL,
        spiritStones: tier.spiritStones,
        provisionedYears: provisionedYears(tier.spiritStones),
        ground: tier.ground,
        placementReach: tier.placement.reach,
        placementAge: tier.placement.atAge,
        accessCount: {
            teachers: tier.access.teachers.length,
            manuals: tier.access.readableManuals.length,
            tradition: tier.access.tradition !== null
        },
        vouchers: tier.vouchers,
        suppliedExpeditions: tier.expeditions.supplied,
        description: tier.description
    };
}
