/**
 * ONE MOTIVATION MODEL. A NEED IS A LEVER IN AN ASK AND A PRICE IN A TRADE.
 *
 * Ruled by the design owner, and the ruling is that these are the same fact
 * read from two sides rather than two systems:
 *
 *   *"some people are willing to pay more for something (maybe for an injured
 *   son or a chosen) for medicine, or a weapon to help cross the tribulation.
 *   characters have motivations that affect their willingness to pay.
 *   conversely some won't sell at any price because they need it for their
 *   son/daughter/chosen or to recover from an injury that is blocking their
 *   path - for the tracked medicines only."*
 *
 * So an open goal row is a NEED, and a need is simultaneously:
 *
 *   what they want from you       {@link whatTheyWantThatYouCouldReach}, the
 *                                 `wants` term of the attempt resolver
 *   what they will overpay for,   {@link whatTheirNeedDoesToThePriceOf}, the
 *   or not part with at any price same rows seen from the market side
 *
 * Both readings walk the same goal list in the same order and neither has a
 * table of its own. If a motivation ever has to be written twice - once for the
 * asking and once for the trading - the shape is wrong.
 *
 * ── WHY THIS SECOND READING IS NOT `whyNotSold` ──────────────────────────
 *
 * `single-use-dao-comprehension-materials.ts` already enumerates why a HOUSE
 * sits on something: afraid to sell, a rainy day, tribute, a favour not yet
 * spent. That model is explicitly scoped to objects BEYOND their holder - its
 * own comment says *"a holder that could actually USE the thing has no reason
 * here"*, and it returns null the moment the house can reach the band.
 *
 * This is the exact inverse and that is why it is a separate function rather
 * than a fifth member of that enum: **a person holding what they fully intend
 * to use, for somebody specific.** An institution keeping dead capital and a
 * father keeping the pill that will save his son are opposite cases, and
 * folding the second into the first would make `whyNotSold`'s own null test
 * incoherent.
 *
 * ── AND IT IS TRACKED OBJECTS ONLY ───────────────────────────────────────
 *
 * The scope limit is load-bearing. `items.md`'s counted/tracked line is the one
 * that decides: counted stock has a price and no story, and a tracked object
 * has a holder, a provenance and now a reason. A bowl of millet does not have
 * somebody's dying son behind it, and if it did the market would stop working -
 * every fungible price in the world would become a negotiation.
 *
 * `significance` is the switch, because `items.md` says to use it and because
 * adding a second field beside it is how two sources of truth start
 * disagreeing. `mundane` carries no provenance and carries no need either.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WHAT SOMEBODY WANTS, AND WHETHER THE PERSON ASKING IS PART OF THEM GETTING IT.
 *
 * `resolveAttempt` has carried a term called `wants` since it was written -
 * *"true when the subject has an open goal this actor could plausibly move"* -
 * and its own contract says where the answer has to come from:
 *
 *     Must be read off a real goal row, and never off a model's opinion about
 *     what somebody probably wants.
 *
 * It named `openGoalsOf` in `npc-state.ts` as the reader. **There is no such
 * function and there never was.** The rows are read by `activeGoals`, and the
 * missing half was never the reader - it was anything at all that turned a goal
 * row into an answer to "could THIS person move it". So the term has been
 * `false` in every social attempt any player has ever made: a whole term of the
 * resolver, worth as much as the tie, reading zero for the entire life of the
 * verb.
 *
 * A comment naming a function that does not exist is the same defect as a
 * refusal naming a door that does not exist, one layer down, so the resolver's
 * comment now names this file.
 *
 * ── WHAT IT MAY READ, AND WHAT IT MUST NOT ───────────────────────────────
 *
 * Rows only. A goal carries five fields and none of them is psychology - goal,
 * priority, progress, obstacles, deadline - and the obstacles are PROSE written
 * by whoever opened the goal. Nothing here parses them, because a predicate
 * that greps somebody's obstacle text for "no money" is a model's opinion
 * wearing a regex.
 *
 * What it reads instead is four things that are all rows on both sides:
 *
 *   the goal's target      an id, and it may be the asker or the asker's house
 *   the asker's purse      priced against a year of the SUBJECT's earnings
 *   the asker's shelf      art ids, against the art ids the subject holds
 *   the asker's rank       whether they are placed inside a house at all
 *
 * ── WHAT IT DELIBERATELY DOES NOT READ ───────────────────────────────────
 *
 * **The gap in rung.** It is the temptation and it is wrong twice over. The
 * resolver already has a standing term, computed by the module that owns
 * standing, so a second reading of the same fact would be the same lever priced
 * twice - and every ask by anybody standing above anybody would carry it, which
 * makes a term meant to be the lever *"available to a cultivator with nothing"*
 * into one more advantage for the people who already have every other one.
 * `asking.md` is explicit that this is the wrong direction: *"the useful person
 * is often two rungs below the one who actually knows"*.
 *
 * So a nobody with one art on their sheet can carry this term against an elder,
 * and an elder carrying nothing the person in front of them wants cannot.
 *
 * Pure. Rows in, one matched goal or null out. No catalog, no repository, no
 * I/O, no RNG.
 */

import { earningsPerYear } from '../cultivation/origin.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { stagnationYearsForOrdinal } from '../../schema/cultivation.js';
import { activeGoals } from './npc-state.js';
import type { NpcGoal, NpcRecord } from './npc-state.js';
import type { ObjectSignificance } from './possessions.js';

// ─────────────────────────────────────────────────────────────────────────
// THE TWO SIDES
// ─────────────────────────────────────────────────────────────────────────

/**
 * The person being asked, reduced to what deciding this needs.
 *
 * An {@link NpcRecord} satisfies it structurally through {@link goalsHeldBy},
 * and so does a row from a layer that keeps its people some other way - which
 * matters, because the played game's roster is a union of world NPCs and
 * cultivator rows and only the first kind carries goals.
 */
export interface SomebodyWithGoals {
    id: string;
    /** Their rung. Prices what a purse is worth TO THEM, and nothing else. */
    ordinal: number;
    factionId: string | null;
    /** Art ids they already hold. */
    holds: readonly string[];
    /** Open rows only. {@link goalsHeldBy} is the reader for an NPC record. */
    goals: readonly NpcGoal[];
    /**
     * The clocks they are under, for dating their wants.
     *
     * Optional because a caller that only wants the ask side does not need
     * them, and because the played roster is a union of world NPCs and
     * cultivator rows - only the first kind carries a settling clock. Absent
     * means the wants cannot be dated, which reads as "not pressing" and is
     * the honest answer rather than a guess.
     */
    clocks?: TheClocksSomebodyIsUnder | null;
}

/** What the person asking is actually carrying, as rows rather than as rank. */
export interface WhatTheAskerBrings {
    id: string;
    factionId: string | null;
    /** True when they hold a rank inside that house, not merely a badge. */
    ranked: boolean;
    /**
     * Spirit stones in the purse.
     *
     * What they HAVE, not what they have offered. An offer is priced by
     * `purseWeight` in the resolver and is a different term; this is whether
     * they are somebody with money at all, which is what a goal about money
     * cares about.
     */
    spiritStones: number;
    /** Art ids on their sheet. */
    holds: readonly string[];
}

/** Which row said so. Named rather than boolean, so a refusal can say why. */
export type WhyTheyWantIt =
    /** The goal points at the asker by id. Somebody's business IS them. */
    | 'it_is_about_you'
    /** The goal points at the asker's house, or wants one and they have one. */
    | 'your_house'
    /** They want money and the asker is carrying a year of their income. */
    | 'your_purse'
    /** They want to climb and the asker holds a road they do not. */
    | 'your_shelf';

export interface AWantYouCouldReach {
    goal: NpcGoal;
    because: WhyTheyWantIt;
}

// ─────────────────────────────────────────────────────────────────────────
// THE READING
// ─────────────────────────────────────────────────────────────────────────

/**
 * The goal rows an outsider could be part of, highest priority first.
 *
 * `activeGoals` is the reader and this is the name for what it is being used
 * FOR here - open includes `blocked`, deliberately, because a goal one obstacle
 * came off is the case this whole term exists for.
 */
export function goalsHeldBy(npc: NpcRecord): readonly NpcGoal[] {
    return activeGoals(npc);
}

/**
 * Whether the asker is carrying enough for a goal about money to notice.
 *
 * A year of the SUBJECT's earnings, from the curve the world actually runs on.
 * A figure fixed in stones would mean one thing to a farm child and nothing at
 * all to a Core Formation elder, and the whole point of pricing against
 * `earningsPerYear` is that "somebody with money" is a fact about who is being
 * asked.
 */
function carriesRealMoneyToThem(them: SomebodyWithGoals, you: WhatTheAskerBrings): boolean {
    const theirYear = earningsPerYear(Math.max(0, them.ordinal));
    return theirYear > 0 && you.spiritStones >= theirYear;
}

/** An art the asker holds and the person being asked does not. */
function aRoadTheyHaveNot(them: SomebodyWithGoals, you: WhatTheAskerBrings): boolean {
    const theirs = new Set(them.holds);
    return you.holds.some(id => !theirs.has(id));
}

/**
 * The highest-priority open goal this asker is part of, or null.
 *
 * Walked in `activeGoals` order - priority, then age - so somebody who has
 * wanted one thing for forty years is answered with that rather than with
 * whatever they picked up last month.
 *
 * Null is the ordinary answer and must stay easy to reach. Most people want
 * things nobody standing in front of them can do anything about, and a term
 * that fires for everybody is a term that says nothing.
 */
export function whatTheyWantThatYouCouldReach(
    them: SomebodyWithGoals,
    you: WhatTheAskerBrings
): AWantYouCouldReach | null {
    // Nobody is their own lever. A goal about yourself does not make you
    // easier to ask - it makes you the person asking.
    if (them.id === you.id) return null;

    for (const goal of them.goals) {
        // ── IT IS ABOUT YOU ──────────────────────────────────────────────
        //
        // The strongest reading and the one the world actually writes:
        // `openAmbition` opens "stand up to X and not be laughed at" with X on
        // the row, and the player is a row the world can invite. Somebody
        // whose open business is you has a reason to deal with you whatever
        // that business is - a grudge is priced separately and this is not it.
        if (goal.targetId !== null && goal.targetId === you.id) {
            return { goal, because: 'it_is_about_you' };
        }
        if (goal.targetId !== null && you.factionId !== null && goal.targetId === you.factionId) {
            return { goal, because: 'your_house' };
        }

        switch (goal.kind) {
            case 'wealth':
            case 'debt':
                if (carriesRealMoneyToThem(them, you)) {
                    return { goal, because: 'your_purse' };
                }
                break;
            case 'cultivation':
                if (aRoadTheyHaveNot(them, you)) {
                    return { goal, because: 'your_shelf' };
                }
                break;
            case 'status':
                // "Be taken seriously by somebody who matters locally." Being
                // placed inside a house is what makes somebody that, and it is
                // a row rather than a rung - which is why a ranked disciple
                // carries this and a wandering expert does not.
                if (you.ranked && you.factionId !== null && you.factionId !== them.factionId) {
                    return { goal, because: 'your_house' };
                }
                break;
            default:
                break;
        }
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────
// THE SAME NEED, SEEN FROM THE MARKET
//
// Everything below walks the same goal rows the reading above walks, in the
// same order, and asks the other question about them: what does this need do
// to what this person will pay, or refuse.
//
// ── THERE IS NO LIST OF REASONS HERE, AND THERE MUST NEVER BE ────────────
//
// `AGENTS.md`: "what NPCs do is emergent. Never enumerate it. Model what
// somebody wants and let the behaviour fall out. If a new case requires a new
// branch, the shape is wrong."
//
// The design owner's three illustrations - an injured son, a chosen disciple,
// a weapon that would carry somebody through a tribulation - are a MODEL and
// not cases. Every one of them is the same two rows: a person with an open
// want, and a singular object at a height that want is fought at. Nothing here
// knows what a son is. A tenth reason needs no code, only a person with a
// different want, and the sentence a player reads comes from the goal's own
// text, which was written by whoever opened it.
//
// The first draft of this file DID have the list - a table of which goal kinds
// each kind of object could answer - and it is worth saying why that was wrong
// even though it looked like data. It could not have produced a reason nobody
// had thought of, which is the whole thing a motivation model is for.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The object, reduced to the two fields the answer turns on.
 *
 * An `ObjectRecord` satisfies it structurally, and so does a pill row put
 * through `significanceOfPill` and `pillBandOrdinal`. Nothing here reads a
 * name, a kind, an id or a description: a motivation keyed on WHICH object it
 * is would be the bespoke rule `AGENTS.md` forbids, and one keyed on what kind
 * of object it is would be the list this file exists without.
 */
export interface ATrackedThing {
    /**
     * How much bookkeeping it deserves, which is the counted/tracked line.
     *
     * `items.md` says to use this field and to add nothing beside it. A need
     * attaches only above `mundane`, and that limit is load-bearing: counted
     * stock has a price and no story, and a motivation that leaked into it
     * would turn every fungible price in the world into a negotiation.
     */
    significance: ObjectSignificance;
    /** The rung it is for. `power` on an object record; the band for a pill. */
    forOrdinal: number;
}

/**
 * The three things a need does to a price, and the third is the important one.
 *
 * `AGENTS.md`, from the owner's ruling: **a present need is a refusal, and a
 * reserved future need is a price you have not met.** Somebody whose son is
 * dying tonight is not a seller at any figure. Somebody holding medicine
 * against a disciple they may one day take is holding an ASSET, and the right
 * trade moves it - which is what stops "will not sell" being a wall, and is why
 * a refusal here can name the trade that would work.
 */
export type WhatANeedDoesToAPrice =
    | 'pays_above_the_going_rate'
    | 'will_not_part_with_it_at_any_price'
    | 'held_against_a_need_not_yet_come'
    /**
     * THE FOURTH, AND IT IS NOT A NEED AT ALL.
     *
     * `immortal-items.ts` describes it in full and calls it what it is:
     * *"a body that runs an economy is exactly the body that counts a finite
     * irreplaceable stock down to the unit, minutes it, and requires a quorum
     * to touch it... Rank does not help: a Surveyor asking is one voice, and
     * the others can refuse. There is a form for requesting one. It has been
     * submitted. The answer was no."* And then the line that makes this a
     * separate answer rather than a hard version of the others:
     *
     *     That is arithmetic rather than a lever, and there is no version of
     *     the problem where the player finds the right person and applies
     *     enough pressure.
     *
     * A model that could only say "you have not found the price yet" would
     * send somebody after a lever that does not exist, for a run. So this says
     * the other thing, and a player can tell the two apart from the refusal.
     * It is also what keeps the grudge honest: **a wrong requires that the
     * refuser had the discretion to say yes**, and somebody who cannot release
     * one without a quorum is not wronging anybody, however much it costs.
     */
    | 'the_answer_is_not_theirs_to_give';

export interface ANeedAgainstAnObject {
    /**
     * The row it came off. Its `text` is what a refusal should say out loud.
     *
     * Null only for `the_answer_is_not_theirs_to_give`, where there is no want
     * involved and that is the whole of the finding.
     */
    goal: NpcGoal | null;
    effect: WhatANeedDoesToAPrice;
    /**
     * What they would go to, as a multiple of the going rate.
     *
     * Exactly 1 wherever they are not selling, because a refusal is not a price
     * and a caller that reads this as one should get the number that changes
     * nothing. Otherwise read off `priority`, which is a real field with a real
     * range - how badly they want it IS the elasticity, and deriving it from
     * anything else would be a second scale beside the one the row carries.
     */
    multiplier: number;
}

/**
 * The most a need bends a price.
 *
 * A doubling at the top of the range. Past that a needed object stops having a
 * market price at all, and this world already has a mechanism for that - the
 * barter tier in `buying-and-bartering-pills.ts` - which should stay that
 * mechanism's job rather than being reproduced here by a large number.
 */
export const MOST_A_NEED_BENDS_A_PRICE = 2;

/**
 * How far beneath somebody a thing can be made and still answer a need.
 *
 * The same slack `seedPillStock` uses to decide whether a house is working near
 * enough to a band to be holding one, so the two agree about what "for a height
 * like theirs" means. A thing calibrated far below where somebody is standing
 * does not clear what is blocking them, whatever it cost.
 */
export const HOW_FAR_BENEATH_THEM_IT_MAY_BE = 8;

/**
 * How close a deadline has to be before a want is a PRESENT one.
 *
 * A year, and the field it reads is `deadlineOnDay`, which a goal row has
 * carried since it was written for exactly this and which almost nothing has
 * ever read. That is the whole of the present/reserved distinction: a want with
 * a day on it and the day close is somebody's emergency, and a want with no
 * deadline at all is a store put by. Nothing here asks what the want IS.
 */
export const A_NEED_IS_PRESENT_WITHIN_DAYS = 365;

/**
 * AND A GAP FOUND BY PLAYING, WRITTEN DOWN RATHER THAN QUIETLY WORKED AROUND.
 *
 * **Nothing in the world currently writes a deadline onto a goal.** `goalFor`
 * in `seeding.ts` gives every provincial one of five wants and none of them
 * carries a day; `openAmbition` in `gatherings.ts` and the birth goal in
 * `the-world-changing-on-its-own.ts` do not either. `deadlineOnDay` has been on
 * the row since it was written, is documented there as "null for no deadline,
 * which is common", and is written by nobody.
 *
 * So in a played world today every want reads as RESERVED, and the
 * `will_not_part_with_it_at_any_price` arm - somebody whose son is dying
 * tonight - cannot fire from seeded data. The split is correct and one side of
 * it is currently unpopulated.
 *
 * That is a content gap and not a mechanism gap, and it is deliberately not
 * fixed here: deciding which wants in this world come with a day on them is a
 * seeding question with population consequences, and inventing an answer inside
 * a predicate would be the second source of truth this file exists without. The
 * honest sentence is that the engine can express the distinction and the world
 * does not yet make it.
 */

/** Whether an object is the kind of thing a need can attach to at all. */
export function aNeedCanAttachTo(thing: ATrackedThing): boolean {
    return thing.significance !== 'mundane';
}

/**
 * A want an object could be part of, as opposed to one money answers.
 *
 * The single structural exclusion in this file, and it is an exclusion rather
 * than a list on purpose: somebody whose open business is a shortage of spirit
 * stones is served by spirit stones, and handing them a singular object is
 * answering a different question. Everything else falls through - which is what
 * lets a want nobody has written yet work here without a line of code.
 */
function aThingCouldBePartOfIt(goal: NpcGoal): boolean {
    return goal.kind !== 'wealth' && goal.kind !== 'debt';
}

/**
 * What this person's open business does to the price of this object.
 *
 * Null - the going rate stands - is the ordinary answer and must stay so. Most
 * people want things no object in front of them touches, and a model that finds
 * a motive in every transaction has stopped being a motive.
 *
 * `holding` is the whole of the direction. Somebody who HAS the thing their
 * business runs through is not a seller; somebody who has not is a buyer past
 * the going rate. One fact, two signs. And which of the two refusals a holder
 * gives is read off the deadline on the row and off nothing else.
 */
export function whatTheirNeedDoesToThePriceOf(
    them: SomebodyWithGoals,
    thing: ATrackedThing,
    holding: boolean,
    onDay: number,
    /**
     * Whether saying yes was ever theirs to say.
     *
     * False for a holding that takes a quorum, a counted line item, anything
     * held on somebody else's behalf. Checked before any want is read, because
     * where this is false the wants are beside the point - and a caller that
     * left it out gets the ordinary case, which is a person deciding for
     * themselves.
     */
    theAnswerIsTheirsToGive = true,
    /**
     * The clocks of whoever a want points at, when it points at a person.
     *
     * A function rather than a value because a want about a child is dated by
     * the CHILD, and which child that is differs per row. The caller looks the
     * id up in whatever roster it holds; returning null is always safe, and
     * last in the list so every existing call site keeps meaning what it meant.
     */
    theClocksOfWhoeverItIsAbout?: (goal: NpcGoal) => TheClocksSomebodyIsUnder | null
): ANeedAgainstAnObject | null {
    if (!aNeedCanAttachTo(thing)) return null;
    // Arithmetic rather than a lever. Said before the wants are walked,
    // because no want of theirs changes it and no price reaches it.
    if (holding && !theAnswerIsTheirsToGive) {
        return { goal: null, effect: 'the_answer_is_not_theirs_to_give', multiplier: 1 };
    }
    // Made for a height far beneath them. It answers nothing of theirs, and
    // somebody who thinks otherwise is about to be told so.
    if (thing.forOrdinal + HOW_FAR_BENEATH_THEM_IT_MAY_BE < them.ordinal) return null;

    for (const goal of them.goals) {
        if (!aThingCouldBePartOfIt(goal)) continue;

        if (!holding) {
            return {
                goal,
                effect: 'pays_above_the_going_rate',
                multiplier: 1
                    + Math.max(0, Math.min(1, goal.priority)) * (MOST_A_NEED_BENDS_A_PRICE - 1)
            };
        }

        // Derived, never read off the column directly. The column is empty in
        // every world this game has ever generated - see the banner below.
        const pressing = aWantThatCannotWait(
            goal, them.clocks ?? null, theClocksOfWhoeverItIsAbout?.(goal) ?? null, onDay
        );
        return {
            goal,
            effect: pressing
                ? 'will_not_part_with_it_at_any_price'
                : 'held_against_a_need_not_yet_come',
            multiplier: 1
        };
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────
// WHERE A DATE ON A WANT ACTUALLY COMES FROM
//
// ── A FIELD NOTHING WRITES ───────────────────────────────────────────────
//
// The present/reserved split above turns entirely on `deadlineOnDay`, and
// playing the game found that **nothing in this world has ever written one.**
// `goalFor` in `seeding.ts` gives every provincial one of five wants and none
// carries a day. `openAmbition` in `gatherings.ts` does not. The birth goal in
// `the-world-changing-on-its-own.ts` does not. The field has been on the row
// since the row was written, is documented there as "null for no deadline,
// which is common", and is written by nobody at all.
//
// So every want in the world read as RESERVED, every holder was negotiable,
// nobody was ever desperate, and the case the design owner cared about most -
// *my son is dying tonight and you have the medicine* - could not occur. The
// mechanism was correct and there was nothing to drive it.
//
// That is this project's oldest defect wearing a new coat. `AGENTS.md` files
// it as **a module nothing calls**; this is the same failure one size smaller:
// **a field nothing writes.** Worth looking for deliberately, because it reads
// even more like a finished feature than the other one does - the schema is
// right, the predicate is right, the tests pass, and the column is empty.
//
// ── AND THE FIX IS NOT TO GO AND WRITE ONE ───────────────────────────────
//
// A date stamped onto a goal row at seeding is a lie by the second year. The
// holder advances a rung and their settling clock resets; they are healed, or
// wounded, or the person the want was about dies. A stored deadline records
// what was true once and then quietly stops being true, which is worse than
// an empty column because nothing looks wrong.
//
// So nothing here writes the field. The date is DERIVED, at the moment it is
// asked for, from clocks the world already keeps and already moves:
//
//   THE SETTLING CLOCK   `lastAdvancedOnDay` plus the plateau the realm
//                        allows. Past it the climb is over - not the body, the
//                        CLIMB - and `stagnationYearsForOrdinal` is the
//                        world's own statement of how long that is. This is
//                        the clock the setting actually runs on: fifty years at
//                        the bottom, a thousand near the top.
//   THE LIFESPAN CLOCK   `lifespanEndsOnDay`. What a rung buys is time, and
//                        this is the row that says how much is left.
//   SOMEBODY ELSE'S      when the want points AT a person, their two clocks
//                        are the want's clocks. A want about a child is dated
//                        by the child.
//
// The soonest of those is the date. `goal.deadlineOnDay` still wins where
// somebody has authored one, because an authored fact should always beat a
// derived one - that is the only reason the field survives.
//
// ── AND THERE IS NO LIST OF URGENT WANTS ─────────────────────────────────
//
// `AGENTS.md` again: if a tenth kind of urgency needs a branch, the shape is
// wrong. Nothing below asks what the want IS. It asks whose want it is and who
// it is about, and reads their clocks. A want nobody has invented yet, held by
// somebody with four years of plateau left, is urgent here without a line of
// code - and the same want held by somebody who advanced last year is not.
//
// Which is also why every want ends up with a date and only a few are
// pressing. Being dated is ordinary; the date being CLOSE is the event, and
// {@link A_NEED_IS_PRESENT_WITHIN_DAYS} is the one threshold that decides it.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The two clocks a person carries, as absolute days.
 *
 * An `NpcRecord` supplies both directly: `cultivation.lifespanEndsOnDay` and
 * `cultivation.lastAdvancedOnDay` with `realmOrdinal`. Nothing here reads a
 * name, a house or a want.
 */
export interface TheClocksSomebodyIsUnder {
    /** Their rung. Decides how long a plateau the realm allows. */
    ordinal: number;
    /** Absolute day of their most recent advance. The settling clock starts here. */
    lastAdvancedOnDay: number;
    /** Absolute day the body runs out. */
    lifespanEndsOnDay: number;
}

/**
 * The day this person's climb ends if nothing changes.
 *
 * `stagnationYearsForOrdinal` is the authority and is not restated here -
 * `AGENTS.md` is explicit that ladder bounds live in one place and that
 * retyping one is how they go stale.
 */
export function theDayTheClimbRunsOut(who: TheClocksSomebodyIsUnder): number {
    return who.lastAdvancedOnDay
        + stagnationYearsForOrdinal(Math.max(0, who.ordinal)) * DAYS_PER_YEAR;
}

/** The soonest of the clocks somebody is under. */
export function theDaySomethingRunsOutFor(who: TheClocksSomebodyIsUnder): number {
    return Math.min(theDayTheClimbRunsOut(who), who.lifespanEndsOnDay);
}

/**
 * When this want runs out of time, or null where nothing under it is running.
 *
 * An authored date wins. Otherwise the soonest clock belonging to somebody the
 * want is about - its holder, and the person it points at when it points at
 * one. Null only where the caller could supply neither, which is an honest
 * absence rather than a claim that the want is open-ended forever.
 */
export function whenThisWantRunsOut(
    goal: NpcGoal,
    holder: TheClocksSomebodyIsUnder | null,
    /** The clocks of whoever `targetId` names, when it names a person. */
    target: TheClocksSomebodyIsUnder | null = null
): number | null {
    if (goal.deadlineOnDay !== null) return goal.deadlineOnDay;
    const days = [holder, target]
        .filter((who): who is TheClocksSomebodyIsUnder => who !== null)
        .map(theDaySomethingRunsOutFor);
    return days.length === 0 ? null : Math.min(...days);
}

/**
 * Whether this want cannot wait.
 *
 * THE ONE PLACE THE PRESENT/RESERVED QUESTION IS ANSWERED. Every caller reads
 * this rather than testing `deadlineOnDay` for null, which was the test before
 * the field turned out to be empty everywhere and which would now be answering
 * a different question than the one it looks like it answers.
 */
export function aWantThatCannotWait(
    goal: NpcGoal,
    holder: TheClocksSomebodyIsUnder | null,
    target: TheClocksSomebodyIsUnder | null,
    onDay: number
): boolean {
    const runsOut = whenThisWantRunsOut(goal, holder, target);
    return runsOut !== null && runsOut - onDay <= A_NEED_IS_PRESENT_WITHIN_DAYS;
}
