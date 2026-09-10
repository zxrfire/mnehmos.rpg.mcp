/**
 * A character sheet is not an opening.
 *
 * FOUND BY PLAYING. A run opened with this, and this was the whole of it:
 *
 *     shen wuyou I begins at Qi Condensation Layer 1, age 16. Born in Clear
 *     River Ford, a market town on thin ground. A farm in a thin county. 30
 *     spirit stones, under a year of seclusion. 3 NAMES KNOWN. Metal-Wood Dual
 *     Root; Might 3, Insight 3, Fortune 3, Charm 2.
 *
 *     Clear River Ford. The air here gives very little back.
 *     The day asks nothing in particular.
 *
 * The design owner: *"if you start in a place with 0 people, say it, like the
 * beginning should narrate your life up to that point"*, and on the same
 * screen, *"you have to know SOMETHING, else the game is just dead."*
 *
 * "3 names known" is the line that gives the whole thing away. Every one of
 * those rows already carried the NAME, a statement of what this person believes
 * about it, and a note saying who they got it from - drawn at birth, written to
 * the knowledge table, and reported to the player as a digit.
 */

import { describe, it, expect } from 'vitest';

import {
    theLifeBehindTheFirstTurn,
    NAMES_WORTH_SAYING_AT_THE_START
} from '../../src/web/the-life-behind-the-first-turn';

const known = (name: string, over: Partial<{ statement: string; sourceNote: string }> = {}) => ({
    kind: 'sect' as const,
    id: `sect-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    stance: 'neutral' as never,
    sourceKind: 'told' as never,
    sourceNote: over.sourceNote ?? 'What everyone in the county says. Nobody has checked.',
    statement: over.statement ?? `${name} exists somewhere out there and takes disciples.`,
    confidence: 0.4
});

const birth = (over: Partial<{
    knowledge: unknown[]; house: unknown; raisedInside: unknown; stones: number; years: number;
}> = {}) => ({
    origin: 'thin_county',
    opening: {
        name: 'A farm in a thin county',
        provisionedYears: over.years ?? 0.4
    },
    place: { name: 'Three Walls', kind: 'market_town' },
    ground: 'thin',
    density: 0.3,
    spiritStones: over.stones ?? 30,
    house: over.house ?? null,
    raisedInside: over.raisedInside ?? null,
    knowledge: over.knowledge ?? [known('Azure Dew Sect')]
}) as never;

const said = (over = {}) => theLifeBehindTheFirstTurn(birth(over), 16).join(' ');

describe('the life behind the first turn', () => {
    it('says the years, the ground, and what they came out of', () => {
        const life = said();
        expect(life).toMatch(/16 years in Three Walls/);
        expect(life).toMatch(/on thin ground/);
        expect(life).toMatch(/A farm in a thin county/);
        // Sixteen years of breathing it, so it is said as a lifetime rather
        // than as a reading somebody just took.
        expect(life).toMatch(/nothing to compare it against/);
    });

    /**
     * THE HALF THAT WAS MISSING. A count is not knowledge. Each row carries
     * what they believe and who told them, and both reach the page.
     */
    it('names what they know, what they believe about it, and who told them', () => {
        const life = said();
        expect(life).toContain('Azure Dew Sect');
        expect(life).toContain('takes disciples');
        expect(life).toMatch(/What everyone in the county says\. Nobody has checked\./);
    });

    it('does not stutter the name when the statement already opens with it', () => {
        // "Three Walls. Three Walls is where they are from" is the engine
        // saying it twice because two fields happen to agree.
        const life = said({
            knowledge: [known('Three Walls', {
                statement: 'Three Walls is where they are from.',
                sourceNote: 'Where they grew up.'
            })]
        });
        expect(life).not.toMatch(/Three Walls\.\s+Three Walls is where/);
        expect(life).toContain('Three Walls is where they are from.');
    });

    /**
     * AND IT AGREES WITH THE SHEET BESIDE IT. The mechanical line files the
     * total, so saying "3 names, in full" next to a sheet reading 8 is the
     * engine disagreeing with itself on one screen.
     */
    it('reports the true total even when it only says the first few', () => {
        const many = Array.from({ length: 8 }, (_, i) => known(`House ${i}`));
        const life = said({ knowledge: many });
        expect(life).toMatch(/8 names/);
        expect(life).toMatch(/the ones they would say first/);
        // And it does say some of them.
        expect(life).toContain('House 0');
        expect(life).toContain(`House ${NAMES_WORTH_SAYING_AT_THE_START - 1}`);
        expect(life).not.toContain('House 7');
    });

    it('says plainly when nobody has told them anything', () => {
        const life = said({ knowledge: [] });
        expect(life).toMatch(/Nobody has told them anything about anywhere/);
        expect(life).toMatch(/they learn by walking up to it/);
    });

    it('says how a house carries them, and keeps the debt out of anybody mouth', () => {
        const life = said({
            raisedInside: {
                house: { name: 'Azure Cloud Pavilion' },
                onTheRoll: 'by taking',
                stillToClear: [],
                somebodyIsOwedForIt: true
            }
        });
        expect(life).toMatch(/on its roll because it took them in/);
        expect(life).toMatch(/nobody has told them why/);
        // The world knows and the player does not, and the record says so
        // rather than putting it in somebody's mouth.
        expect(life).toMatch(/carrying the debt for it/);
        expect(life).toMatch(/nobody here is going to tell them/);
    });

    it('separates belonging to a house from being admitted to one', () => {
        const life = said({ house: { name: 'Azure Dew Sect' } });
        expect(life).toMatch(/not a rank and not an admission/);
    });
});
