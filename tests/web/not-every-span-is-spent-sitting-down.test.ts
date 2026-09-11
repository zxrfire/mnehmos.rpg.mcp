/**
 * Twenty days of an escort for a house, logged as twenty days of seclusion.
 *
 * FOUND BY PLAYING BLIND. `simulateTimeSkip` is the one clock every verb that
 * spends days goes through - a seclusion, a sect duty, a journey, a day on the
 * herb ground, a hunt - and three of the sentences around it were written for a
 * cultivator sitting in a cave and are a flat lie about anybody else.
 *
 * ── WHAT WAS PLAYED ──────────────────────────────────────────────────────
 *
 *     > I put my name down for A Culling Notice Written From an Old Survey
 *     ...
 *     ENGINE  20 days of seclusion, and nothing came for you.
 *
 * That line is `EngineFacts.headline`, and `turn-engine.ts` writes it into the
 * log as its own engine entry whenever the narration does not already open with
 * it. The prose two functions below it had ALREADY learned this - `travelling`,
 * `sentOut`, `livedWithSomebody`, and a duty opens with *"You went out to it"* -
 * so the file disagreed with itself about what the player had just done.
 *
 * Two more of the same, inside the skip:
 *
 *   `Seclusion broken: somebody has found this place and there is no road out`
 *   - said to somebody fifteen days into an escort. Nothing gated it; the
 *     wording assumed the caller. Now behind `spanIsASitting`, which defaults
 *     to true so a caller that does not say keeps the seclusion voice.
 *
 *   `Found while in seclusion: a spirit-stone cache worth 385 stones` - said on
 *     a road. Its own missed-twin four lines above it was already verb-neutral,
 *     which is how it was spotted.
 *
 * ── AND A FOURTH, WHICH IS A CONTRADICTION RATHER THAN A VOICE ───────────
 *
 *     You came out early. 2 months of the 2 months were spent; the rest was not
 *     yours to spend.
 *
 * `interrupted` is set when the interrupt lands on the stretch's LAST chunk too
 * - the provisions warning does this routinely - so the sentence announced a
 * loss of zero days beside two identical figures. It now needs days to have
 * actually been lost.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';

const WORLD = 'duty-rations';

beforeAll(() => {
    process.env.ADMIN_MODE = 'true';
});

interface Said { narration?: string }
interface Logged { role: string; turn: number; text: string }

async function aDutyTaken(seed: string) {
    const made = await makeGameInWorld({ seed, worldSeed: WORLD }) as unknown as {
        game: {
            newRun(n: string): Promise<unknown>;
            act(s: string): Promise<Said>;
            atHand: { locations: { name: string; kind: string }[] };
            state(): { log: Logged[] };
        };
    };
    const { game } = made;
    await game.newRun('Runner');
    const say = (s: string) => game.act(s);
    await say('ADMIN set_realm ordinal=14');
    await say(`ADMIN move ${game.atHand.locations.find(l => l.kind === 'sect_seat')!.name}`);
    const board = await say('what duties are there');
    const offered = /\n {2}([^:\n]{5,60}): /.exec(board.narration ?? '')?.[1];
    const before = game.state().log.length;
    const taken = offered ? await say(`I put my name down for ${offered}`) : { narration: '' };
    const written = game.state().log.slice(before);
    return { taken, offered, engineLines: written.filter(e => e.role === 'engine').map(e => e.text) };
}

describe('a span spent on its feet', () => {
    it('is not logged as a seclusion', async () => {
        const { engineLines, offered } = await aDutyTaken('feet-a');
        expect(offered).toBeTruthy();
        expect(engineLines.length, JSON.stringify(engineLines)).toBeGreaterThan(0);

        // The headline off the played run, word for word: "20 days of
        // seclusion, and nothing came for you", on the turn that took a
        // twenty-day posting for a house.
        const asSeclusion = engineLines.filter(t => /seclusion/i.test(t));
        expect(asSeclusion, asSeclusion.join('\n')).toHaveLength(0);
    }, 300_000);

    it('says nothing about a cave, a road out, or a place being found', async () => {
        const { taken } = await aDutyTaken('feet-b');
        const said = taken.narration ?? '';
        expect(said, said).not.toMatch(/seclusion broken/i);
        expect(said, said).not.toMatch(/found while in seclusion/i);
    }, 300_000);

    /**
     * AND A SITTING IS STILL A SITTING. The flag defaults to the seclusion
     * voice, so this is what stops the fix above from flattening the verb the
     * wording was written for. `a-broken-seclusion-is-a-fork.test.ts` holds the
     * fork's own sentences.
     */
    it('leaves a seclusion reading as a seclusion', async () => {
        const made = await makeGameInWorld({ seed: 'feet-c', worldSeed: WORLD }) as unknown as {
            game: {
                newRun(n: string): Promise<unknown>;
                act(s: string): Promise<Said>;
                state(): { log: Logged[] };
            };
        };
        const { game } = made;
        await game.newRun('Runner');
        const before = game.state().log.length;
        // "anyway" because a cultivator with no manual is refused the sitting
        // outright, and the refusal is not a time skip at all.
        await game.act('I cultivate for 20 days anyway');
        const engineLines = game.state().log.slice(before)
            .filter(e => e.role === 'engine').map(e => e.text);
        expect(engineLines.some(t => /seclusion/i.test(t)), engineLines.join('\n')).toBe(true);
    }, 300_000);
});

describe('coming out early', () => {
    it('is not said about a stretch that ran in full', async () => {
        // Played: "You came out early. 2 months of the 2 months were spent."
        // Asserted as a shape rather than against one seed, because what is
        // wrong is the two figures being equal, whichever they are.
        const { taken } = await aDutyTaken('feet-d');
        const said = taken.narration ?? '';
        const early = /You came out early\. (.+?) of the (.+?) were spent/.exec(said);
        if (early) expect(early[1], said).not.toBe(early[2]);
    }, 300_000);
});
