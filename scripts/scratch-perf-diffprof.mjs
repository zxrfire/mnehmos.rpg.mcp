/**
 * Scratch: compare two .cpuprofile runs at different horizons, in ms-per-
 * simulated-year, so a pass that grows with the ledger is told apart from one
 * that is flat.
 *
 *   node scripts/scratch-perf-diffprof.mjs a.cpuprofile 100 b.cpuprofile 1200
 */
import { readFileSync } from 'node:fs';

function selfByKey(file) {
    const prof = JSON.parse(readFileSync(file, 'utf8'));
    const byId = new Map();
    for (const n of prof.nodes) byId.set(n.id, n);
    const out = new Map();
    for (let i = 0; i < prof.samples.length; i++) {
        const dt = prof.timeDeltas[i] ?? 0;
        if (dt < 0) continue;
        const n = byId.get(prof.samples[i]);
        if (!n) continue;
        const f = n.callFrame;
        const url = (f.url || '').replace(/^.*[\\/]src[\\/]/, 'src/');
        if (!url.startsWith('src/')) continue;
        const k = `${f.functionName || '(anon)'} @ ${url.replace(/^src\/engine\//, '')}`;
        out.set(k, (out.get(k) ?? 0) + dt / 1000);
    }
    return out;
}

const [fa, ya, fb, yb] = process.argv.slice(2);
const a = selfByKey(fa), b = selfByKey(fb);
const keys = new Set([...a.keys(), ...b.keys()]);
const rows = [];
for (const k of keys) {
    const pa = (a.get(k) ?? 0) / Number(ya);
    const pb = (b.get(k) ?? 0) / Number(yb);
    rows.push({ k, pa, pb, growth: pa > 0.02 ? pb / pa : Infinity });
}
rows.sort((x, y) => y.pb - x.pb);
console.log(`ms/yr@${ya}  ms/yr@${yb}   x    function`);
let ta = 0, tb = 0;
for (const r of rows) { ta += r.pa; tb += r.pb; }
for (const r of rows.slice(0, 40)) {
    console.log(
        `${r.pa.toFixed(2).padStart(8)}  ${r.pb.toFixed(2).padStart(8)}  ` +
        `${(Number.isFinite(r.growth) ? r.growth.toFixed(1) : '  -').padStart(5)}  ${r.k}`
    );
}
console.log(`${ta.toFixed(2).padStart(8)}  ${tb.toFixed(2).padStart(8)}         TOTAL (src/ self time)`);
