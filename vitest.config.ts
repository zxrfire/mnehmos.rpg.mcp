import os from 'node:os';
import { defineConfig } from 'vitest/config';

/**
 * How many test processes one run may take.
 *
 * Vitest defaults to one fork per core, which is right for the last machine
 * running the suite and wrong for this repo, where several agents routinely run
 * it at once in separate worktrees. Sixteen cores against a dozen concurrent
 * runs is two hundred forks fighting over sixteen cores, and oversubscription
 * of that size is slower than running them one after another - every fork pays
 * context-switching and memory pressure to make no progress.
 *
 * Note `maxConcurrency` below is NOT this number. It caps tests in flight
 * inside one file; it does nothing about how many files run at once, which is
 * what actually spawns processes.
 *
 * The cap is deliberately low rather than tuned, because the failure it
 * prevents is severe and the cost it imposes is a slower solo run. Override it
 * when the machine is yours alone:
 *
 *     VITEST_MAX_FORKS=16 npx vitest run
 */
const MAX_FORKS = Number(process.env.VITEST_MAX_FORKS)
  || Math.max(2, Math.min(4, Math.floor(os.cpus().length / 4)));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
        isolate: true,
        // Both, not just the max: this pool maps onto tinypool's min/max
        // threads, and a max below the default minimum is rejected outright
        // with "options.minThreads and options.maxThreads must not conflict".
        minForks: 1,
        maxForks: MAX_FORKS,
      }
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    // Memory management
    maxConcurrency: 4,
    fileParallelism: true,
    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/api/**'] // Excluded from build anyway
    }
  }
});
