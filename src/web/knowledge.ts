/**
 * What this cultivator has ever heard of.
 *
 * docs/world/discovery.md states the rule this module exists to make
 * mechanical:
 *
 *   > Never reference an entity the player has no knowledge record for.
 *
 * A Qi Condensation cultivator in a village does not know the ancient sects
 * exist. Not "has not visited them" - does not know the names. That is the
 * accurate state of almost everyone, and it is the single easiest thing for a
 * narrating model to break, because the name is sitting in its context and the
 * sentence wants one. One careless clause destroys a revelation the player was
 * supposed to earn over a hundred turns.
 *
 * Instructing the model not to do it is necessary and not sufficient. The
 * enforcement that actually holds is upstream: DO NOT SEND IT THE ANSWER KEY.
 * Everything in this module exists so that the sect catalog, the roster and the
 * gazetteer are filtered down to what this holder has a record for before any
 * of it reaches a prompt.
 *
 * ── Where the rows live ───────────────────────────────────────────────────
 * `knowledge_records`, defined in `src/storage/migrations.social.ts`. No new
 * table: awareness of an entity's existence is a knowledge record like any
 * other, filed under the claim key `exists:<kind>:<id>`, with a stance and a
 * source like anything else a person holds. Rows are built by the engine's own
 * `recordKnowledge` so the shapes stay canonical, then written here.
 *
 * There is no repository for these tables yet, so this module is a narrow
 * reader and writer over the ones this layer needs. When the storage layer
 * grows a proper knowledge repository, this should collapse into it.
 *
 * ── The ladder of knowing ─────────────────────────────────────────────────
 * discovery.md specifies six stages - unaware, whisper, named, placed,
 * encountered, known - and `src/engine/social/discovery.ts` holds the whole of
 * that reasoning as pure functions. This module's part is storage: a stage
 * rides on the record's own `tags` as `stage:<stage>`, and a row written
 * before the ladder existed still has a position, derived from the two things
 * every such row already carries - what the holder holds, and how they came by
 * it. So there is no migration, no backfill and no second table.
 *
 * Two predicates come out of it and they are not the same question:
 *
 *   `isAwareOf`   has a name been said near them. Licenses the name.
 *   `canPointAt`  do they know where, or who, or when. Licenses setting out.
 *
 * A cultivator who heard "Kettle" through a wall passes the first and fails
 * the second, which is the entire design: "Seeing is a knowledge state, not an
 * access state."
 */

import type Database from 'better-sqlite3';
import {
    recordKnowledge,
    type KnowledgeRecord,
    type SourceKind,
    type Stance
} from '../engine/social/knowledge.js';
import {
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
import { theOneIdAPersonIsKnownBy } from '../engine/world/a-catalog-person-and-their-world-row.js';
import { localGeographyFor } from './lore.js';

/**
 * Entity kinds whose existence is gated.
 *
 * People, factions and places, which is what the rule names. The item catalogs
 * - techniques, pills, herbs, formulas - are deliberately NOT gated: they are
 * craft reference rather than world revelation, and the actions that touch
 * them already gate on real possession (`train_technique` needs the art
 * learned, `refine` needs the ingredients in the pouch). Gating them a second
 * time here would buy nothing and cost the alchemy surface entirely.
 *
 * ── Four is the whole list, and `event` is the catch-all ──────────────────
 * discovery.md names exactly four things the rule covers: "an ancient sect's
 * name, a famous cultivator, a distant city, a historical event". These are
 * GATES rather than a taxonomy, so everything `lore.ts` draws from files under
 * one of them - the ages, the dead civilisations, the readings of the Lid, the
 * accounts of where cultivation came from and the objects that came down from
 * above all gate as `event`, because they are things that happened or were
 * made and they gate identically.
 *
 * Do not add a fifth. A player who has heard one of these names cannot tell
 * which category it belongs to, which is the point rather than a compromise -
 * whether the Hollow Court is a sect, a court, a person or a joke is not
 * conveyed by having heard of it - and a new kind would have to be taught to
 * every reader of this table, several of which are outside this package.
 */
export type KnownEntityKind = 'cultivator' | 'sect' | 'place' | 'event';

/**
 * Stances that count as having heard of something.
 *
 * `ignorant` is deliberately excluded and is not the same as having no row:
 * "she has been told repeatedly and does not accept it" is a real state, and it
 * still does not license naming the thing in narration.
 */
export const AWARE_STANCES: readonly Stance[] = ['knows', 'believes', 'suspects'];

/** Stable id for a place, which has no row of its own to point at. */
export function placeKey(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unnamed';
}

/**
 * `placeKey` with a leading article dropped. FOR COMPARISON ONLY - never for a
 * stored key, or every knowledge record ever written stops resolving.
 *
 * This exists because the two halves of place resolution disagreed about the
 * article and neither half was wrong on its own. The parser strips a leading
 * "the" out of what the player typed; `placeKey` keeps it, because it is built
 * from the location's FULL name. So a knowledge record written as
 * `exists:place:the-sealed-compound-at-blackbank` could never be found by
 * anybody who typed the name of the place it was written for.
 *
 * Counted in a live world: 26 of 33 locations begin with "the", and they are
 * all the interesting ones - every ruin, every scar, and all four sites at qi
 * density 1.0. The seven that resolved were the settlements, the best of them
 * at 0.3475, which is exactly the density of the default birthplace. The whole
 * of the world worth travelling to was unreachable by name, and the failure was
 * silent: the refusal quoted the article-stripped string back and looked like a
 * cultivator who had simply never heard of the place.
 *
 * Applied to BOTH sides of every comparison, which is the part that matters.
 * Stripping one side is what produced the bug.
 */
export function loosePlaceKey(name: string): string {
    // `^the-` rather than `^the`, so "Theodore's Rest" is not quietly renamed.
    return placeKey(name).replace(/^the-/, '') || 'unnamed';
}

/**
 * The claim key for "this thing exists".
 *
 * One convention, so a query for "has this holder heard of the Lantern Hall"
 * is a single indexed lookup on `(holder_id, claim_key)` rather than a scan.
 *
 * ── Two of the four kinds are not simply their own id ─────────────────────
 * A PLACE has no row to point at, so it is keyed off its name by `placeKey`.
 *
 * And a PERSON out of the content catalogs has two ids - the catalog's, which
 * is what `lore.ts` and the hearsay layer speak of them by, and the world
 * row's, which is what every presence read asks about - so both are folded
 * onto the one the catalog holds.
 * [`a-catalog-person-and-their-world-row.ts`](../engine/world/a-catalog-person-and-their-world-row.ts)
 * carries that argument in full, including why the fold is a catalog lookup
 * and never a prefix strip.
 *
 * The fold is applied HERE rather than at the callers deliberately. This table
 * has a dozen readers and half a dozen writers across three packages, they
 * disagreed about which of a person's two ids to use, and the two call sites
 * that had noticed were each patching it locally. One place to be right is the
 * whole point of the module.
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
     *
     * Optional, and clamped by what the source could actually have delivered -
     * a fragment through a wall is a `whisper` however it is labelled. Omit it
     * and the stage is derived from the stance and the source, which is what
     * keeps every existing call site correct without being touched.
     */
    stage?: KnowingStage;
}

export interface AwarenessRow {
    kind: KnownEntityKind;
    id: string;
    name: string;
    /**
     * What the holder takes to be so, in the words the record was written
     * with.
     *
     * Carried rather than dropped, because for most rows in this table it is
     * the whole of what somebody has. A name that was merely overheard carries
     * the engine's own "a name that got said. What it is remains unknown", and
     * that thin sentence is the accurate and complete account of what they
     * hold. Any reader that composed a phrase of its own here would be
     * inventing a memory on the holder's behalf.
     */
    statement: string;
    stance: Stance;
    sourceKind: SourceKind;
    sourceNote: string;
    acquiredOnDay: number;
    /**
     * Where this holder stands on the six-stage ladder for this entity.
     *
     * The HIGHEST live stage they hold, not the stage of one row: somebody who
     * overheard a name through a wall and later had it placed for them by a
     * carter holds two records and stands where the carter left them. The
     * lower row is kept - it is a different fact with a different provenance -
     * and `provenanceOf` is how to get at it.
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
 * Every method takes a holder id explicitly. There is deliberately no ambient
 * "current player", because the whole value of this table is that two holders
 * standing in the same room hold different things.
 */
export class KnowledgeGate {
    private readonly insertStmt: Database.Statement;
    private readonly awareStmt: Database.Statement;
    private readonly listStmt: Database.Statement;
    private readonly claimStmt: Database.Statement;

    constructor(db: Database.Database) {
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

    /** Has this holder ever heard of it? The predicate the whole rule rests on. */
    isAwareOf(holderId: string, kind: KnownEntityKind, id: string): boolean {
        return this.awareStmt.get(holderId, existenceClaimKey(kind, id)) !== undefined;
    }

    /**
     * Where this holder stands on the ladder for one entity.
     *
     * `unaware` when there is no row, which is the same answer a holder who has
     * been told repeatedly and refuses to accept it gets - because neither of
     * them can name the thing, and this predicate is about naming.
     */
    stageOf(holderId: string, kind: KnownEntityKind, id: string): KnowingStage {
        let stage: KnowingStage = 'unaware';
        for (const row of this.rowsFor(holderId, kind, id)) {
            stage = highestStage(stage, stageOfRaw(row));
        }
        return stage;
    }

    /**
     * Could this holder point at it, ask after it, or set out for it?
     *
     * `placed` and above. discovery.md's whole distinction between hearing a
     * name and being able to do anything with one, and the predicate a travel
     * verb should be asking instead of `isAwareOf`: a word overheard through a
     * wall is not a destination.
     *
     * It is emphatically NOT a question about whether the holder will be let
     * in, will survive the ground, or will be admitted at the gate. "Seeing is
     * a knowledge state, not an access state" - the location layer owns the
     * other half and is asked separately.
     */
    canPointAt(holderId: string, kind: KnownEntityKind, id: string): boolean {
        return stageCanPointAt(this.stageOf(holderId, kind, id));
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
     * This is what a prompt builder is allowed to draw on. It is not the world;
     * it is one person's map of it, and the difference is the game.
     *
     * One entry per entity, carrying the highest stage held. Several rows for
     * one name is the normal case now that a name can be acquired twice - and a
     * whitelist that listed the same town three times would spend three lines
     * of a prompt saying one thing.
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
     *
     * `INSERT OR IGNORE` on the engine's stable id makes this idempotent for an
     * identical acquisition, so re-walking into the same village on the same day
     * does not fill the table. A genuinely new acquisition - a different day, a
     * different source, a firmer stance - is a new row, which is correct: how
     * somebody came to hold something twice is worth keeping.
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
     *
     * Returns true when something genuinely new was learned, so a caller can
     * tell the player that a name has just entered their world - which is a
     * moment, and should read as one.
     *
     * "New" now means new ON THE LADDER, not merely absent from the table. A
     * cultivator who overheard a name through a wall and then walks into the
     * place has learned something, and before the ladder existed that second
     * acquisition was silently dropped because a row already existed - which
     * meant a whisper was a permanent ceiling and the only way up was to have
     * never heard of it. Re-hearing the same thing at the same stage still
     * writes nothing and still returns false.
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
     * discovery.md: "Their world is the county, the local sect that takes
     * disciples, the market town, and whatever their grandmother believed."
     *
     * The COUNTY, and that word is doing the work. It used to be read as "the
     * village", which produced a cultivator who could name exactly one place
     * and therefore could not go anywhere: travel is gated on being able to
     * name a destination, nothing in the early game granted a place name, and a
     * run was confined for its whole life to whatever ground it was born on.
     * Measured across seven playthroughs, every one of them held exactly one
     * place record and died at the bottom of the ladder on halved cultivation.
     *
     * That was never a design decision. Local geography is the most ordinary
     * knowledge there is: a child in a temple town can name the market town two
     * days off and the province seat, because everybody around them could
     * before that child could walk. So:
     *
     *   home            `known`. They live there.
     *   the county      `placed`. Every settlement and site in it. They can
     *                   point at these and set out for them, which is not the
     *                   same as being able to survive them.
     *   the province    `placed`. The name of the region they are inside.
     *   over the border `named`. There is another province and it has a name.
     *                   Nobody local can tell them anything useful about it and
     *                   several of them are wrong.
     *   the local sect  `named`. What everyone in the county says. Nobody has
     *                   checked.
     *
     * Everything past that is unheard of and has to come from a source the
     * player can point at. That is not a limitation to work around. It is the
     * content, and none of the above touches it: the county is four names in a
     * world of hundreds, and being able to walk to the next town is where the
     * game starts rather than what it withholds.
     *
     * ── Safe to call after a birth has already seeded rows ────────────────
     * Every write goes through `learnIfNew`, so this is a FLOOR rather than a
     * replacement. A birth that already granted the province at a firmer stance
     * keeps it; a birth that granted nothing gets the county. Calling it twice
     * writes nothing the second time. That matters because what a birth confers
     * is an advantage - a better address, a heavier purse, more names said at
     * home - and being able to point at the next town is not an advantage. It
     * is what everybody has.
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
            sourceNote: 'Where they grew up.',
            stage: 'known',
            confidence: 1,
            statement: `${home} is where they are from.`
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
                sourceNote: 'The province they were born in. Everybody here knows its name.',
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
 *
 * A caller may name a stage, or may name a stance and let it be derived. Both
 * routes go through `stageFromSource`, because "each step needs a source, and
 * the sources are scarce" is a rule about the world rather than a rule about
 * how carefully a call site was written. Labelling an overheard fragment
 * `known` does not make it one.
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
