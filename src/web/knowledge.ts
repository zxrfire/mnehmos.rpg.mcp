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
 */

import type Database from 'better-sqlite3';
import {
    recordKnowledge,
    type KnowledgeRecord,
    type SourceKind,
    type Stance
} from '../engine/social/knowledge.js';

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
 * The claim key for "this thing exists".
 *
 * One convention, so a query for "has this holder heard of the Lantern Hall"
 * is a single indexed lookup on `(holder_id, claim_key)` rather than a scan.
 */
export function existenceClaimKey(kind: KnownEntityKind, id: string): string {
    return `exists:${kind}:${kind === 'place' ? placeKey(id) : id}`;
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
}

export interface AwarenessRow {
    kind: KnownEntityKind;
    id: string;
    name: string;
    stance: Stance;
    sourceKind: SourceKind;
    sourceNote: string;
    acquiredOnDay: number;
}

interface RawRow {
    claim_key: string;
    stance: string;
    statement: string;
    detail: string;
    source_kind: string;
    source_note: string;
    acquired_on_day: number;
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
            SELECT claim_key, stance, statement, detail, source_kind, source_note, acquired_on_day
            FROM knowledge_records
            WHERE holder_id = ? AND superseded = 0
              AND stance IN ('knows', 'believes', 'suspects')
              AND claim_key LIKE 'exists:%'
            ORDER BY acquired_on_day ASC, claim_key ASC
        `);
    }

    /** Has this holder ever heard of it? The predicate the whole rule rests on. */
    isAwareOf(holderId: string, kind: KnownEntityKind, id: string): boolean {
        return this.awareStmt.get(holderId, existenceClaimKey(kind, id)) !== undefined;
    }

    /**
     * Everything this holder has heard of, optionally of one kind.
     *
     * This is what a prompt builder is allowed to draw on. It is not the world;
     * it is one person's map of it, and the difference is the game.
     */
    awareness(holderId: string, kind?: KnownEntityKind): AwarenessRow[] {
        const rows = this.listStmt.all(holderId) as RawRow[];
        const out: AwarenessRow[] = [];

        for (const row of rows) {
            const parts = row.claim_key.split(':');
            if (parts.length < 3) continue;
            const rowKind = parts[1] as KnownEntityKind;
            if (kind && rowKind !== kind) continue;

            let name = row.statement;
            try {
                const detail = JSON.parse(row.detail) as Record<string, unknown>;
                if (typeof detail.name === 'string') name = detail.name;
            } catch {
                // A malformed detail blob is not worth failing a scene over;
                // the statement is a serviceable name on its own.
            }

            out.push({
                kind: rowKind,
                id: parts.slice(2).join(':'),
                name,
                stance: row.stance as Stance,
                sourceKind: row.source_kind as SourceKind,
                sourceNote: row.source_note,
                acquiredOnDay: row.acquired_on_day
            });
        }
        return out;
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
        const stance = input.stance ?? 'believes';
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
            detail: { name: input.name, kind: input.kind, entityId: input.id },
            confidence: input.confidence ?? (stance === 'knows' ? 0.9 : 0.5)
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
     * Record awareness only if the holder does not already have it.
     *
     * Returns true when something genuinely new was learned, so a caller can
     * tell the player that a name has just entered their world - which is a
     * moment, and should read as one.
     */
    learnIfNew(input: AwarenessInput): boolean {
        if (this.isAwareOf(input.holderId, input.kind, input.id)) return false;
        this.learn(input);
        return true;
    }

    /**
     * The world a new cultivator starts with.
     *
     * discovery.md: "Their world is the county, the local sect that takes
     * disciples, the market town, and whatever their grandmother believed."
     * So: where they are standing, and the one sect a villager would have heard
     * of - the nearest thing to a local sect the catalog offers, which is the
     * lowest-admission body that takes applicants at all.
     *
     * Everything else in the world is unheard of, and has to be learned from a
     * source the player can point at. That is not a limitation to work around.
     * It is the content.
     */
    seedStartingAwareness(
        holderId: string,
        onDay: number,
        home: string,
        localSect: { id: string; name: string } | null
    ): AwarenessRow[] {
        this.learn({
            holderId,
            kind: 'place',
            id: home,
            name: home,
            onDay,
            sourceKind: 'witnessed',
            sourceNote: 'Where they grew up.',
            stance: 'knows',
            confidence: 1,
            statement: `${home} is where they are from.`
        });

        if (localSect) {
            this.learn({
                holderId,
                kind: 'sect',
                id: localSect.id,
                name: localSect.name,
                onDay,
                sourceKind: 'told',
                sourceNote: 'What everyone in the county says. Nobody has checked.',
                stance: 'believes',
                confidence: 0.5,
                statement: `${localSect.name} exists somewhere out there and takes disciples.`
            });
        }

        return this.awareness(holderId);
    }
}
