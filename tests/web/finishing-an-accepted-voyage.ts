import type { GameService } from '../../src/web/turn-engine.js';
import { shipPassengerAt } from '../../src/engine/world/passenger-on-a-vessel.js';
import { journeyTimeHasReached } from '../../src/engine/world/places-on-the-way.js';
import { passHours } from '../../src/web/routine-invitations.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { theVoyageUnderWay } from '../../src/web/a-ship-at-sea.js';
import { worldLocationFor } from '../../src/web/entities.js';
import { expect } from 'vitest';
import { theFightStillStands } from '../../src/web/fight-answers.js';

/** The caller explicitly continues the accepted voyage, not a second booking.
 * Remaining time comes from the actual dated course. Each native portion must
 * consume positive time; refusal, death or loss fail honestly. A caller testing
 * the crew can follow a captain's actual reroute; an arrival control stays strict.
 * No encounter is disabled and no endpoint or clock is assigned by this helper. */
export async function finishTheAcceptedVoyage(game:GameService,expectedPort:string,followActualCourse=false):Promise<string[]> {
    let now=game.currentRun();
    if(now.cultivator.location===expectedPort)return [];
    const lines: string[] = [];
    const world=game.atHand!,claim=theVoyageUnderWay(game.db,now.cultivator);
    if(!claim?.receiptId)throw Error('The stopped return has no actual accepted receipt.');
    const receiptId=claim.receiptId,expected=worldLocationFor(world,expectedPort);
    if(!expected)throw Error('The actual return port is unavailable.');
    const purse=now.cultivator.spiritStones;
    const boardings = new Set(world.history.facts.filter(fact => fact.data.actualBoarding === true
        && fact.data.runId === now.run.id && fact.actors.some(actor => actor.id === now.cultivator.id))
        .map(fact => fact.id));
    let source=shipPassengerAt(world,receiptId,routineTime(world));
    if(!source)throw Error('The actual return course cannot be read.');
    const vesselId=source.vesselId;
    while(!source.arrived){
        expect(now.cultivator.alive,'Actual death cannot be completed into an arrival.').toBe(true);
        expect(now.run.status).toBe('active');
        expect(theFightStillStands(game.fight, now.run.id, now.cultivator.id),
            'An actual held fight needs its own answer before the voyage can continue.').toBe(false);
        expect(source.unavailable).toBeNull();
        if(!followActualCourse)expect(source.toId,'A real changed course is not the requested return.').toBe(expected.id);
        expect(Number.isFinite(source.remainingDays)&&source.remainingDays>0).toBe(true);
        const before=now,day=routineTime(world),remaining=source.remainingDays;
        const continued=await passHours(game,before.run,before.cultivator,remaining*24);
        lines.push(...(continued.spent?.facts.lines ?? []));
        now=game.currentRun();
        const after=shipPassengerAt(world,receiptId,routineTime(world));
        expect(continued.spent?.outcome,JSON.stringify(continued.spent?.calls)).not.toBe('refused');
        expect(now.cultivator.alive).toBe(true);
        expect(now.run.elapsedDays>before.run.elapsedDays,'No real progress: the interruption needs an actual player decision.').toBe(true);
        expect(routineTime(world)>day).toBe(true);
        expect(now.cultivator.spiritStones, JSON.stringify(continued.spent?.facts.lines))
            .toBeGreaterThanOrEqual(purse);
        expect(world.history.facts.filter(fact => fact.data.actualBoarding === true
            && fact.data.runId === now.run.id && fact.actors.some(actor => actor.id === now.cultivator.id))
            .map(fact => fact.id)).toEqual([...boardings]);
        if(!after)throw Error('The actual accepted return disappeared before arrival.');
        expect(after.vesselId).toBe(vesselId);
        if(!followActualCourse)expect(after.toId).toBe(expected.id);
        source=after;
        const held=theVoyageUnderWay(game.db,now.cultivator);
        if(!source.arrived)expect(held?.receiptId).toBe(receiptId);
    }
    expect(journeyTimeHasReached(routineTime(world),source.arrivalDay)).toBe(true);
    const actualPort=world.locations.find(location=>location.id===source.toId);
    expect(actualPort,'The arrived course has a real port.').toBeDefined();
    expect(now.cultivator.location).toBe(followActualCourse?actualPort!.name:expectedPort);
    return lines;
}
