/**
 * The closed action set - phase 1 of the narrator loop.
 *
 * The model is never asked "what happens?". It is asked exactly one question:
 * *which of these nine verbs did the player mean, and with what duration?* The
 * answer comes back as JSON, is parsed by the schema below, and anything that
 * does not fit is thrown away in favour of the deterministic parser at the
 * bottom of this file.
 *
 * Two properties make this the authority boundary rather than a suggestion:
 *
 *  1. THE ENUM IS CLOSED. `action` is a Zod enum over ACTION_NAMES. A model
 *     that answers `"ascend"`, `"gain_spirit_stones"` or `"set_realm"` fails
 *     validation, and a failed validation is not an error path the player
 *     notices - it falls back to the keyword parser and the game continues.
 *
 *  2. THE OBJECT STRIPS. Zod's default object mode drops unknown keys, so a
 *     response of `{"action":"cultivate","realmOrdinal":24,"spiritStones":9999}`
 *     yields exactly `{action:'cultivate'}`. There is no code path anywhere in
 *     src/web that reads a number out of a model response and writes it to the
 *     database; the only numeric field that survives here is `days`, and `days`
 *     is an *input* to a deterministic simulation, not an outcome of one.
 */

import { z } from 'zod';
// The leverage enum the social resolver reads. Set by the parser so that
// nothing downstream has to translate a verb into a mechanic.
import { ApproachLeverageSchema } from '../schema/cultivation.js';

import { SITE_PHRASES } from './trials.js';
// The board's own titles, so any name the game prints is a name it accepts.
import { SUMMONS_ENTRIES, COMMISSION_ENTRIES } from '../engine/encounters/duties.js';
import { legacyStep } from './leaving-things-for-the-next-life.js';
import { requestPutToSomebody } from './what-a-request-asks-and-of-whom.js';
import { IMMORTAL_ITEMS } from '../data/cultivation/immortal-items.js';

// A namespace import of THIS module, read lazily and only to take the phrase
// patterns below back out as a spelling vocabulary. It is a live binding, so
// by the time anybody has typed a sentence every constant here is
// initialised. See the header of the spelling module for why the vocabulary
// is harvested from the patterns rather than written down beside them.
import * as thePatternsInThisFile from './actions.js';
import {
    harvestVocabulary,
    inThePlayersOwnSpelling,
    respellForTheVerbTable
} from './repairing-a-misspelt-word-before-the-verb-table-sees-it.js';

/** Longest stretch of seclusion that may be requested in one call: 100 years. */
export const MAX_CULTIVATION_DAYS = 36_500;

/** Days of seclusion assumed when the player says "cultivate" with no duration. */
export const DEFAULT_CULTIVATION_DAYS = 30;

/** Days a stretch of technique practice consumes. */
export const TRAINING_DAYS = 7;

/** Days a stretch of foraging consumes. */
export const GATHERING_DAYS = 7;

/** Days a burial takes when no duration is named. A week with a spade. */
export const DEFAULT_BURIAL_DAYS = 7;

/** Days sealed closed-door seclusion runs for when no duration is named. */
export const DEFAULT_SECLUSION_DAYS = 365;

/**
 * Days of work assumed when the player says "take work" with no duration.
 *
 * A season. Long enough to be worth the walk and short enough that a hungry
 * cultivator is not committing the rest of their life to a granary.
 */
export const DEFAULT_WORK_DAYS = 90;

/**
 * Every action the engine can execute. Closed, and short on purpose.
 *
 * ── Why it is not a verb list ─────────────────────────────────────────────
 * A flat taxonomy of verbs only grows. `negotiate, deceive, trade, flee`
 * becomes `bribe, threaten, spy, interrogate, steal, sabotage, recruit,
 * intimidate`, and every social nuance ends up as an engine mechanic. So the
 * expressive range lives in PARAMETERS instead:
 *
 *   interact      target + intent   dealing with a person or a faction
 *   investigate   target            examining a place, record, object, person
 *   move          target + intent   going somewhere, by whatever means
 *
 * alongside the world-facing operations that genuinely are distinct engine
 * routines with distinct state effects.
 *
 * `intent` is a free-ish label, and it is safe precisely because NOTHING in
 * the engine branches on it to decide an outcome. It is carried for the
 * narrator to reason about and for the log to record. The moment a line of
 * code reads `if (intent === 'bribe')` to pick a result, the design has
 * failed: the outcome must come from state - who these people are, what they
 * want, what they know, what is owed - not from the word the player used.
 *
 * The closed enum is the protection that stays. A model cannot widen this list
 * at runtime, so it cannot invent an action; adding a member is a deliberate
 * act that the compiler forces into `GameService.execute`.
 */
export const ACTION_NAMES = [
    // Semantic actions. The expressive surface, held open by parameters.
    'interact',
    'investigate',
    'move',
    // World-facing operations: distinct engine routines, distinct state effects.
    /**
     * Hitting somebody, which for a long time had no route at all.
     *
     * The engine has carried a full confrontation model the whole time -
     * power assessment, edges, vectors, obligations, wounds that persist -
     * and the only thing a player could do with it was assess. Meanwhile
     * "I attack the nearest cultivator" fell through the entire table and
     * was caught by the cultivation branch, which sat them down to breathe
     * for a month. An enum member that plain English cannot reach is bad;
     * a missing one that lets another verb eat the sentence is worse.
     */
    'attack',
    'cultivate',
    'seclude',
    'breakthrough',
    'train_technique',
    'refine',
    'gather',
    'eat',
    /**
     * Laying in food before it is needed.
     *
     * The engine has modelled provisions the whole time - the time skip
     * consumes rations, `provisions_exhausted` fires when they run out, the
     * price of a month of them is in the catalog and on the market board -
     * and the only food verb a player could reach was `eat`, which buys one
     * meal and refuses when they are not already hungry. So the interrupt
     * was warning them about a resource they had no way to acquire, and the
     * correct opening move in this game was unavailable.
     *
     * Satiety burns about two a day against a hundred, so a character
     * starves at about fifty days and the default seclusion is thirty. Two
     * cultivations and a death was the likeliest first session.
     */
    'provision',
    /**
     * Getting a wound seen to, which was a softlock.
     *
     * `treatWorstInjuries` has been in `engine/cultivation/injuries.ts` the
     * whole time and `scripts/playtest.ts` exercises it, so the mechanic
     * existed and only the route was missing. What that produced, found by
     * playing cold in a browser: a cultivator at Qi Condensation with three
     * untreated meridian injuries, told by the engine in as many words that
     * nothing heals them on their own and that any further combat is fatal.
     * Untreated injuries raise deviation risk, deviation adds another injury
     * and ejects them from seclusion after about a month, and the next attempt
     * goes wrong slightly sooner. They could not advance, could not heal, and
     * could not die - the run was neither winnable nor loseable, with three
     * hundred spirit stones in the purse and a physician advertised on the
     * board in front of them.
     *
     * An engine that manufactures a state it labels lethal, says outright that
     * it will not resolve itself, and offers no verb is worse than one that
     * never had the state.
     */
    'treat',
    /**
     * Buying something off the price board by name.
     *
     * `mortal-world.ts` advertises twenty-two priced lines and `market` prints
     * them; until this existed, four of the verbs that would spend money -
     * `eat`, `provision`, `refine`, `market` - covered exactly three of those
     * lines between them. "I buy a visit from the mortal physician" fell to the
     * INTERACT table, which looked for a person called "visit from the mortal
     * physician" and reported that nobody by that name was there. A price
     * quoted to a player who cannot pay it is a shop window with a wall behind
     * it.
     */
    'buy',
    /**
     * Putting something on the counter, which is the only way anything a
     * cultivator gathered ever becomes stones again.
     *
     * `quoteSale` and `quotePouchSale` have priced this the whole time, and
     * nothing called them. What that produced, found by playing: gathering
     * prices every herb it finds, the pouch fills with things with a list
     * value written next to them, and the purse stays empty, because there was
     * no sentence in the language that converted one into the other. "I sell a
     * Qi Grass" fell to the INTERACT table and the engine went looking for a
     * person called Qi Grass.
     *
     * The pouch is the resolver, not the party. A thing you are not carrying
     * cannot be sold, and a person is never a lot.
     */
    'sell',
    /**
     * What is in the pouch, asked in words.
     *
     * `alchemy_manage.inventory` has been complete the whole time - pills,
     * herbs, stones, accumulated toxicity against tolerance - and no sentence
     * reached it. Exactly the defect `list_recipes` had: a player could gather
     * for a season and have no way to find out what they were carrying, which
     * makes both the cauldron and the counter unusable.
     */
    'inventory',
    /**
     * Swallowing a pill.
     *
     * `alchemy_manage.consume_pill` is complete - the catalog row decides the
     * effect, toxicity accumulates on the body whether anybody wanted it to,
     * and a breakthrough pill is RECORDED for the next attempt rather than
     * asserted at it - and no sentence reached it. Two consequences, and the
     * second is the bigger:
     *
     *   The six `heal_hp` pills could be bought and never swallowed. A new
     *   cultivator could spend 28 of their 30 stones on a Minor Healing Pill
     *   and carry it to their death.
     *
     *   `handleConsumePill` is the ONLY writer of `FLAG_PENDING_PILL`, so
     *   `ctx.pill` at a breakthrough was always null and `MAX_PILL_BONUS` -
     *   0.35, the largest modifier in the game and the intended way past the
     *   rungs that kill - had never once fired in play.
     */
    'consume_pill',
    /**
     * The arts that could be learned, and the learning of one.
     *
     * `technique_manage.handleListAvailable` and `handleLearn` are complete -
     * realm gates, dao gates, element compatibility, per-run scarcity, and the
     * qi deviation a conflicting art routes through - and neither was
     * reachable. `train_technique` practises what is ALREADY known, so until
     * this existed the only arts a cultivator could ever hold were the ones a
     * site handed them.
     */
    'list_techniques',
    'learn_technique',
    /**
     * How a manual could go further, by every route there is.
     *
     * ONE COMMAND, THREE COSTS. Finding the next volume, being taught it and
     * writing it yourself are the same question asked of a world that answers
     * differently depending on what you have, and `assessAcquisition` funnels
     * all three through one report. A player standing at a ceiling has three
     * things they might do and had no way to compare them; the engine could
     * price all three the whole time and nothing asked it to.
     *
     * A read, and free, which is what makes it worth having: the decision is
     * the content, so the comparison must not itself cost a decade.
     */
    'acquisition',
    /**
     * ── THE THREE QUESTIONS A DRIVEN PLAYER ASKS AND COULD NOT ────────────
     *
     * Added together because they are one measurement.
     * `scripts/playtest-the-drive.mjs` puts the four questions a player asks
     * when they want something, in five plain phrasings each, over the real
     * `/api/act` endpoint. Joining a sect scored 5/5. These three scored 0/5,
     * 0/5 and 2/5, and the middle column was the finding: three of the five
     * "who can teach me" phrasings were DEFLECTED rather than refused - the
     * engine replied, the reply looked like an answer, and it was about
     * something else. "who could guide my cultivation" returned the character
     * sheet. "I look for a master" returned the room.
     *
     * A deflection is worse than a refusal because a player cannot tell it
     * from the game being small. All three route to a READ, so a misfire costs
     * nothing but a moment.
     */
    /**
     * Why nothing is accumulating, with the binding gate named.
     *
     * The engine has known the answer the whole time and said it in one place:
     * `techniqueCeiling(...).line` on the STATUS read, forty lines down a sheet
     * a player asks for when they want their hit points. Everything else - the
     * province's `localCeilingOrdinal`, the seat's two bars, the stagnation
     * clock that `stagnation_aging` kills on - was reachable by no sentence at
     * all. Twelve honest lives ended at ordinal 0 after fifty years of
     * two-year seclusions with nothing anywhere saying why.
     */
    'ceiling',
    /**
     * Who stands above them and would teach, said only of people they know of.
     *
     * `members.ts` has carried `role: 'master'` and a three-limit `teaching`
     * object on every person in the catalog since it was written, and
     * `rosterFor` already joins it to the player's own knowledge rows. Nothing
     * asked for it.
     */
    'teacher',
    /**
     * Where they could go, priced, with the qi and the province's ceiling.
     *
     * Distinct from `recall`, which reads their own head and answers "what
     * have I heard of". A name is not a destination until it has a cost and a
     * reason next to it, and the catalog holds both.
     */
    'destinations',
    'wait',
    // The mortal economy. Half the deaths in this world are logistical, and
    // these are the two verbs that answer that - so they must be reachable
    // from plain English or the logistics layer might as well not exist.
    'work',
    'market',
    // Joining a sect is one of the most consequential things a low cultivator
    // can do - access to comprehension, to a stipend, and to knowing what is
    // out there - and it was unreachable from plain English.
    'sect',
    /**
     * Inheritance grounds: the trials and the graves.
     *
     * `data/cultivation/inheritance-trials.ts` is the largest finished system
     * in the project - twenty-odd sites, three unrelated kinds of gate, an
     * interior the type system keeps out of the pre-entry view - and until
     * this member existed nothing a player could type reached a single line
     * of it. `scripts/playtest-systems.ts` reported it as the finding: the
     * trials existed and were unplayable.
     *
     * One action carrying four verbs, on the `sect` precedent, because they
     * are four steps of one act and splitting them across `move`, `look` and
     * `investigate` would put the expensive one behind a verb whose whole
     * design is that it is cheap. See {@link SiteIntent}.
     */
    'site',
    /**
     * Putting things beyond your own death, and collecting what somebody else
     * put beyond theirs.
     *
     * Five steps of one act, on the `site` precedent: listing the counters,
     * burying a cache, digging one up, lodging a deposit against a phrase, and
     * claiming one. Splitting them across `move`, `interact` and `investigate`
     * would put the two that spend something behind verbs whose whole design
     * is that they are cheap.
     */
    'legacy',
    /**
     * ── INSTITUTIONS ACTING ON EACH OTHER, AND ON THE DEAD ────────────────
     *
     * Four verbs added together because they are one discovery, made by
     * playing the ambitious things a player reaches for once they know the
     * world exists. Twelve sentences from a sect head with fifty thousand
     * stones who had heard of every faction; all twelve dead, and five of them
     * dead in the worse way - swallowed by `interact`, which matches any
     * sentence naming a faction and answers it by walking the player over and
     * describing them. A player asking for something enormous got a shrug and
     * could not tell REFUSED from NOT IMPLEMENTED.
     *
     * The vocabulary above covers a cultivator's own life - train, eat, fight,
     * seclude, join, climb, be treated, buy - and almost nothing of what
     * institutions do to each other, or to you beyond membership. That is
     * where nearly all of the lore lives, and most of it is behind a form.
     *
     * All four share one shape: A PARTY ASKING SOMETHING OF ANOTHER PARTY, OF
     * THE DEAD, OR OF SOMEBODY ABOVE THE LID - and most of them are supposed
     * to be REFUSED. A refusal that names its reason is the win condition
     * here, not a consolation. The Requisition Against Standing Stock has been
     * granted once in four hundred years, and a player filing it and being
     * turned down in the terms the form itself uses has had a complete
     * interaction.
     *
     * Every one is gated on standing, and the gate speaks - see
     * `web/standing.ts`, which copies the refusal `sect-leadership.ts` already
     * produces rather than inventing a second voice for the same act.
     */
    /**
     * Asking an institution for a thing: a grant, an object off its standing
     * stock, recognition of a lineage.
     *
     * `sect-politics.ts` has carried `handlePetition` the whole time - it walks
     * the parentage chain one tier at a time, stops where the world stops it,
     * and returns the effect without the attribution where the chain runs past
     * what the player can name. Nothing typed reached it.
     */
    'petition',
    /**
     * One house's stance toward another: war, alliance, defection.
     *
     * `DISASTER_RESPONSES` prices war, aid and watching; `OPENLY_OR_IN_SECRET`
     * distinguishes an alliance from a conspiracy and says how each fails;
     * `ambition.contestedWith` holds nineteen symmetric contested claims and
     * `rivals` holds the feuds. Two courts in the catalog's own history have
     * already changed patrons. There was no verb for any of it.
     */
    'posture',
    /**
     * The thing under the mountain.
     *
     * Six houses hold a sealed ancestor with a written `wakeCondition` and
     * `wakeCost`; the strongest stands at forty-four. The legal and the illegal
     * routes are different acts by different people, and the action does not
     * ask which - whose mountain it is decides, out of the membership row.
     */
    'seal',
    /**
     * The offering upward, and the reading of a silence.
     *
     * `IMMORTAL_CHANNELS` models four answering channels, what each returns and
     * how much of it is usable; `MillennialOffering` is a type with a cost, a
     * response that is usually null, and what the house did about it. The
     * silence is equally consistent with four things and the engine will not
     * say which, which is the content rather than a gap.
     */
    'offer',
    /**
     * Going back down through the Lid, which is the only thing at the top of
     * the ladder that is a decision rather than a fact.
     *
     * `evaluateLidTransit(cultivator, 'down')` has priced this the whole time -
     * permitted, at `DESCENT_TRIBULATION_STRIKES` - and nothing called it, so
     * a True Immortal could be told what descending would cost by a comment in
     * the engine and by nothing a player could reach. What that produced,
     * found by playing at ordinal 46: every mortal-world verb answered "Not
     * from here" and there was no other verb, so the far side of the Lid read
     * as the game ending rather than as the game moving.
     *
     * It is not a travel option and must never become one. Nine strikes is
     * above the heaviest crossing in the game, the window on the ground is
     * `BREATHS_IN_THE_LOWER_REALM`, and the expulsion happens on its own
     * because a True Immortal down there is a thing being pushed back out.
     */
    'descend',
    // Pure reads.
    'look',
    'status',
    'assess',
    /**
     * What this cultivator is carrying in their head, asked in words.
     *
     * The knowledge layer is the spine of `docs/world/discovery.md` and the
     * sheet shows the other axis in a panel, and neither could be asked about.
     * Found by a rank-band sweep, and the dead sentences were at the TOP of
     * the ladder rather than the bottom, which is where it matters most:
     *
     *   "what do I know of Lu Sheng"          -> unclear
     *   "what do I know of the Hollow Court"  -> unclear
     *   "what is my dao"                      -> unclear
     *
     * All three are one verb. A read of what the holder holds - a person, a
     * faction, a subject, or their own comprehension - answered out of
     * `knowledge_records` and the insight list and out of nothing else.
     *
     * The last of the three is close to the whole game at the ceiling. A
     * False Immortal cannot climb in rank again and can still climb in dao, so
     * `DaoView.theOnlyAxisLeft` is literally true for them, and until this
     * existed the only place it was ever said was a panel.
     */
    'recall',
    /**
     * WHOSE ART THAT WAS - the player putting the trust hierarchy's strongest
     * check to themselves.
     *
     * `docs/world/trust.md` says a house's arts are the closest thing it has to
     * an identity and that watching somebody cultivate is the one reading that
     * goes straight to the thing in question. Nothing in the game could ask it.
     * A player watching somebody move had no sentence at all, and the two
     * things that decide the answer - their rung and what they have a reference
     * for - were both sitting in the database with no question pointed at them.
     *
     * Introspective, like `status` and `recall`: the character looking at
     * something and drawing on what they already hold. It costs no time, it is
     * never refused, and it consults no catalog the holder has no record for.
     *
     * THE ANSWER IS GRADED AND IT NEVER FAKES CONFIDENCE. Somebody with no
     * reference is told they would not know it, rather than handed a "no" they
     * did not earn. Somebody with a reference and too low a rung is told it
     * matches what they have heard and that they could not tell a good
     * imitation - the uncertainty IS the answer. Somebody with both gets it
     * flat, at a glance, and that terseness is the reward for the climb: it is
     * progression a player can feel that is not combat power.
     *
     * And it answers WHERE AN ART WAS LEARNED and never whom anybody serves.
     * The Hollow Court takes nobody below Void Refinement, so its people arrive
     * trained elsewhere and honestly perform their origin house's art - a
     * correct identification that leaves a wrong conclusion available. That is
     * the design, not a gap to paper over, so this verb volunteers no
     * allegiance it cannot know.
     */
    'recognise',
    /**
     * What the people here are saying is happening elsewhere.
     *
     * `recall` reads the holder's own head and structurally cannot teach them
     * anything. This is the opposite verb and the world had no route to it:
     * the simulation writes rankings, refusals, duels and houses opening closed
     * ground into the ledger every year, and the only way any of it reached a
     * player was the digest, which is gated on standing and is a report.
     *
     * Nobody finds out that two of the world's tallest people fell out by
     * being briefed. They find out because somebody in a market says so, and is
     * about two thirds right.
     *
     * A read, and it costs nothing but being somewhere with people in it. The
     * refusal where there is nobody is the content: a cultivator forty years
     * into a cave asking what is happening in the world is asking a wall.
     */
    'news',
    /**
     * ASKING A PERSON FOR SOMETHING, which is the verb the design rests on and
     * which did not exist.
     *
     * The engine says, correctly and often, that there are exactly two ways
     * past a manual's ceiling - another book, or somebody willing to teach you.
     * The book half works: a common primer costs about eight spirit stones at a
     * stall. The teacher half had no verb at all, and four phrasings of it
     * reached four different lookups, none of which was a person:
     *
     *   I ask X to teach me                   the roster of everybody above me
     *   I beg X to take me as a disciple      a description of X
     *   ask X for the Lesser Qi-Gathering     the almanac entry for the book
     *   I bribe X with 60 spirit stones       "X agreed." Agreed to what?
     *
     * `interact` is not this. It carries an intent that nothing branches on,
     * which is right for the verb and useless for the OBJECT: what is being
     * asked FOR has to reach the engine, because `AskWeight` prices resistance
     * and duration off it and because a take has to end in the thing actually
     * happening. So `target` names who, `intent` names what KIND of thing was
     * asked - one of a closed set, from `what-a-request-asks-and-of-whom.ts` -
     * and `topic` carries what was named, resolved against the same catalogs
     * everything else uses.
     *
     * It is deliberately NOT free. It spends days, it can spend stones, and on
     * a take it writes an art onto the sheet or a name into the knowledge
     * table.
     */
    'request',
    /**
     * The parser did not understand, and nothing happens.
     *
     * A member of the closed set rather than a special case, so the exhaustive
     * switch in `GameService.execute` is forced to handle it and no future verb
     * can quietly become the fallback again. The model should never CHOOSE it -
     * the glossary says so - but a model that does costs the player nothing,
     * which is the entire point of it being here.
     */
    'unclear'
] as const;

export type ActionName = typeof ACTION_NAMES[number];

/**
 * Actions that pass no in-world time and change no cultivator state.
 *
 * `interact` was on this list and was never a read. Seven of its ten intents
 * reach the pressure model, which spends days out of the same clock everything
 * else spends and can empty the purse. Measured in a played run before the
 * change - "can I bribe Bai Jinglu with 10 spirit stones", purse 30 to 20, day
 * 16 to 17 - and the question was the whole of the sentence. The note under
 * {@link TIME_CONSUMING_ACTIONS} carries the reasoning, and says why it went
 * into neither list rather than into that one.
 */
export const READ_ONLY_ACTIONS: readonly ActionName[] = [
    'look', 'status', 'investigate', 'assess', 'market', 'unclear',
    // Both are reads of what is already true - the pouch, and the catalog
    // filtered by rows this cultivator already owns. Neither can teach and
    // neither can kill.
    'inventory', 'list_techniques', 'acquisition',
    // Reading your own head changes nothing in it. This one is a read in the
    // strictest sense in the package: it touches no catalog the holder has no
    // record for, so it cannot even accidentally become a way to learn.
    'recall',
    // The same, one subject over. Looking at what is in front of you and
    // thinking about it is always a legitimate thing to do, so this is never
    // refused and never spends a day - and what it can tell the holder is
    // bounded by the two things they already are.
    'recognise',
    // Asking a square what it has heard writes knowledge records and nothing
    // else. It cannot spend, move or kill, and what it teaches is a name at
    // `whisper` - the same thing standing near a conversation already does.
    'news',
    // The three reads that answer a stuck player. Every line each of them
    // produces is a restatement of a number the engine already computed, so
    // none of them can teach, spend, move or kill - and a player at a wall
    // must be able to ask what it is a hundred times for nothing.
    'ceiling', 'teacher', 'destinations',
    /**
     * Asking is free. Getting is not, and nobody has ever got.
     *
     * A petition costs no days and moves no stones: it travels as far as
     * somebody is willing to pass it and stops, and the only state it writes is
     * a knowledge record for a tier that answered - which is one of the few
     * legitimate ways a name enters a cultivator's world at all.
     */
    'petition'
] as const;

/**
 * `sect`, `posture`, `seal` and `offer` are in neither list on purpose. So is
 * `interact`, which is the fifth and the one that had to be found by playing -
 * the note under {@link TIME_CONSUMING_ACTIONS} carries it.
 *
 * None of them spends days, and all three of the new ones commit the house to
 * something it cannot walk back, so classifying them as free would be as wrong
 * as classifying them as slow. Which one happened depends on whether a party
 * was named and on what the membership row says, so it is decided at the point
 * of execution - and the protection a misparse actually needs is supplied
 * instead by {@link DEFAULT_POSTURE_INTENT}, {@link DEFAULT_SEAL_INTENT} and
 * {@link DEFAULT_OFFER_INTENT}, every one of which is a read.
 *
 * The original note, which still holds:
 *
 * Listing what would take you costs nothing; being taken costs a life's worth
 * of allegiance. Which one happened depends on whether a sect was named, so it
 * is classified at the point of execution rather than here.
 */

/**
 * Actions that spend in-world time, and can therefore kill.
 *
 * The list exists to be asserted against. An intent the engine did not
 * understand must never resolve to anything in it: a misparse that costs a
 * season costs a starving cultivator their run, and a player should be able to
 * type something ambiguous a hundred times and lose nothing but a moment.
 */
export const TIME_CONSUMING_ACTIONS: readonly ActionName[] = [
    'cultivate', 'seclude', 'breakthrough', 'train_technique',
    'move', 'gather', 'wait', 'work', 'refine', 'eat',
    // A course of care is a month lying still. It is the cheapest month in the
    // game and it is still a month, and the food clock runs through it.
    'treat',
    // Not because it spends days. Because it can end the run inside one
    // turn, which is the thing this list is actually protecting against.
    'attack',
    /**
     * Here for the same reason, and it is not obvious from the name. An art
     * that FIGHTS the spirit root is learnable and routes through the qi
     * deviation engine on the spot: torn meridians, lost progress, and
     * `evaluateDeathConditions` called on the far side of it. A misparse must
     * never reach that.
     */
    'learn_technique',
    /**
     * And this one, which is even less obvious. Swallowing a pill spends no
     * day at all - and toxicity crossing `TOXICITY_TOLERANCE` mints a real
     * poison injury through the same path every other wound takes, with
     * `evaluateDeathConditions` running on the far side of it. This list is a
     * floor on what a MISPARSE may reach, not a description of what each
     * action costs, and a verb that can write a wound belongs on it.
     */
    'consume_pill',
    /**
     * Here for exactly the same reason, and it is the strongest case on the
     * list. Nine strikes of the heaviest tribulation in the game, weathered by
     * somebody who has already spent a life reaching the point where they could
     * be struck by it. A misparse that reaches this ends the run, so nothing
     * ambiguous may.
     */
    'descend',
    /**
     * Here for the same reason `attack` is, and not because every intent it
     * carries costs anything: approaching a site and reading it from outside
     * are reads that pass no time at all. Going into one spends days and puts
     * a body in front of a thing set at an ordinal, so the whole action is
     * declared dangerous. This list is a floor on what a MISPARSE may reach,
     * not a description of what each intent costs, and the conservative
     * direction is the only safe one to be wrong in.
     */
    'site',
    // Burying spends a week or a season with a spade, and the food clock
    // runs through it. Conservative direction, same as `site`.
    'legacy',
    /**
     * Putting something to somebody costs a day for a courtesy and a season and
     * a half for a betrayal - `ASK_DAYS` in `an-attempt-to-move-somebody.ts`
     * owns the figure - and it can spend the whole purse on the way.
     *
     * On this list rather than in `READ_ONLY_ACTIONS` on purpose, and `interact`
     * is the reason it says so: it carried the same leverage intents, spent the
     * same days and the same stones, and was classified free. See the note
     * under this list.
     */
    'request',
] as const;

/**
 * `interact` is in neither list, and it is the fifth member of the paragraph
 * above rather than a fourth exception to it.
 *
 * It used to be in `READ_ONLY_ACTIONS` and it was never a read. Seven of its
 * ten intents - {@link PRESSING_SOMEBODY} - reach `resolveAttempt` through
 * `GameService.pressSomebody`, which runs the days through `shortSkip` like
 * every other span in the game, so the food clock runs through them, and writes
 * `-result.stonesSpent` against the purse when the attempt lands. Played cold
 * before the change, on a fresh run carrying thirty stones:
 *
 *   > can I bribe Bai Jinglu with 10 spirit stones
 *     purse 30 -> 20, day 16 -> 17
 *
 * A question spent ten spirit stones and a day, and the mislabel is what made
 * it possible twice over. It kept `interact` out of the assertion
 * `TIME_CONSUMING_ACTIONS` exists for, AND it made {@link theReadThatAnswersIt}
 * hand the question straight back to the executor - because that guard trusts
 * `READ_ONLY_ACTIONS` to say which verbs are already free, which is exactly
 * what makes it complete for every verb that is labelled correctly.
 *
 * So classifying it free is wrong and classifying it slow is equally wrong, on
 * the same reasoning `sect`, `posture`, `seal` and `offer` are given: WHICH ONE
 * HAPPENED DEPENDS ON THE INTENT, and the intent is decided at the point of
 * execution. The difference from `site`, which took the coarse label and was
 * declared dangerous whole, is that `site` is only ever reached by a sentence
 * about a site, and `interact` is this parser's broadest catch for anything
 * involving a person. "I follow the cultivator", "I talk to the cultivator by
 * the well" and "I steal from the market stall keeper" all land here, all cost
 * nothing, and `tests/web/coverage.test.ts` asserts that they cost nothing.
 * Declaring the whole action slow would have turned that guard red on three
 * sentences that are inert in fact - and the fix for a guard that reports the
 * world moving as the world breaking is never to widen the guard.
 *
 * The protection a misparse actually needs is supplied where the other four
 * supply it: THE DEFAULT IS THE CHEAP BRANCH. A sentence that names none of the
 * seven verbs falls through to `talk`, which describes somebody and settles
 * nothing, and `FALLBACK_ACTION` is `unclear` rather than this - so nothing the
 * parser failed to understand reaches an attempt at all. That is asserted at
 * the intent rather than at the action in `tests/web/misparse.test.ts`, which
 * is the sharper claim and the one that is actually true.
 */

/** What an unparseable sentence resolves to. Inert, by construction. */
export const FALLBACK_ACTION: ActionName = 'unclear';

/** Actions that take a duration in days. Every other action ignores one. */
export const TIMED_ACTIONS: readonly ActionName[] = ['cultivate', 'seclude', 'work', 'provision', 'legacy'] as const;

/**
 * Actions that take a subject. The subject must resolve to a real entity - a
 * cultivator row, a sect, a catalogued art, formula or herb, a place - or the
 * action fails. An unresolvable target is never narrated as though it worked.
 */
export const TARGETED_ACTIONS: readonly ActionName[] = [
    'interact', 'investigate', 'move', 'train_technique', 'refine', 'gather',
    'work', 'market', 'assess', 'sect', 'attack',
    // The name being asked about. Matched against the holder's OWN rows and
    // never against the world, which is the whole gate - see `GameService.recall`.
    'recall',
    // The site, by name. Resolved against the catalog and against what this
    // cultivator may name, so an invented one resolves to nothing.
    'site',
    // The custody house, by name, resolved against the six that take a
    // deposit. A cache takes the place instead and needs no target.
    'legacy',
    // The line on the price board. Resolved against `PRICES`, so a purchase
    // the board never advertised resolves to nothing and is refused with the
    // board attached.
    'buy',
    // What is on the counter, resolved against THE POUCH. Bare "I sell my
    // herbs" carries no target and prices the whole pouch instead.
    'sell',
    // The manual being asked about, by name. Resolved against what this
    // cultivator HOLDS: the question is how THEIR book goes further.
    'acquisition',
    // The art, by name. Resolved against the whole catalog and then put to
    // `handleLearn`, which owns every gate - so naming one out of reach is
    // refused with the measured reason rather than dropped here.
    'learn_technique',
    /**
     * The art being ASKED about, by name, which is where a question about
     * learning one lands. Free and it must be: a player is entitled to ask
     * what a book would take a hundred times and lose nothing, and the whole
     * reason this target exists is that "can I learn the Lesser Qi-Gathering
     * Manual" used to LEARN IT. An unresolvable name falls through to the
     * listing rather than being refused.
     */
    'list_techniques',
    // The pill, by name. Resolved against the POUCH, so a pill nobody is
    // carrying is refused with what they are carrying attached.
    'consume_pill',
    /**
     * The other party, by name: the institution being asked, the house being
     * declared against, the mountain with something under it, the line an
     * offering is being sent up.
     *
     * All four resolve through the same knowledge-gated faction lookup, so a
     * house the player has never heard of resolves to nothing and is refused
     * identically to one that does not exist. That equivalence is required
     * rather than incidental: asking about a thing must not teach its existence,
     * and the shape of the refusal must not be the answer.
     */
    'petition', 'posture', 'seal', 'offer',
    /**
     * The person it is being put to, by name or by the phrase that points at
     * them. Resolved through the same knowledge-gated party lookup `interact`
     * uses, and refused with the same guiding refusal - who is actually here,
     * and which of them the player could put it to - when it resolves to
     * nobody.
     */
    'request'
] as const;

/**
 * `look` is deliberately NOT in the list above, even though the history read
 * can use a place name.
 *
 * The deterministic parser hands its own plan straight to the service and is
 * not filtered here, so "what happened at the Reed Scar" keeps its subject on
 * that path. A MODEL-planned look loses it and answers about the ground the
 * cultivator is standing on, which is the overwhelmingly common reading of the
 * question and the safe direction to be wrong in: a stripped subject costs a
 * player a follow-up sentence, and letting a model attach a free-text subject
 * to every observation widens the one field this file exists to keep narrow.
 */

/**
 * Actions that may carry a topic. `sect` uses it for the siphoning pace.
 *
 * `petition` uses it for the MATTER - what is actually being asked for, in the
 * petitioner's own words. It is free text and it is safe for the same reason
 * `intent` is: nothing branches on it to decide whether the petition is
 * granted. It is carried into the record and shown back in the refusal, which
 * is precisely the point - being told no in the terms you asked in is the
 * interaction.
 */
export const TOPIC_ACTIONS: readonly ActionName[] = [
    'interact', 'sect', 'petition',
    /**
     * `offer` uses it for the WORD that goes down the line with whatever is
     * sent, which is half of what a proxy action is: an object arrives, and a
     * message says what it is for. Free text, carried into the recipient's
     * memory and into a secret fact, and read by no conditional - the whole
     * unreliability of acting by proxy is that people who are not you decide
     * what you meant.
     */
    'offer',
    /**
     * `request` uses it for WHAT WAS NAMED: the art, the person to be
     * introduced to, the subject. Free text, resolved against the same catalogs
     * every other target resolves against, and refused by name when it resolves
     * to nothing - which is the point, because "no art called that" is a
     * different answer from "they will not teach you that" and a player is
     * entitled to know which one they got.
     */
    'request'
] as const;

/**
 * Actions that carry a free-text intent. Never branched on for an outcome -
 * with one deliberate exception, `sect`, whose intent selects which of the
 * sect surface's five verbs runs. It is safe there because the value is
 * produced by {@link SECT_INTENT_PATTERNS} rather than by a model: the model's
 * own string is normalised to a label and then matched against the same closed
 * set, so an unrecognised one falls through to the listing.
 */
export const INTENT_ACTIONS: readonly ActionName[] = [
    'interact', 'move', 'attack', 'sect',
    /**
     * `look` is the second exception, and it is safe for the same reason: the
     * label selects WHICH READ runs - the room, the faces in it, or what was
     * done to the ground here - and every one of those is answered out of
     * state. An unrecognised label falls through to the room, which is what
     * `look` did before any of them existed.
     */
    'look',
    /**
     * `site` is the third, and it carries the same guarantee with one extra
     * obligation. The label selects which of the four steps runs - reaching
     * one, reading it from outside, going in, taking what is behind it - and
     * every outcome on the far side is computed from the catalog and the
     * cultivator's own rows. What is different here is that one of the four
     * SPENDS SOMETHING, so an unrecognised label must fall through to the
     * cheapest of them and not to the expensive one. It falls through to the
     * listing. See `SITE_INTENTS` and `GameService.site`.
     */
    'site',
    /**
     * `legacy` is the fourth, and it carries the site rule exactly: the label
     * picks which of five steps runs, two of them spend something, and an
     * unrecognised label falls through to `counters` - the free read of what
     * the counters here will take - and never to burying.
     */
    'legacy',
    /**
     * `recall` is the fourth, picking between what the holder has HEARD and
     * what they have UNDERSTOOD. Two different tables, both theirs, and both
     * free.
     */
    'recall',
    /**
     * `request` carries the site rule with one difference worth stating: what
     * the label selects is not which routine runs but WHAT IS BEING ASKED FOR,
     * which is the one thing about an approach the engine is required to read.
     * `asking.md` is the reason - asking a gate guard for a name and asking the
     * same guard to leave the gate unwatched are the same sentence with the
     * same charm behind it, and they are not remotely the same attempt.
     *
     * That does not weaken the rule this list exists for. Nothing branches on
     * the VERB; the kind comes from a closed set produced by
     * `what-a-request-asks-and-of-whom.ts`, an unrecognised label falls through
     * to the cheapest reading, and `AskWeight` - which the resolver actually
     * prices off - is derived from the kind and from `manuals.ts`, never from
     * the word the player typed.
     */
    'request',
    /**
     * The four new ones, all carrying the same guarantee and the same extra
     * obligation `site` carries.
     *
     * The label selects WHICH ROUTINE runs - which form is being filed, which
     * stance is being taken, whether the seal is being read or spent, whether
     * the channel is being read or paid - and every outcome on the far side is
     * computed from the catalog and the membership row. What is different from
     * `look` and `recall` is that one branch of each COMMITS THE HOUSE, so an
     * unrecognised label must fall through to the read and never to the
     * commitment. It does, by construction: see the four DEFAULT_* constants,
     * every one of which is the cheapest branch the action has.
     */
    'petition', 'posture', 'seal', 'offer'
] as const;

/** The things a member can do about their sect, in the order they are tested. */
export type SectIntent =
    | 'leave' | 'promote' | 'stipend' | 'standing' | 'join' | 'siphon' | 'order'
    // What the rungs above `order` buy. Same defect as `order` had: implemented,
    // gated, tested, and unreachable from anything a player could type.
    | 'recruit' | 'admission' | 'curriculum' | 'expel'
    /**
     * The mission board, and taking something off it.
     *
     * `sect_members.contribution` is one of three independent axes of standing
     * and it had NO EARNER: promotion spends it, `handleStipend` credits a
     * trickle of it, and nothing else in the game could add to it, so
     * "I do sect work for contribution" returned the generic mortal job board.
     * `commissionBoard`, `boardRefusals` and the accept/complete/refuse ledger
     * are what answer it, and none of them was reachable.
     */
    | 'duty'
    /**
     * Paying into the house's ledger instead of serving it.
     *
     * The other half of the contribution economy. Missions were the only
     * earner, and a player with stones and no time had no way to convert one
     * into the other - so a rich cultivator and a poor one had exactly the same
     * route to a promotion, which is not what money is for in this setting.
     */
    | 'donate'
    /**
     * Being let to sit in at a house that has not taken you.
     *
     * The roll that is not the house roll. A guest keeps their own membership,
     * holds no rung, draws nothing, and is shown the shallow end of somebody
     * else's shelf - which is the only route past a manual's ceiling that does
     * not require a favour from an apex or a decade of contribution. See
     * `src/engine/encounters/what-a-house-will-teach-somebody-it-has-not-taken.ts`.
     */
    | 'guest';

/**
 * Which sect verb a sentence is asking for.
 *
 * `sect_manage` has had promote, stipend, standing and leave the whole time,
 * fully implemented and gated - and until this existed, none of them could be
 * reached from the command bar. A player could join a sect and then never be
 * promoted, never draw a stipend, never ask where they stood and never resign,
 * because every one of those sentences parsed to `unclear`.
 *
 * Order matters. Leaving is tested first because "I leave the sect and join
 * another" is a sentence about leaving; standing is tested before joining
 * because "what is my standing" contains no join verb but does contain the
 * noun, and the join branch matches on the noun.
 */
/**
 * The two that need no noun. "Promote me" and "my stipend" are about a sect
 * whether or not the sentence says so - there is nothing else in the game that
 * promotes anybody or pays an allowance - so these are tested early, ahead of
 * the verbs that would otherwise swallow them ("collect my pay" reads as
 * gathering, "ask for a promotion" reads as asking somebody a question).
 */
export const SECT_INTENT_UNAMBIGUOUS: ReadonlyArray<[SectIntent, RegExp]> = [
    ['promote', /\b(?:promote|promotes|promoted|promotion|raise me|elevate me|advance my rank|higher rank|next rank up|rise in rank)\b/],
    ['stipend', /\b(?:stipend|allowance|my dues|collect my pay|draw my pay|what (?:i am|i'm) owed)\b/]
];

/**
 * Sentences about taking the house's property, which are NOT sentences about
 * resigning from it even though most of them contain the word "leave".
 *
 * Found by playtesting: "I take the sect treasury and leave in the night" was
 * matched by the leave pattern and quietly resigned the player's membership.
 * They asked to rob the place and the engine processed a resignation, without
 * the theft, without a refusal, and without anything saying so.
 *
 * There is no theft action in the closed set, so the honest answer to these is
 * that the thought does not resolve. Silently doing something adjacent and
 * irreversible instead is the one answer that is worse than saying no.
 */
/**
 * How greedily, when the sentence says. Order matters: the careful words are
 * checked first because "quietly and steadily" is a sentence about care.
 */
export const SIPHON_PACE_PATTERNS: ReadonlyArray<[string, RegExp]> = [
    ['careful', /\b(?:careful\w*|slow\w*|quiet\w*|patient\w*|little at a time|a bit at a time|cautious\w*|discreet\w*)\b/],
    ['greedy', /\b(?:greedy|greedily|fast|quickly|hard|as much as|everything|all of it|empty|drain|clean out)\b/],
    ['steady', /\b(?:steady|steadily|regular\w*|month by month|bit by bit|over time)\b/]
];

/**
 * Reading the books, which is not the same as taking anything out of them.
 *
 * `handleSiphon` with no pace reports the position and takes NOTHING - a
 * player is entitled to see what the reserves hold and what the house has
 * already half-noticed before committing to a crime that runs on a clock.
 * That branch is right and it was reached by everything, including
 * "I steal the sect treasury".
 *
 * What that produced, measured across 21 positions and scored on database
 * writes: the prose escalated perfectly by rank - `not_a_member`, then
 * "opens them at Dew Elder, and not before", then "Azure Dew Sect keeps 54,864
 * spirit stones in reserve, and Dew Elder can sign for them" - and at EVERY
 * rank the verdict was `wrote: []`. The ladder was consulted and not obeyed,
 * which is worse than silence, because the prose looks like it worked.
 *
 * So the two sentences are separated here. A question about the reserves is a
 * look. A sentence that says somebody is TAKING is an act, and an act with no
 * pace named falls through to {@link DEFAULT_SIPHON_PACE} - the same rule
 * `site`, `petition`, `posture`, `seal` and `offer` follow, and the same
 * direction: the default is the cheapest branch that still does what was
 * asked, never the most expensive one.
 */
export const SIPHON_TAKING_VERBS =
    'steal|steals|stealing|stole|rob|robs|robbing|loot|loots|looting|plunder|plunders|'
    + 'pilfer|pilfers|siphon|siphons|siphoning|skim|skims|skimming|embezzle|embezzles|'
    + 'embezzling|divert|diverts|diverting|empty|empties|emptying|drain|drains|draining|'
    + 'clean out|take|takes|taking|help myself to|make off with|dip into|dips into';

/**
 * The pace an unpaced theft runs at.
 *
 * `careful` takes half a per cent a month and buys years. It is the LEAST
 * dangerous thing the verb can do while still being the verb, which is exactly
 * what a default has to be when the branch it is choosing between is
 * "irreversible crime" and "nothing at all".
 */
export const DEFAULT_SIPHON_PACE = 'careful';

/**
 * Sending somebody below you somewhere, which is the first thing a rank buys.
 *
 * `sect_manage.order` has had the whole of this the whole time - authority read
 * off the rank index, hands read off the roster taper, the errand resolved
 * against the rung sent, the standing it costs and the obstruction it earns -
 * and none of it could be reached from the command bar. Worse than unreachable:
 * "I order the disciples to gather herbs" was caught by the FORAGING branch, so
 * a sentence about spending somebody else's week spent the player's own instead.
 * That is the same defect as "I attack the nearest cultivator" resolving to a
 * month of meditation, and it is checked here for the same reason.
 *
 * Both halves are required. The verbs alone are too common to trust ("send word
 * to the elder" is a message, not an errand), and the nouns alone appear in
 * every second sentence in the setting. A verb aimed at a rung below is the only
 * thing this matches.
 */
export const SECT_ORDER_VERBS =
    'order|orders|command|commands|send|sends|dispatch|dispatches|detail|details|assign|assigns|task|tasks';

export const SECT_SUBORDINATE_NOUNS =
    /\b(?:disciples?|servants?|juniors?|underlings?|subordinates?|acolytes?|attendants?|initiates?|the ranks? below|my line|my people)\b/;

/**
 * Sending something rather than somebody. "I send word to the disciples" is a
 * message and costs nobody a day; only the errand branch may claim it.
 */
export const SENDING_A_MESSAGE =
    /\b(?:send|sends|sending|dispatch|dispatches)\s+(?:word|a message|a letter|a note|a reply|an invitation|my regards|for help)\b/;

/**
 * Which of the three errands an order is for.
 *
 * Tested in this sequence because the sentences overlap: "gather stone for the
 * wall" is haulage that mentions gathering, so what is being FETCHED decides it
 * before the verb does. Nothing named means the generic thing a house asks of
 * the rung below, which is work booked against the caller's own name.
 */
export const SECT_ERRAND_PATTERNS: ReadonlyArray<[string, RegExp]> = [
    ['gather', /\b(?:herbs?|roots?|plants?|ingredients?|reagents?|flowers?|mushrooms?|grasses|forage|foraging|gather\w*|harvest\w*|pick\w*)\b/],
    ['carry', /\b(?:carry|carrying|carts?|haul\w*|freight|porter\w*|transport\w*|deliver\w*|fetch\w*|move the|shift the|stones?|ore|timber)\b/],
    ['labour', /\b(?:labour|labor|repair\w*|rebuild\w*|build\w*|sweep\w*|dig\w*|clean\w*|maintain\w*|drill\w*|chores?|the yard|the wall)\b/]
];

/** What an order is for when the sentence does not say. */
export const DEFAULT_ERRAND = 'labour';

// ─── THE SEAT'S OWN POWERS ────────────────────────────────────────────────
//
// Four more verbs with the `order` defect. `sect_manage` has had recruit,
// admission, curriculum and expel the whole time - implemented, tiered by
// POWERS_BY_TIER, each returning a narrationHint, each tested - and none of
// them could be reached from the command bar. "I expel an elder from the sect"
// and "I raise the sect's admission standard" parsed to `unclear`; "I take on
// new disciples" was taken by the INTERACT table, whose `recruit` label matches
// "take on"; "I change what the sect teaches" was taken by the sect LISTING,
// because the listing rule fires on the noun plus a question word and this
// sentence has both. So three of the four did something, and none of the three
// was the thing asked for.
//
// The rule the whole group follows is the one the order branch established: a
// verb aimed at somebody below you, plus the noun that says who or what. Both
// halves are required. The verbs alone are far too common - "take on", "raise",
// "change", "remove" are in every second sentence - and the nouns alone are the
// setting's own vocabulary.

/**
 * Taking somebody INTO a house, which is the opposite of asking to be let in.
 *
 * `admit` and `accept` are deliberately absent. "I want to be admitted as a
 * disciple" is a sentence about joining, contains the intake noun, and would
 * have been read as the head of a house buying an elder.
 */
export const SECT_RECRUIT_VERBS =
    'recruit|recruits|recruiting|take on|takes on|taking on|take in|takes in|taking in|'
    + 'bring in|brings in|bringing in|enlist|enlists|enlisting|induct|inducts|inducting|'
    + 'sign on|signs on|signing on|'
    /**
     * The bare verb with a counted object, which "take on" does not cover and
     * which is how anybody actually says it. "I take a disciple" fell through
     * the entire table and reached nothing, while "I take on a disciple" - the
     * same act, one word longer - worked. That is a PHRASING GAP rather than a
     * missing mechanic: `sect_manage.recruit` already puts a disciple under
     * this cultivator's own line, is gated at the elder rung, and prices the
     * intake. A second verb for it would have been a second implementation of
     * one act, which is how two answers to the same question get into a save.
     *
     * The determiner is required and is not decoration. Bare `take` next to
     * the intake nouns collides head-on with the siphoning rule, whose own
     * pattern is `take the|its|their|all|what`: "I take the elders' reserves"
     * would have been read as buying an elder in from outside.
     */
    + 'take (?:a|an|on|in|another|one|two|three|four|five|six|seven|eight|nine|ten|[0-9]+)|'
    + 'takes (?:a|an|another|[0-9]+)|taking (?:a|an|another|[0-9]+)';

/** Who is being taken in. Without one of these the sentence is not about intake. */
export const SECT_INTAKE_NOUNS =
    /\b(?:disciples?|elders?|students?|followers?|apprentices?|novices?|initiates?|acolytes?|intake|new blood)\b/;

/**
 * Asking to be taken in yourself, which is `join` and never `recruit`.
 *
 * Checked as a veto rather than an ordering, because the sentence that needs it
 * ("see whether the hall will take me on as a disciple") satisfies the recruit
 * rule completely and means the exact opposite of it.
 */
export const ASKING_TO_BE_TAKEN_IN =
    /\b(?:take me|takes me|taking me|taken on|taken in|admit me|accept me|have me|be admitted|join|joins|joining)\b/;

/** Dismissing an elder: the only leadership act that lands the day it is said. */
export const SECT_EXPEL_VERBS =
    'expel|expels|expelling|dismiss|dismisses|dismissing|throw out|throws out|'
    + 'cast out|casts out|drive out|drives out|remove|removes|removing|oust|ousts|'
    + 'sack|sacks|purge|purges|get rid of|turn out|turns out';

/**
 * Only an elder can be dismissed by this power, so the noun is the gate. A
 * sentence about removing a seal, a disciple or a rival is not this act, and
 * routing it here would price a dismissal nobody asked for.
 */
export const SECT_ELDER_NOUN = /\b(?:elders?)\b/;

/**
 * Where the house sets its bar.
 *
 * "the bar" is safe next to the breakthrough vocabulary: the word boundary
 * after `bar` does not fall inside `barrier`, so "I strike at the barrier" is
 * not a sentence about admissions. "standard" is likewise not "standing" - the
 * member's status read is a different verb and is tested elsewhere.
 */
export const SECT_ADMISSION_NOUNS =
    /\b(?:admissions?|entry (?:bar|standard|standards|requirements?)|the (?:admission )?bar|intake (?:bar|standard)|standard (?:for|of) (?:entry|admission)|who (?:we|the house|the sect|the school) admits?|admit(?:s)? from)\b/;

export const SECT_ADMISSION_VERBS =
    'raise|raises|raising|lower|lowers|lowering|set|sets|setting|change|changes|changing|'
    + 'tighten|tightens|tightening|loosen|loosens|loosening|relax|relaxes|drop|drops|'
    + 'move|moves|moving|reset|resets';

/** Asking where the bar sits, which is the sentence before the one that moves it. */
export const SECT_ADMISSION_QUESTION =
    /\b(?:what (?:is|are) (?:our|the|my) (?:admission|entry|intake)|where does (?:the (?:house|sect|school)|it) admit from|how high is (?:the|our) bar)\b/;

/**
 * What the house hands its intake, which is the most consequential thing about
 * it over a century and the only one of the four that is a generational act.
 */
/**
 * `my sect` is in this list, and its absence was the whole bug.
 *
 * The pattern knew "what the sect teaches" and not "what does MY sect teach",
 * which is how a member phrases it - and a member is the only person for whom
 * the question has an answer. Two words apart, and the sentence fell past the
 * curriculum block entirely into the rule that finds you a sect to join, so a
 * disciple asking what their own house teaches was told that knowing a name is
 * not an introduction.
 */
export const SECT_CURRICULUM_NOUNS =
    /\b(?:curriculum|curricula|what (?:we|they|the house|the sect|the school|my (?:sect|house|school|clan|order)) teach(?:es)?|(?:working )?library|the shelf|teaching list|what is taught|methods (?:we|the house|the sect) teach(?:es)?|(?:my|our) (?:sect|house|school|clan|order) teach(?:es)?)\b/;

export const SECT_CURRICULUM_VERBS =
    'change|changes|changing|set|sets|setting|rewrite|rewrites|rewriting|revise|revises|'
    + 'decree|decrees|reform|reforms|add|adds|adding|retire|retires|retiring|drop|drops|'
    + 'stop teaching|start teaching|teach|teaches|teaching';

/**
 * Sitting down to learn something, which is `train_technique` and never a
 * decree. "I practise what the sect teaches" satisfies the curriculum rule and
 * means the player is doing the drill, not rewriting the shelf.
 */
export const LEARNING_RATHER_THAN_DECREEING =
    /\b(?:learn|learns|learning|study|studies|studying|practi[cs]e|practi[cs]es|practi[cs]ing|train|trains|training|drill|drills|rehearse)\b/;

/** Which side of the shelf a curriculum sentence is on. Order: the narrower first. */
export const SECT_CURRICULUM_SIDE: ReadonlyArray<[string, RegExp]> = [
    ['retire', /\b(?:retire|retires|retiring|stop teaching|stops teaching|take (?:it )?off the shelf|remove|removes|removing|drop|drops|dropping|no longer teach)\b/],
    ['teach', /\b(?:teach|teaches|teaching|add|adds|adding|put (?:it )?on the shelf|start teaching|hand them)\b/]
];

/**
 * Taking something off a person, which is not gathering.
 *
 * `gather` matches on the bare verb `pick`, which is the right word for a herb
 * and is also half of the commonest way anybody says this: "I pick her
 * pocket". Played live, "I pick Xiao Suiya's pocket" answered "Cloudcap
 * Mushroom, pouched" and charged seven days of foraging for it.
 *
 * Kept to the idiom on purpose. The lesson this file has learned twice is that
 * widening a pattern to cover the case you imagined steals sentences from the
 * verb next door - "I pick the mushrooms" and "I pick a fight" must both go on
 * reaching what they reached.
 */
export const POCKET_PICKING =
    /\b(?:pickpocket\w*|(?:pick|picks|picking|picked|lift|lifts|lifting|lifted|cut|cuts|cutting)(?!\s+up\b)\b[^.!?]{0,40}?\b(?:pocket|pockets|purse|purses|sleeve|sleeves))\b/;

/**
 * Asking what your standing entitles you to on your house's ground.
 *
 * Named rather than inline because two places need it: the read itself, and a
 * veto on the ask branch - "I ask for time on the vein" is not a question put
 * to a person, and `parseAsk` was taking "for time on the vein" as somebody's
 * name and putting the words to whoever was nearest.
 *
 * Ground is the largest multiplier in the model and houses allocate days on it
 * by rank, so this is the first concrete thing rank buys. Gated on a house word
 * beside the ground word, so "I travel to The Cut Face" stays a journey.
 */
export const GROUND_TIME_QUESTION = new RegExp([
    /\b(?:time on the (?:vein|ground|chamber)|my (?:allocation|allotment|days on)|how many days (?:do i get|am i allowed|on the))\b/,
    /\bwhere (?:can|do|should) i cultivate\b[^.?!]*\b(?:sect|house|here|in the)\b/
].map(r => r.source).join('|'));

/** The two-noun form: a chamber word, a house word, and something being asked. */
export function asksAfterGroundTime(text: string): boolean {
    if (GROUND_TIME_QUESTION.test(text)) return true;
    return /\b(?:chamber|vein|cave|ground|room)\b/.test(text)
        && /\b(?:sect|house|clan|school|order)\b/.test(text)
        && /\b(?:go to|use|ask for|request|time on|cultivate in|cultivate at|sit in|where|what|how much|am i allowed|can i)\b/.test(text);
}

export const SECT_THEFT_PATTERN =
    /\b(?:steal|stole|stealing|rob|robbing|loot|looting|plunder|pilfer|siphon\w*|skim\w*|embezzl\w*|divert\w*|make off with|help myself to|vault|treasury|strongroom|storehouse|coffers|reserves|take (?:a little|some|the|its|their|everything|all|what))\b/;

/**
 * The two that do. "I leave" on its own is movement and "where do I stand" is a
 * status read, so both of these want the noun before they mean a sect.
 */
/**
 * The house's mission board, which needs a branch of its own and not a row in
 * `SECT_INTENT_PATTERNS`.
 *
 * The sect block only runs on a sentence containing a sect noun, and half the
 * sentences that mean this one do not have one: "I take a commission", "what
 * duties are going", "I put my name down for the wall patrol". Worse, the two
 * that DO have one were already taken - "I look at the sect mission board" by
 * `look`, and "I do sect work for contribution" by `work`, which answered it
 * with the mortal job board that pays in cash and moves no standing at all.
 *
 * So it fires early, ahead of both, and it is deliberately narrow: either an
 * explicit board, or an institution word standing next to a work word.
 * `contribution` is on the list by itself because there is exactly one thing in
 * the game that pays in it.
 */
/**
 * Reading the wall for a house that is short of people.
 *
 * Deliberately narrow, and narrow in a specific way: it requires either a
 * PAPER noun or an INTERROGATIVE frame. That is what keeps it off
 * `sect_manage`'s intake verb, which owns "recruit disciples" said as an
 * instruction by somebody who runs a house. "I recruit two disciples" is a
 * decree; "who is recruiting" is a question about the world, and nobody with a
 * house to run asks it.
 *
 * It is not in `SECT_INTENT_PATTERNS` and must not be, for the same reason
 * `SECT_DUTY_PATTERN` is not: half the sentences that mean this carry no sect
 * noun at all. "What's posted here" and "is anybody taking disciples" are the
 * two most natural ways to ask and neither names an institution.
 *
 * `notice board` and `the board` are NOT here. They belong to
 * {@link SECT_DUTY_PATTERN}, which had them first and which is a member-only
 * surface - a collision worth knowing about but not worth stealing a working
 * phrase over.
 */
export const RECRUITING_BILL_PATTERN =
    /\b(?:recruit(?:ing|ment)|intake|admission)\s(?:bills?|notices?|posters?|events?|drives?|days?)\b|\b(?:read|reads|reading|look at|looks at|looking at|check|checks|checking|study|studies|studying)\b[^.!?]*\b(?:bills?|posters?|placards?|walls?)\b|\bwhat(?:'s| is| are)?\b[^.!?]*\b(?:posted|nailed|pinned)\b|\b(?:who|what|which|any|anyone|anybody|is there|are there|is anyone|is anybody)\b[^.!?]*\b(?:recruit(?:s|ing)?|taking (?:on )?(?:disciples|students|anybody|anyone|people))\b/;

export const SECT_DUTY_PATTERN =
    /\b(?:mission board|duty board|commission board|sect board|notice board|the board|sect work|sect dut(?:y|ies)|contribution)\b|\b(?:sect|house|order|clan|school)\b[^.!?]*\b(?:work|dut(?:y|ies)|commissions?|assignments?|errands?|missions?)\b|\b(?:commissions?|assignments?|missions?|tasks?|dut(?:y|ies))\b[^.!?]*\b(?:going|available|on offer|posted|open|are there)\b|\b(?:what|which)\b[^.!?]*\b(?:dut(?:y|ies)|missions?|commissions?|assignments?)\b|\b(?:volunteer for|sign up for|put my name down)\b/;

/**
 * Taking one, said without the institution.
 *
 * "I take a commission" names no sect and is unambiguously about the board,
 * because there is nothing else in this game called a commission. The verb has
 * to be in verb position, so "the commission was already taken" is not an
 * attempt to take it.
 */
export const DUTY_TAKING_VERBS =
    'take|takes|taking|accept|accepts|accepting|volunteer|volunteers|'
    + 'sign up|signs up|put my name';

/** The nouns that make a taking verb a duty rather than a purchase. */
export const DUTY_NOUNS = /\b(?:commissions?|assignments?|dut(?:y|ies)|missions?)\b/;

/**
 * Swallowing, which is not buying and is not eating.
 *
 * "I eat a healing pill" reached the meal branch; "I buy a healing pill"
 * correctly reached the board; nothing at all reached the swallow.
 */
export const PILL_TAKING_VERBS =
    'take|takes|taking|swallow|swallows|swallowing|eat|eats|eating|consume|consumes|'
    + 'consuming|use|uses|using|down|downs|dose|doses|dosing';

export const PILL_NOUNS = /\b(?:pills?|elixirs?|medicines?|tablets?|pellets?)\b/;

export const PILL_SUBJECT_VERBS = /take|swallow|eat|consume|use|down|dose/;

/**
 * Taking up an art for the first time.
 *
 * Narrow on purpose, because it carries the sentence WITHOUT a class noun -
 * see the branch for the measurement that made that necessary. Every verb here
 * in verb position is unambiguously about acquiring a method.
 */
export const LEARNING_VERBS =
    'learn|learns|learning|take up|takes up|master|masters|acquire|acquires';

/**
 * The ambiguous half, which still needs the noun.
 *
 * "study the formation" is an examination and "study the Iron Bell Manual" is
 * an acquisition, and the only thing separating them is what is being studied.
 * So `study` keeps the class-noun requirement and the four unambiguous verbs
 * above do not - which is the whole of what the relaxation had to be, and
 * broadening it further took "study the formation" away from `investigate`.
 */
export const LEARNING_VERBS_NEEDING_A_NOUN = 'study|studies|studying|read|reads|reading';

export const TECHNIQUE_CLASS_NOUNS =
    /\b(?:arts?|techniques?|manuals?|methods?|scriptures?|canons?)\b/;

export const LEARNING_SUBJECT_VERBS = /learn|study|read|take up|master|acquire/;

/**
 * Asking how a manual goes further, by any route.
 *
 * Deliberately about the BOOK rather than about learning: these are the words
 * somebody uses at a ceiling, and every one of them presupposes a method they
 * already practise.
 */
export const ACQUISITION_PATTERN =
    /\b(?:how (?:do|can) i (?:get|go) (?:any )?further|what (?:are|is) my options|how does (?:this|my) (?:manual|method|art|book) (?:go|get) further|next volume|go further with|carry me further|what would (?:it )?take to (?:get|go) (?:past|further|beyond)|my options at this (?:ceiling|wall)|how do i pass this (?:ceiling|wall))\b/;

export const ACQUISITION_SUBJECT_VERBS = /further with|with|past|beyond|of/;

// ─── THE THREE QUESTIONS A STUCK PLAYER ASKS ──────────────────────────────
//
// Written from the outside in: what a person types when they want something
// and cannot get it. Every phrasing here was either measured as dead by
// `scripts/playtest-the-drive.mjs` or is a neighbour of one that was.
//
// All three are QUESTION shapes rather than verb shapes, which is why they do
// not go through `usedAsVerb`: nobody commands "ceiling". The risk that rule
// guards against - a common noun in object position being read as a command -
// does not apply to a sentence that opens "why am I".

/**
 * Why nothing is accumulating.
 *
 * `ACQUISITION_PATTERN` is the neighbour of this one and they are deliberately
 * different questions: acquisition presupposes a method and asks how the BOOK
 * goes further, while this asks what is stopping the PERSON and has to answer
 * for somebody who holds no book at all. The two overlap on "how do I pass
 * this ceiling", and acquisition keeps it, because a player who says "ceiling"
 * has already worked out that they have one.
 */
export const CEILING_QUESTION = new RegExp([
    // the measured five
    /\bwhy (?:am i|are we|is my cultivation|am i still|can'?t i|cannot i|do i)\b[^.?!]*\b(?:not (?:making |getting )?(?:progress|anywhere|any further)|stuck|stalled|not advancing|not improving|no progress|not progressing|not getting anywhere|not moving)\b/,
    /\bam i (?:stuck|stalled|capped|blocked|at (?:a|my) (?:wall|ceiling|limit))\b/,
    /\bhow far (?:will|does|can)\b[^.?!]*\b(?:technique|manual|method|art|book|scripture|cultivation)\b[^.?!]*\b(?:take|carry|go|get)\b/,
    /\bwhat (?:is|'s) (?:my|the) (?:ceiling|limit|cap|wall)\b/,
    /\bwhat (?:is|'s) (?:stopping|blocking|holding) me\b/,
    // the neighbours a player reaches for next
    /\bwhat(?:'s| is) holding me back\b/,
    // The plainest form of the question, and it reached nothing. A player who
    // does not yet know the vocabulary asks this one first.
    /\bhow (?:do|can|would) i (?:get|become|grow) (?:stronger|more powerful|better)\b/,
    /\bwhat should i (?:do|be doing)\b/,
    /\bwhy (?:can'?t|cannot) i (?:break through|breakthrough|advance|progress|rise|go (?:any )?(?:further|higher))\b/,
    /\bwhy (?:has|have) my cultivation (?:stopped|stalled)\b/,
    /\bwhy (?:is|am) (?:nothing|my progress) (?:happening|accumulating|moving)\b/,
    /\bhow far (?:does|will) my (?:manual|book|method|art) go\b/,
    /\bwhat (?:is|'s) (?:in my way|my bottleneck)\b/,
    /\b(?:am i|have i) (?:hit|reached|run into) (?:a|my|the) (?:wall|ceiling|limit|cap)\b/
].map(r => r.source).join('|'));

/**
 * Who stands above them and would teach.
 *
 * The teaching nouns are required rather than optional in most of these, and
 * that is what keeps it away from `sect`: "who would take me" is a house
 * question and "who would teach me" is a person question, and the difference
 * is the verb. `master` is the one word that leaks - it is also a LEARNING
 * verb ("master the Iron Bell Manual") - so every branch carrying it here
 * either puts it after a seeking verb or in front of a question word, never
 * bare.
 */
export const TEACHER_QUESTION = new RegExp([
    /\bwho (?:can|could|would|will|might|is (?:able|willing) to)\b[^.?!]*\b(?:teach|guide|instruct|train|tutor|mentor|show me|take me on|take me as)\b/,
    /\b(?:can|could|would|will) (?:anyone|anybody|somebody|someone) (?:here |about |around |nearby )?teach\b/,
    /\b(?:look|looking|looks|search|searching|seek|seeking|find|finding|want|wanted|need|needing) (?:for |out )?(?:a |an |any |some |the )?(?:master|teacher|mentor|tutor|instructor|shifu|sifu)\b/,
    /\b(?:ask|asking|asks|enquire|inquire) (?:about|after|for) (?:a |an |the |any )?(?:master|teacher|mentor|tutor|instructor)\b/,
    /\bis there (?:a |an |any )?(?:master|teacher|mentor|tutor|instructor)\b/,
    /\b(?:a|any) (?:master|teacher|mentor) (?:here|about|around|nearby|in this)\b/,
    // Somebody who already has one, asking who it is. Reached nothing, which
    // is a strange answer to give a disciple about their own teacher.
    /\bwho (?:is|was|are) my (?:master|teacher|mentor|shifu|sifu|instructor)\b/,
    /\bis there (?:anyone|anybody|somebody|someone)\b[^.?!]*\b(?:stronger|higher|deeper|above me|further along|more advanced|senior to me)\b/,
    /\bwho (?:is|are|stands?) (?:above|over) me\b/,
    /\bwho (?:here )?(?:is|are) (?:stronger|higher|deeper|more advanced) than me\b/,
    /\bwho could guide my cultivation\b/,
    /\bteach me\b/
].map(r => r.source).join('|'));

/**
 * Where they could go.
 *
 * Kept off bare `travel` and bare `go`, which belong to `move` and must
 * continue to: "I travel to Barrow Hand" names a place and is a journey, and
 * stealing it here would be the exact failure this block was written to fix,
 * pointed the other way. Every branch below either asks a question word or
 * names a NON-place ("somewhere else", "anywhere else"), which is precisely
 * the sentence `move` cannot resolve and answers badly.
 */
export const DESTINATIONS_QUESTION = new RegExp([
    /\bwhere (?:can|could|should|might|would) i (?:go|travel|head|walk)\b/,
    /\bwhere (?:else )?(?:is there|are there|could i)\b/,
    /\bwhat(?:'s| is| are)? ?(?:nearby|near here|near by|around here|close by|hereabouts)\b/,
    /\bwhat (?:other )?places?\b[^.?!]*\b(?:can|could|should) i\b/,
    /\bwhat (?:else )?is (?:there )?(?:nearby|around|out there|beyond)\b/,
    /\bwhere is (?:there|the)\b[^.?!]*\b(?:better|stronger|denser|thicker|richer|more)\b[^.?!]*\b(?:qi|spiritual energy|spirit energy|energy|cultivation)\b/,
    /\bwhere (?:is|are) the (?:qi|spiritual energy|spirit energy|energy) (?:better|stronger|denser|thicker|richer)\b/,
    /\b(?:travel|go|move|head) (?:somewhere|anywhere) (?:else|better|new)\b/,
    /\b(?:somewhere|anywhere) else to (?:go|cultivate|be)\b/,
    /\bwhat (?:are )?my (?:travel )?options\b[^.?!]*\bwhere\b/,
    /\bwhere (?:could|can) i cultivate (?:better|faster)\b/,
    /\bwhat (?:towns?|villages?|cities|regions?|provinces?) (?:are|can i reach)\b/,
    // ── SOMEWHERE QUIET TO SIT ───────────────────────────────────────────
    //
    // Every one of these was tried in play and every one of them failed:
    // "I seek an uninhabited place to cultivate" and "I go into the wilds to
    // find a secluded spot" did not resolve at all, and "I look for a quiet
    // cave in the mountains" came back with the room description. Meanwhile
    // the world held 34 caves, wilds and veins, all already discovered, 31 of
    // them with nobody on them and the best at nearly twice a market town's
    // density - and `move` would have accepted any of them by name, because it
    // resolves world locations directly. The player was never told the names.
    //
    // This is the question those sentences are asking, and `destinations` now
    // answers it: it lists that ground alongside the towns with the occupancy
    // of each. Narrow on the QUIET nouns rather than on the verb, because
    // `move` owns "I go into the wilds" as a journey and `gather` owns "I look
    // for" as a search, and neither may be stolen.
    /\b(?:quiet|uninhabited|unoccupied|empty|deserted|secluded|isolated|remote|uncrowded|undisturbed|lonely)\b[^.?!]*\b(?:place|places|spot|spots|cave|caves|ground|valley|mountain|mountains|wilds|wilderness|corner|somewhere)\b/,
    /\b(?:place|spot|cave|ground|somewhere)\b[^.?!]*\b(?:nobody|no one|no-one|nothing)\b[^.?!]*\b(?:else|around|there|nearby)\b/,
    /\b(?:away from|out of) (?:the )?(?:crowd|crowds|people|town|towns|everyone|everybody)\b/
].map(r => r.source).join('|'));

/** The verbs a line is taken off the board with. */
export const DUTY_SUBJECT_VERBS =
    /take|takes|taking|accept|accepts|accepting|sign up for|signs up for|volunteer for|put my name (?:down )?(?:for|to)|do/;

/**
 * Asking a house to let you sit in, in the ways somebody would actually ask.
 *
 * Every one of these is a sentence about a PLACE rather than about a book,
 * which is what keeps them out of `learn_technique`'s way. The last one is the
 * loosest and carries two guards: the preposition, because "I study the manual"
 * is the other verb, and the `my` exclusion, because "I study with my master"
 * and "I study my book" are both sentences about something the player already
 * has.
 *
 * The listing phrasings are here too - "who would take me as a guest", "where
 * could I study" - because a player who has not been told a house takes guests
 * cannot name one, and being shown the set is the sentence before the one that
 * takes a place.
 */
export const GUEST_STUDENT_PATTERNS: readonly RegExp[] = [
    /\bguest (?:student|studentship|pupil|disciple|place|places|roll|term)\b/,
    /\b(?:as|be|being|stay as|remain) an? guest\b/,
    /\bas a guest\b/,
    // ── THE PREPOSITION IS LOAD-BEARING AND WAS LEFT OFF ONCE ────────────
    //
    // A bare `sit in` took SIX web tests in one run, all of them seclusion:
    // "I sit in seclusion for ten years" is the commonest way anybody asks for
    // the single longest action in the game, and it contains the phrase. So
    // this asks for the preposition that makes it a place - sit in AT, WITH,
    // ON - and "sit in seclusion" goes back to the verb it has always meant.
    /\bsit(?:s|ting)? in (?:at|with|on)\b/,
    /\b(?:let|allow|permit)s? me (?:to )?sit in\b/,
    /\b(?:study|learn|train)(?:ing)?\b[^.?!]*\bwithout (?:joining|being (?:a )?(?:member|taken on)|membership)\b/,
    /\bteach me\b[^.?!]*\bwithout (?:joining|taking me on|membership)\b/,
    /\bstudy (?:at|under|with|there|them)\b(?!\s+my\b)/
];

/** The verbs a guest place is asked for with, for pulling the house's name out. */
export const GUEST_SUBJECT_VERBS =
    /guest student (?:at|of|with)|guest (?:at|of|with)|study at|study under|study with|sit in (?:at|with|on)|attend at|attend|study|learn at|learn from/;

export const SECT_INTENT_PATTERNS: ReadonlyArray<[SectIntent, RegExp]> = [
    ['leave', /\b(?:leave|leaving|quit|resign|renounce|withdraw from|walk out (?:of|on)|abandon|defect|desert|break with)\b/],
    ['standing', /\b(?:standing|where do i stand|my rank|what rank|my position|my contribution|how (?:am i|do i) (?:doing|rate))\b/]
];

// ─── WHY THE GROUND IS LIKE THIS ──────────────────────────────────────────
//
// `engine/world/locations.ts` has carried the whole of this from the start: a
// place is an origin, an append-only list of things done to it, and a current
// state that is the two folded together. A change records the day, what was
// done, whether the true cause is on record anywhere, and - separately, because
// they are not the same thing - the competing explanations the people here
// hold. The map does not grow, it scars.
//
// None of it could be reached by typing. There was no route from a sentence to
// asking why a place is a ruin, so the disagreement the locals are carrying was
// invisible to the only person who might have cared about it.
//
// The knowledge gate is the feature and not a limitation on it. A place whose
// cause is not on record answers with the disagreement and nothing else, and it
// must be impossible to tell from the answer whether a truth exists and is
// being withheld or whether there is none - the seeded ruins hold a cause fact
// id with `causeKnown: false`, which is exactly the state that must not leak.

/**
 * Asking what was done to a place, in the ways people actually ask it.
 *
 * Narrow on purpose. These fire ahead of `investigate` and `interact`, both of
 * which would otherwise take them - "find out about" is an examination and
 * "what do they say" contains a speech verb - and a wide pattern here would
 * take sentences that belong to those.
 */
export const PLACE_HISTORY_PATTERNS: readonly RegExp[] = [
    /\bwhat happened (?:here|to (?:this|the)\b)/,
    /\bwhat became of (?:this|the)\b/,
    /\bwhy is (?:this|it|the)\b.*\b(?:like this|a ruin|ruined|dead|abandoned|empty|sealed|the way it is)\b/,
    /\bwhat do (?:the )?(?:locals|people|villagers|folk|they) (?:say|think|believe|reckon)\b/,
    /\bwhat is said (?:about|of) (?:this|the)\b/,
    /\b(?:the )?(?:history|story|stories) of (?:this|the)\b/,
    /\bhow did (?:this|the)\b.*\b(?:end up|come to be|get like this|get this way|happen)\b/
];

/** Where such a question names a place rather than meaning the ground underfoot. */
export const PLACE_HISTORY_SUBJECT =
    'happened to|happened at|became of|history of|story of|stories of|said about|said of';

// ─── INHERITANCE GROUNDS ──────────────────────────────────────────────────
//
// `data/cultivation/inheritance-trials.ts` has carried twenty-odd sites, three
// unrelated kinds of gate and a fully written interior from the start, and the
// systems playtest reported the whole of it as unreachable: nothing in this
// parser named a site, so a player could not approach, assess or enter one.
//
// Four steps, and they must not eat each other or anybody else's sentences.
// The rule is the one the `order` branch established and the seat's powers
// inherited: A VERB IN VERB POSITION, PLUS A NOUN THAT SAYS WHAT IT IS AIMED
// AT. Both halves are required and both are load-bearing. "go to", "find",
// "open", "take" and "study" are five of the commonest verbs in any sentence a
// player types, and "grave", "trial" and "door" are ordinary nouns in this
// setting; either half alone would take sentences belonging to `move`,
// `investigate`, `work` and `gather`.
//
// The two exceptions are the two sentences that name nothing because they do
// not need to - "I go inside" and "what does it look like from out here" both
// mean the site the cultivator went to most recently, exactly the way "what
// happened here" means the ground underfoot. Those resolve against a row in
// `game.ts`, not against a guess here.

/** The four steps of taking an inheritance, in the order they happen. */
export type SiteIntent = 'approach' | 'outside' | 'enter' | 'take';

/**
 * The closed set, and the one that must fall through to the cheapest.
 *
 * `enter` is the only member that spends anything, so a model-planned `site`
 * carrying an intent nothing here recognises resolves to the LISTING and never
 * to the door. See `GameService.site`.
 */
export const SITE_INTENTS: readonly SiteIntent[] = ['approach', 'outside', 'enter', 'take'] as const;

/** What an unrecognised site intent means. The read that costs nothing. */
export const DEFAULT_SITE_INTENT: SiteIntent = 'approach';

/**
 * The generic nouns that mean an inheritance ground.
 *
 * `vault` is deliberately absent: `SECT_THEFT_PATTERN` owns it, and a sentence
 * about emptying a house's vault is a siphon rather than a grave-robbing. The
 * one site whose name contains it is reachable by that name instead.
 */
export const SITE_NOUNS =
    // `ruin` was missing, which is the word the setting itself uses: locations
    // carry `kind: 'ruin'`, the seeding layer talks about `ruin.opened`, and
    // there is a `docs/world/ruins.md`. So the parser knew about tombs and
    // crypts and inheritance grounds and not about the thing they are all
    // called. Found by playing: "what ruins are near" reached nothing, "I enter
    // the ruin" was read as travel, and "I look for a ruin" returned the room
    // description - while the whole site subsystem sat behind words a player
    // had to guess.
    //
    // A secret realm is here for the same reason and nothing else is. Adding
    // scars, sealed domains, forbidden zones and spirit veins as well was too
    // greedy: they stole sentences from `investigate` and from ordinary place
    // resolution, because those words appear in the names and descriptions of
    // places a player travels to rather than walks into. Fix the gap that was
    // demonstrated, not the one that was imagined.
    /\b(?:inheritance (?:ground|grounds|site|sites|trial|trials|cave|caves)|trials?|graves?|tombs?|crypts?|burial (?:ground|site|mound)|grave goods?|interment|ruins?|ruined (?:hall|compound|temple)|secret realms?)\b/;

/**
 * The face of a site: what is physically at the threshold.
 *
 * Every one requires its article, which is what keeps "the gate" apart from
 * "the gate steward" and "the door" apart from a door in somebody's house. A
 * sentence about looking at one of these is a sentence about reading a site
 * from outside, which is the read that must never return the interior.
 */
export const SITE_FACE_NOUNS =
    /\b(?:the door|the doorway|the gate frame|the gateway|the gate\b|the threshold|the marker|the headstone|the entrance|the shaft|the plate|the standing stone)\b/;

/** What is behind the door, referred to without naming the site. */
export const SITE_PRIZE_NOUNS =
    /\b(?:what(?:'s| is) (?:behind|beyond|inside|under|on) |what(?:'s| is) (?:in there|left)|whatever(?:'s| is) (?:behind|inside|in there)|the prize|the inheritance|the grave goods|the contents|the manuals?)\b/;

export const SITE_ENTER_VERBS =
    'enter|enters|entering|go inside|goes inside|step inside|steps inside|go in|goes in|'
    + 'step in|steps in|walk in|walks in|head inside|climb down into|descend into|descend|'
    // `go in` does not match "go into", because the boundary falls after `in`.
    // "I go into the ruins" reached nothing at all while "I go in" worked.
    + 'go into|goes into|get into|gets into|climb into|climbs into|venture into|ventures into|'
    + 'breach|open|opens|opening|unseal|unseals|break into|breaks into|attempt|attempts|'
    + 'attempting|try|tries|sit at|sit down at|put my hands on';

export const SITE_TAKE_VERBS =
    'take|takes|taking|claim|claims|claiming|collect|collects|lift|lifts|pocket|pockets|'
    + 'carry off|carries off|help myself to|strip|strips|recover|recovers|walk out with|'
    // What a player actually calls it when the site is a grave. Found by a
    // standing sweep: "I rob the grave of Shen Guyi" reached nothing at all,
    // while "I take what is in the grave of Shen Guyi" - the same act, said
    // politely - went through the whole four-step surface. The graves are
    // catalogued and the taking step is implemented; only the honest word for
    // it was missing.
    + 'rob|robs|robbing|loot|loots|looting|plunder|plunders|plundering|rifle|rifles|'
    + 'dig up|digs up|digging up|break into|breaks into|breaking into';

export const SITE_LOOK_VERBS =
    'study|studies|studying|size up|sizes up|sizing up|look at|looks at|look over|looks over|'
    + 'read|reads|reading|examine|examines|inspect|inspects|scout|scouts|eye|eyes|case|cases|'
    + 'weigh up|weighs up';

export const SITE_APPROACH_VERBS =
    'go to|goes to|head to|heads to|head for|heads for|walk to|walks to|travel to|make for|'
    + 'makes for|approach|approaches|find|finds|finding|look for|looks for|looking for|'
    + 'search for|searches for|seek out|seek|seeks|locate|locates';

/**
 * Reading it from where you are standing, with no name in the sentence.
 *
 * This is the phrasing that guarantees the structural gate holds in practice
 * rather than only in the type system: a player who has not gone in asking
 * what it looks like from out here must get `interior.outside` and nothing
 * else, however they phrase the question.
 */
export const SITE_FROM_OUTSIDE =
    /\bfrom (?:out here|outside|the outside|out front|where i(?:'m| am)? stand\w*|here)\b|\bwithout going in(?:side)?\b/;

/** Asking what grounds there are, which needs no verb at all. */
export const SITE_QUESTION =
    /\b(?:what|which|where|any|are there|is there|anything|know of|heard of)\b/;

/**
 * Sentences that are weighing an attempt rather than making one.
 *
 * "Could I survive that trial" and "is it safe to go in" are `assess`, and
 * they contain a site noun and an entering verb respectively. Vetoed rather
 * than ordered around, because `assess` sits far below this block and the
 * sentence that needs the veto satisfies the site rule completely.
 */
export const WEIGHING_RATHER_THAN_GOING =
    /\b(?:is it safe|could i (?:survive|take|handle|manage)|do i stand a chance|am i (?:strong|ready) enough|weigh (?:my|the) chances|how dangerous|what (?:would|will) happen if i)\b/;

/**
 * The site a sentence names, out of the catalog's own short forms.
 *
 * `SITE_PHRASES` is derived from the site ids rather than written here, so a
 * site added to the catalog becomes typeable with no edit to the parser. The
 * length floor keeps a two-character slug from ever becoming a wildcard.
 */
export function siteNamed(text: string): string | undefined {
    for (const phrase of SITE_PHRASES) {
        if (phrase.length >= 6 && text.includes(phrase)) return phrase;
    }
    return undefined;
}

/**
 * A commission or summons the player has NAMED, or undefined.
 *
 * The same shape as {@link siteNamed} and for the same rule: any name the game
 * prints is a name the game must accept. The board prints titles like "What a
 * Poor District Has Instead of Monsters", and typing one back reached nothing
 * at all - the duty branch needs a board noun and a title has none, so a
 * sentence made entirely of what the game had just said fell through to the
 * generic parser and out the bottom.
 *
 * That left the whole progression loop dead: the board lists work, prices it in
 * contribution, changes the payout when you join a house, and had no accepting
 * sentence of any kind. Contribution gates promotion and promotion gates the
 * shelf, so the sect member's entire path terminated at a wall they could read
 * and not touch.
 *
 * Longest first, so a title that contains another title matches the longer one.
 */
export function dutyNamed(text: string): string | undefined {
    for (const phrase of DUTY_PHRASES) {
        if (text.includes(phrase)) return phrase;
    }
    return undefined;
}

/**
 * Every commission and summons title, lowercased, longest first.
 *
 * Built from the catalogs the board itself draws from, so a title added to the
 * content files is typeable the day it lands and nobody has to remember to add
 * it here. Short titles are dropped: a two-word name is a phrase somebody might
 * use in an ordinary sentence, and stealing those is the failure mode this
 * file's own history is full of.
 */
const DUTY_PHRASES: readonly string[] = [...new Set(
    [...SUMMONS_ENTRIES, ...COMMISSION_ENTRIES].map(entry => entry.name.toLowerCase())
)]
    .filter(name => name.length >= 12)
    .sort((a, b) => b.length - a.length);

/**
 * One of the four steps of taking an inheritance, or null.
 *
 * Order is specificity-first and it matters at every step. "I go inside the
 * grave" contains an approach verb and an entering one and is a sentence about
 * going in. "I take what is behind the plate" contains no site noun at all and
 * is still unambiguously the last step. And the whole block is vetoed for the
 * sentences that are weighing rather than doing, because those belong to
 * `assess` and always did.
 */
function siteStep(text: string, input: string): PlannedAction | null {
    if (WEIGHING_RATHER_THAN_GOING.test(text)) return null;

    const named = siteNamed(text);
    const noun = SITE_NOUNS.test(text);
    const face = SITE_FACE_NOUNS.test(text);
    const anchored = named !== undefined || noun || face;
    const target = named ?? (anchored ? namedAfter(input, SITE_ANY_VERB) : undefined);

    // Going in. Ahead of everything, because an entering verb next to a site
    // is not ambiguous and every other step's verbs turn up in the same
    // sentence. The bare form is admitted only when nothing follows it: "I go
    // inside" means the place they went to, and "I go into the village" is
    // movement and must stay movement.
    if ((anchored && usedAsVerb(text, SITE_ENTER_VERBS))
        || (!anchored && /\b(?:i\s+)?(?:go|step|head|walk)\s+in(?:side)?\s*[.!?]?$/.test(text))) {
        return { action: 'site', intent: 'enter', ...(target ? { target } : {}) };
    }

    // Taking it. The prize nouns stand in for a name because a player who is
    // already inside says "what is behind the plate", not the name of the
    // ground they walked onto an hour ago.
    if (usedAsVerb(text, SITE_TAKE_VERBS) && (anchored || SITE_PRIZE_NOUNS.test(text))) {
        return { action: 'site', intent: 'take', ...(target ? { target } : {}) };
    }

    // Reading it from outside. This one must never be able to return the
    // interior, and it is phrased as its own step rather than folded into the
    // approach so that the refusal to go further is visible in the log.
    if (SITE_FROM_OUTSIDE.test(text) || (anchored && usedAsVerb(text, SITE_LOOK_VERBS))) {
        return { action: 'site', intent: 'outside', ...(target ? { target } : {}) };
    }

    // Getting there, and the listing. A question with a site noun in it and no
    // verb aimed anywhere is somebody asking what there is, which is the
    // sentence before all of the above and the only one that names nothing on
    // purpose.
    if (anchored && usedAsVerb(text, SITE_APPROACH_VERBS)) {
        return { action: 'site', intent: 'approach', ...(target ? { target } : {}) };
    }
    if ((noun || named !== undefined) && SITE_QUESTION.test(text)) {
        return { action: 'site', intent: 'approach', ...(named ? { target: named } : {}) };
    }

    return null;
}

/** Every site verb, for pulling the noun phrase out of the sentence. */
const SITE_ANY_VERB =
    `${SITE_ENTER_VERBS}|${SITE_TAKE_VERBS}|${SITE_LOOK_VERBS}|${SITE_APPROACH_VERBS}`;

// ─── WHAT AM I CARRYING IN MY HEAD ────────────────────────────────────────
//
// The knowledge layer decides what may be said in front of this cultivator and
// the sheet shows what they have comprehended, and neither could be asked
// about in words. A rank-band sweep found it at the ceiling rather than the
// floor, which is the worst place for it: at the last two rungs the ladder is
// finished and comprehension is the only thing still moving, so "what is my
// dao" is close to the only question left and it parsed to nothing.
//
// The gate is the feature and this must not weaken it. Every pattern below
// reaches a read of the holder's OWN rows. There is no phrasing here that
// consults the world, so no phrasing here can teach anybody anything - being
// unable to name a sect until somebody says it in front of you stays exactly
// as true afterwards as before.

/** The two reads. `knowledge` is what they have heard; `dao` what they hold. */
export type RecallIntent = 'knowledge' | 'dao';

export const RECALL_INTENTS: readonly RecallIntent[] = ['knowledge', 'dao'] as const;

/** What an unrecognised recall intent means. Both are free; this is the wider. */
export const DEFAULT_RECALL_INTENT: RecallIntent = 'knowledge';

/**
 * Asking after a name they may or may not be carrying.
 *
 * Every one requires the first person. "what do the locals say about it" is
 * the ground's history and belongs to `look`, "what is said of the Gleaners"
 * is somebody else's talk, and neither is a question about what this
 * cultivator holds.
 */
export const RECALL_PATTERNS: readonly RegExp[] = [
    /\bwhat do(?:es)? i? ?know (?:of|about)\b/,
    /\bwhat do i (?:know|remember|recall) (?:of|about)\b/,
    /\bwhat have i (?:heard|been told|learned|learnt|got) (?:of|about|on)\b/,
    /\bwhat do i have on\b/,
    /\bremind me (?:what i (?:know|have heard) )?(?:of|about)\b/,
    /\bwhat i know (?:of|about)\b/,
    /\bhave i (?:ever )?heard (?:of|about)\b/,
    /\bdo i know (?:of|about|who|what)\b/
];

// ─────────────────────────────────────────────────────────────────────────
// WHOSE ART THAT WAS
//
// Deliberately narrow. Every pattern here names an ART - "art", "style",
// "technique", "method", "form" - because "do I recognise her" is a question
// about a face and belongs to `recall`, and the whole point of this verb is
// that faces tell nobody anything and arts do.
// ─────────────────────────────────────────────────────────────────────────

/** A noun that means somebody's way of moving rather than a person or a place. */
const AN_ART_NOUN = '(?:art|arts|style|technique|method|form|movement|footwork)';

/** "whose art is that", the question with no claim in it. */
export const WHOSE_ART_IS_THAT = new RegExp(
    `\\bwhose\\s+${AN_ART_NOUN}\\b|\\bwhat\\s+(?:house|sect|school)(?:'s|s')?\\s+${AN_ART_NOUN}\\b`,
    'i'
);

/**
 * "do I recognise this style", "have I seen this form before".
 *
 * The first person is required for the same reason `RECALL_PATTERNS` requires
 * it: "would anyone recognise this" is a question about the world.
 */
export const DO_I_RECOGNISE_IT = new RegExp(
    `\\b(?:do|can|could|would)\\s+i\\s+(?:recognis|recogniz)e\\b`
    + `|\\bi\\s+(?:recognis|recogniz)e\\b`
    + `|\\bhave\\s+i\\s+seen\\s+(?:this|that|it)\\b`
    + `|\\bdo\\s+i\\s+know\\s+(?:this|that)\\s+${AN_ART_NOUN}\\b`,
    'i'
);

/**
 * Words that can stand between the start of the sentence and the house's name.
 *
 * Stripped one at a time from the left rather than matched around, because a
 * lazy capture anchored at the start of the string takes the WHOLE clause:
 * `is this the Azure Cloud Pavilion's art` came out as
 * "is this the Azure Cloud Pavilion", which resolves to nobody. Measured on the
 * first played turn of this verb, which is exactly the failure the party
 * matchers elsewhere in this file carry their own notes about.
 */
const NOT_PART_OF_A_HOUSE_NAME = new Set([
    'is', 'are', 'was', 'were', 'be', 'whose', 'do', 'does', 'did', 'can', 'could',
    'would', 'should', 'i', 'this', 'that', 'it', 'he', 'she', 'they', 'them',
    'the', 'a', 'an', 'tell', 'me', 'if', 'whether', 'look', 'looks', 'like',
    'really', 'actually', 'even', 'some', 'any', 'one', 'of'
]);

/**
 * The house named in a possessive: "the Azure Cloud's art".
 *
 * Run against the original input rather than the lowercased text, because what
 * comes out is handed straight to a name matcher, and a matcher scores an exact
 * name higher than a lowercased one.
 */
export function houseClaimedIn(input: string): string | undefined {
    const found = new RegExp(`([A-Za-z][A-Za-z' -]{2,80}?)(?:'s|s')\\s+${AN_ART_NOUN}\\b`)
        .exec(input);
    if (!found) return undefined;
    const words = found[1].trim().split(/\s+/);
    while (words.length > 0 && NOT_PART_OF_A_HOUSE_NAME.has(words[0].toLowerCase())) words.shift();
    const name = words.join(' ').trim();
    return name.length >= 3 ? name.slice(0, 80) : undefined;
}

/**
 * A claim put to the check: "is this the Azure Cloud's art".
 *
 * The subject may be a pronoun, which is the ordinary case - somebody has just
 * moved and the player is asking about what they saw.
 */
export const IS_THIS_THEIR_ART = new RegExp(
    `\\bis\\s+(?:this|that|it|he|she|they|the\\s+\\w+)\\b[^.?!]*?(?:'s|s')\\s+${AN_ART_NOUN}\\b`,
    'i'
);

/**
 * Which art the sentence is about, when it names one.
 *
 * Undefined is the common answer and is not a failure: "is this the Azure
 * Cloud's art" names a house and no art, and the handler reads that as a
 * question about the house's signature - which is what the sentence means.
 */
export function artNamedIn(input: string): string | undefined {
    const named = /\b(?:recognis|recogniz)e\s+(?:the\s+)?([A-Za-z][\w' -]{2,60}?)\s*[.?!]?$/i.exec(input);
    const cleaned = (named?.[1] ?? '').trim();
    if (cleaned.length < 3) return undefined;
    // A pronoun is not a name, and neither is the bare noun. Both mean "the
    // thing I just watched", which this parser cannot resolve and must not
    // pretend to.
    if (new RegExp(`^(?:this|that|it|them|${AN_ART_NOUN})$`, 'i').test(cleaned)) return undefined;
    return cleaned.slice(0, 80);
}

/** The whole holding, asked for at once. Names nobody on purpose. */
export const RECALL_EVERYTHING =
    /\bwhat do i know\b\s*[.!?]?$|\bwhat do i know at all\b|\bwhat have i heard\b\s*[.!?]?$|\bwhat names do i (?:have|hold|know)\b|\bwhat have i learn(?:ed|t)\b\s*[.!?]?$/;

/**
 * News, rumour, and what is being said - which in this world IS the holding.
 *
 * There was no verb for any of it: "what news is there" and "what is happening
 * in the world" resolved to nothing, and "I listen for rumours" became a
 * one-day wait. In a game whose entire knowledge model is names reaching you
 * through other people - `hearsay.ts`, the overheard channel, the whole
 * `whisper`/`named`/`placed`/`known` ladder - that is a large missing verb.
 *
 * It was routed to `recall` for a while, which lists everything that has
 * already reached this cultivator. That was defensible - there is no wire
 * service here - and it was answering a different question: `recall` reads the
 * holder's own head and structurally cannot teach them anything, so "what news
 * is there" came back as a well-composed inventory of what the player already
 * had. The failure mode `interact` was producing for the institutional verbs,
 * one layer over: it looks exactly like an answer.
 *
 * It goes to `news` now, which asks the people standing here. See
 * `asking-what-people-are-saying.ts`.
 */
export const NEWS_AND_RUMOUR =
    /\b(?:what news|any news|what(?:'s| is) the news|what(?:'s| is) happening (?:in the world|out there|elsewhere)|what(?:'s| is) going on (?:in the world|out there)|what are people saying|what do people say|listen for (?:rumours?|rumors?|news|talk)|any (?:rumours?|rumors?)|what (?:rumours?|rumors?)|catch up on the news|what have i heard lately)\b/;

/**
 * The same question in the words somebody would actually use.
 *
 * Every one of these was typed at the pattern above and reached nothing, which
 * is the failure this repo keeps relearning: a player cannot find the working
 * half except by guessing, and the failing half is usually the more natural
 * phrasing. "what is the word" and "what is the talk" are the two commonest
 * ways of asking this in the register the setting is written in, and neither
 * contains the word "news".
 *
 * `gossip` is here as a bare noun because it has no other reading. "what do
 * people say about this place" is deliberately NOT here - that is the ground's
 * history and belongs to `look`, and the whole rule for widening a pattern is
 * to check the sentence next door has not been swallowed.
 */
export const ASKING_AFTER_THE_WORLD =
    /\b(?:what(?:'s| is) the (?:word|talk)|any word from|what have you heard|what do they say (?:out there|elsewhere|in the world)|ask(?:ing)? around for (?:news|word|talk)|gossip|hear anything|heard anything)\b/;

/**
 * The same question asked of the ground underfoot, which is a different verb.
 *
 * `NEWS_AND_RUMOUR` has carried a bare "what do people say" from before this
 * verb existed, and `PLACE_HISTORY_PATTERNS` carries the same words - so "what
 * do people say about this place" matched both, and the earlier branch won. It
 * was wrong before this change too (it went to the knowledge listing) and it is
 * this branch's to fix now, because this branch is the one taking it.
 *
 * The split is by what the question POINTS AT rather than by the verb in it:
 * pointed at the ground it is the ground's history, and pointed at nothing in
 * particular it is the world. Deliberately narrow - it names the deictics and
 * nothing else - because the last time a fix here was widened past what had
 * been demonstrated it stole sentences from two other verbs.
 */
export const ABOUT_THE_GROUND_HERE =
    /\b(?:about|of) (?:this|the) (?:place|ground|town|village|city|valley|mountain|ruin|road|hall|province|county)\b|\babout (?:here|it here)\b|\bhappened here\b|\bsay about here\b/;

/**
 * The other axis, and the one that matters at the ceiling.
 *
 * `DaoView.theOnlyAxisLeft` is read off the same predicate the engine gates a
 * re-attempt with, so for somebody whose ladder is shut this is not a flavour
 * question - it is the only account of what they are still doing.
 */
export const RECALL_DAO =
    /\b(?:my dao|my own dao|my understanding|my comprehensions?|my insights?|what have i comprehended|what have i understood|what do i understand|what road am i on|which road am i on|my road|where has my understanding got to)\b/;

/**
 * Putting the dao somewhere it will outlast you, which is the WRITE of what
 * `recall` reads - and which this engine cannot do.
 *
 * Vetoed rather than answered, and the veto is the honest half. "I carve my
 * dao into the stone" and "I teach the flying blade to a disciple" both
 * satisfy the read patterns above, and the read is a perfectly composed
 * paragraph about what the cultivator has comprehended - which looks exactly
 * like an answer and is not one. That is the same failure `interact` was
 * producing for the institutional sentences, and it is worse here, because a
 * player at the top of the ladder who has just been told what they understand
 * has no way to tell that the carving did not happen.
 *
 * There is no state behind it to reach. Nothing in the engine records a
 * carving, no disciple exists as a row that could be taught (an intake is a
 * count on a ledger, not a person), and `legacy.ts` writes a successor's
 * inheritance at death rather than by anybody's decision. So the sentence
 * falls through to `unclear`, which passes no time and claims nothing, and
 * this comment is where the next person looking for it will find out why.
 * See `src/web/README.md`, "What the write side would need".
 */
export const PUTTING_IT_SOMEWHERE_ELSE =
    /\b(?:carve|carves|carving|inscribe|inscribes|inscribing|engrave|engraves|engraving|cut it into|write (?:it |my dao )?(?:onto|into|on)|leave (?:it|my dao|my understanding) (?:to|for|behind)|pass (?:it|my dao|my understanding) (?:on|to|down)|hand (?:it|my dao) (?:on|to|down)|teach (?:it|my dao|my understanding|my road) to)\b/;

/** Where a recall question stops asking and starts naming. */
export const RECALL_SUBJECT =
    'know of|know about|remember of|remember about|recall of|recall about|'
    + 'heard of|heard about|been told of|been told about|learned of|learned about|'
    + 'learnt of|learnt about|have on|got on|remind me of|remind me about';

// ─── GETTING A WOUND SEEN TO ──────────────────────────────────────────────
//
// The route out of the injury spiral, and it has to be wide, because the
// sentences a player types when the engine has just told them they are hurt
// are not a vocabulary they chose. Every phrasing below was typed at a real
// run that was stuck: "I look for a physician to treat my meridian injuries"
// went to `look` and got a description of the room, and "I get my injuries
// treated" went to `unclear`.
//
// Wide is safe here in a way it is not elsewhere. The worst a false positive
// does is quote a price and refuse, and the branch below cannot fire without
// either a wound in the sentence or somebody in it whose whole trade is
// wounds.

/** Wounds, in the words people use for them rather than the schema's. */
export const INJURY_NOUNS =
    /\b(?:injur\w*|wound\w*|meridians?|hurt|hurts|broken (?:bone|arm|leg|rib|ribs)|bones?|damage)\b/;

export const TREATMENT_VERBS =
    'treat|treats|treated|treating|heal|heals|healed|healing|mend|mends|mending|'
    + 'patch up|patch me up|patch myself up|bind|binds|bandage|bandages|tend|tends|'
    + 'see to|attend to|fix|fixes';

/** Somebody whose trade is wounds. Naming one is half the sentence. */
export const HEALER_NOUNS =
    /\b(?:physician|physicians|doctor|doctors|healer|healers|apothecary|apothecaries|medic|medics|surgeon|surgeons|infirmary)\b/;

/**
 * Going to get it done, as opposed to doing it.
 *
 * `talk`, `ask` and `speak` are deliberately absent: "I talk to the physician"
 * is a conversation and belongs to `interact`, and a player who wanted the
 * treatment says so.
 */
export const SEEKING_CARE_VERBS =
    'see|sees|seeing|find|finds|finding|look for|looks for|looking for|visit|visits|'
    + 'consult|consults|pay for|pays for|pay|hire|hires|get|gets|want|wants|need|needs|'
    + 'go to|goes to|head to|call for|send for';

export const TREATMENT_NOUNS =
    /\b(?:treatment|medical care|a course of care|course of care|first aid|the infirmary|care for)\b/;

/**
 * The phrasing where the treatment verb is a participle at the end of the
 * sentence rather than a verb at the front of it.
 *
 * "I get my injuries treated" is the single most natural way to ask for this
 * and `usedAsVerb` correctly refuses it, because "treated" there is not in
 * verb position. Matched whole instead.
 */
export const HAVING_IT_SEEN_TO =
    /\b(?:get|gets|getting|have|has|having|want|wants|wanting|need|needs|needing|would like|ask for|asking for)\b[^.!?]*\b(?:injur\w*|wounds?|meridians?|myself|me)\b[^.!?]*\b(?:treated|seen to|looked at|fixed|attended to|mended|patched up|bandaged|set)\b/;

// ─── BUYING A LINE OFF THE BOARD ──────────────────────────────────────────
//
// `market` prints twenty-two priced lines. Four verbs spent money before this
// existed and between them they covered three of those lines, so the board was
// advertising a physician, a ferry, a scribe, an inn and a course of care that
// no sentence could reach. The purchase itself is refused or resolved in
// `game.ts` against `PRICES`; all this has to do is stop the sentence being
// read as an approach to a person.

export const BUYING_VERBS =
    'buy|buys|buying|purchase|purchases|purchasing|pay for|pays for|order|orders|'
    + 'book|books|hire|hires|acquire|acquires|take passage|pay the';

/**
 * Paying somebody off, which is `interact` and not a line on a board.
 *
 * Vetoed rather than ordered around, because the sentence that needs it
 * satisfies the buying rule completely and means something else entirely.
 */
// ─── PUTTING SOMETHING ON THE COUNTER ─────────────────────────────────────
//
// The other direction, and the only one that existed was buying. Gathering
// prices every herb it turns up, `quoteSale` has priced a lot the whole time,
// and there was no sentence between the two.

export const SELLING_VERBS =
    'sell|sells|selling|offload|offloads|offloading|unload|unloads|unloading|'
    + 'hawk|hawks|hawking|peddle|peddles|peddling|part with|parts with|'
    + 'cash in|cashes in|trade in|trades in|trade away';

/** The same list as a pattern, for `extractSubject`, which reads `.source`. */
export const SELLING_SUBJECT_VERBS = new RegExp(SELLING_VERBS);

/**
 * Asking what a thing FETCHES rather than putting it down.
 *
 * Both are `sell` - a quote is a read of the same function - so this is not a
 * veto, it is here so that a question about the board as a whole still reaches
 * `market` and does not become an attempt to empty the pouch.
 */
export const SELLING_ASKED_AS_A_BOARD =
    /\b(?:what(?:'s| is) (?:for sale|on offer)|what can i buy|the prices?|(?:browse|visit|see|check|go to|head to) the (?:market|bazaar|stalls?))\b/;

export const BUYING_A_PERSON_OFF =
    /\b(?:bribe|bribes|bribing|pay off|pays off|grease|buy (?:his|her|their|the \w+'s) silence|pay (?:him|her|them) (?:off|to))\b/;

// ─── INSTITUTIONS ACTING ON EACH OTHER, AND ON THE DEAD ───────────────────
//
// Every rule below follows the shape the `order` branch established and the
// four seat powers repeated: A VERB IN VERB POSITION, PLUS THE NOUN THAT SAYS
// WHAT IT IS AIMED AT. Both halves are required, and they have to be, because
// this vocabulary is the setting's own. "ancestor", "seal", "war", "offering",
// "claim", "grant" and "petition" appear far more often as the object of
// somebody else's sentence than as the subject of one of these, and every one
// of them sits one clause away from a verb that would take the sentence
// somewhere adjacent and answer it wrongly.
//
// These sit HIGH in the table - above the asking branch, above `investigate`,
// above `interact` - and that placement is the fix for the defect that
// produced them. `interact` matches any sentence naming a faction, so
// "I ask the Deep Survey for one of its pills", "I offer an alliance to the
// Frostmirror Court" and "I petition the Third Sill Court for a grant" were
// all being answered by walking the player over and describing the building.
// A verb that quietly does something adjacent is worse than one that does
// nothing, because the player cannot tell refused from not implemented.

/** Which form is being filed. Selects a read; never decides an outcome. */
export type PetitionIntent = 'grant' | 'stock' | 'descent';
export const PETITION_INTENTS: readonly PetitionIntent[] = ['grant', 'stock', 'descent'] as const;
/** The cheapest and widest: send it up the chain and see how far it goes. */
export const DEFAULT_PETITION_INTENT: PetitionIntent = 'grant';

/**
 * The verbs that mean this on their own.
 *
 * `petition` and `appeal` are enough by themselves: nothing else in the
 * setting's vocabulary uses either word, and both name the act exactly.
 *
 * `apply` is deliberately NOT here, and leaving it in cost a regression that
 * this comment exists to stop somebody re-introducing. "I apply to the
 * Thousand Treasure Pavilion" is a sentence about JOINING - the sect surface
 * has owned `apply to` since it was written - and a bare `apply` in this table
 * took it and filed a request for a grant with a house the player was trying
 * to enrol in.
 */
export const PETITION_VERBS_ALONE =
    'petition|petitions|petitioning|appeal|appeals|appealing';

/**
 * The verbs that mean this only with the thing being asked for.
 *
 * `file`, `submit` and `lodge` reach the form branch through
 * {@link STANDING_STOCK_NOUNS}; here they need {@link PETITION_NOUNS}, because
 * every one of them is an ordinary word for putting a piece of paper somewhere.
 */
export const PETITION_VERBS =
    'petition|petitions|petitioning|appeal|appeals|appealing|apply|applies|applying|'
    + 'file|files|filing|submit|submits|submitting|lodge|lodges|lodging|put in|puts in';

/** The asking verbs, which reach this only with an institutional object. */
export const PETITION_ASKING_VERBS =
    'ask|asks|asking|request|requests|requesting|beg|begs|begging|entreat|entreats';

/** What is being asked for, where a bare asking verb needs a noun to qualify. */
export const PETITION_NOUNS =
    /\b(?:a grant|the grant|a stipend from|an allowance|a posting|a place at|relief|for aid|for protection|for help|a dispensation|an exemption|a hearing|a ruling|a (?:dao )?protector|a guard for|a technique|an art|a manual|the manual|resources|materials|stones for|a pill from)\b/;

/**
 * The form, by name and by shape.
 *
 * `requisition` is unambiguous and needs no verb. The rest is the general case
 * the Requisition is one instance of: an application against something an
 * institution is holding and cannot reorder. Nothing here names a faction.
 */
export const REQUISITION_NAMED = /\brequisitions?\b/;

/**
 * The objects themselves, by name, generated from the catalog.
 *
 * A player who has been told what one of these is called asks for it by name -
 * "an Unearned Step", "a Second Dealing" - and a hand-written list here would
 * go stale the moment the catalog gained a third. Built rather than typed, on
 * the precedent `SITE_PHRASES` already sets in this file: a phrase list that
 * can drift from the content it describes is a phrase list that will.
 *
 * Names only. Nothing about what any of them does, how many exist, or who is
 * holding one crosses this boundary - the parser is deciding which verb the
 * sentence is, and the knowledge gate in `game.ts` decides everything else.
 */
export const IMMORTAL_ITEM_NAMED = new RegExp(
    '\\b(?:' + IMMORTAL_ITEMS
        .map(item => item.name.replace(/^The\s+/i, ''))
        .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|')
    + ')\\b',
    'i'
);

export const STANDING_STOCK_NOUNS =
    /\b(?:standing stock|the stock|schedule amendment|amendment against|golden pills?|talismans?|immortal (?:pill|item|medicine|object)|one of (?:its|their|his|her) (?:pills?|talismans?)|(?:its|their) pills?)\b/;

/** Claiming a line, which is an application for recognition and is audited. */
export const DESCENT_VERBS =
    'claim|claims|claiming|assert|asserts|asserting|press|presses|pressing|'
    + 'register|registers|registering|prove|proves|proving';

export const DESCENT_NOUNS =
    /\b(?:descent|descended from|descend from|my (?:line|lineage|ancestry|blood)|the line of|of the blood of|kinship (?:to|with)|ancestral claim|claim of descent)\b/;

/** What a house is to another house. Selects a read; never decides an outcome. */
export type PostureIntent = 'stance' | 'war' | 'alliance' | 'defect' | 'tribute';
export const POSTURE_INTENTS: readonly PostureIntent[] =
    ['stance', 'war', 'alliance', 'defect', 'tribute'] as const;
/**
 * The read, and it must stay the default.
 *
 * Three of the four commit the house irreversibly and one of them starts a war.
 * A model answering `{"action":"posture","intent":"deal with them"}` gets the
 * standing between the two houses and nothing else, on exactly the reasoning
 * behind {@link DEFAULT_SITE_INTENT}.
 */
export const DEFAULT_POSTURE_INTENT: PostureIntent = 'stance';

export const DECLARE_VERBS =
    'declare|declares|declaring|open|opens|opening|make|makes|making|start|starts|'
    + 'starting|go to|going to|take|takes|taking';

/** The noun that says a declaration is a declaration of war. */
export const WAR_NOUN = /\b(?:war|hostilities|the field against)\b/;

export const ALLIANCE_VERBS =
    'offer|offers|offering|propose|proposes|proposing|make|makes|making|form|forms|'
    + 'forming|seek|seeks|seeking|extend|extends|extending|ally|allies|sue for';

export const ALLIANCE_NOUNS =
    /\b(?:alliance|alliances|allied|a pact|the pact|a league|common cause|mutual defence|mutual defense|terms with)\b/;

/**
 * Changing who the house holds from, which two courts in the catalog's own
 * history have already done.
 *
 * Requires a destination. "I defect" on its own is a member leaving a sect and
 * belongs to `sect`, which owns the word already - taking it here without
 * somewhere to go would answer a resignation with a diplomatic manoeuvre.
 */
/**
 * Demanding a payment from somebody, which is only a demand if you hold
 * something over them.
 *
 * Nearly dropped for want of data, and then it turned out the data is the best
 * part: `getParentage(client).parentFactionId` says who a house actually holds
 * from and `holds` says in what terms, so whether this is a levy or a threat is
 * a fact about the two parties rather than about the sentence. A house
 * demanding from its own client is exercising a right the catalog wrote down. A
 * house demanding from somebody else's client has said something about the
 * patron.
 */
export const TRIBUTE_VERBS =
    'demand|demands|demanding|levy|levies|levying|require|requires|requiring|'
    + 'exact|exacts|exacting|collect|collects|collecting|call in|calls in';

export const TRIBUTE_NOUNS =
    /\b(?:tribute|a levy|the levy|dues|a tithe|the tithe|their (?:grant|stones|contribution)|what (?:they|it) owes?)\b/;

export const DEFECT_PATTERN =
    /\b(?:defect(?:s|ing)? to|go(?:es|ing)? over to|went over to|transfer (?:our|the house'?s?|its|the) (?:allegiance|grant|patronage|standing)|change (?:our |the house'?s? )?patrons?|hold from|swear the (?:house|sect|clan|school) to|put (?:us|the house|the sect) under)\b/;

/** The seal. Selects a read; never decides an outcome, and never whose it is. */
export type SealIntent = 'read' | 'wake';
export const SEAL_INTENTS: readonly SealIntent[] = ['read', 'wake'] as const;
/**
 * The priced read, and it must stay the default.
 *
 * Waking one is the single most consequential thing a house can do and the one
 * act in this file that changes a power ordinal. A model answering
 * `{"action":"seal"}` with no label gets the condition and the cost.
 */
export const DEFAULT_SEAL_INTENT: SealIntent = 'read';

export const WAKE_VERBS =
    'wake|wakes|waking|waken|wakens|awaken|awakens|awakening|rouse|rouses|rousing|'
    + 'raise|raises|raising|unseal|unseals|unsealing|break|breaks|breaking|'
    + 'call up|calls up|bring up|brings up|open|opens|opening';

/**
 * Who or what is being woken. Without one of these the sentence is about
 * something else entirely - waking at dawn, raising a bar, breaking a barrier.
 */
export const SEALED_NOUNS =
    // "the sleeper" is retired vocabulary in the catalogs - they are people
    // under a mountain rather than instruments - and it stays HERE because a
    // parser has to accept the words a player types, not the words the world
    // uses. Nothing downstream repeats it back.
    /\b(?:sealed ancestor|dormant ancestor|the sleeper|sleeping ancestor|(?:our|their|its|the|my) ancestors?|seals?|what(?:'s| is) under the mountain|under the mountain|the thing under|sealed elder)\b/;

/**
 * Sentences that contain the wake vocabulary and mean something else.
 *
 * "break through the barrier" is the breakthrough branch and reaches this file
 * first, but "I break the seal on the gate" at an inheritance ground is a
 * site sentence and "I raise the admission bar" is a decree, and both would
 * otherwise satisfy the rule above. Vetoed rather than ordered, because each of
 * them satisfies it completely.
 */
export const NOT_THE_SEALED_ANCESTOR =
    /\b(?:barrier|bottleneck|admission|entry bar|the bar\b|curriculum|dawn|morning|from sleep|up early)\b/;

/**
 * The channel, from whichever end the speaker is standing at.
 *
 * `send` is the immortal side of the same pipe `offering` is the mortal side
 * of, and they are one verb on purpose. Somebody below pays a decade of a
 * house's principal and asks; somebody above decides whether to answer and what
 * to send. Two verbs for that would have been two implementations of one
 * relationship, and the half that decides which end you are at is state -
 * `canExistBeyondTheLid` - rather than the word the player used.
 */
export type OfferIntent = 'channel' | 'offering' | 'send';
export const OFFER_INTENTS: readonly OfferIntent[] = ['channel', 'offering', 'send'] as const;
/**
 * Reading what the line is, which costs nothing.
 *
 * An offering is paid out of the principal rather than the interest, so the
 * default here is the same as everywhere else in this section: the read.
 */
export const DEFAULT_OFFER_INTENT: OfferIntent = 'channel';

export const OFFERING_VERBS =
    'make|makes|making|send|sends|sending|offer|offers|offering|give|gives|giving|'
    + 'burn|burns|burning|lay|lays|laying|present|presents|presenting|pay|pays|paying';

export const OFFERING_NOUNS =
    /\b(?:an offering|the offering|offerings|incense|a sacrifice|the sacrifice|tribute to (?:our|the|its) ancestor|rites? (?:to|for) (?:our|the) ancestor)\b/;

/**
 * Who the offering is aimed at, for the phrasings that name the recipient
 * rather than the rite. "I make an offering to our ascended ancestor" is
 * caught by the noun above; "I send word up to the founder" is caught here.
 */
export const ASCENDED_NOUNS =
    /\b(?:ascended ancestor|our ancestor above|the one who crossed|our founder above|above the lid|the far side of the lid|(?:our|the) ascended)\b/;

/**
 * Sending something DOWN, which is the other end of the same pipe.
 *
 * Both halves required, as everywhere in this section. "send" and "down" are
 * each far too ordinary alone - "I send the disciples down to the river" is an
 * errand - so the rule wants a sending verb aimed at the lower world by name.
 */
export const SENDING_DOWN =
    /\b(?:send|sends|sending|drop|drops|dropping|put|puts|putting|pass|passes|passing|reach|reaches|reaching|deliver|delivers)\b[^.!?]*\b(?:down through the lid|through the lid|below the lid|down the line|down the channel|down to (?:the )?(?:province|world below|lower world|mortal world|my |our |them\b))\b/;

/** What is being sent, where the sentence says. Never a gate; carried through. */
export const SENDING_NOUNS =
    /\b(?:a word|word|a message|the message|a warning|an answer|a sword|a blade|a weapon|a pill|a talisman|an object|something|a gift|instructions?)\b/;

// ─── GOING BACK DOWN YOURSELF ─────────────────────────────────────────────
//
// The other of the two answers, and the expensive one. Kept narrow because it
// is the single most dangerous action in the game: nine strikes of the
// heaviest tribulation there is, weathered by somebody who spent a life
// reaching the rung where they could be struck by it. A sentence has to say
// plainly that the speaker is going, and through the Lid, before it reaches
// this - so the whole rule is a movement verb next to the boundary by name.
//
// "I go down" alone is deliberately NOT enough. Below the Lid it means a
// staircase, and a phrasing that means a staircase to almost everybody must
// not end a run for the one player standing above the Lid when they type it.

export const GOING_DOWN_VERBS =
    'go|goes|going|descend|descends|descending|return|returns|returning|come|comes|coming|'
    + 'drop|drops|dropping|step|steps|stepping|force|forces|forcing|open|opens|opening|'
    + 'cross|crosses|crossing|head|heads|heading';

export const THE_WAY_BACK_DOWN =
    /\b(?:back down|down through the lid|through the lid|down to the (?:province|world below|lower world|mortal world|world)|into the lower world|below the lid|down myself|down in person|the way i came)\b/;

/**
 * Going down without saying so, in the two phrasings that unmistakably mean it.
 *
 * A verb is not required here because neither phrase has any other reading:
 * nobody says "I descend through the Lid" about a staircase.
 */
export const DESCENT_UNAMBIGUOUS =
    /\b(?:descend(?:s|ing)? (?:through|below|past) the lid|go back down through|force (?:the lid|a hole|an opening) (?:inward|open|down)|open the lid (?:again|a second time))\b/;

/**
 * Intents the prompt suggests for `move`. Suggestions, not a schema: the field
 * accepts any short label, because the engine resolves movement from state and
 * reads the label only to describe what was attempted.
 */
export const MOVE_INTENTS = ['travel', 'flee', 'approach', 'enter', 'follow'] as const;

/**
 * Intents the prompt suggests for `interact`. Open by design; see above.
 *
 * `petition` used to be on this list and is deliberately gone. It was the
 * clearest single expression of the defect the four verbs above exist to fix:
 * the prompt was actively suggesting that a model route a petition to the verb
 * that walks the player over and describes the building, and a player who filed
 * one got a paragraph about architecture.
 */
/**
 * What each verb actually puts on the table.
 *
 * The translation lives HERE rather than in `game.ts`, because the social
 * resolver reads `leverage` and never `intent` - that is the design, and it is
 * what stops seduction becoming a subsystem instead of a member of an enum.
 * Doing the mapping at the point the verb is recognised keeps the rule "nothing
 * downstream branches on the word the player typed" literally true.
 *
 * Intents with nothing behind them are absent rather than `none`: an absent key
 * is a sentence that put nothing on the table, and the resolver's own default
 * says so.
 */
const LEVERAGE_BEHIND_INTENT: Readonly<Partial<Record<string, z.infer<typeof ApproachLeverageSchema>>>> = {
    bribe: 'coin',
    threaten: 'force',
    // The asker themselves. Priced by the same machine as the other two.
    seduce: 'attachment'
};

export const INTERACT_INTENTS = [
    'talk', 'negotiate', 'trade', 'deceive', 'interrogate',
    'threaten', 'bribe', 'recruit', 'apologise', 'seduce'
] as const;

/**
 * Which of those ten reach the pressure model rather than describing somebody.
 *
 * `GameService.interact` sends exactly these to `pressSomebody`, which resolves
 * the attempt, runs the days through `shortSkip` and takes the stones off the
 * purse when it lands. The other three - `talk`, `trade`, `apologise` - fall to
 * the branch that reports who this party is and settles nothing, which passes
 * no time and moves nothing.
 *
 * Written here rather than imported because `game.ts` holds the executor's own
 * copy (`ATTEMPT_INTENTS`) and this file may not depend on that one - actions
 * is below game, not above it. Two copies of a set is a drift risk and the
 * answer is not a comment asking people to be careful: the regression test
 * PLAYS all ten intents in both moods and asserts the split by measuring what
 * each one spent, so a member added on either side goes red on the next run.
 * See `tests/web/asking-is-not-doing.test.ts`.
 *
 * Note what is NOT the discriminator. `LEVERAGE_BEHIND_INTENT` covers three of
 * these and the other four press somebody just as hard with nothing on the
 * table - measured, one day each - so leverage is what the attempt is made
 * WITH and never whether an attempt was made.
 */
export const PRESSING_SOMEBODY: ReadonlySet<string> = new Set([
    'bribe', 'threaten', 'seduce', 'deceive', 'negotiate', 'interrogate', 'recruit'
]);

export const PlannedActionSchema = z.object({
    action: z.enum(ACTION_NAMES),
    /**
     * Duration for `cultivate`, in days. Bounded on both ends so a model that
     * answers `1e9` cannot ask the simulator for a heat-death-of-the-universe
     * loop, and one that answers `0` cannot produce a no-op the player paid a
     * turn for.
     */
    days: z.number().int().min(1).max(MAX_CULTIVATION_DAYS).optional(),
    /**
     * Free text: a destination for `travel`, a person for `talk`, a thing for
     * `investigate` or `search`, an art for `train_technique`, a formula for
     * `refine`. Never a number, never a stat, never persisted anywhere the
     * engine reasons about - `Cultivator.location` is explicitly a name the
     * engine stores and lists but never computes with, and everything else is
     * matched against a catalog before it can reach a repository.
     */
    target: z.string().trim().min(1).max(80).optional(),
    /**
     * What the player was trying to do: `negotiate`, `deceive`, `flee`,
     * `interrogate`, anything. An open string, and it is only safe as an open
     * string because no engine path reads it to decide an outcome. It reaches
     * the log and the narrator; it never reaches a conditional that produces a
     * result. Truncated to a label in `validatePlan` rather than rejected on
     * length: a model that writes a sentence here has not done anything
     * dangerous, and throwing the whole plan away over it would cost the player
     * a turn for no gain.
     */
    intent: z.string().trim().min(1).max(400).optional(),
    /**
     * WHAT IS BEHIND THE ASK, set by the parser rather than translated later.
     *
     * The social-leverage resolver reads `leverage` and never `intent` - that
     * is the whole design of it, and it is what keeps seduction priced by the
     * same machine that prices a purse or a threat instead of becoming a
     * subsystem with its own rules. Setting it HERE, where the verb is already
     * being recognised, keeps that rule strictly true: `game.ts` passes it
     * through and does not translate a word into a mechanic.
     *
     * Optional and defaulted to `none` downstream, because most sentences put
     * nothing on the table.
     */
    leverage: ApproachLeverageSchema.optional(),
    /**
     * WHAT THE TWO OF THEM SAID THE FIGHT WAS, set by the parser for the same
     * reason `leverage` is.
     *
     * `agreed` is a bout both parties consented to - a spar, a duel, a
     * challenge. Absent is `open`: nobody promised anybody anything, which
     * covers a brawl and a planned murder alike.
     *
     * It changes NOTHING about the fight. The goal handed to the resolver is
     * `subdue` either way, the exchanges are the same exchanges, the wounds are
     * the same wounds and the death gate is the same gate - the ruling in
     * AGENTS.md is that a bout is combat with both sides agreeing to be gentle,
     * and that nothing may quietly make it unable to kill. What this decides is
     * downstream and only downstream: whether a killing was also a broken word,
     * which is a question about people and not about a body.
     */
    terms: z.enum(['agreed', 'open']).optional(),
    /**
     * How many rations, where the sentence names a count rather than a span.
     *
     * Separate from `days` because they are different asks and the conversion
     * between them is not the parser's to make: how long a ration lasts depends
     * on the body carrying it, since hunger tapers by realm. Bounded so a model
     * answering `1e9` cannot ask the purse for a heat-death of provisions.
     */
    rations: z.number().int().min(1).max(100_000).optional(),
    /**
     * What an approach is ABOUT, when the player asked about something.
     *
     * Separate from `target`, which is who they asked. Both are needed and
     * neither substitutes: who you ask decides what you get, so the engine
     * has to know both before it can say what came back. Like `intent`,
     * nothing branches on it to produce an outcome - it selects which facts
     * the person in front of the player could plausibly hold, and the
     * holding is read off state.
     */
    topic: z.string().trim().min(1).max(120).optional(),
    /** The model's one-line justification. Logged for transparency, never executed. */
    reason: z.string().trim().max(200).optional()
});

export type PlannedAction = z.infer<typeof PlannedActionSchema>;

/**
 * Whether this PLAN takes nothing from the player.
 *
 * A narrower question than whether its ACTION is on {@link READ_ONLY_ACTIONS},
 * and `interact` is the whole of the difference: it is free on `talk`, `trade`
 * and `apologise` and spends days and stones on the other seven, so the action
 * alone cannot answer it. Every consumer that used to ask the list should ask
 * this instead - the list is a statement about verbs, and the cost of this one
 * is a fact about the sentence.
 *
 * There are two consumers and they want the same answer for different reasons.
 * {@link theReadThatAnswersIt} asks it to decide whether a question about an
 * act is already answered by the act; `the-part-of-the-sentence-that-was-not-run`
 * asks it to decide whether a dropped clause took anything, and its own measured
 * rule - report a clause only if it would have COST something - was calibrated
 * on a corpus in which `interact` was free. Both would have been wrong in the
 * same direction from one stale answer, which is exactly why this is a function
 * and not a second list.
 */
export function costsTheAskerNothing(plan: PlannedAction): boolean {
    return plan.action === 'interact'
        ? !PRESSING_SOMEBODY.has(plan.intent ?? '')
        : READ_ONLY_ACTIONS.includes(plan.action);
}

/** Where a plan came from. Surfaced to the client so the seam is visible. */
export type PlanSource = 'model' | 'fallback';

export interface Plan {
    action: PlannedAction;
    source: PlanSource;
    /** Why the fallback ran, when it ran. Diagnostic, shown in `toolCalls`. */
    note?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// DETERMINISTIC INTENT PARSING
// The zero-configuration path, and the safety net under the model. It must be
// good enough to play the whole game with, because with no provider reachable
// it *is* the whole game.
// ─────────────────────────────────────────────────────────────────────────

const DURATION_UNITS: ReadonlyArray<[RegExp, number]> = [
    [/\b(?:day|days)\b/, 1],
    [/\b(?:week|weeks)\b/, 7],
    [/\b(?:month|months)\b/, 30],
    [/\b(?:season|seasons)\b/, 90],
    [/\b(?:year|years|yr|yrs)\b/, 365],
    [/\b(?:decade|decades)\b/, 3650],
    [/\b(?:century|centuries)\b/, 36_500]
];

const WORD_NUMBERS: Readonly<Record<string, number>> = {
    a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
    eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20, thirty: 30,
    forty: 40, fifty: 50, hundred: 100
};

/**
 * The same table as a regex alternation, longest first so `fifteen` is not
 * eaten by `five`.
 *
 * Built rather than typed, because a hand-written list of number words next to
 * a table of number words goes stale exactly once and then silently: "ten years
 * of provisions" did not parse, because a provisioning rule enumerated
 * `a|one|two|three` and stopped, so the sentence fell through to `buy` and died
 * at the price board. Anything that needs to spell out a count in a pattern
 * should splice this in.
 */
const WORD_NUMBER_ALTERNATION = Object.keys(WORD_NUMBERS)
    .sort((a, b) => b.length - a.length)
    .map(word => `${word} `)
    .join('|');

/**
 * Days named in a phrase, or null when none is.
 *
 * Handles "90 days", "three years", "a decade", "half a year". Deliberately
 * greedy about the unit and conservative about the count: an unparseable count
 * next to a recognised unit means one of that unit, which is always a smaller
 * commitment than the player might have meant, and undershooting a permadeath
 * time-skip is the forgiving direction to be wrong in.
 */
export function parseDuration(input: string): number | null {
    // "half a year" reads as one token to a scanner walking backwards from the
    // unit, and "a" means one. Normalising it up front is cheaper than teaching
    // the scanner to look two words back.
    const text = input.toLowerCase().replace(/\bhalf\s+an?\b/g, '0.5');

    for (const [unitPattern, unitDays] of DURATION_UNITS) {
        const match = unitPattern.exec(text);
        if (!match) continue;

        const before = text.slice(0, match.index).trim();
        const tail = before.split(/[\s,]+/).filter(Boolean).slice(-2);

        let count = 1;
        for (const token of tail.reverse()) {
            const digits = Number(token.replace(/[^0-9.]/g, ''));
            if (Number.isFinite(digits) && digits > 0) { count = digits; break; }
            if (token === 'half') { count = 0.5; break; }
            const word = WORD_NUMBERS[token];
            if (word !== undefined) { count = word; break; }
        }

        const days = Math.round(count * unitDays);
        return Math.max(1, Math.min(MAX_CULTIVATION_DAYS, days));
    }

    // A bare number with no unit is not a duration. "I strike the barrier 3
    // times" must not become three days of seclusion.
    return null;
}

/**
 * The span the sentence ASKED for, with no ceiling applied.
 *
 * `parseDuration` clamps to {@link MAX_CULTIVATION_DAYS} and says nothing about
 * having done so, which is the invisible-fallback defect in numeric form:
 * "I cultivate for 100000 years" came back as "Seclusion of 100 years was
 * intended", a thousandfold silent correction that reads like the engine
 * agreeing with you. The ceiling is real - it is the longest stretch this
 * engine resolves in a single pass - and it has to be SAID.
 *
 * Returns null on the same sentences `parseDuration` returns null for, so a
 * caller can compare the two and only speak when they differ.
 */
export function durationAskedFor(input: string): number | null {
    const text = input.toLowerCase().replace(/\bhalf\s+an?\b/g, '0.5');

    for (const [unitPattern, unitDays] of DURATION_UNITS) {
        const match = unitPattern.exec(text);
        if (!match) continue;

        const before = text.slice(0, match.index).trim();
        const tail = before.split(/[\s,]+/).filter(Boolean).slice(-2);

        let count = 1;
        for (const token of tail.reverse()) {
            const digits = Number(token.replace(/[^0-9.]/g, ''));
            if (Number.isFinite(digits) && digits > 0) { count = digits; break; }
            if (token === 'half') { count = 0.5; break; }
            const word = WORD_NUMBERS[token];
            if (word !== undefined) { count = word; break; }
        }

        return Math.max(1, Math.round(count * unitDays));
    }

    return null;
}

/**
 * How many were asked for, or null when the sentence does not say.
 *
 * Separate from {@link parseDuration} because a count is not a span and must
 * never be read as one: "three disciples" is three people, and answering it
 * with three days of anything would be the same class of error as reading "a
 * season" out of a sentence about employment. Deliberately refuses a bare zero
 * and anything that is not a plain count, so the caller falls back to the
 * tool's own default rather than to a guess made here.
 */
export function parseCount(input: string): number | null {
    const digits = /\b([0-9]{1,3})\b/.exec(input);
    if (digits) {
        const n = Number(digits[1]);
        if (n >= 1) return n;
    }
    for (const token of input.toLowerCase().split(/[^a-z]+/).filter(Boolean)) {
        const word = WORD_NUMBERS[token];
        if (word !== undefined && word >= 1) return Math.round(word);
    }
    return null;
}

/**
 * Text following a movement preposition, cleaned into a place name.
 *
 * Returns undefined rather than guessing. "I set out." names no destination,
 * and a parser that answers "I set out." to the question *where to?* would send
 * the cultivator to a place called "I set out." - the engine would dutifully
 * store it, and the run would be quietly nonsense from then on.
 */
function extractDestination(input: string): string | undefined {
    const prepositional = /\b(?:to|towards?|into|for)\s+(.{2,80}?)\s*[.!?]?$/i.exec(input);
    if (prepositional) return cleanPlace(prepositional[1]);

    // "travel Scarwater" - a bare destination straight after the verb.
    const bare = /^\s*(?:i\s+)?(?:travel|go|walk|head|journey|move|depart|leave|set out)\s+(.{2,80}?)\s*[.!?]?$/i
        .exec(input);
    return bare ? cleanPlace(bare[1]) : undefined;
}

function cleanPlace(raw: string): string | undefined {
    const cleaned = raw.replace(/^\s*the\s+/i, '').trim();
    return cleaned.length >= 2 ? cleaned.slice(0, 80) : undefined;
}

/** Text following a conversational verb, cleaned into a name. */
function extractTarget(input: string): string | undefined {
    const match = /\b(?:to|with|at)\s+(.{2,80}?)\s*[.!?]?$/i.exec(input);
    const cleaned = (match?.[1] ?? '').trim();
    return cleaned.length >= 2 ? cleaned.slice(0, 80) : undefined;
}

/**
 * The subject of a transitive verb: whatever follows it, or whatever follows a
 * preposition after it.
 *
 * "search the ruin", "look into the inscription", "haggle with the broker",
 * "refine a Meridian Knitting Pill" all reduce to the noun phrase. Undefined
 * when there is no noun phrase, which every caller treats as a refusal rather
 * than a guess.
 */
/**
 * Intent tables for the deterministic parser.
 *
 * Note carefully what these do and do not do. They label what the player was
 * trying to do so the narrator can describe it; they never select an engine
 * path. Every `move` resolves through the same movement routine and every
 * `interact` through the same interaction routine, whichever label matched -
 * which is the whole reason the label is allowed to be an open string.
 */
const MOVE_INTENT_PATTERNS: ReadonlyArray<[string, RegExp]> = [
    ['flee', /\b(?:flee|escape|run away|get away|disengage|retreat|break off|withdraw|hide from)\b/],
    // `go into` was absent while `go inside` and `step into` were present, so
    // "I go into the village" reached nothing. The site rule takes this
    // sentence first when a site noun is in it, and movement gets it otherwise,
    // which is the correct order for both.
    ['enter', /\b(?:enter|go into|goes into|go inside|step into|climb into|breach|infiltrate|sneak into|slip into)\b/],
    ['approach', /\b(?:approach|draw near|walk up to|close on|come to)\b/],
    ['follow', /\b(?:follow|shadow|trail|tail)\b/],
    ['travel', /\b(?:travel|go to|head (?:to|for|out|north|south|east|west|upriver|downriver|inland|back|on|home)|walk to|journey|set out|set off|press on|carry on to|depart|move to|leave for|make (?:my|his|her) way)\b/]
];

/**
 * The nouns that are not people, however violent the verb in front of them.
 *
 * "Strike at the barrier" is the game's own phrase for a breakthrough attempt
 * and appears in its own UI, and the attack rule was matching it on "the [a-z]"
 * and sending the player after a person who is not there. Checked before the
 * attack rule rather than after it, because the attack rule has to stay first:
 * every sentence about a fight is full of other verbs' nouns.
 */
/**
 * Nouns that look like something to hit and are the bottleneck.
 *
 * Sole job: keep the attack branch off a sentence about the ladder. "I strike
 * at the barrier" is a breakthrough attempt and reads as assault.
 *
 * `wall` and `ceiling` were added when the drive harness measured "have I hit
 * a wall" routing to `attack` - `hit` is an attack verb and `usedAsVerb`
 * correctly found it in verb position, so the sentence was a fight against a
 * noun the object model does not contain. Nothing in this world is a wall or a
 * ceiling that anybody could swing at, so exempting both costs the attack verb
 * nothing and returns four phrasings of the commonest question in the game.
 */
const AIMED_AT_THE_LADDER =
    /\b(?:the )?(?:barrier|bottleneck|blockage|realm boundary|wall|ceiling|next (?:rank|realm))\b/;

const ATTACK_SUBJECT_VERBS = /attack|strike at|strike|hit|fight|kill|murder|assassinate|slay|cut down|draw on|swing at|go for|set upon|set on|jump|ambush|assault|take on|put down|finish/;

const MOVE_SUBJECT_VERBS = /flee|escape|run|retreat|hide|withdraw|enter|infiltrate|sneak into|approach|follow|travel|go|head|walk|journey|depart|move/;

const INTERACT_INTENT_PATTERNS: ReadonlyArray<[string, RegExp]> = [
    ['deceive', /\b(?:lie to|deceive|mislead|misdirect|bluff|pretend|disguise|pose as|feign|trick)\b/],
    /**
     * Ahead of `negotiate` so it does not eat "beg", and ahead of `talk`, which
     * would take every one of these as speech.
     *
     * `attachment` is already a member of `ApproachLeverageSchema`, priced by
     * the same machine that prices a purse or a threat, so seduction needs no
     * subsystem and gets none: what this row does is name the leverage, and
     * nothing downstream branches on the word the player typed.
     */
    ['seduce', /\b(?:seduce|seduces|seducing|court|courting|woo|charm|flirt|flatter|win (?:him|her|them) over|make (?:him|her|them) fond of me|get close to)\b/],
    ['threaten', /\b(?:threaten|intimidate|menace|warn (?:him|her|them)|make (?:him|her|them) afraid)\b/],
    ['bribe', /\b(?:bribe|pay off|grease|buy (?:his|her|their) silence)\b/],
    ['interrogate', /\b(?:interrogate|question|press (?:him|her|them)|demand to know|grill)\b/],
    ['trade', /\b(?:trade|buy|sell|purchase|barter|haggle|market|shop|price)\b/],
    ['negotiate', /\b(?:negotiate|bargain|make terms|come to terms|strike a deal|petition|ally|alliance|swear|join|apply to|seek protection|beg)\b/],
    ['recruit', /\b(?:recruit|hire|take on|enlist|bring (?:him|her|them) in)\b/],
    ['apologise', /\b(?:apologi[sz]e|make amends|beg (?:his|her|their) pardon)\b/],
    ['talk', /\b(?:talk|speak|ask|greet|converse|say|tell|introduce myself)\b/]
];

/**
 * Generic ways of saying "a person", which are not names.
 *
 * "someone" resolved against the roster and came back with a specific
 * cultivator, which handed the player a name they had not earned off a word
 * that named nobody. A generic person means whoever is at hand, and who that
 * turns out to be is the engine's to decide.
 */
const ANYBODY = /^(?:around|about|someone|somebody|anyone|anybody|people|folk|the locals|the people|a passerby|a stranger|a local|them|him|her|somebody else)$/i;

/** Where a question stops naming who and starts naming what. */
const ASK_PIVOT = /\s+(?:about|after|regarding|concerning|whether|if|what|where|who|how|why|for)\s+/i;

/** The verbs that put a question to a person. */
const ASK_VERB = /\b(?:ask|asking|asks|enquire of|inquire of|put it to|question|press)\b\s*/i;

/**
 * Split "ask the old woman about the ruins" into who and what about.
 *
 * Returns null when nothing was asked of anybody. Either half may come back
 * empty and that is meaningful: "I ask around about the sects" names no
 * individual, "I ask the gate steward" names no topic, and both still reach a
 * person, which is the whole point of routing them here.
 */
export function parseAsk(input: string): { person?: string; topic?: string } | null {
    const verb = ASK_VERB.exec(input);
    if (!verb) return null;

    const rest = input.slice(verb.index + verb[0].length).replace(/[.!?]+$/, '').trim();
    if (rest.length === 0) return {};

    const pivot = ASK_PIVOT.exec(rest);
    const who = (pivot ? rest.slice(0, pivot.index) : rest).trim();
    const about = pivot ? rest.slice(pivot.index + pivot[0].length).trim() : '';

    const person = who.length >= 2 && !ANYBODY.test(who) ? cleanPlace(who) : undefined;
    const topic = about.length >= 2 ? cleanPlace(about) : undefined;
    return { ...(person ? { person } : {}), ...(topic ? { topic } : {}) };
}

const INTERACT_SUBJECT_VERBS = /interact with|seduce|court|woo|charm|flirt with|flatter|deceive|mislead|bluff|pose as|trick|lie to|threaten|intimidate|bribe|interrogate|question|trade|buy|sell|barter|haggle|negotiate|bargain|petition|ally with|join|apply to|swear to|beg|recruit|hire|apologi[sz]e to|talk|speak|ask|greet|tell/;

function matchIntent(text: string, table: ReadonlyArray<[string, RegExp]>): string | undefined {
    for (const [label, pattern] of table) {
        if (pattern.test(text)) return label;
    }
    return undefined;
}

function extractSubject(input: string, verbs: RegExp): string | undefined {
    const afterVerb = new RegExp(
        `\\b(?:${verbs.source})\\b\\s*(?:the|a|an|for|into|at|with|about|to|on|through|around)?\\s+(.{2,80}?)\\s*[.!?]?$`,
        'i'
    ).exec(input);
    if (afterVerb) return cleanPlace(afterVerb[1]);
    return extractTarget(input);
}

/**
 * Turn free text into one action, with no model involved.
 *
 * Order is significance-first, not frequency-first: "break through" contains
 * "through", "train" appears in both technique practice and cultivation,
 * "gather qi" is cultivating while "gather herbs" is foraging, and the specific
 * reading must win in each case. Anything unrecognised resolves to `unclear`,
 * which passes no time and changes nothing - an intent the engine did not
 * understand must never cost the player a year of their life. It used to
 * say `look` here, and it used to be true; a fallthrough that quietly
 * became `cultivate` is what this comment was describing when it was
 * wrong.
 */

/**
 * Whether one of these verbs was USED, rather than merely mentioned.
 *
 * This exists because of the worst bug this parser has produced. The
 * cultivation branch matched `cultivat\w*`, and "cultivator" is one of the
 * most common nouns in the setting - so "I attack the nearest cultivator" was
 * answered by sitting the player down to meditate for a month. They had asked
 * to hit somebody. It burned satiety, it passed time, and it killed a
 * character during testing.
 *
 * The general defect is matching bare substrings against player prose in a
 * world whose core vocabulary - cultivator, cultivation, sect, elder, market,
 * work - appears far more often as the OBJECT of a sentence than as the thing
 * being asked for. So position has to matter: a verb counts when it opens the
 * sentence, or follows a subject or a modal, and does not count when it is
 * sitting behind an article or a preposition where only a noun can be.
 *
 * Deliberately permissive about what may precede the verb and strict about
 * what may not. Missing a real command costs a turn; acting on a noun costs a
 * month of a life.
 */
export function usedAsVerb(text: string, verbs: string): boolean {
    return new RegExp(
        // sentence start, or a subject, or a modal, or a conjunction - the
        // places an English verb actually goes
        '(?:^|[.;,]\\s*|\\b(?:i|we|you|they|lets|let me|then|and|so|now|will|shall|must|'
        + 'want to|wish to|need to|try to|going to|about to|decide to|intend to|hope to|'
        + 'would like to|had better|am going to|set out to|mean to|'
        /**
         * The infinitive markers a QUESTION puts in front of a verb.
         *
         * "is it possible to learn the Lesser Qi-Gathering Manual" and "what
         * would it cost to learn it" both reached `unclear` - the parser knew
         * "I learn X" and "could I learn X" and not the two phrasings somebody
         * uses when they are being careful, which is exactly the shape
         * `AGENTS.md` files under "if a near-synonym works, the phrasing that
         * fails is a bug". The failing half was the more natural one.
         *
         * Safe to widen here because these are all subordinate infinitives,
         * which is a verb position in English and nothing else; and because
         * every sentence that reaches the parser through one of them also
         * matches `ASKING_RATHER_THAN_DOING`, so what it reaches is the read.
         */
        + 'able to|possible to|allowed to|permitted to|supposed to|cost to|take to)\\s+)'
        + '(?:just |now |quietly |carefully |instead )?'
        + '(?:' + verbs + ')' + '\\b',
        'i'
    ).test(text);
}

/**
 * The noun phrase a leadership verb is aimed at.
 *
 * Trimmed at the clause that says WHERE rather than WHO: "Elder Fang from the
 * sect" is one person and a preposition, and handing the whole string to a
 * matcher resolves nobody. Returns undefined when nothing usable followed the
 * verb, and every caller treats that as a request for the LISTING rather than
 * as a guess - seeing which elders there are and what each would cost is the
 * sentence before the one that dismisses somebody, and it is the right answer
 * to a sentence that named nobody.
 */
function namedAfter(input: string, verbs: string): string | undefined {
    const after = new RegExp(
        // `an` before `a`, and a boundary after the article, or "an elder"
        // loses its n: the shorter alternative wins the race and the phrase
        // that comes back is a fragment of the word it was supposed to skip.
        `\\b(?:${verbs})\\b\\s*(?:the|an|a|any|some|all|my|our|its|their|new|more)?\\b\\s*`
        + `(.{2,80}?)`
        + `\\s*(?:\\b(?:from|out of|into|onto|to|under|because|so that|instead of)\\b.*)?[.!?]?$`,
        'i'
    ).exec(input);
    const cleaned = (after?.[1] ?? '').trim().replace(/^(?:the|a|an)\s+/i, '');
    return cleaned.length >= 2 ? cleaned.slice(0, 80) : undefined;
}

/**
 * The other party in a sentence about two institutions.
 *
 * Trimmed at the clause that says WHAT WAS ASKED FOR rather than WHO OF:
 * "petition the Third Sill Court for a grant" is a party and a matter, and
 * handing the whole string to a faction matcher resolves nobody. Wider than
 * {@link namedAfter}'s trim list on purpose - `for`, `about` and `over` all
 * introduce the matter here, and none of them can introduce a faction.
 *
 * Returns undefined when nothing usable followed, and every caller treats that
 * as meaning THEIR OWN HOUSE or as a request for the read, never as a guess.
 * Declaring war on nobody in particular must not pick somebody.
 */
function partyAfter(input: string, markers: string): string | undefined {
    const found = new RegExp(
        `\\b(?:${markers})\\s+(?:the|a|an|our|its|their|his|her)?\\s*`
        + `(.{2,80}?)`
        + '\\s*(?:\\b(?:for|about|regarding|concerning|over|because|so that|'
        + 'instead of|in order|and then|asking)\\b.*)?[.!?]?$',
        'i'
    ).exec(input);
    // A leading preposition survives when the verb itself was the marker that
    // matched - "apply to the Thousand Treasure Pavilion" captures "to the
    // Thousand Treasure Pavilion" - and a faction matcher handed that string
    // resolves nobody. Stripped after the article rather than before, because
    // both can be there.
    const cleaned = (found?.[1] ?? '')
        .trim()
        .replace(/^(?:to|at|of|with|from|before|against|upon|on)\s+/i, '')
        .replace(/^(?:the|a|an)\s+/i, '');
    return cleaned.length >= 2 ? cleaned.slice(0, 80) : undefined;
}

/**
 * What is being asked for, in the petitioner's own words.
 *
 * Carried verbatim into the record and shown back in the refusal, which is the
 * entire point of the verb: the Requisition requires the applicant to state
 * what is at stake in terms of the arterial system rather than in terms of
 * themselves, and being refused in the terms you asked in is the interaction.
 * Nothing branches on it.
 */
function matterAsked(input: string): string | undefined {
    const found = /\b(?:for|about|regarding|concerning)\s+(?:one of\s+|the\s+|a\s+|an\s+|some\s+)?(.{2,120}?)\s*[.!?]?$/i
        .exec(input);
    const cleaned = (found?.[1] ?? '').trim();
    return cleaned.length >= 2 ? cleaned.slice(0, 120) : undefined;
}

/**
 * A party phrase that is not a party.
 *
 * "make an offering to our ascended ancestor" names a recipient and no
 * institution, and handing `ascended ancestor` to a faction matcher would
 * resolve nothing and produce a refusal for a sentence that was perfectly
 * clear. The rule is narrow on purpose: it drops the phrase only where the
 * whole of it is the act's own vocabulary, so "our ancestor at the Pavilion"
 * still carries the Pavilion.
 */
function isTheActItself(phrase: string | undefined): boolean {
    if (!phrase) return true;
    return /^(?:own |our |their |its |the |ascended |sealed |dormant |sleeping )*(?:ancestors?|founders?|line|forebears?|dead|seal|offering|requisition|standing stock|form|application)$/i
        .test(phrase.trim());
}

/**
 * One of the four institutional acts, or null when the sentence is about
 * something else.
 *
 * Ordered narrowest first, and the ordering is load-bearing in two places.
 * ALLIANCE before OFFERING, because `offer` is a verb in both tables and "I
 * offer an alliance" is not a rite. SEAL before OFFERING for the same reason
 * in the other direction: a sentence about an ancestor is not automatically a
 * sentence about incense.
 *
 * Every branch that COMMITS the house is reachable only through an explicit
 * verb plus its noun. There is no phrasing that arrives here vaguely and
 * starts a war, which is the property `DEFAULT_POSTURE_INTENT` exists to keep
 * true on the model path as well.
 */
function institutionalAct(text: string, input: string): PlannedAction | null {
    // ── war ──
    //
    // The declaration verb has to be in verb position. Without that, "what do
    // I know of the war with the Nine Abyss" satisfies the noun rule
    // completely and would be answered by starting one.
    if (usedAsVerb(text, DECLARE_VERBS) && WAR_NOUN.test(text)) {
        const on = partyAfter(input, 'war (?:on|against|upon|with)|against|on');
        return { action: 'posture', intent: 'war', ...(on ? { target: on } : {}) };
    }

    // ── alliance ──
    if (usedAsVerb(text, ALLIANCE_VERBS) && ALLIANCE_NOUNS.test(text)) {
        const to = partyAfter(input, 'alliance (?:to|with)|allied? with|ally with|pact with|cause with|terms with|to|with');
        return { action: 'posture', intent: 'alliance', ...(to ? { target: to } : {}) };
    }

    // ── a levy, or a threat wearing one ──
    if (usedAsVerb(text, TRIBUTE_VERBS) && TRIBUTE_NOUNS.test(text)) {
        const from = partyAfter(input, 'tribute from|levy on|dues from|tithe from|from|on|of');
        return { action: 'posture', intent: 'tribute', ...(from ? { target: from } : {}) };
    }

    // ── defection ──
    //
    // The pattern carries its own destination requirement, so "I defect" alone
    // falls through to `sect`, which owns the word and reads it as a member
    // walking out. Changing who a HOUSE holds from is a different act by a
    // different person and must not be reached by the resignation phrasing.
    if (DEFECT_PATTERN.test(text)) {
        const to = partyAfter(input, 'defect(?:s|ing)? to|go(?:es|ing)? over to|went over to|under|to');
        if (to) return { action: 'posture', intent: 'defect', target: to };
    }

    // ── the thing under the mountain ──
    //
    // Whose mountain it is is NOT read off the sentence. A player who names
    // nobody meant their own house and one who names a house meant that one,
    // and which of those is a decision and which is theft is decided by the
    // membership row in `game.ts`. Reading it here would let a phrasing choose
    // between a legal act and a crime.
    if (usedAsVerb(text, WAKE_VERBS)
        && SEALED_NOUNS.test(text)
        && !NOT_THE_SEALED_ANCESTOR.test(text)) {
        const named = partyAfter(input, 'seal (?:at|of|under|beneath)|ancestor (?:at|of|under|beneath)|at|beneath|under');
        const whose = isTheActItself(named) ? undefined : named;
        return { action: 'seal', intent: 'wake', ...(whose ? { target: whose } : {}) };
    }

    // ── going back down, which is the most expensive sentence in the game ──
    //
    // Ahead of the sending rule, because "I go back down and put a sword in
    // front of them" is somebody going, and above `move`, which owns every
    // other way of getting anywhere and would answer this by walking.
    if (DESCENT_UNAMBIGUOUS.test(text)
        || (usedAsVerb(text, GOING_DOWN_VERBS) && THE_WAY_BACK_DOWN.test(text))) {
        // "myself" and "in person" are what distinguishes this sentence from
        // the proxy one; they are not part of the destination, and handing them
        // to a place matcher resolves nothing.
        const where = partyAfter(input, 'down to|back to|down at|to the|at the|to')
            ?.replace(/\s+(?:myself|in person|personally|alone)$/i, '')
            .trim();
        return {
            action: 'descend',
            ...(where && where.length >= 2 && !isTheActItself(where) ? { target: where } : {})
        };
    }

    // ── the other end of the channel: sending something down ──
    if (SENDING_DOWN.test(text)) {
        const to = partyAfter(input, 'to my|to the|to our|down to|reach');
        return {
            action: 'offer',
            intent: 'send',
            ...(to && !isTheActItself(to) ? { target: to } : {}),
            ...(matterAsked(input) ? { topic: matterAsked(input) as string } : {})
        };
    }

    // ── the offering, and the reading of a silence ──
    if (usedAsVerb(text, OFFERING_VERBS)
        && (OFFERING_NOUNS.test(text) || ASCENDED_NOUNS.test(text))) {
        const named = partyAfter(input, 'offering to|sacrifice to|incense to|rites to|up to|to');
        const to = isTheActItself(named) ? undefined : named;
        return { action: 'offer', intent: 'offering', ...(to ? { target: to } : {}) };
    }

    // ── the form, by name ──
    //
    // `requisition` needs no verb: nothing else in the setting uses the word,
    // and a player who has heard it has heard it from somebody describing
    // exactly this. Everything else needs the verb and the thing.
    //
    // `against` is deliberately not a party marker here. The form's own name
    // is "a Requisition Against Standing Stock", so reading a party out of it
    // resolved the sentence to an institution called "Standing Stock" - which
    // is the shape of every bug this parser has produced, a phrase matched in
    // the wrong role and answered confidently.
    if (REQUISITION_NAMED.test(text)
        || (usedAsVerb(text, `${PETITION_VERBS}|${PETITION_ASKING_VERBS}`)
            && (STANDING_STOCK_NOUNS.test(text) || IMMORTAL_ITEM_NAMED.test(text)))) {
        const named = partyAfter(
            input,
            `(?:${PETITION_ASKING_VERBS})|(?:with|to|at|of|before) the`
        );
        const of = isTheActItself(named) ? undefined : named;
        const matter = matterAsked(input);
        return {
            action: 'petition',
            intent: 'stock',
            ...(of ? { target: of } : {}),
            ...(matter ? { topic: matter } : {})
        };
    }

    // ── a claim of descent ──
    if (usedAsVerb(text, DESCENT_VERBS) && DESCENT_NOUNS.test(text)) {
        const from = partyAfter(input, 'descent from|descended from|descend from|line of|blood of|kinship (?:to|with)|from');
        return { action: 'petition', intent: 'descent', ...(from ? { target: from } : {}) };
    }

    // ── everything else that goes upward ──
    //
    // Vetoed by the joining vocabulary, which is the other half of the `apply`
    // lesson above: "I apply to the Pavilion", "I ask them to take me on" and
    // "I want to be admitted" are all sentences about membership, and every one
    // of them satisfies a petition rule completely.
    if ((usedAsVerb(text, PETITION_VERBS_ALONE)
        || (usedAsVerb(text, `${PETITION_VERBS}|${PETITION_ASKING_VERBS}`)
            && PETITION_NOUNS.test(text)))
        && !ASKING_TO_BE_TAKEN_IN.test(text)) {
        const of = partyAfter(
            input,
            `(?:${PETITION_VERBS})|(?:${PETITION_ASKING_VERBS})|to|at`
        );
        const matter = matterAsked(input);
        return {
            action: 'petition',
            intent: 'grant',
            ...(of ? { target: of } : {}),
            ...(matter ? { topic: matter } : {})
        };
    }

    return null;
}

/**
 * One of the four powers a seat holds, or null when the sentence is about
 * something else entirely.
 *
 * Every branch needs a verb IN VERB POSITION and the noun that says what it is
 * aimed at, for the reason {@link usedAsVerb} exists: "elder", "disciple",
 * "admission" and "teaches" are ordinary nouns in this setting and appear far
 * more often as the object of somebody else's sentence than as the subject of
 * this one. Two of the four also carry an explicit veto, because the sentence
 * that would misfire means the OPPOSITE of the power - asking to be taken on is
 * not recruiting, and practising what a house teaches is not decreeing it.
 */
function leadershipIntent(text: string, input: string): PlannedAction | null {
    // Dismissal. The noun is the gate: this power reaches elders and nothing
    // else, so "I remove the seal" and "I throw the disciple out" are
    // deliberately not this rather than being answered with the wrong price.
    if (usedAsVerb(text, SECT_EXPEL_VERBS)
        && SECT_ELDER_NOUN.test(text)
        && !/\b(?:expel|dismiss|remove|throw out|get rid of|turn out) me\b/.test(text)) {
        const who = namedAfter(input, SECT_EXPEL_VERBS);
        return { action: 'sect', intent: 'expel', ...(who ? { target: who } : {}) };
    }

    // Intake. Which rung is being taken in decides which power is being used
    // and what it costs: a disciple goes under your own line and is paid for
    // out of your own purse, an elder is bought in from outside and only the
    // seat may do it.
    if (usedAsVerb(text, SECT_RECRUIT_VERBS)
        && SECT_INTAKE_NOUNS.test(text)
        && !ASKING_TO_BE_TAKEN_IN.test(text)) {
        const kind = /\belders?\b/.test(text) && !/\bdisciples?\b/.test(text) ? 'elder' : 'disciple';
        const phrase = namedAfter(input, SECT_RECRUIT_VERBS);
        return {
            action: 'sect',
            intent: 'recruit',
            topic: kind,
            ...(phrase ? { target: phrase } : {})
        };
    }

    // The bar. A question about where it sits is the same action as a decree
    // that moves it - the tool prices the move when no rank is named - so both
    // phrasings come here rather than one of them falling through.
    if (SECT_ADMISSION_QUESTION.test(text)
        || (usedAsVerb(text, SECT_ADMISSION_VERBS) && SECT_ADMISSION_NOUNS.test(text))) {
        const phrase = namedAfter(input, SECT_ADMISSION_VERBS);
        return { action: 'sect', intent: 'admission', ...(phrase ? { target: phrase } : {}) };
    }

    // ── WHAT MY OWN HOUSE TEACHES, WHICH IS A QUESTION AND NOT A DECREE ──
    //
    // "what does my sect teach" is the single most useful fact about belonging
    // to one, and it answered with the stranger's line: "There is one name you
    // have for this: Azure Dew Sect. Knowing a name is not an introduction."
    // The player IS a member. The branch below owns REWRITING the shelf, which
    // is a patriarch's act, and nothing owned reading it - so the question fell
    // past this block entirely and was picked up by the find-me-a-sect rule.
    //
    // `handleCurriculum` with neither `teach` nor `retire` is already the free
    // read; it had no sentence pointing at it. Ahead of the decree branch and
    // gated on a question shape, so "I stop teaching the Cinder Form" is untouched.
    //
    // Vetoed by the learning verbs for the same reason the decree branch below
    // is: "I train in what the sect teaches" satisfies the noun and the
    // question word completely and is a sentence about doing the drill. A guard
    // in `misparse.test.ts` caught that within one run of adding this, which is
    // exactly what it is there for.
    if (SECT_CURRICULUM_NOUNS.test(text)
        && /\b(?:what|which|does|do|is|are|list|show|tell me)\b/.test(text)
        && !LEARNING_RATHER_THAN_DECREEING.test(text)
        && !usedAsVerb(text, 'change|set|rewrite|revise|decree|reform|add|retire|drop|stop teaching|start teaching')) {
        return { action: 'sect', intent: 'curriculum' };
    }

    // The shelf. Vetoed by the learning verbs: "I practise what the sect
    // teaches" satisfies this rule completely and is a sentence about doing the
    // drill, not about rewriting the library.
    if (usedAsVerb(text, SECT_CURRICULUM_VERBS)
        && SECT_CURRICULUM_NOUNS.test(text)
        && !LEARNING_RATHER_THAN_DECREEING.test(text)) {
        const side = matchIntent(text, SECT_CURRICULUM_SIDE);
        const phrase = namedAfter(input, SECT_CURRICULUM_VERBS);
        return {
            action: 'sect',
            intent: 'curriculum',
            ...(side ? { topic: side } : {}),
            ...(phrase ? { target: phrase } : {})
        };
    }

    return null;
}

/**
 * A quantity that cannot mean what it says.
 *
 * The sign was being SILENTLY DROPPED, which is the same class of defect as the
 * sentence that killed a run at the top of this file and is arguably worse,
 * because it produces a confident action rather than a wrong one. "I enter
 * seclusion for -5 years" was reaching the number scanner, which found `5`,
 * and running a real five-year closed-door seclusion: 750 elapsed days and a
 * breakthrough, off a duration the player wrote as negative. An explicit zero
 * had the mirror problem - `parseDuration` returned null, `seclude` applied its
 * 365-day default, and asking for nothing bought a year.
 *
 * Both resolve to `unclear` rather than to a clamped number. A sentence that
 * NAMED a quantity and named an impossible one is not a sentence the engine
 * understood, and this file's own rule is that anything it did not understand
 * must reach the cheapest action available. Guessing which positive number
 * somebody meant by "-5" is exactly the confidence that kills characters.
 *
 * Narrow on purpose. The minus has to open a token, so "2-3 days" is untouched;
 * "closed-door" and "twenty-five" are hyphens before letters and never match.
 */
export const MALFORMED_QUANTITY =
    /(?:^|[\s(([])-\s*\d|(?:^|\s)(?:0+|zero|none|no)\s+(?:year|month|week|day|season|decade|centur|ration|stone|disciple|time|of)/i;

// ═══════════════════════════════════════════════════════════════════════════
// ASKING IS NOT DOING
// ═══════════════════════════════════════════════════════════════════════════
//
// THE SINGLE WORST DEFECT FOUND IN A PLAYED RUN, and it is one defect wearing
// three faces. A question about an act was routed to the act's executor, so:
//
//   "can I leave my sect"        LEFT THE SECT, permanently, and reported that
//                                contribution does not travel. A player asking
//                                what their options were was punished for it.
//   "can I cultivate here"       spent a month.
//   "I want to join a sect"      joined one, with no introduction and no
//                                journey, one line after the game had said
//                                "knowing a name is not an introduction".
//
// The unifying rule this block exists to state:
//
//   > A QUESTION ABOUT AN ACTION IS NOT THE ACTION.
//
// Note what this is NOT. It is not a ban - `AGENTS.md` is explicit that the
// answer to "may I" is always "yes, and here is what it costs", and every verb
// below is still reachable by the sentence that commands it. "I leave my sect"
// still leaves. What changes is that the sentence with a question mark in its
// grammar reaches the READ instead of the write, and the read is where this
// engine is already at its best.
//
// It is also not a rule about desire. "I want to cultivate for ten years" is a
// command in this genre and `usedAsVerb` is right to take `want to` as a verb
// position. The reason "I want to learn X" used to be a defect was never the
// wanting - it was that learning X cost nothing. That half is fixed where it
// belongs, in `handleLearn` and at the stall, not here.

/**
 * Sentences that are asking about an act rather than performing one.
 *
 * Every branch requires the FIRST PERSON next to the modal, which is what keeps
 * it off the sentences that merely contain the words: "I can feel the qi
 * settling" is not a question, and neither is "the elder said I should leave".
 * The subject has to be the asker and the mood has to be interrogative.
 *
 * Deliberately does not include a bare question mark. Half the questions a
 * player types have no punctuation at all, and half the sentences that end in
 * one - "what now?" - are not about any particular act.
 */
export const ASKING_RATHER_THAN_DOING = new RegExp([
    // The modals. "can I", "could I", "may I", "should I", "would I", "might I".
    /\b(?:can|could|may|might|should|would|shall)\s+i\b/,
    /\bam\s+i\s+(?:able|allowed|permitted|supposed)\s+to\b/,
    /\bdo\s+i\s+(?:have\s+to|need\s+to|get\s+to)\b/,
    // The impersonal forms of the same question.
    /\bis\s+it\s+(?:possible|allowed|permitted|worth\s+it|wise|any\s+use|a\s+good\s+idea)\b/,
    /\b(?:is|would)\s+(?:it|there)\s+(?:be\s+)?(?:any\s+)?(?:way|point|use)\s+(?:to|in|for)\b/,
    /\bwould\s+it\s+be\s+possible\b/,
    // What follows from an act nobody has taken yet.
    /\bwhat\s+(?:would|will|does|do)\s+(?:it\s+)?(?:cost|take)\b/,
    /\bhow\s+much\s+(?:would|will|does)\s+it\s+cost\b/,
    /\bwhat\s+happens?\s+(?:if|when)\s+i\b/,
    /\bwhat\s+would\s+happen\s+(?:if|when)\s+i\b/,
    // The plainest form, and the one a player reaches for first.
    /\bwhat\s+(?:are|is)\s+the\s+(?:terms|price|cost)\s+(?:of|for)\b/,
    // ── AND THE METHOD QUESTIONS, WHICH ARE NOT INTERROGATIVE AT ALL ─────
    //
    // Found by continued play and it is the worse half, because a method
    // question reads like a plan. "how do I treat my injuries" - an
    // unambiguous question about HOW - bought four courses of care, spent
    // twenty spirit stones and lay still for thirty days. The player asked
    // what their options were and was charged for them.
    //
    // So the test is not the word at the front of the sentence. It is whether
    // the player has DECIDED. "How do I X", "what would it take to X" and
    // "where can I X" are all somebody working out what X involves, and none
    // of them is somebody doing it.
    /\bhow\s+(?:do|would|can|could|should|might)\s+i\b/,
    /\bhow\s+(?:does|do)\s+(?:one|somebody|someone|a\s+person)\b/,
    /\bwhat\s+would\s+it\s+take\s+to\b/,
    /\bwhere\s+(?:can|could|do|would|should)\s+i\b/,
    /\bwhat\s+(?:are|is)\s+my\s+options\b/
].map(r => r.source).join('|'), 'i');

/**
 * The free read that answers a question about each committing verb.
 *
 * A table rather than a single downgrade, because the useful answer differs:
 * somebody asking whether they could leave a house wants their own standing in
 * it, and somebody asking whether they could join one wants the listing that
 * already says knowing a name is not an introduction.
 *
 * Anything not named here falls to `assess`, which is this parser's existing
 * "what happens if I try" verb, is in `READ_ONLY_ACTIONS`, and cannot spend a
 * day, a stone or a life. That default is what makes the guard safe for verbs
 * added after it: a new committing action is answered inertly by construction
 * rather than by somebody remembering to come back here.
 */
export function theReadThatAnswersIt(plan: PlannedAction): PlannedAction {
    // A read is already the answer to a question about it.
    //
    // The list used to carry an entry that was not a read. `interact` sat on it
    // while seven of its ten intents spent days and stones, so this guard - the
    // one written to stop a question performing an act - was handing "can I
    // bribe the elder" straight back to the executor, and doing it BY DESIGN,
    // because trusting this list is how the post-pass stays complete. The
    // reclassification is at `READ_ONLY_ACTIONS` and `TIME_CONSUMING_ACTIONS`,
    // and this line asks {@link costsTheAskerNothing} rather than the list,
    // because for `interact` the two are different questions.
    if (costsTheAskerNothing(plan)) return plan;

    switch (plan.action) {
        case 'interact':
            /**
             * A READ OF THE PERSON, which is what the question was about.
             *
             * Only for the intents that press somebody. "Can I talk to the
             * gate steward" is a question about an act that settles nothing and
             * costs nothing, and the honest answer to it is the approach
             * itself - narrowing to {@link PRESSING_SOMEBODY} is the rule
             * `AGENTS.md` states as fixing the gap that was demonstrated rather
             * than the one you imagined. Those three never reach this case at
             * all: {@link costsTheAskerNothing} returns them above.
             *
             * `investigate` and not `assess`, which is this table's default for
             * everything it does not name and would have been wrong here.
             * Checked rather than assumed: `GameService.assess` sends every
             * subject that is not the asker to `handleAssess` with
             * `against: 'place'`, so a person's NAME is looked up as GROUND. It
             * would have answered a question about somebody with the weather
             * where they are standing, which is a good answer to a question
             * nobody asked - the deflection failure this codebase keeps
             * finding, and worse than a refusal because it reads like an
             * answer. `investigate` reads the person: the
             * rung they stand at, the years they carry, the house they answer
             * to, and then "that is what the record holds. What it means is a
             * separate question" - which is exactly the shape of an answer
             * somebody weighing a bribe is owed.
             *
             * And not the priced weighing `request` gives its own questions,
             * though that was the first candidate and it is the better read.
             * `GameService.request` re-reads the sentence to find what was
             * asked FOR; a bare "can I bribe X" names no object, falls to
             * `a_thing` with nothing in it, and is routed by `request`'s own
             * fallback into `interact` with intent `negotiate` - which is on
             * the pressing list. It would have re-entered the same spend
             * through a different door, and the purse would have come out the
             * same. Verified by reading that path rather than by assuming it.
             *
             * The target rides along unparsed. It is whatever `extractSubject`
             * took off the sentence - "Bai Jinglu with 10 spirit stones" for
             * the phrasing that started this - and the entity resolver takes
             * it, so nothing here has to understand the tail.
             *
             * AND A QUESTION THAT NAMED A SUBJECT KEEPS IT. "Could I question
             * Bai Jinglu about the ruins" carries a topic, and a topic put to a
             * person is already the free read - `GameService.interact` hands it
             * to `askAround` before the pressure model is reached. Sending that
             * one to `investigate` would have cost nothing and answered a
             * narrower question than the one asked, which is the deflection
             * again in the other direction. So the topic keeps its own read and
             * only the INTENT is dropped, to `talk`, which is the same free
             * branch it was already taking.
             *
             * Dropped to `talk` rather than left alone, because a topic does
             * NOT by itself guarantee the cheap path: `askAround` needs the
             * person to be standing here, and somebody known-of but elsewhere
             * falls past it into the attempt. `talk` is not on the pressing
             * list, so that door is shut whichever way the person resolves.
             */
            if (!PRESSING_SOMEBODY.has(plan.intent ?? '')) return plan;
            return plan.topic
                ? {
                    action: 'interact',
                    intent: 'talk',
                    ...(plan.target ? { target: plan.target } : {}),
                    topic: plan.topic
                }
                : { action: 'investigate', ...(plan.target ? { target: plan.target } : {}) };

        case 'sect':
            // Asking to get in is the listing; asking about the seat you hold
            // is your standing in it. Both are free and both already say the
            // right thing - the listing's own line is the one the played run
            // quoted approvingly one input before the parser broke it.
            // A question about sitting in somewhere keeps the house it named
            // and loses only the commitment. The terms read is free and says
            // everything the acceptance would - what is opened, what is kept
            // back, and the five things a guest place is not - so a player who
            // asked "could I study at the Frostmirror Court" is answered rather
            // than enrolled.
            if (plan.intent === 'guest') {
                return {
                    action: 'sect',
                    intent: 'guest',
                    ...(plan.target ? { target: plan.target } : {}),
                    ...(plan.topic === 'depart' ? { topic: 'depart' } : {})
                };
            }
            return plan.intent === undefined || plan.intent === 'join'
                ? { action: 'sect' }
                : plan.intent === 'duty' || plan.intent === 'siphon'
                    // Both of these have a READ mode reached by naming nothing
                    // further: the wall, and the position of the reserves.
                    ? { action: 'sect', intent: plan.intent }
                    // The standing read carries the two numbers a departure
                    // forfeits - the seat and the contribution - so it is the
                    // right answer to "could I leave". The topic rides along so
                    // it can also say what walking out would take, which is the
                    // half a bare standing read does not cover.
                    : plan.intent === 'leave'
                        ? { action: 'sect', intent: 'standing', topic: 'leaving' }
                        : { action: 'sect', intent: 'standing' };

        case 'learn_technique':
            // What the book would take, which is a read of the same facts the
            // refusal is built from. See `GameService.whatItWouldTake`.
            return { action: 'list_techniques', ...(plan.target ? { target: plan.target } : {}) };

        case 'train_technique':
            return { action: 'list_techniques', ...(plan.target ? { target: plan.target } : {}) };

        case 'buy':
        case 'sell':
            return { action: 'market', ...(plan.target ? { target: plan.target } : {}) };

        case 'provision':
        case 'eat':
            return { action: 'market', target: 'food' };

        case 'treat':
            return { action: 'market', target: 'medicine' };

        case 'consume_pill':
            return { action: 'inventory' };

        case 'refine':
            // The cauldron's own listing, which is what `refine` does when it
            // is handed no formula: forty-two recipes filtered by rank, with
            // what each wants and what the pouch is short of. "What can I
            // refine" was already answered that way and must keep being.
            return { action: 'refine' };

        case 'move':
            return { action: 'destinations' };

        case 'breakthrough':
        case 'cultivate':
        case 'seclude':
            // Where they stand and what is stopping them, which is the honest
            // answer to "can I" asked of the ladder.
            return { action: 'ceiling' };

        case 'site':
            // Reading it from outside is the free step of the four, and it is
            // exactly what somebody weighing an attempt is asking for.
            return { action: 'site', intent: 'outside', ...(plan.target ? { target: plan.target } : {}) };

        case 'legacy':
            return { action: 'legacy', intent: 'counters' };

        case 'request':
            /**
             * What it would take to ask them: every fact the attempt is built
             * from, and none of the days it spends.
             *
             * The same code path as the request itself - `GameService.request`
             * with `weigh` runs everything up to the roll and stops - so the
             * read cannot drift away from the thing it describes, which is the
             * failure mode a separately-written "what would happen if" always
             * walks into.
             */
            return {
                action: 'request',
                intent: 'weigh',
                ...(plan.target ? { target: plan.target } : {}),
                ...(plan.topic ? { topic: plan.topic } : {})
            };

        case 'posture':
        case 'seal':
        case 'offer':
            // Each of these has a read as its DEFAULT intent, by the rule
            // stated at INTENT_ACTIONS. Dropping the intent reaches it.
            // `petition` is the fourth of that family and is absent because it
            // is already in READ_ONLY_ACTIONS and returned above.
            return { action: plan.action, ...(plan.target ? { target: plan.target } : {}) };

        default:
            return { action: 'assess', ...(plan.target ? { target: plan.target } : {}) };
    }
}

export function parseIntent(input: string): PlannedAction {
    const plan = readTheSentence(input);
    if (plan.action !== FALLBACK_ACTION) return plan;

    // ── AND ONLY NOW, THE SPELLING ───────────────────────────────────────
    //
    // A second attempt, on a sentence whose misspelt words have been put
    // back. It runs HERE - after a full pass has reached nothing - and
    // nowhere else, which is the whole of what makes it safe: a sentence
    // that already found a verb keeps that verb, so no repair can move a
    // parse that works, and `misparse.test.ts` and the verb-swallowing guard
    // cannot be shifted by anything in the spelling module.
    //
    // The cost of not doing it, measured over the worked phrasings with one
    // typo each: 107 of 224 reached nothing at all. Half the sentences a
    // player fat-fingers cost them a turn, in a build whose whole claim is
    // that it is playable with no model at all.
    const respelt = respellForTheVerbTable(input, spellingVocabulary());
    if (respelt.text === input) return plan;

    const second = readTheSentence(respelt.text);
    // Still nothing is still nothing: the ORIGINAL refusal is returned, not
    // the respelt one, so the sentence the player is answered about is the
    // sentence they typed.
    if (second.action === FALLBACK_ACTION) return plan;

    // The respelling chose the VERB, and that is all it is allowed to choose.
    // Every string carrying on to the engine goes back into the player's own
    // spelling first, because the repair cannot tell a verb word from a name
    // and is only ever looking for verb words: `stele` is one edit from
    // `stole`, which IS in the vocabulary, and a target of "stole" sends the
    // engine looking for an object that does not exist. That is a wrong
    // guess, where avoiding one is the entire point of this path.
    if (second.target !== undefined) {
        second.target = inThePlayersOwnSpelling(second.target, respelt.restored);
    }
    if (second.topic !== undefined) {
        second.topic = inThePlayersOwnSpelling(second.topic, respelt.restored);
    }
    return second;
}

/** One full pass of the table, mood included. Run twice: as typed, then respelt. */
function readTheSentence(input: string): PlannedAction {
    const plan = planIntent(input);
    // The mood is decided last, on the whole sentence, rather than by a hundred
    // vetoes scattered through the table below. Doing it as a post-pass is what
    // makes it complete: a verb added tomorrow is covered without its author
    // having to know this rule exists.
    return ASKING_RATHER_THAN_DOING.test(input.toLowerCase())
        ? theReadThatAnswersIt(plan)
        : plan;
}

let vocabulary: ReadonlySet<string> | null = null;

/**
 * The parser's own words, taken off the patterns above on first use.
 *
 * Lazy rather than computed at module load, because the self-import it reads
 * is only fully populated once this module has finished evaluating.
 */
function spellingVocabulary(): ReadonlySet<string> {
    if (vocabulary === null) {
        vocabulary = harvestVocabulary(thePatternsInThisFile as unknown as Record<string, unknown>);
    }
    return vocabulary;
}

function planIntent(input: string): PlannedAction {
    const text = input.toLowerCase().trim();

    // Before everything, because every branch below that reads a number reads
    // it through a scanner that cannot see a sign.
    if (MALFORMED_QUANTITY.test(text)) {
        return { action: FALLBACK_ACTION };
    }

    // -- attacking somebody, which had no route at all --
    //
    // The engine has had combat the whole time: `resolveExchange`,
    // `resolveConfrontation`, `battlesSurvived` on the row. The parser had no
    // way to reach any of it, so "I attack the nearest cultivator" fell
    // through the whole table until the cultivation branch caught the noun.
    // First, because every sentence about a fight is full of other verbs' nouns.
    if (!AIMED_AT_THE_LADDER.test(text)
        && (usedAsVerb(text, 'attack|attacks|strike|strikes|hit|hits|fight|fights|kill|kills|'
            + 'cut down|draw on|swing at|go for|set (?:on|upon)|jump|ambush|assault|'
            // The words a player uses when the killing is the point rather than
            // the fight. Found by a standing sweep: "I murder a disciple of the
            // Nine Abyss Flame Sect" and "I assassinate the Third Lord" reached
            // NOTHING, while "I attack the Nine Abyss Flame Sect" was refused
            // properly at every position. A verb that answers the polite
            // phrasing and not the honest one teaches a player that the game is
            // small, when what is actually true is that the target is enormous.
            + 'murder|murders|murdering|assassinate|assassinates|assassinating|slay|slays|'
            + 'do away with|make an end of|'
            + 'take (?:him|her|them) on|put (?:him|her|them) down|finish (?:him|her|them)')
            || /\bstrike (?:at )?(?:him|her|them|the [a-z])/.test(text))) {
        return {
            action: 'attack',
            target: extractSubject(input, ATTACK_SUBJECT_VERBS),
            intent: /\b(?:kill|murder|assassinate|slay|finish|cut down|put (?:him|her|them) down)\b/.test(text)
                ? 'kill'
                : /\b(?:subdue|pin|restrain|capture|take alive)\b/.test(text)
                    ? 'subdue'
                    : /\b(?:humiliate|shame|embarrass|make an example)\b/.test(text)
                        ? 'humiliate'
                        : 'drive_off'
        };
    }

    // ── A FIGHT SOMEBODY WOULD CHOOSE TO HAVE ────────────────────────────
    //
    // Every route into combat was either suicide or refused. Attacking resolves
    // only to whoever is NEAREST, who is usually far above; the categorical-gap
    // rule then correctly declines - "3 major realms is not a fight" - so a
    // player never got to fight anybody. Meanwhile a duel between equals is one
    // of the commonest things two cultivators do in this setting, it is how a
    // disciple measures themselves, and it is the only safe way to meet a
    // system that otherwise only appears when something much stronger has
    // decided to kill you.
    //
    // `subdue` rather than a new goal: an agreed bout ends when one party
    // yields, which is exactly what `subdue` already means to the resolver, and
    // it needs no change to the combat tool's closed set.
    //
    // The PEER phrase is carried through as the target so the handler can pick
    // somebody the gap rule will actually permit, rather than the nearest body.
    //
    // ── AND `terms`, WHICH THE WORD WAS BEING THROWN AWAY WITHOUT ────────
    //
    // "I spar with him" and "I pin him" both came out of here as `subdue` and
    // nothing downstream could tell them apart ever again, so a bout that
    // killed somebody was indistinguishable from a fight that did - which is
    // the exact softening AGENTS.md forbids, arrived at by omission rather than
    // by decision. `terms` is a CLOSED value set here, beside the verb, for the
    // same reason `leverage` is: `game.ts` passes it through and never
    // translates a word into a mechanic, and no line of engine code reads it to
    // pick an OUTCOME. It reaches the consequence layer alone, where the whole
    // of the difference between a spar and a duel lives.
    if (/\b(?:duel|spar|sparring|challenge)\b/.test(text)
        && /\b(?:with|against|to a duel|him|her|them|someone|somebody|anyone|anybody|a |the )\b/.test(text)) {
        // "I challenge him TO A DUEL" puts the challenge word after the person,
        // so the extracted subject came out as "him to a duel" and resolved to
        // nobody. The trailing form of the ask is not part of who was asked.
        const challenged = (extractSubject(
            input,
            /duel|spar with|spar against|sparring with|challenge/
        ) ?? '').replace(/\s+to\s+(?:a|an)\s+(?:duel|spar|bout|match|contest).*$/i, '').trim();
        return {
            action: 'attack',
            ...(challenged.length >= 2 ? { target: challenged } : {}),
            intent: 'subdue',
            terms: 'agreed'
        };
    }

    // Sect promotion and stipend, before anything that could read them as
    // asking a person a question or as going out to collect something.
    {
        const unambiguous = SECT_INTENT_UNAMBIGUOUS.find(([, pattern]) => pattern.test(text));
        if (unambiguous) return { action: 'sect', intent: unambiguous[0] };
    }

    // Sending the rung below, before `work` and `gather` - both of which used to
    // catch these sentences and answer them by spending the PLAYER's days. An
    // order is the one action in the game whose whole point is that it does not.
    if (usedAsVerb(text, SECT_ORDER_VERBS)
        && SECT_SUBORDINATE_NOUNS.test(text)
        && !SENDING_A_MESSAGE.test(text)) {
        const errand = matchIntent(text, SECT_ERRAND_PATTERNS) ?? DEFAULT_ERRAND;
        const days = parseDuration(text);
        return {
            action: 'sect',
            intent: 'order',
            topic: errand,
            ...(days ? { days } : {})
        };
    }

    // The four powers above `order`, in the same slot and for the same reason.
    // Ahead of `work` and `gather` because a sentence about the house's intake
    // is full of their vocabulary ("I take on new disciples to work the
    // fields"); ahead of `train_technique` because a sentence about what the
    // house teaches is not a sentence about practising it; and ahead of the
    // INTERACT table, whose `recruit` label matches the bare words "take on",
    // and of the sect LISTING, which fires on the noun plus any question word.
    {
        const led = leadershipIntent(text, input);
        if (led) return led;
    }

    // Inheritance grounds, ahead of everything that owns one of their verbs.
    //
    // This block has to sit here rather than lower down because four separate
    // branches below would take these sentences first and answer them with
    // something adjacent, which is worse than answering nothing. "I look for
    // the audit bench" was matched by the bare `look` rule and answered with
    // the weather; "I study the door" went to `investigate` and examined a
    // door as an object with no record behind it; "I go to the eighth stone"
    // went to `move` and sent the cultivator to a place called "the eighth
    // stone", which the engine stored, because a location is free text; and
    // "I size up the trial" went to `assess`, which prices an opponent.
    //
    // It sits BELOW the attack and sect blocks on purpose. A fight and an
    // errand are still a fight and an errand when they happen at a grave.
    {
        const step = siteStep(text, input);
        if (step) return step;
    }

    // ── what somebody leaves for whoever comes after ──
    //
    // Below the sect block and below the inheritance grounds, and both of
    // those orderings are load-bearing. "I leave the sect" is resigning and
    // "I dig up the grave of Shen Guyi" is grave-robbing, and each of them
    // contains a verb this block also matches on. Above `institutionalAct`,
    // because lodging goods with a house is not a petition, a posture, a seal
    // or an offering, and that block matches any sentence naming a faction.
    {
        const aside = legacyStep(text, usedAsVerb, parseDuration(text) ?? undefined);
        if (aside) return aside;
    }

    // ── institutions acting on each other, and on the dead ──
    //
    // High, and it has to be. Five of the twelve sentences that produced this
    // block did not fail: they were EATEN, four of them by the asking branch
    // and the INTERACT table two hundred lines below, and one by `recall`.
    // "I ask the Deep Survey for one of its pills" reached a bystander who
    // declined to answer; "I offer an alliance to the Frostmirror Court"
    // walked the player to the Court and described the building. Both look
    // like answers, and a player cannot tell an answer from a gap.
    //
    // It sits BELOW attack, the sect powers and the inheritance grounds on
    // purpose, for the reason the site block gives: a fight is still a fight
    // and an errand is still an errand when the sentence also mentions a
    // house. It sits ABOVE the asking branch because asking an INSTITUTION for
    // something it holds is not the same act as asking a person a question,
    // and the two have different answers from different tables.
    {
        const between = institutionalAct(text, input);
        if (between) return between;
    }

    // ── ASKING A PERSON FOR SOMETHING ────────────────────────────────────
    //
    // Above the three stuck-player reads, and that placement IS the fix. The
    // roster question owns `teach me`, correctly - "who can teach me" is one of
    // the three questions this game has to answer - and it was tested before
    // anything looked at whether a person had been named. So "I ask Jiang Anyi
    // to teach me", typed at somebody standing in the same square, was answered
    // with the register of everybody standing above the player. Four phrasings
    // of the request, four different lookups, and not one of them a person.
    //
    // NOTHING BELOW IS WIDENED, which is the whole point. `AGENTS.md` records
    // what happened the last time a pattern here was widened to catch a missing
    // sentence: it stole sentences from `investigate` and from ordinary place
    // resolution, and two tests caught it. `requestPutToSomebody` takes only
    // sentences that name somebody AND say what is wanted of them, and returns
    // null for everything else - so "who can teach me", "teach me", "I ask her
    // about the ruins" and "I bribe the gate steward" all reach exactly what
    // they reached before.
    //
    // Below the institutional block and the attack block for the reason those
    // give: a sentence that files a petition or starts a fight is still doing
    // that when somebody could also read it as asking for something.
    {
        const asked = requestPutToSomebody(input);
        if (asked) {
            const leverage = LEVERAGE_BEHIND_INTENT[
                matchIntent(text, INTERACT_INTENT_PATTERNS) ?? ''
            ];
            return {
                action: 'request',
                target: asked.person,
                intent: asked.kind,
                ...(asked.object ? { topic: asked.object } : {}),
                ...(leverage ? { leverage } : {})
            };
        }
    }

    // ── the three questions a stuck player asks ──
    //
    // High in the table, and every one of them is free, which is what makes
    // that safe. They sit ABOVE `assess`, `status`, `look`, `move` and
    // `breakthrough` because those five are precisely what was eating these
    // sentences: "am I stuck" was answered by a senior's opinion of the
    // player, "who could guide my cultivation" by the character sheet, "I look
    // for a master" by the room, and "I want to travel somewhere else" by the
    // travel verb going looking for a place called "somewhere else". Each of
    // those is a good answer to a question nobody asked.
    //
    // They sit BELOW the institutional block and the attack block, on the same
    // reasoning those give: a sentence that files a petition or starts a fight
    // is still doing that when it also contains the word "teacher".
    if (CEILING_QUESTION.test(text)) {
        return { action: 'ceiling' };
    }

    if (TEACHER_QUESTION.test(text)) {
        return { action: 'teacher' };
    }

    if (DESTINATIONS_QUESTION.test(text)) {
        return { action: 'destinations' };
    }

    // ── what am I carrying in my head ──
    //
    // Ahead of the sect listing, which fires on the noun plus any question
    // word and would take "what do I know about the sect" and answer it with a
    // register of who would enrol the player. Ahead of `status`, whose sheet
    // read is a different question. Ahead of the place-history block, which
    // owns "what is said about this" - somebody else's talk about the ground,
    // rather than what this cultivator is holding.
    //
    // Behind nothing that costs anything, because it costs nothing.
    // The read only. A sentence that is trying to PUT the dao somewhere is not
    // a question about it, and answering it with the panel is the "looks like
    // an answer" failure this whole block exists to stop. See
    // {@link PUTTING_IT_SOMEWHERE_ELSE}.
    if (RECALL_DAO.test(text) && !PUTTING_IT_SOMEWHERE_ELSE.test(text)) {
        return { action: 'recall', intent: 'dao' };
    }
    // News and rumour, which is the world's talk rather than the holder's own
    // head. Ahead of the `recall` patterns below and behind `RECALL_DAO`,
    // because "what have I heard lately" is in both bags and the one that
    // teaches something is the one worth reaching.
    if ((NEWS_AND_RUMOUR.test(text) || ASKING_AFTER_THE_WORLD.test(text))
        && !ABOUT_THE_GROUND_HERE.test(text)) {
        return { action: 'news' };
    }
    // ── whose art that was ──
    //
    // Ahead of `recall`, and it has to be: "do I know this style" sits one word
    // from `do i know (of|about)`, and "have I seen this before" is a hair from
    // "have i heard of". Both of those recall patterns would answer with the
    // knowledge table, which is a true statement about what the holder is
    // carrying and not an answer to what they just watched.
    //
    // Narrow enough not to steal from it: every branch requires an art noun or
    // a possessive over one, so "what do I know of the Azure Cloud" is
    // untouched and still reaches `recall`.
    if (WHOSE_ART_IS_THAT.test(text)
        || IS_THIS_THEIR_ART.test(text)
        || (DO_I_RECOGNISE_IT.test(text) && new RegExp(AN_ART_NOUN, 'i').test(text))) {
        const owner = houseClaimedIn(input);
        const art = artNamedIn(input);
        return {
            action: 'recognise',
            ...(owner && owner.length >= 3 ? { target: owner } : {}),
            ...(art ? { topic: art } : {})
        };
    }

    if (RECALL_PATTERNS.some(pattern => pattern.test(text))) {
        const named = namedAfter(input, RECALL_SUBJECT);
        return { action: 'recall', intent: 'knowledge', ...(named ? { target: named } : {}) };
    }
    if (RECALL_EVERYTHING.test(text)) {
        return { action: 'recall', intent: 'knowledge' };
    }

    // ── getting a wound seen to ──
    //
    // Ahead of everything that owns one of these verbs, and it has to be:
    // "look for a physician" was taken by the bare `look` rule, "find a
    // healer" sits one word from the employment branch, and "see to my
    // injuries" is a hair from `investigate`. Ahead of the ASKING branch too,
    // which is the one deliberate cost: "I ask around for a physician" is
    // still a question put to people, and it stays one, because none of the
    // asking verbs are in `SEEKING_CARE_VERBS`.
    if (HAVING_IT_SEEN_TO.test(text)
        || (usedAsVerb(text, TREATMENT_VERBS)
            && (INJURY_NOUNS.test(text) || /\b(?:me|myself)\b/.test(text)))
        || (HEALER_NOUNS.test(text) && usedAsVerb(text, SEEKING_CARE_VERBS))
        || (TREATMENT_NOUNS.test(text)
            && usedAsVerb(text, `${SEEKING_CARE_VERBS}|${TREATMENT_VERBS}`))) {
        return { action: 'treat' };
    }

    // ── striking the barrier, and not everything with the word in it ──
    //
    // The bare word used to be enough, anywhere in the sentence, and this
    // branch sits above `refine`, `buy` and `gather` - so EVERY sentence about
    // the thing you take BEFORE a breakthrough was answered by attempting one
    // without it:
    //
    //   I refine a breakthrough pill  -> "The barrier does not move. Not enough
    //   I buy a breakthrough pill        has accumulated: 0 of 100 qi-units."
    //   I look for a pill that helps breakthrough
    //
    // That is the worst shape a misparse can have here. `MAX_PILL_BONUS` is
    // 0.35, the single largest modifier in the game and the intended mitigation
    // for the rungs that kill, and the three sentences that reach it were all
    // answered by walking into the barrier bare-handed. Two deaths at the 12->13
    // Foundation boundary, both funded and healthy, were spent finding out.
    //
    // `usedAsVerb` is the fix and it is exactly what it was written for: in
    // "a breakthrough pill" the word sits behind an article, where only a noun
    // can be, and in "I break through" it follows a subject. The phrasings that
    // are unambiguous whatever position they are in are listed separately,
    // because "attempt a breakthrough" is a noun and is still the attempt.
    if (usedAsVerb(text, 'break\\s*through|breakthrough|breaks through|breaking through')
        || /\b(?:strike (?:at )?the barrier|push (?:past|through|against) the (?:barrier|bottleneck)|force (?:the |my way through the )?(?:barrier|bottleneck)|assault the barrier|attempt the (?:next )?rank|advance a rank|(?:try|attempt|make|go for) (?:a |the |my |another )?break\s*through|(?:try|attempt) (?:to |for )?(?:the )?(?:next realm|advancement))\b/.test(text)) {
        return { action: 'breakthrough' };
    }

    // Closed-door seclusion before ordinary cultivation: it is the more
    // specific reading of the same sentence, and it is a different bargain -
    // sealed against encounters, and against opportunities with them.
    if (/\b(?:closed[- ]?door|seal (?:myself|the (?:cave|door))|sealed seclusion|enter seclusion|go into seclusion|shut myself)\b/.test(text)) {
        return { action: 'seclude', days: parseDuration(text) ?? DEFAULT_SECLUSION_DAYS };
    }

    // ── the house's own board, ahead of the mortal one ──
    //
    // `sect_members.contribution` had no earner, and this is the sentence that
    // earns it. It must beat `work` (which answers with the village job board,
    // paid in cash, moving no standing) and `look` (which answers with the
    // weather). Requires a board noun or an institution beside a work noun, so
    // "I take whatever work the village will give me" is untouched.
    // A title the board printed, taken by name. See `dutyNamed`: a commission
    // is called "What a Poor District Has Instead of Monsters" and contains no
    // board noun, so typing back exactly what the game had just said reached
    // nothing and the whole contribution loop had no accepting sentence.
    const namedDuty = usedAsVerb(text, DUTY_TAKING_VERBS) ? dutyNamed(text) : undefined;
    if (namedDuty) {
        return { action: 'sect', intent: 'duty', target: namedDuty };
    }

    // ── HOW MUCH CONTRIBUTION DO I HAVE ──────────────────────────────────
    //
    // `contribution` is a board noun in SECT_DUTY_PATTERN, on the sound
    // reasoning that exactly one thing in this game pays in it. That made a
    // question about the BALANCE return the list of jobs - not a refusal, a
    // confident wrong answer, which is the harder kind to notice because the
    // player reads it and moves on. Contribution gates promotion and the
    // promotion refusal quotes it correctly, so the number exists and was
    // reachable from everywhere except the sentence that asks for it.
    if (/\b(?:contribution|contributions)\b/.test(text)
        && /\b(?:how much|how many|what(?:'s| is)?|do i have|have i|my|balance|standing)\b/.test(text)
        && !usedAsVerb(text, DUTY_TAKING_VERBS)) {
        return { action: 'sect', intent: 'standing' };
    }

    // ── WHAT IS NAILED TO THE WALL ───────────────────────────────────────
    //
    // Ahead of the duty board because the two are adjacent and the duty board
    // is a MEMBER'S surface: somebody with no house asking what is posted in a
    // market town wants the recruiting bills, and answering them with a list of
    // sect chores they cannot take is the confident wrong answer rather than a
    // refusal. `SECT_DUTY_PATTERN` still owns every phrasing that names a
    // board, a duty, a commission or contribution, so the sentences it was
    // written for are untouched - this only catches the ones it never had.
    if (RECRUITING_BILL_PATTERN.test(text)) {
        return { action: 'look', intent: 'bills' };
    }

    if (SECT_DUTY_PATTERN.test(text)
        || (usedAsVerb(text, DUTY_TAKING_VERBS) && DUTY_NOUNS.test(text))) {
        // A SUBJECT ONLY WHEN SOMETHING IS BEING TAKEN. Reading the wall and
        // signing for a line off it are the same sentence with one verb
        // changed, and the difference is an oath row with a due date on it. So
        // the target is attached only where a taking verb is actually in verb
        // position, and "I look at the sect mission board" carries none - which
        // routes it to the read, which is the cheap branch. Same rule `site`,
        // `petition`, `posture`, `seal` and `offer` all follow.
        const taking = usedAsVerb(text, DUTY_TAKING_VERBS);
        return {
            action: 'sect',
            intent: 'duty',
            ...(taking ? { target: extractSubject(input, DUTY_SUBJECT_VERBS) } : {})
        };
    }

    // ── how does this book go further ──
    //
    // ONE COMMAND, THREE COSTS. Ahead of the learning branch, because "how do I
    // get further with this manual" is not a request to learn a new one, and
    // ahead of the mortal-economy work rule, which takes "work out".
    if (ACQUISITION_PATTERN.test(text)) {
        return {
            action: 'acquisition',
            target: extractSubject(input, ACQUISITION_SUBJECT_VERBS)
        };
    }

    // ── the mortal economy, before anything that spends time ──
    //
    // Deliberately ahead of `eat`, `trade` and `cultivate`. A player with no
    // stones who types "take work for a season" is asking for the only action
    // that saves them, and every slower reading of that sentence is fatal.
    if (/\b(?:take (?:any |whatever |some )?work|(?:look|looking|hunt|hunting|cast about|casting about|ask|asking) (?:around )?for (?:any |some |paid )?(?:work|a job|jobs|employment|hire)|find (?:me |myself |a |some )?(?:work|job|employment)|hire (?:myself|on|out)|take a job|get a job|odd jobs?|day labour|day labor|earn (?:some |a few |my )?(?:stones?|keep|coin|money|living|wages?)|work (?:for|in|at|the|a|as)|labour|labor|make myself useful|work off)\b/.test(text)
        // `work on` is practice, not employment. Without this guard
        // "I work on my technique" was answered with a season of hauling.
        || /^\s*(?:i\s+)?works?\b(?!\s+on\b)/.test(text)) {
        return {
            action: 'work',
            days: parseDuration(text) ?? DEFAULT_WORK_DAYS,
            target: extractSubject(input, /work as|hire (?:myself )?(?:out )?as|take work as|job as/)
        };
    }

    // -- asking somebody, which is not the same as consulting a register --
    //
    // Requires a person: `someone`, `the old woman`, `around`, `the locals`.
    // Without one the sentence is a query about the world rather than a
    // question put to anybody, and the surfaces below answer it.
    //
    // And "I ask for time on the vein" is not a question put to anybody: it is
    // the house's own allocation, which has its own read below. `parseAsk`
    // takes "for time on the vein" as a person, fails to find one, and puts the
    // words to whoever is nearest - the same failure "tell me about myself"
    // already has a veto for.
    const asked = /\b(?:ask|asking|asks|enquire|inquire|put it to|question|press)\b/.test(text)
        && !GROUND_TIME_QUESTION.test(text)
        ? parseAsk(input)
        : null;
    if (asked && !/\bjoin(?:ing)?\b/.test(text)) {
        return {
            action: 'interact',
            intent: matchIntent(text, INTERACT_INTENT_PATTERNS) ?? 'talk',
            ...(asked.person ? { target: asked.person } : {}),
            ...(asked.topic ? { topic: asked.topic } : {})
        };
    }

    // ── what am I carrying ──
    //
    // Ahead of everything that could read "check" or "look" as a verb aimed at
    // the room. `alchemy_manage.inventory` answers it and nothing reached it.
    if (/\b(?:my (?:inventory|pouch|bag|pack|belongings|possessions)|what am i carrying|what do i (?:have|carry)|what(?:'s| is) in my (?:pouch|bag|pack)|check (?:my )?(?:inventory|pouch|bag|pack)|(?:show|list|open) (?:me )?(?:my )?(?:inventory|pouch|bag|pack)|turn out (?:my )?(?:pouch|pockets))\b/.test(text)) {
        // "take stock" is deliberately absent. `misparse.test.ts` carries
        // "I take stock of a life that has gone nowhere in forty years",
        // which is a man looking at his own life and not at his pockets.
        return { action: 'inventory' };
    }

    // ── the arts, listed, before the art being learned ──
    //
    // The question form must win: "what can I learn" is a read of a catalog
    // and "I learn the Azure Ripple Art" is an act that can tear meridians.
    // Getting those the wrong way round costs a run.
    if (/\b(?:what|which)\b[^.!?]*\b(?:arts?|techniques?|manuals?|methods?)\b[^.!?]*\b(?:can i (?:learn|study|take up|pick up)|could i (?:learn|study)|are (?:there|available|open to me)|do i have access to|am i able to learn)\b/.test(text)
        || /\b(?:what (?:arts?|techniques?) can i learn|list (?:the )?(?:available )?(?:arts?|techniques?)|show (?:me )?(?:the )?(?:available )?(?:arts?|techniques?)|what (?:arts?|techniques?) are (?:available|going|about))\b/.test(text)
        // ── THE PHRASING THE GAME ITSELF PROMISES ────────────────────────
        //
        // Three refusals in this codebase tell the player, in these words, to
        // ask "what there is to learn" - and the sentence resolved to nothing.
        // The game was instructing players into a dead end, which is the
        // sharpest possible version of the deflection problem, because the
        // player is doing exactly what they were told.
        //
        // `list available techniques` is what actually answered, and no player
        // types that. Any phrasing the game prints is a phrasing the game must
        // accept - the same rule as a name on a board or a title on a wall.
        || /\b(?:what(?:'s| is)? there to learn|what is there to learn|what can i learn|anything to learn|is there anything to learn|what could i be taught|what am i able to learn)\b/.test(text)) {
        return { action: 'list_techniques' };
    }

    // ── swallowing a pill ──
    //
    // Ahead of `eat`, which took "I eat a healing pill" and answered it with a
    // meal, and beside `buy`, which owns the purchase and not the swallow.
    // `consume_pill` had no member in the closed set at all, so the six heal_hp
    // pills were purchasable and unusable - and `handleConsumePill` is the ONLY
    // writer of `FLAG_PENDING_PILL`, which means the breakthrough pill bonus,
    // the largest modifier in the game, had never once fired in play.
    if (usedAsVerb(text, PILL_TAKING_VERBS) && PILL_NOUNS.test(text)) {
        return {
            action: 'consume_pill',
            target: extractSubject(input, PILL_SUBJECT_VERBS)
        };
    }

    // ── ASKING A HOUSE TO LET YOU SIT IN, which is not learning an art ───
    //
    // Must be tested ahead of `learn_technique` below, whose LEARNING_VERBS
    // contain "study" in verb position: without this, "I study at the Azure
    // Cloud Pavilion" resolved to learning an art called "at the Azure Cloud
    // Pavilion" and answered with the technique listing. The sentence is about
    // a place in a hall, not about a book.
    //
    // Narrow on the GUEST framing rather than on the verb, for the reason this
    // file has learned twice: a wide pattern here would take "I study the
    // Lesser Qi-Gathering Manual" and "I practise with my master", both of
    // which belong to the two verbs either side of it. `study my ...` is
    // excluded explicitly for that reason.
    if (GUEST_STUDENT_PATTERNS.some(p => p.test(text))) {
        const leaving = /\b(?:stop|stops|stopping|leave|leaves|leaving|end|ends|ending|quit|quits|give up|no longer)\b/.test(text);
        const taking = /\b(?:become|becomes|accept|accepts|take (?:the|a|them up on)|enrol|enroll|sign on|i will|yes)\b/.test(text);
        return {
            action: 'sect',
            intent: 'guest',
            ...(leaving ? { topic: 'depart' } : taking ? { topic: 'accept' } : {}),
            ...(leaving ? {} : { target: extractSubject(input, GUEST_SUBJECT_VERBS) })
        };
    }

    // ── learning one, which is not practising one ──
    //
    // `train_technique` raises mastery in something already held; this is the
    // first acquisition, and it is the only route to an art outside a site.
    // Ahead of `investigate`, whose verb list contains "study".
    //
    // THE CLASS NOUN IS NOT REQUIRED, and requiring it was a measured defect:
    // 92 of 103 catalog names fail "I learn the <name>" when the sentence also
    // has to contain "art", "manual" or "technique", because most arts are not
    // called any of those things - and the listing prints their names without
    // one. Most of the corridor above the middle of the ladder was therefore
    // unlearnable by typing its own name back at the game.
    //
    // The learning verbs carry it on their own: "learn", "study", "take up"
    // and "master" in VERB POSITION are not sentences about anything else this
    // parser owns. The subject is resolved against the technique catalog in
    // `GameService.learnTechnique`, so a sentence naming something that is not
    // an art is refused there with the listing attached rather than guessed at
    // here.
    if (usedAsVerb(text, LEARNING_VERBS)
        || (usedAsVerb(text, LEARNING_VERBS_NEEDING_A_NOUN) && TECHNIQUE_CLASS_NOUNS.test(text))) {
        return {
            action: 'learn_technique',
            target: extractSubject(input, LEARNING_SUBJECT_VERBS)
        };
    }

    // ── selling, which is the only way a pouch becomes a purse ──
    //
    // Ahead of `market` and far ahead of the INTERACT table. A player who
    // types "I sell the Qi Grass" is naming a thing they are carrying, and
    // every reading below this one looks for a person of that name. Ahead of
    // `market` too, because "I sell my herbs at the market" is a sale and not
    // a request to read the board - the board question is vetoed back out.
    if (usedAsVerb(text, SELLING_VERBS) && !SELLING_ASKED_AS_A_BOARD.test(text)) {
        return {
            action: 'sell',
            target: extractSubject(input, SELLING_SUBJECT_VERBS)
        };
    }

    // The noun `market` is a place people stand in and steal from and talk
    // about. Asking to SEE the board is a different sentence, and it is
    // either a question about what things cost or a verb aimed at a stall.
    // ── ASKING FOR A CATEGORY BY NAME ────────────────────────────────────
    //
    // "what pills are for sale" and "what medicine is for sale" both resolved
    // into NOTHING, which matters more than it sounds: untreated meridian
    // injuries are the leading cause of death in this game, the cure is on the
    // board, and the two sentences a dying player types to find it were the two
    // that did not work. `what is for sale` did work and then showed the eight
    // cheapest lines, all of them mortal goods, so the pills were invisible on
    // that route too.
    //
    // The category noun is left in the target on purpose: `GameService.market`
    // matches it against MARKET_CATEGORIES and filters the board, which is the
    // machinery that already existed and had no sentence pointing at it.
    if (/\b(?:what|which|any)\b[^.?!]*\b(?:pills?|medicines?|elixirs?|remed(?:y|ies)|healing|cures?)\b[^.?!]*\b(?:for sale|on offer|are sold|is sold|do they sell|can i buy|are there|available|here)\b/.test(text)
        || /\b(?:pill|medicine|apothecary|physician|healer)\b[^.?!]*\b(?:stall|shop|counter|board|prices?)\b/.test(text)) {
        return { action: 'market', target: 'medicine' };
    }

    if (/\b(?:what(?:'s| is) (?:for sale|on offer)|what can i buy|going rate|how much (?:is|are|does)|price of|cost of|the prices?)\b/.test(text)
        || (usedAsVerb(text, 'browse|shop|buy|sell|barter|haggle|price|visit|check|see|find|go to|look at|look over|head to|walk to')
            && /\b(?:market|marketplace|bazaar|stalls?|prices?|shops?|traders?)\b/.test(text))) {
        return { action: 'market', target: extractSubject(input, /market for|price of|cost of|buy|sell/) };
    }

    // Stocking up comes before eating, because "buy food" is ambiguous and
    // the expensive reading of getting it wrong is one-directional: a
    // player who meant one meal and got a month of rations has lost some
    // stones, and a player who meant a month and got one meal starves.
    // "ten years of provisions" did not parse, because the count alternation
    // stopped at "three" and every larger number word fell through to `buy`
    // and died at `resolvePrice`. The whole word-number table is spliced in
    // instead of a hand-written list, so it cannot go stale against
    // `parseCount`, which already knows all of them.
    if (new RegExp(
        '\\b(?:stock up|lay in|load up|provision myself|buy provisions|'
        // A COUNT BEFORE THE NOUN. "buy rations" reached provisioning and
        // "buy 20 rations" did not - the clause had no numeric alternative, so
        // it fell through to the eat rule, which matches any `rations?` and
        // bought a single meal. A player who names a number and gets one meal
        // has had their number silently discarded, and if they were not hungry
        // they got a refusal that reads as though provisioning were impossible.
        + `buy (?:some |a |my |${WORD_NUMBER_ALTERNATION}|[0-9]+ )?(?:rations?|supplies|provisions)|`
        + `(?:buy|get|pick up|purchase) (?:a |one |${WORD_NUMBER_ALTERNATION}|[0-9]+ )?`
        + '(?:months?|weeks?|days?|years?|seasons?) (?:of |worth of )?'
        + '(?:food|rations?|provisions|supplies)|'
        + `(?:a |one |${WORD_NUMBER_ALTERNATION}|[0-9]+ )?(?:months?|weeks?|days?|years?|seasons?) `
        + '(?:of |worth of )(?:food|rations?|provisions|supplies)|'
        + 'provisions? for|rations? for|food for the (?:road|trip|journey|way))\\b'
    ).test(text)) {
        // A SPAN and a COUNT are different asks. "two years of rations" names
        // how long to be fed for; "twenty rations" names how many to carry, and
        // how long twenty lasts depends on the body carrying them - hunger
        // tapers by realm, so the same twenty are a season to a novice and years
        // to a Foundation cultivator. Only the span goes through
        // `parseDuration`; the count is passed as itself.
        const span = parseDuration(text);
        const namesASpan = /\b(?:months?|weeks?|days?|years?|seasons?)\b/.test(text);
        if (namesASpan) {
            return { action: 'provision', days: span ?? undefined };
        }
        const count = parseCount(text);
        return { action: 'provision', ...(count !== null ? { rations: count } : {}) };
    }

    if (/\b(?:eat|meal|dine|breakfast|supper|feed myself|buy food)\b/.test(text)
        || /\b(?:food|rations?)\b/.test(text)) {
        return { action: 'eat' };
    }

    // ── buying a line off the board ──
    //
    // Deliberately BELOW `market`, `provision` and `eat`, all three of which
    // own a purchase of their own and all three of which work. What reaches
    // here is everything else the board advertises, which until now reached
    // the INTERACT table and was answered with "nobody by that name" - the
    // engine looking for a person called "visit from the mortal physician".
    //
    // No noun requirement, because the board is twenty-two lines of ordinary
    // English and any list written here would go stale against it. The subject
    // is resolved against `PRICES` in `game.ts` instead, and a purchase the
    // board never advertised is refused with the board attached, for free.
    if (usedAsVerb(text, BUYING_VERBS) && !BUYING_A_PERSON_OFF.test(text)) {
        return {
            action: 'buy',
            target: extractSubject(input, /buy|purchase|pay for|order|book|hire|acquire|take passage on|pay the/)
        };
    }

    // ── what can I make ──
    //
    // The read that closes the alchemy loop, and it had no phrasing at all:
    // "what recipes do I know" and "what can I refine" both parsed to
    // `unclear`, so a player could not find out which formulas were within
    // their realm and therefore could not know which herbs to gather. Ahead of
    // the refining rule because it is the same verb asked as a question, and
    // the question must not be answered by working the cauldron.
    if (/\b(?:what|which)\b[^.!?]*\b(?:recipes?|formulae?|formulas?|pills?)\b[^.!?]*\b(?:do i (?:know|have)|can i (?:make|refine|brew|craft|attempt)|are (?:there|available)|could i make)\b/.test(text)
        // `craft` is here because a player types it and it reached nothing:
        // `refine`, `make` and `brew` all worked and "what can I craft" fell to
        // `unclear`, which is the near-synonym defect this file already has
        // three worked examples of.
        || /\b(?:what can i (?:make|refine|brew|craft|concoct)|what (?:recipes?|formulas?) do i know|list (?:my )?(?:recipes?|formulas?)|show (?:me )?(?:my )?(?:recipes?|formulas?))\b/.test(text)
        // Looking for a pill that does something is a question about the
        // catalog, not a verb aimed at the room. It used to reach the bare
        // `look` rule and come back with the weather.
        || (/\b(?:look|looking|search|searching|hunt|hunting|cast about) for\b/.test(text)
            && /\b(?:pills?|elixirs?|medicines?|formulae?|formulas?|recipes?)\b/.test(text))) {
        return { action: 'refine' };
    }

    // `make` earns its place here only because the second clause still demands
    // an alchemical noun. "I make a pill" is what a player types and it reached
    // nothing at all, while "I refine a pill" worked - not a distinction
    // anybody could be expected to guess.
    if (/\b(?:refine|concoct|brew|distil|distill|alchemy|cauldron|make|craft|cook)\b/.test(text)
        && /\b(?:pill|elixir|medicine|formula|recipe|cauldron|alchemy)\b/.test(text)) {
        return { action: 'refine', target: extractSubject(input, /refine|concoct|brew|distil|distill|make/) };
    }

    if ((/\b(?:gather|forage|harvest|pick|collect|dig up)\b/.test(text)
            || (/\b(?:look|looking|hunt|hunting|search|searching|out) for\b/.test(text)
                && /\b(?:herbs?|roots?|plants?|ingredients?|reagents?|flowers?|mushrooms?|grasses|moss)\b/.test(text)))
        && !/\bgather (?:qi|energy|my qi)\b/.test(text)
        // A pocket is not a plant. `pick` carried this branch, so "I pick Xiao
        // Suiya's pocket" - a theft aimed at a named person - came back
        // "Cloudcap Mushroom, pouched" and "7 days bent over the ground around
        // Kettle". The player attempted a crime against somebody and the engine
        // charged them a week of foraging for it, which is the worst answer
        // available: not a refusal, not the act, and irreversible.
        //
        // There is no theft-from-a-person action in the closed set, so this
        // falls through to `unclear`, which costs no time, no food and no roll.
        // Deliberately narrow - only the pocket-picking idiom, because `pick`
        // is the right verb for a herb and must keep working for one.
        && !POCKET_PICKING.test(text)) {
        return { action: 'gather', target: extractSubject(input, /gather|forage|harvest|pick|collect|dig up/) };
    }

    // The bare forms, and `book`. "I practise", "I train", "I drill", "I spar"
    // and "I read my book" all reached nothing, because the rule demanded a
    // noun from a list that did not include the commonest word for the object.
    // A cultivator with one art and nothing else to do says "I train", and the
    // game had no answer for it.
    if (/\b(?:practi[cs]e|drill|rehearse|work on)\b.*\b(?:art|technique|manual|stance|form|book|scripture|canon)\b/.test(text)
        || /\b(?:train|practi[cs]e)\s+(?:the\s+)?[a-z-]+\s+(?:art|technique|manual|stance)\b/.test(text)
        || /\b(?:read|study|go (?:over|through))\b[^.?!]*\bmy (?:book|manual|art|technique|scripture|canon)\b/.test(text)
        || /^(?:i\s+)?(?:practi[cs]e|train|drill|spar)\s*[.!?]?$/.test(text)
        // SPARRING WITH SOMEBODY is a core activity of the genre and the safe
        // way to meet the combat system, and "I spar with someone" resolved to
        // nothing. It is training - a drill against a partner - rather than an
        // attack: the categorical-gap rule already handles the dangerous
        // version, and routing this to `attack` would turn a practice bout into
        // a fight somebody could die in.
        || /\b(?:spar|sparring|practi[cs]e|train|drill) (?:with|against)\b/.test(text)) {
        return {
            action: 'train_technique',
            target: extractSubject(input, /practi[cs]e|train|drill|rehearse|work on/)
        };
    }

    // ── WHAT MY STANDING BUYS ME ON MY HOUSE'S GROUND ────────────────────
    //
    // The world allocates days on a house's chambers by standing, ground is the
    // largest multiplier in the model - ordinal 29 costs 317 years on ordinary
    // ground against 79 on a sealed vein - and every NPC was already getting
    // it. The player had no sentence that reached it: "I ask for time on the
    // vein" hit the interact dead end, "where can I cultivate in the sect"
    // answered about having no manual, and "I go to the sect cultivation
    // chamber" was refused as a name that is not a place, which is true and
    // useless when the chamber is real and their rank already entitles them
    // to days in it.
    //
    // Ahead of `move`, which owns going to a NAMED place, and gated on the
    // house: a chamber, vein or cave named beside a sect word is this question,
    // and "I travel to The Cut Face" remains a journey.
    if (asksAfterGroundTime(text)) {
        return { action: 'look', intent: 'ground_time' };
    }

    // ── move: one action, several ways of going ──
    const moveIntent = matchIntent(text, MOVE_INTENT_PATTERNS);
    if (moveIntent) {
        const destination = extractDestination(input);

        // Following and approaching take a PERSON. "I follow the cultivator"
        // used to hand `cultivator` to the mover as a destination, and the
        // engine dutifully spent the travel days, wrote the location, and then
        // described the ambient qi of a place called `cultivator`. A verb
        // whose object is a person must not produce a place, so when no
        // destination preposition was used these go to the person instead -
        // where they cost nothing and can be refused honestly.
        if (!destination && (moveIntent === 'follow' || moveIntent === 'approach')) {
            return {
                action: 'interact',
                target: extractSubject(input, MOVE_SUBJECT_VERBS),
                intent: moveIntent
            };
        }

        return {
            action: 'move',
            target: destination ?? extractSubject(input, MOVE_SUBJECT_VERBS),
            intent: moveIntent
        };
    }

    // The four member verbs, which need the noun so that "I leave" on its own
    // is still a movement and "my standing" outside a sect is still a status.
    if (/\b(?:sect|order|school|clan|house|reserves?|treasur\w+|coffers)\b/.test(text)) {
        // Robbing the place is not resigning from it, and it is now its own
        // thing rather than a refusal: `siphon` takes from the reserves over
        // months, and the word "leave" inside a sentence about taking the
        // treasury must never reach the resignation branch.
        if (SECT_THEFT_PATTERN.test(text)) {
            const pace = SIPHON_PACE_PATTERNS.find(([, pattern]) => pattern.test(text));
            // Whether anybody is TAKING, as opposed to standing in front of the
            // vault talking about it. `SECT_THEFT_PATTERN` matches on the nouns
            // too - treasury, coffers, reserves - which is what makes "what do
            // the sect reserves hold" a sentence about theft; the verb position
            // is what separates the question from the act. An act with no pace
            // named runs at the safest one rather than at none: see the note on
            // DEFAULT_SIPHON_PACE for what "at none" was doing to players.
            const taking = usedAsVerb(text, SIPHON_TAKING_VERBS);
            const chosen = pace ? pace[0] : taking ? DEFAULT_SIPHON_PACE : undefined;
            return {
                action: 'sect',
                intent: 'siphon',
                ...(chosen ? { topic: chosen } : {}),
                ...(parseDuration(text) ? { days: parseDuration(text) as number } : {})
            };
        }
        const wanted = SECT_INTENT_PATTERNS.find(([, pattern]) => pattern.test(text));
        if (wanted) {
            return { action: 'sect', intent: wanted[0] };
        }
    }

    // The oath phrasings are here rather than in a verb of their own, and that
    // is the finding rather than a shortcut. "I swear an oath to the House of
    // the Bound Word" reached the INTERACT table and was answered by walking
    // the player over and describing them - and the act it names is JOINING.
    // The catalog says so in its own admission requirement, which for that
    // house reads "forty years of intended service, sworn in front of a Warden
    // of Terms before any training begins". The pattern held `swear to` and
    // missed `swear an oath to`, two words apart, so a sentence that was
    // already implemented had no route. Membership is exclusive in the
    // repository, so a seat-holder swearing to somebody else is a defection
    // and is answered as one - by the join path, out of real state, rather
    // than by a second verb that would have to decide the same thing again.
    // ── PAYING IN, instead of serving ────────────────────────────────────
    //
    // Missions were the only earner of contribution, so a player with stones
    // and no time had no route to a promotion at all - a rich cultivator and a
    // poor one had exactly the same one, which is not what money is for in this
    // setting. Ahead of the sect-noun rules, which would otherwise take it, and
    // ahead of `buy`, which owns "I buy" and not "I give".
    //
    // The amount is read here and defaults to nothing: a donation with no sum
    // named is a question about what the house would want, not an offer.
    if (/\b(?:donate|donation|give|gift|contribute|pay|hand over|offer)\b/.test(text)
        && /\b(?:sect|house|clan|school|order|contribution|treasury|coffers)\b/.test(text)
        && !usedAsVerb(text, SIPHON_TAKING_VERBS)) {
        const amount = parseCount(text);
        return {
            action: 'sect',
            intent: 'donate',
            ...(amount !== null ? { days: amount } : {})
        };
    }

    // ── WHO LEADS IT, which is not a request to be found one ─────────────
    //
    // The find-me-a-sect rule below fires on a sect noun beside any question
    // word, and `who` is one of them - so "who leads this sect", asked by a
    // member about their own house, was answered with the register of houses
    // that might take them on: "There is one name you have for this: Azure Dew
    // Sect. Knowing a name is not an introduction."
    //
    // This has to sit AHEAD of that rule rather than below it, which is where a
    // first attempt put it, and the reviewer caught the difference because the
    // standing read one command later happily names the head and their title.
    // Same shape as the curriculum question: reading a house is not being sent
    // to find one.
    if (/\b(?:who (?:leads|heads|runs|founded|commands)|who is (?:the )?(?:head|leader|patriarch|matriarch|master|strongest)(?: of)?|who is in charge)\b/.test(text)
        && /\b(?:sect|house|clan|school|order|here|it|this|my|our)\b/.test(text)) {
        return { action: 'sect', intent: 'standing' };
    }

    if (/\b(?:join|joining|apply to|applying to|swear to|swear (?:an oath|my oath|myself|allegiance|fealty|service) to|give (?:my|our) (?:oath|word) to|bind myself to|take (?:the|their) oath|take me on|taken on|would (?:take|have) me|accept me|admit me|adopt me|take me in|be admitted)\b/.test(text)
        || (/\b(?:sects?|order|school|clan)\b/.test(text) && /\b(?:look for|find|near|nearby|around here|what|which|who)\b/.test(text))) {
        return { action: 'sect', target: extractSubject(input, /joining|join|applying to|apply to|swear (?:an oath|my oath|myself|allegiance|fealty|service) to|swear to|give (?:my|our) (?:oath|word) to|bind myself to|enter|find|look for/) };
    }

    // ── who else is drawing on this ground ──
    //
    // Occupancy is the strongest environmental lever in the game - 4.5x
    // measured between the emptiest and busiest ground, wider than the whole
    // thin-to-normal ambient range - and there was no sentence that reached it.
    // "how crowded is it here" resolved into nothing at all.
    //
    // Ahead of the place-history read and of `look`, both of which would take
    // these: "what is this place like" is a look, and `crowded` appears in no
    // other pattern. Narrow on the nouns rather than on the verb, because the
    // question is asked as often with "how many" as with "how crowded".
    if (/\b(?:how crowded|how busy|how many (?:people|cultivators|others)|crowded here|too many people|who else is (?:here|drawing)|how contested|is it crowded|is this place crowded|how many are (?:here|drawing))\b/.test(text)
        || (/\b(?:crowd\w*|contested|occupancy|carrying capacity)\b/.test(text)
            && /\b(?:here|this place|this ground|the ground|is it|how)\b/.test(text))) {
        return { action: 'look', intent: 'crowding' };
    }

    // ── why the ground is like this ──
    //
    // Ahead of `investigate`, which owns "find out about" and "look into", and
    // ahead of `interact`, whose `talk` label matches the speech verb in "what
    // do the locals say". Behind the ASKING branch above on purpose: putting
    // the same question to a PERSON is a different act with a different answer,
    // because who you ask decides what you get.
    if (PLACE_HISTORY_PATTERNS.some(pattern => pattern.test(text))) {
        const where = namedAfter(input, PLACE_HISTORY_SUBJECT);
        return { action: 'look', intent: 'history', ...(where ? { target: where } : {}) };
    }

    // ── a master reading a student ──
    //
    // The same verb with the SUBJECT turned round, and it had no phrasing at
    // all. "Am I ready", "have I stopped", "am I stuck here" are questions
    // about the person asking - answered off their stagnation clock and off
    // who in their house is actually standing above them - and every one of
    // them either fell to the place read (answered with the weather) or to
    // `unclear`. Ahead of the general assess rule, and it carries no target,
    // which is what routes it to the student branch in `GameService.assess`.
    if (/\b(?:am i (?:ready|stuck|stalled|finished|done|going anywhere)|have i (?:stopped|stalled|stagnated|gone as far)|how am i doing here|is there anything (?:left |more )?(?:for me )?here|has this place got anything|what do (?:they|the elders|my seniors) (?:make of|think of|see in) me|am i wasting my time)\b/.test(text)) {
        return { action: 'assess' };
    }

    // ── assess: what happens if I try, which is not the same as looking ──
    if (/\b(?:size up|weigh (?:my|the) chances|assess|how dangerous|could i (?:survive|take|handle|manage)|what (?:would|will) happen if i|am i (?:strong|ready) enough|is it safe|do i stand a chance|judge the odds)\b/.test(text)) {
        return {
            action: 'assess',
            target: extractSubject(input, /assess|size up|survive|take|handle|manage|against|enough for/)
        };
    }

    // ── investigate: examining, reading, searching a place ──
    if (/\b(?:investigate|examine|inspect|study|decipher|appraise|look into|find out about|search|scour|comb|explore|delve|survey|read the|check the|poke (?:about|around)|nose (?:about|around)|rummage|sift|pick through|dig through|dig about|look (?:over|through)|go through|walk the|climb (?:into|down into)|venture into|case the|scavenge|loot|salvage)\b/.test(text)) {
        return {
            action: 'investigate',
            target: extractSubject(input, /investigate|examine|inspect|study|decipher|appraise|look into|find out about|search|scour|comb|explore|delve|survey|read|check|poke (?:about|around)|nose (?:about|around)|rummage|sift|pick through|dig through|dig about|look over|look through|go through|walk|climb into|venture into|case|scavenge|loot|salvage/)
        };
    }

    // ── the cultivator asking about themselves ──
    //
    // This has to be tested BEFORE `interact`, because the ordinary English for
    // it is shaped exactly like addressing somebody: "tell me about myself" hit
    // the interact patterns, took `myself` as a person, failed to find one, and
    // put the words to whichever stranger was standing nearest. Played live it
    // read as: "You put the words to Bai Kekuan. They look at you the way
    // people look at a sentence with a hole in it."
    //
    // The rest were not misrouted, they were simply unrecognised - "what is my
    // situation", "who am I", "am I hungry" and "how is my health" all refused,
    // while "status" and "how am I doing" worked. A player cannot be expected
    // to guess which half of that they are in, and the ones that failed are the
    // words somebody actually types when they are hurt or starving.
    //
    // Deliberately narrow on the possessive: `tell me about myself` is here and
    // bare `about myself` is not, so "I ask her about myself" stays an interact.
    // `how long will I live` is in this list, and it took an embarrassing while
    // to get there. Lifespan is the central pressure of the whole game - the
    // ladder is a race against it, stagnation is measured against it, and the
    // sheet prints the number - and the sentence that asks for it directly fell
    // to `unclear` through several passes of fixing everything around it.
    if (/\b(?:who am i|what(?:'s| is) my (?:situation|condition|state)|how(?:'s| is) my (?:health|condition)|am i (?:hungry|starving|injured|hurt|wounded|bleeding|dying|healthy|ok|okay|alright|well)|my (?:health|condition|situation)|tell me about myself|describe myself|look at myself|check (?:myself|my condition))\b/.test(text)
        || /\b(?:how long (?:will|can|do|have) i (?:live|got|got left|have left)|how (?:long|much longer) have i got|how many years (?:do i have|have i got|are left|left)|what(?:'s| is) my (?:lifespan|life ?span|age)|how old am i|when (?:will|do) i die|years left)\b/.test(text)) {
        return { action: 'status' };
    }

    // ── interact: everything done to or with a person or a faction ──
    const interactIntent = matchIntent(text, INTERACT_INTENT_PATTERNS);
    if (interactIntent) {
        const leverage = LEVERAGE_BEHIND_INTENT[interactIntent];
        return {
            action: 'interact',
            target: extractSubject(input, INTERACT_SUBJECT_VERBS),
            intent: interactIntent,
            ...(leverage ? { leverage } : {})
        };
    }

    // ── REPUTATION IS NOT THE CHARACTER SHEET ────────────────────────────
    //
    // "how am I regarded" and "what is my reputation" both returned the stat
    // block - spirit root, attributes, HP, satiety - which is the DEFLECTIONS
    // failure `scripts/playtest-the-drive.mjs` documents by name: returning the
    // sheet to a question about something else looks like an answer and is not
    // one. Regard is a real modelled system and standing is a real column.
    //
    // Routed to the house's own read, which answers both cases honestly: a
    // member gets their rank, contribution and what the next rung wants, and a
    // rogue gets "Unaffiliated. No stipend, no array, no elder, and nobody to
    // notice if this run ends badly" - which is exactly what a rogue's standing
    // in this world is, and a better answer than their Might score.
    //
    // Ahead of the status rule, and the status words are removed from it.
    if (/\b(?:my reputation|what(?:'s| is) my reputation|how am i regarded|how do (?:they|people|others) (?:see|regard|treat) me|what do people think of me|my standing|what is my standing|how am i seen)\b/.test(text)) {
        return { action: 'sect', intent: 'standing' };
    }

    if (/\b(?:status|sheet|stats|how am i|my (?:rank|realm|progress|cultivation)|what rank am i|what realm am i|how old am i|what do i own|check myself|where do i stand)\b/.test(text)) {
        return { action: 'status' };
    }

    // `cultivat\\w*` used to be the pattern here, and it matched
    // "cultivator" - the commonest noun in the setting. Any sentence about
    // another person became a month of seclusion. The verb forms are
    // enumerated now, and they must be in verb position; the noun forms
    // (`cultivator`, `cultivators`) are deliberately absent from the list.
    if (usedAsVerb(text, 'cultivate|cultivates|cultivating|meditate|meditates|meditating|'
        + 'seclude|secludes|circulate|circulates|circulating|absorb|absorbs|absorbing|'
        + 'breathe|breathes|breathing|sit|sits|settle|settles')
        || /\b(?:in seclusion|into seclusion|gather qi|refine qi|closed[- ]?door cultivation|my cultivation practice)\b/.test(text)) {
        return { action: 'cultivate', days: parseDuration(text) ?? DEFAULT_CULTIVATION_DAYS };
    }

    if (/\b(?:wait|rest|sleep|pass the time|do nothing|linger|loiter|listen|listening|eavesdrop|hang about|hang around)\b/.test(text)) {
        // Carry the duration when one is named. "I wait ten years" returned no
        // days at all, so the handler took its one-day default and the game
        // silently did a thousandth of what was asked - "Waiting of 1 day was
        // intended", to somebody who had just typed ten years. Bare "I wait"
        // still costs a day, so a misparse is no more expensive than before.
        const waited = parseDuration(text);
        return { action: 'wait', ...(waited !== null ? { days: waited } : {}) };
    }

    // ── look ──
    //
    // This branch used to not exist: `look` was reachable only as the
    // fallthrough, so the moment the fallback became inert, "I look around"
    // stopped working. A verb that is only reachable by accident is a verb
    // waiting to be deleted by an unrelated change.
    //
    // Two questions, one action, and they must not return the same
    // paragraph. Somebody scanning a square for a face is not asking about
    // the weather, and answering both with the room made the narrower
    // question pointless to ask.
    // The second half was added because the room description invites a
    // question the parser could not answer. `describeStanding` writes "one of
    // them is out of reach in a way that does not invite comparison", and a
    // player who asks which one got "The thought does not resolve." Narration
    // that prompts a question the engine cannot take is worse than narration
    // that says nothing, so the question routes to the same read - which
    // answers it honestly, by not being able to name a stranger either.
    if (/\b(?:who(?:'s| is| are)? (?:here|around|about|nearby)|is (?:anyone|anybody|somebody) (?:here|about|around)|look for (?:someone|somebody|anyone)|who else is|anybody about|see (?:anyone|anybody|who is here))\b/.test(text)
        || /\bwho (?:is|was|are|were)\s+(?:that|this|the one\b|he\b|she\b|they\b|them\b|these people|those people)/.test(text)) {
        return { action: 'look', intent: 'company' };
    }

    if (/\b(?:look (?:around|about|up|out)|have a look|glance (?:around|about)|survey|take (?:it|the place) in|where am i|what do i see|what is (?:here|around))\b/.test(text)
        || /^\s*(?:i\s+)?looks?\b/.test(text)) {
        return { action: 'look' };
    }

    // A duration and NOTHING ELSE - "ten years" - is a request for seclusion,
    // and it is the single most common thing a player types in this genre.
    //
    // The `nothing else` is load-bearing and was learned the hard way. This
    // used to fire on any sentence containing a duration, so "I take whatever
    // work the village will give me for a season" matched on "a season" and
    // became three months of cultivation. The player was five days from
    // starving, asked for the one action that earns food money, and was given
    // the one action that kills. The run closed permanently.
    if (isBareDuration(text)) {
        const bare = parseDuration(text);
        if (bare !== null) return { action: 'cultivate', days: bare };
    }

    // Nothing matched. The fallback is inert BY RULE: an action the engine is
    // not confident about must be the cheapest one available, never the most
    // expensive. No time passes, no food is eaten, nothing dies.
    return { action: FALLBACK_ACTION };
}

/**
 * Words that can surround a bare duration without making it a sentence.
 *
 * Everything else means the duration was a subordinate clause of some larger
 * intention, and the larger intention is the thing that did not parse.
 */
const DURATION_FILLER = new Set([
    'i', 'ill', 'me', 'my', 'we', 'for', 'the', 'a', 'an', 'and', 'then', 'next',
    'about', 'roughly', 'around', 'another', 'more', 'spend', 'spending', 'take',
    'takes', 'taking', 'pass', 'go', 'last', 'lasting', 'half', 'over', 'in', 'of'
]);

/**
 * Whether the input is a duration and essentially nothing else.
 *
 * Strips the number words, the unit words and the filler above; if anything
 * substantive is left, the sentence was about something other than the passage
 * of time and must not be read as a request to sit still for it.
 */
export function isBareDuration(input: string): boolean {
    const tokens = input
        .toLowerCase()
        .replace(/[^a-z0-9. ]+/g, ' ')
        .split(/\s+/)
        .filter(Boolean);

    if (tokens.length === 0) return false;

    for (const token of tokens) {
        if (DURATION_FILLER.has(token)) continue;
        if (/^[0-9]+(\.[0-9]+)?$/.test(token)) continue;
        if (token in WORD_NUMBERS) continue;
        if (DURATION_UNITS.some(([pattern]) => pattern.test(token))) continue;
        return false;
    }
    return true;
}

/**
 * Pull the first balanced JSON object out of a model response.
 *
 * Models wrap JSON in prose, in fences, and in apologies. Scanning for a
 * balanced brace pair is more forgiving than a fence regex and cannot be
 * tricked into returning a fragment: an unbalanced response yields null, and
 * null means the deterministic parser runs instead.
 */
export function extractJsonObject(text: string): unknown | null {
    const start = text.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') inString = false;
            continue;
        }
        if (ch === '"') inString = true;
        else if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) {
                try {
                    return JSON.parse(text.slice(start, i + 1));
                } catch {
                    return null;
                }
            }
        }
    }
    return null;
}

/**
 * Validate a model's phase-1 response into a plan, or report why it could not be.
 *
 * The `ok: false` branch is not exceptional. It is the boundary doing its job,
 * and every caller must respond to it by running {@link parseIntent} instead.
 */
export function validatePlan(raw: unknown): { ok: true; action: PlannedAction } | { ok: false; reason: string } {
    const parsed = PlannedActionSchema.safeParse(raw);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const path = issue?.path.join('.') || 'response';
        return { ok: false, reason: `${path}: ${issue?.message ?? 'did not validate'}` };
    }

    // Fields are kept only on the actions that own them. Letting `days` ride
    // along on a `look` would make an examination read, in the log, as though
    // it had consumed a decade.
    const { action: name, days, target, intent, topic, terms, reason } = parsed.data;
    const action: PlannedAction = { action: name };

    // Kept only on the verb that owns it, like everything else here. A model
    // that says a fight was agreed has said something the consequence layer
    // needs; a model that says a journey was agreed has said nothing, and
    // letting it ride along would put a word in the ledger that means nothing.
    if (terms && name === 'attack') action.terms = terms;

    if (TIMED_ACTIONS.includes(name)) {
        action.days = days ?? (
            name === 'seclude' ? DEFAULT_SECLUSION_DAYS
                : name === 'work' ? DEFAULT_WORK_DAYS
                    : DEFAULT_CULTIVATION_DAYS);
    }
    if (target && TARGETED_ACTIONS.includes(name)) {
        action.target = target;
    }
    if (intent && INTENT_ACTIONS.includes(name)) {
        // Normalised to a bare label. It is going into a log line and a prompt,
        // never into a conditional, so the only thing that matters is that it
        // stays short and unpunctuated.
        action.intent = intent.toLowerCase().replace(/[^a-z0-9 _-]/g, '').trim().slice(0, 40) || undefined;
    }
    // The sect surface carries two extras the other actions do not: the
    // siphoning pace on `topic`, and how long to run it on `days`. Preserved
    // here as well as in the deterministic parser, or a model-planned theft
    // would silently lose its pace and run for one month at the default.
    if (topic && TOPIC_ACTIONS.includes(name)) {
        action.topic = topic.toLowerCase().replace(/[^a-z0-9 _-]/g, '').trim().slice(0, 40) || undefined;
    }
    if (days && name === 'sect') action.days = days;

    if (reason) action.reason = reason;

    return { ok: true, action };
}

// ─────────────────────────────────────────────────────────────────────────
// THE TWO PATHS MUST HAND THE ENGINE THE SAME OBJECT
// ─────────────────────────────────────────────────────────────────────────

/**
 * Put back the facts about the SENTENCE that a model's answer cannot carry.
 *
 * ── THE DEFECT THIS FIXES ────────────────────────────────────────────────
 *
 * There are two ways a sentence becomes a `PlannedAction`: {@link parseIntent}
 * reads it here, or a model answers phase 1 and {@link validatePlan} checks
 * the answer. The whole architecture rests on those two producing the same
 * thing, because otherwise a configured provider and an unconfigured one are
 * two different games.
 *
 * They did not. Measured over twenty sentences, four reached the engine as a
 * different action object depending on which path ran:
 *
 *     "I threaten the steward into handing over the ledger"
 *          parser  {action:'interact', intent:'threaten', leverage:'force'}
 *          model   {action:'interact', intent:'threaten'}
 *
 *     "I buy 200 rations"
 *          parser  {action:'provision', rations:200}
 *          model   {action:'provision', days:30}
 *
 * `leverage` and `rations` are not in the phase-1 schema the model is shown,
 * and `validatePlan` drops both. The first case matters because the social
 * resolver reads `leverage` and never `intent` - that is the whole design of
 * it - so with a provider configured a threat was priced as a bare ask. The
 * second is worse than a dropped field: `provision` is a timed action, so the
 * stripped `rations` was replaced by a defaulted thirty days. A player who
 * asked for two hundred rations got a month, silently, and only with a
 * narrator running.
 *
 * ── WHY THE FIX IS HERE AND NOT IN THE PROMPT ────────────────────────────
 *
 * The tempting fix is to teach the model to emit `leverage`. That is the
 * wrong direction and it breaks a rule this package is built on: leverage is
 * a fact about what the player put on the table, decided by the parser
 * precisely so that nothing downstream translates a word into a mechanic. A
 * model choosing it would be a model deciding how an approach is priced.
 *
 * So the model keeps the job it is good at - reading which VERB a sentence
 * meant - and the sentence keeps the job it has always had. This never
 * overrides the model: it only fills fields the model left empty, and only
 * when both paths already agree on the verb. Where they disagree the model's
 * verb stands untouched and nothing is carried, because a leverage read off a
 * sentence the parser understood as a different action is a fact about a
 * different action.
 */
export function carryWhatOnlyTheSentenceKnows(action: PlannedAction, input: string): PlannedAction {
    const fromSentence = parseIntent(input);
    if (fromSentence.action !== action.action) return action;

    const merged: PlannedAction = { ...action };

    // What the player put on the table. Read by `resolveAttempt`, and by
    // nothing that a model is allowed to influence.
    if (merged.leverage === undefined && fromSentence.leverage !== undefined) {
        merged.leverage = fromSentence.leverage;
    }

    // Whether both parties agreed to the fight. In the schema but absent from
    // the phase-1 prompt, so a model never says it and the consequence layer
    // could not tell a spar from an ambush unless the parser had run.
    if (merged.terms === undefined && fromSentence.terms !== undefined) {
        merged.terms = fromSentence.terms;
    }

    // A count of rations is a different ask from a span of days, and the
    // conversion between them is not the parser's to make - how long a ration
    // lasts depends on the body carrying it. So where the sentence named a
    // count, the count wins and the DEFAULTED span goes: leaving both on would
    // hand `provision` two contradictory instructions.
    if (merged.rations === undefined && fromSentence.rations !== undefined) {
        merged.rations = fromSentence.rations;
        if (fromSentence.days === undefined) delete merged.days;
    }

    return merged;
}
