/**
 * The top of the pyramid: does the MODEL read a sentence the way a reader would.
 *
 * Every other reading test in this repo drives `parseIntent`, which is the
 * table. That is the right default - it is deterministic and costs nothing -
 * and it is blind to half the game, because when a provider is configured the
 * model reads first and the table is the fallback. A change can improve one and
 * cost the other: the lane layer measured WORSE on its first cut, and only a
 * model-side comparison caught it.
 *
 * SKIPPED WHEN NO PROVIDER ANSWERS, on purpose. A suite that cannot run without
 * a local model is a suite that stops being run, and the engine layer must stay
 * runnable on a machine with no GPU. Set OLLAMA_BASE_URL and OLLAMA_MODEL to
 * exercise it; `scripts/probe-how-the-model-routes.ts` is the same corpus with
 * a fuller report for when the reading layer changes.
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { OllamaProvider } from '../../src/agent/provider/ollama';
import { INTENT_SYSTEM_PROMPT } from '../../src/web/prompt';
import { extractJsonObject } from '../../src/web/actions';
import { validatePlan } from '../../src/web/planned-action';

const BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL ?? 'gemma4:31b-80k';

/**
 * The sentences a router gets wrong most often, with every reading that counts
 * as understanding it. A SET rather than one verb: several readings are usually
 * defensible, and pinning one would measure agreement with whoever wrote the
 * list rather than whether the sentence was understood.
 */
const EXPECTED: readonly { said: string; ok: readonly string[] }[] = [
    // Both readings are defensible and the set says so. Taking it as the act is
    // right when they can act; taking it as the wish is right when they cannot,
    // and the read then answers with what the bar is. What is NOT acceptable is
    // the reading this started as - `recall`, a list of names they already hold.
    { said: 'I want to join a sect', ok: ['sect', 'petition', 'ceiling', 'unclear'] },
    { said: 'I want to get stronger', ok: ['unclear', 'ceiling', 'status', 'recall'] },
    { said: 'what would it take to get in', ok: ['sect', 'petition', 'ceiling', 'investigate'] },
    { said: 'empty your pockets', ok: ['coerce', 'interact'] },
    { said: 'is this place safe', ok: ['assess', 'look'] },
    { said: 'I sense the qi here', ok: ['look', 'investigate', 'assess'] },
    { said: 'what am I carrying', ok: ['inventory'] },
    { said: 'who could teach me', ok: ['teacher'] },
    { said: 'I sit down and work at the manual', ok: ['cultivate', 'train_technique'] },
    { said: 'I sell the book', ok: ['sell'] }
];

let reachable = false;

beforeAll(async () => {
    try {
        const res = await fetch(`${BASE_URL}/api/tags`, {
            signal: AbortSignal.timeout(2000)
        });
        reachable = res.ok;
    } catch { reachable = false; }
});

describe('the model routes a sentence the way a reader would', () => {
    it('reaches an acceptable verb on the sentences routers get wrong', async () => {
        if (!reachable) {
            console.log(`no provider at ${BASE_URL}; model routing not exercised`);
            return;
        }
        const provider = new OllamaProvider({ baseUrl: BASE_URL, model: MODEL });
        const missed: string[] = [];

        for (const row of EXPECTED) {
            const answer = await provider.call({
                model: MODEL, temperature: 0.2, maxTokens: 300,
                messages: [
                    { role: 'system', content: INTENT_SYSTEM_PROMPT },
                    { role: 'user', content: row.said }
                ]
            } as never);

            const raw = extractJsonObject(String((answer as { text?: string }).text ?? ''));
            // A compound sentence comes back as `steps`; the first is what runs.
            const bag = (raw ?? {}) as Record<string, unknown>;
            const steps = Array.isArray(bag.steps) ? bag.steps : null;
            const plan = raw ? validatePlan(steps && steps.length > 0 ? steps[0] : raw) : null;
            const got = plan?.ok ? plan.action.action : 'unreadable';

            if (!row.ok.includes(got)) missed.push(`${row.said} -> ${got}`);
        }

        expect(missed, `${MODEL} routed these somewhere unusable`).toEqual([]);
    }, 1_800_000);
});
