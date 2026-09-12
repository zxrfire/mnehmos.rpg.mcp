/**
 * Thirteen lanes over fifty-six verbs.
 *
 * ── WHAT THIS IS FOR ─────────────────────────────────────────────────────
 *
 * Measured over 744 played turns, three verbs produced 63% of everything the
 * game came back unable to answer: `interact` refused 150 of 162, `move` 20 of
 * 20, `unclear` 186. Against that, every verb carrying an INTENT axis refused
 * nothing at all - `sect` 19/19, `look` 33/33, `status` 36/36, `market`,
 * `teacher`, `ceiling`, `list_techniques`, zero between them.
 *
 * So the reader's difficulty was never the number of verbs. It was being asked
 * to pick one label out of fifty-six flat ones, several of which fit the same
 * sentence. Twenty-one of the fifty-six carry an intent; thirty-five do not,
 * and the thirty-five include the whole read family, which is the part a lost
 * player reaches for most.
 *
 * A lane is the outer choice, and the intent is the inner one. Choosing
 * `consult` and then `what am I carrying` is a question a model can answer;
 * choosing between `inventory`, `status`, `acquisition`, `ceiling` and
 * `list_techniques` is a question about this engine's internals.
 *
 * ── AND THE ENGINE IS UNTOUCHED ──────────────────────────────────────────
 *
 * This is a layer ABOVE the action set, not a replacement for it. Every lane
 * expands to one of the verbs that already exists, resolved by the handler that
 * already serves it. Nothing here decides an outcome, spends a day or reads
 * state. The design owner's ruling: *"the engine still decides but the model is
 * less confused."*
 *
 * That also makes it reversible and measurable. The expansion is a pure
 * function over a table, so a lane that turns out to be the wrong cut is a
 * table edit rather than a migration.
 */

import type { ActionName } from './action-set.js';

/**
 * AN AMBITION IS A READ, NOT AN ACT.
 *
 * A sentence that says what somebody WANTS - to get stronger, to be the
 * strongest, to find a master - names no act, and forcing it onto one is how a
 * player asking where to begin gets told that beginning is impossible. Measured:
 * "I want to get stronger" reached no pattern, the embedding tier guessed
 * `cultivate`, and the no-method gate refused it. All 24 `cultivate` refusals
 * in one probe run were that gate.
 *
 * The engine is still called - the answer comes from state and not from the
 * narrator's imagination - but it is called for a READ. `consult` and `perceive`
 * never refuse, because what you are and what is in front of you are always
 * answerable, and an answer that lists what would work is what a game master
 * gives somebody who has said what they want.
 *
 * So: where a sentence is a wish, a goal, or a question about direction, take
 * the read. Reserve the acting lanes for sentences that name an act.
 */
export const AN_AMBITION_IS_A_READ =
    'AN AMBITION IS A KNOWN GOAL WITH AN UNKNOWN HOW. "I want to get stronger", "I need to '
    + 'find a master", "what should I do" - the player has said where they are going and not '
    + 'what they are doing, so there is no act to take. Take a READ: consult for anything '
    + 'about themselves, perceive for anything in front of them. Never force it onto cultivate '
    + 'or another acting lane - a read always answers and says what would work, while an act '
    + 'they cannot perform yet only tells them no. '
    + 'There is always a call; there is not always an act that burns a turn. '
    + 'BUT A WISH THAT NAMES AN ACT IS THE ACT: "I want to join a sect" is house/join and "I '
    + 'want to buy a manual" is trade/buy. Only a wish with no act in it - stronger, better, '
    + 'somewhere - is a read.';

/**
 * And how the answer is written, which is the other half.
 *
 * The read comes back as a list of what is live, because that is what the
 * engine holds. A list is not what somebody who just said what they want should
 * read back - the design owner's shape for it is the character turning it over:
 * *"I want to get stronger, you think"*, and then the two or three things they
 * already know of that would serve.
 */
export const AN_AMBITION_IS_ANSWERED_AS_THINKING =
    'WHERE THE FACTS ARE WHAT IS LIVE FOR THIS CULTIVATOR, the player has said what they want '
    + 'and not what they are doing. Write it as the character turning it over - the want, then '
    + 'the two or three things they know of that would serve it, weighed the way somebody '
    + 'weighs them. Not a menu, not numbered, and never the arithmetic the engine used to '
    + 'decide - that is its reasoning and must not appear. Nothing has happened '
    + 'this turn and no time has passed, so do not write them setting off. '
    + 'ANSWER THE HOW, FROM WHERE THEY ARE STANDING. A want is not refused and it is not '
    + 'granted: it is answered with the next thing that would actually serve it, named and '
    + 'concrete - the gate that is right there, the elder who could be approached, the paper '
    + 'on the wall with a date on it. '
    + 'AND IT MAY BE WRY. Somebody wishing to join a house while standing at its gate is funny, '
    + 'and this genre says so rather than pretending not to notice. Let the character notice. '
    + 'The humour is theirs and never the narrator winking over their shoulder.';

/**
 * WHERE TWO READINGS FIT, TAKE THE ONE THAT ANSWERS.
 *
 * A sentence that can be read two ways should be read as the simpler case, not
 * the edge case - so long as the simple reading is genuinely justified and not
 * a dodge. "I want to join a sect" is both a wish and an act; read as the wish
 * it answers with the bar and the gate, read as the act it may refuse for a
 * rung the player has not reached. Both are honest readings of the sentence and
 * only one of them gives the player something.
 *
 * This is not a licence to answer a different question. It is a tie-break, and
 * it applies only where the reading really does fit. A sentence with one
 * meaning still goes where that meaning goes, and a refusal a game master would
 * also give is still correct.
 *
 * AND THE INTENT WORDS ARE HELD TO THE SAME BAR. An intent named wider than the
 * routine behind it drags wide sentences onto a narrow handler, which is a
 * refusal the reader caused. Measured: `reachable` pointed at a verb that only
 * answers how a manual you hold could go further, and the model sent it "what
 * would it take to get in" - a house's admission bar. The word was the whole of
 * the mistake.
 */

/** The outer choice. One of these, then an intent, and never a bare verb. */
export const LANE_NAMES = [
    'perceive',
    'consult',
    'travel',
    'cultivate',
    'make',
    'sustain',
    'trade',
    'speak',
    'fight',
    'house',
    'site',
    'learn',
    'work'
] as const;

export type LaneName = (typeof LANE_NAMES)[number];

interface Lane {
    /** What a player is doing when they go down it, in their own words. */
    readonly says: string;
    /**
     * Which verb each intent expands to.
     *
     * The KEY is what a model is asked to choose; the VALUE is this engine's
     * own name for the routine, which a model never has to know.
     */
    readonly intents: Readonly<Record<string, ActionName>>;
    /** Where an intent this lane does not carry lands. */
    readonly otherwise: ActionName;
}

/**
 * THE READ LANE IS THE POINT OF THE EXERCISE.
 *
 * Ten verbs, none of which ever refused, and a player who wants to know what
 * they are carrying had to be routed to whichever of them the engine happened
 * to file it under. `what is my talent` and `what is in my pouch` are one
 * question to a player and two verbs to the engine, which is how a near-synonym
 * pass found twenty-three sentences answering nothing while the fact was
 * already computed and already printed for a different phrasing.
 */
export const THE_LANES: Readonly<Record<LaneName, Lane>> = Object.freeze({
    perceive: {
        says: 'looking at what is in front of you, or at one thing in particular',
        // `qi` and `ground` both reach `look` on purpose. Measured against the
        // local model, a lane intent named `place` caught "I sense the qi here"
        // and sent it to `recognise`, which reads a person rather than a
        // square. An intent word that can be read two ways is the collision
        // this whole layer exists to remove.
        intents: {
            around: 'look',
            at: 'investigate',
            ground: 'look',
            qi: 'look',
            weigh: 'assess',
            whose: 'recognise'
        },
        otherwise: 'look'
    },
    consult: {
        says: 'what you already are, hold, know, or could reach - asked of yourself',
        intents: {
            standing: 'status',
            carried: 'inventory',
            arts: 'list_techniques',
            // NOT `reachable`, which is what this said first. The verb behind it
            // is narrow - how a manual you already hold could go further, by
            // finding the next volume, being taught it, or writing it out - and
            // a broad intent word drags broad sentences onto it. Measured: the
            // model sent "what would it take to get in", which is a house's
            // admission bar, to `acquisition`. An intent word wider than the
            // routine it names is the collision this layer exists to remove.
            go_further_with_a_manual: 'acquisition',
            ceiling: 'ceiling',
            teachers: 'teacher',
            // Names the READ and not a motive. `where_i_could_go` pulled "I
            // want to get stronger" onto it, because travelling somewhere
            // thicker is one way to get stronger and the word invited the
            // reasoning. An intent word should say what comes back, not why
            // somebody might want it.
            places_within_reach: 'destinations',
            roads: 'roads',
            known: 'recall',
            heard: 'news'
        },
        otherwise: 'status'
    },
    travel: {
        says: 'going somewhere, on foot or otherwise',
        intents: { walk: 'move', ride: 'ride', fold: 'fold', passage: 'passage' },
        otherwise: 'move'
    },
    cultivate: {
        says: 'spending time on your own advancement',
        intents: {
            sit: 'cultivate',
            seclude: 'seclude',
            cross: 'breakthrough',
            drill: 'train_technique',
            wait: 'wait'
        },
        otherwise: 'cultivate'
    },
    make: {
        says: 'getting or making a thing',
        intents: { craft: 'craft', gather: 'gather', hunt: 'hunt', refine: 'refine' },
        otherwise: 'craft'
    },
    sustain: {
        says: 'the body: feeding it, provisioning it, mending it',
        intents: { eat: 'eat', provision: 'provision', treat: 'treat', pill: 'consume_pill' },
        otherwise: 'eat'
    },
    trade: {
        says: 'stones for things and things for stones',
        // `give` is the player parting with THEIRS. A demand made of
        // somebody else is fight/make_them_comply, and the two collided.
        intents: { buy: 'buy', sell: 'sell', give_mine_away: 'give', prices: 'market' },
        otherwise: 'market'
    },
    speak: {
        says: 'anything done to or with a PERSON',
        intents: { talk: 'interact', tell_them_something: 'tell', ask_them_for: 'request' },
        otherwise: 'interact'
    },
    fight: {
        says: 'hands rather than words',
        // `force` read as a blow rather than a demand, so it says what it
        // makes somebody do. `guard` is standing over a crossing, not warding.
        intents: { strike: 'attack', make_them_comply: 'coerce', stand_over: 'guard' },
        otherwise: 'attack'
    },
    house: {
        says: 'anything put TO a house rather than to a person',
        intents: {
            join: 'sect',
            petition: 'petition',
            posture: 'posture',
            seal: 'seal',
            offer: 'offer',
            propose: 'propose',
            decline: 'decline',
            swear: 'oath',
            legacy: 'legacy',
            child: 'child',
            step_down: 'descend'
        },
        otherwise: 'sect'
    },
    site: {
        says: 'a place with a way in',
        intents: { enter: 'site' },
        otherwise: 'site'
    },
    learn: {
        says: 'taking up an art somebody or something can teach',
        intents: { take_up: 'learn_technique' },
        otherwise: 'learn_technique'
    },
    work: {
        says: 'work for pay, and what is going',
        intents: { take: 'work', board: 'work' },
        otherwise: 'work'
    }
});

/** Whether a string is a lane this reader offers. */
export function isALane(value: string): value is LaneName {
    return (LANE_NAMES as readonly string[]).includes(value);
}

/**
 * The verb a lane and an intent expand to.
 *
 * Total by construction: an unknown intent inside a known lane falls to that
 * lane's `otherwise` rather than to `unclear`, because a model that picked the
 * right lane and a wrong word for the detail has still told the engine most of
 * what it needed. An unknown LANE is a different failure and is the caller's to
 * handle.
 */
export function theVerbForThisLane(lane: LaneName, intent: string | undefined): ActionName {
    const row = THE_LANES[lane];
    const named = (intent ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    return row.intents[named] ?? row.otherwise;
}

/** Every verb some lane can reach, for the test that holds the two in step. */
export function everyVerbTheLanesReach(): ReadonlySet<ActionName> {
    const reached = new Set<ActionName>();
    for (const lane of Object.values(THE_LANES)) {
        for (const verb of Object.values(lane.intents)) reached.add(verb);
        reached.add(lane.otherwise);
    }
    return reached;
}
