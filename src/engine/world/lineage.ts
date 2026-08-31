/**
 * Lineage - the minimum viable version.
 *
 * A parent/descendant edge between characters, plus what travels down it:
 * bloodline traits, family reputation, inherited enemies, inherited resources,
 * and inherited obligations. That is the whole of it. There is no genetics
 * model here, no trait expression rules, no breeding: those would be a
 * simulation, and this layer does not simulate.
 *
 * ── Why the edge earns its place ─────────────────────────────────────────
 *
 * This is what long time-skips land on. A player who vanishes for two centuries
 * comes back to find their disciple's descendants running a city, or finds
 * somebody hunting them for something an ancestor did. Without the edge, a
 * century skip has nothing to attach consequence to and the world can only tell
 * the player that time passed.
 *
 * ── Where it hands off ───────────────────────────────────────────────────
 *
 * The social layer owns grudges, debts and oaths - `src/engine/social/`. It
 * asked this layer for exactly one thing: a call to
 * `inheritLedgerOnDeath(records, deceasedId, heirs, onDay)` when somebody dies.
 * {@link heirsOf} produces that `heirs` array, in the social layer's own shape
 * and its own priority order, and `time.ts` invokes the handoff. Nothing about
 * grudges is duplicated here - only the edge that makes working out who
 * inherits them possible.
 *
 * Day convention matches everywhere else: an absolute integer day index on the
 * same grid the cultivation time-skip uses, `DAYS_PER_YEAR = 365`.
 */

import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import type { CapabilityModifier } from './capability.js';

// ─────────────────────────────────────────────────────────────────────────
// EDGES
// ─────────────────────────────────────────────────────────────────────────

/**
 * How one person follows from another.
 *
 * These are the social layer's `InheritanceRelation` values, minus the ones
 * that are not a parent/descendant edge. Keeping the strings identical means
 * `heirsOf` output drops straight into `inheritLedgerOnDeath` with no mapping
 * step and no chance of the two layers disagreeing about what a disciple is.
 */
export type LineageRelation = 'descendant' | 'disciple' | 'successor' | 'clan' | 'sworn_sibling';

export interface LineageEdge {
    parentId: string;
    childId: string;
    relation: LineageRelation;
    /** Absolute day the edge came into existence: birth, adoption, acceptance. */
    onDay: number;
    note: string;
}

/**
 * Something that travels down the blood.
 *
 * Expressed as capability modifiers because that is the only place in this
 * engine where a trait can mean anything mechanically - a physique that makes
 * cold survivable, a bloodline that reads the old script. A trait with no
 * modifiers is a name and a note, which is a legitimate thing for a family to
 * have.
 */
export interface BloodlineTrait {
    id: string;
    name: string;
    note: string;
    modifiers: CapabilityModifier[];
    /**
     * Generations after the founder at which it stops appearing. Null for a
     * trait that does not thin. Checked on read, never on a timer.
     */
    fadesAfterGenerations: number | null;
}

export interface LineageRecord {
    id: string;
    surname: string;
    founderId: string;
    foundedOnDay: number;

    /** Everyone in the line, in the order they entered it. */
    memberIds: string[];
    edges: LineageEdge[];

    traits: BloodlineTrait[];
    /** What the name is worth to a stranger, -1..1. */
    reputation: number;
    /** Family holdings, over and above what any member carries. */
    holdings: Record<string, number>;
    /**
     * Ids in the social layer's obligation ledger that the family as a whole
     * carries. Stored as ids only: the records themselves live over there.
     */
    obligationIds: string[];
    /** Parties with a standing account against the line rather than a person. */
    inheritedEnemyIds: string[];

    extinctOnDay: number | null;
    tags: string[];
}

export function createLineageRecord(
    init: Partial<LineageRecord> & Pick<LineageRecord, 'id' | 'surname' | 'founderId' | 'foundedOnDay'>
): LineageRecord {
    return {
        memberIds: [init.founderId],
        edges: [],
        traits: [],
        reputation: 0,
        holdings: {},
        obligationIds: [],
        inheritedEnemyIds: [],
        extinctOnDay: null,
        tags: [],
        ...init
    };
}

/** Add a parent/child edge. Idempotent on (parent, child, relation). */
export function addLineageEdge(
    lineage: LineageRecord,
    edge: Omit<LineageEdge, 'note'> & { note?: string }
): LineageRecord {
    const exists = lineage.edges.some(
        e => e.parentId === edge.parentId && e.childId === edge.childId && e.relation === edge.relation
    );
    if (exists) return lineage;
    const memberIds = lineage.memberIds.includes(edge.childId)
        ? lineage.memberIds
        : lineage.memberIds.concat(edge.childId);
    return {
        ...lineage,
        memberIds,
        edges: lineage.edges.concat({ note: '', ...edge })
    };
}

// ─────────────────────────────────────────────────────────────────────────
// WALKING THE TREE
// ─────────────────────────────────────────────────────────────────────────

export function childrenOf(
    lineage: LineageRecord,
    parentId: string,
    relations?: readonly LineageRelation[]
): LineageEdge[] {
    const wanted = relations ? new Set(relations) : null;
    return lineage.edges
        .filter(e => e.parentId === parentId && (!wanted || wanted.has(e.relation)))
        .sort((a, b) => a.onDay - b.onDay || (a.childId < b.childId ? -1 : 1));
}

export function parentsOf(lineage: LineageRecord, childId: string): LineageEdge[] {
    return lineage.edges
        .filter(e => e.childId === childId)
        .sort((a, b) => a.onDay - b.onDay || (a.parentId < b.parentId ? -1 : 1));
}

/**
 * Everyone downstream of a person, breadth-first.
 *
 * Depth-capped because a two-hundred-year skip can produce a great many
 * descendants and the caller almost always wants the next generation or two.
 */
export function descendantsOf(
    lineage: LineageRecord,
    ancestorId: string,
    maxDepth = 6
): { id: string; depth: number; relation: LineageRelation }[] {
    const out: { id: string; depth: number; relation: LineageRelation }[] = [];
    const seen = new Set<string>([ancestorId]);
    let frontier: { id: string; relation: LineageRelation }[] = [{ id: ancestorId, relation: 'descendant' }];

    for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
        const next: { id: string; relation: LineageRelation }[] = [];
        for (const node of frontier) {
            for (const edge of childrenOf(lineage, node.id)) {
                if (seen.has(edge.childId)) continue;
                seen.add(edge.childId);
                out.push({ id: edge.childId, depth, relation: edge.relation });
                next.push({ id: edge.childId, relation: edge.relation });
            }
        }
        frontier = next;
    }
    return out;
}

export function ancestorsOf(
    lineage: LineageRecord,
    descendantId: string,
    maxDepth = 8
): { id: string; depth: number; relation: LineageRelation }[] {
    const out: { id: string; depth: number; relation: LineageRelation }[] = [];
    const seen = new Set<string>([descendantId]);
    let frontier = [descendantId];

    for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
        const next: string[] = [];
        for (const id of frontier) {
            for (const edge of parentsOf(lineage, id)) {
                if (seen.has(edge.parentId)) continue;
                seen.add(edge.parentId);
                out.push({ id: edge.parentId, depth, relation: edge.relation });
                next.push(edge.parentId);
            }
        }
        frontier = next;
    }
    return out;
}

/** Generations between the founder and this member. Zero for the founder. */
export function generationOf(lineage: LineageRecord, memberId: string): number {
    if (memberId === lineage.founderId) return 0;
    const line = ancestorsOf(lineage, memberId).find(a => a.id === lineage.founderId);
    return line ? line.depth : ancestorsOf(lineage, memberId).length;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT TRAVELS DOWN
// ─────────────────────────────────────────────────────────────────────────

/**
 * Traits a member still expresses.
 *
 * Read-time, not write-time: a trait that fades after four generations is
 * simply not returned for the fifth. Nothing has to be swept, and adding a
 * trait to a founder retroactively gives it to everyone who should have it.
 */
export function traitsFor(lineage: LineageRecord, memberId: string): BloodlineTrait[] {
    const generation = generationOf(lineage, memberId);
    return lineage.traits.filter(
        t => t.fadesAfterGenerations === null || generation <= t.fadesAfterGenerations
    );
}

/** Capability modifiers a member carries by blood. Feeds `assessCapability`. */
export function bloodlineModifiers(lineage: LineageRecord, memberId: string): CapabilityModifier[] {
    return traitsFor(lineage, memberId).flatMap(t => t.modifiers);
}

/** The social-layer heir shape. Kept structurally identical on purpose. */
export interface HeirRef {
    id: string;
    relation: LineageRelation;
}

/**
 * Who inherits, in priority order.
 *
 * Deterministic, no roll: direct descendants first, then successors, then
 * disciples, then the wider clan, each group in edge order and tie-broken on
 * id. `filterAlive` lets the caller drop anyone the world has already buried
 * without this module needing to know what an NPC is.
 *
 * The array is handed straight to the social layer's `inheritLedgerOnDeath`,
 * which is why the relation strings are theirs and not a local vocabulary.
 */
export function heirsOf(
    lineage: LineageRecord,
    deceasedId: string,
    filterAlive?: (id: string) => boolean
): HeirRef[] {
    const priority: LineageRelation[] = ['descendant', 'successor', 'disciple', 'clan', 'sworn_sibling'];
    const out: HeirRef[] = [];
    const seen = new Set<string>();

    for (const relation of priority) {
        for (const edge of childrenOf(lineage, deceasedId, [relation])) {
            if (seen.has(edge.childId)) continue;
            if (filterAlive && !filterAlive(edge.childId)) continue;
            seen.add(edge.childId);
            out.push({ id: edge.childId, relation });
        }
    }
    return out;
}

export interface InheritanceTransfer {
    lineage: LineageRecord;
    heirId: string | null;
    heirs: HeirRef[];
    /** Resources moved from the family pot to the heir. */
    holdingsTransferred: Record<string, number>;
    /** Enemy ids the heir now carries. */
    enemiesInherited: string[];
    /** Obligation ids the social layer must now hand on. */
    obligationIds: string[];
    /** Traits the heir expresses that the deceased did. */
    traitsCarried: string[];
    summary: string;
}

/**
 * Settle what the family passes on when a member dies.
 *
 * Property, enemies and obligations move together, because in this world they
 * are the same kind of thing: what your father left you includes who wants you
 * dead. The obligation records themselves are NOT touched here - their ids come
 * back so the caller can hand them to the social layer, which owns them.
 *
 * The estate can genuinely go nowhere. A line ends in one generation and its
 * holdings end up in the ground, which is how buried treasure gets buried.
 */
export function settleInheritance(
    lineage: LineageRecord,
    deceasedId: string,
    onDay: number,
    opts: { filterAlive?: (id: string) => boolean; leakage?: number } = {}
): InheritanceTransfer {
    const heirs = heirsOf(lineage, deceasedId, opts.filterAlive);
    const primary = heirs[0] ?? null;
    const leakage = Math.max(0, Math.min(1, opts.leakage ?? 0.25));

    if (!primary) {
        const stillAlive = lineage.memberIds.some(
            id => id !== deceasedId && (!opts.filterAlive || opts.filterAlive(id))
        );
        return {
            lineage: stillAlive ? lineage : { ...lineage, extinctOnDay: lineage.extinctOnDay ?? onDay },
            heirId: null,
            heirs: [],
            holdingsTransferred: {},
            enemiesInherited: [],
            obligationIds: lineage.obligationIds.slice(),
            traitsCarried: [],
            summary:
                `${deceasedId} left no heir. What the ${lineage.surname} line held is where they left it.`
        };
    }

    const holdingsTransferred: Record<string, number> = {};
    const remaining: Record<string, number> = {};
    for (const key of Object.keys(lineage.holdings).sort()) {
        const value = lineage.holdings[key];
        const moved = Math.max(0, Math.round(value * (1 - leakage)));
        holdingsTransferred[key] = moved;
        remaining[key] = Math.max(0, value - moved);
    }

    return {
        lineage: { ...lineage, holdings: remaining },
        heirId: primary.id,
        heirs,
        holdingsTransferred,
        enemiesInherited: lineage.inheritedEnemyIds.slice(),
        obligationIds: lineage.obligationIds.slice(),
        traitsCarried: traitsFor(lineage, primary.id).map(t => t.id),
        summary:
            `${primary.id} took what ${deceasedId} left of the ${lineage.surname} line` +
            `${lineage.inheritedEnemyIds.length > 0
                ? `, along with ${lineage.inheritedEnemyIds.length} standing account${lineage.inheritedEnemyIds.length === 1 ? '' : 's'}`
                : ''}.`
    };
}

/** Record a party with an account against the family rather than a person. */
export function addLineageEnemy(lineage: LineageRecord, enemyId: string): LineageRecord {
    if (lineage.inheritedEnemyIds.includes(enemyId)) return lineage;
    return { ...lineage, inheritedEnemyIds: lineage.inheritedEnemyIds.concat(enemyId).sort() };
}

/** Link an obligation record held by the family as a whole. */
export function addLineageObligation(lineage: LineageRecord, obligationId: string): LineageRecord {
    if (lineage.obligationIds.includes(obligationId)) return lineage;
    return { ...lineage, obligationIds: lineage.obligationIds.concat(obligationId).sort() };
}

export function adjustLineageReputation(lineage: LineageRecord, delta: number): LineageRecord {
    const next = Math.max(-1, Math.min(1, lineage.reputation + delta));
    return { ...lineage, reputation: next };
}

/** Years the line has existed. Convenience for "an old family". */
export function lineageAgeYears(lineage: LineageRecord, onDay: number): number {
    return Math.floor((onDay - lineage.foundedOnDay) / DAYS_PER_YEAR);
}
