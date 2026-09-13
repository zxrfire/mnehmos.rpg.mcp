/**
 * A ruin is open ground. What a house has over its neighbours is knowing where
 * one is.
 *
 * THE DEFECT. `a_find` was read as `unopenedGroundHeldBy` - does THIS house
 * control an unsealed ruin - which is a correct reading of control and the
 * wrong question. Measured on twelve pinned worlds at `occasion-0..11`: 144
 * ruins at day 0 and 379 at two hundred years, 12 and 282 of them unsealed, and
 * NOT ONE at either horizon carrying a `controllingFactionId`, because nothing
 * anywhere writes that column for a ruin. `sending-to-open-an-inheritance` was
 * open to 0 of 456 houses at day 0 and 0 of 429 at two hundred years, and the
 * world sim had never once sent anybody on it.
 *
 * THE RULING. Ground like this is public by agreement - that is the genre's
 * default and this world's. Monopolising a ruin is a political act that costs a
 * house every neighbour it shut out, not the ordinary state of one. What a
 * house legitimately has is better INFORMATION, and the reason's own text has
 * said so since it was written: somebody has found a door, and the house means
 * to be the body that opens it rather than the body that hears about it.
 *
 * WHAT THE READING BECAME, and both halves are asserted below because either
 * one alone is a different rule:
 *
 *   where it is    open ruins in the province the house is SEATED in. Ground
 *                  four provinces off is not this house's business, and the
 *                  scoping is `theProvinceAround`, composed the way
 *                  `forbiddenGroundInTheProvinceOf` composes it rather than as
 *                  a distance rule of its own.
 *   who knows it   a DECIDER who can point at it - `REACHABLE_FROM`, which is
 *                  `placed`. Named rather than numbered, so the rung moves when
 *                  the ladder does. Deciders and not anybody, because putting a
 *                  party on the road is the house ACTING, which is the line
 *                  `whatThisHouseKnowsOf` already draws.
 *
 * WHAT IT MEASURED, same twelve worlds, per reason:
 *
 *              day 0        200 years
 *   before     0 of 456     0 of 429
 *   after      0 of 456     151 of 422 open, 288 offered, 114 escorted
 *
 * ANYBODY WOULD HAVE GIVEN 198 of 422 and was not taken: a house whose gate
 * porter knows where a ruin is has heard of it, and has not decided anything.
 *
 * DAY 0 STAYS ZERO, and that is a second defect this reading exposed rather
 * than a shortfall in it. Every seeded ruin has `parentId: null` - the ids run
 * `loc-ruin-<region>-<n>`, so the NAME says which province it belongs to and the
 * record does not - so `theProvinceAround` is null for all 144 of them and no
 * house is seated near any ruin at all. Ruins the simulation creates later are
 * parented normally, which is why the two-hundred-year figure is not zero.
 *
 * RED-CHECKED four ways, and each of the four turns this file red: dropping the
 * province term, dropping the `sealed` term, reading `anybody` instead of
 * `deciders`, and putting the `controllingFactionId` test back. Dropping the
 * knowing term entirely takes five of the ten with it.
 */

import { describe, it, expect } from 'vitest';

import {
    aFindThisHouseCouldSendFor,
    whatStandingOnItGives,
    whereTheOpenGroundIs
} from '../../../src/engine/world/who-goes-out-for-a-house-and-what-comes-back.js';
import { makeLocation, type LocationRecord } from '../../../src/engine/world/locations.js';
import {
    REACHABLE_FROM,
    stageCeilingFor,
    type KnowingStage
} from '../../../src/engine/social/discovery.js';
import type { OnTheRoll } from '../../../src/engine/social-leverage/what-a-body-wants-is-what-its-deciders-want.js';

// ─────────────────────────────────────────────────────────────────────────
// A PROVINCE, A SEAT AND SOME GROUND
// ─────────────────────────────────────────────────────────────────────────

const RANK_COUNT = 5;

/** The head of the house, and somebody who sweeps the yard. */
const ROLL: OnTheRoll[] = [
    { id: 'npc-head', rankIndex: RANK_COUNT - 1 },
    { id: 'npc-porter', rankIndex: 0 }
];

function ground(): LocationRecord[] {
    return [
        makeLocation({ id: 'here', name: 'Low Fall', kind: 'region' }),
        makeLocation({ id: 'far', name: 'High Fall', kind: 'region' }),
        makeLocation({ id: 'seat', name: 'The Compound', kind: 'sect_seat', parentId: 'here' }),
        makeLocation({ id: 'near-ruin', name: 'The Drowned Step', kind: 'ruin', parentId: 'here' }),
        makeLocation({
            id: 'shut-ruin', name: 'The Closed Step', kind: 'ruin', parentId: 'here', sealed: true
        }),
        makeLocation({ id: 'far-ruin', name: 'The Far Step', kind: 'ruin', parentId: 'far' })
    ];
}

type StageFor = (holderId: string, locationId: string) => KnowingStage;

/** Somebody who can point at a piece of ground, and nobody else. */
function knownBy(holderId: string, locationId: string): StageFor {
    return (who, where) => (who === holderId && where === locationId ? REACHABLE_FROM : 'unaware');
}

/** This house has sent nobody anywhere. The errand reading is a separate test. */
const NO_ERRANDS = (): KnowingStage => 'unaware';

function findFor(locations: readonly LocationRecord[], stageFor: StageFor) {
    return aFindThisHouseCouldSendFor({
        ground: whereTheOpenGroundIs(locations),
        houseId: 'sect-ours',
        seatLocationId: 'seat',
        roll: ROLL,
        rankCount: RANK_COUNT,
        stageFor,
        errands: NO_ERRANDS
    });
}

describe('a ruin is public, and what a house has is knowing where it is', () => {
    it('is a find when a decider can point at open ground in the province', () => {
        const found = findFor(ground(), knownBy('npc-head', 'near-ruin'));
        expect(found?.locationId).toBe('near-ruin');
    });

    it('does not read whose name is on the ground', () => {
        // The same ground, held by somebody else entirely. A monopoly would be
        // a reason the other houses have a GRUDGE, and is not what makes this
        // house able to walk a party out to a place it knows the way to.
        const held = ground().map(l =>
            l.id === 'near-ruin' ? { ...l, controllingFactionId: 'sect-somebody-else' } : l
        );
        expect(findFor(held, knownBy('npc-head', 'near-ruin'))?.locationId).toBe('near-ruin');

        // And ground this house DOES hold, that none of its deciders can point
        // at, is still not a reason it has. Holding was never the question.
        const ours = ground().map(l =>
            l.id === 'near-ruin' ? { ...l, controllingFactionId: 'sect-ours' } : l
        );
        expect(findFor(ours, () => 'unaware')).toBeNull();
    });

    it('is not a find four provinces off, however well it is known', () => {
        expect(findFor(ground(), knownBy('npc-head', 'far-ruin'))).toBeNull();
    });

    it('is not a find while the ground is still shut', () => {
        // A sealed ruin is a reason to go and find a key, which is a different
        // errand nobody has written.
        expect(findFor(ground(), knownBy('npc-head', 'shut-ruin'))).toBeNull();
    });

    it('takes the deciders and not everybody who has heard', () => {
        const porter = findFor(ground(), knownBy('npc-porter', 'near-ruin'));
        expect(porter).toBeNull();

        // The house has still HEARD of it. Being told and being able to act on
        // it are two states, and most of what a player manoeuvres in is the gap.
        const heard = aFindThisHouseCouldSendFor({
            ground: whereTheOpenGroundIs(ground()),
            houseId: 'sect-ours',
            seatLocationId: 'seat',
            roll: ROLL,
            rankCount: RANK_COUNT,
            stageFor: (who, where) =>
                who === 'npc-porter' && where === 'near-ruin' ? 'known' : 'unaware',
            errands: NO_ERRANDS
        });
        expect(heard).toBeNull();
    });

    it('needs the rung the ladder names, not one below it', () => {
        // `named` is knowing the place exists. You cannot set out for a sound.
        const named = findFor(ground(), (who, where) =>
            who === 'npc-head' && where === 'near-ruin' ? 'named' : 'unaware');
        expect(named).toBeNull();
        expect(REACHABLE_FROM).toBe('placed');
    });

    it('says nothing at all where the seat is in no province', () => {
        const adrift = ground().map(l => (l.id === 'seat' ? { ...l, parentId: null } : l));
        expect(findFor(adrift, knownBy('npc-head', 'near-ruin'))).toBeNull();
    });
});

describe('having stood on ground is what the world can say about knowing it', () => {
    it('puts an actor and a witness on the ground the fact was sited at', () => {
        const stage = whatStandingOnItGives([
            {
                locationId: 'near-ruin',
                actors: [{ id: 'npc-head', name: 'The Head', role: 'sent' }],
                witnessIds: ['npc-porter']
            }
        ]);
        // The rung is the ladder's own price for having been there, read off
        // `stageCeilingFor` rather than written down again here.
        expect(stage('npc-head', 'near-ruin')).toBe(stageCeilingFor('witnessed'));
        expect(stage('npc-porter', 'near-ruin')).toBe(stageCeilingFor('witnessed'));
        expect(stage('npc-head', 'far-ruin')).toBe('unaware');
        expect(stage('npc-nobody', 'near-ruin')).toBe('unaware');
    });

    it('ignores a fact the world could not site', () => {
        const stage = whatStandingOnItGives([
            { locationId: null, actors: [{ id: 'npc-head', name: 'The Head', role: 'sent' }], witnessIds: [] }
        ]);
        expect(stage('npc-head', 'near-ruin')).toBe('unaware');
    });

    it('reaches a find through the ledger the world actually writes', () => {
        const stage = whatStandingOnItGives([
            {
                locationId: 'near-ruin',
                actors: [{ id: 'npc-head', name: 'The Head', role: 'sent' }],
                witnessIds: []
            }
        ]);
        expect(findFor(ground(), stage)?.locationId).toBe('near-ruin');
    });
});
