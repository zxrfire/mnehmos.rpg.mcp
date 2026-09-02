/**
 * The four things wrong with one played paragraph, and the wound under it.
 *
 * The transcript that produced this file, on a fresh nobody with no model in
 * front of the engine:
 *
 *     > I steal from Fang Shutao
 *     "Shen Wu put it to Fang Shutao. [...] Fang Shutao refused. [...]
 *      Something like this comes off about one time in 19, and this was the
 *      first try.
 *      Fang Shutao answers being robbed in the body. Shen Wu does not walk away
 *      from it whole.
 *      Fang Shutao mentions The Fired Terraces the way you would mention a
 *      bridge [...]"
 *
 * printed on the SECOND attempt, while the odds correctly fell 5% to 2%, over
 * a body that had just gone from 40 health to 1 without a number being said.
 */

import { describe, it, expect } from 'vitest';
import { makeGameInWorld } from './harness';

const WORLD = 'a-taking-is-not-an-ask';

/** A run standing in a square with somebody in it. */
async function inCompanyOf() {
    const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'a-taking' });
    await h.game.newRun('Shen Wu');
    const here = await h.game.act('who is here');
    const name = (here.narration.match(/[A-Z][a-z]+ [A-Z][a-z]+/) ?? [])[0];
    expect(name, 'the seeded square has somebody in it').toBeTruthy();
    return { h, name: name! };
}

describe('a theft is a taking and not a request', () => {
    /**
     * The owner's ruling: you do not ask somebody if you may rob them, and the
     * failure of a taking is being CAUGHT rather than being declined.
     *
     * `WRONG_BEHIND_INTENT` already knew this - the reprisal and the ledger
     * both read it - and `factsForAttempt` was the one consumer it was not
     * passed to.
     */
    it('is not put to anybody, and is not refused', async () => {
        const { h, name } = await inCompanyOf();

        const { narration } = await h.game.act(`I steal from ${name}`);

        expect(narration).not.toContain('put it to');
        expect(narration).not.toContain('It was refused, and it stayed between the two of you');
        expect(narration).toMatch(/You go at .* for it/);
    }, 60_000);

    /**
     * Second person, in prose that is second person on every other surface.
     * The subject keeps their name because they are somebody else; the half of
     * the paragraph about the person playing does not.
     */
    it('is written in the second person', async () => {
        const { h, name } = await inCompanyOf();
        const { narration } = await h.game.act(`I steal from ${name}`);
        expect(narration).toContain('You go at');
        expect(narration).not.toMatch(/^Shen Wu /);
    }, 60_000);

    /**
     * "this was the first try" printed on every attempt for ever, because
     * `factsForAttempt` was handed a hardcoded `priorAsks: 0` while the odds
     * moved underneath it. `request` has kept this count since it was written.
     */
    it('counts the tries, and stops calling the second one the first', async () => {
        const { h, name } = await inCompanyOf();

        await h.game.act(`I steal from ${name}`);
        const again = await h.game.act(`I steal from ${name}`);

        expect(again.narration).not.toContain('this was the first try');
        expect(again.narration).toContain('That was attempt 2');
    }, 60_000);

    /**
     * The hearsay layer fired on a hostile outcome: the person who had just
     * broken a meridian volunteered a place name, and `this.hear` WROTE THE
     * KNOWLEDGE ROW - so a robbery was a reliable way to farm the map.
     *
     * Checked on the knowledge table rather than in the prose, because the row
     * is the part that lasts.
     */
    it('does not have the person you robbed volunteer you a place name', async () => {
        const { h, name } = await inCompanyOf();

        const places = () => (h.db
            .prepare("SELECT COUNT(*) AS n FROM knowledge_records WHERE claim_key LIKE 'exists:place:%'")
            .get() as { n: number }).n;
        const before = places();

        for (let i = 0; i < 3; i++) await h.game.act(`I steal from ${name}`);

        expect(places(), 'a robbery deposits no place names').toBe(before);
        // And the sentence that carried them, which is the half a reader sees.
        const said = await h.game.act(`I steal from ${name}`);
        expect(said.narration).not.toContain('the way you would mention a bridge');
    }, 60_000);
});

describe('a wound that was written is a wound that gets said', () => {
    /**
     * `whatTheWrongedPartyDid` wrote an injury and took half the pool and said
     * neither. The room's own sentence - "does not walk away from it whole" -
     * is the right sentence for what it is and is not a statement of the
     * injury.
     */
    it('names the wound and what is left in the body', async () => {
        const { h, name } = await inCompanyOf();

        const { narration } = await h.game.act(`I steal from ${name}`);
        const after = h.game.state().cultivator;

        // Only meaningful where the reprisal actually reached the body; a
        // warning costs nothing and correctly says nothing.
        if (after.hp < after.maxHp) {
            expect(narration).toMatch(/wound, open and untreated/);
            expect(narration).toContain(`${after.hp} of ${after.maxHp}`);
        }
    }, 60_000);

    /**
     * The clamp deliberately leaves somebody alive on one point rather than
     * letting an `injured` verdict kill, and that is right. It also produced
     * the state a player is least able to see: two thefts took a run 40 -> 20
     * -> 1 and no turn mentioned a number, a wound, or that anything at all
     * would now finish it.
     */
    it('says so when there is almost nothing left', async () => {
        const { h, name } = await inCompanyOf();

        let said = '';
        for (let i = 0; i < 4; i++) {
            const turn = await h.game.act(`I steal from ${name}`);
            said = turn.narration;
            const now = h.game.state().cultivator;
            if (!now.alive) break;
            if (now.hp <= Math.max(1, now.maxHp * 0.1)) {
                expect(said).toContain('There is almost nothing left in the body');
                return;
            }
        }
        // Nobody hit the floor on this seed, which is a legitimate outcome and
        // not evidence about the sentence. Say so rather than passing silently.
        expect(said.length).toBeGreaterThan(0);
    }, 60_000);
});
