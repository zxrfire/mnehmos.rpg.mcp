/**
 * A manual is complete, missing sections, or ruined. There is no fourth state.
 *
 * RULED BY THE DESIGN OWNER: *"just have 3 categories for manuals: ruined,
 * missing sections, complete"*, and on the hard case, *"just treat a manual
 * with a missing front section as ruined ... they're all classified as ruined
 * if it's unreadable."*
 *
 * So UNREADABLE is the single test for ruined, and the engine stops tracking
 * which parts are gone in order to answer it. `contiguousRun` already computes
 * the unbroken run from the beginning; a run of zero is a book nobody can open,
 * whether that is because no volume is in hand or because the opening one is
 * not.
 *
 * WHAT WAS WRONG BEFORE, and it was the number contradicting the sentence
 * beside it. `effectiveCapOf` stepped the ceiling down once per unusable
 * volume, so a three-volume canon capped at 41 with NOTHING in hand returned a
 * ceiling of 38 - while the line it returned in the same object read *"none of
 * them are in hand. There is nothing here to practise."* Holding no part of a
 * work is holding nothing, and the ceiling has to say so.
 *
 * AND THIS IS WHY THE REVERSE VOLUME INDEX STAYS PUT. The open question was
 * whether `theWorkThisVolumeIsPartOf` in `src/web/manual-volumes.ts` needed to
 * move somewhere an engine module could reach it, so that a corpse yielding
 * volumes two and three could be described as a manual with a hole in it. Under
 * three categories there is no such description: it is a ruined manual, and the
 * index is not needed for it. Ruled: do not move it.
 */

import { describe, expect, it } from 'vitest';

import {
    contiguousRun,
    effectiveCapOf,
    whatConditionAManualIsIn
} from '../../../src/engine/cultivation/acquisition.js';
import { NO_MANUAL_CEILING } from '../../../src/engine/cultivation/cultivation.js';

const VOLUMES = ['vol-one', 'vol-two', 'vol-three'] as const;
const SCATTERED = { id: 'canon', name: 'The Canon', cap: 41, volumes: [...VOLUMES] };
const WHOLE = { id: 'one-book', name: 'One Book', cap: 21, volumes: null };

describe('the three states, and nothing else', () => {
    it('calls a set with every part complete', () => {
        expect(whatConditionAManualIsIn(VOLUMES, new Set(VOLUMES))).toBe('complete');
    });

    it('calls a single-volume work complete, because there is nothing to be missing', () => {
        expect(whatConditionAManualIsIn([], new Set())).toBe('complete');
    });

    it('calls a set readable from the beginning missing sections', () => {
        expect(whatConditionAManualIsIn(VOLUMES, new Set(['vol-one']))).toBe('missing sections');
        expect(whatConditionAManualIsIn(VOLUMES, new Set(['vol-one', 'vol-two'])))
            .toBe('missing sections');
    });

    it('calls anything missing its opening ruined, however much of it is there', () => {
        // The design owner's hard case. Two thirds of a canon with the first
        // third gone is not two thirds of anything.
        expect(whatConditionAManualIsIn(VOLUMES, new Set(['vol-two', 'vol-three'])))
            .toBe('ruined');
        expect(whatConditionAManualIsIn(VOLUMES, new Set(['vol-three']))).toBe('ruined');
        expect(whatConditionAManualIsIn(VOLUMES, new Set())).toBe('ruined');
    });

    it('calls a copy the world has already destroyed ruined whatever is in hand', () => {
        // A heaven-grade book read out to the end is ruined by
        // `what-a-manual-has-left-in-it.ts`, and a complete set of volumes
        // does not argue with that.
        expect(whatConditionAManualIsIn(VOLUMES, new Set(VOLUMES), true)).toBe('ruined');
        expect(whatConditionAManualIsIn([], new Set(), true)).toBe('ruined');
    });

    it('is the unbroken run and nothing else, so there is no second rule', () => {
        for (const held of [[], ['vol-one'], ['vol-two'], ['vol-one', 'vol-three'], [...VOLUMES]]) {
            const set = new Set(held);
            const run = contiguousRun(VOLUMES, set);
            const state = whatConditionAManualIsIn(VOLUMES, set);
            expect(state).toBe(
                run === 0 ? 'ruined' : run === VOLUMES.length ? 'complete' : 'missing sections'
            );
        }
    });
});

describe('the ceiling agrees with the state', () => {
    it('says the state on every read, so a caller never has to work it out', () => {
        expect(effectiveCapOf(SCATTERED, [...VOLUMES]).condition).toBe('complete');
        expect(effectiveCapOf(SCATTERED, ['vol-one']).condition).toBe('missing sections');
        expect(effectiveCapOf(SCATTERED, ['vol-two', 'vol-three']).condition).toBe('ruined');
        expect(effectiveCapOf(WHOLE, []).condition).toBe('complete');
    });

    it('gives a ruined manual no ceiling at all, because there is nothing to read', () => {
        // THE CONTRADICTION THIS CLOSES: 38 rungs of ceiling off a book none of
        // which is in hand, printed beside "there is nothing here to practise".
        expect(effectiveCapOf(SCATTERED, []).cap).toBe(NO_MANUAL_CEILING);
        expect(effectiveCapOf(SCATTERED, ['vol-two', 'vol-three']).cap).toBe(NO_MANUAL_CEILING);
    });

    it('leaves a readable but incomplete set costing exactly one rung per part past the run', () => {
        // Unchanged, and it has to be: this is the axis a player acts on.
        // Finding the next volume raises the ceiling.
        expect(effectiveCapOf(SCATTERED, ['vol-one']).cap).toBe(39);
        expect(effectiveCapOf(SCATTERED, ['vol-one', 'vol-two']).cap).toBe(40);
        expect(effectiveCapOf(SCATTERED, [...VOLUMES]).cap).toBe(41);
    });
});
