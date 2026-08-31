/**
 * ADMIN, spoken in play.
 *
 * Found by playing: `admin_manage` had existed for a long time with all nine
 * actions built and audited, `ADMIN_MODE` gated the roster and ladder-odds
 * endpoints, and typing ADMIN into the game did nothing at all. The operator
 * surface context.md describes was reachable from an MCP client and not from
 * the thing the user actually plays.
 *
 * The bug underneath was worse than the gap. The prefix pattern was written
 * through a shell heredoc that ate the escape, so `\b` reached the file as a
 * literal backspace byte (0x08) and the regex quietly matched nothing. It
 * typechecked, it built, and it was invisible in every diff. The same trap had
 * already cost another pass its own guard earlier in the day.
 *
 * So these tests pin two different things: that the surface works, and that the
 * pattern is made of the characters it looks like it is made of.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { makeGame } from './harness';

/** ADMIN_MODE is read at call time, so a test can turn it on and put it back. */
async function withAdmin<T>(on: boolean, fn: () => Promise<T>): Promise<T> {
    const before = process.env.ADMIN_MODE;
    process.env.ADMIN_MODE = on ? 'true' : 'false';
    try {
        return await fn();
    } finally {
        if (before === undefined) delete process.env.ADMIN_MODE;
        else process.env.ADMIN_MODE = before;
    }
}

describe('the ADMIN prefix is made of the characters it appears to be made of', () => {
    // The failure this guards against does not show up in a diff, in tsc, or in
    // a review: a control character sits where an escape was meant to be and the
    // line still reads correctly to a human.
    it('carries no control characters anywhere in the web layer', () => {
        const files = ['src/web/game.ts', 'src/web/actions.ts', 'src/web/hearsay.ts'];
        for (const file of files) {
            const text = readFileSync(file, 'utf8');
            // Tab, newline and carriage return are the only ones that belong.
            const bad = [...text].filter(c => {
                const code = c.charCodeAt(0);
                return code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d;
            });
            expect(bad, `${file} carries ${bad.length} control character(s)`).toEqual([]);
        }
    });
});

describe('ADMIN is answered before the narrator sees it', () => {
    it('lists the actions when told nothing else', async () => {
        await withAdmin(true, async () => {
            const { game } = makeGame({ seed: 'admin-bare' });
            await game.newRun('Op');
            // A bare ADMIN is a malformed command, not a turn, so it is
            // refused the way the rest of the surface refuses bad input - and
            // the refusal carries the menu rather than a guess at what was
            // meant. Guessing is the affordance this whole surface avoids.
            await expect(game.act('ADMIN')).rejects.toThrow(/spawn_site/);
            await expect(game.act('ADMIN')).rejects.toThrow(/key=value/i);
        });
    });

    it('lifts a content gate and really persists the result', async () => {
        await withAdmin(true, async () => {
            const { game } = makeGame({ seed: 'admin-grave' });
            const { cultivator } = await game.newRun('Op');
            // The example from context.md: the player is at the bottom of the
            // ladder and asks for the grave of somebody at the top.
            expect(cultivator.realmOrdinal).toBe(0);

            const result = await game.act('ADMIN: spawn_site kind=grave ordinal=41');
            expect(result.narration).toMatch(/site spawned/i);
            expect(result.narration).toMatch(/tribulation transcendence/i);
            // ADMIN bypasses gates, not truth: the engine made a real thing.
            expect(result.narration).toMatch(/persisted|real/i);
        });
    });

    it('never reaches the narrator, so it cannot be improvised', async () => {
        await withAdmin(true, async () => {
            const { game } = makeGame({ seed: 'admin-unnarrated' });
            await game.newRun('Op');
            const result = await game.act('ADMIN roster');
            // Phase 1 and phase 3 are both skipped. If a plan or a narration
            // call shows up here, the operator is reading a model's account of
            // what the engine did rather than the engine's own.
            expect(result.toolCalls).toEqual([]);
        });
    });

    it('is refused, with the reason, when the process did not enable it', async () => {
        await withAdmin(false, async () => {
            const { game } = makeGame({ seed: 'admin-off' });
            await game.newRun('Op');
            await expect(game.act('ADMIN roster')).rejects.toThrow(/ADMIN_MODE=true/);
        });
    });
});

describe('the word is not the prefix', () => {
    it('leaves an ordinary sentence that mentions admin alone', async () => {
        await withAdmin(true, async () => {
            const { game } = makeGame({ seed: 'admin-prose' });
            await game.newRun('Op');
            const result = await game.act('the admin of the sect refused me');
            // It matches at the head only, and only as a whole word. A sentence
            // about somebody's clerk is a turn, not a tool surface.
            expect(result.narration).not.toMatch(/spawn_site/);
            expect(result.toolCalls.length).toBeGreaterThan(0);
        });
    });

    it('does not fire on a word that merely starts with it', async () => {
        await withAdmin(true, async () => {
            const { game } = makeGame({ seed: 'admin-prefixword' });
            await game.newRun('Op');
            const result = await game.act('administer the pill to him');
            expect(result.narration).not.toMatch(/spawn_site/);
        });
    });
});
