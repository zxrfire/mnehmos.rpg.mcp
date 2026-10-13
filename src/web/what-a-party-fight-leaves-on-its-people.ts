import { theSpeciesItIs } from '../engine/world/a-beast-with-a-core-is-somebody-in-particular.js';
import { asItStandsNow } from '../engine/world/a-beast-climbs-by-sitting-where-it-is.js';
import { aPieceOfABodyNobodyHasTaken, whatIsWorthARowOffABody } from '../engine/world/a-beast-that-climbs-also-fights-and-dies.js';
/** A played group fight writes the actual bodies, wounds, deaths and broken gear. */
import type { GameService } from './turn-engine.js';
import type { CombatantInput, MeleeResult } from '../engine/cultivation/combat.js';
import { OUTCOME_FOR_FATE } from '../engine/cultivation/combat.js';
import { bodyStandingOn, bodyTaken, maxBodyOf } from '../engine/world/npc-state.js';
import { whatTheConfrontationDidToThem, whatTheirFlightsCost }
    from '../engine/world/what-a-confrontation-does-to-somebody-the-world-holds.js';
import { isBroken, whatAFightMarked, writeBackWhatAFightLeft } from '../engine/world/object-damage.js';
import { aBreakingEntersTheWorld } from '../engine/world/a-thing-somebody-ended-is-a-fact.js';
import { isRuined } from '../engine/world/possessions.js';
import { createObligation } from '../engine/social/grudges.js';
import { writeOneObligation } from '../storage/repos/obligation.repo.js';
import type { DatabaseHandle } from './encounters.js';

export function whatAPlayedGroupFightLeft(game: GameService, result: MeleeResult,
    participants: readonly CombatantInput[], day: number, locationId: string | null): { lines: string[]; dead: string[] } {
    const world = game.atHand;
    if (!world) return { lines: [], dead: [] };
    const bodies = new Map(participants.map(person => [person.id, person]));
    const lines: string[] = [], dead: string[] = [];
    for (const outcome of result.combatants) {
        if (outcome.id === game.currentRun().cultivator.id) continue;
        const at = world.npcs.findIndex(person => person.id === outcome.id && person.status === 'alive');
        const input = bodies.get(outcome.id);
        if (at < 0 || !input) continue;
        const opponent = outcome.felledBy ? bodies.get(outcome.felledBy) : participants.find(person =>
            result.combatants.find(row => row.id === person.id)?.sideId !== outcome.sideId);
        const journeyLocation = world.npcs[at]!.locationId;
        if (locationId) world.npcs[at] = { ...world.npcs[at]!, locationId };
        const did = whatTheConfrontationDidToThem(world, { npcId: outcome.id,
            byId: opponent?.id ?? outcome.sideId, byName: opponent?.name ?? 'the other side', day,
            wounds: outcome.injuries, outcome: OUTCOME_FOR_FATE[outcome.fate],
            lost: outcome.felledBy != null, finished: outcome.finished, terms: 'open',
            flight: whatTheirFlightsCost(result.exchanges, outcome.id, input.maxHp),
            witnesses: Math.max(0, participants.length - 2) });
        lines.push(...did.lines);
        for (const obligation of did.opens)
            writeOneObligation(game.db as unknown as DatabaseHandle, createObligation(obligation));
        const current = world.npcs[at]!;
        if (did.died) {
            dead.push(current.id);
            const species = theSpeciesItIs(current);
            if (species && locationId) for (const material of whatIsWorthARowOffABody(species)) {
                const object = aPieceOfABodyNobodyHasTaken({ npcId: current.id, material,
                    asItStands: asItStandsNow(species, current.cultivation.realmOrdinal), itsName: current.name,
                    locationId, placeName: world.locations.find(place => place.id === locationId)?.name ?? locationId,
                    onDay: day, endedBy: 'Killed in the party fight.' });
                if (!world.objects.some(row => row.id === object.id)) world.objects.push(object);
            }
        }
        else if (current.status === 'alive') {
            const left = Math.max(0, outcome.hp) * maxBodyOf(current) / input.maxHp;
            world.npcs[at] = { ...bodyTaken(current, Math.max(0, bodyStandingOn(current, day) - left), day),
                locationId: journeyLocation };
        }
    }
    const broken = new Set<string>();
    for (const exchange of result.exchanges) {
        const weapon = exchange.result.weapon;
        if (!weapon?.broke || broken.has(weapon.objectId)) continue;
        broken.add(weapon.objectId);
        const object = world.objects.find(row => row.id === weapon.objectId);
        if (!object || isBroken(object) || isRuined(object)) continue;
        aBreakingEntersTheWorld(world, { actor: { id: exchange.attackerId,
            name: bodies.get(exchange.attackerId)?.name ?? 'somebody', role: 'broke it' }, object, day,
            locationId: object.locationId ?? locationId, how: weapon.exposure.cause });
    }
    writeBackWhatAFightLeft(world.objects, whatAFightMarked(result.exchanges), {
        onDay: day, fight: 'a fight beside the player', nameOf: id => bodies.get(id)?.name ?? 'somebody' });
    return { lines, dead };
}
