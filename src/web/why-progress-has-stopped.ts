/**
 * WHY THIS CULTIVATOR IS NOT GETTING ANY FURTHER, IN THE ORDER IT BINDS.
 *
 * The world layer models the pressure in detail - a manual stops carrying, a
 * province has a rung nobody in it has passed, a hall above somebody is full,
 * the ladder credits a finite number of years at a rung - and none of it
 * reached a player who typed "why am I not making progress". Measured over the
 * real `/api/act` endpoint by `scripts/playtest-the-drive.mjs`: five plain
 * phrasings of that question, none answered, four refused outright and the
 * fifth answered with a read of somebody else's opinion of them.
 *
 * A ceiling nobody can ask about is indistinguishable from a slow game, and
 * this project has already paid for that once: twelve honest lives ended in
 * stagnation at ordinal 0 after fifty years of two-year seclusions, with
 * nothing anywhere saying why.
 *
 * ── NOTHING HERE DECIDES ANYTHING ────────────────────────────────────────
 *
 * Every line this module produces is a restatement of a number somebody else
 * computed. It holds no thresholds, no rates and no arithmetic beyond
 * subtracting two ordinals to say how far apart they are. In particular:
 *
 *   the manual axis   is `techniqueCeiling(...)` from the cultivation engine,
 *                     which already writes the sentence. This module reformats
 *                     it and adds the two numbers the sentence implies.
 *   the region axis   is `canAdvanceHere(regionId, ordinal)` and the region's
 *                     own `localCeilingOrdinal`.
 *   the seat axis     is `requiredOrdinalForRank` / `requiredContributionForRank`,
 *                     which is what `handlePromote` ITSELF gates on - so the
 *                     answer and the gate cannot drift apart.
 *   the qi axis       is the ambient band already rolled for where they stand.
 *   the clock         is `stagnationYearsForOrdinal` against `yearsAtCurrentRealm`,
 *                     the same pair `stagnation_aging` kills on.
 *
 * If a caller passes a number this module will repeat it. That is the whole
 * contract: it is a renderer, and the engine remains the only thing that knows
 * anything.
 *
 * ── WHY NOT `blockedAt` ──────────────────────────────────────────────────
 *
 * `promotion-inside-a-house.ts` exports `blockedAt(state, npc)`, which is the
 * right read for the seat axis and takes an `NpcRecord` out of `WorldState`.
 * The player is not one: they are a row in the `cultivators` table with a
 * membership in `sect_members`, and they never enter `state.npcs`. Reaching
 * `blockedAt` for them would mean synthesising an NpcRecord to hand it, which
 * is manufacturing state to read it back - exactly the move the authority rule
 * forbids. So the seat axis reads the player's own gate instead, which is the
 * one `handlePromote` enforces. The two answer different populations on
 * purpose and neither is a copy of the other.
 *
 * ── THE REGISTER ─────────────────────────────────────────────────────────
 *
 * Name the thing, name the bar, name where they are standing. The model is the
 * sect admission line, which is the one question in this game that already
 * answered well: "Nine Abyss Flame Sect admits from Qi Condensation Layer 9.
 * Shi Wanjun stands at Qi Condensation Layer 6." Three facts, no atmosphere,
 * and a player can act on it without asking a second question.
 */

import { rankName } from '../engine/cultivation/realms.js';
import type { TechniqueCeiling } from '../engine/cultivation/cultivation.js';
import type { AmbientQi } from '../schema/cultivation.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT A GATE IS
// ─────────────────────────────────────────────────────────────────────────

/**
 * The six things that can be stopping somebody, and one that is not stopping
 * them at all.
 *
 * `open` is a real member rather than an empty list, because "nothing is in
 * your way" is an answer to "why am I stuck" and a player who gets silence
 * instead cannot tell it from a bug.
 */
export type GateKind =
    | 'no_method'
    | 'manual_exhausted'
    | 'region_ceiling'
    | 'thin_qi'
    | 'seat'
    | 'progress'
    | 'clock'
    | 'open';

export interface Gate {
    kind: GateKind;
    /**
     * Whether this one is actually holding them where they are.
     *
     * A hard gate multiplies the rate by zero, so nothing else matters while it
     * stands. A soft one is a cost. The difference decides ordering and
     * decides which lines are `required` - see {@link CeilingRead}.
     */
    hard: boolean;
    /** Named thing, named bar, named where they stand. One or two sentences. */
    line: string;
    /** For the inspector. Never shown to a narrator. */
    structure: string;
}

export interface CeilingRead {
    headline: string;
    lines: string[];
    /**
     * The lines a player must end up reading whatever the narrator does.
     *
     * Only hard gates. A model that drops "there is no book" leaves somebody
     * sitting in a cave for fifty years, which is the measured failure this
     * channel exists for; a model that drops "you are eight years into a
     * fifty-year allowance" has dropped a detail.
     */
    required: string[];
    structure: string[];
    gates: Gate[];
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE CALLER HAS TO HAVE READ ALREADY
// ─────────────────────────────────────────────────────────────────────────

/** The player's seat, when they hold one. Every figure is the sect gate's own. */
export interface SeatStanding {
    sectName: string;
    rankTitle: string;
    /** Null when they are on the top rung and there is nothing above it. */
    nextRankTitle: string | null;
    /** `requiredOrdinalForRank(admissionOrdinal, nextIndex)`. */
    requiredOrdinal: number;
    /** `requiredContributionForRank(nextIndex)`. */
    requiredContribution: number;
    contribution: number;
}

export interface CeilingInput {
    name: string;
    ordinal: number;

    /** `techniqueCeiling(ordinal, techniqueCap)`. Already written by the engine. */
    manual: TechniqueCeiling;
    /** The cap that produced it, for the two-number form. Null means uncapped. */
    manualCap: number | null;

    regionName: string;
    /** The region's own `localCeilingOrdinal`. */
    localCeilingOrdinal: number;
    /** `canAdvanceHere(regionId, ordinal)`. Passed, never recomputed. */
    canAdvanceHere: boolean;

    /** The band rolled for where they are standing. */
    ambient: AmbientQi;

    seat: SeatStanding | null;

    /** `canAttemptBreakthrough(...)`. Null required means nothing above is priced in qi. */
    progressRequired: number | null;
    progressAvailable: number;
    eligible: boolean;

    yearsAtCurrentRealm: number;
    /** `stagnationYearsForOrdinal(ordinal)`. */
    stagnationYears: number;
}

// ─────────────────────────────────────────────────────────────────────────
// THE READ
// ─────────────────────────────────────────────────────────────────────────

const round = (n: number): number => Math.round(n);

/**
 * Every gate, hardest first, with the binding one at the top.
 *
 * Order is deliberate and is the order the advice differs in. Somebody with no
 * manual should not be told about their sect's contribution requirement first:
 * one of those is a wall and the other is a queue, and putting the queue on
 * line one is how a player spends a decade on the wrong problem.
 */
export function whyProgressHasStopped(input: CeilingInput): CeilingRead {
    const gates: Gate[] = [];
    const standing = rankName(input.ordinal);

    // ── the manual, which is the only axis that can make everything else
    //    irrelevant. `techniqueCeiling` already decided; this restates it in
    //    the two-number form and keeps the engine's own sentence beside it.
    if (input.manual.state === 'no_method') {
        gates.push({
            kind: 'no_method',
            hard: true,
            line:
                `You are practising no cultivation method. Without a manual there is no road `
                + `for the qi to take, so nothing accumulates at ${standing} and nothing will. `
                + `What is missing is a book, or somebody willing to teach you one.`,
            structure:
                'No method is practised, so the manual carries to ordinal 0 and the rate '
                + 'multiplier is 0. A stretch of any length returns exactly nothing.'
        });
    } else if (input.manual.state === 'exhausted') {
        const cap = input.manualCap ?? input.ordinal;
        gates.push({
            kind: 'manual_exhausted',
            hard: true,
            line:
                `Your manual carries to ${rankName(cap)}. You are standing at ${standing}. `
                + `It is not slower here, it is stopped, and no amount of sitting with it `
                + `changes that. What is missing is the next volume.`,
            structure:
                `The manual carries to ordinal ${cap} and this cultivator stands at ordinal `
                + `${input.ordinal}, so the rate multiplier past it is 0. A stretch of any `
                + `length returns exactly nothing.`
        });
    }

    // ── the ground. A region is done with somebody at its own local ceiling,
    //    and that is a fact about the province rather than about them.
    if (!input.canAdvanceHere) {
        gates.push({
            kind: 'region_ceiling',
            hard: true,
            line:
                `${input.regionName} carries nobody past ${rankName(input.localCeilingOrdinal)}. `
                + `You are standing at ${standing}. The ground here has nothing further to give `
                + `you unaided: buy access, buy stones, or leave.`,
            structure:
                `${input.regionName} carries nobody past ordinal `
                + `${input.localCeilingOrdinal} and this cultivator stands at ordinal `
                + `${input.ordinal}, so the ground here cannot take them further unaided.`
        });
    }

    // ── the air. Thin qi is a cost rather than a wall, and saying so is the
    //    point: a player who reads "half rate" as "impossible" leaves ground
    //    they could still have used.
    if (input.ambient === 'thin') {
        gates.push({
            kind: 'thin_qi',
            hard: false,
            line:
                `The qi where you are standing is thin: half rate, and a penalty at the `
                + `bottleneck. This slows you, it does not stop you.`,
            structure:
                'The qi band here is thin: half the cultivation rate, and a penalty at the '
                + 'bottleneck. A cost rather than a wall.'
        });
    }

    // ── the seat. Read off the same two functions promotion itself gates on.
    if (input.seat && input.seat.nextRankTitle !== null) {
        const seat = input.seat;
        const unmet: string[] = [];
        if (input.ordinal < seat.requiredOrdinal) {
            unmet.push(
                `${seat.nextRankTitle} wants ${rankName(seat.requiredOrdinal)} and you stand `
                + `at ${standing}`
            );
        }
        if (seat.contribution < seat.requiredContribution) {
            unmet.push(
                `it wants ${seat.requiredContribution} contribution and you have `
                + `${seat.contribution}`
            );
        }
        if (unmet.length > 0) {
            gates.push({
                kind: 'seat',
                hard: false,
                line:
                    `${seat.sectName} has you at ${seat.rankTitle}. To raise you to `
                    + `${seat.nextRankTitle}, ${unmet.join('; and ')}.`,
                structure:
                    `${seat.nextRankTitle} wants ordinal ${seat.requiredOrdinal} against `
                    + `ordinal ${input.ordinal} held, and ${seat.requiredContribution} `
                    + `contribution against ${seat.contribution} held.`
            });
        }
    } else if (input.seat) {
        gates.push({
            kind: 'seat',
            hard: false,
            line:
                `${input.seat.sectName} has you at ${input.seat.rankTitle}, which is the top `
                + `of this house. There is nowhere further inside these walls.`,
            structure: 'This is the highest rank the house has; there is no seat above it.'
        });
    }

    // ── the qi they have gathered, which is the one thing sitting still fixes.
    if (input.progressRequired !== null && !input.eligible) {
        const short = input.progressRequired - input.progressAvailable;
        if (short > 0) {
            gates.push({
                kind: 'progress',
                hard: false,
                line:
                    `The rung above ${standing} is priced at ${round(input.progressRequired)} `
                    + `qi-units. You hold ${round(input.progressAvailable)}, which is `
                    + `${round(short)} short.`,
                structure:
                    `The rung above ordinal ${input.ordinal} is priced at `
                    + `${round(input.progressRequired)} qi-units and `
                    + `${round(input.progressAvailable)} are held, which is `
                    + `${round(short)} short.`
            });
        }
    }

    // ── the clock, which is the one that kills. `stagnation_aging` is a real
    //    cause of death and it arrives without a warning shot.
    if (input.stagnationYears > 0) {
        const past = input.yearsAtCurrentRealm - input.stagnationYears;
        gates.push({
            kind: 'clock',
            hard: past >= 0,
            line: past >= 0
                ? `You have held ${standing} for ${round(input.yearsAtCurrentRealm)} years `
                  + `against the ${round(input.stagnationYears)} the ladder credits. You are `
                  + `${round(past)} years past the point where sitting still stops being `
                  + `patience and starts being how this ends.`
                : `You have held ${standing} for ${round(input.yearsAtCurrentRealm)} years of `
                  + `the ${round(input.stagnationYears)} the ladder credits. `
                  + `${round(-past)} still counted.`,
            structure: past >= 0
                ? `${round(input.yearsAtCurrentRealm)} years held at ordinal `
                  + `${input.ordinal} against the ${round(input.stagnationYears)} the ladder `
                  + `credits before settling: ${round(past)} years past it.`
                : `${round(input.yearsAtCurrentRealm)} years held at ordinal `
                  + `${input.ordinal} of the ${round(input.stagnationYears)} the ladder `
                  + `credits before settling, with ${round(-past)} still counted.`
        });
    }

    // Nothing in the way is an answer, and it has to be said out loud.
    const blocking = gates.filter(g => g.kind !== 'clock' || g.hard);
    if (blocking.length === 0) {
        gates.unshift({
            kind: 'open',
            hard: false,
            line:
                `Nothing is stopping you. Your manual still has further to teach, `
                + `${input.regionName} still carries somebody at ${standing}, and the road up `
                + `is the ordinary one: accumulate, and attempt it.`,
            structure: 'No gate is binding: no wall, no ceiling, no clock run out.'
        });
    }

    // Hard first, and within that the order they were found, which is the
    // order the advice differs in.
    gates.sort((a, b) => Number(b.hard) - Number(a.hard));

    const hard = gates.filter(g => g.hard);
    return {
        headline: hard.length > 0
            ? `What is stopping ${input.name}: ${headlineFor(hard[0].kind)}.`
            : `Nothing is stopping ${input.name} outright.`,
        lines: gates.map(g => g.line),
        required: hard.map(g => g.line),
        structure: gates.map(g => g.structure),
        gates
    };
}

/** The short form of each gate, for the overlay title. Never a new fact. */
function headlineFor(kind: GateKind): string {
    switch (kind) {
        case 'no_method': return 'there is no manual';
        case 'manual_exhausted': return 'the manual has ended';
        case 'region_ceiling': return 'the province has no more to give';
        case 'thin_qi': return 'the qi here is thin';
        case 'seat': return 'the seat above is not theirs yet';
        case 'progress': return 'there is not enough qi gathered yet';
        case 'clock': return 'the years have run out';
        case 'open': return 'nothing';
    }
}
