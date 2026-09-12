/**
 * Four ordinary sentences of restraint, and the blank look all four got.
 *
 * Measured on the refusal probe, 28 turns each and 112 turns in total, every
 * one of them `engine.parseIntent/unclear`:
 *
 *     I let him go          I spare her
 *     I stay my hand        I stand between them
 *
 * That answer means *your sentence did not resolve into anything you could do*,
 * and it was false for all four. Reproduced engine-only against world seed
 * `a-xianxia-run`, seed factory `xianxia`: standing in a square, all four came
 * back `engine.parseIntent/unclear`. With a fight standing, the first three
 * already resolved - `fight-answers.ts` has read `spare` since it was written -
 * and `I stand between them` still got the blank look.
 *
 * ── WHAT THE DEFECT ACTUALLY WAS ─────────────────────────────────────────
 *
 * Restraint is an answer to a situation, and the engine held two of them:
 *
 *   a fight standing            `GameService.fight`, read by
 *                               `whatTheySaidInTheFight`. Already worked.
 *   somebody beaten in front    `FLAG_YIELDING_TO_YOU`, written when a
 *   of you                      coercion ends in a submission and lapsing by
 *                               presence rather than by a timer.
 *
 * The second was reachable in one direction only. The affordance strip offered
 * *"I make X hand over what they carry"* to somebody standing over a person on
 * their knees, and there was no sentence for letting them up - which is
 * AGENTS.md's *if only one of the two is reachable, the engine has an opinion*,
 * pointed the other way for once.
 *
 * So the three assertions this file makes:
 *
 *   1. With somebody beaten in front of them, the restraint sentences RESOLVE:
 *      the flag goes, the favour the sparing opens is written, and the grudge
 *      the kneeling opened is not touched.
 *   2. With nobody beaten and nothing swinging, they are REFUSED - and the
 *      refusal says there is nobody being held under a blade, rather than
 *      claiming the sentence could not be read.
 *   3. `I stand between them` stays refused, because stepping into a fight
 *      between two other people is a thing this engine does not model: a fight
 *      belongs to the player and there is no third party anywhere in it. Its
 *      refusal says that, and is not the blank look.
 *
 * ── HOW THE SCENARIO IS ARRANGED ─────────────────────────────────────────
 *
 * By PLAYING, in one turn: a rung set through admin - the climb has its own
 * tests and is not what this measures - and then `I force <name> to kneel`,
 * which is an ordinary coercion and ends in a submission against somebody five
 * major realms down. The flag is checked rather than assumed, so a scenario
 * that stops being reachable fails here rather than quietly measuring nothing.
 */

import { makeGameInWorld } from './harness';
import { readFlag } from '../../src/server/consolidated/cultivation-support';
import { FLAG_YIELDING_TO_YOU } from '../../src/web/flag-keys';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo';

const WORLD = 'a-xianxia-run';

// `ADMIN_MODE` is read at call time, so it is turned on here and put back.
const adminBefore = process.env.ADMIN_MODE;
beforeAll(() => { process.env.ADMIN_MODE = 'true'; });
afterAll(() => {
    if (adminBefore === undefined) delete process.env.ADMIN_MODE;
    else process.env.ADMIN_MODE = adminBefore;
});

/** The blank look, as the turn's own inspector channel spells it. */
function gotTheBlankLook(turn: { toolCalls: readonly { name: string; ok: boolean }[] }): boolean {
    return turn.toolCalls.some(call => call.name === 'engine.parseIntent' && !call.ok);
}

function refusals(
    turn: { toolCalls: readonly { name: string; ok: boolean }[] }
): readonly { name: string; ok: boolean }[] {
    return turn.toolCalls.filter(call => !call.ok && !call.name.startsWith('narrator.'));
}

async function aSquareWithNobodyBeaten() {
    const harness = await makeGameInWorld({ seed: 'xianxia', worldSeed: WORLD, adminMode: true });
    await harness.game.newRun('Prober');
    return harness;
}

/**
 * GIVEN somebody has been beaten to their knees in front of the player.
 *
 * Played, not written: the only arranged part is the rung.
 */
async function somebodyOnTheirKnees() {
    const harness = await aSquareWithNobodyBeaten();
    await harness.game.act('ADMIN set_realm ordinal=30');
    const me = harness.game.state().cultivator;
    const weakest = [...harness.game.present(me)]
        .filter(row => row.id !== me.id)
        .sort((a, b) => a.realmOrdinal - b.realmOrdinal)[0];
    await harness.game.act(`I force ${weakest.name} to kneel`);

    const noted = readFlag(harness.db, me.id, FLAG_YIELDING_TO_YOU);
    return { ...harness, them: weakest, noted };
}

describe('a hand held back from somebody who is beaten', () => {
    for (const said of ['I let him go', 'I spare her', 'I stay my hand']) {
        it(`resolves: "${said}"`, async () => {
            const at = await somebodyOnTheirKnees();
            expect(at.noted, 'the scenario is no longer reachable by playing').toBeTruthy();

            const before = ledgerAbout(at.db, at.them.id).length;
            const turn = await at.game.act(said);

            expect(gotTheBlankLook(turn), 'the blank look').toBe(false);
            expect(refusals(turn), 'nothing should have refused').toEqual([]);

            // WHAT THE ENGINE STATES: they are alive, and the sparing is owed.
            const said_ = [turn.narration, ...turn.toolCalls.map(c => c.summary)].join('\n');
            expect(said_).toContain(at.them.name);
            expect(said_.toLowerCase()).toContain('owes you');

            // They are on their feet, so the room stops allowing what it allowed.
            expect(
                readFlag(at.db, at.game.state().cultivator.id, FLAG_YIELDING_TO_YOU),
                'somebody let go is not still kneeling'
            ).toBeNull();

            // AND IT COST SOMETHING THAT OUTLIVES THE TURN.
            expect(
                ledgerAbout(at.db, at.them.id).length,
                'letting somebody go writes what it opens'
            ).toBeGreaterThan(before);

            at.db.close();
        }, 120_000);
    }

    /**
     * The strip offers the taking half at exactly this moment. Both halves have
     * to be sayable or the vocabulary has taken a side.
     */
    it('is offered as a sentence beside the one that takes from them', async () => {
        const at = await somebodyOnTheirKnees();
        expect(at.noted).toBeTruthy();

        const strip = at.game.affordancesFor(
            at.game.state().cultivator, at.game.state().run
        ) as readonly { id: string; say: string }[];
        const letThemUp = strip.find(one => one.id === 'let_them_go');

        expect(letThemUp, 'only the taking half was reachable').toBeTruthy();
        expect(letThemUp!.say).toContain(at.them.name);

        const turn = await at.game.act(letThemUp!.say);
        expect(gotTheBlankLook(turn), 'the strip offered a sentence nothing reads').toBe(false);

        at.db.close();
    }, 120_000);
});

describe('a hand held back from nobody', () => {
    for (const said of ['I let him go', 'I spare her', 'I stay my hand']) {
        it(`refuses honestly: "${said}"`, async () => {
            const at = await aSquareWithNobodyBeaten();
            const turn = await at.game.act(said);

            expect(gotTheBlankLook(turn), 'the blank look').toBe(false);
            expect(refusals(turn).length, 'this is a refusal and should read as one')
                .toBeGreaterThan(0);

            // THE RIGHT REFUSAL: nobody is under the blade, said plainly. Not
            // the engine claiming it could not read the sentence.
            const answer = [turn.narration, ...turn.toolCalls.map(c => c.summary)]
                .join('\n').toLowerCase();
            expect(answer).not.toContain('does not resolve into anything');
            expect(answer, 'the refusal has to name what is missing')
                .toMatch(/nobody|no one|not holding/);

            // A refusal is free. It spends no day.
            expect(at.game.state().run.elapsedDays).toBe(0);

            at.db.close();
        }, 120_000);
    }
});

/**
 * `I stand between them` is the odd one out and stays refused.
 *
 * It is intervening in somebody ELSE's fight, and a fight in this engine
 * belongs to the player: `GameService.fight` holds one aggressor, one defender
 * and the player as one of the two. There is no fight between two other people
 * anywhere in the world state for a third person to step into, so the honest
 * answer is that there is nothing here to stand between - which is a different
 * sentence from the engine saying it could not read the words.
 */
describe('standing between two other people', () => {
    it('is refused, and the refusal says why rather than looking blank', async () => {
        const at = await aSquareWithNobodyBeaten();
        const turn = await at.game.act('I stand between them');

        expect(gotTheBlankLook(turn), 'the blank look').toBe(false);
        expect(refusals(turn).length).toBeGreaterThan(0);

        const answer = [turn.narration, ...turn.toolCalls.map(c => c.summary)]
            .join('\n').toLowerCase();
        expect(answer).not.toContain('does not resolve into anything');
        expect(answer, 'the refusal has to say what is not happening')
            .toMatch(/fight/);
        expect(at.game.state().run.elapsedDays).toBe(0);

        at.db.close();
    }, 120_000);
});

/**
 * What already worked, pinned so it cannot be lost on the way past.
 */
describe('a hand held back inside a standing fight', () => {
    it('answers the fight rather than starting anything', async () => {
        const at = await aSquareWithNobodyBeaten();
        const me = at.game.state().cultivator;
        const them = at.game.present(me).find(row => row.id !== me.id)!;
        await at.game.act(`I attack ${them.name}`);

        const turn = await at.game.act('I spare her');
        expect(gotTheBlankLook(turn), 'the blank look').toBe(false);
        expect(
            turn.toolCalls.some(call => call.name.startsWith('combat')),
            'a sentence said inside a fight is answered by the fight'
        ).toBe(true);

        at.db.close();
    }, 120_000);
});
