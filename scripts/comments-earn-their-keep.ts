/**
 * Comment-to-code ratio per file, worst first.
 *
 *   npx tsx scripts/comments-earn-their-keep.ts [--over 2.0] [--dir src]
 *
 * AGENTS.md sets the bar; this is how you tell whether a file clears it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv.includes('--dir')
    ? process.argv[process.argv.indexOf('--dir') + 1] : 'src';
const over = process.argv.includes('--over')
    ? Number(process.argv[process.argv.indexOf('--over') + 1]) : 0;

const files: string[] = [];
(function walk(d: string) {
    for (const e of readdirSync(d)) {
        const p = join(d, e);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.ts') && !p.endsWith('.d.ts')) files.push(p);
    }
})(dir);

export function countLines(text: string): { comment: number; code: number } {
    let comment = 0, code = 0, inBlock = false;
    for (const raw of text.split('\n')) {
        const t = raw.trim();
        if (inBlock) { comment++; if (t.includes('*/')) inBlock = false; continue; }
        if (t.startsWith('/*')) { comment++; if (!t.includes('*/')) inBlock = true; continue; }
        if (t.startsWith('//')) { comment++; continue; }
        if (t.length > 0) code++;
    }
    return { comment, code };
}

const rows = files.map(f => {
    const { comment, code } = countLines(readFileSync(f, 'utf-8'));
    return { f, comment, code, ratio: code === 0 ? 99 : comment / code };
}).filter(r => r.code > 20 && r.ratio >= over).sort((a, b) => b.comment - a.comment);

const all = files.map(f => countLines(readFileSync(f, 'utf-8')));
const c = all.reduce((a, r) => a + r.comment, 0);
const k = all.reduce((a, r) => a + r.code, 0);

console.log(`${dir}: ${c} comment lines / ${k} code = ${(c / k).toFixed(2)}`);
console.log(`${rows.length} files at or over ${over}, by comment volume:\n`);
for (const r of rows.slice(0, 30)) {
    console.log(`  ${r.ratio.toFixed(2).padStart(5)}  ${String(r.comment).padStart(5)} cmt / ${String(r.code).padStart(4)} code  ${r.f}`);
}
console.log(`\ntotal comment lines in the listed files: ${rows.reduce((a, r) => a + r.comment, 0)}`);
