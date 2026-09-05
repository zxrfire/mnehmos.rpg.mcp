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
const SRC = path.join(ROOT, 'src');

function markdownFiles(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        // `docs/bastion/` is pre-fork D&D material whose links point at modules the
        // fork deleted and at another project on disk. It is history, it is labelled
        // as history in its own README, and checking it only ever reports the same 17.
        if (entry.isDirectory()) {
            if (entry.name !== 'bastion') out.push(...markdownFiles(full));
        }
        else if (entry.name.endsWith('.md')) out.push(full);
    }
    return out;
}

/** Links to a local file. Skips anchors, urls and mailto. */
const LINK = /\]\(([^)\s#][^)\s]*?)(?:#[^)]*)?\)/g;

export function brokenLinks() {
    const broken = [];
    let checked = 0;
    // `src/` READMEs are part of the same web of links - a folder README that
    // points at a moved neighbour is the failure this check exists for, and it
    // does not stop being one because the file lives beside code.
    for (const file of [...markdownFiles(DOCS), ...markdownFiles(SRC)]) {
        const text = fs.readFileSync(file, 'utf8');
        for (const m of text.matchAll(LINK)) {
            const target = m[1];
            if (/^(https?:|mailto:|#)/.test(target)) continue;
            checked++;
            // `file.ts:75` is a line-anchored link, which this repo uses widely and
            // which an editor resolves. Check the FILE exists; the line number is not
            // ours to verify and goes stale on every edit above it.
            const withoutLine = target.replace(/:\d+(?::\d+)?$/, '');
            const resolved = path.resolve(path.dirname(file), withoutLine);
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
