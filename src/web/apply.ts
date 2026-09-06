/**
 * Writing a time-skip to the database.
 *
 * `simulateTimeSkip` is pure: it mutates nothing and hands back deltas plus a
 * digest. Somebody has to turn that into rows, and this is the only place in
 * `src/web` that does - which makes it the one function to read when asking
 * "can a narrator's output reach the database?". The signature answers it: this
 * takes a `TimeSkipResult` and no prose.
 *
 * ── Why almost nothing is implemented here ────────────────────────────────
 * The MCP tool layer already persists skips, and it writes to the SAME database
 * this server does. Two implementations of "what a crossing took" or "how many
 * years at this realm" would eventually disagree, and the disagreement would be
 * a corrupted save rather than a failing test. So the derivations, the injury
 * reconstruction and the toll are all taken from
 * `src/server/consolidated/cultivation-support.ts` verbatim:
 *
 *   skipEndState            absolute end state, including the three counters
 *                           that reset mid-skip (`yearsAtCurrentRealm`,
 *                           `starvationTurns`, `bleedingTurns`)
 *   (injuries come straight off the engine result now - see below)
 *   persistToll             the price of a crossing - and the delete behind it
 *
 * This module owns only the ordering and the transaction.
 *
 * ── AND THE THREE WRITES THE PLAY LOOP WAS NOT MAKING ────────────────────
 *
 * The tool path at `cultivation-manage.ts` was a second copy of this function,
 * and the copies had drifted in exactly three load-bearing ways. Everything a
 * player did through the command bar went down one write short of everything
 * the same action did through the tool:
 *
 *   persistImmortalStatus  A skip can resolve the last crossing.
 *                          `migrations.cultivation.ts` says that column is what
 *                          enforces the Lid bar - a `false_immortal` is what
 *                          bars every further attempt - so a played life that
 *                          crossed could cross AGAIN. The Lid opened twice.
 *   persistVisions         Beliefs with no fact behind them, computed by the
 *                          engine and discarded by the play loop.
 *   recordRankGained       The peak-rank ledger row, so a played life's peak
 *                          survived its later decline only on the tool path.
 *
 * The injuries too: the copy wrote `id`, `cultivationPenalty`,
 * `breakthroughPenalty` and `treated`, and this one dropped all four, so a
 * played wound came back with the engine's penalties gone.
 *
 * They are here now, which is a BEHAVIOUR CHANGE and not a tidy-up: the play
 * loop starts enforcing a bar it has never enforced.
 */

import type { Cultivator, Run, TimeSkipResult } from '../schema/cultivation.js';
import { describeDeath } from '../engine/cultivation/survival.js';
import {
    persistFoundation,
    persistImmortalStatus,
    persistToll,
    persistUnderstanding,
    persistVisions,
    recordRankGained,
    skipEndState,
    type CultivationRepos,
    type TollApplication
} from '../server/consolidated/cultivation-support.js';
import type { Injury } from '../schema/cultivation.js';

export interface ApplySkipInput {
    before: Cultivator;
    run: Run;
    skip: TimeSkipResult;
    /** Location to record afterwards, when the action moved the cultivator. */
    location?: string;
}

export interface ApplySkipResult {
    cultivator: Cultivator;
    run: Run;
    /** Injuries written to the database as a result of this skip. */
    injuries: Injury[];
    /** Engine-authored lines for every price a crossing exacted. */
    tollLines: string[];
    /**
     * What each toll actually removed, in the order the tolls came.
     *
     * Reported so a caller can show that what the ledger names was genuinely
     * deleted rather than merely recorded - which is the difference between a
     * crossing that took something and a crossing that said it did.
     */
    tollApplications: TollApplication[];
    /** Comprehensions written this skip, and the achievements behind them. */
    understanding: { insights: number; achievements: number };
}

/**
 * Persist a skip.
 *
 * One transaction, because a save that has the injuries but not the aging, the
 * death but not the peak rank, or the boundary crossing but not the price it
 * exacted, is worse than a save that has neither.
 */
export function applyTimeSkip(repos: CultivationRepos, input: ApplySkipInput): ApplySkipResult {
    const { before, run, skip } = input;

    const end = skipEndState(before, skip);
    // The engine hands back the actual Injury records. This used to be
    // reconstructed by parsing the engine's own narration strings, which was
    // exact and one reworded sentence away from silently persisting the wrong
    // wound.
    const injuries = skip.injuriesSustained;
    const ranksGained = Math.max(0, end.realmOrdinal - before.realmOrdinal);
    const nextTurn = run.turn + 1;
    const tollLines: string[] = [];
    const tollApplications: TollApplication[] = [];
    let understanding = { insights: 0, achievements: 0 };

    const persist = repos.db.transaction(() => {
        for (const injury of injuries) {
            repos.cultivators.addInjury(before.id, {
                // The engine's own record, whole. Its id, its name and its two
                // penalties were all being dropped here and written on the tool
                // path, so one wound meant two different things depending on
                // which door the player came through.
                id: injury.id,
                severity: injury.severity,
                source: injury.source,
                description: injury.description,
                sustainedOnTurn: injury.sustainedOnTurn,
                woundType: injury.woundType,
                cultivationPenalty: injury.cultivationPenalty,
                breakthroughPenalty: injury.breakthroughPenalty,
                treated: injury.treated
            });
        }

        if (ranksGained > 0) {
            repos.cultivators.advanceRealm(before.id, ranksGained);
        }

        // Every price a crossing exacted, in the same transaction as the rank it
        // was exacted for. `persistToll` is what turns "the crossing took your
        // Nine Severing Threads" from an assertion into a delete.
        for (const toll of skip.tolls ?? []) {
            tollApplications.push(persistToll(repos, run, before.id, toll));
            tollLines.push(tollLine(toll));
        }

        // The engine cannot re-derive a foundation from the ordinal afterwards,
        // so the caller is required to persist it. `persistFoundation` refuses
        // to overwrite an existing one, which is why an out-of-order write
        // cannot upgrade a cracked foundation into a flawless one.
        if (skip.foundationEstablished) {
            persistFoundation(repos, before.id, skip.foundationEstablished);
        }

        // THE LID. A skip can resolve the last crossing, and the ordinal does
        // not encode the result. `immortal_status` is what bars every further
        // attempt; without this write a played life that crossed could cross
        // again.
        if (skip.immortalStatusGained) {
            persistImmortalStatus(repos, before.id, skip.immortalStatusGained);
        }

        // ── What they understood, which was being thrown away ──────────────
        //
        // `simulateTimeSkip` returns `insightsGained` and `achievements` and
        // this function persisted neither, so every comprehension a played
        // life produced was computed, narrated and discarded. The MCP tool
        // layer has always written them (`cultivation-manage.ts`), which is
        // exactly the divergence the header of this file exists to prevent:
        // the same skip persisted one way through a tool and another way
        // through the command bar.
        //
        // It is the same call the tool surface makes, on the same rows, so the
        // two paths cannot disagree about what a life understood.
        understanding = persistUnderstanding(
            repos, before.id, skip.insightsGained, skip.achievements
        );
        // Beliefs with no fact behind them. They go to the knowledge layer and
        // never to the cultivator's capability.
        persistVisions(repos.db, skip.visions);

        // Deltas are computed against the row as it stands AFTER the advance,
        // because advanceRealm zeroes progress and the stagnation clock; these
        // put back whatever the simulation actually ended on.
        const mid = repos.cultivators.getById(before.id)!;
        repos.cultivators.applyDeltas(before.id, {
            hp: end.hp - mid.hp,
            qi: end.qi - mid.qi,
            satiety: end.satiety - mid.satiety,
            starvationTurns: end.starvationTurns - mid.starvationTurns,
            bleedingTurns: end.bleedingTurns - mid.bleedingTurns,
            // ── THE PURSE IS A DELTA, NOT AN END STATE ───────────────────
            //
            // Every other field here is written ABSOLUTELY, and correctly: the
            // skip owns the body and the clock, `advanceRealm` has just moved
            // some of them, and `end` is the only right answer for where they
            // finished. The purse is the one field that is not exclusively the
            // skip's, and writing it absolutely silently REVERTED any spend
            // made between the caller's snapshot and this call.
            //
            // Measured in a live run, four bribes in a row:
            //
            //     "It was taken, and 60 spirit stones went with it."   67 -> 67
            //     "It was taken, and  5 spirit stones went with it."   67 -> 67
            //     "It was taken, and 10 spirit stones went with it."   67 -> 68
            //
            // The last is the tell, and it is not a second bug. The debit did
            // land - 67 to 57 - and then `end - mid`, where `end` is
            // `before + skipDelta` and `before` is the snapshot taken BEFORE
            // the debit, wrote the purse back to the old base plus the span's
            // own income. The player was told ten stones left their hand and
            // finished the turn one richer.
            //
            // That is the cardinal rule in AGENTS.md broken in its most literal
            // form: prose asserting an outcome the state never recorded. So the
            // skip now applies WHAT IT SPENT rather than asserting what it
            // believes the total should be. Where nothing wrote in between,
            // `mid` and `before` hold the same purse and the two expressions
            // are identical - they differ in exactly the case that was broken,
            // which is why this is the general fix and not one caller
            // reordering its own writes.
            spiritStones: end.spiritStones - before.spiritStones,
            cultivationProgress: end.cultivationProgress - mid.cultivationProgress,
            age: end.age - mid.age,
            yearsAtCurrentRealm: end.yearsAtCurrentRealm - mid.yearsAtCurrentRealm
        });

        if (input.location !== undefined && input.location !== before.location) {
            repos.cultivators.update(before.id, { location: input.location });
        }

        repos.techniques.tickCooldowns(before.id, Math.floor(skip.simulatedDays));

        // The clock is advanced BEFORE the run is closed: advanceDays and
        // incrementTurn only touch active runs, and a death stops the clock at
        // the day it happened rather than the day that was asked for.
        repos.runs.advanceDays(run.id, skip.simulatedDays);
        repos.runs.incrementTurn(run.id, 1);

        // The peak survives the decline, and the death. Stamped at the moment
        // the rank is reached, which is here.
        if (ranksGained > 0) recordRankGained(repos.db, before.id, nextTurn, ranksGained);

        if (skip.died && skip.deathCause) {
            repos.cultivators.markDead(
                before.id,
                skip.deathCause,
                nextTurn,
                describeDeath(skip.deathCause, {
                    name: before.name,
                    realmOrdinal: end.realmOrdinal,
                    age: end.age
                })
            );
        }
    });
    persist();

    return {
        cultivator: repos.cultivators.getById(before.id)!,
        run: repos.runs.getById(run.id)!,
        injuries,
        tollLines,
        tollApplications,
        understanding
    };
}

/** The engine's own account of an instalment, for the log and the inspector. */
export function tollLine(toll: TimeSkipResult['tolls'][number]): string {
    if (toll.outcome !== 'taken' || !toll.taken) {
        return toll.narrationHint || `Nothing was cut away at this boundary (${toll.outcome}).`;
    }
    return (
        `${toll.narrationHint} The crossing took ${toll.taken.label} (${toll.taken.kind}). ` +
        `${toll.taken.reason} It is gone from the record, not merely marked.`
    );
}
