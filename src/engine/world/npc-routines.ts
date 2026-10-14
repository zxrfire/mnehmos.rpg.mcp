/** Daily activity, read from the hour rather than stepped through the calendar. */
import { forStream } from '../cultivation/rng.js';
import { ordinaryProfessionOf } from './the-work-an-ordinary-mortal-does.js';
import { FOUNDATION_ORDINAL } from '../cultivation/realms.js';
import { isAwayOnSomething, type NpcActivity, type NpcRecord } from './npc-state.js';
import type { RouteQueries } from './locations.js';
import { indexById, type WorldState } from './world-state.js';
import { locationOnNpcJourney, npcIsTravellingOnDay, ROUTE_STOP } from './places-on-the-way.js';
import { vesselRoomChosen } from './rooms-in-a-vessel.js';
import { whoHoldsThisPlace } from './somewhere-that-is-theirs.js';
import { onTheirHallShift } from './a-hall-workers-shift.js';

type Clock = Pick<WorldState, 'seed' | 'currentDay' | 'currentHour'> & Partial<Pick<WorldState, 'locations' | 'npcs'>>;

/**
 * A stream sample is a pure function of seed, stream and parts, so it is cached by those and not by
 * the clock object. Keyed on the clock it missed whenever a caller built a fresh clock, which the
 * departure readers do for every look ahead; that was half of a simulated year.
 */
const samples = new Map<string, number>();

/** Cache only stream samples; an activity or a position is always read afresh. */
function sample(state: Clock, stream: string, ...parts: (string | number)[]): number {
    // A separator no id contains; `JSON.stringify` here was most of a routine read.
    const key = `${state.seed}\u0001${stream}\u0001${parts.join('\u0001')}`;
    let value = samples.get(key);
    if (value === undefined) {
        value = forStream(state.seed, stream, ...parts).next();
        if (samples.size >= 400_000) samples.clear();
        samples.set(key, value);
    }
    return value;
}

/** Read the actual place and its ancestors, without scanning the population. */
function rogueGround(state: Clock, personId: string, locationId: string | null, routes?: RouteQueries) {
    const places = state.locations;
    let home = false, town = false, road = false, resources = false, outdoors = false;
    const visited = new Set<string>();
    for (let id = locationId; id && places && !visited.has(id);) {
        visited.add(id);
        const place = routes?.places.get(id) ?? places[indexById(places, id)];
        if (!place) break;
        if (id === locationId) resources = place.environment.resources.length > 0;
        home ||= whoHoldsThisPlace(place) === personId;
        town ||= place.kind === 'settlement';
        road ||= place.tags.includes(ROUTE_STOP);
        outdoors ||= ['wilds', 'cave', 'ruin', 'grave', 'scar', 'forbidden_zone', 'secret_realm'].includes(place.kind);
        id = place.parentId;
    }
    return { home, town, road, resources, outdoors };
}

/** Patrol only actual open, keyless links on the house's ground, at their travel cost. */
function hallPatrolStop(state: Clock, npc: NpcRecord, now: number, routes?: RouteQueries): string | null {
    const places = state.locations;
    if (!places || !npc.locationId || !npc.factionId) return null;
    const get = (id: string) => routes?.places.get(id) ?? places[indexById(places, id)];
    const post = get(npc.locationId);
    if (!post) return null;
    const links = post.links.flatMap(link => {
        const target = get(link.toLocationId);
        const back = target?.links.find(reverse => reverse.toLocationId === post.id && reverse.open
            && !reverse.requiresKeyId && reverse.travelDays > 0);
        return link.open && !link.requiresKeyId && link.travelDays > 0 && target && back && !target.sealed
            && (target.data.factionId === npc.factionId || target.controllingFactionId === npc.factionId)
            ? [{ link, backDays: back.travelDays }] : [];
    });
    if (!links.length) return null;
    const start = Math.floor(now) + ((now % 1) * 24 < 6 ? -1 : 0) + 18 / 24;
    const route = links[Math.min(links.length - 1, Math.floor(sample(state, 'hall-patrol-path', npc.id, start) * links.length))]!;
    const period = route.link.travelDays + route.backDays;
    const phase = ((now - start) % period + period) % period;
    return phase < route.link.travelDays ? post.id : route.link.toLocationId;
}

/** Fractional hours are shown as clock minutes, not decimal minutes. */
export function hourOnTheClock(hour: number): string {
    const minutes = Math.round(hour * 60) % (24 * 60);
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** The same timestamp is used for invitation expiry and routine reads. */
export function routineTime(state: Pick<Clock, 'currentDay' | 'currentHour'>): number {
    return state.currentDay % 1 !== 0 ? state.currentDay
        : state.currentDay + (state.currentHour ?? 8) / 24;
}

/** The next night ends an ordinary invitation, including one made after nightfall. */
export function invitationEndsAt(state: Pick<Clock, 'currentDay' | 'currentHour'>): number {
    return Math.floor(state.currentDay) + 21 / 24 + ((state.currentHour ?? 8) >= 21 ? 1 : 0);
}

/** Placement asks for the same physical position without drawing an unused daily activity. */
export function routineLocationOf(state: Clock, npc: NpcRecord, routes?: RouteQueries): string | null {
    const now = routineTime(state), redirect = npc.activity?.redirect;
    if (redirect && (now < redirect.until || redirect.returnDays === null
        || now < redirect.until + (redirect.returnDays ?? 0))) return npc.locationId;
    return redirect ? npc.activity?.returnTo ?? npc.locationId
        : state.locations ? locationOnNpcJourney(state.locations, npc, now, routes, undefined,
            id => state.npcs?.find(person => person.id === id)) : npc.locationId;
}

/** A person's ordinary activity remains the source of their work and trade. */
export function routineOf(state: Clock, npc: NpcRecord, routes?: RouteQueries,
    actualHullArea?: (npc: NpcRecord) => string | null): {
    activity: NpcActivity | null; home: boolean; standingIn: string | null; locationId: string | null;
} {
    const now = routineTime(state);
    if (npc.status === 'alive' && (npc.activity?.partyQuestionId || npc.activity?.partyFightId)) return { activity: {
        ...npc.activity, note: npc.activity.partyFightId ? 'Facing an attack on the party.' : npc.activity.redirect?.previous
            ? 'Resting with the party until dawn.' : 'Discussing the party\'s route.' }, home: false,
        standingIn: npc.activity.standingIn ?? null, locationId: npc.locationId };
    const redirect = npc.activity?.redirect;
    if (redirect && now < redirect.until) {
        return { activity: npc.activity, home: false, standingIn: redirect.standingIn ?? null, locationId: npc.locationId };
    }
    const ordinary = redirect ? redirect.previous : npc.activity;
    const journeyActivity = ordinary && state.locations && npcIsTravellingOnDay(state.locations, npc, now, routes)
        ? { ...ordinary, kind: 'travelling' as const } : ordinary;
    if (redirect && (redirect.returnDays === null || now < redirect.until + (redirect.returnDays ?? 0))) {
        return { activity: { kind: 'travelling', note: 'walking home', withIds: [],
            sinceDay: redirect.until, untilDay: redirect.returnDays === null ? null : redirect.until + (redirect.returnDays ?? 0),
            returnTo: npc.activity?.returnTo }, home: false, standingIn: null, locationId: npc.locationId };
    }
    const locationId = routineLocationOf(state, npc, routes);
    const result = (activity: NpcActivity | null, home = false) => ({ activity, home,
        standingIn: !redirect ? actualHullArea?.(npc) ?? (activity === journeyActivity
            && !vesselRoomChosen(ordinary?.standingIn) ? ordinary?.standingIn : null) ?? null : null, locationId });
    const offHallShift = ordinary?.kind === 'stationed' && (!!ordinary.houseWorkSchedule || !!ordinary.houseWorkFactId)
        && !ordinary.houseCareFactId && !onTheirHallShift(ordinary, now);
    if (!redirect && ordinary?.houseWorkSchedule?.patrol && !offHallShift
        && journeyActivity?.kind !== 'travelling') {
        const stop = hallPatrolStop(state, npc, now, routes);
        if (stop) return { ...result({ ...ordinary, note: 'Patrolling the compound grounds.' }), standingIn: stop };
    }
    // An errand, a posting and a timed activity keep their own calendar.
    if (!redirect && ordinary && (!offHallShift || journeyActivity?.kind === 'travelling') && (isAwayOnSomething(ordinary.kind)
        || (ordinary.untilDay != null && ordinary.untilDay >= Math.floor(state.currentDay)))) return result(journeyActivity);
    if (npc.tags.includes('spirit-beast') || npc.tags.some(tag => tag.startsWith('present-as:'))) return result(ordinary);
    const hour = state.currentHour ?? 8;
    const day = Math.floor(state.currentDay);
    const profession = npc.factionId ? null : ordinaryProfessionOf(npc);
    const rogue = !npc.factionId && !profession;
    const ground = rogue ? rogueGround(state, npc.id, locationId, routes) : null;
    const habit = sample(state, 'daily-habit', npc.id);
    const shift = sample(state, 'daily-shift', npc.id, day);
    const night = hour < 6 || hour >= 21;
    const doing = (kind: NpcActivity['kind'], note: string, home = ground?.home ?? false) => result({
        kind, note, withIds: [], sinceDay: day, untilDay: null
    }, home);
    if (night) {
        if (rogue && habit < 0.08) return doing('their_practice', 'Cultivating.');
        if (habit < 0.08) return doing('the_work_of_their_rank', npc.factionId ? 'keeping watch' : 'working');
        if (habit < 0.14) return doing('at_a_table', rogue ? 'Eating.' : 'eating at a table');
        return doing('idle', 'sleeping', true);
    }
    if (!offHallShift && ordinary && ordinary.withIds.length > 0) return result(ordinary);
    if (sample(state, 'daily-errand', npc.id, day, Math.floor(hour / 3)) < 0.22) {
        if (ground?.home) return doing('idle', 'Walking through the residence.');
        if (ground && !ground.town) return doing(ground.outdoors && !ground.road ? 'searching' : 'idle',
            ground.road ? 'Stopped on the road.' : ground.outdoors ? 'Searching this ground.' : 'Waiting here.');
        return doing('idle', npc.factionId ? 'walking across the grounds' : 'walking through the town');
    }
    const meal = 11 + sample(state, 'house-mealtimes', npc.factionId ?? locationId ?? npc.id);
    if ((hour >= meal + shift && hour < meal + 3 + shift) || (hour >= 18 && hour < 20)) {
        return doing('at_a_table', rogue ? 'Eating.' : 'eating at a table');
    }
    if (npc.factionId && hour >= 6 && hour < 10 && npc.factionRankIndex <= 1) {
        return doing('their_practice', 'training');
    }
    if (hour >= 16 && hour < 18 && npc.cultivation.realmOrdinal >= FOUNDATION_ORDINAL) {
        return doing('their_practice', 'practising an art');
    }
    if (offHallShift) return doing('their_practice', 'Cultivating.');
    if (ordinary && ordinary.kind !== 'idle' && ordinary.kind !== 'at_a_table'
        && !(ground && ordinary.kind === 'trade' && (!ground.town || ground.home))) return result(ordinary, ground?.home ?? false);
    if (npc.factionId) return doing('the_work_of_their_rank', 'doing the work of their rank');
    if (profession) return doing('the_work_of_their_rank', `Working as ${profession.name}.`);
    const choice = sample(state, 'rogue-day', npc.id, day, Math.floor(hour / 3));
    if (ground!.home) return ground!.resources && choice < 1 / 3
        ? doing('drawing_on_the_ground', 'Tending this ground.')
        : doing('their_practice', 'Cultivating in the residence.');
    if (ground!.town) return choice < 1 / 2 ? doing('trade', 'trading')
        : doing('searching', 'Reading notices for work.');
    if (ground!.road) return doing('idle', 'Stopped on the road.');
    if (!locationId || !ground!.outdoors) return doing('their_practice', 'Cultivating.');
    if (ground!.resources && choice < 1 / 3) return doing('gathering', 'Gathering from this ground.');
    return choice < 2 / 3 ? doing('hunting', 'Hunting for game.') : doing('searching', 'Searching this ground.');
}
