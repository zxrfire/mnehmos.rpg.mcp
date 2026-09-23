import { defineConfig } from 'vitest/config';

/**
 * The probes, which are not tests.
 *
 * A probe runs whole worlds for centuries and reports numbers; it asserts
 * almost nothing and it takes as long as it takes. That is the opposite of what
 * the suite is for, so probes are named `*.probe.ts` and live under `scripts/`,
 * where `vitest.config.ts` (`include: tests/**\/*.test.ts`) cannot reach them.
 * They run only when somebody asks for them by this config:
 *
 *     npx vitest run --config vitest.probe.config.ts
 *
 * One process, because a probe is the heavy thing on the machine while it runs
 * and two of them are slower than one after the other.
 */
export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./tests/setup.ts'],
        include: ['scripts/**/*.probe.ts'],
        exclude: ['node_modules', 'dist'],
        pool: 'forks',
        poolOptions: { forks: { singleFork: true, isolate: true, minForks: 1, maxForks: 1 } },
        // A probe reports rather than asserts, and it is watched by a person.
        testTimeout: 6 * 60 * 60_000,
        hookTimeout: 60_000,
        reporters: ['basic']
    }
});
