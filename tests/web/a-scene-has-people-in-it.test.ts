/**
 * The people in the square reach phase 3, in a real turn, on a pinned world.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE MEASUREMENT THIS PINS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Taken by playing this world and printing the phase-3 user message verbatim.
 * Three consecutive rounds of a fight, with two other people in the square
 * throughout, and the entire person-content of the prompt was two hit-point
 * pools:
 *
 *     You are on 36 of 40; Kong Liekuan is on 39 of 43.
 *
 * That is a fact about a channel rather than about prose: nothing the narrator
 * was sent had a person in it, so no instruction could have produced one.
 *
 * ── WHY THIS IS PLAYED AND NOT A UNIT TEST ───────────────────────────────
 *
 * `scene-person-readings.test.ts` drives the same module directly and is the
 * better instrument for what the sentences say. What it cannot say is whether
 * anybody ever sees them. AGENTS.md's second tier: *a unit test says what
 * happens when an event happens; a rate test says the event happens at all.*
 * Every defect this channel was written against passed the first tier forever.
 *
 * Both seeds are pinned, because a run seed alone pins a coincidence: the world
 * decides who is standing in the square and at what rung.
 *
 * Nothing here asserts a NAME out of the catalog. Names in this repo are being
 * renamed by whoever owns them, and a test that pins one is measuring their
 * sweep rather than this channel - so the square is read out of the world and
 * whoever is in it is who the turn is about.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld, ScriptedProvider } from './harness';
import { KnowledgeGate } from '../../src/web/knowledge';

const WORLD = 'people-channel-world';
const RUN = 'people-channel';

/** The engine's own signature for "and this is whether they said anything". */
const SAID_OR_DID_NOT = /They answer it out loud\.|They do not say anything/;
const THE_ROOM = /other (people|person) here had no part in it/;

/** Every phase-3 user message the provider was sent since a mark. */
function narrationsSince(provider: ScriptedProvider, from: number): string[] {
    return provider.calls.slice(from)
        .filter(call => !(call.messages.find(m => m.role === 'system')?.content ?? '')
            .startsWith('You are the intent router'))
        .map(call => call.messages.find(m => m.role === 'user')?.content ?? '');
}

async function openARun(provider?: ScriptedProvider) {
    const harness = await makeGameInWorld({ seed: RUN, worldSeed: WORLD, provider });
    const { cultivator } = await harness.game.newRun('Probe');
    const gate = new KnowledgeGate(harness.db);
    // Somebody standing here whose face the player can place, so the channel's
    // own gate is not what is being measured.
    const nameable = harness.game.present(cultivator)
        .filter(row => gate.isAwareOf(cultivator.id, 'cultivator', row.id));
    return { ...harness, cultivator, nameable };
}

describe('a turn that happened to somebody', () => {
    it('hands the narrator the person and not only their hit points', async () => {
        const provider = new ScriptedProvider({
            plans: ['{"action":"attack"}'],
            narrations: ['(scripted)']
        });
        const { game, nameable } = await openARun(provider);
        expect(nameable.length).toBeGreaterThan(0);
        const them = nameable[0].name;

        const mark = provider.calls.length;
        await game.act(`I attack ${them}`);
        const [prompt] = narrationsSince(provider, mark);

        // The hit-point line is what the prompt has always carried.
        expect(prompt).toMatch(/You are on \d+ of \d+/);
        // And this is what it did not.
        expect(prompt).toContain(them);
        expect(prompt).toMatch(SAID_OR_DID_NOT);
    }, 300_000);

    it('reads heavier as the fight wears them down', async () => {
        const provider = new ScriptedProvider({
            plans: ['{"action":"attack"}'],
            narrations: ['(scripted)']
        });
        const { game, nameable } = await openARun(provider);
        const them = nameable[0].name;

        const readings: string[] = [];
        for (let round = 0; round < 3; round++) {
            const mark = provider.calls.length;
            await game.act(round === 0 ? `I attack ${them}` : 'I strike him again');
            for (const prompt of narrationsSince(provider, mark)) {
                const line = prompt.split('\n').find(row => row.startsWith(`- ${them},`));
                if (line) readings.push(line);
            }
        }

        expect(readings.length).toBe(3);
        // A bout that has taken a quarter of somebody is not the bout that has
        // taken a scratch, and the sentence has to move with it.
        expect(new Set(readings).size).toBeGreaterThan(1);
    }, 300_000);

    it('says nothing about anybody on a turn where nothing happened to them', async () => {
        const provider = new ScriptedProvider({
            plans: ['{"action":"look"}'],
            narrations: ['(scripted)']
        });
        const { game } = await openARun(provider);

        const mark = provider.calls.length;
        await game.act('I look around');
        for (const prompt of narrationsSince(provider, mark)) {
            expect(prompt).not.toMatch(SAID_OR_DID_NOT);
            expect(prompt).not.toMatch(THE_ROOM);
        }
    }, 300_000);
});

describe('a gift and a robbery are the same kind of event', () => {
    it('puts a person in the prompt for something GIVEN, in the same shape', async () => {
        // The plan is composed after the square is known, because who is
        // standing here is the world's answer rather than this test's.
        const plans: string[] = [];
        const provider = new ScriptedProvider({ plans, narrations: ['(scripted)'] });
        const { db, game, cultivator, nameable } = await openARun(provider);
        // The poorest person the player can name, so the gift is a serious
        // piece of what they had rather than a rounding error on a full purse.
        const them = [...nameable].sort((a, b) => a.spiritStones - b.spiritStones)[0];
        const gift = Math.max(50, them.spiritStones * 2);
        db.prepare('UPDATE cultivators SET spirit_stones = ? WHERE id = ?')
            .run(gift * 4, cultivator.id);
        // `topic` is WHAT is handed over and `stones` is how many - `handOver`
        // needs both halves, and a gift with no object named is refused.
        plans.push(JSON.stringify({
            action: 'give', target: them.name, topic: 'spirit stones', stones: gift
        }));

        const mark = provider.calls.length;
        await game.act(`I give ${them.name} ${gift} spirit stones`);
        const [prompt] = narrationsSince(provider, mark);

        const line = prompt.split('\n').find(row => row.startsWith(`- ${them.name},`));
        expect(line).toBeDefined();
        // The engine does not grade. What separates this from a theft is the
        // direction, and nothing else.
        expect(line).toMatch(/come to them|is theirs/);
        expect(line).not.toMatch(/has gone|is gone/);
        expect(line).toMatch(SAID_OR_DID_NOT);
    }, 300_000);
});

describe('and both front doors say the same thing', () => {
    it('reaches the deterministic narrator, which has no model behind it', async () => {
        const { game, nameable } = await openARun();
        const them = nameable[0].name;

        const result = await game.act(`I attack ${them}`) as { narration: string };
        expect(result.narration).toMatch(SAID_OR_DID_NOT);
        expect(result.narration).toContain(them);
    }, 300_000);
});
