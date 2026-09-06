/**
 * A HOUSE KNOWS ITS OWN BY A PLATE AND A TOKEN.
 *
 * The design owner: *"life plates should [exist]"*, *"identity slips should be
 * an item you have by default as anything higher than outer disciple
 * inclusive"*, *"the life plates live in the central sect hall of course"*,
 * *"basically if you die your life plate shatters, the sect knows you died and
 * your identity medallion disintegrates"*, *"but identity medallions to prove
 * identity should be part of trust"*, *"if we have nothing then rebuild it."*
 *
 * ── WE HAD THE DESIGN AND NONE OF THE MACHINERY ──────────────────────────
 *
 * `docs/world/houses/trust.md` carries the whole thing under its own heading -
 * *"Tokens shatter, so somebody has to be taken alive"* - and states every
 * consequence: a house keeps a plate for each disciple and it shatters when
 * they die, the disciple's own token goes with them, you cannot take a working
 * token off a corpse, a house knows the instant one of its own dies, and a
 * disciple missing while their plate is still whole is the signature of a
 * captive rather than a casualty.
 *
 * Measured before this file: `'token'` existed as one value of `ObjectKind` and
 * NOTHING in the engine ever created one. Not a plate, not a tag, not an issue,
 * not a shatter. The doctrine that catches exactly this is the one the ratchet
 * enforces - a rule pinned but never reached by the game looks maintained and
 * is not - and here it was a document rather than an export.
 *
 * ── WHY THE SHATTERING IS THE LOAD-BEARING PART ──────────────────────────
 *
 * It is not flavour and the document says why. Because the token dies with its
 * holder, the obvious route to a stolen identity - kill somebody and take their
 * proof - DOES NOT EXIST. So an identity has to be taken alive and kept alive,
 * which converts a clean killing into an ongoing crime with a living victim, a
 * place they are being held, and somebody who can be rescued.
 *
 * That is a better thing for a world to contain than a body in a ditch, and it
 * is the whole reason this is built the way it is rather than as a flag.
 *
 * ── AND THE TAG AUTHENTICATES THE LINE, NOT THE PERSON ───────────────────
 *
 * A genuine tag in the wrong hands still reads as *a member of that house*. It
 * answers the question a gate asks and leaves the individual wide open, which
 * is the seam somebody would actually work. Nothing here closes it, because it
 * is not a defect: verifying the OBJECT is a perceptual question and verifying
 * that this is the person it was issued to is not a question the object can
 * answer at all.
 */

import { makeObject, type ObjectRecord } from './possessions.js';

/**
 * The rung at which a house issues one.
 *
 * The design owner: *"anything higher than outer disciple inclusive."* Index
 * rather than a name, because every house names its rungs differently and the
 * ladder is a house's own - what they share is that the bottom rung is servants
 * and hangers-on, and the first rung that is a DISCIPLE is where a house starts
 * putting its name on somebody.
 */
export const THE_RUNG_A_HOUSE_ISSUES_AT = 1;

/** Whether somebody at this rung carries their house's token. */
export function carriesATokenAt(rankIndex: number): boolean {
    return rankIndex >= THE_RUNG_A_HOUSE_ISSUES_AT;
}

/** The room a house keeps its plates in. Its own hall, at the inner end. */
export const WHERE_THE_PLATES_HANG = 'ancestral_hall';

/** Deterministic ids, so a plate and its token can always find each other. */
export function plateIdFor(memberId: string): string {
    return `life-plate-${memberId}`;
}

export function tokenIdFor(memberId: string): string {
    return `identity-token-${memberId}`;
}

/**
 * The token somebody carries, and the plate that answers for them.
 *
 * TWO OBJECTS AND NOT ONE, because they are in two places and that is the
 * entire mechanism: the token is on the person, wherever they have got to, and
 * the plate is on the wall in a hall a province away. A house learns from the
 * plate; everybody else reads the token.
 */
export function issueTo(input: {
    memberId: string;
    memberName: string;
    houseId: string;
    houseName: string;
    /** The hall the plates hang in, or the seat where a house has no hall. */
    plateRoomId: string | null;
    onDay: number;
}): { token: ObjectRecord; plate: ObjectRecord } {
    const token = makeObject({
        id: tokenIdFor(input.memberId),
        name: `${input.houseName} identity token`,
        kind: 'token',
        // Tracked, because the whole point of it is that somebody can ask whose
        // it is and where it has been. A counted token would be a token nobody
        // could cancel.
        significance: 'notable',
        description:
            `A jade tag with ${input.houseName} cut into it, issued to ${input.memberName}. It `
            + 'answers for the house rather than for the person: it says which house, and it '
            + 'does not say which member.',
        possessorId: input.memberId,
        // THE HOUSE'S, NEVER THE MEMBER'S. Issued rather than given, which is
        // why a house can cancel one and why leaving means handing it back.
        ownerId: input.houseId,
        ownerName: input.houseName,
        power: null,
        locationId: null,
        tags: ['identity', 'issued', `house:${input.houseId}`, `member:${input.memberId}`],
        data: { memberId: input.memberId, issuedOnDay: input.onDay }
    });

    const plate = makeObject({
        id: plateIdFor(input.memberId),
        name: `the life plate of ${input.memberName}`,
        kind: 'token',
        significance: 'notable',
        description:
            `A plate on the wall of the ${input.houseName} hall, cut for ${input.memberName}. It `
            + 'is whole while they are, and it is the first thing anybody looks at when somebody '
            + 'stops answering.',
        // NOBODY CARRIES A PLATE. It hangs where it hangs, which is what makes
        // it evidence a house holds rather than a thing that can be lost with
        // the person it answers for.
        possessorId: null,
        ownerId: input.houseId,
        ownerName: input.houseName,
        power: null,
        locationId: input.plateRoomId,
        tags: ['life-plate', `house:${input.houseId}`, `member:${input.memberId}`],
        // No `whole` field. A plate's wholeness is its holder's aliveness,
        // which is one fact and is asked of the person - see `whatThePlateSays`.
        data: { memberId: input.memberId, hungOnDay: input.onDay }
    });

    return { token, plate };
}

/** What a house reads off a plate. */
export type WhatThePlateSays =
    /** Whole. They are alive, wherever they are. */
    | 'they_live'
    /** Shattered. They are dead, and the house learned it the moment it broke. */
    | 'they_are_dead';

/**
 * WHAT THE PLATE SAYS, DERIVED FROM THE PERSON AND NOT STORED ON THE PLATE.
 *
 * A first cut stored `whole` on the row and wrote it at death. That is the
 * second copy of a fact this repo's doctrine forbids, and the reason is not
 * theoretical: `markDead` is called from SIX places across four files, so a
 * stored flag is six chances to forget, and the one that forgot would leave a
 * whole plate hanging for a dead disciple - which is precisely the signature
 * the world uses to mean *somebody is holding them prisoner*. The bug would not
 * read as a bug. It would read as a kidnapping.
 *
 * A plate's wholeness IS its holder's aliveness. One fact. So it is asked of
 * the person, every time, and there is nothing to write, nothing to migrate,
 * and no call site that can miss it.
 */
export function whatThePlateSays(holderIsAlive: boolean): WhatThePlateSays {
    return holderIsAlive ? 'they_live' : 'they_are_dead';
}

/**
 * Whether the token in somebody's hand is a working one.
 *
 * Derived from the same single fact, for the same reason. *"You cannot take a
 * working token off a corpse"* is not a rule anybody enforces at a call site -
 * it is what this function returns, and a caller that reads it cannot get it
 * wrong.
 */
export function theTokenStillAnswers(holderIsAlive: boolean): boolean {
    return holderIsAlive;
}

/**
 * How a plate and a token read once their holder is gone, for prose.
 *
 * Nothing is written. These are the words for a state the world is already in,
 * so a shattered plate needs no shattering pass and a dead disciple's token is
 * dust from the moment they die rather than from the moment somebody
 * remembered to write it down.
 */
export function whatIsLeftOfThem(input: {
    holderIsAlive: boolean;
    holderName: string;
}): { plate: string; token: string } | null {
    if (input.holderIsAlive) return null;
    return {
        plate: `The life plate of ${input.holderName} is in pieces on the floor of the hall, `
            + 'and everybody who was in the room when it went knows what it means.',
        token: 'Dust. It went when its holder did, which is why nobody has ever taken a working '
            + 'one off a corpse.'
    };
}

/**
 * WHOLE PLATE, AND NOBODY HAS SEEN THEM. The signature of a captive.
 *
 * The document's own reading and the reason the plate is worth keeping: a house
 * that knows somebody LIVES and knows they are not answering is looking at
 * something quite different from a death, and it is the state that sends the
 * posters out. A shattered plate closes a question; a whole one on somebody
 * nobody can find opens a worse one.
 */
export function whatAHouseMakesOfSilence(input: {
    /** False where this house never issued them one. */
    theyHaveAPlate: boolean;
    holderIsAlive: boolean;
    daysSinceAnybodySawThem: number;
}): 'nothing_yet' | 'they_are_dead' | 'somebody_has_them' {
    if (!input.theyHaveAPlate) return 'nothing_yet';
    if (whatThePlateSays(input.holderIsAlive) === 'they_are_dead') return 'they_are_dead';
    return input.daysSinceAnybodySawThem >= WHEN_SILENCE_BECOMES_A_CAPTIVE
        ? 'somebody_has_them'
        : 'nothing_yet';
}

/**
 * How long somebody has to be unaccounted for before a whole plate is read as a
 * captivity rather than an errand.
 *
 * A season. Long enough that ordinary business does not raise it and short
 * enough that a house is not the last to know.
 */
export const WHEN_SILENCE_BECOMES_A_CAPTIVE = 90;

// ═════════════════════════════════════════════════════════════════════════
// AND WHOSE JOB IT IS
// ═════════════════════════════════════════════════════════════════════════

/**
 * THE KEEPER OF THE ROLL.
 *
 * The design owner: *"when you join, an identity plate and token get created
 * for you - that's another elder's job"*, *"idk, give him a name, a role."*
 *
 * So it is an office, and this repo already decides what an office IS: a SEALED
 * ROOM dealt to a decider by `whoIsInChargeOfWhat`. There is no title table
 * anywhere and adding one would be a second way of saying who is in charge of
 * what. The armoury elder is whoever holds the armoury; the Keeper of the Roll
 * is whoever holds the room the plates hang in.
 *
 * WHICH IS WHY THE NAME IS THE ROOM'S AND NOT A PERSON'S. Nobody is appointed
 * Keeper of the Roll in this engine. Somebody holds the hall, and holding it is
 * what makes them the person a new disciple is sent to - and what makes losing
 * it a demotion that costs them something specific rather than face.
 */
export const THE_KEEPER_OF_THE_ROLL = 'Keeper of the Roll';

/**
 * What the office is, said as the room it is held over.
 *
 * `whoAnswersAbout(portfolios, THE_ROOM_THE_ROLL_IS_KEPT_IN)` is the whole
 * lookup - the same call the punishment hall and the treasury already use.
 */
export const THE_ROOM_THE_ROLL_IS_KEPT_IN = WHERE_THE_PLATES_HANG;
