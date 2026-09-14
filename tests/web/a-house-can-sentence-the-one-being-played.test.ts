/**
 * The whole judgement arc could happen to everybody except the player.
 *
 * `whatTheRoomDecides` has decided seven sentences since it was written and
 * `handDownWhatTheRoomDecided` has carried all seven out, and the only caller
 * was `complaintsBrought` - the player HOLDING the room and deciding somebody
 * else's case. That verb refuses somebody their own row and
 * `whereAComplaintGoes` sends a complaint over the offender's head, so the
 * offender was always somebody the world holds a row for. Measured by reading
 * the callers: every verb that opens an `AGAINST_THEIR_OWN` row about the player
 * - the library theft, the false decree, the furnace, the leak the player's own
 * house is told about - wrote one and nothing ever read it back at them. A house
 * could hold a theft against its own member for a whole run and the member paid
 * nothing.
 *
 * ── WHAT THESE ASSERTIONS ENCODE ─────────────────────────────────────────
 *
 * A SENTENCE ON THE PLAYER IS A STATE CHANGE ON THE PLAYER'S OWN SHEET. The
 * fine is read off `cultivators` and off the membership, never off the returned
 * line, for the reason the world half of this arc states: a sentence reported as
 * carried out that moved no state is the defect the carrying-out file exists to
 * close.
 *
 * NOBODY DECIDES THEIR OWN CASE, AT EITHER END. The room refuses it when the
 * player holds it; this is the same refusal read from the dock, and the answer
 * is that a house with nobody above the accused hands nothing down.
 *
 * SOMEBODY WHO OWES YOU SPEAKS, AND IT MOVES ONE RUNG. The intercession branch
 * had been reachable by construction and unreached by anything in `src/` since
 * it was written. Who speaks is read off the ledger rather than drawn, so the
 * assertion is that the SAME complaint lands one rung lighter when an open row
 * exists and lands where it was when none does.
 *
 * AND THE HEAVY SENTENCES ARE READ OUT. Only the seizure was. A house that seals
 * or ends one of its own and never says so leaves the world holding a hole and
 * no sentence, which is exactly the pair `taking-people-is-not-a-quiet-thing.ts`
 * is built to let somebody reconcile. The notice carries the name and the
 * sentence and never the cause.
 *
 * AND IT IS REACHED BY PLAYING. The module tests above arrange the room by hand,
 * which is a state no player occupies unless something calls it; the last one
 * plays a turn with a row standing and asserts the room sat.
 *
 * RED-CHECKED, all six, each against the change that would reintroduce the
 * defect. Dropping the `theRoomSitsOnYou` call from the turn fails the played
 * one and nothing else. Passing `intercession: null` fails the word. Holding
 * `readItOut` to the seizure fails the notice. Inverting the day gate to `>=`
 * fails all six, which is the honest reading: every case here stands on a row
 * the house was told about before today.
 */

import { describe, it, expect } from 'vitest';
import { makeGameInWorld } from './harness';
import { SECTS } from '../../src/data/cultivation/index';
import {
    theComplaintTheRoomSitsOn,
    theRoomSitsOnYou
} from '../../src/web/a-room-hands-one-down-to-you';
import { THE_ROOM_COMPLAINTS_GO_TO } from '../../src/engine/social-leverage/reporting-what-you-saw';
import { AGAINST_THEIR_OWN } from '../../src/engine/social-leverage/what-a-house-does-when-it-catches-you';
import { createObligation, type Severity } from '../../src/engine/social/grudges';
import { writeOneObligation } from '../../src/storage/repos/obligation.repo';

const HOUSE = SECTS
    .filter(sect => sect.recruits)
    .reduce((best, sect) => sect.id < best.id ? sect : best);

const ON_DAY = 10;

/**
 * A house, the player on its roll, and two other people on it.
 *
 * The rooms are handed over as data rather than dealt by `whoIsInChargeOfWhat`:
 * which rung gets which room is positional, and pinning it would pin the deal
 * instead of the sentence. The deal is exercised by the played test at the end.
 */
async function aPlayerInFrontOfTheRoom(seed: string) {
    const harness = await makeGameInWorld({ seed, worldSeed: 'sentenced-w' }) as any;
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

    const roll = [
        { id: elder.id, name: elder.name, rankIndex: 3, realmOrdinal: 20 },
        { id: friend.id, name: friend.name, rankIndex: 1, realmOrdinal: 5 }
    ];

    const complaint = (severity: Severity, onDay = 0) => {
        const row = createObligation({
            kind: 'grudge',
            holderId: HOUSE.id,
            subjectId: cultivator.id,
            cause: 'robbery',
            severity,
            onDay,
            description: 'they took a blade off the house\'s own holdings without asking',
            participants: [HOUSE.id],
            tags: [AGAINST_THEIR_OWN]
        });
        writeOneObligation(harness.db, row);
        return row;
    };

    /** Whichever of the three kinds of house answers this row with this rung. */
    const sit = (options: {
        severity: Severity;
        alignment: 'righteous' | 'neutral' | 'demonic';
        portfolios?: { purpose: string; holderId: string | null; depth: number }[];
        headId?: string | null;
    }) => theRoomSitsOnYou({
        repos: harness.repos,
        offender: harness.repos.cultivators.getById(cultivator.id)!,
        houseId: HOUSE.id,
        houseName: HOUSE.name,
        alignment: options.alignment,
        portfolios: (options.portfolios ?? [
            { purpose: THE_ROOM_COMPLAINTS_GO_TO, holderId: elder.id, depth: 0.65 }
        ]) as any,
        posts: [{
            purpose: THE_ROOM_COMPLAINTS_GO_TO,
            personId: friend.id,
            selectedById: elder.id
        }] as any,
        roll,
        rankCount: HOUSE.ranks.length,
        headId: options.headId === undefined ? elder.id : options.headId,
        world,
        onDay: ON_DAY,
        onTurn: 1,
        at: { id: world.locations[0].id, name: world.locations[0].name }
    });

    return { harness, world, cultivator, elder, friend, complaint, sit };
}

/** An open row somebody owes the player, so there is a word to be spent. */
function somebodyOwesThePlayer(harness: any, whoId: string, playerId: string) {
    writeOneObligation(harness.db, createObligation({
        kind: 'debt',
        holderId: playerId,
        subjectId: whoId,
        cause: 'other',
        severity: 'slight',
        onDay: 0,
        description: 'they were pulled out of a collapse and have not settled it',
        participants: [playerId, whoId]
    }));
}

describe('a house can sentence the one being played', () => {
    it('takes a fine off the player\'s own sheet and closes the row', async () => {
        const { harness, cultivator, complaint, sit } =
            await aPlayerInFrontOfTheRoom('sentenced-fine');
        const row = complaint('slight');

        const before = harness.repos.cultivators.getById(cultivator.id)!.spiritStones;
        const sat = sit({ severity: 'slight', alignment: 'neutral' })!;

        expect(sat.handed?.decided.sentence).toBe('a fine');
        // The sheet, not the line.
        expect(harness.repos.cultivators.getById(cultivator.id)!.spiritStones)
            .toBeLessThan(before);
        expect(sat.handed!.contributionTaken).toBeGreaterThan(0);
        // And the complaint is not still open afterwards.
        expect(theComplaintTheRoomSitsOn(harness.repos, HOUSE.id, cultivator.id, ON_DAY))
            .toBeNull();
        expect(sat.complaint.id).toBe(row.id);
    }, 300_000);

    it('does not sit on a row the house was told about today', async () => {
        const { harness, cultivator, complaint } =
            await aPlayerInFrontOfTheRoom('sentenced-sameday');
        complaint('slight', ON_DAY);

        expect(theComplaintTheRoomSitsOn(harness.repos, HOUSE.id, cultivator.id, ON_DAY))
            .toBeNull();
    }, 300_000);

    it('hands nothing down where the only seat is the accused\'s own', async () => {
        const { cultivator, complaint, sit } = await aPlayerInFrontOfTheRoom('sentenced-alone');
        complaint('slight');

        // The player holds the room AND is the most senior person in it, which
        // is the arrangement `whereAComplaintGoes` answers with nobody. With a
        // head above them it goes to the head, which the other cases exercise.
        const sat = sit({
            severity: 'slight',
            alignment: 'neutral',
            headId: null,
            portfolios: [{
                purpose: THE_ROOM_COMPLAINTS_GO_TO, holderId: cultivator.id, depth: 0.65
            }]
        })!;

        expect(sat.decidedBy).toBeNull();
        expect(sat.handed).toBeNull();
    }, 300_000);

    it('lands one rung lighter when somebody who owes the player speaks', async () => {
        const alone = await aPlayerInFrontOfTheRoom('sentenced-alone-word');
        alone.complaint('slight');
        const onTheirOwn = alone.sit({ severity: 'slight', alignment: 'neutral' })!;

        const spoken = await aPlayerInFrontOfTheRoom('sentenced-spoken-for');
        spoken.complaint('slight');
        somebodyOwesThePlayer(spoken.harness, spoken.friend.id, spoken.cultivator.id);
        const spokenFor = spoken.sit({ severity: 'slight', alignment: 'neutral' })!;

        expect(onTheirOwn.spokeForYou).toBeNull();
        expect(spokenFor.spokeForYou?.id).toBe(spoken.friend.id);
        // The same row, one rung apart, and the rung it would have been is kept.
        expect(spokenFor.handed!.decided.beforeAnybodySpoke)
            .toBe(onTheirOwn.handed!.decided.sentence);
        expect(spokenFor.handed!.decided.sentence)
            .not.toBe(onTheirOwn.handed!.decided.sentence);
    }, 300_000);

    it('reads a death out, naming the sentence and not the reason', async () => {
        const { world, cultivator, complaint, sit } =
            await aPlayerInFrontOfTheRoom('sentenced-death');
        complaint('unforgivable');

        const sat = sit({ severity: 'unforgivable', alignment: 'demonic' })!;

        expect(sat.handed?.decided.sentence).toBe('death');
        expect(sat.handed?.ended).toBe(true);
        expect(sat.handed?.readOut).toBe(true);

        const said = world.history.facts.filter((fact: any) => fact.kind === 'said_in_public');
        expect(said).toHaveLength(1);
        expect(said[0].summary).toContain(cultivator.name);
        expect(said[0].summary).not.toContain('without asking');
    }, 300_000);

    it('is reached by playing a turn with a row standing', async () => {
        const { harness, cultivator, complaint } = await aPlayerInFrontOfTheRoom('sentenced-played');
        complaint('slight');

        // Days through the game's own seclusion path, so the two clocks stay
        // one clock and the room has a day to sit on.
        await harness.game.cultivate(10, { anyway: true });
        const acted = await harness.game.act('where do I stand in the sect');

        expect(acted.toolCalls.some((call: any) => call.name === 'social.theRoomSitsOnYou'))
            .toBe(true);
    }, 300_000);
});
