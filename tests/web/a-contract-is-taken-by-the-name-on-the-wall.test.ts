/**
 * A contract is taken by the name the wall printed, and the wall reads the same
 * whichever way it is asked.
 *
 * Played blind: the first look at the wall showed intakes and no contracts, and
 * "is the quay watch job going" a turn later listed three. Then "I take the quay
 * watch job" took Tribulation watch - the longest row with "watch" in it - and
 * "sign me up for the quay watch" read as nothing.
 */

import { describe, expect, it } from 'vitest';
import { REGIONS, HOME_REGION_ID } from '../../src/data/cultivation/regions';
import { getHouseMission } from '../../src/data/cultivation/what-a-house-posts-for-its-own';
import { parseIntent } from '../../src/web/actions';
import { makeGameInWorld } from './harness';

const A_MARKET_TOWN = REGIONS.find(region => region.id === HOME_REGION_ID)!
    .places.find(place => place.kind === 'market_town')!.name;

describe('taking a contract by its name', () => {
    it.each([
        'cool, sign me up for the quay watch',
        "i'll do the quay watch",
        'I accept the quay watch contract',
        'I take the quay watch job',
        'I work the quay watch',
        'I take the quay watch'
    ])('reads %s as the quay watch', said => {
        expect(parseIntent(said)).toMatchObject({ action: 'work', target: 'Quay watch' });
    });

    it('reads the culling said without "spirit" as the culling, not a hunt', () => {
        expect(parseIntent('put me down for the beast culling'))
            .toMatchObject({ action: 'work', target: 'Spirit-beast culling' });
    });

    it('leaves a plain hunt a hunt', () => {
        expect(parseIntent('I hunt beasts in the hills').action).toBe('hunt');
    });
});

describe('acting as dao protector', () => {
    it('is the mission\'s own name, and a verb', () => {
        expect(getHouseMission('mission-dao-protector')?.name).toBe('Act as dao protector');
        expect(parseIntent('I act as dao protector').action).toBe('guard');
    });
});

describe('the wall', () => {
    it('shows the same contracts to a look as to a question about work', async () => {
        const { game, repos, db } = await makeGameInWorld({ seed: 'wall-agrees', worldSeed: 'a-xianxia-run' });
        const { cultivator } = await game.newRun('Ke Yan');
        db.prepare('UPDATE cultivators SET realm_ordinal = ? WHERE id = ?').run(5, cultivator.id);
        repos.cultivators.update(cultivator.id, { location: A_MARKET_TOWN });

        const contractsIn = (said: string): string[] => {
            const at = said.indexOf('Contracts on the wall here');
            expect(at, said).toBeGreaterThanOrEqual(0);
            return said.slice(at).split('\n').slice(1).filter(line => /^\s+\S.*: /.test(line))
                .map(line => line.trim());
        };
        const looked = contractsIn((await game.act('let me go check out that wall with the contracts')).narration ?? '');
        const asked = contractsIn((await game.act('is there work')).narration ?? '');
        expect(looked.length).toBeGreaterThan(0);
        expect(looked).toEqual(asked);
        expect(game.state().run.elapsedDays).toBe(0);
    }, 120_000);
});
