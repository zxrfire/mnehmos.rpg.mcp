/**
 * Somebody standing where something is wrong with the place, and being told.
 *
 * The area-status layer was complete and had no writer at all, and the read
 * side had just been wired into `investigate` - so the played verb was
 * consulting a permanently empty column and reporting, with total confidence,
 * that nothing was wrong anywhere. This is the other end of that: a world that
 * has been running, a player standing on the ground, and the sentence.
 *
 * It also pins the half of the discovery rule that was missing. `encountered`
 * is the ladder's own word for *they have been in it, so they have the signs*,
 * and the read was capped there without being floored there - so the answer was
 * gated on a knowledge row that nothing grants for standing still. Somebody
 * could walk into a famine and be told the place was fine, over a status that
 * was stopping the food and quadrupling the prices the whole time.
 *
 * ══ WHY THE FIRST CLAIM IS POOLED AND THE SECOND IS NOT ═══════════════════
 *
 * *"The world made some"* is a claim about a rate, and it was asserted on one
 * seed. Measured across twelve pinned worlds on this tree, at the advance this
 * file actually gets, the live count per world is
 *
 *     3  4  1  2  1  2  2  1  0  0  1  2      (pooled 19, ten worlds of twelve)
 *
 * so **two worlds in twelve have none**, and the seed this file happened to
 * pick has three. That is the pool-the-sample hazard in AGENTS.md exactly: a
 * guard that passes on the draw, and would have been read as a broken writer by
 * whoever next drew `st-i`. The bar itself was right - it is the sample that
 * could not carry it - so the claim is now made over all twelve, at both edges,
 * with the numbers above as its provenance.
 *
 * The SENTENCE, on the other hand, is not a rate. It is what one place says
 * when somebody stands in it, and one world is proof of it - so it is asserted
 * on the world the pooled pass names, which keeps it deterministic and keeps it
 * from silently skipping when the draw is empty. It used to `return` early in
 * that case, which is a test that reports success for having done nothing.
 *
 * ── One thing worth knowing before trusting the horizon ───────────────────
 *
 * `ADMIN advance_days years=120` at ordinal 20 does NOT advance 120 years. A
 * Core Formation body still eats, nothing here pays for the food, and the span
 * stops on `starvation_begun` at 1865 days - 5.11 years, identically on every
 * world seed. That is correct behaviour rather than the truncation that used to
 * live here (`lethal_injury_threshold` at 780 days, now fixed in
 * `time-skip.ts`), because an empty pack is a decision the operator has not
 * made. The counts above are therefore mostly the world's own thousand years of
 * history plus five, not a century of them. Standing at a rung that does not
 * eat, or paying `rations=`, is what would buy the full span; that is a change
 * to what this file is measuring and is left to whoever wants it.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';
import { isStatusRunningOn } from '../../src/engine/world/what-is-true-of-a-place-right-now.js';

/**
 * Twelve pinned worlds. Fixed, and never retried until they pass - a bar that
 * is re-rolled is a bar that asserts nothing.
 */
const WORLDS = [
    'a-world-that-has-lived', 'war-1', 'pyr-a', 'pyr-c',
    'st-e', 'st-f', 'st-g', 'st-h', 'st-i', 'st-j', 'st-k', 'st-l'
];

beforeAll(() => {
    process.env.ADMIN_MODE = 'true';
});

interface Said { narration?: string; error?: string }

interface WorldRow {
    currentDay: number;
    statuses: { areaId: string; kind: string }[];
    locations: { id: string; name: string }[];
}

/** A run in a pinned world, stood at a rung and left to let the world run. */
async function lived(worldSeed: string, seed: string): Promise<{
    say: (s: string) => Promise<Said>;
    world: WorldRow;
    /** Live statuses that are attached to a place this run can be moved to. */
    placed: { areaId: string; kind: string }[];
}> {
    const { game } = await makeGameInWorld({ seed, worldSeed });
    await game.newRun('Walker');
    const say = (s: string) => game.act(s) as Promise<Said>;
    await say('ADMIN set_realm ordinal=20');
    // Let the world get on with its own affairs. Through `advance_days`,
    // which is real time at idle focus - the years have to be LIVED for the
    // world's own passes to run, and a cultivator sitting through them on
    // `cultivate` sometimes does not come out the other side, which is the
    // ladder's business and not this test's.
    await say('ADMIN advance_days years=120');

    const world = (game as unknown as { atHand: WorldRow }).atHand;
    const day = Math.floor(world.currentDay);
    const placed = world.statuses.filter(
        s => isStatusRunningOn(s as never, day)
            && world.locations.some(l => l.id === s.areaId)
    );
    return { say, world, placed };
}

/**
 * The world that the pooled pass names for the sentence cases.
 *
 * Not chosen by hand: the first of the twelve that carries a live status on a
 * place, which the pooled test asserts is this one. If the world stops making
 * one there, that test fails first and says so, rather than these two skipping.
 */
const NAMED_WORLD = WORLDS[0];

describe('standing somewhere that something is wrong with', () => {
    it('makes them at all, over twelve worlds rather than over one', async () => {
        const counts: { worldSeed: string; live: number }[] = [];
        for (const worldSeed of WORLDS) {
            const { placed } = await lived(worldSeed, 'wrong-a');
            counts.push({ worldSeed, live: placed.length });
        }
        const pooled = counts.reduce((sum, row) => sum + row.live, 0);
        const withAny = counts.filter(row => row.live > 0).length;
        const detail = counts.map(r => `${r.worldSeed}=${r.live}`).join(' ');

        // BOTH EDGES. The floor is the assertion the whole layer rests on -
        // measured before it had a writer, a thousand world-years produced zero
        // rows anywhere. The ceiling is the other way a rate regresses: a
        // writer that fires constantly carpets every province in famines and
        // passes every floor ever written.
        expect(pooled, detail).toBeGreaterThanOrEqual(8);
        expect(pooled, detail).toBeLessThanOrEqual(48);
        // And the tail, because an average hides shape: most worlds have one,
        // rather than one world having them all. Measured ten of twelve.
        expect(withAny, detail).toBeGreaterThanOrEqual(6);

        // The world the two cases below stand in has one. Asserted here so a
        // draw that empties it fails loudly instead of skipping them.
        expect(counts[0].live, detail).toBeGreaterThan(0);
    }, 900_000);

    it('says what is wrong, at the stage standing there buys', async () => {
        const { say, world, placed } = await lived(NAMED_WORLD, 'wrong-a');
        expect(placed.length, `${NAMED_WORLD} carried no live status on a place`).toBeGreaterThan(0);
        const place = world.locations.find(l => l.id === placed[0]!.areaId)!;

        await say(`ADMIN move ${place.name}`);
        const looked = await say(`I examine ${place.name}`);
        const said = looked.narration ?? '';

        // The status is in the answer, and so are the signs - which is what
        // `encountered` buys and what standing there has to be worth.
        expect(said.length).toBeGreaterThan(0);
        expect(said).toMatch(/It (has been like this for|started today)/);

        // And the ground reading is there too, because they are two different
        // facts about one place and the seam between them is deliberate: how
        // much is in the ground is a count, and what is TRUE of the place is
        // not derived from any count.
        expect(said).toMatch(/The ground around/);
    }, 900_000);

    it('reads as sentences rather than as a run-on', async () => {
        // Played: "It has been like this for 1455 days. the caravans have
        // stopped and the road east is not being used there are more people
        // sleeping outside the walls than there were". Each sign is its own
        // line and a caller joining them with a space gets a paragraph with no
        // punctuation in it.
        const { say, world, placed } = await lived(NAMED_WORLD, 'wrong-b');
        expect(placed.length, `${NAMED_WORLD} carried no live status on a place`).toBeGreaterThan(0);
        const place = world.locations.find(l => l.id === placed[0]!.areaId)!;

        await say(`ADMIN move ${place.name}`);
        const said = (await say(`I examine ${place.name}`)).narration ?? '';
        // No lower-case letter opening a clause straight after a full stop.
        expect(said).not.toMatch(/\.\s+[a-z]/);
    }, 900_000);
});
