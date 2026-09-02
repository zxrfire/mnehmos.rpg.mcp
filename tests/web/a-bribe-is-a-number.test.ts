/**
 * Money on the table has to actually be on the table.
 *
 * Measured in play:
 *
 *     > I bribe Kong Kelin
 *     Kong Kelin agreed. It was taken.
 *
 *     stones before  6043
 *     stones after   6043
 *
 * No sum named, no price, no record of what was bought. That is the softening
 * the agency rule forbids, and it is the invisible kind: the player believes
 * they spent something.
 *
 * The resolver's contract has carried `stonesOffered` from the start -
 * "spirit stones actually put down. Only spent when the attempt lands" - and
 * this caller never filled it. So the fix is not a new mechanic; it is the
 * caller doing what the field always said.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld, engineCalls } from './harness';
import { stonesNamedIn } from '../../src/web/game';
import { KnowledgeGate } from '../../src/web/knowledge';

/**
 * ── The world is pinned, and it had to be ────────────────────────────────
 *
 * These three used `makeGame({ seed, worldEnabled: true })`, which pins the RUN
 * seed and leaves the WORLD unseeded: `cultivation-world.ts` mints a fresh
 * `randomUUID()` for a world that has none, so the several hundred people in it
 * - who is in the square, what rung they stand at, WHAT THEY ARE CARRYING -
 * were redrawn on every execution.
 *
 * A bribe test is the worst possible place for that. Every assertion here turns
 * on a purse or on somebody the player can name, and both were re-rolled per
 * run: the file failed intermittently on its own, six consecutive runs going
 * pass, FAIL, pass, FAIL, pass, pass, and the failure mode was
 * `.find(row => row.kind === 'cultivator')!` coming back undefined because that
 * particular world dealt the player nobody.
 *
 * AGENTS.md states the rule this breaks: *"a played test that pins a seed to an
 * outcome without pinning the world is pinning a coincidence."* So the world is
 * pinned too, and the run is reproducible end to end.
 */
const WORLD = 'bribe-probe-world';

/** Somebody this cultivator can actually name, or the test says why not. */
function someoneKnown(
    db: ConstructorParameters<typeof KnowledgeGate>[0],
    holderId: string
) {
    const known = new KnowledgeGate(db)
        .awareness(holderId)
        .find(row => row.kind === 'cultivator');
    expect(known, 'the pinned world opened with nobody the player could name').toBeDefined();
    return known!;
}

describe('what counts as a sum', () => {
    it('reads the figure somebody actually said', () => {
        expect(stonesNamedIn('I bribe him with 200 spirit stones')).toBe(200);
        expect(stonesNamedIn('I bribe him with 200 stones')).toBe(200);
        expect(stonesNamedIn('I offer 1,500 spirit stones')).toBe(1500);
    });

    it('does not read a bare number as an offer', () => {
        // "I bribe the third guard" is not three stones, and reading it as one
        // would have somebody paying for a sentence about a person.
        expect(stonesNamedIn('I bribe the third guard')).toBeNull();
        expect(stonesNamedIn('I bribe Kong Kelin')).toBeNull();
        expect(stonesNamedIn('I bribe him with 0 stones')).toBeNull();
    });
});

describe('a coin approach with nothing on the table', () => {
    it('is refused, and the refusal names the hole and the purse', async () => {
        const { db, game } = await makeGameInWorld({ seed: 'probe-c', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Probe');
        const known = someoneKnown(db, cultivator.id);

        const before = game.state().cultivator.spiritStones;
        const said = await game.act(`I bribe ${known.name}`) as { narration?: string };

        expect(said.narration ?? '').toContain('A bribe is a number');
        expect(said.narration ?? '').toContain(String(before));
        // Refused before the resolver, so no days and no mark either.
        expect(game.state().cultivator.spiritStones).toBe(before);
    }, 120_000);

    it('is refused when the figure is bigger than the purse', async () => {
        const { db, game } = await makeGameInWorld({ seed: 'probe-c', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Probe');
        const known = someoneKnown(db, cultivator.id);

        const before = game.state().cultivator.spiritStones;
        const said = await game.act(
            `I bribe ${known.name} with 999999 spirit stones`
        ) as { narration?: string };

        expect(said.narration ?? '').toContain('short of what you have just promised');
        expect(game.state().cultivator.spiritStones).toBe(before);
    }, 120_000);

    it('never leaves the purse where a refusal found it after a named offer', async () => {
        // A refusal keeps the money - the resolver's own rule, and the reason
        // the debit is on `stonesSpent` rather than on what was offered. What
        // must not happen is a TAKE that costs nothing, and the only thing that
        // can produce one is this caller failing to pass the figure at all.
        const { db, game } = await makeGameInWorld({ seed: 'probe-c', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Probe');
        const known = someoneKnown(db, cultivator.id);

        const before = game.state().cultivator.spiritStones;
        const said = await game.act(
            `I bribe ${known.name} with 5 spirit stones`
        ) as { narration?: string };
        const after = game.state().cultivator.spiritStones;

        const taken = (said.narration ?? '').includes('It was taken');
        if (taken) expect(after).toBeLessThan(before);
        else expect(after).toBe(before);
    }, 120_000);
});

/**
 * And the number has to BUY something.
 *
 * The half that was missing. A bribe named a sum, was refused without one, and
 * was debited on a take - and `oddsOf` never read `stonesOffered`, so the
 * world's answer was identical whether the player put down a purse or nothing.
 * The player spent money and bought exactly nothing.
 *
 * Asserted through the mechanical channel rather than through the outcome,
 * because the outcome is a roll and the claim is about the odds it was rolled
 * against. `resolveAttempt` prints every term by name for exactly this reason.
 */
describe('the sum on the table reaches the odds', () => {
    async function bribeWith(stones: number): Promise<{ odds: number; purse: number }> {
        const { db, game } = await makeGameInWorld({ seed: 'probe-c', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Probe');
        db.prepare('UPDATE cultivators SET spirit_stones = 50000 WHERE id = ?').run(cultivator.id);
        const known = someoneKnown(db, cultivator.id);

        const said = await game.act(`I bribe ${known.name} with ${stones} spirit stones`);
        const call = engineCalls(said).find(row => row.name === 'engine.resolveAttempt');
        expect(call, 'the attempt never reached the resolver').toBeDefined();

        // The channel speaks in sentences now, and every figure the field dump
        // carried is still in it - "comes off about one time in 8 (13 in a
        // hundred)", "the money put down added 15 points". Anchored on `comes
        // off` because "in a hundred" is deliberately the odds and nothing
        // else, and on the term's own name because the terms are named rather
        // than keyed.
        const odds = Number(
            /comes off (?:about one time in \d+ \()?(\d+) in a hundred/
                .exec(call!.summary)?.[1] ?? NaN
        );
        const purse = /Nothing came from[^.]*the money put down/.test(call!.summary)
            ? 0
            : Number(/the money put down added (\d+) points?/.exec(call!.summary)?.[1] ?? NaN);
        expect(Number.isFinite(odds), `no odds in: ${call!.summary}`).toBe(true);
        expect(Number.isFinite(purse), `no purse term in: ${call!.summary}`).toBe(true);
        return { odds, purse };
    }

    it('prices a real offer above a token one, on the same world and the same day', async () => {
        const token = await bribeWith(1);
        const real = await bribeWith(20000);

        expect(real.purse, 'the purse term did nothing').toBeGreaterThan(token.purse);
        expect(real.odds, 'the money bought no odds').toBeGreaterThan(token.odds);
    }, 240_000);
});

/**
 * AND THE PURSE HAS TO ACTUALLY MOVE.
 *
 * The cardinal rule in AGENTS.md, in its most literal form: never a code path
 * where the narration asserts an outcome without the corresponding state change
 * having already happened. Measured in a live run, four bribes in a row:
 *
 *     "It was taken, and 60 spirit stones went with it."   67 -> 67
 *     "It was taken, and  5 spirit stones went with it."   67 -> 67
 *     "It was taken, and 10 spirit stones went with it."   67 -> 68
 *
 * The debit landed and the span the bribe paid for then refunded it - see
 * `a-spend-survives-the-span-it-paid-for.test.ts` for the primitive and the
 * mechanism. What is guarded HERE is the sentence against the row, through the
 * verb a player types, because that is the pairing the rule is about.
 *
 * Written as a sweep rather than on one seed. Whether an attempt lands is a
 * roll, so a single pinned run asserts nothing about takes if it happens to be
 * refused - and it was exactly that thinness that let this survive.
 */
describe('what the narration says left the purse, left the purse', () => {
    it('debits the named sum on every take, and nothing on every refusal', async () => {
        const takes: string[] = [];
        const refusals: string[] = [];
        const wrong: string[] = [];

        for (let n = 0; n < 10; n++) {
            const { db, game } = await makeGameInWorld({
                seed: `purse-${n}`, worldSeed: `purse-world-${n}`
            });
            const { cultivator } = await game.newRun('Probe');
            const known = new KnowledgeGate(db).awareness(cultivator.id)
                .find(row => row.kind === 'cultivator');
            if (!known) continue;

            // A purse big enough that the offer is affordable and the span's
            // own upkeep cannot be mistaken for the bribe.
            db.prepare('UPDATE cultivators SET spirit_stones = 5000 WHERE id = ?')
                .run(cultivator.id);
            const before = game.state().cultivator.spiritStones;

            const said = await game.act(`I bribe ${known.name} with 250 spirit stones`);
            const after = game.state().cultivator.spiritStones;
            const prose = said.narration ?? '';

            // The engine's own number, which is what the prose is quoting.
            const call = engineCalls(said).find(row => row.name === 'engine.resolveAttempt');
            const spent = /no spirit stones went with it/.test(call?.summary ?? '')
                ? 0
                : Number(
                    /(\d+) spirit stones? went with it/.exec(call?.summary ?? '')?.[1] ?? NaN
                );
            expect(Number.isFinite(spent), `no spend in: ${call?.summary}`).toBe(true);

            if (spent > 0) {
                takes.push(`purse-${n}`);
                // Exactly the sum. Not "less than before" - a span that ate
                // upkeep would satisfy that while the bribe itself was free,
                // which is the shape that hid this for as long as it did.
                if (before - after !== spent) {
                    wrong.push(
                        `purse-${n}: engine spent ${spent}, purse moved `
                        + `${before - after} (${before} -> ${after})`
                    );
                }
                expect(prose, 'a take that spent stones said nothing about them')
                    .toContain('spirit stones went with it');
            } else {
                refusals.push(`purse-${n}`);
                if (after !== before) {
                    wrong.push(`purse-${n}: nothing was spent and the purse moved to ${after}`);
                }
            }
        }

        expect(wrong, 'the prose and the purse disagree').toEqual([]);
        // Both arms have to have been exercised, or this proves half of it.
        expect(takes.length, 'no bribe landed across ten worlds').toBeGreaterThan(0);
        expect(refusals.length, 'no bribe was refused across ten worlds').toBeGreaterThan(0);
    }, 600_000);
});
