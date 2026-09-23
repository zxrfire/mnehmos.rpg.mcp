/**
 * Who splits off a house of their own, and who goes with them.
 *
 * A splinter is a person's decision before it is an institution's event. The
 * pass that founded one picked a house by how many people the engine models on
 * its roll - a slice, not a house (`a-house-and-who-is-in-it.md`) - took the
 * second strongest person on it whatever they wanted, and every third person
 * below them. So a house's elders left in a body because of an ordering, and
 * the top of the world divided on a timetable: measured by the census, 483
 * houses founded over 5,000 years on 38 catalog houses.
 *
 * ── WHO ──────────────────────────────────────────────────────────────────
 *
 * Somebody senior enough to hold a gate (`couldHostAGuest`), whom their own
 * house is holding back, and who has been held back long enough on the clock of
 * their own life to weigh (`howHardBeingHeldBackPresses`, read against
 * `lifespanForOrdinal`), by more than going would cost them
 * (`whatLeavingTheirHouseCosts`: belonging, their road, the oath). Waiting on a
 * head's chair is not being held back, so a house's second never splits it for
 * being second. The one pressed hardest is the likeliest, and they go at the
 * share of the most a grievance weighs that what is left of theirs does.
 *
 * ── WITH WHOM ────────────────────────────────────────────────────────────
 *
 * People on the same roll who hold a tie to them either way, or whom the house
 * is holding back too. Not the head, not anybody away, not the player's row, and
 * never an ordering. Nobody willing, no house: somebody who goes alone has
 * walked out, and that is the walk-out pass.
 */

import type { CultivationRNG } from '../cultivation/rng.js';
import { lifespanForOrdinal } from '../cultivation/realms.js';
import { theSpeciesItIs } from './a-beast-with-a-core-is-somebody-in-particular.js';
import {
    BEING_HELD_BACK_WEIGHS_AT_MOST,
    howHardBeingHeldBackPresses,
    whereTheyAreHeldBack
} from './being-held-back-in-a-house.js';
import { isBelowTheLid } from './layers.js';
import {
    isAwayOnSomething,
    isTheWorldsToMove,
    relationshipWith,
    type NpcRecord
} from './npc-state.js';
import { couldHostAGuest } from './standing-at-the-gate-of-a-house.js';
import { whatLeavingTheirHouseCosts } from './why-somebody-walks-out-of-a-compound.js';
import type { FactionRecord, WorldState } from './world-state.js';

/** The most people who go with a founder. A house, not an exodus. */
export const THE_MOST_WHO_GO_WITH_THEM = 6;

export interface ASplit {
    parent: FactionRecord;
    founder: NpcRecord;
    leavers: NpcRecord[];
}

function hereAndFree(npc: NpcRecord): boolean {
    return npc.status === 'alive' && isBelowTheLid(npc) && isTheWorldsToMove(npc)
        && theSpeciesItIs(npc) === null
        && !(npc.activity !== null && isAwayOnSomething(npc.activity.kind));
}

/** Who would split a house this time, or null where nobody would. */
/**
 * What leaving costs somebody who is leaving to be the head of their own house,
 * as a share of what it costs somebody walking out onto a road.
 *
 * MEASURED, on `afford-a`: 76 houses founded per millennium at 1,000 years, and
 * 45 houses standing at 5,000 against 28 before. At the full cost it was 26 over
 * 2,500 years against the 215 to 246 the world produced before any of the
 * departures work - the map had stopped dividing at all.
 */
export const WHAT_LEAVING_COSTS_A_FOUNDER = 0.35;

export function whoSplitsAHouse(state: WorldState, day: number, rng: CultivationRNG): ASplit | null {
    const houses = new Map(state.factions
        .filter(f => f.dissolvedOnDay === null && isBelowTheLid(f))
        .map(f => [f.id, f] as const));

    const byId = new Map(state.npcs.map(n => [n.id, n] as const));
    const pressed: { npc: NpcRecord; house: FactionRecord; weight: number }[] = [];
    for (const npc of state.npcs) {
        if (npc.factionId === null || !hereAndFree(npc)) continue;
        const house = houses.get(npc.factionId);
        if (!house) continue;
        const rungs = house.ranks.length;
        if (npc.factionRankIndex >= rungs - 1 || !couldHostAGuest(npc.factionRankIndex, rungs)) continue;
        const lifespanYears = lifespanForOrdinal(npc.cultivation.realmOrdinal);
        const held = howHardBeingHeldBackPresses(whereTheyAreHeldBack(npc), day, lifespanYears);
        if (!(held > 0)) continue;
        // AND WHAT GOING WOULD COST THEM, which a founder weighs like anybody.
        // AND WHAT IT COSTS SOMEBODY WHO IS LEAVING TO BE THE HEAD OF SOMETHING.
        // Not what it costs somebody walking out onto a road:
        // `whatLeavingTheirHouseCosts` prices belonging, the road and the oath
        // against standing somewhere lesser, and a founder is doing the one
        // thing a senior does readily - taking their own name off somebody
        // else's gate and putting it on their own. Priced at
        // `WHAT_LEAVING_COSTS_A_FOUNDER` of it, which is what keeps the map
        // moving: with the full cost, houses founded over 2,500 years fell from
        // about 215 to 26, and the world stopped dividing at all.
        const weight = held - WHAT_LEAVING_COSTS_A_FOUNDER * whatLeavingTheirHouseCosts({
            npc, house, lifespanYears, day,
            onTheRoll: id => {
                const other = byId.get(id);
                return other !== undefined && other.status === 'alive' && other.factionId === house.id;
            }
        });
        if (weight > 0) pressed.push({ npc, house, weight });
    }
    if (pressed.length === 0) return null;

    const total = pressed.reduce((sum, p) => sum + p.weight, 0);
    let cursor = rng.next() * total;
    let chosen = pressed[pressed.length - 1]!;
    for (const p of pressed) {
        cursor -= p.weight;
        if (cursor < 0) { chosen = p; break; }
    }
    if (!rng.chance(chosen.weight / BEING_HELD_BACK_WEIGHS_AT_MOST)) return null;

    const { npc: founder, house: parent } = chosen;
    const leavers = state.npcs
        .filter(other => other.id !== founder.id
            && other.factionId === parent.id
            && hereAndFree(other)
            && other.factionRankIndex < parent.ranks.length - 1
            && (relationshipWith(other, founder.id) !== null
                || relationshipWith(founder, other.id) !== null
                || whereTheyAreHeldBack(other) !== null))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .slice(0, THE_MOST_WHO_GO_WITH_THEM);
    if (leavers.length === 0) return null;
    return { parent, founder, leavers };
}
