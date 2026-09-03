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
import { theClauseThisTurnDidNotRun } from '../../src/web/the-part-of-the-sentence-that-was-not-run';
import { ASKING_RATHER_THAN_DOING, theWholeSentenceIsAQuestion } from '../../src/web/asking-is-not-doing';
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
            ['negotiate', who => `I negotiate with ${who}`],
            // The eleventh, and the reason it is here is the reason this
            // assertion exists at all: the engine has resolved a theft off a
            // person through `interact` since the pressure model was wired, and
            // the deterministic parser answered every phrasing of it with
            // `unclear`. So the verb spent days for a player with a model
            // configured and did nothing at all for a player without one.
            ['steal', who => `I steal from ${who}`]
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

    /**
     * And the thing above the line keeps its refusal, now naming a route.
     *
     * THE SUBJECT HAS TO BE UNBUYABLE FROM EVERYBODY, not only from a stall.
     * This asked for the Azure Dew canon, which is `soldAtStall: false` and
     * `isCommonlyHeld: true` - a house's recruitment pitch that no stall
     * stocks and that any of its disciples may write out again. Once people
     * standing here could sell a copy, whether this spent stones depended on
     * whether somebody carrying one happened to be in the square, and the
     * world here is not pinned. It passed alone and failed in company for a
     * year of session time.
     *
     * `single-road-treatise` is false on both counts: no stall carries it and
     * nobody may copy it. There is no seller in any world.
     */
    it('still refuses to sell what nobody sells, and says what would work', async () => {
        const { db, game } = makeGame({ seed: 'not-for-sale', worldEnabled: true });
        const { cultivator } = await game.newRun('Lin Baoqing');
        const before = cultivatorRow(db, cultivator.id);

        const result = await game.act('I buy the Single Road Treatise');

        expect(cultivatorRow(db, cultivator.id).spirit_stones).toBe(before.spirit_stones);
        // Says it is not sold, and then says what is - which is the whole of
        // "names a route" for a thing whose route is not a house at all. The
        // old subject was a house's canon and the old wording named the house;
        // this one is a ruin treasure and there is no house to name.
        expect(result.narration).toMatch(/not sold|nobody sells|does not sell/i);
        expect(result.narration).toMatch(/What is:/);
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

/**
 * INSTANCE 4: the act sits in the `if` clause, and the question is about what
 * follows from it.
 *
 * The three at the top of this file are questions ABOUT an act - "can I leave",
 * "can I cultivate here". This is the same person asking the same thing about
 * the CONSEQUENCE instead, and the pattern table reads the verb in the `if`
 * clause as a plain command. `what happens if I cultivate here` was already
 * covered; every other way of asking it was not.
 *
 * It is the most expensive face found so far, and it is worse than the three
 * above for a reason worth keeping: those cost a month, a membership and a
 * sect. This one is unbounded, because the duration in the sentence is real -
 * "will someone come for me if I seclude for ten years" sat the cultivator down
 * for ten years against a hundred-year lifespan, on a sentence in which nobody
 * had decided anything.
 *
 * Measured on the DETERMINISTIC tier, which `AGENTS.md` holds is a shipping
 * mode, so none of this needed a model to be wrong.
 */
describe('a question about what would follow is not the act it names', () => {
    /**
     * The whole family, and it is PLAYED rather than classified.
     *
     * The first draft of this asserted `costsTheAskerNothing(parseIntent(said))`
     * and went red on two of the family. Chasing that found something worth more
     * than the test: **`costsTheAskerNothing` is answered at the ACTION and is
     * wrong for six verbs.** It asks {@link READ_ONLY_ACTIONS} by name, and
     * `sect`, `site`, `posture`, `offer`, `oath` and `passage` are all absent
     * from it while `theReadThatAnswersIt` routes every one of them to a read by
     * dropping the intent. So the predicate calls those reads costly.
     *
     * The proof that the predicate and not the guard is what is wrong:
     * `can I leave my sect` - INSTANCE 3 at the top of this file, the sentence
     * that permanently left a house and the reason this module exists - resolves
     * to `{sect, standing, leaving}`, spends nothing, and `costsTheAskerNothing`
     * returns FALSE for it. An instrument that fails the canonical case is the
     * instrument, not the finding.
     *
     * That is the `interact` shape in six more verbs, and this file's own
     * docstring already argues why it cannot be a list. Not fixed here: widening
     * that predicate changes what every consumer believes, including the
     * dropped-clause reporter whose measured corpus was calibrated against it,
     * and it wants its own change with its own arms. Recorded so the next person
     * does not read the `false` as a finding about the mood guard.
     *
     * So the bar is what the player would actually notice: one pinned world, one
     * run, every sentence in the family put to it, and the clock and the purse
     * unmoved by any of them. Nothing here can be satisfied by a classification.
     */
    it('spends nothing on any of them, measured', async () => {
        const { game } = await makeGameInWorld({ worldSeed: 'a-question-is-not-a-decade' });
        await game.newRun('Shen Wuyou');

        for (const said of [
            // The played instance, and the family around it.
            'will someone bother me if I sit and cultivate here?',
            'will anyone bother me if I cultivate here',
            'will someone come for me if I seclude for ten years',
            'will I be interrupted if I sit here for a year',
            'does anybody care if I gather here',
            'is it a problem if I cultivate here',
            'would anyone stop me if I took the manual',
            'am I in danger if I stay here',
            'do I lose anything if I leave the sect',
            'can they find me if I seal the door',
            // The ground asked about by name rather than by pronoun.
            'is this cave safe to seclude in or will someone find me',
            'is that road safe to travel',
            'is this place safe to sleep in',
            'is this ground worth cultivating on',
            'is the valley dangerous'
        ]) {
            const before = await game.state();
            await game.act(said);
            const after = await game.state();

            expect(after.run!.elapsedDays, `"${said}" spent days`)
                .toBe(before.run!.elapsedDays);
            expect(after.cultivator!.spiritStones, `"${said}" spent stones`)
                .toBe(before.cultivator!.spiritStones);
            expect(after.cultivator!.age, `"${said}" aged them`)
                .toBe(before.cultivator!.age);
        }
    }, 300_000);

    it('names the ten-year one on its own, because it is the reason for the rule', () => {
        // Not folded into the loop above. A regression here is not "a guard got
        // narrower", it is a decade of somebody's life spent on a question - and
        // the routing claim is worth pinning separately from the spend, because
        // the two could break independently.
        const plan = parseIntent('will someone come for me if I seclude for ten years');
        expect(plan.action).not.toBe('seclude');
        expect(parseIntent('will someone bother me if I sit and cultivate here?').action)
            .not.toBe('cultivate');
        expect(parseIntent('does anybody care if I gather here').action).not.toBe('gather');
        expect(parseIntent('is that road safe to travel').action).not.toBe('move');
    });

    /**
     * The other direction, and it is the half that proves the widening did not
     * eat the composition path.
     *
     * Every sentence here contains `if` or a demonstrative and is a COMMAND.
     * The anchor is what separates them: somebody who has decided puts
     * themselves first, so the interrogative can never be opening the utterance.
     */
    it('leaves a command that merely contains a condition alone', () => {
        for (const [said, action] of [
            ['I will cultivate here if I can', 'cultivate'],
            ['I seclude for ten years', 'seclude'],
            ['I sit and cultivate here', 'cultivate'],
            ['I cultivate for ten years', 'cultivate'],
            ['I gather herbs here', 'gather'],
            ['I fight him if he draws', 'attack'],
            ['I travel to Kettle', 'move']
        ] as const) {
            const plan = parseIntent(said);
            expect(plan.action, said).toBe(action);
            expect(costsTheAskerNothing(plan), `"${said}" stopped costing anything`).toBe(false);
        }
    });

    /**
     * And the reporter still reports, which is the third direction and the one
     * a widening would break silently.
     *
     * `theWholeSentenceIsAQuestion` ORs this regex, so every branch added here
     * also silences the dropped-clause report. That is right for a question and
     * is the whole defect for a plan, so the six mirror cases have to survive
     * every widening of the mood test. See
     * `the-part-of-the-sentence-that-was-not-run.test.ts` for the rule itself.
     */
    it('and a genuine two-act sentence is still reported', () => {
        for (const [said, action] of [
            ['I buy a month of rations and eat', 'eat'],
            ['I gather herbs and go to the market', 'gather'],
            ['I cultivate and eat when I am hungry', 'cultivate'],
            ['I go to Nine Peaks and look for a teacher', 'move'],
            ['I eat and then cultivate for a year', 'cultivate'],
            ['I sell the herbs and buy a pill', 'buy']
        ] as const) {
            const found = theClauseThisTurnDidNotRun(said, parseIntent(said).action);
            expect(found?.action, said).toBe(action);
        }
    });

    it('played, the ten-year seclusion question passes no time at all', async () => {
        const { game } = await makeGameInWorld({ worldSeed: 'a-question-is-not-a-decade' });
        await game.newRun('Shen Wuyou');

        const before = await game.state();
        await game.act('will someone come for me if I seclude for ten years');
        const after = await game.state();

        expect(after.run!.elapsedDays).toBe(before.run!.elapsedDays);
        expect(after.cultivator!.age).toBe(before.cultivator!.age);
    }, 120_000);
});

/**
 * THE GENERAL FORM: a closing question mark means this is not an action.
 *
 * The design owner's ruling, and it arrived after this list had grown a shape
 * at a time four separate times - the modals, the method questions, the
 * progressives, the conditional - each one a player who had typed a question
 * and been charged for it, the worst of them for ten years:
 *
 *   > "you can ID based on the presence of a ? that this is typically not an
 *   >  action"
 *   > "and an incoherent ? should be rightfully refused"
 *
 * Both halves are tested here and the second is what keeps it honest. A `?` is
 * a signal, not a licence to route: a question naming a verb the reader
 * understands reaches that verb's read, and one it cannot parse reaches
 * `unclear` and says so. Collapsing the second case into the first would make
 * the family look complete and would delete the surface that teaches somebody
 * the verb list.
 */
describe('a closing question mark means this is not an action', () => {
    /**
     * Questions no branch in the list reaches. The mark is the only thing that
     * says these are questions, which is the whole argument for the rule.
     *
     * Measured, not classified. `costsTheAskerNothing` is answered at the ACTION
     * and is wrong for at least seven verbs - `work` is one, and "somebody
     * bothers me while I work the season?" correctly reaches `work` with intent
     * `board`, the free listing, which that predicate calls costly. The clock
     * and the purse cannot be argued with.
     */
    const ONLY_THE_MARK_SAYS_SO = [
        'anyone going to trouble me while I sit here?',
        'I seclude ten years and nobody finds me?',
        'somebody bothers me while I work the season?',
        'nobody comes looking while I cultivate?',
        'I sit here a hundred years and stay whole?',
        'anybody hunting me in the Low Fall?',
        'I gather the whole season without trouble?'
    ];

    it('spends nothing on any of them, measured', async () => {
        const { game } = await makeGameInWorld({ worldSeed: 'a-mark-is-not-a-decision' });
        await game.newRun('Shen Wuyou');

        for (const said of ONLY_THE_MARK_SAYS_SO) {
            const before = await game.state();
            await game.act(said);
            const after = await game.state();

            expect(after.run!.elapsedDays, `"${said}" spent days`)
                .toBe(before.run!.elapsedDays);
            expect(after.cultivator!.spiritStones, `"${said}" spent stones`)
                .toBe(before.cultivator!.spiritStones);
            expect(after.cultivator!.age, `"${said}" aged them`)
                .toBe(before.cultivator!.age);
        }
    }, 300_000);

    /**
     * Without the mark, five of those seven were spending - one of them a
     * decade. Pinned so the rule cannot be quietly narrowed back: these are the
     * sentences that have no other branch to fall back on.
     */
    it('is what turns those from acts into reads', () => {
        for (const said of ONLY_THE_MARK_SAYS_SO) {
            expect(theWholeSentenceIsAQuestion(said), said).toBe(true);
            // And the same words with the mark taken off are NOT covered by it,
            // which is what makes this branch load-bearing rather than a
            // duplicate of the four above it.
            const bare = said.replace(/\?$/, '');
            expect(
                ASKING_RATHER_THAN_DOING.test(bare.toLowerCase()),
                `"${bare}" was already covered without the mark`
            ).toBe(false);
        }
    });

    /**
     * The second half of the ruling, and it is not a gap to be tidied away.
     *
     * A question the parser cannot make sense of must be REFUSED, not executed
     * as the nearest costly verb and not deflected into a ground read. `unclear`
     * is on `READ_ONLY_ACTIONS`, so `theReadThatAnswersIt` returns it untouched
     * and the misparse surface - the thing that teaches somebody what the verbs
     * are - survives.
     */
    it('refuses an incoherent question rather than executing or deflecting it', () => {
        for (const said of [
            'is this ground safe to cultivate on or will I be interrupted?',
            'the ground here safe to sit on for a decade?'
        ]) {
            const plan = parseIntent(said);
            expect(plan.action, said).toBe('unclear');
            expect(costsTheAskerNothing(plan), said).toBe(true);
        }
    });

    /**
     * Only a mark that CLOSES the utterance counts.
     *
     * "What now? I cultivate for a year" is a question and then a decision, and
     * the decision is the sentence. This is the guard on the whole rule: without
     * it, one idle question at the front of a line would disarm everything
     * after it.
     */
    it('leaves a question followed by a decision alone', () => {
        const plan = parseIntent('what now? I cultivate for a year');
        expect(plan.action).toBe('cultivate');
        expect(costsTheAskerNothing(plan)).toBe(false);
    });

    /**
     * And it is a no-op wherever the sentence already reached a read, which is
     * why it is safe to apply this widely.
     *
     * `theReadThatAnswersIt` returns a free plan untouched, so marking a
     * sentence as asking can only move a plan that would have SPENT. Measured
     * over 5,929 sentences harvested from this repository's own web and server
     * test files: 20 were newly read as asking by the mark, and the routing of
     * ZERO of them changed. The old objection to this rule - that "what now?"
     * is not about any particular act - was true and did not matter.
     */
    it('does not move a sentence that already reached a read', () => {
        for (const said of [
            'what is for sale here?',
            'what are the prices here?',
            'what news is there?',
            "who's in charge?",
            'what is your name?',
            'how much do I have left?'
        ]) {
            const withMark = parseIntent(said);
            const withoutMark = parseIntent(said.replace(/\?$/, ''));
            expect(withMark.action, said).toBe(withoutMark.action);
        }
    });
});

/**
 * INSTANCE 5: a conditional is not a commitment.
 *
 * The third face of the family after *asking is not doing* and *a question is
 * not a command*, and the only one so far that did not spend a day - it changed
 * who the player WAS. Played, standing on Azure Cloud Pavilion grounds:
 *
 *   > if they'll have me, I'll join
 *   "You are now on the rolls of the Azure Cloud Pavilion, a Sword Elder."
 *
 * No decline, no refusal, no admission process. "If X, I'll Y" states a POLICY:
 * the player says what they would do and waits to hear whether X holds. Not
 * knowing whether the house would have them is the entire content of the
 * sentence, and the game answered it by enrolling them.
 *
 * Urgent rather than interesting, because a nomination and admission layer was
 * built this session - postings entered only by nomination, an ask that points
 * at your own house, a house that may refuse you on merit - and a sentence that
 * enrols you for free walks past all of it.
 *
 * THE RANK WAS NOT THE BUG. Seating a cultivator at ordinal 25 near the top of
 * a ladder that admits from 3 is the system working, ruled by the design owner:
 * *"you might enter as a sword elder too, they wouldn't offer an outer disciple
 * to a 29"*. `entryRankIndexFor` is untouched.
 */
describe('a conditional is not a commitment', () => {
    /**
     * The played sentence, and the bar is the one that matters: nobody is
     * enrolled. Measured on the rolls rather than on a verb name, because what
     * went wrong was a membership row, not a routing label.
     */
    it('does not enrol anybody who said what they would do', async () => {
        const { db, game } = await makeGameInWorld({ worldSeed: 'a-policy-is-not-a-decision' });
        const { cultivator } = await game.newRun('Mo Qianshu');

        const before = await game.state();
        await game.act("if they'll have me, I'll join");
        const after = await game.state();

        expect(sectOf(db, cultivator.id), 'a conditional put somebody on the rolls').toBeNull();
        expect(after.cultivator!.sectRank).toBeNull();
        expect(after.run!.elapsedDays).toBe(before.run!.elapsedDays);
    }, 120_000);

    /**
     * And it ANSWERS, which is the half that makes this a fix rather than a
     * refusal. The design owner's shape for the reply, in their own words:
     *
     *   > "they would, at Outer Disciple. Do you want to"
     *
     * Both halves are required. "They would" settles the condition; the rung is
     * the terms, and it is what makes the answer worth having - entering a house
     * at its floor and entering it near its top are different decisions, and a
     * player told only that they would be taken has to ask again.
     */
    it('answers whether they would, and on what footing', async () => {
        const { game } = await makeGameInWorld({ worldSeed: 'a-policy-is-not-a-decision' });
        await game.newRun('Mo Qianshu');

        const result = await game.act("if they'll have me, I'll join");

        expect(result.narration).toMatch(/would take you/i);

        // AND IT SAYS NOTHING HAPPENED, which is the half a model will
        // otherwise supply for itself. Played, before this line existed:
        // "The offer was met. You are a Lamp Novice of Sweptground Temple." -
        // the engine had enrolled nobody, and the prose collapsed *would seat
        // you as Lamp Novice* into *you are one*, which is this whole family's
        // defect committed one layer along. It is on `required`, so
        // `withRequiredLines` appends it when the prose omits it.
        expect(result.narration).toMatch(/not on anybody's roll/i);
    }, 120_000);

    /**
     * The terms half - "at Outer Disciple" - rides on `wouldEnterAtRank`, which
     * lives in `sect-manage.ts`. That file is co-owned at the time of writing:
     * another agent rewired the field through their own `entryOfferFor` while
     * this was being played, so the field is in their working tree rather than
     * in this commit and the assertion belongs with theirs.
     *
     * What this commit owns is the prose that renders it, which degrades to
     * silence when the field is absent rather than throwing - so this asserts
     * the rendering only when the engine actually supplied a rung.
     */
    it('names the footing when the engine supplies one', async () => {
        const { game } = await makeGameInWorld({ worldSeed: 'a-policy-is-not-a-decision' });
        await game.newRun('Mo Qianshu');

        const result = await game.act("if they'll have me, I'll join");
        const named = /would take you, and would seat you as ([^.]+)\./.exec(result.narration);

        // Never a bare yes: if a rung is named it must be a real rank word, and
        // if none is named the sentence must not pretend to terms it lacks.
        if (named) expect(named[1].trim().length).toBeGreaterThan(2);
        else expect(result.narration).not.toMatch(/would seat you as\s*\./i);
    }, 120_000);

    /**
     * The read and the door may never disagree, and this is the assertion that
     * keeps them honest at the rung where it would hurt.
     *
     * `handleList` seats its answer with `entryRankIndexFor`, the same function
     * `handleJoin` seats by - that function's docstring exists to keep entry and
     * promotion from disagreeing, and this extends the property to the read. At
     * ordinal 25 against a house admitting far below, that is an elder-tier
     * seat, which is exactly the case that produced the report.
     */
    it('promises the rank the door actually gives', async () => {
        const { db, game } = await makeGameInWorld({ worldSeed: 'the-read-and-the-door' });
        const { cultivator } = await game.newRun('Mo Qianshu');
        db.prepare('UPDATE cultivators SET realm_ordinal = 25 WHERE id = ?').run(cultivator.id);

        const read = await game.act("if they'll have me, I'll join");
        const promised = /Azure Dew Sect would take you, and would seat you as ([^.]+)\./
            .exec(read.narration)?.[1];
        expect(promised, 'the read named no rank for a house that would take them').toBeTruthy();

        // Now actually commit, which must still work.
        await game.act('I join the Azure Dew Sect');
        const after = await game.state();

        expect(sectOf(db, cultivator.id), 'the commitment did not enrol').not.toBeNull();
        expect(after.cultivator!.sectRank).toBe(promised);
    }, 120_000);

    /**
     * The other direction, and it is the half a widening would break silently.
     *
     * A trailing `if` is a trigger on a decision already taken. The actor comes
     * first in every one of these, so none of them can match an expression
     * anchored at the start of the sentence - which is why the guard is
     * positional rather than a search for the word.
     */
    it('leaves a commitment with a trigger alone', () => {
        for (const [said, action] of [
            ['I fight him if he draws', 'attack'],
            ['I will cultivate here if I can', 'cultivate'],
            ['I join the Azure Dew Sect', 'sect'],
            ["I'll join the Azure Dew Sect", 'sect'],
            ['I buy the manual if it is cheap', 'buy']
        ] as const) {
            const plan = parseIntent(said);
            expect(plan.action, said).toBe(action);
            expect(
                theWholeSentenceIsAQuestion(said),
                `"${said}" was read as a question`
            ).toBe(false);
        }
    });

    /**
     * And the condition has to be about somebody else.
     *
     * "If I can, I'll cultivate here" is somebody telling the engine to go ahead
     * where possible, which is a decision. What made the played sentence a
     * question is that its condition was a fact about ANOTHER PARTY that the
     * player did not have - "if they'll have me" is the asking.
     */
    it('reads the whole family of leading conditionals, and only those', () => {
        for (const said of [
            "if they'll have me, I'll join",
            'if they will have me, I will join',
            "if they'd take me, I'll join the Azure Dew Sect",
            "if they accept me I'll join",
            'if the sect will take me, I join',
            "if he sells it, I'll buy it",
            "if there is work going, I'll take it"
        ]) {
            expect(theWholeSentenceIsAQuestion(said), said).toBe(true);
        }
        // The condition about the asker stays a decision.
        expect(theWholeSentenceIsAQuestion("if I can, I'll cultivate here")).toBe(false);
    });
});
