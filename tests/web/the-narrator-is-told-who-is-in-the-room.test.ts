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

import { composeNarrationUser, narrationSystemPrompt, INTENT_SYSTEM_PROMPT } from '../../src/web/prompt';
import { howTheRoomReadsThem, howTheyReadToYou, thePeopleHere, thePlayerIsSureItIsThem, whoTheActWasPutTo } from '../../src/web/the-narrator-plays-the-world';
import type { Company, EngineFacts } from '../../src/web/facts';
import { factsForRefusal } from '../../src/web/facts';
import { ProviderNarrator } from '../../src/web/narrator';
import { ScriptedProvider, makeGame } from './harness';
import { makeCultivator } from '../engine/cultivation/fixtures';

const FACTS: EngineFacts = {
    headline: 'two arts you could be taught',
    lines: ['A Lesser Qi-Gathering Manual is one a root like yours could take up.'],
    structure: [],
    prose: ''
};

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
    /** Model10 invented disciples crossing outside an otherwise empty mission
     * hall. The prompt invited "somebody crossing" from destination names,
     * although no exterior actor or sightline was supplied. Destinations remain
     * usable without becoming observations of traffic or lit lamps. This pins
     * the supplied observation boundary, not real-model prose compliance. */
    it('keeps accessible destinations without inventing observed traffic', () => {
        const prompt = composeNarrationUser(FACTS, { ...SCENE, company: aSquareWith([], 0),
            doorsFromHere: ['practice yard', 'your quarters'] });
        expect(prompt).toContain('practice yard, your quarters');
        expect(prompt).toContain('THE PEOPLE HERE: nobody');
        expect(prompt).toContain('These names describe routes, not observed people or current activity');
        expect(prompt).not.toContain('somebody crossing to another');
        expect(prompt).not.toContain('a lamp lit in one');
    });
    /** Model10 substituted public dew-servant lodging for "my quarters"; the
     * strict grounding gate correctly fell back. Teach the existing router the
     * explicit possessive without weakening that gate or granting room access. */
    it('asks the router to retain the explicit personal destination', () => {
        expect(INTENT_SYSTEM_PROMPT).toContain('means target: "my quarters", not a public dormitory');
        expect(INTENT_SYSTEM_PROMPT).toContain("resolves the player's actual assigned room and its access");
    });

    /**
     * A pointed greeting with a topic used to return before the name authority.
     * Model probe 05 then exposed a second obstruction: a look's witnessed
     * "name that got said" prevented introduction despite the named-face
     * reader correctly treating that sighting as unnamed. Both decisions now
     * ask that existing reader; a sighting permits a first introduction and
     * an actual name-giving prevents a second one.
     */
    it('introduces a merely seen pointed listener once before answering a conversational topic', async () => {
        const greeting = JSON.stringify({ action: 'interact', target: 'someone', intent: 'talk', topic: 'greeting' });
        const provider = new ScriptedProvider({ plans: [JSON.stringify({ action: 'look' }), greeting, greeting], narrations: ['(scripted)'] });
        const { game, repos } = makeGame({ seed: 'pointed-topic-name', provider });
        const { cultivator } = await game.newRun('Probe');
        const listener = repos.cultivators.create(makeCultivator({ id: 'pointed-listener', name: 'Qiao Zhenru', kind: 'npc', location: cultivator.location }));
        expect(game.present(repos.cultivators.getById(cultivator.id)!)).toHaveLength(1);
        await game.act('I look around.');
        const seen = game.knowledge.awareness(cultivator.id, 'cultivator');
        expect(seen.some(row => row.id === listener.id)).toBe(true);
        expect(thePlayerIsSureItIsThem(listener.name, seen)).toBe(false);
        await game.act('I greet someone and ask their name.');
        const learned = game.knowledge.awareness(cultivator.id, 'cultivator').find(row => row.id === listener.id);
        expect(learned?.statement).toMatch(/gave you their name/i);
        expect(game.company(repos.cultivators.getById(cultivator.id)!).named.some(card => card.id === listener.id)).toBe(true);
        expect(thePlayerIsSureItIsThem(listener.name, game.knowledge.awareness(cultivator.id, 'cultivator'))).toBe(true);
        const before = game.knowledge.provenanceOf(cultivator.id, 'cultivator', listener.id)
            .filter(row => /gave you their name/.test(row.statement ?? ''));
        await game.act('I greet someone again.');
        const after = game.knowledge.provenanceOf(cultivator.id, 'cultivator', listener.id)
            .filter(row => /gave you their name/.test(row.statement ?? ''));
        expect(after).toEqual(before);
    });

    /** The resolver's real empty-room refusal, not a hand-authored narration hint. */
    it('hands the narrator the failed address when the actual room is empty', async () => {
        const provider = new ScriptedProvider({ plans: [JSON.stringify({ action: 'interact', target: 'the physician', intent: 'talk' })], narrations: ['(scripted)'] });
        const { game, repos } = makeGame({ seed: 'no-listener', provider });
        const { cultivator } = await game.newRun('Probe');
        expect(game.present(repos.cultivators.getById(cultivator.id)!)).toEqual([]);
        const mark = provider.calls.length;
        const turn = await game.act('I speak to the physician.');
        expect(turn.toolCalls.some(call => call.name === 'engine.resolveParty' && !call.ok)).toBe(true);
        const prompt = provider.calls.slice(mark).filter(call => !(call.messages.find(message => message.role === 'system')?.content ?? '').startsWith('You are the intent router'))
            .map(call => call.messages.find(message => message.role === 'user')?.content ?? '').join('\n');
        expect(prompt).toContain('There is no listener, no reply, and no requested care');
        expect(prompt).toContain('THE PEOPLE HERE: nobody');
    });

    /**
     * Played clinic probe 2026-10-03: a greeting at 10:00 succeeded, then the
     * clock and approach put the player alone in an inn at 22:00. The narrator
     * moved the physician's historical "Right now" card into that empty inn
     * and later made an absent physician ignore a request for treatment.
     * Earlier executed speech remains; its earlier place and time cannot turn
     * into current company. Failed addressing is an observation, not silence
     * chosen by a listener who was never there.
     */
    it('keeps an earlier clinic reply separate from an empty inn and its failed request', () => {
        const physician = { ...aSquareWith(['Wei Ciyi'], 0).named[0], at: 'seeing to patients' };
        const absence = 'At this attempted request, nobody is present in the player\'s current area. There is no listener, no reply, and no requested care or other action by an addressee.';
        const failed = factsForRefusal('Nobody by that name.', 'Nothing here answers.', 'resolver debug', [absence]);
        const facts = { ...failed, lines: ['The physician returns your greeting.', ...failed.lines] };
        const prompt = composeNarrationUser(facts, {
            ...SCENE, place: 'the inn', company: aSquareWith([], 0),
            justAddressed: [{ ...physician, repliedAt: { place: 'the physician\'s clinic', area: 'clinic', day: 365001, hour: 10 } }]
        });
        expect(prompt).toContain('The physician returns your greeting.');
        expect(prompt).toContain(absence);
        expect(prompt).toContain('THE PEOPLE HERE: nobody');
        expect(prompt).toContain("Executed reply at the physician's clinic; day 365001, hour 10");
        expect(prompt).toContain('At reply time: seeing to patients.');
        expect(prompt).not.toContain('Right now: seeing to patients.');
        expect(prompt).not.toContain('Executed reply at the inn');
        expect(prompt).not.toContain('resolver debug');
        // Ordinary current cards retain their present-tense observation.
        expect(thePeopleHere({ named: [physician], strangers: [], total: 1 }, 0, [], null).join('\n'))
            .toContain('Right now: seeing to patients.');
    });

    /**
     * Model probe 05 still placed the physician in the final inn: the LAST
     * instruction said "Then play" the historical addressee despite correct
     * earlier cards. Pin that final instruction, including another actual
     * person in the final room. Missing company stays an opt-in contract:
     * callers that supply no roster have not asserted that somebody is absent.
     * Model09 still resumed an absent infirmary speaker's jar-counting after
     * the historical answer despite these earlier instructions. The endpoint
     * must carry actual current-roster and failed-address authority after the
     * style examples. These tests establish prompt facts, not model acceptance.
     */
    it('writes earlier replies before the actual final cast in the final instruction', () => {
        const physician = { ...aSquareWith(['Wei Ciyi'], 0).named[0], at: 'seeing to patients' };
        const earlier = [{ ...physician, repliedAt: { place: 'the clinic', area: 'clinic', day: 365001, hour: 10 } },
            { ...physician, repliedAt: { place: 'the bridge', area: 'bridge', day: 365001, hour: 16 } }];
        const suffix = (company?: Company, failedAddress = false) => {
            const prompt = composeNarrationUser(FACTS, { ...SCENE, addressing: physician.name, company, justAddressed: earlier, failedAddress });
            return prompt.slice(prompt.lastIndexOf('NOW WRITE THE TURN'));
        };
        for (const company of [aSquareWith([], 0), aSquareWith(['Tang Minya'], 0)]) {
            const final = suffix(company, true);
            expect(final).toContain('First play the executed reply captured at the clinic');
            expect(final).toContain('Next play the executed reply captured at the bridge');
            expect(final.indexOf('the clinic')).toBeLessThan(final.indexOf('the bridge'));
            expect(final).toContain('Then return to the actual current place and cast');
            expect(final).not.toContain(`Then play ${physician.name}`);
            expect(final).not.toContain('the likeliest one answers');
            expect(final).toContain('The failed address has no listener replying, refusing or providing care');
            expect(final).toContain('A historical speaker absent from that current roster has no new gesture, speech or resumed task at the end');
            expect(final).toContain('The unresolved address has no answer, refusal, gesture or treatment');
            expect(final.indexOf('FINAL MOMENT')).toBeGreaterThan(final.indexOf('turns back to the road'));
            if (company.total === 0) expect(final).toContain('Nobody is physically here with the player now');
            else expect(final).not.toContain('Nobody is physically here with the player now');
        }
        expect(suffix(aSquareWith([physician.name], 0))).toContain(`Then play ${physician.name}`);
        expect(suffix()).toContain(`Then play ${physician.name}`);
        expect(suffix()).not.toContain('FINAL MOMENT');
    });

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

    /**
     * Once somebody has been on the page in this place, the same picture of them is spent.
     * Played: a woman at an inn table was "her cold bowl" in seven turns of nine.
     */
    it('marks what somebody is at and what they are like as already shown', () => {
        const square = aSquareWith(['Wei Ciyi'], 0);
        expect(thePeopleHere(square, 0, [], null).join('\n')).toContain('Right now: haggling over a cracked jade slip.');
        const after = thePeopleHere(square, 0, [], null, new Set(), new Set(['Wei Ciyi'])).join('\n');
        expect(after).toContain('Already shown here - a new detail of it, or leave them out.');
        expect(after).toContain('already shown here - only ever in a new act');
    });

    /**
     * On the page turn after turn, they sit out. Played: a man "asking after a buyer by name,
     * loudly" shouted for his buyer four turns running with the card marked already shown.
     */
    it('hands over no activity for somebody on the page here turn after turn, unless spoken to', () => {
        const square = aSquareWith(['Wei Ciyi', 'Tang Minya'], 0);
        const worn = new Set(['Wei Ciyi']);
        const after = thePeopleHere(square, 0, [], null, new Set(), worn, worn);
        expect(after.join('\n')).not.toContain('haggling over a cracked jade slip');
        expect(after.join('\n')).toContain('leave them out unless this turn is theirs');
        // And they go to the back of the room.
        expect(after.findIndex(line => line.includes('Tang Minya')))
            .toBeLessThan(after.findIndex(line => line.includes('Wei Ciyi')));
        const spokenTo = thePeopleHere(square, 0, [], 'Wei Ciyi', new Set(), worn, worn).join('\n');
        expect(spokenTo).toContain('haggling over a cracked jade slip');
        expect(spokenTo).not.toContain('leave them out unless this turn is theirs');
    });

    /**
     * Weeks in one place are a new scene there. Played: after three months of sitting in a village
     * square, "Bai Shuxue is still eating standing up", because his card still said "still".
     */
    it('starts the place over when weeks have gone by in it', async () => {
        const provider = new ScriptedProvider({ plans: [], narrations: ['Wei Ciyi haggles.'] });
        const narrator = new ProviderNarrator(provider, { model: 'test' });
        const facts = { headline: 'x', lines: ['Nothing.'], structure: [], prose: '' };
        const standing = {
            rank: 'Qi Condensation Layer 1', age: 16, spiritStones: 30, booksHeld: [], methods: [],
            untreatedInjuries: 0, house: null
        };
        const on = (day: number) => narrator.narrate(facts, {
            ...SCENE, company: aSquareWith(['Wei Ciyi'], 0), standing: { ...standing, dayOfTheRun: day }
        } as never);
        const cardFor = (i: number) => provider.calls[i]!.messages.find(m => m.role === 'user')!.content;
        await on(0);
        await on(0);
        await on(90);
        expect(cardFor(1)).toContain('Right now, still: haggling over a cracked jade slip.');
        expect(cardFor(2)).toContain('Right now: haggling over a cracked jade slip.');
    });

    /**
     * The owner: talking to one person is a one-to-one roleplay; "if i need someone else, the
     * player ought to ask", and talking to anybody else, or to the room, hands the room back.
     */
    it('plays a conversation with one person as the two of them, and hands the room back after', () => {
        const square = aSquareWith(['Wei Ciyi', 'Tang Minya', 'Lu Qing'], 2);
        // People the player knows, so each card is headed by the name.
        const known = ['Wei Ciyi', 'Tang Minya', 'Lu Qing'].map((name, i) => ({
            kind: 'cultivator', id: `n${i}`, name, statement: `${name} worked the next field over.`,
            sourceKind: 'witnessed', sourceNote: ''
        })) as never;
        const cards = (acts: string[], lines = ['Wei Ciyi answers.']) => composeNarrationUser(
            { ...FACTS, lines }, { ...SCENE, company: square, addressing: 'Wei Ciyi', awareness: known }, { acts });
        const talk = cards(['interact']);
        expect(talk).toContain('- Wei Ciyi (THE PLAYER IS SPEAKING TO THEM)');
        expect(talk).not.toContain('- Tang Minya');
        expect(talk).not.toMatch(/faces the player cannot place/);
        expect(talk).toContain('Everybody else here is background');
        expect(talk.slice(talk.lastIndexOf('NOW WRITE THE TURN'))).toContain('Only the two of you are on the page');
        // Somebody the engine put in it stays in it.
        expect(cards(['interact'], ['Wei Ciyi answers.', 'Lu Qing laughs at him.'])).toContain('- Lu Qing');
        // A blow is not a conversation, and the next look is not either: the room is back.
        for (const acts of [['attack'], ['look'], []]) {
            const back = cards(acts);
            expect(back, acts.join()).toContain('- Tang Minya');
            expect(back, acts.join()).not.toContain('Only the two of you are on the page');
        }
    });

    /**
     * The owner: "you don't start with their names... you start with a description, like a man
     * in xyz (that falls out of their character sheet)... he introduces himself as abc".
     */
    it('asks for somebody new here to be seen before they are named, and only then', () => {
        const square = aSquareWith(['Wei Ciyi'], 0);
        const last = (shown: string[]) => {
            const text = composeNarrationUser(FACTS, { ...SCENE, company: square }, { alreadyShown: new Set(shown) });
            return text.slice(text.lastIndexOf('NOW WRITE THE TURN'));
        };
        expect(last([])).toContain('enters as the player first sees them');
        expect(last(['Wei Ciyi'])).not.toContain('enters as the player first sees them');
    });

    /**
     * The owner: "you don't know their name, you just see a jade beauty in red... hide the name
     * unless the player is sure this is them, cuz otherwise, they introduce themselves".
     */
    it('keeps a name off a face the player cannot be sure of', () => {
        const square = aSquareWith(['Wei Ciyi'], 0);
        const heard = [{ kind: 'cultivator', id: 'n1', name: 'Wei Ciyi', statement: 'Wei Ciyi is a name that got said.', sourceKind: 'overheard', sourceNote: 'A name that got said' }] as never;
        const met = [{ kind: 'cultivator', id: 'n1', name: 'Wei Ciyi', statement: 'Wei Ciyi worked the next field over.', sourceKind: 'witnessed', sourceNote: '' }] as never;
        const unsure = composeNarrationUser(FACTS, { ...SCENE, company: square, awareness: heard });
        expect(unsure).toContain('A FACE WITH NO NAME TO IT YET');
        // Headed by how they look, and the name only for the rulings.
        expect(unsure).not.toMatch(/^- Wei Ciyi:/m);
        expect(unsure).toMatch(/^- (?:a man|a woman|somebody)[^\n]*the rulings call them Wei Ciyi/m);
        // A look at the square writes everybody in it as witnessed, and that is still not a name
        // put to a face. Played: "This is Mo Anlu", for three strangers, the turn after a look.
        const seen = [{ kind: 'cultivator', id: 'n1', name: 'Wei Ciyi', statement: 'Wei Ciyi is a name that got said. What it is remains unknown.', sourceKind: 'witnessed', sourceNote: 'Standing in the same place, in plain sight.' }] as never;
        expect(composeNarrationUser(FACTS, { ...SCENE, company: square, awareness: seen })).toContain('A FACE WITH NO NAME TO IT YET');
        // Nor on somebody else's card. Played: "Ties to others here: child of Jiang Rongru", and the
        // innkeeper was named on the page.
        const family = aSquareWith(['Wei Ciyi', 'Tang Minya'], 0);
        (family.named[1] as { tiesHere?: unknown }).tiesHere = [{ kind: 'child', name: 'Wei Ciyi' }];
        const tied = thePeopleHere(family, 0, [], null).join('\n');
        // Chronological age is not a visible description of an unfamiliar face.
        expect(tied).toMatch(/Ties to others here: child of (?:a man|somebody)/);
        expect(tied).not.toMatch(/child of [^\n]*\b40\b/);
        expect(tied).not.toMatch(/child of Wei Ciyi/);
        expect(unsure).not.toContain('A name that got said');
        expect(unsure.slice(unsure.indexOf('NAMES YOU MAY USE'))).not.toMatch(/^[^\n]*\n[^\n]*Wei Ciyi/);
        expect(composeNarrationUser(FACTS, { ...SCENE, company: square, awareness: met })).not.toContain('A FACE WITH NO NAME TO IT YET');
        // Said by the player, right or wrong, it is theirs to have said.
        expect(composeNarrationUser(FACTS, { ...SCENE, company: square, awareness: heard, playerSaid: 'Wei Ciyi, a word' }))
            .not.toContain('A FACE WITH NO NAME TO IT YET');
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
        expect(narrationSystemPrompt().toLowerCase()).toMatch(/an absence is the engine's\s+to state/);
    });

    /**
     * The gap between the player and the person spoken to rides on the last instruction too.
     * Played: told to kneel, a man two realms down answered "without a hint of hesitation".
     */
    it('ends on how the person spoken to stands, when it is a realm or more', () => {
        const square = aSquareWith(['Wei Ciyi'], 0);
        const far = composeNarrationUser(
            FACTS as never, { ...SCENE, company: square, addressing: 'Wei Ciyi', realmOrdinal: 28 }
        );
        expect(far.slice(far.lastIndexOf('NOW WRITE THE TURN'))).toMatch(/They stand far below you/);
        const level = composeNarrationUser(
            FACTS as never, { ...SCENE, company: square, addressing: 'Wei Ciyi', realmOrdinal: 3 }
        );
        expect(level.slice(level.lastIndexOf('NOW WRITE THE TURN'))).not.toMatch(/They stand/);
    });

    /** Opt-in, the way `filed` and `hearing` are: no roster is not an empty room. */
    it('says nothing about the room when the caller did not pass one', () => {
        const prompt = composeNarrationUser(FACTS as never, { ...SCENE });
        expect(prompt).not.toContain('THE PEOPLE HERE');
    });
});
