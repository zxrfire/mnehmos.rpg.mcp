/** Actual authored rooms and changing door facts on one real vessel object.
 * Position/capacity/crew never manufacture rooms. The caller establishes fresh
 * physical hull reach; this leaf reads access/force and returns object changes.
 */
import type { ObjectRecord } from './possessions.js';
import type { VesselInteriorSlot } from './what-a-conveyance-does-to-a-journey.js';
import { getConveyance } from '../../data/cultivation/what-a-house-moves-its-people-on.js';
import { DOOR_MATERIALS, type TheDoor } from './door-materials.js';
import { canUnmake, type UnmakingReach } from '../cultivation/whether-a-weapon-survives-being-used.js';

interface RoomChanges { closed?: boolean; brokenOnDay?: number; holderId?: string; keyId?: string }
export interface ActualVesselRoom {
    readonly vesselId: string;
    readonly slot: VesselInteriorSlot;
    readonly holderId: string | null;
    readonly keyId: string | null;
    readonly closed: boolean;
    readonly brokenOnDay: number | null;
    readonly door: TheDoor;
}
const asRecord = (value: unknown): Record<string, unknown> | null =>
    value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
/** Like provenance wings, structured actual-object data uses one scalar JSON cell. */
function roomChangesOn(vessel: ObjectRecord): Record<string, unknown> {
    const stored=vessel.data?.interiorRooms;
    if (typeof stored!=='string') return {};
    try { return asRecord(JSON.parse(stored)) ?? {}; } catch { return {}; }
}
function changesOn(vessel: ObjectRecord, slotId: string): RoomChanges {
    const raw = asRecord(roomChangesOn(vessel)[slotId]);
    if (!raw) return {};
    return { ...(typeof raw.closed === 'boolean' ? {closed:raw.closed} : {}),
        ...(typeof raw.brokenOnDay === 'number' && Number.isFinite(raw.brokenOnDay) ? {brokenOnDay:raw.brokenOnDay} : {}),
        ...(typeof raw.holderId === 'string' ? {holderId:raw.holderId} : {}),
        ...(typeof raw.keyId === 'string' ? {keyId:raw.keyId} : {}) };
}
export function actualVesselRooms(vessel: ObjectRecord): ActualVesselRoom[] {
    const kind = getConveyance(String(vessel.data?.conveyanceId ?? ''));
    return (kind?.interiorLayout ?? []).map(slot => {
        const changed=changesOn(vessel,slot.id),material=DOOR_MATERIALS[slot.doorMaterial];
        return {vesselId:vessel.id,slot,holderId:changed.holderId ?? vessel.ownerId,
            keyId:changed.keyId ?? null,brokenOnDay:changed.brokenOnDay ?? null,
            closed:changed.brokenOnDay===undefined && (changed.closed ?? slot.initiallyClosed),
            door:{material:slot.doorMaterial,name:'the door of '+slot.name.replace(/^the /,''),
                standsAt:material.standsAt,whose:'yours' as const} };
    });
}
/** A changing room fact is replaced once, on the actual hull; no occupancy copy. */
function withRoomChange(vessel: ObjectRecord, slotId: string, patch: RoomChanges): ObjectRecord {
    const previous=roomChangesOn(vessel);
    return {...vessel,data:{...vessel.data,interiorRooms:JSON.stringify({...previous,[slotId]:{
        ...(asRecord(previous[slotId]) ?? {}),...patch}})}};
}
export function vesselRoomAccess(room: ActualVesselRoom, actorId: string, keyIds: readonly string[]): {
    physicalEntry: boolean; permitted: boolean; mayOpen: boolean;
} {
    const key=room.keyId!==null && keyIds.includes(room.keyId);
    const holder=room.holderId===actorId;
    return {physicalEntry:!room.closed || holder || key,
        permitted:room.slot.access==='public' || holder || key,mayOpen:holder || key};
}
/** No title, key, entry, contents or qi seal changes when the actual slab breaks. */
export function breakVesselRoomDoor(vessel: ObjectRecord, slotId: string,
    input: {strength:number;onDay:number;causeFactId:string}): {vessel:ObjectRecord;force:UnmakingReach} | null {
    const room=actualVesselRooms(vessel).find(one=>one.slot.id===slotId);
    if (!room || room.brokenOnDay!==null || !Number.isFinite(input.onDay) || !input.causeFactId) return null;
    const force=canUnmake(input.strength,room.door.standsAt);
    return force.reaches ? {vessel:withRoomChange(vessel,slotId,{brokenOnDay:input.onDay}),force} : null;
}
/** An actual holder opening/closing leaves a broken door broken. No repair implied. */
export function setVesselRoomDoor(vessel: ObjectRecord, slotId: string, actorId:string,
    keyIds:readonly string[], closed:boolean): ObjectRecord | null {
    const room=actualVesselRooms(vessel).find(one=>one.slot.id===slotId);
    if (!room || room.brokenOnDay!==null || !vesselRoomAccess(room,actorId,keyIds).mayOpen) return null;
    return withRoomChange(vessel,slotId,{closed});
}
/** Only actual current title/custody may grant a room; party agreement is unrelated. */
export function grantVesselRoom(vessel:ObjectRecord,slotId:string,byId:string,toId:string,keyId?:string):ObjectRecord|null {
    if ((vessel.ownerId!==byId && vessel.possessorId!==byId) || !toId
        || !actualVesselRooms(vessel).some(room=>room.slot.id===slotId)) return null;
    return withRoomChange(vessel,slotId,{holderId:toId,...(keyId ? {keyId} : {})});
}
/** Stable physical slot suffix carried by the sole body/activity area field. */
export function vesselRoomAreaId(groundId:string,vesselId:string,slotId:string):string {
    return groundId+'#room#vessel:'+encodeURIComponent(vesselId)+':'+encodeURIComponent(slotId);
}
export function vesselRoomChosen(areaId:string|null|undefined):{vesselId:string;slotId:string}|null {
    const marker='#room#vessel:',at=areaId?.indexOf(marker) ?? -1;
    if (!areaId || at<0) return null;
    const parts=areaId.slice(at+marker.length).split(':');
    if (parts.length!==2) return null;
    try {return {vesselId:decodeURIComponent(parts[0]!),slotId:decodeURIComponent(parts[1]!) };}
    catch {return null;}
}
