/**
 * Who is left carrying a killing the world PRODUCED, against one it was SEEDED
 * holding - and what the difference unlocks at the far end, where a life opens.
 *
 * Reads every fact in the world that names a `killer` and a `victim` - the
 * shape all three writers in `src/engine/world/` use - and splits them by
 * whether the row carries `deedWeight`. Then draws births the way `newRun`
 * does and asks `facesFromHome` how many of them open knowing about a killing.
 *
 *   npx tsx scripts/probe-what-a-killing-the-world-commits-leaves.ts
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldForPlay } from '../src/engine/world/driver.js';
import { getNpc, type WorldState } from '../src/engine/world/world-state.js';
import { drawBirth } from '../src/engine/birth/birth.js';
import { facesFromHome } from '../src/web/who-a-life-like-this-grew-up-knowing.js';
import type { Cultivator } from '../src/schema/cultivation.js';

const WORLDS = Number(process.env.WORLDS ?? 13);
const YEARS = Number(process.env.YEARS ?? 25);
const BIRTHS = Number(process.env.BIRTHS ?? 150);
const DAY = 365;
const POPULATION = 240;
const STARTING_AGE = 16;

const BLOOD = new Set(['kin', 'spouse', 'parent', 'child']);

interface Row {
    priced: boolean;
    pressure: string;
    kind: string;
    bloodOnRecord: number;
    bloodStillAlive: number;
    disciples: number;
    masters: number;
    ranked: boolean;
}

const rows: Row[] = [];
let seededKillings = 0;
let deathsInSpan = 0;
let victimStruckOff = 0;

/** Lives that open knowing a killing, split by where the killing came from. */
let lives = 0;
let livesWithAVictim = 0;
let livesWithAnOpenKilling = 0;
let livesFromASeededWrong = 0;
let livesFromSomethingTheWorldDid = 0;

const catalog = await loadCultivationCatalog();

function aLife(id: string, place: string): Cultivator {
    return {
        id, name: 'the probe', location: place,
        age: STARTING_AGE, realmOrdinal: 0
    } as unknown as Cultivator;
}

for (let w = 1; w <= WORLDS; w++) {
    const state = seedWorld({
        seed: `probe-w${w}`, catalog, population: POPULATION
    }).state;
    const seededFactIds = new Set(state.history.facts.map(f => f.id));

    const result = advanceWorldForPlay(state, { days: YEARS * DAY, stopOnInterrupt: false });
    deathsInSpan += result.deaths.length;

    const alive = new Set(state.npcs.filter(n => n.status === 'alive').map(n => n.id));

    for (const fact of state.history.facts) {
        const killer = fact.actors.find(a => a.role === 'killer');
        const victim = fact.actors.find(a => a.role === 'victim');
        // A killing whose VICTIM has been struck off the record. The mortal
        // sweep removes a forgotten person from the actors of a fact it keeps,
        // so a killing nobody carries stops being legible as a killing at all
        // while the row it was written on stays.
        if (killer && !victim && !seededFactIds.has(fact.id)) victimStruckOff++;
        if (!killer || !victim) continue;
        if (seededFactIds.has(fact.id)) { seededKillings++; continue; }

        const victimRow = getNpc(state, victim.id);
        const ties = victimRow?.relationships ?? [];
        rows.push({
            priced: 'deedWeight' in fact.data,
            pressure: String(fact.data.pressure ?? ''),
            kind: fact.kind,
            bloodOnRecord: ties.filter(r => BLOOD.has(r.kind)).length,
            bloodStillAlive: ties.filter(r => BLOOD.has(r.kind) && alive.has(r.targetId)).length,
            disciples: ties.filter(r => r.kind === 'disciple' && alive.has(r.targetId)).length,
            masters: ties.filter(r => r.kind === 'master' && alive.has(r.targetId)).length,
            ranked: (victimRow?.factionRankIndex ?? -1) >= 0 && victimRow?.factionId != null
        });
    }

    // ── AND WHAT A LIFE OPENS KNOWING ───────────────────────────────────
    for (let b = 0; b < BIRTHS; b++) {
        const seed = `probe-r${w}-${b}`;
        const birth = drawBirth(seed);
        const cultivator = aLife(`${seed}-pc`, birth.place.name);
        const faces = facesFromHome({ world: state, cultivator, origin: birth.origin, seed });
        lives++;
        const killed = faces.filter(f => f.killedBy !== null);
        if (killed.length > 0) livesWithAVictim++;
        const open = killed.filter(f => f.killedBy!.anAccountWasOpened);
        if (open.length === 0) continue;
        livesWithAnOpenKilling++;
        // Which door the killing came through. A seeded wrong's row was written
        // before the world moved; everything else is something the world did.
        let seededOne = false;
        let producedOne = false;
        for (const face of open) {
            // The same walk `whoEndedThem` does: newest first, because a person
            // dies once and the last row naming them victim is the one that
            // stuck. Reading the first instead attributed every killing to the
            // wrong door.
            const row = state.npcs.find(n => n.id === face.id);
            const onTheirRecord = new Set(row?.historyFactIds ?? []);
            let factId: string | null = null;
            for (let i = state.history.facts.length - 1; i >= 0; i--) {
                const fact = state.history.facts[i];
                if (!onTheirRecord.has(fact.id)) continue;
                if (!fact.actors.some(a => a.id === face.id && a.role === 'victim')) continue;
                factId = fact.id;
                break;
            }
            if (factId !== null && seededFactIds.has(factId)) seededOne = true;
            else producedOne = true;
        }
        if (seededOne) livesFromASeededWrong++;
        if (producedOne) livesFromSomethingTheWorldDid++;
    }
}

const n = rows.length;
const count = (p: (r: Row) => boolean) => rows.filter(p).length;
const pct = (a: number, b: number) => b === 0 ? ' n/a' : `${((a / b) * 100).toFixed(1).padStart(5)}%`;

console.log(`\n${WORLDS} worlds, population ${POPULATION}, ${YEARS} years each.\n`);
console.log('KILLINGS THE WORLD HOLDS AT THE END OF THE SPAN');
console.log(`  seeded                              ${seededKillings}`);
console.log(`  produced                            ${n}`);
console.log(`  of the produced, priced             ${count(r => r.priced)}  ${pct(count(r => r.priced), n)}`);
console.log(`  of the produced, correctly not      ${count(r => !r.priced)}  ${pct(count(r => !r.priced), n)}`);
console.log(`  rows whose victim was struck off    ${victimStruckOff}`);
console.log(`  deaths of every kind in the span    ${deathsInSpan}`);
console.log('');
console.log('WHAT THE PRICED ONES LEFT BEHIND, AND WHAT THE OTHERS DID NOT');
for (const [label, p] of [
    ['blood on the record', (r: Row) => r.bloodOnRecord > 0],
    ['blood still standing', (r: Row) => r.bloodStillAlive > 0],
    ['a living disciple', (r: Row) => r.disciples > 0],
    ['a living master', (r: Row) => r.masters > 0],
    ['nobody of their own at all', (r: Row) => r.bloodStillAlive === 0 && r.disciples === 0 && r.masters === 0],
    ['ranked in a house', (r: Row) => r.ranked]
] as [string, (r: Row) => boolean][]) {
    const priced = rows.filter(r => r.priced);
    const not = rows.filter(r => !r.priced);
    console.log(`  ${label.padEnd(28)} priced ${String(priced.filter(p).length).padStart(4)}/${priced.length}`
        + `   unpriced ${String(not.filter(p).length).padStart(3)}/${not.length}`);
}
console.log('');
console.log('BY PASS');
const passes = new Map<string, Row[]>();
for (const r of rows) {
    const key = `${r.pressure || 'confrontation'} / ${r.kind}`;
    passes.set(key, [...(passes.get(key) ?? []), r]);
}
for (const [key, sub] of [...passes].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${key.padEnd(30)} ${String(sub.length).padStart(4)}   priced ${sub.filter(r => r.priced).length}`);
}
console.log('');
console.log(`WHAT A LIFE OPENS KNOWING  (${lives} births)`);
console.log(`  a face who was killed                    ${livesWithAVictim}  ${pct(livesWithAVictim, lives)}`);
console.log(`  ... and an account was open on it        ${livesWithAnOpenKilling}  ${pct(livesWithAnOpenKilling, lives)}`);
console.log(`  from a wrong the world was BORN holding  ${livesFromASeededWrong}  ${pct(livesFromASeededWrong, lives)}`);
console.log(`  from something the world DID             ${livesFromSomethingTheWorldDid}  ${pct(livesFromSomethingTheWorldDid, lives)}`);
console.log('');
