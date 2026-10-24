/** Read ordered intent against the same real people, destinations and local areas as play. */
import type { GameService } from './turn-engine.js';
import type { Cultivator } from '../schema/cultivation.js';
import type { PlannedAction } from './planned-action.js';
import type { NpcRecord } from '../engine/world/npc-state.js';
import type { PersonOrder } from '../engine/world/slave-orders.js';
import { routineLocationOf } from '../engine/world/npc-routines.js';
import { theAreasOf } from '../engine/world/where-in-a-place-somebody-is-standing.js';
import { theAreaNamed } from './walking-across-a-place.js';
import { theClausesOf, explicitNameSpansIn } from './a-sentence-can-be-more-than-one-call.js';
import { parseDuration } from './sentence-parts.js';

function kindOf(words: string): PersonOrder['action'] {
    return /\b(?:attack|kill|massacre|slaughter)\b/i.test(words) ? 'attack' : /\bguard\b/i.test(words) ? 'guard'
        : /\b(?:fetch|bring)\b/i.test(words) ? 'fetch' : /\b(?:message|tell|deliver word)\b/i.test(words) ? 'message'
            : /\b(?:follow|accompany|join my party)\b/i.test(words) ? 'company'
                : /\b(?:cultivate|seclude)\b/i.test(words) ? 'cultivate'
                    : /\b(?:go|travel|walk|fly)\b/i.test(words) ? 'travel' : /\bwait\b/i.test(words) ? 'wait' : 'request';
}

export function personOrdersRead(game: GameService, holder: Cultivator, subject: NpcRecord,
    people: readonly NpcRecord[], action: PlannedAction, words: string): { orders: PersonOrder[] } | { reason: string } {
    const world = game.atHand!, orders: PersonOrder[] = [];
    let destinationId = game.worldPlaceOf(holder), areaId: string | undefined;
    const clauses = action.orders ? [] : theClausesOf(words, explicitNameSpansIn(words,
        [...world.locations, ...people, ...world.objects].map(entity => entity.name)));
    // Older readers supply the full spoken order in topic. Apply the existing
    // clause reader inside that speech, never as further acts by the holder.
    const readings = action.orders ?? clauses.map(clause => ({ action: kindOf(clause), words: clause,
        days: parseDuration(clause) ?? (clauses.length === 1 ? action.days : undefined), destination: undefined, target: undefined }));
    if (!readings.length) return { reason: 'State the order and its actual destination.' };
    for (const reading of readings) {
        const said = reading.words.toLowerCase(), destination = reading.destination?.toLowerCase().trim();
        const target = reading.target?.toLowerCase().trim();
        const person = target === 'me' ? people.find(person => person.id === holder.id)
            : target ? people.find(person => person.name.toLowerCase() === target)
                : people.find(person => person.id !== subject.id && said.includes(person.name.toLowerCase()));
        const object = world.objects.find(object => target ? object.name.toLowerCase() === target : said.includes(object.name.toLowerCase()));
        const place = destination === 'me' ? world.locations.find(place => place.id === game.worldPlaceOf(holder))
            : destination ? world.locations.find(place => place.name.toLowerCase() === destination)
                : world.locations.filter(place => said.includes(place.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length)[0];
        const followsTarget = reading.action !== 'wait' && reading.action !== 'guard';
        const personPlace = followsTarget && person && routineLocationOf(world, person);
        const nextId = place?.id ?? (personPlace || null) ?? (object?.locationId as string | null) ?? destinationId;
        const ground = world.locations.find(place => place.id === nextId);
        const areas = ground ? theAreasOf(world, ground) : null;
        const area = areas && (destination && !place
            ? theAreaNamed(areas.areas, destination.replace(/^the\s+/, ''))
            : !destination && !place ? areas.areas.find(area => said.includes(area.name.toLowerCase())) : null);
        if (destination && !place && !area) return { reason: `No actual destination resolves ${reading.destination}.` };
        if (target && !person && !object) return { reason: `No actual target resolves ${reading.target}.` };
        if (reading.action === 'attack' && !place && !person) return { reason: 'Name the actual person or place to attack.' };
        if (reading.action === 'attack' && person && game.repos.cultivators.getById(person.id))
            return { reason: 'That attack must be resolved in the actual person\'s foreground fight.' };
        if (!nextId || !reading.words) return { reason: 'State the order and its actual destination.' };
        areaId = area?.id ?? (person && followsTarget ? areas?.whereIs.get(person.id) : destination === 'me' ? holder.standingIn : undefined)
            ?? (!destination && (!person || !followsTarget) && !place && nextId === destinationId ? areaId : undefined);
        destinationId = nextId;
        orders.push({ action: reading.action, destinationId, words: reading.words, days: reading.days,
            ...(areaId ? { destinationAreaId: areaId } : {}),
            ...(person ? { targetId: person.id } : {}), ...(object ? { objectId: object.id } : {}) });
    }
    return { orders };
}
