import { describe, it, expect } from 'vitest';
import {
    houseElementalCharacterOf,
    rootAtTheDoor
} from '../../../src/engine/world/house-elemental-character.js';
import { SECTS, SECT_ADMISSION } from '../../../src/data/cultivation/sects.js';
import { TECHNIQUES, getTechnique } from '../../../src/data/cultivation/techniques.js';
import { SPIRIT_ROOTS, getSpiritRoot } from '../../../src/engine/cultivation/spirit-roots.js';

function shelfOf(sectId: string) {
    const sect = SECTS.find(s => s.id === sectId)!;
    return {
        manuals: (sect.teaches ?? []).map(id => {
            const art = getTechnique(id);
            return { element: art?.element ?? null, cap: art?.cap ?? 0 };
        }),
        admissionOrdinal: sect.admissionOrdinal,
        statedRoots: SECT_ADMISSION[sectId]?.preferredRoots ?? []
    };
}

const everyHouse = () => SECTS.map(s => ({
    id: s.id,
    character: houseElementalCharacterOf(shelfOf(s.id))
}));

describe('a house has the element its books have', () => {
    it('reads no element off a shelf with no elemental manuals', () => {
        expect(houseElementalCharacterOf({ manuals: [], admissionOrdinal: 0 }))
            .toEqual({ element: null, stance: 'open', onTheElement: 0, onTheRest: 0 });
    });

    it('does not throw on a house assembled by hand with nothing on it', () => {
        // Fixtures build factions by hand all over this suite. A house we know
        // nothing about must read as a house with no element.
        const bare = houseElementalCharacterOf(
            {} as unknown as Parameters<typeof houseElementalCharacterOf>[0]
        );
        expect(bare.stance).toBe('open');
    });

    it('ignores a book that carries nobody past the house\'s own door', () => {
        // The defect this rule was written against: the Thousand Treasure
        // Pavilion is an auction house with one fire art capped at 0, and
        // counting it made every root but fire unwelcome there.
        const filler = houseElementalCharacterOf({
            manuals: [{ element: 'fire', cap: 0 }, { element: null, cap: 13 }],
            admissionOrdinal: 4
        });
        expect(filler.stance).toBe('open');
        expect(filler.element).toBeNull();
    });

    it('takes the deepest road as the house\'s element, not the commonest', () => {
        const house = houseElementalCharacterOf({
            manuals: [
                { element: 'wood', cap: 13 }, { element: 'wood', cap: 13 },
                { element: 'metal', cap: 33 }
            ],
            admissionOrdinal: 0
        });
        expect(house.element).toBe('metal');
    });
});

describe('the two strengths behave differently', () => {
    it('requires its element when every road is it and it is most of the shelf', () => {
        const one = houseElementalCharacterOf({
            manuals: [
                { element: 'lightning', cap: 33 }, { element: 'lightning', cap: 21 },
                { element: null, cap: 25 }
            ],
            admissionOrdinal: 9
        });
        expect(one.stance).toBe('requires');
    });

    it('only prefers when the house says out loud it takes a root its books do not carry', () => {
        // The Azure Cloud finding, in miniature. Same shelf, one stated root
        // reaching past it, and the door widens.
        const shelf = {
            manuals: [{ element: 'metal', cap: 45 }, { element: 'metal', cap: 33 }],
            admissionOrdinal: 3
        };
        expect(houseElementalCharacterOf(shelf).stance).toBe('requires');
        expect(houseElementalCharacterOf({ ...shelf, statedRoots: ['dual_metal_wood'] }).stance)
            .toBe('prefers');
        // A stated root that carries only the house's own element narrows
        // nothing and must not flip it back.
        expect(houseElementalCharacterOf({ ...shelf, statedRoots: ['single_metal'] }).stance)
            .toBe('requires');
    });

    it('only prefers when there is a second road on the shelf', () => {
        const two = houseElementalCharacterOf({
            manuals: [{ element: 'fire', cap: 21 }, { element: 'metal', cap: 21 }],
            admissionOrdinal: 5
        });
        expect(two.stance).toBe('prefers');
    });

    it('only prefers when the element is a minority of what it teaches', () => {
        const mostlyElementless = houseElementalCharacterOf({
            manuals: [
                { element: 'fire', cap: 37 },
                ...Array.from({ length: 9 }, () => ({ element: null, cap: 29 }))
            ],
            admissionOrdinal: 5
        });
        expect(mostlyElementless.stance).toBe('prefers');
    });
});

describe('the door', () => {
    const requiresLightning = houseElementalCharacterOf({
        manuals: [{ element: 'lightning', cap: 33 }, { element: 'lightning', cap: 21 }],
        admissionOrdinal: 9
    });
    const prefersFire = houseElementalCharacterOf({
        manuals: [{ element: 'fire', cap: 21 }, { element: 'metal', cap: 21 }],
        admissionOrdinal: 5
    });

    it('refuses at a requiring house and never at a preferring one', () => {
        const wood = getSpiritRoot('single_wood')!;
        expect(rootAtTheDoor(requiresLightning, wood)).toBe('refused');
        expect(rootAtTheDoor(prefersFire, wood)).toBe('weighted');
    });

    it('welcomes the root the house is written for, at either strength', () => {
        expect(rootAtTheDoor(requiresLightning, getSpiritRoot('mutated_lightning'))).toBe('welcome');
        expect(rootAtTheDoor(prefersFire, getSpiritRoot('single_fire'))).toBe('welcome');
    });

    it('welcomes everybody at a house with no element of its own', () => {
        const open = houseElementalCharacterOf({ manuals: [], admissionOrdinal: 0 });
        for (const root of SPIRIT_ROOTS) expect(rootAtTheDoor(open, root)).toBe('welcome');
    });

    it('counts a multi-element root as carrying the house\'s element', () => {
        const prefersWater = houseElementalCharacterOf({
            manuals: [{ element: 'water', cap: 21 }, { element: 'wood', cap: 21 }],
            admissionOrdinal: 1
        });
        expect(rootAtTheDoor(prefersWater, getSpiritRoot('dual_water_fire'))).toBe('welcome');
    });
});

describe('over the catalog as it stands', () => {
    it('leaves most of the world open, which is what the shelves say', () => {
        const stances = everyHouse().map(h => h.character.stance);
        // Eleven houses teach nothing elemental at all and several more teach
        // one bottom-rung art. A world where most houses gated on root would be
        // the derivation reading too hard, and it would show up here first.
        expect(stances.filter(s => s === 'open').length).toBeGreaterThan(stances.length / 2);
    });

    it('gates exactly the two houses whose own admission line says it', () => {
        const requiring = everyHouse().filter(h => h.character.stance === 'requires');
        expect(requiring.map(h => h.id).sort()).toEqual([
            'sect-frostmirror-court',
            'sect-storm-tyrant-court'
        ]);
        // Both were already saying it in prose nothing enforced.
        for (const house of requiring) {
            expect(SECT_ADMISSION[house.id].requirement).toMatch(/root/i);
        }
    });

    it('reads the Storm Tyrant Court as lightning and refuses everybody else', () => {
        const court = houseElementalCharacterOf(shelfOf('sect-storm-tyrant-court'));
        expect(court).toMatchObject({ element: 'lightning', stance: 'requires' });
        const refused = SPIRIT_ROOTS.filter(r => rootAtTheDoor(court, r) === 'refused');
        expect(refused.length).toBe(SPIRIT_ROOTS.length - 1);
        expect(rootAtTheDoor(court, getSpiritRoot('mutated_lightning'))).toBe('welcome');
    });

    it('reads the fire houses as preferring rather than requiring', () => {
        for (const id of [
            'sect-cinnabar-crucible-guild', 'sect-ashen-forge-clan', 'sect-nine-abyss-flame-sect'
        ]) {
            expect(houseElementalCharacterOf(shelfOf(id)))
                .toMatchObject({ element: 'fire', stance: 'prefers' });
        }
    });

    it('does not make the Azure Cloud Pavilion absolutist', () => {
        // `architecture.ts` measured this and it is the case the widening
        // clause exists for: its whole elemental shelf is metal and its
        // courtyards are courtyards.
        expect(houseElementalCharacterOf(shelfOf('sect-azure-cloud-pavilion')))
            .toMatchObject({ element: 'metal', stance: 'prefers' });
    });

    it('is a pure function of the shelf - the same input twice is the same answer', () => {
        for (const s of SECTS) {
            expect(houseElementalCharacterOf(shelfOf(s.id)))
                .toEqual(houseElementalCharacterOf(shelfOf(s.id)));
        }
    });

    it('never names an element the technique catalog does not carry', () => {
        const known = new Set(TECHNIQUES.map(t => t.element).filter(Boolean));
        for (const { character } of everyHouse()) {
            if (character.element !== null) expect(known.has(character.element)).toBe(true);
        }
    });
});
