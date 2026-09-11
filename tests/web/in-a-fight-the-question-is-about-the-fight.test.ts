/**
 * "Can I beat him" was answered with how ready you are to cross a realm.
 *
 * FOUND BY PLAYING BLIND. Mid-fight, with a named opponent on 46 of 60 and the
 * round footer on the screen above saying so:
 *
 *     > what are my chances
 *     Nobody standing over you is standing above you. Whatever comes next is
 *     not in this house, and nobody in it is in a position to tell you what it
 *     is.
 *     0 years at this rung, of the 50 the ladder credits. 50 still counted.
 *     Five separate answers, and they come apart. A cultivator who can attempt
 *     this may not survive it...
 *
 *     > can i beat him
 *     (word for word the same answer)
 *
 * A player in a fight asked whether they could win it and was handed a
 * breakthrough readiness read - a confident answer to a question nobody asked,
 * about a crossing, while somebody was swinging at them.
 *
 * ── THE ROUTING WAS RIGHT ────────────────────────────────────────────────
 *
 * Both sentences reach `assess`, and so do `am i winning`, `who is winning`,
 * `i size him up` and `how strong is he compared to me`. Nothing in the reading
 * tier needed touching, which is why this is not a pattern-table finding.
 *
 * What was wrong is that `assess` with no target had exactly ONE reading - the
 * master reading a student - and that reading is correct standing in a square
 * and absurd standing in a fight. `ASSESSING_THEMSELVES` lists `my chances` and
 * `my odds` by name, and sent them the same way.
 *
 * ── AND THE ANSWER EXISTED THE WHOLE TIME ────────────────────────────────
 *
 * `whereThisFightStands` prints the footer under every round of every fight -
 * both bodies, the rounds left, what breaking off comes to. That is the
 * question, answered, in the engine's own figures. Free, as every read of a
 * live fight is: see `aFightChargesNothingFor`.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/actions.js';
import { makeGameInWorld } from './harness.js';

const WORLD = 'fight-world';

beforeAll(() => {
    process.env.ADMIN_MODE = 'true';
});

interface Said { narration?: string }

interface Playing {
    newRun(n: string): Promise<unknown>;
    act(s: string): Promise<Said>;
    state(): { run: { elapsedDays: number }; cultivator: { hp: number } };
}

const THEM = 'Yun Shizhen';

async function swingingAtSomebody(seed: string): Promise<Playing> {
    const made = await makeGameInWorld({ seed, worldSeed: WORLD }) as unknown as { game: Playing };
    const { game } = made;
    await game.newRun('Lin Yue');
    await game.act('ADMIN set_realm ordinal=14');
    await game.act(`ADMIN spawn_encounter ordinal=12 name=${THEM}`);
    const opened = await game.act(`i attack ${THEM}`);
    expect(opened.narration ?? '', 'the fight opened').toMatch(/You are on \d+ of \d+/);
    return game;
}

describe('asking how a fight is going', () => {
    it('routes to the measuring verb, which it always did', () => {
        expect(parseIntent('what are my chances').action).toBe('assess');
        expect(parseIntent('can i beat him').action).toBe('assess');
        expect(parseIntent('am i winning').action).toBe('assess');
    });

    it('is answered about the fight and not about a crossing', async () => {
        const game = await swingingAtSomebody('reckon-a');
        const said = (await game.act('what are my chances')).narration ?? '';

        // Both bodies and the round budget, which is the question answered.
        expect(said, said).toMatch(/You are on \d+ of \d+; Yun Shizhen is on \d+ of \d+/);
        expect(said, said).toMatch(/rounds? before neither of you can finish it/);
        // The breakthrough read, word for word off the played screen.
        expect(said, said).not.toMatch(/the 50 the ladder credits/);
        expect(said, said).not.toMatch(/Nobody standing over you is standing above you/);
    }, 300_000);

    it('costs no round and no body', async () => {
        const game = await swingingAtSomebody('reckon-b');
        const before = game.state();
        const said = (await game.act('can i beat him')).narration ?? '';
        const after = game.state();

        expect(after.cultivator.hp).toBe(before.cultivator.hp);
        expect(after.run.elapsedDays).toBe(before.run.elapsedDays);
        expect(said, said).toMatch(/Looking costs nothing/i);
    }, 300_000);

    /**
     * AND NAMING THE PERSON IN FRONT OF YOU IS THE SAME QUESTION. Sizing up
     * somebody you are already swinging at is not a request for their
     * biography; the fight is what is being asked about.
     */
    it('reads the fight when the opponent is named', async () => {
        const game = await swingingAtSomebody('reckon-c');
        const said = (await game.act(`i assess ${THEM}`)).narration ?? '';
        expect(said, said).toMatch(/You are on \d+ of \d+; Yun Shizhen is on \d+ of \d+/);
    }, 300_000);
});

describe('and out of a fight it is still the crossing', () => {
    /**
     * The whole of the change is conditioned on a fight being live, and the
     * reading it displaces is the right one everywhere else. Without this, the
     * fix would have taken the readiness read away from the question it was
     * written for.
     */
    it('answers the readiness question standing in a square', async () => {
        const made = await makeGameInWorld({ seed: 'reckon-d', worldSeed: WORLD }) as unknown as {
            game: Playing;
        };
        const { game } = made;
        await game.newRun('Lin Yue');
        await game.act('ADMIN set_realm ordinal=14');

        const said = (await game.act('what are my chances')).narration ?? '';
        expect(said, said).toMatch(/the 50 the ladder credits/);
        expect(said, said).not.toMatch(/rounds? before neither of you can finish it/);
    }, 300_000);
});
