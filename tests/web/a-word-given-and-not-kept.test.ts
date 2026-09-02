/**
 * Swearing an oath, carrying one, and breaking one.
 *
 * The contract shape was complete and had no player path. `grudges.ts` has
 * carried `kind: 'oath'` and seven causes since it was written;
 * `what-an-indenture-is-and-what-happens-when-it-ends.ts` says what a term is,
 * who witnesses it and what the day after looks like; `whatWalkingOutOfItCosts`
 * prices walking away and was written for exactly this. A house could put one
 * ON somebody - the reprisal path writes an indenture when a house catches you -
 * and nobody could swear one, be told what they were carrying, or break one.
 *
 * THE LAW THIS FILE PINS, and it is the design's own, from `faction-character.ts`
 * on the House of the Bound Word: *a broken oath is structural rather than
 * punitive - removing it removes some of the person.* So nothing here prevents
 * anybody leaving. What it does is say what leaving IS, which is the difference
 * between the agency rule being followed and being talked about.
 *
 * Three things are asserted against the ledger rather than against the prose,
 * because the prose is the narrator's and the rows are the engine's:
 *
 *   A WORD GIVEN IS A ROW. Held by the person bound, about the body it is owed
 *   to, with a witness on it - the direction `settleItWithABinding` already
 *   uses and the direction the indenture ledger already writes.
 *   BREAKING IT OPENS A SECOND ROW NAMING THE PERSON. `broken_oath`, held by
 *   the party that was given the word. The first is CLOSED rather than deleted,
 *   because a discharged term and a broken one are different facts and the
 *   difference is the whole reason the closed row is worth keeping.
 *   AND NOTHING STOPS THEM. There is no branch anywhere that refuses.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld } from './harness';
import { parseIntent, DEFAULT_OATH_INTENT } from '../../src/web/actions';
import { openOathsHeldBy } from '../../src/web/encounters';
import { ensureCultivationDb } from '../../src/server/consolidated/cultivation-support';
import {
    THE_OATHWRIGHT_HOUSE,
    THE_OATHWRIGHT_WILL_NOT_WITNESS_FOR,
    theOathwrightWouldWitnessFor
} from '../../src/data/cultivation/what-an-indenture-is-and-what-happens-when-it-ends';

async function aRunKnowingTheHouses(seed: string) {
    process.env.ADMIN_MODE = 'true';
    const harness = await makeGameInWorld({
        seed, worldSeed: `${seed}-world`, adminMode: true
    });
    const { cultivator } = await harness.game.newRun('Lin Baoqing');
    await harness.game.act('ADMIN grant_knowledge kind=sect');
    return { ...harness, cultivator };
}

describe('a word given', () => {
    it('is reachable, and asking about one is never swearing one', () => {
        expect(parseIntent('I swear an oath to the Azure Dew Sect').intent).toBe('swear');
        expect(parseIntent('what oaths am I carrying').intent).toBe('read');
        expect(parseIntent('I break my oath').intent).toBe('break');
        // The cheapest branch is the default, on the same rule `site` follows.
        // Nothing is sworn and nothing is broken by ambiguity, which matters
        // more here than anywhere: breaking one is permanent.
        expect(DEFAULT_OATH_INTENT).toBe('read');
        // And swearing at somebody is not a contract.
        expect(parseIntent('I swear at him').action).not.toBe('oath');
    });

    it('writes one row, held by the person bound, with a witness on it', async () => {
        const { game, cultivator } = await aRunKnowingTheHouses('oath-swear');
        const repos = ensureCultivationDb();

        expect(openOathsHeldBy(repos, cultivator.id)).toHaveLength(0);
        await game.act('I swear an oath to the Azure Dew Sect');

        const held = openOathsHeldBy(repos, cultivator.id);
        expect(held).toHaveLength(1);
        // The person bound HOLDS it and the body it is owed to is the subject.
        // Same direction as `settleItWithABinding` and the indenture ledger, so
        // every query that reads oaths finds this one the same way.
        expect(held[0].holderId).toBe(cultivator.id);
        expect(held[0].kind).toBe('oath');
        expect(held[0].participants).toContain(THE_OATHWRIGHT_HOUSE);
        // `terms` is prose, as `grudges.ts` requires for an oath. It is what
        // somebody reads in eighty years working out why this person was
        // standing where they were standing.
        expect(held[0].terms ?? '').not.toHaveLength(0);
    }, 180_000);

    it('says the same word twice writes no second row', async () => {
        const { game, cultivator } = await aRunKnowingTheHouses('oath-twice');
        const repos = ensureCultivationDb();
        await game.act('I swear an oath to the Azure Dew Sect');
        const again = await game.act('I swear an oath to the Azure Dew Sect');
        expect(openOathsHeldBy(repos, cultivator.id)).toHaveLength(1);
        expect(again.narration).toMatch(/already/i);
    }, 180_000);

    it('reads back what is carried, for nothing', async () => {
        const { game, cultivator } = await aRunKnowingTheHouses('oath-read');
        const empty = await game.act('what oaths am I carrying');
        expect(empty.narration).toMatch(/nobody is owed your service|bound by nothing|Nothing\./i);

        await game.act('I swear an oath to the Azure Dew Sect');
        const carrying = await game.act('what oaths am I carrying');
        expect(carrying.narration).toMatch(/Azure Dew Sect/);
        // What running costs, said before anybody runs. A refusal that names
        // what would work is worth more than a confident silence, and so is a
        // price named in advance.
        expect(carrying.narration).toMatch(/broken word|penalty clause/i);
        expect(cultivator.id).toBeDefined();
    }, 180_000);
});

describe('and not kept', () => {
    it('does not stop them, and opens an account naming them', async () => {
        const { game, cultivator } = await aRunKnowingTheHouses('oath-break');
        const repos = ensureCultivationDb();
        await game.act('I swear an oath to the Azure Dew Sect');

        const result = await game.act('I break my oath');

        // The oath is CLOSED rather than removed. A discharged term and a
        // broken one are different facts.
        expect(openOathsHeldBy(repos, cultivator.id)).toHaveLength(0);

        const opened = repos.db
            .prepare("SELECT * FROM obligations WHERE cause = 'broken_oath' AND subject_id = ?")
            .all(cultivator.id) as Array<{ kind: string; holder_id: string; severity: string }>;
        expect(opened, 'nothing was opened against the person who left').toHaveLength(1);
        expect(opened[0].kind).toBe('grudge');
        // As heavy as the oath was. A binding worth less than what it closed
        // would make walking out the cheap move, which it is emphatically not.
        expect(opened[0].severity).toBe('serious');

        expect(result.toolCalls.some(call =>
            call.name === 'engine.whatWalkingOutOfItCosts' && call.ok)).toBe(true);
    }, 180_000);

    it('says there is nothing to break when there is nothing', async () => {
        const { game } = await aRunKnowingTheHouses('oath-nothing');
        const result = await game.act('I break my oath');
        expect(result.narration).toMatch(/nothing to break|cannot be walked out of/i);
    }, 180_000);
});

describe('who will put their name to it', () => {
    /**
     * The premier oathwright is not universally available, and the reason is
     * its own founding oath - honoured at the cost of a fortune it can see and
     * cannot touch. A house that cannot get the best witness uses a lesser one,
     * and the person held under that oath is held by something correspondingly
     * easier to argue with. Nothing scores that; it is a fact on the record.
     */
    it('refuses for the one body its founding oath forbids, and for nobody else', () => {
        for (const factionId of Object.keys(THE_OATHWRIGHT_WILL_NOT_WITNESS_FOR)) {
            expect(theOathwrightWouldWitnessFor(factionId)).toBe(false);
        }
        expect(theOathwrightWouldWitnessFor('sect-azure-dew-sect')).toBe(true);
    });
});
