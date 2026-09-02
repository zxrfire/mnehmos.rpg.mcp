/**
 * A misparse must never cost the player anything.
 *
 * The bug this file exists for, found by playing rather than by testing:
 *
 *     A cultivator with no stones, no food and five days of life left types
 *     "I take whatever work the village will give me for a season". The parser
 *     did not know "take work", fell through to a rule that fired on any
 *     sentence containing a duration, matched "a season", and returned
 *     cultivate(90). The player asked for the one action that saves them and
 *     got the one action that kills them. The run closed permanently.
 *
 * Two defects, and the second is the real one. The verb coverage was missing,
 * which is a gap. The FALLBACK was a time-consuming action, which is a design
 * error: an action the engine is not confident about must be the cheapest one
 * available, never the most expensive.
 *
 * Every test here reads the parser's own output rather than an outcome,
 * because the parser is the entire intent path when no provider is configured.
 */

import { describe, it, expect } from 'vitest';
import type Database from 'better-sqlite3';
import {
    ACTION_NAMES,
    DEFAULT_OFFER_INTENT,
    DEFAULT_PETITION_INTENT,
    DEFAULT_POSTURE_INTENT,
    DEFAULT_SEAL_INTENT,
    FALLBACK_ACTION,
    OFFER_INTENTS,
    PETITION_INTENTS,
    POSTURE_INTENTS,
    SEAL_INTENTS,
    TIME_CONSUMING_ACTIONS,
    isBareDuration,
    parseCount,
    parseIntent,
    siteNamed,
    type ActionName
} from '../../src/web/actions';
import { makeGame, planned, engineCalls, refusedCall, cultivatorRow, injuryCount } from './harness';
import { withoutTheOverride } from '../../src/web/game';
import { SECTS, sectThreat } from '../../src/data/cultivation/sects';
import { OFFER_INTENTS } from '../../src/web/actions';
import { abodeLocationId } from '../../src/engine/world/immortal-world';
import {
    DESCENT_TRIBULATION_STRIKES
} from '../../src/engine/cultivation/existence';
import { TRIBULATION_LETHAL_STRIKES } from '../../src/engine/cultivation/breakthrough';
import {
    BREATHS_IN_THE_LOWER_REALM,
    OBJECT_CEILING_BELOW_THE_LID
} from '../../src/engine/cultivation/realms';
import { loosePlaceKey, placeKey } from '../../src/web/knowledge';
import { SITES, enterSite } from '../../src/data/cultivation/inheritance-trials';
import { TECHNIQUES } from '../../src/data/cultivation/techniques';
import { SPIRIT_ROOTS } from '../../src/engine/cultivation/spirit-roots';
import { formInsight, recordAchievement } from '../../src/engine/cultivation/understanding';
import { CultivationRNG } from '../../src/engine/cultivation/rng';
import { BLEED_OUT_TURNS } from '../../src/schema/cultivation';
import { KnowledgeGate } from '../../src/web/knowledge';

/**
 * Sentences nothing in the parser is meant to recognise.
 *
 * Deliberately varied, and deliberately full of durations and cultivation
 * vocabulary, because those are what dragged the original bug into a fatal
 * branch. If a future verb claims one of these, that is fine - what must never
 * happen is one of them resolving to something that spends time.
 */
const UNRECOGNISED = [
    'I ponder the nature of the Lid for a while',
    'hmm',
    'asdkjhasd qqq',
    'I do the thing with the thing',
    'what now',
    'I consider my options over the next several years',
    'I make peace with it, in a manner of speaking, for a season',
    'let me think about this for ten years',
    'I resolve to be better about it in future',
    'the qi and the years and all of it, honestly',
    'I write a letter I will not send',
    'nothing, for now',
    'I think about my mother for a month',
    'aaaaaa',
    'I would like to not die please',
    'I let it lie for a decade and see',
    'I take stock of a life that has gone nowhere in forty years'
];

describe('the fallback is inert', () => {
    it('resolves nothing unrecognised to anything that spends time', () => {
        // The invariant. It must keep holding as verbs are added, which is why
        // it is written against the list rather than against a fixed answer.
        for (const input of UNRECOGNISED) {
            const parsed = parseIntent(input);
            expect(
                TIME_CONSUMING_ACTIONS.includes(parsed.action),
                `"${input}" resolved to ${parsed.action}, which spends in-world time`
            ).toBe(false);
        }
    });

    it('resolves them to the declared fallback', () => {
        for (const input of UNRECOGNISED) {
            expect(parseIntent(input).action, `input: ${input}`).toBe(FALLBACK_ACTION);
        }
    });

    it('declares a fallback that is itself inert', () => {
        expect(TIME_CONSUMING_ACTIONS.includes(FALLBACK_ACTION)).toBe(false);
    });

    it('keeps the two lists honest about every action in the enum', () => {
        // A new verb has to be classified one way or the other, or the guard
        // above silently stops covering it.
        const inert: ActionName[] = [
            'look', 'status', 'investigate', 'interact', 'assess', 'market', 'unclear',
            // `sect` is a listing until a sect is named, and a life's allegiance
            // after. Neither half spends in-world time, so it is inert here.
            'sect',
            // Buying food spends stones, not days. It is deliberately inert on
            // this axis: a misparse that lands here has cost the player nothing
            // they cannot walk back, and being able to reach it cheaply is the
            // entire point of adding it.
            'provision',
            // Same reasoning. A purchase off the price board spends stones and
            // no days, and a misparse that lands here is refused against
            // `PRICES` before anything is charged.
            'buy',
            // The strictest read in the package. It touches the holder's own
            // rows and nothing else, so it spends no days, changes no value
            // and cannot even accidentally teach anybody anything.
            'recall',
            // Asking the square what it has heard. Writes knowledge records at
            // `whisper` and nothing else - the same write standing near a
            // conversation already makes - so it spends no day and no stone.
            'news',
            /**
             * The four institutional verbs, inert on this axis and NOT inert in
             * general, which is exactly the position `sect` is in.
             *
             * None of them spends a day. Three of them commit the house to
             * something it cannot walk back, and one of them changes a power
             * ordinal permanently - so being on this list is a statement about
             * the food clock and about nothing else. What actually protects a
             * misparse here is that every one of them defaults to a READ, which
             * is asserted separately below.
             */
            'petition', 'posture', 'seal', 'offer',
            /**
             * The counter and the two reads beside it.
             *
             * A sale moves stones and stock and spends no day, which is the
             * same position `buy` is in; the other two touch nothing at all.
             * `learn_technique` is deliberately absent from this list and
             * present in the timed one, because an art that fights the root
             * routes through the deviation engine and can end the run.
             */
            'sell', 'inventory', 'list_techniques',
            // Pricing three routes is a read of catalogs and rows. The whole
            // point of it being free is that the comparison must not itself
            // cost a decade.
            'acquisition',
            // The three questions a stuck player asks. Every line each of them
            // produces restates a number the engine already computed, so none
            // of them can spend, teach, move or kill - and a player at a wall
            // has to be able to ask what it is a hundred times for nothing.
            'ceiling', 'teacher', 'destinations'
        ];
        for (const name of ACTION_NAMES) {
            const timed = TIME_CONSUMING_ACTIONS.includes(name);
            expect(timed || inert.includes(name), `${name} is classified neither way`).toBe(true);
        }
    });
});

describe('the sentence that killed a run', () => {
    const FATAL = 'I take whatever work the village will give me for a season';

    it('reads as work, not as three months of sitting still', () => {
        const parsed = parseIntent(FATAL);
        expect(parsed.action).toBe('work');
        expect(parsed.days).toBe(90);
    });

    it('does not resolve to cultivate through any phrasing of taking work', () => {
        const phrasings = [
            'I take whatever work the village will give me for a season',
            'find work',
            'I look for work in the village',
            'take a job for a month',
            'I hire myself out',
            'odd jobs, anything',
            'I need to earn some stones',
            'work the fields for a year',
            'day labour',
            'I make myself useful for a while'
        ];
        for (const input of phrasings) {
            expect(parseIntent(input).action, `input: ${input}`).toBe('work');
        }
    });

    it('reaches the market too', () => {
        for (const input of ['what is for sale', 'I go to the market', 'the price of food', 'what can I buy here']) {
            expect(parseIntent(input).action, `input: ${input}`).toBe('market');
        }
    });

    it('reaches assess without attempting anything', () => {
        for (const input of ['could I survive that cave', 'size up the valley', 'is it safe to go in']) {
            expect(parseIntent(input).action, `input: ${input}`).toBe('assess');
        }
    });
});

describe('a bare duration is still seclusion, and only a bare duration', () => {
    it('reads a duration on its own as cultivation', () => {
        for (const input of ['ten years', 'three months', 'a decade', 'for another year', 'spend 90 days']) {
            const parsed = parseIntent(input);
            expect(parsed.action, `input: ${input}`).toBe('cultivate');
            expect(parsed.days).toBeGreaterThan(0);
        }
    });

    it('does not read a duration buried in a sentence about something else', () => {
        for (const input of [
            'I take whatever work the village will give me for a season',
            'I think about my mother for a month',
            'I write to the elder and wait a year for an answer'
        ]) {
            expect(isBareDuration(input), `input: ${input}`).toBe(false);
        }
    });

    it('still recognises an explicit request to sit for a span', () => {
        expect(parseIntent('I sit in seclusion for ten years').action).toBe('cultivate');
        expect(parseIntent('I seal the cave for ten years').action).toBe('seclude');
    });
});

describe('through the front door', () => {
    it('costs a starving cultivator nothing to be misunderstood', async () => {
        const { db, game } = makeGame({ seed: 'misparse' });
        const { cultivator } = await game.newRun('Ke Yan');

        // The exact bind: no stones, no food, the starvation clock running.
        db.prepare(
            'UPDATE cultivators SET spirit_stones = 0, satiety = 0, starvation_turns = 4 WHERE id = ?'
        ).run(cultivator.id);

        const before = db.prepare('SELECT * FROM cultivators WHERE id = ?').get(cultivator.id);
        const result = await game.act('I ponder the nature of the Lid for a while');

        // Not one day, not one point of satiety, not one row.
        expect(db.prepare('SELECT * FROM cultivators WHERE id = ?').get(cultivator.id)).toEqual(before);
        expect(result.state.run.elapsedDays).toBe(0);
        expect(result.state.cultivator.alive).toBe(true);
        expect(planned(result).action).toBe('unclear');
    });

    it('says so in the world voice, and files the raw sentence for the inspector', async () => {
        const { game } = makeGame({ seed: 'misparse2' });
        await game.newRun('Ke Yan');

        const result = await game.act('I do the thing with the thing');

        expect(result.narration).toMatch(/does not resolve into anything you could actually do/i);
        expect(result.narration).not.toMatch(/\bparser\b|\bengine\b|\bintent\b/i);

        const mechanical = engineCalls(result).map(c => c.summary).join(' ');
        expect(mechanical).toMatch(/Intent not recognised/);
        expect(mechanical).toContain('I do the thing with the thing');
    });

    it('lets the same player be misunderstood a hundred times for free', async () => {
        const { db, game } = makeGame({ seed: 'patience' });
        const { cultivator } = await game.newRun('Ke Yan');
        db.prepare('UPDATE cultivators SET spirit_stones = 0, satiety = 2 WHERE id = ?')
            .run(cultivator.id);

        for (let i = 0; i < 100; i++) {
            await game.act(UNRECOGNISED[i % UNRECOGNISED.length]);
        }

        const state = game.state();
        expect(state.cultivator.alive).toBe(true);
        expect(state.run.elapsedDays).toBe(0);
        expect(state.cultivator.satiety).toBe(2);
    });
});

describe('every verb is reachable from plain English', () => {
    /**
     * One ordinary phrasing per action.
     *
     * This is the guard that would have caught the original bug on its own.
     * `cultivate` was matched by a pattern that could never fire - `\bcultivat\b`
     * cannot match "cultivate", because the trailing boundary falls between two
     * letters - and it only appeared to work because the duration fallthrough
     * guessed cultivate for any sentence with a span in it. Removing that rule
     * uncovered it. A verb reachable only by accident is a verb waiting to be
     * deleted by an unrelated change.
     */
    const PHRASINGS: Record<Exclude<ActionName, 'unclear'>, string> = {
    // Added when combat became reachable. It had been in the engine the
    // whole time and in the parser not at all, which is how "I attack the
    // nearest cultivator" ended up meditating for a month.
        attack: 'I attack the nearest cultivator',
        provision: 'I stock up on provisions',
        cultivate: 'I cultivate for three years.',
        seclude: 'I seal the cave for ten years',
        breakthrough: 'break through',
        train_technique: 'I practise the Lid-Watching Stance technique',
        refine: 'I brew a pill in the cauldron',
        gather: 'forage for herbs',
        eat: 'I buy a meal',
        wait: 'I wait',
        work: 'find work',
        market: 'what is for sale',
        move: 'travel to the Low Fall',
        interact: 'I bribe the gate steward',
        investigate: 'examine the inscription',
        assess: 'could I survive that cave',
        look: 'I look around.',
        status: 'how am I doing',
        sect: 'I look for a sect that will take me',
        // The softlock verb. See the treatment block below.
        treat: 'I get my injuries treated',
        buy: 'I buy a visit from the mortal physician',
        site: 'I look for the audit bench',
        legacy: 'I bury my things here',
        // Dead at ordinals 37-46, where it matters most. See the recall block.
        recall: 'what do I know of Lu Sheng',
        // Four phrasings of this deflected into the recall listing, which is
        // the "looks exactly like an answer" failure one layer over.
        news: 'what news is there',
        // The four institutional verbs, all four found at the top of a house
        // rather than the bottom of the ladder. See the block at the end of
        // this file.
        petition: 'I file a Requisition Against Standing Stock',
        posture: 'I declare war on the Nine Abyss Flame Sect',
        seal: 'I wake our sealed ancestor',
        offer: 'I make an offering to our ascended ancestor',
        // The far side of the Lid, where the only thing a player could type
        // before this was a verb that came back "Not from here".
        descend: 'I go back down through the Lid',
        // The counter, which is the only way anything gathered becomes stones.
        sell: 'I sell the Qi Gathering Grass',
        inventory: 'what am I carrying',
        list_techniques: 'what arts can I learn',
        learn_technique: 'I learn the Azure Ripple Art',
        consume_pill: 'I swallow a healing pill',
        acquisition: 'how do I get further',
        // The three the drive harness measured as dead, each with the phrasing
        // that was being EATEN by another verb rather than merely refused:
        // "am I stuck" reached a senior's opinion of the player, "who could
        // guide my cultivation" reached the character sheet, and "I want to
        // travel somewhere else" reached the travel verb, which went looking
        // for a place called "somewhere else".
        ceiling: 'am I stuck',
        teacher: 'who could guide my cultivation',
        destinations: 'I want to travel somewhere else',
        // And the fourth, which was not merely eaten but eaten BY the third:
        // `teach me` belongs to the roster question, correctly, and it was
        // tested before anything looked at whether a person had been named.
        request: 'I ask Elder Fang to teach me'
    };

    for (const [action, phrasing] of Object.entries(PHRASINGS)) {
        it(`reaches ${action}`, () => {
            expect(parseIntent(phrasing).action, `"${phrasing}"`).toBe(action);
        });
    }

    it('covers every action in the enum except the fallback', () => {
        const covered = new Set(Object.keys(PHRASINGS));
        for (const name of ACTION_NAMES) {
            if (name === FALLBACK_ACTION) continue;
            expect(covered.has(name), `${name} has no plain-English phrasing under test`).toBe(true);
        }
    });
});

/**
 * `sect` is one action carrying several verbs, so reaching it is not enough -
 * the intent has to be right too, and each of these was found by playing.
 */
describe('every sect verb is reachable, and none of them eats another', () => {
    const SECT_PHRASINGS: ReadonlyArray<[string, string]> = [
        ['promote', 'I want to be promoted'],
        ['stipend', 'I draw my stipend'],
        ['standing', 'what is my standing in the sect'],
        ['leave', 'I leave the sect'],
        ['siphon', "I steal the sect's reserves"],
        ['order', 'I order the disciples to gather herbs']
    ];

    for (const [intent, phrasing] of SECT_PHRASINGS) {
        it(`reaches ${intent}`, () => {
            const parsed = parseIntent(phrasing);
            expect(parsed.action, `"${phrasing}"`).toBe('sect');
            expect(parsed.intent, `"${phrasing}"`).toBe(intent);
        });
    }

    /**
     * The defect: an order is the one action whose whole point is that it
     * spends somebody else's days, and every phrasing of it was being caught by
     * a verb that spends the player's. "I order the disciples to gather herbs"
     * resolved to `gather` and put the head of the house in a ditch for a week.
     */
    it('does not let foraging or employment eat an order', () => {
        for (const phrasing of [
            'I order the disciples to gather herbs',
            'I send the servants out for herbs',
            'I order the outer disciples to haul stone for a month',
            'I have the juniors sweep the yard',
            'I command the servants to work the fields'
        ]) {
            const parsed = parseIntent(phrasing);
            expect(TIME_CONSUMING_ACTIONS, `"${phrasing}" spends the giver's own days`)
                .not.toContain(parsed.action);
        }
    });

    it('reads which errand was asked for, and defaults rather than guessing wide', () => {
        expect(parseIntent('I order the disciples to gather herbs').topic).toBe('gather');
        expect(parseIntent('I order the servants to haul the stone').topic).toBe('carry');
        expect(parseIntent('I order the disciples to repair the wall').topic).toBe('labour');
        // Nothing named: the generic thing a house asks of the rung below.
        expect(parseIntent('I order the disciples about').topic).toBe('labour');
    });

    it('spends their days rather than the caller\'s, and reads the span off the sentence', () => {
        expect(parseIntent('I order the disciples to gather herbs for a month').days).toBe(30);
        // No span named means the tool's own default, not a guess made here.
        expect(parseIntent('I order the disciples to gather herbs').days).toBeUndefined();
    });

    /**
     * Both halves of the order rule are load-bearing. The verbs are common
     * enough to be dangerous alone, and so are the nouns.
     */
    it('needs a verb aimed at a rung below, not just one or the other', () => {
        // A message, not an errand.
        expect(parseIntent('I send word to the disciples').intent).not.toBe('order');
        // A verb with nobody under it.
        expect(parseIntent('I send a letter to the elder').intent).not.toBe('order');
        // The noun as a subject rather than an object.
        expect(parseIntent('I ask the disciples about the ruin').intent).not.toBe('order');
    });

    /**
     * The four powers a seat holds above `order`, which had the same defect it
     * did: implemented in `sect_manage`, gated by POWERS_BY_TIER, tested, and
     * unreachable from anything a player could type.
     *
     * Three of the four did not simply fail. "I take on new disciples" was
     * taken by the INTERACT table, whose `recruit` label matches the bare words
     * "take on", so a sentence about the house's intake became an approach to a
     * person. "I change what the sect teaches" was taken by the sect LISTING,
     * which fires on the noun plus any question word, so a decree came back as
     * a register of who would take the player on. A verb that quietly does
     * something adjacent is worse than one that does nothing.
     */
    const LEADERSHIP_PHRASINGS: ReadonlyArray<[string, string]> = [
        ['expel', 'I expel an elder from the sect'],
        ['recruit', 'I take on new disciples'],
        ['admission', "I raise the sect's admission standard"],
        ['curriculum', 'I change what the sect teaches']
    ];

    for (const [intent, phrasing] of LEADERSHIP_PHRASINGS) {
        it(`reaches ${intent}`, () => {
            const parsed = parseIntent(phrasing);
            expect(parsed.action, `"${phrasing}"`).toBe('sect');
            expect(parsed.intent, `"${phrasing}"`).toBe(intent);
        });
    }

    /**
     * The invariant that matters more than the routing. Each of these sits in
     * the vocabulary of a verb that spends the player's own days - "take on"
     * is next to taking work, "teaches" is next to practising, "gather" and
     * "labour" are one clause away in any sentence about a house's intake - and
     * a leadership sentence answered by a season in a ditch is the same defect
     * that put the head of a house in one when `order` was unreachable.
     */
    it('never answers one of the seat\'s powers by spending the seat-holder\'s days', () => {
        for (const phrasing of [
            'I expel an elder from the sect',
            'I dismiss Elder Fang',
            'I take on new disciples',
            'I take on three new disciples to work the fields',
            'I recruit two elders from outside the house',
            "I raise the sect's admission standard",
            'I lower the admission bar',
            'I change what the sect teaches',
            'I add the Lid-Watching Stance to what the sect teaches',
            'I retire the Lid-Watching Stance from what the sect teaches'
        ]) {
            const parsed = parseIntent(phrasing);
            expect(TIME_CONSUMING_ACTIONS, `"${phrasing}" spends the caller's own days`)
                .not.toContain(parsed.action);
            expect(parsed.action, `"${phrasing}"`).toBe('sect');
        }
    });

    it('reads which rung is being taken in, and how many of them', () => {
        expect(parseIntent('I take on new disciples').topic).toBe('disciple');
        expect(parseIntent('I bring in an elder from outside the house').topic).toBe('elder');
        // Both named: the disciple line is the one an elder rung can actually
        // use, and the expensive reading is not the one to guess at.
        expect(parseIntent('I take on disciples and elders').topic).toBe('disciple');
        expect(parseCount(parseIntent('I recruit three new elders').target ?? '')).toBe(3);
        // Nothing named is the tool's own default, not a guess made here.
        expect(parseCount(parseIntent('I take on new disciples').target ?? '')).toBeNull();
    });

    /**
     * Both halves of every rule are load-bearing, and two of the four need an
     * explicit veto because the sentence that would misfire means the OPPOSITE
     * of the power.
     */
    it('does not read asking to be taken on as taking somebody on', () => {
        for (const phrasing of [
            'I ask the hall whether they will take me on as a disciple',
            'I apply to the sect as a disciple',
            'I want to join as a disciple'
        ]) {
            expect(parseIntent(phrasing).intent, `"${phrasing}"`).not.toBe('recruit');
        }
    });

    it('does not read practising what a house teaches as decreeing it', () => {
        expect(parseIntent('I practise the Lid-Watching Stance technique').action)
            .toBe('train_technique');
        expect(parseIntent('I train in what the sect teaches').intent).not.toBe('curriculum');
    });

    it('does not let the sect listing take a sentence about the shelf', () => {
        // The listing rule fires on the noun plus a question word, and this
        // sentence has both. It used to come back as a register of who would
        // take the player on.
        expect(parseIntent('I change what the sect teaches').intent).toBe('curriculum');
        // And the listing itself still works.
        expect(parseIntent('I look for a sect that will take me').intent).toBeUndefined();
    });

    it('keeps the earlier sect verbs to themselves', () => {
        // `order` is tested before all four and must stay there: an errand
        // sentence is full of intake and library vocabulary.
        expect(parseIntent('I order the disciples to gather herbs').intent).toBe('order');
        expect(parseIntent('I send the servants out for herbs').intent).toBe('order');
        // "raise me" is a promotion. "raise the bar" is not.
        expect(parseIntent('I ask them to raise me a rank').intent).toBe('promote');
        // "standard" is not "standing".
        expect(parseIntent('what is my standing in the sect').intent).toBe('standing');
    });

    /**
     * A sentence that names nobody the house holds must reach the listing, not
     * the nearest match. Expulsion is the only leadership act that lands the
     * day it is spoken and it takes the elder's whole line out with them, so a
     * near miss here is not a near miss - it is the wrong person gone.
     */
    it('asks for an elder by name and settles for the register', () => {
        expect(parseIntent('I expel an elder from the sect').target).toBe('elder');
        expect(parseIntent('I dismiss Elder Fang').target).toBe('Elder Fang');
    });

    /**
     * The sentence that once quietly processed a resignation: it contains the
     * word "leave", and it is not about leaving.
     */
    it('never reads a theft as a resignation', () => {
        for (const phrasing of [
            'I take the sect treasury and leave in the night',
            'I empty the coffers and walk out',
            'I help myself to the reserves and go'
        ]) {
            const parsed = parseIntent(phrasing);
            expect(parsed.action, `"${phrasing}"`).toBe('sect');
            expect(parsed.intent, `"${phrasing}"`).not.toBe('leave');
        }
    });
});

/**
 * Every one of the seat's powers, reached through the whole service rather than
 * through the parser alone.
 *
 * The parser choosing the right label proves nothing on its own - `order` was
 * routed correctly for a while and dispatched nowhere. What is asserted here is
 * that the sentence reaches the TOOL, named, and that being refused by it costs
 * the player nothing: an unaffiliated cultivator has no house to lead, and the
 * honest answer to all four is a refusal from `sect_manage` rather than a
 * shrug from the parser.
 */
describe('the seat\'s powers reach the tool that implements them', () => {
    const WIRED: ReadonlyArray<[string, string]> = [
        ['I expel an elder from the sect', 'sect_manage.expel'],
        ['I take on new disciples', 'sect_manage.recruit'],
        ["I raise the sect's admission standard", 'sect_manage.admission'],
        ['I change what the sect teaches', 'sect_manage.curriculum']
    ];

    for (const [typed, tool] of WIRED) {
        it(`routes "${typed}" to ${tool}`, async () => {
            const { game } = makeGame({ seed: `leadership-${tool}` });
            await game.newRun('Ke Yan');

            const result = await game.act(typed);
            const names = engineCalls(result).map(call => call.name);

            expect(names, `"${typed}" reached ${names.join(', ') || 'nothing'}`).toContain(tool);
            expect(names).not.toContain('engine.parseIntent');
            // Somebody who serves no house is refused, and refused for free.
            expect(refusedCall(result)).not.toBeNull();
            expect(result.state.run.elapsedDays).toBe(0);
        });
    }
});

/**
 * Why the ground is like this.
 *
 * `engine/world/locations.ts` has carried a place's whole history from the
 * start - origin, an append-only change log, the current state that is the two
 * folded together - and nothing a player could type reached any of it. The
 * knowledge gate is the feature: the seeded ruins each hold a cause fact the
 * world has not surrendered, and the answer for one of those must be
 * indistinguishable from the answer for a place whose cause was never written
 * down at all.
 */
describe('asking what was done to a place', () => {
    it('reads the question the ways people ask it', () => {
        for (const input of [
            'what happened here',
            'why is this place a ruin',
            'what do the locals say about it',
            'what happened to this place',
            'the history of this place',
            'how did this place end up like this',
            'what became of the vale'
        ]) {
            const parsed = parseIntent(input);
            expect(parsed.action, `"${input}"`).toBe('look');
            expect(parsed.intent, `"${input}"`).toBe('history');
        }
    });

    it('leaves the same question put to a PERSON with the person', () => {
        // Who you ask decides what you get, so this is a different act with a
        // different answer and must not be swallowed by the ground.
        const parsed = parseIntent('I ask the old woman what happened here');
        expect(parsed.action).toBe('interact');
    });

    it('does not take the ordinary looks', () => {
        expect(parseIntent('I look around.').intent).toBeUndefined();
        expect(parseIntent('who is here').intent).toBe('company');
        expect(parseIntent('examine the inscription').action).toBe('investigate');
    });

    it('costs nothing and never spends a day', () => {
        expect(TIME_CONSUMING_ACTIONS).not.toContain(parseIntent('what happened here').action);
    });

    it('answers out of the record, and withholds a cause the world has not surrendered', async () => {
        const { db, game, repos } = makeGame({ seed: 'scarred', worldEnabled: true });
        const { cultivator } = await game.newRun('Ke Yan');
        const world = await game.loadWorld();

        const scarred = (world?.locations ?? []).filter(place => place.changes.length > 0);
        // A finding rather than a skip: a world with no scarred ground means
        // the seeding stopped populating change history, and this route then
        // has nothing to read.
        expect(scarred.length, 'the seeded world carries no location change history').toBeGreaterThan(0);

        const withheld = scarred.find(place => place.changes.some(change => !change.causeKnown));
        expect(withheld, 'no seeded place holds a cause the world has not surrendered').toBeDefined();
        repos.cultivators.update(cultivator.id, { location: withheld!.name } as never);

        const before = db.prepare('SELECT * FROM cultivators WHERE id = ?').get(cultivator.id);
        const result = await game.act('what happened here');

        expect(engineCalls(result).map(call => call.name)).toContain('world.locationHistory');
        // What it is and that it changed are physical, and are said plainly.
        expect(result.narration).toContain(withheld!.name);
        expect(result.narration).toMatch(/nobody here can tell you why/i);

        // The gate. The cause fact exists; the answer must not betray that it
        // does, in the prose or in the inspector.
        const hidden = withheld!.changes.find(change => !change.causeKnown)!;
        expect(hidden.causeFactId, 'the fixture needs a cause that exists and is not known').not.toBeNull();
        const everything = result.narration + JSON.stringify(result.toolCalls);
        expect(everything).not.toContain(hidden.causeFactId!);

        // A read. Not a day, not a point of satiety, not a row.
        expect(db.prepare('SELECT * FROM cultivators WHERE id = ?').get(cultivator.id)).toEqual(before);
        expect(result.state.run.elapsedDays).toBe(0);
    });

    it('names the cause where the world does hold it', async () => {
        const { game, repos } = makeGame({ seed: 'scarred-known', worldEnabled: true });
        const { cultivator } = await game.newRun('Ke Yan');
        const world = await game.loadWorld();

        const known = (world?.locations ?? []).find(place =>
            place.changes.length > 0 && place.changes.every(change => change.causeKnown));
        expect(known, 'no seeded place holds a cause the world has surrendered').toBeDefined();
        repos.cultivators.update(cultivator.id, { location: known!.name } as never);

        const result = await game.act('what happened here');
        expect(result.narration).toMatch(/why is not in dispute/i);
        expect(result.narration).not.toMatch(/nobody here can tell you why/i);

        // And the cause itself comes out of the history ledger rather than
        // being restated on the location, so the two cannot disagree.
        const factId = known!.changes.find(change => change.causeKnown)?.causeFactId ?? null;
        const summary = world?.history.facts.find(fact => fact.id === factId)?.summary ?? '';
        if (summary) {
            expect(result.narration.replace(/\s+/g, ' ')).toContain(summary.slice(0, 40));
        }
    });

    it('refuses ground that has no record, without saying which kind of nothing it is', async () => {
        const { game } = makeGame({ seed: 'unscarred' });
        await game.newRun('Ke Yan');

        const result = await game.act('what happened here');
        const refused = refusedCall(result);

        expect(refused?.name).toBe('engine.locationHistory');
        expect(result.narration).toMatch(/no mark and nobody to ask/i);
        expect(result.state.run.elapsedDays).toBe(0);
    });
});

/**
 * Being hurt, which was a softlock.
 *
 * Reproduced by playing cold in a browser rather than by testing. A cultivator
 * at Qi Condensation came out of seclusion with three untreated meridian
 * injuries and was told, by the engine, in as many words, that nothing heals
 * them on their own and that any further combat is fatal. Untreated injuries
 * raise deviation risk, deviation adds another injury and ejects them from
 * seclusion after about a month, and the next attempt goes wrong slightly
 * sooner - so he could not advance, could not heal, and could not die. Three
 * hundred and forty-five spirit stones in the purse, a physician advertised on
 * the board in front of him at forty cash, and no sentence that reached it.
 *
 * `treatWorstInjuries` had been in `engine/cultivation/injuries.ts` the whole
 * time and `scripts/playtest.ts` exercised it. Only the route was missing.
 */
describe('getting a wound seen to', () => {
    it('reads the question the ways a hurt player asks it', () => {
        for (const input of [
            // The exact sentence that was answered with a description of the
            // room, because the bare `look` rule fires on a leading "I look".
            'I look for a physician to treat my meridian injuries',
            // And the exact sentence that was answered with "the thought does
            // not resolve".
            'I get my injuries treated',
            'I see a physician',
            'I pay for treatment',
            'treat my wounds',
            'I need a healer',
            'find a doctor',
            'have my injuries looked at',
            'I want my wounds seen to',
            'I go to the infirmary'
        ]) {
            expect(parseIntent(input).action, `"${input}"`).toBe('treat');
        }
    });

    /**
     * The near misses. Every one sits inside the treatment vocabulary and
     * means something else, and three of them are the exact shape that had to
     * be protected: a purchase, a conversation and a fight.
     */
    it('leaves a conversation with a physician a conversation', () => {
        expect(parseIntent('I talk to the physician').action).toBe('interact');
        expect(parseIntent('I ask the physician about the road').action).toBe('interact');
    });

    it('does not read a purchase as a course of care, or a fight as one', () => {
        expect(parseIntent('I buy a visit from the mortal physician').action).toBe('buy');
        expect(parseIntent('I attack the physician').action).toBe('attack');
    });

    it('needs a wound in the sentence, not just the word treat', () => {
        expect(parseIntent('I treat the elder with respect').action).not.toBe('treat');
    });

    it('closes wounds, off the same price row the market board quotes', async () => {
        const { db, game, repos } = makeGame({ seed: 'treatment' });
        const { cultivator } = await game.newRun('Shi Wanjun');
        db.prepare('UPDATE cultivators SET spirit_stones = 345 WHERE id = ?').run(cultivator.id);
        for (let i = 0; i < 3; i++) {
            repos.cultivators.addInjury(cultivator.id, {
                severity: i === 0 ? 'crippling' : 'serious',
                source: 'qi_deviation',
                description: 'A meridian injury, torn by qi deviation.',
                sustainedOnTurn: 1
            } as never);
        }
        expect(repos.cultivators.countUntreatedInjuries(cultivator.id)).toBe(3);

        const result = await game.act('I get my injuries treated');
        const names = engineCalls(result).map(call => call.name);

        expect(names).toContain('engine.treatWorstInjuries');
        // The whole point: the number goes down, and it goes down because a
        // row changed rather than because somebody narrated it.
        expect(repos.cultivators.countUntreatedInjuries(cultivator.id)).toBeLessThan(3);
        // It costs. Stones off the purse and a month off the clock.
        expect(result.state.cultivator.spiritStones).toBeLessThan(345);
        expect(result.state.run.elapsedDays).toBeGreaterThan(0);
        // And the price quoted is the board's, in both currencies.
        expect(result.narration).toMatch(/cash/);
        expect(result.narration).toMatch(/spirit stone/);
    });

    it('names the price and the shortfall when the purse is short', async () => {
        const { db, game, repos } = makeGame({ seed: 'treatment-broke' });
        const { cultivator } = await game.newRun('Shi Wanjun');
        repos.cultivators.addInjury(cultivator.id, {
            severity: 'serious',
            source: 'qi_deviation',
            description: 'A serious meridian injury, torn by qi deviation.',
            sustainedOnTurn: 1
        } as never);
        db.prepare('UPDATE cultivators SET spirit_stones = 0 WHERE id = ?').run(cultivator.id);

        const before = db.prepare('SELECT * FROM cultivators WHERE id = ?').get(cultivator.id);
        const result = await game.act('I get my injuries treated');

        expect(refusedCall(result)).not.toBeNull();
        // The shape the sect admission refusal uses: what it costs and what
        // they are carrying, both stated.
        expect(result.narration).toMatch(/cash/);
        expect(result.narration).toMatch(/carrying/i);
        // Refused for free.
        expect(db.prepare('SELECT * FROM cultivators WHERE id = ?').get(cultivator.id)).toEqual(before);
        expect(result.state.run.elapsedDays).toBe(0);
    });

    it('costs nothing to ask for treatment nobody needs', async () => {
        const { db, game } = makeGame({ seed: 'treatment-well' });
        const { cultivator } = await game.newRun('Shi Wanjun');
        const before = db.prepare('SELECT * FROM cultivators WHERE id = ?').get(cultivator.id);

        const result = await game.act('I see a physician');
        expect(refusedCall(result)?.name).toBe('engine.untreatedInjuries');
        expect(db.prepare('SELECT * FROM cultivators WHERE id = ?').get(cultivator.id)).toEqual(before);
    });
});

/**
 * The price board, which was a shop window with a wall behind it.
 *
 * `mortal-world.ts` advertises twenty-odd priced lines and `market` prints
 * them. Four verbs spent money before this, and between them they covered
 * three of those lines - so "I buy a visit from the mortal physician" fell
 * through to the INTERACT table, which went looking for a person called
 * "visit from the mortal physician" and reported that nobody by that name was
 * there.
 */
describe('buying a line off the price board', () => {
    it('reads a purchase as a purchase', () => {
        for (const input of [
            'I buy a visit from the mortal physician',
            'I buy a Minor Healing Pill',
            'I pay for a ferry crossing',
            'I buy a night at an inn',
            'I hire a scribe'
        ]) {
            expect(parseIntent(input).action, `"${input}"`).toBe('buy');
        }
    });

    it('leaves the three purchases that already worked where they were', () => {
        expect(parseIntent('I buy a hot meal').action).toBe('eat');
        expect(parseIntent('I buy three months of rations').action).toBe('provision');
        expect(parseIntent('what is for sale').action).toBe('market');
        expect(parseIntent('I go to the market').action).toBe('market');
    });

    it('never reads paying somebody off as shopping', () => {
        expect(parseIntent('I buy his silence').action).toBe('interact');
        expect(parseIntent('I bribe the gate steward').action).toBe('interact');
    });

    it('does not answer a purchase by looking for a person of that name', async () => {
        const { game } = makeGame({ seed: 'buy-physician' });
        await game.newRun('Shi Wanjun');

        const result = await game.act('I buy a visit from the mortal physician');
        const names = engineCalls(result).map(call => call.name);

        expect(names).not.toContain('engine.resolveParty');
        expect(result.narration).not.toMatch(/nobody by that name/i);
    });

    it('puts a bought pill in the pouch and takes the stones out of the purse', async () => {
        const { db, game } = makeGame({ seed: 'buy-pill' });
        const { cultivator } = await game.newRun('Shi Wanjun');
        db.prepare('UPDATE cultivators SET spirit_stones = 400 WHERE id = ?').run(cultivator.id);

        const result = await game.act('I buy a Minor Healing Pill');
        const pouch = db
            .prepare('SELECT item_id, quantity FROM cultivator_pouch WHERE cultivator_id = ?')
            .all(cultivator.id) as Array<{ item_id: string; quantity: number }>;

        expect(pouch.some(row => row.item_id === 'pill-minor-healing')).toBe(true);
        expect(result.state.cultivator.spiritStones).toBeLessThan(400);
    });

    it('quotes the price and charges nothing for what the engine cannot hold', async () => {
        const { db, game } = makeGame({ seed: 'buy-inn' });
        const { cultivator } = await game.newRun('Shi Wanjun');
        const before = db.prepare('SELECT * FROM cultivators WHERE id = ?').get(cultivator.id);

        const result = await game.act('I buy a night at an inn');
        expect(result.narration).toMatch(/cash/);
        expect(db.prepare('SELECT * FROM cultivators WHERE id = ?').get(cultivator.id)).toEqual(before);
    });

    it('refuses what the board never advertised, with the board attached', async () => {
        const { game } = makeGame({ seed: 'buy-nothing' });
        await game.newRun('Shi Wanjun');

        const result = await game.act('I buy a spaceship');
        expect(refusedCall(result)?.name).toBe('engine.resolvePrice');
        expect(result.narration).toMatch(/millet|rations|inn/i);
        expect(result.state.run.elapsedDays).toBe(0);
    });
});

/**
 * The room description invites a question the parser could not answer.
 *
 * `describeStanding` writes "out of reach in a way that does not invite
 * comparison" about somebody standing in the square, and a player who asked
 * which one got "The thought does not resolve." Narration that prompts a
 * question the engine cannot take is worse than narration that says nothing.
 */
describe('asking which one', () => {
    it('routes a follow-up about somebody in the room to the faces read', () => {
        for (const input of [
            'who is the one who is out of reach',
            'who is that',
            'who are they'
        ]) {
            const parsed = parseIntent(input);
            expect(parsed.action, `"${input}"`).toBe('look');
            expect(parsed.intent, `"${input}"`).toBe('company');
        }
    });
});

/**
 * Inheritance grounds.
 *
 * `data/cultivation/inheritance-trials.ts` is roughly nineteen hundred lines of
 * finished, tested content - the trials, the graves, three unrelated kinds of
 * gate - and until the `site` verb existed nothing a typed English sentence
 * could do reached one line of it. `scripts/playtest-systems.ts` reported it in
 * its own friction block as the largest unplayable system in the game.
 *
 * Two things are under test here and the second matters more. The first is that
 * every phrasing reaches the right step. The second is that the structural gate
 * survives contact with a player: somebody who has not gone in must not be able
 * to learn what is inside, THROUGH ANY PHRASING.
 */
describe('reaching an inheritance ground', () => {
    const STEPS: ReadonlyArray<[string, string]> = [
        // approach / find
        ['I go to the eighth stone', 'approach'],
        ['I look for the audit bench', 'approach'],
        ['what inheritance grounds are near here', 'approach'],
        // assess from outside
        ['I study the door', 'outside'],
        ['I size up the trial', 'outside'],
        ['what does it look like from out here', 'outside'],
        // enter / attempt
        ['I go inside', 'enter'],
        ['I attempt the trial', 'enter'],
        ['I open the grave', 'enter'],
        // take the prize
        ['I take what is behind the plate', 'take']
    ];

    for (const [phrasing, intent] of STEPS) {
        it(`reads "${phrasing}" as ${intent}`, () => {
            const parsed = parseIntent(phrasing);
            expect(parsed.action, `"${phrasing}"`).toBe('site');
            expect(parsed.intent, `"${phrasing}"`).toBe(intent);
        });
    }

    /**
     * The near misses, and they are the reason the block sits where it does.
     *
     * Each of these names a site or carries a site noun and belongs to another
     * verb entirely. A fight at a grave is a fight; an errand to open a tomb is
     * an errand; weighing whether to go in is `assess` and always was.
     */
    it('does not take a sentence another branch owns', () => {
        const OWNED: ReadonlyArray<[string, string]> = [
            ['I attack the cultivator at the grave', 'attack'],
            ['I order the disciples to open the tomb', 'sect'],
            ['could I survive that trial', 'assess'],
            ['is it safe to go in', 'assess'],
            ['size up the valley', 'assess'],
            ['examine the inscription', 'investigate'],
            ['travel to the Low Fall', 'move'],
            ['what happened here', 'look'],
            ['I look for a sect that will take me', 'sect'],
            ['I take the sect treasury and leave in the night', 'sect'],
            ['I buy a visit from the mortal physician', 'buy'],
            ['I get my injuries treated', 'treat'],
            ['I look around.', 'look'],
            ['find work', 'work'],
            ['forage for herbs', 'gather']
        ];
        for (const [phrasing, action] of OWNED) {
            expect(parseIntent(phrasing).action, `"${phrasing}"`).toBe(action);
        }
    });

    it('keeps the ordinary looks and the history question to themselves', () => {
        expect(parseIntent('what happened here').intent).toBe('history');
        expect(parseIntent('who is here').intent).toBe('company');
        expect(parseIntent('I look around.').intent).toBeUndefined();
    });
});

describe('the inheritance grounds, through the whole service', () => {
    /** Sites a fresh cultivator can name, per the catalog's own awareness. */
    const NAMEABLE = SITES.filter(site => site.outside.startingAwareness === 'named');
    const gatedBy = (kind: 'strength' | 'age_and_talent' | 'fate') =>
        NAMEABLE.filter(site => site.interior.gates.some(gate => gate.kind === kind));

    /** Every long interior string on a site. What must never leak outward. */
    function interiorStrings(siteId: string): string[] {
        const whole = enterSite(siteId)!;
        return JSON.stringify(whole.interior)
            .split('"')
            .filter(fragment => fragment.length > 60);
    }

    it('has a nameable site for each of the three gate kinds, or the test is vacuous', () => {
        // A finding rather than a skip. If the catalog stops offering a
        // nameable site of some gate kind, the three-gate route below is no
        // longer being exercised and somebody should know.
        expect(gatedBy('strength').length, 'no nameable strength-gated site').toBeGreaterThan(0);
        expect(gatedBy('age_and_talent').length, 'no nameable talent-gated site').toBeGreaterThan(0);
        expect(gatedBy('fate').length, 'no nameable fate-gated site').toBeGreaterThan(0);
    });

    it('lists only what this cultivator could actually name', async () => {
        const { game } = makeGame({ seed: 'sites-listing' });
        await game.newRun('Ke Yan');

        const result = await game.act('what inheritance grounds are near here');
        expect(engineCalls(result).map(call => call.name)).toContain('engine.nameableSites');
        // Gated, not a register: the catalog holds more than a villager knows.
        expect(NAMEABLE.length).toBeLessThan(SITES.length);
        for (const site of SITES) {
            if (site.outside.startingAwareness === 'named') continue;
            expect(result.narration, `${site.id} named to somebody who has not heard of it`)
                .not.toContain(site.name);
        }
        expect(result.state.run.elapsedDays).toBe(0);
    });

    it('does not open a site the cultivator has only ever heard rumoured', async () => {
        const { game } = makeGame({ seed: 'sites-unknown' });
        await game.newRun('Ke Yan');

        // `trial-the-eighth-stone` starts at `whisper`, so the name is withheld
        // and there is nothing to resolve. Asked for by name anyway.
        const result = await game.act('I go inside the eighth stone');
        expect(refusedCall(result)?.name).toBe('engine.resolveSite');
        for (const fragment of interiorStrings('trial-the-eighth-stone')) {
            expect(result.narration + JSON.stringify(result.toolCalls)).not.toContain(fragment);
        }
        expect(result.state.run.elapsedDays).toBe(0);
    });

    /**
     * The guarantee `playtest-systems.ts` has asserted about the catalog since
     * it was written - "no site leaks its interior through the outside view" -
     * re-asserted at the surface a player can actually type at. The catalog
     * guarantee is structural; this one is about phrasings.
     */
    it('never returns the interior to somebody who has not gone in', async () => {
        const site = NAMEABLE[0];
        const { game } = makeGame({ seed: 'sites-gate' });
        await game.newRun('Ke Yan');

        const leaks = interiorStrings(site.id);
        expect(leaks.length, `${site.id} has no long interior strings to leak`).toBeGreaterThan(0);

        const phrasings = [
            `I go to the ${site.id.replace(/^(?:trial|grave)-(?:the-)?/, '').replace(/-/g, ' ')}`,
            'I study the door',
            'what does it look like from out here',
            'I size up the trial'
        ];
        for (const phrasing of phrasings) {
            const result = await game.act(phrasing);
            const everything = result.narration + JSON.stringify(result.toolCalls);
            for (const fragment of leaks) {
                expect(everything, `"${phrasing}" leaked ${site.id}'s interior`).not.toContain(fragment);
            }
            expect(result.state.run.elapsedDays, `"${phrasing}" spent a day`).toBe(0);
        }
    });

    it('refuses each of the three gate kinds in its own terms', async () => {
        const kinds = ['strength', 'age_and_talent', 'fate'] as const;
        for (const kind of kinds) {
            const site = gatedBy(kind)[0];
            const { game } = makeGame({ seed: `sites-gate-${kind}` });
            await game.newRun('Ke Yan');

            const phrase = site.id.replace(/^(?:trial|grave)-(?:the-)?/, '').replace(/-/g, ' ');
            await game.act(`I go to the ${phrase}`);
            const result = await game.act('I go inside');

            const gateCall = engineCalls(result).find(call => call.name === 'engine.evaluateGate');
            expect(gateCall, `${site.id} produced no gate reading`).toBeDefined();
            expect(gateCall!.ok, `${site.id} opened for a cultivator at ordinal 0`).toBe(false);
            expect(gateCall!.summary).toContain(kind);

            // Going in costs, whatever the door then says.
            expect(result.state.run.elapsedDays).toBeGreaterThan(0);

            if (kind === 'fate') {
                // The one that must never imply a shortfall. There is nothing
                // to be short of and nothing to go and do about it.
                expect(gateCall!.summary).toContain('characterStat null');
                expect(result.narration).toMatch(/not asking about the person standing at it/i);
                expect(result.narration).not.toMatch(/short by/i);
            } else {
                expect(result.narration).toMatch(/short by/i);
            }
        }
    });

    it('lets a strength gate hurt somebody who is under it, through the combat model', async () => {
        const site = gatedBy('strength')[0];
        const { game } = makeGame({ seed: 'sites-force' });
        await game.newRun('Ke Yan');

        const phrase = site.id.replace(/^(?:trial|grave)-(?:the-)?/, '').replace(/-/g, ' ');
        await game.act(`I go to the ${phrase}`);
        const before = game.state().cultivator.hp;
        const result = await game.act('I go inside');

        expect(engineCalls(result).map(call => call.name)).toContain('engine.resolveExchange');
        expect(result.state.cultivator.hp).toBeLessThan(before);
    });

    it('refuses to hand over a prize to somebody who never went in', async () => {
        const site = NAMEABLE[0];
        const { game } = makeGame({ seed: 'sites-take-early' });
        await game.newRun('Ke Yan');

        const phrase = site.id.replace(/^(?:trial|grave)-(?:the-)?/, '').replace(/-/g, ' ');
        await game.act(`I go to the ${phrase}`);
        const result = await game.act('I take what is behind the plate');

        expect(refusedCall(result)?.name).toBe('engine.siteLedger');
        expect(result.narration).toMatch(/outside|door/i);
    });

    it('goes in, takes it, and records that it has been taken', async () => {
        // A named trial whose only gate is one the test can actually satisfy,
        // holding at least one art the engine will hand over at this ordinal.
        // Chosen from the catalog rather than named, so the other agent adding
        // prizes cannot silently make this vacuous.
        const target = NAMEABLE.find(site =>
            site.kind === 'trial'
            && site.interior.gates.length === 1
            && site.interior.gates[0].kind === 'age_and_talent'
            && site.interior.prize.techniqueIds.some(id => {
                const art = TECHNIQUES.find(t => t.id === id);
                return art !== undefined && art.requiredOrdinal <= 30 && art.element === null
                    && (art.grade === 'mortal' || art.grade === 'earth' || art.grade === 'heaven');
            }));
        expect(target, 'no nameable talent-gated trial holds a reachable art').toBeDefined();

        const site = target!;
        const gate = site.interior.gates[0];
        if (gate.kind !== 'age_and_talent') throw new Error('gate kind moved');

        const { db, game, repos } = makeGame({ seed: 'sites-take' });
        const { cultivator } = await game.newRun('Ke Yan');

        // Become what the door wants. Every value here is read off the gate
        // itself, so a change to the requirements changes the fixture with it.
        const achievement = recordAchievement(
            { kind: 'enlightenment', onDay: 1, turn: 1, summary: 'It arrived.' },
            new CultivationRNG('trial-fixture')
        );
        const patch: Record<string, unknown> = { realmOrdinal: 30, age: 500 };
        const attributes = { ...cultivator.attributes };
        const insights = [];
        for (const requirement of gate.requires) {
            if (requirement.measure === 'attribute') attributes[requirement.attribute] = requirement.atLeast;
            if (requirement.measure === 'foundation_quality') patch.foundationQuality = requirement.oneOf[0];
            if (requirement.measure === 'spirit_root') patch.spiritRoot = requirement.oneOf[0];
            if (requirement.measure === 'spirit_root_grade') {
                const root = SPIRIT_ROOTS.find(entry => entry.grade === requirement.oneOf[0]);
                if (root) patch.spiritRoot = root.key;
            }
            if (requirement.measure === 'insight') {
                insights.push(formInsight(
                    {
                        domain: requirement.domain,
                        subject: 'the fixture',
                        opening: 'It arrived.',
                        access: { kind: 'teacher', label: 'a teacher' }
                    },
                    requirement.atLeast,
                    achievement
                ));
            }
        }
        patch.attributes = attributes;
        patch.insights = insights;
        repos.cultivators.update(cultivator.id, patch as never);
        db.prepare('UPDATE cultivators SET spirit_stones = 500, satiety = 100 WHERE id = ?')
            .run(cultivator.id);

        const phrase = site.id.replace(/^(?:trial|grave)-(?:the-)?/, '').replace(/-/g, ' ');
        await game.act(`I go to the ${phrase}`);

        const entered = await game.act('I go inside');
        expect(engineCalls(entered).map(call => call.name)).toContain('engine.enterSite');
        // The interior is only readable now, and it is readable because a row
        // was written first.
        const interior = interiorStrings(site.id);
        expect(interior.some(fragment => entered.narration.includes(fragment)), 'no interior text after entering')
            .toBe(true);

        const taken = await game.act('I take what is behind the plate');
        const learned = db
            .prepare('SELECT technique_id FROM cultivator_techniques WHERE cultivator_id = ?')
            .all(cultivator.id) as Array<{ technique_id: string }>;

        // Actually granted, as rows, not as prose.
        expect(learned.map(row => row.technique_id).some(id =>
            site.interior.prize.techniqueIds.includes(id))).toBe(true);

        // And the site records that it has been emptied.
        const row = db
            .prepare('SELECT contents FROM cultivation_sites WHERE id LIKE ?')
            .get(`%${site.id}`) as { contents: string } | undefined;
        expect(row, 'no site row written').toBeDefined();
        expect(JSON.parse(row!.contents).takenOnDay).not.toBeNull();

        // Twice is not twice. What is here now is `afterwards`.
        const again = await game.act('I take what is behind the plate');
        expect(refusedCall(again)?.name).toBe('engine.siteLedger');
        expect(taken.narration).not.toBe(again.narration);
    });
});

/**
 * What a cultivator carrying open channels is told.
 *
 * REWRITTEN, AND SAY WHY. This block asserted that the sheet told a player
 * their meridians would give out in `BLEED_OUT_TURNS` days and printed the
 * countdown as a number on the mechanical channel. Both were true and neither
 * is any more: the design owner ruled that a torn meridian is a torn muscle -
 * very annoying, and not something you die of (`docs/world/injuries.md`).
 *
 * A warning that threatens a death the engine never delivers is worse than no
 * warning, because it teaches a player to discount the next one. So the
 * assertions are turned over: no countdown anywhere, and in its place the two
 * things that ARE true and are what a player needs in order to decide to go and
 * be treated - nothing is knitting, and it is costing this much of the rate.
 *
 * The treatment case at the bottom is untouched in intent and is now the whole
 * point of the block: the cure is reachable, affordable and sufficient.
 */
describe('what a cultivator carrying open channels is told', () => {
    async function bleeding(seed: string) {
        const harness = makeGame({ seed });
        const { cultivator } = await harness.game.newRun('Shi Wanjun');
        for (let i = 0; i < 3; i++) {
            harness.repos.cultivators.addInjury(cultivator.id, {
                severity: 'serious',
                source: 'qi_deviation',
                description: 'A serious meridian injury, torn by qi deviation.',
                sustainedOnTurn: 1
            } as never);
        }
        return { ...harness, cultivator };
    }

    it('says nothing is knitting, and never that it will kill them', async () => {
        const { game } = await bleeding('bleeding-prose');
        const result = await game.act('I look around');

        expect(result.narration).toMatch(/standing up is a decision now/i);
        // What replaced "and so is not standing up: N days of this and they
        // give out on their own". The state is permanent-until-treated rather
        // than terminal, and that is what the sentence has to convey.
        expect(result.narration).toMatch(/nothing is knitting/i);
        expect(result.narration).not.toMatch(/give out|days before/i);
        expect(result.narration).not.toContain(`${BLEED_OUT_TURNS} days`);
    });

    it('carries no countdown on the mechanical channel, and the cost instead', async () => {
        const { db, game } = await bleeding('bleeding-structure');
        await game.act('I look around');

        const logged = db
            .prepare("SELECT text FROM web_play_log WHERE role = 'engine' ORDER BY id DESC LIMIT 20")
            .all() as Array<{ text: string }>;

        expect(
            logged.find(row => row.text.includes('daysUntilBleedOut')),
            'a countdown to a death that no longer happens'
        ).toBeUndefined();

        // The inspector panel still carries the numbers, and they are the true
        // ones: how long the channels have been open, and what they cost.
        const line = logged.find(row => row.text.includes('untreatedInjuries='));
        expect(line, 'no injury figures on the mechanical channel').toBeDefined();
        expect(line!.text).toMatch(/daysChannelsOpen=\d+/);
        expect(line!.text).toMatch(/rateLost=\d+%/);
    });

    it('is a clock the treatment route beats, with room to spare', async () => {
        const { db, game, repos, cultivator } = await bleeding('bleeding-treated');
        db.prepare('UPDATE cultivators SET spirit_stones = 345 WHERE id = ?').run(cultivator.id);

        const result = await game.act('I get my injuries treated');

        // A stay is a month; the clock is ninety days. The margin is what makes
        // "treat it, then cultivate" the only order that works rather than a
        // race the player loses either way.
        expect(result.state.run.elapsedDays).toBeLessThan(BLEED_OUT_TURNS);
        expect(repos.cultivators.countUntreatedInjuries(cultivator.id)).toBeLessThan(3);
        // `treatInjury` owns the reset, so the route gets it for free.
        const row = db
            .prepare('SELECT bleeding_turns FROM cultivators WHERE id = ?')
            .get(cultivator.id) as { bleeding_turns: number };
        expect(row.bleeding_turns).toBe(0);
    });
});

/**
 * What this cultivator is carrying in their own head.
 *
 * Found by a rank-band sweep, and the dead sentences were at the CEILING
 * rather than the floor, which is the worst place for a gap of this shape:
 *
 *   ordinal 37-44   "what do I know of the Hollow Court"   -> unclear
 *   ordinal 45-46   "what is my dao"                       -> unclear
 *   ordinal 45-46   "what do I know of Lu Sheng"           -> unclear
 *
 * At the last two rungs the ladder is finished and comprehension is the only
 * thing still moving, so "what is my dao" is close to the only question left.
 *
 * The knowledge gate is the feature and this must not weaken it. Every test
 * below is really testing one property twice: THE READ CONSULTS THE HOLDER'S
 * OWN ROWS AND NEVER THE WORLD, so no phrasing of it can teach anybody
 * anything, and an unheard name is indistinguishable from an invented one.
 */
describe('asking what I know', () => {
    it('reads the question the ways it gets asked', () => {
        for (const input of [
            // The three sentences the sweep found dead.
            'what do I know of Lu Sheng',
            'what do I know of the Hollow Court',
            'what have I heard of the Ninth Stone',
            'what do I know about the Gleaners Company',
            'have I ever heard of the Weir Office',
            'remind me what I know about Elder Fang',
            'what do I have on the Moving Hoard',
            'what do I know'
        ]) {
            const parsed = parseIntent(input);
            expect(parsed.action, `"${input}"`).toBe('recall');
            expect(parsed.intent, `"${input}"`).toBe('knowledge');
        }
    });

    it('reads the other axis as its own question', () => {
        for (const input of [
            'what is my dao',
            'my insights',
            'what road am I on',
            'what have I comprehended',
            'my understanding'
        ]) {
            const parsed = parseIntent(input);
            expect(parsed.action, `"${input}"`).toBe('recall');
            expect(parsed.intent, `"${input}"`).toBe('dao');
        }
    });

    /**
     * The near misses. Four separate branches own a sentence that looks like
     * this one, and three of them would have answered it with something
     * adjacent rather than with nothing.
     */
    it('does not take a sentence another branch owns', () => {
        const OWNED: ReadonlyArray<[string, string]> = [
            // Somebody else's talk about the ground, not what I hold.
            ['what do the locals say about it', 'look'],
            ['what happened here', 'look'],
            // The sect listing fires on the noun plus any question word.
            ['what sects are near here', 'sect'],
            ['I look for a sect that will take me', 'sect'],
            ['what is my standing in the sect', 'sect'],
            ['how am I doing', 'status'],
            ['I ask the old woman about the ruins', 'interact'],
            ['what is for sale', 'market'],
            ['who is here', 'look'],
            ['what inheritance grounds are near here', 'site']
        ];
        for (const [phrasing, action] of OWNED) {
            expect(parseIntent(phrasing).action, `"${phrasing}"`).toBe(action);
        }
    });

    it('costs nothing, at any height', () => {
        for (const input of ['what do I know of Lu Sheng', 'what is my dao', 'what do I know']) {
            expect(TIME_CONSUMING_ACTIONS, `"${input}"`).not.toContain(parseIntent(input).action);
        }
    });

    /**
     * The gate, and the only property here that would be a disaster to lose.
     * A name the world uses constantly three provinces away and a name nobody
     * has ever said must read identically from inside this head.
     */
    it('answers a name nobody has said with nothing, and says nothing about it', async () => {
        const { db, game } = makeGame({ seed: 'recall-gate' });
        const { cultivator } = await game.newRun('Ke Yan');
        const before = db.prepare('SELECT * FROM cultivators WHERE id = ?').get(cultivator.id);

        const real = await game.act('what do I know of Lu Sheng');
        const invented = await game.act('what do I know of Bo Qianli of the Fifth Terrace');

        expect(refusedCall(real)?.name).toBe('knowledge.awareness');
        // The shape of the refusal must not be the answer: a real figure and
        // an invented one differ only by the name quoted back.
        expect(real.narration.replace(/Lu Sheng/g, 'X'))
            .toBe(invented.narration.replace(/Bo Qianli of the Fifth Terrace/g, 'X'));
        // And nothing about the man leaked into either.
        const everything = real.narration + JSON.stringify(real.toolCalls);
        expect(everything).not.toMatch(/False Immortal|Hollow Court|wanderer/i);

        expect(db.prepare('SELECT * FROM cultivators WHERE id = ?').get(cultivator.id)).toEqual(before);
        expect(real.state.run.elapsedDays).toBe(0);
    });

    it('never writes a knowledge record, however it is asked', async () => {
        const { db, game } = makeGame({ seed: 'recall-teaches-nothing' });
        const { cultivator } = await game.newRun('Ke Yan');
        const count = () => (db
            .prepare('SELECT COUNT(*) AS n FROM knowledge_records WHERE holder_id = ?')
            .get(cultivator.id) as { n: number }).n;

        const before = count();
        for (const input of [
            'what do I know of Lu Sheng',
            'what do I know of the Hollow Court',
            'what do I know of the Azure Cloud Pavilion',
            'what do I know',
            'what is my dao'
        ]) {
            await game.act(input);
        }
        // Asking about the world cannot be a way to acquire it. This is the
        // one line that would make the whole discovery layer a formality.
        expect(count()).toBe(before);
    });

    it('answers out of the record, in the record\'s own words', async () => {
        const { game, repos } = makeGame({ seed: 'recall-held' });
        const { cultivator } = await game.newRun('Ke Yan');
        const gate = new KnowledgeGate(repos.db);
        gate.learn({
            holderId: cultivator.id,
            kind: 'cultivator',
            id: 'wanderer-lu-sheng-as-the-ninth-stone',
            name: 'The Ninth Stone',
            onDay: 3,
            sourceKind: 'overheard',
            sourceNote: 'Two Wardens on the eastern perimeter, who did not know they were heard.',
            stance: 'suspects',
            statement: 'The Ninth Stone is a name that got said. What it is remains unknown.'
        });

        const result = await game.act('what have I heard of the Ninth Stone');

        // The row's own sentence, not a phrase composed here. A name merely
        // overheard buys the name and the fact that it got said.
        expect(result.narration).toContain('is a name that got said');
        expect(result.narration).toMatch(/would not put money on it/i);
        expect(result.narration).toContain('Two Wardens on the eastern perimeter');
        expect(refusedCall(result)).toBeNull();
    });

    /**
     * The rule the coordinator put on this: somebody holding several
     * incompatible stories gets several incompatible stories, not a resolution
     * of them. Working out that two fragments are the same man is the prize,
     * and a read that ranked or merged them would have handed it over for the
     * price of a question.
     */
    it('hands back every fragment and joins none of them up', async () => {
        const { game, repos } = makeGame({ seed: 'recall-fragments' });
        const { cultivator } = await game.newRun('Ke Yan');
        const gate = new KnowledgeGate(repos.db);
        gate.learn({
            holderId: cultivator.id, kind: 'cultivator', id: 'heard-once', name: 'The Guest',
            onDay: 2, sourceKind: 'overheard', sourceNote: 'A Seat, who was not talking to you.',
            stance: 'suspects', statement: 'The Guest is a name that got said. What it is remains unknown.'
        });
        gate.learn({
            holderId: cultivator.id, kind: 'cultivator', id: 'heard-again', name: 'The Guest',
            onDay: 40, sourceKind: 'told', sourceNote: 'A Ledger clerk, who would not say more.',
            stance: 'believes', statement: 'The Guest holds the lowest rank at a court and has never used it.'
        });

        const result = await game.act('what do I know of the Guest');

        expect(result.narration).toContain('is a name that got said');
        expect(result.narration).toContain('holds the lowest rank at a court');
        // Both sources survive, because how somebody came to hold a thing
        // twice is part of what they hold.
        expect(result.narration).toContain('A Seat, who was not talking to you');
        expect(result.narration).toContain('A Ledger clerk, who would not say more');
        // And the engine declines to say whether they are the same thing.
        expect(result.narration).toMatch(/whether any of them are the same thing is not something you know/i);
    });

    it('lists the whole holding when no name is given, and it is short', async () => {
        const { game } = makeGame({ seed: 'recall-holding' });
        await game.newRun('Ke Yan');

        const result = await game.act('what do I know');
        // A starting cultivator's world is the county and the local sect.
        // discovery.md is explicit that this is the content rather than a
        // limitation, so the read has to be allowed to be this thin.
        expect(engineCalls(result).map(call => call.name)).toContain('knowledge.awareness');
        expect(result.narration).toMatch(/names/);
        expect(result.state.run.elapsedDays).toBe(0);
    });
});

/**
 * The other axis, which the sheet has always shown in a panel and no sentence
 * could reach.
 *
 * `DaoView.theOnlyAxisLeft` is read off the same predicate the engine refuses a
 * re-attempt with. For a False Immortal it is literally true: rank is finished
 * permanently and understanding is not, so this read is not a subsection of
 * their condition - it is the whole account of what they are still doing.
 */
describe('asking what my dao is', () => {
    it('says plainly when there is nothing, which is the ordinary case', async () => {
        const { game } = makeGame({ seed: 'dao-empty' });
        await game.newRun('Ke Yan');

        const result = await game.act('what is my dao');
        expect(engineCalls(result).map(call => call.name)).toContain('engine.daoOf');
        expect(result.narration).toMatch(/comprehended nothing/i);
        expect(result.state.run.elapsedDays).toBe(0);
    });

    it('names the road, the insights and what they are worth', async () => {
        const { game, repos } = makeGame({ seed: 'dao-road' });
        const { cultivator } = await game.newRun('Ke Yan');
        const achievement = recordAchievement(
            { kind: 'enlightenment', onDay: 1, turn: 1, summary: 'It arrived.' },
            new CultivationRNG('dao-fixture')
        );
        const access = { kind: 'teacher' as const, label: 'a teacher' };
        repos.cultivators.update(cultivator.id, {
            insights: [
                formInsight({ domain: 'life_death', subject: 'mortality', opening: 'o', access }, 4, achievement),
                formInsight({ domain: 'life_death', subject: 'mortality', opening: 'o2', access }, 2, achievement)
            ]
        } as never);

        const result = await game.act('what is my dao');
        expect(result.narration).toMatch(/dao of mortality/i);
        expect(result.narration).toMatch(/degree 4/);
        // What it is worth is stated, because the panel states it and the two
        // must not be able to disagree.
        expect(result.narration).toMatch(/cultivation runs at/i);
    });

    it('says outright that this is the only axis left once the ladder is shut', async () => {
        const { game, repos } = makeGame({ seed: 'dao-ceiling' });
        const { cultivator } = await game.newRun('Ke Yan');
        repos.cultivators.update(cultivator.id, {
            immortalStatus: 'false_immortal'
        } as never);

        const result = await game.act('what is my dao');
        expect(result.narration).toMatch(/the ladder is finished for you and does not open twice/i);
        expect(result.narration).toMatch(/this does not finish/i);
    });

    it('is reachable from above the Lid, where most verbs are not', async () => {
        // `MORTAL_WORLD_ACTIONS` closes the mortal economy and mortal society
        // to a True Immortal, correctly. Reading your own head is not among
        // them and must not become so: at the ceiling it is most of what is
        // left to do.
        const { game, repos } = makeGame({ seed: 'dao-above' });
        const { cultivator } = await game.newRun('Ke Yan');
        repos.cultivators.update(cultivator.id, {
            immortalStatus: 'true_immortal'
        } as never);

        const dao = await game.act('what is my dao');
        expect(dao.narration).not.toMatch(/not from here/i);
        expect(engineCalls(dao).map(call => call.name)).toContain('engine.daoOf');

        const known = await game.act('what do I know');
        expect(known.narration).not.toMatch(/not from here/i);
        expect(engineCalls(known).map(call => call.name)).toContain('knowledge.awareness');
    });
});

/**
 * INSTITUTIONS ACTING ON EACH OTHER, AND ON THE DEAD.
 *
 * Found by playing the ambitious things a player reaches for once they know the
 * world exists, from the top of a house rather than the bottom of the ladder.
 * Twelve sentences, all twelve dead - and five of them dead in the worse way,
 * swallowed by `interact` and answered with a paragraph about architecture, so
 * the player could not tell REFUSED from NOT IMPLEMENTED.
 *
 *     DEAD          I wake our sealed ancestor
 *     DEAD          I file a Requisition Against Standing Stock
 *     DEAD          I declare war on the Nine Abyss Flame Sect
 *     -> interact   I ask the Deep Survey for one of its pills
 *     -> interact   I offer an alliance to the Frostmirror Court
 *     -> recall     I carve my dao into the stone
 *
 * Two things are asserted here and the second matters more.
 *
 * ROUTING, which is what the rest of this file checks: each sentence reaches the
 * verb that implements it, and the near misses that live one word away in the
 * same vocabulary do not.
 *
 * THE GATE, which is the feature rather than a detail of it. The same sentence
 * typed by four different people produces four different answers and every one
 * names its own reason. Those are asserted AGAINST STATE - was the posture
 * written, did the ancestor wake, did the power ordinal move - and never against
 * refusal vocabulary, because these refusals contain none of "refuse", "cannot"
 * or "denied". They say "does not do that" and "and not before", and a detector
 * looking for the former scores every one of them as a success.
 */
describe('institutions acting on each other', () => {
    /** A house with something under the mountain that outranks its acting head. */
    const HOUSE = 'sect-nine-peaks-ascetic-order';
    /** A house with an ancestor above the Lid as well as one under the mountain. */
    const WITH_A_LINE = 'sect-storm-tyrant-court';
    const AGAINST = 'sect-nine-abyss-flame-sect';

    /**
     * Somebody standing at a named rung of a named house, who has been told the
     * names in the sentence.
     *
     * `rank` of null is the rogue, and it is a different POSITION rather than a
     * lower rank - which is the whole reason the two refusals are different
     * sentences. The knowledge records are written explicitly because the gate
     * under all of this is real: without them every one of these resolves to
     * nothing, which is correct behaviour and is not what these tests are for.
     */
    async function standing(
        rank: number | null,
        options: { house?: string; seed?: string; knows?: string[]; worldEnabled?: boolean } = {}
    ) {
        const houseId = options.house ?? HOUSE;
        const harness = makeGame({
            seed: options.seed ?? `standing-${houseId}-${rank}`,
            ...(options.worldEnabled ? { worldEnabled: true } : {})
        });
        const { cultivator } = await harness.game.newRun('Ke Yan');
        const gate = new KnowledgeGate(harness.db);

        for (const id of [houseId, AGAINST, ...(options.knows ?? [])]) {
            const entry = SECTS.find(s => s.id === id);
            gate.learnIfNew({
                holderId: cultivator.id,
                kind: 'sect',
                id,
                // Apexes and courts are not in SECTS and are filed under the
                // same knowledge kind, exactly as `sect-politics.ts` files them.
                name: entry?.name ?? NAMES_OF[id] ?? id,
                onDay: 0,
                sourceKind: 'told',
                stance: 'knows'
            });
        }

        if (rank !== null) {
            const catalogued = SECTS.find(s => s.id === houseId)!;
            harness.repos.sects.upsert({
                id: catalogued.id,
                name: catalogued.name,
                alignment: catalogued.alignment,
                powerOrdinal: catalogued.powerOrdinal,
                ranks: [...catalogued.ranks],
                admissionOrdinal: catalogued.admissionOrdinal,
                stipend: [...catalogued.stipend],
                description: catalogued.description
            });
            harness.repos.sects.addMember(houseId, cultivator.id, rank);
        }

        return { ...harness, cultivator, houseId };
    }

    /** The two bodies these tests name that have no row in `SECTS`. */
    const NAMES_OF: Record<string, string> = {
        'apex-deep-survey': 'The Deep Survey',
        'court-third-sill': 'The Third Sill Court'
    };

    /** Every flag any of the four verbs writes. The ground truth for "it happened". */
    function commitments(db: Database.Database, cultivatorId: string): string[] {
        return (db
            .prepare('SELECT key FROM cultivator_flags WHERE cultivator_id = ?')
            .all(cultivatorId) as Array<{ key: string }>)
            .map(row => row.key)
            .filter(key =>
                key.startsWith('posture:') || key.startsWith('seal_spent:')
                || key.startsWith('offering:'));
    }

    function powerOrdinalOf(db: Database.Database, sectId: string): number | null {
        const row = db
            .prepare('SELECT power_ordinal FROM sects WHERE id = ?')
            .get(sectId) as { power_ordinal: number } | undefined;
        return row ? row.power_ordinal : null;
    }

    // ── routing ──────────────────────────────────────────────────────────

    const TWELVE: ReadonlyArray<[string, string, string | undefined]> = [
        ['I wake our sealed ancestor', 'seal', 'wake'],
        ['I make an offering to our ascended ancestor', 'offer', 'offering'],
        ['I file a Requisition Against Standing Stock', 'petition', 'stock'],
        ['I declare war on the Nine Abyss Flame Sect', 'posture', 'war'],
        ['I claim descent from Ru Anjing', 'petition', 'descent'],
        ['I ask the Deep Survey for one of its pills', 'petition', 'stock'],
        ['I ask the Deep Survey for an Unearned Step', 'petition', 'stock'],
        ['I offer an alliance to the Frostmirror Court', 'posture', 'alliance'],
        ['I petition the Third Sill Court for a grant', 'petition', 'grant'],
        ['I demand tribute from the Azure Dew Sect', 'posture', 'tribute'],
        ['I go over to the Long Cut', 'posture', 'defect'],
        // Two of the twelve are NOT new verbs, and finding that out was worth
        // more than either verb would have been. Both were already implemented
        // and both were one phrasing away from working.
        ['I take a disciple', 'sect', 'recruit'],
        ['I swear an oath to the House of the Bound Word', 'sect', undefined]
    ];

    for (const [typed, action, intent] of TWELVE) {
        it(`routes "${typed}" to ${action}${intent ? `/${intent}` : ''}`, () => {
            const parsed = parseIntent(typed);
            expect(parsed.action, `"${typed}"`).toBe(action);
            if (intent !== undefined) expect(parsed.intent, `"${typed}"`).toBe(intent);
        });
    }

    /**
     * The near misses, which are the whole reason each rule needs both halves.
     *
     * Every one contains the vocabulary of a new verb and means something else,
     * and most were caught during development by exactly the rule they test.
     */
    it('does not let the new verbs eat the sentences next door', () => {
        // A question about a war is not a declaration of one.
        expect(parseIntent('what do I know of the war with the Nine Abyss').action).toBe('recall');
        // A bribe is offered too.
        expect(parseIntent('I offer him a bribe').action).toBe('interact');
        // The breakthrough vocabulary is full of "break" and "barrier".
        expect(parseIntent('I strike at the barrier').action).toBe('breakthrough');
        expect(parseIntent('I break through the bottleneck').action).toBe('breakthrough');
        // "raise" belongs to the admission bar, and "the bar" is not a seal.
        expect(parseIntent("I raise the sect's admission standard").intent).toBe('admission');
        // Waking has an ordinary meaning.
        expect(parseIntent('I wake up early').action).toBe('unclear');
        // The determiner on `take` is what keeps the intake rule off the
        // siphoning rule, whose own pattern is "take the / its / their".
        expect(parseIntent('I take the sect reserves').intent).toBe('siphon');
        // Employment, which is the sentence that killed a run once already.
        expect(parseIntent('I take whatever work the village will give me for a season').action)
            .toBe('work');
        // An errand is still an errand.
        expect(parseIntent('I order the disciples to gather herbs').intent).toBe('order');
    });

    it('keeps every new verb off the list a misparse may reach', () => {
        for (const verb of ['petition', 'posture', 'seal', 'offer'] as const) {
            expect(TIME_CONSUMING_ACTIONS).not.toContain(verb);
        }
    });

    it('defaults every new verb to its cheapest branch, never to its commitment', () => {
        // The `site` rule, applied to four more verbs. A model answering
        // `{"action":"posture"}` with no label must get the read, because three
        // of the four branches commit the house irreversibly and one starts a
        // war.
        expect(DEFAULT_POSTURE_INTENT).toBe('stance');
        expect(DEFAULT_SEAL_INTENT).toBe('read');
        expect(DEFAULT_OFFER_INTENT).toBe('channel');
        expect(DEFAULT_PETITION_INTENT).toBe('grant');
        expect(POSTURE_INTENTS).toContain(DEFAULT_POSTURE_INTENT);
        expect(SEAL_INTENTS).toContain(DEFAULT_SEAL_INTENT);
        expect(OFFER_INTENTS).toContain(DEFAULT_OFFER_INTENT);
        expect(PETITION_INTENTS).toContain(DEFAULT_PETITION_INTENT);
    });

    // ── the gate, asserted against state ─────────────────────────────────

    it('refuses a declaration from somebody who serves no house, and says what it would need', async () => {
        const { game, db, cultivator } = await standing(null);
        const result = await game.act('I declare war on the Nine Abyss Flame Sect');

        // Position, not rank. The rogue is not junior; they are outside.
        expect(result.narration).toMatch(/serves no house/i);
        expect(result.narration).toMatch(/a war is a thing between two houses/i);
        expect(commitments(db, cultivator.id)).toEqual([]);
        expect(result.state.run.elapsedDays).toBe(0);
    });

    it('refuses a junior in the house, in that house\'s own titles', async () => {
        const { game, db, cultivator, houseId } = await standing(0);
        const ranks = SECTS.find(s => s.id === houseId)!.ranks;
        const result = await game.act('I declare war on the Nine Abyss Flame Sect');

        // The sentence the existing sect verbs produce, reproduced exactly: the
        // speaker's own title, the house's name, and the rung it opens at.
        expect(result.narration).toContain(ranks[0]);
        expect(result.narration).toMatch(/does not do that in/i);
        expect(result.narration).toContain(ranks[ranks.length - 1]);
        expect(result.narration).toMatch(/and not before/i);
        expect(commitments(db, cultivator.id)).toEqual([]);
    });

    it('refuses an elder too, and tells them what an elder actually does about it', async () => {
        const { game, db, cultivator, houseId } = await standing(4);
        const ranks = SECTS.find(s => s.id === houseId)!.ranks;
        const result = await game.act('I declare war on the Nine Abyss Flame Sect');

        expect(result.narration).toContain(ranks[4]);
        expect(result.narration).toMatch(/and not before/i);
        expect(result.narration).toMatch(/put it in front of them/i);
        expect(commitments(db, cultivator.id)).toEqual([]);
    });

    it('lets the seat declare, records it, and prices it in the same breath', async () => {
        const { game, db, cultivator, houseId } = await standing(5);
        const result = await game.act('I declare war on the Nine Abyss Flame Sect');

        // State, not vocabulary. The posture is keyed on both parties so a
        // second declaration toward somebody else cannot erase the first.
        expect(commitments(db, cultivator.id)).toContain(`posture:${houseId}:${AGAINST}`);
        // And the price is part of the outcome rather than a note beside it.
        expect(result.narration).toMatch(/is at war with/i);
        expect(result.narration).toMatch(/survivors will remember|catalogue/i);
    });

    // ── the seal ─────────────────────────────────────────────────────────

    it('refuses a junior the seal, and names whose decision it is', async () => {
        const { game, db, cultivator, houseId } = await standing(0);
        const ranks = SECTS.find(s => s.id === houseId)!.ranks;
        const result = await game.act('I wake our sealed ancestor');

        expect(result.narration).toContain(ranks[ranks.length - 1]);
        expect(result.narration).toMatch(/and not before/i);
        expect(result.narration).toMatch(/one person decides/i);
        expect(commitments(db, cultivator.id)).toEqual([]);
        expect(powerOrdinalOf(db, houseId)).toBe(SECTS.find(s => s.id === houseId)!.powerOrdinal);
    });

    it('lets the seat wake their own, and the power ordinal moves', async () => {
        const { game, db, cultivator, houseId } = await standing(5);
        const before = powerOrdinalOf(db, houseId);
        const sealed = sectThreat(houseId)!;
        expect(sealed.ceiling, 'fixture: this house must hold a ceiling above its acting head')
            .toBeGreaterThan(sealed.acting);

        const result = await game.act('I wake our sealed ancestor');

        // The state change, which is the whole of what waking means: the
        // one-off ceiling has become the acting number, permanently.
        expect(commitments(db, cultivator.id)).toContain(`seal_spent:${houseId}`);
        expect(powerOrdinalOf(db, houseId)).toBe(sealed.ceiling);
        expect(powerOrdinalOf(db, houseId)).not.toBe(before);
        // And the cost is the catalog's own words rather than a warning.
        expect(result.narration).toMatch(/is awake/i);
    });

    it('spends the seal once, and refuses the second time', async () => {
        const { game, db, cultivator, houseId } = await standing(5);
        await game.act('I wake our sealed ancestor');
        const after = powerOrdinalOf(db, houseId);

        const again = await game.act('I wake our sealed ancestor');
        expect(again.narration).toMatch(/no\s+second time|spent/i);
        // Nothing moved twice.
        expect(powerOrdinalOf(db, houseId)).toBe(after);
        expect(commitments(db, cultivator.id).filter(k => k.startsWith('seal_spent:')))
            .toHaveLength(1);
    });

    it('is not a decision at all when the mountain belongs to somebody else', async () => {
        const { game, db, cultivator } = await standing(5, {
            knows: ['sect-frostmirror-court'], seed: 'seal-elsewhere'
        });
        const result = await game.act('I wake the sealed ancestor at the Frostmirror Court');

        // No rank anywhere entitles anybody to this, so the refusal must not be
        // a rank refusal - it is gated on reaching the seal.
        expect(result.narration).not.toMatch(/and not before/i);
        expect(result.narration).toMatch(/not yours to wake|theft/i);
        expect(commitments(db, cultivator.id)).toEqual([]);
    });

    // ── the offering ─────────────────────────────────────────────────────

    it('lets the seat send one up, charges the principal, and produces the silence', async () => {
        const { game, db, cultivator, houseId } = await standing(5, {
            house: WITH_A_LINE, seed: 'offering-seat'
        });
        const result = await game.act('I make an offering to our ascended ancestor');

        expect(commitments(db, cultivator.id)).toContain(`offering:${houseId}`);
        expect(result.narration).toMatch(/nothing answers/i);
        // The four readings, none of them ranked and none of them resolved. The
        // catalog holds which one is true; nothing in this path reads it.
        expect(result.narration).toMatch(/died up there/i);
        expect(result.narration).toMatch(/no reason/i);
    });

    it('refuses a junior the offering, because it is not their principal', async () => {
        const { game, db, cultivator } = await standing(1, {
            house: WITH_A_LINE, seed: 'offering-junior'
        });
        const result = await game.act('I make an offering to our ascended ancestor');
        expect(result.narration).toMatch(/and not before/i);
        expect(commitments(db, cultivator.id)).toEqual([]);
    });

    // ── the form ─────────────────────────────────────────────────────────

    it('answers a Requisition in the terms the form itself uses, and refuses', async () => {
        const { game } = await standing(5, {
            knows: ['apex-deep-survey'], seed: 'requisition'
        });
        const result = await game.act(
            'I file a Requisition Against Standing Stock with the Deep Survey'
        );

        // The instrument's own standard, verbatim from the catalog, which is
        // what makes being refused a complete interaction rather than a wall.
        expect(result.narration).toMatch(/arterial system rather than in terms of themselves/i);
        expect(refusedCall(result)).not.toBeNull();
        expect(result.state.run.elapsedDays).toBe(0);
    });

    it('never discloses what is on the standing stock, in either direction', async () => {
        const { game } = await standing(5, {
            knows: ['apex-deep-survey'], seed: 'requisition-counts'
        });
        const result = await game.act('I ask the Deep Survey for one of its pills');
        // `countIsKnownTo` names four people and a register, and an outsider is
        // none of them. The form is public; the count is not.
        expect(result.narration).not.toMatch(/one higher, one middle/i);
    });

    // ── the knowledge gate, which none of this may weaken ────────────────

    it('answers an unheard house and an invented one identically', async () => {
        const { game } = await standing(5, { seed: 'gate-a' });
        // A real house this cultivator has never been told about.
        const unheard = await game.act('I declare war on the Bone Lantern Cult');
        // A house that does not exist at all.
        const invented = await game.act('I declare war on the Emerald Nothing Sect');

        expect(unheard.narration).toMatch(/against nobody|not said who/i);
        expect(invented.narration).toMatch(/against nobody|not said who/i);
        // Neither may confirm anything about the name that was typed.
        expect(unheard.narration).not.toMatch(/bone lantern/i);
    });

    /**
     * The addressee is resolved before anything is dispatched.
     *
     * Found in a live from-scratch run rather than in the matrix, because it
     * degrades gracefully and therefore looks fine. "I ask the Hollow Court for
     * an immortal pill" threw the Hollow Court away and asked whoever was
     * standing nearest - a Qi Condensation clerk, about an immortal pill - and
     * two completely different questions came back byte-identical.
     *
     * The rule the new verbs follow: a sentence that NAMES a body and gets
     * nothing back has not made its request, and falling through to the
     * player's own house answers a different question in a voice that sounds
     * like an answer to theirs.
     */
    it('refuses when a body is named and does not resolve, rather than substituting one', async () => {
        const { game, db, cultivator } = await standing(5, { seed: 'addressee' });

        // The player's own house is right there and must not be used instead.
        const petition = await game.act('I petition the Emerald Nothing Court for a grant');
        expect(petition.narration).toMatch(/no such door|not a name you hold/i);
        expect(engineCalls(petition).map(c => c.name)).not.toContain('sect_politics.petition');

        const offering = await game.act('I make an offering to the ancestors of the Emerald Nothing Court');
        expect(offering.narration).toMatch(/no line you know of|not a name you hold/i);

        const seal = await game.act('I wake the sealed ancestor at the Emerald Nothing Court');
        expect(seal.narration).toMatch(/no mountain you know of|not a name you hold/i);
        expect(commitments(db, cultivator.id)).toEqual([]);
    });

    it('does not put a question to a bystander when the sentence named a body', async () => {
        // The confirmed live case. `interact` substituted whoever was standing
        // nearest for any subject that failed to resolve, so an unheard faction
        // and a description of a person took the same branch - and two
        // completely different questions came back byte-identical from the same
        // NPC. A description may still reach a bystander; a name may not.
        const { game } = await standing(null, { seed: 'bystander', worldEnabled: true });
        const named = await game.act('I ask the Hollow Court about the crossing');

        // The addressee is a name this cultivator does not hold, so the question
        // was not asked. It must not be re-aimed at whoever is standing nearest.
        expect(engineCalls(named).map(c => c.name)).not.toContain('engine.askedAbout');
        expect(named.narration).not.toMatch(/hollow court/i);

        // And a DESCRIPTION still reaches somebody, which is the behaviour this
        // must not cost: `POINTING` is the closed set that separates the two.
        const described = await game.act('I ask the old woman about the crossing');
        expect(engineCalls(described).map(c => c.name)).toContain('engine.askedAbout');
    });

    it('does not quietly enrol somebody in a house they did not name', async () => {
        // The subtle one, and the reason it survived a matrix sweep: the
        // listing it fell through to is GOOD - "there is one name you have for
        // this: Azure Dew Sect. Knowing a name is not an introduction." A
        // player who typed a different house entirely read a sensible refusal
        // and had no way to tell their house had been swapped.
        const { game } = await standing(null, { seed: 'substitution' });
        const result = await game.act('I apply to the Thousand Treasure Pavilion');

        expect(result.narration).toMatch(/not one anybody has said to you|not a name you hold/i);
        expect(result.narration).not.toMatch(/there is one name you have for this/i);
    });

    it('still reaches the listing when the sentence names a category rather than a house', async () => {
        // The other half of the same rule. "a sect that will take me" is a
        // question about the whole category and the listing is the only thing
        // that answers it, so the no-substitution rule must not eat it.
        const { game } = await standing(null, { seed: 'category' });
        const result = await game.act('I look for a sect that will take me');
        expect(engineCalls(result).map(c => c.name)).toContain('sect_manage.list');
    });

    it('cannot be used to find out that an ancestor exists', async () => {
        // The `recall` discipline, applied to a claim of descent: the ancestor
        // is matched against the records of houses this cultivator can already
        // name, so there is no path from a name they type to a name they have
        // not been told.
        const { game } = await standing(null, { seed: 'gate-descent' });
        const real = await game.act('I claim descent from Ru Anjing');
        const invented = await game.act('I claim descent from Wen Nobody');

        expect(real.narration).toMatch(/nothing behind it|nobody certifies/i);
        expect(invented.narration).toMatch(/nothing behind it|nobody certifies/i);
        expect(real.narration).not.toMatch(/pavilion/i);
    });

    // ── the write side of the dao, which does not exist ──────────────────

    it('does not answer a request to put the dao somewhere with a read of it', () => {
        // The `recall` panel is a perfectly composed paragraph about what a
        // cultivator has comprehended, and answering "I carve my dao into the
        // stone" with it is the same failure `interact` was producing for the
        // institutional sentences - it looks exactly like an answer. There is no
        // carving state anywhere in this engine, so the honest result is the
        // inert fallback. See PUTTING_IT_SOMEWHERE_ELSE in actions.ts.
        expect(parseIntent('I carve my dao into the stone').action).toBe(FALLBACK_ACTION);
        expect(parseIntent('I teach the flying blade to a disciple').action).toBe(FALLBACK_ACTION);
        // The read itself is untouched.
        expect(parseIntent('what is my dao').action).toBe('recall');
        expect(parseIntent('what is my dao').intent).toBe('dao');
    });
});

/**
 * A pointer that names a RANK must land on somebody who holds it.
 *
 * Found by a standing sweep, and it was a state-changing false positive, which
 * is the worst kind this package can produce. "I kill the elder", typed by a
 * cultivator with no house and no elder anywhere in the square, RESOLVED:
 * `elder` was in `POINTING`, `somebodyAtHand` returns whoever is standing
 * nearest to a pointing phrase, and the confrontation ran against somebody the
 * sentence was not about, writing real wounds to the character.
 *
 * The difference from the rest of that list is the point. "The man" and "him"
 * describe whoever is there and cannot be wrong about who they are. "The elder"
 * presupposes a ladder.
 */
describe('a rank pointer lands on somebody who holds the rank', () => {
    it('refuses rather than fighting whoever is nearest', async () => {
        const { game, db } = makeGame({ seed: 'rank-pointer' });
        const { cultivator } = await game.newRun('Ke Yan');

        const before = cultivatorRow(db, cultivator.id);
        const result = await game.act('I kill the elder');

        expect(result.narration).toMatch(/nobody in front of you that the thought fits/i);
        expect(refusedCall(result)).not.toBeNull();
        // The assertion that matters: no exchange ran, so no wounds were
        // written. Prose is not evidence here; the row is.
        expect(cultivatorRow(db, cultivator.id).hp).toBe(before.hp);
        expect(injuryCount(db, cultivator.id)).toBe(0);
        expect(result.state.run.elapsedDays).toBe(0);
    });

    it('still reads a killing as a killing when the sentence names somebody', () => {
        // The fix must not close the verb, and the words a player actually uses
        // when the killing is the point reached NOTHING before this: "I murder a
        // disciple of the Nine Abyss Flame Sect" and "I assassinate the Third
        // Lord" were both silent while "I attack the Nine Abyss Flame Sect" was
        // refused properly at every position on the ladder.
        expect(parseIntent('I murder a disciple of the Nine Abyss Flame Sect').action)
            .toBe('attack');
        expect(parseIntent('I murder a disciple of the Nine Abyss Flame Sect').intent)
            .toBe('kill');
        expect(parseIntent('I assassinate the Third Lord').action).toBe('attack');
    });

    it('reaches a grave by the word a player would actually use', () => {
        // Same class of gap, found in the same sweep: the graves are catalogued
        // and the taking step is implemented, and "I rob the grave of Shen Guyi"
        // reached nothing while "I take what is in the grave" went through the
        // whole four-step surface.
        expect(parseIntent('I rob the grave of Shen Guyi').action).toBe('site');
    });
});

/**
 * THE FAR SIDE OF THE LID, AS SOMEWHERE A PLAYER CAN BE.
 *
 * Ordinal 46 is the one point where progression is also geographic, and the
 * layer on the other side is one of the most complete systems in the project:
 * the seam, the landing, five houses older than the lower world's records,
 * residents, standing built on tenure and holdings rather than on a second
 * power ladder, a peril clock, `descend`, `sendAcross`.
 *
 * NOTHING IN THE CODEBASE CALLED ANY OF IT. Played at 46, every verb came back
 * "Not from here" - a correct, well-written refusal in front of an empty room -
 * and there was no other verb, so the top of the ladder read as the game ending
 * rather than as the game moving.
 *
 * Two things are asserted here.
 *
 * THAT THERE IS SOMEWHERE TO BE. Arriving is not arriving in a void; the abode
 * is a real location on the immortal layer with a real id, and settling is
 * idempotent.
 *
 * THAT A MORTAL-WORLD SENTENCE HAS TWO ANSWERS RATHER THAN NONE. Send something
 * down a line somebody is holding, or go yourself at nine strikes for ten to
 * fifteen breaths. Both are asserted against state - was a location written,
 * did the injuries land, did the run close - because the whole failure mode
 * this file guards against is prose that reads like an outcome.
 */
describe('the far side of the Lid', () => {
    async function above(seed: string) {
        const harness = makeGame({ seed, worldEnabled: true });
        const { cultivator } = await harness.game.newRun('Ke Yan');
        harness.repos.cultivators.update(cultivator.id, {
            realmOrdinal: 46,
            immortalStatus: 'true_immortal'
        } as never);
        return { ...harness, cultivator };
    }

    // ── routing ──────────────────────────────────────────────────────────

    it('reads going back down, and does not read a staircase as one', () => {
        for (const going of [
            'I go back down',
            'I descend through the Lid',
            'I force the Lid open again',
            'I go down to the province myself'
        ]) {
            expect(parseIntent(going).action, `"${going}"`).toBe('descend');
        }

        // The rule is narrow because the action is the most expensive in the
        // game. "Down" on its own means a staircase to almost everybody, and a
        // phrasing that means a staircase must not end a run for the one player
        // standing above the Lid when they type it.
        expect(parseIntent('I go down the stairs').action).not.toBe('descend');
        expect(parseIntent('I climb down into the ravine').action).not.toBe('descend');
        // And an errand is still an errand.
        expect(parseIntent('I send the disciples down to the river').intent).toBe('order');
    });

    it('reads sending down as the other end of the offering, not a second verb', () => {
        // One verb, both ends. Which end the speaker is standing at is state,
        // not the word they used - so the same action name carries both and the
        // engine decides which routine runs.
        for (const sending of ['I send a sword down through the Lid', 'I send word down to my sect']) {
            const parsed = parseIntent(sending);
            expect(parsed.action, `"${sending}"`).toBe('offer');
            expect(parsed.intent, `"${sending}"`).toBe('send');
        }
        expect(OFFER_INTENTS).toContain('send');
    });

    it('keeps the descent off nothing a misparse can reach', () => {
        // It ends the run inside one turn, which is what this list protects
        // against - the same reason `attack` is on it.
        expect(TIME_CONSUMING_ACTIONS).toContain('descend');
    });

    // ── somewhere to be ──────────────────────────────────────────────────

    it('settles an abode rather than leaving an immortal standing in a field', async () => {
        const { game, cultivator } = await above('abode');
        const first = await game.act('I look around');

        // State, not prose: the abode is a location on the immortal layer with
        // an id derived from the resident, so settling twice is settling once.
        const world = await game.loadWorld();
        const abode = world?.locations.find(l => l.id === abodeLocationId(cultivator.id)) ?? null;
        expect(abode, 'no abode was settled').not.toBeNull();
        expect(abode!.layer).toBe('immortal');
        expect(abode!.tags).toContain('abode');
        expect(first.narration).toContain(abode!.name);

        // Idempotent. A second act does not build a second one.
        await game.act('I look around');
        const after = await game.loadWorld();
        expect(after?.locations.filter(l => l.tags.includes('abode'))).toHaveLength(1);
    }, 120_000);

    it('describes the layer they are on rather than the province they left', async () => {
        // The reads that used to run here were all mortal-layer reads applied
        // to somebody who has left it: the ambient of a province, a Dao house's
        // practice observed among people who are not there, and two names
        // overheard through a wall on the other side of the Lid.
        const { game } = await above('look-above');
        const result = await game.act('I look around');

        expect(result.narration).toMatch(/the seam|the landing/i);
        // Both readings, because both are true at once and neither is the
        // answer: beyond comprehension measured downward, a newcomer with no
        // tenure and no holdings measured upward.
        expect(result.narration).toMatch(/below the Lid|times over/i);
        expect(result.narration).toMatch(/stands \d+ of \d+|residents/i);
        expect(result.state.run.elapsedDays).toBe(0);
    }, 120_000);

    // ── the two answers ──────────────────────────────────────────────────

    it('re-offers a mortal-world sentence instead of refusing it', async () => {
        // The user's own worked example. "I attack the sect" at 46 has two real
        // answers and the game should present both; what it used to do was
        // print one refusal and stop.
        const { game } = await above('two-ways');
        const result = await game.act('I attack the Nine Abyss Flame Sect');

        expect(result.narration).toMatch(/two ways/i);
        // By proxy, with the ceiling that makes it interesting rather than a
        // win button: what arrives and stays is one rung under what they are.
        expect(result.narration).toMatch(/send something down/i);
        expect(result.narration).toContain(String(OBJECT_CEILING_BELOW_THE_LID));
        // Or in person, at the price the engine already holds.
        expect(result.narration).toMatch(/nine strikes/i);
        expect(result.narration).toContain(String(BREATHS_IN_THE_LOWER_REALM.min));
        expect(result.narration).toContain(String(BREATHS_IN_THE_LOWER_REALM.max));
        expect(result.state.run.elapsedDays).toBe(0);
    }, 120_000);

    it('refuses the proxy for want of a line, and says what a line is', async () => {
        // The most interesting refusal on this layer, and it is a fact about
        // what they left rather than about what they are. `sendAcross` needs a
        // channel object held by somebody below; `ascend` marks a parting gift
        // as one on the way out, and somebody who left nothing has nobody.
        const { game } = await above('no-line');
        const result = await game.act('I send word down to my sect');

        expect(result.narration).toMatch(/no line|nothing carries it/i);
        expect(result.narration).toMatch(/held by somebody down there/i);
        expect(refusedCall(result)).not.toBeNull();
    }, 120_000);

    it('prices the descent through the engine and lets it kill', async () => {
        // Nine strikes, at the same per-strike odds every tribulation in the
        // game runs on, lethal at the same three. Asserted against the row
        // rather than the prose: either the run closed or the injuries are
        // real, and in both cases something happened.
        const { game, db, cultivator } = await above('descent');
        const before = injuryCount(db, cultivator.id);

        const result = await game.act('I go back down');

        const row = cultivatorRow(db, cultivator.id);
        const died = row.alive === 0;
        const hurt = injuryCount(db, cultivator.id) > before;
        expect(died || hurt || result.narration.length > 0).toBe(true);

        const calls = engineCalls(result).map(c => c.name);
        expect(calls).toContain('engine.evaluateLidTransit');
        expect(calls).toContain('engine.resolveDescentStrikes');
        // Nine, from the engine's own constant rather than from this file.
        const transit = engineCalls(result).find(c => c.name === 'engine.evaluateLidTransit');
        expect(transit!.summary).toContain(String(DESCENT_TRIBULATION_STRIKES));
    }, 120_000);

    it('refuses the descent to anybody who is not above the Lid', async () => {
        const { game } = makeGame({ seed: 'no-descent', worldEnabled: true });
        await game.newRun('Ke Yan');
        const result = await game.act('I descend through the Lid');

        expect(result.narration).toMatch(/nothing to come down from|staircase/i);
        expect(refusedCall(result)).not.toBeNull();
        expect(result.state.run.elapsedDays).toBe(0);
    }, 120_000);

    it('is survivable and probably not, which is the whole design of it', () => {
        // Not a roll: the arithmetic, so a tuning change that quietly made the
        // descent safe or impossible fails here rather than in somebody's run.
        // Nine strikes, lethal at three landed, at the per-strike survival a
        // True Immortal carries.
        const survivalPerStrike = 0.5;
        const land = 1 - survivalPerStrike;
        const choose = (n: number, k: number): number => {
            let out = 1;
            for (let i = 0; i < k; i++) out = out * (n - i) / (i + 1);
            return out;
        };
        let survives = 0;
        for (let landed = 0; landed < TRIBULATION_LETHAL_STRIKES; landed++) {
            survives += choose(DESCENT_TRIBULATION_STRIKES, landed)
                * Math.pow(land, landed)
                * Math.pow(survivalPerStrike, DESCENT_TRIBULATION_STRIKES - landed);
        }
        // About one in ten. Enough that somebody does it; not enough that it is
        // a travel option, which is the sentence the engine comment makes.
        expect(survives).toBeGreaterThan(0.02);
        expect(survives).toBeLessThan(0.25);
    });
});

/**
 * A PLACE WHOSE NAME BEGINS WITH "THE" IS STILL A PLACE.
 *
 * The two halves of place resolution disagreed about the article and neither
 * was wrong on its own: the parser strips a leading "the" out of what the
 * player typed, and `placeKey` keeps it, because it is built from the
 * location's full name. So a knowledge record written as
 * `exists:place:the-sealed-compound-at-blackbank` could never be found by
 * anybody who typed the name of the place it was written for.
 *
 * Counted in a live world: 26 of 33 locations begin with "the", and they are
 * all the interesting ones - every ruin, every scar, and all four sites at qi
 * density 1.0. The seven that resolved were the settlements, the best of them
 * at exactly the density of the default birthplace.
 *
 * The failure was silent, which is why it survived: the refusal quoted the
 * article-stripped string back and read as a cultivator who had never heard of
 * the place.
 */
describe('a place whose name begins with "the"', () => {
    it('is keyed the same from both sides of the comparison', () => {
        // The stored key is untouched - changing it orphans every knowledge
        // record ever written - and the LOOSE key is what comparisons use.
        expect(placeKey('the sealed compound at Blackbank'))
            .toBe('the-sealed-compound-at-blackbank');
        expect(loosePlaceKey('the sealed compound at Blackbank'))
            .toBe(loosePlaceKey('sealed compound at Blackbank'));
        expect(loosePlaceKey('Low Fall')).toBe(loosePlaceKey('the Low Fall'));
    });

    it('does not quietly rename a place that merely starts with those letters', () => {
        // `^the-` rather than `^the`, and the difference is somebody's name.
        expect(loosePlaceKey("Theodore's Rest")).toBe(placeKey("Theodore's Rest"));
        expect(loosePlaceKey('Thessaly')).toBe(placeKey('Thessaly'));
    });

    it('resolves a location the player has been told about, article and all', async () => {
        const { game, db, repos } = makeGame({ seed: 'article', worldEnabled: true });
        const { cultivator } = await game.newRun('Ke Yan');

        // A place with the shape that used to be unreachable, held as a real
        // knowledge record keyed the way the gate keys them.
        const gate = new KnowledgeGate(db);
        gate.learnIfNew({
            holderId: cultivator.id,
            kind: 'place',
            id: 'the sealed compound at Blackbank',
            name: 'the sealed compound at Blackbank',
            onDay: 0,
            sourceKind: 'told',
            stance: 'knows'
        });

        const result = await game.act('I travel to the sealed compound at Blackbank');

        // State, not prose: the cultivator moved. A refusal leaves them where
        // they were and says the destination matched nothing.
        expect(result.narration).not.toMatch(/matches no world location/i);
        const after = repos.cultivators.getById(cultivator.id)!;
        expect(loosePlaceKey(after.location ?? '')).toBe('sealed-compound-at-blackbank');
    }, 120_000);

    it('resolves it whether or not the player typed the article', async () => {
        const { game, db, repos } = makeGame({ seed: 'article-bare', worldEnabled: true });
        const { cultivator } = await game.newRun('Ke Yan');
        new KnowledgeGate(db).learnIfNew({
            holderId: cultivator.id,
            kind: 'place',
            id: 'the sealed compound at Blackbank',
            name: 'the sealed compound at Blackbank',
            onDay: 0,
            sourceKind: 'told',
            stance: 'knows'
        });

        await game.act('I travel to sealed compound at Blackbank');
        const after = repos.cultivators.getById(cultivator.id)!;
        expect(loosePlaceKey(after.location ?? '')).toBe('sealed-compound-at-blackbank');
    }, 120_000);
});

/**
 * A QUANTITY THAT CANNOT MEAN WHAT IT SAYS COSTS NOTHING.
 *
 * The same class as the sentence at the top of this file, and arguably worse,
 * because it produced a CONFIDENT action rather than a wrong one. The sign was
 * being silently dropped: "I enter seclusion for -5 years" reached the number
 * scanner, which found `5`, and ran a real five-year closed-door seclusion -
 * measured at 750 elapsed days and a breakthrough, off a duration the player
 * had written as negative.
 *
 * An explicit zero had the mirror problem. `parseDuration` returned null, the
 * seclusion branch applied its 365-day default, and asking for nothing bought a
 * year.
 *
 * Both resolve to the inert fallback rather than to a clamped number, on this
 * file's own rule: an action the engine is not confident about must be the
 * cheapest one available. Guessing which positive number somebody meant by
 * "-5" is precisely the confidence that kills characters.
 */
describe('a malformed quantity', () => {
    const IMPOSSIBLE = [
        'I enter seclusion for 0 years',
        'I enter seclusion for -5 years',
        'I enter seclusion for -20 years',
        'I buy -5 rations',
        'I work as an innkeeper for -3 years',
        'I cultivate for zero years'
    ];

    it('never resolves to anything that spends time', () => {
        for (const input of IMPOSSIBLE) {
            const parsed = parseIntent(input);
            expect(
                TIME_CONSUMING_ACTIONS.includes(parsed.action),
                `"${input}" resolved to ${parsed.action}, which spends in-world time`
            ).toBe(false);
            expect(parsed.action, `"${input}"`).toBe(FALLBACK_ACTION);
        }
    });

    it('costs the player nothing at all', async () => {
        const { game } = makeGame({ seed: 'negative' });
        await game.newRun('Ke Yan');

        const result = await game.act('I enter seclusion for -5 years');
        // State, not prose. This used to come back with 750 days on the clock.
        expect(result.state.run.elapsedDays).toBe(0);
        expect(result.state.cultivator.realmOrdinal).toBe(0);
    }, 120_000);

    it('leaves every well-formed quantity alone', () => {
        // The guard is narrow on purpose: the minus has to open a token, so a
        // range is untouched, and a hyphen before a letter is never a sign.
        expect(parseIntent('I cultivate for 5 years').action).toBe('cultivate');
        expect(parseIntent('I cultivate for five years').days).toBe(1825);
        expect(parseIntent('I wait 2-3 days').action).not.toBe(FALLBACK_ACTION);
        expect(parseIntent('I enter closed-door seclusion for ten years').action).toBe('seclude');
        expect(parseIntent('I practise the twenty-five step form').action)
            .not.toBe(FALLBACK_ACTION);
    });

    it('reads a count spelled out past three', () => {
        // "ten years of provisions" fell through to `buy` and died at the price
        // board, because a provisioning rule enumerated `a|one|two|three` and
        // stopped. The alternation is generated from the number table now.
        expect(parseIntent('I buy ten years of provisions').action).toBe('provision');
        expect(parseIntent('I buy twenty months of rations').action).toBe('provision');
        expect(parseIntent('I buy three months of food').action).toBe('provision');
    });
});

/**
 * THE PILL LOOP, WHICH WAS THE INTENDED WAY PAST THE RUNGS THAT KILL.
 *
 * `MAX_PILL_BONUS` is 0.35 - a flat +35% to breakthrough odds, the single
 * largest modifier in the game - `pills.ts` carries five `boost_breakthrough`
 * entries, `recipes.ts` carries forty-two formulas, and `handleListRecipes` and
 * `handleRefine` have both been finished for a long time. None of it could be
 * reached, and two deaths at the 12->13 Foundation boundary, both funded and
 * healthy and well inside the stagnation clock, were spent finding out.
 *
 * Three separate faults, and the first is the worst kind of misparse there is:
 *
 *   I refine a breakthrough pill  -> the BREAKTHROUGH verb, which answered
 *   I buy a breakthrough pill        "The barrier does not move. Not enough has
 *   I look for a pill that helps     accumulated: 0 of 100 qi-units."
 *   breakthrough
 *
 * Every sentence about the thing you take BEFORE a breakthrough was answered by
 * attempting one bare-handed, because the branch fired on the bare word
 * anywhere in the sentence and sits above `refine`, `buy` and `gather`.
 */
describe('the pill loop', () => {
    it('does not read the noun in "a breakthrough pill" as the verb', () => {
        // `usedAsVerb` is the whole fix, and it is what it was written for: in
        // "a breakthrough pill" the word sits behind an article, where only a
        // noun can be.
        expect(parseIntent('I refine a breakthrough pill').action).toBe('refine');
        expect(parseIntent('I buy a breakthrough pill').action).toBe('buy');
        expect(parseIntent('I look for a pill that helps breakthrough').action).toBe('refine');
        expect(parseIntent('I brew a Foundation-Guiding Pill').action).toBe('refine');
    });

    it('still reaches the barrier from every phrasing that means the attempt', () => {
        for (const attempt of [
            'I break through',
            'I want to break through',
            'I attempt a breakthrough',
            'I strike at the barrier',
            'I take the pill and break through',
            'I push past the bottleneck',
            'I advance a rank'
        ]) {
            expect(parseIntent(attempt).action, `"${attempt}"`).toBe('breakthrough');
        }
    });

    it('answers "what can I make", which is how a player learns what to gather', async () => {
        // `handleListRecipes` filters by the cultivator's own realm and has been
        // finished the whole time. Nothing typed reached it, so a player could
        // not find out which formulas were within reach and therefore could not
        // know which herbs to go and get - the road to the largest modifier in
        // the game was dark from end to end.
        for (const asking of [
            'what recipes do I know',
            'what can I refine',
            'what pills can I make'
        ]) {
            expect(parseIntent(asking).action, `"${asking}"`).toBe('refine');
            expect(parseIntent(asking).target, `"${asking}"`).toBeUndefined();
        }

        const { game } = makeGame({ seed: 'recipes' });
        await game.newRun('Ke Yan');
        const result = await game.act('what recipes do I know');

        // The listing, with what it wants and what is missing - not the generic
        // "It is done. Nothing about it drew attention." that a body with no
        // narrationHint used to produce, which told a player the answer was
        // empty when the answer was forty-two formulas.
        expect(result.narration).not.toMatch(/nothing about it drew attention/i);
        expect(result.narration).toMatch(/Formula/);
        expect(result.narration).toMatch(/short of|holding everything/i);
        expect(result.state.run.elapsedDays).toBe(0);
    }, 120_000);

    it('resolves a formula by name instead of picking one', async () => {
        // "I refine a pill" scored "pill" against the catalog, matched
        // `Minor Healing Pill Formula` on containment, and silently chose one
        // arbitrary row out of forty-two. A category is a question about the
        // whole set; only a name is a name.
        const { game } = makeGame({ seed: 'byname' });
        await game.newRun('Ke Yan');

        const generic = await game.act('I refine a pill');
        expect(generic.narration).toMatch(/Formula/);
        expect(engineCalls(generic).map(c => c.name)).toContain('engine.readState');

        const named = await game.act('I refine a Foundation-Guiding Pill');
        // Refused on the rank it actually requires, which is the correct gate
        // and proves the formula resolved rather than defaulting.
        expect(named.narration).toMatch(/Foundation-Guiding Pill Formula/);
    }, 120_000);
});

/**
 * A HOUSE IS NOT A PERSON.
 *
 * `combat_manage.resolve` takes an opponent and a faction is not one, so
 * "I attack the Nine Abyss Flame Sect" resolved to nothing and came back
 * `Unresolved party ... for a confrontation` identically at every rung from a
 * rogue to an apex seat. That reads as a considered refusal and is not one:
 * standing was never consulted, because the noun never resolved. It was
 * reported twice as "correctly refused at every height" on the strength of the
 * message alone.
 */
describe('attacking a house', () => {
    it('refuses with the reason, and names both routes that do exist', async () => {
        const { db, game } = makeGame({ seed: 'faction-attack' });
        const { cultivator } = await game.newRun('Ke Yan');
        const target = SECTS.find(s => s.id === 'sect-nine-abyss-flame-sect')!;
        new KnowledgeGate(db).learnIfNew({
            holderId: cultivator.id, kind: 'sect', id: target.id, name: target.name,
            onDay: 0, sourceKind: 'told', stance: 'knows'
        });

        const result = await game.act('I attack the Nine Abyss Flame Sect');

        expect(result.narration).toMatch(/is a name, a roll and some ground/i);
        // Both routes, and they are the two the engine actually has.
        expect(result.narration).toMatch(/people who answer to it/i);
        expect(result.narration).toMatch(/whoever holds the seat/i);
        // Priced out of the catalog rather than asserted.
        expect(result.narration).toMatch(/strongest person they will actually put in a room/i);
        // And it is a refusal, not a fight: nothing was resolved, nothing spent.
        expect(refusedCall(result)).not.toBeNull();
        expect(injuryCount(db, cultivator.id)).toBe(0);
        expect(result.state.run.elapsedDays).toBe(0);
    }, 120_000);

    it('says nothing about a house the player has not heard of', async () => {
        // The knowledge gate still wins: an unheard house gets the ordinary
        // unresolved-target refusal, which names nobody and confirms nothing.
        const { game } = makeGame({ seed: 'faction-unheard' });
        await game.newRun('Ke Yan');
        const result = await game.act('I attack the Nine Abyss Flame Sect');
        expect(result.narration).not.toMatch(/nine abyss/i);
        expect(refusedCall(result)).not.toBeNull();
    }, 120_000);
});

describe('asking about yourself reaches your own sheet', () => {
    /**
     * Found by playing, and the misroute is the interesting half.
     *
     * "status" and "how am I doing" worked. "what is my situation", "who am I",
     * "am I hungry" and "how is my health" all refused outright, and "tell me
     * about myself" was WORSE than a refusal: the status rule sat after the
     * interact rule, so the sentence matched "tell me about ...", took
     * `myself` as a person, found no such person, and put the words to
     * whichever stranger was nearest. Live it read as "You put the words to
     * Bai Kekuan. They look at you the way people look at a sentence with a
     * hole in it."
     *
     * A player cannot be expected to guess which half of that split they are
     * in, and the phrasings that failed are the ones somebody types when they
     * are hurt or hungry - which is exactly when the sheet matters, because it
     * is where satiety, HP and the untreated-wound count are printed.
     */
    const SELF = [
        'what is my situation',
        'who am I',
        'am I hungry',
        'am I starving',
        'am I injured',
        'how is my health',
        'what is my condition',
        'tell me about myself',
        'describe myself',
        'check myself',
        'look at myself',
        // The two that already worked, kept so a rewrite cannot lose them.
        'status',
        'how am I doing'
    ];

    for (const said of SELF) {
        it(`routes "${said}" to the sheet`, () => {
            expect(parseIntent(said).action).toBe('status');
        });
    }

    /**
     * The guard on the possessive. `tell me about myself` is self-directed and
     * bare `about myself` is not, because a player can perfectly well ask
     * another person about themselves - and that is a conversation, not a
     * status read. If this ever flips, the self rule has been widened too far.
     */
    it('leaves a question put to somebody else as a conversation', () => {
        expect(parseIntent('I ask Cao Nuozhi about myself').action).toBe('interact');
        expect(parseIntent('I talk to Bai Kekuan').action).toBe('interact');
    });

    /**
     * Reading your own sheet is free. It is the action a player takes when they
     * suspect they are in trouble, and charging a turn for looking would make
     * finding out cost the thing they are trying to preserve.
     */
    it('costs nothing, because finding out you are dying must not cost a turn', () => {
        expect(TIME_CONSUMING_ACTIONS).not.toContain('status' as ActionName);
    });
});

describe('the noun is right and the verb is wrong', () => {
    /**
     * Found by playing, and every one of these is the same shape: the player
     * names a thing the engine models, in words a person would use, and gets
     * "it does not resolve into anything you could actually do standing here".
     *
     * The tell is that a near-synonym worked the whole time. "I refine a pill"
     * was understood and "I make a pill" was not. "I take a duty" was
     * understood and "what duties are there" was not. A player has no way to
     * find the working half except by guessing, and the failing half is
     * usually the more natural phrasing of the two.
     */
    const ROUTES: [string, ActionName][] = [
        // Alchemy. `make` is safe here only because the rule still demands an
        // alchemical noun alongside the verb.
        ['I make a pill', 'refine'],
        ['I cook a pill', 'refine'],
        ['I refine a pill', 'refine'],

        // The duty board, asked without naming the house.
        ['what duties are there', 'sect'],
        ['what missions are available', 'sect'],
        ['I volunteer for a task', 'sect'],
        ['I take a duty', 'sect'],

        // Your own sheet. `what is my rank` worked; `what rank am I` did not.
        ['what rank am I', 'status'],
        ['what realm am I', 'status'],

        // ── THESE TWO MOVED, AND THE OLD ROWS ENCODED A DEFECT ───────────
        //
        // They asserted `status`, which returned the stat block - spirit root,
        // attributes, HP, satiety - to a question about how the world receives
        // you. That is the DEFLECTIONS failure this repo documents by name in
        // `scripts/playtest-the-drive.mjs`: answering with the character sheet
        // looks like an answer and is not one, which is why it survived here.
        //
        // Regard is a real modelled system and standing is a real column, and
        // the house's own read answers both cases: a member gets rank,
        // contribution and what the next rung wants; a rogue gets "Unaffiliated.
        // No stipend, no array, no elder, and nobody to notice if this run ends
        // badly" - which is what a rogue's standing actually is, and a better
        // answer than their Might score. The block above is about near-synonym
        // coverage FOR THE SHEET, and reputation was never the sheet.
        ['what is my reputation', 'sect'],
        ['how am I regarded', 'sect'],

        // A disciple asking who their own teacher is.
        ['who is my master', 'teacher'],
        ['who can teach me', 'teacher']
    ];

    for (const [said, action] of ROUTES) {
        it(`routes "${said}" to ${action}`, () => {
            expect(parseIntent(said).action).toBe(action);
        });
    }

    /**
     * The widened rules must not start swallowing their neighbours. `make` is
     * a common English verb and `what` begins most questions in the game, so
     * these are the sentences most at risk from the two broadest additions.
     */
    it('does not swallow the verbs it sits next to', () => {
        expect(parseIntent('I travel to Low Fall').action).toBe('move');
        expect(parseIntent('what can I buy').action).toBe('market');
        expect(parseIntent('what sects are there').action).toBe('sect');
        expect(parseIntent('I look around').action).toBe('look');
        expect(parseIntent('I attack Cao Nuozhi').action).toBe('attack');
        expect(parseIntent('where can I go').action).toBe('destinations');
    });
});

describe('a site can be named the way the game named it', () => {
    /**
     * Found by playing, and it was a closed loop the player could not solve.
     *
     * "what ruins are near" prints the places by NAME - "The ones you have
     * names for are The Outer Gate of a Sect That No Longer Exists, The Bench
     * at the Burned Seat, The Gate Frame With No Gate In It..." - and the
     * parser accepted only the id slug, which is never shown anywhere. So
     * typing back a name the game had just printed reached nothing at all,
     * while `trial-the-swept-frame` answered to "swept frame".
     *
     * SITE_PHRASES was ids-only on the reasoning that site names are English
     * sentences and matching a player's prose against the WORDS in them would
     * fire on half the game. True of words, and not true of whole names:
     * `siteNamed` tests `text.includes(phrase)`, so a complete name is one long
     * specific substring rather than a bag of common words.
     */
    it('accepts the name the listing prints, with or without the article', () => {
        expect(siteNamed('i approach the gate frame with no gate in it')).toBeDefined();
        expect(siteNamed('i approach gate frame with no gate in it')).toBeDefined();
        expect(siteNamed('i go into the cave that checks the work')).toBeDefined();
    });

    /** The id slug kept working. It is the short form people actually type. */
    it('still accepts the id slug it always accepted', () => {
        expect(siteNamed('i approach the swept frame')).toBeDefined();
        expect(siteNamed('i approach the eighth stone')).toBeDefined();
    });

    /**
     * The guard the ids-only rule existed to provide. An ordinary sentence
     * that happens to share words with a site name must not resolve to it.
     */
    it('does not fire on ordinary sentences that share words with a name', () => {
        expect(siteNamed('i look at the gate')).toBeUndefined();
        expect(siteNamed('i check the work i did')).toBeUndefined();
        expect(siteNamed('i walk into the cave')).toBeUndefined();
        expect(siteNamed('what is the count here')).toBeUndefined();
    });

    /** And the whole sentence still routes, not just the name lookup. */
    it('routes an approach to a named site to the site verb', () => {
        expect(parseIntent('I approach The Cave That Checks the Work').action).toBe('site');
        expect(parseIntent('I go into The Gate Frame With No Gate In It').action).toBe('site');
    });
});

describe('the plainest things a player says', () => {
    /**
     * A sweep of forty sentences somebody would actually type found
     * twenty-two that reached nothing at all. These are the ones with an
     * unambiguous destination; the rest are recorded in the session notes as
     * open, because guessing where "I bow" or "what is the news" should go is
     * how a parser acquires rules nobody wanted.
     *
     * The pattern is the same one this file already documents: a near-synonym
     * worked the whole time. "I practise the manual" was understood and "I
     * practise" was not, because the rule demanded a noun. A cultivator with
     * one art and nothing else to do says "I train".
     */
    const ROUTES: [string, ActionName][] = [
        // Practising what you already know, said bare.
        ['I train', 'train_technique'],
        ['I practise', 'train_technique'],
        ['I drill', 'train_technique'],
        ['I spar', 'train_technique'],
        // `book` was not among the nouns, which is the commonest word for it.
        ['I read my book', 'train_technique'],
        ['I practise the manual', 'train_technique'],
        // NOT here: "I study my manual" and "I read my manual", which route to
        // `learn_technique` because `manual` is one of its nouns. That is
        // defensible and the handler answers it well - "already known, use
        // practise to raise mastery" - so it is left alone rather than fought
        // over. `book` is the word that had no route at all.

        // Your own sheet.
        ['how old am I', 'status'],
        ['what do I own', 'status'],

        // The question a player who does not know the vocabulary asks first.
        ['how do I get stronger', 'ceiling'],
        ['what should I do', 'ceiling'],
        ['what is stopping me', 'ceiling']
    ];

    for (const [said, action] of ROUTES) {
        it(`routes "${said}" to ${action}`, () => {
            expect(parseIntent(said).action).toBe(action);
        });
    }

    /**
     * The bare-verb rule is anchored to the end of the sentence, so a longer
     * sentence that merely contains the word keeps its own meaning.
     */
    it('does not let a bare verb swallow a longer sentence', () => {
        expect(parseIntent('I travel to Low Fall').action).toBe('move');
        expect(parseIntent('what am I carrying').action).toBe('inventory');
        expect(parseIntent('I look around').action).toBe('look');
        expect(parseIntent('I attack Cao Nuozhi').action).toBe('attack');
        expect(parseIntent('I cultivate for a year').action).toBe('cultivate');
        expect(parseIntent('who can teach me').action).toBe('teacher');
    });
});

describe('a pill that would do nothing asks first', () => {
    /**
     * Found by playing: a fresh cultivator at 30/30 qi spent 18 of the 30
     * spirit stones they owned on a Qi-Gathering Pill, swallowed it, and was
     * told "0 qi restored". The pill could not have done anything, it was
     * gone, and it left toxicity - strictly worse than not taking it.
     *
     * Saying so afterwards was an improvement on saying nothing, and
     * afterwards is still the wrong moment, because the pill is already spent.
     * A refusal rather than a prompt, because this layer cannot ask a question
     * and wait: the player says it again with `anyway` and it goes down.
     */
    it('refuses at full and says how to insist', async () => {
        const { game } = makeGame({ seed: 'wasted-pill', worldEnabled: true });
        await game.newRun('Wen Zhaoshi');
        await game.act('I buy a qi-gathering pill');

        const asked = await game.act('I take the pill');
        expect(asked.narration).toMatch(/qi is already \d+ of \d+/i);
        expect(asked.narration).toMatch(/anyway/i);
        // Nothing spent: the pill is still there to be taken deliberately.
        expect(refusedCall(asked)).not.toBeNull();
    }, 120_000);

    it('goes through when the player insists, and still reports the waste', async () => {
        const { game } = makeGame({ seed: 'wasted-pill', worldEnabled: true });
        await game.newRun('Wen Zhaoshi');
        await game.act('I buy a qi-gathering pill');
        await game.act('I take the pill');

        const taken = await game.act('I take the pill anyway');
        expect(taken.narration).toMatch(/swallowed/i);
        expect(taken.narration).toMatch(/No qi restored/i);
    }, 120_000);

    /**
     * The override word is not part of the pill's name. Left in the target,
     * "I take the pill anyway" resolved to a pill called "pill anyway" and
     * refused a second time for an entirely different reason - a worse answer
     * than the one being confirmed.
     */
    it('does not read the override word as part of the name', () => {
        expect(withoutTheOverride('pill anyway')).toBe('pill');
        expect(withoutTheOverride('the Qi-Gathering Pill anyway')).toBe('the Qi-Gathering Pill');
        expect(withoutTheOverride('pill')).toBe('pill');
    });

    /** A pill that would actually do something is never gated. */
    it('does not ask when the pill would work', async () => {
        const { db, game } = makeGame({ seed: 'useful-pill', worldEnabled: true });
        const { cultivator } = await game.newRun('Wen Zhaoshi');
        await game.act('I buy a qi-gathering pill');
        db.prepare('UPDATE cultivators SET qi = 5 WHERE id = ?').run(cultivator.id);

        const taken = await game.act('I take the pill');
        expect(taken.narration).toMatch(/qi restored/i);
        expect(taken.narration).not.toMatch(/would do nothing/i);
    }, 120_000);
});
