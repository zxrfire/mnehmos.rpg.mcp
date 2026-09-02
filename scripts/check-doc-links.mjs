/**
 * Every relative link between docs resolves to a file that exists.
 *
 * `docs/world/` is heavily cross-referenced - hundreds of links, and a doc that
 * points at a moved neighbour is worse than one that points nowhere, because it
 * looks like it worked. This is the check that makes reorganising the folder a
 * mechanical operation rather than a leap.
 *
 * Run: node scripts/check-doc-links.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs');

function markdownFiles(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...markdownFiles(full));
        else if (entry.name.endsWith('.md')) out.push(full);
    }
    return out;
}

/** Links to a local file. Skips anchors, urls and mailto. */
const LINK = /\]\(([^)\s#][^)\s]*?)(?:#[^)]*)?\)/g;

export function brokenLinks() {
    const broken = [];
    let checked = 0;
    for (const file of markdownFiles(DOCS)) {
        const text = fs.readFileSync(file, 'utf8');
        for (const m of text.matchAll(LINK)) {
            const target = m[1];
            if (/^(https?:|mailto:|#)/.test(target)) continue;
            checked++;
            const resolved = path.resolve(path.dirname(file), target);
            if (!fs.existsSync(resolved)) {
                broken.push({
                    from: path.relative(ROOT, file).split(path.sep).join('/'),
                    to: target
                });
            }
        }
    }
    return { broken, checked };
}

const isMain = process.argv[1]
    && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
    const { broken, checked } = brokenLinks();
    console.log(`${checked} relative links checked, ${broken.length} broken.`);
    for (const b of broken.slice(0, 40)) console.log(`  ${b.from}  ->  ${b.to}`);
    if (broken.length > 40) console.log(`  ...and ${broken.length - 40} more`);
    process.exit(broken.length ? 1 : 0);
}
