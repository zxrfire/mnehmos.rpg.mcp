/**
 * The world map view.
 *
 * Two things are being pinned here, and they are the two the map can get
 * wrong in a way nobody would notice by looking at it.
 *
 * FIRST: it may not invent geography. A line on a map is read as a road. So
 * the edge builder is tested for the shapes that would produce a wrong line -
 * a link naming a location this world does not hold, a self-link, a link
 * recorded from both ends becoming two roads, and two ends that disagree
 * about the cost.
 *
 * SECOND: it must be built for the player it does not serve yet. `discovered`
 * is carried on every node and never filtered here, so the admin surface can
 * show the fog rather than hide behind it, and a player-facing map is a filter
 * at the boundary rather than a rewrite.
 *
 * The last block runs the real seeded world through it, because the shape of
 * the payload is only worth what the world actually produces - two levels
 * today, more once interiors land, and the depth walk has to survive both.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { makeLocation, type LocationRecord } from '../../src/engine/world/locations.js';
import type { WorldState } from '../../src/engine/world/world-state.js';
import { emptyPlacesView, placesView } from '../../src/web/places.js';
import { seedWorld } from '../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../src/engine/world/catalog.js';
import { makeGame, startHttp, type HttpHarness } from './harness';

function world(locations: LocationRecord[], currentDay = 0): WorldState {
    return {
        seed: 'map-test',
        currentDay,
        locations,
        factions: [],
        npcs: []
    } as unknown as WorldState;
}

const link = (to: string, over: Partial<LocationRecord['links'][number]> = {}) => ({
    toLocationId: to,
    kind: 'road' as const,
    travelDays: 3,
    requiresKeyId: null,
    open: true,
    note: '',
    ...over
});

describe('a map with no world', () => {
    it('answers with an empty view rather than an error', () => {
        const view = placesView(null);
        expect(view.world).toBeNull();
        expect(view.locations).toEqual([]);
        expect(view).toEqual(emptyPlacesView());
    });
});

describe('edges are links, and only links', () => {
    it('draws one edge for a road both ends record', () => {
        const view = placesView(world([
            makeLocation({ id: 'a', name: 'A', kind: 'settlement', links: [link('b')] }),
            makeLocation({ id: 'b', name: 'B', kind: 'settlement', links: [link('a')] })
        ]));
        expect(view.edges).toHaveLength(1);
        expect(view.edges[0].mutual).toBe(true);
        expect(view.edges[0].travelDays).toBe(3);
    });

    it('keeps a road only one end records, and says so', () => {
        const view = placesView(world([
            makeLocation({ id: 'a', name: 'A', kind: 'settlement', links: [link('b')] }),
            makeLocation({ id: 'b', name: 'B', kind: 'settlement' })
        ]));
        expect(view.edges).toHaveLength(1);
        expect(view.edges[0].mutual).toBe(false);
    });

    it('takes the more expensive figure when the two ends disagree', () => {
        const view = placesView(world([
            makeLocation({ id: 'a', name: 'A', kind: 'settlement', links: [link('b', { travelDays: 3 })] }),
            makeLocation({ id: 'b', name: 'B', kind: 'settlement', links: [link('a', { travelDays: 9 })] })
        ]));
        expect(view.edges[0].travelDays).toBe(9);
        expect(view.edges[0].asymmetric).toBe(true);
    });

    it('treats two kinds between the same pair as two crossings', () => {
        const view = placesView(world([
            makeLocation({
                id: 'a', name: 'A', kind: 'settlement',
                links: [link('b'), link('b', { kind: 'tunnel', travelDays: 1 })]
            }),
            makeLocation({ id: 'b', name: 'B', kind: 'settlement' })
        ]));
        expect(view.edges.map(e => e.kind).sort()).toEqual(['road', 'tunnel']);
    });

    it('a crossing shut from either end is shut', () => {
        const view = placesView(world([
            makeLocation({ id: 'a', name: 'A', kind: 'settlement', links: [link('b', { open: true })] }),
            makeLocation({ id: 'b', name: 'B', kind: 'settlement', links: [link('a', { open: false })] })
        ]));
        expect(view.edges[0].open).toBe(false);
    });

    it('refuses to draw a link to a place this world does not hold, and counts it', () => {
        const view = placesView(world([
            makeLocation({ id: 'a', name: 'A', kind: 'settlement', links: [link('nowhere')] })
        ]));
        expect(view.edges).toEqual([]);
        expect(view.danglingLinks).toBe(1);
    });

    it('drops a link from a place to itself', () => {
        const view = placesView(world([
            makeLocation({ id: 'a', name: 'A', kind: 'settlement', links: [link('a')] })
        ]));
        expect(view.edges).toEqual([]);
    });
});

describe('containment at arbitrary depth', () => {
    it('walks parents rather than assuming two levels', () => {
        const view = placesView(world([
            makeLocation({ id: 'r', name: 'Region', kind: 'region' }),
            makeLocation({ id: 's', name: 'Seat', kind: 'sect_seat', parentId: 'r' }),
            makeLocation({ id: 'p', name: 'Precinct', kind: 'precinct', parentId: 's' }),
            makeLocation({ id: 'h', name: 'Hall', kind: 'hall', parentId: 'p' }),
            makeLocation({ id: 'v', name: 'Vault', kind: 'vault', parentId: 'h' })
        ]));
        const depth = new Map(view.locations.map(l => [l.id, l.depth]));
        expect(depth.get('r')).toBe(0);
        expect(depth.get('v')).toBe(4);
        expect(view.counts.maxDepth).toBe(4);
        expect(view.locations.find(l => l.id === 's')!.childIds).toEqual(['p']);
    });

    it('survives a parent cycle instead of hanging on it', () => {
        const view = placesView(world([
            makeLocation({ id: 'a', name: 'A', kind: 'region', parentId: 'b' }),
            makeLocation({ id: 'b', name: 'B', kind: 'region', parentId: 'a' })
        ]));
        expect(view.locations).toHaveLength(2);
        expect(view.locations.every(l => Number.isFinite(l.depth))).toBe(true);
    });

    it('reports a parent that names no location rather than nesting under it', () => {
        const view = placesView(world([
            makeLocation({ id: 'a', name: 'A', kind: 'settlement', parentId: 'gone' })
        ]));
        expect(view.orphanedParents).toBe(1);
        expect(view.locations[0].parentId).toBeNull();
        expect(view.counts.roots).toBe(1);
    });
});

describe('states the renderer has to draw differently', () => {
    it('a sealed place is never open', () => {
        const view = placesView(world([
            makeLocation({ id: 'a', name: 'A', kind: 'ruin', sealed: true })
        ]));
        expect(view.locations[0].open).toBe(false);
        expect(view.locations[0].opensInDays).toBeNull();
        expect(view.counts.sealed).toBe(1);
    });

    it('a cycled place says how long until the door is open', () => {
        // Ten days open in every hundred, phase 0. Day 40 is shut; the next
        // opening is day 100, sixty days out.
        const cycle = { periodDays: 100, openDays: 10, phaseDay: 0 };
        const view = placesView(world([
            makeLocation({ id: 'a', name: 'A', kind: 'secret_realm', cycle })
        ], 40));
        expect(view.locations[0].open).toBe(false);
        expect(view.locations[0].opensInDays).toBe(60);
        expect(view.counts.closed).toBe(1);
    });

    it('a cycled place standing open says how long it has', () => {
        const cycle = { periodDays: 100, openDays: 10, phaseDay: 0 };
        const view = placesView(world([
            makeLocation({ id: 'a', name: 'A', kind: 'secret_realm', cycle })
        ], 3));
        expect(view.locations[0].open).toBe(true);
        expect(view.locations[0].closesInDays).toBe(7);
        expect(view.locations[0].opensInDays).toBeNull();
    });

    it('carries thresholds raw, so banding is the viewer question it is', () => {
        const view = placesView(world([
            makeLocation({
                id: 'a', name: 'A', kind: 'forbidden_zone',
                thresholds: { entry: 4, survival: 9, operational: 14, mastery: 22 }
            })
        ]));
        expect(view.locations[0].thresholds).toEqual({ entry: 4, survival: 9, operational: 14, mastery: 22 });
    });

    it('bands qi off the engine scale rather than a second one', () => {
        const view = placesView(world([
            makeLocation({ id: 'a', name: 'A', kind: 'vein', qiDensity: 100 }),
            makeLocation({ id: 'b', name: 'B', kind: 'scar', qiDensity: 2 })
        ]));
        const band = new Map(view.locations.map(l => [l.id, l.qiBand]));
        expect(band.get('a')).toBe('spirit_tide');
        expect(band.get('b')).toBe('thin');
    });
});

describe('the fog is carried, not applied', () => {
    it('keeps an undiscovered place in the payload and marks it', () => {
        const view = placesView(world([
            makeLocation({ id: 'a', name: 'A', kind: 'ruin', discovered: false }),
            makeLocation({ id: 'b', name: 'B', kind: 'settlement', discovered: true })
        ]));
        expect(view.locations).toHaveLength(2);
        expect(view.counts.discovered).toBe(1);
        expect(view.locations.find(l => l.id === 'a')!.discovered).toBe(false);
    });
});

describe('the real seeded world', () => {
    it('renders every location the seed produced, with edges that all land', async () => {
        const catalog = await loadCultivationCatalog();
        const { state } = seedWorld({ seed: 'places-probe', catalog });
        const view = placesView(state);

        expect(view.world).not.toBeNull();
        expect(view.locations.length).toBe(state.locations.length);
        expect(view.locations.length).toBeGreaterThan(20);

        // Every edge names two places that are actually in the payload.
        const ids = new Set(view.locations.map(l => l.id));
        for (const e of view.edges) {
            expect(ids.has(e.fromId)).toBe(true);
            expect(ids.has(e.toId)).toBe(true);
        }

        // Deduplication is real: a mutual road must not appear twice.
        expect(new Set(view.edges.map(e => e.id)).size).toBe(view.edges.length);
        expect(view.edges.length).toBeGreaterThan(0);
        expect(view.edges.length).toBeLessThanOrEqual(
            state.locations.reduce((n, l) => n + l.links.length, 0)
        );

        // Nesting is measured, not assumed.
        expect(view.counts.roots).toBeGreaterThan(0);
        expect(view.counts.maxDepth).toBeGreaterThanOrEqual(1);
        expect(view.counts.total).toBe(view.locations.length);

        // Every place lands under a layer the engine knows about.
        expect(view.layers.reduce((n, l) => n + l.count, 0)).toBe(view.locations.length);
    }, 60_000);
});

describe('GET /api/admin/places', () => {
    let http: HttpHarness | null = null;
    afterEach(async () => { await http?.close(); http = null; });

    it('refuses when admin mode is off, and says why', async () => {
        http = await startHttp(makeGame().game);
        const res = await http.get('/api/admin/places');
        expect(res.status).toBe(403);
        expect(String(res.body.error)).toContain('ADMIN_MODE');
    });

    it('answers with an empty world rather than a 404 before a run exists', async () => {
        http = await startHttp(makeGame({ adminMode: true }).game);
        const res = await http.get('/api/admin/places');
        expect(res.status).toBe(200);
        expect(res.body.world).toBeNull();
        expect(res.body.locations).toEqual([]);
        expect(res.body.edges).toEqual([]);
    });

    it('carries the fields the map draws, and no coordinates', async () => {
        http = await startHttp(makeGame({ adminMode: true }).game);
        const res = await http.get('/api/admin/places');
        expect(Object.keys(res.body).sort()).toEqual([
            'counts', 'danglingLinks', 'edges', 'layers', 'locations', 'orphanedParents', 'world'
        ]);
        // The engine holds no position for a place and the payload must not
        // invent one - a renderer handed x/y would be drawing a claim about
        // where things are that nothing in the world supports.
        expect(JSON.stringify(res.body)).not.toMatch(/"(x|y|lat|lon|coord|coordinates)"/);
    });
});
