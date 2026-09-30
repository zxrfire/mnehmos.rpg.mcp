/** A search lead is told to somebody of the house in the player's area. */
import { whoTheHouseHasLostTrackOf } from '../engine/world/who-a-house-has-lost-track-of.js';
import { theHouseIsToldWhereToLook } from '../engine/world/a-house-sends-somebody-looking.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import { refused } from './tool-result-prose.js';

export function reportWhereTheHouseShouldLook(
    game: GameService, run: Run, cultivator: Cultivator, target?: string, topic?: string
) {
    const world = game.atHand;
    const no = (line: string) => refused('world.theHouseIsToldWhereToLook', 'sect',
        factsForRefusal('No search lead passed on.', line, 'No search changed.'));
    if (!world) return no('There is nobody here to tell.');
    const person = world.npcs.find(n => n.name.toLowerCase() === target?.toLowerCase()
        && game.knowledge.isAwareOf(cultivator.id, 'cultivator', n.id));
    const place = world.locations.find(p => p.name.toLowerCase() === topic?.toLowerCase()
        && game.knowledge.canPointAt(cultivator.id, 'place', p.id));
    if (!person || !place) return no('Name the missing person and a place you can point to.');
    const present = new Set(game.present(cultivator).map(p => p.id));
    const listener = world.npcs.find(n => n.status === 'alive' && present.has(n.id) && n.factionId !== null
        && world.factions.some(h => h.id === n.factionId
            && whoTheHouseHasLostTrackOf(h).some(p => p.personId === person.id)));
    if (!listener || !listener.factionId) return no('Nobody of the house looking for them is in this area.');
    const accepted = theHouseIsToldWhereToLook(world, {
        houseId: listener.factionId, personId: person.id, toldById: cultivator.id,
        heardById: listener.id, locationId: place.id, onDay: Math.floor(world.currentDay)
    });
    if (!accepted) return no('The person hearing your report does not take your word.');
    game.theWorldMoved();
    return game.freeAction(run, 'sect', factsForToolResult('Search lead reported.', [
        `You report ${person.name} at ${place.name}. The house records that place for its search.`
    ]));
}
