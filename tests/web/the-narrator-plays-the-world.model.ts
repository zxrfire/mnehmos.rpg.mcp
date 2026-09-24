/**
 * Does the narrator play the world, measured against the local model.
 *
 *     npx vitest run --config vitest.model.config.ts tests/web/the-narrator-plays-the-world.model.ts
 *
 * Skips when no Ollama answers. A reading, not a gate: a sampler can move these, so a red result
 * is something to read, and nobody should touch the engine to satisfy it.
 *
 * FOUND BY PLAYING. The prose a player read was the engine's fact lines verbatim - "reads as
 * above you, though on the same footing", "Last known to be at", "That is what the record
 * holds" - because every narration took 93s against a 30s timeout and fell back. What this
 * holds is the other side of that: the model answered, it played the person spoken to, and none
 * of the clerk's vocabulary reached the page.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { OllamaProvider } from '../../src/agent/provider/ollama';
import { ProviderNarrator } from '../../src/web/narrator';
import { EXAMPLES_CLOSE, EXAMPLES_OPEN, WORKED_TURNS } from '../../src/web/the-narrator-plays-the-world';
import { makeGameInWorld } from './harness';

const BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL ?? 'rpg-gemma4-31b';

/** Words the engine writes for an operator and a narrator must never copy onto the page. */
const CLERK = new RegExp([
    'qi-units?',
    'the record (?:holds|states|says)',
    'reads as (?:above|below|level)',
    'last known to be at',
    '\\d+(?:\\.\\d+)?x (?:the rate|ordinary|what)',
    '\\d+ rungs? (?:above|below)',
    'the catalog',
    'on the roster as',
    'a wall beneath you',
    'looking harder adds'
].join('|'), 'i');

/**
 * Every line of speech in the worked examples, long enough to be distinctive. Played: a shout
 * at the square came back as the square example's punchline, word for word, because that
 * example sat on the exact situation a player types.
 */
const EXAMPLE_LINES = WORKED_TURNS
    .slice(WORKED_TURNS.indexOf(EXAMPLES_OPEN), WORKED_TURNS.indexOf(EXAMPLES_CLOSE))
    .split('"')
    .filter((_, i) => i % 2 === 1)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line.length >= 20);

/** A turn that closes on a list of what the player might do next. */
const ENDS_ON_A_MENU = /(?:^|\n)\s*(?:You could|You might|Or you could)[^\n]*$/;

let reachable = false;

beforeAll(async () => {
    try {
        const res = await fetch(`${BASE_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
        reachable = res.ok;
    } catch { reachable = false; }
});

describe('the narrator plays the world', () => {
    it('answers every turn, plays the person spoken to, and leaves the clerk out', async () => {
        if (!reachable) {
            console.log(`no provider at ${BASE_URL}; the narrator was not exercised`);
            return;
        }
        const narrator = new ProviderNarrator(
            new OllamaProvider({ baseUrl: BASE_URL, defaultModel: MODEL }), { model: MODEL, timeoutMs: 0 }
        );
        const { game } = await makeGameInWorld({ worldSeed: 'a-xianxia-run', seed: 'xianxia', narrator });
        await game.newRun('Shen Wuyou');

        // Somebody the player grew up with, out of the opening's own record, so the sentence
        // names a real person in whatever world the seed draws.
        const recap = game.state().log
            .filter(entry => entry.role === 'engine').map(entry => entry.text).join('\n');
        // "Kong Zhaolu." with a label under it, or "Kong Zhaolu raised you." - either shape.
        const family = /The household[^\n]*:\n([A-Z][a-z]+ [A-Z][a-z]+)[. ]/.exec(recap)?.[1];
        expect(family, 'the opening names the household').toBeTruthy();

        const turns: { said: string; text: string; source: string | undefined }[] = [];
        for (const said of [`${family}, hello`, 'WHO IS THE STRONGEST HERE', 'I sit down and try to cultivate']) {
            const turn = await game.act(said);
            const told = turn.toolCalls.find(call => call.name === 'narrator.narrate');
            turns.push({ said, text: turn.narration, source: told?.source });
        }
        for (const { said, text, source } of turns) console.log(`\n> ${said} [${source}]\n${text}`);

        for (const { said, text, source } of turns) {
            expect(source, `"${said}" fell back to the engine's own lines`).toBe('model');
            expect(text.match(CLERK)?.[0], `"${said}" copied the clerk`).toBeUndefined();
            expect(ENDS_ON_A_MENU.test(text.trim()), `"${said}" ended on a menu`).toBe(false);
            const flat = text.replace(/\s+/g, ' ');
            expect(EXAMPLE_LINES.find(line => flat.includes(line)), `"${said}" copied a worked example`).toBeUndefined();
        }

        // Spoken to by name, the person answers out loud.
        const greeting = turns[0]!.text;
        expect(greeting).toContain(family!);
        expect(greeting, 'nobody spoke when spoken to').toMatch(/["“]/);
    }, 15 * 60_000);
});
