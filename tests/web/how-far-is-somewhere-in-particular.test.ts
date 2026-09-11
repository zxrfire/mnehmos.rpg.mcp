/**
 * "How far is Nine Peaks" listed five places, none of them Nine Peaks.
 *
 * FOUND BY PLAYING BLIND, two sentences apart:
 *
 *     > how far is Nine Peaks
 *     You are in Six Li, The Silent Cliffs... Iron Ridge: a market town...
 *     Nine Hundred Paces: site... The Jade Face: site... Willow Village: a
 *     village... There are 2 further names you are carrying that you cannot
 *     place.
 *
 *     > i travel to Nine Peaks
 *     Six Li. Lin Yue took to the road. Travel of 11 days was intended.
 *     ... Lin Yue is in Nine Peaks now.
 *
 * The question named a place. The answer named every other place. And the road
 * was eleven days, which the engine walked one sentence later.
 *
 * ── THE NAME WAS COMPUTED AND THROWN AWAY ────────────────────────────────
 *
 * `HOW_FAR_IS_SOMEWHERE` captures the place - the branch that reads it even
 * says so, *"the first non-empty group is the thing asked after"* - and the
 * line under it returned `{ action: 'destinations' }` with nothing in it. The
 * same slip sat in `asking-is-not-doing.ts`, where "could I ride to Iron Ridge"
 * was rewritten to the map read with the ridge dropped.
 *
 * A value computed and dropped between two functions that call each other, and
 * it is the third of that shape in this sweep.
 *
 * ── AND THE ANSWER HAD TO AGREE WITH THE VERB IT DESCRIBES ───────────────
 *
 * The first cut of the fix answered *"nobody here puts a road to Nine Peaks"*,
 * and travel walked it one sentence later: two verbs, one place, opposite
 * answers - the very shape this sweep exists to find, introduced by the fix for
 * it.
 *
 * `travel` gates on `somewhereReal`, whose third register is *anywhere this
 * cultivator has heard of* - it says outright that *"the player may go where
 * they have been told about"* - while this read is gated on `canPointAt`. A
 * name held without a road is absent from one and reachable by the other, ON
 * PURPOSE. So the read now says the true thing: you have the word and not the
 * way, and setting out is still a sentence you can say. It does not state the
 * DAYS, because that is the knowledge the read is gated on, and handing it over
 * here would make the gate a formality.
 *
 * `resolvePlace` cannot be that test: it accepts any string, because *places in
 * this engine are free text*. It answered yes to "the moon" and to "zzzz".
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/actions.js';
import { makeGameInWorld } from './harness.js';

const WORLD = 'road-world';

beforeAll(() => {
    process.env.ADMIN_MODE = 'true';
});

interface Said { narration?: string }

interface Playing {
    newRun(n: string): Promise<unknown>;
    act(s: string): Promise<Said>;
    state(): { run: { elapsedDays: number } };
}

async function standingSomewhere(seed: string): Promise<Playing> {
    const made = await makeGameInWorld({ seed, worldSeed: WORLD }) as unknown as { game: Playing };
    await made.game.newRun('Lin Yue');
    return made.game;
}

/** A place the general read lists, taken off the read itself. */
async function onePlaceItCanPoint(game: Playing): Promise<string | null> {
    const said = (await game.act('where can i go')).narration ?? '';
    return /\n([A-Z][^:\n]{3,40}): (?:a |site|the )/.exec(said)?.[1] ?? null;
}

describe('asking after one place by name', () => {
    it('carries the name out of the sentence', () => {
        expect(parseIntent('how far is Nine Peaks').target).toBe('Nine Peaks');
        expect(parseIntent('which way is Iron Ridge').target).toBe('Iron Ridge');
        expect(parseIntent('where is the Jade Face').target).toBe('Jade Face');
    });

    /** And a pronoun is still not a place. */
    it('does not take a bare "it" for a destination', () => {
        expect(parseIntent('how far is it').target).toBeUndefined();
    });

    it('answers about that place and not about the other five', async () => {
        const game = await standingSomewhere('far-a');
        const known = await onePlaceItCanPoint(game);
        expect(known, 'the seed can point at somewhere').toBeTruthy();

        const said = (await game.act(`how far is ${known}`)).narration ?? '';
        expect(said, said).toContain(known!);
        // One row, not the whole map: the general read lists several and this
        // one does not.
        const rows = (said.match(/^[^\n]+: (?:a |an |site|the )/gm) ?? []).length;
        expect(rows, said).toBeLessThanOrEqual(1);
    }, 300_000);

    it('costs nothing', async () => {
        const game = await standingSomewhere('far-b');
        const known = await onePlaceItCanPoint(game);
        if (!known) return;
        const before = game.state().run.elapsedDays;
        await game.act(`how far is ${known}`);
        expect(game.state().run.elapsedDays).toBe(before);
    }, 300_000);
});

describe('a name held without a road', () => {
    /**
     * THE HALF THAT MUST NOT CONTRADICT TRAVEL. See the header: `travel` lets a
     * cultivator set out for anywhere they have heard of, deliberately, and the
     * map read is gated tighter. The read may say they do not know the way. It
     * may not say there is no way.
     */
    it('says the way is unknown and never that the road does not exist', async () => {
        // `road-1` is the played seed, pinned: it stands the cultivator in Six
        // Li carrying two names it cannot place, one of which is Nine Peaks.
        // Searched for rather than pinned, a seed that happens to place Nine
        // Peaks would pass this by answering a different question.
        const game = await standingSomewhere('road-1');
        const said = (await game.act('how far is Nine Peaks')).narration ?? '';

        expect(said, said).toMatch(/name Nine Peaks and not the way/i);
        expect(said, said).not.toMatch(/no road|nobody here puts a road/i);
    }, 300_000);

    it('and the road is still walkable, which is why it must not say otherwise', async () => {
        const game = await standingSomewhere('road-1');
        await game.act('how far is Nine Peaks');
        const went = (await game.act('i travel to Nine Peaks')).narration ?? '';
        expect(went, went).toMatch(/took to the road/i);
    }, 300_000);

    /** And a word that is nowhere at all is told apart from a name that is. */
    it('tells a name nobody carries apart from one they do', async () => {
        const game = await standingSomewhere('road-1');
        const said = (await game.act('how far is the moon')).narration ?? '';
        expect(said, said).toMatch(/Nobody here places moon at all/i);
    }, 300_000);
});

describe('and the general read is untouched', () => {
    it('still lists everywhere when nothing was named', async () => {
        const game = await standingSomewhere('far-f');
        const said = (await game.act('where can i go')).narration ?? '';
        const rows = (said.match(/^[^\n]+: (?:a |an |site|the )/gm) ?? []).length;
        expect(rows, said).toBeGreaterThan(1);
        // And what can be seen from up here, which is only offered to the
        // general question.
        expect(said, said).toMatch(/You cannot get above it|from up there|the next ridge/i);
    }, 300_000);
});
