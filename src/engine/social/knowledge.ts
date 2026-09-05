/**
 * Knowledge: objective reality kept strictly apart from what anybody thinks.
 */

import { byId, clamp01, round4, stableId, type DayIndex } from './common.js';

/**
 * A thing that is true. Engine-owned, frozen on creation and never revised - a
 * changed world is a new fact with a later day, because a record of what used
 * to be true is how the engine explains a belief that was once reasonable.
 */
export interface Fact {
    id: string;
    /** What this fact is about - the topic key beliefs are filed against. */
    claimKey: string;
    onDay: DayIndex;
    /** The true statement, in plain words. */
    statement: string;
    /** Structured specifics: who, where, how much. */
    detail: Readonly<Record<string, string | number>>;
    /** Everyone the fact concerns. Indexed, so any of them can find it. */
    subjects: readonly string[];
    tags: readonly string[];
    /** True when it was deliberately hidden at the time it happened. */
    concealed: boolean;
}

export interface FactInput {
    claimKey: string;
    onDay: DayIndex;
    statement: string;
    detail?: Record<string, string | number>;
    subjects?: readonly string[];
    tags?: readonly string[];
    concealed?: boolean;
    id?: string;
}

export function recordFact(input: FactInput): Fact {
    return Object.freeze({
        id: input.id ?? stableId('fact', input.claimKey, input.onDay, input.statement),
        claimKey: input.claimKey,
        onDay: input.onDay,
        statement: input.statement,
        detail: Object.freeze({ ...(input.detail ?? {}) }),
        subjects: Object.freeze([...(input.subjects ?? [])]),
        tags: Object.freeze([...(input.tags ?? [])]),
        concealed: input.concealed ?? false
    });
}

/**
 * How firmly a holder holds a claim.
 */
export type Stance = 'knows' | 'believes' | 'suspects' | 'ignorant';

/** Whether the holder is a person or a body of opinion. */
export type HolderKind = 'character' | 'public';

/**
 * Where the claim came from. `fabricated` is a first-class source: flagging a
 * deliberate lie where it enters is what lets the engine answer later whether
 * any of this was ever true.
 */
export type SourceKind =
    | 'witnessed'
    | 'told'
    | 'overheard'
    | 'read'
    | 'inferred'
    | 'assumed'
    | 'divined'
    | 'confessed'
    /**
     * Read out of somebody's mind without their agreement. Its own kind because
     * `confessed` would be a lie about how it was got, and every other kind is
     * capped below `known`, which would degrade it into hearsay.
     */
    | 'taken'
    | 'fabricated';

export interface KnowledgeSource {
    kind: SourceKind;
    /** Who they got it from, when there is somebody. */
    fromHolderId?: string;
    /** The record they got it from - the provenance chain's link. */
    viaRecordId?: string;
    note?: string;
}

/**
 * One claim, held by one holder.
 */
export interface KnowledgeRecord {
    id: string;
    holderId: string;
    holderKind: HolderKind;
    claimKey: string;
    /**
     * The fact this claim corresponds to, when there is one. NULL is the
     * important case: a belief about something that never happened, which is
     * the most dangerous row in the table.
     */
    factId: string | null;
    stance: Stance;
    /** What the holder holds to be so. */
    statement: string;
    /** Whatever specifics they have. Frequently a subset, sometimes wrong. */
    detail: Record<string, string | number>;
    source: KnowledgeSource;
    acquiredOnDay: DayIndex;
    /**
     * 0..1 how sure the holder is. Stored, not computed: nothing in this engine
     * recalculates it behind their back.
     */
    confidence: number;
    tags: string[];
    /** Superseded by a revision. Kept, never deleted. */
    superseded: boolean;
}

export interface KnowledgeInput {
    holderId: string;
    claimKey: string;
    stance: Stance;
    statement: string;
    onDay: DayIndex;
    source: KnowledgeSource;
    holderKind?: HolderKind;
    factId?: string | null;
    detail?: Record<string, string | number>;
    confidence?: number;
    tags?: readonly string[];
    id?: string;
}

export function recordKnowledge(input: KnowledgeInput): KnowledgeRecord {
    return {
        id:
            input.id ??
            stableId(
                'know',
                input.holderId,
                input.claimKey,
                input.onDay,
                input.stance,
                input.statement
            ),
        holderId: input.holderId,
        holderKind: input.holderKind ?? 'character',
        claimKey: input.claimKey,
        factId: input.factId ?? null,
        stance: input.stance,
        statement: input.statement,
        detail: { ...(input.detail ?? {}) },
        source: { ...input.source },
        acquiredOnDay: input.onDay,
        confidence: round4(clamp01(input.confidence ?? 0.5)),
        tags: [...(input.tags ?? [])],
        superseded: false
    };
}

/** The id used for a body of public opinion. */
export function publicHolderId(audienceId: string): string {
    return `public:${audienceId}`;
}

/** Record what a region, sect or faction generally holds. Layer 5. */
export function recordPublicBelief(
    input: Omit<KnowledgeInput, 'holderId' | 'holderKind'> & { audienceId: string }
): KnowledgeRecord {
    return recordKnowledge({
        ...input,
        holderId: publicHolderId(input.audienceId),
        holderKind: 'public'
    });
}

/**
 * Append-only record of somebody's position changing. Deleting the superseded
 * version deletes the regret, so nothing here removes one.
 */
export interface KnowledgeRevision {
    id: string;
    holderId: string;
    claimKey: string;
    onDay: DayIndex;
    previousRecordId: string;
    /** Null when the holder rejected the new information. */
    revisedRecordId: string | null;
    /** Why their position changed, or why it did not. */
    cause: string;
    accepted: boolean;
}

export interface ReviseInput {
    onDay: DayIndex;
    /** Omit when the holder rejects the new information. */
    to?: {
        stance: Stance;
        statement: string;
        source: KnowledgeSource;
        factId?: string | null;
        detail?: Record<string, string | number>;
        confidence?: number;
        tags?: readonly string[];
    };
    cause: string;
}

/**
 * Supersede a held claim. The caller stores all three returned pieces - the old
 * row is never removed from the ledger.
 */
export function reviseKnowledge(
    previous: KnowledgeRecord,
    input: ReviseInput
): { previous: KnowledgeRecord; revised: KnowledgeRecord | null; revision: KnowledgeRevision } {
    const accepted = input.to !== undefined;
    const revised = input.to
        ? recordKnowledge({
              holderId: previous.holderId,
              holderKind: previous.holderKind,
              claimKey: previous.claimKey,
              stance: input.to.stance,
              statement: input.to.statement,
              onDay: input.onDay,
              source: input.to.source,
              factId: input.to.factId ?? null,
              detail: input.to.detail,
              confidence: input.to.confidence,
              tags: input.to.tags
          })
        : null;

    const revision: KnowledgeRevision = {
        id: stableId('knowrev', previous.id, input.onDay, input.cause),
        holderId: previous.holderId,
        claimKey: previous.claimKey,
        onDay: input.onDay,
        previousRecordId: previous.id,
        revisedRecordId: revised?.id ?? null,
        cause: input.cause,
        accepted
    };

    return {
        previous: accepted ? { ...previous, superseded: true } : previous,
        revised,
        revision
    };
}

export interface AccuracyReport {
    /** True when the held statement matches the fact's. */
    statementMatches: boolean;
    /** Specifics the holder has right. */
    correctDetail: string[];
    /** Specifics the holder has wrong. */
    wrongDetail: string[];
    /** Specifics of the fact the holder simply does not have. Ignorance, not error. */
    missingDetail: string[];
    /** True when there is no fact behind the claim at all. */
    groundless: boolean;
}

/**
 * How wrong a held claim is. ENGINE ONLY: no character-facing path may call it
 * and no stored field caches it - a cached accuracy flag is an omniscience leak
 * waiting for the one query that forgets why it was there.
 */
export function recordAccuracy(record: KnowledgeRecord, fact: Fact | null): AccuracyReport {
    if (!fact) {
        return {
            statementMatches: false,
            correctDetail: [],
            wrongDetail: [],
            missingDetail: [],
            groundless: true
        };
    }
    const correctDetail: string[] = [];
    const wrongDetail: string[] = [];
    const missingDetail: string[] = [];
    for (const key of Object.keys(fact.detail).sort()) {
        if (!(key in record.detail)) missingDetail.push(key);
        else if (record.detail[key] === fact.detail[key]) correctDetail.push(key);
        else wrongDetail.push(key);
    }
    return {
        statementMatches: record.statement === fact.statement,
        correctDetail,
        wrongDetail,
        missingDetail,
        groundless: false
    };
}

export interface KnowledgeQuery {
    stance?: Stance;
    stances?: readonly Stance[];
    holderKind?: HolderKind;
    sourceKind?: SourceKind;
    /** Include claims that have been superseded. Default false. */
    includeSuperseded?: boolean;
    /** Only claims acquired on or before this day - the "as of" query. */
    asOfDay?: DayIndex;
    tags?: readonly string[];
}

/**
 * Indexed store of the five layers. Facts and held claims live in separate maps
 * with separate accessors, so no query can return reality when it was asked for
 * opinion. Indexes mirror the SQLite indexes in `migrations.social.ts`.
 */
export class KnowledgeLedger {
    private readonly facts = new Map<string, Fact>();
    private readonly factsByClaim = new Map<string, Set<string>>();
    private readonly factsBySubject = new Map<string, Set<string>>();

    private readonly records = new Map<string, KnowledgeRecord>();
    private readonly byHolder = new Map<string, Set<string>>();
    private readonly byClaim = new Map<string, Set<string>>();
    private readonly byHolderClaim = new Map<string, Set<string>>();

    private readonly revisions: KnowledgeRevision[] = [];

    addFact(fact: Fact): Fact {
        this.facts.set(fact.id, fact);
        index(this.factsByClaim, fact.claimKey, fact.id);
        for (const subject of fact.subjects) index(this.factsBySubject, subject, fact.id);
        return fact;
    }

    /**
     * Objective reality. ENGINE ONLY. Named `truth` rather than `getFact` so a
     * call site in a character-facing code path is conspicuous in review.
     */
    truth(factId: string): Fact | null {
        return this.facts.get(factId) ?? null;
    }

    /** Every true thing about a topic. Engine only. */
    truthAbout(claimKey: string): Fact[] {
        return [...(this.factsByClaim.get(claimKey) ?? [])]
            .map(id => this.facts.get(id)!)
            .sort((a, b) => a.onDay - b.onDay || byId(a, b));
    }

    /** Every true thing concerning a person. Engine only. */
    truthConcerning(subjectId: string): Fact[] {
        return [...(this.factsBySubject.get(subjectId) ?? [])]
            .map(id => this.facts.get(id)!)
            .sort((a, b) => a.onDay - b.onDay || byId(a, b));
    }

    addRecord(record: KnowledgeRecord): KnowledgeRecord {
        this.records.set(record.id, record);
        index(this.byHolder, record.holderId, record.id);
        index(this.byClaim, record.claimKey, record.id);
        index(this.byHolderClaim, `${record.holderId}${record.claimKey}`, record.id);
        return record;
    }

    /** Replace a stored record in place, e.g. after `reviseKnowledge`. */
    updateRecord(record: KnowledgeRecord): KnowledgeRecord {
        if (!this.records.has(record.id)) return this.addRecord(record);
        this.records.set(record.id, record);
        return record;
    }

    addRevision(revision: KnowledgeRevision): KnowledgeRevision {
        this.revisions.push(revision);
        return revision;
    }

    /**
     * Everything one holder holds. The narrator's brief for a scene. Takes no
     * measure of the holder's power, and there is no overload that would.
     */
    heldBy(holderId: string, query: KnowledgeQuery = {}): KnowledgeRecord[] {
        return this.resolve(this.byHolder.get(holderId), query);
    }

    /** What one holder holds about one topic. */
    stanceOn(holderId: string, claimKey: string, query: KnowledgeQuery = {}): KnowledgeRecord[] {
        return this.resolve(this.byHolderClaim.get(`${holderId}${claimKey}`), query);
    }

    /** Layer 2. */
    knows(holderId: string, query: KnowledgeQuery = {}): KnowledgeRecord[] {
        return this.heldBy(holderId, { ...query, stance: 'knows' });
    }

    /** Layer 3. */
    believes(holderId: string, query: KnowledgeQuery = {}): KnowledgeRecord[] {
        return this.heldBy(holderId, { ...query, stance: 'believes' });
    }

    /** Layer 4. */
    suspects(holderId: string, query: KnowledgeQuery = {}): KnowledgeRecord[] {
        return this.heldBy(holderId, { ...query, stance: 'suspects' });
    }

    /** Layer 5. What a named public generally holds about a topic. */
    publicBelief(audienceId: string, claimKey: string, query: KnowledgeQuery = {}): KnowledgeRecord[] {
        return this.stanceOn(publicHolderId(audienceId), claimKey, query);
    }

    /** Everything anyone holds about a topic, in every incompatible version. */
    claimsAbout(claimKey: string, query: KnowledgeQuery = {}): KnowledgeRecord[] {
        return this.resolve(this.byClaim.get(claimKey), query);
    }

    /**
     * The distinct versions of a topic in circulation, and who holds each. The
     * question a player pays an information broker to answer: not "what
     * happened" but "what are people saying, and who is saying it".
     */
    disagreementsAbout(
        claimKey: string,
        query: KnowledgeQuery = {}
    ): { statement: string; holders: string[]; recordIds: string[] }[] {
        const versions = new Map<string, { holders: Set<string>; recordIds: string[] }>();
        for (const record of this.claimsAbout(claimKey, query)) {
            const bucket = versions.get(record.statement) ?? { holders: new Set(), recordIds: [] };
            bucket.holders.add(record.holderId);
            bucket.recordIds.push(record.id);
            versions.set(record.statement, bucket);
        }
        return [...versions.keys()]
            .sort()
            .map(statement => ({
                statement,
                holders: [...versions.get(statement)!.holders].sort(),
                recordIds: versions.get(statement)!.recordIds.sort()
            }));
    }

    /** Whether this holder has any live claim on this topic at all. */
    isAwareOf(holderId: string, claimKey: string): boolean {
        return this.stanceOn(holderId, claimKey).some(r => r.stance !== 'ignorant');
    }

    /**
     * Walk a claim back to its origin, newest first. The last entry is the
     * root: `witnessed` means somebody actually saw it, `fabricated` or
     * `assumed` means nobody ever did.
     */
    provenance(recordId: string): KnowledgeRecord[] {
        const chain: KnowledgeRecord[] = [];
        const seen = new Set<string>();
        let cursor = this.records.get(recordId) ?? null;
        while (cursor && !seen.has(cursor.id)) {
            seen.add(cursor.id);
            chain.push(cursor);
            const via = cursor.source.viaRecordId;
            cursor = via ? (this.records.get(via) ?? null) : null;
        }
        return chain;
    }

    /** True when nothing at the root of this claim was ever observed. */
    isGroundless(recordId: string): boolean {
        const chain = this.provenance(recordId);
        const root = chain[chain.length - 1];
        if (!root) return true;
        if (root.source.kind === 'witnessed' || root.source.kind === 'confessed') return false;
        return root.factId === null || root.source.kind === 'fabricated';
    }

    revisionsFor(holderId: string, claimKey?: string): KnowledgeRevision[] {
        return this.revisions
            .filter(r => r.holderId === holderId && (!claimKey || r.claimKey === claimKey))
            .sort((a, b) => a.onDay - b.onDay || byId(a, b));
    }

    /**
     * How far a held claim is from reality. ENGINE ONLY, and it takes the
     * record id rather than the record so a caller has to be holding this
     * ledger - and therefore has to be engine code - to reach it at all.
     */
    compareToReality(recordId: string): AccuracyReport | null {
        const record = this.records.get(recordId);
        if (!record) return null;
        return recordAccuracy(record, record.factId ? this.truth(record.factId) : null);
    }

    private resolve(keys: Iterable<string> | undefined, query: KnowledgeQuery): KnowledgeRecord[] {
        if (!keys) return [];
        const out: KnowledgeRecord[] = [];
        for (const key of keys) {
            const record = this.records.get(key);
            if (!record) continue;
            if (!matches(record, query)) continue;
            out.push(record);
        }
        return out.sort((a, b) => a.acquiredOnDay - b.acquiredOnDay || byId(a, b));
    }
}

function matches(record: KnowledgeRecord, query: KnowledgeQuery): boolean {
    if (!query.includeSuperseded && record.superseded) return false;
    if (query.stance && record.stance !== query.stance) return false;
    if (query.stances && !query.stances.includes(record.stance)) return false;
    if (query.holderKind && record.holderKind !== query.holderKind) return false;
    if (query.sourceKind && record.source.kind !== query.sourceKind) return false;
    if (query.asOfDay !== undefined && record.acquiredOnDay > query.asOfDay) return false;
    if (query.tags) {
        for (const tag of query.tags) {
            if (!record.tags.includes(tag)) return false;
        }
    }
    return true;
}

function index(map: Map<string, Set<string>>, key: string, value: string): void {
    const set = map.get(key);
    if (set) set.add(value);
    else map.set(key, new Set([value]));
}
