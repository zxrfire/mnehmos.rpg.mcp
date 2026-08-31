import { describe, it, expect } from 'vitest';
import {
    applyLocationChange,
    attributeCause,
    canOperate,
    canSurvive,
    effectiveThresholds,
    environmentalCompatibility,
    evaluateAccess,
    explainLocationChange,
    forbidZone,
    isOpenOn,
    linkLocations,
    locationHistory,
    locationsFromPriorAges,
    makeAffinity,
    makeLocation,
    makeModifier,
    makeSecretRealm,
    makeThresholds,
    nextClosingDay,
    nextOpeningDay,
    openingsBetween,
    stateAsOfDay,
    transformOnDestruction,
    travelOptions,
    unexplainedChanges
} from '../../../src/engine/world/locations.js';
import { seedPriorAges } from '../../../src/engine/world/history.js';

const DAY = 365;

describe('locations: environmental gating', () => {
    // Foundation Establishment begins at 13; Core Formation at 17.
    const domain = makeLocation({
        id: 'loc-cold',
        name: 'the Cold Kiln undervault',
        kind: 'sealed_domain',
        thresholds: makeThresholds(10, 17, 21, 25),
        hazards: ['cold', 'sealed_qi']
    });

    it('separates barred, lethal, surviving, operational and mastered', () => {
        expect(evaluateAccess(domain, { realmOrdinal: 5 }).level).toBe('barred');
        expect(evaluateAccess(domain, { realmOrdinal: 13 }).level).toBe('lethal');
        expect(evaluateAccess(domain, { realmOrdinal: 18 }).level).toBe('surviving');
        expect(evaluateAccess(domain, { realmOrdinal: 22 }).level).toBe('operational');
        expect(evaluateAccess(domain, { realmOrdinal: 30 }).level).toBe('mastered');
    });

    it('reports the shortfall for every tier not met', () => {
        const a = evaluateAccess(domain, { realmOrdinal: 13 });
        expect(a.shortfall.entry).toBeUndefined();
        expect(a.shortfall.survival).toBe(4);
        expect(a.shortfall.operational).toBe(8);
    });

    it('lets a hazard-matched specialist survive where a stronger generalist cannot', () => {
        const iceManual = makeModifier({
            id: 'mod-ice',
            source: 'technique',
            sourceId: 'tech-borrowed-breath',
            label: 'Borrowed Breath',
            hazards: ['cold'],
            offsets: { entry: 6, survival: 10, operational: 8 }
        });

        const specialist = evaluateAccess(domain, { realmOrdinal: 9, modifiers: [iceManual] });
        const generalist = evaluateAccess(domain, { realmOrdinal: 14 });

        expect(specialist.level).toBe('surviving');
        expect(generalist.level).toBe('lethal');
        // The whole point: the weaker one is the one who lives.
        expect(specialist.effective.survival).toBeLessThan(generalist.effective.survival);
    });

    it('ignores a modifier whose hazard is not present here', () => {
        const fireManual = makeModifier({
            id: 'mod-fire',
            source: 'technique',
            sourceId: 'tech-kiln-stance',
            hazards: ['heat'],
            offsets: { survival: 12 }
        });
        const a = evaluateAccess(domain, { realmOrdinal: 13, modifiers: [fireManual] });
        expect(a.level).toBe('lethal');
        expect(a.applied).toHaveLength(0);
    });

    it('shows its work: every applied modifier is itemised', () => {
        const artifact = makeModifier({
            id: 'mod-bell',
            source: 'artifact',
            sourceId: 'item-salt-bell',
            label: 'Salt Bell',
            offsets: { survival: 3, operational: 2 }
        });
        const { applied } = effectiveThresholds(domain, [artifact]);
        expect(applied.map(a => a.tier).sort()).toEqual(['operational', 'survival']);
        expect(applied.every(a => a.modifierId === 'mod-bell')).toBe(true);
    });

    it('never lets a stack of modifiers push a requirement below zero', () => {
        const absurd = makeModifier({
            id: 'mod-absurd', source: 'artifact', sourceId: 'x',
            offsets: { entry: 99, survival: 99, operational: 99, mastery: 99 }
        });
        const { effective } = effectiveThresholds(domain, [absurd, absurd]);
        for (const v of Object.values(effective)) expect(v).toBe(0);
    });
});

describe('locations: environment interacts with cultivation', () => {
    const corrupted = makeLocation({
        id: 'loc-rot',
        name: 'the Sourbank marsh',
        kind: 'forbidden_zone',
        thresholds: makeThresholds(0, 17, 20, 25),
        hazards: ['corrosive'],
        affinities: [
            makeAffinity('poison', 1.6, 8, 'The rot answers to somebody who works in it.'),
            makeAffinity('soul', 0.5, 4, '')
        ]
    });

    it('boosts a matching specialist and lowers their bars', () => {
        const compat = environmentalCompatibility(corrupted, { specialties: ['poison'] });
        expect(compat.multiplier).toBeCloseTo(1.6, 5);
        expect(compat.thresholdOffset).toBe(8);

        const specialist = evaluateAccess(corrupted, {
            realmOrdinal: 10,
            profile: { specialties: ['poison'] }
        });
        const outsider = evaluateAccess(corrupted, { realmOrdinal: 10, profile: { specialties: ['metal'] } });
        expect(specialist.level).toBe('surviving');
        expect(outsider.level).toBe('lethal');
        expect(specialist.environmentMultiplier).toBeGreaterThan(1);
    });

    it('inverts an affinity into a suppression for somebody vulnerable to it', () => {
        const suppressed = environmentalCompatibility(corrupted, {
            specialties: [],
            vulnerabilities: ['poison']
        });
        expect(suppressed.multiplier).toBeLessThan(1);
        expect(suppressed.thresholdOffset).toBeLessThan(0);
    });

    it('affinity moves survival and operational but never entry or mastery', () => {
        const { effective } = effectiveThresholds(corrupted, [], { specialties: ['poison'] });
        expect(effective.entry).toBe(corrupted.thresholds.entry);
        expect(effective.mastery).toBe(corrupted.thresholds.mastery);
        expect(effective.survival).toBeLessThan(corrupted.thresholds.survival);
    });

    it('canSurvive and canOperate agree with the assessment', () => {
        expect(canSurvive(corrupted, { realmOrdinal: 18 })).toBe(true);
        expect(canOperate(corrupted, { realmOrdinal: 18 })).toBe(false);
        expect(canOperate(corrupted, { realmOrdinal: 21 })).toBe(true);
    });
});

describe('locations: origin, changes, current state', () => {
    /**
     * The Blackwater Valley shape from the charter, built out of real changes.
     */
    function blackwater() {
        let loc = makeLocation({
            id: 'loc-blackwater',
            name: 'Blackwater Valley',
            kind: 'wilds',
            description: 'An ordinary river valley.',
            ambient: 'normal'
        });
        loc.origin.fromDay = -3200 * DAY;

        loc = applyLocationChange(loc, {
            onDay: -3000 * DAY, kind: 'founded',
            summary: 'A sect established itself in the valley.',
            causeKnown: true,
            patch: { kind: 'sect_seat', description: 'A sect holds the valley.' }
        }).location;
        loc = applyLocationChange(loc, {
            onDay: -1800 * DAY, kind: 'destroyed',
            summary: 'The sect was destroyed.',
            causeKnown: false,
            attributedCauses: ['A rival hall did it', 'They opened something they should not have'],
            patch: { kind: 'ruin', addTags: ['ruined'] }
        }).location;
        loc = applyLocationChange(loc, {
            onDay: -500 * DAY, kind: 'river_moved',
            summary: 'A battle moved the river.',
            causeKnown: true,
            patch: { addHazards: ['flooding'] }
        }).location;
        loc = applyLocationChange(loc, {
            onDay: -100 * DAY, kind: 'settled',
            summary: 'A merchant city was built on the ruin.',
            causeKnown: true,
            patch: {
                kind: 'settlement',
                name: 'Blackwater',
                description: 'A half-ruined city beside a corrupted river.',
                addAffinities: [makeAffinity('poison', 1.3, 4, 'The river is not clean.')]
            }
        }).location;
        return loc;
    }

    it('keeps origin, changes and current state separately queryable', () => {
        const loc = blackwater();
        expect(loc.origin.kind).toBe('wilds');
        expect(loc.origin.description).toBe('An ordinary river valley.');
        expect(loc.kind).toBe('settlement');
        expect(loc.name).toBe('Blackwater');

        const rows = locationHistory(loc);
        expect(rows[0].label).toBe('origin');
        expect(rows.map(r => r.label)).toEqual([
            'origin', 'founded', 'destroyed', 'river_moved', 'settled'
        ]);
    });

    it('replays to the state as of a past day', () => {
        const loc = blackwater();
        const then = stateAsOfDay(loc, -2000 * DAY);
        expect(then.kind).toBe('sect_seat');
        expect(then.name).toBe('Blackwater Valley');

        const later = stateAsOfDay(loc, -200 * DAY);
        expect(later.kind).toBe('ruin');
        expect(later.hazards).toContain('flooding');
    });

    it('holds competing explanations without treating any of them as the cause', () => {
        let loc = blackwater();
        const mystery = unexplainedChanges(loc);
        expect(mystery).toHaveLength(1);
        expect(mystery[0].kind).toBe('destroyed');
        expect(mystery[0].attributedCauses).toHaveLength(2);
        expect(mystery[0].causeFactId).toBeNull();

        loc = attributeCause(loc, mystery[0].id, 'A third village says it was the river');
        expect(unexplainedChanges(loc)[0].attributedCauses).toHaveLength(3);

        // Centuries later, somebody finds out.
        loc = explainLocationChange(loc, mystery[0].id, 'f412', 'partial');
        expect(unexplainedChanges(loc)).toHaveLength(0);
        expect(loc.changes.find(c => c.id === mystery[0].id)!.causeFactId).toBe('f412');
    });

    it('does not mutate the input location', () => {
        const before = makeLocation({ id: 'loc-x', name: 'X', kind: 'wilds' });
        const snapshot = JSON.stringify(before);
        applyLocationChange(before, { onDay: 10, kind: 'destroyed', summary: 'gone', patch: { kind: 'ruin' } });
        expect(JSON.stringify(before)).toBe(snapshot);
    });
});

describe('locations: catastrophes scar the map rather than growing it', () => {
    it('a forbidden zone is made by an event, not authored as one', () => {
        const forest = makeLocation({
            id: 'loc-forest', name: 'the Nearfurrow wood', kind: 'wilds',
            thresholds: makeThresholds(0, 0, 0, 5)
        });
        expect(evaluateAccess(forest, { realmOrdinal: 1 }).level).not.toBe('lethal');

        const { location: after, change } = forbidZone(forest, {
            onDay: 900 * DAY,
            summary: 'Something very large died here and did not stop.',
            survivalOrdinal: 17,
            operationalOrdinal: 21,
            hazards: ['corrosive', 'beasts'],
            affinities: [makeAffinity('poison', 1.5, 6, '')],
            causeKnown: false,
            attributedCauses: ['A cultivator died here']
        });

        expect(after.id).toBe(forest.id);          // same place, not a new one
        expect(after.kind).toBe('forbidden_zone');
        expect(after.tags).toContain('forbidden');
        expect(evaluateAccess(after, { realmOrdinal: 1 }).level).toBe('lethal');
        expect(change.causeKnown).toBe(false);
        // And it is still legible as having once been an ordinary wood.
        expect(stateAsOfDay(after, 800 * DAY).kind).toBe('wilds');
    });

    it('destruction is a transition, not a deletion', () => {
        const city = makeLocation({ id: 'loc-city', name: 'Saltbell', kind: 'settlement' });
        const { location } = transformOnDestruction(city, {
            onDay: 1000 * DAY,
            becomes: 'ruin',
            summary: 'The city was buried when the ridge came down.',
            witnessed: true,
            patch: { addHazards: ['collapse'], addTags: ['excavation'] }
        });
        expect(location.kind).toBe('ruin');
        expect(location.tags).toContain('excavation');
        expect(location.changes.at(-1)!.witnessed).toBe(true);
    });
});

describe('locations: cycles, seals and travel on one planet', () => {
    const realm = makeSecretRealm({
        id: 'loc-seam',
        name: 'the seam under Stillshelf',
        thresholds: makeThresholds(13, 17, 20, 25),
        cycle: { periodDays: 3650, openDays: 30, phaseDay: 1000 }
    });

    it('answers open/closed in closed form, centuries out', () => {
        expect(isOpenOn(realm, 999)).toBe(false);
        expect(isOpenOn(realm, 1000)).toBe(true);
        expect(isOpenOn(realm, 1029)).toBe(true);
        expect(isOpenOn(realm, 1030)).toBe(false);
        // Thirty cycles later, same arithmetic, same cost.
        expect(isOpenOn(realm, 1000 + 3650 * 30)).toBe(true);
    });

    it('finds the next opening and closing', () => {
        expect(nextOpeningDay(realm, 0)).toBe(1000);
        expect(nextOpeningDay(realm, 1010)).toBe(1010);
        expect(nextOpeningDay(realm, 1031)).toBe(4650);
        expect(nextClosingDay(realm, 1010)).toBe(1030);
    });

    it('caps the openings it enumerates over a long span', () => {
        const windows = openingsBetween(realm, 0, 1000 + 3650 * 500, 6);
        expect(windows).toHaveLength(6);
        expect(windows[0].opensOnDay).toBe(1000);
        expect(windows[1].opensOnDay).toBe(4650);
    });

    it('gates access on the day as well as on power', () => {
        const shut = evaluateAccess(realm, { realmOrdinal: 30, onDay: 500 });
        expect(shut.closed).toBe(true);
        const open = evaluateAccess(realm, { realmOrdinal: 30, onDay: 1010 });
        expect(open.closed).toBe(false);
        expect(open.level).toBe('mastered');
    });

    it('treats a portal as an ordinary link to somewhere on this planet', () => {
        const a = makeLocation({ id: 'loc-a', name: 'A', kind: 'region' });
        const b = makeLocation({ id: 'loc-b', name: 'B', kind: 'region' });
        linkLocations(a, b, 'portal', 1, 'key-jade-token');

        expect(a.links[0].toLocationId).toBe('loc-b');
        expect(b.links[0].toLocationId).toBe('loc-a');   // symmetric
        expect(travelOptions(a, [])[0].usable).toBe(false);
        expect(travelOptions(a, ['key-jade-token'])[0].usable).toBe(true);
    });
});

describe('locations: built from the seeded past', () => {
    it('every ruin and scar carries the fact that produced it, and its own history', () => {
        const prior = seedPriorAges('seed-loc', { presentYear: 0 });
        const locations = locationsFromPriorAges(prior);
        expect(locations.length).toBe(prior.ruins.length + prior.scars.length);

        const factIds = new Set(prior.ledger.facts.map(f => f.id));
        for (const loc of locations) {
            expect(factIds.has(loc.originFactId!)).toBe(true);
            // Origin plus at least one change: the place was something else first.
            expect(locationHistory(loc).length).toBeGreaterThanOrEqual(2);
            expect(loc.origin.kind).not.toBe(loc.kind);
        }

        const ruin = locations.find(l => l.kind === 'ruin');
        expect(ruin).toBeDefined();
        expect(ruin!.thresholds.survival).toBeGreaterThan(ruin!.thresholds.entry);
        expect(ruin!.hazards).toContain('formation');

        const scar = locations.find(l => l.kind === 'scar');
        expect(scar).toBeDefined();
        expect(scar!.ambient).toBe('thin');
        expect(scar!.qiDensity).toBe(0);
    });
});
