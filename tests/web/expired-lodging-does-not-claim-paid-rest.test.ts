/**
 * Measured recovery, 2026-10-07: paid inn coverage expires while a
 * remembered lodging address remains. Ordinary waiting labels the actual
 * narrator facts "Rest at the inn" from the address, although the existing
 * weather authority treats those nights as unpaid/open.
 *
 * Expiry03 native11245 measured the WRONG observer: the unpaid test passed
 * and renewed failed because the engine LOG HEADLINE says "2 days of it..."
 * for both labels. timeSkipHeadline deliberately omits non-seclusion labels.
 * The label actually reaches facts.lines and facts.prose. Successor05 reads
 * that real narrated-fact boundary using a call-through spy; it changes only
 * those two observers, leaving the clock/weather/body/room-address controls.
 * Diagnostic04 native14544 preserved the old assertions and measured the
 * actual contradiction: paid-through day 1, wait starts at run day 2.708333;
 * narrator facts say Rest at the inn, while 30 nights in the open cost 14 HP
 * (40 to 26), and returned narration still says Rest at the inn of 30 days.
 * The renewed two-day control correctly says Rest, without exposure.
 *
 * This asks for an honest emitted fact, not eviction: expiry must not move
 * the guest, remove remembered room identity/belongings, or invent a lock.
 * Renewal uses the same actual counter and coverage authority. No model
 * prose acceptance is established by these native checks.
 */
import { describe, expect, it, vi } from 'vitest';
import { makeGameInWorld } from './harness';
import { takeARoom, whereTheyAreLodged } from '../../src/web/a-room-at-an-inn';
import { theAreaTheyAreIn, theAreaNamed } from '../../src/web/walking-across-a-place';
import { peopleInThisPlace } from '../../src/web/hearsay';

async function bookedGuest() {
    const fixture = await makeGameInWorld({ seed: 'road-5', worldSeed: 'road-world' });
    const { game, repos, db } = fixture;
    const narrated = vi.spyOn(fixture.narrator, 'narrate');
    const opened = await game.newRun('Lodging coverage guest');
    const keeper = repos.cultivators.create({ ...opened.cultivator,
        id: 'lodging-coverage-keeper', name: 'Lodging coverage keeper', kind: 'npc' });
    game.atHand!.npcs = [];
    game.theWorldMoved();
    db.prepare('UPDATE cultivators SET spirit_stones = 1000 WHERE id = ?').run(opened.cultivator.id);
    const guest = repos.cultivators.getById(opened.cultivator.id)!;
    const at = theAreaTheyAreIn(game.atHand, guest)!;
    const inn = theAreaNamed(peopleInThisPlace(repos, guest, game.atHand!, at.place).areas, 'inn')!;
    repos.cultivators.standIn(keeper.id, inn.id);
    const booking = await takeARoom(game, game.currentRun().run, guest, 1);
    expect(booking.outcome).toBe('executed');
    const covered = whereTheyAreLodged(game, game.currentRun().cultivator)!;
    expect(covered.paidThroughDay).toBeGreaterThan(game.currentRun().run.elapsedDays);
    await game.act('I wait two days');
    expect(game.currentRun().run.elapsedDays).toBeGreaterThanOrEqual(covered.paidThroughDay);
    return { ...fixture, covered, narrated };
}

describe('an expired remembered lodging address is not paid coverage', () => {
    it('ordinary unpaid waiting does not claim rest at the inn, and keeps the existing exposure result', async () => {
        const { game, covered, narrated } = await bookedGuest();
        const before = game.currentRun();
                const done = await game.act('I wait thirty days');
        const after = game.currentRun();
        const facts = narrated.mock.calls.at(-1)?.[0];
        expect(facts, 'the actual narration boundary receives the real waiting facts').toBeDefined();
        
        expect(facts!.lines.join('\n')).not.toContain('Rest at the inn');
        expect(facts!.prose).not.toContain('Rest at the inn');
        expect(done.narration).not.toContain('Rest at the inn');
        expect(after.run.elapsedDays - before.run.elapsedDays).toBeCloseTo(30);
        expect(after.cultivator.hp).toBeLessThan(before.cultivator.hp);
        expect(done.narration).toMatch(/nights? in the open (?:has|have) worn the body/);
        expect(after.cultivator.location).toBe(before.cultivator.location);
        expect(after.cultivator.standingIn).toBe(before.cultivator.standingIn);
        // Retained address is harmless; this proposal does not rewrite tenancy.
        expect(whereTheyAreLodged(game, after.cultivator)).toEqual(covered);
    }, 120_000);

    it('renewed actual counter coverage still roofs the ordinary wait', async () => {
        const { game, narrated } = await bookedGuest();
        const beforeBooking = game.currentRun();
        const renewed = await takeARoom(game, beforeBooking.run, beforeBooking.cultivator, 3);
        expect(renewed.outcome).toBe('executed');
        const before = game.currentRun();
        expect(before.cultivator.spiritStones).toBeLessThan(beforeBooking.cultivator.spiritStones);
                const done = await game.act('I wait two days');
        const after = game.currentRun();
        const facts = narrated.mock.calls.at(-1)?.[0];
        expect(facts, 'the actual narration boundary receives the real waiting facts').toBeDefined();
        
        expect(facts!.lines.join('\n')).toContain('Rest at the inn');
        expect(facts!.prose).toContain('Rest at the inn');
        expect(done.narration).toContain('Rest at the inn');
        expect(after.run.elapsedDays - before.run.elapsedDays).toBeCloseTo(2);
        expect(after.cultivator.hp).toBe(before.cultivator.hp);
        expect(done.narration).not.toMatch(/in the open (?:has|have) worn the body/);
        expect(after.cultivator.location).toBe(before.cultivator.location);
    }, 120_000);
});
