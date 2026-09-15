/**
 * The year's doors: who comes to hold one, and who is given a place at it.
 *
 * ── WHAT WAS ALREADY BUILT AND UNREACHED ─────────────────────────────────
 *
 * `shutAPublicRuin` is a finished mechanism - the party it takes, the province
 * that loses access, the severity, the accounts, the patch, the fact - and it
 * had no caller anywhere outside its own test. That is the whole of why 0 of 41
 * ruins were held on a seeded world at two hundred years: not a rule about
 * ruins, an unwired module. Nothing about it is rebuilt here. This pass decides
 * WHEN a house would do it and hands the result on.
 *
 * ── AND A DOOR ONLY MATTERS THE YEAR IT OPENS ────────────────────────────
 *
 * A counted door is one on a season, and a season is a window inside a wait of
 * sixty to six hundred years. So the conclave runs in the year the window falls
 * and in no other year, which is what makes a place at one scarce enough to be
 * worth being given - and it is read off the schedule the site already carries
 * rather than off a rate chosen here.
 */

import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import type { ObligationInput } from '../social/grudges.js';
import {
    shutAPublicRuin,
    type AHouseThatCouldShutIt,
    type ShuttingAPublicRuin
} from './a-house-that-shuts-a-public-ruin.js';
import {
    isGroundWithADoor,
    whatADoorAdmits,
    whatADoorSomebodyPaysAtTakesInAYear,
    type WhatADoorAdmits
} from './a-door-with-a-count-on-it.js';
import { ALLIED_STANDING } from './gatherings.js';
import { convergenceOf } from './convergence.js';
import { theProvinceAround } from './ground-holder.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import {
    TOO_HOSTILE_TO_BE_GIVEN_A_PLACE,
    dealThePlaces,
    type AHouseAsking,
    type TheDeal
} from './how-a-house-doles-out-the-places-it-holds.js';
import { isBelowTheLid } from './layers.js';
import type { HistoricalFact } from './history.js';
import { applyLocationChange, type LocationRecord } from './locations.js';
import type { NpcRecord } from './npc-state.js';
import {
    holdAConclaveForThePlaces,
    whatBeingPassedOverDoes,
    type WhatTheConclaveDecided
} from './who-goes-to-a-door-and-who-is-passed-over.js';
import { getLocation, indexById, type FactionRecord, type WorldState } from './world-state.js';

const YEAR = 365;

/**
 * How often anybody moves on one unheld door, per year.
 *
 * PER DOOR, not per house that could take it. Drawn per pair it is a rate that
 * scales with how crowded the province is, so the twenty houses of Low Fall
 * would shut every door in it inside a decade while a province with two houses
 * shut nothing - which measures the population rather than whether the ground
 * is worth holding.
 *
 * Shutting public ground turns every house in the province against you at a
 * severity the ground's own worth decides. Once in two centuries per door is a
 * thing that happens to ground in somebody's lifetime and not a land grab, and
 * it is the one dial in this file.
 */
export const HOW_OFTEN_A_HOUSE_MOVES_ON_A_DOOR = 1 / 200;

/** One door's year. */
export interface ADoorsYear {
    doorId: string;
    doorName: string;
    admits: WhatADoorAdmits;
    /** Set on the year a house took it. */
    shut: ShuttingAPublicRuin | null;
    /**
     * The row the ledger ended up holding for that, already appended.
     *
     * Handed back rather than left to the caller to append, because
     * `appendWorldFact` decides whether the ledger already says this and a
     * second append would fold two afternoons into one row - or worse, not.
     */
    storedFact: HistoricalFact | null;
    /** Set where the door opened this year and had a holder to deal its places. */
    deal: TheDeal | null;
    conclaves: readonly WhatTheConclaveDecided[];
    /** One line per person passed over. Empty is a motive that is not wired. */
    andTheyDid: readonly string[];
    /** Accounts the ledger should open. This module does not hold a ledger. */
    accounts: readonly ObligationInput[];
}

/** Whether this door's window falls anywhere inside the year starting here. */
export function opensInTheYearFrom(door: LocationRecord, dayStart: number): boolean {
    const now = convergenceOf(door, dayStart);
    if (!now.cyclical) return false;
    if (now.open) return true;
    return now.opensOnDay !== null && now.opensOnDay - dayStart < YEAR;
}

/**
 * Everybody on a house's roll this ground would admit.
 *
 * THE DOOR'S OWN BAND, not a tag and not a rung on the house's ladder.
 * `chosenOf` is one or two favourites, and a conclave over three places among
 * two people is not a conclave; who wants to go to a find is everybody the
 * ground will let in and let out again.
 *
 * Which is also what keeps the head of the house off the list without a rule
 * about heads of houses: a site closed above a line is closed above it, and
 * `ceilingOrdinal` is the column `whatTheDeadLeftUnder` already writes for
 * exactly the ground that refuses power.
 */
export function whoWouldStandForAPlace(
    state: WorldState,
    factionId: string,
    door: LocationRecord
): NpcRecord[] {
    const raw = door.data.ceilingOrdinal;
    const ceiling = raw === null || raw === undefined ? Infinity : Number(raw);
    return state.npcs
        .filter(n => n.status === 'alive' && isBelowTheLid(n) && n.factionId === factionId
            && n.cultivation.realmOrdinal >= door.thresholds.survival
            && n.cultivation.realmOrdinal <= ceiling)
        .sort((a, b) => b.cultivation.realmOrdinal - a.cultivation.realmOrdinal
            || (a.id < b.id ? -1 : 1));
}

/** Houses seated in the same province as this door, holder excluded. */
function housesAround(
    state: WorldState,
    door: LocationRecord,
    except: string | null
): FactionRecord[] {
    const province = theProvinceAround(state.locations, door.id);
    if (province === null) return [];
    return state.factions
        .filter(f => f.id !== except && f.dissolvedOnDay === null && isBelowTheLid(f)
            && theProvinceAround(state.locations, f.seatLocationId) === province)
        .sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** The house's roll as `shutAPublicRuin` needs it. */
function asAHouseThatCouldShutIt(state: WorldState, house: FactionRecord): AHouseThatCouldShutIt {
    return {
        id: house.id,
        name: house.name,
        seatLocationId: house.seatLocationId,
        roster: state.npcs
            .filter(n => n.status === 'alive' && isBelowTheLid(n) && n.factionId === house.id)
            .map(n => ({ id: n.id, name: n.name, ordinal: n.cultivation.realmOrdinal }))
    };
}

/**
 * A house takes a door, or does not.
 */
function whetherSomebodyTakesIt(
    state: WorldState,
    door: LocationRecord,
    day: number,
    rng: CultivationRNG
): ShuttingAPublicRuin | null {
    if (!rng.chance(HOW_OFTEN_A_HOUSE_MOVES_ON_A_DOOR)) return null;
    // Strongest first: a house that can hold it and is the heaviest thing in
    // the province is the one that would, and a lesser house that moved on it
    // first would simply be taken off it.
    const near = housesAround(state, door, null)
        .sort((a, b) => Number(b.resources.power_ordinal ?? 0) - Number(a.resources.power_ordinal ?? 0)
            || (a.id < b.id ? -1 : 1));
    for (const house of near) {
        const shut = shutAPublicRuin({
            ruin: door,
            house: asAHouseThatCouldShutIt(state, house),
            locations: state.locations,
            houses: state.factions,
            onDay: day
        });
        if (shut.shut) return shut;
    }
    return null;
}

/**
 * What a house puts on the table for a place, and hands over.
 *
 * ONE TOLL IN THIS WORLD. A door somebody pays at is a levy post, priced by
 * `whatADoorSomebodyPaysAtTakesInAYear` off the traffic behind it, and the
 * stones move: the holder is holding a door for money and a house buying its
 * way in is a house that has less money.
 *
 * WHO PAYS IS NOT A DRAW. A house the holder already thinks well of does not
 * need to buy what it is going to be given, and one past the line cannot buy
 * anything at any price. What is left - a house that is tolerated and no more -
 * is exactly the house for which a purse is the difference, and it pays if it
 * has the purse.
 */
function whatTheyPutOnTheTable(
    holder: FactionRecord,
    asker: FactionRecord,
    door: LocationRecord,
    standingFromTheHolder: number,
    standingTowardTheHolder: number
): number {
    if (standingFromTheHolder >= ALLIED_STANDING) return 0;
    if (standingFromTheHolder <= TOO_HOSTILE_TO_BE_GIVEN_A_PLACE) return 0;
    if (standingTowardTheHolder <= TOO_HOSTILE_TO_BE_GIVEN_A_PLACE) return 0;

    const price = whatADoorSomebodyPaysAtTakesInAYear(door);
    const purse = Number(asker.resources.spirit_stones ?? 0);
    if (price <= 0 || purse < price) return 0;

    asker.resources.spirit_stones = purse - price;
    holder.resources.spirit_stones = Number(holder.resources.spirit_stones ?? 0) + price;
    return price;
}

/**
 * What every door in the world does this year.
 *
 * ONE CALL, because the yearly pass belongs to another file and this is its
 * whole surface there.
 */
export function applyDoorsAndTheirPlaces(
    state: WorldState,
    year: number,
    day: number
): ADoorsYear[] {
    const out: ADoorsYear[] = [];

    for (const location of state.locations) {
        if (!isGroundWithADoor(location) || !isBelowTheLid(location)) continue;
        if (!location.discovered) continue;
        const admits = whatADoorAdmits({ ruin: location });
        const rng = forStream(state.seed, 'door-year', year, location.id);
        const row: ADoorsYear = {
            doorId: location.id,
            doorName: location.name,
            admits,
            shut: null,
            storedFact: null,
            deal: null,
            conclaves: [],
            andTheyDid: [],
            accounts: []
        };

        // ── SOMEBODY COMES TO HOLD IT ────────────────────────────────────
        let holderId = location.controllingFactionId;
        if (holderId === null) {
            const shut = whetherSomebodyTakesIt(state, location, day, rng);
            if (shut && shut.patch) {
                const stored = shut.fact ? appendWorldFact(state, shut.fact) : null;
                const at = indexById(state.locations, location.id);
                if (at >= 0) {
                    state.locations[at] = applyLocationChange(state.locations[at]!, {
                        onDay: day,
                        kind: 'forbidden',
                        summary: shut.reason,
                        patch: shut.patch,
                        causeFactId: stored?.id ?? null,
                        witnessed: true
                    }).location;
                }
                holderId = shut.patch.controllingFactionId ?? null;
                row.shut = shut;
                row.storedFact = stored;
                row.accounts = shut.accounts;
            }
        }

        // ── AND THE YEAR ITS SEASON FALLS, THE PLACES GO OUT ─────────────
        //
        // Re-read, because a door taken this year is in a different cell of the
        // table by the time the year ends, and a row reporting the cell it was
        // in this morning is reporting the wrong afternoon.
        const door = getLocation(state, location.id) ?? location;
        row.admits = whatADoorAdmits({ ruin: door });
        if (holderId === null || !opensInTheYearFrom(door, day)) {
            out.push(row);
            continue;
        }
        const holder = state.factions.find(f => f.id === holderId);
        // Uncounted ground has no places to deal however firmly it is held.
        // What the holder does with it is `whatADoorAdmits`'s answer and not a
        // second one taken here.
        if (!holder || row.admits.places === null) { out.push(row); continue; }
        const places = row.admits.places;

        const asking: AHouseAsking[] = housesAround(state, door, holder.id).map(h => {
            const standingFromTheHolder = holder.standing[h.id] ?? 0;
            const standingTowardTheHolder = h.standing[holder.id] ?? 0;
            return {
                id: h.id,
                name: h.name,
                standingFromTheHolder,
                standingTowardTheHolder,
                paid: whatTheyPutOnTheTable(
                    holder, h, door, standingFromTheHolder, standingTowardTheHolder)
            };
        });
        const deal = dealThePlaces({
            places,
            holderId: holder.id,
            holderName: holder.name,
            asking
        });
        row.deal = deal;

        const conclaves: WhatTheConclaveDecided[] = [];
        const did: string[] = [];
        for (const dealt of deal.dealt) {
            if (dealt.places <= 0) continue;
            const wanting = whoWouldStandForAPlace(state, dealt.houseId, door);
            const decided = holdAConclaveForThePlaces({
                state,
                factionId: dealt.houseId,
                forWhat: door.name,
                places: dealt.places,
                wanting,
                day,
                rng
            });
            if (!decided) continue;
            conclaves.push(decided);
            did.push(...whatBeingPassedOverDoes(state, decided, day));
        }
        row.conclaves = conclaves;
        row.andTheyDid = did;
        out.push(row);
    }

    return out;
}
