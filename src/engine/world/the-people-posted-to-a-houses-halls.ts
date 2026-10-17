/** Hall staff are actual appointments and bodies, with service settled when read. */
import { servesThisHiredDuty } from './a-hired-duty-at-its-post.js';
import { DAYS_PER_MONTH } from '../../data/cultivation/mortal-world.js';
import { houseFloorsOf } from '../../data/cultivation/the-three-floors-a-house-admits-at.js';
import { elderRungOf } from '../cultivation/leadership.js';
import { portfoliosIn } from '../social-leverage/authority-for-an-order.js';
import { purposeOf, type RoomPurpose } from './architecture.js';
import { HOUSE_HALLS, hallForRoom } from './house-halls.js';
import { appointHouseWorker, houseAppointment } from './internal-affairs-puts-somebody-to-the-work.js';
import { isTheWorldsToMove, type NpcRecord } from './npc-state.js';
import { locationOfNpcOnItsJourney, whenTheyReachTheirPost } from './places-on-the-way.js';
import { creditMerit, whatServiceIsWorth } from './what-a-house-counts-in-somebodys-favour.js';
import { witnessIndexFor } from './witness-reaction-index.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { makeFact } from './history.js';
import type { WorldState } from './world-state.js';
import type { APost } from '../social-leverage/who-works-in-an-elders-hall.js';
import { hallStaffingDepth } from './a-house-keeps-the-staff-it-can-support.js';
import { keepTheHallChairs } from './a-house-gives-one-elder-each-hall.js';
import { onTheirHallShift } from './a-hall-workers-shift.js';
import { roomForHouseWork, housesWithACraftHall } from './where-a-house-does-its-work.js';
import { routeQueriesFor } from './locations.js';

/** Institutional work uses actual appointed hands at home, not the best absent member. */
export function theHandsAtHouseCraftWork(state: WorldState, craft: 'alchemy' | 'artifact', day: number): Map<string, NpcRecord[]> {
    const supported = housesWithACraftHall(state.locations, craft === 'alchemy' ? 'alchemy_hall' : 'artifact_refining_hall');
    const places = new Map(state.locations.map(place => [place.id, place]));
    const routes = routeQueriesFor(state.locations);
    const hands = new Map<string, NpcRecord[]>();
    const hires = new Map(state.obligations.filter(term => term.status === 'open' && term.tags.includes('hall-duty')
        && term.tags.includes(`hall-job:serving_${craft}`)).map(term => [term.holderId, term]));
    for (const person of state.npcs) {
        const hire = hires.get(person.id);
        const hired = !!hire && day <= (hire.dueOnDay ?? Infinity) && servesThisHiredDuty(person, hire);
        const room = places.get(person.locationId ?? '');
        const houseId = hired ? room?.data.factionId as string | undefined : person.factionId;
        if (person.status !== 'alive' || !isTheWorldsToMove(person) || !houseId || !supported.has(houseId)
            || person.activity?.kind !== 'stationed' || person.activity.redirect || person.activity.houseCareFactId
            || person.activity.houseWorkSchedule?.rota) continue;
        const appointment = houseAppointment(state, person);
        if (appointment?.data.job !== `serving_${craft}`
            && !String(appointment?.data.job ?? '').startsWith(`serving_${craft}:`) && !hired) continue;
        if (!room || room.data.factionId !== houseId) continue;
        const arrival = whenTheyReachTheirPost(state.locations, person, routes);
        if (arrival === null || day < arrival) continue;
        const working = hands.get(houseId) ?? [];
        working.push(person); hands.set(houseId, working);
    }
    return hands;
}

/** A steady post earns a tenth of ordinary board service, at least one a month. */
export function hallServiceWorth(ordinal: number, days: number, rota = false): number {
    return Math.floor(Math.max(0, days) * Math.max(1 / DAYS_PER_MONTH, whatServiceIsWorth(ordinal, 1) / (rota ? 20 : 10)));
}

/** Read the real posted people, never deal an imaginary staff from the roll. */
export function theHallStaff(state: WorldState, houseId: string, day: number): APost[] {
    const house = state.factions.find(row => row.id === houseId);
    if (!house) return [];
    const rooms = new Map(state.locations.filter(room => room.data.factionId === houseId)
        .map(room => [room.id, room]));
    const hires = new Map(state.obligations.filter(term => term.status === 'open' && term.tags.includes('hall-duty'))
        .map(term => [term.holderId, term]));
    return state.npcs.flatMap(person => {
        const hire = hires.get(person.id);
        const servingHire = !!hire && day <= (hire.dueOnDay ?? Infinity) && servesThisHiredDuty(person, hire);
        if (person.status !== 'alive' || person.factionId !== houseId && !servingHire || person.activity?.kind !== 'stationed'
            || person.activity.redirect || person.activity.houseCareFactId) return [];
        if (!onTheirHallShift(person.activity, Number.isInteger(day) ? day + (state.currentHour ?? 8) / 24 : day)) return [];
        const room = rooms.get(locationOfNpcOnItsJourney(state, person, day) ?? '');
        const appointment = houseAppointment(state, person);
        const purpose = typeof appointment?.data.workPurpose === 'string'
            ? appointment.data.workPurpose as RoomPurpose : room && purposeOf(room);
        if (!room || room.id !== person.locationId) return [];
        if (!purpose || !hallForRoom(purpose)) return [];
        const manager = appointment?.actors.find(actor => actor.role === 'personnel_manager')?.id ?? (servingHire ? hire!.subjectId : null);
        return [{ purpose, personId: person.id, selectedById: manager }];
    });
}

/** Internal Affairs fills actual vacancies; a small roll can leave work unstaffed. */
export function staffTheHalls(state: WorldState, houseId: string, day: number, initialPlacement = false): number {
    const house = state.factions.find(row => row.id === houseId && row.dissolvedOnDay === null);
    if (!house) return 0;
    if (!initialPlacement || state.locations.some(room => room.data.factionId === houseId && typeof room.data.hallOfficeId === 'string'))
        keepTheHallChairs(state, houseId);
    const roll = state.npcs.filter(person => person.status === 'alive' && person.factionId === houseId);
    const portfolios = portfoliosIn({ locations: state.locations, sectId: houseId, npcs: state.npcs,
        roll: roll.map(person => ({ id: person.id, rankIndex: person.factionRankIndex })), rankCount: house.ranks.length });
    const heads = new Set(portfolios.map(portfolio => portfolio.holderId));
    const work = theHallStaff(state, houseId, day);
    const menialTier = houseFloorsOf(houseId)?.hasMenialTier === true;
    const outerRank = menialTier ? 1 : 0;
    let added = 0;
    // Internal Affairs puts available servants to menial work before the outer rota.
    if (menialTier) for (const hall of HOUSE_HALLS) {
        if (!hall.chores || !portfolios.some(portfolio => portfolio.hallId === hall.id)) continue;
        const room = roomForHouseWork(state.locations, houseId, hall.chores.room);
        if (!room) continue;
        const job = `menial_${hall.id.replaceAll('-', '_')}`;
        if (state.npcs.some(person => houseAppointment(state, person)?.data.job === job)) continue;
        const worker = appointHouseWorker(state, { houseId, job, room, day, posted: true, initialPlacement,
            purpose: hall.chores.room, note: hall.chores.work,
            calendar: { periodDays: 1, offset: 0, shift: 'day', rota: false },
            eligible: person => person.factionRankIndex === 0 && !heads.has(person.id)
                && !(person.activity?.untilDay != null && person.activity.untilDay > day),
            suitable: person => person.factionRankIndex === 0 });
        if (worker) added++;
    }
    const depth = hallStaffingDepth(state, houseId);
    for (const hall of HOUSE_HALLS) for (let hand = 0; hand < depth; hand++) {
        const portfolio = portfolios.find(row => row.hallId === hall.id);
        if (!portfolio) continue;
        const job = `serving_${hall.id.replaceAll('-', '_')}${hand ? ':' + hand : ''}`;
        if (roll.some(person => houseAppointment(state, person)?.data.job === job)) continue;
        if (depth === 1 && work.some(post => hallForRoom(post.purpose)?.id === hall.id)) continue;
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
    for (const hall of HOUSE_HALLS) {
        if (!portfolios.some(portfolio => portfolio.hallId === hall.id)) continue;
        for (const post of hall.posts ?? []) {
            if (state.npcs.some(person => houseAppointment(state, person)?.data.job === post.job)) continue;
            const room = roomForHouseWork(state.locations, houseId, post.room);
            if (!room) continue;
            const worker = appointHouseWorker(state, { houseId, job: post.job, room, day, posted: true,
                initialPlacement, purpose: post.purpose ?? post.room, note: post.work, calendar: post.calendar,
                eligible: person => person.factionRankIndex >= 0 && person.factionRankIndex < elderRungOf(house.ranks.length)
                    && !heads.has(person.id)
                    && !(person.activity?.untilDay != null && person.activity.untilDay > day),
                suitable: person => post.senior ? person.factionRankIndex > outerRank : person.factionRankIndex === outerRank });
            if (worker) added++;
        }
    }
    // Two alternating assignments cover daily chores and leave practice days.
    for (const hall of HOUSE_HALLS) {
        if (!hall.chores || !portfolios.some(portfolio => portfolio.hallId === hall.id)) continue;
        if (state.npcs.some(person => houseAppointment(state, person)?.data.job === `menial_${hall.id.replaceAll('-', '_')}`)) continue;
        const room = roomForHouseWork(state.locations, houseId, hall.chores.room);
        if (!room) continue;
        for (let offset = 0; offset < 2; offset++) {
            const job = `chores_${hall.id.replaceAll('-', '_')}_${offset}`;
            if (state.npcs.some(person => houseAppointment(state, person)?.data.job === job)) continue;
            const worker = appointHouseWorker(state, { houseId, job, room, day, posted: true, initialPlacement,
                purpose: hall.chores.room, note: hall.chores.work,
                calendar: { periodDays: 2, offset, shift: 'day', rota: true },
                eligible: person => person.factionRankIndex === outerRank && !heads.has(person.id)
                    && !(person.activity?.untilDay != null && person.activity.untilDay > day),
                suitable: person => person.factionRankIndex === outerRank });
            if (worker) added++;
        }
    }
    return added;
}

/** Settle completed service once. The receipt, not a second contribution balance, holds what was paid. */
export function settleHallService(state: WorldState, day: number, only?: ReadonlySet<string>): number {
    let credited = 0;
    const places = new Map(state.locations.map(place => [place.id, place]));
    const hired = new Set(state.obligations.filter(term => term.status === 'open' && term.tags.includes('hired-duty'))
        .map(term => term.holderId));
    for (let at = 0; at < state.npcs.length; at++) {
        const person = state.npcs[at]!;
        if (only && !only.has(person.id)) continue;
        if (!isTheWorldsToMove(person) || person.status !== 'alive' || !person.factionId
            || person.activity?.kind !== 'stationed' || person.activity.redirect || person.activity.houseCareFactId || hired.has(person.id)) continue;
        const appointment = houseAppointment(state, person);
        // Older real hall posts also qualify, using their own actual term as the authority.
        const room = places.get(person.locationId ?? '');
        if (!room || room.data.factionId !== person.factionId || !hallForRoom(purposeOf(room)!)) continue;
        const since = whenTheyReachTheirPost(state.locations, person);
        if (since === null || since >= day) continue;
        const through = day;
        const receipt = person.activity.houseWorkPayFactId
            ? witnessIndexFor(state).byId.get(person.activity.houseWorkPayFactId) : undefined;
        const already = receipt?.data.houseHallService === true && receipt.data.servedSinceDay === since
            ? Number(receipt.data.totalContribution ?? 0) : 0;
        const ordinal = Number(appointment?.data.serviceOrdinal ?? receipt?.data.serviceOrdinal
            ?? person.cultivation.realmOrdinal);
        const earned = hallServiceWorth(ordinal, through - since, person.activity.houseWorkSchedule?.rota);
        const gain = earned - already;
        if (gain <= 0) continue;
        const fact = appendWorldFact(state, makeFact({ day: through, kind: 'gathering', locationId: room.id,
            factionIds: [person.factionId], actors: [{ id: person.id, name: person.name, role: 'hall_worker' }],
            visibility: 'faction', summary: `${person.name} received ${gain} contribution for service in ${room.name}.`,
            data: { houseHallService: true, houseId: person.factionId, servedSinceDay: since,
                servedUntilDay: through, totalContribution: earned, contribution: gain, serviceOrdinal: ordinal,
                ...(appointment ? { appointmentId: appointment.id } : {}) } }), { bystanders: false, recur: false });
        const paid = creditMerit(state.npcs[at]!, gain);
        state.npcs[at] = { ...paid, activity: { ...paid.activity!, houseWorkPayFactId: fact.id } };
        credited += gain;
    }
    return credited;
}
