/**
 * The three ways of covering ground that are not walking, reached by typing.
 *
 * Every module behind these verbs was complete, tested and had no caller in
 * `src/`. Two of them recorded their own gap in their own file, and one of
 * those named the handler it needed:
 *
 *   `how-far-somebody-can-fold-space-and-what-it-costs.ts` - the range curve
 *   off the rung, the two fixes and only two, the quadratic settling.
 *   `FOLD_TRAVEL_ENGINE_GAP` says a saving cannot be shown to a player without
 *   printing a number the engine does not charge.
 *   `buying-passage-at-a-measured-span-counter.ts` - the board, the fare, the
 *   settling a passenger pays for not understanding what moved them.
 *   `what-a-conveyance-does-to-a-journey.ts` - a mount, a drawn carriage, a
 *   spirit boat, flight on one's own blade, and what a watcher at the far gate
 *   reads off each.
 *
 * WHAT THIS FILE PINS, AND WHY EACH ONE IS A DECISION RATHER THAN A NUMBER:
 *
 *   THE ROAD IS PAID. `move` spent a flat day for every journey to anywhere
 *   while `destinations` printed the catalog's `travelDays` beside each
 *   province - so the game told a player Kettle was eleven days away and then
 *   took them there in one. Every verb here goes through one reader of that
 *   figure, so a fold that saves ten days saves ten days that were spent.
 *
 *   A FOLD NEEDS A FIX AND BEING TOLD IS NOT ONE. There are exactly two and
 *   both are things the folder did themselves. A third for having heard about
 *   somewhere would delete the Measured Span's entire business and the Late Age
 *   premise it expresses, so it is asserted here rather than left to a comment.
 *
 *   THE BOARD IS THE MORE IMPORTANT HALF OF THE COUNTER. Reading one writes a
 *   `read` knowledge record against every destination on it, which reaches
 *   `placed` - the exact rung that makes a province a legal destination. That
 *   is how somebody who has never left their province finds out there are
 *   others, and it is asserted against the knowledge rows rather than against
 *   the prose.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld, cultivatorRow } from './harness';
import { parseIntent } from '../../src/web/actions';
import { KnowledgeGate } from '../../src/web/knowledge';
import {
    FOLD_FLOOR_ORDINAL,
    foldRangeInWalkingDays
} from '../../src/engine/world/how-far-somebody-can-fold-space-and-what-it-costs';
import {
    SPAN_ROUTES,
    routeTo,
    thereIsACounterAt
} from '../../src/engine/world/where-the-measured-span-still-answers';
import { REGIONS, requireRegion, HOME_REGION_ID, ADJACENT_REGION_ID } from '../../src/data/cultivation/regions';

/** A run standing somewhere named, with every place nameable. */
async function standingAt(place: string, seed: string) {
    process.env.ADMIN_MODE = 'true';
    const harness = await makeGameInWorld({
        seed, worldSeed: `${seed}-world`, adminMode: true
    });
    const { cultivator } = await harness.game.newRun('Lin Baoqing');
    await harness.game.act('ADMIN grant_knowledge kind=place');
    await harness.game.act(`ADMIN set_location location=${place}`);
    return { ...harness, cultivatorId: cultivator.id };
}

describe('the road is as long as the catalog says it is', () => {
    /**
     * The figure this rests on, taken from the catalog rather than restated:
     * the border road from the Low Fall to the Quiet Marches. If somebody
     * re-prices that road this test moves with it rather than going stale.
     */
    const BORDER_ROAD = requireRegion(HOME_REGION_ID).connections
        .filter(link => link.otherRegionId === ADJACENT_REGION_ID)
        .reduce((shortest, link) => Math.min(shortest, link.travelDays), Number.MAX_SAFE_INTEGER);

    it('spends the stated road on a journey between provinces', async () => {
        const { game, db, cultivatorId } = await standingAt('Scarwater', 'road-paid');

        const result = await game.act('I travel to Kettle');
        const after = cultivatorRow(db, cultivatorId);

        expect(BORDER_ROAD).toBeGreaterThan(1);
        expect(after.location).toMatch(/kettle/i);
        // Age is in years and a road is in days, so the day count is read off
        // the engine's own account of the skip rather than off the row.
        const skip = result.toolCalls.find(call => call.name === 'engine.simulateTimeSkip');
        expect(skip?.summary, 'the journey did not report the days it spent').toMatch(
            new RegExp(`\\b${BORDER_ROAD}\\b`)
        );
    }, 120_000);

    it('still spends the short day where the catalog prices no road', async () => {
        // Nothing anywhere prices a road between two settlements of one
        // province, and a fabricated number would be a figure a player plans
        // around. Inside a province the flat day stands, deliberately.
        const { game } = await standingAt('Scarwater', 'road-unpriced');
        const result = await game.act('I travel to Sweptground');
        const skip = result.toolCalls.find(call => call.name === 'engine.simulateTimeSkip');
        expect(skip?.summary).toMatch(/\b1 day\b/i);
    }, 120_000);
});

describe('folding space', () => {
    it('is refused below the floor, as a distance and not as a ban', async () => {
        const { game } = await standingAt('Scarwater', 'fold-floor');
        const result = await game.act('I fold space to Kettle');
        expect(result.narration).toMatch(/space does not fold for them|it is a road/i);
        // A refusal with no cost attached is a ban. This one names the road.
        expect(result.narration).toMatch(/road/i);
    }, 120_000);

    /**
     * THE RULE THIS PINS IS THE ONE THAT WAS MEASURED WRONG FIRST.
     *
     * A fold needs a fix and being told is not one. The first build read the
     * second fix off the sight horizon, and the horizon dwarfs the range at
     * every rung on the curve - 78.7 days of sight against 6.0 of reach at the
     * floor - so every destination inside a fold's range was inside the
     * horizon, the check was a no-op, and anybody above the floor had a fix on
     * every name they had ever heard. That is the third fix the module forbids,
     * and it would delete the Measured Span's whole business.
     */
    it('refuses a place they have only been told about, whatever their rung', async () => {
        const { game } = await standingAt('Scarwater', 'fold-no-fix');
        await game.act(`ADMIN set_realm ordinal=${FOLD_FLOOR_ORDINAL + 8}`);
        // Every place is nameable and none has been stood in. Being told about
        // somewhere is not a fix and never becomes one.
        const result = await game.act('I fold space to Kettle');
        expect(result.narration).toMatch(/a fold is not a survey|know the name and not the place/i);
    }, 120_000);

    it('carries somebody to ground they have stood on, and charges the settling', async () => {
        const { game, db, cultivatorId } = await standingAt('Scarwater', 'fold-stood');
        // Standing somewhere is what buys a `stood` fix, and it is the only
        // thing that does. Walk it once, walk back, then step it.
        await game.act('I travel to Kettle');
        await game.act('I travel to Scarwater');
        await game.act(`ADMIN set_realm ordinal=${FOLD_FLOOR_ORDINAL + 8}`);

        const result = await game.act('I fold space to Kettle');
        expect(cultivatorRow(db, cultivatorId).location).toMatch(/kettle/i);

        const priced = result.toolCalls.find(call => call.name === 'engine.priceFold');
        expect(priced?.ok).toBe(true);
        expect(priced?.summary).toMatch(/stood fix/);
        // It is the loudest arrival in the world, and the sentence saying so is
        // engine-authored rather than narrated.
        expect(result.narration).toMatch(/were not on the road|nobody passed them/i);
    }, 180_000);

    it('reaches further at every rung above the floor, with no exceptions', () => {
        // The curve is the whole of what the ordinal buys and there is no other
        // threshold in the module. Asserted here because a decision that lives
        // only as a growth constant is a decision nobody reads twice.
        for (let ordinal = FOLD_FLOOR_ORDINAL; ordinal < 44; ordinal++) {
            expect(foldRangeInWalkingDays(ordinal + 1))
                .toBeGreaterThan(foldRangeInWalkingDays(ordinal));
        }
        expect(foldRangeInWalkingDays(FOLD_FLOOR_ORDINAL - 1)).toBe(0);
    });
});

describe('a Measured Span counter', () => {
    it('keeps counters only where the catalog puts the house', () => {
        // The absence is the information: what is not on a board is where the
        // inherited survey stops. Every counter here is a place the region
        // catalog names, and no route goes anywhere the catalog does not.
        const everyPlace = new Set(
            REGIONS.flatMap(region => region.places.map(place => place.name))
        );
        for (const route of SPAN_ROUTES) {
            expect(everyPlace.has(route.fromPlace) || route.fromPlace === 'Low Fall',
                `${route.fromPlace} is not a place in the catalog`).toBe(true);
            expect(everyPlace.has(route.toPlace) || route.toPlace === 'Low Fall',
                `${route.toPlace} is not a place in the catalog`).toBe(true);
        }
        expect(thereIsACounterAt('Scarwater')).toBe(true);
        expect(thereIsACounterAt('Wheatgate')).toBe(false);
        expect(routeTo('Scarwater', 'Kettle')).not.toBeNull();
    });

    it('says so where there is no counter, and says what that means', async () => {
        const { game } = await standingAt('Wheatgate', 'span-none');
        const result = await game.act('what does the Span board say');
        expect(result.narration).toMatch(/keeps no counter here|no board to read/i);
        // Not the house being unhelpful. Where an inherited survey stops.
        expect(result.narration).toMatch(/survey stops|where it runs from/i);
    }, 120_000);

    /**
     * THE DISCOVERABILITY HALF, and the reason this verb matters more than the
     * travel does.
     *
     * Asserted against the knowledge rows rather than against the prose,
     * because the claim is about what the player may now DO: `read` reaches
     * `placed`, and `placed` is `REACHABLE_FROM` - the rung at which `move`
     * stops refusing a destination.
     */
    it('a board read teaches every destination on it, at the rung that licenses travel', async () => {
        // Deliberately NOT `ADMIN grant_knowledge`: this run has to learn
        // Kettle from the board or the claim is meaningless.
        process.env.ADMIN_MODE = 'true';
        const { game, db } = await makeGameInWorld({
            seed: 'span-board', worldSeed: 'span-board-world', adminMode: true
        });
        const { cultivator } = await game.newRun('Lin Baoqing');
        await game.act('ADMIN set_location location=Scarwater');
        const gate = new KnowledgeGate(db);

        const before = gate.stageOf(cultivator.id, 'place', 'Kettle');
        await game.act('what does the Span board say');
        const after = gate.stageOf(cultivator.id, 'place', 'Kettle');

        expect(before).toBe('unaware');
        // `read` reaches `placed`, and `placed` is `REACHABLE_FROM`: the rung
        // at which `move` stops refusing a destination. A place read off a
        // board is a place HEARD ABOUT and not a place stood in, which is why
        // it is not `known` and why a fold still refuses to aim at it.
        expect(after, 'reading the board taught nothing').toBe('placed');
        expect(gate.canPointAt(cultivator.id, 'place', 'Kettle')).toBe(true);
    }, 180_000);

    it('sells a crossing, charges the fare, and moves the body', async () => {
        const { game, db, cultivatorId } = await standingAt('Scarwater', 'span-buy');
        db.prepare('UPDATE cultivators SET spirit_stones = 400 WHERE id = ?').run(cultivatorId);

        const before = cultivatorRow(db, cultivatorId);
        const result = await game.act('I buy passage to Kettle');
        const after = cultivatorRow(db, cultivatorId);

        expect(after.location).toMatch(/kettle/i);
        expect(after.spirit_stones).toBeLessThan(before.spirit_stones);
        const quote = result.toolCalls.find(call => call.name === 'engine.quotePassageAtACounter');
        expect(quote?.ok).toBe(true);
    }, 180_000);

    it('refuses on the purse and names the figure, rather than haggling', async () => {
        const { game, db, cultivatorId } = await standingAt('Scarwater', 'span-poor');
        db.prepare('UPDATE cultivators SET spirit_stones = 1 WHERE id = ?').run(cultivatorId);
        const result = await game.act('I buy passage to Kettle');
        expect(result.narration).toMatch(/spirit stones/i);
        expect(cultivatorRow(db, cultivatorId).location).toMatch(/scarwater/i);
    }, 120_000);
});

describe('riding', () => {
    it('is its own verb and not a label on walking', () => {
        expect(parseIntent('I ride to Kettle').action).toBe('ride');
        expect(parseIntent('I travel to Kettle').action).toBe('move');
        // And the one that could not be said at all: a carriage is one edit
        // from a marriage, and the spelling repair had the only opinion about
        // it until the word entered the parser's own vocabulary.
        expect(parseIntent('I take a carriage to Kettle').action).toBe('ride');
    });

    it('says what the party arrived on, which is read at the gate before anybody speaks', async () => {
        const { game } = await standingAt('Scarwater', 'ride-foot');
        const result = await game.act('I ride to Kettle');
        const priced = result.toolCalls.find(call => call.name === 'engine.priceJourney');
        expect(priced?.ok).toBe(true);
        expect(priced?.summary).toMatch(/On foot/i);
        // Walking is a row in the table and it is the floor, never a refusal.
        // Arriving on foot tells the gate what this party can afford exactly as
        // loudly as arriving on a hull does.
        expect(result.narration).toMatch(/on foot/i);
    }, 120_000);
});
