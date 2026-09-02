/**
 * The ladder of knowing: how a name gets from "never spoken near you" to
 * "you have dealt with it, and it has dealt with you".
 *
 * `docs/world/houses/discovery.md` specifies six stages and this file is the whole of
 * the mechanism:
 *
 *     unaware        the name has never been spoken near you
 *     whisper        an elder mentions something, imprecisely, and changes the subject
 *     named          you know it exists and roughly what it is. Nothing more.
 *     placed         you know where, or who, or when
 *     encountered    you have been in a room with it
 *     known          you have dealt with it, and it has dealt with you
 *
 * ── Nothing bespoke ───────────────────────────────────────────────────────
 * There is no stage table, no discovery table, and no second store. A stage is
 * a property of an ORDINARY knowledge record - the same rows a sect membership
 * or a false belief about a murder are filed in - carried on the record's own
 * `tags` as `stage:<stage>`. Everything here is pure: it reads records and
 * returns stages, and the writing is somebody else's job.
 *
 * That is deliberate and it is the doc's own claim: "Awareness of existence is
 * a knowledge record like any other. There is no new machinery here - only the
 * discipline not to spend it."
 *
 * ── Each step needs a source, and the source caps the step ────────────────
 * The hardest sentence in the doc to implement is "each step needs a source,
 * and the sources are scarce". {@link stageCeilingFor} is that sentence: a
 * thing OVERHEARD through a wall can never rise above `whisper` on the
 * strength of having been overheard, however many times it happens, because
 * the fragment was unresolvable and asking about it would reveal where the
 * listener was standing. Somebody TELLING you where they came from can place
 * it. Only standing in the thing yourself, or dealing with it, reaches the
 * top.
 *
 * A holder can still get to `known` from a whisper - by hearing it again from
 * somebody better placed, by asking, by going. What they cannot do is get
 * there by re-hearing the same wall.
 *
 * ── Stages never fall ─────────────────────────────────────────────────────
 * {@link advanceStage} is monotone. Learning something a second time from a
 * worse source does not un-know it: that new row is written and kept, because
 * "a name from a drunk carter and a name from a sect archivist are different
 * facts", and the holder's CURRENT stage is the highest live one. Nothing is
 * overwritten and nothing is deleted, which is the rule the whole social layer
 * runs on.
 *
 * ── Knowing is not access ─────────────────────────────────────────────────
 * "Seeing is a knowledge state, not an access state." No predicate in this
 * file consults a realm, a threshold, an admission bar or a faction. Reaching
 * `placed` on a sect's ground means the holder can say where it is and set out
 * for it. Whether the gate opens is the location layer's question and it is
 * asked separately.
 */

import type { KnowledgeRecord, SourceKind, Stance } from './knowledge.js';

// ─────────────────────────────────────────────────────────────────────────
// THE LADDER
// ─────────────────────────────────────────────────────────────────────────

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
 * What each stage actually means, in the doc's own words.
 *
 * Kept here rather than restated at call sites, because five paraphrases of
 * "you know where, or who, or when" is how a ladder quietly acquires a seventh
 * rung nobody agreed to.
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
 * The floor at which a name may be SAID in front of the holder.
 *
 * `whisper`, which is the whole design: a name arrives long before its
 * meaning does, and the player holds the word with no way to evaluate it.
 */
export const NAMEABLE_FROM: KnowingStage = 'whisper';

/**
 * The floor at which the holder can point at a thing in the world.
 *
 * `placed` - "you know where, or who, or when". Below this a name is a sound.
 * A cultivator who has heard the word "Kettle" through a wall cannot set out
 * for Kettle, because they do not know it is a town, which direction it is, or
 * whether it is a person. This is the predicate a travel verb wants; it is NOT
 * a predicate about whether they will be let in.
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

// ─────────────────────────────────────────────────────────────────────────
// SOURCES, AND WHAT EACH ONE CAN CARRY
// ─────────────────────────────────────────────────────────────────────────

/**
 * The highest stage a single acquisition from this source can deliver.
 *
 * discovery.md, on the same page: a name said flatly "goes into the knowledge
 * layer at the lowest stage - heard, not known. They have the word and nothing
 * else, from one interested source who may be wrong." And on the overheard
 * channel: "a fragment they cannot resolve... no opportunity to ask."
 *
 *   overheard   whisper. It was not for them, they cannot ask, and acting on
 *               it exposes where they were standing.
 *   assumed     whisper. Somebody filled a gap with a proper noun. It very
 *               probably has nothing to do with what was asked.
 *   fabricated  whisper. A deliberate lie is still an acquisition; what it is
 *               not is a step up the ladder.
 *   inferred    named. Working it out yourself gets you what it is, not where.
 *   told        placed. Somebody who says where they came from has placed it.
 *               This is the ordinary route and it is why travellers matter.
 *   read        placed. An archive says where, who and when, and no more.
 *   divined     placed.
 *   confessed   known. Somebody dealing with you about their own business.
 *   witnessed   known. You were there.
 *
 * Nothing consults who the speaker was. A sect archivist and a drunk carter
 * are both `told`, and the difference between them is the `source_note` and
 * the confidence on the row - not a rung. The carter's may still be the true
 * one.
 */
export function stageCeilingFor(source: SourceKind): KnowingStage {
    switch (source) {
        case 'witnessed':
        case 'confessed':
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

// ─────────────────────────────────────────────────────────────────────────
// STAGE <-> RECORD
// ─────────────────────────────────────────────────────────────────────────

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
 * How firmly somebody at this stage holds the claim.
 *
 * The stance vocabulary predates the ladder and is not being replaced by it:
 * `suspects`, `believes` and `knows` are what a narrator reads, and they are
 * what every existing query in the layer filters on. So the ladder maps ONTO
 * them rather than beside them, and a row is readable by code that has never
 * heard of stages.
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
 * The stage of a row written before the ladder existed, or by a caller that
 * did not name one.
 *
 * Read off the two things every such row already has - what the holder holds,
 * and how they came by it - so the whole existing table has a position on the
 * ladder without a migration and without a backfill. A row that says `knows`
 * and `witnessed` is somebody who was there; a row that says `suspects` is a
 * word somebody heard.
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
 * The holder's position, given every live row they have on the topic.
 *
 * The highest, because nothing falls. Somebody who overheard a name through a
 * wall and later had it explained to them by a monk holds both rows and stands
 * where the monk left them.
 */
export function stageAcross(records: readonly KnowledgeRecord[]): KnowingStage {
    let stage: KnowingStage = 'unaware';
    for (const record of records) {
        if (record.superseded) continue;
        stage = highestStage(stage, stageOfRecord(record));
    }
    return stage;
}

// ─────────────────────────────────────────────────────────────────────────
// MOVING
// ─────────────────────────────────────────────────────────────────────────

export interface StageStep {
    from: KnowingStage;
    to: KnowingStage;
    /** True when this acquisition actually moved them. */
    moved: boolean;
}

/**
 * What an acquisition does to a holder's position.
 *
 * Monotone by construction: `to` is never below `from`. A second hearing from
 * a worse source is still worth writing down - it is a second fact with a
 * second provenance - and it does not move anybody, which is what `moved:
 * false` says.
 */
export function advanceStage(from: KnowingStage, gained: KnowingStage): StageStep {
    const to = highestStage(from, gained);
    return { from, to, moved: stageRank(to) > stageRank(from) };
}

/**
 * The step an acquisition from this source would produce.
 *
 * The one function a writer needs: give it where they stand, what the source
 * was, and what the source is claiming to deliver, and it returns where they
 * end up with the source ceiling already applied.
 */
export function stepFor(
    from: KnowingStage,
    source: SourceKind,
    claimed: KnowingStage
): StageStep {
    return advanceStage(from, stageFromSource(source, claimed));
}
