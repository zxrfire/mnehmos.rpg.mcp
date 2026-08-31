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
 *   skipEndState            absolute end state, including the two values the
 *                           digest does not return (`yearsAtCurrentRealm`,
 *                           `starvationTurns`)
 *   reconstructSkipInjuries the wounds, rebuilt from engine-written facts
 *   persistToll             the price of a crossing - and the delete behind it
 *
 * This module owns only the ordering and the transaction.
 */

import type { Cultivator, Run, TimeSkipResult } from '../schema/cultivation.js';
import { describeDeath } from '../engine/cultivation/survival.js';
import {
    persistFoundation,
    persistToll,
    reconstructSkipInjuries,
    skipEndState,
    type CultivationRepos,
    type ReconstructedInjury
} from '../server/consolidated/cultivation-support.js';

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
    injuries: ReconstructedInjury[];
    /** Engine-authored lines for every price a crossing exacted. */
    tollLines: string[];
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
    const injuries = reconstructSkipInjuries(skip, run.turn);
    const ranksGained = Math.max(0, end.realmOrdinal - before.realmOrdinal);
    const nextTurn = run.turn + 1;
    const tollLines: string[] = [];

    const persist = repos.db.transaction(() => {
        for (const injury of injuries) {
            repos.cultivators.addInjury(before.id, {
                severity: injury.severity,
                source: injury.source,
                description: injury.description,
                sustainedOnTurn: injury.sustainedOnTurn
            });
        }

        if (ranksGained > 0) {
            repos.cultivators.advanceRealm(before.id, ranksGained);
        }

        // Every price a crossing exacted, in the same transaction as the rank it
        // was exacted for. `persistToll` is what turns "the crossing took your
        // Nine Severing Threads" from an assertion into a delete.
        for (const toll of skip.tolls ?? []) {
            persistToll(repos, run, before.id, toll);
            tollLines.push(tollLine(toll));
        }

        // The engine cannot re-derive a foundation from the ordinal afterwards,
        // so the caller is required to persist it. `persistFoundation` refuses
        // to overwrite an existing one, which is why an out-of-order write
        // cannot upgrade a cracked foundation into a flawless one.
        if (skip.foundationEstablished) {
            persistFoundation(repos, before.id, skip.foundationEstablished);
        }

        // Deltas are computed against the row as it stands AFTER the advance,
        // because advanceRealm zeroes progress and the stagnation clock; these
        // put back whatever the simulation actually ended on.
        const mid = repos.cultivators.getById(before.id)!;
        repos.cultivators.applyDeltas(before.id, {
            hp: end.hp - mid.hp,
            qi: end.qi - mid.qi,
            satiety: end.satiety - mid.satiety,
            starvationTurns: end.starvationTurns - mid.starvationTurns,
            spiritStones: end.spiritStones - mid.spiritStones,
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
        tollLines
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
