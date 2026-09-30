import { openHandednessOf } from '../social-leverage/how-freely-somebody-parts-with-what-they-have.js';
import { useAFurnaceTechnique, oldEnoughForTheRite } from '../social-leverage/an-art-that-needs-two-people.js';
import { getTechnique } from '../../data/cultivation/index.js';
import { forStream } from '../cultivation/rng.js';
import { drawnOffMultiplierOf, physiqueOrNull } from '../cultivation/physiques.js';
import { ageInYears, isTheWorldsToMove } from './npc-state.js';
import { consumePrimalEssence, primalEssenceOf } from './primal-essence.js';
import { aChildIsConceived, DAYS_A_CHILD_IS_CARRIED } from './a-child-an-act-conceived.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { makeFact } from './history.js';
import type { WorldState } from './world-state.js';

/** People holding both halves may offer a rite during the world's ordinary year. */
export function offeredRitesThisYear(world: WorldState, day: number): void {
    const year = Math.floor(day / 365);
    const eligible = world.npcs.filter(npc => npc.status === 'alive' && isTheWorldsToMove(npc)
        && oldEnoughForTheRite(ageInYears(npc, day)));
    for (const actor of eligible) {
        if (!actor.cultivation.techniqueIds.some(id => getTechnique(id)?.runsOn === 'the_others')) continue;
        const subject = eligible.find(npc => npc.id !== actor.id && npc.locationId !== null
            && npc.locationId === actor.locationId && npc.identity.sex !== actor.identity.sex
            && npc.cultivation.techniqueIds.some(id => getTechnique(id)?.runsOn === 'own_lifespan')
            && (npc.relationships.find(tie => tie.targetId === actor.id)?.standing ?? 0) > 0);
        if (!subject) continue;
        const standing = subject.relationships.find(tie => tie.targetId === actor.id)!.standing;
        if (forStream(world.seed, 'world-furnace-offer', subject.id, year).next() >= 0.04 * standing * (1 + openHandednessOf(subject.id))) continue;
        const outcome = useAFurnaceTechnique({ actor: { personId: actor.id, name: actor.name, sex: actor.identity.sex },
            subjects: [{ personId: subject.id, name: subject.name, sex: subject.identity.sex,
                conceptionSample: forStream(world.seed, 'world-furnace-conception', subject.id, year).next(),
                deathSample: 1, drawnOff: drawnOffMultiplierOf(physiqueOrNull(subject.identity.physique))
                    * (primalEssenceOf(subject) === null ? 1 : 2) }], type: 'offered', onDay: day });
        if (!outcome.happened) continue;
        for (const person of [actor, subject]) consumePrimalEssence(world, person.id, day);
        for (const [person, delta] of [[actor, -outcome.daysStolen], [subject, outcome.daysStolen]] as const) {
            const at = world.npcs.findIndex(npc => npc.id === person.id);
            const live = world.npcs[at]!;
            world.npcs[at] = { ...live, cultivation: { ...live.cultivation,
                accumulatingSinceDay: Math.min(day, live.cultivation.accumulatingSinceDay + delta) } };
        }
        if (outcome.each[0]!.conceived) aChildIsConceived(world, {
            carrierId: subject.identity.sex === 'female' ? subject.id : actor.id,
            otherParentId: subject.identity.sex === 'female' ? actor.id : subject.id, dueOnDay: day + DAYS_A_CHILD_IS_CARRIED });
        appendWorldFact(world, makeFact({ day, kind: 'grudge_opened', locationId: subject.locationId,
            visibility: 'secret', summary: outcome.line, causeKnown: true,
            actors: [{ id: actor.id, name: actor.name, role: 'actor' }, { id: subject.id, name: subject.name, role: 'subject' }],
            witnessIds: [actor.id, subject.id], data: { furnace: true, type: 'offered' } }));
    }
}
