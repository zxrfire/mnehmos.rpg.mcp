/**
 * A conversation longer than two turns keeps its beginning.
 *
 * The narrator was handed the turn before and nothing behind it, so whoever the player was
 * talking to could not refer back to what they had said three turns ago. The owner asked for the
 * last few exchanges with whoever the player is talking to. What comes back is the words said
 * aloud and not the prose around them, because the model copies its own earlier turns.
 */
import { describe, expect, it } from 'vitest';

import { ProviderNarrator } from '../../src/web/narrator';
import { whatWasSaidAloud } from '../../src/web/prompt';
import { ScriptedProvider } from './harness';

const FACTS = {
    headline: 'Talk.',
    lines: ['The player spoke.'],
    structure: [],
    prose: 'The player spoke.',
    required: []
} as never;

const at = (addressing: string | null, playerSaid: string) =>
    ({ place: 'Wind Turn', ambient: 'thin' as const, addressing, playerSaid });

const narrationPrompts = (provider: ScriptedProvider) =>
    provider.calls.map(call => call.messages.find(m => m.role === 'user')?.content ?? '');

describe('what was said aloud with somebody', () => {
    it('hands back the earlier words with the same person, and not the room turn between', async () => {
        const provider = new ScriptedProvider({
            narrations: [
                'The ferryman leans on his pole. "Three coppers to cross, and the river takes the rest."',
                'He spits over the side. "My daughter went downriver in spring. Nobody came back up."',
                'The landing goes on with its loading.',
                'He looks at you again.'
            ]
        });
        const narrator = new ProviderNarrator(provider, { model: 'test' });
        await narrator.narrate(FACTS, at('Lu Hanbo', 'how much to cross?'));
        await narrator.narrate(FACTS, at('Lu Hanbo', 'where is your family?'));
        await narrator.narrate(FACTS, at(null, 'does anybody here know the river?'));
        await narrator.narrate(FACTS, at('Lu Hanbo', 'what was her name?'));

        const fourth = narrationPrompts(provider)[3]!;
        const earlier = fourth.slice(fourth.indexOf('EARLIER WITH THE ONE BEING SPOKEN TO'), fourth.indexOf('THE TURN BEFORE'));
        expect(earlier).toContain('- The player: "how much to cross?"');
        expect(earlier).toContain('"Three coppers to cross, and the river takes the rest."');
        expect(earlier).toContain('"My daughter went downriver in spring. Nobody came back up."');
        // The words, not the gesture around them, and no name the player may not know.
        expect(earlier).not.toContain('leans on his pole');
        expect(earlier).not.toContain('Lu Hanbo');
        // The room's turn is the turn before, handed over whole as always, and is not his.
        expect(earlier).not.toContain('does anybody here know the river?');
        expect(fourth).toContain('The landing goes on with its loading.');
    });

    it('hands nothing back for somebody the player has not spoken with, or for the room', async () => {
        const provider = new ScriptedProvider({ narrations: ['"Three coppers," he says.', '"Who asks?" she says.', 'The room.'] });
        const narrator = new ProviderNarrator(provider, { model: 'test' });
        await narrator.narrate(FACTS, at('Lu Hanbo', 'how much to cross?'));
        await narrator.narrate(FACTS, at('Tang Xuxue', 'and you?'));
        await narrator.narrate(FACTS, at(null, 'anybody?'));

        const [, second, third] = narrationPrompts(provider);
        expect(second).not.toContain('EARLIER WITH THE ONE BEING SPOKEN TO');
        expect(third).not.toContain('EARLIER WITH THE ONE BEING SPOKEN TO');
    });

    it('starts over with a new life', async () => {
        const provider = new ScriptedProvider({ narrations: ['"Three coppers."', '"Four, then."', 'The years.', '"Who?"'] });
        const narrator = new ProviderNarrator(provider, { model: 'test' });
        await narrator.narrate(FACTS, at('Lu Hanbo', 'how much?'));
        await narrator.narrate(FACTS, at('Lu Hanbo', 'too much'));
        await narrator.narrate(FACTS, { ...at(null, ''), theLifeBehindThem: ['Sixteen years of grey dirt.'] } as never);
        await narrator.narrate(FACTS, at('Lu Hanbo', 'how much?'));

        expect(narrationPrompts(provider)[3]).not.toContain('EARLIER WITH THE ONE BEING SPOKEN TO');
    });
});

/**
 * The owner: "it's gonna start dropping old messages and i'd rather it compacts and takes longer".
 * Nothing drops: what no longer comes back whole is folded into a record first.
 */
describe('what no longer comes back whole is folded, not dropped', () => {
    const turn = (n: number) => `Turn ${n} happened. "Line ${n}," somebody says.`;

    it('folds the turns behind the turn before into the story so far', async () => {
        const provider = new ScriptedProvider({ narrations: [1, 2, 3, 4, 5, 6].map(turn) });
        const narrator = new ProviderNarrator(provider, { model: 'test' });
        for (let n = 1; n <= 6; n++) await narrator.narrate(FACTS, at(null, `act ${n}`));

        expect(provider.records).toHaveLength(1);
        const asked = provider.records[0]!.messages.find(m => m.role === 'user')!.content;
        for (const n of [1, 2, 3, 4]) expect(asked).toContain(turn(n));
        expect(asked).not.toContain(turn(5));

        const sixth = narrationPrompts(provider)[5]!;
        expect(sixth).toContain('THE STORY SO FAR');
        expect(sixth).toContain('The record, folded 1 times.');
        expect(sixth).not.toContain('act 1');
        expect(sixth).toContain(turn(5));
    });

    it('folds a long conversation into its record and keeps the last words whole', async () => {
        const provider = new ScriptedProvider({ narrations: [1, 2, 3, 4, 5, 6, 7, 8].map(turn) });
        const narrator = new ProviderNarrator(provider, { model: 'test' });
        for (let n = 1; n <= 8; n++) await narrator.narrate(FACTS, at('Lu Hanbo', `question ${n}`));

        const eighth = narrationPrompts(provider)[7]!;
        const earlier = eighth.slice(eighth.indexOf('EARLIER WITH THE ONE BEING SPOKEN TO'), eighth.indexOf('THE TURN BEFORE'));
        expect(earlier).toMatch(/Longer ago, in short: The record, folded \d+ times\./);
        expect(earlier).not.toContain('question 4');
        expect(earlier).toContain('question 5');
        expect(earlier).toContain('question 6');
        const conversationFold = provider.records.map(call => call.messages.find(m => m.role === 'user')!.content)
            .find(asked => asked.startsWith('THE RECORD OF ONE CONVERSATION'))!;
        expect(conversationFold).toContain('- The player: "question 1"');
        expect(conversationFold).toContain('"Line 1,"');
        expect(conversationFold).not.toContain('Lu Hanbo');
    });

    it('keeps the turns when a record cannot be written, rather than lose them', async () => {
        class NoRecords extends ScriptedProvider {
            override async call(opts: Parameters<ScriptedProvider['call']>[0]) {
                if (opts.messages[0]!.content.startsWith('You keep the record')) throw new Error('down');
                return super.call(opts);
            }
        }
        const provider = new NoRecords({ narrations: [1, 2, 3, 4, 5, 6].map(turn) });
        const narrator = new ProviderNarrator(provider, { model: 'test' });
        for (let n = 1; n <= 6; n++) await narrator.narrate(FACTS, at(null, `act ${n}`));

        const sixth = narrationPrompts(provider)[5]!;
        expect(sixth).toContain('- The player: "act 1"');
        expect(sixth).toContain('"Line 1,"');
    });
});

describe('the words said aloud in a turn', () => {
    it('keeps the latest lines when a turn said more than fits', () => {
        const long = 'x'.repeat(400);
        const lines = whatWasSaidAloud(`"${long}a" he says. "${long}b" she says. "last."`);
        expect(lines.at(-1)).toBe('last.');
        expect(lines.join('').length).toBeLessThanOrEqual(600 + 'last.'.length);
        expect(lines).not.toContain(`${long}a`);
    });
});
