/**
 * What kinds of thing are live for THIS cultivator, in THIS state, right now.
 *
 * ── Why this file exists ──────────────────────────────────────────────────
 *
 * Found by playing a full run, age 16 to age 39, in the browser. The verb
 * space is large and well written and a player cannot find any of it. The
 * interface offers three buttons - Cultivate, Status, Attempt Breakthrough -
 * and everything else is free text with no discovery path, so:
 *
 *   "help"            -> "You turn the thought over and it does not resolve
 *                         into anything you could actually do standing here."
 *   "what can I do"   -> the same refusal.
 *
 * Both of the two most universal inputs in the history of text games failed,
 * while `I look for work`, `gather herbs`, `I buy food`, `who can teach me`,
 * `what is stopping me` and a dozen more all answered well and were reachable
 * only by guessing.
 *
 * That is fatal rather than annoying because the engine builds a real trap.
 * The run that found this reached qi deviation at Qi Condensation Layer 9 with
 * three untreated meridian injuries, every stone spent on food and satiety at
 * zero - five turns from death, with a way out: work, gather, eat. A player
 * who sees three buttons presses Cultivate, because it is the only obvious
 * one, and dies without ever learning that the recovery loop was one sentence
 * away. The trap is well designed. The exit was hidden.
 *
 * ── What this is, and what it is emphatically not ─────────────────────────
 *
 * NOT A COMMAND MENU. The whole character of this game is that a player says
 * what they do in their own words, and a fixed list of accepted verbs would
 * flatten that into a point-and-click. What is returned here are PROMPTS: a
 * few sentences that are live in this state, offered so the player learns the
 * shape of the space and then phrases things themselves. Nothing here is the
 * interface, and a player must always be able to type something nobody listed.
 *
 * NOT A DUMP. A list of everything the parser accepts would be worse than
 * nothing - it would be a wall of text that is 90% irrelevant at any moment,
 * which is how a player learns to stop reading. Every rule below is gated on a
 * fact about this cultivator that the engine already computes. Broke and
 * starving surfaces work, gathering and food. Stalled with no manual surfaces
 * asking after a teacher. Wounded surfaces treatment.
 *
 * NOT A DIFFICULTY CHANGE. Nothing in this module reads or writes state, moves
 * a price, alters a probability, or unlocks anything. It is a pure function
 * from facts to sentences. The trap that killed that run is still exactly as
 * lethal to a careless player; what changes is that dying becomes a DECISION
 * rather than a failure to guess vocabulary.
 *
 * ── Every sentence here is verified to parse ──────────────────────────────
 *
 * `AGENTS.md`: "if a near-synonym works, the phrasing that fails is a bug",
 * and its sibling failure - offering a player a sentence that reaches nothing
 * - would be worse than saying nothing, because they would conclude the game
 * is broken rather than that they guessed wrong. So `say` is not prose. It is
 * a string that was typed at the real endpoint and observed to route to the
 * action named in `routesTo`, and `tests/web/what-is-worth-doing.test.ts`
 * holds every one of them against the parser so a parser change cannot
 * silently turn this file into a list of lies.
 *
 * ── The thresholds are the schema's, not this file's ──────────────────────
 *
 * How long the body has is `turnsUntilStarvation`, computed by the engine and
 * passed in - not satiety divided by anything, which is what this file did
 * first and which is wrong at every rung above the bottom, because the burn is
 * multiplied by the realm and there is a grace period after the belly empties.
 * `STARVATION_TURNS` sets the urgent band; the caller supplies the price of a
 * meal from the same catalog row the shop charges against. The one number
 * invented here is `WARNING_HORIZON`, and it decides nothing but the ORDER two
 * lines appear in.
 *
 * ── A LINE NAMES AN ATTEMPT. IT NEVER NAMES AN OUTCOME ────────────────────
 *
 * Ruled by the design owner while this file was being widened, over the case
 * that tempts hardest - a war:
 *
 *   "I said kill, I mean attack. Kill is a definite and this game doesn't
 *   guarantee that via buttons, only via engine."
 *
 * The client renders these as buttons, and a button is the *may I*, never the
 * answer. `attack` is a thing somebody does; `kill` is a thing that either
 * happens to the other person or does not, and the engine is the only thing
 * with the authority to say which. A player who pressed a button labelled
 * `kill` and read that the other one walked away has been lied to by the
 * interface rather than surprised by the world.
 *
 * So the test for every `say` below: is it a thing the player DOES, or a thing
 * that HAPPENS to somebody? Attack, ask, offer, follow, refuse, take, leave -
 * attempts, all fine. Kill, win, persuade, convince, escape - outcomes, and
 * none of them may appear on this list however natural the phrasing.
 *
 * ── AND NOTHING HERE SWITCHES A VERB ON ───────────────────────────────────
 *
 * The whole loop the owner described, in three steps: a war makes `attack`
 * appear, the player learns the word without reading anything, and then they
 * type it at a merchant in a quiet market where nobody offered it - and the
 * world answers differently, because attacking a trader in a square is not
 * attacking a soldier in a war.
 *
 * That only works if the button is a SUBSET of what can be typed and never the
 * boundary of it. A verb reachable only while something is suggesting it would
 * break the loop at the second step: the player would have learnt a word that
 * stops working the moment the situation that taught it ends, which is worse
 * than never having been told. So this module reads state and returns
 * sentences. It grants nothing, unlocks nothing, and every line it offers was
 * typeable before it appeared and stays typeable after it goes.
 *
 * It follows that the lines worth offering are the ones whose MEANING SURVIVES
 * BEING CARRIED SOMEWHERE ELSE. A sentence that is only coherent in the corner
 * that produced it teaches nothing transferable, whatever it does for the turn
 * it appears on.
 */

import { STARVATION_TURNS } from '../schema/cultivation.js';
import { whatToSayAboutTheCure, type TheCure } from './what-would-close-this-wound.js';

/**
 * Somebody asking what there is to do at all.
 *
 * Kept here rather than in `actions.ts` because it is about this module's
 * subject, and because the two sentences it has to catch are not verbs - they
 * are the player stepping outside the fiction to ask how the fiction works.
 * Both currently reach `unclear`, which is exactly the refusal this file
 * exists to answer.
 *
 * Deliberately narrow. "help me carry this", "what can I do about the Azure
 * Dew Sect" and "who can help me" are all questions about the world with real
 * verbs behind them, so the anchors require the ask to be the WHOLE sentence
 * rather than a phrase inside one.
 */
export const ASKING_WHAT_IS_POSSIBLE =
    /^\s*(?:\/)?(?:help|help me|halp|\?|what (?:can|could|might) i do(?: (?:here|now|next))?|what (?:can|could) i (?:say|type|try)|what (?:do|should) i do(?: (?:here|now|next))?|what now|what next|what are (?:my|the) (?:options|choices)|what(?:'s| is) (?:my|the) (?:options|choices)|my options|i (?:don'?t|do not) know what to do|what commands are there|what are the commands|how do i play|what is there to do(?: here)?|what can be done(?: here)?)\s*[.?!]*\s*$/i;

/**
 * A BARE ask after options, with nothing in it about a book.
 *
 * "what are my options" is currently understood as a question about how the
 * manual in your hands could go further - a good read, and the wrong one for a
 * player who has just started and is asking what the game is. The two are told
 * apart by whether the sentence mentions the thing the manual read is about;
 * anything that does is left exactly where it was, because "my options at this
 * ceiling" is a real question with a real answer.
 */
export const ABOUT_A_MANUAL =
    /\b(?:manual|book|art|arts|technique|techniques|method|methods|scripture|canon|volume|ceiling|wall|further|cap|road)\b/i;

/**
 * How pressing this is. Ordering only - never a gate, and never a
 * recommendation the engine is prepared to defend.
 *
 * `now` means something is actively taking this cultivator apart. `soon` means
 * it will be. `open` is everything a person standing here could simply do.
 */
export type Urgency = 'now' | 'soon' | 'open';

const URGENCY_ORDER: Record<Urgency, number> = { now: 0, soon: 1, open: 2 };

/** One thing that is live standing here. */
export interface Affordance {
    /**
     * What made it live: this square, this cultivator, or nothing at all.
     *
     * ── The ruling this field exists to serve ────────────────────────────
     *
     * The design owner, on the row of buttons the client renders from this:
     * *"a button appearing is how a verb is learned"*, and *"appearance is
     * information, so do not pad."* Both sentences are about the same
     * property. A player finds out a verb exists because one turn it was not
     * offered and the next turn it was - which only teaches anything if the
     * arrival MEANT something, and a row topped up with evergreen reads to
     * look full teaches nothing at all.
     *
     * ── Why three values and not two ─────────────────────────────────────
     *
     * Because two was measured and it did not fix the reported defect. The row
     * that was called way too basic is produced by three lines firing off ONE
     * condition - practising no method - and a flag that only separated "gated
     * on something" from "always true" left all three tied with everything
     * else that was gated, so they went on filling the row while two houses
     * held intakes in the square.
     *
     * The distinction that actually orders them is the owner's own: *what is
     * here and will not be here later* beats *what is merely possible*. A fact
     * about the square is gone the moment the player walks out of it. A fact
     * about the body travels with them and will still be true in an hour
     * wherever they are standing. So:
     *
     *   `here`   the wall, the counter, the board, who is in the square, what
     *            the ground is. Perishable, and the reason to look up.
     *   `you`    no method, a stalled manual, an empty purse, a torn meridian,
     *            a crossing that is ready. Real, and it keeps.
     *   `always` the floor. True in every square in the world on every day of
     *            a life, and only ever shown to keep a quiet turn from looking
     *            like a broken one.
     *
     * NOT a second urgency. Urgency says how pressing something is; this says
     * how long it will go on being true. A wall with paper on it is not urgent
     * and it is the most informative thing in the square.
     */
    whatItIsAbout: 'here' | 'you' | 'always';
    /**
     * Stable key. Used to dedupe when two conditions surface the same verb,
     * and it is what a test asserts against rather than the prose.
     */
    id: string;
    /**
     * The sentence to type, verbatim.
     *
     * The client puts this in the command box and submits it, so it has to be
     * a sentence the parser actually understands. See the banner: these are
     * pinned by test.
     */
    say: string;
    /**
     * Which engine action `say` routes to. Carried so the test can assert the
     * pairing, and so a reader of a log can see what was being offered.
     */
    routesTo: string;
    /**
     * Why it is live, in one clause, drawn from the state that made it live.
     *
     * This is the half that teaches. "You can work" is a menu item; "the purse
     * will not buy a meal" is the reason the player is being shown it, and it
     * is the sentence that makes the next decision theirs.
     */
    because: string;
    urgency: Urgency;
}

/**
 * Everything this module needs to know, as scalars the caller has already
 * computed for other purposes.
 *
 * Deliberately not a `Cultivator`. Two reasons: the interesting facts here are
 * derivations (is a manual still carrying them, is a wound something a mortal
 * physician can reach) that live in six different engine functions, and a pure
 * function over named scalars is a thing a test can drive through every corner
 * of the state space without standing up a database.
 */
export interface StandingHere {
    // ── FIVE OF THESE ARE OPTIONAL, AND IT IS TEMPORARY ──────────────────
    //
    // `pillsCarried`, `peopleHere`, `paperOnTheWall`, `spanCounterHere` and
    // `dutiesGoing` are `?`, on the same grounds and with the same expiry as
    // `peopleHereWithSomethingToSell` below: the only thing that can compute
    // them is `whatIsLiveHere` in `game.ts`, and that file was held by several
    // other agents when this landed. Absent reads as "nothing here", which
    // loses the lines and keeps every other one, so a tree without the caller
    // still builds and still answers.
    //
    // MAKE THEM REQUIRED THE MOMENT THAT WRITER LANDS. A field nothing writes
    // reads as a value and the code around it goes on answering with total
    // confidence - `AGENTS.md` has the whole entry, and this file has already
    // shipped one dead prompt on exactly that mistake.
    /** 0-100, as the schema defines it. Carried for the operator line only. */
    satiety: number;
    /** Consecutive turns spent at zero. Non-zero means the body is paying. */
    starvationTurns: number;
    /**
     * How long is left, from `turnsUntilStarvation` and nothing else.
     *
     * NOT satiety divided by the per-action cost, which is what this file did
     * first and which is wrong twice over: the burn is multiplied by the
     * realm's own `satietyBurnMultiplier`, and the grace after the belly
     * empties is `STARVATION_TURNS` on top. `Infinity` above the rung where
     * hunger stops, which is a real state and not a missing number - a
     * cultivator who does not eat is off the clock rather than far along it.
     */
    turnsUntilStarvation: number;
    spiritStones: number;
    /**
     * What one meal costs here, from the catalog row the shop charges against.
     *
     * Passed in rather than imported so that there is exactly one price of
     * food in this codebase and this file is not a second one.
     */
    mealCost: number;
    /** Untreated wounds a mortal physician could actually close. */
    treatableWounds: number;
    /**
     * Untreated wounds past what mortal medicine reaches at this rung.
     *
     * A separate count because the answer is a different one: no amount of
     * money buys a physician who can touch these, and pointing the player at
     * one would be sending them to be refused.
     */
    woundsPastMortalCare: number;
    /**
     * The medicine that would close the worst untreated wound, named and
     * priced, or null when nothing is torn.
     *
     * This is the whole of the second measurement that produced this file. A
     * player carrying a crippling tear and 194 spirit stones against a 54-stone
     * cure could not find it, because the only place its name appears is
     * `pills.ts`. The engine was right at every step and silent at the one that
     * mattered. See `what-would-close-this-wound.ts`.
     */
    cure: TheCure | null;
    /** Below full HP. Distinct from wounded: a battered body mends under care. */
    battered: boolean;
    /** Whether a cultivation-class manual is being practised at all. */
    practisesAMethod: boolean;
    /**
     * The practised manual has stopped carrying them at this rung.
     *
     * The single most important thing a stalled player can be told, and until
     * now it was forty lines down a status read.
     */
    methodExhausted: boolean;
    breakthroughReady: boolean;
    inASect: boolean;
    /** Rows in the pouch a buyer would put a price on. */
    sellableGoods: number;
    /**
     * Pills in the pouch that nothing has swallowed.
     *
     * A separate count from {@link StandingHere.sellableGoods} because it is a
     * different fact with a different answer. A pill bought and never taken
     * does nothing at all - it is the one purchase in this game that can sit in
     * a pouch through the exact crossing it was bought for - and the read that
     * says so is not the same read as "what would a buyer give me".
     */
    pillsCarried?: number;
    /** People standing here, right now, at a higher rung than this cultivator. */
    peopleAboveHere: number;
    /**
     * People standing here at all, whatever rung they are at.
     *
     * A COUNT AND NEVER A NAME, like every other roster figure in this file.
     * Found by playing: a Stone-Shell Tortoise in Human Form was standing in
     * the square at ordinal 29 and nothing offered looking at it, which is the
     * clearest possible case of the world failing to volunteer - somebody was
     * RIGHT THERE and the row went on suggesting the same three reads.
     *
     * Distinct from `peopleAboveHere`, which asks a question about the ladder.
     * Somebody at or below this cultivator's rung is still a person, still has
     * a face, and is still the most interesting thing in an empty square.
     */
    peopleHere?: number;
    /**
     * People standing here who would part with something they are holding.
     *
     * A COUNT AND NEVER A NAME, the same discipline `groundThatTeachesARoad`
     * below follows and for the same reason: this decides whether a LINE is
     * offered, and the line routes to a read that does its own knowledge
     * granting. A panel that named the sellers would be handing over four
     * strangers' names every time it rendered.
     *
     * `SAY.market` existed in this file from the day it was written and NO
     * RULE EVER ADDED IT - a dead prompt, which is the same defect as an
     * unwritten field one size smaller. So a fresh nobody standing in a market
     * town with thirty stones, no manual and a stall forty paces away asking
     * eight for the primer was offered "who can teach me", "what arts can I
     * learn" and "what sects are there", and was never once told there was a
     * market. That is the first real decision in the game - a book or the food
     * - and it was unreachable except by guessing the words.
     *
     * OPTIONAL, and only because the caller that supplies it is held up: the
     * sellers live on the world and `whatIsLiveHere` in `game.ts` is the one
     * place that can count them. Absent reads as none, which loses the first of
     * the two lines below and keeps the second. Make it required again the
     * moment that writer lands, because a count nothing writes is a rule
     * nothing enforces.
     */
    peopleHereWithSomethingToSell?: number;
    /** The ground gives back less than ordinary: half rate, and a penalty. */
    thinGround: boolean;
    /**
     * Ground this cultivator can point at where a road can be walked, plus the
     * things bound to them that carry one.
     *
     * A COUNT AND NEVER A NAME, and the count is over their own knowledge rows
     * rather than over the world's. Twenty-three of these are seeded per world
     * and nothing a player could type reached one; the line this number decides
     * is what makes the read findable at all. Somebody who has been told about
     * none of them is offered nothing, which is how the discovery gate stays
     * shut: the affordance cannot leak what the read would refuse to say.
     */
    groundThatTeachesARoad: number;
    /**
     * The paper nailed up where this cultivator is standing.
     *
     * ── The miss this closes, in the owner's own words ────────────────────
     *
     * *"Standing at Wheatgate at Qi Condensation Layer 1 with no method, the
     * engine already knew that two houses were holding intakes there - one in
     * 35 days, one in 70 - and said so in the prose. Neither appeared as
     * something live to do."*
     *
     * That is the whole shape of what was wrong here: the fact was computed,
     * the fact was narrated, and the row of things to do went on offering the
     * same three evergreen reads. A wall with paper on it is the single most
     * place-specific thing in a settlement and it is the one channel in this
     * world that runs TOWARDS the player - houses short of bodies come looking
     * - so it belongs at the top of what a nobody is shown.
     *
     * COUNTS AND A NUMBER OF DAYS, NEVER A HOUSE NAME. The line this decides
     * routes to the read that walks over to the wall, and that read does its
     * own granting through `learnIfNew`. Naming a house here would hand over a
     * record the player has not been given, which is the leak the discovery
     * gate exists to prevent.
     *
     * Null where the caller could not answer - no world loaded, an unplaceable
     * location - rather than a zeroed shape, because "there is no wall here"
     * and "I could not tell" are different facts and only the first is worth a
     * sentence.
     */
    paperOnTheWall?: {
        /** Bills up here today. */
        bills: number;
        /** Of those, how many state a bar this cultivator already clears. */
        withinReach: number;
        /** Days until the soonest intake opens, or null when none is dated. */
        daysToTheSoonest: number | null;
    } | null;
    /**
     * A Measured Span counter answers where they are standing.
     *
     * Three of the five provinces have none, which is the information rather
     * than a gap - so this is false almost everywhere and its being true is a
     * fact about this square. Reading the board costs nothing and is how
     * somebody who has never left their province finds out there are others.
     */
    spanCounterHere?: boolean;
    /**
     * Commission work the board would actually put to somebody at this rung.
     *
     * The count and not the wall. `commissionBoard` filters on the ordinal
     * bands the catalog states, so this number MOVES AS THE PLAYER CLIMBS -
     * which is the point: the duty line used to be gated on not being in a
     * house, so a member, who is the person the whole mission board exists
     * for, was never once shown it, and a nobody with an empty board was shown
     * a sentence that came back "you belong to nothing, so there is no wall".
     * Both halves of that were wrong in the same way, and the count fixes
     * both: it is offered when there is something going, to whoever it is
     * going to.
     */
    dutiesGoing?: number;
    /**
     * Past the Lid, where none of the mortal-world lines apply at all.
     *
     * Not a difficulty branch - a correctness one. Offering a True Immortal a
     * physician, a market stall and a season of water carrying would be
     * offering them five refusals in a row.
     */
    aboveTheLid: boolean;
    /**
     * A seclusion the engine stopped and has not resolved, waiting on an answer.
     *
     * Null on every ordinary turn. When it is set the cultivator is standing
     * over a decision with a decade on one side of it, and it is the one entry
     * in this whole file that is gone next turn whatever they do - so it is
     * offered first, ahead even of the body, which is the only exception the
     * ordering below makes and the reason it makes it.
     *
     * Only one sentence comes out of it. Sitting back down is the answer that
     * needs vocabulary; going is every other sentence in the language, and a
     * prompt for it would be a prompt for "do anything at all".
     * `choosing-what-to-do-when-a-seclusion-is-broken.ts` holds the whole
     * design.
     */
    brokenSeclusion: { daysRemaining: number; canWithdraw: boolean } | null;
}

/**
 * How far ahead a problem is worth flagging before it is urgent, as a multiple
 * of the starvation window.
 *
 * The one invented number in this file, and it is safe because it decides
 * nothing but the order two lines print in. Three windows is roughly "you
 * would notice this before it noticed you".
 */
const WARNING_HORIZON = 3;

/**
 * The most lines a single read may hand back.
 *
 * A cap rather than a hope. Measured: a cultivator who is starving, broke,
 * carrying five wounds of two kinds, holding a full pouch, practising nothing,
 * standing on thin ground with six people above them reaches FOURTEEN live
 * rules at once - every one of them individually correct, and the sum of them
 * a wall of text, which is precisely how a player learns to stop reading.
 *
 * The cut is by urgency, so what survives it is what is actually taking this
 * cultivator apart. Losing "what news is there" off the bottom of a screen
 * belonging to somebody four days from starving is the right thing to lose.
 */
const MOST_A_PLAYER_SHOULD_READ = 8;

// ─────────────────────────────────────────────────────────────────────────
// THE LINES
//
// Written once, in one place, so the refusal, the `help` read and the panel
// are all quoting the same sentence rather than three drifting copies of it.
// `because` is filled in at the point the rule fires, because the reason is
// always a number that only the live state knows.
// ─────────────────────────────────────────────────────────────────────────

const SAY = {
    work: { id: 'work', say: 'I look for work', routesTo: 'work' },
    gather: { id: 'gather', say: 'I gather herbs', routesTo: 'gather' },
    hunt: { id: 'hunt', say: 'I hunt a spirit beast', routesTo: 'hunt' },
    sell: { id: 'sell', say: 'I sell my herbs', routesTo: 'sell' },
    eat: { id: 'eat', say: 'I buy food', routesTo: 'eat' },
    treat: { id: 'treat', say: 'I see a physician', routesTo: 'treat' },
    market: { id: 'market', say: 'what is for sale', routesTo: 'market' },
    inventory: { id: 'inventory', say: 'what am I carrying', routesTo: 'inventory' },
    teacher: { id: 'teacher', say: 'who can teach me', routesTo: 'teacher' },
    arts: { id: 'arts', say: 'what arts can I learn', routesTo: 'list_techniques' },
    sects: { id: 'sects', say: 'what sects are there', routesTo: 'sect' },
    duties: { id: 'duties', say: 'what duties are there', routesTo: 'sect' },
    ceiling: { id: 'ceiling', say: 'what is stopping me', routesTo: 'ceiling' },
    further: { id: 'further', say: 'how can I go further', routesTo: 'acquisition' },
    destinations: { id: 'destinations', say: 'where can I go', routesTo: 'destinations' },
    roads: { id: 'roads', say: 'what can I learn here', routesTo: 'roads' },
    breakthrough: { id: 'breakthrough', say: 'I attempt a breakthrough', routesTo: 'breakthrough' },
    cultivate: { id: 'cultivate', say: 'I cultivate for a year', routesTo: 'cultivate' },
    room: { id: 'room', say: 'who is here', routesTo: 'look' },
    news: { id: 'news', say: 'what news is there', routesTo: 'news' },
    // The wall. Free everywhere, and the one discovery channel in this world
    // that comes looking for the player instead of waiting to be found.
    bills: { id: 'bills', say: 'what is posted here', routesTo: 'look' },
    // The counter, where there is one. Reading the board is free and is how
    // somebody who has never left their province learns there are others.
    passage: { id: 'passage', say: 'what runs from the Span counter', routesTo: 'passage' },
    // The one answer to a broken seclusion that needs words. It routes to
    // `cultivate` here and it is INTERCEPTED before phase 1 while a fork is
    // standing, so it resumes the interrupted sitting for its remaining days
    // rather than opening a new one - see `GameService.act`. The routing is
    // pinned all the same, because the fork can be gone by the time the
    // sentence arrives and a sentence this file offers has to work either way.
    sitBackDown: { id: 'sit_back_down', say: 'I sit back down', routesTo: 'cultivate' }
} as const;

type Line = typeof SAY[keyof typeof SAY];

/**
 * A line that fired on a fact about this cultivator.
 *
 * True of them and of nobody standing beside them, and still true tomorrow in
 * the next province. An empty purse, a torn meridian, a manual that has stopped
 * carrying them.
 */
const at = (line: Line, urgency: Urgency, because: string): Affordance =>
    ({ ...line, urgency, because, whatItIsAbout: 'you' });

/**
 * A line that fired on a fact about the square they are standing in.
 *
 * The perishable half, and the half that was missing. Walk out and it is not
 * true any more: paper on this wall, a counter at this station, work on this
 * board, somebody standing right there. This is what the row leads with inside
 * each urgency band, because it is the thing a player will not get another
 * chance at and the thing they cannot know without being told.
 */
const inTheSquare = (line: Line, urgency: Urgency, because: string): Affordance =>
    ({ ...line, urgency, because, whatItIsAbout: 'here' });

/**
 * A line that is true of everybody, everywhere, forever.
 *
 * The floor. It exists so that `help` is never the word "nothing", and it is
 * marked so the ordering can keep it BELOW anything that is live for a reason
 * - because a row topped up with these to look full is the padding the design
 * owner ruled against, and it is what made the row read as static.
 */
const always = (line: Line, because: string): Affordance =>
    ({ ...line, urgency: 'open', because, whatItIsAbout: 'always' });

/**
 * What is worth doing standing here, most pressing first.
 *
 * Never empty. A cultivator with nothing wrong and nothing to chase still gets
 * the reads, because the alternative is a `help` that says "nothing", which is
 * the refusal this module was written to delete.
 */
export function whatIsWorthDoingStandingHere(here: StandingHere): Affordance[] {
    const out: Affordance[] = [];
    const add = (a: Affordance): void => { out.push(a); };

    // The five the caller may not be supplying yet, read once, so the rules
    // below stay readable and there is exactly one place that decides what an
    // absent count means. See the note at the top of `StandingHere`.
    const pillsCarried = here.pillsCarried ?? 0;
    const peopleHere = here.peopleHere ?? 0;
    const paperOnTheWall = here.paperOnTheWall ?? null;
    const spanCounterHere = here.spanCounterHere ?? false;
    const dutiesGoing = here.dutiesGoing ?? 0;

    const turns = here.turnsUntilStarvation;
    // The belly is empty and the grace period is running. `starvationTurns` is
    // the engine's own count of how much of it has been spent.
    const starving = here.starvationTurns > 0 || here.satiety <= 0;
    // Inside the starvation window itself is `now`: what is left is now shorter
    // than the time dying takes. `Infinity` above the rung where hunger stops
    // falls out of both bands on its own, which is the correct answer there.
    const closeToIt = turns <= STARVATION_TURNS;
    const hungry = turns <= STARVATION_TURNS * WARNING_HORIZON;
    const canBuyAMeal = here.spiritStones >= here.mealCost;

    // ── a question the engine left open, which expires this turn ──────────
    //
    // Ahead of the body, and it is the only thing in this file that goes ahead
    // of the body. The rule below is that starvation comes first because every
    // other line is something a starving cultivator will not live to finish -
    // and this is the one line that will not exist to be finished. A seclusion
    // was stopped by somebody arriving, the remaining years are still sitting
    // there, and the next thing the player does settles it either way. Being
    // shown the food first and the fork second means being shown the fork after
    // it is gone.
    //
    // One sentence, not two. Going is every other sentence in the language, and
    // "you may also do anything else" is not a prompt.
    if (here.brokenSeclusion) {
        const left = here.brokenSeclusion.daysRemaining;
        const span = left >= 365
            ? `${(left / 365).toFixed(1)} years`
            : `${left} day${left === 1 ? '' : 's'}`;
        add(at(SAY.sitBackDown, 'now', here.brokenSeclusion.canWithdraw
            ? `The sitting stopped with ${span} of it unspent, and the road out is only open `
              + 'while you are standing. Sitting back down spends them and is how you are found.'
            : `The sitting stopped with ${span} of it unspent and there is no road out. Sitting `
              + 'back down spends them, at the cost of being found seated.'));
    }

    // ── the body, which is what actually kills people here ────────────────
    //
    // Ordered before everything because it is ordered before everything in the
    // engine: a cultivator at zero satiety has STARVATION_TURNS of turns left
    // whatever else is true of them, and every other line on this list is
    // something they will not live to finish.
    if (!here.aboveTheLid) {
        if (starving) {
            add(at(SAY.eat, 'now', canBuyAMeal
                ? `Nothing left to burn: the body is paying for the qi. A meal costs ${here.mealCost}, `
                  + `and there ${here.spiritStones === 1 ? 'is' : 'are'} ${here.spiritStones} in the purse.`
                : `Nothing left to burn, and ${here.spiritStones} in the purse against a meal at `
                  + `${here.mealCost}. Something has to be sold or earned first.`));
        } else if (hungry) {
            add(at(SAY.eat, closeToIt ? 'now' : 'soon',
                `About ${turns} day${turns === 1 ? '' : 's'} of eating left, counting the `
                + `${STARVATION_TURNS} the body survives on nothing at the end of it.`));
        }

        // Money, and the two ways to get it that need nothing but a back.
        // Offered whenever food is close and the purse will not cover it,
        // which is the exact corner the run that found this died in.
        // Gated on hunger and not on a bare empty purse. A fed cultivator with
        // no stones is not in trouble yet, and telling them "the purse will not
        // buy a meal" while they are full is both untrue-feeling and, worse,
        // it takes the WORK line's reason away from whatever is actually
        // pressing - a cure they cannot afford, most of all.
        const broke = here.spiritStones < here.mealCost;
        if (hungry && !canBuyAMeal) {
            add(at(SAY.work, closeToIt ? 'now' : 'soon',
                'The purse will not buy a meal. Work pays and it does not feed you, '
                + 'which is why a stipend is worth more than the stipend.'));
            add(at(SAY.gather, closeToIt ? 'now' : 'soon',
                'A week bent over the ground around here comes back with something a buyer prices.'));
        }
        if (here.sellableGoods > 0 && (broke || hungry)) {
            add(at(SAY.sell, closeToIt ? 'now' : 'soon',
                `${here.sellableGoods} thing${here.sellableGoods === 1 ? '' : 's'} in the pouch that `
                + 'somebody would put a price on, and a buyer pays less than list.'));
        }

        // ── wounds ────────────────────────────────────────────────────────
        //
        // Split on what mortal care can actually reach, because the two have
        // different answers and pointing a player at a physician who will
        // refuse them is worse than saying nothing.
        if (here.treatableWounds > 0) {
            add(at(SAY.treat, 'now',
                `${here.treatableWounds} untreated wound${here.treatableWounds === 1 ? '' : 's'} that `
                + 'ordinary care could close. They do not mend by waiting, and every one of them '
                + 'raises the odds of the next deviation.'));
        } else if (here.battered) {
            add(at(SAY.treat, 'soon',
                'Nothing torn, but the body is under what it should be, and a month under a roof '
                + 'is the only thing that puts it back.'));
        }
        // ── the medicine, BY NAME ─────────────────────────────────────────
        //
        // The point of the whole file, in one branch. "Graded medicine, which
        // is bought" is what the game used to say, and it is useless: a player
        // cannot type a category at a counter. What they need is the NAME, the
        // price, and whether the purse covers it - and where it is past what
        // money buys, the name and the reason instead. The verb for the second
        // case is still the physician, because their refusal is where that
        // sentence is said in full.
        if (here.cure != null && here.woundsPastMortalCare > 0) {
            const cure = here.cure;
            if (cure.stones !== null) {
                add({
                    id: 'medicine',
                    say: `I buy a ${cure.name}`,
                    routesTo: 'buy',
                    urgency: cure.affordable ? 'now' : 'soon',
                    because: whatToSayAboutTheCure(cure),
                    whatItIsAbout: 'you'
                });
                // Named for the shortfall rather than for hunger, because a
                // player who cannot afford the cure needs the same two verbs
                // and a completely different reason for wanting them.
                if (!cure.affordable) {
                    add(at(SAY.work, 'soon',
                        `A ${cure.name} is ${cure.stones} spirit stones and the purse holds `
                        + `${here.spiritStones}. Work is the slow half of the answer.`));
                    add(at(SAY.gather, 'soon',
                        'What comes out of the ground here sells, and it needs no rank to do it.'));
                    if (here.sellableGoods > 0) {
                        add(at(SAY.sell, 'soon',
                            `${here.sellableGoods} thing${here.sellableGoods === 1 ? '' : 's'} in the `
                            + 'pouch, and the cure is priced in stones.'));
                    }
                }
            } else {
                add(at(SAY.treat, 'soon', whatToSayAboutTheCure(cure)));
            }
        }
    }

    // ── the road, which is what the run is actually about ─────────────────
    //
    // ONE OF THESE IS `soon`, AND IT USED TO BE ALL THREE. That is the defect
    // the design owner reported as "way too basic": three lines fire off one
    // condition, all at the same urgency, and a row with room for three shows
    // the same three for as long as the condition holds - which for somebody
    // with no method is the entire opening of the game, across every turn and
    // every place they walk to. The world could be on fire behind them.
    //
    // The one kept at `soon` is the arts read, on the owner's own calibration:
    // a player with no method "should be told the one thing that matters, and
    // 'what arts can I learn' is close". The other two are the same fact said
    // twice more; they stay offered, one band down, where anything actually
    // happening in the square outranks them.
    if (!here.aboveTheLid && !here.practisesAMethod) {
        const why = 'You practise no method, so nothing accumulates however long you sit.';
        add(at(SAY.arts, 'soon', `${why} What a root like yours could take up is a short list.`));
        add(at(SAY.teacher, 'open', `${why} A teacher is one of the two ways out.`));
        if (!here.inASect) {
            add(at(SAY.sects, 'open',
                'A house is the ordinary way somebody with nothing gets a book, a stipend and a bed.'));
        }
    }

    if (here.methodExhausted) {
        add(at(SAY.ceiling, 'soon',
            'The method you practise has stopped carrying you at this rung. That is a wall with '
            + 'a shape, and the shape is worth knowing before you spend a decade on it.'));
        add(at(SAY.further, 'soon',
            'A manual goes further by being found, being taught, or being written, and all '
            + 'three have a price you can be told before you pay it.'));
    }

    if (here.breakthroughReady) {
        add(at(SAY.breakthrough, 'soon',
            'Enough has accumulated. Nothing is standing between you and the attempt, and '
            + 'nothing will soften what comes of it.'));
    } else if (!here.aboveTheLid && here.practisesAMethod && !starving && here.treatableWounds === 0) {
        add(at(SAY.cultivate, 'open',
            'A road to take the qi, a fed body, and nothing torn. This is the condition the '
            + 'whole thing is for.'));
    }

    if (here.thinGround && !here.aboveTheLid) {
        add(inTheSquare(SAY.destinations, 'soon',
            'The ground here is thin: half rate, and a penalty at the bottleneck. Ground is the '
            + 'largest multiplier a cultivator with no money can change.'));
    }

    if (here.peopleAboveHere > 0 && !here.aboveTheLid) {
        // ── AND THE SENTENCE AFTER THE READ ──────────────────────────────
        //
        // The read names who is above; the verb that does something about it
        // is a different sentence and nothing pointed at it. That gap is what
        // this whole file exists to close: `who can teach me` was reachable
        // only by guessing, and `ask <them> to teach me` is one step further
        // down the same road. Named as a shape rather than with a name in it,
        // because the discovery rule forbids handing over anybody the player
        // has not met and the read above already says how many there are.
        add(inTheSquare(SAY.teacher, 'open',
            `${here.peopleAboveHere} ${here.peopleAboveHere === 1 ? 'person' : 'people'} standing `
            + 'here are further up the ladder than you. Putting it to one of them by name - '
            + '"ask <them> to teach me", "ask <them> to introduce me to <somebody>" - is a '
            + 'different sentence from this one, and it has an outcome. A stranger will '
            + 'usually say no; "buy <them> a drink" or "sit with <them>" costs a day and no '
            + 'stones, and it is what turns a stranger into somebody who might not.'));
    }

    // ── WHAT THIS PLACE IS ASKING FOR THINGS ──────────────────────────────
    //
    // Two rules, one line, and the reasons are different enough to be worth
    // both. Somebody with no road has one decision - the book or the food -
    // and the board is where both of them are priced. And somebody standing
    // next to a cultivator who would sell them something has a reason to look
    // that has nothing to do with their own state.
    //
    // Deliberately below the body and the road: a starving cultivator does not
    // need a shopping trip, and `dedupe` keeps the more urgent occurrence of a
    // line anyway.
    if (!here.aboveTheLid) {
        const sellers = here.peopleHereWithSomethingToSell ?? 0;
        if (sellers > 0) {
            const n = sellers;
            add(inTheSquare(SAY.market, 'open',
                `${n} ${n === 1 ? 'person' : 'people'} standing here would rather have stones `
                + 'than what they are carrying. What a stall asks and what a person asks are the '
                + 'same read, and the second one comes with a reason attached.'));
        } else if (!here.practisesAMethod) {
            add(at(SAY.market, 'open',
                'A stall beside the cooking pots copies out the common books. The stones go on '
                + 'a book or they go on food, and that is the first real decision there is.'));
        }
    }

    // ── WHAT IS NAILED UP HERE, AND WHEN IT STOPS BEING TRUE ──────────────
    //
    // The clearest miss in the report that produced this pass, and the reason
    // the whole file grew a `whatItIsAbout` axis. A wall of paper is a fact about
    // one square on one day: two houses were holding intakes at Wheatgate, one
    // in 35 days and one in 70, the engine knew both, said both in the prose,
    // and offered neither as anything to do.
    //
    // The bar decides the band, and it is the only place in this file where
    // the RUNG changes what is offered rather than what is said. A bill whose
    // stated bar this cultivator already clears is a door standing open in
    // front of somebody who may have nothing; a wall of bills all pitched
    // above them is worth reading and is not an opportunity.
    if (!here.aboveTheLid && paperOnTheWall !== null && paperOnTheWall.bills > 0) {
        const paper = paperOnTheWall;
        const sheets = `${paper.bills} ${paper.bills === 1 ? 'bill' : 'bills'}`;
        const when = paper.daysToTheSoonest === null
            ? ''
            : ` The soonest intake opens in ${paper.daysToTheSoonest} `
              + `day${paper.daysToTheSoonest === 1 ? '' : 's'}, and it is held here.`;
        add(inTheSquare(SAY.bills, paper.withinReach > 0 ? 'soon' : 'open', paper.withinReach > 0
            ? `${sheets} up on the wall here, ${paper.withinReach} of them stating a bar you `
              + `already clear.${when} A house that has to advertise is telling you something `
              + 'true about itself, and the bar on the paper is the real bar.'
            : `${sheets} up on the wall here, none of them pitched at anybody standing where you `
              + `are.${when} Reading it costs nothing and it is where the names of houses come `
              + 'from.'));
    }

    // ── THE COUNTER, WHERE THERE IS ONE ───────────────────────────────────
    //
    // Two provinces in five have one and three have none, so this is false
    // almost everywhere and its being true is the whole of what it says. A
    // capability nobody can find out about is a capability nobody has, and
    // this one had no route to the player at all: a passage counter is not a
    // thing anybody guesses at, and the board is free to read.
    if (spanCounterHere) {
        add(inTheSquare(SAY.passage, 'open',
            'The Measured Span keeps a counter here. There is a board with what runs from it, '
            + 'what each costs and when it goes, and reading it costs nothing - which is how '
            + 'somebody who has never left their province finds out there are others.'));
    }

    // ── WHAT THE BOARD IS ASKING FOR, AT THIS RUNG ────────────────────────
    //
    // Gated on the count and not on membership. The old gate was
    // `!inASect && practisesAMethod`, which got it wrong at both ends: a
    // member - the person the entire mission board exists for - was never once
    // offered it, and a nobody standing in front of an empty wall was offered
    // a sentence whose honest answer is "you belong to nothing, so there is no
    // wall". A suggestion that refuses when it is taken up teaches the player
    // not to trust the row, and in a mouse-only turn it is a dead end rather
    // than an annoyance.
    //
    // And this is one of the two places the row moves as the player CLIMBS.
    // The catalog bands every commission by ordinal, so what is going changes
    // under somebody who has not moved an inch.
    if (!here.aboveTheLid && dutiesGoing > 0) {
        add(inTheSquare(SAY.duties, 'open',
            `${dutiesGoing} thing${dutiesGoing === 1 ? '' : 's'} on the wall `
            + `${dutiesGoing === 1 ? 'is' : 'are'} being put to somebody at your rung, with `
            + 'what each pays. Work that is asked for by name is worth more than work you go '
            + 'looking for.'));
    }

    // ── AND SOMEBODY IS STANDING RIGHT THERE ──────────────────────────────
    //
    // The other half of the Wheatgate miss: a Stone-Shell Tortoise in Human
    // Form was in the square at ordinal 29 and nothing offered looking at it.
    // `who is here` was on the floor below, where it was outranked forever by
    // three evergreen reads - so the most place-specific fact in the game, a
    // person within arm's reach, lost to a sentence that is true in every
    // square in the world.
    //
    // A COUNT AND NEVER A NAME. Seeing somebody is not knowing them, and the
    // read this points at is the one that decides how much of a face a player
    // has earned.
    if (!here.aboveTheLid && peopleHere > 0) {
        add(inTheSquare(SAY.room, 'open',
            `${peopleHere} ${peopleHere === 1 ? 'person is' : 'people are'} standing `
            + 'here with you. What they are and how far above you they stand is a look, and it '
            + 'costs nothing; what any of them would do about you is a sentence with their name '
            + 'in it.'));
    }

    // ── AND A PILL NOBODY SWALLOWED ───────────────────────────────────────
    //
    // The purchase that does nothing until it is taken, and the one a player
    // reliably carries through the exact crossing it was bought for. Folded
    // into the pouch read rather than given a line of its own, because naming
    // one pill would be picking which, and the pouch says all of them.
    if (!here.aboveTheLid && pillsCarried > 0) {
        add(at(SAY.inventory, 'open',
            `${pillsCarried} pill${pillsCarried === 1 ? '' : 's'} in the pouch that `
            + `${pillsCarried === 1 ? 'has' : 'have'} not been swallowed. A pill bought and `
            + 'never taken does nothing at all, and a breakthrough pill has to go down BEFORE '
            + 'the attempt for the attempt to know about it.'));
    }

    // ── the floor ─────────────────────────────────────────────────────────
    //
    // Always present, always free, and never a wall of text because everything
    // above is deduped over the top of it. These are the ones a player who has
    // just arrived should learn first: why nothing is moving, where else there
    // is, who is standing here, and what the world is doing.
    //
    // MARKED `always`, WHICH IS WHAT KEEPS THEM UNDERNEATH. They are true in
    // every square in the world on every day of a life, so a row that leads
    // with them is a row that says nothing - which is exactly what was
    // reported. They are the answer to `help` and the tail of the row, not its
    // head.
    add(always(SAY.ceiling, 'Every gate on your progress, named, in the order they bind.'));
    add(always(SAY.destinations, 'Where you could go from here, and what the ground is like there.'));
    // Only once somebody has actually been told about one. Understanding is
    // drawn from what a cultivator is exposed to rather than from what they
    // accumulate, and this is the one line that points at the exposure - but
    // offering it to somebody holding no records would tell them such places
    // exist, which is a discovery the world is supposed to hand over.
    if (here.groundThatTeachesARoad > 0) {
        add(inTheSquare(SAY.roads, 'open',
            `${here.groundThatTeachesARoad === 1 ? 'One thing' : here.groundThatTeachesARoad + ' things'} `
            + 'within your reach '
            + `${here.groundThatTeachesARoad === 1 ? 'is' : 'are'} ground a road can be walked on `
            + 'or something that carries one. Whether any of it will say anything to you is a '
            + 'different question.'));
    }
    // The other half of the ground, and the one nobody finds on their own.
    //
    // Foraging is offered above whenever somebody is hungry or broke, and it
    // was the only sentence in the game that pointed at the world outside a
    // settlement. So a player learnt that herbs exist and never learnt that
    // beasts do - which was literally true rather than a discovery problem,
    // because until the hunt verb existed the catalog had no reader. It is on
    // the floor rather than gated on hunger because it is the answer to "what
    // is there to DO", not to "how do I eat this month".
    add(always(SAY.hunt,
        'What is out on the ground here that is worth killing, what is out there that would '
        + 'kill you, and what either of them is carrying.'));
    if (!here.aboveTheLid) {
        add(always(SAY.room, 'Who is standing here, and how far above you they are.'));
        add(always(SAY.news,
            'What the people here say is happening elsewhere. Some of it will be wrong.'));
        if (here.sellableGoods > 0) {
            add(at(SAY.inventory, 'open', 'What is in the pouch, and roughly what it is worth.'));
        }
    }

    return dedupe(out);
}

/**
 * One line per verb, keeping the most urgent occurrence, most pressing first.
 *
 * Two rules can surface the same sentence - a starving cultivator with a thin
 * purse reaches `I look for work` twice - and the same sentence twice on one
 * screen reads as a bug. The FIRST reason wins at equal urgency, because the
 * rules are written in the order they bind. A reason about the square beats one
 * about the body at equal urgency for the same verb, and both beat the floor,
 * because the more specific reason is the one that says why it is live NOW.
 *
 * ── The second sort key, and why the first one was not enough ────────────
 *
 * Urgency alone produced the row the design owner called way too basic. Across
 * a fresh run, several turns and two locations it offered the same three every
 * time - `who can teach me`, `what arts can I learn`, `what sects are there` -
 * because those three fire off one condition that holds for the entire opening
 * of the game, they were all at the same band, and the client shows the top of
 * this list. Nothing that was actually happening could get above them: not two
 * houses holding intakes in the square, not somebody standing an arm's length
 * away, not a counter selling passage out of the province.
 *
 * So inside each band the square comes first, then the body, then the floor.
 * That is the ordering the owner asked for in as many words - what is urgent,
 * then what is here and will not be here later, then what merely remains
 * possible - and it is what makes a button's ARRIVAL mean something, which is
 * how a player learns a verb exists at all.
 *
 * A two-valued version of this was written first and measured, and it did not
 * fix the reported case: separating gated lines from the floor left all three
 * road reads tied with the wall and the square, so they went on filling the
 * row. It is the here-against-you distinction that does the work.
 */
const ABOUT_ORDER: Record<Affordance['whatItIsAbout'], number> = { here: 0, you: 1, always: 2 };

function dedupe(all: readonly Affordance[]): Affordance[] {
    const rank = (a: Affordance): number =>
        URGENCY_ORDER[a.urgency] * 3 + ABOUT_ORDER[a.whatItIsAbout];
    const best = new Map<string, Affordance>();
    for (const a of all) {
        const held = best.get(a.id);
        if (!held || rank(a) < rank(held)) best.set(a.id, a);
    }
    return [...best.values()]
        .sort((a, b) => rank(a) - rank(b))
        .slice(0, MOST_A_PLAYER_SHOULD_READ);
}

/**
 * The two or three most pressing, for a place that has room for two or three.
 *
 * The refusal and the situation panel both want a short list rather than the
 * whole read, and they must want the same short list, or a player is shown one
 * set of options by the panel and a different set by the game a moment later.
 */
export function theMostPressing(all: readonly Affordance[], count: number): Affordance[] {
    return all.slice(0, Math.max(0, count));
}

/**
 * The whole read, as the lines `facts.ts` carries.
 *
 * Rendered here rather than in `facts.ts` because the shape is this module's
 * business and nothing else composes it. Each line is the sentence to type and
 * the reason it is live, in that order, because the sentence is the part a
 * player is going to copy and the reason is the part that teaches them why.
 */
export function linesFor(all: readonly Affordance[]): string[] {
    return all.map(a => `"${a.say}" - ${a.because}`);
}
