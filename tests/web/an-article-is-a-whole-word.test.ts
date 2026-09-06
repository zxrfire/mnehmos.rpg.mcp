/**
 * THE PARSER WAS EATING THE FIRST LETTER OF SEVEN HOUSES.
 *
 * `partyAfter` pulls the party out of a sentence for thirteen callers - war,
 * alliance, tribute, defection, applying to a house, and most of the verbs that
 * take somebody's name. It let an optional article stand in front of the name
 * and then allowed the space after it to be absent:
 *
 *     (?:the|a|an|our|its|their|his|her)?\s*
 *
 * `\s*` matches NOTHING, so the optional article was free to take the first
 * letter of the name behind it. Measured on the trope corpus against a live
 * narrator, in the scenario named for a declaration travelling:
 *
 *     I will end the Azure Cloud Pavilion   ->   target "zure Cloud Pavilion"
 *
 * `a` took the A of Azure and the capture began one character in. The
 * declaration then resolved nobody, and what came back was a bystander asking
 * who the player meant - about a sentence that had named a house of the
 * catalog in full, with its article, correctly spelled.
 *
 * Seven of the thirty-six houses in the world start with one of those words:
 * three Azure, the Ashen Forge Clan, the Ancient Bough Grove, The Hollow Court,
 * The Severed. Every one of them was being mangled by every one of the thirteen
 * callers, and the failure was invisible - no error, no refusal about spelling,
 * just a target that resolved to nobody and a verb politely asking again.
 *
 * The fix is that an article is a WORD, so the whitespace belongs inside the
 * optional group rather than beside it.
 */

import { describe, expect, it } from 'vitest';

import { SECTS } from '../../src/data/cultivation/sects';
import { parseIntent } from '../../src/web/actions';
import { partyAfter } from '../../src/web/sentence-parts';
import { makeGameInWorld } from './harness';

/** The words the optional article group admits. */
const ARTICLES = ['the', 'a', 'an', 'our', 'its', 'their', 'his', 'her'];

describe('an article in front of a name', () => {
    /** The exact reading that failed, kept as the sentence that found it. */
    it('does not eat the A of Azure', () => {
        expect(partyAfter('I will end the Azure Cloud Pavilion', 'an end to|against|on|the'))
            .toBe('Azure Cloud Pavilion');
    });

    /**
     * AND NOT ANY OTHER FIRST LETTER EITHER. Read off the catalog rather than
     * listed here, so a house added later that starts with one of these words
     * is covered without anybody remembering to add it.
     */
    it('leaves every house in the world spelled the way the catalog spells it', () => {
        const atRisk = SECTS.filter(sect =>
            ARTICLES.some(article => sect.name.toLowerCase().startsWith(article)));
        expect(atRisk.length, 'no house starts with an article-like word any more')
            .toBeGreaterThan(0);

        for (const sect of atRisk) {
            const bare = sect.name.replace(/^the\s+/i, '');
            const got = partyAfter(`I declare war on the ${bare}`, 'war (?:on|against|upon|with)');
            expect(got, sect.name).toBe(bare);
        }
    });

    /** A real article is still stripped, which is what the group is for. */
    it('still takes a genuine article off the front', () => {
        expect(partyAfter('I declare war on the Cold Sword Sect', 'war (?:on|against|upon|with)'))
            .toBe('Cold Sword Sect');
        expect(partyAfter('I apply to the Thousand Treasure Pavilion', 'apply to|to'))
            .toBe('Thousand Treasure Pavilion');
    });
});

describe('through the table', () => {
    it('carries the whole name into the plan', () => {
        for (const [sentence, target] of [
            ['I will end the Azure Cloud Pavilion', 'Azure Cloud Pavilion'],
            ['I declare war on the Ashen Forge Clan', 'Ashen Forge Clan'],
            ['I declare war on the Ancient Bough Grove', 'Ancient Bough Grove'],
            ['I declare war on the Azure Dew Sect', 'Azure Dew Sect']
        ] as const) {
            const plan = parseIntent(sentence) as { target?: string };
            expect(plan.target, sentence).toBe(target);
        }
    });
});

describe('played', () => {
    /**
     * WHAT THE DECLARATION ACTUALLY GETS, which is the point of fixing the
     * name: a real answer about what a war needs, and a deed that enters the
     * world. Before this the same sentence reached `resolveParty` and came back
     * as a bystander asking who was meant.
     */
    it('is answered by the house layer rather than by somebody asking who you meant', async () => {
        // A seed with people standing in the square, because a declaration
        // nobody hears is correctly a declaration that does not travel - the
        // deed below is written off who was there, not off the sentence.
        const { game } = await makeGameInWorld({ seed: 'decl', worldSeed: 'world-decl' });
        await game.newRun('Declarer');
        await game.act('I look around');

        const answer = await game.act('I will end the Azure Cloud Pavilion');
        const calls = ((answer as { toolCalls?: { name: string }[] }).toolCalls ?? [])
            .map(c => c.name).join(' ');
        const heard = (answer as { narration?: string }).narration ?? '';

        expect(calls, heard).toContain('engine.housePosture');
        // AND IT TRAVELS, which is what the scenario is named for.
        expect(calls).toContain('world.aDeedEntersTheWorld');
        // Never again a person asking which of the people here was meant.
        expect(calls).not.toContain('engine.resolveParty');
        expect(heard).not.toMatch(/which of them you meant|who you mean/i);
    }, 200_000);
});
