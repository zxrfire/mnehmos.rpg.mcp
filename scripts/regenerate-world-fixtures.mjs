/** Warm the canonical aged-world fixtures sequentially, at reduced process priority. */
import os from 'node:os';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const value = (name, fallback) => {
    const at = args.indexOf(name);
    return at < 0 ? fallback : args[at + 1];
};
const seed = value('--seed', 'drift-guard');
const output = value('--output', null);
const report = [];
const years = value('--years', '10,100,500,1000,1200,1500').split(',').map(Number).sort((a, b) => a - b);
if (!seed || !years.length || years.some(year => !Number.isSafeInteger(year) || year < 0)) {
    throw new Error('Usage: --seed <seed> --years <comma-separated nonnegative integer years>');
}
os.setPriority(process.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
const server = await createServer({ root, configFile: false, appType: 'custom',
    cacheDir: fileURLToPath(new URL('../.claude/vite-speed-cache', import.meta.url)),
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, watch: null, hmr: false, ws: false } });
try {
    const { soakedWorld } = await server.ssrLoadModule('/tests/support/soaked-world.ts');
    for (const age of years) {
        const began = performance.now(), cpu = process.cpuUsage();
        const state = await soakedWorld(seed, { years: age });
        const used = process.cpuUsage(cpu);
        const row = { seed, age, day: state.currentDay, seconds: (performance.now() - began) / 1000,
            cpuSeconds: (used.user + used.system) / 1e6 };
        report.push(row);
        if (output) writeFileSync(output, JSON.stringify(report, null, 2));
        console.log(JSON.stringify(row));
    }
} finally { await server.close(); }
