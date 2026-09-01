/**
 * A derivation is the next STAGE of a manual, not a new book.
 *
 * The user's ruling was "someone can create a new art to progress one level up
 * if their current art is dead, and the database should be updated", and the
 * correction that followed is what these guard: the manual stays the catalog
 * row it always was, and what changes is how far it has been written and by
 * whom.
 *
 * The line that makes any of it real is in `rateTermsFor`: whatever resolves
 * `techniqueCap` must compose the ceiling through `effectiveCapOf`, never read
 * `manual.cap`. The catalog's cap and the manual's real ceiling diverge the
 * moment a stage is written, and before this the rate layer only ever reached
 * the catalog.
 */

import { describe, it, expect } from 'vitest';
import { makeGame } from './harness';
import { parseIntent } from '../../src/web/actions';
import {
    grantStage,
    stagesHeldBy,
    stagesOf,
    stagesWrittenSince,
    writeStage
} from '../../src/web/stages';

/** The catalog's shortest cultivation manual, and a cultivator standing at its cap. */
const MANUAL = 'lesser-qi-gathering-manual';

async function stalledAtTheCap(seed: string) {
    const harness = makeGame({ seed });
    const { cultivator } = await harness.game.newRun('Stuck');
    harness.repos.techniques.learn(cultivator.id, MANUAL, 0.9);
    harness.db
        .prepare(
            'UPDATE cultivators SET known_techniques = ?, realm_ordinal = 13, '
            + 'spirit_stones = 500000 WHERE id = ?'
        )
        .run(JSON.stringify([MANUAL]), cultivator.id);
    return { ...harness, cultivatorId: cultivator.id };
}

describe('only runtime-written stages get rows', () => {
    it('counts nothing for a manual nobody has extended', async () => {
        const { repos } = await stalledAtTheCap('stage-count');
        // The catalog's own stages are implied by cap - requiredOrdinal and are
        // deliberately not back-filled: two representations of one fact drift.
        expect(stagesWrittenSince(repos, MANUAL)).toBe(0);
    });

    it('numbers a written stage from one and grants it to its author', async () => {
        const { repos, cultivatorId } = await stalledAtTheCap('stage-write');
        const first = writeStage(repos, {
            manualId: MANUAL, authorId: cultivatorId, onDay: 100, opacity: 0.5
        });
        expect(first.stageNumber).toBe(1);
        expect(stagesWrittenSince(repos, MANUAL)).toBe(1);
        // Writing something down and not knowing it is not a state this world
        // has, so the author is granted it in the same transaction.
        expect(stagesHeldBy(repos, cultivatorId, MANUAL)).toBe(1);

        const second = writeStage(repos, {
            manualId: MANUAL, authorId: cultivatorId, onDay: 200, opacity: 0.5
        });
        expect(second.stageNumber).toBe(2);
        expect(stagesOf(repos, MANUAL).map(s => s.stageNumber)).toEqual([1, 2]);
    });

    it('is one write for every kind of transmission', async () => {
        const { repos, cultivatorId } = await stalledAtTheCap('stage-teach');
        writeStage(repos, { manualId: MANUAL, authorId: 'author', onDay: 1, opacity: 0.5 });
        // Teaching a stage, handing over the pages, and writing one are the
        // same write. That is the model rather than a shortcut.
        expect(grantStage(repos, cultivatorId, MANUAL)).toBe(1);
        expect(stagesHeldBy(repos, cultivatorId, MANUAL)).toBe(1);
        // And nobody is ever moved backwards.
        grantStage(repos, cultivatorId, MANUAL, 0);
        expect(stagesHeldBy(repos, cultivatorId, MANUAL)).toBe(1);
    });
});

describe('a written stage moves the ceiling', () => {
    it('freezes progress at the cap, then unfreezes it', async () => {
        const { game, repos, cultivatorId } = await stalledAtTheCap('stage-lift');

        // At the manual's cap, the ladder stops crediting the years. This half
        // already worked and is asserted so the second half means something.
        const start = game.state().cultivator.cultivationProgress;
        await game.cultivate(600).catch(() => undefined);
        expect(game.state().cultivator.cultivationProgress).toBe(start);

        writeStage(repos, {
            manualId: MANUAL, authorId: cultivatorId, onDay: 100, opacity: 0.5
        });

        const before = game.state().cultivator.cultivationProgress;
        await game.cultivate(600).catch(() => undefined);
        // THE assertion. Without the `effectiveCapOf` composition in
        // `rateTermsFor` this stays frozen, and the whole feature does nothing.
        expect(game.state().cultivator.cultivationProgress).toBeGreaterThan(before);
    });

    it('does not lift a ceiling for somebody who has not got there', async () => {
        const { game, repos } = await stalledAtTheCap('stage-contiguity');
        // Somebody ELSE writes it. Contiguity: a stage past the end of the book
        // is worth nothing to somebody who has not reached the end of the book.
        writeStage(repos, {
            manualId: MANUAL, authorId: 'some-other-cultivator', onDay: 50, opacity: 0.6
        });
        expect(stagesWrittenSince(repos, MANUAL)).toBe(1);

        const before = game.state().cultivator.cultivationProgress;
        await game.cultivate(600).catch(() => undefined);
        expect(game.state().cultivator.cultivationProgress).toBe(before);
    });
});

describe('one command, three costs', () => {
    it('reads the question a player asks at a ceiling', () => {
        for (const text of [
            'how do I get further',
            'what would it take to go past this',
            'how does my manual go further'
        ]) {
            expect(parseIntent(text).action, text).toBe('acquisition');
        }
        // And does not take the sentence that funds a broke cultivator.
        expect(parseIntent('I take any work for a year').action).toBe('work');
    });

    it('prices all three routes in one free read', async () => {
        const { game } = await stalledAtTheCap('acq-routes');
        const before = game.state().run.elapsedDays;
        const result = await game.act('how do I get further');

        const routes = result.toolCalls.filter(c => c.name === 'encounters.assessAcquisition');
        expect(routes).toHaveLength(3);
        for (const route of ['found', 'taught', 'derived']) {
            expect(routes.some(r => r.summary.startsWith(route)), route).toBe(true);
        }
        // The comparison must not itself cost a decade.
        expect(game.state().run.elapsedDays).toBe(before);
    });

    it('says when the book goes further than the holder can follow it', async () => {
        const { game, repos } = await stalledAtTheCap('acq-diverge');
        writeStage(repos, {
            manualId: MANUAL, authorId: 'some-other-cultivator', onDay: 10, opacity: 0.6
        });
        const result = await game.act('how do I get further');
        // Two different numbers - the world's ceiling and this holder's - and
        // the gap between them is the whole sentence. It needs a separate
        // `writtenTo` call, because `EffectiveCap.writtenTo` reports whatever
        // stage count it was handed.
        expect(result.narration).toMatch(/goes further than you can follow it/i);
    });
});
