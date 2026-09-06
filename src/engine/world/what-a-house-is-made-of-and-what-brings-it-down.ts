/**
 * WHAT A HOUSE IS MADE OF, AND WHAT BRINGS IT DOWN.
 *
 * The design owner, in one thread:
 *
 *     "you might also wreck the buildings too"
 *     "for simplicity just put every building at ordinal 29 (assume they're
 *      made of ordinary materials)"
 *     "and a sect can construct their own formation [...] which depends on who
 *      made it [...] on top of all their buildings"
 *     "so a declaration at a sect at ordinal 44 might actually be flattening
 *      their buildings"
 *     "and then they'd have to pay spirit stones and rebuild"
 *     "if you can actually flatten a sect they might beg you to stay your hand"
 *
 * ── THREE LAYERS, OUTERMOST FIRST ────────────────────────────────────────
 *
 * A seat is not one number. It is a stack, and which layer stops you is the
 * whole of what happens next:
 *
 *   THE FORMATION   what the house raised over the whole compound. Its rung is
 *                   NOT a property of the house - it is the lower of the art
 *                   and the builder, less what imperfect mastery costs, which
 *                   `a-formation-stands-at-the-lower-of-the-art-and-the-
 *                   builder.ts` has decided since it was written. A house that
 *                   never had anybody who could raise one has none, and its
 *                   walls are the first thing you meet.
 *   THE BUILDINGS   ordinary materials, and therefore all of them the same.
 *                   See {@link WHAT_ORDINARY_MATERIALS_STAND_AT}.
 *   WHAT IS INSIDE  the treasury, which is the house's own and not anybody's
 *                   pocket. See `a-house-holds-its-own.ts`.
 *
 * ── WHY THE BUILDINGS ARE ONE NUMBER, AND IT IS A CHOICE ─────────────────
 *
 * Stone is stone. A hall raised by a house at the top of the ladder is bigger
 * and better cut than a village shrine, and it is made of the same rock: what
 * makes a great house hard to knock down is the FORMATION over it and the
 * people inside it, not the masonry. Rating the masonry per house would say the
 * opposite - that a powerful house's walls are themselves powerful - and would
 * quietly make the formation redundant.
 *
 * So one number for every building in the world, and everything that varies is
 * carried by the layer that should carry it.
 *
 * ── AND THE INTERESTING CASE IS THE ONE IN THE MIDDLE ────────────────────
 *
 * Somebody who beats the formation and not the buildings has opened the
 * compound and cannot flatten it. Somebody who beats the buildings and not the
 * formation has done nothing at all and is standing outside a ward. Both are
 * real outcomes and neither is a failure; the shape of a siege is the gap
 * between the two numbers.
 */

import { formationsStandingAt } from './a-formation-stands-at-the-lower-of-the-art-and-the-builder.js';
import { effectiveWardOrdinal } from './how-far-gone-a-formation-is.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import type { ObjectRecord } from './possessions.js';

/**
 * What a building made of ordinary materials stands at.
 *
 * The design owner's own figure and his own reason: *"for simplicity just put
 * every building at ordinal 29 (assume they're made of ordinary materials)"*.
 *
 * It is high, and that is right. Twenty-nine is well inside Nascent Soul, which
 * is to say that a competent cultivator cannot knock a hall down by hitting it
 * - buildings are not made of paper, and the great majority of people who will
 * ever be angry at a house cannot touch its walls. What it is NOT is a defence
 * against somebody at the top of the ladder, and that is the point: the number
 * is a floor under the world's masonry, not a wall around a house.
 */
export const WHAT_ORDINARY_MATERIALS_STAND_AT = 29;

/** Which layer stopped somebody, or none. */
export type WhatStoppedThem =
    /** The ward over the compound held. Nothing inside was touched. */
    | 'the_formation'
    /** No ward, or it gave, and the walls did not. */
    | 'the_buildings'
    /** Nothing held. The seat comes down. */
    | 'nothing';

export interface WhatAHouseIsMadeOf {
    /**
     * The rung the house's own ward answers at TODAY, or null where it has none.
     *
     * Read off the formation objects standing on the ground rather than off any
     * field of the house, because that is where the answer lives: a ward is a
     * made thing that stands where it was made, and who made it decides its
     * rung.
     *
     * AND IT IS THE RUNG IT ANSWERS AT, NOT THE RUNG IT WAS SET AT.
     * `effectiveWardOrdinal` already models a ward thinning with the years, and
     * a house's compound is exactly the case it was written for: *an ancient
     * site set by somebody enormous can be opened by ordinary people while a
     * fresh one set by a merely competent person cannot.* So a house that
     * raised something magnificent nine hundred years ago and has let it go is
     * softer than a house that laid a modest one last decade, which is the
     * reason a house keeps paying for upkeep.
     */
    formationStandsAt: number | null;
    /** What it was set at, before the years took any of it. */
    formationWasSetAt: number | null;
    /** The name of the ward, for a line that can say what stopped somebody. */
    formationName: string | null;
    /** Always {@link WHAT_ORDINARY_MATERIALS_STAND_AT}. Named, not assumed. */
    buildingsStandAt: number;
    /**
     * The whole of what somebody has to beat to bring the seat down: the higher
     * of the two, because the ward is OVER the buildings and both have to give.
     */
    theWholeSeatStandsAt: number;
}

/**
 * What is standing over this house's ground, read off the ground.
 */
export function whatAHouseIsMadeOf(
    objects: readonly ObjectRecord[],
    locationId: string | null,
    today: number
): WhatAHouseIsMadeOf {
    const wards = locationId === null ? [] : formationsStandingAt(objects, locationId);

    // The best one ANSWERING. A compound with two wards is protected by
    // whichever is still worth more today, which is not necessarily whichever
    // was more impressive when it was laid.
    let best: { answersAt: number; setAt: number; name: string } | null = null;
    for (const ward of wards) {
        const setAt = Number(ward.data?.ratedWhole ?? ward.power ?? 0);
        if (!(setAt > 0)) continue;
        const raisedOn = Number(ward.data?.raisedOnDay ?? 0);
        const answersAt = effectiveWardOrdinal({
            setByOrdinal: setAt,
            yearsSince: Math.max(0, (today - raisedOn) / DAYS_PER_YEAR)
        });
        // A ward entirely gone is not a ward. `how-far-gone-a-formation-is.ts`
        // says what it is instead - *a wall, and a wall is still something a
        // person has to climb* - and a wall is the buildings, which are counted
        // one line down and must not be counted twice here.
        if (answersAt <= 0) continue;
        if (best === null || answersAt > best.answersAt) {
            best = { answersAt, setAt, name: ward.name };
        }
    }

    return {
        formationStandsAt: best?.answersAt ?? null,
        formationWasSetAt: best?.setAt ?? null,
        formationName: best?.name ?? null,
        buildingsStandAt: WHAT_ORDINARY_MATERIALS_STAND_AT,
        theWholeSeatStandsAt: Math.max(
            best?.answersAt ?? 0,
            WHAT_ORDINARY_MATERIALS_STAND_AT
        )
    };
}

export interface WhatBringingItDownWouldTake {
    seat: WhatAHouseIsMadeOf;
    /** Where the person threatening it stands. */
    theirReach: number;
    stoppedBy: WhatStoppedThem;
    /** They could open the compound: past the ward, whatever else follows. */
    couldGetIn: boolean;
    /** They could actually flatten it. The sentence that changes everything. */
    couldFlattenIt: boolean;
    /** How many rungs short they are of the layer that stops them, or 0. */
    rungsShort: number;
    /** Engine truth, one line. Never narration. */
    account: string;
}

/**
 * What it would take this person to bring this seat down, and what stops them.
 *
 * A READ AND NOT AN ACT. Nothing here knocks anything over: this is the
 * question a house asks about somebody standing outside it, and the question a
 * player's declaration has to be weighed against. What makes a threat mean
 * anything is that this can come back `couldFlattenIt`.
 */
export function whatBringingItDownWouldTake(input: {
    seat: WhatAHouseIsMadeOf;
    theirReach: number;
}): WhatBringingItDownWouldTake {
    const reach = Math.max(0, input.theirReach);
    const ward = input.seat.formationStandsAt;
    const walls = input.seat.buildingsStandAt;

    // THE WARD FIRST, BECAUSE IT IS OVER EVERYTHING. Somebody who cannot pass
    // it has not reached the buildings at all, however hard they hit.
    if (ward !== null && reach < ward) {
        return {
            seat: input.seat,
            theirReach: reach,
            stoppedBy: 'the_formation',
            couldGetIn: false,
            couldFlattenIt: false,
            rungsShort: ward - reach,
            account:
                `${input.seat.formationName ?? 'The ward'} stands at ${ward} and they reach `
                + `${reach}. They are ${ward - reach} rung(s) short of the ward and have not `
                + 'reached the buildings at all.'
        };
    }

    if (reach < walls) {
        return {
            seat: input.seat,
            theirReach: reach,
            stoppedBy: 'the_buildings',
            couldGetIn: true,
            couldFlattenIt: false,
            rungsShort: walls - reach,
            account:
                `${ward === null ? 'Nothing is warded' : 'The ward is passed'} and the walls are `
                + `not: ordinary materials stand at ${walls} and they reach ${reach}. They can `
                + 'get in and cannot bring it down.'
        };
    }

    return {
        seat: input.seat,
        theirReach: reach,
        stoppedBy: 'nothing',
        couldGetIn: true,
        couldFlattenIt: true,
        rungsShort: 0,
        account:
            `Nothing here stops them: ${ward === null ? 'no ward' : `ward at ${ward}`}, walls at `
            + `${walls}, and they reach ${reach}. The seat comes down if they want it to.`
    };
}

/**
 * What a house would do about somebody who can actually flatten it.
 *
 * The owner: *"if you can actually flatten a sect they might beg you to stay
 * your hand."* That is not politeness and it is not a difficulty setting. A
 * body that can be ended by one person has exactly one move, and it is the one
 * every institution in history has made in that position.
 *
 * DERIVED FROM THE READ ABOVE AND NOTHING ELSE. A house does not sue for peace
 * because somebody is frightening; it sues because the arithmetic says the seat
 * comes down. A house that can only be got into fights, because being robbed is
 * survivable and being ended is not.
 */
export type WhatTheHouseDoesAboutIt =
    /** Nothing. They cannot reach it and everybody knows. */
    | 'ignores_it'
    /** They can get in. That is a matter for the guard, not for the seat. */
    | 'answers_it'
    /** They can end it. The house asks what it would take. */
    | 'sues_for_peace';

export function whatAHouseDoesAboutSomebodyWhoCanEndIt(
    reading: WhatBringingItDownWouldTake
): WhatTheHouseDoesAboutIt {
    if (reading.couldFlattenIt) return 'sues_for_peace';
    return reading.couldGetIn ? 'answers_it' : 'ignores_it';
}
