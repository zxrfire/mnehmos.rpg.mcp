/**
 * Does the standing register say the same thing over and over?
 *
 * The register is the world's own record, and the design owner has asked twice
 * for it to be readable: chunks inside a size limit, and no section longer than
 * a short paragraph. Size is measured elsewhere. This measures the other half,
 * which turned out to be the bigger problem in practice - not sections that are
 * too long, but one paragraph rendered a hundred times.
 *
 * Two kinds of repetition, and only one of them is a defect.
 *
 * A GLOSS that repeats is fine. Six warmth words carry six explanations, and a
 * word used fifty times brings its gloss fifty times; the reader is reading one
 * row, not the concordance, and the alternative is a legend they have to hold
 * in their head.
 *
 * A paragraph that EXPLAINS THE ENGINE is not fine at any count, and is worse
 * at fifty. Measured when this was written: 116 renderings across four
 * paragraphs describing how relationships are stored - which end holds the
 * warmth, what is shared and what is duplicated, why an authored tie exists -
 * plus 27 more explaining the authoring convention for a history entry. All of
 * them true, all of them worth saying once in a header or a code comment, none
 * of them a fact about the world.
 *
 * So this reports the repeats and leaves the judgement to a reader, rather than
 * failing on a number. What it is for is noticing that a paragraph has become
 * furniture.
 *
 *   npx tsx scripts/probe-does-the-register-repeat-itself.ts [path/to.html]
 */

import { readFileSync } from 'node:fs';

const SUBSTANTIAL = 70;
const path = process.argv[2] ?? 'build/standing-register.html';

/** Words that mean the sentence is about the software rather than the world. */
const ABOUT_THE_MACHINE =
    /\bstored\b|\bstores\b|\btable\b|\bcatalog\b|\brow\b|\bfield\b|\bschema\b|\bauthored\b|\bshared\b/i;

let html: string;
try {
    html = readFileSync(path, 'utf8');
} catch {
    console.error(`No register at ${path}. Build one first:  npm run register`);
    process.exit(1);
}

// The stylesheet is full of long commented lines and none of them are prose the
// reader ever sees.
const body = html.split('</style>').pop() ?? html;
const lines = body
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > SUBSTANTIAL);

const counts = new Map<string, number>();
for (const line of lines) counts.set(line, (counts.get(line) ?? 0) + 1);

const repeated = [...counts.entries()]
    .filter(([, n]) => n > 3)
    .sort((a, b) => b[1] - a[1]);

const line = (s = '') => console.log(s);
line();
line(`  ${lines.length} substantial lines in ${path}`);
line(`  ${repeated.length} of them repeat more than three times`);
line();

if (repeated.length === 0) {
    line('  Nothing repeats. Either the sheet is clean or it is empty.');
    process.exit(0);
}

let machine = 0;
line('  count  kind      line');
line('  ' + '-'.repeat(104));
for (const [text, n] of repeated.slice(0, 30)) {
    const isMachine = ABOUT_THE_MACHINE.test(text);
    if (isMachine) machine += n;
    line(`  ${String(n).padStart(5)}  ${(isMachine ? 'MACHINE ' : 'gloss   ')}  ${text.slice(0, 92)}`);
}

line();
line(`  ${machine} renderings of lines that talk about storage, tables, rows or authoring.`);
line();
line('  A gloss repeating is the design working - the reader meets one row at a time.');
line('  A paragraph about how the engine keeps its data is furniture, and it belongs');
line('  once in a header or in the code, never on a row.');
line();
