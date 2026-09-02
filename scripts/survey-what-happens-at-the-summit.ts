/**
 * What becomes of somebody who reaches the top of the ladder, and of what they
 * were holding?
 *
 * Reaching 44 is proven. The untested half is the endgame, and it only appears
 * at depth: a Tribulation Transcendence cultivator carries tens of thousands of
 * years, so nobody clock runs down inside a short run.
 *
 * `past-the-ceiling.md` documents an inheritance economy that turns on this -
 * nothing goes through the Lid except the cultivator, they know it well in
 * advance, and the years before a crossing are spent selling, gifting, burying,
 * sealing and arranging. None of it has ever been observed firing.
 *
 * So this follows every person who reaches ordinal 41 or above and records:
 * how they left (crossed, died, still standing), what they were holding when
 * they did, where it went afterwards, and whether the world emitted anything
 * with their name on it. A run that produces an ascension and no trace of the
 * person who made it is the finding.
 *
 * Run: npx tsx scripts/survey-what-happens-at-the-summit.ts [years] [pop] [seeds...]
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { FALSE_IMMORTAL_ORDINAL, TRUE_IMMORTAL_ORDINAL, realmForOrdinal, REALM_TIERS } from '../src/engine/cultivation/realms.js';
import { ageInYears, yearsToLifespanEnd } from '../src/engine/world/npc-state.js';

const YEARS = Number(process.argv[2] ?? 6000);
const POP = Number(process.argv[3] ?? 400);
const SEEDS = process.argv.slice(4).length ? process.argv.slice(4) : ['d1', 'd2'];
const STEP = 100;
const catalog = await loadCultivationCatalog();
const KEYS = REALM_TIERS.map(t => t.key);

interface Summiteer {
    id: string; name: string; seed: string;
    reached41At: number; peak: number;
    heldRoads: number; heldObjects: number;
    fate: 'crossed' | 'died' | 'standing';
    fateYear: number | null; finalOrdinal: number;
    objectsAfter: number; factsNaming: number;
    yearsLeftAtFate: number | null;
}

for (const seed of SEEDS) {
    let state = seedWorld({ seed, catalog, population: POP }).state as any;
    const tracked = new Map<string, Summiteer>();
    const factsAt = new Map<string, number>();

    const objectsOf = (s: any, id: string) =>
        (s.objects as any[]).filter(o => o.possessorId === id || o.ownerId === id).length;

    for (let y = 0; y <= YEARS; y += STEP) {
        if (y > 0) state = advanceWorldYears(state, STEP).state;
        for (const n of state.npcs as any[]) {
            const o = n.cultivation.realmOrdinal;
            if (o >= 41 && !tracked.has(n.id) && n.status === 'alive') {
                tracked.set(n.id, {
                    id: n.id, name: n.name, seed, reached41At: y, peak: o,
                    heldRoads: (n.cultivation.techniqueIds ?? []).length,
                    heldObjects: objectsOf(state, n.id),
                    fate: 'standing', fateYear: null, finalOrdinal: o,
                    objectsAfter: 0, factsNaming: 0,
                    yearsLeftAtFate: null
                });
            }
            const t = tracked.get(n.id);
            if (!t) continue;
            t.peak = Math.max(t.peak, o);
            t.finalOrdinal = o;
            if (t.fate === 'standing') {
                if (o >= FALSE_IMMORTAL_ORDINAL) {
                    t.fate = 'crossed'; t.fateYear = y;
                    t.heldRoads = (n.cultivation.techniqueIds ?? []).length;
                } else if (n.status !== 'alive') {
                    t.fate = 'died'; t.fateYear = y;
                    t.yearsLeftAtFate = Math.round(yearsToLifespanEnd(n, state.currentDay));
                }
            }
        }
    }

    // What is left with their name on it, after the fact.
    for (const t of tracked.values()) {
        t.objectsAfter = objectsOf(state, t.id);
        t.factsNaming = (state.history.facts as any[]).filter(f =>
            (f.npcIds ?? []).includes(t.id) ||
            String(f.summary ?? '').includes(t.name)).length;
    }

    const alive = (state.npcs as any[]).filter(n => n.status === 'alive');
    const cnt = new Map<string, number>(KEYS.map(k => [k, 0]));
    for (const n of alive) { const k = realmForOrdinal(n.cultivation.realmOrdinal).key; cnt.set(k, (cnt.get(k) ?? 0) + 1); }
    const third = (a: number, b: number) => KEYS.slice(a, b).reduce((s, k) => s + (cnt.get(k) ?? 0), 0);

    console.log(`\n===== seed ${seed}, ${YEARS}y, pop ${POP} =====`);
    console.log(`reached ordinal 41+: ${tracked.size}`);
    console.log('who                       peak  reached  fate      at      roads  objBefore objAfter facts');
    for (const t of [...tracked.values()].sort((a, b) => b.peak - a.peak)) {
        console.log(
            `  ${t.name.padEnd(22)} ${String(t.peak).padStart(4)} ${String(t.reached41At).padStart(8)}` +
            `  ${t.fate.padEnd(8)} ${String(t.fateYear ?? '-').padStart(6)}` +
            ` ${String(t.heldRoads).padStart(7)} ${String(t.heldObjects).padStart(10)} ${String(t.objectsAfter).padStart(8)}` +
            ` ${String(t.factsNaming).padStart(5)}` +
            (t.yearsLeftAtFate !== null ? `   yearsLeft ${t.yearsLeftAtFate}` : ''));
    }
    console.log(`pyramid: bottom ${third(0, 3)}  middle ${third(3, 6)}  top ${third(6, KEYS.length)}` +
        `   qi ${cnt.get('qi_condensation')} found ${cnt.get('foundation_establishment')}` +
        `   ${(cnt.get('foundation_establishment') ?? 0) > (cnt.get('qi_condensation') ?? 0) ? 'FLOOR VIOLATED' : 'floor holds'}`);
}
