/**
 * What the house asked for is said in words, never as the row it came off.
 *
 * FOUND BY PLAYING an escort, and reproduced verbatim by the first case below
 * before the fix. Saying yes to a standing summons opened with:
 *
 *     You tell Azure Dew Sect yes, and go.
 *     posted-sect-azure-dew-sect-sending-an-escort-20: 60 days, 120
 *     contribution and 56 spirit stones on completion, with 4 of the house
 *     alongside.
 *
 * and the span under it carried the same id into the prose:
 *
 *     Emerald Water City. You went out to it. Sect duty:
 *     posted-sect-azure-dew-sect-sending-an-escort-20 of 2 months was intended.
 *
 * ── THE CAUSE ────────────────────────────────────────────────────────────
 *
 * `getEncounter` reads the HAND-AUTHORED catalog in `data/cultivation/
 * encounters.ts`. A house's own work is not in it and never was: the board
 * generates its rows at read time in `aPostingAsAnOffer`, with the id
 * `posted-<house>-<reason>-<pitch>`. So the lookup missed for every posting a
 * house has ever made, and the `?? entryId` fallback handed the row id to a
 * player-facing sentence.
 *
 * The catalog was the wrong place to ask. The id is not opaque - it is built
 * out of a closed table of reasons and `theReasonBehind` already reads one back
 * out of it, which is how `attemptSummons` knows how many hands an errand
 * takes. The reason carries the same name the board prints on the notice.
 *
 * ── WHAT THIS TEST PINS ──────────────────────────────────────────────────
 *
 * One rule, and it is not about escorts: NOTHING A PLAYER READS IS A ROW ID.
 * Asserted on the shape of an id rather than on any particular name, because
 * which occasion the house offers and what it is called are both the engine's
 * to choose - and the sentence is checked for the reason's own words so that
 * a fallback which is merely id-free cannot pass.
 *
 * Only the summons ROLL is bypassed; the occasion is taken off the real
 * generator against a real world, the way `an-escort-is-not-always-an-errand`
 * does it.
 *
 * RED-CHECKED: with `called` back to `getEncounter(...)?.name ?? entryId`, both
 * cases fail on the id appearing in what the player is told.
 */

import { describe, expect, it } from 'vitest';

import { SECTS } from '../../src/data/cultivation/index';
import { whatAHouseWouldSendYouOn } from '../../src/engine/encounters/duties';
import { theReasonBehind } from '../../src/engine/encounters/what-a-house-has-on-its-board';
import { whoASeniorIsAskedToTakeOut } from '../../src/engine/encounters/who-a-senior-is-asked-to-take-out';
import { dutyFromOffer, membershipFor, theHouseAsItStands } from '../../src/web/encounters';
import { rememberSummons } from '../../src/web/pending-summons';
import { makeGameInWorld } from './harness';

/** The shape of a generated board row, wherever it turns up. */
const A_ROW_ID = /posted-[a-z0-9-]+/;

const HOUSE = SECTS
    .filter(sect => sect.recruits)
    .reduce((best, sect) =>
        sect.admissionOrdinal < best.admissionOrdinal
        || (sect.admissionOrdinal === best.admissionOrdinal && sect.id < best.id)
            ? sect : best);

async function anElderOf(seed: string) {
    const harness = await makeGameInWorld({
        seed, worldSeed: `world-${seed}`
    }) as any;
    const { game, repos, db } = harness;
    const { cultivator } = await game.newRun('Wen Shu');
    db.prepare('UPDATE cultivators SET realm_ordinal = ? WHERE id = ?').run(20, cultivator.id);
    repos.sects.addMember(HOUSE.id, cultivator.id, 2);
    const senior = repos.cultivators.getById(cultivator.id)!;
    const deps = { repos, knowledge: game.knowledge, world: game.atHand } as any;
    return { game, repos, senior, deps, membership: membershipFor(deps, senior) };
}

function rollOf(game: any) {
    return game.atHand.npcs
        .filter((npc: any) => npc.factionId === HOUSE.id && npc.status === 'alive')
        .map((npc: any) => ({
            id: npc.id,
            name: npc.name,
            rankIndex: npc.factionRankIndex,
            realmOrdinal: npc.cultivation.realmOrdinal
        }));
}

/** Whatever the house would actually put to this elder, off the real generator. */
function anOccasionFor(deps: any, senior: any, membership: any) {
    const standing = theHouseAsItStands(deps, senior, membership);
    expect(standing, 'the player is on nobody\'s roll').not.toBeNull();
    const offers = whatAHouseWouldSendYouOn({
        ordinal: senior.realmOrdinal,
        membership,
        house: standing!.house,
        reachOfTheHouse: standing!.reach,
        reachOfTheRest: standing!.reachOfTheRest,
        givenBy: { rankIndex: membership.rankCount - 1, isHead: true }
    }).filter(candidate => theReasonBehind(candidate.entry.id) !== null);
    expect(offers.length, 'the house posts nothing of its own').toBeGreaterThan(0);
    return offers[0];
}

/** Arrange the ask and say yes to it. Only the summons roll is bypassed. */
async function saysYes(seed: string) {
    const { game, repos, senior, deps, membership } = await anElderOf(seed);
    const candidate = anOccasionFor(deps, senior, membership);
    const duty = dutyFromOffer(candidate, membership, 0);
    const takingOut = whoASeniorIsAskedToTakeOut({
        pitchOrdinal: duty.pitchOrdinal,
        hands: theReasonBehind(candidate.entry.id)!.hands,
        roster: rollOf(game),
        seniorId: senior.id,
        seniorOrdinal: senior.realmOrdinal
    });

    rememberSummons(repos, senior.id, {
        duty: { ...duty, takingOut, cohort: takingOut.length },
        entryId: candidate.entry.id,
        what: candidate.entry.summaryTemplate,
        spokenOnDay: 0
    });

    const turn = await game.act('I accept');
    // What the player READS. `toolCalls` is the operator channel and an id is
    // at home there, so it is deliberately not in this.
    return { candidate, said: turn.narration };
}

describe('saying yes to what a house posted', () => {
    it('names the work rather than the row it came off', async () => {
        const { said } = await saysYes('ask-is-named');

        expect(said, `a row id reached the player: ${said.match(A_ROW_ID)?.[0]}`)
            .not.toMatch(A_ROW_ID);
    }, 300_000);

    it('names it with the words the notice itself uses', async () => {
        const { candidate, said } = await saysYes('ask-is-named-in-the-board-s-words');
        const reason = theReasonBehind(candidate.entry.id)!;

        // Read out of the generator rather than written here: any name the
        // board prints is a name the ask has to be able to print.
        expect(said, `the ask never said what it was`).toContain(reason.name);
    }, 300_000);
});
