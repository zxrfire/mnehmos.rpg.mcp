/**
 * The house sends for its elder, and what it says is not a request.
 *
 * The sibling of `tests/engine/encounters/a-house-sends-for-its-own-at-every-rung.test.ts`,
 * which proves the pool at the engine layer. This one proves the whole join:
 * a real member, in a real house, in a pinned world, reached by the encounter
 * window the game actually rolls.
 *
 * ── WHAT WAS MEASURED, BEFORE ANY OF THIS ────────────────────────────────
 *
 * `summonsPool` reads eight hand-authored entries and filters them on their
 * ordinal windows alone. Swept at every even rung from 0 to MAX_ORDINAL, at the
 * bottom rung of a house and at its top:
 *
 *     ordinal 0-32    2 to 5 summonses, IDENTICAL at rankIndex 0 and 5
 *     ordinal 34-46   nothing, at either rung
 *
 * So the house stopped sending for somebody at the rung that made them worth
 * sending, and until then it had never once cared what rung of its own ladder
 * they stood on.
 *
 * ── AND THE REACH WAS TAKEN OFF EVERYBODY EXCEPT THE PERSON BEING ASKED ──
 *
 * `whatTheHouseItselfNeedsDone` bounded the board by the highest rung any
 * living NPC of the house stood on, which is right for a stranger reading a
 * wall and wrong for a member: an elder above their own house's strongest NPC
 * has every posting pinned ten or more rungs beneath them, which is the band
 * `summonable` drops, so the board would empty at exactly the rung that made
 * them the person the house would send. The reach now counts the member,
 * because the member is on the roll.
 *
 * MEASURED HONESTLY, AND IT IS NOT WHAT MADE THESE GREEN. The reach change was
 * toggled off and every assertion below still passed: the house used here has
 * an NPC standing near the rung the elder was arranged at, so the clamp never
 * bit. The rule is pinned directly instead, in the third case, rather than
 * through a case that would pass either way - a test that cannot fail is worse
 * than no test.
 *
 * ── WHAT WENT RED FIRST ──────────────────────────────────────────────────
 *
 *   x an elder above the catalogue's ceiling is still sent for
 *       -> 0 summonses across 40 seeds at ordinal 40
 *   x what the house sends its elder on is the head's word, not an ask
 *       -> no summons existed at that rung to carry a posture
 *   x the house's reach counts the member reading the board
 *       -> theHouseAsItStands did not exist; the reach was NPCs only
 *
 * ── AND THEN THE DELIVERY WAS SPLIT, WHICH MOVED THE LAST CASE ───────────
 *
 * The change above left both channels reading the same rows, so an elder both
 * read their orders off a wall and was sent for. The design owner: *"tasks for
 * elders aren't on the board, they're word of mouth"*, *"the board is for
 * disciples"*. `how-an-ask-reaches-somebody.ts` splits them on the band a notice
 * already reads, and an elder's board now carries the house's work as something
 * said rather than something posted.
 *
 * The last case here asserted `offers.length > 0` and was rewritten, not
 * relabelled: the rule it protects - THE BOARD NEVER GOES SILENT AT A HIGH RUNG -
 * is the same one, and it is now pinned on the board having something to say
 * rather than something to hand over. The reach fix it was written for is still
 * pinned directly, in the third case.
 */

import { describe, expect, it } from 'vitest';

import {
    encountersFor,
    membershipFor,
    sectBoardFor,
    theHouseAsItStands
} from '../../src/web/encounters';
import { MAX_ORDINAL } from '../../src/engine/cultivation/realms';
import { makeGameInWorld } from './harness';

const A_HOUSE = 'sect-azure-cloud-pavilion';
const A_WORLD = 'house-sends-for-its-elder';

/** Deep enough that the hand-authored summons windows have all closed. */
const ABOVE_THE_CATALOGUE = 40;

async function anElderOf(house: string, ordinal: number) {
    const { game, repos, db } = await makeGameInWorld({
        seed: 'elder-sent-for', worldSeed: A_WORLD, worldEnabled: true
    });
    const { cultivator } = await game.newRun('Elder');
    // Arranged rather than played. Both halves are reachable by playing -
    // `sect join` puts somebody on a roll and `sect promote` raises them once
    // the contribution is earned and spent - and forty played turns of earning
    // contribution is a fixture that goes flaky rather than a test.
    repos.sects.addMember(house, cultivator.id, 0);
    const sect = repos.sects.getById(house)!;
    repos.sects.setRank(house, cultivator.id, sect.ranks.length - 2);
    db.prepare('UPDATE cultivators SET realm_ordinal = ? WHERE id = ?')
        .run(ordinal, cultivator.id);

    const world = await game.loadWorld();
    const deps = {
        repos, world,
        knowledge: { knows: () => true, isAwareOf: () => true, learn: () => undefined }
    } as never;
    return { game, repos, db, deps, sect, cultivator: repos.cultivators.getById(cultivator.id)! };
}

/**
 * Every summons the window produces over a sweep of seeds.
 *
 * A sweep rather than one pinned seed because the ask is a roll: what is being
 * asserted is that the house CAN send for somebody at this rung, and one seed
 * answering no proves nothing either way.
 */
function summonsesAcrossSeeds(deps: never, cultivator: never, seeds: number) {
    const out: { posture: string; entryId: string }[] = [];
    for (let i = 0; i < seeds; i += 1) {
        const roll = encountersFor(deps, {
            seed: `sweep-${i}`,
            startDay: 100 + i,
            days: 90,
            activity: 'labour',
            cultivator,
            // `known`, which is the vocabulary's own "where people know to look
            // for you" - and the state a house that sends for somebody is
            // reading. This said `public`, which is not one of the three, and
            // `arrival-exposure-read` reads anything that is neither `known`
            // nor `hidden` as `private`: the sweep was running under the one
            // state in which nobody comes looking.
            locatability: 'known'
        });
        for (const occurrence of roll.occurrences) {
            if (!occurrence.duty || occurrence.duty.origin !== 'summons') continue;
            out.push({ posture: occurrence.duty.posture, entryId: occurrence.entryId ?? occurrence.id });
        }
    }
    return out;
}

describe('the house sends for its elder', () => {
    it('sends for somebody standing above every window the catalogue has', async () => {
        const at = await anElderOf(A_HOUSE, ABOVE_THE_CATALOGUE);
        const sent = summonsesAcrossSeeds(at.deps, at.cultivator as never, 40);
        expect(sent.length).toBeGreaterThan(0);
        // And what reached them is the house's own business rather than a
        // catalogue row that happened to have a wide enough window.
        expect(sent.some(row => row.entryId.startsWith('posted-'))).toBe(true);
    }, 300_000);

    it('and what it sends them on is told, not asked', async () => {
        const at = await anElderOf(A_HOUSE, ABOVE_THE_CATALOGUE);
        const sent = summonsesAcrossSeeds(at.deps, at.cultivator as never, 40)
            .filter(row => row.entryId.startsWith('posted-'));
        expect(sent.length).toBeGreaterThan(0);
        for (const row of sent) expect(row.posture).toBe('told');
    }, 300_000);

    it('and the house counts the elder standing in it when it works out its reach', async () => {
        // Pinned at the rule rather than through the board, because the board
        // answers the same either way in a house that already has somebody
        // high in it. What is being asserted is that a member is one of the
        // people their house could send, however far above the rest they are.
        const at = await anElderOf(A_HOUSE, MAX_ORDINAL);
        const membership = membershipFor(at.deps, at.cultivator);
        expect(membership).not.toBeNull();

        const asAMember = theHouseAsItStands(at.deps, at.cultivator, membership);
        expect(asAMember!.reach).toBe(MAX_ORDINAL);

        // And a stranger reading the same wall is not one of them, however
        // high they stand: a house cannot send somebody who is not its own.
        const asAStranger = theHouseAsItStands(at.deps, at.cultivator, null);
        expect(asAStranger === null || asAStranger.reach < MAX_ORDINAL).toBe(true);
    }, 300_000);

    it('and a member still reads a board that says something up there', async () => {
        // REWRITTEN, AND THE RULE IT PROTECTS IS UNCHANGED: the board must never
        // go silent at a high rung. What changed is the design owner's ruling on
        // how a house's work reaches an elder - *"tasks for elders aren't on the
        // board, they're word of mouth"*, *"the board is for disciples"* - so at
        // this rung the honest board carries no OFFER of the house's own work
        // and must still say the work is there and how it comes.
        //
        // The original assertion was `offers.length > 0`, which pinned the fix
        // for the reach clamp through a surface that now legitimately answers
        // the other way. Asserting the board is not EMPTY is the same rule at
        // the altitude the ruling put it.
        const at = await anElderOf(A_HOUSE, ABOVE_THE_CATALOGUE);
        const board = sectBoardFor(at.deps, at.cultivator);
        expect(board.membership).not.toBeNull();
        expect(board.offers.length + board.refusals.length).toBeGreaterThan(0);

        // And what it says names the road instead of showing bare wood.
        expect(board.refusals.length).toBeGreaterThan(0);
        expect(board.refusals.some(row => /word/i.test(row.reason))).toBe(true);
    }, 300_000);

    it('and some of what it sends them on is going out with juniors', async () => {
        // THE ASK THE DESIGN OWNER CALLS THE LIKELY ONE: *"a diff elder or the
        // patriarch asks this elder to take some disciples out (disciples who
        // have accepted a mission to go out of the sect for one reason or
        // another)"*.
        //
        // MEASURED BEFORE ANY OF IT, over 60 seeds at ordinal 40 in this world:
        // 3 asks, 0 of them about anybody but the person being asked. There was
        // no road at all - `whatAHouseWouldSendYouOn` dropped every posting
        // pitched under the reader on `summonable`, which is the right rule for
        // *would the house spend this person on this* and the wrong question
        // when the answer is that somebody has to go with the juniors. After:
        // 3 asks, 2 of them an escort.
        //
        // NOTHING GENERATES AN ESCORT. The occasion is a posting the board
        // already made at a junior's rung, and the party is `whoTheHouseCanSend`
        // read against the roll - the same pass the world uses for parties the
        // player never sees. A second duty generator for elders would be a
        // parallel board and the two would disagree within a month.
        const at = await anElderOf(A_HOUSE, ABOVE_THE_CATALOGUE);
        const escorts: { party: readonly { name: string; realmOrdinal: number }[];
            spokenBy: string | null; cohort: number }[] = [];
        for (let i = 0; i < 60; i += 1) {
            const roll = encountersFor(at.deps, {
                seed: `escort-${i}`, startDay: 100 + i, days: 90,
                activity: 'labour', cultivator: at.cultivator, locatability: 'public'
            } as never);
            for (const occurrence of roll.occurrences) {
                const duty = occurrence.duty;
                if (!duty || duty.origin !== 'summons') continue;
                if ((duty.takingOut ?? []).length === 0) continue;
                escorts.push({
                    party: duty.takingOut,
                    spokenBy: duty.spokenBy?.name ?? null,
                    cohort: duty.cohort
                });
            }
        }
        expect(escorts.length, 'no ask is ever about anybody but the elder').toBeGreaterThan(0);

        for (const ask of escorts) {
            // Everybody taken stands under the person taking them. An escort
            // whose party outranks its escort is the party going alone.
            for (const member of ask.party) {
                expect(member.realmOrdinal).toBeLessThan(ABOVE_THE_CATALOGUE);
            }
            // A person with a name put it, which is what `word_of_mouth` means.
            expect(ask.spokenBy).not.toBeNull();
            // ONE COUNT. `cohort` and the named party are the same people, and
            // carrying both numbers put "5 of the house alongside" on the same
            // screen as eight named people.
            expect(ask.cohort).toBe(ask.party.length);
        }
    }, 300_000);

    it('and a rogue is sent for by nobody, which is what being on no roll means', async () => {
        const { game, repos } = await makeGameInWorld({
            seed: 'rogue-not-sent-for', worldSeed: A_WORLD, worldEnabled: true
        });
        const { cultivator } = await game.newRun('Rogue');
        const world = await game.loadWorld();
        const deps = {
            repos, world,
            knowledge: { knows: () => true, isAwareOf: () => true, learn: () => undefined }
        } as never;
        expect(summonsesAcrossSeeds(deps, cultivator as never, 20)).toEqual([]);
    }, 300_000);
});
