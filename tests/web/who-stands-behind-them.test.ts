/**
 * WHO STANDS BEHIND THEM - THE QUESTION ASKED BEFORE ANYBODY MOVES ON A HOUSE.
 *
 * `crossings.ts` carries the whole answer: every crossing every house has ever
 * produced, who it was and how long ago, whether anything still comes down and
 * at what grade, and what the count buys in silences the house can survive. It
 * argues at length, and seven of its readers had no caller anywhere -
 * `getLineageStanding`, `lineageTierFor`, `hasAnsweringChannel`,
 * `answeringChannels`, `standingsAreNotATotalOrder`, `ARCHIVE_AS_CLAIM`,
 * `PAVILION_SURPLUS`. There was no sentence a player could type to reach it.
 *
 * ── WHAT THE GATE IS FOR, WHICH IS NOT DIFFICULTY ────────────────────────
 *
 * A house's TIER is public: a count run through a table everybody uses. It does
 * not move, and a founder who went up thirty-four centuries ago counts as much
 * in it as somebody who went up last century.
 *
 * Whether anything still ARRIVES is not public, and it is the half that decides
 * anything. The two come apart hard, and the two houses below are the case:
 *
 *   THE STORM TYRANT COURT is `supreme` on the public table and its shelf is
 *   bare. Its own entry says why nobody knows - "famous for refusing, and the
 *   refusal costs it nothing, which is a comfortable position until somebody
 *   works out that the shelf behind it is bare."
 *
 *   THE AZURE CLOUD PAVILION is one crossing and the same public tier, and has
 *   the deepest stock in the world off a channel that answers every nine to
 *   fourteen years.
 *
 * Same reckoning, opposite positions. A player who reasons from the tier has
 * been told something TRUE and has not been told the thing that matters, which
 * is the shape this file exists to keep.
 */

import { describe, expect, it } from 'vitest';

import { LINEAGE_STANDINGS, getLineageStanding } from '../../src/data/cultivation/crossings';
import { APEX_INSTITUTIONS, COURTS, SECTS } from '../../src/data/cultivation/index';
import { parseIntent } from '../../src/web/actions';
import {
    howMuchTheyKnowAt,
    noHouseStandsHighest,
    whoStandsBehindThem
} from '../../src/web/who-stands-behind-them';

const THE_COURT = 'sect-storm-tyrant-court';
const THE_PAVILION = 'sect-azure-cloud-pavilion';

function nameOfAnyBody(id: string): string {
    const named = (row: { id: string; name: string }): boolean => row.id === id;
    return SECTS.find(named)?.name
        ?? COURTS.find(named)?.name
        ?? APEX_INSTITUTIONS.find(named)?.name
        ?? id;
}

function read(factionId: string, ordinal: number) {
    return whoStandsBehindThem({
        factionId,
        houseName: nameOfAnyBody(factionId),
        readerOrdinal: ordinal
    });
}

describe('the sentence', () => {
    it('reaches the read, named and unnamed', () => {
        for (const [sentence, target] of [
            ['who stands behind the Azure Cloud Pavilion', 'Azure Cloud Pavilion'],
            ['who is above the Storm Tyrant Court', 'Storm Tyrant Court'],
            ['who would answer for the Azure Cloud Pavilion', 'Azure Cloud Pavilion']
        ] as const) {
            const plan = parseIntent(sentence) as { action: string; intent?: string; target?: string };
            expect(plan.action, sentence).toBe('look');
            expect(plan.intent, sentence).toBe('who_is_above_them');
            expect(plan.target, sentence).toBe(target);
        }
        // And the general form, which names nobody on purpose.
        expect(parseIntent('which house is the greatest').intent).toBe('who_is_above_them');
        expect(parseIntent('how many immortals do they have').intent).toBe('who_is_above_them');
    });

    /**
     * AND IT IS NOT THE GROUND READ. Both name a house; only one is about the
     * patch underfoot, and answering the wrong one confidently is the failure
     * this repo keeps unpicking.
     */
    it('leaves the ground holder question alone', () => {
        expect(parseIntent('who holds this ground').intent).toBe('holder');
        expect(parseIntent('who is in charge here').intent).toBe('holder');
        expect(parseIntent('whose land is this').intent).toBe('holder');
    });
});

describe('the gate', () => {
    it('cuts where the ladder cuts, and the bands are ordered', () => {
        expect(howMuchTheyKnowAt(4)).toBe('the_public_reckoning');
        expect(howMuchTheyKnowAt(20)).toBe('what_still_arrives');
        expect(howMuchTheyKnowAt(35)).toBe('what_it_costs_them');
    });

    /**
     * THE PUBLIC RECKONING IS TRUE AND INSUFFICIENT, and says so. What it must
     * never do is imply it has answered the question.
     */
    it('gives a low cultivator the count and tells them it is only a count', () => {
        const low = read(THE_COURT, 4);
        expect(low.reach).toBe('the_public_reckoning');
        expect(low.lines.join(' ')).toMatch(/reckoned supreme/i);
        expect(low.lines.join(' ')).toMatch(/it is a count/i);
        // And not a word about the empty shelf.
        expect(low.lines.join(' ')).not.toMatch(/Nothing comes down|shelf behind it is bare/i);
    });

    /**
     * THE TWO HOUSES THAT COME APART. Same public tier, opposite positions, and
     * only the gated read can tell them apart - which is the whole design.
     */
    it('reads the same tier as two different positions once the gate opens', () => {
        expect(getLineageStanding(THE_COURT)!.tier)
            .toBe(getLineageStanding(THE_PAVILION)!.tier);

        const court = read(THE_COURT, 20).lines.join(' ');
        const pavilion = read(THE_PAVILION, 20).lines.join(' ');
        expect(court).toMatch(/Nothing comes down to them any more/i);
        expect(pavilion).toMatch(/answers OFTEN/);
    });

    /**
     * AND THE HOUSE'S OWN REASONING, at the top band. Read off the fields
     * rather than restated, so nothing here can drift from the catalog.
     */
    it('gives the top band what the position actually costs them', () => {
        const deep = read(THE_COURT, 35);
        expect(deep.reach).toBe('what_it_costs_them');
        const standing = getLineageStanding(THE_COURT)!;
        expect(deep.lines).toContain(standing.whatDepletionLooksLike);
        expect(deep.lines).toContain(standing.resilience);
        expect(deep.lines).toContain(standing.behaviour);
    });

    /**
     * A PERSONAL CHANNEL IS NOT AN ANSWERING ONE, and reading the boolean alone
     * got this wrong. `hasAnsweringChannel` is false for the Pavilion - whose
     * channel answers every nine to fourteen years - so the read told it
     * nothing was arriving and then said its stock was rising in the next line.
     */
    it('never says nothing arrives to a house whose stock is rising', () => {
        for (const standing of LINEAGE_STANDINGS) {
            if (standing.trend !== 'rising') continue;
            const lines = read(standing.factionId, 20).lines.join(' ');
            expect(lines, standing.factionId).not.toMatch(/Nothing is arriving|Nothing comes down/i);
        }
    });
});

describe('a house nobody is above', () => {
    /** The ordinary case, and saying it plainly is a real answer. */
    it('says so, for the houses that have never put anybody across', () => {
        const ordinary = SECTS.find(s => !getLineageStanding(s.id));
        expect(ordinary, 'every house in the world has a crossing').toBeTruthy();
        const answer = read(ordinary!.id, 35);
        expect(answer.standing).toBeNull();
        expect(answer.lines.join(' ')).toMatch(/never put anybody across/i);
    });
});

describe('which house stands highest', () => {
    /**
     * ANSWERED BY REFUSING TO PICK ONE, which is what the catalog says: three
     * questions get asked as one and they do not agree.
     */
    it('gives three orderings and the reason there is no fourth', () => {
        const spread = noHouseStandsHighest(nameOfAnyBody);
        const said = spread.lines.join(' ');
        expect(said).toMatch(/no answer to that/i);
        expect(said).toMatch(/By what still answers/);
        expect(said).toMatch(/By what is on the shelf/);
        expect(said).toMatch(/By the best grade/);
        expect(said).toMatch(/has chosen an axis and not said so/);
    });

    /**
     * AND NEVER A RAW ID. The three orderings mix sects with apex institutions
     * and a court, and `getSect` knows only the first - so falling back to the
     * id put `apex-long-cut` in front of a player.
     */
    it('names every body in the ranking the way the world names it', () => {
        const said = noHouseStandsHighest(nameOfAnyBody).lines.join(' ');
        expect(said).not.toMatch(/\bapex-[a-z-]+\b/);
        expect(said).not.toMatch(/\bsect-[a-z-]+\b/);
        expect(said).toContain('The Long Cut');
        expect(said).toContain('The Earth Vein Tower');
    });
});
