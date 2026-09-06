/**
 * WHAT SOMEBODY IS LIKE, AND WHERE IT CAME FROM.
 *
 * The design owner, on the side characters of the genre: *"they have
 * personalities. That should fall out."*
 *
 * FALL OUT, and not be a field. Everything below is a function of what the
 * world already rolled for this person at birth - the four attributes, where
 * they were born, how far they have come from it - and of their id, which is
 * the residue nothing else explains. Nobody stores a personality, nobody
 * authors one, and there is no table of characters anywhere.
 *
 * ── WHY THIS IS DERIVED WHEN ACTIVITY IS STORED ──────────────────────────
 *
 * The opposite call from `what-somebody-is-at-when-you-walk-up.ts`, and for
 * the reason the owner gave there: *"deriving it may not keep it consistent."*
 * An activity CHANGES - the whole point of it is that a lesson ends and an
 * expedition starts - so deriving it would freeze the world into a diorama and
 * two readings of one row could disagree about what is happening.
 *
 * A person does not change like that. Somebody who does not let go of what is
 * theirs is like that in the first year and the five hundredth, so deriving it
 * is what KEEPS it consistent: the same person reads the same way from every
 * angle, in every system, forever, with no field to drift out of step with the
 * person it describes. Same reason, opposite answer.
 *
 * ── AND NOTHING SWITCHES ON A NAME ───────────────────────────────────────
 *
 * The ruling `an-attempt-to-move-somebody.ts` already states: *"Nothing
 * switches on a personality name."* These are SCALARS on -1..+1 that a caller
 * multiplies by or bands into words. There is no `type Personality` and no
 * `case 'arrogant':` anywhere, because the moment there is one, the world has
 * sixteen people in it wearing different faces instead of four hundred people.
 * A new kind of person is a different number, and no code.
 *
 * `openHandednessOf` is the first of these axes and lives with the system that
 * needed it. These are the other two.
 */

import { forStream } from '../cultivation/rng.js';
import { getOrigin, ORIGIN_TIERS, type OriginTierKey } from '../cultivation/origin.js';
import type { InnateAttributes } from '../cultivation/spirit-roots.js';

/**
 * The most a birth can be worth against the person themselves.
 *
 * Under half, deliberately. Where somebody started tilts them and does not
 * decide them, which is the whole quarrel of the genre: the point of a thin
 * county is that somebody comes out of one.
 */
const WHAT_A_BIRTH_IS_WORTH = 0.4;

/** The residue nothing about them explains, which is most of what people are. */
const WHAT_NOTHING_EXPLAINS = 0.35;

/**
 * HOW HARD THEY PUSH, on -1..+1.
 *
 * Positive is somebody who goes at things directly and expects to be given
 * way; negative is somebody who goes around, waits, and lets it come to them.
 * This is the axis the genre's side characters are actually built on - the
 * young master who hits first and the disciple who out-works everybody are the
 * two ends of it, and both are commoner than either extreme of open-handedness.
 *
 * WHERE IT COMES FROM. Might against insight, which is the difference between
 * a person who settles a thing and a person who works out how to; plus how far
 * they have come from where they started, because somebody who has climbed
 * from nothing pushes and somebody handed a high seat has never had to. Note
 * the sign on the second term: a HIGH birth reduces the push. Nobody who was
 * given it needed to take it.
 */
export function howHardTheyPush(input: {
    id: string;
    attributes: InnateAttributes;
    origin: OriginTierKey;
    realmOrdinal: number;
}): number {
    // Might is 1..3 and insight is 1..4, so the lean is normalised against its
    // own span rather than assumed symmetric.
    const lean = (input.attributes.might - 1) / 2 - (input.attributes.insight - 1) / 3;
    const climbed = howFarFromTheStart(input.origin, input.realmOrdinal);
    return blend(input.id, 'disposition:how_hard_they_push', lean * 0.6 + climbed * WHAT_A_BIRTH_IS_WORTH);
}

/**
 * HOW MUCH THEY PLAY TO THE ROOM, on -1..+1.
 *
 * Positive is somebody who does it where it will be seen and counted; negative
 * is somebody who shuts a door and would rather nobody asked. Both are whole
 * people and neither is the better cultivator - the recluse who comes out at a
 * realm nobody expected and the disciple who has an audience for every
 * breakthrough are the same story told twice.
 *
 * Charm against insight for the lean, and a high birth adds to it: somebody
 * raised where they were always looked at goes on being looked at.
 */
export function howMuchTheyPlayToTheRoom(input: {
    id: string;
    attributes: InnateAttributes;
    origin: OriginTierKey;
}): number {
    const lean = (input.attributes.charm - 1) / 2 - (input.attributes.insight - 1) / 3;
    return blend(
        input.id,
        'disposition:how_much_they_play_to_the_room',
        lean * 0.8 + (heightOfTheBirth(input.origin) * 2 - 1) * 0.2
    );
}

/**
 * How far somebody has come from where they were put down, on -1..+1.
 *
 * Not a judgement and not a score. A thin-county birth standing at a high
 * ordinal is a long way from the start; an apex sect member's child at the
 * same ordinal has gone nowhere at all, and the genre is entirely clear that
 * these are different people.
 */
export function howFarFromTheStart(origin: OriginTierKey, realmOrdinal: number): number {
    // AGAINST WHAT THE BIRTH PREDICTED, and not against the top of the world.
    //
    // Measured, with the first version: a birth height on 0..1 was subtracted
    // from `ordinal / 24`, which reads a thin-county disciple at ordinal six as
    // having climbed half the distance available - so four fifths of the world
    // came out pushing, because four fifths of the world is born low. The two
    // numbers were on different scales and only looked comparable.
    //
    // A birth does not put you at a fraction of the world. It puts you at an
    // ORDINAL, which is the thing a climb is actually measured in.
    const expected = WHERE_A_BIRTH_PUTS_YOU.low
        + heightOfTheBirth(origin) * (WHERE_A_BIRTH_PUTS_YOU.high - WHERE_A_BIRTH_PUTS_YOU.low);
    return Math.max(-1, Math.min(1, (realmOrdinal - expected) / WHAT_A_LONG_WAY_IS));
}

/**
 * The ordinals the ends of the origin table hand somebody.
 *
 * Not what they can reach - where somebody of that birth ORDINARILY STANDS, so
 * that the median person of every birth reads as neither having climbed nor
 * fallen, and the axis measures the thing it is named for.
 *
 * MEASURED OFF THE WORLD RATHER THAN GUESSED, which is why these two numbers
 * are here and not rounder. Across a seeded world of six hundred: a thin-county
 * birth has a median ordinal of 7 and a dao-house bloodline a median of 22,
 * with market town, minor clan and established clan falling in between them in
 * the order `heightOfTheBirth` puts them. The first version guessed 3 and 18
 * and read four fifths of the world as having climbed, because four fifths of
 * the world is born low and 3 is under where any of them actually stand.
 */
const WHERE_A_BIRTH_PUTS_YOU = Object.freeze({ low: 7, high: 22 });

/** How far past your birth is a long way. Roughly a realm and a half of it. */
const WHAT_A_LONG_WAY_IS = 9;

/**
 * How high a birth was, 0..1, read off what the family could put in their hand.
 *
 * The measure is the origin table's OWN figure rather than a rank order kept
 * here, for two reasons. It cannot go stale - move a tier's stones and every
 * person born to it moves with the table. And the top of the table is three
 * siblings rather than three rungs (`OriginTierKey` says so), so there is no
 * honest ordering to keep in the first place; what a family could hand you is
 * a real fact about all three.
 */
export function heightOfTheBirth(origin: OriginTierKey): number {
    // Log, because the table spans three and a half orders of magnitude and a
    // linear read would put every birth below the top one on the floor. And
    // normalised against the table's OWN ends rather than a constant, so the
    // scale still uses its whole range after somebody reprices a tier.
    const at = logStones(getOrigin(origin).spiritStones);
    const { low, high } = whatTheTableSpans();
    if (high <= low) return 0.5;
    return Math.max(0, Math.min(1, (at - low) / (high - low)));
}

function logStones(stones: number): number {
    return Math.log10(Math.max(0, stones) + 1);
}

let span: { low: number; high: number } | null = null;

function whatTheTableSpans(): { low: number; high: number } {
    if (span === null) {
        const all = ORIGIN_TIERS.map(t => logStones(t.spiritStones));
        span = { low: Math.min(...all), high: Math.max(...all) };
    }
    return span;
}

/**
 * The two of them, off one record, for callers who want the person rather than
 * an axis. A convenience and not a type anything switches on.
 */
export function whatSomebodyIsLike(person: {
    id: string;
    identity: { origin: OriginTierKey };
    cultivation: { attributes: InnateAttributes; realmOrdinal: number };
}): { push: number; room: number } {
    return {
        push: howHardTheyPush({
            id: person.id,
            attributes: person.cultivation.attributes,
            origin: person.identity.origin,
            realmOrdinal: person.cultivation.realmOrdinal
        }),
        room: howMuchTheyPlayToTheRoom({
            id: person.id,
            attributes: person.cultivation.attributes,
            origin: person.identity.origin
        })
    };
}

/**
 * Where a reading stops being worth a sentence, and where it is the first thing
 * anybody would tell you. Held at the same figures as the open-handedness
 * bands, so three axes read at one strength rather than three.
 */
const WORTH_SAYING = 0.4;
const MARKED = 0.75;

/** How they go at a thing, said in words, or null when there is nothing to say. */
export function howTheyGoAtThings(push: number): string | null {
    if (!Number.isFinite(push)) return null;
    if (push >= MARKED) {
        return 'goes at things head on and expects to be given way, and has been '
            + 'right about that often enough to keep doing it';
    }
    if (push >= WORTH_SAYING) return 'pushes, where most people would wait';
    if (push <= -MARKED) {
        return 'never takes a thing head on, and is usually holding one end of it '
            + 'before anybody notices they were involved';
    }
    if (push <= -WORTH_SAYING) return 'goes around a thing rather than at it';
    return null;
}

/** Whether they want it seen, said in words, or null. */
export function howTheyWantItSeen(room: number): string | null {
    if (!Number.isFinite(room)) return null;
    if (room >= MARKED) {
        return 'does nothing where it cannot be counted, and knows to within a name '
            + 'who was standing there';
    }
    if (room >= WORTH_SAYING) return 'would rather do it where somebody is watching';
    if (room <= -MARKED) {
        return 'shuts the door on it, and would take a worse result over an audience';
    }
    if (room <= -WORTH_SAYING) return 'would rather nobody asked what they are working on';
    return null;
}

/** Exported for the tests and probes that pin the bands. */
export const HOW_A_PERSON_READS = Object.freeze({
    WORTH_SAYING,
    MARKED,
    WHAT_A_BIRTH_IS_WORTH,
    WHAT_NOTHING_EXPLAINS
});

/**
 * A derived lean, plus the part of a person nothing derives, clamped to -1..+1.
 *
 * The residue is not noise. Two people with the same attributes born in the
 * same county are not the same person, and the difference between them is not
 * a fact about either of them - so it is drawn off the id, which is stable
 * forever and belongs to nobody else.
 */
function blend(id: string, stream: string, lean: number): number {
    const key = (id ?? '').trim();
    if (key.length === 0) return 0;
    // Person in the seed slot and the constant in the stream slot, matching
    // `openHandednessOf`. Do not "fix" the argument order.
    const residue = forStream(key, stream).next() * 2 - 1;
    const blended = lean * (1 - WHAT_NOTHING_EXPLAINS) + residue * WHAT_NOTHING_EXPLAINS;
    return Math.round(Math.max(-1, Math.min(1, blended)) * 1e4) / 1e4;
}

/**
 * THE ONE CLAUSE A PERSON GETS, or null where there is nothing to say.
 *
 * `scene-person-readings.ts` already established the shape: a sentence gets at
 * most ONE clause of disposition, and only when the reading is MARKED. Two
 * clauses about somebody standing in a square is a character sheet read aloud,
 * and the third time a player sees one they stop reading them.
 *
 * So the deeper of the two axes wins, and neither speaks below the band. Most
 * people say nothing here, which is correct: a world where everybody is a
 * character is a world where nobody is.
 */
export function theOneThingWorthSayingAbout(person: {
    id: string;
    identity: { origin: OriginTierKey };
    cultivation: { attributes: InnateAttributes; realmOrdinal: number };
}): string | null {
    const { push, room } = whatSomebodyIsLike(person);
    if (Math.abs(push) < MARKED && Math.abs(room) < MARKED) return null;
    return Math.abs(push) >= Math.abs(room)
        ? howTheyGoAtThings(push)
        : howTheyWantItSeen(room);
}
