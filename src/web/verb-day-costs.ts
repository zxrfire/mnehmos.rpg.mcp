/**
 * How many days each verb spends, and how long a span may be.
 *
 * Split out of `actions.ts` because the reader, the plan schema and the pattern
 * table all need the defaults, and leaving them in place would have made those
 * three modules import each other in a circle.
 *
 * Single reason to change: what a verb costs in days, and what bounds a span.
 */

import type { Cultivator } from '../schema/cultivation.js';
import { DAYS_PER_YEAR } from '../engine/cultivation/cultivation.js';
import { UNBOUNDED_LIFESPAN_YEARS, rankName } from '../engine/cultivation/realms.js';
import {
    daysOfLifeRemaining,
    lifespanCeilingFor
} from '../engine/cultivation/survival.js';
import type { SpanUnit } from './sentence-parts.js';

/**
 * ── THE FLAT CENTURY, AND WHY IT IS STILL HERE ───────────────────────────
 *
 * One hundred years for everybody, and wrong in both directions at once: a
 * mortal could ask for a century they do not have, and somebody who could sit
 * for five hundred years could not. A flat constant standing where a rule
 * should be is the commonest way the agency rule gets broken, and it is
 * usually visible as being wrong in both directions like this.
 *
 * The bound is a lifespan. {@link daysOfLifeRemaining} is it, and
 * {@link aSpanPastTheEndOfThisLife} is how a caller asks whether a span fits
 * and gets the figure to say when it does not.
 *
 * This constant now decides nothing that is about a player. It survives only
 * because `turn-engine.ts` and the verb surface still spell it, and both are
 * other people's files this week.
 *
 * @deprecated Use {@link daysOfLifeRemaining}.
 */
export const MAX_CULTIVATION_DAYS = 36_500;

/**
 * Past this a number is not a span at all.
 *
 * What a SCHEMA can bound, and the whole of what it can: a static shape does
 * not know who is asking, so it cannot hold a rule about a body. It rejects
 * the absurd - a model that answers `1e400`, a field that arrived as
 * nonsense - and the real bound is applied where the cultivator is.
 *
 * Derived from the ladder's own marker for a span with no end, so it moves
 * when the ladder does.
 */
export const LONGER_THAN_ANY_LIFE = UNBOUNDED_LIFESPAN_YEARS * DAYS_PER_YEAR;

/** What the body a span is asked of has to be, for the bound to be read off it. */
export type ABodyASpanIsAskedOf =
    Pick<Cultivator, 'realmOrdinal' | 'age'> &
    Partial<Pick<Cultivator, 'immortalStatus' | 'physique'>>;

/** A span the sentence named, in the unit it named it in. */
export interface ASpanAsItWasSaid {
    readonly unitDays: number;
    readonly unit: SpanUnit;
}

const PLURAL: Readonly<Record<SpanUnit, string>> = {
    day: 'days',
    week: 'weeks',
    month: 'months',
    season: 'seasons',
    year: 'years',
    decade: 'decades',
    century: 'centuries'
};

/**
 * A figure in the unit it was asked in.
 *
 * Somebody who typed "a thousand years" is owed an answer in years. Falling
 * back to years rather than to days, because a span long enough to be refused
 * is never usefully said in days.
 */
function saidAs(days: number, saidIn?: ASpanAsItWasSaid | null): string {
    const unitDays = saidIn && saidIn.unitDays > 0 ? saidIn.unitDays : DAYS_PER_YEAR;
    const unit: SpanUnit = saidIn ? saidIn.unit : 'year';
    const count = days / unitDays;
    const shown = count >= 10 ? Math.round(count) : Math.round(count * 10) / 10;
    return `${shown} ${shown === 1 ? unit : PLURAL[unit]}`;
}

/**
 * What the engine knows about a span that runs past the end of the life
 * asking for it, or null when the span fits.
 *
 * THE REFUSAL CARRIES THE NUMBER. Somebody told they may have eighty years has
 * learned where they stand on the ladder and can say the thing they meant;
 * somebody told "that is too long" has been made to guess, and guessing at a
 * bound is the worst kind of turn to spend.
 *
 * Facts only. `line` states the three of them in one sentence and the narrator
 * says it like a person; nothing here is written to be read aloud as it stands.
 */
export interface ASpanPastTheEndOfThisLife {
    readonly requestedDays: number;
    /** The whole of what is left. A span exactly this long is accepted. */
    readonly daysLeft: number;
    readonly rank: string;
    readonly age: number;
    readonly ceilingYears: number;
    readonly line: string;
}

export function aSpanPastTheEndOfThisLife(
    cultivator: ABodyASpanIsAskedOf,
    requestedDays: number,
    saidIn?: ASpanAsItWasSaid | null
): ASpanPastTheEndOfThisLife | null {
    const asked = Math.floor(requestedDays);
    const daysLeft = daysOfLifeRemaining(cultivator);
    if (!(asked > daysLeft)) return null;

    const rank = rankName(cultivator.realmOrdinal);
    const age = Math.floor(cultivator.age);
    const ceilingYears = Math.round(lifespanCeilingFor(cultivator));
    return {
        requestedDays: asked,
        daysLeft,
        rank,
        age,
        ceilingYears,
        line:
            `${saidAs(asked, saidIn)} was asked for. ${saidAs(daysLeft, saidIn)} is the whole `
            + `of what is left: ${rank}, age ${age} of a ${ceilingYears}-year ceiling.`
    };
}

/** Days of seclusion assumed when the player says "cultivate" with no duration. */
export const DEFAULT_CULTIVATION_DAYS = 30;

/** Days a stretch of technique practice consumes. */
export const TRAINING_DAYS = 7;

/** Days a stretch of foraging consumes. */
export const GATHERING_DAYS = 7;

/**
 * Days a stretch of hunting consumes.
 *
 * Longer than foraging because the thing being looked for moves and most of
 * the work is finding it. `ESTIMATING_A_BEAST` in the catalog says the
 * reliable tell is absence - how far out the ordinary animals have gone -
 * and reading that is walking, not digging.
 */
export const HUNTING_DAYS = 10;

/** Days a burial takes when no duration is named. A week with a spade. */
export const DEFAULT_BURIAL_DAYS = 7;

/** Days sealed closed-door seclusion runs for when no duration is named. */
export const DEFAULT_SECLUSION_DAYS = 365;

/**
 * Days of work assumed when the player says "take work" with no duration.
 *
 * A season. Long enough to be worth the walk and short enough that a hungry
 * cultivator is not committing the rest of their life to a granary.
 */
export const DEFAULT_WORK_DAYS = 90;
