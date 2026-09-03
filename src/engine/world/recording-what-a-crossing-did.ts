/**
 * Recording what a crossing did: the largest day of a cultivator's life,
 * finally written down.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE MEASUREMENT THIS EXISTS FOR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `attemptBreakthrough` returns which wall was struck, which trial came, what
 * the roll was, which row of the failure registry was drawn, what wound it left,
 * how many years it burned, what it did to the soul, whether the structure set,
 * and whether this person will ever cross a boundary again. The world layer
 * applied every one of those to the record and wrote NOTHING to the ledger.
 *
 * So the single richest event in a cultivator's life did not happen, as far as
 * the world's own history was concerned. A biography read out of the ledger came
 * back as deaths and inheritances - four murders and an estate - because the
 * climb, which is the entire subject of the game, left no trace.
 *
 * ── Failures are the half that matters most ──────────────────────────────
 *
 * A success is a line. A failure is a life: which trial arrived, what it took,
 * and what they are carrying afterwards. `what-goes-wrong-at-a-realm-boundary.ts`
 * exists to produce people rather than corpses - somebody who struck at a wall,
 * cracked, survived and is standing at their rung finished - and until now
 * nothing recorded that it had happened to them. The wound was on the record with
 * no day and no cause attached.
 *
 * ── Nothing here decides anything ────────────────────────────────────────
 *
 * Every field written is read straight off the `BreakthroughResult` the engine
 * already produced. This module has no arithmetic, no thresholds and no
 * randomness: it is the reporting half of a decision taken elsewhere, which is
 * the same contract `digest.ts` holds. If a summary and the result disagree, the
 * summary is what is wrong.
 */

import { FALSE_IMMORTAL_ORDINAL, rankName, realmForOrdinal } from '../cultivation/realms.js';
import { getWoundType } from '../../data/cultivation/wounds.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { makeFact, type HistoricalFact } from './history.js';
import type { NpcRecord } from './npc-state.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import type { WorldState } from './world-state.js';
import type { BreakthroughResult } from '../../schema/cultivation.js';

/**
 * How a crossing is visible from outside.
 *
 * A realm boundary is felt. A sub-rank step is a private morning, and writing it
 * to the ledger at all would put thirteen rows in a Qi Condensation life for the
 * thirteen layers - which is the noise this ledger has just been cleared of. So
 * only boundaries, tribulations and endings are recorded, and the ordinary steps
 * between them are what `realmOrdinal` is for.
 */
function worthRecording(result: BreakthroughResult): boolean {
    if (result.outcome === 'death') return true;
    if (result.crossing) return true;
    if (result.tribulation) return true;
    if (result.immortalStatusGained) return true;
    if (result.arrivedBroken || result.brokenStatusCleared) return true;
    // A realm boundary either way. `realmForOrdinal` is the authority on where
    // the boundaries are, so adding a realm needs no change here.
    return realmForOrdinal(result.toOrdinal).key !== realmForOrdinal(result.fromOrdinal).key;
}

function ageAt(npc: NpcRecord, day: number): number {
    return Math.max(0, Math.floor((day - npc.identity.bornOnDay) / DAYS_PER_YEAR));
}

/** The wound a crossing left, named from the catalog rather than by severity. */
function woundPhrase(result: BreakthroughResult): string {
    const named = result.arrivedBroken ?? result.injuriesSustained.find(i => i.woundType)?.woundType;
    const row = getWoundType(named ?? null);
    if (row) return row.name.toLowerCase();
    const worst = result.injuriesSustained[0];
    return worst ? `a ${worst.severity} injury` : '';
}

/**
 * What the crossing did, as one factual sentence.
 *
 * Engine-authored and narrator-rendered, like every other summary in the ledger.
 * It states the wall, the outcome and the cost, and it says nothing about how
 * anybody felt about it.
 */
export function describeCrossing(npc: NpcRecord, result: BreakthroughResult, day: number): string {
    const age = ageAt(npc, day);
    const from = rankName(result.fromOrdinal);
    const to = rankName(result.toOrdinal);

    if (result.outcome === 'death') {
        return result.tribulation
            ? `${npc.name} took the tribulation at ${from} at ${age} and did not survive it.`
            : `${npc.name} struck at the wall out of ${from} at ${age} and the wall closed.`;
    }

    if (result.outcome === 'success') {
        const parts = [`${npc.name} crossed from ${from} into ${to} at ${age}.`];
        if (result.foundationEstablished) {
            parts.push(`The foundation set ${result.foundationEstablished}.`);
        }
        if (result.arrivedBroken) {
            const row = getWoundType(result.arrivedBroken);
            parts.push(`They arrived carrying ${row ? row.name.toLowerCase() : result.arrivedBroken}, and will not cross again.`);
        }
        if (result.brokenStatusCleared) {
            const row = getWoundType(result.brokenStatusCleared);
            parts.push(`The crossing reseated ${row ? row.name.toLowerCase() : result.brokenStatusCleared}.`);
        }
        if (result.immortalStatusGained) {
            parts.push(result.immortalStatusGained === 'true_immortal'
                ? 'The Lid opened and they went through it.'
                : 'The Lid opened and they did not go all the way through.');
        }
        return parts.join(' ');
    }

    // A failure, which is the half worth writing properly.
    const parts = [`${npc.name} struck at the wall out of ${from} at ${age} and it held.`];
    if (result.crossing) {
        parts.push(`The ${result.crossing.trial.replace(/_/g, ' ')} came.`);
        const wound = woundPhrase(result);
        if (wound) parts.push(`They came away with ${wound}.`);
        if (result.crossing.yearsBurned > 0) {
            parts.push(`It cost ${Math.round(result.crossing.yearsBurned)} years off the span.`);
        }
        if (result.crossing.soulStateFloor) {
            parts.push(`The soul came back ${result.crossing.soulStateFloor}.`);
        }
        if (result.crossing.foundationQuality) {
            parts.push(`The foundation is ${result.crossing.foundationQuality}.`);
        }
        if (result.crossing.halted) {
            parts.push('They will not cross another boundary.');
        }
    } else {
        const wound = woundPhrase(result);
        if (wound) parts.push(`They came away with ${wound}.`);
    }
    return parts.join(' ');
}

/**
 * Write the crossing to the ledger.
 *
 * Returns null where the attempt was an ordinary sub-rank step, which is most of
 * them and is deliberately not recorded - see {@link worthRecording}.
 *
 * `recur: false`, because two crossings by the same person at the same wall are
 * two events in that life even where the sentence comes out identical. A
 * cultivator who fails at Core Formation twice failed twice, and folding them
 * would be the one place the deduplication would destroy the thing it was built
 * to protect.
 */
export function recordCrossing(
    state: WorldState,
    npc: NpcRecord,
    result: BreakthroughResult,
    day: number
): HistoricalFact | null {
    if (!worthRecording(result)) return null;

    const died = result.outcome === 'death';
    const succeeded = result.outcome === 'success';
    const ordinal = succeeded ? result.toOrdinal : result.fromOrdinal;

    return appendWorldFact(state, makeFact({
        day,
        // Three kinds the ledger already had a word for, so a reader filtering
        // for crossings gets crossings and not the attempts that failed.
        kind: died ? 'death' : succeeded ? 'realm_crossing' : 'breakthrough',
        // A crossing at the top of the ladder is felt further than one at the
        // bottom. Read off the rung rather than chosen, like everything else.
        //
        // GOING THROUGH THE LID IS THE ONE THAT IS `world`, and it is the only
        // event in this file that reaches the top of `SCALE_REACH`. It is not a
        // thumb on the scale for a dramatic moment: `airtimeOf` weights a fact
        // by scale and by how far above the teller the people in it stand, and
        // at `continental` a crossing of the Lid could be out-talked by an
        // ordinary regional deed with a high-ordinal house attached. Somebody
        // leaving the world entirely is not a continental event.
        //
        // Read off `FALSE_IMMORTAL_ORDINAL` rather than the status field, so a
        // half-completed crossing - over the Lid and not through it - carries
        // the same reach. Both are somebody who left the ladder.
        scale: ordinal >= FALSE_IMMORTAL_ORDINAL
            ? 'world'
            : ordinal >= 34 ? 'continental' : ordinal >= 20 ? 'regional' : 'local',
        summary: describeCrossing(npc, result, day),
        actors: [{
            id: npc.id,
            name: npc.name,
            role: died ? 'deceased' : succeeded ? 'crossed' : 'struck'
        }],
        locationId: npc.locationId,
        factionIds: npc.factionId ? [npc.factionId] : [],
        // A tribulation is lightning visible for a very long way. Everything
        // else at a wall happens where nobody was invited - which is
        // `CROSSING_PRACTICE` stating that secrecy is the practice.
        visibility: result.tribulation ? 'public' : succeeded ? 'faction' : 'secret',
        magnitude: Math.min(1, 0.2 + ordinal * 0.02 + (died ? 0.2 : 0)),
        // The engine knows exactly what happened. Whether anybody else ever
        // does is the knowledge layer's question.
        causeKnown: true,
        data: {
            outcome: result.outcome,
            fromOrdinal: result.fromOrdinal,
            toOrdinal: result.toOrdinal,
            finalChance: Number(result.finalChance.toFixed(4)),
            trial: result.crossing?.trial ?? null,
            crossingOutcome: result.crossing?.outcome ?? null,
            yearsBurned: result.crossing?.yearsBurned ?? 0,
            halted: result.crossing?.halted ?? false,
            arrivedBroken: result.arrivedBroken,
            brokenStatusCleared: result.brokenStatusCleared,
            immortalStatus: result.immortalStatusGained,
            tribulationStrikes: result.tribulation?.strikes ?? 0
        }
    }), { recur: false });
}
