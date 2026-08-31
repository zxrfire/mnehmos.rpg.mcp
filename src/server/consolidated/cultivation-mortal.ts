/**
 * The low-realm loop: what a poor cultivator does between breakthroughs.
 *
 * `data/cultivation/mortal-world.ts` has held occupations, prices, settlements
 * and how mortals actually regard a Qi Condensation cultivator since it was
 * written, and none of it was reachable. That mattered more than it sounds. A
 * run starts with thirty spirit stones and one pill; a decent cave is sixty
 * stones a month. Without a way to earn, the only thing a poor cultivator can
 * do is sit in bad qi until something kills them, and the long mundane stretch
 * that makes an extraordinary event feel extraordinary never happens.
 *
 * ── `work` IS NOT A SECOND TIME SKIP ──────────────────────────────────────
 *
 * It is `cultivate` with the focus fixed and a wage on the end. The whole
 * simulation - satiety, injuries, encounters, aging, automatic breakthroughs,
 * the world moving alongside - is the same deterministic pass, and the wage is
 * arithmetic over days actually worked. There is no second engine here and
 * there must not be one.
 *
 * The focus is fixed at `idle` and is NOT a caller input. That is the trade the
 * whole action exists to make real: a month spent earning is a month not spent
 * cultivating, and a caller who could choose otherwise would simply choose the
 * better multiplier every time.
 *
 * ── NOTHING HERE ACCEPTS AN OUTCOME ───────────────────────────────────────
 *
 * The caller names a job and a span. Whether the span survives to its end is
 * the time skip's answer, and the wage is paid for the days the engine says
 * were worked - not the days that were asked for. A cultivator who died in
 * month four is not paid for month five.
 */

import { z } from 'zod';
import { rankName } from '../../engine/cultivation/index.js';
import {
    CASH_PER_STONE,
    OCCUPATIONS,
    PRICES,
    SETTLEMENTS,
    cashToStones,
    findWorkForOrdinal,
    getOccupation,
    getSettlement,
    monthsOfSurvival,
    mortalAttitudeFor,
    type Occupation,
    type Settlement
} from '../../data/cultivation/mortal-world.js';
import {
    HOME_REGION_ID,
    REGIONS,
    canAdvanceHere,
    localPrice,
    localRankName,
    requireRegion
} from '../../data/cultivation/regions.js';
import {
    DAYS_PER_MONTH,
    ensureCultivationDb,
    guidingError,
    isGuidingErrorBody,
    resolveActiveRun,
    round2,
    totalDays
} from './cultivation-support.js';
import type { Cultivator } from '../../schema/cultivation.js';

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const WorkSchema = z.object({
    action: z.literal('work'),
    cultivatorId: z.string().optional(),
    occupationId: z.string().optional()
        .describe('Omit to see what work this cultivator can actually take where they are standing'),
    days: z.number().min(0).max(3_650_000).optional(),
    months: z.number().min(0).max(120_000).optional(),
    years: z.number().min(0).max(10_000).optional(),
    rations: z.number().int().min(0).max(10_000).optional()
});

export const MarketSchema = z.object({
    action: z.literal('market'),
    cultivatorId: z.string().optional(),
    category: z
        .enum(['food', 'lodging', 'transport', 'medicine', 'land', 'service', 'tool', 'information'])
        .optional()
        .describe('Narrow to one category. Omit for the whole board.')
});

// ═══════════════════════════════════════════════════════════════════════════
// WHERE THEY ARE STANDING
// ═══════════════════════════════════════════════════════════════════════════

export interface Standing {
    regionId: string;
    regionName: string;
    /** Null when the place is not one the gazetteer names. */
    settlementKind: Settlement['kind'] | null;
    placeName: string | null;
}

/**
 * Match a free-text location against the gazetteer.
 *
 * The cultivator's `location` is a string by design - the engine holds no map -
 * so this is a name match and nothing cleverer. An unrecognised place is not an
 * error: it is a road, a cave or a hillside, and the honest answer is that
 * there is no market there.
 */
export function standingOf(cultivator: Cultivator): Standing {
    const needle = (cultivator.location ?? '').trim().toLowerCase();
    for (const region of REGIONS) {
        for (const place of region.places) {
            if (place.name.toLowerCase() !== needle) continue;
            const kind = place.kind === 'waystation' || place.kind === 'site'
                ? null
                : (place.kind as Settlement['kind']);
            return {
                regionId: region.id,
                regionName: region.name,
                settlementKind: kind,
                placeName: place.name
            };
        }
    }
    const home = requireRegion(HOME_REGION_ID);
    return {
        regionId: home.id,
        regionName: home.name,
        settlementKind: null,
        placeName: null
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// WORK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * `work` is composed rather than reimplemented: the same `cultivate` pass runs
 * the span, and this pays for it. The dependency is injected so the shared tool
 * file exports one function and nothing here duplicates its persistence.
 */
export type CultivateRunner = (args: Record<string, unknown>) => Promise<Record<string, unknown>>;

export async function handleWork(
    args: z.infer<typeof WorkSchema>,
    cultivate: CultivateRunner
): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { cultivator } = resolved;
    const standing = standingOf(cultivator);
    const available = findWorkForOrdinal(
        cultivator.realmOrdinal,
        standing.settlementKind ?? undefined
    );

    // ── No job named: this is the query half, and it is the important one. ──
    if (!args.occupationId) {
        return {
            standing: describeStanding(cultivator, standing),
            purse: describePurse(cultivator),
            work: available.map(o => describeOccupation(o, standing.regionId)),
            note:
                available.length === 0
                    ? 'No work here that this cultivator could hold. Somewhere with more people in it will have some.'
                    : 'A month spent earning is a month not spent cultivating. That is the whole of the choice.'
        };
    }

    const occupation = getOccupation(args.occupationId);
    if (!occupation) {
        return guidingError('unknown_occupation', `No occupation with id ${args.occupationId}.`, {
            hint: 'cultivation_manage({ action: "work" }) with no occupationId lists what exists here.'
        });
    }

    if (cultivator.realmOrdinal < occupation.minOrdinal) {
        return guidingError(
            'below_occupation_ordinal',
            `${occupation.name} is not work ${cultivator.name} could survive: it starts at ${rankName(occupation.minOrdinal)}.`,
            {
                requiredOrdinal: occupation.minOrdinal,
                currentOrdinal: cultivator.realmOrdinal,
                risk: occupation.risk
            }
        );
    }

    if (
        standing.settlementKind !== null &&
        !(occupation.settlements as readonly string[]).includes(standing.settlementKind)
    ) {
        return guidingError(
            'work_not_offered_here',
            `Nobody in ${standing.placeName ?? 'this place'} is hiring for ${occupation.name}.`,
            {
                offeredIn: occupation.settlements,
                standingIn: standing.settlementKind,
                hint: 'The work exists; it exists somewhere else.'
            }
        );
    }

    const days = totalDays(args);
    if (days <= 0) {
        return guidingError('no_duration', 'Working for no time at all earns nothing.', {
            hint: 'Supply days, months or years - e.g. { months: 6 }.'
        });
    }

    // ── The span. One pass, and the engine owns every outcome in it. ──
    const spanResult = await cultivate({
        action: 'cultivate',
        cultivatorId: cultivator.id,
        days,
        // Fixed, and deliberately not a parameter. See the header.
        focus: 'idle',
        rations: args.rations ?? 0,
        autoBreakthrough: true,
        randomEvents: true
    });

    if (typeof spanResult.error === 'string') return spanResult;

    const simulatedDays = Number(spanResult.simulatedDays ?? 0);
    const died = spanResult.died === true;

    // Paid for the days the engine says were worked, never for the days asked
    // for. Cash is the mortal currency; stones are the cultivator's, and the
    // conversion is the one number the whole mortal economy rests on.
    const monthsWorked = simulatedDays / DAYS_PER_MONTH;
    const cashEarned = Math.floor(occupation.cashPerMonth * monthsWorked);
    const stonesEarned = Math.floor(cashToStones(cashEarned));

    let paid = 0;
    if (!died && stonesEarned > 0) {
        repos.cultivators.applyDeltas(cultivator.id, { spiritStones: stonesEarned });
        paid = stonesEarned;
    }

    const after = repos.cultivators.getById(cultivator.id)!;

    return {
        worked: true,
        occupation: describeOccupation(occupation, standing.regionId),
        standing: describeStanding(after, standing),
        daysWorked: simulatedDays,
        monthsWorked: round2(monthsWorked),
        cashEarned,
        spiritStonesEarned: paid,
        unpaid: died
            ? 'The span ended in a death. Nobody settles a dead labourer\'s account.'
            : null,
        spiritStonesNow: after.spiritStones,
        purse: describePurse(after),
        // The whole span, exactly as the cultivation engine resolved it. Wages
        // are the only thing this action adds.
        span: spanResult,
        note:
            'Cultivation ran at zero for the whole span. This is what the money costs, and it is ' +
            'the reason a sect stipend is worth more than the stipend.'
    };
}

function describeOccupation(occupation: Occupation, regionId: string): Record<string, unknown> {
    return {
        id: occupation.id,
        name: occupation.name,
        kind: occupation.kind,
        minOrdinal: occupation.minOrdinal,
        minRank: rankName(occupation.minOrdinal),
        cashPerMonth: occupation.cashPerMonth,
        spiritStonesPerMonth: round2(cashToStones(occupation.cashPerMonth)),
        // What a month of it buys where they are, which is the only figure a
        // player can actually decide on.
        monthsLodgingItCovers: round2(
            occupation.cashPerMonth / localPrice(regionId, 300)
        ),
        risk: occupation.risk,
        settlements: occupation.settlements,
        note: occupation.note
    };
}

function describePurse(cultivator: Cultivator): Record<string, unknown> {
    return {
        spiritStones: cultivator.spiritStones,
        cash: cultivator.spiritStones * CASH_PER_STONE,
        monthsRough: monthsOfSurvival(cultivator.spiritStones, 'rough'),
        monthsAtAnInn: monthsOfSurvival(cultivator.spiritStones, 'inn'),
        monthsOnAVein: monthsOfSurvival(cultivator.spiritStones, 'cave')
    };
}

function describeStanding(cultivator: Cultivator, standing: Standing): Record<string, unknown> {
    const settlement = standing.settlementKind
        ? getSettlement(standing.settlementKind)
        : undefined;
    return {
        place: standing.placeName ?? cultivator.location,
        settlement: settlement
            ? {
                kind: settlement.kind,
                typicalPopulation: settlement.typicalPopulation,
                contains: settlement.contains,
                cultivatorCanGet: settlement.cultivatorCanGet,
                lacks: settlement.lacks,
                note: settlement.note
            }
            : null,
        // How they are actually treated here, which is not a function of rank
        // alone: a farmer near a sect town has seen three of these this year.
        howMortalsHere: mortalAttitudeFor(cultivator.realmOrdinal, standing.regionId) ?? null,
        localRank: localRankName(standing.regionId, cultivator.realmOrdinal) ?? null
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// MARKET
// ═══════════════════════════════════════════════════════════════════════════

export async function handleMarket(args: z.infer<typeof MarketSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { cultivator } = resolved;
    const standing = standingOf(cultivator);
    const region = requireRegion(standing.regionId);

    const prices = PRICES.filter(p => args.category === undefined || p.category === args.category)
        .map(p => {
            const cash = localPrice(standing.regionId, p.cash);
            return {
                id: p.id,
                name: p.name,
                category: p.category,
                unit: p.unit,
                cash,
                spiritStones: round2(cashToStones(cash)),
                affordable: cultivator.spiritStones * CASH_PER_STONE >= cash,
                note: p.note
            };
        })
        .sort((a, b) => a.cash - b.cash);

    return {
        standing: describeStanding(cultivator, standing),
        purse: describePurse(cultivator),
        prices,
        cashPerStone: CASH_PER_STONE,
        priceMultiplier: region.priceMultiplier,
        // Observable consequence, not a category: what this ground has left to
        // give somebody standing at this rank.
        groundHereStillGives: canAdvanceHere(standing.regionId, cultivator.realmOrdinal),
        settlements: SETTLEMENTS.map(s => ({
            kind: s.kind,
            typicalPopulation: s.typicalPopulation,
            cultivatorCanGet: s.cultivatorCanGet,
            lacks: s.lacks
        })),
        occupationsInWorld: OCCUPATIONS.length,
        note:
            'Prices are local: the same pill costs what this region charges for it, and a region ' +
            'that cannot make a thing charges for the distance as well.'
    };
}
