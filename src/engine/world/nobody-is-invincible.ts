/**
 * Somebody can die at a friendly bout, and then the elders decide.
 *
 * The design owner, on the claim that a gathering hurt people but never killed
 * one: *"it's not that nothing dies"*, *"someone dies and the thing is
 * cancelled (or goes on, idk, depends on the elders)"*, *"nobody is
 * invincible"*, and *"the killer does get negative rep tho."*
 *
 * NOTHING HERE IS A NEW MECHANIC. All three were already in the engine and one
 * caller was dropping them on the floor:
 *
 * THE BODY. `ConfrontationResult.hp` is documented "the caller writes these",
 * and the gathering did not write them. Measured over 600 replayed friendly
 * bouts: 1 ended with somebody's bar at zero and 508 of 1200 combatants came
 * out under a quarter. The engine has never thought anybody was invincible.
 * The gathering just never asked.
 *
 * THE DEATH. `evaluateDeathConditions` is the single gate - *"survival.ts is
 * the only place a cultivator is declared dead, and the caller must hand it the
 * resulting state and ask"* - so this asks it rather than deciding anything.
 *
 * THE RULING. `whatTheBodyWants` is how every other body in this world settles
 * a question, and a death in the courtyard is a question. It is not a chance
 * that the gathering continues; it is a room of elders, some of whom knew the
 * person on the ground.
 *
 * AND THE REPUTATION IS NOT A NUMBER ON THE KILLER. It is what the people who
 * watched hold about them afterwards, which is where standing already lives.
 * See AGENTS.md: objects are dead, people are alive.
 */

import { evaluateDeathConditions } from '../cultivation/survival.js';
import { realmIndexOf } from '../cultivation/realms.js';
import {
    A_BLOW_MEANT_TO_END_IT,
    A_BOUT_BETWEEN_PEOPLE_WHO_EXPECT_TO_WALK_AWAY,
    type HowTheBlowWasThrown
} from '../cultivation/how-a-blow-was-thrown.js';
import type { DeathCause } from '../../schema/cultivation.js';
import {
    whatTheBodyWants,
    type OnTheRoll,
    type WhereTheBodyLands
} from '../social-leverage/what-a-body-wants-is-what-its-deciders-want.js';
import {
    openHandednessOf,
    DISPOSITION_BANDS
} from '../social-leverage/how-freely-somebody-parts-with-what-they-have.js';
import { maxBodyOf, relationshipWith, type NpcRecord } from './npc-state.js';

/** The axis every reading in this world is held to. */
const AXIS = 1;

/**
 * What an exchange left in the body, and whether they got up.
 *
 * The hp the resolver returned goes onto the record and the gate is asked. The
 * gate answers about the WHOLE person - lifespan, settling, starvation - and
 * only the bar is this caller's business, so the fields it would read for any
 * other cause are handed to it neutral. A gathering is not where somebody's
 * years run out.
 */
export function whetherTheyGotUp(input: {
    npc: NpcRecord;
    /** What the resolver left them standing on. */
    hp: number;
    onDay: number;
}): { npc: NpcRecord; cause: DeathCause | null } {
    const left = Math.max(0, Math.floor(input.hp));
    const npc: NpcRecord = {
        ...input.npc,
        cultivation: { ...input.npc.cultivation, hp: left, bodyOnDay: input.onDay },
        updatedOnDay: input.onDay
    };
    if (left > 0) return { npc, cause: null };

    const cause = evaluateDeathConditions({
        hp: left,
        maxHp: maxBodyOf(npc),
        // NEUTRAL, deliberately. A world NPC carries no belly and no turn
        // counter, and inventing one here would let a gathering kill somebody
        // of starvation. The bar is the only cause this caller watched.
        satiety: 1,
        starvationTurns: 0,
        age: 0,
        realmOrdinal: npc.cultivation.realmOrdinal,
        yearsAtCurrentRealm: 0,
        injuries: npc.cultivation.injuries,
        alive: npc.status === 'alive'
    });
    return { npc, cause };
}

/**
 * Why they stood up, which is the only thing that decides whether anybody dies.
 *
 * MEASURED, AND THE MEASUREMENT SETTLED IT. Over 2,666 replayed friendly bouts
 * every single emptied bar carried the outcome `capture` - 115 of 115 - and
 * `capture` is defined as *"the loser was taken alive."* Not one came back
 * `crippled` or `withdrawal`. Which is the combat layer being consistent rather
 * than protective: `finishOutcome` returns 'capture' for bare hands whatever
 * else happened in the fight, because a beating is not a killing however badly
 * it goes.
 *
 * (That reading was taken when a friendly bout passed `goal: 'subdue'`. It
 * still holds, and for a better reason: a bout now passes the SWING two people
 * expecting to walk away actually throw - see
 * `A_BOUT_BETWEEN_PEOPLE_WHO_EXPECT_TO_WALK_AWAY` - so the ceiling comes from
 * what is in their hands rather than from an intention they declared.)
 *
 * So a death at a gathering is not an accident of arithmetic, and hunting for
 * one in the damage numbers was looking in the wrong place. It is somebody
 * standing up for a reason other than the bout. That is also the only version
 * the genre has - the disciple who has been waiting years for this pairing -
 * and it is the version where *"the killer does get negative rep"* means
 * something, because they meant it.
 *
 * READ OFF WHAT THE TWO OF THEM ALREADY HOLD. No new field, no roll: the
 * standing between them is written by every bout, insult and inheritance that
 * came before, so who fights to hurt is a fact the world has been accumulating
 * for two centuries. AGENTS.md: objects are dead, people are alive.
 */
export type WhatTheyStoodUpFor =
    /** Two people finding out where they are. What a gathering is for. */
    | 'a_test'
    /** They are not here for a bout. */
    | 'to_end_them';

/**
 * Where somebody stops being here for a bout.
 *
 * BORROWED, NOT CHOSEN. `MARKED` is this world's band for a feeling being the
 * first thing anybody would tell you about them; read negative that is a
 * hatred, and a fresh number here would be a second opinion about where a
 * feeling gets strong enough to act on.
 *
 * AND THERE IS NO MIDDLE BAND, which there was for an afternoon. A third state
 * between a test and a killing - fighting to shame somebody - sat at the
 * lighter `WORTH_SAYING` band, which two bad bouts reach, so most of the
 * world's bouts became humiliations. That is a large claim to make about a
 * courtyard, it was nobody's ruling, and downstream it wrote grudge
 * obligations at a rate that moved what houses decided about their own
 * treasuries three files away. A bout is a test or it is not a bout.
 *
 * `GRUDGE_STANDING` in `gatherings.ts` is the same band read at its lighter
 * end. It is not imported: that file imports this one, and the cycle left this
 * constant undefined at load - which silently disabled the whole reading until
 * a boundary test caught it.
 */
export const NOTHING_LEFT_BUT_TO_END_IT = -DISPOSITION_BANDS.MARKED;

export function whyTheyStoodUp(input: {
    /** The one standing up. */
    who: NpcRecord;
    /** Who they are standing up against. */
    against: string;
}): WhatTheyStoodUpFor {
    const held = relationshipWith(input.who, input.against);
    // A MISSING ROW IS NOTHING BETWEEN THEM, not a zero to be read as coldness.
    const standing = held?.standing ?? 0;
    return standing <= NOTHING_LEFT_BUT_TO_END_IT ? 'to_end_them' : 'a_test';
}

/** What to hand the resolver for it. */
export const WHAT_THEY_CAME_TO_DO: Readonly<
    Record<WhatTheyStoodUpFor, HowTheBlowWasThrown>
> = {
    a_test: A_BOUT_BETWEEN_PEOPLE_WHO_EXPECT_TO_WALK_AWAY,
    to_end_them: A_BLOW_MEANT_TO_END_IT
};

/**
 * Who standing there could have stepped in and stopped it.
 *
 * MEASURED FIRST, and the measurement is why this exists. Replaying 3000
 * friendly bouts, every single one that emptied somebody's bar took 7 to 11
 * exchanges, against 6.5 for the ones that did not. Not one death came from a
 * blow nobody saw coming - they were all long grinding bouts, in a courtyard,
 * in front of a crowd. A friendly bout that reaches a body is one that ran
 * past the point somebody would have called it.
 *
 * SO THE QUESTION IS WHETHER ANYBODY COULD. Not whether they would - anybody
 * watching two juniors go too far pulls them apart, and needing a disposition
 * roll for that would be inventing a reluctance nobody has.
 *
 * AND STOPPING IT MEANS OVERMATCHING THEM, not merely being nearby. You cannot
 * step into an exchange between two people as fast as you are; getting a hand
 * between them takes being a realm above them, which `REALM_TIERS` calls a
 * different kind of body. That is also who does it in the genre - the elder on
 * the platform, who is never the fighters' peer.
 *
 * Which puts a death exactly where the genre puts it: the top of the card. Two
 * juniors are stopped by any of the seniors watching. The two BEST people in
 * the room have nobody above them, and that is the bout that reaches a body.
 */
export function whoCouldHaveStoppedIt(input: {
    /** Everybody at the gathering, fighters included. */
    present: readonly NpcRecord[];
    /** The two who stood up. */
    fighting: readonly [string, string];
    /** The stronger of the two, as a realm index. */
    reachedRealm: number;
}): NpcRecord[] {
    return input.present.filter(who =>
        who.status === 'alive'
        && who.id !== input.fighting[0] && who.id !== input.fighting[1]
        && realmIndexOf(who.cultivation.realmOrdinal) > input.reachedRealm);
}

// ─────────────────────────────────────────────────────────────────────────
// AND THEN THE ROOM
// ─────────────────────────────────────────────────────────────────────────

/** Whose person is on the ground. */
export type WhoWentDown =
    /** The house holding the gathering lost one of its own. */
    | 'the_hosts_own'
    /** Somebody another house sent, in the host's courtyard. */
    | 'a_guest';

/** How it read to the people watching. */
export type HowItLooked =
    /** A bout is a bout and both of them knew it when they stood up. */
    | 'an_accident'
    /** The winner went further than the thing allowed, in front of everybody. */
    | 'past_the_mark';

/**
 * What a death does to a room deciding whether to carry on.
 *
 * Positive carries on, negative calls it off, and the base is the decider's own
 * temperament - so a room of hard old men finishes the card over a body and a
 * softer one does not, from the same table.
 *
 * A GUEST DYING BY ACCIDENT IS THE ONLY ENTRY THAT LEANS TOWARDS CARRYING ON,
 * and it is the entry the genre is built on: two juniors stood up, both houses
 * agreed to it, one of them is dead, and the next pair steps forward. It is
 * nobody in the room's son.
 *
 * AND NOTHING HERE IS ABSOLUTE, INCLUDING A KILLING ON PURPOSE. This table read
 * one of their own killed deliberately as -1, on the reasoning that no room
 * watches that and then calls the next pair up. The design owner: *"depends on
 * if the elders like the dude that killed, of course. intentional is fine."*
 *
 * Which is the same correction this file already took once: the answer is not a
 * property of the death, it is what the PEOPLE think. So the shift is heavy
 * enough that an indifferent room always stops, and not so heavy that a room
 * full of the killer's own backers cannot carry it - because that room exists,
 * and a table that could not produce it would be deciding on their behalf.
 */
export const WHAT_A_DEATH_MOVES_A_ROOM: Readonly<
    Record<WhoWentDown, Readonly<Record<HowItLooked, number>>>
> = {
    the_hosts_own: { an_accident: -0.35, past_the_mark: -0.8 },
    a_guest: { an_accident: 0.1, past_the_mark: -0.6 }
};

export interface WhetherItGoesOn {
    /** Where the room landed. A null leaning means there was no room to ask. */
    answer: WhereTheBodyLands;
    /** Whether the rest of it is held. */
    goesOn: boolean;
    /** Engine truth, one line. Never narration. */
    line: string;
}

/**
 * Whether the gathering carries on over the body, and who said so.
 *
 * A house with nobody senior enough to decide does not carry on. That is not
 * the room being squeamish - it is there being no room, and a thing nobody is
 * running has already stopped.
 */
export function whetherItGoesOn(input: {
    who: WhoWentDown;
    how: HowItLooked;
    roll: readonly OnTheRoll[];
    rankCount: number;
    /**
     * What each decider holds about the person who did it, where the world has
     * a row for it. Null for no row, which reads as their temperament and
     * nothing more.
     *
     * THIS IS THE READING, and the design owner's ruling is the whole of why:
     * *"depends on if the elders like the dude that killed."* A room is not
     * deciding about a death in the abstract, it is deciding about somebody
     * they know, and an elder who thinks well of the winner hears a different
     * afternoon than one who does not.
     */
    heldAboutTheKiller?: (deciderId: string) => number | null;
    /** How each decider leans, before any of it. Defaults to their temperament. */
    readingOf?: (personId: string) => number;
}): WhetherItGoesOn {
    const temperament = input.readingOf ?? openHandednessOf;
    const held = input.heldAboutTheKiller;
    const base = (id: string) => {
        const about = held?.(id) ?? null;
        return about === null || !Number.isFinite(about) ? temperament(id) : about;
    };
    const shift = WHAT_A_DEATH_MOVES_A_ROOM[input.who][input.how];
    const answer = whatTheBodyWants({
        roll: input.roll,
        rankCount: input.rankCount,
        readingOf: id => Math.max(-AXIS, Math.min(AXIS, base(id) + shift))
    });
    const goesOn = (answer.leaning ?? -1) > 0;
    return {
        answer,
        goesOn,
        line: answer.leaning === null
            ? 'A death, and nobody standing high enough to rule on it. It stopped there.'
            : 'A death of ' + input.who + ', ' + input.how + ': the room settled it '
              + answer.settledBy + ', leaning ' + answer.leaning.toFixed(2) + '. '
              + (goesOn ? 'It went on.' : 'It was called off.')
    };
}

/**
 * What the room holds against somebody who killed at a friendly bout.
 *
 * Not a field. Everybody who was standing there writes it, which is what a
 * reputation is made of and is why nothing here stores one.
 */
export const WHAT_A_KILLING_COSTS_YOU_WITH_A_WITNESS = -0.3;

/** And with the people who have to carry the body home. */
export const WHAT_IT_COSTS_YOU_WITH_THEIR_OWN = -0.85;

/** Past the mark, and everybody watched you do it. */
export const WHAT_DOING_IT_ON_PURPOSE_ADDS = -0.35;
