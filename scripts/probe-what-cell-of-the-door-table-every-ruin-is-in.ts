/**
 * Every ruin in the world, placed in the two-question table, and what the
 * places at the counted ones did over a century.
 *
 *   is it held        `controllingFactionId` on the row.
 *   are there slots   whether anything at the door is counting.
 *
 * BOTH ARMS RUN IN ONE COMMAND. The "before" arm is the world advanced with no
 * door pass at all, which is the tree as it stood; the "after" arm is the same
 * seed with `applyDoorsAndTheirPlaces` running on the yearly line. Two runs
 * minutes apart are two different trees, so a stash-and-rerun would not have
 * been a control arm.
 *
 *   npx esbuild scripts/probe-what-cell-of-the-door-table-every-ruin-is-in.ts \
 *       --bundle --platform=node --format=esm --external:better-sqlite3 \
 *       --outfile=probe.mjs && node probe.mjs
 */

import {
    isGroundWithADoor,
    whatADoorAdmits,
    type HowADoorIsKept
} from '../src/engine/world/a-door-with-a-count-on-it.js';
import { applyDoorsAndTheirPlaces } from '../src/engine/world/a-year-at-the-doors.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../tests/support/advance-world-years.js';
import { seedWorld } from '../src/engine/world/seeding.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const SEEDS = ['door-table-a', 'door-table-b', 'door-table-c'];
const YEARS = 200;
const THEN_A_CENTURY = 100;

const line = (s = ''): void => { process.stdout.write(`${s}\n`); };
const rule = (s: string): void => { line(); line(s); line('-'.repeat(s.length)); };

const CELLS: readonly HowADoorIsKept[] = [
    'doled_out', 'open_on_the_holders_terms', 'settled_with_fists', 'anybody_who_turns_up'
];

function cellsIn(state: WorldState): Record<HowADoorIsKept, number> {
    const out = {
        doled_out: 0, open_on_the_holders_terms: 0,
        settled_with_fists: 0, anybody_who_turns_up: 0
    };
    for (const l of state.locations) {
        if (!isGroundWithADoor(l) || !l.discovered) continue;
        out[whatADoorAdmits({ ruin: l }).cell]++;
    }
    return out;
}

const row = (label: string, cells: Record<HowADoorIsKept, number>): string =>
    `  ${label.padEnd(26)}` + CELLS.map(c => String(cells[c]).padStart(11)).join('');

interface Century {
    doorsShut: number;
    placesDealt: number;
    conclaves: number;
    passedOver: number;
    andTheyDid: number;
    dealtPerHouse: number[];
    reasons: string[];
    lines: string[];
}

/** A century with the door pass on the yearly line. */
function aCenturyOfDoors(state: WorldState, fromYear: number): Century {
    const era: Century = {
        doorsShut: 0, placesDealt: 0, conclaves: 0, passedOver: 0,
        andTheyDid: 0, dealtPerHouse: [], reasons: [], lines: []
    };
    for (let y = 0; y < THEN_A_CENTURY; y++) {
        const year = fromYear + y;
        state = advanceWorldYears(state, 1).state;
        for (const door of applyDoorsAndTheirPlaces(state, year, state.currentDay)) {
            if (door.shut) era.doorsShut++;
            if (door.deal) {
                for (const dealt of door.deal.dealt) {
                    if (!Number.isFinite(dealt.weight)) continue;
                    era.dealtPerHouse.push(dealt.places);
                    if (era.reasons.length < 8) era.reasons.push(dealt.because);
                }
                era.placesDealt += door.deal.places;
            }
            era.conclaves += door.conclaves.length;
            for (const c of door.conclaves) era.passedOver += c.passedOver.length;
            era.andTheyDid += door.andTheyDid.length;
            if (era.lines.length < 6) era.lines.push(...door.andTheyDid.slice(0, 2));
        }
    }
    return era;
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();

    rule('1. WHICH CELL EVERY DOOR IS IN, AT TWO HUNDRED YEARS');
    line(`  ${'seed'.padEnd(26)}${CELLS.map(c => c.slice(0, 11).padStart(11)).join('')}`);

    const worlds: { seed: string; state: WorldState }[] = [];
    for (const seed of SEEDS) {
        let state = seedWorld({ seed, catalog }).state;
        state = advanceWorldYears(state, YEARS).state;
        line(row(seed, cellsIn(state)));
        worlds.push({ seed, state });
    }

    rule('2. AND A CENTURY WITH THE DOOR PASS RUNNING');
    line(`  ${'seed'.padEnd(12)}${'shut'.padStart(6)}${'places'.padStart(8)}`
        + `${'conclaves'.padStart(11)}${'passed'.padStart(8)}${'they did'.padStart(10)}`
        + `${'per house'.padStart(11)}`);

    const kept: Century[] = [];
    for (const world of worlds) {
        const era = aCenturyOfDoors(world.state, YEARS);
        kept.push(era);
        const mean = era.dealtPerHouse.length > 0
            ? era.dealtPerHouse.reduce((s, n) => s + n, 0) / era.dealtPerHouse.length
            : 0;
        line(`  ${world.seed.padEnd(12)}${String(era.doorsShut).padStart(6)}`
            + `${String(era.placesDealt).padStart(8)}${String(era.conclaves).padStart(11)}`
            + `${String(era.passedOver).padStart(8)}${String(era.andTheyDid).padStart(10)}`
            + `${mean.toFixed(2).padStart(11)}`);
    }

    rule('3. THE CELLS AFTER THAT CENTURY');
    line(`  ${'seed'.padEnd(26)}${CELLS.map(c => c.slice(0, 11).padStart(11)).join('')}`);
    for (const world of worlds) line(row(world.seed, cellsIn(world.state)));

    rule('4. WHAT DECIDED EACH NUMBER');
    for (const reason of kept[0]?.reasons ?? []) line(`  ${reason}`);
    if ((kept[0]?.reasons.length ?? 0) === 0) line('  nothing was dealt.');

    rule('5. AND WHAT THE PEOPLE PASSED OVER DID ABOUT IT');
    for (const said of kept[0]?.lines ?? []) line(`  ${said}`);
    if ((kept[0]?.lines.length ?? 0) === 0) {
        line('  nothing. The motive is not wired.');
    }
}

void main();
