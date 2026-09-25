/**
 * A vehicle carries people as well as goods. The owner: "remember to test that they can carry
 * people", "remember to test parties too". Two people on the road with the player ride their
 * carriage with them and arrive where they arrive; a mount that seats two makes more than one
 * trip of three.
 */
import { describe, expect, it } from 'vitest';

import { aVehicleOf } from '../../src/engine/world/a-vehicle';
import { makeGameInWorld } from './harness';

function placeRow(game: any, location: string | null) {
    const here = (location ?? '').trim().toLowerCase();
    return (game.atHand?.locations ?? []).find((row: { name: string }) => row.name.toLowerCase() === here) ?? null;
}

/** The player stood where two others are, and those two put on the road with them. */
function twoOnTheRoadWithThem(game: any, born: any) {
    const world = game.atHand;
    const heads = new Map<string, number>();
    for (const npc of world.npcs) {
        if (npc.status === 'alive' && npc.locationId !== null) heads.set(npc.locationId, (heads.get(npc.locationId) ?? 0) + 1);
    }
    const square = world.locations
        .filter((row: any) => row.kind === 'settlement' && (heads.get(row.id) ?? 0) >= 2)
        .sort((a: any, b: any) => (a.id < b.id ? -1 : 1))[0];
    expect(square, 'nowhere holds two people').toBeDefined();
    game.repos.cultivators.update(born.id, { location: square.name });
    const cultivator = game.repos.cultivators.getById(born.id);
    const party = world.npcs.filter((npc: any) => npc.locationId === square.id && npc.status === 'alive').slice(0, 2);
    game.putThemOnTheRoadWithYou(cultivator, party.map((npc: any) => ({ id: npc.id, name: npc.name })),
        { note: 'Out on the road together.', forDays: 400 });
    const going = world.locations
        .filter((row: any) => row.kind === 'settlement' && row.id !== square.id)
        .map((row: any) => row.name)[0];
    return { cultivator, party, square, going };
}

describe('a vehicle and the people with you', () => {
    it('carries a party of three in one carriage, and they arrive together', async () => {
        const { game } = await makeGameInWorld({ seed: 'road-party-ride', worldSeed: 'world-road-party-move' });
        const { cultivator: born } = await game.newRun('Wen Shu');
        const { cultivator, party, going } = twoOnTheRoadWithThem(game as any, born);
        (game as any).atHand.objects.push(aVehicleOf({ id: 'carriage', conveyanceId: 'conv-carriage-mortal',
            ownerId: cultivator.id, ownerName: 'Wen Shu', at: game.worldPlaceOf(cultivator) }));

        const turn = await game.act(`we ride the carriage to ${going}`);
        expect(turn.toolCalls.some(call => call.action === 'ride' && call.ok), JSON.stringify(turn.toolCalls.map(c => c.summary))).toBe(true);
        const arrived = placeRow(game as any, going);
        for (const member of party) {
            const now = (game as any).atHand.npcs.find((npc: any) => npc.id === member.id);
            expect(now.locationId, `${member.name} did not come`).toBe(arrived.id);
        }
    }, 300_000);

    it('makes more than one trip where it seats fewer than the party', async () => {
        const { game } = await makeGameInWorld({ seed: 'road-party-mount', worldSeed: 'world-road-party-move' });
        const { cultivator: born } = await game.newRun('Wen Shu');
        const { cultivator, going } = twoOnTheRoadWithThem(game as any, born);
        (game as any).atHand.objects.push(aVehicleOf({ id: 'mount', conveyanceId: 'conv-mount-mortal',
            ownerId: cultivator.id, ownerName: 'Wen Shu', at: game.worldPlaceOf(cultivator) }));

        const turn = await game.act(`we ride the mount to ${going}`);
        // Said to the player in the turn's own account: it goes back for the rest.
        const said = [turn.narration ?? '', ...game.state().log.slice(-12).map(entry => entry.text)].join(' ');
        expect(said).toMatch(/goes back for the rest: 2 trips/);
    }, 300_000);
});
