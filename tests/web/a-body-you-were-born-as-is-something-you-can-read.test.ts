/**
 * A physique has to be reachable by a sentence, twice over.
 *
 * `src/web/README.md` records this project's most-repeated defect - a mechanic
 * the engine holds that no typed English reaches - so the axis is only finished
 * when both of these work:
 *
 *   a player can find out what their OWN body is, at no cost and without
 *   knowing a magic word
 *
 *   a player can find out what SOMEBODY ELSE's is, and cannot do it at second
 *   hand: a name heard through a wall says nothing about a body
 *
 * The second half is the interesting one, and it is why this is a knowledge
 * question rather than a stat readout. Knowing that the girl in the square is
 * cold to the touch in any weather is exactly the kind of thing somebody should
 * have to learn, and exactly the kind of thing that gets a person hunted once
 * it is known.
 *
 * ── THE WORLD IS PINNED AS WELL AS THE RUN ──────────────────────────────
 *
 * AGENTS.md: a played test that pins a seed to an outcome without pinning the
 * world is pinning a coincidence. Both are pinned here, and the run seed is not
 * arbitrary - `physique-seed-179` is the first seed in a swept range that opens
 * as somebody with a Profound Yin Body, which is 4 births in a thousand. The
 * sweep is `scripts/probe-a-body-somebody-was-born-as.ts`; if the catalog
 * weights move, re-run it rather than editing the number here.
 */

import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';

import { makeGameInWorld } from './harness';
import { KnowledgeGate } from '../../src/web/knowledge';
import { getPhysique } from '../../src/engine/cultivation/physiques';

const WORLD = 'a-body-you-were-born-as-world';

/** A run seed that opens as a Profound Yin Body. See the header. */
const BORN_WITH_ONE = 'physique-seed-179';

describe('a body somebody was born as, on their own sheet', () => {
    it('opens the run carrying it, and it is on the row rather than in prose', async () => {
        const { game, repos } = await makeGameInWorld({ seed: BORN_WITH_ONE, worldSeed: WORLD });
        const { cultivator } = await game.newRun('Probe');
        expect(repos.cultivators.getById(cultivator.id)!.physique).toBe('profound_yin');
    }, 120_000);

    it('answers "I examine myself" with what the body is', async () => {
        const { game } = await makeGameInWorld({ seed: BORN_WITH_ONE, worldSeed: WORLD });
        await game.newRun('Probe');
        const said = await game.act('I examine myself') as { narration?: string };
        expect(said.narration ?? '').toContain('Profound Yin Body');
        expect(said.narration ?? '').toContain('cold to the touch');
    }, 120_000);

    it('answers "who am I" with it too, and says what the years now are', async () => {
        // Two self-reads, and a fact one holds and the other does not is a
        // player having to guess which question shows them their own body.
        const { game } = await makeGameInWorld({ seed: BORN_WITH_ONE, worldSeed: WORLD });
        await game.newRun('Probe');
        const said = await game.act('who am I') as { narration?: string };
        expect(said.narration ?? '').toContain('Profound Yin Body');
        // The cost, said in years, on the sheet the player reads most. A price
        // the person paying it never sees is not a price.
        const ceiling = Math.round(100 * getPhysique('profound_yin').lifespan);
        expect(said.narration ?? '').toContain(`finished at ${ceiling} years`);
    }, 120_000);

    it('says nothing at all where there is nothing to say', async () => {
        // 98 births in a hundred. A line printed every turn to report an
        // ordinary body is the engine reading its own column out loud.
        const { game, repos } = await makeGameInWorld({ seed: 'physique-seed-0', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Probe');
        expect(repos.cultivators.getById(cultivator.id)!.physique).toBeNull();
        const said = await game.act('who am I') as { narration?: string };
        expect(said.narration ?? '').not.toContain('Body:');
        expect(said.narration ?? '').not.toContain('finished at');
    }, 120_000);
});

describe('somebody else\'s body, and the gate on it', () => {
    it('is withheld from a stranger and given to somebody who stood in front of them',
        async () => {
            const { game, repos, db } = await makeGameInWorld({
                seed: 'a-body-somebody-else-has', worldSeed: WORLD
            });
            const { cultivator } = await game.newRun('Probe');
            const here = repos.cultivators.getById(cultivator.id)!.location;

            // Somebody standing where the player is standing, carrying one.
            const her = repos.cultivators.create({
                id: randomUUID(), name: 'Shen Qiao', kind: 'npc',
                spiritRoot: 'single_water', sex: 'female', physique: 'profound_yin',
                attributes: { might: 1, insight: 2, fortune: 1, charm: 2 },
                realmOrdinal: 0, cultivationProgress: 0,
                hp: 30, maxHp: 30, qi: 10, maxQi: 10, age: 19,
                location: here, alive: true
            } as never) as { id: string };

            const gate = new KnowledgeGate(db);
            expect(gate.stageOf(cultivator.id, 'cultivator', her.id)).toBe('unaware');

            // ── THE FIRST LOOK ──────────────────────────────────────────
            //
            // She is visibly there - co-location is not a knowledge question -
            // and what her body is still is not. The refusal names the route
            // rather than saying no, which is the rule for every refusal here.
            const first = await game.act('I examine Shen Qiao') as { narration?: string };
            expect(first.narration ?? '').toContain('Shen Qiao');
            expect(first.narration ?? '').not.toContain('Profound Yin Body');
            expect(first.narration ?? '').toContain('standing in front of them');

            // Looking is how somebody comes to have stood in front of somebody.
            expect(gate.stageOf(cultivator.id, 'cultivator', her.id)).toBe('encountered');

            // ── AND THE SECOND ──────────────────────────────────────────
            const second = await game.act('I examine Shen Qiao') as { narration?: string };
            expect(second.narration ?? '').toContain('cold to the touch');
            expect(second.narration ?? '').toContain('Profound Yin Body');
            // What it is worth to somebody else, which is the whole reason the
            // knowledge is dangerous to hold and dangerous to be.
            expect(second.narration ?? '').toContain('cross a province');
        }, 120_000);

    it('says nothing about an ordinary body, however well somebody is known', async () => {
        const { game, repos } = await makeGameInWorld({
            seed: 'a-body-nobody-has', worldSeed: WORLD
        });
        const { cultivator } = await game.newRun('Probe');
        const here = repos.cultivators.getById(cultivator.id)!.location;
        repos.cultivators.create({
            id: randomUUID(), name: 'Shen Qiao', kind: 'npc',
            spiritRoot: 'single_water', sex: 'female', physique: null,
            attributes: { might: 1, insight: 2, fortune: 1, charm: 2 },
            realmOrdinal: 0, cultivationProgress: 0,
            hp: 30, maxHp: 30, qi: 10, maxQi: 10, age: 19,
            location: here, alive: true
        } as never);

        await game.act('I examine Shen Qiao');
        const second = await game.act('I examine Shen Qiao') as { narration?: string };
        expect(second.narration ?? '').toContain('Shen Qiao');
        expect(second.narration ?? '').not.toContain('Body');
        expect(second.narration ?? '').not.toContain('standing in front of them');
    }, 120_000);
});
