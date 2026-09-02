/**
 * Who answers for a beast that was killed, and only where somebody found out.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE RULING THIS IMPLEMENTS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Everything in the beast catalog can be hunted, the friendly ones included.
 * Nothing here refuses a killing and nothing anywhere else does either - that
 * would be the banning AGENTS.md forbids, and a world that says no is smaller
 * than a world that says yes and here is who saw.
 *
 * What this answers is the other half:
 *
 * > **The kill happens. What it costs you afterwards depends on what the thing
 * > was inclined to do about people, on whether anybody was standing behind
 * > it, and on whether anybody can put your name to it.**
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NOTHING HERE IS NEW MACHINERY, AND THAT IS THE POINT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Three pieces, all of them already built and already load-bearing elsewhere:
 *
 *   THE TRANSFER    `what-a-deed-leaves.ts`. One scoring function, both signs,
 *                   no branch on what the deed was. A beast kill is a transfer
 *                   like any other and is priced by the same call a gift is.
 *   WHO FOUND OUT   `KnowingStage` in `src/engine/social/discovery.ts`. Not a
 *                   witness system - there is no witness system here and there
 *                   must not be one. The ladder of knowing is how everything
 *                   in this world becomes known, and a killing is not an
 *                   exception to it.
 *   WHAT IT WAS     `disposition` on the beast row, which is `SectAlignment` -
 *                   the field a sect already carries, read the way
 *                   `demonic-sects-and-what-they-are-willing-to-do.ts` reads
 *                   it: who pays, and did they agree.
 *
 * There is no beast-specific consequence table, no reputation number, and no
 * branch anywhere below on "is this a beast".
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE DISPOSITION DECIDES THE SIGN, AND NOTHING ELSE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `what-a-deed-leaves.ts` opens by saying that kindness and harm are one
 * machinery pointed two ways, and that the whole of the direction is `paidBy`.
 * So:
 *
 *   righteous  Somebody was relying on it. They paid. A wrong, and they hold a
 *              record about you.
 *   neutral    It was standing on somebody's ground and now is not. They paid,
 *              and what they lost is the thing rather than the thing and the
 *              work. Usually there is nobody at all, because a neutral animal
 *              on open ground is nobody's.
 *   demonic    It had been taking from them and now cannot. **You paid, and
 *              they gained.** The same call opens a favour they owe you.
 *
 * **The magnitude is not a multiplier for being righteous.** `cost` is what it
 * cost against what they had, and that is a fact the caller holds and this
 * module does not: a district whose whole protection was one animal and a
 * house that lost one of thirty deer are different sizes of loss, and neither
 * of them is a property of the disposition. Reading a righteous beast as
 * heavier by construction would be pricing a word instead of a transfer, which
 * is the exact failure that file exists to prevent.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * "IF THEY FIND OUT" IS `placed`, AND THE LINE WAS ALREADY DRAWN
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A record is held AGAINST somebody, so opening one needs a name. The ladder of
 * knowing already has the rung where a name arrives, already names it, and
 * already exports the predicate:
 *
 * > `REACHABLE_FROM` is `placed` - *"you know where, or who, or when"* - and
 * > `canPointAt` is the test.
 *
 * So the join costs nothing:
 *
 *   unaware      As far as they are concerned it did not happen.
 *   whisper      A word going round about something out on that ground.
 *   named        **They know the thing is dead and cannot say whose doing it
 *                was.** The deniable case, exactly: the world holds the fact,
 *                nobody is repeating it with a name on it, and no account
 *                opens - because there is no name to put on one.
 *   placed       They can say who. This is where it starts costing you.
 *   encountered  They were on the ground while it happened.
 *   known        They watched you do it.
 *
 * `whoCanPointAtYou` is that filter and it is the whole of the mechanism. Note
 * what it is NOT: it does not decide anybody's stage, does not roll for
 * discovery, and does not write a record. Stages are written by the knowledge
 * layer from whatever source it had, and `stageCeilingFor` already caps what
 * each source can deliver - somebody who overheard it through a wall is stuck
 * at `whisper` however many times they hear it, and can never open an account
 * on the strength of having overheard.
 *
 * And because stages never fall, this gets the good scene for free: a killing
 * nobody could name can be named years later by one person being told by one
 * other, and the account opens then, at full weight, dated to the day the deed
 * happened. Nothing had to remember to keep it open.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * IT ONLY BITES WHERE THERE WAS AN INDIVIDUAL
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Below `BEAST_CORE_ORDINAL` a hunt returns an amount rather than a particular
 * animal - `items.md`'s counted line, applied to living things, and the ruling
 * is explicit that there is no point tracking one. So there is no individual
 * for anybody to have had a view about, nobody was relying on THAT ONE, and
 * killing it is not a reputational event however the species is dispositioned.
 * {@link answerabilityOf} returns `not_an_individual` and nothing is written.
 *
 * That line is not chosen here. It is `BEAST_CORE_ORDINAL`, it is already the
 * rung at which a beast carries something worth money, and the material catalog
 * already agrees with it: nothing below it carries a core, and everything above
 * it that carries materials at all carries one.
 *
 * Pure. No state, no rolls, no I/O. The caller writes what comes back - through
 * `aDeedEntersTheWorld` for the fact and the obligation ledger for the record,
 * which is where those two already live.
 */

import {
    BEAST_CHANGE_ORDINAL,
    BEAST_CORE_ORDINAL,
    type Beast
} from '../../data/cultivation/beasts.js';
import { REACHABLE_FROM, canPointAt, type KnowingStage } from '../social/discovery.js';
import type { DayIndex } from '../social/common.js';
import type { ObligationCause } from '../social/grudges.js';
import {
    whatADeedLeaves,
    type Deed,
    type Party,
    type Reach,
    type WhatADeedLeaves,
    type WhoPaid
} from '../social-leverage/what-a-deed-leaves.js';

// ─────────────────────────────────────────────────────────────────────────
// WHETHER THERE IS ANYTHING TO ANSWER FOR
// ─────────────────────────────────────────────────────────────────────────

export type Answerability =
    /**
     * Below `BEAST_CORE_ORDINAL`. A hunt returned an amount, not an animal.
     * Nobody was relying on that one because there was no that one.
     */
    | 'not_an_individual'
    /**
     * At or above `BEAST_CHANGE_ORDINAL`. This is not a hunt and this module
     * has no business pricing it - see
     * {@link WHY_NOTHING_PAST_THE_CHANGE_IS_HANDLED_HERE}.
     */
    | 'a_person_was_killed'
    /** A tracked animal, and nobody was standing behind it. It was nobody's. */
    | 'nobody_stood_behind_it'
    /** A tracked animal somebody was standing behind. There is a transfer. */
    | 'answerable';

/**
 * Whether the world has anybody to answer to about this killing.
 *
 * `standing` is the caller's fact and never derived here: whose ground it was
 * on, whose it was, who was living off it. The engine layer does not read
 * locations and must not start.
 */
export function answerabilityOf(beast: Beast, standing: Party | null): Answerability {
    if (beast.ordinal >= BEAST_CHANGE_ORDINAL) return 'a_person_was_killed';
    if (beast.ordinal < BEAST_CORE_ORDINAL) return 'not_an_individual';
    return standing === null ? 'nobody_stood_behind_it' : 'answerable';
}

/** True where the hunt returned an amount rather than a particular animal. */
export function isAnAmountRatherThanAnAnimal(beast: Beast): boolean {
    return beast.ordinal < BEAST_CORE_ORDINAL;
}

// ─────────────────────────────────────────────────────────────────────────
// WHO CAN PUT A NAME TO IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * What each rung of the ladder of knowing amounts to, about a killing.
 *
 * Stated once here rather than paraphrased at call sites, for the reason
 * `STAGE_MEANING` gives about itself: five paraphrases of one rung is how a
 * ladder quietly acquires a sixth nobody agreed to. Nothing reads this; it is
 * for whoever is deciding what stage to write.
 */
export const WHAT_A_STAGE_MEANS_ABOUT_A_KILLING: Readonly<Record<KnowingStage, string>> =
    Object.freeze({
        unaware: 'As far as they are concerned it did not happen.',
        whisper: 'A word going round about something out on that ground, and nothing they could act on.',
        named: 'They know the thing is dead. Nobody has a name for whose doing it was, so no account opens and nobody repeats it with a name on it.',
        placed: 'They can say who. This is the rung at which it starts costing you.',
        encountered: 'They were on the ground while it happened.',
        known: 'They watched you do it.'
    });

/**
 * Everybody who can put a name to the killing.
 *
 * The whole of "if they find out", and it is one line because the ladder had
 * already drawn the line and already named it: `REACHABLE_FROM` is `placed`,
 * `canPointAt` is the predicate, and a record held against somebody needs a
 * name the way a journey needs a direction.
 *
 * Nothing here decides a stage. That is the knowledge layer's, written from
 * whatever source it had and capped by `stageCeilingFor`, which is why
 * somebody who only ever overheard it cannot open an account no matter how
 * often they overhear it.
 */
export function whoCanPointAtYou(
    stages: ReadonlyMap<string, KnowingStage>
): readonly string[] {
    const named: string[] = [];
    for (const [id, stage] of stages) {
        if (canPointAt(stage)) named.push(id);
    }
    return named;
}

/** The rung at which a killing acquires a name and can open an account. */
export const A_KILLING_ACQUIRES_A_NAME_AT: KnowingStage = REACHABLE_FROM;

// ─────────────────────────────────────────────────────────────────────────
// WHAT THEY LOST, WHICH IS THE DIRECTION AND NOT THE SIZE
// ─────────────────────────────────────────────────────────────────────────

export type WhatTheyLost =
    /** Righteous. It was doing something for them, and now nothing is. */
    | 'the thing and what it was doing'
    /** Neutral. It was theirs and now they have not got it. */
    | 'the thing itself'
    /** Demonic. It had been taking from them and now cannot. */
    | 'nothing, and they are better off';

export function whatTheyLost(beast: Beast): WhatTheyLost {
    switch (beast.disposition) {
        case 'righteous': return 'the thing and what it was doing';
        case 'demonic': return 'nothing, and they are better off';
        default: return 'the thing itself';
    }
}

/**
 * Which side of the transfer paid, which is the entire direction of the model.
 *
 * The one read of `disposition` in this file, and it produces a favour rather
 * than a grudge for a demonic beast without a second code path: killing the
 * thing that had been taking from a district is a kindness done to the
 * district, priced by the machinery that prices every other kindness.
 */
export function whoPaidFor(beast: Beast): WhoPaid {
    return beast.disposition === 'demonic' ? 'actor' : 'subject';
}

/**
 * The share of what they had, for a caller with nothing better.
 *
 * `Deed.cost` is relative to what the payer had, and only somebody holding the
 * standing party's affairs knows that. This is the fallback and it is
 * deliberately crude: what stood there together is treated as what they had,
 * so one of a herd of thirty is a thirtieth and a solitary thing is all of it.
 *
 * **Override it wherever the caller knows better.** A district for which the
 * animal was one of several assets is not losing everything, and passing 1
 * here would price it at the top of the ledger - which is the correct reading
 * of losing all of what you had irreversibly, and the wrong reading of this.
 */
export function shareOfWhatTheyHad(input: {
    beast: Beast;
    /** How many of it they actually had. Defaults to what stands together. */
    howManyTheyHad?: number;
}): number {
    const held = Math.max(1, Math.floor(input.howManyTheyHad ?? input.beast.groupSize));
    return 1 / held;
}

// ─────────────────────────────────────────────────────────────────────────
// THE TRANSFER
// ─────────────────────────────────────────────────────────────────────────

/**
 * The ledger's word for it, in each direction.
 *
 * `cause` is data: `what-a-deed-leaves.ts` carries it onto the record and never
 * reads it, and there is no table keyed on one anywhere. These are the closest
 * existing rows, chosen so a record is legible in two centuries and for no
 * other reason.
 *
 * `harvested` is the ledger's own row for a body taken for what it was made of,
 * kept apart from `robbery` precisely because the body was the reason anybody
 * came - which is true of every kill in this catalog, since the core is the
 * whole of why parties go out.
 */
const CAUSE_FOR: Readonly<Record<WhoPaid, ObligationCause>> = Object.freeze({
    subject: 'harvested',
    actor: 'saved_life'
});

export interface AKillToAnswerFor {
    beast: Beast;
    /**
     * Whoever was standing behind it, or null where it was nobody's.
     *
     * **Never the beast.** Below `BEAST_CHANGE_ORDINAL` the thing killed is an
     * animal and cannot hold a record about anybody; the party is a person or a
     * house - whose it was, whose ground it was under, who was living off it.
     * That is a property and standing question and the caller owns it.
     */
    standing: Party | null;
    killer: Party;
    /**
     * Where each party stands on the ladder of knowing about THIS KILLING.
     *
     * Supplied, never derived. Anybody absent is `unaware` and cannot open
     * anything, which is the ordinary case.
     */
    stages: ReadonlyMap<string, KnowingStage>;
    onDay: DayIndex;
    /** Plain words for the ledger. Written by the caller; never parsed. */
    description: string;
    /** How many people were on the ground. A tag and a shame term, not a weight. */
    witnesses?: number;
    /** How far the aggrieved side can get at the killer. Unbacked by default. */
    reach?: Reach;
    /** What it cost them, against what they had. See {@link shareOfWhatTheyHad}. */
    cost?: number;
    /** Overrides the ledger's word for it, where the caller has a better one. */
    cause?: ObligationCause;
}

export interface WhatTheKillLeft {
    answerability: Answerability;
    whatTheyLost: WhatTheyLost | null;
    /** The transfer in the ordinary shape, or null where there was none. */
    deed: Deed | null;
    /** Everything it leaves, from the one scoring function. Null with no deed. */
    leaves: WhatADeedLeaves | null;
    /** Everybody who can put a name to it. Derived from the stages, never given. */
    knownTo: readonly string[];
    /** Engine truth, one line, for the mechanical channel. Never narration. */
    line: string;
}

/**
 * What a killing leaves behind, priced by the machinery that prices everything
 * else.
 *
 * The order is the order of the argument: is there anybody to answer to, which
 * way did the transfer run, who can name you for it, and then one call to the
 * scoring function that has no idea a beast was involved.
 */
export function whatTheKillLeft(input: AKillToAnswerFor): WhatTheKillLeft {
    const { beast, standing, killer } = input;
    const answerability = answerabilityOf(beast, standing);
    const knownTo = whoCanPointAtYou(input.stages);

    if (answerability !== 'answerable' || standing === null) {
        return {
            answerability,
            whatTheyLost: null,
            deed: null,
            leaves: null,
            knownTo,
            line: LINE_FOR[answerability]
        };
    }

    const paidBy = whoPaidFor(beast);
    const deed: Deed = {
        cause: input.cause ?? CAUSE_FOR[paidBy],
        paidBy,
        cost: input.cost ?? shareOfWhatTheyHad({ beast }),
        // Below the change the body is the whole of them: no nascent soul
        // leaves, no seam regrows, nothing comes back. `THE_BEAST_ROAD.death`
        // says so, and it is the one field on a deed this file can answer with
        // certainty rather than by asking the caller.
        irreversible: true,
        onDay: input.onDay,
        description: input.description,
        knownTo,
        ...(input.witnesses === undefined ? {} : { witnesses: input.witnesses }),
        tags: [
            'beast_kill',
            `disposition:${beast.disposition}`,
            `beast:${beast.id}`,
            `rung:${beast.ordinal}`
        ]
    };

    const leaves = whatADeedLeaves({
        deed,
        // A kindness is held by whoever paid for it. The killer went out and
        // did the dangerous thing, so on the demonic side the killer is the
        // actor holding a favour, and on the other two the standing party is
        // the subject holding a record. One expression, both directions.
        actor: killer,
        subject: standing,
        ...(input.reach ? { reach: input.reach } : {})
    });

    return {
        answerability,
        whatTheyLost: whatTheyLost(beast),
        deed,
        leaves,
        knownTo,
        line: knownTo.length === 0
            ? 'Nobody can put a name to it. The thing is dead, whoever was standing behind '
              + 'it may well know that, and there is no account open because there is nobody '
              + 'for it to be against.'
            : `${knownTo.length} ${knownTo.length === 1 ? 'party can' : 'parties can'} say `
              + `whose doing it was. ${leaves.note}`
    };
}

const LINE_FOR: Readonly<Record<Answerability, string>> = Object.freeze({
    not_an_individual:
        'It was an amount rather than an animal. Nobody was relying on that one, because '
        + 'there was no that one, and nothing about it is a thing anybody holds against you.',
    nobody_stood_behind_it:
        'It was nobody\'s. It stood on ground nobody holds and lived off nothing anybody '
        + 'was counting, so there is no party and no account - which is most of the hunting '
        + 'trade and the reason it is a trade.',
    a_person_was_killed:
        'It was past the change. This was not a hunt and it is not priced here - what was '
        + 'killed was a person, and it goes where a person\'s killing goes.',
    answerable: ''
});

// ─────────────────────────────────────────────────────────────────────────
// AND THE LINE AT THE TOP, WHICH IS NOT THIS FILE'S TO PRICE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Why {@link answerabilityOf} stops at `BEAST_CHANGE_ORDINAL` and hands the
 * question on, and what is missing behind that hand-off.
 *
 * **The asymmetry is the interesting content.** The same verb, aimed twelve
 * rungs apart, is a trade in one direction and a murder in the other, and
 * nothing in the code branches on "is it a beast" to make that true - it falls
 * out of what is standing there. Below the change the thing killed is an animal
 * and the party is whoever was relying on it. At and above it, the thing killed
 * IS the party.
 *
 * **AND IT DOES NOT YET FALL OUT, WHICH IS A FINDING RATHER THAN A PATCH.**
 * The design says a changed beast gets a row among the people: a rung, a house
 * or none, wants, relationships, a name, a marriage, diluting bloodlines. Then
 * killing one would reach the ordinary killing path and open the ordinary
 * accounts with the ordinary people, with nothing written for it anywhere.
 * Measured on this tree: `theChangedBelongAmongThePeople` in
 * `hunting-a-spirit-beast.ts` is a constant with a comment and no writer, the
 * three speaking entries in the catalog have no world rows, and a killing of
 * one therefore finds no house, no kin and no roster - so `whatADeedLeaves`
 * would price it against nobody and report that nobody minded.
 *
 * Writing a special rule here to cover that would be the wrong repair twice
 * over: it would make "a changed beast is a person" mean "a changed beast has
 * its own consequence table", and it would let the missing roster row go on
 * being missing. The fix is upstream, in whatever seeds people.
 */
export const WHY_NOTHING_PAST_THE_CHANGE_IS_HANDLED_HERE = {
    theRule:
        `At and above ordinal ${BEAST_CHANGE_ORDINAL} it is not hunting. It is killing a `
        + 'person, and the world should treat it exactly as it treats killing any other '
        + 'person at that rung. Nothing about it should be written twice.',
    whatIsMissing:
        'A changed beast has no row among the people. The catalog carries three that speak '
        + 'and the world seeds none of them, so a killing finds no house, no kin and no '
        + 'roster to open an account with. The ordinary path would work; there is nobody '
        + 'standing in it.',
    doNotPatchItHere:
        'A consequence table for changed beasts would make the design mean its opposite. '
        + 'What is wanted is the roster row, after which this file has nothing to say about '
        + 'them and correctly says nothing.'
} as const;
