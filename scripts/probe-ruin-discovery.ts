/**
 * What the world finds, and whether it stops finding it.
 *
 * The design owner's model for ruins is the oil model: nobody is making any
 * more, the stock is finite in principle, and the supply is effectively
 * inexhaustible in practice because DISCOVERY keeps finding more. This probe
 * measures the only thing that distinguishes that model from a fixed endowment,
 * which is what the rate does at a long horizon.
 *
 * A model that is really a countdown looks identical to a reserve at year 200
 * and goes to zero by year 1000. The 5,000-year column is the one that tells
 * them apart, and the early-against-late columns are the one that says whether
 * diminishing returns is present rather than asserted.
 *
 *   npx tsc && node dist-probe/scripts/probe-ruin-discovery.js
 *   (or run it through the test harness, which is what the committed measurement did)
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { applyPressure } from '../src/engine/world/pressure.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { DAO_GROUND_TAG } from '../src/engine/world/how-a-cultivator-comes-by-a-road.js';
import {
    prospectFor,
    standingReserve,
    stillInGroundUnder
} from '../src/engine/world/how-the-world-keeps-finding-more-ruins.js';
import type { WorldCatalog } from '../src/engine/world/catalog.js';

const YEAR = 365;

function line(s = ''): void {
    process.stdout.write(s + '\n');
}

export interface DiscoveryRow {
    seed: string;
    years: number;
    opened: number;
    perCentury: number;
    /** Openings in the first fifth of the run against the last fifth. */
    earlyPerCentury: number;
    latePerCentury: number;
    ruinLocations: number;
    buriedFound: number;
    buriedTotal: number;
    /** Ground found by prospecting, and the same split into early and late. */
    found: number;
    foundEarlyPerCentury: number;
    foundLatePerCentury: number;
    /** Found and not yet emptied: the standing reserve. */
    reserve: number;
    /** Provinces, and what is still under them. */
    provinces: number;
    stillInGround: number;
    /** Finds that were seeded ground nobody had located, against newly described. */
    alreadyHere: number;
    newlyDescribed: number;
    /** Access shapes across everything found. */
    byAdmits: Record<string, number>;
    byCharacter: Record<string, number>;
    /** Where each province stood at the end of the run. The diagnostic. */
    endState: string[];
    livingNpcs: number;
    placedNpcs: number;
}

export function measureDiscovery(catalog: WorldCatalog, seed: string, years: number): DiscoveryRow {
    const state = seedWorld({ seed, catalog, presentYear: 1000, population: 250 }).state;
    const from = state.currentDay;

    // THE EVENT BUDGET IS A TRAP AT A LONG HORIZON. `applyPressure` defaults
    // `maxEvents` to 4000 and its year loop carries `events.length < maxEvents`
    // in the CONDITION, so a five-thousand-year span silently stops running
    // years once the budget is spent - at roughly one event a year, the last
    // thousand years of a five-thousand-year run never happen at all.
    //
    // That produced a finding: the "zero ruin openings per century in the last
    // fifth" that motivated this whole change was PARTLY this and not only the
    // endowment. The endowment defect is real and is visible at 3000 years
    // where the budget is not binding, but the 5000-year figure was measuring
    // the harness. Raised here rather than in the engine, because a bounded
    // event budget is correct for a caller that has to render the digest.
    applyPressure(state, from, from + years * YEAR, { maxEvents: 1_000_000 });

    // Every find stamps `foundInYear` on the location it found, so the whole
    // discovery history is readable off state at the end and the probe does not
    // have to step the world a year at a time to see it.
    const startYear = Math.floor(from / YEAR);
    const findYears: number[] = [];
    const byAdmits: Record<string, number> = {};
    const byCharacter: Record<string, number> = {};
    let alreadyHere = 0;
    let newlyDescribed = 0;
    for (const l of state.locations) {
        if (l.data.foundInYear === undefined || l.data.foundInYear === null) continue;
        findYears.push(Number(l.data.foundInYear) - startYear);
        const admits = String(l.data.admits ?? 'anyone_who_survives_it');
        byAdmits[admits] = (byAdmits[admits] ?? 0) + 1;
        const character = String(l.data.ruinCharacter ?? 'already-here');
        byCharacter[character] = (byCharacter[character] ?? 0) + 1;
        if (l.tags.includes('found-by-prospecting')) newlyDescribed++;
        else alreadyHere++;
    }

    const opens = state.history.facts
        .filter(f => f.kind === 'ruin_opened')
        .map(f => Math.floor((f.day - from) / YEAR))
        .filter(y => y >= 0);

    const fifth = Math.max(1, Math.floor(years / 5));
    const early = opens.filter(y => y < fifth).length;
    const late = opens.filter(y => y >= years - fifth).length;
    const foundEarly = findYears.filter(y => y < fifth).length;
    const foundLate = findYears.filter(y => y >= years - fifth).length;

    const buried = state.locations.filter(
        l => l.tags.includes(DAO_GROUND_TAG) && l.data.daoAccess === 'buried'
    );
    const provinces = state.locations.filter(l => l.kind === 'region');

    return {
        seed,
        years,
        opened: opens.length,
        perCentury: (opens.length / years) * 100,
        earlyPerCentury: (early / fifth) * 100,
        latePerCentury: (late / fifth) * 100,
        ruinLocations: state.locations.filter(l => l.kind === 'ruin').length,
        buriedFound: buried.filter(l => l.discovered).length,
        buriedTotal: buried.length,
        found: findYears.length,
        foundEarlyPerCentury: (foundEarly / fifth) * 100,
        foundLatePerCentury: (foundLate / fifth) * 100,
        reserve: standingReserve(state).length,
        provinces: provinces.length,
        stillInGround: provinces.reduce((n, p) => n + stillInGroundUnder(p), 0),
        alreadyHere,
        newlyDescribed,
        byAdmits,
        byCharacter,
        endState: provinces.map(p => {
            const s = prospectFor(state, p);
            return `${p.name}: parties=${s.parties.toFixed(2)} reach=${s.reachableBand} ` +
                `band=${s.workingBand} found=${s.foundInProvince} odds=${s.oddsThisYear.toFixed(5)} ` +
                `left=${stillInGroundUnder(p)}`;
        }),
        livingNpcs: state.npcs.filter(n => n.status === 'alive').length,
        placedNpcs: state.npcs.filter(n => n.status === 'alive' && n.locationId !== null).length
    };
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    const seeds = process.env.PROBE_SEEDS?.split(',') ?? ['alpha', 'bravo', 'charlie'];
    const horizons = (process.env.PROBE_YEARS?.split(',') ?? ['500', '1000', '5000']).map(Number);

    line('RUIN DISCOVERY');
    line('seed        years  opened  /century  early/c   late/c  ruin locs  buried');
    for (const years of horizons) {
        for (const seed of seeds) {
            const r = measureDiscovery(catalog, seed, years);
            line(
                `${r.seed.padEnd(11)} ${String(r.years).padStart(5)} ${String(r.opened).padStart(7)} ` +
                `${r.perCentury.toFixed(2).padStart(9)} ${r.earlyPerCentury.toFixed(1).padStart(8)} ` +
                `${r.latePerCentury.toFixed(1).padStart(8)} ${String(r.ruinLocations).padStart(10)} ` +
                `${String(r.buriedFound).padStart(6)}/${r.buriedTotal}`
            );
        }
        line();
    }
}

if (process.argv[1] && process.argv[1].includes('probe-ruin-discovery')) {
    void main();
}
