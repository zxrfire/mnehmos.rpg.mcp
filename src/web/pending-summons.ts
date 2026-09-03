/**
 * A summons the house has left standing, and what saying no to it costs.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `encounters/duties.ts` opens by naming the two shapes a duty comes in, and
 * the first of them carries the whole argument for membership:
 *
 *     the summons   the house calls on you. You may refuse, and refusing is a
 *                   row in the obligations ledger rather than a shrug
 *
 * All of it was built. `summonsPool` draws the ask, `attemptSummons` in
 * `encounters/window.ts` rolls it against how findable somebody is,
 * `resolveOccurrence` marks it `interrupts: true` with the comment "a summons
 * that a cultivator sat through without noticing is a notification, and the
 * point of the whole mechanism is that it is not one", and `refuseDuty` takes
 * `outcome: 'refused' | 'failed' | 'lapsed'` and writes a grudge HELD BY THE
 * HOUSE against the person who was asked.
 *
 * And then `recordEncounters` mapped the occurrence to `event.summary` and
 * **threw `occurrence.duty` away.** Measured across the tree: `occurrence.duty`
 * had no reader anywhere in `src/web`, and the only call to `refuseDuty` in the
 * repository passed `'failed'`, on the branch where the cultivator had died.
 * `'refused'` and `'lapsed'` had no caller at all.
 *
 * So a summons WAS a notification - the exact thing the design says it must not
 * be. It interrupted a span, printed a sentence, and evaporated. There was
 * nothing standing to accept and nothing standing to refuse, because nothing
 * had been kept.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE ADDS, WHICH IS ONE WRITE AND ONE PRICE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The ask is kept on a flag until it is answered, exactly the way `PendingPill`
 * in `cultivation-support.ts` keeps a decision between turns. Everything else
 * was already here and is called rather than reimplemented:
 *
 *     refusalCost         `cultivation/leadership.ts`, beside the six costs
 *                         that were already there
 *     affordable          `cultivation/leadership.ts`, whose docstring is this
 *                         requirement verbatim - "so a tool can answer 'what
 *                         would this cost me' without committing to anything,
 *                         which is the difference between a decision and a
 *                         surprise". It had one caller, the leadership verbs
 *     resolveAct          the one procedure that prices an act, spends the
 *                         standing and reports what the house does about it
 *     spendStanding       `web/standing.ts`, the house's own arithmetic
 *     refuseDuty          `web/encounters.ts`, the ledger row
 *
 * There is no second decision procedure here and no second grudge. The only
 * new number in the change is `REFUSAL_COST_BY_SEVERITY`, which is a price
 * beside six other prices, keyed on a band the duty layer had already derived.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AND THIS IS WHERE BEING PUNISHED BY YOUR OWN HOUSE COMES FROM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `resolveAct` has always returned `dismissedFromTheHouse` for somebody who is
 * NOT the head and whose standing has fallen past `CHALLENGE_AT` - "a house does
 * not keep a rung nobody below it will work for". Nothing could reach it,
 * because `POWERS_BY_TIER.ordered` is empty: an ordinary member could perform no
 * act, so an ordinary member could spend no standing, so an ordinary member's
 * credit only ever went up.
 *
 * Refusing is the act the bottom rung can perform. Wiring it lights the whole
 * non-head branch of an escalation ladder that was already written, already
 * tested, and unreachable - obstruction, then the disciples of your own line
 * walking, then the house dismissing you. None of that is new behaviour; it is
 * the existing behaviour finally having an input.
 *
 * ── ONE STANDING ASK AT A TIME ───────────────────────────────────────────
 *
 * Deliberately not a queue. A house that has sent for somebody and had no
 * answer does not send again about something else - it deals with the first
 * thing - and a player holding four unanswered summonses is a chore list rather
 * than a decision. A new ask overwrites, and the overwritten one is not silently
 * forgiven: it has already passed its due day or it has not, and
 * {@link summonsIsOverdue} is what reads that.
 */

import type { Duty } from '../engine/encounters/types.js';
import {
    type ActCost,
    type BacklashLevel,
    CHALLENGE_AT,
    type RefusalSeverity,
    affordable,
    refusalCost
} from '../engine/cultivation/leadership.js';
import type { Cultivator } from '../schema/cultivation.js';
import {
    type CultivationRepos,
    clearFlag,
    readJsonFlag,
    writeFlag
} from '../server/consolidated/cultivation-support.js';
import { type HouseCredit, type HousePosition, creditIn, positionIn } from './standing.js';

/**
 * The one key. Not keyed per house, unlike `houseFlagKey`.
 *
 * A summons belongs to whoever sent it, and the payload carries `factionId` so
 * a read can check it against the membership that exists NOW. Keying the flag
 * per sect instead would leave an orphan row behind whenever somebody left,
 * and a house nobody belongs to any more cannot be owed an answer.
 */
export const SUMMONS_FLAG_KEY = 'summons';

/** An ask that has been made and not yet answered. */
export interface PendingSummons {
    duty: Duty;
    /** Catalog row it was read off, so the ledger row can name it. */
    entryId: string;
    /** What the situation was, factually. The occurrence summary. */
    what: string;
    /** Absolute day somebody actually asked. */
    spokenOnDay: number;
}

/**
 * Keep the ask.
 *
 * Called from `recordEncounters`, in the same place and for the same reason
 * `recordContact` is: the state moves before anything is narrated, so phase 3
 * gets a licence to mention something the database already holds rather than
 * the other way round.
 *
 * A duty with no `factionId` is a commission a rogue took off a wall. Nobody is
 * owed an answer to it, so nothing is kept.
 */
export function rememberSummons(
    repos: CultivationRepos,
    cultivatorId: string,
    pending: PendingSummons
): void {
    if (!pending.duty.factionId) return;
    writeFlag(repos.db, cultivatorId, SUMMONS_FLAG_KEY, JSON.stringify(pending));
}

/**
 * The ask still standing, or null.
 *
 * Returns null - and clears the row - when the player no longer belongs to the
 * house that sent it. Walking out settles everything the house was owed, which
 * is what `leave` already says out loud, and an ask outliving the membership
 * would be the one obligation that survived a departure.
 */
export function readPendingSummons(
    repos: CultivationRepos,
    cultivatorId: string
): PendingSummons | null {
    const held = readJsonFlag<PendingSummons>(repos.db, cultivatorId, SUMMONS_FLAG_KEY);
    if (!held || !held.duty || !held.duty.factionId) return null;

    const membership = repos.sects.getMembership(cultivatorId);
    if (!membership || membership.sectId !== held.duty.factionId) {
        clearFlag(repos.db, cultivatorId, SUMMONS_FLAG_KEY);
        return null;
    }
    return held;
}

export function clearPendingSummons(repos: CultivationRepos, cultivatorId: string): void {
    clearFlag(repos.db, cultivatorId, SUMMONS_FLAG_KEY);
}

/**
 * Whether the day it had to be answered by has gone.
 *
 * `dueOnDay` is the duty layer's own field and is set when the ask is made.
 * Nothing recomputes it here.
 */
export function summonsIsOverdue(pending: PendingSummons, today: number): boolean {
    return today > pending.duty.dueOnDay;
}

/**
 * What refusing would cost, without refusing.
 *
 * The whole of the design owner's ruling on this: *a player should be able to
 * see what saying no will cost - otherwise it is a trap rather than a decision.*
 * Every figure is `affordable`'s, which is the function written for exactly
 * this question and which had only ever been asked it by the leadership verbs.
 */
export interface RefusalPrice {
    position: HousePosition;
    credit: HouseCredit;
    cost: ActCost;
    /** After the discount a personal following buys. */
    spends: number;
    wouldLandAt: number;
    wouldTrigger: BacklashLevel;
    /** True while the house would still do what this person asks of it. */
    safe: boolean;
    /** True where saying no once would end the membership. */
    wouldBeDismissed: boolean;
}

/**
 * Price a refusal against the house as it stands today.
 *
 * `hasPatron` is false and `elders` is empty on purpose: both are read by
 * `resolveAct` only on the head-of-house branch, and this is the act that
 * exists for everybody else. A head who refuses their own house's ask is not a
 * case the world produces - nobody sends for the person who does the sending.
 */
export function priceOfRefusing(
    repos: CultivationRepos,
    cultivator: Cultivator,
    pending: PendingSummons,
    elapsedDays: number
): RefusalPrice | null {
    const position = positionIn(repos, cultivator.id);
    if (!position) return null;

    const credit = creditIn(repos, cultivator.id, position, elapsedDays, false);
    const cost = refusalCost(
        pending.duty.refusal.severity as RefusalSeverity,
        pending.duty.origin
    );
    const would = affordable(
        {
            standing: credit.standing,
            elders: [],
            houseSize: credit.houseSize,
            ownFollowing: credit.ownFollowing,
            hasPatron: false,
            isHead: position.head
        },
        cost
    );

    return {
        position,
        credit,
        cost,
        spends: would.spends,
        wouldLandAt: would.wouldLandAt,
        wouldTrigger: would.wouldTrigger,
        safe: would.safe,
        // `resolveAct`'s own non-head condition, quoted rather than
        // approximated: `dismissedFromTheHouse: !isHead && standingAfter <=
        // CHALLENGE_AT`. Importing the constant is what keeps the preview and
        // the commit from ever disagreeing about where the door is.
        wouldBeDismissed: !position.head && would.wouldLandAt <= CHALLENGE_AT
    };
}
