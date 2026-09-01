/**
 * Can one person's trajectory be followed end to end out of stored state?
 *
 * The register is meant to be a reflection of what the engine actually did, not
 * a second source of truth. That only holds if a reader can pick one person out
 * of the world and walk what happened to them: the facts they are in, the
 * people those facts name, and the ties they hold - each of which has to resolve
 * to somebody the world can still describe.
 *
 * This probe measures five specific ways that walk was reported to break, states
 * each in the terms it was reported in, and then prints one person's history and
 * ties end to end so the answer is visible rather than asserted.
 *
 *   FACTS NAME PEOPLE    every fact carries actors and witnesses as ids
 *   TIES RESOLVE         every relationship target is findable, alive or dead
 *   SOUL AND SELF MOVE   soulState and identityContinuity never disagree
 *   LAYER AND LADDER     layer agrees with the ordinal; birth is inside history
 *   WOUNDS ARE TYPED     every injury carries a catalog wound type
 *
 * Run: npx tsx scripts/probe-can-a-trajectory-be-followed.ts
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { DAYS_PER_YEAR } from '../src/engine/cultivation/cultivation.js';
import { expelsOrdinal, layerForOrdinal } from '../src/engine/world/layers.js';
import type { NpcRecord } from '../src/engine/world/npc-state.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const line = (s = '') => console.log(s);
const rule = (t: string) => { line(); line('='.repeat(92)); line('  ' + t); line('='.repeat(92)); };

const YEARS = Number(process.env.YEARS ?? 400);
const SEED = process.env.SEED ?? 'trajectory-probe';

function yearOf(day: number): number {
    return Math.floor(day / DAYS_PER_YEAR);
}

function describe(state: WorldState, id: string): string {
    const npc = state.npcs.find(n => n.id === id);
    if (!npc) return `[UNRESOLVED ${id}]`;
    if (npc.status === 'alive') return npc.name;
    return `${npc.name} (${npc.status}${npc.diedOnDay != null ? `, year ${yearOf(npc.diedOnDay)}` : ''})`;
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    const seeded = seedWorld({ seed: SEED, catalog });
    let state = seeded.state;
    const out = advanceWorldYears(state, YEARS, { pressure: { eventsPerYear: 1.2 } });
    state = out.state;

    line(`seed ${SEED}, advanced ${YEARS} years`);
    line(`npcs ${state.npcs.length}  facts ${state.history.facts.length}  factions ${state.factions.length}`);

    // ── FACTS NAME PEOPLE ─────────────────────────────────────────────────
    rule('FACTS NAME PEOPLE');
    const facts = state.history.facts;
    const noActors = facts.filter(f => f.actors.length === 0);
    const noWitness = facts.filter(f => f.witnessIds.length === 0);
    const danglingActor = facts.filter(f =>
        f.actors.some(a => a.id.startsWith('npc') && !state.npcs.some(n => n.id === a.id)));
    line(`  facts with no actors     ${noActors.length} / ${facts.length}`);
    line(`  facts with no witnesses  ${noWitness.length} / ${facts.length}`);
    line(`  facts naming an actor id that resolves to nobody  ${danglingActor.length}`);
    for (const f of noActors.slice(0, 6)) line(`    no actors: [${f.kind}] ${f.summary}`);

    // Killings specifically: is the killer on the record, or only in the
    // victim's endNote?
    const killed = state.npcs.filter(n => /^Killed by /.test(n.endNote));
    let killerOnRecord = 0;
    let killerCarriesIt = 0;
    let sample = '';
    for (const victim of killed) {
        const fact = facts.find(f =>
            f.actors.some(a => a.role === 'victim' && a.id === victim.id) &&
            f.actors.some(a => a.role === 'killer'));
        if (!fact) continue;
        killerOnRecord++;
        const killer = state.npcs.find(n => n.id === fact.actors.find(a => a.role === 'killer')!.id);
        if (killer?.historyFactIds.includes(fact.id)) {
            killerCarriesIt++;
            if (!sample) {
                sample = `    ${killer.name} carries ${fact.id}: "${fact.summary}" ` +
                    `(${killer.historyFactIds.length} facts on their record)`;
            }
        }
    }
    line(`  killings with a killer on the fact              ${killerOnRecord} / ${killed.length}`);
    line(`  killings the killer's OWN record carries        ${killerCarriesIt} / ${killed.length}`);
    if (sample) line(sample);
    const withFacts = state.npcs.filter(n => n.historyFactIds.length > 0).length;
    line(`  people with any fact on their record            ${withFacts} / ${state.npcs.length}`);

    // ── TIES RESOLVE ──────────────────────────────────────────────────────
    rule('TIES RESOLVE');
    const byId = new Map(state.npcs.map(n => [n.id, n]));
    let ties = 0, unresolved = 0, toDead = 0;
    const unresolvedSamples: string[] = [];
    for (const n of state.npcs) {
        for (const r of n.relationships) {
            ties++;
            const t = byId.get(r.targetId);
            if (!t) {
                unresolved++;
                if (unresolvedSamples.length < 8) {
                    unresolvedSamples.push(`${n.name} -> ${r.targetName} (${r.kind}) id=${r.targetId}`);
                }
            } else if (t.status !== 'alive') toDead++;
        }
    }
    line(`  ties ${ties}   unresolved ${unresolved}   to somebody dead but still on the books ${toDead}`);
    for (const s of unresolvedSamples) line(`    unresolved: ${s}`);

    // ── SOUL AND SELF MOVE TOGETHER ───────────────────────────────────────
    rule('SOUL AND SELF MOVE TOGETHER');
    const incoherentSoul = state.npcs.filter(n =>
        n.soulState !== 'intact' && n.identityContinuity >= 1);
    line(`  non-intact soul at full continuity  ${incoherentSoul.length}`);
    for (const n of incoherentSoul.slice(0, 6)) {
        line(`    ${n.name}: soulState=${n.soulState} continuity=${n.identityContinuity} status=${n.status}`);
    }

    // ── LAYER AND LADDER ──────────────────────────────────────────────────
    rule('LAYER AND LADDER');
    // A layer is a PLACE, not a rank, so "belongs on" is not "must be on":
    // only being on a layer that expels your ordinal is actually incoherent.
    const expelled = state.npcs.filter(n => expelsOrdinal(n.layer, n.cultivation.realmOrdinal));
    line(`  people standing on a layer that expels their ordinal  ${expelled.length}`);
    for (const n of expelled.slice(0, 8)) {
        line(`    ${n.name}: ordinal ${n.cultivation.realmOrdinal} filed as ${n.layer}, belongs on ${layerForOrdinal(n.cultivation.realmOrdinal).key}`);
    }
    const highMortals = state.npcs.filter(n => n.layer === 'mortal' && n.cultivation.realmOrdinal >= 41);
    line(`  ordinal 41+ filed on the mortal layer  ${highMortals.length} (legal below 46)`);
    const firstEraStart = state.history.eras.length
        ? Math.min(...state.history.eras.map(e => e.startDay)) : 0;
    const bornBeforeHistory = state.npcs.filter(n => n.identity.bornOnDay < firstEraStart);
    line(`  world's first era begins day ${firstEraStart} (year ${yearOf(firstEraStart)})`);
    line(`  people born before the world's first era  ${bornBeforeHistory.length}`);
    for (const n of bornBeforeHistory.slice(0, 8)) {
        line(`    ${n.name}: born year ${yearOf(n.identity.bornOnDay)}, ordinal ${n.cultivation.realmOrdinal}, layer ${n.layer}`);
    }

    // ── WOUNDS ARE TYPED ──────────────────────────────────────────────────
    rule('WOUNDS ARE TYPED');
    let injuries = 0, untyped = 0;
    const untypedHolders: string[] = [];
    for (const n of state.npcs) {
        for (const inj of n.cultivation.injuries) {
            injuries++;
            if (!inj.woundType) {
                untyped++;
                if (untypedHolders.length < 8) {
                    untypedHolders.push(`${n.name}: (untyped) ${inj.severity} - ${inj.description}`);
                }
            }
        }
    }
    line(`  injuries ${injuries}   untyped ${untyped}`);
    const bySource = new Map<string, number>();
    for (const n of state.npcs) {
        for (const inj of n.cultivation.injuries) {
            if (inj.woundType) continue;
            bySource.set(inj.source, (bySource.get(inj.source) ?? 0) + 1);
        }
    }
    for (const [source, n] of [...bySource].sort((a, b) => b[1] - a[1])) {
        line(`    untyped by source: ${source} ${n}`);
    }
    for (const s of untypedHolders) line(`    ${s}`);
    const countMismatch = state.npcs.filter(n =>
        n.cultivation.untreatedInjuries !== n.cultivation.injuries.filter(i => !i.treated).length);
    line(`  untreatedInjuries disagreeing with the rows  ${countMismatch.length}`);

    // ── ONE PERSON, END TO END ────────────────────────────────────────────
    const subject = pickSubject(state);
    rule(`ONE PERSON END TO END: ${subject.name}`);
    line(`  id ${subject.id}`);
    line(`  born year ${yearOf(subject.identity.bornOnDay)}, origin ${subject.identity.origin}`);
    line(`  ordinal ${subject.cultivation.realmOrdinal}, layer ${subject.layer}, status ${subject.status}`);
    line(`  soulState ${subject.soulState}, continuity ${subject.identityContinuity}`);
    if (subject.endNote) line(`  endNote "${subject.endNote}"`);
    line();
    line(`  HISTORY (${subject.historyFactIds.length} fact ids on the record)`);
    const own = facts.filter(f =>
        f.actors.some(a => a.id === subject.id) || f.witnessIds.includes(subject.id));
    for (const f of own.slice(0, 25)) {
        const roles = f.actors.map(a => `${a.role}=${describe(state, a.id)}`).join(', ');
        line(`    year ${yearOf(f.day)} [${f.kind}] ${f.summary}`);
        line(`      actors: ${roles || '(none)'}`);
        line(`      witnesses: ${f.witnessIds.map(id => describe(state, id)).join(', ') || '(none)'}`);
    }
    if (own.length === 0) line('    (no fact in the ledger names them)');
    line();
    line(`  TIES (${subject.relationships.length})`);
    for (const r of subject.relationships.slice(0, 40)) {
        line(`    ${r.kind} ${r.standing.toFixed(2)} -> ${describe(state, r.targetId)}  "${r.note}"`);
    }
}

/** Somebody with a life worth printing: the most-tied living person. */
function pickSubject(state: WorldState): NpcRecord {
    const alive = state.npcs.filter(n => n.status === 'alive');
    const pool = alive.length ? alive : state.npcs;
    return pool.reduce((best, n) =>
        n.relationships.length + n.historyFactIds.length >
        best.relationships.length + best.historyFactIds.length ? n : best);
}

main().catch(err => { console.error(err); process.exit(1); });
