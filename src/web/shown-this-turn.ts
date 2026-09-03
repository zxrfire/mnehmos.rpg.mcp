/**
 * What a turn put in front of the player, and the one place it gets written down.
 *
 * ── THE RULE ─────────────────────────────────────────────────────────────
 *
 *   IF THE ENGINE SHOWED IT, THE PLAYER KNOWS IT.
 *
 * Not "if a name appears in the prose" - the narrator can say anything, and a
 * house named inside a rumour the player was told is unreliable is not a fact
 * they hold. What this records is what the ENGINE DECIDED to show: the holder of
 * the ground it read, the people the presence gate admitted, the face of a site
 * it opened. That is the honest reading of "the game showed you", and it is the
 * only one that can carry a source.
 *
 * ── WHY THIS EXISTS RATHER THAN ANOTHER CALL SITE ────────────────────────
 *
 * Knowledge was written by whoever happened to be holding the player at the
 * time. `noteEncounter` has fourteen call sites across six files, and every new
 * perception meant remembering to add a fifteenth - which is how a house named
 * to the player three times in one session could still be `unaware`. A verb that
 * forgets is indistinguishable from a verb that decided not to.
 *
 * So a producer DECLARES what it showed and the turn boundary writes it. One
 * seam, one writer, as many declarations as there are things to show.
 *
 * ── AND IT DOES NOT WIDEN PERCEPTION ─────────────────────────────────────
 *
 * This writes down what was perceived. It never decides that anything WAS. Every
 * gate upstream still rules - the presence gate, `whoHoldsTheGround`,
 * `nameableSites`, the awareness ladder - and a producer that shows nothing
 * declares nothing. A perception with an empty `names` is the ordinary case.
 *
 * ── THE STAGE IS THE SOURCE'S, NEVER THE PRODUCER'S WISH ─────────────────
 *
 * Every write goes through `learnIfNew`, so `stageFromSource` clamps whatever is
 * asked for down to what that source could actually have delivered. A producer
 * may aim BELOW its ceiling deliberately - standing on a house's ground is
 * `witnessed` and grants `named`, because being somewhere tells you whose it is
 * and nothing about their politics - and may never aim above it.
 *
 * PURE apart from the write itself. No I/O beyond the knowledge gate, no RNG.
 */

import type { KnowingStage } from '../engine/social/discovery.js';
import type { SourceKind } from '../engine/social/knowledge.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { SpeakableName } from './hearsay.js';
import type { KnowledgeGate } from './knowledge.js';

/**
 * One thing a turn put in front of the player, with its provenance.
 *
 * {@link Hearing} is structurally one of these plus the two fields only a spoken
 * one needs - who said it, and the words - so the hearsay channel keeps its own
 * shape and still goes through this writer. Anything that is not somebody
 * talking uses this bare.
 */
export interface Perception {
    /** What was shown. Empty is ordinary: most turns show nothing new. */
    names: SpeakableName[];
    /** Engine-authored provenance. Goes on the row and is shown to the narrator. */
    note: string;
    /**
     * How the player came by it, in the knowledge layer's own vocabulary.
     *
     * `SourceKind` itself rather than a narrowed list, because the ceiling
     * table in `discovery.ts` is keyed on the whole enum and a subset here
     * would be a second, quietly different vocabulary.
     */
    sourceKind: SourceKind;
    /** The default for names that do not carry their own. Clamped by the source. */
    stage?: KnowingStage;
    /** How much of a fact this is, for the record. Never reaches a prompt. */
    confidence?: number;
}

/**
 * Write down everything one perception showed, and say what was new.
 *
 * Returns only the names that moved somebody up the ladder, so a caller can tell
 * the difference between showing somebody a house for the first time and showing
 * them one they have known for years. `recordHearing` uses exactly that to
 * decide whether a hearing is worth narrating at all.
 */
export function recordPerception(
    gate: KnowledgeGate,
    cultivator: Cultivator,
    run: Run,
    perceived: Perception
): SpeakableName[] {
    const learned: SpeakableName[] = [];
    for (const name of perceived.names) {
        const stage = name.stage ?? perceived.stage ?? 'whisper';
        const isNew = gate.learnIfNew({
            holderId: cultivator.id,
            kind: name.kind,
            id: name.id,
            name: name.name,
            onDay: Math.floor(run.elapsedDays),
            sourceKind: perceived.sourceKind,
            sourceNote: perceived.note,
            stage,
            confidence: perceived.confidence,
            statement:
                name.statement
                ?? `${name.name} is a name that got said. What it is remains unknown.`
        });
        if (isNew) learned.push(name);
    }
    return learned;
}
