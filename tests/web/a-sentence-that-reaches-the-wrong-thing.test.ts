/**
 * Sentences the table answered CONFIDENTLY and wrongly.
 *
 * A phrasing that reaches nothing costs a moment and the player says it again.
 * A phrasing that reaches the WRONG verb hands back an answer to a question
 * nobody asked, and where the wrong verb spends days the mistake is permanent
 * before it can be read. Every row below was measured against `parseIntent` on
 * this branch and is recorded here as it was found.
 *
 * ── WHAT THE SWEEP FOUND, AND WHAT IT COST ───────────────────────────────
 *
 * Time spent on the wrong thing:
 *
 *     i look for work            -> work, 90 days   a search for a job became
 *                                                   a season of hauling
 *     i work out my own art      -> work, 90 days   deriving a method became
 *                                                   the same season
 *
 * An answer about something else entirely, swept over all 38 rows of `SECTS`:
 *
 *     what does the X pay        -> sect/donate     33 of 38, the confident
 *                                                   opposite: asking what you
 *                                                   would be PAID, answered
 *                                                   with paying in. Four more
 *                                                   took a figure out of the
 *                                                   house's NAME - the Six Li
 *                                                   Patrol a donation of 6,
 *                                                   the Thousand Relic
 *                                                   Pavilion one of 1000
 *     how high would the X take me -> what_they_teach with NO TARGET, 38 of
 *                                                   38. That read takes an
 *                                                   absent name to mean YOUR
 *                                                   OWN house, so every one of
 *                                                   them answered about the
 *                                                   asker's own shelf with
 *                                                   nothing to say so
 *     how many people are in the X -> look/crowding, 38 of 38: the draw on the
 *                                                   square underfoot, which is
 *                                                   not the house
 *     i take the sword out of my ring -> interact/steal, and `interact` fills
 *                                                   an absent target in from
 *                                                   whoever is standing here,
 *                                                   so rummaging in your own
 *                                                   bag robbed a bystander
 *     i put the sword in my ring -> attack          a swing at nobody
 *     what do i have to answer for -> inventory     the ledger read answers
 *                                                   this in both directions
 *                                                   and no sentence reached it
 *     i file a petition          -> interact/negotiate, which `docs/verbs.md`
 *                                                   names by hand as the one
 *                                                   thing `interact` must not
 *                                                   answer
 *     i ask him where the market is -> interact/trade: a word inside the TOPIC
 *                                                   chose the intent
 *     what can i book from here  -> market, target "from here"
 *
 * Targets mangled - the right verb with an argument nothing resolves, which is
 * worse than none, because an absent target means whoever is at hand and a
 * wrong one is a refusal about somebody who is not here:
 *
 *     i tell him about the X     -> target "him about the X", 38 of 38
 *     i fly to Iron Crest on my sword -> target "Iron Crest on my sword"
 *     i stand guard for a month  -> target "month"
 *     who owes me anything       -> target "me anything"
 *     i insult him / i draw my sword on him -> no target
 *
 * `i take his purse` was measured the same way and is DELIBERATELY NOT FIXED.
 * `a-theft-is-a-sentence-the-engine-answers.test.ts` rules that the sentence
 * names nobody, that an absent target on `interact` already means whoever is at
 * hand, and that a guessed pronoun would be a guess where a guess is worse than
 * a refusal. Recorded so the next sweep does not file it again as new.
 *
 * ── WHAT IS ASSERTED, AND WHAT IS DELIBERATELY NOT ───────────────────────
 *
 * The verb, and the target where a house or a person is involved. Never the
 * wording of an answer and never a day count the balance constants own. The
 * house rows run over `SECTS` rather than over a written list, so a house added
 * tomorrow is swept the day it is added.
 *
 * `how many people are in the X` now reaches NOTHING, and that is the ruling
 * rather than a gap left by accident: the engine holds no read for the size of
 * a house's roll. A sentence that misses costs a moment; the one it replaces
 * was costing a confident fact about the wrong subject.
 *
 * Red-checked by inverting each assertion.
 */

import { describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/actions';
import { SECTS } from '../../src/data/cultivation/sects';

/**
 * The house as a player says it. Two names in the catalog carry their own
 * article - The Severed, The Empyrean Court - and "the The Severed" is not a
 * sentence anybody types. Stripping it here keeps the sweep over the whole
 * catalog without the fixture inventing a phrasing to fail on.
 */
const asSaid = (name: string) => name.replace(/^the\s+/i, '');

/** The verb and, where it matters, the argument. */
const reached = (said: string) => {
    const plan = parseIntent(said) as { action: string; intent?: string; target?: string };
    return { action: plan.action, intent: plan.intent, target: plan.target };
};

describe('a sentence that reaches the wrong thing', () => {
    describe('a search is not the act, and must not spend the days', () => {
        it.each([
            'i look for work',
            'I look for work',
            'i ask around for work',
            'i hunt for a job'
        ])('%s reads the board rather than buying a season of it', said => {
            const got = reached(said);
            expect(got.action).toBe('work');
            expect(got.intent).toBe('board');
            expect(parseIntent(said)).not.toHaveProperty('days');
        });

        it.each([
            'i take whatever work there is',
            'i hire myself out for a season',
            'i work for a year',
            'i earn my keep for a year'
        ])('%s still takes the work and still spends the days', said => {
            const got = reached(said);
            expect(got.action).toBe('work');
            expect(got.intent).not.toBe('board');
            expect(parseIntent(said)).toHaveProperty('days');
        });

        it('working out your own art is authorship, not hauling', () => {
            expect(reached('i work out my own art').action).toBe('derive');
            expect(reached('i work on my technique').action).toBe('train_technique');
        });
    });

    describe('what a house pays is not what you pay it', () => {
        it.each(SECTS.map(house => house.name))('what does the %s pay', name => {
            const got = reached(`what does the ${asSaid(name)} pay`);
            expect(got.action).toBe('sect');
            expect(got.intent).toBe('stipend');
        });

        it.each(SECTS.map(house => house.name))(
            'donating to the %s is still donating',
            name => {
                const got = reached(`i donate 100 spirit stones to the ${asSaid(name)}`);
                expect(got.action).toBe('sect');
                expect(got.intent).toBe('donate');
            }
        );

        it('what a JOB paid is still the purse, and not a house at all', () => {
            expect(reached('what did i earn').action).toBe('inventory');
            expect(reached('how much did that pay').action).toBe('inventory');
        });
    });

    describe('a question about a house names the house', () => {
        it.each(SECTS.map(house => house.name))(
            'how high would the %s take me carries the name',
            name => {
                const got = reached(`how high would the ${asSaid(name)} take me`);
                expect(got.action).toBe('look');
                expect(got.intent).toBe('what_they_teach');
                // WITHOUT THIS THE READ ANSWERS ABOUT THE ASKER'S OWN HOUSE.
                expect(got.target?.toLowerCase()).toContain(
                    name.replace(/^the\s+/i, '').toLowerCase()
                );
            }
        );

        it.each(SECTS.map(house => house.name))(
            'what does the %s teach is unmoved',
            name => {
                const got = reached(`what does the ${asSaid(name)} teach`);
                expect(got.action).toBe('look');
                expect(got.intent).toBe('what_they_teach');
                expect(got.target?.toLowerCase()).toContain(
                    name.replace(/^the\s+/i, '').toLowerCase()
                );
            }
        );

        it.each(SECTS.map(house => house.name))(
            'how many people are in the %s is not the ground underfoot',
            name => {
                const got = reached(`how many people are in the ${asSaid(name)}`);
                expect(got.intent).not.toBe('crowding');
            }
        );

        it.each(['how crowded is it here', 'how many people are here', 'is this place crowded'])(
            '%s is still the ground underfoot',
            said => {
                const got = reached(said);
                expect(got.action).toBe('look');
                expect(got.intent).toBe('crowding');
            }
        );
    });

    describe('a telling puts the person first', () => {
        it.each(SECTS.map(house => house.name))('i tell him about the %s', name => {
            const got = reached(`i tell him about the ${asSaid(name)}`);
            expect(got.action).toBe('interact');
            expect(got.target).toBe('him');
            expect(got.target).not.toContain('about');
        });

        it('and about anything else', () => {
            expect(reached('i tell him about the road').target).toBe('him');
        });

        it('asking somebody about something is unmoved', () => {
            const got = reached('i ask the merchant about the road');
            expect(got.action).toBe('interact');
            expect(got.target).toBe('merchant');
        });
    });

    describe('an argument the engine can use, or none at all', () => {
        it.each([
            ['i stand guard for a month', 'guard'],
            ['i fly to Iron Crest on my sword', 'ride'],
            ['who owes me anything', 'oath'],
            ['what do i have to answer for', 'oath']
        ])('%s reaches %s without swallowing the rest of the sentence', (said, verb) => {
            const got = reached(said);
            expect(got.action).toBe(verb);
            for (const swallowed of ['month', 'on my sword', 'anything', 'answer for']) {
                expect(got.target ?? '').not.toContain(swallowed);
            }
        });

        it('a destination said without a mount is unmoved', () => {
            expect(reached('i travel to Iron Crest').target).toBe('Iron Crest');
        });

        it('a watch over a named person is unmoved', () => {
            expect(reached('i stand guard over Han Peiwu').target).toBe('Han Peiwu');
        });
    });

    describe('an act aimed at somebody reaches somebody', () => {
        it.each([
            // `insult` rather than `interact`: it was promoted to a verb of
            // its own when a curse had to be able to reach a ROOM. What this
            // file is about is the TARGET, which is unchanged.
            ['i insult him', 'insult', 'him'],
            ['i insult the elder', 'insult', 'elder'],
            ['i draw my sword on him', 'attack', 'him']
        ])('%s', (said, verb, who) => {
            const got = reached(said);
            expect(got.action).toBe(verb);
            expect(got.target).toBe(who);
        });

        it('a theft aimed at a named person is unmoved', () => {
            expect(reached('i take Wei Lanya\'s purse').target).toBe('Wei Lanya');
        });

        // AND A THEFT POINTED AT WITH A PRONOUN STAYS NAMELESS. The sibling
        // file rules it and this pins the ruling from the other side, so a
        // later sweep finding "i take his purse" with no target can see that it
        // was considered rather than missed.
        it('a theft pointed at rather than named still names nobody', () => {
            expect(reached('i take his purse').intent).toBe('steal');
            expect(reached('i take his purse').target).toBeUndefined();
        });
    });

    describe('your own pouch is neither a swing nor a theft', () => {
        it('taking out of your own pouch is a look at what you are carrying', () => {
            expect(reached('i take the pill out of my pouch').action).toBe('inventory');
        });

        // And a ring of your own is somewhere a thing is put or taken from, which the carry verb
        // does: see `what-is-in-your-ring.ts`.
        it.each([
            ['i put the sword in my ring', 'store'],
            ['i take the sword out of my ring', 'retrieve'],
            ['i put the manual in my storage ring', 'store']
        ])('%s is putting it in or taking it out', (said, intent) => {
            expect(reached(said).action).toBe('carry');
            expect(reached(said).intent).toBe(intent);
        });

        it('somebody else\'s is still a theft', () => {
            expect(reached('i take the sword out of his pouch').intent).toBe('steal');
        });
    });

    describe('the rest of the sweep', () => {
        it('asking a person where something is does not open a haggle', () => {
            const got = reached('i ask him where the market is');
            expect(got.action).toBe('interact');
            expect(got.intent).toBe('talk');
            expect(got.target).toBe('him');
        });

        it('going to the market is still the market', () => {
            expect(reached('i go to the market').action).toBe('market');
            expect(reached('what is for sale').action).toBe('market');
        });

        it('booking is the counter, and a book is still a manual', () => {
            expect(reached('what can i book from here').action).toBe('passage');
            expect(reached('i study the manual').action).toBe('learn_technique');
        });

        it('filing one is the verb docs/verbs.md says it is', () => {
            const got = reached('i file a petition');
            expect(got.action).toBe('petition');
            // No house was named, so no house is claimed to have been.
            expect(got.target).toBeUndefined();
        });

        it('petitioning a named party is unmoved', () => {
            expect(reached('i petition the elder').target).toBe('elder');
            expect(reached('i appeal to the elder').action).toBe('petition');
        });

        // ── THREE THE GLOSSARY SWEEP FOUND, ALL OF THEM ORDERING ─────────
        //
        // Each is a branch firing above the one that owns the sentence, which
        // is the failure `verb-pattern-table.ts` warns about in its own header.
        // Measured before the fix:
        //
        //     who would vouch for him      -> sect/plead    (spoke for him)
        //     in the name of the sect I order ... -> sect/order (the claim of
        //                                     the house's authority dropped,
        //                                     and the check on it never ran)
        //     i help myself to the archives -> interact/take (a taking from a
        //                                     person, while the same sentence
        //                                     with the word "sect" in it
        //                                     reached sect/take)
        it('asking who would vouch is not vouching', () => {
            const got = reached('who would vouch for him');
            expect(got.action).toBe('look');
            expect(got.intent).toBe('who_is_above_them');
        });

        it.each(['i plead for him', 'i speak for him', 'i put in a word for him'])(
            '%s is still the plea',
            said => {
                expect(reached(said).intent).toBe('plead');
            }
        );

        it('an order given in the house\'s name is a decree', () => {
            expect(reached('in the name of the sect I order the outer disciples to gather').intent)
                .toBe('decree');
            expect(reached('by the order of the sect I order the outer disciples to gather').intent)
                .toBe('decree');
        });

        it('an order given in your own is still an order', () => {
            expect(reached('i order the outer disciples to gather').intent).toBe('order');
        });

        it('the house\'s shelf is not a person\'s pocket', () => {
            expect(reached('i help myself to the archives').action).toBe('sect');
            expect(reached('i help myself to the archives').intent).toBe('take');
            // And the word that used to be load bearing no longer decides it.
            expect(reached('i help myself to the sect archives').action).toBe('sect');
        });

        it('helping yourself to what somebody is carrying is still a theft', () => {
            expect(reached('i help myself to his stones').intent).toBe('steal');
        });

        it('the pouch still answers the pouch question', () => {
            expect(reached('what do i have').action).toBe('inventory');
            expect(reached('what am i carrying').action).toBe('inventory');
        });
    });
});
