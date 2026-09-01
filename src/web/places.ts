/**
 * The world map, as a view over `WorldState.locations`.
 *
 * A view, not a document - the same posture as `register.ts`. Nothing in this
 * file authors a place, a road or a distance. Every node here is a
 * `LocationRecord` the engine seeded, every edge is a `LocationLink` one of
 * those records holds, and a pair of locations with no link between them gets
 * no line. The map renders what the state says and stops there, which is the
 * same rule `auditNarration` enforces on prose: the client is not allowed to
 * be a second author of geography.
 *
 * ── The three things a cultivator actually asks about a place ────────────
 *
 * The record carries about forty fields. Three of them are the reason anyone
 * opens a map at all, and they are what the renderer encodes:
 *
 *   `qiDensity`    how fast you would climb standing there. 1..100, banded by
 *                  `ordinaryBandFor` so the map and the ambient engine cannot
 *                  drift apart.
 *   `thresholds`   whether going there kills you. Four ordinals that fail
 *                  differently - see `locations.ts` - reported raw so the
 *                  client can band them against any ordinal it likes rather
 *                  than against one baked in here.
 *   `travelDays`   what getting there costs. It lives on the edge, because
 *                  that is the only place distance exists in this model.
 *
 * ── There is no coordinate anywhere in this payload, deliberately ────────
 *
 * `LocationRecord` has no position and the engine has never needed one:
 * distance is `travelDays` on a link and containment is `parentId`. Emitting
 * an x/y here would be inventing geography, and a renderer that laid places
 * out by made-up coordinates would be read by an operator as a map of where
 * things are. So the payload is a containment tree plus a weighted graph, and
 * the client is told to say so.
 *
 * ── Arbitrary depth ──────────────────────────────────────────────────────
 *
 * Today the seed is two levels - regions holding places. Interiors
 * (`precinct`/`hall`/`chamber`/`vault`, see `architecture.ts`) nest further,
 * so `depth` is computed by walking parents rather than assumed, and a cycle
 * in `parentId` is survived rather than hung on.
 *
 * ── Admin sees everything; this payload is still built for the player ────
 *
 * `discovered` is carried on every node and never used to filter here. The
 * admin surface shows all of them and marks the undiscovered ones, so the
 * operator can see the fog the player is standing in; a player-facing map
 * drops `discovered === false` at the boundary and needs no other change.
 * `docs/world/discovery.md` is the authority on why that gate exists.
 */

import type { WorldState } from '../engine/world/world-state.js';
import type { LinkKind, LocationKind, LocationRecord } from '../engine/world/locations.js';
import { isOpenOn, nextClosingDay, nextOpeningDay, ordinaryBandFor } from '../engine/world/locations.js';
import type { LayerKey } from '../engine/world/layers.js';
import { WORLD_LAYERS } from '../engine/world/layers.js';

// ─────────────────────────────────────────────────────────────────────────
// THE VIEW
// ─────────────────────────────────────────────────────────────────────────

export interface PlaceNodeView {
    id: string;
    name: string;
    kind: LocationKind;
    layer: LayerKey;
    parentId: string | null;
    /** Steps to a root. Computed, not assumed - interiors nest deeper. */
    depth: number;
    childIds: string[];
    description: string;

    /** Geology, 1..100, and the band a surveyor would write down for it. */
    qiDensity: number;
    qiBand: 'thin' | 'normal' | 'dense' | 'spirit_tide';
    /** Usable qi, 0..1. Deliberately not the same number as `qiDensity`. */
    spiritualDensity: number;
    ambient: string;
    danger: number;
    climate: string;
    politicalControl: string;

    /** Raw ordinals. Banding against a viewer is the client's job. */
    thresholds: { entry: number; survival: number; operational: number; mastery: number };

    hazards: string[];
    tags: string[];
    resources: string[];
    specialRules: string[];

    sealed: boolean;
    sealedOnDay: number | null;
    discovered: boolean;
    discoveredOnDay: number | null;

    controllingFactionId: string | null;
    controllingFactionName: string | null;

    /** Standing open on the world's current day. Sealed places never are. */
    open: boolean;
    cycle: { periodDays: number; openDays: number; phaseDay: number } | null;
    /** Days until it next opens. Null when open now, or when it never will. */
    opensInDays: number | null;
    /** Days until the current opening ends. Null when it does not close. */
    closesInDays: number | null;

    /** Links this record holds, before deduplication. */
    linkCount: number;
}

export interface PlaceEdgeView {
    id: string;
    fromId: string;
    toId: string;
    kind: LinkKind;
    /** Days. A portal is fast and is not instantaneous. */
    travelDays: number;
    open: boolean;
    requiresKeyId: string | null;
    note: string;
    /** Both endpoints record the link. A one-sided road is a real state. */
    mutual: boolean;
    /** The two sides disagree about the cost; `travelDays` is the larger. */
    asymmetric: boolean;
}

export interface PlacesView {
    /** Null when no run has instantiated a world. Not an error. */
    world: { seed: string; currentDay: number } | null;
    locations: PlaceNodeView[];
    edges: PlaceEdgeView[];
    layers: { key: LayerKey; label: string; count: number }[];
    counts: {
        total: number;
        discovered: number;
        sealed: number;
        closed: number;
        roots: number;
        maxDepth: number;
        byKind: Record<string, number>;
        byLinkKind: Record<string, number>;
    };
    /**
     * Links naming a location this world does not hold. Reported rather than
     * drawn: a line to nowhere is the one thing worse than a missing line.
     */
    danglingLinks: number;
    /** Parent ids that name no location. Same reasoning. */
    orphanedParents: number;
}

const EMPTY_COUNTS: PlacesView['counts'] = {
    total: 0,
    discovered: 0,
    sealed: 0,
    closed: 0,
    roots: 0,
    maxDepth: 0,
    byKind: {},
    byLinkKind: {}
};

export function emptyPlacesView(): PlacesView {
    return {
        world: null,
        locations: [],
        edges: [],
        layers: [],
        counts: { ...EMPTY_COUNTS, byKind: {}, byLinkKind: {} },
        danglingLinks: 0,
        orphanedParents: 0
    };
}

/**
 * Depth by walking parents, with a visited set.
 *
 * The set is not defensive decoration: `parentId` is a plain string field with
 * no constraint behind it, and a cycle put in by a bad change would otherwise
 * hang the request rather than fail it.
 */
function depthOf(id: string, byId: Map<string, LocationRecord>): number {
    const seen = new Set<string>([id]);
    let depth = 0;
    let cursor = byId.get(id)?.parentId ?? null;
    while (cursor && byId.has(cursor) && !seen.has(cursor)) {
        seen.add(cursor);
        depth += 1;
        cursor = byId.get(cursor)?.parentId ?? null;
    }
    return depth;
}

function nodeView(
    loc: LocationRecord,
    byId: Map<string, LocationRecord>,
    children: Map<string, string[]>,
    factionNames: Map<string, string>,
    day: number
): PlaceNodeView {
    const open = isOpenOn(loc, day);
    const nextOpen = nextOpeningDay(loc, day);
    const nextClose = nextClosingDay(loc, day);

    return {
        id: loc.id,
        name: loc.name,
        kind: loc.kind,
        layer: loc.layer,
        parentId: loc.parentId && byId.has(loc.parentId) ? loc.parentId : null,
        depth: depthOf(loc.id, byId),
        childIds: children.get(loc.id) ?? [],
        description: loc.description,

        qiDensity: loc.qiDensity,
        qiBand: ordinaryBandFor(loc.qiDensity),
        spiritualDensity: loc.environment.spiritualDensity,
        ambient: loc.ambient,
        danger: loc.environment.danger,
        climate: loc.environment.climate,
        politicalControl: loc.environment.politicalControl,

        thresholds: { ...loc.thresholds },

        hazards: loc.hazards.slice(),
        tags: loc.tags.slice(),
        resources: loc.environment.resources.slice(),
        specialRules: loc.environment.specialRules.slice(),

        sealed: loc.sealed,
        sealedOnDay: loc.sealedOnDay,
        discovered: loc.discovered,
        discoveredOnDay: loc.discoveredOnDay,

        controllingFactionId: loc.controllingFactionId,
        controllingFactionName: loc.controllingFactionId
            ? factionNames.get(loc.controllingFactionId) ?? null
            : null,

        open,
        cycle: loc.cycle ? { ...loc.cycle } : null,
        opensInDays: open || nextOpen === null ? null : Math.max(0, nextOpen - day),
        closesInDays: open && nextClose !== null ? Math.max(0, nextClose - day) : null,

        linkCount: loc.links.length
    };
}

/**
 * One edge per pair per link kind.
 *
 * A road recorded on both ends is one road. Where the two ends disagree about
 * the cost the larger is kept and the disagreement is flagged, because a
 * traveller does not get to pick the cheaper direction's number and the
 * discrepancy is worth an operator seeing rather than worth averaging away.
 */
function buildEdges(locations: LocationRecord[], byId: Map<string, LocationRecord>): {
    edges: PlaceEdgeView[];
    dangling: number;
} {
    const edges = new Map<string, PlaceEdgeView>();
    let dangling = 0;

    for (const loc of locations) {
        for (const link of loc.links) {
            if (!byId.has(link.toLocationId)) {
                dangling += 1;
                continue;
            }
            if (link.toLocationId === loc.id) continue;

            const [a, b] = loc.id < link.toLocationId
                ? [loc.id, link.toLocationId]
                : [link.toLocationId, loc.id];
            const key = `${a}|${b}|${link.kind}`;
            const existing = edges.get(key);

            if (!existing) {
                edges.set(key, {
                    id: key,
                    fromId: a,
                    toId: b,
                    kind: link.kind,
                    travelDays: link.travelDays,
                    open: link.open,
                    requiresKeyId: link.requiresKeyId,
                    note: link.note,
                    mutual: false,
                    asymmetric: false
                });
                continue;
            }

            existing.mutual = true;
            if (existing.travelDays !== link.travelDays) {
                existing.asymmetric = true;
                existing.travelDays = Math.max(existing.travelDays, link.travelDays);
            }
            // A crossing shut from either end is shut.
            existing.open = existing.open && link.open;
            if (!existing.note && link.note) existing.note = link.note;
            if (!existing.requiresKeyId && link.requiresKeyId) existing.requiresKeyId = link.requiresKeyId;
        }
    }

    return { edges: [...edges.values()], dangling };
}

/**
 * Everything the map draws, from one world.
 *
 * Pure: state in, view out, nothing mutated and no I/O. `world` being null is
 * the ordinary answer before a run exists and is reported as such rather than
 * as a failure - there is no world to draw, which is different from a world
 * that failed to load.
 */
export function placesView(world: WorldState | null): PlacesView {
    if (!world) return emptyPlacesView();

    const locations = world.locations ?? [];
    const byId = new Map(locations.map(l => [l.id, l]));
    const factionNames = new Map((world.factions ?? []).map(f => [f.id, f.name]));
    const day = world.currentDay;

    const children = new Map<string, string[]>();
    let orphanedParents = 0;
    for (const loc of locations) {
        if (!loc.parentId) continue;
        if (!byId.has(loc.parentId)) {
            orphanedParents += 1;
            continue;
        }
        const bucket = children.get(loc.parentId);
        if (bucket) bucket.push(loc.id);
        else children.set(loc.parentId, [loc.id]);
    }
    // Stable order inside every container, so a redraw does not reshuffle.
    for (const bucket of children.values()) {
        bucket.sort((a, b) => (byId.get(a)?.name ?? '').localeCompare(byId.get(b)?.name ?? ''));
    }

    const nodes = locations.map(loc => nodeView(loc, byId, children, factionNames, day));
    const { edges, dangling } = buildEdges(locations, byId);

    const byKind: Record<string, number> = {};
    const byLinkKind: Record<string, number> = {};
    let discovered = 0;
    let sealed = 0;
    let closed = 0;
    let roots = 0;
    let maxDepth = 0;

    for (const n of nodes) {
        byKind[n.kind] = (byKind[n.kind] ?? 0) + 1;
        if (n.discovered) discovered += 1;
        if (n.sealed) sealed += 1;
        if (!n.open) closed += 1;
        if (!n.parentId) roots += 1;
        if (n.depth > maxDepth) maxDepth = n.depth;
    }
    for (const e of edges) byLinkKind[e.kind] = (byLinkKind[e.kind] ?? 0) + 1;

    const layers = WORLD_LAYERS
        .map(l => ({
            key: l.key,
            label: l.name,
            count: nodes.filter(n => n.layer === l.key).length
        }))
        .filter(l => l.count > 0);

    return {
        world: { seed: world.seed, currentDay: day },
        locations: nodes.sort((a, b) => a.name.localeCompare(b.name)),
        edges: edges.sort((a, b) => a.id.localeCompare(b.id)),
        layers,
        counts: { total: nodes.length, discovered, sealed, closed, roots, maxDepth, byKind, byLinkKind },
        danglingLinks: dangling,
        orphanedParents
    };
}
