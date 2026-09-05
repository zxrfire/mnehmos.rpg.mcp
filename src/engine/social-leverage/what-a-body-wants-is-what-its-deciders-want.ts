/**
 * What a body wants, read off the people who decide in it - and off what the person
 * asking has already done to them. The design owner: *"Sects are an amalgamation of
 * what their upper echelon thinks. same for families, some can pressure or sell off
 * their daughter, some won't. the same system should apply for free, based on
 * character traits, motivations."* And on the tiers: *"elders can not like it, a
 * patriarch can overrule. and a patriarch can only be overruled again when all the
 * elders disagree."*
 */

import type { DayIndex } from '../social/common.js';
import type { ObligationRecord, Severity } from '../social/grudges.js';
import {
    FOLLOWING_SENIORITY_EXPONENT,
    isHeadOfHouse,
    isElderRank
} from '../cultivation/leadership.js';
import {
    DISPOSITION_BANDS,
    openHandednessOf
} from './how-freely-somebody-parts-with-what-they-have.js';
import {
    WHAT_A_RECORD_COUNTS_FOR,
    WHAT_MAKES_IT_A_METHOD
} from './personal-alignment.js';

/**
 * One person on a body's roll: two fields every roster already carries, and
 * deliberately nothing else.
 */
export interface OnTheRoll {
    id: string;
    /** Their rung on this body's own ladder. Negative for somebody unaffiliated. */
    rankIndex: number;
}

/**
 * What the ledger between a decider and the asker has done to them. Reported
 * rather than folded away: a player's problem is which elder and what it would
 * take, which needs the two terms kept apart.
 */
export interface WhatMovedThem {
    /** Distinct favours this person owes the asker. */
    favoursOwed: number;
    /** Distinct wrongs this person holds about the asker. */
    wrongsHeld: number;
    /** The heaviest thing standing either way, or null. */
    heaviest: Severity | null;
}

/** One decider, read. */
export interface TheirSay {
    id: string;
    rankIndex: number;
    /** True for the head of the house. At most one person in a body. */
    isHead: boolean;
    /** What they are, before anybody did anything to them. */
    baseline: number;
    /** What the asker has already done to them. Zero with no asker and no rows. */
    moved: number;
    /** `baseline + moved`, held to the axis. What the tiers actually weigh. */
    reading: number;
    /** What the sway was made of. Empty counts where nothing was done. */
    whatMovedThem: WhatMovedThem;
    /**
     * How heavily their voice counts. `distributeFollowing`'s own weight. The
     * head is weighed like anybody else at tier one: a head who agrees with
     * their elders has overruled nobody.
     */
    weight: number;
}

/**
 * The range a reading is held to. A caller supplying another `readingOf` MUST be
 * on -1..+1, because the disagreement bar below is an absolute distance rather
 * than a fraction.
 */
const AXIS = 1;

/**
 * How much of the axis one run of deeds is worth. `WHAT_MAKES_IT_A_METHOD` is
 * the divisor rather than a new constant, so one `unforgivable` favour, two
 * `grave` ones or forty `slight` ones each move a decider the whole width.
 */
function swayFrom(bands: ReadonlyMap<string, Severity>): number {
    let sum = 0;
    for (const severity of bands.values()) sum += WHAT_A_RECORD_COUNTS_FOR[severity];
    return sum / WHAT_MAKES_IT_A_METHOD;
}

/**
 * What one person carries about another, off the ledger and nothing else. OWED is a
 * `favor` the asker holds over the decider; HELD is a `grudge` or `blood_feud` the
 * decider holds about the asker.
 */
export function whatTheyCarryAbout(input: {
    deciderId: string;
    askerId: string;
    ledger: readonly ObligationRecord[];
    asOfDay?: DayIndex;
}): { moved: number; whatMovedThem: WhatMovedThem } {
    const owed = new Map<string, Severity>();
    const held = new Map<string, Severity>();

    for (const record of input.ledger) {
        if (record.status !== 'open') continue;
        if (input.asOfDay !== undefined && record.incurredOnDay > input.asOfDay) continue;

        const theyOweTheAsker =
            record.kind === 'favor'
            && record.holderId === input.askerId
            && record.subjectId === input.deciderId;
        const theyHoldAWrong =
            (record.kind === 'grudge' || record.kind === 'blood_feud')
            && record.holderId === input.deciderId
            && record.subjectId === input.askerId;
        if (!theyOweTheAsker && !theyHoldAWrong) continue;

        // A record and a deed are not the same thing. See above.
        const key = record.triggeringEventId
            ?? `${record.originHolderId}|${record.incurredOnDay}|${record.cause}`;
        const into = theyOweTheAsker ? owed : held;
        const standing = into.get(key);
        if (
            standing === undefined
            || WHAT_A_RECORD_COUNTS_FOR[record.severity] > WHAT_A_RECORD_COUNTS_FOR[standing]
        ) {
            into.set(key, record.severity);
        }
    }

    let heaviest: Severity | null = null;
    for (const severity of [...owed.values(), ...held.values()]) {
        if (
            heaviest === null
            || WHAT_A_RECORD_COUNTS_FOR[severity] > WHAT_A_RECORD_COUNTS_FOR[heaviest]
        ) {
            heaviest = severity;
        }
    }

    return {
        moved: round4(swayFrom(owed) - swayFrom(held)),
        whatMovedThem: { favoursOwed: owed.size, wrongsHeld: held.size, heaviest }
    };
}

/**
 * Everybody in a body who has a say. `rankCount` is the body's own ladder
 * length, which makes "the elders" mean the same in a four-rung court and a
 * six-rung pavilion. No ladder means nobody decides.
 */
export function whoDecidesIn(input: {
    roll: readonly OnTheRoll[];
    rankCount: number;
    asking?: string | null;
    ledger?: readonly ObligationRecord[];
    readingOf?: (personId: string) => number;
    asOfDay?: DayIndex;
}): TheirSay[] {
    if (input.rankCount <= 0) return [];
    const readingOf = input.readingOf ?? openHandednessOf;
    const asker = input.asking ?? null;
    const ledger = input.ledger ?? [];

    const out: TheirSay[] = [];
    for (const person of input.roll) {
        if (person.rankIndex < 0) continue;
        if (!isElderRank(person.rankIndex, input.rankCount)) continue;

        const raw = readingOf(person.id);
        const baseline = Number.isFinite(raw) ? raw : 0;
        const sway = asker === null
            ? { moved: 0, whatMovedThem: { favoursOwed: 0, wrongsHeld: 0, heaviest: null } }
            : whatTheyCarryAbout({
                deciderId: person.id,
                askerId: asker,
                ledger,
                ...(input.asOfDay === undefined ? {} : { asOfDay: input.asOfDay })
            });

        out.push({
            id: person.id,
            rankIndex: person.rankIndex,
            isHead: isHeadOfHouse(person.rankIndex, input.rankCount),
            baseline: round4(baseline),
            moved: sway.moved,
            // Held to the axis. `moved` stays UNCLAMPED beside it so a player
            // sees the full weight of what they put in past the point it buys.
            reading: round4(Math.max(-AXIS, Math.min(AXIS, baseline + sway.moved))),
            whatMovedThem: sway.whatMovedThem,
            weight: Math.pow(person.rankIndex + 1, FOLLOWING_SENIORITY_EXPONENT)
        });
    }

    // Heaviest voice first, then by id. Deterministic: a caller rendering the
    // room must show the same people in the same order twice.
    out.sort((a, b) => b.weight - a.weight || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
}

/** Which of the three tiers produced the answer. */
export type SettledBy =
    /** The weighted mean of the room. The ordinary case. */
    | 'the elders'
    /** The head of the house, over a room that wanted something else. */
    | 'the head'
    /** The room, unanimous, over a head who was alone in it. */
    | 'the elders, unanimous against the head';

export interface WhereTheBodyLands {
    /**
     * The body's answer. NULL, not zero, where nobody in this body decides
     * anything: a caller must read that as "there is no house to ask" rather
     * than as neutrality.
     */
    leaning: number | null;
    settledBy: SettledBy | null;
    /**
     * The one person the answer turned on. A player's problem is WHICH ELDER,
     * not what the house thinks. Which person depends on the tier: the elder
     * pulling hardest on the mean, or the head, or the elder furthest from the
     * head - each right for its own tier, not one formula stretched over three.
     */
    whoMovedIt: TheirSay | null;
    /**
     * Who is on the losing side of an overrule. THIS IS WHAT A CALLER CHARGES
     * FOR. Nothing here spends anything; `leadership.ts` owns what an act
     * against the room costs, and pricing it again here would be a second
     * governance system.
     */
    against: readonly TheirSay[];
    /** Everybody who had a say, heaviest voice first. */
    theRoom: readonly TheirSay[];
    /** Engine truth, one line, for the mechanical channel. Never narration. */
    line: string;
}

/**
 * How far from the head an elder must stand to count as disagreeing. Borrowed
 * rather than chosen: a second constant here would be a second opinion about
 * what a large gap is.
 */
export const A_REAL_DISAGREEMENT = DISPOSITION_BANDS.WORTH_SAYING;

/**
 * How many people it takes before a room can overrule its head. The design
 * owner: *"in the case of 1 elder and 1 seat the seat wins. 2 or more elders,
 * and the patriarch can be overruled."* Named for the rule rather than the
 * number, so the number can move without the name lying.
 */
export const ENOUGH_TO_BE_A_BODY = 2;

/**
 * What a body wants, from the people who decide in it.
 */
export function whatTheBodyWants(input: {
    /** The body's roll. Only the ranks that decide are read. */
    roll: readonly OnTheRoll[];
    /** Length of the body's own rank ladder. */
    rankCount: number;
    /** Who is asking. Omit for the baseline alone. */
    asking?: string | null;
    /** Everything the ledger holds between the asker and these deciders. */
    ledger?: readonly ObligationRecord[];
    /**
     * A person to a number, on whatever axis is being asked about. Defaults to
     * the one leaning this world writes for everybody. Must be on -1..+1.
     */
    readingOf?: (personId: string) => number;
    /** Ignore anything incurred after this day. Omit to read everything. */
    asOfDay?: DayIndex;
}): WhereTheBodyLands {
    const room = whoDecidesIn(input);
    if (room.length === 0) {
        return {
            leaning: null,
            settledBy: null,
            whoMovedIt: null,
            against: [],
            theRoom: [],
            line: 'Nobody in this body decides anything - there is no roll, no ladder, or '
                + 'nobody standing high enough on one. That is not the house being neutral, it '
                + 'is there being no house to ask.'
        };
    }

    const head = room.find(p => p.isHead) ?? null;
    const elders = room.filter(p => !p.isHead);

    // TIER ONE. The head is counted in the mean: a head who agrees with the room
    // has overruled nobody, so they are one more voice, the heaviest.
    const mean = weightedMean(room);

    if (head === null || elders.length === 0) {
        return {
            leaning: mean,
            settledBy: 'the elders',
            whoMovedIt: pullingHardest(room, mean),
            against: [],
            theRoom: room,
            line: head === null
                ? `The elders answer and there is nobody seated above them. Weighted across `
                  + `${room.length}, the body lands at ${mean.toFixed(3)}.`
                : 'Nobody stands at an elder rung, so the head of the house is the whole of the '
                  + `room and the body lands at ${mean.toFixed(3)}.`
        };
    }

    const elderMean = weightedMean(elders);
    const apart = elders.map(e => e.reading - head.reading);

    // TIER THREE, ASKED BEFORE TIER TWO. The narrower condition, and it is tier
    // two that gets taken back: the question is whether the head's overrule
    // survives, not whether it happens. Do not reorder these two blocks.
    const allBelow = apart.every(d => d <= -A_REAL_DISAGREEMENT);
    const allAbove = apart.every(d => d >= A_REAL_DISAGREEMENT);
    if (elders.length >= ENOUGH_TO_BE_A_BODY && (allBelow || allAbove)) {
        return {
            leaning: elderMean,
            settledBy: 'the elders, unanimous against the head',
            whoMovedIt: furthestFrom(elders, head.reading),
            against: [head],
            theRoom: room,
            line: `All ${elders.length} elders stand ${allAbove ? 'above' : 'below'} the head of `
                + `the house by more than ${A_REAL_DISAGREEMENT}. The head is overruled and the `
                + `body lands at ${elderMean.toFixed(3)} rather than `
                + `${head.reading.toFixed(3)}. A head who is alone in the room does not hold it.`
        };
    }

    // TIER TWO. The head overrules, and somebody else charges for it.
    if (Math.abs(head.reading - elderMean) >= A_REAL_DISAGREEMENT) {
        const overruled = elders.filter(
            e => Math.abs(e.reading - head.reading) >= A_REAL_DISAGREEMENT
        );
        return {
            leaning: head.reading,
            settledBy: 'the head',
            whoMovedIt: head,
            against: overruled,
            theRoom: room,
            line: `The room would have landed at ${elderMean.toFixed(3)} and the head of the `
                + `house is at ${head.reading.toFixed(3)}. They overrule it, over `
                + `${overruled.length} of ${elders.length} elders far enough away to mind, and `
                + 'what that costs them with those people is charged where standing is kept.'
        };
    }

    return {
        leaning: mean,
        settledBy: 'the elders',
        whoMovedIt: pullingHardest(room, mean),
        against: [],
        theRoom: room,
        line: 'The head of the house and the room are not far enough apart for anybody to be '
            + `overruling anybody. Weighted across ${room.length} people, the body lands at `
            + `${mean.toFixed(3)}.`
    };
}

function weightedMean(people: readonly TheirSay[]): number {
    let total = 0;
    let weights = 0;
    for (const p of people) {
        total += p.reading * p.weight;
        weights += p.weight;
    }
    // Unreachable by construction, kept so the division cannot produce NaN.
    if (weights <= 0) return 0;
    return round4(total / weights);
}

/**
 * Whose voice the mean stands where it does because of. `weight * |reading -
 * mean|` and not the largest weight or the most extreme reading: a senior elder
 * who agrees with everybody has moved nothing, and a junior one at the far end
 * has barely been heard.
 */
function pullingHardest(people: readonly TheirSay[], mean: number): TheirSay | null {
    let best: TheirSay | null = null;
    let bestPull = -1;
    for (const p of people) {
        const pull = p.weight * Math.abs(p.reading - mean);
        if (pull > bestPull || (pull === bestPull && best !== null && p.id < best.id)) {
            best = p;
            bestPull = pull;
        }
    }
    return best;
}

/** The person standing furthest from a given reading. Ties broken by id. */
function furthestFrom(people: readonly TheirSay[], reading: number): TheirSay | null {
    let best: TheirSay | null = null;
    let bestGap = -1;
    for (const p of people) {
        const gap = Math.abs(p.reading - reading);
        if (gap > bestGap || (gap === bestGap && best !== null && p.id < best.id)) {
            best = p;
            bestGap = gap;
        }
    }
    return best;
}

function round4(n: number): number {
    return Math.round(n * 1e4) / 1e4;
}
