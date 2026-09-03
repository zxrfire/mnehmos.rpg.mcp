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
 * `docs/world/houses/discovery.md` is the authority on why that gate exists.
 *
 * ── What is TRUE of a place is not the same as what a place IS ───────────
 *
 * `WorldState.statuses` is the layer in
 * `engine/world/what-is-true-of-a-place-right-now.ts`: a famine, a war on the
 * ground a house stands on, a beast tide running, a district its holder has
 * worked out. Those are the answer to "what is going on here", they change
 * prices and danger while they last, and this view carried none of them - so
 * an operator's map of the world could not report the one thing about it that
 * is currently moving.
 *
 * They are joined here through `statusesInArea`, which is the same call the
 * played `investigate` verb makes, so the map and the game cannot disagree
 * about what is happening. A status is true of its area AND of everything
 * under it, which is why a node inherits its ancestors' and says which of them
 * it owns.
 *
 * `causeKnownLocally` travels raw. This surface is admin and sees everything;
 * masking a cause by a knowing stage is `readStatusAtStage`'s job at the
 * player boundary, and there is exactly one knowledge ladder in this repo.
 *
 * ── The ground scale moved, and old rows did not ─────────────────────────
 *
 * `qiDensity` is 1..100 (`engine/world/qi-scale.ts`, which records why it left
 * 0..1). A world instantiated before that move holds fractions, and every one
 * of them rounds to the bottom of the new scale: measured on a live database,
 * Nine Peaks - "the deepest vein anyone has kept" - and a thin ford town both
 * reported `ground 0 of 100, thin`, which is the map's single most important
 * figure reading as a constant zero for every place in the world.
 *
 * So a value at or below 1 is read as the pre-move fraction it unambiguously
 * is and multiplied by `QI_DENSITY_MAX` - the conversion `qiFraction` already
 * states in the other direction, not a guess. `rescaledGround` counts them, so
 * the panel can say once that it is looking at a world older than the scale
 * rather than repeating a caveat on every row. Nothing is written back: this
 * is a view, and a storage migration is not its business.
 */

import type { WorldState } from '../engine/world/world-state.js';
import type { LinkKind, LocationKind, LocationRecord } from '../engine/world/locations.js';
import { isOpenOn, nextClosingDay, nextOpeningDay, ordinaryBandFor } from '../engine/world/locations.js';
import { QI_DENSITY_MAX } from '../engine/world/qi-scale.js';
import type { AreaStatus } from '../engine/world/what-is-true-of-a-place-right-now.js';
import { statusesInArea } from '../engine/world/what-is-true-of-a-place-right-now.js';
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
    /** True when this row was stored on the old 0..1 scale and was rescaled. */
    groundRescaled: boolean;
    /** Usable qi, 0..1. Deliberately not the same number as `qiDensity`. */
    spiritualDensity: number;
    ambient: string;
    danger: number;
    climate: string;
    politicalControl: string;

    /** Raw ordinals. Banding against a viewer is the client's job. */
    thresholds: { entry: number; survival: number; operational: number; mastery: number };

    hazards: string[];
    /** How the place treats a particular kind of cultivator, boon or bane. */
    affinities: { tag: string; multiplier: number; thresholdOffset: number; note: string }[];
    tags: string[];
    resources: string[];
    specialRules: string[];

    sealed: boolean;
    sealedOnDay: number | null;
    /** What opens it, when something does. `architecture.ts` seals vaults with one. */
    keyId: string | null;

    /** Null when nothing has moved it off what it started as. */
    origin: PlaceOriginView | null;
    /** Most recent first, capped. `changeCount` is the true total. */
    changes: PlaceChangeView[];
    changeCount: number;
    discovered: boolean;
    discoveredOnDay: number | null;

    controllingFactionId: string | null;
    /** The claim on paper: the faction the record names as holding it. */
    controllingFactionName: string | null;
    /**
     * Who runs it on the ground, in the record's own words.
     *
     * Carried beside `controllingFactionName` rather than folded into it,
     * because a house can claim what it does not hold and the two fields
     * disagreeing is the interesting state, not a data error.
     */
    heldBy: string;
    /** True when the paper claim and the words on the ground do not match. */
    contested: boolean;

    /**
     * What the place was cut for, and how many are in it.
     *
     * `architecture.ts` stores capacity and deliberately stores no other
     * measurement, because capacity against occupancy is the fact that
     * carries: a practice yard cut for six hundred holding ninety says more
     * about a sect's century than any number written next to it.
     */
    capacity: number | null;
    occupancy: number;
    /** A house's architectural signature, from `data.styleTags`. */
    styleTags: string[];

    /** Standing open on the world's current day. Sealed places never are. */
    open: boolean;
    cycle: { periodDays: number; openDays: number; phaseDay: number } | null;
    /** Days until it next opens. Null when open now, or when it never will. */
    opensInDays: number | null;
    /** Days until the current opening ends. Null when it does not close. */
    closesInDays: number | null;

    /** Links this record holds, before deduplication. */
    linkCount: number;

    /**
     * What is true of this place today, innermost first.
     *
     * Includes what is true of every area above it, because a famine in a
     * province is a famine in its towns. `ownArea` separates the two so a
     * reader can tell a war on this ground from a war in the province.
     */
    statuses: PlaceStatusView[];
}

/**
 * One thing that is true of a place right now.
 *
 * Every figure the status carries is kept - `stops`, the price multiplier and
 * the danger delta are what it DOES, and a status shown without them is a mood
 * rather than a mechanic. See `facts.ts` on keeping every number.
 */
export interface PlaceStatusView {
    id: string;
    /** The area it is written against, which may be an ancestor of this node. */
    areaId: string;
    areaName: string;
    /** True when this node is the area itself rather than under it. */
    ownArea: boolean;
    kind: string;
    statement: string;
    /** What happened: a ground change, a seal, a decision, a harvest failing. */
    cause: string;
    /** What anybody standing here observes, understanding nothing. */
    signs: string[];
    /** Whether asking around here gets you the cause. Usually false. */
    causeKnownLocally: boolean;
    /** Who decided it, where somebody did. Null for weather and ground. */
    decidedById: string | null;
    decidedByName: string | null;
    beganOnDay: number;
    daysRunning: number;
    reviewOnDay: number;
    /** Days until the world looks at it again. Negative means overdue. */
    reviewInDays: number;
    /** What is simply not to be had here while this is true. */
    stops: string[];
    priceMultiplier: number;
    dangerDelta: number;
}

/**
 * One dated thing that was done to a place.
 *
 * `locations.ts` stores a location as origin plus an append-only list of
 * changes plus the materialised present, and the middle layer is the whole of
 * why the world reads as alive: a valley that was a sect, then a battlefield,
 * then a merchant city is three facts with dates on them rather than one
 * adjective. Nothing surfaced it before this view did.
 *
 * `causeKnown` is carried because "nobody alive can explain it" is a stored
 * state of the world and not a gap in the record, and `attributedCauses` are
 * what the people living there say instead - stories, not truth.
 */
export interface PlaceChangeView {
    onDay: number;
    kind: string;
    summary: string;
    causeKnown: boolean;
    attributedCauses: string[];
    fidelity: 'full' | 'partial' | 'rumour' | 'lost';
    witnessed: boolean;
}

/** What a place was before anything happened to it, when that differs. */
export interface PlaceOriginView {
    kind: LocationKind;
    name: string;
    qiDensity: number;
    ambient: string;
    fromDay: number | null;
    /** Which of the four moved. Saves the client diffing it again. */
    changed: ('kind' | 'name' | 'qiDensity' | 'ambient')[];
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
        /**
         * Places whose ground was stored on the old 0..1 scale. Counted so the
         * panel can state it once instead of on every row, which is the rule
         * `facts.ts` gives for a constant.
         */
        rescaledGround: number;
        /** Area statuses running somewhere in the world on this day. */
        runningStatuses: number;
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
    rescaledGround: 0,
    runningStatuses: 0,
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

/**
 * How much of a place's history travels with the map.
 *
 * The whole ledger would be correct and would also be the largest thing in a
 * payload that already carries eight hundred locations. The most recent eight
 * is what a panel shows without being asked; `changeCount` says how much more
 * there is, so the view never implies a short history a place does not have.
 */
const CHANGE_LIMIT = 8;

/**
 * What the place used to be, when that is different from what it is.
 *
 * Null when nothing moved, so an ordinary room does not render a section
 * saying it is still what it was. A valley that was a sect and then a
 * battlefield returns the four fields that moved and the day it started from.
 */
function originView(loc: LocationRecord): PlaceOriginView | null {
    const o = loc.origin;
    const changed: PlaceOriginView['changed'] = [];
    if (o.kind !== loc.kind) changed.push('kind');
    if (o.name !== loc.name) changed.push('name');
    if (o.qiDensity !== loc.qiDensity) changed.push('qiDensity');
    if (o.ambient !== loc.ambient) changed.push('ambient');
    if (!changed.length) return null;
    return {
        kind: o.kind,
        name: o.name,
        qiDensity: o.qiDensity,
        ambient: o.ambient,
        fromDay: o.fromDay,
        changed
    };
}

/**
 * The ground figure on the scale this view promises, 1..100.
 *
 * The tell is FRACTIONAL, not small. `clampQiDensity` rounds, so every value
 * written on the current scale is an integer; a stored 0.3475 can only be the
 * old fraction, and it is converted by the same constant `qiFraction` divides
 * by - the conversion stated in the other direction, not a guess. An integer
 * is returned untouched, so a fresh world never goes near this branch.
 *
 * The one ambiguous input is exactly 1.0, which is the old scale's ceiling and
 * the new scale's floor. It is read as the floor. That errs toward calling
 * ground dead rather than toward inventing the best vein in the world, which
 * is the direction a map should be wrong in.
 */
function groundOf(stored: number): { value: number; rescaled: boolean } {
    // The floor is `QI_DENSITY_MIN` on both branches, not zero: the scale says
    // dead ground still reads 1, because 0 would mean unmeasured. Worlds older
    // than the scale stored a literal 0 for a scar, which is an integer and so
    // takes the untouched branch, and printed as `ground 0 of 100` - a figure
    // the scale has no meaning for.
    const onScale = (n: number) => Math.max(1, Math.min(QI_DENSITY_MAX, Math.round(n)));
    if (!Number.isFinite(stored)) return { value: 1, rescaled: false };
    if (Number.isInteger(stored) && stored >= 1) return { value: onScale(stored), rescaled: false };
    if (stored === 0) return { value: 1, rescaled: true };
    return { value: onScale(stored * QI_DENSITY_MAX), rescaled: true };
}

/** A `data` value that is meant to be a count, or null when it is not one. */
function numberField(loc: LocationRecord, key: string): number | null {
    const raw = loc.data?.[key];
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
}

function nodeView(
    loc: LocationRecord,
    byId: Map<string, LocationRecord>,
    children: Map<string, string[]>,
    factionNames: Map<string, string>,
    occupancy: Map<string, number>,
    statusesFor: (id: string) => PlaceStatusView[],
    day: number
): PlaceNodeView {
    const open = isOpenOn(loc, day);
    const ground = groundOf(loc.qiDensity);
    const nextOpen = nextOpeningDay(loc, day);
    const nextClose = nextClosingDay(loc, day);
    const claim = loc.controllingFactionId ? factionNames.get(loc.controllingFactionId) ?? null : null;
    const held = loc.environment.politicalControl;

    return {
        id: loc.id,
        name: loc.name,
        kind: loc.kind,
        layer: loc.layer,
        parentId: loc.parentId && byId.has(loc.parentId) ? loc.parentId : null,
        depth: depthOf(loc.id, byId),
        childIds: children.get(loc.id) ?? [],
        description: loc.description,

        qiDensity: ground.value,
        qiBand: ordinaryBandFor(ground.value),
        groundRescaled: ground.rescaled,
        spiritualDensity: loc.environment.spiritualDensity,
        ambient: loc.ambient,
        danger: loc.environment.danger,
        climate: loc.environment.climate,
        politicalControl: loc.environment.politicalControl,

        thresholds: { ...loc.thresholds },

        hazards: loc.hazards.slice(),
        affinities: loc.affinities.map(a => ({ ...a })),
        tags: loc.tags.slice(),
        resources: loc.environment.resources.slice(),
        specialRules: loc.environment.specialRules.slice(),

        sealed: loc.sealed,
        sealedOnDay: loc.sealedOnDay,
        keyId: typeof loc.data?.keyId === 'string' ? loc.data.keyId : null,

        origin: originView(loc),
        changes: loc.changes.slice(-CHANGE_LIMIT).reverse().map(c => ({
            onDay: c.onDay,
            kind: c.kind,
            summary: c.summary,
            causeKnown: c.causeKnown,
            attributedCauses: c.attributedCauses.slice(),
            fidelity: c.fidelity,
            witnessed: c.witnessed
        })),
        changeCount: loc.changes.length,
        discovered: loc.discovered,
        discoveredOnDay: loc.discoveredOnDay,

        controllingFactionId: loc.controllingFactionId,
        controllingFactionName: claim,
        heldBy: held,
        // Substring rather than equality: the words on the ground are prose
        // ("the Azure Cloud Pavilion, thinly"), and a house that is named in
        // them is holding what it claims however grudgingly.
        contested: Boolean(claim) && !held.toLowerCase().includes(claim!.toLowerCase()),

        capacity: numberField(loc, 'capacity'),
        occupancy: occupancy.get(loc.id) ?? 0,
        styleTags: String(loc.data?.styleTags ?? '').split(/\s+/).filter(Boolean),

        open,
        cycle: loc.cycle ? { ...loc.cycle } : null,
        opensInDays: open || nextOpen === null ? null : Math.max(0, nextOpen - day),
        closesInDays: open && nextClose !== null ? Math.max(0, nextClose - day) : null,

        linkCount: loc.links.length,

        statuses: statusesFor(loc.id)
    };
}

/**
 * One running status, as this node sees it.
 *
 * `daysRunning` and `reviewInDays` are derived here rather than left to the
 * client, because both are arithmetic on the world's current day and the
 * client does not own that arithmetic anywhere else on this payload.
 */
function statusView(
    status: AreaStatus,
    nodeId: string,
    names: Map<string, string>,
    factionNames: Map<string, string>,
    day: number
): PlaceStatusView {
    return {
        id: status.id,
        areaId: status.areaId,
        areaName: names.get(status.areaId) ?? status.areaId,
        ownArea: status.areaId === nodeId,
        kind: status.kind,
        statement: status.statement,
        cause: status.cause.what,
        signs: status.signs.slice(),
        causeKnownLocally: status.causeKnownLocally,
        decidedById: status.cause.decidedById,
        decidedByName: status.cause.decidedById
            ? factionNames.get(status.cause.decidedById) ?? null
            : null,
        beganOnDay: status.beganOnDay,
        daysRunning: Math.max(0, day - status.beganOnDay),
        reviewOnDay: status.reviewOnDay,
        reviewInDays: status.reviewOnDay - day,
        stops: status.stops.slice(),
        priceMultiplier: status.priceMultiplier,
        dangerDelta: status.dangerDelta
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

    // Occupancy: who is standing in each place right now. Capacity is stored
    // on the record and this is the other half of it.
    const occupancy = new Map<string, number>();
    for (const npc of world.npcs ?? []) {
        const at = (npc as { locationId?: string | null }).locationId;
        if (at) occupancy.set(at, (occupancy.get(at) ?? 0) + 1);
    }

    // What is TRUE of a place, joined through the engine's own call so the map
    // and the played `investigate` cannot answer differently. Statuses are a
    // handful per world and the ancestor walk is short, so this is done per
    // node rather than indexed; a world with a status per location would want
    // an index and does not exist.
    const allStatuses = world.statuses ?? [];
    const names = new Map(locations.map(l => [l.id, l.name]));
    const statusesFor = allStatuses.length === 0
        ? () => []
        : (id: string) => statusesInArea(allStatuses, locations, id, day)
            .map(s => statusView(s, id, names, factionNames, day));

    const nodes = locations.map(loc =>
        nodeView(loc, byId, children, factionNames, occupancy, statusesFor, day));
    const { edges, dangling } = buildEdges(locations, byId);

    const byKind: Record<string, number> = {};
    const byLinkKind: Record<string, number> = {};
    let discovered = 0;
    let sealed = 0;
    let closed = 0;
    let roots = 0;
    let maxDepth = 0;
    let rescaledGround = 0;

    for (const n of nodes) {
        byKind[n.kind] = (byKind[n.kind] ?? 0) + 1;
        if (n.discovered) discovered += 1;
        if (n.sealed) sealed += 1;
        if (!n.open) closed += 1;
        if (!n.parentId) roots += 1;
        if (n.groundRescaled) rescaledGround += 1;
        if (n.depth > maxDepth) maxDepth = n.depth;
    }
    // Distinct statuses actually running, not the sum of the per-node lists -
    // one famine over a province is inherited by every town in it and would
    // otherwise be counted once per town.
    const runningStatuses = new Set(
        nodes.flatMap(n => n.statuses.filter(s => s.ownArea).map(s => s.id))
    ).size;
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
        counts: {
            total: nodes.length,
            discovered,
            sealed,
            closed,
            roots,
            maxDepth,
            rescaledGround,
            runningStatuses,
            byKind,
            byLinkKind
        },
        danglingLinks: dangling,
        orphanedParents
    };
}
