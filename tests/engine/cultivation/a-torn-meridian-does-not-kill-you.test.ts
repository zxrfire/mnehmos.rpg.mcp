/**
 * Bleeding out: untreated meridian injuries as a death by standing still.
 *
 * The defect this exists for was reproduced by playing the game cold. A
 * cultivator took a qi deviation in seclusion and came out with three open
 * meridians. The engine printed, correctly, that any further combat was fatal
 * and that nothing heals them on their own. Untreated injuries raise deviation
 * risk, so the next seclusion produced another deviation and a fourth wound,
 * and ejected him again. The run could not be advanced, could not be healed -
 * and could not be lost either, because `untreated_injuries` was reachable
 * only through `forcingCombat`, and a player who has just been told a fight
 * will kill them does not start one. Neither winnable nor loseable.
 *
 * The fix is the sibling of starvation: a persisted counter, a pure advance-or-
 * reset function, and a second route into the same death cause that needs no
 * choice at all. These tests hold the four things that must stay true - the
 * clock is exact, treatment stops it, the death gate orders it correctly, and
 * the spiral above now terminates.
 */

import {
    BLEED_OUT_TURNS,
    LETHAL_UNTREATED_INJURIES,
    STARVATION_TURNS,
    type Cultivator
} from '../../../src/schema/cultivation.js';
import {
    bleedOut,
    bleedStateOf,
    evaluateDeathConditions,
    isBleedingOut,
    stillNeedsToEat,
    turnsUntilBleedOut
} from '../../../src/engine/cultivation/survival.js';
import { treatWorstInjury } from '../../../src/engine/cultivation/injuries.js';
import { MAX_ORDINAL, REALM_TIERS } from '../../../src/engine/cultivation/realms.js';
import { DEVIATION_CHECK_DAYS, simulateTimeSkip, type TimeSkipContext } from '../../../src/engine/cultivation/time-skip.js';
import { DAYS_PER_YEAR } from '../../../src/engine/cultivation/cultivation.js';
import { makeCultivator, makeInjuries } from './fixtures.js';

const LETHAL = LETHAL_UNTREATED_INJURIES;

/** At the lethal count, `n` turns into the bleed. */
function bleeding(bleedingTurns: number, untreated = LETHAL): Cultivator {
    return makeCultivator({ injuries: makeInjuries(untreated), bleedingTurns });
}

describe('the bleed clock', () => {
    it('advances only at or above the lethal untreated count', () => {
        expect(isBleedingOut(LETHAL - 1)).toBe(false);
        expect(isBleedingOut(LETHAL)).toBe(true);

        expect(bleedOut({ untreatedInjuries: LETHAL - 1, bleedingTurns: 0 }, 10).bleedingTurns).toBe(0);
        expect(bleedOut({ untreatedInjuries: LETHAL, bleedingTurns: 0 }, 10).bleedingTurns).toBe(10);
        expect(bleedOut({ untreatedInjuries: LETHAL + 5, bleedingTurns: 3 }, 4).bleedingTurns).toBe(7);
    });

    it('resets the moment the count drops back under the threshold', () => {
        // The sibling of `burnSatiety` clearing starvationTurns on the first
        // action taken with food in the belly. One treated wound out of three
        // buys the whole ninety days back - the counter measures the state you
        // are in now, not the damage taken over a life.
        const bled = { untreatedInjuries: LETHAL, bleedingTurns: BLEED_OUT_TURNS - 1 };
        expect(bleedOut({ ...bled, untreatedInjuries: LETHAL - 1 }, 1).bleedingTurns).toBe(0);
    });

    it('is a no-op for zero turns and never mutates its input', () => {
        const state = { untreatedInjuries: LETHAL, bleedingTurns: 4 };
        expect(bleedOut(state, 0)).toEqual(state);
        bleedOut(state, 40);
        expect(state).toEqual({ untreatedInjuries: LETHAL, bleedingTurns: 4 });
    });

    it('reports the exact number of turns left before it kills', () => {
        expect(turnsUntilBleedOut({ untreatedInjuries: LETHAL, bleedingTurns: 0 })).toBe(BLEED_OUT_TURNS);
        expect(turnsUntilBleedOut({ untreatedInjuries: LETHAL, bleedingTurns: BLEED_OUT_TURNS - 1 })).toBe(1);
        expect(turnsUntilBleedOut({ untreatedInjuries: LETHAL, bleedingTurns: BLEED_OUT_TURNS })).toBe(0);
    });

    it('is Infinity - not a countdown that never moves - when nothing is open', () => {
        expect(turnsUntilBleedOut({ untreatedInjuries: 0, bleedingTurns: 0 })).toBe(Infinity);
        expect(turnsUntilBleedOut({ untreatedInjuries: LETHAL - 1, bleedingTurns: 40 })).toBe(Infinity);
    });

    it('reads its state off a cultivator, counting only untreated wounds', () => {
        const injuries = makeInjuries(LETHAL);
        const cultivator = makeCultivator({ injuries, bleedingTurns: 12 });
        expect(bleedStateOf(cultivator)).toEqual({ untreatedInjuries: LETHAL, bleedingTurns: 12 });

        const healed = treatWorstInjury(injuries).injuries;
        expect(bleedStateOf(makeCultivator({ injuries: healed, bleedingTurns: 12 })).untreatedInjuries)
            .toBe(LETHAL - 1);
    });
});

describe('the death gate', () => {
    it('kills on exactly the documented turn, and not one before', () => {
        expect(evaluateDeathConditions(bleeding(BLEED_OUT_TURNS - 1))).toBeNull();
        expect(evaluateDeathConditions(bleeding(BLEED_OUT_TURNS))).toBe('untreated_injuries');
    });

    it('kills without any choice being made - no forcingCombat, no combat', () => {
        // The whole point. Standing still with the meridians open is a way to
        // die, and it was the missing exit from an otherwise closed room.
        expect(evaluateDeathConditions(bleeding(BLEED_OUT_TURNS), {})).toBe('untreated_injuries');
        expect(evaluateDeathConditions(bleeding(BLEED_OUT_TURNS), { forcingCombat: false }))
            .toBe('untreated_injuries');
    });

    it('leaves the immediate route untouched: a forced fight still kills at once', () => {
        const fresh = bleeding(0);
        expect(evaluateDeathConditions(fresh)).toBeNull();
        expect(evaluateDeathConditions(fresh, { forcingCombat: true })).toBe('untreated_injuries');
    });

    it('does not kill a stale clock once the wounds are closed', () => {
        // Treatment is what stops it, and a counter that outlived the wound
        // would kill somebody who had already paid to be well.
        const injuries = makeInjuries(LETHAL);
        const healed = treatWorstInjury(injuries).injuries;
        const stale = makeCultivator({ injuries: healed, bleedingTurns: BLEED_OUT_TURNS + 50 });
        expect(evaluateDeathConditions(stale)).toBeNull();
        // And the clock the caller writes back is zero.
        expect(bleedOut(bleedStateOf(stale), 1).bleedingTurns).toBe(0);
    });

    it('is not gated on realm - the same ninety days at ordinal 0 and at 40', () => {
        // Hunger stops at Deity Transformation because a body that takes
        // nothing from the world takes no meals from it. Nothing on the ladder
        // makes an open meridian less load-bearing, so there is no equivalent
        // ceiling here and there must not be one.
        for (const ordinal of [0, 12, 20, 30, 40, MAX_ORDINAL]) {
            expect(
                evaluateDeathConditions(makeCultivator({
                    realmOrdinal: ordinal,
                    age: 1,
                    injuries: makeInjuries(LETHAL),
                    bleedingTurns: BLEED_OUT_TURNS
                }))
            ).toBe('untreated_injuries');
        }
        // Stated the other way round, so the asymmetry with hunger is explicit
        // rather than accidental: there IS a realm where starvation stops.
        const deity = REALM_TIERS.find(t => t.key === 'deity_transformation')!;
        expect(stillNeedsToEat(deity.ordinalStart)).toBe(false);
    });

    it('does not touch a soul with no body to bleed from', () => {
        expect(
            evaluateDeathConditions(makeCultivator({
                existenceState: 'soul_preserved',
                realmOrdinal: 25,
                injuries: makeInjuries(LETHAL),
                bleedingTurns: BLEED_OUT_TURNS
            }))
        ).toBeNull();
    });

    it('orders behind the causes that are more immediate than it', () => {
        // most-immediate-cause-first: a stopped heart beats a ninety-day bleed,
        // and hunger's five turns beat it too.
        const shot = bleeding(BLEED_OUT_TURNS + 10);
        expect(evaluateDeathConditions({ ...shot, hp: 0 })).toBe('combat_defeat');
        expect(
            evaluateDeathConditions({
                ...shot,
                realmOrdinal: 0,
                satiety: 0,
                starvationTurns: STARVATION_TURNS
            })
        ).toBe('starvation');
    });

    it('orders ahead of the causes that run on years rather than days', () => {
        const overdue = makeCultivator({
            realmOrdinal: 0,
            age: 999,
            yearsAtCurrentRealm: 999,
            injuries: makeInjuries(LETHAL),
            bleedingTurns: BLEED_OUT_TURNS
        });
        expect(evaluateDeathConditions(overdue)).toBe('untreated_injuries');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE SPIRAL, END TO END
// ─────────────────────────────────────────────────────────────────────────

function skipCtx(overrides: Partial<TimeSkipContext> = {}): TimeSkipContext {
    return {
        seed: 'bleed-out-regression',
        locationId: 'a-cave-nobody-knows',
        turn: 0,
        startDay: 0,
        grainAbstinence: true,
        randomEvents: false,
        autoBreakthrough: false,
        ...overrides
    };
}

describe('the spiral terminates', () => {
    it('accrues the clock across a long seclusion and kills exactly on the window', () => {
        const result = simulateTimeSkip(
            bleeding(0),
            10 * DAYS_PER_YEAR,
            skipCtx()
        );
        expect(result.died).toBe(true);
        expect(result.deathCause).toBe('untreated_injuries');
        expect(result.simulatedDays).toBe(BLEED_OUT_TURNS);
        expect(result.endState.bleedingTurns).toBe(BLEED_OUT_TURNS);
    });

    it('carries a partial clock in and out, so a run of short skips still ends', () => {
        // The counter is persisted state, not a within-skip local. Three
        // thirty-day seclusions have to kill exactly as one ninety-day one
        // does, or a player could reset the clock by taking a breath.
        let state = bleeding(0);
        let days = 0;
        let died = false;
        for (let leg = 0; leg < 10 && !died; leg++) {
            const result = simulateTimeSkip(state, 30, skipCtx());
            days += result.simulatedDays;
            died = result.died;
            state = bleeding(result.endState.bleedingTurns);
        }
        expect(died).toBe(true);
        expect(days).toBe(BLEED_OUT_TURNS);
    });

    it('does not run at all for a cultivator under the threshold', () => {
        const result = simulateTimeSkip(
            makeCultivator({ spiritRoot: 'single_fire', realmOrdinal: 20, injuries: makeInjuries(LETHAL - 1) }),
            10 * DAYS_PER_YEAR,
            skipCtx()
        );
        expect(result.endState.bleedingTurns).toBe(0);
        expect(result.deathCause).not.toBe('untreated_injuries');
    });

    it('reproduces the reported run: deviation opens the meridians, nothing is done, it ends', () => {
        // A dual root at ordinal 20 with two wounds already open. Deviation
        // risk rises with untreated injuries, so the third arrives on its own;
        // the skip hands control back once with the window stated, and the
        // player - modelled here as somebody who simply cultivates again -
        // dies of it rather than looping forever.
        const start = makeCultivator({
            spiritRoot: 'dual_water_fire',
            realmOrdinal: 20,
            injuries: makeInjuries(LETHAL - 1)
        });

        let state = start;
        let died = false;
        let toldTheWindow = false;
        let totalDays = 0;

        for (let leg = 0; leg < 40 && !died; leg++) {
            const result = simulateTimeSkip(state, 5 * DAYS_PER_YEAR, skipCtx({
                startDay: totalDays,
                turn: leg
            }));
            totalDays += result.simulatedDays;
            died = result.died;

            const warned = result.events.find(e => e.kind === 'bleeding_warning');
            if (warned) {
                toldTheWindow = true;
                expect(warned.interrupts).toBe(true);
                expect(warned.data.daysUntilBleedOut).toBe(BLEED_OUT_TURNS);
            }

            state = makeCultivator({
                spiritRoot: 'dual_water_fire',
                realmOrdinal: 20,
                // Nothing is treated. That is the whole point of the scenario.
                injuries: [...state.injuries, ...result.injuriesSustained],
                bleedingTurns: result.endState.bleedingTurns
            });
        }

        expect(toldTheWindow).toBe(true);
        expect(died).toBe(true);
        // The wounds killed him, not old age or a bottleneck.
        expect(state.injuries.filter(i => !i.treated).length).toBeGreaterThanOrEqual(LETHAL);
        // And it took months, not centuries: the window plus at most the
        // deviation cadence it took to open the third meridian.
        expect(totalDays).toBeLessThan(20 * DAYS_PER_YEAR);
        expect(totalDays).toBeGreaterThanOrEqual(BLEED_OUT_TURNS);
    });

    it('warns once and then lets the cultivator die, rather than nagging forever', () => {
        // Exactly the starvation rule. A player stopped every chunk could never
        // bleed out, which would put the trap straight back.
        const entering = makeCultivator({
            spiritRoot: 'single_fire',
            realmOrdinal: 20,
            injuries: makeInjuries(LETHAL)
        });
        const result = simulateTimeSkip(entering, 10 * DAYS_PER_YEAR, skipCtx());
        // Already at the threshold on entry: told once at creation time, not
        // stopped again here.
        expect(result.events.filter(e => e.kind === 'bleeding_warning')).toHaveLength(0);
        expect(result.died).toBe(true);
    });

    it('is not escaped by a grain abstinence pill', () => {
        // A pill that means you need not eat does not close a torn meridian,
        // and the accrual deliberately sits outside the food block.
        const fed = simulateTimeSkip(bleeding(0), 10 * DAYS_PER_YEAR, skipCtx({ grainAbstinence: true }));
        const hungry = simulateTimeSkip(bleeding(0), 10 * DAYS_PER_YEAR, skipCtx({
            grainAbstinence: false,
            rations: 100
        }));
        expect(fed.deathCause).toBe('untreated_injuries');
        expect(hungry.deathCause).toBe('untreated_injuries');
        expect(hungry.simulatedDays).toBe(fed.simulatedDays);
    });

    it('keeps the deviation cadence honest - the window is longer than one check', () => {
        // The window has to be long enough that reaching a healer is a real
        // plan. If it dropped below the deviation cadence a cultivator could
        // die before the engine ever told them anything.
        expect(BLEED_OUT_TURNS).toBeGreaterThan(DEVIATION_CHECK_DAYS);
    });
});
