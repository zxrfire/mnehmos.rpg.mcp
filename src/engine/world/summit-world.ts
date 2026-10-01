/** The same neighbourhood, elemental clock and made works apply to people the world moves. */
import { elementalTolerance } from './elemental-tolerance.js';
import { expireElementalWorks, expressedElement, makeElementalWork, neighbourhoodRate } from './elemental-neighbourhood.js';
import { theAreasOf } from './where-in-a-place-somebody-is-standing.js';
import { npcsStandingIn } from './where-inside-a-house-somebody-is-standing.js';
import { evaluateAccess } from './locations.js';
import { bodyTaken, maxBodyOf, theWorldEnds, PLAYER_ROW_TAG, type NpcRecord } from './npc-state.js';
import { settleNpcDeath, type DeathHandoff } from './time.js';
import type { WorldState } from './world-state.js';

export interface VisitingPresence { person: NpcRecord; placeId: string; areaId: string }

export function practiceAmongNeighbours(state: WorldState, npc: NpcRecord, day: number, visitor?: VisitingPresence): number {
    const place = state.locations.find(l => l.id === npc.locationId);
    if (!place) return 1;
    const body = { realmOrdinal: npc.cultivation.realmOrdinal,
        spiritRoot: npc.cultivation.spiritRoot, injuries: npc.cultivation.injuries };
    const changesRate = (person: NpcRecord) => neighbourhoodRate(body, [person], npc.id, day) !== 1;
    // If nobody changes the rate, dividing them into areas cannot change it.
    if (!npcsStandingIn(state, place.id).some(changesRate)
        && !(visitor?.placeId === place.id && changesRate(visitor.person))) return 1;
    const { whereIs } = theAreasOf(state, place);
    const area = whereIs.get(npc.id);
    const nearby = state.npcs.filter(n => whereIs.get(n.id) === area && area !== undefined);
    if (visitor?.placeId === place.id && visitor.areaId === area) nearby.push(visitor.person);
    return neighbourhoodRate(body, nearby, npc.id, day);
}

export function advanceSummitBodies(state: WorldState, fromDay: number, toDay: number): DeathHandoff[] {
    const deaths: DeathHandoff[] = [];
    expireElementalWorks(state, toDay);
    for (let at = 0; at < state.npcs.length; at++) {
        let npc = state.npcs[at]!;
        if (npc.status !== 'alive' || npc.tags.includes(PLAYER_ROW_TAG)) continue;
        const place = state.locations.find(l => l.id === npc.locationId);
        if (!place) continue;
        const prefix = 'elemental-stay:';
        const old = npc.tags.find(t => t.startsWith(prefix));
        let stay: { placeId: string; enteredOnDay: number } | null = old ? JSON.parse(old.slice(prefix.length)) : null;
        const tolerance = elementalTolerance(npc.cultivation.realmOrdinal, npc.cultivation.injuries, place);
        if (tolerance !== null && tolerance !== Infinity) {
            if (stay?.placeId !== place.id) stay = { placeId: place.id, enteredOnDay: fromDay };
            npc = { ...npc, tags: [...npc.tags.filter(t => !t.startsWith(prefix)), prefix + JSON.stringify(stay)] };
            const firstHarm = stay!.enteredOnDay + tolerance + 1;
            if (toDay >= firstHarm) {
                const hurtOn = Math.max(firstHarm, fromDay + 1);
                npc = bodyTaken(npc, maxBodyOf(npc) * 0.1, hurtOn);
                const exit = place.links.filter(l => l.open && !l.requiresKeyId)
                    .map(l => state.locations.find(p => p.id === l.toLocationId))
                    .find(p => {
                        if (!p || elementalTolerance(npc.cultivation.realmOrdinal, npc.cultivation.injuries, p) !== null) return false;
                        const access = evaluateAccess(p, { realmOrdinal: npc.cultivation.realmOrdinal, onDay: hurtOn });
                        return !access.closed && access.level !== 'barred' && access.level !== 'lethal';
                    });
                if (exit) npc = { ...npc, locationId: exit.id, activity: null,
                    tags: npc.tags.filter(t => !t.startsWith(prefix)), updatedOnDay: hurtOn };
                else {
                    for (let day = hurtOn + 1; day <= toDay && npc.cultivation.hp > 0; day++) {
                        npc = bodyTaken(npc, maxBodyOf(npc) * 0.1, day);
                    }
                    if (npc.cultivation.hp <= 0) {
                        const endedOn = npc.cultivation.bodyOnDay;
                        const ended = theWorldEnds(npc, endedOn, 'The elemental ground exhausted the imperfect tribulation body.', true);
                        if (ended) {
                            npc = { ...ended, tags: ended.tags.filter(t => !t.startsWith(prefix)) };
                            state.npcs[at] = npc;
                            if (npc.status === 'physically_dead') {
                                deaths.push(settleNpcDeath(state, npc, endedOn));
                                // Settlement rewrites the purse and bonds. Keep that row.
                                continue;
                            }
                        }
                    }
                }
            }
        } else if (old) npc = { ...npc, tags: npc.tags.filter(t => !t.startsWith(prefix)) };
        if (npc.status === 'alive' && npc.activity?.kind === 'their_practice') {
            const element = expressedElement(npc.cultivation.techniqueIds);
            const id = `elemental-work:${npc.id}:${npc.activity.sinceDay}`;
            if (element && !state.objects.some(o => o.id === id)) {
                const work = makeElementalWork({ id, makerId: npc.id, makerName: npc.name,
                    locationId: npc.locationId!, ordinal: npc.cultivation.realmOrdinal,
                    injuries: npc.cultivation.injuries, element, onDay: toDay });
                if (work) state.objects.push(work);
            }
        }
        state.npcs[at] = npc;
    }
    return deaths;
}
