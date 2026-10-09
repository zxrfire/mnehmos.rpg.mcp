import { anArtThatCanBeUsedInAFight } from '../cultivation/an-art-that-can-be-used-in-a-fight.js';
/** NPC fights read the same finite qi and art cooldowns as an actual launch.
 * Pricing is free. Numeric exchange receipts, never prose, write each cast
 * once; an existing chronicle reference supplies replay identity. */
import type { CombatantInput, ExchangeRecord } from '../cultivation/combat.js';
import type { WorldState } from './world-state.js';
import type { NpcRecord } from './npc-state.js';
import { maxQiOf, qiStandingOn, isTheWorldsToMove } from './npc-state.js';
import { getTechnique } from '../../data/cultivation/techniques.js';
import { npcArtReadiness, useAnNpcArt } from './the-arts-an-npc-has-spent.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { makeFact } from './history.js';
import { witnessIndexFor } from './witness-reaction-index.js';

export function npcCombatArts(npc: NpcRecord, day: number): Pick<CombatantInput,
    'qi'|'maxQi'|'technique'|'techniqueCooldowns'|'insights'> {
    let technique: CombatantInput['technique'] = null;
    for (const id of npc.cultivation.techniqueIds) {
        const art = getTechnique(id);
        if (!art || !anArtThatCanBeUsedInAFight(art) || art.requiredOrdinal > npc.cultivation.realmOrdinal || npcArtReadiness(npc,id,day)) continue;
        if (!technique || art.requiredOrdinal > technique.requiredOrdinal) technique = art;
    }
    return { qi: qiStandingOn(npc,day), maxQi: maxQiOf(npc), technique, insights: npc.cultivation.insights ?? [],
        techniqueCooldowns: npc.cultivation.techniqueCooldowns ?? {} };
}

export function writeTheNpcArtsActuallyUsed(world: WorldState,
    exchanges: readonly ExchangeRecord[], fightId: string, day: number): void {
    for (const exchange of exchanges) {
        const use = exchange.artUse;
        if (!use) continue;
        const key = fightId+':'+exchange.attackerId+':'+exchange.index;
        if ([...(witnessIndexFor(world).references.get(key) ?? [])]
            .some(fact => fact.data.npcCombatArtUse === key)) continue;
        const at = world.npcs.findIndex(npc => npc.id === exchange.attackerId);
        const npc = world.npcs[at];
        if (!npc || !isTheWorldsToMove(npc)) continue; // SQL PC and its world mirror retain the actual PC writer.
        const art = getTechnique(use.techniqueId);
        if (!art || use.qiSpent !== art.qiCost || use.cooldownStarted !== art.cooldown)
            throw new Error('A combat art receipt disagrees with its actual catalog authority.');
        const used = useAnNpcArt(npc,art.id,day);
        if (!used) throw new Error('An actual combat cast lost its canonical ready body.');
        world.npcs[at] = used;
        appendWorldFact(world,makeFact({ day, kind:'gathering', scale:'personal',
            summary:'An actual combat art was used.', actors:[{id:npc.id,name:npc.name,role:'used an art'}],
            witnessIds:[npc.id], locationId:npc.locationId, visibility:'secret', magnitude:0,
            data:{npcCombatArtUse:key,fightId,exchangeIndex:exchange.index,
                techniqueId:art.id}
        }),{recur:false,bystanders:false});
    }
}
