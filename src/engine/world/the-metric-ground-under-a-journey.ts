import { stoppedRoadPoint } from './where-a-carriage-stopped.js';
/**
 * Physical ground positions, independent of roads and of an observer's knowledge.
 * Generated exterior sites sample their parent's extent once; interiors and
 * one road midpoint derive without retaining another position.
 */
import type { MetricPoint } from '../../data/cultivation/regions/region-schema.js';
import { forStream } from '../cultivation/rng.js';
import type { CatalogRegion, CatalogFaction } from './catalog.js';
import { placeScopeFor, type LocationRecord, type PlaceScope } from './locations.js';
import type { HistoricalFact } from './history.js';
import { acceptedAirCourse, interpolateAirCoursePoint } from './position-on-an-accepted-air-course.js';

export interface MetricCourseContext {
    facts: ReadonlyMap<string, HistoricalFact>;
    onDay: number;
    places?: PlaceScope;
}

/** Authored physical unit: one walking-day of distance is eighty li. */
export const LI_PER_WALKING_DAY = 80;
/** Authored extent of generated ground around a non-provincial exterior site. */
export const LOCAL_GROUND_EXTENT_LI = 3;
const INTERIORS = new Set(['precinct', 'hall', 'chamber', 'vault']);

function recordedPoint(place: LocationRecord): MetricPoint | null {
    const { metricXLi, metricYLi } = place.data;
    return typeof metricXLi === 'number' && Number.isFinite(metricXLi)
        && typeof metricYLi === 'number' && Number.isFinite(metricYLi)
        ? { xLi: metricXLi, yLi: metricYLi } : null;
}

/** A transient read, shared for an observation; no persistent projection. */
export function metricGroundRead(locations: readonly LocationRecord[], courseContext?: MetricCourseContext,
    scope?: PlaceScope) {
    const byId = scope?.places ?? new Map(locations.map(place => [place.id, place]));
    const points = new Map<string, MetricPoint | null>();
    const visiting = new Set<string>();
    function point(id: string): MetricPoint | null {
        if (points.has(id)) return points.get(id)!;
        const place = byId.get(id);
        if (!place || visiting.has(id)) return null;
        visiting.add(id);
        let answer: MetricPoint | null = null;
        if (place.tags.includes('air-course')) {
            const fact = courseContext && typeof place.data.airCourseId === 'string'
                ? courseContext.facts.get(place.data.airCourseId) : null;
            const course = fact && typeof place.data.bodyId === 'string'
                ? acceptedAirCourse(fact, place.data.bodyId) : null;
            const stopId = place.data.airStoppedFactId;
            const stopped = courseContext && typeof stopId === 'string' ? courseContext.facts.get(stopId) : null;
            const a = course && point(course.fromId), b = course && point(course.toId);
            if (course && a && b && courseContext && (typeof stopId !== 'string' || stopped))
                answer = interpolateAirCoursePoint(course, a, b, courseContext.onDay, stopped)?.point ?? null;
        } else if (typeof place.data.stoppedRoadPoint === 'string') {
            const held = stoppedRoadPoint([place], place.id);
            const from = held?.kind === 'edge' ? byId.get(held.fromId) : null;
            const to = held?.kind === 'edge' ? byId.get(held.toId) : null;
            const a = from?.layer === place.layer ? point(from.id) : null;
            const b = to?.layer === place.layer ? point(to.id) : null;
            if (held?.kind === 'edge' && a && b) answer = {
                xLi: a.xLi + (b.xLi - a.xLi) * held.fraction,
                yLi: a.yLi + (b.yLi - a.yLi) * held.fraction
            };
        } else if (place.tags.includes('route-stop')) {
            const from = byId.get(String(place.data.fromLocationId ?? ''));
            const to = byId.get(String(place.data.toLocationId ?? ''));
            const a = from?.layer === place.layer ? point(from.id) : null;
            const b = to?.layer === place.layer ? point(to.id) : null;
            if (a && b) answer = { xLi: (a.xLi + b.xLi) / 2, yLi: (a.yLi + b.yLi) / 2 };
        } else if (INTERIORS.has(place.kind) || place.data.comprehensionKey !== undefined) {
            const parent = byId.get(place.parentId ?? '');
            if (parent?.layer === place.layer) answer = point(parent.id);
        } else answer = recordedPoint(place);
        visiting.delete(id);
        points.set(id, answer);
        return answer;
    }
    return { point, byId };
}

/** Unknown geometry and a different layer cannot become an air leg. */
export function distanceThroughTheAir(locations: readonly LocationRecord[], fromId: string, toId: string,
    courseContext?: MetricCourseContext): number | null {
    const read = metricGroundRead(locations, courseContext, courseContext?.places ?? placeScopeFor(locations));
    const from = read.byId.get(fromId), to = read.byId.get(toId);
    if (!from || !to || from.layer !== to.layer) return null;
    const a = read.point(fromId), b = read.point(toId);
    return a && b ? Math.hypot(b.xLi - a.xLi, b.yLi - a.yLi) : null;
}

function writePoint(place: LocationRecord, point: MetricPoint, extentLi: number): void {
    place.data.metricXLi = point.xLi;
    place.data.metricYLi = point.yLi;
    place.data.metricExtentLi = extentLi;
}

/** Fresh opening or saved-world upgrade. An assigned exterior site never moves.
 * Match catalog identity and current/historical names; never interpret an id's
 * hash as a distance. Unknown roots remain unavailable rather than invented. */
export function initializeMetricGround(locations: LocationRecord[], worldSeed: string,
    regions: readonly CatalogRegion[] = [],
    factions: readonly Pick<CatalogFaction, 'id' | 'seatPlaceName'>[] = []): number {
    let written = 0;
    const byRegion = new Map(regions.map(region => [region.id, region]));
    for (const place of locations) {
        if (recordedPoint(place) || INTERIORS.has(place.kind) || place.tags.includes('route-stop')) continue;
        const region = byRegion.get(String(place.data.catalogRegionId ?? ''));
        if (!region?.metric) continue;
        const authored = place.kind === 'region' ? region.metric
            : region.places.find(row => row.name === place.name || row.name === place.origin.name)?.metric;
        if (authored) {
            writePoint(place, authored, place.kind === 'region' ? region.metric.extentLi : LOCAL_GROUND_EXTENT_LI);
            written++;
        }
    }
    const byId = new Map(locations.map(place => [place.id, place]));
    const seats = new Map(factions.map(faction => [faction.id, faction.seatPlaceName]));
    function physicalParent(place: LocationRecord): LocationRecord | undefined {
        // The existing gate relation and the actual catalog seat locate a compound;
        // a road price is never an input to this placement.
        const gate = typeof place.data.gateId === 'string' ? byId.get(place.data.gateId) : undefined;
        if (gate?.layer === place.layer) return gate;
        if (place.tags.includes('sect_ground')) {
            const name = seats.get(String(place.data.factionId ?? ''));
            const seat = name ? locations.find(candidate => candidate.layer === place.layer
                && candidate.data.catalogRegionId === place.data.catalogRegionId
                && (candidate.name === name || candidate.origin.name === name)) : undefined;
            if (seat) return seat;
        }
        return byId.get(place.parentId ?? '');
    }
    const visiting = new Set<string>();
    function assign(place: LocationRecord): MetricPoint | null {
        // Moving/stopped air sites derive their point from the actual course facts.
        if (place.tags.includes('air-course')) return null;
        const existing = recordedPoint(place);
        if (existing) return existing;
        if (visiting.has(place.id)) return null;
        if (place.tags.includes('route-stop')) return metricGroundRead(locations).point(place.id);
        if (INTERIORS.has(place.kind) || place.data.comprehensionKey !== undefined) {
            const parent = byId.get(place.parentId ?? '');
            return parent?.layer === place.layer ? assign(parent) : null;
        }
        if (place.kind === 'region') return null;
        const parent = physicalParent(place);
        if (!parent || parent.layer !== place.layer) return null;
        visiting.add(place.id);
        const centre = assign(parent);
        if (centre) {
            const extent = typeof parent.data.metricExtentLi === 'number'
                ? parent.data.metricExtentLi : LOCAL_GROUND_EXTENT_LI;
            if (Number.isFinite(extent) && extent > 0) {
                const rng = forStream(worldSeed, 'physical-ground-position', place.id);
                const angle = rng.float(0, Math.PI * 2), radius = Math.sqrt(rng.float(0, 1)) * extent;
                writePoint(place, { xLi: centre.xLi + Math.cos(angle) * radius,
                    yLi: centre.yLi + Math.sin(angle) * radius }, LOCAL_GROUND_EXTENT_LI);
                written++;
            }
        }
        visiting.delete(place.id);
        return recordedPoint(place);
    }
    for (const place of locations) assign(place);
    return written;
}
