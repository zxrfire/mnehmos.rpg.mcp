/**
 * The board says what tier it is, and taking something off it reaches the
 * world.
 *
 * Two halves of one defect. `who-goes-out-for-a-house-and-what-comes-back.ts`
 * had zero references anywhere in `src/` - `tierNameFor` among them - so a
 * board printed a title, a term and a wage and never the one thing a person
 * reads first off a notice. And nothing a player did off it ever reached
 * `state.history.facts`, which is the ledger `circulating`, `retell`, the
 * digest and `whatIsSaidAbout` all read: played and reported, `what news is
 * there` and `what are people saying about me` returned the identical
 * unrelated line before and after a turn.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';

const WORLD = 'posting-tier';

beforeAll(() => {
    process.env.ADMIN_MODE = 'true';
});

interface Said { narration?: string; error?: string }

interface WorldAtHand {
    history: { facts: { id: string; summary: string; magnitude: number; data: Record<string, unknown> }[] };
    locations: { id: string; name: string; kind: string }[];
}

async function standingWhereThereIsABoard(seed: string) {
    const { game } = await makeGameInWorld({ seed, worldSeed: WORLD });
    await game.newRun('Runner');
    const say = (s: string) => game.act(s) as Promise<Said>;
    await say('ADMIN set_realm ordinal=14');
    const world = (game as unknown as { atHand: WorldAtHand }).atHand;
    const seat = world.locations.find(l => l.kind === 'sect_seat')!;
    await say(`ADMIN move ${seat.name}`);
    return { game, say, world: () => (game as unknown as { atHand: WorldAtHand }).atHand };
}

describe('a posting has a tier', () => {
    it('prints the tier and the rung it is pitched at, on every line of the board', async () => {
        const { say } = await standingWhereThereIsABoard('tier-a');
        const board = await say('what duties are there');
        const said = board.narration ?? '';

        // The tier is the regard band and there is no second difficulty scale.
        // `dutyTermsFor` already computed the band; this asserts the board
        // RENDERS it rather than keeping it to itself.
        expect(said).toMatch(/(first|second|third|open posting|standing|nobody comes back)/i);
        // And the rung, because a tier is a difference between two rungs and
        // one of them has to be on the paper.
        expect(said).toMatch(/at (Qi Condensation|Foundation Establishment|Core Formation|Nascent Soul)/);
    }, 300_000);
});

describe('finishing one is news', () => {
    it('puts what the player did into the ledger everybody else reads', async () => {
        const { say, world } = await standingWhereThereIsABoard('tier-b');
        const board = await say('what duties are there');
        // Take whatever this seed put on the wall, by the name the board
        // printed - AGENTS.md: any name the game prints is a name it accepts.
        const offered = /\n {2}([^\n]+?) - /.exec(board.narration ?? '')?.[1];
        expect(offered, board.narration ?? '').toBeTruthy();

        const before = world().history.facts.length;
        await say(`I put my name down for ${offered}`);
        const after = world().history.facts;

        expect(after.length).toBeGreaterThan(before);
        const mine = after.filter(f => typeof f.data.duty === 'string');
        expect(mine.length).toBeGreaterThan(0);
        // The weight is the TIER's, carried onto the row rather than decided a
        // second time - the same band the board printed at the top of the
        // notice.
        expect(typeof mine[mine.length - 1].data.tier).toBe('string');
        expect(mine[mine.length - 1].summary).toContain('Runner');
    }, 300_000);

    it('moves what people are repeating, which it could not before', async () => {
        const { say } = await standingWhereThereIsABoard('tier-c');
        const board = await say('what duties are there');
        const offered = /\n {2}([^\n]+?) - /.exec(board.narration ?? '')?.[1];
        if (!offered) return;

        const before = await say('what news is there');
        await say(`I put my name down for ${offered}`);
        const after = await say('what news is there');
        expect(after.narration ?? '').not.toBe(before.narration ?? '');
    }, 300_000);
});
