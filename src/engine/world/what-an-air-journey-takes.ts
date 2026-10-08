/** An air leg prices metric separation through the existing speed and fuel authority. */
import type { LocationRecord } from './locations.js';
import { distanceThroughTheAir, LI_PER_WALKING_DAY, type MetricCourseContext } from './the-metric-ground-under-a-journey.js';
import { priceJourney, type Conveyance, type JourneyCost } from './what-a-conveyance-does-to-a-journey.js';
import { grantsHeldWith } from './capability.js';
import { getTechnique } from '../../data/cultivation/techniques.js';
import { requireConveyance } from '../../data/cultivation/what-a-house-moves-its-people-on.js';

export function canFlyByTheirOwnBody(ordinal: number, brokenStatusKeys: readonly string[] = []): boolean {
    return grantsHeldWith(ordinal, brokenStatusKeys).includes('body_flight');
}

export function quoteAnAirJourney(locations: readonly LocationRecord[], fromId: string, toId: string,
    conveyance: Conveyance, power: number | null = null, heads = 1, courseContext?: MetricCourseContext, pilotHeads = 0): (JourneyCost & { distanceLi: number }) | null {
    if (!conveyance.crossesGroundThatCannotBeWalked) return null;
    const distanceLi = distanceThroughTheAir(locations, fromId, toId, courseContext);
    if (distanceLi === null) return null;
    const quote = priceJourney({ walkingDays: distanceLi / LI_PER_WALKING_DAY,
        conveyance, power, heads, pilotHeads, preciseDays: true, crossesGroundThatCannotBeWalked: true });
    return quote ? { ...quote, distanceLi } : null;
}

/** The native art grade enters the single conveyance-speed authority; no cloud speed table. */
export function conveyanceOfPersonalFlight(artId: string | null): Conveyance | null {
    if (artId === null) return requireConveyance('conv-body-flight');
    const art = getTechnique(artId);
    return art?.category === 'movement' ? { ...requireConveyance('conv-sword-flight'),
        name: art.name, grade: art.grade } : null;
}
