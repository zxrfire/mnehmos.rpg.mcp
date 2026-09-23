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
 * What this cultivator has out of its sheath, and the turn they drew it.
 *
 * Stored as `<what>:<turn>`. A blade in a hand is a fact about a body that no
 * column holds, which is what this store is for; the alternative was an opinion
 * derived from the last sentence, and the last sentence is gone by the time
 * anybody reads it.
 *
 * WHAT MAKES IT LAPSE IS SAYING SO. It is cleared by putting the blade away and
 * by letting it go, and by nothing else - somebody who drew a sword and then
 * walked across a province is still holding a sword. A timer here would be the
 * engine deciding for the player that they had sheathed it.
 *
 * Read by `attack`: a concealed opening is not available to somebody standing
 * there with a blade already out. See `what-is-on-you-and-in-your-hands.ts`.
 *
 * ── WHAT THIS FLAG IS STILL OWED, AND BY WHOM ────────────────────────────
 *
 * Written down here rather than left as a gap, because the surfaces below
 * belong to other people and reaching into them would be worse than a note.
 * Both are readings the owner's rulings already imply; neither needs a new
 * number, only this bit consulted where the situation is already decided.
 *
 *   AT A GATE - DONE, and it turned out to be one input exactly as this note
 *   said. `aFaceAsOneOfTheHouseSeesIt` takes `bladeInHand` beside `inTheRobes`,
 *   and `whetherAFaceIsRemarkable` reads it one clause above the robes: the
 *   robes are what somebody blends in WITH, and a drawn blade is what no amount
 *   of blending survives. The bit is read inside `howTheirPeopleSeeYourFace`
 *   rather than passed by its callers, as the robes already are, so the gate
 *   and the lecture hall cannot come to read one face differently.
 *
 *   IN A DUEL'S TERMS. `whetherTheyAnswer` prices refusing a challenge, and
 *   `holdADuel` runs it under `DuelTerms` of `to_yield` or `life_and_death`.
 *   A challenge put with the blade already drawn says which of the two is
 *   meant before anybody has named it, and that is exactly what the terms
 *   field is for. Nothing here should decide it silently: it should reach
 *   whoever composes the challenge, so the player is told what the terms are
 *   being read as.
 *
 *   ON THE GROUND. `being-told-to-get-off-this-ground.ts` derives what
 *   refusing a demand looks like. Refusing it with a blade in your hand is the
 *   same refusal with the fight one step closer, and `whatRefusingLooksLike`
 *   is where that would be said.
 */
export const FLAG_BLADE_IN_HAND = 'blade_in_hand';

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
