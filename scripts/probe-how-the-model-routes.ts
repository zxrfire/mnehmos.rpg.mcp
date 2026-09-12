/**
 * What the MODEL makes of a sentence, which the table probe cannot see.
 *
 * `probe-what-a-refusal-is-still-for.ts` plays sentences through the
 * deterministic reader and counts what came back unanswered. That is the right
 * instrument for the table and it is blind to half the game: when a provider is
 * configured the model reads the sentence first, and the table is the fallback.
 * A change that improves one can quietly cost the other - the lane layer
 * measured WORSE on its first cut and only a model-side comparison caught it.
 *
 * So this is the other half of the pyramid, and it is deliberately not a test:
 * it needs a running provider, it takes tens of seconds a sentence, and a suite
 * that cannot run without a local model is a suite that stops being run. Engine
 * routing is the fast layer and belongs in `tests/`; this is run when the
 * reading layer changes.
 *
 *   npx tsx scripts/probe-how-the-model-routes.ts [out.json]
 *
 * Reads OLLAMA_BASE_URL and OLLAMA_MODEL, defaulting to a local install.
 */

import { OllamaProvider } from '../src/agent/provider/ollama.js';
import { INTENT_SYSTEM_PROMPT } from '../src/web/prompt.js';
import { extractJsonObject } from '../src/web/actions.js';
import { validatePlan } from '../src/web/planned-action.js';
import { writeFileSync } from 'node:fs';

const BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL ?? 'gemma4:31b-80k';

/**
 * What a sentence may acceptably reach.
 *
 * A SET rather than one verb, because several readings are often defensible and
 * pinning one would measure agreement with whoever wrote the list. "I offer the
 * elder my service" is `offer`, `petition`, `sect` or `interact` depending on
 * how literally you take it, and a router that picks any of them has understood
 * the sentence.
 */
const EXPECTED: readonly { said: string; ok: readonly string[] }[] = [
    // reads about yourself - the family that used to collide
    { said: 'what am I carrying', ok: ['inventory'] },
    { said: 'what is my talent', ok: ['status'] },
    { said: 'I open my storage ring', ok: ['inventory'] },
    { said: 'who could teach me', ok: ['teacher'] },
    { said: 'what arts can I pick up', ok: ['list_techniques', 'acquisition'] },
    { said: 'how far can this method take me', ok: ['ceiling'] },
    { said: 'what do I know about this province', ok: ['recall', 'news', 'investigate'] },
    { said: 'how badly am I hurt', ok: ['status', 'assess'] },
    { said: 'I check my dantian', ok: ['status', 'assess'] },

    // perceiving
    { said: 'I sense the qi here', ok: ['look', 'investigate', 'assess'] },
    { said: 'is there anyone here worth knowing', ok: ['look', 'investigate', 'recall'] },
    { said: 'is this place safe', ok: ['assess', 'look'] },

    // wanting, which names no act
    { said: 'I want to get stronger', ok: ['unclear', 'ceiling', 'status', 'recall'] },
    { said: 'what would it take to get in', ok: ['sect', 'petition', 'ceiling', 'investigate'] },

    // the wall of postings, which the game prints and expects to be named back
    { said: 'I ask what the board says', ok: ['sect'] },
    { said: 'what work is going', ok: ['sect', 'work'] },
    { said: 'what duties are there', ok: ['sect'] },
    { said: 'I take a job from the board', ok: ['sect', 'work'] },

    // acts
    { said: 'I sit down and work at the manual', ok: ['cultivate', 'train_technique'] },
    { said: 'I go into seclusion for a year', ok: ['seclude', 'cultivate'] },
    { said: 'I try to break through', ok: ['breakthrough'] },
    { said: 'I sell the book', ok: ['sell'] },
    { said: 'I eat something', ok: ['eat'] },
    { said: 'I hit him', ok: ['attack'] },
    { said: 'empty your pockets', ok: ['coerce', 'interact'] },
    { said: 'I walk up to the gate and go in', ok: ['site', 'move'] },

    // people and houses
    { said: 'I ask the man by the counter what he is waiting for', ok: ['interact', 'request'] },
    { said: 'I want to join a sect', ok: ['sect'] },
    { said: 'I offer the elder my service', ok: ['offer', 'sect', 'petition', 'interact', 'propose'] },
    { said: 'I press him on it', ok: ['interact', 'coerce', 'request'] }
];

/** The verb a response resolves to, or why it did not. */
async function routed(provider: OllamaProvider, said: string): Promise<string> {
    let text = '';
    try {
        const answer = await provider.call({
            model: MODEL,
            temperature: 0.2,
            maxTokens: 300,
            messages: [
                { role: 'system', content: INTENT_SYSTEM_PROMPT },
                { role: 'user', content: said }
            ]
        } as never);
        text = String((answer as { text?: string }).text ?? '');
    } catch (err) {
        return `THREW:${err instanceof Error ? err.message.slice(0, 40) : 'unknown'}`;
    }

    const raw = extractJsonObject(text);
    if (!raw) return 'NO-JSON';

    // A compound sentence comes back as `steps`, which the turn walks in order.
    // The first step is what runs, so that is what is judged.
    const bag = raw as Record<string, unknown>;
    const steps = Array.isArray(bag.steps) ? bag.steps : null;
    const plan = validatePlan(steps && steps.length > 0 ? steps[0] : raw);
    if (!plan.ok) return `INVALID:${plan.reason.slice(0, 40)}`;
    return plan.action.action;
}

async function main(): Promise<void> {
    const provider = new OllamaProvider({ baseUrl: BASE_URL, model: MODEL });
    const rows: { said: string; got: string; ok: boolean }[] = [];

    for (const row of EXPECTED) {
        const got = await routed(provider, row.said);
        const ok = row.ok.includes(got);
        rows.push({ said: row.said, got, ok });
        console.log(`${ok ? '  ' : '!!'} ${row.said.padEnd(50)} ${got}`);
    }

    const hit = rows.filter(r => r.ok).length;
    const broken = rows.filter(r => !r.ok && !EXPECTED.some(e => e.said === r.said && e.ok.length > 0
        && !r.got.includes(':'))).length;
    console.log(`\n${MODEL}: ${hit}/${rows.length} acceptable, ${broken} unusable responses`);

    const out = process.argv[2];
    if (out) {
        writeFileSync(out, JSON.stringify({ model: MODEL, hit, total: rows.length, rows }, null, 1));
        console.log(`wrote ${out}`);
    }
}

void main();
