/**
 * A house has three places and eight people who want them.
 *
 * ── THE SELECTION IS THE COMPETITION, NOT A SECOND ONE ───────────────────
 *
 * A conclave already decides who is best among a house's own people, so that IS
 * the selection: `rankAField` is `runCompetition`'s own board, called here on
 * one house's chosen instead of on a circle's. A second "who gets to go" beside
 * it would be a second ranking, and the two would disagree the first time
 * anything about either moved.
 *
 * ── AND EVERYBODY ELSE IS PASSED OVER ────────────────────────────────────
 *
 * Which is the point of a count. At a door with no going anyway there is no
 * consolation and no other road in, so the disciple who came fourth watches
 * three people leave and has a cause a player can see and a person to attach it
 * to. The cause is written as the world writes causes: a goal on the record
 * naming the person who took the place, and a tie moving against them. Both are
 * read downstream by machinery that already exists - `whyTheyStoodUp` reads that
 * tie at the next gathering and decides whether the bout between them is a test
 * or not - so the motive is wired rather than recorded.
 *
 * ── AND ONLY ONE OF THE FOUR DOORS HAS NO GOING ANYWAY ───────────────────
 *
 * That obstacle used to be written unconditionally, and it is true of exactly
 * the cell the door table calls `doled_out`. At the other three nothing at the
 * door hands out a place: the ground has no count on it, or nobody holds it, so
 * the roster is the house's list and not the door's and a person left off it can
 * walk up to the same hole in the hillside. Writing "there is no going anyway"
 * there told the person the one thing that would have stopped them, and it was
 * false - which is the whole of why the trope of somebody going anyway and
 * coming out while the roster does not was not reachable. `whoDecidesWhoGoesIn`
 * is the reading, off the same table, so the two cases are told apart rather
 * than a fifth rule being written about rosters.
 *
 * ── THE SAME MECHANISM STAFFS A POSTING ──────────────────────────────────
 *
 * A place at a door is one opening; a tour at a posting is the same allocation
 * with a term on it. `secondmentsFor` emits exactly the four fields
 * `whoCountsTowardThisHouse` needs, and nothing about the rating changes: a
 * seconded person is 0.9 at the body they stand in and 0.1 at the house that
 * sent them, summing to one. ITS CAVEAT IS THIS CALLER'S TO KEEP - a person may
 * be seconded once at a time, or the conservation needs a divisor - so anybody
 * already out on a tour is not offered a second.
 */

import type { Secondment } from '../../data/cultivation/faction-roll.js';
import type { WhoDecidesWhoGoesIn } from './a-door-with-a-count-on-it.js';
import type { CultivationRNG } from '../cultivation/rng.js';
import { realmForOrdinal, type RealmKey } from '../cultivation/realms.js';
import { rankAField, creditWhatTheyLearned, type GatheringPlacing } from './gatherings.js';
import {
    addGoal,
    relationshipWith,
    upsertRelationship,
    type NpcRecord
} from './npc-state.js';
import { andTheOtherEnd } from './a-tie-has-two-ends.js';
import { NOTHING_LEFT_BUT_TO_END_IT } from './nobody-is-invincible.js';
import { indexById, type WorldState } from './world-state.js';

/**
 * What being passed over is worth against the person who took the place.
 *
 * Short of `NOTHING_LEFT_BUT_TO_END_IT` on its own, and deliberately: one
 * afternoon does not make somebody want you dead. Passed over three times for
 * the same person it does, and a bout between them stops being a test - which
 * is the whole reason the number is stated against that band rather than chosen.
 */
export const WHAT_BEING_PASSED_OVER_COSTS = NOTHING_LEFT_BUT_TO_END_IT / 3;

/** Somebody who is going. */
export interface Going {
    npcId: string;
    name: string;
    place: number;
    bracket: RealmKey;
}

/** Somebody who is not, and who took the place they wanted. */
export interface PassedOver {
    npcId: string;
    name: string;
    place: number;
    /** The last person in, which is the one they measure themselves against. */
    tookItId: string;
    tookItName: string;
}

export interface WhatTheConclaveDecided {
    factionId: string;
    /** The door, or the posting. */
    forWhat: string;
    /**
     * Whether anything at the far end hands the places out. A posting does -
     * a tour is a term somebody is given - so it takes the same answer a
     * counted door takes.
     */
    whoDecides: WhoDecidesWhoGoesIn;
    places: number;
    going: readonly Going[];
    passedOver: readonly PassedOver[];
    /** The board, for the fact and for a harness. */
    placings: readonly GatheringPlacing[];
    summary: string;
}

/**
 * Rank a house's own people for the places it holds, and say who is left out.
 *
 * Null when there is nothing to decide: no places, or no more people wanting
 * them than there are places, in which case everybody goes and nobody is passed
 * over. A conclave with nothing to settle is not held.
 */
export function holdAConclaveForThePlaces(input: {
    state: WorldState;
    factionId: string;
    /** The door or posting these places are at. Named in the goal. */
    forWhat: string;
    /** `whoDecidesWhoGoesIn` off the door's cell. A posting hands them out. */
    whoDecides: WhoDecidesWhoGoesIn;
    places: number;
    wanting: readonly NpcRecord[];
    day: number;
    rng: CultivationRNG;
}): WhatTheConclaveDecided | null {
    const { state, places, wanting, day } = input;
    if (places <= 0 || wanting.length === 0) return null;
    if (wanting.length <= places) return null;

    const placings: GatheringPlacing[] = [];
    const scored = rankAField(state, wanting, input.rng, placings);

    // AND THE CONCLAVE IS TRAINING TOO. The same credit a competition pays,
    // because it is the same afternoon: people who stood up against people
    // better than them. Paid to everybody who stood, including the ones who
    // then do not go.
    creditWhatTheyLearned(state, placings, day);

    const byId = new Map(placings.map(p => [p.npcId, p]));
    const order = scored.map(s => s.npc);
    const going: Going[] = [];
    const passedOver: PassedOver[] = [];
    const lastIn = order[places - 1] ?? null;

    for (let i = 0; i < order.length; i++) {
        const npc = order[i]!;
        // Every entrant is placed by construction - `rankAField` pushes one row
        // per person it ranks - and the fallback is the pooled order rather
        // than a throw, because a conclave that cannot report a place is still
        // a conclave that decided who goes.
        const row = byId.get(npc.id);
        if (i < places) {
            going.push({
                npcId: npc.id,
                name: npc.name,
                place: row?.place ?? i + 1,
                bracket: row?.bracket ?? realmForOrdinal(npc.cultivation.realmOrdinal).key
            });
            continue;
        }
        if (lastIn === null) continue;
        passedOver.push({
            npcId: npc.id,
            name: npc.name,
            place: row?.place ?? i + 1,
            tookItId: lastIn.id,
            tookItName: lastIn.name
        });
    }

    return {
        factionId: input.factionId,
        forWhat: input.forWhat,
        whoDecides: input.whoDecides,
        places,
        going,
        passedOver,
        placings,
        summary: `${wanting.length} stood for ${places} places at ${input.forWhat}. `
            + `${going.map(g => g.name).join(', ')} go. `
            + `${passedOver.length} do not.`
    };
}

/**
 * What each person passed over does about it.
 *
 * Returns one line per person, so a harness asking "and what did they do" gets
 * an answer rather than a count. A run where this comes back empty is a run
 * where the motive is not wired.
 */
export function whatBeingPassedOverDoes(
    state: WorldState,
    decided: WhatTheConclaveDecided,
    day: number
): string[] {
    const said: string[] = [];
    for (const person of decided.passedOver) {
        const at = indexById(state.npcs, person.npcId);
        if (at < 0) continue;
        let npc = state.npcs[at]!;

        const held = relationshipWith(npc, person.tookItId);
        const standing = Math.max(-1, Math.min(1,
            (held?.standing ?? 0) + WHAT_BEING_PASSED_OVER_COSTS));
        npc = upsertRelationship(npc, {
            targetId: person.tookItId,
            targetName: person.tookItName,
            kind: held?.kind ?? 'rival',
            standing,
            note: held?.note ?? `Took the place at ${decided.forWhat}.`,
            factIds: held?.factIds ?? [],
            inheritedFromId: held?.inheritedFromId ?? null
        }, day);
        andTheOtherEnd(state.npcs, npc, { targetId: person.tookItId, kind: 'rival', standing: 0 }, day);

        // ONE GOAL PER DOOR, not one per year. Somebody passed over three times
        // for the same place is one ambition getting older, and stacking rows
        // would read as three unrelated people wanting three unrelated things.
        const already = npc.goals.some(g =>
            g.status === 'active' && g.targetId === person.tookItId
            && g.text.includes(decided.forWhat));
        if (!already) {
            npc = addGoal(npc, {
                kind: 'status',
                text: `Be the one who goes to ${decided.forWhat}.`,
                priority: 0.7,
                targetId: person.tookItId,
                obstacles: [
                    `${person.tookItName} placed ${person.place - 1} places higher.`,
                    decided.whoDecides === 'a_house_hands_them_out'
                        ? 'There is no going anyway. The house hands the places out.'
                        : 'Nothing at the door hands out a place. The house chose who it '
                            + 'sends, and the door did not.'
                ],
                note: `Passed over at ${decided.forWhat}, placed ${person.place}.`
            }, day);
        }

        state.npcs[at] = npc;
        said.push(standing <= NOTHING_LEFT_BUT_TO_END_IT
            ? `${person.name} has been passed over for ${person.tookItName} once too often`
            : `${person.name} holds it against ${person.tookItName}`);
    }
    return said;
}

/**
 * Turn a deal into the rows the faction rating counts.
 *
 * `alreadyOut` is the caveat kept: somebody standing at one posting is not
 * offered a second, because two secondments for one person would count them
 * 0.9 twice and the conservation the rating rests on would need a divisor
 * nobody has written.
 */
export function secondmentsFor(input: {
    postingFactionId: string;
    /** Per sending house, the people it is sending. Already chosen. */
    sending: readonly { factionId: string; people: readonly NpcRecord[] }[];
    alreadyOut?: ReadonlySet<string>;
}): Secondment[] {
    const out: Secondment[] = [];
    const seen = new Set(input.alreadyOut ?? []);
    for (const house of input.sending) {
        if (house.factionId === input.postingFactionId) continue;
        for (const person of house.people) {
            if (seen.has(person.id)) continue;
            seen.add(person.id);
            out.push({
                personId: person.id,
                realmOrdinal: person.cultivation.realmOrdinal,
                postingFactionId: input.postingFactionId,
                sendingFactionId: house.factionId
            });
        }
    }
    return out;
}
