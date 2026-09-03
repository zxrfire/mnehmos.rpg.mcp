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
            makeLocation({ id: 'v', name: 'the strongroom', kind: 'vault', parentId: 'h' })
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

describe('what a gazetteer entry needs', () => {
    it('reports the origin only when something actually moved', () => {
        const still = makeLocation({ id: 'a', name: 'A', kind: 'settlement', qiDensity: 40 });
        expect(placesView(world([still])).locations[0].origin).toBeNull();

        const moved = makeLocation({ id: 'b', name: 'Blackwater City', kind: 'settlement', qiDensity: 12 });
        // What it was: an ordinary valley, before a sect and a battle and a city.
        moved.origin = { ...moved.origin, name: 'Blackwater Valley', kind: 'wilds', qiDensity: 40, fromDay: -4000 };
        const view = placesView(world([moved])).locations[0];
        expect(view.origin).not.toBeNull();
        expect(view.origin!.name).toBe('Blackwater Valley');
        expect(view.origin!.changed.sort()).toEqual(['kind', 'name', 'qiDensity']);
    });

    it('carries the most recent history, newest first, and says how much it left behind', () => {
        const loc = makeLocation({ id: 'a', name: 'A', kind: 'ruin' });
        for (let i = 1; i <= 12; i++) {
            loc.changes.push({
                id: `c${i}`, onDay: i * 100, kind: 'other', summary: `thing ${i}`,
                causeFactId: null, causeKnown: i % 2 === 0, attributedCauses: [],
                fidelity: 'full', witnessed: true, patch: {}
            });
        }
        const view = placesView(world([loc])).locations[0];
        expect(view.changeCount).toBe(12);
        expect(view.changes).toHaveLength(8);
        expect(view.changes[0].summary).toBe('thing 12');
        expect(view.changes[7].summary).toBe('thing 5');
    });

    it('separates the claim on paper from who runs it on the ground', () => {
        const claimed = makeLocation({
            id: 'a', name: 'A vein', kind: 'vein', controllingFactionId: 'f1',
            environment: { ...makeLocation({ id: 'x', name: 'x', kind: 'vein' }).environment, politicalControl: 'several sects, none of them decisively' }
        });
        const held = makeLocation({
            id: 'b', name: 'B vein', kind: 'vein', controllingFactionId: 'f1',
            environment: { ...makeLocation({ id: 'y', name: 'y', kind: 'vein' }).environment, politicalControl: 'the Azure Cloud Pavilion, thinly' }
        });
        const w = { ...world([claimed, held]), factions: [{ id: 'f1', name: 'Azure Cloud Pavilion' }] } as unknown as WorldState;
        const byId = new Map(placesView(w).locations.map(l => [l.id, l]));
        expect(byId.get('a')!.contested).toBe(true);
        expect(byId.get('b')!.contested).toBe(false);
        expect(byId.get('b')!.controllingFactionName).toBe('Azure Cloud Pavilion');
    });

    it('reads capacity, the key and the style off the record data', () => {
        const vault = makeLocation({
            id: 'v', name: 'The vault', kind: 'vault', sealed: true,
            data: { capacity: 600, keyId: 'key-azure', styleTags: 'walled_court dressed_stone' }
        });
        const view = placesView(world([vault])).locations[0];
        expect(view.capacity).toBe(600);
        expect(view.keyId).toBe('key-azure');
        expect(view.styleTags).toEqual(['walled_court', 'dressed_stone']);
    });

    it('counts who is standing in a place against what it was cut for', () => {
        const yard = makeLocation({ id: 'y', name: 'Yard', kind: 'hall', data: { capacity: 600 } });
        const w = {
            ...world([yard]),
            npcs: [{ locationId: 'y' }, { locationId: 'y' }, { locationId: 'elsewhere' }, { locationId: null }]
        } as unknown as WorldState;
        expect(placesView(w).locations[0].occupancy).toBe(2);
    });
});

describe("a place gives the ground it has, not its province's average", () => {
    /**
     * Found by playing. Two consecutive looks at the same square described the
     * air as "thick enough to notice on the first breath" and then as
     * "unremarkable", and every settlement in the game read the same way
     * afterwards.
     *
     * The cause was one line in `seeding.ts`: a place's
     * `environment.spiritualDensity` was `qiFraction(region.qiDensity)`, so
     * every settlement in a province got its province's average, while the
     * `ambient` band the catalog declares for each one was written onto the
     * record two lines above and read by nothing. `Game.ambientFor` prefers
     * that record over the catalog, so the flat value won everywhere.
     *
     * The stakes are not description. Where to sit is one of the few real
     * decisions a low cultivator has, and Nine Peaks - "the deepest vein
     * anyone has kept, and the Ascetic Order sitting on it" - was
     * arithmetically identical to a thin ford town.
     *
     * This asserts through the played game rather than the catalog, because
     * the catalog was right the whole time and that is exactly why nothing
     * caught it.
     */
    const AIR = /The air here ([^.]*)\./;

    async function airAt(where: string): Promise<string> {
        const { game } = makeGame({ seed: 'ground-truth' });
        await game.newRun('Air Check');
        await game.act(`I travel to ${where}`);
        const said = (await game.act('I look around')).narration ?? '';
        const m = said.match(AIR);
        return m ? m[1] : '(nothing said about the air)';
    }

    it('says thick ground is thick and thin ground is thin', async () => {
        // Declared dense in the catalog, and the deepest vein in the province.
        expect(await airAt('Nine Peaks')).toMatch(/thick enough to notice/i);
        // Declared thin: a ford town and a temple ground with no vein.
        expect(await airAt('Scarwater')).toMatch(/gives very little back/i);
        expect(await airAt('Sweptground')).toMatch(/gives very little back/i);
    }, 120_000);

    it('and does not flatten them into each other', async () => {
        // The real regression. Three places in one province, and the failure
        // mode was every one of them reading identically.
        const said = new Set([
            await airAt('Nine Peaks'),
            await airAt('Scarwater'),
            await airAt('Low Fall')
        ]);
        expect(said.size).toBeGreaterThan(1);
    }, 120_000);
});

describe('the ground figure is on one scale, whatever the world was written on', () => {
    /**
     * `qi-scale.ts` moved `qiDensity` off a 0..1 fraction onto 1..100. A world
     * instantiated before that move stores fractions, and every one of them
     * rounds to the bottom of the new scale - measured on a live database, all
     * thirty-nine places in it reported `ground 0 of 100, thin`, including
     * Nine Peaks. The map's most important figure read as a constant zero.
     *
     * The tell is FRACTIONAL rather than small, because `clampQiDensity`
     * rounds and so a current world can only ever store integers.
     */
    const at = (qiDensity: number) =>
        placesView(world([makeLocation({ id: 'p', name: 'P', kind: 'settlement', qiDensity })]))
            .locations[0];

    it('leaves a value already on the scale alone', () => {
        const view = at(65);
        expect(view.qiDensity).toBe(65);
        expect(view.qiBand).toBe('dense');
        expect(view.groundRescaled).toBe(false);
    });

    it('converts a stored fraction by the constant the engine converts with', () => {
        const view = at(0.3475);
        expect(view.qiDensity).toBe(35);
        expect(view.qiBand).toBe('normal');
        expect(view.groundRescaled).toBe(true);
    });

    it('never reports zero, because the scale has no meaning for it', () => {
        // Old worlds stored a literal 0 for a scar. `QI_DENSITY_MIN` is 1 and
        // the scale says 0 would mean unmeasured.
        expect(at(0).qiDensity).toBe(1);
        expect(at(0).groundRescaled).toBe(true);
    });

    it('says how many it had to convert, once, rather than on every row', () => {
        const w = world([
            makeLocation({ id: 'a', name: 'A', kind: 'settlement', qiDensity: 0.35 }),
            makeLocation({ id: 'b', name: 'B', kind: 'settlement', qiDensity: 0.2 }),
            makeLocation({ id: 'c', name: 'C', kind: 'settlement', qiDensity: 40 })
        ]);
        expect(placesView(w).counts.rescaledGround).toBe(2);
    });
});

describe('what is TRUE of a place travels with it', () => {
    /**
     * The area-status layer - a famine, a war on the ground a house stands on,
     * a beast tide, a district its holder has worked out - is what answers
     * "what is going on here", and this view carried none of it, so the
     * operator's map of the world could not report the only part of it that
     * was currently moving. Measured on a live world: fourteen statuses
     * running and not one of them reachable from the map.
     *
     * The join is the engine's own `statusesInArea`, so the map and the played
     * `investigate` verb cannot disagree about what is happening.
     */
    const province = makeLocation({ id: 'prov', name: 'The Low Fall', kind: 'region' });
    const town = makeLocation({ id: 'town', name: 'Nine Peaks', kind: 'settlement', parentId: 'prov' });

    const famine = {
        id: 'st-famine', areaId: 'prov', kind: 'famine',
        statement: 'The province is eating its seed.',
        cause: { what: 'a harvest that failed', decidedById: null, factId: null },
        signs: ['the mills are idle by noon'], causeKnownLocally: false,
        beganOnDay: 90, reviewOnDay: 400, liftedOnDay: null,
        stops: ['millet'], priceMultiplier: 2.4, dangerDelta: 0.05
    };
    const closed = {
        id: 'st-closed', areaId: 'town', kind: 'closed_to_gathering',
        statement: 'Lu Hall has closed the ground.',
        cause: { what: 'the beds were worked out', decidedById: 'f-lu', factId: null },
        signs: [], causeKnownLocally: true,
        beganOnDay: 120, reviewOnDay: 500, liftedOnDay: null,
        stops: ['gathering'], priceMultiplier: 1.5, dangerDelta: 0
    };
    const over = { ...famine, id: 'st-over', areaId: 'prov', liftedOnDay: 150 };

    function viewed(day = 200) {
        const w = {
            ...world([province, town], day),
            statuses: [famine, closed, over],
            factions: [{ id: 'f-lu', name: 'Lu Hall' }]
        } as unknown as WorldState;
        return new Map(placesView(w).locations.map(l => [l.id, l]));
    }

    it('is true of the area and of everything under it', () => {
        const byId = viewed();
        expect(byId.get('prov')!.statuses.map(s => s.id)).toEqual(['st-famine']);
        expect(byId.get('town')!.statuses.map(s => s.id).sort()).toEqual(['st-closed', 'st-famine']);
    });

    it('separates what is true of this ground from what is true above it', () => {
        const town2 = viewed().get('town')!;
        expect(town2.statuses.find(s => s.id === 'st-closed')!.ownArea).toBe(true);
        const inherited = town2.statuses.find(s => s.id === 'st-famine')!;
        expect(inherited.ownArea).toBe(false);
        expect(inherited.areaName).toBe('The Low Fall');
    });

    it('carries every figure the status does, because that is what it DOES', () => {
        const f = viewed().get('prov')!.statuses[0];
        expect(f.stops).toEqual(['millet']);
        expect(f.priceMultiplier).toBe(2.4);
        expect(f.dangerDelta).toBe(0.05);
        expect(f.daysRunning).toBe(110);
        expect(f.reviewInDays).toBe(200);
        expect(f.cause).toBe('a harvest that failed');
    });

    it('names whoever decided it, and says plainly when nobody did', () => {
        const byId = viewed();
        expect(byId.get('prov')!.statuses[0].decidedById).toBeNull();
        const c = byId.get('town')!.statuses.find(s => s.id === 'st-closed')!;
        expect(c.decidedById).toBe('f-lu');
        expect(c.decidedByName).toBe('Lu Hall');
    });

    it('drops one that has already lifted', () => {
        const ids = viewed().get('prov')!.statuses.map(s => s.id);
        expect(ids).not.toContain('st-over');
    });

    it('counts a province-wide status once rather than once per town', () => {
        const w = {
            ...world([province, town], 200),
            statuses: [famine, closed]
        } as unknown as WorldState;
        expect(placesView(w).counts.runningStatuses).toBe(2);
    });

    it('carries an empty list where nothing is going on, not a missing field', () => {
        expect(placesView(world([province])).locations[0].statuses).toEqual([]);
    });
});
