/**
 * Origin - the third thing a cultivator is dealt.
 */

import type { AmbientQi, ManualQuality } from '../../schema/cultivation.js';
import type { DiscoveryContext, ExposureInput } from './understanding.js';

// THE TIERS

export type OriginTierKey =
    | 'thin_county'
    | 'market_town'
    | 'minor_clan'
    | 'sect_retainer'
    | 'established_clan'
    // The three routes at the top. Siblings, not rungs - see the header.
    | 'dao_house_bloodline'
    | 'apex_sect_members_child'
    | 'fostered_on_a_word';

/**
 * The kind of body the family itself belongs to, stated as what a house IS rather
 * than as which house it is.
 */
export interface FamilyHouse {
    /**
     * What kind of roll the house keeps.
     */
    roster: 'a lineage' | 'an intake';
    /** Lowest `powerOrdinal` a house at this family's own standing holds. */
    standingFrom: number;
    /**
     * Whether the family lives on the house's ground or on its own.
     */
    whereTheyLive: 'inside it' | 'a hall of their own';
    /**
     * Whether the house's own roll carries this person from the day they were born,
     * and by which route. NEVER A RANK - see the note below.
     */
    onTheRoll: 'by blood' | 'by taking' | null;
}

/**
 * What a family's word reaches, and what standing inside a house is worth.
 *
 * `reach` is the family's WORD and not the family's standing, and reading it as
 * the standing was wrong both ways. TOO HIGH: `dao_house_bloodline` reaches 38
 * and the seven Dao houses stand at 29 to 35, so over 200 forced births a tier
 * named "A Dao house, by blood" drew a Dao house ZERO times. TOO LOW:
 * `apex_sect_members_child` reaches 29 deliberately, and its band contained no
 * apex at all.
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
     */
    roadQuality: ManualQuality;
    placement: OriginPlacement;
    /**
     * The house the family itself belongs to, or null where it belongs to
     * nobody and where its hall is its own. See {@link FamilyHouse} for why
     * this is not derivable from `placement.reach`.
     */
    familyHouse: FamilyHouse | null;
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
 */
export const MAX_ORIGIN_AMBIENT: AmbientQi = 'normal';

/** Ceiling on the expedition margin standing can buy. */
export const MAX_EXPEDITION_MARGIN = 0.2;

/**
 * The table.
 */
export const ORIGIN_TIERS: readonly OriginTier[] = [
    {
        key: 'thin_county',
        name: 'A farm in a thin county',
        weight: 9_000_000,
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
        // Nobody. Nine births in ten.
        familyHouse: null,
        access: { teachers: [], readableManuals: [], tradition: null },
        vouchers: 0,
        expeditions: { supplied: 0, survivalMargin: 0 },
        description:
            'No teacher, no manual, no vein, and nobody outside the valley who knows the family name. Whatever this person comprehends, they will comprehend from their own root or from something they walked into.'
    },
    {
        key: 'market_town',
        name: 'A trade in a market town',
        weight: 800_000,
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
        familyHouse: null,
        access: { teachers: [], readableManuals: [], tradition: null },
        vouchers: 0,
        expeditions: { supplied: 0, survivalMargin: 0 },
        description:
            'A family with a shopfront, letters, and enough put by that a bad year is not the end of it. Nothing a cultivator can read, and nobody who could teach them.'
    },
    {
        key: 'minor_clan',
        name: 'A small cultivating family',
        weight: 170_000,
        spiritStones: 900,
        ground: 'normal',
        // A hall copy, written out by relatives who never finished it.
        roadQuality: 'crude',
        placement: {
            // TWELVE BUYS NOTHING, AND THAT IS THE POINT. DO NOT "FIX" IT.
            //
            // `placementsWithinReach` filters houses by `powerOrdinal <= reach`,
            // and the weakest house in the entire catalog stands at 14. So a
            // small cultivating family's name opens exactly as many doors as a
            // farmer's, which is none, at every age, forever.
            //
            // It looks like an off-by-one and it is a decision. A family like
            // this has a shopfront, letters, a hall copy of a manual somebody's
            // relatives never finished, and no sway whatsoever - they are the
            // rung where a family believes it has standing and does not. What
            // they actually buy is above, in the stones, the ground and the
            // book, and none of that needs anybody to take their word.
            //
            // Raising this to reach the Six Li Wardens would delete the one
            // origin in the table that says something true about the difference
            // between having a little and having any.
            reach: 12,
            atAge: 14,
            entryRankIndex: 0,
            sectBonus: 1.1,
            tollProtection: 0.05,
            stipendPerYear: 12
        },
        // A local order the family is attached to, and its hall is not the
        // family's hall - so the roll does not carry them and never did.
        familyHouse: {
            roster: 'an intake', standingFrom: 12,
            whereTheyLive: 'a hall of their own', onTheRoll: null
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
        weight: 26_000,
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
        // Inside the walls from birth and on nobody's roll. A retainer
        // household serves the house; serving it is not being of it, and the
        // sect's own door is still the door.
        familyHouse: {
            roster: 'an intake', standingFrom: 20,
            whereTheyLive: 'inside it', onTheRoll: null
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
        weight: 3_600,
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
        // The clan has its own hall and its own vein; the house here is the one
        // it is attached to. Its `tradition` below is the CLAN's principle,
        // practised in the clan's hall, which is why the house's roll is
        // irrelevant to it.
        familyHouse: {
            roster: 'an intake', standingFrom: 29,
            whereTheyLive: 'a hall of their own', onTheRoll: null
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
    // The three routes at the top
    //
    // Rarer than everything above and better resourced than all of it, and NOT
    // ordered against each other: they are three different things rather than
    // three heights of one thing, and the table stops being a ladder here. See
    // the header. Their weights sum to 400, which is the old single row's 4 in
    // the old denominator, exactly.
    {
        key: 'dao_house_bloodline',
        name: 'A Dao house, by blood',
        weight: 240,
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
        // A HOUSE IS A FAMILY, AND THIS PERSON IS IN IT. The roll is the
        // lineage, so being born to the line is being on it - and nothing has
        // been skipped, because a lineage has no admission for its own. The
        // door a Dao house keeps is adoption, and adoption is for outsiders.
        //
        // `standingFrom: 29` rather than the reach of 38: the seven houses
        // stand at 29 to 35 and their word travels further than they do.
        familyHouse: {
            roster: 'a lineage', standingFrom: 29,
            whereTheyLive: 'inside it', onTheRoll: 'by blood'
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
            // A lineage IS the transmission, so the principle arrives with the
            // blood and needs no admission anywhere.
            tradition: { subject: 'debt', label: "the house's own principle, practised at every hour" }
        },
        vouchers: 6,
        expeditions: { supplied: 8, survivalMargin: 0.2 },
        description:
            'A house is a family and this person is in it. Resources on a patriarch\'s scale, a vein under the compound, teachers assigned rather than sought, and a name that opens a door in any province anyone has heard of. It buys none of the ladder, and everyone in the house knows somebody it did not save.'
    },
    {
        key: 'apex_sect_members_child',
        name: 'A child of an apex sect member',
        // Commoner than a placed child and rarer than a house's blood: an apex
        // has more members than a house has heirs, and most of their children
        // stay near rather than being sent anywhere.
        weight: 110,
        // What one enormously wealthy person spends on one child, which is the
        // ONLY thing on this row that transfers outright. A place cannot, a
        // rank cannot, and the shelf below is not theirs either.
        spiritStones: 35_000,
        ground: 'normal',
        // Whatever the parent puts in their hands, which is as good as a book gets.
        roadQuality: 'refined',
        placement: {
            // The same as an established clan's, and that is the point of the
            // row. An apex will not lend its name to a placement - the Pavilion
            // has never once asked a house to take somebody it would have
            // refused - so what carries here is a PERSON's standing and not an
            // institution's, and a person of great standing is owed about what
            // a clan is owed. Everything above this line has to be bought with
            // the word, which is `vouchers` below and is where this row leads
            // the whole table.
            reach: 29,
            // Later than a retainer's child, and the reason is the row's whole
            // subject: a retainer family has a standing arrangement, and this
            // person has a parent who has to decide to act. Nothing happens on
            // a schedule when nothing is inherited.
            atAge: 12,
            entryRankIndex: 0,
            // Below a clan's, because a clan is an establishment and this is one
            // person who is somewhere else most of the time.
            sectBonus: 1.4,
            // Above a clan's, because the one person who does turn up is the
            // strongest protector in the province.
            tollProtection: 0.24,
            stipendPerYear: 900
        },
        // BORN INSIDE THE COMPOUND AND NOT ON THE ROLL, which is this row's
        // whole subject. The parent lives at the seat, so the child grew up
        // there; the roll is an intake, so it does not carry them; and the
        // disciple bar is standing in front of them exactly where it stands in
        // front of somebody who walked up the mountain this morning.
        //
        // `standingFrom: 38` and not the reach of 29. The reach is what the
        // parent's WORD is worth at somebody else's gate, which the row's own
        // comment says is deliberately a clan's; the parent themself stands at
        // an apex.
        familyHouse: {
            roster: 'an intake', standingFrom: 38,
            whereTheyLive: 'inside it', onTheRoll: null
        },
        access: {
            teachers: [
                { subject: 'sword', label: 'their own parent, in the weeks the parent is not elsewhere' }
            ],
            readableManuals: [
                { subject: 'formation', label: 'what the parent brings home and leaves lying about' },
                { subject: 'alchemy', label: "the outer shelves, which a member's child is not stopped from reading" }
            ],
            // NULL, AND THIS IS THE ROW'S SHARPEST FACT. A tradition is
            // "reachable only from inside the house", an apex transmits to its
            // members, and a member's child is not a member. Nothing here is a
            // rule about apexes: it is the ordinary meaning of the field.
            tradition: null
        },
        // The largest figure in the table, and the only axis this row leads on.
        // A word from somebody at that height moves any bar that moves at all.
        vouchers: 8,
        expeditions: { supplied: 6, survivalMargin: 0.2 },
        description:
            'An apex sect is joined rather than born into, so this person holds no place in it: not on the roll, not inside the arrays, and standing in front of the same disciple bar as everyone else. What the parent holds is a fortune, a hand in what the child reads, and a word that moves any door in the province, spent one door at a time.'
    },
    {
        key: 'fostered_on_a_word',
        name: 'Placed at a house on somebody\'s word',
        // The rarest birth in the table. It takes somebody whose word a house
        // cannot refuse deciding to spend it on one specific child, and almost
        // nobody at that height has anybody they want to spend it on.
        weight: 50,
        // A ward's allotment from the house that took them. Real money, and not
        // a family's, because there is no family.
        spiritStones: 22_000,
        ground: 'normal',
        // The house's working book at the rank a ward holds, which is what rank
        // reaches on any shelf. The canon is further up it and they start at
        // the bottom of it like every other intake.
        roadQuality: 'sound',
        placement: {
            // The receiving house's standing and no more. The parent's name is
            // not theirs to use and they do not have it.
            reach: 29,
            // The earliest in the table by a distance, and the entire content of
            // the favour: a house that takes a newborn is a house that raises
            // them, and what the word bought was the years before the body set.
            atAge: 3,
            entryRankIndex: 0,
            // They are actually inside an institution, from the beginning, which
            // nobody else on these three rows is.
            sectBonus: 1.5,
            tollProtection: 0.25,
            stipendPerYear: 500
        },
        // ON THE ROLL BY TAKING, WHICH IS NOT THE SAME AS BY BLOOD and the
        // difference is the interesting part rather than a technicality. The
        // house's roll carries them, its name is the one they answer to, and
        // its ladder is the one in front of them - all of that identical to a
        // child of the line. What is not identical is the LINE: an adopted
        // child holds the name and not the blood, and somewhere in the world
        // there is a record of a birth that the name says nothing about.
        familyHouse: {
            roster: 'an intake', standingFrom: 29,
            whereTheyLive: 'inside it', onTheRoll: 'by taking'
        },
        access: {
            teachers: [
                { subject: 'formation', label: 'the elder the house assigned when they arrived' }
            ],
            readableManuals: [
                { subject: 'sword', label: 'the house library, at the rank a ward holds' },
                { subject: 'body', label: 'the tempering manuals, which are open to everybody inside' }
            ],
            // Present, because they were raised in the hall, and being raised in
            // it is the only way this field is ever reached.
            tradition: { subject: 'debt', label: "the house's own principle, practised in the hall they grew up in" }
        },
        // ZERO, AND IT IS LOWER THAN A SMALL CULTIVATING FAMILY'S. The one word
        // that could have been spent on this person was spent placing them, the
        // arrangement was two people talking and was never written down, and the
        // one who asked will not be named. There is nobody left to ask.
        vouchers: 0,
        expeditions: { supplied: 2, survivalMargin: 0.12 },
        description:
            'Taken as an infant by a house that would have refused them on its own admission ordinal, because somebody it could not afford to disappoint asked it to. The house fed them, taught them and put them on its roll. Who asked was never written down anywhere, is not discussed, and the child was not told.'
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

// WHAT IT BUYS: RESOURCES
//
// Stones are finite and they are spent. That is the whole of why a Dao house
// does not simply win: a thousand-year climb eats a patriarch's fortune
// the same way it eats everyone else's, only later.

/** Spirit stones a year of sealed seclusion costs: food, rent, replacements. */
export const STONES_PER_YEAR_OF_SECLUSION = 60;

/** Stones for a breakthrough pill at full potency, at ordinal zero. */
export const BREAKTHROUGH_PILL_STONES = 500;

/** Stones for a foundation-grade pill at full potency. A different market. */
export const FOUNDATION_PILL_STONES = 1_200;

/** Stones a healer wants for one torn meridian, at ordinal zero. */
export const TREATMENT_STONES = 120;

// WHAT A YEAR OF WORK PAYS
//
// The other half of every price on this page, and it lived in
// `engine/world/seeding.ts` as a private function while three other modules
// wanted it. It is here now because a price is meaningless without the income
// it is quoted against, and because the tier split in
// `buying-and-bartering-pills.ts` is read off exactly this ratio.
//
// A SECOND COPY OF THIS CURVE EXISTS, and it is a different curve.
// `engine/world/origin-odds.ts` has its own `earningsPerYear` at
// `6 * PRICE_GROWTH_PER_ORDINAL^ordinal` - exponential from a base of six,
// deliberately tied to the price growth so that affordability is scale-
// invariant. This one is linear from a base of fifty-four and caps. They
// disagree by a factor of nine at ordinal zero and they are not reconciled
// here, because origin-odds is a reporting sweep whose published figures would
// silently move. It is written down rather than quietly fixed: the world runs
// on THIS one, through `deriveLife`, and that is the one every price should be
// checked against.

/** A working year covers this share of a secluded year's upkeep, at ordinal 0. */
export const EARNINGS_BASE_SHARE = 0.9;
/** How much rank adds to earning power, per rung. */
export const EARNINGS_PER_ORDINAL = 0.35;
/**
 * Ceiling on the rank multiplier.
 */
export const EARNINGS_RANK_CAP = 9;

/**
 * Share of a year the ordinary cultivator spends sealed rather than earning.
 */
export const TYPICAL_SECLUDED_SHARE = 0.45;

/**
 * What a year of work is worth to somebody at this rank.
 */
export function earningsPerYear(ordinal: number): number {
    const scale = Math.min(EARNINGS_RANK_CAP, 1 + Math.max(0, ordinal) * EARNINGS_PER_ORDINAL);
    return STONES_PER_YEAR_OF_SECLUSION * EARNINGS_BASE_SHARE * scale;
}

/**
 * What is actually left over, after keeping themselves alive.
 */
export function netEarningsPerYear(
    ordinal: number,
    secludedShare: number = TYPICAL_SECLUDED_SHARE
): number {
    const sealed = Math.max(0, Math.min(1, secludedShare));
    return (1 - sealed) * earningsPerYear(ordinal) - sealed * STONES_PER_YEAR_OF_SECLUSION;
}

/**
 * How steeply the price of everything climbs with the rank it is for.
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
 */
export function provisionedYears(spiritStones: number): number {
    if (!Number.isFinite(spiritStones) || spiritStones <= 0) return 0;
    return spiritStones / STONES_PER_YEAR_OF_SECLUSION;
}

/**
 * Potency of the best pill a holding can pay for, 0..1.
 */
export function affordablePillPotency(spiritStones: number, priceAtFullPotency: number): number {
    if (!Number.isFinite(spiritStones) || spiritStones <= 0) return 0;
    if (!Number.isFinite(priceAtFullPotency) || priceAtFullPotency <= 0) return 0;
    return Math.max(0, Math.min(1, spiritStones / priceAtFullPotency));
}

// WHAT IT BUYS: ACCESS
//
// Wired into the access set that already exists. There is no second
// mechanism, and there must never be one: an origin that opened
// comprehension by any route other than an AccessSource would be a Dao
// granted without provenance, which understanding.ts refuses by construction.

/**
 * The rows an origin contributes to a `DiscoveryContext`.
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

// WHAT IT BUYS: PLACEMENT

/** A house the family's word reaches, described without recommending it. */
export interface PlacementCandidate {
    /** Institution id. */
    id: string;
    powerOrdinal: number;
    /** Its own admission floor, which placement does not move. */
    admissionOrdinal: number;
}

/**
 * Which of these houses would take this person on the family's word.
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

// WHAT IT BUYS: SURVIVABLE RISK

/**
 * Survival odds for a supplied expedition into somewhere lethal.
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

// THE OPENING POSITION
//
// Everything an origin is worth, in one factual object. This is what a
// character sheet prints. It contains no ordinal, no rank, no progress and no
// judgement, and the shape is the enforcement.

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
