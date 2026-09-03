/**
 * What being inside something is worth, and it is not a bonus.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE QUESTION, AND THE ANSWER IS ALREADY IN THE ENGINE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner:
 *
 *   > if you're inside a spirit boat, you are now much safer than if you were
 *   > not. you can still die, but being inside a boat means structurally you
 *   > are safer right? find reasons for this derived not bespoke.
 *
 * The reason is `canUnmake`, and there is nothing else in this file.
 *
 * A hull is a rated thing. `whether-a-weapon-survives-being-used.ts` says a
 * force below a thing's rung does not have a bad chance of getting through it -
 * IT HAS NO CHANCE, absolutely and with no probability anywhere, because
 * nobody unmakes what they could not have made. Put that hull between somebody
 * and what is coming for them and the same sentence reads as shelter:
 *
 *     A hull rated 29 stands between whoever is inside it and everybody
 *     below rung 29. Not statistically. Categorically.
 *
 * So SHELTERING IS NOT A SAFETY BONUS. It is the object gate, read with the
 * object in the way. There is no cover stat, no damage reduction, no
 * boat-shaped case, and no second arithmetic - this file computes nothing at
 * all. It calls `canUnmake` and says what the answer means for whoever is
 * behind it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * IT COVERS FOUR THINGS AND KNOWS ABOUT NONE OF THEM
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A hull with passengers, a vault with objects in it, a hall with a house
 * inside it, a formation with a compound behind it. All four are a rated thing
 * with something behind it, and {@link whatGettingPastItTakes} answers for all
 * four off the same field. `ThingUnderForce` carries no `ObjectKind`, so there
 * is no line here that could tell a hull from a vault even if somebody wanted
 * one - the same enforcement `object-damage.ts` uses, for the same reason.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THIS IS NOT A SECOND OPINION ABOUT A DOOR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `how-far-gone-a-formation-is.ts` already owns *the odds a claimant at this
 * rung gets through this door*, and calls itself THE ONE NUMBER for it. It is
 * not this, and the two must not be collapsed:
 *
 *   THAT ONE      somebody WORKING AT a door: a prospector at a sealed ruin, an
 *                 intruder at a closed-door seclusion. Time, tools, patience and
 *                 a formation that has been decaying for centuries. It is a
 *                 logistic on the gap and *being well under it is small but
 *                 never nil*, because somebody weak occasionally gets into
 *                 something old and that case is where half the interesting
 *                 things in this world come from.
 *
 *   THIS ONE      FORCE PUT THROUGH a rated thing, now. No time, no tools, no
 *                 decay clock. It is `canUnmake` and it is absolute.
 *
 * The difference is real rather than a seam: you can pick a lock you could
 * never punch through, and the reason a besieging army does not simply walk in
 * is not the reason a lone prospector fails. If a caller wants the patient
 * version, it wants that module and not this one. Neither reads the other.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE DEGRADATION IS FREE, AND THAT IS THE POINT OF WRITING `power` DOWN
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A holed hull is rated one rung lower - `object-damage.ts` writes the loss to
 * `power` rather than shadowing it - so it shelters one rung less, and it does
 * so here with no code. Hole a 29 twice and everybody at 27 can now get at what
 * is inside. A hull worn down over a long siege lets the world in gradually,
 * and nobody wrote a siege mechanic.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE OPENINGS, BECAUSE A DEFENCE THAT ZEROES NEEDS THEM NAMED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * AGENTS.md is explicit that nothing in this world is invincible and that every
 * defence has a window, a cost or a condition. This one categorically stops
 * everything under a rung, so the openings are load-bearing and all four are
 * structural rather than tuned:
 *
 *   THE SHELTER IS ITSELF A THING. Anybody at its rung ends it, and every hole
 *   they put in it lowers the bar for the next person. It is on the ordinary
 *   object table and it breaks the ordinary way.
 *
 *   IT STOPS NOTHING THAT IS INSIDE IT WITH YOU. The hull is between a force
 *   and a passenger only while the force is outside, and {@link Standing} is
 *   the caller stating which. A boarding party is not blocked by the deck they
 *   are standing on - so the answer to a hull you cannot break is to get on it,
 *   which is the genre's own answer and needs no rule.
 *
 *   BEING INSIDE SOMETHING IS BEING SOMEWHERE. A shelter is a place: it hides
 *   nobody, it does not move on its own, and somebody who will not come out can
 *   be waited out. `what-a-sea-crossing-costs.ts` already prices what being
 *   aboard costs in water, food and days, and none of that stops for a siege.
 *
 *   IT DOES NOT MAKE ANYBODY STRONGER. A passenger prices out as exactly the
 *   cultivator they are. Take the hull away and there is no residue anywhere,
 *   which is AGENTS.md's own test for whether a piece of lore is bespoke.
 *
 * PURE. No state, no rolls, no I/O. Same inputs, same answer.
 */

import { canUnmake, type UnmakingReach } from '../cultivation/whether-a-weapon-survives-being-used.js';
import {
    UNRATED_STANDS_AT,
    isInert,
    scarsOn,
    type ForceApplied,
    type ThingUnderForce
} from './object-damage.js';
// ═════════════════════════════════════════════════════════════════════════
// WHERE THE FORCE IS
// ═════════════════════════════════════════════════════════════════════════

/**
 * Whether the thing is between them or not.
 *
 * The caller always knows this and the engine cannot: it is the difference
 * between a fleet firing on a hull and a boarding party already on the deck,
 * and between a siege outside a compound wall and a traitor inside it. Stated
 * rather than inferred, because inferring it would mean this file having an
 * opinion about geometry it does not have.
 */
export type Standing =
    /** Outside it. The thing is in the way and this file has something to say. */
    | 'outside'
    /** Inside it, or already past it. Nothing is between them. */
    | 'past it';

// ═════════════════════════════════════════════════════════════════════════
// THE READING
// ═════════════════════════════════════════════════════════════════════════

export interface ShelterReading {
    /** The gate, unwrapped, so a caller can show the same sentence. */
    through: UnmakingReach;
    /** Whether whatever is behind it can be got at at all. */
    reachesThem: boolean;
    /** The rung it shelters at now, holes already taken off. */
    standsAt: number;
    /** Holes it is carrying. Each one has already cost it a rung. */
    scars: number;
    /** True when it is no longer a shelter at all: ended, or the qi gone. */
    spent: boolean;
    /**
     * Whether being inside it hides anybody. Always false, and it is a field
     * rather than a comment because a caller narrating shelter will otherwise
     * imply concealment and the two are not the same thing.
     */
    hidesThem: boolean;
    /** Engine-authored. Names the rung, and what it does not do. */
    account: string;
}

/**
 * What getting at whoever is behind this would take.
 *
 * Reports; decides nothing, rolls nothing. A caller may ask before committing
 * to anything, which is what every other gated system in this engine allows and
 * what a player standing on a deck watching somebody approach is owed.
 *
 * Note what the criterion is: THE GATE, not the breaking. Somebody standing at
 * the hull's own rung can get through it whether or not the hull ends in the
 * process - reaching it and unmaking it are the same permission, and what
 * happens to the hull on the way is `whatBecomesOfIt`'s separate answer.
 */
export function whatGettingPastItTakes(
    shelter: ThingUnderForce,
    force: Pick<ForceApplied, 'ordinal' | 'byName'>,
    standing: Standing = 'outside'
): ShelterReading {
    // `isRuined` and `isInert` are the two stored marks, read here rather than
    // inferred from a null rating: a thing can stand at nothing and still be an
    // object, and only the tag says which of the two happened to it.
    const spent = shelter.tags.includes('ruined') || isInert(shelter);
    const standsAt = shelter.power ?? UNRATED_STANDS_AT;
    const scars = scarsOn(shelter);
    const through = canUnmake(force.ordinal, standsAt);

    if (standing === 'past it') {
        return {
            through,
            reachesThem: true,
            standsAt,
            scars,
            spent,
            hidesThem: false,
            account: `${shelter.name} is not between them. Nothing that is inside a thing with `
                + 'you is kept off you by it, which is why the answer to a hull nobody can break '
                + 'is to get onto it.'
        };
    }

    if (spent) {
        return {
            through,
            reachesThem: true,
            standsAt,
            scars,
            spent,
            hidesThem: false,
            account: `${shelter.name} is not standing between anybody and anything any more. `
                + 'The record of it stands; it does not.'
        };
    }

    const reachesThem = through.reaches;
    return {
        through,
        reachesThem,
        standsAt,
        scars,
        spent,
        hidesThem: false,
        account: reachesThem
            ? `${shelter.name} stands at ${standsAt}, and ${force.byName || 'what is coming'} `
              + `reaches ${standsAt}. It is in the way and it is not a wall: whoever is behind `
              + 'it can be got at, and the thing itself pays for the getting.'
            : `${shelter.name} stands at ${standsAt}. ${through.cause} Whoever is behind it `
              + 'cannot be reached from out here at all - not unlikely, not at long odds. '
              + 'They are still findable, still somewhere, and still have to come out.'
            + (scars > 0
                ? ` It is carrying ${scars} hole${scars === 1 ? '' : 's'}, and each one has `
                  + 'already cost it a rung of that.'
                : '')
    };
}

// ═════════════════════════════════════════════════════════════════════════
// AND WHAT IS BEHIND IT
// ═════════════════════════════════════════════════════════════════════════

export interface WhatIsBehindIt<T> {
    reading: ShelterReading;
    /** Reached, because the thing in the way did not stop this. */
    reached: T[];
    /** Not reached, and the reason is one sentence long. */
    kept: T[];
}

/**
 * Split what is behind a thing into what this force gets at and what it does not.
 *
 * ONE FUNCTION FOR TWO SITUATIONS THAT LOOK LIKE OPPOSITES. Passengers behind a
 * hull and objects inside a vault are the same shape - a rated thing with
 * something behind it - and the difference is entirely in what the caller
 * passes as `T`. A vault that comes apart takes what is in it; a hull that is
 * got past exposes who is in it. Neither needed a mechanic.
 *
 * All or nothing on purpose. The gate is absolute in both directions, so there
 * is no partial credit to hand out and nothing here to tune: what is behind an
 * intact shelter is behind it entirely, and once a force is through, everything
 * that was behind it is in front of it.
 */
export function whatIsBehindIt<T>(
    shelter: ThingUnderForce,
    force: Pick<ForceApplied, 'ordinal' | 'byName'>,
    behind: readonly T[],
    standing: Standing = 'outside'
): WhatIsBehindIt<T> {
    const reading = whatGettingPastItTakes(shelter, force, standing);
    return reading.reachesThem
        ? { reading, reached: [...behind], kept: [] }
        : { reading, reached: [], kept: [...behind] };
}

/**
 * The best thing standing between them and it, or null for nothing at all.
 *
 * Highest rung wins and they do not stack, which is the same ruling
 * `bestObjectHeldBy` makes about weapons and for the same reason: summing two
 * would invent a rule. A compound behind a formation behind a wall is sheltered
 * at whichever of the three stands highest, and getting past that one is
 * getting in.
 */
export function bestShelterAmong(
    shelters: readonly ThingUnderForce[]
): ThingUnderForce | null {
    let best: ThingUnderForce | null = null;
    for (const s of shelters) {
        if (s.tags.includes('ruined') || isInert(s)) continue;
        const rung = s.power ?? UNRATED_STANDS_AT;
        if (rung <= 0) continue;
        if (best === null || rung > (best.power ?? UNRATED_STANDS_AT)) best = s;
    }
    return best;
}
