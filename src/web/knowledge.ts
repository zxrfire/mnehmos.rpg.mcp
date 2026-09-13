/**
 * What this cultivator has ever heard of.
 */

import type Database from 'better-sqlite3';
import {
    recordKnowledge,
    type KnowledgeRecord,
    type KnownEntityKind,
    type SourceKind,
    type Stance
} from '../engine/social/knowledge.js';
import {
    canName,
    canPointAt as stageCanPointAt,
    confidenceForStage,
    highestStage,
    stageFromSource,
    stageFromStance,
    stageFromTags,
    stageRank,
    stageTag,
    stanceForStage,
    type KnowingStage
} from '../engine/social/discovery.js';
import {
    whatOneOfTheWorldsOwnPeopleKnows,
    type WhatSomebodyKnowsOfIt
} from '../engine/world/what-one-of-the-worlds-own-people-knows.js';
import type { WorldState } from '../engine/world/world-state.js';
import { theOneIdAPersonIsKnownBy } from '../engine/world/a-catalog-person-and-their-world-row.js';
import { localGeographyFor } from './lore.js';
import { theOperatorReachesPast } from './operator-knowledge-reach.js';

/**
 * Entity kinds whose existence is gated. Owned by `engine/social/knowledge.ts`,
 * because the engine reading that answers this question for a world NPC cannot
 * import from here.
 */
export type { KnownEntityKind };

/**
 * Stances that count as having heard of something.
 */
export const AWARE_STANCES: readonly Stance[] = ['knows', 'believes', 'suspects'];

/** Stable id for a place, which has no row of its own to point at. */
export function placeKey(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unnamed';
}

/**
 * `placeKey` with a leading article dropped. FOR COMPARISON ONLY - never for a
 * stored key, or every knowledge record ever written stops resolving.
 */
export function loosePlaceKey(name: string): string {
    // `^the-` rather than `^the`, so "Theodore's Rest" is not quietly renamed.
    return placeKey(name).replace(/^the-/, '') || 'unnamed';
}

/**
 * The claim key for "this thing exists".
 */
export function existenceClaimKey(kind: KnownEntityKind, id: string): string {
    if (kind === 'place') return `exists:place:${placeKey(id)}`;
    if (kind === 'cultivator') return `exists:cultivator:${theOneIdAPersonIsKnownBy(id)}`;
    return `exists:${kind}:${id}`;
}

export interface AwarenessInput {
    holderId: string;
    kind: KnownEntityKind;
    /** Row id, catalog id, or place name. */
    id: string;
    /** Display name, as the holder would say it. */
    name: string;
    onDay: number;
    /**
     * How they came by it. A name heard from a drunk in a market town and a
     * name read in a sect archive are different facts, and one of them may be
     * wrong - so the source is recorded rather than discarded.
     */
    sourceKind: SourceKind;
    sourceNote?: string;
    fromHolderId?: string;
    /** Default `believes`: most of what anyone has heard of, they have only heard of. */
    stance?: Stance;
    confidence?: number;
    /** What they hold to be so. Defaults to the bare fact of existence. */
    statement?: string;
    /**
     * How far up the ladder this acquisition carries them.
     */
    stage?: KnowingStage;
}

export interface AwarenessRow {
    kind: KnownEntityKind;
    id: string;
    name: string;
    /**
     * What the holder takes to be so, in the words the record was written with.
     */
    statement: string;
    stance: Stance;
    sourceKind: SourceKind;
    sourceNote: string;
    acquiredOnDay: number;
    /**
     * Where this holder stands on the six-stage ladder for this entity.
     */
    stage: KnowingStage;
}

interface RawRow {
    claim_key: string;
    stance: string;
    statement: string;
    detail: string;
    source_kind: string;
    source_note: string;
    acquired_on_day: number;
    tags: string;
}

/**
 * Reader and writer for existence awareness.
 *
 * TWO READERS, AND ONLY ONE OF THEM STORES ANYTHING. `knowledge_records` is
 * the authority on what a named holder has been told, and it holds the player
 * and whoever an operator spawned. Nothing ENUMERABLE is written for one of the
 * world's own people and nothing should be - several hundred people against
 * several hundred houses and every place is the combinatorial walk the absent
 * table would have been - so every question asked about a world NPC came back
 * `unaware`, and the consumers acted on it, refusing to let a cultivator answer
 * a question about their own house and letting nobody in the world recognise
 * anything on sight.
 *
 * A row for a world NPC is written where the thing held CANNOT be derived from
 * the world, which is one case: somebody was told something that is not so.
 * `an-account-of-yourself.ts` is the only writer, the reading below cannot
 * produce a claim that never happened, and the row is deliberately one the
 * world would never have generated.
 *
 * So a gate may be handed a world, and where it has one it asks the world the
 * question instead of inventing a row. The composition is `highestStage`:
 * stages never fall, a row is the authority where a row exists, and the
 * reading can only ever add. A gate with NO world behaves exactly as it did -
 * the supplier is checked for `undefined` and nothing else happens - which is
 * what keeps the twenty bare constructions legal.
 */
export class KnowledgeGate {
    private readonly insertStmt: Database.Statement;
    private readonly awareStmt: Database.Statement;
    private readonly listStmt: Database.Statement;
    private readonly claimStmt: Database.Statement;
    /**
     * The world, asked for rather than held.
     *
     * A supplier because the gate outlives any one load: `GameService` reloads
     * `atHand` per action and a gate holding the handle it was built with
     * would answer off a world several turns stale.
     */
    private readonly worldAtHand?: () => WorldState | null;
    /** The built reading, and which world it was built over. */
    private theWorldItReads: WorldState | null = null;
    private readingTheWorld: WhatSomebodyKnowsOfIt | null = null;

    constructor(db: Database.Database, worldAtHand?: () => WorldState | null) {
        this.worldAtHand = worldAtHand;
        this.insertStmt = db.prepare(`
            INSERT OR IGNORE INTO knowledge_records (
                id, holder_id, holder_kind, claim_key, fact_id, stance, statement, detail,
                source_kind, source_from_holder_id, source_via_record_id, source_note,
                acquired_on_day, confidence, tags, superseded
            ) VALUES (
                @id, @holderId, @holderKind, @claimKey, NULL, @stance, @statement, @detail,
                @sourceKind, @fromHolderId, NULL, @sourceNote,
                @acquiredOnDay, @confidence, @tags, 0
            )
        `);

        this.awareStmt = db.prepare(`
            SELECT 1 FROM knowledge_records
            WHERE holder_id = ? AND claim_key = ? AND superseded = 0
              AND stance IN ('knows', 'believes', 'suspects')
            LIMIT 1
        `);

        // Existence claims only. A holder's beliefs about who killed whom are
        // knowledge too, and they are not what this reader is for.
        this.listStmt = db.prepare(`
            SELECT claim_key, stance, statement, detail, source_kind, source_note,
                   acquired_on_day, tags
            FROM knowledge_records
            WHERE holder_id = ? AND superseded = 0
              AND stance IN ('knows', 'believes', 'suspects')
              AND claim_key LIKE 'exists:%'
            ORDER BY acquired_on_day ASC, claim_key ASC
        `);

        this.claimStmt = db.prepare(`
            SELECT claim_key, stance, statement, detail, source_kind, source_note,
                   acquired_on_day, tags
            FROM knowledge_records
            WHERE holder_id = ? AND claim_key = ? AND superseded = 0
              AND stance IN ('knows', 'believes', 'suspects')
            ORDER BY acquired_on_day ASC, id ASC
        `);
    }

    /**
     * Has this holder ever heard of it? The predicate the whole rule rests on.
     *
     * The stored row is asked first and short-circuits, so the hot path costs
     * exactly what it did. The world is asked last, and only when the rows and
     * the operator have both said no.
     */
    isAwareOf(holderId: string, kind: KnownEntityKind, id: string): boolean {
        if (this.awareStmt.get(holderId, existenceClaimKey(kind, id)) !== undefined) return true;
        if (theOperatorReachesPast(holderId, 'isAwareOf', kind, id)) return true;
        // `canName` and not a rank comparison: the floor at which a name may be
        // said is a property of the ladder, and `whisper` is where the stored
        // half sits too - `suspects` is an aware stance.
        return canName(this.whatTheWorldSays(holderId, kind, id));
    }

    /**
     * Where this holder stands on the ladder for one entity.
     */
    stageOf(holderId: string, kind: KnownEntityKind, id: string): KnowingStage {
        let stage: KnowingStage = 'unaware';
        for (const row of this.rowsFor(holderId, kind, id)) {
            stage = highestStage(stage, stageOfRaw(row));
        }
        return highestStage(stage, this.whatTheWorldSays(holderId, kind, id));
    }

    /**
     * What the world itself says about a holder it holds a row for.
     *
     * `unaware` with no world, with no world loaded, and for every holder the
     * world does not have - which is the player and everybody an operator
     * spawned. Built once per world handle: the reading walks the ledger, and
     * a long-lived world's ledger is long.
     */
    private whatTheWorldSays(
        holderId: string, kind: KnownEntityKind, id: string
    ): KnowingStage {
        if (!this.worldAtHand) return 'unaware';
        const world = this.worldAtHand();
        if (!world) return 'unaware';
        if (world !== this.theWorldItReads || this.readingTheWorld === null) {
            this.readingTheWorld = whatOneOfTheWorldsOwnPeopleKnows(world);
            this.theWorldItReads = world;
        }
        return this.readingTheWorld(holderId, kind, id);
    }

    /**
     * Could this holder point at it, ask after it, or set out for it?
     */
    canPointAt(holderId: string, kind: KnownEntityKind, id: string): boolean {
        if (stageCanPointAt(this.stageOf(holderId, kind, id))) return true;
        // Lifted for one operator line, exactly as `isAwareOf` is, and asked
        // separately because it is a separate question: an operator who can name
        // a place has to be able to set out for it, and `REACHABLE_FROM` is the
        // rung that decides that. `stageOf` is deliberately NOT lifted - where
        // this holder actually stands is a fact, and the receipt is better for
        // being able to say they stood at `unaware` and were reached past.
        return theOperatorReachesPast(holderId, 'canPointAt', kind, id);
    }

    /**
     * Every live row this holder has about one entity, oldest first.
     *
     * The provenance chain a player pays to have untangled: two names for one
     * thing, from two sources, one of which was making it up.
     */
    provenanceOf(holderId: string, kind: KnownEntityKind, id: string): AwarenessRow[] {
        return this.rowsFor(holderId, kind, id).map(row => toAwarenessRow(row, kind, id));
    }

    /**
     * Everything this holder has heard of, optionally of one kind.
     *
     * ROWS ONLY, DELIBERATELY. The world reading answers about one named thing;
     * enumerating it would mean walking several hundred people, several hundred
     * houses and every place in the world per call, which is the combinatorial
     * walk the absent table would have been. Every caller of this is asking
     * about the player or an operator's character, who have rows.
     */
    awareness(holderId: string, kind?: KnownEntityKind): AwarenessRow[] {
        const rows = this.listStmt.all(holderId) as RawRow[];
        const best = new Map<string, AwarenessRow>();

        for (const row of rows) {
            const parts = row.claim_key.split(':');
            if (parts.length < 3) continue;
            const rowKind = parts[1] as KnownEntityKind;
            if (kind && rowKind !== kind) continue;

            const entry = toAwarenessRow(row, rowKind, parts.slice(2).join(':'));
            const held = best.get(row.claim_key);
            // Highest stage wins; ties keep the earliest, so the row that first
            // put them where they stand is the one that speaks for them.
            if (!held || stageRank(entry.stage) > stageRank(held.stage)) {
                best.set(row.claim_key, entry);
            }
        }
        return [...best.values()];
    }

    /** Ids of one kind this holder has heard of. For filtering a catalog down. */
    awareIds(holderId: string, kind: KnownEntityKind): Set<string> {
        return new Set(this.awareness(holderId, kind).map(row => row.id));
    }

    /**
     * Record that a name has surfaced, and where it came from.
     */
    learn(input: AwarenessInput): KnowledgeRecord {
        const stage = stageWanted(input);
        const stance = input.stance ?? stanceForStage(stage);
        const record = recordKnowledge({
            holderId: input.holderId,
            claimKey: existenceClaimKey(input.kind, input.id),
            stance,
            statement: input.statement ?? `${input.name} exists.`,
            onDay: Math.max(0, Math.floor(input.onDay)),
            source: {
                kind: input.sourceKind,
                fromHolderId: input.fromHolderId,
                note: input.sourceNote ?? ''
            },
            detail: { name: input.name, kind: input.kind, entityId: input.id, stage },
            confidence: input.confidence ?? confidenceForStage(stage),
            // The stage rides on the row's own tags. No column, no table, no
            // migration: a stage is a property of an ordinary knowledge record
            // and every reader that has never heard of the ladder still works.
            tags: [stageTag(stage)]
        });

        this.insertStmt.run({
            id: record.id,
            holderId: record.holderId,
            holderKind: record.holderKind,
            claimKey: record.claimKey,
            stance: record.stance,
            statement: record.statement,
            detail: JSON.stringify(record.detail),
            sourceKind: record.source.kind,
            fromHolderId: record.source.fromHolderId ?? null,
            sourceNote: record.source.note ?? '',
            acquiredOnDay: record.acquiredOnDay,
            confidence: record.confidence,
            tags: JSON.stringify(record.tags)
        });

        return record;
    }

    /**
     * Record awareness only when it would actually move the holder.
     */
    learnIfNew(input: AwarenessInput): boolean {
        const held = this.stageOf(input.holderId, input.kind, input.id);
        if (stageRank(stageWanted(input)) <= stageRank(held)) return false;
        this.learn(input);
        return true;
    }

    /** Live rows for one claim, oldest first. */
    private rowsFor(holderId: string, kind: KnownEntityKind, id: string): RawRow[] {
        return this.claimStmt.all(holderId, existenceClaimKey(kind, id)) as RawRow[];
    }

    /**
     * The world a new cultivator starts with.
     *
     * NOTHING HERE NAMES THE HOLDER. Who holds a row is `holder_id`, and a row
     * that also puts the holder into its own prose is read aloud to them: the
     * turn-0 recap and `recall` both quote `statement` and `sourceNote`
     * verbatim, so `X is where they are from` arrived two lines under `You are
     * sure of that much`. Nothing can re-person it on the way out either - the
     * row next to it says *"Knowing them is not the same as being owed anything
     * by them"* of its SUBJECT. See
     * `an-account-of-your-own-life-is-addressed-to-you`.
     */
    seedStartingAwareness(
        holderId: string,
        onDay: number,
        home: string,
        localSect: { id: string; name: string } | null
    ): AwarenessRow[] {
        this.learnIfNew({
            holderId,
            kind: 'place',
            id: home,
            name: home,
            onDay,
            sourceKind: 'witnessed',
            sourceNote: 'Grew up here.',
            stage: 'known',
            confidence: 1,
            statement: `${home} is home.`
        });

        const geography = localGeographyFor(home);

        if (geography.region) {
            this.learnIfNew({
                holderId,
                kind: 'place',
                id: geography.region.id,
                name: geography.region.name,
                onDay,
                sourceKind: 'told',
                sourceNote: 'The province home stands in. Everybody here knows its name.',
                stage: 'placed',
                statement: `${geography.region.name} is the province ${home} is in.`
            });
        }

        for (const place of geography.neighbours) {
            this.learnIfNew({
                holderId,
                kind: 'place',
                id: place.id,
                name: place.name,
                onDay,
                sourceKind: 'told',
                sourceNote:
                    'Ordinary local geography. Everybody here can point at it, and has ' +
                    'since before this one could walk.',
                stage: 'placed',
                statement:
                    `${place.name} is a day or several away, and the road to it is the ` +
                    'road everybody uses.'
            });
        }

        for (const place of geography.further) {
            this.learnIfNew({
                holderId,
                kind: 'place',
                id: place.id,
                name: place.name,
                onDay,
                sourceKind: 'told',
                sourceNote:
                    'What people here say about the far side of the border. Most of them ' +
                    'have never been and several of them are wrong.',
                stage: 'named',
                statement:
                    `${place.name} is somewhere over the border, and is spoken of as a ` +
                    'different sort of place.'
            });
        }

        if (localSect) {
            this.learnIfNew({
                holderId,
                kind: 'sect',
                id: localSect.id,
                name: localSect.name,
                onDay,
                sourceKind: 'told',
                sourceNote: 'What everyone in the county says. Nobody has checked.',
                stance: 'believes',
                confidence: 0.5,
                stage: 'named',
                statement: `${localSect.name} exists somewhere out there and takes disciples.`
            });
        }

        return this.awareness(holderId);
    }
}

// ─────────────────────────────────────────────────────────────────────────
// ROWS AND STAGES
// ─────────────────────────────────────────────────────────────────────────

/**
 * The stage an acquisition claims, with the source ceiling applied.
 */
function stageWanted(input: AwarenessInput): KnowingStage {
    if (input.stage) return stageFromSource(input.sourceKind, input.stage);
    return stageFromStance(input.stance ?? 'believes', input.sourceKind);
}

/** Where one stored row sits. Its own tag first; derived only as a fallback. */
function stageOfRaw(row: RawRow): KnowingStage {
    const tagged = stageFromTags(parseTags(row.tags));
    if (tagged) return tagged;
    return stageFromStance(row.stance as Stance, row.source_kind as SourceKind);
}

function parseTags(blob: string): string[] {
    try {
        const parsed = JSON.parse(blob) as unknown;
        return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
    } catch {
        // A malformed tag blob costs a derived stage, not a scene.
        return [];
    }
}

function toAwarenessRow(row: RawRow, kind: KnownEntityKind, id: string): AwarenessRow {
    let name = row.statement;
    try {
        const detail = JSON.parse(row.detail) as Record<string, unknown>;
        if (typeof detail.name === 'string') name = detail.name;
    } catch {
        // A malformed detail blob is not worth failing a scene over;
        // the statement is a serviceable name on its own.
    }

    return {
        kind,
        id,
        name,
        statement: row.statement,
        stance: row.stance as Stance,
        sourceKind: row.source_kind as SourceKind,
        sourceNote: row.source_note,
        acquiredOnDay: row.acquired_on_day,
        stage: stageOfRaw(row)
    };
}
