/**
 * Lift a family of `GameService` methods into its own prototype-merged module.
 *
 * `src/web/game.ts` was 24,746 lines with a dozen reasons to change and one
 * file to change them in, and six finished changes from six agents were queued
 * on it because only one person can hold it at a time. This is the tool that
 * takes a family out.
 *
 *   node scripts/split-a-verb-family-out-of-the-turn.mjs family.json
 *
 * See `--example` for the config shape. Spans are worked out from METHOD NAMES
 * rather than typed as line numbers, because line numbers in this file are
 * stale by the time you have finished reading them.
 *
 * ── A MOVE, NOT A REWRITE, AND THAT IS THE WHOLE POINT ───────────────────
 *
 * The methods keep `this`. They become an object literal merged onto
 * `GameService.prototype`, with their signatures merged into the class
 * declaration by an interface, so `this.move(...)` resolves and typechecks
 * exactly as before and every moved line is the line it was. The alternative -
 * passing the service in as `self` - rewrites about twelve hundred expressions
 * per family and turns a move into a rewrite nobody can review.
 *
 * The price is that members the family reaches lose `private`. That is a
 * compile-time annotation which is erased entirely: no runtime behaviour
 * changes, and nothing becomes reachable that `(service as any)` could not
 * already reach. Widen only what a family actually reaches - the cost falls
 * with every family, because the shared context comes out of hiding once.
 * Measured over the first three: 13 widenings, then 9, then 4.
 *
 * `src/web/README.md` carries the argument and the warning not to put the
 * keyword back.
 *
 * ── EXACTLY FOUR EDITS ARE EVER MADE ─────────────────────────────────────
 *
 *   1. `private` off a method signature
 *   2. `this: GameService` added as the first parameter
 *   3. a comma after each closing brace but the last
 *   4. a `static` member de-indented into a module-level declaration, because
 *      a static has no instance and module scope is what `static` already
 *      meant; its `GameService.X` call sites lose the prefix
 *
 * `prove-a-move-changed-nothing.mjs` erases precisely those four and requires
 * what left to equal what arrived. Run it before you commit; it is the only
 * evidence here that does not depend on a moving tree.
 *
 * ── AND RUN THE VERB SURFACE GENERATOR IN THE SAME COMMIT ────────────────
 *
 * `build-the-verb-surface.mjs` scrapes handler definitions out of source by
 * path. A family leaving `game.ts` without being added to its `HANDLERS` list
 * makes `docs/verbs.md` report every verb in it as resolving nowhere - four
 * live verbs called broken in a player-facing document, silently. Both splits
 * running on this repo hit that, and neither was caught by a test until
 * somebody regenerated deliberately.
 *
 * ── THE TRAP THAT COST AN HOUR ───────────────────────────────────────────
 *
 * `...spread(x)` reads as member access to a naive regex, because the third
 * dot of the spread looks like a property dot. A scanner that strips `.name`
 * to find free identifiers MUST use a negative lookbehind for a second dot, or
 * it silently drops imports and you get `Cannot find name` for a symbol that
 * is plainly used two lines up.
 */
import fs from 'fs';

const CR = String.fromCharCode(13);
const EXAMPLE = {
    file: 'src/web/game.ts',
    out: 'src/web/travel-verbs.ts',
    object: 'travelVerbs',
    header: '/**\n * What this module is, and why it is one module.\n */\n',
    from: 'move',
    to: 'passage',
    methods: ['move', 'ride', 'fold', 'passage'],
    hoist: [],
    elsewhere: [],
    widen: ['db', 'repos']
};

// ─── reading and writing, preserving the file's own line endings ──────────

function read(path) {
    const text = fs.readFileSync(path).toString('utf8');
    return { lines: text.split(CR + '\n').join('\n').split('\n'), crlf: text.includes(CR + '\n') };
}

function write(path, lines, crlf) {
    const text = lines.join('\n');
    fs.writeFileSync(path, crlf ? text.split('\n').join(CR + '\n') : text, 'utf8');
}

// ─── finding a member, with the doc comment that belongs to it ────────────

/**
 * The line a name is declared on, whether it is a class member or module scope.
 *
 * Both forms are needed. A family reaches its own methods, and it also reaches
 * plain declarations sitting above the class - a regex table, a key builder, a
 * weighting function. `elsewhere` moves those, so this cannot assume the
 * four-space indent of a member.
 */
function memberLine(lines, name) {
    const member = new RegExp(`^    (?:private |public |protected )?(?:static )?(?:async )?(?:readonly )?${name}\\s*(?:<[^>]*>)?[(:=]`);
    const top = new RegExp(`^(?:export )?(?:const|let|function|async function|interface|type|class)\\s+${name}\\b`);
    for (const re of [member, top]) {
        const hits = lines.map((l, i) => (re.test(l) ? i : -1)).filter(i => i >= 0);
        if (hits.length === 1) return hits[0];
        if (hits.length > 1) throw new Error(`${name}: ${hits.length} declarations, expected one`);
    }
    throw new Error(`${name}: no declaration found`);
}

/** Walk back over an attached doc comment and any `//` lines above it. */
function docStart(lines, i) {
    let j = i;
    while (j > 0) {
        const prev = lines[j - 1].trim();
        if (prev.endsWith('*/')) {
            let k = j - 1;
            while (k > 0 && !lines[k].trim().startsWith('/*')) k -= 1;
            j = k;
            continue;
        }
        if (prev.startsWith('//')) { j -= 1; continue; }
        break;
    }
    return j;
}

/** A class member ends at the first closing brace back at member indent. */
function memberEnd(lines, i) {
    let j = i;
    while (j < lines.length && lines[j] !== '    }') j += 1;
    if (j >= lines.length) throw new Error(`no close found for line ${i + 1}`);
    return j;
}

/**
 * A module-scope declaration ends where its brackets balance.
 *
 * Indent matching is WRONG here and the way it is wrong is quiet: a top-level
 * `function askWeightOf` has `}` at column zero, but the `if` blocks inside it
 * close at four spaces, so member-style matching truncated the function at its
 * first branch and moved a third of it. It compiled - the remainder was still
 * syntactically a file - and the loss showed up only as `Cannot find name`
 * somewhere else entirely.
 */
function balancedEnd(lines, i) {
    let depth = 0;
    let opened = false;
    for (let j = i; j < lines.length; j += 1) {
        for (const c of lines[j].replace(/\/\/.*$/, '')) {
            if ('{[('.includes(c)) { depth += 1; opened = true; }
            else if ('}])'.includes(c)) depth -= 1;
        }
        if (opened && depth <= 0) return j;
        if (!opened && lines[j].trimEnd().endsWith(';')) return j;
    }
    throw new Error(`unterminated declaration at line ${i + 1}`);
}

function spanOf(lines, name, kind) {
    const i = memberLine(lines, name);
    const isMember = lines[i].startsWith('    ');
    const end = isMember
        ? (kind === 'const' ? balancedEnd(lines, i) : memberEnd(lines, i))
        : balancedEnd(lines, i);
    return [docStart(lines, i), end, isMember];
}

// ─── the transformation ──────────────────────────────────────────────────

/**
 * `private` is OPTIONAL here, and that is not defensive coding.
 *
 * A member an earlier family reached has already had the keyword taken off, so
 * by the fourth or fifth move a good number of the methods being carried are
 * plain `async foo(`. Requiring `private` threw "0 signatures" on a method
 * sitting in plain sight.
 */
function toObjectMethod(out, name) {
    const re = new RegExp(`^    (?:private )?(?:static )?(?:async )?${name}\\(`);
    const hits = out.map((l, i) => (re.test(l) ? i : -1)).filter(i => i >= 0);
    if (hits.length !== 1) throw new Error(`${name}: ${hits.length} signatures in the moved block`);
    const i = hits[0];
    const line = out[i].replace(/^    (?:private )?(?:static )?/, '    ');
    if (line.trimEnd().endsWith('(')) {
        out[i] = line;
        out.splice(i + 1, 0, '        this: GameService,');
        return;
    }
    const j = line.indexOf('(') + 1;
    out[i] = line.slice(0, j)
        + (line[j] === ')' ? 'this: GameService' : 'this: GameService, ')
        + line.slice(j);
}

/** Comments and string bodies removed, template interpolations kept. */
function stripCode(s) {
    const out = [];
    for (let i = 0; i < s.length;) {
        const c = s[i];
        if (c === '/' && s[i + 1] === '/') { const j = s.indexOf('\n', i); i = j < 0 ? s.length : j; }
        else if (c === '/' && s[i + 1] === '*') { const j = s.indexOf('*/', i + 2); i = j < 0 ? s.length : j + 2; }
        else if (c === '"' || c === "'") {
            const q = c; i += 1;
            while (i < s.length && s[i] !== q) { if (s[i] === '\\') i += 1; i += 1; }
            i += 1;
        } else if (c === '`') {
            i += 1;
            while (i < s.length) {
                if (s[i] === '\\') { i += 2; continue; }
                if (s[i] === '$' && s[i + 1] === '{') {
                    let j = i + 2, d = 1;
                    while (j < s.length && d > 0) { if (s[j] === '{') d += 1; else if (s[j] === '}') d -= 1; j += 1; }
                    out.push(' ' + s.slice(i + 2, j - 1) + ' ');
                    i = j; continue;
                }
                if (s[i] === '`') { i += 1; break; }
                i += 1;
            }
        } else { out.push(c); i += 1; }
    }
    return out.join('');
}

function freeIdentifiers(text) {
    const code = stripCode(text);
    const used = new Set(code.match(/\b[A-Za-z_][A-Za-z0-9_$]*\b/g) ?? []);
    // A dot NOT preceded by another dot is member access; `...x` is a spread.
    for (const m of code.matchAll(/(?<!\.)\.\s*([A-Za-z_][A-Za-z0-9_]*)/g)) used.delete(m[1]);
    return used;
}

// ─── rebuilding an import block off the source file's own imports ─────────

function importIndex(lines, upto) {
    const text = lines.slice(0, upto)
        .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    const out = new Map();
    const re = /import\s+(type\s+)?(\{[^}]*\}|[A-Za-z_][A-Za-z0-9_]*)\s+from\s+'([^']+)';/g;
    for (const m of text.matchAll(re)) {
        const blanket = Boolean(m[1]);
        if (!m[2].startsWith('{')) { out.set(m[2], [m[3], blanket]); continue; }
        for (const part of m[2].replace(/[{}]/g, '').split(',')) {
            const p = part.trim();
            if (!p) continue;
            const inline = p.startsWith('type ');
            const name = (inline ? p.slice(5) : p).split(' as ').pop().trim();
            if (name) out.set(name, [m[3], blanket || inline]);
        }
    }
    return out;
}

function importBlock(names, index) {
    const by = new Map();
    for (const n of [...names].sort()) {
        const hit = index.get(n);
        if (!hit) throw new Error(`no import found for ${n}`);
        if (!by.has(hit[0])) by.set(hit[0], []);
        by.get(hit[0]).push([n, hit[1]]);
    }
    const mods = [...by.keys()].sort((a, b) =>
        (a.startsWith('..') === b.startsWith('..') ? (a < b ? -1 : 1) : a.startsWith('..') ? -1 : 1));
    const out = [];
    for (const mod of mods) {
        const items = by.get(mod).sort();
        const allType = items.every(([, t]) => t);
        const body = items.map(([n, t]) => (allType ? n : t ? `type ${n}` : n));
        const one = `${allType ? 'import type {' : 'import {'} ${body.join(', ')} } from '${mod}';`;
        if (one.length <= 96) { out.push(one); continue; }
        out.push(allType ? 'import type {' : 'import {');
        body.forEach((n, i) => out.push(`    ${n}${i === body.length - 1 ? '' : ','}`));
        out.push(`} from '${mod}';`);
    }
    return out.join('\n');
}

// ─── the move ────────────────────────────────────────────────────────────

function build(cfg) {
    const { lines, crlf } = read(cfg.file);
    const [a] = spanOf(lines, cfg.from, 'method');
    const [, b] = spanOf(lines, cfg.to, 'method');

    const hoists = (cfg.hoist ?? []).map(h => ({ ...h, span: spanOf(lines, h.name, h.kind) }));
    const elsewhere = (cfg.elsewhere ?? []).map(h => ({ ...h, span: spanOf(lines, h.name, h.kind) }));

    // the object body is the contiguous region minus anything hoisted out of it
    const dropped = new Set();
    for (const { span } of hoists) {
        let end = span[1];
        if (lines[end + 1] !== undefined && lines[end + 1].trim() === '') end += 1;
        for (let n = span[0]; n <= end; n += 1) dropped.add(n);
    }
    const keep = [];
    for (let n = a; n <= b; n += 1) if (!dropped.has(n)) keep.push(lines[n]);

    for (const name of cfg.methods) toObjectMethod(keep, name);
    const closes = keep.map((l, i) => (l === '    }' ? i : -1)).filter(i => i >= 0);
    for (const i of closes.slice(0, -1)) keep[i] = '    },';

    const declarations = [...hoists, ...elsewhere].map(({ kind, span }) => {
        const [lo, hi, isMember] = span;
        // De-indent ONLY what was a class member. A declaration that already
        // lived at module scope is at the right indent already, and shaving
        // four spaces off it silently reflows every line of its body.
        const raw = lines.slice(lo, hi + 1);
        const text = (isMember ? raw.map(l => (l.startsWith('    ') ? l.slice(4) : l)) : raw)
            .join('\n');
        if (!isMember) return text;
        return kind === 'const'
            ? text.replace(/^private static readonly /m, 'const ')
            : text.replace(/^private static /m, 'function ');
    });

    let body = declarations.join('\n\n') + (declarations.length ? '\n\n' : '')
        + `export const ${cfg.object} = {\n` + keep.join('\n') + '\n};\n';
    for (const { name } of [...hoists, ...elsewhere]) {
        body = body.split(`GameService.${name}`).join(name);
    }

    const classLine = lines.findIndex(l => l.startsWith('export class GameService {'));
    const index = importIndex(lines, classLine);
    const free = freeIdentifiers(body);

    // A NAME THE FAMILY USES THAT IS NEITHER IMPORTED NOR MOVED IS FATAL.
    //
    // The family also reads module-level declarations of `game.ts` - a regex
    // table, a key builder, a focus constant. Those are not imports, so an
    // earlier version filtered them out of the import list and wrote a module
    // referring to four names that do not exist there. It compiled nothing and
    // looked like the move had lost code. Two honest fixes, and the choice
    // between them is a question about the declaration rather than about this
    // tool: if the family is its only reader, move it too, with `elsewhere`.
    // If something left behind still reads it, it is shared and belongs in a
    // module both can import - never exported back out of `game.ts`, because
    // this module is imported BY `game.ts` and that closes a runtime cycle.
    const declared = new Set();
    const decl = /^(?:export )?(?:const|let|function|async function|interface|type|class)\s+([A-Za-z_][A-Za-z0-9_]*)/;
    for (const l of lines.slice(0, classLine)) {
        const m = decl.exec(l);
        if (m) declared.add(m[1]);
    }
    const moved = new Set([...cfg.methods, ...(cfg.hoist ?? []).map(h => h.name),
        ...(cfg.elsewhere ?? []).map(h => h.name)]);
    const stranded = [...free].filter(n =>
        declared.has(n) && !index.has(n) && !moved.has(n) && !body.includes(`function ${n}(`)
        && !body.includes(`const ${n} `));
    if (stranded.length) {
        throw new Error(
            `these are declared in ${cfg.file} at module scope and the family uses them, `
            + `but they are neither imported nor moved:\n  ${stranded.join('\n  ')}\n`
            + 'Move each with `elsewhere` if this family is its only reader, or lift it '
            + 'into a shared module first if anything left behind still reads it.');
    }

    const need = [...free]
        .filter(n => index.has(n) && n !== 'GameService' && n !== cfg.object);
    const imports = importBlock(need, index)
        + "\nimport type { GameService } from './game.js';";
    write(cfg.out, (cfg.header + '\n' + imports + '\n\n' + body).split('\n'), false);

    // take it out of the turn, and widen what it reaches
    const cuts = [[a, b], ...elsewhere.map(h => h.span)].sort((x, y) => y[0] - x[0]);
    for (const [lo, hi] of cuts) {
        let end = hi;
        if (lines[end + 1] !== undefined && lines[end + 1].trim() === '') end += 1;
        lines.splice(lo, end - lo + 1);
    }
    let src = lines.join('\n');
    for (const n of cfg.widen) {
        const re = new RegExp(`^(    )private ((?:static )?(?:async )?(?:readonly )?${n}\\b)`, 'm');
        if (!re.test(src)) throw new Error(`${n}: nothing private by that name to widen`);
        src = src.replace(re, '$1$2');
    }
    write(cfg.file, src.split('\n'), crlf);
    console.log(`${cfg.out} written | ${cfg.file} now ${src.split('\n').length} lines`);
    console.log('now: prune-imports-that-went-dead.mjs, then prove-a-move-changed-nothing.mjs,');
    console.log(`then add ${cfg.out} to HANDLERS in build-the-verb-surface.mjs and regenerate.`);
}

function main() {
    const arg = process.argv[2];
    if (!arg || arg === '--example') {
        console.log(JSON.stringify(EXAMPLE, null, 4));
        console.log('\n`from`/`to` name the first and last member of one CONTIGUOUS region;');
        console.log('everything between them moves, banners and comments included.');
        console.log('`hoist` lifts a static out of that region to module scope:');
        console.log('    { "name": "wouldTheyKneel", "kind": "function" }');
        console.log('`elsewhere` moves a declaration from outside the region entirely -');
        console.log('use it for a constant whose only reader is in this family.');
        process.exit(arg ? 0 : 2);
    }
    build(JSON.parse(fs.readFileSync(arg, 'utf8')));
}

main();
