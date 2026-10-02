/** Background opportunities contribute a rate; only a bounded draw is resolved. */
import type { CultivationRNG } from '../cultivation/rng.js';
import { isTheWorldsToMove, type NpcRecord } from './npc-state.js';
import type { WorldState } from './world-state.js';
import { theAreasOf } from './where-in-a-place-somebody-is-standing.js';
import { getLocation } from './world-state.js';
import { whereYouCanActFrom } from './something-acting-in-your-place.js';

type ContactPlace = string | { placeId: string; areaId: string; person?: NpcRecord };
const PLAYER_PLACES = new WeakMap<WorldState, { place?: ContactPlace; players: NpcRecord[]; nearby?: Set<string>; day: number }>();

export function resolveWithPlayerPresent<T>(world: WorldState, place: ContactPlace | undefined, resolve: () => T,
    day = world.currentDay): T {
    const previous = PLAYER_PLACES.get(world);
    PLAYER_PLACES.set(world, { place: place ?? previous?.place,
        players: previous?.players ?? world.npcs.filter(n => !isTheWorldsToMove(n)), day });
    try { return resolve(); } finally {
        if (previous) PLAYER_PLACES.set(world, previous); else PLAYER_PLACES.delete(world);
    }
}

export function isPlayerInvolved(world: WorldState, person: NpcRecord): boolean {
    if (!isTheWorldsToMove(person)) return true;
    const context = PLAYER_PLACES.get(world);
    const players = context?.players ?? world.npcs.filter(n => !isTheWorldsToMove(n));
    const place = context?.place;
    if (context && typeof place === 'object' && context.nearby === undefined) {
        const location = getLocation(world, place.placeId);
        const player = place.person ?? players[0];
        const makers = new Set(world.objects.filter(object => object.locationId === place.placeId
            && object.tags.includes('acting-proxy') && object.ownerId !== null).map(object => object.ownerId!));
        const remote = [...makers].flatMap(id => {
            const presence = whereYouCanActFrom(world, id, context.day);
            return presence?.locationId === place.placeId && typeof presence.data.standingIn === 'string'
                ? [{ id, standingIn: presence.data.standingIn }] : [];
        });
        context.nearby = new Set(location ? [...theAreasOf(world, location, undefined, player ? {
            id: player.id, sectId: player.factionId, standingIn: place.areaId,
            others: remote
        } : undefined).whereIs]
            .filter(([, area]) => area === place.areaId).map(([id]) => id) : []);
    }
    const withSomeone = (npc: NpcRecord, id: string) => npc.activity !== null
        && (npc.activity.untilDay == null || npc.activity.untilDay >= (context?.day ?? world.currentDay))
        && npc.activity.withIds.includes(id);
    return context?.nearby?.has(person.id) === true
        || person.locationId !== null && (typeof place === 'string' && person.locationId === place
        || place === undefined && players.some(player => player.locationId === person.locationId))
        || players.some(player => withSomeone(player, person.id) || withSomeone(person, player.id))
        || players.some(player => person.goals.some(goal => goal.status === 'active' && goal.targetId === player.id));
}

export function drawBackgroundIncidents<T>(opportunities: readonly { value: T; rate: number }[],
    rng: CultivationRNG, cap: number): T[] {
    const pool = opportunities.filter(row => row.rate > 0);
    let total = pool.reduce((sum, row) => sum + row.rate, 0);
    const rate = Math.min(cap, total);
    const count = Math.min(pool.length, cap, Math.floor(rate) + Number(rng.chance(rate % 1)));
    const out: T[] = [];
    for (let draw = 0; draw < count; draw++) {
        let at = rng.next() * total;
        let selected = pool.length - 1;
        for (let i = 0; i < pool.length; i++) {
            at -= pool[i]!.rate;
            if (at < 0) { selected = i; break; }
        }
        const row = pool.splice(selected, 1)[0]!;
        total -= row.rate;
        out.push(row.value);
    }
    return out;
}
