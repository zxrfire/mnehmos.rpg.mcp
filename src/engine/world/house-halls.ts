/** A house's halls group its existing rooms; one table keeps the owner's grouping editable. */
import type { RoomPurpose } from './architecture.js';
import type { NpcActivity } from './npc-state.js';

export interface HouseHall {
    id: string;
    name: string;
    rooms: readonly RoomPurpose[];
    duties: readonly string[];
    /** Internal Affairs provides serving disciples here; the resident keeps their private authority. */
    serviceOnly?: readonly RoomPurpose[];
    /** Menial work stays with this hall; the room must already exist. */
    chores?: { room: RoomPurpose; work: string };
    posts?: readonly { job: string; room: RoomPurpose; purpose?: RoomPurpose; work: string;
        calendar: NonNullable<NpcActivity['houseWorkSchedule']>; senior?: boolean }[];
}

export const HOUSE_HALLS: readonly HouseHall[] = [
    { id: 'outer-affairs', name: 'Outer Affairs Hall', rooms: ['gatehouse', 'forecourt', 'mission_hall', 'audience_hall'],
        chores: { room: 'forecourt', work: 'Sweeping the gate approaches and carrying supplies for the gate.' },
        posts: [
            { job: 'gate_day_watch', room: 'gatehouse', work: 'Keeping the day gate watch and answering arrivals.',
                calendar: { periodDays: 1, offset: 0, shift: 'day', rota: false } },
            { job: 'gate_night_watch', room: 'gatehouse', work: 'Keeping the night gate watch and answering arrivals.',
                calendar: { periodDays: 1, offset: 0, shift: 'night', rota: false } }
        ],
        duties: ['day and night gate watches', 'answer arrivals for the house', 'receive and hold visitors',
            'record arrivals and departures', 'keep the notice wall below the gate',
            'keep the notice board and contribution', 'receive envoys and petitions on set days',
            'conduct house business abroad'] },
    { id: 'discipline', name: 'Discipline Hall', rooms: ['punishment_hall', 'duelling_ground'],
        chores: { room: 'punishment_hall', work: 'Cleaning the rooms and carrying water for the Discipline Hall.' },
        posts: [{ job: 'grounds_night_watch', room: 'forecourt', purpose: 'punishment_hall',
            work: 'Keeping the night watch on the compound grounds.',
            calendar: { periodDays: 1, offset: 0, shift: 'night', rota: false, patrol: true } }],
        duties: ['hear charges', 'hold the accused', 'carry out punishments', 'night patrols of the grounds',
            'witness and record declared duels'] },
    { id: 'internal-affairs', name: 'Internal Affairs Hall',
        rooms: ['life_lamp_hall', 'dormitory', 'ancestral_hall', 'under_hall', 'refectory', 'residence',
            'practice_yard', 'lecture_hall', 'meditation_cell', 'vein_chamber'],
        chores: { room: 'refectory', work: 'Preparing meals, washing clothes, and carrying water and firewood.' },
        posts: [{ job: 'morning_forms', room: 'practice_yard', senior: true,
            work: 'Leading the morning forms.',
            calendar: { periodDays: 1, offset: 0, shift: 'day', rota: false, hours: { from: 6, until: 10 } } }],
        serviceOnly: ['residence'], duties: ['daily disciple roll check', 'light lamps and issue tokens',
            'question newcomers whose recruiter cannot vouch', 'keep beds and the outer disciples chore rota',
            'provide meals', 'daily incense and tablets for members whose lamps went to dust',
            'guard what sleeps under the ancestral hall', 'provide serving disciples for the elders',
            'daily morning forms led by a senior', 'talks', 'sitting rota by rank and contribution'] },
    { id: 'scripture', name: 'Scripture Pavilion', rooms: ['scripture_pavilion', 'archive'],
        chores: { room: 'scripture_pavilion', work: 'Cleaning the shelves and carrying copying supplies.' },
        duties: ['lend and take back manuals', 'record readers and their ranks', 'copy and repair manuals',
            'guard restricted shelves', 'keep the house records, deeds and ledgers'] },
    { id: 'treasury', name: 'Treasury', rooms: ['treasury', 'tribute_room'],
        chores: { room: 'treasury', work: 'Cleaning the store and carrying its supplies.' },
        duties: ['monthly stipends', 'collect dues', 'fund posts and missions', 'inventory',
            'receive tribute from below and send it up on schedule'] },
    { id: 'alchemy', name: 'Alchemy Hall', rooms: ['alchemy_hall', 'furnace_room', 'infirmary'],
        chores: { room: 'furnace_room', work: 'Tending the fires and carrying water and fuel for the cauldrons.' },
        duties: ['standing pills and monthly allotments', 'medicine stock', 'treat the injured'] },
    { id: 'artifact', name: 'Artifact Hall', rooms: ['artifact_refining_hall', 'workshop', 'formation_node'],
        chores: { room: 'artifact_refining_hall', work: 'Tending the fires and carrying materials for refining.' },
        duties: ['members gear and repair', 'maintain buildings', 'inspect formations and recharge them on schedule'] }
];

export function hallForRoom(purpose: RoomPurpose): HouseHall | null {
    return HOUSE_HALLS.find(hall => hall.rooms.includes(purpose)) ?? null;
}

/** Dedicated halls are read from the compound's actual room kinds. */
export function hallsForRooms(rooms: readonly RoomPurpose[]): HouseHall[] {
    const present = new Set(rooms);
    return HOUSE_HALLS.filter(hall => hall.rooms.some(room => present.has(room)));
}
