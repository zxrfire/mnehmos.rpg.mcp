/**
 * A contract is taken by the name the wall printed, and the wall reads the same
 * whichever way it is asked.
 *
 * Played blind: the first look at the wall showed intakes and no contracts, and
 * "is the quay watch job going" a turn later listed three. Then "I take the quay
 * watch job" took Tribulation watch - the longest row with "watch" in it - and
 * "sign me up for the quay watch" read as nothing.
 *
 * A title is the whole task now - "Keep the quay watch at <town> for the next 30
 * days" - and nobody types all of it. Each row carries a handle, the words
 * people say, which its title contains; the handle is what is matched.
 */

import { describe, expect, it } from 'vitest';
import { REGIONS, HOME_REGION_ID } from '../../src/data/cultivation/regions';
import { CONTRACTS } from '../../src/data/cultivation/rogues';
import { HOUSE_MISSIONS, getHouseMission } from '../../src/data/cultivation/what-a-house-posts-for-its-own';
import { SENDING_REASONS } from '../../src/data/cultivation/why-a-house-puts-a-party-on-the-road';
import { aTaskAsPosted } from '../../src/engine/encounters/how-a-task-is-worded';
import { parseIntent } from '../../src/web/actions';
import { makeGameInWorld } from './harness';

const A_MARKET_TOWN = REGIONS.find(region => region.id === HOME_REGION_ID)!
    .places.find(place => place.kind === 'market_town')!.name;

const plain = (s: string) => ` ${s.toLowerCase().replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ').trim()} `;

describe('taking a contract by its name', () => {
    it.each([
        'cool, sign me up for the quay watch',
        "i'll do the quay watch",
        'I accept the quay watch contract',
        'I take the quay watch job',
        'I work the quay watch',
        'I take the quay watch',
        'I take Keep the quay watch at Willow Market for the next 30 days'
    ])('reads %s as the quay watch', said => {
        expect(parseIntent(said)).toMatchObject({ action: 'work', target: 'quay watch' });
    });

    it('reads the culling said without "spirit" as the culling, not a hunt', () => {
        expect(parseIntent('put me down for the beast culling'))
            .toMatchObject({ action: 'work', target: 'beast culling' });
    });

    it('leaves a plain hunt a hunt', () => {
        expect(parseIntent('I hunt beasts in the hills').action).toBe('hunt');
    });
});

describe('every title is a task that carries its handle', () => {
    const rows = [
        ...CONTRACTS.map(row => ({ id: row.id, said: row.said, task: row.task, days: row.days })),
        ...HOUSE_MISSIONS.map(row => ({ id: row.id, said: row.said, task: row.task, days: row.days })),
        ...SENDING_REASONS.map(row => ({ id: row.id, said: row.said, task: row.task, days: row.days }))
    ];

    it.each(rows)('$id: the title names the job, the place and the term, and contains "$said"', row => {
        const title = aTaskAsPosted(row.task, { house: 'Azure Dew Sect', place: 'Willow Village', realm: 'Foundation Establishment' }, row.days);
        expect(plain(title)).toContain(plain(row.said));
        expect(title).toContain('Willow Village');
        expect(title).not.toMatch(/[{}]/);
        expect(title).toMatch(/\b(?:for the next|within) \d+(?:\.\d)? (?:days?|months?|years?)\b/);
    });

    it('states the term the row runs, not a longer one', () => {
        const watch = HOUSE_MISSIONS.find(row => row.said === 'pass watch')!;
        expect(aTaskAsPosted(watch.task, { house: 'Azure Dew Sect', place: 'Azure Dew Peak' }, watch.days))
            .toBe('Keep the pass watch below Azure Dew Peak for Azure Dew Sect for the next 5 years');
    });

    it('drops a particular the engine does not know, with the word that joined it', () => {
        const chores = HOUSE_MISSIONS.find(row => row.said === 'chores')!;
        expect(aTaskAsPosted(chores.task, { house: 'Azure Dew Sect' }, chores.days))
            .toBe('Do chores for Azure Dew Sect for the next 30 days');
    });

    it('gives no two rows one handle', () => {
        const handles = rows.map(row => row.said);
        expect(new Set(handles).size).toBe(handles.length);
    });

    it.each([...CONTRACTS, ...HOUSE_MISSIONS].filter(row => row.id !== 'mission-dao-protector'))(
        'takes $said by its handle inside a work frame',
        row => {
            expect(parseIntent(`sign me up for the ${row.said}`)).toMatchObject({ action: 'work', target: row.said });
        }
    );

    it.each(SENDING_REASONS)('takes the house\'s posting by "$said"', reason => {
        expect(parseIntent(`I take the ${reason.said}`)).toMatchObject({ action: 'sect', intent: 'duty' });
    });
});

describe('acting as dao protector', () => {
    it('is the head of the mission\'s own title, and a verb', () => {
        expect(getHouseMission('mission-dao-protector')?.task).toMatch(/^Act as dao protector /);
        expect(parseIntent('I act as dao protector').action).toBe('guard');
        expect(parseIntent('I take the dao protector mission').action).toBe('guard');
    });
});

describe('the wall', () => {
    it('shows the same contracts to a look as to a question about work, each worded with the town', async () => {
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
        for (const line of looked) expect(line).toContain(` ${A_MARKET_TOWN} `);
        expect(game.state().run.elapsedDays).toBe(0);
    }, 120_000);
});
