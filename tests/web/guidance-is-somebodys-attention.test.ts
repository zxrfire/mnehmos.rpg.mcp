/**
 * Guidance is somebody's attention, and until this nobody could give the player any.
 *
 * Ruled by the design owner, and a pillar of the genre: a master standing beside
 * you ignoring you teaches you nothing. `guideFor` was made to read exactly that
 * - an activity of kind `teaching` with the player in `withIds` - and the commit
 * that did it said the honest state afterwards was that the player was guided by
 * nobody, because nothing wrote such an activity for them.
 *
 * WHAT WAS PLAYED BEFORE THIS FILE, on the pinned world below:
 *
 *     "I ask Elder X to guide my cultivation for a month"
 *         -> request/teaching with topic "guide my cultivation for a month",
 *            refused as no art by that name
 *     "I cultivate under Elder X's guidance for a year"
 *         -> a bare year of sitting; the person was thrown away
 *     "I ask Elder X to teach me <art>"
 *         -> the art on the sheet the moment they said yes, no days spent
 *     "I go and listen to the lecture"  -> nothing reached it
 *
 * WHAT THIS FILE PINS
 *
 *   1. Presence is not attention: a master beside the player who is not teaching
 *      them is worth nothing on the rate.
 *   2. A master may say no. Asking one goes through the same roll as asking
 *      anybody, and what makes them likelier to agree is the tie the resolver
 *      already weighs: the odds for the same person rise once they have taken
 *      the player on. A master at their own wall, or turned away at their own
 *      practice, declines before anything is rolled, and says why and when.
 *      This used to pin an unrolled yes; the design owner ruled it out.
 *   3. A yes writes the attention for the span, the rate reads it while the
 *      span runs, and it ends after. The asking spends its own days first.
 *   4. Being taught an art spends the teacher's attention for
 *      `yearsToWriteOutACopy`, and a lesson cut short leaves nothing.
 *   5. Attention divides by the rate's own rule: `rateTermsFor` hands the rate
 *      the teacher's rung and the size of the set, and the rate thins it.
 *   6. Somebody already teaching the room is sat in on without asking, and the
 *      set is put back afterwards.
 *   7. A player standing somewhere else hears nothing, and is told where they are.
 *   8. Giving a talk writes the listeners and puts them back.
 *
 * Preconditions are arranged where playing to them would be the flaky part:
 * what somebody is at is their activity row, which the world writes the same way.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeGameInWorld, type Harness } from './harness';
import { guidanceMultiplier } from '../../src/engine/cultivation/cultivation';
import { writeFlag } from '../../src/server/consolidated/cultivation-support';
import { FLAG_MASTER } from '../../src/web/flag-keys';
import { yearsToWriteOutACopy } from '../../src/engine/world/manuals';
import { whatATalkIsWorthToTheHouse } from '../../src/web/a-teacher-giving-you-their-attention';
import { howCloseTheyStandToTheirWall } from '../../src/web/standing-guard';
import type { Cultivator } from '../../src/schema/cultivation';

const WORLD = 'a-xianxia-run';

const adminBefore = process.env.ADMIN_MODE;
beforeAll(() => { process.env.ADMIN_MODE = 'true'; });
afterAll(() => {
    if (adminBefore === undefined) delete process.env.ADMIN_MODE;
    else process.env.ADMIN_MODE = adminBefore;
});

type Turn = { narration: string; toolCalls: { name: string; summary: string; ok: boolean }[] };

function everythingSaid(turn: Turn): string {
    return [turn.narration, ...turn.toolCalls.map(call => call.summary)].join('\n');
}

interface Terms { guideOrdinal: number | null; guideListeners: number }

/** Every guide term the rate was handed while a turn ran, as the rung it came from. */
function watchTheRate(harness: Harness, all?: Terms[]): (number | null)[] {
    const seen: (number | null)[] = [];
    const game = harness.game as unknown as { rateTermsFor(c: Cultivator): Terms };
    const original = game.rateTermsFor.bind(game);
    game.rateTermsFor = (c: Cultivator) => {
        const terms = original(c);
        seen.push(terms.guideOrdinal);
        all?.push(terms);
        return terms;
    };
    return seen;
}

/** The odds a weighed ask printed, as a fraction. */
function theOddsOf(turn: Turn): number {
    const hit = /\((\d+(?:\.\d+)?)%\)/.exec(everythingSaid(turn));
    expect(hit, `no odds in: ${everythingSaid(turn)}`).not.toBeNull();
    return Number(hit![1]) / 100;
}

/** GIVEN a fresh run standing somewhere, fed, and somebody above them here. */
async function somebodyAboveHere(seed: string) {
    const harness = await makeGameInWorld({ seed, worldSeed: WORLD, adminMode: true });
    await harness.game.newRun('Prober');
    await harness.game.act('I buy a year of provisions');
    // A METHOD TO SIT WITH. A sitting with no method returns nothing and is
    // refused as returning nothing, watched or not - which is right, and is
    // not what this file measures.
    await harness.game.act('I buy the Lesser Qi-Gathering Manual');
    await harness.game.act('I learn Lesser Qi-Gathering Manual');
    expect(harness.game.currentRun().cultivator.knownTechniques.length, 'no method on the sheet').toBeGreaterThan(0);
    const world = (await harness.game.loadWorld())!;
    const me = harness.game.currentRun().cultivator;
    const here = new Set(harness.game.present(me).map(row => row.id));
    const above = world.npcs
        .filter(npc => here.has(npc.id) && npc.status === 'alive'
            && npc.cultivation.realmOrdinal > me.realmOrdinal)
        .sort((a, b) => a.cultivation.realmOrdinal - b.cultivation.realmOrdinal
            || (a.id < b.id ? -1 : 1));
    expect(above.length, 'nobody above the player is standing where the run opened').toBeGreaterThan(0);
    const teacher = above[0];
    const others = world.npcs.filter(npc => here.has(npc.id) && npc.id !== teacher!.id
        && npc.status === 'alive');
    // Put them at something that is not teaching, so the arrangement starts
    // from a master who is here and is not paying attention. And NOT AT THEIR
    // OWN WALL: somebody who has gathered what their next rung asks declines
    // anybody's ask and strikes at it inside the days an ask spends, which is
    // its own test below. Their progress clock is started today.
    const today0 = Math.floor(world.currentDay);
    const at = world.npcs.findIndex(npc => npc.id === teacher!.id);
    world.npcs[at] = {
        ...teacher!,
        cultivation: { ...teacher!.cultivation, accumulatingSinceDay: today0 },
        activity: { kind: 'idle', note: 'looking at nothing', withIds: [], sinceDay: Math.floor(world.currentDay) }
    };
    harness.game.theWorldMoved();
    return { harness, world, me, teacher: world.npcs[at]!, others, above };
}

function theirActivity(world: { npcs: { id: string; activity: unknown }[] }, id: string) {
    return world.npcs.find(npc => npc.id === id)?.activity as
        { kind: string; withIds: string[]; untilDay?: number | null } | null;
}

describe('attention divides, by the rate\'s own rule', () => {
    it('hands the rate the teacher\'s own rung and the size of the set', async () => {
        const { harness, world, me, teacher, others } = await somebodyAboveHere('guided-terms');
        const today = Math.floor(world.currentDay);
        const at = world.npcs.findIndex(npc => npc.id === teacher.id);
        world.npcs[at] = {
            ...world.npcs[at]!,
            activity: {
                kind: 'teaching', note: 'a talk', withIds: [me.id, ...others.slice(0, 3).map(o => o.id)],
                sinceDay: today, untilDay: today + 5
            }
        };
        const terms = harness.game.rateTermsFor(harness.game.currentRun().cultivator) as unknown as Terms;
        expect(terms.guideOrdinal).toBe(teacher.cultivation.realmOrdinal);
        expect(terms.guideListeners).toBe(1 + Math.min(3, others.length));
        if (terms.guideListeners > 1) {
            expect(guidanceMultiplier(me.realmOrdinal, terms.guideOrdinal, terms.guideListeners))
                .toBeLessThan(guidanceMultiplier(me.realmOrdinal, terms.guideOrdinal, 1));
        }
    }, 120_000);
});

describe('a master beside you is not a master watching you', () => {
    it('gives guideOrdinal null while they are not teaching the player', async () => {
        const { harness, teacher, others } = await somebodyAboveHere('guided-presence');
        expect(harness.game.rateTermsFor(harness.game.currentRun().cultivator).guideOrdinal).toBeNull();

        // Teaching somebody ELSE is not attention on the player either.
        if (others.length > 0) {
            const world = (await harness.game.loadWorld())!;
            const at = world.npcs.findIndex(npc => npc.id === teacher.id);
            world.npcs[at] = {
                ...world.npcs[at]!,
                activity: {
                    kind: 'teaching', note: 'correcting somebody', withIds: [others[0]!.id],
                    sinceDay: Math.floor(world.currentDay), untilDay: Math.floor(world.currentDay) + 5
                }
            };
            expect(harness.game.rateTermsFor(harness.game.currentRun().cultivator).guideOrdinal)
                .toBeNull();
        }
    }, 120_000);
});

describe('a master may say no', () => {
    /**
     * MEASURED, AND IT IS NOT "USUALLY AGREES". On this world and seed the odds
     * were 2.0% before the player was taken on and 2.0% after: the tie a
     * granted discipleship leaves is too weak to move an ask a realm or more
     * upward off the resolver's floor. That is the ordinary resolver's answer
     * and no special case was written to change it, so this pins only that a
     * master is asked through the same roll and that being taken on never
     * makes it LESS likely.
     */
    it('is asked through the same roll, and being taken on never makes a yes less likely', async () => {
        const { harness, teacher } = await somebodyAboveHere('guided-master-odds');
        const asked = `could I ask ${teacher.name} to guide my cultivation for 10 days`;
        const asAStranger = theOddsOf(await harness.game.act(asked) as Turn);

        // TAKEN ON BY PLAYING, forced because the landing is a roll: the
        // `discipleship` yes writes `FLAG_MASTER` and the tie the ask leaves.
        const took = await harness.game.act(
            `ADMIN request I beg ${teacher.name} to take me as a disciple`
        ) as Turn;
        expect(everythingSaid(took)).toMatch(/takes you on/);

        const asTheirDisciple = theOddsOf(await harness.game.act(asked) as Turn);
        expect(asTheirDisciple, `stranger ${asAStranger}, disciple ${asTheirDisciple}`)
            .toBeGreaterThanOrEqual(asAStranger);
    }, 180_000);

    it('writes their attention on a yes, reads it over the span, and ends it after', async () => {
        const { harness, me, teacher } = await somebodyAboveHere('guided-master');
        await harness.game.act(`ADMIN request I beg ${teacher.name} to take me as a disciple`);
        const before = harness.game.currentRun().run.elapsedDays;
        const seen = watchTheRate(harness);

        const turn = await harness.game.act(
            'ADMIN request I ask my master to guide my cultivation for 10 days'
        ) as Turn;
        const text = everythingSaid(turn);
        const names = turn.toolCalls.map(call => call.name);

        expect(names, text).toContain('engine.resolveAttempt');
        expect(names, text).toContain('world.theyGiveTheirAttention');
        expect(harness.game.currentRun().run.elapsedDays - before).toBeGreaterThan(10);
        expect(seen.some(g => g !== null && g > me.realmOrdinal), 'the rate never saw anybody guiding').toBe(true);
        expect(text).toMatch(/not at their own practice/);

        const world = (await harness.game.loadWorld())!;
        expect(theirActivity(world, teacher.id)?.withIds ?? []).not.toContain(me.id);
        expect(harness.game.rateTermsFor(harness.game.currentRun().cultivator).guideOrdinal).toBeNull();
    }, 180_000);

    it('declines at their own practice, naming it and when they are free', async () => {
        const { harness, world, teacher } = await somebodyAboveHere('guided-busy');
        await harness.game.act(`ADMIN request I beg ${teacher.name} to take me as a disciple`);
        const today = Math.floor(world.currentDay);
        const at = world.npcs.findIndex(npc => npc.id === teacher.id);
        world.npcs[at] = {
            ...world.npcs[at]!,
            activity: {
                kind: 'their_practice', note: 'behind a closed door, and not to be interrupted',
                withIds: [], sinceDay: today, untilDay: today + 40
            }
        };
        harness.game.theWorldMoved();
        const before = harness.game.currentRun().run.elapsedDays;

        const turn = await harness.game.act('I ask my master to guide my cultivation for 10 days') as Turn;
        const text = everythingSaid(turn);
        expect(text).toMatch(/behind a closed door/);
        expect(text).toMatch(/It ends in 40 days/);
        expect(turn.toolCalls.map(call => call.name)).not.toContain('engine.resolveAttempt');
        expect(harness.game.currentRun().run.elapsedDays).toBe(before);
    }, 180_000);

    it('declines at their own wall, and says so', async () => {
        const { harness, world, me, teacher } = await somebodyAboveHere('guided-wall');
        // THE MASTER IS THE ROW A GRANTED DISCIPLESHIP WRITES, arranged rather
        // than played: playing it spends days, and on this seed the person the
        // world had placed there was gone from the world by the end of them.
        writeFlag(harness.db, me.id, FLAG_MASTER, `${teacher.id}:${teacher.cultivation.realmOrdinal}`);
        const today = Math.floor(world.currentDay);
        // AT THE WALL BY THE WORLD'S OWN ARITHMETIC. Their clocks are arranged
        // and `readyToStrike` is asked whether that is enough, at the thinnest
        // band, so it holds at whatever band the turn runs at.
        const at = world.npcs.findIndex(npc => npc.id === teacher.id);
        const now = howCloseTheyStandToTheirWall(world, world.npcs[at]!, 'thin', today);
        expect(Number.isFinite(now.yearsNeeded), 'their next rung has no price to have gathered').toBe(true);
        world.npcs[at] = {
            ...world.npcs[at]!,
            cultivation: {
                ...world.npcs[at]!.cultivation,
                lastAdvancedOnDay: today - 1,
                accumulatingSinceDay: today - Math.ceil(now.yearsNeeded * 365) - 2
            }
        };
        expect(howCloseTheyStandToTheirWall(world, world.npcs[at]!, 'thin', today).ready,
            'the arrangement did not put them at their wall').toBe(true);
        harness.game.theWorldMoved();
        const before = harness.game.currentRun().run.elapsedDays;

        const turn = await harness.game.act('I ask my master to guide my cultivation for 10 days') as Turn;
        expect(everythingSaid(turn)).toMatch(/at their own wall/);
        expect(turn.toolCalls.map(call => call.name)).not.toContain('engine.resolveAttempt');
        expect(harness.game.currentRun().run.elapsedDays).toBe(before);
    }, 180_000);

    it('refuses with the fact when they do not stand above the player', async () => {
        const { harness, me, teacher } = await somebodyAboveHere('guided-level');
        harness.db.prepare('UPDATE cultivators SET realm_ordinal = ? WHERE id = ?')
            .run(teacher.cultivation.realmOrdinal, me.id);
        const before = harness.game.currentRun().run.elapsedDays;
        const turn = await harness.game.act(`I ask ${teacher.name} to guide my cultivation for 10 days`) as Turn;
        expect(everythingSaid(turn)).toMatch(/there is none to give/);
        expect(everythingSaid(turn)).toMatch(/stands at .* and you at/);
        expect(harness.game.currentRun().run.elapsedDays).toBe(before);
    }, 120_000);
});

describe('a stranger can agree', () => {
    it('through the ordinary request: priced, rolled, and the asking spends its days', async () => {
        const { harness, me, teacher } = await somebodyAboveHere('guided-stranger');
        const before = harness.game.currentRun().run.elapsedDays;
        const seen = watchTheRate(harness);

        // FORCED, because what is measured is what a LANDING does and the
        // landing is a roll. See `coercion-is-not-rapport.test.ts`.
        const turn = await harness.game.act(
            `ADMIN request I ask ${teacher.name} to guide my cultivation for 10 days`
        ) as Turn;
        const names = turn.toolCalls.map(call => call.name);
        const text = everythingSaid(turn);

        expect(names, text).toContain('engine.priceTheAsk');
        expect(names, text).toContain('engine.resolveAttempt');
        expect(turn.toolCalls.find(call => call.name === 'engine.resolveAttempt')?.summary ?? '')
            .toMatch(/they agreed/);
        expect(names).toContain('world.theyGiveTheirAttention');
        // The asking's own days AND the ten under their eye.
        expect(harness.game.currentRun().run.elapsedDays - before).toBeGreaterThan(10);
        expect(seen.some(g => g !== null && g > me.realmOrdinal)).toBe(true);
    }, 180_000);
});

describe('being taught an art is a span with the teacher at your elbow', () => {
    const ART = 'swallow-skimming-step';

    async function aTeacherHoldingIt(seed: string, provisioned: boolean) {
        const harness = await makeGameInWorld({ seed, worldSeed: WORLD, adminMode: true });
        await harness.game.newRun('Prober');
        if (provisioned) await harness.game.act('I buy a year of provisions');
        const world = (await harness.game.loadWorld())!;
        const me = harness.game.currentRun().cultivator;
        const here = new Set(harness.game.present(me).map(row => row.id));
        const teacher = world.npcs
            .filter(npc => here.has(npc.id) && npc.status === 'alive'
                && npc.cultivation.realmOrdinal > me.realmOrdinal)
            .sort((a, b) => a.cultivation.realmOrdinal - b.cultivation.realmOrdinal
                || (a.id < b.id ? -1 : 1))[0];
        expect(teacher, 'nobody above the player here').toBeDefined();
        // THE ART ON THEM is the arrangement: what somebody carries is their
        // world row, and this is that row.
        const at = world.npcs.findIndex(npc => npc.id === teacher!.id);
        world.npcs[at] = {
            ...teacher!,
            cultivation: {
                ...teacher!.cultivation,
                techniqueIds: [...new Set([...teacher!.cultivation.techniqueIds, ART])]
            }
        };
        harness.game.theWorldMoved();
        return { harness, me, teacher: teacher! };
    }

    it('spends yearsToWriteOutACopy under their attention, and the art goes in whole', async () => {
        const { harness, me, teacher } = await aTeacherHoldingIt('taught-in-full', true);
        const before = harness.game.currentRun().run.elapsedDays;
        const seen = watchTheRate(harness);

        const turn = await harness.game.act(
            `ADMIN request I ask ${teacher.name} to teach me Swallow-Skimming Step`
        ) as Turn;
        const text = everythingSaid(turn);
        const lesson = Math.round((yearsToWriteOutACopy(ART) ?? 0) * 365);
        expect(lesson).toBeGreaterThan(1);

        expect(harness.game.currentRun().cultivator.knownTechniques, text).toContain(ART);
        // NOT AN AFTERNOON. The lesson's own days on top of the asking's.
        expect(harness.game.currentRun().run.elapsedDays - before).toBeGreaterThanOrEqual(lesson);
        expect(seen.some(g => g !== null && g > me.realmOrdinal), 'no guidance over the lesson').toBe(true);
    }, 180_000);

    it('leaves nothing when the lesson is cut short', async () => {
        // No provisions: the span hands control back when the food runs out,
        // which is what `teaching-somebody-what-you-hold` measured from the
        // other side at 50 days of 60.
        const { harness, teacher } = await aTeacherHoldingIt('taught-cut-short', false);
        const turn = await harness.game.act(
            `ADMIN request I ask ${teacher.name} to teach me Swallow-Skimming Step`
        ) as Turn;
        const text = everythingSaid(turn);
        expect(text, 'the lesson was not cut short, so this measures nothing').toMatch(/stopped before/);
        expect(harness.game.currentRun().cultivator.knownTechniques).not.toContain(ART);
        expect(text.toLowerCase()).toContain('whole or not at all');
    }, 180_000);
});

describe('somebody already teaching the room', () => {
    it('is sat in on without asking, for less than a sole student gets, and the set is put back', async () => {
        const { harness, world, me, teacher, others } = await somebodyAboveHere('sat-in');
        expect(others.length, 'nobody else here to be in front of the teacher').toBeGreaterThan(0);
        const today = Math.floor(world.currentDay);
        const at = world.npcs.findIndex(npc => npc.id === teacher.id);
        world.npcs[at] = {
            ...world.npcs[at]!,
            activity: {
                kind: 'teaching', note: 'giving a talk on the breath', withIds: [others[0]!.id],
                sinceDay: today, untilDay: today + 3
            }
        };
        harness.game.theWorldMoved();
        const terms: Terms[] = [];
        watchTheRate(harness, terms);

        const turn = await harness.game.act(`I sit in on ${teacher.name}'s talk`) as Turn;
        const names = turn.toolCalls.map(call => call.name);
        const text = everythingSaid(turn);

        expect(names, text).toContain('world.theyGiveTheirAttention');
        expect(names).not.toContain('engine.resolveAttempt');
        const guided = terms.filter(t => t.guideOrdinal !== null);
        expect(guided.length, text).toBeGreaterThan(0);
        // Two in front of them, so less than the player alone would get.
        expect(guided[0]!.guideListeners).toBe(2);
        expect(guidanceMultiplier(me.realmOrdinal, guided[0]!.guideOrdinal, 2))
            .toBeLessThan(guidanceMultiplier(me.realmOrdinal, teacher.cultivation.realmOrdinal, 1));

        const after = (await harness.game.loadWorld())!;
        expect(theirActivity(after, teacher.id)?.withIds).toEqual([others[0]!.id]);
    }, 180_000);

    it('is not heard by somebody standing somewhere else, who is told where they are', async () => {
        const { harness, world, me, teacher } = await somebodyAboveHere('outside');
        const today = Math.floor(world.currentDay);
        const at = world.npcs.findIndex(npc => npc.id === teacher.id);
        world.npcs[at] = {
            ...world.npcs[at]!,
            activity: { kind: 'teaching', note: 'a talk', withIds: [], sinceDay: today, untilDay: today + 3 }
        };
        harness.game.theWorldMoved();
        // Somewhere with a name the world holds and the teacher is not in.
        const elsewhere = world.locations.find(row => row.kind === 'settlement'
            && row.id !== teacher.locationId
            && !world.npcs.some(npc => npc.locationId === row.id && npc.activity?.kind === 'teaching'));
        expect(elsewhere).toBeDefined();
        harness.repos.cultivators.update(me.id, { location: elsewhere!.name });
        const before = harness.game.currentRun().run.elapsedDays;

        const turn = await harness.game.act('I go and listen to the lecture') as Turn;
        expect(everythingSaid(turn)).toMatch(/You are at /);
        expect(everythingSaid(turn)).toMatch(/nobody standing here is at the front of anything/);
        expect(harness.game.currentRun().run.elapsedDays).toBe(before);
    }, 120_000);
});

describe('giving a talk', () => {
    it('puts the room in front of the speaker for the days, and back afterwards', async () => {
        const harness = await makeGameInWorld({ seed: 'a-talk', worldSeed: WORLD, adminMode: true });
        await harness.game.newRun('Prober');
        await harness.game.act('I buy a year of provisions');
        await harness.game.act('ADMIN set_realm ordinal=20');
        const world = (await harness.game.loadWorld())!;
        const me = harness.game.currentRun().cultivator;
        const here = new Set(harness.game.present(me).map(row => row.id));
        const below = world.npcs.filter(npc => here.has(npc.id) && npc.status === 'alive'
            && npc.cultivation.realmOrdinal < me.realmOrdinal);
        expect(below.length, 'nobody below the speaker here').toBeGreaterThan(0);
        const wasAt = new Map(below.map(npc => [npc.id, JSON.stringify(npc.activity)]));
        const before = harness.game.currentRun().run.elapsedDays;

        const turn = await harness.game.act('I give a dao lecture for 2 days') as Turn;
        const text = everythingSaid(turn);
        expect(turn.toolCalls.map(call => call.name), text).toContain('world.theyGiveTheirAttention');
        expect(harness.game.currentRun().run.elapsedDays - before).toBeGreaterThan(0);

        const after = (await harness.game.loadWorld())!;
        for (const npc of after.npcs.filter(row => wasAt.has(row.id))) {
            const doing = npc.activity as { kind: string; withIds: string[] } | null;
            if (doing?.kind === 'teaching' && doing.withIds.includes(me.id)) {
                throw new Error(`${npc.name} was left listening to a talk that is over`);
            }
        }
    }, 180_000);

    it('is worth a duty to the house for one listener over a duty\'s days, and saturates', () => {
        const oneDuty = whatATalkIsWorthToTheHouse(0, 20, 1, 1);
        expect(oneDuty).toBe(8);
        expect(whatATalkIsWorthToTheHouse(10, 1, 0, 30)).toBe(0);
        const small = whatATalkIsWorthToTheHouse(10, 1, 5, 5);
        const large = whatATalkIsWorthToTheHouse(10, 1, 40, 40);
        expect(large).toBeGreaterThan(small);
        expect(large).toBeLessThan(small * 8);
    });
});
