/** Fresh adapter reads; engine continuation has no SQL imports. */
import type { Cultivator } from '../schema/cultivation.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { TheRollsToRead } from '../engine/world/where-somebody-stands-on-a-houses-roll.js';
import type { RetrievalAuthority } from '../engine/world/fetching-an-object-from-a-house-store.js';
import { purposeOf, pathTo, reachThrough } from '../engine/world/architecture.js';
import { isTheWorldsToMove } from '../engine/world/npc-state.js';
import { whereTheyAreStanding, whereCompoundsAre } from '../engine/world/where-inside-a-house-somebody-is-standing.js';
import { theAreasOf } from '../engine/world/where-in-a-place-somebody-is-standing.js';
import { whatABodyCanCarry, whatAllOfThatTakes } from '../engine/world/what-a-body-can-carry-and-what-a-ring-holds.js';
import { whatTheirThingsTake, together, howManyHeld, whereItWouldGo } from '../engine/world/what-somebody-is-carrying-takes.js';
import { readHouseStoreRequest, decisionForTheHouseStoreRequest } from './reading-a-house-store-request.js';
import { theDoorKeysTheyActuallyCarry } from './the-door-keys-they-actually-carry.js';
import { theAreaTheyAreIn } from './walking-across-a-place.js';
import { invitationEndsAt } from '../engine/world/npc-routines.js';
import { LESSER_ACTION_DAYS } from './lesser-action-costs.js';
import { aRoomOfTheirOwn } from '../engine/world/where-in-a-place-somebody-is-standing.js';

export interface FreshRetrievalRepositoryReads {
    rollRowFor: TheRollsToRead['rollRowFor'];
    ledgerFor(personId: string): Parameters<typeof decisionForTheHouseStoreRequest>[3];
    countedFor(personId: string): Parameters<typeof whatAllOfThatTakes>[0];
    /**
     * undefined: not the currently advancing played body; null: its current
     * authoritative read is unavailable. Fresh body: just read at THIS actual
     * clock checkpoint, AFTER passenger projection and actual body changes.
     * Never a Cultivator captured at span acceptance or its future endpoint.
     */
    playedBodyAt(personId: string, state: WorldState, onDay: number): Cultivator | null | undefined;
}

export function authorityForPhysicalRetrieval(reads: FreshRetrievalRepositoryReads): RetrievalAuthority {
    const standing = (state: WorldState, actor: WorldState['npcs'][number]) => {
        const groundId = whereTheyAreStanding(state, whereCompoundsAre(state), actor,
            new Set(state.npcs.map(n => n.id)));
        const ground = state.locations.find(l => l.id === groundId);
        return { groundId, areaId: ground ? theAreasOf(state, ground).whereIs.get(actor.id) ?? null : null };
    };
    return {
        approval: (state, actor, intent, onDay) => {
            const house = state.factions.find(h => h.id === intent.houseId && h.dissolvedOnDay === null);
            const object = state.objects.find(o => o.id === intent.objectId);
            const room = state.locations.find(l => l.id === intent.storeId);
            const purpose = room ? purposeOf(room) : null;
            if (!house || !object || purpose === null || actor.status !== 'alive' || actor.factionId !== house.id)
                return { allowed: false, reason: 'The actual house, carrier or stored object is unavailable.' };
            const requester = state.npcs.find(n => n.id === intent.requesterId);
            const played = reads.playedBodyAt(intent.requesterId, state, onDay);
            const membership = played !== undefined || requester && !isTheWorldsToMove(requester)
                ? reads.rollRowFor(intent.requesterId) : null;
            if (played !== undefined || requester && !isTheWorldsToMove(requester)) {
                if (membership?.sectId !== house.id)
                    return { allowed: false, reason: 'The requester is no longer on the actual house roll.' };
            } else if (requester?.factionId !== house.id)
                return { allowed: false, reason: 'The requester is no longer on the actual house roll.' };
            const reading = readHouseStoreRequest(state, house, intent.requesterId, purpose,
                { world: state, rollRowFor: reads.rollRowFor });
            if (!reading.receivers.has(actor.id)) return { allowed: false,
                reason: 'The carrier no longer holds or works in the actual store office.' };
            // An area-specific object remains private even in the same room.
            const at = standing(state, actor);
            if (at.groundId === room!.id && typeof object.data.areaId === 'string' && object.data.areaId !== at.areaId)
                return { allowed: false, reason: 'The stored object is in another actual area.' };
            const decision = decisionForTheHouseStoreRequest(reading, object, intent.meaning,
                reads.ledgerFor(intent.requesterId), Math.floor(onDay));
            return { allowed: decision.allowed, reason: decision.line };
        },
        entry: (state, actor, groundId, onDay) => {
            const entered = reachThrough(pathTo(state.locations, groundId), {
                realmOrdinal: actor.cultivation.realmOrdinal, onDay,
                keyIds: theDoorKeysTheyActuallyCarry(state.objects, actor.id)
            }, { enteredAt: actor.locationId ?? undefined });
            return { allowed: entered.stoppedAt === null && entered.level !== 'barred', reason: entered.reason };
        },
        packing: (state, personId, object, onDay) => {
            const played = reads.playedBodyAt(personId, state, onDay);
            const native = state.npcs.find(n => n.id === personId && n.status === 'alive');
            const ordinal = played === null ? null : played?.realmOrdinal
                ?? (native && isTheWorldsToMove(native) ? native.cultivation.realmOrdinal : null);
            if (ordinal === null) return { allowed: false, reason: 'No current authoritative carrying body is available.' };
            const lands = whereItWouldGo(together(whatAllOfThatTakes(reads.countedFor(personId)),
                whatTheirThingsTake(state.objects, personId)), object, whatABodyCanCarry(ordinal),
                howManyHeld(state.objects, personId));
            return lands === 'too_heavy' || lands === 'hands_full'
                ? { allowed: false, reason: lands } : { allowed: true, how: lands };
        },
        recipient: (state, personId, onDay) => {
            const played = reads.playedBodyAt(personId, state, onDay);
            if (played !== undefined) {
                if (played === null) return { kind: 'unavailable' };
                if (!played.alive) return { kind: 'dead' };
                // Actual DB physical body. A proxy's scene never receives its goods.
                const at = theAreaTheyAreIn(state, played);
                return { kind: 'present', id: played.id, name: played.name,
                    groundId: at?.place.id ?? null, areaId: at?.area.id ?? null };
            }
            const native = state.npcs.find(n => n.id === personId);
            if (!native) return { kind: 'absent' };
            if (!isTheWorldsToMove(native)) return { kind: 'unavailable' };
            if (native.status !== 'alive') return { kind: 'dead' };
            const at = standing(state, native);
            return { kind: 'present', id: native.id, name: native.name,
                groundId: at.groundId, areaId: at.areaId };
        },
        carrierArea: (state, actor) => standing(state, actor).areaId,
        approachArea: (state, actor, intent, onDay) => {
            // This is a finite ordinary local walk, not another geographic path
            // or permission to chase the recipient. The leaf checks actual presence.
            const meeting = state.locations.find(l => l.id === intent.meetingId);
            if (!meeting || standing(state, actor).groundId !== meeting.id) return null;
            const area = theAreasOf(state, meeting).areas.find(a => a.id === intent.meetingAreaId);
            if (!area || area.for === 'room' && area.id !== aRoomOfTheirOwn(meeting, actor.id).id) return null;
            const enters = reachThrough(pathTo(state.locations, meeting.id), {
                realmOrdinal: actor.cultivation.realmOrdinal, onDay,
                keyIds: theDoorKeysTheyActuallyCarry(state.objects, actor.id)
            }, { enteredAt: actor.locationId ?? undefined });
            if (enters.stoppedAt !== null || enters.level === 'barred') return null;
            const untilDay = onDay + LESSER_ACTION_DAYS.move;
            // Ordinary invitation placement remains live through arrival; the
            // continuation ends it on actual completion, before normal rank work.
            const until = invitationEndsAt({ currentDay: Math.floor(untilDay),
                currentHour: (untilDay - Math.floor(untilDay)) * 24 });
            return { ...actor, activity: { kind: 'travelling', note: 'Walking to the accepted retrieval meeting.',
                withIds: [], sinceDay: onDay, untilDay, fromLocationId: meeting.id,
                returnTo: meeting.id, thingId: intent.objectId, retrievalRequestId: actor.activity?.retrievalRequestId,
                redirect: { until, previous: null, standingIn: area.id } } };
        }
    };
}
