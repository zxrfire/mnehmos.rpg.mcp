import { realiseAcceptedPublicShipHull, publicShipHullCanBeBoarded, shipHandsForHull } from './a-public-ship-hull.js';
import { companyDuringPassage, companyAfterPassage } from './company-during-a-passage.js';
/** The public hull's existing crew factory and finite passage binding. */
import { lifespanForOrdinal } from '../cultivation/realms.js';
import { forStream } from '../cultivation/rng.js';
import type { SeaLane } from './what-a-sea-crossing-costs.js';
import { shipIdForLane } from './the-ship-on-a-lane.js';
import { createNpc, setLocation, setRealm, type NpcRecord } from './npc-state.js';
import { years } from './opportunities.js';
import type { WorldState } from './world-state.js';
import { activityOfAPublicPassage, publicShipLinesFrom, recordPublicPassage, type PublicPassageLeg } from './public-shipping.js';
import { journeyTimeHasReached } from './places-on-the-way.js';
type CrewWorld = Pick<WorldState, 'seed' | 'npcs'>;

/** Who works a ship, by the ship's id. */
const CREW_OF = 'crew-of:';

const THE_SHIPMASTER = 'shipmaster';
const A_HAND = 'sailor';


/**
 * The living crew of the ship on a lane, a shipmaster and two or three hands, taken on at `at` (a
 * row id) for every place nobody living holds. Empty where there is no world.
 */
export function ensureShipCrew(world: CrewWorld, lane: SeaLane, at: string, onDay: number): NpcRecord[] {
    const ship = shipIdForLane(lane);
    const tag = `${CREW_OF}${ship}`;
    const hands = shipHandsForHull(world.seed,ship);
    const aboard = () => world.npcs.filter(npc => npc.status === 'alive' && npc.tags.includes(tag));
    const wanted = [
        ...(aboard().some(npc => npc.identity.occupation === THE_SHIPMASTER) ? [] : [THE_SHIPMASTER]),
        ...Array.from({ length: Math.max(0, hands - aboard().filter(npc => npc.identity.occupation === A_HAND).length) },
            () => A_HAND)
    ];
    const taken = new Set(world.npcs.map(npc => npc.name));
    wanted.forEach((role, k) => {
        const id = `npc-crew-${ship}-${role}-${onDay}-${k}`;
        if (world.npcs.some(npc => npc.id === id)) return;
        const draw = forStream(world.seed, 'the-crew-of-a-ship', id);
        const ordinal = role === THE_SHIPMASTER ? draw.int(0, 4) : draw.int(0, 2);
        const span = lifespanForOrdinal(ordinal);
        const age = role === THE_SHIPMASTER
            ? Math.round(Math.min(span * 0.8, 35 + draw.int(0, 25)))
            : Math.round(Math.min(span * 0.6, 17 + draw.int(0, 25)));
        let npc = createNpc(world.seed, {
            id,
            bornOnDay: onDay - years(age),
            onDay,
            locationId: at,
            occupation: role,
            takenNames: taken,
            tags: [tag]
        });
        taken.add(npc.name);
        npc = { ...setRealm(npc, ordinal, onDay), factionId: null, factionRankIndex: -1 };
        world.npcs.push(npc);
    });
    return aboard().sort((a, b) =>
        Number(b.identity.occupation === THE_SHIPMASTER) - Number(a.identity.occupation === THE_SHIPMASTER)
        || (a.id < b.id ? -1 : 1));
}

/** The current activity is the hull's real bounded leg, with no fleet position copy. */
export function bindShipCrewToPassage(world: CrewWorld, leg: PublicPassageLeg, onDay = leg.departureDay, priorDepartureDay = leg.departureDay): void {
    const tag = `${CREW_OF}${leg.vesselId}`;
    const crew = world.npcs.filter(npc => npc.status === 'alive' && npc.tags.includes(tag));
    // Only an actual matched prior course carries a changing local slot onward.
    const priorArea = (npc: NpcRecord): string | null => npc.activity?.kind === 'travelling'
        && npc.activity.vesselId === leg.vesselId
        && npc.activity.untilDay != null && !journeyTimeHasReached(onDay, npc.activity.untilDay)
        && journeyTimeHasReached(onDay, npc.activity.sinceDay)
        && journeyTimeHasReached(npc.activity.sinceDay, priorDepartureDay)
        && journeyTimeHasReached(priorDepartureDay, npc.activity.sinceDay)
        ? npc.activity.standingIn ?? null : null;
    const ids = crew.map(npc => npc.id);
    const passengers = world.npcs.filter(npc => npc.status === 'alive' && !ids.includes(npc.id)
        && npc.activity?.kind === 'travelling' && npc.activity.vesselId === leg.vesselId
        && npc.activity.seaLaneId === leg.lane.id
        && journeyTimeHasReached(npc.activity.sinceDay, priorDepartureDay)
        && journeyTimeHasReached(priorDepartureDay, npc.activity.sinceDay));
    for (const one of crew) {
        const at = world.npcs.indexOf(one);
        world.npcs[at] = { ...one, activity: companyDuringPassage(one.activity, { ...one.activity, ...activityOfAPublicPassage(leg,
            one.identity.occupation === THE_SHIPMASTER ? 'Keeping the ship.' : 'Working the ship.',
            ids.filter(id => id !== one.id)), standingIn: priorArea(one) }, onDay), updatedOnDay: onDay };
    }
    // A rerouted hull carries the already booked people, without changing why
    // they went or who accompanied them. Another departure remains its own trip.
    for (const one of passengers) {
        const at = world.npcs.indexOf(one);
        world.npcs[at] = { ...one, activity: companyDuringPassage(one.activity, { ...one.activity, ...activityOfAPublicPassage(leg,
            one.activity!.note, one.activity!.withIds), standingIn: priorArea(one) }, onDay), updatedOnDay: onDay };
    }
}

/** Existing port/water placement, followed by the actual finite leg when under way. */
export function placeShipCrew(world: CrewWorld, lane: SeaLane, at: string, onDay: number,
    passage?: PublicPassageLeg): NpcRecord[] {
    const crew = ensureShipCrew(world, lane, at, onDay);
    const ids = crew.map(npc => npc.id);
    for (const one of crew) {
        const index = world.npcs.indexOf(one);
        world.npcs[index] = { ...setLocation(one, at, onDay), activity: companyAfterPassage(one, onDay) ?? {
            kind: 'the_work_of_their_rank',
            note: one.identity.occupation === THE_SHIPMASTER ? 'Keeping the ship.' : 'Working the ship.',
            withIds: ids.filter(id => id !== one.id), sinceDay: onDay, untilDay: null
        } };
    }
    if (passage) bindShipCrewToPassage(world, passage, onDay);
    return world.npcs.filter(npc => ids.includes(npc.id));
}

/** Commit only a stored, accepted personal booking, after the caller chose its route. */
export function commitNpcPublicPassage(world: WorldState, accepted: NpcRecord): boolean {
    const doing = accepted.activity;
    if (accepted.status !== 'alive' || doing?.kind !== 'travelling' || !doing.seaLaneId
        || !doing.vesselId || !doing.fromLocationId || !doing.returnTo || doing.untilDay == null
        || doing.untilDay <= doing.sinceDay || !world.npcs.some(npc => npc.id === accepted.id
            && npc.activity === doing)) return false;
    const from = world.locations.find(place => place.id === doing.fromLocationId);
    const to = world.locations.find(place => place.id === doing.returnTo);
    if (!from || !to) return false;
    const lane = publicShipLinesFrom(world, from.name, doing.sinceDay)
        .find(line => line.to === to.name && line.lane.id === doing.seaLaneId)?.lane;
    if (!lane || shipIdForLane(lane) !== doing.vesselId) return false;
    const leg: PublicPassageLeg = { lane, vesselId: doing.vesselId, fromId: from.id, toId: to.id,
        departureDay: doing.sinceDay, arrivalDay: doing.untilDay };
    if (!publicShipHullCanBeBoarded(world,leg)) return false;
    ensureShipCrew(world, lane, from.id, doing.sinceDay);
    bindShipCrewToPassage(world, leg);
    const operator=world.npcs.find(npc=>npc.status==='alive' && npc.tags.includes('crew-of:'+leg.vesselId)
        && npc.identity.occupation==='shipmaster');
    if (!operator || !realiseAcceptedPublicShipHull(world,leg,operator)) throw new Error('Accepted public ship custody changed synchronously.');
    recordPublicPassage(world, leg, doing.sinceDay, from.id, [accepted.id],undefined,undefined,
        [{id:accepted.id,name:accepted.name}]);
    return true;
}
