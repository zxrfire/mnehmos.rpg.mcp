/**
 * The wrongs a world is already holding on the day it opens.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE MEASUREMENT THIS EXISTS FOR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Three fresh worlds, seeds `census-a/b/c`, ~100 historical facts apiece:
 *
 *     facts carrying `deedWeight`     0   0   0
 *
 * and by kind, every one of them: `era_opened`, `faction_founded`, `ascension`,
 * `spirit_tide`, `war`, `faction_fallen`, `ruin_sealed`, `tribulation_scar`,
 * `ruin_opened`. Institutions and geography, going back 2,700 years, with
 * synthetic actor ids belonging to nobody the world holds a row for.
 *
 * So `aPricedWrongDoneTo` - the filter every telling runs through - matched
 * NOTHING in a fresh world, for any hearer, about any of the several hundred
 * people standing in it. On turn one there was not one wrong anybody in the
 * world could hold an account about, which made the `tell` verb, the inherited
 * grudge, the unnamed account and every house-acts-for-its-own path reachable
 * only after the player had personally caused something.
 *
 * ── AND NOTHING IN `src/engine/world/` PRICES A DEED ─────────────────────
 *
 * Every caller of `aDeedEntersTheWorld` is in `src/web/` - a player verb. That
 * was checked before this was written, because in this repo the prior is that
 * it already exists. It does not. What exists is the two halves it is built
 * from, and both are used unchanged here: `whatADeedLeaves` prices, and
 * `aDeedEntersTheWorld` writes. This file decides only WHO and HOW OFTEN.
 *
 * ── A NEIGHBOURING DEFECT, FOUND AND DELIBERATELY NOT FIXED HERE ─────────
 *
 * `what-a-confrontation-does-to-somebody-the-world-holds.ts` writes the world's
 * own killings - the ones a war produces, one per body, with the killer and the
 * victim both named on the fact. It writes them with `appendWorldFact(makeFact(
 * ...))` directly rather than through `aDeedEntersTheWorld`, so **no killing the
 * simulation has ever produced carries a `deedWeight`**, and `aPricedWrongDoneTo`
 * rejects all of them. It already computes the severity - `accountsFor` reads it
 * off `whatFollowsFromTheBout` - four lines below the write.
 *
 * That is one call site, not a new pricer, and it is the difference between the
 * telling layer working for a hundred years of simulated history and working
 * only for the fifteen minutes the player has been playing. It is not changed
 * here because it sits on the world tick's write path and belongs to whoever is
 * holding that. It is written down so it is not found a sixth time.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT A SEEDED WRONG IS ALLOWED TO BE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Indistinguishable downstream from one a player caused. That is the whole
 * constraint and it decides the shape:
 *
 *   PRICED BY THE ONE PRICER   `whatADeedLeaves`, through
 *                              `aDeedEntersTheWorld`'s `price` branch. Nothing
 *                              in this file names a severity. A killing here
 *                              costs what a killing costs.
 *   WRITTEN BY THE ONE WRITER  so it lands on the record of everybody it names
 *                              and on the people standing there, carries
 *                              `unattributed` for anybody with no standing to
 *                              be told, and is picked up by `circulating`,
 *                              `digest` and the market repeat like any other.
 *   DONE BY SOMEBODY WHO IS
 *   STILL STANDING THERE       an account against a name nobody can find is not
 *                              an account. The doer is a living person in the
 *                              world with a row, a house and a location.
 *
 * ── THE PERSON IT WAS DONE TO IS SOMEBODY THE WORLD ALREADY HAD ──────────
 *
 * Not somebody invented for it. The pass takes a person the seeder placed, who
 * has a household `the-families-a-world-opens-holding.ts` has just given them,
 * and records that they are dead and who did it. Their family's rows keep
 * pointing at them - `tieSupply` is explicit that a tie to a grave is kept -
 * so the survivors hold exactly what `whoTheyCarryFor` reads: a `kin`, `parent`
 * or `child` row naming somebody a priced wrong was done to.
 *
 * They were counted in `populationTarget` before they died, which is correct
 * and is why the world starts very slightly under it: the world lost these
 * people and `applyDemography` will replace them over the following years, the
 * same as it replaces anybody.
 *
 * WHO IS NEVER THE VICTIM, and each of these is a guard rather than a taste:
 *
 *   A CURATED FIGURE  anybody tagged `catalog:` or standing in
 *                     `THE_LINE_AT_MILLRUN`. Killing authored content in a
 *                     seeder is the seeder arguing with the writing.
 *   A HOUSE'S HEAD    `seedFactions` sets `power_ordinal` from its strongest
 *                     member and hands them the top rung. Killing them leaves
 *                     the faction row claiming a dead leader.
 *
 * ── WHY THIS ONE, BY THIS ONE ────────────────────────────────────────────
 *
 * The engine does not model motive and this pass does not invent one. What it
 * uses is what the world already holds:
 *
 *   THE HOUSES ARE AT FEUD   `seedFactions` writes `standing[rivalId] = -0.6`
 *                            off the catalog's `rivals` lists. Where the
 *                            victim's house has somebody hostile to it standing
 *                            in reach, that is who it was.
 *   OR THEY WERE SIMPLY
 *   STRONGER AND THERE       the fallback, and the record claims nothing more
 *                            than that. `magnitude`, `visibility` and the
 *                            unattributed line all come out of the pricer.
 *
 * Nothing branches on faction, alignment, tier or importance in either
 * direction, and there is no table keyed on a kind of deed.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE RATE, AND THE ARGUMENT FOR IT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * This is the number the design owner's brake is pointed at: *a world where
 * everybody has a dead brother is as broken as one where nobody does.*
 *
 * So the rate is not a share of the population. It is **at most one open
 * killing per province**, drawn from the households that province actually
 * contains, and a province that has none produces none. That gives a fresh
 * world of ~595 people a low double figure of unavenged deaths - a fraction of
 * a percent of the living, and a handful of percent of the people who have a
 * family at all - which is what an age of decline with feuding houses in it
 * should read as. It is also enough that a province the player is standing in
 * has one, which is the thing that has to be true for any of the layer to be
 * reachable on turn one.
 *
 * Per PROVINCE rather than per world, because per world is a number that stops
 * meaning anything as soon as somebody changes the map, and because the
 * distribution is the claim: one wrong somewhere is not the same world as ten
 * wrongs in one county.
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
 *
 * One. Not a rate over people, and not a rate over houses - a province is the
 * unit a player moves through and the unit the ceiling and the ground are
 * already stated in, so it is the unit a reader can check by walking around.
 */
export const OPEN_KILLINGS_PER_PROVINCE = 1;

/**
 * How long ago it happened, in years.
 *
 * Inside the memory of everybody it touched and old enough that the province
 * has stopped talking about it - which is what leaves the family holding it and
 * nobody else raising it. The news layer decays a fact over four centuries, so
 * anything in this band still circulates.
 */
const WITHIN_LIVING_MEMORY = { min: 3, max: 30 } as const;

/**
 * What it cost the person it was done to, 0..1 against what they had.
 *
 * One, and it is not a tuning constant: `whatItWasWorth` reads the cost
 * relative to what the payer had, and a life is all of it. Together with
 * `irreversible` this is what makes a killing price out at the top of the
 * ladder without this file naming a severity.
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
 *
 * `catalog:` is `seedNamedFigures`'s own tag and `npc-line-` is
 * `seedTheLineThatCameDown`'s own id prefix, so this asks the two seeders
 * their own question rather than keeping a list.
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
 *
 * Called once, from `seedWorld`, AFTER the families - a wrong done to somebody
 * nobody carries for is a wrong nobody can be told about, and this pass will
 * simply find no victim if it runs first.
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

        // ── AND IT HAPPENED SOMEWHERE PEOPLE ACTUALLY STAND ──────────────
        //
        // A province node is a container, not a place: `present` puts nobody in
        // the same room as somebody standing on one, so a family grieving on a
        // container is a family the player can never be told to be sorry for.
        //
        // Measured before this preference existed. On the pinned world
        // `accept-world`, all five bereaved households stood on region
        // containers - `loc-region-low-fall`, `loc-region-white-stair-undersnow`
        // - and three different run seeds each opened in a settlement inside one
        // of those provinces and found nobody present to tell. The verb reached
        // nought, on a world that finally had wrongs in it.
        //
        // The underlying cause is that `seedPopulation` still places people on
        // province containers, which is the defect `applyDemography` was fixed
        // for - "people are born where people can live" - and which the seeder
        // has not had done to it. That is not this pass's to fix. What this pass
        // can do is prefer the households that are somewhere real, which is also
        // the truer statement: a killing the province still argues about
        // happened in a town, in front of people.
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
 *
 * Somebody who could have - strictly further up the ladder - who is not blood
 * to the victim and is not the victim. Preferring, where the world offers one,
 * somebody from a house the victim's house is already at feud with, which is a
 * fact `seedFactions` wrote from the catalog's own rivalry lists rather than
 * anything decided here.
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
            // A CURATED FIGURE IS NEVER THE ONE WHO DID IT, for the same reason
            // one is never the victim. Found by measurement: the first version
            // of this pass, drawing from everybody able, produced "The Storm
            // Tyrant killed Lu Zhenshi at Undersnow" and "First Seat killed Shen
            // Rongfeng" - the seeder writing an unsettled murder onto the record
            // of the most heavily authored people in the world, in a fact
            // nothing in the catalog says. A seeder does not argue with the
            // writing. Whether an authored figure should be allowed to have
            // done something before the world opened is a question for the
            // person who wrote them, not for this pass.
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

    // ── AND THEY ARE STILL IN THE TOWN IT HAPPENED IN, WHERE THERE IS ONE ─
    //
    // Not a rule about murderers. It is what makes the account NAMEABLE:
    // `partyPutTo` resolves a name the player says against who is in scope, so
    // a killer two provinces away cannot be put on the row and the telling opens
    // the unnamed form instead. Measured - the first version drew the doer from
    // the whole province and the played telling came back *"you have given them
    // nobody to put it on"*, which is a real and designed state and is not the
    // one a player standing in front of both of them should get.
    //
    // It is also the likelier account of what happened. Two people who were in
    // the same town are the two people who met.
    const inTheSameTown = pool.filter(n => n.locationId === victim.locationId);
    const from = inTheSameTown.length > 0 ? inTheSameTown : pool;
    return from[rng.int(0, from.length - 1)];
}

/**
 * Every location id at or beneath a province, containers included.
 *
 * The same walk `the-world-changing-on-its-own.ts` does for the birth pass, and
 * a copy rather than an import because that one is private to the world tick
 * and the tick is not this pass's file to edit. If it is ever lifted into
 * `locations.ts`, delete this and import it.
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
