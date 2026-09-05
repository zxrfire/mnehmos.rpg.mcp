/**
 * The wrongs a world is already holding on the day it opens.
 */

import { forStream } from '../cultivation/rng.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { isBelowTheLid } from './layers.js';
import { markDead, type NpcRecord } from './npc-state.js';
import { aDeedEntersTheWorld } from './a-deed-enters-the-world-as-a-fact.js';
import type { Party } from '../social-leverage/what-a-deed-leaves.js';
import type { InheritanceRelation } from '../social/grudges.js';
import type { WorldState, FactionRecord } from './world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// THE NUMBERS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Open killings one province may be carrying on day one.
 */
export const OPEN_KILLINGS_PER_PROVINCE = 1;

/**
 * How long ago it happened, in years.
 */
const WITHIN_LIVING_MEMORY = { min: 3, max: 30 } as const;

/**
 * What it cost the person it was done to, 0..1 against what they had.
 */
const A_LIFE = 1;

// ─────────────────────────────────────────────────────────────────────────
// READING
// ─────────────────────────────────────────────────────────────────────────

export interface WrongsSeeded {
    /** Killings written. One fact and one death apiece. */
    killings: number;
    /** Living people holding a blood tie to somebody one was done to. */
    peopleWhoLostSomebody: number;
    /** Provinces that produced one. The distribution, not the total. */
    provinces: number;
}

const BLOOD = new Set(['kin', 'spouse', 'parent', 'child']);
/** How the ledger words each blood tie, in its own vocabulary. */
const AS_THE_LEDGER_PUTS_IT: Readonly<Record<string, InheritanceRelation>> = Object.freeze({
    kin: 'clan',
    spouse: 'clan',
    parent: 'descendant',
    child: 'descendant'
});

function isHere(npc: NpcRecord): boolean {
    return npc.status === 'alive' && isBelowTheLid(npc);
}

/**
 * Somebody the catalog wrote, on either side of a deed.
 */
function isCurated(npc: NpcRecord): boolean {
    return npc.tags.some(t => t.startsWith('catalog:')) || npc.id.startsWith('npc-line-');
}

function partyFor(state: WorldState, npc: NpcRecord, withKin: boolean): Party {
    const house: FactionRecord | null = npc.factionId
        ? state.factions.find(f => f.id === npc.factionId) ?? null
        : null;
    return {
        id: npc.id,
        name: npc.name,
        houseId: house?.id ?? null,
        houseName: house?.name ?? null,
        alignment: house?.alignment ?? null,
        ranked: npc.factionRankIndex >= 0,
        ...(withKin
            ? {
                kin: npc.relationships
                    .filter(r => BLOOD.has(r.kind))
                    .map(r => ({
                        id: r.targetId,
                        relation: AS_THE_LEDGER_PUTS_IT[r.kind] ?? 'clan'
                    }))
            }
            : {})
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE PASS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Put the wrongs the world is already carrying into the world's own record.
 */
export function seedTheWrongsStillOpen(
    state: WorldState,
    presentDay: number
): WrongsSeeded {
    const living: NpcRecord[] = [];
    const at = new Map<string, number>();
    for (let i = 0; i < state.npcs.length; i++) {
        at.set(state.npcs[i].id, i);
        if (isHere(state.npcs[i])) living.push(state.npcs[i]);
    }

    // Whoever is at the top of each house. Never a victim: the faction row is
    // priced on them and `seedFactions` has already handed them the top rung.
    const heads = new Set<string>();
    for (const faction of state.factions) {
        const members = living
            .filter(n => n.factionId === faction.id)
            .sort((a, b) =>
                b.cultivation.realmOrdinal - a.cultivation.realmOrdinal
                || b.factionRankIndex - a.factionRankIndex
                || (a.id < b.id ? -1 : 1));
        if (members.length > 0) heads.add(members[0].id);
    }

    const provinces = state.locations
        .filter(l => l.kind === 'region' && isBelowTheLid(l))
        .map(l => l.id)
        .sort();

    let killings = 0;
    let provincesWithOne = 0;

    for (const provinceId of provinces) {
        const under = locationIdsUnder(state, provinceId);
        const inProvince = living.filter(n =>
            n.locationId !== null && under.has(n.locationId));
        if (inProvince.length < 2) continue;

        // Its own stream, keyed on the province. A new name, so no draw in any
        // world already seeded moves, and keyed on the place rather than on a
        // counter so adding a province does not reshuffle the others.
        const rng = forStream(state.seed, 'wrongs-still-open', provinceId);

        const candidates = inProvince
            .filter(n =>
                !heads.has(n.id)
                && !isCurated(n)
                && n.relationships.some(r => BLOOD.has(r.kind)))
            .sort((a, b) => (a.id < b.id ? -1 : 1));
        if (candidates.length === 0) continue;

        // AND IT HAPPENED SOMEWHERE PEOPLE ACTUALLY STAND
        const container = new Set(
            state.locations.filter(l => l.kind === 'region').map(l => l.id));
        const inATown = candidates.filter(n =>
            n.locationId !== null && !container.has(n.locationId));
        const drawFrom = inATown.length > 0 ? inATown : candidates;

        let madeHere = 0;
        for (let draw = 0; draw < OPEN_KILLINGS_PER_PROVINCE; draw++) {
            const victim = drawFrom[rng.int(0, drawFrom.length - 1)];
            const victimAt = at.get(victim.id);
            if (victimAt === undefined) continue;
            if (state.npcs[victimAt].status !== 'alive') continue;

            const doer = whoDidIt(state, inProvince, victim, rng);
            if (!doer) continue;

            const day = presentDay - Math.round(DAYS_PER_YEAR * rng.int(
                WITHIN_LIVING_MEMORY.min, WITHIN_LIVING_MEMORY.max));

            // The record is written against the victim AS THEY STOOD, with the
            // household on it, because the kin list is what decides who ends up
            // carrying the account and the answer is only right before they die.
            const subject = partyFor(state, state.npcs[victimAt], true);
            const actor = partyFor(state, doer, false);

            aDeedEntersTheWorld(state, {
                kind: 'death',
                day,
                locationId: victim.locationId,
                actors: [
                    { id: doer.id, name: doer.name, role: 'killer' },
                    { id: victim.id, name: victim.name, role: 'victim' }
                ],
                factionIds: [
                    ...(victim.factionId ? [victim.factionId] : []),
                    ...(doer.factionId ? [doer.factionId] : [])
                ],
                summary: `${doer.name} killed ${victim.name} at `
                    + `${placeName(state, victim.locationId)}.`,
                unattributed:
                    'Somebody was found dead here some years ago and the province settled '
                    + 'on a story about it that the family has never accepted.',
                data: { deedDoerId: doer.id },
                price: {
                    deed: {
                        cause: 'killed_kin',
                        paidBy: 'subject',
                        cost: A_LIFE,
                        irreversible: true,
                        onDay: day,
                        description:
                            `${doer.name} killed ${victim.name}, and nothing has been `
                            + 'settled about it since.'
                    },
                    actor,
                    subject,
                    // Somebody is still standing there to be taken to their
                    // house, or to be found directly. `beyond` is what makes a
                    // record descend instead, and this pass does not write one
                    // nobody could ever act on.
                    reach: doer.factionId ? 'answerable' : 'unbacked',
                    // The dead hold nothing. Their people hold it from day one,
                    // which is the whole reason the family has to exist first.
                    principalCannotHoldIt: true
                }
            });

            state.npcs[victimAt] = markDead(
                state.npcs[victimAt], day, `Killed by ${doer.name}.`);
            killings++;
            madeHere++;
        }
        if (madeHere > 0) provincesWithOne++;
    }

    // Read off the world rather than accumulated, so the figure is the one a
    // consumer would get by asking the same question of the same rows.
    const dead = new Set<string>();
    for (const npc of state.npcs) if (!isHere(npc)) dead.add(npc.id);
    let peopleWhoLostSomebody = 0;
    for (const npc of state.npcs) {
        if (!isHere(npc)) continue;
        if (npc.relationships.some(r => BLOOD.has(r.kind) && dead.has(r.targetId))) {
            peopleWhoLostSomebody++;
        }
    }

    return { killings, peopleWhoLostSomebody, provinces: provincesWithOne };
}

/**
 * Who did it, off what the world already holds.
 */
function whoDidIt(
    state: WorldState,
    inProvince: readonly NpcRecord[],
    victim: NpcRecord,
    rng: { int(lo: number, hi: number): number }
): NpcRecord | null {
    const blood = new Set(
        victim.relationships.filter(r => BLOOD.has(r.kind)).map(r => r.targetId));
    const victimHouse = victim.factionId
        ? state.factions.find(f => f.id === victim.factionId) ?? null
        : null;

    const able = inProvince
        .filter(n =>
            n.id !== victim.id
            && !blood.has(n.id)
            // A CURATED FIGURE IS NEVER THE ONE WHO DID IT, for the same reason one
            // is never the victim. Found by measurement: the first version of this
            // pass, drawing from everybody able, produced "The Storm Tyrant killed
            // Lu Zhenshi at Deep Snow Village" and "First Seat killed Shen
            // Rongfeng" - the seeder writing an unsettled murder onto the record of
            // the most heavily authored people in the world, in a fact nothing in
            // the catalog says. A seeder does not argue with the writing. Whether
            // an authored figure should be allowed to have done something before
            // the world opened is a question for the person who wrote them, not for
            // this pass.
            && !isCurated(n)
            && n.cultivation.realmOrdinal > victim.cultivation.realmOrdinal)
        .sort((a, b) => (a.id < b.id ? -1 : 1));
    if (able.length === 0) return null;

    const hostile = victimHouse
        ? able.filter(n =>
            n.factionId !== null
            && n.factionId !== victimHouse.id
            && (victimHouse.standing[n.factionId] ?? 0) < 0)
        : [];
    const pool = hostile.length > 0 ? hostile : able;

    // AND THEY ARE STILL IN THE TOWN IT HAPPENED IN, WHERE THERE IS ONE
    const inTheSameTown = pool.filter(n => n.locationId === victim.locationId);
    const from = inTheSameTown.length > 0 ? inTheSameTown : pool;
    return from[rng.int(0, from.length - 1)];
}

/**
 * Every location id at or beneath a province, containers included.
 */
function locationIdsUnder(state: WorldState, regionId: string): Set<string> {
    const under = new Set<string>([regionId]);
    for (let pass = 0; pass < state.locations.length; pass++) {
        let grew = false;
        for (const location of state.locations) {
            if (location.parentId && under.has(location.parentId) && !under.has(location.id)) {
                under.add(location.id);
                grew = true;
            }
        }
        if (!grew) break;
    }
    return under;
}

function placeName(state: WorldState, locationId: string | null): string {
    if (locationId === null) return 'somewhere nobody has written down';
    return state.locations.find(l => l.id === locationId)?.name ?? locationId;
}
