/**
 * A HOUSE KNOWS ITS OWN BY A PLATE AND A TOKEN.
 *
 * `docs/world/houses/trust.md` has carried this design under its own heading
 * since it was written - a house keeps a plate for each disciple, it shatters
 * when they die, and the disciple's token goes with them. Measured before this
 * file: `'token'` was a value of `ObjectKind` that nothing in the engine ever
 * created. The design record and the machinery had no connection at all.
 *
 * THE SHATTERING IS THE LOAD-BEARING PART. Because the token dies with its
 * holder, the obvious route to a stolen identity - kill somebody and take their
 * proof - does not exist. An identity has to be taken ALIVE and kept alive,
 * which turns a clean killing into an ongoing crime with a living victim, a
 * place they are held, and somebody who can be rescued. That is a better thing
 * for a world to contain than a body in a ditch.
 *
 * TWO OBJECTS BECAUSE THEY ARE IN TWO PLACES. The token is on the person,
 * wherever they have got to; the plate is on a wall a province away. A house
 * learns from the plate and everybody else reads the token.
 *
 * AND THE TAG AUTHENTICATES THE LINE, NOT THE PERSON. A genuine tag in the
 * wrong hands still reads as a member of that house. That is the seam somebody
 * would work, and it is not a defect to close: verifying the object is a
 * perceptual question, and whether this is the person it was issued to is not a
 * question the object can answer.
 */

import { REALM_TIERS, realmForOrdinal } from '../cultivation/realms.js';
import { highestGradeRefinableAt } from '../cultivation/who-can-refine-a-grade-of-medicine.js';
import type { TechniqueGrade } from '../../schema/cultivation.js';
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

/**
 * THE REALM A PLATE IS CUT AT.
 *
 * The design owner: *"let's make life plates a core formation craft. Anyone
 * less than that doesn't get one. Same for identity tokens"*, corrected a
 * moment later to *"someone at least FOUNDATION must craft it for you."*
 *
 * A HOUSE-LEVEL GATE AND NOT A PERSON-LEVEL ONE, which is the whole of what it
 * changes. It is not that a disciple must be Foundation to be GIVEN a plate -
 * it is that somebody in the house has to be Foundation to CUT one. A house
 * with nobody at that rung has no plates at all, for anybody: no roll it can
 * read, no notice when one of its own dies, and no token its members can prove
 * themselves with.
 *
 * Which is a real difference between a house and a gathering of people, and it
 * arrives without a rule being written for it. A hill sect is not a lesser
 * version of a court; it is a body that cannot do this at all.
 *
 * MEASURED, AND CURRENTLY NON-BINDING: all 36 houses in a seeded world can
 * field a Foundation hand, so none is without plates today. That is not a
 * reason to raise the rung - the gate is there for the bodies the world sim
 * makes later, when a house is broken down to a handful of survivors and
 * quietly loses the ability to know its own dead.
 *
 * ONE RUNG UNDER A QI SEAL, and the gap is the point. Sealing a person opens at
 * Core Formation; cutting the jade that says who they are opens a realm below
 * it. Making the thing that proves an identity is ordinary craft, and taking
 * somebody's ability to draw is not - so most houses can issue and far fewer
 * can hold.
 *
 * Read off the ladder rather than written as a number, for the same reason
 * `qiSealOpensAt` is: the tiers have been renamed more than once and a constant
 * copied out of them is a coincidence maintained by attention.
 */
export const THE_REALM_A_PLATE_IS_CUT_AT = 'foundation_establishment';

export function platesAreCutAt(): number {
    const tier = REALM_TIERS.find(row => row.key === THE_REALM_A_PLATE_IS_CUT_AT);
    if (!tier) {
        throw new Error(
            `No realm tier is keyed ${THE_REALM_A_PLATE_IS_CUT_AT}. Cutting a plate is gated on a `
            + 'realm rather than a number, so a renamed tier has to fail loudly here rather than '
            + 'silently giving every house plates or none.'
        );
    }
    return tier.ordinalStart;
}

/** Whether this hand could cut a plate or a token. */
export function couldCutAPlate(ordinal: number): boolean {
    return realmForOrdinal(ordinal).ordinalStart >= platesAreCutAt();
}

/**
 * Whether this house can issue at all, off the best hand it has.
 *
 * The house's own question, asked once, rather than a check repeated per
 * member: either somebody here can cut them and everybody eligible gets one, or
 * nobody can and the house has none.
 */
export function thisHouseCanIssue(ordinalsOnTheRoll: readonly number[]): boolean {
    return ordinalsOnTheRoll.some(couldCutAPlate);
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
 * WHAT A PLATE IS CUT FROM.
 *
 * The design owner: *"remember it requires foundation establishment materials
 * too - probably beast bones."*
 *
 * DERIVED FROM THE HAND, NOT PICKED. A Foundation hand cuts these, and
 * `who-can-refine-a-grade-of-medicine.ts` already owns which grade of material
 * a given rung can work at all - so the grade a plate wants is simply the best
 * that rung can hold. It comes out MORTAL: earth grade wants Core Formation,
 * which is a realm above the hand doing the cutting.
 *
 * That is worth more than naming a grade here, because the two move together.
 * Reprice what a Foundation hand can work and the plate follows, rather than
 * this file quietly asking for something nobody at the rung can hold.
 *
 * AND BONE, WHICH THE CATALOG HAS UNDER ANOTHER NAME. There is no material
 * called a bone in `beasts.ts`; the mortal-grade bone of a beast big enough to
 * cut a tag out of is the Ironhide Tusk, and the earth-grade ones - antler,
 * horn, fang, tooth - are all a realm too high. So the requirement is stated as
 * a grade and a kind rather than as one id, and a second mortal-grade bone
 * added to the catalog satisfies it with no edit here.
 */
export function whatAPlateIsCutFrom(): { grade: TechniqueGrade; itIsBone: true } {
    const grade = highestGradeRefinableAt(platesAreCutAt());
    return {
        // Unreachable while the refining table has a mortal row, which it must:
        // mortal grade opens at ordinal zero. A loud fallback rather than a
        // throw, because a bad edit here should fail a test and not a run.
        grade: grade ?? 'mortal',
        itIsBone: true
    };
}

/** Whether this material would do for a plate. */
export function wouldCutAPlate(material: {
    grade: TechniqueGrade;
    taking?: string;
    name?: string;
}): boolean {
    const wants = whatAPlateIsCutFrom();
    if (material.grade !== wants.grade) return false;
    // Bone, in the words the catalog actually uses for it.
    return /tusk|horn|fang|tooth|antler|bone|plastron|scute/i.test(material.name ?? '');
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
