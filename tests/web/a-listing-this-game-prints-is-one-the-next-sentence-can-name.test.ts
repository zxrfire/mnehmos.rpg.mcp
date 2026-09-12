/**
 * FIVE READS PRINTED A NUMBERED LISTING AND RECORDED NONE OF IT.
 *
 * Measured by playing each read on a pinned world and saying "the second one"
 * on the turn after it. Twenty-four reads were played; these came back with
 * *"the turn before this one listed nothing to point at"*:
 *
 *     where can I go from here     nine places, by name
 *     what arts could I learn      four arts, by name
 *     who would teach me           two people, by name
 *     what trials are open         nineteen names, comma-joined
 *     who is here                  three people, by name
 *
 * This is the fourth, fifth and sixth time for the same gap, after the work
 * board, the recruiting bills and the duty wall. The contract has not moved:
 * a listing this game prints is a listing the next sentence should be able to
 * name, and `namedThisTurn` is what the reference resolver reads.
 *
 * ── AND THE MARKET COUNTED A LIST IT HAD NOT PRINTED ─────────────────────
 *
 * The market read was worse than unregistered, because it registered the wrong
 * list. Played on the same world:
 *
 *     > what is for sale here
 *     What is nearest to hand, of 43 things on offer:
 *       Bowl of millet, 2 cash each.
 *       Ferry crossing, 4 cash the crossing.
 *       ...
 *     On the stall beside the cooking pots, block-printed and much copied:
 *       Lesser Qi-Gathering Manual, 18 spirit stones the copy.
 *       Five-Breath Circulation Scripture, 29 spirit stones the copy.
 *
 *     > the second one
 *     "the second one" is Five-Breath Circulation Scripture.
 *
 * The counter goods were printed FIRST and were never written down, so the
 * ordinal counted from the second heading on the screen. The player counting
 * lines and the engine counting rows were counting different lists, and
 * nothing said so.
 *
 * So the rule these assertions encode is the one the resolver already assumed
 * and nothing enforced: AN ORDINAL COUNTS WHAT WAS PRINTED, IN THE ORDER IT
 * WAS PRINTED. Where a listing is a sample of something larger - eight of
 * forty-three on offer, four arts of a hundred and fifty-five - what is
 * recorded is the sample, because the sample is what the player read.
 *
 * Every expected name here is read back OUT of the game's own answer rather
 * than hard-coded, which is the repo's standing rule for this: any name the
 * game prints is a name the game must accept.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';

const WORLD = { seed: 'a-listing-named', worldSeed: 'a-listing-named-world' };

/** Rows printed under a heading, indented two spaces, up to the next unindented line. */
function rowsUnder(narration: string, heading: RegExp): string[] {
    const lines = narration.split('\n');
    const at = lines.findIndex(line => heading.test(line));
    if (at === -1) return [];
    const rows: string[] = [];
    for (const line of lines.slice(at + 1)) {
        if (!line.startsWith('  ')) break;
        rows.push(line.trim());
    }
    return rows;
}

/** A priced row's name: everything before the chunk carrying the price. */
function nameOfAPricedRow(row: string): string {
    const parts = row.replace(/\.$/, '').split(', ');
    return parts.slice(0, -1).join(', ');
}

async function playThen(listing: string, followUp: string) {
    const { game } = await makeGameInWorld(WORLD);
    await game.newRun('Prober');
    const listed = await game.act(listing);
    const answered = await game.act(followUp);
    return { listed: listed.narration, answered: answered.narration };
}

describe('an ordinal counts what was printed, in the order it was printed', () => {
    it('counts the market counter, which is printed above the stall', async () => {
        const { listed, answered } = await playThen('what is for sale here', 'the second one');
        const counter = rowsUnder(listed, /things on offer:|What is on offer, and what it costs/)
            .map(nameOfAPricedRow);
        expect(counter.length, `the counter printed nothing: ${listed}`).toBeGreaterThan(1);
        expect(answered, `"the second one" did not land on ${counter[1]}: ${answered}`)
            .toContain(counter[1]!);
    }, 300000);

    it('counts the arts in the order they were grouped on the screen', async () => {
        const { listed, answered } = await playThen('what arts could I learn', 'the second one');
        const arts = rowsUnder(listed, /What a root like yours could take up:/)
            .map(row => row.replace(/\s*\([^)]*\)\s*$/, '').replace(/,.*$/, '').trim());
        expect(arts.length, `no arts were listed: ${listed}`).toBeGreaterThan(1);
        expect(answered, `"the second one" did not land on ${arts[1]}: ${answered}`)
            .toContain(arts[1]!);
    }, 300000);
});

describe('a listing this game prints is one the next sentence can name', () => {
    it('names the places a destinations read printed', async () => {
        const { listed, answered } = await playThen('where can I go from here', 'the second one');
        const places = listed.split('\n')
            .map(line => /^([^:\n]{2,48}): (?:a |an |the )?[a-z][^:]*\.$/.exec(line)?.[1])
            .filter((name): name is string => name !== undefined);
        expect(places.length, `no places were listed: ${listed}`).toBeGreaterThan(1);
        expect(
            answered,
            `"the second one" did not land on ${places[1]}. Parsed: ${places.join(' | ')}\n${listed}`
        ).toContain(places[1]!);
    }, 300000);

    it('names the people a teacher read printed', async () => {
        const { listed, answered } = await playThen('who would teach me', 'the second one');
        const people = listed.split('\n')
            .map(line => /^(.+?) stands at /.exec(line)?.[1])
            .filter((name): name is string => name !== undefined);
        expect(people.length, `fewer than two teachers listed: ${listed}`).toBeGreaterThan(1);
        expect(answered, `"the second one" did not land on ${people[1]}: ${answered}`)
            .toContain(people[1]!);
    }, 300000);

    it('names the ground a site listing printed', async () => {
        const { listed, answered } = await playThen('what trials are open', 'the second one');
        const said = /The ones you have names for are (.+?) and ([^,.]+)\./s.exec(
            listed.replace(/\n/g, ' ')
        );
        expect(said, `no site listing was printed: ${listed}`).not.toBeNull();
        const names = said![1]!.split(', ').map(one => one.trim());
        expect(names.length).toBeGreaterThan(1);
        expect(answered, `"the second one" did not land on ${names[1]}: ${answered}`)
            .toContain(names[1]!);
    }, 300000);

    /**
     * The one that is not a listing verb: the square is printed on every turn,
     * so registering it unconditionally would put three strangers on the end of
     * the record every time a manual was bought and break "I study it". It is
     * recorded only where the read the player asked for IS the square.
     */
    it('names the people standing here when the read was the square', async () => {
        const { listed, answered } = await playThen('who is here', 'the second one');
        // The square arrives as sentences joined into one line, so the names
        // are read out of the text rather than off line starts.
        const people = [...listed.matchAll(
            /(?:^|[.\n]\s+)([A-Z][\w']*(?: [A-Z][\w']*)+) is here[,.]/g
        )].map(found => found[1]!);
        expect(people.length, `fewer than two people named: ${listed}`).toBeGreaterThan(1);
        expect(
            answered,
            `"the second one" did not land on ${people[1]}. Parsed: ${people.join(' | ')}\n${answered}`
        ).toContain(people[1]!);
    }, 300000);

    /**
     * And the thing the square registration must not break. Buying a manual
     * names the manual and nothing else, so the pronoun binds to it.
     */
    it('does not put the square between a thing you were handed and "it"', async () => {
        const { game } = await makeGameInWorld(WORLD);
        await game.newRun('Prober');
        const board = await game.act('what is for sale here');
        const book = /^ {2}(Lesser Qi-Gathering Manual|[A-Z][^,]+), \d/m.exec(
            board.narration.split('block-printed and much copied:')[1] ?? ''
        );
        expect(book, `no stall was printed: ${board.narration}`).not.toBeNull();
        await game.act(`I buy the ${book![1]}`);
        const studied = await game.act('I study it');
        expect(studied.narration.toLowerCase())
            .not.toContain('does not resolve into anything');
        expect(studied.narration, studied.narration).not.toMatch(/could be any of/);
    }, 300000);
});
