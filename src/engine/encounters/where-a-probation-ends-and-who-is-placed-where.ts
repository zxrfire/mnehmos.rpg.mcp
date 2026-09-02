/**
 * Where a probation ends, and who is placed where.
 *
 * The other half of `what-a-house-will-teach-somebody-it-has-not-taken.ts`.
 * That file is how somebody gets onto a published door and what they are shown
 * while they are on it. This one is what happens at the far end, and until it
 * existed the far end did not: `guestWouldBeOfferedAPlace` - described in its
 * own comment as "the payoff for the whole arrangement" - had no caller
 * anywhere in `src/`, so the Pavilion took people in at the floor and nothing
 * in the world ever decided about them.
 *
 * ── NOTHING HERE IS NEW DESIGN ───────────────────────────────────────────
 *
 * `AZURE_INTAKE` in `src/data/cultivation/sects.ts` is the complete written
 * specification and was read by nothing at all - it is on the reachability
 * table in `docs/world/INDEX.md` under the sixteen constants with no consumer.
 * Its own words:
 *
 *   exceptional   probation at the Azure Cloud Pavilion itself, immediately
 *   promising     the Azure Mist Sect, which teaches the same forms more
 *                 slowly to people who have time to be taught
 *   unformed      the Azure Dew Sect, or more often found by it first and
 *                 admitted afterwards
 *
 * And the structure it sorts into is not invented here either. The Mist holds
 * from the Pavilion with `relation: 'subsidiary'` and is described in
 * `governance-and-water-rights.ts` as a feeder that holds "probationers, late
 * admissions, the refused-but-not-disqualified"; the Dew holds from the Mist,
 * one remove further. So the three-way sort is A READING OF THE AZURE GRANT
 * CHAIN, walked with `getSubsidiariesOf`, and not a table written next to it.
 * A fourth house granted under the Dew tomorrow lengthens the ladder here with
 * no edit - see {@link placementLadderFrom}.
 *
 * ── THE FOUR THINGS THAT DECIDE IT, AND WHERE EACH NUMBER COMES FROM ─────
 *
 * Every threshold below is an existing engine quantity. None of them is a
 * round number picked to feel right, which is the standard `AGENTS.md` sets
 * for a first age gate.
 *
 *   THE CROSSING           `FOUNDATION_ORDINAL` (13). The judgement is at
 *                          Foundation Establishment because that is the first
 *                          rung that is a realm rather than a layer, and it is
 *                          already the ladder's own name for it.
 *
 *   WHAT THE HOUSE SPENT   `guestTermYears` of the house holding the door.
 *                          At the Pavilion this is 24, and it is not a policy:
 *                          it is `shelfTop - WORKING_ROAD_CAP`, how much the
 *                          house is holding back, which is exactly what the
 *                          watching was careful about. Crossing inside it is
 *                          crossing inside what the terraces had already
 *                          committed to spending on you.
 *
 *   WHETHER IT IS STILL    `stagnationYearsForOrdinal(0)` (50). The world's own
 *   A CAREER               statement of how long a body may stand at one rung
 *                          before standing still kills it. Past this, a Qi
 *                          Condensation life is not a trajectory any more, and
 *                          this is the line at which the house stops waiting
 *                          and decides.
 *
 *   AND THE BAR BEHIND     `publishedDoor.membershipOrdinal` (3). Unchanged,
 *   THE DOOR               unmoved, and the one thing everybody misreads as
 *                          the door. It decides only the failure branch - see
 *                          below - and it never bends. `houseWouldOfferMembership`
 *                          already refuses to move it and says why.
 *
 * ── THE AGE GATE, AND WHY IT IS NOT A NUMBER OF YEARS OLD ────────────────
 *
 * This is the first age gate in the game and the precedent worth matching is
 * the Hollow Court's, whose cap is "a rate test wearing an age limit": it
 * reads trajectory, not youth, because reaching a rung inside a given span
 * says something the rung alone does not.
 *
 * So the ceiling here is an age and it is computed per person:
 *
 *     ceiling = the age they were when the house took them + the house's span
 *
 * A flat "under forty" would get the interesting cases backwards in both
 * directions. Somebody picked up off the road at sixty who crosses in eight
 * years has shown the terraces exactly what they watch for, and a flat cap
 * refuses them. A child taken at twelve who takes forty years has shown the
 * opposite, and a flat cap keeps them. The span test keeps the first and
 * places the second, which is what the catalog says the Pavilion is for.
 *
 * And selectivity descends the chain, which is the shape the owner asked for
 * and falls out of the two spans rather than being asserted:
 *
 *   Pavilion   24 years on the roll. Strictest, because it is the house
 *              paying, and the span is its own committed spend.
 *   Mist       50 years. Selective, and the selection is only that the person
 *              is still on a career at all - which is the Mist exactly: it
 *              teaches the same forms more slowly to people who have time.
 *   Dew        No span. The Dew's trade is finding rather than selecting, it
 *              measures itself in people it no longer has, and a house that
 *              works a village for two years before it asks anybody anything
 *              is not holding a clock.
 *
 * THE TWO SPANS ARE ATTACHED IN ORDER AND THERE ARE ONLY TWO, and that is
 * worth saying plainly rather than dressing up. Each answers a different
 * question - "did the house get what it paid for" and "is this still a
 * career" - and the chain happens to have exactly the right number of steps
 * for them. A fourth house under the Dew would inherit the Dew's answer, which
 * is no test, because there is no third question and inventing one here would
 * be exactly the arithmetic-in-a-lore-file that `AGENTS.md` forbids.
 *
 * ── THE FAILURE BRANCH, WHICH THE CATALOG ALREADY CONTAINS AN EXAMPLE OF ─
 *
 * Somebody who has not crossed when the house decides is turned out or kept
 * on, and the split is the membership bar: a probationer who reached it is a
 * cultivator the house can use and is kept at rank index 0, the menial and
 * probationary tier that 33 of 34 houses have and that
 * `FIRST_RANK_THE_BAR_GOVERNS` in `members.ts` already exempts from the
 * admission bar by design. Somebody who never reached it is turned out.
 *
 * This is not invented either. `member-yan-shuling` is on the Pavilion's roll
 * at `rankIndex: 0`, titled 'Sword Servant', standing at ordinal 5 - above the
 * bar of 3 and a long way below Foundation. That row is what the rule
 * produces, and `tests/` asserts that it still is.
 *
 * ── AND YOU CAN CLIMB OUT AFTERWARDS ─────────────────────────────────────
 *
 * "Movement is upward and it is ordinary... the Mist keeps a recall roll."
 * Read off the shelf rather than off a number: a house recalls somebody the
 * moment they have gone past what it can teach them, which is `shelfTopOf`.
 * Both the Mist and the Dew stop at 17, so somebody who reaches Core Formation
 * at either has outrun the house holding them and goes back up the gorge. It
 * needs no constant and no second table, and a house that acquires a deeper
 * book keeps its people longer without anybody editing this file.
 *
 * Being sent down is not a disgrace, and the reason is in `AZURE_INTAKE`: the
 * alternative everywhere else is the gate, with no record that you were there.
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

// ─────────────────────────────────────────────────────────────────────────
// THE LADDER, WALKED RATHER THAN LISTED
// ─────────────────────────────────────────────────────────────────────────

/**
 * The chain of places somebody can be put, apex first.
 *
 * Walks `getSubsidiariesOf` downward from the house that holds the door. At
 * the Azure grant this returns the Pavilion, the Mist and the Dew, in that
 * order, because that is the order the grant chain is in - the Mist holds from
 * the Pavilion and the Dew holds from the Mist.
 *
 * Where a house has more than one subsidiary the ladder takes the one with the
 * lowest admission bar, because the sort is downward and the next rung down is
 * the one that asks least. Ties break on id so the ladder is stable.
 *
 * Cycles are guarded because the parentage table is authored and a loop in it
 * would hang the judgement rather than fail it.
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

// ─────────────────────────────────────────────────────────────────────────
// THE SPANS
// ─────────────────────────────────────────────────────────────────────────

/**
 * How long each house on the ladder will have spent before it stops being
 * impressed, in years on the roll. `null` is no test at all.
 *
 * Two spans and no third, for the two questions stated in the file header. The
 * array is as long as the ladder; everything past the second step inherits the
 * bottom house's answer, which is no test.
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
 * The age at which this house stops being impressed by this particular
 * person, or null where it has no view.
 *
 * An age rather than a span, because an age is what a house at a gate can see -
 * and it is computed from the age they were taken at, so it is a rate test.
 */
export function ageCeilingFor(
    ladder: readonly string[],
    depth: number,
    ageAtIntake: number
): number | null {
    const span = spansAlong(ladder)[depth] ?? null;
    return span === null ? null : ageAtIntake + span;
}

// ─────────────────────────────────────────────────────────────────────────
// THE JUDGEMENT
// ─────────────────────────────────────────────────────────────────────────

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
 * What the house does about this person today.
 *
 * Pure, total, and deterministic - there is no draw in here, because the
 * catalog does not describe one. The Pavilion scores and places; it does not
 * roll. Everything the answer depends on is in {@link ProbationFacts} and the
 * catalogs.
 *
 * Returns `carried` while the house is still spending, which is the ordinary
 * answer for almost the whole of a probation and is why this is safe to call
 * on every read.
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

    // ── They crossed ─────────────────────────────────────────────────────
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

    // ── They have not crossed, and the house is still spending ───────────
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

    // ── The house decides, and they did not cross ────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────
// THE RECALL ROLL
// ─────────────────────────────────────────────────────────────────────────

/**
 * Whether somebody placed down the chain has outrun the house holding them.
 *
 * Read off the shelf, not off a rung: a house recalls somebody the moment
 * there is nothing left it can teach them, which is `shelfTopOf`. That is what
 * "somebody exceptional emerging at the Mist or the Dew" means in a world
 * where a house's depth is a number - and a house that acquires a deeper book
 * keeps its people longer with no edit here.
 *
 * Returns null for somebody at the apex already, or for a house whose shelf
 * still covers them.
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
 *
 * Walks the parentage upward the way `chainToApex` does, using the same table,
 * and stops at the first body that publishes a door. Null everywhere else,
 * which is almost everywhere - one house in the world publishes one.
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
