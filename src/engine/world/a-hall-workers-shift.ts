/** A recurring appointment is read at the clock, never advanced one day at a time. */
import type { NpcActivity } from './npc-state.js';

export function onTheirHallShift(activity: Pick<NpcActivity, 'houseWorkSchedule' | 'houseWorkFactId'>, day: number): boolean {
    const schedule = activity.houseWorkSchedule ?? (activity.houseWorkFactId
        ? { periodDays: 1, offset: 0, shift: 'day' as const, rota: false } : null);
    if (!schedule) return true;
    const period = Math.max(1, Math.floor(schedule.periodDays));
    const phase = ((Math.floor(day) - schedule.offset) % period + period) % period;
    if (phase !== 0) return false;
    const hour = (day - Math.floor(day)) * 24;
    if (schedule.hours) return schedule.hours.from < schedule.hours.until
        ? hour >= schedule.hours.from && hour < schedule.hours.until
        : hour >= schedule.hours.from || hour < schedule.hours.until;
    return schedule.shift === 'night' ? hour >= 18 || hour < 6 : hour >= 6 && hour < 18;
}
