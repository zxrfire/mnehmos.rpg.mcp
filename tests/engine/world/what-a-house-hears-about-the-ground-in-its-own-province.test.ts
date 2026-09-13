/**
 * A house hears about the ground in its own province, and the hearing is a
 * reading rather than a row.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE DEFECT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Nothing anywhere writes a `knowledge_records` row for a world NPC. Every
 * writer of that table names the player or somebody an operator spawned, so
 * every question of the form "does this house know X" was structurally
 * `unaware` in every world, and `whatThisHouseKnowsOf` had exactly one source:
 * `whatStandingOnItGives`, which credits an actor or a witness on a fact SITED
 * at a place with having been there.
 *
 * That source is real and it is narrow. It reaches the person who went, and a
 * house ACTS through its deciders, who stayed at home. Measured on three seeded
 * worlds advanced two hundred years from `seedWorld({ population: 250 })`:
 *
 *     houses with open ground in their own province     29    32    42
 *     ...whose deciders could point at any of it        24    24    29
 *
 * The twenty-odd in the gap were houses in a province where a door had opened,
 * that the whole province was talking about, and that they could not name.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT WAS ADDED, AND WHY NONE OF IT IS A ROW
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A row per person per rumour per world is the combinatorial store the working
 * agreement forbids: at two hundred years that is roughly 2,000 sited facts
 * against 440 living people, growing with the square of a world's age. Every
 * reading below writes NOTHING and keeps NOTHING.
 *
 *   whatTheAirCarriesOfTheGround        news of a place, reaching whoever is
 *                                       standing where it got to. Asks
 *                                       `isInTheAirFor` - circulation's own
 *                                       answer - rather than a second and
 *                                       cheaper rule about how far news gets.
 *   whatAHousesOwnErrandsBringBack      a party that came back reported.
 *
 * Both are capped at `stageCeilingFor('told')`, which is `placed`, which is
 * `REACHABLE_FROM`: you can say where it is and set out for it, and no more.
 *
 * Same three worlds, after:  28 of 29, 26 of 32, 34 of 42.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * AND THE LEDGER NOW SAYS WHERE AN ERRAND WENT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `applySendings` built its posting with `locationId: faction.seatLocationId`,
 * so the world's record of every errand ever run said the errand happened at
 * home and `sighted.locationId` - "what a party saw and could not take" - named
 * the courtyard the party walked out of. Measured on the same worlds, 175 of
 * 176, 184 of 185 and 185 of 186 sending rows now sit somewhere other than
 * their own house's seat.
 *
 * That mattered twice over, because 18 of 49 house seats in one of those worlds
 * ARE ruins: a house seated on open ground was reading its own floor as a find
 * it had discovered.
 *
 * RED-CHECKED. Each assertion below was confirmed to fail against the
 * behaviour it replaces: dropping the air reading, dropping the errand reading,
 * dropping the returned-actor test on the errand reading, and putting
 * `theFind` back to a draw from `elsewhere`.
 */

import { describe, it, expect } from 'vitest';

import {
    aFindThisHouseCouldSendFor,
    whatAHousesOwnErrandsBringBack,
    whatAnybodyCouldHaveOfTheGround,
    whatStandingOnItGives,
    whatTheAirCarriesOfTheGround,
    whereASendingGoes,
    whereTheOpenGroundIs,
    WENT_AND_CAME_BACK,
    WENT_AND_DID_NOT
} from '../../../src/engine/world/who-goes-out-for-a-house-and-what-comes-back.js';
import {
    isInTheAirFor,
    regionOf,
    whereThisPersonIsStanding
} from '../../../src/engine/world/what-people-are-saying.js';
import { appendFact, makeFact } from '../../../src/engine/world/history.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { createWorld, type WorldState } from '../../../src/engine/world/world-state.js';
import { REACHABLE_FROM, stageCeilingFor } from '../../../src/engine/social/discovery.js';
import type { OnTheRoll } from '../../../src/engine/social-leverage/what-a-body-wants-is-what-its-deciders-want.js';

const DAY = 400_000;
const RANK_COUNT = 5;
const HOUSE = 'sect-ours';

/** The head of the house, and somebody who sweeps the yard. Neither has been anywhere. */
const ROLL: OnTheRoll[] = [
    { id: 'npc-head', rankIndex: RANK_COUNT - 1 },
    { id: 'npc-porter', rankIndex: 0 }
];

/**
 * A province with a seat and an open ruin in it, a second province with its own
 * ruin, and two people who have never left the compound.
 */
function build(): WorldState {
    const state = createWorld({ seed: 'ground-in-the-air', skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;
    state.locations.push(
        makeLocation({ id: 'here', name: 'Low Fall', kind: 'region' }),
        makeLocation({ id: 'far', name: 'High Fall', kind: 'region' }),
        makeLocation({ id: 'seat', name: 'The Compound', kind: 'sect_seat', parentId: 'here' }),
        makeLocation({ id: 'near-ruin', name: 'The Drowned Step', kind: 'ruin', parentId: 'here' }),
        makeLocation({ id: 'far-ruin', name: 'The Far Step', kind: 'ruin', parentId: 'far' })
    );
    for (const who of ROLL) {
        state.npcs.push(createNpc(state.seed, {
            id: who.id,
            name: who.id === 'npc-head' ? 'The Head' : 'The Porter',
            bornOnDay: DAY - 60 * 365,
            onDay: DAY,
            locationId: 'seat',
            factionId: HOUSE,
            factionRankIndex: who.rankIndex,
            cultivation: { realmOrdinal: 10 }
        }));
    }
    return state;
}

/** Somebody opened a door, loudly enough that a province repeats it. */
function somethingHappenedAt(
    state: WorldState,
    locationId: string,
    over: { day?: number; visibility?: 'public' | 'regional' | 'secret'; magnitude?: number } = {}
): void {
    appendFact(state.history, makeFact({
        day: over.day ?? DAY - 365,
        kind: 'ruin_opened',
        scale: 'regional',
        summary: 'A door that had not been opened was opened.',
        locationId,
        visibility: over.visibility ?? 'regional',
        magnitude: over.magnitude ?? 0.8
    }));
}

/** The whole composed reading, exactly as the world's own sendings compose it. */
function knowsTheGroundIn(state: WorldState) {
    return whatAnybodyCouldHaveOfTheGround(
        whatStandingOnItGives(state.history.facts),
        whatTheAirCarriesOfTheGround({
            facts: state.history.facts,
            inTheAirFor: (fact, holderId) => {
                const npc = state.npcs.find(n => n.id === holderId);
                if (!npc) return false;
                return isInTheAirFor(
                    state,
                    fact,
                    whereThisPersonIsStanding(state, npc, id => regionOf(state, id)),
                    Math.floor(state.currentDay)
                );
            }
        })
    );
}

function findFor(state: WorldState, over: { errands?: () => 'unaware' | 'placed' } = {}) {
    return aFindThisHouseCouldSendFor({
        ground: whereTheOpenGroundIs(state.locations),
        houseId: HOUSE,
        seatLocationId: 'seat',
        roll: ROLL,
        rankCount: RANK_COUNT,
        stageFor: knowsTheGroundIn(state),
        errands: over.errands ?? (() => 'unaware')
    });
}

describe('what a house hears about the ground in its own province', () => {
    it('cannot point at open ground nobody has mentioned', () => {
        // The control the rest of the file is read against: the ruin is there,
        // it is open, it is in the province, and nothing has ever happened at
        // it. Not knowing is the correct answer, and it is the answer the whole
        // world used to give whatever had happened.
        expect(findFor(build())).toBeNull();
    });

    it('can point at ground its own province is talking about', () => {
        const state = build();
        somethingHappenedAt(state, 'near-ruin');
        expect(findFor(state)?.locationId).toBe('near-ruin');
    });

    it('hears it as being told and not as having been there', () => {
        const state = build();
        somethingHappenedAt(state, 'near-ruin');
        // The rung is the ladder's own price for hearsay, read off the source
        // rather than written down here. It is exactly enough to set out on and
        // no more, which is the whole distinction the six stages exist for.
        expect(knowsTheGroundIn(state)('npc-head', 'near-ruin')).toBe(stageCeilingFor('told'));
        expect(stageCeilingFor('told')).toBe(REACHABLE_FROM);
    });

    it('and standing on it outranks hearing about it', () => {
        const state = build();
        somethingHappenedAt(state, 'near-ruin');
        appendFact(state.history, makeFact({
            day: DAY - 200,
            kind: 'treasure_found',
            summary: 'The Head went in and came out with something.',
            locationId: 'near-ruin',
            actors: [{ id: 'npc-head', name: 'The Head', role: WENT_AND_CAME_BACK }]
        }));
        expect(knowsTheGroundIn(state)('npc-head', 'near-ruin')).toBe(stageCeilingFor('witnessed'));
        // And the porter, who stayed at home, still only heard about it.
        expect(knowsTheGroundIn(state)('npc-porter', 'near-ruin')).toBe(stageCeilingFor('told'));
    });

    it('does not carry a small thing across a province', () => {
        // Importance decides whether a story crosses a border at all, and a
        // quiet death at a barrow never does however long anybody waits. That
        // ruling is `airtimeOf`'s and this asks it rather than restating it.
        const state = build();
        appendFact(state.history, makeFact({
            day: DAY - 10 * 365,
            kind: 'death',
            scale: 'personal',
            summary: 'Somebody died out there.',
            locationId: 'far-ruin',
            magnitude: 0.3
        }));
        expect(knowsTheGroundIn(state)('npc-head', 'far-ruin')).toBe('unaware');
    });

    it('and ground in another province is not this house’s business either way', () => {
        // A door opening loudly enough to cross a border is heard, and is still
        // not a find: where it is and who knows it are two terms, and this is
        // the first one. Asserted with news that does cross, so the province
        // scoping is what the assertion rests on rather than the silence.
        const state = build();
        somethingHappenedAt(state, 'far-ruin');
        expect(knowsTheGroundIn(state)('npc-head', 'far-ruin')).toBe(stageCeilingFor('told'));
        expect(findFor(state)).toBeNull();
    });

    it('does not hear what has not had time to get there', () => {
        const state = build();
        // Yesterday, in the next valley. Distance governs WHEN as well as
        // whether, and `DAYS_NEWS_TAKES` is the one place that is decided.
        somethingHappenedAt(state, 'near-ruin', { day: DAY - 1 });
        expect(findFor(state)).toBeNull();
    });

    it('does not hear what was done in secret', () => {
        const state = build();
        somethingHappenedAt(state, 'near-ruin', { visibility: 'secret' });
        expect(findFor(state)).toBeNull();
    });
});

describe('a party that came back reported, and one that did not could not', () => {
    const sendingAt = (locationId: string, role: string) => ([{
        locationId,
        factionIds: [HOUSE],
        actors: [{ id: 'npc-somebody', name: 'Somebody', role }]
    }]);

    it('puts the house at the rung being told carries', () => {
        const reported = whatAHousesOwnErrandsBringBack(
            sendingAt('near-ruin', WENT_AND_CAME_BACK)
        );
        expect(reported(HOUSE, 'near-ruin')).toBe(stageCeilingFor('told'));
    });

    it('leaves a house that lost everybody it sent with nothing', () => {
        const reported = whatAHousesOwnErrandsBringBack(
            sendingAt('near-ruin', WENT_AND_DID_NOT)
        );
        expect(reported(HOUSE, 'near-ruin')).toBe('unaware');
    });

    it('is a neighbour’s business and not this house’s', () => {
        const reported = whatAHousesOwnErrandsBringBack(
            sendingAt('near-ruin', WENT_AND_CAME_BACK)
        );
        expect(reported('sect-somebody-else', 'near-ruin')).toBe('unaware');
        expect(reported(HOUSE, 'far-ruin')).toBe('unaware');
    });

    it('reaches the whole roll, which is what a report in a hall does', () => {
        // Nobody on this roll has been anywhere and the province has said
        // nothing. The house can still act, because its own party came home and
        // said where it had been - which is the only route that reaches somebody
        // who did not go.
        const state = build();
        expect(findFor(state, { errands: () => 'placed' })?.locationId).toBe('near-ruin');
    });
});

describe('an errand goes where the find is', () => {
    it('and not to a place drawn at random', () => {
        // The table has said `a_find  out where the find is` since it was
        // written, and the code drew from `elsewhere` like every other ground
        // errand - so the one errand a house opens BECAUSE it knows of a door
        // never went near the door.
        expect(whereASendingGoes({
            needs: 'a_find',
            fromLocationId: 'seat',
            theFind: 'near-ruin',
            seatsInPlay: ['theirs'],
            elsewhere: ['a-village'],
            pick: () => 0
        })).toBe('near-ruin');
    });

    it('and every other errand is untouched by it', () => {
        for (const needs of ['nothing', 'ground', 'a_rival'] as const) {
            expect(whereASendingGoes({
                needs,
                fromLocationId: 'seat',
                theFind: 'near-ruin',
                seatsInPlay: ['theirs'],
                elsewhere: ['a-village'],
                pick: () => 0
            })).toBe('a-village');
        }
    });
});
