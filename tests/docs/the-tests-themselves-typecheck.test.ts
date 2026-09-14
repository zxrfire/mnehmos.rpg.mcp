/**
 * A ratchet on the trees nothing used to typecheck.
 *
 * `tsconfig.json` excludes `tests`, and vitest runs through esbuild, which
 * strips types without checking them. So for most of this repo's life a test
 * file was checked by NEITHER command anybody ran, and a type error in one was
 * invisible in both directions. `scripts/` was in the same position: not in
 * `include`, never compiled, only ever executed.
 *
 * WHAT THE GAP ACTUALLY COST, measured rather than supposed:
 *
 *   `TEST_PROVIDER_STATUS`      `ProviderStatus` grew three fields and the
 *                               literal in the shared web harness - imported by
 *                               every played test - was never updated. Broken,
 *                               and green the whole time.
 *   `ConfrontationIntent.goal`  The field was replaced by `thrown` and 24 call
 *                               sites across `scripts/` and `tests/` kept
 *                               passing `{ goal: 'kill' }`. The engine has not
 *                               read `goal` since; every one of those fights
 *                               silently resolved as the bare swing.
 *   `KnownEntityKind`           Deleting a member of the union turned no test
 *                               red, because the tests that would have caught
 *                               it were not typechecked.
 *
 * The first two are the shape this ratchet exists for: a shape moved in `src/`,
 * the callers did not, and nothing anywhere said so. A test that compiles is
 * not a test that typechecks, and a test asserting against a fixture the engine
 * would never produce is worse than no test.
 *
 * THE NUMBER MAY FALL AND MAY NOT RISE. It was 733 when `tsconfig.all.json` was
 * first pointed at both trees, and the whole of that was worked off in one
 * pass. When this goes red the fix is to make the new file typecheck, never to
 * raise the ceiling: at zero, the ceiling is the rule.
 *
 * WHY IT IS A TEST AND NOT ONLY AN NPM SCRIPT. `npm run typecheck:all` exists
 * and is the thing to run while working. But a command nobody is required to
 * run is how this rotted the first time - the config in AGENTS.md had been
 * written down and deliberately left unwired, and the count went from 521 to
 * 733 in the interval. A ratchet is what makes it somebody's problem on the
 * commit that breaks it rather than a year later.
 *
 * It costs about twenty seconds, which is the price of the guarantee.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Measured, not chosen. Lower it when you fix something; never raise it.
 *
 * Zero is the honest ceiling here, unlike the other ratchets in this directory:
 * an unwired export can legitimately be design stated as data, but a type error
 * in a test is always a test that has drifted from the engine it is checking.
 */
const CEILING = 0;

/**
 * ONE SLOT, HELD OPEN BY NAME, FOR A SCRIPT THAT CANNOT BE FIXED FROM HERE.
 *
 * `scripts/seed-bastion.ts` seeds the second game in this repo - the one under
 * `docs/bastion/`, which shares the tree and nothing else - and it imports
 * `src/server/consolidated/character-manage.js`, deleted in `ab59a6c4` on 31
 * August. There is no replacement handler: `character-record.ts` exports a
 * record builder of a different shape, not a tool handler. So the script has
 * been unrunnable since that commit - it throws at import resolution, before a
 * line of it executes - and the 1,391 lines behind the import are D&D-shaped
 * throughout (`race`, `class`, `level`, `ac`, `provisionEquipment`), from
 * before the cultivation transformation.
 *
 * Making it typecheck means writing a new integration, which is a meaning
 * change and not a type fix; deleting it is the owner's call, not this test's.
 * So it is EXEMPTED BY NAME rather than absorbed into the ceiling, which is
 * the important part: the count above still has to be zero for everything
 * else, so a new error here cannot hide behind a ceiling of one.
 *
 * The second assertion below fails when this stops being true, which is the
 * signal to delete this constant rather than to keep it.
 */
const THE_ONE_THING_A_TYPE_FIX_CANNOT_REACH = 'scripts/seed-bastion.ts';

/** How long tsc gets. It is a whole-tree check, not a unit test. */
const A_GENEROUS_WAIT = 240_000;

interface Finding {
    file: string;
    line: string;
}

/**
 * Every `error TS…` line the config reports, as file plus message.
 *
 * tsc exits non-zero whenever it found anything, so the output has to be read
 * off the thrown error as well as off a clean return - a `catch` that swallows
 * it would report a green tree for a tree that did not compile at all.
 */
function typeErrors(): Finding[] {
    let output: string;
    try {
        output = execFileSync(
            process.execPath,
            ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'tsconfig.all.json'],
            { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 }
        );
    } catch (err) {
        const failure = err as { stdout?: string; stderr?: string };
        output = (failure.stdout ?? '') + (failure.stderr ?? '');
    }
    return output
        .split('\n')
        .map(line => line.trim())
        .filter(line => / error TS\d+:/.test(line))
        .map(line => ({ file: line.split('(')[0], line }));
}

describe('the tests and the scripts typecheck', () => {
    /**
     * Read once and shared, because tsc is the expensive part of this file and
     * running it three times would triple what the guarantee costs.
     */
    const all = typeErrors();

    it('holds no type errors in tests/ or scripts/', () => {
        const found = all.filter(f => f.file !== THE_ONE_THING_A_TYPE_FIX_CANNOT_REACH);
        const byFile = found.reduce(
            (acc, f) => acc.set(f.file, (acc.get(f.file) ?? 0) + 1),
            new Map<string, number>()
        );
        const worst = [...byFile.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([file, n]) => `\n  ${n}  ${file}`)
            .join('');
        expect(
            found.length,
            `Type errors outside src/ rose above ${CEILING}. Run \`npm run typecheck:all\`. `
            + 'Fix the caller to build what the engine actually takes - do not reach for '
            + '`as any` or `@ts-expect-error`, and do not widen a type in src/ to accommodate '
            + `a wrong test.${worst}`
        ).toBeLessThanOrEqual(CEILING);
    }, A_GENEROUS_WAIT);

    /**
     * An exemption nobody takes away is indistinguishable from the rot this
     * file exists to catch, so the slot reports when it is no longer needed.
     */
    it('still needs the one exemption it holds open', () => {
        expect(
            all.some(f => f.file === THE_ONE_THING_A_TYPE_FIX_CANNOT_REACH),
            `${THE_ONE_THING_A_TYPE_FIX_CANNOT_REACH} typechecks now. Delete `
            + 'THE_ONE_THING_A_TYPE_FIX_CANNOT_REACH and the filter that uses it, so the '
            + 'next error in that file goes red like any other.'
        ).toBe(true);
    });

    /**
     * The ratchet above is only worth what the config under it is worth. A
     * `tsconfig.all.json` that had quietly stopped covering `tests` would pass
     * every run while checking nothing, which is the exact failure this whole
     * file exists to end.
     */
    it('keeps both untypechecked trees inside the config that checks them', () => {
        const config = JSON.parse(readFileSync('tsconfig.all.json', 'utf-8')) as {
            include?: string[];
            exclude?: string[];
        };
        const covers = (tree: string) =>
            (config.include ?? []).some(pattern => pattern.startsWith(tree + '/'));
        expect(covers('tests'), 'tsconfig.all.json stopped covering tests/').toBe(true);
        expect(covers('scripts'), 'tsconfig.all.json stopped covering scripts/').toBe(true);
        expect(covers('src'), 'tsconfig.all.json stopped covering src/').toBe(true);
        expect(config.exclude ?? [], 'tsconfig.all.json must not re-exclude a tree').toEqual([]);
    });

    /**
     * And it has to be reachable by name. Somebody arriving at a red run needs
     * the command that reproduces it, and a config with no script in front of
     * it is a config nobody finds.
     */
    it('is reachable as an npm script', () => {
        const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as {
            scripts?: Record<string, string>;
        };
        expect(pkg.scripts?.['typecheck:all']).toContain('tsconfig.all.json');
    });
});
