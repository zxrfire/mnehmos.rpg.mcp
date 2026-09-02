/**
 * A question about an action is not the action.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * FOUR INSTANCES OF ONE DEFECT, ALL FOUND BY PLAYING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The parser treated a stated desire, and then a stated question, as an
 * accomplished fact - so every obstacle the game so carefully described
 * evaporated the moment a player named it. Verbatim, from a fresh run as Lin
 * Baoqing, Qi Condensation Layer 1, thirty spirit stones, no sect, no arts:
 *
 *   "can I leave my sect"
 *       LEFT THE SECT, permanently, and reported "Contribution does not
 *       travel. Whatever was earned here stays here." A player asking what
 *       their options were was punished for asking.
 *
 *   "I want to learn the Lesser Qi-Gathering Manual"
 *       "Lesser Qi-Gathering Manual is held now... There is nothing standing
 *       between them and it except the work." Verified after: technique held,
 *       thirty stones untouched, no teacher, no time passed, no sect. One
 *       input earlier the game had refused to cultivate with one of the best
 *       sentences in it - "what is missing is not years and not discipline, it
 *       is a book, or somebody willing to teach them one."
 *
 *   "I want to join a sect"
 *       "Taken on by Azure Dew Sect, ranked Dew Servant. No journey was
 *       involved and none is implied." The line before, the game had answered
 *       "which sects would accept me" correctly: "Knowing a name is not an
 *       introduction. Somebody would have to put you in front of them."
 *
 *   "how do I treat my injuries"
 *       Bought four courses of care, spent twenty spirit stones, and lay still
 *       for thirty days. Asking HOW to do a thing did it, four times over.
 *
 * The last of those is why this file is not only about interrogatives. The
 * test is not the word at the front of the sentence; it is whether the player
 * has DECIDED. "How do I X" and "what would it take to X" are somebody working
 * out what X involves.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AND WHAT THIS FILE IS NOT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Not a ban. `AGENTS.md`: the correct answer to "may I" is always "yes, and
 * here is what it costs", and a refusal with no cost attached is a smaller
 * world than one that says yes and then charges for it. Every verb below is
 * still reachable by the sentence that commands it, and the commanding forms
 * are asserted here beside the asking ones so that a future fix to one cannot
 * quietly delete the other.
 */

import { describe, it, expect } from 'vitest';
import type Database from 'better-sqlite3';
import { makeGame, makeGameInWorld, cultivatorRow, type Harness } from './harness';
import {
    ACTION_NAMES,
    INTERACT_INTENTS,
    PRESSING_SOMEBODY,
    READ_ONLY_ACTIONS,
    costsTheAskerNothing,
    parseIntent
} from '../../src/web/actions';
import {
    isSoldAtAStall,
    manualsAStallCarries,
    stallPriceStones
} from '../../src/engine/world/what-a-copy-of-a-manual-costs-at-a-stall';
import { npcsAt } from '../../src/engine/world/world-state';
import { resetCultivationWorlds } from '../../src/server/state/cultivation-world';

const PRIMER = 'lesser-qi-gathering-manual';

const sectOf = (db: Database.Database, id: string) =>
    (db.prepare('SELECT sect_id FROM cultivators WHERE id = ?').get(id) as
        { sect_id: string | null } | undefined)?.sect_id ?? null;

/**
 * Get into a house, the way the refusal says to.
 *
 * Walking up is an attempt now, so a fixture that needs a member cannot assume
 * the first ask lands. The refusal is keyed on the DAY - asking twice in one
 * afternoon gets the same answer word for word - so the retry is time passing
 * rather than a reroll, which is exactly what the engine tells the player. A
 * fixture that looped on the same day would hang forever, and that it does not
 * is itself worth knowing.
 */
async function intoAHouse(
    db: Database.Database,
    game: { act(text: string): Promise<unknown> },
    id: string
): Promise<string> {
    for (let attempt = 0; attempt < 12; attempt++) {
        await game.act('I join the Azure Dew Sect');
        const held = sectOf(db, id);
        if (held !== null) return held;
        await game.act('I wait a day');
    }
    throw new Error('twelve days of asking and the house never once looked up');
}

describe('a question never changes state', () => {
    /**
     * INSTANCE 3, AND THE WORST OF THE FOUR.
     *
     * A question about whether something is possible performed the
     * irreversible thing it asked about, and the forfeiture is permanent:
     * contribution does not travel, and the seat cap means it cannot be
     * bought back by re-entering.
     */
    it('does not resign a membership when asked whether one could', async () => {
        const { db, game } = makeGame({ seed: 'asked-to-leave', worldEnabled: true });
        const { cultivator } = await game.newRun('Lin Baoqing');
        db.prepare('UPDATE cultivators SET spirit_stones = 500 WHERE id = ?').run(cultivator.id);

        const inAHouse = await intoAHouse(db, game, cultivator.id);

        for (const question of [
            'can I leave my sect',
            'could I leave the sect',
            'what would it cost to leave the sect',
            'should I leave the sect',
            'is it possible to leave my sect',
            'what happens if I leave the sect'
        ]) {
            await game.act(question);
            expect(sectOf(db, cultivator.id), `"${question}" resigned the membership`)
                .toBe(inAHouse);
        }
    }, 120_000);

    /** And the sentence that DECIDES still decides. Never a ban. */
    it('still leaves when told to', async () => {
        const { db, game } = makeGame({ seed: 'told-to-leave', worldEnabled: true });
        const { cultivator } = await game.newRun('Lin Baoqing');
        db.prepare('UPDATE cultivators SET spirit_stones = 500 WHERE id = ?').run(cultivator.id);

        await intoAHouse(db, game, cultivator.id);

        await game.act('I leave the sect');
        expect(sectOf(db, cultivator.id)).toBeNull();
    }, 120_000);

    /**
     * INSTANCE 4. Asking HOW spent stones and a month.
     *
     * Checked on the raw row rather than on the narration, because the
     * narration is exactly what was convincing about the bug: it described a
     * purchase in perfect detail and the purchase had happened.
     */
    it('does not buy a course of care when asked how care is got', async () => {
        const { db, game } = makeGame({ seed: 'asked-how-to-treat', worldEnabled: true });
        const { cultivator } = await game.newRun('Lin Baoqing');

        const before = cultivatorRow(db, cultivator.id);
        const daysBefore = game.state().run.elapsedDays;

        for (const question of [
            'how do I treat my injuries',
            'what would it take to treat my injuries',
            'where can I get my injuries treated',
            'how much would it cost to treat my injuries'
        ]) {
            await game.act(question);
        }

        const after = cultivatorRow(db, cultivator.id);
        expect(after.spirit_stones, 'asking how bought it').toBe(before.spirit_stones);
        expect(game.state().run.elapsedDays, 'asking how spent time')
            .toBe(daysBefore);
    }, 120_000);

    /** Asking whether the ground will take them does not spend a month on it. */
    it('does not spend a month when asked whether cultivating here would work', async () => {
        const { game } = makeGame({ seed: 'asked-to-cultivate', worldEnabled: true });
        await game.newRun('Lin Baoqing');
        const before = game.state().run.elapsedDays;

        await game.act('can I cultivate here');
        await game.act('should I cultivate here');

        expect(game.state().run.elapsedDays).toBe(before);
    });

    /**
     * The routing itself, asserted directly, because the four above can only
     * cover the verbs they happen to touch and the guard is general.
     *
     * `assess` is the default landing for anything not named in the table, and
     * it is in `READ_ONLY_ACTIONS`, so a verb added after this was written is
     * answered inertly by construction rather than by somebody remembering.
     */
    it('routes every asking form to a read and every commanding form to the verb', () => {
        const asked: Array<[string, string]> = [
            ['can I leave my sect', 'sect'],
            ['how do I treat my injuries', 'market'],
            ['what would it take to learn the Lesser Qi-Gathering Manual', 'list_techniques'],
            ['is it possible to learn the Lesser Qi-Gathering Manual', 'list_techniques'],
            ['could I learn the Lesser Qi-Gathering Manual', 'list_techniques'],
            ['can I cultivate here', 'ceiling'],
            ['where can I buy a manual', 'market']
        ];
        for (const [sentence, action] of asked) {
            expect(parseIntent(sentence).action, sentence).toBe(action);
        }

        // A question about leaving reaches the member's own standing, never
        // the resignation.
        expect(parseIntent('can I leave my sect').intent).toBe('standing');
        expect(parseIntent('I leave my sect').intent).toBe('leave');

        const commanded: Array<[string, string]> = [
            ['I leave the sect', 'sect'],
            ['I learn the Lesser Qi-Gathering Manual', 'learn_technique'],
            ['I buy the Lesser Qi-Gathering Manual', 'buy'],
            ['I cultivate for ten years', 'cultivate'],
            ['I get my injuries treated', 'treat']
        ];
        for (const [sentence, action] of commanded) {
            expect(parseIntent(sentence).action, sentence).toBe(action);
        }
    });

    /**
     * And the reads a player already had must not be swallowed by the guard.
     * Every one of these contains a modal next to "I" and every one of them
     * already answered correctly.
     */
    it('leaves the reads that already worked exactly where they were', () => {
        const unchanged: Array<[string, string]> = [
            ['what arts can I learn', 'list_techniques'],
            ['where can I go', 'destinations'],
            ['who can teach me', 'teacher'],
            ['what can I buy', 'market'],
            ['how long can I live', 'status'],
            ['what should I do', 'ceiling'],
            ['what can I refine', 'refine']
        ];
        for (const [sentence, action] of unchanged) {
            expect(parseIntent(sentence).action, sentence).toBe(action);
        }
    });
});

/**
 * INSTANCE 5, AND THE LAST OF THEM: the one the guard was built beside and did
 * not cover.
 *
 * `interact` sat in `READ_ONLY_ACTIONS` while seven of its ten intents pressed
 * somebody through `resolveAttempt` - days out of the same clock every other
 * span spends, and the purse when the attempt lands. So the post-pass that
 * exists to stop a question performing an act handed this one straight back to
 * the executor, and did it BY DESIGN: `theReadThatAnswersIt` returns early for
 * anything the list says is already free, which is exactly what makes it
 * complete for every verb labelled correctly and useless for one that is not.
 *
 * Played cold on a fresh run carrying thirty spirit stones, before the change:
 *
 *   > can I bribe Bai Jinglu with 10 spirit stones
 *     purse 30 -> 20, day 16 -> 17
 *
 * Measured on the row and the clock rather than on the narration, for the
 * reason instance 4 gives: the prose was a perfectly good description of a
 * bribe, and the bribe had happened.
 */
describe('asking whether somebody could be moved does not move them', () => {
    /**
     * A run in a PINNED world, standing in the busiest square in it, with the
     * names of the people who are actually there.
     *
     * `makeGameInWorld` and not `makeGame`, on the rule `AGENTS.md` states
     * outright: a played test that pins a seed to an outcome without pinning
     * the world is pinning a coincidence. This one names a specific person and
     * asserts what pressing them costs, so who that person turns out to be has
     * to be fixed - and the first draft of it, unpinned, drew a different
     * square on every ordering and went red on one intent out of ten.
     *
     * Being co-located is enough to be addressed - `somebodyAtHand` matches the
     * name against who is present, ahead of the knowledge gate - which is what
     * makes the fixture honest rather than a refusal in disguise. The
     * commanding halves below are the proof that it is: if nobody resolved,
     * nothing would spend and those tests would go red rather than green.
     */
    async function inTheBusiestSquare(seed: string): Promise<{
        db: Database.Database;
        game: Harness['game'];
        people: string[];
        /** Who is standing here NOW. See the note below on why this exists. */
        stillHere: () => Promise<string[]>;
    }> {
        resetCultivationWorlds();
        const { db, game } = await makeGameInWorld({ seed, worldSeed: `world-${seed}` });
        const { cultivator } = await game.newRun('Lin Baoqing');

        const world = (await game.loadWorld())!;
        const square = world.locations
            .map(l => ({ location: l, people: npcsAt(world, l.id) }))
            .filter(x => x.people.length >= 12)
            .sort((a, b) => b.people.length - a.people.length)[0];
        expect(square, 'the pinned world has no square with people in it').toBeDefined();

        db.prepare('UPDATE cultivators SET location = ? WHERE id = ?')
            .run(square.location.name, cultivator.id);
        return {
            db,
            game,
            people: square.people.map(p => p.name),
            // ── A CROWD IS NOT A FIXTURE ─────────────────────────────────
            //
            // `people` is a snapshot taken on day zero, and it is fine for the
            // tests that spend no days. It is NOT fine for one that spends six,
            // and that used to be invisible: the busiest place in a seeded world
            // was a REGION node holding 116 people, and nobody ever leaves one,
            // because a region is a container that the movement layer does not
            // move anybody in or out of.
            //
            // Once the seeder stopped stranding the upper stratum on region
            // nodes, the busiest place became an actual settlement - Scarwater,
            // 14 people - and a real settlement churns. Measured across the ten
            // turns below: 14 standing on day 0, 10 on day 1, and the tenth
            // person in the snapshot walked off with the other four.
            //
            // So a test that names somebody and then lets days pass has to ask
            // again who is there. This is the honest version of the fixture, and
            // it is worth having gone red to get it.
            stillHere: async () => {
                const now = (await game.loadWorld())!;
                return npcsAt(now, square.location.id).map(p => p.name);
            }
        };
    }

    /** The question forms, one per intent that presses somebody. */
    const asking = (who: string) => [
        `can I bribe ${who} with 10 spirit stones`,
        `could I threaten ${who}`,
        `should I seduce ${who}`,
        `is it possible to deceive ${who}`,
        `what would it cost to bribe ${who} with 5 spirit stones`,
        `how do I bribe ${who} with 5 spirit stones`,
        `can I interrogate ${who}`,
        `could I recruit ${who}`,
        `can I negotiate with ${who}`,
        // Not an interrogative and not an `interact` either - it reaches
        // `unclear`, which is inert. Kept because it was reported alongside the
        // others and a sentence asserted to cost nothing should be asserted to
        // cost nothing wherever it lands.
        `how do I get ${who} to help me`
    ];

    it('spends no stones and no days when asked whether one could', async () => {
        const { db, game, people } = await inTheBusiestSquare('asked-to-bribe');
        const cultivator = game.state().cultivator;
        const who = people[0];

        const purse = Number(cultivatorRow(db, cultivator.id).spirit_stones);
        const day = game.state().run.elapsedDays;
        expect(purse, 'a bribe nobody could afford proves nothing').toBeGreaterThan(10);

        for (const question of asking(who)) {
            await game.act(question);
            expect(Number(cultivatorRow(db, cultivator.id).spirit_stones), `"${question}" spent stones`)
                .toBe(purse);
            expect(game.state().run.elapsedDays, `"${question}" spent days`).toBe(day);
        }
    }, 180_000);

    /**
     * And the sentence that DECIDES still decides, at the honest price. Never a
     * ban: `AGENTS.md` is explicit that removing the cost is the worse of the
     * two failures, because the player cannot see it happen.
     *
     * This is also what stops the test above being vacuous. Both halves name
     * the same person in the same square on the same seed, so a fixture where
     * nobody resolved would fail here instead of passing there.
     *
     * The DAY is asserted and the purse is not, because the two are different
     * kinds of fact. `ASK_DAYS` floors at one, so an attempt that reached the
     * resolver always spent a day; the stones are spent only when the attempt
     * LANDS, which is the resolver's own odds and pinning it here would be
     * pinning those. That half was measured by playing instead: twelve
     * commanded bribes of ten stones against one person, two of which landed,
     * purse 20 to 10 to 0.
     */
    it('still spends a day on the person when told to', async () => {
        const { game, people } = await inTheBusiestSquare('told-to-bribe');

        const day = game.state().run.elapsedDays;
        await game.act(`I bribe ${people[0]} with 10 spirit stones`);
        expect(game.state().run.elapsedDays, 'pressing somebody cost nothing').toBeGreaterThan(day);
    }, 180_000);

    /**
     * THE SPLIT, MEASURED RATHER THAN DECLARED.
     *
     * `PRESSING_SOMEBODY` in `actions.ts` and `ATTEMPT_INTENTS` in `game.ts` are
     * two copies of one set - actions is below game and cannot import from it -
     * and a comment asking the next person to keep them together is not a
     * mechanism. So each of the ten intents is PLAYED in its commanding form
     * and classified by what it actually spent, and the measurement is compared
     * against the declaration. A member added on either side alone goes red.
     *
     * One sentence per intent and A DIFFERENT PERSON FOR EACH, all in one run,
     * judged on the DELTA either side so the accumulating clock does not
     * matter. The separate people are not tidiness: pressing the same person
     * ten times in a row is a different measurement - the resolver reads what
     * they already make of the asker and how many times they have heard it -
     * and what is being measured here is the intent, cold.
     *
     * The bribe names a sum inside the purse deliberately: a coin approach with
     * no figure in it is refused before the resolver and would read as free for
     * entirely the wrong reason.
     */
    it('spends on exactly the intents it says press somebody', async () => {
        const { game, stillHere } = await inTheBusiestSquare('which-ones-cost');

        // The sentence for each intent, built around whoever that intent's turn
        // is actually spoken to. The person is chosen at the moment of speaking
        // rather than ten turns earlier - see `stillHere`. What the docstring
        // asks for is preserved exactly: one sentence per intent, a different
        // person for each, and every one of them somebody who is standing here.
        const forms: ReadonlyArray<readonly [string, (who: string) => string]> = [
            ['talk', who => `I talk to ${who}`],
            ['trade', who => `I trade with ${who}`],
            ['apologise', who => `I apologise to ${who}`],
            ['bribe', who => `I bribe ${who} with 1 spirit stone`],
            ['threaten', who => `I threaten ${who}`],
            ['seduce', who => `I seduce ${who}`],
            ['deceive', who => `I deceive ${who}`],
            ['interrogate', who => `I interrogate ${who}`],
            ['recruit', who => `I recruit ${who}`],
            ['negotiate', who => `I negotiate with ${who}`]
        ];
        expect(forms.map(([intent]) => intent).sort(), 'an intent was added and not played here')
            .toEqual([...INTERACT_INTENTS].sort());

        const spokenTo = new Set<string>();
        for (const [intent, form] of forms) {
            const here = await stillHere();
            const who = here.find(name => !spokenTo.has(name));
            expect(who, `nobody is left in the square to put ${intent} to`).toBeDefined();
            spokenTo.add(who!);

            const sentence = form(who!);
            expect(parseIntent(sentence).intent, `"${sentence}" does not reach ${intent}`)
                .toBe(intent);

            const before = game.state().run.elapsedDays;
            await game.act(sentence);
            const spent = game.state().run.elapsedDays > before;

            expect(spent, spent
                ? `"${sentence}" spent days and ${intent} is not on PRESSING_SOMEBODY`
                : `"${sentence}" spent nothing and ${intent} is on PRESSING_SOMEBODY`)
                .toBe(PRESSING_SOMEBODY.has(intent));
        }
    }, 300_000);

    /**
     * The routing, asserted directly, because the played tests can only cover
     * the phrasings they happen to use.
     *
     * `investigate` and not `assess`, which is the table's own default for
     * anything it does not name. `GameService.assess` sends every subject that
     * is not the asker to `handleAssess` with `against: 'place'`, so a person's
     * name would have been looked up as GROUND and the question about somebody
     * answered with the weather where they stand - the deflection failure this
     * project keeps finding, and worse than a refusal because it reads like an
     * answer. `investigate` reads the person: their rung, their years, the
     * house they answer to. It is in `READ_ONLY_ACTIONS`, so it cannot spend,
     * move or kill however the question was phrased, and that membership is
     * asserted here rather than assumed.
     */
    it('routes a question about pressing somebody to a read of the person', () => {
        for (const question of [
            'can I bribe Bai Jinglu with 10 spirit stones',
            'could I threaten Bai Jinglu',
            'should I seduce Bai Jinglu',
            'is it possible to deceive Bai Jinglu',
            'can I interrogate Bai Jinglu',
            'could I recruit Bai Jinglu',
            'can I negotiate with Bai Jinglu'
        ]) {
            const plan = parseIntent(question);
            expect(plan.action, question).toBe('investigate');
            expect(READ_ONLY_ACTIONS, question).toContain(plan.action);
            // The person survives the downgrade, tail and all - the entity
            // resolver takes "Bai Jinglu with 10 spirit stones" and nothing
            // here has to understand the rest of the sentence.
            expect(plan.target, question).toContain('Bai Jinglu');
        }
    });

    /**
     * And a question that named a SUBJECT keeps it.
     *
     * A topic put to a person is already the free read - `askAround`, which
     * `GameService.interact` reaches before the pressure model - so downgrading
     * this one to a bare read of the person would have cost nothing and
     * answered a narrower question than the one asked. Only the intent is
     * dropped, and it is dropped rather than left alone because `askAround`
     * needs the person to be standing here: somebody known of but elsewhere
     * falls past it into the attempt.
     */
    it('keeps the subject when the question named one, and still cannot press', () => {
        for (const question of [
            'could I question Bai Jinglu about the ruins',
            'can I press Bai Jinglu about the Azure Dew Sect'
        ]) {
            const plan = parseIntent(question);
            expect(plan.action, question).toBe('interact');
            expect(PRESSING_SOMEBODY.has(plan.intent ?? ''), question).toBe(false);
            expect(plan.topic, question).toBeTruthy();
        }
    });

    /**
     * And the three that were always free stay exactly where they were.
     *
     * Narrowing to the intents that press is the rule `AGENTS.md` states as
     * fixing the gap that was demonstrated: "can I talk to the gate steward" is
     * a question about an act that settles nothing and costs nothing, and the
     * honest answer to it is the approach itself.
     */
    it('leaves the approaches that settle nothing where they were', () => {
        for (const question of [
            'can I talk to Bai Jinglu',
            'should I apologise to Bai Jinglu',
            'could I trade with Bai Jinglu'
        ]) {
            const plan = parseIntent(question);
            expect(plan.action, question).toBe('interact');
            expect(PRESSING_SOMEBODY.has(plan.intent ?? ''), question).toBe(false);
        }
    });

    /**
     * The classification asked of the PLAN, which is the question every
     * consumer actually has.
     *
     * `READ_ONLY_ACTIONS` is a statement about verbs and the cost of this one
     * is a fact about the sentence, so `costsTheAskerNothing` is the authority
     * and the list is not. That distinction is not decoration: it was found by
     * the reclassification breaking a guard in a different file.
     * `the-part-of-the-sentence-that-was-not-run.ts` reports a dropped clause
     * only when the clause would have COST something, was written while
     * `interact` was on the free list, and began falsely reporting "tell me
     * about the market and the prices" - a sentence its own header names as a
     * false report it must not make - the moment the list told the truth. It
     * asks this function now, and its corpus test is green again.
     */
    it('answers what a plan costs off the intent, not off the verb', () => {
        for (const intent of INTERACT_INTENTS) {
            expect(
                costsTheAskerNothing({ action: 'interact', intent, target: 'Bai Jinglu' }),
                `interact(${intent})`
            ).toBe(!PRESSING_SOMEBODY.has(intent));
        }
        // Every other verb keeps answering exactly as the list does.
        for (const action of ACTION_NAMES) {
            if (action === 'interact') continue;
            expect(costsTheAskerNothing({ action }), action)
                .toBe(READ_ONLY_ACTIONS.includes(action));
        }
    });

    /** And commanding still commands, for every one of the seven. */
    it('still reaches the attempt when the player has decided', () => {
        for (const [sentence, intent] of [
            ['I bribe Bai Jinglu with 10 spirit stones', 'bribe'],
            ['I threaten Bai Jinglu', 'threaten'],
            ['I seduce Bai Jinglu', 'seduce'],
            ['I deceive Bai Jinglu', 'deceive'],
            ['I interrogate Bai Jinglu', 'interrogate'],
            ['I recruit Bai Jinglu', 'recruit'],
            ['I negotiate with Bai Jinglu', 'negotiate']
        ] as ReadonlyArray<readonly [string, string]>) {
            const plan = parseIntent(sentence);
            expect(plan.action, sentence).toBe('interact');
            expect(plan.intent, sentence).toBe(intent);
        }
    });
});

describe('a manual costs what a manual costs', () => {
    /**
     * INSTANCE 2. Naming the book was the whole of acquiring it.
     *
     * `manuals.ts` has modelled books as objects with holders and counts for
     * the entire world from the beginning, and the player was not in it -
     * which is the defect `AGENTS.md` opens its "the world's rules must bind
     * the player too" section with, using books as the worked example.
     */
    it('does not hand over a road for naming it', async () => {
        const { db, game } = makeGame({ seed: 'named-is-not-held', worldEnabled: true });
        const { cultivator } = await game.newRun('Lin Baoqing');
        const before = cultivatorRow(db, cultivator.id);

        const result = await game.act('I want to learn the Lesser Qi-Gathering Manual');

        expect(game.state().cultivator.knownTechniques, 'free for the asking').toEqual([]);
        expect(cultivatorRow(db, cultivator.id).spirit_stones).toBe(before.spirit_stones);
        // A refusal must name what would work. `AGENTS.md`, and it is the best
        // thing in this build.
        expect(result.narration).toMatch(/stall|spirit stone|sold/i);
    }, 120_000);

    /**
     * And the correct verb was the one that did not work: "buy a manual" was
     * refused with the look people give somebody asking for a thing that is
     * not sold, and then listed millet, inns and ferry crossings.
     */
    it('answers "buy a manual" with what the stall has, and charges nothing to look', async () => {
        const { db, game } = makeGame({ seed: 'stall-listing', worldEnabled: true });
        const { cultivator } = await game.newRun('Lin Baoqing');
        const before = cultivatorRow(db, cultivator.id);

        const result = await game.act('buy a manual');

        expect(result.narration, 'the stall still refuses to exist')
            .not.toMatch(/thing that is not sold/i);
        expect(result.narration).toMatch(/Lesser Qi-Gathering Manual/);
        expect(cultivatorRow(db, cultivator.id).spirit_stones).toBe(before.spirit_stones);
    }, 120_000);

    /** The purchase itself: stones out, copy held, and the road then open. */
    it('sells the copy for stones, and the copy is what opens the road', async () => {
        const { db, game } = makeGame({ seed: 'buy-then-learn', worldEnabled: true });
        const { cultivator } = await game.newRun('Lin Baoqing');
        const purse = Number(cultivatorRow(db, cultivator.id).spirit_stones);
        const asking = stallPriceStones(PRIMER)!;
        expect(asking, 'the primer has no price').toBeGreaterThan(0);
        expect(asking, 'a beginner cannot afford the only road they have')
            .toBeLessThanOrEqual(purse);

        await game.act('I buy the Lesser Qi-Gathering Manual');
        const spent = purse - Number(cultivatorRow(db, cultivator.id).spirit_stones);
        expect(spent, 'the book was free').toBeGreaterThan(0);
        // Buying is not reading. Two separate facts, two separate sentences.
        expect(game.state().cultivator.knownTechniques).toEqual([]);

        await game.act('I learn the Lesser Qi-Gathering Manual');
        expect(game.state().cultivator.knownTechniques).toContain(PRIMER);
    }, 120_000);

    /**
     * The line the stall sits on, checked against the catalog rather than
     * against a list written here.
     *
     * `items.md`: below the line things have prices; above it cash is not the
     * medium, and that refusal is correct and good writing and stays. A house
     * book carrying no further than the market primer is still that house's -
     * the Azure Dew Sect's canon opens at 0 and stops at 13 exactly as the
     * block-printed one does, and four hundred years of Dew teachers wrote
     * into it. That is what somebody sweeps a courtyard for.
     */
    it('carries the widely-copied books and none of anybody\'s own', () => {
        const stock = manualsAStallCarries().map(m => m.id);
        expect(stock).toContain(PRIMER);
        expect(stock, 'a stall is selling a house its own recruitment pitch')
            .not.toContain('azure-dew-gathering-canon');
        expect(isSoldAtAStall('single-road-treatise'), 'a treasure went on a market stall')
            .toBe(false);
        for (const id of stock) expect(stallPriceStones(id)).toBeGreaterThan(0);
    });

    /** And the thing above the line keeps its refusal, now naming a route. */
    it('still refuses to sell what nobody sells, and says what would work', async () => {
        const { db, game } = makeGame({ seed: 'not-for-sale', worldEnabled: true });
        const { cultivator } = await game.newRun('Lin Baoqing');
        const before = cultivatorRow(db, cultivator.id);

        const result = await game.act('I buy the Azure Dew Gathering Canon');

        expect(cultivatorRow(db, cultivator.id).spirit_stones).toBe(before.spirit_stones);
        expect(result.narration).toMatch(/teach|house|stall/i);
    }, 120_000);
});

describe('a house takes somebody on, or it does not', () => {
    /**
     * INSTANCE 1. A category resolved to a specific house and enrolled the
     * player in it, one line after the game had said knowing a name is not an
     * introduction.
     */
    it('does not enrol anybody who asked about sects in general', async () => {
        const { db, game } = makeGame({ seed: 'a-sect-in-general', worldEnabled: true });
        const { cultivator } = await game.newRun('Lin Baoqing');

        for (const sentence of [
            'I want to join a sect',
            'I join a sect',
            'I apply to a sect',
            'should I join a sect'
        ]) {
            await game.act(sentence);
            expect(sectOf(db, cultivator.id), `"${sentence}" enrolled somebody`).toBeNull();
        }
    }, 120_000);

    /**
     * Walking up on your own is an ATTEMPT, and attempts have both outcomes.
     *
     * Pooled across seeds rather than pinned to one, because a single seed
     * proves only what that seed did - `AGENTS.md`, "pool the sample" - and
     * because what is being asserted is that the door is neither automatic nor
     * shut. Both halves are load-bearing: an automatic yes is the defect, and
     * a door nobody gets through is the ban the design forbids.
     */
    it('is neither an automatic yes nor a wall', async () => {
        let taken = 0;
        const seeds = 24;
        for (let i = 0; i < seeds; i++) {
            const { db, game } = makeGame({ seed: `door-${i}`, worldEnabled: true });
            const { cultivator } = await game.newRun('Lin Baoqing');
            await game.act('I join the Azure Dew Sect');
            if (sectOf(db, cultivator.id) !== null) taken++;
        }
        expect(taken, 'nobody walked up and got in').toBeGreaterThan(0);
        expect(taken, 'every stranger who asked was taken, with nobody speaking for them')
            .toBeLessThan(seeds);
    }, 300_000);
});
