/** A cabin door is part of the current real hull, not a shore-room name. */
import type { Cultivator,Run } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';
import { actualCarrierScene,areasOfActualCarrier } from './the-actual-carrier-scene.js';
import { targetNameForDoorDestruction } from './trying-to-break-an-actual-vault-lock.js';
import { asARoomIsNamed } from './walking-inside-the-walls.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { breakVesselRoomDoor,vesselRoomChosen } from '../engine/world/rooms-in-a-vessel.js';
import { canUnmake } from '../engine/cultivation/whether-a-weapon-survives-being-used.js';
import { whatTheyCouldBreakADoorWith } from './who-comes-to-settle-an-account.js';
import { makeFact } from '../engine/world/history.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import { factsForRefusal,factsForToolResult } from './facts.js';
import { refused } from './tool-result-prose.js';
export async function tryingToBreakAnActualCabinDoor(game:GameService,run:Run,
    supplied:Cultivator,said:string):Promise<Execution|null> {
    const named=targetNameForDoorDestruction(said);
    if (!named) return null;
    const body=game.repos.cultivators.getById(supplied.id),world=game.atHand;
    if (!body || !world) return null;
    const carrier=actualCarrierScene(game.repos,body,world,routineTime(world));
    if (!carrier) return null;
    const wanted=asARoomIsNamed(named);
    const rooms=carrier.rooms.filter(room=>asARoomIsNamed(room.slot.name)===wanted);
    if (rooms.length!==1) return null;
    const room=rooms[0]!,read=areasOfActualCarrier(world,carrier,body);
    const area=read?.areas.find(one=>one.id===body.standingIn);
    const inside=vesselRoomChosen(body.standingIn);
    const reject=(line:string)=>refused('engine.actualCabinDoor','destroy',factsForRefusal(
        line,line,'No hull damage, entry, title, key, goods or fare change.'));
    if (area?.for!=='deck' && !(inside?.vesselId===carrier.vesselId && inside.slotId===room.slot.id))
        return reject('Reach this cabin door from the actual deck or its own cabin first.');
    if (room.brokenOnDay!==null) return reject('That actual cabin door is already broken.');
    const vessel=world.objects.find(one=>one.id===carrier.vesselId);
    if (!vessel) return reject('No actual vessel object holds this cabin door.');
    const strength=whatTheyCouldBreakADoorWith(world,body),force=canUnmake(strength,room.door.standsAt);
    if (!force.reaches) return reject(force.cause);
    const onDay=routineTime(world);
    const fact=appendWorldFact(world,makeFact({day:onDay,kind:'object_destroyed',
        summary:body.name+' broke '+room.door.name+'.',
        actors:[{id:body.id,name:body.name,role:'actor'}],locationId:carrier.locationId,
        place:world.locations.find(one=>one.id===carrier.locationId)?.name ?? body.location,
        factionIds:[],data:{vesselId:vessel.id,interiorSlotId:room.slot.id,
            brokeWhat:room.door.name,doorMaterial:room.door.material,doorStandsAt:room.door.standsAt}}),{recur:false});
    const changed=breakVesselRoomDoor(vessel,room.slot.id,{strength,onDay,causeFactId:fact.id});
    if (!changed) throw new Error('Fresh validated cabin force failed its synchronous commit.');
    world.objects[world.objects.indexOf(vessel)]=changed.vessel;
    game.theWorldMoved();
    return game.freeAction(run,'destroy',factsForToolResult('The actual cabin door is broken.',
        [force.cause,'No cabin entry, key, room grant, vessel title or goods transfer occurred.']));
}
