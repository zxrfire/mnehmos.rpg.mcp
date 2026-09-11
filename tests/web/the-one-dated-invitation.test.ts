/**
 * A notice with tomorrow's date on it, and no sentence that answers it.
 *
 * FOUND BY PLAYING BLIND, in a town with two recruiting bills on the wall and
 * one of them holding its intake the NEXT DAY:
 *
 *     > what notices are here
 *     (UNCLEAR in the table; the model carried the turn)
 *
 *     > i present myself at the intake
 *     The options for someone of your standing are few and functional. The
 *     Burnt Earth Temple would take a Lamp Novice, and the Azure Dew Sect a
 *     Dew Servant... None of this has happened.
 *
 * A catalogue of eight houses and a footer saying nothing had happened, to
 * somebody who had walked up to a named, dated event. The bills are the only
 * concrete invitation this game hands a new player, and they were a read with
 * no verb behind them.
 *
 * ── THREE HALVES, AND EACH ONE WAS SOMEWHERE ELSE ────────────────────────
 *
 * THE ASK. `RECRUITING_BILL_PATTERN` wanted either a reading verb in front of
 * the noun or the word `posted`. The plainest way to ask - naming the thing -
 * had no line: `what notices are here` reached nothing.
 *
 * THE WRITE. The bills read printed two house names and recorded neither, so
 * the reference resolver had nothing to bind a later sentence to. Same gap as
 * the work board, in the same field.
 *
 * THE REFERENCE. `NOT_PART_OF_A_HOUSE_NAME_IN_A_JOINING_SENTENCE` is right that
 * `intake` is not part of a house's name; it was put there for this exact
 * sentence shape. But between a house name and nothing there is a third thing,
 * and it is a REFERENCE to what the wall just said.
 *
 * ── AND THE RULING THAT WAS ALREADY THERE, MOVED ONE LAYER DOWN ──────────
 *
 * `asking-about-a-named-thing.test.ts` had settled part of this at the parse:
 * the target must be empty, *so the admissible listing answers rather than a
 * refusal about a house that does not exist*. The reasoning is right and the
 * layer was wrong - a phrase dropped at the parse can never resolve, so the one
 * sentence that answers a dated invitation could never find the house that
 * posted it.
 *
 * The reference is carried, and `resolvingAgainstTheLastTurn` DROPS it where it
 * cannot be bound. So the listing still answers when there is no wall, and the
 * door answers when there is - and the same drop stops every other unbound
 * reference reaching a verb as a literal, which is how `i study it` became a
 * search for a place called `it`.
 */

import { describe, it, expect } from 'vitest';

import { parseIntent } from '../../src/web/verb-pattern-table';
import {
    resolvingAgainstTheLastTurn,
    type WhatTheLastTurnDid
} from '../../src/web/last-turn-memory';

const AFTER_READING_ONE_BILL: WhatTheLastTurnDid = {
    runId: 'run', cultivatorId: 'cult', onTurn: 3, outcome: 'executed', acts: [],
    named: [{ name: 'Cold Sword Sect' }]
};

const AFTER_READING_TWO: WhatTheLastTurnDid = {
    ...AFTER_READING_ONE_BILL,
    named: [{ name: 'Hollow Bell Wanderers' }, { name: 'Cold Sword Sect' }]
};

const NOTHING_WAS_READ: WhatTheLastTurnDid = { ...AFTER_READING_ONE_BILL, named: [] };

describe('asking for the wall', () => {
    it.each([
        'what notices are here',
        'are there any notices',
        'is there a notice up',
        'what bills are here',
        'any posters here'
    ])('%s reads the wall', said => {
        const plan = parseIntent(said);
        expect(`${plan.action}/${plan.intent ?? '-'}`).toBe('look/bills');
    });

    /** And the phrasings that always worked still do. */
    it.each(['i read the bills', 'what is posted here', 'who is recruiting'])(
        '%s still reads the wall', said => {
            expect(parseIntent(said).action).toBe('look');
        }
    );
});

describe('answering one', () => {
    it('carries the paper as a reference rather than dropping it', () => {
        expect(parseIntent('i present myself at the intake').target).toBe('the intake');
        expect(parseIntent('i attend the intake').target).toBe('the intake');
        expect(parseIntent('i go to the soonest intake').target).toBe('the intake');
    });

    /** A house the sentence actually names still wins over the paper. */
    it('prefers the house when one is named', () => {
        expect(parseIntent('i take the intake at the Silver Island Market').target)
            .toBe('Silver Island Market');
    });

    it('binds the paper to the house the wall named', () => {
        const out = resolvingAgainstTheLastTurn(
            { action: parseIntent('i present myself at the intake'), source: 'model' } as never,
            AFTER_READING_ONE_BILL,
            'i present myself at the intake'
        );
        expect(out.plan.action.target).toBe('Cold Sword Sect');
        expect(out.resolutions.map(r => r.to)).toEqual(['Cold Sword Sect']);
    });

    /**
     * AND TWO PAPERS SETTLE NOTHING, which is the ruling `it` already keeps:
     * a reference with two things to point at points at neither, and the turn
     * says so rather than choosing.
     */
    it('settles nothing when two notices are up', () => {
        const out = resolvingAgainstTheLastTurn(
            { action: parseIntent('i present myself at the intake'), source: 'model' } as never,
            AFTER_READING_TWO,
            'i present myself at the intake'
        );
        expect(out.resolutions).toEqual([]);
        expect(out.unsettled).toEqual(['the intake']);
        expect(out.plan.action.target).toBeUndefined();
    });

    /**
     * AND WITH NO WALL BEHIND IT THE FIELD COMES OFF, which is what the earlier
     * ruling was protecting: the listing answers, rather than the verb refusing
     * about a house called "the intake".
     */
    it('drops the reference when nothing was read', () => {
        const out = resolvingAgainstTheLastTurn(
            { action: parseIntent('i present myself at the intake'), source: 'model' } as never,
            NOTHING_WAS_READ,
            'i present myself at the intake'
        );
        expect(out.plan.action.action).toBe('sect');
        expect(out.plan.action.target).toBeUndefined();
    });
});
