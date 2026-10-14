/** A finite admitted foot phase records its original course and actual SQL arrival. */
import type Database from 'better-sqlite3';
import type { Cultivator } from '../schema/cultivation.js';
import type { WorldState } from '../engine/world/world-state.js';
import { followedParty } from './the-party-you-actually-follow.js';
import { arrivalCourseOfActivity, arrivalCourseOfFact, sameActualArrivalCourse, recordActualBodyArrival }
    from '../engine/world/a-body-that-actually-arrived.js';
import { factsWithDataValue } from '../engine/world/witness-reaction-index.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import { makeFact } from '../engine/world/history.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { worldLocationFor } from './entities.js';

export function recordFollowingFootCourse(db: Database.Database, world: WorldState, body: Cultivator) {
    const party = body.alive && followedParty(db, world, body.id);
    const activity = party && party.leader.activity;
    if (!party || !activity || activity.vesselId || activity.airCourseLocationId) return;
    const course = arrivalCourseOfActivity(activity);
    if (!course) return;
    if (factsWithDataValue(world, 'followingPartyFootCourse', party.binding.id).some(fact => {
        const existing = arrivalCourseOfFact(fact);
        return existing && sameActualArrivalCourse(course, existing);
    })) return;
    appendWorldFact(world, makeFact({ day: routineTime(world), kind: 'gathering', visibility: 'secret',
        locationId: worldLocationFor(world, body.location)?.id ?? null, causes: [party.binding.id, party.itinerary.id],
        actors: [{ id: body.id, name: body.name, role: 'follower' },
            { id: party.leader.id, name: party.leader.name, role: 'party_leader' }],
        summary: 'The consenting follower entered the actual finite foot course.',
        data: { followingPartyFootCourse: party.binding.id, leaderId: party.leader.id, ...course } }), { recur: false, bystanders: false });
}

export function recordFollowingFootArrival(db: Database.Database, world: WorldState, body: Cultivator, onDay: number) {
    if (!body.alive) return;
    const party = followedParty(db, world, body.id, onDay);
    if (!party) return;
    const locationId = worldLocationFor(world, body.location)?.id ?? null;
    for (const accepted of factsWithDataValue(world, 'followingPartyFootCourse', party.binding.id)) {
        const course = arrivalCourseOfFact(accepted);
        if (!course || locationId !== course.toLocationId) continue;
        const leaderArrived = factsWithDataValue(world, 'bodyId', party.leader.id).some(fact => {
            const arrived = arrivalCourseOfFact(fact);
            return fact.data.actualBodyArrival === true && fact.day <= onDay && arrived && sameActualArrivalCourse(course, arrived);
        });
        if (leaderArrived) recordActualBodyArrival(world, { id: body.id, name: body.name, alive: body.alive, locationId }, course, onDay, accepted);
    }
}
