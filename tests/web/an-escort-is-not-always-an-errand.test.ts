/**
 * A senior asked to take juniors out was always asked to take them on an ERRAND.
 *
 * The escort path composes its occasion from whatever the house had on its
 * board, and the board is `SENDING_REASONS` filtered by `NEED_PREDICATES`. So
 * the spread of OCCASIONS is that catalog and nothing else, and before this
 * change every row in it was work: materials, a tribute run, a recruiting trip,
 * a war. There was no row for the two things the genre does most - one house
 * receiving another, and two houses putting their juniors against each other.
 *
 * MEASURED, through `scripts/probe-what-occasions-a-house-can-offer.ts`, twelve
 * pinned worlds, every house with a roll of two or more:
 *
 *                        occasions that ever reach a senior as an escort
 *     freshly seeded          10  ->  12
 *     two hundred years in    11  ->  14
 *
 * At day 0 the visit and the competition each reach 456 of 456 houses; at two
 * hundred years, 427 of 429, and the two that drop out are houses whose whole
 * province has gone hostile to them. That last number is the point: the
 * counterparty is read off `circleCandidatesFor`, which is the reading the world
 * already uses to decide who it holds a gathering between, so a house is offered
 * a visit to exactly the bodies the world would have put it in a room with.
 *
 * ── WHAT THIS TEST PINS ──────────────────────────────────────────────────
 *
 * Three claims, all behavioural:
 *
 *   1. The occasions are REACHABLE BY PLAY. The candidate is taken off the real
 *      generator against a real world, not hand-written, which is the difference
 *      between a fixture and a feature. Only the summons roll is bypassed.
 *   2. Saying yes puts the named juniors on the road, whichever occasion it was.
 *   3. The two occasions are DIFFERENT SCENES. What the engine states about a
 *      visit and about a competition share no sentence, because the scene comes
 *      from the reason's own `what` and not from a template with the noun
 *      swapped.
 *
 * It does NOT pin which house is visited, or that any particular seed produces
 * any particular occasion: both are the engine's choosing and pinning either
 * would fail the next time a house moves province.
 *
 * RED-CHECKED: with `sitsDownWith` dropped from the house the web layer builds,
 * `theOccasion` finds nothing for either id and the first two tests fail on the
 * generator rather than on the assertion.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';
import { SECTS } from '../../src/data/cultivation/index';
import { whatAHouseWouldSendYouOn } from '../../src/engine/encounters/duties';
import { theReasonBehind } from '../../src/engine/encounters/what-a-house-has-on-its-board';
import { whoASeniorIsAskedToTakeOut } from '../../src/engine/encounters/who-a-senior-is-asked-to-take-out';
import { dutyFromOffer, membershipFor, theHouseAsItStands } from '../../src/web/encounters';
import { rememberSummons } from '../../src/web/pending-summons';

const A_VISIT = 'sending-to-be-received';
const A_COMPETITION = 'sending-to-a-friendly-competition';

/** The house a player can actually get into at the bottom of the ladder. */
const HOUSE = SECTS
    .filter(sect => sect.recruits)
    .reduce((best, sect) =>
        sect.admissionOrdinal < best.admissionOrdinal
        || (sect.admissionOrdinal === best.admissionOrdinal && sect.id < best.id)
            ? sect : best);

/**
 * An elder of that house, standing high enough that the house's work is put to
 * them by name rather than nailed to a wall.
 */
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

/** The roll, as the escort pass reads it. */
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

/**
 * The house's own offer of one named occasion, off the real generator.
 *
 * `theHouseAsItStands` is what the board and the ask both read, so an occasion
 * found here is one a summons draw could have landed on.
 */
function theOccasion(deps: any, senior: any, membership: any, reasonId: string) {
    const standing = theHouseAsItStands(deps, senior, membership);
    expect(standing, 'the player is on nobody\'s roll').not.toBeNull();
    return whatAHouseWouldSendYouOn({
        ordinal: senior.realmOrdinal,
        membership,
        house: standing!.house,
        reachOfTheHouse: standing!.reach,
        reachOfTheRest: standing!.reachOfTheRest,
        givenBy: { rankIndex: membership.rankCount - 1, isHead: true }
    }).find(candidate => theReasonBehind(candidate.entry.id)?.id === reasonId) ?? null;
}

/** Arrange the ask and say yes to it. Only the summons ROLL is bypassed. */
async function takeIt(harness: any, reasonId: string) {
    const { game, repos, senior, deps, membership } = harness;
    const candidate = theOccasion(deps, senior, membership, reasonId);
    expect(candidate, `the house never offers ${reasonId}`).not.toBeNull();

    const duty = dutyFromOffer(candidate, membership, 0);
    const takingOut = whoASeniorIsAskedToTakeOut({
        pitchOrdinal: duty.pitchOrdinal,
        hands: theReasonBehind(candidate.entry.id)!.hands,
        roster: rollOf(game),
        seniorId: senior.id,
        seniorOrdinal: senior.realmOrdinal
    });
    expect(takingOut.length, 'the house has nobody junior enough to send')
        .toBeGreaterThan(0);

    rememberSummons(repos, senior.id, {
        duty: { ...duty, takingOut, cohort: takingOut.length },
        entryId: candidate.entry.id,
        what: `${candidate.entry.name}, put to them by name.`,
        spokenOnDay: 0
    });

    const turn = await game.act('I accept');
    return { candidate, takingOut, turn, said: JSON.stringify(turn.facts ?? turn) };
}

describe('the occasions a senior can be asked out on', () => {
    it('include being received at another house, and the juniors are named', async () => {
        const harness = await anElderOf('occasion-visit');
        const { candidate, takingOut, said } = await takeIt(harness, A_VISIT);

        expect(candidate.entry.summaryTemplate).toContain('receive');
        for (const member of takingOut) {
            expect(said, `${member.name} was never named`).toContain(member.name);
        }
    }, 300_000);

    it('include a friendly competition, and the juniors are named', async () => {
        const harness = await anElderOf('occasion-meet');
        const { candidate, takingOut, said } = await takeIt(harness, A_COMPETITION);

        expect(candidate.entry.summaryTemplate).toContain('juniors');
        for (const member of takingOut) {
            expect(said, `${member.name} was never named`).toContain(member.name);
        }
    }, 300_000);

    it('read as different scenes rather than one scene with a noun swapped', async () => {
        // Both occasions off ONE house in ONE world, so the only thing that
        // differs between the two strings is the occasion.
        const harness = await anElderOf('occasion-two-scenes');
        const { deps, senior, membership } = harness;
        const visit = theOccasion(deps, senior, membership, A_VISIT);
        const meet = theOccasion(deps, senior, membership, A_COMPETITION);
        expect(visit, 'the house never offers a visit').not.toBeNull();
        expect(meet, 'the house never offers a competition').not.toBeNull();

        const words = (s: string) => new Set(
            s.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(w => w.length > 4)
        );
        const a = words(visit!.entry.summaryTemplate);
        const b = words(meet!.entry.summaryTemplate);
        const shared = [...a].filter(w => b.has(w));
        // `house` and `another` are the two houses in both sentences and are
        // what the occasions have in common. Anything beyond a handful would be
        // one sentence with the noun changed.
        expect(shared.length, `shared: ${shared.join(', ')}`).toBeLessThan(4);
    }, 300_000);
});
