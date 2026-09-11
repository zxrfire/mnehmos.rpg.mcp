/**
 * Turn 0 used to describe the square and call it quiet while three things were
 * live in it.
 *
 * MEASURED, on a played run before this. The opening read:
 *
 *     Clear River Ford. You were raised on ground like this.
 *     Gu Lanlin is here, looking at what is on a counter and not buying.
 *     Nothing is happening. Nothing happens here.
 *
 * At that moment the engine held, and returned on the next two turns from the
 * same world and seed: an intake at that square in 26 days at a bar the player
 * failed, a second in 35, no method so nothing accumulated however long they
 * sat, and a copy of the book that closes that on a stall for 8 stones against
 * a purse of 30. Every part was computed. None of it was said, because the
 * opening called `factsForLook` and nothing else, and the only reader that
 * assembled any of it - `whatIsWorthDoingStandingHere` - is reached by typing
 * "what can I do here".
 *
 * What these pin is the CLAIM, not the wording: a dated door is stated with its
 * day and its bar, the gate that stops everything is stated, and the
 * nothing-is-happening line does not stand above them. `QUIET_DAY` is imported
 * rather than quoted so a rewrite of those five sentences does not silently
 * stop testing anything.
 *
 * Played, and the world is pinned: a played test that pins a seed to an outcome
 * without pinning the world is pinning a coincidence.
 */

import { makeGameInWorld, ScriptedProvider } from './harness';
import { QUIET_DAY } from '../../src/web/facts';
import { THE_NARRATION_WAS_DISCARDED } from '../../src/web/narrator';

/** Everything turn 0 put on the screen, in order. */
function openingOf(db: { prepare: (sql: string) => { all: (...a: unknown[]) => unknown[] } }, runId: string): string {
    const rows = db
        .prepare('SELECT text FROM web_play_log WHERE run_id = ? ORDER BY id')
        .all(runId) as { text: string }[];
    return rows.map(row => row.text).join('\n\n');
}

/** A dated door, however the paper happens to word the rest of it. */
const A_DATED_DOOR = /holding an intake at .+ in \d+ days?, and will hear /;

describe('the opening leads with what is live for this player', () => {
    for (const worldSeed of ['world-open-1', 'world-open-2']) {
        it(`states the dated door and the gate, in ${worldSeed}`, async () => {
            const { game, db } = await makeGameInWorld({ seed: 'opening', worldSeed });
            const { run } = await game.newRun('Prober');
            const opening = openingOf(db as never, run.id);

            expect(opening, 'a door with a date on it is not in the opening')
                .toMatch(A_DATED_DOOR);
            // The bar, against where this body stands. Both rungs by name; an
            // ordinal gap is not something anybody perceives.
            expect(opening, 'the opening does not say where this body stands against the bar')
                .toMatch(/The bar on the soonest of them is .+\. You stand at /);
            expect(opening, 'the gate that stops everything is not in the opening')
                .toContain('nothing accumulates however long you sit');
        });

        it(`does not call the ground quiet while a door is dated, in ${worldSeed}`, async () => {
            const { game, db } = await makeGameInWorld({ seed: 'opening', worldSeed });
            const { run } = await game.newRun('Prober');
            const opening = openingOf(db as never, run.id);

            expect(opening).toMatch(A_DATED_DOOR);
            for (const quiet of QUIET_DAY) {
                expect(opening, `the opening says "${quiet}" over a dated door`)
                    .not.toContain(quiet);
            }
        });
    }

    /**
     * AND THE FIRST DELIBERATE ACTION IS NOT THE TEXT THEY HAVE JUST READ.
     *
     * FOUND BY PLAYING. `i look around` on turn one came back with the whole of
     * turn 0 word for word and then carried on, because the opening and the
     * look verb compose the same read and nothing between them knew the opening
     * had happened. `FLAG_LIVE_SITUATION_SAID` is what knows now, stamped with
     * the ground and the day so that walking or waiting restates the situation
     * and looking twice in one place on one day does not.
     */
    it('does not hand a look back the opening it has just printed', async () => {
        const { game, db } = await makeGameInWorld({ seed: 'opening', worldSeed: 'world-open-1' });
        const { run } = await game.newRun('Looker');
        const opening = openingOf(db as never, run.id);
        expect(opening).toMatch(A_DATED_DOOR);

        const looked = (await game.act('I look around')).narration ?? '';
        expect(looked, 'the look reprints a door the opening already stated')
            .not.toMatch(A_DATED_DOOR);
        expect(looked, 'the look reprints the gate the opening already stated')
            .not.toContain('nothing accumulates however long you sit');
    });

    /**
     * AND FILING AN OUTCOME FOR THE OPENING DOES NOT THROW THE OPENING AWAY.
     *
     * MEASURED, with gemma narrating. The colours hook files an outcome on the
     * turn-0 narrate call so the output-side audit can catch a name the player
     * does not hold being written at them - and `auditNarration` returns early
     * on a null `filed`, so before that turn 0 was audited not at all. Filed
     * without `standsAt`, the breakthrough guard had no exemption for a
     * faithful rank read, and the opening
     *
     *     You have reached the first rung of Qi Condensation, but you hold no
     *     manual.
     *
     * - true in both halves - was discarded as an invented advancement, on the
     * most-read screen in the game. Saying where somebody stands is not
     * claiming they moved.
     */
    it('does not discard an opening that says where this cultivator stands', async () => {
        const provider = new ScriptedProvider({
            narrations: [
                'You have reached the first rung of Qi Condensation, and you hold no manual. '
                + 'The wall carries paper and the stall carries books.'
            ]
        });
        const { game, db } = await makeGameInWorld({
            seed: 'opening', worldSeed: 'world-open-1', provider
        });
        const { run } = await game.newRun('Narrated');
        const opening = openingOf(db as never, run.id);

        expect(opening, 'a faithful rank read was taken for a breakthrough')
            .not.toContain(THE_NARRATION_WAS_DISCARDED);
        expect(opening).toContain('the first rung of Qi Condensation');
    });
});
