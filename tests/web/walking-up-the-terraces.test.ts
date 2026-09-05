/**
 * Walking up the mountain, in sentences a person would type.
 *
 * `tests/server/a-probation-ends-in-a-placement.test.ts` holds the same
 * process through the tool surface. This file holds the half that decides
 * whether it is a feature: whether somebody sitting in front of the game can
 * reach it by saying things, and whether what comes back tells them what
 * happened.
 *
 * Three defects were found by playing this and are pinned below, because every
 * one of them is the shape this repo keeps shipping - the machinery correct
 * and the way in invisible:
 *
 *   "I ask to join the Azure Cloud Pavilion" answered with a rung and stopped.
 *   The bar is right and it is not the door, and there was no way to find the
 *   door except by guessing the word "guest".
 *
 *   "what sects are there" did not name the Pavilion at all, because the
 *   listing filters on `admissionOrdinal` - so the one house in the world
 *   whose entire intake is people walking up the mountain was hidden from
 *   somebody standing in its gorge holding its name.
 *
 *   "how am I doing", in year twenty-four of an apex's intake, said "Serves no
 *   house. Nothing is owed to them and nothing is asked of them." True, and
 *   the wrong answer.
 *
 * The world is pinned as well as the run: a run seed on a fresh database meets
 * a different several hundred people, and a played test that pins one without
 * the other is pinning a coincidence.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeGameInWorld } from './harness';
import { CultivatorRepository } from '../../src/storage/repos/cultivator.repo.js';
import { ensureCultivationDb } from '../../src/server/consolidated/cultivation-support.js';
import { FOUNDATION_ORDINAL } from '../../src/engine/cultivation/realms.js';
import { stagnationYearsForOrdinal } from '../../src/schema/cultivation.js';
import { guestTermYears } from '../../src/engine/encounters/what-a-house-will-teach-somebody-it-has-not-taken.js';

const PAVILION = 'sect-azure-cloud-pavilion';
const WORLD_SEED = 'walking-up-the-terraces-world';

/**
 * A nobody standing in the gorge, holding the Pavilion's name.
 *
 * The name is granted through ADMIN rather than found, and that is a FINDING
 * rather than a shortcut: `commonlyNamedHouses` names houses whose
 * `admissionOrdinal` is at the floor, and the Pavilion's is its membership
 * bar, so it is nameable to nobody at birth anywhere - including a child of
 * the Jade Gorge. Measured: travelling to the gorge and asking "what sects are
 * there" still returned only the two houses from the province they had left.
 * The ruling that needs making is written up in `docs/world/houses/origin.md`.
 */
async function aNobodyInTheGorge(runSeed: string, worldSeed: string = WORLD_SEED) {
    const harness = await makeGameInWorld({
        worldSeed, seed: runSeed, adminMode: true
    });
    const { cultivator } = await harness.game.newRun('Shen Ruo');
    const say = (input: string) => harness.game.act(input).then(r => r.narration);
    await say('I travel to The Jade Gorge');
    await say('ADMIN grant_knowledge kind=sect name=Azure Cloud Pavilion');
    // Provisions for a probation, which is thirty to fifty years long.
    //
    // AND THE TWO CATALOGS DISAGREE ABOUT WHO PAYS FOR THEM.
    // `AZURE_CLOUD_INTAKE.theRank` says a probationer is "fed, taught and
    // rotated"; `WHAT_A_GUEST_PLACE_IS_NOT` says "No share of the house's
    // stores. You are inside and you are not drawing on what is in there."
    // Both are load-bearing prose and they cannot both be right about the
    // Pavilion's intake. Reported rather than resolved - see the note in
    // `docs/world/houses/origin.md`. Until it is settled the engine charges the
    // probationer, so the purse is stocked here to arrange the span.
    new CultivatorRepository(harness.repos.db)
        .update(cultivator.id, { spiritStones: 500_000 });
    return { ...harness, cultivator, say };
}

describe('walking up the terraces', () => {
    beforeEach(() => { process.env.ADMIN_MODE = 'true'; });
    afterEach(() => { delete process.env.ADMIN_MODE; });

    it('names the open door when the bar is what was asked about', async () => {
        const { say } = await aNobodyInTheGorge('terraces-refusal');

        const listing = await say('what sects are there');
        expect(listing).toContain('Azure Cloud Pavilion');
        expect(listing).toMatch(/intake is open to you now/);

        const asked = await say('I ask to join the Azure Cloud Pavilion');
        expect(asked).toMatch(/admits from/);
        expect(asked, 'the refusal has to name the door that is open')
            .toMatch(/already open and needs no opening/);
    }, 120_000);

    it('takes them on, and says so on the sheet they will actually read', async () => {
        const { say } = await aNobodyInTheGorge('terraces-entry');

        const taken = await say('I will study at the Azure Cloud Pavilion');
        expect(taken).toMatch(/entered on Azure Cloud Pavilion's guest roll/);
        expect(taken, 'no claim to protection, said before anything happens')
            .toMatch(/No protection/);

        const sheet = await say('how am I doing');
        expect(sheet, 'a probationer is not somebody who serves no house and nothing else')
            .toMatch(/Azure Cloud Pavilion's intake roll/);
    }, 120_000);

    it('is placed at the terraces when they cross inside what the house was spending', async () => {
        const { say, cultivator, repos } = await aNobodyInTheGorge('terraces-exceptional');
        await say('I will study at the Azure Cloud Pavilion');
        await say('I learn the Lesser Qi-Gathering Manual');

        // Lived, on the shelf the house opened: real years, real qi deviation,
        // real breakthroughs off the manual the house put in front of them.
        await say('I cultivate for two years');
        await say('I find a physician and have my meridians treated');
        await say('ADMIN advance_days years=4 rations=1600');
        // And the crossing itself is arranged, because whether THIS seed's
        // root reaches Foundation is a question about the ladder rather than
        // about the sort. `set_realm` goes through `advanceRealm` like any
        // other rank change.
        await say(`ADMIN set_realm ordinal=${FOUNDATION_ORDINAL}`);

        const onTheRoll = elapsedYears(repos, cultivator.id);
        expect(onTheRoll, 'inside the terraces own watching term')
            .toBeLessThan(guestTermYears(PAVILION));

        const sheet = await say('how am I doing');
        expect(sheet).toMatch(/kept at the terraces/);

        const after = await say('what is my rank');
        expect(after).toMatch(/On the roll of Azure Cloud Pavilion/);
    }, 300_000);

    it('keeps somebody who never crosses, at the rung the catalog already has a name for',
        async () => {
            // ── THIS ARM IS PLAYED RATHER THAN ADVANCED, AND IT IS THE POINT ──
            //
            // A probation is a person practising under a house's eye for
            // decades, so the arm that tests one has to be somebody DOING
            // that. Playing it also keeps the treatment in the loop, which is
            // the whole subject: a cultivator who closes their channels once a
            // course survives the climb, and one who cannot afford to does not.
            // Measured on this seed: forty-four years and eleven rungs.
            //
            // ── AND WHAT THIS COMMENT USED TO SAY INSTEAD ────────────────
            //
            // It recorded a finding: *"an idle body accumulates untreated
            // channels at rather more than one a year and dies of qi deviation
            // inside eight to thirty, whatever is paid for rations"* - offered
            // as the reason `ADMIN advance_days` could not reach the judgement.
            // That was a real measurement of a defect rather than a fact about
            // the world. The time skip rolled qi deviation against the calendar
            // instead of against the act it is the price of.
            //
            // The design owner has ruled: **a wound has a cause you can point
            // at.** A body drawing no qi tears no meridians, and the roll is
            // gated on the act now - see the banner over `DEVIATION_CHECK_DAYS`
            // in `time-skip.ts`. So advancing this arm would no longer kill
            // anybody, and it is still played, for the reason above rather than
            // for the reason that used to be written here.
            //
            // The stagnation observation survives untouched, because it never
            // rested on the deviation roll. The house decides at
            // `stagnationYearsForOrdinal(0)`, and that is very close to the
            // horizon past which somebody who has not crossed is not a
            // candidate any more because they are dead of not having crossed.
            //
            // The seed pair is pinned because THIS person survives it. The same
            // branch is exercised without the survival layer in
            // `tests/server/a-probation-ends-in-a-placement.test.ts`.
            const { say, cultivator, repos } = await aNobodyInTheGorge('run-c', 'azure-world-1');
            await say('I will study at the Azure Cloud Pavilion');
            await say('I learn the Lesser Qi-Gathering Manual');

            const cultivators = new CultivatorRepository(repos.db);
            const decidesAt = stagnationYearsForOrdinal(0);
            for (let i = 0; i < 40 && elapsedYears(repos, cultivator.id) < decidesAt - 6; i++) {
                if (!cultivators.getById(cultivator.id)?.alive) break;
                await say('I cultivate for two years');
                await say('I find a physician and have my meridians treated');
            }
            expect(
                cultivators.getById(cultivator.id)?.alive,
                'the survival layer got them before the house decided - re-pin the seeds '
                + 'rather than widening anything'
            ).toBe(true);

            // The last stretch bought, and then held short of the crossing:
            // this arm is about the person the house decides it cannot make a
            // disciple of.
            while (elapsedYears(repos, cultivator.id) <= decidesAt
                   && cultivators.getById(cultivator.id)?.alive) {
                const left = Math.ceil(decidesAt + 2 - elapsedYears(repos, cultivator.id));
                const out = await say(
                    `ADMIN advance_days years=${Math.max(1, left)} rations=${Math.max(1, left) * 400}`
                );
                if (out.includes('REFUSED')) break;
            }
            await say('ADMIN set_realm ordinal=6');
            expect(elapsedYears(repos, cultivator.id)).toBeGreaterThan(decidesAt);

            const sheet = await say('how am I doing');
            expect(sheet).toMatch(/does not cross, and is kept on/);

            const after = await say('what is my rank');
            expect(after).toMatch(/On the roll of Azure Cloud Pavilion, ranked Sword Servant/);
        }, 600_000);
});

function elapsedYears(repos: ReturnType<typeof ensureCultivationDb>, cultivatorId: string): number {
    const run = repos.runs.getActiveRun(cultivatorId);
    return run ? run.elapsedDays / 365 : Number.POSITIVE_INFINITY;
}
