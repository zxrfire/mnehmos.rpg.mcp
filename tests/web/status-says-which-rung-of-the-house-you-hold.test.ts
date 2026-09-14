/**
 * `status` named the house and could fail to name the rung on its roll.
 *
 * The design owner: *"just have status include your house rank, if there is
 * one."* The sheet had a line for it - "On the roll of Azure Dew Sect, ranked
 * Outer Disciple" - and the rung in it came from `cultivator.sectRank`, a
 * STRING MIRRORED onto the cultivator row by `sect.repo.ts`. Two consequences,
 * both silent:
 *
 *   nothing set the mirror    the line degrades to "On the roll of X." and the
 *                             player is on a roll at no rung anybody can name
 *   the world moved them      the mirror still says the rung they joined at
 *
 * THE MIRROR IS NOW GONE, and with it the column. A rung has two stores - the
 * roll for a cultivator the database holds, the world row for somebody the
 * world holds - and `whereSomebodyStandsOnAHousesRoll` is the one read of the
 * pair. The world row is asked FIRST, for the reason that function records:
 * asking the roll first read a conclave disciple back as an outer one.
 *
 * ONE line still, not two - a second sentence naming the rung would be the
 * sheet disagreeing with itself. The name is the house's own (`faction.ranks`);
 * a generic ladder printed here would be a second one beside it, and the two
 * would part company the first time a house was seeded with words of its own.
 *
 * RED-CHECKED. Passing `null` for the rung into `factsForStatus` fails the
 * second case; reading `getMembership(...).rankIndex` in place of the one read
 * fails the third.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { whereYouStandOnYourHousesRoll } from '../../src/web/walking-up-to-a-house';

const A_HOUSE = 'sect-azure-dew-sect';
const WORLD = 'status-names-your-rung';

async function ofTheHouse(seed: string, rankIndex: number) {
    const h = await makeGameInWorld({ seed, worldSeed: WORLD, worldEnabled: true });
    const { cultivator } = await h.game.newRun('Joiner');
    h.db.prepare('UPDATE cultivators SET realm_ordinal = 12 WHERE id = ?').run(cultivator.id);
    h.game.repos.sects.addMember(A_HOUSE, cultivator.id, rankIndex);
    return { ...h, cultivatorId: cultivator.id };
}

/** The house's own ladder, asked for rather than written down here. */
function theLadderOf(h: Awaited<ReturnType<typeof ofTheHouse>>): string[] {
    return h.game.repos.sects.getById(A_HOUSE)!.ranks;
}

describe('status says which rung of the house you hold', () => {
    it('names the house and a rung of that house own ladder', async () => {
        const h = await ofTheHouse('status-rung-named', 1);
        const ladder = theLadderOf(h);
        const house = h.game.repos.sects.getById(A_HOUSE)!;

        const said = (await h.game.act('status')).narration;
        expect(said, 'the sheet did not name the house').toContain(house.name);
        expect(
            ladder.filter(rung => said.includes(rung)),
            'no rung of the house appears on the sheet'
        ).not.toHaveLength(0);
    }, 180_000);

    it('names it off the roll, with nothing on the cultivator row to name it', async () => {
        // The commonest shape of the defect was: on a roll, at a rung, with the
        // mirrored string empty, and the sheet said the house and stopped.
        // There is no string to empty any more - the column is gone - so this
        // now asserts the whole of what is left: the roll alone reaches the
        // sheet.
        const h = await ofTheHouse('status-mirror-empty', 2);
        const ladder = theLadderOf(h);

        const said = (await h.game.act('status')).narration;
        expect(said, 'the rung did not reach the sheet off the roll').toContain(ladder[2]!);
    }, 180_000);

    it('reads the rung the world holds, not the one the membership row is low on', () => {
        // The two stores, made to disagree on purpose, and asked off the
        // handles rather than through a played turn: a world that agrees with
        // itself cannot show which of the two was asked first.
        const ranks = ['Dew Servant', 'Outer Disciple', 'Inner Disciple', 'Dew Elder'];
        const bothStores = {
            atHand: {
                npcs: [{ id: 'me', factionId: A_HOUSE, factionRankIndex: 2 }],
                factions: [{ id: A_HOUSE, name: 'Azure Dew Sect', ranks }]
            },
            repos: {
                sects: { getMembership: () => ({ sectId: A_HOUSE, rankIndex: 0 }) }
            }
        };
        const stood = whereYouStandOnYourHousesRoll(
            bothStores as never, { id: 'me' } as never
        );
        expect(stood?.rungName, 'the membership row was asked first').toBe(ranks[2]);
        expect(stood?.rankCount).toBe(ranks.length);
    });
});
