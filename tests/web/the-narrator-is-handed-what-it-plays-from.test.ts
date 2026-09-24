/**
 * What the engine hands the narrator so it can play the world, rather than report it.
 *
 * Found by playing on gemma4:31b: the opening recited stall prices and intake bars in the one
 * turn that is about who somebody is; a follow-up question was answered by somebody with no
 * memory of the turn before; and a line the engine requires was always appended verbatim
 * under the prose, because the prompt forbade the narrator the engine's wording.
 */
import { describe, expect, it } from 'vitest';

import { composeNarrationUser, theSeasonOn, whereTheyStandNow } from '../../src/web/prompt';
import { whatTheQuestionAsks } from '../../src/web/a-sentence-can-be-more-than-one-call';
import { ProviderNarrator } from '../../src/web/narrator';
import { makeGameInWorld, ScriptedProvider } from './harness';

const narrationPrompts = (provider: ScriptedProvider) => provider.calls
    .filter(call => !(call.messages.find(m => m.role === 'system')?.content ?? '')
        .startsWith('You are the intent router'))
    .map(call => call.messages.find(m => m.role === 'user')?.content ?? '');

describe('the opening is a life and a place, not a catalogue', () => {
    it('files what is live as its own entry and keeps it out of the opening narration', async () => {
        const provider = new ScriptedProvider({ plans: [], narrations: ['Sixteen years of grey dirt.'] });
        const { game } = await makeGameInWorld({ worldSeed: 'a-xianxia-run', seed: 'xianxia', provider });
        await game.newRun('Shen Wuyou');

        const opening = narrationPrompts(provider)[0]!;
        const facts = opening.slice(opening.indexOf('WHAT THE ENGINE RULED'));
        // Pinned world: this square has a stall and dated intakes, so the check is not vacuous.
        const engine = game.state().log.filter(entry => entry.role === 'engine').map(entry => entry.text);
        const live = engine.find(text => /intake|stall/i.test(text));
        expect(live, 'the pinned square has something live on it').toBeDefined();
        expect(facts).not.toMatch(/is holding an intake|A stall here/);
        expect(opening).toContain('THE LIFE BEHIND THIS CULTIVATOR');
    });

    /**
     * The owner: "it shouldn't give ANYONE speech at the first turn, the first turn is special,
     * it's exposition only". Played before: two paragraphs of life, then the square's cards played
     * in card order with a quoted speech in them. The opening is handed no cast, and its last
     * instruction says nobody speaks.
     */
    it('hands the opening no cast and says nobody speaks on it', async () => {
        const provider = new ScriptedProvider({ plans: ['{"action":"look"}'], narrations: ['The years.', 'A look.'] });
        const { game } = await makeGameInWorld({ worldSeed: 'a-xianxia-run', seed: 'xianxia', provider });
        await game.newRun('Shen Wuyou');
        await game.act('I look around');

        const [opening, look] = narrationPrompts(provider);
        expect(opening).not.toContain('THE PEOPLE HERE');
        expect(opening!.slice(opening!.lastIndexOf('NOW WRITE THE TURN'))).toContain('NOBODY SPEAKS ON THIS TURN');
        expect(look).toContain('THE PEOPLE HERE');
        expect(look).not.toContain('NOBODY SPEAKS ON THIS TURN');
    });
});

describe('a conversation carries over', () => {
    it('hands the narrator the turn before, and not on the opening', async () => {
        const provider = new ScriptedProvider({
            plans: ['{"action":"look"}', '{"action":"look"}'],
            narrations: ['The opening.', '"Fifteen," the stallholder says.', 'Later.']
        });
        const { game } = await makeGameInWorld({ worldSeed: 'a-xianxia-run', seed: 'xianxia', provider });
        await game.newRun('Shen Wuyou');
        await game.act('I look around');
        await game.act('I look around');

        const [opening, first, second] = narrationPrompts(provider);
        expect(opening).not.toContain('THE TURN BEFORE');
        expect(first).toContain('THE TURN BEFORE');
        expect(second).toContain('THE TURN BEFORE');
        expect(second).toContain('"Fifteen," the stallholder says.');
        expect(second).toContain('The player: "I look around"');
    });
});

describe('a line the engine requires is asked for, not appended', () => {
    it('puts required lines in their own block to be said word for word', () => {
        const message = composeNarrationUser(
            {
                headline: 'x',
                lines: ['Nothing accumulates.'],
                structure: [],
                prose: '',
                required: ['No cultivation method, so nothing accumulates however long you sit.']
            },
            { place: 'Wind Turn', ambient: 'thin' }
        );
        const at = message.indexOf('SAY THESE WORD FOR WORD');
        expect(at).toBeGreaterThan(-1);
        expect(message.slice(at)).toContain('- No cultivation method, so nothing accumulates however long you sit.');
    });
});

describe('the people in the square reach the narrator as people', () => {
    it('hands over a card for somebody standing there, with what they are at', async () => {
        const provider = new ScriptedProvider({ plans: ['{"action":"look"}'], narrations: ['x', 'y'] });
        const { game } = await makeGameInWorld({ worldSeed: 'a-xianxia-run', seed: 'xianxia', provider });
        await game.newRun('Shen Wuyou');
        await game.act('I look around');

        const prompt = narrationPrompts(provider).at(-1)!;
        expect(prompt).toContain('THE PEOPLE HERE');
        expect(prompt).toMatch(/Right now: /);
    });
});

/**
 * Played: three new lives in a row, two of them women, were all called "boy" by the people who
 * raised them. Nothing told the narrator, and it guessed.
 */
describe('the narrator is told whether the player is a woman or a man', () => {
    const standing = {
        rank: 'Qi Condensation Layer 1', age: 16, spiritStones: 30, booksHeld: [], methods: [],
        untreatedInjuries: 0, house: null
    };

    it('says so on the standing line', () => {
        expect(whereTheyStandNow({ ...standing, sex: 'female' })).toContain('- a woman, Qi Condensation Layer 1, 16 years old, no house behind them');
        expect(whereTheyStandNow({ ...standing, sex: 'male' })).toContain('- a man, Qi Condensation Layer 1, 16 years old, no house behind them');
    });

    it('says nothing when the caller did not know', () => {
        expect(whereTheyStandNow(standing)).toContain('- Qi Condensation Layer 1, 16 years old, no house behind them');
    });
});

/**
 * The engine has no seasons, and a model handed none writes a different one at every gate. The
 * prompt reads one off the run's day, so a whole life keeps to a calendar.
 */
describe('the scene carries a season read off the day', () => {
    it('turns the year from early spring', () => {
        expect(theSeasonOn(0)).toBe('early spring');
        expect(theSeasonOn(100)).toBe('early summer');
        expect(theSeasonOn(364)).toBe('late winter');
        expect(theSeasonOn(365)).toBe('early spring');
    });

    it('puts it in the scene, and only when the day is known', () => {
        const facts = { headline: 'x', lines: ['Wind Turn.'], structure: [], prose: '' };
        const standing = {
            rank: 'Qi Condensation Layer 1', age: 16, spiritStones: 30, booksHeld: [], methods: [],
            untreatedInjuries: 0, house: null
        };
        const on = composeNarrationUser(facts, { place: 'Wind Turn', ambient: 'thin', standing: { ...standing, dayOfTheRun: 200 } });
        expect(on).toContain('The season: early autumn.');
        const off = composeNarrationUser(facts, { place: 'Wind Turn', ambient: 'thin', standing });
        expect(off).not.toContain('The season:');
    });
});

/**
 * Played: a curse at a square got the player beaten to nothing and dead by the next day, and the
 * narration ended with them in the dirt and the square walking off. The death was one ruling of
 * thirty; now the turn's last instruction says so.
 */
describe('a death is the last thing a turn says', () => {
    const facts = { headline: 'x', lines: ['Shen Wuyou is dead: killed in combat.'], structure: [], prose: '' };
    const standing = {
        rank: 'Qi Condensation Layer 1', age: 16, spiritStones: 0, booksHeld: [], methods: [],
        untreatedInjuries: 2, house: null
    };

    it('ends the prompt on the death when the life ended this turn', () => {
        const message = composeNarrationUser(facts, { place: 'Wind Turn', ambient: 'thin', standing: { ...standing, dead: true } });
        expect(message.slice(message.lastIndexOf('NOW WRITE THE TURN'))).toContain('THE PLAYER DIED THIS TURN');
    });

    it('says nothing of the kind otherwise', () => {
        const message = composeNarrationUser(facts, { place: 'Wind Turn', ambient: 'thin', standing });
        expect(message).not.toContain('THE PLAYER DIED THIS TURN');
    });
});

/**
 * Played: the engine ran neither of two acts and asked which came first, and the narration read
 * out a task from the board anyway - a different invented task in each of three runs.
 */
describe('a turn that ran nothing is written stopping at the start', () => {
    const question = whatTheQuestionAsks({
        runId: 'r', cultivatorId: 'c', raisedOnTurn: 1,
        acts: [
            { action: { action: 'move', target: 'board' }, said: 'I go over to the board' },
            { action: { action: 'sect' }, said: 'read the task posted for someone of my standing' }
        ]
    } as never);
    const facts = (required: string[]) => ({ headline: 'x', lines: ['Both take time.'], structure: [], prose: '', required });
    const lastLine = (message: string) => message.slice(message.lastIndexOf('NOW WRITE THE TURN'));

    it('says nothing ran when the engine asks which comes first', () => {
        expect(lastLine(composeNarrationUser(facts([question]), { place: 'Plum Village', ambient: 'normal' })))
            .toContain('NOTHING RAN THIS TURN');
    });

    it('says nothing of the kind on an ordinary turn', () => {
        expect(composeNarrationUser(facts([]), { place: 'Plum Village', ambient: 'normal' }))
            .not.toContain('NOTHING RAN THIS TURN');
    });

    /**
     * Played: "I cultivate until the day of the intake" was ruled no time passed, and the narration
     * sat the player until their legs went numb.
     */
    it('says no time passed only when a ruling refused the time and the day did not move', async () => {
        const provider = new ScriptedProvider({ plans: [], narrations: ['x'] });
        const narrator = new ProviderNarrator(provider, { model: 'test' });
        const standing = (day: number) => ({
            rank: 'Qi Condensation Layer 1', age: 16, spiritStones: 30, booksHeld: [], methods: [],
            untreatedInjuries: 0, house: null, dayOfTheRun: day
        });
        const refused = { headline: 'x', lines: ['Nothing written, no time passed.'], structure: [], prose: '' };
        const scene = (day: number) => ({ place: 'Willow Village', ambient: 'thin', standing: standing(day) }) as never;
        await narrator.narrate(refused, scene(3));
        await narrator.narrate(refused, scene(3));
        await narrator.narrate(refused, scene(40));
        const last = (i: number) => lastLine(provider.calls[i]!.messages.find(m => m.role === 'user')!.content);
        expect(last(1)).toContain('NO TIME PASSED THIS TURN');
        // Another step of the turn took the days, so it is not said.
        expect(last(2)).not.toContain('NO TIME PASSED THIS TURN');
    });
});

/**
 * Played on a parting, "Grandfather, I leave with the caravan tomorrow": the man who raised the
 * player stood like stone and turned his back in six runs of six, with the family rule in the
 * system prompt. The tie rides on the last instruction, where it cracked him in three of three.
 */
describe('whoever raised the player is played as the one who did, on the last line', () => {
    const facts = { headline: 'x', lines: ['He Xuxue hears you out.'], structure: [], prose: '' };
    const person = (name: string) => ({
        name, ordinal: 5, sex: 'male', age: 70, rank: null, at: 'in an inn, eating', looksUp: false,
        playsToTheRoom: 0, withNames: [], like: null
    });
    const knows = (name: string, statement: string) => ({
        kind: 'cultivator', id: `npc-${name}`, name, statement, stance: 'neutral',
        sourceKind: 'witnessed', sourceNote: '', acquiredOnDay: 0, stage: 'known'
    });
    const scene = (statement: string) => ({
        place: 'Willow Village', ambient: 'thin', addressing: 'He Xuxue',
        company: { named: [person('He Xuxue')], strangers: [], total: 1 },
        awareness: [knows('He Xuxue', statement)]
    }) as unknown as Parameters<typeof composeNarrationUser>[1];
    const lastLine = (message: string) => message.slice(message.lastIndexOf('NOW WRITE THE TURN'));

    it('says the tie and what breaks through at a parting', () => {
        const last = lastLine(composeNarrationUser(facts, scene('He Xuxue is family, and raised you.')));
        expect(last).toContain('He Xuxue raised you.');
        expect(last).toContain('When you are leaving, hurt or dying');
    });

    /**
     * Said on every turn, "flat for small things" took the loud lines out of ordinary talk. The
     * all-the-way line is for a turn a life turns on: a crossing or a death. A word to whoever
     * raised you carries its own condition on the family clause, and is not one by itself.
     */
    it('asks for the feeling to go all the way only on a turn a life turns on', () => {
        const at = (extra: object) => lastLine(composeNarrationUser(facts, { ...scene('He Xuxue is from home. Knowing them is not the same as being owed anything by them.'), ...extra } as never));
        expect(at({})).not.toContain('A life turns on this turn');
        expect(at({ filed: { breakthroughAttempted: true } })).toContain('A life turns on this turn');
        expect(at({ filed: { died: true } })).toContain('A life turns on this turn');
        expect(lastLine(composeNarrationUser(facts, scene('He Xuxue is family, and raised you.'))))
            .not.toContain('A life turns on this turn');
    });

    it('says it of a sibling too, and of nobody merely from home', () => {
        expect(lastLine(composeNarrationUser(facts, scene('He Xuxue is family, and grew up under the same roof as you.'))))
            .toContain('He Xuxue grew up under the same roof as you.');
        expect(lastLine(composeNarrationUser(facts, scene('He Xuxue is from home. Knowing them is not the same as being owed anything by them.'))))
            .not.toContain('When you are leaving');
    });
});
