/**
 * Where a probation ends, and who is placed where.
 *
 * Every threshold below is an existing engine quantity, and none of them is a
 * round number picked to feel right, which is the standard `AGENTS.md` sets for a
 * first age gate. The bar behind the door - `publishedDoor.membershipOrdinal` (3)
 * - is unmoved and decides only the failure branch; it never bends.
 *
 * THE TWO SPANS ARE ATTACHED IN ORDER AND THERE ARE ONLY TWO. Each answers a
 * different question - "did the house get what it paid for" and "is this still a
 * career" - and a fourth house under the Dew would inherit the Dew's answer,
 * which is no test, because there is no third question.
 */

import {
    FOUNDATION_ORDINAL,
    rankName
} from '../cultivation/realms.js';
import { stagnationYearsForOrdinal } from '../../schema/cultivation.js';
import { getSect } from '../../data/cultivation/sects.js';
import { getParentage, getSubsidiariesOf } from '../../data/cultivation/governance-and-water-rights.js';
import {
    guestTermYears,
    publishedDoorOf,
    shelfTopOf
} from './what-a-house-will-teach-somebody-it-has-not-taken.js';

// THE LADDER, WALKED RATHER THAN LISTED

/**
 * The chain of places somebody can be put, apex first.
 */
export function placementLadderFrom(apexId: string): string[] {
    const ladder = [apexId];
    const seen = new Set<string>([apexId]);
    let cursor = apexId;
    for (;;) {
        const below = getSubsidiariesOf(cursor)
            .map(p => p.factionId)
            .filter(id => !seen.has(id) && getSect(id) !== undefined);
        if (below.length === 0) break;
        below.sort((a, b) => {
            const barA = getSect(a)!.admissionOrdinal;
            const barB = getSect(b)!.admissionOrdinal;
            return barA - barB || a.localeCompare(b);
        });
        cursor = below[0];
        seen.add(cursor);
        ladder.push(cursor);
    }
    return ladder;
}

// THE SPANS

/**
 * How long each house on the ladder will have spent before it stops being
 * impressed, in years on the roll. `null` is no test at all.
 */
export function spansAlong(ladder: readonly string[]): (number | null)[] {
    const apex = ladder[0];
    return ladder.map((_, depth) => {
        if (depth === 0) return guestTermYears(apex);
        if (depth === 1) return stagnationYearsForOrdinal(0);
        return null;
    });
}

/**
 * The age at which this house stops being impressed by this particular person, or
 * null where it has no view.
 */
export function ageCeilingFor(
    ladder: readonly string[],
    depth: number,
    ageAtIntake: number
): number | null {
    const span = spansAlong(ladder)[depth] ?? null;
    return span === null ? null : ageAtIntake + span;
}

// THE JUDGEMENT

/** What the house decided, in one word. */
export type ProbationOutcome =
    /** Crossed, and placed on the chain. `factionId` says where. */
    | 'placed'
    /** Did not cross, cleared the membership bar, kept at the menial rung. */
    | 'kept'
    /** Did not cross, never reached the bar. No record anywhere but theirs. */
    | 'turned_out'
    /** Not yet. The house has not run out of patience and they have not crossed. */
    | 'carried';

/** Which of `AZURE_INTAKE.placements` this person is, where they crossed. */
export type ProbationBand = 'exceptional' | 'promising' | 'unformed';

export interface ProbationJudgement {
    outcome: ProbationOutcome;
    /** Where they end up. Null when turned out; the door's house when kept. */
    factionId: string | null;
    factionName: string | null;
    /** Set on `placed` only. */
    band: ProbationBand | null;
    /** Position on the ladder they were placed at. Null when not placed. */
    depth: number | null;
    /** Rank index they take. 0 everywhere: entry and the menial tier are both 0. */
    rankIndex: number;
    yearsOnTheRoll: number;
    ageAtIntake: number;
    ageNow: number;
    /** The ceiling the apex would have kept them under. Null if it has none. */
    apexAgeCeiling: number | null;
    /** Years left before the house decides, or 0 once it has. */
    yearsLeftToCross: number;
    /** Factual, engine-authored. Never a narrator's sentence. */
    reason: string;
}

export interface ProbationFacts {
    /** The house holding the published door. */
    hostFactionId: string;
    /** Where they stand now. */
    ordinal: number;
    /** Their age now, in years. */
    age: number;
    /** Years since the house took them onto the roll. */
    yearsOnTheRoll: number;
}

/**
 * What the house does about this person today. Somebody who has not crossed when
 * the house decides is turned out or kept on, and the split is the membership
 * bar: a probationer who reached it is kept at rank index 0, the menial tier that
 * 33 of 34 houses have and that `FIRST_RANK_THE_BAR_GOVERNS` in `members.ts`
 * already exempts from the admission bar by design.
 */
export function judgeProbation(facts: ProbationFacts): ProbationJudgement {
    const ladder = placementLadderFrom(facts.hostFactionId);
    const spans = spansAlong(ladder);
    const door = publishedDoorOf(facts.hostFactionId);
    const ageAtIntake = facts.age - facts.yearsOnTheRoll;

    // The line at which the house stops waiting. The deepest span on the
    // ladder that is a number - past it, the remaining houses have no test and
    // the only question left is whether the person crossed at all.
    const decidesAt = spans.reduce<number>(
        (deepest, span) => (span !== null && span > deepest ? span : deepest),
        0
    );
    const apexCeiling = ageCeilingFor(ladder, 0, ageAtIntake);

    const base = {
        yearsOnTheRoll: facts.yearsOnTheRoll,
        ageAtIntake,
        ageNow: facts.age,
        apexAgeCeiling: apexCeiling,
        rankIndex: 0
    };

    // They crossed
    if (facts.ordinal >= FOUNDATION_ORDINAL) {
        // The first house on the ladder whose span still covers them. A house
        // with no span covers everybody, which is why the walk always lands.
        let depth = ladder.length - 1;
        for (let i = 0; i < ladder.length; i++) {
            const span = spans[i];
            if (span === null || facts.yearsOnTheRoll <= span) { depth = i; break; }
        }
        const band: ProbationBand =
            depth === 0 ? 'exceptional' : depth === 1 ? 'promising' : 'unformed';
        const placed = ladder[depth];
        const ceiling = ageCeilingFor(ladder, depth, ageAtIntake);
        return {
            ...base,
            outcome: 'placed',
            factionId: placed,
            factionName: getSect(placed)?.name ?? placed,
            band,
            depth,
            yearsLeftToCross: 0,
            reason:
                `Crossed to ${rankName(FOUNDATION_ORDINAL)} in `
                + `${round1(facts.yearsOnTheRoll)} years on the roll, at ${round1(facts.age)}. `
                + (ceiling === null
                    ? `${getSect(placed)?.name ?? placed} keeps no clock and does not ask.`
                    : `${getSect(placed)?.name ?? placed} was still spending at `
                      + `${round1(ceiling)}.`)
                + (depth === 0
                    ? ''
                    : ` The house above stopped at ${round1(apexCeiling ?? 0)}.`)
        };
    }

    // They have not crossed, and the house is still spending
    if (facts.yearsOnTheRoll < decidesAt) {
        return {
            ...base,
            outcome: 'carried',
            factionId: facts.hostFactionId,
            factionName: getSect(facts.hostFactionId)?.name ?? facts.hostFactionId,
            band: null,
            depth: null,
            yearsLeftToCross: decidesAt - facts.yearsOnTheRoll,
            reason:
                `Standing at ${rankName(facts.ordinal)} after `
                + `${round1(facts.yearsOnTheRoll)} years on the roll. Nothing is decided until `
                + `${round1(decidesAt)}, which is ${round1(decidesAt - facts.yearsOnTheRoll)} `
                + 'years from now.'
        };
    }

    // The house decides, and they did not cross
    //
    // The bar behind the door is what splits it, and this is the one place in
    // the whole arrangement where that number does anything. It has not moved
    // and does not move here either.
    const bar = door?.membershipOrdinal ?? getSect(facts.hostFactionId)?.admissionOrdinal ?? 0;
    if (facts.ordinal >= bar) {
        return {
            ...base,
            outcome: 'kept',
            factionId: facts.hostFactionId,
            factionName: getSect(facts.hostFactionId)?.name ?? facts.hostFactionId,
            band: null,
            depth: 0,
            yearsLeftToCross: 0,
            reason:
                `${round1(facts.yearsOnTheRoll)} years on the roll and still at `
                + `${rankName(facts.ordinal)}. Kept at the menial rung: the bar of `
                + `${rankName(bar)} was met and ${rankName(FOUNDATION_ORDINAL)} was not, and a `
                + 'house that has spent this long on somebody has a use for them.'
        };
    }

    return {
        ...base,
        outcome: 'turned_out',
        factionId: null,
        factionName: null,
        band: null,
        depth: null,
        yearsLeftToCross: 0,
        reason:
            `${round1(facts.yearsOnTheRoll)} years on the roll and still at `
            + `${rankName(facts.ordinal)}, which is under the bar of ${rankName(bar)}. `
            + 'Turned out. The house keeps the register of who it took and has never once '
            + 'looked at the far larger register of who it did not.'
    };
}

// THE RECALL ROLL

/**
 * Whether somebody placed down the chain has outrun the house holding them.
 */
export function recallFrom(
    factionId: string,
    ordinal: number
): { toFactionId: string; toFactionName: string; pastTheShelfAt: number } | null {
    // Only meaningful for a house that sits UNDER a published door, so walk up
    // rather than down: find the body whose intake this house is part of.
    const apexId = apexHoldingTheDoorOver(factionId);
    if (apexId === null || apexId === factionId) return null;
    const top = shelfTopOf(factionId);
    if (top === null || ordinal <= top) return null;
    return {
        toFactionId: apexId,
        toFactionName: getSect(apexId)?.name ?? apexId,
        pastTheShelfAt: top
    };
}

/**
 * The house holding a published door somewhere above this one, or null.
 */
export function apexHoldingTheDoorOver(factionId: string): string | null {
    const seen = new Set<string>();
    let cursor: string | null = factionId;
    while (cursor && !seen.has(cursor)) {
        seen.add(cursor);
        if (publishedDoorOf(cursor) !== null) return cursor;
        cursor = getParentage(cursor)?.parentFactionId ?? null;
    }
    return null;
}

function round1(years: number): number {
    return Math.round(years * 10) / 10;
}
