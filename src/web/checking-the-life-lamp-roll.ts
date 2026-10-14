/** A disciple serving the hall reports the roll check's findings, once on the day they check. */
import { readTheRollAgainstTheHall } from '../engine/world/what-the-roll-and-the-lamps-say.js';
import { whereThisHouseBurnsItsLamps } from '../engine/world/a-recruit-is-given-their-lamp-at-the-house.js';
import { readFlag, writeFlag } from '../server/consolidated/cultivation-support.js';
import { makeFact } from '../engine/world/history.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import { routineTime } from '../engine/world/npc-routines.js';
import type { Cultivator } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';

export function checkYourHallsRoll(game: GameService, cultivator: Cultivator, houseId: string): {
    lines: string[]; structure: string[];
} | null {
    const world = game.atHand;
    if (!world) return null;
    const hall = whereThisHouseBurnsItsLamps(world.locations, houseId);
    if (!hall || game.worldPlaceOf(cultivator) !== hall) return null;
    const checkedAt = routineTime(world);
    const day = Math.floor(checkedAt);
    const stamp = `life-lamp-roll-check:${houseId}`;
    if (readFlag(game.db, cultivator.id, stamp) === String(day)) return null;
    const readings = readTheRollAgainstTheHall(world, houseId, { checkedNow: true });
    const missing = readings.filter(reading => reading.reading === 'they_are_dead');
    const lines = missing.length ? missing.map(reading =>
        `The roll names ${reading.memberName}. Their life lamp is absent from the Life Lamp Hall.`)
        : ['You checked the disciple roll against the Life Lamp Hall. No lamp is missing.'];
    const fact = appendWorldFact(world, makeFact({ day: checkedAt, kind: 'said_in_public',
        summary: `${cultivator.name} checked the disciple roll against the Life Lamp Hall: ${missing.length} missing lamps.`,
        visibility: 'faction', locationId: hall, factionIds: [houseId],
        actors: [{ id: cultivator.id, name: cultivator.name, role: 'checked the roll' }],
        data: { lampRollCheck: true, missingMemberIds: JSON.stringify(missing.map(reading => reading.memberId)) } }), { recur: false });
    writeFlag(game.db, cultivator.id, stamp, String(day));
    game.theWorldMoved();
    return { lines, structure: [`life lamp roll check ${fact.id}, day ${day}, hall ${hall}.`] };
}
