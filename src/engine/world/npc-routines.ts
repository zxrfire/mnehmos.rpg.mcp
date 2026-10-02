/** Daily activity, read from the hour rather than stepped through the calendar. */
import { forStream } from '../cultivation/rng.js';
import { FOUNDATION_ORDINAL } from '../cultivation/realms.js';
import { isAwayOnSomething, type NpcActivity, type NpcRecord } from './npc-state.js';
import type { WorldState } from './world-state.js';

type Clock = Pick<WorldState, 'seed' | 'currentDay' | 'currentHour'>;

const samples = new WeakMap<Clock, { seed: string; day: number; stable: Map<string, number>; daily: Map<string, number> }>();

/** Cache only stream samples; an activity or a position is always read afresh. */
function sample(state: Clock, stream: string, ...parts: (string | number)[]): number {
    const day = Math.floor(state.currentDay);
    let read = samples.get(state);
    if (!read || read.seed !== state.seed) {
        read = { seed: state.seed, day, stable: new Map(), daily: new Map() };
        samples.set(state, read);
    } else if (read.day !== day) {
        read.day = day;
        read.daily.clear();
    }
    const cache = stream === 'daily-habit' || stream === 'house-mealtimes' ? read.stable : read.daily;
    const key = JSON.stringify([stream, ...parts]);
    let value = cache.get(key);
    if (value === undefined) {
        value = forStream(state.seed, stream, ...parts).next();
        cache.set(key, value);
    }
    return value;
}

/** Fractional hours are shown as clock minutes, not decimal minutes. */
export function hourOnTheClock(hour: number): string {
    const minutes = Math.round(hour * 60) % (24 * 60);
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** The same timestamp is used for invitation expiry and routine reads. */
export function routineTime(state: Pick<Clock, 'currentDay' | 'currentHour'>): number {
    return Math.floor(state.currentDay) + (state.currentHour ?? 8) / 24;
}

/** The next night ends an ordinary invitation, including one made after nightfall. */
export function invitationEndsAt(state: Pick<Clock, 'currentDay' | 'currentHour'>): number {
    return Math.floor(state.currentDay) + 21 / 24 + ((state.currentHour ?? 8) >= 21 ? 1 : 0);
}

/** A person's ordinary activity remains the source of their work and trade. */
export function routineOf(state: Clock, npc: NpcRecord): {
    activity: NpcActivity | null; home: boolean; standingIn: string | null; locationId: string | null;
} {
    const now = routineTime(state);
    const redirect = npc.activity?.redirect;
    if (redirect && now < redirect.until) {
        return { activity: npc.activity, home: false, standingIn: redirect.standingIn ?? null, locationId: npc.locationId };
    }
    const ordinary = redirect ? redirect.previous : npc.activity;
    if (redirect && (redirect.returnDays === null || now < redirect.until + (redirect.returnDays ?? 0))) {
        return { activity: { kind: 'travelling', note: 'walking home', withIds: [],
            sinceDay: redirect.until, untilDay: redirect.returnDays === null ? null : redirect.until + (redirect.returnDays ?? 0),
            returnTo: npc.activity?.returnTo }, home: false, standingIn: null, locationId: npc.locationId };
    }
    const locationId = redirect ? npc.activity?.returnTo ?? npc.locationId : npc.locationId;
    const result = (activity: NpcActivity | null, home = false) => ({ activity, home, standingIn: null, locationId });
    // An errand, a posting and a timed seclusion already have their own calendar.
    if (!redirect && ordinary && (isAwayOnSomething(ordinary.kind)
        || (ordinary.untilDay != null && ordinary.untilDay >= Math.floor(state.currentDay)))) return result(ordinary);
    if (npc.tags.includes('spirit-beast') || npc.tags.some(tag => tag.startsWith('present-as:'))) return result(ordinary);
    const hour = state.currentHour ?? 8;
    const day = Math.floor(state.currentDay);
    const habit = sample(state, 'daily-habit', npc.id);
    const shift = sample(state, 'daily-shift', npc.id, day);
    const night = hour < 6 || hour >= 21;
    const doing = (kind: NpcActivity['kind'], note: string, home = false) => result({
        kind, note, withIds: [], sinceDay: day, untilDay: null
    }, home);
    if (night) {
        if (habit < 0.08) return doing('the_work_of_their_rank', npc.factionId ? 'keeping watch' : 'working');
        if (habit < 0.14) return doing('at_a_table', 'eating at a table');
        return doing('idle', 'sleeping', true);
    }
    if (ordinary && ordinary.withIds.length > 0) return result(ordinary);
    if (sample(state, 'daily-errand', npc.id, day, Math.floor(hour / 3)) < 0.22) {
        return doing('idle', npc.factionId ? 'walking across the grounds' : 'walking through the town');
    }
    const meal = 11 + sample(state, 'house-mealtimes', npc.factionId ?? locationId ?? npc.id);
    if ((hour >= meal + shift && hour < meal + 3 + shift) || (hour >= 18 && hour < 20)) {
        return doing('at_a_table', 'eating at a table');
    }
    if (npc.factionId && hour >= 6 && hour < 10 && npc.factionRankIndex <= 1) {
        return doing('their_practice', 'training');
    }
    if (hour >= 16 && hour < 18 && npc.cultivation.realmOrdinal >= FOUNDATION_ORDINAL) {
        return doing('their_practice', 'practising an art');
    }
    if (ordinary && ordinary.kind !== 'idle' && ordinary.kind !== 'at_a_table') return result(ordinary);
    if (npc.factionId) return doing('the_work_of_their_rank', 'doing the work of their rank');
    return doing('trade', 'trading');
}
