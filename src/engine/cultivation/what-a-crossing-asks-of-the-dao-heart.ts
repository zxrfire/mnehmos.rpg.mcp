/**
 * 道心 - what a crossing asks about the life that arrived at it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE ONE THING IT READS, AND THE ONE THING IT REFUSES TO
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A realm boundary reads the obligation ledger and counts what is STILL OPEN
 * against or in favour of the person standing at it. That is the whole input.
 * It does not read the cause, it does not read the direction, and there is no
 * table of heart demons anywhere in this file - a switch over kinds of demon
 * would be the design being wrong, and a switch over kinds of deed would be
 * the engine having an opinion.
 *
 * `TRIAL_DESCRIPTIONS` in `what-goes-wrong-at-a-realm-boundary.ts` has said
 * this for as long as it has existed, about the birthing:
 *
 *   > Everything the cultivator has never settled is present at that meeting
 *   > and has a say in what comes out of it.
 *
 * Nothing read it. This is that sentence with a caller.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * HOW EACH PATH PAYS, WHICH IS THE CONSTRAINT THAT SHAPED THE DESIGN
 * ═════════════════════════════════════════════════════════════════════════
 *
 * 天道无情. The trap here is easy to fall into by accident and it has two
 * shapes: if regret feeds heart demons then sparing an enemy is punished, and
 * if a clean ledger means a clean crossing then the engine is rewarding
 * virtue. Neither is allowed, so what is counted is not what a deed WAS. It is
 * whether it is FINISHED - a fact the ledger already stores, in one word,
 * `status`.
 *
 *   THE RESTRAINED ROAD   The other party is alive and the account is open.
 *                         It weighs at every boundary until it is settled, and
 *                         it CAN be settled: there is somebody to go to, and
 *                         `what-would-settle-an-account-this-heavy.ts` already
 *                         prices what they will take. Liquid, and the price is
 *                         years, exposure and whatever they ask.
 *
 *   THE DECISIVE ROAD     Finish it and it closes. `settleObligation` with
 *                         `avenged` discharges a record exactly as thoroughly
 *                         as `forgiven` does, and this file cannot tell the two
 *                         apart because it reads `status` and nothing else.
 *                         What it costs instead is that the deed which closed
 *                         one account opens the ones held by the dead party's
 *                         kin and house - `whatADeedLeaves` writes them, and
 *                         `inheritOnDeath` copies them down the generations
 *                         WITHOUT DISCOUNTING. The ledger does not get shorter.
 *                         It gets wider, hereditary, and held by people the
 *                         cultivator has never met and often cannot find.
 *
 *   THE CONCEALED ROAD    An account with no name on it is not a party to
 *                         anybody, so it is not counted here and the crossing
 *                         asks nothing about it. That is not the concealed road
 *                         being safe - it is where its cost lives:
 *                         `theSearchItOpens` puts somebody on the road looking,
 *                         and the day `aNameAttaches` fires the account arrives
 *                         at its ORIGINAL severity and its ORIGINAL date, in
 *                         one piece, at a moment nobody chose. Concealment buys
 *                         timing and pays interest.
 *
 * So all three roads pay and none of them pays in the same currency, and the
 * only thing this file is willing to say about a life is how much of it is
 * unfinished.
 *
 * THE TEST THAT KEEPS IT HONEST is that `forgiven` and `avenged` must buy the
 * same thing here. `tests/engine/cultivation/the-dao-heart.test.ts` asserts it
 * directly, because it is the sharpest single proof that the engine has no
 * view: mercy and revenge are two ways of finishing, and a crossing that could
 * tell them apart would be a crossing with a preference.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY IT IS AN ODDS TERM AND NOT ANOTHER KIND OF ATTRITION
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `ARRIVES_BROKEN_CHANCE`'s own note measured the ladder's remaining headroom
 * at 2.7 points across eight boundaries, and the failure table's shape lever
 * was measured to do nothing at all above Deity Transformation. So the two
 * obvious places to charge this - a broken-landing factor, a re-weighting of
 * the failure table's mind rows - are both already spent or already known not
 * to work, and a new global attrition term would close the top of the ladder.
 *
 * An odds line does not have that problem, because it is ZERO for anybody
 * whose caller passes no ledger. The unaided sweeps in `ladder-odds.ts` and
 * `origin-odds.ts` pass none, so every measurement the ladder is calibrated
 * against is byte-identical with this in. What moves is a cultivator with a
 * record, which is the only population the mechanic is about.
 *
 * Pure. Ledger in, a number out. No RNG, no I/O, nothing persisted.
 */

import type { DayIndex } from '../social/common.js';
import type { ObligationRecord, Severity } from '../social/grudges.js';
import { WHAT_A_RECORD_COUNTS_FOR } from '../social-leverage/personal-alignment.js';

// ─────────────────────────────────────────────────────────────────────────
// THE SCALE
// ─────────────────────────────────────────────────────────────────────────

/**
 * The weight at which a life reads as nothing but loose ends.
 *
 * Four, on `WHAT_A_RECORD_COUNTS_FOR`'s scale: two unforgivable things, or
 * four grave ones, or sixteen serious ones. Deliberately looser than
 * `WHAT_MAKES_IT_A_METHOD`, which is 2, and the reason is the selection rather
 * than a judgement about severity. That bar is asked of ONE direction - what
 * somebody took, or what they paid - and this counts both, so the same life
 * scores about twice as much here. Twice the bar keeps the two readings
 * saying comparable things about comparable people.
 *
 * It is a ceiling on the count, never on the ledger. Nothing is forgiven for
 * reaching it; the fifth grave account is still on the record, still held,
 * still descends, and still has to be settled by whoever wants it settled.
 */
export const A_LIFE_THAT_IS_ALL_LOOSE_ENDS = 4;

/**
 * The most an unsettled record may cost a crossing.
 *
 * Derived rather than felt, against the two figures `BROKEN_STATUS_STRAIN`
 * already cites for scale: the whole legal attribute range is worth about 0.12
 * at a boundary and a perfect foundation 0.06. This is set to the first of
 * them, and the design statement is that equality:
 *
 *   AT A WALL, WHAT YOU HAVE LEFT UNFINISHED WEIGHS WHAT YOUR BODY WEIGHS.
 *
 * Above a perfect foundation, because a foundation is one crossing's worth of
 * preparation and this is a life's. Far below `MAX_LIFESPAN_PRESSURE` at -0.2
 * and nowhere near `BROKEN_STATUS_STRAIN` at -0.55, because neither of those
 * is a thing anybody can go and put right and this is.
 */
export const MAX_DAO_HEART_STRAIN = 0.12;

// ─────────────────────────────────────────────────────────────────────────
// THE READ
// ─────────────────────────────────────────────────────────────────────────

export interface WhatTheCrossingAsks {
    /** Distinct unfinished things, after kin copies are collapsed onto the deed. */
    open: number;
    /** Their total on the ledger's own scale, with the direction thrown away. */
    weight: number;
    /** The heaviest one standing, or null where the ledger holds nothing. */
    heaviest: Severity | null;
    /**
     * What the crossing is handed, 0..1.
     *
     * A share rather than a modifier, for the same reason `protection` is: the
     * size of the penalty is `breakthrough.ts`'s to own, and a caller that
     * computed one here would be a second opinion about what a boundary costs.
     */
    share: number;
    /** Engine truth, one line, for the mechanical channel. Never narration. */
    line: string;
}

/**
 * What the ledger says is unfinished about this person, as of a day.
 *
 * `ledger` is whatever `ledgerAbout(db, personId)` returned - both directions,
 * both statuses - and the filtering is done here so that no caller has to know
 * which rows count. A caller with nothing in hand passes an empty array and
 * gets a zero share, which books no line at all.
 */
export function whatACrossingAsksOfTheDaoHeart(input: {
    personId: string;
    ledger: readonly ObligationRecord[];
    /** Ignore anything incurred after this day. Omit to read everything. */
    asOfDay?: DayIndex;
}): WhatTheCrossingAsks {
    // Collapsed onto the DEED rather than the record, on
    // `personal-alignment.ts`'s rule and for its stated reason: a wrong done to
    // a man with nine brothers is not nine times the wrong done to an orphan,
    // and `inheritOnDeath` writes a copy per heir. Heaviest copy stands.
    const unfinished = new Map<string, Severity>();

    for (const record of input.ledger) {
        if (record.status !== 'open') continue;
        if (input.asOfDay !== undefined && record.incurredOnDay > input.asOfDay) continue;
        // A PARTY TO IT, either way round. The direction is read here and
        // nowhere else, and it is read only to decide whether this row is about
        // them at all - never to decide which of the two it is.
        if (record.holderId !== input.personId && record.subjectId !== input.personId) continue;

        const key = record.triggeringEventId
            ?? `${record.originHolderId}|${record.incurredOnDay}|${record.cause}`;
        const standing = unfinished.get(key);
        if (standing === undefined
            || WHAT_A_RECORD_COUNTS_FOR[record.severity] > WHAT_A_RECORD_COUNTS_FOR[standing]) {
            unfinished.set(key, record.severity);
        }
    }

    let weight = 0;
    let heaviest: Severity | null = null;
    for (const severity of unfinished.values()) {
        weight += WHAT_A_RECORD_COUNTS_FOR[severity];
        if (heaviest === null
            || WHAT_A_RECORD_COUNTS_FOR[severity] > WHAT_A_RECORD_COUNTS_FOR[heaviest]) {
            heaviest = severity;
        }
    }
    // Two places, so two callers comparing readings compare the same arithmetic
    // and not a float tail. Same rounding `personal-alignment.ts` uses.
    weight = Math.round(weight * 100) / 100;

    const share = Math.min(1, weight / A_LIFE_THAT_IS_ALL_LOOSE_ENDS);
    const open = unfinished.size;

    return { open, weight, heaviest, share, line: lineFor(open, weight, heaviest) };
}

function lineFor(open: number, weight: number, heaviest: Severity | null): string {
    if (open === 0) {
        return 'Nothing on the record is unfinished. A wall asks and there is nothing to answer.';
    }
    return `${open} unfinished ${open === 1 ? 'account' : 'accounts'} (${weight.toFixed(2)} of `
        + `${A_LIFE_THAT_IS_ALL_LOOSE_ENDS}), the heaviest ${heaviest}. Direction is not read: `
        + 'a thing owed and a thing owing weigh the same, and settling one is settling it '
        + 'whichever way it was settled.';
}
