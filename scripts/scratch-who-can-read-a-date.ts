/**
 * Which half of "this house knows the date" fails, at seed and after a run.
 *
 *   npx esbuild scripts/scratch-who-can-read-a-date.ts --bundle --platform=node \
 *       --format=esm --external:better-sqlite3 --outfile=w.mjs && node w.mjs
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { applyPressure } from '../src/engine/world/pressure.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { readSchedule } from '../src/engine/world/convergence.js';
import { isBelowTheLid } from '../src/engine/world/layers.js';
import {
    whatOneOfTheWorldsOwnPeopleKnows
} from '../src/engine/world/what-one-of-the-worlds-own-people-knows.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const YEAR = 365;

function report(state: WorldState, label: string): void {
    const day = Math.floor(state.currentDay);
    const peopleKnow = whatOneOfTheWorldsOwnPeopleKnows(state);
    const houses = state.factions.filter(
        f => f.dissolvedOnDay === null && isBelowTheLid(f) && f.seatLocationId !== null
    );
    const roll = new Map<string, { id: string; ordinal: number }[]>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !npc.factionId) continue;
        const theirs = roll.get(npc.factionId);
        const who = { id: npc.id, ordinal: npc.cultivation.realmOrdinal };
        if (theirs) theirs.push(who); else roll.set(npc.factionId, [who]);
    }

    let pairs = 0;
    let canRead = 0;
    let hasGround = 0;
    let both = 0;
    const stages = new Map<string, number>();
    for (const site of state.locations) {
        if (!site.cycle || site.kind !== 'ruin') continue;
        for (const house of houses) {
            pairs++;
            const people = roll.get(house.id) ?? [];
            let read = false;
            let ground = false;
            for (const person of people) {
                if (readSchedule(site, { id: person.id, realmOrdinal: person.ordinal }, day).known) {
                    read = true;
                    const stage = peopleKnow(person.id, 'place', site.id);
                    stages.set(stage, (stages.get(stage) ?? 0) + 1);
                    if (stage !== 'unaware') { ground = true; break; }
                }
            }
            if (read) canRead++;
            if (ground) hasGround++;
            if (read && ground) both++;
        }
    }
    process.stdout.write(
        `${label}: house/site pairs ${pairs}, somebody can read the schedule ${canRead}, `
        + `and of those somebody also has the ground ${both}\n`
        + `  stages seen among readers: `
        + `${[...stages].map(([s, n]) => `${s}=${n}`).join(' ')}\n`
        + `  (hasGround ${hasGround})\n`
    );
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    const years = Number(process.env.YEARS ?? 150);
    for (const seed of (process.env.SEEDS ?? 'alpha').split(',')) {
        const state = seedWorld({ seed, catalog, presentYear: 1000, population: 250 }).state;
        report(state, `${seed} day 0`);
        const from = state.currentDay;
        applyPressure(state, from, from + years * YEAR, { maxEvents: 1_000_000 });
        report(state, `${seed} +${years}y`);
    }
}

void main();
