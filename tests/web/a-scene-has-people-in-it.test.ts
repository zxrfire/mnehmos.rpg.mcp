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
 * A completed lesser-action clock does not turn an immediate gift into a
 * years-long digest. The census transferred the stones and wrote the favor,
 * but the later three-hour reply span suppressed the recipient's scene reading.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld, ScriptedProvider } from './harness';
import { KnowledgeGate } from '../../src/web/knowledge';
import { HELPLESS_REALM_GAP } from '../../src/engine/cultivation/combat';
import { realmIndexOf } from '../../src/engine/cultivation/realms';
import { standWhereThePeopleAre } from './standing-where-the-people-are';
import { actualSpiritStones } from '../../src/web/transferring-actual-spirit-stones';

// A real gift transferred its stones, but its eighth-day charge suppressed the
// recipient's reaction as if the player had only returned after a long sitting.
// The immediate scene and the later clock must both survive the played turn.

const WORLD = 'people-channel-world';
const RUN = 'people-channel';

/**
 * The engine's own signature for "and this is whether they said anything".
 *
 * Was `/They answer, out loud\.|They say nothing/`. The modality went with the
 * headcount ruling - *out loud* and *where the others can see it* are the
 * engine reporting its own observation on top of the observation. What is said
 * or not said is the fact, and it is what this matches.
 */
const SAID_OR_DID_NOT = /They answer\.|They say nothing/;
const THE_ROOM = /other (people|person) here had no part in it/;

/** Every phase-3 user message the provider was sent since a mark. */
function narrationsSince(provider: ScriptedProvider, from: number): string[] {
    return provider.calls.slice(from)
        .filter(call => !(call.messages.find(m => m.role === 'system')?.content ?? '')
            .startsWith('You are the intent router'))
        .map(call => call.messages.find(m => m.role === 'user')?.content ?? '');
}

/**
 * Somebody close enough in realm for a fight to have rounds in it at all.
 *
 * Seeded population now decides who is nameable here (`fix(population)`), and
 * `nameable[0]` can land on somebody the `HELPLESS_REALM_GAP` resolves in one
 * blow - no exchange, nobody with a moment to speak in it, and three of the
 * tests below measuring exactly that moment. Picking the nearest realm instead
 * keeps the fight the sections below are actually about.
 */
function closeEnoughToFight<T extends { realmOrdinal: number }>(
    nameable: readonly T[],
    realmOrdinal: number
): T {
    return nameable.find(row =>
        Math.abs(realmIndexOf(row.realmOrdinal) - realmIndexOf(realmOrdinal)) < HELPLESS_REALM_GAP
    ) ?? nameable[0];
}

async function openARun(provider?: ScriptedProvider) {
    const harness = await makeGameInWorld({ seed: RUN, worldSeed: WORLD, provider });
    const { cultivator } = await harness.game.newRun('Probe');
    const gate = new KnowledgeGate(harness.db);
    // Find somebody the player can actually name, then stand in that person's
    // current capped area. The opening area is no longer promised a scene.
    const known = harness.game.atHand!.npcs
        .filter(row => gate.isAwareOf(cultivator.id, 'cultivator', row.id))
        .map(row => ({ ...row, realmOrdinal: row.cultivation.realmOrdinal }));
    expect(known, 'the pinned world gave the player no nameable person').not.toHaveLength(0);
    const chosen = closeEnoughToFight(known, cultivator.realmOrdinal);
    await standWhereThePeopleAre(harness, cultivator.id, new Set([chosen.id]));
    const current = harness.game.currentRun().cultivator;
    const nameable = harness.game.present(current)
        .filter(row => gate.isAwareOf(current.id, 'cultivator', row.id));
    expect(nameable.map(row => row.id), 'the chosen person was not in the arranged area').toContain(chosen.id);
    return { ...harness, cultivator: current, nameable };
}

describe('a turn that happened to somebody', () => {
    it('hands the narrator the person and not only their hit points', async () => {
        const provider = new ScriptedProvider({
            plans: ['{"action":"attack"}'],
            narrations: ['(scripted)']
        });
        const { game, cultivator, nameable } = await openARun(provider);
        expect(nameable.length).toBeGreaterThan(0);
        const them = closeEnoughToFight(nameable, cultivator.realmOrdinal).name;

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
        const { game, cultivator, nameable } = await openARun(provider);
        const them = closeEnoughToFight(nameable, cultivator.realmOrdinal).name;

        const readings: string[] = [];
        for (let round = 0; round < 3; round++) {
            const mark = provider.calls.length;
            await game.act(round === 0 ? `I attack ${them}` : 'I strike him again');
            for (const prompt of narrationsSince(provider, mark)) {
                const line = prompt.split('\n').find(row => row.startsWith(`- ${them},`));
                if (line) readings.push(line);
            }
        }

        // A bout that has taken a quarter of somebody is not the bout that has
        // taken a scratch, and the sentence has to move with it.
        expect(readings.length).toBeGreaterThan(1);
        // AND IT NEVER ARRIVES TWICE THE SAME. This used to assert one reading
        // per round, which was the defect rather than the rule: a channel that
        // runs every turn printed the identical five sentences under the
        // identical name for as long as the fight took. A round that finds
        // nothing newly true of somebody now says nothing about them, so what
        // reaches the narrator is exactly the rounds that moved.
        expect(new Set(readings).size).toBe(readings.length);
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
        const beforeGift = actualSpiritStones(game, them.id)!;
        const beforeTime = game.state().run.elapsedDays;
        const turn = await game.act(`I give ${them.name} ${gift} spirit stones`);
        expect(turn.toolCalls.some(call => !call.ok), turn.narration).toBe(false);
        expect(actualSpiritStones(game, them.id)).toBe(beforeGift + gift);
        expect(game.state().cultivator.spiritStones).toBe(gift * 3);
        expect(game.state().run.elapsedDays - beforeTime).toBeCloseTo(1 / 8);
        const [prompt] = narrationsSince(provider, mark);

        const line = prompt.split('\n').find(row => row.startsWith(`- ${them.name},`));
        expect(line, prompt).toBeDefined();
        // The engine does not grade. What separates this from a theft is the
        // direction, and nothing else.
        expect(line).toMatch(/gained/);
        expect(line).not.toMatch(/has gone|is gone/);
        expect(line).toMatch(SAID_OR_DID_NOT);
    }, 300_000);
});

describe('and both front doors say the same thing', () => {
    it('reaches the deterministic narrator, which has no model behind it', async () => {
        const { game, cultivator, nameable } = await openARun();
        const them = closeEnoughToFight(nameable, cultivator.realmOrdinal).name;

        const result = await game.act(`I attack ${them}`) as { narration: string };
        expect(result.narration).toMatch(SAID_OR_DID_NOT);
        expect(result.narration).toContain(them);
    }, 300_000);
});
