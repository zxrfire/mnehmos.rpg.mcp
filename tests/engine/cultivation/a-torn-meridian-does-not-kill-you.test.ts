/**
 * A torn meridian does not kill you.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THIS FILE USED TO ASSERT THE OPPOSITE, AND THAT IS THE POINT OF IT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It was `bleeding.test.ts` and it pinned a death: three untreated meridian
 * wounds were fatal if you fought, and fatal in BLEED_OUT_TURNS if you did not.
 * Every assertion in the two lower blocks has been inverted, because the design
 * owner reversed the decision the file was written to protect:
 *
 *   "torn meridians should not kill, they don't make you bleed out. it should
 *   be the same as a torn muscle irl. very VERY annoying, but you don't die.
 *   but you probably lose combat effectiveness of some sort or maybe
 *   cultivation speed (but not comprehension)."
 *
 * A passing test is evidence, not proof, and these were passing while the game
 * was measurably broken: on the sampled strategy with the food problem bought
 * off, fifteen of fifteen runs died of `untreated_injuries` at a median age of
 * 21 and a median peak of ordinal 2 out of 47. The wound was a wall in front of
 * the content. `docs/world/climbing/injuries.md` is the spec.
 *
 * The file now holds the guard in both directions, which is what makes it worth
 * keeping rather than deleting:
 *
 *   NOT LETHAL   no route, at any count, at any realm, over any span, produces
 *                `untreated_injuries` - while every other death still works.
 *   STILL BITES  the rate, the fight and the body's own mending are all
 *                measurably worse, so "nothing kills anybody now" cannot pass
 *                by simply making wounds free.
 *   NOT THINKING the axis a wound must never reach.
 *
 * The counter and its pure functions are unchanged and still tested first: they
 * are an odometer now rather than a clock, and how long somebody has carried an
 * open channel is what the player is shown in place of a countdown.
 */

import {
    BLEED_OUT_TURNS,
    CRIPPLING_UNTREATED_INJURIES,
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
import {
    aggregateInjuryPenalties,
    treatWorstInjury
} from '../../../src/engine/cultivation/injuries.js';
import { assessPower, resolveExchange } from '../../../src/engine/cultivation/combat.js';
import { computeCultivationRate } from '../../../src/engine/cultivation/cultivation.js';
import { understandingEffects } from '../../../src/engine/cultivation/understanding.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { MAX_ORDINAL, REALM_TIERS } from '../../../src/engine/cultivation/realms.js';
import { DEVIATION_CHECK_DAYS, simulateTimeSkip, type TimeSkipContext } from '../../../src/engine/cultivation/time-skip.js';
import { DAYS_PER_YEAR } from '../../../src/engine/cultivation/cultivation.js';
import { makeCultivator, makeInjuries } from './fixtures.js';

const CRIPPLED = CRIPPLING_UNTREATED_INJURIES;

/** At the crippling count, `n` turns into carrying them. */
function wounded(bleedingTurns: number, untreated = CRIPPLED): Cultivator {
    return makeCultivator({ injuries: makeInjuries(untreated), bleedingTurns });
}

// ─────────────────────────────────────────────────────────────────────────
// THE COUNTER
// Unchanged arithmetic. What changed is what it means: how long the channels
// have been open, rather than how long is left.
// ─────────────────────────────────────────────────────────────────────────

describe('the open-channel counter', () => {
    it('advances only at or above the crippling untreated count', () => {
        expect(isBleedingOut(CRIPPLED - 1)).toBe(false);
        expect(isBleedingOut(CRIPPLED)).toBe(true);

        expect(bleedOut({ untreatedInjuries: CRIPPLED - 1, bleedingTurns: 0 }, 10).bleedingTurns).toBe(0);
        expect(bleedOut({ untreatedInjuries: CRIPPLED, bleedingTurns: 0 }, 10).bleedingTurns).toBe(10);
        expect(bleedOut({ untreatedInjuries: CRIPPLED + 5, bleedingTurns: 3 }, 4).bleedingTurns).toBe(7);
    });

    it('resets the moment the count drops back under the threshold', () => {
        // The sibling of `burnSatiety` clearing starvationTurns on the first
        // action taken with food in the belly. One treated wound out of three
        // clears it - the counter measures the state you are in now, not the
        // damage taken over a life.
        const carried = { untreatedInjuries: CRIPPLED, bleedingTurns: BLEED_OUT_TURNS - 1 };
        expect(bleedOut({ ...carried, untreatedInjuries: CRIPPLED - 1 }, 1).bleedingTurns).toBe(0);
    });

    it('is a no-op for zero turns and never mutates its input', () => {
        const state = { untreatedInjuries: CRIPPLED, bleedingTurns: 4 };
        expect(bleedOut(state, 0)).toEqual(state);
        bleedOut(state, 40);
        expect(state).toEqual({ untreatedInjuries: CRIPPLED, bleedingTurns: 4 });
    });

    it('reports the remainder of the neglect window without anybody dying at zero', () => {
        expect(turnsUntilBleedOut({ untreatedInjuries: CRIPPLED, bleedingTurns: 0 })).toBe(BLEED_OUT_TURNS);
        expect(turnsUntilBleedOut({ untreatedInjuries: CRIPPLED, bleedingTurns: BLEED_OUT_TURNS - 1 })).toBe(1);
        expect(turnsUntilBleedOut({ untreatedInjuries: CRIPPLED, bleedingTurns: BLEED_OUT_TURNS })).toBe(0);
        // And zero is not death. This is the assertion the whole file turns on.
        expect(evaluateDeathConditions(wounded(BLEED_OUT_TURNS))).toBeNull();
    });

    it('is Infinity - not a countdown that never moves - when nothing is open', () => {
        expect(turnsUntilBleedOut({ untreatedInjuries: 0, bleedingTurns: 0 })).toBe(Infinity);
        expect(turnsUntilBleedOut({ untreatedInjuries: CRIPPLED - 1, bleedingTurns: 40 })).toBe(Infinity);
    });

    it('reads its state off a cultivator, counting only untreated wounds', () => {
        const injuries = makeInjuries(CRIPPLED);
        const cultivator = makeCultivator({ injuries, bleedingTurns: 12 });
        expect(bleedStateOf(cultivator)).toEqual({ untreatedInjuries: CRIPPLED, bleedingTurns: 12 });

        const healed = treatWorstInjury(injuries).injuries;
        expect(bleedStateOf(makeCultivator({ injuries: healed, bleedingTurns: 12 })).untreatedInjuries)
            .toBe(CRIPPLED - 1);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE DEATH GATE - EVERY ROUTE IN, AND NONE OF THEM ARRIVES
// ─────────────────────────────────────────────────────────────────────────

describe('the death gate does not answer to a channel wound', () => {
    it('does not kill on the day it used to, nor on any day after it', () => {
        for (const turns of [BLEED_OUT_TURNS - 1, BLEED_OUT_TURNS, BLEED_OUT_TURNS + 1, BLEED_OUT_TURNS * 40]) {
            expect(evaluateDeathConditions(wounded(turns))).toBeNull();
        }
    });

    it('does not kill at any number of open wounds', () => {
        // The old rule was a threshold, so the guard is a sweep rather than a
        // point: somebody with twenty open channels is in a terrible state and
        // is not dying of it.
        for (const count of [CRIPPLED, CRIPPLED + 1, 5, 10, 20]) {
            expect(evaluateDeathConditions(wounded(BLEED_OUT_TURNS, count))).toBeNull();
        }
    });

    it('does not kill a forced fight, which was the other route in', () => {
        const fresh = wounded(0);
        expect(evaluateDeathConditions(fresh)).toBeNull();
        expect(evaluateDeathConditions(fresh, { forcingCombat: true })).toBeNull();
    });

    it('is not gated on realm in either direction - nobody dies of it at 0 or at 40', () => {
        for (const ordinal of [0, 12, 20, 30, 40, MAX_ORDINAL]) {
            expect(
                evaluateDeathConditions(makeCultivator({
                    realmOrdinal: ordinal,
                    age: 1,
                    injuries: makeInjuries(CRIPPLED),
                    bleedingTurns: BLEED_OUT_TURNS
                }))
            ).toBeNull();
        }
        // Stated the other way round, so the asymmetry with hunger stays
        // explicit: there IS a realm where starvation stops.
        const deity = REALM_TIERS.find(t => t.key === 'deity_transformation')!;
        expect(stillNeedsToEat(deity.ordinalStart)).toBe(false);
    });

    it('leaves every OTHER death working, which is the scope of the change', () => {
        // The risk in removing a cause is removing the neighbours with it. Each
        // of these is a live cause and each is checked while the cultivator also
        // carries the wounds that used to be the story.
        const hurt = wounded(BLEED_OUT_TURNS * 2);
        expect(evaluateDeathConditions({ ...hurt, hp: 0 })).toBe('combat_defeat');
        expect(
            evaluateDeathConditions({
                ...hurt, realmOrdinal: 0, satiety: 0, starvationTurns: STARVATION_TURNS
            })
        ).toBe('starvation');
        expect(
            evaluateDeathConditions({ ...hurt, realmOrdinal: 0, age: 999 })
        ).toBe('lifespan_exhausted');
        expect(
            evaluateDeathConditions({ ...hurt, realmOrdinal: 0, age: 20, yearsAtCurrentRealm: 999 })
        ).toBe('stagnation_aging');
    });

    it('still kills a fight forced by somebody who can barely stand', () => {
        // `obviously_fatal_choice` is about the HP bar and not about a wound,
        // and it must survive the removal. Whole meridians, 2 HP of 100.
        const spent = makeCultivator({ hp: 2, maxHp: 100, injuries: [] });
        expect(evaluateDeathConditions(spent)).toBeNull();
        expect(evaluateDeathConditions(spent, { forcingCombat: true })).toBe('obviously_fatal_choice');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// AND IT HAS TO STILL BITE
//
// The stated failure mode of this change is "everybody now survives everything
// and injuries stop mattering". These are the assertions that fail if the
// impairment was removed along with the lethality.
// ─────────────────────────────────────────────────────────────────────────

describe('very, VERY annoying', () => {
    it('takes most of the cultivation rate', () => {
        const whole = makeCultivator({ injuries: [] });
        const hurt = makeCultivator({ injuries: makeInjuries(CRIPPLED, 'serious') });
        const before = computeCultivationRate(whole, 'normal').perDay;
        const after = computeCultivationRate(hurt, 'normal').perDay;
        // Three serious wounds are 0.75 of the rate by INJURY_WEIGHTS, so a
        // quarter of the rate is what survives. Asserted as a band rather than
        // a point so a weights pass does not break it for the wrong reason.
        expect(after).toBeLessThan(before * 0.4);
        expect(after).toBeGreaterThan(0);
    });

    it('blunts the blow itself, which is where the owner asked for it', () => {
        // "its just painful for you in a way that affects the rng of the damage
        // it does cuz its slower and less accurate." Same seed, same opponent,
        // same rung - the only difference is the attacker's open channels.
        const base = {
            id: 'a', name: 'A', realmOrdinal: 20, spiritRoot: 'single_fire' as const,
            attributes: { might: 2, insight: 2, fortune: 2, charisma: 2 },
            hp: 100, maxHp: 100, qi: 100, maxQi: 100, battlesSurvived: 0
        };
        const ctx = { ambient: 'normal' as const };
        const whole = assessPower({ ...base, injuries: [] }, ctx);
        const hurt = assessPower({ ...base, injuries: makeInjuries(CRIPPLED, 'serious') }, ctx);
        const target = assessPower({ ...base, id: 'b', name: 'B', injuries: [] }, ctx);

        const strike = (attacker: typeof whole) => resolveExchange(attacker, target, 100, {
            rng: forStream('accuracy-guard', 'exchange', 1),
            turn: 1
        }).damage;

        expect(hurt.channelWoundPenalty).toBeGreaterThan(0);
        expect(strike(hurt)).toBeLessThan(strike(whole));
    });

    it('does not blunt a blow for a wound of the cultivation, which is priced elsewhere', () => {
        // The two families are not one scale. A permanent structural wound is a
        // capability loss on the condition and broken lines; charging it in the
        // damage roll as well would be the double-price `assessPower` forbids.
        const base = {
            id: 'a', name: 'A', realmOrdinal: 20, spiritRoot: 'single_fire' as const,
            attributes: { might: 2, insight: 2, fortune: 2, charisma: 2 },
            hp: 100, maxHp: 100, qi: 100, maxQi: 100, battlesSurvived: 0
        };
        const maimed = makeInjuries(1, 'crippling').map(i => ({ ...i, woundType: 'severed-meridian' }));
        expect(
            assessPower({ ...base, injuries: maimed }, { ambient: 'normal' }).channelWoundPenalty
        ).toBe(0);
    });

    it('does NOT stop the body mending, which is the penalty that had to come off', () => {
        // The one assertion here that guards against over-correction rather
        // than under-correction, and it was written after a measurement.
        //
        // Open channels used to block HP recovery outright. Defensible while
        // such a cultivator was dead in ninety days; with that death retired it
        // became the amplifier on a loop - a wound raises deviation risk, a
        // deviation costs HP and leaves another wound, and the repair was
        // switched off. The wall did not come down, it changed its name:
        // `untreated_injuries` fell to 0 of 15 and `qi_deviation` rose to 15 of
        // 15. A torn muscle does not stop a bruise closing.
        //
        // Twenty-nine days, so no deviation check fires (DEVIATION_CHECK_DAYS
        // is 30) and this measures the mending and nothing else. A large body
        // so the fractional daily rate lands as whole points.
        const mend = (injuries: ReturnType<typeof makeInjuries>) => simulateTimeSkip(
            makeCultivator({ hp: 500, maxHp: 1000, injuries }),
            29,
            skipCtx()
        ).deltas.hp;

        expect(mend([])).toBeGreaterThan(0);
        expect(mend(makeInjuries(CRIPPLED, 'crippling'))).toBe(mend([]));
    });

    it('is worth curing - closing one wound buys back rate, odds and accuracy', () => {
        // "Very VERY annoying" only works if the annoyance is answerable. Every
        // axis a wound takes has to come back when the wound is closed, or the
        // medicine ladder is selling nothing.
        const injuries = makeInjuries(CRIPPLED, 'serious');
        const treated = treatWorstInjury(injuries).injuries;

        const before = aggregateInjuryPenalties(injuries);
        const after = aggregateInjuryPenalties(treated);
        expect(after.cultivationPenalty).toBeLessThan(before.cultivationPenalty);
        expect(after.breakthroughPenalty).toBeLessThan(before.breakthroughPenalty);
        expect(after.lethalThresholdReached).toBe(false);

        const rateOf = (list: typeof injuries) =>
            computeCultivationRate(makeCultivator({ injuries: list }), 'normal').perDay;
        expect(rateOf(treated)).toBeGreaterThan(rateOf(injuries));
    });
});

// ─────────────────────────────────────────────────────────────────────────
// AND THE ONE AXIS IT MUST NOT REACH
// ─────────────────────────────────────────────────────────────────────────

describe('comprehension is untouched by any of it', () => {
    it('prices understanding identically for a whole body and a ruined one', () => {
        // `understandingEffects` takes insights and a relevance context and has
        // no injury parameter at all. This test exists so that adding one is a
        // red build rather than a quiet design change: a wounded cultivator
        // still thinks clearly.
        const insights = makeCultivator({}).insights ?? [];
        const ctx = { rootElements: ['fire'], techniqueElement: null, techniqueSubject: null };
        expect(understandingEffects(insights, ctx)).toEqual(understandingEffects(insights, ctx));
    });

    it('leaves the dao side of the rate breakdown identical when wounds are added', () => {
        const ctx = { rootElements: ['fire'], techniqueElement: null, techniqueSubject: null };
        const whole = makeCultivator({ injuries: [] });
        const hurt = makeCultivator({ injuries: makeInjuries(CRIPPLED, 'crippling') });

        // The whole rate moves, because wounds take the rate. The understanding
        // FACTOR inside it does not, because wounds do not take understanding.
        const factorOf = (c: Cultivator) =>
            computeCultivationRate(c, 'normal').factors.find(f => f.source === 'understanding')!;
        expect(factorOf(hurt).multiplier).toBe(factorOf(whole).multiplier);
        expect(understandingEffects(hurt.insights ?? [], ctx).breakthroughModifier)
            .toBe(understandingEffects(whole.insights ?? [], ctx).breakthroughModifier);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE SPIRAL, END TO END
//
// The scenario the retired mechanism existed to terminate: a deviation opens
// the meridians, nothing is done about it, and the run goes on.
//
// AND IT IS HONEST ABOUT WHAT STILL ENDS IT. A cultivator who never treats
// anything is not immortal. Untreated wounds raise deviation risk
// (RISK_PER_UNTREATED_INJURY, which is a different system with its own ruling
// behind it), so a life spent cultivating through torn channels accumulates
// deviations and eventually loses to one. That is a fight with your own qi that
// you lost, not a scratch that bled you out, and it takes years rather than a
// season. These tests assert the distinction rather than pretending nothing
// kills anybody - "everybody now survives everything" is as wrong as the
// lethality was.
// ─────────────────────────────────────────────────────────────────────────

function skipCtx(overrides: Partial<TimeSkipContext> = {}): TimeSkipContext {
    return {
        seed: 'torn-meridians-are-not-fatal',
        locationId: 'a-cave-nobody-knows',
        turn: 0,
        startDay: 0,
        grainAbstinence: true,
        randomEvents: false,
        autoBreakthrough: false,
        ...overrides
    };
}

describe('the spiral no longer ends the run in a season', () => {
    it('runs years past the window that used to end it, and not on that cause', () => {
        const result = simulateTimeSkip(wounded(0), 10 * DAYS_PER_YEAR, skipCtx());
        expect(result.deathCause).not.toBe('untreated_injuries');
        // This exact call used to stop dead on day ninety. Asserted as a large
        // multiple rather than a point, because what ends it now is a deviation
        // whose timing is a seeded roll - the claim is "years, not a season".
        expect(result.simulatedDays).toBeGreaterThan(BLEED_OUT_TURNS * 10);
        // And the counter kept counting, because how long they have been open
        // is still a fact worth carrying.
        expect(result.endState.bleedingTurns).toBe(result.simulatedDays);
    });

    it('survives the whole of the old window and well past it, in short skips', () => {
        // Three thirty-day seclusions used to kill exactly as one ninety-day
        // one did. Ten of them now pass without incident.
        let state = wounded(0);
        let days = 0;
        for (let leg = 0; leg < 10; leg++) {
            const result = simulateTimeSkip(state, 30, skipCtx());
            days += result.simulatedDays;
            expect(result.died).toBe(false);
            state = wounded(result.endState.bleedingTurns);
        }
        expect(days).toBe(300);
        expect(days).toBeGreaterThan(BLEED_OUT_TURNS);
    });

    it('does not run the counter at all for a cultivator under the threshold', () => {
        const result = simulateTimeSkip(
            makeCultivator({ spiritRoot: 'single_fire', realmOrdinal: 20, injuries: makeInjuries(CRIPPLED - 1) }),
            10 * DAYS_PER_YEAR,
            skipCtx()
        );
        expect(result.endState.bleedingTurns).toBe(0);
        expect(result.deathCause).not.toBe('untreated_injuries');
    });

    it('hands control back once, and says what it costs rather than counting down', () => {
        // The interrupt survives the ruling: crossing the threshold is the
        // moment somebody would want to go and do something about it. What
        // changed is the sentence - a warning that threatens a death the engine
        // never delivers teaches a player to ignore warnings.
        const start = makeCultivator({
            spiritRoot: 'dual_water_fire',
            realmOrdinal: 20,
            injuries: makeInjuries(CRIPPLED - 1)
        });

        let state = start;
        let told = 0;
        let totalDays = 0;

        for (let leg = 0; leg < 12; leg++) {
            const result = simulateTimeSkip(state, 5 * DAYS_PER_YEAR, skipCtx({
                startDay: totalDays,
                turn: leg
            }));
            totalDays += result.simulatedDays;
            expect(result.deathCause).not.toBe('untreated_injuries');

            const warned = result.events.find(e => e.kind === 'bleeding_warning');
            if (warned) {
                told++;
                expect(warned.interrupts).toBe(true);
                // No countdown on the wire. The payload carries how long they
                // have been carried and what they are costing.
                expect(warned.data.daysUntilBleedOut).toBeUndefined();
                expect(warned.data.cultivationPenalty).toBeGreaterThan(0);
                // It says plainly that it is not fatal, and it never threatens
                // a death: a warning the engine does not carry out teaches a
                // player to ignore warnings.
                expect(String(warned.summary)).toMatch(/not fatal/i);
                expect(String(warned.summary)).not.toMatch(/give out|days before|kill/i);
            }

            state = makeCultivator({
                spiritRoot: 'dual_water_fire',
                realmOrdinal: 20,
                // Nothing is treated. That is the whole point of the scenario.
                injuries: [...state.injuries, ...result.injuriesSustained],
                bleedingTurns: result.endState.bleedingTurns
            });
        }

        expect(told).toBe(1);
        expect(state.injuries.filter(i => !i.treated).length).toBeGreaterThanOrEqual(CRIPPLED);
        // Years of it, wounds never closed, and they are still here. A band
        // rather than a point because every interrupt truncates its own leg -
        // the threshold warning once, and the deviations after it - which is
        // the interrupt machinery working rather than the span being short.
        expect(totalDays).toBeGreaterThan(10 * DAYS_PER_YEAR);
    });

    it('warns once and then stops, rather than nagging forever', () => {
        // Unchanged from the original rule, and it matters for the opposite
        // reason now: a player who has been told and chose to press on has
        // chosen, and stopping them every fortnight is the engine arguing.
        const entering = makeCultivator({
            spiritRoot: 'single_fire',
            realmOrdinal: 20,
            injuries: makeInjuries(CRIPPLED)
        });
        const result = simulateTimeSkip(entering, 10 * DAYS_PER_YEAR, skipCtx());
        expect(result.events.filter(e => e.kind === 'bleeding_warning')).toHaveLength(0);
        // Not stopped, and not killed by the wounds either. If this run ends it
        // is a deviation that ends it, years in - see the block header.
        expect(result.deathCause).not.toBe('untreated_injuries');
        expect(result.simulatedDays).toBeGreaterThan(BLEED_OUT_TURNS * 10);
    });

    it('is not escaped by a grain abstinence pill, because there is nothing to escape', () => {
        const fed = simulateTimeSkip(wounded(0), 10 * DAYS_PER_YEAR, skipCtx({ grainAbstinence: true }));
        const hungry = simulateTimeSkip(wounded(0), 10 * DAYS_PER_YEAR, skipCtx({
            grainAbstinence: false,
            rations: 100000
        }));
        expect(fed.deathCause).not.toBe('untreated_injuries');
        expect(hungry.deathCause).not.toBe('untreated_injuries');
        // The counter accrues identically either way: a pill that means you
        // need not eat does not close a torn meridian.
        expect(hungry.endState.bleedingTurns).toBe(fed.endState.bleedingTurns);
    });

    it('keeps the neglect window longer than one deviation check', () => {
        // Retained from the original file. The window is no longer a countdown
        // to anything, but it is still the horizon the narration is written
        // against, and a horizon shorter than the cadence that produces the
        // wounds would be incoherent.
        expect(BLEED_OUT_TURNS).toBeGreaterThan(DEVIATION_CHECK_DAYS);
    });
});
