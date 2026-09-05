/**
 * A question about a named thing has a route, and it is the route that already
 * existed.
 *
 * ── THE FIVE MEASUREMENTS THIS FILE EXISTS FOR ───────────────────────────
 *
 * Every one was played, deterministic reader, no model:
 *
 *   tell me about <a house>      -> interact(target="me about <house>"), and
 *   tell me about <a place>         the words were put to whoever was nearest:
 *   tell me about <a person>        *"They look at you the way people look at a
 *   tell me about <an art>          sentence with a hole in it."*
 *   what do you know about <X>   -> unclear
 *   who is <X>                   -> unclear
 *   I want to get into a sect.   -> sect(target="get into a sect")
 *   Which ones would even look      -> "You have said a name and it is not one
 *   at someone like me?                anybody has said to you."
 *   who would take someone       -> unclear
 *   like me
 *   I take the intake at the     -> sect/siphon: "The reserves: refused. The
 *   house that posted the notice    reason it filed is not a member."
 *
 * ── WHAT THEY HAVE IN COMMON, AND WHERE THEY DIVIDE ──────────────────────
 *
 * The first six are one gap: a question about a NAMED THING had no sentence
 * that reached the verb which reads one. That verb is `investigate` - free, in
 * `READ_ONLY_ACTIONS`, resolving through `resolveAnything`, and its own glossary
 * line already says *examine a place, a PERSON, a record, an inscription, an
 * object*. Nothing had to be built; `tell` is a speech verb and it was eating
 * the sentence before the verb could see it.
 *
 * The last three are NOT that gap and are kept apart on purpose. *Which houses
 * would take me* names no thing: it is a question about a set filtered by the
 * asker, the admissible listing answers it, and routing it through a name
 * resolver is exactly the failure that was measured. *Taking a posted intake*
 * is an act, not a question at all, and it was reaching a members-only read of
 * a treasury.
 *
 * ── THE RULE EVERY ASSERTION HERE IS WRITTEN TO ──────────────────────────
 *
 * Widening a pattern steals sentences from the verb next door, and this file's
 * larger half is the neighbours rather than the fix. Every sentence in
 * `THE NEIGHBOURS` below was checked by hand against the change and is asserted
 * so the next widening cannot take it quietly.
 */

import { describe, expect, it } from 'vitest';

import {
    READ_ONLY_ACTIONS,
    TIME_CONSUMING_ACTIONS,
    namesNoHouse,
    parseIntent,
    whatIsBeingAskedAbout,
    whoseIntakeItIs
} from '../../src/web/actions';
import { engineCalls, makeGameInWorld } from './harness';

describe('asking about a named thing reaches the verb that reads one', () => {
    it.each([
        ['tell me about the Gleaners Company', 'Gleaners Company'],
        ['tell me about Shen Wanshi', 'Shen Wanshi'],
        ['tell me about Four Graves', 'Four Graves'],
        ['tell me about the Lesser Qi-Gathering Manual', 'Lesser Qi-Gathering Manual'],
        ['tell me more about Shen Wanshi', 'Shen Wanshi'],
        ['what can you tell me about Shen Wanshi', 'Shen Wanshi'],
        ['tell me what you know about Shen Wanshi', 'Shen Wanshi'],
        ['what do you know about Shen Wanshi', 'Shen Wanshi'],
        ['what do you know of the Hollow Court', 'Hollow Court'],
        ['who is Shen Wanshi', 'Shen Wanshi'],
        // The deictic, which is the ground underfoot and reaches the ground read.
        ['tell me about this place', 'this place']
    ])('%s keeps the name it was given', (said, name) => {
        const parsed = parseIntent(said);
        expect(parsed.action, said).toBe('investigate');
        expect(parsed.target, said).toBe(name);
    });

    /**
     * A misread of a question must not cost anything, which is what makes it
     * safe to route four phrasings at one verb without a model in front of it.
     */
    it('costs nothing however it lands', () => {
        expect(READ_ONLY_ACTIONS).toContain('investigate');
        expect(TIME_CONSUMING_ACTIONS).not.toContain('investigate');
    });

    /**
     * "what is X" is the DEFINITION question and is deliberately not routed
     * here: this world's tone rule is that nobody explains how anything works,
     * so answering it by searching the roster would be the deflection the whole
     * change exists to remove.
     */
    it('leaves the definition question alone', () => {
        expect(whatIsBeingAskedAbout('what is a spirit root')).toBeUndefined();
        expect(whatIsBeingAskedAbout('what is qi deviation')).toBeUndefined();
    });

    it('reads no name out of a sentence that names nobody', () => {
        for (const said of [
            'tell me about it',
            'tell me about them',
            'tell me about everything',
            'who is he',
            'who is that',
            'who is in charge',
            'who is the one who is out of reach',
            'who is watching'
        ]) {
            expect(whatIsBeingAskedAbout(said), said).toBeUndefined();
        }
    });
});

/**
 * THE NEIGHBOURS.
 *
 * `tell` is a wide word and `about` is wider. Each row is a sentence that sits
 * within one word of the new route and belongs to somebody else.
 */
describe('every sentence next door still reaches its own verb', () => {
    it.each([
        // Spoken TO somebody. The route requires the asker as the indirect
        // object, and this is the whole of what that guard is for.
        ['I tell him I am from the Azure Dew Sect', 'interact'],
        ['I tell the elder my name', 'interact'],
        ['I tell her I will be back', 'interact'],
        // The world's talk, whose pattern is end-anchored for exactly this.
        ['what do people around here talk about', 'news'],
        ['what is the word', 'news'],
        ['what news is there', 'news'],
        ['I listen for rumours', 'news'],
        // The ground's own history, not a topic.
        ['what do people say about this place', 'look'],
        // The holder's own head. `what do I know` is not `what do you know`.
        ['what do I know of Lu Sheng', 'recall'],
        ['what do I know', 'recall'],
        ['what is my dao', 'recall'],
        // The asker themselves.
        ['tell me about myself', 'status'],
        ['who am i', 'status'],
        // The houses, as a category rather than as a name.
        ['tell me about the houses near here', 'sect'],
        ['what sects are near here', 'sect'],
        // A question put to a PERSON is a different act with a different answer.
        ['I ask someone about the sects near here', 'interact'],
        ['question the merchant about the ruin', 'interact'],
        // The faces read, and the wall.
        ['who is here', 'look'],
        ['who is around', 'look'],
        ['who is recruiting', 'look'],
        ['what is posted here', 'look'],
        // Reading a house is not being sent to find one.
        ['who leads this sect', 'sect'],
        // Everything else that begins "what is".
        ['what is for sale', 'market'],
        ['what is my ceiling', 'ceiling'],
        ['what is stopping me', 'ceiling'],
        ['what is nearby', 'destinations'],
        ['whose art is that', 'recognise'],
        ['who can teach me', 'teacher'],
        ['who stands above me', 'teacher'],
        ['who holds deposits', 'legacy'],
        ['who holds my word', 'oath']
    ])('%s stays %s', (said, verb) => {
        expect(parseIntent(said).action, said).toBe(verb);
    });
});

/**
 * WHICH HOUSES WOULD TAKE ME.
 *
 * A question about a set, filtered by the asker. The listing that answers it
 * has been complete the whole time; what reached it was a manufactured house
 * name and a refusal about a house that does not exist.
 */
describe('asking who would take you reaches the register of who would', () => {
    it.each([
        'which sects would take me',
        'who would take someone like me',
        'which ones would even look at someone like me',
        'I want to get into a sect. Which ones would even look at someone like me?',
        'what sects would even look at me',
        'which houses would have me',
        'would anyone take me',
        'I look for a sect that will take me',
        'I want to join a sect'
    ])('%s reaches the listing and carries no invented name', said => {
        const parsed = parseIntent(said);
        expect(parsed.action, said).toBe('sect');
        expect(parsed.target, said).toBeUndefined();
    });

    it('still carries a house the sentence actually names', () => {
        expect(parseIntent('I ask about joining the Gleaners Company').target)
            .toBe('Gleaners Company');
        expect(parseIntent('I apply to the Thousand Treasure Pavilion').target)
            .toBe('Thousand Treasure Pavilion');
        expect(parseIntent('I join the Azure Dew Sect').target).toBe('Azure Dew Sect');
    });

    it('knows filler from a name', () => {
        expect(namesNoHouse('get into a sect')).toBe(true);
        expect(namesNoHouse('sect that will take me')).toBe(true);
        expect(namesNoHouse('the houses near here')).toBe(true);
        expect(namesNoHouse('house that posted the notice')).toBe(true);
        expect(namesNoHouse('the intake in two days')).toBe(true);
        expect(namesNoHouse('Gleaners Company')).toBe(false);
        expect(namesNoHouse('Azure Dew Sect')).toBe(false);
        expect(namesNoHouse('The Silver Island Rail')).toBe(false);
    });
});

/**
 * TAKING A POSTED INTAKE.
 *
 * The wall advertises three doors with dates on them, and the sentence that
 * accepts one reached the house's treasury. `SECT_THEFT_PATTERN` carries
 * `take the`, and the sect-noun block fires on the word `house`.
 */
describe('taking an intake is being taken on, not opening a treasury', () => {
    it.each([
        'I take the intake at the house that posted the notice',
        'I take the intake',
        'I go to the intake in two days',
        'I attend the intake',
        'I go to the soonest intake'
    ])('%s reaches the door and never the reserves', said => {
        const parsed = parseIntent(said);
        expect(parsed.action, said).toBe('sect');
        expect(parsed.intent, said).not.toBe('siphon');
        // Points at the paper rather than at a name, so the admissible listing
        // answers rather than a refusal about a house that does not exist.
        expect(parsed.target, said).toBeUndefined();
    });

    it.each([
        ['I take the intake at the Silver Island Rail', 'Silver Island Rail'],
        ['I take the Silver Island Rail intake', 'Silver Island Rail'],
        ['I sign up for the intake at Silver Island', 'Silver Island'],
        ['I present myself at the Hollow Bell Wanderers intake', 'Hollow Bell Wanderers']
    ])('%s carries the house the paper named', (said, house) => {
        expect(whoseIntakeItIs(said), said).toBe(house);
        expect(parseIntent(said).target, said).toBe(house);
    });

    /**
     * And the reserves keep theirs. The split is the one that surface already
     * draws: asking what is in the vault is a question, taking from it is an
     * act, and neither of them is an application.
     */
    it.each([
        'I steal the sect treasury',
        'what do the sect reserves hold',
        'I take a little from the treasury each month',
        'I empty the coffers'
    ])('%s is still the reserves', said => {
        const parsed = parseIntent(said);
        expect(parsed.action, said).toBe('sect');
        expect(parsed.intent, said).toBe('siphon');
    });

    it.each([
        ['I take a commission', 'duty'],
        ['what duties are there', 'duty'],
        ['I do sect work for contribution', 'duty'],
        ['I take on new disciples', 'recruit'],
        ['I recruit two disciples', 'recruit']
    ])('%s is still sect/%s', (said, intent) => {
        expect(parseIntent(said).intent, said).toBe(intent);
    });

    it.each([
        'who is recruiting',
        'what is posted here',
        'what recruiting notices are up',
        'is anyone taking disciples',
        'I read the bills on the wall'
    ])('%s is still the wall read', said => {
        const parsed = parseIntent(said);
        expect(parsed.action, said).toBe('look');
        expect(parsed.intent, said).toBe('bills');
    });
});

/**
 * PLAYED, in the mode every one of the defects was found in.
 *
 * Asserted on the engine's rulings - which tool answered, whether it succeeded,
 * and what the clock did - and never on prose. Several of the defects being
 * fixed here were in what a turn SAID rather than in what it did, and a test
 * that reads the paragraph cannot tell the two apart.
 */
describe('played, through the whole service', () => {
    it('answers a question about a house, a place, a person and an art', async () => {
        const { game } = await makeGameInWorld({ seed: 'asked-about', worldSeed: 'world-asked-about' });
        await game.newRun('Wen Shuyi');
        await game.act('I look around');

        const resolved = async (said: string) => {
            const result = await game.act(said);
            const read = engineCalls(result)
                .find(call => call.action === 'investigate');
            expect(read, `${said} did not reach the read`).toBeDefined();
            expect(read!.ok, `${said} was refused`).toBe(true);
            // Free. A question about anything costs nobody anything.
            expect(result.state.run.elapsedDays, said).toBe(0);
            return read!.summary;
        };

        // A house, by the name the game itself printed.
        expect(await resolved('tell me about the Gleaners Company'))
            .toMatch(/to sect sect-gleaners-company/);
        // The ground underfoot.
        expect(await resolved('tell me about this place')).toMatch(/to place /);
        // An art out of the catalog.
        expect(await resolved('what do you know about the Lesser Qi-Gathering Manual'))
            .toMatch(/to technique lesser-qi-gathering-manual/);
    }, 200_000);

    /**
     * The question that used to come back as the player's own affiliation, or
     * as a refusal about a house nobody had named. It reaches the register of
     * doors that would actually open, filtered by the bar this cultivator
     * clears and gated on the names they hold.
     */
    it('answers which houses would take somebody like this', async () => {
        const { game } = await makeGameInWorld({ seed: 'who-takes', worldSeed: 'world-who-takes' });
        await game.newRun('Wen Shuyi');
        await game.act('I look around');

        const result = await game.act(
            'I want to get into a sect. Which ones would even look at someone like me?'
        );
        const listed = engineCalls(result).find(call => call.name === 'sect_manage.list');
        expect(listed, 'did not reach the admissible listing').toBeDefined();
        expect(listed!.summary).toMatch(/admissible sect\(s\)/);
        // Not the standing read, which is what they HAVE rather than what they
        // could have, and not a refusal about a house nobody named.
        expect(engineCalls(result).some(call => call.name === 'sect_manage.standing')).toBe(false);
        expect(engineCalls(result).some(call => call.name === 'engine.resolveSect')).toBe(false);
        expect(result.state.run.elapsedDays).toBe(0);
    }, 200_000);

    /**
     * And the act. The wall names a house, and the sentence that accepts what
     * it advertises reaches the door rather than the treasury behind it.
     */
    it('takes an intake the wall advertised, by the name the wall printed', async () => {
        const { game } = await makeGameInWorld({ seed: 'intake', worldSeed: 'world-askscratch' });
        await game.newRun('Wen Shuyi');
        await game.act('I look around');
        await game.act('I travel to Four Graves');

        const wall = await game.act('what is posted here');
        const named = /^(.+?) is holding an intake/m.exec(wall.narration)?.[1];
        expect(named, 'no bill on this wall to accept').toBeTruthy();

        const taken = await game.act(`I take the ${named!.replace(/^The /, '')} intake`);
        const calls = engineCalls(taken);
        // The door, and never the vault behind it.
        expect(calls.some(call => call.name === 'sect_manage.siphon')).toBe(false);
        expect(calls.some(call => call.name === 'sect_manage.join')).toBe(true);
    }, 200_000);
});
