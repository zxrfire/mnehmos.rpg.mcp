/**
 * Coming into a city that matters past the Jade Register Hall's gatehouse.
 *
 * The owner: gate registration is "only for cities that matter, provincial capital and capital":
 * a small fee, and a record of who came in. The catalog already prices it - `price-gate-registration`,
 * three stones a year to the Hall, "compulsory", and the House's real income - so a registration is
 * good for a year at every gate the Hall keeps, and every entry is written down either way.
 *
 * A cultivator who cannot pay is entered as unpaid rather than turned back: the record is the
 * Hall's trade, and a clerk who does not look up writes the name whether or not the stones come.
 * The fee goes to the clerk on the gate if one is there, or to the Hall's own treasury.
 */
import { DAYS_PER_YEAR } from '../engine/cultivation/cultivation.js';
import { getPrice, stonesForACashPrice } from '../data/cultivation/mortal-world.js';
import { theShopfrontOf } from '../engine/world/a-dao-house-shopfront.js';
import { makeFact } from '../engine/world/history.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import { factsWithDataValue } from '../engine/world/witness-reaction-index.js';
import { routineOf } from '../engine/world/npc-routines.js';
import type { Cultivator } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';

export const THE_REGISTER_HOUSE_ID = 'house-jade-register';

/** What the gate says, as lines for this turn; empty where nothing happened at a Jade gate. */
export function enteringAtTheJadeGate(game: GameService, before: Pick<Cultivator, 'id' | 'location'>): string[] {
    const world = game.atHand;
    if (!world) return [];
    const now = game.repos.cultivators.getById(before.id);
    if (!now?.alive || !now.location || now.location === before.location) return [];
    const groundId = game.worldPlaceOf(now);
    const city = world.locations.find(l => l.id === groundId);
    if (!city || theShopfrontOf(world, THE_REGISTER_HOUSE_ID, city) === null) return [];
    const hall = world.factions.find(h => h.id === THE_REGISTER_HOUSE_ID)!;
    const day = Math.floor(world.currentDay);
    const registered = factsWithDataValue(world, 'gateRegistrant', now.id)
        .some(f => f.data.paid === true && Number(f.data.untilDay) > day);
    const fee = stonesForACashPrice(getPrice('price-gate-registration')!.cash);
    const paying = !registered && now.spiritStones >= fee;
    const clerk = world.npcs.find(n => n.status === 'alive' && n.factionId === THE_REGISTER_HOUSE_ID
        && routineOf(world, n).locationId === city.id && n.activity?.kind === 'stationed') ?? null;
    if (paying) {
        if (!game.repos.cultivators.applyDeltas(now.id, { spiritStones: -fee })) return [];
        if (clerk) { clerk.spiritStones += fee; clerk.updatedOnDay = world.currentDay; }
        else hall.resources.spirit_stones = Number(hall.resources.spirit_stones ?? 0) + fee;
    }
    appendWorldFact(world, makeFact({ day, kind: 'toll_paid', visibility: 'regional', locationId: city.id,
        summary: `${now.name} was entered on the Jade Register at the gate of ${city.name}`
            + (paying ? `, and paid ${fee} spirit stones for the year.` : registered ? ', already on the register for the year.' : ', unpaid.'),
        actors: [{ id: now.id, name: now.name, role: 'entrant' }, ...(clerk ? [{ id: clerk.id, name: clerk.name, role: 'clerk' }] : [])],
        witnessIds: clerk ? [clerk.id] : [], factionIds: [THE_REGISTER_HOUSE_ID],
        data: { gateRegistration: true, gateRegistrant: now.id, paid: paying || registered,
            ...(paying ? { untilDay: day + DAYS_PER_YEAR, stones: fee } : {}) } }));
    game.theWorldMoved();
    return [paying
        ? `At the gate of ${city.name} a Jade Register clerk enters your name and takes ${fee} spirit stones: a year on the register, at every gate the Hall keeps.`
        : registered
            ? `At the gate of ${city.name} a Jade Register clerk finds your name already on the register for the year and enters you.`
            : `At the gate of ${city.name} a Jade Register clerk enters your name as unpaid: the year's registration is ${fee} spirit stones and you are carrying ${now.spiritStones}.`];
}
