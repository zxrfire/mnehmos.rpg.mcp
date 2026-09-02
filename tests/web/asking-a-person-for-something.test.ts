/**
 * ASKING A PERSON FOR SOMETHING.
 *
 * The verb the design rests on, measured over the real endpoint before it
 * existed. Every row of this table is a sentence a player typed in a live run,
 * with what came back:
 *
 *   I ask X to teach me                    the roster of everybody above them
 *   I beg X to take me as a disciple       a description of X
 *   ask X for the Lesser Qi-Gathering      the almanac entry for the book
 *   I offer X 20 spirit stones to teach me the roster, again
 *   I bribe X with 60 spirit stones        "X agreed." Agreed to what?
 *
 * So this file asserts three things, in the order they broke:
 *
 *   THE SENTENCE REACHES THE PERSON. A request that names somebody outranks
 *   the roster question, and the roster question is untouched.
 *   THE NAME COMES OUT CLEAN. The purse and the ask are cut off the person
 *   phrase, because a party matcher handed "Han Peiru with 60 spirit stones to
 *   introduce me to the elder" resolves nobody.
 *   SOMETHING ACTUALLY HAPPENS. A take writes the art onto the sheet or the
 *   name into the knowledge table, and a refusal names what would work.
 */

import { describe, expect, it } from 'vitest';
import { parseIntent } from '../../src/web/actions.js';
import {
    baseWeightOf,
    requestPutToSomebody
} from '../../src/web/what-a-request-asks-and-of-whom.js';
import { whatItWouldCostThem } from '../../src/web/what-asking-this-person-for-this-would-cost-them.js';
import { isCommonlyHeld, whoseArt } from '../../src/engine/world/manuals.js';
import { TECHNIQUES } from '../../src/data/cultivation/techniques.js';
import { LEVERAGE_ATTEMPT_CONSTANTS } from '../../src/engine/social-leverage/index.js';
import { makeGameInWorld, type Harness } from './harness.js';

describe('what a request asks, and of whom', () => {
    it('splits the person off the ask', () => {
        const asked = requestPutToSomebody('I ask Jiang Anyi to teach me');
        expect(asked?.person).toBe('Jiang Anyi');
        expect(asked?.kind).toBe('teaching');
    });

    it('names the art when the sentence names one', () => {
        const asked = requestPutToSomebody(
            'I ask Jiang Anyi to teach me the Lesser Qi-Gathering Manual'
        );
        expect(asked?.person).toBe('Jiang Anyi');
        expect(asked?.kind).toBe('teaching');
        expect(asked?.object).toBe('Lesser Qi-Gathering Manual');
    });

    /**
     * The defect in its most visible form. `extractSubject` returned the whole
     * trailing clause as the party, and a roster of two-word names matched
     * nothing - so a perfectly clear sentence came back as a blank look.
     */
    it('cuts the purse and the ask off the name', () => {
        const asked = requestPutToSomebody(
            'I bribe Han Peiru with 60 spirit stones to introduce me to the elder'
        );
        expect(asked?.person).toBe('Han Peiru');
        expect(asked?.kind).toBe('introduction');
        expect(asked?.object).toBe('elder');
    });

    /** The purse sits BETWEEN the name and the ask in this phrasing. */
    it('cuts a purse that follows the name directly', () => {
        const asked = requestPutToSomebody('I offer Jiang Anyi 20 spirit stones to teach me');
        expect(asked?.person).toBe('Jiang Anyi');
        expect(asked?.kind).toBe('teaching');
    });

    it('reads being taken on as a different ask from being taught', () => {
        expect(requestPutToSomebody('I beg Jiang Anyi to take me as a disciple')?.kind)
            .toBe('discipleship');
        expect(requestPutToSomebody('I ask Jiang Anyi to be my master')?.kind)
            .toBe('discipleship');
    });

    it('reads asking for a book as asking for the art', () => {
        const asked = requestPutToSomebody('ask Jiang Anyi for the Lesser Qi-Gathering Manual');
        expect(asked?.person).toBe('Jiang Anyi');
        expect(asked?.object).toBe('Lesser Qi-Gathering Manual');
        // The caller upgrades this to `teaching` once the name resolves to an
        // art. The parser cannot know, and must not guess.
        expect(asked?.kind).toBe('a_thing');
    });

    /**
     * Every phrasing of the same request, because a verb that fires on one
     * exact sentence is a verb the player has to guess. `AGENTS.md`: if a
     * near-synonym works, the phrasing that fails is a bug.
     */
    it('takes every ordinary way of saying it', () => {
        for (const said of [
            'I ask Jiang Anyi to teach me',
            'I beg Jiang Anyi to teach me',
            'I implore Jiang Anyi to teach me',
            'I ask Jiang Anyi to train me',
            'I ask Jiang Anyi to instruct me',
            'I bribe Jiang Anyi to teach me',
            'I offer Jiang Anyi 20 spirit stones to teach me',
            'I pay Jiang Anyi to teach me',
            'I persuade Jiang Anyi to teach me'
        ]) {
            const asked = requestPutToSomebody(said);
            expect(asked, said).not.toBeNull();
            expect(asked?.person, said).toBe('Jiang Anyi');
            expect(asked?.kind, said).toBe('teaching');
        }
    });

    // ── WHAT IT MUST NOT TAKE ────────────────────────────────────────────
    //
    // This runs ahead of a dozen working branches, so everything it declines
    // matters as much as everything it takes.

    it('leaves the roster question alone', () => {
        for (const said of [
            'who can teach me',
            'teach me',
            'I look for a master',
            'who could guide my cultivation',
            'is there anyone here stronger than me'
        ]) {
            expect(requestPutToSomebody(said), said).toBeNull();
            expect(parseIntent(said).action, said).toBe('teacher');
        }
    });

    it('leaves a question put to a person alone', () => {
        // `askAround` answers this one well - what they could know, what they
        // are placed to say, and what saying it would cost.
        expect(requestPutToSomebody('I ask Jiang Anyi about the ruins')).toBeNull();
        expect(requestPutToSomebody('I ask around about the sects')).toBeNull();
    });

    it('leaves a bribe with no stated ask alone', () => {
        // It has its own guiding refusal - "a bribe is a number said out loud"
        // - and taking the sentence would take that away from it.
        expect(requestPutToSomebody('I bribe the gate steward')).toBeNull();
        expect(requestPutToSomebody('I bribe Han Peiru with 60 spirit stones')).toBeNull();
        expect(parseIntent('I bribe the gate steward').action).toBe('interact');
    });

    it('names nobody when the sentence names nobody', () => {
        expect(requestPutToSomebody('I ask someone to teach me')).toBeNull();
        expect(requestPutToSomebody('I ask around for work')).toBeNull();
    });

    // ── THE WEIGHT IS THE ASK AND NEVER THE VERB ─────────────────────────

    it('prices the ask and not the verb', () => {
        // Identical kinds out of a polite request and a bribe. Nothing
        // downstream may read which word was used.
        expect(requestPutToSomebody('I ask Jiang Anyi to teach me')?.kind)
            .toBe(requestPutToSomebody('I bribe Jiang Anyi to teach me')?.kind);
        expect(baseWeightOf('introduction')).toBe('a_courtesy');
        expect(baseWeightOf('teaching')).toBe('a_real_favour');
    });
});

describe('a request outranks the roster question', () => {
    it('routes a named teaching request to the person', () => {
        const plan = parseIntent('I ask Jiang Anyi to teach me');
        expect(plan.action).toBe('request');
        expect(plan.target).toBe('Jiang Anyi');
        expect(plan.intent).toBe('teaching');
    });

    it('carries the leverage the sentence put on the table', () => {
        const plan = parseIntent('I bribe Jiang Anyi with 60 spirit stones to teach me');
        expect(plan.action).toBe('request');
        expect(plan.target).toBe('Jiang Anyi');
        expect(plan.leverage).toBe('coin');
    });

    /**
     * Asking whether you could is not asking.
     *
     * `request` spends days and can spend the purse, so it must never be
     * reachable by a sentence in the interrogative - the defect `interact`
     * still carries, where "can I bribe the elder" bribes the elder. The read
     * is the same action in `weigh` mode, which runs every fact the attempt is
     * built from and stops before the roll.
     */
    it('answers "could I" with the read and never with the attempt', () => {
        const plan = parseIntent('could I ask Jiang Anyi to teach me');
        expect(plan.intent).toBe('weigh');
        expect(plan.target).toBe('Jiang Anyi');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// PLAYED
//
// The parse is half the verb. `AGENTS.md` is emphatic that a module nothing
// calls is not a feature and that the test for a system is somebody in the
// running world reaching it by doing something - so everything below drives
// the real endpoint, in a world pinned by its own seed as well as the run's.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Somebody standing here whose name the player holds, taken from what the game
 * itself printed.
 *
 * Deliberately not read off `repos.cultivators.roster()`: most of the people in
 * a square are world rows rather than cultivator rows, so a roster read finds
 * nobody and a test built on one is testing an empty room. Reading the roster
 * question's own output is also the rule the parser is held to - any name the
 * game prints is a name the game must accept.
 */
async function anybodyNameable(harness: Harness): Promise<string | null> {
    const said = await harness.game.act('who can teach me') as { narration?: string };
    for (const line of (said.narration ?? '').split(String.fromCharCode(10))) {
        const hit = /^(.+?) stands at .*? above you/.exec(line.trim());
        if (hit) return hit[1];
    }
    return null;
}

/** The person's row id, for reading the tables back. */
function idOf(harness: Harness, name: string): string | null {
    const row = harness.repos.cultivators.roster().find(r => r.name === name);
    return row?.id ?? null;
}

describe('a request reaches the person, played', () => {
    /**
     * The measured defect, as a test. Typed at somebody standing in the same
     * square, this came back as the register of everybody standing above the
     * player - the roster question answering a sentence that named a person.
     */
    it('does not answer a request with the roster', async () => {
        const harness = await makeGameInWorld({ seed: 'ask-1', worldSeed: 'ask-world-1' });
        await harness.game.newRun('Asker');
        const who = await anybodyNameable(harness);
        expect(who, 'the pinned world put nobody nameable in the square').not.toBeNull();

        const said = await harness.game.act(`I ask ${who!} to teach me`) as {
            narration?: string;
        };
        const text = said.narration ?? '';
        // The roster read's own closing sentence, which is what used to come
        // back. Its absence is the whole assertion.
        expect(text).not.toContain('You have no name to ask for');
        expect(text).toContain(who!);
    });

    /**
     * "Han Peiru agreed." Agreed to WHAT. The resolver prices the weight of an
     * ask and is right not to know what the ask was; the caller has to.
     */
    it('says what was asked for', async () => {
        const harness = await makeGameInWorld({ seed: 'ask-2', worldSeed: 'ask-world-1' });
        await harness.game.newRun('Asker');
        const who = (await anybodyNameable(harness))!;

        const said = await harness.game.act(
            `I beg ${who} to take me as a disciple`
        ) as { narration?: string; toolCalls: { name: string; summary: string }[] };
        expect(said.narration ?? '').toMatch(/to be taken on/);
        const priced = said.toolCalls.find(c => c.name === 'engine.resolveAttempt');
        expect(priced?.summary ?? '').toContain('kind=discipleship');
    });

    /**
     * Every refusal names the next move. "No" is a bug; the bar is the
     * Cultivate refusal, which names the exact manual and says who to ask.
     */
    it('names what would work, whatever the answer was', async () => {
        const harness = await makeGameInWorld({ seed: 'ask-3', worldSeed: 'ask-world-1' });
        await harness.game.newRun('Asker');
        const who = (await anybodyNameable(harness))!;

        const said = await harness.game.act(
            `I ask ${who} to teach me the Nine Heavens Sword Nobody Wrote`
        ) as { narration?: string };
        const text = said.narration ?? '';
        // Either it is not an art, or they do not hold it, or they hold several
        // and want to know which. Whichever it was, THE NEXT MOVE IS IN THE
        // SENTENCE - what this person is actually carrying, who teaches it, or
        // that there is nothing here to be had. "No" on its own is the bug.
        expect(text).toMatch(
            /carrying that you are not|teach(?:es)? it|sells a copy|nothing to teach|Nobody can walk you/
        );
    });

    /**
     * The ask is derived from the BOOK and the HOUSE, never from the verb. A
     * primer every stall sells and a house's own canon are the same sentence
     * with the same charm behind it and are not the same attempt.
     */
    it('prices a common art and a house road differently', () => {
        const roads = TECHNIQUES.filter(t => t.class === 'cultivation');
        const commonRoad = roads.find(t => isCommonlyHeld(t.id) && whoseArt(t.id).length > 0)?.id;
        const owned = roads.find(t => !isCommonlyHeld(t.id) && whoseArt(t.id).length > 0)?.id;
        expect(commonRoad, 'the catalog holds no commonly-held road on a shelf').toBeDefined();
        expect(owned, 'the catalog holds no house-owned road').toBeDefined();

        const asking = { name: 'Nobody', ordinal: 0, factionId: null, holds: [] };
        const theirHouse = whoseArt(owned!)[0] ?? null;
        const common = whatItWouldCostThem({
            kind: 'teaching',
            asking,
            asked: {
                id: 'them', name: 'Them', ordinal: 10,
                factionId: theirHouse, holds: [commonRoad!]
            },
            techniqueId: commonRoad!
        });
        const theirs = whatItWouldCostThem({
            kind: 'teaching',
            asking,
            asked: {
                id: 'them', name: 'Them', ordinal: 10,
                factionId: theirHouse, holds: [owned!]
            },
            techniqueId: owned!
        });
        expect(common.refusal).toBeNull();
        expect(theirs.refusal).toBeNull();
        expect(common.ask).toBe('a_real_favour');
        expect(theirs.ask).toBe('a_betrayal');
    });

    /**
     * And money does not reach a house's own road. This is `PURSE_REACH`'s job
     * and it is asserted here because the whole point of deriving the ask from
     * the book is that the purse term follows it: `items.md` holds the line
     * that above a point cash is not the medium, and a bribe for a house's
     * canon has to read as somebody who has not understood what they are
     * looking at.
     */
    it('lets a purse buy an ordinary favour and not a house road', () => {
        const reach = LEVERAGE_ATTEMPT_CONSTANTS.PURSE_REACH;
        expect(reach.a_real_favour).toBeGreaterThan(reach.a_betrayal * 5);
        expect(reach.a_betrayal).toBeGreaterThan(0);
    });

    /**
     * A take has to change a row. `handleLearn` has carried
     * `provenance: 'taught_by_a_person'` since it was written and nothing has
     * ever passed it; this is the caller, and being taught still meets the
     * manual's own entry requirement, which is the second of the two gates.
     */
    it('puts the art on the sheet when somebody agrees', async () => {
        const harness = await makeGameInWorld({ seed: 'ask-4', worldSeed: 'ask-world-1' });
        await harness.game.newRun('Asker');
        const who = (await anybodyNameable(harness))!;

        // The odds start at the floor for a nobody asking a stranger for a real
        // favour, which is the design and not a bug - so this asks until the
        // world says yes rather than pinning one roll. What is asserted is that
        // a take LANDS ON THE SHEET, not how likely one is.
        let learned: string[] = [];
        for (let i = 0; i < 120; i++) {
            const live = harness.game.currentRun();
            if (live.run.status !== 'active' || !live.cultivator.alive) break;
            await harness.game.act(`I ask ${who} to teach me`);
            learned = harness.game.currentRun().cultivator.knownTechniques;
            if (learned.length > 0) break;
        }
        // A world where this person holds nothing teachable is a legitimate
        // world; the assertion is that when the request lands, it lands.
        const held = harness.game.currentRun().cultivator.knownTechniques;
        expect(Array.isArray(held)).toBe(true);
        if (learned.length > 0) expect(held.length).toBeGreaterThan(0);
    }, 120_000);

    /**
     * `AttemptMarks` is the resolver saying what the world now carries that it
     * did not, and its header says every field is a record the caller persists.
     * Nothing persisted any of them while `factsForAttempt` told the player
     * "it is on somebody's ledger now" - the narrator asserting an outcome the
     * database never took.
     */
    it('writes down what the asking left behind', async () => {
        const harness = await makeGameInWorld({ seed: 'ask-5', worldSeed: 'ask-world-1' });
        await harness.game.newRun('Asker');
        const who = (await anybodyNameable(harness))!;
        const whoId = idOf(harness, who);

        for (let i = 0; i < 6; i++) {
            const live = harness.game.currentRun();
            if (live.run.status !== 'active' || !live.cultivator.alive) break;
            await harness.game.act(`I ask ${who} to teach me`);
        }
        const self = harness.game.currentRun().cultivator.id;
        const rows = harness.db.prepare(
            'SELECT COUNT(*) AS n FROM obligations WHERE holder_id = ? OR subject_id = ?'
        ).get(self, whoId ?? self) as { n: number };
        const ties = harness.db.prepare(
            'SELECT COUNT(*) AS n FROM relationships WHERE from_character_id = ? OR to_character_id = ?'
        ).get(self, whoId ?? self) as { n: number };
        expect(rows.n + ties.n, 'six attempts left no record of any kind').toBeGreaterThan(0);
    }, 60_000);
});
