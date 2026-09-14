/**
 * The prodigy's road, reached by a sentence.
 *
 * `writeNextStage` was a complete mechanism with no caller anywhere in `src/`
 * or `scripts/` - and `precedentAt` and `derivationYears` with it - while
 * `acquisition` offered the player `{ route: 'derived', how: 'Writing what
 * comes next yourself' }` and `assessAcquisition` priced it. So the game named
 * a road and had no verb that walked it, which is the same shape
 * `furnace-technique.ts` was found in and which `AGENTS.md` records.
 *
 * ── WHAT IS ASSERTED, AND WHY EACH ───────────────────────────────────────
 *
 * A PLAYED PATH, not a call into the handler. A sentence somebody would type,
 * through `parseIntent`, through the turn, and then the ceiling read back out
 * of SQLite on a later turn - because a derivation that does not survive a
 * reload is a narration, not a mechanic.
 *
 * THE YEARS ACTUALLY PASS. The price of this corridor is time and only time,
 * so a stage written for free would abolish it.
 *
 * AND THE REFUSALS SAY WHAT WOULD CHANGE THEM. `AGENTS.md`: *not having the
 * standing to do something is not the same as seeing nothing*. A cultivator
 * told no has to learn whether the obstacle is the road, the book or the years,
 * because those are three different lives.
 *
 * ── THE FIXTURE, AND WHY THIS PARTICULAR BOOK ────────────────────────────
 *
 * `moonlit-well-absorption-art` is elementally water, opens at ordinal 10 and
 * stops at 13, so a cultivator standing at 13 has run out of it - which is the
 * occasion for deriving at all. Extending it writes for ordinal 14, inside
 * Foundation Establishment, whose realm grants 200 years: the curve prices that
 * at 19 years against 7 water arts standing at or above it.
 *
 * A cultivation manual with NO road and no element - the block-printed primer
 * among them - cannot be extended by anybody at all, because `daoMatches` has
 * nothing to match. That is a property of seventeen catalog rows rather than of
 * this verb, and it is written down in the report rather than worked around
 * here.
 */

import { describe, it, expect } from 'vitest';
import { makeGameInWorld, engineCalls, planned } from './harness';
import { parseIntent } from '../../src/web/actions';
import { writeFlag } from '../../src/server/consolidated/cultivation-support';
import { FLAG_RATIONS_HELD } from '../../src/web/flag-keys';
import { stagesHeldBy, stagesOf, stagesWrittenSince } from '../../src/web/stages';
import { formInsight, recordAchievement } from '../../src/engine/cultivation/understanding';
import { CultivationRNG } from '../../src/engine/cultivation/rng';
import type { InsightDegree } from '../../src/schema/cultivation';

/** Water, opens at 10, stops at 13. The cultivator below stands at its cap. */
const MANUAL = 'moonlit-well-absorption-art';
/** It describes a crossing nobody gets to attempt twice, and says so. */
const CANNOT_BE_EXTENDED = 'chaos-origin-scripture';

const SAYING_IT = 'I write the next stage of the manual myself';

async function standingAtTheCap(
    seed: string,
    options: { road?: string; degree?: InsightDegree; manual?: string } = {}
) {
    const harness = await makeGameInWorld({ seed, worldSeed: `world-${seed}` });
    const manual = options.manual ?? MANUAL;
    const { cultivator } = await harness.game.newRun('Shen Qiu');

    harness.repos.techniques.learn(cultivator.id, manual, 0.9);
    // A CLEAN ROOT, and it is not a cheat. `drawingQi` is true at any focus
    // above zero, so a nineteen-year stretch takes 231 deviation checks: a root
    // carrying 0.08 innate instability dies partway through every time, which
    // is the game working and is not what this file is measuring. `single_water`
    // carries 0 and matches the manual's element, so the only deviation risk
    // left is an injury the run itself produced.
    harness.db
        .prepare(
            'UPDATE cultivators SET known_techniques = ?, realm_ordinal = 13, '
            + "spirit_root = 'single_water', spirit_stones = 500000 WHERE id = ?"
        )
        .run(JSON.stringify([manual]), cultivator.id);

    // THE ROAD, arranged rather than played. A Dao is degree 4 plus one
    // corroborating insight - `daoOf` is the authority and this is its shape,
    // not a second statement of it.
    const achievement = recordAchievement(
        { kind: 'enlightenment', onDay: 1, turn: 1, summary: 'It arrived.' },
        new CultivationRNG(`${seed}-insight`)
    );
    const access = { kind: 'teacher' as const, label: 'a teacher' };
    const road = options.road ?? 'water';
    harness.repos.cultivators.update(cultivator.id, {
        insights: [
            formInsight(
                { domain: 'element', subject: road, opening: 'o', access },
                options.degree ?? 4,
                achievement
            ),
            formInsight(
                { domain: 'element', subject: road, opening: 'o2', access },
                2,
                achievement
            )
        ]
    } as never);

    // Two decades of food. The stretch runs through the ordinary survival
    // layer, and a cultivator who starves out of it writes nothing - which is
    // asserted in its own right below rather than left to chance here.
    writeFlag(harness.db, cultivator.id, FLAG_RATIONS_HELD, '20000');

    return { ...harness, cultivatorId: cultivator.id };
}

describe('the sentence reaches the verb', () => {
    it('routes the act, and leaves the question next door alone', () => {
        for (const text of [
            'I write the next stage of the manual myself',
            'I work out what comes next on my own',
            'I extend the manual myself',
            'nobody has written past this so I will'
        ]) {
            expect(parseIntent(text).action, text).toBe('derive');
        }
        // The comparison is a different verb and costs nothing. A player who
        // asks what the routes are must not be charged a decade for asking.
        for (const text of [
            'how do I get further',
            'how does my manual go further',
            'what would it take to go past this'
        ]) {
            expect(parseIntent(text).action, text).toBe('acquisition');
        }
    });

    it('does not hand a generic noun through as the name of a book', () => {
        // "the next stage of the manual" names no manual. Passed through, the
        // handler searches what this cultivator practises for something called
        // `manual`, finds nothing, and refuses a sentence that was perfectly
        // clear.
        expect(parseIntent('I write the next stage of the manual myself').target)
            .toBeUndefined();
        expect(parseIntent('I write the next stage of the Moonlit Well Absorption Art').target)
            .toMatch(/Moonlit Well/i);
    });
});

/**
 * Say it until the manuscript is finished, and answer with how it went.
 *
 * NOT A LOOP FOR CONVENIENCE. `daysActuallySpent` cuts every stretch in this
 * game at its first encounter, so a nineteen-year project is never one sitting:
 * measured on this fixture, the first attempt lived 450 days of 6,935. The
 * player's own answer to that is to go back to it, and this is that, played.
 */
async function writeItToTheEnd(
    game: { act: (text: string) => Promise<{ state: { run: { elapsedDays: number } } }> },
    sittings = 60
) {
    let turns = 0;
    let last: Awaited<ReturnType<typeof game.act>> | null = null;
    while (turns < sittings) {
        last = await game.act(SAYING_IT);
        turns++;
        if (engineCalls(last as never).some(
            call => call.name === 'engine.writeNextStage' && call.ok
        )) break;
    }
    return { turns, last: last! };
}

describe('a cultivator writes what comes next', () => {
    it('spends the years, writes the stage, and the manual ends higher', async () => {
        const { game, repos, db, cultivatorId } = await standingAtTheCap('derive-played-b');

        expect(stagesWrittenSince(repos, MANUAL)).toBe(0);
        const before = game.state().run.elapsedDays;

        const first = await game.act(SAYING_IT);
        expect(planned(first).summary).toMatch(/derive/);
        // THE YEARS ARE SPENT WHETHER OR NOT THE STAGE LANDS. A sitting that
        // was interrupted still cost what it cost.
        expect(first.state.run.elapsedDays).toBeGreaterThan(before);

        const { turns, last } = await writeItToTheEnd(game);
        expect(turns, 'the manuscript never finished').toBeLessThan(60);

        // THE PRICE. 19 years off the curve for this manual at this rung, and
        // the whole of what this corridor costs - a stage written for free is
        // not a price at all.
        const spent = last.state.run.elapsedDays - before;
        expect(spent).toBeGreaterThan(15 * 365);

        // THE STAGE, in SQLite rather than in a sentence. Read back through the
        // same two functions any later turn reads it through, which is what
        // makes this a reload rather than an echo.
        expect(stagesWrittenSince(repos, MANUAL)).toBe(1);
        expect(stagesHeldBy(repos, cultivatorId, MANUAL)).toBe(1);
        const [stage] = stagesOf(repos, MANUAL);
        expect(stage.authorId).toBe(cultivatorId);
        // One person's working notes are not a house's polished canon.
        expect(stage.opacity).toBeGreaterThanOrEqual(0.35);

        // AND IT DOES NOT MINT A SECOND BOOK. The row they practise is the row
        // they practised; what moved is how far it has been written.
        const known = db
            .prepare('SELECT known_techniques FROM cultivators WHERE id = ?')
            .get(cultivatorId) as { known_techniques: string };
        expect(JSON.parse(known.known_techniques)).toEqual([MANUAL]);

        const call = engineCalls(last as never).find(c => c.name === 'engine.writeNextStage');
        expect(call?.ok).toBe(true);
        expect(call?.summary).toMatch(/cap 13 -> 14/);
    }, 300_000);

    it('the unfinished work keeps, and says how much of it is in', async () => {
        // The half that makes the verb usable at all. Without it every
        // interrupted sitting is nineteen years thrown away, and nobody would
        // ever finish one.
        const { game, repos, db, cultivatorId } = await standingAtTheCap('derive-banked');

        const first = await game.act(SAYING_IT);
        expect(stagesWrittenSince(repos, MANUAL)).toBe(0);
        expect(first.narration).toMatch(/are in it|not finished/i);

        const daysInIt = (): number => {
            const row = db
                .prepare('SELECT value FROM cultivator_flags WHERE cultivator_id = ? AND key = ?')
                .get(cultivatorId, `derivation_days:${MANUAL}`) as { value: string } | undefined;
            return Number(row?.value ?? 0);
        };

        const banked = daysInIt();
        expect(banked).toBeGreaterThan(0);

        // The second sitting starts from what is already in it rather than from
        // nothing, which is the whole claim.
        await game.act(SAYING_IT);
        const after = daysInIt();
        // Either it banked more, or the stage landed and the bank was cleared.
        expect(after > banked || stagesWrittenSince(repos, MANUAL) === 1).toBe(true);
    }, 120_000);

    it('the ceiling it lifts is the one the ladder actually reads', async () => {
        // The end of the chain, and the only assertion that proves any of it
        // mattered: at the manual's cap the years stop counting, and after the
        // stage is written they count again. `rateTermsFor` composes the
        // ceiling through `effectiveCapOf`, so this is dead unless the row
        // written above is the row that read reaches.
        const { game } = await standingAtTheCap('derive-ceiling');

        const start = game.state().cultivator.cultivationProgress;
        await game.cultivate(600).catch(() => undefined);
        expect(game.state().cultivator.cultivationProgress).toBe(start);

        await writeItToTheEnd(game);

        const before = game.state().cultivator.cultivationProgress;
        await game.cultivate(600).catch(() => undefined);
        expect(game.state().cultivator.cultivationProgress).toBeGreaterThan(before);
    }, 300_000);
});

describe('and a refusal says what would change it', () => {
    it('a leaning reads the book and cannot write it, and is told which', async () => {
        // The whole of the gate: depth on the road, not effort and not rank.
        const { game, repos, cultivatorId } = await standingAtTheCap(
            'derive-leaning', { degree: 3 }
        );
        const before = game.state().run.elapsedDays;

        const result = await game.act(SAYING_IT);

        expect(result.narration).toMatch(/leaning/i);
        expect(result.narration).toMatch(/depth on the road/i);
        // Nothing spent, and nothing written.
        expect(result.state.run.elapsedDays).toBe(before);
        expect(stagesWrittenSince(repos, MANUAL)).toBe(0);
        expect(stagesHeldBy(repos, cultivatorId, MANUAL)).toBe(0);

        const call = engineCalls(result).find(c => c.name === 'engine.writeNextStage');
        expect(call?.ok).toBe(false);
        expect(call?.summary).toMatch(/leaning_only/);
    }, 60_000);

    it('a road that is not the book\'s road is told to bring a different book', async () => {
        const { game, repos } = await standingAtTheCap('derive-wrong-road', { road: 'fire' });

        const result = await game.act(SAYING_IT);

        expect(result.narration).toMatch(/a different book/i);
        expect(stagesWrittenSince(repos, MANUAL)).toBe(0);
        expect(engineCalls(result).find(c => c.name === 'engine.writeNextStage')?.summary)
            .toMatch(/wrong_dao/);
    }, 60_000);

    it('a book that cannot be extended says why, in its own words', async () => {
        // The opt-OUT the catalog carries on three rows. This one describes the
        // last crossing, and the only way to check a reconstruction is to
        // attempt it - which is not a thing anybody gets to do twice.
        const { game, repos } = await standingAtTheCap(
            'derive-not-extendable', { manual: CANNOT_BE_EXTENDED }
        );

        const result = await game.act(SAYING_IT);

        expect(result.narration).toMatch(/crossing/i);
        expect(stagesWrittenSince(repos, CANNOT_BE_EXTENDED)).toBe(0);
        expect(engineCalls(result).find(c => c.name === 'engine.writeNextStage')?.summary)
            .toMatch(/not_extendable/);
    }, 60_000);

    it('the free comparison says the same thing the act does', async () => {
        // `assessAcquisition` never branched on `derived` - the route is a
        // label to it - so the free read answered "Writing what comes next
        // yourself: open." on generic grounds to somebody the gate refuses.
        // Two answers about one act, and the cheap one was wrong. The read now
        // runs `extensionOption`, which is the same check the verb runs.
        const { game } = await standingAtTheCap('derive-read-agrees', { degree: 3 });

        const read = await game.act('how do I get further');
        // The gate's own words, which only reach the read through
        // `extensionOption`. Asserted on the REASON rather than on open/not
        // open: at the manual's cap every route reads as not open, so the
        // headline alone cannot tell a wrong answer from a right one.
        expect(read.narration).toMatch(/enough to read an art of this kind/i);
        expect(engineCalls(read).find(c => c.name === 'encounters.extensionOption')?.summary)
            .toMatch(/leaning_only/);
        // And it costs nothing to find out, which is the whole point of the read.
        expect(read.state.run.elapsedDays).toBe(0);

        const act = await game.act(SAYING_IT);
        expect(engineCalls(act).find(c => c.name === 'engine.writeNextStage')?.ok).toBe(false);
    }, 60_000);

    it('somebody practising nothing is told that, and not told about a road', async () => {
        const harness = await makeGameInWorld({
            seed: 'derive-nothing', worldSeed: 'world-derive-nothing'
        });
        await harness.game.newRun('Shen Qiu');
        harness.db
            .prepare('UPDATE cultivators SET known_techniques = ? WHERE id = ?')
            .run('[]', harness.game.state().cultivator.id);

        const result = await harness.game.act(SAYING_IT);

        expect(result.narration).toMatch(/no book to carry further|nothing to continue/i);
        expect(result.state.run.elapsedDays).toBe(0);
    }, 60_000);
});
