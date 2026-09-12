/**
 * Taking work off the wall is said to a person, and a hall has people in it.
 *
 * ── WHAT WAS WRONG ───────────────────────────────────────────────────────
 *
 * Taking board work was a solo act performed against a piece of paper. The
 * design owner, reading a played turn where an elder took a duty pitched eleven
 * rungs beneath them: *"the eyebrow is raised by the mission elder lol.
 * remember, to take a mission YOU HAVE TO REPORT IT TO SOMEONE, THE MISSION
 * HALL WHICH THE MISSION ELDER IS RESPONSIBLE FOR. EITHER REPORT TO THAT ELDER
 * OR TO A DISCIPLE WORKING IN HIS HALL."*
 *
 * MEASURED, and the gap was structural rather than a missing string. Offices in
 * this engine are rooms, dealt by `whoIsInChargeOfWhat`, and it filtered on
 * `sealed`. `RoomPurpose` held 21 rooms and none of them was a mission hall -
 * so the missions elder was named in `docs/world/houses/discovery.md` and in
 * three refusal strings and had nowhere in the world to stand. A hall disciples
 * walk into to take work cannot be a locked room, so no amount of adding
 * `mission_hall` to the table would have helped while `office` and `sealed`
 * were one column.
 *
 * Three things followed, and they are what these cases pin:
 *
 *   `office` split off `sealed` in `architecture.ts`, equal on every purpose
 *   that existed before, so the deal is unchanged.
 *
 *   `mission_hall` added at depth 0.3, UNDER every other office. That number is
 *   load-bearing: offices sort deepest-first and are dealt round robin, so a
 *   room inserted above the others shifts all of them, which is exactly what
 *   the reverted ancestral hall did.
 *
 *   `who-works-in-an-elders-hall.ts` reads who WORKS in a room as well as who
 *   is over it. The owner: *"a punishment hall needs disciples who are selected.
 *   they are still ordinary outer/inner/conclave disciples, but they have a sub
 *   job at that place."* Rank and post are orthogonal and nothing here touches
 *   `rankIndex`.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';
import { theRoomsThisHouseHas, portfoliosIn } from '../../src/engine/social-leverage/authority-for-an-order';
import {
    remitOf,
    whoStaffsWhat,
    whoTakesAReportAt,
    whoWorksIn
} from '../../src/engine/social-leverage/who-works-in-an-elders-hall';
import { THE_ROOM_WORK_IS_POSTED_IN } from '../../src/engine/encounters/what-a-house-has-on-its-board';

const A_HOUSE = 'sect-azure-cloud-pavilion';
const A_WORLD = 'a-house-posts-what-it-needs-doing';

async function anElderOfAHouseWithAWall() {
    const { game, repos, db } = await makeGameInWorld({
        seed: 'mission-reported', worldSeed: A_WORLD, worldEnabled: true
    });
    const { cultivator } = await game.newRun('Elder');
    repos.sects.addMember(A_HOUSE, cultivator.id, 0);
    const sect = repos.sects.getById(A_HOUSE)!;
    repos.sects.setRank(A_HOUSE, cultivator.id, sect.ranks.length - 2);
    db.prepare('UPDATE cultivators SET realm_ordinal = 40 WHERE id = ?').run(cultivator.id);
    const world = await game.loadWorld();
    return { game, repos, db, world, sect, cultivatorId: cultivator.id };
}

describe('a house has somewhere its work is posted', () => {
    it('builds a mission hall, and somebody is over it', async () => {
        const at = await anElderOfAHouseWithAWall();
        const rooms = theRoomsThisHouseHas(at.world.locations, A_HOUSE);
        expect(rooms, 'no room this house has is the one work is posted in')
            .toContain(THE_ROOM_WORK_IS_POSTED_IN);

        const roll = at.sect.ranks.map((_, i) => ({ id: `person-${i}`, rankIndex: i }));
        const portfolios = portfoliosIn({
            locations: at.world.locations, sectId: A_HOUSE, roll,
            rankCount: at.sect.ranks.length
        });
        const mission = portfolios.find(p => p.purpose === THE_ROOM_WORK_IS_POSTED_IN);
        expect(mission, 'the hall is not an office').toBeDefined();
        expect(mission!.holderId, 'nobody is the missions elder').not.toBeNull();
    }, 300_000);

    it('and a taken mission is said to whoever the hall answers with', async () => {
        // PLAYED, because the whole ruling is about what the player is told.
        const at = await anElderOfAHouseWithAWall();
        const said = (await at.game.act('i take after materials') as unknown as {
            narration?: string;
        }).narration ?? '';

        expect(said, 'the taking names no hall').toMatch(/mission hall/i);
        // And a PERSON, not an institution. Asserted by shape rather than by a
        // name: which elder holds which room is the deal's business and moves
        // when a house's roll does. See AGENTS.md on pinning names.
        expect(said).toMatch(/taken in front of .+, who (holds that room|works in it)/i);

        // AND THE EYEBROW LANDS HERE RATHER THAN AT COMPLETION. It used to ride
        // `completeDuty`'s settlement line, which said it after the fact and to
        // nobody.
        expect(said, 'nothing says how far under the taker it was pitched')
            .toMatch(/rungs under/i);
    }, 300_000);
});

describe('and a hall has people working in it', () => {
    const RANKS = 4;
    const ROLL = [
        { id: 'head', rankIndex: 3 },
        { id: 'elder', rankIndex: 2 },
        { id: 'inner', rankIndex: 1 },
        { id: 'outer', rankIndex: 0 }
    ];
    const ROOMS = ['treasury', 'punishment_hall', 'mission_hall'] as const;
    const portfolios = [
        { purpose: 'treasury' as const, holderId: 'head', depth: 0.9 },
        { purpose: 'punishment_hall' as const, holderId: 'elder', depth: 0.65 },
        { purpose: 'mission_hall' as const, holderId: 'head', depth: 0.3 }
    ];

    it('staffs them with ordinary disciples, and moves nobody\'s rank', () => {
        const posts = whoStaffsWhat({ portfolios, roll: ROLL, rankCount: RANKS });
        expect(posts.length).toBe(ROOMS.length);
        // Nobody who decides is also the hand in the room.
        for (const post of posts) {
            expect(['inner', 'outer']).toContain(post.personId);
        }
        // A post is not a rung. The roll handed in is the roll read back: if
        // this ever fails, somebody has made a sub-job into a promotion.
        expect(ROLL.map(p => p.rankIndex)).toEqual([3, 2, 1, 0]);
    });

    it('and says who selected them, which is whoever holds the room', () => {
        const posts = whoStaffsWhat({ portfolios, roll: ROLL, rankCount: RANKS });
        for (const post of posts) {
            const holder = portfolios.find(p => p.purpose === post.purpose)!.holderId;
            expect(post.selectedById).toBe(holder);
        }
    });

    it('and a post reaches what passes through a room, never what is decided about it', () => {
        // THE BRIBERY TROPE'S WHOLE MECHANISM, and it is two values rather than
        // a table of favours. The design owner's acceptance test: slipping a
        // disciple who works in the punishment hall some stones to get a friend
        // extra food should fall out. It does, because a post HANDLES what
        // passes through - and the same disciple cannot shorten a sentence,
        // because deciding about the room is the elder's.
        const posts = whoStaffsWhat({ portfolios, roll: ROLL, rankCount: RANKS });
        const hand = whoWorksIn(posts, 'punishment_hall')[0]!;

        expect(remitOf({ purpose: 'punishment_hall', personId: hand, portfolios, posts }))
            .toBe('handles_what_passes_through');
        expect(remitOf({ purpose: 'punishment_hall', personId: 'elder', portfolios, posts }))
            .toBe('decides_about_the_room');
        // And somebody with neither has neither, which is what stops the remit
        // being a thing everybody has a little of.
        expect(remitOf({ purpose: 'punishment_hall', personId: 'head', portfolios, posts }))
            .toBe('nothing_here');
    });

    it('and a hall with nobody over it is still open, which is what staffing is for', () => {
        const unheld = portfolios.map(p =>
            p.purpose === 'mission_hall' ? { ...p, holderId: null } : p);
        const posts = whoStaffsWhat({ portfolios: unheld, roll: ROLL, rankCount: RANKS });
        const taker = whoTakesAReportAt({
            purpose: 'mission_hall', portfolios: unheld, posts
        });
        expect(taker, 'the hall closed because one person was not in it').not.toBeNull();
        expect(taker!.remit).toBe('handles_what_passes_through');
    });

    it('and a house with nobody but deciders in it has nobody to post', () => {
        // A body that admits nobody. The honest answer is an empty list rather
        // than an invented clerk, and `whoTakesAReportAt` says so by returning
        // the holder or nothing at all.
        const onlyElders = [{ id: 'head', rankIndex: 3 }, { id: 'elder', rankIndex: 2 }];
        expect(whoStaffsWhat({ portfolios, roll: onlyElders, rankCount: RANKS })).toEqual([]);
    });
});
