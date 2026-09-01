/**
 * Which arts have somebody who can personally carry a student through them, and
 * how far up the ladder that reaches.
 *
 * THE COMPLAINT THIS ANSWERS. The register printed, for the Deep Survey:
 * "How far they can take you: 43 ... the book ends at 45 ... the last 2 rungs
 * have no teacher anywhere and have to be walked alone." A world that contains
 * people standing at 44 and contains nobody who can teach to 44 is incoherent
 * on its face.
 *
 * The rule itself is not in question and is already right: a teacher CAN teach
 * up to their own standing. What this measures is who is wired as a teacher at
 * all, and against WHICH ceiling their reach should be compared - `carriesTo`
 * takes the lower of the teacher's own rung and the book's TEACHABLE END, which
 * is not its cap. Nobody is ever taught onto 45.
 *
 * THREE SOURCES OF A TEACHER, and they are separate registries that do not know
 * about each other, which is the first thing worth checking:
 *
 *   LIVING_TRANSMISSIONS   named individuals in `techniques.ts` who can
 *                          personally transmit a specific art.
 *   THE_DEEPEST_ROADS      the four bodies at the top, each with its own
 *                          teacher list in `roads-to-the-top-of-the-ladder.ts`.
 *   A HOUSE'S OWN PEOPLE   anybody on the register standing at or above an
 *                          art's `requiredOrdinal` in a house that teaches it.
 *                          This is the rule the world engine uses
 *                          (`teachableIn` in `manuals.ts`) and it is what makes
 *                          the ordinary succession teachable at all.
 *
 * Run: npx tsx scripts/probe-who-can-teach-the-top-of-the-ladder.ts
 */
import { TECHNIQUES, getTechnique, carriesTo, teachersOf, teachableEndOf } from '../src/data/cultivation/techniques.js';
import { SECTS, WITHDRAWN_POWERS } from '../src/data/cultivation/sects.js';
import { MEMBERS } from '../src/data/cultivation/members.js';
import { THE_DEEPEST_ROADS } from '../src/data/cultivation/roads-to-the-top-of-the-ladder.js';
import { rankName } from '../src/engine/cultivation/realms.js';

const ROADS = TECHNIQUES.filter(t => t.class === 'cultivation');
const ordinalOfMember = new Map(MEMBERS.map(m => [m.id, m.realmOrdinal]));

// ── 1. WHO STANDS AT 43 AND ABOVE, AND DO THEY TEACH? ───────────────────
console.log('EVERYBODY THE CATALOG PLACES AT ORDINAL 42 OR ABOVE');
console.log(' ord  teaches?  who');
console.log('-'.repeat(78));

interface HighStander { ordinal: number; who: string; source: string; teaches: string[] }
const high: HighStander[] = [];

for (const m of MEMBERS) {
    if (m.realmOrdinal < 42) continue;
    high.push({
        ordinal: m.realmOrdinal,
        who: `${m.name} (${m.factionId})`,
        source: 'MEMBERS',
        teaches: transmissionsFor(m.id)
    });
}
for (const road of THE_DEEPEST_ROADS) {
    for (const t of road.teachers) {
        if (t.realmOrdinal < 42) continue;
        high.push({
            ordinal: t.realmOrdinal,
            who: `${t.who} (${road.factionId})`,
            source: 'THE_DEEPEST_ROADS',
            teaches: [road.techniqueId]
        });
    }
}
for (const [factionId, w] of Object.entries(WITHDRAWN_POWERS)) {
    for (const seat of w.seats) {
        if (seat.ordinal < 42) continue;
        if (high.some(h => h.who.includes(seat.position) && h.who.includes(factionId))) continue;
        high.push({ ordinal: seat.ordinal, who: `${seat.position} (${factionId})`, source: 'WITHDRAWN_POWERS', teaches: [] });
    }
}

function transmissionsFor(memberId: string): string[] {
    return ROADS.filter(r => teachersOf(r.id).some(t => t.memberId === memberId)).map(r => r.id);
}

for (const h of [...high].sort((a, b) => b.ordinal - a.ordinal)) {
    console.log(
        String(h.ordinal).padStart(4),
        (h.teaches.length ? ' yes     ' : ' NO      ').padEnd(9),
        `${h.who}  [${h.source}]` + (h.teaches.length ? ` -> ${h.teaches.join(', ')}` : '')
    );
}

// ── 2. HOW FAR CAN ANYBODY BE TAUGHT, PER ART? ──────────────────────────
/** The highest rung anybody in the world can personally carry a student to. */
function bestTeacherFor(techniqueId: string): { ordinal: number; who: string } | null {
    let best: { ordinal: number; who: string } | null = null;
    const take = (ordinal: number, who: string) => {
        if (!best || ordinal > best.ordinal) best = { ordinal, who };
    };
    for (const t of teachersOf(techniqueId)) {
        const o = ordinalOfMember.get(t.memberId);
        if (o !== undefined) take(o, t.memberId);
    }
    for (const road of THE_DEEPEST_ROADS) {
        if (road.techniqueId !== techniqueId) continue;
        for (const t of road.teachers) take(t.realmOrdinal, t.who);
    }
    const art = getTechnique(techniqueId);
    if (art) {
        for (const s of SECTS) {
            if (!s.teaches.includes(techniqueId)) continue;
            for (const m of MEMBERS) {
                if (m.factionId !== s.id) continue;
                if (m.realmOrdinal >= art.requiredOrdinal) take(m.realmOrdinal, m.name);
            }
        }
    }
    return best;
}

// `end` is the highest rung TEACHING can reach on this book, which is not the
// same as its cap: nobody is ever taught onto 45, because that rung is reached
// by surviving the crossing and by nothing else. Comparing a teacher's reach
// against `cap` is what made the register report the Hollow Court as unable to
// finish its own road. `gap` below is measured against `end`.
console.log('\nEVERY CULTIVATION ART: CAP, TEACHABLE END, BEST TEACHER, AND THE REAL GAP');
console.log(' cap  end  best  reach  gap  art');
console.log('-'.repeat(88));
let teacherless = 0;
const byCapTeacherless = new Map<number, string[]>();
const gaps: { id: string; end: number; reach: number }[] = [];

for (const art of [...ROADS].sort((a, b) => (a.cap ?? 99) - (b.cap ?? 99))) {
    const cap = art.cap ?? 99;
    const end = teachableEndOf(art.id) ?? 0;
    const best = bestTeacherFor(art.id);
    if (!best) {
        teacherless++;
        byCapTeacherless.set(cap, [...(byCapTeacherless.get(cap) ?? []), art.id]);
        console.log(`${String(art.cap ?? 'null').padStart(4)}  ${String(end).padStart(3)}    -      -    -  ${art.id}  NO TEACHER ANYWHERE`);
        continue;
    }
    const reach = carriesTo(best.ordinal, art.id) ?? best.ordinal;
    const gap = end - reach;
    if (gap > 0) gaps.push({ id: art.id, end, reach });
    console.log(
        `${String(art.cap ?? 'null').padStart(4)}  ${String(end).padStart(3)}  ${String(best.ordinal).padStart(4)}  ` +
        `${String(reach).padStart(5)}  ${String(gap).padStart(3)}  ${art.id}` +
        (gap === 0 && cap !== 99 && end < cap ? '   <- finishes it: the rungs above are not taught to anybody' : '')
    );
}

// ── 3. THE ANSWERS ──────────────────────────────────────────────────────
console.log('\n' + '='.repeat(78));
console.log(`cultivation arts: ${ROADS.length}`);
console.log(`with NO teacher anywhere: ${teacherless}`);
for (const [cap, ids] of [...byCapTeacherless.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`   cap ${String(cap).padStart(4)}: ${ids.length}  ${ids.join(', ')}`);
}
console.log(`\nwith a teacher who cannot reach the book's TEACHABLE END: ${gaps.length}`);
for (const g of gaps) console.log(`   ${g.id.padEnd(38)} teachable to ${g.end}, taught only to ${g.reach}`);

const reachable = ROADS
    .map(a => { const b = bestTeacherFor(a.id); return b ? (carriesTo(b.ordinal, a.id) ?? b.ordinal) : -1; });
const highestTaught = Math.max(...reachable);
console.log(`\nHIGHEST RUNG ANYBODY IN THE WORLD CAN BE TAUGHT TO: ${highestTaught} (${rankName(highestTaught)})`);
const at44 = ROADS.filter((a, i) => reachable[i] >= 44).map(a => a.id);
console.log(`arts that can be taught to 44: ${at44.length}${at44.length ? '  ' + at44.join(', ') : ''}`);
