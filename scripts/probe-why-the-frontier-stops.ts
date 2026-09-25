/**
 * How high the world climbs on its own, and what is shut in front of the top.
 *
 * Splits the living three ways, because pooling them hides the whole question:
 * people the CATALOG wrote, people the SIMULATION made, and the beast rows,
 * which climb by sitting and are under none of the human gates. Then, at each
 * horizon, takes the simulated people standing at the floor or above and asks
 * which gate is shut in front of them - the province, the book, the settling
 * clock, the span, or the dao gate.
 *
 * Run: npx tsx scripts/probe-why-the-frontier-stops.ts [years] [step] [seed] [floor]
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { catalogPersonBehind } from '../src/engine/world/a-catalog-person-and-their-world-row.js';
import { theSpeciesItIs } from '../src/engine/world/a-beast-with-a-core-is-somebody-in-particular.js';
import { reachableCeilingFor, manualCeilingOf, BOOKLESS_CEILING } from '../src/engine/world/manuals.js';
import { roadsInReachOf } from '../src/engine/world/how-a-cultivator-comes-by-a-road.js';
import { canAttemptBreakthrough, daoRequirementFor } from '../src/engine/cultivation/breakthrough.js';
import { getTechnique } from '../src/data/cultivation/techniques.js';
import { progressRequiredForOrdinal, REALM_TIERS } from '../src/engine/cultivation/realms.js';
import { stagnationYearsForOrdinal } from '../src/schema/cultivation.js';
import { DAYS_PER_YEAR } from '../src/engine/cultivation/cultivation.js';

const YEARS = Number(process.argv[2] ?? 5000);
const STEP = Number(process.argv[3] ?? 25);
const SEED = process.argv[4] ?? 'frontier';
const FLOOR = Number(process.argv[5] ?? 28);
const HORIZONS = new Set([100, 300, 500, 1000, 2000, 3000, 4000, 5000, 6000, 8000, 10000]);

const catalog = await loadCultivationCatalog();
let state = seedWorld({ seed: SEED, catalog }).state as any;

const authored = (n: any) => catalogPersonBehind(n.id) !== null;

function regionCeilingFor(n: any): number {
    const tag = (n.tags as string[]).find(t => t.startsWith('region:'))?.slice(7);
    const region = state.locations.find(
        (l: any) => l.kind === 'region' && String(l.data.catalogRegionId ?? '') === tag
    ) ?? state.locations.find((l: any) => l.id === n.locationId);
    return Number(region?.data.localCeilingOrdinal ?? 20);
}

function bandRow(pool: any[]): number[] {
    return REALM_TIERS.map(t => pool.filter(n => n.cultivation.realmOrdinal >= t.ordinalStart
        && n.cultivation.realmOrdinal <= t.ordinalEnd).length);
}

function report(year: number): void {
    const alive = (state.npcs as any[]).filter(n => n.status === 'alive');
    const beasts = alive.filter(n => theSpeciesItIs(n) !== null);
    const people = alive.filter(n => theSpeciesItIs(n) === null);
    const sim = people.filter(n => !authored(n));
    const auth = people.filter(n => authored(n));
    const hi = (xs: any[]) => xs.reduce((m, n) => Math.max(m, n.cultivation.realmOrdinal), -1);

    console.log(`\n═══ YEAR ${year} ═══ alive ${alive.length}` +
        `  simulated ${sim.length} (highest ${hi(sim)})` +
        `  authored ${auth.length} (highest ${hi(auth)})` +
        `  beasts ${beasts.length} (highest ${hi(beasts)})`);
    const s = bandRow(sim), a = bandRow(auth), b = bandRow(beasts);
    console.log('  band                          sim  auth  beast');
    REALM_TIERS.forEach((t, i) => {
        if (s[i] + a[i] + b[i] === 0) return;
        console.log(`  ${t.name.padEnd(27)}${String(s[i]).padStart(4)}${String(a[i]).padStart(6)}${String(b[i]).padStart(7)}`);
    });

    const shut = { province: 0, book: 0, settled: 0, span: 0, dao: 0, climbing: 0 };
    for (const n of sim) {
        const o = n.cultivation.realmOrdinal;
        if (o < FLOOR) continue;
        const book = reachableCeilingFor(state, n) || BOOKLESS_CEILING;
        const province = regionCeilingFor(n);
        if (province <= o) { shut.province++; continue; }
        if (book <= o) { shut.book++; continue; }
        const allowance = stagnationYearsForOrdinal(o);
        const stood = (state.currentDay - n.cultivation.lastAdvancedOnDay) / DAYS_PER_YEAR;
        const left = (n.cultivation.lifespanEndsOnDay - state.currentDay) / DAYS_PER_YEAR;
        if (stood >= allowance) { shut.settled++; continue; }
        if (left <= 0) { shut.span++; continue; }
        const check = canAttemptBreakthrough({
            realmOrdinal: o,
            cultivationProgress: progressRequiredForOrdinal(o) ?? 0,
            alive: true,
            insights: [],
            knownTechniques: n.cultivation.techniqueIds,
            roadsWithinReach: roadsInReachOf(state, n),
            spiritRoot: n.cultivation.spiritRoot,
            attributes: n.cultivation.attributes,
            injuries: [],
            age: (state.currentDay - n.identity.bornOnDay) / DAYS_PER_YEAR
        } as any);
        if (check.reason === 'insufficient_dao') { shut.dao++; continue; }
        shut.climbing++;
    }
    console.log(`  simulated at ${FLOOR}+: province ${shut.province} book ${shut.book}` +
        ` settled ${shut.settled} span ${shut.span} dao ${shut.dao} still-climbing ${shut.climbing}`);

    // WHAT CAME OUT OF THE GROUND, AND WHETHER IT WENT ANYWHERE.
    //
    // A book in a hole is not a fix. The three figures that say whether it is
    // are: how many are out, how many are in somebody's hands, and how many
    // hands hold each one - because a single copy in a single pair of hands is
    // the defect being repaired rather than the repair.
    const manuals = (state.objects as any[]).filter(o => o.kind === 'manual');
    const inTheGround = manuals.filter(o => o.tags.includes('unrecovered'));
    const carriedOut = manuals.filter(o => o.data?.carriedOutOf !== undefined);
    const outOfTheGround = new Set(carriedOut.map(o => String(o.data.techniqueId)));
    const holdersOf = new Map<string, number>();
    const climbedOn = new Map<string, number>();
    for (const n of alive) {
        for (const id of n.cultivation.techniqueIds as string[]) {
            if (!outOfTheGround.has(id)) continue;
            holdersOf.set(id, (holdersOf.get(id) ?? 0) + 1);
            const t = getTechnique(id);
            if (t && n.cultivation.realmOrdinal > Number(t.requiredOrdinal ?? 0)) {
                climbedOn.set(id, (climbedOn.get(id) ?? 0) + 1);
            }
        }
    }
    const copiesOut = manuals.filter(
        o => outOfTheGround.has(String(o.data?.techniqueId)) && o.possessorId !== null).length;
    const perCentury = year > 0 ? (carriedOut.length / (year / 100)).toFixed(2) : '-';
    console.log(`  books: ${inTheGround.length} still in the ground, ${carriedOut.length} carried out`
        + ` (${perCentury}/century), ${outOfTheGround.size} distinct roads out,`
        + ` ${copiesOut} copies of them in the world`);
    if (outOfTheGround.size > 0) {
        const spread = [...outOfTheGround].map(id => {
            const t = getTechnique(id);
            return `${id}(${t?.requiredOrdinal}->${t?.cap}) ${holdersOf.get(id) ?? 0}h/${climbedOn.get(id) ?? 0}climbed`;
        });
        console.log('    ' + spread.join('  '));
    }

    // WHO IS HIGHEST, AND WHICH BOOK IS IN THEIR HANDS.
    const top = sim.sort((x, y) => y.cultivation.realmOrdinal - x.cultivation.realmOrdinal).slice(0, 8);
    for (const n of top) {
        const o = n.cultivation.realmOrdinal;
        if (o < FLOOR) break;
        const deep = n.cultivation.techniqueIds
            .map((id: string) => getTechnique(id))
            .filter((t: any) => t && Number(t.cap ?? 0) > 37)
            .map((t: any) => `${t.id}(${t.requiredOrdinal}->${t.cap})`);
        console.log(`    ord ${String(o).padStart(2)}  province ${String(regionCeilingFor(n)).padStart(2)}` +
            `  book ${String(manualCeilingOf(n)).padStart(2)}  house ${n.factionId ?? '-'}` +
            (deep.length > 0 ? `  carrying ${deep.join(' ')}` : '  carrying nothing above 37'));
    }
}

console.log(`seed ${SEED}`);
console.log('dao roads required at each boundary: ' +
    [20, 24, 28, 32, 36, 40, 44].map(o => `${o}:${daoRequirementFor(o)}`).join(' '));

report(0);
for (let y = STEP; y <= YEARS; y += STEP) {
    state = advanceWorldYears(state, STEP).state;
    if (HORIZONS.has(y)) report(y);
}
