/** A remote presence is a dated world object. Its maker's body stays where it was. */
import { getTechnique } from '../../data/cultivation/techniques.js';
import { NASCENT_SOUL_ORDINAL, hasBody, canEnterExistenceState, isTheSamePerson } from '../cultivation/existence.js';
import { REALM_TIERS, maxHpForOrdinal, rankName } from '../cultivation/realms.js';
import { forStream } from '../cultivation/rng.js';
import { combatantOf } from './gatherings.js';
import { resolveConfrontation, type CombatantInput } from '../cultivation/combat.js';
import { AN_ORDINARY_SWING } from '../cultivation/how-a-blow-was-thrown.js';
import { makeObject, ruin, type ObjectRecord } from './possessions.js';
import { setExistence, markDead, isActing, isTheWorldsToMove, PLAYER_ROW_TAG, type NpcRecord } from './npc-state.js';
import { getNpc, type WorldState } from './world-state.js';
import { whereInThisPlaceTheyStand, npcsInTheArea, theAreasOf } from './where-in-a-place-somebody-is-standing.js';
import { aDeedEntersTheWorld } from './a-deed-enters-the-world-as-a-fact.js';
import { createObligation } from '../social/grudges.js';
import { whatTheConfrontationDidToThem } from './what-a-confrontation-does-to-somebody-the-world-holds.js';
import { ambientForLocationOnDay } from '../cultivation/ambient.js';
import type { Party } from '../social-leverage/what-a-deed-leaves.js';
import { whoTheyLeave } from './who-is-left-when-somebody-dies.js';
import { settleNpcDeath } from './time.js';

type ProxyKind = 'sword' | 'clone' | 'soul';

function madeId(world: WorldState, makerId: string, kind: string): string {
    const base = `${makerId}-${kind}-${world.currentDay}-${world.objects.length}`;
    let id = base;
    let suffix = 0;
    while (world.objects.some(o => o.id === id)) id = `${base}-${++suffix}`;
    return id;
}

function floorFor(kind: ProxyKind): number {
    return kind === 'sword' ? getTechnique('gale-riding-sword-flight')!.requiredOrdinal
        : kind === 'soul' ? NASCENT_SOUL_ORDINAL
        : REALM_TIERS.find(t => t.key === 'void_tribulation')!.ordinalStart;
}

/** Reads the surviving record, including its clock, without storing an active flag. */
export function whereYouCanActFrom(world: WorldState, makerId: string, onDay = world.currentDay): ObjectRecord | null {
    return world.objects.find(o => o.tags.includes('acting-proxy') && o.ownerId === makerId
        && !o.tags.includes('ruined') && Number(o.data.madeOnDay) <= onDay
        && (o.data.endedOnDay === undefined || Number(o.data.endedOnDay) > onDay)
        && Number(o.data.lapsesOnDay) > onDay) ?? null;
}

export function whatIsLeftUnguarded(world: WorldState, makerId: string, onDay = world.currentDay): NpcRecord | null {
    const proxy = whereYouCanActFrom(world, makerId, onDay);
    return proxy && proxy.data.kind !== 'clone' ? getNpc(world, makerId) : null;
}

export function prepareASoulAnchor(world: WorldState, maker: NpcRecord): { ok: boolean; line: string } {
    if (maker.tags.includes('tradition-cut')) return { ok: false, line: 'The Cut does not separate a soul from its body.' };
    const art = getTechnique('soul-anchoring-invocation')!;
    if (maker.cultivation.realmOrdinal < art.requiredOrdinal || !hasBody(maker.status)) return { ok: false, line: `A soul anchor requires a body at ${rankName(art.requiredOrdinal)}.` };
    if (!maker.cultivation.techniqueIds.includes(art.id)) return { ok: false, line: `Preparing an anchor requires mastery of ${art.name}.` };
    if (world.objects.some(o => o.possessorId === maker.id && o.tags.includes('soul-anchor') && !o.tags.includes('ruined'))) return { ok: false, line: 'A soul anchor is already prepared.' };
    const material = world.objects.find(o => o.possessorId === maker.id && o.kind === 'material' && o.data.grade === 'heaven' && !o.tags.includes('ruined'));
    if (!material) return { ok: false, line: 'Preparing a soul anchor takes one heaven-grade material in hand.' };
    Object.assign(material, ruin(material, { onDay: world.currentDay, source: 'Made into a soul anchor.' }));
    world.objects.push(makeObject({ id: madeId(world, maker.id, 'anchor'), name: 'Prepared soul anchor',
        kind: 'other', possessorId: maker.id, ownerId: maker.id, ownerName: maker.name,
        tags: ['soul-anchor'], data: { materialId: material.id } }));
    return { ok: true, line: 'The soul anchor is prepared. The material was spent.' };
}

/** Creates only what the body, the held object and the realm can sustain. */
export function sendAProxy(world: WorldState, maker: NpcRecord, requested: ProxyKind | 'strongest',
    placeId: string, days?: number): { proxy: ObjectRecord | null; line: string } {
    const kind = requested === 'strongest'
        ? maker.tags.includes('tradition-cut') ? 'sword'
            : maker.cultivation.realmOrdinal >= floorFor('clone') ? 'clone'
            : maker.cultivation.realmOrdinal >= floorFor('soul') ? 'soul' : 'sword'
        : requested;
    const floor = floorFor(kind);
    if (!isActing(maker.status) || !hasBody(maker.status)) return { proxy: null, line: 'There is no acting body to send a presence from.' };
    if (kind !== 'sword' && maker.tags.includes('tradition-cut')) return { proxy: null, line: 'The Cut does not separate a soul from its body.' };
    if (maker.cultivation.realmOrdinal < floor) return { proxy: null, line: `This presence requires ${rankName(floor)}.` };
    if (whereYouCanActFrom(world, maker.id)) return { proxy: null, line: 'A presence is already taking this attention.' };
    const place = world.locations.find(p => p.id === placeId);
    if (!place) return { proxy: null, line: 'That place is not on the known ground.' };
    const sword = kind === 'sword' ? world.objects.find(o => o.possessorId === maker.id && !o.tags.includes('ruined')
        && o.kind === 'artifact' && o.power !== null && (o.tags.includes('sword') || /sword|blade|sabre/i.test(o.name))) : null;
    if (kind === 'sword' && !sword) return { proxy: null, line: 'There is no sword in hand to send.' };
    // A separated presence spends its own reserve. The limit grows with its maker's rung.
    const reserve = Math.max(1, maker.cultivation.realmOrdinal - floor + 1);
    if (days !== undefined && days > reserve) return { proxy: null, line: `This presence can be sustained for ${reserve} days.` };
    const area = whereInThisPlaceTheyStand(world, place, null, null);
    const power = kind === 'sword' ? Math.min(maker.cultivation.realmOrdinal, sword!.power!)
        : Math.max(0, maker.cultivation.realmOrdinal - (kind === 'clone' ? 4 : 1));
    const proxy = makeObject({
        id: madeId(world, maker.id, 'presence'), name: `${kind} presence`,
        kind: 'other', significance: 'significant', ownerId: maker.id, ownerName: maker.name,
        possessorId: null, locationId: placeId, power, tags: ['acting-proxy'],
        data: { kind, standingIn: area.id, madeOnDay: world.currentDay,
            lapsesOnDay: world.currentDay + (days ?? reserve), swordId: sword?.id ?? null,
            hp: maxHpForOrdinal(maker.cultivation.attributes.might, power) }
    });
    if (sword) { sword.possessorId = null; sword.locationId = placeId; }
    world.objects.push(proxy);
    return { proxy, line: `The ${kind} is at ${place.name}. The body remains where it was.` };
}

/** Ending a sword loses that sword; ending a separated soul injures its maker. */
export function endAProxy(world: WorldState, proxy: ObjectRecord, lost: boolean): string {
    if (proxy.data.endedOnDay !== undefined) return 'The presence has already ended.';
    const maker = getNpc(world, proxy.ownerId ?? '');
    const sword = world.objects.find(o => o.id === proxy.data.swordId);
    if (sword) {
        if (lost) Object.assign(sword, ruin(sword, { onDay: world.currentDay, source: 'Destroyed while sent away.' }));
        else { sword.possessorId = maker?.id ?? null; sword.locationId = maker?.locationId ?? sword.locationId; }
    }
    if (lost && maker && proxy.data.kind === 'soul') {
        world.npcs[world.npcs.findIndex(n => n.id === maker.id)] = setExistence(maker, {
            to: maker.status, onDay: world.currentDay, soulState: 'damaged',
            identityContinuity: maker.identityContinuity * 0.8
        });
    }
    proxy.data.endedOnDay = world.currentDay;
    proxy.data.lost = lost;
    return lost ? `The ${proxy.data.kind} was destroyed.` : `The ${proxy.data.kind} returned to its maker.`;
}

export function proxyCombatant(world: WorldState, proxy: ObjectRecord): CombatantInput | null {
    const maker = getNpc(world, proxy.ownerId ?? '');
    if (!maker) return null;
    const base = combatantOf(maker, world);
    const maxHp = maxHpForOrdinal(maker.cultivation.attributes.might, proxy.power ?? 0);
    const sword = world.objects.find(o => o.id === proxy.data.swordId);
    return { ...base, id: proxy.id, name: `A ${proxy.data.kind}`, realmOrdinal: proxy.power ?? 0,
        hp: Number(proxy.data.hp), maxHp, qi: maxHp, maxQi: maxHp,
        weapon: sword && sword.power !== null ? { ...sword, power: sword.power } : null, technique: proxy.data.kind === 'sword' ? null : base.technique,
        injuries: [], soulState: maker.soulState };
}

function party(world: WorldState, person: NpcRecord): Party {
    const house = world.factions.find(f => f.id === person.factionId);
    return { id: person.id, name: person.name, houseId: house?.id ?? null,
        houseName: house?.name ?? null, alignment: house?.alignment ?? null,
        ranked: person.factionRankIndex >= 0,
        kin: whoTheyLeave({ dead: person, heirs: [], stillHere: id => {
            const relative = getNpc(world, id);
            return !!relative && isActing(relative.status);
        } }) };
}

/** The same attempt for either side. A remnant's continuity cannot increase. */
export function recoverABody(world: WorldState, actor: NpcRecord, route: 'possessing' | 'reconstructed',
    vessel: NpcRecord | ObjectRecord, helper?: NpcRecord, standingIn?: string): { ok: boolean; line: string; victimId?: string } {
    if (!['soul_preserved', 'remnant'].includes(actor.status)) return { ok: false, line: 'This presence has not lost its body.' };
    if (actor.tags.includes('tradition-cut')) return { ok: false, line: 'The Cut leaves a seam, not a soul that can take a body.' };
    const art = getTechnique('spring-returning-life-art')!;
    const knows = helper?.cultivation.techniqueIds.includes(art.id) && helper.cultivation.realmOrdinal >= art.requiredOrdinal;
    const person = 'cultivation' in vessel ? vessel : null;
    const material = 'kind' in vessel ? vessel : null;
    const check = canEnterExistenceState({ realmOrdinal: actor.cultivation.realmOrdinal,
        existenceState: actor.status, soulState: actor.soulState }, route, {
        vesselId: person?.id, resources: material?.kind === 'material' && material.data.grade === 'heaven',
        assistance: !!knows
    });
    if (!check.legal) return { ok: false, line: check.detail };
    if (person && (!isActing(person.status) || !hasBody(person.status))) return { ok: false, line: 'That person has no living body to take.' };
    if (person && person.locationId !== actor.locationId) return { ok: false, line: 'That body is elsewhere.' };
    const place = world.locations.find(p => p.id === actor.locationId);
    const areas = place ? theAreasOf(world, place) : null;
    const actorArea = actor.tags.includes(PLAYER_ROW_TAG) ? standingIn
        : areas?.whereIs.get(actor.id) ?? (place ? whereInThisPlaceTheyStand(world, place, null, actor.factionId).id : undefined);
    if (person && (person.tags.includes(PLAYER_ROW_TAG) ? standingIn : areas?.whereIs.get(person.id)) !== actorArea) return { ok: false, line: 'That living body is in another area.' };
    if (material && (material.possessorId !== helper?.id || material.tags.includes('ruined'))) return { ok: false, line: 'The reconstruction material is not in the maker\'s hands.' };
    if (helper && helper.locationId !== actor.locationId) return { ok: false, line: 'The maker is elsewhere.' };
    if (helper && helper.id !== actor.id && actorArea !== (helper.tags.includes(PLAYER_ROW_TAG) ? standingIn : areas?.whereIs.get(helper.id))) return { ok: false, line: 'The remnant is in another area.' };
    const rng = forStream(world.seed, 'body-recovery', actor.id, vessel.id, world.currentDay);
    const advantage = person ? actor.cultivation.realmOrdinal - person.cultivation.realmOrdinal : 0;
    const chance = route === 'possessing' ? Math.max(0.05, Math.min(0.9, 0.5 + advantage * 0.04)) : 0.75;
    const succeeded = rng.next() < chance;
    if (person) {
        const seen = areas ? npcsInTheArea(world, areas.whereIs.get(person.id) ?? '') : [];
        const description = succeeded ? `${actor.name} took ${person.name}'s living body.` : `${actor.name} tried to take ${person.name}'s living body.`;
        const record = aDeedEntersTheWorld(world, {
            day: world.currentDay, kind: 'grudge_opened', locationId: actor.locationId,
            actors: [{ id: actor.id, name: actor.name, role: 'possessor' }, { id: person.id, name: person.name, role: 'victim' }],
            factionIds: person.factionId ? [person.factionId] : [], summary: description,
            unattributed: succeeded ? 'A living body was taken by another soul.' : 'Somebody tried to take a living body.',
            data: { crime: 'possession', victimId: person.id, succeeded },
            price: { actor: party(world, actor), subject: party(world, person), principalCannotHoldIt: succeeded, deed: {
                cause: 'violated', paidBy: 'subject', cost: succeeded ? 1 : 0.4, irreversible: succeeded,
                onDay: world.currentDay, description, witnesses: seen.length,
                knownTo: [actor.id, person.id, ...seen.map(n => n.id), ...(seen.some(n => n.factionId === person.factionId) && person.factionId ? [person.factionId] : [])]
            } }
        });
        for (const opens of record.leaves?.opens ?? []) world.obligations.push(createObligation({ ...opens, triggeringEventId: record.fact.id }));
    }
    if (material) Object.assign(material, ruin(material, { onDay: world.currentDay, source: 'Spent rebuilding a body.' }));
    if (!succeeded) {
        world.npcs[world.npcs.findIndex(n => n.id === actor.id)] = setExistence(actor, { to: actor.status,
            onDay: world.currentDay, soulState: 'fragmented', identityContinuity: actor.identityContinuity });
        return { ok: false, line: 'The body rejected the soul. The soul is fragmented.' };
    }
    if (person) {
        world.npcs[world.npcs.findIndex(n => n.id === person.id)] = markDead(person, world.currentDay, 'The body was taken and its soul displaced.');
        if (isTheWorldsToMove(person)) settleNpcDeath(world, person, world.currentDay);
    }
    const bodyId = person?.id ?? madeId(world, actor.id, 'rebuilt');
    if (!person) world.objects.push(makeObject({ id: bodyId, name: 'Rebuilt body', kind: 'other',
        ownerId: actor.id, possessorId: actor.id, locationId: actor.locationId,
        tags: ['rebuilt-body'], power: actor.cultivation.realmOrdinal, data: { materialId: material!.id } }));
    const next = setExistence(actor, { to: route, onDay: world.currentDay, bodyId,
        soulState: 'damaged', identityContinuity: actor.identityContinuity });
    if (!isTheSamePerson({ existenceState: next.status, identityContinuity: next.identityContinuity })) {
        next.tags = next.tags.filter(tag => tag !== PLAYER_ROW_TAG);
    }
    next.cultivation = { ...next.cultivation,
        realmOrdinal: person ? Math.min(actor.cultivation.realmOrdinal, person.cultivation.realmOrdinal) : actor.cultivation.realmOrdinal,
        hp: person?.cultivation.hp ?? maxHpForOrdinal(actor.cultivation.attributes.might, actor.cultivation.realmOrdinal),
        bodyOnDay: world.currentDay };
    world.npcs[world.npcs.findIndex(n => n.id === actor.id)] = next;
    return { ok: true, line: `${route === 'possessing' ? 'The soul occupies the body.' : 'The body was rebuilt.'} ${isTheSamePerson({ existenceState: next.status, identityContinuity: next.identityContinuity }) ? 'The person continues.' : 'The remnant remains a different identity.'}`,
        ...(person ? { victimId: person.id } : {}) };
}

/** Lapse and NPC decisions run on the world's clock, including hostile attempts on the player. */
export function advanceSeparatedPresences(world: WorldState, fromDay: number): void {
    for (const proxy of world.objects.filter(o => o.tags.includes('acting-proxy') && o.data.endedOnDay === undefined)) {
        if (Number(proxy.data.lapsesOnDay) <= world.currentDay) endAProxy(world, proxy, false);
    }
    if (Math.floor(fromDay) >= Math.floor(world.currentDay)) return;
    for (const original of world.npcs.slice()) {
        if (!isTheWorldsToMove(original) && original.status !== 'remnant') continue;
        const npc = getNpc(world, original.id)!;
        if (isActing(npc.status) && npc.cultivation.realmOrdinal >= NASCENT_SOUL_ORDINAL
            && npc.goals.some(g => g.status === 'active' && g.kind === 'survival')) prepareASoulAnchor(world, npc);
        if (['remnant', 'soul_preserved'].includes(npc.status)) {
            const helper = world.npcs.find(n => n.id !== npc.id && n.locationId === npc.locationId && isActing(n.status)
                && n.relationships.some(t => t.targetId === npc.id && t.standing > 0)
                && n.cultivation.techniqueIds.includes('spring-returning-life-art'));
            const material = helper && world.objects.find(o => o.possessorId === helper.id && o.kind === 'material' && o.data.grade === 'heaven' && !o.tags.includes('ruined'));
            if (helper && material) recoverABody(world, npc, 'reconstructed', material, helper);
            else {
                const vessel = world.npcs.find(n => n.id !== npc.id && n.locationId === npc.locationId && isActing(n.status) && hasBody(n.status));
                if (vessel && forStream(world.seed, 'seek-a-body', npc.id, world.currentDay).chance(0.15)) recoverABody(world, npc, 'possessing', vessel);
            }
            continue;
        }
        const goal = npc.goals.find(g => g.status === 'active' && ['revenge', 'reunion'].includes(g.kind) && g.targetId);
        const target = goal ? getNpc(world, goal.targetId!) : null;
        if (!target || !target.locationId || !isActing(target.status) || target.locationId === npc.locationId) continue;
        const proxy = whereYouCanActFrom(world, npc.id) ?? sendAProxy(world, npc, 'strongest', target.locationId).proxy;
        if (!proxy || goal?.kind !== 'revenge' || target.tags.includes('the-player')) continue;
        const attacker = proxyCombatant(world, proxy)!;
        const place = world.locations.find(p => p.id === target.locationId)!;
        proxy.data.standingIn = theAreasOf(world, place).whereIs.get(target.id)
            ?? whereInThisPlaceTheyStand(world, place, null, target.factionId).id;
        const defender = combatantOf(target, world);
        if (whatIsLeftUnguarded(world, target.id)) defender.qi = 0;
        const fight = resolveConfrontation(attacker, defender, {
            ambient: ambientForLocationOnDay(world.seed, place.id, world.currentDay, { density: place.environment.spiritualDensity }), turn: Math.floor(world.currentDay),
            rng: forStream(world.seed, 'proxy-fight', proxy.id, target.id, world.currentDay),
            intent: { thrown: AN_ORDINARY_SWING }
        });
        proxy.data.hp = fight.hp[proxy.id] ?? attacker.hp;
        whatTheConfrontationDidToThem(world, { npcId: target.id, byId: npc.id, byName: npc.name,
            day: world.currentDay, wounds: fight.injuries[target.id] ?? [], outcome: fight.outcome,
            lost: fight.loserId === target.id, finished: fight.finished });
        if (fight.loserId === proxy.id || Number(proxy.data.hp) <= 0) endAProxy(world, proxy, true);
    }
}
