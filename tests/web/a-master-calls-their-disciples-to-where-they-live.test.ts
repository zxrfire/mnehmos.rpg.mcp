/**
 * A master calls their own disciples to where they live, and the lesson is held
 * there.
 *
 * The design owner: *"closed lectures fall out because the master calls his
 * disciples to his cave abode or room."*
 *
 * ── WHAT WAS THERE BEFORE ────────────────────────────────────────────────
 *
 * The lesson and the room, never put together. `giveThisYearsAttention` wrote a
 * master's `teaching` activity over the disciples standing with them, and the
 * placement read put every `teaching` activity in the lecture hall - so a master
 * taking their own three through what they have was read as a hall lecture,
 * open to whoever walked in. The room was there too: a residence where somebody
 * took ground (`residenceOf`), and otherwise the room their rung is lodged in
 * (`the-room-a-house-gives-you.ts`). Nothing read one against the other, and a
 * player whose master was teaching had no way to be told, find the room, or get
 * past the walls to it.
 *
 * ── WHAT THIS PINS ───────────────────────────────────────────────────────
 *
 *   a lesson whose set is the master's own disciples is placed where the master
 *   lives, master and disciples both, off the world's own yearly pass
 *   a set with somebody else in it is not a closed lesson and is not placed there
 *   the player whose master it is, inside the walls, is told who called them
 *   and where; "my master's quarters" names the room, and being called lets
 *   them through to it
 *   somebody who was not called meets the walls the way anybody does: no
 *   answer written for the occasion, just the ordinary one
 *
 * THE ARRANGEMENT: the master is asked of the engine (`whereAMasterLives`, a
 * room the bottom rung is not lodged in), the tie is written the way a kneeling
 * writes it, and the lesson is the yearly pass's own. The one thing set by hand
 * is the lesson's first day, a day ahead, so that it begins inside a turn.
 *
 * Red-checked, each on its own: with the placement lines out, the placement
 * test goes red; with the closed-set check answering true for any set, the
 * stranger test goes red; with the call's door (`invited`) dropped from the
 * walk, the walking test goes red.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';
import { giveThisYearsAttention } from '../../src/engine/world/who-is-given-attention-this-year.js';
import { whereAMasterLives } from '../../src/engine/world/where-a-master-takes-their-own-disciples.js';
import { theLodgingsOfAHouse, whichRoomARungGets } from '../../src/engine/world/the-room-a-house-gives-you.js';
import {
    npcsStandingIn,
    whereCompoundsAre,
    whereTheyAreStanding
} from '../../src/engine/world/where-inside-a-house-somebody-is-standing.js';
import { recordABondBothWays } from '../../src/web/encounters.js';
import type { NpcRecord } from '../../src/engine/world/npc-state.js';

const WORLD = 'a-master-at-home';

/** A master of a house whose room the bottom rung is not lodged in, with somebody below them at the seat. */
async function aMasterAndADisciple(seed: string, tieThePlayer: boolean) {
    const harness = await makeGameInWorld({ seed, worldSeed: WORLD });
    const { cultivator } = await harness.game.newRun('Disciple');
    // One turn of days first, so the year's own passes have run before the
    // lesson is arranged and do not run over it.
    await harness.game.act('I wait for three days');
    const world = harness.game.atHand!;
    const day = Math.floor(world.currentDay);
    const compounds = whereCompoundsAre(world);

    for (const house of world.factions) {
        if (house.dissolvedOnDay !== null || house.seatLocationId === null) continue;
        if (harness.repos.sects.getById(house.id) === null) continue;
        const compound = compounds.bySeat.get(house.seatLocationId);
        if (!compound) continue;
        const bottom = whichRoomARungGets(theLodgingsOfAHouse(world, house.id), 0);
        const roll = world.npcs
            .filter(n => n.status === 'alive' && n.factionId === house.id && n.locationId === house.seatLocationId)
            .sort((a, b) => b.factionRankIndex - a.factionRankIndex || (a.id < b.id ? -1 : 1));
        for (const master of roll) {
            const dwelling = whereAMasterLives(world, master);
            if (!dwelling || !compound.inside.has(dwelling.id) || dwelling.id === bottom?.locationId) continue;
            const disciple = roll.find(n => n.id !== master.id && n.cultivation.realmOrdinal < master.cultivation.realmOrdinal);
            if (!disciple) continue;

            const at = (id: string) => world.npcs.findIndex(n => n.id === id);
            const d = at(disciple.id);
            world.npcs[d] = {
                ...world.npcs[d]!,
                activity: null,
                relationships: [...world.npcs[d]!.relationships.filter(r => r.targetId !== master.id), {
                    targetId: master.id, targetName: master.name, kind: 'master', standing: 0.6, note: '',
                    sinceDay: day, lastChangedDay: day, factIds: [], inheritedFromId: null
                }]
            };
            const m = at(master.id);
            world.npcs[m] = { ...world.npcs[m]!, activity: null };
            giveThisYearsAttention(world, Math.floor(day / 365), day);
            const lesson = world.npcs[at(master.id)]!.activity;
            if (lesson?.kind !== 'teaching' || !lesson.withIds.includes(disciple.id)) continue;

            harness.repos.sects.addMember(house.id, cultivator.id, 0);
            harness.repos.cultivators.update(cultivator.id, { location: compound.seat.name });
            if (tieThePlayer) {
                recordABondBothWays(harness.repos, [
                    { fromId: cultivator.id, toId: master.id, type: 'master', strength: 0.6 }
                ], harness.game.currentRun().run.elapsedDays, `${cultivator.name} knelt to ${master.name}.`);
            }
            return { ...harness, cultivator, world, house, master: world.npcs[at(master.id)]!, disciple, dwelling, compound };
        }
    }
    throw new Error('no master in this world teaches a disciple at home');
}

describe('a closed lesson', () => {
    it('is held where the master lives, master and disciples both', async () => {
        const h = await aMasterAndADisciple('closed-lesson-placed', false);
        const there = npcsStandingIn(h.world, h.dwelling.id).map(n => n.id);
        expect(there).toContain(h.master.id);
        expect(there).toContain(h.disciple.id);
    });

    it('with somebody else in the set, is not a closed lesson and is not held there', async () => {
        const h = await aMasterAndADisciple('open-set-not-placed', false);
        const stranger = h.world.npcs.find(n => n.status === 'alive' && n.factionId === h.house.id
            && n.id !== h.master.id && n.id !== h.disciple.id
            && !n.relationships.some(r => r.kind === 'master' && r.targetId === h.master.id))!;
        const at = h.world.npcs.findIndex(n => n.id === h.master.id);
        const doing = h.world.npcs[at]!.activity!;
        h.world.npcs[at] = { ...h.world.npcs[at]!, activity: { ...doing, withIds: [...doing.withIds, stranger.id] } };
        const people = new Set(h.world.npcs.map(n => n.id));
        const master: NpcRecord = h.world.npcs[at]!;
        expect(whereTheyAreStanding(h.world, whereCompoundsAre(h.world), master, people)).not.toBe(h.dwelling.id);
    });
});

describe('the player whose master it is', () => {
    it('is told who called them and where, and walks there on "my master\'s quarters"', async () => {
        const h = await aMasterAndADisciple('the-player-is-called', true);
        const at = h.world.npcs.findIndex(n => n.id === h.master.id);
        const today = Math.floor(h.world.currentDay);
        h.world.npcs[at] = { ...h.world.npcs[at]!, activity: { ...h.world.npcs[at]!.activity!, sinceDay: today + 1 } };

        const told = await h.game.act('I wait for three days');
        expect(told.narration).toContain(h.master.name);
        expect(told.narration).toContain(h.dwelling.name);

        const walked = await h.game.act("I go to my master's quarters");
        expect(walked.toolCalls.some(c => c.name === 'world.walkInsideTheWalls' && c.ok)).toBe(true);
        expect(h.repos.cultivators.getById(h.cultivator.id)!.location).toBe(h.dwelling.name);

        // And in the room, the lesson is the ordinary one to sit in on.
        const sat = await h.game.act("I sit in on my master's lesson");
        expect(sat.toolCalls.some(c => c.action === 'teach' && c.ok)).toBe(true);
    });

    it('is the only one let through: somebody not called meets the walls as anybody does', async () => {
        const h = await aMasterAndADisciple('nobody-called-them', false);
        const own = h.dwelling.name.slice(h.dwelling.name.indexOf(': ') + 2);
        const turn = await h.game.act(`I go to ${own}`);
        expect(turn.toolCalls.some(c => c.name === 'engine.walkInsideTheWalls')).toBe(true);
        expect(h.repos.cultivators.getById(h.cultivator.id)!.location).toBe(h.compound.seat.name);
    });
});
