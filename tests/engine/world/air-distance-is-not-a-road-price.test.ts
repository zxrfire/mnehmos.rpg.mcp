/**
 * The world had authored road durations but no physical metric anchors. An air
 * journey could only price a road detour, while ordinal 29 conferred folding
 * but no independent body-flight grant. Oct 7 ruling: authored physical li,
 * eighty li per walking-day, existing conveyance speeds/fuel, body flight at
 * Void Tribulation, and one explicitly authored 25-qi launch. Sword/cloud art
 * charges remain native per-use terms; this slice does not execute or debit an
 * art, launch a journey, alter road durations, or prove live-model acceptance.
 *
 * Coordinator native foundation02 measured 66 passes and one seeded-edge failure:
 * four native edge constraints failed. This successor adds an opt-in ignored
 * file observation before the unchanged assertions; JSON reporters suppressed
 * console evidence. Diagnostic03 identified the two directed halves of the
 * Buddha Precipice–Burial Sands corridor: 171.026 li against 160 li each.
 * Foundation04 authors the Sands centre at (60,-90), preserving its southeast
 * bearing and translating all local points together. Native roads, durations
 * and the full seeded-edge assertions are unchanged; their rerun is pending.
 *
 * These controls change roads while keeping geometry, move an exterior anchor
 * and read its rooms/midpoint, and preserve unknown/layer refusal. A real seeded
 * world additionally audits every native lower-layer walking edge independently.
 * No edge cost is used to choose or repair an anchor. Tests are unrun pending
 * the coordinator's sequential compiler/native grant.
 */
import { describe, expect, it } from 'vitest';
import { appendFileSync } from 'node:fs';
import { makeLocation, walkingDaysFrom, walkingStepDays } from '../../../src/engine/world/locations.js';
import { metricGroundRead, distanceThroughTheAir, initializeMetricGround, LI_PER_WALKING_DAY }
    from '../../../src/engine/world/the-metric-ground-under-a-journey.js';
import { quoteAnAirJourney, canFlyByTheirOwnBody } from '../../../src/engine/world/what-an-air-journey-takes.js';
import { CONVEYANCES, INNATE_FLIGHT_LAUNCH_QI } from '../../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import { priceJourney, walkingDaysPerDay, whatTheChestBurns }
    from '../../../src/engine/world/what-a-conveyance-does-to-a-journey.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { getTechnique } from '../../../src/data/cultivation/techniques.js';
import { DEFAULT_LAYER } from '../../../src/engine/world/layers.js';

function craft(id: string) {
    const result = CONVEYANCES.find(row => row.id === id);
    if (!result) throw new Error('Actual conveyance is missing: ' + id);
    return result;
}

function ground() {
    const a = makeLocation({ id: 'a', name: 'A', kind: 'settlement',
        data: { metricXLi: 0, metricYLi: 0, metricExtentLi: 30 } });
    const b = makeLocation({ id: 'b', name: 'B', kind: 'settlement',
        data: { metricXLi: 48, metricYLi: 64, metricExtentLi: 3 } });
    a.links.push({ toLocationId: b.id, kind: 'road', travelDays: 12, open: true, requiresKeyId: null, note: '' });
    return [a, b];
}

describe('physical air distance and native conveyance pricing', () => {
    it('ignores a road detour or removed road while preserving ordinary road pricing', () => {
        const places = ground(), sword = craft('conv-sword-flight');
        expect(walkingDaysFrom(places, 'a').get('b')).toBe(12);
        const before = quoteAnAirJourney(places, 'a', 'b', sword);
        expect(before?.distanceLi).toBe(80);
        expect(before?.daysOneWay).toBe(1 / walkingDaysPerDay(sword));
        expect(priceJourney({ walkingDays: 12, conveyance: sword, heads: 1 }).daysOneWay).toBe(4);
        places[0]!.links.length = 0;
        expect(walkingDaysFrom(places, 'a').has('b')).toBe(false);
        expect(quoteAnAirJourney(places, 'a', 'b', sword)).toEqual(before);
    });

    it('uses that same geometry, speed and actual chest authority for a spirit boat', () => {
        const boat = craft('conv-spirit-boat');
        const quote = quoteAnAirJourney(ground(), 'a', 'b', boat, 25, 2);
        if (!quote) throw new Error('Actual aerial boat quote is unavailable');
        expect(quote.daysOneWay).toBe(1 / walkingDaysPerDay(boat, 25));
        expect(quote.stonesBurned).toBe(whatTheChestBurns({ conveyance: boat,
            daysOneWay: quote.daysOneWay, heads: 2, trips: quote.trips }));
        expect(quoteAnAirJourney(ground(), 'a', 'b', craft('conv-on-foot'))).toBeNull();
    });

    it('derives private rooms and the actual single midpoint from exterior anchors', () => {
        const places = ground();
        const room = makeLocation({ id: 'room', name: 'Room', kind: 'hall', parentId: 'a' });
        const stop = makeLocation({ id: 'stop', name: 'Between', kind: 'wilds', tags: ['route-stop'],
            data: { fromLocationId: 'a', toLocationId: 'b' } });
        places.push(room, stop);
        expect(metricGroundRead(places).point(room.id)).toEqual({ xLi: 0, yLi: 0 });
        expect(metricGroundRead(places).point(stop.id)).toEqual({ xLi: 24, yLi: 32 });
        places[0]!.data.metricXLi = 10;
        expect(metricGroundRead(places).point(room.id)).toEqual({ xLi: 10, yLi: 0 });
        expect(metricGroundRead(places).point(stop.id)).toEqual({ xLi: 29, yLi: 32 });
        expect(room.data.metricXLi).toBeUndefined();
        expect(stop.data.metricXLi).toBeUndefined();
    });

    it('assigns independent new ground once without moving it after parent or road changes', () => {
        const places = ground();
        const added = makeLocation({ id: 'generated', name: 'New ground', kind: 'wilds', parentId: 'a' });
        places.push(added);
        expect(initializeMetricGround(places, 'actual-world-seed')).toBe(1);
        const anchor = metricGroundRead(places).point(added.id);
        expect(anchor).not.toBeNull();
        expect(distanceThroughTheAir(places, 'a', added.id)).toBeLessThanOrEqual(30);
        places[0]!.data.metricXLi = 100;
        expect(initializeMetricGround(places, 'another-read')).toBe(0);
        expect(metricGroundRead(places).point(added.id)).toEqual(anchor);
    });

    it('locates a real gate town beside its actual house seat rather than another provincial sample', () => {
        const province = makeLocation({ id: 'province', name: 'Province', kind: 'region',
            data: { metricXLi: 0, metricYLi: 0, metricExtentLi: 30, catalogRegionId: 'catalog-province' } });
        const seat = makeLocation({ id: 'seat', name: 'Authored seat', kind: 'settlement', parentId: province.id,
            data: { metricXLi: 20, metricYLi: 0, metricExtentLi: 3, catalogRegionId: 'catalog-province' } });
        const house = makeLocation({ id: 'house', name: 'House grounds', kind: 'sect_seat', parentId: province.id,
            tags: ['sect_ground'], data: { factionId: 'actual-house', catalogRegionId: 'catalog-province' } });
        const town = makeLocation({ id: 'town', name: 'Gate town', kind: 'settlement', parentId: province.id,
            data: { gateId: house.id, gateOf: 'actual-house', catalogRegionId: 'catalog-province' } });
        const places = [town, house, province, seat];
        expect(initializeMetricGround(places, 'actual-gate-world', [], [{ id: 'actual-house', seatPlaceName: seat.name }])).toBe(2);
        expect(distanceThroughTheAir(places, seat.id, house.id)).toBeLessThanOrEqual(3);
        expect(distanceThroughTheAir(places, house.id, town.id)).toBeLessThanOrEqual(3);
        expect(distanceThroughTheAir(places, seat.id, town.id)).toBeLessThanOrEqual(6);
        expect(house.parentId).toBe(province.id);
        expect(town.parentId).toBe(province.id);
    });

    it('refuses unknown metric ground and cannot turn an ordinary air leg into a Lid crossing', () => {
        const places = ground();
        const unknown = makeLocation({ id: 'unknown', name: 'Unknown', kind: 'wilds' });
        places.push(unknown);
        expect(quoteAnAirJourney(places, 'a', unknown.id, craft('conv-body-flight'))).toBeNull();
        places[1]!.layer = 'immortal';
        expect(quoteAnAirJourney(places, 'a', 'b', craft('conv-body-flight'))).toBeNull();
    });

    it('confers bodily flight at 29 while leaving lower sword-school art and native costs distinct', () => {
        expect(canFlyByTheirOwnBody(28)).toBe(false);
        expect(canFlyByTheirOwnBody(29)).toBe(true);
        expect(canFlyByTheirOwnBody(33)).toBe(true);
        expect(INNATE_FLIGHT_LAUNCH_QI).toBe(25);
        expect(getTechnique('gale-riding-sword-flight')?.qiCost).toBe(25);
        expect(getTechnique('thousand-li-cloud-tread')?.qiCost).toBe(66);
        const body = craft('conv-body-flight');
        expect(quoteAnAirJourney(ground(), 'a', 'b', body)?.daysOneWay).toBe(1 / walkingDaysPerDay(body));
        expect(quoteAnAirJourney(ground(), 'a', 'b', body)?.stonesBurned).toBe(0);
    });

    it('audits actual seeded walking edges and does not rewrite any duration to fit a point', async () => {
        const catalog = await loadCultivationCatalog();
        const { state } = seedWorld({ seed: 'authored-metric-ground-20261007', catalog, population: 12 });
        const read = metricGroundRead(state.locations);
        for (const region of catalog.regions) for (const from of region.places) {
            for (const edge of from.connections ?? []) {
                const a = state.locations.find(place => place.data.catalogRegionId === region.id && place.name === from.name);
                const b = state.locations.find(place => place.data.catalogRegionId === region.id && place.name === edge.otherPlaceName);
                if (!a || !b) throw new Error('Authored endpoint missing from actual seed');
                const distance = distanceThroughTheAir(state.locations, a.id, b.id);
                if (distance === null) throw new Error('Authored endpoint has no physical metric');
                expect(distance).toBeLessThanOrEqual(edge.travelDays * LI_PER_WALKING_DAY);
            }
        }
        const original = state.locations.map(place => [place.id, place.links.map(link => ({ ...link }))]);
        let checked = 0;
        const failures: string[] = [];
        for (const place of state.locations) {
            if (place.layer !== DEFAULT_LAYER) continue;
            const neighbours = new Set(place.links.filter(link => link.open && ['road', 'path', 'tunnel', 'gate'].includes(link.kind))
                .map(link => link.toLocationId));
            if (place.parentId) neighbours.add(place.parentId);
            for (const child of state.locations) if (child.parentId === place.id) neighbours.add(child.id);
            for (const id of neighbours) {
                const to = read.byId.get(id);
                if (!to || to.layer !== place.layer) continue;
                const days = walkingStepDays(state.locations, place.id, id);
                if (days === null) continue;
                const a = read.point(place.id), b = read.point(id);
                if (!a || !b) { failures.push('Missing physical anchor: ' + place.name + ' -> ' + to.name); continue; }
                const distance = Math.hypot(b.xLi - a.xLi, b.yLi - a.yLi);
                if (distance > days * LI_PER_WALKING_DAY) failures.push(place.name + ' -> ' + to.name + ': ' + distance + ' li exceeds ' + days + ' days');
                checked++;
            }
        }
        const observationPath = process.env.RPG_FLIGHT_GROUND_DIAGNOSTIC_PATH;
        if (observationPath) {
            const rows = state.locations.flatMap(place => {
                if (place.layer !== DEFAULT_LAYER) return [];
                const neighbours = new Set(place.links.filter(link => link.open && ['road', 'path', 'tunnel', 'gate'].includes(link.kind))
                    .map(link => link.toLocationId));
                if (place.parentId) neighbours.add(place.parentId);
                for (const child of state.locations) if (child.parentId === place.id) neighbours.add(child.id);
                return [...neighbours].flatMap(id => {
                    const to = read.byId.get(id);
                    const days = to && to.layer === place.layer ? walkingStepDays(state.locations, place.id, id) : null;
                    if (!to || days === null) return [];
                    const a = read.point(place.id), b = read.point(id);
                    const distanceLi = a && b ? Math.hypot(b.xLi - a.xLi, b.yLi - a.yLi) : null;
                    if (distanceLi !== null && distanceLi <= days * LI_PER_WALKING_DAY) return [];
                    const record = (p: typeof place) => ({ id: p.id, name: p.name, kind: p.kind, layer: p.layer,
                        parentId: p.parentId, parent: p.parentId ? read.byId.get(p.parentId)?.name : null,
                        metric: read.point(p.id), data: p.data, tags: p.tags,
                        links: p.links.filter(link => link.toLocationId === (p.id === place.id ? to.id : place.id)) });
                    return [{ from: record(place), to: record(to), days, distanceLi,
                        allowanceLi: days * LI_PER_WALKING_DAY }];
                });
            });
            appendFileSync(observationPath, JSON.stringify({ seed: state.seed, checked, failures, edges: rows }) + '\n');
        }
        expect(checked).toBeGreaterThan(0);
        expect(failures).toEqual([]);
        expect(initializeMetricGround(state.locations, state.seed, catalog.regions)).toBe(0);
        expect(state.locations.map(place => [place.id, place.links.map(link => ({ ...link }))])).toEqual(original);
    });
});
