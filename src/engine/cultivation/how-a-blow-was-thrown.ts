/**
 * ═══════════════════════════════════════════════════════════════════════════
 * A PUSH IS ASSAULT. A STABBING IS STILL AN ATTACK, JUST WITH A DIFFERENT THING.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * FOUND BY PLAYING, and then ruled on directly. The parser used to read an
 * ENDING out of the opening sentence. `ConfrontationIntent.goal` was one of
 * `kill | subdue | drive_off | humiliate | coerce`, and a regex in the verb
 * table picked between them off the words the player happened to use. The
 * comment above that regex said what it thought it was doing:
 *
 *     // SAYING HOW IS SAYING HOW FAR
 *
 * It is not. Measured against the real parser, fourteen sentences:
 *
 *     "i attack him"                 -> attack, drive_off
 *     "i run him through"            -> attack, drive_off
 *     "i stab him in the throat"     -> attack, drive_off
 *     "i stab him in the leg"        -> attack, drive_off
 *     "i push him"                   -> UNCLEAR
 *     "i shove him"                  -> UNCLEAR
 *     "i slap him"                   -> UNCLEAR
 *     "i grab him"                   -> UNCLEAR
 *     "i punch him"                  -> UNCLEAR
 *     "i kick him"                   -> UNCLEAR
 *     "i elbow him"                  -> UNCLEAR
 *     "i tackle him"                 -> UNCLEAR
 *
 * Three separate defects in one table. A killing thrust read as shooing
 * somebody away. A throat and a leg given the SAME answer, so where you struck
 * was read by the regex and then thrown away. And eight ways of laying hands on
 * a person that the game had no reading for at all.
 *
 * The design owner:
 *
 *   *"just make attacks and drive away the same thing"* -
 *   *"like attacks have severity but it's all an attack"* -
 *   *"a push is assault"* - *"a stabbing is still attack"* -
 *   *"just with a different thing"* - *"it shouldn't be split"*
 *
 * And then the whole model in two lines:
 *
 *   *"it depends on how you attack and how the NPC responds"*
 *   *"do you stab them? where? how hard?"*
 *
 * So there is ONE verb. What varies is not what you were trying to achieve, it
 * is WHAT WAS IN YOUR HAND, WHERE YOU AIMED IT, and HOW MUCH WAS BEHIND IT.
 * The ending is not chosen by anybody. It falls out of those three against the
 * body they landed on, and out of what that person does about it.
 *
 * Which is also the only model that can be honest. A player who types *"I run
 * him through"* has not declared a goal; they have described a swing. Whether
 * it kills depends on whether it lands, on what he is, and on whether he is
 * still standing when it arrives. The old model let the sentence decide the
 * outcome, which is the engine protecting or condemning somebody in advance -
 * the one thing the charter forbids outright.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE BOTTOM OF THE SCALE IS NOT NOTHING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   *"i slap his hand is an attack"* - *"and i poke probably gentlest"* -
 *   *"like probably 0 damage"* - *"but you might still annoy someone depending
 *   on relationship"*
 *
 * This is why DAMAGE and OFFENCE are two separate readings of one blow and not
 * one number. A poke does nothing to a body and is still something you did to a
 * person. A slap is the extreme case in the other direction: near-zero damage
 * and about as much offence as an act can carry without drawing blood, which is
 * exactly why people have died over one.
 *
 * A single severity number cannot hold both, and every version of this that
 * uses one ends up either making a poke harmless in every sense - so the player
 * learns that touching people is free - or making it hurt, which is absurd.
 *
 * What the offence is WORTH is not decided here, because it is not a fact about
 * the blow. It is read against what these two are to each other, which lives
 * with the relationships. This module says how much offence is IN the act; the
 * caller says what that is worth coming from this person to that one.
 */

/**
 * WHAT WAS IN THE HAND.
 *
 * `in_hand` is the unstated case and is deliberately NOT a synonym for `fist`.
 * A player who types *"I attack him"* while holding a sword attacked him with
 * the sword. Defaulting the bare form to a punch would quietly disarm every
 * cultivator in the world at the moment they swung.
 *
 * `open_hand` is the opposite and has to be named for the same reason: a shove
 * from somebody holding a blade is still a shove. It is the one instrument that
 * is chosen INSTEAD of what they are carrying, which is itself a statement.
 */
export type WhatWasInTheHand =
    /** Unstated. Whatever this person is actually carrying, resolved by the caller. */
    | 'in_hand'
    /** A shove, a slap, a grab, a poke. Chosen instead of the weapon, and that reads. */
    | 'open_hand'
    /** Bare and meant. */
    | 'fist'
    /** A staff, a cudgel, a pommel, a rock. Breaks things without opening them. */
    | 'blunt'
    /** An edge or a point. The only ordinary instrument that opens a body. */
    | 'edge'
    /** A named technique. What it can do is a fact about the art, not about the swing. */
    | 'art';

/**
 * WHERE IT WAS AIMED.
 *
 * `unstated` is the ordinary case and means the swing went wherever the fight
 * offered, which is what almost every real sentence describes. The named places
 * are only the ones that CHANGE WHAT THE BLOW CAN DO - there is no `shoulder`
 * here, because a blade in the shoulder and a blade in the ribs are the same
 * fact for everything downstream.
 *
 * `hand` earns its place from *"i slap his hand is an attack"*: it is the one
 * location that reliably carries more offence than injury, which is the whole
 * reason somebody aims there.
 */
export type WhereItWasAimed =
    | 'throat'
    | 'head'
    | 'spine'
    | 'chest'
    | 'gut'
    | 'limb'
    | 'hand'
    | 'back'
    | 'unstated';

/**
 * HOW MUCH WAS BEHIND IT.
 *
 * `committed` is what the bare *"I attack him"* means, and the default matters:
 * the old table defaulted the bare form to the WEAKEST reading it had, which is
 * how a killing thrust came back as shooing somebody away. Somebody who says
 * they attack a person is not trying to make them go away. They are fighting.
 */
export type HowMuchWasBehindIt =
    /** A poke, a prod, a finger in the chest. Zero damage by construction. */
    | 'a_poke'
    /** A shove, a slap, a grab. Meant to move somebody or to say something. */
    | 'light'
    /** A real blow. What the bare form means. */
    | 'committed'
    /** Everything they have, with nothing kept back for what comes after. */
    | 'everything';

/** One blow, as the sentence described it. */
export interface HowTheBlowWasThrown {
    with: WhatWasInTheHand;
    at: WhereItWasAimed;
    force: HowMuchWasBehindIt;
}

/**
 * WHAT THE BARE FORM MEANS.
 *
 * *"like if a player says i attack x, that's an attack"* - with whatever is in
 * their hand, wherever the fight offers, meant.
 */
export const AN_ORDINARY_SWING: HowTheBlowWasThrown = Object.freeze({
    with: 'in_hand',
    at: 'unstated',
    force: 'committed'
});

/**
 * SOMEBODY WHO HAS DECIDED TO END IT.
 *
 * Not a reading of anybody's sentence, and it must never be reachable from one.
 * It exists for the two places where a fight stops being the fight that was
 * started: a coercion whose target would rather die, and a felling blow struck
 * after the other party is already finished.
 *
 * Both need an answer to *"what does this do to them"* and neither can honestly
 * use the swing that OPENED the fight - a man who has decided to kill somebody
 * who refused him is no longer throwing the shove he began with, and asking
 * about the shove would answer that a person who would rather die walked away
 * unhurt.
 */
export const A_BLOW_MEANT_TO_END_IT: HowTheBlowWasThrown = Object.freeze({
    with: 'edge',
    at: 'throat',
    force: 'everything'
});

/**
 * TWO PEOPLE FINDING OUT WHERE THEY STAND.
 *
 * Bare hands, meant, nowhere in particular. A bout between people who both
 * expect to walk away is not a gentler version of a killing - it is a different
 * swing, and this is the one they throw.
 *
 * It is also what makes a friendly bout that goes too far honest. Nothing here
 * puts a floor under anybody: fists at the head with everything behind them
 * still reach `a_death`, and the crippling and HP paths run exactly as they do
 * in any other fight. What this says is only that the blow these two OPENED
 * with was not one meant to finish anybody.
 */
export const A_BOUT_BETWEEN_PEOPLE_WHO_EXPECT_TO_WALK_AWAY: HowTheBlowWasThrown = Object.freeze({
    with: 'fist',
    at: 'unstated',
    force: 'committed'
});

/**
 * The worst this blow could do to an ORDINARY body of roughly its owner's
 * height, if it lands clean and nothing stops it.
 *
 * Deliberately not a number, and deliberately not final. Height is not read
 * here: a Core Formation cultivator's open-handed slap kills a mortal, and
 * saying otherwise here would be the engine putting a floor under somebody the
 * charter says has no floor. This is the CEILING OF THE ACT, which the caller
 * then weighs against the gap - and the gap can carry it past this line.
 */
export type TheWorstItCouldDo =
    /** Nothing a body would notice. It was never about the body. */
    | 'nothing_at_all'
    /** It will be sore. It will not matter tomorrow. */
    | 'a_bruise'
    /** They go down and they get up. */
    | 'a_beating'
    /** Something that is still true in a year. */
    | 'a_wound_that_stays'
    /** It can finish them. */
    | 'a_death';

/** Where a blow lands that opens or breaks something that cannot be spared. */
const NOWHERE_A_BODY_CAN_SPARE: readonly WhereItWasAimed[] = ['throat', 'spine', 'head', 'chest'];

/**
 * What this blow could do at its worst.
 *
 * The rule underneath every branch: an instrument sets the ceiling, and where
 * it lands can raise that ceiling by one step but never lower it. A fist is a
 * beating; a fist to the head at everything they have is a death, and people
 * die that way constantly. An edge is a wound that stays; an edge in the throat
 * is a death. And nothing at all is a death, because `a_poke` is zero by
 * construction and not by degree.
 */
export function theWorstItCouldDo(thrown: HowTheBlowWasThrown): TheWorstItCouldDo {
    // ZERO IS ZERO. Not a small number, and not raised by aiming it well: the
    // whole point of a poke is that it does not act on the body at all.
    if (thrown.force === 'a_poke') return 'nothing_at_all';

    // AN ART IS A FACT ABOUT THE ART. Nothing here knows the grade, the
    // ordinal, or whether it reaches a soul; the caller does and has to say so.
    // Reporting a ceiling this module cannot know would be worse than useless.
    if (thrown.with === 'art') return 'a_death';

    const somewhereVital = NOWHERE_A_BODY_CAN_SPARE.includes(thrown.at);
    const allOfIt = thrown.force === 'everything';

    switch (thrown.with) {
        case 'edge':
            // An edge opens a body. That is the whole of what an edge is for,
            // and it is why the genre arms everybody who can afford one.
            return somewhereVital || allOfIt ? 'a_death' : 'a_wound_that_stays';

        case 'blunt':
            // Breaks rather than opens. Which is not gentler where the thing
            // it breaks is a skull or a spine.
            return somewhereVital && (allOfIt || thrown.at === 'head' || thrown.at === 'spine')
                ? 'a_death'
                : 'a_wound_that_stays';

        case 'fist':
            if (thrown.force === 'light') return 'a_bruise';
            // People are killed with bare hands, and NOTHING HELD BACK is the
            // condition that does it - not the target. Somebody beaten to death
            // was not usually struck anywhere clever.
            //
            // `committed` stops short of this on purpose, and that is what
            // keeps a friendly bout a bout: two people finding out where they
            // stand throw committed blows, not everything they have. The
            // 2,666-bout measurement in `nobody-is-invincible.ts` rests on this
            // line.
            return allOfIt ? 'a_death' : 'a_beating';

        case 'open_hand':
            // THE TWO THINGS BARE HANDS DO THAT KILL. A grip on a throat with
            // everything behind it is strangling, and a neck twisted with
            // everything behind it is a broken spine. Both are open hands, and
            // both are as final as anything with an edge on it.
            //
            // The spine half was missing and *"I break her neck"* came back a
            // beating - the sentence the genre uses when somebody is being
            // killed quietly, priced as a scuffle.
            if (allOfIt && (thrown.at === 'throat' || thrown.at === 'spine')) return 'a_death';
            // Every other open hand is an insult with a bruise attached.
            return thrown.force === 'light' ? 'a_bruise' : 'a_beating';

        case 'in_hand':
        default:
            // Unresolved: the caller knows what they are carrying and should
            // resolve it before asking, because a sword and an empty hand do
            // not otherwise share a ceiling.
            //
            // But UNRESOLVED IS NOT HARMLESS. This returned a beating for
            // anything not aimed somewhere vital, and the measured consequence
            // was that *"I kill the thief"* stopped killing anybody: the
            // sentence says everything about the force and nothing about the
            // target, which is how people write it. Somebody swinging with
            // everything they have, with whatever they carry, at a person, can
            // kill them - and this world does not put a floor under anybody.
            return allOfIt ? 'a_death' : 'a_beating';
    }
}

/**
 * HOW MUCH OFFENCE IS IN THE ACT.
 *
 * Separate from damage on purpose, and running the OTHER WAY along most of the
 * scale. The acts people kill each other over are near the bottom of the damage
 * range: a slap, a poke in the chest, a hand knocked aside. A committed punch
 * insults somebody less than an open-handed slap does, because a punch treats
 * them as a threat and a slap treats them as furniture.
 *
 * At the top the two converge again, but not because the offence rises - a
 * blade in the back is not INSULTING, it is something else entirely, and the
 * grudge it seeds is seeded by the injury and not by this reading.
 *
 * What this is WORTH is not decided here. *"you might still annoy someone
 * depending on relationship"* - so the caller weighs it against what these two
 * already are to each other. The same poke is nothing from a brother and a
 * declaration from a stranger.
 */
export type HowMuchOffence =
    /** Contact nobody would remark on. */
    | 'none'
    /** They will remember it. Whether it matters is about the two of them. */
    | 'a_slight'
    /** Done where it can be seen, and meant to be. */
    | 'an_insult'
    /** Past insult. This is somebody saying what they think you are worth. */
    | 'contempt';

/** Aimed to say something rather than to do something. */
const AIMED_TO_BE_FELT_NOT_TO_LAND: readonly WhereItWasAimed[] = ['hand', 'head'];

/**
 * What is in the act, before the relationship is read against it.
 *
 * The open hand carries almost all of it. That is not a quirk of the table: it
 * is what an open hand MEANS. Choosing it over the weapon you are holding is
 * the statement, and choosing it against somebody who could kill you is a
 * bigger one.
 */
export function theOffenceInIt(thrown: HowTheBlowWasThrown): HowMuchOffence {
    if (thrown.with === 'open_hand') {
        // A slap to the face, or a hand knocked aside. The two places you aim
        // when the point is to be FELT rather than to land.
        if (AIMED_TO_BE_FELT_NOT_TO_LAND.includes(thrown.at)) return 'contempt';
        if (thrown.force === 'a_poke') return 'an_insult';
        return thrown.force === 'light' ? 'an_insult' : 'a_slight';
    }

    // A poke with anything is a poke, and a finger in the chest is a finger in
    // the chest whatever else that hand is holding.
    if (thrown.force === 'a_poke') return 'an_insult';

    // Struck from behind. Not an insult to the person so much as a statement
    // about what the striker thought was necessary, which people do read.
    if (thrown.at === 'back') return 'a_slight';

    // A committed blow with a real instrument is violence and not commentary.
    // It seeds what it seeds through the injury it leaves, not through this.
    return 'none';
}

/**
 * Whether this blow acts on a body at all.
 *
 * The one predicate a caller needs before running an exchange, because a blow
 * that cannot do anything to a body should not be resolved as one. It still
 * HAPPENED - it is still an attack, it still reaches the person, and it still
 * carries whatever `theOffenceInIt` says it carries. It just has nothing for
 * the damage arithmetic to chew on.
 */
export function itActsOnTheBody(thrown: HowTheBlowWasThrown): boolean {
    return theWorstItCouldDo(thrown) !== 'nothing_at_all';
}
