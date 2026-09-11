/**
 * Arriving somewhere bigger gives you more to pull on than where you came from.
 *
 * ── THE DEFECT, PLAYED ───────────────────────────────────────────────────
 *
 * `architecture.ts` grows an interior for every seated house: in the pinned
 * world below, 939 locations across 36 compounds, each carrying a purpose, a
 * capacity, what it was cut for, how obvious it is, its own qi and an entry
 * threshold. `describeRoom`, `roomsVisibleTo`, `roomStageFor`, `reachThrough`,
 * `pathTo`, `houseStyleOf`, `precinctsOf`, `matchHouseStyle` and
 * `attributionField` had **no caller anywhere outside that file**.
 *
 * So, standing on the Azure Cloud Pavilion's own ground - 24 interior rooms,
 * 2,204 places cut, two sealed vaults, a ward over the whole of it and an inner
 * precinct calibrated at ordinal 41 - the whole of what a player got was:
 *
 *     I examine this place  ->  "Azure Cloud Pavilion grounds, which is a name
 *                               and a road and not much else that anyone here
 *                               can tell you."
 *     I look at the compound -> "You go over Azure Cloud Pavilion grounds
 *                               looking for it and nothing here answers to it."
 *     I look around          -> the ambient band, a head count, and a habit
 *
 * and the Six Li Patrol, a road patrol whose strongest member stands 27 rungs
 * lower, returned the same three paragraphs with a different qi phrase. The
 * measure that matters is comparative, and on that measure the two places were
 * the same place.
 *
 * ── WHAT IS PINNED HERE ──────────────────────────────────────────────────
 *
 * The ORDERING, and never a figure. Which house is biggest is an artefact of
 * the catalog and of what this world's seed did to it; that a bigger one reads
 * bigger is the rule. So both arms pick their house out of the world by asking
 * the engine, play a real turn at each in ONE harness on ONE world, and compare
 * what came back.
 *
 * The knowledge gate is pinned as an absence, which is the only way it can be:
 * a visitor is handed no room name that carries the house's own rank ladder,
 * whatever the ladder happens to be called in this world.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { whatIsBuiltOnThisGround } from '../../src/engine/world/what-is-built-on-this-ground';
import { MAX_ORDINAL } from '../../src/engine/cultivation/realms';

const WORLD = 'built-here-world';

/** The figure the read prints for the biggest roof, or null if it printed none. */
function roofIn(prose: string): number | null {
    const at = /largest roof you can see holds (\d+)/.exec(prose);
    return at === null ? null : Number(at[1]);
}

/** How many courts the read says are open, or null where it said nothing. */
function courtsIn(prose: string): { open: number; seen: number } | null {
    const at = /run of (\d+) of the (\d+) courts/.exec(prose);
    return at === null ? null : { open: Number(at[1]), seen: Number(at[2]) };
}

/** How many buildings the read left the reader unable to identify. */
function unreadableIn(prose: string): number {
    const at = /(\d+) buildings? you could not say the use of/.exec(prose);
    return at === null ? 0 : Number(at[1]);
}

describe('a bigger house is bigger to stand in', () => {
    it('gives a visitor more to pull on than a smaller one does', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'built-here', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Visitor');
        const world = await game.loadWorld();

        // ASK THE ENGINE WHICH HOUSE IS BIGGEST rather than naming one. A name
        // here would pin the catalog and the seed, and both move.
        const outsider = { rankIndex: -1, rankCount: 1, yearsInHouse: 0, member: false };
        const access = { realmOrdinal: cultivator.realmOrdinal };
        const seats = world.locations
            .filter(row => row.kind === 'sect_seat')
            .map(row => ({
                row,
                built: whatIsBuiltOnThisGround({
                    locations: world.locations, standingAt: row.id, viewer: outsider, access
                })
            }))
            .filter(entry => entry.built.seen.length > 0)
            // Sorted on how many separate things a visitor can make out, which
            // is what "more to pull on" means. Not on the largest roof: the two
            // are independent, and the first cut of this test sorted on the
            // roof and then asserted the court count, which is two measures of
            // size wearing one name. The world produced a house with the
            // biggest hall and four courts against one with a smaller hall and
            // seven, and the test failed on a true fact.
            .sort((a, b) => a.built.seen.length - b.built.seen.length);
        expect(seats.length, 'no seated house in this world has an interior').toBeGreaterThan(1);

        const small = seats[0];
        const big = seats[seats.length - 1];
        expect(
            big.built.seen.length,
            'the world produced no two houses of different size to compare'
        ).toBeGreaterThan(small.built.seen.length);

        // ── AND BOTH ARMS IN ONE COMMAND, ON ONE WORLD ───────────────────
        const readAt = async (place: string): Promise<string> => {
            repos.cultivators.update(cultivator.id, { location: place });
            const turn = await game.act('I look at the buildings');
            return turn.narration ?? '';
        };
        const atSmall = await readAt(small.row.name);
        const atBig = await readAt(big.row.name);

        // THE THING THE DESIGN RESTS ON: the bigger one leaves a visitor more
        // to point a verb at. Counted as buildings they can see and cannot
        // identify, which is the hook the knowledge gate exists to be opened
        // on.
        //
        // NOT as the length of the prose, which the first cut used and which is
        // not a measure of anything: the smaller house's rooms happened to be
        // ones a stranger could name, so its read listed them and came out 32
        // characters longer while saying less.
        expect(unreadableIn(atBig)).toBeGreaterThan(unreadableIn(atSmall));

        // And both name their walls, so the comparison is between two reads
        // that answered rather than between an answer and a silence.
        expect(courtsIn(atBig), 'the bigger house said nothing about its courts').not.toBeNull();
        expect(courtsIn(atSmall)).not.toBeNull();
        expect(roofIn(atBig), 'the bigger house named no roof at all').not.toBeNull();
    }, 300_000);

    it('and a place with nothing built on it answers short instead of refusing', async () => {
        // The other half of "derived, never generated", and the half that was
        // wrong. A village is not owed an interior and the read must not pad one
        // with a sentence about its architecture - but the empty reading fell
        // through to the generic resolver, and "I look at the buildings" in Nine
        // Peaks came back as a failed SEARCH:
        //
        //     Nothing here matches the description. It is not in these halls,
        //     nor is it hidden in the courtyards. Either the thing you seek is
        //     in another place entirely, or it does not exist.
        //
        // The player sought no thing and the buildings plainly exist; they are
        // standing among them. That is a refusal reporting the wrong KIND of
        // failure, which tells the player something false about the world.
        //
        // So both halves are pinned: it does not describe a compound that is not
        // there, and it does not report a miss.
        const { game, repos } = await makeGameInWorld({ seed: 'built-here-bare', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Visitor');
        const world = await game.loadWorld();

        const bare = world.locations.find(row =>
            row.kind === 'settlement'
            && !world.locations.some(other => other.parentId === row.id));
        expect(bare, 'this world has no settlement without an interior').toBeTruthy();

        repos.cultivators.update(cultivator.id, { location: bare!.name });
        const turn = await game.act('I look at the buildings');
        expect(turn.narration ?? '').not.toMatch(/largest roof|courts you can count/);
        // The look happened. Asserted on the engine's own row rather than on the
        // prose, because in model mode the wording is the narrator's and only
        // the ok flag is the engine's.
        const looked = turn.toolCalls.filter(call => !call.name.startsWith('narrator.'));
        expect(looked.length).toBeGreaterThan(0);
        expect(looked.every(call => call.ok), 'the look was reported as a failure').toBe(true);
    }, 300_000);

    it('and does not report a house\'s courts to somebody standing in the province', async () => {
        // `parentId` carries two relations and the first cut read them as one.
        // A precinct's parent is the ground it is walled into; a compound's
        // parent is the PROVINCE it sits somewhere in. Walking the tree without
        // asking which meant standing in The Jade Gorge reported 114 courts and
        // 358 buildings and named the precincts of six separate houses, some of
        // them nine days' walk away.
        const { game, repos } = await makeGameInWorld({ seed: 'built-here-wide', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Visitor');
        const world = await game.loadWorld();

        const seat = world.locations.find(row => row.kind === 'sect_seat' && row.parentId !== null)!;
        const province = world.locations.find(row => row.id === seat.parentId)!;
        const house = repos.sects.getById(String(seat.data.factionId))!;

        repos.cultivators.update(cultivator.id, { location: province.name });
        const prose = (await game.act('I look at the buildings')).narration ?? '';
        expect(prose).not.toMatch(/courts you can count/);
        for (const rank of house.ranks) {
            expect(prose.toLowerCase(), `a ${rank} precinct was visible from the province`)
                .not.toContain(`${rank.toLowerCase()} precinct`);
        }
    }, 300_000);

    it('does not hand a visitor the names of the rooms behind the wall', async () => {
        // SHOWING IS NOT TELLING, pinned as an absence. `roomStageFor` gives a
        // stranger `named` for any court obvious enough to be seen from the
        // road, and a compound's court names are the house's own rank ladder -
        // "the outer disciple precinct", "the warden precinct". The first cut
        // of this read printed exactly that at somebody standing outside, which
        // is the knowledge gate being opened by the read that exists to be the
        // hook for opening it.
        const { game, repos } = await makeGameInWorld({ seed: 'built-here-gate', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Visitor');
        const world = await game.loadWorld();

        const seat = world.locations
            .filter(row => row.kind === 'sect_seat')
            .find(row => world.locations.some(other =>
                other.parentId === row.id && Number(other.data.precinctIndex) > 1));
        expect(seat, 'this world has no compound with a second wall').toBeTruthy();

        const house = repos.sects.getById(String(seat!.data.factionId));
        expect(house, 'the compound belongs to no house the run can read').toBeTruthy();

        repos.cultivators.update(cultivator.id, { location: seat!.name });
        const prose = (await game.act('I look at the buildings')).narration ?? '';
        expect(prose.length).toBeGreaterThan(0);

        // The deep ranks. The outermost is what a visitor is standing in and
        // what the house puts on a recruiting bill, so it is not a secret.
        for (const rank of house!.ranks.slice(1)) {
            expect(prose.toLowerCase(), `the visitor was told about the ${rank}`)
                .not.toContain(rank.toLowerCase());
        }
    }, 300_000);

    it('and rank buys the names while the rung buys the walls', async () => {
        // THE TWO GATES ARE DIFFERENT GATES, and the first cut of this test
        // asserted they were one: it made the visitor a member and expected
        // more courts to open. They did not, and the engine is right. A wall is
        // calibrated at an ordinal and `evaluateAccess` reads nothing else, so
        // what standing in the house buys is not passage - it is knowing what
        // the buildings are, which `roomStageFor` rules on rank and service.
        //
        // Both halves are asserted here because either alone reads as the
        // other's absence being a bug.
        const { game, repos } = await makeGameInWorld({ seed: 'built-here-rank', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Visitor');
        const world = await game.loadWorld();

        const outsider = { rankIndex: -1, rankCount: 1, yearsInHouse: 0, member: false };
        const seat = world.locations
            .filter(row => row.kind === 'sect_seat')
            .map(row => ({
                row,
                built: whatIsBuiltOnThisGround({
                    locations: world.locations,
                    standingAt: row.id,
                    viewer: outsider,
                    access: { realmOrdinal: cultivator.realmOrdinal }
                })
            }))
            .sort((a, b) => b.built.enclosuresSeen - a.built.enclosuresSeen)[0];
        expect(seat.built.enclosuresSeen, 'no compound here has walls to open').toBeGreaterThan(1);

        const houseId = String(seat.row.data.factionId);
        const house = repos.sects.getById(houseId)!;
        repos.cultivators.update(cultivator.id, { location: seat.row.name });

        const asStranger = (await game.act('I look at the buildings')).narration ?? '';

        // ── THE RUNG, WITH NO STANDING AT ALL ────────────────────────────
        repos.cultivators.update(cultivator.id, { realmOrdinal: MAX_ORDINAL });
        const asStrangerHigh = (await game.act('I look at the buildings')).narration ?? '';
        expect(courtsIn(asStranger), 'the stranger was told nothing about the courts')
            .not.toBeNull();
        // Somebody standing above every wall on the ground is not told they
        // have the run of some of it - the line goes away because there is
        // nothing left to stop them, which is the same finding said shorter.
        const highCourts = courtsIn(asStrangerHigh);
        expect(highCourts === null || highCourts.open > courtsIn(asStranger)!.open).toBe(true);
        // And the rung bought them nothing they could name.
        expect(unreadableIn(asStrangerHigh)).toBe(unreadableIn(asStranger));

        // ── THE STANDING, AT A RUNG THAT OPENS NOTHING NEW ───────────────
        repos.cultivators.update(cultivator.id, { realmOrdinal: cultivator.realmOrdinal });
        repos.sects.addMember(houseId, cultivator.id, Math.min(2, house.ranks.length - 1));
        const asMember = (await game.act('I look at the buildings')).narration ?? '';
        expect(unreadableIn(asMember)).toBeLessThan(unreadableIn(asStranger));
    }, 300_000);

    it('and looking at what is built costs nothing and spends no day', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'built-here-free', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Visitor');
        const world = await game.loadWorld();
        const seat = world.locations.find(row =>
            row.kind === 'sect_seat'
            && world.locations.some(other => other.parentId === row.id))!;
        repos.cultivators.update(cultivator.id, { location: seat.name });

        const before = repos.cultivators.getById(cultivator.id)!;
        const runBefore = repos.runs.getById(before.runId ?? '')?.elapsedDays;
        await game.act('I look at the buildings');
        const after = repos.cultivators.getById(cultivator.id)!;

        expect(after.spiritStones).toBe(before.spiritStones);
        expect(after.satiety).toBe(before.satiety);
        expect(repos.runs.getById(before.runId ?? '')?.elapsedDays).toBe(runBefore);
    }, 300_000);
});
