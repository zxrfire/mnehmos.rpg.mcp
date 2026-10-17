/** Warm the source-keyed cumulative native sample, never part of test/test:ci. */
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createServer } from 'vite';

os.setPriority(process.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
const args = process.argv.slice(2);
if (args.length !== 0 && !(args.length === 2 && args[0] === '--output'))
    throw new Error('Usage: node scripts/regenerate-driver-fixture.mjs [--output receipt.json]');
const root = process.cwd();
const server = await createServer({ root, configFile: false, appType: 'custom',
    cacheDir: path.join(root, '.claude/vite-driver-fixture'), optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null, hmr: false, ws: false } });
try {
    const { regenerateDriverAcceptanceSample } = await server.ssrLoadModule('/tests/support/driver-acceptance-sample.ts');
    const receipt = { at: new Date().toISOString(), ...await regenerateDriverAcceptanceSample() };
    if (args[1]) fs.writeFileSync(args[1], JSON.stringify(receipt, null, 2) + '\n');
    console.log(JSON.stringify(receipt));
} finally { await server.close(); }
