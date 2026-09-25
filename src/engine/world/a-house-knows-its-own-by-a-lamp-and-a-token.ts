/**
 * A HOUSE KNOWS ITS OWN BY A LAMP AND A TOKEN.
 *
 * `docs/world/houses/trust.md` has carried this design under its own heading
 * since it was written - a house keeps a life lamp burning for each disciple, it
 * goes out when they die, and the disciple's token goes with them. Measured before this
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
 * wherever they have got to; the lamp burns in a hall a province away. A house
 * learns from the lamp and everybody else reads the token.
 *
 * AND THE TAG AUTHENTICATES THE LINE, NOT THE PERSON. A genuine tag in the
 * wrong hands still reads as a member of that house. That is the seam somebody
 * would work, and it is not a defect to close: verifying the object is a
 * perceptual question, and whether this is the person it was issued to is not a
 * question the object can answer.
 */

import { REALM_TIERS, realmForOrdinal } from '../cultivation/realms.js';
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
 * THE REALM A LAMP IS LIT AT.
 *
 * The design owner, when these were still called life plates: *"let's make
 * life plates a core formation craft. Anyone less than that doesn't get one.
 * Same for identity tokens"*, corrected a moment later to *"someone at least FOUNDATION must craft it for you."*
 *
 * A HOUSE-LEVEL GATE AND NOT A PERSON-LEVEL ONE, which is the whole of what it
 * changes. It is not that a disciple must be Foundation to be GIVEN a lamp -
 * it is that somebody in the house has to be Foundation to LIGHT one. A house
 * with nobody at that rung has no lamps at all, for anybody: no roll it can
 * read, no notice when one of its own dies, and no token its members can prove
 * themselves with.
 *
 * Which is a real difference between a house and a gathering of people, and it
 * arrives without a rule being written for it. A hill sect is not a lesser
 * version of a court; it is a body that cannot do this at all.
 *
 * MEASURED, AND CURRENTLY NON-BINDING: all 36 houses in a seeded world can
 * field a Foundation hand, so none is without lamps today. That is not a
 * reason to raise the rung - the gate is there for the bodies the world sim
 * makes later, when a house is broken down to a handful of survivors and
 * quietly loses the ability to know its own dead.
 *
 * ONE RUNG UNDER A QI SEAL, and the gap is the point. Sealing a person opens at
 * Core Formation; lighting the lamp and cutting the jade that say who they are
 * opens a realm below it. Making the thing that proves an identity is ordinary craft, and taking
 * somebody's ability to draw is not - so most houses can issue and far fewer
 * can hold.
 *
 * Read off the ladder rather than written as a number, for the same reason
 * `qiSealOpensAt` is: the tiers have been renamed more than once and a constant
 * copied out of them is a coincidence maintained by attention.
 */
export const THE_REALM_A_LAMP_IS_LIT_AT = 'foundation_establishment';

export function lampsAreLitAt(): number {
    const tier = REALM_TIERS.find(row => row.key === THE_REALM_A_LAMP_IS_LIT_AT);
    if (!tier) {
        throw new Error(
            `No realm tier is keyed ${THE_REALM_A_LAMP_IS_LIT_AT}. Lighting a lamp is gated on a `
            + 'realm rather than a number, so a renamed tier has to fail loudly here rather than '
            + 'silently giving every house lamps or none.'
        );
    }
    return tier.ordinalStart;
}

/** Whether this hand could light a lamp or cut a token. */
export function couldLightALamp(ordinal: number): boolean {
    return realmForOrdinal(ordinal).ordinalStart >= lampsAreLitAt();
}

/**
 * Whether this house can issue at all, off the best hand it has.
 *
 * The house's own question, asked once, rather than a check repeated per
 * member: either somebody here can make them and everybody eligible gets one, or
 * nobody can and the house has none.
 */
export function thisHouseCanIssue(ordinalsOnTheRoll: readonly number[]): boolean {
    return ordinalsOnTheRoll.some(couldLightALamp);
}

/** The room a house keeps its lamps burning in: the Life Lamp Hall, at the inner end. */
export const WHERE_THE_LAMPS_BURN = 'life_lamp_hall';

/** The tag every life lamp carries, and what a lamp is found by. */
export const A_LIFE_LAMP = 'life-lamp';

/** Deterministic ids, so a lamp and its token can always find each other. */
export function lampIdFor(memberId: string): string {
    return `life-lamp-${memberId}`;
}

export function tokenIdFor(memberId: string): string {
    return `identity-token-${memberId}`;
}

/**
 * The token somebody carries, and the lamp that answers for them.
 *
 * TWO OBJECTS AND NOT ONE, because they are in two places and that is the
 * entire mechanism: the token is on the person, wherever they have got to, and
 * the lamp burns in a hall a province away. A house learns from the lamp;
 * everybody else reads the token.
 */
export function issueTo(input: {
    memberId: string;
    memberName: string;
    houseId: string;
    houseName: string;
    /** The hall the lamps burn in, or the seat where a house has no hall. */
    lampRoomId: string | null;
    onDay: number;
    /**
     * Whoever holds the room the roll is kept in, where anybody does. Absent at
     * world open, when the roll was cut before anybody was watching.
     */
    cutById?: string | null;
}): { token: ObjectRecord; lamp: ObjectRecord } {
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
        data: { memberId: input.memberId, issuedOnDay: input.onDay, cutById: input.cutById ?? null }
    });

    const lamp = makeObject({
        id: lampIdFor(input.memberId),
        name: `the life lamp of ${input.memberName}`,
        kind: 'token',
        significance: 'notable',
        description:
            `A lamp in the ${input.houseName} Life Lamp Hall, lit for ${input.memberName}. It `
            + 'burns while they live, and it is the first thing anybody looks at when somebody '
            + 'stops answering.',
        // NOBODY CARRIES A LAMP. It burns where it burns, which is what makes
        // it evidence a house holds rather than a thing that can be lost with
        // the person it answers for.
        possessorId: null,
        ownerId: input.houseId,
        ownerName: input.houseName,
        power: null,
        locationId: input.lampRoomId,
        tags: [A_LIFE_LAMP, `house:${input.houseId}`, `member:${input.memberId}`],
        // No `burning` field. Whether a lamp burns is its holder's aliveness,
        // which is one fact and is asked of the person - see `whatTheLampSays`.
        data: { memberId: input.memberId, litOnDay: input.onDay }
    });

    return { token, lamp };
}

/** What a house reads off a lamp. */
export type WhatTheLampSays =
    /** Burning. They are alive, wherever they are. */
    | 'they_live'
    /** Gone out. They are dead, and the house learned it the moment it went out. */
    | 'they_are_dead';

/**
 * WHAT THE LAMP SAYS, DERIVED FROM THE PERSON AND NOT STORED ON THE LAMP.
 *
 * A first cut stored `whole` on the row and wrote it at death. That is the
 * second copy of a fact this repo's doctrine forbids, and the reason is not
 * theoretical: `markDead` is called from SIX places across four files, so a
 * stored flag is six chances to forget, and the one that forgot would leave a
 * lamp burning for a dead disciple - which is precisely the signature
 * the world uses to mean *somebody is holding them prisoner*. The bug would not
 * read as a bug. It would read as a kidnapping.
 *
 * Whether a lamp burns IS its holder's aliveness. One fact. So it is asked of
 * the person, every time, and there is nothing to write, nothing to migrate,
 * and no call site that can miss it.
 */
export function whatTheLampSays(holderIsAlive: boolean): WhatTheLampSays {
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
 * A LAMP STILL BURNING, AND NOBODY HAS SEEN THEM. The signature of a captive.
 *
 * The document's own reading and the reason the lamp is worth keeping: a house
 * that knows somebody LIVES and knows they are not answering is looking at
 * something quite different from a death, and it is the state that sends the
 * posters out. A lamp that has gone out closes a question; one still burning for somebody
 * nobody can find opens a worse one.
 */
export function whatAHouseMakesOfSilence(input: {
    /** False where this house never issued them one. */
    theyHaveALamp: boolean;
    holderIsAlive: boolean;
    daysSinceAnybodySawThem: number;
}): 'nothing_yet' | 'they_are_dead' | 'somebody_has_them' {
    if (!input.theyHaveALamp) return 'nothing_yet';
    if (whatTheLampSays(input.holderIsAlive) === 'they_are_dead') return 'they_are_dead';
    return input.daysSinceAnybodySawThem >= WHEN_SILENCE_BECOMES_A_CAPTIVE
        ? 'somebody_has_them'
        : 'nothing_yet';
}

/**
 * How long somebody has to be unaccounted for before a lamp still burning is read as a
 * captivity rather than an errand.
 *
 * A season. Long enough that ordinary business does not raise it and short
 * enough that a house is not the last to know.
 */
export const WHEN_SILENCE_BECOMES_A_CAPTIVE = 90;

// ═════════════════════════════════════════════════════════════════════════
// WHAT THE HALL SAYS TODAY
// ═════════════════════════════════════════════════════════════════════════

/**
 * One name on a house's roll, as the hall reads it.
 *
 * `daysSinceAnybodySawThem` is the world's own `lastConfirmedOnDay` against the
 * day, not a second clock: a house does not keep a register of who has been
 * seen, it notices that somebody stopped turning up.
 */
export interface OneOnTheRoll {
    memberId: string;
    memberName: string;
    /**
     * Whether a lamp burns for them in the house's hall, read off the row by
     * {@link whoHasALampBurningIn}.
     *
     * This was their rung, with the lamp inferred from it. That was a second
     * copy of a fact the lamp row holds, and it disagreed in both directions:
     * somebody promoted onto the rung while away read as having a lamp with none
     * lit, and a house that had lost its last Foundation hand read nothing at all
     * off lamps still burning there.
     */
    theyHaveALamp: boolean;
    holderIsAlive: boolean;
    daysSinceAnybodySawThem: number;
}

export interface WhatTheHallSays {
    memberId: string;
    memberName: string;
    /** Carried through, because how long is half of what the house would say. */
    unseenForDays: number;
    reading: ReturnType<typeof whatAHouseMakesOfSilence>;
}

/**
 * WHAT A HOUSE LEARNS OFF ITS OWN HALL OF LAMPS.
 *
 * The lamps were being LIT and never READ. `seedTreasuries` lights one for
 * every disciple of every house that can light them, so a fresh world holds
 * hundreds - and nothing in `src/` asked any of them a question. A house could
 * lose a disciple and the engine did not notice, which is the one fact
 * `docs/world/houses/trust.md` says a house cannot miss.
 *
 * A DERIVATION AND NOT AN EVENT. Nothing is written and nothing is notified.
 * The hall is recomputed from the roll every time it is asked, which is why
 * there is no call site that can forget to put a lamp out.
 *
 * AND ONLY THE PEOPLE WITH A LAMP BURNING. A house reads its lamps, so
 * somebody it never lit one for is not on the list at all - which is how a house
 * that could never light one is told nothing, rather than told its people are fine.
 */
export function whatTheHallSays(input: {
    roll: readonly OneOnTheRoll[];
}): WhatTheHallSays[] {
    return input.roll.filter(member => member.theyHaveALamp).map(member => ({
        memberId: member.memberId,
        memberName: member.memberName,
        unseenForDays: member.daysSinceAnybodySawThem,
        reading: whatAHouseMakesOfSilence({
            theyHaveALamp: true,
            holderIsAlive: member.holderIsAlive,
            daysSinceAnybodySawThem: member.daysSinceAnybodySawThem
        })
    }));
}

/** What a house is asking to be brought back. */
export type WhatTheHouseWants = 'them' | 'what is left of them';

/**
 * The ones a house would ask strangers about, and what it wants brought back.
 *
 * THE LAMP GRADES THE ASK RATHER THAN GATING IT. A lamp says somebody died; it
 * does not say where, what did it, or whether anything is left to carry home.
 * See `docs/world/houses/trust.md`, "Tokens shatter, so somebody has to be
 * taken alive".
 *
 *   burning, nobody can find them  ->  they want THEM
 *   out                            ->  they want WHAT IS LEFT: a body, a soul
 *                                      still preserved, or an account of it
 *
 * A DEATH IN SIGHT OF THE HOUSE IS NOT A SEARCH. A lamp going out opens one
 * only once they have been unseen as long as a captivity takes to read, which
 * is the same threshold because it is the same question.
 */
export function theOnesNobodyCanFind(
    readings: readonly WhatTheHallSays[]
): {
    memberId: string;
    memberName: string;
    unseenForDays: number;
    wants: WhatTheHouseWants;
}[] {
    return readings
        .filter(row =>
            row.reading === 'somebody_has_them'
            || (row.reading === 'they_are_dead'
                && row.unseenForDays >= WHEN_SILENCE_BECOMES_A_CAPTIVE))
        .map(row => ({
            memberId: row.memberId,
            memberName: row.memberName,
            unseenForDays: row.unseenForDays,
            wants: row.reading === 'somebody_has_them'
                ? 'them' as const
                : 'what is left of them' as const
        }));
}

// ═════════════════════════════════════════════════════════════════════════
// AND WHOSE JOB IT IS
// ═════════════════════════════════════════════════════════════════════════

/**
 * THE INTERNAL AFFAIRS ELDER.
 *
 * The design owner, before the plates became lamps: *"when you join, an
 * identity plate and token get created for you - that's another elder's job"*, *"idk, give him a name, a role."*
 *
 * So it is an office, and this repo already decides what an office IS: a SEALED
 * ROOM dealt to a decider by `whoIsInChargeOfWhat`. There is no title table
 * anywhere and adding one would be a second way of saying who is in charge of
 * what. The armoury elder is whoever holds the armoury; the Internal Affairs
 * Elder is whoever holds the Life Lamp Hall, the room the lamps burn in.
 *
 * THE GENRE'S NAME FOR THE JOB. Registering disciples, issuing their tokens and
 * robes and keeping the life lamps is what an Internal Affairs Elder does in the
 * genre. The office carried an invented title first, and the design owner
 * replaced it with the one a reader of the genre already knows.
 *
 * WHICH IS WHY THE NAME IS THE ROOM'S AND NOT A PERSON'S. Nobody is appointed
 * Internal Affairs Elder in this engine. Somebody holds the hall, and holding it is
 * what makes them the person a new disciple is sent to - and what makes losing
 * it a demotion that costs them something specific rather than face.
 */
export const THE_INTERNAL_AFFAIRS_ELDER = 'Internal Affairs Elder';

/**
 * What the office is, said as the room it is held over.
 *
 * `whoAnswersAbout(portfolios, THE_ROOM_THE_ROLL_IS_KEPT_IN)` is the whole
 * lookup - the same call the punishment hall and the treasury already use.
 */
export const THE_ROOM_THE_ROLL_IS_KEPT_IN = WHERE_THE_LAMPS_BURN;

// ─────────────────────────────────────────────────────────────────────────
// AND WHAT A TOKEN IS FOR WHEN SOMEBODY IS CARRYING A MARKED OBJECT
// ─────────────────────────────────────────────────────────────────────────

/**
 * Some objects say where they came from. A token says whose you are. Asked
 * together, they are a check anybody senior can run in a doorway.
 *
 * THE CHALLENGE FIRES ON THE ASKER'S KNOWLEDGE, NOT ON THE OBJECT. Somebody who
 * does not know what the thing is sees a good sword and asks nothing, which is
 * why this takes a flag from the caller rather than reading the object twice.
 *
 * AND IT PUTS A QUESTION RATHER THAN ANSWERING ONE. The tag authenticates the
 * LINE and not the person, so a genuine token in the wrong hands still reads as
 * a member of that house - the seam the module already declines to close. What
 * comes back here is what the two objects say and whether the two agree. Who is
 * lying is not a thing an object can answer.
 */
export type WhatTheTwoSay =
    /** The asker does not know what the object is, so there is no question. */
    | 'nothing to ask'
    /** They name the same house. Which proves nothing about the person. */
    | 'they agree'
    /** They name different houses, and that is a thing to be explained. */
    | 'they do not agree'
    /** No token at all, which is its own answer and a harsh one. */
    | 'no token to read';

/**
 * The house the token somebody is carrying names, or null where they carry none.
 *
 * Read off the one possessions table, so it answers the way a doorway would: a
 * recruit still on the road to the house that took them has joined it and has
 * nothing to show for it, and this says null.
 *
 * WHOSE LIFE IT ANSWERS FOR IS THE PERSON IT WAS CUT FOR, not the person
 * carrying it. A first cut asked about the carrier, which would have let a token
 * taken off a corpse open a gate - the one route this file exists to close. A
 * token carried by somebody else whose issuee is alive still answers, which is
 * the seam the header keeps open on purpose.
 */
export function theHouseTheirTokenNames(
    objects: readonly Pick<ObjectRecord, 'kind' | 'possessorId' | 'ownerId' | 'tags' | 'data'>[],
    carrierId: string,
    /** Whether the person a token was cut for is alive. The world's own row. */
    stillAlive: (memberId: string) => boolean
): string | null {
    const token = objects.find(object =>
        object.kind === 'token'
        && object.possessorId === carrierId
        && object.tags.includes('identity')
        && typeof object.data?.memberId === 'string'
        && theTokenStillAnswers(stillAlive(object.data.memberId)));
    return token?.ownerId ?? null;
}

/**
 * The members of a house who have a lamp burning in its hall.
 *
 * Read off the lamp rows rather than inferred from a rung: a lamp is lit once,
 * by somebody who could, and burns whether or not anybody in the house could light
 * another today. Somebody promoted onto the rung and not yet entered at the house
 * has none.
 */
export function whoHasALampBurningIn(
    objects: readonly Pick<ObjectRecord, 'ownerId' | 'tags' | 'data'>[],
    houseId: string
): Set<string> {
    const burning = new Set<string>();
    for (const object of objects) {
        if (object.ownerId !== houseId || !object.tags.includes(A_LIFE_LAMP)) continue;
        if (typeof object.data?.memberId === 'string') burning.add(object.data.memberId);
    }
    return burning;
}

export function whatTheTwoSay(input: {
    /** True only where the person asking knows what such an object is. */
    theAskerKnowsWhatItIs: boolean;
    /** The house the object can only have come from, or null for an ordinary thing. */
    theObjectNames: string | null;
    /** The house the token names, or null where they carry none. */
    theTokenNames: string | null;
}): WhatTheTwoSay {
    if (!input.theAskerKnowsWhatItIs || input.theObjectNames === null) return 'nothing to ask';
    if (input.theTokenNames === null) return 'no token to read';
    return input.theObjectNames === input.theTokenNames ? 'they agree' : 'they do not agree';
}
