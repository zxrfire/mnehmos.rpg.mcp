/**
 * A player who only ever takes free actions could not be reached at all.
 *
 * ── THE GAP, AS THE PASS THAT MADE IT WROTE IT DOWN ──────────────────────
 *
 * `theRoomSitsOnYou` sits only on rows the house was told about on an EARLIER
 * day. That gate is right - being caught and being sentenced are two events, and
 * the space between them is what an intercession lives in - and its cost was
 * recorded honestly at the time: a player who only ever takes free actions is
 * never sentenced, because no day passes and `incurredOnDay < onDay` is never
 * true. `OPEN-QUESTIONS.md` carried it as a known gap.
 *
 * The ruling is not that a free action should cost a day. Haggling is not a day
 * and would not be one anywhere else either. It is that the world can interrupt
 * somebody who is only taking free actions.
 *
 * ── WHAT THESE ASSERTIONS ENCODE ─────────────────────────────────────────
 *
 * THE DAY GATE IS UNTOUCHED. The room still refuses a row it was told about
 * today, and the first assertion here is the same one the sentencing test makes
 * from the other end.
 *
 * THE WORLD REACHES A PLAYER WHO SPENDS NOTHING. A free turn with a row standing
 * that the room cannot yet sit on ends with the house having come for them, the
 * day gone, and the room having sat - all in that turn.
 *
 * AND IT DOES NOT FIRE WHEN THERE IS NOTHING WAITING. A free turn with no such
 * row spends nothing, which is the whole of the free-action ruling and is the
 * assertion that would catch this becoming a day tax.
 *
 * NOBODY COMES WHERE NOBODY COULD DECIDE IT. The same shortage
 * `whereAComplaintGoes` already answers with nobody: a house that cannot sit on
 * a thing has no reason to have somebody brought in front of a room that is not
 * there, and fetching them every turn for a row nothing can close would be the
 * world spending a player's days on an errand with no end.
 *
 * RED-CHECKED: dropping the `theHouseDoesNotWaitForYouToSpendADay` call from the
 * turn fails `reaches a player who only takes free actions` and nothing else.
 * Removing the `theTurnSpentNoDay` guard leaves every assertion here green,
 * which is why the third one exists and reads the clock rather than the calls.
 */

import { describe, it, expect } from 'vitest';
import { makeGameInWorld } from './harness';
import { SECTS } from '../../src/data/cultivation/index';
import { theComplaintTheRoomSitsOn } from '../../src/web/a-room-hands-one-down-to-you';
import {
    theComplaintNoDayHasPassedOn,
    theHouseComesForYou
} from '../../src/web/a-house-does-not-wait-for-you-to-spend-a-day';
import { THE_ROOM_COMPLAINTS_GO_TO } from '../../src/engine/social-leverage/reporting-what-you-saw';
import { AGAINST_THEIR_OWN } from '../../src/engine/social-leverage/what-a-house-does-when-it-catches-you';
import { createObligation, type Severity } from '../../src/engine/social/grudges';
import { writeOneObligation } from '../../src/storage/repos/obligation.repo';

const HOUSE = SECTS
    .filter(sect => sect.recruits)
    .reduce((best, sect) => sect.id < best.id ? sect : best);

const A_FREE_SENTENCE = 'where do I stand in the sect';

/**
 * A player on a house's roll, with the rooms dealt by hand.
 *
 * Which rung gets which room is positional and pinning it would pin the deal
 * rather than the behaviour - so the rooms are handed over, exactly as the
 * sentencing test does, and the played assertions go through the real turn.
 */
async function aPlayerStandingStill(seed: string) {
    const harness = await makeGameInWorld({ seed, worldSeed: 'not-waiting-w' }) as any;
    const { cultivator } = await harness.game.newRun('Wen Shu');
    harness.repos.sects.addMember(HOUSE.id, cultivator.id, 0);
    harness.repos.cultivators.update(cultivator.id, { spiritStones: 4000 });
    harness.repos.sects.addContribution(HOUSE.id, cultivator.id, 4000);

    const world = await harness.game.loadWorld();
    const ours = world.npcs.filter((npc: any) =>
        npc.factionId === HOUSE.id && npc.status === 'alive');
    const elder = ours[0];
    const friend = ours[1];
    expect(elder, 'the world seeds this house with people').toBeDefined();
    expect(friend, 'the world seeds this house with more than one').toBeDefined();

    const today = (): number =>
        Math.floor(harness.repos.runs.getActiveRun(cultivator.id)!.elapsedDays);

    /** A row the house opened TODAY, which is the case the room cannot sit on. */
    const toldToday = (severity: Severity = 'slight') => {
        const row = createObligation({
            kind: 'grudge',
            holderId: HOUSE.id,
            subjectId: cultivator.id,
            cause: 'robbery',
            severity,
            onDay: today(),
            description: 'they took a blade off the house\'s own holdings without asking',
            participants: [HOUSE.id],
            tags: [AGAINST_THEIR_OWN]
        });
        writeOneObligation(harness.db, row);
        return row;
    };

    return { harness, cultivator, elder, friend, today, toldToday };
}

describe('a house does not wait for you to spend a day', () => {
    it('leaves the room\'s own day gate exactly where it was', async () => {
        const { harness, cultivator, today, toldToday } =
            await aPlayerStandingStill('not-waiting-gate');
        const row = toldToday();

        // The room refuses it, and the complement read finds the same row.
        expect(theComplaintTheRoomSitsOn(harness.repos, HOUSE.id, cultivator.id, today()))
            .toBeNull();
        expect(theComplaintNoDayHasPassedOn(
            harness.repos, HOUSE.id, cultivator.id, today()
        )?.id).toBe(row.id);
    }, 300_000);

    it('sends nobody where the house has nobody who could decide it', async () => {
        const { harness, cultivator, elder, toldToday, today } =
            await aPlayerStandingStill('not-waiting-nobody');
        toldToday();

        const came = theHouseComesForYou({
            repos: harness.repos,
            accusedId: cultivator.id,
            houseId: HOUSE.id,
            houseName: HOUSE.name,
            // The player holds the room and there is nobody above them, which
            // is the arrangement `whereAComplaintGoes` answers with nobody.
            portfolios: [{
                purpose: THE_ROOM_COMPLAINTS_GO_TO, holderId: cultivator.id, depth: 0.65
            }] as any,
            posts: [{
                purpose: THE_ROOM_COMPLAINTS_GO_TO,
                personId: elder.id,
                selectedById: elder.id
            }] as any,
            roll: [{ id: elder.id, name: elder.name, rankIndex: 3, realmOrdinal: 20 }],
            headId: null,
            onDay: today()
        });
        expect(came).toBeNull();
    }, 300_000);

    it('reaches a player who only takes free actions', async () => {
        const { harness, cultivator, today, toldToday } =
            await aPlayerStandingStill('not-waiting-played');
        const row = toldToday();
        const dayBefore = today();

        const acted = await harness.game.act(A_FREE_SENTENCE);
        const names = acted.toolCalls.map((call: any) => call.name);

        // The house came, the day went with them, and the room sat on it - all
        // inside one turn the player spent nothing on.
        expect(names).toContain('social.theHouseComesForYou');
        expect(names).toContain('social.theRoomSitsOnYou');
        expect(today()).toBeGreaterThan(dayBefore);
        // The row is not still open afterwards, which is the point of the arc.
        expect(theComplaintTheRoomSitsOn(harness.repos, HOUSE.id, cultivator.id, today()))
            .toBeNull();
        expect(theComplaintNoDayHasPassedOn(harness.repos, HOUSE.id, cultivator.id, today()))
            .toBeNull();
        expect(row.status).toBe('open');
    }, 300_000);

    it('spends nothing on a free turn with nothing waiting', async () => {
        // THE FREE ACTION RULING, ASSERTED. Haggling is not a day, and the
        // interruption above must not have quietly made it one.
        const { harness, today } = await aPlayerStandingStill('not-waiting-free');
        const dayBefore = today();

        const acted = await harness.game.act(A_FREE_SENTENCE);
        expect(acted.toolCalls.map((call: any) => call.name))
            .not.toContain('social.theHouseComesForYou');
        expect(today()).toBe(dayBefore);
        expect(harness).toBeDefined();
    }, 300_000);
});
