/**
 * The keys this deployment stores per-cultivator flags under.
 *
 * A flag is a small durable fact about one cultivator that has no column of
 * its own - who they last addressed, whether they have taken the unearned
 * step, how many rations are in the pack, who took them on as a master. The
 * strings are here rather than beside whichever verb writes them because
 * reading and writing a flag are almost never the same verb: the pack is
 * filled by provisioning and drawn down by a seclusion, and a master is
 * written by a request and read on every cultivation span.
 *
 * A key that lives in the module of one of its two callers becomes a circular
 * import the moment that caller moves out, which is what happened here.
 */

/** Who the player last put something to. The referent a pronoun stands in for. */
export const FLAG_LAST_ADDRESSED = 'last_addressed';

/**
 * That this body has already been carried across once, and will not be again.
 *
 * `ONCE_IN_A_LIFE` in `immortal-items.ts`: one Heaven-Ascending Golden Pill per person, ever.
 * A flag rather than a derived fact, because the thing it records is that an
 * EVENT happened - the ordinal it produced is indistinguishable afterwards from
 * one somebody climbed to, which is precisely what makes the object socially
 * expensive and mechanically final.
 */
export const FLAG_STEP_TAKEN = 'unearned_step_taken';

/**
 * Where rations bought ahead of time are kept.
 *
 * A per-cultivator counter rather than a new table: the engine already owns
 * a flag store keyed exactly this way, and a schema change to hold one
 * integer would be a migration this layer has no business writing.
 */
export const FLAG_RATIONS_HELD = 'rations_held';

/**
 * The notices this cultivator turned in, by notice id (house, sending and window): the first to
 * turn one in is paid and its paper comes down. See `a-notice-is-turned-in.ts`.
 */
export const FLAG_NOTICES_TURNED_IN = 'notices_turned_in';

/**
 * Who is on their knees in front of this cultivator, and the turn it happened.
 *
 * Stored as `<id>:<turn>`. A submission is the outcome of a confrontation and
 * the fight row ends with it, so without this the fact that somebody yielded
 * exists for exactly one turn's prose and then nowhere - which is why the
 * affordance strip went on offering travel and a reading list to somebody
 * standing over a person who had just knelt.
 *
 * What makes it lapse is PRESENCE rather than a timer. Somebody who yielded and
 * then walked off is not yielding to anybody, and the strip already knows who is
 * in the square; a countdown here would be a second answer to a question the
 * room already settles. The turn is kept for the engine channel and for
 * whatever wants to know how long ago.
 */
export const FLAG_YIELDING_TO_YOU = 'yielding_to_you';

/**
 * Days already put into the next stage of one manual, keyed by which manual.
 *
 * `derivation_days:<manualId>`. A stage is a whole unit of method or it is
 * notes, so the work is finished or it is not - but it does not have to be done
 * in one sitting, and it could not be: `daysActuallySpent` cuts every stretch at
 * its first encounter, and the shortest derivation in the game is nineteen
 * years. Measured on a played run: the first attempt lived 450 days of 6,935,
 * so an all-or-nothing stretch made the verb unreachable in practice.
 *
 * So the years accumulate here and the stage is written when they are all in,
 * which is also what the fiction wants - a cultivator goes back to a manuscript
 * for decades. Cleared the moment the stage lands.
 */
export const derivationDaysKey = (manualId: string): string =>
    `derivation_days:${manualId}`;

/**
 * That this cultivator is carrying nothing that says what they are.
 *
 * `what-you-are-not-showing.ts` reads a concealment off the SENTENCE, per act,
 * and its header argues for that: *"a concealment is a thing you are DOING
 * while you say something, not a hat"*. True of a manner attached to an act,
 * and not true of the thing the genre is actually about - the cultivator who
 * walks into a town reading as a mortal and goes on reading as one while they
 * buy rice and ask directions.
 *
 * So the declaration can stand. Set by `conceal/cultivation`, cleared by
 * `conceal/show`, and folded into the SAME predicate the per-sentence
 * declaration feeds (`theyAreNotShowingWhatTheyAre`), so nothing downstream
 * grows a second way of asking the question.
 *
 * NO SECOND RUNG IS STORED. What somebody is taken for is `apparentOrdinal`'s
 * answer at the moment they are looked at, which is the only place it can be
 * right. See `keeping-yourself-out-of-sight.ts`.
 */
export const FLAG_WEIGHT_PUT_AWAY = 'weight_put_away';

/**
 * That this cultivator went over a house's wall and is inside it without its leave: the house and
 * its seat, and the day. Stored because how somebody got in cannot be read off where they stand. A
 * guest walked in behind a host stands in the same forecourt. See `inside-without-leave.ts`.
 */
export const FLAG_INSIDE_WITHOUT_LEAVE = 'inside_without_leave';
