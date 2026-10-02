/**
 * Manual full-catalog probe, enabled by CX_PROFILE=1. The default walks once
 * to year 400. CX_PROFILE_FILE reuses a saved checkpoint, warms code on a
 * disposable copy, and reports the loaded world's index build separately.
 */
import { it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { Session } from 'node:inspector';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';
import { soakedWorld } from '../../support/soaked-world.js';

it.skipIf(!process.env.CX_PROFILE)('profiles full catalog years', async () => {
    const catalog = await loadCultivationCatalog();
    const fresh = seedWorld({ seed: 'demography', catalog }).state;
    const openingDay = fresh.currentDay;
    const advance = (world: WorldState) => {
        const start = performance.now();
        advanceWorldForPlay(world, { days: 365, stopOnInterrupt: false });
        return performance.now() - start;
    };
    const early = Array.from({ length: 10 }, () => advance(fresh));
    console.log('early ms', early.map(x => Math.round(x)), 'mean', early.reduce((a,b)=>a+b)/10);
    const atTen = Array.from({ length: 10 }, () => advance(fresh));
    console.log('year 10 steady ms', atTen.map(x => Math.round(x)), 'mean', atTen.reduce((a,b)=>a+b)/10);
    if (!process.env.CX_PROFILE_KEPT && !process.env.CX_PROFILE_FILE) while (fresh.currentDay < openingDay + 400 * 365) advance(fresh);
    // A saved checkpoint starts with cold code and indexes. Warm a disposable
    // copy, then measure a newly loaded year-400 copy and its first index build.
    if (process.env.CX_PROFILE_FILE) {
        const warm: WorldState = JSON.parse(readFileSync(process.env.CX_PROFILE_FILE, 'utf8'));
        for (let year = 0; year < 40; year++) advance(warm);
    }
    const aged: WorldState = process.env.CX_PROFILE_FILE ? JSON.parse(readFileSync(process.env.CX_PROFILE_FILE, 'utf8'))
        : process.env.CX_PROFILE_KEPT ? await soakedWorld('demography', { years: 400 }) : fresh;
    console.log('aged cold ms', advance(aged));
    const steady = Array.from({ length: 10 }, () => advance(aged));
    console.log('aged steady ms', steady.map(x => Math.round(x)), 'mean', steady.reduce((a,b)=>a+b)/10);
    const session = new Session();
    session.connect();
    const post = (method: string) => new Promise<any>((resolve, reject) => session.post(method, (error, result) => error ? reject(error) : resolve(result)));
    await post('Profiler.enable');
    await post('Profiler.start');
    console.log('aged warm ms', Array.from({length: 3}, () => advance(aged)));
    const { profile } = await post('Profiler.stop');
    session.disconnect();
    writeFileSync('year-cost.cpuprofile', JSON.stringify(profile));
    const nodes = new Map(profile.nodes.map((n: any) => [n.id,n]));
    const sums = new Map<string, number>();
    for (let i = 0; i < profile.samples.length; i++) {
        const n: any = nodes.get(profile.samples[i]);
        const key = `${n.callFrame.functionName || '(anonymous)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber+1}`;
        sums.set(key, (sums.get(key) ?? 0) + profile.timeDeltas[i]/1000);
    }
    console.log('self ms / year', [...sums].sort((a,b)=>b[1]-a[1]).slice(0,35).map(([k,v])=>[k,Math.round(v/3)]));
}, 600_000);
