import { describe, it, expect } from 'vitest';
import {
    pairProtectors,
    thingsThatCouldStandOverAHouse,
    type HouseOnItsGround
} from '../../../src/engine/world/house-protector-pairing.js';
import { houseElementalCharacterOf } from '../../../src/engine/world/house-elemental-character.js';
import { BEASTS, BEAST_CHANGE_ORDINAL } from '../../../src/data/cultivation/beasts.js';
import { SECTS, SECT_ADMISSION } from '../../../src/data/cultivation/sects.js';
import { getTechnique } from '../../../src/data/cultivation/techniques.js';
import { HELD_INSTRUMENTS } from '../../../src/data/cultivation/sealed-ancestors.js';

const houses: HouseOnItsGround[] = SECTS.map(s => ({
    factionId: s.id,
    powerOrdinal: s.powerOrdinal,
    element: houseElementalCharacterOf({
        manuals: (s.teaches ?? []).map(id => {
            const art = getTechnique(id);
            return { element: art?.element ?? null, cap: art?.cap ?? 0 };
        }),
        admissionOrdinal: s.admissionOrdinal,
        statedRoots: SECT_ADMISSION[s.id]?.preferredRoots ?? []
    }).element
}));

describe('what could stand over a house at all', () => {
    it('is drawn from the catalog and never rolled', () => {
        expect(thingsThatCouldStandOverAHouse()).toEqual(thingsThatCouldStandOverAHouse());
    });

    it('takes nothing below the change, because only somebody can be a party to this', () => {
        for (const thing of thingsThatCouldStandOverAHouse()) {
            expect(thing.ordinal).toBeGreaterThanOrEqual(BEAST_CHANGE_ORDINAL);
        }
    });

    it('leaves out the thing that is taking from the house it stands over', () => {
        // The Thing Under Nine Peaks is at 33, on the Ascetic Order's own vein,
        // sharing the Order's element - every ground and element signal points
        // at a pairing - and it is draining them. It is the reason the ground
        // is contested rather than the reason it is held.
        const pool = thingsThatCouldStandOverAHouse().map(t => t.id);
        expect(pool).not.toContain('beast-thing-under-nine-peaks');
    });

    it('leaves out the one that prices everything and holds no ground', () => {
        // The Reader is at 29, speaks, and is not demonic. It is `indifferent`
        // to veins, which is the catalog saying it never ends up beside anybody.
        expect(thingsThatCouldStandOverAHouse().map(t => t.id))
            .not.toContain('beast-nine-tailed-reader');
    });

    it('is a handful, and that is the whole rate', () => {
        // Six kinds stand at the change or above. Two of them can end up in a
        // chair, and no probability decides which. If this number is wrong the
        // fix is in `beasts.ts`, not here.
        expect(thingsThatCouldStandOverAHouse().length).toBe(2);
        expect(BEASTS.filter(b => b.ordinal >= BEAST_CHANGE_ORDINAL).length).toBe(6);
    });
});

describe('the pairing', () => {
    it('gives no house two and no thing two houses', () => {
        const paired = pairProtectors(houses, thingsThatCouldStandOverAHouse());
        expect(new Set(paired.map(p => p.factionId)).size).toBe(paired.length);
        expect(new Set(paired.map(p => p.heldBy)).size).toBe(paired.length);
    });

    it('puts each thing beside the house it shares an element with', () => {
        const paired = pairProtectors(houses, thingsThatCouldStandOverAHouse());
        expect(paired).toEqual([
            {
                factionId: 'sect-clear-river-alliance',
                heldBy: 'beast-millennial-tortoise',
                sharedElement: true
            },
            {
                factionId: 'sect-azure-cloud-pavilion',
                heldBy: 'beast-white-ape-of-the-gorge',
                sharedElement: true
            }
        ]);
    });

    it('lands the ape on the house whose gorge its own entry names', () => {
        // The pairing is derived and the catalog states the answer in prose, so
        // the two have to agree. A province-wide ground read put the ape beside
        // the Stonewright Consortium, which is how this test came to exist.
        const paired = pairProtectors(houses, thingsThatCouldStandOverAHouse());
        const ape = paired.find(p => p.heldBy === 'beast-white-ape-of-the-gorge');
        expect(ape?.factionId).toBe('sect-azure-cloud-pavilion');
        expect(BEASTS.find(b => b.id === 'beast-white-ape-of-the-gorge')?.note)
            .toMatch(/Jade Gorge/);
    });

    it('still seats a thing with no element of its own', () => {
        // "If available" is load-bearing. An unaligned pairing has to stay
        // possible or the arrangement becomes a hunt for a coincidence.
        const paired = pairProtectors(
            [{ factionId: 'h', powerOrdinal: 30, element: 'water' }],
            [{ id: 'x', ordinal: 31, element: null }]
        );
        expect(paired).toEqual([{ factionId: 'h', heldBy: 'x', sharedElement: false }]);
    });

    it('seats a thing beside a house whose element differs, rather than nowhere', () => {
        const paired = pairProtectors(
            [{ factionId: 'h', powerOrdinal: 30, element: 'water' }],
            [{ id: 'x', ordinal: 31, element: 'fire' }]
        );
        expect(paired).toEqual([{ factionId: 'h', heldBy: 'x', sharedElement: false }]);
    });

    it('prefers the shared element over the stronger house', () => {
        const paired = pairProtectors(
            [
                { factionId: 'strong', powerOrdinal: 44, element: null },
                { factionId: 'matching', powerOrdinal: 12, element: 'ice' }
            ],
            [{ id: 'x', ordinal: 31, element: 'ice' }]
        );
        expect(paired[0].factionId).toBe('matching');
    });

    it('stops when the houses run out rather than doubling up', () => {
        const paired = pairProtectors(
            [{ factionId: 'only', powerOrdinal: 30, element: null }],
            [{ id: 'a', ordinal: 33, element: null }, { id: 'b', ordinal: 31, element: null }]
        );
        expect(paired).toHaveLength(1);
        expect(paired[0].heldBy).toBe('a');
    });

    it('is stable against the order the catalog happens to list houses in', () => {
        const pool = thingsThatCouldStandOverAHouse();
        expect(pairProtectors([...houses].reverse(), pool))
            .toEqual(pairProtectors(houses, pool));
    });
});

describe('the chairs the catalog actually writes', () => {
    const withAChair = SECTS.filter(s => s.protector !== undefined);

    it('is three houses out of the whole catalog', () => {
        // Two from the beast population and one from a house's own ancestor
        // sealed at strength. Nothing rolled it and no dial produced it.
        expect(withAChair).toHaveLength(3);
        expect(SECTS.length).toBeGreaterThan(30);
    });

    it('agrees with the derivation for every beast-held chair', () => {
        const derived = new Map(
            pairProtectors(houses, thingsThatCouldStandOverAHouse())
                .map(p => [p.factionId, p.heldBy])
        );
        for (const sect of withAChair) {
            const heldBy = sect.protector!.heldBy!;
            if (!heldBy.startsWith('beast-')) continue;
            expect(derived.get(sect.id)).toBe(heldBy);
        }
        // And every derived pairing was written down.
        for (const [factionId, heldBy] of derived) {
            expect(SECTS.find(s => s.id === factionId)?.protector?.heldBy).toBe(heldBy);
        }
    });

    it('names an occupant that exists, whatever kind of thing it is', () => {
        const beastIds = new Set(BEASTS.map(b => b.id));
        const sealedIds = new Set(
            (HELD_INSTRUMENTS as unknown as { id: string }[]).map(a => a.id)
        );
        for (const sect of withAChair) {
            const heldBy = sect.protector!.heldBy!;
            expect(beastIds.has(heldBy) || sealedIds.has(heldBy)).toBe(true);
        }
    });

    it('holds an occupant that is not a beast, because the office is not a species', () => {
        const notBeasts = withAChair.filter(s => !s.protector!.heldBy!.startsWith('beast-'));
        expect(notBeasts.length).toBeGreaterThan(0);
        // The Kindler went down at strength as a position rather than a grave -
        // `sealed-ancestors.ts` already calls that kind `protector`.
        const kindler = (HELD_INSTRUMENTS as unknown as { id: string; kind: string }[])
            .find(a => a.id === notBeasts[0].protector!.heldBy);
        expect(kindler?.kind).toBe('protector');
    });

    it('never reserves a chair and fills it in the same breath', () => {
        // `HouseProtectorSchema.superRefine`: a reserved post is empty by
        // construction, because only a False Immortal may hold one and none is
        // standing in any house in the world.
        for (const sect of withAChair) {
            if (sect.protector!.policy === 'reserved') {
                expect(sect.protector!.heldBy).toBeNull();
            }
        }
    });

    it('keeps the chair off the ladder, where the office was designed to sit', () => {
        for (const sect of withAChair) {
            expect(sect.ranks).not.toContain(sect.protector!.title);
        }
    });
});
