/**
 * Cash bought a rung, with one step hidden in the middle.
 *
 * `donate` credited `sect_members.contribution` at a discounted board rate, and
 * `handlePromote` gates a rung on exactly two things - a realm ordinal, and that
 * same contribution figure. Nothing else in the engine spends contribution: it
 * is read for display, forfeited as a penalty on leaving or being caught, and
 * spent in one place, on a rung. So a money-to-contribution rate WAS a
 * money-to-rank rate, and the only question was the exchange.
 *
 * Struck by the design owner: a rung may not be bought with cash. The road that
 * is open is bribing the person whose call it is, which is a different act with
 * a different record and a witness who can report it.
 *
 * WHAT REPLACED THE OLD TESTS. Two files argued about the RATE - what span it
 * was read at, and whether the board's contents could move it. Both are
 * meaningless now: there is no rate. What is pinned here instead is the
 * absolute, which is the stronger claim and the one the ruling actually made -
 * NO sum credits ANY contribution. The surviving half of the old arithmetic,
 * `contributionPerStoneOverDays`, moved to
 * `tests/engine/encounters/a-disciple-can-pay-somebody-else-to-do-it.test.ts`,
 * where its one remaining consumer lives: pricing a duty somebody is hired to
 * do.
 *
 * RED-CHECKED by putting `addContribution(sect.id, cultivator.id, credited)`
 * back in `donate`: the first two assertions below go red.
 *
 * AND THE VERB SURVIVED THE RULING, which is the part worth stating. Paying
 * money into a house is a real act and was never the defect. It is the only
 * thing in the game that writes `resources.spirit_stones` on a faction, and the
 * deed it leaves is what somebody can be reminded of later. The defect was the
 * line it wrote in the ledger of service, and only that line is gone.
 */

import { parseIntent } from '../../src/web/actions';
import { makeGameInWorld, type Harness } from './harness';
import { KnowledgeGate } from '../../src/web/knowledge';

function ledger(db: Harness['db'], id: string): number {
    const row = db.prepare(
        'SELECT contribution FROM sect_members WHERE cultivator_id = ?'
    ).get(id) as { contribution: number } | undefined;
    return row?.contribution ?? 0;
}
function stones(db: Harness['db'], id: string): number {
    return Number((db.prepare('SELECT spirit_stones FROM cultivators WHERE id = ?')
        .get(id) as { spirit_stones: number }).spirit_stones);
}

/**
 * Somebody on a house's roll, whichever house this seed let them hear of.
 *
 * The house is asked of the knowledge layer rather than named here. Naming one
 * used to work because a seeding bug let every cultivator in every run know the
 * same house; with the seeding region-aware, a cultivator born elsewhere has
 * never heard of it, the join is correctly refused, and the test then measures a
 * donation by somebody on nobody's roll.
 */
async function member(seed: string, purse = 500) {
    const { db, game } = await makeGameInWorld({ seed, worldSeed: `${seed}-world` });
    const { cultivator } = await game.newRun('Giver');
    db.prepare('UPDATE cultivators SET spirit_stones = ? WHERE id = ?').run(purse, cultivator.id);

    // The county's own house, not whatever paper happens to be up: a `told` row
    // is a house the county named, and those are the ones whose door is here.
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

describe('a rung is not for sale', () => {
    it('is a sentence the parser recognises', () => {
        const parsed = parseIntent('I donate 100 spirit stones to the sect');
        expect(parsed.action).toBe('sect');
        expect(parsed.intent).toBe('donate');
        // And taking from the treasury is emphatically not donating to it.
        expect(parseIntent('I steal from the sect treasury').intent).toBe('siphon');
    });

    it('takes the money and credits nothing at all', async () => {
        const { db, game, cultivator } = await member('a-rung-is-not-for-sale-credits');
        const before = stones(db, cultivator.id);

        await game.act('I donate 100 spirit stones to the sect');

        expect(stones(db, cultivator.id)).toBe(before - 100);
        expect(ledger(db, cultivator.id)).toBe(0);
    }, 120_000);

    /**
     * The absolute, and the reason this is a sweep rather than one sum: a rate
     * that is zero at a hundred stones and nonzero at ten thousand would pass
     * the assertion above and still sell a rung. The largest sum here is past
     * every promotion bar in the catalog.
     */
    it('credits nothing at any sum, which is what makes it a rule', async () => {
        const { db, game, cultivator } = await member('a-rung-is-not-for-sale-sweep', 200_000);

        for (const sum of [100, 1_000, 20_000, 100_000]) {
            await game.act(`I donate ${sum} spirit stones to the sect`);
            expect(ledger(db, cultivator.id), `${sum} stones bought a line in the ledger`).toBe(0);
        }
        // And the money genuinely went, so this is not a refusal in disguise.
        expect(stones(db, cultivator.id)).toBe(200_000 - (100 + 1_000 + 20_000 + 100_000));
    }, 180_000);

    /**
     * NOT HAVING THE STANDING TO DO SOMETHING IS NOT THE SAME AS SEEING
     * NOTHING. The answer says what the house does with the money, that it is
     * not service, and where contribution actually comes from.
     */
    it('names the board as the only road, rather than just saying no', async () => {
        const { game } = await member('a-rung-is-not-for-sale-refusal');

        const asked = await game.act('I donate to the sect');
        expect(asked.narration).toMatch(/board/i);
        expect(asked.narration, 'the old rate is still being quoted')
            .not.toMatch(/contribution the stone/i);
    }, 120_000);

    /**
     * The owner's rule about dignity, which outlived the rate: a house that
     * takes any sum from anybody reads as a shop. The floor is the lowest
     * rank's own monthly stipend, read off the sect's table rather than chosen.
     */
    it('refuses a sum beneath its own dignity, and charges nothing for asking', async () => {
        const { db, game, cultivator } = await member('a-rung-is-not-for-sale-floor');
        const before = stones(db, cultivator.id);

        const acted = await game.act('I donate 1 spirit stone to the sect');

        expect(stones(db, cultivator.id), 'took money for a donation it refused').toBe(before);
        expect(acted.narration).toMatch(/worth writing down|where the ledger starts/i);
    }, 120_000);

    it('will not take what is not in the purse', async () => {
        const { db, game, cultivator } = await member('a-rung-is-not-for-sale-purse', 30);
        const before = stones(db, cultivator.id);

        await game.act('I donate 900 spirit stones to the sect');

        expect(stones(db, cultivator.id)).toBe(before);
    }, 120_000);

    it('tells a rogue there is no ledger with their name on it', async () => {
        const { game } = await makeGameInWorld({
            seed: 'a-rung-is-not-for-sale-rogue',
            worldSeed: 'a-rung-is-not-for-sale-rogue-world'
        });
        await game.newRun('Nobody');
        const acted = await game.act('I donate 100 spirit stones to the sect');
        expect(acted.narration).toMatch(/nobody's roll|no ledger/i);
    }, 120_000);
});
