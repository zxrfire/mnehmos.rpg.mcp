import { theDisciplesPostedToInternalAffairs } from '../../src/engine/world/what-a-house-hears-from-its-people-away.js';
/** Hall grouping reads the room's authority, rather than its head's anchor room.
 * Hall incumbency survives new members; the chair control creates a real vacancy.
 * Opening worlds now staff the hall: the control releases its actual clerk,
 * asks the engine for a real personnel nomination, and reaches the work room. */
/**
 * Cutting a communication talisman: one act anybody at Foundation does, and one
 * an office does.
 *
 * The design owner: *"anyone foundation or above can just make them"*, *"making
 * them for the house IS a meritous task"*, and *"the internal affairs elder
 * crafts them, or his disciples who work in internal affairs - probably his
 * disciples craft them for disciples, the elder crafts them for elders."*
 *
 * ── WHAT WAS THERE BEFORE ────────────────────────────────────────────────
 *
 * Both halves, with one gate between them: Foundation. Any member at all could
 * sit down and cut the HOUSE's own blanks into its treasury and be credited
 * contribution for it, with nobody having handed them the seal that marks them.
 * The meritorious act was the one with no owner.
 *
 * ── WHAT THIS PINS ───────────────────────────────────────────────────────
 *
 *   a pair for yourself wants a foundation and nothing else - no permission and
 *   no merit, which is what makes it the ordinary act
 *   the house's own blanks are Internal Affairs' work, and a member who has not
 *   been handed it is refused by the HOUSE rather than by the verb: the answer
 *   names who does it there and what would put it in their hands
 *   and it is refused before the days, because a refusal must not cost any
 *   with the house's own notice taken off its board, the same sentence spends
 *   the days, lands the blanks in the treasury, and is counted
 *
 * ── THE THREE ROADS, AND ALL THREE ARE WALKABLE ──────────────────────────
 *
 * Holding the office, being posted under it, and taking the notice. The first
 * of them was reported here as unreachable and that was wrong twice over, which
 * is why it was measured: `theInternalAffairsElderIn` carried a header saying
 * the room the roll is kept in was not dealt as an office, and the room had
 * moved to the life lamp hall since - measured over two seeds,
 * `scripts/probe-who-runs-internal-affairs.ts`, EVERY seated house with the
 * hall has a holder, 38 of 38 at world open and 32 of 32 at 500 years. What was
 * actually unreachable was the PLAYER holding it, because the read asked who
 * was standing at the hall and the player's row stands nowhere; it is the deal
 * the rooms are dealt by now, with the player in the roll.
 *
 * The second is reachable because a posting now puts somebody under the office
 * (`a-house-posts-the-one-being-played.ts`), which is the shape the owner
 * described: the elder's disciples cut for the disciples.
 *
 * THE ARRANGEMENT IS THE ENGINE'S OWN. The notice is read off the board the
 * player would read (`sectBoardFor`) after the house's blanks are drawn down,
 * which is the state that puts it up, and taken with the board's own writers
 * (`dutyFromOffer`, `acceptDuty`).
 *
 * Red-checked, each on its own: with the gate dropped, the refusal test goes
 * red; with the notice not counted as serving under the office, the board test
 * goes red; with the office not read off the deal, the office test goes red;
 * with the player's own posting not read as serving under it, the posted test
 * goes red.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';
import { acceptDuty, dutyFromOffer, membershipFor, sectBoardFor } from '../../src/web/encounters.js';
import { theReasonBehind } from '../../src/engine/encounters/what-a-house-has-on-its-board.js';
import {
    howManyTheHouseHas,
    takeOffTheStack
} from '../../src/engine/world/a-communication-talisman-carries-word-home.js';
import { FOUNDATION_ORDINAL } from '../../src/engine/cultivation/realms.js';
import { THE_NOTICE_FOR_CUTTING } from '../../src/web/who-cuts-the-houses-slips.js';
import { theCommunicationTalismansOnYou } from '../../src/web/sending-word-on-a-communication-talisman.js';
import { hallResponsibilities } from '../../src/engine/world/a-house-gives-one-elder-each-hall.js';
import { theOneIdAPersonIsKnownBy } from '../../src/engine/world/a-catalog-person-and-their-world-row.js';
import { portfoliosIn } from '../../src/engine/social-leverage/authority-for-an-order.js';
import { whoAnswersAbout } from '../../src/engine/social-leverage/what-an-elder-is-in-charge-of.js';
import { THE_ROOM_THE_ROLL_IS_KEPT_IN } from '../../src/engine/world/a-house-knows-its-own-by-a-lamp-and-a-token.js';
import { whereThisHouseBurnsItsLamps } from '../../src/engine/world/a-recruit-is-given-their-lamp-at-the-house.js';
import { aPostTheHouseWouldSendThemTo, theOneBeingPlayedLeavesThePost } from '../../src/engine/world/a-house-posts-the-one-being-played.js';
import { theMissionPostTheyHold } from '../../src/web/holding-a-mission-post.js';
import { postTag } from '../../src/web/serving-in-your-houses-hall.js';
import { appointHouseWorker, personnelManager } from '../../src/engine/world/internal-affairs-puts-somebody-to-the-work.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { standInTheWorld } from '../../src/web/the-player-as-a-row-the-world-can-invite.js';

const WORLD = 'who-cuts-the-slips';

/** A member at Foundation, standing at their house's seat, holding no office. */
async function aMemberWhoCanCut(seed: string) {
    const harness = await makeGameInWorld({ seed, worldSeed: WORLD });
    const { cultivator } = await harness.game.newRun('Cutter');
    await harness.game.act('I look around');
    const world = harness.game.atHand!;
    const house = world.factions.find(f =>
        f.dissolvedOnDay === null && f.seatLocationId !== null && harness.repos.sects.getById(f.id) !== null)!;
    harness.repos.sects.addMember(house.id, cultivator.id, 0);
    const seat = world.locations.find(l => l.id === house.seatLocationId)!;
    harness.repos.cultivators.update(cultivator.id, {
        location: seat.name,
        realmOrdinal: FOUNDATION_ORDINAL
    });
    return { ...harness, cultivator, house, world, seat };
}

const contribution = (h: Awaited<ReturnType<typeof aMemberWhoCanCut>>) =>
    h.repos.sects.getMembership(h.cultivator.id)?.contribution ?? 0;

describe('the house\'s own blanks', () => {
    it('are refused to somebody nobody handed the seal to, before any day is spent', async () => {
        const h = await aMemberWhoCanCut('slips-not-yours');
        const blanks = howManyTheHouseHas(h.world.objects, h.house.id);
        const before = contribution(h);
        const day = h.game.currentRun().run.elapsedDays;

        const turn = await h.game.act('I cut five communication talismans for the sect');

        expect(turn.toolCalls.some(call => call.action === 'craft' && !call.ok)).toBe(true);
        expect(turn.narration.toLowerCase()).toContain('internal affairs');
        // What would put it in their hands, so the refusal is a door and not a wall.
        expect(turn.narration.toLowerCase()).toMatch(/notice|posted|office/);
        expect(howManyTheHouseHas(h.game.atHand!.objects, h.house.id), 'blanks moved').toBe(blanks);
        expect(contribution(h), 'credited anyway').toBe(before);
        expect(h.game.currentRun().run.elapsedDays, 'a refusal cost days').toBe(day);
    }, 180_000);

    it('and a pair for yourself wants a foundation and nothing else', async () => {
        const h = await aMemberWhoCanCut('slips-for-yourself');
        const before = contribution(h);

        await h.game.act('I make some communication talismans');

        const held = theCommunicationTalismansOnYou(h.db, h.cultivator.id)
            .find(stack => stack.houseId === h.house.id)?.count ?? 0;
        expect(held, 'nothing reached the pouch').toBeGreaterThan(0);
        expect(contribution(h), 'a pair for yourself is not service').toBe(before);
    }, 180_000);
});

describe('the office itself', () => {
    it('is dealt, and whoever holds it cuts', async () => {
        const harness = await makeGameInWorld({ seed: 'slips-the-office', worldSeed: WORLD });
        const { cultivator } = await harness.game.newRun('Elder');
        await harness.game.act('I look around');
        const world = harness.game.atHand!;
        // A real incumbent keeps the seal when another elder joins. Arrange a vacancy
        // by releasing its claimants, then ask the engine who takes that actual chair.
        let found: { houseId: string; rank: number; released: Set<string> } | null = null;
        for (const house of world.factions) {
            if (house.dissolvedOnDay === null && house.seatLocationId !== null
                && harness.repos.sects.getById(house.id) !== null) {
                const rank = house.ranks.length - 1;
                const hall = hallResponsibilities(world, house.id).find(row => row.hall.id === 'internal-affairs');
                const released = new Set([...(hall?.existingClaimants ?? []), ...(hall?.holderId ? [hall.holderId] : [])]);
                const roll = [
                    ...world.npcs.filter(n => n.status === 'alive' && n.factionId === house.id && !released.has(n.id))
                        .map(n => ({ id: n.id, rankIndex: n.factionRankIndex })),
                    { id: cultivator.id, rankIndex: rank }
                ];
                const portfolios = portfoliosIn({ npcs: world.npcs,
                    locations: world.locations, sectId: house.id, roll, rankCount: house.ranks.length
                });
                if (whoAnswersAbout(portfolios, THE_ROOM_THE_ROLL_IS_KEPT_IN) === cultivator.id) {
                    found = { houseId: house.id, rank, released };
                    break;
                }
            }
        }
        expect(found, 'no house in this world deals the life lamp hall to anybody').toBeTruthy();
        for (const id of found!.released) {
            const person = world.npcs.find(row => row.id === id)!;
            theOneBeingPlayedLeavesThePost(world, { playerId: id, today: world.currentDay });
            person.factionId = null;
            harness.repos.sects.removeMember(found!.houseId, theOneIdAPersonIsKnownBy(id));
        }
        harness.repos.sects.addMember(found!.houseId, cultivator.id, found!.rank);
        const seat = world.locations.find(l => l.id === world.factions.find(f => f.id === found!.houseId)!.seatLocationId)!;
        harness.repos.cultivators.update(cultivator.id, {
            location: seat.name, realmOrdinal: FOUNDATION_ORDINAL
        });
        const blanks = howManyTheHouseHas(world.objects, found!.houseId);

        const turn = await harness.game.act('I cut five communication talismans for the sect');

        expect(turn.toolCalls.some(call => call.action === 'craft' && !call.ok), 'refused the office').toBe(false);
        // WHAT THEY CUT, NOT WHAT THE TREASURY NETS. This asked for the stock
        // to be higher afterwards, which assumes the player's slips are the
        // only thing that moves it across the turn. They are not: cutting five
        // spends two days at the bench, the world runs for those two days, and
        // `a-house-posts-the-one-being-played` takes a PAIR of blanks off the
        // stack for everybody it posts. Measured on this world - 72 before, the
        // house spent 33 posting, the player cut 5, and the engine's own line
        // said so: "You cut 5 blank communication talismans ... which now holds
        // 44." The cut worked and the count went down, and both are true.
        //
        // So the claim is asserted where it lives, in what the turn says the
        // player did. It is also the only assertion here that can tell a cut
        // from no cut at all: `some(craft && !ok)` is false when a craft was
        // refused AND when no craft call exists, and the success path emits no
        // engine call with that action.
        expect(turn.narration, 'the office holder did not cut')
            .toMatch(/cut \d+ blank communication talisman/i);
        expect(blanks).toBeGreaterThanOrEqual(0);
    }, 180_000);

    it('takes a disciple under it, and then they cut', async () => {
        const harness = await makeGameInWorld({ seed: 'slips-under-the-office', worldSeed: WORLD });
        const { cultivator } = await harness.game.newRun('Clerk');
        await harness.game.act('I look around');
        const world = harness.game.atHand!;
        const today = Math.floor(world.currentDay);
        // Ask the engine which real hall would offer its work after its clerk leaves.
        // Opening worlds are staffed, so an empty post must be arranged explicitly.
        let house = null as typeof world.factions[number] | null;
        for (const row of world.factions) {
            if (row.dissolvedOnDay !== null || row.seatLocationId === null
                || harness.repos.sects.getById(row.id) === null) continue;
            const clerks = new Set(theDisciplesPostedToInternalAffairs(world, row.id));
            const vacant = { ...world, npcs: world.npcs.map(n => clerks.has(n.id) ? { ...n, activity: null } : n) };
            const post = aPostTheHouseWouldSendThemTo(vacant, {
                houseId: row.id, playerId: cultivator.id, rankIndex: 0,
                ordinal: FOUNDATION_ORDINAL, today
            });
            if (!post?.insideTheWalls) continue;
            const seat = world.locations.find(place => place.id === row.seatLocationId)!;
            const room = world.locations.find(place => place.id === post.townId)!;
            const proposed = { ...vacant, history: { ...world.history, facts: [...world.history.facts] } };
            const manager = personnelManager(proposed, row.id);
            if (!manager) continue;
            const reception = theAreasOf(proposed, seat).areas.find(area => area.for === 'board')!;
            const receiving = { ...manager, locationId: seat.id, activity: { kind: 'stationed' as const,
                note: 'Receiving members for personnel appointments.', withIds: [], sinceDay: today, untilDay: null, standingIn: reception.id } };
            proposed.npcs = proposed.npcs.map(person => person.id === manager.id ? receiving : person);
            const applicant = standInTheWorld(proposed, { ...cultivator, location: seat.name, realmOrdinal: FOUNDATION_ORDINAL },
                { factionId: row.id, rankIndex: 0 }, today)!;
            // A vacancy alone is no promise: ask the actual personnel holder as well.
            if (!appointHouseWorker(proposed, { houseId: row.id, job: 'serving_internal_affairs', room, day: today,
                applicant: { ...applicant, locationId: seat.id }, posted: true, suitable: () => true,
                purpose: 'life_lamp_hall', calendar: { periodDays: 1, offset: 0, shift: 'day', rota: false } })) continue;
            for (const id of clerks) expect(theOneBeingPlayedLeavesThePost(world,
                { playerId: id, today })).toBe(true);
            world.npcs[world.npcs.findIndex(person => person.id === manager.id)] = receiving;
            house = row;
            break;
        }
        expect(house, 'no actual hall vacancy was offered').toBeTruthy();
        harness.repos.sects.addMember(house!.id, cultivator.id, 0);
        const seat = world.locations.find(l => l.id === house!.seatLocationId)!;
        harness.repos.cultivators.update(cultivator.id, {
            location: seat.name, realmOrdinal: FOUNDATION_ORDINAL
        });

        harness.repos.cultivators.standIn(cultivator.id, theAreasOf(world, seat).areas.find(area => area.for === 'board')!.id);
        // Played from here: the house puts it, the player says yes.
        const asked = await harness.game.act('I look around');
        expect(asked.narration.toLowerCase()).toContain('internal affairs');
        await harness.game.act('I accept');
        const hall = whereThisHouseBurnsItsLamps(world.locations, house!.id);
        const posting = theMissionPostTheyHold(harness.game, cultivator.id);
        expect(posting, 'no posting was written').not.toBeNull();
        expect(postTag(posting!, 'post-at:')).toBe(hall);
        const room = harness.game.atHand!.locations.find(place => place.id === hall)!;
        const walk = await harness.game.act(`I travel to ${room.name}`);
        expect(harness.game.worldPlaceOf(harness.repos.cultivators.getById(cultivator.id)!), walk.narration).toBe(hall);

        const blanks = howManyTheHouseHas(harness.game.atHand!.objects, house!.id);
        const before = harness.repos.sects.getMembership(cultivator.id)!.contribution;

        const turn = await harness.game.act('I cut five communication talismans for the sect');

        expect(turn.toolCalls.some(call => call.action === 'craft' && !call.ok), 'still refused').toBe(false);
        expect(howManyTheHouseHas(harness.game.atHand!.objects, house!.id)).toBeGreaterThan(blanks);
        expect(harness.repos.sects.getMembership(cultivator.id)!.contribution).toBeGreaterThan(before);
    }, 180_000);
});

describe('with the house\'s own notice taken off its board', () => {
    it('the same sentence is work for the house, and is counted', async () => {
        const h = await aMemberWhoCanCut('slips-off-the-board');
        // The state that puts the notice up: the house is short of its own blanks.
        takeOffTheStack(h.world.objects, {
            houseId: h.house.id,
            holderId: null,
            count: howManyTheHouseHas(h.world.objects, h.house.id)
        });
        const deps = { repos: h.repos, knowledge: h.game.knowledge, world: h.world };
        const now = h.repos.cultivators.getById(h.cultivator.id)!;
        const board = sectBoardFor(deps, now);
        const notice = board.offers.find(offer => theReasonBehind(offer.entry.id)?.id === THE_NOTICE_FOR_CUTTING);
        expect(notice, 'the house short of its own blanks posts nothing about them').toBeTruthy();

        const day = Math.floor(h.game.currentRun().run.elapsedDays);
        acceptDuty({
            repos: h.repos,
            cultivator: now,
            duty: dutyFromOffer(notice!, membershipFor(deps, now), day),
            onDay: day,
            entryId: notice!.entry.id,
            what: 'Took the notice off the board.'
        });
        const before = contribution(h);
        const blanks = howManyTheHouseHas(h.world.objects, h.house.id);

        const turn = await h.game.act('I cut five communication talismans for the sect');

        expect(turn.toolCalls.some(call => call.action === 'craft' && !call.ok), 'still refused').toBe(false);
        expect(howManyTheHouseHas(h.game.atHand!.objects, h.house.id)).toBeGreaterThan(blanks);
        expect(contribution(h), 'the house counted nothing for it').toBeGreaterThan(before);
    }, 180_000);
});
