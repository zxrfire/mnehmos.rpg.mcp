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

/**
 * The first word a line's id was minted from, for a founder renamed since.
 *
 * A line's id is `lin-<first word of the founder's name>-<founder id>`, and ids
 * feed pinned worlds. "Bell Keeper Ji" became "Chime Keeper Ji" because `bell`
 * is one letter from *sell* and *tell* (AGENTS.md, "A name evokes what it
 * is"), and the line keeps the id it was first seeded under. Keyed by the
 * founder's world id, which did not move.
 */
const THE_WORD_A_RENAMED_FOUNDERS_LINE_KEEPS: ReadonlyMap<string, string> = new Map([
    ['npc-member-bell-keeper-ji', 'bell']
]);

/** The id of the line a founder starts. */
export function lineageIdOf(surname: string, founderId: string): string {
    return `lin-${THE_WORD_A_RENAMED_FOUNDERS_LINE_KEEPS.get(founderId) ?? surname.toLowerCase()}-${founderId}`;
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

/**
 * THE KINDS OF EDGE THAT STAND ABOVE SOMEBODY, RATHER THAN BESIDE THEM.
 *
 * An edge has only `parentId` and `childId` to put a pair in, so every relation
 * borrows those two fields - and two of them are not generational at all. A
 * `clan` edge is a MARRIAGE and a `sworn_sibling` edge is an oath between
 * equals: both people stand beside each other, and a walk that does not say so
 * steps sideways into a spouse and counts them as a generation.
 *
 * The design owner's ruling on which side each kind falls: a line of teaching IS
 * a lineage in this world - a disciple stands in a succession, inherits an art
 * and answers for the person who taught them - so `descendant`, `successor` and
 * `disciple` all stand above. A spouse is not an ancestor of anybody, and
 * neither is a sworn sibling.
 *
 * ADD A NEW EDGE KIND AND DECIDE HERE which side it falls on. This list is
 * where the next person will look, and the question to ask is not "is it
 * family" but "does this person stand ABOVE the other".
 */
export const STANDS_ABOVE_YOU: readonly LineageRelation[] =
    ['descendant', 'successor', 'disciple'] as const;

/**
 * Every edge this person is the `childId` end of, WHATEVER THE RELATION.
 *
 * UNFILTERED ON PURPOSE AND LOADED BECAUSE OF IT. A `clan` edge is a marriage
 * written through the same two fields, so this answers "who are this person's
 * parents" with their SPOUSE among them. Nothing in `src/` calls it today; a
 * caller that wants ancestry must filter by {@link STANDS_ABOVE_YOU}.
 */
export function parentsOf(lineage: LineageRecord, childId: string): LineageEdge[] {
    return lineage.edges
        .filter(e => e.childId === childId)
        .sort((a, b) => a.onDay - b.onDay || (a.parentId < b.parentId ? -1 : 1));
}

export function ancestorsOf(
    lineage: LineageRecord,
    descendantId: string,
    maxDepth = 8,
    relations: readonly LineageRelation[] = STANDS_ABOVE_YOU
): { id: string; depth: number; relation: LineageRelation }[] {
    const wanted = new Set(relations);
    const out: { id: string; depth: number; relation: LineageRelation }[] = [];
    const seen = new Set<string>([descendantId]);
    let frontier = [descendantId];

    for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
        const next: string[] = [];
        for (const id of frontier) {
            for (const edge of parentsOf(lineage, id)) {
                if (!wanted.has(edge.relation)) continue;
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

/**
 * Generations between the founder and this member. Zero for the founder.
 *
 * COUNTS ONLY WHAT STANDS ABOVE, and it did not always: this walks
 * `ancestorsOf`, which now filters by {@link STANDS_ABOVE_YOU}, so a marriage
 * is no longer a generation. A depth measured before 23 September may be larger
 * than the same house's depth now, and the difference is spouses that were
 * being counted as forebears - which made a house's depth depend on who married
 * whom. The number moved because the question was wrong, not the world.
 */
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
 *
 * ── IT WALKS DOWNWARD ONLY, AND THAT IS THE ANSWER RATHER THAN A GAP ─────
 *
 * This reads edges where the deceased is at the `parentId` end. So a person who
 * died as somebody's CHILD, with no children, disciples or successor of their
 * own, has no heir - and that is right: an estate descends. Your children
 * inherit from you; you do not inherit from your parents. Your disciple
 * inherits from you; you do not inherit from your master.
 *
 * `clan` is the exception and it is not an inconsistency: a marriage has no
 * downward, so it is written from BOTH ends and whichever spouse dies first
 * finds the other. Measured on one world at 200 years: 728 `descendant` edges,
 * none reciprocated; 164 `clan` edges, 82 reciprocated - every pair, both ways.
 *
 * Measured, so nobody investigates it twice: 282 deaths in that world found no
 * heir and every one of them was somebody whose only heir-kind edge was at the
 * child end. They are not missing edges. They are people who died as somebody's
 * child.
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
