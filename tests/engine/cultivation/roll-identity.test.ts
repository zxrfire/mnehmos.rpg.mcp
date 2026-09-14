/**
 * Determinism guard: a seed is a life.
 *
 * Every measurement this project has produced rests on this holding - the apex
 * standoff sweep, the origin-outcome distributions, the road study, the drift
 * audit. If a per-cultivator draw keys on a value the seed does not determine,
 * none of those are reproducible.
 *
 * THE DEFECT. Four draws in `time-skip.ts` keyed on `cultivator.id`: the latent
 * affinity behind prodigy recognition, the recognition gate, the narrowed pick
 * among candidates, and the 0.2 suitability draw that decides which
 * comprehensions are takeable at all. A played run's row id is a `randomUUID()`,
 * so the same seed produced different prodigies, different roads and different
 * comprehension - which now feeds the dao gate, suitability, and every escape
 * route keyed on standing.
 *
 * It was LATENT rather than new: until `ctx.understanding` was populated the
 * candidate set was always empty and nothing downstream of it ran. So these
 * tests populate it, and the fixture is deliberately extreme - ordinal 28, rich
 * ground, five hundred years - because the meditative-state chance is about
 * 1.8% per 360-day check and a shorter run comprehends nothing at all.
 * A determinism test over an empty candidate set passes against broken code,
 * which is precisely how this survived as long as it did.
 *
 * ── AND IT WAS ONE DRAW FROM BEING VACUOUS AGAIN ─────────────────────────
 *
 * The context used to be written `as Parameters<typeof simulateTimeSkip>[2]`,
 * which hid two things: it named `ambient: 'spirit_tide'`, a field the context
 * lost when the qi of a place became a fact about the PLACE, and it passed no
 * `locationId` at all although one is required. When the tests were first
 * typechecked and a real `locationId` went in, two tests went red and three
 * stayed green while asserting nothing.
 *
 * MEASURED, five hundred years at ordinal 28 with the full access below,
 * counting insights gained per roll identity:
 *
 *   no locationId (what this file actually ran on)   every key 1, `player` 2
 *   locationId + `locationDensity: 1`                every key 0, `player` 1
 *
 * So the whole file rests on a SINGLE draw landing, and `comprehension()`
 * returns `''` when it does not. Three of the assertions here are `toBe`
 * comparisons, and `'' === ''` is green - which is the same shape as the
 * original defect, arrived at from the other side. The guard test below used
 * to prove the draws run for ONE roll identity, and the keys the other tests
 * compare were never covered by it. It now proves it for every key this file
 * uses, so a stream that reshuffles cannot quietly empty the file again.
 *
 * The richest ground returning FEWER comprehensions than an ordinary one is
 * not a claim this file makes - at roughly one draw per run the count is too
 * coarse to say anything, and it is recorded here only as the reason the
 * density is left to the location rather than forced to the ceiling.
 */

import { describe, it, expect } from 'vitest';

import { simulateTimeSkip } from '../../../src/engine/cultivation/time-skip.js';
import type { DiscoveryContext } from '../../../src/engine/cultivation/understanding.js';
import { makeCultivator } from './fixtures.js';

/** Enough access that the candidate set is non-empty and the draws actually run. */
const UNDERSTANDING: Omit<DiscoveryContext, 'survived'> = {
    readableManuals: [
        { element: 'water', subject: 'the tides', label: 'a water canon' },
        { element: 'metal', subject: 'the sword', label: 'a sword manual' },
        { element: 'wood', subject: 'growth', label: 'a wood treatise' }
    ],
    teachers: [{ element: 'ice', subject: 'stillness', label: 'an ice elder' }],
    artifacts: [{ element: 'lightning', subject: 'the storm', label: 'a storm relic' }],
    locationTags: ['ancient-battlefield'],
    techniqueSubjects: ['the sword']
};

const FIVE_HUNDRED_YEARS = 182625;

function live(rowId: string, rollIdentity?: string) {
    return simulateTimeSkip(
        makeCultivator({
            id: rowId,
            realmOrdinal: 28,
            attributes: { might: 2, insight: 4, fortune: 1, charm: 2 }
        }),
        FIVE_HUNDRED_YEARS,
        {
            seed: 'one-seed-one-life',
            // `ambient` left the context when the qi of a place became a fact
            // about the place; it named `spirit_tide` here and was ignored.
            // `locationDensity` is deliberately NOT stated: the site's implied
            // density is the path this file has always run on, and forcing it
            // to the 0..1 ceiling is what emptied the draws. See the header.
            locationId: 'a-plain-room',
            grainAbstinence: true,
            randomEvents: false,
            autoBreakthrough: false,
            understanding: UNDERSTANDING,
            ...(rollIdentity === undefined ? {} : { rollIdentity })
        }
    );
}

/** What the cultivator turned out to have comprehended. The thing that diverged. */
function comprehension(result: ReturnType<typeof simulateTimeSkip>): string {
    return result.insightsGained
        .map(i => `${i.domain}:${i.subject}:${i.degree}`)
        .join(' | ');
}

describe('a seed is a life, whatever the row id happens to be', () => {
    it('the draws it protects are actually running, or this guard proves nothing', () => {
        // Asserted FIRST and deliberately: every other test in this file is
        // vacuously true against broken code if the candidate set is empty.
        //
        // EVERY KEY, not just one. The single-key version of this guard sat
        // green while three of the assertions below compared '' to '' - the
        // keys they use were never the key it checked. See the header.
        for (const [rowId, rollIdentity] of [
            ['row-A', 'player'], ['row-A', 'first'], ['row-A', 'second'], ['row-A', 'k'],
            ['row-B', 'k'], ['row-A', undefined], ['row-B', undefined],
            ['catalog-npc', undefined],
            ['6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'player'],
            ['f81d4fae-7dec-11d0-a765-00a0c91e6bf6', 'player']
        ] as const) {
            expect(
                live(rowId, rollIdentity).insightsGained.length,
                `${rowId} / ${rollIdentity ?? 'no roll identity'} comprehended nothing, so `
                + 'every assertion in this file that compares it is comparing empty strings'
            ).toBeGreaterThan(0);
        }
    });

    it('two rows with different random ids comprehend the same things', () => {
        // The regression. Before the fix these diverged in exactly the place
        // the last several days of work landed.
        expect(comprehension(live('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'player')))
            .toBe(comprehension(live('f81d4fae-7dec-11d0-a765-00a0c91e6bf6', 'player')));
    });

    it('THE BUG ITSELF: without a roll identity the row id still decides the life', () => {
        // Documents the defect rather than only its absence, and pins the
        // fallback. A caller whose id is a randomUUID and who passes no roll
        // identity is STILL irreproducible - the engine cannot fix that for
        // them, it can only offer the door. This is what `PLAYER_ROLL_IDENTITY`
        // in the web layer exists to walk through.
        expect(comprehension(live('row-B'))).not.toBe(comprehension(live('row-A')));
    });

    it('the roll identity overrides the row id rather than mixing with it', () => {
        // If the id were mixed in alongside, two rows sharing a roll identity
        // would still diverge and the fix would be no fix at all.
        expect(comprehension(live('row-B', 'k'))).toBe(comprehension(live('row-A', 'k')));
    });

    it('two DIFFERENT cultivators in one world still draw differently', () => {
        // The other half, and the reason the key is per-cultivator rather than
        // per-run: two people in the same world must not be the same prodigy.
        expect(comprehension(live('row-A', 'second')))
            .not.toBe(comprehension(live('row-A', 'first')));
    });

    it('a stable row id needs no roll identity - existing callers are untouched', () => {
        // NPCs out of the catalog and every fixture in the suite already have
        // stable ids. Their results must not move, which is why the fallback
        // is `cultivator.id` and not a constant.
        expect(comprehension(live('catalog-npc'))).toBe(comprehension(live('catalog-npc')));
    });

    it('a vision is still OWNED by the row that had it', () => {
        // `formVision`'s holderId is an ownership field, not an RNG key, and is
        // the one use of `cultivator.id` left in the file. Substituting the
        // roll identity would file every player run's visions under one shared
        // owner. The vision's occurrence, kind and confidence come off a
        // day-keyed stream and were always reproducible.
        const result = live('row-A', 'player');
        for (const vision of result.visions) {
            expect(vision.holderId).toBe('row-A');
            expect(vision.claimKey).toContain('row-A');
        }
    });
});
