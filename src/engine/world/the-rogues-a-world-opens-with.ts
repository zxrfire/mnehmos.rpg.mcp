/**
 * The rogue cultivators a world opens with.
 *
 * `rogues.ts` opens on it: the unaffiliated *"are most of the player's peers"*.
 * A seeded world held about three hundred people on no roll, every one of them
 * below Foundation but Lu Sheng and one other - so a player's peers on the road
 * were mortals, and the only cultivators outside a house were whoever the years
 * pushed out of one. The owner: seed some, and the rest comes naturally.
 *
 * ── HOW MANY ─────────────────────────────────────────────────────────────
 *
 * The catalog gives no figure. `WHY_UNAFFILIATED` gives shares in words and
 * `ROGUE_STANDING` gives the bands a province names them in, and neither is a
 * count. So the share is named here, {@link ROGUES_FOR_EVERY_CULTIVATOR_ON_A_ROLL},
 * against the people on a roll at or above Foundation in the same province, and
 * calibrated rather than argued: the world before the departures work carried
 * about eighty-seven rogues at Foundation or above at a hundred and fifty years,
 * almost all of them people who had walked out of a house, and the figure is set
 * so that the seeded rogues and the sources that now exist - a house destroyed,
 * a house that fell, somebody thrown out, somebody who found a book or a teacher
 * - carry a world to about that. Measured at four fifths on `afford-a`, rogues
 * at Foundation or above: 96 at 150 years, 52 at 500, 45 at 2,500 and 60 at
 * 5,000. The first figure is this file's; the rest is what the sources keep up,
 * and by 5,000 years the seeded cohort is out of the count entirely - of the 60,
 * 29 had been thrown out of a house, 21 came off one that fell, 4 had never been
 * on a roll at all, 3 walked out and 1 fled a house that was destroyed.
 *
 * ── AT WHAT RUNG ─────────────────────────────────────────────────────────
 *
 * From Foundation, thinning fast. `ROGUE_STANDING`: a loose cultivator from 13,
 * a wandering senior from 21, and at 29 *"the thing that is not supposed to
 * happen, because it cannot be done on a book alone"*. Nobody is seeded there:
 * each rung above Foundation is {@link EACH_RUNG_UP_KEEPS} as likely as the one
 * below, and the draw stops short of 29 and of the province's own ceiling.
 *
 * ── WHERE ────────────────────────────────────────────────────────────────
 *
 * Where rogues live: towns and markets, open ruins, the dao grounds that teach a
 * road by standing on them, and the wilds - never a house's grounds, never inside
 * anybody's walls, and never anywhere that asks more than they have. A town is
 * weighted by how many people it holds, which puts most of them at the market.
 */

import { forStream } from '../cultivation/rng.js';
import { FOUNDATION_ORDINAL, clampOrdinal, lifespanForOrdinal } from '../cultivation/realms.js';
import type { WorldCatalog } from './catalog.js';
import { DAO_GROUND_TAG, groundAtLocation } from './how-a-cultivator-comes-by-a-road.js';
import { isBelowTheLid } from './layers.js';
import { populationWeightOf, type LocationRecord } from './locations.js';
import { createNpc, setRealm, type NpcRecord } from './npc-state.js';
import { years } from './opportunities.js';
import { ROGUE_SEEDED } from './what-becomes-of-a-houses-people-when-it-is-gone.js';
import { regionOf } from './what-people-are-saying.js';
import { drawOriginForSomebodyAlreadyAtOrdinal } from './where-the-seeded-population-was-born.js';
import { insideSomebodysWalls, nowhereToStand } from './who-goes-out-for-a-house-and-what-comes-back.js';
import type { WorldState } from './world-state.js';

/** Rogues at Foundation or above, for every person on a roll at Foundation or above in their province. */
export const ROGUES_FOR_EVERY_CULTIVATOR_ON_A_ROLL = 0.8;

/** How much likelier each rung is than the one above it, from Foundation. */
export const EACH_RUNG_UP_KEEPS = 0.72;

/**
 * The tag on somebody a house already looked at and would not have.
 *
 * `WHY_UNAFFILIATED` in `rogues.ts`: being refused at admission is *"the
 * commonest origin by a wide margin"*, and what they were refused for - root
 * quality, mostly - is not a thing that changes. So a house's intake does not
 * come back to them a decade later, which is what kept the world's rogues from
 * being rogues for long: seeded at a hundred and fifty years, one of the
 * seeded rogues was still on no roll and the rest had been recruited.
 */
export const TURNED_AWAY_AT_A_GATE = 'turned-away-at-a-gate';

/** Whether a house's intake has already looked at this person and passed. */
export function wasTurnedAwayAtAGate(npc: Pick<NpcRecord, 'tags'>): boolean {
    return npc.tags.includes(TURNED_AWAY_AT_A_GATE);
}

/**
 * Of the times a house looks at somebody standing in reach of its gate and does
 * not take them, how often that is a refusal for something about them rather
 * than a season that did not suit.
 */
export const WHAT_A_GATE_REFUSES_FOR_GOOD = 0.35;

/** The share of the seeded rogues who were turned away rather than never reached. */
export const TURNED_AWAY_RATHER_THAN_NEVER_REACHED = 0.7;

/** The rung `ROGUE_STANDING` calls the thing that is not supposed to happen. Nobody is seeded at it. */
export const WHERE_A_ROGUE_IS_NOT_SUPPOSED_TO_BE = 29;

/** The rung a seeded rogue stands at, off one sample. */
export function theRungARogueStandsAt(sample: number, ceiling: number): number {
    const top = Math.min(ceiling, WHERE_A_ROGUE_IS_NOT_SUPPOSED_TO_BE - 1);
    if (top <= FOUNDATION_ORDINAL) return clampOrdinal(Math.max(0, top));
    // Geometric from Foundation, cut at the top.
    let rung = FOUNDATION_ORDINAL;
    let left = Math.max(0, Math.min(0.999999, sample));
    let mass = 1 - EACH_RUNG_UP_KEEPS;
    while (rung < top && left >= mass) {
        left -= mass;
        mass *= EACH_RUNG_UP_KEEPS;
        rung++;
    }
    return rung;
}

/** Somewhere a rogue at this rung could be standing in this province, weighted. */
export function whereARogueCouldStand(state: WorldState, provinceId: string, ordinal: number): { place: LocationRecord; weight: number }[] {
    const out: { place: LocationRecord; weight: number }[] = [];
    for (const place of state.locations) {
        if (!isBelowTheLid(place) || place.sealed || nowhereToStand(place) || insideSomebodysWalls(place)) continue;
        if (place.thresholds.entry > ordinal || place.thresholds.survival > ordinal) continue;
        if (regionOf(state, place.id) !== provinceId) continue;
        if (place.kind === 'settlement') {
            const weight = populationWeightOf(place);
            if (weight > 0) out.push({ place, weight });
        } else if (place.tags.includes(DAO_GROUND_TAG)) {
            const ground = groundAtLocation(place);
            if (ground && ground.fromOrdinal <= ordinal) out.push({ place, weight: 1 });
        } else if ((place.kind === 'ruin' && place.discovered) || place.kind === 'wilds') {
            out.push({ place, weight: 1 });
        }
    }
    return out.sort((a, b) => (a.place.id < b.place.id ? -1 : 1));
}

/**
 * Seed the rogues. Run after everybody on a roll is placed, so the share reads
 * the rolls as the world opens with them.
 */
export function seedTheRogues(
    state: WorldState,
    catalog: WorldCatalog,
    presentDay: number,
    taken: Set<string>
): NpcRecord[] {
    const made: NpcRecord[] = [];
    for (const region of catalog.regions) {
        const province = `loc-${region.id}`;
        if (!state.locations.some(l => l.id === province)) continue;
        const onARoll = state.npcs.filter(n => n.status === 'alive' && n.factionId !== null
            && n.cultivation.realmOrdinal >= FOUNDATION_ORDINAL
            && regionOf(state, n.locationId) === province).length;
        const count = Math.round(onARoll * ROGUES_FOR_EVERY_CULTIVATOR_ON_A_ROLL);
        for (let k = 0; k < count; k++) {
            const id = `npc-rogue-${region.id}-${k}`;
            if (state.npcs.some(n => n.id === id)) continue;
            const rng = forStream(state.seed, 'the-rogues-a-world-opens-with', id);
            const ordinal = theRungARogueStandsAt(rng.next(), region.localCeilingOrdinal);
            if (ordinal < FOUNDATION_ORDINAL) continue;
            const places = whereARogueCouldStand(state, province, ordinal);
            const total = places.reduce((s, p) => s + p.weight, 0);
            if (total <= 0) continue;
            let pickAt = rng.next() * total;
            const at = places.find(p => (pickAt -= p.weight) < 0) ?? places[places.length - 1]!;
            // A SHARE OF THE LIFE THE RUNG BUYS, and not a count of years per
            // rung: Foundation grants two hundred years, and an age of sixteen
            // plus nine a rung put a seeded rogue at 130 to 170 - so they were
            // all dead of old age inside a century, and a world at a hundred and
            // fifty years held four of the ninety it opened with.
            const span = lifespanForOrdinal(ordinal);
            const age = Math.max(17, Math.round(span * (0.15 + 0.35 * rng.next())));
            let npc = createNpc(state.seed, {
                id,
                bornOnDay: presentDay - years(age),
                onDay: presentDay,
                locationId: at.place.id,
                occupation: 'unknown',
                takenNames: taken,
                origin: drawOriginForSomebodyAlreadyAtOrdinal(forStream(state.seed, 'seed-origin', id).next(), ordinal).key,
                tags: [
                    `region:${region.id}`,
                    ROGUE_SEEDED,
                    ...(rng.chance(TURNED_AWAY_RATHER_THAN_NEVER_REACHED) ? [TURNED_AWAY_AT_A_GATE] : [])
                ]
            });
            taken.add(npc.name);
            npc = setRealm(npc, ordinal, presentDay - years(rng.int(0, 8)));
            npc = {
                ...npc,
                factionId: null,
                factionRankIndex: -1,
                cultivation: { ...npc.cultivation, foundation: 'stable' }
            };
            state.npcs.push(npc);
            made.push(npc);
        }
    }
    return made;
}
