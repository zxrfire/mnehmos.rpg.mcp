/** The existing hull identity, shared by its crew and ordinary passengers. */
import type { SeaLane } from './what-a-sea-crossing-costs.js';

function slug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** The ship that works a lane, the same whichever end it is boarded from. */
export function shipIdForLane(lane: SeaLane): string {
    return [slug(lane.fromPlace), slug(lane.toPlace)].sort().join('--');
}
