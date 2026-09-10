/**
 * `roads` advertised two questions and answers one, and the half it cannot
 * answer was quietly claiming the other verb's sentences.
 *
 * `roads` reads what the ground within reach would TEACH: the player's own
 * knowledge rows joined to the dao-ground catalog, plus anything they are
 * carrying that has a road bound to it. Its registration comment in
 * `action-set.ts` says so, and says the consequence - *it names no place they
 * could not already name*. `ROADS_QUESTION` in the pattern table implements
 * exactly that and nothing else.
 *
 * Its exemplar list in `how-a-player-says-each-verb.ts` held eight sentences,
 * and five of them were about getting somewhere. Measured through the whole
 * reader, before anything was changed:
 *
 *     how do I get to the mountain from here     table unclear -> tier roads
 *     which way does the road run                table unclear -> tier roads
 *     what is the route out of this place        table unclear -> tier roads
 *     what road takes me there                   table unclear -> tier roads
 *     how far is it and by which way             table unclear -> tier roads
 *     what can this ground teach me              table roads
 *     is there ground around here that teaches a dao   table roads
 *     does this mountain teach anything          table unclear -> tier roads
 *
 * ── WHY THE TABLE'S `unclear` WAS NOT THE FINDING ────────────────────────
 *
 * It reads as five sentences reaching nothing, and that is not what was
 * happening. `unclear` at the table is the documented handoff to the tier
 * below it, and the tier answered all five - with `roads`, because the corpus
 * is what the tier reads. So the player asking how to reach a mountain got a
 * list of ground that teaches a dao, delivered with confidence.
 *
 * And it did not stop at the five. The tier matches on meaning, so an exemplar
 * filed under a verb pulls every sentence like it to that verb. Six sentences
 * nobody had filed anywhere, run through the whole reader against the corpus
 * as it stood:
 *
 *     how do I get to Iron Ridge from here      -> roads
 *     which way to the mountain                 -> roads
 *     how do I reach the city                   -> roads
 *     what is the road to the ford like         -> roads
 *     which road runs out of this town          -> roads
 *     how far is the mountain and which way     -> roads
 *
 * ── THE RULING: THE CORPUS WAS MISFILED, AND `roads` DOES NOT GROW A HALF ─
 *
 * The alternative was to build a route read beside the dao read, and the
 * measurement is against it: `destinations` already answers these. It prints
 * every place this cultivator can point at with the days out from the region
 * connections, the qi band, the local ceiling and who is already drawing on
 * that ground, and under the list it prints the two ways of getting there that
 * are not the road - what is inside one step for somebody who folds, and
 * whether the Shrinking Earth Pavilion keeps a counter here. That is what
 * "how far is it and by which way" has an answer for in this engine, because
 * travel is priced in days between provinces and there is no road object to
 * describe the shape of.
 *
 * So the five moved to `destinations`, and `roads` kept the three that ask
 * what somewhere would teach. After, the same six held-out sentences:
 *
 *     all six -> destinations
 *
 * and no movement sentence went with them: "I take the road out of here",
 * "I travel to the mountain", "I set out for the next town" and "I head for
 * the peaks" all still reach `move`. The whole reader over the corpus is
 * unchanged at 0.998 (491 of 492, against 489 of 490 before).
 *
 * ── WHAT THE ROUTE READ IS STILL MISSING, AND IT IS `destinations`' ──────
 *
 * One thing the five asked for that nothing prints. A region connection in
 * `src/data/cultivation/regions/*.ts` carries a `description` that is
 * literally the road - *"the border road from Clear River Ford to Iron Ridge:
 * eleven days by cart, four by Shrinking Earth Pavilion courier where the Span
 * still runs it"* - and `whereCouldTheyGo` reads `travelDays` off that
 * connection and drops the sentence beside it. Bearings are held too, and
 * reach only the sighting channel for ground the player cannot name. Neither
 * is a new verb; both are rows `destinations` already has in its hand.
 *
 * ── AND THE BLIND SPOT THIS FILE EXISTS BECAUSE OF ───────────────────────
 *
 * None of this could fail a test, and the reason is structural rather than an
 * oversight. `the-table-agrees-with-the-corpus-about-its-own-verbs.test.ts`
 * fails an exemplar that reaches a DIFFERENT verb, and these reached
 * `unclear`, which passes on purpose. Its whole-reader sweep scored all eight
 * correct - because the tier's answer IS the corpus, so a misfiled sentence is
 * its own nearest neighbour and confirms itself. A misfiled exemplar passes
 * both tests twice over while teaching the reader to misroute everything that
 * means the same thing.
 *
 * Which is why every route sentence asserted below is HELD OUT of the corpus.
 * A test drawn from the corpus would be asking the corpus whether it agrees
 * with itself. Confirmed red on the corpus as it stood: five of the six
 * reached `roads`.
 */

import { describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/actions';
import {
    readyTheTier,
    verbForASentenceThePatternsMissed
} from '../../src/web/reaching-a-verb-the-pattern-table-has-no-line-for';

/** What a player actually meets: the table, and the tier under it. */
async function readerAnswerFor(said: string): Promise<string> {
    const fromTable = parseIntent(said);
    return (await verbForASentenceThePatternsMissed(said, fromTable)).action;
}

describe('the table keeps the two subjects apart on its own', () => {
    it.each([
        ['what can this ground teach me', 'roads'],
        ['is there ground around here that teaches a dao', 'roads'],
        ['where can I go', 'destinations'],
        ['I head to Iron Ridge', 'move'],
        ['I travel to the mountain', 'move']
    ])('%s -> %s', (said, want) => {
        expect(parseIntent(said).action).toBe(want);
    });
});

describe('a question about getting somewhere is not a question about a dao', () => {
    it('routes held-out route sentences to the verb that prices a journey', async () => {
        await readyTheTier();

        // None of these is in `how-a-player-says-each-verb.ts`, deliberately.
        // See the header: an exemplar is its own nearest neighbour, so a test
        // written from the corpus cannot fail on a misfiling.
        const routes = [
            'how do I get to Iron Ridge from here',
            'which way to the mountain',
            'how do I reach the city',
            'what is the road to the ford like',
            'which road runs out of this town',
            'how far is the mountain and which way'
        ];
        const reached = await Promise.all(routes.map(readerAnswerFor));
        expect(
            routes.map((said, i) => `"${said}" -> ${reached[i]}`),
            'a sentence asking how to reach somewhere reached the verb that reads what '
            + 'ground TEACHES. It answers with dao ground and names no route, so the player '
            + 'is confidently told something that is not an answer to what they asked.'
        ).toEqual(routes.map(said => `"${said}" -> destinations`));
    }, 300_000);

    it('leaves the teaching half where it was, including the word `road` in that sense', async () => {
        await readyTheTier();

        // `road` left with the five, so the risk runs the other way too: the
        // dao sense of the word has to keep a line of its own or it drifts to
        // the verb that now owns five sentences containing it.
        const daos = [
            'what would I comprehend if I sat here',
            'does this valley teach anything',
            'what can this place teach me about the way',
            'is there ground near here that would teach me something'
        ];
        const reached = await Promise.all(daos.map(readerAnswerFor));
        expect(daos.map((said, i) => `"${said}" -> ${reached[i]}`))
            .toEqual(daos.map(said => `"${said}" -> roads`));
    }, 300_000);

    it('does not take a journey somebody is actually making', async () => {
        await readyTheTier();

        // The five that moved are questions. The verbs of going are `move`,
        // `ride` and `fold`, and a corpus edit that widened `destinations`
        // across the question mark would take them - which is the failure this
        // repo has recorded several times over under a different verb's name.
        const going = [
            'I take the road out of here',
            'I travel to the mountain',
            'I set out for the next town',
            'I head for the peaks'
        ];
        const reached = await Promise.all(going.map(readerAnswerFor));
        expect(going.map((said, i) => `"${said}" -> ${reached[i]}`))
            .toEqual(going.map(said => `"${said}" -> move`));
    }, 300_000);
});
