/**
 * Does a life read like a life?
 *
 * The acceptance test is a sentence the user wrote, and it is a better measure
 * than any row count:
 *
 *     reached Foundation at 34 - took a master - ranked second at the Court -
 *     crossed to Core Formation at 71 - the merging went wrong and took a
 *     quarter of him - killed Han Minwu - died at the wall
 *
 * "rather than four murders and an inheritance." So this takes the world's
 * most-documented people and prints their lives end to end, in order, out of the
 * ledger alone - no scanning, no reconstruction, just `historyFactIds` read
 * against the rows it points at, which is exactly what a reader two centuries
 * later would have.
 *
 * Run: npx tsx scripts/probe-does-a-life-read-like-a-life.ts
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { yearOfDay } from '../src/engine/world/history.js';
import { trajectoryOf } from '../src/engine/world/who-was-there-when-it-happened.js';
import { describeWithRecurrence } from '../src/engine/world/a-fact-that-keeps-happening-is-one-row.js';
import { readTies } from '../src/engine/world/reading-a-tie-against-the-roster.js';
import type { NpcRecord } from '../src/engine/world/npc-state.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const line = (s = '') => console.log(s);
const rule = (t: string) => { line(); line('='.repeat(92)); line('  ' + t); line('='.repeat(92)); };

const YEARS = Number(process.env.YEARS ?? 600);
const SEED = process.env.SEED ?? 'a-life';
const LIVES = Number(process.env.LIVES ?? 3);

/**
 * The kinds a biography is made of.
 *
 * Deliberately NOT a filter applied to a noisy ledger - it is the list of what
 * the ledger is supposed to contain about a person, used here to report how much
 * of a life is life and how much is weather.
 */
const ABOUT_A_PERSON = new Set([
    'birth', 'death', 'realm_crossing', 'breakthrough', 'injury', 'promotion',
    'marriage', 'inheritance', 'grudge_opened', 'grudge_inherited', 'grudge_settled',
    'gathering', 'oath_sworn', 'debt_incurred', 'expulsion', 'betrayal',
    'succession', 'ascension', 'presumed_dead', 'gave_up_waiting', 'toll_paid'
]);

function printLife(state: WorldState, npc: NpcRecord): void {
    const facts = trajectoryOf(state, npc);
    const born = yearOfDay(npc.identity.bornOnDay);
    rule(`${npc.name} - born ${born}, ${npc.identity.origin}, ${npc.status}`);
    line(`  ${facts.length} rows on the record, ${npc.relationships.length} ties`);
    line();
    for (const fact of facts) {
        const age = Math.max(0, yearOfDay(fact.day) - born);
        const about = ABOUT_A_PERSON.has(fact.kind) ? ' ' : '.';
        line(`  ${String(yearOfDay(fact.day)).padStart(6)}  age ${String(age).padStart(4)} ${about}` +
            ` [${fact.kind}] ${describeWithRecurrence(fact, yearOfDay)}`);
    }
    const personal = facts.filter(f => ABOUT_A_PERSON.has(f.kind)).length;
    line();
    line(`  about them: ${personal} / ${facts.length}` +
        ` (${facts.length === 0 ? 0 : Math.round((personal / facts.length) * 100)}%)`);
    const ties = readTies(state, npc).slice(0, 8);
    if (ties.length > 0) {
        line('  ties:');
        for (const t of ties) line(`    ${t.tie.kind} ${t.tie.standing.toFixed(2)} -> ${t.description}`);
    }
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    const seeded = seedWorld({ seed: SEED, catalog });
    const state = advanceWorldYears(seeded.state, YEARS, { pressure: { eventsPerYear: 1.2 } }).state;

    line(`seed ${SEED}, ${YEARS} years, ${state.npcs.length} people, ${state.history.facts.length} rows`);

    const byKind = new Map<string, number>();
    for (const f of state.history.facts) byKind.set(f.kind, (byKind.get(f.kind) ?? 0) + 1);
    rule('WHAT THE LEDGER IS MADE OF');
    for (const [kind, n] of [...byKind].sort((a, b) => b[1] - a[1]).slice(0, 14)) {
        line(`  ${kind.padEnd(22)} ${String(n).padStart(6)}${ABOUT_A_PERSON.has(kind) ? '   (a life)' : ''}`);
    }
    const personal = state.history.facts.filter(f => ABOUT_A_PERSON.has(f.kind)).length;
    line(`  rows about a person: ${personal} / ${state.history.facts.length}`);

    // The most-documented people, which is what the report is measured on.
    const ranked = state.npcs
        .filter(n => n.historyFactIds.length > 0)
        .sort((a, b) => b.historyFactIds.length - a.historyFactIds.length);
    for (const npc of ranked.slice(0, LIVES)) printLife(state, npc);

    // And one ordinary climber, because the most-documented person is not the
    // typical case and a measurement taken only on the outlier is a harness
    // artefact waiting to happen.
    const climber = state.npcs.find(n =>
        n.status === 'alive' && n.cultivation.realmOrdinal >= 13 &&
        n.historyFactIds.length >= 4 && n.historyFactIds.length <= 20);
    if (climber) printLife(state, climber);
}

main().catch(err => { console.error(err); process.exit(1); });
