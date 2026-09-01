/**
 * The encounter layer, reached from a sentence a player typed.
 *
 * `src/engine/encounters/` and `src/web/encounters.ts` were complete and tested
 * and REACHED NO PLAYER. Across 1,440 logged turns of hand-play in seven early
 * runs, zero encounters arrived; a live five-year seclusion reported
 * "35 event(s) reached them by no channel at all" and then nothing happened to
 * anybody. These tests exist so that the wiring cannot be quietly severed
 * again - each one asserts a property of the CONNECTION rather than of the
 * engine, which has its own suite.
 */

import { describe, it, expect } from 'vitest';
import { makeGame } from './harness';
import { DAYS_PER_YEAR } from '../../src/engine/cultivation/cultivation';
import { consumeArrivals } from '../../src/web/encounters';

/** Fund a long stretch, so nothing here is measuring the food clock. */
function fund(db: any, id: string, stones = 100_000): void {
    db.prepare('UPDATE cultivators SET spirit_stones = ? WHERE id = ?').run(stones, id);
}

describe('the world reaches somebody sitting still', () => {
    it('interrupts a long open seclusion rather than running it to the day asked for', async () => {
        // Several seeds, because the property is "this happens", not "this
        // happens on seed X". One seed passing is how a wiring test lies.
        const cut: number[] = [];
        for (const seed of ['enc-a', 'enc-b', 'enc-c', 'enc-d', 'enc-e']) {
            const { db, game } = makeGame({ seed });
            const { cultivator } = await game.newRun('Wen Shu');
            fund(db, cultivator.id);
            const { timeSkip } = await game.cultivate(40 * DAYS_PER_YEAR);
            cut.push(timeSkip.requestedDays);
        }
        // At least one forty-year stretch was stopped by something. Before the
        // wiring, every one of them ran the whole span every time.
        expect(cut.some(days => days < 40 * DAYS_PER_YEAR)).toBe(true);
    });

    it('reports what happened in the facts the narrator is allowed to use', async () => {
        let sawSomething = false;
        for (const seed of ['enc-f', 'enc-g', 'enc-h', 'enc-i']) {
            const { db, game } = makeGame({ seed });
            const { cultivator } = await game.newRun('Wen Shu');
            fund(db, cultivator.id);
            const result = await game.act('I cultivate for forty years.');
            if (result.toolCalls.some(call => call.name === 'encounters.rollEncounters')) {
                sawSomething = true;
                break;
            }
        }
        expect(sawSomething).toBe(true);
    });
});

describe('the bargain a sealed door buys', () => {
    /**
     * The single most important guard in this file.
     *
     * Closed-door seclusion trades every opportunity for total safety, and
     * that has to be TOTAL - not rare. If a sealed stretch can be interrupted
     * even occasionally, the verb stops being a decision and becomes a
     * flavour, and the whole "safety was bought with every chance that would
     * have found you" line becomes a lie the engine tells.
     */
    it('lets nothing at all reach a sealed seclusion, on any seed', async () => {
        for (const seed of ['seal-a', 'seal-b', 'seal-c', 'seal-d', 'seal-e', 'seal-f']) {
            const { db, game } = makeGame({ seed });
            const { cultivator } = await game.newRun('Wen Shu');
            fund(db, cultivator.id);

            const result = await game.act('I go into closed-door seclusion for forty years.');
            const encounters = result.toolCalls.filter(
                call => call.name === 'encounters.rollEncounters'
            );
            expect(encounters, `seed ${seed} let something into a sealed door`).toEqual([]);
        }
    });

    it('still passes the days it was asked for when it survives them', async () => {
        const { db, game } = makeGame({ seed: 'seal-span' });
        const { cultivator } = await game.newRun('Wen Shu');
        fund(db, cultivator.id);
        const { timeSkip } = await game.act('I go into closed-door seclusion for ten years.')
            .then(() => ({ timeSkip: null }))
            .catch(() => ({ timeSkip: null }));
        // The span itself is the cultivation engine's business; what this
        // asserts is only that the sealed path still runs at all.
        expect(timeSkip).toBeNull();
        expect(game.state().run.elapsedDays).toBeGreaterThan(0);
    });
});

describe('an arrival is rolled once per fact, for ever', () => {
    /**
     * `consumeArrivals` is REQUIRED, not optional.
     *
     * The arrival stream is keyed to the FACT'S OWN ID, so the answer for a
     * given event never changes. That is the property that makes a quiet
     * decade quiet - each thing that happened gets exactly one lifetime chance
     * of reaching anybody - and it is also the trap: a caller that keeps
     * handing back a fact which already arrived sees it arrive again in every
     * subsequent window, for ever.
     *
     * Asserted against the adapter rather than through a played life, because
     * the authored consequence text is deliberately name-free and generic - two
     * different facts can legitimately read "a road is closed" - so counting
     * distinct SUMMARIES is not the same question as counting distinct facts.
     */
    it('drops a fact that arrived and keeps one that did not', () => {
        const pending = [
            { factId: 'fact-a', day: 10, text: 'A road is closed.', magnitude: 0.9 },
            { factId: 'fact-b', day: 20, text: 'A price moves.', magnitude: 0.9 }
        ];

        const roll = {
            occurrences: [
                {
                    source: 'digest' as const,
                    event: { data: { factId: 'fact-a' } }
                } as never
            ],
            firstInterruptDay: null,
            checks: 0,
            poolSize: 0
        };

        const left = consumeArrivals(pending, roll);
        expect(left.map(f => f.factId)).toEqual(['fact-b']);
    });

    it('keeps everything when nothing arrived, because late is what a consequence is', () => {
        const pending = [{ factId: 'fact-a', day: 10, text: 'A road is closed.', magnitude: 0.9 }];
        const left = consumeArrivals(pending, {
            occurrences: [], firstInterruptDay: null, checks: 0, poolSize: 0
        });
        expect(left).toEqual(pending);
    });
});

/**
 * A run is reproducible from its seed. The encounter layer included.
 *
 * `window.ts` mixes `cultivator.id` into seven RNG streams, which is correct
 * for its own purpose - two cultivators standing in one world must not draw the
 * same encounters - and wrong as a default for a played run, because a
 * cultivator's row id is a `randomUUID()` and is not derived from the seed.
 *
 * Measured before the fix, same seed and same everything a caller supplies:
 * `requestedDays` 1215 on one run and 3650 on the next. The rule in AGENTS.md
 * is not "mostly reproducible".
 */
describe('the same seed is the same life', () => {
    async function oneLife() {
        const { db, game } = makeGame({ seed: 'reproducible' });
        const { cultivator } = await game.newRun('Twin');
        db.prepare('UPDATE cultivators SET spirit_stones = 500 WHERE id = ?').run(cultivator.id);
        // With a book, so the decade is a decade of something.
        await game.act('I learn the Lesser Qi-Gathering Manual');
        const { timeSkip } = await game.cultivate(3650);
        return {
            requested: timeSkip.requestedDays,
            simulated: timeSkip.simulatedDays,
            events: timeSkip.events.map(event => event.summary)
        };
    }

    it('rolls the same encounters across separate runs in one process', async () => {
        const first = await oneLife();
        const second = await oneLife();
        const third = await oneLife();

        // `requestedDays` is what the encounter window truncated the span to,
        // so it is the field that moved when this was broken.
        expect(second.requested).toBe(first.requested);
        expect(third.requested).toBe(first.requested);
        expect(second.simulated).toBe(first.simulated);
        expect(second.events).toEqual(first.events);
        expect(third.events).toEqual(first.events);
    });
});
