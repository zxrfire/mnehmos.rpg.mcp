/** A damaged tribulation body can enter elemental ground, but its stay has an end. */
import type { Injury } from '../../schema/cultivation.js';
import { hasTribulationBody, imperfectBody } from '../cultivation/tribulation-defence.js';
import type { LocationRecord } from './locations.js';

export function elementalTolerance(ordinal: number, injuries: readonly Injury[], place: LocationRecord): number | null {
    if (!hasTribulationBody(ordinal) || !place.hazards.some(h => /^(?:fire|heat|cold|ice|lightning|water|sea|earth)$/.test(h))) return null;
    if (!imperfectBody(injuries)) return Infinity;
    // A day's endurance per rung held, divided by the ground's survival intensity.
    return Math.max(1, Math.floor(ordinal / Math.max(1, place.thresholds.survival)));
}
