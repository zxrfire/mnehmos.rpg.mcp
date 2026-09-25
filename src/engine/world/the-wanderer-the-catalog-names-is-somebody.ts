/**
 * The wanderer the catalog names is somebody in the world.
 *
 * `wanderers.ts` holds one entry, Lu Sheng, the False Immortal who walks the two
 * provinces, and `false-immortals.ts` calls him the one of his kind anybody can
 * point to. He is a wanderer, which is to say a rogue: on no house's rank ladder
 * (`where-somebody-with-no-house-goes.ts` moves him the way it moves every rogue),
 * with the one difference his catalog states - he is on the Empyrean Court's roll
 * as Guest of the Court, a title outside its four rungs rather than beneath
 * them, which `faction-roll.ts` carries as an honorary title. His row carries
 * that as a tie, never as a rung: `factionId` stays null.
 *
 * ── WHAT HE DOES, AND THE CATALOG LINE EACH FIGURE ANSWERS TO ───────────
 *
 *   walks        the two provinces the catalog describes, Low Fall and the
 *                Buddha Precipice: `keeps-to:` tags on his row.
 *   the Court    *"He goes back to the Empyrean Court - not often, on no schedule"*
 *                and gives dao lectures to the four; the lecture floor holds
 *                *"perhaps forty separate afternoons ... over the last two
 *                hundred years"*: {@link VISITS_TO_THE_COURT_A_YEAR}. A lecture is
 *                a `teaching` activity with the Seats standing there in
 *                `withIds`, read by the ordinary attention reads, from his rung.
 *   inheritors   *"perhaps a dozen"* people he happened to like, over the six
 *                hundred and forty years since his crossing:
 *                {@link INHERITORS_TAKEN_A_YEAR}. Chosen by *"fate ... whoever was
 *                standing there"*, so it is whoever is standing where he is.
 *                He *"looks in every decade or so"*:
 *                {@link LOOKS_IN_ON_ONE_A_YEAR}, the same attention for one. One
 *                who has died he finds out about only by looking in.
 *
 * The catalog's living inheritor, Wei Lan, is not seeded: it states no rung, no
 * age now and no house for her, and a row would be invented rather than read.
 */

import { WANDERERS } from '../../data/cultivation/wanderers.js';
import { HOLLOW_COURT_ROSTER } from '../../data/cultivation/hollow-court-roster.js';
import { ADJACENT_REGION_ID, HOME_REGION_ID } from '../../data/cultivation/regions/region-ids.js';
import { forStream } from '../cultivation/rng.js';
import { clampOrdinal } from '../cultivation/realms.js';
import { worldIdForCatalogPerson } from './a-catalog-person-and-their-world-row.js';
import { theSpeciesItIs } from './a-beast-with-a-core-is-somebody-in-particular.js';
import { isBelowTheLid } from './layers.js';
import {
    createNpc,
    isTheWorldsToMove,
    setLocation,
    setRealm,
    upsertRelationship,
    whatACatalogStatesAsTags,
    type NpcRecord
} from './npc-state.js';
import { years } from './opportunities.js';
import { KEEPS_TO, theMarketOf } from './where-somebody-with-no-house-goes.js';
import type { WorldState } from './world-state.js';

/** Somebody's standing as a guest of a house, outside its ladder. */
export const GUEST_OF = 'guest-of:';

/** What he carries once he has found out one of his has died: `heKnows`. */
export const KNOWS_THEY_DIED = 'knows-they-died:';

/** The tag an inheritor of a wanderer carries, naming whose. */
export const INHERITOR_OF = 'inheritor-of:';

/** Forty afternoons on the lecture floor over two hundred years. */
export const VISITS_TO_THE_COURT_A_YEAR = 40 / 200;

/** A dozen inheritors over the six hundred and forty years since the crossing. */
export const INHERITORS_TAKEN_A_YEAR = 12 / 640;

/** Looks in on one every decade or so. */
export const LOOKS_IN_ON_ONE_A_YEAR = 1 / 10;

/** The world row a wanderer is seeded as. */
export function worldIdForAWanderer(wandererId: string): string {
    return `npc-${wandererId}`;
}

/** The house this person is a guest of, or null. */
export function whoseGuestTheyAre(npc: Pick<NpcRecord, 'tags'>): string | null {
    return npc.tags.find(t => t.startsWith(GUEST_OF))?.slice(GUEST_OF.length) ?? null;
}

/** Seed every wanderer the catalog names, once. Returns the rows made. */
export function seedTheWanderers(state: WorldState, presentDay: number): NpcRecord[] {
    const made: NpcRecord[] = [];
    const walks = [`loc-${HOME_REGION_ID}`, `loc-${ADJACENT_REGION_ID}`];
    // A world without the two provinces he walks - a fixture's map - is not a
    // world he is in.
    if (!walks.every(id => state.locations.some(l => l.id === id))) return made;
    const market = theMarketOf(state, walks[0]!);
    for (const wanderer of WANDERERS) {
        const id = worldIdForAWanderer(wanderer.id);
        if (state.npcs.some(n => n.id === id)) continue;
        const onTheRoster = HOLLOW_COURT_ROSTER.find(m => m.name === wanderer.recordName) ?? null;
        const ordinal = clampOrdinal(wanderer.lastOrdinal);
        let npc = createNpc(state.seed, {
            id,
            bornOnDay: presentDay - years(onTheRoster?.ageYears ?? wanderer.crossingYearsAgo),
            onDay: presentDay,
            locationId: market?.id ?? null,
            occupation: 'unknown',
            tags: [
                'catalog:wanderer',
                // WHAT THE CATALOG STATES, which the world's own passes may not
                // make false: that he is standing. Without it the killing draw
                // had one of the Court's Seats kill him in his eleventh year on
                // `demography`.
                ...whatACatalogStatesAsTags(wanderer),
                ...walks.map(p => `${KEEPS_TO}${p}`),
                ...(wanderer.affiliation.factionId ? [`${GUEST_OF}${wanderer.affiliation.factionId}`] : [])
            ]
        });
        npc = setRealm(npc, ordinal, presentDay - years(wanderer.crossingYearsAgo));
        npc = {
            ...npc,
            name: wanderer.recordName,
            factionId: null,
            factionRankIndex: -1,
            // THE YEARS HE HAS are the rung's figure less his age, which is what
            // the row already carries off `setRealm`.
            cultivation: {
                ...npc.cultivation,
                foundation: 'stable'
            },
            activity: null
        };
        state.npcs.push(npc);
        made.push(npc);
    }
    return made;
}

/** The people a guest's house seats as its audience: the catalog's Seats, standing at the seat. */
function theSeatsStandingThere(state: WorldState, houseId: string, seatId: string): NpcRecord[] {
    const seatIds = new Set(HOLLOW_COURT_ROSTER.filter(m => m.tier === 'Seat').map(m => worldIdForCatalogPerson(m.id)));
    return state.npcs.filter(n => seatIds.has(n.id) && n.status === 'alive'
        && n.factionId === houseId && n.locationId === seatId);
}

/** A year of the catalog's wanderers going about. Returns what each did, for a caller that counts. */
export function theWanderersGoAbout(state: WorldState, year: number, day: number): {
    lectures: number; lookedIn: number; newInheritors: number; foundOutAboutADeath: number;
} {
    const out = { lectures: 0, lookedIn: 0, newInheritors: 0, foundOutAboutADeath: 0 };
    const yearEnds = year * 365 + 364;
    for (const wanderer of WANDERERS) {
        const at = state.npcs.findIndex(n => n.id === worldIdForAWanderer(wanderer.id));
        if (at < 0) continue;
        let him = state.npcs[at]!;
        if (him.status !== 'alive') continue;
        // A term he was on is over: he is at nothing, and on the road again.
        if (him.activity !== null && him.activity.untilDay !== null && him.activity.untilDay !== undefined
            && him.activity.untilDay <= day) {
            him = { ...him, activity: null };
            state.npcs[at] = him;
        }
        // Anything else he was at is his own business, and he puts it down.
        if (him.activity !== null && him.activity.untilDay !== null && him.activity.untilDay !== undefined) continue;
        const rng = forStream(state.seed, 'a-wanderer-goes-about', him.id, year);

        // ── THE COURT ────────────────────────────────────────────────────
        const houseId = whoseGuestTheyAre(him);
        const house = houseId === null ? null : state.factions.find(f => f.id === houseId && f.dissolvedOnDay === null) ?? null;
        if (house !== null && house.seatLocationId !== null && rng.chance(VISITS_TO_THE_COURT_A_YEAR)) {
            const seats = theSeatsStandingThere(state, house.id, house.seatLocationId);
            if (seats.length > 0) {
                state.npcs[at] = {
                    ...setLocation(him, house.seatLocationId, day),
                    activity: {
                        kind: 'teaching',
                        note: `sitting with the ${house.name.replace(/^[Tt]he\s+/, '')}'s Seats and talking the road through`,
                        withIds: seats.map(s => s.id),
                        sinceDay: day,
                        untilDay: yearEnds
                    },
                    updatedOnDay: day
                };
                out.lectures++;
                continue;
            }
        }

        // ── LOOKING IN ON ONE HE ALREADY HAS ─────────────────────────────
        const theirs = him.relationships.filter(r => r.kind === 'client');
        const due = theirs.find(() => rng.chance(LOOKS_IN_ON_ONE_A_YEAR));
        if (due !== undefined) {
            const j = state.npcs.findIndex(n => n.id === due.targetId);
            const them = j < 0 ? null : state.npcs[j]!;
            if (them !== null && them.status === 'alive' && them.locationId !== null && isBelowTheLid(them)) {
                state.npcs[at] = {
                    ...setLocation(him, them.locationId, day),
                    activity: {
                        kind: 'teaching',
                        note: `looking in on ${them.name}, and asking two or three questions`,
                        withIds: [them.id],
                        sinceDay: day,
                        untilDay: yearEnds
                    },
                    updatedOnDay: day
                };
                out.lookedIn++;
                continue;
            }
            if (them !== null && them.status !== 'alive' && !him.tags.includes(`${KNOWS_THEY_DIED}${due.targetId}`)) {
                // He finds out by going back that way and finding somebody else there.
                state.npcs[at] = { ...him, tags: [...him.tags, `${KNOWS_THEY_DIED}${due.targetId}`], updatedOnDay: day };
                out.foundOutAboutADeath++;
                continue;
            }
        }

        // ── AND, NOW AND AGAIN, WHOEVER IS STANDING THERE ────────────────
        if (him.locationId !== null && rng.chance(INHERITORS_TAKEN_A_YEAR)) {
            const here = state.npcs.filter(n => n.id !== him.id && n.status === 'alive'
                && n.locationId === him.locationId && isBelowTheLid(n) && isTheWorldsToMove(n)
                && theSpeciesItIs(n) === null && !n.tags.some(t => t.startsWith(INHERITOR_OF)));
            if (here.length > 0) {
                const chosen = here[rng.int(0, here.length - 1)]!;
                const j = state.npcs.findIndex(n => n.id === chosen.id);
                state.npcs[at] = upsertRelationship(state.npcs[at]!, {
                    targetId: chosen.id, targetName: chosen.name, kind: 'client', standing: 0.4,
                    note: 'Somebody he happened to like, and left something for.'
                }, day);
                state.npcs[j] = upsertRelationship({
                    ...chosen, tags: [...chosen.tags, `${INHERITOR_OF}${him.id}`]
                }, {
                    targetId: him.id, targetName: him.name, kind: 'patron', standing: 0.3,
                    note: 'A stranger who talked for an afternoon and left something behind.'
                }, day);
                out.newInheritors++;
            }
        }
    }
    return out;
}
