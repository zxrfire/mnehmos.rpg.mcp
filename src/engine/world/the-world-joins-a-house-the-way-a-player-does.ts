/**
 * The world's own people join a house the way a player does.
 *
 * The design owner: *"Yes, unless they were already seeded. NPCs join the same
 * way you do."* So the world's intake - `applyRecruitment`, and the houses local
 * children arrive into - takes somebody on only where `theRoadOntoARoll` finds a
 * road: somebody of the house out looking for disciples where they stand, the
 * house's grounds open for a selection, or the intake its notice named held
 * where they are. Whoever that is took them on, and owes the house the report.
 *
 * ── A YEAR AND A PROVINCE, BECAUSE THAT IS THE WORLD'S GRAIN ────────────
 *
 * A player's turn is a day in a place. The world's intake pass runs once a year
 * and its people stand still between passes, so "there" is read at that grain:
 *
 *   in person    somebody of the house out looking for disciples standing on the
 *                same ground as them now
 *   selection    the house opened its grounds this year (`theSelectionIn`) and
 *                they live in its province, near enough to walk to it
 *   intake       the house's paper named an intake at the place they live, held
 *                some day this year (`intakesHeldHereBetween`)
 *
 * Nobody seeded on a roll at world open is touched: they were entered before
 * anybody was watching.
 *
 * ── WHAT IS NOT A JOIN ───────────────────────────────────────────────────
 *
 *   a member's child      where the parent's house keeps its own children -
 *                         `whyTheirOwnHouseWillNotKeepThem` is null, which is the
 *                         catalog's favour stance for the house - the parent is
 *                         the word, and the child comes onto the parent's roll
 *                         with the parent as the one who took them on
 *   a fostered child      placed on a word with somebody of a house; that person
 *                         took them in and is who took them on
 *   a fostered child      taken back by the house that sent them out: the house
 *     taken back          sent for them, and expects them
 *   one of its own        `a-house-takes-in-one-of-its-own.ts` makes a row of an
 *     coming forward      outer disciple the house always had, at its grounds;
 *                         they were never outside, so nobody took them on
 */

import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { whoTookThemOn } from './a-house-expects-somebody-it-took-on.js';
import { intakesHeldHereBetween } from './houses-that-have-to-advertise-for-disciples.js';
import { openDoorsInTheWorld, postingGroundOf, provinceOfPlace } from './the-doors-and-walls-a-house-takes-people-at.js';
import type { NpcRecord } from './npc-state.js';
import {
    A_SELECTION_RUNS_FOR_DAYS,
    theRoadOntoARoll,
    theSelectionIn,
    type TheRoadOntoARoll
} from './when-a-house-takes-people-on.js';
import { getLocation, type FactionRecord, type WorldState } from './world-state.js';

/**
 * What one year's intake reads about roads, gathered once for the year: who of
 * each house stands where, which houses open their grounds this year, and which
 * intakes are held at each place.
 */
export interface TheYearsRoads {
    roadFor(house: Pick<FactionRecord, 'id' | 'seatLocationId'>, person: Pick<NpcRecord, 'id' | 'locationId'>): TheRoadOntoARoll | null;
}

export function theRoadsOntoARollThisYear(state: WorldState, year: number): TheYearsRoads {
    const fromDay = year * DAYS_PER_YEAR;
    const toDay = fromDay + DAYS_PER_YEAR - 1;

    const byPlace = new Map<string, NpcRecord[]>();
    for (const n of state.npcs) {
        if (n.status !== 'alive' || n.factionId === null || n.locationId === null) continue;
        const key = `${n.factionId}|${n.locationId}`;
        const here = byPlace.get(key);
        if (here) here.push(n); else byPlace.set(key, [n]);
    }

    const opensThisYear = new Map<string, boolean>();
    const opens = (houseId: string) => {
        let known = opensThisYear.get(houseId);
        if (known === undefined) {
            known = theSelectionIn(state.seed, houseId, year) !== null;
            opensThisYear.set(houseId, known);
        }
        return known;
    };

    const field = openDoorsInTheWorld();
    const intakesAt = new Map<string, Set<string>>();
    const intakesHere = (locationId: string): Set<string> => {
        let held = intakesAt.get(locationId);
        if (held === undefined) {
            const name = getLocation(state, locationId)?.name ?? '';
            const ground = postingGroundOf(name);
            held = ground === 'unplaceable'
                ? new Set()
                : intakesHeldHereBetween(
                    { field, placeName: name, ground, placeProvinceId: provinceOfPlace(name), seed: state.seed },
                    fromDay, toDay, A_SELECTION_RUNS_FOR_DAYS);
            intakesAt.set(locationId, held);
        }
        return held;
    };

    const provinceOf = (locationId: string | null): string | null => {
        let at = locationId;
        for (let hops = 0; hops < 12 && at !== null; hops++) {
            const location = getLocation(state, at);
            if (!location) return null;
            if (location.kind === 'region' || location.parentId === null) return location.id;
            at = location.parentId;
        }
        return null;
    };
    const insideTheSeat = (locationId: string | null, seatId: string | null): boolean => {
        if (seatId === null) return false;
        let at = locationId;
        for (let hops = 0; hops <= 3 && at !== null; hops++) {
            if (at === seatId) return true;
            at = getLocation(state, at)?.parentId ?? null;
        }
        return false;
    };

    return {
        roadFor(house, person) {
            const place = person.locationId;
            const seatProvince = provinceOf(house.seatLocationId);
            return theRoadOntoARoll({
                houseId: house.id,
                ofTheHouseHere: place === null ? [] : byPlace.get(`${house.id}|${place}`) ?? [],
                atItsGroundsForASelection: house.seatLocationId !== null && opens(house.id)
                    && seatProvince !== null && provinceOf(place) === seatProvince,
                atItsIntake: place !== null && intakesHere(place).has(house.id),
                whoRunsIt: () => whoTookThemOn(state.npcs, {
                    houseId: house.id,
                    personId: person.id,
                    placeId: place,
                    inReach: () => true,
                    atTheHouse: id => insideTheSeat(id, house.seatLocationId)
                })?.id ?? null
            });
        }
    };
}
