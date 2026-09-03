/**
 * Striking the barrier: the one act that changes what somebody IS.
 *
 * Every other verb in this package spends time, stones or the body.
 * `strikeBarrier` spends the character. A crossing that fails can cut away a
 * foundation, break a nascent soul, or end the run, and what it takes is not
 * a resource - it is a permanent narrowing of who this cultivator can still
 * become. That is the Price of Advancement, and it is the reason this is its
 * own module rather than the last method of the seclusion file: sitting for a
 * decade and striking a barrier are different acts with different stakes, and
 * the thing that will change this file is a ruling about what a crossing
 * costs, never a ruling about how long somebody sat.
 *
 * Nothing here decides an outcome. `attemptBreakthrough` in the cultivation
 * engine owns the odds, the strikes and the damage; this resolves the target
 * state, calls it, writes what came back, and reports. The one assignment
 * worth knowing about is `immortalStatusGained` - it decides whether a
 * cultivator has gone past the Lid, and for a while it was not being written
 * down, so somebody could survive the last crossing, be told they had gone
 * through, and still read as mortal on the next turn. Everything above the
 * Lid gates on that field.
 *
 * ── HOW THIS IS ATTACHED ──────────────────────────────────
 *
 * A `GameService` method living in another file, merged onto the prototype at
 * the bottom of `game.ts` with its signature merged into the class
 * declaration. `this.strikeBarrier(...)` resolves and typechecks exactly as it
 * did when the body sat in the class, and every line below is the line it was.
 * `src/web/README.md` has the argument and the warning about `private`.
 */

import {
    attemptBreakthrough,
    whatACrossingTakesFrom
} from '../engine/cultivation/breakthrough.js';
import { maxHpForOrdinal, maxQiForOrdinal } from '../engine/cultivation/realms.js';
import { forStream } from '../engine/cultivation/rng.js';
import { describeDeath } from '../engine/cultivation/survival.js';
import type { AmbientQi, Cultivator, Run } from '../schema/cultivation.js';
import {
    FLAG_PENDING_PILL,
    type PendingPill,
    clearFlag,
    persistFoundation,
    persistToll,
    readJsonFlag,
    tollConditionsFor
} from '../server/consolidated/cultivation-support.js';
import { theRollLands } from '../server/consolidated/forcing-an-attempt-to-land.js';
import { carriedAcross } from '../storage/repos/cultivator.repo.js';
import { tollLine } from './apply.js';
import { factsForBreakthrough } from './facts.js';
import { tollCalls } from './tool-result-prose.js';
import { DELIBERATE_PREPARATION } from './turn-constants.js';
import { type Execution, GameError, type ToolCallRecord } from './turn-wire-shapes.js';
import type { GameService } from './game.js';

export const crossingVerb = {
    /**
     * One breakthrough attempt, applied.
     *
     * `advanceRealm` is deliberately not used: it zeroes accumulated progress,
     * and the engine's own rule is that a successful attempt consumes exactly
     * `progressConsumed` and the overflow carries. Writing the absolute state
     * keeps this layer agreeing with `simulateTimeSkip`, which does the same.
     */
    strikeBarrier(this: GameService, run: Run, cultivator: Cultivator, ambient: AmbientQi): Execution {
        const absDay = Math.floor(run.elapsedDays);

        // ── the pill, which could not reach this ──
        //
        // The old comment here read "striking the barrier on command is
        // deliberate but unaided: the cultivator chose the moment, and nothing
        // was bought for it", and no `pill` was passed at all. That is not a
        // house rule about deliberateness, it is the largest modifier in the
        // game switched off on the only path a player can reach:
        // `MAX_PILL_BONUS` is 0.35, five catalogued pills exist to supply it,
        // and it is the designed mitigation for the rungs the Ladder panel
        // itself calls the ones that kill. Four deaths at the 12->13 Foundation
        // boundary, all funded, healthy and inside the stagnation clock, were
        // spent on a preparation that could not be applied.
        //
        // The MCP path has always read it, and this now reads it the same way,
        // from the same flag, and spends it on the same terms: the pill is
        // recorded when it is SWALLOWED, no caller passes a potency, and the
        // attempt consumes what was actually taken.
        const pending = readJsonFlag<PendingPill>(this.db, cultivator.id, FLAG_PENDING_PILL);

        const result = attemptBreakthrough(cultivator, {
            // ── why the attempt count is in the stream ──
            //
            // A failed attempt advances the turn and not the clock, so `absDay`
            // and `realmOrdinal` were both unchanged on a retry and the next
            // attempt was the SAME ROLL. Measured at 400 consecutive identical
            // failures against a rung whose base odds are about 85%, with no
            // signal to the player that clicking again could not help.
            //
            // It also crashed. Injury ids are drawn from this stream, so the
            // second attempt regenerated an id already in the table and the
            // endpoint 500'd on `UNIQUE constraint failed:
            // cultivator_injuries.id` - reachable by double-clicking the
            // button. One stream fix answers both, because both were the same
            // fact: the engine could not tell two attempts apart.
            //
            // `run.turn` is the discriminator rather than a new counter,
            // because it is already the thing that advances on a failure and is
            // already persisted. Determinism is untouched: the same run
            // replayed makes the same attempts in the same order.
            rng: forStream(
                run.seed, 'breakthrough', absDay, cultivator.realmOrdinal, run.turn
            ),
            // ADMIN, and only ADMIN. The eligibility gate above has already
            // run and has already refused anybody who cannot legally attempt
            // this, so what is decided here is a crossing that was always
            // allowed to be tried. Read here, in the impure layer, and passed
            // in explicitly, because the resolver is pure.
            theAttemptLands: theRollLands('a_crossing'),
            ambient,
            turn: run.turn,
            pill: pending ? {
                name: pending.name,
                potency: pending.potency,
                // Both carried straight off the record written when it was
                // swallowed. A graded pill takes the real band curve; the
                // count is what makes the fifth one worth less than the first.
                ...(pending.grade ? { grade: pending.grade } : {}),
                priorPillsTaken: pending.priorPillsTaken ?? 0
            } : null,
            ranksGainedThisTurn: 0,
            // Deliberate, and now aided where the cultivator prepared for it.
            toll: {
                ...tollConditionsFor(this.repos, cultivator),
                preparation: DELIBERATE_PREPARATION
            },
            foundation: { preparation: DELIBERATE_PREPARATION, hurried: false }
        });

        const tollLines: string[] = [];
        /** What the crossing took out of the body, once it has been clamped. */
        let paidWithTheBody = 0;
        const after = this.db.transaction((): Cultivator => {
            for (const injury of result.injuriesSustained) {
                this.repos.cultivators.addInjury(cultivator.id, {
                    id: injury.id,
                    severity: injury.severity,
                    source: injury.source,
                    description: injury.description,
                    sustainedOnTurn: injury.sustainedOnTurn,
                    woundType: injury.woundType
                });
            }

            const advanced = result.outcome === 'success';

            // ── THE VESSEL, WHICH THIS PATH WAS NOT ENLARGING ────────────
            //
            // Measured: six crossings on command, ordinal 0 -> 6, `maxHp` 40
            // throughout and `maxQi` 25 throughout. The same six crossings
            // taken inside a seclusion grow both, because `applyTimeSkip` goes
            // through `advanceRealm` - so the two ways of climbing the same
            // ladder produced two different bodies, and the one a player
            // reaches by typing "I break through" produced a newborn's.
            //
            // `advanceRealm` documents itself as "the one function every rank
            // change in the codebase passes through" and it is not: this
            // deliberately avoids it, because it zeroes accumulated progress
            // and the engine's rule is that a successful attempt consumes
            // exactly `progressConsumed` with the overflow carrying. What was
            // missing is the half of `advanceRealm` that is about the BODY
            // rather than about the ledger, and `realms.ts` names the two
            // functions that own it - "the one derivation of a cultivator's HP
            // pool. Nobody may write another."
            //
            // Current health carries as a FRACTION, from the repository's own
            // exported helper rather than from a copy of its arithmetic. See
            // `a87d251`: an absolute carry leaves a whole cultivator at two per
            // cent of themselves after a large advance, and nothing in this
            // world says that climbing wounds you. What a crossing COSTS is a
            // separate question, decided by the resolver and charged below.
            const maxHp = maxHpForOrdinal(cultivator.attributes.might, result.toOrdinal);
            const maxQi = maxQiForOrdinal(cultivator.attributes.insight, result.toOrdinal);
            const carried = carriedAcross(cultivator.hp, cultivator.maxHp, maxHp);

            // ── AND WHAT ARRIVING COST THE BODY ─────────────────────────
            //
            // The design owner's ruling, and this is the path a player reaches
            // by typing. See `bodyCost` on `BreakthroughResultSchema`.
            //
            // Charged against the NEW pool, after the share has carried, so it
            // means the same thing at every rung and is not partly refunded by
            // the vessel growing underneath it. `bodyCost` is zero on every
            // failure and on a death, so this branch only ever fires on an
            // arrival.
            //
            // CLAMPED, and this path needs it most: `strikeBarrier` spends NO
            // DAYS, so somebody with banked progress can strike four times in an
            // afternoon and owe a whole pool with nothing mending in between.
            // The clamp is `whatACrossingTakesFrom`'s and not this caller's - a
            // crossing takes a share of the pool or a share of what is standing,
            // whichever is less - so the played verb and the auto-breakthrough
            // inside a seclusion cannot come to different answers about the same
            // price. See `A_CROSSING_MAY_NOT_TAKE_MORE_THAN`.
            paidWithTheBody = whatACrossingTakesFrom(carried, maxHp, result.bodyCost);

            let updated = this.repos.cultivators.update(cultivator.id, {
                realmOrdinal: result.toOrdinal,
                maxHp,
                maxQi,
                hp: carried - paidWithTheBody,
                qi: carriedAcross(cultivator.qi, cultivator.maxQi, maxQi),
                cultivationProgress: Math.max(0, cultivator.cultivationProgress - result.progressConsumed),
                yearsAtCurrentRealm: advanced ? 0 : cultivator.yearsAtCurrentRealm
            });
            if (!updated) throw new GameError('Cultivator vanished mid-breakthrough.', 500);

            // The engine cannot re-derive the foundation from the ordinal
            // later, so persisting it is the caller's job.
            if (result.foundationEstablished) {
                persistFoundation(this.repos, cultivator.id, result.foundationEstablished);
                updated = this.repos.cultivators.getById(cultivator.id) ?? updated;
            }

            // ── The crossing, and the field it was being dropped in ──
            //
            // `attemptBreakthrough` decides this and nothing here was writing
            // it down, so a cultivator could survive the last crossing, be told
            // in the narration that they had gone through, and still be
            // `immortalStatus: 'none'` on the next read. Everything the far
            // side is gated on reads that field - `canExistBeyondTheLid`,
            // `evaluateLidTransit`, `hasCrossedTheLid`, the sheet's own "the
            // ladder is finished for you" - so the whole of the top of the game
            // was unreachable by one missing assignment, which is why it took
            // playing at 46 with an admin-set status to notice anything else
            // was wrong up there.
            if (result.immortalStatusGained) {
                updated = this.repos.cultivators.update(cultivator.id, {
                    immortalStatus: result.immortalStatusGained
                } as never) ?? updated;
            }

            // Spent, whether it helped or not. A pill swallowed for a crossing
            // is gone the moment the crossing is attempted, and leaving the flag
            // set would make one pill boost every future attempt for free.
            if (pending) clearFlag(this.db, cultivator.id, FLAG_PENDING_PILL);

            // The instalment, charged in the same transaction as the crossing
            // that triggered it.
            if (result.toll) {
                persistToll(this.repos, run, cultivator.id, result.toll);
                tollLines.push(tollLine(result.toll));
                updated = this.repos.cultivators.getById(cultivator.id) ?? updated;
            }

            this.repos.runs.incrementTurn(run.id, 1);
            if (updated.realmOrdinal > run.peakOrdinal) {
                this.repos.runs.updatePeakOrdinal(run.id, updated.realmOrdinal);
            }

            if (result.outcome === 'death') {
                const cause = result.tribulation ? 'heavenly_tribulation' : 'failed_breakthrough';
                return this.repos.cultivators.markDead(
                    cultivator.id, cause, run.turn + 1, describeDeath(cause, updated)
                ) ?? updated;
            }
            return updated;
        })();

        const calls: ToolCallRecord[] = [{
            name: 'engine.attemptBreakthrough',
            action: 'breakthrough',
            summary:
                `${(result.finalChance * 100).toFixed(1)}% final chance, rolled ${result.roll.toFixed(4)} - ` +
                `${result.outcome}. ${result.narrationHint}`,
            ok: true
        }];
        for (const injury of result.injuriesSustained) {
            calls.push({
                name: 'cultivator.addInjury',
                action: 'injury_sustained',
                summary: `${injury.severity} meridian injury recorded: ${injury.description}`,
                ok: true
            });
        }
        calls.push({
            name: 'cultivator.update',
            action: 'persist',
            summary:
                `Rank ${cultivator.realmOrdinal} → ${after.realmOrdinal}; ` +
                `${Math.round(result.progressConsumed)} qi-units consumed, ` +
                `${Math.round(after.cultivationProgress)} left banked.`,
            ok: true
        });
        if (result.foundationEstablished) {
            calls.push({
                name: 'engine.assessFoundation',
                action: 'foundation_established',
                summary: `Foundation laid: ${result.foundationEstablished}. It is what every later rank stands on.`,
                ok: true
            });
        }
        if (pending) {
            calls.push({
                name: 'cultivator.consumePill',
                action: 'pill_spent',
                summary:
                    `${pending.name} was spent on this attempt at potency ${pending.potency}. `
                    + 'Read from the flag it was recorded on when it was swallowed; no caller '
                    + 'passes a potency, and it is cleared whether the attempt landed or not.',
                ok: true
            });
        }
        if (result.immortalStatusGained) {
            calls.push({
                name: 'cultivator.update',
                action: 'crossing_recorded',
                summary:
                    `immortalStatus = ${result.immortalStatusGained}. `
                    + (result.immortalStatusGained === 'true_immortal'
                        ? 'The ladder is finished and the layer has changed. Mortal-world verbs '
                          + 'stop applying and the two that replace them - descend, and the '
                          + 'channel - open.'
                        : 'The crossing was survived and not completed. The Lid does not open '
                          + 'twice for the same name, and rank stops moving here.'),
                ok: true
            });
        }
        calls.push(...tollCalls(tollLines));
        if (result.outcome === 'death') {
            calls.push({
                name: 'cultivator.markDead',
                action: 'death',
                summary: `Run closed: ${result.tribulation ? 'heavenly_tribulation' : 'failed_breakthrough'}. Permadeath - no reload.`,
                ok: true
            });
        }

        const facts = factsForBreakthrough(cultivator, after, result, ambient, paidWithTheBody);
        facts.lines.push(...tollLines);
        if (result.bodyCost > 0) {
            facts.structure.push(
                `Body cost: ${(result.bodyCost * 100).toFixed(0)}% of the pool - `
                + `${Math.round(after.maxHp * result.bodyCost)} of ${after.maxHp} at the rung `
                + `arrived at - and ${paidWithTheBody} was taken. `
                + (paidWithTheBody < Math.round(after.maxHp * result.bodyCost)
                    ? 'The rest was clamped: a crossing that succeeded may not kill by '
                      + 'arithmetic, so at least one point is always left.'
                    : 'Nothing was clamped; the body carried the whole of it.')
                + ' Charged against the pool at the rung arrived at, after the share carried '
                + 'across, so the vessel growing does not refund it.'
            );
        }

        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: result,
            outcome: 'executed',
            calls
        };
    }
};
