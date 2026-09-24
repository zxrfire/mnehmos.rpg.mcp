/**
 * An operator may choose to wait for a slow local model rather than read the engine's fallback.
 *
 * Found by playing: a narration on gemma4:31b took 93s and the server's 30s default threw every
 * one away, so the player read the engine's fact lines on every turn and took them for the
 * narrator. `NARRATOR_TIMEOUT_MS=0` is the way to say "wait", and it used to read as 30s.
 */
import { describe, expect, it } from 'vitest';

import { narratorTimeoutFrom } from '../../src/web/server.js';
import { ProviderNarrator } from '../../src/web/narrator.js';

function recording(): { provider: never; signals: (AbortSignal | undefined)[] } {
    const signals: (AbortSignal | undefined)[] = [];
    const provider = {
        name: 'ollama',
        async call(opts: { signal?: AbortSignal }) {
            signals.push(opts.signal);
            return { text: 'You stand in the square.' };
        }
    };
    return { provider: provider as never, signals };
}

describe('how long a model call may take', () => {
    it('is thirty seconds when nobody said', () => {
        expect(narratorTimeoutFrom(undefined)).toBe(30_000);
        expect(narratorTimeoutFrom('')).toBe(30_000);
        expect(narratorTimeoutFrom('soon')).toBe(30_000);
    });

    it('is what the operator said', () => {
        expect(narratorTimeoutFrom('180000')).toBe(180_000);
    });

    it('is no limit at all when the operator said 0', () => {
        expect(narratorTimeoutFrom('0')).toBe(0);
    });

    it('sends no abort signal when there is no limit, and one when there is', async () => {
        const waiting = recording();
        await new ProviderNarrator(waiting.provider, { model: 'm', timeoutMs: 0 })
            .narrate({ headline: '', lines: ['Nothing happened.'], structure: [], prose: 'Nothing happened.' },
                { place: 'Wind Turn', ambient: 'thin' });
        expect(waiting.signals).toEqual([undefined]);

        const bounded = recording();
        await new ProviderNarrator(bounded.provider, { model: 'm', timeoutMs: 5000 })
            .narrate({ headline: '', lines: ['Nothing happened.'], structure: [], prose: 'Nothing happened.' },
                { place: 'Wind Turn', ambient: 'thin' });
        expect(bounded.signals[0]).toBeInstanceOf(AbortSignal);
    });
});
