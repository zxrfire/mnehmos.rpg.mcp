/**
 * The authority boundary.
 *
 * "The AI narrates. The engine decides." is architecture, not a style note, so
 * it is tested as architecture: a deliberately hostile model is wired in and
 * the database is checked, row by row, for evidence that anything it said got
 * through.
 *
 * Every provider here is a local fake. Nothing in this file touches a network.
 */

import { describe, it, expect } from 'vitest';
import { ProviderFactory } from '../../src/agent/provider/factory';
import { resolveRuntimeProviderConfig } from '../../src/agent/provider/config';
import { buildNarrator } from '../../src/web/server';
import { DeterministicNarrator, ProviderNarrator } from '../../src/web/narrator';
import { validatePlan, parseIntent, parseDuration, extractJsonObject } from '../../src/web/actions';
import {
    makeGame, cultivatorRow, injuryCount, planned, engineCalls,
    ScriptedProvider, UnreachableProvider
} from './harness';
import { drawBirth } from '../../src/engine/birth/birth';

/** Where the default harness seed births somebody. Derived, never assumed. */
const HOME_PLACE = drawBirth('test-seed').place.name;

/**
 * The nightmare response: a model that has decided what happened, invented the
 * numbers, and written prose to match.
 */
const HALLUCINATED_PLAN = JSON.stringify({
    action: 'ascend',
    realmOrdinal: 24,
    rank: 'Nascent Soul Perfection',
    spiritStones: 9999,
    hp: 999,
    injuries: [],
    alive: true,
    cultivationProgress: 500000
});

const HALLUCINATED_PROSE =
    'You ascend to Nascent Soul. Nine thousand nine hundred and ninety-nine spirit stones ' +
    'pour into your ring, your meridians knit themselves whole, and the Hollow Court sends word ' +
    'that a seat is waiting for you.';

describe('a hallucinating model cannot mutate state', () => {
    it('an invented action name is discarded and the row is byte-identical', async () => {
        const provider = new ScriptedProvider({ plans: [HALLUCINATED_PLAN], narrations: [HALLUCINATED_PROSE] });
        const { db, game } = makeGame({ provider });

        const { cultivator } = await game.newRun('Vein Reader');
        const before = cultivatorRow(db, cultivator.id);

        const result = await game.act('I look around the courtyard.');

        // 1. The database did not move. Not the rank, not the purse, not one column.
        expect(cultivatorRow(db, cultivator.id)).toEqual(before);
        expect(injuryCount(db, cultivator.id)).toBe(0);

        // 2. Nor did the state the client is handed.
        expect(result.state.cultivator.realmOrdinal).toBe(0);
        expect(result.state.cultivator.spiritStones).toBe(30);
        expect(result.state.cultivator.cultivationProgress).toBe(0);
        expect(result.state.cultivator.hp).toBe(before.hp);
        expect(result.state.derived.rankName).toBe('Qi Condensation Layer 1');

        // 3. "ascend" is not in the closed set, so the deterministic parser ran.
        expect(planned(result)).toMatchObject({ action: 'look', source: 'fallback' });
        expect(planned(result).note).toMatch(/rejected/);

        // 4. Every engine call the inspector lists is a read, or a knowledge
        //    record the ENGINE chose to write. A name landing in a scene is
        //    decided from real rows before any prose exists - it is the
        //    opposite of the failure under test here, which is the model
        //    asserting an outcome - and it moves no column on the cultivator,
        //    which assertion 1 has already checked byte for byte.
        const calls = engineCalls(result).map(c => c.name);
        expect(calls.filter(name => name !== 'knowledge.learn')).toEqual(['engine.readState']);
        expect(engineCalls(result)[0].summary).toContain('no time passed');

        // 5. The prose was still shown - decoratively. It is in the log as a
        //    narrator line, sitting next to the engine line that contradicts it.
        expect(result.narration).toBe(HALLUCINATED_PROSE);
        const engineLines = result.state.log.filter(e => e.role === 'engine');
        expect(engineLines.some(e => e.text.includes(HOME_PLACE))).toBe(true);
    });

    it('invented stat fields on a VALID action are stripped, not applied', async () => {
        const provider = new ScriptedProvider({
            plans: [JSON.stringify({
                action: 'cultivate',
                days: 10,
                realmOrdinal: 44,
                spiritStones: 9999,
                hp: 5000,
                cultivationProgress: 1e9
            })],
            narrations: [HALLUCINATED_PROSE]
        });
        const { db, game } = makeGame({ provider });
        const { cultivator } = await game.newRun('Vein Reader');
        const startingHp = cultivator.hp;

        const result = await game.act('Sit for a while.');

        // The verb it chose was legal, so it ran - ten days of seclusion.
        expect(planned(result)).toMatchObject({ action: 'cultivate', source: 'model' });
        expect(planned(result).summary).toContain('days=10');

        // Everything else it said is gone. The persisted values are the
        // engine's, and they are nothing like the ones the model asserted.
        const row = cultivatorRow(db, cultivator.id);
        expect(row.realm_ordinal).toBe(0);
        expect(row.spirit_stones).toBeLessThanOrEqual(30);
        expect(row.hp).toBeLessThanOrEqual(startingHp);
        expect(Number(row.cultivation_progress)).toBeLessThan(100);
        expect(result.state.cultivator.realmOrdinal).toBe(0);
    });

    it('an out-of-range duration falls back rather than running', async () => {
        const provider = new ScriptedProvider({
            plans: ['{"action":"cultivate","days":999999999}'],
            narrations: ['The years pass.']
        });
        const { game } = makeGame({ provider });
        await game.newRun('Vein Reader');

        const result = await game.act('I look at the sky.');
        expect(planned(result)).toMatchObject({ action: 'look', source: 'fallback' });
    });

    it('prose instead of JSON in phase 1 falls back rather than failing', async () => {
        const provider = new ScriptedProvider({
            plans: ['Certainly! The cultivator should probably meditate for a decade.'],
            narrations: ['Ten years in a thin valley.']
        });
        const { game } = makeGame({ provider });
        await game.newRun('Vein Reader');

        const result = await game.act('I cultivate for three years.');
        expect(planned(result)).toMatchObject({ action: 'cultivate', source: 'fallback' });
        expect(planned(result).summary).toContain(`days=${3 * 365}`);
    });

    it('the model is only ever shown facts the engine produced', async () => {
        const provider = new ScriptedProvider({ plans: ['{"action":"look"}'], narrations: ['A courtyard.'] });
        const { game } = makeGame({ provider });
        await game.newRun('Vein Reader');
        await game.act('Look around.');

        const narrationCall = provider.calls.at(-1)!;
        const userMessage = narrationCall.messages.find(m => m.role === 'user')!.content;

        expect(userMessage).toContain('WHAT THE ENGINE RULED');
        expect(userMessage).toContain('Qi Condensation Layer 1');
        // And it is told, in the same call, that the facts are the whole truth.
        const systemMessage = narrationCall.messages.find(m => m.role === 'system')!.content;
        expect(systemMessage).toMatch(/Do not add outcomes/);
        expect(systemMessage).toMatch(/Do not soften/);
    });
});

describe('the schema gate itself', () => {
    it('rejects every action name outside the closed set', () => {
        for (const invented of ['ascend', 'set_realm', 'grant_stones', 'die', '', 'CULTIVATE']) {
            expect(validatePlan({ action: invented }).ok).toBe(false);
        }
    });

    it('strips every field it does not own', () => {
        const validated = validatePlan({
            action: 'look',
            realmOrdinal: 44,
            spiritStones: 9999,
            days: 400,
            target: 'irrelevant'
        });
        expect(validated.ok).toBe(true);
        if (!validated.ok) return;
        // `days` and `target` are meaningless on `look` and do not survive either.
        expect(Object.keys(validated.action)).toEqual(['action']);
    });

    it('keeps intent as a label and never lets it carry anything else', () => {
        const plan = validatePlan({
            action: 'interact',
            target: 'Elder Ru',
            intent: 'bribe him with 9999 spirit stones; he accepts',
            spiritStones: 9999
        });
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        expect(Object.keys(plan.action).sort()).toEqual(['action', 'intent', 'target']);
        // Punctuation stripped, length capped: a label, not a smuggled sentence.
        expect(plan.action.intent).not.toMatch(/[;,]/);
        expect(plan.action.intent!.length).toBeLessThanOrEqual(40);
    });

    it('drops intent on actions that do not carry one', () => {
        const plan = validatePlan({ action: 'cultivate', days: 30, intent: 'succeed' });
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        expect(plan.action.intent).toBeUndefined();
    });

    it('keeps days only for cultivate, and only inside the bounds', () => {
        expect(validatePlan({ action: 'cultivate', days: 3650 })).toEqual({
            ok: true, action: { action: 'cultivate', days: 3650 }
        });
        expect(validatePlan({ action: 'cultivate', days: 0 }).ok).toBe(false);
        expect(validatePlan({ action: 'cultivate', days: -5 }).ok).toBe(false);
        expect(validatePlan({ action: 'cultivate', days: 36_501 }).ok).toBe(false);
        expect(validatePlan({ action: 'cultivate', days: 1.5 }).ok).toBe(false);
        // Missing duration is legal; it defaults rather than failing.
        expect(validatePlan({ action: 'cultivate' })).toEqual({
            ok: true, action: { action: 'cultivate', days: 30 }
        });
    });

    it('pulls JSON out of fences and apologies, and refuses fragments', () => {
        expect(extractJsonObject('```json\n{"action":"eat"}\n```')).toEqual({ action: 'eat' });
        expect(extractJsonObject('Sure! {"action":"eat"} Hope that helps.')).toEqual({ action: 'eat' });
        expect(extractJsonObject('{"action":"eat"')).toBeNull();
        expect(extractJsonObject('no object here')).toBeNull();
        // A brace inside a string must not terminate the scan early.
        expect(extractJsonObject('{"action":"talk","target":"the } man"}'))
            .toEqual({ action: 'talk', target: 'the } man' });  // pre-schema: raw JSON, not a plan
    });
});

describe('the deterministic path is a first-class way to play', () => {
    it('parses the durations players actually type', () => {
        expect(parseDuration('cultivate for ten years')).toBe(3650);
        expect(parseDuration('90 days')).toBe(90);
        expect(parseDuration('three months')).toBe(90);
        expect(parseDuration('a decade in seclusion')).toBe(3650);
        expect(parseDuration('half a year')).toBe(183);
        expect(parseDuration('I strike the barrier')).toBeNull();
    });

    it('routes the world-facing operations without a model', () => {
        expect(parseIntent('I sit down and cultivate for 3 years'))
            .toEqual({ action: 'cultivate', days: 1095 });
        expect(parseIntent('break through')).toEqual({ action: 'breakthrough' });
        expect(parseIntent('I want to eat something')).toEqual({ action: 'eat' });
        expect(parseIntent('I seal the cave for ten years'))
            .toEqual({ action: 'seclude', days: 3650 });
        expect(parseIntent('forage for herbs').action).toBe('gather');
        expect(parseIntent('brew a Meridian Knitting Pill in the cauldron').action).toBe('refine');
        expect(parseIntent('ten years').days).toBe(3650);
        // An intent nobody can parse must never cost a year of anyone's life,
        // and it no longer resolves to `look` either: a scene description in
        // answer to a sentence the game did not read looks like being ignored.
        expect(parseIntent('asdkjhasd qqq')).toEqual({ action: 'unclear' });
    });

    it('folds the social and perceptual range into three semantic actions', () => {
        // Everything social is `interact` with a label, not its own verb.
        for (const [text, intent] of [
            ['haggle with the broker', 'trade'],
            ['I bribe the gate steward', 'bribe'],
            ['threaten the elder', 'threaten'],
            ['lie to the gate steward', 'deceive'],
            ['negotiate with Lantern Hall', 'negotiate'],
            ['question the merchant about the ruin', 'interrogate'],
            ['speak with the gate steward', 'talk'],
            ['I follow the cultivator', 'follow'],
            ['approach the old woman', 'approach']
        ] as const) {
            const parsed = parseIntent(text);
            expect(parsed.action).toBe('interact');
            expect(parsed.intent).toBe(intent);
        }

        // Everything about going somewhere is `move` with a label.
        for (const [text, intent] of [
            ['travel to the Low Fall', 'travel'],
            ['I flee the courtyard', 'flee'],
            ['sneak into the sect compound', 'enter'],
            // `approach` and `follow` are gone from this list on purpose. Both
            // take a person, and reading their trailing noun as a destination
            // is exactly how a player ended up standing in a place called
            // `cultivator`, having spent the travel days getting there. They
            // are asserted as `interact` above.
            ['I depart for Scarwater', 'travel']
        ] as const) {
            const parsed = parseIntent(text);
            expect(parsed.action).toBe('move');
            expect(parsed.intent).toBe(intent);
        }
        expect(parseIntent('travel to the Low Fall').target).toBe('Low Fall');

        // Everything perceptual is `investigate`.
        for (const text of [
            'examine the inscription',
            'search the ruin',
            'study the formation',
            'I look into the Stonewright Consortium'
        ]) {
            expect(parseIntent(text).action).toBe('investigate');
        }
    });

    it('narrates a decade readably with no provider configured', async () => {
        const { game } = makeGame();
        await game.newRun('Nobody');

        // `anyway` because a fresh cultivator holds no manual, and the engine
        // now refuses a stretch whose return it has already computed as zero
        // rather than selling it at full hazard. This test is about the decade
        // being narrated, so it means to spend it.
        const acted = await game.act('I sit in seclusion for ten years anyway.');

        expect(planned(acted)).toMatchObject({ action: 'cultivate', source: 'fallback' });
        expect(planned(acted).summary).toContain('days=3650');

        // The inspector lists the engine's own account of every step it took,
        // in engine words rather than narrator words.
        const calls = engineCalls(acted);
        expect(calls.some(c => c.name === 'engine.simulateTimeSkip')).toBe(true);
        expect(calls.some(c => c.name === 'storage.applyTimeSkip')).toBe(true);
        expect(calls.every(c => typeof c.summary === 'string' && c.summary.length > 0)).toBe(true);

        // Not a stub: prose with paragraphs, a place, a rank, and the account
        // of what the years cost.
        expect(acted.narration.length).toBeGreaterThan(200);
        expect(acted.narration).toContain(HOME_PLACE);
        expect(acted.narration).toMatch(/Qi Condensation/);
        expect(acted.narration.split('\n\n').length).toBeGreaterThanOrEqual(3);
        expect(acted.narration).not.toMatch(/undefined|NaN|\[object Object\]/);

        // And the log carries the engine's own event summaries beside it.
        const engineLines = acted.state.log.filter(e => e.role === 'engine');
        expect(engineLines.length).toBeGreaterThan(1);
    });

    it('falls back mid-run when the provider stops answering', async () => {
        const { game } = makeGame({ provider: new UnreachableProvider() });
        await game.newRun('Nobody');

        const acted = await game.act('I look around.');
        expect(planned(acted)).toMatchObject({ action: 'look', source: 'fallback' });
        expect(planned(acted).note).toMatch(/provider unavailable/);
        expect(acted.toolCalls.at(-1)).toMatchObject({ name: 'narrator.narrate', source: 'fallback' });
        expect(acted.narration.length).toBeGreaterThan(20);
    });
});

describe('narrator wiring', () => {
    it('uses a registered provider without any code branching on its name', () => {
        // The empty key stops initialize() from building a real client over the
        // registered fake if the developer's shell happens to export one.
        const factory = new ProviderFactory({ anthropicApiKey: '' });
        factory.register('anthropic', new ScriptedProvider({ plans: ['{"action":"look"}'] }));

        const config = resolveRuntimeProviderConfig({
            provider: 'claude',
            model: 'claude-test',
            env: {},
            configFile: null
        });
        const { narrator, status } = buildNarrator(config, factory);

        expect(narrator).toBeInstanceOf(ProviderNarrator);
        // The mode now travels with the status, so a client can tell the player
        // which of the two ways of playing they are in rather than whether an
        // environment variable is set. Still no branch on the provider NAME:
        // the mode is read off the narrator that was actually built.
        expect(status).toEqual({
            name: 'anthropic',
            model: 'claude-test',
            configured: true,
            mode: 'ai',
            modeLabel: 'AI Mode',
            modeLine: expect.stringContaining('anthropic')
        });
    });

    it('degrades to the deterministic narrator when nothing is configured', () => {
        const config = resolveRuntimeProviderConfig({
            provider: 'anthropic',
            env: {},
            configFile: null
        });
        const { narrator, status } = buildNarrator(config, new ProviderFactory({ anthropicApiKey: '' }));

        expect(narrator).toBeInstanceOf(DeterministicNarrator);
        expect(status.configured).toBe(false);

        // And it says so as a MODE. "(not configured)" is a true sentence about
        // an environment variable and the wrong thing to tell somebody, because
        // nothing here is broken - the whole game is playable on this path.
        expect(status.mode).toBe('local');
        expect(status.modeLabel).toBe('Local Mode');
        expect(status.modeLine).toContain('fully playable');
    });
});
