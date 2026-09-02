/**
 * How the world keeps finding more ruins.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS EXISTS TO FIX
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The world held a FIXED SET of sealed sites, opened them one at a time, and
 * ran out. Measured on the real catalog, three seeds, before this module:
 *
 *     seed      years  opened  /century   first fifth   last fifth
 *     alpha      1000      54      5.40      12.5/c        1.5/c
 *     alpha      5000      67      1.34       5.4/c        0.0/c
 *     bravo      5000      67      1.34       5.2/c        0.0/c
 *     charlie    5000      73      1.46       6.4/c        0.0/c
 *
 * The last thousand years of a five-thousand-year run produced ZERO ruin
 * openings in every seed. That is not a weight problem and it was not fixed by
 * the widening that got the headline figure from 2.2 to 5.8 per century: the
 * widening added `faction_fell` compounds to what counts as a ruin, which is a
 * reclassification. The stock still runs out, it just takes longer.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE MODEL, WHICH IS THE DESIGN OWNER'S AND IS PRECISE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   > more ruins are discovered. they're a nonrenewable resource, but think of
 *   > fossil fuels, we always find more oil.
 *
 * NOBODY IS MAKING RUINS. The Late Age made them all and it is over. The stock
 * is finite in principle. What is NOT finite in practice is what has been
 * FOUND, because the world has never looked at most of its own ground and never
 * will. So the rate is governed by how hard and how widely people are looking,
 * not by a countdown to an empty list - which is exactly the distinction
 * between a reserve and an endowment, and exactly why proven oil reserves have
 * risen for a century out of a finite planet.
 *
 * Four consequences, and all four are implemented rather than asserted:
 *
 *   DISCOVERY IS EFFORT.        {@link prospectingEffortIn} counts the parties
 *                               actually out looking in a province. A province
 *                               with nobody in it finds nothing however much is
 *                               under it, and a populous one finds a lot.
 *
 *   THE EASY FINDS COME FIRST.  Ground is banded by how deep it is, and effort
 *                               goes to the least-worked band it can reach.
 *                               Band 0 is what anybody trips over; band 5 is
 *                               under something.
 *
 *   DIMINISHING RETURNS.        {@link FINDS_BEFORE_THE_RATE_HALVES} is a
 *                               hyperbolic decline on finds already made in
 *                               that band - the shape a producing field
 *                               actually has. It falls fast and then flattens
 *                               into a long tail, and it never reaches zero.
 *
 *   CAPABILITY OPENS NEW GROUND. A band nobody in the province can survive is a
 *                               band nobody is looking in. When the ladder
 *                               produces somebody deeper, ground that was
 *                               always there becomes findable, and the rate
 *                               steps back up. This is the whole of why the
 *                               curve does not asymptote to nothing, and it is
 *                               the same thing deepwater and shale are in the
 *                               analogy: not new oil, newly reachable oil.
 *
 * AND A PROVINCE CAN BE WORKED OUT WHILE ITS NEIGHBOUR IS BARELY TOUCHED. That
 * falls out of the two facts above without being written anywhere: effort
 * concentrates where the people are, so the populous provinces pick over first
 * and the empty frontier stays rich. {@link ruinsInGroundUnder} gives the
 * second cause - what the Late Age left is not evenly distributed either.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DISCOVERY IS NOT OPENING, AND THE TWO STAGES ARE THE FIX
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `ruin_opened` in `the-world-changing-on-its-own.ts` is PRODUCTION: it
 * consumes one standing site and tags it `emptied`. It was consuming a stock
 * nothing replenished, which is why it went to zero.
 *
 * This module is EXPLORATION. It adds to the standing reserve by minting a ruin
 * that was always there and has now been found - `discovered: true`, still
 * `sealed`, on the map for the first time. Nothing is created that the Late Age
 * did not leave; what changes is that somebody knows where it is.
 *
 * So the two rates are separable and are supposed to be: openings track
 * discoveries because discovery is the binding constraint, and the reserve
 * standing at any moment is the difference between them. That is the same pair
 * of numbers an oil ministry publishes and for the same reason.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IS FOUND IS NOT ALL THE SAME THING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A find gets a `character` and an `access` band out of the same two catalogs
 * the authored sites in `data/cultivation/inheritance-trials.ts` use, so a
 * minted compound and an authored one are the same kind of object described the
 * same way. There is no second vocabulary for procedural ruins.
 *
 * The three access shapes do different things and the depth band decides which
 * is plausible: shallow ground is nearly always an ordinary minimum, a cap
 * turns up where somebody built for their own people, and an elder floor is
 * what deep ground looks like from outside. See
 * `THE_THREE_WAYS_GROUND_IS_CLOSED`.
 */

import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import { clampOrdinal } from '../cultivation/realms.js';
import {
    ELDER_FLOOR_ORDINAL,
    type IntentStanding,
    type RuinAccess,
    type RuinCharacter,
    type RuinOrigin,
    type RuinScale
} from '../../data/cultivation/inheritance-trials.js';
import { wardConditionOf, wardIntegrityOf } from './how-far-gone-a-formation-is.js';
import { isBelowTheLid } from './layers.js';
import {
    makeEnvironment,
    makeThresholds,
    makeAffinity,
    makeLocation,
    type LocationRecord
} from './locations.js';
import { clampQiDensity } from './qi-scale.js';
import type { WorldState } from './world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// THE DOCTRINE
// Stated once, as data, so the tests assert against the same sentences the
// constants below were derived from.
// ─────────────────────────────────────────────────────────────────────────

export const RUINS_ARE_A_RESERVE_NOT_AN_ENDOWMENT = {
    principle:
        'Nobody is making ruins. The Late Age made them all and it is over, so the stock is finite in principle. What is not finite in practice is what has been found, because the world has never looked at most of its own ground and never will.',
    soTheRateIsGovernedBy:
        'How hard and how widely people are looking. Not by a countdown to an empty list. A province with nobody in it finds nothing whatever is under it, and the same province a century later with four houses working out of it finds several a decade.',
    theEasyGroundGoesFirst:
        'Ground is banded by depth and effort goes to the least-worked band anybody in the province can reach. What is found early is what people trip over; what is found late is under something, is more dangerous, and is worth more.',
    diminishingReturnsIsTheWholeShape:
        'Each find in a band makes the next one in that band harder, on a hyperbolic decline - steep at first and then a very long flat tail. That is the shape a producing field has, and it is why the analogy is worth taking literally rather than decoratively.',
    andCapabilityOpensGroundThatWasAlwaysThere:
        'A band nobody in the province can survive is a band nobody is looking in. When the ladder produces somebody who can go deeper, ground that has been there the whole time becomes findable and the rate steps back up. This is not new ruins. It is deepwater, and it is the reason the curve does not go to nothing.',
    whatThisIsNot:
        'It is not a spawner. Nothing here creates a ruin that the prior ages did not leave: every province has a stated number in the ground, the number is fixed for the life of the world, and a province that reaches it stops producing finds permanently. The claim is that the numbers are large and the looking is slow, not that the ground is infinite.',
    theMeasurementThatMatters:
        'The long horizon. A countdown and a reserve are indistinguishable at year 200 and differ completely at year 5000, so any change here has to be measured at five thousand years or it has not been measured.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// DEPTH
// ─────────────────────────────────────────────────────────────────────────

/**
 * How many bands of depth the ground has.
 *
 * Six, spanning the ladder: band 0 is a wall in a field and band 5 is under
 * something that has to be held apart. More bands would be finer resolution on
 * a quantity nobody reads at that precision; fewer would put a border post and
 * a sealed vault in the same category, which is the state this replaced.
 */
export const DEEPEST_BAND = 5;

/** Ordinals per band, so band and rung stay one arithmetic rather than two tables. */
export const ORDINALS_PER_BAND = 7;

/**
 * The deepest band anybody at this rung can look in.
 *
 * Looking is not entering: a party surveys a band it could survive, because a
 * party that cannot survive what it finds does not come back to report it. This
 * is the mechanism by which the world's own ladder decides what the world can
 * discover, and it is why a province that produces its first Nascent Soul
 * cultivator starts finding a different sort of ruin within the decade.
 */
export function depthBandReachableBy(ordinal: number): number {
    return Math.max(0, Math.min(DEEPEST_BAND, Math.floor(ordinal / ORDINALS_PER_BAND)));
}

/** The rung the ground in a band is dangerous at. The floor of what is found there. */
export function floorOrdinalForBand(band: number): number {
    return clampOrdinal(band * ORDINALS_PER_BAND);
}

// ─────────────────────────────────────────────────────────────────────────
// EFFORT
// ─────────────────────────────────────────────────────────────────────────

/**
 * The rung at which somebody is any use on a survey.
 *
 * Below this a person can walk over a ruin and not know, which is not a
 * judgement about them: reading ground is a trained skill and the training is
 * what the first few years of cultivation consist of. Mortals are excluded here
 * and are emphatically not excluded from FINDING things - a farmer turns up a
 * tally token with a plough - but a plough is not a survey and the rate this
 * module governs is the rate of deliberate looking.
 */
export const PROSPECTING_FLOOR_ORDINAL = 3;

/** Cultivators to a party. Eight, which is what a house sends and can feed. */
export const PROSPECTORS_PER_PARTY = 8;

/**
 * Chance per party-year of a find in unworked ground.
 *
 * The single tuning number in the module, and it was fitted against the
 * measured baseline rather than chosen. It was set four times higher first, and
 * the measurement said why that was wrong: discovery outran the event draw, so
 * `ruin_opened` sat flat at fifteen per century for a thousand years with a
 * reserve of two hundred and fifty standing sites behind it. A rate governed by
 * the draw is not a rate governed by looking, and the whole point of the module
 * is that looking is what governs it. DISCOVERY HAS TO BE THE BINDING
 * CONSTRAINT or none of the shape below is observable.
 */
export const EASY_FIND_ODDS_PER_PARTY_YEAR = 0.0022;

/**
 * Finds before the rate in a province has halved.
 *
 * The decline constant, and the shape is hyperbolic rather than exponential on
 * purpose: an exponential decline reaches nothing, and the whole claim of the
 * model is that a picked-over province keeps yielding at a low rate for as long
 * as anybody keeps looking. It never arrives at zero - the endowment does that,
 * and only the endowment.
 *
 * It counts the WHOLE PROVINCE rather than the band being worked, and that was
 * a correction. Counting per band let the decline reset every time the ladder
 * opened a deeper one, so a five-hundred-year world found MORE per century than
 * a hundred-year one and the curve ran backwards. A basin does not become
 * unworked because somebody drilled deeper in it.
 */
export const FINDS_BEFORE_THE_RATE_HALVES = 5;

export interface ProvinceProspect {
    regionId: string;
    /** Parties out looking, which is people over `PROSPECTORS_PER_PARTY`. */
    parties: number;
    /** The deepest band anybody here could survey. */
    reachableBand: number;
    /** The band effort is currently going into, or null when there is none left. */
    workingBand: number | null;
    /** Finds already made in the working band. */
    foundInBand: number;
    /** What the Late Age left in that band, which is fixed for the world's life. */
    inGroundInBand: number;
    /** Everything found under this province, in every band. What the decline reads. */
    foundInProvince: number;
    /**
     * The decline term: what has been found, spread over the bands anybody can
     * reach. A province that can only reach the surface declines on its whole
     * history; the same province once it can reach three bands declines on a
     * third of it, which is what a new play does to a mature basin.
     */
    workedOverBy: number;
    /** Odds of a find this year. Zero when the province is worked out or empty. */
    oddsThisYear: number;
}

/** The region a location sits under, or itself when it is one. */
function regionIdOf(state: WorldState, locationId: string | null): string | null {
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

/**
 * How many parties are out looking in this province, and how deep they can go.
 *
 * Read off the roster rather than stored, for the same reason `roadsInReachOf`
 * derives rather than stores: the answer has to change when the world changes,
 * and a province that empties has to stop finding things the year it empties
 * rather than the year somebody remembers to decrement a counter.
 */
export function prospectingEffortIn(
    state: WorldState,
    regionId: string
): { parties: number; strongestOrdinal: number } {
    let lookers = 0;
    let strongest = 0;
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !isBelowTheLid(npc)) continue;
        if (npc.cultivation.realmOrdinal < PROSPECTING_FLOOR_ORDINAL) continue;
        if (regionIdOf(state, npc.locationId) !== regionId) continue;
        lookers++;
        if (npc.cultivation.realmOrdinal > strongest) strongest = npc.cultivation.realmOrdinal;
    }
    return { parties: lookers / PROSPECTORS_PER_PARTY, strongestOrdinal: strongest };
}

// ═════════════════════════════════════════════════════════════════════════
// WHAT THE WORLD'S OWN DEAD LEAVE, WHICH IS MOST OF THE RESERVE
//
// `docs/world/climbing/immortals.md` is the spec for this and states it better than any
// paraphrase: nothing goes through the Lid except the cultivator, they know it
// well in advance, and the years before a crossing are spent DIVESTING -
// selling, gifting, burying, sealing and arranging everything that will buy
// nothing where they are going. The doc names itself the author of the world's
// entire inheritance economy, and it is right: it is why sealed caves have
// trials in them, why the trials are CALIBRATED rather than merely lethal, and
// why a manual three grades above anything taught is behind a door with a
// riddle on it.
//
// TWO THINGS THAT WIDEN IT, both from the design owner:
//
//   LEAVING SOMETHING BEHIND IS NOT AN APEX BEHAVIOUR. It is an ordinary one
//   that the apex does spectacularly. Anybody who can see the end coming - an
//   ascension, a lifespan running out, a war they do not expect to survive -
//   arranges what they have for whoever comes after, at whatever scale they
//   happen to have. A Foundation-rung elder with three manuals and a cave does
//   the same thing at three orders of magnitude down.
//
//   SO THE DISTRIBUTION IS THE DESIGN, AND IT IS NOT AUTHORED. Every realm is a
//   bucket and the low buckets are enormous, so the world is thick with modest
//   half-decayed arrangements left by people nobody has heard of and holds a
//   bare handful of great ones. That falls out of counting the dead rather than
//   out of a table, which is the whole reason this reads the roster.
//
// ONE RULE FROM ORDINAL 0 TO 46. What the person had decides the contents, the
// danger, the quality of the formation and therefore how long it lasts before
// decay opens it - and it makes the calibration the doc describes automatic,
// because a builder calibrates for a successor like themselves. A trial is hard
// at the rung it was aimed at and easy for anybody well above it, without a
// difficulty number having been assigned anywhere.
// ═════════════════════════════════════════════════════════════════════════

/**
 * The rung at which somebody has a door of their own and something behind it.
 *
 * Below this a person dies in a room in a village with their possessions in it,
 * which is an estate rather than closed ground. It is deliberately low, because
 * the point of the distribution is that the enormous low buckets are where
 * nearly all of this comes from.
 */
export const RUNG_AT_WHICH_SOMEBODY_HAS_A_DOOR = 8;

/**
 * How many of the dead arranged it rather than simply stopping.
 *
 * Not all of them, and not few of them. Somebody who knew their years were up
 * and shut the door on purpose, having arranged what was inside, is performing
 * the same act as an ascension's divestment; somebody who did not see it coming
 * leaves a room exactly as it was on the day. Both are real and the world
 * should hold both, because the difference between them is the difference
 * between an inheritance and a ruin and it has to be discoverable rather than
 * announced.
 */
export const SHARE_OF_THE_DEAD_WHO_ARRANGED_IT = 0.45;

/**
 * How thin a formation has to get before anybody can tell the place is there.
 *
 * THIS IS WHY THE RESERVE ARRIVES ON A SCHEDULE. A door closed last year draws
 * evenly and looks like a door; a door whose draw has gone uneven is a thing a
 * reader spots from the outside. So a cultivator at ordinal 12 becomes findable
 * about forty years after they stop, and one at ordinal 30 stays shut for
 * roughly two thousand - which is why the deep ground is the ground nobody has
 * been able to get into rather than the ground nobody has found.
 */
export const FINDABLE_ONCE_INTEGRITY_FALLS_BELOW = 0.85;

/** What a dead cultivator left, and what state it is in now. */
export interface ClosedGroundLeftByTheDead {
    occupantId: string;
    occupantName: string;
    /** The rung they were at, which decides everything downstream. */
    ordinal: number;
    yearsSince: number;
    /** True where they saw it coming and arranged it. See `SHARE_OF_THE_DEAD_WHO_ARRANGED_IT`. */
    arranged: boolean;
    /** True where they went through the Lid, which is the great end of the scale. */
    crossed: boolean;
    wardIntegrity: number;
    origin: RuinOrigin;
    intent: IntentStanding;
    scale: RuinScale;
}

/**
 * How big a thing somebody at this rung leaves.
 *
 * One rule across the whole ladder. A cave is what a Qi Condensation cultivator
 * has; a seat is what somebody at the top of it has, and everything between is
 * between. Nothing is hand-authored per tier and nothing branches on who they
 * were.
 */
export function scaleLeftBySomebodyAt(ordinal: number): RuinScale {
    if (ordinal >= 37) return 'a_mountain';
    if (ordinal >= 29) return 'a_compound';
    if (ordinal >= 21) return 'a_building';
    return 'one_room';
}

/**
 * Everybody under this province who has left closed ground behind them, and
 * whose door has thinned enough for anybody to know it is there.
 *
 * Derived from the roster rather than stored, on the same reasoning as
 * `roadsInReachOf`: the answer has to change as the world changes, and the
 *world's own death records already imply the rate, so storing a second copy of
 * it would only give the two a way to disagree.
 */
export function whatTheDeadLeftUnder(
    state: WorldState,
    regionId: string,
    nowYear: number
): ClosedGroundLeftByTheDead[] {
    const out: ClosedGroundLeftByTheDead[] = [];
    const crossed = new Set(state.ascensions.map(a => a.residentId));

    for (const npc of state.npcs) {
        if (npc.status === 'alive') continue;
        const ordinal = npc.cultivation.realmOrdinal;
        if (ordinal < RUNG_AT_WHICH_SOMEBODY_HAS_A_DOOR) continue;
        if (regionIdOf(state, npc.locationId) !== regionId) continue;

        const diedOn = npc.diedOnDay ?? npc.identity.bornOnDay;
        const yearsSince = Math.max(0, nowYear - Math.floor(diedOn / 365));
        const integrity = wardIntegrityOf({ setByOrdinal: ordinal, yearsSince });
        if (integrity >= FINDABLE_ONCE_INTEGRITY_FALLS_BELOW) continue;

        const wentThrough = crossed.has(npc.id);
        // Deterministic per person, so the same world always says the same
        // thing about the same body and a replay agrees with itself.
        const arranged = wentThrough
            // Divestment is what an ascension DOES. Everybody who crosses
            // arranges, because they know years in advance and none of what
            // they hold will buy anything on the far side.
            || forStream('divested', npc.id).chance(SHARE_OF_THE_DEAD_WHO_ARRANGED_IT);

        out.push({
            occupantId: npc.id,
            occupantName: npc.name,
            ordinal,
            yearsSince,
            arranged,
            crossed: wentThrough,
            wardIntegrity: integrity,
            origin: arranged ? 'left_addressed' : 'a_door_nobody_opened_again',
            // AND THIS IS THE CONVERGENCE. An arrangement binds while the
            // formation enforcing it is still up, and stops binding when it is
            // not. Nothing reclassifies the place; the thing that was doing the
            // sorting simply stops being able to refuse anybody.
            intent: !arranged
                ? 'never_addressed'
                : wardConditionOf(integrity) === 'nearly_gone' || wardConditionOf(integrity) === 'a_wall'
                    ? 'lapsed'
                    : 'addressed',
            scale: scaleLeftBySomebodyAt(ordinal)
        });
    }

    // Thinnest doors first, which is the order anybody actually finds them in.
    return out.sort((a, b) => a.wardIntegrity - b.wardIntegrity);
}

/**
 * Whether there is somebody alive behind this door.
 *
 * ENGINE-ONLY, AND IT MUST NEVER REACH A PROSPECTOR'S VIEW. From outside, a live
 * cultivator's sealed cave and a dead one's sealed cave are the same object: a
 * door somebody put a formation on and did not open again. A prospector cannot
 * tell, and the only way to find out is to open it - which is what makes
 * sealing look like treasure and is the best available reason for a rare bad
 * thing to reach somebody in closed-door seclusion. One person's delve is
 * another person's very bad afternoon.
 *
 * This is the predicate the seclusion side should read rather than inventing a
 * parallel one, and {@link oddsOfGettingThroughTheDoor} in
 * `how-far-gone-a-formation-is.ts` is the odds both ends share.
 */
export function isSomebodyStillAliveInThere(
    state: WorldState,
    location: LocationRecord
): { occupied: boolean; occupantId: string | null } {
    const occupantId = location.data.occupantId;
    if (typeof occupantId === 'string') {
        const npc = state.npcs.find(n => n.id === occupantId);
        return { occupied: npc?.status === 'alive', occupantId };
    }
    for (const npc of state.npcs) {
        if (npc.status !== 'alive') continue;
        if (npc.locationId !== location.id) continue;
        return { occupied: true, occupantId: npc.id };
    }
    return { occupied: false, occupantId: null };
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IS IN THE GROUND
// ─────────────────────────────────────────────────────────────────────────

/** The `data` key a province's tally for one band lives on. */
export function foundKeyForBand(band: number): string {
    return `ruinsFound:${band}`;
}

/**
 * What the Late Age left under this province, in this band.
 *
 * Fixed for the life of the world and derived from the province's own id, so it
 * is the same number in every replay of the same seed and different between
 * provinces. The spread is the second reason a province can be worked out while
 * its neighbour is barely touched: the first reason is where the people are,
 * and this one is where the Late Age happened.
 *
 * The numbers are large on purpose. This is the only thing in the module that
 * makes the stock genuinely finite, and the claim being made is that the
 * looking is slow rather than that the ground is bottomless - a province worked
 * hard for five thousand years does approach it, and the measurement says so.
 */
export function ruinsInGroundUnder(region: LocationRecord, band: number): number {
    const rng = forStream('ruins-in-ground', region.id, String(band));
    // Deeper ground holds less of what anybody would call a ruin, because the
    // Late Age built on the surface like everybody else.
    const taper = 1 - band * 0.09;
    return Math.max(4, Math.round((18 + rng.int(0, 26)) * taper));
}

/**
 * Where a province stands: how hard it is being looked at, how deep, and what
 * the odds of a find are this year.
 *
 * Pure. Reads state, decides nothing, writes nothing - which is what makes it
 * the thing a test and a player-facing report can both call.
 */
export function prospectFor(state: WorldState, region: LocationRecord): ProvinceProspect {
    const { parties, strongestOrdinal } = prospectingEffortIn(state, region.id);
    const reachableBand = depthBandReachableBy(strongestOrdinal);

    // Effort goes to the least-worked band anybody can reach, shallowest first
    // on a tie. That is the easy ground going first, and it is also why a
    // province whose ladder has just produced somebody deeper steps its rate
    // back up: the new band is unworked and therefore outbids the old one.
    let workingBand: number | null = null;
    let foundInBand = 0;
    let inGroundInBand = 0;
    for (let band = 0; band <= reachableBand; band++) {
        const inGround = ruinsInGroundUnder(region, band);
        const found = Number(region.data[foundKeyForBand(band)] ?? 0);
        if (found >= inGround) continue;
        if (workingBand === null || found < foundInBand) {
            workingBand = band;
            foundInBand = found;
            inGroundInBand = inGround;
        }
    }

    const foundInProvince = foundUnder(region);
    const workedOverBy = foundInProvince / (reachableBand + 1);
    const odds = workingBand === null || parties <= 0
        ? 0
        : (parties * EASY_FIND_ODDS_PER_PARTY_YEAR) / (1 + workedOverBy / FINDS_BEFORE_THE_RATE_HALVES);

    return {
        regionId: region.id,
        parties,
        reachableBand,
        workingBand,
        foundInBand,
        inGroundInBand,
        foundInProvince,
        workedOverBy,
        oddsThisYear: Math.min(1, odds)
    };
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT SORT OF THING GETS FOUND, AND HOW IT IS CLOSED
//
// The characters and the access shapes are the catalog's, imported rather than
// restated. What is decided here is only which of them are PLAUSIBLE at a
// depth, which is a fact about the world rather than about the vocabulary.
// ─────────────────────────────────────────────────────────────────────────

/**
 * What turns up at each depth.
 *
 * Shallow ground is what people built on top of and beside: posts, fields,
 * yards, open ground. Deep ground is what people put under something on
 * purpose, which is why the vaults and the archives are at the bottom and why a
 * party that wants one has to be able to get there.
 */
export const CHARACTERS_BY_BAND: readonly (readonly RuinCharacter[])[] = [
    ['waystation', 'open_ground', 'cut', 'battlefield'],
    ['waystation', 'open_ground', 'dwelling', 'physic_garden', 'battlefield'],
    ['compound', 'workshop', 'physic_garden', 'cut', 'scar'],
    ['compound', 'workshop', 'teaching_hall', 'array_anchor', 'scar'],
    ['archive', 'vault', 'ossuary', 'array_anchor', 'teaching_hall'],
    ['archive', 'vault', 'ossuary', 'compound']
];

/**
 * Hazards a character actually has, so a minted ruin reads to every system that
 * already switches on hazards the way an authored one would.
 */
const HAZARDS_BY_CHARACTER: Readonly<Record<RuinCharacter, readonly string[]>> = {
    compound: ['formation', 'guardian'],
    workshop: ['corrosive', 'formation'],
    archive: ['formation', 'sealed_qi'],
    vault: ['formation', 'sealed_qi', 'guardian'],
    battlefield: ['formation', 'pressure'],
    scar: ['lightning', 'thin_qi'],
    waystation: ['beasts'],
    physic_garden: ['beasts', 'corrosive'],
    array_anchor: ['pressure', 'formation'],
    ossuary: ['sealed_qi', 'guardian'],
    teaching_hall: ['formation'],
    cut: ['pressure', 'thin_qi'],
    dwelling: ['formation'],
    open_ground: []
};

/**
 * How a find is closed, given how deep it is and what sort of place it is.
 *
 * The minimum is the ordinary case at every depth and the design owner is
 * explicit about why: a ruin has to be a decision, and a cultivator has to be
 * able to walk in and find out. The other two are rarer and are what they are
 * for a reason attached to the character rather than to the number:
 *
 *   a cap        wherever somebody built a working fitting for their own
 *                people - a garden ward, a store door, a floor over a shaft.
 *                Those are the characters where a thing sized for a body is
 *                plausible, and it is not plausible at a battlefield.
 *   an elder     deep ground, where the approach rather than the door is what
 *   floor        kills, and where the person who can make it is by definition
 *                not the person who needs what is in it.
 */
function accessForFind(
    character: RuinCharacter,
    band: number,
    rng: CultivationRNG
): RuinAccess {
    const floor = floorOrdinalForBand(band);

    const capable: readonly RuinCharacter[] = [
        'physic_garden', 'vault', 'cut', 'dwelling', 'workshop', 'archive'
    ];
    if (capable.includes(character) && rng.chance(0.22)) {
        // A fitting built for a house's own people, which has a range because
        // every measuring instrument has one.
        const ceiling = clampOrdinal(Math.max(floor + 2, floor + 6 + rng.int(0, 8)));
        return {
            admits: 'nobody_above_the_line',
            floorOrdinal: floor,
            ceilingOrdinal: ceiling,
            whatReadsThePerson:
                'A working fitting the house put here for its own people, which measures whoever is standing at it because that is what it was built to do and nobody ever asked it to do anything else.',
            whyItRefusesPower:
                'It is an instrument with a range rather than a defence with a threshold. Past the top of its range it does not read a stronger claimant as a stronger claimant, it reads nothing at all, and a thing that reads nothing does not open.',
            soWhoGoesInstead:
                'Somebody the party can spare who is small enough to be read, which is the standing practice of every house that has worked one of these and is written into nobody\'s procedure in those words.'
        };
    }

    if (band >= 4 && rng.chance(0.5)) {
        return {
            admits: 'elders_and_above',
            floorOrdinal: clampOrdinal(Math.max(ELDER_FLOOR_ORDINAL, floor)),
            whyNobodyBelowComesBack:
                'The approach rather than the door. Ground at this depth is under something that has to be held apart for as long as anybody is inside it, and a party that splits the holding between two people finds out that the holding is the whole job.',
            whoTheyGoFor:
                'The junior the elder is bringing up, who is stopped at a wall that what is down there answers and who cannot make the approach.',
            whatComesBackForThatPerson:
                'Something sized for somebody two realms below the person carrying it out, which is the only reason anybody at that height goes into a hole at all.'
        };
    }

    return {
        admits: 'anyone_who_survives_it',
        floorOrdinal: floor,
        whatIsDownThere:
            'What the house left when it stopped, at the setting it was left at, still doing whatever it was doing on the last day anybody was here to watch it.',
        whatItDoesToSomebodyShortOfIt:
            'The same thing it does to everybody, which is the point of a minimum: nothing forbids the entry, nothing announces itself, and the question of whether this was a good idea is settled on the way out rather than at the door.'
    };
}

// ─────────────────────────────────────────────────────────────────────────
// NAMING
//
// A name has to be what somebody would actually call the place. The authored
// catalog sets the standard - "The Gate Frame With No Gate In It", "The Cave
// That Checks the Work" - and what those have in common is that they are what a
// person standing nearby says, not a label. So the templates below all name a
// physical thing and a fact about it, and none of them contains an adjective
// about how impressive it is.
// ─────────────────────────────────────────────────────────────────────────

const NAMES_BY_CHARACTER: Readonly<Record<RuinCharacter, readonly string[]>> = {
    compound: ['The Compound With Its Formations Out', 'The Seat Nobody Came Back To', 'The Walls Above %P'],
    workshop: ['The Floor With the Stock Still On It', 'The Cold Furnace Above %P', 'The Workshop They Swept First'],
    archive: ['The Shelves Under the Fall', 'The Room They Left the Lamps In', 'The Order On the Shelves at %P'],
    vault: ['The Door That Was Not Worth Breaking', 'The Undercroft Under %P', 'The Store With the Lid Still On'],
    battlefield: ['The Field the Crop Line Goes Round', 'Where Both of Them Stopped', 'The Ground Above %P Nobody Ploughs'],
    scar: ['The Fused Ground Above %P', 'The Line Where the Grass Stops', 'The Sheet Nobody Crosses Twice'],
    waystation: ['The Post Above the Ford', 'The Relay With the Board Still Up', 'The Bridge House At %P'],
    physic_garden: ['The Beds Under the Turf', 'The Wall Round the Old Physic', 'The Garden Above %P'],
    array_anchor: ['The Stone That Is Still Carrying', 'The Node Nobody Lit', 'The Anchor Above %P'],
    ossuary: ['The Walled Plot At %P', 'The Chamber With the Course Cut Over It', 'The Ten They Put Together'],
    teaching_hall: ['The Curriculum Cut Into the Face', 'The Hall They Taught Out Of', 'The Wall Above %P With the Exercises On It'],
    cut: ['The Working Face At %P', 'The Shaft With the Ladders Out', 'The Cut They Laid a Lid Over'],
    dwelling: ['The Rooms Somebody Lived In', 'The Cave Above %P With the Lintel Cut', 'The Seat Chamber Nobody Emptied'],
    open_ground: ['The Ground Above %P', 'The Stone in the Long Field', 'The Depression Nothing Grows In']
};

/** A place name a person would use, derived from the province and the character. */
export function nameForFind(
    region: LocationRecord,
    character: RuinCharacter,
    rng: CultivationRNG
): string {
    const templates = NAMES_BY_CHARACTER[character];
    const template = templates[rng.int(0, templates.length - 1)];
    const place = region.name.replace(/^(?:the|The)\s+/, '').replace(/\s*\(region\)\s*$/i, '');
    return template.replace('%P', place);
}

// ─────────────────────────────────────────────────────────────────────────
// A NAMER MUST NEVER BE FED ITS OWN OUTPUT
//
// This is written down because it happened. The inner-room namer built from
// `seat.name`, and the inner room it minted was itself tagged `ruined` and left
// undiscovered - which is exactly the pool `findFallenSeatUnder` draws from. So
// every pass wrapped the previous pass's output, and a live world log produced
// this on one location:
//
//   The Door At The Door At The Door At ... Frostmirror Court grounds
//   That Nobody Left Could Open That Nobody Left Could Open ...
//
// Fourteen prefixes and fourteen suffixes. The template is fine - one pass
// gives "The Door At Frostmirror Court grounds That Nobody Left Could Open",
// which is a name somebody would use. It was a FIXPOINT bug, not a naming bug,
// and it had three independent causes, every one of which is fixed here because
// any one of them left alone keeps the pattern latent:
//
//   1. THE POOL LEAKED. An inner room is not a fallen seat and must never be
//      selectable as one. It carries `INNER_ROOM_TAG` now and the selector
//      excludes it, which is the real fix - the other two are belt and braces.
//   2. THE NAMER READ A FIELD IT WRITES. It builds from the UNDERLYING PLACE
//      now, via `baseNameOf`, and every minted place stores `data.baseName` so
//      later passes have a clean root instead of having to recover one.
//   3. NOTHING NOTICED. `decorateOnce` refuses to re-apply a wrapper that is
//      already present, so even a caller that gets both of the above wrong
//      produces one layer rather than fourteen.
//
// The general rule, for anything added here later: A GENERATOR MUST NOT READ THE
// FIELD IT WRITES. If it has to, unwrap to the base first and assert the result
// is stable under a second application.
// ─────────────────────────────────────────────────────────────────────────

/** Marks a place minted as a room INSIDE another. Never a seat in its own right. */
export const INNER_ROOM_TAG = 'inner-room';

/**
 * Wrappers this module applies to a place name, so they can be recognised and
 * stripped rather than stacked.
 *
 * Only wrappers built from a LOCATION name belong here. "The Door <person> Did
 * Not Open Again" is not in the table and must not be: it composes a person's
 * name, which is never re-read off a location, so it cannot recurse - and
 * stripping it would damage a legitimately named place.
 */
const NAME_WRAPPERS: readonly { prefix: string; suffix: string }[] = [
    { prefix: 'The Door At ', suffix: ' That Nobody Left Could Open' }
];

/**
 * The underlying place, with any decoration this module applied taken back off.
 *
 * Prefers the stored `data.baseName`, which minted places carry precisely so
 * this never has to guess. Falls back to unwrapping, repeatedly, which is what
 * repairs a world that is already carrying a compounded name.
 */
export function baseNameOf(location: LocationRecord): string {
    const stored = location.data.baseName;
    if (typeof stored === 'string' && stored.length > 0) return stored;
    return undecorate(location.name);
}

/** Strip every layer of every known wrapper. Terminates: each pass shortens. */
export function undecorate(name: string): string {
    let out = name;
    for (let guard = 0; guard < 64; guard++) {
        let changed = false;
        for (const { prefix, suffix } of NAME_WRAPPERS) {
            if (out.startsWith(prefix) && out.endsWith(suffix)) {
                out = out.slice(prefix.length, out.length - suffix.length);
                changed = true;
            }
        }
        if (!changed) break;
    }
    return out.trim();
}

/**
 * Apply a wrapper exactly once, whatever it is handed.
 *
 * Idempotent by construction: `decorateOnce(decorateOnce(x)) === decorateOnce(x)`,
 * which is the property the test asserts and the property whose absence produced
 * fourteen layers.
 */
export function decorateOnce(base: string, wrapper: { prefix: string; suffix: string }): string {
    const root = undecorate(base);
    return `${wrapper.prefix}${root}${wrapper.suffix}`;
}

/** The inner-room name, built from the underlying place and never from itself. */
export function nameForInnerRoom(seat: LocationRecord): string {
    return decorateOnce(baseNameOf(seat), NAME_WRAPPERS[0]);
}

/**
 * Repair a world that is already carrying compounded names.
 *
 * Worlds are in flight and their locations are persisted, so fixing the
 * generator does not fix the rows it already wrote. This is idempotent and
 * cheap, and it runs at the top of the yearly pass so an affected world heals
 * itself on its next tick rather than needing anybody to migrate it.
 *
 * It also repairs `daoSubject`, which is set from `location.name` when a found
 * place turns out to teach a road and would otherwise keep a copy of the
 * compounded string after the name itself was fixed.
 */
export function repairCompoundedNames(state: WorldState): number {
    let repaired = 0;
    for (let i = 0; i < state.locations.length; i++) {
        const location = state.locations[i];
        // ONLY DECORATED PLACES. An earlier draft of this fell through to every
        // location in the world so that it could stamp `baseName` on all of
        // them, which writes a key onto seven hundred settlements and provinces
        // that have nothing to do with this module. A repair pass should touch
        // what is broken and nothing else.
        const decorated = NAME_WRAPPERS.some(
            w => location.name.startsWith(w.prefix) && location.name.endsWith(w.suffix)
        );
        if (!decorated) continue;

        // One layer is correct and is left alone. More than one is the defect.
        const root = undecorate(location.name);
        const wanted = decorateOnce(root, NAME_WRAPPERS[0]);
        const subjectStale = typeof location.data.daoSubject === 'string'
            && location.data.daoSubject !== wanted;
        if (wanted === location.name && typeof location.data.baseName === 'string' && !subjectStale) {
            continue;
        }

        const data: LocationRecord['data'] = { ...location.data, baseName: root };
        if (subjectStale) data.daoSubject = wanted;
        if (wanted !== location.name) repaired++;
        state.locations[i] = { ...location, name: wanted, data };
    }
    return repaired;
}

// ─────────────────────────────────────────────────────────────────────────
// THE PASS
// ─────────────────────────────────────────────────────────────────────────

export interface RuinFind {
    locationId: string;
    regionId: string;
    name: string;
    character: RuinCharacter;
    /** Where it came from. A floor rather than a taxonomy - see `RuinOriginSchema`. */
    origin: RuinOrigin;
    /** How big it is, which decides who can take it and whether anybody knows. */
    scale: RuinScale;
    /** How much of the arrangement still binds. Decay moves this and only this. */
    intent: IntentStanding;
    /** Which of the three ways this ground is closed. */
    admits: RuinAccess['admits'];
    floorOrdinal: number;
    ceilingOrdinal: number | null;
    depthBand: number;
    /** True where the entrant is not the person who gains. Cap or elder floor. */
    someoneElseBenefits: boolean;
    /**
     * Whether the world already held a record for this place.
     *
     * `already_here` is a seeded site the prior ages left and nobody had found:
     * the catalog's own ground, with its own contents and its own provenance,
     * and it is what the shallow bands consist of. `newly_described` is ground
     * the engine had no row for until somebody walked onto it.
     *
     * The distinction is the point of the two-stage model. The world does not
     * begin by knowing where its ruins are, and finding one that was already in
     * the ground is the ordinary case for as long as any are left unfound.
     */
    provenance: 'already_here' | 'newly_described';
}

export interface ProspectingResult {
    found: RuinFind[];
    /** Provinces that had anybody looking at all this year. */
    provincesWorked: number;
    /** Provinces whose reachable ground is exhausted. Rare, and it is real. */
    provincesWorkedOut: number;
}

/** The `data` key a minted find carries, so the world can tell one from a seeded ruin. */
export const FOUND_BY_PROSPECTING_TAG = 'found-by-prospecting';

/**
 * A year of the world looking for what the Late Age left.
 *
 * Called from `applyPressure` before the event draw, so a ruin found this year
 * is a ruin this year's `ruin_opened` can open - which is the ordering the
 * whole two-stage model depends on and the same ordering `applyManualCopying`
 * takes for the same reason.
 *
 * Mutates `state`. Deterministic from the world's seed and the year.
 */
export function applyRuinProspecting(
    state: WorldState,
    year: number,
    day: number
): ProspectingResult {
    const result: ProspectingResult = { found: [], provincesWorked: 0, provincesWorkedOut: 0 };
    // Worlds are persisted, so fixing the generator does not fix the rows it
    // already wrote. Idempotent and cheap, so an affected world heals on its
    // next tick rather than needing anybody to migrate it by hand.
    repairCompoundedNames(state);
    const rng = forStream(state.seed, 'ruins-found', year);
    // Bodies whose ground the world has already turned up. Read off the
    // locations rather than kept, so a reload cannot lose it and two finds can
    // never be the same person's cave.
    const claimedOccupants = new Set<string>();
    for (const l of state.locations) {
        if (typeof l.data.occupantId === 'string') claimedOccupants.add(l.data.occupantId);
    }

    for (let i = 0; i < state.locations.length; i++) {
        const region = state.locations[i];
        if (region.kind !== 'region' || !isBelowTheLid(region)) continue;

        const prospect = prospectFor(state, region);
        if (prospect.parties > 0) result.provincesWorked++;
        if (prospect.workingBand === null) {
            // Nothing left in reach. Not the same as nobody looking, and the
            // two are counted separately because they look identical in a
            // single figure and mean opposite things.
            if (prospect.parties > 0) result.provincesWorkedOut++;
            continue;
        }
        if (!rng.chance(prospect.oddsThisYear)) continue;

        const band = prospect.workingBand;
        const findRng = forStream(state.seed, 'ruin-find', region.id, String(year));

        // ── WHAT THE WORLD'S OWN DEAD LEFT ───────────────────────────────
        //
        // The near end of the stock, and the only end that refills. Somebody
        // died or crossed, the door they shut has thinned enough to be spotted,
        // and what is behind it is what they had - which is why this produces
        // mostly small, modern, unremarkable ground and only rarely anything
        // else. The distribution is not authored: the low realm buckets are
        // enormous, so most of what turns up was left by somebody nobody has
        // heard of.
        //
        // Taken FIRST because it is what is nearest the surface and freshest,
        // and because the deep past below is finite and should not be spent
        // while there is anything newer to find.
        const left = whatTheDeadLeftUnder(state, region.id, year)
            .filter(one => !claimedOccupants.has(one.occupantId));
        if (left.length > 0 && findRng.chance(0.6)) {
            const one = left[0];
            claimedOccupants.add(one.occupantId);
            const minted = mintGroundLeftByTheDead(region, one, day, year, findRng);
            state.locations.push(minted.location);
            state.locations[i] = {
                ...region,
                data: { ...region.data, [foundKeyForBand(band)]: prospect.foundInBand + 1 }
            };
            result.found.push(minted.find);
            continue;
        }

        // ── AN EMPTY SEAT ────────────────────────────────────────────────
        //
        // THE ARCHETYPE, and it stays first-class. A house held a mountain for
        // six centuries and then stopped existing, and what is up there is what
        // nobody had time or reason to carry out. Nobody left it for anybody:
        // there is no message, no addressee and no trial calibrated for a
        // worthy successor, so it is `never_addressed` and DECAY NEVER MOVES IT
        // ALONG THE INTENT AXIS - a place with no intent never had any to lose.
        //
        // Its own province remembers it. It is on old rolls, it had rivals and
        // the reason it fell is a fact people can be asked about, which is a
        // whole mode of play the sealed-cave end does not have: this is the
        // only kind you can research before you go. That comes free, because
        // `faction_fell` writes the fall into the history ledger as an ordinary
        // fact with an ordinary cause.
        const seat = findFallenSeatUnder(state, region.id);
        if (seat) {
            const ending = howTheHouseEnded(state, seat);
            const at = state.locations.indexOf(seat);
            state.locations[at] = {
                ...seat,
                discovered: true,
                discoveredOnDay: day,
                data: {
                    ...seat.data,
                    foundInYear: year,
                    ruinOrigin: 'abandoned_by_a_house',
                    ruinScale: 'a_mountain',
                    intentStanding: 'never_addressed',
                    ruinCharacter: 'compound',
                    // The four questions, answered off the world's own record
                    // of the fall rather than drawn. See `howTheHouseEnded`.
                    howItEnded: ending.ending,
                    strippedShare: ending.strippedShare,
                    theRecordsSurvive: ending.theRecordsSurvive,
                    whatAPartyFinds: ending.whatAPartyFinds
                }
            };

            // AND THE ONE DOOR NOBODY COULD OPEN. When the leadership was
            // killed, the vault is intact because the people who could reach it
            // are the reason there was a hurry - so it is a SEPARATE piece of
            // closed ground inside a picked-over mountain, running down on its
            // own schedule at the rung of the people who sealed it. The day it
            // finally fails is a much later find and a very good century for
            // whoever is standing there.
            if (ending.theVaultIsStillShut) {
                const vaultOrdinal = clampOrdinal(Math.max(seat.thresholds.mastery, 20));
                const vaultId = `${seat.id}-vault`;
                if (!state.locations.some(l => l.id === vaultId)) {
                    const vault = makeLocation({
                        id: vaultId,
                        // From the UNDERLYING PLACE, never from whatever the
                        // last pass wrote here. See `nameForInnerRoom`.
                        name: nameForInnerRoom(seat),
                        kind: 'ruin',
                        parentId: seat.id,
                        layer: seat.layer,
                        description:
                            'An inner room in a mountain that has otherwise been gone over by everybody, still shut, because the people who were authorised to open it and the people who knew how were the same people and they died on the same afternoon.',
                        ambient: seat.ambient,
                        qiDensity: clampQiDensity(seat.qiDensity + 15),
                        thresholds: makeThresholds(
                            Math.max(0, vaultOrdinal - 4), vaultOrdinal,
                            clampOrdinal(vaultOrdinal + 2), clampOrdinal(vaultOrdinal + 4)
                        ),
                        hazards: HAZARDS_BY_CHARACTER.vault.slice(),
                        environment: makeEnvironment({
                            spiritualDensity: 0.05,
                            danger: 0.8,
                            resources: ['manuals'],
                            climate: 'sunless',
                            politicalControl: 'whoever gets in'
                        }),
                        sealed: true,
                        // NOT found. The mountain is found; the vault is the
                        // thing the mountain has instead of a bottom, and it
                        // becomes findable when its own formation thins.
                        discovered: false,
                        // NOT `ruined`. An inner room is not a fallen seat, and
                        // tagging it as one put it straight back into the pool
                        // `findFallenSeatUnder` draws from - so the next pass
                        // treated this vault as a seat, minted a vault inside
                        // it, and wrapped the name again. That is the whole of
                        // the fourteen-layer defect and this line is the fix.
                        tags: ['ruin', INNER_ROOM_TAG, 'ruin-character:vault'],
                        data: {
                            ruinCharacter: 'vault',
                            ruinOrigin: 'abandoned_by_a_house',
                            ruinScale: 'a_building',
                            intentStanding: 'never_addressed',
                            setByOrdinal: vaultOrdinal,
                            depthBand: depthBandReachableBy(vaultOrdinal),
                            // The clean root, so no later pass has to recover
                            // one by unwrapping.
                            baseName: baseNameOf(seat)
                        }
                    });
                    vault.origin.fromDay = seat.origin.fromDay;
                    state.locations.push(vault);
                }
            }
            state.locations[i] = {
                ...region,
                data: { ...region.data, [foundKeyForBand(band)]: prospect.foundInBand + 1 }
            };
            result.found.push({
                locationId: seat.id,
                regionId: region.id,
                name: seat.name,
                character: 'compound',
                origin: 'abandoned_by_a_house',
                scale: 'a_mountain',
                intent: 'never_addressed',
                admits: 'anyone_who_survives_it',
                floorOrdinal: seat.thresholds.survival,
                ceilingOrdinal: null,
                depthBand: depthBandReachableBy(seat.thresholds.survival),
                someoneElseBenefits: false,
                provenance: 'already_here'
            });
            continue;
        }

        // ── THE GROUND THE WORLD ALREADY HELD, FIRST ─────────────────────
        //
        // The prior ages seeded sealed sites and nobody had found any of them:
        // `locationFromRuin` writes `discovered: ruin.opened`, so an unopened
        // seeded ruin is a place the engine knows about and the world does not.
        // Those are the shallow reserve and they get found before anything is
        // described that was not already in the catalog.
        //
        // This is also what the old `ruin_opened` was quietly doing wrong: it
        // opened undiscovered ground, which collapses finding and opening into
        // one event and is why the two rates were the same rate and ran out
        // together.
        const alreadyHere = findUndiscoveredUnder(state, region.id);
        if (alreadyHere) {
            const at = state.locations.indexOf(alreadyHere);
            state.locations[at] = {
                ...alreadyHere,
                discovered: true,
                discoveredOnDay: day,
                data: { ...alreadyHere.data, foundInYear: year }
            };
            state.locations[i] = {
                ...region,
                data: { ...region.data, [foundKeyForBand(band)]: prospect.foundInBand + 1 }
            };
            const character = characterOfSeededRuin(alreadyHere, findRng);
            result.found.push({
                locationId: alreadyHere.id,
                regionId: region.id,
                name: alreadyHere.name,
                character,
                // THE DEEP PAST, AND IT IS THE ONE THING THAT IS NOT RENEWABLE.
                // What the vanished eras left is a fixed quantity and every one
                // opened is gone from it forever, because producing another
                // requires having been an institution of that era and that era
                // is over. The refill above happens at the near end and what it
                // produces is modern - smaller, shallower, and made by people
                // the current ladder can account for. A world where prospecting
                // eventually turns up another peak-era inheritance has quietly
                // made the past infinite, and the past is the one thing that
                // is not.
                origin: 'abandoned_by_a_house',
                scale: 'a_compound',
                intent: 'never_addressed',
                admits: 'anyone_who_survives_it',
                floorOrdinal: alreadyHere.thresholds.survival,
                ceilingOrdinal: null,
                depthBand: depthBandReachableBy(alreadyHere.thresholds.survival),
                someoneElseBenefits: false,
                provenance: 'already_here'
            });
            continue;
        }

        const characters = CHARACTERS_BY_BAND[Math.min(band, CHARACTERS_BY_BAND.length - 1)];
        const character = characters[findRng.int(0, characters.length - 1)];
        const access = accessForFind(character, band, findRng);
        const name = nameForFind(region, character, findRng);
        const floor = access.floorOrdinal;

        const id = `loc-found-${region.id}-${band}-${prospect.foundInBand + 1}`;
        if (state.locations.some(l => l.id === id)) continue;

        const density = clampQiDensity(region.qiDensity + 10 + band * 8);
        const found = makeLocation({
            id,
            name,
            kind: 'ruin',
            parentId: region.id,
            layer: region.layer,
            description:
                `${name}. Nobody put this here recently: it has been under this province since the ` +
                `Late Age and what changed is that somebody found it.`,
            ambient: density >= 80 ? 'dense' : region.ambient,
            qiDensity: density,
            thresholds: makeThresholds(
                Math.max(0, floor - 4),
                floor,
                clampOrdinal(floor + 3),
                clampOrdinal(floor + 6)
            ),
            hazards: HAZARDS_BY_CHARACTER[character].slice(),
            affinities: [
                makeAffinity('formation', 1.2, 2, 'Whatever was laid here is still laid here.')
            ],
            environment: makeEnvironment({
                // Sealed, so what the pocket holds and what anybody can reach
                // are different numbers. That gap is the economy of going in
                // and it is the same one `locationFromRuin` describes.
                spiritualDensity: 0.05,
                danger: Math.min(1, 0.4 + band * 0.1),
                resources: ['qi', 'manuals'],
                climate: 'sunless',
                politicalControl: 'whoever gets in',
                specialRules: [],
                knownSecrets: [],
                historicalScars: []
            }),
            sealed: true,
            sealedOnDay: null,
            // Found. That is the whole of what this pass does: the ruin was
            // always here and is now on somebody's map.
            discovered: true,
            discoveredOnDay: day,
            tags: ['ruin', 'late_age', FOUND_BY_PROSPECTING_TAG, `ruin-character:${character}`],
            data: {
                ruinCharacter: character,
                admits: access.admits,
                floorOrdinal: floor,
                ceilingOrdinal: access.admits === 'nobody_above_the_line' ? access.ceilingOrdinal : null,
                depthBand: band,
                foundInYear: year
            }
        });
        found.origin.fromDay = day;
        state.locations.push(found);

        // The tally is on the province, because the province is what gets
        // worked out. One integer per band and nothing else: a second table
        // keyed by province would drift from the locations it is describing.
        state.locations[i] = {
            ...region,
            data: {
                ...region.data,
                [foundKeyForBand(band)]: prospect.foundInBand + 1
            }
        };

        result.found.push({
            locationId: id,
            regionId: region.id,
            name,
            character,
            admits: access.admits,
            floorOrdinal: floor,
            ceilingOrdinal: access.admits === 'nobody_above_the_line' ? access.ceilingOrdinal : null,
            depthBand: band,
            origin: ORIGIN_BY_CHARACTER[character],
            scale: SCALE_BY_BAND[Math.min(band, SCALE_BY_BAND.length - 1)],
            // The deep past never had an intent to lose. Only an arrangement
            // somebody made can lapse, and nobody arranged this.
            intent: 'never_addressed',
            someoneElseBenefits: access.admits !== 'anyone_who_survives_it',
            provenance: 'newly_described'
        });
    }

    return result;
}

/**
 * What sort of ending a character implies, where the world has no record of one.
 *
 * INTENT IS A SEPARATE AXIS FROM AGE and nothing here produces `left_addressed`:
 * an arrangement has to have been made by somebody the world knows about, and
 * the deep past's anonymous ground was not addressed to anybody. A place with
 * no intent never had any to lose, which is why decay cannot manufacture one
 * and cannot take one away.
 */
const ORIGIN_BY_CHARACTER: Readonly<Record<RuinCharacter, RuinOrigin>> = {
    compound: 'abandoned_by_a_house',
    teaching_hall: 'abandoned_by_a_house',
    archive: 'abandoned_by_a_house',
    ossuary: 'abandoned_by_a_house',
    vault: 'abandoned_by_a_house',
    workshop: 'overrun_at_work',
    waystation: 'overrun_at_work',
    physic_garden: 'overrun_at_work',
    cut: 'overrun_at_work',
    dwelling: 'a_door_nobody_opened_again',
    battlefield: 'fought_over_and_left',
    array_anchor: 'fought_over_and_left',
    scar: 'what_the_catastrophe_made',
    open_ground: 'what_the_catastrophe_made'
};

/** Deeper ground is bigger ground, because depth is what a big builder buys. */
const SCALE_BY_BAND: readonly RuinScale[] = [
    'one_room', 'a_building', 'a_building', 'a_compound', 'a_compound', 'a_mountain'
];

/**
 * A sealed site under this province that the world has not found yet.
 *
 * The seeded stock. `locationFromRuin` leaves an unopened ruin `discovered:
 * false`, which is the engine holding a record for a place nobody has walked
 * onto - and until this pass existed there was no code path that changed that
 * except opening it, which is a different event.
 */
// ═════════════════════════════════════════════════════════════════════════
// WHAT HAPPENED, WHO DIED, WHO LEFT, AND WHAT COULD THEY CARRY
//
// The generative question, and it is not "what tier of ruin is this". A ruin is
// a specific unfinished story and its state is the exact shape of how it ended.
// Answer those four and the contents, the intactness, the sealed rooms and the
// survival of the records all fall out - and they fall out DIFFERENTLY each
// time, which is what stops these from reading as one place with a reskin.
//
// Four endings, and each produces a materially different place that is legible
// to somebody standing in it:
//
//   THE LEADERSHIP DIED. Nobody left alive knew how to open the vault and
//   nobody left alive was authorised to. So the vault is INTACT and the rest of
//   the mountain is stripped: the valuable part survives precisely because the
//   people who could reach it are the people who died. That is a far better
//   reason for a sealed inner sanctum than a locked room in a dungeon, and it
//   gives the decay clock something non-uniform to act on - the vault runs down
//   on its own schedule, set by the rung of the people who sealed it, and the
//   day its formation finally fails is the day the only intact thing in a
//   picked-over mountain becomes reachable. That is a good century for
//   somebody.
//
//   THEY EVACUATED. What remains is what nobody could carry: heavy things,
//   fixed things, buried things, and everything that needed a person of a rank
//   that had already died to move. An evacuation is a filter and the filter is
//   portability crossed with who was still alive.
//
//   IT STOPPED RECEIVING INSTRUCTIONS. A branch when the seat was destroyed
//   elsewhere. It was never the prize and may be nearly whole; it simply ran
//   down. NOTHING DRAMATIC HAPPENED HERE, which is its own atmosphere, and it
//   is the case where the records survive, because nobody thought to destroy
//   them.
//
//   IT DISSOLVED. The seat is big and central and everybody knows where it is,
//   and it emptied because people stopped coming rather than because anything
//   was done to it. Nothing is broken.
//
// All four are buildable from the simulation rather than authored, because the
// world already destroys houses, kills named figures and fights wars. Two ruins
// made this way differ because the wars that made them differed, and the answer
// to "why is the vault still sealed" is a real event with a date on it that
// somebody can go and research.
// ═════════════════════════════════════════════════════════════════════════

export type HowAHouseEnded =
    | 'leadership_killed'
    | 'evacuated'
    | 'stopped_receiving_instructions'
    | 'dissolved';

export interface WhatTheEndingLeaves {
    ending: HowAHouseEnded;
    /** True where nobody left alive could open the inner room. */
    theVaultIsStillShut: boolean;
    /** True where the house's own paper is still on the shelves. */
    theRecordsSurvive: boolean;
    /** How much of the ordinary contents went out of the door, 0..1. */
    strippedShare: number;
    /** The one sentence a party standing in it would use. */
    whatAPartyFinds: string;
}

/**
 * How a house ended, read off its own fall rather than drawn.
 *
 * `faction_fell` and the killing templates already write what happened into the
 * ledger with a cause and a date, so this is a reading of the world's own
 * record. Nothing here invents an event.
 */
export function howTheHouseEnded(
    state: WorldState,
    seat: LocationRecord
): WhatTheEndingLeaves {
    const factionId = seat.controllingFactionId ?? String(seat.data.formerFactionId ?? '');
    const faction = factionId ? state.factions.find(f => f.id === factionId) ?? null : null;

    // Was anybody at the top of this house killed rather than simply dying?
    const leadershipKilled = state.npcs.some(
        n => n.status !== 'alive' && n.factionId === factionId
            && n.factionRankIndex <= 1
            && (n.endNote ?? '').toLowerCase().includes('kill')
    );
    // A seat is the house's own; anything else under the house is a branch.
    const isTheSeat = faction?.seatLocationId === seat.id;

    const ending: HowAHouseEnded = leadershipKilled ? 'leadership_killed'
        : !isTheSeat ? 'stopped_receiving_instructions'
            : seat.changes.some(c => c.kind === 'conquered' || c.kind === 'destroyed') ? 'evacuated'
                : 'dissolved';

    switch (ending) {
        case 'leadership_killed':
            return {
                ending,
                theVaultIsStillShut: true,
                theRecordsSurvive: false,
                strippedShare: 0.85,
                whatAPartyFinds: 'A mountain that has been gone over by everybody who could get up it, and one door in the middle of it that none of them could open, because the people who knew how are the reason there was a hurry.'
            };
        case 'evacuated':
            return {
                ending,
                theVaultIsStillShut: false,
                theRecordsSurvive: false,
                strippedShare: 0.6,
                whatAPartyFinds: 'What nobody could carry. Heavy things, fixed things, buried things, and everything that needed somebody of a rank that had already died to move it, which is a filter nobody applied on purpose.'
            };
        case 'stopped_receiving_instructions':
            return {
                ending,
                theVaultIsStillShut: true,
                theRecordsSurvive: true,
                strippedShare: 0.2,
                whatAPartyFinds: 'A place where nothing happened. It was never the prize, it simply stopped being told anything and ran down, and the records are all still on the shelves because it never occurred to anybody that they were worth destroying.'
            };
        default:
            return {
                ending,
                theVaultIsStillShut: false,
                theRecordsSurvive: true,
                strippedShare: 0.45,
                whatAPartyFinds: 'Nothing broken anywhere. It is a headquarters, so it is big and central and everybody knows where it is, and it emptied because people stopped coming rather than because anything was done to it.'
            };
    }
}

/**
 * A house's seat that the world's own simulation emptied, and nobody has been
 * back to.
 *
 * `faction_fell` leaves the compound standing with its formations unlit and
 * tags it `ruined`, which is the archetype arriving from the ordinary business
 * of houses falling rather than from any catalog. It is the only kind of closed
 * ground with a PUBLIC HISTORY: the fall is a fact in the ledger with a cause,
 * so a party can research this one before they go, which nothing at the sealed
 * cave end offers.
 */
function findFallenSeatUnder(state: WorldState, regionId: string): LocationRecord | null {
    for (const location of state.locations) {
        if (!location.tags.includes('ruined')) continue;
        if (location.discovered) continue;
        if (location.tags.includes('emptied')) continue;
        // A room inside a seat is not a seat. Without this the pass mints an
        // inner room, finds it again next year as though it were a fallen
        // house, and mints a room inside THAT - which is how one location
        // ended up with fourteen layers of name on it. Checked here as well as
        // at the tag, because a world already in flight is carrying rooms that
        // were tagged `ruined` before the tag was corrected.
        if (location.tags.includes(INNER_ROOM_TAG)) continue;
        if (location.id.endsWith('-vault')) continue;
        if (regionIdOf(state, location.parentId ?? location.id) !== regionId) continue;
        return location;
    }
    return null;
}

/**
 * Turn one dead cultivator's closed door into a place on the map.
 *
 * Everything about it comes off the person: the rung decides the scale, the
 * floor, the hazards and how long the formation lasts, and whether they
 * arranged it decides whether there is an intent in there to fail. There is no
 * difficulty number assigned anywhere, and the calibration the design doc
 * describes is automatic - a builder aims at a successor like themselves, so
 * the ground is hard at the rung it was left by and easy for anybody well above
 * it.
 */
function mintGroundLeftByTheDead(
    region: LocationRecord,
    one: ClosedGroundLeftByTheDead,
    day: number,
    year: number,
    rng: CultivationRNG
): { location: LocationRecord; find: RuinFind } {
    const floor = clampOrdinal(one.ordinal);
    const band = depthBandReachableBy(floor);
    const character: RuinCharacter = one.scale === 'one_room' ? 'dwelling'
        : one.scale === 'a_building' ? (rng.chance(0.5) ? 'dwelling' : 'archive')
            : one.scale === 'a_compound' ? 'compound' : 'vault';

    // An arrangement that still binds sorts applicants, which is a talent-shaped
    // problem. One that has lapsed cannot refuse anybody, so what is left is the
    // ground itself and the ordinary minimum.
    const access: RuinAccess = one.intent === 'addressed'
        ? {
            admits: 'nobody_above_the_line',
            floorOrdinal: Math.max(0, floor - 6),
            ceilingOrdinal: clampOrdinal(floor + 2),
            whatReadsThePerson: `The arrangement ${one.occupantName} left running, which was built to select a successor and is therefore an instrument for measuring somebody about the size they were.`,
            whyItRefusesPower: 'It was calibrated rather than made lethal, and a calibration has a top as well as a bottom. Somebody far above what it was aimed at does not read as a better candidate; they read as off the end of the scale, and the arrangement does not hand anything to a reading it cannot make.',
            soWhoGoesInstead: 'Whoever in the party is nearest the size the builder had in mind, which is a thing a house works out by sending people and losing them until the pattern is obvious.'
        }
        : {
            admits: 'anyone_who_survives_it',
            floorOrdinal: floor,
            whatIsDownThere: `What ${one.occupantName} had when they stopped, where they left it, behind a door that has been thinning ever since and is not thinning any faster because anybody is standing at it.`,
            whatItDoesToSomebodyShortOfIt: 'The formation is still running at whatever is left of the setting it was left at, and it does not know that the person it was protecting is not there. Below the rung it was set at, that is enough.'
        };

    const name = one.scale === 'one_room'
        ? `The Door ${one.occupantName} Did Not Open Again`
        : one.scale === 'a_building'
            ? `What ${one.occupantName} Left Behind the Second Door`
            : `${one.occupantName}'s Seat, With Nobody In It`;

    const location = makeLocation({
        id: `loc-closed-${one.occupantId}`,
        name,
        kind: 'ruin',
        parentId: region.id,
        layer: region.layer,
        description: one.arranged
            ? `${name}. Somebody who could see the end coming put what they had in order and shut the door on it.`
            : `${name}. A door that was shut from the inside and never opened again, with everything still where it was.`,
        ambient: region.ambient,
        qiDensity: clampQiDensity(region.qiDensity + 6 + band * 6),
        thresholds: makeThresholds(
            Math.max(0, floor - 4), floor, clampOrdinal(floor + 2), clampOrdinal(floor + 4)
        ),
        hazards: HAZARDS_BY_CHARACTER[character].slice(),
        environment: makeEnvironment({
            spiritualDensity: 0.05,
            danger: Math.min(1, 0.3 + band * 0.1),
            resources: ['qi', 'manuals'],
            climate: 'sunless',
            politicalControl: 'whoever gets in'
        }),
        sealed: true,
        discovered: true,
        discoveredOnDay: day,
        tags: [
            'ruin', FOUND_BY_PROSPECTING_TAG, `ruin-character:${character}`,
            one.crossed ? 'left-on-the-way-out' : 'left-at-the-end'
        ],
        data: {
            ruinCharacter: character,
            ruinOrigin: one.origin,
            ruinScale: one.scale,
            intentStanding: one.intent,
            // Whose it was. The contents are that person's inventory rather
            // than a table roll, so two centuries later somebody can still find
            // out whose it was - and `isSomebodyStillAliveInThere` reads this.
            occupantId: one.occupantId,
            occupantName: one.occupantName,
            setByOrdinal: one.ordinal,
            wardIntegrity: one.wardIntegrity,
            admits: access.admits,
            floorOrdinal: access.floorOrdinal,
            ceilingOrdinal: access.admits === 'nobody_above_the_line' ? access.ceilingOrdinal : null,
            depthBand: band,
            foundInYear: year
        }
    });
    location.origin.fromDay = day;

    return {
        location,
        find: {
            locationId: location.id,
            regionId: region.id,
            name,
            character,
            origin: one.origin,
            scale: one.scale,
            intent: one.intent,
            admits: access.admits,
            floorOrdinal: access.floorOrdinal,
            ceilingOrdinal: access.admits === 'nobody_above_the_line' ? access.ceilingOrdinal : null,
            depthBand: band,
            someoneElseBenefits: access.admits !== 'anyone_who_survives_it',
            provenance: 'newly_described'
        }
    };
}

function findUndiscoveredUnder(state: WorldState, regionId: string): LocationRecord | null {
    let parentless: LocationRecord | null = null;
    for (const location of state.locations) {
        if (location.kind !== 'ruin' || location.discovered) continue;
        if (location.tags.includes('emptied')) continue;
        // The prior ages hang their ruins off nothing: `locationFromRuin` sets
        // no `parentId`, so a seeded site is in the world and in no province.
        // Measured, that made the whole seeded stock unreachable by this pass -
        // a thousand-year run found a hundred and sixteen sites and not one of
        // them was ground the catalog already held. A party from anywhere may
        // claim one, which is both the honest reading (parties travel, and a
        // site nobody can place is exactly the sort somebody stumbles onto) and
        // the only one that does not require re-parenting the seeding pass.
        if (location.parentId === null) {
            if (parentless === null) parentless = location;
            continue;
        }
        if (regionIdOf(state, location.parentId) !== regionId) continue;
        return location;
    }
    return parentless;
}

/**
 * What sort of place a seeded ruin turns out to be.
 *
 * A ruin the prior ages left carries hazards and thresholds and no statement of
 * what it WAS, so the character is read back off the hazards where they say
 * something and drawn otherwise. Read rather than stored, so this never
 * disagrees with the record it is describing.
 */
export function characterOfSeededRuin(
    location: LocationRecord,
    rng: CultivationRNG
): RuinCharacter {
    if (location.kind === 'grave') return 'ossuary';
    if (location.hazards.includes('lightning')) return 'scar';
    if (location.hazards.includes('guardian') && location.hazards.includes('sealed_qi')) return 'vault';
    if (location.hazards.includes('guardian')) return 'compound';
    if (location.hazards.includes('corrosive')) return 'workshop';
    const band = depthBandReachableBy(location.thresholds.survival);
    const characters = CHARACTERS_BY_BAND[Math.min(band, CHARACTERS_BY_BAND.length - 1)];
    return characters[rng.int(0, characters.length - 1)];
}

/**
 * Everything the world currently knows about and has not emptied.
 *
 * The standing reserve, which is the number that was going to zero and the one
 * worth reporting beside the opening rate. A reserve is not a stock: it is what
 * has been found out of the stock, and it is the difference between two rates.
 */
export function standingReserve(state: WorldState): LocationRecord[] {
    return state.locations.filter(
        l => l.kind === 'ruin' && l.sealed && l.discovered && !l.tags.includes('emptied')
    );
}

/** What this province has found, across every band. Used for the worked-out reading. */
export function foundUnder(region: LocationRecord): number {
    let total = 0;
    for (let band = 0; band <= DEEPEST_BAND; band++) {
        total += Number(region.data[foundKeyForBand(band)] ?? 0);
    }
    return total;
}

/** And what is left in it, across every band. Finite, and stated. */
export function stillInGroundUnder(region: LocationRecord): number {
    let total = 0;
    for (let band = 0; band <= DEEPEST_BAND; band++) {
        total += Math.max(0, ruinsInGroundUnder(region, band)
            - Number(region.data[foundKeyForBand(band)] ?? 0));
    }
    return total;
}
