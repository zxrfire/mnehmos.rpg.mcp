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
import { parseAdminCommand } from '../../src/server/consolidated/admin-manage';

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
        const files = ['src/web/turn-engine.ts', 'src/web/actions.ts', 'src/web/hearsay.ts'];
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

/**
 * The argument grammar.
 *
 * Found by playing, and it was the worst defect on the surface: the command
 * line was split on whitespace and a value taken up to the next space, so
 * `location=The Dead Verge` set the location to "The" and quoting it set it to
 * `"The`. MOST OF THIS WORLD'S GAZETTEER IS MULTI-WORD - The Dead Verge, Nine
 * Peaks, The Low Fall, The Drowned Reach, The Salt Fields - so most of the map was
 * unreachable from the admin surface and no environmental gating could be
 * exercised at all.
 */
describe('an ADMIN value runs to the next key, not to the next space', () => {
    it('takes a bare multi-word value whole', () => {
        expect(parseAdminCommand('set_location location=The Dead Verge')).toEqual({
            action: 'set_location',
            args: { location: 'The Dead Verge' }
        });
    });

    it('takes a quoted value and keeps no quotes', () => {
        for (const line of [
            'set_location location="The Dead Verge"',
            "set_location location='The Dead Verge'"
        ]) {
            expect(parseAdminCommand(line).args.location).toBe('The Dead Verge');
        }
    });

    it('still splits several pairs on one line', () => {
        expect(parseAdminCommand('spawn_site ordinal=41 kind=grave')).toEqual({
            action: 'spawn_site',
            args: { ordinal: 41, kind: 'grave' }
        });
    });

    it('ends a multi-word value at the next key rather than swallowing it', () => {
        expect(parseAdminCommand('spawn_site name=The Glass Where the Count Stopped ordinal=42'))
            .toEqual({
                action: 'spawn_site',
                args: { name: 'The Glass Where the Count Stopped', ordinal: 42 }
            });
    });

    it('coerces only what is entirely a number or a flag', () => {
        const { args } = parseAdminCommand('x a=41 b=abc-123 c=true d=false e=Nine Peaks');
        expect(args).toEqual({
            a: 41, b: 'abc-123', c: true, d: false, e: 'Nine Peaks'
        });
    });

    it('answers a bare command with an action and no arguments', () => {
        expect(parseAdminCommand('roster')).toEqual({ action: 'roster', args: {} });
        expect(parseAdminCommand('')).toEqual({ action: '', args: {} });
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
            expect(result.narration).toMatch(/site revealed/i);
            expect(result.narration).toMatch(/tribulation transcendence/i);
            // ADMIN bypasses gates, not truth. The gate lifted is awareness -
            // the site itself is a real catalogued one and every bar inside it
            // still stands. It used to write an invented row into
            // `cultivation_sites` that no player-facing path has ever read.
            expect(result.narration).toMatch(/awareness gate lifted/i);
            expect(result.narration).toMatch(/every gate inside this site still stands/i);
            // And the whole internal state object no longer lands in the log.
            expect(result.narration).not.toContain('ADMIN_MANAGE_JSON');
            expect(result.narration).toMatch(/out of world/i);
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
