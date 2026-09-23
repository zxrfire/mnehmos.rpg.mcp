/**
 * What comes to light about a killing somebody hid.
 *
 * A killing made to look like something else enters the world as a deed nobody
 * has worked out - `aDeedEntersTheWorld` with `workedOut: false`, which writes
 * the row `secret` and tells nobody. Until this pass there was nothing on the
 * other side of that: the world held the truth and no year of it ever turned one
 * up, so every disguised killing in a five-thousand-year world stayed disguised.
 *
 * ── WHAT TURNS ONE UP ────────────────────────────────────────────────────
 *
 * Nothing new is invented. The four terms are things the world already holds:
 *
 *   how it was hidden   ground away from everybody hides a thing; a death in a
 *                       town is a death people saw the edges of.
 *                       {@link WHAT_OPEN_GROUND_HIDES}.
 *   how long ago        it fades. {@link WHAT_A_CENTURY_COVERS}, and past
 *                       {@link HOW_LONG_A_THING_CAN_COME_OUT} nobody is asking
 *                       any more.
 *   who is looking      the dead's own people: kin, a master, a disciple, and
 *                       the house whose lamp went out with no account of it.
 *                       Nobody left, nobody asking.
 *   who the dead were   a disciple nobody outside the hall knew is not a Seat.
 *                       Read off the rung they stood at.
 *
 * ── AND WHAT HAPPENS WHEN IT DOES ────────────────────────────────────────
 *
 * The same paths an open killing takes. The row stops being secret and says so;
 * the people who were looking hold it against the killer; and where the killer
 * is on a roll, their house's own room hears it and hands down what it hands
 * down (`whatTheRoomDecides`), which takes their office or puts them out of the
 * house through `whatASentenceDoesToTheirPlace`.
 *
 * MOST OF THEM STAY HIDDEN, and that is the point of hiding one. Measured on
 * `afford-a`: of the killings hidden long enough to be asked about, 14% had come
 * out within a century of being done and 20% within a millennium (182 of 1,279
 * and 192 of 956, at the 5,000-year mark); 1,305 were hidden over the run and
 * 264 came out. At 0.05 a year rather than {@link WHAT_COMES_OUT_IN_A_YEAR} it
 * was 41% inside a century, which is not a thing being hidden.
 */

import { forStream } from '../cultivation/rng.js';
import { MAX_ORDINAL } from '../cultivation/realms.js';
import type { Severity } from '../social/grudges.js';
import { theRoomsThisHouseHas } from '../social-leverage/authority-for-an-order.js';
import { whereAComplaintGoes } from '../social-leverage/reporting-what-you-saw.js';
import { whatTheRoomDecides } from '../social-leverage/what-a-room-decides-about-one-of-its-own.js';
import { whoIsInChargeOfWhat } from '../social-leverage/what-an-elder-is-in-charge-of.js';
import { makeFact, type HistoricalFact } from './history.js';
import { upsertRelationship, relationshipWith, type NpcRecord } from './npc-state.js';
import {
    REMOVED_FROM_OFFICE,
    whatASentenceDoesToTheirPlace
} from './bringing-what-you-know-about-somebody-to-the-room.js';
import { ROGUE_EXPELLED, offTheRoll, whereTheyRunTo } from './what-becomes-of-a-houses-people-when-it-is-gone.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { isGroundAwayFromEverybody } from './why-one-cultivator-kills-another.js';
import { indexById, type WorldState } from './world-state.js';

const DAYS_PER_YEAR = 365;

/** The chance in a year that a fresh, badly hidden killing of somebody well known comes out. */
export const WHAT_COMES_OUT_IN_A_YEAR = 0.018;

/** What ground away from everybody is worth to somebody hiding a killing on it. */
export const WHAT_OPEN_GROUND_HIDES = 0.25;

/** How much of it a century covers over. */
export const WHAT_A_CENTURY_COVERS = 0.5;

/** Past this nobody is asking any more, and the pass does not look either. */
export const HOW_LONG_A_THING_CAN_COME_OUT = 300;

/** The tag the row carries once it has come out, so nothing turns it up twice. */
export const CAME_TO_LIGHT = 'cameToLight';

/** Somebody who would be asking: the dead's own people, and their house. */
export function whoIsAskingAbout(state: WorldState, victim: NpcRecord): NpcRecord[] {
    const asking = new Map<string, NpcRecord>();
    const byId = new Map(state.npcs.map(n => [n.id, n] as const));
    for (const tie of victim.relationships) {
        if (tie.standing < 0.2) continue;
        const who = byId.get(tie.targetId);
        if (who && who.status === 'alive') asking.set(who.id, who);
    }
    if (victim.factionId !== null) {
        for (const n of state.npcs) {
            if (n.status !== 'alive' || n.factionId !== victim.factionId || n.id === victim.id) continue;
            // The house asks through whoever is senior enough to be told.
            if (n.factionRankIndex >= 2) asking.set(n.id, n);
        }
    }
    return [...asking.values()];
}

/** The chance this one comes out this year, 0..1. */
export function whetherItComesOut(input: {
    yearsSince: number;
    onOpenGround: boolean;
    asking: number;
    victimOrdinal: number;
}): number {
    if (input.yearsSince > HOW_LONG_A_THING_CAN_COME_OUT || input.asking === 0) return 0;
    const fades = Math.pow(WHAT_A_CENTURY_COVERS, input.yearsSince / 100);
    const hidden = input.onOpenGround ? WHAT_OPEN_GROUND_HIDES : 1;
    const looking = Math.min(1, input.asking / 4);
    const known = 0.25 + 0.75 * Math.min(1, input.victimOrdinal / MAX_ORDINAL);
    return Math.max(0, Math.min(1, WHAT_COMES_OUT_IN_A_YEAR * fades * hidden * looking * known));
}

/** What a year of it turned up. */
export interface WhatCameToLight {
    found: { factId: string; killerId: string; victimId: string; sentence: string; place: string }[];
    stillHidden: number;
}

/**
 * One year of things coming out. Walks back from the newest fact only as far as
 * anybody is still asking, so the cost does not grow with the chronicle.
 */
export function whatComesToLightThisYear(state: WorldState, year: number, day: number): WhatCameToLight {
    const out: WhatCameToLight = { found: [], stillHidden: 0 };
    const oldest = day - HOW_LONG_A_THING_CAN_COME_OUT * DAYS_PER_YEAR;
    for (let i = state.history.facts.length - 1; i >= 0; i--) {
        const fact = state.history.facts[i]!;
        if (fact.day < oldest) break;
        if (fact.data?.hidden !== true || fact.data?.[CAME_TO_LIGHT] !== undefined) continue;
        const killerId = fact.actors.find(a => a.role === 'killer')?.id;
        const victimId = fact.actors.find(a => a.role === 'victim')?.id;
        if (killerId === undefined || victimId === undefined) continue;
        const killer = state.npcs[indexById(state.npcs, killerId)];
        const victim = state.npcs[indexById(state.npcs, victimId)];
        if (!killer || !victim) continue;
        out.stillHidden++;
        const asking = whoIsAskingAbout(state, victim);
        const place = state.locations.find(l => l.id === fact.locationId) ?? null;
        const chance = whetherItComesOut({
            yearsSince: (day - fact.day) / DAYS_PER_YEAR,
            onOpenGround: isGroundAwayFromEverybody(place),
            asking: asking.length,
            victimOrdinal: victim.cultivation.realmOrdinal
        });
        if (chance <= 0) continue;
        if (!forStream(state.seed, 'what-comes-to-light', fact.id, year).chance(chance)) continue;
        out.stillHidden--;
        out.found.push(itComesOut(state, fact, killer, victim, asking, day));
    }
    return out;
}

function itComesOut(
    state: WorldState,
    fact: HistoricalFact,
    killer: NpcRecord,
    victim: NpcRecord,
    asking: readonly NpcRecord[],
    day: number
): { factId: string; killerId: string; victimId: string; sentence: string; place: string } {
    // The row stops being secret, and says when.
    fact.visibility = 'regional';
    fact.causeKnown = true;
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
    const portfolios = whoIsInChargeOfWhat({
        rooms: theRoomsThisHouseHas(state.locations, house.id),
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
    if (at >= 0 && place === 'expelled') {
        state.npcs[at] = offTheRoll(state.npcs[at]!, day, `${ROGUE_EXPELLED}${house.id}`, whereTheyRunTo(state, house));
    } else if (at >= 0 && place === 'removed from office') {
        const row = state.npcs[at]!;
        state.npcs[at] = {
            ...row,
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
