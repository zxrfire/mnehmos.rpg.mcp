/**
 * WHAT THEY CAN PLACE ABOUT YOU, PLAYED.
 *
 *   "the demonic/righteous work ONLY IF THEY KNOW UR DEMONIC/RIGHTEOUS, that
 *    should also fall out"
 *   "like if ur a hidden expert from a demonic/righteous sect in a nondescript
 *    robe and nobody knows"
 *   "that should be the source of truth of how you are reached too"
 *
 * `background-as-leverage.ts` read the rung you have and the house you are in.
 * Neither is what the person in front of you is weighing: they weigh what they
 * can place, and a cultivator who has put their weight away is not carrying
 * either one into the room. `what-they-can-place-about-you.ts` is the one
 * predicate, and it answers the mirror question with the same call.
 *
 * ── WHY THE PLAYED ARMS ARE PAIRS ─────────────────────────────────────────
 *
 * Both arms of every comparison run against ONE world seed and differ in
 * exactly one clause of one sentence, so "all else equal" is a fact rather than
 * a hope - see the `makeGameInWorld` banner in `harness.ts`. The number read
 * back is the resolver's own account of what the gap in standing was worth,
 * which is the term the concealment moves and the only one it should.
 *
 * ADMIN arranges the rungs and puts a person there. Every outcome came out of
 * the ordinary verbs.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/actions';
import { engineCalls, makeGameInWorld } from './harness';
import {
    theFragmentIsOnlyTheDeclaration,
    whatYouAreNotShowing
} from '../../src/web/what-you-are-not-showing';
import { whatTheyCanPlaceAbout } from '../../src/engine/social/what-they-can-place-about-you';

/** What the gap in standing was worth, out of the resolver's own sentence. */
function whatTheGapWasWorth(result: { toolCalls: { name: string; summary: string }[] }): number {
    const call = engineCalls(result).find(row => row.name === 'engine.resolveAttempt');
    expect(call, engineCalls(result).map(row => row.name).join(', ')).toBeDefined();
    const found = /the gap in standing between them (added|cost) (\d+) points/.exec(call!.summary);
    expect(found, call!.summary).not.toBeNull();
    return Number(found![2]) * (found![1] === 'cost' ? -1 : 1);
}

/** One sentence said by one asker to one person, in a world pinned by seed. */
async function saidTo(options: {
    worldSeed: string;
    ordinal: number;
    theirRung: number;
    theirName: string;
    said: string;
}) {
    const { game } = await makeGameInWorld({
        seed: 'what-they-can-place', worldSeed: options.worldSeed, adminMode: true
    });
    await game.newRun('Asker');
    await game.act('I look around');
    await game.act(`ADMIN set_realm ordinal=${options.ordinal}`);
    await game.act(`ADMIN spawn_encounter ordinal=${options.theirRung} name=${options.theirName}`);
    return game.act(options.said);
}

const THE_DEMAND = 'tell me where the elder is or I will soul search you';
const THE_SAME_DEMAND_CONCEALED =
    'hiding my cultivation, tell me where the elder is or I will soul search you';

describe('what the person in front of you can place about you', () => {
    beforeEach(() => { process.env.ADMIN_MODE = 'true'; });
    afterEach(() => { delete process.env.ADMIN_MODE; });

    /**
     * THE HIDDEN EXPERT, PLAYED.
     *
     * A False Immortal leaning on somebody twenty-four rungs below them, and
     * the same one having put their weight away first. Before this the two
     * sentences were the same sentence: the derivation read the rung the asker
     * HAS, and the mechanical channel said "and they can see it" about a thing
     * nobody had asked whether they could see.
     */
    it('weighs the rung they can read and not the rung you have', async () => {
        const open = await saidTo({
            worldSeed: 'a-nondescript-robe', ordinal: 44,
            theirRung: 20, theirName: 'Wen Shuyi', said: THE_DEMAND
        });
        const hidden = await saidTo({
            worldSeed: 'a-nondescript-robe', ordinal: 44,
            theirRung: 20, theirName: 'Wen Shuyi', said: THE_SAME_DEMAND_CONCEALED
        });

        expect(whatTheGapWasWorth(open)).toBeGreaterThan(whatTheGapWasWorth(hidden));
    }, 120000);

    /**
     * AND SAYING IT IS NOT DOING IT.
     *
     * `concealmentHolds` refuses a concealment against a witness at or above
     * the real rung, and the person being asked is that witness. Somebody
     * announcing to their senior that they are hiding their cultivation has
     * announced it, and the gap is worth exactly what it was worth.
     */
    it('does nothing when the person reading you stands above you', async () => {
        const open = await saidTo({
            worldSeed: 'a-nondescript-robe', ordinal: 20,
            theirRung: 30, theirName: 'Wen Shuyi', said: THE_DEMAND
        });
        const claimed = await saidTo({
            worldSeed: 'a-nondescript-robe', ordinal: 20,
            theirRung: 30, theirName: 'Wen Shuyi', said: THE_SAME_DEMAND_CONCEALED
        });

        expect(whatTheGapWasWorth(claimed)).toBe(whatTheGapWasWorth(open));
    }, 120000);

    /**
     * AND YOU CANNOT HIDE FROM SOMEBODY YOU HAVE ALREADY DEALT WITH.
     *
     * A known face wins outright, and an open account between the two of you is
     * a face: the debt and favour strands are read off that same ledger, so a
     * robe that hid you from your own creditor would drop the one piece of
     * leverage that is about the two of you and nothing else. Played by leaning
     * on the same person twice - the first attempt leaves a record whichever way
     * it goes - and the concealment on the second is worth nothing.
     */
    it('is worth nothing to somebody who already has an account with you', async () => {
        const { game } = await makeGameInWorld({
            seed: 'what-they-can-place', worldSeed: 'a-nondescript-robe', adminMode: true
        });
        await game.newRun('Asker');
        await game.act('I look around');
        await game.act('ADMIN set_realm ordinal=44');
        await game.act('ADMIN spawn_encounter ordinal=20 name=Wen Shuyi');

        const first = await game.act(THE_DEMAND);
        const second = await game.act(THE_SAME_DEMAND_CONCEALED);

        expect(whatTheGapWasWorth(second)).toBe(whatTheGapWasWorth(first));
    }, 120000);

    /**
     * AND THE SENTENCE IS STILL THE SENTENCE.
     *
     * A concealment is a manner and never an act, so the clause must not move
     * the verb, the intent or what is being asked for. Measured before
     * `theFragmentIsOnlyTheDeclaration` existed: the clause was split off as a
     * free `status()` of its own, and the narrator was handed a character
     * checking their own realm in the middle of a threat.
     */
    it('is a manner and not a second act', () => {
        const plain = parseIntent(THE_DEMAND);
        const concealed = parseIntent(THE_SAME_DEMAND_CONCEALED);
        expect(concealed.action).toBe(plain.action);
        expect(concealed.intent).toBe(plain.intent);
        expect(concealed.topic).toBe(plain.topic);

        expect(theFragmentIsOnlyTheDeclaration('hiding my cultivation')).toBe(true);
        expect(theFragmentIsOnlyTheDeclaration('in a plain robe')).toBe(true);
        // A fragment that hides AND acts keeps its act, and is split as usual.
        expect(theFragmentIsOnlyTheDeclaration('hiding my cultivation I draw on him'))
            .toBe(false);
    });

    /**
     * A BARE `hide` IS A PERSON GETTING BEHIND A ROCK.
     *
     * The declaration has to name what is being put away or what is being worn
     * instead, or every sentence about cover would read as one.
     */
    it('is not read out of every sentence with hiding in it', () => {
        for (const said of [
            'I hide behind the rock',
            'I hide from the guards',
            'I hide the sword under my robe',
            'I search the ruin for a hidden door',
            // `pass` kept to its idioms: this is a person on a road.
            'I pass a mortal on the road',
            'I pretend to be a servant to get inside'
        ]) {
            expect(whatYouAreNotShowing(said), said).toBeNull();
        }
        for (const said of [
            'hiding my cultivation',
            'I keep my aura banked',
            'my presence is hidden',
            'in a nondescript robe',
            'I walk in as an ordinary traveller',
            // The phrasing `xianxia-scenarios.ts` has asked for since the
            // concealment scenario was written.
            'I pretend I am weaker than I am',
            'I act weaker than I am',
            'I pass myself off as a commoner'
        ]) {
            expect(whatYouAreNotShowing(said), said).not.toBeNull();
        }
    });
});

/**
 * THE PREDICATE ITSELF, WHICH IS PURE AND RUNS BOTH WAYS.
 *
 * `AGENTS.md`: every read runs both ways unless there is a reason it cannot.
 * The mirror of *what can they place about me* is *what can I place about
 * them*, and it is this function with the two sides swapped. Neither position
 * is the player's by construction, so the arms below are stated in the module's
 * own words - a reader and a read - rather than in the player's.
 */
describe('the predicate', () => {
    const HIGH = 44;
    const LOW = 20;

    it('shows everything when nothing is being put away', () => {
        const read = whatTheyCanPlaceAbout({
            theirOrdinal: HIGH, readerOrdinal: LOW, keepingItToThemselves: false
        });
        expect(read.theyCanBePlaced).toBe(true);
        expect(read.rungTheyAreTakenFor).toBe(HIGH);
        expect(read.whyNot).toBeNull();
        expect(read.realmsTheyAreTakenToBeOver).toBeGreaterThan(0);
    });

    it('reads them as one of the people they are standing among', () => {
        const read = whatTheyCanPlaceAbout({
            theirOrdinal: HIGH, readerOrdinal: LOW, keepingItToThemselves: true
        });
        expect(read.theyCanBePlaced).toBe(false);
        expect(read.rungTheyAreTakenFor).toBe(LOW);
        expect(read.realmsTheyAreTakenToBeOver).toBe(0);
        expect(read.whyNot).not.toBeNull();
    });

    /**
     * A known face wins outright, which is `presence-recognition.ts`'s own
     * ruling and is the same ruling here. A plain robe is not a new person to
     * somebody who has already stood in front of you.
     */
    it('is not worn by somebody who has already dealt with them', () => {
        const read = whatTheyCanPlaceAbout({
            theirOrdinal: HIGH,
            readerOrdinal: LOW,
            keepingItToThemselves: true,
            hasDealtWithThemBefore: true
        });
        expect(read.theyCanBePlaced).toBe(true);
        expect(read.rungTheyAreTakenFor).toBe(HIGH);
    });

    /** The witness test, which `concealmentHolds` has always owned. */
    it('fails against somebody standing at or above the rung being hidden', () => {
        for (const readerOrdinal of [HIGH, HIGH + 1]) {
            const read = whatTheyCanPlaceAbout({
                theirOrdinal: HIGH, readerOrdinal, keepingItToThemselves: true
            });
            expect(read.theyCanBePlaced, `reader at ${readerOrdinal}`).toBe(true);
            expect(read.rungTheyAreTakenFor).toBe(HIGH);
        }
    });

    /**
     * AND IT RUNS THE OTHER WAY. The same call with the sides swapped answers
     * what the low one can place about themselves being read by the high one -
     * nothing is hidden by being beneath, so a concealment from down there is
     * still a concealment and the number it moves is the reader's.
     */
    it('answers the mirror question with the same call', () => {
        const upward = whatTheyCanPlaceAbout({
            theirOrdinal: LOW, readerOrdinal: HIGH, keepingItToThemselves: false
        });
        expect(upward.realmsTheyAreTakenToBeOver).toBeLessThan(0);
        expect(upward.theyCanBePlaced).toBe(true);
    });
});
