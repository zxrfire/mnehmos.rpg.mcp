/**
 * What does the rules layer already score, with no model of any kind?
 *
 *   npx tsx scripts/benchmark-the-local-intent-layer.ts            the corpus as written
 *   npx tsx scripts/benchmark-the-local-intent-layer.ts --typos    the corpus with one typo per sentence
 */

import { parseIntent } from '../src/web/actions.js';
import { CORPUS, type Command } from './a-corpus-of-things-players-actually-type.js';

const withTypos = process.argv.includes('--typos');

function oneTypo(sentence: string, salt: number): string {
    const words = sentence.split(/\s+/);
    const candidates = words
        .map((w, i) => [i, w.replace(/[^A-Za-z-]/g, '')] as const)
        .filter(([, w]) => w.length >= 5);
    if (candidates.length === 0) return sentence;
    const [index, word] = candidates[salt % candidates.length];
    const mid = Math.floor(word.length / 2);
    const kind = salt % 4;
    const wrong =
        kind === 0 ? word.slice(0, -1)
            : kind === 1 ? word.slice(0, mid) + word.slice(mid + 1)
                : kind === 2 ? word.slice(0, mid - 1) + word[mid] + word[mid - 1] + word.slice(mid + 1)
                    : word.slice(0, mid) + word[mid] + word.slice(mid);
    return words.map((w, i) => (i === index ? w.replace(word, wrong) : w)).join(' ');
}

interface Outcome { cmd: Command; said: string; got: string; hit: boolean }

const outcomes: Outcome[] = CORPUS.map((cmd, i) => {
    const said = withTypos ? oneTypo(cmd.said, i) : cmd.said;
    const got = parseIntent(said).action;
    return { cmd, said, got, hit: got === cmd.want };
});

const score = (rows: Outcome[]) => {
    const hit = rows.filter(r => r.hit).length;
    const unclear = rows.filter(r => !r.hit && r.got === 'unclear').length;
    const wrong = rows.filter(r => !r.hit && r.got !== 'unclear').length;
    return { n: rows.length, hit, unclear, wrong, pct: rows.length ? (100 * hit) / rows.length : 0 };
};

const all = score(outcomes);
const plain = score(outcomes.filter(o => o.cmd.tier === 'plain'));
const oblique = score(outcomes.filter(o => o.cmd.tier === 'oblique'));

console.log(withTypos ? 'CORPUS WITH ONE TYPO PER SENTENCE' : 'CORPUS AS WRITTEN');
console.log(`  ${'tier'.padEnd(10)} ${'n'.padStart(5)} ${'correct'.padStart(9)} ${'refused'.padStart(9)} ${'wrong verb'.padStart(11)}`);
for (const [label, s] of [['ALL', all], ['plain', plain], ['oblique', oblique]] as const) {
    console.log(`  ${label.padEnd(10)} ${String(s.n).padStart(5)} ${(s.pct.toFixed(1) + '%').padStart(9)} ${String(s.unclear).padStart(9)} ${String(s.wrong).padStart(11)}`);
}

// Per-verb, worst first: where the gaps actually are.
const byVerb = new Map<string, Outcome[]>();
for (const o of outcomes) {
    const list = byVerb.get(o.cmd.want) ?? [];
    list.push(o);
    byVerb.set(o.cmd.want, list);
}
const ranked = [...byVerb.entries()]
    .map(([verb, rows]) => ({ verb, ...score(rows) }))
    .sort((a, b) => a.pct - b.pct);

console.log('\n  Weakest verbs:');
for (const r of ranked.filter(r => r.pct < 100).slice(0, 14)) {
    console.log(`    ${r.verb.padEnd(17)} ${(r.pct.toFixed(0) + '%').padStart(5)}  (${r.hit}/${r.n})  refused ${r.unclear}, wrong ${r.wrong}`);
}

if (!withTypos) {
    console.log('\n  Misses, with what they reached instead:');
    for (const o of outcomes.filter(o => !o.hit)) {
        console.log(`    ${o.cmd.want.padEnd(17)} -> ${o.got.padEnd(15)} [${o.cmd.tier}] "${o.said}"`);
    }
}
