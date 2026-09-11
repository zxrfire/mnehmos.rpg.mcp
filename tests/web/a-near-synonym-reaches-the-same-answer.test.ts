/**
 * REFUSALS A GAME MASTER WOULD NOT HAVE GIVEN, FOUND BY PLAYING.
 *
 * 348 sentences were played across four situations - a fresh cultivator in a
 * town, one on a house's roll, one on the road, and one answering straight
 * after a listing - in the engine-only reader. 165 turns came back as a
 * refusal, a non-answer or a misread. The refusals below are the ones where
 * the fact was already computed, already printed for a DIFFERENT phrasing, and
 * denied to this one.
 *
 * Every pair here is the near-synonym defect AGENTS.md names: one wording works
 * and the wording a player reaches for first does not.
 *
 *   what is my cultivation  status, and it prints the spirit root and the four
 *                           attributes by name
 *   what is my talent       unclear. "you turn the thought over and it does not
 *                           resolve into anything you could actually do"
 *
 *   what do I know          recall - 25 names, split into people, places, houses
 *   who do I know           unclear
 *
 *   what is in my pouch     inventory
 *   I open my storage ring  unclear
 *
 *   I look at the wall      the bills, with every intake, its bar and its date
 *   I read the notice       investigate, and then a refusal naming the PEOPLE
 *                           standing here - which is the wrong kind of failure
 *                           as well as the wrong answer
 *
 *   I enter the ruins       site, which refuses honestly and names the route
 *   I explore the ruins     investigate, "unresolved subject: ruins"
 *
 *   am I hurt               status
 *   I check my injuries     treat, which priced a splint nobody asked for
 *
 *   what is the qi like here  look, with the ambient band in it
 *   I sense the qi here       unclear
 *
 *   I try to break through   breakthrough, which names the rung and the shortfall
 *   I condense my core       unclear, though it is the same act said at the rung
 *                            the genre names it after
 *
 * Each was measured in all three of town, sect and road, so none of them is a
 * property of where the player was standing.
 *
 * ── WHY THE FIX IS ROUTING AND NOT A WIDER GATE ──────────────────────────
 *
 * None of these needed the engine to say more than it already says. The answer
 * existed; the sentence reached the wrong verb. Where the destination verb
 * still refuses - a ruin nobody has told you about - that refusal is correct
 * and is left standing. What changes is that it refuses as a SITE rather than
 * as an unresolvable noun, which is what tells the player what would work.
 *
 * ── A CATEGORY WORD IS NOT A NAME, AGAIN ─────────────────────────────────
 *
 * `taught-what-is-a-question-and-not-a-refusal.test.ts` established this for
 * being taught and built `namesAKindRatherThanAThing` for it. Learning from a
 * book had the same hole: "I want to learn a technique" reached the resolver
 * with `technique` as a NAME and came back *unresolved technique "technique"* -
 * with the engine's own refusal naming the read that answers it. The table can
 * take that route rather than printing it.
 */

import { describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/actions';
import { makeGameInWorld } from './harness';

/** The verb a phrasing reaches, with nothing else about the parse. */
function verb(said: string): string {
    return parseIntent(said).action;
}

describe('a phrasing the sheet already answers', () => {
    it('reads the spirit root and the talent the same way it reads the realm', () => {
        const works = verb('what is my cultivation');
        expect(works).toBe('status');
        for (const said of [
            'what is my talent',
            'how talented am I',
            'what are my spiritual roots',
            'what is my spirit root',
            'what root do I have',
            'what grade is my root',
            'I check my dantian',
            'how is my dantian'
        ]) {
            expect(verb(said), said).toBe(works);
        }
    });

    it('answers a question about wounds with the wounds, not with a price for a splint', () => {
        expect(verb('am I hurt')).toBe('status');
        for (const said of [
            'I check my injuries',
            'I check my wounds',
            'what injuries do I have',
            'how badly am I hurt'
        ]) {
            expect(verb(said), said).toBe('status');
        }
    });

    /**
     * The act must not follow the read into the sheet. Getting a wound seen to
     * costs stones and days and is the verb that was the softlock.
     */
    it('leaves getting it seen to where it was', () => {
        for (const said of [
            'I get my injuries treated',
            'I find a healer',
            'I bandage my wounds',
            'I see a healer',
            'I treat my injuries'
        ]) {
            expect(verb(said), said).toBe('treat');
        }
    });

    it('opens a storage ring the way it opens a pouch', () => {
        expect(verb('what is in my pouch')).toBe('inventory');
        for (const said of [
            'I open my storage ring',
            'what is in my storage ring',
            'I check my storage ring',
            'I look in my storage ring'
        ]) {
            expect(verb(said), said).toBe('inventory');
        }
    });

    it('answers who I know with what I know', () => {
        expect(verb('what do I know')).toBe('recall');
        for (const said of ['who do I know', 'who do I know here', 'whose names do I know']) {
            expect(verb(said), said).toBe('recall');
        }
    });
});

describe('a paper on the wall is reachable by its own noun', () => {
    it('reads a notice the way it reads a bill', () => {
        expect(parseIntent('I look at the wall')).toMatchObject({ action: 'look', intent: 'bills' });
        for (const said of [
            'I read the notice',
            'I read the notices',
            'I look at the notices',
            'I check the notices'
        ]) {
            expect(parseIntent(said), said).toMatchObject({ action: 'look', intent: 'bills' });
        }
    });
});

describe('exploring a ruin is the ruin verb', () => {
    it('sends a site noun to the site step whichever verb is in front of it', () => {
        expect(parseIntent('I enter the ruins')).toMatchObject({ action: 'site' });
        for (const said of ['I explore the ruins', 'I explore the tomb', 'I explore the crypt']) {
            expect(parseIntent(said), said).toMatchObject({ action: 'site' });
        }
    });

    /**
     * The noun is the whole of the guard. `explore` over anything that is not
     * a ground stays where it was, which is the restraint `SITE_NOUNS` states
     * in its own header and had to apply once already.
     */
    it('does not take a sentence about a place people live in', () => {
        for (const said of [
            'I explore the village',
            'I explore the market',
            'I explore the town'
        ]) {
            expect(verb(said), said).toBe('investigate');
        }
    });
});

describe('a category word is not the name of an art', () => {
    it('lists what there is to learn rather than looking up a kind', () => {
        expect(verb('what can I learn')).toBe('list_techniques');
        for (const said of [
            'I want to learn a technique',
            'I want to learn an art',
            'I learn a technique',
            'I take up a cultivation method'
        ]) {
            expect(verb(said), said).toBe('list_techniques');
        }
    });

    it('still learns one by name', () => {
        expect(parseIntent('I learn the Azure Dew Gathering Canon'))
            .toMatchObject({ action: 'learn_technique' });
    });
});

describe('the genre asks for a look in its own words', () => {
    it('puts the senses out and gets the square back', () => {
        expect(verb('what is the qi like here')).toBe('look');
        for (const said of [
            'I sense the spiritual energy here',
            'I sense the qi here',
            'I use my divine sense',
            'I spread my divine sense',
            'I extend my spiritual sense'
        ]) {
            expect(verb(said), said).toBe('look');
        }
    });

    /**
     * Reaching out is a look. Drawing in is a month of sitting, and reading one
     * as the other in either direction is the most expensive misroute this
     * table can make.
     */
    it('does not take the raising verbs over the same nouns', () => {
        for (const said of ['I gather qi', 'I refine my qi', 'I draw in the ambient qi']) {
            expect(verb(said), said).toBe('cultivate');
        }
    });

    it('crosses by the name of the rung being crossed into', () => {
        expect(verb('I try to break through')).toBe('breakthrough');
        for (const said of [
            'I condense my core',
            'I form my golden core',
            'I establish my foundation'
        ]) {
            expect(verb(said), said).toBe('breakthrough');
        }
    });

    it('leaves the question about a foundation as a question', () => {
        expect(verb('is my foundation sound')).toBe('assess');
    });
});

/**
 * `move` was chosen 20 times in the same 348-turn audit and refused 20 times -
 * the only verb in the game with a 100% refusal rate - and every one of those
 * refusals declined to say where the roads DID go. "north", "the capital", "the
 * mountains", "the river" and "the library" all came back as *"nobody sets you
 * right, because nobody is sure what you meant"*, while the destinations read
 * was free and printed the answer to the same player asking in other words.
 *
 * The gate is untouched. A name still has to be one this cultivator can point
 * at, which is what `somewhereReal` decides; what the refusal now does is read
 * that same gate FORWARDS and hand back the names it would have let through.
 */
describe('a road refused says which roads are not', () => {
    it('names somewhere reachable when the name was not a place', async () => {
        const { game } = await makeGameInWorld({ seed: 'roads-named', worldSeed: 'roads-world' });
        await game.newRun('Prober');

        // The places this cultivator can point at, read out of the game's own
        // answer rather than hard-coded - any name the game prints is a name
        // the game must accept.
        const known = await game.act('what do I know');
        const places = /Places: ([^\n]+)/.exec(known.narration)?.[1]?.split(', ') ?? [];
        expect(places.length, 'this run knows of nowhere at all').toBeGreaterThan(0);

        for (const said of ['I go north', 'I travel to the capital', 'I go there']) {
            const turn = await game.act(said);
            expect(turn.toolCalls.some(call => !call.ok), said).toBe(true);
            expect(
                places.some(place => turn.narration.includes(place)),
                `${said}: the refusal named no road at all - ${turn.narration}`
            ).toBe(true);
        }
    }, 300000);
});

describe('the answers are real answers and not a second refusal', () => {
    it('plays each of them without declining', async () => {
        const { game } = await makeGameInWorld({ seed: 'near-synonym', worldSeed: 'near-synonym-world' });
        await game.newRun('Prober');

        for (const said of [
            'what is my talent',
            'what are my spiritual roots',
            'I check my dantian',
            'I check my injuries',
            'I open my storage ring',
            'who do I know',
            'I read the notice',
            'I want to learn a technique'
        ]) {
            const turn = await game.act(said);
            const declined = turn.toolCalls.filter(call => !call.ok);
            expect(declined.map(c => `${c.name}: ${c.summary}`), said).toEqual([]);
            expect(turn.narration.trim().length, said).toBeGreaterThan(0);
        }
    }, 300000);

    /**
     * The spirit root is the fact the sheet read exists to carry, and the
     * question that could not reach it is the one a player asks first.
     */
    it('says the root out loud when asked for the root', async () => {
        const { game } = await makeGameInWorld({ seed: 'root-read', worldSeed: 'near-synonym-world' });
        await game.newRun('Prober');

        const sheet = await game.act('what is my cultivation');
        const root = /Spirit root: ([^.\n]+)/.exec(sheet.narration)?.[1];
        expect(root, 'the sheet read no longer prints a spirit root').toBeDefined();

        const asked = await game.act('what are my spiritual roots');
        expect(asked.narration).toContain(root!);
    }, 300000);
});
