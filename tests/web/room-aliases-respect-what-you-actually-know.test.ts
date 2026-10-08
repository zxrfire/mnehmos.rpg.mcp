/**
 * The 2026-10-03 meditation probe returned null for cultivation rooms inside
 * the actual house: the alias matched its p3 room, but a new rank-zero member
 * did not know that room, and plural rooms escaped the local refusal branch.
 * Superseded by the owner's later ruling: informed returning players may seek
 * ordinary cultivation rooms without repeating their character's introduction.
 * This changes explicit requests, not discovery records or unsolicited views.
 * Hidden archives still need discovery. Arrange standing through the
 * same viewer and access readers as walking; never prescribe a rank or waive
 * a lock. A known alias moves; an unknown actual room and alias refuse locally.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { FALSE_IMMORTAL_ORDINAL } from '../../src/engine/cultivation/realms.js';
import { pathTo, roomStageFor, roomsVisibleTo, reachThrough } from '../../src/engine/world/architecture.js';
import { isAtLeast } from '../../src/engine/social/discovery.js';
import { whereCompoundsAre } from '../../src/engine/world/where-inside-a-house-somebody-is-standing.js';
import { howThisCultivatorStandsInTheHouseHolding } from '../../src/web/how-this-cultivator-stands-on-this-ground.js';
import { aWalkInsideTheWalls } from '../../src/web/walking-inside-the-walls.js';

async function standingForTheRoom(known: boolean, purpose: 'meditation_cell' | 'archive' = known ? 'meditation_cell' : 'archive') {
    const h = await makeGameInWorld({ seed: known ? 'known-room-alias' : 'unknown-room-alias', worldSeed: 'road-world' });
    const born = await h.game.newRun('Room Visitor');
    const world = h.game.atHand!;
    for (const c of whereCompoundsAre(world).bySeat.values()) {
        const room = c.rooms.get(purpose);
        const house = h.repos.sects.getById(c.houseId);
        if (!room || !house) continue;
        const ranks = known ? house.ranks.map((_, i) => i) : [0];
        const rank = ranks.find(rankIndex => {
            const reading = howThisCultivatorStandsInTheHouseHolding({ ground: room,
                cultivator: { ...born.cultivator, realmOrdinal: FALSE_IMMORTAL_ORDINAL }, objects: world.objects,
                standing: { sectId: c.houseId, rankIndex, rankCount: house.ranks.length, joinedOnDay: world.currentDay },
                onDay: Math.floor(world.currentDay) });
            const placed = isAtLeast(roomStageFor(room, reading.viewer), 'placed');
            const reach = reachThrough(pathTo(world.locations, room.id), reading.access, { enteredAt: c.seat.id });
            return placed === known && (!known || reach.stoppedAt === null && reach.level !== 'barred');
        });
        if (rank === undefined) continue;
        h.repos.sects.addMember(c.houseId, born.cultivator.id, rank);
        h.repos.cultivators.update(born.cultivator.id, { location: c.seat.name, realmOrdinal: FALSE_IMMORTAL_ORDINAL });
        h.repos.cultivators.standIn(born.cultivator.id, null);
        await h.game.act('I look around');
        return { ...h, room, seat: c.seat, body: h.repos.cultivators.getById(born.cultivator.id)! };
    }
    throw new Error('No actual room matching the native knowledge/access arrangement.');
}

it('a known reachable cultivation-room alias walks to the actual room', async () => {
    const h = await standingForTheRoom(true);
    const before = h.game.currentRun().run.elapsedDays;
    const walk = await aWalkInsideTheWalls(h.game, h.game.currentRun().run, h.body, 'cultivation rooms');
    expect(walk?.outcome, walk?.facts.prose).toBe('executed');
    expect(h.repos.cultivators.getById(h.body.id)!.location).toBe(h.room.name);
    expect(h.game.currentRun().run.elapsedDays - before).toBeCloseTo(0.25);
}, 120_000);

it('a new junior gets the honest local refusal for a hidden archive alias and explicit unknown room', async () => {
    const h = await standingForTheRoom(false);
    for (const target of ['archive', h.room.name]) {
        const before = h.game.currentRun();
        const walk = await aWalkInsideTheWalls(h.game, before.run, before.cultivator, target);
        expect(walk?.outcome).toBe('refused');
        expect(walk?.facts.headline).toContain('Nowhere inside');
        expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
        expect(h.repos.cultivators.getById(h.body.id)!.location).toBe(h.seat.name);
        expect(h.repos.cultivators.getById(h.body.id)!.spiritStones).toBe(before.cultivator.spiritStones);
    }
}, 120_000);

it('a returning player can seek ordinary cultivation rooms before this junior has discovered them', async () => {
    const h = await standingForTheRoom(false, 'meditation_cell');
    const membership = h.repos.sects.getMembership(h.body.id)!;
    const house = h.repos.sects.getById(membership.sectId)!;
    const standing = howThisCultivatorStandsInTheHouseHolding({ ground: h.room,
        cultivator: h.body, objects: h.game.atHand!.objects,
        standing: { ...membership, rankCount: house.ranks.length }, onDay: Math.floor(h.game.atHand!.currentDay) });
    expect(isAtLeast(roomStageFor(h.room, standing.viewer), 'placed')).toBe(false);
    expect(roomsVisibleTo([h.room], standing.viewer)).toEqual([]);
    const knowledgeBefore = JSON.stringify(h.game.knowledge.awareness(h.body.id));
    const walk = await aWalkInsideTheWalls(h.game, h.game.currentRun().run, h.body, 'cultivation rooms');
    expect(walk?.outcome, walk?.facts.prose).toBe('executed');
    expect(h.repos.cultivators.getById(h.body.id)!.location).toBe(h.room.name);
    // The request itself does not pretend the character had already met a room.
    expect(JSON.stringify(h.game.knowledge.awareness(h.body.id))).toBe(knowledgeBefore);
}, 120_000);
