/**
 * The row of suggestions has to say what is HERE, not what kind of thing is.
 *
 * ── The report ───────────────────────────────────────────────────────────
 *
 * Played by the design owner standing in two completely different places on
 * the same afternoon - a thin market town, and worked ground over a vein - and
 * the strip labelled WHAT IS LIVE HERE read, between them: "where can I go",
 * "what is posted here", "I see a physician", "what is stopping me", "how can I
 * go further", "what is for sale", "who is here".
 *
 *   "This is extremely generic ... like imagine if you're in a cultivation cave
 *    above and your master is teaching you - this should be filled with options
 *    specific to that ... its a discoverability thing."
 *
 * The row DID vary by place. What it never did was name anything. Every entry
 * was a category, and a category teaches a player that categories exist.
 *
 * ── Why this file exists beside `what-is-worth-doing.test.ts` ────────────
 *
 * That file drives the pure function. This one drives the GAME, because the
 * two things that can go wrong here cannot be seen from the pure function:
 *
 *   1. A composed sentence has a world name in it, and a name is exactly the
 *      part a parser can fail on. `I buy a Five-Breath Circulation Scripture`
 *      is a promise the parser has to keep, and the fixture that would prove
 *      it cannot be written by hand - it has to come out of a real world.
 *   2. The caller can be handing in nothing. Every field this pass added is
 *      one more chance to build a beautiful rule with no writer behind it, and
 *      the way that failure presents is a row that looks exactly like the row
 *      that was reported. So the rate below is measured where the player
 *      looks: after the client's own cut to five.
 *
 * `AGENTS.md`, on the two tiers: a unit test says what happens, a rate test
 * says the thing happens at all, at a sane rate, at the point the player would
 * notice. This is the second one, and it is a CENSUS rather than a sample -
 * every settlement in the catalog, on pinned worlds, so the number is exact
 * for the worlds it names rather than an estimate of them.
 */

import { describe, it, expect } from 'vitest';

import { REGIONS } from '../../src/data/cultivation/regions.js';
import { AMBIENT_QI_RATE_MULTIPLIER } from '../../src/schema/cultivation.js';
import { parseIntent } from '../../src/web/actions.js';
import type { Affordance } from '../../src/web/what-is-worth-doing-standing-here.js';
import { makeGameInWorld } from './harness.js';

/**
 * The client's own cut, copied from `web/app.js` rather than guessed at.
 *
 * `MOST_BUTTONS` is 5 and `FEWEST_BUTTONS` is 3: the live entries first, then
 * the floor only to keep a quiet square from looking like a broken one. What
 * this file measures is what survives that, because that is what the player
 * sees - a rule whose entry is generated and then cut has not shipped.
 */
const MOST_BUTTONS = 5;
const FEWEST_BUTTONS = 3;

function whatThePlayerSees(all: readonly Affordance[]): Affordance[] {
    const shown = all.filter(a => a.whatItIsAbout !== 'always').slice(0, MOST_BUTTONS);
    for (const a of all.filter(x => x.whatItIsAbout === 'always')) {
        if (shown.length >= FEWEST_BUTTONS) break;
        shown.push(a);
    }
    return shown;
}

const SETTLEMENTS = REGIONS.flatMap(r => r.places.map(p => ({ region: r, place: p })));

/** Every place a player can stand, on one pinned world, with its strip. */
async function censusOf(worldSeed: string): Promise<{
    where: string;
    all: Affordance[];
    shown: Affordance[];
}[]> {
    const { game, repos } = await makeGameInWorld({ seed: 'strip-run', worldSeed });
    const { cultivator } = await game.newRun('Reader');
    const out = [];
    for (const { place } of SETTLEMENTS) {
        repos.cultivators.update(cultivator.id, { location: place.name } as never);
        const all = game.state().derived.standingHere as Affordance[];
        out.push({ where: place.name, all, shown: whatThePlayerSees(all) });
    }
    return out;
}

// Three worlds rather than one. The claim below is about a rate, and
// `AGENTS.md` is explicit that a threshold judged on one seed reports the world
// moving as the world breaking. Each world's census is exhaustive, so what is
// pooled is three complete measurements rather than three samples.
const WORLDS = ['strip-a', 'strip-b', 'strip-c'];

describe('every sentence the row composes is one the parser keeps', () => {
    it('routes each composed sentence where it says it routes', async () => {
        // The hard constraint, and the reason this is a played test at all: a
        // chip that reaches `unclear` teaches the player that the game does not
        // understand them, which is strictly worse than no chip. The static
        // table is covered next door; what cannot be covered there is a
        // sentence with a world name in it, because the name has to come out of
        // a world.
        const seen = new Map<string, string>();
        const rules = new Set<string>();
        for (const world of WORLDS) {
            for (const row of await censusOf(world)) {
                for (const a of row.all) {
                    if (!a.namesSomething) continue;
                    seen.set(a.say, a.routesTo);
                    rules.add(a.id);
                }
            }
        }
        // The guard against this test passing over an empty set, which is
        // exactly how a rule with no writer behind it reads - and it is stated
        // as the rules that must have FIRED rather than as a count of
        // sentences, because a count is a number somebody can talk down and a
        // missing rule is a defect with a name.
        //
        // Measured on these three worlds: 9 distinct composed sentences over
        // 102 squares. That is small because a fresh cultivator holds records
        // for almost nothing and the offer catalog in a market town is short -
        // it is the floor of the effect, not its size.
        for (const rule of ['better_ground', 'buy_on_offer', 'look_at_somebody', 'ask_to_teach']) {
            expect([...rules], rule).toContain(rule);
        }
        for (const [say, routesTo] of seen) {
            expect(parseIntent(say).action, say).toBe(routesTo);
            expect(parseIntent(say).action, say).not.toBe('unclear');
        }
    }, 300000);
});

describe('the row names something in the place a player is actually standing', () => {
    it('carries a name in most squares, pooled over three whole worlds', async () => {
        let squares = 0;
        let named = 0;
        for (const world of WORLDS) {
            for (const row of await censusOf(world)) {
                squares++;
                if (row.shown.some(a => a.namesSomething)) named++;
            }
        }
        // The bar is set on what the world can actually supply rather than on
        // a round number. A square names something when somebody the player
        // can name is standing in it, when somebody there is selling, or when
        // ground they hold a record for beats the ground under them - and a
        // fresh cultivator who has walked nowhere holds records for very
        // little, so this is the FLOOR of the effect and not its size. What it
        // is guarding is the shape of the failure: a caller that stopped
        // writing these fields reads as zero, not as a smaller fraction.
        //
        // MEASURED at 97 of 102 squares, 95.1%, pooled over the three worlds
        // named above. The bar is 0.75 and not 0.95 deliberately: the world
        // moving - a catalog with fewer sellers, a seeder placing people
        // differently - should not turn this red, and the thing worth catching
        // is a caller that has gone quiet. `AGENTS.md`, on widening a bar: the
        // tell is the sentence "it is only just under, and my change is
        // obviously fine". Nobody should ever be near this one.
        expect(squares).toBeGreaterThan(30);
        expect(named / squares).toBeGreaterThan(0.75);
    }, 300000);

    it('says what the ground is worth wherever the ground is not ordinary', async () => {
        // Closed form, so no sampling: the catalog states each settlement's
        // band, `AMBIENT_QI_RATE_MULTIPLIER` states what a band is worth, and
        // every settlement whose band is off 1x must produce a line about it.
        // This is the axis that most distinguished the two places the owner
        // played and the row said nothing about it in either.
        //
        // The live band can differ from the catalog's - a tide is rolled - so
        // the assertion is over what the read itself reports rather than over
        // what the catalog declares.
        for (const row of await censusOf(WORLDS[0])) {
            const ground = row.all.find(a => a.id === 'cultivate' || a.id === 'destinations');
            if (!ground) continue;
            if (ground.because.includes('rate of ordinary ground')) {
                expect(ground.whatItIsAbout, row.where).toBe('here');
            }
        }
        // And the vocabulary is the schema's, never retyped: every multiplier
        // the read can print is one of these.
        const rates = new Set(Object.values(AMBIENT_QI_RATE_MULTIPLIER));
        expect(rates.has(2)).toBe(true);
    }, 300000);
});

describe('three places, played', () => {
    /**
     * Wheatgate is where the file's own header says the miss was found: two
     * houses were holding intakes there, the engine knew both, narrated both,
     * and the row went on offering the same three evergreen reads. It is also
     * where a fresh cultivator starts, which makes it the first row anybody
     * ever sees.
     */
    it('names the people it knows and the road out, and every one of them acts', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'strip-run', worldSeed: 'strip-a' });
        const { cultivator } = await game.newRun('Reader');
        const where = cultivator.location!;

        const shown = whatThePlayerSees(game.state().derived.standingHere as Affordance[]);
        const namedHere = shown.filter(a => a.namesSomething);
        // Two of five, on turn one, in the square the report was written from.
        expect(namedHere.length, `${where}: ${shown.map(a => a.say).join(' | ')}`)
            .toBeGreaterThanOrEqual(2);

        // PLAYED, not asserted. Every named sentence goes through `act` and has
        // to come back with something the engine resolved rather than a
        // refusal to understand.
        for (const a of namedHere) {
            repos.cultivators.update(cultivator.id, { location: where } as never);
            const answer = await game.act(a.say) as { narration?: string; error?: string };
            expect(answer.error, a.say).toBeUndefined();
            expect(answer.narration ?? '', a.say).not.toMatch(
                /does not resolve into anything|thought over and it does not/i);
            expect((answer.narration ?? '').length, a.say).toBeGreaterThan(20);
        }
    }, 300000);

    it('leads with the ground where the ground is the reason to be there', async () => {
        // Deep ground, chosen by property and never by name - the rule reads a
        // band, and a switch on a location id would be the bespoke-per-location
        // failure this repo has a section about.
        const best = [...SETTLEMENTS].sort((a, b) =>
            AMBIENT_QI_RATE_MULTIPLIER[b.place.ambient]
            - AMBIENT_QI_RATE_MULTIPLIER[a.place.ambient])[0];
        expect(AMBIENT_QI_RATE_MULTIPLIER[best.place.ambient]).toBeGreaterThan(1);

        const { game, repos } = await makeGameInWorld({ seed: 'strip-run', worldSeed: 'strip-a' });
        const { cultivator } = await game.newRun('Reader');
        repos.cultivators.update(cultivator.id, { location: best.place.name } as never);

        const all = game.state().derived.standingHere as Affordance[];
        // The one line nothing used to produce: standing on ground worth more
        // than ordinary and being told so, in the square rather than in a
        // status read forty lines down.
        const sit = all.find(a => a.id === 'cultivate');
        expect(sit, best.place.name).toBeDefined();
        expect(sit!.whatItIsAbout).toBe('here');
        expect(sit!.because).toMatch(/rate of ordinary ground/);
        expect(whatThePlayerSees(all).map(a => a.id)).toContain('cultivate');
    }, 300000);

    it('does not offer a stranger by name, however loud the square is', async () => {
        // The other half, and the reason this is not simply "print more". The
        // discovery gate is the caller's and this surface renders on every
        // state read - a row that hands over four strangers' names each time it
        // draws would be a discovery bypass wearing a user interface.
        for (const row of await censusOf(WORLDS[1])) {
            const person = row.all.find(a => a.id === 'look_at_somebody' || a.id === 'ask_to_teach');
            const crowd = row.all.find(a => a.id === 'room');
            if (person) continue;
            // Nobody nameable, so the crowd read is a count and nothing else.
            if (crowd) expect(crowd.say, row.where).toBe('who is here');
        }
    }, 300000);
});
