/** Explicit actual staff request; no automatic fetch for a stock look. */
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { ObjectRecord } from '../engine/world/possessions.js';
import { purposeOf } from '../engine/world/architecture.js';
import { setLocation } from '../engine/world/npc-state.js';
import { prepareWorldClockForPreciseSpan } from '../server/state/cultivation-world.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import { makeFact } from '../engine/world/history.js';
import { preparePhysicalRetrieval, startPhysicalRetrieval } from '../engine/world/fetching-an-object-from-a-house-store.js';
import type { WhatTheyMeanToDo } from '../engine/social-leverage/who-has-to-agree-before-it-leaves-the-store.js';
import { whereTheyAreStanding, whereCompoundsAre } from '../engine/world/where-inside-a-house-somebody-is-standing.js';
import { ledgerAbout, type ObligationDb } from '../storage/repos/obligation.repo.js';
import { theRollsOf } from './walking-up-to-a-house.js';
import { countedHoldings } from './breaking-a-thing-you-are-holding.js';
import { readHouseStoreRequest, receivesTheStoreRequestWhileWorking } from './reading-a-house-store-request.js';
import { authorityForPhysicalRetrieval } from './reading-the-person-and-store-at-a-retrieval-boundary.js';
import { theAreaTheyAreIn } from './walking-across-a-place.js';
import { refused } from './tool-result-prose.js';
import { factsForRefusal, factsForToolResult } from './facts.js';

/** Already-resolved existing exact object/house/meaning, supplied by the direct handler. */
export async function askingAMemberToFetchAStoredObject(game: GameService, run: Run, cultivator: Cultivator,
    world: WorldState, house: WorldState['factions'][number], object: ObjectRecord,
    meaning: WhatTheyMeanToDo, askedId?: string): Promise<Execution> {
    const no = (line: string) => refused('world.physicalStoreRetrieval', 'request',
        factsForRefusal('The retrieval does not start.', line, 'No object moved and no staff journey started.'));
    // Promote prior displayed time BEFORE accepting a new actual journey.
    game.atHand = world = await prepareWorldClockForPreciseSpan(run, cultivator);
    run = game.repos.runs.getById(run.id) ?? run;
    // Promotion may have changed current stock/house authority; keep ids only.
    const freshHouse = world.factions.find(h => h.id === house.id && h.dissolvedOnDay === null);
    const freshObject = world.objects.find(o => o.id === object.id);
    if (!freshHouse || !freshObject) return no('The actual house or stored object is unavailable.');
    house = freshHouse;
    object = freshObject;
    const physical = game.repos.cultivators.getById(cultivator.id);
    const here = physical ? theAreaTheyAreIn(world, physical) : null;
    const room = world.locations.find(l => l.id === object.locationId);
    const purpose = room ? purposeOf(room) : null;
    if (!physical?.alive || !here || !room || purpose === null
        || (object.possessorId !== null && object.possessorId !== house.id))
        return no('The actual body, stored object or storage destination is unavailable.');
    const reading = readHouseStoreRequest(world, house, physical.id, purpose, theRollsOf(game));
    const mouth = game.present(physical).find(person => (!askedId || person.id === askedId)
        && receivesTheStoreRequestWhileWorking(world, house.id, person.id, reading, null));
    const staff = mouth ? world.npcs.find(n => n.id === mouth.id) : null;
    if (!staff) return no('Ask the actual member who holds or works in this store while they are here doing their work.');
    const source = whereTheyAreStanding(world, whereCompoundsAre(world), staff, new Set(world.npcs.map(n => n.id)));
    if (source !== here.place.id) return no('The actual receiving member is not at this physical meeting.');
    const onDay = routineTime(world);
    const authority = authorityForPhysicalRetrieval({
        rollRowFor: id => game.repos.sects.getMembership(id),
        ledgerFor: id => ledgerAbout(game.db as unknown as ObligationDb, id),
        countedFor: id => countedHoldings(game.db, id),
        // This callback rereads, never captures the sheet. Boundary binding uses
        // the currently advancing run id in exactly the same way after projection.
        playedBodyAt: id => id === physical.id ? game.repos.cultivators.getById(id) ?? null : undefined
    });
    const lands = authority.packing(world, physical.id, object, onDay);
    if (!lands.allowed) return no(lands.reason);
    // A canonical physical projection becomes only the journey's historical departure.
    const carrier = setLocation(staff, source, onDay);
    const intent = { requesterId: physical.id, carrierId: staff.id, objectId: object.id, houseId: house.id,
        storeId: room.id, meetingId: here.place.id, meetingAreaId: here.area.id, meaning };
    const prepared = preparePhysicalRetrieval(world, carrier, intent, onDay, authority);
    if (!prepared) return no('The present member cannot undertake this request through the actual store decision, keys, route and carrying capacity.');
    // No await or clock movement between preparation, real fact id and binding.
    const accepted = appendWorldFact(world, prepared);
    const delta = startPhysicalRetrieval(world, carrier, accepted, onDay, authority);
    const departing = delta.people.find(p => p.id === staff.id);
    if (!departing) {
        appendWorldFact(world, makeFact({ day: onDay, kind: 'gathering', causes: [accepted.id],
            actors: [{ id: staff.id, name: staff.name, role: 'carrier' }],
            summary: 'The retrieval authority changed before departure; no journey started.',
            data: { retrievalRequestId: accepted.id, retrievalClosed: true } }));
        game.theWorldMoved();
        return no('The current authority changed before departure. No retrieval undertaking remains.');
    }
    const index = world.npcs.findIndex(n => n.id === staff.id);
    world.npcs[index] = departing;
    game.theWorldMoved();
    const facts = factsForToolResult('The retrieval has started.', [
        `The actual receiving member has set out to fetch ${object.name}; it has not been handed over.`,
        'The object remains in its actual store until collection. Delivery requires your real presence and carrying capacity.'
    ]);
    facts.structure.push(`Actual request ${accepted.id}; same object ${object.id}; ordinary journey deadline ${departing.activity?.untilDay}. No stock reservation or new price.`);
    return { ...game.freeAction(run, 'request', facts), calls: [{ name: 'world.physicalStoreRetrieval',
        action: 'request', summary: 'Actual working member started the requested ordinary journey; no object granted yet.', ok: true }] };
}
