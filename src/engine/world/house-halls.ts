/** A house's halls group its existing rooms; one table keeps the owner's grouping editable. */
import type { RoomPurpose } from './architecture.js';

export interface HouseHall {
    id: string;
    name: string;
    rooms: readonly RoomPurpose[];
    duties: readonly string[];
    /** Internal Affairs provides serving disciples here; the resident keeps their private authority. */
    serviceOnly?: readonly RoomPurpose[];
}

export const HOUSE_HALLS: readonly HouseHall[] = [
    { id: 'outer-affairs', name: 'Outer Affairs Hall', rooms: ['gatehouse', 'forecourt', 'mission_hall', 'audience_hall'],
        duties: ['day and night gate watches', 'answer arrivals for the house', 'receive and hold visitors',
            'record arrivals and departures', 'keep the notice wall below the gate',
            'keep the notice board and contribution', 'receive envoys and petitions on set days',
            'conduct house business abroad'] },
    { id: 'discipline', name: 'Discipline Hall', rooms: ['punishment_hall', 'duelling_ground'],
        duties: ['hear charges', 'hold the accused', 'carry out punishments', 'night patrols of the grounds',
            'witness and record declared duels'] },
    { id: 'internal-affairs', name: 'Internal Affairs Hall',
        rooms: ['life_lamp_hall', 'dormitory', 'ancestral_hall', 'under_hall', 'refectory', 'residence',
            'practice_yard', 'lecture_hall', 'meditation_cell', 'vein_chamber'],
        serviceOnly: ['residence'], duties: ['daily disciple roll check', 'light lamps and issue tokens',
            'question newcomers whose recruiter cannot vouch', 'keep beds and the outer disciples chore rota',
            'provide meals', 'daily incense and tablets for members whose lamps went to dust',
            'guard what sleeps under the ancestral hall', 'provide serving disciples for the elders',
            'daily morning forms led by a senior', 'talks', 'sitting rota by rank and contribution'] },
    { id: 'scripture', name: 'Scripture Pavilion', rooms: ['scripture_pavilion', 'archive'],
        duties: ['lend and take back manuals', 'record readers and their ranks', 'copy and repair manuals',
            'guard restricted shelves', 'keep the house records, deeds and ledgers'] },
    { id: 'treasury', name: 'Treasury', rooms: ['treasury', 'tribute_room'],
        duties: ['monthly stipends', 'collect dues', 'fund posts and missions', 'inventory',
            'receive tribute from below and send it up on schedule'] },
    { id: 'alchemy', name: 'Alchemy Hall', rooms: ['alchemy_hall', 'furnace_room', 'infirmary'],
        duties: ['standing pills and monthly allotments', 'medicine stock', 'treat the injured'] },
    { id: 'artifact', name: 'Artifact Hall', rooms: ['artifact_refining_hall', 'workshop', 'formation_node'],
        duties: ['members gear and repair', 'maintain buildings', 'inspect formations and recharge them on schedule'] }
];

export function theHallFor(purpose: RoomPurpose): HouseHall | null {
    return HOUSE_HALLS.find(hall => hall.rooms.includes(purpose)) ?? null;
}

/** The grouping reads existing construction and never supplies a missing room. */
export function theHallsPresentIn(purposes: Iterable<RoomPurpose>): readonly HouseHall[] {
    const present = new Set(purposes);
    return HOUSE_HALLS.filter(hall => hall.rooms.some(purpose => present.has(purpose)));
}


export function hallForRoom(purpose: RoomPurpose): HouseHall | null {
    return HOUSE_HALLS.find(hall => hall.rooms.includes(purpose)) ?? null;
}

/** Dedicated halls are read from the compound's actual room kinds. */
export function hallsForRooms(rooms: readonly RoomPurpose[]): HouseHall[] {
    const present = new Set(rooms);
    return HOUSE_HALLS.filter(hall => hall.rooms.some(room => present.has(room)));
}
