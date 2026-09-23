/**
 * Where somebody on no roll goes next.
 *
 * A rogue cultivator - on nobody's roll, at or above `FOUNDATION_ORDINAL`,
 * where `whatTheyDealIn` draws the line between a mortal and a cultivator - was
 * placed once and stood there for the rest of their life. Somebody who walked
 * out of a house for a road stood on that road forever, and a person seeded in
 * a town never saw another. The owner: the wanderers are rogues, people with no
 * house, and a rogue goes where the road, a ruin or a market takes them.
 *
 * ── WHERE, READ OFF WHAT EXISTS ──────────────────────────────────────────
 *
 * The same two destinations a person walking out of a house weighs, and the
 * same order (`whereTheyWouldGo`): a dao ground teaching a road they are short
 * of only by being in the wrong province, then open ground in their province
 * pitched past where they stand and survivable. With neither, somebody standing
 * anywhere but a town goes to the most peopled town of their province, which is
 * the market. Somebody in a town with nowhere worth going stays, and so does
 * somebody standing on a road they can take, which is in reach only there.
 *
 * ── HOW OFTEN ────────────────────────────────────────────────────────────
 *
 * As often as a person on a roll weighs leaving it: once in
 * {@link HOW_OFTEN_SOMEBODY_ON_NO_ROLL_WEIGHS_IT} years, on their own clock.
 *
 * ── AND WHERE THEY KEEP TO ───────────────────────────────────────────────
 *
 * A row may carry `keeps-to:<province location id>` tags - a catalog saying
 * where somebody walks - and then only destinations inside those provinces are
 * weighed.
 */

import { forStream } from '../cultivation/rng.js';
import { FOUNDATION_ORDINAL } from '../cultivation/realms.js';
import { theSpeciesItIs } from './a-beast-with-a-core-is-somebody-in-particular.js';
import {
    DAO_GROUND_TAG,
    groundAtLocation,
    howSomebodyStandsToAGround,
    standingOfNpc
} from './how-a-cultivator-comes-by-a-road.js';
import { isBelowTheLid } from './layers.js';
import type { LocationRecord } from './locations.js';
import { populationWeightOf } from './locations.js';
import { isAwayOnSomething, isTheWorldsToMove, setLocation, type NpcRecord } from './npc-state.js';
import { regionOf } from './what-people-are-saying.js';
import { whereTheyWouldGo, type SomewhereWorthGoing } from './why-somebody-walks-out-of-a-compound.js';
import type { WorldState } from './world-state.js';

/**
 * Years between one person's asking whether to move on. The walk-out pass's own
 * cadence, on a calendar clock rather than a share of a life.
 *
 * UNMEASURED: nothing counts how far a rogue actually travels over a run, or how
 * much of the rogue population is standing somewhere it could not have reached
 * on its own. What IS measured, on `afford-a`, is the stock this pass moves
 * about: 96 people on no roll at Foundation or above at 150 years, 45 at 2,500
 * and 60 at 5,000 (`the-rogues-a-world-opens-with.ts`).
 */
export const HOW_OFTEN_SOMEBODY_ON_NO_ROLL_WEIGHS_IT = 5;

/** The tag a catalog puts on somebody who keeps to named provinces. */
export const KEEPS_TO = 'keeps-to:';

/** The provinces this person keeps to, or null for anywhere. */
export function theProvincesTheyKeepTo(npc: Pick<NpcRecord, 'tags'>): Set<string> | null {
    const kept = npc.tags.filter(t => t.startsWith(KEEPS_TO)).map(t => t.slice(KEEPS_TO.length));
    return kept.length === 0 ? null : new Set(kept);
}

/** Somebody the world moves on this way. */
export function aRogueWhoMovesOn(npc: NpcRecord): boolean {
    if (npc.status !== 'alive' || npc.factionId !== null || !isBelowTheLid(npc)) return false;
    if (!isTheWorldsToMove(npc) || theSpeciesItIs(npc) !== null) return false;
    if (npc.cultivation.realmOrdinal < FOUNDATION_ORDINAL) return false;
    const doing = npc.activity;
    if (doing === null) return true;
    if (isAwayOnSomething(doing.kind)) return false;
    if (doing.untilDay !== null && doing.untilDay !== undefined) return false;
    return doing.withIds.length === 0;
}

/** The most peopled town somebody could stand in, in this province, or null. */
export function theMarketOf(state: WorldState, provinceId: string): LocationRecord | null {
    let best: LocationRecord | null = null;
    for (const place of state.locations) {
        if (place.kind !== 'settlement' || place.sealed || populationWeightOf(place) <= 0) continue;
        if (place.thresholds.entry > 0 || place.thresholds.survival > 0) continue;
        if (regionOf(state, place.id) !== provinceId) continue;
        if (best === null || populationWeightOf(place) > populationWeightOf(best)
            || (populationWeightOf(place) === populationWeightOf(best) && place.id < best.id)) best = place;
    }
    return best;
}

/** Move on whoever is due to, this year. Returns how many moved. */
export function peopleWithNoHouseMoveOn(state: WorldState, year: number, day: number): number {
    const grounds: { place: LocationRecord; ground: NonNullable<ReturnType<typeof groundAtLocation>>; province: string | null }[] = [];
    const ruins: { place: LocationRecord; province: string | null }[] = [];
    for (const place of state.locations) {
        if (!isBelowTheLid(place)) continue;
        if (place.tags.includes(DAO_GROUND_TAG)) {
            const ground = groundAtLocation(place);
            if (ground) grounds.push({ place, ground, province: regionOf(state, place.id) });
        } else if (place.kind === 'ruin' && place.discovered && !place.sealed && !place.tags.includes('forbidden')) {
            ruins.push({ place, province: regionOf(state, place.id) });
        }
    }
    const markets = new Map<string, LocationRecord | null>();
    const marketOf = (province: string): LocationRecord | null => {
        if (!markets.has(province)) markets.set(province, theMarketOf(state, province));
        return markets.get(province)!;
    };
    const byId = new Map(state.locations.map(l => [l.id, l] as const));

    let moved = 0;
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i]!;
        if (!aRogueWhoMovesOn(npc)) continue;
        if (!forStream(state.seed, 'moves-on', npc.id, year).chance(1 / HOW_OFTEN_SOMEBODY_ON_NO_ROLL_WEIGHS_IT)) continue;

        const ordinal = npc.cultivation.realmOrdinal;
        // Somebody standing on a road they can take stays on it: the road is in
        // reach only while they are there.
        const standingOnARoad = grounds.find(g => g.place.id === npc.locationId);
        if (standingOnARoad && ordinal >= standingOnARoad.ground.fromOrdinal) continue;
        const keeps = theProvincesTheyKeepTo(npc);
        const here = regionOf(state, npc.locationId);
        const allowed = (province: string | null) => province !== null && (keeps === null || keeps.has(province));
        const standing = standingOfNpc(state, npc);

        const roads: SomewhereWorthGoing[] = grounds
            .filter(g => allowed(g.province) && g.place.id !== npc.locationId
                && ordinal >= g.ground.fromOrdinal && ordinal >= g.place.thresholds.survival
                && howSomebodyStandsToAGround(g.ground, standing).shortBy === 'somewhere_else')
            .map(g => ({
                locationId: g.place.id, name: g.place.name, survivalOrdinal: g.place.thresholds.survival,
                why: `The ${g.ground.domain} road is taught by standing at ${g.place.name}.`
            }));
        const pastThem: SomewhereWorthGoing[] = ruins
            .filter(r => r.province === here && allowed(r.province) && r.place.id !== npc.locationId
                && r.place.thresholds.mastery > ordinal && ordinal >= r.place.thresholds.survival)
            .map(r => ({
                locationId: r.place.id, name: r.place.name, survivalOrdinal: r.place.thresholds.survival,
                why: `${r.place.name} is standing open, and holds more than they have.`
            }));

        let to: SomewhereWorthGoing | null = whereTheyWouldGo(roads, pastThem);
        const standingIn = npc.locationId === null ? null : byId.get(npc.locationId) ?? null;
        if (to === null && standingIn?.kind !== 'settlement') {
            const province = allowed(here) ? here : keeps === null ? null : [...keeps][0] ?? null;
            const market = province === null ? null : marketOf(province);
            if (market !== null && market.id !== npc.locationId) {
                to = { locationId: market.id, name: market.name, survivalOrdinal: 0, why: `${market.name} is where the trade is.` };
            }
        }
        if (to === null) continue;

        state.npcs[i] = {
            ...setLocation(npc, to.locationId, day),
            activity: {
                kind: 'their_own_business',
                note: `On the road. ${to.why}`,
                withIds: [],
                sinceDay: day,
                untilDay: null,
                returnTo: null
            }
        };
        moved++;
    }
    return moved;
}
