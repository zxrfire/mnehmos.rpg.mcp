/**
 * Seven houses offered, and no road to any of them.
 *
 * FOUND BY PLAYING BLIND, turn four of a fresh run, following the game's own
 * lead at every step:
 *
 *     > i want to join a sect
 *     The Burnt Earth Temple would seat you as a Lamp Novice, and the Azure Dew
 *     Sect would take you as a Dew Servant... There are four other houses that
 *     would accept someone of your standing.
 *
 *     > i go to the azure dew sect
 *     You have the name. You do not have the road. Whoever they are, they have
 *     not said where they keep themselves, and a name is not a direction.
 *
 *     > where can I go
 *     You carry five other names in your head, but they are just words; you do
 *     not know the roads that lead to them. Somebody would have to tell you
 *     where.
 *
 * Three reads, each correct on its own, and together a closed door with a sign
 * on it describing the key. The game states the remedy in its own voice -
 * *somebody would have to tell you where* - and nobody in the world could.
 *
 * `whoCouldPointAtAGround` offers DAO GROUNDS and nothing else, so every road a
 * player could ever be given led to a vein or a village. A house's seat is a
 * first-class location - `kind: 'sect_seat'`, parented to its region - and
 * `seatLocationId` has been on the faction record since the world state was
 * written. `seatOf` reads it, has one caller, and that caller is about
 * formations. The two halves were never joined.
 *
 * ── THE RULE, AND WHY IT IS THE MODEST ONE ───────────────────────────────
 *
 * Somebody can point at a house's gate when it is their OWN house, or when the
 * seat is in the region they are standing in. Both are ordinary knowledge, and
 * the second is the dao-ground channel's own reasoning one subject over:
 * *somebody here can point at it because it is ordinary to them*.
 *
 * Deliberately not power and deliberately not `startingAwareness`. Being famous
 * enough to NAME is a different question from somebody walking you to the door,
 * and the whole point of `lore.ts`'s floor is that a great house's name travels
 * further than its road does. Nothing here hands out a road across a province.
 */

import { describe, it, expect } from 'vitest';

import {
    whatSomebodyWouldSayAboutAHouse,
    whatTheyNowHoldAboutAHouse,
    whoCouldPointAtAHouse
} from '../../src/web/where-a-house-keeps-itself';
import { createWorld, makeFaction, type WorldState } from '../../src/engine/world/world-state';
import { createNpc } from '../../src/engine/world/npc-state';
import { makeLocation } from '../../src/engine/world/locations';

const DAY = 365 * 400;
const SQUARE = 'loc-square';

/**
 * One province with a market and a house's ground in it, and a second province
 * with its own house, so "local" is doing work rather than passing vacuously.
 */
function aWorld(): WorldState {
    const state = createWorld({ seed: 'house-road', skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;

    state.locations.push(
        makeLocation({ id: 'loc-here', name: 'The Jade Gorge', kind: 'region', qiDensity: 0.4 }),
        makeLocation({
            id: SQUARE, name: 'Autumn Gate', kind: 'settlement',
            parentId: 'loc-here', qiDensity: 0.4
        }),
        makeLocation({
            id: 'loc-near-seat', name: 'Azure Dew Sect grounds', kind: 'sect_seat',
            parentId: 'loc-here', qiDensity: 0.5
        }),
        makeLocation({ id: 'loc-far', name: 'Low Fall', kind: 'region', qiDensity: 0.4 }),
        makeLocation({
            id: 'loc-far-seat', name: 'Distant Hall grounds', kind: 'sect_seat',
            parentId: 'loc-far', qiDensity: 0.5
        })
    );

    state.factions.push(
        makeFaction({ id: 'sect-near', name: 'Azure Dew Sect', seatLocationId: 'loc-near-seat' }),
        makeFaction({ id: 'sect-far', name: 'Distant Hall', seatLocationId: 'loc-far-seat' })
    );
    return state;
}

/** Somebody standing in the square, optionally on a house's roll. */
function putSomebodyInTheSquare(state: WorldState, id: string, factionId: string | null): void {
    const npc = createNpc(state.seed, {
        id, name: `Person ${id}`, bornOnDay: DAY - 365 * 40, onDay: DAY,
        locationId: SQUARE, occupation: 'disciple'
    });
    state.npcs.push({ ...npc, factionId });
}

describe('somebody local can say where a house keeps itself', () => {
    it('offers the house whose ground is in this province', () => {
        const state = aWorld();
        putSomebodyInTheSquare(state, 'npc-local', null);

        const offers = whoCouldPointAtAHouse(state, SQUARE);
        expect(offers.map(o => o.house.houseName)).toEqual(['Azure Dew Sect']);
        expect(offers[0]!.house.seatId).toBe('loc-near-seat');
        expect(offers[0]!.house.theirOwn).toBe(false);
    });

    /**
     * AND NOT A HOUSE ACROSS THE MAP. This is what keeps the rule modest: a
     * stranger in one province does not hand out roads into another.
     */
    it('does not offer a house seated somewhere else', () => {
        const state = aWorld();
        putSomebodyInTheSquare(state, 'npc-local', null);
        expect(whoCouldPointAtAHouse(state, SQUARE).map(o => o.house.houseId))
            .not.toContain('sect-far');
    });

    /**
     * UNLESS IT IS THEIRS. Somebody on a house's roll knows the way home,
     * wherever home is - there is no weaker claim available about a person and
     * their own compound.
     */
    it('offers a distant house to somebody who is of it', () => {
        const state = aWorld();
        putSomebodyInTheSquare(state, 'npc-member', 'sect-far');

        const offers = whoCouldPointAtAHouse(state, SQUARE);
        const theirs = offers.find(o => o.house.houseId === 'sect-far');
        expect(theirs, 'a member could not place their own house').toBeDefined();
        expect(theirs!.house.theirOwn).toBe(true);
    });

    /**
     * AND NOBODY POINTS AT THE GROUND THEY ARE STANDING ON. A player already
     * there does not need telling, and it would be a place granted for free.
     */
    it('offers nothing to somebody standing on the seat itself', () => {
        const state = aWorld();
        const npc = createNpc(state.seed, {
            id: 'npc-at-seat', name: 'Person at the gate', bornOnDay: DAY - 365 * 40,
            onDay: DAY, locationId: 'loc-near-seat', occupation: 'disciple'
        });
        state.npcs.push({ ...npc, factionId: null });

        expect(whoCouldPointAtAHouse(state, 'loc-near-seat')
            .filter(o => o.house.seatId === 'loc-near-seat')).toHaveLength(0);
    });

    it('offers nothing where nobody is standing here', () => {
        expect(whoCouldPointAtAHouse(aWorld(), SQUARE)).toHaveLength(0);
    });

    /**
     * ONE WORLD ANSWERS ONE WAY. The channel draws from this list, so an
     * unstable order would make a seeded world unreproducible.
     */
    it('is ordered the same way twice', () => {
        const state = aWorld();
        putSomebodyInTheSquare(state, 'npc-b', null);
        putSomebodyInTheSquare(state, 'npc-a', 'sect-far');
        const once = whoCouldPointAtAHouse(state, SQUARE).map(o => o.speaker.id + '/' + o.house.houseId);
        const twice = whoCouldPointAtAHouse(state, SQUARE).map(o => o.speaker.id + '/' + o.house.houseId);
        expect(once).toEqual(twice);
        expect(once.length).toBeGreaterThan(1);
    });
});

describe('what gets said about it', () => {
    const local = {
        houseId: 'sect-near', houseName: 'Azure Dew Sect',
        seatId: 'loc-near-seat', seatName: 'Azure Dew Sect grounds', theirOwn: false
    };

    it('says where it is and how the speaker comes to know', () => {
        expect(whatSomebodyWouldSayAboutAHouse(local, 'Wei Ciyi'))
            .toContain('Azure Dew Sect grounds');
        expect(whatSomebodyWouldSayAboutAHouse({ ...local, theirOwn: true }, 'Wei Ciyi'))
            .toContain('is of Azure Dew Sect');
    });

    /**
     * AND NEVER WHETHER THE LISTENER WOULD BE TAKEN. That is the join read's
     * business and it says it better; a person pointing at a gate is not
     * assessing anybody.
     */
    it('does not say anything about whether they would have you', () => {
        const said = whatSomebodyWouldSayAboutAHouse(local, 'Wei Ciyi')
            + ' ' + whatTheyNowHoldAboutAHouse(local);
        for (const word of ['would take', 'would have you', 'admit', 'accept', 'rank']) {
            expect(said.toLowerCase()).not.toContain(word);
        }
    });

    it('leaves the player holding a place they could set out for', () => {
        expect(whatTheyNowHoldAboutAHouse(local)).toContain('could set out');
    });
});
