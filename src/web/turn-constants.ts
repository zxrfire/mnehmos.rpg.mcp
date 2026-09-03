/**
 * The numbers this deployment chose, which the engine has no opinion about.
 *
 * What a starting body is, what a short action costs in days, how much of a
 * stretch spent doing something else is also spent cultivating, and how
 * prepared a crossing counts as. The banner these arrived under says why they
 * are not in `src/engine`, and it is still the reason: the cultivation engine
 * only computes, and inventing a starting HP inside it would be inventing a
 * game rule in a module whose whole claim is that it does not.
 *
 * A focus is a fraction of a span, spent through the same time skip as
 * everything else, and none of them is a penalty - somebody on a road or
 * raising a child is not in seclusion, and the cost of that is simply that the
 * years go where the years go.
 *
 * Moved out of `game.ts` unchanged, because every verb family reads some of
 * these and a constant that lives in the module one caller happens to sit in
 * becomes a circular import the moment a second caller moves out.
 */
import type { Wrong } from '../engine/social-leverage/index.js';

// ─────────────────────────────────────────────────────────────────────────
// CHARACTER CREATION
// Not engine constants: the cultivation engine has no opinion about starting
// HP, and inventing one inside src/engine would be inventing a game rule in a
// module whose whole claim is that it only computes. They live here, where the
// web deployment's own choices belong.
// ─────────────────────────────────────────────────────────────────────────

export const STARTING_AGE = 16;
export const STARTING_LOCATION = 'Sweptground';
/** Base HP plus ten per point of Might: 30 to 50 at creation. */
export const BASE_HP = 20;
export const HP_PER_MIGHT = 10;
/** Base qi plus five per point of Insight: 15 to 30 at creation. */
export const BASE_QI = 10;
export const QI_PER_INSIGHT = 5;

/** Spirit stones for one meal at `eat`. */
export const MEAL_COST_STONES = 1;

/** Days a `travel` or `wait` action consumes. */
export const SHORT_ACTION_DAYS = 1;
/**
 * Days spent going into an inheritance ground.
 *
 * A deployment choice like `SHORT_ACTION_DAYS`, not an engine constant: the
 * engine has no opinion about how long a shaft is. What it buys is that going
 * in is never free - the food clock runs, the world moves, and a cultivator
 * who walks into a grave on their last ration can die of the walk rather than
 * of the grave, through exactly the survival layer everything else dies
 * through.
 */
export const ENTERING_DAYS = 3;
/**
 * A course of mortal care, in days.
 *
 * The catalog names it: `price-splint-and-month` is "Splint and a month of
 * care", and its note says it is the mortal alternative to a healing pill -
 * slower, cheaper, and it leaves you out of the fight for a season. The month
 * is the catalog's number; the season is what it feels like after two of them.
 */
export const TREATMENT_DAYS = 30;
/** Focus multipliers for time spent on something other than sealed seclusion. */
export const TRAVEL_FOCUS = 0.15;
export const GATHERING_FOCUS = 0.2;
export const WAITING_FOCUS = 0.25;
/** Nobody gathers qi while climbing down a lined shaft in the dark. */
export const ENTERING_FOCUS = 0.05;
/**
 * Lying still with a torn meridian is not seclusion.
 *
 * Not zero: the month passes and the body is doing something with it. Low
 * enough that nobody treats an infirmary as a cheap cave, which they would at
 * five stones a month if it cultivated.
 */
export const TREATMENT_FOCUS = 0.1;

/**
 * How much of a stretch spent raising somebody is also spent cultivating.
 *
 * Low, and it is not a penalty. Somebody who is bringing a person up is not in
 * seclusion, and the whole cost of a child in this world is that the years go
 * where the years go. The figure is a focus like every other focus in this
 * file and is spent through the same time skip.
 */
export const RAISING_FOCUS = 0.1;

/**
 * Spending a word rather than a purse, in the words a player says it in.
 *
 * The credit side of the obligation ledger has never had anywhere to go. This
 * is the phrase that puts one on the table, and what it is worth is decided by
 * the rung of whoever owes it rather than by anything here.
 */
export const CALLING_IN_A_FAVOUR =
    /\b(?:call(?:ing)? (?:it )?in|call in (?:a|the|my) favou?r|cash(?:ing)? in|remind (?:him|her|them) (?:what|that) (?:he|she|they) owes?|(?:he|she|they) owes? me|they owe me|what (?:he|she|they) owes? me|the favou?r (?:he|she|they) owes?)\b/;

/**
 * How prepared a crossing counts as, 0..1.
 *
 * The engine wants a number for "a chosen site, a cleared schedule, nobody
 * hunting you". This deployment models one of those honestly - whether the
 * purse actually covered the food for the whole stretch - so a fully
 * provisioned seclusion is half-prepared and nothing else is. Striking the
 * barrier on command is a deliberate but unaided choice.
 */
export const PROVISIONED_PREPARATION = 0.5;
export const DELIBERATE_PREPARATION = 0.25;
/** A shut door, a chosen site, and nobody coming through it. */
export const SEALED_PREPARATION = 0.75;
/** Below this, a crossing counts as hurried: too little time to sit properly. */
export const HURRIED_BELOW_DAYS = 30;

/**
 * Which interact intents are WRONGS, and what the wronged party calls them.
 *
 * Three of the ten. A threat, a lie and answers taken under pressure are
 * things a person answers; a bribe, a courtship, a recruitment pitch and a
 * refused request are not, however badly they land. `an-attempt-to-move-
 * somebody.ts` prices all ten identically and reads none of them, which is the
 * design - this table is downstream of the pricing and decides only what
 * happens NEXT, the same division `what-a-house-will-do-about-it.ts` makes.
 *
 * A closed table rather than a string test, so a verb added to the parser does
 * not silently acquire consequences nobody chose for it. An intent absent from
 * here produces no reprisal at all.
 */
export const WRONG_BEHIND_INTENT: Readonly<Partial<Record<string, Wrong>>> = {
    threaten: 'threatened',
    // A theft attempted to somebody's face is a lie about what your hand is
    // doing, so a model that labels one `deceive` still lands on a wrong.
    deceive: 'deceived',
    interrogate: 'interrogated',
    // And the verb itself, now that the deterministic parser can produce it.
    // `robbed` was the one member of `Wrong` nothing reached: the engine has
    // resolved a theft off a person since the pressure model was wired, and
    // only a MODEL could route a sentence to it - the parser answered every
    // phrasing with `unclear`. See the `steal` row in `INTERACT_INTENT_PATTERNS`.
    steal: 'robbed'
};
