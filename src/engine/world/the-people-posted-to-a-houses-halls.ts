/** Hall staff are actual appointments and bodies, with service settled when read. */
import { DAYS_PER_MONTH } from '../../data/cultivation/mortal-world.js';
import { elderRungOf } from '../cultivation/leadership.js';
import { portfoliosIn } from '../social-leverage/authority-for-an-order.js';
import { purposeOf } from './architecture.js';
import { HOUSE_HALLS, hallForRoom } from './house-halls.js';
import { appointHouseWorker, houseAppointment } from './internal-affairs-puts-somebody-to-the-work.js';
import { isTheWorldsToMove } from './npc-state.js';
import { locationOfNpcOnItsJourney, whenTheyReachTheirPost } from './places-on-the-way.js';
import { creditMerit, whatServiceIsWorth } from './what-a-house-counts-in-somebodys-favour.js';
import { witnessIndexFor } from './witness-reaction-index.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { makeFact } from './history.js';
import type { WorldState } from './world-state.js';
import type { APost } from '../social-leverage/who-works-in-an-elders-hall.js';

/** A steady post earns a tenth of ordinary board service, at least one a month. */
export function hallServiceWorth(ordinal: number, days: number): number {
    return Math.floor(Math.max(0, days) * Math.max(1 / DAYS_PER_MONTH, whatServiceIsWorth(ordinal, 1) / 10));
}

/** Read the real posted people, never deal an imaginary staff from the roll. */
export function theHallStaff(state: WorldState, houseId: string, day: number): APost[] {
    const house = state.factions.find(row => row.id === houseId);
    if (!house) return [];
    const rooms = new Map(state.locations.filter(room => room.data.factionId === houseId)
        .map(room => [room.id, room]));
    return state.npcs.flatMap(person => {
        if (person.status !== 'alive' || person.factionId !== houseId || person.activity?.kind !== 'stationed'
            || person.activity.redirect || person.activity.houseCareFactId || (person.activity.untilDay != null && day >= person.activity.untilDay)) return [];
        const room = rooms.get(locationOfNpcOnItsJourney(state, person, day) ?? '');
        const purpose = room && purposeOf(room);
        if (!purpose || !hallForRoom(purpose)) return [];
        const appointment = houseAppointment(state, person);
        const manager = appointment?.actors.find(actor => actor.role === 'personnel_manager')?.id ?? null;
        return [{ purpose, personId: person.id, selectedById: manager }];
    });
}

/** Internal Affairs fills actual vacancies; a small roll can leave work unstaffed. */
export function staffTheHalls(state: WorldState, houseId: string, day: number, initialPlacement = false): number {
    const house = state.factions.find(row => row.id === houseId && row.dissolvedOnDay === null);
    if (!house) return 0;
    const roll = state.npcs.filter(person => person.status === 'alive' && person.factionId === houseId);
    const portfolios = portfoliosIn({ locations: state.locations, sectId: houseId, npcs: state.npcs,
        roll: roll.map(person => ({ id: person.id, rankIndex: person.factionRankIndex })), rankCount: house.ranks.length });
    const heads = new Set(portfolios.map(portfolio => portfolio.holderId));
    const work = theHallStaff(state, houseId, day);
    let added = 0;
    for (const hall of HOUSE_HALLS) {
        const portfolio = portfolios.find(row => row.hallId === hall.id);
        if (!portfolio) continue;
        const job = `serving_${hall.id.replaceAll('-', '_')}`;
        if (roll.some(person => houseAppointment(state, person)?.data.job === job)) continue;
        if (work.some(post => hallForRoom(post.purpose)?.id === hall.id)) continue;
        const room = state.locations.find(row => row.data.factionId === houseId
            && purposeOf(row) === (hall.id === 'internal-affairs' ? 'life_lamp_hall' : portfolio.purpose))
            ?? state.locations.find(row => row.data.factionId === houseId && purposeOf(row) === portfolio.purpose);
        if (!room) continue;
        const worker = appointHouseWorker(state, { houseId, job,
            room, day, posted: true, initialPlacement, note: `Serving ${hall.name}: ${hall.duties.join('; ')}.`,
            eligible: person => person.factionRankIndex >= 0 && person.factionRankIndex < elderRungOf(house.ranks.length)
                && !heads.has(person.id) && !(person.activity?.untilDay != null && person.activity.untilDay > day),
            suitable: person => person.factionRankIndex > 0 });
        if (worker) added++;
    }
    return added;
}

/** Settle completed service once. The receipt, not a second contribution balance, holds what was paid. */
export function settleHallService(state: WorldState, day: number, only?: ReadonlySet<string>): number {
    let credited = 0;
    const places = new Map(state.locations.map(place => [place.id, place]));
    for (let at = 0; at < state.npcs.length; at++) {
        const person = state.npcs[at]!;
        if (only && !only.has(person.id)) continue;
        if (!isTheWorldsToMove(person) || person.status !== 'alive' || !person.factionId
            || person.activity?.kind !== 'stationed' || person.activity.redirect || person.activity.houseCareFactId) continue;
        const appointment = houseAppointment(state, person);
        // Older real hall posts also qualify, using their own actual term as the authority.
        const room = places.get(person.locationId ?? '');
        if (!room || room.data.factionId !== person.factionId || !hallForRoom(purposeOf(room)!)) continue;
        const since = whenTheyReachTheirPost(state.locations, person);
        if (since === null || since >= day) continue;
        const through = Math.min(day, person.activity.untilDay ?? day);
        const receipt = person.activity.houseWorkPayFactId
            ? witnessIndexFor(state).byId.get(person.activity.houseWorkPayFactId) : undefined;
        const already = receipt?.data.houseHallService === true && receipt.data.servedSinceDay === since
            ? Number(receipt.data.totalContribution ?? 0) : 0;
        const ordinal = Number(appointment?.data.serviceOrdinal ?? receipt?.data.serviceOrdinal
            ?? person.cultivation.realmOrdinal);
        const earned = hallServiceWorth(ordinal, through - since);
        const gain = earned - already;
        if (gain <= 0) continue;
        const fact = appendWorldFact(state, makeFact({ day: through, kind: 'gathering', locationId: room.id,
            factionIds: [person.factionId], actors: [{ id: person.id, name: person.name, role: 'hall_worker' }],
            visibility: 'faction', summary: `${person.name} received ${gain} contribution for service in ${room.name}.`,
            data: { houseHallService: true, houseId: person.factionId, servedSinceDay: since,
                servedUntilDay: through, totalContribution: earned, contribution: gain, serviceOrdinal: ordinal,
                ...(appointment ? { appointmentId: appointment.id } : {}) } }), { bystanders: false, recur: false });
        const paid = creditMerit(person, gain);
        state.npcs[at] = { ...paid, activity: { ...person.activity, houseWorkPayFactId: fact.id } };
        credited += gain;
    }
    return credited;
}
