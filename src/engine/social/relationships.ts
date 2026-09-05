/**
 * Relationships as first-class persistent state. The governing prohibition: do not
 * reduce a relationship to one reputation number. A scalar can say "likes you 0.7";
 * it cannot say "my former disciple, who I taught for eleven years, who left
 * without a word after the Burnt Earth affair, who I would still take back" - and
 * that sentence is the unit of drama in this world.
 */

import { byId, clamp01, round4, stableId, type DayIndex } from './common.js';

/**
 * The nature of the tie. Deliberately wide and concrete rather than small and
 * abstract: `former_disciple` is separate from `disciple` because the
 * difference is the entire story, and `sworn_sibling` from `friend` because one
 * of them is an oath. The list has no order and no type is stronger.
 */
export type RelationshipType =
    // Blood and household
    | 'parent'
    | 'child'
    | 'sibling'
    | 'elder_sibling'
    | 'younger_sibling'
    | 'spouse'
    | 'kin'
    | 'ancestor'
    | 'descendant'
    // Sworn and chosen
    | 'sworn_sibling'
    | 'sworn_enemy'
    | 'friend'
    | 'lover'
    // Teaching
    | 'master'
    | 'disciple'
    | 'former_master'
    | 'former_disciple'
    | 'senior_brother'
    | 'junior_brother'
    // Institutions
    | 'sect_mate'
    | 'sect_superior'
    | 'sect_subordinate'
    | 'clan_member'
    | 'faction_ally'
    | 'faction_rival'
    // Dealings
    | 'patron'
    | 'client'
    | 'benefactor'
    | 'creditor'
    | 'debtor'
    | 'business_partner'
    | 'servant'
    | 'employer'
    // Standing conflict
    | 'rival'
    | 'enemy'
    | 'acquaintance'
    | 'stranger'
    | 'custom';

/**
 * How much this tie matters to the holder - as a stored fact, set by whoever
 * writes the record, never computed from anybody's realm or stats.
 */
export type Significance = 'incidental' | 'notable' | 'defining';

export type EventSignificance = 'minor' | 'notable' | 'defining';

/**
 * One thing that happened between these two, kept forever. `summary` is prose
 * the engine never parses or scores; `tags` are how it answers structured
 * questions without pretending to understand the sentence.
 */
export interface RelationshipEvent {
    id: string;
    onDay: DayIndex;
    /** Short machine-ish label: 'saved_life', 'abandoned', 'taught', 'humiliated'. */
    kind: string;
    summary: string;
    significance: EventSignificance;
    /** Ground-truth fact id from `knowledge.ts`, when this event has one. */
    factId: string | null;
    /** Structured handles for querying: ['debt_incurred', 'in_public']. */
    tags: string[];
}

/**
 * A directed relationship. `strength` and `attitude` are separate fields
 * because they routinely disagree: a bitter former disciple has a very strong
 * relationship and a hostile attitude, and one scalar would erase the plot.
 */
export interface Relationship {
    id: string;
    /** Whose view this is. */
    fromId: string;
    /** Who it is about. */
    toId: string;
    type: RelationshipType;
    /** Free text when `type` is 'custom', or a refinement otherwise. */
    label: string;
    /**
     * 0..1 - how consequential this person is to `fromId`. Not warmth, not
     * approval, and not derived from anyone's cultivation.
     */
    strength: number;
    significance: Significance;
    /** Current attitude in plain words: 'cautious trust', 'quiet resentment'. */
    attitude: string;
    /** Standing facts about the tie: ['owes_a_favour', 'shares_a_secret']. */
    roles: string[];
    /** The running account. Written by the narrator; never parsed by the engine. */
    history: string;
    /** Everything that made it this way, oldest first. */
    events: RelationshipEvent[];
    establishedOnDay: DayIndex;
    lastUpdatedOnDay: DayIndex;
    /**
     * Ended ties are kept and not deleted. A dead master is still a master, and
     * keeps driving behaviour for the rest of a very long life.
     */
    active: boolean;
    /** Why it ended: 'death', 'expelled', 'estranged', 'severed'. */
    endedReason: string | null;
    endedOnDay: DayIndex | null;
}

export interface RelationshipInput {
    fromId: string;
    toId: string;
    type: RelationshipType;
    onDay: DayIndex;
    label?: string;
    strength?: number;
    significance?: Significance;
    attitude?: string;
    roles?: string[];
    history?: string;
}

export function createRelationship(input: RelationshipInput): Relationship {
    return {
        id: stableId('rel', input.fromId, input.toId),
        fromId: input.fromId,
        toId: input.toId,
        type: input.type,
        label: input.label ?? '',
        strength: round4(clamp01(input.strength ?? 0.3)),
        significance: input.significance ?? 'notable',
        attitude: input.attitude ?? '',
        roles: [...(input.roles ?? [])],
        history: input.history ?? '',
        events: [],
        establishedOnDay: input.onDay,
        lastUpdatedOnDay: input.onDay,
        active: true,
        endedReason: null,
        endedOnDay: null
    };
}

export interface RelationshipEventInput {
    onDay: DayIndex;
    kind: string;
    summary: string;
    significance?: EventSignificance;
    factId?: string | null;
    tags?: string[];
}

/**
 * Append an event, without mutating the input. There is no path in this module
 * that removes one: how a thing became true is what makes it narratable later.
 */
export function recordRelationshipEvent(
    relationship: Relationship,
    input: RelationshipEventInput
): Relationship {
    const event: RelationshipEvent = {
        id: stableId('relev', relationship.id, input.onDay, input.kind, input.summary),
        onDay: input.onDay,
        kind: input.kind,
        summary: input.summary,
        significance: input.significance ?? 'notable',
        factId: input.factId ?? null,
        tags: [...(input.tags ?? [])]
    };
    return {
        ...relationship,
        events: [...relationship.events, event],
        lastUpdatedOnDay: Math.max(relationship.lastUpdatedOnDay, input.onDay)
    };
}

export interface RelationshipUpdate {
    onDay: DayIndex;
    type?: RelationshipType;
    label?: string;
    strength?: number;
    significance?: Significance;
    attitude?: string;
    roles?: string[];
    /** Replaces the running account outright. */
    history?: string;
    /** Appended to the running account, on its own line, with the day stamped. */
    appendHistory?: string;
}

/**
 * Change what the relationship currently is. With `appendHistory` the
 * narrator's account grows rather than being replaced, so "he was not always
 * like this" stays answerable from the record alone.
 */
export function updateRelationship(
    relationship: Relationship,
    update: RelationshipUpdate
): Relationship {
    const history =
        update.history !== undefined
            ? update.history
            : update.appendHistory
              ? [relationship.history, `[day ${update.onDay}] ${update.appendHistory}`]
                    .filter(Boolean)
                    .join('\n')
              : relationship.history;

    return {
        ...relationship,
        type: update.type ?? relationship.type,
        label: update.label ?? relationship.label,
        strength:
            update.strength === undefined
                ? relationship.strength
                : round4(clamp01(update.strength)),
        significance: update.significance ?? relationship.significance,
        attitude: update.attitude ?? relationship.attitude,
        roles: update.roles ? [...update.roles] : relationship.roles,
        history,
        lastUpdatedOnDay: Math.max(relationship.lastUpdatedOnDay, update.onDay)
    };
}

/** End a tie without deleting it. Death, expulsion, estrangement, severance. */
export function endRelationship(
    relationship: Relationship,
    reason: string,
    onDay: DayIndex
): Relationship {
    return {
        ...relationship,
        active: false,
        endedReason: reason,
        endedOnDay: onDay,
        lastUpdatedOnDay: Math.max(relationship.lastUpdatedOnDay, onDay)
    };
}

export interface RelationshipQuery {
    type?: RelationshipType;
    types?: readonly RelationshipType[];
    significance?: Significance;
    /** Match relationships carrying every one of these roles. */
    roles?: readonly string[];
    /** Include ties that have ended. Default false. */
    includeEnded?: boolean;
    /** Only ties established on or before this day - the "as of" query. */
    asOfDay?: DayIndex;
}

/**
 * Indexed store of directed relationships. Mirrors the SQLite indexes in
 * `migrations.social.ts`, so a repository on the same shape behaves
 * identically. Every lookup is O(matches); nothing scans the whole graph.
 */
export class RelationshipLedger {
    private readonly byPair = new Map<string, Relationship>();
    private readonly outgoingIndex = new Map<string, Set<string>>();
    private readonly incomingIndex = new Map<string, Set<string>>();

    private static pairKey(fromId: string, toId: string): string {
        return `${fromId}${toId}`;
    }

    /** Insert or replace. Replacing keeps the same id, since ids are the pair. */
    put(relationship: Relationship): Relationship {
        const key = RelationshipLedger.pairKey(relationship.fromId, relationship.toId);
        this.byPair.set(key, relationship);
        index(this.outgoingIndex, relationship.fromId, key);
        index(this.incomingIndex, relationship.toId, key);
        return relationship;
    }

    /** One direction. `between(a, b)` and `between(b, a)` are different rows. */
    between(fromId: string, toId: string): Relationship | null {
        return this.byPair.get(RelationshipLedger.pairKey(fromId, toId)) ?? null;
    }

    /**
     * Both halves of a tie, which are allowed to disagree completely: he
     * considers her a friend, she considers him a mark, neither is wrong.
     */
    mutual(a: string, b: string): { forward: Relationship | null; reverse: Relationship | null } {
        return { forward: this.between(a, b), reverse: this.between(b, a) };
    }

    /** Everyone this character has a view about. */
    outgoing(fromId: string, query: RelationshipQuery = {}): Relationship[] {
        return this.resolve(this.outgoingIndex.get(fromId), query);
    }

    /** Everyone who has a view about this character. */
    incoming(toId: string, query: RelationshipQuery = {}): Relationship[] {
        return this.resolve(this.incomingIndex.get(toId), query);
    }

    /** Ties in either direction involving this character. */
    involving(characterId: string, query: RelationshipQuery = {}): Relationship[] {
        const keys = new Set<string>([
            ...(this.outgoingIndex.get(characterId) ?? []),
            ...(this.incomingIndex.get(characterId) ?? [])
        ]);
        return this.resolve(keys, query);
    }

    /** Every event ever recorded on one tie, oldest first. */
    historyBetween(fromId: string, toId: string): RelationshipEvent[] {
        const relationship = this.between(fromId, toId);
        if (!relationship) return [];
        return [...relationship.events].sort((a, b) => a.onDay - b.onDay || byId(a, b));
    }

    all(query: RelationshipQuery = {}): Relationship[] {
        return this.resolve(new Set(this.byPair.keys()), query);
    }

    size(): number {
        return this.byPair.size;
    }

    private resolve(keys: Iterable<string> | undefined, query: RelationshipQuery): Relationship[] {
        if (!keys) return [];
        const out: Relationship[] = [];
        for (const key of keys) {
            const relationship = this.byPair.get(key);
            if (!relationship) continue;
            if (!matches(relationship, query)) continue;
            out.push(relationship);
        }
        // Deterministic order regardless of insertion sequence.
        return out.sort(byId);
    }
}

function matches(relationship: Relationship, query: RelationshipQuery): boolean {
    if (!query.includeEnded && !relationship.active) return false;
    if (query.type && relationship.type !== query.type) return false;
    if (query.types && !query.types.includes(relationship.type)) return false;
    if (query.significance && relationship.significance !== query.significance) return false;
    if (query.asOfDay !== undefined && relationship.establishedOnDay > query.asOfDay) return false;
    if (query.roles) {
        for (const role of query.roles) {
            if (!relationship.roles.includes(role)) return false;
        }
    }
    return true;
}

function index(map: Map<string, Set<string>>, key: string, value: string): void {
    const set = map.get(key);
    if (set) set.add(value);
    else map.set(key, new Set([value]));
}
