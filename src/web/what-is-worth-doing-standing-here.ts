/**
 * What kinds of thing are live for THIS cultivator, in THIS state, right now.
 */

import {
    AMBIENT_QI_RATE_MULTIPLIER,
    STARVATION_TURNS,
    type AmbientQi
} from '../schema/cultivation.js';
import {
    SAY_TO_BREAK_OFF,
    SAY_TO_GUARD,
    SAY_TO_KEEP_SWINGING,
    SAY_TO_PRESS,
    SAY_TO_SHOUT
} from './fight-answers.js';
import { rankName } from '../engine/cultivation/realms.js';
import { whatToSayAboutTheCure, type TheCure } from './what-would-close-this-wound.js';

/**
 * Somebody asking what there is to do at all.
 */
/**
 * Somebody stepping outside the fiction to ask what there is to do.
 */
export const ASKING_WHAT_IS_POSSIBLE =
    /^\s*(?:\/)?(?:.*[.?!]\s+)?(?:help|help me|halp|\\?|what (?:can|could|might) i do(?: (?:here|now|next))?|what (?:can|could) i (?:say|type|try)|what (?:do|should) i do(?: (?:here|now|next))?|what now|what next|what are (?:my|the) (?:options|choices)|what(?:'s| is) (?:my|the) (?:options|choices)|my options|i (?:don'?t|do not) know what to do|what commands are there|what are the commands|how do i play|what is there to do(?: here)?|what can be done(?: here)?|where (?:should|do|would|can) i (?:start|begin)(?: (?:here|now))?|(?:how|where) do i (?:get )?start(?:ed)?(?: (?:here|now))?|where do i go from here|what(?:'s| is)? worth doing(?: (?:here|now))?|what should i be doing(?: (?:here|now))?|i have no idea what i(?:'m| am) doing|i(?:'ve| have) no idea what i(?:'m| am) doing)\s*[.?!]*\s*$/i;

/**
 * A BARE ask after options, with nothing in it about a book.
 */
export const ABOUT_A_MANUAL =
    /\b(?:manual|book|art|arts|technique|techniques|method|methods|scripture|canon|volume|ceiling|wall|further|cap|road)\b/i;

/**
 * How pressing this is. Ordering only - never a gate, and never a recommendation
 * the engine is prepared to defend.
 */
export type Urgency = 'now' | 'soon' | 'open';

const URGENCY_ORDER: Record<Urgency, number> = { now: 0, soon: 1, open: 2 };

/** One thing that is live standing here. */
export interface Affordance {
    /**
     * What made it live: this square, this cultivator, or nothing at all.
     */
    whatItIsAbout: 'here' | 'you' | 'always';
    /**
     * Stable key. Used to dedupe when two conditions surface the same verb,
     * and it is what a test asserts against rather than the prose.
     */
    id: string;
    /**
     * The sentence to type, verbatim.
     */
    say: string;
    /**
     * Which engine action `say` routes to. Carried so the test can assert the
     * pairing, and so a reader of a log can see what was being offered.
     */
    routesTo: string;
    /**
     * Why it is live, in one clause, drawn from the state that made it live.
     */
    because: string;
    urgency: Urgency;
    /**
     * The sentence has a name in it that came out of the world.
     */
    namesSomething: boolean;
    /**
     * Whether taking this up can end badly for the person who takes it.
     */
    canHurtYou: boolean;
}

/**
 * Everything this module needs to know, as scalars the caller has already computed
 * for other purposes.
 */
export interface StandingHere {
    /**
     * Somebody who has just knelt to this cultivator and is still in the room.
     */
    yielding?: { name: string } | null;
    // FIVE OF THESE ARE OPTIONAL, AND IT IS TEMPORARY
    /** 0-100, as the schema defines it. Carried for the operator line only. */
    satiety: number;
    /** Consecutive turns spent at zero. Non-zero means the body is paying. */
    starvationTurns: number;
    /**
     * How long is left, from `turnsUntilStarvation` and nothing else.
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
     */
    woundsPastMortalCare: number;
    /**
     * The medicine that would close the worst untreated wound, named and priced, or
     * null when nothing is torn.
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
     */
    pillsCarried?: number;
    /** People standing here, right now, at a higher rung than this cultivator. */
    peopleAboveHere: number;
    /**
     * People standing here at all, whatever rung they are at.
     */
    peopleHere?: number;
    /**
     * People standing here who would part with something they are holding.
     */
    peopleHereWithSomethingToSell?: number;
    /**
     * The band underfoot, as a surveyor would write it down.
     */
    ambient: AmbientQi;
    /**
     * People standing here whose names this cultivator already holds.
     */
    peopleHereByName: readonly {
        name: string;
        realmOrdinal: number;
        /** Above this cultivator on the ladder. The caller compares. */
        standsAbove: boolean;
        /** How far above or below, in rungs. Signed, and a look would say it. */
        rungsApart: number;
    }[];
    /**
     * Places this cultivator could set out for whose ground beats the ground they
     * are standing on, best band first.
     */
    thickerGroundWithinReach: readonly {
        name: string;
        ambient: AmbientQi;
        /** Days, from the province's own `connections`. Null where unpriced. */
        travelDays: number | null;
    }[];
    /**
     * What people standing here would let go of, named and priced.
     */
    goodsOnOfferHere: readonly { name: string; askStones: number }[];
    /**
     * The dao ground under their feet, by name, when they are standing on one.
     */
    roadUnderfoot: string | null;
    /**
     * Ground somebody told them about that can be opened, and what it costs.
     */
    sitesYouCouldOpen: readonly {
        name: string;
        /** The rung the ground is set at. `access.floorOrdinal`. */
        setAtOrdinal: number;
        /**
         * Whether this body would come back out, from the site's own
         * `readAdmission` at this rung - which splits being LET IN from
         * surviving it, and the distinction is the whole point.
         */
        survivable: boolean;
    }[];
    /**
     * Nobody holds the ground under them, on the register's own reading.
     */
    groundIsUnheld: boolean;
    /**
     * Ground this cultivator can point at where a road can be walked, plus the
     * things bound to them that carry one.
     */
    groundThatTeachesARoad: number;
    /**
     * The paper nailed up where this cultivator is standing.
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
     */
    spanCounterHere?: boolean;
    /**
     * Commission work the board would actually put to somebody at this rung.
     */
    dutiesGoing?: number;
    /**
     * Past the Lid, where none of the mortal-world lines apply at all.
     */
    aboveTheLid: boolean;
    /**
     * A seclusion the engine stopped and has not resolved, waiting on an answer.
     */
    brokenSeclusion: { daysRemaining: number; canWithdraw: boolean } | null;
    /**
     * A fight that is happening right now, and has not finished.
     */
    fight: {
        /** Who is hitting you. Named because they are swinging at you. */
        them: string;
        yourHp: number;
        yourMaxHp: number;
        theirHp: number;
        theirMaxHp: number;
        /** Before neither side can finish it. `whereThisFightStands`. */
        roundsLeft: number;
        /**
         * 0..1, the preview roll from `attemptFlight`, rolled on a stream nobody
         * fights from so that LOOKING at the odds cannot move them.
         */
        flightChance: number;
        /**
         * The nearest road out, when the ground has one.
         */
        wayOut: { name: string; days: number } | null;
    } | null;
}

/**
 * How far ahead a problem is worth flagging before it is urgent, as a multiple of
 * the starvation window.
 */
const WARNING_HORIZON = 3;

/**
 * The most lines a single read may hand back.
 */
const MOST_A_PLAYER_SHOULD_READ = 8;

// THE LINES

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
 */
const at = (line: Line, urgency: Urgency, because: string): Affordance =>
    ({ ...line, urgency, because, whatItIsAbout: 'you', namesSomething: false, canHurtYou: false });

/**
 * A line that fired on a fact about the square they are standing in.
 */
const inTheSquare = (line: Line, urgency: Urgency, because: string): Affordance =>
    ({ ...line, urgency, because, whatItIsAbout: 'here', namesSomething: false, canHurtYou: false });

/**
 * A line built around a name the world actually holds.
 */
const naming = (
    id: string,
    say: string,
    routesTo: string,
    urgency: Urgency,
    because: string,
    /**
     * Overridden only where a named thing is NOT a fact about this square.
     */
    about: Affordance['whatItIsAbout'] = 'here'
): Affordance =>
    ({ id, say, routesTo, urgency, because, whatItIsAbout: about, namesSomething: true, canHurtYou: false });

/**
 * A line that is true of everybody, everywhere, forever.
 */
/**
 * A line that answers the SITUATION rather than the square.
 */
const situation = (
    id: string,
    say: string,
    answers: string,
    because: string
): Affordance =>
    ({ id, say, routesTo: answers, urgency: 'now', because,
        whatItIsAbout: 'here', namesSomething: false, canHurtYou: true });

const always = (line: Line, because: string): Affordance =>
    ({ ...line, urgency: 'open', because, whatItIsAbout: 'always', namesSomething: false, canHurtYou: false });

/**
 * What a band is worth against ordinary ground, in words, from the one table.
 */
function whatTheGroundIsWorth(band: AmbientQi): string {
    const rate = AMBIENT_QI_RATE_MULTIPLIER[band];
    const named = band.replace(/_/g, ' ');
    if (rate === 1) return `${named} qi, ordinary rate`;
    return `${named} qi, ${rate}x the rate of ordinary ground`;
}

/**
 * What is worth doing standing here, most pressing first.
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

    // A FIGHT IS HAPPENING, AND NOTHING ELSE IS THE SUBJECT
    if (here.fight) {
        const f = here.fight;
        const odds = `${Math.round(f.flightChance * 100)}%`;
        const standing =
            `You are on ${f.yourHp} of ${f.yourMaxHp}; ${f.them} is on ${f.theirHp} of `
            + `${f.theirMaxHp}, with ${f.roundsLeft} round${f.roundsLeft === 1 ? '' : 's'} `
            + 'before neither of you can finish it.';

        // THE WAY OUT, WITH ITS PRICE ON IT, FIRST
        add(f.wayOut
            ? naming('fight_break_off', `${SAY_TO_BREAK_OFF} toward ${f.wayOut.name}`,
                'break_off', 'now',
                `${standing} Breaking off comes off at ${odds}, and turning your back costs `
                + `something either way. ${f.wayOut.name} is ${f.wayOut.days} `
                + `day${f.wayOut.days === 1 ? '' : 's'} out and is the nearest road from here.`)
            : situation('fight_break_off', SAY_TO_BREAK_OFF, 'break_off',
                `${standing} Breaking off comes off at ${odds}, and turning your back costs `
                + 'something either way. Nothing here is a road, so it is away from them and '
                + 'that is all you know.'));

        // The ordinary round, and what happens anyway when nobody chose - so it
        // is on the row rather than assumed, because a player who does not know
        // the other four exist has been given one option and told it is a turn.
        add(situation('fight_strike', SAY_TO_KEEP_SWINGING, 'strike',
            `${standing} This is the round that happens if you say nothing the fight `
            + 'has an answer for.'));

        add(situation('fight_guard', SAY_TO_GUARD, 'guard',
            'Spend the round on not being hit rather than on hitting. It buys a round '
            + 'off the budget and it does not end anything, which is the point when what you '
            + 'are waiting for is somebody arriving.'));

        add(situation('fight_press', SAY_TO_PRESS, 'press',
            'Wear what is coming so that what you are throwing lands. The genre\'s own '
            + 'move, and it is the one that trades your remaining rounds for their remaining '
            + 'body.'));

        add(situation('fight_shout', SAY_TO_SHOUT, 'call_for_help',
            'Spend the round on a shout. Who comes is a fact about who is standing '
            + 'here and not about how loud you are, so this is worth a round where there are '
            + 'people and worth nothing where there are not.'));

        // RETURNS. Everything below is about a square or a body, and neither is
        // what is happening. `dedupe` still runs, so the cap and the ordering
        // are the same machinery as every other row.
        return dedupe(out);
    }

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

    // a question the engine left open, which expires this turn
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

        // Money, and the two ways to get it that need nothing but a back. Offered
        // whenever food is close and the purse will not cover it, which is the
        // exact corner the run that found this died in. Gated on hunger and not on
        // a bare empty purse. A fed cultivator with no stones is not in trouble
        // yet, and telling them "the purse will not buy a meal" while they are full
        // is both untrue-feeling and, worse, it takes the WORK line's reason away
        // from whatever is actually pressing - a cure they cannot afford, most of
        // all.
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

        // -- somebody on their knees ---------------------------------------
        if (here.yielding) {
            add({
                id: 'hand_over',
                say: `I make ${here.yielding.name} hand over what they carry`,
                routesTo: 'coerce',
                urgency: 'now',
                because:
                    `${here.yielding.name} has yielded and is still standing there. `
                    + 'Somebody who has just knelt can be made to turn out what they are '
                    + 'carrying, and the room stops allowing it the moment they are up.',
                whatItIsAbout: 'here',
                namesSomething: true,
                canHurtYou: true
            });
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
        // the medicine, BY NAME
        if (here.cure != null && here.woundsPastMortalCare > 0) {
            const cure = here.cure;
            if (cure.stones !== null) {
                add({
                    id: 'medicine',
                    say: `I buy a ${cure.name}`,
                    routesTo: 'buy',
                    urgency: cure.affordable ? 'now' : 'soon',
                    because: whatToSayAboutTheCure(cure),
                    // About the BODY and not the square - a torn meridian
                    // travels - and it was the only named sentence in this file
                    // for as long as this file has existed. `naming` cannot
                    // build it for that reason: that helper is for the square.
                    whatItIsAbout: 'you',
                    namesSomething: true,
                    canHurtYou: false
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

    // the road, which is what the run is actually about
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

    // THE GROUND UNDERFOOT, NAMED AND PRICED
    const rateHere = AMBIENT_QI_RATE_MULTIPLIER[here.ambient];
    const somewhereBetter = here.thickerGroundWithinReach[0] ?? null;
    // The generic road out, and ONLY where the named one below cannot be built.
    // Played on thin ground with a better town two days off, the row carried
    // "I travel to Grain Rain" and "where can I go" side by side - the same
    // advice twice, one slot of five each, out of a row whose whole complaint
    // was that it wasted its slots on categories.
    if (!here.aboveTheLid && rateHere < 1 && somewhereBetter === null) {
        add(inTheSquare(SAY.destinations, 'soon',
            `The ground here is ${whatTheGroundIsWorth(here.ambient)}, and a penalty at the `
            + 'bottleneck on top. Ground is the largest multiplier a cultivator with no money '
            + 'can change, and you have no name yet for anywhere better.'));
    }
    if (!here.aboveTheLid && rateHere > 1) {
        // `soon` for a tide and `open` for a vein, because that is the honest
        // difference and not a nudge: a spirit tide is a season turning over
        // and it stops, so the years are genuinely leaving. Dense ground will
        // be dense next decade, and calling it pressing would be this file
        // recommending something, which is the one thing urgency may not do.
        add(inTheSquare(SAY.cultivate, here.ambient === 'spirit_tide' ? 'soon' : 'open',
            `The ground here is ${whatTheGroundIsWorth(here.ambient)}. That is the same year `
            + 'spent as anywhere else and a different amount of it arriving, and it is the one '
            + 'multiplier you are standing in rather than paying for.'
            + (here.ambient === 'spirit_tide'
                ? ' A tide is a season turning over and it will stop.'
                : '')));
    }

    // AND SOMEWHERE BETTER THAT YOU CAN ALREADY POINT AT
    if (!here.aboveTheLid && somewhereBetter !== null) {
        const best = somewhereBetter;
        const gain = AMBIENT_QI_RATE_MULTIPLIER[best.ambient] / rateHere;
        const walk = best.travelDays === null
            ? 'The catalog prices no road to it, which means it is inside this province.'
            : `It is ${best.travelDays} day${best.travelDays === 1 ? '' : 's'} off.`;
        add(naming('better_ground', `I travel to ${best.name}`, 'move',
            rateHere < 1 ? 'soon' : 'open',
            `${best.name} is ${whatTheGroundIsWorth(best.ambient)} against `
            + `${whatTheGroundIsWorth(here.ambient)} here - ${gain.toFixed(1)}x what this square `
            + `gives back for the same year. ${walk}`));
    }

    // GROUND THAT CAN BE OPENED, INCLUDING WHEN IT WOULD KILL YOU
    if (here.sitesYouCouldOpen.length > 0) {
        const within = here.sitesYouCouldOpen.filter(s => s.survivable);
        const site = within[0] ?? here.sitesYouCouldOpen[0];
        const toldNotStood =
            ' You were told about it rather than brought to it, and the record does not say '
            + 'where it stands - so this is a road you are choosing, not a door you are '
            + 'standing in front of.';
        add(naming('enter_site', `I go into ${site.name}`, 'site',
            site.survivable ? 'soon' : 'open',
            !site.survivable
                ? `${site.name} is pitched at ${rankName(site.setAtOrdinal)} and you are not `
                  + 'there yet. You can walk in anyway; the ground does not check, it asks the '
                  + 'body for what the ground is set at. This is a thing to aim at rather than '
                  + `a door that says no.${toldNotStood}`
                : `${site.name} is pitched at ${rankName(site.setAtOrdinal)}, which your body reaches. `
                  + 'What is behind a gate is what somebody was buried with, and going in is '
                  + `the only way to find out which kind of ground this is.${toldNotStood}`,
            // NOT 'here'. See the builder: this is a fact about what somebody
            // told you, it travels with you, and marking it as a fact about
            // the square made it identical in all 68 of them.
            'you'));
    }

    // AND WHAT NOBODY HERE WOULD STOP YOU DOING
    if (!here.aboveTheLid && here.groundIsUnheld && here.peopleHereByName.length > 0) {
        // The shallowest person below, on the same reasoning the teaching ask
        // uses from the other direction: the one this could go any way with.
        const below = here.peopleHereByName.filter(p => !p.standsAbove);
        const mark = below.length > 0 ? below[below.length - 1] : null;
        if (mark) {
            add(naming('take_from_somebody', `I rob ${mark.name}`, 'interact', 'open',
                'Nobody\'s name is against this ground, so there is nobody to take a wrong to - '
                + `and that runs both ways. ${mark.name} stands ${mark.rungsApart} `
                + `rung${mark.rungsApart === 1 ? '' : 's'} below you. What it costs you is not `
                + 'the ground: it is what they do about it afterwards, and who they turn out '
                + 'to know.'));
        }
    }

    if (here.peopleAboveHere > 0 && !here.aboveTheLid) {
        // AND THE SENTENCE AFTER THE READ
        add(inTheSquare(SAY.teacher, 'open',
            `${here.peopleAboveHere} ${here.peopleAboveHere === 1 ? 'person' : 'people'} standing `
            + 'here are further up the ladder than you. Putting it to one of them by name - '
            + '"ask <them> to teach me", "ask <them> to introduce me to <somebody>" - is a '
            + 'different sentence from this one, and it has an outcome. A stranger will '
            + 'usually say no; "buy <them> a drink" or "sit with <them>" costs a day and no '
            + 'stones, and it is what turns a stranger into somebody who might not.'));
    }

    // AND WHEN YOU CAN PUT A NAME TO ONE OF THEM
    if (!here.aboveTheLid && here.peopleHereByName.length > 0) {
        // Deepest first is the caller's order, and the deepest person present
        // is the one worth a look: the standing you cannot read off a name is
        // what a look is for.
        const notable = here.peopleHereByName[0];
        add(naming('look_at_somebody', `I look at ${notable.name}`, 'investigate', 'open',
            `${notable.name} is standing here. What they are carrying, how far above or below `
            + 'you they stand and what their own record makes them is a look, and it costs '
            + 'nothing.'));

        // The SHALLOWEST person still above them, and that is on purpose. The
        // deepest is the one worth looking at and the worst one to ask: a stranger
        // twenty rungs up has no reason to hear you out, and somebody two rungs up
        // is the ask that can land. `whoWouldTeach` sorts its own named rows the
        // same way and for the same reason.
        const above = here.peopleHereByName.filter(p => p.standsAbove);
        const teacher = above.length > 0 ? above[above.length - 1] : null;
        if (teacher) {
            const stuck = !here.practisesAMethod || here.methodExhausted;
            add(naming('ask_to_teach', `I ask ${teacher.name} to teach me`, 'request',
                stuck ? 'soon' : 'open',
                `${teacher.name} is standing here, ${teacher.rungsApart} `
                + `rung${teacher.rungsApart === 1 ? '' : 's'} above you. Nothing on the record `
                + 'marks them a teacher, so this is an ask rather than an arrangement, and a '
                + 'stranger usually says no. '
                + (stuck
                    ? 'Nothing is accumulating for you at present, which is what makes being '
                      + 'taught the difference rather than an improvement.'
                    : 'Being taught reaches past what a book gives, and what it costs them is '
                      + 'the part they would tell you about.')));
        }
    }

    // WHAT THIS PLACE IS ASKING FOR THINGS
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

        // AND WHAT ONE OF THEM IS ACTUALLY HOLDING
        const affordable = here.goodsOnOfferHere.filter(g => g.askStones <= here.spiritStones);
        const pick = affordable[0] ?? here.goodsOnOfferHere[0];
        if (pick) {
            const covered = pick.askStones <= here.spiritStones;
            add(naming('buy_on_offer', `I buy a ${pick.name}`, 'buy', 'open',
                `Somebody standing here would let a copy of ${pick.name} go for `
                + `${pick.askStones} spirit stone${pick.askStones === 1 ? '' : 's'}, and the `
                + `purse holds ${here.spiritStones}. `
                + (covered
                    ? 'What a person asks and what a stall asks are different numbers, and the '
                      + 'reason they are selling is a thing a stall cannot have.'
                    : 'That is short, which makes it a figure to work towards rather than a '
                      + 'refusal - and the ask moves with what they need.')));
        }
    }

    // WHAT IS NAILED UP HERE, AND WHEN IT STOPS BEING TRUE
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

    // THE COUNTER, WHERE THERE IS ONE
    if (spanCounterHere) {
        add(inTheSquare(SAY.passage, 'open',
            'The Measured Span keeps a counter here. There is a board with what runs from it, '
            + 'what each costs and when it goes, and reading it costs nothing - which is how '
            + 'somebody who has never left their province finds out there are others.'));
    }

    // WHAT THE BOARD IS ASKING FOR, AT THIS RUNG
    if (!here.aboveTheLid && dutiesGoing > 0) {
        add(inTheSquare(SAY.duties, 'open',
            `${dutiesGoing} thing${dutiesGoing === 1 ? '' : 's'} on the wall `
            + `${dutiesGoing === 1 ? 'is' : 'are'} being put to somebody at your rung, with `
            + 'what each pays. Work that is asked for by name is worth more than work you go '
            + 'looking for.'));
    }

    // AND SOMEBODY IS STANDING RIGHT THERE
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

    // the floor
    add(always(SAY.ceiling, 'Every gate on your progress, named, in the order they bind.'));
    add(always(SAY.destinations, 'Where you could go from here, and what the ground is like there.'));
    // Only once somebody has actually been told about one. Understanding is
    // drawn from what a cultivator is exposed to rather than from what they
    // accumulate, and this is the one line that points at the exposure - but
    // offering it to somebody holding no records would tell them such places
    // exist, which is a discovery the world is supposed to hand over.
    if (here.groundThatTeachesARoad > 0) {
        // AND WHEN ONE OF THEM IS UNDER YOUR FEET, SAY WHICH
        add(here.roadUnderfoot !== null
            ? naming('roads', SAY.roads.say, SAY.roads.routesTo, 'open',
                `You are standing on ${here.roadUnderfoot}, which is ground a road can be `
                + 'walked on rather than ground that is merely thick. Understanding comes from '
                + 'what you are exposed to; whether it will say anything to you is a different '
                + 'question, and the read is free.')
            : inTheSquare(SAY.roads, 'open',
                `${here.groundThatTeachesARoad === 1 ? 'One thing' : here.groundThatTeachesARoad + ' things'} `
                + 'within your reach '
                + `${here.groundThatTeachesARoad === 1 ? 'is' : 'are'} ground a road can be walked on `
                + 'or something that carries one. Whether any of it will say anything to you is a '
                + 'different question.'));
    }
    // The other half of the ground, and the one nobody finds on their own.
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
 */
const ABOUT_ORDER: Record<Affordance['whatItIsAbout'], number> = { here: 0, you: 1, always: 2 };

/**
 * The third key: a sentence with a name in it beats the category above it.
 */
function dedupe(all: readonly Affordance[]): Affordance[] {
    const rank = (a: Affordance): number =>
        URGENCY_ORDER[a.urgency] * 6
        + ABOUT_ORDER[a.whatItIsAbout] * 2
        + (a.namesSomething ? 0 : 1);
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
 */
export function theMostPressing(all: readonly Affordance[], count: number): Affordance[] {
    return all.slice(0, Math.max(0, count));
}

/**
 * The whole read, as the lines `facts.ts` carries.
 */
export function linesFor(all: readonly Affordance[]): string[] {
    return all.map(a => `"${a.say}" - ${a.because}`);
}
