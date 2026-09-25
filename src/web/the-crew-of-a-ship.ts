/**
 * The crew of a ship: a shipmaster and two or three hands, real people, kept from one voyage to the next.
 *
 * The owner: a crew "helps with gathering knowledge". So they are ordinary world rows, mortals or
 * low cultivators, who can be talked to and remember what they see, and whose trade is the water:
 * `sailor` is an occupation that has seen the road (`howMuchOfTheRoadALifeHasSeen`), so they know
 * the lanes and the ports as far as their lives reach.
 *
 * ONE SHIP TO A LANE, crewed the first time anybody boards it. Its people are written then and not
 * before, the way a beast with a core is given a row on contact, so no world is seeded with crews
 * nobody sails with. Their ids are the ship's, so boarding that lane again finds the same people.
 * Somebody of the crew who has died stays dead, and the ship sails without them.
 *
 * WHERE THEY ARE is where the ship is: aboard with the passenger at sea, and put in with them at
 * the far end. They work the ship together, so they stand on one deck, three at most to an area
 * like anybody (`where-in-a-place-somebody-is-standing.ts`), and the passenger stands with the
 * shipmaster.
 */

import { lifespanForOrdinal } from '../engine/cultivation/realms.js';
import { forStream } from '../engine/cultivation/rng.js';
import type { SeaLane } from '../engine/world/what-a-sea-crossing-costs.js';
import { theAreasOf } from '../engine/world/where-in-a-place-somebody-is-standing.js';
import { createNpc, setLocation, setRealm, type NpcRecord } from '../engine/world/npc-state.js';
import { years } from '../engine/world/opportunities.js';
import { worldLocationFor } from './entities.js';
import type { GameService } from './turn-engine.js';

/** Who works a ship, by the ship's id. */
const CREW_OF = 'crew-of:';

const THE_SHIPMASTER = 'shipmaster';
const A_HAND = 'sailor';

function slug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** The ship that works a lane, the same whichever end it is boarded from. */
function theShipOn(lane: SeaLane): string {
    return [slug(lane.fromPlace), slug(lane.toPlace)].sort().join('--');
}

/** A shipmaster and two or three hands, written the first time the ship is boarded. */
function theCrewOf(game: GameService, lane: SeaLane, at: string, onDay: number): NpcRecord[] {
    const world = game.atHand!;
    const ship = theShipOn(lane);
    const rng = forStream(world.seed, 'the-crew-of-a-ship', ship);
    const hands = rng.int(2, 3);
    const roles = [THE_SHIPMASTER, ...Array.from({ length: hands }, () => A_HAND)];
    const ids = roles.map((role, i) => `npc-crew-${ship}-${role === THE_SHIPMASTER ? 'master' : `hand-${i}`}`);
    const taken = new Set(world.npcs.map(npc => npc.name));
    let wrote = false;
    roles.forEach((role, i) => {
        const id = ids[i]!;
        if (world.npcs.some(npc => npc.id === id)) return;
        const draw = forStream(world.seed, 'the-crew-of-a-ship', id);
        const ordinal = role === THE_SHIPMASTER ? draw.int(0, 4) : draw.int(0, 2);
        const span = lifespanForOrdinal(ordinal);
        const age = role === THE_SHIPMASTER
            ? Math.round(Math.min(span * 0.8, 35 + draw.int(0, 25)))
            : Math.round(Math.min(span * 0.6, 17 + draw.int(0, 25)));
        let npc = createNpc(world.seed, {
            id,
            bornOnDay: onDay - years(age),
            onDay,
            locationId: at,
            occupation: role,
            takenNames: taken,
            tags: [`${CREW_OF}${ship}`]
        });
        taken.add(npc.name);
        npc = { ...setRealm(npc, ordinal, onDay), factionId: null, factionRankIndex: -1 };
        world.npcs.push(npc);
        wrote = true;
    });
    if (wrote) game.theWorldMoved();
    return ids
        .map(id => world.npcs.find(npc => npc.id === id))
        .filter((npc): npc is NpcRecord => npc !== undefined && npc.status === 'alive');
}

/**
 * The crew goes where the ship goes: put where it now is, working it together, and at sea the
 * passenger stood on the deck the shipmaster is on. Nothing where there is no world.
 */
export function theCrewIsWhereTheShipIs(
    game: GameService,
    lane: SeaLane,
    where: string,
    passengerId: string,
    onDay: number,
    atSea: boolean
): NpcRecord[] {
    const world = game.atHand;
    const row = world ? worldLocationFor(world, where) : null;
    if (!world || !row) return [];
    const crew = theCrewOf(game, lane, row.id, onDay);
    const ids = crew.map(npc => npc.id);
    for (const one of crew) {
        const at = world.npcs.indexOf(one);
        world.npcs[at] = {
            ...setLocation(one, row.id, onDay),
            activity: {
                kind: 'the_work_of_their_rank',
                note: one.identity.occupation === THE_SHIPMASTER ? 'Keeping the ship.' : 'Working the ship.',
                withIds: ids.filter(id => id !== one.id),
                sinceDay: onDay,
                untilDay: null
            }
        };
    }
    game.theWorldMoved();
    const master = crew.find(npc => npc.identity.occupation === THE_SHIPMASTER) ?? crew[0];
    const deck = master ? theAreasOf(world, row).whereIs.get(master.id) : undefined;
    if (atSea && deck) game.repos.cultivators.standIn(passengerId, deck);
    return world.npcs.filter(npc => ids.includes(npc.id));
}
