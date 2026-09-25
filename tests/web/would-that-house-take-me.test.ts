/**
 * "Would the X take me" reached nothing, for all 38 houses.
 *
 * It is one of the first things anybody says about a house, and it is said
 * BEFORE crossing a province to find out. Measured with `parseIntent` over
 * every row of `SECTS`: `would the <name> take me` and `would the <name> have
 * me` came back `unclear` for all of them, while `would they take me` reached
 * the listing.
 *
 * ── "IT NEEDS ADJACENCY" WAS AN ASSUMPTION ───────────────────────────────
 *
 * The reported reason was that the answer needs the asker to be standing near
 * the house. It does not. The bar is `admissionOrdinal`, `getSectAdmission` and
 * the house's own shelf, read against the asker's rung and root - nothing in it
 * consults a location, and `sect_manage.list` already answers exactly this
 * question for every house the asker has heard of, from wherever they are.
 *
 * The adjacency that actually blocked the sentence was in a regular expression.
 * The joining branch reads `would (?:take|have) me`, which needs the two words
 * next to each other, and `WHO_WOULD_TAKE_SOMEBODY_LIKE_ME` enumerates the four
 * things that may sit between them: anyone, anybody, any of them, they. A
 * house's NAME is none of those. That is the whole of it.
 *
 * The gate that IS real is knowledge, and it is kept: a house nobody has said
 * in front of the asker resolves to nobody, which is what `factionMeant` does
 * for every other question about a named house.
 *
 * ── AND IT MAY NOT GO WHERE THE JOINING SENTENCES GO ─────────────────────
 *
 * `{ action: 'sect', target: <house> }` resolves the name and calls
 * `handleJoin`. Routing a question there would answer "would they take me" by
 * walking up to the gate, and the answer is permanent whichever way it falls.
 * So this is a free `look`, and `would-that-house-take-you.ts` states the bar
 * and never the outcome - the same ruling the listing already keeps, from the
 * same measurement: it once said "the Azure Dew Sect would take you as a Dew
 * Servant", the player walked a day on it, and the door came back
 * `not_taken_on`.
 *
 * A SWEEP AND NOT EXAMPLES, for the reason the holdings sweep gives: a passing
 * example over one house whose type noun happens to be reachable says nothing
 * about the thirty-ninth.
 */

import { describe, it, expect } from 'vitest';

import { parseIntent } from '../../src/web/actions';
import { SECTS } from '../../src/data/cultivation/sects';
import { whatTheirDoorAsks } from '../../src/web/would-that-house-take-you.js';
import { makeGameInWorld } from './harness';

/** How a player addresses a house, which is the name without its article. */
const asked = (house: { name: string }) => house.name.replace(/^The\s+/, '');

type Plan = { action?: string; intent?: string; target?: string };

const sweep = (
    phrase: (name: string) => string
): ReadonlyArray<[string, Plan]> =>
    SECTS.map(house => [house.name, parseIntent(phrase(asked(house))) as Plan]);

/**
 * The house a plan names, compared the way the table spells it.
 *
 * `theHouseNameSaid` hands back the catalog's own spelling lower-cased, which
 * is what makes it a lookup rather than a phrase somebody has to guess at. The
 * comparison is folded rather than the expectation being written out in lower
 * case, so a change from one spelling to the other is visible here instead of
 * quietly passing.
 */
const namesTheHouse = (plan: Plan, house: { name: string }): boolean =>
    (plan.target ?? '').toLowerCase() === asked(house).toLowerCase();

describe('asking whether a house would have you', () => {
    it.each([
        'would the %s take me',
        'would the %s have me',
        'will the %s admit me',
        'do i meet the bar for the %s',
        'am i good enough for the %s'
    ])('reaches the door read for every house: "%s"', template => {
        const wrong = sweep(name => template.replace('%s', name))
            .filter(([, plan]) =>
                plan.action !== 'look'
                || plan.intent !== 'would_they_take_me')
            .concat(
                sweep(name => template.replace('%s', name))
                    .filter(([name, plan]) =>
                        !namesTheHouse(plan, { name }))
            );

        expect(
            wrong.map(([name, plan]) => `${name} -> ${plan.action}/${plan.intent}`),
            'A house that cannot be asked whether it would have you. The fix is a '
            + 'rule, never a list: WOULD_THAT_HOUSE_TAKE_ME reads '
            + 'A_HOUSE_BEING_ASKED_ABOUT, which is built from the catalog.'
        ).toEqual([]);
    });

    /**
     * A SENTENCE THAT NAMES NO HOUSE IS THE LISTING'S, AND STAYS ITS.
     *
     * The branch is gated on a catalog name being said. Without that gate the
     * new pattern would take the bare forms off `sect`, which answers about
     * every house the asker has heard of - a better answer to a question that
     * names nobody, and one this fix must not quietly delete.
     */
    it('leaves the sentences that name no house to the listing', () => {
        for (const bare of [
            'would they take me',
            'who would take me',
            'which houses would have me',
            'would anyone admit somebody like me'
        ]) {
            expect((parseIntent(bare) as Plan).action, bare).toBe('sect');
        }
    });

    /**
     * AND THE JOINING SENTENCES STILL JOIN.
     *
     * The question and the act share most of their vocabulary, and the failure
     * that matters is the one in this direction: a player who says "I join the
     * X" and is handed a read has lost a turn, and a player who asks "would the
     * X take me" and is enrolled has lost a life.
     */
    it('leaves the sentences that are the act alone', () => {
        for (const act of [
            'i join the Azure Dew Sect',
            'i apply to the Azure Dew Sect',
            'i go to the Azure Dew Sect intake'
        ]) {
            expect((parseIntent(act) as Plan).action, act).toBe('sect');
        }
    });

    /**
     * THE NEIGHBOURS, SWEPT RATHER THAN SAMPLED.
     *
     * Ordering is load-bearing in this table and a new pattern that fires
     * before an existing one steals its sentences silently. These are the four
     * questions about a named house that already worked, run over all 38 for
     * exactly that reason. "how high would the X take me" is the near miss: it
     * carries `would`, `take` and `me`, and it is a question about the shelf,
     * which is why the shelf read is checked first.
     */
    it.each([
        ['what does the %s have', 'what_they_hold'],
        ['what does the %s teach', 'what_they_teach'],
        ['how high would the %s take me', 'what_they_teach']
    ])('does not steal "%s"', (template, intent) => {
        const wrong = sweep(name => template.replace('%s', name))
            .filter(([, plan]) => plan.intent !== intent);
        expect(wrong.map(([name, plan]) => `${name} -> ${plan.action}/${plan.intent}`))
            .toEqual([]);
    });

    it('does not steal who leads the X, or where the X is', () => {
        const leaders = sweep(name => `who leads the ${name}`)
            .filter(([, plan]) => plan.action !== 'sect' || plan.intent !== 'standing');
        expect(leaders.map(([name]) => name)).toEqual([]);

        const places = sweep(name => `where is the ${name}`)
            .filter(([, plan]) => plan.action !== 'destinations');
        expect(places.map(([name]) => name)).toEqual([]);
    });

    /** And the questions one word away that belong to other verbs entirely. */
    it('leaves the near neighbours alone', () => {
        expect(parseIntent('am i strong enough to fight him').action).toBe('assess');
        expect(parseIntent('am i ready to break through').action).toBe('assess');
        expect(parseIntent('what does my sect teach').action).toBe('sect');
        expect(parseIntent('who stands behind the Azure Dew Sect').intent)
            .toBe('who_is_above_them');
    });
});

/**
 * AND THE SENTENCE IS ANSWERED, PLAYED, WITHOUT ANYBODY BEING ENROLLED.
 *
 * The sweep above proves the routing and nothing else. The failure this arm is
 * here for is the one that would not show in a routing sweep at all: the read
 * exists, the intent is emitted, and the turn engine has no branch for it - in
 * which case `look` falls through to the plain look and the player is handed a
 * description of the square. And the second failure, which is the expensive
 * one: the question reaching the joining path and the run being enrolled by an
 * asking.
 */
describe('asking it, played', () => {
    it('answers with the house\'s bar and puts nobody on a roll', async () => {
        const h = await makeGameInWorld({ seed: 'at-the-door', worldSeed: 'world-at-the-door' });
        const { cultivator } = await h.game.newRun('Asker');
        await h.game.act('I look around');

        const knows = (id: string): boolean =>
            (h.game as unknown as { knowledge: {
                isAwareOf(who: string, kind: string, id: string): boolean;
            } }).knowledge.isAwareOf(cultivator.id, 'sect', id);
        const known = SECTS.find(sect => knows(sect.id));
        expect(known, 'this cultivator was born knowing no house').toBeTruthy();

        const name = asked(known!);
        const said = (await h.game.act(`would the ${name} take me`)).narration;

        expect(said, 'the house asked about is not in the answer').toContain(known!.name);
        expect(said, 'no bar was stated').toMatch(/admits from/i);
        // The whole point of not sending it to the joining path.
        expect(
            h.game.repos.cultivators.getById(cultivator.id)?.sectId,
            'asking whether a house would have you put the run on its roll'
        ).toBeNull();
    }, 180_000);
});

/**
 * What the read says, which is a bar and never an answer.
 *
 * The four claims, and the last is the one that makes it honest rather than a
 * forecast the gate is free to contradict.
 */
describe('what their door asks', () => {
    const base = {
        houseName: 'The Unadorned Sword Sect',
        admitsFrom: 12,
        standsAt: 4,
        recruits: true,
        clearsTheBar: false as boolean | null,
        wouldEnterAtRank: null as string | null,
        rootAtTheDoor: 'welcome' as const,
        requirement: null as string | null,
        guestDoorOpen: false,
        shutToThem: null as string | null
    };

    it('states the bar and how far short the asker stands', () => {
        const read = whatTheirDoorAsks(base);
        expect(read.lines[0]).toContain('The Unadorned Sword Sect admits from');
        expect(read.lines.join(' ')).toContain('8 rungs short');
    });

    it('names where a cleared bar would seat them', () => {
        const read = whatTheirDoorAsks({
            ...base, standsAt: 20, clearsTheBar: true, wouldEnterAtRank: 'Outer Disciple'
        });
        expect(read.lines.join(' ')).toContain('Outer Disciple');
    });

    /**
     * A FLOOR THAT IS NOT A RUNG SILENCES THE REST.
     *
     * A house that takes one sex only, or one that takes nobody, has a reason
     * that no amount of standing moves - and printing the rung comparison under
     * it would tell the player to go and climb, which is the one thing that
     * cannot help. Said first, and nothing said after it.
     */
    it('says a floor that is not a rung, and stops there', () => {
        const shut = whatTheirDoorAsks({
            ...base, shutToThem: 'They take women and have since they were founded.'
        });
        expect(shut.lines.join(' ')).toContain('does not move it');
        expect(shut.lines.join(' '), 'a bar was offered where standing cannot help')
            .not.toContain('short of it');

        const closed = whatTheirDoorAsks({ ...base, recruits: false });
        expect(closed.lines.join(' ')).toContain('not taking people on');
        expect(closed.lines.join(' ')).not.toContain('short of it');
    });

    /**
     * AND CLEARING A BAR IS NOT BEING TAKEN.
     *
     * The listing learned this by being played: it said a house "would take
     * you", the player spent a day walking to it, and the gate refused. What is
     * settled by the bar is the terms; whether somebody is taken is a roll at
     * the gate. The read may never promise the second.
     */
    it('never says the house would take them', () => {
        const read = whatTheirDoorAsks({
            ...base, standsAt: 20, clearsTheBar: true, wouldEnterAtRank: 'Outer Disciple'
        });
        const said = read.lines.join(' ');
        expect(said).toContain('their bar, not their answer');
        expect(said).not.toMatch(/would take you/i);
    });

    /** The second door is said even where the first is open. */
    it('says the intake is open where it is', () => {
        const read = whatTheirDoorAsks({ ...base, guestDoorOpen: true });
        expect(read.lines.join(' ')).toContain('not a discount');
    });
});
