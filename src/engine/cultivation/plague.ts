/** Plague alone is illness. Susceptibility is exactly the body's existing need for food. */
import type { Injury, PlagueState, Pill } from '../../schema/cultivation.js';
import type { CultivationRNG } from './rng.js';
import { satietyBurnMultiplier, stillNeedsToEat } from './survival.js';
import { medicineReaches } from './what-grade-of-medicine-a-wound-needs.js';

export interface ABodyExposedToPlague {
    realmOrdinal: number;
    injuries: readonly Injury[];
    plague?: PlagueState | null;
}

/** A month-long course gives time to meet a healer; its danger arrives halfway through. */
export const PLAGUE_COURSE_DAYS = 30;
export const PLAGUE_DANGER_DAYS = PLAGUE_COURSE_DAYS / 2;
/** Monthly close exposure at the mortal scale; the hunger multiplier alone scales susceptibility. */
export const PLAGUE_EXPOSURE_RATE = 0.4;
/** One sampled outcome per infection, prevented by treatment before the danger date. */
export const PLAGUE_FATAL_RATE = 0.08;
/** Active plague limits available health, so ordinary mending cannot erase its weakness. */
export const PLAGUE_HEALTH_FRACTION = 0.65;

export function plagueSusceptibility(body: ABodyExposedToPlague): number {
    return stillNeedsToEat(body.realmOrdinal, body.injuries)
        ? satietyBurnMultiplier(body.realmOrdinal, body.injuries) : 0;
}

export function activePlague(body: ABodyExposedToPlague, day: number): PlagueState | null {
    const plague = body.plague;
    return plague && plagueSusceptibility(body) > 0 && plague.contractedOnDay <= day
        && plague.endsOnDay > day && (plague.treatedOnDay === null || plague.treatedOnDay > day) ? plague : null;
}

export function contractPlague(body: ABodyExposedToPlague, outbreakId: string, day: number,
    outbreakEnds: number, rng: CultivationRNG, courseRng = rng): PlagueState | null {
    if (activePlague(body, day) || outbreakEnds <= day || !rng.chance(PLAGUE_EXPOSURE_RATE * plagueSusceptibility(body))) return null;
    return plagueCourse(outbreakId, day, outbreakEnds, courseRng);
}

/** Background infection was already selected by its susceptibility rate; do not roll it a second time. */
export function plagueCourse(outbreakId: string, day: number, outbreakEnds: number, rng: CultivationRNG): PlagueState {
    const endsOnDay = Math.min(outbreakEnds, day + PLAGUE_COURSE_DAYS);
    const danger = day + PLAGUE_DANGER_DAYS;
    return { outbreakId, contractedOnDay: day, endsOnDay,
        fatalOnDay: danger < endsOnDay && rng.chance(PLAGUE_FATAL_RATE) ? danger : null, treatedOnDay: null };
}

export function plagueHealthCeiling(maxHp: number, body: ABodyExposedToPlague, day: number): number {
    return activePlague(body, day) ? Math.max(1, Math.floor(maxHp * PLAGUE_HEALTH_FRACTION)) : maxHp;
}

export function plagueHasBecomeFatal(body: ABodyExposedToPlague, day: number): boolean {
    const plague = body.plague;
    return !!plague && plagueSusceptibility(body) > 0 && plague.fatalOnDay !== null && plague.fatalOnDay <= day
        && (plague.treatedOnDay === null || plague.treatedOnDay > plague.fatalOnDay);
}

/** An actual wound-medicine dose treats this illness through the same bodily medicine reach. */
export function treatPlague(body: ABodyExposedToPlague, pill: Pill, day: number): PlagueState | null {
    if (pill.effect !== 'treat_injury' || pill.potency < 1) return null;
    return treatPlagueWithMedicineGrade(body, pill.grade, day);
}

/** A paid physician's existing care supplies mortal medicine, rather than a pill from a pouch. */
export function treatPlagueWithMedicineGrade(body: ABodyExposedToPlague, grade: Pill['grade'], day: number): PlagueState | null {
    const plague = activePlague(body, day);
    if (!plague || plagueHasBecomeFatal(body, day) || !medicineReaches(grade, 'minor', body.realmOrdinal)) return null;
    return { ...plague, treatedOnDay: day, fatalOnDay: null };
}
