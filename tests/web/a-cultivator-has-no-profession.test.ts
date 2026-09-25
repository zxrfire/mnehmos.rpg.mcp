/**
 * A cultivator has no profession. What one is paid for is a contract off the
 * wall where they stand, which a rogue takes for the money and a disciple may
 * take on their own time, or a mission their own house sends them on. Mortal
 * work is put to them only where it is menial work either sort takes, or where
 * they pass for a mortal.
 *
 * Played through `game.act`, because the ruling is about what the `work` verb
 * offers and takes, and a table can agree with it while the verb does not.
 */

import { describe, expect, it } from 'vitest';

import { HOME_REGION_ID, REGIONS } from '../../src/data/cultivation/regions';
import { CONTRACTS } from '../../src/data/cultivation/rogues';
import { HOUSE_MISSIONS } from '../../src/data/cultivation/what-a-house-posts-for-its-own';
import { OCCUPATIONS } from '../../src/data/cultivation/mortal-world';
import { dutyTermsAtAMonthlyRate } from '../../src/engine/encounters/duties';
import {
    aMissionAsAnOffer,
    theMissionBehind,
    theMissionsAHousePosts
} from '../../src/engine/encounters/what-a-house-has-on-its-board';
import { aContractAsAnOffer, contractsPostedAt, theContractBehind } from '../../src/engine/encounters/paper-on-a-town-wall';
import type { HouseAsItStands } from '../../src/engine/world/who-goes-out-for-a-house-and-what-comes-back';
import { makeGameInWorld } from './harness';

const A_HOUSE = 'sect-azure-cloud-pavilion';
const A_MARKET_TOWN = REGIONS.find(region => region.id === HOME_REGION_ID)!
    .places.find(place => place.kind === 'market_town')!.name;
const MORTAL_TRADES = OCCUPATIONS.filter(o => o.kind === 'mortal').map(o => o.name);
const PROFESSION_WORDS = /\b(?:profession|occupation)s?\b/i;

async function standingInATown(seed: string, ordinal: number) {
    const { game, repos, db } = await makeGameInWorld({ seed, worldSeed: 'a-xianxia-run' });
    const { cultivator } = await game.newRun('Ke Yan');
    db.prepare('UPDATE cultivators SET realm_ordinal = ?, spirit_stones = 60 WHERE id = ?')
        .run(ordinal, cultivator.id);
    repos.cultivators.update(cultivator.id, { location: A_MARKET_TOWN });
    return { game, repos, db, cultivatorId: cultivator.id };
}

describe('asking for work at a wall', () => {
    it('lists the contracts posted there, and no mortal trade, to somebody seen to be a cultivator', async () => {
        const { game } = await standingInATown('paid-by-contract', 5);
        const read = await game.act('is there work');
        const board = read.narration ?? '';
        expect(board).toMatch(/Contracts on the wall here/);
        expect(board).toContain('spirit beast culling');
        expect(board).not.toMatch(PROFESSION_WORDS);
        for (const trade of MORTAL_TRADES) expect(board, trade).not.toContain(`  ${trade}`);
    }, 240_000);

    it('takes a contract named off the wall through the duty it is served by, and pays it in stones', async () => {
        const { game } = await standingInATown('takes-a-contract', 5);
        const before = (await game.state()).run!.elapsedDays;
        const took = await game.act('I take the spirit-beast culler contract');
        const names = took.toolCalls.map(call => call.name);
        expect(
            names.some(name => /completeDuty|recordDaysServed|refuseDuty/.test(name)),
            names.join(', ')
        ).toBe(true);
        expect(took.toolCalls.map(call => call.summary).join(' ')).toContain('spirit beast culling');
        expect((await game.state()).run!.elapsedDays).toBeGreaterThan(before);
        expect(took.narration ?? '').not.toMatch(PROFESSION_WORDS);
    }, 240_000);

    // A house's missions hang on a board inside its walls, so a member in a town
    // reads the town's wall and nothing of theirs. See
    // `the-mission-board-stands-inside-the-walls.test.ts` for the board itself.
    it('does not mix a member\'s own house\'s missions into a town\'s wall', async () => {
        const { game, repos, db, cultivatorId } = await standingInATown('sent-on-a-mission', 25);
        repos.sects.addMember(A_HOUSE, cultivatorId, 0);
        db.prepare('UPDATE cultivators SET realm_ordinal = 25 WHERE id = ?').run(cultivatorId);
        const board = (await game.act('is there work')).narration ?? '';
        expect(board).toMatch(/Contracts on the wall here/);
        expect(board).not.toMatch(/And what your house sends its own on/);
        expect(board).not.toMatch(/\bchores\b/i);
    }, 240_000);
});

describe('the rows behind the wall', () => {
    const house = (over: Partial<HouseAsItStands> = {}): HouseAsItStands => ({
        id: A_HOUSE, name: 'Azure Cloud Pavilion', holdsGround: true, standing: {}, hasAFind: false, ...over
    });

    it('posts a mission only where the house has the need and somebody who could do it', () => {
        const at30 = theMissionsAHousePosts(house(), 30).map(m => m.id);
        expect(at30).toContain('mission-vein-warden');
        expect(at30).not.toContain('mission-seal-inspection');
        expect(theMissionsAHousePosts(house({ holdsGround: false }), 30).map(m => m.id))
            .not.toContain('mission-vein-warden');
        expect(theMissionsAHousePosts(house(), 5).every(m => m.minOrdinal <= 5)).toBe(true);
    });

    it('reads a line back to the row it was made from', () => {
        for (const mission of HOUSE_MISSIONS) {
            expect(theMissionBehind(aMissionAsAnOffer(mission, house()).id)?.id).toBe(mission.id);
        }
        for (const contract of CONTRACTS) {
            expect(theContractBehind(aContractAsAnOffer(contract).id)?.id).toBe(contract.id);
        }
        expect(contractsPostedAt(null)).toHaveLength(0);
    });

    it('pays a term at its rate, and credits a house only for the house\'s own work', () => {
        const culling = CONTRACTS.find(c => c.id === 'contract-beast-culler')!;
        const member = { factionId: A_HOUSE, factionName: 'Azure Cloud Pavilion', rankIndex: 0, rankCount: 5, contribution: 0 };
        const asAContract = dutyTermsAtAMonthlyRate({
            entry: aContractAsAnOffer(culling), cashPerMonth: culling.cashPerMonth, days: culling.days,
            ordinal: culling.minOrdinal, membership: member, creditsTheHouse: false
        });
        expect(asAContract.contribution).toBe(0);
        expect(asAContract.days).toBe(culling.days);
        expect(asAContract.stones).toBe(Math.round(culling.cashPerMonth * (culling.days / 30)
            * Math.max(0.25, Math.min(3, asAContract.regard.yieldMultiplier)) / 100));

        const chores = HOUSE_MISSIONS.find(m => m.id === 'mission-outer-chores')!;
        const asAMission = dutyTermsAtAMonthlyRate({
            entry: aMissionAsAnOffer(chores, house()), cashPerMonth: chores.cashPerMonth, days: chores.days,
            ordinal: chores.minOrdinal, membership: member, creditsTheHouse: true
        });
        expect(asAMission.contribution).toBeGreaterThan(0);
    });
});
