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
import { factsWithData } from './witness-reaction-index.js';
import { drawBackgroundIncidents, isPlayerInvolved } from './background-incident-draw.js';
import { MAX_ORDINAL } from '../cultivation/realms.js';
import type { HistoricalFact } from './history.js';
import type { NpcRecord } from './npc-state.js';
import { isGroundAwayFromEverybody } from './why-one-cultivator-kills-another.js';
import type { WorldState } from './world-state.js';
import { aHiddenKillingBecomesKnown, CAME_TO_LIGHT } from './a-hidden-killing-becomes-known.js';
export { CAME_TO_LIGHT } from './a-hidden-killing-becomes-known.js';

const DAYS_PER_YEAR = 365;

/** The chance in a year that a fresh, badly hidden killing of somebody well known comes out. */
export const WHAT_COMES_OUT_IN_A_YEAR = 0.018;

/** What ground away from everybody is worth to somebody hiding a killing on it. */
export const WHAT_OPEN_GROUND_HIDES = 0.25;

/** How much of it a century covers over. */
export const WHAT_A_CENTURY_COVERS = 0.5;

/** Past this nobody is asking any more, and the pass does not look either. */
export const HOW_LONG_A_THING_CAN_COME_OUT = 300;

/** Somebody who would be asking: the dead's own people, and their house. */
export function whoIsAskingAbout(state: WorldState, victim: NpcRecord,
    people?: ReadonlyMap<string, NpcRecord>, seniors?: ReadonlyMap<string, readonly NpcRecord[]>): NpcRecord[] {
    const asking = new Map<string, NpcRecord>();
    const byId = people ?? new Map(state.npcs.map(n => [n.id, n] as const));
    for (const tie of victim.relationships) {
        if (tie.standing < 0.2) continue;
        const who = byId.get(tie.targetId);
        if (who && who.status === 'alive') asking.set(who.id, who);
    }
    if (victim.factionId !== null) {
        for (const n of seniors?.get(victim.factionId) ?? state.npcs) {
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
 * One year of things coming out, drawn from indexed hidden deeds within their
 * inquiry span. Deeds involving the player retain their individual draws.
 */
export function whatComesToLightThisYear(state: WorldState, year: number, day: number): WhatCameToLight {
    const out: WhatCameToLight = { found: [], stillHidden: 0 };
    const oldest = day - HOW_LONG_A_THING_CAN_COME_OUT * DAYS_PER_YEAR;
    const people = new Map(state.npcs.map(n => [n.id, n]));
    const places = new Map(state.locations.map(l => [l.id, l]));
    const seniors = new Map<string, NpcRecord[]>();
    for (const person of people.values()) if (person.status === 'alive' && person.factionId !== null
        && person.factionRankIndex >= 2) {
        const roll = seniors.get(person.factionId) ?? [];
        roll.push(person); seniors.set(person.factionId, roll);
    }
    type Candidate = { fact: HistoricalFact; killer: NpcRecord; victim: NpcRecord; asking: NpcRecord[] };
    const background: { value: Candidate; rate: number }[] = [];
    const resolve = (row: Candidate): void => {
        out.stillHidden--;
        out.found.push(aHiddenKillingBecomesKnown(state, row.fact, row.killer, row.victim, row.asking, day));
    };
    for (const fact of [...factsWithData(state, 'hidden')].reverse()) {
        if (fact.day < oldest || fact.day > day) continue;
        if (fact.data?.hidden !== true || fact.data?.[CAME_TO_LIGHT] !== undefined) continue;
        const killerId = fact.actors.find(a => a.role === 'killer')?.id;
        const victimId = fact.actors.find(a => a.role === 'victim')?.id;
        if (killerId === undefined || victimId === undefined) continue;
        const killer = people.get(killerId);
        const victim = people.get(victimId);
        if (!killer || !victim) continue;
        out.stillHidden++;
        // Never the killer, who can be one of the dead's own people or a senior
        // of their house. Asking, they counted toward it coming out, and when
        // it did they were handed an enemy tie to themselves. Seen as npc-494
        // on `pass-a` at year 110 once every world stood on the written ages.
        const asking = whoIsAskingAbout(state, victim, people, seniors).filter(n => n.id !== killer.id);
        const place = places.get(fact.locationId ?? '') ?? null;
        const chance = whetherItComesOut({
            yearsSince: (day - fact.day) / DAYS_PER_YEAR,
            onOpenGround: isGroundAwayFromEverybody(place),
            asking: asking.length,
            victimOrdinal: victim.cultivation.realmOrdinal
        });
        if (chance <= 0) continue;
        const value = { fact, killer, victim, asking };
        if (isPlayerInvolved(state, killer) || isPlayerInvolved(state, victim)
            || asking.some(person => isPlayerInvolved(state, person))) {
            if (forStream(state.seed, 'what-comes-to-light', fact.id, year).chance(chance)) resolve(value);
        } else background.push({ value, rate: chance });
    }
    for (const row of drawBackgroundIncidents(background, forStream(state.seed, 'background-uncovering', year), 6)) resolve(row);
    return out;
}

