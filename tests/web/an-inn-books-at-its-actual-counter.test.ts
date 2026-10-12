/** Diagnostic05 measured baseline19 PASS versus candidate10 PASS/9 FAIL. Three
 * approach assertions inherited the opening player's area: baseline market,
 * candidate already in the inn, so the latter correctly spent only .125 to
 * buy and refused absent payment without another walk. These approach fixtures
 * now explicitly start on a real street; no product walk is forced or waived.
 * Six ordinary rental failures remain separate, with their original setup. */
/** Diagnostic04: paired03 proved baseline19 PASS versus candidate10 PASS/9 FAIL,
 * with frozen integrity, but the JSON reporter captured no console observations.
 * This file sink supplies actual setup/receipt evidence; assertions remain unchanged. */
import { appendFileSync } from 'node:fs';
/**
 * Recovered played-place audit, 2026-10-03: takeARoom let an absent
 * counterperson take payment, discarded that payment rather than crediting
 * anyone, and sold from a street/deck. Hourly dawn waits returned before the
 * rental guard. Canonical counters are assigned to real present people; they
 * are not a separate seeded innkeeper job. These fixtures isolate that authority
 * using one guest newRun and an ordinary repository NPC created from its
 * native sheet shape, and remove ambient world people. The old two-newRun
 * fixture violated the no-abandon rule before reaching the counter; this repair
 * gives the keeper no player run, service job, special payment store or exemption.
 * New booking pays the actual .25-day walk plus .125-day purchase; coverage
 * is read at arrival. Held coverage needs neither a provider nor another trip.
 * Refused rental keeps its real approach but cannot turn into a night's sleep.
 */
import { describe, expect, it } from 'vitest';
// The world-off booking charged a bed without any keeper. Repository people
// can be read in that tier; payment still requires an actual living person.
import { makeGame, makeGameInWorld } from './harness';
import { takeARoom, whereTheyAreLodged } from '../../src/web/a-room-at-an-inn';
import { theAreaTheyAreIn, theAreaNamed } from '../../src/web/walking-across-a-place';
import { peopleInThisPlace } from '../../src/web/hearsay';
import { LESSER_ACTION_DAYS } from '../../src/web/lesser-action-costs';


function recordStaffInnDiagnostic(value: unknown): void {
    const target = process.env.RPG_STAFF_INN_DIAGNOSTIC_PATH;
    if (target) appendFileSync(target, JSON.stringify(value) + '\n', 'utf8');
}

async function arrangement(world: boolean, provider = true) {
    const fixture = world ? await makeGameInWorld({ seed: 'road-5', worldSeed: 'road-world' }) : makeGame({ seed: 'road-5' });
    const { game, repos, db } = fixture;
    const opened = await game.newRun('Guest fixture');
    const keeper = provider ? repos.cultivators.create({ ...opened.cultivator,
        id: 'counter-fixture', name: 'Counter fixture', kind: 'npc' }) : null;
    // The provider is a real repository person, placed in this actual inn area;
    // no service-specific person, private inventory or price is fabricated.
    if (game.atHand) { game.atHand.npcs = []; game.theWorldMoved(); }
    db.prepare('UPDATE cultivators SET spirit_stones = 1000 WHERE id = ?').run(opened.cultivator.id);
    let guest = repos.cultivators.getById(opened.cultivator.id)!;
    if (keeper) {
        db.prepare('UPDATE cultivators SET location = ? WHERE id = ?').run(guest.location, keeper.id);
        const at = theAreaTheyAreIn(game.atHand, guest);
        if (at && game.atHand) {
            const inn = theAreaNamed(peopleInThisPlace(repos, guest, game.atHand, at.place).areas, 'inn')!;
            repos.cultivators.standIn(keeper.id, inn.id);
        }
    }
    if(game.atHand){
        const at=theAreaTheyAreIn(game.atHand,guest);
        if(!at)throw new Error('Actual guest has no public approach ground');
        const street=peopleInThisPlace(repos,guest,game.atHand,at.place).areas.find(area=>area.for==='street');
        if(!street)throw new Error('Actual inn town has no street approach');
        repos.cultivators.standIn(guest.id,street.id);
        guest=repos.cultivators.getById(guest.id)!;
    }
    const actualAt = theAreaTheyAreIn(game.atHand, guest);
    recordStaffInnDiagnostic({ staff08InnDiagnostic: 'before booking', world, provider,
        body: { location: guest.location, standingIn: guest.standingIn },
        at: actualAt, areas: actualAt && game.atHand ? peopleInThisPlace(repos, guest, game.atHand, actualAt.place).areas : null,
        keeper: keeper && repos.cultivators.getById(keeper.id), clock: game.currentRun().run.elapsedDays });
    return { ...fixture, keeper, guest, run: game.currentRun().run };
}

describe('a room is bought from the actual inn counter', () => {
    it('pays a real repository keeper in the world-off tier, and never invents an absent one', async () => {
        const { game, repos, keeper, guest, run } = await arrangement(false);
        const before = repos.cultivators.getById(keeper!.id)!.spiritStones + guest.spiritStones;
        const booked = await takeARoom(game, run, guest, 2);
        recordStaffInnDiagnostic({ staff08InnDiagnostic: 'booking receipt', booked, body: repos.cultivators.getById(guest.id), clock: game.currentRun().run.elapsedDays });
        expect(booked.outcome).toBe('executed');
        const paid = guest.spiritStones - repos.cultivators.getById(guest.id)!.spiritStones;
        expect(paid).toBeGreaterThan(0);
        expect(repos.cultivators.getById(keeper!.id)!.spiritStones + repos.cultivators.getById(guest.id)!.spiritStones).toBe(before);
        const absent = await arrangement(false, false);
        const refused = await takeARoom(absent.game, absent.run, absent.guest, 1);
        expect(refused.outcome).toBe('refused');
        expect(whereTheyAreLodged(absent.game, absent.guest)).toBeNull();
        expect(absent.repos.cultivators.getById(absent.guest.id)!.spiritStones).toBe(absent.guest.spiritStones);
    });

    it('walks to the actual counter and pays exactly that keeper, then coverage is a free no-op even elsewhere', async () => {
        const { game, repos, db, keeper, guest, run } = await arrangement(true);
        const before = repos.cultivators.getById(keeper!.id)!.spiritStones;
        const booked = await takeARoom(game, run, guest, 3);
        recordStaffInnDiagnostic({ staff08InnDiagnostic: 'booking receipt', booked, body: repos.cultivators.getById(guest.id), clock: game.currentRun().run.elapsedDays });
        expect(booked.outcome).toBe('executed');
        expect(booked.calls.some(c => c.name === 'world.walkAcrossThePlace')).toBe(true);
        expect(repos.runs.getById(run.id)!.elapsedDays - run.elapsedDays).toBeCloseTo(LESSER_ACTION_DAYS.move + LESSER_ACTION_DAYS.buy);
        const current = repos.cultivators.getById(guest.id)!;
        expect(repos.cultivators.getById(keeper!.id)!.spiritStones - before).toBe(guest.spiritStones - current.spiritStones);
        expect(current.standingIn).toBe(repos.cultivators.getById(keeper!.id)!.standingIn);
        db.prepare('UPDATE cultivators SET alive = 0 WHERE id = ?').run(keeper!.id);
        repos.cultivators.standIn(guest.id, null);
        const clock = repos.runs.getById(run.id)!;
        const again = await takeARoom(game, clock, repos.cultivators.getById(guest.id)!, 3);
        expect(again.timeDisposition).toBe('no_op');
        expect(repos.runs.getById(run.id)!.elapsedDays).toBe(clock.elapsedDays);
        expect(repos.cultivators.getById(guest.id)!.spiritStones).toBe(current.spiritStones);
    });

    it('reads paid-through from the arrival day when the approach crosses midnight', async () => {
        const { game, repos, guest, run } = await arrangement(true);
        repos.runs.advanceDays(run.id, .9);
        game.atHand!.currentHour = 23; game.theWorldMoved();
        const start = repos.runs.getById(run.id)!;
        const booked = await takeARoom(game, start, guest, 2);
        recordStaffInnDiagnostic({ staff08InnDiagnostic: 'booking receipt', booked, body: repos.cultivators.getById(guest.id), clock: game.currentRun().run.elapsedDays });
        expect(booked.outcome).toBe('executed');
        const lodging = whereTheyAreLodged(game, repos.cultivators.getById(guest.id)!)!;
        expect(lodging.paidThroughDay).toBe(Math.floor(start.elapsedDays + LESSER_ACTION_DAYS.move) + 2);
        expect(booked.facts.lines.join(' ')).toContain(`through day ${lodging.paidThroughDay}`);
    });

    it.each(['I stay at the inn for one night', 'I sleep at the inn until dawn'])('does not sleep after an absent-counter refusal: %s', async said => {
        const { game, repos, guest, run } = await arrangement(true, false);
        const result = await game.act(said);
        expect(result.narration).toMatch(/Nobody.*(?:keeping|take payment)/i);
        expect(repos.runs.getById(run.id)!.elapsedDays - run.elapsedDays).toBeCloseTo(LESSER_ACTION_DAYS.move);
        expect(whereTheyAreLodged(game, repos.cultivators.getById(guest.id)!)).toBeNull();
        expect(repos.cultivators.getById(guest.id)!.spiritStones).toBe(guest.spiritStones);
    });
});
