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
            reachable: 'acquisition',
            ceiling: 'ceiling',
            teachers: 'teacher',
            where: 'destinations',
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
        intents: { buy: 'buy', sell: 'sell', give: 'give', prices: 'market' },
        otherwise: 'market'
    },
    speak: {
        says: 'anything done to or with a PERSON',
        intents: { talk: 'interact', tell: 'tell', ask: 'request' },
        otherwise: 'interact'
    },
    fight: {
        says: 'hands rather than words',
        intents: { strike: 'attack', force: 'coerce', guard: 'guard' },
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
