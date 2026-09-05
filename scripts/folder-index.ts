/**
 * Build the file table for a folder README from each file's own header.
 *
 *   npx tsx scripts/folder-index.ts src/server/consolidated
 *
 * The description is the first sentence of the file's opening doc block, so the
 * index cannot drift from the code: a file that renames itself or changes what
 * it is for updates the table the next time this is run.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('usage: folder-index.ts <dir>'); process.exit(1); }

function firstSentence(text: string): string {
    const block = text.match(/^\/\*\*([\s\S]*?)\*\//);
    if (!block) {
        const slash = text.match(/^\/\/ ?(.+)$/m);
        return slash ? slash[1].trim() : '';
    }
    const body = block[1].split('\n')
        .map(l => l.trim().replace(/^\*\s?/, ''))
        .filter(l => l !== '');
    if (body.length === 0) return '';
    const joined = body.join(' ');
    const stop = joined.search(/\.\s|\.$/);
    return (stop === -1 ? joined : joined.slice(0, stop + 1)).trim();
}

const rows = readdirSync(dir)
    .filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .sort()
    .map(f => ({ f, what: firstSentence(readFileSync(join(dir, f), 'utf-8')) }));

console.log('| file | what it is |');
console.log('|---|---|');
for (const r of rows) {
    console.log(`| [\`${r.f}\`](./${r.f}) | ${r.what || '-'} |`);
}
