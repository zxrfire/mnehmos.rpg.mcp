/** Daylight in the area's existing sensory facts, bounded by what reaches the eye. */
import type { Cultivator } from '../schema/cultivation.js';
import type { GameService } from './game.js';
import { theAreaTheyAreIn } from './walking-across-a-place.js';

export function perceivedDaylight(game: GameService, cultivator: Cultivator): string | null {
    const world = game.atHand;
    const here = theAreaTheyAreIn(world, cultivator);
    if (!world || !here || world.currentHour === undefined) return null;
    let row = here.place;
    const visited = new Set<string>();
    while (!visited.has(row.id)) {
        visited.add(row.id);
        if (['cave', 'sealed_domain', 'secret_realm', 'ruin'].includes(row.kind)
            || row.sealed || row.data.windowless === true) return null;
        const parent = world.locations.find(place => place.id === row.parentId);
        if (!parent) break;
        row = parent;
    }
    const indoors = here.place.tags.includes('interior') || here.area.for === 'room' || here.area.for === 'table';
    const windows = here.place.data.windows === true;
    const openRoom = here.area.for === 'table'
        || ['reception', 'refectory', 'mission_hall', 'market'].includes(String(here.place.data.purpose));
    if (indoors && !windows && !openRoom) return null;
    const hour = world.currentHour;
    const light = hour < 5 || hour >= 21 ? 'dark'
        : hour < 7 ? 'dawn light' : hour < 11 ? 'morning sunlight'
        : hour < 15 ? 'sun bright overhead' : hour < 18 ? 'afternoon sunlight'
        : hour < 20 ? 'sun setting' : 'fading daylight';
    if (indoors && (hour >= 20 || hour < 5)) return 'lamps lit';
    return indoors ? `${light} through ${windows ? 'the windows' : 'the open doorway'}` : light;
}
