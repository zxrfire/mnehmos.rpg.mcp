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
 */

import { parseIntent } from '../../src/web/actions';
import {
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

        const known = new KnowledgeGate(db).awareness(cultivator.id, 'sect');
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
     */
    it('pays worse than doing the work, and says so', async () => {
        const { db, game, cultivator } = await member('donate-discount');
        await game.act('I donate 100 spirit stones to the sect');

        const bought = ledger(db, cultivator.id);
        // Whatever the reference span, buying must be strictly worse than the
        // board's own rate for the same money.
        expect(bought).toBeLessThan(100 * contributionPerStoneOverDays(20));

        const asked = await game.act('I donate to the sect');
        expect(asked.narration).toMatch(/board pays better/i);
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
