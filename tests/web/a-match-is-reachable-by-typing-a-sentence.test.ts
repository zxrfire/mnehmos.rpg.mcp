/**
 * The three verbs, reached the way a person reaches them.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS AND WHAT IT IS GUARDING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Everything a match needs was built, tested and unreachable. Four separate
 * modules, all complete, none with a caller anywhere in `src/`:
 * `settleItWithABinding` and `whatWalkingOutOfItCosts`, `bloodlineTierForChild`,
 * and - reachable by the world for NPCs and by no player ever - `spendAWord`.
 *
 * So the failure this file guards against is not that a function is wrong. It
 * is the repo's own most-repeated defect: **a module nothing calls is not a
 * feature.** A unit test on the engine module passes whether or not any
 * sentence in the language reaches it, which is precisely how the eight
 * subsystems in AGENTS.md's table came to be finished and dead.
 *
 * These tests type the sentence.
 *
 * `worldEnabled: true`, because the harness default is false and every guard
 * that needs a world to check against is skipped by design when it is.
 */

import { describe, it, expect } from 'vitest';
import { makeGame, makeGameInWorld } from './harness';
import { parseIntent } from '../../src/web/actions';
import { npcsAt } from '../../src/engine/world/world-state';
import { resetCultivationWorlds } from '../../src/server/state/cultivation-world';

describe('a match is reachable by typing a sentence', () => {
    it('reads the ways somebody would actually say it', () => {
        // The rule that has bitten this repo repeatedly: if a near-synonym
        // works and the natural phrasing does not, the natural one is the bug.
        for (const said of [
            'I propose a match to Bai Jinglu',
            'I ask Bai Jinglu to marry me',
            'I offer the Xu a marriage',
            'I want to marry into the Xu',
            'I seek a marriage with the Ninefold Ledger',
            'I accept the match',
            'I agree to the betrothal'
        ]) {
            expect(parseIntent(said).action, said).toBe('propose');
        }

        for (const said of [
            'I refuse the match',
            'I turn down the proposal',
            'I say no to the betrothal',
            'I reject the marriage they arranged',
            'I run from the marriage',
            'I walk out of the match'
        ]) {
            expect(parseIntent(said).action, said).toBe('decline');
        }

        for (const said of [
            'I have a child with Bai Jinglu',
            'I raise a child with Bai Jinglu',
            'I start a family with Bai Jinglu',
            'I place my child at the Azure Cloud Pavilion',
            'I send my son to the Azure Dew Sect'
        ]) {
            expect(parseIntent(said).action, said).toBe('child');
        }
    });

    it('does not swallow the sentences next to it', () => {
        // The other half of the same rule, and the one the last widening of
        // this parser got wrong: a new verb that eats a neighbour's sentences
        // is worse than a missing one.
        const NOT_OURS: readonly [string, string][] = [
            ['I read about marriage customs in the book', 'propose'],
            ['what would a marriage to that house take', 'propose'],
            ['I ask him about his family', 'child'],
            ['I refuse the duty', 'decline'],
            ['I turn down the commission', 'decline'],
            ['I run from the beast', 'decline'],
            ['I leave this town', 'decline'],
            ['who is in that family', 'child']
        ];
        for (const [said, forbidden] of NOT_OURS) {
            expect(parseIntent(said).action, said).not.toBe(forbidden);
        }
    });

    it('carries what is being put down, and never asks what kind of thing it is', () => {
        // The offer list is open. Ten media, one field, no branch - which is
        // the rule the pricing module has carried since it was written and the
        // reason a tenth kind of offer needs no code.
        const OFFERS = [
            'four thousand spirit stones',
            'the Nine Abyss Flame Manual',
            'a beast core',
            'protection over the valley',
            'an alliance against the Ninefold Ledger'
        ];
        for (const offer of OFFERS) {
            const plan = parseIntent(`I offer ${offer} for a match with the Xu`);
            expect(plan.action, offer).toBe('propose');
            expect(plan.topic, offer).toBeTruthy();
        }
    });
});

describe('through the front door', () => {
    it('answers what a match would take without spending a day', async () => {
        resetCultivationWorlds();
        const { game } = await makeGameInWorld({
            seed: 'a-match', worldSeed: 'world-a-match'
        });
        await game.newRun('Ke Yan');

        const world = (await game.loadWorld())!;
        // Somebody the game itself would print as standing near, taken from
        // the busiest square rather than from wherever the run happened to
        // open - a test that finds nobody is measuring nothing.
        const square = world.locations
            .map(l => ({ location: l, people: npcsAt(world, l.id) }))
            .sort((a, b) => b.people.length - a.people.length)[0];
        expect(square.people.length).toBeGreaterThan(0);
        await game.act(`I travel to ${square.location.name}`);

        const somebody = npcsAt((await game.loadWorld())!, square.location.id)[0];
        expect(somebody, 'nobody at hand to propose to').toBeTruthy();

        const dayBefore = (await game.state()).run.elapsedDays;
        const result = await game.act(`I propose a match to ${somebody.name}`);

        // Asking the price is a question. It costs a sentence and no day.
        expect(result.state.run.elapsedDays).toBe(dayBefore);
        const said = JSON.stringify(result).toLowerCase();
        // It says what a house would take, rather than answering yes.
        expect(said).toMatch(/would take|price|put down|rung|match/);
    });

    it('refuses a match nobody put to you, and says why rather than throwing', async () => {
        const { game } = makeGame({ seed: 'a-refusal', worldEnabled: true });
        await game.newRun('Ke Yan');

        const result = await game.act('I refuse the match');
        // No open marriage pact and nobody named. A refusal that names a door
        // that does not exist is the thing `asking.md` forbids, so it names the
        // absent one instead.
        expect(result.state.run.elapsedDays).toBe(0);
        expect(JSON.stringify(result).toLowerCase()).toMatch(/refuse whom|nobody/);
    });

    it('will not place a child at a house the player knows nobody in', async () => {
        const { game } = makeGame({ seed: 'a-placement', worldEnabled: true });
        await game.newRun('Ke Yan');

        const result = await game.act('I place my child at the Azure Cloud Pavilion');
        expect(result.state.run.elapsedDays).toBe(0);
        // A favour runs through a person and never through an institution -
        // `spending-a-word-to-place-a-child.ts`'s own rule, surfaced rather
        // than reimplemented. Either that refusal, or the Pavilion's own: it
        // is the one house in the world where a word buys nothing.
        expect(JSON.stringify(result).toLowerCase())
            .toMatch(/runs through a person|buys nothing|nobody|no such|does not move|probation/);
    });
});
