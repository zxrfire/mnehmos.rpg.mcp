/**
 * Arrange the office this judgment is about. Rank alone stopped re-dealing
 * halls when actual stable appointments were introduced. This writes the one
 * existing hall appointment, then asks the ordinary jurisdiction reader to
 * prove who holds it; it decides no complaint or sentence.
 */
import { expect } from 'vitest';
import { hallForRoom } from '../../src/engine/world/house-halls.js';
import { purposeOf as purposeOfRoom } from '../../src/engine/world/architecture.js';
import type { GameService } from '../../src/web/turn-engine.js';
import { positionIn } from '../../src/web/standing.js';

export async function holdTheActualPunishmentChair(game: GameService, id: string, houseId: string): Promise<void> {
    const house = game.repos.sects.getById(houseId)!;
    game.repos.sects.setRank(houseId, id, house.ranks.length - 2);
    const world = (await game.loadWorld())!;
    const hall = hallForRoom('punishment_hall')!;
    const room = world.locations.find(room => room.data.factionId === houseId && room.data.hallOfficeId === hall.id)
        ?? world.locations.find(room => room.data.factionId === houseId && purposeOfRoom(room) === 'punishment_hall');
    expect(room, 'the actual house has no punishment appointment').toBeDefined();
    room!.data.hallOfficeId = hall.id;
    room!.data.hallHolderId = id;
    room!.data.hallCovering = false;
    game.atHand = world;
    game.theWorldMoved();
    const standing = positionIn(game.repos, id);
    if (!standing) throw new Error('The appointed player is not on this house roll.');
    const { portfolios } = await game['theHouseAround'](game.repos.cultivators.getById(id)!, standing);
    expect(portfolios.some(portfolio => portfolio.purpose === 'punishment_hall' && portfolio.holderId === id),
        'the actual appointed player does not hold the punishment room').toBe(true);
}
