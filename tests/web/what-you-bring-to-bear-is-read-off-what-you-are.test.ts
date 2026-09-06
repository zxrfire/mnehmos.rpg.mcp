/**
 * WHAT THE PERSON IN FRONT OF YOU WEIGHS ABOUT YOU, PLAYED.
 *
 *   "coerce isn't necessarily an action, you could coerce someone too: tell me
 *    or i'll soul search. for info"
 *   "i mean, that's bespoke. your BACKGROUND is leverage. whether ur from a
 *    demonic sect. whether ur way stronger."
 *   "you can ask for anything they can give, obviously"
 *
 * Both sides of an approach used to be closed enums the CALLER declared -
 * `ApproachLeverage` off a word in the sentence, and one constant for what
 * every withheld answer in the game weighed. `background-as-leverage.ts` and
 * `what-an-answer-costs.ts` read both off the two people instead, which is the
 * same inversion `how-they-took-what-you-said.ts` already made for utterances:
 * the hearer decides, not the speaker.
 *
 * ── WHY EVERY ARM HERE IS PLAYED, AND WHY THE WORLD IS PINNED ──────────────
 *
 * Because the unit halves passed for a while before anything typed at the game
 * reached them, which is [a module nothing calls] with one caller instead of
 * none. So each of these types the sentence and reads the resolver's own
 * account of what it was given.
 *
 * Both arms of every comparison run in ONE command against ONE world seed, and
 * they differ in exactly one thing. Two harnesses on the same `worldSeed` are
 * the same several hundred people, so "all else equal" is a fact rather than a
 * hope - see the `makeGameInWorld` banner in `harness.ts`.
 *
 * ADMIN arranges the preconditions and settles nothing: a rung, a house, and a
 * person standing there. Every outcome below came out of the ordinary verbs.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/actions';
import { engineCalls, makeGameInWorld } from './harness';

/** The resolver's own one-line account, which names what was on the table. */
function whatTheAttemptCarried(result: { toolCalls: { name: string; summary: string }[] }): string {
    const call = engineCalls(result).find(row => row.name === 'engine.resolveAttempt');
    expect(call, engineCalls(result).map(row => row.name).join(', ')).toBeDefined();
    return call!.summary;
}

/**
 * A run in a known world with a known person standing in front of it.
 *
 * `ordinal` is the asker's rung and `theirRung` is the other party's. The
 * spawned person is the strongest body present, and `present` orders by rung,
 * so an unaddressed sentence reaches them - every arm below asserts the name it
 * got back rather than trusting that.
 */
async function anAskerAt(options: {
    worldSeed: string;
    ordinal: number;
    theirRung: number;
    theirAlignment?: 'righteous' | 'demonic';
    theirName: string;
    joins?: string;
}) {
    const { game } = await makeGameInWorld({
        seed: 'brought-to-bear', worldSeed: options.worldSeed, adminMode: true
    });
    await game.newRun('Asker');
    await game.act('I look around');
    await game.act(`ADMIN set_realm ordinal=${options.ordinal}`);
    await game.act(
        `ADMIN spawn_encounter ordinal=${options.theirRung} name=${options.theirName}`
        + (options.theirAlignment ? ` alignment=${options.theirAlignment}` : '')
    );
    if (options.joins) await game.act(`ADMIN sect join ${options.joins}`);
    return game;
}

describe('a demand with an act promised behind it', () => {
    beforeEach(() => { process.env.ADMIN_MODE = 'true'; });
    afterEach(() => { delete process.env.ADMIN_MODE; });

    /**
     * The sentence the ruling is about, and the two ways it used to be read
     * wrong. Before the demand read existed it came back as `investigate` at a
     * person called `you` - a LOOK at the addressee, which is neither half of
     * what was said. And with the read below the attack row, the near-synonym
     * "or I will kill you" reached `attack` at `kill`, so the engine went and
     * killed somebody the player had only promised to kill IF REFUSED. Both are
     * demands for information with an act promised behind them.
     */
    it('is a demand for information, whatever act it promises', () => {
        for (const said of [
            "tell me where he is or I'll soul search you",
            'tell me where the elder is or I will kill you',
            "tell me where the elder is or I'll break your core",
            'tell me where he is or else'
        ]) {
            const parsed = parseIntent(said);
            expect(parsed.action, said).toBe('interact');
            expect(parsed.intent, said).toBe('interrogate');
            expect(parsed.topic, said).toMatch(/^where /);
        }

        // And the act itself is still the act. The guard reads the promise, not
        // the verb, so a sentence that does the thing rather than promising it
        // is untouched.
        expect(parseIntent('I kill the elder').action).toBe('attack');
        expect(parseIntent('I attack him from behind').action).toBe('attack');
    });

    /**
     * CONFIRMATION, PLAYED: it reaches the resolver as `force` - the promise
     * priced - and it reaches `askedAbout` for the answer. Not a fight, and not
     * a bare interrogation with nothing on the table.
     */
    it('reaches the resolver as force, and the asking underneath it', async () => {
        const game = await anAskerAt({
            worldSeed: 'a-promise-that-can-be-kept', ordinal: 44,
            theirRung: 20, theirName: 'Wen Shuyi'
        });
        const leaned = await game.act("tell me where he is or I'll soul search you");
        const carried = whatTheAttemptCarried(leaned);

        expect(carried).toContain('Wen Shuyi');
        expect(carried).toContain('what they could do about a refusal');
        // The promise is a TERM and not a label: the soul search is priced off
        // `severityOfTheWrong`, and nothing anywhere knows what a soul search
        // is. See `threatWeight`.
        expect(carried).toMatch(/threat added \d+ points/);

        const ran = engineCalls(leaned).map(row => row.name);
        expect(ran, ran.join(', ')).toContain('engine.askedAbout');
        // It is a demand and not an attack: nothing here resolved a fight.
        for (const name of ran) {
            expect(name, `${name} fought somebody who was being leaned on`)
                .not.toMatch(/melee|combat|fight|strike/i);
        }
    }, 120_000);

    /**
     * THE OTHER ARM, one command later and one rung different: the same words
     * out of somebody two realms below reach the resolver as nothing at all.
     *
     * `how-they-took-what-you-said.ts` settled this for utterances and this
     * reads the same constant - at the gap where a direct confrontation stops
     * being a fight, somebody with nobody behind them is not threatening
     * anybody, and an unkeepable promise falls through to what they have. What
     * they have here is nothing, so the sentence weighs nothing.
     */
    it('weighs nothing at all from somebody who could not make good on it', async () => {
        const game = await anAskerAt({
            worldSeed: 'a-promise-that-can-be-kept', ordinal: 0,
            theirRung: 20, theirName: 'Wen Shuyi'
        });
        const leaned = await game.act("tell me where he is or I'll soul search you");
        const carried = whatTheAttemptCarried(leaned);

        expect(carried).toContain('Wen Shuyi');
        expect(carried).toContain('nothing on the table but the asking');
        // Not a smaller number - absent. An empty threat reaches the resolver
        // as no threat rather than as a cheap one.
        expect(carried).not.toMatch(/threat added/);
    }, 120_000);
});

describe('what is actually behind the asking', () => {
    beforeEach(() => { process.env.ADMIN_MODE = 'true'; });
    afterEach(() => { delete process.env.ADMIN_MODE; });

    /**
     * "whether ur from a demonic sect", played, and the answer is that the two
     * houses are worth different things at the moment of asking.
     *
     * A house is worth two facts and only the first is backing.
     * `whenItIsDoneToOneOfOurs` says a righteous house takes up what is done to
     * one of its own - so it is standing behind the ask, and that is `sect`. A
     * demonic house prices the member instead, so it is standing behind nobody;
     * being one of theirs is still a fact the room knows, and that is `name`.
     * Two on the pressure scale against one.
     *
     * Both arms are the same world, the same person, the same rung and the same
     * sentence. The house is the only difference.
     */
    it('reads a house that answers for its own differently from one that does not', async () => {
        const carriedBy = async (house: string) => {
            const game = await anAskerAt({
                worldSeed: 'two-houses', ordinal: 30, theirRung: 5,
                theirAlignment: 'righteous', theirName: 'Wen Shuyi', joins: house
            });
            return whatTheAttemptCarried(
                await game.act('I question Wen Shuyi about where the elder is')
            );
        };

        const righteous = await carriedBy('Azure Dew Sect');
        const demonic = await carriedBy('Bone Lantern Cult');

        expect(righteous).toContain('a house standing behind them');
        expect(demonic).toContain('their own name');
        expect(demonic).not.toContain('a house standing behind them');
    }, 180_000);
});

describe('what the answer would cost them', () => {
    beforeEach(() => { process.env.ADMIN_MODE = 'true'; });
    afterEach(() => { delete process.env.ADMIN_MODE; });

    /**
     * "you can ask for anything they can give" - so the weight of an ask cannot
     * come off a list either, and `WHAT_A_WITHHELD_ANSWER_WEIGHS` made every
     * withheld answer in the game cost the same. What it costs them is how near
     * the thing asked about stands to them, off `howNearTheyStand`.
     *
     * Same asker, same person asked, same rung, same world, one attempt each so
     * neither carries the other's grudge. Only the subject differs: a stranger's
     * whereabouts against informing on their own house.
     */
    it('weighs informing on their own house heavier than a stranger\'s whereabouts', async () => {
        const askedFor = async (topic: (houseName: string) => string) => {
            const game = await anAskerAt({
                worldSeed: 'two-asks', ordinal: 30, theirRung: 5,
                theirAlignment: 'righteous', theirName: 'Wen Shuyi'
            });
            // The house `spawn_encounter alignment=righteous` chose. Read off
            // the roster rather than typed, because which righteous house it
            // is is the world's business and not this test's.
            const service = game as unknown as {
                present(who: unknown): { name: string; sectName: string | null }[];
                currentRun(): { cultivator: unknown };
            };
            const house = service.present(service.currentRun().cultivator)
                .find(row => row.name === 'Wen Shuyi')?.sectName;
            expect(house, 'the spawned person was placed in no house').toBeTruthy();
            return whatTheAttemptCarried(await game.act(topic(house!)));
        };

        const aStranger = await askedFor(() => 'I question Wen Shuyi about where the elder is');
        const theirOwn = await askedFor(house => `I question Wen Shuyi about the ${house}`);

        const cost = (summary: string) =>
            Number(/the weight of the thing asked for cost (\d+) points/.exec(summary)?.[1] ?? NaN);

        expect(aStranger).toContain('a real favour, which costs them something');
        expect(theirOwn).toContain('something that leaves them worse off');
        expect(cost(theirOwn)).toBeGreaterThan(cost(aStranger));
    }, 180_000);
});
