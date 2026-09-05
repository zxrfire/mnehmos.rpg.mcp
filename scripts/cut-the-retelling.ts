/**
 * Compress doc blocks to their opening paragraph, in one file.
 *
 *   npx tsx scripts/cut-the-retelling.ts <file> [--min 6] [--dry]
 *
 * A first pass, never the whole job. It keeps the summary and drops what
 * follows, which is right for a file whose blocks are summary-then-archaeology
 * and wrong wherever a later paragraph carries a measurement or a warning.
 * ALWAYS read the diff afterwards for the keep categories in
 * `docs/comment-cleanup-rules.md` and restore what mattered.
 */
import { readFileSync, writeFileSync } from 'node:fs';

/** Windows holds a file open while another process reads it; retry rather than fail. */
function writeWhenFree(path: string, text: string): boolean {
    for (let attempt = 0; attempt < 40; attempt++) {
        try { writeFileSync(path, text, 'utf-8'); return true; } catch { /* held */ }
        const until = Date.now() + 2000;
        while (Date.now() < until) { /* spin briefly */ }
    }
    return false;
}

const file = process.argv[2];
const dry = process.argv.includes('--dry');
const min = process.argv.includes('--min')
    ? Number(process.argv[process.argv.indexOf('--min') + 1]) : 6;
if (!file) { console.error('usage: cut-the-retelling.ts <file> [--min 6] [--dry]'); process.exit(1); }

const src = readFileSync(file, 'utf-8').split('\n');
const out: string[] = [];
let whole = 0, removed = 0, i = 0;

while (i < src.length) {
    const line = src[i];
    // A RUN OF `//` LINES IS THE SAME SHAPE AND HOLDS MORE OF THE MASS.
    // Measured in `verb-pattern-table.ts` after the doc blocks were cut: 2,002
    // slash-comment lines against 424 in doc blocks, with runs up to 57 long.
    // Same rule - keep the opening paragraph, drop the retelling after it.
    if (line.trim().startsWith('//') && !line.trim().startsWith('///')) {
        let j = i;
        while (j < src.length && src[j].trim().startsWith('//')) j++;
        const run = src.slice(i, j);
        const indent = line.slice(0, line.length - line.trimStart().length);
        if (run.length > min) {
            const body = run.map(b => b.trim().replace(/^\/\/\s?/, ''));
            const para: string[] = [];
            for (const t of body) {
                const bare = t.replace(/[─-╿\s]/g, '');
                if (bare === '' && para.length > 0) break;
                if (bare !== '') para.push(t.replace(/[─-╿]+/g, '').trim());
            }
            if (para.length > 0) {
                const words = para.join(' ').split(/\s+/).filter(w => w !== '');
                const lines: string[] = [];
                let cur = '';
                for (const w of words) {
                    if (cur === '') cur = `${indent}// ${w}`;
                    else if (cur.length + 1 + w.length > 84) { lines.push(cur); cur = `${indent}// ${w}`; }
                    else cur += ` ${w}`;
                }
                if (cur) lines.push(cur);
                out.push(...lines);
                removed += run.length - lines.length;
                i = j;
                continue;
            }
        }
        out.push(...run);
        whole++;
        i = j;
        continue;
    }

    if (!line.trim().startsWith('/**')) { out.push(line); i++; continue; }

    let j = i;
    while (j < src.length && !src[j].includes('*/')) j++;
    const block = src.slice(i, j + 1);
    const indent = line.slice(0, line.length - line.trimStart().length);

    const body = block.slice(1, -1).map(b => {
        const t = b.trim();
        return t.startsWith('*') ? t.slice(1).trim() : t;
    });

    const para: string[] = [];
    for (const t of body) {
        if (t === '' && para.length > 0) break;
        if (t !== '') para.push(t);
    }

    if (block.length > min && para.length > 0) {
        const words = para.join(' ').split(/\s+/);
        const lines: string[] = [];
        let cur = '';
        for (const w of words) {
            if (cur === '') cur = `${indent} * ${w}`;
            else if (cur.length + 1 + w.length > 84) { lines.push(cur); cur = `${indent} * ${w}`; }
            else cur += ` ${w}`;
        }
        if (cur) lines.push(cur);
        out.push(`${indent}/**`, ...lines, `${indent} */`);
        removed += block.length - (lines.length + 2);
    } else {
        out.push(...block);
        whole++;
    }
    i = j + 1;
}

if (!dry) writeFileSync(file, out.join('\n'), 'utf-8');
console.log(`${file}: removed ${removed} comment lines, left ${whole} short blocks whole${dry ? ' (dry run)' : ''}`);
