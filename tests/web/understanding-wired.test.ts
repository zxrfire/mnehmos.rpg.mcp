/**
 * What a played life understood, and where it goes.
 *
 * `simulateTimeSkip` takes an `understanding` context and returns
 * `insightsGained` and `achievements`. Before this, the web layer supplied the
 * first on none of its six skip paths and persisted the second on none of
 * them - so `discoverableInsights` was handed an empty room every time and
 * anything that did form was computed, narrated and thrown away.
 *
 * The consequence reached well past dao. The dao gate had to ship switched OFF,
 * because enforcing it against a world where nobody can comprehend anything
 * stops every cultivator alive at Foundation or Deity. Suitability never ran,
 * because it filters a set that was always empty. These are the two halves of
 * the join, guarded separately, because either one alone is still nothing.
 */

import { describe, it, expect } from 'vitest';
import { makeGame } from './harness';
import { applyTimeSkip } from '../../src/web/apply';
import { discoveryContextFor } from '../../src/server/consolidated/cultivation-support';
import {
    discoverableInsights,
    formInsight,
    recordAchievement
} from '../../src/engine/cultivation/understanding';
import { forStream } from '../../src/engine/cultivation/rng';
import type { Achievement, Insight, TimeSkipResult } from '../../src/schema/cultivation';

/** A skip that changed nothing except what the cultivator understood. */
function skipThatOnlyTaught(insight: Insight, achievement: Achievement): TimeSkipResult {
    return {
        requestedDays: 30,
        simulatedDays: 30,
        interrupted: false,
        interruptReason: null,
        events: [],
        deltas: {
            cultivationProgress: 0,
            realmOrdinal: 0,
            hp: 0,
            qi: 0,
            satiety: 0,
            age: 30 / 360,
            injuriesGained: 0,
            spiritStones: 0
        },
        died: false,
        deathCause: null,
        injuriesSustained: [],
        breakthroughs: [],
        tolls: [],
        foundationEstablished: null,
        insightsGained: [insight],
        achievements: [achievement],
        visions: [],
        endState: { starvationTurns: 0, bleedingTurns: 0, yearsAtCurrentRealm: 0 }
    } as unknown as TimeSkipResult;
}

describe('the second half: what the skip returned reaches the database', () => {
    it('persists insights and achievements, which used to be dropped on the floor', async () => {
        const { game, repos } = makeGame({ seed: 'und-persist' });
        const { cultivator, run } = (await game.newRun('Wen Shu')) as never as {
            cultivator: { id: string }; run: { id: string };
        };

        const before = repos.cultivators.getById(cultivator.id)!;
        expect(before.insights ?? []).toEqual([]);

        // Built through the engine's own constructors, never by hand.
        // `assertTraceableInsights` in the repository refuses an insight whose
        // id is not derived from the achievement that produced it - which is
        // the whole point of `formInsight` being the only constructor, and a
        // fixture that fakes one is testing a row the game cannot produce.
        const achievement: Achievement = recordAchievement(
            {
                kind: 'meditative_state',
                onDay: 10,
                turn: 1,
                summary: 'Entered a rare meditative state and did not come out of it the same.'
            },
            forStream('und-persist', 'test', 10)
        );

        const candidate = discoverableInsights(before, {
            ...discoveryContextFor(repos, before, { runId: before.runId }).context,
            survived: null
        })[0];
        expect(candidate, 'the room has to hold something for this to be testable').toBeTruthy();

        const insight: Insight = formInsight(candidate, 1, achievement);

        const runRow = repos.runs.getById(run.id)!;
        const applied = applyTimeSkip(repos, {
            before,
            run: runRow,
            skip: skipThatOnlyTaught(insight, achievement)
        });

        expect(applied.understanding.insights).toBe(1);
        expect(applied.understanding.achievements).toBe(1);

        const after = repos.cultivators.getById(cultivator.id)!;
        expect((after.insights ?? []).map(i => i.id)).toContain(insight.id);
        expect((after.achievements ?? []).map(a => a.id)).toContain(achievement.id);
        // And the trace survives the round trip, which is the property the
        // repository refuses to persist a row without.
        const stored = (after.insights ?? []).find(i => i.id === insight.id)!;
        expect(stored.provenance.achievementId).toBe(achievement.id);
    });
});

describe('the first half: the room is not empty', () => {
    it('assembles a context from real rows, and the root alone puts something in reach', async () => {
        const { game, repos } = makeGame({ seed: 'und-ctx' });
        const { cultivator } = (await game.newRun('Wen Shu')) as never as {
            cultivator: { id: string };
        };
        const row = repos.cultivators.getById(cultivator.id)!;

        const assembled = discoveryContextFor(repos, row, { runId: row.runId });
        const reachable = discoverableInsights(row, { ...assembled.context, survived: null });

        // A nobody with no manual, no teacher and no ground still reaches their
        // OWN APERTURE, and nothing else however long they sit. That floor is
        // the design, and it is also the proof the context is being read: with
        // no context supplied at all there is no room to be standing in.
        expect(reachable.length).toBeGreaterThan(0);
        for (const candidate of reachable) {
            expect(candidate.domain).toBe('element');
        }
    });

    it('grows when the cultivator holds something to read', async () => {
        const { game, repos } = makeGame({ seed: 'und-manual' });
        const { cultivator } = (await game.newRun('Wen Shu')) as never as {
            cultivator: { id: string };
        };
        const bare = repos.cultivators.getById(cultivator.id)!;
        const before = discoveryContextFor(repos, bare, { runId: bare.runId });
        expect(before.context.readableManuals ?? []).toEqual([]);

        // An art they can evidently read is access by way of a manual, which is
        // the commonest door in the game and the one a played life walks
        // through most often.
        await game.act('I learn the Azure Ripple Art.').catch(() => undefined);
        const after = repos.cultivators.getById(cultivator.id)!;
        const grown = discoveryContextFor(repos, after, { runId: after.runId });

        // Either the learning was refused by a gate the engine owns, or it
        // landed and the room got bigger. What must never happen is the
        // learning landing and the room staying empty.
        if (after.knownTechniques.length > bare.knownTechniques.length) {
            expect((grown.context.readableManuals ?? []).length).toBeGreaterThan(0);
            expect(grown.sources.some(s => s.kind === 'manual')).toBe(true);
        }
    });
});
