/** The house reads its existing member rows against the physical lamps, through its hall's work. */
import { heldThisHiredPost } from './a-hired-duty-at-its-post.js';
import { carriesATokenAt, thisHouseCanIssue, whatTheHallSays, whoHasALampBurningIn,
    type WhatTheHallSays } from './a-house-knows-its-own-by-a-lamp-and-a-token.js';
import { whereThisHouseBurnsItsLamps } from './a-recruit-is-given-their-lamp-at-the-house.js';
import { factsWithData, factsWithDataValue } from './witness-reaction-index.js';
import { whenTheyReachTheirPost } from './places-on-the-way.js';
import { routineTime } from './npc-routines.js';
import { makeFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { missingMembersInRollCheck } from './life-lamp-roll-check-findings.js';
import type { NpcRecord } from './npc-state.js';
import type { WorldState } from './world-state.js';
import { routeQueriesFor, type RouteQueries } from './locations.js';

function theirDailyCheck(state: WorldState, houseId: string, hall: string, disciple: NpcRecord,
    member: NpcRecord, day: number, routes?: RouteQueries): number | null {
    // Only a stationed person in this hall can have made its daily check.
    // Rule out everybody else before looking through their possible hire terms.
    if (disciple.locationId !== hall || disciple.activity?.kind !== 'stationed'
        || member.diedOnDay === null) return null;
    const hire = state.obligations.find(term => term.tags.includes('hall-duty') && heldThisHiredPost(disciple, term));
    if (disciple.factionId !== houseId && !hire) return null;
    const reached = whenTheyReachTheirPost(state.locations, disciple, routes);
    if (reached === null) return null;
    const check = Math.max(Math.floor(member.diedOnDay) + 1, Math.ceil(reached));
    const house = state.factions.find(row => row.id === houseId);
    const end = Math.min(disciple.activity.untilDay ?? Infinity, disciple.diedOnDay ?? Infinity,
        house?.dissolvedOnDay ?? Infinity, hire?.settlement?.onDay ?? Infinity);
    return check <= day && check < end ? check : null;
}

/** Leaving the duty retains what its daily checks found, once, before the term disappears. */
export function keepTheirHallCheckOnLeaving(state: WorldState, disciple: NpcRecord, day: number): void {
    const hired = state.obligations.some(term => term.tags.includes('hall-duty') && heldThisHiredPost(disciple, term));
    const houseId = hired ? state.locations.find(place => place.id === disciple.locationId)?.data.factionId as string | undefined
        : disciple.factionId;
    if (!houseId || disciple.activity?.kind !== 'stationed') return;
    const hall = whereThisHouseBurnsItsLamps(state.locations, houseId);
    if (!hall || disciple.locationId !== hall) return;
    const lamps = whoHasALampBurningIn(state.objects.filter(object => object.locationId === hall), houseId);
    const recorded = new Set(factsWithData(state, 'lampRollCheck').filter(fact => fact.factionIds.includes(houseId))
        .flatMap(missingMembersInRollCheck));
    const checks = new Map<number, NpcRecord[]>();
    for (const member of state.npcs) {
        if (member.factionId !== houseId || !carriesATokenAt(member.factionRankIndex)
            || lamps.has(member.id) || recorded.has(member.id)) continue;
        const check = theirDailyCheck(state, houseId, hall, disciple, member, day);
        if (check === null) continue;
        const findings = checks.get(check) ?? [];
        findings.push(member); checks.set(check, findings);
    }
    for (const [checkedOnDay, members] of checks) appendWorldFact(state, makeFact({
        day: checkedOnDay, kind: 'said_in_public', visibility: 'faction', locationId: hall,
        factionIds: [houseId], actors: [{ id: disciple.id, name: disciple.name, role: 'checked the roll' }],
        witnessIds: [disciple.id],
        summary: `${disciple.name} checked the disciple roll against the Life Lamp Hall: ${members.map(member => member.name).join(', ')} had no lamp in the hall.`,
        data: { lampRollCheck: true, missingMemberIds: JSON.stringify(members.map(member => member.id)) }
    }), { recur: false, bystanders: false });
}

/** A daily check is settled from an actual hall posting, never by enumerating the days. */
export function whenTheHallKnowsTheirLampIsGone(state: WorldState, houseId: string, member: NpcRecord,
    day: number, checkedNow = false): number | null {
    return readTheHallLampsTogether(state, houseId)(member, day, checkedNow);
}

/** One synchronous hall read shares its physical lamps and stationed clerks.
 * Do not retain across a world mutation; facts remain live during inquiries. */
export function readTheHallLampsTogether(state: WorldState, houseId: string):
    (member: NpcRecord, day: number, checkedNow?: boolean) => number | null {
    const hall = whereThisHouseBurnsItsLamps(state.locations, houseId);
    const house = state.factions.find(row => row.id === houseId);
    let lamps: Set<string> | undefined;
    let clerks: NpcRecord[] | undefined;
    let routes: RouteQueries | undefined;
    return (member, day, checkedNow = false) => {
        if (!hall || !house || member.diedOnDay === null || member.diedOnDay > day) return null;
        lamps ??= whoHasALampBurningIn(state.objects.filter(object => object.locationId === hall), houseId);
        if (lamps.has(member.id)) return null;
        let known = checkedNow ? day : Infinity;
        for (const fact of factsWithDataValue(state, 'lampInquiry', member.id)) {
            if (fact.day <= day && fact.factionIds.includes(houseId)) known = Math.min(known, fact.day);
        }
        for (const fact of factsWithData(state, 'lampRollCheck')) {
            if (fact.day <= day && fact.factionIds.includes(houseId)
                && missingMembersInRollCheck(fact).includes(member.id)) known = Math.min(known, fact.day);
        }
        // Somebody actually in the hall saw it crumble and can tell the rest of the house.
        for (const fact of factsWithDataValue(state, 'memberId', member.id)) {
            if (fact.day > day || fact.data.lifeLamp !== true || fact.data.madeTokenDust !== true || fact.locationId !== hall) continue;
            if (fact.witnessIds.some(id => state.npcs.some(person => person.id === id && person.factionId === houseId))) {
                known = Math.min(known, fact.day);
            }
        }
        clerks ??= state.npcs.filter(person => person.locationId === hall && person.activity?.kind === 'stationed');
        if (clerks.length) routes ??= routeQueriesFor(state.locations);
        for (const disciple of clerks) {
            const check = theirDailyCheck(state, houseId, hall, disciple, member, day, routes);
            if (check !== null) known = Math.min(known, check);
        }
        return Number.isFinite(known) ? known : null;
    };
}

/** Nothing new is kept for the roll: what the house knows of its own people is their rows. */
export function readTheRollAgainstTheHall(state: WorldState, houseId: string, input: {
    day?: number; checkedNow?: boolean; members?: readonly NpcRecord[];
    unseenSince?: ReadonlyMap<string, number>;
} = {}): WhatTheHallSays[] {
    const day = input.day ?? routineTime(state);
    const hall = whereThisHouseBurnsItsLamps(state.locations, houseId);
    if (!hall) return [];
    const members = input.members ?? state.npcs.filter(person => person.factionId === houseId);
    const lamps = whoHasALampBurningIn(state.objects.filter(object => object.locationId === hall), houseId);
    const couldIssue = thisHouseCanIssue(members.map(person => person.cultivation.realmOrdinal));
    const whenKnown = readTheHallLampsTogether(state, houseId);
    const roll: Parameters<typeof whatTheHallSays>[0]['roll'][number][] = [];
    for (const member of members) {
        const since = input.unseenSince?.get(member.id);
        const unseenForDays = since === undefined ? 0 : Math.max(0, day - since);
        if (lamps.has(member.id)) {
            roll.push({ memberId: member.id, memberName: member.name, theyHaveALamp: true,
                holderIsAlive: member.status === 'alive', daysSinceAnybodySawThem: unseenForDays });
        } else if (couldIssue && carriesATokenAt(member.factionRankIndex)
            && whenKnown(member, day, input.checkedNow) !== null) {
            roll.push({ memberId: member.id, memberName: member.name, theyHaveALamp: true,
                holderIsAlive: false, daysSinceAnybodySawThem: unseenForDays });
        }
    }
    return whatTheHallSays({ roll });
}
