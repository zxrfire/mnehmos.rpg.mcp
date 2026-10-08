/** A named durable store object leaves only through its ordinary office/body decision. */
import { pathTo, purposeOf, reachThrough } from '../engine/world/architecture.js';
import { hadAs, isRuined, isTracked, transferPossession } from '../engine/world/possessions.js';
import { type WhatTheyMeanToDo } from '../engine/social-leverage/who-has-to-agree-before-it-leaves-the-store.js';
import { ledgerAbout, type ObligationDb } from '../storage/repos/obligation.repo.js';
import { whatABodyCanCarry, whatAllOfThatTakes } from '../engine/world/what-a-body-can-carry-and-what-a-ring-holds.js';
import { howManyHeld, together, whatTheirThingsTake, whereItWouldGo } from '../engine/world/what-somebody-is-carrying-takes.js';
import { isAVehicle } from '../engine/world/a-vehicle.js';
import { whereInTheHouseItSits } from '../engine/world/what-a-house-keeps-in-its-treasury.js';
import { whereInThisPlaceTheyStand } from '../engine/world/where-in-a-place-somebody-is-standing.js';
import { countedHoldings } from './breaking-a-thing-you-are-holding.js';
import { howThisCultivatorStandsInTheHouseHolding } from './how-this-cultivator-stands-on-this-ground.js';
import { rankIndexOf, theRollsOf } from './walking-up-to-a-house.js';
import { readHouseStoreRequest, receivesTheStoreRequestWhileWorking, decisionForTheHouseStoreRequest } from './reading-a-house-store-request.js';
import { askingAMemberToFetchAStoredObject } from './asking-a-member-to-fetch-a-stored-object.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import { refused } from './tool-result-prose.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

/** Intent says whether it comes back, not whether the house agrees. */
export function meaningOfAStoreRequest(said: string): WhatTheyMeanToDo | null {
    if (!/\b(?:ask|request|petition|borrow|lend|loan|grant|give|gift)\b/i.test(said)) return null;
    if (/\b(?:consume|swallow|melt|use\s+(?:it\s+)?up|spend)\b/i.test(said)) return 'use_it_up';
    if (/\b(?:sell|trade|gift|grant|give|keep|pass\s+(?:it\s+)?on)\b/i.test(said)) return 'pass_it_on';
    return /\b(?:borrow|lend|loan)\b/i.test(said) ? 'use_it_and_return_it' : 'pass_it_on';
}

function namedAs(said: string): string {
    return said.trim().toLowerCase().replace(/[.!?]+$/, '')
        .replace(/^(?:the|a|an)\s+/, '')
        .replace(/^(?:for\s+)?(?:permission\s+)?(?:to\s+)?(?:borrow|loan\s+of|be\s+given|have|receive|keep)\s+/, '')
        .replace(/^(?:the|a|an)\s+/, '');
}

/** Null leaves personal gifts, counted stock and immortal forms on their existing paths. */
export async function askingYourHouseForAStoredObject(game: GameService, run: Run, cultivator: Cultivator,
    whoWasAsked: string, named: string, said: string, askedId?: string): Promise<Execution | null> {
    const meaning = meaningOfAStoreRequest(said);
    if (!meaning || named.trim().length < 3) return null;
    const membership = game.repos.sects.getMembership(cultivator.id);
    if (!membership) return null;
    const world = game.atHand ?? await game.loadWorld();
    if (!world) return null;
    const house = world.factions.find(h => h.id === membership.sectId && h.dissolvedOnDay === null);
    if (!house) return null;
    const asked = askedId ? world.npcs.find(n => n.id === askedId) : null;
    const namedHouse = askedId ? null : game.factionMeant(whoWasAsked, cultivator);
    if (askedId ? asked?.factionId !== house.id : namedHouse?.id !== house.id) return null;

    const object = world.objects.find(row => namedAs(row.name) === namedAs(named)
        && row.ownerId === house.id
        && isTracked(row) && !isRuined(row) && row.data.spent !== true
        && (row.kind === 'artifact' || row.kind === 'manual' || row.kind === 'key') && !isAVehicle(row)
        && !row.tags.includes('never-carried') && !row.tags.includes('single-use'));
    if (!object) return null;
    const no = (headline: string, line: string, detail: string) => refused('world.whetherItLeavesTheStore', 'request',
        factsForRefusal(headline, line, `${detail} Nothing moved or paid.`));
    const groundId = game.worldPlaceOf(cultivator);
    const carriedBy = object.possessorId !== null && object.possessorId !== house.id
        ? object.possessorId : null;
    // A key refers to its actual lock; no second room/office is stored on it.
    const room = object.kind === 'key' && typeof object.data.keyId === 'string'
        ? world.locations.find(p => p.data.keyId === object.data.keyId && p.controllingFactionId === house.id)
        : carriedBy !== null
            ? world.locations.find(p => p.controllingFactionId === house.id &&
                purposeOf(p) === whereInTheHouseItSits(object.kind, object.significance, object.tags))
            : world.locations.find(p => p.id === object.locationId);
    const purpose = room ? purposeOf(room) : null;
    // Only an explicit fetch act starts staff work; ordinary asks/looks retain their route/refusal.
    if (carriedBy === null && room && purpose !== null && groundId !== room.id
        && /\b(?:fetch|bring|retrieve)\b/i.test(said))
        return askingAMemberToFetchAStoredObject(game, run, cultivator, world, house, object, meaning, askedId);
    if (!room || purpose === null || (carriedBy === null && groundId !== room.id)) return no('The object is not here to hand over.',
        'Collection requires the actual storage room and its ordinary door access. Asking from elsewhere does not fetch it.',
        'The player is not at this object\'s physical storage room; no staff-fetch route was performed.');
    if (carriedBy === null && typeof object.data.areaId === 'string' && object.data.areaId !==
        whereInThisPlaceTheyStand(world, room, cultivator.standingIn, cultivator.sectId).id)
        return no('The object is not in this area.', 'Being in the same building does not reach another private area.',
            'Stored object area differs from the player\'s actual area.');
    const { access } = howThisCultivatorStandsInTheHouseHolding({ ground: room, cultivator,
        standing: { sectId: house.id, rankIndex: rankIndexOf(game, cultivator.id, house.ranks.length), rankCount: house.ranks.length,
            joinedOnDay: membership.joinedOnDay }, onDay: Math.floor(world.currentDay), objects: world.objects });
    const reach = reachThrough(pathTo(world.locations, room.id), access);
    if (carriedBy === null && (reach.stoppedAt !== null || reach.level === 'barred')) return no('The storage door does not admit collection.',
        reach.reason, 'Store permission does not grant a key or waive the existing access chain.');

    const reading = readHouseStoreRequest(world, house, cultivator.id, purpose, theRollsOf(game));
    const mouth = game.present(cultivator).find(person =>
        (!askedId || person.id === askedId)
        && receivesTheStoreRequestWhileWorking(world, house.id, person.id, reading, carriedBy));
    if (!mouth) return no('Nobody here receives the store request.',
        carriedBy === null ? 'Ask the member who holds or works in this room while they are here doing its work.'
            : 'Ask the actual person carrying it while they are here doing their work.',
        'No actual present eligible receiving member; no absent committee was voiced.');
    const lands = whereItWouldGo(together(whatAllOfThatTakes(countedHoldings(game.db, cultivator.id)),
        whatTheirThingsTake(world.objects, cultivator.id)), object, whatABodyCanCarry(cultivator.realmOrdinal),
        howManyHeld(world.objects, cultivator.id));
    if (lands === 'too_heavy' || lands === 'hands_full') return no('You cannot carry it.',
        lands === 'too_heavy' ? 'Its weight exceeds what this body can carry.' : 'It will not fit and both hands are full.', lands);
    const decision = decisionForTheHouseStoreRequest(reading, object, meaning,
        ledgerAbout(game.db as unknown as ObligationDb, cultivator.id), Math.floor(world.currentDay));
    if (!decision.allowed) return no('The house does not release it.',
        'The request was received here, but the house\'s existing store decision refused it.', decision.line);
    const at = world.objects.findIndex(o => o.id === object.id);
    world.objects[at] = hadAs({ ...transferPossession(object, { onDay: Math.floor(world.currentDay),
        toHolderId: cultivator.id, toHolderName: cultivator.name,
        how: meaning === 'use_it_and_return_it' ? 'lent' : 'gifted',
        transfersOwnership: meaning !== 'use_it_and_return_it', source: house.name,
        note: `Received through its ${purpose} office. ${decision.line}` }), locationId: groundId }, lands);
    game.theWorldMoved();
    const facts = factsForToolResult('The stored object is handed over.', [
        `${object.name} is ${meaning === 'use_it_and_return_it' ? 'lent to you; it remains the house\'s property and must be returned' : 'given to you; ownership is transferred'}.`,
    ]);
    facts.structure.push(`${decision.line} Object ${object.id} retained; no price, contribution or new obligation. Approval is an authority result, not dialogue from absent deciders.`);
    return { ...game.freeAction(run, 'request', facts), calls: [{ name: 'world.whetherItLeavesTheStore', action: 'request',
        summary: `${object.name}: ${decision.line} ${meaning}. Same object moved into ${lands}.`, ok: true }] };
}
