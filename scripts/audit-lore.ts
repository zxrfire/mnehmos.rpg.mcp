/**
 * The lore consistency audit.
 *
 * Every catalog in `src/data/cultivation` references the others by id, by name
 * and by number, and nothing checks that the three agree. This walks all of it
 * and reports the disagreements, in four classes:
 *
 *   DANGLING   an id that resolves to nothing
 *   CONTRADICTION  two catalogs stating different numbers for the same thing
 *   ORPHAN     an entry nothing anywhere points at
 *   SUSPECT    something that is legal and reads wrong
 *
 * ORPHAN has one exemption and it is not silence: an art the catalog declares
 * to have no surviving copy anywhere is reported separately as a stated
 * absence, and the declaration is checked in both directions, so an art that
 * claims to be unobtainable and is nonetheless handed over is a
 * CONTRADICTION rather than a quiet pass.
 *
 * It is a script rather than a test because most of what it finds is judgement
 * rather than failure. What hardens into a rule gets promoted into a suite.
 */

import { SECTS, SECT_ANCESTRY, sectThreat, intakeRouteOf } from '../src/data/cultivation/sects.js';
import { allDaoCarvings } from '../src/data/cultivation/false-immortals.js';
import {
    APEX_INSTITUTIONS, COURTS, FACTION_PARENTAGE, idsForFaction
} from '../src/data/cultivation/hierarchy.js';
import { ARTIFACTS } from '../src/data/cultivation/artifacts.js';
import { MEMBERS } from '../src/data/cultivation/members.js';
import { TECHNIQUES } from '../src/data/cultivation/techniques.js';
import { FACTION_CHARACTER, HIGH_REALM_PROVENANCE } from '../src/data/cultivation/faction-character.js';
import { MAX_ORDINAL } from '../src/engine/cultivation/realms.js';
import { SITES } from '../src/data/cultivation/inheritance-trials.js';
import { ROGUE_TRADES, BOUNTIES } from '../src/data/cultivation/rogues.js';
import { WANDERERS } from '../src/data/cultivation/wanderers.js';
import { FALLEN } from '../src/data/cultivation/fallen.js';

type Class = 'DANGLING' | 'CONTRADICTION' | 'ORPHAN' | 'SUSPECT';

const findings: { cls: Class; where: string; what: string }[] = [];
const note = (cls: Class, where: string, what: string) => findings.push({ cls, where, what });

// ── the id space ─────────────────────────────────────────────────────────

const factionIds = new Set<string>([
    ...SECTS.map(s => s.id),
    ...APEX_INSTITUTIONS.map(a => a.id),
    ...COURTS.map(c => c.id)
]);
const techniqueIds = new Set(TECHNIQUES.map(t => t.id));

function resolves(id: string): boolean {
    return factionIds.has(id) || idsForFaction(id).some(x => factionIds.has(x));
}

// ── 1. every id that points at a faction ─────────────────────────────────

for (const a of ARTIFACTS) {
    if (a.ownerId && !resolves(a.ownerId)) note('DANGLING', `artifacts/${a.name}`, `ownerId ${a.ownerId}`);
}
for (const m of MEMBERS) {
    if (!resolves(m.factionId)) note('DANGLING', `members/${m.name}`, `factionId ${m.factionId}`);
}
for (const [id, entry] of Object.entries(FACTION_PARENTAGE)) {
    if (!resolves(id)) note('DANGLING', `parentage/${id}`, 'the faction itself does not exist');
    const parent = entry.parentFactionId;
    if (parent && !resolves(parent) && !COURTS.some(c => c.id === parent)) {
        note('DANGLING', `parentage/${id}`, `parentFactionId ${parent}`);
    }
}
for (const c of COURTS) {
    if (!resolves(c.apexId)) note('DANGLING', `courts/${c.name}`, `apexId ${c.apexId}`);
}
for (const [id] of Object.entries(SECT_ANCESTRY)) {
    if (!resolves(id)) note('DANGLING', `ancestry/${id}`, 'no such faction');
}
for (const [id] of Object.entries(FACTION_CHARACTER)) {
    if (!resolves(id)) note('DANGLING', `character/${id}`, 'no such faction');
}
for (const [id] of Object.entries(HIGH_REALM_PROVENANCE)) {
    if (!resolves(id)) note('DANGLING', `provenance/${id}`, 'no such faction');
}
for (const s of SECTS) {
    for (const t of s.teaches) {
        if (!techniqueIds.has(t)) note('DANGLING', `sects/${s.name}`, `teaches unknown art ${t}`);
    }
    if (s.signatureTechniqueId && !techniqueIds.has(s.signatureTechniqueId)) {
        note('DANGLING', `sects/${s.name}`, `signature art ${s.signatureTechniqueId}`);
    }
    for (const r of s.rivals ?? []) {
        if (!resolves(r)) note('DANGLING', `sects/${s.name}`, `rival ${r}`);
    }
}

// ── 2. numbers that two catalogs both claim ──────────────────────────────

for (const s of SECTS) {
    const strongest = MEMBERS
        .filter(m => m.factionId === s.id && typeof m.realmOrdinal === 'number')
        .reduce((best, m) => Math.max(best, m.realmOrdinal as number), -1);
    if (strongest >= 0 && strongest > s.powerOrdinal) {
        note('CONTRADICTION', `sects/${s.name}`,
            `powerOrdinal ${s.powerOrdinal} but a member stands at ${strongest}`);
    }

    const character = FACTION_CHARACTER[s.id];
    const peak = character?.production?.peakOrdinal;
    if (typeof peak === 'number' && peak < s.powerOrdinal) {
        // Legal where the house takes people in already strong - the Hollow
        // Court's whole door is that - and a contradiction where it cannot.
        const route = intakeRouteOf(s.id);
        const canRecruit = route === 'open';
        note(canRecruit ? 'SUSPECT' : 'CONTRADICTION', `sects/${s.name}`,
            `stands at ${s.powerOrdinal}, produced at most ${peak}` +
            (canRecruit ? ' - so the difference walked in' : ' - and it cannot recruit'));
    }

    const provenance = HIGH_REALM_PROVENANCE[s.id];
    if (provenance && provenance.highestOrdinal < s.powerOrdinal) {
        note('CONTRADICTION', `sects/${s.name}`,
            `stands at ${s.powerOrdinal}, provenance says it topped out at ${provenance.highestOrdinal}`);
    }

    const threat = sectThreat(s.id);
    if (threat && threat.acting !== s.powerOrdinal) {
        note('CONTRADICTION', `sects/${s.name}`,
            `acting ${threat.acting} is not powerOrdinal ${s.powerOrdinal}`);
    }
}

for (const apex of APEX_INSTITUTIONS) {
    const held = ARTIFACTS.filter(a => a.ownerId !== null && idsForFaction(apex.id).includes(a.ownerId));
    if (held.length === 0) note('SUSPECT', `apex/${apex.name}`, 'holds no artifact at all');
    if (apex.sentDown && !ARTIFACTS.some(a => a.id === apex.sentDown.id)) {
        note('DANGLING', `apex/${apex.name}`, `sentDown ${apex.sentDown.id} is not in ARTIFACTS`);
    }
    for (const courtId of apex.courtIds) {
        const court = COURTS.find(c => c.id === courtId);
        if (!court) { note('DANGLING', `apex/${apex.name}`, `courtId ${courtId}`); continue; }
        if (court.apexId !== apex.id) {
            note('CONTRADICTION', `apex/${apex.name}`,
                `lists ${court.name}, which answers to ${court.apexId}`);
        }
    }
}
for (const court of COURTS) {
    const apex = APEX_INSTITUTIONS.find(a => a.id === court.apexId);
    if (apex && !apex.courtIds.includes(court.id)) {
        note('CONTRADICTION', `courts/${court.name}`,
            `answers to ${apex.name}, which does not list it`);
    }
    if (court.powerOrdinal >= (apex?.powerOrdinal ?? MAX_ORDINAL)) {
        note('SUSPECT', `courts/${court.name}`,
            `stands at ${court.powerOrdinal}, at or above its apex`);
    }
}

// ── 3. things nothing points at ──────────────────────────────────────────

const pointedAt = new Set<string>();
for (const s of SECTS) for (const t of s.teaches) pointedAt.add(t);
for (const s of SECTS) if (s.signatureTechniqueId) pointedAt.add(s.signatureTechniqueId);

// An art no sect teaches is not automatically a hole. The world hands arts
// over several other ways, and an art that arrives ONLY that way is a
// deliberate piece of design - it is what makes a grave worth opening. What is
// a hole is an art nothing in the world can produce at all.
const otherRoutes = new Set<string>();
const scan = (value: unknown): void => {
    if (typeof value === 'string') { if (techniqueIds.has(value)) otherRoutes.add(value); return; }
    if (Array.isArray(value)) { for (const v of value) scan(v); return; }
    if (value && typeof value === 'object') { for (const v of Object.values(value)) scan(v); }
};
scan(SITES);
scan(ROGUE_TRADES);
scan(BOUNTIES);
scan(WANDERERS);
scan(FALLEN);
scan(MEMBERS);

// The two routes at the top of the world, read from the specific field rather
// than by sweeping the object, because both catalogs also carry technique ids
// that are NOT routes. `DESTROYED_DAO_HOUSES.fragmentTechniqueIds` says which
// dead house an art belonged to, which is provenance and not a door, and a
// blanket scan of it would clear three arts nothing can currently hand over.
for (const carving of allDaoCarvings()) {
    for (const id of carving.yieldedTechniqueIds) otherRoutes.add(id);
}
for (const records of Object.values(SECT_ANCESTRY)) {
    for (const id of records.partingGift?.techniqueIds ?? []) otherRoutes.add(id);
}

// And the fourth answer, which is neither a route nor a hole: an art the world
// can name and cannot produce, said out loud in the catalog. Silence is what
// produced fifteen of these; a stated absence is a different thing from an
// unstated one and is reported rather than flagged.
const stated: string[] = [];

for (const t of TECHNIQUES) {
    if (pointedAt.has(t.id)) continue;
    if (otherRoutes.has(t.id)) continue;
    if (!t.survivingCopy) {
        stated.push(`${t.name} (${t.grade})`);
        continue;
    }
    note('ORPHAN', `techniques/${t.name}`, `grade ${t.grade}, and nothing in the world hands it over`);
}

// The inverse error, and the reason the marker is checked in both directions:
// an art declared to have no surviving copy that something is nonetheless
// handing over is a contradiction between two catalogs, which is what this
// script is for.
for (const t of TECHNIQUES) {
    if (t.survivingCopy) continue;
    if (pointedAt.has(t.id) || otherRoutes.has(t.id)) {
        note('CONTRADICTION', `techniques/${t.name}`,
            'declared to have no surviving copy, and something in the world hands it over');
    }
}

const withPeople = new Set(MEMBERS.map(m => m.factionId));
for (const s of SECTS) {
    if (!withPeople.has(s.id)) note('ORPHAN', `sects/${s.name}`, 'has nobody in members.ts');
}

// ── 4. reads wrong ───────────────────────────────────────────────────────

for (const s of SECTS) {
    // Only the impossible direction. A wide gap between the door and the top
    // is a sect working as intended - it admits novices and keeps elders - and
    // flagging all twenty-three of them buried the findings that mattered.
    if (s.admissionOrdinal > s.powerOrdinal) {
        note('CONTRADICTION', `sects/${s.name}`,
            `admits at ${s.admissionOrdinal} and tops out at ${s.powerOrdinal}`);
    }
}

const tierWord = (name: string) => /\bCourt\b/.test(name) ? 'court' : /\bSect\b|\bHall\b|\bPavilion\b/.test(name) ? 'sect' : null;
for (const s of SECTS) {
    const word = tierWord(s.name);
    if (word === 'court' && s.powerOrdinal < 30) {
        note('SUSPECT', `sects/${s.name}`, `called a Court and stands at ${s.powerOrdinal}`);
    }
}

for (const a of ARTIFACTS) {
    if (a.power === null) { note('SUSPECT', `artifacts/${a.name}`, 'has no power'); continue; }
    if (a.power > MAX_ORDINAL) note('SUSPECT', `artifacts/${a.name}`, `rated ${a.power}, above the ladder`);
}

// ── report ───────────────────────────────────────────────────────────────

const order: Class[] = ['DANGLING', 'CONTRADICTION', 'SUSPECT', 'ORPHAN'];
console.log('\n  LORE CONSISTENCY AUDIT');
console.log('='.repeat(78));
console.log(`\n  ${SECTS.length} factions, ${APEX_INSTITUTIONS.length} apexes, ${COURTS.length} courts, ` +
    `${ARTIFACTS.length} artifacts, ${MEMBERS.length} people, ${TECHNIQUES.length} arts\n`);

for (const cls of order) {
    const hits = findings.filter(f => f.cls === cls);
    console.log(`  ${cls} (${hits.length})`);
    for (const h of hits) console.log(`    ${h.where.padEnd(42)} ${h.what}`);
    console.log('');
}

if (stated.length > 0) {
    console.log(`  STATED ABSENCES (${stated.length}) - not findings. Nothing hands these over and the`);
    console.log('  catalog says so, in `NO_SURVIVING_COPY_TECHNIQUE_IDS`, with a reason each.');
    for (const s of stated) console.log(`    ${s}`);
    console.log('');
}

console.log('='.repeat(78));
console.log(`  ${findings.length} findings\n`);
