/** The SQL body walks the same real doors and local distance as world people. */
import type { GameService } from './turn-engine.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { readActualDepartureApproach, beginActualDepartureApproach } from '../engine/world/departure-approach.js';
import { LOCAL_WALK_DAYS } from '../engine/world/local-walking-cost.js';
import { getNpc } from '../engine/world/world-state.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { worldLocationFor } from './entities.js';
import { passHours } from './routine-invitations.js';
import { factsForRefusal } from './facts.js';
import { refused } from './tool-result-prose.js';
import type { Execution } from './turn-wire-shapes.js';
import { actualCarrierScene } from './the-actual-carrier-scene.js';

export async function walkToTheDeparture(game: GameService, run: Run, body: Cultivator,
    locationId: string, areaId: string | null, vesselId?: string, companionIds: readonly string[]=[]): Promise<Execution|null> {
    const initial = game.atHand;
    const original = initial && getNpc(initial, body.id);
    if (!initial || !original) return null;
    let world = initial;
    const request = { intentId: 'departure:' + run.id + ':' + run.turn, target: { locationId, areaId, vesselId } };
    const actor = (current: Cultivator) => {
        const carrier=actualCarrierScene(game.repos,current,world,routineTime(world));
        const operator=carrier&&world.npcs.find(person=>person.id===carrier.operatorId);
        return ({ ...original, status: current.alive ? 'alive' as const : 'physically_dead' as const,
        cultivation: {...original.cultivation,realmOrdinal:current.realmOrdinal},
        locationId: worldLocationFor(world, current.location)?.id ?? null,
        activity: { kind: 'idle' as const, note: 'Preparing to depart.', withIds: [],
            sinceDay: routineTime(world), untilDay: routineTime(world),
            ...(carrier&&operator?.activity?operator.activity:{}), standingIn: current.standingIn } });
    };
    const read = readActualDepartureApproach(world, body.id, request, routineTime(world), actor(body));
    const companions=companionIds.filter(id=>id!==body.id).map(id=>({id,
        read:readActualDepartureApproach(world,id,request,routineTime(world))}));
    const absent=companions.find(one=>!['ready','already_aboard','local_walk'].includes(one.read.kind));
    if(absent)return refused('engine.departureApproach','move',factsForRefusal('A traveller cannot reach the departure point.',
        absent.read.kind==='refused'?absent.read.reason:'The traveller needs another geographic journey.',
        'No body, boarding or payment changed.'));
    const gathering=companions.filter(one=>one.read.kind==='local_walk');
    if ((read.kind === 'ready' || read.kind === 'already_aboard')&&!gathering.length) return null;
    if(read.kind==='needs_geographic_leg'){
        const ground=world.locations.find(place=>place.id===read.fromId)!;
        const walkedOut=await walkToTheDeparture(game,run,body,ground.id,null);
        if(walkedOut)return walkedOut;
        let current=game.currentRun();
        const destination=world.locations.find(place=>place.id===read.toId)!;
        const reached=await game.move(current.run,current.cultivator,game.ambientFor(current.cultivator,current.run),destination.name,'travel');
        if(reached.outcome==='refused'||reached.cutShort)return reached;
        current=game.currentRun();
        if(current.cultivator.location!==destination.name)return reached;
        return walkToTheDeparture(game,current.run,current.cultivator,locationId,areaId,vesselId);
    }
    if (read.kind !== 'local_walk'&&read.kind!=='ready'&&read.kind!=='already_aboard') return refused('engine.departureApproach', 'move', factsForRefusal(
        read.kind === 'refused' ? read.reason : 'The departure point requires a geographic journey.',
        'No boarding or payment occurred.', 'The actual departure path is unavailable.'));
    for(const one of gathering){
        const approach=beginActualDepartureApproach(world,one.id,request,routineTime(world));
        if(approach.kind!=='approaching')throw Error('Validated companion approach changed synchronously');
        const at=world.npcs.findIndex(person=>person.id===one.id);
        world.npcs[at]={...approach.actor,activity:{...approach.actor.activity!,departureApproach:{locationId,
            areaId,destinationId:locationId,purpose:'Gathering to board.',service:'gather'}}};
    }
    const passed = await passHours(game, run, body, LOCAL_WALK_DAYS * 24);
    if (!passed.finished && passed.spent) return passed.spent;
    world = game.atHand ?? world;
    const current = game.currentRun().cultivator;
    if (!current.alive || current.location !== body.location || current.standingIn !== body.standingIn)
        return refused('engine.departureApproach', 'move', factsForRefusal('The departure walk was interrupted.',
            'The traveller no longer occupies its original departure.', 'No boarding or payment occurred.'));
    const fresh = readActualDepartureApproach(world, body.id, request, routineTime(world), actor(current));
    if(companions.some(one=>!['ready','already_aboard'].includes(
        readActualDepartureApproach(world,one.id,request,routineTime(world)).kind)))return refused('engine.departureApproach','move',
            factsForRefusal('The gathering was interrupted.','An actual traveller has not reached the departure point.',
                'No boarding or payment occurred.'));
    if (fresh.kind === 'already_aboard') return null;
    if (fresh.kind !== 'ready' && fresh.kind !== 'local_walk') return refused('engine.departureApproach', 'move',
        factsForRefusal(fresh.kind === 'refused' ? fresh.reason : 'The departure point is unavailable.',
            'No boarding or payment occurred.', 'Access changed during the departure walk.'));
    const ground = world.locations.find(place => place.id === locationId)!;
    game.repos.cultivators.update(body.id, { location: ground.name });
    game.repos.cultivators.standIn(body.id, areaId);
    game.theyArrivedWithYou(game.currentRun().cultivator, ground.name);
    return null;
}
