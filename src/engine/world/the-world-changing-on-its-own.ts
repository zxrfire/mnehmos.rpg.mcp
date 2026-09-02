/**
 * Pressure: the world changing on its own.
 *
 * This is the driver the world layer was missing. Seeding produces a populated
 * world; `advanceTime` moves the clock and fires what was already on the books;
 * neither of them makes anything NEW happen. Without this module a player sits
 * in seclusion for forty years, comes out, and finds that the only thing that
 * occurred is that some old people died of old age.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE LINE THIS MODULE HOLDS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * It schedules THAT SOMETHING HAPPENED. It does not decide WHY anyone did it.
 *
 *   in scope      a sect loses a vein; an elder dies; a ruin is opened by
 *                 somebody else; a border moves; a deference zone is tested; a
 *                 faction folds; a war opens and, years later, settles
 *   out of scope  what the elder was thinking; whether the rival was right to
 *                 move; what anybody says about it afterwards
 *
 * The first list is weighted tables, seeded rolls and state updates, which is
 * code's job. The second is the LLM's, and it reads the resulting facts and
 * reasons from them. There is deliberately no personality model, no incentive
 * scoring and no decision tree here - that engine was written once, deleted on
 * purpose, and is not coming back.
 *
 * ── Binding to real things ───────────────────────────────────────────────
 *
 * Every template BINDS before it applies. `vein_lost` does not invent a vein:
 * it looks for a faction that actually holds one and a rival that actually
 * wants it, and if the world does not currently offer that pair, the template
 * declines and another is drawn. So the events that happen are the ones the
 * world's own state makes available, and a province with one faction left stops
 * producing sect wars because there is nobody to fight.
 *
 * ── Every event writes real state ────────────────────────────────────────
 *
 * A vein changing hands moves `controllingFactionId`, appends a
 * `LocationChange`, moves both treasuries, and deepens the standing between the
 * two factions - and only then writes the chronicle fact. Narration describes a
 * state change that actually happened, or there was no event.
 *
 * ── Determinism ──────────────────────────────────────────────────────────
 *
 * Keyed per YEAR, from `forStream(seed, 'pressure', year)`. The events of year
 * 1,412 are the same whether the simulation reached it in one advance or forty,
 * which is what keeps the split-advance property true once the driver is in the
 * loop.
 */

import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import { rankName, triggersHeavenlyTribulation } from '../cultivation/realms.js';
// Pressure is the LOWER world's own affairs, and only its own. Every selection
// in this file is filtered to the mortal layer, because politics above the Lid
// has been running uninterrupted for a very long time and is not something this
// module gets to reorganise on a fifty-five-events-per-century budget. The far
// side is `advanceImmortalLayer`, which the driver runs on the same slice.
import { IMMORTAL_LAYER, isBelowTheLid } from './layers.js';
import {
    FALSE_IMMORTAL_ORDINAL,
    LAST_CROSSING_ORDINAL,
    TRUE_IMMORTAL_ORDINAL,
    baseBreakthroughChance,
    lifespanForOrdinal,
    realmForOrdinal
} from '../cultivation/realms.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import {
    fillConsequences,
    makeFact,
    yearOfDay,
    type EventConsequences,
    type HistoricalFact
} from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { recordCrossing } from './recording-what-a-crossing-did.js';
import { recordPromotion } from './recording-where-somebody-stands-in-a-house.js';
import {
    applyLocationChange,
    forbidZone,
    nextClosingDay,
    nextOpeningDay,
    qiFraction,
    type LocationRecord
} from './locations.js';
import { runCascade } from './cascade.js';
import { ruinFromFallenSeat } from './provenance.js';
import { claimOpportunity, nextWindow, years } from './opportunities.js';
import {
    activeGoals,
    addGoal,
    createNpc,
    isTheWorldsToMove,
    markDead,
    markMissing,
    relationshipWith,
    setRealm,
    upsertRelationship,
    type NpcRecord
} from './npc-state.js';
import {
    haveTheyWorkedItOut,
    resolveAttempt,
    whatTheyDoAboutIt,
    type AskWeight
} from '../social-leverage/index.js';
import { addLineageEdge, createLineageRecord } from './lineage.js';
import { whoAHouseWillTake } from '../../data/cultivation/the-three-floors-a-house-admits-at.js';
import { bloodlineForChild } from './hunting-a-spirit-beast.js';
import {
    canBeTheTwoParentsOf
} from '../birth/what-sex-somebody-is-and-what-it-is-for.js';
import { applyRuinProspecting } from './how-the-world-keeps-finding-more-ruins.js';
import { repairRetiredWoundKeys } from './recording-the-day-a-wound-was-taken.js';
import { deriveOrdinal } from './seeding.js';
import {
    guideOrdinalFor,
    readyToStrike,
    strikeAtTheWall
} from './an-npc-striking-at-the-next-wall.js';
import { standsOnAnUnreachableClock } from './who-sits-in-the-hollow-court.js';
import { getOrigin } from '../cultivation/origin.js';
import {
    groundRateAt, groundTimeShares, houseFallbackRate, rateOverTheYear, roomsHeldBy,
    type GroundClaimant
} from './the-ground-somebody-is-actually-standing-on.js';
import { manualQualityRank } from '../cultivation/manual-quality.js';
import {
    applyRoadsComprehended,
    roadsInReachOf
} from './how-a-cultivator-comes-by-a-road.js';
import type { AmbientQi, ApproachLeverage } from '../../schema/cultivation.js';
import {
    applyManualCopying,
    newlyEntitled, refreshChosen, reachableCeilingFor,
    mightFindARoad, roadTheyFound, librariesCarriedOutBy, BOOKLESS_CEILING
} from './manuals.js';
import { assessPromotions } from './promotion-inside-a-house.js';
import {
    applyOrdinaryLifeTies,
    applyPassedOver,
    bindNewbornToHousehold,
    couldParent,
    rosterOf,
    type Roster
} from './the-ties-an-ordinary-life-produces.js';
import {
    assessTheReturn,
    fosterTheChild,
    isConcealed,
    wasFostered,
    whoCouldBeAsked,
    whyTheirOwnHouseWillNotKeepThem,
    type FosterCandidate,
    type FosteringReason
} from './a-child-their-own-house-will-not-keep.js';
import { shameTag } from '../social/shame.js';
import { fosterageTermsOf } from '../../data/cultivation/sects.js';
import type { OriginTierKey } from '../cultivation/origin.js';
import { applyGatherings } from './gatherings.js';
import {
    postingFor,
    reasonsOpenTo,
    resolveSending,
    newsOfASending,
    isImpossibleTier,
    partyOrdinal,
    tierFor,
    whoTheHouseCanSend,
    type Candidate,
    type HouseAsItStands
} from './who-goes-out-for-a-house-and-what-comes-back.js';
import {
    CONVEYANCE_RECIPES,
    adjustCountedHolding,
    countedHolding,
    requireConveyance
} from '../../data/cultivation/what-a-house-moves-its-people-on.js';
import {
    conveyanceKeptAs,
    deliver,
    launch,
    layDownKeel,
    mintCraft,
    readyToLaunch,
    workOn,
    type Berth,
    type MaterialLot
} from './building-a-conveyance-out-of-what-a-hunt-brings-back.js';
import { canRefineGrade } from '../cultivation/who-can-refine-a-grade-of-medicine.js';
import { BEAST_CORE_ORDINAL } from '../../data/cultivation/beasts.js';
import { gradeForOrdinal } from '../../data/cultivation/techniques.js';
import { STOCK_GRADES } from './what-a-place-still-has-in-the-ground.js';
import type { TechniqueGrade } from '../../schema/cultivation.js';
import {
    recordGroundDraw,
    whatThePeopleHereTake
} from './what-a-place-still-has-in-the-ground.js';
import {
    statusKey,
    whatIsWrongWithPlacesToday,
    type GroundAsItStands
} from './what-goes-wrong-with-a-place-and-what-ends-it.js';
import {
    extendStatus,
    liftStatus,
    makeAreaStatus,
    type AreaStatus
} from './what-is-true-of-a-place-right-now.js';
import { settleNpcDeath, type DeathHandoff } from './time.js';
import {
    makeFaction,
    type FactionRecord,
    type ScheduledEffect,
    type WorldState
} from './world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// SHAPE
// ─────────────────────────────────────────────────────────────────────────

export type PressureKind =
    /**
     * A house is ended by another house, and then the survivors choose.
     *
     * The one template that does not resolve in a single step: it hands off to
     * `cascade.ts`, which runs a chain of forced choices out to its end. The
     * chain usually stops at the first link, because doing nothing is on every
     * table and is usually the heaviest entry on it. When it does not, the map
     * is permanently different afterwards.
     */
    | 'house_destroyed'
    /**
     * Something sealed came open on its own schedule, with nobody's intent
     * behind it.
     *
     * Not drawn from the table at all - see `applyConvergences`. A window that
     * only opens when the year's event budget happens to allow it is not a
     * schedule, and the whole point of this one is that the world does it
     * whether or not anybody is watching or interested.
     */
    | 'convergence_opened'
    | 'convergence_closed'
    /**
     * The chosen of allied houses met, and something came of it.
     *
     * Not in TEMPLATES either, and for the same reason as `convergence_opened`:
     * a circle's calendar is a property of the circle, not of how eventful the
     * year happened to be. `gatherings.ts` owns everything about it and this
     * module only calls it, on the same yearly line as advancement and
     * recruitment.
     */
    | 'gathering'
    | 'vein_lost'
    | 'elder_died'
    | 'killing'
    | 'ruin_opened'
    | 'opportunity_taken'
    | 'border_moved'
    | 'deference_tested'
    | 'faction_fell'
    | 'faction_founded'
    | 'technique_lost'
    | 'market_shifted'
    | 'war_opened'
    | 'war_settled'
    | 'zone_forbidden'
    | 'migration'
    | 'disappearance'
    /**
     * Somebody worked on somebody: a purse, a house's weight, an account, or
     * nothing but themselves, put down in front of a person to get something
     * out of them.
     *
     * Here rather than only on the player's side because the reverse is this
     * repo's commonest defect. The identical resolver in
     * `engine/social-leverage/` runs on both.
     */
    | 'leverage_applied'
    /**
     * And years later, the other party understood what it had been for.
     *
     * Its own event and not a side effect of the one above, because the years
     * in between are the whole of what makes it worth anything: being turned
     * down is an embarrassment, and being used and finding out afterwards is
     * what opens a grudge somebody's grandchildren are still carrying.
     */
    | 'leverage_understood';

export interface PressureEvent {
    kind: PressureKind;
    onDay: number;
    fact: HistoricalFact;
    /** Ids of anything whose state this actually moved. */
    touched: { factions: string[]; locations: string[]; npcs: string[] };
    deaths: DeathHandoff[];
}

export interface PressureResult {
    events: PressureEvent[];
    /** Years actually stepped. Zero when the span held no whole year. */
    yearsStepped: number;
    /** People born into the world across the span. */
    born: number;
}

/**
 * Events per year for a world of this size.
 *
 * Scaled off live factions rather than fixed, so a world that has lost most of
 * its institutions goes quiet - which is the correct behaviour and is also what
 * a late age is supposed to feel like.
 */
export const EVENTS_PER_FACTION_YEAR = 0.055;
/** Floor, so even a nearly dead world is not silent. */
export const MIN_EVENTS_PER_YEAR = 0.15;
/** Ceiling, so a large world does not become a newsfeed. */
export const MAX_EVENTS_PER_YEAR = 3;

/**
 * What a house feels toward the people who just embarrassed its rival.
 *
 * Deliberately just under `gatherings.ts`'s `ALLIED_STANDING` of 0.3. See the
 * comment at the founding template: this is the only positive edge the yearly
 * pass creates between two houses, and it has to be the beginning of an
 * alliance rather than a finished one, so that `settleHouseStanding`'s slow
 * drift has somewhere to take it and a schism does not instantly manufacture a
 * bloc.
 */
export const SYMPATHY_AT_A_SCHISM = 0.25;

export interface PressureOptions {
    /** Multiplier on the event rate. For tests and for tuning. */
    intensity?: number;
    /** Cap on events applied in one call, whatever the span. */
    maxEvents?: number;
}

// ─────────────────────────────────────────────────────────────────────────
// THE PASS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Advance the world's own affairs across a span.
 *
 * Mutates `state` in place. It is called from the driver after the clock has
 * moved, over exactly the span that was actually advanced, so an interrupted
 * seclusion does not get a decade of consequences it never lived through.
 */
export function applyPressure(
    state: WorldState,
    fromDay: number,
    toDay: number,
    opts: PressureOptions = {}
): PressureResult {
    const events: PressureEvent[] = [];
    const intensity = opts.intensity ?? 1;
    const maxEvents = opts.maxEvents ?? 4000;

    const firstYear = yearOfDay(fromDay) + 1;
    const lastYear = yearOfDay(toDay);
    let yearsStepped = 0;
    let born = 0;

    // Worlds are persisted, so retiring a wound key in the catalog does not
    // retire the rows already carrying it. Once per pass rather than per year:
    // it is idempotent and it has nothing to do after the first sweep.
    repairRetiredWoundKeys(state);

    for (let year = firstYear; year <= lastYear && events.length < maxEvents; year++) {
        yearsStepped++;
        const rng = forStream(state.seed, 'pressure', year);

        // People go out looking, and sometimes they find something the Late
        // Age left. BEFORE the event draw, so a ruin found this year is a ruin
        // this year's `ruin_opened` can open - discovery and opening are two
        // stages of one thing and the ordering is what makes them separable.
        //
        // This pass is the reason `ruin_opened` no longer runs the world out of
        // ground. See `how-the-world-keeps-finding-more-ruins.ts` for the
        // measured baseline it replaced, which was zero openings per century in
        // the last fifth of a five-thousand-year run, in three seeds of three.
        applyRuinProspecting(state, year, withinSpan(year * 365 + 40, fromDay, toDay));

        const live = state.factions.filter(f => f.dissolvedOnDay === null && isBelowTheLid(f)).length;
        const rate = clamp(
            live * EVENTS_PER_FACTION_YEAR * intensity,
            MIN_EVENTS_PER_YEAR * intensity,
            MAX_EVENTS_PER_YEAR * intensity
        );

        // Whole events plus a fractional chance at one more. Cheap, stable, and
        // it lets a rate below one still produce something occasionally.
        let count = Math.floor(rate);
        if (rng.chance(rate - count)) count++;

        for (let i = 0; i < count && events.length < maxEvents; i++) {
            // The draw is unconditional so the stream does not depend on where
            // the span happens to end; the DATE is clamped, because a fact
            // dated after the world's own clock is incoherent and the soak
            // rightly refuses it.
            const day = withinSpan(year * 365 + rng.int(0, 364), fromDay, toDay);
            const event = fireOne(state, day, forStream(state.seed, 'pressure-event', year, i));
            if (event) events.push(event);
        }

        // Windows open and shut on their own clock, not on the event budget.
        // Deliberately outside the draw loop and outside `maxEvents`: a
        // convergence that only happens when the year had a slot free is not a
        // schedule, and "the world did something, and nobody did it" is the
        // entire content of this one.
        events.push(...applyConvergences(state, year, fromDay, toDay));

        // Then the parts of a year that are arithmetic rather than incident:
        // people advance, institutions pay their bills, and children are born.
        // Births last, so a year's dead are counted before its replacements.
        // The ground under everybody, worked for a year by the people standing
        // on it. FIRST of the arithmetic passes, so what a place has left is
        // true of it before anybody advances, is recruited or is born onto it.
        //
        // This is the writer the depletion model never had. See
        // `whatThePeopleHereTake`: every call site in the game asks the ground
        // for ONE unit against a band that regrows forty-four over the same
        // span, so mortal stock could not fall by any actor and a thousand
        // world-years produced no worked-out band anywhere.
        applyGroundPressure(state, withinSpan(year * 365 + 60, fromDay, toDay));
        // Wars that reached the day they were scheduled to end. BEFORE the
        // statuses, so a war that ended this year is a road open this year.
        events.push(...settleWarsThatAreOver(state, withinSpan(year * 365 + 62, fromDay, toDay)));
        // And then what is WRONG with the places that ground is under. After
        // the pressure, so a district worked out this year is a district its
        // holder can close this year - the count is the cause and the closing
        // is the consequence, and they are one year apart only if the ordering
        // says so.
        applyAreaStatuses(state, year, withinSpan(year * 365 + 65, fromDay, toDay));
        applyResettlement(state, year, withinSpan(year * 365 + 70, fromDay, toDay));
        applyFoundRoads(state, year, withinSpan(year * 365 + 80, fromDay, toDay));
        applyPromotions(state, withinSpan(year * 365 + 90, fromDay, toDay));
        // Somebody who mastered an art writes it out for the people coming up
        // behind them. BEFORE the handout, so a copy written this year is a
        // copy somebody can be given this year - and before advancement, so the
        // ceiling it raises is the ceiling this year's review reads. See
        // `applyManualCopying`: it is the only thing in the engine that puts a
        // book back into circulation, and the only route to the top of the
        // ladder that runs through a person rather than through luck.
        applyManualCopying(state, year, withinSpan(year * 365 + 95, fromDay, toDay));
        applyBookAcquisition(state, year, withinSpan(year * 365 + 100, fromDay, toDay));
        // Ground gets dug open, a material comes out of a hole, and a house
        // spends one of the things it can never replace on the disciple who is
        // standing at a wall they cannot pass for want of a road. BEFORE
        // advancement for the same reason manual copying is: a road come by
        // this year is a road this year's crossing can stand on.
        // See `how-a-cultivator-comes-by-a-road.ts`.
        applyRoadsComprehended(state, year, withinSpan(year * 365 + 110, fromDay, toDay));
        applyAdvancement(state, year, withinSpan(year * 365 + 120, fromDay, toDay));
        // And the one answer a fostered person ever gets, on their own sending
        // house's terms. AFTER advancement, so a rung reached this year is a
        // rung the assessment reads; before recruitment, so somebody who went
        // back is on the right roll when the year's admissions run.
        applyFosterageReturns(state, withinSpan(year * 365 + 130, fromDay, toDay));
        applyRecruitment(state, year, withinSpan(year * 365 + 150, fromDay, toDay));
        // And then the people those two passes produced meet each other. After
        // books and after recruitment, so a chosen named this year can be sent
        // this year rather than waiting a turn of the clock; before the economy,
        // so the house that hosted pays for it out of the same year's purse.
        for (const held of applyGatherings(
            state, year, withinSpan(year * 365 + 160, fromDay, toDay)
        )) {
            events.push({
                kind: 'gathering',
                onDay: held.onDay,
                fact: held.fact,
                touched: {
                    factions: held.factionIds,
                    locations: held.locationId ? [held.locationId] : [],
                    npcs: held.attendeeIds
                },
                deaths: []
            });
        }
        // And then the ties an ordinary life produces, on the same yearly line.
        //
        // AFTER recruitment and books, because a teaching line binds a student
        // to whoever in their house can actually carry them and both of those
        // passes decide who that is. BEFORE demography, so a household formed
        // this year is a household a child can be born into this year rather
        // than next. See `the-ties-an-ordinary-life-produces.ts` for what each
        // of these is a by-product of - none of them is a new subsystem, and
        // every one writes a row the world already had the state for.
        applyOrdinaryLifeTies(state, year, withinSpan(year * 365 + 170, fromDay, toDay));
        applyFactionEconomy(state);
        // And then the house spends some of what it just counted on putting
        // people on the road. AFTER the economy, so a house buys the carriage
        // out of the purse this year filled, and after recruitment, so
        // somebody admitted this year can be on the party.
        applySendings(state, year, withinSpan(year * 365 + 175, fromDay, toDay));
        // And the yard works on what the last party brought home. AFTER the
        // sendings, so material that came back this year is material this
        // year's work can go into - a hull is a schedule, and a house hunts
        // for it the whole time it is building it.
        applyConveyanceBuilding(state, year, withinSpan(year * 365 + 178, fromDay, toDay));
        born += applyDemography(state, year, withinSpan(year * 365 + 180, fromDay, toDay), rng).length;
        // The longest project in the world, on its own clock. It will almost
        // never fire in five hundred years, and that is the point of it.
        applyLastCrossing(state, year, withinSpan(year * 365 + 200, fromDay, toDay));
    }

    return { events, yearsStepped, born };
}

// ─────────────────────────────────────────────────────────────────────────
// WHERE PEOPLE ARE
//
// A region is a container. Nobody stands in one, and `npcsAt` matches on an
// exact `locationId`, so anything placed on a region node is placed nowhere
// anybody can meet it.
//
// This was placing every newborn there, and the result was a province that
// hollowed out while its headcount held steady. Measured over a seeded,
// advanced world:
//
//   day 0   Sweptground 25   Low Fall 30   Kettle 14   Sixmile 13
//   +20y    Sweptground 18   Low Fall 18   Kettle  6   Sixmile  6
//   +50y    Sweptground  7   Low Fall  4   Kettle  0   Sixmile  1
//
// Total alive held at about 350 the whole time - nobody was dying off. "The
// Quiet Marches (region)" went from 39 to 170 over the same span. Every
// settlement was draining into a node nobody can walk into, and the encounter
// system draws its cast from who is present, so the end state is person-free
// events forever.
//
// The two helpers below are the fix, and they are also the fix for a second
// bug of the same shape: three separate filters compared things to `region.id`
// - a newborn's home, a parent's whereabouts, and a faction's seat. All three
// wanted "under this region", and none of them said so.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The region a location sits in, or itself when it is one.
 *
 * Walks the parent chain with a visited guard, so a cycle introduced by a bad
 * patch returns an answer instead of hanging a five-century soak.
 */
function regionOf(state: WorldState, locationId: string | null): string | null {
    let cursor = locationId;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
        seen.add(cursor);
        const location = state.locations.find(l => l.id === cursor);
        if (!location) return null;
        if (location.kind === 'region' || location.parentId === null) return location.id;
        cursor = location.parentId;
    }
    return null;
}

/** Every location id at or beneath this one. Containers included. */
function locationIdsUnder(state: WorldState, regionId: string): Set<string> {
    const under = new Set<string>([regionId]);
    // Two passes is enough for region -> place, and the loop is bounded by the
    // location count so a malformed parent chain cannot hang the world tick.
    for (let pass = 0; pass < state.locations.length; pass++) {
        let grew = false;
        for (const location of state.locations) {
            if (location.parentId && under.has(location.parentId) && !under.has(location.id)) {
                under.add(location.id);
                grew = true;
            }
        }
        if (!grew) break;
    }
    return under;
}

/**
 * Somewhere in this region a person can actually be born.
 *
 * Habitability is read off columns that already exist rather than a new tag:
 *
 *   kind        a settlement, or ground a house holds. Not a vein, a ruin, a
 *               scar or a region node - nobody lives in any of those.
 *   thresholds  survivable by a newborn, which means at ordinal zero. The same
 *               `survival` bar everything else reads, so a place calibrated
 *               for Nascent Soul does not quietly acquire villagers.
 *   sealed      a sealed pocket has no births in it, by definition.
 */
function birthplacesIn(state: WorldState, region: LocationRecord): LocationRecord[] {
    const under = locationIdsUnder(state, region.id);
    return state.locations.filter(l =>
        l.id !== region.id &&
        under.has(l.id) &&
        (l.kind === 'settlement' || l.kind === 'sect_seat') &&
        !l.sealed &&
        l.thresholds.entry <= 0 &&
        l.thresholds.survival <= 0 &&
        populationWeightOf(l) > 0
    );
}

/**
 * How many people a place holds, relative to the others.
 *
 * Set at seeding from the settlement kind the gazetteer already carries, and
 * read here. The draw HAS to be weighted: there are far more houses in the
 * catalog than there are towns, so drawing uniformly over habitable children
 * put 61% of the living world inside a compound within a hundred and fifty
 * years. A city is not a hamlet and a sect's ground is a household.
 *
 * Defaults to 1 rather than 0, so a location seeded before this column existed
 * still receives people instead of silently becoming uninhabitable.
 */
function populationWeightOf(location: LocationRecord): number {
    const raw = Number(location.data.populationWeight ?? 1);
    return Number.isFinite(raw) && raw >= 0 ? raw : 1;
}

/** Weighted draw over birthplaces. Seeded, so a world replays identically. */
function drawBirthplace(
    places: readonly LocationRecord[],
    rng: CultivationRNG
): LocationRecord | null {
    if (places.length === 0) return null;
    const total = places.reduce((sum, l) => sum + populationWeightOf(l), 0);
    if (total <= 0) return places[rng.int(0, places.length - 1)];
    let cursor = rng.next() * total;
    for (const place of places) {
        cursor -= populationWeightOf(place);
        if (cursor < 0) return place;
    }
    return places[places.length - 1];
}

/**
 * People keep being born.
 *
 * Not a weighted event - a steady demographic floor, run every year, closing
 * the gap between the living population and what the world can carry. Without
 * it five centuries produce an empty province and a set of factions that folded
 * for want of members, which is a modelling artefact rather than history.
 *
 * They are born IN A PLACE - a village, a market town, the ground a house
 * holds - and never on the region node that contains those. See the block
 * above for what happened while they were.
 *
 * Newcomers are generated exactly the way everybody else is: root and
 * attributes rolled from the world seed, realm DERIVED from those inputs over
 * the years they have lived, capped by the province they were born in. Where a
 * living parent is available they are attached to that lineage, which is what
 * makes a descendant three centuries later something the world can point at.
 */
function applyDemography(
    state: WorldState,
    year: number,
    day: number,
    rng: CultivationRNG
): NpcRecord[] {
    const target = state.populationTarget;
    if (target <= 0) return [];

    let living = 0;
    for (const npc of state.npcs) if (npc.status === 'alive' && isBelowTheLid(npc)) living++;
    const deficit = target - living;
    if (deficit <= 0) return [];

    // A fraction of the gap each year, so a plague is felt for a generation
    // rather than papered over the following spring.
    const count = Math.min(24, Math.max(1, Math.round(deficit * 0.08)));
    const regions = state.locations.filter(l => l.kind === 'region' && isBelowTheLid(l));
    if (regions.length === 0) return [];

    // One walk of the roster for the whole cohort. Without it every birth in
    // the year re-scanned `state.npcs`, which holds the dead as well and is
    // four thousand records deep by year five hundred.
    const roster = rosterOf(state);

    const born: NpcRecord[] = [];
    for (let i = 0; i < count; i++) {
        const id = `npc-${state.nextNpcSeq++}`;
        const own = forStream(state.seed, 'birth', id);
        const region = regions[own.int(0, regions.length - 1)];
        const age = own.int(16, 22);

        // A place, not the container - and never the container.
        //
        // This used to fall back to the region node when a province had nowhere
        // habitable left, described as a loud last resort. It was loud, and it
        // was also wrong: sealings and rising thresholds empty a province's
        // habitable list over centuries, so past a few hundred years EVERY birth
        // in that province landed on its container. Measured, the count of
        // people standing on containers fell 243 -> 14 by year 250 and then
        // climbed to 265 by year 600, which is not a last resort firing, it is
        // the normal path.
        //
        // People are born where people can live. So the province is chosen from
        // the ones that HAVE somewhere, and if nowhere in the world does, then
        // no child is born - which is the honest reading of a world with no
        // habitable ground left, and is far louder than quietly stacking a
        // generation onto a map node nobody can stand on.
        const habitable = birthplacesIn(state, region);
        const somewhere = habitable.length > 0
            ? { region, places: habitable }
            : (() => {
                for (const alt of regions) {
                    const places = birthplacesIn(state, alt);
                    if (places.length > 0) return { region: alt, places };
                }
                return null;
            })();
        if (!somewhere) break;
        const home = drawBirthplace(somewhere.places, own) ?? somewhere.places[0];
        const under = locationIdsUnder(state, somewhere.region.id);
        // Read off the province they are actually born in, not the one first
        // drawn - a child born in the next province over grows up under its
        // ceiling and its ground.
        const ceiling = Number(somewhere.region.data.localCeilingOrdinal ?? 20);
        const rateMultiplier = Number(somewhere.region.data.ambientRateMultiplier ?? 1);

        let npc = createNpc(state.seed, {
            id,
            bornOnDay: day - years(age),
            onDay: day,
            locationId: home.id,
            occupation: 'unknown',
            // Two people with one name breaks the knowledge system, which is
            // keyed by id while everything the player reads is keyed by name.
            takenNames: new Set(state.npcs.map(n => n.name)),
            tags: [`region:${String(somewhere.region.data.catalogRegionId ?? somewhere.region.id)}`]
        });
        const ordinal = deriveOrdinal(
            npc.cultivation.spiritRoot,
            npc.cultivation.attributes,
            age,
            rateMultiplier,
            ceiling,
            own
        );
        npc = setRealm(npc, ordinal, day);
        npc = addGoal(npc, {
            kind: 'cultivation',
            text: 'Get somewhere. Anywhere.',
            priority: 0.5,
            obstacles: ['Born here.']
        }, day);

        // A parent, where the world has one to offer: same region, old enough,
        // and alive. Lineage is what long time-skips land on.
        //
        // This said `n.locationId === region.id`, which was only ever true of
        // the cohort the placement bug had parked on the container. Once births
        // land in real settlements that filter matches nobody and every child
        // is born without a surname or a line - so the same bug would have
        // silently taken lineage with it. It is the region, not the node.
        //
        // AND A HOUSEHOLD, NOT ONLY A LINEAGE EDGE.
        //
        // This wrote the edge and threw the person away, so a world could hold
        // four hundred descendants and zero families: after 120 years and 498
        // living people the entire world held 0 kin ties, 0 spouse ties and 6
        // friendships, and every absence run against it reported nothing to
        // lose. The edge is the bloodline; the ties are the people, and the
        // absence pass reads the ties.
        //
        // The parent is drawn from the child's OWN PLACE where the place has
        // anybody eligible, and only falls back to the province when it does
        // not. A household is people who live together, and a parent two days'
        // walk away is not one - it also breaks every consumer that asks who
        // was standing near somebody when they disappeared. `couldParent` is
        // the eligibility, and it caps how many children one person can be the
        // parent of, because an unbounded draw over three centuries makes a
        // long-lived cultivator the parent of forty people.
        const oldEnough = (n: NpcRecord) => day - n.identity.bornOnDay >= years(age + 18);
        const here = couldParent(
            roster.living.filter(n => oldEnough(n) && n.locationId === home.id), age, day);
        const candidates = here.length > 0
            ? here
            : couldParent(
                roster.living.filter(n =>
                    oldEnough(n) && n.locationId !== null && under.has(n.locationId)), age, day);
        const parent = candidates.length > 0
            ? candidates[own.int(0, candidates.length - 1)]
            : null;
        if (parent) {
            // ── WHAT THE LINE COMES TO IN THIS CHILD ─────────────────────
            //
            // `bloodlineTierForChild` was argued out in detail, tested, and had
            // NO WRITER ANYWHERE. Nothing in the world ever put an `AbilityTier`
            // on a person, so it returned null for everybody alive and the whole
            // half of the design that rests on it - dilution, the clan that will
            // not marry out, the clan pricing its own decay, the child who runs
            // - could not occur. This is the writer.
            //
            // Both parents, and the second one is where the parentage field
            // earns its place: a household is whoever two people are, and the
            // two who could have had this child between them is a narrower
            // question. Where the household's other half is not one of them the
            // child has one blood parent as far as the world knows, which is
            // the ordinary case for most of the population anyway - and a line
            // with one carrier steps down, which is exactly right.
            //
            // Nothing here decides the ladder. `bloodlineForChild` reads both
            // parents and nothing else, there is no dilution constant, and a
            // child of two carriers holds the line because there are two of it.
            const spouseTie = parent.relationships.find(r => r.kind === 'spouse');
            const spouseAt = spouseTie ? roster.at.get(spouseTie.targetId) : undefined;
            const spouse = spouseAt === undefined ? null : state.npcs[spouseAt];
            const otherBloodParent = spouse
                && canBeTheTwoParentsOf(parent.identity.sex, spouse.identity.sex)
                ? spouse
                : null;
            const line = bloodlineForChild(
                parent.identity.bloodline,
                otherBloodParent?.identity.bloodline ?? null
            );
            if (line !== null || npc.identity.bloodline !== null) {
                npc = { ...npc, identity: { ...npc.identity, bloodline: line } };
            }

            const surname = parent.name.split(' ')[0];
            npc = { ...npc, name: `${surname} ${npc.name.split(' ').slice(1).join(' ')}`.trim() };
            const lineageId = `lin-${surname.toLowerCase()}`;
            let lineage = state.lineages.find(l => l.id === lineageId);
            if (!lineage) {
                lineage = createLineageRecord({
                    id: lineageId,
                    surname,
                    founderId: parent.id,
                    foundedOnDay: parent.identity.bornOnDay
                });
                state.lineages.push(lineage);
            }
            const next = addLineageEdge(lineage, {
                parentId: parent.id,
                childId: npc.id,
                relation: 'descendant',
                onDay: npc.identity.bornOnDay
            });
            const at = state.lineages.findIndex(l => l.id === lineageId);
            if (at >= 0) state.lineages[at] = next;
        }

        // A faction that takes applicants takes applicants. Without this the
        // rolls only ever shrink: every founding member dies inside two
        // centuries and nobody replaces them, and the institutions fold for a
        // reason that is arithmetic rather than history.
        // Seats moved, and this did not follow them.
        //
        // `f.seatLocationId === region.id` was true while a faction's seat WAS
        // the region node. Sects now hold ground of their own - a `sect_seat`
        // child of the region - so that comparison became false for every
        // faction in the world, `admitting` was always empty, and the rolls
        // could only ever shrink. A regression introduced with the sect-ground
        // work and not caught, because nothing in that suite advanced a world.
        // The question was always "is its seat in this region".
        const admitting = state.factions.filter(
            f => f.dissolvedOnDay === null && isBelowTheLid(f) &&
                f.tags.includes('recruits') &&
                f.seatLocationId !== null && under.has(f.seatLocationId) &&
                ordinal >= Number(f.resources.admission_ordinal ?? 0) &&
                // Same door, same rule. A house that takes one sex does not
                // take the local children of the other one either.
                (whoAHouseWillTake(f.id) ?? npc.identity.sex) === npc.identity.sex
        );
        if (admitting.length > 0 && own.chance(0.45)) {
            const joined = admitting[own.int(0, admitting.length - 1)];
            npc = { ...npc, factionId: joined.id, factionRankIndex: 0 };
        }

        // FOSTERING, before the household is written and after the lineage edge
        // is. A child whose parent's own house will not keep them, or whose
        // birth the household will not own, is placed with somebody the parent
        // personally knows - which is the whole of where they end up, and is
        // decided by the parent's ties rather than by any list.
        //
        // On its own seeded stream, so a world with nobody to foster draws
        // exactly what it drew before this pass existed.
        const fostered = parent
            ? placeAChildTheirHouseWillNotKeep(
                state, npc, parent, ordinal, day, forStream(state.seed, 'fostering', id), roster)
            : null;
        if (fostered) npc = fostered;

        // The household the birth actually created, written last so the child's
        // own record is finished before anybody is bound to it. The parent's
        // half and the siblings' halves go into `state.npcs` in place; the
        // child's half comes back on the record about to be pushed.
        //
        // NOT WRITTEN FOR A FOSTERED CHILD, and that omission is the mechanic
        // rather than a gap. The lineage edge above stands - blood is blood,
        // and an heir still inherits down it - while the personal `parent` tie
        // does not, because the two of them never met and the child is not told
        // whose they are. Somebody can therefore inherit a grudge from a parent
        // whose name they do not hold, which needed no new field to say.
        if (parent && !fostered) {
            npc = bindNewbornToHousehold(state, npc, parent.id, day, roster).child;
        }

        roster.at.set(npc.id, state.npcs.length);
        roster.living.push(npc);
        state.npcs.push(npc);
        born.push(npc);
    }
    void rng;
    void year;
    return born;
}

// ─────────────────────────────────────────────────────────────────────────
// FOSTERING
// ─────────────────────────────────────────────────────────────────────────

/**
 * How often a birth is one the household will not own.
 *
 * Applied only where the parent ALREADY HAS A HOUSEHOLD, which is what makes
 * the number small without anybody tuning it small: spouses are rare in this
 * world - `applyHouseholds` pairs at three percent a year - so the product is
 * a handful of people a century rather than a category. A child born to
 * somebody unattached is nobody's scandal and gets none of this.
 *
 * It is a rate on a circumstance, not a judgement. What follows from it is a
 * placement and one shame record; nothing here scores anybody.
 */
const BORN_OUTSIDE_THE_HOUSEHOLD = 0.05;

/**
 * The world's own reason a child has to go somewhere else, or null.
 *
 * Two, and they are opposites: an institution with a bar its own members'
 * children cannot clear, and a birth a household will not own. The first is
 * derived from the catalog and is nobody's fault; the second is drawn, and it
 * is the one that carries a shame.
 */
function whyThisChildCannotStay(
    parent: NpcRecord,
    rng: CultivationRNG
): FosteringReason | null {
    const house = whyTheirOwnHouseWillNotKeepThem(parent.factionId);
    if (house) return house;
    const married = parent.relationships.some(r => r.kind === 'spouse');
    if (married && rng.chance(BORN_OUTSIDE_THE_HOUSEHOLD)) return 'the birth';
    return null;
}

/** A word already spent on this person. Once means once. */
const PLACED_WITH = 'placed-a-child-with:';

/** The house a fostered person was sent OUT of, which is not the one they are in. */
const FOSTERED_FROM = 'fostered-from:';

/** The answer, once given. There is no second assessment and no appeal. */
const ASSESSED = 'assessed:';

/**
 * A child placed with somebody their parent knows, in the running world.
 *
 * The glue, and only the glue: every decision in it belongs to
 * `a-child-their-own-house-will-not-keep.ts`, which is pure and knows nothing
 * about a `WorldState`. What happens here is reading the parent's own ties off
 * their record, handing them over, and writing the answer down.
 *
 * Returns the child with their placement on it, or null when nothing happened -
 * which is nearly every birth in the world and must stay that way.
 *
 * WHAT IS NOT WRITTEN. There is no obligation ledger in `WorldState` - this
 * layer hands social rows back to its caller rather than storing them, the way
 * `driver.ts` does with absences and deaths - so the receipt `fosterTheChild`
 * produces is not persisted by the world. What the world keeps is what the
 * world can keep: the placement, the ties, the once-only mark, the shame on the
 * person carrying it, and a secret fact naming everybody who knows.
 */
function placeAChildTheirHouseWillNotKeep(
    state: WorldState,
    child: NpcRecord,
    parent: NpcRecord,
    ordinal: number,
    day: number,
    rng: CultivationRNG,
    roster: Roster
): NpcRecord | null {
    // Never the player's own mirror row. Placing your child is a decision a
    // person makes, and a world pass that made it for them would be the engine
    // taking the decision - the exact shape the agency rule forbids.
    if (!isTheWorldsToMove(parent)) return null;

    const reason = whyThisChildCannotStay(parent, rng);
    if (!reason) return null;

    // Who this parent actually knows. Their own rows, nobody else's, and the
    // house comes off the person rather than off a list of houses.
    const candidates: FosterCandidate[] = [];
    const asked = new Set(
        parent.tags.filter(t => t.startsWith(PLACED_WITH)).map(t => t.slice(PLACED_WITH.length))
    );
    for (const tie of parent.relationships) {
        const at = roster.at.get(tie.targetId);
        if (at === undefined) continue;
        const person = state.npcs[at];
        if (person.status !== 'alive' || !person.factionId) continue;
        // A house that has folded takes nobody. `whoCouldBeAsked` asks the
        // catalog whether a bar moves; whether the body still exists is the
        // world's own question and is answered here.
        const house = state.factions.find(f => f.id === person.factionId);
        if (!house || house.dissolvedOnDay !== null || !isBelowTheLid(house)) continue;
        candidates.push({
            personId: person.id,
            personName: person.name,
            houseId: person.factionId,
            standing: tie.standing,
            alreadyAsked: asked.has(person.id)
        });
    }

    const willing = whoCouldBeAsked(candidates, { fostererHouseId: parent.factionId });
    if (willing.length === 0) return null;

    // The other parent, where there is one AND they are a party to it. A
    // household's own child placed because the house has no room for them is a
    // thing both parents did; a birth the household will not own is precisely
    // the one the spouse is not on the list for.
    const spouseId = isConcealed(reason)
        ? null
        : parent.relationships.find(r => r.kind === 'spouse')?.targetId ?? null;

    const placed = fosterTheChild({
        fostererId: parent.id,
        askedOf: willing[0],
        childId: child.id,
        reason,
        onDay: day,
        childOrdinal: ordinal,
        fostererHouseId: parent.factionId,
        otherParentId: spouseId
    });
    if (!wasFostered(placed)) return null;

    const takerAt = roster.at.get(placed.askedOfId);
    const parentAt = roster.at.get(parent.id);
    if (takerAt === undefined || parentAt === undefined) return null;
    const taker = state.npcs[takerAt];

    // The child is on the receiving house's roll, at the bottom of it, WITHOUT
    // having met its admission ordinal. That exception is the whole of what the
    // word bought, and `barSkipped` on the result is the figure it skipped.
    //
    // `fostered-from` names the SENDING house, which is the only thing the
    // child's own record can carry that the assessment below needs. It is not
    // the child knowing anything - a tag is the world's bookkeeping, and the
    // child holds no knowledge row at all.
    let updated: NpcRecord = {
        ...child,
        factionId: placed.houseId,
        factionRankIndex: 0,
        tags: [
            ...child.tags,
            'fostered',
            ...(parent.factionId ? [`${FOSTERED_FROM}${parent.factionId}`] : [])
        ]
    };

    // The deference the arrangement produces, expressed as the tie it actually
    // is: the person who took them in is their patron, and they are that
    // person's client. The child holds no tie to the parent at all.
    updated = upsertRelationship(updated, {
        targetId: taker.id,
        targetName: taker.name,
        kind: 'client',
        standing: 0.5,
        note: 'Took them in. They have never been told why.'
    }, day);
    state.npcs[takerAt] = upsertRelationship(taker, {
        targetId: updated.id,
        targetName: updated.name,
        kind: 'patron',
        standing: 0.5,
        note: 'Took them in on a word, and knows whose they are.'
    }, day);

    // And what the parent now is to the person they asked. `spendAWord`'s own
    // reading of it, in the world's vocabulary.
    const holder = state.npcs[parentAt];
    state.npcs[parentAt] = upsertRelationship(
        {
            ...holder,
            tags: [
                ...holder.tags,
                `${PLACED_WITH}${taker.id}`,
                ...(placed.shame ? [shameTag(placed.shame.cause)] : [])
            ]
        },
        {
            targetId: taker.id,
            targetName: taker.name,
            kind: 'client',
            standing: Math.max(0, relationshipWith(holder, taker.id)?.standing ?? 0.5),
            note: 'Asked, and was not refused.'
        },
        day
    );

    // Secret, because the people who hold it are the people on it. Nobody else
    // in the world has a record, which is what `unaware` means for the child.
    appendWorldFact(state, makeFact({
        day,
        kind: 'birth',
        scale: 'personal',
        actors: [
            { id: parent.id, name: parent.name, role: 'parent' },
            { id: taker.id, name: taker.name, role: 'took the child' },
            { id: updated.id, name: updated.name, role: 'child' }
        ],
        locationId: updated.locationId,
        factionIds: [placed.houseId],
        summary:
            `${updated.name} was placed at ${placed.houseId} through ${taker.name}, ` +
            `on ${parent.name}'s word. ${reasonSummary(reason)}`,
        visibility: 'secret',
        fidelity: 'partial',
        magnitude: 0.2,
        data: {
            fostering: reason,
            barSkipped: placed.barSkipped,
            askedOfId: taker.id,
            fostererId: parent.id,
            // The one person with no record of their own origin.
            withheldFrom: placed.withheldFrom.join(','),
            childStage: placed.childStage,
            terms: placed.terms ? placed.terms.factionId : null
        }
    }));

    return updated;
}

/**
 * The one assessment a fostered person ever gets, on the terms their own house
 * set when it sent them away.
 *
 * Almost every house in the world attaches no terms at all, so this pass has
 * nothing to do on almost every world - `fosterageTermsOf` returns undefined
 * and the person is simply where they were raised, for good. Where there ARE
 * terms, both halves are read off the terms object and neither number appears
 * in this file.
 *
 * It fires at the first of two moments: the day they reach the rung, or the day
 * the deadline arrives. Reaching the rung after the deadline is a magnificent
 * career answering the wrong question, and the assessment says so - which is
 * the whole reason `metOrdinal` and `inTime` are reported separately.
 */
function applyFosterageReturns(state: WorldState, day: number): number {
    let assessed = 0;
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i];
        if (npc.status !== 'alive') continue;
        const from = npc.tags.find(t => t.startsWith(FOSTERED_FROM));
        if (!from) continue;
        if (npc.tags.some(t => t.startsWith(ASSESSED))) continue;
        const terms = fosterageTermsOf(from.slice(FOSTERED_FROM.length));
        if (!terms) continue;

        const age = (day - npc.identity.bornOnDay) / DAYS_PER_YEAR;
        const ordinal = npc.cultivation.realmOrdinal;
        if (ordinal < terms.returnOrdinal && age < terms.returnByAge) continue;

        const answer = assessTheReturn(terms, ordinal, age);
        assessed++;
        const outcome = answer.returns ? 'returned' : 'stayed';
        let updated: NpcRecord = { ...npc, tags: [...npc.tags, `${ASSESSED}${outcome}`] };
        if (answer.returns) {
            // Back onto the sending house's roll, at the bottom of it. The
            // assessment moved a person; it conferred nothing.
            updated = { ...updated, factionId: terms.factionId, factionRankIndex: 0 };
        }
        state.npcs[i] = updated;

        appendWorldFact(state, makeFact({
            day,
            kind: 'inheritance',
            scale: 'personal',
            actors: [{ id: updated.id, name: updated.name, role: 'assessed' }],
            locationId: updated.locationId,
            factionIds: [terms.factionId],
            summary: answer.returns
                ? `${updated.name} was assessed and went back to ${terms.factionId}.`
                : `${updated.name} was assessed and stayed where they were raised.`,
            visibility: 'secret',
            fidelity: 'partial',
            magnitude: 0.2,
            data: {
                fosterageAssessment: outcome,
                metOrdinal: answer.metOrdinal,
                inTime: answer.inTime,
                atOrdinal: ordinal,
                atAge: Math.round(age),
                terms: terms.factionId
            }
        }));
    }
    return assessed;
}

function reasonSummary(reason: FosteringReason): string {
    switch (reason) {
        case 'the bar':
            return 'Their own house does not lower its bar for anybody, including its own.';
        case 'no door':
            return 'Their own house has no intake at all; nobody joins it.';
        case 'the birth':
            return 'The household would not own the birth.';
    }
}

/**
 * People keep cultivating.
 *
 * TWO PASSES OVER ONE ROTATION, and the split is the whole design:
 *
 *   THE DERIVATION   the same closed-form walk seeding uses, run again against
 *                    the age they have now. It is right about what it is for -
 *                    an ordinary life on an ordinary budget arriving at an
 *                    ordinary rung - and it is what carries almost everybody
 *                    from nothing to wherever their talent and their book stop
 *                    them. Without it the population's realms are frozen at the
 *                    moment of seeding.
 *   THE LADDER       when the derivation has nothing further to give and they
 *                    are still below what their book and their province permit,
 *                    the world strikes at the wall FOR REAL - the same
 *                    `attemptBreakthrough` the player gets, with the same
 *                    odds, the same failure table, the same wounds and the same
 *                    deaths. See `an-npc-striking-at-the-next-wall.ts` for what
 *                    that closes and why the derivation alone could never
 *                    produce an apex.
 *
 * A slice of the roster per year rather than the whole of it, so the cost is a
 * constant and the outcome is decomposable. A realm only ever goes up; a person
 * can now come out of a review WORSE - wounded, cracked, halted or dead - which
 * is what a real wall does and what the derivation could not express.
 *
 * ── A ROTATION, NOT A DRAW ────────────────────────────────────────────────
 *
 * This used to pick `living / 40` people at random each year. A draw with
 * replacement over a hundred-year lifespan leaves a seventh of everybody NEVER
 * LOOKED AT, and it gives nobody a guaranteed look at the age their walk
 * finally clears a rung. That bites hardest at exactly one place: ordinal 12 to
 * 13, where lifespan goes from a hundred years to two hundred. Somebody whose
 * walk would carry them across at age ninety and who is not drawn in their last
 * decade dies at a hundred, in Qi Condensation, having been able to cross the
 * whole time - and the rung they failed to reach was the one that would have
 * bought them the years to go further.
 *
 * Measured on a live world at three thousand years, before this: 356 of 492
 * living people were standing BELOW the ordinal the rules already granted them
 * at their own age, ceiling and rank. The distribution was not being produced by
 * the ladder, it was being produced by a coin.
 *
 * So the roster is sliced by a stable hash of the id and one slice is walked per
 * year: every living person is reviewed once every `ADVANCEMENT_REVIEW_YEARS`
 * whatever else happens, and nobody is skipped for a century. Nothing about it
 * is stochastic, so nothing about it draws on the world seed - a schedule is not
 * a sample, and running it off `forStream` would have implied otherwise to the
 * next reader.
 *
 * The period is shorter than the old expected interval and that part IS a tuning
 * change, so it was measured rather than picked: a Qi Condensation life is about
 * eighty adult years, so twelve gives somebody six reviews inside it instead of
 * a Poisson two. The cost is still a constant per year and still flat across
 * five centuries - 0.45 to 0.75 seconds per simulated century on the reference
 * world, against three and a bit times as many walks, because the walk was never
 * the whole of the pass.
 */
const ADVANCEMENT_REVIEW_YEARS = 12;

/** Stable, seedless, and cheap: which review year this person's id belongs to. */
function reviewSlot(id: string, period: number): number {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) {
        h ^= id.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) % period;
}

function applyAdvancement(state: WorldState, year: number, day: number): NpcRecord[] {
    const slot = ((year % ADVANCEMENT_REVIEW_YEARS) + ADVANCEMENT_REVIEW_YEARS)
        % ADVANCEMENT_REVIEW_YEARS;
    const due: number[] = [];
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i];
        if (npc.status !== 'alive' || !isBelowTheLid(npc)) continue;
        // The player climbs on their own sheet, through `time-skip.ts`.
        // Reviewing their mirror row here would advance them a second time and
        // - worse, because a refresh cannot undo it - write a breakthrough into
        // the world's chronicle that the character never made.
        if (!isTheWorldsToMove(npc)) continue;
        if (reviewSlot(npc.id, ADVANCEMENT_REVIEW_YEARS) !== slot) continue;
        due.push(i);
    }
    if (due.length === 0) return [];

    const advanced: NpcRecord[] = [];
    // ONE index for the whole pass, not one lookup per person. The strike pass
    // needs the rung of whoever is teaching them, and a scan of the roster per
    // reviewed NPC would turn a linear pass quadratic over five hundred people
    // for the whole life of the world.
    const byId = new Map(state.npcs.map(n => [n.id, n]));
    // GROUND TIME, INDEXED ONCE PER PASS.
    //
    // Every house allocates days in its own chambers by standing, and this is
    // asked of every living cultivator every year - a per-person recomputation
    // would be quadratic over the whole life of the world, the same reason
    // `shelfOf` and `teachableIn` are indexed.
    const roomsByFaction = new Map<string, ReturnType<typeof roomsHeldBy>>();
    const membersByFaction = new Map<string, GroundClaimant[]>();
    for (const n of state.npcs) {
        if (n.status !== 'alive' || !n.factionId) continue;
        const at2 = membersByFaction.get(n.factionId);
        if (at2) at2.push(n); else membersByFaction.set(n.factionId, [n]);
    }
    const groundShare = new Map<string, number>();
    const bestRoomRate = new Map<string, number | null>();
    for (const [factionId, members] of membersByFaction) {
        const rooms = roomsHeldBy(state.locations, factionId);
        roomsByFaction.set(factionId, rooms);
        bestRoomRate.set(factionId, groundRateAt(rooms[0]));
        for (const [id, share] of groundTimeShares(members, rooms)) groundShare.set(id, share);
    }

    for (const at of due) {
        const npc = state.npcs[at];

        const regionTag = npc.tags.find(t => t.startsWith('region:'))?.slice(7);
        const region = state.locations.find(
            l => l.kind === 'region' && isBelowTheLid(l) &&
                String(l.data.catalogRegionId ?? '') === regionTag
        ) ?? state.locations.find(l => l.id === npc.locationId);
        const regionCeiling = Number(region?.data.localCeilingOrdinal ?? 20);
        // THE GROUND THEY ACTUALLY GET, WHICH IS A FRACTION OF A YEAR.
        //
        // This read the region's ambient off the `region:` tag and nothing
        // else, so a house's own chambers were not an input to how fast its
        // people climbed. Ground is the largest term in the model at x8 and
        // measured, not one person in the world was drawing on any of the good
        // ground - 434 dense and spirit-tide locations stood empty, and those
        // locations ARE the sect chambers.
        //
        // A house grants days rather than a residence, so this is the year
        // averaged over the chamber and ordinary ground. Somebody in no house
        // gets a share of zero and the region rate exactly, unchanged.
        const provinceRate = Number(region?.data.ambientRateMultiplier ?? 1);

        // The days they are NOT in the vein chamber are spent on their own

        // house ordinary ground, not in a field outside it. See

        // `houseFallbackRate` - without this an apex outer disciple came out

        // worse than a village one, measured.

        const rooms = npc.factionId ? roomsByFaction.get(npc.factionId) ?? [] : [];

        const rateMultiplier = rateOverTheYear(

            groundShare.get(npc.id) ?? 0,

            npc.factionId ? bestRoomRate.get(npc.factionId) ?? null : null,

            houseFallbackRate(rooms, provinceRate)

        );
        const age = Math.floor((day - npc.identity.bornOnDay) / 365);

        // THE BOOK IS THE HARDER OF THE TWO CEILINGS.
        //
        // The province says what has ever been done here; the manual says what
        // THIS person can do at all. Without a road there is no progress - not
        // slow progress, none - which is the player's rule (`NO_MANUAL_CEILING`)
        // and the world was not playing by it, because until `manuals.ts` ran
        // nobody in the world held a book at all.
        //
        // A capped cultivator is not stuck by accident. They are standing in
        // the situation acquiring a new manual exists for, and the right outcome is
        // that they stop here until they find a later volume, are taught, or
        // write one.
        // What they can be CARRIED to, which for a disciple of a house that
        // teaches in person is the shelf they are being taught off rather
        // than the nothing they are holding. See `reachableCeilingFor`.
        const manualCeiling = reachableCeilingFor(state, npc) || BOOKLESS_CEILING;
        const ceiling = Math.min(regionCeiling, manualCeiling);
        if (ceiling <= npc.cultivation.realmOrdinal) continue;

        // THE SHELF THEY CAN ACTUALLY REACH, not a default one.
        //
        // `deriveLife` prices the whole climb on `origin.roadQuality`, and
        // `bestReadable` describes an origin as a level of SHELF - "an origin
        // reaches a level of shelf, and the reader takes the best thing on it
        // they can read". This call passed no origin at all, so every
        // cultivator in the world climbed on the default one whatever house
        // they were in, whatever rank they held and whatever they were holding.
        //
        // Measured with that in place: six of the twelve spirit roots
        // asymptoted at ordinal 12, one rung below Foundation Establishment,
        // and across five hundred years the world recorded 53 crossings INTO
        // rung 12 and exactly ZERO into 13. Not a thin flow - a wall, and it
        // stood one rung under the first realm boundary.
        //
        // Membership is the shelf. Somebody inside a house reads that house's
        // working book; somebody senior in it reaches further up; somebody with
        // no house has whatever a market stall sold them. That is the same
        // gradient `manuals.ts` already applies to WHICH book they hold, and it
        // is why joining a house is worth forty years of sweeping.
        const membership: OriginTierKey = !npc.factionId
            ? 'thin_county'
            : npc.factionRankIndex >= 3 ? 'dao_house_bloodline'
                : npc.factionRankIndex >= 1 ? 'established_clan'
                    : 'sect_retainer';

        // AND THE BETTER OF THAT AND WHAT THEY WERE BORN WITH.
        //
        // The block above reinterpreted `origin` as the shelf a MEMBERSHIP
        // reaches, which fixed a real wall - before it, every cultivator in the
        // world climbed on the default origin and six of twelve spirit roots
        // asymptoted one rung under Foundation Establishment. What it also did,
        // silently, was overwrite the origin a person was actually born with.
        //
        // So a child of an apex house standing at rank 0 climbed as a
        // `sect_retainer`, and a farm child at rank 3 climbed as a
        // `dao_house_bloodline`. Birth never touched the climb at all. Measured
        // on people who actually completed a band transition, origin showed no
        // consistent effect and REVERSED between transitions - market_town
        // faster from 13-16 to 17-20 and slower from 17-20 to 21-24 - which is
        // what a variable being overwritten by an unrelated one looks like.
        //
        // The honest reading is that both are true at once and neither replaces
        // the other. AGENTS.md states the thesis: an origin buys INPUTS and
        // never rank. A family does not stop funding somebody the day they
        // sweep a courtyard, and a house does not withhold its shelf from a
        // pauper it promoted. So take whichever supplies the better road, which
        // is what `deriveLife` prices the climb on, and let the other one be
        // the floor rather than the answer.
        const born = npc.identity.origin;
        const shelf: OriginTierKey =
            manualQualityRank(getOrigin(born).roadQuality)
                > manualQualityRank(getOrigin(membership).roadQuality)
                ? born
                : membership;

        const derived = deriveOrdinal(
            npc.cultivation.spiritRoot,
            npc.cultivation.attributes,
            age,
            rateMultiplier,
            ceiling,
            forStream(state.seed, 'advance-npc', npc.id),
            { origin: shelf }
        );
        if (derived > npc.cultivation.realmOrdinal) {
            state.npcs[at] = setRealm(npc, derived, day);
            advanced.push(state.npcs[at]);
            continue;
        }

        // ── THE DERIVATION HAS RUN OUT. THE LADDER TAKES OVER. ────────────
        //
        // Everybody who reaches this line has a rung the walk cannot improve
        // and a ceiling above them they are still allowed to reach. That is the
        // entire high band of the world: a life-walk saturates in its first few
        // centuries and the realm it reached grants thousands of years more.
        //
        // The conditions are the three the design says decide the top of the
        // ladder, and all three are read rather than invented: the ground under
        // them, the book in their hands, and whoever is teaching them.
        const conditions = {
            ambient: ambientAround(state, npc, region),
            rateMultiplier,
            guideOrdinal: guideOrdinalFor(npc, byId),
            manualCeiling
        };
        const readiness = readyToStrike(npc, day, conditions);
        if (!readiness.ready) continue;

        const strike = strikeAtTheWall(
            npc,
            day,
            readiness,
            // Keyed on the person and the year, so a world replayed from its
            // seed strikes the same walls with the same outcomes, and adding
            // this pass perturbed no other stream.
            forStream(state.seed, 'strike-the-wall', npc.id, year),
            conditions.ambient,
            // THE ROADS, read against the world rather than against the record.
            // The arts in their hands are one channel of four and cannot reach
            // past three domains; the ground their house lets them onto, the
            // ground their province leaves standing open, the ruin somebody dug
            // out and the material that was spent on them are the rest of it.
            roadsInReachOf(state, npc)
        );
        if (!strike) continue;

        // The ledger gets the crossing whichever way it went. This is the single
        // richest event in a cultivator's life and it used to leave no trace at
        // all: `attemptBreakthrough` returned the trial, the roll, the wound,
        // the years burned and whether they would ever cross again, the record
        // took every one of them, and the world's own history said nothing
        // happened. A failure is written as fully as a success, because a
        // cultivator who cracked at a wall and is standing at their rung
        // finished is the population the failure table exists to produce.
        //   See `recording-what-a-crossing-did.ts`.
        if (strike.died) {
            state.npcs[at] = markDead(
                npc,
                day,
                // NAME WHAT KILLED THEM. A death at this height has to be an
                // event the world can account for rather than an entry in a
                // pool: the design's rule is that nothing ordinary may end
                // somebody at Tribulation Transcendence, and "the wall did not
                // open" said nothing about which wall or what came down. At
                // ordinals 40 to 44 every step summons lightning, so a death
                // there IS the tribulation - one of the ends the design
                // permits - and below that it is the crossing itself.
                triggersHeavenlyTribulation(npc.cultivation.realmOrdinal)
                    ? `Called down the tribulation at ${rankName(npc.cultivation.realmOrdinal)} `
                      + 'and did not hold it.'
                    : `The crossing out of ${rankName(npc.cultivation.realmOrdinal)} `
                      + 'did not open, and closed.'
            );
            recordCrossing(state, npc, strike.result, day);
            continue;
        }
        state.npcs[at] = strike.npc;
        recordCrossing(state, state.npcs[at], strike.result, day);
        if (strike.result.outcome === 'success') advanced.push(state.npcs[at]);
    }
    return advanced;
}

/**
 * The band of the ground somebody is actually standing on.
 *
 * Their own place first, because a sect seat inside a thin province is not a
 * thin place and the location record already says so; the province second; and
 * 'normal' last, which is what `deriveLife` has always defaulted to.
 */
function ambientAround(
    state: WorldState,
    npc: NpcRecord,
    region: LocationRecord | undefined
): AmbientQi {
    const here = npc.locationId === null
        ? undefined
        : state.locations.find(l => l.id === npc.locationId);
    return here?.ambient ?? region?.ambient ?? 'normal';
}

/**
 * Sects take people on as they become worth taking on.
 *
 * Admission is a realm threshold, and a newcomer is almost never over it: a
 * sect that only ever looked at people on the day they were born would empty
 * within a generation, and then fold for want of members. So the rolls are
 * refreshed each year from whoever has since become admissible - which is what
 * a recruitment cycle IS, and is why every faction has one on the books.
 *
 * A flow, not a decision: nobody here weighs whether to apply.
 */
/**
 * Books move after seeding, and not because anybody joined anything.
 *
 * Promotion inside a house reaches further up its shelf; the unbacked buy what
 * a stall sells. Both are additions only, so this is safe to run over and over,
 * and it is what turns a static shelf into the thing that lets a population
 * pyramid actually flow - somebody climbs to a house's admission bar, is taken
 * on, sweeps for forty years, and only then is handed the book that lets them
 * pass the ceiling the last one gave them.
 */
/**
 * Houses raise people, and the seats above them run out.
 *
 * Ordered BEFORE `applyBookAcquisition` in the year, deliberately: a promotion
 * is what entitles somebody to the next book, and running these the other way
 * round would make every disciple wait a full year between the rank and the
 * manual it was supposed to buy them.
 *
 * See `promotion-inside-a-house.ts`. `factionRankIndex` was written at seeding
 * and at recruitment and never advanced again, so 340 of 364 house members sat
 * at rank 0 by year 500 - and since a rank-0 member is entitled to exactly one
 * book however deep their house's shelf is, nobody alive held a manual reaching
 * past ordinal 17.
 */
/**
 * Somebody standing at the end of their shelf finds a way past it.
 *
 * Its own pass, and deliberately NOT part of the advancement sample.
 * `applyAdvancement` looks at roughly one living cultivator in forty each year
 * because a life-walk is expensive; asking whether somebody found a book is two
 * comparisons. Putting the check inside that sample would multiply its odds by
 * a fortieth without anybody intending it - and did, in the first version of
 * this, which never got wired at all and so fired zero times.
 *
 * The capped are a small set at any moment, so visiting all of them yearly
 * costs nothing and the stated odds are the real odds. Without this the world
 * has no route out of a house's library whatsoever: isolated lives reach
 * ordinal 41, and nobody in a living world had ever exceeded 29.
 */
/**
 * People move back into ruined ground, because they have nowhere else to go.
 *
 * The world consumed places and never made one. Every settlement and sect seat
 * in a seeded world is eventually turned into a ruin or a forbidden zone by
 * disasters, falls and expenditures - and nothing anywhere put a habitable
 * place back. Measured before this existed:
 *
 *     years   living   habitable places
 *         0      565           49 of 49
 *       500      493           25 of 25
 *      1000      502           11 of 11
 *      1500      147            0 of 0
 *      2500        0            0 of 0
 *
 * The world went extinct, and the ladder collapsing to ordinal 11 on the way
 * was a symptom rather than the disease. Births need somewhere a person can
 * stand; when the last habitable place became a ruin, nobody was born again.
 *
 * Resettlement is the honest fix rather than slowing the destruction, because
 * the destruction is correct - houses do fall and ground does go bad. What was
 * missing is the other half of what people actually do, which is move into the
 * wreckage and live in it. A ruin with nobody in it is a site to be dug; a ruin
 * somebody has moved back into is a village with very old walls, and this world
 * should have both.
 *
 * Deliberately does NOT resettle a forbidden zone. Ground that kills you is not
 * somewhere desperation solves, and keeping that distinction is what stops this
 * from quietly undoing the catastrophe layer.
 */
/**
 * A year of the world's own people working the ground they stand on.
 *
 * THE WRITER THE DEPLETION MODEL DID NOT HAVE. `what-a-place-still-has-in-the
 * -ground.ts` was reachable from three verbs and all three asked for a single
 * unit against a band that grows back forty-four over the same span, so the
 * `drawn` column read as a working model over an input too small to move it.
 * The pressure is the population, and it always was - a player's herb is a
 * rounding error against a district's year and is supposed to be.
 *
 * Where people ARE is `NpcRecord.locationId` and nothing else, which is the
 * one record of presence this world keeps. So a place nobody stands on is
 * pressed on by nobody, and that is the mechanism rather than an omission: the
 * wilds keep what the ground around the towns has lost, and going further out
 * is the answer to a district that has been worked out. Both halves of that
 * sentence are now true of the same table.
 *
 * Nothing is drawn. One walk of the roster, one pass over the places that have
 * anybody on them, and arithmetic on a headcount and a clock.
 */
function applyGroundPressure(state: WorldState, day: number): number {
    const standing = new Map<string, number[]>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !npc.locationId || !isBelowTheLid(npc)) continue;
        const at = standing.get(npc.locationId);
        if (at) at.push(npc.cultivation.realmOrdinal);
        else standing.set(npc.locationId, [npc.cultivation.realmOrdinal]);
    }
    if (standing.size === 0) return 0;

    let pressed = 0;
    for (const place of state.locations) {
        const ordinals = standing.get(place.id);
        if (!ordinals) continue;
        const worked = whatThePeopleHereTake(place, {
            ordinals,
            days: DAYS_PER_YEAR,
            onDay: day
        });
        for (const draw of worked.draws) {
            if (recordGroundDraw(place, draw)) pressed++;
        }
    }
    return pressed;
}

/**
 * What is wrong with the world's places, opened, extended and lifted.
 *
 * THE WRITER THE STATUS LAYER NEVER HAD. `what-is-true-of-a-place-right-now.ts`
 * is complete - the record, the clock, the join, the price multiplier, the
 * stopped passage, the ceiling on what anybody local can tell you - and until
 * now nothing in `src/` ever made one. Measured: a thousand world-years, zero
 * rows, with the played `investigate` verb reading off the empty column and
 * reporting with confidence that nothing was wrong anywhere.
 *
 * What opens one is in `what-goes-wrong-with-a-place-and-what-ends-it.ts` and
 * every opener binds to something else the world already wrote. What LIFTS one
 * is the same question asked again: a status the world would still propose
 * today is extended, and one it would not is over. So there is no reviewer and
 * no table keyed on `kind`, which is what keeps the eleventh kind costing a row
 * and no branch.
 *
 * ── The draw ─────────────────────────────────────────────────────────────
 *
 * One stream, keyed `area-status`, which no other pass uses. A world in which
 * no harvest fails draws exactly what it drew before this pass existed.
 */
/**
 * Wars that have reached the day they were scheduled to end, ended.
 *
 * A FINDING RATHER THAN A FEATURE, and it was found by wiring the status layer
 * on top of it. `war_opened` tags both houses `at_war` and schedules a
 * `war_resolves` effect two to twenty-five years out. **Nothing anywhere ever
 * removed the tag.** The effect fired, `factKindFor` turned it into a fact
 * saying the war had come to an end, and both houses went on carrying the tag
 * for the rest of the world's life - so by year five hundred practically every
 * institution in the world was permanently at war with somebody, and
 * `war_settled` was a `PressureKind` with no producer anywhere in `src/`.
 *
 * Nothing noticed because nothing read the tag. The moment a status was hung
 * off it the world grew 440 live wars, which is what an unended state looks
 * like when something finally consults it.
 *
 * So this is the other half of `war_opened`, on the same yearly line, and it is
 * where `war_settled` comes from.
 */
function settleWarsThatAreOver(state: WorldState, day: number): PressureEvent[] {
    const events: PressureEvent[] = [];
    for (const effect of state.schedule) {
        if (effect.data.kind !== 'war_resolution') continue;
        if (effect.dueOnDay > day) continue;
        const sideA = state.factions.find(f => f.id === String(effect.data.sideA ?? ''));
        const sideB = state.factions.find(f => f.id === String(effect.data.sideB ?? ''));
        const stillFighting = [sideA, sideB].filter(
            (f): f is FactionRecord => f !== undefined && f.tags.includes('at_war')
        );
        if (stillFighting.length === 0) continue;
        for (const side of stillFighting) {
            side.tags = side.tags.filter(t => t !== 'at_war');
        }
        events.push(emit(state, 'war_settled', day, {
            day,
            kind: 'war',
            scale: 'regional',
            summary: effect.summary,
            factionIds: stillFighting.map(f => f.id),
            visibility: 'public',
            magnitude: 0.5,
            unattributed:
                'The road east is being used again, and the people who were sleeping outside '
                + 'the walls have mostly gone somewhere.',
            consequences: {
                immediate: 'Both sides have stopped.',
                physical: 'The trade road is passable.',
                tenYearsLater: 'Whichever side lost is still smaller.'
            }
        }, { factions: stillFighting.map(f => f.id) }));
    }
    return events;
}

function applyAreaStatuses(state: WorldState, year: number, day: number): AreaStatus[] {
    const atWar = new Set(
        state.factions.filter(f => f.dissolvedOnDay === null && f.tags.includes('at_war'))
            .map(f => f.id)
    );
    const byFaction = new Map(state.factions.map(f => [f.id, f]));
    const standing = new Map<string, number>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !npc.locationId) continue;
        standing.set(npc.locationId, (standing.get(npc.locationId) ?? 0) + 1);
    }

    const ground: GroundAsItStands[] = [];
    const regions: LocationRecord[] = [];
    for (const place of state.locations) {
        if (!isBelowTheLid(place)) continue;
        if (place.kind === 'region') { regions.push(place); continue; }
        const holderRow = place.controllingFactionId
            ? byFaction.get(place.controllingFactionId) ?? null
            : null;
        const holder = holderRow && holderRow.dissolvedOnDay === null
            ? { id: holderRow.id, name: holderRow.name }
            : null;
        ground.push({
            place,
            peopleHere: standing.get(place.id) ?? 0,
            holder,
            holderIsAtWar: holder !== null && atWar.has(holder.id),
            holderFightingNames: holder === null || !atWar.has(holder.id)
                ? []
                : [...atWar].filter(id => id !== holder.id)
                    .map(id => byFaction.get(id)?.name ?? '')
                    .filter(name => name.length > 0)
                    .slice(0, 1),
            isTheHoldersSeat: holderRow !== null && holderRow.seatLocationId === place.id
        });
    }

    const proposed = whatIsWrongWithPlacesToday({
        ground,
        regions,
        onDay: day,
        rng: forStream(state.seed, 'area-status', year)
    });

    // ── WHAT IS ALREADY TRUE ──
    //
    // Extended where the world still says so, lifted where it does not, and
    // left alone until its own review day arrives. A status is not re-examined
    // every year: `reviewOnDay` is when the world looks again, and looking
    // early would make the date decoration.
    // When each key last stopped being true, so a capped status cannot simply
    // reopen the following spring and run out its whole life in instalments.
    const endedToday = new Map<string, number>();
    for (const status of state.statuses) {
        if (status.liftedOnDay === null) continue;
        const key = statusKey(status.areaId, status.kind);
        endedToday.set(key, Math.max(endedToday.get(key) ?? 0, status.liftedOnDay));
    }

    const opened: AreaStatus[] = [];
    for (let i = 0; i < state.statuses.length; i++) {
        const status = state.statuses[i];
        // Something already ended is ended. It may be proposed again, and then
        // it opens as a new row with its own dates, because a famine and the
        // famine eighty years before it are two famines.
        if (status.liftedOnDay !== null) continue;
        const key = statusKey(status.areaId, status.kind);
        const still = proposed.get(key);
        // Whatever is on the books holds this key. A second row for the same
        // thing in the same place is one thing, not two.
        proposed.delete(key);
        // THE REVIEW WINDOW IS THE PASS INTERVAL, AND IT HAS TO BE.
        //
        // `isStatusRunningOn` is deliberately false ON the review day - an
        // unattended status expires rather than persisting, which is the right
        // default and the reason a famine cannot outlive the world. But this
        // pass runs once a year and most review dates are a year out, so
        // looking only at rows that are still running meant every status fell
        // exactly through the gap: measured, 196,914 rows opened over five
        // centuries and NOT ONE was ever extended or lifted. Reviewing a year
        // either side is the world actually looking.
        if (day + DAYS_PER_YEAR < status.reviewOnDay) continue;
        // AND A CAUSE THAT NEVER GOES AWAY DOES NOT BUY A STATUS THAT NEVER
        // ENDS. The layer's own line is that a status is what is true of a
        // place for a WHILE, and what a place permanently became belongs in
        // `LocationChange`. Ground hunted out by a population that is still
        // standing on it stays hunted out, so the tide over it was extended
        // every year forever - measured at 182,135 days, which is not a tide.
        const overrun = day - status.beganOnDay >= (still?.mayRunForDays ?? 0);
        state.statuses[i] = still && !overrun
            ? extendStatus(status, Math.max(status.reviewOnDay + 1, day + still.reviewInDays))
            : liftStatus(status, Math.max(day, status.beganOnDay + 1));
        if (overrun) endedToday.set(key, day);
    }

    // ── AND WHAT HAS JUST BECOME TRUE ──
    for (const [key, candidate] of proposed) {
        const lastEnded = endedToday.get(key);
        if (lastEnded !== undefined && day - lastEnded < candidate.quietForDaysAfter) continue;
        // The cause on the record BEFORE the status, so `cause.factId` points
        // at something. A status that appeared from nowhere is the thing
        // `BEAST_TIDES` was written to forbid.
        const fact = appendWorldFact(state, makeFact({
            day,
            kind: candidate.factKind,
            scale: 'regional',
            summary: candidate.cause.what,
            locationId: candidate.areaId,
            factionIds: candidate.cause.decidedById ? [candidate.cause.decidedById] : [],
            actors: [],
            visibility: 'regional',
            fidelity: candidate.causeKnownLocally ? 'full' : 'partial',
            causeKnown: candidate.causeKnownLocally,
            magnitude: 0.5,
            data: { areaStatus: candidate.kind, areaId: candidate.areaId }
        }));

        const status = makeAreaStatus({
            id: `as-${year}-${key}`,
            areaId: candidate.areaId,
            kind: candidate.kind,
            statement: candidate.statement,
            cause: { ...candidate.cause, factId: fact.id },
            signs: candidate.signs,
            causeKnownLocally: candidate.causeKnownLocally,
            beganOnDay: day,
            reviewOnDay: day + Math.max(1, Math.round(candidate.reviewInDays)),
            stops: candidate.stops,
            priceMultiplier: candidate.priceMultiplier,
            dangerDelta: candidate.dangerDelta
        });
        state.statuses.push(status);
        opened.push(status);
    }
    return opened;
}

function applyResettlement(state: WorldState, year: number, day: number): number {
    const regions = state.locations.filter(l => l.kind === 'region' && isBelowTheLid(l));
    let settled = 0;

    for (const region of regions) {
        const under = locationIdsUnder(state, region.id);
        const habitable = state.locations.filter(l =>
            under.has(l.id) && (l.kind === 'settlement' || l.kind === 'sect_seat')
            && !l.sealed && l.thresholds.entry <= 0 && l.thresholds.survival <= 0);
        const people = state.npcs.filter(n =>
            n.status === 'alive' && n.locationId !== null && under.has(n.locationId)).length;
        if (people === 0) continue;

        // One habitable place per fifty people is thin but not desperate. Below
        // that the province is short of anywhere to live and somebody moves
        // into a ruin; above it nobody bothers, because a ruin is a worse place
        // to live than a village and everybody knows it.
        const wanted = Math.max(1, Math.ceil(people / 50));
        if (habitable.length >= wanted) continue;

        const candidates = state.locations.filter(l =>
            under.has(l.id) && l.kind === 'ruin' && !l.sealed
            && l.thresholds.entry <= 0 && l.thresholds.survival <= 0);
        if (candidates.length === 0) continue;

        const rng = forStream(state.seed, 'resettle', region.id, year);
        // Rare per year even under pressure. A province does not repopulate its
        // wreckage in a decade, and a world that did would never feel emptied.
        if (!rng.chance(0.04)) continue;

        const site = candidates[rng.int(0, candidates.length - 1)];
        const at = state.locations.findIndex(l => l.id === site.id);
        state.locations[at] = {
            ...site,
            kind: 'settlement',
            description: site.description
                + ' People live here again, in and among what was here before.',
            data: { ...site.data, populationWeight: 1, resettledOnDay: day }
        };
        settled++;
    }
    return settled;
}

function applyFoundRoads(state: WorldState, year: number, day: number): number {
    let found = 0;
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i];
        if (npc.status !== 'alive' || !isBelowTheLid(npc)) continue;
        const ceiling = reachableCeilingFor(state, npc) || BOOKLESS_CEILING;
        if (npc.cultivation.realmOrdinal < ceiling) continue;
        const luck = forStream(state.seed, 'found-a-road', npc.id, year);
        if (!mightFindARoad(npc, ceiling, luck)) continue;
        const road = roadTheyFound(npc, ceiling, luck);
        if (!road) continue;
        state.npcs[i] = {
            ...npc,
            cultivation: {
                ...npc.cultivation,
                techniqueIds: [...npc.cultivation.techniqueIds, road]
            },
            updatedOnDay: day
        };
        found++;
    }
    return found;
}

function applyPromotions(state: WorldState, day: number): number {
    const { promotions, blocked } = assessPromotions(state);
    if (promotions.length === 0) return 0;
    const roster = rosterOf(state);
    const at = roster.at;
    for (const p of promotions) {
        const i = at.get(p.npcId);
        if (i === undefined) continue;
        state.npcs[i] = { ...state.npcs[i], factionRankIndex: p.toRank, updatedOnDay: day };
        recordPromotion(state, state.npcs[i], p, day);
    }
    // The other half of a promotion, which this call has always computed and
    // always discarded: everybody who had met the bar and watched somebody else
    // take the seat. `blocked` carries the reason, and `outranked` is the one
    // with a person in it.
    applyPassedOver(state, promotions, blocked, day, roster);
    return promotions.length;
}

function applyBookAcquisition(state: WorldState, year: number, day: number): number {
    const rng = forStream(state.seed, 'books', year);
    const living: number[] = [];
    for (let i = 0; i < state.npcs.length; i++) {
        if (state.npcs[i].status === 'alive' && isBelowTheLid(state.npcs[i])
            // What the player has read is on their own sheet, and `manuals.ts`
            // is emphatic that a book they never earned is the defect this
            // whole layer exists to close. The row would take one and lose it
            // again at the next refresh, having spent a draw on the way.
            && isTheWorldsToMove(state.npcs[i])) living.push(i);
    }
    if (living.length === 0) return 0;

    // Name replacements first, so somebody promoted this year can be handed
    // the shelf in the same pass rather than waiting another turn of the clock.
    const npcAt = new Map(state.npcs.map((n, i) => [n.id, i]));
    for (const pick of refreshChosen(state)) {
        const i = npcAt.get(pick.id);
        if (i === undefined) continue;
        state.npcs[i] = { ...state.npcs[i], tags: [...state.npcs[i].tags, 'chosen'], updatedOnDay: day };
    }

    let handed = 0;
    const looks = Math.max(1, Math.round(living.length / 8));
    for (let s = 0; s < looks; s++) {
        const at = living[rng.int(0, living.length - 1)];
        const npc = state.npcs[at];
        if (npc.status !== 'alive') continue;
        const gained = newlyEntitled(state, npc);
        if (gained.length === 0) continue;
        state.npcs[at] = {
            ...npc,
            cultivation: {
                ...npc.cultivation,
                techniqueIds: [...npc.cultivation.techniqueIds, ...gained]
            },
            updatedOnDay: day
        };
        handed++;
    }
    return handed;
}

function applyRecruitment(state: WorldState, year: number, day: number): number {
    const admitting = state.factions.filter(
        f => f.dissolvedOnDay === null && isBelowTheLid(f) && f.tags.includes('recruits')
    );
    if (admitting.length === 0) return 0;

    const rng = forStream(state.seed, 'recruitment', year);
    let joined = 0;

    // A sample rather than the whole roster: joining is rare per person per
    // year, and the cost has to stay a constant across five centuries.
    const free: number[] = [];
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i];
        // And never the player. Which house they are in is a decision they make
        // at a gate, through `sects`, and a world pass that quietly enrolled
        // them would be the engine taking the decision - the exact shape the
        // agency rule forbids.
        if (npc.status === 'alive' && isBelowTheLid(npc) && npc.factionId === null
            && isTheWorldsToMove(npc)) free.push(i);
    }
    if (free.length === 0) return 0;

    const looks = Math.max(1, Math.round(free.length / 12));
    for (let s = 0; s < looks; s++) {
        const at = free[rng.int(0, free.length - 1)];
        const npc = state.npcs[at];
        if (npc.factionId !== null || npc.status !== 'alive') continue;

        // In reach of the gate, which means the same province.
        //
        // This used to accept a seat that WAS the npc's location or its direct
        // parent. Both of those were true only while factions were seated on
        // region nodes and everybody was standing on one; with real settlements
        // and real sect grounds the seat is a sibling of the npc's village, not
        // its parent, and the filter matched nobody.
        const home = regionOf(state, npc.locationId);
        const options = admitting.filter(f =>
            npc.cultivation.realmOrdinal >= Number(f.resources.admission_ordinal ?? 0) &&
            // The one floor that is not a rung. A house that takes one sex and
            // not the other refuses at the door, and the world's own intake has
            // to be bound by it or the rule binds the player and nobody else -
            // which is this repository's signature defect, inverted.
            (whoAHouseWillTake(f.id) ?? npc.identity.sex) === npc.identity.sex &&
            (f.seatLocationId === null ||
                (home !== null && regionOf(state, f.seatLocationId) === home))
        );
        if (options.length === 0) continue;
        if (!rng.chance(0.35)) continue;

        const faction = options[rng.int(0, options.length - 1)];
        state.npcs[at] = { ...npc, factionId: faction.id, factionRankIndex: 0, updatedOnDay: day };
        joined++;
    }
    return joined;
}

/**
 * Factions pay for themselves, or they do not.
 *
 * A vein is income; members and tribute are cost. That is the whole model, and
 * it is enough: a sect holding a vein it can work stays solvent, one that has
 * lost its vein starts dying immediately, and one that pays a large tribute
 * upward lives closer to the line than one that answers to nobody. The
 * `faction_fell` template then binds to whoever the arithmetic has already
 * ruined, rather than picking a victim.
 */
/**
 * How often a house puts a party on the road, per year.
 *
 * A rate on the INSTITUTION rather than on the event budget: a sending is
 * ordinary business, and putting it on the fifty-five-events-a-century table
 * would have made it rare for the wrong reason. What this counts is a sending
 * the world RESOLVES - a party assembled, sent, and either back or not - and
 * not every errand anybody runs, which is why it is one every five years for a
 * house rather than several a year.
 *
 * MEASURED AGAINST THE PYRAMID, WHICH IS WHAT SETS IT. Sendings cost people,
 * and `whoTheHouseCanSend` sends the strongest a house can spare, so the rate
 * is the term that decides how hard this pass leans on the top of the ladder.
 * Pooled over five seeds at five centuries:
 *
 *   without this pass    2363 / 248 /  88
 *   0.55 a house-year    2427 / 165 /  53
 *   0.35                 2389 / 203 /  72
 *   0.2                  2366 / 231 /  84
 *
 * A wiring change is not allowed to restructure the population. At 0.2 the
 * world loses people on the road - which it could not before - and the shape
 * survives it.
 */
const SENDINGS_PER_HOUSE_YEAR = 0.2;

/**
 * What a house pays for a carriage, and the rung at which one is worth having.
 *
 * A cheap decision deliberately: the interesting conveyance is the tracked one
 * a house BUILDS, and a drawn carriage is a line on the ledger that a solvent
 * institution simply has. What it buys is the only thing a conveyance ever
 * buys - the term of a posting, through `daysByConveyance` - so a house with
 * one gets its people back sooner and can send again.
 */
const A_CARRIAGE_COSTS = 8_000;

/**
 * How heavy a finished sending has to be before anybody repeats it.
 *
 * `magnitudeOf` reads 0.2 for a posting at or below the party's own rung and
 * climbs with the gap, so this keeps the errands a house does every year off
 * the chronicle and lets the hard ones on. Nothing that went WRONG is filtered
 * by it: a party that did not come back is news whatever it was sent at.
 */
const WORTH_REPEATING = 0.35;

/**
 * Houses put people on the road, and what comes back is news.
 *
 * THE WHOLE OF `who-goes-out-for-a-house-and-what-comes-back.ts` HAD NO
 * CALLER. `resolveSending`, `newsOfASending`, `tierFor`, `tierNameFor`,
 * `whoTheHouseCanSend`, `magnitudeOf` and `postingFor` were zero-reference
 * exports, so a module that decides who a house can spare, what the gap costs,
 * who does not come back and what the ledger says about it never ran - and
 * nothing a house did ever became a fact anybody could repeat.
 *
 * Every decision belongs to that module. What happens here is reading a
 * `FactionRecord` into the shape it asks for, handing over the roster, and
 * writing down what it says: the fact through `appendWorldFact`, which is what
 * `circulating`, `retell`, the digest and `whatIsSaidAbout` all already read,
 * and the people who did not come back through `markMissing`.
 *
 * ── Missing, not dead ────────────────────────────────────────────────────
 *
 * A party that did not come back is a party nobody has heard from. `absence`
 * already owns what happens next - how long before anybody says it out loud,
 * who inherits, whether they turn up - and declaring them dead here would take
 * that decision away from the layer that has it.
 *
 * ── The draw ─────────────────────────────────────────────────────────────
 *
 * One stream, keyed `sendings`, which no other pass uses. A world in which no
 * house sends anybody draws exactly what it drew before this pass existed.
 */
function applySendings(state: WorldState, year: number, day: number): number {
    const rng = forStream(state.seed, 'sendings', year);
    const roster = new Map<string, Candidate[]>();
    const at = new Map<string, number>();
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i];
        at.set(npc.id, i);
        if (npc.status !== 'alive' || !npc.factionId) continue;
        // The player's mirror row is never spent by the world. Sending the
        // character on an errand they did not take is the engine taking a
        // decision that is theirs.
        if (!isTheWorldsToMove(npc)) continue;
        const bucket = roster.get(npc.factionId);
        const row = { id: npc.id, name: npc.name, ordinal: npc.cultivation.realmOrdinal };
        if (bucket) bucket.push(row); else roster.set(npc.factionId, [row]);
    }

    let sent = 0;
    for (const faction of state.factions) {
        if (faction.dissolvedOnDay !== null || !isBelowTheLid(faction)) continue;
        const party0 = roster.get(faction.id);
        if (!party0 || party0.length === 0) continue;

        // A solvent house keeps something in the yard. The writer
        // `adjustCountedHolding` never had, and the only thing it changes is
        // how long a posting takes.
        const carriage = requireConveyance('conv-carriage-earth');
        if (
            countedHolding(faction.resources, carriage.id) === 0
            && (faction.resources.spirit_stones ?? 0) >= A_CARRIAGE_COSTS
        ) {
            faction.resources = adjustCountedHolding(faction.resources, carriage.id, 1);
            faction.resources.spirit_stones =
                (faction.resources.spirit_stones ?? 0) - A_CARRIAGE_COSTS;
        }

        if (!rng.chance(SENDINGS_PER_HOUSE_YEAR)) continue;

        const house: HouseAsItStands = {
            id: faction.id,
            name: faction.name,
            holdsGround: faction.controlledLocationIds.length > 0,
            standing: faction.standing,
            // Read off what the world already holds rather than a new store:
            // an unopened site anybody could go and dig.
            hasAFind: state.locations.some(
                l => l.kind === 'ruin' && !l.sealed && l.controllingFactionId === faction.id
            )
        };
        const reasons = reasonsOpenTo(house);
        if (reasons.length === 0) continue;
        const reason = weighted(rng, reasons, r => r.weight);
        if (!reason) continue;

        // What the errand is pitched at. AT OR BELOW THE HOUSE'S OWN BEST,
        // mostly, and that skew is the whole of `summonable`'s ruling applied
        // to a pitch instead of to an offer: a house sends people at work it
        // expects them to come back from. The draw still reaches a rung above
        // them now and again, which is where a sending becomes a story.
        //
        // Measured with the draw centred instead - `best + rng.int(-3, 6)`,
        // then `-3, 3` - the pyramid's top third fell from 92 to 53 over five
        // pooled seeds, because half of every house's errands were pitched
        // above its own people and `whoTheHouseCanSend` sends the strongest.
        // A wiring change is not allowed to restructure the population, and
        // this is the term that decides whether it does.
        const best = party0.reduce((n, c) => Math.max(n, c.ordinal), 0);
        const posting = postingFor({
            reason,
            house,
            pitchOrdinal: best + rng.int(-5, 1),
            locationId: faction.seatLocationId,
            // What they went on. Null is walking, and walking is what the
            // reason's own term already assumes.
            conveyance: countedHolding(faction.resources, carriage.id) > 0 ? carriage : null
        });
        const party = whoTheHouseCanSend(posting, party0);
        if (party.length === 0) continue;

        // A HOUSE DOES NOT SEND PEOPLE AT SOMETHING IT EXPECTS TO LOSE THEM
        // TO. `duties.ts` has said so since it was written and the sending
        // module names the same two bands - the difference between the two
        // files is the whole ruling: the house declines to send, and a board
        // may still carry one, and the world declines to stop somebody taking
        // it off the wall. This is the house's half, and it is the module's
        // own predicate rather than a threshold invented here.
        //
        // Measured without it, at a pitch drawn up to six rungs above the
        // party's best: 3,396 people went missing over five centuries against
        // a standing population under six hundred. That is not a world with
        // dangerous errands in it, it is a world whose institutions feed
        // themselves to their own noticeboards.
        if (isImpossibleTier(tierFor(posting, party).band)) continue;

        const sending = resolveSending({
            posting,
            party,
            departsOnDay: day,
            rng,
            location: faction.seatLocationId
                ? state.locations.find(l => l.id === faction.seatLocationId) ?? null
                : null
        });
        sent++;

        for (const missing of sending.lost) {
            const index = at.get(missing.id);
            if (index === undefined) continue;
            state.npcs[index] = markMissing(
                state.npcs[index],
                sending.returnsOnDay,
                `Went out for ${faction.name} on ${reason.name.toLowerCase()} and did not come back.`
            );
        }

        // ── AND ONLY WHAT IS WORTH REPEATING BECOMES NEWS ────────────
        //
        // `magnitudeOf`'s own sentence: an errand three rungs below the party
        // is one nobody mentions twice. A house has somebody out most of the
        // time and the ledger is not a newsfeed - measured with every routine
        // errand written, sendings were 7,275 of 15,519 facts in the world,
        // which is a chronicle that is half other people's paperwork.
        //
        // What is kept is what the module already decides is heavy, plus
        // anything that did not go as stated, because a party that did not
        // come back is news at any tier.
        // WHAT CAME HOME GOES IN THE YARD. The second destination a beast
        // material has, which until now did not exist: it went into a pill or
        // into something somebody fights with, and that made the whole
        // material economy a single pipe. See `applyConveyanceBuilding`.
        if (sending.outcome === 'finished' && reason.id === 'sending-for-materials') {
            creditWhatCameBack(faction, partyOrdinal(party), party.length);
        }

        const news = newsOfASending(sending, { onDay: sending.returnsOnDay });
        if (sending.outcome !== 'finished' || news.magnitude >= WORTH_REPEATING) {
            appendWorldFact(state, news);
        }
    }
    return sent;
}

// ─────────────────────────────────────────────────────────────────────────
// THE YARD
//
// `building-a-conveyance-out-of-what-a-hunt-brings-back.ts` had no consumer
// anywhere in `src/` - `layDownKeel`, `deliver`, `workOn`, `readyToLaunch`,
// `lotSatisfies`, `whatIsStillShort`, `conveyanceKeptAs` and `mintCraft` were
// all zero-reference - so the second destination that file exists to give a
// beast material did not exist, and `TRACKED_CRAFT` was a catalog of hulls
// nobody in the world had ever built.
//
// THE LOOP IS THE ONE THAT FILE ARGUES FOR, AND NOTHING ABOUT IT IS NEW.
// A house sends people out after materials; what comes back is a grade and a
// count and a core or not; the bill wants a quantity at a grade rather than a
// named thing; and a house that gets one craft gets its next one faster,
// because the craft carries the party that takes the next core. That is the
// whole economy and every term of it was already written.
//
// WHERE IT IS KEPT. `FactionRecord.resources` is a free-form
// `Record<string, number>` with a stated convention, and both halves of this
// are numbers: what the yard holds, and how far along the slip is. No new
// field, no migration, and `describeCountedHoldings` already answers what a
// house has. A `Berth` is reconstructed from those cells each pass rather than
// stored as an object, which is the same "derive rather than store" the ground
// module keeps.
// ─────────────────────────────────────────────────────────────────────────

/**
 * How many of one kind a house keeps before it starts building the next one up.
 *
 * A yard builds what the house is short of. Without a ceiling a house builds
 * the same carriage forever and never reaches for the bill above it - measured
 * at five centuries, one house standing on eight of them and no house in the
 * world having ever laid a keel for anything tracked.
 */
const ENOUGH_IN_THE_YARD = 2;

/** What the yard holds, at a grade. Plain material, and cores separately. */
function yardKey(grade: TechniqueGrade, core: boolean): string {
    return `yard.${core ? 'core' : 'material'}.${grade}`;
}

/** How far the slip has got. One cell per line of the bill, plus the work. */
function berthKey(recipeId: string, what: string): string {
    return `berth.${recipeId}.${what}`;
}

/**
 * What a finished sending after materials brought home.
 *
 * The party's own rung decides the grade, through `gradeForOrdinal` and
 * nothing else - the same gate the ground pressure reads, for the same reason:
 * you bring back what answers your hand. A core only where the party stood at
 * `BEAST_CORE_ORDINAL` or above, which is the catalog's own line and is why a
 * core is the one entry in a bill a house cannot buy its way past cheaply.
 */
const WHAT_A_PARTY_BRINGS_BACK = 6;

function creditWhatCameBack(faction: FactionRecord, partyOrdinal: number, hands: number): void {
    const grade = gradeForOrdinal(partyOrdinal);
    const bulk = Math.max(1, Math.round(WHAT_A_PARTY_BRINGS_BACK * Math.max(1, hands) / 5));
    const key = yardKey(grade, false);
    faction.resources[key] = (faction.resources[key] ?? 0) + bulk;
    if (partyOrdinal >= BEAST_CORE_ORDINAL) {
        const cores = yardKey(gradeForOrdinal(partyOrdinal), true);
        faction.resources[cores] = (faction.resources[cores] ?? 0) + 1;
    }
}

/** The yard, in the three fields a bill reads. Nothing else is looked at. */
function lotsInTheYard(faction: FactionRecord): MaterialLot[] {
    const lots: MaterialLot[] = [];
    for (const grade of STOCK_GRADES) {
        for (const core of [false, true]) {
            const count = faction.resources[yardKey(grade, core)] ?? 0;
            if (count > 0) lots.push({ id: yardKey(grade, core), grade, core, count });
        }
    }
    return lots;
}

/**
 * Houses build, and now and again one of them launches.
 *
 * Every decision belongs to the craft module. What happens here is reading the
 * yard off the ledger into `MaterialLot`s, reconstructing the slip from the
 * cells that hold it, handing both over, and writing the answer down.
 *
 * A house works at ONE recipe - the best its own hands can take, which is
 * `canRefineGrade`'s question and not this file's - because a yard split
 * across three slips finishes none of them, which is the same reason the
 * module makes work unable to outrun the materials.
 */
function applyConveyanceBuilding(state: WorldState, year: number, day: number): number {
    let launched = 0;
    for (const faction of state.factions) {
        if (faction.dissolvedOnDay !== null || !isBelowTheLid(faction)) continue;

        const hands: number[] = [];
        for (const npc of state.npcs) {
            if (npc.status === 'alive' && npc.factionId === faction.id) {
                hands.push(npc.cultivation.realmOrdinal);
            }
        }
        if (hands.length === 0) continue;
        const best = hands.reduce((n, o) => Math.max(n, o), 0);

        // The deepest bill this house could work at all. `canRefineGrade` is
        // the gate and it is the same one that decides who refines a grade of
        // medicine - a hull is made of the same four grades a pill is, and a
        // second table here would be a second opinion about the ladder.
        //
        // AND NOT ONE IT ALREADY HAS ENOUGH OF. Without this a house builds
        // the same carriage forever - measured, one house held eight of them
        // at five centuries - and never reaches for the bill above it, which
        // is the bill that produces the only tracked craft anybody makes. A
        // yard builds what the house is short of.
        const recipe = [...CONVEYANCE_RECIPES]
            .filter(r => canRefineGrade(r.grade, best))
            .filter(r => conveyanceKeptAs(r.grade) === 'tracked'
                ? !state.objects.some(o =>
                    o.ownerId === faction.id
                    && o.data.conveyanceId === r.producesConveyanceId)
                : countedHolding(faction.resources, r.producesConveyanceId) < ENOUGH_IN_THE_YARD)
            // CHEAPEST FIRST, which is the progression the craft module
            // describes rather than an ordering chosen here: a house that gets
            // one craft gets its next one faster, because the craft carries
            // the party that takes the next core. Deepest-first had every
            // qualified house laying a keel for a spirit boat on day one and
            // still short of the bill five centuries later, so no tracked
            // craft was ever built by anybody.
            .sort((a, b) => a.workDays - b.workDays)[0];
        if (!recipe) continue;

        // The slip, off the cells that hold it. `spent` is not carried across
        // years: what it is for is the argument about a build that failed, and
        // the argument the world can have is the fact this writes.
        let berth: Berth = {
            ...layDownKeel(recipe),
            delivered: recipe.components.map(
                (_, i) => faction.resources[berthKey(recipe.id, `line${i}`)] ?? 0
            ),
            workDaysDone: faction.resources[berthKey(recipe.id, 'work')] ?? 0
        };

        berth = deliver(berth, recipe, lotsInTheYard(faction));
        // What went onto the slip came out of the yard. `deliver` reports it by
        // lot id and the lot ids ARE the ledger keys, which is why they are
        // built from `yardKey` rather than named.
        for (const [key, taken] of Object.entries(berth.spent)) {
            faction.resources[key] = Math.max(0, (faction.resources[key] ?? 0) - taken);
        }
        const worked = workOn(berth, recipe, { days: DAYS_PER_YEAR, hands });
        berth = worked.berth;

        for (let i = 0; i < recipe.components.length; i++) {
            faction.resources[berthKey(recipe.id, `line${i}`)] = berth.delivered[i] ?? 0;
        }
        faction.resources[berthKey(recipe.id, 'work')] = berth.workDaysDone;

        if (!readyToLaunch(berth, recipe)) continue;

        // Seeded per house per year, so two houses working the same bill with
        // the same best hand do not get the same answer - which they would off
        // the recipe and the ordinal alone.
        const outcome = launch(`${state.seed}:${faction.id}:${year}`, berth, recipe, best);
        for (let i = 0; i < recipe.components.length; i++) {
            faction.resources[berthKey(recipe.id, `line${i}`)] = 0;
        }
        faction.resources[berthKey(recipe.id, 'work')] = 0;
        if (!outcome.launched) {
            // A failure consumes the materials and leaves the yard with
            // nothing. That is the honest price and it is why a heaven-grade
            // launch is an event a house remembers.
            appendWorldFact(state, makeFact({
                day,
                kind: 'catastrophe',
                scale: 'local',
                summary:
                    `${faction.name} lost ${recipe.name.toLowerCase()} on the slip. `
                    + outcome.narrationHint,
                locationId: faction.seatLocationId,
                factionIds: [faction.id],
                actors: [],
                visibility: 'regional',
                magnitude: 0.3,
                data: { conveyanceRecipe: recipe.id, launched: 0 }
            }));
            continue;
        }
        launched++;

        // WHICH SIDE OF THE LINE IT LANDS ON IS THE GRADE'S AND NOTHING MOVES
        // IT. `conveyanceKeptAs` is the single authority and every caller asks
        // it rather than deciding separately - a counted craft increments a
        // line, and only a tracked one becomes a row with a past.
        const trackedNow = conveyanceKeptAs(recipe.grade) === 'tracked';
        if (trackedNow) {
            const record = mintCraft(recipe, {
                id: `obj-craft-${faction.id}-${year}`,
                name: recipe.name,
                ownerId: faction.id,
                ownerName: faction.name,
                wrightId: faction.id,
                wrightName: faction.name,
                bestHandOrdinal: best,
                onDay: day,
                mooredAt: faction.seatLocationId ?? '',
                description: `Built at ${faction.name}'s own yard.`
            });
            if (record) state.objects.push(record);
        } else {
            faction.resources = adjustCountedHolding(
                faction.resources, recipe.producesConveyanceId, 1
            );
        }

        appendWorldFact(state, makeFact({
            day,
            kind: 'treasure_found',
            scale: trackedNow ? 'regional' : 'local',
            summary:
                `${faction.name} launched ${recipe.name.toLowerCase()} out of its own yard, at `
                + `${recipe.grade} grade, over ${recipe.workDays} days of work.`,
            locationId: faction.seatLocationId,
            factionIds: [faction.id],
            actors: [],
            visibility: trackedNow ? 'public' : 'regional',
            magnitude: trackedNow ? 0.6 : 0.25,
            data: {
                conveyanceRecipe: recipe.id,
                launched: 1,
                keptAs: conveyanceKeptAs(recipe.grade),
                ratedAt: outcome.ratedAt ?? 0
            }
        }));
    }
    return launched;
}

/** A weighted draw over a small list. Seeded, so a world replays identically. */
function weighted<T>(rng: CultivationRNG, rows: readonly T[], weightOf: (row: T) => number): T | null {
    if (rows.length === 0) return null;
    const total = rows.reduce((sum, row) => sum + Math.max(0, weightOf(row)), 0);
    if (total <= 0) return rows[rng.int(0, rows.length - 1)];
    let cursor = rng.next() * total;
    for (const row of rows) {
        cursor -= Math.max(0, weightOf(row));
        if (cursor < 0) return row;
    }
    return rows[rows.length - 1];
}

function applyFactionEconomy(state: WorldState): void {
    for (const faction of state.factions) {
        if (faction.dissolvedOnDay !== null || !isBelowTheLid(faction)) continue;
        let members = 0;
        for (const npc of state.npcs) {
            if (npc.status === 'alive' && npc.factionId === faction.id) members++;
        }
        const veins = faction.resources.veins ?? 0;
        const production = Number(faction.resources.production ?? 0.5);
        const income = veins * 5_000 * (0.5 + production) + members * 30;
        const upkeep = members * 45 + (faction.resources.tribute_owed_per_year ?? 0) * 0.1;
        faction.resources.spirit_stones = Math.max(
            0,
            Math.round((faction.resources.spirit_stones ?? 0) + income - upkeep)
        );
        faction.resources.members = members;
    }
}

/**
 * Draw a template, bind it, apply it.
 *
 * Templates that cannot bind are skipped and the draw is retried a bounded
 * number of times. Returning null is a legitimate outcome: a year in which the
 * world offered nothing worth recording is a year in which nothing happened,
 * and long mundane stretches are correct.
 */
function fireOne(state: WorldState, day: number, rng: CultivationRNG): PressureEvent | null {
    const table = TEMPLATES;
    const total = table.reduce((sum, t) => sum + t.weight, 0);

    for (let attempt = 0; attempt < 6; attempt++) {
        let cursor = rng.next() * total;
        let chosen = table[table.length - 1];
        for (const t of table) {
            cursor -= t.weight;
            if (cursor < 0) {
                chosen = t;
                break;
            }
        }
        const event = chosen.apply(state, day, rng);
        if (event) return event;
    }
    return null;
}

interface Template {
    kind: PressureKind;
    weight: number;
    /** Returns null when the world offers nothing for this template to act on. */
    apply(state: WorldState, day: number, rng: CultivationRNG): PressureEvent | null;
}

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

function liveFactions(state: WorldState): FactionRecord[] {
    return state.factions.filter(f => f.dissolvedOnDay === null && isBelowTheLid(f));
}

// ─────────────────────────────────────────────────────────────────────────
// WHO IS OLD ENOUGH TO DIE OF BEING OLD
//
// The `elder_died` event picked uniformly from everybody at a senior rank and
// killed them, and it never looked at how long they had left. That is fatal to
// the setting, and measurably so: seeded and advanced, the world's six
// strongest went 44,41,38,37,36,36 at seeding to a flat 12 by year 300, with
// every apex head, court seat and named figure dead and nothing above ordinal
// 20 alive anywhere.
//
// The cause was not that cultivation fails to advance. It is that a realm's
// LIFESPAN is the whole of what a high realm buys, and this event ignored it.
// An ordinal 44 has a hundred thousand years and is seeded a quarter of the
// way through, so it should be effectively permanent on any horizon a run
// reaches - and it was being ground out by the same roll that retires a
// Foundation Establishment elder at four hundred.
//
// `the-late-age.md` says figures older than anything now living walk through
// this world constantly. The simulation was producing the exact opposite: a
// world that had giants at seeding and none a century later.
//
// The fix is to read the number that already exists. Weighted by how much of
// their own span somebody has spent, squared, so it falls away fast:
//
//   spent  5%  ->  0.0025   effectively never
//   spent 50%  ->  0.25
//   spent 95%  ->  0.90     the ordinary answer to "an elder died"
//
// A weighting rather than a filter, because the causes this event names are
// not all age - "an old wound" and "a breakthrough that did not hold" can
// reach somebody early, and should stay possible and rare. What must not
// happen is a hundred-thousand-year being dying of age at twenty-five
// thousand, which is what was happening.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The most rungs a killer can give away and still manage it.
 *
 * Three, and it is the combat layer's own number rather than a new one:
 * `MAX_EDGE_MULTIPLIER` caps everything a person can bring to a fight at about
 * two rungs' worth, so somebody four or more below cannot get there however
 * the day goes. AGENTS.md states the same thing from the other side - a
 * four-rank gap is not a hard fight, it is a death.
 *
 * This event was not checking at all. It picked a victim uniformly from every
 * living person in the world and then a killer from whoever was standing
 * nearby, so an ordinal 44 was exactly as murderable as a farmhand, by a
 * farmhand. That is the single largest contradiction the world layer contained:
 * `standoff.ts` spends four hundred lines measuring who could kill an apex
 * head and concluding almost nobody, off the real resolver, while this rolled
 * eleven times a century and did it for free.
 */
const CASUAL_KILL_MAX_GAP = 3;

/**
 * The advantage at which one house can simply end another.
 *
 * The same number from the same place: `CASUAL_KILL_MAX_GAP` is the most a
 * killer can give away and still manage it, so a house that is that much
 * stronger than another can reach everybody in it. It is not a new margin and
 * it must not become one - if the combat layer's edge cap moves, this moves
 * with it, because they are the same fact stated twice.
 */
const DECISIVE_MARGIN = CASUAL_KILL_MAX_GAP + 1;

/** Whether this person could actually kill that one, on the ordinary ladder. */
function couldKill(killer: NpcRecord, victim: NpcRecord): boolean {
    return killer.cultivation.realmOrdinal >= victim.cultivation.realmOrdinal - CASUAL_KILL_MAX_GAP;
}

// ─────────────────────────────────────────────────────────────────────────
// THE LONGEST PROJECT IN THE WORLD
//
// A cultivator at Tribulation Transcendence has a hundred thousand years and
// is spending twenty to fifty thousand of them on one attempt at the last
// crossing - twenty only for a prodigy. Five centuries is half a per cent of
// that. So the top of the ladder should be very nearly STATIC across any
// horizon a run reaches, and a figure dropping off it should be a named event
// with a cause somebody could tell you, not attrition.
//
// It was attrition. Measured over 500 years, the strongest went 44 to 38, and
// the two that went were taken by generic pools: an ordinal 41 by
// `technique_lost` ("went out and did not come back") and an ordinal 38 by
// `elder_died`. Those events are about ordinary institutional life - a senior
// retires, somebody wanders off, an art stops being transmitted - and somebody
// in the middle of the last crossing is not in that category and should not be
// in those pools.
//
// Two things follow, and they are the whole of this block.
//
// FIRST, they come out of the AGE pool, and only that one. Dying of age at a
// quarter of a hundred-thousand-year span is not a thing that happens.
//
// They stay in the disappearance and lost-art pools deliberately, because being
// unaccounted for is the ORDINARY condition of somebody at this height: at 44
// almost nobody is seen from one century to the next, and `missing` says
// exactly that - whereabouts unknown, aliveness genuinely unresolved. What had
// to change for that to be survivable was the INSTRUMENT rather than the event.
// `worldShape` counted only `alive`, so an ordinary disappearance read as the
// ceiling dropping. See `EXTANT_STATES` in `driver.ts`.
//
// SECOND, they get the project. Nothing advanced a high-ordinal NPC at all -
// `applyAdvancement` caps everybody at their region's `localCeilingOrdinal`,
// which is about twenty - so a 44 was a body waiting to die rather than
// somebody a long way into something. `applyLastCrossing` is that something,
// and it fires at the rate the attempt actually takes, which means it will
// almost never fire in five hundred years. That is the point: the event exists
// so that when the top of the world does change, there is a reason with a name
// on it.
// ─────────────────────────────────────────────────────────────────────────

/** The realm at which somebody stops being ordinary institutional life. */
const LAST_PROJECT_REALM = 'tribulation_transcendence';

/** Whether this person is in the middle of the longest project in the world. */
function isOnTheLastProject(npc: NpcRecord): boolean {
    return realmForOrdinal(npc.cultivation.realmOrdinal).key === LAST_PROJECT_REALM;
}

/**
 * Years one attempt at the last crossing consumes.
 *
 * The user's figure, and it is the number the whole timescale rests on: twenty
 * thousand for a prodigy, fifty for everybody else, out of a hundred thousand
 * year lifespan. The midpoint is used because the world layer does not model
 * who is a prodigy; `deriveLife` already spent that distinction at creation.
 */
const LAST_CROSSING_YEARS = 35_000;

/**
 * The attempt, and its three endings.
 *
 * Rare to the point of being almost theoretical on a five-century horizon -
 * about one chance in seventy per figure - which is exactly right. The value of
 * this pass is not that it fires; it is that when the top of the world changes
 * there is a named cause rather than a pool.
 *
 * The three outcomes are the ones the setting already models:
 *
 *   TRUE IMMORTAL   they cross, and leave. `IMMORTAL_LAYER` takes them out of
 *                   every below-the-Lid pool in the engine, which is what
 *                   crossing means - the world does not keep them.
 *   FALSE IMMORTAL  the half-failure `false-immortals.ts` is about. They
 *                   survive, they are still here, and they are no longer on
 *                   the ladder. A house has not lost them; it has lost what
 *                   they were FOR, which is a better story than a headcount.
 *   DEATH           the tribulation takes them, which is the ordinary result.
 */
function applyLastCrossing(
    state: WorldState,
    year: number,
    day: number
): NpcRecord[] {
    const out: NpcRecord[] = [];
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i];
        if (npc.status !== 'alive' || !isBelowTheLid(npc)) continue;
        if (npc.cultivation.realmOrdinal !== LAST_CROSSING_ORDINAL) continue;

        const rng = forStream(state.seed, 'last-crossing', year, npc.id);
        if (!rng.chance(1 / LAST_CROSSING_YEARS)) continue;

        // The engine's own figure for what the crossing is worth, rather than
        // one invented here. Everything it does not take is split between the
        // half-failure and the tribulation, weighted toward the tribulation,
        // because seven of the eight False Immortals anybody can name are
        // historical and the graveyard is not enumerable at all.
        const roll = rng.next();
        const crossed = baseBreakthroughChance(LAST_CROSSING_ORDINAL);
        const halfFailed = crossed + (1 - crossed) * 0.35;

        if (roll < crossed) {
            state.npcs[i] = {
                ...npc,
                cultivation: { ...npc.cultivation, realmOrdinal: TRUE_IMMORTAL_ORDINAL },
                layer: IMMORTAL_LAYER,
                updatedOnDay: day
            };
        } else if (roll < halfFailed) {
            state.npcs[i] = {
                ...npc,
                cultivation: { ...npc.cultivation, realmOrdinal: FALSE_IMMORTAL_ORDINAL },
                updatedOnDay: day
            };
        } else {
            state.npcs[i] = markDead(
                npc,
                day,
                'Did not survive the last crossing.'
            );
        }
        out.push(state.npcs[i]);
    }
    return out;
}

// ─────────────────────────────────────────────────────────────────────────
// THE WORLD OPENS SOMETHING, AND NOBODY DID IT
//
// An immortal's pavilion, sealed for four hundred years, with its owner long
// dead. It opens because the cycle came round. There is no actor, no motive and
// no beneficiary until somebody happens to be near enough to walk in - and the
// event fires identically whether anybody is or not.
//
// That indifference is the design. Every other template in this file is
// somebody doing something to somebody; this one is the world's own clock, and
// it should read as the world doing something rather than the world doing
// something TO YOU. It is also the only template that creates an opportunity
// rather than a loss.
//
// It is not in TEMPLATES and must not be added to it. A weighted draw would
// make the schedule a function of how eventful the year was.
// ─────────────────────────────────────────────────────────────────────────

function applyConvergences(
    state: WorldState,
    year: number,
    fromDay: number,
    toDay: number
): PressureEvent[] {
    const out: PressureEvent[] = [];
    const yearStart = year * 365;
    const yearEnd = yearStart + 364;

    for (let i = 0; i < state.locations.length; i++) {
        const location = state.locations[i];
        if (!location.cycle || !isBelowTheLid(location)) continue;

        const opensOn = nextOpeningDay(location, Math.max(yearStart, fromDay));
        const opened = opensOn !== null && opensOn <= Math.min(yearEnd, toDay);

        if (opened && location.sealed) {
            const day = withinSpan(opensOn!, fromDay, toDay);
            const years = Math.round(location.cycle.periodDays / DAYS_PER_YEAR);
            const changed = applyLocationChange(location, {
                onDay: day,
                kind: 'unsealed',
                summary: `${location.name} is open. It was last open ${years} years ago.`,
                // The cause is known and is nobody: it is the cycle. That is a
                // different thing from an unexplained change and should not be
                // filed as one.
                causeKnown: true,
                witnessed: false,
                patch: {
                    sealed: false,
                    discovered: true,
                    environment: { spiritualDensity: qiFraction(location.qiDensity) },
                    addTags: ['open_now']
                }
            });
            state.locations[i] = changed.location;

            out.push(emit(state, 'convergence_opened', day, {
                day,
                kind: 'opportunity',
                scale: 'regional',
                summary: changed.change.summary,
                locationId: location.id,
                locationChangeIds: [changed.change.id],
                visibility: 'public',
                magnitude: 0.7,
                data: {
                    openDays: location.cycle.openDays,
                    periodYears: years
                },
                unattributed:
                    'The pass that has never gone anywhere goes somewhere this season. '
                    + 'Nobody arranged it and nobody local can say how long it lasts.',
                consequences: {
                    immediate: 'It is open, and whoever left it is not coming.',
                    physical: `${location.name} is reachable.`,
                    opportunitiesOpened: [
                        `${location.cycle.openDays} days inside ${location.name}.`
                    ],
                    tenYearsLater: 'Shut again, and the people who did not go are still '
                        + 'explaining why they did not.'
                }
            }, { locations: [location.id] }));
            continue;
        }

        // And it shuts, which is the half that makes the opening mean anything.
        const closesOn = nextClosingDay(location, Math.max(yearStart, fromDay));
        if (!location.sealed && location.tags.includes('open_now')
            && closesOn !== null && closesOn <= Math.min(yearEnd, toDay)) {
            const day = withinSpan(closesOn, fromDay, toDay);
            const changed = applyLocationChange(location, {
                onDay: day,
                kind: 'sealed',
                summary: `${location.name} is shut again.`,
                causeKnown: true,
                witnessed: false,
                patch: {
                    sealed: true,
                    environment: { spiritualDensity: 0.05 },
                    removeTags: ['open_now']
                }
            });
            state.locations[i] = changed.location;

            out.push(emit(state, 'convergence_closed', day, {
                day,
                kind: 'opportunity',
                scale: 'local',
                summary: changed.change.summary,
                locationId: location.id,
                locationChangeIds: [changed.change.id],
                visibility: 'public',
                magnitude: 0.4,
                unattributed: 'The pass does not go anywhere any more.',
                consequences: {
                    immediate: 'Anybody still inside is still inside.',
                    opportunitiesClosed: [`${location.name}, for a very long time.`],
                    tenYearsLater: 'A list of who went in and a shorter list of who came out.'
                }
            }, { locations: [location.id] }));
        }
    }
    return out;
}

/** How much of their own realm's span this person has spent, 0..1. */
function lifeSpent(npc: NpcRecord, day: number): number {
    const span = lifespanForOrdinal(npc.cultivation.realmOrdinal);
    if (!Number.isFinite(span) || span <= 0) return 1;
    const age = (day - npc.identity.bornOnDay) / DAYS_PER_YEAR;
    return Math.max(0, Math.min(1, age / span));
}

/**
 * Pick somebody to have died of their own mortality, or nobody.
 *
 * Weighted by spent lifespan squared. Returns null when the pool is empty or
 * when the roll lands in the enormous slack held by people with centuries in
 * front of them, which is the correct and common answer.
 */
function pickByMortality(
    rng: CultivationRNG,
    candidates: readonly NpcRecord[],
    day: number
): NpcRecord | null {
    if (candidates.length === 0) return null;
    const weights = candidates.map(n => {
        const spent = lifeSpent(n, day);
        return spent * spent;
    });
    const total = weights.reduce((sum, w) => sum + w, 0);
    // Nobody in the pool is anywhere near the end of themselves. That is not a
    // failure of the event; it is the event correctly declining to fire.
    if (total <= 0) return null;
    let cursor = rng.next() * total;
    let chosen = candidates[candidates.length - 1];
    for (let i = 0; i < candidates.length; i++) {
        cursor -= weights[i];
        if (cursor < 0) { chosen = candidates[i]; break; }
    }

    // AND AN ACCEPTANCE ROLL, which is the half that matters.
    //
    // A weighting only re-orders a pool; it never lets the event decline to
    // fire. The senior pool is small and at times consists entirely of people
    // with most of themselves left, and a pure weighting still killed one of
    // them every time the roll came up - which is why the first version of
    // this fix moved the numbers and did not save anybody.
    //
    // Rolling again against the chosen person's own spent fraction makes the
    // absolute rate scale with how old the pool actually is. A cohort with
    // centuries in front of it produces almost no deaths, which is the correct
    // answer and was the missing one.
    return rng.chance(lifeSpent(chosen, day)) ? chosen : null;
}

function pick<T>(rng: CultivationRNG, items: readonly T[]): T | null {
    return items.length === 0 ? null : items[rng.int(0, items.length - 1)];
}

/**
 * The people the world may pick to DO something.
 *
 * Everybody except the player's own mirror row. An event template that draws an
 * actor is the world deciding that somebody opened a hall, took an opportunity,
 * killed somebody, walked into the hills or worked on a neighbour - and it
 * writes a chronicle fact saying so. Drawn on the player, that is the engine
 * asserting the player did a thing they never did, in a layer the play loop
 * never saw, and the next refresh silently discards the state while the fact
 * stays. See `PLAYER_ROW_TAG`.
 *
 * The world may still COUNT them - how many people live in this province,
 * whether anybody alive still holds this art - because those are true about
 * them. What it may not do is act as them.
 */
function theWorldsPeople(state: WorldState): NpcRecord[] {
    return state.npcs.filter(isTheWorldsToMove);
}

function membersOf(state: WorldState, factionId: string): NpcRecord[] {
    return state.npcs.filter(
        n => n.factionId === factionId && n.status === 'alive' && isBelowTheLid(n)
    );
}

function veinsOf(state: WorldState, factionId: string): LocationRecord[] {
    return state.locations.filter(
        l => l.kind === 'vein' && isBelowTheLid(l) && l.controllingFactionId === factionId
    );
}

function replaceLocation(state: WorldState, next: LocationRecord): void {
    const at = state.locations.findIndex(l => l.id === next.id);
    if (at >= 0) state.locations[at] = next;
}

function replaceNpc(state: WorldState, next: NpcRecord): void {
    const at = state.npcs.findIndex(n => n.id === next.id);
    if (at >= 0) state.npcs[at] = next;
}

/**
 * Somebody takes it personally.
 *
 * Institutions hold positions; people hold accounts, and only the personal row
 * is inheritable - a faction's hostility dies with the faction, whereas a
 * grudge outlives its owner and lands on an heir. So whenever one faction takes
 * something from another, one named member of each side ends up in a row
 * together. Which two is a draw; that it happens at all is not.
 *
 * This is a state update, not a decision model: nobody here reasons about
 * whether to be aggrieved.
 */
function openPersonalAccount(
    state: WorldState,
    loserId: string,
    winnerId: string,
    day: number,
    note: string,
    rng: CultivationRNG
): string[] {
    const aggrieved = pick(rng, membersOf(state, loserId));
    const taker = pick(rng, membersOf(state, winnerId));
    if (!aggrieved || !taker) return [];
    const at = state.npcs.findIndex(n => n.id === aggrieved.id);
    if (at < 0) return [];
    state.npcs[at] = upsertRelationship(state.npcs[at], {
        targetId: taker.id,
        targetName: taker.name,
        kind: 'enemy',
        standing: -0.75,
        note
    }, day);
    return [aggrieved.id, taker.id];
}

function adjustStandingBetween(a: FactionRecord, b: FactionRecord, delta: number): void {
    a.standing[b.id] = clamp((a.standing[b.id] ?? 0) + delta, -1, 1);
    b.standing[a.id] = clamp((b.standing[a.id] ?? 0) + delta, -1, 1);
}

/** Factions that have a reason to move against this one. */
function rivalsOf(state: WorldState, faction: FactionRecord): FactionRecord[] {
    return liveFactions(state).filter(
        f => f.id !== faction.id && (f.standing[faction.id] ?? 0) <= -0.3
    );
}

function emit(
    state: WorldState,
    kind: PressureKind,
    day: number,
    fact: Omit<Parameters<typeof makeFact>[0], 'consequences'> & {
        consequences?: Partial<EventConsequences>;
        /**
         * What a player who cannot name any of the actors would notice instead.
         * Stored on the fact so the digest can render an unattributed
         * consequence without inventing one.
         */
        unattributed: string;
    },
    touched: Partial<PressureEvent['touched']> = {},
    deaths: DeathHandoff[] = []
): PressureEvent {
    const { consequences, unattributed, ...rest } = fact;
    const stored = appendWorldFact(state, makeFact({
        ...rest,
        consequences: consequences ? fillConsequences(consequences) : null,
        data: { ...(rest.data ?? {}), unattributed, pressure: kind }
    }));
    return {
        kind,
        onDay: day,
        fact: stored,
        touched: {
            factions: touched.factions ?? [],
            locations: touched.locations ?? [],
            npcs: touched.npcs ?? []
        },
        deaths
    };
}

/**
 * Keep a generated date inside the span that was actually advanced.
 *
 * A year is stepped as a whole even when the caller asked for part of one, so
 * an event drawn late in the year can fall past the clock. Clamping the date
 * rather than skipping the event keeps the year's content intact and the
 * ledger coherent - nothing is ever dated after the day the world has reached.
 */
function withinSpan(day: number, fromDay: number, toDay: number): number {
    return Math.max(fromDay, Math.min(toDay, day));
}

/**
 * A house name with its article stripped, for summaries that supply their own.
 *
 * Catalog names are inconsistent about it by design - "the Kang Hall", "The
 * Severed", "Bone Lantern Cult" - and a summary that writes "of the ${name}"
 * against the first two produced "of the the Kang Hall" in the middle of
 * somebody's biography.
 */
function houseName(name: string): string {
    return name.replace(/^[Tt]he\s+/, '');
}

function clamp(n: number, lo: number, hi: number): number {
    if (!Number.isFinite(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
}

// ─────────────────────────────────────────────────────────────────────────
// THE TABLE
// Weights are relative. Ordinary institutional churn is common; a faction
// ending is rare; a region turning forbidden is rarer still.
// ─────────────────────────────────────────────────────────────────────────

const TEMPLATES: Template[] = [
    // ── A house is ended by another house, and then the survivors choose.
    //
    //    The only template that does not finish in one step. Everything after
    //    the binding is `cascade.ts`: what the survivors do, and if they wake
    //    what is under the hall, what THAT does. The chain is priced off state
    //    that already exists and stops wherever the arithmetic stops it, which
    //    is usually immediately.
    //
    //    Rare on purpose - weight 2, the same as a region turning forbidden -
    //    because this is the event that can permanently remove ground from the
    //    map, and the map has to be worth something for that to matter.
    {
        kind: 'house_destroyed',
        weight: 2,
        apply(state, day, rng) {
            // Bind to a pair the world already contains: somebody hostile, and
            // decisively stronger. Nothing is chosen; if the province has no
            // such pair this year, nothing happens, which is correct.
            const live = liveFactions(state);
            const pairs: { victim: FactionRecord; aggressor: FactionRecord }[] = [];
            for (const victim of live) {
                if (victim.tags.includes('destroyed_by')) continue;
                const victimPower = Number(victim.resources.power_ordinal ?? 0);
                for (const aggressor of rivalsOf(state, victim)) {
                    if (Number(aggressor.resources.power_ordinal ?? 0)
                        >= victimPower + DECISIVE_MARGIN) {
                        pairs.push({ victim, aggressor });
                    }
                }
            }
            const pair = pick(rng, pairs);
            if (!pair) return null;
            const { victim, aggressor } = pair;

            // What was actually taken. Read off the roster and the treasury
            // rather than declared: severity is how much of the house is gone.
            const before = membersOf(state, victim.id);
            const losses = before.filter(n =>
                n.cultivation.realmOrdinal
                    < Number(aggressor.resources.power_ordinal ?? 0) - CASUAL_KILL_MAX_GAP
            );
            const deaths: DeathHandoff[] = [];
            for (const npc of losses) {
                replaceNpc(state, markDead(npc, day, `Killed when the ${houseName(aggressor.name)} came.`));
                deaths.push(settleNpcDeath(state, npc, day));
            }
            const severity = before.length === 0
                ? 1 : Math.min(1, losses.length / before.length);

            victim.resources.spirit_stones = Math.round(
                Number(victim.resources.spirit_stones ?? 0) * (1 - severity)
            );
            victim.tags = Array.from(new Set(victim.tags.concat('destroyed_by')));
            adjustStandingBetween(victim, aggressor, -0.6);

            // The seat is a place afterwards, and the world just made a new
            // ruin. Provenance documented, because people watched it happen,
            // and no cycle, because it is a place you can walk to.
            const changeIds: string[] = [];
            const seat = victim.seatLocationId
                ? state.locations.find(l => l.id === victim.seatLocationId) ?? null : null;
            // Same guard as `applyExpend`: a region is a container and does not
            // become a ruin. See the block there for what happened without it.
            if (seat && seat.kind !== 'region' && severity >= 0.5) {
                const ruined = ruinFromFallenSeat(seat, {
                    onDay: day,
                    houseName: victim.name,
                    houseId: victim.id
                });
                replaceLocation(state, ruined.location);
                changeIds.push(ruined.change.id);
            }

            const opening = emit(state, 'house_destroyed', day, {
                day,
                kind: 'catastrophe',
                scale: 'regional',
                summary:
                    `The ${houseName(aggressor.name)} came for the ${houseName(victim.name)}. `
                    + `${losses.length} of ${before.length} dead.`
                    + (changeIds.length > 0 ? ` The compound is a ruin.` : ''),
                locationId: seat?.id ?? null,
                factionIds: [victim.id, aggressor.id],
                locationChangeIds: changeIds,
                visibility: 'public',
                magnitude: 0.85,
                unattributed:
                    'The valley road is full of people going the other way, and none of '
                    + 'them are stopping to explain.',
                consequences: {
                    immediate: `The ${victim.name} has ${before.length - losses.length} people left.`,
                    physical: changeIds.length > 0 ? 'The compound is standing and empty.' : '',
                    beneficiaries: [{ id: aggressor.id, name: aggressor.name, role: 'aggressor' }],
                    losers: [{ id: victim.id, name: victim.name, role: 'stricken' }],
                    opportunitiesOpened: ['A compound nobody is holding, and it fell this year.'],
                    tenYearsLater: 'Somebody is living in it, and did not build it.'
                }
            }, {
                factions: [victim.id, aggressor.id],
                locations: seat ? [seat.id] : [],
                npcs: losses.map(n => n.id)
            }, deaths);

            // And now the survivors choose. Everything past this point is the
            // cascade's, and its steps are separate facts with their own ids.
            const chain = runCascade(state, {
                strickenId: victim.id,
                aggressorId: aggressor.id,
                day,
                causeFactId: opening.fact.id,
                severity
            }, forStream(state.seed, 'cascade', victim.id, day));

            // The chain's touched ids and deaths fold into the opening event,
            // because a caller that reads `touched` is asking what moved and
            // the honest answer includes everything the chain moved.
            opening.touched.factions.push(...chain.touched.factions);
            opening.touched.locations.push(...chain.touched.locations);
            opening.touched.npcs.push(...chain.touched.npcs);
            opening.deaths.push(...chain.deaths);
            return opening;
        }
    },

    // ── A vein changes hands. The single most consequential thing that can
    //    happen to a sect, because the vein is its whole ability to produce
    //    cultivators. ────────────────────────────────────────────────────
    {
        kind: 'vein_lost',
        weight: 12,
        apply(state, day, rng) {
            const holders = liveFactions(state).filter(f => veinsOf(state, f.id).length > 0);
            const loser = pick(rng, holders);
            if (!loser) return null;
            const vein = pick(rng, veinsOf(state, loser.id));
            if (!vein) return null;

            const contenders = rivalsOf(state, loser);
            const federatedSeizure = loser.tags.includes('federated') && contenders.length === 0;
            const winner = pick(rng, contenders);
            if (!winner && !federatedSeizure) return null;

            const changed = applyLocationChange(vein, {
                onDay: day,
                kind: 'conquered',
                summary: winner
                    ? `${vein.name} passed to the ${houseName(winner.name)}.`
                    : `${vein.name} was withdrawn from the ${houseName(loser.name)}; the grant was not renewed.`,
                causeKnown: true,
                patch: {
                    controllingFactionId: winner ? winner.id : null,
                    addTags: ['changed_hands']
                }
            });
            replaceLocation(state, changed.location);

            loser.controlledLocationIds = loser.controlledLocationIds.filter(id => id !== vein.id);
            loser.resources.veins = Math.max(0, (loser.resources.veins ?? 0) - 1);
            loser.resources.spirit_stones = Math.round((loser.resources.spirit_stones ?? 0) * 0.6);
            loser.tags = Array.from(new Set(loser.tags.concat('lost_vein')));
            if (winner) {
                winner.controlledLocationIds.push(vein.id);
                winner.resources.veins = (winner.resources.veins ?? 0) + 1;
                adjustStandingBetween(loser, winner, -0.3);

                openPersonalAccount(state, loser.id, winner.id, day, `Took ${vein.name}.`, rng);
            }

            return emit(state, 'vein_lost', day, {
                day,
                kind: 'resource_contested',
                scale: 'regional',
                summary: changed.change.summary,
                locationId: vein.id,
                factionIds: winner ? [loser.id, winner.id] : [loser.id],
                locationChangeIds: [changed.change.id],
                visibility: 'public',
                magnitude: 0.75,
                unattributed:
                    'The road up the gorge is closed to anyone without a token, and the ' +
                    'people collecting the toll are not the ones who were there before.',
                consequences: {
                    immediate: changed.change.summary,
                    physical: `Control of ${vein.name} moved.`,
                    beneficiaries: winner ? [{ id: winner.id, name: winner.name, role: 'holder' }] : [],
                    losers: [{ id: loser.id, name: loser.name, role: 'dispossessed' }],
                    factionReactions: [{ factionId: loser.id, reaction: 'Recalled its outer disciples.' }],
                    relationshipChanges: winner
                        ? [{ aId: loser.id, bId: winner.id, change: 'open hostility' }] : [],
                    opportunitiesOpened: ['Work for anyone who can survey a vein.'],
                    opportunitiesClosed: [`Admission to the ${houseName(loser.name)} on the old terms.`],
                    rumours: ['That the grant was sold rather than lost.'],
                    tenYearsLater:
                        `The ${loser.name} produces fewer cultivators every decade, and everyone local knows it.`
                }
            }, {
                factions: winner ? [loser.id, winner.id] : [loser.id],
                locations: [vein.id]
            });
        }
    },

    // ── Somebody who mattered locally is gone. ───────────────────────────
    {
        kind: 'elder_died',
        weight: 16,
        apply(state, day, rng) {
            const seniors = theWorldsPeople(state).filter(
                n => n.status === 'alive' && isBelowTheLid(n) &&
                    n.factionId != null && n.factionRankIndex >= 3 &&
                    // Not somebody on the last project. Dying of age at a
                    // quarter of a hundred thousand years is not a thing that
                    // happens, and this event is where it was happening.
                    !isOnTheLastProject(n)
            );
            const npc = pickByMortality(rng, seniors, day);
            if (!npc) return null;
            const faction = state.factions.find(f => f.id === npc.factionId) ?? null;

            const cause = rng.chance(0.25)
                ? 'a breakthrough that did not hold'
                : rng.chance(0.4) ? 'an old wound' : 'age';
            replaceNpc(state, markDead(npc, day, `Died of ${cause}.`));
            const handoff = settleNpcDeath(state, npc, day);

            return emit(state, 'elder_died', day, {
                day,
                kind: 'death',
                scale: 'local',
                summary:
                    `${npc.name}, ${rankName(npc.cultivation.realmOrdinal)}` +
                    (faction ? ` of the ${houseName(faction.name)}` : '') + `, died of ${cause}.`,
                actors: [{ id: npc.id, name: npc.name, role: 'deceased' }],
                locationId: npc.locationId,
                factionIds: faction ? [faction.id] : [],
                visibility: 'faction',
                magnitude: 0.4 + Math.min(0.4, npc.cultivation.realmOrdinal * 0.02),
                unattributed:
                    'A compound on the ridge has been in white for a month, and nobody there ' +
                    'is taking visitors.',
                consequences: {
                    immediate: `The seat ${npc.name} held is empty.`,
                    physical: '',
                    losers: handoff.primaryHeirId
                        ? [{ id: handoff.primaryHeirId, name: handoff.primaryHeirId, role: 'heir' }] : [],
                    tenYearsLater: handoff.goalsInherited.length > 0
                        ? 'What they were owed, and what they were owed for, is somebody else\'s now.'
                        : 'The account closed with them.'
                }
            }, {
                factions: faction ? [faction.id] : [],
                npcs: [npc.id]
            }, [handoff]);
        }
    },

    // ── Somebody killed somebody. ───────────────────────────────────────
    //
    // The canonical grudge source, and the reason the world has inherited
    // accounts at all: a death by natural causes leaves an estate, and a death
    // at a named hand leaves an estate AND somebody to blame. The account is
    // written onto the victim before they die, so the ordinary inheritance path
    // carries it to the heir without a second mechanism.
    //
    // Who and why is not modelled. That two people in feuding sects ended up
    // in a room is a fact; what was said is the narrator's.
    {
        kind: 'killing',
        weight: 11,
        apply(state, day, rng) {
            const living = theWorldsPeople(state).filter(n => n.status === 'alive' && isBelowTheLid(n));

            // ── THE KILLER IS DRAWN FIRST, AND THAT IS THE WHOLE FIX. ──
            //
            // This used to draw the VICTIM uniformly from everybody alive and
            // then look for somebody who could do it. `couldKill` kept the
            // killer commensurate, so the result was never absurd - but the
            // RATE was, because a Void Refinement cultivator was picked as
            // often as a Qi Condensation one while having fifty times the span
            // to lose. A realm's lifespan is the whole of what a high realm
            // buys, and this was quietly cancelling it.
            //
            // Measured over forty centuries on two seeds, residence in a band
            // as a share of that realm's own span:
            //
            //     Qi Cond 100%   Foundation 55%   Core 38%   Nascent 23%
            //     Deity 16%      Void 10%         Body 15%   Grand 20%
            //
            // and at Void Refinement 77% of departures were violent against
            // 10% of age. The higher the realm, the less of its span anybody
            // was getting to stand in it, which is the opposite of the ladder's
            // central promise.
            //
            // Drawing the killer first inverts it with no rule about tiers and
            // no exception for anybody: a killing needs somebody who can do it,
            // most people are at the bottom, so most killings happen there.
            // Somebody at Grand Ascension has perhaps one person in the world
            // who could reach them, and is therefore reached about as often as
            // that fact implies. `couldKill` is still the gate, unchanged, so
            // the guarantee `demography.test.ts` pins is untouched.
            const killer = pick(rng, living);
            if (!killer) return null;

            // Preferably somebody with a reason: a member of a faction the
            // killer's own is at odds with. Failing that, anyone in the same
            // place, because most killings are local and petty.
            const killerFaction = killer.factionId
                ? state.factions.find(f => f.id === killer.factionId) ?? null : null;
            const hostileIds = killerFaction
                ? Object.entries(killerFaction.standing)
                    .filter(([, v]) => v <= -0.3).map(([k]) => k)
                : [];
            const pool = living.filter(n =>
                n.id !== killer.id &&
                (hostileIds.includes(n.factionId ?? '') || n.locationId === killer.locationId) &&
                couldKill(killer, n)
            );
            const victim = pick(rng, pool);
            if (!victim) return null;
            const victimFaction = victim.factionId
                ? state.factions.find(f => f.id === victim.factionId) ?? null : null;

            // The dead keep their account open. It is what the heir inherits.
            const at = state.npcs.findIndex(n => n.id === victim.id);
            if (at < 0) return null;
            state.npcs[at] = upsertRelationship(state.npcs[at], {
                targetId: killer.id,
                targetName: killer.name,
                kind: 'enemy',
                standing: -1,
                note: `Killed them at ${victim.locationId ?? 'somewhere'}.`
            }, day);
            const dying = state.npcs[at];

            state.npcs[at] = markDead(dying, day, `Killed by ${killer.name}.`);
            const handoff = settleNpcDeath(state, dying, day);

            return emit(state, 'killing', day, {
                day,
                kind: 'grudge_opened',
                scale: 'personal',
                summary:
                    `${killer.name} killed ${victim.name}` +
                    (victimFaction ? ` of the ${houseName(victimFaction.name)}` : '') + '.',
                actors: [
                    { id: killer.id, name: killer.name, role: 'killer' },
                    { id: victim.id, name: victim.name, role: 'victim' }
                ],
                locationId: victim.locationId,
                factionIds: victimFaction ? [victimFaction.id] : [],
                visibility: 'regional',
                magnitude: 0.45,
                unattributed:
                    'A body was found on the low road and nobody is saying whose it was.',
                consequences: {
                    immediate: 'One fewer, and somebody knows who did it.',
                    losers: [{ id: victim.id, name: victim.name, role: 'victim' }],
                    beneficiaries: [{ id: killer.id, name: killer.name, role: 'killer' }],
                    relationshipChanges: handoff.primaryHeirId
                        ? [{ aId: handoff.primaryHeirId, bId: killer.id, change: 'an inherited account' }]
                        : [],
                    tenYearsLater: handoff.primaryHeirId
                        ? 'Somebody younger is still asking where he lives.'
                        : 'Nobody was left to ask about it.'
                }
            }, {
                npcs: [victim.id, killer.id],
                factions: victimFaction ? [victimFaction.id] : []
            }, [handoff]);
        }
    },

    // ── Someone else got there first. ────────────────────────────────────
    {
        kind: 'ruin_opened',
        weight: 8,
        apply(state, day, rng) {
            // ── What is left to be opened ────────────────────────────────
            //
            // This used to read the sealed ruins alone, which is a FIXED
            // endowment: the prior ages seed them, nothing ever makes another,
            // and the template empties one per firing. Measured over two
            // thousand years it fired thirteen times, which is not a weight
            // problem - it is the stock running out around year four hundred
            // and the template returning null for the rest of the run.
            //
            // The world does keep making places worth going into; it just was
            // not counting them. `faction_fell` leaves a compound standing and
            // empty with its formations unlit and tagged `ruined`, which is a
            // ruin by every reading except the one this filter used. Adding it
            // makes the supply regenerate from something the world already does,
            // which is the same shape as the fix in `neighboursOf`.
            //
            // AND OPENING IS NOT FINDING. This filter used to take undiscovered
            // ground, which collapses two events into one: somebody cannot open
            // a sealed hall nobody has located. So the supply this template
            // draws on is now the STANDING RESERVE - ground the world has found
            // and not yet emptied - and the thing that replenishes it is
            // `applyRuinProspecting`, which runs earlier in the same year.
            // Measured before that pass existed: openings went to zero per
            // century in the last fifth of a five-thousand-year run, in every
            // seed, because the endowment was fixed and this template consumed
            // it. See `how-the-world-keeps-finding-more-ruins.ts`.
            const openable = state.locations.filter(l =>
                isBelowTheLid(l) && !l.tags.includes('emptied') && l.discovered &&
                ((l.kind === 'ruin' && l.sealed) || l.tags.includes('ruined'))
            );
            const ruin = pick(rng, openable);
            if (!ruin) return null;
            const opener = pick(rng, theWorldsPeople(state).filter(
                n => n.status === 'alive' && isBelowTheLid(n) &&
                    n.cultivation.realmOrdinal >= Math.max(0, ruin.thresholds.survival - 2)
            ));

            const changed = applyLocationChange(ruin, {
                onDay: day,
                kind: 'unsealed',
                summary: opener
                    ? `${ruin.name} was opened by ${opener.name}.`
                    : `${ruin.name} was found open. Nobody admits to it.`,
                causeKnown: opener != null,
                witnessed: false,
                patch: {
                    sealed: false,
                    discovered: true,
                    addTags: ['emptied'],
                    environment: { spiritualDensity: qiFraction(ruin.qiDensity) }
                }
            });
            replaceLocation(state, changed.location);

            if (opener) {
                replaceNpc(state, {
                    ...opener,
                    cultivation: {
                        ...opener.cultivation,
                        techniqueIds: opener.cultivation.techniqueIds.concat(`recovered-${ruin.id}`)
                    }
                });
            }

            return emit(state, 'ruin_opened', day, {
                day,
                kind: 'ruin_opened',
                scale: 'local',
                summary: changed.change.summary,
                actors: opener ? [{ id: opener.id, name: opener.name, role: 'opener' }] : [],
                locationId: ruin.id,
                locationChangeIds: [changed.change.id],
                causes: ruin.originFactId ? [ruin.originFactId] : [],
                visibility: 'regional',
                magnitude: 0.55,
                unattributed:
                    'There is a new track up to the old compound, and somebody has been selling ' +
                    'things in the market town that nobody local knows how to make.',
                consequences: {
                    immediate: 'The seal is off.',
                    physical: `${ruin.name} is open.`,
                    opportunitiesClosed: ['Whatever was in there, for whoever comes next.'],
                    rumours: ['That most of it was already gone before they got in.'],
                    tenYearsLater: 'The site is picked over and the track has grown back.'
                }
            }, { locations: [ruin.id], npcs: opener ? [opener.id] : [] });
        }
    },

    // ── A window closed with somebody else standing in it. ───────────────
    {
        kind: 'opportunity_taken',
        weight: 9,
        apply(state, day, rng) {
            const open = state.opportunities.filter(o => {
                if (o.claimed && o.recurrenceDays === null) return false;
                const w = nextWindow(o, day - 30);
                return w != null && w.opensOnDay <= day && w.closesOnDay > day;
            });
            const opp = pick(rng, open);
            if (!opp) return null;
            const taker = pick(rng, theWorldsPeople(state).filter(
                n => n.status === 'alive' && isBelowTheLid(n)));
            if (!taker) return null;

            const claim = claimOpportunity(opp, taker.id, day);
            if (!claim.ok) return null;
            const at = state.opportunities.findIndex(o => o.id === opp.id);
            if (at >= 0) state.opportunities[at] = claim.opportunity;

            return emit(state, 'opportunity_taken', day, {
                day,
                kind: 'opportunity',
                scale: 'local',
                summary: `${taker.name} took ${opp.name}.`,
                actors: [{ id: taker.id, name: taker.name, role: 'claimant' }],
                locationId: opp.locationId,
                factionIds: opp.factionIds.slice(),
                visibility: 'regional',
                magnitude: 0.4,
                unattributed:
                    'The price of what that ground produces has gone up, and the people who ' +
                    'usually gather it came back with nothing.',
                consequences: {
                    immediate: `${opp.name} is taken.`,
                    opportunitiesClosed: [opp.name],
                    tenYearsLater: 'Whoever took it is a little harder to refuse now.'
                }
            }, { npcs: [taker.id] });
        }
    },

    // ── A border moves, which mostly means a market town changes who it
    //    pays. ─────────────────────────────────────────────────────────────
    {
        kind: 'border_moved',
        weight: 7,
        apply(state, day, rng) {
            const settlements = state.locations.filter(
                l => l.kind === 'settlement' && isBelowTheLid(l)
            );
            const place = pick(rng, settlements);
            if (!place) return null;
            const claimant = pick(rng, liveFactions(state));
            if (!claimant || claimant.id === place.controllingFactionId) return null;
            const previousId = place.controllingFactionId;
            const previous = previousId
                ? state.factions.find(f => f.id === previousId) ?? null : null;

            const changed = applyLocationChange(place, {
                onDay: day,
                kind: 'conquered',
                summary: `${place.name} answers to the ${houseName(claimant.name)} now.`,
                causeKnown: true,
                patch: {
                    controllingFactionId: claimant.id,
                    environment: { politicalControl: `the ${houseName(claimant.name)}` }
                }
            });
            replaceLocation(state, changed.location);
            claimant.controlledLocationIds = Array.from(
                new Set(claimant.controlledLocationIds.concat(place.id))
            );
            if (previous) {
                previous.controlledLocationIds = previous.controlledLocationIds.filter(id => id !== place.id);
                adjustStandingBetween(previous, claimant, -0.2);
                openPersonalAccount(
                    state, previous.id, claimant.id, day,
                    `Was collecting at ${place.name} until they were not.`, rng
                );
            }

            return emit(state, 'border_moved', day, {
                day,
                kind: 'territory_changed',
                scale: 'local',
                summary: changed.change.summary,
                locationId: place.id,
                factionIds: previous ? [previous.id, claimant.id] : [claimant.id],
                locationChangeIds: [changed.change.id],
                visibility: 'regional',
                magnitude: 0.45,
                unattributed:
                    'The people collecting the market tax are wearing a different colour, and ' +
                    'the rate is not what it was.',
                consequences: {
                    immediate: changed.change.summary,
                    physical: 'The boundary marker was moved.',
                    beneficiaries: [{ id: claimant.id, name: claimant.name, role: 'holder' }],
                    losers: previous ? [{ id: previous.id, name: previous.name, role: 'dispossessed' }] : [],
                    tenYearsLater: 'The older people still give directions using the old boundary.'
                }
            }, {
                factions: previous ? [previous.id, claimant.id] : [claimant.id],
                locations: [place.id]
            });
        }
    },

    // ── Somebody found out how far the zone actually runs. ───────────────
    {
        kind: 'deference_tested',
        weight: 6,
        apply(state, day, rng) {
            const deference = liveFactions(state).filter(f => f.tags.includes('deference'));
            const held = pick(rng, deference);
            if (!held) return null;
            const tester = pick(rng, liveFactions(state).filter(f => f.id !== held.id));
            if (!tester) return null;

            // Deference is respect, and respect is only real while it is not
            // being tested. Whether it holds is the roll; why anyone tried is
            // not this module's business.
            const holds = rng.chance(clamp(0.35 + (held.resources.power_ordinal ?? 17) / 60, 0.2, 0.9));
            adjustStandingBetween(held, tester, holds ? -0.15 : -0.35);
            if (!holds) {
                held.tags = Array.from(new Set(held.tags.concat('zone_shrunk')));
                held.resources.spirit_stones = Math.round((held.resources.spirit_stones ?? 0) * 0.85);
                openPersonalAccount(
                    state, held.id, tester.id, day,
                    'Moved a marker in and was not made to move it back.', rng
                );
            }

            return emit(state, 'deference_tested', day, {
                day,
                kind: 'territory_changed',
                scale: 'local',
                summary: holds
                    ? `The ${houseName(tester.name)} moved a lease inward on the ${houseName(held.name)} and was made to move it back.`
                    : `The ${houseName(tester.name)} moved a lease inward on the ${houseName(held.name)} and nothing happened.`,
                factionIds: [held.id, tester.id],
                visibility: 'faction',
                magnitude: holds ? 0.35 : 0.55,
                unattributed: holds
                    ? 'A survey party came back down the valley in a hurry and would not say why.'
                    : 'There are new markers on the north side of the valley, further in than they were.',
                consequences: {
                    immediate: holds ? 'The zone held.' : 'The zone is smaller than it was.',
                    tenYearsLater: holds
                        ? 'Nobody tries that side again for a generation.'
                        : 'Two more leases move inward, and nobody is told.'
                }
            }, { factions: [held.id, tester.id] });
        }
    },

    // ── An institution stops existing. ───────────────────────────────────
    {
        kind: 'faction_fell',
        weight: 3,
        apply(state, day, rng) {
            // Bind to whoever the economy has already ruined. Nobody is
            // chosen: a faction is here because it cannot pay, or because it
            // lost the vein that was its whole ability to produce cultivators
            // and has nobody left.
            const failing = liveFactions(state).filter(f =>
                ((f.resources.spirit_stones ?? 0) < 400 ||
                    membersOf(state, f.id).length < 3 ||
                    (f.tags.includes('lost_vein') && membersOf(state, f.id).length < 6))
                // AND NOT A BODY WHOSE PEOPLE OUTLAST INSTITUTIONS. Counting
                // heads is the right test for a house that runs on succession
                // and the wrong one at the top of the ladder, where a single
                // survivor holds tens of thousands of years and rebuilding
                // after losing three of four Seats to a crossing is not a body
                // dying - it is the only thing that body does. The Hollow Court
                // dissolved on every seed inside three centuries against
                // members who cannot die of time.
                && !standsOnAnUnreachableClock(state, f.id)
            );
            const faction = pick(rng, failing);
            if (!faction) return null;

            faction.dissolvedOnDay = day;
            const orphans = membersOf(state, faction.id);
            for (const npc of orphans) {
                replaceNpc(state, { ...npc, factionId: null, factionRankIndex: -1, updatedOnDay: day });
            }

            const seat = faction.seatLocationId
                ? state.locations.find(l => l.id === faction.seatLocationId) ?? null : null;
            const changeIds: string[] = [];
            if (seat) {
                const changed = applyLocationChange(seat, {
                    onDay: day,
                    kind: 'abandoned',
                    summary: `The ${faction.name}'s compound at ${seat.name} was left standing and empty.`,
                    causeKnown: true,
                    patch: {
                        controllingFactionId: null,
                        addTags: ['ruined'],
                        addHazards: ['formation'],
                        environment: { politicalControl: 'nobody, now' }
                    }
                });
                replaceLocation(state, changed.location);
                changeIds.push(changed.change.id);
            }

            return emit(state, 'faction_fell', day, {
                day,
                kind: 'faction_fallen',
                scale: 'regional',
                summary:
                    `The ${faction.name} ended after ` +
                    `${Math.max(0, yearOfDay(day) - yearOfDay(faction.foundedOnDay ?? day))} years. ` +
                    `${orphans.length} people are suddenly nobody's disciples.`,
                locationId: seat?.id ?? null,
                factionIds: [faction.id],
                locationChangeIds: changeIds,
                visibility: 'public',
                magnitude: 0.85,
                unattributed:
                    'A compound up the valley has been empty for a season, and people have ' +
                    'started taking the roof tiles.',
                consequences: {
                    immediate: 'The rolls are dissolved.',
                    physical: 'The compound stands empty and the formations are unlit.',
                    losers: [{ id: faction.id, name: faction.name, role: 'dissolved' }],
                    opportunitiesOpened: ['An empty compound, and whatever is still in it.'],
                    opportunitiesClosed: ['Admission, stipends, and the library.'],
                    rumours: ['That the last elder walked out with the treasury.'],
                    tenYearsLater: 'Somebody else is living in it, and did not build it.'
                }
            }, {
                factions: [faction.id],
                locations: seat ? [seat.id] : [],
                npcs: orphans.map(n => n.id)
            });
        }
    },

    // ── A splinter. Institutions do not only die; they divide. ───────────
    {
        kind: 'faction_founded',
        weight: 3,
        apply(state, day, rng) {
            const large = liveFactions(state).filter(f => membersOf(state, f.id).length >= 12);
            const parent = pick(rng, large);
            if (!parent) return null;
            const members = membersOf(state, parent.id)
                .sort((a, b) => b.cultivation.realmOrdinal - a.cultivation.realmOrdinal || (a.id < b.id ? -1 : 1));
            // Not the leader: the one under them, which is where splits come from.
            const founder = members[1];
            if (!founder) return null;

            const leavers = members.filter((_, i) => i > 0 && i % 3 === 1).slice(0, 6);
            const id = `sect-splinter-${founder.id}`;
            if (state.factions.some(f => f.id === id)) return null;

            const splinter = makeFaction({
                id,
                // No article INSIDE the name. Every summary in this layer
                // supplies its own - "of the ${name}" - so a name carrying one
                // produced "of the the Wei Hall" in the middle of a biography,
                // and the catalog's own names do not carry one either.
                name: `${founder.name.split(' ')[0]} Hall`,
                kind: 'sect',
                alignment: parent.alignment,
                seatLocationId: founder.locationId,
                ranks: parent.ranks.slice(),
                resources: {
                    spirit_stones: Math.round((parent.resources.spirit_stones ?? 0) * 0.2),
                    veins: 0,
                    power_ordinal: founder.cultivation.realmOrdinal
                },
                description: `Split from the ${houseName(parent.name)}.`,
                foundedOnDay: day,
                tags: ['unbacked', 'recruits', 'splinter']
            });
            splinter.standing[parent.id] = -0.5;
            parent.standing[splinter.id] = -0.5;

            // THE ENEMY OF THEIR ENEMY, AND THE ONLY THING IN THIS PASS THAT
            // ADDS A POSITIVE EDGE BETWEEN TWO HOUSES.
            //
            // Founding produced enmity and nothing else, so the alliance graph
            // could only lose partners to dissolution and never gain one. It
            // reached zero and stayed there - measured over five thousand years
            // on `scripts/probe-houses-over-time.ts`, allied pairs went 4, 3, 1,
            // 1, 0, 0, 0 while houses churned healthily throughout, 25 of them
            // founded in the last era alone. The gatherings layer found the same
            // hole from the other side: 13 of its 15 alliance edges had a
            // dissolved partner, its circles ran 11 down to 1, and a circle
            // needs two houses that can stand each other. Inter-house gatherings
            // are one of the few sources of cross-house ties in the world, so
            // the institutional shortage was producing the personal one.
            //
            // A house that has just walked out on somebody has immediate common
            // ground with everybody else that somebody has wronged, and both
            // sides know it on the day. `rivalsOf` is already that list.
            //
            // WARM, NOT ALLIED. It stops just under `ALLIED_STANDING` on
            // purpose: being glad somebody embarrassed your rival is the
            // beginning of an alliance, not one, and it leaves the gatherings
            // layer's slow drift something to finish rather than handing it a
            // completed friendship. It also costs nothing per year, because it
            // fires only on a founding.
            for (const glad of rivalsOf(state, parent)) {
                if (glad.id === splinter.id) continue;
                splinter.standing[glad.id] = SYMPATHY_AT_A_SCHISM;
                glad.standing[splinter.id] = SYMPATHY_AT_A_SCHISM;
            }

            parent.resources.spirit_stones = Math.round((parent.resources.spirit_stones ?? 0) * 0.8);
            state.factions.push(splinter);

            // AND THE BOOKS THEY WALKED OUT WITH, WHICH IS WHY THIS IS A HOUSE
            // AND NOT A BUILDING.
            //
            // A founded house had no catalog entry, so `manualsOf` read back an
            // empty shelf and it could teach nobody anything for as long as it
            // stood - which made ordinary institutional churn a one-way ratchet
            // on the world's literacy. Measured over three thousand years:
            // houses standing 32 -> 47 while houses holding a shelf went 30 ->
            // 5, distinct books held by anybody alive 68 -> 6, and the standing
            // distribution collapsed to 96% at or below Qi Condensation with
            // four consecutive empty bands above the middle.
            //
            // The founders are already carrying their methods. Writing the
            // library rows here is the physical fact of the schism rather than
            // a new rule, and `shelfOf` reads them the same way it reads any
            // other house's.
            state.objects.push(
                ...librariesCarriedOutBy(state, splinter, [founder, ...leavers])
            );

            for (const npc of [founder, ...leavers]) {
                replaceNpc(state, {
                    ...npc,
                    factionId: splinter.id,
                    factionRankIndex: npc.id === founder.id ? splinter.ranks.length - 1 : 1,
                    updatedOnDay: day
                });
            }

            return emit(state, 'faction_founded', day, {
                day,
                kind: 'faction_founded',
                scale: 'regional',
                summary:
                    `${founder.name} left the ${houseName(parent.name)} with ${leavers.length} others and ` +
                    `set up on their own.`,
                actors: [{ id: founder.id, name: founder.name, role: 'founder' }],
                locationId: founder.locationId,
                factionIds: [parent.id, splinter.id],
                visibility: 'public',
                magnitude: 0.6,
                unattributed:
                    'There is a second compound going up on the far side of the ridge, and the ' +
                    'people building it will not say who for.',
                consequences: {
                    immediate: `The ${parent.name} is smaller and angrier.`,
                    physical: 'A new compound.',
                    beneficiaries: [{ id: founder.id, name: founder.name, role: 'founder' }],
                    losers: [{ id: parent.id, name: parent.name, role: 'diminished' }],
                    relationshipChanges: [{ aId: parent.id, bId: splinter.id, change: 'a standing feud' }],
                    opportunitiesOpened: ['A sect that will take almost anybody, for now.'],
                    tenYearsLater: 'One of the two is clearly winning, and everyone local has an opinion.'
                }
            }, {
                factions: [parent.id, splinter.id],
                npcs: [founder.id, ...leavers.map(n => n.id)]
            });
        }
    },

    // ── The last person who could do a thing is gone. ────────────────────
    {
        kind: 'technique_lost',
        weight: 5,
        apply(state, day, rng) {
            const holders = theWorldsPeople(state).filter(
                n => n.status === 'alive' && isBelowTheLid(n) &&
                    n.cultivation.techniqueIds.length > 0
            );
            // Weighted the same way `elder_died` is. Going out and not coming
            // back is a thing that happens to people who were running out of
            // time anyway; somebody with seventy thousand years in front of
            // them does not simply fail to return.
            const npc = pickByMortality(rng, holders, day);
            if (!npc) return null;
            const techniqueId = pick(rng, npc.cultivation.techniqueIds);
            if (!techniqueId) return null;

            // Only lost if nobody else alive has it. That is the whole rule.
            const others = state.npcs.filter(
                n => n.id !== npc.id && n.status === 'alive' && isBelowTheLid(n) &&
                    n.cultivation.techniqueIds.includes(techniqueId)
            );
            if (others.length > 0) return null;

            replaceNpc(state, markMissing(npc, day, 'Went out and did not come back.'));

            return emit(state, 'technique_lost', day, {
                day,
                kind: 'technique_lost',
                scale: 'regional',
                summary:
                    `${npc.name} was the last person known to be able to work ${techniqueId}, ` +
                    `and is no longer anywhere.`,
                actors: [{ id: npc.id, name: npc.name, role: 'last_holder' }],
                locationId: npc.locationId,
                visibility: 'faction',
                fidelity: 'partial',
                causeKnown: false,
                magnitude: 0.5,
                unattributed:
                    'The formation on the east gate has stopped working and nobody has been ' +
                    'able to restart it.',
                data: { techniqueId },
                consequences: {
                    immediate: 'Nobody living has been taught it.',
                    opportunitiesClosed: ['Learning it from anyone.'],
                    rumours: ['That there is a copy in the archive, mislabelled.'],
                    tenYearsLater: 'It is spoken of as something the sect used to be able to do.'
                }
            }, { npcs: [npc.id] });
        }
    },

    // ── Prices move, which is how most people experience politics. ───────
    {
        kind: 'market_shifted',
        weight: 10,
        apply(state, day, rng) {
            const regions = state.locations.filter(l => l.kind === 'region' && isBelowTheLid(l));
            const region = pick(rng, regions);
            if (!region) return null;
            const up = rng.chance(0.5);
            const factor = up ? rng.float(1.15, 1.9) : rng.float(0.55, 0.88);

            const changed = applyLocationChange(region, {
                onDay: day,
                kind: 'other',
                summary: up
                    ? `What ${region.name} sells got dearer.`
                    : `What ${region.name} sells got cheaper, and nobody there is pleased about it.`,
                causeKnown: false,
                patch: {
                    data: { priceFactor: Number(factor.toFixed(3)) }
                }
            });
            replaceLocation(state, changed.location);

            return emit(state, 'market_shifted', day, {
                day,
                kind: 'opportunity',
                scale: 'local',
                summary: changed.change.summary,
                locationId: region.id,
                locationChangeIds: [changed.change.id],
                visibility: 'public',
                fidelity: 'partial',
                causeKnown: false,
                magnitude: 0.3,
                unattributed: up
                    ? 'Everything in the market costs more than it did and nobody can say why.'
                    : 'The market is full of things nobody is buying.',
                // The factor is NOT repeated here. It is stored on the location
                // change this fact cites, which is the record that owns it and
                // the one anybody reading a price actually consults - nothing
                // has ever read it off the fact.
                //
                // Copying it onto the fact as well had a second cost that was
                // not obvious: it made every price move a different row from
                // every other, so a province's market produced forty
                // indistinguishable statements over two thousand years and the
                // ledger could not fold them. The change ids concatenate on a
                // fold, so every occurrence's own factor survives where it lives.
                //   See `a-fact-that-keeps-happening-is-one-row.ts`.
                consequences: {
                    immediate: 'Prices moved.',
                    tenYearsLater: 'The old price is what people quote when they are complaining.'
                }
            }, { locations: [region.id] });
        }
    },

    // ── A war opens now and settles later. The world generating its own
    //    future, which is what a schedule is for. ────────────────────────
    {
        kind: 'war_opened',
        weight: 5,
        apply(state, day, rng) {
            const live = liveFactions(state);
            const a = pick(rng, live);
            if (!a) return null;
            const b = pick(rng, rivalsOf(state, a));
            if (!b || a.tags.includes('at_war') || b.tags.includes('at_war')) return null;

            a.tags = a.tags.concat('at_war');
            b.tags = b.tags.concat('at_war');
            adjustStandingBetween(a, b, -0.3);

            const resolvesIn = years(rng.int(2, 25));
            const effect: ScheduledEffect = {
                id: `e${state.nextEffectSeq++}`,
                kind: 'war_resolves',
                dueOnDay: day + resolvesIn,
                summary: `The war between the ${houseName(a.name)} and the ${houseName(b.name)} came to an end.`,
                actorIds: [],
                locationId: null,
                factionId: a.id,
                repeatDays: null,
                interrupts: false,
                chance: 1,
                fired: false,
                firedOnDay: null,
                data: { kind: 'war_resolution', sideA: a.id, sideB: b.id, magnitude: 0.7, openedOnDay: day }
            };
            state.schedule.push(effect);

            return emit(state, 'war_opened', day, {
                day,
                kind: 'war',
                scale: 'regional',
                summary: `The ${houseName(a.name)} and the ${houseName(b.name)} are openly fighting.`,
                factionIds: [a.id, b.id],
                visibility: 'public',
                magnitude: 0.7,
                unattributed:
                    'The road east is not safe, the caravans have stopped, and there are more ' +
                    'people sleeping outside the walls than there were.',
                consequences: {
                    immediate: 'Both sides have recalled everyone they can reach.',
                    physical: 'The trade road is unusable.',
                    opportunitiesClosed: ['Travel east; the harvest contract.'],
                    opportunitiesOpened: ['Work for anyone who can fight, and pay for anyone who can heal.'],
                    rumours: ['That it is really about a vein, and the insult was arranged.'],
                    tenYearsLater: 'Whichever side lost is still smaller.'
                }
            }, { factions: [a.id, b.id] });
        }
    },

    // ── Ground stops being usable. Rare, permanent, and it makes geography.
    {
        kind: 'zone_forbidden',
        weight: 2,
        apply(state, day, rng) {
            const candidates = state.locations.filter(
                l => (l.kind === 'wilds' || l.kind === 'vein') &&
                    isBelowTheLid(l) && !l.tags.includes('forbidden')
            );
            const place = pick(rng, candidates);
            if (!place) return null;

            const { location, change } = forbidZone(place, {
                onDay: day,
                summary: `Something happened at ${place.name} and the ground has not been right since.`,
                survivalOrdinal: Math.min(29, place.thresholds.mastery + 6),
                hazards: ['corrosive', 'thin_qi'],
                causeKnown: false,
                attributedCauses: [
                    'A cultivator died here badly',
                    'An old formation finally failed',
                    'Somebody buried something'
                ]
            });
            replaceLocation(state, location);
            const holder = place.controllingFactionId
                ? state.factions.find(f => f.id === place.controllingFactionId) ?? null : null;
            if (holder) {
                holder.controlledLocationIds = holder.controlledLocationIds.filter(id => id !== place.id);
                holder.resources.veins = Math.max(0, (holder.resources.veins ?? 0) - 1);
            }

            return emit(state, 'zone_forbidden', day, {
                day,
                kind: 'zone_forbidden',
                scale: 'regional',
                summary: change.summary,
                locationId: place.id,
                factionIds: holder ? [holder.id] : [],
                locationChangeIds: [change.id],
                visibility: 'public',
                fidelity: 'partial',
                causeKnown: false,
                magnitude: 0.8,
                unattributed:
                    'Two villages on that side have moved, the animals will not go in, and the ' +
                    'people who went to look have not come back.',
                consequences: {
                    immediate: 'Nobody goes in.',
                    physical: `${place.name} is lethal to anyone local.`,
                    losers: holder ? [{ id: holder.id, name: holder.name, role: 'dispossessed' }] : [],
                    opportunitiesOpened: ['Whatever is in there, for somebody far stronger.'],
                    opportunitiesClosed: ['Everything that used to be gathered there.'],
                    rumours: ['Three different explanations, none of them checkable.'],
                    tenYearsLater: 'It is on the maps as a blank, and children are told not to.'
                }
            }, { locations: [place.id], factions: holder ? [holder.id] : [] });
        }
    },

    // ── People leave. ───────────────────────────────────────────────────
    {
        kind: 'migration',
        weight: 8,
        apply(state, day, rng) {
            const regions = state.locations.filter(l => l.kind === 'region' && isBelowTheLid(l));
            if (regions.length < 2) return null;
            const from = pick(rng, regions);
            const to = pick(rng, regions.filter(r => r.id !== from?.id));
            if (!from || !to) return null;

            const movers = theWorldsPeople(state).filter(
                n => n.status === 'alive' && isBelowTheLid(n) &&
                    n.locationId === from.id && n.factionId === null
            ).slice(0, rng.int(3, 12));
            if (movers.length === 0) return null;

            for (const npc of movers) {
                replaceNpc(state, { ...npc, locationId: to.id, updatedOnDay: day });
            }

            return emit(state, 'migration', day, {
                day,
                kind: 'migration',
                scale: 'local',
                summary: `${movers.length} people left ${from.name} for ${to.name}.`,
                locationId: from.id,
                visibility: 'public',
                magnitude: 0.25,
                unattributed:
                    'Two of the hamlets on the low road are empty, and the fields have not been ' +
                    'turned this year.',
                consequences: {
                    immediate: 'Fewer hands, and fewer people drawing on the same ground.',
                    tenYearsLater: 'The ones who stayed cultivate slightly faster, and nobody says so.'
                }
            }, { locations: [from.id, to.id], npcs: movers.map(n => n.id) });
        }
    },

    // ── Somebody is simply not there any more, and nothing is resolved.
    {
        kind: 'disappearance',
        weight: 6,
        apply(state, day, rng) {
            const candidates = theWorldsPeople(state).filter(
                n => n.status === 'alive' && isBelowTheLid(n) && n.cultivation.realmOrdinal >= 13
            );
            // Weighted by how much of themselves is left, and this is the one
            // that mattered most: the pool is everybody above ordinal 13,
            // which is about fifty people, and the world's entire high-realm
            // cohort lives in it. Picking uniformly meant thirteen of the
            // seventeen strongest people alive walked into the hills inside
            // three centuries. An elder vanishing into seclusion and never
            // being seen again is good xianxia and should stay possible; it
            // should not be the ordinary fate of everybody who ever climbed.
            const npc = pickByMortality(rng, candidates, day);
            if (!npc) return null;
            replaceNpc(state, markMissing(npc, day, 'Went into the hills and was not seen again.'));

            return emit(state, 'disappearance', day, {
                day,
                kind: 'death',
                scale: 'personal',
                summary: `${npc.name} has not been seen since.`,
                actors: [{ id: npc.id, name: npc.name, role: 'missing' }],
                locationId: npc.locationId,
                factionIds: npc.factionId ? [npc.factionId] : [],
                visibility: 'faction',
                // The engine does not know either, and says so.
                truth: 'unresolved',
                claimedOutcomes: [
                    'died in the hills',
                    'went into seclusion and did not tell anyone',
                    'was killed over an old account',
                    'left the province'
                ],
                causeKnown: false,
                fidelity: 'rumour',
                magnitude: 0.35,
                unattributed:
                    'Somebody who used to be a fixture at the market has stopped coming, and ' +
                    'the stall has been taken over.',
                consequences: {
                    immediate: 'Their affairs are unsettled and nobody can close them.',
                    tenYearsLater: 'Treated as dead by everyone except one person.'
                }
            }, { npcs: [npc.id] });
        }
    },

    // ── Somebody worked on somebody. ─────────────────────────────────────
    //
    //    The world's half of `engine/social-leverage/`. It matters that this
    //    is here and not only on the player's side: the repo's commonest
    //    defect by a distance is a system that binds every NPC and never
    //    reaches the played game, and the reverse - a verb the player has and
    //    nobody else does - is the same bug wearing different clothes. So the
    //    identical resolver runs on both, from the same seeded stream, against
    //    the same terms, and the world is full of people who have bought each
    //    other and been bought.
    //
    //    Nothing here reads an alignment to decide the roll. What is on the
    //    table is read off what the actor actually HAS - a purse, a house
    //    behind them, an account they can call in, or nothing but themselves -
    //    and the ask is read off what stands between the two houses. Charm
    //    works everywhere; the fallout is what differs, and the fallout is
    //    `leverage_understood` below.
    {
        kind: 'leverage_applied',
        weight: 12,
        apply(state, day, rng) {
            const living = theWorldsPeople(state).filter(n => n.status === 'alive' && isBelowTheLid(n));

            // ── A MANOEUVRE ALREADY RUNNING IS PICKED UP AGAIN. ──────────
            //
            // Measured, and the reason this is not a uniform draw. With the
            // actor drawn uniformly from everybody alive, three seeds over
            // five hundred years gave 2-3 manoeuvres a century and ZERO
            // discoveries, because a first attachment lands at 0.22 and the
            // discovery half will not look at a tie below 0.45. Every
            // manoeuvre in the world was somebody's first one, so the second
            // stage was unreachable and this whole subsystem was a weight in
            // a table. Biasing after the draw did not help either: about eight
            // people in two hundred and fifty were working anybody, so the
            // continuation branch came up roughly half a time per run.
            //
            // The floor is not the thing to move - 0.45 is the honest reading
            // of "attached enough that finding out would hurt". What was wrong
            // is that somebody working a person COMES BACK TO THAT PERSON, and
            // the draw did not know it.
            const continuations: { actor: NpcRecord; subjectId: string }[] = [];
            for (const person of living) {
                for (const tie of person.relationships) {
                    if (tie.kind !== 'patron') continue;
                    if (!tie.factIds.some(id => isLeverageFact(state, id))) continue;
                    const other = living.find(n => n.id === tie.targetId);
                    // Only an ATTACHMENT chain is picked up again. A purse is a
                    // transaction and finishes when it is paid; an attachment
                    // is the one that is built over visits, and it is the only
                    // one there is anything to work out about later.
                    if (relationshipWith(other ?? person, person.id)?.kind !== 'ally') continue;
                    if (!other) continue;
                    continuations.push({ actor: person, subjectId: tie.targetId });
                }
            }
            const carryOn = continuations.length > 0 && rng.next() < LEVERAGE_CONTINUATION_SHARE;
            const continuation = carryOn ? pick(rng, continuations) : null;

            const actor = continuation ? continuation.actor : pick(rng, living);
            if (!actor) return null;

            const actorFaction = actor.factionId
                ? state.factions.find(f => f.id === actor.factionId) ?? null : null;
            const hostileIds = actorFaction
                ? Object.entries(actorFaction.standing)
                    .filter(([, v]) => v <= -0.3).map(([k]) => k)
                : [];

            // The person they are already working, or - starting fresh -
            // somebody they could be standing in front of, or somebody at a
            // house theirs is at odds with. The same two reasons `killing`
            // uses, because they are the same two reasons.
            const subject = continuation
                ? living.find(n => n.id === continuation.subjectId) ?? null
                : pick(rng, living.filter(n =>
                    n.id !== actor.id &&
                    (hostileIds.includes(n.factionId ?? '') || n.locationId === actor.locationId)
                ));
            if (!subject) return null;
            const subjectFaction = subject.factionId
                ? state.factions.find(f => f.id === subject.factionId) ?? null : null;

            // WHAT IS ON THE TABLE, read off what this person has. Never a
            // free choice, and never a verb.
            const available: ApproachLeverage[] = ['none'];
            if (actor.spiritStones >= LEVERAGE_PURSE) available.push('coin');
            if (actorFaction && !subjectFaction) available.push('sect');
            if (relationshipWith(subject, actor.id)) available.push('favour');
            // Everybody always has themselves. This is the one channel with no
            // precondition, which is exactly why it is the poor man's lever.
            available.push('attachment');
            // A second visit uses the lever that worked the first time. Coming
            // back with a different one is starting again, not escalating.
            const theirExisting = relationshipWith(subject, actor.id);
            const leverage: ApproachLeverage = continuation
                ? 'attachment'
                : pick(rng, available) ?? 'none';

            // ── WHAT IS BEING ASKED ESCALATES WITH THE TIE. ─────────────
            //
            // Measured, and this was the defect that kept the whole subsystem
            // at zero. The ask used to be read off faction hostility alone, so
            // anybody who belonged to a house was opened with
            // `against_their_interest` - 0.5 of resistance against a base of
            // 0.35, which floors the odds at 2% before a single other term is
            // read. Five hundred years produced twenty-three refusals, five
            // agreements and NOT ONE attachment that ever landed. The world
            // was running a subsystem that could only fail.
            //
            // Nobody opens by asking a stranger to betray their house. They
            // ask for something small, and the size of what they ask next is a
            // function of what they have built, which is a number already
            // sitting on the tie. Hostility between the houses still decides
            // how far it can eventually go; it no longer decides where it
            // starts.
            const built = Math.max(0, theirExisting?.standing ?? 0);
            const ask: AskWeight =
                built >= 0.6
                    ? (hostileIds.includes(subject.factionId ?? '')
                        ? 'a_betrayal' : 'against_their_interest')
                    : built >= 0.25 ? 'a_real_favour'
                        : 'a_courtesy';

            const result = resolveAttempt({
                actor: {
                    id: actor.id, name: actor.name,
                    ordinal: actor.cultivation.realmOrdinal,
                    charm: actor.cultivation.attributes.charm,
                    factionId: actor.factionId,
                    alignment: actorFaction?.alignment ?? null
                },
                subject: {
                    id: subject.id, name: subject.name,
                    ordinal: subject.cultivation.realmOrdinal,
                    charm: subject.cultivation.attributes.charm,
                    factionId: subject.factionId,
                    alignment: subjectFaction?.alignment ?? null,
                    ranked: Boolean(subject.factionId)
                },
                onDay: day,
                ask,
                approach: { leverage, audience: 'few' },
                // The whole translation between the two tie models: the world
                // layer stores standing from -1 to +1, and what the resolver
                // wants is how consequential the tie is, which is the positive
                // half of it.
                theirTie: theirExisting
                    ? { active: true, strength: Math.max(0, theirExisting.standing) }
                    : null,
                theyWantSomethingFromYou: activeGoals(subject).length > 0,
                rng
            });

            // ── ONE EVENT IS A CAMPAIGN, NOT A CONVERSATION. ─────────────
            //
            // Measured, and the last of the three gates that kept this at
            // zero. An attachment needs three landings to become worth
            // anything, and relying on the global draw to come back to the
            // same pair does not work at this scale: five manoeuvres a century
            // across two hundred and fifty people, against lifespans that end
            // long before the draw returns. Attachments landed - exactly one
            // per seed in five hundred years - and every one of them sat at
            // 0.22 forever because nobody ever came back.
            //
            // The world's tick is a YEAR, so an event here is already a span
            // rather than a moment, and somebody working a person works them
            // over that span. Each visit is its own roll off the same stream
            // against the tie as it then stands, and the ask escalates with
            // it exactly as it does on the player's side. The resolver is
            // untouched: this is the caller doing what a caller with a year to
            // spend would do.
            let campaign = result;
            // The furthest the tie actually got. Kept apart from the final
            // outcome because a campaign that builds an attachment over three
            // visits and is turned down on the fourth has still built the
            // attachment - and reading the tie off the last result threw all
            // of it away, which is why every campaign came back refused.
            let landed = result.marks.tie ? result : null;
            let built2 = Math.max(0, theirExisting?.standing ?? 0);
            if (leverage === 'attachment') {
                for (let visit = 0; visit < LEVERAGE_VISITS_PER_YEAR; visit++) {
                    if (campaign.outcome === 'refused' || campaign.outcome === 'reported') break;
                    built2 = campaign.marks.tie?.theirs.strength ?? built2;
                    // Within one year the manoeuvre BUILDS. Cashing it in is
                    // what a later year is for, and asking for the thing on
                    // the same afternoon you finished earning it is how the
                    // campaign was destroying itself.
                    const nextAsk: AskWeight = built2 >= 0.25 ? 'a_real_favour' : 'a_courtesy';
                    const next = resolveAttempt({
                        actor: {
                            id: actor.id, name: actor.name,
                            ordinal: actor.cultivation.realmOrdinal,
                            charm: actor.cultivation.attributes.charm,
                            factionId: actor.factionId,
                            alignment: actorFaction?.alignment ?? null
                        },
                        subject: {
                            id: subject.id, name: subject.name,
                            ordinal: subject.cultivation.realmOrdinal,
                            charm: subject.cultivation.attributes.charm,
                            factionId: subject.factionId,
                            alignment: subjectFaction?.alignment ?? null,
                            ranked: Boolean(subject.factionId)
                        },
                        onDay: day,
                        ask: nextAsk,
                        approach: { leverage, audience: 'few' },
                        theirTie: { active: true, strength: built2 },
                        yourTie: campaign.marks.tie
                            ? { active: true, strength: campaign.marks.tie.yours.strength }
                            : null,
                        theyWantSomethingFromYou: activeGoals(subject).length > 0,
                        rng
                    });
                    campaign = next;
                    if (next.marks.tie) landed = next;
                }
            }

            // The arrangement is real if ANY visit landed; the final outcome is
            // what the summary and the grudge are written from.
            const took = landed !== null;
            const subjectAt = state.npcs.findIndex(n => n.id === subject.id);
            if (subjectAt < 0) return null;

            const fact = emit(state, 'leverage_applied', day, {
                day,
                // An arrangement when it lands, a grudge when it does not. Both
                // are existing kinds; nothing new was needed for any of this.
                kind: took ? 'debt_incurred' : 'grudge_opened',
                scale: 'personal',
                summary:
                    `${actor.name} wanted something from ${subject.name}` +
                    (subjectFaction ? ` of the ${houseName(subjectFaction.name)}` : '') +
                    `. ${campaign.line}`,
                actors: [
                    { id: actor.id, name: actor.name, role: 'asked' },
                    { id: subject.id, name: subject.name, role: 'was asked' }
                ],
                locationId: subject.locationId,
                factionIds: subjectFaction ? [subjectFaction.id] : [],
                // Private by nature. Being asked is not news; being asked in
                // front of the wrong person is, and that is the audience term.
                visibility: took ? 'secret' : 'faction',
                magnitude: took ? 0.2 : 0.3,
                unattributed: took
                    ? 'Somebody who could not have afforded it last season has paid for something, ' +
                      'and is not saying who arranged it.'
                    : 'Two people had a short conversation at the edge of the market and one of ' +
                      'them walked off without finishing it.',
                consequences: {
                    immediate: campaign.line,
                    tenYearsLater: took
                        ? 'One of them is still assuming the other will help again.'
                        : 'The one who was asked has never once forgotten being asked.'
                }
            }, { npcs: [actor.id, subject.id] });

            // The marks. Written onto the world's own tie rows, carrying the
            // fact id, so the discovery template below has a causal chain to
            // read rather than a flag somebody invented for it.
            if (took) {
                state.npcs[subjectAt] = upsertRelationship(state.npcs[subjectAt], {
                    targetId: actor.id,
                    targetName: actor.name,
                    kind: leverage === 'attachment' ? 'ally' : 'client',
                    standing: landed?.marks.tie?.theirs.strength ?? 0.3,
                    note: `Came to an arrangement at ${subject.locationId ?? 'somewhere'}.`,
                    factIds: [fact.fact.id]
                }, day);
                const actorAt = state.npcs.findIndex(n => n.id === actor.id);
                if (actorAt >= 0) {
                    state.npcs[actorAt] = upsertRelationship(state.npcs[actorAt], {
                        targetId: subject.id,
                        targetName: subject.name,
                        kind: 'patron',
                        // The asymmetry IS the record. Nothing else marks this
                        // as instrumental and nothing else needs to.
                        standing: landed?.marks.tie?.yours.strength ?? 0,
                        note: 'Useful.',
                        factIds: [fact.fact.id]
                    }, day);
                }
            } else {
                // Turned down. The aggrieved party holds it, as everywhere.
                state.npcs[subjectAt] = upsertRelationship(state.npcs[subjectAt], {
                    targetId: actor.id,
                    targetName: actor.name,
                    kind: 'rival',
                    standing: campaign.outcome === 'reported' ? -0.5 : -0.3,
                    note: 'Asked for something they had no business asking for.',
                    factIds: [fact.fact.id]
                }, day);
            }

            return fact;
        }
    },

    // ── And years later, somebody works out what it was. ─────────────────
    //
    //    The delayed half, and the reason the whole subsystem is worth having.
    //    A grudge that opens the instant a manoeuvre succeeds is not the same
    //    thing as one that opens eleven years later, because the intervening
    //    years are years somebody spent believing it had worked cleanly.
    //
    //    What it looks for needs no new column: a tie one side reads as strong
    //    and the other has never returned, with a `leverage_applied` fact in
    //    its causal chain. The asymmetry is the evidence.
    {
        kind: 'leverage_understood',
        weight: 5,
        apply(state, day, rng) {
            const candidates: { subject: NpcRecord; actor: NpcRecord; sinceDay: number }[] = [];
            for (const subject of state.npcs) {
                if (subject.status !== 'alive' || !isBelowTheLid(subject)) continue;
                for (const tie of subject.relationships) {
                    if (tie.kind !== 'ally') continue;
                    if (tie.standing < LEVERAGE_ATTACHED_FLOOR) continue;
                    if (!tie.factIds.some(id => isLeverageFact(state, id))) continue;
                    // The actor does NOT have to still be alive, and requiring
                    // it was measured to be the gate that kept this template
                    // at zero firings in five hundred years: qualifying ties
                    // existed, and by the time anybody looked at them the
                    // person who had built them was dead. Working out that
                    // somebody used you does not require them to be breathing,
                    // and in a world where the ledger is inherited it is the
                    // more interesting case - the account opens against a name
                    // whose heirs are the ones who will have to answer it.
                    const actor = state.npcs.find(n => n.id === tie.targetId);
                    if (!actor) continue;
                    // Did they ever return it. This is the whole tell.
                    const back = relationshipWith(actor, subject.id);
                    if (back && back.standing >= LEVERAGE_RETURNED_FLOOR) continue;
                    candidates.push({ subject, actor, sinceDay: tie.sinceDay });
                }
            }
            const found = pick(rng, candidates);
            if (!found) return null;

            const { subject, actor, sinceDay } = found;
            const subjectFaction = subject.factionId
                ? state.factions.find(f => f.id === subject.factionId) ?? null : null;
            const back = relationshipWith(actor, subject.id);
            const tie = relationshipWith(subject, actor.id);

            const worked = haveTheyWorkedItOut({
                truth: {
                    heldById: actor.id,
                    aboutId: subject.id,
                    theirStrength: tie?.standing ?? 0.5,
                    yourStrength: Math.max(0, back?.standing ?? 0),
                    ask: 'against_their_interest',
                    audience: 'few',
                    formedOnDay: sinceDay
                },
                onDay: day,
                daysElapsed: Math.max(0, day - sinceDay),
                subjectInsight: subject.cultivation.attributes.insight,
                rng
            });
            if (!worked) return null;

            const outcome = whatTheyDoAboutIt({
                truth: {
                    heldById: actor.id,
                    aboutId: subject.id,
                    theirStrength: tie?.standing ?? 0.5,
                    yourStrength: Math.max(0, back?.standing ?? 0),
                    ask: 'against_their_interest',
                    audience: 'few',
                    formedOnDay: sinceDay
                },
                onDay: day,
                actorName: actor.name,
                subjectName: subject.name,
                subjectAlignment: subjectFaction?.alignment ?? null,
                subjectRanked: Boolean(subject.factionId),
                subjectFactionId: subject.factionId
            });

            const at = state.npcs.findIndex(n => n.id === subject.id);
            if (at < 0) return null;
            // The tie is rewritten rather than removed. `upsertRelationship`
            // keeps `sinceDay`, so an eleven-year attachment that turns hostile
            // is still eleven years old - which is what makes it read as
            // betrayal rather than as dislike.
            state.npcs[at] = upsertRelationship(state.npcs[at], {
                targetId: actor.id,
                targetName: actor.name,
                kind: 'enemy',
                standing: outcome.grudge.severity === 'unforgivable' ? -1
                    : outcome.grudge.severity === 'grave' ? -0.85 : -0.6,
                note: outcome.grudge.description
            }, day);

            // A righteous house takes it up, which is what turns one person's
            // account into a house's. A demonic one does not, and prices the
            // member instead. Both are read from the same alignment column.
            if (outcome.verdict.houseIsAParty && subjectFaction && actor.factionId) {
                const other = state.factions.find(f => f.id === actor.factionId);
                if (other) adjustStandingBetween(subjectFaction, other, -0.15);
            }

            return emit(state, 'leverage_understood', day, {
                day,
                kind: 'betrayal',
                scale: 'personal',
                summary: `${subject.name} worked out what ${actor.name} had wanted all along.`,
                actors: [
                    { id: subject.id, name: subject.name, role: 'used' },
                    { id: actor.id, name: actor.name, role: 'used them' }
                ],
                locationId: subject.locationId,
                factionIds: outcome.verdict.houseIsAParty && subjectFaction
                    ? [subjectFaction.id] : [],
                visibility: outcome.verdict.houseIsAParty ? 'faction' : 'secret',
                magnitude: 0.4,
                unattributed:
                    'Two people who were seen together for years are not seen together any more, ' +
                    'and only one of them will say why.',
                consequences: {
                    immediate: outcome.verdict.note,
                    losers: [{ id: subject.id, name: subject.name, role: 'used' }],
                    tenYearsLater: 'It has not stopped mattering to the one it happened to.'
                }
            }, {
                npcs: [subject.id, actor.id],
                factions: outcome.verdict.houseIsAParty && subjectFaction ? [subjectFaction.id] : []
            });
        }
    }
];

/** Follow-up visits a single year's manoeuvre can contain beyond the first. */
const LEVERAGE_VISITS_PER_YEAR = 3;

/** How often a manoeuvre already in progress is picked up again rather than a new one started. */
const LEVERAGE_CONTINUATION_SHARE = 0.75;

/** Spirit stones that count as having a purse to put on a table. */
const LEVERAGE_PURSE = 200;

/** How attached one side has to be before the shape is worth reading at all. */
const LEVERAGE_ATTACHED_FLOOR = 0.45;

/** Above this on the other side, it was returned and there is nothing to find out. */
const LEVERAGE_RETURNED_FLOOR = 0.3;

/** Whether a fact id in a tie's causal chain is one of these manoeuvres. */
function isLeverageFact(state: WorldState, factId: string): boolean {
    const fact = state.history.facts.find(f => f.id === factId);
    return fact?.data?.pressure === 'leverage_applied';
}

/** The table, for tests and for tuning. Read-only. */
export function pressureTemplates(): { kind: PressureKind; weight: number }[] {
    return TEMPLATES.map(t => ({ kind: t.kind, weight: t.weight }));
}
