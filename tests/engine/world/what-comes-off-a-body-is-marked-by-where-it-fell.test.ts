/**
 * What comes off a body is marked by where the body fell.
 *
 * The defect this closes: a death moved things and the PLACE had no say in
 * what state they arrived in. A manual off a corpse in a demonic abyss and the
 * same manual handed down inside a sect were the same row, so nothing in the
 * world could ever produce the genre's commonest inheritance - the book that
 * carries somebody partway and stops, because the man who held the rest died
 * with it.
 *
 * THE RULING, generalised past manuals by the design owner once it was put to
 * him that a sword off a body in a bad place has identical logic: what comes
 * off a body is weighted by the danger of the place they died, and dying in a
 * sect passes things down unchanged. That last clause is not a branch anywhere.
 * It falls out of a sect precinct's `environment.danger` being 0.1.
 *
 * THREE ASSERTIONS THIS FILE EXISTS TO MAKE:
 *
 *  1. The mapping from danger to the three outcomes is a design number, so it
 *     is pinned here rather than left to be read off the code. It is exact:
 *     a place marks what comes off a body as often as its own `danger` says,
 *     and of what it marks, `NOTHING_USABLE_BELOW` is the share that is not
 *     worth carrying.
 *  2. A work in parts loses its TAIL, never a hole in the middle and never its
 *     opening. Pages off the end give the run from the beginning that
 *     `contiguousRun` measures and `effectiveCapOf` caps one rung lower per
 *     part beyond it; random holes would mostly produce books worth nothing.
 *
 *     DAMAGED AND RUINED ARE ONE COMPARISON, not two kinds of loss. The design
 *     owner: *"a manual missing the first half may as well be categorized as
 *     ruined"*. So the question is only whether a usable run survives from the
 *     beginning - `NOTHING_USABLE_BELOW` is where that line sits - and front
 *     loss is not modelled as its own case because it cannot occur: losing the
 *     opening means losing everything, and `ruin` is where that goes. A row
 *     that looks salvageable and caps at nothing is never produced.
 *  3. The roll happens at DEATH and is stored. Two people who find the same
 *     book must not disagree about its condition, which they would if the
 *     condition were rolled when somebody picked it up.
 *
 * And a fourth, which is why the chain matters to somebody else: the
 * provenance entry NAMES THE PLACE, so a cause is repeatable by whatever
 * reads the chain later.
 */

import { describe, it, expect, beforeAll } from 'vitest';

import { seedWorld } from '../../../src/engine/world/seeding';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog';
import { advanceWorldForPlay } from '../../../src/engine/world/driver';
import type { WorldState } from '../../../src/engine/world/world-state';
import {
    settleEstate,
    howAPlaceMarksWhatComesOffABody,
    whatThePlaceDidToIt,
    whereTheyFell,
    NOTHING_USABLE_BELOW,
    type EstateInput,
    type WhereTheyFell
} from '../../../src/engine/world/estate-at-death';
import { isRuined, makeObject } from '../../../src/engine/world/possessions';
import { contiguousRun, effectiveCapOf } from '../../../src/engine/cultivation/acquisition';
import { makeEnvironment, makeLocation } from '../../../src/engine/world/locations';

const DEAD = { id: 'cult-1', name: 'Shen Ke' };

/** A sect precinct. `architecture.ts` gives a righteous house's ground 0.1. */
const INSIDE_A_SECT: WhereTheyFell = { id: 'loc-sect', name: 'the outer precinct', danger: 0.1 };

/** Deep worked ground. `how-the-world-keeps-finding-more-ruins.ts` goes to 0.8. */
const A_BAD_PLACE: WhereTheyFell = { id: 'loc-abyss', name: 'the Sunken Kiln', danger: 0.8 };

/** The one work the catalog holds in parts, as `effectiveCapOf` reads it. */
const THE_WORK = {
    id: 'heaven-conversing-primordial-canon',
    name: 'The Heaven-Conversing Canon',
    cap: 30,
    volumes: [
        'volume-heaven-conversing-first',
        'volume-heaven-conversing-second',
        'volume-heaven-conversing-third'
    ]
};

function aVolume(id: string) {
    return {
        itemId: id,
        name: id,
        kind: 'manual' as const,
        significance: 'significant' as const,
        power: null,
        partOfWork: THE_WORK.volumes,
        worldRow: makeObject({ id, name: id, kind: 'manual', significance: 'significant' })
    };
}

function dying(over: Partial<EstateInput> = {}): EstateInput {
    return {
        dead: DEAD,
        onDay: 4000,
        locationId: 'loc-abyss',
        seed: 'world-seed',
        fell: A_BAD_PLACE,
        counted: { spiritStones: 0, stock: [] },
        tracked: [],
        standingOver: [],
        causeNote: 'Killed.',
        ...over
    };
}

describe('the danger of a place is the whole of the weighting', () => {
    it('leaves a thing alone as often as the place is safe', () => {
        const quiet = howAPlaceMarksWhatComesOffABody(0.05);
        expect(quiet.unchanged).toBeCloseTo(0.95, 10);
        expect(quiet.unchanged + quiet.damaged + quiet.ruined).toBeCloseTo(1, 10);
    });

    it('passes a thing down unchanged inside a sect nine times in ten, with no branch on sects', () => {
        const sect = howAPlaceMarksWhatComesOffABody(INSIDE_A_SECT.danger);
        expect(sect.unchanged).toBeCloseTo(0.9, 10);
        expect(sect.ruined).toBeCloseTo(0.1 * NOTHING_USABLE_BELOW, 10);
    });

    it('makes damaged the common outcome where the ground is bad, rather than total loss', () => {
        const bad = howAPlaceMarksWhatComesOffABody(A_BAD_PLACE.danger);
        expect(bad.unchanged).toBeCloseTo(0.2, 10);
        expect(bad.damaged).toBeCloseTo(0.8 * (1 - NOTHING_USABLE_BELOW), 10);
        expect(bad.ruined).toBeCloseTo(0.8 * NOTHING_USABLE_BELOW, 10);
        expect(bad.damaged).toBeGreaterThan(bad.ruined);
    });

    it('reads the figure off a location record rather than asking the caller to retype it', () => {
        const record = makeLocation({
            id: 'loc-abyss',
            name: 'the Sunken Kiln',
            environment: makeEnvironment({ danger: 0.8 })
        });
        expect(whereTheyFell(record)).toEqual(A_BAD_PLACE);
        expect(whereTheyFell(null)).toBeNull();
    });

    it('marks nothing when the world cannot say where they fell', () => {
        const estate = settleEstate(dying({
            fell: null,
            tracked: [{
                itemId: 'artifact-a-blade',
                name: 'A Blade',
                kind: 'artifact',
                significance: 'significant',
                power: 12
            }]
        }));
        expect(estate.marks.map(m => m.condition)).toEqual(['unchanged']);
        expect(estate.objects[0].power).toBe(12);
    });
});

describe('a work in parts loses its tail', () => {
    /**
     * The seeds are read out of the run rather than asserted: what is pinned is
     * that SOME seed in a bad place produces a book that lost its end and kept
     * its beginning, and that no seed anywhere produces one with a hole in it.
     */
    function carryingTheWholeWork(seed: string) {
        return settleEstate(dying({
            seed,
            tracked: THE_WORK.volumes.map(aVolume)
        }));
    }

    const seeds = Array.from({ length: 200 }, (_, i) => `seed-${i}`);

    it('never leaves a hole in the middle of a work', () => {
        // The count is asserted alongside the property because the property is
        // vacuously true of a work that was destroyed outright, and a first cut
        // of this test passed while every volume in the corpus was being ruined.
        let partial = 0;
        for (const seed of seeds) {
            const estate = carryingTheWholeWork(seed);
            const survivors = new Set(
                estate.objects.filter(o => !isRuined(o)).map(o => o.id)
            );
            expect(contiguousRun(THE_WORK.volumes, survivors)).toBe(survivors.size);
            if (survivors.size > 0 && survivors.size < THE_WORK.volumes.length) partial++;
        }
        expect(partial).toBeGreaterThan(0);
    });

    it('produces a book that carries a reader partway and stops', () => {
        const partial = seeds
            .map(carryingTheWholeWork)
            .find(estate => {
                const survivors = estate.objects.filter(o => !isRuined(o));
                return survivors.length > 0 && survivors.length < THE_WORK.volumes.length;
            });

        expect(partial).toBeDefined();

        const held = partial!.objects.filter(o => !isRuined(o)).map(o => o.id);
        const reach = effectiveCapOf(THE_WORK, held);
        const whole = effectiveCapOf(THE_WORK, THE_WORK.volumes);

        expect(reach.cap).not.toBeNull();
        expect(reach.cap!).toBeLessThan(whole.cap!);
        expect(reach.rungsLost).toBe(THE_WORK.volumes.length - held.length);
    });

    it('never leaves a work whose opening is gone standing as a damaged book', () => {
        // The refinement, as an assertion: there is no outcome in which the
        // first part is gone and a later one is still there. Either the head
        // survives, or the whole thing went. A row capping at nothing is the
        // outcome this forbids.
        for (const seed of seeds) {
            const estate = carryingTheWholeWork(seed);
            const survivors = estate.objects.filter(o => !isRuined(o)).map(o => o.id);
            if (survivors.length === 0) continue;
            expect(survivors[0]).toBe(THE_WORK.volumes[0]);
            expect(effectiveCapOf(THE_WORK, survivors).cap).not.toBe(0);
        }
    });

    it('routes a work with nothing usable left to ruin, every part of it', () => {
        const gone = seeds
            .map(carryingTheWholeWork)
            .find(estate => estate.marks.some(m => m.theWork === 'ruined'));

        expect(gone).toBeDefined();
        // Not one row ruined and two left looking readable. The work went.
        expect(gone!.marks.every(m => m.condition === 'ruined')).toBe(true);
        expect(gone!.objects.every(o => isRuined(o))).toBe(true);
        expect(contiguousRun(THE_WORK.volumes, new Set())).toBe(0);
    });

    it('passes the whole work down inside a sect', () => {
        const estate = settleEstate(dying({
            fell: INSIDE_A_SECT,
            locationId: INSIDE_A_SECT.id,
            seed: 'a-quiet-death',
            tracked: THE_WORK.volumes.map(aVolume)
        }));
        expect(estate.objects.every(o => !isRuined(o))).toBe(true);
        expect(effectiveCapOf(THE_WORK, estate.objects.map(o => o.id)).rungsLost).toBe(0);
    });
});

describe('a rated thing worth less than whole', () => {
    const blade = {
        itemId: 'artifact-a-blade',
        name: 'A Blade',
        kind: 'artifact' as const,
        significance: 'significant' as const,
        power: 12
    };

    function offABody(seed: string) {
        return settleEstate(dying({ seed, tracked: [blade] }));
    }

    it('drops one rung when the place marks it and leaves something usable', () => {
        const damaged = Array.from({ length: 200 }, (_, i) => offABody(`blade-${i}`))
            .find(e => e.marks[0].condition === 'damaged');

        expect(damaged).toBeDefined();
        expect(damaged!.objects[0].power).toBe(11);
        expect(damaged!.objects[0].tags).toContain('damaged');
        expect(isRuined(damaged!.objects[0])).toBe(false);
    });

    it('is ruined outright when nothing usable is left of it', () => {
        const ruined = Array.from({ length: 200 }, (_, i) => offABody(`blade-${i}`))
            .find(e => e.marks[0].condition === 'ruined');

        expect(ruined).toBeDefined();
        expect(isRuined(ruined!.objects[0])).toBe(true);
    });
});

describe('the chain says what the place did', () => {
    it('names the place, so the cause is repeatable by whatever reads it later', () => {
        const marked = Array.from({ length: 200 }, (_, i) => settleEstate(dying({
            seed: `chain-${i}`,
            tracked: [{
                itemId: 'artifact-a-blade',
                name: 'A Blade',
                kind: 'artifact',
                significance: 'significant',
                power: 12
            }]
        }))).find(e => e.marks[0].condition !== 'unchanged');

        expect(marked).toBeDefined();
        const chain = marked!.objects[0].provenance;
        expect(chain.some(link => link.source === whatThePlaceDidToIt(A_BAD_PLACE.name))).toBe(true);
        expect(whatThePlaceDidToIt(A_BAD_PLACE.name)).toContain(A_BAD_PLACE.name);
    });
});

describe('the condition is rolled once, at death', () => {
    it('gives two readers of the same death the same book', () => {
        const first = settleEstate(dying({ tracked: THE_WORK.volumes.map(aVolume) }));
        const second = settleEstate(dying({ tracked: THE_WORK.volumes.map(aVolume) }));

        expect(first.marks).toEqual(second.marks);
        expect(first.objects.map(o => isRuined(o))).toEqual(second.objects.map(o => isRuined(o)));
    });

    it('does not let one body\'s draw move another body\'s', () => {
        const alone = settleEstate(dying({
            tracked: [aVolume('volume-heaven-conversing-first')]
        }));
        const withCompany = settleEstate(dying({
            tracked: [
                {
                    itemId: 'artifact-a-blade',
                    name: 'A Blade',
                    kind: 'artifact',
                    significance: 'significant',
                    power: 12
                },
                aVolume('volume-heaven-conversing-first')
            ]
        }));

        const volumeAlone = alone.marks.find(m => m.itemId === 'volume-heaven-conversing-first');
        const volumeWith = withCompany.marks.find(m => m.itemId === 'volume-heaven-conversing-first');
        expect(volumeWith!.condition).toBe(volumeAlone!.condition);
    });
});

/**
 * The same rule with nothing arranged at all.
 *
 * Every case above hands `settleEstate` a body. This one hands the world two
 * hundred years and reads what it did on its own: the deaths are the world's,
 * the places are the world's, and the only thing asserted is that the marks
 * exist, that they name real ground, and that the ground they name is ground
 * the world calls dangerous.
 *
 * MEASURED, seed `estate-a`, 200 years: 34 object rows of 1595 carry a mark,
 * 24 of them a rung down and the rest gone. That is a rate over a lived world
 * and no seed is pinned to a count.
 */
describe('a world left to itself marks what comes off its dead', () => {
    let lived: WorldState;

    beforeAll(async () => {
        const catalog = await loadCultivationCatalog();
        lived = seedWorld({ seed: 'estate-a', catalog }).state;
        advanceWorldForPlay(lived, { days: 200 * 365, stopOnInterrupt: false });
    }, 600000);

    it('leaves marks nobody arranged', () => {
        const marked = lived.objects.filter(o =>
            o.provenance.some(p => p.source.startsWith('taken off a body in ')));
        expect(marked.length).toBeGreaterThan(0);
        expect(marked.some(o => o.tags.includes('damaged'))).toBe(true);
        expect(marked.some(o => isRuined(o))).toBe(true);
    });

    it('names ground the world can be asked about, at a place it calls dangerous', () => {
        const places = new Map(lived.locations.map(l => [l.name, l.environment.danger]));
        const named = lived.objects
            .flatMap(o => o.provenance)
            .filter(p => p.source.startsWith('taken off a body in '))
            .map(p => p.source.slice('taken off a body in '.length));

        expect(named.length).toBeGreaterThan(0);
        for (const place of named) {
            expect(places.has(place)).toBe(true);
            expect(places.get(place)!).toBeGreaterThan(0);
        }
    });
});
