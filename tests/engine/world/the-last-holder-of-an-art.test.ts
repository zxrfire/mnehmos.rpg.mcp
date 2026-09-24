/**
 * An art passing out of the world, and the pool the pass draws it from.
 *
 * THE DEFECT THIS PINS
 * --------------------
 * `technique_lost` is named in three source files, has a complete template
 * behind it, and had never fired once in the history of this repo. Every static
 * reading of the tree said it was wired; a grep would have cleared it.
 *
 * It was not inert, not collapsed by feedback, and not degenerate from a single
 * data row. It was a FIFTH shape, and it is the one worth naming: **two rules,
 * each correct in isolation, composed in series, with an intersection of about
 * one in a hundred thousand.** `pickByMortality` correctly hunts people near the
 * end of themselves. Being the last living holder of an art is correctly a
 * high-realm property - a house teaches its low shelves to dozens and its
 * deepest manual to exactly one person. And a high realm IS an enormous
 * lifespan. So the draw's weight sat almost entirely off the eligible set, and
 * the product of two correct rules was zero. Anti-correlated composition.
 *
 * WHAT WAS MEASURED, AND ON WHICH CATALOG
 * ---------------------------------------
 * On the SHIPPED catalog (`loadCultivationCatalog`, `seedWorld` defaults), seeds
 * `tl-a` and `tl-b`, 500 simulated years each - NOT the driver fixture, which
 * holds a fraction of the houses and would give a different and unrelated
 * answer:
 *
 *   people alive below the lid holding any art      991 / 1001
 *   arts held by exactly one living person           22 / 23
 *   people who are the last holder of one            12 / 13   <- the pool
 *   median realm ordinal, those people               36 / 34
 *   median realm ordinal, everybody else             10 / 10
 *   share of the mortality weight on the eligible  0.023% / 0.029%
 *   P(fire) per draw, as it was written            1.0e-5 / 1.3e-5
 *   technique_lost events in 500 played years          0 / 0
 *
 * At about 0.08 draws a year that is one firing per 1.2 million years. The fix
 * was to make the rule the POOL rather than a test applied after the draw; the
 * acceptance roll already inside `pickByMortality` is then the whole of the
 * rate, and no constant was added to reach it.
 *
 * WHAT THESE ASSERTIONS ENCODE
 * ----------------------------
 * Not the rate. A rate moves with a world's mood and a gate on one is a gate
 * people learn to override - the probes under `scripts/` are where a
 * distribution is read by a person.
 *
 *   the promise   a fired `technique_lost` names an art whose ONLY living
 *                 holder is now somebody nobody can find. That is what the
 *                 event tells a reader, and it is what breaks if somebody later
 *                 widens the pool and forgets why it was narrow.
 *
 *                 IT IS NOT "nobody alive holds it", and this test asserted
 *                 that first and was right to go red. `theWorldLoses` calls
 *                 `markMissing`, which deliberately does not touch `status`:
 *                 `who-a-house-has-lost-track-of.ts` carries the owner's ruling
 *                 that *"Missing people are still somewhere physical, just the
 *                 sect doesn't know."* The art is not destroyed and the holder
 *                 is alive. The pass's own consequences claimed otherwise -
 *                 *"Nobody living has been taught it"*, written about a living
 *                 person on the roll - and were corrected in the same commit.
 *   the pool      somebody in the shipped world is the last holder of
 *                 something. Cheap, and it is the guard against this
 *                 regressing from rare to genuinely inert - a catalog change
 *                 that gave every art a second holder would silence the
 *                 mechanism completely and nothing else in the tree would say
 *                 so.
 *   one answer    the death path and the pass agree about who is the last of
 *                 an art. They each used to count for themselves and had
 *                 already drifted: the pass read the lid and `whatTheyHeldUp`
 *                 did not.
 *
 * BROKEN ON PURPOSE BEFORE LANDING, and one of the two results is worth
 * keeping:
 *
 *   pointing the pool back at everybody holding any art - the defect as it
 *   stood - leaves the first test red with *nothing lost in four centuries*, on
 *   a world rigged with a sole holder at 95% of their span and the event rate
 *   raised eightfold. That is the anti-correlated composition reproduced as a
 *   red test rather than as an argument.
 *
 *   loosening `theArtsOnlyTheyHold` to `>= 1` turns the FIRST test red too, on
 *   *somebody else could have taught it all along* - and leaves the third
 *   GREEN, because both readers derive from the same function and agreeing is
 *   all it pins. That is the correct division of labour between them and the
 *   reason the third is not load-bearing on its own.
 */

import { describe, it, expect } from 'vitest';

import { fixtureCatalog } from './fixtures.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { applyPressure } from '../../../src/engine/world/pressure.js';
import { isBelowTheLid } from '../../../src/engine/world/layers.js';
import { lifespanForOrdinal } from '../../../src/engine/cultivation/realms.js';
import { TECHNIQUES, getTechnique } from '../../../src/data/cultivation/techniques.js';
import {
    howManyLivingHoldEachArt,
    theArtsOnlyTheyHold,
    whatTheyHeldUp,
    NOBODY_LEANS_ON_A_MORTAL
} from '../../../src/engine/world/what-a-death-at-this-height-is-worth.js';
import {
    whenTheHouseLostTrackOf,
    whenTheWorldLostSightOf
} from '../../../src/engine/world/who-a-house-has-lost-track-of.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

const YEAR = 365;

describe('the last holder of an art', () => {
    /**
     * A world with one person who is plainly the last of something and plainly
     * near the end of themselves.
     *
     * THE FIXTURE CATALOG, on purpose: this asserts what a firing MEANS, which
     * is a property of the event and not of the world that produced it, and a
     * small world reaches a firing in seconds instead of a millennium. The
     * shipped catalog is measured in the second test, where the question is
     * about the catalog.
     *
     * The rigging is one row: an art no living person in this world holds, on
     * somebody who has spent most of their span. Nothing else is touched, and
     * the pass still has to find them on its own.
     */
    function aWorldWithSomebodyIrreplaceable(): { state: WorldState; from: number } {
        const state = seedWorld({
            seed: 'the-last-of-an-art',
            catalog: fixtureCatalog(),
            presentYear: 1000,
            population: 200
        }).state;

        const held = howManyLivingHoldEachArt(state);
        const spare = TECHNIQUES.find(t => !held.has(t.id));
        expect(spare, 'the fixture world does not hold every art in the catalog').toBeDefined();

        // High enough that losing them means something, and not so high that a
        // span of tens of thousands of years cannot be mostly spent inside a
        // world only a thousand years old.
        const at = state.npcs.findIndex(
            n => n.status === 'alive' && isBelowTheLid(n) &&
                n.cultivation.realmOrdinal >= NOBODY_LEANS_ON_A_MORTAL &&
                n.cultivation.realmOrdinal <= 21 &&
                n.factionId !== null
        );
        expect(at, 'somebody in a house stands high enough to be worth losing').toBeGreaterThanOrEqual(0);

        const npc = state.npcs[at];
        const span = lifespanForOrdinal(npc.cultivation.realmOrdinal);
        state.npcs[at] = {
            ...npc,
            identity: {
                ...npc.identity,
                bornOnDay: Math.max(1, state.currentDay - Math.round(0.95 * span * YEAR))
            },
            cultivation: {
                ...npc.cultivation,
                techniqueIds: [...npc.cultivation.techniqueIds, spare!.id]
            }
        };
        return { state, from: state.currentDay };
    }

    it('names an art nobody alive holds, by its name and not its id', () => {
        const { state, from } = aWorldWithSomebodyIrreplaceable();

        // STEPPED A YEAR AT A TIME, and the reason is the first way this test
        // was written wrong. It ran four centuries in one call and then asked
        // whether anybody held the lost art: seven people did, and they were
        // right to. An art going out of the world is not a promise that it
        // never comes back - `applyManualCopying`, a ruin shelf and somebody
        // being taught all put one back, which is the whole point of that pass.
        // The claim is about the MOMENT, so the world has to be read at it.
        //
        // The horizon is generous rather than tuned; it stops at the first
        // firing, and reaching one is a way to inspect an event rather than a
        // claim about how often it happens.
        let lost = null as { techniqueId: string; actorId: string; summary: string } | null;
        let stoppedAfter = 0;
        for (let y = 0; y < 400 && lost === null; y++) {
            stoppedAfter = y + 1;
            const res = applyPressure(state, from + y * YEAR, from + (y + 1) * YEAR, { intensity: 8 });
            const event = res.events.find(e => e.kind === 'technique_lost');
            if (!event) continue;
            lost = {
                techniqueId: event.fact.data.techniqueId as string,
                actorId: event.fact.actors[0]?.id ?? '',
                summary: event.fact.summary
            };
        }
        expect(lost, 'nothing was lost in four centuries of a world holding a sole survivor').not.toBeNull();

        // THE PROMISE, and it is not the one this test asked for first. It
        // asserted that nobody alive held the art afterwards, and that is FALSE
        // BY DESIGN: `theWorldLoses` calls `markMissing`, which leaves `status`
        // alone on purpose. `who-a-house-has-lost-track-of.ts` carries the
        // owner's ruling - *"Missing people are still somewhere physical, just
        // the sect doesn't know."* The last holder is alive and still carrying
        // it. What is true, and what the event claims, is that the only person
        // who could teach it is somebody nobody can find.
        const actor = state.npcs.find(n => n.id === lost!.actorId);
        expect(actor, 'the fact names somebody on the roll').toBeDefined();
        expect(actor!.cultivation.techniqueIds).toContain(lost!.techniqueId);

        // Out of reach: either still carrying the world's own mark, or the
        // absence pass has already turned it into their house not knowing where
        // they are. Both are the same fact at two stages, and which one it is
        // depends on whether that pass has run since - which is not this
        // event's business and must not be asserted as if it were.
        const outOfSight = whenTheWorldLostSightOf(actor!) !== null ||
            state.factions.some(f => whenTheHouseLostTrackOf(f, actor!.id) !== null);
        expect(outOfSight, 'the last holder is still somebody the world can point to').toBe(true);

        // And nobody ELSE ever held it, which is what made them the last.
        const others = state.npcs.filter(
            n => n.id !== actor!.id && n.status === 'alive' && isBelowTheLid(n) &&
                n.cultivation.techniqueIds.includes(lost!.techniqueId)
        );
        expect(others.map(n => n.id), 'somebody else could have taught it all along').toEqual([]);

        // The prose says the art the way somebody would say it. An id in a
        // summary only ever went unseen because this never fired.
        const art = getTechnique(lost!.techniqueId);
        expect(art, 'the id in the fact resolves in the catalog').toBeDefined();
        expect(lost!.summary).toContain(art!.name);
        expect(lost!.summary).not.toContain(lost!.techniqueId);

        // AND NOT AGAIN, WHICH IS THE ONE A LONG RUN CAUGHT. There are two
        // marks for somebody nobody can find - the world's, which sits on the
        // person for one slice, and the house's, which is durable - and a guard
        // reading only the first found this person unmarked again the next year
        // and lost them again, annually, for ever. It surfaced two subsystems
        // away, as a hall asking after one person five times.
        const again: string[] = [];
        for (let y = stoppedAfter; y < stoppedAfter + 200; y++) {
            const res = applyPressure(state, from + y * YEAR, from + (y + 1) * YEAR, { intensity: 8 });
            for (const e of res.events) {
                if (e.kind === 'technique_lost') again.push(e.fact.actors[0]?.id ?? '');
            }
        }
        expect(again, 'the world lost the same person a second time').not.toContain(lost!.actorId);
    });

    it('finds somebody in the shipped world who is the last of something', async () => {
        // THE SHIPPED CATALOG, and it is the point of this one: the pool being
        // non-empty is a property of what the world ships with, and the fixture
        // cannot answer it. Measured at 12 and 13 people over 22 and 23 arts on
        // two seeds; asserted only as "not nobody", because the exact figure is
        // a catalog's business and moves whenever a manual is added.
        const catalog = await loadCultivationCatalog();
        const { state } = seedWorld({ seed: 'the-shipped-world', catalog });

        const counts = howManyLivingHoldEachArt(state);
        const soleArts = [...counts.values()].filter(n => n === 1).length;
        const soleHolders = state.npcs.filter(n => theArtsOnlyTheyHold(state, n, counts).length > 0);

        expect(soleArts, 'no art in the shipped world has a single living holder').toBeGreaterThan(0);
        expect(soleHolders.length, 'nobody in the shipped world is the last of anything').toBeGreaterThan(0);

        // AND IT IS A POOL RATHER THAN ONE PERSON. A draw over a set of one is
        // the degenerate shape this repo has already been caught by twice, and
        // it reads identically to a healthy rate from any total.
        expect(soleHolders.length).toBeGreaterThan(1);
    });

    it('answers the death path and the pass the same way', async () => {
        const catalog = await loadCultivationCatalog();
        const { state } = seedWorld({ seed: 'one-answer', catalog });

        const counts = howManyLivingHoldEachArt(state);
        const candidates = state.npcs.filter(
            n => n.status === 'alive' && isBelowTheLid(n) &&
                n.cultivation.realmOrdinal >= NOBODY_LEANS_ON_A_MORTAL
        );
        expect(candidates.length).toBeGreaterThan(0);

        // Both readers, on the same people, over the whole band the death path
        // will actually ask about. They cannot disagree, because one derives
        // from the other - which is the property being pinned, and it is the
        // one that was false before.
        for (const npc of candidates) {
            expect(whatTheyHeldUp(state, npc).theLastOfAnArt)
                .toBe(theArtsOnlyTheyHold(state, npc, counts).length > 0);
        }
    });
});
