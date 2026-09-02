/**
 * The player, as somebody the world can put on an invitation list.
 *
 * `gatherings.ts` draws every attendee from `chosenOf`, which reads
 * `state.npcs`. Below the Lid the player had no `NpcRecord` at all, so they
 * were not rarely invited - they were absent from the list the invitation is
 * drawn from, at every rung and in every house. The whole gathering system
 * could not include the person playing.
 *
 * Four claims, and the last two are the ones most likely to be silently wrong:
 *
 *   1. The player has a row, and it carries THE SAME ID as the cultivator, so
 *      lineage, grudges and provenance keep resolving against one identity.
 *   2. With that row on the roster, `chosenOf` can name them and a gathering
 *      seats them.
 *   3. The world does not ADVANCE them. Their rung comes off their own sheet
 *      through `time-skip.ts`, and a second climb in `applyAdvancement` would
 *      be the double-advance this whole design is arranged to prevent.
 *   4. The world does not KILL them either. The lifespan pass would otherwise
 *      write their death into the chronicle mid-run.
 */

import { describe, it, expect } from 'vitest';

import { makeGame } from './harness';
import { createWorld, makeFaction, type WorldState } from '../../src/engine/world/world-state.js';
import { createNpc, setRealm, PLAYER_ROW_TAG, type NpcRecord } from '../../src/engine/world/npc-state.js';
import { makeLocation } from '../../src/engine/world/locations.js';
import { forStream } from '../../src/engine/cultivation/rng.js';
import { chosenOf, circlesOf, holdGathering } from '../../src/engine/world/gatherings.js';
import { advanceWorldForPlay } from '../../src/engine/world/driver.js';

// ─────────────────────────────────────────────────────────────────────────
// THE WIRING
// ─────────────────────────────────────────────────────────────────────────

describe('the player is on the roster', () => {
    it('materialises one row, under the cultivator\'s own id', async () => {
        const { game } = makeGame({ worldEnabled: true, seed: 'invited-1' });
        const created = await game.newRun('Wei Zhaoxun');
        const world = await game.loadWorld();
        expect(world, 'the world is off').not.toBeNull();

        const rows = world!.npcs.filter(npc => npc.tags.includes(PLAYER_ROW_TAG));
        expect(rows.length, 'exactly one row in the world is the player\'s').toBe(1);

        // The whole reason `residentAbove` chose this shape: one identity, so
        // a grudge written against the player at a gathering is a grudge
        // against the person who then walks into the room.
        expect(rows[0].id).toBe(created.cultivator.id);
        expect(rows[0].name).toBe(created.cultivator.name);
        expect(rows[0].cultivation.realmOrdinal).toBe(created.cultivator.realmOrdinal);
        expect(rows[0].cultivation.spiritRoot).toBe(created.cultivator.spiritRoot);
        expect(rows[0].layer).toBe('mortal');

        // And it stands NOWHERE, on purpose. Presence is the play layer's, and
        // a second copy of it here is what `npcsAt` callers trip over - see the
        // module header. A gathering seats people by id and needs no place.
        expect(rows[0].locationId, 'the mirror row acquired a location').toBeNull();
    }, 120_000);

    it('refreshes rather than accumulating, across turns', async () => {
        const { game } = makeGame({ worldEnabled: true, seed: 'invited-2' });
        const created = await game.newRun('Wei Zhaoxun');
        await game.act('I look around');
        await game.act('I work for two years');

        const world = await game.loadWorld();
        expect(world!.npcs.filter(n => n.tags.includes(PLAYER_ROW_TAG)).length).toBe(1);

        // And it says what the SHEET says, not what the world last wrote.
        const sheet = game.state().cultivator;
        const row = world!.npcs.find(n => n.id === created.cultivator.id)!;
        expect(row.cultivation.realmOrdinal).toBe(sheet.realmOrdinal);
        expect(row.spiritStones).toBe(sheet.spiritStones);
    }, 120_000);
});

// ─────────────────────────────────────────────────────────────────────────
// THE INVITATION
//
// Hand-built, for the reason `gatherings.test.ts` states about itself: this is
// testing the mechanism, and a seeded world's alliance graph is content
// somebody may legitimately change this afternoon.
// ─────────────────────────────────────────────────────────────────────────

const PLAYER_ID = 'the-cultivator-being-played';

function worldWithTwoHouses(): WorldState {
    const state = createWorld({ seed: 'invited', skipPriorAges: true, regionCount: 0 });
    state.locations.push(makeLocation({
        id: 'loc-region', name: 'The Province', kind: 'region', qiDensity: 0.4
    }));
    for (const id of ['house-a', 'house-b']) {
        state.locations.push(makeLocation({
            id: `seat-${id}`, name: `${id} seat`, kind: 'sect_seat',
            parentId: 'loc-region', qiDensity: 0.4
        }));
        state.factions.push(makeFaction({
            id,
            name: id,
            seatLocationId: `seat-${id}`,
            resources: { spirit_stones: 100_000, power_ordinal: id === 'house-a' ? 30 : 20 }
        }));
    }
    state.factions.find(f => f.id === 'house-b')!.standing['house-a'] = 0.4;

    // One ordinary chosen in the senior house, so a gathering has two houses in
    // it and the player is not the only person in the room.
    let theirs: NpcRecord = createNpc(state.seed, {
        id: 'npc-theirs',
        bornOnDay: state.currentDay - 365 * 60,
        onDay: state.currentDay,
        locationId: 'seat-house-a',
        occupation: 'disciple',
        tags: ['chosen']
    });
    theirs = setRealm(theirs, 12, state.currentDay);
    state.npcs.push({ ...theirs, factionId: 'house-a', factionRankIndex: 1 });

    return state;
}

/** The player's row, as `standInTheWorld` writes it. */
function playerRow(state: WorldState, ordinal: number): NpcRecord {
    let row: NpcRecord = createNpc(state.seed, {
        id: PLAYER_ID,
        name: 'The One Being Played',
        bornOnDay: state.currentDay - 365 * 30,
        onDay: state.currentDay,
        locationId: null,
        occupation: 'the one being played',
        tags: [PLAYER_ROW_TAG]
    });
    row = setRealm(row, ordinal, state.currentDay);
    return { ...row, factionId: 'house-b', factionRankIndex: 1 };
}

describe('a gathering can seat the person playing', () => {
    it('names them among their house\'s chosen once the house has named them', () => {
        const state = worldWithTwoHouses();
        state.npcs.push({ ...playerRow(state, 10), tags: [PLAYER_ROW_TAG, 'chosen'] });

        const named = chosenOf(state, 'house-b').map(n => n.id);
        expect(named, 'the player is not on their own house\'s list').toContain(PLAYER_ID);
    });

    it('seats them, and what happens in the room is written against their id', () => {
        const state = worldWithTwoHouses();
        state.npcs.push({ ...playerRow(state, 10), tags: [PLAYER_ROW_TAG, 'chosen'] });

        const circle = circlesOf(state).find(c => c.members.length > 1);
        expect(circle, 'the two houses are not in a circle').toBeDefined();

        const held = holdGathering(state, circle!, state.currentDay, forStream('invited', 'gather'));
        expect(held, 'no gathering was held').not.toBeNull();
        expect(held!.attendeeIds, 'the player was not seated').toContain(PLAYER_ID);

        // The fact carries them as a witness, which is what puts the gathering
        // in their own digest rather than in nobody's.
        expect(held!.fact.witnessIds).toContain(PLAYER_ID);

        // And the other house's disciple now has an opinion about them, on a
        // row keyed to the id the player's own sheet uses.
        const theirs = state.npcs.find(n => n.id === 'npc-theirs')!;
        expect(
            theirs.relationships.some(r => r.targetId === PLAYER_ID),
            'nobody came away knowing them'
        ).toBe(true);
    });

    it('does not seat them when their house has not named them', () => {
        const state = worldWithTwoHouses();
        state.npcs.push(playerRow(state, 10));
        expect(chosenOf(state, 'house-b').map(n => n.id)).not.toContain(PLAYER_ID);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// AND THE WORLD DOES NOT MOVE THEM
// ─────────────────────────────────────────────────────────────────────────

describe('the row is not a free agent', () => {
    it('is never advanced by the world, while ordinary people are', () => {
        const state = worldWithTwoHouses();
        state.npcs.push(playerRow(state, 10));

        // A comparison NPC with the same rung, the same house and the same age,
        // so the only difference between the two is the tag.
        const control: NpcRecord = {
            ...playerRow(state, 10),
            id: 'npc-control',
            name: 'An Ordinary Disciple',
            tags: []
        };
        state.npcs.push(control);

        advanceWorldForPlay(state, { days: 365 * 300, stopOnInterrupt: false });

        const player = state.npcs.find(n => n.id === PLAYER_ID)!;
        expect(
            player.cultivation.realmOrdinal,
            'the world climbed the ladder on the player\'s behalf'
        ).toBe(10);
        expect(player.cultivation.lastAdvancedOnDay).toBe(state.npcs.find(
            n => n.id === PLAYER_ID
        )!.cultivation.lastAdvancedOnDay);

        // The control is what proves the guard is a guard and not a dead pass:
        // three centuries did something to somebody.
        const others = state.npcs.filter(n => n.id !== PLAYER_ID);
        expect(
            others.some(n => n.cultivation.realmOrdinal !== 10 || n.status !== 'alive'),
            'three centuries changed nobody at all, so this proves nothing'
        ).toBe(true);
    }, 120_000);

    it('is never enrolled in a house it did not walk into, nor handed a book', () => {
        const state = worldWithTwoHouses();
        const row = playerRow(state, 10);
        state.npcs.push({ ...row, factionId: null, factionRankIndex: -1 });

        advanceWorldForPlay(state, { days: 365 * 300, stopOnInterrupt: false });

        const player = state.npcs.find(n => n.id === PLAYER_ID)!;
        expect(player.factionId, 'the world put the player in a house').toBeNull();
        expect(
            player.cultivation.techniqueIds,
            'the world handed the player a manual'
        ).toEqual([]);
    }, 120_000);

    /**
     * The one that took two attempts to get right. An event template draws an
     * ACTOR - who opened the hall, who took the opportunity, who killed
     * somebody, who walked into the hills - and emits a fact saying they did
     * it. Drawn on the player, the engine asserts the player did a thing they
     * never did, in a layer the play loop never saw.
     *
     * A gathering is the deliberate exception and is not one: it names them
     * because they were seated, which is the point of the row. Nothing here
     * seats them - they hold no `chosen` tag - so the chronicle should carry
     * them as an actor exactly nowhere.
     */
    it('is never drawn by an event template as somebody who did something', () => {
        const state = worldWithTwoHouses();
        state.npcs.push({ ...playerRow(state, 10), factionId: null, factionRankIndex: -1 });

        advanceWorldForPlay(state, { days: 365 * 500, stopOnInterrupt: false });

        const named = state.history.facts.filter(f =>
            f.actors.some(a => a.id === PLAYER_ID));
        expect(
            named.map(f => `${f.kind}: ${f.summary}`),
            'the world wrote the player into its own chronicle as an actor'
        ).toEqual([]);
    }, 180_000);

    it('is never killed by the lifespan clock, and no death of theirs is chronicled', () => {
        const state = worldWithTwoHouses();
        const row = playerRow(state, 10);
        // Their lifespan has already run out on the world's books. Every
        // ordinary row in this position is marked dead on the next pass.
        state.npcs.push({
            ...row,
            cultivation: { ...row.cultivation, lifespanEndsOnDay: state.currentDay + 10 }
        });

        advanceWorldForPlay(state, { days: 365 * 5, stopOnInterrupt: false });

        const player = state.npcs.find(n => n.id === PLAYER_ID)!;
        expect(player.status, 'the world clock declared the player dead').toBe('alive');
        expect(
            state.history.facts.some(f =>
                f.kind === 'death' && f.actors.some(a => a.id === PLAYER_ID)),
            'a death of the player\'s was written into the chronicle'
        ).toBe(false);
    }, 120_000);
});
