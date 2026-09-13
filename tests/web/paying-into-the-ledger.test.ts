/**
 * The other half of the contribution economy.
 *
 * Missions were the only earner, so a player with stones and no time had no
 * route to a promotion at all - a rich cultivator and a poor one had exactly
 * the same one, which is not what money is for in this setting.
 *
 * THE RATE IS DERIVED AND NOT PICKED, which is the whole reason this took a
 * second pass. `dutyTermsFor` prices a commission as
 *
 *     contribution = base * yieldScale * (days / 20)
 *     stones       = base * yieldScale * 1.4
 *
 * so the base, the pitch and the regard cancel and the house's own exchange
 * rate is `days / 28`. Nothing is invented; a hand-picked number here would be
 * the margin-constant-in-the-prose-layer failure AGENTS.md forbids.
 *
 * ── AND THE SPAN IT IS READ AT IS THE ORDINARY ERRAND ────────────────────
 *
 * It used to be the MEDIAN SPAN of what was posted to the reader, which made the
 * board's contents load-bearing on the economy: three new sending reasons, two
 * of them `regional`, moved every median 60 to 90 and took a hundred stones from
 * 71 contribution to 107 against a first promotion of 100. The rule did not
 * change and the anchor did - `ORDINARY_DUTY_DAYS`, the span the contribution
 * line is already measured in - so a stone now buys the same contribution at
 * every house and every rung. The measurement, the spread it replaces and the
 * property are in
 * `tests/engine/encounters/a-posting-does-not-reprice-a-donation.test.ts`.
 */

import { parseIntent } from '../../src/web/actions';
import {
    contributionPerStoneDonated,
    contributionPerStoneOnAnOrdinaryErrand,
    contributionPerStoneOverDays,
    CONTRIBUTION_BASE
} from '../../src/engine/encounters/duties';
import { KnowledgeGate } from '../../src/web/knowledge';
import { makeGame } from './harness';

function ledger(db: ReturnType<typeof makeGame>['db'], id: string): number {
    const row = db.prepare(
        'SELECT contribution FROM sect_members WHERE cultivator_id = ?'
    ).get(id) as { contribution: number } | undefined;
    return row?.contribution ?? 0;
}
function stones(db: ReturnType<typeof makeGame>['db'], id: string): number {
    return Number((db.prepare('SELECT spirit_stones FROM cultivators WHERE id = ?')
        .get(id) as { spirit_stones: number }).spirit_stones);
}

describe('the rate comes off the board', () => {
    /**
     * Pinned against the closed form rather than against a number, so a retune
     * of either duty line moves this with it instead of breaking it.
     */
    it('is days over twenty-eight, with everything else cancelled', () => {
        for (const days of [1, 7, 20, 45, 90]) {
            expect(contributionPerStoneOverDays(days)).toBeCloseTo(days / 28, 10);
        }
        // And it genuinely is what the two lines produce, for any base.
        const days = 20;
        const yieldScale = 1.7;
        const contribution = CONTRIBUTION_BASE * yieldScale * (days / 20);
        const paid = CONTRIBUTION_BASE * yieldScale * 1.4;
        expect(contribution / paid).toBeCloseTo(contributionPerStoneOverDays(days), 10);
    });

    it('refuses a span of zero rather than dividing by it', () => {
        expect(contributionPerStoneOverDays(0)).toBeGreaterThan(0);
        expect(contributionPerStoneOverDays(Number.NaN)).toBeGreaterThan(0);
    });
});

describe('paying into a house', () => {
    /**
     * Somebody on a house's roll, whichever house this seed let them hear of.
     *
     * The house is asked of the knowledge layer rather than named here. It used
     * to say "I join the Azure Dew Sect", which worked because a bug made every
     * cultivator in every run know that one house: the seeder took a GLOBAL
     * minimum admission bar tie-broken alphabetically on the faction id, so
     * `sect-azure-dew-sect` won on the letter A everywhere. With the seeding
     * region-aware, a cultivator born elsewhere has never heard of it, the join
     * is correctly refused, and the test then measured a donation by somebody
     * on nobody's roll.
     */
    async function member(seed: string, purse = 500) {
        const { db, game } = makeGame({ seed, worldEnabled: true });
        const { cultivator } = await game.newRun('Giver');
        db.prepare('UPDATE cultivators SET spirit_stones = ? WHERE id = ?').run(purse, cultivator.id);

        // ── AND THE COUNTY'S OWN HOUSE, NOT WHATEVER PAPER IS UP ─────────
        //
        // The opening now reads the wall where the run begins, so a house that
        // put a bill up is in this awareness on day 0 - with `read` provenance,
        // and mostly with no province at all, because a seatless house is the
        // kind reduced to advertising. Those are exactly the houses whose door
        // is somewhere else, and joining one from here is refused. What this
        // helper wants is a house the county itself named, which is the `told`
        // row the seeder wrote.
        const known = new KnowledgeGate(db).awareness(cultivator.id, 'sect')
            .filter(row => row.sourceKind === 'told');
        expect(known.length, `seed ${seed} left the cultivator knowing no house to join`)
            .toBeGreaterThan(0);
        await game.act(`I join the ${known[0].name}`);

        const roll = db
            .prepare('SELECT sect_id FROM cultivators WHERE id = ?')
            .get(cultivator.id) as { sect_id: string | null };
        expect(roll.sect_id, `joining ${known[0].name} left them on nobody's roll`).toBeTruthy();

        return { db, game, cultivator };
    }

    it('is a sentence the parser recognises', () => {
        const parsed = parseIntent('I donate 100 spirit stones to the sect');
        expect(parsed.action).toBe('sect');
        expect(parsed.intent).toBe('donate');
        // And taking from the treasury is emphatically not donating to it.
        expect(parseIntent('I steal from the sect treasury').intent).toBe('siphon');
    });

    it('credits the ledger and takes the money', async () => {
        const { db, game, cultivator } = await member('donate-credits');
        const before = { stones: stones(db, cultivator.id), book: ledger(db, cultivator.id) };

        await game.act('I donate 100 spirit stones to the sect');

        expect(stones(db, cultivator.id)).toBe(before.stones - 100);
        expect(ledger(db, cultivator.id)).toBeGreaterThan(before.book);
    }, 120_000);

    /**
     * The owner's first rule. If paying matched the board, contribution would
     * stop meaning service rendered and become a second currency.
     *
     * ── THIS ASSERTION USED TO PIN A SPAN, AND THE SPAN WAS THE ENGINE'S ──
     *
     * It read `bought < 100 * contributionPerStoneOverDays(20)`, where 20 is
     * `DEFAULT_DUTY_DAYS` - the fallback the engine uses when the board is
     * EMPTY. `donate` does not use it when the board has anything on it: it
     * takes the MEDIAN SPAN of what is posted to this person and prices off
     * that. So the literal was the right number only while the member's board
     * happened to run short.
     *
     * It was also passing on a rounding. The median span on this seed was
     * already 60, so the rate was 71.43, the ledger stored 71, and the
     * assertion was `71 < 71.43`.
     *
     * It went red when two sendings at `regional` scale were added to
     * `SENDING_REASONS` for the escort occasions. The spans went
     * `90 90 90 60 30 20 20` to `90 90 90 90 90 60 30 20 20`, the median moved
     * 60 to 90, and 100 stones went from 71 contribution to 107.
     *
     * So it asserts the rule against the two numbers the engine itself prints,
     * which is the pair a player compares.
     *
     * ── AND THE THIRD ASSERTION IS THE GUARD ─────────────────────────────
     *
     * The board is no longer read at all: the credited figure is the ordinary
     * errand's rate, discounted, and that is asserted against the engine's own
     * function rather than a literal. RED-CHECKED by putting the median rule
     * back in `donate` - the ledger credited 71 against 24 and this went red -
     * which is the whole point of it: a duty reason added tomorrow cannot move
     * what a donation buys without this failing.
     */
    it('pays worse than doing the work, and says so', async () => {
        const { db, game, cultivator } = await member('donate-discount');
        await game.act('I donate 100 spirit stones to the sect');

        const bought = ledger(db, cultivator.id);

        const asked = await game.act('I donate to the sect');
        expect(asked.narration).toMatch(/board pays better/i);

        // Both rates, read out of the engine's own answer rather than
        // recomputed here: what a stone buys, and what a stone earns.
        const said = asked.narration ?? '';
        const rates = [...said.matchAll(/([\d.]+) (?:contribution )?the stone/g)]
            .map(hit => Number(hit[1]));
        expect(rates.length, `two rates were not stated: ${said}`).toBe(2);
        const [paid, earned] = rates as [number, number];

        expect(paid).toBeLessThan(earned);
        expect(bought).toBeLessThan(100 * earned);
        // And the number said is the number credited.
        expect(bought).toBeCloseTo(100 * paid, 0);

        // THE BOARD IS NOT WHAT WAS READ. Both figures come off the ordinary
        // errand, so neither moves when something is pinned up.
        expect(bought).toBe(Math.max(1, Math.round(100 * contributionPerStoneDonated())));
        expect(earned).toBeCloseTo(contributionPerStoneOnAnOrdinaryErrand(), 2);
    }, 120_000);

    /**
     * The owner's second rule: a house that takes any sum from anybody reads as
     * a shop. The floor is the lowest rank's own monthly stipend, read off the
     * sect's table rather than chosen.
     */
    it('refuses a sum beneath its own dignity, and charges nothing for asking', async () => {
        const { db, game, cultivator } = await member('donate-floor');
        const before = stones(db, cultivator.id);

        const acted = await game.act('I donate 1 spirit stone to the sect');

        expect(stones(db, cultivator.id), 'took money for a donation it refused').toBe(before);
        expect(ledger(db, cultivator.id)).toBe(0);
        expect(acted.narration).toMatch(/worth writing down|where the ledger starts/i);
    }, 120_000);

    it('will not take what is not in the purse', async () => {
        const { db, game, cultivator } = await member('donate-broke', 30);
        const before = stones(db, cultivator.id);

        await game.act('I donate 900 spirit stones to the sect');

        expect(stones(db, cultivator.id)).toBe(before);
        expect(ledger(db, cultivator.id)).toBe(0);
    }, 120_000);

    it('tells a rogue there is no ledger with their name on it', async () => {
        const { game } = makeGame({ seed: 'donate-rogue', worldEnabled: true });
        await game.newRun('Nobody');
        const acted = await game.act('I donate 100 spirit stones to the sect');
        expect(acted.narration).toMatch(/nobody's roll|no ledger/i);
    }, 120_000);
});
