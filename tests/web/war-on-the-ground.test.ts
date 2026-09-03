/**
 * A war is something that happens to the map, and it has to happen to people.
 *
 * Area statuses have been live for a while and the writer works: a place can be
 * at war, in famine, under a beast tide or worked out, and a war on a house's
 * seat is written with `stops: ['passage']`, `priceMultiplier: 2` and
 * `dangerDelta: 0.5`. Played on the seat of one, on this seed, standing in it:
 *
 *     WAR  loc-sect-weir-office-ground
 *     "The Weir Office is fighting The Sixmile Wardens, and The Weir Office
 *      grounds is ground they hold. Nothing goes through it that is not theirs."
 *
 * and then nothing happened. Measured before this file existed: the market
 * quoted a bowl of millet at 1 cash, identical to peacetime; the encounter
 * window rolled at the place's standing danger of 0.15; and `assess` reported
 * the ground wide open. All three fields were read in exactly one place in
 * `src/` and only as a boolean - *is this ground doing something* -
 * and `passageStoppedInArea` had no caller at all.
 *
 * This is `AGENTS.md`'s "a field nothing writes" defect with the arrow
 * reversed: three fields the world writes with real values, that nothing reads.
 * It is worse in the same way, because it reads as a value - the market went on
 * answering with total confidence.
 *
 * So the claims below are about the READERS, not about the writer. Every one is
 * a control arm: the same call, on the same day, with and without the ground.
 */

import { makeGameInWorld } from './harness';
import { worldForRun, advanceWorldForCultivator } from '../../src/server/state/cultivation-world';
import {
    priceMultiplierInArea,
    dangerDeltaInArea,
    passageStoppedInArea,
    stoppedInArea,
    STOPS_PASSAGE
} from '../../src/engine/world/what-is-true-of-a-place-right-now';
import { placeFor } from '../../src/web/encounters';
import { subjectFromLocation } from '../../src/engine/world/capability';
import { whatIsWrongWithThisGround } from '../../src/web/ground-status-lines';
import { factsForLook } from '../../src/web/facts';
import { handleMarket } from '../../src/server/consolidated/cultivation-mortal';
import type { LocationRecord } from '../../src/engine/world/locations';

/**
 * The world's seed, and it is half of the pin.
 *
 * A run seed alone fixes nothing about who is at war with whom - see
 * `makeGameInWorld`. On this world seed The Weir Office and The Sixmile Wardens
 * are openly fighting inside the first advanced year, and each holds a war
 * status on its own seat.
 */
const WORLD = 'war-1';
const SEAT = 'The Weir Office grounds';

async function standingOnAWarSeat() {
    const h = await makeGameInWorld({ seed: 'probe-war', worldSeed: WORLD });
    const { cultivator } = await h.game.newRun('Probe');

    // The world's own pass, a year at a time, until one stands. Nothing here
    // arranges a war: `groundUnderAWar` proposes it off two houses that are
    // actually fighting, and this waits for that to happen.
    let live = false;
    for (let year = 0; year < 40 && !live; year++) {
        const run = h.repos.runs.getActiveRun(cultivator.id)!;
        await advanceWorldForCultivator(run, h.repos.cultivators.getById(cultivator.id)!, 365);
        const world = await worldForRun(run);
        const day = Math.floor(world.currentDay);
        live = world.statuses.some(s => s.kind === 'war' && s.liftedOnDay === null
            && day >= s.beganOnDay && day < s.reviewOnDay);
    }
    expect(live).toBe(true);

    const run = h.repos.runs.getActiveRun(cultivator.id)!;
    const world = await worldForRun(run);
    const day = Math.floor(world.currentDay);
    const seat = world.locations.find(l => l.name === SEAT)!;

    // Somewhere with nothing true of it, for the control arm. Same world, same
    // day, same call - which is the only comparison worth taking while other
    // agents are landing catalog changes.
    const quiet = world.locations.find((l: LocationRecord) =>
        l.id !== seat.id
        && l.kind === 'settlement'
        && !l.sealed
        && l.cycle === null
        && stoppedInArea(world.statuses, world.locations, l.id, day).length === 0
        && priceMultiplierInArea(world.statuses, world.locations, l.id, day) === 1
        && dangerDeltaInArea(world.statuses, world.locations, l.id, day) === 0)!;

    h.db.prepare('UPDATE cultivators SET location = ? WHERE id = ?').run(SEAT, cultivator.id);
    return { ...h, cultivator, world, run, seat, quiet, day };
}

describe('what a war does to the ground it is fought on', () => {
    it('the world writes all three fields, and they are the ones being read', async () => {
        const { world, seat, day } = await standingOnAWarSeat();

        expect(priceMultiplierInArea(world.statuses, world.locations, seat.id, day)).toBe(2);
        expect(dangerDeltaInArea(world.statuses, world.locations, seat.id, day)).toBeCloseTo(0.5, 6);
        expect(stoppedInArea(world.statuses, world.locations, seat.id, day)).toContain(STOPS_PASSAGE);
        expect(passageStoppedInArea(world.statuses, world.locations, seat, day).stopped).toBe(true);
    }, 300_000);

    /**
     * DANGER. `placeFor` is the one place a played turn assesses risk - the
     * encounter window multiplies off this single number and reads nothing else
     * - and it returned `record.environment.danger`, a standing property that
     * does not move.
     */
    it('raises the danger the encounter window rolls against', async () => {
        const { world, seat, quiet, repos, cultivator, db } = await standingOnAWarSeat();
        const base = seat.environment.danger;

        const onTheSeat = placeFor(world, repos.cultivators.getById(cultivator.id)!);
        expect(onTheSeat.id).toBe(seat.id);
        expect(onTheSeat.danger).toBeCloseTo(Math.min(1, base + 0.5), 6);
        expect(onTheSeat.danger).toBeGreaterThan(base);

        // The control arm: nothing true of the ground, nothing added.
        db.prepare('UPDATE cultivators SET location = ? WHERE id = ?').run(quiet.name, cultivator.id);
        const elsewhere = placeFor(world, repos.cultivators.getById(cultivator.id)!);
        expect(elsewhere.id).toBe(quiet.id);
        expect(elsewhere.danger).toBeCloseTo(quiet.environment.danger, 6);
    }, 300_000);

    /**
     * PASSAGE. `windowClosed` was the season's half of "the road in is shut
     * today" and only that half; `passageStoppedInArea` answers both and had no
     * caller anywhere. A house holding its seat against everybody assessed as
     * open ground.
     */
    it('shuts the road in, where the season alone would not', async () => {
        const { world, seat, quiet, day } = await standingOnAWarSeat();
        const ground = { statuses: world.statuses, locations: world.locations };

        expect(subjectFromLocation(seat, day, ground).windowClosed).toBe(true);
        // Same location, same day, without the ground: the old answer.
        expect(subjectFromLocation(seat, day).windowClosed).toBe(false);
        // And the ground does not shut a place nothing is true of.
        expect(subjectFromLocation(quiet, day, ground).windowClosed).toBe(false);
    }, 300_000);

    /**
     * And the board a player actually reads. Measured before: a bowl of millet
     * at 1 cash on a war seat carrying `priceMultiplier: 2`.
     */
    it('is on the market board, and is not on it off the seat', async () => {
        const { cultivator, quiet, db, repos } = await standingOnAWarSeat();
        const millet = (board: any) =>
            board.prices.find((row: any) => row.id === 'price-millet').cash;

        const atWar = await handleMarket({
            action: 'market', category: 'food', cultivatorId: cultivator.id
        } as any) as any;

        db.prepare('UPDATE cultivators SET location = ? WHERE id = ?').run(quiet.name, cultivator.id);
        const atPeace = await handleMarket({
            action: 'market', category: 'food', cultivatorId: repos.cultivators.getById(cultivator.id)!.id
        } as any) as any;

        expect(atWar.groundPriceMultiplier).toBe(2);
        expect(atPeace.groundPriceMultiplier).toBe(1);
        expect(millet(atWar)).toBe(millet(atPeace) * 2);
    }, 300_000);

    /**
     * And the read `investigate` had and `look` did not, now in one place both
     * can call. Standing in a thing is encountering it, so the signs are
     * available without a knowledge row; the CAUSE still is not.
     */
    it('gives somebody standing in it the statement and the signs, and not the cause', async () => {
        const { world, seat, day } = await standingOnAWarSeat();

        const standing = whatIsWrongWithThisGround({
            statuses: world.statuses,
            locations: world.locations,
            locationId: seat.id,
            day,
            heldStage: 'unaware',
            standingHere: true
        });
        expect(standing.stage).toBe('encountered');
        expect(standing.running).toBe(1);
        expect(standing.lines.length).toBeGreaterThan(3);

        // Asking after it from somewhere else, having heard nothing: nothing.
        const askedAfter = whatIsWrongWithThisGround({
            statuses: world.statuses,
            locations: world.locations,
            locationId: seat.id,
            day,
            heldStage: 'unaware',
            standingHere: false
        });
        expect(askedAfter.lines).toEqual([]);

        // And knowing more than being-in-it grants is still capped there: the
        // cause has to come from somebody who has it.
        const capped = whatIsWrongWithThisGround({
            statuses: world.statuses,
            locations: world.locations,
            locationId: seat.id,
            day,
            heldStage: 'known',
            standingHere: true
        });
        expect(capped.stage).toBe('encountered');
        expect(capped.lines).toEqual(standing.lines);
    }, 300_000);

    /**
     * AND THE VERB A PLAYER ACTUALLY TYPES.
     *
     * The case above proves the module answers. This proves somebody reaches
     * it. `ground-status-lines.ts` was extracted so `look` and `investigate`
     * could not answer one question two ways, and then had NO CALLER IN `src/`
     * at all, while `investigate` went on carrying a verbatim copy. Measured
     * before this, standing on the seat of a live war with passage stopped,
     * prices doubled and the danger up by half:
     *
     *     "It is an ordinary day and it intends to stay one."
     *
     * A control arm on the same world and the same day, because a look that
     * reports a war everywhere is not reading anything either.
     */
    it('says so when somebody standing on it just looks around', async () => {
        const { db, game, cultivator, quiet } = await standingOnAWarSeat();

        const onTheSeat = await game.act('I look around');
        expect(onTheSeat.narration).toMatch(/fighting/i);
        expect(logOf(onTheSeat)).toMatch(/whatIsWrongWithThisGround: [1-9]/);

        // The same sentence, the same day, somewhere nothing is true of.
        db.prepare('UPDATE cultivators SET location = ? WHERE id = ?')
            .run(quiet.name, cultivator.id);
        const elsewhere = await game.act('I look around');
        expect(elsewhere.narration).not.toMatch(/fighting/i);
        expect(logOf(elsewhere)).toMatch(/whatIsWrongWithThisGround: 0 line/);
    }, 300_000);

    /**
     * AND IT DOES NOT SAY BOTH THINGS AT ONCE.
     *
     * Wiring the read exposed the other half. `selfNoticing` closes a look by
     * saying nothing is wrong when the PERSON is fine - which is a claim about
     * the GROUND, made by a function that has never read it. So the first
     * build of the case above printed, in one paragraph:
     *
     *     It is an ordinary day and it intends to stay one.
     *     The Weir Office is fighting The Sixmile Wardens...
     *
     * "Nothing lies or contradicts itself" is a floor at every reading tier,
     * and this is the deterministic one: no model is involved in the defect or
     * in the fix.
     */
    it('does not call the day ordinary in the same breath as the war', async () => {
        const { game, repos, cultivator } = await standingOnAWarSeat();

        const onTheSeat = await game.act('I look around');
        expect(onTheSeat.narration).not.toMatch(QUIET_DAY_LINE);

        // THE CONTROL, and it is a differential rather than a second square:
        // somebody who has been advanced forty years carries stagnation notes
        // of their own, and those suppress the fallback everywhere. The claim
        // is that the GROUND is what suppresses it, so the arms are the same
        // person on the same day with only `groundIsQuiet` moved.
        const sheet = repos.cultivators.getById(cultivator.id)!;
        const rested = { ...sheet, yearsAtCurrentRealm: 0, hp: sheet.maxHp, injuries: [] };
        expect(factsForLook(rested, 'normal', undefined, null, true).prose)
            .toMatch(QUIET_DAY_LINE);
        expect(factsForLook(rested, 'normal', undefined, null, false).prose)
            .not.toMatch(QUIET_DAY_LINE);
    }, 300_000);
});

/** The five ways `selfNoticing` says nothing is wrong. */
const QUIET_DAY_LINE =
    /ordinary day|Nothing about the day is urgent|day asks nothing|going wrong at any speed|Nothing is pressing/i;

/** Every engine row this turn wrote, which is where `structure` lands. */
function logOf(result: { state: { log: Array<{ role: string; text: string }> } }): string {
    return result.state.log.filter(e => e.role === 'engine').map(e => e.text).join('\n');
}
