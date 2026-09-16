/**
 * The world interrupts, and the rest of the sentence does not happen.
 *
 * > *What limits a player is the world and their own body. Never a rule about
 * > how sentences may be shaped.*
 *
 * Both halves of that were unenforced. `stopOnInterrupt`, `InterruptPolicy` and
 * `WorldInterrupt` were complete in `time.ts` and had no production caller at
 * all; both call sites in `cultivation-world.ts` passed `stopOnInterrupt: false`;
 * and `PlayAdvanceResult.interrupted` was read nowhere in `src/`. Meanwhile the
 * plan loop broke only on a refused step or a dead cultivator, so *"I sit for
 * thirty years and then go to the market"*, cut at day four hundred by somebody
 * arriving, still ran the market clause on the same turn.
 *
 * Four claims, and the last one is the one the whole design is for:
 *
 *   1. The world can be ASKED when it would cut in, without moving it, and the
 *      answer is the day the advance would have stopped on.
 *   2. A shut door is a fact about the place: it keeps out the ordinary business
 *      of wherever they are sitting and of whatever house they belong to, and it
 *      does not keep out somebody who comes for them by name.
 *   3. A span cut short stops the sentence. The later clauses never ran, cost
 *      nothing, and the player is told which they were.
 *   4. And the turn after it WORKS. A cut chain is not an error state - the
 *      world moved, and the next sentence is made from where they actually are.
 */

import { describe, it, expect } from 'vitest';

import { makeGame, makeGameInWorld, type Harness } from './harness';
import { advanceTime, whenTheWorldWouldInterrupt } from '../../src/engine/world/time.js';
import { createWorld, schedule, type WorldState } from '../../src/engine/world/world-state.js';
import { makeLocation } from '../../src/engine/world/locations.js';
import { whatCutTheSpanShort, whatReachesSomebodySpendingASpanHere } from '../../src/web/encounters.js';
import { thisPlaceAndWhatContainsIt } from '../../src/web/turn-engine.js';

/** The catalog's shortest manual. Without one every long sitting is refused. */
const MANUAL = 'lesser-qi-gathering-manual';

/**
 * Somebody who can actually sit for a decade.
 *
 * Arranged rather than played, which AGENTS.md allows for a precondition - the
 * played half is the sentence typed below it. Without a manual the ceiling
 * refuses every long stretch before a day is spent, and without a purse the
 * pack runs out inside a fortnight; neither is what any of this measures.
 */
function ableToSit(harness: Harness, cultivatorId: string, sectId: string | null = null): void {
    harness.repos.techniques.learn(cultivatorId, MANUAL, 0.6);
    harness.db.prepare(
        'UPDATE cultivators SET known_techniques = ?, spirit_stones = 5000000, sect_id = ? '
        + 'WHERE id = ?'
    ).run(JSON.stringify([MANUAL]), sectId, cultivatorId);
}

// ─────────────────────────────────────────────────────────────────────────
// 1. THE WORLD CAN BE ASKED
// ─────────────────────────────────────────────────────────────────────────

describe('the world answers when it would cut in', () => {
    /** A world with one dated consequence on the books, at a known place. */
    function withOneEffectOnTheBooks(at: { locationId?: string | null; interrupts?: boolean }) {
        const bare = createWorld({ seed: 'interrupt-fixture' });
        const { state } = schedule(bare, {
            kind: 'faction_action',
            dueOnDay: bare.currentDay + 400,
            summary: 'The gate below is opened and there are people on the path.',
            locationId: at.locationId ?? null,
            interrupts: at.interrupts ?? false
        });
        return state;
    }

    const policyFor = (state: WorldState, locationIds: string[], sealed = false) =>
        whatReachesSomebodySpendingASpanHere({
            actorId: 'somebody',
            locationIds,
            factionIds: [],
            behindAShutDoor: sealed
        });

    it('names the day, and names nothing when the span stops short of it', () => {
        const state = withOneEffectOnTheBooks({ locationId: 'loc-here' });
        const from = Math.floor(state.currentDay);

        const found = whenTheWorldWouldInterrupt(state, policyFor(state, ['loc-here']), from, 3650);
        expect(found, 'an effect at the place they are sitting reaches them').not.toBeNull();
        expect(found!.onDay - from).toBe(400);
        expect(found!.cause).toBe('local_event');

        // The same books, a shorter sitting. Nothing on them is inside it.
        expect(
            whenTheWorldWouldInterrupt(state, policyFor(state, ['loc-here']), from, 100),
            'a span that ends before the effect is due is not cut by it'
        ).toBeNull();

        // And somebody sitting somewhere else is not reached by it at all.
        expect(
            whenTheWorldWouldInterrupt(state, policyFor(state, ['loc-elsewhere']), from, 3650)
        ).toBeNull();
    });

    it('agrees with the advance it is a forecast of', () => {
        // The whole risk in asking rather than moving: the answer has to be the
        // day `advanceTime` would actually have stopped on, or a player is cut
        // short for a reason the world then does not produce.
        const state = withOneEffectOnTheBooks({ locationId: 'loc-here' });
        const from = Math.floor(state.currentDay);
        const policy = policyFor(state, ['loc-here']);

        const forecast = whenTheWorldWouldInterrupt(state, policy, from, 3650);
        const moved = advanceTime(state, 3650, { interruptPolicy: policy, stopOnInterrupt: true });

        expect(moved.interrupted, 'the advance stops where the forecast said').toBe(true);
        expect(moved.interrupts[0]!.onDay).toBe(forecast!.onDay);
        expect(moved.interrupts[0]!.sourceId).toBe(forecast!.sourceId);
        expect(moved.daysAdvanced).toBe(forecast!.onDay - from);
    });

    it('reaches somebody standing inside the place it names', () => {
        // THE ARITHMETIC THAT SHUT THE WORLD'S OWN DOOR. Measured on a fixture
        // world: every located opportunity and every located effect sits on a
        // REGION id, and a played cultivator stands on a SITE inside one - so a
        // policy matching the place exactly found nothing, anywhere, ever, and
        // the world could not have interrupted anybody even once it was asked.
        const bare = createWorld({ seed: 'containment-fixture' });
        const world: WorldState = {
            ...bare,
            locations: [
                ...bare.locations,
                makeLocation({ id: 'loc-region', name: 'The Drowned Reach', kind: 'region' }),
                makeLocation({
                    id: 'loc-site', name: 'Silver Island', kind: 'settlement',
                    parentId: 'loc-region'
                })
            ]
        };
        expect(thisPlaceAndWhatContainsIt(world, 'loc-site')).toEqual(['loc-site', 'loc-region']);
        expect(thisPlaceAndWhatContainsIt(world, null), 'nothing reaches somebody who is nowhere')
            .toEqual([]);

        const { state } = schedule(world, {
            kind: 'faction_action',
            dueOnDay: world.currentDay + 400,
            summary: 'The Reach is closed to anybody without a plate.',
            locationId: 'loc-region'
        });
        const standing = thisPlaceAndWhatContainsIt(state, 'loc-site');
        expect(
            whenTheWorldWouldInterrupt(
                state, policyFor(state, standing), Math.floor(state.currentDay), 3650
            ),
            'a thing that happens to the region happens where they are sitting'
        ).not.toBeNull();
        expect(
            whenTheWorldWouldInterrupt(
                state, policyFor(state, ['loc-site']), Math.floor(state.currentDay), 3650
            ),
            'and the exact match on its own is the defect, not the fix'
        ).toBeNull();
    });

    it('is kept out by a shut door, except by something flagged on its own account', () => {
        const ordinary = withOneEffectOnTheBooks({ locationId: 'loc-here' });
        const from = Math.floor(ordinary.currentDay);
        expect(
            whenTheWorldWouldInterrupt(ordinary, policyFor(ordinary, ['loc-here'], true), from, 3650),
            'the ordinary business of a place does not reach through a sealed door'
        ).toBeNull();

        // `interrupts` is the world saying this one stops anybody, door or no
        // door. Nothing in production sets it today; the seam is here for when
        // something does, and a door that swallowed it would be a bug that only
        // showed up years later.
        const flagged = withOneEffectOnTheBooks({ locationId: 'loc-here', interrupts: true });
        const through = whenTheWorldWouldInterrupt(
            flagged, policyFor(flagged, ['loc-here'], true), Math.floor(flagged.currentDay), 3650
        );
        expect(through, 'a flagged consequence reaches through a shut door').not.toBeNull();
        expect(through!.cause).toBe('scheduled_interrupt');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// 2. WHICH OF THE THREE DID IT
// ─────────────────────────────────────────────────────────────────────────

describe('three systems, one answer about what ended the span', () => {
    const skipThatRan = (days: number) => ({
        requestedDays: days, simulatedDays: days,
        interrupted: false, interruptReason: null, died: false
    });

    it('says nothing at all when the span ran to the end', () => {
        expect(whatCutTheSpanShort({
            asked: 365, lived: 365, skip: skipThatRan(365),
            arrival: { firstInterruptDay: null }, world: null, startDay: 0
        })).toBeNull();
    });

    it('does not announce a loss of no days', () => {
        // The defect `facts.ts` already fixed at the other end of the same pipe:
        // a stretch that runs in full still sets `interrupted` when the
        // provisions warning lands on its last chunk.
        expect(whatCutTheSpanShort({
            asked: 30, lived: 30,
            skip: { requestedDays: 30, simulatedDays: 30, interrupted: true, interruptReason: 'provisions_low', died: false },
            arrival: { firstInterruptDay: null }, world: null, startDay: 0
        })).toBeNull();
    });

    it('is not an interruption when the run ended', () => {
        // There is no next sentence to make from where they are standing.
        expect(whatCutTheSpanShort({
            asked: 3650, lived: 3650,
            skip: { requestedDays: 3650, simulatedDays: 40, interrupted: true, interruptReason: 'starvation', died: true },
            arrival: { firstInterruptDay: null }, world: null, startDay: 0
        })).toBeNull();
    });

    it('blames the body over anything outside it', () => {
        // The skip was handed 400 days and did not finish them, which no arrival
        // and no world event can explain.
        const cut = whatCutTheSpanShort({
            asked: 3650, lived: 400,
            skip: { requestedDays: 400, simulatedDays: 12, interrupted: true, interruptReason: 'starvation_begun', died: false },
            arrival: { firstInterruptDay: 400 }, world: { onDay: 900, summary: 'a gate opens' },
            startDay: 0
        });
        expect(cut?.cause).toBe('the_body');
        expect(cut?.livedDays).toBe(12);
        expect(cut?.askedDays).toBe(3650);
        expect(cut?.what).toContain('starvation begun');
    });

    it('otherwise blames whichever of the two outer cuts landed first', () => {
        const byArrival = whatCutTheSpanShort({
            asked: 3650, lived: 400, skip: skipThatRan(400),
            arrival: { firstInterruptDay: 400 }, world: { onDay: 900, summary: 'a gate opens' },
            startDay: 0
        });
        expect(byArrival?.cause).toBe('somebody_arrived');

        const byWorld = whatCutTheSpanShort({
            asked: 3650, lived: 900, skip: skipThatRan(900),
            arrival: { firstInterruptDay: null }, world: { onDay: 900, summary: 'a gate opens' },
            startDay: 0
        });
        expect(byWorld?.cause).toBe('the_world');
        expect(byWorld?.what).toBe('a gate opens');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// 3. AND 4. PLAYED
// ─────────────────────────────────────────────────────────────────────────

describe('a sentence the world cut in half', () => {
    it('does not run the clauses after the span, and says which they were', async () => {
        const harness = makeGame({ seed: 'cut-in-half-1', worldEnabled: true });
        const { cultivator } = await harness.game.newRun('Shen Liefeng');
        ableToSit(harness, cultivator.id);

        const result = await harness.game.act('I cultivate for ten years and then look around');
        const rows = result.toolCalls;

        const steps = rows.filter(r => r.name === 'engine.step');
        expect(steps.length, 'the sentence was read as more than one act').toBeGreaterThan(0);

        const cut = rows.find(r => r.name === 'engine.planCutShort');
        expect(cut, 'the span was cut short and the plan noticed').toBeDefined();
        // The step itself came off. Marking it failed in the surface an operator
        // reads to find failures is the lie the landed-but-fatal row already told
        // once.
        expect(cut!.ok).toBe(true);
        expect(cut!.summary).toMatch(/later step.* never ran and cost nothing: look/);

        // Only the first step ever ran.
        expect(
            rows.some(r => r.name === 'engine.step' && r.action === 'look'),
            'the clause after the interrupted span was never opened'
        ).toBe(false);

        // AND THE SPAN'S OWN ROW SAYS WHICH OF THE THREE DID IT.
        const span = rows.find(r => r.name === 'engine.spanCutShort');
        expect(span, 'the span filed its own row').toBeDefined();
        expect(span!.summary).toMatch(/Cut short by (somebody_arrived|the_world|the_body):/);
    }, 120_000);

    it('leaves the run somewhere the next sentence works from', async () => {
        // The whole feel of it, in the design owner's words: *"you arrive at the
        // market, but before you are able to ask for a pill a stranger cuts you
        // off"* - *"and then you continue inputs from there"*. There is no queue,
        // no held plan and no resume; the unrun half simply never happened, and
        // the difference between the world acting and the parser failing is that
        // the turn after it is an ordinary turn.
        const harness = makeGame({ seed: 'cut-in-half-2', worldEnabled: true });
        const { cultivator } = await harness.game.newRun('Shen Liefeng');
        ableToSit(harness, cultivator.id);

        const first = await harness.game.act('I cultivate for ten years and then look around');
        expect(first.toolCalls.find(r => r.name === 'engine.planCutShort')).toBeDefined();

        const next = await harness.game.act('I look around');
        expect(next.narration.length, 'the next sentence answered').toBeGreaterThan(0);
        expect(
            next.toolCalls.some(r => r.name.startsWith('narrator.plan')),
            'the next sentence was read as an ordinary turn'
        ).toBe(true);
        // Nothing is holding a plan open. The clause that never ran is gone.
        expect(
            next.toolCalls.some(r => r.name === 'engine.stillToCome'),
            'no half-finished plan was carried into the next turn'
        ).toBe(false);
    }, 120_000);

    it('lets a house reach one of its own, and a shut door keep it out', async () => {
        // The one channel the world writes today that can reach a played
        // cultivator: a sect's grant on its vein comes up for renewal every
        // twelve years, and a member is party to it. A rogue on unlocated ground
        // is reached by none of it, which is a fact about what the world writes
        // rather than about this wiring - see the module header.
        const harness = await makeGameInWorld({ worldSeed: 'la-world', seed: 'cut-in-half-3' });
        const { cultivator } = await harness.game.newRun('Shen Liefeng');
        ableToSit(harness, cultivator.id, 'sect-stone-marrow-hall');

        // Load the world the way a turn does, then ask it.
        const world = await harness.game.loadWorld();
        expect(world).not.toBeNull();
        (harness.game as unknown as { atHand: WorldState | null }).atHand = world;

        const inASect = harness.repos.cultivators.getById(cultivator.id)!;
        const open = harness.game.whenTheWorldWouldCutIn(inASect, 3650, false);
        expect(open, 'a house calls its own people out of a ten-year sitting').not.toBeNull();
        expect(open!.days).toBeLessThan(3650);
        expect(open!.interrupt.cause).toBe('faction_event');

        expect(
            harness.game.whenTheWorldWouldCutIn(inASect, 3650, true),
            'a shut door keeps out the house\'s ordinary business'
        ).toBeNull();
    }, 180_000);
});
