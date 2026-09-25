/**
 * "Which sects do I know of?" lists the houses the player knows. Played: "sects" was looked up as
 * a name, matched no record, and the player was told nobody had ever said a house's name to them.
 */
import { describe, expect, it } from 'vitest';

import { WHICH_KIND_A_WORD_ASKS_FOR } from '../../src/web/a-kind-is-not-a-name.js';
import { makeGameInWorld } from './harness.js';

describe('a kind is not a name', () => {
    it('reads the kind words', () => {
        const kindOf = (said: string) => WHICH_KIND_A_WORD_ASKS_FOR.find(([pattern]) => pattern.test(said))?.[1] ?? null;
        expect(kindOf('sects')).toBe('sect');
        expect(kindOf('the houses')).toBe('sect');
        expect(kindOf('places')).toBe('place');
        expect(kindOf('people')).toBe('cultivator');
        expect(kindOf('sects I know of')).toBe('sect');
        expect(kindOf('Sect Master Hu')).toBeNull();
        expect(kindOf('Duan Shuping')).toBeNull();
    });

    it('answers "which sects do I know of" with the houses they hold', async () => {
        const { game } = await makeGameInWorld({ seed: 'which-sects', worldSeed: 'a-fresh-start' });
        const { cultivator } = await game.newRun('Wen Qiu');
        const houses = game.knowledge.awareness(cultivator.id, 'sect').map(row => row.name);
        expect(houses.length).toBeGreaterThan(0);
        await game.act('Which sects do I know of?');
        const said = game.state().log.slice(-6).map(entry => entry.text).join(' ');
        expect(said).not.toMatch(/Nothing comes back/);
        expect(houses.some(name => said.includes(name))).toBe(true);
    }, 180_000);
});
