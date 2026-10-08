/** Dated open boards in cities and internal boards at each house's grounds. */
import { REGIONS, whatKindOfPlace } from './regions.js';
import { SECTS } from './sects.js';

/** The existing house cycles, made explicit rather than re-read from a lifespan. */
const CONCLAVE_CADENCES: Readonly<Record<string, number>> = {
    "sect-frostmirror-court": 25,
    "sect-deeproot-court": 100,
    "sect-hollow-court": 500,
    "sect-the-severed": 25,
    "sect-nine-abyss-flame-sect": 25,
    "sect-storm-tyrant-court": 25,
    "sect-ancient-bough-grove": 25,
    "house-still-blade": 25,
    "house-shrinking-earth": 25,
    "house-immovable-mountain": 25
};

export const COMPETITION_CALENDARS = [
    ...REGIONS.flatMap(region => region.places.filter(place => ['city', 'provincial capital'].includes(whatKindOfPlace(place.name) ?? '')).map(place => ({
        id: `open:${place.name}`, venueName: place.name, houseId: null as string | null,
        open: true, purpose: 'open' as const, everyYears: 3, noticeDays: 90
    }))),
    ...SECTS.map(house => ({ id: `internal:${house.id}`, venueName: null as string | null,
        houseId: house.id, open: false, purpose: 'internal' as const, everyYears: 7, noticeDays: 90 })),
    ...SECTS.map(house => ({ id: `conclave:${house.id}`, venueName: null as string | null,
        houseId: house.id, open: false, purpose: 'conclave' as const, everyYears: CONCLAVE_CADENCES[house.id] ?? 13, noticeDays: 90 }))
];
