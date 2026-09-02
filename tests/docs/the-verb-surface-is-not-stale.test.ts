/**
 * `docs/verbs.md` is the answer to "what can a player actually be pointed at",
 * and a stale answer to that is worse than none: it is how a narrator comes to
 * offer somebody a wall to climb when there is no climb verb.
 *
 * Three guards, in order of how early they catch the mistake:
 *
 *   1. `WHAT_EACH_VERB_IS_FOR` is a `Record<ActionName, …>`, so a verb with no
 *      description does not COMPILE. That guard is in the type system and needs
 *      no test.
 *   2. The document is regenerated and compared, so a verb described but not
 *      published fails here with the one command that fixes it.
 *   3. The intent sub-lists are compared against the constants the engine
 *      actually dispatches on. A verb whose real surface is its intents is
 *      undocumented if only the verb is named, and those lists live in six
 *      different modules.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    ACTION_NAMES,
    INTERACT_INTENTS,
    MOVE_INTENTS,
    OATH_INTENTS,
    OFFER_INTENTS,
    PASSAGE_INTENTS,
    PETITION_INTENTS,
    POSTURE_INTENTS,
    RECALL_INTENTS,
    SEAL_INTENTS,
    SECT_INTENT_PATTERNS,
    SECT_INTENT_UNAMBIGUOUS,
    SITE_INTENTS,
    type ActionName
} from '../../src/web/actions.js';
import { LEGACY_INTENTS } from '../../src/web/leaving-things-for-the-next-life.js';
import {
    WHAT_EACH_VERB_IS_FOR,
    composeActionGlossary,
    composePlanSchemaFields,
    verbsTaking
} from '../../src/web/what-each-verb-is-for-in-the-players-words.js';
import { INTENT_SYSTEM_PROMPT } from '../../src/web/prompt.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOC = path.join(ROOT, 'docs', 'verbs.md');

const { build } = await import(
    /* @vite-ignore */ path.join(ROOT, 'scripts', 'build-the-verb-surface.mjs')
) as { build: () => string };

describe('the verb surface', () => {
    it('is current with the action set it describes', () => {
        const current = fs.readFileSync(DOC, 'utf8');
        expect(
            build(),
            'docs/verbs.md is stale. Run: node scripts/build-the-verb-surface.mjs'
        ).toBe(current);
    });

    it('says what every verb is for, in a sentence', () => {
        const thin = ACTION_NAMES.filter(
            verb => WHAT_EACH_VERB_IS_FOR[verb].says.trim().length < 15
        );
        expect(thin, `verbs with no usable description: ${thin.join(' ')}`).toEqual([]);
    });

    it('publishes a section for every verb', () => {
        const text = fs.readFileSync(DOC, 'utf8');
        const missing = ACTION_NAMES.filter(verb => !text.includes(`### \`${verb}\``));
        expect(missing, `verbs with no section in docs/verbs.md: ${missing.join(' ')}`).toEqual([]);
    });
});

/**
 * The intents, against the constants the engine dispatches on.
 *
 * `sect` is gathered from its two pattern tables rather than from a list,
 * because `SectIntent` is a union type and has no runtime constant - which is
 * exactly the sort of sub-list that goes undocumented.
 */
const DECLARED_INTENTS: ReadonlyArray<[ActionName, readonly string[]]> = [
    ['interact', INTERACT_INTENTS],
    ['move', MOVE_INTENTS],
    ['oath', OATH_INTENTS],
    ['offer', OFFER_INTENTS],
    ['passage', PASSAGE_INTENTS],
    ['petition', PETITION_INTENTS],
    ['posture', POSTURE_INTENTS],
    ['recall', RECALL_INTENTS],
    ['seal', SEAL_INTENTS],
    ['site', SITE_INTENTS],
    ['legacy', LEGACY_INTENTS]
];

/**
 * `sect`, which can only be checked in one direction.
 *
 * `SectIntent` is a union type with no runtime constant, and its two pattern
 * tables are not the whole of it - `leadershipIntent` and `institutionalAct`
 * produce the officer half. So the tables prove an intent EXISTS and can never
 * prove one does not, and asserting the reverse here would say that ten working
 * intents reach nothing.
 */
const SECT_INTENTS_THE_TABLES_KNOW = [
    ...new Set([
        ...SECT_INTENT_UNAMBIGUOUS.map(([intent]) => intent),
        ...SECT_INTENT_PATTERNS.map(([intent]) => intent)
    ])
];

describe('the intent sub-lists', () => {
    it.each([...DECLARED_INTENTS, ['sect', SECT_INTENTS_THE_TABLES_KNOW] as const])(
        '%s lists every intent the engine dispatches on',
        (verb, declared) => {
            const documented = WHAT_EACH_VERB_IS_FOR[verb as ActionName].intents ?? [];
            const missing = declared.filter(intent => !documented.includes(intent));
            expect(
                missing,
                `${verb} dispatches on ${missing.join(', ')} and the verb surface does not say so`
            ).toEqual([]);
        }
    );

    it.each(DECLARED_INTENTS)('%s documents no intent the engine has never heard of', (verb, declared) => {
        const documented = WHAT_EACH_VERB_IS_FOR[verb].intents ?? [];
        const invented = documented.filter(intent => !declared.includes(intent));
        expect(
            invented,
            `${verb} is documented as taking ${invented.join(', ')}, which reaches nothing`
        ).toEqual([]);
    });
});

/**
 * The prompt and the document are one source, rendered twice.
 *
 * This is the drift the module header of `prompt.ts` describes from the last
 * time: a hand-maintained copy beside the thing it copied. The glossary had
 * fallen twelve verbs behind the enum before it was composed rather than
 * written, and nothing failed while it had.
 */
describe('the phase-1 glossary', () => {
    it('describes every verb in the closed set', () => {
        const glossary = composeActionGlossary();
        const missing = ACTION_NAMES.filter(verb => !new RegExp(`^${verb}\\s`, 'm').test(glossary));
        expect(missing, `verbs the classifier is never told about: ${missing.join(' ')}`).toEqual([]);
    });

    it('reaches the prompt the classifier is actually sent', () => {
        for (const verb of ACTION_NAMES) {
            expect(INTENT_SYSTEM_PROMPT, `${verb} is not in the phase-1 prompt`).toContain(verb);
        }
    });

    it('names every verb that reads a field, in the schema block', () => {
        const schema = composePlanSchemaFields();
        for (const field of ['days', 'intent', 'topic'] as const) {
            for (const verb of verbsTaking(field)) {
                expect(schema, `${verb} reads ${field} and the schema block does not say so`)
                    .toContain(verb);
            }
        }
    });

    it('quotes no unresolved balance number', () => {
        expect(composeActionGlossary()).not.toMatch(/\$\{/);
    });
});
