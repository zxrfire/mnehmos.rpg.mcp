/** A lane's port names can include its quay; the catalog holds the town. */
import { REGIONS } from '../../data/cultivation/regions.js';

export function theLandfall(named: string): string | null {
    const wanted = named.trim().toLowerCase();
    let best: string | null = null;
    for (const region of REGIONS) {
        for (const place of region.places) {
            const name = place.name.toLowerCase();
            if (name === wanted) return place.name;
            if (wanted.includes(name) && (best === null || name.length > best.length)) best = place.name;
        }
    }
    return best;
}
