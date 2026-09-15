/**
 * The wrongs a world is already holding on the day it opens.
 *
 * ── A WRONG MAY NAME SOMEBODY THE CATALOG WROTE ──────────────────────────
 *
 * It did not, and the refusal was argued. The first cut of this pass drew from
 * everybody able and produced *"The Storm Tyrant killed Lu Zhenshi at Deep Snow
 * Village"* - the seeder writing an unsettled murder onto the record of the most
 * heavily authored people in the world, asserted by nothing in the catalog. The
 * guard that followed said a seeder does not argue with the writing, and it was
 * right about the part it could see.
 *
 * WHAT IT WAS ACTUALLY PROTECTING, on inspection, was two different things
 * wearing one rule:
 *
 *   THE WRITING, which is the catalog's to change and not a seeder's. The design
 *   owner has now ruled on it directly - *wrongs may touch authored figures* -
 *   so this half is lifted. A killing minted for one world is that world's
 *   history rather than a claim about the person, which is the same distinction
 *   `members.ts` states from the other end: a marriage is a fact about somebody
 *   and is hardcoded; a grudge is a fact about a world and must not be.
 *
 *   A FIGURE THE WORLD READS A NUMBER OFF, which is mechanical and survives. A
 *   house's `power_ordinal` is its strongest member, so killing that person
 *   leaves the faction row priced on a corpse. That rule is `heads` below, it was
 *   always separate, it has nothing to do with who wrote anybody, and it is what
 *   keeps the head of an apex out of a casual murder in every world.
 *
 * ── AND IT IS MINTED, NEVER SEEDED ───────────────────────────────────────
 *
 * The owner again, in the same breath: *"not itself seeded so unique."* Nothing
 * about this killing is written in a catalog. It is drawn once, as the world is
 * laid out, from that world's own stream - so two worlds off two seeds carry
 * different killings between different people, and a player who has read every
 * word of the catalog still does not know who died here.
 *
 * ── WHAT IT COSTS THE MORTAL SWEEP ───────────────────────────────────────
 *
 * `theWorldForgetsTheMortalDead` deletes a mortal who dies and keeps anybody a
 * priced deed names, and that exception exists because of this pass: a man whose
 * brother still carries the account for his killing is not one of the farmers
 * the engine was never able to say anything about. Where the victim is somebody
 * the catalog wrote the exception is not needed - they are kept by name at any
 * rung - and where the victim is a procedural mortal it still is. Both happen.
 * See the test for the split.
 */

import { forStream } from '../cultivation/rng.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { isBelowTheLid } from './layers.js';
import { settleNpcDeath } from './time.js';
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
    // This is the one refusal that survived the catalog guard being lifted, and
    // it is mechanical rather than editorial - it reads the roll, not the
    // byline, so it covers an authored apex and a procedural one alike.
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

            // SETTLED BEFORE THEY ARE MARKED, so the estate reads a live purse
            // rather than a corpse's. This site called `markDead` and nothing
            // else, so a world that opens with killings already in it opened
            // with that many bodies still holding everything they had - and
            // holding it for the whole life of the world, because nothing looks
            // at a dead row again.
            settleNpcDeath(state, state.npcs[victimAt], day);
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

    // Somebody able, who is not the victim's own household. Authorship is not
    // asked about on this side either - see the header - and the one thing that
    // is still refused is refused for a reason about the world rather than about
    // the writing: somebody standing BELOW the person they killed did not.
    const able = inProvince
        .filter(n =>
            n.id !== victim.id
            && !blood.has(n.id)
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
