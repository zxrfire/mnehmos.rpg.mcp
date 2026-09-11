/**
 * The player could be forgiven and could not forgive.
 *
 * FOUND BY PROBING THE LEDGER'S OWN SENTENCES, after a blind session had
 * already shown that the social layer is the deepest engine with the thinnest
 * surface. `i forgive his debt` routed to `oath/read` - somebody trying to let a
 * friend off was handed a listing of what was open. That is worse than
 * `unclear`, which at least says nothing happened.
 *
 * ── EVERY PART OF IT WAS ALREADY BUILT ───────────────────────────────────
 *
 * `whatWouldCloseIt` puts `forgiven` on every favour and every debt, and on a
 * grudge whose holder is a person and whose weight is short of unforgivable.
 * `settleObligation` writes it. `openLedgerBetween` reads both directions.
 *
 * And there was exactly one caller: an NPC forgiving the PLAYER for turning up
 * wanting nothing. So the machinery ran in one direction only, which is the
 * asymmetry AGENTS.md calls a defect outright - *an NPC can do it and the player
 * can't*.
 *
 * ── WHAT THE VERB DOES AND DELIBERATELY DOES NOT ─────────────────────────
 *
 * It settles the rows the player HOLDS against somebody, and only the ones the
 * engine says admit forgiveness - so an unforgivable grudge is refused in the
 * engine's own terms rather than quietly skipped.
 *
 * It writes nothing the other way and records no tie. What two people make of
 * it afterwards belongs to the approach layer, which already reads a closed row
 * differently from an open one. Inventing a warmth bonus here would be this
 * file deciding what forgiveness is worth, which is not a parsing question.
 *
 * ── AND THE TWO NOTHINGS ARE DIFFERENT NOTHINGS ──────────────────────────
 *
 * A clean slate and a slate the engine will not let you wipe are not the same
 * answer. Telling a player "they owe you nothing" when a grave grudge is open
 * is how somebody concludes the ledger was never written.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { makeGame } from './harness';
// Through `actions` rather than straight at the table: importing the table
// first puts this file at the head of a cycle and `costsTheAskerNothing` is
// undefined by the time `prompt.ts` runs. Every other played test in this
// directory imports it this way.
import { parseIntent } from '../../src/web/actions';
import { createObligation } from '../../src/engine/social/grudges';
import { writeOneObligation } from '../../src/storage/repos/obligation.repo';

let adminBefore: string | undefined;
beforeAll(() => {
    adminBefore = process.env.ADMIN_MODE;
    process.env.ADMIN_MODE = 'true';
});
afterAll(() => {
    if (adminBefore === undefined) delete process.env.ADMIN_MODE;
    else process.env.ADMIN_MODE = adminBefore;
});

describe('the sentences a person uses to let somebody off', () => {
    it.each([
        'i forgive his debt',
        'i forgive her the favour',
        'i write off his debt',
        'i write off what he owes',
        'i cancel his debt',
        'i let him off what he owes',
        'i release him from his debt',
        'i call it even',
        'i tell him he owes me nothing'
    ])('%s is an act rather than a listing', said => {
        const plan = parseIntent(said);
        expect(`${plan.action}/${plan.intent ?? '-'}`).toBe('oath/release');
    });

    /**
     * AND THE LEDGER READ KEEPS ITS OWN SENTENCES. The read branch fires on the
     * word `debt` alone, which is right for a question and was wrong for an
     * act; narrowing it must not cost the questions.
     */
    it.each([
        'what do i owe',
        'who owes me',
        'what am i owed',
        'i repay what i owe',
        'i clear the debt',
        'i settle my debt'
    ])('%s still reads the ledger', said => {
        const plan = parseIntent(said);
        expect(`${plan.action}/${plan.intent ?? '-'}`).toBe('oath/read');
    });

    /**
     * AND `wipe out` IS STILL SLAUGHTER. It is the obvious word to add beside
     * `write off` and it is how this setting says killing everybody; the attack
     * table owns it and must keep it.
     */
    it('leaves wipe out with the attack table', () => {
        expect(parseIntent('i wipe out the bandits').action).toBe('attack');
    });
});

describe('what the verb says when there is nothing to give up', () => {
    /**
     * PLAYED, because the refusals are the whole of what a player meets first:
     * most people the player forgives will owe them nothing, and an act that
     * answers that badly is worse than no act.
     */
    it('says so plainly when nobody owes anything', async () => {
        const { game } = makeGame({ adminMode: true, seed: 'forgive-nothing' });
        await game.newRun('Shen Yuan');
        await game.act('ADMIN spawn_encounter ordinal=2 name=Wei Ciyi');

        const said = await game.act('i forgive Wei Ciyi the debt');
        // Asserted on the PROSE, which is what a player reads: a refusal's
        // headline goes to the operator channel and never into the account.
        expect(said.narration).toMatch(/square with you|not yours to give up|some things are answered/i);
        // And nothing was spent finding that out.
        expect((await game.state()).run!.elapsedDays).toBe(0);
    }, 120_000);

    /**
     * AND IT NEEDS SOMEBODY. "I forgive" on its own is a mood rather than an
     * act, and picking a creditor for the player would be the guess this repo
     * refuses everywhere else.
     */
    it('refuses when the sentence names nobody and nobody is here', async () => {
        const { game } = makeGame({ adminMode: true, seed: 'forgive-alone' });
        await game.newRun('Shen Yuan');

        const said = await game.act('i forgive the debt');
        expect(said.narration).toMatch(/forgiving is done to somebody|names nobody who is here/i);
        expect((await game.state()).run!.elapsedDays).toBe(0);
    }, 120_000);
});

/**
 * And the half the whole thing is for: a row the player holds, given up.
 *
 * The favour is written straight into the ledger rather than played into
 * existence, because how a favour comes to be owed is somebody else's test and
 * arranging one through play would make this file fail for their reasons.
 */
describe('letting somebody off closes the row', () => {
    it('settles a favour the player was owed', async () => {
        const { game, db } = makeGame({ adminMode: true, seed: 'forgive-a-favour' });
        const { cultivator } = await game.newRun('Shen Yuan');
        await game.act('ADMIN spawn_encounter ordinal=2 name=Wei Ciyi');
        const them = db
            .prepare("SELECT id FROM cultivators WHERE name = 'Wei Ciyi' LIMIT 1")
            .get() as { id: string };

        writeOneObligation(db as never, createObligation({
            kind: 'favor',
            holderId: cultivator.id,
            subjectId: them.id,
            cause: 'help_given',
            severity: 'slight',
            onDay: 0,
            description: 'Shen Yuan stood between Wei Ciyi and a man with a stick.'
        }));

        const open = () => db
            .prepare("SELECT status FROM obligations WHERE holder_id = ? AND subject_id = ?")
            .all(cultivator.id, them.id) as { status: string }[];
        expect(open().map(r => r.status)).toEqual(['open']);

        const said = await game.act('i forgive Wei Ciyi the favour');

        // The ROW, not the prose: what was open is closed.
        expect(open().map(r => r.status)).toEqual(['settled']);
        // And the account says what was given up rather than what was gained.
        expect(said.narration).toMatch(/Wei Ciyi/);
        expect(said.narration.toLowerCase()).toMatch(/nothing was taken|asked for nothing|forgiven/);
        // Free, like every other reading of this verb.
        expect((await game.state()).run!.elapsedDays).toBe(0);
    }, 120_000);
});
