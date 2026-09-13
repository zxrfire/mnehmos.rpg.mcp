/** Scratch: summarise a .cpuprofile into self-time and total-time by function. */
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const topN = Number(process.argv[3] ?? 30);
const prof = JSON.parse(readFileSync(file, 'utf8'));

const byId = new Map();
for (const n of prof.nodes) byId.set(n.id, n);

// self time from samples/timeDeltas
const self = new Map();
let total = 0;
for (let i = 0; i < prof.samples.length; i++) {
    const dt = prof.timeDeltas[i] ?? 0;
    if (dt < 0) continue;
    total += dt;
    const id = prof.samples[i];
    self.set(id, (self.get(id) ?? 0) + dt);
}

const parent = new Map();
for (const n of prof.nodes) for (const c of n.children ?? []) parent.set(c, n.id);

function key(n) {
    const f = n.callFrame;
    const url = (f.url || '').replace(/^.*[\\/]src[\\/]/, 'src/').replace(/^file:\/\/\//, '');
    return `${f.functionName || '(anon)'} @ ${url}:${f.lineNumber + 1}`;
}

// aggregate self time by function key
const selfByKey = new Map();
for (const [id, t] of self) {
    const n = byId.get(id);
    if (!n) continue;
    const k = key(n);
    selfByKey.set(k, (selfByKey.get(k) ?? 0) + t);
}

// total (inclusive) time by function key: walk up ancestors, dedupe per sample
const totalByKey = new Map();
for (const [id, t] of self) {
    const seen = new Set();
    let cur = id;
    while (cur != null) {
        const n = byId.get(cur);
        if (!n) break;
        const k = key(n);
        if (!seen.has(k)) {
            seen.add(k);
            totalByKey.set(k, (totalByKey.get(k) ?? 0) + t);
        }
        cur = parent.get(cur);
    }
}

const pct = t => ((t / total) * 100).toFixed(2).padStart(6);
const ms = t => (t / 1000).toFixed(0).padStart(7);

console.log(`total sampled: ${(total / 1e6).toFixed(2)}s\n`);
console.log('=== SELF TIME ===');
for (const [k, t] of [...selfByKey].sort((a, b) => b[1] - a[1]).slice(0, topN)) {
    console.log(`${pct(t)}%  ${ms(t)}ms  ${k}`);
}
console.log('\n=== TOTAL (inclusive) TIME ===');
for (const [k, t] of [...totalByKey].sort((a, b) => b[1] - a[1]).slice(0, topN * 2)) {
    if (t / total < 0.01) break;
    console.log(`${pct(t)}%  ${ms(t)}ms  ${k}`);
}
