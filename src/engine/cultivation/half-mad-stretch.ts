/**
 * What somebody does with a month they were not entirely steering.
 *
 * Thirty days nobody steered is what the time-skip primitive exists for -
 * *"the agent must never be required to simulate time day by day"* - resolved
 * deterministically and handed back as a digest.
 */

import type { CultivationRNG } from './rng.js';
import type { InjurySeverity, InsightDegree, InsightDomain } from '../../schema/cultivation.js';
import { progressRequiredForOrdinal, rankName } from './realms.js';
import { rollInjurySeverity } from './injuries.js';

/** What the stretch is being resolved against. Read, never written. */
export interface StretchContext {
    /** The rung they actually own. */
    ownOrdinal: number;
    /** The rung they read as while carrying the thing. Fractional. */
    standsAt: number;
    /**
     * How much larger than their own body they read while carrying it.
     */
    bodyMultiplier: number;
    /** Their pool, so a cost can be a share of it rather than a flat number. */
    maxHp: number;
    /** What is in the purse, so spending it is a real event. */
    spiritStones: number;
}

/** One thing that happened. Deltas are signed and clamped by the repository. */
export interface Deed {
    key: string;
    /** Engine-authored and factual. Phase 3 dresses it. */
    line: string;
    hp?: number;
    spiritStones?: number;
    cultivationProgress?: number;
    /** A wound taken doing it. */
    injury?: { severity: InjurySeverity; description: string };
    /** Something understood, formed through the ordinary constructor upstream. */
    comprehension?: { domain: InsightDomain; subject: string; degree: InsightDegree };
}

export interface StretchRow {
    key: string;
    weight: number;
    consequence: (ctx: StretchContext, rng: CultivationRNG) => Deed;
}

/** How many separate things a month like this produces. */
export const DEEDS_MIN = 1;
export const DEEDS_MAX = 3;

/**
 * Progress a month of unbroken sitting is worth, as a share of their OWN next
 * rung's requirement.
 */
export const A_MONTH_OF_NOT_STOPPING = 0.25;

/** What a body reading larger than its own can take off somebody, as stones. */
export const A_MONTH_OF_TAKING = 400;

/** Share of the pool a fight nobody would have picked costs. */
export const A_FIGHT_UNPICKED = 0.45;

function lift(ctx: StretchContext): number {
    return Math.max(1, ctx.bodyMultiplier);
}

/**
 * What a month like this produces. Same shape as `grade-spread.ts`: a row carries
 * its own consequence and `key` is a bare string, so adding a thing a half-mad
 * cultivator might do is one entry in one array. What NPCs and players do is
 * emergent and must never become an enum.
 */
export const WHAT_A_HALF_MAD_STRETCH_DOES: readonly StretchRow[] = [
    {
        key: 'sat_and_did_not_stop',
        weight: 22,
        consequence: (ctx): Deed => {
            const required = progressRequiredForOrdinal(ctx.ownOrdinal) ?? 0;
            const gained = required * A_MONTH_OF_NOT_STOPPING * lift(ctx);
            return {
                key: 'sat_and_did_not_stop',
                cultivationProgress: gained,
                line: 'They sat down and did not get up for the whole of it, drawing at a rate '
                    + 'the body they own could not have sustained for an afternoon. Nobody who '
                    + 'looked in was able to make them answer.'
            };
        }
    },
    {
        key: 'walked_in_without_measuring',
        weight: 18,
        consequence: (ctx, rng): Deed => {
            // The shape AGENTS.md names: somebody who walks through a gate a
            // careful person would have measured first. Several of those gates
            // ask for something that is not power, which is why this row is
            // both the wound and the understanding.
            const severity = rollInjurySeverity(rng, true);
            return {
                key: 'walked_in_without_measuring',
                hp: -Math.round(ctx.maxHp * 0.3),
                injury: {
                    severity,
                    description: 'Taken walking into something a careful person would have '
                        + 'measured first. They were not being careful and they were not '
                        + 'entirely deciding.'
                },
                comprehension: { domain: 'life_death', subject: 'the near thing', degree: 2 },
                line: 'They went into somewhere they had been avoiding for years, at a standing '
                    + 'that made it survivable, and came out understanding something about how '
                    + 'close it had been. The wound is what it cost to find out.'
            };
        }
    },
    {
        key: 'took_something',
        weight: 16,
        consequence: (ctx, rng): Deed => {
            const taken = Math.round(A_MONTH_OF_TAKING * lift(ctx) * rng.float(0.5, 1.5));
            return {
                key: 'took_something',
                spiritStones: taken,
                line: `They came back with ${taken} spirit stones and no account of where from `
                    + 'that anybody has been able to check. Somebody, somewhere, is short.'
            };
        }
    },
    {
        key: 'spent_everything',
        weight: 12,
        consequence: (ctx): Deed => ({
            key: 'spent_everything',
            spiritStones: -ctx.spiritStones,
            line: ctx.spiritStones > 0
                ? `The purse is empty. ${ctx.spiritStones} spirit stones went somewhere over `
                  + 'thirty days and the only witness cannot tell you where.'
                : 'The purse was empty before and is empty now, which is the one mercy in it.'
        })
    },
    {
        key: 'picked_a_fight_they_would_not_have',
        weight: 16,
        consequence: (ctx, rng): Deed => {
            const severity = rollInjurySeverity(rng);
            return {
                key: 'picked_a_fight_they_would_not_have',
                hp: -Math.round(ctx.maxHp * A_FIGHT_UNPICKED),
                injury: {
                    severity,
                    description: 'Taken in a fight they went looking for while carrying '
                        + 'somebody else\'s strength.'
                },
                line: `They went and settled something, at ${rankName(Math.round(ctx.standsAt))}, `
                    + 'against somebody who had every reason to expect the person they knew. '
                    + 'It was settled.'
            };
        }
    },
    {
        key: 'no_account_of_it',
        weight: 16,
        consequence: (): Deed => ({
            key: 'no_account_of_it',
            line: 'Thirty days that nobody, including them, has ever been able to reconstruct. '
                + 'They were seen. They were not asked anything they answered.'
        })
    }
];

export interface HalfMadStretch {
    deeds: readonly Deed[];
    /** One line naming the standing and the length, then what they did. */
    line: string;
}

/**
 * Resolve the whole stretch.
 *
 * Deterministic from the stream it is handed, like every other draw here, and
 * pure: it decides and returns, and the caller writes.
 */
export function resolveHalfMadStretch(
    ctx: StretchContext,
    days: number,
    rng: CultivationRNG
): HalfMadStretch {
    const total = WHAT_A_HALF_MAD_STRETCH_DOES.reduce((sum, r) => sum + r.weight, 0);
    const count = rng.int(DEEDS_MIN, DEEDS_MAX);
    const deeds: Deed[] = [];

    for (let i = 0; i < count; i++) {
        let roll = rng.next() * total;
        let picked = WHAT_A_HALF_MAD_STRETCH_DOES[WHAT_A_HALF_MAD_STRETCH_DOES.length - 1];
        for (const row of WHAT_A_HALF_MAD_STRETCH_DOES) {
            roll -= row.weight;
            if (roll < 0) { picked = row; break; }
        }
        // The same thing twice in a month is one thing that went on for a
        // month, not two events, so a repeat is dropped rather than stacked.
        if (deeds.some(d => d.key === picked.key)) continue;
        deeds.push(picked.consequence(ctx, rng));
    }

    return {
        deeds,
        line: `${days} days at ${rankName(Math.round(ctx.standsAt))}, which is not their rung, `
            + 'and they were not altogether the one deciding what to do with it. '
            + deeds.map(d => d.line).join(' ')
    };
}
