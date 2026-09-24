/**
 * An empty square with four people standing in it.
 *
 * FOUND BY PLAYING BLIND, turn two of a run, one turn after a market read had named four people
 * selling manuals with their prices: "There is no one here to provide a manual, and no one to
 * show the way." The narrator was asked for scene prose and never told who was in the scene, so
 * the cheapest scene to write from nothing - an empty room - came back.
 *
 * The narrator now plays the people in the scene, so it is handed a card for each of them: what
 * they are at, what they are like, what is on their mind, and what they are to the player. What
 * this pins is that the room reaches the model, that an empty room is said to be empty, that a
 * face the player cannot place is never named, and that no card states a rung.
 */

import { describe, it, expect } from 'vitest';

import { composeNarrationUser, narrationSystemPrompt } from '../../src/web/prompt';
import { howTheRoomReadsThem, howTheyReadToYou, thePeopleHere, whoTheActWasPutTo } from '../../src/web/the-narrator-plays-the-world';
import type { Company } from '../../src/web/facts';

const FACTS = {
    headline: 'two arts you could be taught',
    lines: ['A Lesser Qi-Gathering Manual is one a root like yours could take up.'],
    structure: [],
    prose: '',
    required: null
} as const;

const SCENE = { place: 'Autumn Gate', ambient: 'thin' } as const;

function aSquareWith(named: readonly string[], strangers: number): Company {
    return {
        named: named.map((name, i) => ({
            name,
            ordinal: 3,
            sex: 'man',
            age: 40 + i,
            rank: null,
            at: i === 0 ? 'haggling over a cracked jade slip' : null,
            looksUp: i === 0,
            playsToTheRoom: 0,
            withNames: [],
            like: i === 0 ? 'says a thing twice when he wants it heard' : null,
            chewing: i === 0 ? { state: 'a debt he cannot meet by the new moon', plainly: '' } : null
        })) as unknown as Company['named'],
        strangers: Array.from({ length: strangers }, () => ({ ordinal: 2 })),
        total: named.length + strangers
    };
}

describe('the narrator is handed the people in the scene', () => {
    it('gives each person a card to play them from', () => {
        const said = thePeopleHere(aSquareWith(['Wei Ciyi', 'Tang Minya'], 0), 0, [], null).join('\n');
        expect(said).toContain('Wei Ciyi');
        expect(said).toContain('Tang Minya');
        expect(said).toContain('haggling over a cracked jade slip');
        expect(said).toContain('says a thing twice when he wants it heard');
        expect(said).toContain('a debt he cannot meet by the new moon');
    });

    /**
     * AND SAYS SO WHEN IT IS ACTUALLY EMPTY, which is the half that keeps this from being a gag
     * order. A cultivator alone on a mountain is alone, and an account of that turn may say it.
     */
    it('says the room is empty when it is', () => {
        const said = thePeopleHere(aSquareWith([], 0), 0, [], null).join('\n').toLowerCase();
        expect(said).toContain('nobody');
        expect(said).toContain('alone');
    });

    /** THE DISCOVERY GATE IS NOT LOOSENED BY THIS. A face nobody can place has no name to give. */
    it('counts the faces it cannot place instead of naming them', () => {
        const said = thePeopleHere(aSquareWith(['Wei Ciyi'], 3), 0, [], null).join('\n');
        expect(said).toContain('Wei Ciyi');
        expect(said).toMatch(/3 people whose faces the player cannot place/);
    });

    /** Nobody in a square perceives a rung, so a card reads standing in words and never numbers. */
    it('reads standing in words, never as a rung', () => {
        const said = thePeopleHere(aSquareWith(['Wei Ciyi'], 0), 0, [], null).join('\n').toLowerCase();
        expect(said).toContain('above you');
        for (const wrong of ['rung', 'ordinal', 'layer', 'qi condensation']) {
            expect(said, wrong).not.toContain(wrong);
        }
    });

    /**
     * A gap of whole realms is said as what it does between two people, both ways. Played: made
     * Deity Transformation, the player ordered outer disciples about and one answered as to an
     * equal - the card had said "far below you" and nothing about what that is to stand before.
     */
    it('says what a gap of realms does between two people, in both directions', () => {
        const low = howTheyReadToYou(0, 28);
        expect(low).toContain('far below you');
        expect(low).toMatch(/defer|give way/);
        expect(howTheyReadToYou(28, 0)).toContain('far above you');
        expect(howTheyReadToYou(28, 0)).not.toMatch(/\d/);
        expect(howTheyReadToYou(3, 3)).toBe('about level with you');
    });

    /** The crowd has no card, so the room as a whole is told what is standing in it. */
    it('tells the whole room when the player stands a realm above everybody in it', () => {
        const square = aSquareWith(['Wei Ciyi'], 3);
        expect(howTheRoomReadsThem(square, 28)).toMatch(/far above anybody here/);
        expect(thePeopleHere(square, 28, [], null).join('\n')).toMatch(/nobody who can see them jeers/);
        expect(howTheRoomReadsThem(square, 3)).toBeNull();
    });

    /** What is on somebody's mind is said once in a place; after that the card says they are past it. */
    it('does not hand a worry back once it has been voiced here', () => {
        const square = aSquareWith(['Wei Ciyi'], 0);
        expect(thePeopleHere(square, 0, [], null).join('\n')).toContain('a debt he cannot meet by the new moon');
        const after = thePeopleHere(square, 0, [], null, new Set(['Wei Ciyi'])).join('\n');
        expect(after).not.toContain('a debt he cannot meet by the new moon');
        expect(after).toContain('already said what is on their mind');
    });

    /** The one being spoken to leads, and is marked, so the turn is theirs. */
    it('puts the person the act was put to first, and marks them', () => {
        const square = aSquareWith(['Wei Ciyi', 'Tang Minya'], 0);
        expect(whoTheActWasPutTo(['Tang Minya'], square)).toBe('Tang Minya');
        const said = thePeopleHere(square, 0, [], 'Tang Minya');
        const first = said.findIndex(line => line.includes('Tang Minya'));
        expect(first).toBeLessThan(said.findIndex(line => line.includes('Wei Ciyi')));
        expect(said[first]).toContain('SPEAKING TO THEM');
    });

    /**
     * A childhood is recorded as witnessed, the same as a sighting, and only its sentence tells
     * them apart. Played: the woman who raised the player reached the model with no tie, and
     * answered them as a stranger.
     */
    it('says what somebody from home is to the player, and nothing for a sighting', () => {
        const row = (name: string, statement: string, sourceNote: string) => ({
            kind: 'cultivator', id: name, name, statement, stance: 'knows',
            sourceKind: 'witnessed', sourceNote, acquiredOnDay: 0, stage: 'named'
        });
        const awareness = [
            row('Kong Zhaolu', 'Kong Zhaolu is family, and did the raising.', 'Family. Did the raising.'),
            row('Wei Ciyi', 'Wei Ciyi exists.', 'Standing in the same place, in plain sight.')
        ];
        const said = thePeopleHere(aSquareWith(['Kong Zhaolu', 'Wei Ciyi'], 0), 0, awareness as never, null);
        expect(said.join('\n')).toContain('To you: Kong Zhaolu is family, and did the raising.');
        expect(said.filter(line => line.includes('To you')).length).toBe(1);
    });

    /** A description is left to the model, which has the cards and the player's words. */
    it('does not guess who a description meant', () => {
        expect(whoTheActWasPutTo(['the old man'], aSquareWith(['Wei Ciyi'], 0))).toBeNull();
    });
});

describe('the narration prompt carries it', () => {
    it('puts the room in front of the narrator', () => {
        const prompt = composeNarrationUser(
            FACTS as never,
            { ...SCENE, company: aSquareWith(['Wei Ciyi', 'Tang Minya'], 2) }
        );
        expect(prompt).toContain('THE PEOPLE HERE');
        expect(prompt).toContain('Wei Ciyi');
    });

    /**
     * AND IT TELLS THE NARRATOR WHOSE JOB AN ABSENCE IS. The played sentence was not only
     * unsupported, it was the opposite of what the engine had ruled.
     */
    it('says an absence is the engine to state', () => {
        expect(narrationSystemPrompt().toLowerCase()).toContain("an absence is the engine's to state");
    });

    /** Opt-in, the way `filed` and `hearing` are: no roster is not an empty room. */
    it('says nothing about the room when the caller did not pass one', () => {
        const prompt = composeNarrationUser(FACTS as never, { ...SCENE });
        expect(prompt).not.toContain('THE PEOPLE HERE');
    });
});
