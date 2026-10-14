/** A real private hunt hands its actual beast and people to the ordinary shared fight. */
import type { GameService } from './turn-engine.js';
import type { EncounterOccurrence } from '../engine/encounters/types.js';
import { followedParty } from './the-party-you-actually-follow.js';
import { factsWithDataValue, witnessIndexFor } from '../engine/world/witness-reaction-index.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { theyCameAtYou } from './when-somebody-comes-at-you.js';
import { makeFact } from '../engine/world/history.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import { regardFor } from '../engine/cultivation/regard.js';

/** The shared fight closer calls this before clearing its foreground state. */
export function aPrivateHuntEndsWithItsActualFight(game: GameService, partyFightId: string): string[] {
    const world = game.atHand;
    if (!world || !factsWithDataValue(world, 'partyFightEnded', partyFightId).length) return [];
    const ended: string[] = [];
    // A named death or a broken follower binding cannot erase an already fought hunt.
    for (const opened of factsWithDataValue(world, 'partyFightId', partyFightId)) {
        if (typeof opened.data.privateHuntFightOpened !== 'string' || typeof opened.data.partyFightId !== 'string') continue;
        const pending = witnessIndexFor(world).byId.get(opened.data.privateHuntFightOpened);
        if (!pending || typeof pending.data.privateHuntPending !== 'string'
            || factsWithDataValue(world, 'privateHuntResolved', pending.data.privateHuntPending).length
            || !factsWithDataValue(world, 'partyFightEnded', opened.data.partyFightId).length) continue;
        const beast = world.npcs.find(person => person.id === pending.data.beastId);
        appendWorldFact(world, makeFact({ day: routineTime(world), kind: 'opportunity', visibility: 'secret',
            locationId: pending.locationId, causes: [pending.id, opened.id], actors: opened.actors,
            summary: 'The private hunt ended through the actual party fight.',
            data: { privateHuntResolved: pending.data.privateHuntPending, missionWork: pending.data.privateHuntPending,
                finished: !!beast && beast.status !== 'alive' } }), { recur: false, bystanders: false });
        ended.push('The private hunt ended through the actual party fight.');
    }
    if (ended.length) game.theWorldMoved();
    return ended;
}

export function thePrivatePartyHuntsWithThePlayer(game: GameService, allowStart = true): string[] {
    const world = game.atHand, current = game.currentRun();
    if (!world || game.fight) return [];
    const ended = (witnessIndexFor(world).factsByPerson.get(current.cultivator.id) ?? []).flatMap(opened =>
        typeof opened.data.privateHuntFightOpened === 'string' && typeof opened.data.partyFightId === 'string'
            ? aPrivateHuntEndsWithItsActualFight(game, opened.data.partyFightId) : []);
    if (!current.cultivator.alive || !allowStart) return ended;
    const party = followedParty(game.db, world, current.cultivator.id);
    if (!party || party.itinerary.data.privateHunt !== true) return ended;
    const pending = factsWithDataValue(world, 'privateHuntPending', party.itinerary.id)[0];
    if (!pending || pending.day > routineTime(world)) return ended;
    if (factsWithDataValue(world, 'privateHuntResolved', party.itinerary.id).length) return ended;
    if (party.leader.activity?.partyQuestionId) return ended;
    const opened = factsWithDataValue(world, 'privateHuntFightOpened', pending.id)[0];
    if (opened) return ended;
    const route = JSON.parse(String(party.itinerary.data.publicRoute)) as unknown[];
    if (party.leader.activity?.capitalMissionLeg !== route.length) {
        appendWorldFact(world, makeFact({ day: routineTime(world), kind: 'opportunity', visibility: 'secret',
            locationId: party.locationId, causes: [pending.id], actors: [{ id: party.leader.id, name: party.leader.name, role: 'decided' }],
            summary: 'The party turned back before starting the private hunt fight.',
            data: { privateHuntResolved: party.itinerary.id, missionWork: party.itinerary.id, finished: false } }), { recur: false, bystanders: false });
        game.theWorldMoved();
        return ['The party turned back before starting the private hunt fight.'];
    }
    const beast = world.npcs.find(person => person.id === pending.data.beastId && person.status === 'alive' && person.locationId === party.locationId);
    if (!beast) {
        appendWorldFact(world, makeFact({ day: routineTime(world), kind: 'opportunity', visibility: 'secret',
            locationId: party.locationId, causes: [pending.id], actors: [{ id: party.leader.id, name: party.leader.name, role: 'hunter' }],
            summary: 'The hunted beast is no longer on this ground.',
            data: { privateHuntResolved: party.itinerary.id, missionWork: party.itinerary.id, finished: false } }), { recur: false, bystanders: false });
        game.theWorldMoved();
        return [...ended, 'The hunted beast is no longer on this ground.'];
    }
    const regard = regardFor(beast.cultivation.realmOrdinal, current.cultivator.realmOrdinal);
    const occurrence: EncounterOccurrence = { id: 'private-hunt:' + pending.id, entryId: null, kind: 'spirit_beast',
        valence: 'bad', dayOffset: 0, absoluteDay: current.run.elapsedDays, interrupts: true, stance: 'engaged',
        event: { kind: 'encounter', dayOffset: 0, summary: pending.summary, interrupts: true, occurrences: 1, data: { factId: pending.id } },
        deltas: { hp: 0, spiritStones: 0, satiety: 0, rations: 0 }, confrontation: { threatOrdinal: beast.cultivation.realmOrdinal, count: 1,
            stance: 'engaged', damageMultiplier: regard.damageMultiplier, reaction: regard.reaction,
            avoidable: false, engageable: true }, duty: null, scene: null, contact: null, grants: [],
        castIds: [beast.id], source: 'digest' };
    const execution = theyCameAtYou(game, current.run, current.cultivator, game.ambientFor(current.cultivator, current.run),
        { occurrences: [occurrence], firstInterruptDay: current.run.elapsedDays, checks: 1, poolSize: 1 });
    if (!execution) return [];
    const fightId = world.npcs.find(person => person.id === party.leader.id)?.activity?.partyFightId;
    appendWorldFact(world, makeFact({ day: routineTime(world), kind: 'opportunity', visibility: 'secret',
        locationId: party.locationId, causes: [pending.id], actors: [{ id: current.cultivator.id,
            name: current.cultivator.name, role: 'hunter' }], summary: 'The actual private hunt entered shared combat.',
        data: { privateHuntFightOpened: pending.id, partyFightId: fightId ?? null } }), { recur: false, bystanders: false });
    game.theWorldMoved();
    return execution.facts.lines;
}
