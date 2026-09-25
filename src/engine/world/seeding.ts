/**
 * World seeding: turning the content catalogs into a world that is already running
 * when the player arrives.
 */

import { seedTheDisciplesAWorldOpensWith } from './the-disciples-a-world-opens-with.js';
import { DAYS_PER_YEAR, computeCultivationRate } from '../cultivation/cultivation.js';
import { bestReadable } from '../cultivation/manual-quality.js';
import {
    MAX_ORDINAL,
    clampOrdinal,
    lifespanForOrdinal,
    progressRequiredForOrdinal
} from '../cultivation/realms.js';
import {
    computeBreakthroughOdds,
    FAILURE_PROGRESS_LOSS,
    MAX_PILL_BONUS
} from '../cultivation/breakthrough.js';
import { densityForBand, eraAmbientMultiplier } from '../cultivation/ambient.js';
import {
    AMBIENT_QI_RATE_MULTIPLIER,
    stagnationYearsForOrdinal,
    type AmbientQi
} from '../../schema/cultivation.js';
import { getSpiritRoot } from '../cultivation/spirit-roots.js';
import { rosterByRung, elderRungOf } from '../cultivation/leadership.js';
import { MEMBERS } from '../../data/cultivation/members.js';
import { THE_LINE_AT_OLD_RIVER } from '../../data/cultivation/a-family-that-came-down-from-a-changed-beast.js';
import { worldIdForCatalogPerson } from './a-catalog-person-and-their-world-row.js';
import { rollOf } from '../../data/cultivation/faction-roll.js';
import { whoAHouseWillTake } from '../../data/cultivation/the-three-floors-a-house-admits-at.js';
import { theSexThisRowsProseCommitsTo } from '../../data/cultivation/members.js';
import {
    BREAKTHROUGH_PILL_STONES,
    STONES_PER_YEAR_OF_SECLUSION,
    affordablePillPotency,
    earningsPerYear,
    getOrigin,
    type OriginTierKey
} from '../cultivation/origin.js';
import { drawOriginForSomebodyAlreadyAtOrdinal } from './where-the-seeded-population-was-born.js';
import {
    houseRoadOf,
    roadRefuses,
    drawRootForSomebodyAlreadyInAHouse
} from './what-root-a-seeded-house-member-has.js';
import {
    A_ROLL_A_PLAYER_COULD_KNOW,
    aRollWorthModelling,
    theBandARaisedMemberStandsIn
} from './a-house-raises-its-own.js';
import { purchasedQiPerYear } from '../cultivation/buying-and-bartering-pills.js';
import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import type { InnateAttributes, SpiritRootKey } from '../cultivation/spirit-roots.js';
import { growCompound, type CompoundInput } from './architecture.js';
import type {
    WorldCatalog, CatalogFaction, CatalogRegion, LevyTraffic, VeinWorth, TradeGrade, TradeDevotion
} from './catalog.js';
import {
    linkLocations,
    makeAffinity,
    makeEnvironment,
    makeLocation,
    makeThresholds,
    ordinaryBandFor,
    QI_DENSITY_MAX,
    clampQiDensity,
    qiFraction,
    settleTheSeededPastIntoProvinces,
    whatTheTownsBringIn,
    type LocationRecord
} from './locations.js';
import {
    addGoal, createNpc, setRealm, upsertRelationship, whatACatalogStatesAsTags, type NpcRecord
} from './npc-state.js';
import { andTheOtherEnd } from './a-tie-has-two-ends.js';
import { makeOpportunity, years, type OpportunityWindow } from './opportunities.js';
import { seedTheWanderers } from './the-wanderer-the-catalog-names-is-somebody.js';
import { seedTheRogues } from './the-rogues-a-world-opens-with.js';
import { dayOfYear, makeFact, appendFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { seedSectLibraries, grantBooksToMembers } from './manuals.js';
import { seedArtifacts, seedTheCraftThatAreObjects } from './artifact-placement.js';
import { seedComprehensionMaterials } from './single-use-dao-comprehension-materials.js';
import { seedPlacesThatTeachADao } from './how-a-cultivator-comes-by-a-road.js';
import { seedPillStock } from './where-the-pills-actually-are.js';
import { seedWhatSealedPocketsStillGrow } from './what-a-sealed-pocket-still-grows.js';
import { seedHouseWards } from './the-ward-a-house-raised-over-its-own-ground.js';
import { seedTreasuries } from './what-a-house-keeps-in-its-treasury.js';
import { lineagesFromTheKinTheWorldWrote } from './a-family-is-the-people-you-are-kin-to.js';
import { CHILD_STANDING, PARENT_STANDING, rosterOf } from './the-ties-an-ordinary-life-produces.js';
import { uniformsForEverybodyAlreadyOnARoll } from './a-recruit-is-given-their-lamp-at-the-house.js';
import {
    applyTheLoans,
    whatEachHouseHasOutOnLoan,
    whatPeopleHaveLentToTheirJuniors,
    whyTheyHaveIt
} from './what-is-out-on-loan-and-who-lent-it.js';
import {
    whatEachHouseGivesAsAPairOfJade,
    whatEachHouseHasGivenAway,
    whyItIsTheirs
} from './a-house-bestows-a-thing-on-somebody-who-earned-it.js';
import { transferPossession } from './possessions.js';
import { setWhatEverybodyIsAt } from './what-somebody-is-at-when-you-walk-up.js';
import { seedStructuralRepairMedicine } from './who-holds-the-structural-repair-medicine.js';
import {
    seedTheFamiliesStandingInAPlace,
    type FamiliesSeeded
} from './the-families-a-world-opens-holding.js';
import {
    seedTheMarriagesStandingInAPlace
} from './the-marriages-a-world-opens-holding.js';
import { seedTheKinTheCatalogStates } from './the-kin-a-world-opens-holding.js';
import { AT_ARMS_LENGTH, howWarmlyTheyStartTowardTheirParent } from './what-a-house-answers-to.js';
import {
    seedTheWrongsStillOpen,
    type WrongsSeeded
} from './the-wrongs-a-world-opens-holding.js';
import {
    indexById,
    createWorld,
    makeFaction,
    schedule,
    theWorldForgetsTheMortalDead,
    type FactionRecord,
    type ScheduledEffect,
    type WorldState
} from './world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// OPTIONS
// ─────────────────────────────────────────────────────────────────────────

export interface SeedWorldOptions {
    seed: string;
    catalog: WorldCatalog;
    /** Year the present age begins. */
    presentYear?: number;
    /**
     * Target living NPC count. Hundreds, not tens of thousands: a province
     * holds this many people worth having a record for, and the cost of a
     * century of world time is linear in it.
     */
    population?: number;
    /**
     * The roll an ordinary house is worth modelling, before its own facts scale
     * it. Defaults to {@link A_ROLL_A_PLAYER_COULD_KNOW}; see
     * `a-house-raises-its-own.ts` for what it is and where the figure came from.
     *
     * A knob on how much world to model, exactly as `population` is - and the
     * one that makes the rank-and-file pass MEASURABLE, because zero here seeds
     * the same world without it and both arms then run in one command. Worlds
     * seeded at two different values are two different worlds and their numbers
     * do not compare; that is true of `population` too.
     */
    rollWorthModelling?: number;
    /** Qi density of the present age. */
    qiDensity?: number;
    priorAges?: { ages?: number; yearsPerAge?: number; factionsPerAge?: number };
}

export interface SeedStats {
    regions: number;
    locations: number;
    factions: number;
    /**
     * NPC ROWS the world opens with, living and not.
     *
     * NOT the living population, and the difference is small and real: the line
     * that came down is seeded with its dead in it - ancestors whose bodies are
     * gone and whose names a house still keeps - and they are rows like anybody
     * else. Three of them in a three-hundred-person world.
     *
     * Both figures are reported because conflating them is a mistake somebody
     * has already made. A caller reading this as "people alive here" is off by
     * the ancestors, and `populationTarget` deliberately counts them: a world
     * that replaced its dead back to a figure excluding them would quietly
     * delete them.
     */
    npcs: number;
    /** Of those rows, the ones actually alive. See {@link SeedStats.npcs}. */
    living: number;
    lineages: number;
    opportunities: number;
    scheduledEffects: number;
    priorFacts: number;
    /** Households the world opens holding. See `the-families-a-world-opens-holding.ts`. */
    families: FamiliesSeeded;
    /** Wrongs still open on day one. See `the-wrongs-a-world-opens-holding.ts`. */
    wrongs: WrongsSeeded;
    /** Living NPCs by realm tier, lowest first. The shape of the population. */
    realmHistogram: number[];
}

export interface SeededWorld {
    state: WorldState;
    stats: SeedStats;
}

const DEFAULTS = {
    presentYear: 1000,
    population: 400,
    qiDensity: 0.34
};

/** Fraction of the population that belongs to a faction at all. */
const AFFILIATION_RATE = 0.45;
/** Youngest and oldest a seeded adult may be. */
const MIN_AGE = 16;
const MAX_AGE = 120;

/**
 * Ceiling on a named figure's age. They are people the world knows, not
 * ancients under a mountain - the sealed ones are a separate catalog.
 */
const MAX_NAMED_AGE = 700;
/** Rough years a rank costs, for giving a named figure a plausible age. */
const NAMED_YEARS_PER_ORDINAL = 9;

/**
 * How much of a rung's span somebody the world stands up has already spent.
 *
 * Old enough to have got where they are, young enough to still be here.
 */
const YEARS_A_RUNG_LEAVES_YOU = 0.9;

/**
 * The oldest a drawn life reaches, which is a rung's span rather than `MAX_AGE`.
 *
 * `MAX_AGE` is 120 and the ladder gives a hundred years at the bottom, where
 * this pool is created. Drawing past the span is what stood people up dead.
 *
 * ── AND IT IS THE WHOLE SPAN, NOT THE CAREER PART OF IT ─────────────────
 *
 * `YEARS_A_RUNG_LEAVES_YOU` exists so a figure the catalog names is not stood
 * up on their deathbed - somebody the world is about to ask things of needs
 * years left to do them in. Nobody asks anything of this pool. They are the
 * province: farmers, stallholders, somebody's grandmother, and a village with
 * no old people in it is a stranger world than one whose eldest die next year.
 *
 * Measured: cutting them at nine tenths instead took the top decade off every
 * life in the province and the households thickened, because the eighteen-year
 * bar had a smaller pool of people old enough to be anybody's parent - biggest
 * household across six worlds went from 12 to 15. The bug was drawing PAST the
 * span; it was never the last ten years of it.
 */
const OLDEST_A_DRAWN_LIFE_REACHES =
    Math.min(MAX_AGE, Math.floor(lifespanForOrdinal(0)) - 1);

/**
 * An age that is plausible for a rung AND that the rung can actually carry.
 *
 * ── THE SAME EXPRESSION, IN THE ONE PLACE IT LIVES ───────────────────────
 *
 * `MIN_AGE + ordinal * NAMED_YEARS_PER_ORDINAL` grows with the rung, and
 * `lifespanForOrdinal` does NOT - it is flat at a hundred years across the
 * bottom of the ladder, where a rung costs more years than a life is long. So
 * the expression outruns the span, and somebody is stood up already dead.
 *
 * `a-house-raises-its-own` worked that out and capped its own draw. Nothing
 * capped `seedNamedFigures`, which uses the same expression: measured, 58 of
 * 207 catalogued members were given an age their rung cannot carry - ordinal
 * 12 drawing 124 to 164 years against a span of 100. A fix that landed on one
 * row and not on its siblings, which is the shape this repo keeps finding.
 *
 * MONOTONIC, AND THAT IS LOAD-BEARING. All three terms are non-decreasing in
 * the ordinal, so the smallest of them is too - which is what keeps a senior
 * of a stated kin tie older than their junior, the invariant
 * `the-kin-a-world-opens-holding` pins. A cap that was not monotonic inverted
 * a catalogued pair the first time this was tried.
 */
function anAgeTheRungCanCarry(ordinal: number, spread: number): number {
    return Math.max(
        MIN_AGE + 1,
        Math.min(
            MAX_NAMED_AGE,
            Math.floor(lifespanForOrdinal(ordinal) * YEARS_A_RUNG_LEAVES_YOU),
            MIN_AGE + Math.round(ordinal * NAMED_YEARS_PER_ORDINAL) + spread
        )
    );
}

/**
 * Lowest declared power at which a faction gets an instance it did not derive.
 *
 * Below this the ordinary population reaches the claim on its own, and seeding
 * one would put a figure in the world the arithmetic already produced.
 */
const APEX_SEED_FLOOR = 17;

/**
 * What a year of work is worth to somebody at this rank.
 */
export { earningsPerYear } from '../cultivation/origin.js';

/**
 * What a catalog figure is holding.
 */
function holdingsFor(ordinal: number, rankIndex: number, rng: CultivationRNG): number {
    const perYear = earningsPerYear(clampOrdinal(ordinal));
    const standing = 1 + Math.max(0, rankIndex) * 0.4;
    return Math.round(perYear * rng.int(1, 8) * standing);
}

/** Share of their realm's lifespan an apex figure has already spent. */
const APEX_AGE_FRACTION = 0.25;

// ─────────────────────────────────────────────────────────────────────────
// THE SEED
// ─────────────────────────────────────────────────────────────────────────

/**
 * "the The Jade Gorge vein".
 */
function withoutArticle(name: string): string {
    return name.replace(/^[Tt]he\s+/, '');
}

export function seedWorld(opts: SeedWorldOptions): SeededWorld {
    const presentYear = opts.presentYear ?? DEFAULTS.presentYear;
    const population = Math.max(0, opts.population ?? DEFAULTS.population);
    const rollWorthModelling = Math.max(0, opts.rollWorthModelling ?? A_ROLL_A_PLAYER_COULD_KNOW);
    const qiDensity = opts.qiDensity ?? DEFAULTS.qiDensity;
    const presentDay = dayOfYear(presentYear);

    // Several prior ages first, so ruins and scars exist before anything is
    // placed on top of them and every remnant points at a dated event.
    const state = createWorld({
        seed: opts.seed,
        presentYear,
        qiDensity,
        regionCount: 0,
        priorAges: opts.priorAges
    });
    const priorFacts = state.history.facts.length;

    const regionLocations = seedRegions(state, opts.catalog, presentDay);
    // And now the prior ages have somewhere to be. `createWorld` was asked for
    // no provinces of its own, so the ruins and scars it minted came back in no
    // province at all; the catalog's are the map this world actually uses, and
    // this is the first line at which they exist. See
    // `settleTheSeededPastIntoProvinces`.
    state.locations = settleTheSeededPastIntoProvinces(state.locations, opts.seed);
    const factions = seedFactions(state, opts.catalog, regionLocations, presentDay);
    const npcs = seedPopulation(
        state, opts.catalog, factions, population, presentDay, rollWorthModelling);
    // AFTER the population, so every procedural person draws exactly what they
    // drew before this existed, and BEFORE the lineages, so the family the
    // dilution ladder is read off is on a roll like anybody else's. They are
    // counted in the target because they are people: a world that replaces its
    // dead back to a figure that excluded them would quietly delete them.
    const line = seedTheLineThatCameDown(state, opts.catalog, presentDay);
    const everybody = [...npcs, ...line];
    state.populationTarget = everybody.length;
    // And the families the RELATIONSHIP layer has to be able to see, which is
    // not the same claim the lineage record makes and must not be read off it -
    // see `the-families-a-world-opens-holding.ts` for the measurement. Until
    // this ran, a fresh world held 133 ties, all of them `ally` or `rival`, and
    // the six kinds `whoTheyCarryFor` reads were all at zero: nobody on turn one
    // had a brother for anything to be done to.
    // Marriages FIRST, because a child gets a second parent off
    // `bindNewbornToHousehold` reading a spouse tie - so the households have to
    // exist before the generation below them is bound. Only cultivators marry
    // here; see `the-marriages-a-world-opens-holding.ts` for why a mortal
    // household is below the resolution this engine works at.
    seedTheMarriagesStandingInAPlace(state, presentDay);
    // And the blood the catalog states, BEFORE the families: a stated cousin has
    // to be standing there for `nothingElseBetween` to decline to make her a
    // drawn daughter. See `the-kin-a-world-opens-holding.ts` for why stating
    // these takes no seat away from a life that opens as somebody's child.
    seedTheKinTheCatalogStates(state);
    const families = seedTheFamiliesStandingInAPlace(state, presentDay);
    // AND THE FAMILIES THE LINEAGE RECORD HOLDS, read off that kinship rather
    // than off shared surnames. Last of the three, because a family is the
    // people the marriages, the stated kin and the households joined - see
    // `a-family-is-the-people-you-are-kin-to.ts` for what the surname chain was
    // doing instead.
    const lineages = lineagesFromTheKinTheWorldWrote(state);
    state.lineages.push(...lineages);
    // And the wrongs, AFTER the families, because a wrong nobody carries for is
    // a wrong nobody can be told about.
    const wrongs = seedTheWrongsStillOpen(state, presentDay);
    const opportunities = seedOpportunities(state, opts.catalog, regionLocations, presentDay);
    const effects = seedGrantSchedule(state, opts.catalog, presentDay);

    // Books last, because who holds what depends on everything above it: the
    // factions have to be seated before their libraries have anywhere to sit, and
    // the people have to be placed and ranked before the shelf can be gated by
    // rank.
    state.objects.push(...seedSectLibraries(state));
    // And the things that are not books. `artifacts.ts` has been a complete
    // table of ObjectRecords since it was written and the seeder never put one
    // of them into the world, so the immortal weapon a house's whole standing
    // rests on existed only in a catalog nothing read. See `goods.ts`.
    state.objects.push(...seedArtifacts(state));
    // And the hulls, which is the same defect one catalog over. See
    // `seedTheCraftThatAreObjects`: no world has ever contained a spirit boat.
    state.objects.push(...seedTheCraftThatAreObjects(state));
    state.objects.push(...seedComprehensionMaterials(state));
    // And the ground that teaches a road, which is the other half of the same
    // problem: a material is spent and gone, a terrace is not, and the gate in
    // `breakthrough.ts` asks for comprehension the world had no way at all to
    // supply. Seeded AFTER the population so it cannot perturb where anybody was
    // born, and after the materials so their ruin draw is unchanged - both of those
    // are deliberate, and both keep every existing seeded world identical up to
    // this line. See `how-a-cultivator-comes-by-a-road.ts`.
    state.locations.push(...seedPlacesThatTeachADao(state));
    // And the medicine, which the same catalog-nothing-read defect applied to:
    // a world with no pills in it is a world where the crossing pill is a price
    // in a document. Two shapes, one threshold - see
    // `where-the-pills-actually-are.ts`.
    state.objects.push(...seedPillStock(state));
    // And the raw stuff the top of that ladder is made of, which is on this
    // side and is sealed. The immortal and chaos formulas name materials no
    // house in the world can stock and no forage below the Lid reaches, so the
    // bill was unfillable for want of a place to go and get it rather than by
    // any rule. Seeded AFTER the dao grounds so the sealed pockets they mint
    // are in the pass, and after the medicine so every stream above this line
    // draws exactly what it drew before. See
    // `what-a-sealed-pocket-still-grows.ts`.
    state.objects.push(...seedWhatSealedPocketsStillGrow(state));
    // What each house has standing over its own compound. Raised by whoever the
    // house could field out of whatever warding it teaches, so it is the LOWER
    // of the art and the builder and not a property of the house - see
    // `the-ward-a-house-raised-over-its-own-ground.ts`. Without this every seat
    // in the world is bare masonry and a body at the bottom of the ladder can
    // walk into the compound of a body at the top.
    state.objects.push(...seedHouseWards(state));

    // AND WHAT EACH HOUSE HAS IN ITS TREASURY, which was a balance and nothing
    // else. A house held stones and no THINGS, so lending a disciple a furnace,
    // bestowing something on somebody who earned it, and being robbed of
    // anything that mattered all had nothing to operate on. Counted below,
    // tracked above, and both off the standing the ward is rated on.
    //
    // NO SECOND LIST. What a house holds is `state.objects` filtered by
    // `ownerId`, filtered where it is asked. A stored list of ids on the
    // faction would be a second copy of a fact the one possessions table
    // already owns, and the copy is what goes stale the first time something is
    // lent, sold or taken. See `what-a-house-keeps-in-its-treasury.ts`.
    const treasury = seedTreasuries(state);
    state.objects.push(...treasury);
    // And the robes of everybody already on a roll, who were entered on it
    // before the world began. See `a-recruit-is-given-their-lamp-at-the-house.ts`.
    state.objects.push(...uniformsForEverybodyAlreadyOnARoll(state));

    setWhatEverybodyIsAt(state, presentDay);
    // And the medicine that mends a cracked cultivator, which is placed rather
    // than scattered: exactly the authored holdings, on exactly those bodies,
    // and nowhere else. See `who-holds-the-structural-repair-medicine.ts`.
    state.objects.push(...seedStructuralRepairMedicine(state));
    const npcAt = new Map(state.npcs.map((n, i) => [n.id, i]));
    for (const grant of grantBooksToMembers(state)) {
        const at = npcAt.get(grant.npcId);
        if (at === undefined) continue;
        const npc = state.npcs[at];
        state.npcs[at] = {
            ...npc,
            cultivation: {
                ...npc.cultivation,
                techniqueIds: [...grant.techniqueIds, ...grant.artIds]
            },
            tags: grant.chosen && !npc.tags.includes('chosen') ? [...npc.tags, 'chosen'] : npc.tags
        };
    }
    // The master-disciple bonds a world opens with, and an elder's jade for one,
    // after the grant marks who is `chosen`. See `the-disciples-a-world-opens-with.ts`.
    seedTheDisciplesAWorldOpensWith(state);

    // PLACED AFTER THE GRANT LOOP DELIBERATELY. The pass above is what
    // writes the `chosen` tag, and a house gives its good thing to the
    // person it has already marked. Run before it, the bestowal found
    // nobody marked in the entire world and gave away nothing - measured at
    // zero personally-owned objects on every seed.
    // AND WHO IS ACTUALLY HOLDING WHAT, WHICH IS THREE SEPARATE ACTS.
    //
    // Order matters and each pass depends on the one above it.
    //
    //   1. A house GIVES a thing to the person it already marked. Ownership
    //      moves, the house is out of the field, and the person now owns
    //      something. Measured before this existed: of 1452 objects in a
    //      seeded world, the number owned by a PERSON was zero, so there was
    //      no such thing as anybody's own treasure anywhere in the world.
    //   2. A house LENDS out of its stores. Possession moves and ownership
    //      does not: it is owed back to the house.
    //   3. A PERSON lends their own thing DOWN, to a junior they hold a tie
    //      to or somebody standing lower on the same roll. This is the one the
    //      design owner asked for, and it can only run after step 1, because
    //      before step 1 nobody had a treasure to hand anybody.
    //
    // All three write through `transferPossession` so the provenance chain
    // says which act it was. That is not decoration: `whoseThisIs` reads the
    // chain, and the first cut of the lending pass moved things by object
    // spread, which left 199 of 199 carried objects reading `unaccounted_for`
    // and made `lent_by_their_house` unreachable in a fresh world.
    {
        const today = Math.floor(state.currentDay);

        // OUT OF ITS OWN STORES, exactly as with lending. Scanning every
        // object in the world reached into the catalog and gave away a relic
        // the catalog had placed on purpose - the same defect
        // `objects-in-hands.test.ts` caught on the lending side, and it
        // caught this one too. A house gives what is in its stores.
        // A HOUSE THAT GIVES A PAIR OF JADE gives that and not a thing out of its
        // stores: decided first, so the one gift a house makes is one gift.
        const jadeGiven = whatEachHouseGivesAsAPairOfJade(state, treasury, today);
        const givenJade = new Set(jadeGiven.map(gift => gift.toNpcId));
        const given = whatEachHouseHasGivenAway({ ...state, objects: treasury })
            .filter(gift => !givenJade.has(gift.toNpcId));
        const alreadyGone = new Set(given.map(gift => gift.objectId));
        const givenBy = new Map(given.map(gift => [gift.objectId, gift]));
        if (givenBy.size > 0) {
            state.objects = state.objects.map(object => {
                const gift = givenBy.get(object.id);
                return gift === undefined ? object : transferPossession(object, {
                    onDay: today,
                    toHolderId: gift.toNpcId,
                    toHolderName: gift.toName,
                    how: 'awarded',
                    // Ownership moves, which is the whole difference between
                    // this and the loan below.
                    transfersOwnership: true,
                    source: gift.fromName,
                    note: whyItIsTheirs(gift)
                });
            });
        }
        // The pairs of jade decided above: made, not moved, and kept in twin.
        for (const gift of jadeGiven) state.objects.push(...gift.halves);

        // Both loans are decided against the state as it stands after the
        // giving, and applied together, so one object can never be lent twice.
        const lentOut = [
            // Minus whatever was just given away: `treasury` is the array as
            // it was minted, so a bestowed thing still reads as unheld in it
            // and would otherwise be lent out from under its new owner.
            ...whatEachHouseHasOutOnLoan({
                ...state, objects: treasury.filter(thing => !alreadyGone.has(thing.id))
            }),
            ...whatPeopleHaveLentToTheirJuniors(state)
        ];
        state.objects = applyTheLoans(state.objects, lentOut, (object, loan) =>
            transferPossession(object, {
                onDay: today,
                toHolderId: loan.toNpcId,
                toHolderName: loan.toName,
                how: 'lent',
                source: loan.fromName,
                note: whyTheyHaveIt(loan)
            }));
    }

    // AND WHAT EVERY ONE OF THEM IS DOING. Last, because it reads where people
    // ended up standing and what they ended up holding. Before this, every
    // person in the world was at nothing - `occupation: 'unknown'`, no goals -
    // so ten people on a house's own ground, from an outer disciple to the
    // Grand Sword Elder, all read the same way. See
    // `what-somebody-is-at-when-you-walk-up.ts`.

    // AND THE WORLD DOES NOT OPEN HOLDING A DEAD FARMER.
    //
    // The same sweep the yearly pass runs, run once here, so that "this world
    // holds no mortal who died" is true from day zero rather than true from the
    // first year anybody simulates. On an unperturbed seed it takes nothing:
    // the only deaths a fresh world contains are the wrongs, and those now fall
    // on people it keeps.
    theWorldForgetsTheMortalDead(state);

    return {
        state,
        stats: {
            regions: opts.catalog.regions.length,
            locations: state.locations.length,
            factions: factions.length,
            npcs: everybody.length,
            living: livingPopulation(state),
            lineages: lineages.length,
            opportunities: opportunities.length,
            scheduledEffects: effects.length,
            priorFacts,
            families,
            wrongs,
            realmHistogram: histogram(state)
        }
    };
}

// ─────────────────────────────────────────────────────────────────────────
// REGIONS AND PLACES
// ─────────────────────────────────────────────────────────────────────────

function regionLocationId(regionId: string): string {
    return `loc-${regionId}`;
}

function placeLocationId(regionId: string, placeName: string): string {
    const slug = placeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `loc-${regionId}-${slug || 'place'}`;
}

/**
 * One location per region, one per named place inside it, and one vein per region
 * that has one.
 */
function seedRegions(
    state: WorldState,
    catalog: WorldCatalog,
    presentDay: number
): Map<string, LocationRecord> {
    const byRegion = new Map<string, LocationRecord>();

    for (const region of catalog.regions) {
        const ceiling = region.localCeilingOrdinal;
        const location = makeLocation({
            id: regionLocationId(region.id),
            name: region.name,
            kind: 'region',
            description: region.summary,
            ambient: region.ambient,
            qiDensity: region.qiDensity,
            // A region is walked into freely and survived by anyone from here;
            // what it gates is operating in it and holding it.
            thresholds: makeThresholds(0, 0, Math.max(0, Math.floor(ceiling / 3)), ceiling),
            hazards: region.hazards.slice(),
            environment: makeEnvironment({
                spiritualDensity: qiFraction(region.qiDensity),
                danger: Math.min(1, region.hazards.length * 0.15),
                resources: region.exports.slice(),
                climate: 'temperate',
                politicalControl: politicalControlOf(region),
                specialRules: region.specialRules.slice(),
                knownSecrets: [],
                historicalScars: region.scars.slice()
            }),
            discovered: true,
            tags: region.home ? ['home', 'region'] : ['region'],
            data: {
                catalogRegionId: region.id,
                localCeilingOrdinal: ceiling,
                ambientRateMultiplier: region.ambientRateMultiplier,
                politics: region.politics
            }
        });
        location.origin.fromDay = presentDay - years(2000);
        state.locations.push(location);
        byRegion.set(region.id, location);

        for (const place of region.places) {
            state.locations.push(makeLocation({
                id: placeLocationId(region.id, place.name),
                name: place.name,
                kind: placeKindFor(place.kind),
                parentId: location.id,
                description: place.note,
                ambient: place.ambient,
                qiDensity: region.qiDensity,
                thresholds: makeThresholds(0, 0, 0, Math.max(0, ceiling - 4)),
                hazards: region.hazards.slice(),
                environment: makeEnvironment({
                    // THE PLACE'S OWN GROUND, not its province's average.
                    spiritualDensity: densityForBand(place.ambient),
                    danger: place.kind === 'site' ? 0.5 : 0.1,
                    resources: region.exports.slice(0, 2),
                    politicalControl: politicalControlOf(region),
                    historicalScars: []
                }),
                // WHO ADMINISTERS THE TOWN, which was null on every settlement
                // in the world while the catalog had been answering it for two
                // provinces since the political layer was written. `catalog.ts`
                // joins the prefecture register and the place's own row; this
                // stamps whichever answered. Null is both "the register names
                // nobody" and "nothing says", and `whoHoldsTheGround` is what
                // tells those two apart - the column cannot.
                controllingFactionId: place.heldByFactionId ?? null,
                tags: ['place', place.kind],
                data: {
                    catalogRegionId: region.id,
                    // Read by the demography when it draws a birthplace.
                    populationWeight: PLACE_POPULATION_WEIGHT[place.kind] ?? 1
                }
            }));
        }

        // The vein. It is the reason the region has politics at all, and it is
        // the thing factions take from each other.
        if (region.veinStatus) {
            state.locations.push(makeLocation({
                id: `${regionLocationId(region.id)}-vein`,
                name: `the ${withoutArticle(region.name)} vein`,
                kind: 'vein',
                parentId: location.id,
                description: region.veinStatus,
                ambient: region.qiDensity > 60 ? 'dense' : region.ambient,
                qiDensity: clampQiDensity(region.qiDensity + 30),
                thresholds: makeThresholds(0, 0, Math.max(0, ceiling - 6), ceiling),
                hazards: ['formation'],
                environment: makeEnvironment({
                    spiritualDensity: qiFraction(region.qiDensity + 30),
                    danger: 0.4,
                    resources: ['qi'],
                    politicalControl: politicalControlOf(region)
                }),
                affinities: [makeAffinity('formation', 1.3, 2, 'Somebody has worked this ground.')],
                tags: ['vein', 'contested'],
                data: { catalogRegionId: region.id }
            }));
        }
    }

    // Roads between regions, in whatever the content says the travel cost is.
    for (const region of catalog.regions) {
        const from = byRegion.get(region.id);
        if (!from) continue;
        for (const conn of region.connections) {
            const to = byRegion.get(conn.otherRegionId);
            if (!to) continue;
            linkLocations(from, to, 'road', Math.max(1, conn.travelDays));
        }
    }

    // AND ROADS BETWEEN PLACES OF ONE REGION
    const byLocationId = new Map(state.locations.map(l => [l.id, l]));
    for (const region of catalog.regions) {
        // Resolved per province rather than in one global table, because a
        // place road is a road inside ONE province. Same-province-only is
        // what keeps this from becoming a second opinion about a distance the
        // province connections already price: the two layers' domains are
        // disjoint, and a catalog test asserts it.
        const here = new Map<string, LocationRecord>();
        for (const place of region.places) {
            const record = byLocationId.get(placeLocationId(region.id, place.name));
            if (record) here.set(place.name.trim().toLowerCase(), record);
        }
        for (const place of region.places) {
            const from = here.get(place.name.trim().toLowerCase());
            if (!from) continue;
            // `?? []` because a hand-built catalog - a test, a probe, a
            // scripted world - has no `connections` on its places at all, and
            // a place with no neighbours is the ordinary case rather than an
            // error. Found by 112 seeder crashes across `tests/engine/world`.
            for (const conn of place.connections ?? []) {
                const to = here.get(conn.otherPlaceName.trim().toLowerCase());
                if (!to) continue;
                linkLocations(from, to, conn.kind, Math.max(1, conn.travelDays));
            }
        }
    }

    return byRegion;
}

/**
 * Relative headcount by settlement kind, for weighting births.
 */
const PLACE_POPULATION_WEIGHT: Readonly<Record<string, number>> = {
    hamlet: 3,
    village: 10,
    market_town: 28,
    sect_town: 22,
    city: 60,
    waystation: 1,
    site: 0
};

/**
 * A house's ground holds its household, not a town.
 */
const SECT_GROUND_POPULATION_WEIGHT = 1;

function placeKindFor(kind: string): LocationRecord['kind'] {
    switch (kind) {
        case 'city':
        case 'market_town':
        case 'sect_town':
        case 'village':
        case 'hamlet':
        case 'waystation':
            return 'settlement';
        case 'site':
        default:
            return 'wilds';
    }
}

function politicalControlOf(region: CatalogRegion): string {
    switch (region.politics) {
        case 'single_hegemon': return 'one power, and it is not shy about it';
        case 'no_authority': return 'nobody, which everybody has noticed';
        default: return 'several sects, none of them decisively';
    }
}

// ─────────────────────────────────────────────────────────────────────────
// FACTIONS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Factions as entities with a seat, a treasury, rivalries and a vein.
 */
/** Stable id for a faction's ground, so a caller can go from one to the other. */
export function sectGroundId(factionId: string): string {
    return `loc-${factionId}-ground`;
}

/**
 * How steeply held ground improves with the standing that holds it.
 */
const SECT_GROUND_CURVE = 1.6;

/**
 * What ground a sect of this standing holds, 1..100.
 */
export function sectGroundDensity(
    powerOrdinal: number,
    apexPowerOrdinal: number,
    regionDensity: number
): number {
    const apex = Math.max(1, apexPowerOrdinal);
    const reach = Math.max(0, Math.min(1, powerOrdinal / apex));
    const held = QI_DENSITY_MAX * Math.pow(reach, SECT_GROUND_CURVE);
    return clampQiDensity(Math.max(regionDensity, held));
}

/**
 * The ground a sect actually holds.
 */
function seedSectGround(
    state: WorldState,
    cf: CatalogFaction,
    region: LocationRecord,
    apexPowerOrdinal: number,
    presentDay: number
): LocationRecord {
    const density = sectGroundDensity(cf.powerOrdinal, apexPowerOrdinal, region.qiDensity);

    const ground = makeLocation({
        id: sectGroundId(cf.id),
        name: `${cf.name} grounds`,
        kind: 'sect_seat',
        parentId: region.id,
        description:
            `The ground the ${cf.name} holds: gate, forecourt, halls, and whatever vein `
            + 'the compound was built on top of.',
        ambient: ordinaryBandFor(density) === 'thin' ? region.ambient : ordinaryBandFor(density),
        qiDensity: density,
        // Anyone may walk to a gate and anyone may survive standing at it. What
        // the gate gates is working there, and that bar is the admission bar.
        thresholds: makeThresholds(0, 0, cf.admissionOrdinal, cf.powerOrdinal),
        hazards: cf.holdsVein ? ['formation'] : [],
        // A compound that still runs its own formations answers to somebody who
        // can read them. Read off `formationIntegrity`, which is already the
        // column for how much of the inherited compound still works.
        affinities: cf.formationIntegrity >= 0.5
            ? [makeAffinity(
                'formation',
                1 + cf.formationIntegrity * 0.3,
                2,
                'The compound\'s own arrays are still running and answer to somebody who can read them.'
            )]
            : [],
        environment: makeEnvironment({
            spiritualDensity: qiFraction(density),
            danger: 0.15,
            resources: ['qi', 'teaching', 'medicine'],
            politicalControl: cf.name,
            specialRules: cf.recruits
                ? [`admits at ${cf.admissionOrdinal}`]
                : ['takes no applicants'],
            historicalScars: []
        }),
        controllingFactionId: cf.id,
        // A name you have to be given. Joining gives it; being told gives it;
        // asking in the region gives it. Nothing else does, which is the gate
        // working rather than the gate being missing.
        discovered: false,
        tags: ['sect_ground', cf.recruits ? 'recruits' : 'closed'],
        data: {
            factionId: cf.id,
            admissionOrdinal: cf.admissionOrdinal,
            populationWeight: SECT_GROUND_POPULATION_WEIGHT,
            catalogRegionId: region.data.catalogRegionId as string ?? ''
        }
    });
    ground.origin.fromDay = presentDay - years(300);
    state.locations.push(ground);
    // The road from the province to the gate. Ordinary link, ordinary travel.
    linkLocations(region, ground, 'road', 2);

    // And the inside of it. A sect seat with no interior is a name with two roads
    // out of it: measured before this existed, the Azure Cloud Pavilion - the house
    // with a newly ascended immortal attached - was exactly that, and nesting in a
    // whole seeded world bottomed out at depth 1. `growCompound` is pure and
    // deterministic off the world seed, so calling it here and calling it the first
    // time somebody walks through the gate produce the same compound; it is called
    // here because seeding 32 of them costs less than the branch that would decide
    // not to.
    const compound = growCompound(ground, compoundInputFor(cf), {
        seed: state.seed,
        presentDay
    });
    for (const room of compound.locations) state.locations.push(room);

    return ground;
}

/**
 * What a house can put on the ground, as a share of the ladder, 0..1.
 *
 * The one derivation the old `production` scalar was standing in for, and the
 * only one the catalog actually authors: `ProductionTier.reliableOrdinal` is
 * the rung a house turns out from its own intake, and everything material here
 * is done by people at a rung. Everything that wanted "how much can this house
 * make for itself" reads it; nothing states a house's material output, so
 * nothing pretends to.
 *
 * Named and shared because two places scale money by it - the purse a house is
 * seeded with, and what it takes off its ground each year - and a second copy
 * of the arithmetic would drift.
 */
export function whatItCanPutOnTheGround(reliableOrdinal: number): number {
    if (!Number.isFinite(reliableOrdinal)) return 0;
    return Math.max(0, Math.min(1, reliableOrdinal / MAX_ORDINAL));
}

/**
 * What one place a house collects at takes in a year, in spirit stones.
 *
 * THE SCALE IS ANCHORED TO TWO PRICES THE REPO ALREADY AUTHORS, not invented.
 *
 *   `price-gate-registration`  300 cash a year a head, "compulsory in nine
 *                              cities, and the House's real income" - three
 *                              stones a head a year.
 *   `price-port-rate`          a fortieth of what crosses the rail, "light
 *                              because the traffic is where the profit is and
 *                              squeezing the traffic moves it".
 *
 * So `a city gate` at 1,000 stones is 333 people a year paying the Jade
 * Register's own published rate, or a fortieth of forty thousand stones of
 * cargo over a weigh rail. Both read as an ordinary year at one post, which is
 * what makes these numbers checkable rather than chosen.
 *
 * A ROCK GIVES MORE, AND THE ORDERING IS PER POST AGAINST PER ORDINARY VEIN.
 * The vein term is 5,000 stones scaled by what the house can field, so the
 * biggest one post can be is half of the smallest ordinary vein. A house with
 * nine city gates does out-earn one vein, which is the point: it has nine of
 * them. The qualifier arrived with `HOW_MANY_ORDINARY_VEINS`: a thin seam is a
 * fifth of a working vein by authored intent, and a toll over a whole province
 * out-earning the least valuable grant in that province is correct.
 *
 * And a levy does NOT scale by what a house can put on the ground, which every
 * other term here does. What goes past a gate is what goes past a gate; the
 * rung decides whether the house can hold the gate at all, not how many people
 * walk through it. Scaling it would have made this a recoloured copy of the
 * vein term rather than a second way to eat.
 */
export const WHAT_ONE_POST_TAKES_IN_A_YEAR: Readonly<Record<LevyTraffic, number>> = {
    'a trickle': 120,
    'a road': 400,
    'a city gate': 1_000,
    'a province': 2_500
};

/**
 * What a house's levy brings in per year, in spirit stones.
 *
 * One copy, called by the purse a house is seeded with and by the yearly
 * economy, so the two cannot drift.
 */
export function whatALevyBringsIn(levy: CatalogFaction['levy']): number {
    if (!levy) return 0;
    return Math.round(levy.posts * WHAT_ONE_POST_TAKES_IN_A_YEAR[levy.traffic]);
}

/**
 * How many ordinary veins' worth of rock each authored worth is.
 *
 * `resources.veins` has always been a COUNT and the yearly economy has always
 * multiplied by it; what was missing is that the catalog could only say yes or
 * no, so every holder in the world was seeded with exactly one and the whole
 * term was a constant. A working vein is 1 because 5,000 a year is the figure
 * that was written for an ordinary one, and everything else is stated against
 * it: a thin seam is the least valuable grant in a province, an arterial is
 * what a court administers on an apex's behalf, and a vein system is what an
 * apex holds entire and grants reaches out of.
 *
 * Nothing downstream had to change. A vein lost in a war still costs one, and a
 * house whose whole holding was a thin seam loses it and has nothing.
 */
export const HOW_MANY_ORDINARY_VEINS: Readonly<Record<VeinWorth, number>> = {
    'a thin seam': 0.4,
    'a working vein': 1,
    'an arterial': 3,
    'a vein system': 8
};

/** Veins' worth of rock a house holds. Zero where it holds none. */
export function howMuchRockItHolds(veinWorth: CatalogFaction['veinWorth']): number {
    return veinWorth ? HOW_MANY_ORDINARY_VEINS[veinWorth] : 0;
}

/**
 * WHAT A YEAR OF THE TRADE IS WORTH, by the dearest thing the house finishes.
 *
 * THE FEE, NOT THE MERCHANDISE. The customer brings the materials or buys them
 * at the counter, so what a house sells is the work and the skill - which is a
 * thing this repo already prices. `OCCUPATIONS` pays a cultivator by the month
 * against the rung the work needs: a bellows hand at the bottom of the ladder
 * is 600 cash a month, a formation hand at 8 is 1,500, and the pill convoy
 * escort at 23 - the one job in the catalog written about this trade - is
 * 20,000, which is 2,400 stones a year for ONE pair of hands.
 *
 * So a hall of hands at heaven-grade work is a multiple of that escort, and
 * 9,000 is a little under four of him. The check that makes it checkable rather
 * than chosen: the Cinnabar Crucible Sect pays that escort 2,400 a year to move
 * four shipments, and against a modelled income of 1,000 it was spending more
 * than twice everything it had on guards for goods nothing priced.
 *
 * The steps are roughly four apiece, not the ten that separates
 * `PILL_VALUE_BANDS`, and the difference is volume: a counter sells mortal-grade
 * medicine daily and the Hall's heaven-grade batches fail and go out four times
 * a year. Price per piece rises by ten; pieces finished fall by about three.
 *
 * AND THE ROCK ORDERING DOES NOT APPLY HERE. "A rock gives more" was settled
 * about tolls and gates against veins. A house shipping finished heaven-grade
 * medicine out-earns a working vein and the genre agrees; what it does not
 * out-earn is an arterial, and no trade anywhere reaches a vein system.
 */
export const WHAT_A_YEAR_OF_THE_TRADE_IS_WORTH: Readonly<Record<TradeGrade, number>> = {
    mortal: 600,
    earth: 2_400,
    heaven: 9_000
};

/**
 * How much of a house the trade is. The specialisation axis, and the reason
 * this is not a flag.
 *
 * Most houses here can make something - a temple cuts its own formation nodes,
 * a sword yard forges its own blades - so a boolean would have said one house
 * makes things and thirty-seven make nothing, which is the levy's own old
 * defect rebuilt. What separates a specialist is that every rung of its ladder
 * is a title in the trade, from Bellows Hand to Hall Grandmaster.
 */
export const HOW_MUCH_OF_A_HOUSE_THE_TRADE_IS: Readonly<Record<TradeDevotion, number>> = {
    'a sideline': 0.15,
    'a hall': 0.4,
    'the house': 1
};

/**
 * What a house's trade brings in per year, in spirit stones.
 *
 * One copy, for the same reason `whatALevyBringsIn` is one copy: the purse a
 * house is seeded with and the yearly economy both read it.
 *
 * Deliberately NOT scaled by what the house can put on the ground, like the
 * levy and the towns beside it. The rung is already in `grade` - it is what
 * decides whether the house can finish the dear thing at all - and scaling it
 * again would charge the same fact twice.
 */
export function whatItsTradeBringsIn(trade: CatalogFaction['trade']): number {
    if (!trade) return 0;
    return Math.round(
        WHAT_A_YEAR_OF_THE_TRADE_IS_WORTH[trade.grade] * HOW_MUCH_OF_A_HOUSE_THE_TRADE_IS[trade.devotion]
    );
}

/**
 * What a house takes off what it HOLDS in a year: rock, gates, towns, benches.
 *
 * The four terms of the yearly economy that come from the holding, and
 * deliberately not the per-member one beside them. A roll is not a holding: it
 * grows and shrinks with who is alive this decade, and the pyramid - the claim
 * that the body you answer to is richer than you - is a claim about the grant,
 * not about how many people happen to be standing in the compound.
 *
 * One copy, so the seeded purse, the yearly economy and the test that walks
 * every parentage edge cannot each grow their own arithmetic. Before this the
 * only way to ask the question was to retype four terms, and the first thing
 * that retyped them left the towns out.
 */
export function whatItsHoldingsBringIn(
    cf: Pick<CatalogFaction, 'id' | 'veinWorth' | 'levy' | 'trade' | 'reliableOrdinal'>,
    locations: readonly LocationRecord[]
): number {
    return Math.round(
        howMuchRockItHolds(cf.veinWorth) * 5_000 * (0.5 + whatItCanPutOnTheGround(cf.reliableOrdinal))
        + whatALevyBringsIn(cf.levy)
        + whatTheTownsBringIn(locations, cf.id)
        + whatItsTradeBringsIn(cf.trade)
    );
}

/**
 * The generator's flat input, read straight off the catalog row.
 */
function compoundInputFor(cf: CatalogFaction): CompoundInput {
    return {
        factionId: cf.id,
        factionName: cf.name,
        ranks: cf.ranks,
        admissionOrdinal: cf.admissionOrdinal,
        powerOrdinal: cf.powerOrdinal,
        recruits: cf.recruits,
        alignment: cf.alignment,
        reliableOrdinal: cf.reliableOrdinal,
        formationIntegrity: cf.formationIntegrity,
        formationNodesTotal: cf.formationNodesTotal ?? 0,
        formationNodesLit: cf.formationNodesLit ?? 0,
        inherited: cf.compoundInherited ?? false,
        holdsVein: cf.holdsVein,
        tributeStonesPerYear: cf.tributeStonesPerYear,
        sealedCeilingOrdinal: cf.sealedCeilingOrdinal,
        preferredRoots: cf.preferredRoots ?? [],
        teachesElements: cf.teachesElements ?? [],
        specialities: cf.specialities ?? []
    };
}

function seedFactions(
    state: WorldState,
    catalog: WorldCatalog,
    regions: Map<string, LocationRecord>,
    presentDay: number
): FactionRecord[] {
    const out: FactionRecord[] = [];
    // The top of the ground scale belongs to whoever is actually strongest.
    const apexPowerOrdinal = catalog.factions.reduce((max, f) => Math.max(max, f.powerOrdinal), 1);
    const regionForFaction = new Map<string, string>();
    for (const region of catalog.regions) {
        for (const id of region.factionIds) regionForFaction.set(id, region.id);
    }

    for (const cf of catalog.factions) {
        const rng = forStream(state.seed, 'seed-faction', cf.id);
        const regionId = regionForFaction.get(cf.id) ?? catalog.regions[0]?.id ?? null;
        const region = regionId ? regions.get(regionId) ?? null : null;
        // A sect is a PLACE. Its seat used to be the region location, which
        // meant a disciple could be on the roll and had nowhere to walk to -
        // the engine said "being on their roll and being on their ground are
        // two different things" and then modelled only the roll. `sect_seat`
        // was already in `LocationKind`; nothing here is a new category.
        const seat = region ? seedSectGround(state, cf, region, apexPowerOrdinal, presentDay) : null;

        // A year of upkeep, scaled by what it can put on the ground and what it
        // owes. The middle factor was `(0.5 + cf.production)` against a number
        // that was 0.5 for every house in the catalog, so it was exactly 1.0
        // everywhere and the treasury was a function of power alone.
        // A house that eats off a gate rather than off rock opens with a purse
        // too, and it opened with none: before the levy existed the only house
        // with nothing in this expression was a house with no ground, which
        // described two thirds of the catalog.
        //
        // And the towns it governs, which is the other half of the same fix:
        // the levy priced what a house takes at a gate and nothing priced what
        // it takes from the people living under it, so a house administering a
        // province outright opened with the purse of a house administering
        // nothing. Stamped onto the settlements by `seedRegions` above, so this
        // reads the world rather than the catalog.
        const townsHere = whatTheTownsBringIn(state.locations, cf.id);
        const baseTreasury = Math.round(
            (2_000 + cf.powerOrdinal * 900) * (0.5 + whatItCanPutOnTheGround(cf.reliableOrdinal)) +
            whatALevyBringsIn(cf.levy) + townsHere + whatItsTradeBringsIn(cf.trade) -
            cf.tributeStonesPerYear * 0.08
        );

        const faction = makeFaction({
            id: cf.id,
            name: cf.name,
            // A body that administers ground it was never granted is a court
            // in the world's vocabulary rather than a school, and the one in
            // the catalog administers a valley, a mountain and four
            // settlements. This read `governance === 'deference'`, which was
            // the same body named by how it is backed.
            kind: cf.holdsByReputation ? 'court' : 'sect',
            alignment: cf.alignment,
            seatLocationId: seat?.id ?? null,
            controlledLocationIds: seat ? [seat.id] : [],
            ranks: cf.ranks.slice(),
            standing: {},
            resources: {
                spirit_stones: Math.max(200, baseTreasury + rng.int(-400, 1200)),
                veins: howMuchRockItHolds(cf.veinWorth),
                tribute_owed_per_year: cf.tributeStonesPerYear,
                // Read back by the yearly economy and by promotion. Kept on the
                // record rather than looked up, so the world stays
                // self-contained once the catalog is out of the picture.
                //
                // This was `production`, a 0..1 that was 0.5 on every house
                // ever seeded. The ordinal is the fact the catalog states.
                reliable_ordinal: cf.reliableOrdinal,
                // What its gates, fords and counters take in a year. Computed
                // once, here, by the same function the purse above used, so the
                // yearly economy reads a figure rather than repeating a table.
                levy_per_year: whatALevyBringsIn(cf.levy),
                // And what its benches turn out. Stored beside the levy and for
                // the same reason: what a house makes does not change in the
                // ordinary run of a century, and the yearly economy then reads
                // one figure rather than repeating two tables.
                trade_per_year: whatItsTradeBringsIn(cf.trade),
                // AND NO COLUMN FOR WHAT THE TOWNS PAY, deliberately. A charter
                // does not change hands in the ordinary run of a century and
                // ground does - twice over in the yearly economy - so a figure
                // written here would go on stating what the house held at
                // seeding and nothing would fail. `whatTheTownsBringIn` reads
                // the locations, which are where the fact actually lives.
                admission_ordinal: cf.admissionOrdinal,
                // What it fields every day, which `cascade.ts` compares against
                // whoever came for it.
                power_ordinal: cf.powerOrdinal,
                // And what it holds asleep, once. Spent to zero on waking.
                sealed_ceiling_ordinal: cf.sealedCeilingOrdinal
            },
            description: cf.description,
            foundedOnDay: presentDay - years(rng.int(60, 900)),
            // The governance word, and separately the fact that used to be one
            // of them. `deference` was a governance value and is now a
            // property of the hold: the tag says what is true of the ground
            // rather than what group the house was filed under.
            tags: [
                cf.governance,
                cf.recruits ? 'recruits' : 'closed',
                ...(cf.holdsByReputation ? ['holds_by_reputation'] : [])
            ]
        });

        // Rivalries are symmetric in the catalog, so recording one side is
        // enough; the other faction's own pass records the mirror.
        for (const rivalId of cf.rivalIds) faction.standing[rivalId] = -0.6;
        // THE STRUCTURE IS NOT THIS LINE. Who a house holds from is
        // `FACTION_PARENTAGE`, and it stays there: what is written here is only
        // how warmly this house starts out toward its parent, which varies by
        // what the terms actually say. It used to be a flat 0.4 for every
        // subsidiary in the world, which was a directed structural fact
        // collapsed into one warmth number at the moment the world was built.
        // See `what-a-house-answers-to.ts`.
        if (cf.parentFactionId) {
            // Null where the parentage table says nothing about this house, and
            // then the old flat figure stands: a house the catalog parents must
            // still come out related, or a zero here reads downstream as no
            // relation at all.
            faction.standing[cf.parentFactionId] =
                howWarmlyTheyStartTowardTheirParent(faction.id) ?? AT_ARMS_LENGTH;
        }

        // A federated sect holds its vein from somebody. An unbacked one holds
        // it because nobody has taken it yet. Both are recorded as control.
        if (cf.holdsVein && region) {
            const vein = state.locations.find(l => l.id === `${region.id}-vein`);
            if (vein && !vein.controllingFactionId) {
                vein.controllingFactionId = cf.id;
                faction.controlledLocationIds.push(vein.id);
                // Held ground is linked to the ground that holds it, so the
                // ordinary travel path reaches it from the gate.
                if (seat) linkLocations(seat, vein, 'path', 1);
            }
        }
        if (seat) seat.controllingFactionId = cf.id;

        // And the towns. Stamped on the place rows by `seedRegions`, collected
        // onto the house here, so `controlledLocationIds` and the column agree
        // by construction rather than by two passes writing the same fact.
        for (const location of state.locations) {
            if (location.kind !== 'settlement') continue;
            if (location.controllingFactionId !== cf.id) continue;
            faction.controlledLocationIds.push(location.id);
        }


        state.factions.push(faction);
        out.push(faction);

        appendFact(state.history, makeFact({
            day: faction.foundedOnDay ?? presentDay,
            kind: 'faction_founded',
            scale: 'regional',
            summary:
                `The ${cf.name} took its seat` + (seat ? ` at ${seat.name}` : '') + '. ' +
                (cf.governance === 'unbacked'
                    ? 'It answers to nobody and pays for that itself.'
                    : `It holds what it holds on ${cf.governance} terms.`),
            locationId: seat?.id ?? null,
            factionIds: [cf.id],
            visibility: 'public',
            fidelity: 'partial',
            magnitude: 0.5,
            data: { governance: cf.governance }
        }));
    }

    return out;
}

// ─────────────────────────────────────────────────────────────────────────
// POPULATION
// ─────────────────────────────────────────────────────────────────────────

/**
 * What a cultivator with these inputs would actually be, after this long.
 */
export interface DeriveOrdinalOptions {
    /**
     * Ambient band the climb happened in. Defaults to `normal`, which is the
     * Late Age's open-world baseline.
     */
    ambient?: AmbientQi;
    /**
     * Qi density of the ERA this cultivator climbed in, 0..1, from `world_eras`.
     * This is how an ancient is derived honestly: a Grand Ascension survivor is not
     * an exemption in the maths, they are somebody who walked the same cost curve
     * when the open air was richer. Omitted means the present day.
     */
    eraQiDensity?: number;
    /** Retry ceiling per rank. A safety net; settling normally binds first. */
    maxAttemptsPerRank?: number;
    /**
     * Where this person was born.
     */
    origin?: OriginTierKey;
    /**
     * Told what every crossing attempt cost and what it was carrying.
     */
    onAttempt?: (attempt: CrossingAttemptObservation) => void;
    /**
     * Turn the commodity pill market off, so a probe can measure what it is worth
     * rather than argue about it.
     */
    buysProgress?: boolean;
}

/** One crossing attempt, as it actually happened. See `onAttempt`. */
export interface CrossingAttemptObservation {
    ordinal: number;
    /** Age at the attempt. */
    age: number;
    /** Stones in hand at the counter, before the pill was paid for. */
    stonesBeforePill: number;
    /** What a pill at full potency costs at this rung. */
    pillPrice: number;
    /** Share of a pill the holding covered, 0..1. */
    potency: number;
    /** The odds the attempt actually ran at. */
    finalChance: number;
    crossed: boolean;
}

/** The denser of two bands. A house can improve the ground; it cannot find a vein. */
function betterAmbient(a: AmbientQi, b: AmbientQi): AmbientQi {
    return AMBIENT_QI_RATE_MULTIPLIER[b] > AMBIENT_QI_RATE_MULTIPLIER[a] ? b : a;
}

/**
 * How far this life actually got.
 */
export interface DerivedLife {
    ordinal: number;
    /** Stones left after a lifetime of upkeep, stipend and pills. */
    spiritStones: number;
}

export function deriveLife(
    root: SpiritRootKey,
    attributes: InnateAttributes,
    ageYears: number,
    regionRateMultiplier: number,
    ceiling: number,
    rng: CultivationRNG,
    opts: DeriveOrdinalOptions = {}
): DerivedLife {
    const lifetime = Math.max(0, ageYears - MIN_AGE);
    if (lifetime <= 0) return { ordinal: 0, spiritStones: 0 };

    // Most people are not sitting in a cave. A wide, right-skewed draw that
    // stands for everything this layer does not model about a life.
    const effort = rng.float(0.08, 0.75) * (1 + attributes.insight * 0.08);
    const origin = getOrigin(opts.origin ?? 'thin_county');
    // The family can improve the ground under a child. It cannot find them a
    // sealed vein, which is why MAX_ORIGIN_AMBIENT stops at dense.
    const ambient: AmbientQi = betterAmbient(opts.ambient ?? 'normal', origin.ground);
    const era = opts.eraQiDensity === undefined ? 1 : eraAmbientMultiplier(opts.eraQiDensity);
    const maxAttempts = Math.max(1, opts.maxAttemptsPerRank ?? 12);

    const focus = Math.min(1, effort);

    // Priced at the rung the walker is standing on, not at the bottom.
    const road = bestReadable(origin.roadQuality, { spiritRoot: root, attributes });

    const perYearAt = (at: number): number => computeCultivationRate(
        // `attributes` is passed now, and it is not decoration: the manual
        // quality below is priced against what this reader can take out of the
        // book, so a walk that withheld the attribute block would price every
        // life in the world at the pivot and lose the whole talent axis.
        { spiritRoot: root, injuries: [], realmOrdinal: at, attributes },
        ambient,
        {
            focusMultiplier: focus,
            locationBonus: Math.max(0.1, regionRateMultiplier) * era,
            // AN ACTUAL BOOK, rather than the insight proxy that stood here.
            techniqueQuality: road,
            // Placement: arrays, elder guidance, and a stipend that means this
            // person is not foraging. 1 for the nine births in ten that have none.
            sectBonus: origin.placement.sectBonus
        }
    ).perDay * DAYS_PER_YEAR;

    if (perYearAt(0) <= 0) {
        return { ordinal: 0, spiritStones: Math.max(0, Math.round(origin.spiritStones)) };
    }
    // The province's ceiling is absolute, and placement does NOT lift it.
    const cap = Math.min(clampOrdinal(ceiling), MAX_ORDINAL);

    let ordinal = 0;
    let age = MIN_AGE;
    let spent = 0;
    // Stones are finite and they are spent. A patriarch's fortune buys a great
    // many pills and then it is gone, which is why this term flattens out
    // rather than compounding.
    let stones = origin.spiritStones;

    while (ordinal < cap) {
        const cost = progressRequiredForOrdinal(ordinal);
        // Above the Lid nothing is priced in qi, so the walk stops here.
        if (cost === null) break;
        const perYear = perYearAt(ordinal);
        const allowance = stagnationYearsForOrdinal(ordinal);
        const lifespan = lifespanForOrdinal(ordinal);

        // MONEY IS THE SECOND ROAD UP, AND IT WAS NEVER CONNECTED
        const netPerYear =
            origin.placement.stipendPerYear
            + (1 - focus) * earningsPerYear(ordinal)
            - focus * STONES_PER_YEAR_OF_SECLUSION;
        // The crossing pill comes first. Somebody who spends the pill money on
        // reaching the door faster arrives at the door with nothing, which is
        // not a trade anybody makes twice - so one pill's worth of the income
        // over this rank is reserved and only the remainder becomes qi.
        const naturalYears = cost / perYear;
        const reservePerYear = naturalYears > 0
            ? Math.min(Math.max(0, netPerYear), BREAKTHROUGH_PILL_STONES / naturalYears)
            : Math.max(0, netPerYear);
        const spendPerYear = opts.buysProgress === false
            ? 0
            : Math.max(0, netPerYear - reservePerYear);
        const perYearHere = perYear + purchasedQiPerYear(spendPerYear, ordinal);

        let yearsAtRank = 0;
        let crossed = false;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const yearsNeeded = cost / perYearHere;
            // Settling: a plateau longer than the realm permits ends the life
            // where it stands, exactly as it does for the player.
            if (yearsAtRank + yearsNeeded >= allowance) break;
            // Lifespan: the realm grants a span, and it runs out.
            if (age + yearsNeeded >= lifespan) break;
            if (spent + yearsNeeded >= lifetime) break;

            yearsAtRank += yearsNeeded;
            age += yearsNeeded;
            spent += yearsNeeded;
            // Upkeep, stipend, and the work. A year at a rank costs stones whether
            // or not anything comes of it - but a life is not spent entirely in a
            // cave, and the part that is not IS the earning.
            const secludedYears = yearsNeeded * focus;
            const workingYears = yearsNeeded - secludedYears;
            stones = Math.max(
                0,
                stones
                    + yearsNeeded * origin.placement.stipendPerYear
                    - secludedYears * STONES_PER_YEAR_OF_SECLUSION
                    + workingYears * earningsPerYear(ordinal)
            );
            // And what went over the counter on the way. Progress bought is
            // progress paid for: without this line the crossing pill would be
            // bought with money that had already been spent on qi, and the
            // holding every NPC in the world ends up with would be a fiction.
            stones = Math.max(0, stones - yearsNeeded * spendPerYear);

            // One pill, bought if the holding covers it, and actually paid for.
            const stonesBeforePill = stones;
            const potency = affordablePillPotency(stones, BREAKTHROUGH_PILL_STONES);
            const pill = potency > 0
                ? { name: 'a breakthrough pill', potency: potency * MAX_PILL_BONUS }
                : null;
            stones = Math.max(0, stones - potency * BREAKTHROUGH_PILL_STONES);

            const odds = computeBreakthroughOdds(
                { realmOrdinal: ordinal, spiritRoot: root, attributes, injuries: [] },
                // The same book that built this realm is standing at the
                // crossing with them. Preparation, not instruction - see
                // `manualQuality` on `BreakthroughContext`. Without this the
                // walk priced the manual on the road and forgot it at the one
                // moment the road was for.
                { ambient, pill, manualQuality: road }
            );
            const struck = rng.next() < odds.finalChance;
            opts.onAttempt?.({
                ordinal,
                age,
                stonesBeforePill,
                pillPrice: BREAKTHROUGH_PILL_STONES,
                potency,
                finalChance: odds.finalChance,
                crossed: struck
            });
            if (struck) {
                crossed = true;
                break;
            }
            // A failure burns part of what was accumulated, and the time to
            // put it back is real. Averaged over the failure table rather than
            // rolled, because this is a derivation and not a playthrough.
            const burned =
                (FAILURE_PROGRESS_LOSS.failure_stable +
                    FAILURE_PROGRESS_LOSS.failure_injured +
                    FAILURE_PROGRESS_LOSS.failure_deviation) / 3;
            const recovery = (cost * burned) / perYearHere;
            yearsAtRank += recovery;
            age += recovery;
            spent += recovery;
        }

        if (!crossed) break;
        ordinal++;
    }

    return { ordinal, spiritStones: Math.max(0, Math.round(stones)) };
}

/**
 * What the life walk left them holding, alongside where it left them.
 */
export function deriveOrdinal(
    root: SpiritRootKey,
    attributes: InnateAttributes,
    ageYears: number,
    regionRateMultiplier: number,
    ceiling: number,
    rng: CultivationRNG,
    opts: DeriveOrdinalOptions = {}
): number {
    return deriveLife(root, attributes, ageYears, regionRateMultiplier, ceiling, rng, opts).ordinal;
}

/**
 * Generate the population, derive what each one became, and only then decide
 * who runs anything.
 */
function seedPopulation(
    state: WorldState,
    catalog: WorldCatalog,
    factions: readonly FactionRecord[],
    population: number,
    presentDay: number,
    /** See {@link SeedWorldOptions.rollWorthModelling}. */
    rollWorthModelling: number
): NpcRecord[] {
    const regions = catalog.regions;
    if (regions.length === 0 || population === 0) return [];

    const factionById = new Map(factions.map(f => [f.id, f]));
    const catalogById = new Map(catalog.factions.map(f => [f.id, f]));
    const created: NpcRecord[] = [];

    // Names have to be unique, and nothing else in the engine enforces it
    const taken = new Set<string>(state.npcs.map(n => n.name));
    for (const member of MEMBERS) taken.add(member.name);

    // Spread the population over regions by how much qi they can support. A
    // thin province carries fewer cultivators, which is the setting's own
    // arithmetic and not a balance knob.
    const weights = regions.map(r => 0.25 + qiFraction(r.qiDensity));
    const total = weights.reduce((a, b) => a + b, 0);

    let seq = 0;
    for (let i = 0; i < regions.length; i++) {
        const region = regions[i];
        const share = Math.round(population * (weights[i] / total));
        const regionLoc = regionLocationId(region.id);
        const placeIds = [regionLoc, ...region.places.map(p => placeLocationId(region.id, p.name))];
        const regionFactions = region.factionIds
            .map(id => factionById.get(id))
            .filter((f): f is FactionRecord => f != null);

        for (let n = 0; n < share; n++) {
            const id = `npc-${seq++}`;
            const rng = forStream(state.seed, 'seed-life', id);
            // NOT `MAX_AGE`, WHICH IS TWENTY YEARS PAST WHAT THEY CAN LIVE.
            // Everybody in this pool is created at ordinal 0 and the span at
            // the bottom of the ladder is a hundred years, so a flat draw to
            // 120 stood one in six of them up already dead. The RANGE is cut
            // rather than the draw clamped, so nobody piles on the last legal
            // year - a pile there is the same cull a few decades later.
            const age = rng.int(MIN_AGE, OLDEST_A_DRAWN_LIFE_REACHES);

            let npc = createNpc(state.seed, {
                id,
                bornOnDay: presentDay - years(age),
                onDay: presentDay,
                locationId: placeIds[rng.int(0, placeIds.length - 1)],
                occupation: 'unknown',
                takenNames: taken,
                tags: [`region:${region.id}`]
            });
            taken.add(npc.name);

            // Derived, not assigned. Same inputs the player gets, and that now
            // includes where they were born - which is the honest explanation
            // for why a Dao house has the members it does. Nobody is placed
            // in one; the origin roll puts them there and the derivation spends
            // what it supplied.
            const life = deriveLife(
                npc.cultivation.spiritRoot,
                npc.cultivation.attributes,
                age,
                region.ambientRateMultiplier,
                region.localCeilingOrdinal,
                rng,
                { origin: npc.identity.origin }
            );
            const ordinal = life.ordinal;
            npc = setRealm(npc, ordinal, presentDay - years(rng.int(0, 8)));
            npc = { ...npc, spiritStones: life.spiritStones };
            npc = {
                ...npc,
                cultivation: {
                    ...npc.cultivation,
                    foundation: ordinal >= 13 ? 'stable' : 'incomplete',
                    specialties: getSpiritRoot(npc.cultivation.spiritRoot).elements.slice()
                }
            };
            npc = addGoal(npc, goalFor(npc, region, rng), presentDay - years(rng.int(1, 20)));

            // Affiliation is offered to those a faction here would look at.
            if (regionFactions.length > 0 && rng.chance(AFFILIATION_RATE)) {
                const open = regionFactions.filter(f => {
                    const cf = catalogById.get(f.id);
                    return cf != null && !roadRefuses(houseRoadOf(cf), getSpiritRoot(npc.cultivation.spiritRoot));
                });
                const pool = open.length > 0 ? open : regionFactions;
                const candidate = pool[rng.int(0, pool.length - 1)];
                const cf = catalogById.get(candidate.id);
                const takes = whoAHouseWillTake(candidate.id);
                if (cf && cf.recruits && ordinal >= cf.admissionOrdinal
                    && (takes === null || takes === npc.identity.sex)) {
                    npc = { ...npc, factionId: candidate.id, factionRankIndex: 0 };
                }
            }

            state.npcs.push(npc);
            created.push(npc);
        }
    }
    state.nextNpcSeq = seq;

    // The catalogs already contain the people the derivation cannot produce.
    // Instantiate them before roles are handed out, so a faction's curated
    // seniors are in the room when the pyramid is built.
    created.push(...seedNamedFigures(state, catalog, presentDay));
    // And the wanderer the catalog names, who is on nobody's roll.
    // See `the-wanderer-the-catalog-names-is-somebody.ts`.
    created.push(...seedTheWanderers(state, presentDay));
    created.push(...seedWhatAHouseActuallyHolds(state, catalog, presentDay, taken));
    // AND THE RANK AND FILE AROUND THEM. Last of the three, so what the catalog
    // states is on the roll first and is counted before anything is raised -
    // the people here fill a shortfall and never dilute a curated figure. After
    // the apex pass for the same reason in the other direction: a house that
    // needed an instance it did not derive must get one off its own catalog
    // roll rather than off somebody its ground happened to carry.
    created.push(
        ...seedThePeopleAHouseRaised(state, catalog, presentDay, taken, rollWorthModelling));
    // AND THE ROGUES, off the rolls as they now stand. See
    // `the-rogues-a-world-opens-with.ts`.
    created.push(...seedTheRogues(state, catalog, presentDay, taken));

    assignFactionRoles(state, catalogById, presentDay);
    return created;
}

/**
 * Instantiate the named people the content catalogs already describe.
 */
/**
 * The one family in the world that came down from something that changed.
 */
function seedTheLineThatCameDown(
    state: WorldState,
    catalog: WorldCatalog,
    presentDay: number
): NpcRecord[] {
    const line = THE_LINE_AT_OLD_RIVER;
    const region = catalog.regions.find(r => r.id === line.regionId);
    if (!region) return [];
    const place = region.places.find(p => p.name === line.place);
    // A family with nowhere to live is not seeded rather than being put on the
    // province container. See the birth pass: people are born where people can
    // live, and a fallback onto a map node nobody stands on is the quiet defect.
    if (!place) return [];
    const locationId = placeLocationId(region.id, place.name);

    const created: NpcRecord[] = [];
    for (let i = 0; i < line.people.length; i++) {
        const person = line.people[i];
        const id = `npc-line-${i}`;
        const rng = forStream(state.seed, 'the-line-that-came-down', id);

        let npc = createNpc(state.seed, {
            id,
            name: `${line.surname} ${person.given}`,
            bornOnDay: presentDay - years(person.ageYears),
            onDay: presentDay,
            locationId,
            occupation: 'unknown',
            sex: person.sex,
            bloodline: person.tier === null
                ? null
                : { speciesId: line.speciesId, tier: person.tier },
            description: person.note,
            // What the catalog STATES rides onto the row here. Everything else
            // about these people is described and then left to the world.
            tags: [`region:${region.id}`, ...whatACatalogStatesAsTags(person)]
        });

        const ordinal = person.ordinal ?? deriveLife(
            npc.cultivation.spiritRoot,
            npc.cultivation.attributes,
            person.ageYears,
            region.ambientRateMultiplier,
            region.localCeilingOrdinal,
            rng,
            { origin: npc.identity.origin }
        ).ordinal;
        npc = setRealm(npc, ordinal, presentDay);

        state.npcs.push(npc);
        created.push(npc);
    }

    // AND THEY ARE KIN, which nothing said. The catalog calls them a line and
    // reads them as a ladder down from the one who came out of the water, so
    // each of them is the child of the nearest person above them in it. Without
    // these rows the family exists in the writing and in no reader: the lineage
    // record is built out of kinship now, and so is everything that asks who
    // somebody's people are.
    const byAge = created.slice().sort((a, b) => a.identity.bornOnDay - b.identity.bornOnDay);
    const roster = rosterOf(state);
    for (let i = 1; i < byAge.length; i++) {
        bindKin(state, roster.at, byAge[i - 1]!, byAge[i]!, presentDay);
    }
    return created;
}

/**
 * One generation of the authored line to the next: a parent row and a child row,
 * at the standings every other household in the world is written at.
 */
function bindKin(
    state: WorldState,
    at: Map<string, number>,
    parent: NpcRecord,
    child: NpcRecord,
    onDay: number
): void {
    const parentAt = at.get(parent.id);
    const childAt = at.get(child.id);
    if (parentAt === undefined || childAt === undefined) return;
    state.npcs[parentAt] = upsertRelationship(state.npcs[parentAt]!, {
        targetId: child.id, targetName: child.name, kind: 'child',
        standing: CHILD_STANDING, note: 'Their child.'
    }, onDay);
    state.npcs[childAt] = upsertRelationship(state.npcs[childAt]!, {
        targetId: parent.id, targetName: parent.name, kind: 'parent',
        standing: PARENT_STANDING, note: 'Raised them.'
    }, onDay);
}

function seedNamedFigures(
    state: WorldState,
    catalog: WorldCatalog,
    presentDay: number
): NpcRecord[] {
    const catalogById = new Map(catalog.factions.map(f => [f.id, f]));
    const created: NpcRecord[] = [];

    for (const member of MEMBERS) {
        const faction = catalogById.get(member.factionId);
        if (!faction) continue;

        // The rule for what a catalog person's world row is called was written
        // here and nowhere else knew it, so the knowledge layer filed the same
        // human being under two ids and could not tell they were one person.
        // `a-catalog-person-and-their-world-row.ts` owns the rule now, in both
        // directions, so the two cannot drift.
        const id = worldIdForCatalogPerson(member.id);
        if (state.npcs.some(n => n.id === id)) continue;

        const rng = forStream(state.seed, 'seed-named', id);
        // Old enough to have got where the catalog says they are, without
        // being implausibly ancient for it.
        const age = anAgeTheRungCanCarry(member.realmOrdinal, rng.int(0, 40));

        // Their birth follows from the seat they are already sitting in, not from a
        // lottery that knows nothing about it. See
        // `where-the-seeded-population-was-born.ts`: this person is not being born
        // here, they already exist and already hold this rank, so the question is
        // which births PRODUCE somebody standing at this rung - which is the birth
        // table reweighted, not replaced. Its own stream, so no root, attribute,
        // name or ordinal in any existing world moves.
        const ordinal = clampOrdinal(member.realmOrdinal);
        const rankIndex = Math.min(member.rankIndex, Math.max(0, faction.ranks.length - 1));
        // And their root follows from the road the house teaches, for the same
        // reason their birth follows from the seat. See
        // `what-root-a-seeded-house-member-has.ts`: nobody is raised to Sword
        // Elder on a road their own root refuses, so the question is which
        // roots PRODUCE somebody standing here - the root table reweighted, not
        // replaced. Rung zero is never conditioned, in any house.
        const root = drawRootForSomebodyAlreadyInAHouse(
            forStream(state.seed, 'seed-root', id).next(),
            houseRoadOf(faction), ordinal, rankIndex
        );
        let npc = createNpc(state.seed, {
            id,
            bornOnDay: presentDay - years(age),
            onDay: presentDay,
            locationId: groundAHouseFiguresStandOn(state, catalog, faction),
            occupation: 'unknown',
            origin: drawOriginForSomebodyAlreadyAtOrdinal(
                forStream(state.seed, 'seed-origin', id).next(), ordinal
            ).key,
            cultivation: { spiritRoot: root.key },
            // A house that takes one sex has a roll of that sex, because every
            // one of them came through its door. Supplied rather than rolled,
            // which is the whole difference between a bar and a coincidence:
            // rolling would have seeded half a closed house with people it
            // could not have admitted.
            // AND OTHERWISE WHAT THE ROW'S OWN WRITING ALREADY SAID.
            //
            // `MemberSchema` carries no sex, so this rolled one - while 149 of
            // the 196 entries had already committed to one in their `wants`,
            // `fears` or `detail`, and about half of those came out of the
            // world contradicted. Played: Half Cup Lian, female, whose entry
            // says "which HE will admit to out there".
            //
            // The house's bar still wins, because it is a bar: a house that
            // admits one sex has a roll of that sex, since every one of them
            // came through its door. Under it, the writing decides. Where the
            // writing says nothing - or says both, because it is talking about
            // somebody else - the roll stands exactly as it did.
            ...(whoAHouseWillTake(faction.id) ?? theSexThisRowsProseCommitsTo(member)) !== null
                ? { sex: (whoAHouseWillTake(faction.id)
                    ?? theSexThisRowsProseCommitsTo(member))! }
                : {},
            tags: [
                'catalog:member', `faction:${faction.id}`,
                // What this catalog STATES rides onto the row here, the same
                // way the line at Old River carries its own statement.
                ...whatACatalogStatesAsTags(member)
            ]
        });

        npc = setRealm(npc, ordinal, presentDay - years(rng.int(0, 12)));
        npc = {
            ...npc,
            name: member.name,
            factionId: faction.id,
            factionRankIndex: rankIndex,
            spiritStones: holdingsFor(member.realmOrdinal, member.rankIndex, rng),
            cultivation: {
                ...npc.cultivation,
                foundation: member.realmOrdinal >= 13 ? 'stable' : 'incomplete',
                specialties: getSpiritRoot(npc.cultivation.spiritRoot).elements.slice()
            }
        };

        state.npcs.push(npc);
        created.push(npc);
    }

    return created;
}

/**
 * Nobody was born before the world had a history to be born into.
 */
export function ageInsideRecordedHistory(
    state: WorldState,
    presentDay: number,
    wantedYears: number
): number {
    if (state.history.eras.length === 0) return wantedYears;
    const firstEraStart = state.history.eras.reduce(
        (earliest, era) => Math.min(earliest, era.startDay), Infinity);
    if (!Number.isFinite(firstEraStart)) return wantedYears;
    const spanYears = Math.floor((presentDay - firstEraStart) / DAYS_PER_YEAR) - MIN_AGE;
    if (spanYears <= MIN_AGE) return wantedYears;
    return Math.min(wantedYears, spanYears);
}


/**
 * Stand up whatever a house's own contents say is there and the world has not
 * produced.
 */
function seedWhatAHouseActuallyHolds(
    state: WorldState,
    catalog: WorldCatalog,
    presentDay: number,
    /** Names already spoken for in this world. See the note in `seedPopulation`. */
    taken: Set<string>
): NpcRecord[] {
    const created: NpcRecord[] = [];

    for (const faction of catalog.factions) {
        // What the house's own roll says its strongest person stands at. Not what
        // its row claims - the roll IS the claim, and everything else is a
        // restatement of it.
        const onTheRoll = rollOf(faction.id)
            .filter(r => r.rankIndex !== null)
            .reduce((best, r) => Math.max(best, r.realmOrdinal), -1);
        if (onTheRoll < 0) continue;
        const declared = clampOrdinal(onTheRoll);
        if (declared < APEX_SEED_FLOOR) continue;

        const strongest = state.npcs
            .filter(n => n.factionId === faction.id && n.status === 'alive')
            .reduce((best, n) => Math.max(best, n.cultivation.realmOrdinal), -1);
        if (strongest >= declared) continue;

        const id = `npc-apex-${faction.id}`;
        if (state.npcs.some(n => n.id === id)) continue;

        const rng = forStream(state.seed, 'seed-apex', id);
        // Somebody at this ordinal climbed when the climbing was possible, so
        // they are old on the scale their realm actually grants.
        const wanted = Math.min(
            Math.max(MIN_AGE + 1, Math.floor(lifespanForOrdinal(declared) * APEX_AGE_FRACTION)),
            Math.floor(lifespanForOrdinal(declared) * 0.9)
        ) + rng.int(0, 200);
        const age = ageInsideRecordedHistory(state, presentDay, wanted);

        let npc = createNpc(state.seed, {
            id,
            bornOnDay: presentDay - years(age),
            onDay: presentDay,
            locationId: groundAHouseFiguresStandOn(state, catalog, faction),
            occupation: 'unknown',
            takenNames: taken,
            // As above: the strongest person in a house is somebody who
            // finished a climb, and which births produce somebody who finished
            // one is not the same question as which births happen. The same
            // goes for the root they finished it on - this is the person the
            // house's whole road was supposed to produce.
            origin: drawOriginForSomebodyAlreadyAtOrdinal(
                forStream(state.seed, 'seed-origin', id).next(), declared
            ).key,
            cultivation: {
                spiritRoot: drawRootForSomebodyAlreadyInAHouse(
                    forStream(state.seed, 'seed-root', id).next(),
                    houseRoadOf(faction), declared, Math.max(0, faction.ranks.length - 1)
                ).key
            },
            tags: ['catalog:apex', `faction:${faction.id}`]
        });
        taken.add(npc.name);

        npc = setRealm(npc, declared, presentDay - years(rng.int(20, 400)));
        npc = {
            ...npc,
            factionId: faction.id,
            factionRankIndex: Math.max(0, faction.ranks.length - 1),
            spiritStones: holdingsFor(declared, Math.max(0, faction.ranks.length - 1), rng),
            cultivation: {
                ...npc.cultivation,
                foundation: 'stable',
                specialties: getSpiritRoot(npc.cultivation.spiritRoot).elements.slice()
            }
        };

        state.npcs.push(npc);
        created.push(npc);
    }

    return created;
}

/**
 * The rank and file a house raised, which is most of what a house is.
 *
 * `a-house-raises-its-own.ts` holds the ruling, what the figure is made of and
 * the measurement; this puts the people on the ground.
 *
 * Three things are true of everybody seeded here and each is a fact about the
 * house rather than about them:
 *
 * - they stand on the house's ground, because that is where somebody the house
 *   raised lives. It is also the half that answers the gate.
 * - their rung comes off `rosterByRung`, the same taper the role pass reads, so
 *   the ladder fills bottom-heavy instead of stacking at the door.
 * - their realm comes off `rankRealmBand`, which is the catalog's own statement
 *   of what somebody at that rank of that house stands at - capped below the
 *   strongest the house already holds, so `power_ordinal` cannot move.
 *
 * Their root and their origin are DRAWN, by the same two functions the apex
 * pass uses and for the same reason: which births produce somebody who
 * finished a climb inside a house is not the same question as which births
 * happen, and this house's road is what they finished it on.
 */
function seedThePeopleAHouseRaised(
    state: WorldState,
    catalog: WorldCatalog,
    presentDay: number,
    /** Names already spoken for in this world. See the note in `seedPopulation`. */
    taken: Set<string>,
    /** See {@link SeedWorldOptions.rollWorthModelling}. */
    rollWorthModelling: number
): NpcRecord[] {
    const created: NpcRecord[] = [];
    if (rollWorthModelling <= 0) return created;
    const catalogById = new Map(catalog.factions.map(f => [f.id, f]));

    for (const faction of state.factions) {
        const cf = catalogById.get(faction.id);
        if (!cf || !cf.recruits) continue;

        const here = state.npcs.filter(n => n.factionId === faction.id && n.status === 'alive');
        // Nobody to stand under. A house the catalog names nobody in and the
        // population never reached is left as it is rather than being invented.
        if (here.length === 0) continue;

        const wanted = aRollWorthModelling({
            rankCount: faction.ranks.length,
            powerOrdinal: cf.powerOrdinal,
            admissionOrdinal: cf.admissionOrdinal,
            recruits: cf.recruits,
            // A house with no founding day on the record is not a young house.
            // It is a house nobody wrote a date for, and reading that as "stood
            // for no time at all" would empty it.
            scale: rollWorthModelling,
            yearsStanding: faction.foundedOnDay === null
                ? Number.POSITIVE_INFINITY
                : (presentDay - faction.foundedOnDay) / DAYS_PER_YEAR
        });
        const short = wanted - here.length;
        if (short <= 0) continue;

        const ladder = faction.ranks.length;
        const strongest = here.reduce((best, n) => Math.max(best, n.cultivation.realmOrdinal), 0);
        const road = houseRoadOf(cf);
        const takes = whoAHouseWillTake(faction.id);
        const region = catalog.regions.find(r => r.factionIds.includes(faction.id)) ?? null;
        const ground = groundAHouseFiguresStandOn(state, catalog, cf);

        // Seats the taper wants at the roll this house is worth modelling, less
        // the ones its own people are already standing on. Filled from the
        // bottom, which is where a house that took somebody in this decade puts
        // them.
        const seats = rosterByRung(wanted, ladder);
        for (const npc of here) {
            const rung = npc.factionRankIndex;
            if (rung >= 0 && rung < seats.length) seats[rung] = Math.max(0, seats[rung] - 1);
        }

        let raised = 0;
        for (let rung = 0; rung < ladder && raised < short; rung++) {
            for (let k = 0; k < (seats[rung] ?? 0) && raised < short; k++) {
                const band = theBandARaisedMemberStandsIn(faction.id, rung, strongest);
                // No room under the cap at this rung: the house holds one fewer
                // rather than gaining somebody who would outrank its own head.
                if (!band) break;

                const id = `npc-raised-${faction.id}-${raised}`;
                if (state.npcs.some(n => n.id === id)) { raised++; continue; }
                const rng = forStream(state.seed, 'a-house-raises-its-own', id);
                const ordinal = clampOrdinal(rng.int(band.minOrdinal, band.maxOrdinal));

                // Old enough to have got there and young enough to still be
                // here. The first half is the same expression the named figures
                // use; the second is the ladder's own span for the rung they
                // stand at, which that expression outruns at the bottom of the
                // ladder where a rung costs more years than a life is long.
                const age = anAgeTheRungCanCarry(ordinal, rng.int(0, 30));

                let npc = createNpc(state.seed, {
                    id,
                    bornOnDay: presentDay - years(age),
                    onDay: presentDay,
                    locationId: ground,
                    occupation: 'unknown',
                    takenNames: taken,
                    ...(takes !== null ? { sex: takes } : {}),
                    origin: drawOriginForSomebodyAlreadyAtOrdinal(
                        forStream(state.seed, 'seed-origin', id).next(), ordinal
                    ).key,
                    cultivation: {
                        spiritRoot: drawRootForSomebodyAlreadyInAHouse(
                            forStream(state.seed, 'seed-root', id).next(), road, ordinal, rung
                        ).key
                    },
                    // NO `region:` TAG, and the omission is the same one the
                    // catalog figures already have. That tag says somebody was
                    // born to a province and is held to its ceiling and its
                    // rate; these people stand on a house's ground, which is
                    // the whole reason they got where they are, and
                    // `groundReachOf` is what carried them. Tagging them with a
                    // province would make the world read them against a
                    // ceiling they were never under.
                    tags: [`raised:${faction.id}`, `faction:${faction.id}`]
                });
                taken.add(npc.name);

                npc = setRealm(npc, ordinal, presentDay - years(rng.int(0, 8)));
                npc = {
                    ...npc,
                    factionId: faction.id,
                    factionRankIndex: rung,
                    spiritStones: holdingsFor(ordinal, rung, rng),
                    cultivation: {
                        ...npc.cultivation,
                        foundation: ordinal >= 13 ? 'stable' : 'incomplete',
                        specialties: getSpiritRoot(npc.cultivation.spiritRoot).elements.slice()
                    }
                };
                if (region) {
                    npc = addGoal(npc, goalFor(npc, region, rng), presentDay - years(rng.int(1, 20)));
                }

                state.npcs.push(npc);
                created.push(npc);
                raised++;
            }
        }
    }

    return created;
}

/**
 * The ground a house's own people are standing on: its gate, forecourt and halls,
 * which `seedSectGround` has already built and linked by road.
 */
function groundAHouseFiguresStandOn(
    state: WorldState,
    catalog: WorldCatalog,
    faction: CatalogFaction
): string {
    const ground = sectGroundId(faction.id);
    if (state.locations.some(l => l.id === ground)) return ground;

    const home = catalog.regions.find(r => r.factionIds.includes(faction.id)) ?? catalog.regions[0];
    return home ? regionLocationId(home.id) : 'the open road';
}

/**
 * Rank every faction's members on the realm they turned out to have, and hand out
 * the titles in that order.
 */
function assignFactionRoles(
    state: WorldState,
    catalogById: Map<string, CatalogFaction>,
    presentDay: number
): void {
    const membersByFaction = new Map<string, NpcRecord[]>();
    for (const npc of state.npcs) {
        if (!npc.factionId) continue;
        const list = membersByFaction.get(npc.factionId);
        if (list) list.push(npc);
        else membersByFaction.set(npc.factionId, [npc]);
    }

    for (const faction of state.factions) {
        const all = membersByFaction.get(faction.id);
        if (!all || all.length === 0) continue;
        const cf = catalogById.get(faction.id);
        const ladder = faction.ranks.length;

        // THE SERVANT RUNG IS A RUNG, NOT A WAITING ROOM
        const road = cf ? houseRoadOf(cf) : null;
        // Only a house that can teach nothing else. A stated preference is not
        // a bar - see the note in `what-root-a-seeded-house-member-has.ts`.
        const closed = road != null && road.regime === 'single_road';
        const refused = (npc: NpcRecord) =>
            closed && roadRefuses(road!, getSpiritRoot(npc.cultivation.spiritRoot));

        const members = all.slice().sort((a, b) =>
            b.cultivation.realmOrdinal - a.cultivation.realmOrdinal ||
            a.identity.bornOnDay - b.identity.bornOnDay ||
            (a.id < b.id ? -1 : 1)
        );
        // Servants go to the bottom rung FIRST, before any early exit below.
        // Ordering it after the empty-body check leaked exactly the people this
        // exists to place: a house with no climbing members kept whatever rank
        // the catalog had given them, above a rung they cannot have held.
        for (const npc of members) {
            if (!refused(npc)) continue;
            const at = indexById(state.npcs, npc.id);
            if (at >= 0) state.npcs[at] = { ...state.npcs[at], factionRankIndex: 0 };
        }

        // A house whose every member is refused has no cultivating body at all.
        // Rank nobody rather than inventing a head out of its servants.
        const climbing = members.filter(n => !refused(n));
        if (climbing.length === 0) continue;

        // A pyramid: one at the top, fewer at each rung down. Indexed on the people
        // who can climb, so a servant standing between two elders in raw ordinal
        // does not push everyone below them down a rung.
        const seats = rosterByRung(climbing.length, ladder);
        const derived = new Array<number>(climbing.length);
        {
            let c = 0;
            for (let rung = ladder - 1; rung >= 0 && c < climbing.length; rung--) {
                for (let k = 0; k < (seats[rung] ?? 0) && c < climbing.length; k++) {
                    derived[c++] = rung;
                }
            }
            // Anybody the taper did not reach stands at the bottom.
            for (; c < climbing.length; c++) derived[c] = 0;
        }

        // The grand elder is one spot. `elderRungOf` is the authority on where
        // the elders start, so the seat above it is the grand one - and only
        // where the house actually has that shape.
        const grandRung = ladder - 2;
        const hasGrand = grandRung > elderRungOf(ladder);
        let grandTaken = false;

        for (let c = 0; c < climbing.length; c++) {
            const i = c;
            const at = indexById(state.npcs, climbing[c].id);
            if (at < 0) continue;

            // A catalog figure's rank is curated content and the seeder should
            // not argue with the writing - but it does not get to claim the
            // seat either. The top of a ladder goes to whoever actually came
            // out strongest, which is the one thing this pass exists to
            // enforce, so a curated rank is honoured as a FLOOR everywhere
            // except the top rung.
            const curated = state.npcs[at].tags.some(t => t.startsWith('catalog:'));
            let assigned = i === 0
                ? ladder - 1
                : curated
                    ? Math.min(Math.max(state.npcs[at].factionRankIndex, derived[i]), Math.max(0, ladder - 2))
                    : derived[i];

            // One spot only, and it is never taken by the overflow of a lower
            // rung: a second arrival stands at the elder rung instead.
            if (hasGrand && assigned === grandRung && i !== 0) {
                if (grandTaken) assigned = elderRungOf(ladder);
                else grandTaken = true;
            }
            state.npcs[at] = { ...state.npcs[at], factionRankIndex: assigned };
        }

        // The faction's real power is its strongest member, whatever the
        // catalog hoped for - and it has to be somebody who can practise what
        // the house teaches, or the house is being priced on a servant.
        const head = climbing[0];
        const strongest = head.cultivation.realmOrdinal;
        faction.resources.power_ordinal = strongest;
        if (cf && strongest < cf.powerOrdinal - 3) {
            faction.tags = faction.tags.concat('underpowered');
            appendWorldFact(state, makeFact({
                day: presentDay,
                kind: 'succession',
                scale: 'local',
                summary:
                    `The ${faction.name} is held by ${head.name}, who is weaker than the seat ` +
                    `has historically wanted. Nobody says so where it can be heard.`,
                // The person the summary is about, as an id. It used to be a
                // name inside a sentence, which is a fact nothing could join.
                actors: [{ id: head.id, name: head.name, role: 'holder' }],
                factionIds: [faction.id],
                visibility: 'faction',
                magnitude: 0.35,
                data: { strongest }
            }));
        }

        // The people at the top know each other, and the ones passed over know
        // who passed them.
        const leader = head;
        for (let i = 1; i < Math.min(members.length, 5); i++) {
            // The head is whoever can actually practise the road, which is not
            // always the strongest body in the building - so skip them here
            // rather than handing them a rivalry with themselves.
            if (members[i].id === leader.id) continue;
            const at = indexById(state.npcs, members[i].id);
            if (at < 0) continue;
            state.npcs[at] = upsertRelationship(state.npcs[at], {
                targetId: leader.id,
                targetName: leader.name,
                kind: i === 1 ? 'rival' : 'ally',
                standing: i === 1 ? -0.25 : 0.3,
                note: i === 1 ? 'Was the other candidate.' : 'Serves under.'
            }, presentDay);
            andTheOtherEnd(state.npcs, members[i], { targetId: leader.id, kind: i === 1 ? 'rival' : 'ally', standing: 0 }, presentDay,
                i === 1 ? { standing: -0.25, note: 'Was the other candidate.' } : { standing: 0.3, note: 'Under them in the house.' });
        }
    }
}

/** What this person is actually trying to do. Five fields, from their situation. */
function goalFor(
    npc: NpcRecord,
    region: CatalogRegion,
    rng: CultivationRNG
): Parameters<typeof addGoal>[1] {
    const ordinal = npc.cultivation.realmOrdinal;
    const stuck = ordinal >= region.localCeilingOrdinal - 1;
    const options: Parameters<typeof addGoal>[1][] = [
        {
            kind: 'cultivation',
            text: stuck
                ? `Get out of ${region.name} to somewhere the qi will carry them further.`
                : 'Advance a rank.',
            priority: stuck ? 0.8 : 0.55,
            progress: stuck ? 'Has worked out that the province is the problem.' : '',
            obstacles: stuck ? ['No money, no invitation, and nowhere to go.'] : ['Time.']
        },
        {
            kind: 'wealth',
            text: 'Put together enough spirit stones to stop worrying about food.',
            priority: 0.45,
            obstacles: ['Everything here is already owned.']
        },
        {
            kind: 'status',
            text: 'Be taken seriously by somebody who matters locally.',
            priority: 0.5,
            obstacles: ['Nobody has heard of them.']
        },
        {
            kind: 'survival',
            text: 'Live long enough to see a grandchild.',
            priority: 0.6,
            obstacles: ['A realm that does not extend a lifespan much.']
        },
        {
            kind: 'discovery',
            text: 'Find out what is actually inside the sealed ground nearby.',
            priority: 0.4,
            obstacles: ['It was sealed by people much stronger.']
        }
    ];
    return options[rng.int(0, options.length - 1)];
}

// ─────────────────────────────────────────────────────────────────────────
// LINEAGES
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// OPPORTUNITIES AND THE SCHEDULE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Windows that were already going to open and close whether or not the player
 * turned up.
 */
function seedOpportunities(
    state: WorldState,
    catalog: WorldCatalog,
    regions: Map<string, LocationRecord>,
    presentDay: number
): OpportunityWindow[] {
    const out: OpportunityWindow[] = [];

    for (const cf of catalog.factions) {
        if (!cf.recruits) continue;
        const rng = forStream(state.seed, 'seed-recruit', cf.id);
        const opp = makeOpportunity({
            id: `opp-recruit-${cf.id}`,
            kind: 'recruitment',
            name: `admission to the ${cf.name}`,
            summary: `The ${cf.name} looks at applicants once a year.`,
            factionIds: [cf.id],
            opensOnDay: presentDay + rng.int(0, 364),
            durationDays: rng.int(7, 30),
            recurrenceDays: years(1),
            requirements: {
                attempt: 0,
                survive: 0,
                succeed: cf.admissionOrdinal,
                understand: 0,
                force: cf.powerOrdinal
            },
            tags: ['recruitment']
        });
        state.opportunities.push(opp);
        out.push(opp);
    }

    for (const region of catalog.regions) {
        const loc = regions.get(region.id);
        if (!loc) continue;
        const rng = forStream(state.seed, 'seed-opp', region.id);

        const seam = makeOpportunity({
            id: `opp-seam-${region.id}`,
            kind: 'realm_opening',
            name: `the sealed ground under ${region.name}`,
            summary: 'A pocket nothing has drawn on. It is not always reachable.',
            locationId: loc.id,
            opensOnDay: presentDay + rng.int(0, years(60)),
            durationDays: rng.int(10, 40),
            recurrenceDays: years(rng.int(40, 120)),
            requirements: {
                attempt: Math.max(0, region.localCeilingOrdinal - 8),
                survive: Math.max(0, region.localCeilingOrdinal - 4),
                succeed: region.localCeilingOrdinal,
                understand: region.localCeilingOrdinal,
                force: MAX_ORDINAL
            },
            tags: ['sealed', 'rare']
        });
        state.opportunities.push(seam);
        out.push(seam);

        const harvest = makeOpportunity({
            id: `opp-harvest-${region.id}`,
            kind: 'resource',
            name: `the ${withoutArticle(region.name)} ripening`,
            summary: `What ${region.name} exports is worth gathering for a few weeks a year.`,
            locationId: loc.id,
            opensOnDay: presentDay + rng.int(0, 364),
            durationDays: rng.int(10, 25),
            recurrenceDays: years(1),
            requirements: { attempt: 0, survive: 0, succeed: 0, understand: 0, force: 0 },
            tags: ['harvest']
        });
        state.opportunities.push(harvest);
        out.push(harvest);
    }

    return out;
}

/**
 * Grant renewals.
 */
function seedGrantSchedule(
    state: WorldState,
    catalog: WorldCatalog,
    presentDay: number
): ScheduledEffect[] {
    const out: ScheduledEffect[] = [];

    for (const cf of catalog.factions) {
        if (cf.governance !== 'federated' || cf.renewalYears <= 0) continue;
        const rng = forStream(state.seed, 'seed-grant', cf.id);
        const first = presentDay + rng.int(0, years(cf.renewalYears));
        // Booked through `schedule()`, whose contract this is: a first renewal
        // drawn for the opening day itself is due the day after, which is the
        // first day the clock can fire it on.
        const booked = schedule(state, {
            kind: 'assessment',
            dueOnDay: first,
            summary: `The ${cf.name}'s grant on its vein comes up for renewal.`,
            factionId: cf.id,
            repeatDays: years(cf.renewalYears),
            // Renewal is close to automatic, and the rare failure is the whole
            // point of holding a vein on somebody else's terms.
            chance: 1,
            data: { kind: 'grant_renewal', factionId: cf.id, magnitude: 0.4 }
        });
        Object.assign(state, booked.state);
        out.push(booked.effect);
    }

    return out;
}

// ─────────────────────────────────────────────────────────────────────────
// REPORTING
// ─────────────────────────────────────────────────────────────────────────

/** Living NPCs per realm tier, lowest first. Nine buckets, one per realm. */
export function histogram(state: WorldState): number[] {
    const tiers = [0, 13, 17, 21, 25, 29, 33, 37, 41, 45];
    const out = new Array(tiers.length - 1).fill(0);
    for (const npc of state.npcs) {
        if (npc.status !== 'alive') continue;
        const o = npc.cultivation.realmOrdinal;
        for (let i = 0; i < out.length; i++) {
            if (o >= tiers[i] && o < tiers[i + 1]) {
                out[i]++;
                break;
            }
        }
    }
    return out;
}

/** Convenience for callers that want a live world without touching the adapter. */
export function livingPopulation(state: WorldState): number {
    let n = 0;
    for (const npc of state.npcs) if (npc.status === 'alive') n++;
    return n;
}

void lifespanForOrdinal;
