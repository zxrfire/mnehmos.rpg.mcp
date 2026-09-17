/**
 * Is somebody taken on let in at the gate, on the house's word or on questioning?
 *
 * Per seed, at each horizon, over the people on a roll who were NOT on that roll
 * at world open:
 *
 *   joiners           alive and on a roll with a seat
 *   entered           wearing this house's robes
 *   in compound       standing on the seat or a room inside it, never entered
 *                     (the yearly pass enters or turns away everybody it finds)
 *   away, never entered, by what the house would make of them today:
 *                     expected / admitted on questioning / rejected / no account
 *   reports lost      of those away, whoever owed the report is dead
 *   turned away       cumulative: never entered at the start of a year, off
 *                     that roll and still alive at its end
 *   entered by word   cumulative: never entered at the start of a year and robed
 *                     at its end, by what the house made of them at its start
 *
 * ── WHAT IT SAID, FOUR SEEDS, SUMMED ─────────────────────────────────────
 *
 * Before questioning, when a recruit with no report waited at the gate:
 *
 *                                   25 years          60 years
 *   waiting at the gate               3                 10
 *   reports lost, still away          2                 15
 *
 * After, entries by what the house made of them at the start of that year:
 *
 *                                   25 years          60 years
 *   on the report                    434              1069
 *   on questioning                    72               124
 *   nobody took them on               12                50
 *   in a compound, never entered       0                 0
 *   reports lost, still away           0                 0
 *   turned away, of whom                1                 9
 *     rejected on questioning           0                 1
 *
 * The rest of the turned away were off the roll for other reasons - they were
 * not standing at a gate. The worlds moved under other work between the two
 * runs, so the counts of people are not comparable; the waiting are.
 *
 * Run: npx tsx scripts/probe-is-a-recruit-expected-at-the-gate.ts
 */
import { writeFileSync } from 'node:fs';
import { seedWorld } from '../src/engine/world/seeding.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import {
    theReportsTheyOwe,
    whatTheHouseMakesOfSomebodyNew
} from '../src/engine/world/a-house-expects-somebody-it-took-on.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const SEEDS = (process.env.PROBE_SEEDS ?? 'afford-a,afford-b,roster-d,demography').split(',');
const HORIZONS = (process.env.PROBE_YEARS ?? '25,60').split(',').map(Number);
const OUT = process.env.PROBE_OUT ?? 'expected';
const DIR = process.env.PROBE_DIR
    ?? 'C:/Users/hi/AppData/Local/Temp/claude/D--intellij-projects-mnehmos-rpg-mcp/3d2e277e-1d82-4af0-b83d-0272dd08fa74/scratchpad';

function insideOf(state: WorldState) {
    const byId = new Map(state.locations.map(l => [l.id, l]));
    return (locationId: string | null, seat: string): boolean => {
        let at = locationId;
        for (let hops = 0; hops <= 3 && at !== null; hops++) {
            if (at === seat) return true;
            at = byId.get(at)?.parentId ?? null;
        }
        return false;
    };
}

function robesOf(state: WorldState): Set<string> {
    return new Set(state.objects
        .filter(o => o.tags.includes('uniform') && o.possessorId)
        .map(o => `${o.possessorId}|${o.ownerId}`));
}

function measure(state: WorldState, founding: Map<string, string>) {
    const inside = insideOf(state);
    const houses = new Map(state.factions.filter(f => f.dissolvedOnDay === null).map(f => [f.id, f]));
    const robes = robesOf(state);
    const owedByTheDead = new Set<string>();
    for (const n of state.npcs) {
        if (n.status === 'alive') continue;
        for (const r of theReportsTheyOwe(n)) owedByTheDead.add(`${r.personId}|${r.houseId}`);
    }
    const r = {
        joiners: 0, entered: 0, inCompound: 0,
        away: 0, awayExpected: 0, awayAdmittedOnQuestioning: 0, awayRejected: 0, awayNoAccount: 0,
        reportsLost: 0, rejectedBecause: [] as string[]
    };
    for (const n of state.npcs) {
        if (n.status !== 'alive' || !n.factionId) continue;
        if (founding.get(n.id) === n.factionId) continue;
        const house = houses.get(n.factionId);
        if (!house || !house.seatLocationId) continue;
        r.joiners++;
        const key = `${n.id}|${n.factionId}`;
        if (robes.has(key)) { r.entered++; continue; }
        if (inside(n.locationId, house.seatLocationId)) { r.inCompound++; continue; }
        r.away++;
        if (owedByTheDead.has(key)) r.reportsLost++;
        const made = whatTheHouseMakesOfSomebodyNew(state, house, n);
        if (made.reading === 'expected') r.awayExpected++;
        else if (made.reading === 'admitted on questioning') r.awayAdmittedOnQuestioning++;
        else if (made.reading === 'rejected on questioning') {
            r.awayRejected++;
            if (r.rejectedBecause.length < 3) r.rejectedBecause.push(made.because);
        } else r.awayNoAccount++;
    }
    return r;
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    const dump: Record<string, unknown> = {};
    for (const seed of SEEDS) {
        const t0 = Date.now();
        const { state } = seedWorld({ seed, catalog });
        const founding = new Map<string, string>();
        for (const n of state.npcs) if (n.status === 'alive' && n.factionId) founding.set(n.id, n.factionId);
        let turnedAway = 0;
        const enteredBy: Record<string, number> = {};
        const turnedAwayBy: Record<string, number> = {};
        let y = 0;
        for (const horizon of HORIZONS) {
            for (; y < horizon; y++) {
                // Who is never entered, before the year, and what the house makes of them.
                const robes = robesOf(state);
                const houses = new Map(state.factions.filter(f => f.dissolvedOnDay === null).map(f => [f.id, f]));
                const unentered = new Map<string, { house: string; reading: string }>();
                for (const n of state.npcs) {
                    if (n.status !== 'alive' || !n.factionId || founding.get(n.id) === n.factionId) continue;
                    const house = houses.get(n.factionId);
                    if (!house?.seatLocationId || robes.has(`${n.id}|${n.factionId}`)) continue;
                    unentered.set(n.id, { house: n.factionId, reading: whatTheHouseMakesOfSomebodyNew(state, house, n).reading });
                }
                advanceWorldYears(state, 1, { stopOnInterrupt: false });
                const after = robesOf(state);
                for (const n of state.npcs) {
                    const was = unentered.get(n.id);
                    if (was === undefined || n.status !== 'alive') continue;
                    if (n.factionId === was.house && after.has(`${n.id}|${was.house}`)) {
                        enteredBy[was.reading] = (enteredBy[was.reading] ?? 0) + 1;
                    } else if (n.factionId !== was.house) {
                        turnedAway++;
                        turnedAwayBy[was.reading] = (turnedAwayBy[was.reading] ?? 0) + 1;
                    }
                }
            }
            const m = { ...measure(state, founding), turnedAway, turnedAwayBy, enteredBy };
            dump[`${seed}@${horizon}`] = m;
            console.log(seed, horizon, JSON.stringify(m), `${Math.round((Date.now() - t0) / 1000)}s`);
            writeFileSync(`${DIR}/probe-expected-${OUT}.json`, JSON.stringify(dump, null, 2));
        }
    }
}

main().catch(e => { console.error(e); process.exit(1); });
