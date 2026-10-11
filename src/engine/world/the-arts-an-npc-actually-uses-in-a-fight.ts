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
import { factsWithDataValue, witnessIndexFor } from './witness-reaction-index.js';
import { artUseReadiness, effectiveArtCooldownDays } from '../cultivation/an-art-that-is-ready-to-use.js';
import { maxHpForOrdinal } from '../cultivation/realms.js';
import type { ObjectRecord } from './possessions.js';

type CombatArts = Pick<CombatantInput, 'qi'|'maxQi'|'technique'|'techniqueCooldowns'|'insights'>;

function readyCombatArt(npc: NpcRecord, ordinal: number, ready: (id: string) => boolean) {
    let technique: CombatantInput['technique'] = null;
    for (const id of npc.cultivation.techniqueIds) {
        const art = getTechnique(id);
        if (!art || !anArtThatCanBeUsedInAFight(art) || art.requiredOrdinal > ordinal || !ready(id)) continue;
        if (!technique || art.requiredOrdinal > technique.requiredOrdinal) technique = art;
    }
    return technique;
}

export function npcCombatArts(npc: NpcRecord, day: number): CombatArts {
    const technique = readyCombatArt(npc, npc.cultivation.realmOrdinal, id => !npcArtReadiness(npc,id,day));
    return { qi: qiStandingOn(npc,day), maxQi: maxQiOf(npc), technique, insights: npc.cultivation.insights ?? [],
        techniqueCooldowns: npc.cultivation.techniqueCooldowns ?? {} };
}

/** A presence retains its existing separate pool. Its actual cast facts supply
 * cooldown dates; reading them does not replenish qi or charge its maker. */
export function proxyCombatArts(world: WorldState, proxy: ObjectRecord, day: number): CombatArts | null {
    const maker = world.npcs.find(npc => npc.id === proxy.ownerId);
    if (!maker) return null;
    const maxQi = maxHpForOrdinal(maker.cultivation.attributes.might, proxy.power ?? 0);
    const qi = Math.max(0, Math.min(Number(proxy.data.qi ?? maxQi), maxQi));
    const techniqueCooldowns: Record<string, number> = {};
    for (const fact of factsWithDataValue(world,'proxyId',proxy.id)) {
        if (typeof fact.data.npcCombatArtUse !== 'string'
            || typeof fact.data.techniqueId !== 'string' || fact.day > day) continue;
        const art = getTechnique(fact.data.techniqueId);
        if (!art) continue;
        const left = Math.max(0, art.cooldown - effectiveArtCooldownDays(day, fact.day));
        techniqueCooldowns[art.id] = Math.max(techniqueCooldowns[art.id] ?? 0, left);
    }
    const technique = proxy.data.kind === 'sword' ? null : readyCombatArt(maker, proxy.power ?? 0,
        id => !artUseReadiness(getTechnique(id)!, techniqueCooldowns[id] ?? 0, qi));
    return { qi, maxQi, technique, techniqueCooldowns, insights: maker.cultivation.insights ?? [] };
}

export function writeTheNpcArtsActuallyUsed(world: WorldState,
    exchanges: readonly ExchangeRecord[], fightId: string, day: number): void {
    for (const exchange of exchanges) {
        const use = exchange.artUse;
        if (!use) continue;
        const key = fightId+':'+exchange.attackerId+':'+exchange.index;
        if ([...(witnessIndexFor(world).references.get(key) ?? [])]
            .some(fact => fact.data.npcCombatArtUse === key)) continue;
        const bodyAt = world.npcs.findIndex(npc => npc.id === exchange.attackerId);
        const proxy = bodyAt < 0 ? world.objects.find(object => object.id === exchange.attackerId
            && object.tags.includes('acting-proxy')) : undefined;
        const at = proxy ? world.npcs.findIndex(npc => npc.id === proxy.ownerId) : bodyAt;
        const npc = world.npcs[at];
        if (!npc || (!proxy && !isTheWorldsToMove(npc))) continue; // A SQL body retains its actual PC writer; its separate presence does not.
        const art = getTechnique(use.techniqueId);
        if (!art || use.qiSpent !== art.qiCost || use.cooldownStarted !== art.cooldown)
            throw new Error('A combat art receipt disagrees with its actual catalog authority.');
        if (proxy) {
            const available = proxyCombatArts(world,proxy,day);
            if (!available || proxy.data.kind === 'sword' || proxy.tags.includes('ruined')
                || Number(proxy.data.endedOnDay ?? Infinity) <= day || Number(proxy.data.lapsesOnDay) <= day
                || !npc.cultivation.techniqueIds.includes(art.id) || art.requiredOrdinal > (proxy.power ?? 0)
                || artUseReadiness(art,available.techniqueCooldowns?.[art.id] ?? 0,available.qi))
                throw new Error('An actual combat cast lost its canonical ready presence.');
            proxy.data.qi = available.qi - art.qiCost;
        } else {
            const used = useAnNpcArt(npc,art.id,day);
            if (!used) throw new Error('An actual combat cast lost its canonical ready body.');
            world.npcs[at] = used;
        }
        appendWorldFact(world,makeFact({ day, kind:'gathering', scale:'personal',
            summary:'An actual combat art was used.', actors:[{id:npc.id,name:npc.name,role:'used an art'}],
            witnessIds:[npc.id], locationId:proxy?.locationId ?? npc.locationId, visibility:'secret', magnitude:0,
            data:{npcCombatArtUse:key,fightId,exchangeIndex:exchange.index,
                techniqueId:art.id,...(proxy ? {proxyId:proxy.id} : {})}
        }),{recur:false,bystanders:false});
    }
}
