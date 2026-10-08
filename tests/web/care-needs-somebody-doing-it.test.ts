/**
 * `treat` used to charge for an imaginary physician at any location, including
 * a house's yard and uninhabited ground. Care now needs an actual working
 * practitioner beside the patient. The existing grade, month and price remain;
 * a refusal leaves the player's purse, wounds and clock unchanged. Service
 * fees reach the person who provided the care rather than disappearing.
 * The actual-clock death case reached interrupted care but its fallback receipt
 * omitted the provider/paid-fee explanation, because it lived only in fact lines.
 * A failed paid course must say what happened even without model narration.
 * Model probe 05 asked about travellers' care but received a house ladder:
 * clinical information now reaches the same actual provider and local price as
 * treatment. Quoting it spends no purse, health, provider wealth or clock; the
 * eventual payment must match the quoted fee, rather than another price table.
 */
import { describe, expect, it } from 'vitest';
import { atAWorkingPhysician } from './at-a-working-physician.js';
import { makeLocation } from '../../src/engine/world/locations.js';
import { askingAboutCareHere } from '../../src/web/asking-about-the-care-actually-offered-here.js';

describe('a month of care needs its physician', () => {
    it('cannot spend the same few stones on both the fee and food', async () => {
        // Read the existing care receipt, rather than duplicate local price math.
        const quoted = await atAWorkingPhysician('care-finite-purse-quote');
        quoted.db.prepare('UPDATE cultivators SET hp = 1, spirit_stones = 500 WHERE id = ?').run(quoted.cultivator.id);
        const bought = await quoted.game.act('I get my injuries treated');
        const quote = bought.toolCalls.find(c => c.name === 'cultivator.applyDeltas' && c.action === 'treat')!;
        expect(quote, bought.narration).toBeDefined();
        const purse = Number(/= (\d+) stones/.exec(quote.summary)![1]);
        quoted.db.close();
        const h = await atAWorkingPhysician('care-finite-purse');
        h.db.prepare('UPDATE cultivators SET hp = 1, spirit_stones = ? WHERE id = ?').run(purse, h.cultivator.id);
        const heldByPhysician = h.physician.spiritStones;
        const turn = await h.game.act('I get my injuries treated');
        const receipt = turn.toolCalls.find(c => c.name === 'cultivator.applyDeltas' && c.action === 'treat');
        expect(receipt, turn.narration).toBeDefined();
        const fee = Number(/= (\d+) stones/.exec(receipt!.summary)![1]);
        const foodReceipt = turn.toolCalls.find(c => c.action === 'buy_provisions')!;
        const food = Number(/(?:bought|was bought) for (\d+) spirit stones/.exec(foodReceipt.summary)?.[1] ?? 0);
        expect(fee).toBeGreaterThan(0);
        expect(fee + food).toBeLessThanOrEqual(purse);
        expect(fee).toBe(purse);
        expect(h.game.atHand!.npcs.find(n => n.id === h.physician.id)!.spiritStones - heldByPhysician).toBe(fee);
        expect(fee + food + h.game.state().cultivator.spiritStones).toBe(purse);
    }, 120_000);
    it('pays the real physician and spends the existing month under care', async () => {
        const h = await atAWorkingPhysician('care-provider-fee');
        h.db.prepare('UPDATE cultivators SET hp = 1, spirit_stones = 500 WHERE id = ?').run(h.cultivator.id);
        const before = h.physician.spiritStones;
        const preceding = h.physician.activity;
        const days = h.game.state().run.elapsedDays;
        const patient = h.repos.cultivators.getById(h.cultivator.id)!;
        const provider = h.game.present(patient).find(n => n.id === h.physician.id)!;
        const snapshot = JSON.stringify({ patient: h.game.state().cultivator, days, purse: h.physician.spiritStones, activity: preceding });
        const quote = h.game.askAround(h.game.currentRun().run, patient, provider,
            'Hello, what is your name and what medical care do you offer travellers?', h.game.scopeFor(patient));
        expect(quote.facts.prose).toContain('mortal-grade care');
        expect(quote.facts.prose).toContain(h.physician.name);
        const feeQuoted = Number(/ordinary bodily care costs (\d+) spirit stones/.exec(quote.facts.prose)?.[1]);
        expect(feeQuoted).toBeGreaterThan(0);
        expect(JSON.stringify({ patient: h.game.state().cultivator, days: h.game.state().run.elapsedDays,
            purse: h.physician.spiritStones, activity: preceding })).toBe(snapshot);
        const turn = await h.game.act('I get my injuries treated');
        expect(turn.toolCalls.some(c => c.name === 'engine.mortalCare' && c.ok), turn.narration).toBe(true);
        const afterProvider = h.game.atHand!.npcs.find(n => n.id === h.physician.id)!;
        expect(afterProvider.spiritStones - before).toBe(feeQuoted);
        expect(afterProvider.activity).toEqual(preceding);
        expect(h.game.state().run.elapsedDays - days).toBeGreaterThanOrEqual(30);
    }, 120_000);

    it('lets the real clock end the physician\'s life during paid care without granting a completed treatment', async () => {
        const h = await atAWorkingPhysician('care-provider-span-ends');
        h.db.prepare('UPDATE cultivators SET hp = 1, spirit_stones = 500 WHERE id = ?').run(h.cultivator.id);
        h.physician.cultivation.lifespanEndsOnDay = h.world.currentDay + 1;
        h.game.theWorldMoved();
        const before = h.game.state();
        const turn = await h.game.act('I get my injuries treated');
        expect(turn.toolCalls.some(c => c.name === 'engine.mortalCare' && c.ok)).toBe(false);
        expect(turn.narration).toMatch(/unfinished care|no longer seeing to patients/i);
        expect(h.game.state().cultivator.spiritStones).toBeLessThan(before.cultivator.spiritStones);
        expect(h.game.state().run.elapsedDays).toBeGreaterThan(before.run.elapsedDays);
        expect(h.game.atHand!.npcs.find(n => n.id === h.physician.id)?.status).not.toBe('alive');
    }, 120_000);

    for (const absence of ['dead', 'eating', 'elsewhere'] as const) {
        it(`does not buy care when the physician is ${absence}`, async () => {
            const h = await atAWorkingPhysician(`care-provider-${absence}`);
            h.db.prepare('UPDATE cultivators SET hp = 1, spirit_stones = 500 WHERE id = ?').run(h.cultivator.id);
            if (absence === 'dead') h.physician.status = 'physically_dead';
            if (absence === 'eating') h.physician.activity = { kind: 'at_a_table', note: 'Eating.', withIds: [],
                sinceDay: h.world.currentDay, untilDay: h.world.currentDay + 1 };
            if (absence === 'elsewhere') {
                const elsewhere = makeLocation({ id: 'fixture-away-clinician', name: 'Away ground', kind: 'wilds' });
                h.world.locations.push(elsewhere);
                h.physician.locationId = elsewhere.id;
            }
            h.game.theWorldMoved();
            const before = h.game.state();
            expect(askingAboutCareHere(h.game, before.cultivator, h.physician.id,
                'What medical care is offered here?')).toBeNull();
            const turn = await h.game.act('I get my injuries treated');
            expect(turn.toolCalls.some(c => c.name === 'engine.mortalCare' && c.ok)).toBe(false);
            expect(h.game.state().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
            expect(h.game.state().run.elapsedDays).toBe(before.run.elapsedDays);
        }, 120_000);
    }
});
