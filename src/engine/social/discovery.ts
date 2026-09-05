/**
 * The ladder of knowing: how a name gets from "never spoken near you" to
 * "you have dealt with it, and it has dealt with you".
 *
 * `docs/world/houses/discovery.md` specifies six stages and this file is the
 * whole of the mechanism:
 *
 *     unaware        the name has never been spoken near you
 *     whisper        an elder mentions something, imprecisely, and changes the subject
 *     named          you know it exists and roughly what it is. Nothing more.
 *     placed         you know where, or who, or when
 *     encountered    you have been in a room with it
 *     known          you have dealt with it, and it has dealt with you
 *
 * NOTHING BESPOKE. No stage table, no discovery table, no second store: a stage
 * is a `stage:<stage>` tag on an ORDINARY knowledge record. Everything here is
 * pure - it reads records and returns stages, and the writing is somebody
 * else's job.
 *
 * EACH STEP NEEDS A SOURCE, AND THE SOURCE CAPS THE STEP.
 * {@link stageCeilingFor} is that rule: a thing OVERHEARD through a wall never
 * rises above `whisper` on the strength of having been overheard, however many
 * times it happens. A holder can still reach `known` from a whisper by hearing
 * it again from somebody better placed, by asking, by going - what they cannot
 * do is get there by re-hearing the same wall.
 *
 * STAGES NEVER FALL. {@link advanceStage} is monotone, and a second hearing
 * from a worse source is written and kept rather than overwriting: "a name from
 * a drunk carter and a name from a sect archivist are different facts", and the
 * holder's current stage is the highest live one.
 *
 * KNOWING IS NOT ACCESS. No predicate here consults a realm, a threshold, an
 * admission bar or a faction. Reaching `placed` on a sect's ground means the
 * holder can say where it is and set out for it; whether the gate opens is the
 * location layer's question.
 */

import type { KnowledgeRecord, SourceKind, Stance } from './knowledge.js';

export type KnowingStage =
    | 'unaware'
    | 'whisper'
    | 'named'
    | 'placed'
    | 'encountered'
    | 'known';

/** In order, lowest first. The index is the rank. */
export const KNOWING_STAGES: readonly KnowingStage[] = [
    'unaware', 'whisper', 'named', 'placed', 'encountered', 'known'
] as const;

/**
 * What each stage means, in the doc's own words. Kept here rather than restated
 * at call sites, because five paraphrases of "you know where, or who, or when"
 * is how a ladder quietly acquires a seventh rung nobody agreed to.
 */
export const STAGE_MEANING: Record<KnowingStage, string> = {
    unaware: 'The name has never been spoken near them.',
    whisper: 'A word got said. What it refers to is not known and cannot be worked out.',
    named: 'They know it exists and roughly what it is. Nothing more.',
    placed: 'They know where, or who, or when.',
    encountered: 'They have been in a room with it.',
    known: 'They have dealt with it, and it has dealt with them.'
};

export function stageRank(stage: KnowingStage): number {
    const at = KNOWING_STAGES.indexOf(stage);
    return at < 0 ? 0 : at;
}

export function isAtLeast(stage: KnowingStage, floor: KnowingStage): boolean {
    return stageRank(stage) >= stageRank(floor);
}

/** The higher of two stages. Used to collapse several rows into one position. */
export function highestStage(a: KnowingStage, b: KnowingStage): KnowingStage {
    return stageRank(a) >= stageRank(b) ? a : b;
}

/**
 * The floor at which a name may be SAID in front of the holder. `whisper` is
 * the whole design: a name arrives long before its meaning does, and the player
 * holds the word with no way to evaluate it.
 */
export const NAMEABLE_FROM: KnowingStage = 'whisper';

/**
 * The floor at which the holder can point at a thing in the world. Below
 * `placed` a name is a sound: somebody who heard "Iron Gate" through a wall
 * cannot set out for it, not knowing whether it is a town or a person. This is
 * the predicate a travel verb wants and NOT one about being let in.
 */
export const REACHABLE_FROM: KnowingStage = 'placed';

/** True when the holder has enough of a record for the name to be spoken. */
export function canName(stage: KnowingStage): boolean {
    return isAtLeast(stage, NAMEABLE_FROM);
}

/** True when the holder could point at it, set out for it, or ask after it. */
export function canPointAt(stage: KnowingStage): boolean {
    return isAtLeast(stage, REACHABLE_FROM);
}

/**
 * The highest stage a single acquisition from this source can deliver.
 *
 *   overheard   whisper. It was not for them, they cannot ask, and acting on
 *               it exposes where they were standing.
 *   assumed     whisper. Somebody filled a gap with a proper noun.
 *   fabricated  whisper. A lie is an acquisition, not a step up the ladder.
 *   inferred    named. Working it out yourself gets what it is, not where.
 *   told        placed. The ordinary route, and why travellers matter.
 *   read        placed. An archive says where, who and when, and no more.
 *   divined     placed.
 *   confessed   known. Somebody dealing with you about their own business.
 *   witnessed   known. You were there.
 *
 * Nothing consults who the speaker was. A sect archivist and a drunk carter are
 * both `told`, and the difference is the `source_note` and the confidence on
 * the row rather than a rung. The carter's may still be the true one.
 */
export function stageCeilingFor(source: SourceKind): KnowingStage {
    switch (source) {
        case 'witnessed':
        case 'confessed':
        // Taken out of a mind, as direct as an acquisition gets. The cap that
        // does the work is not here: `whatASoulSearchTakes` holds every row to
        // the stage the SUBJECT held it at.
        case 'taken':
            return 'known';
        case 'told':
        case 'read':
        case 'divined':
            return 'placed';
        case 'inferred':
            return 'named';
        case 'overheard':
        case 'assumed':
        case 'fabricated':
        default:
            return 'whisper';
    }
}

/** Clamp a claimed stage to what the source could actually have delivered. */
export function stageFromSource(source: SourceKind, wanted: KnowingStage): KnowingStage {
    const ceiling = stageCeilingFor(source);
    return isAtLeast(wanted, ceiling) ? ceiling : wanted;
}

export const STAGE_TAG_PREFIX = 'stage:';

export function stageTag(stage: KnowingStage): string {
    return `${STAGE_TAG_PREFIX}${stage}`;
}

export function stageFromTags(tags: readonly string[]): KnowingStage | null {
    for (const tag of tags) {
        if (!tag.startsWith(STAGE_TAG_PREFIX)) continue;
        const value = tag.slice(STAGE_TAG_PREFIX.length) as KnowingStage;
        if (KNOWING_STAGES.includes(value)) return value;
    }
    return null;
}

/**
 * How firmly somebody at this stage holds the claim. The ladder maps ONTO the
 * stance vocabulary rather than beside it, so a row stays readable by the
 * queries and narrator paths that have never heard of stages.
 */
export function stanceForStage(stage: KnowingStage): Stance {
    switch (stage) {
        case 'unaware': return 'ignorant';
        case 'whisper': return 'suspects';
        case 'named': return 'believes';
        case 'placed': return 'believes';
        default: return 'knows';
    }
}

/** How sure somebody at this stage is, by default. Stored, never recomputed. */
export function confidenceForStage(stage: KnowingStage): number {
    switch (stage) {
        case 'unaware': return 0;
        case 'whisper': return 0.2;
        case 'named': return 0.45;
        case 'placed': return 0.7;
        case 'encountered': return 0.85;
        default: return 0.95;
    }
}

/**
 * The stage of a row that did not name one. Read off the two things every such
 * row already has - what the holder holds, and how they came by it - so the
 * whole existing table has a position without a migration or a backfill.
 */
export function stageFromStance(stance: Stance, source: SourceKind): KnowingStage {
    if (stance === 'ignorant') return 'unaware';
    if (stance === 'suspects') return 'whisper';
    if (stance === 'believes') return stageFromSource(source, 'named');
    // `knows`. Having been there is the only thing that reaches the top on its
    // own; being certain because somebody told you is `placed`.
    return source === 'witnessed' || source === 'confessed' ? 'encountered' : 'placed';
}

/** Where one stored record sits. Tag first, derived only as a fallback. */
export function stageOfRecord(record: KnowledgeRecord): KnowingStage {
    return stageFromTags(record.tags) ?? stageFromStance(record.stance, record.source.kind);
}

/**
 * The holder's position, given every live row they have on the topic. The
 * highest, because nothing falls.
 */
export function stageAcross(records: readonly KnowledgeRecord[]): KnowingStage {
    let stage: KnowingStage = 'unaware';
    for (const record of records) {
        if (record.superseded) continue;
        stage = highestStage(stage, stageOfRecord(record));
    }
    return stage;
}

export interface StageStep {
    from: KnowingStage;
    to: KnowingStage;
    /** True when this acquisition actually moved them. */
    moved: boolean;
}

/**
 * What an acquisition does to a holder's position. Monotone by construction:
 * `to` is never below `from`. A second hearing from a worse source is still
 * worth writing down and does not move anybody, which is `moved: false`.
 */
export function advanceStage(from: KnowingStage, gained: KnowingStage): StageStep {
    const to = highestStage(from, gained);
    return { from, to, moved: stageRank(to) > stageRank(from) };
}

/**
 * The step an acquisition from this source would produce. The one function a
 * writer needs: where they end up, with the source ceiling already applied.
 */
export function stepFor(
    from: KnowingStage,
    source: SourceKind,
    claimed: KnowingStage
): StageStep {
    return advanceStage(from, stageFromSource(source, claimed));
}
