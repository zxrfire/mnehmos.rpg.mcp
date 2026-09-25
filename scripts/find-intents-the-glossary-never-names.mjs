#!/usr/bin/env node
/**
 * Intent labels the code attaches to a verb that the verb surface never names.
 *
 * WHY THIS EXISTS
 * ---------------
 * `WHAT_EACH_VERB_IS_FOR` is the only account of the action set the phase-1
 * classifier is ever given, and the model reads the player's sentence BEFORE
 * the pattern table does. So a read the glossary does not name is a read the
 * model will not reach for, however good the table is: it stays reachable only
 * by a player who happens to type the one sentence the table has a line for.
 *
 * Measured the day this was written: `look` named seven of the twelve intents
 * it dispatches, `sect` twenty of twenty-three, `coerce` four of seven. Fifteen
 * implemented, routed, tested reads in total, of which five were whole
 * capabilities - what a house holds, what it teaches, who stands behind it,
 * what a province makes, and whether a house would have you.
 *
 * The existing guard, `tests/docs/the-verb-surface-is-not-stale.test.ts`,
 * compares each verb's `intents` against an exported runtime constant, and it
 * caught none of that by construction: `SectIntent` and `CoercionIntent` are
 * union types with no constant to compare against, `look` has neither, and
 * several verbs set their label inline in the branch that recognises the
 * sentence. So this reads the source rather than asking the code for a list,
 * which also means it keeps working while somebody is moving intents about.
 *
 *     node scripts/find-intents-the-glossary-never-names.mjs
 *     node scripts/find-intents-the-glossary-never-names.mjs --json
 *
 * THREE READINGS, ALL OF THE CODE AS IT STANDS
 * --------------------------------------------
 *   PRODUCED    an object literal under `src/web` that sets `action: '<verb>'`
 *               and, inside the same braces, a literal `intent: '<label>'`.
 *               That is a plan the parser can hand the engine.
 *   TABLED      a `ReadonlyArray<[…, RegExp]>` of labels whose first use sits
 *               just above a literal planning `action: '<verb>'`. `coerce` gets
 *               every one of its labels this way and not one is written down.
 *   DISPATCHED  a comparison against `action.intent` inside the `case '<verb>'`
 *               arm of the verb switch in `turn-engine.ts`.
 *
 * WHAT IT CANNOT SEE, WHICH IS THE PART TO KNOW
 * ---------------------------------------------
 * It under-reports and never over-reports, which is the right direction for a
 * ratchet: a label it misses is a label nobody is being told about, so a rising
 * count is always real work and a falling one may be flattering. Two known
 * blind spots. A nested `switch (intent)` inside a handler the verb switch
 * delegates to is not read as a dispatch - `sect` resolves that way, and its
 * labels are caught as productions instead. And a table whose first use is more
 * than `A_TABLE_FEEDS_WHAT_FOLLOWS_IT` characters from the literal it feeds is
 * not mapped to any verb at all.
 *
 * A ROW HERE IS A QUESTION, NOT A TASK. Some labels are machinery the model
 * should never be handed - a pre-resolution rewrite, or the read half of a
 * doing verb that the asking pass substitutes. Say which in the test's
 * allow-list, with the reason, or write the entry.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'src/web');
const SURFACE = path.join(WEB, 'what-each-verb-is-for-in-the-players-words.ts');

/** How far past a pattern table's first use the literal it feeds may sit. */
const A_TABLE_FEEDS_WHAT_FOLLOWS_IT = 1200;

function everySource(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...everySource(full));
        else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) out.push(full);
    }
    return out;
}

/** Source with its comments removed, so prose in one is never read as code. */
function withoutComments(src) {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

/** The span from `open` to its matching close, or null. */
function balanced(src, open, opener, closer) {
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === opener) depth++;
        else if (src[i] === closer) {
            depth--;
            if (depth === 0) return src.slice(open, i + 1);
        }
    }
    return null;
}

/** The object literal `at` sits inside, found by balancing braces both ways. */
function theLiteralAround(src, at) {
    let depth = 0;
    for (let i = at; i >= 0; i--) {
        if (src[i] === '}') depth++;
        else if (src[i] === '{') {
            if (depth === 0) return balanced(src, i, '{', '}');
            depth--;
        }
    }
    return null;
}

/**
 * The expression a field is set to, which is not always one line of it.
 *
 * `decline` and `propose` choose their label with a ternary spread over four
 * lines, and a reading that wanted a quote straight after the colon saw neither
 * verb produce anything at all. Ends at the next field of the same literal, or
 * at its closing brace.
 */
function theExpressionAfter(src, at) {
    const rest = src.slice(at, at + 400);
    // The comma before the next field ends it whether or not a line does.
    // `intent: 'standing', topic: 'leaving'` is written on one line, and
    // reading to the end of it made `leaving` a sect intent it has never been.
    const end = /,(?=\s*(?:\.\.\.|[A-Za-z_$][\w$]*\s*:))|\n\s*[)}\]]/.exec(rest);
    return end ? rest.slice(0, end.index) : rest;
}

/** The label literals in an expression, ignoring anything that is not one. */
function theLabelsInside(expression) {
    return [...expression.matchAll(/'([a-z][a-z_]*)'/g)].map(m => m[1]);
}

/** Every verb whose `intent` field an expression mentioning `who` lands on. */
function theVerbsFed(src, who, from, to) {
    const window = src.slice(from, to);
    const verbs = new Set();
    for (const field of window.matchAll(/\bintent:\s*([^,\n}]+)/g)) {
        if (!new RegExp(`\\b${who}\\b`).test(field[1])) continue;
        const literal = theLiteralAround(src, from + field.index);
        const planned = literal === null ? null : /action:\s*'([a-z_]+)'/.exec(literal);
        if (planned) verbs.add(planned[1]);
    }
    return verbs;
}

/**
 * Every verb whose `intent` field this table feeds, at this use of it.
 *
 * The table is rarely on the field itself. It reaches it through a local
 * (`const wanted = TABLE.find(…)`, then `intent: wanted[0]`) or through the
 * reader function that wraps it (`theInteractIntent`, then `intent:
 * theInteractIntent(text) ?? 'talk'`), so both are followed one hop.
 *
 * The distinction in how far each is followed is not fussiness. A file-wide
 * name - the table, the reader - is unique and may be chased anywhere. A local
 * is not: `step` is the passage counter's intent in one branch and the oath's
 * in another, and chasing it file-wide reported the two passage labels as
 * undocumented oath intents.
 *
 * The verb is read off the literal the assignment lands in rather than off the
 * nearest `action:`, which is what tells `move` apart from the `interact`
 * branch above it that shares its labels.
 */
function theVerbsThisTableGivesAnIntentTo(src, use, name) {
    const near = [Math.max(0, use - 400), use + A_TABLE_FEEDS_WHAT_FOLLOWS_IT];
    const verbs = theVerbsFed(src, name, 0, src.length);

    const enclosing = [...src.slice(0, use).matchAll(
        /(?:function\s+([A-Za-z_$][\w$]*)|const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\()/g
    )].pop();
    const reader = enclosing?.[1] ?? enclosing?.[2];
    if (reader) for (const verb of theVerbsFed(src, reader, 0, src.length)) verbs.add(verb);

    for (const b of src.slice(...near).matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)[^=;]*=\s*([^;]*)/g)) {
        if (!new RegExp(`\\b${name}\\b`).test(b[2])) continue;
        for (const verb of theVerbsFed(src, b[1], near[0], near[1])) verbs.add(verb);
    }
    return verbs;
}

function note(found, verb, label, where) {
    if (!found.has(verb)) found.set(verb, new Map());
    if (!found.get(verb).has(label)) found.get(verb).set(label, where);
}

/**
 * Every intent label the code attaches to a verb: `Map<verb, Map<label, where>>`.
 */
export function theIntentsTheCodeAttaches() {
    const found = new Map();
    const read = new Map(
        everySource(WEB).map(file => [file, withoutComments(fs.readFileSync(file, 'utf8'))])
    );
    const shownAs = file => path.relative(ROOT, file).replace(/\\/g, '/');

    // ── PRODUCED ────────────────────────────────────────────────────────
    for (const [file, src] of read) {
        for (const m of src.matchAll(/action:\s*'([a-z_]+)'/g)) {
            const literal = theLiteralAround(src, m.index);
            if (literal === null) continue;
            for (const im of literal.matchAll(/(?:^|[\s,{(])intent:\s*/g)) {
                for (const label of theLabelsInside(theExpressionAfter(literal, im.index + im[0].length))) {
                    note(found, m[1], label, `${shownAs(file)} produces it`);
                }
            }
        }
    }

    // ── TABLED ──────────────────────────────────────────────────────────
    //
    // A table of labels is only this verb's intents if the plan it feeds puts
    // it on the `intent` field. Four tables in `sect-phrasings.ts` feed `topic`
    // instead - the siphon's pace, the errand, the verdict on a complaint, the
    // side of a curriculum change - and reading the nearest `action:` rather
    // than the field they land on reported all eleven of those labels as
    // undocumented sect intents. They are not intents at all.
    for (const [file, src] of read) {
        for (const m of src.matchAll(
            /const\s+([A-Z][A-Z_0-9]*)\s*:\s*Readonly(?:Array)?<\s*\[\s*[A-Za-z]+\s*,\s*RegExp\s*\]\s*>\s*=\s*\[/g
        )) {
            const table = balanced(src, m.index + m[0].length - 1, '[', ']');
            if (table === null) continue;
            const labels = [...table.matchAll(/\[\s*'([a-z_]+)'\s*,/g)].map(row => row[1]);
            if (labels.length === 0) continue;

            const declaration = [m.index, m.index + m[0].length + table.length];
            const verbs = new Set();
            for (const [otherFile, otherSrc] of read) {
                for (const use of otherSrc.matchAll(new RegExp(`\\b${m[1]}\\b`, 'g'))) {
                    if (otherFile === file && use.index >= declaration[0] && use.index <= declaration[1]) continue;
                    for (const verb of theVerbsThisTableGivesAnIntentTo(otherSrc, use.index, m[1])) {
                        verbs.add(verb);
                    }
                }
            }
            // One table, two verbs: `MOVE_INTENT_PATTERNS` supplies `move`, and
            // its `follow` and `approach` rows reach `interact` instead when the
            // object is a person. Which label went where cannot be read off the
            // table, and guessing would report three travel labels as
            // undocumented interact intents. Skipped, which is the direction
            // this reading errs in everywhere.
            if (verbs.size !== 1) continue;
            const [verb] = verbs;
            for (const label of labels) note(found, verb, label, `${shownAs(file)} lists it in ${m[1]}`);
        }
    }

    // ── DISPATCHED ──────────────────────────────────────────────────────
    const engine = (read.get(path.join(WEB, 'turn-engine.ts')) ?? '').split('\n');
    const cases = [];
    engine.forEach((line, i) => {
        const m = /^(\s*)case '([a-z_]+)':/.exec(line);
        if (m) cases.push({ line: i, indent: m[1].length, verb: m[2] });
    });
    if (cases.length > 0) {
        const verbSwitch = Math.min(...cases.map(c => c.indent));
        const arms = cases.filter(c => c.indent === verbSwitch);
        for (let i = 0; i < arms.length; i++) {
            const body = engine
                .slice(arms[i].line, i + 1 < arms.length ? arms[i + 1].line : engine.length)
                .join('\n');
            for (const m of body.matchAll(/(?:action|plan)\.intent\s*===\s*'([a-z_]+)'/g)) {
                note(found, arms[i].verb, m[1], 'src/web/turn-engine.ts dispatches on it');
            }
        }
    }

    return found;
}

/**
 * What the verb surface names, read out of its own source: `Map<verb, string[]>`.
 *
 * Read rather than imported so this runs under plain node, as its siblings in
 * this directory do. The test imports the module as well and asserts the two
 * readings agree, so a regex here that stopped seeing an entry fails loudly
 * instead of quietly reporting everything as documented.
 */
export function whatTheVerbSurfaceNames() {
    const src = withoutComments(fs.readFileSync(SURFACE, 'utf8'));
    const start = src.indexOf('WHAT_EACH_VERB_IS_FOR');
    const table = balanced(src, src.indexOf('{', start), '{', '}');
    const named = new Map();
    if (table === null) return named;
    for (const m of table.matchAll(/^ {4}([a-z_]+):\s*\{/gm)) {
        const entry = balanced(table, table.indexOf('{', m.index + m[0].length - 1), '{', '}');
        if (entry === null) continue;
        const at = entry.indexOf('intents:');
        if (at < 0) { named.set(m[1], []); continue; }
        const value = entry.slice(at + 'intents:'.length).trimStart();
        named.set(m[1], value.startsWith('[')
            ? [...balanced(entry, entry.indexOf('[', at), '[', ']').matchAll(/'([a-z_]+)'/g)].map(x => x[1])
            : theListBehindTheName(src, /^([A-Za-z_$][\w$]*)/.exec(value)?.[1] ?? ''));
    }
    return named;
}

/**
 * The labels behind an identifier the surface uses instead of a list.
 *
 * `request` names its intents as `REQUEST_KINDS`, which is `Object.keys` of a
 * mapped type standing in for `RequestKind` - the compiler's way of getting the
 * completeness guarantee a union type cannot give. Followed two hops, so that
 * reading the source and importing the module agree; the test asserts they do.
 */
function theListBehindTheName(src, name) {
    if (name === '') return [];
    const declared = new RegExp(`const\\s+${name}\\b[^=]*=\\s*`).exec(src);
    if (!declared) {
        // Imported: `MOVE_INTENTS` is declared where the engine dispatches on it.
        const from = new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*'\\./([\\w-]+)\\.js'`).exec(src);
        return from
            ? theListBehindTheName(withoutComments(fs.readFileSync(path.join(WEB, `${from[1]}.ts`), 'utf8')), name)
            : [];
    }
    const at = declared.index + declared[0].length;
    if (src[at] === '[') return [...balanced(src, at, '[', ']').matchAll(/'([a-z_]+)'/g)].map(x => x[1]);
    if (src[at] === '{') return [...balanced(src, at, '{', '}').matchAll(/([a-z_]+):\s*true/g)].map(x => x[1]);
    const through = /Object\.keys\(\s*([A-Za-z_$][\w$]*)\s*\)/.exec(src.slice(at, at + 120));
    return through ? theListBehindTheName(src, through[1]) : [];
}

/**
 * The labels the code attaches that the verb surface does not name.
 *
 * `[{ verb, intent, where }]`, sorted, so a caller can count them and say which.
 */
export function findIntentsTheGlossaryNeverNames() {
    const named = whatTheVerbSurfaceNames();
    const rows = [];
    for (const [verb, labels] of theIntentsTheCodeAttaches()) {
        if (!named.has(verb)) continue;
        for (const [intent, where] of labels) {
            if (!named.get(verb).includes(intent)) rows.push({ verb, intent, where });
        }
    }
    return rows.sort((a, b) => a.verb.localeCompare(b.verb) || a.intent.localeCompare(b.intent));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const rows = findIntentsTheGlossaryNeverNames();
    if (process.argv.includes('--json')) {
        console.log(JSON.stringify(rows, null, 1));
    } else {
        const attached = theIntentsTheCodeAttaches();
        const named = whatTheVerbSurfaceNames();
        for (const verb of [...attached.keys()].sort()) {
            if (!named.has(verb)) continue;
            console.log(
                `${verb.padEnd(16)}${String(named.get(verb).length).padStart(2)} named `
                + `of ${String(attached.get(verb).size).padStart(2)} attached`
            );
        }
        console.log(`\n${rows.length} not named by the verb surface:`);
        for (const row of rows) console.log(`  ${row.verb.padEnd(12)} ${row.intent.padEnd(18)} ${row.where}`);
    }
}
