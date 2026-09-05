/**
 * What an elder is in charge of, and why they are an elder at all. The design
 * owner: *"elders should own something in a sect, like punishment elder (you
 * control the jails)... a position ripe for bribes and favors people can ASK OF
 * YOU"*, and *"the difference between an elder and a chosen is responsibility +
 * ability to advance"*, and *"an elder still might, out of luck."*
 */

import type { RoomPurpose } from '../world/architecture.js';
import { roomAuthorityOf } from '../world/architecture.js';
import { stagnationYearsForOrdinal } from '../../schema/cultivation.js';
import { expulsionCost, mayExercise, type ActCost } from '../cultivation/leadership.js';
import type { OnTheRoll, TheirSay, WhereTheBodyLands } from './what-a-body-wants-is-what-its-deciders-want.js';
import { whatTheBodyWants, whoDecidesIn } from './what-a-body-wants-is-what-its-deciders-want.js';

/**
 * Share of `stagnationYearsForOrdinal` spent standing at a rung, past which a
 * house reads somebody as finished. Three quarters, so the last quarter is where
 * "an elder still might, out of luck" lives.
 */
export const READ_AS_FINISHED_AT = 0.75;

export interface HowFinishedTheyLook {
    /** Years they have stood at this rung without advancing. */
    yearsHeld: number;
    /** What the ladder credits at this rung before the climb ends. */
    yearsCredited: number;
    /** `yearsHeld / yearsCredited`, uncapped so a caller can see how far past. */
    spent: number;
    /** A BELIEF AND NEVER A CEILING. Nothing may refuse an advancement on this. */
    looksFinished: boolean;
    /** Engine truth, one line, for the mechanical channel. Never narration. */
    line: string;
}

/**
 * How finished somebody looks. Takes the years rather than the record, so it
 * answers for a player (`yearsAtCurrentRealm`) and for somebody on the roster
 * (today minus `lastAdvancedOnDay`) without naming either shape.
 */
export function howFinishedTheyLook(input: {
    realmOrdinal: number;
    yearsHeld: number;
}): HowFinishedTheyLook {
    const credited = Math.max(1, stagnationYearsForOrdinal(input.realmOrdinal));
    const held = Math.max(0, input.yearsHeld);
    const spent = round4(held / credited);
    const looksFinished = spent >= READ_AS_FINISHED_AT;
    return {
        yearsHeld: held,
        yearsCredited: credited,
        spent,
        looksFinished,
        line: looksFinished
            ? `${Math.round(held)} years at this rung against the ${Math.round(credited)} it `
              + 'credits. The people around them have stopped expecting another one, which is '
              + 'a thing they believe and not a thing the ladder enforces.'
            : `${Math.round(held)} years at this rung against the ${Math.round(credited)} it `
              + 'credits. Nobody has written them off.'
    };
}

export type HowTheyAreHeld =
    /** Stopped, and holding a room. The ordinary elder. */
    | 'settled, and in charge of something'
    /**
     * Stopped, holding no room, and carried anyway. The design owner: *"an elder
     * with no office should be rare, sects don't typically want them, cuz it's
     * bloat, unless you are good."* Uncommon and EARNED, not the bottom of a scale.
     */
    | 'settled, carried for what they are'
    /** Still rising, at the same height. The house expects more. */
    | 'still rising';

export interface WhatTheHouseMakesOfThem {
    /** The house's own word for the rung. Never invented here. */
    title: string;
    is: HowTheyAreHeld;
    /**
     * Which sealed rooms they are over, deepest first. Declared and possibly empty
     * rather than absent, on the owner's instruction *"elders need to have an
     * office field and it can be empty"*: an absence needs a slot to be absent
     * from, or it cannot be told from an unanswered question.
     */
    holds: readonly RoomPurpose[];
    finished: HowFinishedTheyLook;
    /**
     * `leadership.ts`'s `recruit_disciples`, asked rather than restated. Every
     * elder has it, office or not, which is what makes the office-less seat
     * strictly worse rather than a different bargain.
     */
    mayTakeDisciples: boolean;
    line: string;
}

/** What a house's own ladder calls somebody, and what that placement means. */
export function whatTheHouseMakesOfThem(input: {
    ranks: readonly string[];
    rankIndex: number;
    realmOrdinal: number;
    yearsHeld: number;
    holds?: readonly RoomPurpose[];
}): WhatTheHouseMakesOfThem {
    const finished = howFinishedTheyLook(input);
    const holds = (input.holds ?? []).slice();
    const title = input.ranks[input.rankIndex] ?? '';
    const mayTakeDisciples =
        mayExercise('recruit_disciples', input.rankIndex, input.ranks.length);

    const is: HowTheyAreHeld = !finished.looksFinished
        ? 'still rising'
        : holds.length > 0
            ? 'settled, and in charge of something'
            : 'settled, carried for what they are';

    return {
        title,
        is,
        holds,
        finished,
        mayTakeDisciples,
        line: is === 'still rising'
            ? `${title}, and the house has not decided they are done - same height, and they are `
              + 'expected to go further. That is a better thing to be handed than a room, and '
              + 'they answer to the people at their own rung who have stopped.'
            : is === 'settled, and in charge of something'
                ? `${title}, holding ${holds.join(', ')}. They are not going further and they run `
                  + 'something, which is what the rung is actually for.'
                : `${title}, and no room under them. A house does not carry a title and a stipend `
                  + 'for somebody it merely tolerates, so this seat is uncommon and it was '
                  + `earned${mayTakeDisciples
                      ? ' - what they do instead of administering is take disciples, and a '
                        + 'following is weight in every question rather than first refusal in one'
                      : ''}.`
    };
}

/**
 * Whether one person may direct another at the SAME rung, which `canOrder` cannot
 * answer. The design owner: *"an elder has authority over a conclave disciple as in
 * i can order them around."*
 */
export function mayDirectAtTheSameRung(
    giver: { rankIndex: number; looksFinished: boolean },
    receiver: { rankIndex: number; looksFinished: boolean }
): boolean {
    if (giver.rankIndex !== receiver.rankIndex) return false;
    return giver.looksFinished && !receiver.looksFinished;
}

export interface APortfolio {
    purpose: RoomPurpose;
    /** Who holds it, or null where the house has nobody to hold it. */
    holderId: string | null;
    /** How far into the compound it sits. Deepest goes to the most senior. */
    depth: number;
}

/**
 * Hand a house's sealed rooms to the people who decide in it: rooms deepest-first,
 * people heaviest-voice-first, round robin.
 */
export function whoIsInChargeOfWhat(input: {
    /** Every room the house has. Unsealed ones are dropped here. */
    rooms: readonly RoomPurpose[];
    /** The house's roll and ladder, read by the module that owns deciders. */
    roll: readonly OnTheRoll[];
    rankCount: number;
}): APortfolio[] {
    const sealed = [...new Set(input.rooms)]
        .map(purpose => ({ purpose, ...roomAuthorityOf(purpose) }))
        .filter(r => r.sealed)
        .sort((a, b) => b.depth - a.depth || a.purpose.localeCompare(b.purpose));

    const room = whoDecidesIn({ roll: input.roll, rankCount: input.rankCount });
    if (room.length === 0) {
        return sealed.map(r => ({ purpose: r.purpose, holderId: null, depth: r.depth }));
    }
    return sealed.map((r, i) => ({
        purpose: r.purpose,
        holderId: room[i % room.length].id,
        depth: r.depth
    }));
}

/** What this person is in charge of, deepest first. */
export function whatTheyHold(
    portfolios: readonly APortfolio[],
    personId: string
): RoomPurpose[] {
    return portfolios
        .filter(p => p.holderId === personId)
        .sort((a, b) => b.depth - a.depth || a.purpose.localeCompare(b.purpose))
        .map(p => p.purpose);
}

/** Who answers first about this room, or null where nobody holds it. */
export function whoAnswersAbout(
    portfolios: readonly APortfolio[],
    purpose: RoomPurpose
): string | null {
    return portfolios.find(p => p.purpose === purpose)?.holderId ?? null;
}

export interface WhoseCallItIs {
    /** The room the question is about. */
    purpose: RoomPurpose;
    /** Who answers first, or null where the whole room does. */
    holderId: string | null;
    /** The body's answer, with the room narrowed to the holder if there is one. */
    answer: WhereTheBodyLands;
    /** True where one person answered rather than the room. */
    theirCallAlone: boolean;
    /** Engine truth, one line. Never narration. */
    line: string;
}

/**
 * Who answers a question about one room, and what they say. First refusal is a
 * NARROWING of the room handed to `whatTheBodyWants`, not a procedure of its own.
 */
export function whoseCallItIs(input: {
    purpose: RoomPurpose;
    portfolios: readonly APortfolio[];
    roll: readonly OnTheRoll[];
    rankCount: number;
    asking?: string | null;
    ledger?: Parameters<typeof whatTheBodyWants>[0]['ledger'];
    asOfDay?: number;
}): WhoseCallItIs {
    const holderId = whoAnswersAbout(input.portfolios, input.purpose);
    const everyone = whoDecidesIn({ roll: input.roll, rankCount: input.rankCount });
    const head = everyone.find((p: TheirSay) => p.isHead) ?? null;

    // With no holder the question was never anybody's and the whole room answers.
    const narrowed: OnTheRoll[] = holderId === null
        ? input.roll.slice()
        : input.roll.filter(p => p.id === holderId || (head !== null && p.id === head.id));

    const answer = whatTheBodyWants({
        roll: narrowed,
        rankCount: input.rankCount,
        ...(input.asking === undefined ? {} : { asking: input.asking }),
        ...(input.ledger === undefined ? {} : { ledger: input.ledger }),
        ...(input.asOfDay === undefined ? {} : { asOfDay: input.asOfDay })
    });

    const theirCallAlone = holderId !== null && answer.settledBy === 'the elders';

    return {
        purpose: input.purpose,
        holderId,
        answer,
        theirCallAlone,
        line: holderId === null
            ? `Nobody in this house holds ${input.purpose}, so it is not one person's to answer `
              + 'and the room decides it like anything else.'
            : theirCallAlone
                ? `It is ${holderId}'s room. They answered, nobody above them took it off them, `
                  + 'and there was no vote because there did not need to be one.'
                : `It is ${holderId}'s room and it was taken out of their hands: `
                  + `${answer.settledBy}. Being overruled about your own room is a different `
                  + 'thing from losing a general argument, and the house saw it.'
    };
}

function round4(n: number): number {
    return Math.round(n * 1e4) / 1e4;
}

/**
 * How many people could hold an office here against how many offices there are. The
 * design owner: *"a contested title is what makes sense? cuz that's what forces
 * people to leave, cuz there's less offices than people who can theoretically hold
 * that office."*
 */
export interface OfficePressure {
    /** Sealed rooms in this house. */
    offices: number;
    /** People at a deciding rung the house reads as finished climbing. */
    settled: number;
    /** The queue: settled people with no room. */
    waiting: number;
    /** Who they are, heaviest voice first. */
    whoIsWaiting: readonly string[];
    /** Engine truth, one line. Never narration. */
    line: string;
}

export function officePressureIn(input: {
    rooms: readonly RoomPurpose[];
    roll: readonly OnTheRoll[];
    rankCount: number;
    /** Years each decider has stood at their rung, by id. Absent reads as none. */
    yearsHeldById: Readonly<Record<string, number>>;
    /** Their rung on the cultivation ladder, by id. Absent reads as zero. */
    realmOrdinalById: Readonly<Record<string, number>>;
}): OfficePressure {
    const portfolios = whoIsInChargeOfWhat(input);
    const offices = portfolios.length;
    const room = whoDecidesIn({ roll: input.roll, rankCount: input.rankCount });

    const settledPeople = room.filter(p => howFinishedTheyLook({
        realmOrdinal: input.realmOrdinalById[p.id] ?? 0,
        yearsHeld: input.yearsHeldById[p.id] ?? 0
    }).looksFinished);

    const waiting = settledPeople.filter(p => whatTheyHold(portfolios, p.id).length === 0);

    return {
        offices,
        settled: settledPeople.length,
        waiting: waiting.length,
        whoIsWaiting: waiting.map(p => p.id),
        line: waiting.length === 0
            ? `${offices} rooms and ${settledPeople.length} settled - everybody who has stopped `
              + 'has something to run, so nobody here is counting the years somebody else has '
              + 'left.'
            : `${offices} rooms and ${settledPeople.length} settled, so ${waiting.length} of them `
              + 'have stopped climbing and have nothing to run. They are not failures and the '
              + 'house is not punishing them - there is simply no room, and the people holding '
              + 'the rooms are not going anywhere.'
    };
}

/**
 * A head turning an elder out of their room. The design owner: *"same idea to a
 * patriarch forcing an elder out and it costs him."* Available rather than blocked,
 * expensive and visible.
 */
export interface TurningThemOut {
    /** Who lost the room. */
    personId: string;
    /** The room they lost, so a caller can hand it to somebody else. */
    purpose: RoomPurpose;
    /** What it costs the head, from `leadership.ts`. Unmodified. */
    cost: ActCost;
    /** The elder who lost the room, plus every decider on their side of it. */
    whoResents: readonly string[];
    /** What they are afterwards. Not nothing. */
    theyBecome: HowTheyAreHeld;
    line: string;
}

export function turningThemOutOfTheirRoom(input: {
    personId: string;
    purpose: RoomPurpose;
    /** Disciples in that elder's own line. Priced by `expulsionCost`. */
    theirFollowing: number;
    houseSize: number;
    /** How many the head has already turned out. The insult compounds. */
    alreadyDone: number;
    /** Everyone else who decides here, so their resentment is legible too. */
    others?: readonly string[];
}): TurningThemOut {
    const cost = expulsionCost(
        Math.max(0, input.theirFollowing),
        Math.max(1, input.houseSize),
        Math.max(0, input.alreadyDone)
    );
    return {
        personId: input.personId,
        purpose: input.purpose,
        cost,
        whoResents: [input.personId, ...(input.others ?? []).filter(id => id !== input.personId)],
        // Elder standing survives it. What is gone is the room.
        theyBecome: 'settled, carried for what they are',
        line: `${input.personId} is out of ${input.purpose} and still an elder of this house. `
            + 'Nothing forbade it and it was not free: they keep their standing, they keep '
            + 'whoever follows them, and the head has bought a person who remembers.'
    };
}
