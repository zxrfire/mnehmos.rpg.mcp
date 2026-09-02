#!/usr/bin/env node
/**
 * Regenerate the machine-written half of `docs/verbs.md`.
 *
 * WHY THIS EXISTS
 * ---------------
 * A narrator that does not know the verb list invents affordances. It writes
 * "you could try climbing the wall" where there is no climb verb, and the
 * player spends a turn discovering that the prose lied. The engine's own action
 * set is the only honest account of what somebody may be pointed at.
 *
 * A hand-written list of it would be stale within the hour - four agents were
 * adding verbs to `ACTION_NAMES` while this was being written, and one of them
 * landed `coerce` mid-run. So the document is generated from three places and
 * hand-written nowhere:
 *
 *   what-each-verb-is-for-in-the-players-words.ts   what a player is asking for
 *   actions.ts                                      the closed set, and the
 *                                                   deterministic parser's routes
 *   game.ts                                         where each verb resolves
 *
 * The first of those is also what `prompt.ts` composes the phase-1 glossary
 * from, so the document and the prompt are two renderings of one source rather
 * than two wordings of one list. That distinction is the whole point: this
 * module's own header records what happened the last time the narrator's
 * constitution was paraphrased into a prompt string.
 *
 *     node scripts/build-the-verb-surface.mjs           # rewrite
 *     node scripts/build-the-verb-surface.mjs --check   # exit 1 if stale
 *
 * `tests/docs/the-verb-surface-is-not-stale.test.ts` runs the check, so a verb
 * added without a description fails the suite rather than going quiet - and the
 * `Record<ActionName, …>` in the source module fails the BUILD, which is the
 * earlier and better of the two.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOC = path.join(ROOT, 'docs', 'verbs.md');

const SOURCE = {
    surface: 'src/web/what-each-verb-is-for-in-the-players-words.ts',
    actions: 'src/web/actions.ts',
    game: 'src/web/game.ts'
};

const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** A path relative to `docs/`, which is where the document sits. */
const up = rel => `../${rel}`;

// ─── the closed set ──────────────────────────────────────────────────────

/**
 * Every action name, in enum order.
 *
 * Read out of the source rather than imported because this is a plain `.mjs`
 * script and `actions.ts` pulls in half of `src/web` - the same reason
 * `build-world-index.mjs` reads its catalogs as text.
 */
function actionNames(actions) {
    const start = actions.indexOf('export const ACTION_NAMES = [');
    const end = actions.indexOf('] as const;', start);
    if (start < 0 || end < 0) throw new Error('ACTION_NAMES is not where it was');
    return [...actions.slice(start, end).matchAll(/^ {4}'([a-z_]+)',?$/gm)]
        .map(m => ({ verb: m[1] }));
}

/**
 * The members of a `readonly ActionName[]` list, by its name.
 *
 * Anchored on `= [` rather than on the first bracket after the name, because
 * the type annotation carries one of its own: `readonly ActionName[] = [`. That
 * mistake reported 130 read-only actions out of a set of 52, by sweeping up
 * every verb quoted in the comments inside the list.
 */
function namedList(text, name) {
    const start = text.indexOf(name);
    if (start < 0) return [];
    const open = text.indexOf('= [', start);
    const close = text.indexOf('\n]', open);
    if (open < 0 || close < 0) return [];
    // Identifiers, or the `<any playable verb>` placeholder the admin list
    // carries. Deliberately not `[^']+`: an apostrophe in a comment inside the
    // list would then pair with the next one and swallow the prose between them.
    return [...text.slice(open, close).matchAll(/'([a-z_]+)'|'(<[^']*>)'/g)]
        .map(m => m[1] ?? m[2]);
}

/**
 * Which verbs a sentence can reach with no model running.
 *
 * `planIntent` and its helpers build plans as object literals, so every route
 * the deterministic parser has is an `action: 'verb'` somewhere in the file. A
 * verb with none is reachable only through a configured provider, which is the
 * defect `attack` was found in - the sentence fell through the whole table and
 * was caught by the cultivation branch, and the player sat down to breathe for
 * a month instead of drawing.
 */
function parserRoutes(actions) {
    const counts = new Map();
    for (const m of actions.matchAll(/action: '([a-z_]+)'/g)) {
        counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
    }
    return counts;
}

/**
 * The verb a sentence nothing matched becomes.
 *
 * Named separately because the parser reaches it through `FALLBACK_ACTION`
 * rather than by writing the name, so counting literals reported the one verb
 * every unread sentence arrives at as the one verb no sentence can reach.
 */
function fallbackAction(actions) {
    return actions.match(/export const FALLBACK_ACTION: ActionName = '([a-z_]+)'/)?.[1] ?? null;
}

/** Balance numbers a description quotes, so `${NAME}` can be resolved. */
function numbers(actions) {
    const out = new Map();
    for (const m of actions.matchAll(/^export const ([A-Z][A-Z0-9_]*) = ([\d_]+);/gm)) {
        out.set(m[1], Number(m[2].replace(/_/g, '')));
    }
    return out;
}

// ─── what a player is asking for ─────────────────────────────────────────

/**
 * The fields a model is never shown, which is `PlanField` minus `MODEL_MAY_SET`.
 *
 * Derived rather than listed, because the set grows: `opening` joined `rations`
 * and `terms` while this script was being written. A field the sentence
 * supplies has to be marked as such in the document, or it reads as something
 * the narrator could ask for and cannot.
 */
function fieldsOffTheSentence(surface) {
    const all = [...(surface.match(/export type PlanField = ([^;]+);/)?.[1] ?? '')
        .matchAll(/'([a-z]+)'/g)].map(m => m[1]);
    const mayset = [...(surface.match(/export const MODEL_MAY_SET = \[([^\]]*)\]/)?.[1] ?? '')
        .matchAll(/'([a-z]+)'/g)].map(m => m[1]);
    return all.filter(f => !mayset.includes(f));
}

/**
 * The entries of `WHAT_EACH_VERB_IS_FOR`.
 *
 * Written to a fixed shape so this can be read with a regular expression: one
 * verb per key at four spaces of indent, `takes` and optional `intents` as
 * array literals, `says` as a template literal. The staleness test compares the
 * result against the module imported properly, so a shape this cannot read
 * shows up as a missing row rather than as a wrong one.
 */
function verbSurface(surface) {
    const start = surface.indexOf('export const WHAT_EACH_VERB_IS_FOR');
    const open = surface.indexOf('= {', start) + 3;
    // Bounded at the record's own closing brace. Unbounded, it went on to read
    // the rendering constants below it and reported a verb called `target`.
    const body = surface.slice(open, surface.indexOf('\n};', open));
    const entries = new Map();
    const ENTRY = /^ {4}([a-z_]+): \{\n([\s\S]*?)\n {4}\}/gm;
    for (const m of body.matchAll(ENTRY)) {
        const inner = m[2];
        const takes = [...(inner.match(/takes: \[([^\]]*)\]/)?.[1] ?? '').matchAll(/'([a-z]+)'/g)]
            .map(t => t[1]);
        const intentsRaw = inner.match(/intents: (\[[\s\S]*?\]|[A-Z_]+),/)?.[1] ?? '';
        const intents = intentsRaw.startsWith('[')
            ? [...intentsRaw.matchAll(/'([a-z_]+)'/g)].map(t => t[1])
            : namedConstant(surface, intentsRaw);
        const says = inner.match(/says: `([\s\S]*?)`\s*$/)?.[1] ?? '';
        entries.set(m[1], { takes, intents, says: says.replace(/\s+/g, ' ').trim() });
    }
    return entries;
}

/**
 * The members behind an identifier used in place of an intent list.
 *
 * Only `REQUEST_KINDS` uses this today: the request shapes have no exported
 * constant to compare against, so the module builds them from a mapped type the
 * compiler forces to be complete.
 */
function namedConstant(surface, name) {
    if (name !== 'REQUEST_KINDS') return [];
    const start = surface.indexOf('const EVERY_REQUEST_KIND');
    const end = surface.indexOf('};', start);
    return [...surface.slice(start, end).matchAll(/^ {4}([a-z_]+): true/gm)].map(m => m[1]);
}

// ─── where it resolves ───────────────────────────────────────────────────

/**
 * The dispatch line and handler for each verb, out of `GameService.execute`.
 *
 * Searched only after `switch (action.action)` so that a case label belonging
 * to one of the intent switches further down the file cannot be mistaken for
 * the verb's own.
 */
function resolutions(game) {
    const from = game.indexOf('switch (action.action)');
    const lines = game.split('\n');
    const offset = game.slice(0, from).split('\n').length - 1;
    const rows = new Map();
    for (let i = offset; i < lines.length; i++) {
        const m = lines[i].match(/^\s+case '([a-z_]+)':/);
        if (!m || rows.has(m[1])) continue;
        let handler = null;
        for (let j = i; j < Math.min(i + 10, lines.length); j++) {
            const call = lines[j].match(/this\.([A-Za-z]+)\(/);
            if (call) { handler = call[1]; break; }
        }
        rows.set(m[1], { line: i + 1, handler });
    }
    return rows;
}

/** Where a handler is defined, so the link points at the code and not the label. */
function handlerLines(game) {
    const rows = new Map();
    const lines = game.split('\n');
    lines.forEach((line, i) => {
        const m = line.match(/^ {4}(?:private |public |protected )?(?:async )?([A-Za-z]+)\s*\(/);
        if (m && !rows.has(m[1])) rows.set(m[1], i + 1);
    });
    return rows;
}

// ─── rendering ───────────────────────────────────────────────────────────

const esc = s => s.replace(/\|/g, '\\|');

function withNumbers(text, nums) {
    return text.replace(/\\?\$\{([A-Z][A-Z0-9_]*)\}/g, (whole, name) =>
        nums.has(name) ? String(nums.get(name)) : whole);
}

function renderSummary(model) {
    const { verbs, surface, readOnly, timed, routes, bare, fallback } = model;
    const modelOnly = verbs.filter(v => v.verb !== fallback && !routes.has(v.verb)).length;
    const out = [
        `**${verbs.length} verbs.** ${readOnly.length} of them take nothing from the player,`,
        `${timed.length} spend in-world time and can therefore kill, and`,
        modelOnly === 0
            ? 'every one of them is reachable by a sentence with no model running.'
            : modelOnly === 1
                ? 'one is reachable only with a model running.'
                : `${modelOnly} are reachable only with a model running.`,
        '',
        'A verb the deterministic parser cannot reach is playable only where a provider is',
        'configured, which makes the game two different games. A bare word reaches a verb only',
        'where that verb takes nothing - see `theVerbsOwnName`.',
        '',
        '| Verb | Takes | Costs | Plain English | Bare word | Intents |',
        '|---|---|---|---|---|---|'
    ];
    for (const { verb } of verbs) {
        const entry = surface.get(verb);
        const takes = entry && entry.takes.length ? entry.takes.map(t => `\`${t}\``).join(' ') : '-';
        const costs = timed.includes(verb) ? 'time' : readOnly.includes(verb) ? 'nothing' : 'varies';
        const route = verb === fallback
            ? 'fallback'
            : routes.has(verb) ? 'yes' : '**no route**';
        const intents = entry && entry.intents.length
            ? `[${entry.intents.length}](#${verb})`
            : '-';
        out.push(`| [\`${verb}\`](#${verb}) | ${takes} | ${costs} | ${route} | `
            + `${bare.includes(verb) ? 'yes' : '-'} | ${intents} |`);
    }
    out.push('');
    out.push('`Plain English` is whether the deterministic parser has any branch that produces this');
    out.push('verb. `Costs` is read off `READ_ONLY_ACTIONS` and `TIME_CONSUMING_ACTIONS`; a verb in');
    out.push('neither spends something on some paths and not others - `interact` is the worked case,');
    out.push('free on three of its intents and priced on the rest.');
    return out.join('\n');
}

function renderVerbs(model) {
    const { verbs, surface, resolved, handlers, routes, nums, readOnly, timed, sentenceFields, fallback } = model;
    const out = [];
    for (const { verb } of verbs) {
        const entry = surface.get(verb);
        out.push(`### \`${verb}\``);
        out.push('');
        out.push(entry ? withNumbers(entry.says, nums) : '_(no description; the source module is missing an entry)_');
        out.push('');

        // Symbols rather than line numbers, on purpose. `actions.ts` and
        // `game.ts` are edited constantly by several people at once, and a
        // document that goes stale on every unrelated edit is a staleness test
        // that fails for everybody and gets ignored. A `case` label and a
        // method name are greppable and they do not move.
        const facts = [];
        facts.push(`Declared in [\`ACTION_NAMES\`](${up(SOURCE.actions)})`);
        const res = resolved.get(verb);
        if (res && res.handler && handlers.has(res.handler)) {
            facts.push(`resolves through \`case '${verb}'\` in `
                + `[\`GameService.execute\`](${up(SOURCE.game)}) and \`GameService.${res.handler}\``);
        } else if (res) {
            facts.push(`resolves at \`case '${verb}'\` in [\`GameService.execute\`](${up(SOURCE.game)})`);
        } else {
            facts.push('**does not appear in `GameService.execute` yet**');
        }
        facts.push(verb === fallback
            ? 'what the deterministic parser answers when nothing else matched'
            : routes.has(verb)
                ? 'the deterministic parser reaches it'
                : '**no deterministic route - a model is required to reach it**');
        if (readOnly.includes(verb)) facts.push('passes no time');
        else if (timed.includes(verb)) facts.push('spends in-world time');
        out.push(facts.join(' · ') + '.');

        if (entry && entry.takes.length) {
            const fields = entry.takes.map(field => sentenceFields.includes(field)
                ? `\`${field}\` (read off the sentence, never from a model)`
                : `\`${field}\``);
            out.push('');
            out.push(`Takes ${fields.join(', ')}.`);
        }
        if (entry && entry.intents.length) {
            out.push('');
            out.push(`Intents: ${entry.intents.map(i => `\`${i}\``).join(', ')}.`);
        }
        out.push('');
    }
    return out.join('\n').trimEnd();
}

function renderAdmin(model) {
    const out = [
        `**${model.admin.length} operator actions**, reached by a line beginning \`ADMIN\`.`,
        '',
        'They are not verbs and no model reads one: an `ADMIN` line is handled before phase 1,',
        'read deterministically, and refused rather than improvised where the reader has no noun',
        'for what it names. What each one takes, which phrasings reach it, and the law it follows',
        'are in [`admin.md`](admin.md) - this list is only the set, so that a new action there',
        'cannot go unlisted here.',
        '',
        model.admin.map(a => `\`${a}\``).join(' · '),
        '',
        `Declared as \`ADMIN_ACTIONS\` in [\`game.ts\`](${up(SOURCE.game)}).`
    ];
    return out.join('\n');
}

// ─── splicing ────────────────────────────────────────────────────────────

function splice(text, name, body) {
    const begin = `<!-- BEGIN GENERATED: ${name} -->`;
    const end = `<!-- END GENERATED: ${name} -->`;
    const i = text.indexOf(begin);
    const j = text.indexOf(end);
    if (i < 0 || j < 0) throw new Error(`docs/verbs.md is missing the ${name} markers`);
    return text.slice(0, i + begin.length) + '\n\n' + body + '\n\n' + text.slice(j);
}

export function model() {
    const actions = read(SOURCE.actions);
    const game = read(SOURCE.game);
    const surfaceText = read(SOURCE.surface);
    const readOnly = namedList(actions, 'export const READ_ONLY_ACTIONS');
    return {
        verbs: actionNames(actions),
        surface: verbSurface(surfaceText),
        readOnly,
        timed: namedList(actions, 'export const TIME_CONSUMING_ACTIONS'),
        bare: readOnly.filter(v => v !== 'unclear'),
        routes: parserRoutes(actions),
        fallback: fallbackAction(actions),
        nums: numbers(actions),
        resolved: resolutions(game),
        handlers: handlerLines(game),
        admin: namedList(game, 'const ADMIN_ACTIONS'),
        sentenceFields: fieldsOffTheSentence(surfaceText)
    };
}

export function build() {
    const m = model();
    let text = fs.readFileSync(DOC, 'utf8');
    text = splice(text, 'summary', renderSummary(m));
    text = splice(text, 'verbs', renderVerbs(m));
    text = splice(text, 'admin', renderAdmin(m));
    return text;
}

const isMain = process.argv[1]
    && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
    const next = build();
    const current = fs.readFileSync(DOC, 'utf8');
    if (process.argv.includes('--check')) {
        if (next !== current) {
            console.error('docs/verbs.md is stale. Run: node scripts/build-the-verb-surface.mjs');
            process.exit(1);
        }
        console.log('docs/verbs.md is current.');
    } else {
        fs.writeFileSync(DOC, next);
        console.log(next === current ? 'verbs.md unchanged.' : 'verbs.md rewritten.');
    }
}
