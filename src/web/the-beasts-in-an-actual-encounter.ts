/** Literal encountered beasts stand in the existing species and person machinery. */
import { ENCOUNTERS } from '../data/cultivation/encounters.js';
import { getBeast } from '../data/cultivation/beasts.js';
import { standUpTheOneOnThisGround, idOfTheOneOnThisGround, theSpeciesItIs } from '../engine/world/a-beast-with-a-core-is-somebody-in-particular.js';
import { bandOf } from '../engine/world/hunting-a-spirit-beast.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { worldLocationFor } from './entities.js';
import type { EncounterOccurrence } from '../engine/encounters/types.js';
import type { NpcRecord } from '../engine/world/npc-state.js';
import type { GameService } from './turn-engine.js';

export function theEncounterBeasts(game: GameService, occurrence: EncounterOccurrence): NpcRecord[] | null {
    const world = game.atHand;
    if (world && occurrence.kind === 'spirit_beast' && occurrence.source === 'digest' && occurrence.castIds.length) {
        const place = worldLocationFor(world, game.currentRun().cultivator.location)?.id;
        return world.npcs.filter(person => occurrence.castIds.includes(person.id) && person.status === 'alive'
            && person.locationId === place && theSpeciesItIs(person) !== null);
    }
    const speciesId = ENCOUNTERS.find(entry => entry.id === occurrence.entryId)?.beastId;
    const species = speciesId ? getBeast(speciesId) : null;
    const locationId = world && worldLocationFor(world, game.currentRun().cultivator.location)?.id;
    if (!world || !species || !locationId) return null;
    const day = routineTime(world), count = occurrence.confrontation?.count ?? 1;
    const people: NpcRecord[] = [];
    for (let index = 0; index < count; index++) {
        const id = bandOf(species) === 'counted'
            ? `beast-encounter:${occurrence.id}:${locationId}:${day}:${index}`
            : idOfTheOneOnThisGround(species.id, locationId);
        let beast = world.npcs.find(person => person.id === id);
        if (!beast) {
            const made = standUpTheOneOnThisGround({ beast: { ...species,
                ordinal: occurrence.confrontation?.threatOrdinal ?? species.ordinal },
                locationId, seed: world.seed, onDay: day,
                takenNames: new Set(world.npcs.map(person => person.name)) });
            beast = { ...made, id };
            world.npcs.push(beast);
        }
        if (beast.status === 'alive' && !people.some(person => person.id === id)) people.push(beast);
    }
    return people;
}
