/**
 * The fork a broken seclusion puts in front of the player, and its two answers.
 *
 * ── Why this file exists ──────────────────────────────────────────────────
 *
 * `time-skip.ts` already writes the best two sentences in the game. When a
 * major encounter breaks a long sitting it says either
 *
 *   "somebody is close enough to matter and has not seen this place yet.
 *    There is a road out that does not cross them ... Going costs the stretch;
 *    staying means being found here, by whoever that is."
 *
 * or, when there is no road,
 *
 *   "somebody has found this place and there is no road out that does not
 *    cross them. Whether you are sitting or standing when they arrive is the
 *    only part of it still yours."
 *
 * Both name two costs and neither is a bulletin. And the engine then answered
 * them itself: the next line a live playtest produced was "You came out early.
 * 5.3 years of the 40 years were spent; the rest was not yours to spend." The
 * player was told they had a choice and then shown the outcome of a choice
 * somebody else made. Twice in one session.
 *
 * The comment in `time-skip.ts` was already right about the remedy - "the next
 * thing the player types is the resolution" - and there was nothing in the web
 * layer that could hold a question open for one turn. This is that thing.
 *
 * ── What the two branches actually cost ───────────────────────────────────
 *
 * Nothing here is a new mechanic and nothing here moves a probability. The two
 * answers are the two things that were always physically available:
 *
 *   GOING   the remaining days are not spent. That is the whole cost and it is
 *           the cost the sentence already named. The engine was taking this
 *           branch on the player's behalf every time.
 *
 *   STAYING the remaining days ARE spent, by re-entering the ordinary seclusion
 *           path for exactly the remainder, from the day it stopped. Every roll
 *           in `time-skip.ts` and in `src/engine/encounters/` is keyed to an
 *           ABSOLUTE DAY, so a stretch resumed at day D gives the surviving
 *           days precisely what they were always going to give. Splitting a
 *           forty-year sitting into 5.3 and 34.7 is not a different forty years.
 *
 * That last property is the entire correctness argument for this feature, and
 * it is the reason there is no second simulation anywhere in it. The same
 * property is asserted for the encounter layer in
 * `tests/engine/encounters/window.test.ts`.
 *
 * ── The clock is not handed back and not charged twice ────────────────────
 *
 * The first stretch spent `simulatedDays` and the world advanced by exactly
 * that. The resumed stretch spends the remainder and no more. Nothing is
 * refunded: a player who goes has genuinely lost the rest of the sitting, and
 * a player who stays has spent every day of it.
 *
 * Food is the one thing that would have been charged twice, because provisions
 * are bought per stretch at the cave mouth and the interrupted stretch bought
 * for a span it never lived. `rationsLeft` carries what the engine says was
 * still in the pack when it stopped, and the resumed stretch is provisioned
 * from that before anything is bought. Without it, staying would cost a second
 * purse of food for days that were already paid for - which is a price the
 * player never agreed to and a reason to go that has nothing to do with the
 * person outside.
 *
 * ── Either answer is always available ─────────────────────────────────────
 *
 * AGENTS.md: do not ban, do not soften. Sitting back down with somebody at the
 * cave mouth is frequently stupid and it is never refused, and nothing about
 * choosing it makes the world gentler. Going is likewise never refused however
 * much progress it throws away.
 *
 * And the fork is not a modal jail. The crossroads stands for exactly one turn
 * and ANY action other than sitting back down is going - travelling, eating,
 * looking around, striking the barrier. What the player gets for that is the
 * sentence saying what it cost, not a refusal telling them to answer the
 * question first.
 */

import type { Cultivator } from '../schema/cultivation.js';

// ─────────────────────────────────────────────────────────────────────────
// THE QUESTION
// ─────────────────────────────────────────────────────────────────────────

/**
 * Somebody the world already has a row for, standing close enough to matter.
 *
 * Null when the world is switched off for the run, or when the place holds
 * nobody the roster can name. The sentences below degrade to "whoever that is",
 * which is what the engine's own line already said - an unnamed person is a
 * smaller lie than an invented one, and the discovery rule forbids handing over
 * a name the player has not met in any case.
 */
export interface WhoIsClose {
    id: string;
    /** Only ever shown when `known` - see `discovery.md` and the knowledge gate. */
    name: string;
    realmOrdinal: number;
    /** How they price out against the cultivator, in the resolver's own terms. */
    theirPower: number;
    yourPower: number;
    /** Whether the player already has a knowledge record for them. */
    known: boolean;
}

/**
 * A seclusion that stopped because of somebody, held open for one turn.
 *
 * In memory on the service, alongside `pendingArrivals`, and deliberately: a
 * crossroads that is lost costs the player nothing they were not already
 * losing, because losing it is going, and going is the branch the engine took
 * unasked for the whole life of this bug. A crossroads that PERSISTED wrongly
 * would be far worse - it would let a player bank a decade and come back for it.
 */
export interface SeclusionCrossroads {
    runId: string;
    cultivatorId: string;
    /** The turn it was raised on. It answers on the next one and then it is gone. */
    raisedOnTurn: number;
    /** True when there is a road out that does not cross them. */
    canWithdraw: boolean;
    /** Whether the door was shut. The resumed stretch is the same kind of sitting. */
    sealed: boolean;
    /** Whether the zero-return gate had already been answered for this sitting. */
    acknowledged: boolean;
    /** Days the whole sitting was to run for, after every ceiling. */
    daysAsked: number;
    /** Days the engine actually simulated before it stopped. */
    daysSpent: number;
    /** What is left, and what staying spends. Always at least one. */
    daysRemaining: number;
    /** Absolute day it stopped on, for the record. */
    stoppedOnDay: number;
    /** Rations the engine says were still in the pack. See the header. */
    rationsLeft: number;
    whoIsClose: WhoIsClose | null;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE PLAYER SAYS BACK
// ─────────────────────────────────────────────────────────────────────────

/**
 * Sitting back down.
 *
 * The ONLY answer that has to be recognised, because it is the only one that is
 * not already an ordinary action. Everything else a player can type is going,
 * and going needs no vocabulary.
 *
 * Deliberately generous, and every phrasing here was chosen by asking how
 * somebody would actually answer the two sentences the engine printed. AGENTS.md:
 * "if a near-synonym works, the phrasing that fails is a bug", and the failing
 * half is usually the more natural one. `tests/web/a-broken-seclusion-is-a-fork.test.ts`
 * holds the list.
 *
 * It requires the ask to be the WHOLE sentence. "I stay in the village and look
 * for work" is not sitting back down, and swallowing it would steal a turn from
 * a player who meant something else entirely.
 */
export const THE_ANSWER_IS_TO_KEEP_SITTING =
    /^\s*(?:i\s+)?(?:(?:keep|carry on|continue|go back to|get back to|return to|resume)\s+(?:on\s+)?(?:sitting|meditating|cultivating|the\s+(?:sitting|seclusion|cultivation))|(?:sit|settle|stay|remain)\s+(?:back\s+)?(?:down|put|where i am|seated|sitting)|sit back down|stay sitting|stay seated|keep my seat|keep sitting|don'?t (?:get up|move|stop)|do not (?:get up|move|stop)|(?:i\s+)?(?:stay|remain)|(?:i\s+)?(?:sit|meditate)(?: on)?|hold (?:my )?(?:seat|position|ground)|finish the (?:sitting|seclusion|stretch)|resume|carry on|press on)\s*[.!]*\s*$/i;

/**
 * Getting up and taking the road, said explicitly.
 *
 * Not required - any other action is going - but recognised so that a player
 * who answers the question directly gets an answer about the question rather
 * than a shrug from the parser, and so the panel has a sentence to send.
 */
export const THE_ANSWER_IS_TO_GO =
    /^\s*(?:i\s+)?(?:(?:get|stand)\s+up(?:\s+and\s+(?:go|leave|walk out|take the road))?|(?:go|leave|withdraw|slip away|walk out|clear out)(?:\s+now)?|take the road(?:\s+out)?|break (?:off|the sitting|seclusion)|(?:i\s+)?(?:stop|end)\s+(?:the\s+)?(?:sitting|seclusion|cultivation)|abandon the (?:sitting|seclusion)|on my feet)\s*[.!]*\s*$/i;

/** The sentence the panel's "stay" control sends, typed as a player would type it. */
export const SAY_TO_KEEP_SITTING = 'I sit back down';
/** The sentence the panel's "go" control sends. */
export const SAY_TO_GO = 'I get up and go';

// ─────────────────────────────────────────────────────────────────────────
// THE PROSE
// ─────────────────────────────────────────────────────────────────────────

/**
 * The three spans in one sentence, in ONE unit.
 *
 * Chosen off the whole sitting rather than per value, so the arithmetic in the
 * question is checkable by the person reading it. Mixed units gave "270 days of
 * the 40.0 years are spent and 39.3 years are still sitting there", where two
 * of the three numbers add up and the third has to be converted first - in a
 * game whose whole claim is that the numbers are the honest part.
 */
function spans(scale: number): (days: number) => string {
    const inYears = scale >= 365;
    return (days: number) => inYears
        ? `${(days / 365).toFixed(1)} years`
        : `${Math.round(days)} day${Math.round(days) === 1 ? '' : 's'}`;
}

/**
 * How the person outside is referred to.
 *
 * A name only when the player has already met them. Otherwise their rung, which
 * is a thing anybody can feel from inside a cave and is the honest half of what
 * the world knows about them.
 */
export function howTheyAreReferredTo(who: WhoIsClose | null, rungName: string | null): string {
    if (!who) return 'whoever it is';
    if (who.known) return who.name;
    return rungName ? `somebody standing at ${rungName}` : 'somebody';
}

/**
 * What the crossroads asks, in full, as a required fact.
 *
 * Two questions, not one, and they must not be flattened into each other: the
 * withdrawable case offers a ROAD and the other offers only the POSTURE you are
 * found in. A player who reads "there is a road out" and is then told there
 * never was one has been lied to by the thing that is meant to be the honest
 * half of this game.
 */
export function whatTheForkAsks(
    crossroads: SeclusionCrossroads,
    them: string
): string {
    const say = spans(crossroads.daysAsked);
    const remaining = say(crossroads.daysRemaining);
    const spent = say(crossroads.daysSpent);
    const asked = say(crossroads.daysAsked);

    if (crossroads.canWithdraw) {
        return `${spent} of the ${asked} are spent and ${remaining} are still sitting there. `
            + 'The road out is open for as long as you are not sitting down. Get up and it '
            + `costs you the ${remaining}, and ${them} never knows this place was here. Sit `
            + `back down and the ${remaining} are yours, and you are found here, sitting, by `
            + `${them}. Say which.`;
    }
    // WHAT THIS DOES NOT SAY, DELIBERATELY.
    //
    // Nothing in the engine prices being found seated differently from being
    // found standing. The draft of this sentence called it "the worst position
    // anybody can be found in", which reads well and asserts a mechanic that
    // does not exist - the prose yields to the measurement, and a sentence that
    // invents a penalty is a second rules system living in the narration layer.
    //
    // So it says the two things that ARE true: getting up costs the remainder
    // and buys only your feet, and sitting is the only way those years get
    // spent. If posture is ever meant to change what an arrival does, that is a
    // design question for the encounter layer and this sentence follows it.
    return `${spent} of the ${asked} are spent and ${remaining} are still sitting there. `
        + `There is no road out that does not cross ${them}, so leaving buys you nothing but `
        + `your feet: get up and the ${remaining} are gone and you meet them standing. Sit back `
        + `down and the ${remaining} are yours, and they come on you in the middle of it, which `
        + 'is the only way those years get spent at all. Say which.';
}

/** The structural half, for the inspector and the log. */
export function whatTheForkAsksStructurally(crossroads: SeclusionCrossroads): string {
    const who = crossroads.whoIsClose;
    return 'A seclusion was interrupted by a major encounter and the engine has NOT resolved '
        + `it. ${crossroads.daysSpent} of ${crossroads.daysAsked} days were simulated and `
        + `${crossroads.daysRemaining} are unspent, stopping on absolute day `
        + `${crossroads.stoppedOnDay}. `
        + (crossroads.canWithdraw
            ? 'A clean withdrawal was rolled available, so both branches are open. '
            : 'No clean withdrawal was rolled, so the branch is posture rather than departure. ')
        + (who
            ? `The person close is ${who.id} at ordinal ${who.realmOrdinal}, pricing `
              + `${who.theirPower.toFixed(1)} against this cultivator's ${who.yourPower.toFixed(1)}`
              + `${who.known ? ' and already on this run\'s knowledge record' : ' and not yet known to this run'}. `
            : 'No nameable person stands at this location on the roster, so the sentences say '
              + 'so rather than inventing one. ')
        + 'Sitting back down re-enters the ordinary seclusion path for the remaining days from '
        + 'the day it stopped; every roll is keyed to an absolute day, so nothing about those '
        + 'days is changed by having been split. Any other action forfeits them.';
}

/** What going cost, said once the player has gone. */
export function whatGoingCost(crossroads: SeclusionCrossroads, them: string): string {
    const say = spans(crossroads.daysAsked);
    const remaining = say(crossroads.daysRemaining);
    const spent = say(crossroads.daysSpent);
    const asked = say(crossroads.daysAsked);
    if (crossroads.canWithdraw) {
        return `You are up and away before ${them} is close enough to see the place. ${spent} `
            + `of the ${asked} are spent; the ${remaining} that were left went with the sitting, `
            + 'and there is no getting back into a stretch you stood up out of.';
    }
    return `You are on your feet when ${them} arrives, which is the whole of what standing up `
        + `bought. ${spent} of the ${asked} are spent; the ${remaining} that were left went with `
        + 'the sitting.';
}

/** What sitting back down committed to, said as the resumed stretch opens. */
export function whatStayingCommittedTo(crossroads: SeclusionCrossroads, them: string): string {
    const remaining = spans(crossroads.daysAsked)(crossroads.daysRemaining);
    if (crossroads.canWithdraw) {
        return `You let the road go and sit back down. ${remaining} left to sit, and ${them} `
            + 'is coming past a place that is no longer empty.';
    }
    return `You do not get up. ${remaining} left to sit, and ${them} will find you exactly as `
        + 'you are.';
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE CROSSROADS IS WORTH KNOWING ABOUT, FOR THE SHEET
// ─────────────────────────────────────────────────────────────────────────

/**
 * The crossroads as the state payload carries it.
 *
 * The client renders two controls off this and sends back one of the two
 * sentences above, down the ordinary command path - the same shape the
 * zero-return refusal uses, so if either sentence stops parsing it stops for
 * everybody at once and a test of the verb catches it. Nothing here is the
 * interface: typing anything at all still works, and typing something else is
 * still going.
 */
export interface CrossroadsView {
    canWithdraw: boolean;
    daysAsked: number;
    daysSpent: number;
    daysRemaining: number;
    /** How the person outside is to be referred to. Never a name they have not earned. */
    them: string;
    /** The question, in the engine's own words. */
    question: string;
    /** What each control sends, verbatim. */
    stayingSays: string;
    goingSays: string;
}

export function crossroadsView(
    crossroads: SeclusionCrossroads,
    them: string
): CrossroadsView {
    return {
        canWithdraw: crossroads.canWithdraw,
        daysAsked: crossroads.daysAsked,
        daysSpent: crossroads.daysSpent,
        daysRemaining: crossroads.daysRemaining,
        them,
        question: whatTheForkAsks(crossroads, them),
        stayingSays: SAY_TO_KEEP_SITTING,
        goingSays: SAY_TO_GO
    };
}

/**
 * Whether a crossroads still belongs to the cultivator and run in front of us.
 *
 * A run that ended, a cultivator who died in the stretch that raised it, or a
 * different run entirely - all of them mean the question is gone. Checked
 * rather than assumed because the service holds one of these across turns and a
 * stale one would offer a decade that no longer exists.
 */
export function stillStands(
    crossroads: SeclusionCrossroads | null,
    runId: string,
    cultivator: Cultivator
): crossroads is SeclusionCrossroads {
    return crossroads !== null
        && crossroads.runId === runId
        && crossroads.cultivatorId === cultivator.id
        && cultivator.alive
        && crossroads.daysRemaining > 0;
}
