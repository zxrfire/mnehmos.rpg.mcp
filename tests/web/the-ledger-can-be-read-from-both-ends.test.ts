/**
 * THE LEDGER, ASKED ABOUT.
 *
 * `AGENTS.md`: every read runs both ways unless there is a reason it cannot.
 *
 * The obligation ledger is written from everywhere - a landed approach leaves a
 * favour, a refused one a grudge, a bout past what was agreed a blood feud, a
 * word given an oath - and `whatYouBringToBear` prices those rows on every
 * later approach. The only sentence that reached any of it was `oath` with
 * intent `read`, which lists `openOathsHeldBy`: oaths THE PLAYER SWORE. One
 * kind out of five, one direction out of two.
 *
 * Measured on the played corpus before this, every one of these was `unclear`:
 *
 *     what am I owed          who owes me           what do I owe
 *     what does he owe me     what stands between me and him
 *
 * So a grudge the world had written down, and would charge the player for on
 * every approach to the person carrying it, was a thing the player could not
 * ask about in any words at all.
 *
 * ADMIN sets a rung and puts somebody there. Every row read back was written by
 * an ordinary verb.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/actions';
import { makeGameInWorld } from './harness';
import { howFarOff } from '../../src/web/facts';
import { SEVERITY_IN_WORDS, whichWayItPoints } from '../../src/engine/social/grudges';
import {
    theLedgerAsLines,
    whatStandsBetweenYouAndEverybody
} from '../../src/web/what-stands-between-you-and-everybody';

function said(result: unknown): string {
    return String((result as { narration?: string }).narration ?? '');
}

describe('how far off a due day is', () => {
    // The line read `${Math.round(days / 365)} year(s) off`, so a debt falling
    // due next season was "0 year(s) off" and a debt falling due tomorrow said
    // the same thing.
    it('says the distance, in the words somebody uses for it', () => {
        expect(howFarOff(1)).toBe('1 day off');
        expect(howFarOff(120)).toBe('120 days off');
        expect(howFarOff(365)).toBe('1 year off');
        expect(howFarOff(1200)).toBe('3 years off');
    });

    it('says a day already gone is gone, rather than counting backwards', () => {
        expect(howFarOff(0)).toBe('already past');
        expect(howFarOff(-40)).toBe('already past');
    });
});

describe('asking what the ledger holds', () => {
    beforeEach(() => { process.env.ADMIN_MODE = 'true'; });
    afterEach(() => { delete process.env.ADMIN_MODE; });

    /**
     * The routing, which is the half that did not exist. Every one of these
     * came back `unclear`, and `unclear` costs the player their sentence.
     */
    it('reaches a verb at all', () => {
        for (const sentence of [
            'what am I owed',
            'who owes me',
            'what do I owe',
            'what does he owe me',
            'what stands between me and Wen Shuyi',
            'my debts',
            'what is held against me'
        ]) {
            const parsed = parseIntent(sentence);
            expect(parsed.action, sentence).toBe('oath');
            expect(parsed.intent, sentence).toBe('read');
        }
    });

    /**
     * AND NAMING YOURSELF IS NAMING NOBODY. Every one of these questions has
     * the player in it - "who owes ME" - so the subject extractor finds them,
     * and a read narrowed to rows between this cultivator and themselves is
     * always empty. The one that names somebody else keeps them.
     */
    it('does not take the asker for the other party', () => {
        for (const sentence of ['who owes me', 'what is held against me', 'what am I owed']) {
            expect(parseIntent(sentence).target, sentence).toBeUndefined();
        }
        expect(parseIntent('what stands between me and Wen Shuyi').target).toBe('Wen Shuyi');
    });

    /** And the oath verb still swears and still breaks. */
    it('leaves the other two oath intents alone', () => {
        expect(parseIntent('I swear a dao oath to him').intent).toBe('swear');
        expect(parseIntent('I break my oath').intent).toBe('break');
        expect(parseIntent('what oaths am I bound by').intent).toBe('read');
    });

    /**
     * PLAYED, AND IN BOTH DIRECTIONS.
     *
     * An empty ledger answers honestly rather than saying "you are bound by
     * nothing" - which was the old headline, and is not what somebody owed four
     * favours wants to hear. Then a grudge is written by leaning on somebody,
     * and the same question returns it.
     */
    it('answers before anything has happened, and after', async () => {
        const { game } = await makeGameInWorld({
            seed: 'ledger-read', worldSeed: 'both-ends', adminMode: true
        });
        await game.newRun('Asker');
        await game.act('I look around');

        const empty = said(await game.act('what am I owed'));
        expect(empty).toMatch(/Nothing, in either direction/);

        await game.act('ADMIN set_realm ordinal=30');
        await game.act('ADMIN spawn_encounter ordinal=8 name=Wen Shuyi');
        // An ordinary verb, and the only writer in this test.
        await game.act('tell me where the elder is or I will soul search you');

        const after = said(await game.act('what am I owed'));
        expect(after).toMatch(/Held against you/);
        // The cause and the weight, so the player can tell a slight from a
        // feud. The weight in WORDS: `at grave` was the band's own key with a
        // preposition in front of it, and `SEVERITY_IN_WORDS` in `grudges.ts`
        // is where that fact lives now.
        expect(after).toMatch(
            new RegExp(`the world holds it as (${Object.values(SEVERITY_IN_WORDS).join('|')})`)
        );

        // AND A NAME, NEVER AN ID. The person who took it is one the world
        // spawned, and `nameOf` consulted two tables and a catalog without
        // consulting the world roster - so the line read "Held against you by
        // npc-20" while the description under it named them. A raw id in player
        // prose is the one thing the entity layer exists to prevent.
        expect(after, after).not.toMatch(/\bnpc-\d+\b/);
        const whoTookIt = /Held against you by ([^:]+):/.exec(after);
        expect(whoTookIt, after).not.toBeNull();
        expect(after).toContain(whoTookIt![1]);

        // AND NARROWED TO ONE PARTY, which is the same read with a filter.
        // Wen Shuyi is not who took it, so the honest answer is that nothing
        // stands between them - the filter working, not the read failing.
        const between = said(await game.act('what stands between me and Wen Shuyi'));
        expect(between).toMatch(/Nothing stands between you and Wen Shuyi/);
    }, 120000);
});

/**
 * WHICH WAY A ROW POINTS, WHICH IS ONE RULE AND WAS STATED THREE TIMES.
 *
 * `holderId` is documented as "the aggrieved party, the debtor, the oath-taker"
 * - the holder carries the burden in every one of those. `favor` inverts it: a
 * favour is owed TO its holder. That exception lived in a comment in
 * `spending-a-word-to-place-a-child.ts` and inline in `background-as-leverage.ts`,
 * and nowhere a fourth reader would look. A reader that gets it backwards tells
 * a player somebody owes them a thing they in fact owe.
 */
describe('which way a row points', () => {
    const row = (kind: string) =>
        ({ kind, holderId: 'A', subjectId: 'B' }) as Parameters<typeof whichWayItPoints>[0];

    it('puts the burden on the holder for a debt and an oath', () => {
        for (const kind of ['debt', 'oath']) {
            const points = whichWayItPoints(row(kind));
            expect(points.sense, kind).toBe('owes');
            if (points.sense !== 'owes') return;
            expect(points.owerId, kind).toBe('A');
            expect(points.owedId, kind).toBe('B');
        }
    });

    it('runs a favour the other way, because it is owed TO its holder', () => {
        const points = whichWayItPoints(row('favor'));
        expect(points.sense).toBe('owes');
        if (points.sense !== 'owes') return;
        expect(points.owerId).toBe('B');
        expect(points.owedId).toBe('A');
    });

    it('makes the holder the aggrieved party for what is not forgiven', () => {
        for (const kind of ['grudge', 'blood_feud', 'leverage']) {
            const points = whichWayItPoints(row(kind));
            expect(points.sense, kind).toBe('holds_against');
            if (points.sense !== 'holds_against') return;
            expect(points.aggrievedId, kind).toBe('A');
            expect(points.offenderId, kind).toBe('B');
        }
    });

    /**
     * AND THE READ FOLLOWS IT. The same two rows land in opposite buckets, and
     * a reader that remembered the convention instead of asking would put both
     * in the same one.
     */
    it('sorts a debt and a favour into opposite buckets for the same person', () => {
        const base = {
            cause: 'a_real_favour', severity: 'slight', incurredOnDay: 0,
            triggeringEventId: null, description: 'x', participants: [], tags: [],
            terms: null, dueOnDay: null, status: 'open'
        };
        const stands = whatStandsBetweenYouAndEverybody({
            rows: [
                { ...base, id: 'd1', kind: 'debt', holderId: 'me', subjectId: 'them' },
                { ...base, id: 'f1', kind: 'favor', holderId: 'me', subjectId: 'them' }
            ] as Parameters<typeof whatStandsBetweenYouAndEverybody>[0]['rows'],
            meId: 'me',
            nameOf: id => id
        });
        expect(stands.youOwe).toHaveLength(1);
        expect(stands.owedToYou).toHaveLength(1);
        expect(stands.nothingAtAll).toBe(false);
        expect(theLedgerAsLines(stands, null).join(' ')).toMatch(/Owed to you.*Owed by you/s);
    });
});
