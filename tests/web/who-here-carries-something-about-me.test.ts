/**
 * The game worked out who was glad to see you every single turn and had no
 * sentence for asking.
 *
 * FOUND BY PLAYING, in the social sweep. Measured against the real parser:
 *
 *     who likes me        -> UNCLEAR
 *     who hates me        -> UNCLEAR
 *     who trusts me       -> UNCLEAR
 *     who resents me      -> UNCLEAR
 *     am I liked here     -> UNCLEAR
 *     who are my friends  -> investigate, for a PERSON called "my friends"
 *     who are my enemies  -> investigate, for a PERSON called "my enemies"
 *
 * The last two are the worse pair, because they did not fail: the question was
 * understood as somebody's NAME and answered with a failed lookup for a person
 * called "my enemies".
 *
 * ── IT WAS ALL THERE, EVERY TURN ─────────────────────────────────────────
 *
 * `whatTheSquareFeelsAbout` runs on every turn and hands the narrator a clause
 * per person through the scene channel. `whatTheyFeelAboutYou` derives it off
 * the obligation ledger at the moment of asking, and `howTheyCarryIt` puts it
 * into one observable clause. Three shipped functions, wired end to end, and
 * the player could not ask the question they answer.
 *
 * ── WHAT THE READ MAY SAY ────────────────────────────────────────────────
 *
 * Only what somebody in the room could see. `howTheyCarryIt` was already
 * written to that rule and states it in its own header - *observable, never
 * interior: nobody sees despondency, they see somebody who has stopped keeping
 * up appearances* - so this hands those clauses over unchanged.
 *
 * And it is a read of FACES, not of records. It sees the people standing here
 * and nothing else, and only what has actually passed between them and this
 * cultivator. An empty answer therefore means *nobody here is showing
 * anything*, which is not *nobody here has anything against you*, and the read
 * says which of the two it means rather than letting the player take the
 * stronger one.
 *
 * ── AND THE FOUR QUESTIONS STANDING NEXT TO IT ───────────────────────────
 *
 * This branch sits in a stretch of the table where five questions differ only
 * in what they are about, and the near-synonym trap here is total: *who is the
 * strongest here* reads the ladder, *who leads this house* reads the house,
 * *what am I owed* reads the ledger, *what do people think of me* reads
 * standing, and only these name the ASKER as the thing being felt about. All
 * five are pinned together, because a widening that takes one of the other
 * four is the failure this branch is most likely to have.
 */

import { describe, it, expect } from 'vitest';

import { parseIntent } from '../../src/web/verb-pattern-table';
import { factsForHowTheyCarryYou } from '../../src/web/facts';
import type { Cultivator } from '../../src/schema/cultivation';

const HERE = { location: 'Nine Reed Ford' } as unknown as Cultivator;

describe('asking who here carries something about you', () => {
    it.each([
        'who likes me',
        'who hates me',
        'who trusts me',
        'who distrusts me',
        'who resents me',
        'who fears me',
        'who respects me',
        'who would help me',
        'who is friendly to me',
        'who has it in for me',
        'who are my friends',
        'who are my enemies',
        'my enemies',
        'am I liked here',
        'am I welcome here',
        'are we trusted here'
    ])('%j reaches the read that answers it', said => {
        expect(parseIntent(said)).toEqual({ action: 'look', intent: 'warmth' });
    });

    /**
     * THE FOUR NEXT DOOR. Each is a different question with much of the same
     * vocabulary, and each already had a home.
     */
    it.each([
        ['who is the strongest here', 'look', 'company'],
        ['who leads this house', 'sect', 'standing'],
        ['what do people think of me', 'sect', 'standing'],
        ['who owes me', 'oath', 'read'],
        ['what am I owed', 'oath', 'read']
    ])('%j still reaches %s/%s', (said, action, intent) => {
        const parsed = parseIntent(said);
        expect(parsed?.action).toBe(action);
        expect(parsed?.intent).toBe(intent);
    });

    /**
     * AND THE BARE PHRASE IS A NOUN THE REST OF THE TIME. `my friends` at the
     * head of a sentence about going somewhere is not this question, and the
     * first cut of this branch took it. Anchored, on the shape
     * `WHAT_IS_WRITTEN_BETWEEN_US` already uses for `my debts`.
     */
    it.each([
        'I go to my friends the Azure Dew Sect',
        'I tell my friends what happened',
        'I warn my enemies off this ground'
    ])('%j is not the question', said => {
        expect(parseIntent(said)?.intent).not.toBe('warmth');
    });
});

describe('what the read is allowed to say', () => {
    const carrying = (id: string): string | null =>
        id === 'npc-1'
            ? 'They remember a small kindness from this one and it has not worn off.'
            : null;

    it('names the people who show something and nobody else', () => {
        const facts = factsForHowTheyCarryYou(
            HERE,
            [{ id: 'npc-1', name: 'Shen Liefeng' }, { id: 'npc-2', name: 'Ning Suiru' }],
            carrying
        );
        expect(facts.lines.join(' ')).toContain('Shen Liefeng');
        expect(facts.lines.join(' ')).not.toContain('Ning Suiru');
    });

    /**
     * NOTHING SHOWING IS NOT NOTHING FELT, and the difference is the whole
     * honesty of the read. A player told "nobody here has anything against
     * you" would walk into the one person who does.
     */
    it('says that an empty answer is about what shows, not about what is felt', () => {
        const facts = factsForHowTheyCarryYou(
            HERE,
            [{ id: 'npc-2', name: 'Ning Suiru' }],
            carrying
        );
        const said = facts.lines.join(' ');
        expect(said).toContain('shows');
        expect(said).toContain('never gave them');
    });

    it('says so plainly when there is nobody here at all', () => {
        const facts = factsForHowTheyCarryYou(HERE, [], carrying);
        expect(facts.lines[0]).toContain('nobody here');
    });

    /**
     * AND THE CAVEAT IS THERE EVEN WHEN THE ANSWER IS FULL, because a list of
     * three people who show something is just as far from a list of everybody
     * who feels something.
     */
    it('carries the caveat whether or not anybody showed anything', () => {
        const full = factsForHowTheyCarryYou(
            HERE, [{ id: 'npc-1', name: 'Shen Liefeng' }], carrying
        );
        expect(full.lines.join(' ')).toContain('never gave them');
    });
});
