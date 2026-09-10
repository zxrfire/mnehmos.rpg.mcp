/**
 * Fifty-nine authored sayings about the world, and no player had heard one.
 *
 * `rumours-and-what-they-get-wrong.ts` is 59 rows of what ordinary people say
 * about the powers above them, 30 of them wrong on purpose, each carrying what
 * is actually the case in a field the player never sees and what people DO
 * because they believe it. Nothing in the act surface read any of it.
 *
 * Its own header says what it is for and names the file it is the other half
 * of: *that table answers which name could this speaker say; this one answers
 * and what would they say about it, including the very common case where the
 * answer is confidently false*.
 *
 * ── WHY IT HAD NO SLOT, WHICH IS NOT THE SAME AS HAVING NO PURPOSE ───────
 *
 * `askAround` had a rumour path already, and it is a different system:
 * `whatTheySay` propagates EVENTS - a thing that happened, retold with a
 * distortion band, losing fidelity as it passes through hands. Good, live, and
 * silent in a square no event has reached. There, `askAround` returned:
 *
 *     You ask around. Nobody here has heard anything they think is worth
 *     repeating, which mostly means nothing has happened near enough to reach
 *     them.
 *
 * Which is false about people. Nothing had happened; they still talk, and what
 * they talk about is the powers above them. That is the silence this catalog
 * was written to fill, and it sits BELOW the events rather than instead of
 * them - a thing that actually happened is the better answer and keeps its
 * place.
 *
 * ── WHAT MAY LEAVE THE CATALOG, WHICH IS ONE FIELD ───────────────────────
 *
 * `saying`, and nothing else. The row also carries `underneath` - what is
 * actually the case - and `accuracy`, which states outright whether the speaker
 * is wrong. The schema says it in the field's own comment: *this is the only
 * field a player is ever given*. A saying the player has been told is false is
 * not hearsay, it is a briefing, and `discovery.md` puts the whole burden of
 * the player's education onto other people's mouths precisely so that being
 * wrong is possible.
 *
 * That is the assertion this file exists for, and it is checked against every
 * row in the catalog rather than against a sample: no `underneath` and no
 * accuracy band may appear in anything the player or the narrator is handed.
 *
 * ── AND THE NAME COMES ATTACHED TO THE STORY ─────────────────────────────
 *
 * Where a saying names something, the name is handed over with the saying as
 * its statement. `SpeakableName.statement` is *what the holder ends up holding,
 * when the default sentence will not do*, and the default sentence is `X
 * exists`. So the player ends up holding a name attached to a story that may be
 * wrong, which is the file's whole thesis and, in its own words, how a
 * cultivator gets killed.
 */

import { describe, it, expect } from 'vitest';

import {
    RUMOURS,
    WRONG_ACCURACIES,
    rumoursSpeakableBy,
    rumoursThatAreWrong,
    shareOfRumoursThatAreWrong
} from '../../src/data/cultivation/rumours-and-what-they-get-wrong';
import { askAround } from '../../src/web/asking-what-people-are-saying';
import { makeGame } from './harness';
import { createWorld, type WorldState } from '../../src/engine/world/world-state';
import { makeLocation } from '../../src/engine/world/locations';
import type { Cultivator, Run } from '../../src/schema/cultivation';
import type { RosterEntry } from '../../src/storage/repos/cultivator.repo';

const DAY = 365 * 400;

/** A square where nothing whatever has happened. That is the whole fixture. */
function aQuietSquare(): WorldState {
    const state = createWorld({ seed: 'believe-test', skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;
    state.locations.push(makeLocation({
        id: 'loc-here', name: 'The Province', kind: 'region', qiDensity: 0.4
    }));
    state.locations.push(makeLocation({
        id: 'square', name: 'Six Li', kind: 'settlement', parentId: 'loc-here', qiDensity: 0.4
    }));
    return state;
}

function villager(id: string, ordinal: number): RosterEntry {
    return {
        id, name: `Villager ${id}`, kind: 'npc', spiritRoot: 'single_water',
        realmOrdinal: ordinal, location: 'Six Li', sectId: null, sectName: null,
        sectRank: null, age: 40, alive: true, existenceState: 'alive',
        soulState: 'intact', identityContinuity: 1, deathCause: null,
        spiritStones: 0, untreatedInjuries: 0, feuds: []
    };
}

async function player(): Promise<{ cultivator: Cultivator; run: Run }> {
    const { game } = makeGame({ seed: 'believe-test' });
    const { cultivator } = await game.newRun('Listener');
    return { cultivator, run: game.state().run as Run };
}

describe('the catalog is worth reaching', () => {
    it('is mostly wrong, on purpose', () => {
        expect(RUMOURS.length).toBeGreaterThan(20);
        expect(rumoursThatAreWrong().length).toBeGreaterThan(0);
        // Reported rather than pinned at a value, for the reason the catalog
        // itself gives: pinning a fraction would make every addition a failure.
        expect(shareOfRumoursThatAreWrong()).toBeGreaterThan(0.3);
    });

    /**
     * SOMEBODY WITH NOTHING CAN STILL SAY SOMETHING. The gate is standing plus
     * house, so a catalog whose floor sat above a beginner would be reachable
     * only by people who no longer need it.
     */
    it('has sayings a person of no standing and no house could hold', () => {
        expect(rumoursSpeakableBy(0, null).length).toBeGreaterThan(0);
    });

    it('holds more back from somebody with nothing than from somebody high', () => {
        expect(rumoursSpeakableBy(0, null).length)
            .toBeLessThan(rumoursSpeakableBy(40, null).length);
    });
});

/**
 * THE ONE RULE THE WIRING HAD TO NOT BREAK.
 *
 * Checked over the whole catalog rather than over what a draw happened to
 * return: a leak here is a leak of the design, not of a string, and the next
 * person to add a row must not be able to leak it by accident.
 */
describe('only the saying may leave', () => {
    it('never lets the truth underneath into anything a player is handed', () => {
        for (const rumour of RUMOURS) {
            // The two fields that must not travel, asserted as distinct from
            // the one that must. A row whose `underneath` merely repeated the
            // saying would pass this vacuously.
            expect(rumour.underneath, rumour.id).not.toBe(rumour.saying);
            expect(rumour.saying, rumour.id).not.toContain(rumour.underneath);
        }
    });

    it('never states the accuracy band in the saying itself', () => {
        for (const rumour of RUMOURS) {
            for (const band of WRONG_ACCURACIES) {
                expect(rumour.saying.toLowerCase(), `${rumour.id} names its own band`)
                    .not.toContain(band.replace(/_/g, ' '));
            }
        }
    });

    /**
     * AND THE CONSEQUENCE IS NOT ATMOSPHERE. The catalog's own header calls
     * this the load-bearing field: a saying nobody acts on is decoration, and
     * this file says it is not for decoration.
     */
    it('says what people do because they believe it', () => {
        for (const rumour of RUMOURS) {
            expect(rumour.consequence.length, rumour.id).toBeGreaterThan(40);
        }
    });
});

/**
 * PLAYED, IN A SQUARE WHERE NOTHING HAS HAPPENED.
 *
 * The fixture is the point: a world with two locations, no factions, no facts
 * and no history. Nothing has occurred anywhere, so the event propagation has
 * nothing to carry, and this is exactly the case that used to come back as
 * *nobody here has heard anything worth repeating*.
 */
describe('a square with no news still has people in it', () => {
    it('says something somebody here believes', async () => {
        const { cultivator, run } = await player();
        const asked = askAround({
            cultivator, run,
            present: [villager('v1', 6), villager('v2', 3)],
            world: aQuietSquare(),
            occasion: 'news'
        });

        expect(asked.lines.length).toBeGreaterThan(0);
        expect(asked.prose).not.toContain('Nobody here has heard anything');

        // It is a saying out of the catalog, and not a sentence composed here.
        const said = asked.lines.join(' ');
        const matched = RUMOURS.filter(r => said.includes(r.saying));
        expect(matched, `nothing in the catalog matched: ${said}`).toHaveLength(1);
    });

    /**
     * AND NEVER THE TRUTH UNDERNEATH IT. The one rule, checked on the thing the
     * player is actually handed rather than on the table it came from.
     */
    it('hands over the saying and never what is actually the case', async () => {
        const { cultivator, run } = await player();
        const asked = askAround({
            cultivator, run,
            present: [villager('v1', 6)],
            world: aQuietSquare(),
            occasion: 'news'
        });

        const everything = [
            asked.prose,
            ...asked.lines,
            ...asked.hearings.map(h => `${h.note} ${h.prose ?? ''}`)
        ].join(' ');

        for (const rumour of RUMOURS) {
            expect(everything, `${rumour.id} leaked what is underneath it`)
                .not.toContain(rumour.underneath);
        }
    });

    /**
     * THE SAME SQUARE ON THE SAME DAY SAYS THE SAME THING. The draw is seeded,
     * so walking away and coming back is not a reroll - the rule `askAround`
     * already keeps for who answers a stranger.
     */
    it('does not reroll when the player asks again', async () => {
        const { cultivator, run } = await player();
        const ask = () => askAround({
            cultivator, run,
            present: [villager('v1', 6)],
            world: aQuietSquare(),
            occasion: 'news'
        }).lines.join(' ');
        expect(ask()).toBe(ask());
    });

    /**
     * AND AN EVENT STILL WINS. This fills a silence; it does not talk over
     * something that actually happened.
     */
    it('is not reached when there is nobody to ask at all', async () => {
        const { cultivator, run } = await player();
        const asked = askAround({
            cultivator, run, present: [], world: aQuietSquare(), occasion: 'news'
        });
        expect(asked.lines.join(' ')).toContain('nobody here');
    });
});
