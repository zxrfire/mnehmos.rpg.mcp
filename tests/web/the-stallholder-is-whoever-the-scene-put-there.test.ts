/**
 * The person behind the stall was re-picked on every turn of a haggle.
 *
 * The design owner: *"the stallholder should resolve from what happens
 * before."* A haggle runs several turns and only the first of them usually
 * names anybody - a figure put to somebody, then "that is too expensive", then
 * another figure - and every turn after the first searched the square again
 * from nothing. The engine's own account of the exchange then read *"from a
 * board rate with nobody behind it"* on the turn after the screen had printed a
 * name, and in a square where several people are selling, a figure could land
 * in a different mouth than the one that quoted it.
 *
 * THE CONTINUITY WAS ALREADY IN THE RECORD AND NOTHING READ IT.
 * `ThingNamed.from` - who was offering the thing the last screen quoted - has
 * been written by the market read since it existed and had one reader, the
 * prompt block. So this is a read rather than a second store of who we were
 * just talking to: `nameWhatTheyGot` carries the seller so a haggle turn
 * re-establishes them, and the next turn continues with whoever the screen
 * before put behind the counter.
 *
 * ONLY WHERE THE SCREEN BEFORE ESTABLISHED ONE PERSON. A board read names eight
 * things from eight sellers, and continuing with whichever of them the record
 * listed first would be the same re-pick wearing a fix. That is the rule the
 * THING already goes through in the same handler, applied to the mouth.
 *
 * WHERE THIS IS ASSERTED. The engine's account of the exchange, which is the
 * channel that states who was across the table whatever the prose does with it.
 *
 * RED-CHECKED. Dropping the fallback leaves the third turn accounting for the
 * same book against nobody.
 */

import { describe, it, expect } from 'vitest';
import type Database from 'better-sqlite3';

import { makeGameInWorld, type Harness } from './harness';
import { npcsAt } from '../../src/engine/world/world-state';
import { resetCultivationWorlds } from '../../src/server/state/cultivation-world';
import { manualsAStallCarries } from '../../src/engine/world/what-a-copy-of-a-manual-costs-at-a-stall';

async function inASquareWithAStall(seed: string): Promise<{
    db: Database.Database;
    game: Harness['game'];
    people: string[];
}> {
    resetCultivationWorlds();
    const { db, game } = await makeGameInWorld({ seed, worldSeed: `world-${seed}` });
    const { cultivator } = await game.newRun('Wei Anshu');

    const world = (await game.loadWorld())!;
    const square = world.locations
        .map(place => ({ place, people: npcsAt(world, place.id) }))
        .filter(row => row.people.length >= 8)
        .sort((a, b) => b.people.length - a.people.length)[0];
    expect(square, 'the pinned world has no square with people in it').toBeDefined();

    db.prepare('UPDATE cultivators SET location = ?, spirit_stones = 500 WHERE id = ?')
        .run(square.place.name, cultivator.id);
    return { db, game, people: square.people.map(person => person.name) };
}

/** A title the stall actually carries, read out of the catalog rather than typed. */
const onTheStall = (): string => {
    const stock = manualsAStallCarries();
    expect(stock.length, 'no stall stock in this build').toBeGreaterThan(0);
    return stock[0].name;
};

interface Turn {
    narration: string;
    state: { log: Array<{ role: string; text: string }> };
}

/** The engine's own rows for a turn, which is where the account of an exchange lands. */
const accountOf = (turn: Turn): string =>
    turn.state.log.filter(row => row.role === 'engine').map(row => row.text).join('\n');

/** How the account words a counter nobody is standing behind. */
const NOBODY = 'a board rate with nobody behind it';

describe('the stallholder is whoever the scene put there', () => {
    it('carries the person one turn named into the turn after it', async () => {
        const { game, people } = await inASquareWithAStall('stallholder-carries-over');
        const book = onTheStall();
        const who = people[0]!;

        // The price, which is what a scene opens with and what puts the book
        // on the record for the turns after it.
        await game.act(`how much for the ${book}`);

        // The turn that establishes somebody: the player names them.
        const opened = accountOf(await game.act(`I offer ${who} twenty stones`));
        expect(opened, 'the opening turn did not put anybody behind the counter')
            .toContain(who);

        // And the turn that names nobody. It used to search the square again.
        // Only the rows this turn added, because the log grows and never
        // rewrites: the name is on the screen before either way.
        const after = accountOf(await game.act('that is too expensive')).slice(opened.length);
        expect(after, 'the person the turn before named was dropped').toContain(who);
        expect(after, 'the exchange was accounted against nobody').not.toContain(NOBODY);
    }, 180_000);

    it('gives way to a person the sentence itself names', async () => {
        // The regression the fallback could cause. Turning to somebody else is
        // a sentence a player types, and a scene that outlasted it would have
        // the engine answering about the person they just stopped talking to.
        const { game, people } = await inASquareWithAStall('stallholder-turns-away');
        const book = onTheStall();
        const first = people[0]!;
        const second = people[1]!;
        expect(second, 'the square has only one person to turn between').not.toBe(first);

        await game.act(`how much for the ${book}`);
        const established = accountOf(await game.act(`I offer ${first} twenty stones`));

        // Only the rows this turn added: the log grows and never rewrites, so
        // everything before is the scene that is being turned away from.
        const turned = accountOf(await game.act(`I offer ${second} twenty stones`))
            .slice(established.length);
        expect(turned, 'the sentence named somebody and the scene answered for them')
            .toContain(second);
        expect(turned, 'the person the scene held on to outlasted the sentence')
            .not.toContain(first);
    }, 180_000);
});
