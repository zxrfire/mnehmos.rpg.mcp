import { defineConfig } from 'vitest/config';

/**
 * The readings that ask a live model, which are not gates.
 *
 * Everything under `tests/` drives the deterministic table: the same sentence
 * gives the same verb on any machine, and a red result is a defect somebody
 * put there. A reading that asks the local model is a different kind of
 * measurement. It can move because a sampler landed differently, because the
 * model on the box was swapped, or because the machine was loaded - and none of
 * those is a defect in this repo. Left in the ordinary suite it teaches
 * everybody to read a red suite as noise, which is how a real failure gets
 * waved through.
 *
 * So these are named `*.model.ts` and `vitest.config.ts`
 * (`include: tests/**\/*.test.ts`) cannot reach them. They run when somebody
 * asks:
 *
 *     npx vitest run --config vitest.model.config.ts
 *
 * WHEN TO ASK, which is the useful half: whenever the verb surface or the
 * intent prompt changes. The model's input is `INTENT_SYSTEM_PROMPT`, and that
 * prompt is derived from the verb surface - including the partition of verbs
 * into the ones that cost the asker something and the ones that do not. Change
 * either and the model is reading a different document.
 *
 * Measured, the night this config was written: two verbs that spend no day
 * (`carry` and `conceal`) stopped being priced as acts, which moved them across
 * that partition, and one sentence of the corpus came back routed somewhere
 * else. That is a signal about a changed input and worth reading. It is not a
 * failure to fix, and nobody should touch the engine to satisfy a sampler.
 *
 * One process, because a local model is the heavy thing on the machine while it
 * answers and two callers are slower than one after the other.
 */
export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./tests/setup.ts'],
        include: ['tests/**/*.model.ts'],
        exclude: ['node_modules', 'dist'],
        pool: 'forks',
        poolOptions: { forks: { singleFork: true, isolate: true, minForks: 1, maxForks: 1 } },
        // A model answers at its own speed, and it is watched by a person.
        testTimeout: 30 * 60_000,
        hookTimeout: 60_000,
        reporters: ['basic']
    }
});
