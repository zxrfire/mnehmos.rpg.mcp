/**
 * Two ordinary sentences of GIVING a road away, and the blank look both got.
 *
 * Measured on the refusal probe, 28 turns each and 56 turns in total, every one
 * of them `engine.parseIntent/unclear`:
 *
 *     I teach her what I know          I show her the form
 *
 * That answer means *your sentence did not resolve into anything you could do*,
 * and it was false for both. Reproduced engine-only against world seed
 * `a-xianxia-run`, seed factory `xianxia`: standing in a square at Wind Turn,
 * both came back `engine.parseIntent/unclear`.
 *
 * ── THE DEFECT WAS A READ BUILT IN ONE DIRECTION ─────────────────────────
 *
 * `what-asking-this-person-for-this-would-cost-them.ts` had already written the
 * gap down in its own header: the engine priced being TAUGHT thoroughly - what
 * a teacher gives up, what the leak costs the house, how far they could carry
 * you - and nothing anywhere wrote an art onto another person from the played
 * side. `taught_technique` had been a `FavorCause` since the ledger was written
 * and had no producer.
 *
 * Nothing needed inventing. Every judgement below is a call into something that
 * already decides the same question for somebody else:
 *
 *   couldWriteOutACopy   do you hold it well enough to put it in somebody
 *                        else's hands. The SAME bar `canReproduce` holds every
 *                        master in the world to, reading the player's mastery
 *                        column where NPC records have only an ordinal.
 *   betrayalOfSelling    whose art it is, on the four-rung scale the world
 *                        already prices a leaked book on.
 *   monthsToCopy         how much work the whole of this art is, counted in the
 *                        realm sections it covers.
 *   aDeedEntersTheWorld  what it buys: a favour, priced by `whatADeedLeaves`.
 *
 * ── WHAT THIS FILE PINS ──────────────────────────────────────────────────
 *
 *   1. Neither sentence reaches the blank look any more, at any of the three
 *      states below.
 *   2. Holding nothing is refused, and the refusal says you hold nothing to
 *      pass on rather than that the sentence could not be read.
 *   3. Holding it at part mastery is refused, and the refusal names the parts.
 *   4. Holding the whole of it lands: the art is on the student's world row
 *      afterwards, a favour is open in the player's favour, and the span is
 *      spent.
 *   5. A season cut short leaves the student with nothing. Found by playing
 *      this file: with an empty pack the skip handed control back at 50 days of
 *      60 with starvation begun, and an art that goes in halfway is not a thing
 *      this engine has a row for.
 *   6. `teach me` still reaches being taught. The two directions share every
 *      word and the wrong one winning is the obvious way to break this.
 *
 * ── HOW THE SCENARIOS ARE ARRANGED ───────────────────────────────────────
 *
 * Entirely by PLAYING, with no admin at all. `I learn Swallow-Skimming Step`
 * opens at ordinal 0, and `I practise Swallow-Skimming Step for 3 years` takes
 * a mortal-grade art from 0 to full mastery in one turn. Both are asserted
 * rather than assumed, so a route that stops being playable fails here instead
 * of quietly measuring nothing.
 */

import { makeGameInWorld } from './harness';
import { parseIntent } from '../../src/web/verb-pattern-table';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo';

const WORLD = 'a-xianxia-run';

/** Opens at ordinal 0, is nobody's property, and has no element to fight. */
const AN_ART_A_BEGINNER_CAN_HOLD = 'Swallow-Skimming Step';
const ITS_ID = 'swallow-skimming-step';

function gotTheBlankLook(turn: { toolCalls: readonly { name: string; ok: boolean }[] }): boolean {
    return turn.toolCalls.some(call => call.name === 'engine.parseIntent' && !call.ok);
}

function everythingSaid(turn: {
    narration: string;
    toolCalls: readonly { summary: string }[];
}): string {
    return [turn.narration, ...turn.toolCalls.map(call => call.summary)].join('\n');
}

/** GIVEN a fresh run: standing in a square, carrying no art at all. */
async function holdingNothing() {
    const harness = await makeGameInWorld({ seed: 'xianxia', worldSeed: WORLD });
    await harness.game.newRun('Prober');
    return harness;
}

/**
 * GIVEN the art is held, at whatever mastery the practice reached.
 *
 * The provisioning turn is not decoration. A teaching is a span like any other
 * and `shortSkip` hands control back when the food runs out - measured, the
 * lesson stopped at 50 days of 60 with *starvation begun*, and the art did not
 * go in. Which is the engine being right: a road goes in whole or not at all.
 */
async function holdingIt(years: number) {
    const harness = await holdingNothing();
    await harness.game.act(`I learn ${AN_ART_A_BEGINNER_CAN_HOLD}`);
    if (years > 0) {
        await harness.game.act(`I practise ${AN_ART_A_BEGINNER_CAN_HOLD} for ${years} years`);
        await harness.game.act('I buy a year of provisions');
    }
    const me = harness.game.state().cultivator;
    const known = harness.repos.techniques.getKnown(me.id, ITS_ID);
    return { ...harness, me, mastery: known?.mastery ?? null };
}

/** Somebody standing here who does not already carry it. */
function aStudentHere(harness: Awaited<ReturnType<typeof holdingIt>>, world: {
    npcs: readonly { id: string; cultivation: { techniqueIds: readonly string[] } }[];
}) {
    const me = harness.game.state().cultivator;
    return harness.game.present(me)
        .filter(row => row.id !== me.id)
        .find(row => {
            const npc = world.npcs.find(other => other.id === row.id);
            return npc !== undefined && !npc.cultivation.techniqueIds.includes(ITS_ID);
        });
}

describe('the sentences reach a verb at all', () => {
    for (const said of ['I teach her what I know', 'I show her the form']) {
        it(`"${said}" is read as teaching somebody`, () => {
            expect(parseIntent(said).action).toBe('teach');
        });
    }

    it('"teach me" is still being taught, not teaching', () => {
        expect(parseIntent('I ask her to teach me').action).not.toBe('teach');
        expect(parseIntent('teach me').action).not.toBe('teach');
    });
});

describe('a cultivator carrying nothing', () => {
    for (const said of ['I teach her what I know', 'I show her the form']) {
        it(`"${said}" refuses honestly rather than blankly`, async () => {
            const at = await holdingNothing();
            const turn = await at.game.act(said);

            expect(gotTheBlankLook(turn), 'the blank look').toBe(false);
            // The honest refusal: nothing to pass on. Not "I could not read you".
            expect(everythingSaid(turn).toLowerCase()).toContain('nothing');
            expect(turn.toolCalls.some(call => call.action === 'teach')).toBe(true);
        });
    }
});

describe('a cultivator holding an art at part mastery', () => {
    it('is refused, and the refusal names the parts', async () => {
        const at = await holdingIt(0);
        expect(at.mastery, 'the played route no longer puts the art on the sheet').toBe(0);

        const turn = await at.game.act('I teach her what I know');
        expect(gotTheBlankLook(turn)).toBe(false);
        expect(everythingSaid(turn)).toContain(AN_ART_A_BEGINNER_CAN_HOLD);
        // The gate is `couldWriteOutACopy`, and its refusal is about how much of
        // it you hold rather than about whether you were allowed.
        expect(everythingSaid(turn).toLowerCase()).toMatch(/parts in a hundred|well enough/);
    });
});

describe('a cultivator holding the whole of an art', () => {
    it('hands it on: the student carries it afterwards, and it is owed', async () => {
        const at = await holdingIt(3);
        expect(at.mastery, 'three years of practice no longer reaches full mastery').toBe(1);

        const world = await at.game.loadWorld();
        const student = aStudentHere(at, world!);
        expect(student, 'nobody here who could take it').toBeTruthy();

        const owedBefore = ledgerAbout(at.db, student!.id).length;
        const turn = await at.game.act(`I teach ${student!.name} ${AN_ART_A_BEGINNER_CAN_HOLD}`);

        expect(gotTheBlankLook(turn)).toBe(false);
        expect(turn.toolCalls.filter(call => !call.ok && !call.name.startsWith('narrator.')))
            .toEqual([]);

        // THE ART IS ON THEM. The one thing that makes this a verb rather than
        // a paragraph.
        const after = await at.game.loadWorld();
        const them = after!.npcs.find(npc => npc.id === student!.id);
        expect(them?.cultivation.techniqueIds).toContain(ITS_ID);

        // AND IT OPENED AN ACCOUNT. `taught_technique` had no producer before.
        expect(ledgerAbout(at.db, student!.id).length).toBeGreaterThan(owedBefore);
        expect(everythingSaid(turn)).toContain(student!.name);
    });

    it('leaves them nothing when the season is cut short', async () => {
        // The same arrangement with the pack left empty. Measured: the skip
        // hands control back at 50 days of 60 with starvation begun.
        const at = await holdingNothing();
        await at.game.act(`I learn ${AN_ART_A_BEGINNER_CAN_HOLD}`);
        await at.game.act(`I practise ${AN_ART_A_BEGINNER_CAN_HOLD} for 3 years`);

        const world = await at.game.loadWorld();
        const student = aStudentHere(at as never, world!);
        const turn = await at.game.act(`I teach ${student!.name} ${AN_ART_A_BEGINNER_CAN_HOLD}`);

        expect(gotTheBlankLook(turn)).toBe(false);
        const after = await at.game.loadWorld();
        expect(
            after!.npcs.find(npc => npc.id === student!.id)?.cultivation.techniqueIds,
            'a lesson that stopped halfway still put the art in'
        ).not.toContain(ITS_ID);
        expect(everythingSaid(turn).toLowerCase()).toContain('whole');
    });

    it('says whose art it is', async () => {
        const at = await holdingIt(3);
        const world = await at.game.loadWorld();
        const student = aStudentHere(at, world!);
        const turn = await at.game.act(`I teach ${student!.name} ${AN_ART_A_BEGINNER_CAN_HOLD}`);

        // Provenance is stated either way round: enough houses hand this one out
        // that none of them can call it theirs, and the engine says so rather
        // than saying nothing.
        expect(everythingSaid(turn).toLowerCase()).toMatch(/owns it|theirs|nobody owns/);
    });
});

/**
 * AND THE HOUSE WHOSE ART IT WAS ANSWERS.
 *
 * The design question the defect was really about: a cultivator handing out
 * somebody's house art is a live thing in this genre, and it must not be free.
 * It is not refused - nothing here bans anything - it is answered, through the
 * same `whatTheHouseDoesAboutIt` a sold copy already goes through, because what
 * a house loses is the art being OUT and it does not become less out because it
 * left through somebody's mouth.
 *
 * The rung is arranged with admin, which is arranging rather than asserting: an
 * art that opens at Qi Condensation Layer 6 needs somebody standing there, the
 * climb has its own tests, and forty played turns of breakthroughs would make
 * this fixture flaky. Everything the test measures is played.
 */
describe('handing on an art that belongs to a house', () => {
    const adminBefore = process.env.ADMIN_MODE;
    beforeAll(() => { process.env.ADMIN_MODE = 'true'; });
    afterAll(() => {
        if (adminBefore === undefined) delete process.env.ADMIN_MODE;
        else process.env.ADMIN_MODE = adminBefore;
    });

    // Two houses teach it, so it is somebody's; it has no element, so no root
    // refuses it; and it opens well below where the arrangement stands.
    const A_HOUSE_ART = 'Twin Lotus Cultivation Method';

    it('is not refused, and the house is told what happened', async () => {
        const harness = await makeGameInWorld({
            seed: 'xianxia', worldSeed: WORLD, adminMode: true
        });
        await harness.game.newRun('Prober');
        await harness.game.act('ADMIN set_realm ordinal=10');
        await harness.game.act(`I learn ${A_HOUSE_ART}`);
        await harness.game.act(`I practise ${A_HOUSE_ART} for 5 years`);
        await harness.game.act('I buy a year of provisions');

        const world = await harness.game.loadWorld();
        const me = harness.game.state().cultivator;
        const student = harness.game.present(me)
            .filter(row => row.id !== me.id)
            .find(row => {
                const npc = world!.npcs.find(other => other.id === row.id);
                return npc !== undefined
                    && !npc.cultivation.techniqueIds.includes('twin-lotus-cultivation-method')
                    && npc.cultivation.realmOrdinal >= 5;
            });
        expect(student, 'nobody here stands high enough to take it').toBeTruthy();

        const turn = await harness.game.act(`I teach ${student!.name} ${A_HOUSE_ART}`);

        expect(gotTheBlankLook(turn)).toBe(false);
        // It LANDED. A betrayal that is quietly made impossible is the same
        // defect as one that is quietly made free.
        const after = await harness.game.loadWorld();
        expect(after!.npcs.find(npc => npc.id === student!.id)?.cultivation.techniqueIds)
            .toContain('twin-lotus-cultivation-method');
        // AND IT COST SOMETHING. The engine names the house and runs the house's
        // own answer rather than leaving the leak unpriced.
        expect(everythingSaid(turn)).toMatch(/'s art and you are not theirs/);
        expect(turn.toolCalls.map(call => call.name))
            .toContain('social.whatTheHouseDoesAboutIt');
    }, 120_000);
});
