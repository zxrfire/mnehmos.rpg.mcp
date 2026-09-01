import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    ELEMENTAL_IDIOM_FLOOR,
    ELEMENTAL_TRIM_FLOOR,
    attributionField,
    compoundCapacityUnit,
    describeRoom,
    elementalIntensityOf,
    growCompound,
    houseStyleOf,
    pathTo,
    precinctsOf,
    purposeOf,
    reachThrough,
    roomStageFor,
    roomsFor,
    roomsVisibleTo,
    styleTagsOf,
    survivingTags,
    type CompoundInput
} from '../../../src/engine/world/architecture.js';
import { makeLocation, type LocationRecord } from '../../../src/engine/world/locations.js';

// ─────────────────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────────────────

function seat(id = 'seat-a'): LocationRecord {
    const s = makeLocation({
        id,
        name: 'A House grounds',
        kind: 'sect_seat',
        parentId: 'region-a',
        qiDensity: 40
    });
    s.origin.fromDay = 1_000;
    return s;
}

/** A broad, ordinary, inherited house. The 21-of-32 case. */
function broadHouse(over: Partial<CompoundInput> = {}): CompoundInput {
    return {
        factionId: 'house-broad',
        factionName: 'Broad House',
        ranks: ['Outer Disciple', 'Inner Disciple', 'Core Disciple', 'Elder', 'Patriarch'],
        admissionOrdinal: 3,
        powerOrdinal: 27,
        recruits: true,
        alignment: 'neutral',
        governance: 'unbacked',
        production: 0.5,
        formationIntegrity: 0.5,
        formationNodesTotal: 20,
        formationNodesLit: 10,
        inherited: true,
        holdsVein: false,
        tributeStonesPerYear: 0,
        sealedCeilingOrdinal: 0,
        preferredRoots: [],
        teachesElements: ['metal', 'wood', null, 'water', null],
        specialities: ['attack'],
        ...over
    };
}

/** A single-root absolutist. The two-of-32 case. */
function narrowHouse(over: Partial<CompoundInput> = {}): CompoundInput {
    return broadHouse({
        factionId: 'house-narrow',
        factionName: 'Narrow Court',
        preferredRoots: ['mutated_ice'],
        teachesElements: ['ice', 'ice', 'ice'],
        ...over
    });
}

// ─────────────────────────────────────────────────────────────────────────
// ELEMENTAL INTENSITY - INTAKE IS A CEILING ON THE CURRICULUM
// ─────────────────────────────────────────────────────────────────────────

describe('elementalIntensityOf', () => {
    it('scores a house that takes every root at zero however narrow its library', () => {
        const { intensity, element } = elementalIntensityOf([], ['fire', 'fire', 'fire', 'fire']);
        expect(intensity).toBe(0);
        expect(element).toBeNull();
    });

    it('scores a single-root house at the top of the range', () => {
        const { intensity, element } = elementalIntensityOf(['mutated_ice'], ['ice', 'ice']);
        expect(intensity).toBe(1);
        expect(element).toBe('ice');
    });

    it('counts the elements a house will admit, not the weighted dominant one', () => {
        // Metal-dominant intake, wholly metal library - and it still takes wood
        // through the dual root, so the buildings are not metal. This is the
        // case that put seven houses in the absolutist band before the formula
        // was changed to count admitted elements.
        const { intensity } = elementalIntensityOf(
            ['single_metal', 'dual_metal_wood'],
            ['metal', 'metal', 'metal']
        );
        expect(intensity).toBeCloseTo(0.5, 5);
        expect(intensity).toBeLessThan(ELEMENTAL_IDIOM_FLOOR);
        expect(intensity).toBeGreaterThan(ELEMENTAL_TRIM_FLOOR);
    });

    it('reads a muddled root as admitting every element', () => {
        const { intensity } = elementalIntensityOf(
            ['single_earth', 'muddled_five_element'],
            ['earth', 'earth']
        );
        expect(intensity).toBeLessThan(ELEMENTAL_TRIM_FLOOR);
    });

    it('lets an elementless curriculum pull a narrow house down', () => {
        const wholly = elementalIntensityOf(['mutated_ice'], ['ice', 'ice']).intensity;
        const doctrine = elementalIntensityOf(['mutated_ice'], [null, null, null, 'ice']).intensity;
        expect(doctrine).toBeLessThan(wholly);
        expect(doctrine).toBeGreaterThan(0);
    });
});

describe('houseStyleOf', () => {
    it('gives a broad house ordinary materials and no element facet', () => {
        const style = houseStyleOf({ ...broadHouse(), inherited: true });
        expect(style.element).toBeNull();
        expect(style.tags.some(t => t.startsWith('element:'))).toBe(false);
        // Nothing to deviate from means rank has to be signalled by element.
        expect(style.deviation).toBe('element');
    });

    it('builds a single-root house out of its own element and signals rank by scale', () => {
        const style = houseStyleOf(narrowHouse());
        expect(style.element).toBe('ice');
        expect(style.tags).toContain('element:ice');
        expect(style.deviation).toBe('scale');
    });

    it('is a pure function of the catalog row - no seed anywhere', () => {
        expect(houseStyleOf(broadHouse())).toEqual(houseStyleOf(broadHouse()));
    });
});

// ─────────────────────────────────────────────────────────────────────────
// PRECINCTS COME FROM THE HOUSE'S OWN LADDER
// ─────────────────────────────────────────────────────────────────────────

describe('precinctsOf', () => {
    it('produces one precinct per rank, whatever the rank count is', () => {
        expect(precinctsOf({ ranks: ['A', 'B', 'C', 'D'], admissionOrdinal: 2, powerOrdinal: 20 }))
            .toHaveLength(4);
        expect(precinctsOf({ ranks: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], admissionOrdinal: 2, powerOrdinal: 20 }))
            .toHaveLength(7);
    });

    it('interpolates the bars from the admission bar to the house\'s own reach', () => {
        const p = precinctsOf({ ranks: ['A', 'B', 'C'], admissionOrdinal: 4, powerOrdinal: 28 });
        expect(p[0].entryOrdinal).toBe(4);
        expect(p[2].entryOrdinal).toBe(28);
        expect(p[1].entryOrdinal).toBeGreaterThan(p[0].entryOrdinal);
        expect(p[1].entryOrdinal).toBeLessThan(p[2].entryOrdinal);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE COMPOUND
// ─────────────────────────────────────────────────────────────────────────

describe('growCompound', () => {
    const opts = { seed: 'w', presentDay: 10_000 };

    it('nests past depth 1', () => {
        const s = seat();
        const { locations } = growCompound(s, broadHouse(), opts);
        const all = [s, ...locations];
        const deepest = Math.max(...all.map(l => pathTo(all, l.id).length - 1));
        expect(deepest).toBeGreaterThan(1);
    });

    it('is deterministic from the seed', () => {
        const a = growCompound(seat(), broadHouse(), opts);
        const b = growCompound(seat(), broadHouse(), opts);
        expect(a.locations.map(l => `${l.id}:${l.qiDensity}:${l.thresholds.entry}`))
            .toEqual(b.locations.map(l => `${l.id}:${l.qiDensity}:${l.thresholds.entry}`));
    });

    it('puts what a house holds asleep under the hall it venerates, at its own bar', () => {
        const input = broadHouse({ sealedCeilingOrdinal: 36 });
        const s = seat();
        const { locations } = growCompound(s, input, opts);
        const under = locations.find(l => purposeOf(l) === 'under_hall');
        expect(under).toBeDefined();
        expect(under!.sealed).toBe(true);
        expect(under!.thresholds.entry).toBe(36);
        expect(under!.data.sealedCeilingOrdinal).toBe(36);

        // And it is UNDER the hall, not beside it.
        const parent = locations.find(l => l.id === under!.parentId);
        expect(purposeOf(parent!)).toBe('ancestral_hall');
        const all = [s, ...locations];
        expect(pathTo(all, under!.id).length - 1).toBeGreaterThan(2);
    });

    it('gives a house with nothing asleep nowhere to keep it', () => {
        const { locations } = growCompound(seat(), broadHouse({ sealedCeilingOrdinal: 0 }), opts);
        expect(locations.find(l => purposeOf(l) === 'under_hall')).toBeUndefined();
    });

    it('is the only interior kind that concentrates qi', () => {
        const s = seat();
        const { locations } = growCompound(s, broadHouse({ holdsVein: true }), opts);
        const lifted = locations.filter(l => l.qiDensity > s.qiDensity);
        expect(lifted.length).toBeGreaterThan(0);
        // Nothing OPEN is above the ground it stands on but a chamber. A
        // sealed vault may hold more and offers nobody any of it.
        expect(lifted.every(l => l.kind === 'chamber' || l.kind === 'vault')).toBe(true);
        expect(lifted.some(l => l.kind === 'chamber')).toBe(true);
        expect(locations.filter(l => l.kind === 'hall' || l.kind === 'precinct')
            .every(l => l.qiDensity <= s.qiDensity)).toBe(true);
        const vein = locations.find(l => purposeOf(l) === 'vein_chamber');
        expect(vein!.qiDensity).toBeGreaterThan(s.qiDensity);
    });

    it('writes a readable style fingerprint onto everything it builds', () => {
        const { locations, style } = growCompound(seat(), narrowHouse(), opts);
        expect(locations.every(l => styleTagsOf(l).length > 0)).toBe(true);
        expect(styleTagsOf(locations[0])).toEqual(style.tags);
    });
});

describe('roomsFor - the shape is read off columns, never off a faction id', () => {
    it('gives a house with no intake nowhere to put applicants', () => {
        expect(roomsFor(broadHouse({ recruits: true }))).toContain('dormitory');
        expect(roomsFor(broadHouse({ recruits: false }))).not.toContain('dormitory');
    });

    it('puts the books behind a locked door when the house can no longer read them', () => {
        expect(roomsFor(broadHouse({ formationIntegrity: 0.8 }))).toContain('scripture_pavilion');
        const dark = roomsFor(broadHouse({ formationIntegrity: 0.1 }));
        expect(dark).toContain('archive');
        expect(dark).not.toContain('scripture_pavilion');
    });

    it('gives a house that answers to somebody a room to be answered in', () => {
        expect(roomsFor(broadHouse({ governance: 'deference' }))).toContain('audience_hall');
        expect(roomsFor(broadHouse({ governance: 'unbacked' }))).not.toContain('audience_hall');
    });

    it('gives a house on a vein a room over it', () => {
        expect(roomsFor(broadHouse({ holdsVein: true }))).toContain('vein_chamber');
        expect(roomsFor(broadHouse({ holdsVein: false }))).not.toContain('vein_chamber');
    });

    it('produces different compounds for different columns', () => {
        const a = roomsFor(broadHouse()).sort().join();
        const b = roomsFor(broadHouse({
            recruits: false, governance: 'deference', holdsVein: true,
            tributeStonesPerYear: 400, specialities: ['support'], production: 0.9
        })).sort().join();
        expect(a).not.toBe(b);
    });
});

describe('compoundCapacityUnit', () => {
    it('sizes an inherited compound off whoever cut it, not whoever is in it', () => {
        const inherited = compoundCapacityUnit(broadHouse({ inherited: true, powerOrdinal: 34 }));
        const built = compoundCapacityUnit(broadHouse({ inherited: false, powerOrdinal: 34 }));
        expect(inherited).toBeGreaterThan(built);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE ACCESS CHAIN
// ─────────────────────────────────────────────────────────────────────────

describe('reachThrough', () => {
    const opts = { seed: 'w', presentDay: 10_000 };

    function world() {
        const s = seat();
        const { locations, darkNodeIds } = growCompound(s, broadHouse(), opts);
        return { all: [s, ...locations], darkNodeIds, s };
    }

    it('reports the first thing that stops them, not the deepest', () => {
        const { all } = world();
        const deep = all.find(l => purposeOf(l) === 'ancestral_hall')!;
        const path = pathTo(all, deep.id);
        const r = reachThrough(path, { realmOrdinal: 0 });
        expect(r.level).toBe('barred');
        expect(r.stoppedAt).not.toBe(deep.id);
        // The wall, not the room behind it.
        const stopped = all.find(l => l.id === r.stoppedAt)!;
        expect(stopped.kind).toBe('precinct');
        expect(r.reason).toContain('is not the obstacle');
    });

    it('lets somebody who is high enough all the way in', () => {
        const { all } = world();
        const deep = all.find(l => purposeOf(l) === 'ancestral_hall')!;
        const r = reachThrough(pathTo(all, deep.id), { realmOrdinal: 44 });
        expect(r.stoppedAt).toBeNull();
        expect(['operational', 'mastered']).toContain(r.level);
    });

    it('waives the walls somebody went around, and nothing else', () => {
        const { all, darkNodeIds } = world();
        expect(darkNodeIds.length).toBeGreaterThan(0);
        const node = all.find(l => l.id === darkNodeIds[0])!;
        const into = all.find(l => l.id === String(node.data.opensOnto))!;
        const inside = all.find(l => l.parentId === into.id && l.kind !== 'vault')!;

        const front = reachThrough(pathTo(all, inside.id), { realmOrdinal: 8 });
        const back = reachThrough([node, into, inside], { realmOrdinal: 8 }, { enteredAt: into.id });

        // The hole gets them in. It does not give them standing: they can be
        // there and they still cannot work there.
        expect(back.stoppedAt).toBeNull();
        expect(back.level).toBe('surviving');
        expect(front.level === 'barred' || front.level === 'surviving').toBe(true);
        if (front.level === 'barred') expect(back.level).not.toBe('barred');
    });

    it('refuses an empty path rather than inventing a verdict', () => {
        expect(() => reachThrough([], { realmOrdinal: 5 })).toThrow(/empty path/);
    });
});

describe('pathTo', () => {
    it('returns the chain outermost first and survives a broken parent', () => {
        const a = makeLocation({ id: 'a', name: 'a', kind: 'region' });
        const b = makeLocation({ id: 'b', name: 'b', kind: 'precinct', parentId: 'a' });
        const c = makeLocation({ id: 'c', name: 'c', kind: 'hall', parentId: 'b' });
        expect(pathTo([a, b, c], 'c').map(l => l.id)).toEqual(['a', 'b', 'c']);
        const orphan = makeLocation({ id: 'd', name: 'd', kind: 'hall', parentId: 'missing' });
        expect(pathTo([orphan], 'd').map(l => l.id)).toEqual(['d']);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// KNOWLEDGE FOLLOWS ENGAGEMENT, NOT ALTITUDE
// ─────────────────────────────────────────────────────────────────────────

describe('roomStageFor', () => {
    const opts = { seed: 'w', presentDay: 10_000 };
    const input = broadHouse({ formationIntegrity: 0.1 }); // has the locked archive
    const { locations } = growCompound(seat(), input, opts);
    const archive = locations.find(l => purposeOf(l) === 'archive')!;
    const yard = locations.find(l => purposeOf(l) === 'practice_yard')!;
    const ranks = input.ranks.length;

    it('gives a twenty-year junior the back of the house and a two-year elder only the front', () => {
        const junior = roomStageFor(archive, {
            rankIndex: 0, rankCount: ranks, yearsInHouse: 20, member: true
        });
        const elder = roomStageFor(archive, {
            rankIndex: ranks - 1, rankCount: ranks, yearsInHouse: 2, member: true
        });
        expect(junior).toBe('known');
        expect(elder).not.toBe('known');
    });

    it('gives an outsider of any rank nothing that is not on the outer face', () => {
        const visitor = { rankIndex: ranks - 1, rankCount: ranks, yearsInHouse: 0, member: false };
        expect(roomStageFor(archive, visitor)).toBe('unaware');
        // The yard is on the outer face and everybody can see it.
        expect(roomStageFor(yard, visitor)).not.toBe('unaware');
    });

    it('does not store knowledge on the room', () => {
        // Same record, two viewers, two answers. If this ever collapses to one
        // answer, somebody has put a flag on the room.
        const a = roomStageFor(archive, { rankIndex: 0, rankCount: ranks, yearsInHouse: 30, member: true });
        const b = roomStageFor(archive, { rankIndex: 0, rankCount: ranks, yearsInHouse: 0, member: true });
        expect(a).not.toBe(b);
    });

    it('roomsVisibleTo only returns what the viewer could set out for', () => {
        const stranger = roomsVisibleTo(locations, {
            rankIndex: -1, rankCount: ranks, yearsInHouse: 0, member: false
        });
        const veteran = roomsVisibleTo(locations, {
            rankIndex: 2, rankCount: ranks, yearsInHouse: 25, member: true
        });
        expect(veteran.length).toBeGreaterThan(stranger.length);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// ARCHAEOLOGY
// ─────────────────────────────────────────────────────────────────────────

describe('survivingTags and attributionField', () => {
    it('loses the hung ornament first and the ground last', () => {
        const style = houseStyleOf(narrowHouse());
        const now = survivingTags(style.tags, 'new');
        const ancient = survivingTags(style.tags, 'ancient');
        expect(now.some(t => t.startsWith('ornament:'))).toBe(false);
        expect(now.length).toBeGreaterThan(ancient.length);
        expect(ancient).toContain('element:ice');
        expect(ancient.some(t => t.startsWith('idiom:'))).toBe(true);
    });

    it('names a single-root builder from an ancient ruin and cannot name an ordinary one', () => {
        const narrow = houseStyleOf(narrowHouse());
        // A field of ordinary houses, all differing in facets that do not last.
        const ordinary = [0.2, 0.5, 0.8].flatMap(production =>
            (['righteous', 'neutral', 'demonic'] as const).map(alignment =>
                houseStyleOf(broadHouse({
                    factionId: `house-${alignment}-${production}`, production, alignment
                }))));
        const all = [narrow, ...ordinary];

        const narrowField = attributionField(survivingTags(narrow.tags, 'ancient'), all);
        const ordinaryField = attributionField(survivingTags(ordinary[0].tags, 'ancient'), all);

        expect(narrowField.field).toBe(1);
        expect(ordinaryField.field).toBeGreaterThan(1);
    });

    it('returns nothing when there is nothing left to read', () => {
        expect(attributionField([], [houseStyleOf(broadHouse())]))
            .toEqual({ best: 0, field: 0 });
    });
});

// ─────────────────────────────────────────────────────────────────────────
// DESCRIPTION IS DERIVED AND STAYS SHORT
// ─────────────────────────────────────────────────────────────────────────

describe('describeRoom', () => {
    const opts = { seed: 'w', presentDay: 10_000 };

    it('is at most four lines on entry and deterministic', () => {
        const { locations, style } = growCompound(seat(), broadHouse(), opts);
        for (const room of locations) {
            const d = describeRoom(room, style, { seed: 'w' });
            expect(d.onEntry.length).toBeLessThanOrEqual(4);
            expect(describeRoom(room, style, { seed: 'w' })).toEqual(d);
        }
    });

    it('says the house is elementless where it is, and says why', () => {
        const broad = growCompound(seat(), broadHouse(), opts);
        const room = broad.locations.find(l => purposeOf(l) === 'practice_yard')!;
        const text = describeRoom(room, broad.style, { seed: 'w' }).onInspect.join(' ');
        expect(text).toMatch(/every\s+root/i);
    });

    it('stores no adjective it renders', () => {
        const { locations } = growCompound(seat(), broadHouse(), opts);
        const keys = new Set(locations.flatMap(l => Object.keys(l.data)));
        for (const banned of ['material', 'smell', 'light', 'furniture', 'condition', 'temperature']) {
            expect(keys.has(banned)).toBe(false);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE RULE THE WHOLE FILE IS UNDER
// ─────────────────────────────────────────────────────────────────────────

describe('nothing in the lore is bespoke', () => {
    it('has no faction id anywhere in the module', () => {
        const src = readFileSync(
            new URL('../../../src/engine/world/architecture.ts', import.meta.url), 'utf8'
        );
        // Every faction id in the catalogs is `sect-*`, `house-*`, `court-*` or
        // `apex-*`. A quoted one in here would be a rule for one house.
        const quoted = src.match(/'(?:sect|house|court|apex)-[a-z-]+'/g);
        expect(quoted).toBeNull();
    });

    it('produces different compounds for two houses without knowing either name', () => {
        const opts = { seed: 'w', presentDay: 10_000 };
        const a = growCompound(seat('a'), broadHouse({ factionId: 'x', factionName: 'X' }), opts);
        const b = growCompound(seat('b'), narrowHouse({
            factionId: 'y', factionName: 'Y', ranks: ['Adept', 'Master'],
            recruits: false, governance: 'deference', production: 0.9
        }), opts);
        expect(a.precincts.length).not.toBe(b.precincts.length);
        expect(a.style.tags).not.toEqual(b.style.tags);
        expect(a.locations.length).not.toBe(b.locations.length);
    });
});
