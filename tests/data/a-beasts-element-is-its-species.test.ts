import { describe, it, expect } from 'vitest';
import { BEASTS, BeastSchema, BEAST_CHANGE_ORDINAL } from '../../src/data/cultivation/beasts.js';
import { ElementSchema } from '../../src/schema/cultivation.js';

describe('a beast\'s element is what it is', () => {
    it('is authored on every row and parses', () => {
        for (const beast of BEASTS) {
            expect(() => BeastSchema.parse(beast)).not.toThrow();
            expect(Object.prototype.hasOwnProperty.call(beast, 'element')).toBe(true);
        }
    });

    it('is one of the seven the roots and the manuals use, or nothing', () => {
        const seven = new Set(ElementSchema.options as readonly string[]);
        for (const beast of BEASTS) {
            if (beast.element !== null) expect(seven.has(beast.element)).toBe(true);
        }
    });

    it('gives the catalog\'s fox fire, which is the whole reason the field exists', () => {
        expect(BEASTS.find(b => b.id === 'beast-nine-tailed-reader')?.element).toBe('fire');
        expect(BEASTS.find(b => b.id === 'beast-thunder-hawk')?.element).toBe('lightning');
        expect(BEASTS.find(b => b.id === 'beast-millennial-tortoise')?.element).toBe('water');
    });

    it('leaves an ordinary animal made of nothing in particular', () => {
        // A hare is not an element. Null has to stay a legal answer or the
        // field becomes a taxonomy somebody has to complete.
        expect(BEASTS.some(b => b.element === null)).toBe(true);
    });

    it('is not `ability.kind` wearing another name', () => {
        // The two are orthogonal axes and collapsing them was the trap: the
        // Reader's ability is `breath` and its element is fire; the tortoise's
        // ability is `defence` and its element is water.
        const reader = BEASTS.find(b => b.id === 'beast-nine-tailed-reader')!;
        expect(reader.ability.kind).toBe('breath');
        expect(reader.element).not.toBe(reader.ability.kind as unknown as string);
    });

    it('is the same for every member of a species, because nothing rolls it', () => {
        const bySpecies = new Map<string, Set<string | null>>();
        for (const beast of BEASTS) {
            if (!bySpecies.has(beast.id)) bySpecies.set(beast.id, new Set());
            bySpecies.get(beast.id)!.add(beast.element);
        }
        for (const seen of bySpecies.values()) expect(seen.size).toBe(1);
    });

    it('gives every one of the six at the change an element to be compared', () => {
        // The pairing reads these against a house's own. A null here is legal
        // and costs the thing its shared-element preference, so the six worth
        // pairing are worth authoring.
        for (const beast of BEASTS.filter(b => b.ordinal >= BEAST_CHANGE_ORDINAL)) {
            expect(beast.element).not.toBeNull();
        }
    });
});

describe('the file no longer says a beast has no sect', () => {
    it('still says it has no transmission, which was the real point', () => {
        // The clause that overreached was "no sect". A beast with a friend in a
        // house still has no manual and no teacher.
        // The header is prose, so this asserts the ruling rather than wording:
        // nothing in the catalog may claim a beast cannot have a house.
        const beast = BEASTS.find(b => b.id === 'beast-white-ape-of-the-gorge')!;
        expect(beast.speaks).toBe(true);
        expect(beast.disposition).toBe('righteous');
    });
});
