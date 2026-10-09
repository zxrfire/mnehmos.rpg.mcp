/** Manual travel cost control: one full-catalog year, then twelve one-year
 * advances from the same opening. Before/after retain every annual state hash,
 * so a cheaper departure read cannot silently change a journey or RNG result.
 * Enable with TRAVEL_COST_MODE=before or after; changed measures an intentional
 * behaviour change from the current seeded opening while retaining the hashes.
 * The saved opening remains the control for read-only optimizations; a changed
 * seeding rule must also be measured from the world it actually opens.
 * Ordinary suites skip the probe. */
import { it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { Session } from 'node:inspector';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { advanceWorldYears } from '../../support/advance-world-years.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

it.skipIf(!process.env.TRAVEL_COST_MODE)('measures actual travel years and retains every annual world', async () => {
    const before = process.env.TRAVEL_COST_MODE === 'before';
    const changed = process.env.TRAVEL_COST_MODE === 'changed';
    const reference=process.env.TRAVEL_COST_REFERENCE;
    const controlPath=process.env.TRAVEL_COST_CONTROL_DRIVER;
    const controlDriver=controlPath?await import(controlPath) as typeof import('../../../src/engine/world/driver.js'):null;
    const opening = '.claude/travel-cost-opening.json';
    const baseline = '.claude/travel-cost-before.json';
    // Both arms prepare a seeded catalog before timing; the saved opening pins identity.
    const state: WorldState = process.env.TRAVEL_COST_STARTING_WORLD
        ? JSON.parse(readFileSync(process.env.TRAVEL_COST_STARTING_WORLD, 'utf8'))
        : seedWorld({ seed: 'year-cost-probe', catalog: await loadCultivationCatalog() }).state;
    if (before) writeFileSync(opening, JSON.stringify(state));
    const profiler=process.env.TRAVEL_COST_PROFILE?new Session():null;
    const lastOnly=process.env.TRAVEL_COST_PROFILE==='last';
    const horizons=(process.env.TRAVEL_COST_HORIZONS??'1,12').split(',').map(Number);
    if(profiler){profiler.connect();profiler.post('Profiler.enable');}
    const run = (years: number, advance=advanceWorldYears, current=true) => {
        const world: WorldState = changed || reference ? structuredClone(state) : JSON.parse(readFileSync(opening, 'utf8'));
        const hashes: string[] = [], times: number[] = [];
        for (let year = 0; year < years; year++) {
            if(profiler&&current&&lastOnly&&years===Math.max(...horizons)&&year===years-1)profiler.post('Profiler.start');
            const start = performance.now();
            advance(world, 1, { stopOnInterrupt: false });
            times.push(performance.now() - start);
            hashes.push(createHash('sha256').update(JSON.stringify(world)).digest('hex'));
            console.log(current?'travel year':'control travel year', years, year + 1, times.at(-1)!.toFixed(1), 'ms');
        }
        return { years, times, hashes, totalMs: times.reduce((sum, ms) => sum + ms, 0) };
    };
    // The optional retained source arm shares this command and starting world.
    const paired=controlDriver?horizons.map(years=>run(years,(world,span,opts)=>
        controlDriver.advanceWorldForPlay(world,{...opts,days:Math.round(span*365)}),false)):null;
    if(profiler&&!lastOnly)profiler.post('Profiler.start');
    const rows = horizons.map(years=>run(years));
    if(paired){
        writeFileSync('.claude/travel-cost-control.json',JSON.stringify(paired,null,2));
        expect(rows.map(row=>row.hashes)).toEqual(paired.map(row=>row.hashes));
    }
    if(profiler){
        await new Promise<void>((resolve,reject)=>profiler.post('Profiler.stop',(error,result)=>{
            if(error){reject(error);return;}
            writeFileSync('.claude/travel-cost-current.cpuprofile',JSON.stringify(result.profile));resolve();
        }));
        profiler.disconnect();
    }
    writeFileSync(before ? baseline : '.claude/travel-cost-after.json', JSON.stringify(rows, null, 2));
    if (!before) {
        const controls = JSON.parse(readFileSync(reference??baseline, 'utf8')) as typeof rows;
        for (const row of rows) {
            const previous = (controls.find(control=>control.years===row.years)
                ?? (changed ? controls.find(control=>control.years>=row.years) ?? controls.at(-1) : undefined))!.hashes.slice(0, row.years);
            if (changed) expect(row.hashes.slice(0, previous.length)).not.toEqual(previous);
            else expect(row.hashes).toEqual(previous);
        }
    }
}, 900_000);
