/** The ordinary resolution writer shared by yearly discovery and focused scenarios.
 * The yearly reader alone decides whether a killing is discovered. */
import { portfoliosIn } from '../social-leverage/authority-for-an-order.js';
import type { Severity } from '../social/grudges.js';
import { whereAComplaintGoes } from '../social-leverage/reporting-what-you-saw.js';
import { whatTheRoomDecides } from '../social-leverage/what-a-room-decides-about-one-of-its-own.js';
import { explainFact, makeFact, type HistoricalFact } from './history.js';
import { upsertRelationship, relationshipWith, type NpcRecord } from './npc-state.js';
import {
    REMOVED_FROM_OFFICE,
    whatASentenceDoesToTheirPlace
} from './bringing-what-you-know-about-somebody-to-the-room.js';
import { ROGUE_EXPELLED, offTheRoll, whereTheyRunTo } from './what-becomes-of-a-houses-people-when-it-is-gone.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { theRoomTurnedThemOut } from './what-being-seen-to-do-well-is-worth.js';
import { indexById, type WorldState } from './world-state.js';


const DAYS_PER_YEAR = 365;
export const CAME_TO_LIGHT = 'cameToLight';

export function aHiddenKillingBecomesKnown(
    state: WorldState,
    fact: HistoricalFact,
    killer: NpcRecord,
    victim: NpcRecord,
    asking: readonly NpcRecord[],
    day: number
): { factId: string; killerId: string; victimId: string; sentence: string; place: string } {
    // The row stops being secret, and says when.
    // Somebody found out, which is `explainFact`: the cause is known from
    // today and the record is at least as good as what was learned.
    fact.visibility = 'regional';
    explainFact(state.history, fact.id, []);
    fact.data = { ...fact.data, [CAME_TO_LIGHT]: day };

    const said = appendWorldFact(state, makeFact({
        day,
        kind: 'grudge_opened',
        scale: 'local',
        summary: `It came out that ${killer.name} killed ${victim.name}, and made it look like something else.`,
        actors: [
            { id: killer.id, name: killer.name, role: 'killer' },
            { id: victim.id, name: victim.name, role: 'victim' }
        ],
        locationId: fact.locationId,
        factionIds: [killer.factionId, victim.factionId].filter((id): id is string => id !== null),
        visibility: 'regional',
        magnitude: 0.5,
        data: {
            cameToLightAbout: fact.id,
            yearsItHeld: Math.round((day - fact.day) / DAYS_PER_YEAR),
            unattributed: 'An old death up the valley has been reopened, and somebody is being named.'
        }
    }));

    // Whoever was asking holds it against them, which is what an open killing
    // leaves and a hidden one did not.
    for (const who of asking) {
        const at = indexById(state.npcs, who.id);
        if (at < 0) continue;
        const row = state.npcs[at]!;
        const was = relationshipWith(row, killer.id)?.standing ?? 0;
        state.npcs[at] = upsertRelationship(row, {
            targetId: killer.id,
            targetName: killer.name,
            kind: 'enemy',
            standing: Math.max(-1, Math.min(was, -0.85)),
            note: `Killed ${victim.name} and hid it.`,
            factIds: [said.id]
        }, day);
    }

    const sentence = theRoomHearsOfIt(state, killer, fact, day);
    return {
        factId: fact.id,
        killerId: killer.id,
        victimId: victim.id,
        sentence,
        place: state.locations.find(l => l.id === fact.locationId)?.name ?? 'somewhere'
    };
}

/** The killer's own house hears what its member did, and hands down what it hands down. */
function theRoomHearsOfIt(state: WorldState, killer: NpcRecord, fact: HistoricalFact, day: number): string {
    const house = killer.factionId === null
        ? null
        : state.factions.find(f => f.id === killer.factionId && f.dissolvedOnDay === null) ?? null;
    if (house === null) return 'nobody to answer to';
    const roll = state.npcs.filter(n => n.status === 'alive' && n.factionId === house.id);
    const portfolios = portfoliosIn({
        locations: state.locations, sectId: house.id, npcs: state.npcs,
        roll: roll.map(n => ({ id: n.id, rankIndex: n.factionRankIndex })),
        rankCount: house.ranks.length
    });
    const head = [...roll].sort((a, b) => b.factionRankIndex - a.factionRankIndex || (a.id < b.id ? -1 : 1))[0] ?? null;
    const toId = whereAComplaintGoes({ portfolios, aboutId: killer.id, headId: head?.id ?? null });
    if (toId === null) return 'no room to take it to';
    const weight = typeof fact.data?.deedWeight === 'string' ? fact.data.deedWeight as Severity : 'unforgivable';
    const decided = whatTheRoomDecides({
        what: { does: 'reports', toId, line: 'It came out.' },
        theirsToPunish: true,
        alignment: house.alignment,
        severity: weight,
        houseId: house.id,
        theHouseGaveThemSomething: true
    });
    const place = whatASentenceDoesToTheirPlace(decided.sentence);
    const at = indexById(state.npcs, killer.id);
    // What the room's ruling costs them in front of it. See
    // `what-being-seen-to-do-well-is-worth.ts`.
    if (at >= 0 && place !== 'nothing') {
        theRoomTurnedThemOut(state, killer.id, day, place === 'expelled');
    }
    if (at >= 0 && place === 'expelled') {
        state.npcs[at] = offTheRoll(state.npcs[at]!, day, `${ROGUE_EXPELLED}${house.id}`, whereTheyRunTo(state, house));
    } else if (at >= 0 && place === 'removed from office') {
        const row = state.npcs[at]!;
        state.npcs[at] = {
            ...row,
            tags: Array.from(new Set([...row.tags, `${REMOVED_FROM_OFFICE}${house.id}:${day}`])),
            updatedOnDay: day
        };
    }
    if (place !== 'nothing') {
        appendWorldFact(state, makeFact({
            day,
            kind: 'grudge_opened',
            scale: 'local',
            summary: `The ${house.name} settled with ${killer.name} for it: ${place}.`,
            actors: [{ id: killer.id, name: killer.name, role: 'sentenced' }],
            locationId: house.seatLocationId,
            factionIds: [house.id],
            visibility: 'faction',
            magnitude: 0.4,
            data: {
                sentence: decided.sentence,
                place,
                cameToLightAbout: fact.id,
                unattributed: 'A house up the valley has settled something with one of its own.'
            }
        }));
    }
    return `${decided.sentence} (${place})`;
}
