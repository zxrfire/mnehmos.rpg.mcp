/** Native staffing must never decide for a player who holds Internal Affairs.
 * The converse is also agency: when that player explicitly chooses their own
 * work, no NPC draw may overrule their own personnel decision. The returned
 * nomination still cannot move the sheet or the player's world projection. */
import { expect, it } from 'vitest';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state';
import { createNpc, PLAYER_ROW_TAG } from '../../../src/engine/world/npc-state';
import { makeLocation, linkLocations } from '../../../src/engine/world/locations';
import { appointHouseWorker, personnelManager } from '../../../src/engine/world/internal-affairs-puts-somebody-to-the-work';

function arrangement() {
    const state = createWorld({ seed: 'player-personnel-holder', skipPriorAges: true, regionCount: 0, presentYear: 0 });
    const seat = makeLocation({ id: 'seat', kind: 'sect_seat', name: 'Reed House', data: { factionId: 'house' } });
    const room = makeLocation({ id: 'lamps', kind: 'hall', name: 'Life Lamp Hall', parentId: seat.id,
        data: { factionId: 'house', purpose: 'life_lamp_hall' } });
    linkLocations(seat, room, 'path', .1);
    state.locations = [seat, room];
    state.factions = [makeFaction({ id: 'house', name: 'Reed House', seatLocationId: seat.id, ranks: ['Disciple', 'Elder', 'Head'] })];
    const player = createNpc(state.seed, { id: 'player', bornOnDay: -7300, onDay: 5, tags: [PLAYER_ROW_TAG] });
    player.factionId = 'house'; player.factionRankIndex = 2; player.locationId = null; player.activity = null;
    state.npcs = [player];
    expect(personnelManager(state, 'house')?.id).toBe(player.id);
    const input = { houseId: 'house', job: 'serving_internal_affairs', room, day: 5, posted: true,
        suitable: () => true };
    return { state, seat, player, input };
}

it('leaves the player personnel holder alone during ordinary Native staffing', () => {
    const h = arrangement();
    expect(appointHouseWorker(h.state, h.input)).toBeNull();
    expect(h.player.locationId).toBeNull();
    expect(h.player.activity).toBeNull();
});

it('accepts the actual personnel holder\'s explicit choice without moving their body', () => {
    const h = arrangement();
    const chosen = appointHouseWorker(h.state, { ...h.input, applicant: { ...h.player, locationId: h.seat.id } });
    expect(chosen?.id).toBe(h.player.id);
    expect(chosen?.activity?.houseWorkFactId).toBeTruthy();
    expect(h.state.npcs[0]!.locationId).toBeNull();
    expect(h.state.npcs[0]!.activity).toBeNull();
});
