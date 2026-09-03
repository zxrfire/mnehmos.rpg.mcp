/**
 * Settling what a dead cultivator was carrying, against the real database.
 *
 * `engine/world/estate-at-death.ts` decides where each thing goes; this does
 * the writing. One entry point, {@link settleWhatTheyWereCarrying}, so that
 * putting a death into the world is one import and one call at whichever line
 * declares somebody dead.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY THE COUNTED HALF GOES INTO THE CACHE LEDGER
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `docs/world/things/economy.md` rules that a grave is involuntary, holds
 * whatever they happened to be carrying, is protected only by whatever settled
 * or grew up around it since, and never refuses anybody. That is exactly a
 * cache with nobody's cleverness in it - so it is written as one, in
 * `cultivation_sites`, through `LegacyLedger`, which is the same row the
 * digging verb in `leaving-things-for-the-next-life.ts` already reads and the
 * same discovery hazard already applies to.
 *
 * That is not a second answer to a question the catalog settled. It is the
 * catalog's answer, reached involuntarily: `daysSpent` is the floor and
 * `burierOrdinal` is zero, because nobody hid anything. What stands between a
 * later life and the goods is the ground and the years, which is what the
 * ruling says it should be.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NOTHING IN `src/` CALLS THIS YET, AND THAT IS THE ONE THING TO FIX NEXT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The call belongs in `game.ts`, immediately after phase 2, because six
 * separate lines in that file can end a life and a settlement per death site
 * is six chances to forget one. `game.ts` was held by another agent when this
 * was written, so the hunk was handed over rather than applied, and this note
 * stands until it lands. Until then a death still leaves nothing behind in a
 * played run - the code exists and the world does not reach it, which is
 * exactly the shape AGENTS.md files under "a module nothing calls is not a
 * feature", said out loud rather than left to be discovered.
 *
 * Two properties make the call site cheap and safe: it is idempotent (the
 * cache id is derived from the run, `LegacyLedger.write` upserts on it, and
 * `enshrineRun` will not build a second grave for an id it already placed),
 * and it needs nothing but the state that is already in hand at that line.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THIS DELIBERATELY DOES NOT DO
 * ═════════════════════════════════════════════════════════════════════════
 *
 * No wills, no named heirs, no contested estates. A body on the ground has
 * none of those. `enshrineRun` already passes unfinished GOALS and grudges to a
 * lineage heir where one exists, and that is the whole of the inheritance in
 * this path - it moves what somebody was trying to do, never what they owned.
 */

import type Database from 'better-sqlite3';

import type { Cultivator } from '../schema/cultivation.js';
import {
    settleEstate,
    leftSomething,
    type CountedGoods,
    type EstateAtDeath,
    type NamedParty,
    type TrackedThing
} from '../engine/world/estate-at-death.js';
import { enshrineRun } from '../engine/world/legacy.js';
import { getNpc, getObject, upsertNpc, upsertObject, type WorldState } from '../engine/world/world-state.js';
import type { ObjectRecord } from '../engine/world/possessions.js';
import { getArtifact } from '../data/cultivation/artifacts.js';
import { listCarriedArtifacts, listPouch } from '../server/consolidated/cultivation-support.js';
import {
    LegacyLedger,
    describeGoods,
    groundOf,
    nameOfStack,
    type CacheRecord,
    type LegacyGoods
} from './leaving-things-for-the-next-life.js';
import { worldLocationFor } from './entities.js';
import type { EngineFacts } from './facts.js';

// ─────────────────────────────────────────────────────────────────────────
// READING THE BODY
// ─────────────────────────────────────────────────────────────────────────

/**
 * What a rated object in a pouch is, as an object row.
 *
 * The world already holds a row for every catalogued artifact, so the ordinary
 * case is that the thing being moved is one the world can already be asked
 * about. `worldRow` is only taken where the world agrees the dead cultivator
 * had it - possessed by them, or possessed by nobody.
 *
 * ── THE CASE THAT IS REFUSED, AND WHY IT IS REPORTED RATHER THAN FIXED ───
 *
 * Where the world says somebody ELSE is holding it, the pouch row and the world
 * row are two accounts of one singular object and this is not the place that
 * reconciles them. Minting a second row would put two copies of a singular
 * thing in the catalog, which `possessions.ts` calls out by name; overwriting
 * the world's possessor would rewrite a house's property register on the
 * strength of a pouch row nobody checked. So neither happens, and the
 * discrepancy goes in the structure line where a reader can see it.
 */
function trackedOnTheBody(
    db: Database.Database,
    world: WorldState,
    dead: NamedParty
): { tracked: TrackedThing[]; unaccounted: string[] } {
    const tracked: TrackedThing[] = [];
    const unaccounted: string[] = [];

    for (const entry of listCarriedArtifacts(db, dead.id)) {
        const catalog = getArtifact(entry.itemId);
        if (!catalog) {
            unaccounted.push(`${entry.itemId}: no catalog row, so nothing to move`);
            continue;
        }
        const worldRow = getObject(world, catalog.id);
        if (worldRow && worldRow.possessorId !== null && worldRow.possessorId !== dead.id) {
            unaccounted.push(
                `${catalog.id}: the world says ${worldRow.possessorId} is holding it, so the pouch row `
                + 'is a copy nothing reconciled. Not moved and not duplicated.'
            );
            continue;
        }
        tracked.push({
            itemId: catalog.id,
            name: catalog.name,
            kind: catalog.kind,
            significance: catalog.significance,
            power: catalog.power,
            description: catalog.description,
            worldRow: worldRow ?? null
        });
    }

    return { tracked, unaccounted };
}

/** Stones and counted stock, straight off the row. */
function countedOnTheBody(db: Database.Database, cultivator: Cultivator): CountedGoods {
    return {
        spiritStones: Math.max(0, Math.round(cultivator.spiritStones)),
        stock: listPouch(db, cultivator.id).map(entry => ({
            itemId: entry.itemId,
            kind: entry.kind as 'pill' | 'herb',
            quantity: entry.quantity
        }))
    };
}

/**
 * Take it all off the corpse.
 *
 * By statement rather than through `CultivatorRepo`, and that needs saying: the
 * repository refuses to write to a dead cultivator on purpose, because the game
 * must not be able to act through one. Settling an estate is not the corpse
 * acting - it is the world taking the things off a body that no longer holds
 * anything - and it is the one write that has to happen after the row is dead.
 *
 * It runs only once the goods are somewhere else. A corpse that has been
 * emptied into nothing is worse than one that was never emptied.
 */
function emptyTheBody(db: Database.Database, cultivatorId: string): void {
    db.prepare('DELETE FROM cultivator_pouch WHERE cultivator_id = ?').run(cultivatorId);
    db.prepare("UPDATE cultivators SET spirit_stones = 0, updated_at = datetime('now') WHERE id = ?")
        .run(cultivatorId);
}

// ─────────────────────────────────────────────────────────────────────────
// THE CACHE IN THE GROUND
// ─────────────────────────────────────────────────────────────────────────

/** The counted half as `LegacyGoods`, which is the ledger's own shape. */
function asLegacyGoods(counted: CountedGoods): LegacyGoods {
    return {
        spiritStones: counted.spiritStones,
        items: counted.stock.map(s => ({ itemId: s.itemId, kind: s.kind, quantity: s.quantity }))
    };
}

/**
 * A cache row for what was on a body nobody went through.
 *
 * Nothing about this is a burial. `daysSpent` is 1 - the floor, which
 * `concealmentFactor` reads as "a hole and nothing more" - and `burierOrdinal`
 * is 0, because whatever the dead cultivator could do, they did not do it to
 * this. What protects the goods is the ground and how long it has been, which
 * is the ruling in `economy.md` about what a grave is protected by.
 */
export function graveAsACache(
    input: {
        id: string;
        runId: string;
        place: string;
        goods: LegacyGoods;
        onWorldDay: number | null;
    }
): CacheRecord {
    const ground = groundOf(input.place);
    return {
        kind: 'cache',
        id: input.id,
        buriedByRunId: input.runId,
        place: input.place,
        ground,
        burial: { ground, daysSpent: 1, burierOrdinal: 0, anchored: false, watchers: 0 },
        buriedOnWorldDay: input.onWorldDay,
        goods: input.goods,
        liftedOnWorldDay: null,
        liftedByRunId: null,
        goneOnWorldDay: null,
        fromDepositId: null
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────

export interface EstateDeps {
    db: Database.Database;
    /** The world this life was lived in. Null where the world is switched off. */
    world: WorldState | null;
    ledger: LegacyLedger;
    /** The dead cultivator, read AFTER the death was written to the row. */
    cultivator: Cultivator;
    runId: string;
    /** How it ended, in the engine's words. Never softened. */
    causeNote: string;
    /**
     * Who was standing close enough to go through the body, in the order the
     * caller considers them. `othersPresent` is what this is for.
     */
    standingOver: readonly NamedParty[];
    /** False for a death that leaves nothing to search. Defaults to true. */
    leavesBody?: boolean;
}

export interface EstateOutcome {
    estate: EstateAtDeath;
    /** The cache written into the ground, where one was. */
    cache: CacheRecord | null;
    /** The grave `enshrineRun` put on the map, where it made one. */
    graveLocationId: string | null;
    /** Chronicle fact ids this death wrote. */
    factIds: string[];
    /** Tracked rows written back to the world. */
    objects: ObjectRecord[];
    /** True where the world was changed and needs saving. */
    worldDirty: boolean;
    facts: EngineFacts;
}

/**
 * Put a death into the world, and the dead cultivator's things with it.
 *
 * Idempotent by construction on the two halves that could double: the cache id
 * is derived from the run and `LegacyLedger.write` upserts on it, and
 * `enshrineRun` will not build a second grave for an id that already exists.
 * Calling it twice for one death moves nothing twice.
 */
export function settleWhatTheyWereCarrying(deps: EstateDeps): EstateOutcome {
    const { db, world, cultivator } = deps;
    const dead: NamedParty = { id: cultivator.id, name: cultivator.name };
    const leavesBody = deps.leavesBody ?? true;
    const place = cultivator.location ?? 'the open road';
    const worldDay = world ? Math.floor(world.currentDay) : null;

    const counted = countedOnTheBody(db, cultivator);
    const found = world
        ? trackedOnTheBody(db, world, dead)
        : { tracked: [] as TrackedThing[], unaccounted: ['no world is running, so no object row was read'] };

    // ── THE WORLD IS TOLD FIRST ──────────────────────────────────────────
    //
    // The grave, the chronicle fact, what the house remembers and which heir
    // picks up the unfinished business. Its own module has owned all of that
    // since it was written and nothing called it. The goods are deliberately
    // NOT handed to it: the counted half goes into the ledger below, and the
    // tracked half is a world row being moved rather than a copy being minted,
    // which is a distinction `enshrineRun` does not draw.
    let graveLocationId: string | null = null;
    const factIds: string[] = [];
    if (world && getNpc(world, cultivator.id)) {
        const enshrined = enshrineRun(world, {
            npcId: cultivator.id,
            onDay: worldDay ?? 0,
            causeNote: deps.causeNote,
            carried: [],
            spiritStones: 0,
            leavesBody
        });
        graveLocationId = enshrined.grave?.id
            ?? getNpc(world, cultivator.id)?.locationId
            ?? null;
        for (const fact of enshrined.facts) factIds.push(fact.id);
    }

    const estate = settleEstate({
        dead,
        onDay: worldDay ?? 0,
        locationId: graveLocationId ?? (world ? worldLocationFor(world, place)?.id ?? null : null),
        counted,
        tracked: found.tracked,
        standingOver: deps.standingOver,
        causeNote: deps.causeNote,
        leavesBody
    });

    // ── THE TRACKED ROWS ─────────────────────────────────────────────────
    if (world) {
        for (const object of estate.objects) Object.assign(world, upsertObject(world, object));

        // And the stones, where somebody took them. An NPC's purse is a number
        // on their row, so this is the whole of what "they took it" means for
        // the counted tier: pills and herbs have no representation on anybody
        // but the player, and `items.md` is explicit that a counted thing can
        // simply be absorbed as stock.
        if (estate.taken && estate.taker && estate.taken.spiritStones > 0) {
            const taker = getNpc(world, estate.taker.id);
            if (taker) {
                Object.assign(world, upsertNpc(world, {
                    ...taker,
                    spiritStones: Math.max(0, taker.spiritStones + estate.taken.spiritStones)
                }));
            }
        }
    }

    // ── THE CACHE, WHERE NOBODY WAS THERE ────────────────────────────────
    let cache: CacheRecord | null = null;
    if (estate.buried) {
        cache = graveAsACache({
            id: `cache::${deps.runId}::death`,
            runId: deps.runId,
            place,
            goods: asLegacyGoods(estate.buried),
            onWorldDay: worldDay
        });
        deps.ledger.write(cache, `what ${cultivator.name} was carrying`, worldDay);
    }

    // Only once everything is somewhere else.
    emptyTheBody(db, cultivator.id);

    return {
        estate,
        cache,
        graveLocationId,
        factIds,
        objects: estate.objects,
        worldDirty: world !== null,
        facts: factsForEstate(deps, estate, cache, graveLocationId, found.unaccounted)
    };
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE ENGINE SAYS ABOUT IT
// ─────────────────────────────────────────────────────────────────────────

function factsForEstate(
    deps: EstateDeps,
    estate: EstateAtDeath,
    cache: CacheRecord | null,
    graveLocationId: string | null,
    unaccounted: readonly string[]
): EngineFacts {
    const place = deps.cultivator.location ?? 'the open road';
    const lines: string[] = [];

    if (!leftSomething(estate)) {
        lines.push('There was nothing on them. Whatever they had went before they did.');
    } else if (estate.destination === 'gone with the body') {
        lines.push(
            'There is nothing to search. What they were carrying went where they went, and the '
            + 'ground here will not give any of it back.'
        );
    } else if (estate.taker) {
        lines.push(
            `${estate.taker.name} was standing there, and did not leave empty-handed: `
            + `${describeGoods(asLegacyGoods(estate.taken ?? { spiritStones: 0, stock: [] }))}`
            + `${estate.objects.length > 0 ? `, and ${estate.objects.map(o => o.name).join(', ')}` : ''}.`
        );
        if (estate.objects.length > 0) {
            lines.push(
                'Whoever asks about it afterwards will be told whose it was. A thing with a history '
                + 'does not stop having one because the person holding it changed.'
            );
        }
    } else {
        lines.push(
            `Nobody was there. What ${deps.cultivator.name} was carrying is at ${place}, where they fell: `
            + `${describeGoods(asLegacyGoods(estate.buried ?? { spiritStones: 0, stock: [] }))}`
            + `${estate.objects.length > 0 ? `, and ${estate.objects.map(o => o.name).join(', ')}` : ''}.`
        );
        lines.push(
            'Nothing is hidden and nothing is guarding it. Whether it is still there when somebody '
            + 'comes looking is a question about the ground and about how long they take.'
        );
    }

    const structure = [
        estate.structure,
        cache
            ? `${cache.id} written into cultivation_sites as a cache at '${cache.place}' `
              + `(${cache.ground} ground, ${describeGoods(cache.goods)}), undiscovered, against run `
              + `${cache.buriedByRunId}, on `
              + (cache.buriedOnWorldDay === null
                  ? 'a world day the run did not record'
                  : `world day ${cache.buriedOnWorldDay}`)
              + '. daysSpent 1 and burierOrdinal 0: nobody concealed it.'
            : 'No cache row: nothing was left in the ground.',
        graveLocationId
            ? `enshrineRun placed ${graveLocationId} and wrote the chronicle fact.`
            : 'No grave and no chronicle fact: there was no world row for this cultivator.',
        ...estate.objects.map(o =>
            `${o.id}: possessor ${o.possessorId ?? 'nobody'}, owner ${o.ownerId ?? 'unresolved'}, `
            + `${o.provenance.length} provenance link(s), last '${o.provenance[o.provenance.length - 1]?.how}'.`),
        ...unaccounted.map(line => `Not moved - ${line}`),
        `cultivator_pouch cleared and the purse zeroed for ${deps.cultivator.id}: a corpse holds nothing.`
    ];

    return {
        headline: estate.taker
            ? `What was on ${deps.cultivator.name} left with ${estate.taker.name}.`
            : `What was on ${deps.cultivator.name} is at ${place}.`,
        lines,
        structure,
        prose: lines.join('\n\n')
    };
}

/** One stack as a person would say it. Re-exported so callers need one import. */
export { nameOfStack };
