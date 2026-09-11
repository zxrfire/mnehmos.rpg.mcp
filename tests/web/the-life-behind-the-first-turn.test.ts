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

/** What the narrator is handed: everything, including what nobody will say. */
const said = (over = {}) => theLifeBehindTheFirstTurn(birth(over), 16).forTheNarrator.join(' ');

/** What the ENGINE files where the player reads it. */
const told = (over = {}, faces: { name: string; sourceNote: string }[] = []) =>
    theLifeBehindTheFirstTurn(birth(over), 16, faces).toldToThePlayer.join(' ');

describe('the life behind the first turn', () => {
    it('says the years, the ground, and what they came out of', () => {
        const life = said();
        expect(life).toMatch(/16 years old, standing in Three Walls/);
        // The band is said in QI and against the ground that raised them,
        // never as weather. The owner: *“xianxia doesn’t talk about air”*,
        // *“say thick with qi”*, *“thicker versus the place you came from.”*
        expect(life).toMatch(/qi/i);
        expect(life).not.toMatch(/\bair\b/i);
        expect(life).toMatch(/A farm in a thin county/);
        // Sixteen years of breathing it, so it is said as a lifetime rather
        // than as a reading somebody just took.
        // And it no longer claims they have nothing to compare it against
        // while holding both numbers.
        expect(life).not.toMatch(/nothing to compare it against/);
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

    /**
     * AND THE ENGINE NOW PRINTS THIS, WHICH MAKES THE ABOVE LOAD BEARING.
     *
     * The debt was written for a narrator under orders never to say it, and
     * being unsayable was the whole of its protection. The recap is filed to the
     * player directly now, so "the narrator will not repeat it" stopped being a
     * guarantee and became a hope. It is a field on the row instead.
     */
    it('keeps the debt off the channel the player reads', () => {
        const over = {
            raisedInside: {
                house: { name: 'Azure Cloud Pavilion' },
                onTheRoll: 'by taking',
                stillToClear: [],
                somebodyIsOwedForIt: true
            }
        };
        expect(said(over)).toMatch(/carrying the debt for it/);
        expect(told(over)).not.toMatch(/debt/i);
        expect(told(over)).not.toMatch(/spent a word/i);
        // And the rest of that same birth still reaches them: this hides one
        // fact, it does not hide the house. Second person because this is the
        // player's channel - the narrator's copy two assertions up still reads
        // "took them in", which is what the split is for.
        expect(told(over)).toMatch(/on its roll because it took you in/);
    });

    /**
     * THE NAMES AT THE BOTTOM OF THE SCREEN BELONG TO SOMEBODY.
     *
     * FOUND BY PLAYING. The opening offered *"I ask Han Ronglu to teach me"* and
     * *"I look at Mo Wanming"* over a run that had introduced neither. The recap
     * read `birth.knowledge`, which is places and houses; the PEOPLE a childhood
     * leaves are drawn by `who-a-life-like-this-grew-up-knowing.ts` into a
     * different table, and were never said. The design owner: *"it needs to
     * explain these names at the bottom otherwise a new player is very
     * confused."*
     */
    it('names the people a childhood left behind, and how they are known', () => {
        const faces = [
            { name: 'Han Ronglu', sourceNote: 'Grew up on the same road.' },
            { name: 'Mo Wanming', sourceNote: 'One of the faces that was always at the well.' }
        ];
        const life = told({}, faces);
        expect(life).toContain('Han Ronglu');
        expect(life).toContain('Grew up on the same road.');
        expect(life).toContain('Mo Wanming');
        expect(life).toContain('One of the faces that was always at the well.');
        // Acquaintance and nothing else. The module that draws them grants no
        // favour, and an opening that implied one would be handing over the
        // thing the player is supposed to go and earn.
        expect(life).toMatch(/not the same as being owed anything by them/);
    });

    it('says nothing about people when a childhood left nobody', () => {
        // The faces are drawn against a world, and there is not always one -
        // `seedTheFacesFromHome` answers with none when no world is loaded. A
        // heading with an empty list under it is the engine promising names it
        // does not have.
        expect(told({}, [])).not.toMatch(/People they can already put a name to/);
    });

    /**
     * TWO CHANNELS, ONE SET OF ROWS. The player's account may drop a fact and
     * may word one differently; it may never contain a fact the narrator was
     * not also given, because then the engine has told the player something it
     * is prepared to let a model contradict.
     */
    it('never tells the player something the narrator was not told', () => {
        const both = theLifeBehindTheFirstTurn(birth({
            house: {
                id: 'sect-azure-dew', name: 'Azure Dew Sect',
                powerOrdinal: 21, admissionOrdinal: 2, recruits: true, regionId: 'r'
            }
        }), 16, [{ name: 'Han Ronglu', sourceNote: 'Grew up on the same road.' }]);
        expect(both.toldToThePlayer.length).toBeLessThanOrEqual(both.forTheNarrator.length);
        expect(both.toldToThePlayer.length).toBeGreaterThan(0);
    });

    it('separates belonging to a house from being admitted to one', () => {
        const life = said({ house: { name: 'Azure Dew Sect' } });
        expect(life).toMatch(/not a rank and not an admission/);
    });

    /**
     * AND NOTHING HERE IS A WRITTEN CHILDHOOD.
     *
     * A first cut carried tables of authored childhoods and authored reasons
     * for leaving, drawn per origin tier. The design owner stopped it: *"do not
     * hardcode the exact starting story. Randomly generate the starting
     * variables, parents, location, etc. That should already be there? And you
     * have the LLM synthesize a story."* And then the pointer that settles it:
     * *"like birth house is already tracked?"*
     *
     * It is. The birth pass draws every variable a childhood is made of, so
     * there was nothing to invent, and inventing it was the engine composing
     * prose - the same defect as reciting a scoring rubric, reached from the
     * pleasant direction.
     */
    it('states the house as drawn fields rather than telling a story about it', () => {
        const life = said({
            house: {
                id: 'sect-azure-dew', name: 'Azure Dew Sect',
                powerOrdinal: 21, admissionOrdinal: 2, recruits: true, regionId: 'r'
            }
        });
        // The measurable things, said as measurements.
        expect(life).toContain('Azure Dew Sect');
        expect(life).toMatch(/strongest member is at/);
        expect(life).toMatch(/admits at/);
        expect(life).toMatch(/takes people in/);
        // And no invented childhood anywhere in it.
        expect(life).not.toMatch(/carried water|minded animals|swept a hall|pulled out of a river/i);
    });

    it('says plainly when there is no house at all, which is most births', () => {
        const life = said({ house: null });
        expect(life).toMatch(/No house behind them at all, which is nine births in ten/);
    });
});
