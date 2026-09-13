/**
 * Does the knowledge gate answer anything at all about one of the world's own
 * people?
 *
 * BOTH ARMS IN ONE COMMAND, over one world, off one tree. The gate takes an
 * optional world reader, so `before` and `after` are two gates over the SAME
 * database and the same `WorldState`: nothing is stashed, nothing is re-run,
 * and the only difference between the two columns is the second reader.
 *
 * The two consumers measured are the ones that refuse on the answer:
 *
 *   asking-verbs ~306    `isAwareOf(who.id, subject.kind, subject.id)` decides
 *                        `holdsIt`, which decides whether `whatStandsInTheWay`
 *                        reads `they_do_not_know` and the demand is refused.
 *   combat-verbs ~919    `stageOf(them.id, 'sect', factionId)` is the
 *                        reference axis of `whatTheyRecogniseAboutIt`, and
 *                        `reading === 'nothing'` drops the line entirely.
 *
 * Two corpora, because a uniform sweep and the questions a player actually
 * asks measure different things and the second is the one about playability.
 * Both are SETS: every sample is a fixed stride over a sorted list, so
 * reordering the world does not move the number.
 */

import Database from 'better-sqlite3';

import { migrate } from '../src/storage/migrations.js';
import { KnowledgeGate } from '../src/web/knowledge.js';
import { setDb } from '../src/storage/index.js';
import {
    activeWorld,
    createWorld,
    resetCultivationWorlds
} from '../src/server/state/cultivation-world.js';
import { ensureCultivationDb } from '../src/server/consolidated/cultivation-support.js';
import type { WorldState } from '../src/engine/world/world-state.js';
import type { NpcRecord } from '../src/engine/world/npc-state.js';
import { regionOf } from '../src/engine/world/what-people-are-saying.js';
import { whatTheyRecogniseAboutIt } from '../src/engine/world/artifact-recognition.js';

const SEEDS = ['probe-knowledge-one', 'probe-knowledge-two', 'probe-knowledge-three'];
/** How many people each sweep asks. A stride over the sorted roll. */
const ASKERS = 60;
/** How many subjects of each kind the uniform sweep asks each of them about. */
const SUBJECTS = 8;

interface Tally { asked: number; before: number; after: number }

function tally(): Tally { return { asked: 0, before: 0, after: 0 }; }

function add(into: Tally, before: boolean, after: boolean): void {
    into.asked++;
    if (before) into.before++;
    if (after) into.after++;
}

function fold(into: Tally, from: Tally): void {
    into.asked += from.asked;
    into.before += from.before;
    into.after += from.after;
}

function pct(hit: number, of: number): string {
    return of === 0 ? '    -' : `${((hit / of) * 100).toFixed(1).padStart(5)}%`;
}

function row(label: string, t: Tally): string {
    return label.padEnd(38)
        + String(t.asked).padStart(8)
        + pct(t.before, t.asked).padStart(10)
        + pct(t.after, t.asked).padStart(10);
}

/** A fixed stride over a sorted list. A set, not a sequence. */
function spread<T>(all: readonly T[], wanted: number): T[] {
    if (all.length <= wanted) return [...all];
    const step = all.length / wanted;
    const out: T[] = [];
    for (let i = 0; i < wanted; i++) out.push(all[Math.floor(i * step)]!);
    return out;
}

async function worldFor(seed: string): Promise<WorldState> {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    migrate(db);
    setDb(db);
    resetCultivationWorlds();
    ensureCultivationDb();
    await createWorld({ seed });
    const handle = await activeWorld();
    return handle.state;
}

const totals = {
    sweepSect: tally(),
    sweepPlace: tally(),
    sweepPerson: tally(),
    ownHouse: tally(),
    standingOn: tally(),
    houseInTheProvince: tally(),
    somebodyInTheSquare: tally(),
    recogniseReference: tally(),
    recogniseReading: tally()
};

for (const seed of SEEDS) {
    const world = await worldFor(seed);
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    migrate(db);

    // The only difference between the columns.
    const before = new KnowledgeGate(db);
    const after = new KnowledgeGate(db, () => world);

    const alive = world.npcs.filter(n => n.status === 'alive').sort((a, b) => (a.id < b.id ? -1 : 1));
    const askers = spread(alive, ASKERS);
    const houses = spread([...world.factions].sort((a, b) => (a.id < b.id ? -1 : 1)), SUBJECTS);
    const places = spread([...world.locations].sort((a, b) => (a.id < b.id ? -1 : 1)), SUBJECTS);
    const people = spread(alive, SUBJECTS);

    const seen = {
        sweepSect: tally(),
        sweepPlace: tally(),
        sweepPerson: tally(),
        ownHouse: tally(),
        standingOn: tally(),
        houseInTheProvince: tally(),
        somebodyInTheSquare: tally(),
        recogniseReference: tally(),
        recogniseReading: tally()
    };

    // ── the uniform sweep ────────────────────────────────────────────────
    //
    // The stage is counted as well as the boolean, because each branch of the
    // house reading lands on a different rung and the histogram is the only
    // thing that says WHICH one is carrying the number: `named` is the house
    // seated in their province, `placed` is the province talking about it or
    // their standing on its ground, `known` is their own roll or having been
    // there when it did something.
    const houseStages = new Map<string, number>();
    for (const who of askers) {
        for (const house of houses) {
            const stage = after.stageOf(who.id, 'sect', house.id);
            houseStages.set(stage, (houseStages.get(stage) ?? 0) + 1);
            add(seen.sweepSect,
                before.isAwareOf(who.id, 'sect', house.id),
                after.isAwareOf(who.id, 'sect', house.id));
        }
        for (const place of places) {
            add(seen.sweepPlace,
                before.isAwareOf(who.id, 'place', place.id),
                after.isAwareOf(who.id, 'place', place.id));
        }
        for (const person of people) {
            if (person.id === who.id) continue;
            add(seen.sweepPerson,
                before.isAwareOf(who.id, 'cultivator', person.id),
                after.isAwareOf(who.id, 'cultivator', person.id));
        }
    }

    // ── what somebody standing in front of them would actually ask ───────
    const byPlace = new Map<string, NpcRecord[]>();
    for (const npc of alive) {
        if (npc.locationId === null) continue;
        const here = byPlace.get(npc.locationId);
        if (here) here.push(npc); else byPlace.set(npc.locationId, [npc]);
    }

    for (const who of askers) {
        if (who.factionId) {
            add(seen.ownHouse,
                before.isAwareOf(who.id, 'sect', who.factionId),
                after.isAwareOf(who.id, 'sect', who.factionId));
        }
        if (who.locationId) {
            add(seen.standingOn,
                before.isAwareOf(who.id, 'place', who.locationId),
                after.isAwareOf(who.id, 'place', who.locationId));

            const province = regionOf(world, who.locationId);
            const local = world.factions.find(f =>
                f.id !== who.factionId
                && f.seatLocationId !== null
                && regionOf(world, f.seatLocationId) === province);
            if (local) {
                add(seen.houseInTheProvince,
                    before.isAwareOf(who.id, 'sect', local.id),
                    after.isAwareOf(who.id, 'sect', local.id));
            }

            const neighbour = (byPlace.get(who.locationId) ?? []).find(n => n.id !== who.id);
            if (neighbour) {
                add(seen.somebodyInTheSquare,
                    before.isAwareOf(who.id, 'cultivator', neighbour.id),
                    after.isAwareOf(who.id, 'cultivator', neighbour.id));
            }
        }
    }

    // ── the recognition consumer, run as combat-verbs runs it ────────────
    //
    // Every tracked thing the world holds that anybody owns, looked at by a
    // spread of the people who might be standing in front of you. The two
    // columns differ only in `referenceFor`.
    const owned = [...world.objects]
        .filter(o => o.ownerId !== null)
        .sort((a, b) => (a.id < b.id ? -1 : 1));
    for (const thing of spread(owned, 40)) {
        for (const them of spread(askers, 20)) {
            const readWith = (gate: KnowledgeGate) => whatTheyRecogniseAboutIt(thing, {
                id: them.id,
                factionId: them.factionId,
                realmOrdinal: them.cultivation.realmOrdinal,
                referenceFor: (factionId: string) => gate.stageOf(them.id, 'sect', factionId)
            });
            const was = readWith(before);
            const now = readWith(after);
            if (was.nothingToRecognise) continue;
            add(seen.recogniseReference, was.reference !== 'unaware', now.reference !== 'unaware');
            add(seen.recogniseReading, was.reading !== 'nothing', now.reading !== 'nothing');
        }
    }

    const unsited = world.history.facts.filter(f => f.locationId === null).length;
    console.log(`\n── ${seed} `.padEnd(66, '─'));
    console.log(`${world.npcs.length} people, ${world.factions.length} houses, `
        + `${world.locations.length} places, ${world.history.facts.length} facts `
        + `(${unsited} sited nowhere), ${owned.length} owned things, `
        + `day ${Math.floor(world.currentDay)}`);
    console.log('house sweep by rung: '
        + [...houseStages].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} ${n}`).join(', '));
    console.log('reading'.padEnd(38) + 'asked'.padStart(8) + 'before'.padStart(10) + 'after'.padStart(10));
    console.log(row('sweep: any house', seen.sweepSect));
    console.log(row('sweep: any place', seen.sweepPlace));
    console.log(row('sweep: any person', seen.sweepPerson));
    console.log(row('their own house', seen.ownHouse));
    console.log(row('the place they are standing in', seen.standingOn));
    console.log(row('a house seated in their province', seen.houseInTheProvince));
    console.log(row('somebody in the same square', seen.somebodyInTheSquare));
    console.log(row('recognition: reference is not unaware', seen.recogniseReference));
    console.log(row('recognition: reading is not nothing', seen.recogniseReading));

    for (const key of Object.keys(totals) as (keyof typeof totals)[]) {
        fold(totals[key], seen[key]);
    }
    db.close();
}

console.log(`\n── pooled over ${SEEDS.length} seeds `.padEnd(66, '─'));
console.log('reading'.padEnd(38) + 'asked'.padStart(8) + 'before'.padStart(10) + 'after'.padStart(10));
console.log(row('sweep: any house', totals.sweepSect));
console.log(row('sweep: any place', totals.sweepPlace));
console.log(row('sweep: any person', totals.sweepPerson));
console.log(row('their own house', totals.ownHouse));
console.log(row('the place they are standing in', totals.standingOn));
console.log(row('a house seated in their province', totals.houseInTheProvince));
console.log(row('somebody in the same square', totals.somebodyInTheSquare));
console.log(row('recognition: reference is not unaware', totals.recogniseReference));
console.log(row('recognition: reading is not nothing', totals.recogniseReading));
