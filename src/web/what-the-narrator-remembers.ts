/**
 * WHAT THE NARRATOR REMEMBERS PAST THE LAST FEW TURNS.
 *
 * Every narration is built fresh: the model holds nothing between turns, and what it is handed of
 * the past is the turn before, the last few exchanges with whoever is being spoken to, and what
 * this file has kept of the rest. Nothing is dropped. The owner: "i'd rather it compacts and takes
 * longer". What would fall out of the window is folded by the model into a short record first.
 *
 * Two records: the story so far, so a turn does not contradict what the player has already read,
 * and each conversation, so somebody spoken to a week ago still knows what was said. Both are a
 * memory of what was READ. The engine still holds what is true, and the prompt says so.
 */
import { inTheCharactersThePatternsUse } from './sentence-parts.js';
import { type SaidAloud, saidAloudLines } from './prompt.js';

/** How a record is asked for. The first words are how a test provider tells the call apart. */
export const A_RECORD_IS_KEPT = [
    'You keep the record of a text roleplaying game, so that what happened in it is remembered',
    'after the words themselves are gone.',
    '',
    '- Plain sentences in the past tense. Keep what was asked, told, promised, refused, owed, given',
    '  or taken, who was met and where, and how people took to the player.',
    '- Only what is in what you are given. Add nothing, guess at nothing, and describe no faces,',
    '  places or weather.',
    '- Write the record and nothing else: no heading, no preamble, no list.'
].join('\n');

/** The most a conversation's record runs to. What matters to the next conversation stays. */
export const A_CONVERSATION_RECORD_WORDS = 120;

/** The most the story's record runs to. What is long over shrinks to a clause. */
export const THE_STORY_RECORD_WORDS = 250;

/** The most of one turn's prose handed to the story's record. The end is where it landed. */
const A_TURN_FOR_THE_RECORD_CHARS = 1500;

/**
 * The call that folds exchanges with one person into that conversation's record. Their name is
 * not used, because the player may not know it; see `thePlayerIsSureItIsThem`.
 */
export function composeConversationRecord(record: string | null, exchanges: readonly SaidAloud[]): string {
    return [
        'THE RECORD OF ONE CONVERSATION, between the player and one other person, who is "they" in it.',
        '',
        'Already on the record:',
        record ?? '(nothing yet)',
        '',
        'Said since, oldest first:',
        ...saidAloudLines(exchanges),
        '',
        `Rewrite the record to take in what was said since, in at most ${A_CONVERSATION_RECORD_WORDS} words.`,
        'Keep what would matter the next time they speak; let small talk go.'
    ].join('\n');
}

/** The call that folds read turns into the story's record. */
export function composeStoryRecord(
    record: string | null,
    turns: readonly { said: string | null; shown: string }[]
): string {
    return [
        'THE RECORD OF THE STORY SO FAR, as the player has read it.',
        '',
        'Already on the record:',
        record ?? '(nothing yet)',
        '',
        'Read since, oldest first:',
        ...turns.flatMap(turn => [
            ...(turn.said ? [`The player: "${turn.said}"`] : []),
            turn.shown.length > A_TURN_FOR_THE_RECORD_CHARS
                ? `...${turn.shown.slice(-A_TURN_FOR_THE_RECORD_CHARS)}`
                : turn.shown,
            ''
        ]),
        `Rewrite the record to take in what was read since, in at most ${THE_STORY_RECORD_WORDS} words.`,
        'The latest matters most; what is long over may shrink to a clause.'
    ].join('\n');
}

/**
 * A record as the model wrote it, in this repo's characters and held to its length. A record
 * that runs long is cut at a sentence, so the next fold starts from something whole.
 */
export function theRecordAsWritten(text: string, words: number): string | null {
    const plain = inTheCharactersThePatternsUse(text.trim()).replace(/^#+\s.*\n+/, '');
    if (plain.length === 0) return null;
    const all = plain.split(/\s+/);
    if (all.length <= words * 1.5) return plain;
    const cut = all.slice(0, Math.round(words * 1.5)).join(' ');
    const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    return /[.!?]$/.test(cut) || lastStop <= 0 ? cut : cut.slice(0, lastStop + 1);
}
