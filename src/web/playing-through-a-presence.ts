/** A player's remote acts use the ordinary scene and the ordinary combat round. */
import type { GameService } from './turn-engine.js';
import type { Cultivator, Run, AmbientQi } from '../schema/cultivation.js';
import type { PlannedAction } from './actions.js';
import type { Execution } from './turn-wire-shapes.js';
import { factsForToolResult, factsForRefusal } from './facts.js';
import { refused } from './tool-result-prose.js';
import { worldLocationFor } from './entities.js';
import { getNpc } from '../engine/world/world-state.js';
import { hasBody } from '../engine/cultivation/existence.js';
import {
    sendAProxy, whereYouCanActFrom, endAProxy, proxyCombatant, recoverABody, whatIsLeftUnguarded, prepareASoulAnchor
} from '../engine/world/something-acting-in-your-place.js';
import { openFight, takeAFightTurn, type UnfinishedFight, type FightSide } from '../engine/cultivation/unfinished-fight.js';
import { combatantOf } from '../engine/world/gatherings.js';
import { resolveConfrontation } from '../engine/cultivation/combat.js';
import { forStream } from '../engine/cultivation/rng.js';
import { AN_ORDINARY_SWING } from '../engine/cultivation/how-a-blow-was-thrown.js';
import { whatTheConfrontationDidToThem } from '../engine/world/what-a-confrontation-does-to-somebody-the-world-holds.js';
import { npcsInTheArea, whereInThisPlaceTheyStand, theAreasOf } from '../engine/world/where-in-a-place-somebody-is-standing.js';
import { getTechnique } from '../data/cultivation/techniques.js';
import { isActing } from '../engine/world/npc-state.js';
import { rankName } from '../engine/cultivation/realms.js';
import { whatTheySaidInTheFight } from './fight-answers.js';

export function presenceForScene(game: GameService, body: Cultivator): Cultivator {
    const proxy = game.atHand && whereYouCanActFrom(game.atHand, body.id);
    const place = proxy && game.atHand?.locations.find(p => p.id === proxy.locationId);
    return proxy && place ? { ...body, location: place.name,
        standingIn: String(proxy.data.standingIn), realmOrdinal: proxy.power ?? 0 } : body;
}

function syncSoul(game: GameService, body: Cultivator): void {
    const soul = game.atHand && getNpc(game.atHand, body.id);
    if (!soul || !body.alive) return;
    if (soul.status === 'physically_dead') {
        game.repos.cultivators.markDead(body.id, 'combat_defeat', game.currentRun().run.turn, soul.endNote);
        return;
    }
    game.repos.cultivators.update(body.id, { soulState: soul.soulState,
        identityContinuity: soul.identityContinuity, existenceState: soul.status, bodyId: soul.bodyId });
}

export async function actThroughAPresence(game: GameService, action: PlannedAction, run: Run,
    body: Cultivator, ambient: AmbientQi, raw: string,
    ordinary: (actor: Cultivator) => Promise<Execution>): Promise<Execution | null> {
    const world = game.atHand;
    if (!world) return null;
    const record = getNpc(world, body.id);
    if (!record) return null;
    const maker = { ...record, locationId: game.worldPlaceOf(body) };
    const refuse = (line: string) => refused('world.separatedPresence', action.action,
        factsForRefusal('The attempt did not proceed.', line, line));
    const done = (line: string) => {
        game.theWorldMoved();
        const execution = game.freeAction(run, action.action, factsForToolResult('The presence changed.', [line]));
        execution.calls = [{ name: 'world.separatedPresence', action: action.action, summary: line, ok: true }];
        return execution;
    };
    if (action.action === 'project') {
        if (action.proxy === 'recall') {
            const proxy = whereYouCanActFrom(world, body.id);
            if (!proxy) return refuse('There is no separated presence to recall.');
            if (proxy.data.fight) return refuse('The presence is in a fight. It must get clear before returning.');
            return done(endAProxy(world, proxy, false));
        }
        if (action.proxy === 'prepare') {
            const art = getTechnique('soul-anchoring-invocation')!;
            if (body.realmOrdinal < art.requiredOrdinal || body.traditionId === 'tradition-cut') return refuse(`A soul anchor requires ${rankName(art.requiredOrdinal)}.`);
            const cost = art.qiCost;
            if (body.qi < cost) return refuse(`Preparing this anchor takes ${cost} qi.`);
            const prepared = game.db.transaction(() => {
                const prepared = prepareASoulAnchor(world, maker);
                if (!prepared.ok) return prepared;
                game.repos.cultivators.update(body.id, { qi: body.qi - cost });
                game.theWorldMoved();
                return prepared;
            })();
            return prepared.ok ? done(prepared.line) : refuse(prepared.line);
        }
        const kind = action.proxy;
        if (!kind) return refuse('No form of presence was specified.');
        if (body.traditionId === 'tradition-cut' && kind !== 'sword') return refuse('The Cut does not separate a soul from its body.');
        const place = worldLocationFor(world, action.target ?? body.location);
        if (!place) return refuse('That destination is not on the known ground.');
        const sent = sendAProxy(world, maker, kind, place.id, action.days);
        return sent.proxy ? done(sent.line) : refuse(sent.line);
    }
    if (action.action === 'possess' || action.action === 'reconstruct') {
        const actor = action.action === 'reconstruct' && action.target
            ? world.npcs.find(n => n.name.toLowerCase() === action.target!.toLowerCase() && n.locationId === maker.locationId)
            : maker;
        if (!actor) return refuse('No such remnant is here.');
        let vessel;
        if (action.action === 'possess') {
            const area = world.locations.find(p => p.id === actor.locationId);
            const here = area ? whereInThisPlaceTheyStand(world, area, body.standingIn, body.sectId) : null;
            vessel = here ? npcsInTheArea(world, here.id).find(n => n.id !== actor.id
                && n.name.toLowerCase() === action.target?.toLowerCase()) : undefined;
        } else {
            vessel = world.objects.find(o => o.possessorId === body.id && o.kind === 'material'
                && o.data.grade === 'heaven' && !o.tags.includes('ruined'));
        }
        if (!vessel) return refuse(action.action === 'possess' ? 'That living body is not in this area.' : 'Reconstruction takes one heaven-grade material in hand.');
        const art = getTechnique('spring-returning-life-art')!;
        if (action.action === 'reconstruct' && body.qi < art.qiCost) return refuse(`Reconstruction takes ${art.qiCost} qi.`);
        const result = game.db.transaction(() => {
            const place = world.locations.find(p => p.id === maker.locationId)!;
            const here = whereInThisPlaceTheyStand(world, place, body.standingIn, body.sectId);
            const result = recoverABody(world, actor, action.action === 'possess' ? 'possessing' : 'reconstructed', vessel, maker, here.id);
            if (action.action === 'reconstruct' && vessel.tags.includes('ruined')) game.repos.cultivators.update(body.id, { qi: body.qi - art.qiCost });
            syncSoul(game, body);
            if (result.ok && actor.id === body.id) {
                const recovered = getNpc(world, actor.id)!;
                const sheet = game.repos.cultivators.advanceRealm(body.id, recovered.cultivation.realmOrdinal - body.realmOrdinal)!;
                game.repos.cultivators.update(body.id, { hp: Math.max(1, Math.min(sheet.maxHp, recovered.cultivation.hp)),
                    cultivationProgress: body.cultivationProgress * 0.7,
                    ...('cultivation' in vessel ? { age: Math.max(0, (world.currentDay - vessel.identity.bornOnDay) / 365) } : {}) });
            }
            game.theWorldMoved();
            return result;
        })();
        return result.ok ? done(result.line) : refuse(result.line);
    }
    const proxy = whereYouCanActFrom(world, body.id);
    const actor = presenceForScene(game, body);
    const target = game.present(actor).find(n => n.name.toLowerCase() === action.target?.toLowerCase());
    const targetPresence = target && whereYouCanActFrom(world, target.id);
    const ongoing = proxy ?? world.objects.find(o => o.tags.includes('acting-proxy') && typeof o.data.fight === 'string'
        && (JSON.parse(o.data.fight) as UnfinishedFight).playerId === body.id);
    const storage = ongoing ?? (action.action === 'attack' ? targetPresence : null);
    if (storage && (storage.data.fight || action.action === 'attack')) {
        const playerId = proxy?.id ?? body.id;
        const side = (input: NonNullable<ReturnType<typeof proxyCombatant>>): FightSide => ({ input,
            edges: [], vector: 'body', movement: null, movementMastery: 0 });
        let fight = typeof storage.data.fight === 'string' ? JSON.parse(storage.data.fight) as UnfinishedFight : null;
        let settled = null;
        if (!fight) {
            const npc = target && getNpc(world, target.id);
            if (!npc) return refuse('That person is not in the presence\'s area.');
            const opened = openFight({ id: `${storage.id}-fight-${run.turn}`, seed: run.seed,
                aggressor: side(proxy ? proxyCombatant(world, proxy)! : body),
                defender: side(targetPresence ? proxyCombatant(world, targetPresence)! : combatantOf(npc, world)),
                intent: { thrown: action.thrown ?? AN_ORDINARY_SWING, opening: action.opening },
                playerId, ground: { locationId: game.worldPlaceOf(actor)!, locationName: actor.location!, waysOut: [] },
                turn: run.turn, ambient });
            fight = opened.fight;
            settled = opened.settled;
        }
        let line = 'The presence fought.';
        if (fight) {
            const round = takeAFightTurn(fight, whatTheySaidInTheFight(raw) ?? { kind: 'strike' }, { ambient, turn: run.turn });
            fight = round.fight;
            settled = round.finished;
            line = round.line;
        }
        storage.data.fight = fight ? JSON.stringify(fight) : null;
        const hp = settled?.hp ?? fight?.hp;
        if (hp) {
            for (const remote of world.objects.filter(o => o.tags.includes('acting-proxy') && hp[o.id] !== undefined)) remote.data.hp = hp[remote.id]!;
            if (!proxy) game.repos.cultivators.update(body.id, { hp: Math.max(0, hp[body.id] ?? body.hp) });
        }
        if (settled) {
            const targetId = Object.keys(settled.hp).find(id => id !== playerId)!;
            const remoteTarget = world.objects.find(o => o.id === targetId && o.tags.includes('acting-proxy'));
            if (!remoteTarget) whatTheConfrontationDidToThem(world, { npcId: targetId, byId: body.id, byName: body.name,
                day: world.currentDay, wounds: settled.injuries[targetId] ?? [], outcome: settled.outcome,
                lost: settled.loserId === targetId, finished: settled.finished });
            line = 'The fight ended.';
            for (const remote of [proxy, remoteTarget].filter(p => !!p)) {
                if (settled.loserId === remote.id || Number(remote.data.hp) <= 0) line += ` ${endAProxy(world, remote, true)}`;
            }
            if (!proxy) {
                for (const wound of settled.injuries[body.id] ?? []) game.repos.cultivators.addInjury(body.id, wound);
                if (settled.finished && (settled.hp[body.id] ?? body.hp) <= 0) {
                    game.repos.cultivators.markDead(body.id, 'combat_defeat', run.turn, 'Killed by a separated presence.', true);
                }
            } else syncSoul(game, body);
        }
        return done(line);
    }
    if (!proxy) {
        if (!hasBody(body.existenceState) && !['look', 'interact', 'status', 'move', 'possess', 'reconstruct'].includes(action.action)) return refuse('This soul has no body for that act.');
        return null;
    }
    if (action.action === 'move') {
        const here = world.locations.find(p => p.id === proxy.locationId)!;
        const area = theAreasOf(world, here).areas.find(a => a.name.toLowerCase().replace(/^the /, '')
            === action.target?.toLowerCase().replace(/^the /, ''));
        if (area) {
            proxy.data.standingIn = area.id;
            return done(`The ${proxy.data.kind} is at ${area.name}.`);
        }
        const place = worldLocationFor(world, action.target ?? null);
        if (!place) return refuse('That destination is not on the known ground.');
        proxy.locationId = place.id;
        proxy.data.standingIn = whereInThisPlaceTheyStand(world, place, null, null).id;
        const sword = world.objects.find(o => o.id === proxy.data.swordId);
        if (sword) sword.locationId = place.id;
        return done(`The ${proxy.data.kind} is at ${place.name}.`);
    }
    if (action.action === 'wait') return ordinary(body);
    if (!['look', 'interact', 'status', 'assess'].includes(action.action)) return refuse('This presence can look, speak, move and fight. The body must carry out that act.');
    if (action.action === 'interact' && action.intent && action.intent !== 'talk') return refuse('This presence can speak here; that act requires the body.');
    return ordinary(actor);
}

/** World assaults reach the sheet after their deterministic world-side resolution. */
export function settleTheSeparatedBody(game: GameService, beforeDay: number): string[] {
    const world = game.atHand;
    const { cultivator: body, run } = game.currentRun();
    if (!world || !body.alive) return [];
    const lines: string[] = [];
    const mirror = getNpc(world, body.id);
    if (mirror?.status === 'physically_dead') {
        syncSoul(game, body);
        return ['Another soul took the body. This life ended.'];
    }
    if (world.currentDay <= beforeDay) return lines;
    const bodyPlace = game.worldPlaceOf(body);
    for (const npc of world.npcs.slice()) {
        if (npc.id === body.id || !isActing(npc.status) || !hasBody(npc.status) || npc.locationId === bodyPlace
            || !npc.goals.some(g => ['revenge', 'reunion'].includes(g.kind) && g.status === 'active' && g.targetId === body.id)
            || !bodyPlace || whereYouCanActFrom(world, npc.id)) continue;
        const sent = sendAProxy(world, npc, 'strongest', bodyPlace).proxy;
        if (sent) {
            sent.data.standingIn = whereInThisPlaceTheyStand(world, world.locations.find(p => p.id === bodyPlace)!, body.standingIn, body.sectId).id;
            game.theWorldMoved();
        }
    }
    const taking = world.npcs.find(n => n.id !== body.id && n.locationId === bodyPlace
        && ['remnant', 'soul_preserved'].includes(n.status)
        && forStream(world.seed, 'seek-a-body', n.id, world.currentDay).chance(0.15));
    if (taking && mirror && bodyPlace && (theAreasOf(world, world.locations.find(p => p.id === bodyPlace)!).whereIs.get(taking.id)
        ?? whereInThisPlaceTheyStand(world, world.locations.find(p => p.id === bodyPlace)!, null, taking.factionId).id)
        === whereInThisPlaceTheyStand(world, world.locations.find(p => p.id === bodyPlace)!, body.standingIn, body.sectId).id) {
        const place = world.locations.find(p => p.id === bodyPlace)!;
        const area = whereInThisPlaceTheyStand(world, place, body.standingIn, body.sectId).id;
        const result = recoverABody(world, taking, 'possessing', { ...mirror, locationId: bodyPlace }, undefined, area);
        lines.push(result.line);
        if (result.ok) syncSoul(game, body);
        game.theWorldMoved();
        if (result.ok) return lines;
    }
    if (!hasBody(body.existenceState) || !bodyPlace) return lines;
    const place = world.locations.find(p => p.id === bodyPlace)!;
    const bodyArea = whereInThisPlaceTheyStand(world, place, body.standingIn, body.sectId).id;
    const positions = theAreasOf(world, place).whereIs;
    const exposed = whatIsLeftUnguarded(world, body.id, beforeDay);
    const attackers = world.npcs.filter(n => n.id !== body.id && isActing(n.status) && hasBody(n.status)
        && exposed && n.locationId === bodyPlace && positions.get(n.id) === bodyArea
        && n.relationships.some(t => t.targetId === body.id && t.kind === 'enemy'));
    const remote = world.objects.find(o => o.tags.includes('acting-proxy') && o.ownerId !== body.id
        && o.data.endedOnDay === undefined && Number(o.data.lapsesOnDay) > world.currentDay
        && o.locationId === bodyPlace && o.data.standingIn === bodyArea
        && getNpc(world, o.ownerId ?? '')?.goals.some(g => g.kind === 'revenge' && g.status === 'active' && g.targetId === body.id));
    const attacker = attackers[0] ? combatantOf(attackers[0], world) : remote ? proxyCombatant(world, remote) : null;
    if (!attacker) return lines;
    const result = resolveConfrontation(attacker, { ...body, qi: exposed ? 0 : body.qi }, {
        rng: forStream(run.seed, 'unguarded-body', attacker.id, run.turn), ambient: game.ambientFor(body, run),
        turn: run.turn, intent: { thrown: AN_ORDINARY_SWING }
    });
    game.repos.cultivators.update(body.id, { hp: Math.max(0, result.hp[body.id] ?? body.hp) });
    for (const wound of result.injuries[body.id] ?? []) game.repos.cultivators.addInjury(body.id, wound);
    if ((result.hp[body.id] ?? body.hp) <= 0 && result.finished) game.repos.cultivators.markDead(body.id, 'combat_defeat', run.turn, 'The body was destroyed by an assault.', true);
    if (remote) {
        remote.data.hp = result.hp[remote.id] ?? remote.data.hp;
        if (result.loserId === remote.id) endAProxy(world, remote, true);
        game.theWorldMoved();
    }
    lines.push(exposed ? 'Somebody attacked the unattended body.' : 'A separated presence attacked the body.');
    return lines;
}
