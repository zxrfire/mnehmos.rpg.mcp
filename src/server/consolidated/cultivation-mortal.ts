/**
 * The low-realm loop: what a poor cultivator does between breakthroughs.
 */

import { z } from 'zod';
import { rankName } from '../../engine/cultivation/index.js';
import {
    regardFor,
    regardOf,
    type Regard,
    type RegardAsker
} from '../../engine/cultivation/regard.js';
import { ApproachSchema } from '../../schema/cultivation.js';
import {
    CASH_PER_STONE,
    MORTAL_ECONOMY_REGARD,
    OCCUPATIONS,
    PRICES,
    SETTLEMENTS,
    cashToStones,
    MORTAL_WORK_CEILING_ORDINAL,
    findWorkForOrdinal,
    getOccupation,
    getSettlement,
    monthsOfSurvival,
    mortalAttitudeFor,
    workExistingFor,
    workWithheldFrom,
    type Occupation
} from '../../data/cultivation/mortal-world.js';
import {
    canAdvanceHere,
    localPrice,
    localRankName,
    requireRegion
} from '../../data/cultivation/regions.js';
import {
    FORAGE_BASE_DAYS,
    HerbBiomeSchema,
    forage,
    findHerbsForOrdinal,
    findOfferedHerbs,
    type HerbBiome
} from '../../data/cultivation/herbs.js';
import { forStream } from '../../engine/cultivation/rng.js';
import { manualsAStallCarries } from '../../engine/world/what-a-copy-of-a-manual-costs-at-a-stall.js';
import {
    drawFromTheGround,
    howTheGroundReads,
    recordGroundDraw,
    standingStock
} from '../../engine/world/what-a-place-still-has-in-the-ground.js';
import { worldForRun, saveWorldForRun } from '../state/cultivation-world.js';
import { priceMultiplierInArea } from '../../engine/world/what-is-true-of-a-place-right-now.js';
import { worldLocationFor } from '../../web/entities.js';
import { untreatedInjuryCount } from '../../engine/cultivation/injuries.js';
import { CRIPPLING_UNTREATED_INJURIES } from '../../schema/cultivation.js';
import { ACTIONS_PER_FULL_SATIETY } from '../../engine/cultivation/survival.js';
import { RATION_COST_STONES } from './cultivation-manage.js';
import { standingOf, type Standing } from './where-a-cultivator-is-standing.js';
import {
    DAYS_PER_MONTH,
    addToPouch,
    ensureCultivationDb,
    guidingError,
    isGuidingErrorBody,
    resolveActiveRun,
    round2,
    totalDays
} from './cultivation-support.js';
import type { Cultivator, Run } from '../../schema/cultivation.js';
import type { LocationRecord } from '../../engine/world/locations.js';

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
    rations: z.number().int().min(0).max(10_000).optional(),
    approach: ApproachSchema.optional()
        .describe('What the narrator knows and the row does not: how the ask is being put, what is behind it, who is watching, and what rung the asker is letting the room believe. Optional; omitting it is the old behaviour exactly.')
});

export const MarketSchema = z.object({
    action: z.literal('market'),
    cultivatorId: z.string().optional(),
    category: z
        .enum(['food', 'lodging', 'transport', 'medicine', 'land', 'service', 'tool', 'information',
            /**
             * The books, which were priced nowhere and sold nowhere.
             */
            'manual'])
        .optional()
        .describe('Narrow to one category. Omit for the whole board.'),
    approach: ApproachSchema.optional()
        .describe('Context for the counter: tone, leverage, audience, a concealed rung. It moves how the board is quoted by at most two rungs, and never what is on it.')
});

export const ForageSchema = z.object({
    action: z.literal('forage'),
    cultivatorId: z.string().optional(),
    biome: HerbBiomeSchema.optional()
        .describe('Where they are looking. Omit to search whatever is around them.'),
    days: z.number().min(0).max(3_650).optional()
        .describe('Days given to it. Omit for one ordinary pass; the engine decides how long that actually takes at this rung.'),
    rations: z.number().int().min(0).max(10_000).optional(),
    approach: ApproachSchema.optional()
        .describe('How they are going about it. `patience` is the field that matters most here: hurried halves the time and the take, unhurried lengthens both.')
});

// ═══════════════════════════════════════════════════════════════════════════
// WHERE THEY ARE STANDING
// ═══════════════════════════════════════════════════════════════════════════

// It lives in `where-a-cultivator-is-standing.ts` now, and is re-exported here
// so that every existing caller's import line is untouched. It moved because it
// is the one thing in this module a handler on the far side of the tool set
// wants - a region id, to price something with - and reaching it through this
// file drags in the `cultivation-manage` cycle. That file's header has the
// whole account, including the boot failure it produced.
export { standingOf, type Standing };

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
    const asker: RegardAsker = { ordinal: cultivator.realmOrdinal, approach: args.approach };
    const settlement = standing.settlementKind ?? undefined;
    const available = findWorkForOrdinal(asker, settlement);
    const withheld = workWithheldFrom(asker, settlement);
    const exists = workExistingFor(cultivator.realmOrdinal, settlement);

    // No job named: this is the query half, and it is the important one.
    if (!args.occupationId) {
        return {
            standing: describeStanding(cultivator, standing),
            purse: describePurse(cultivator),
            work: available.map(o => describeOccupation(o, standing.regionId, asker)),
            // Silence is not an answer. Everything on the board here that is
            // NOT being put to them, with the measured reason attached.
            withheld: withheld.slice(0, 8).map(w => ({
                id: w.occupation.id,
                name: w.occupation.name,
                band: w.band,
                reason: w.reason
            })),
            withheldCount: withheld.length,
            regard: describeRegard(
                regardFor(MORTAL_ECONOMY_REGARD.gate, asker, MORTAL_ECONOMY_REGARD)
            ),
            note: workNote(available.length, withheld.length, exists.length)
        };
    }

    const occupation = getOccupation(args.occupationId);
    if (!occupation) {
        return guidingError('unknown_occupation', `No occupation with id ${args.occupationId}.`, {
            hint: 'cultivation_manage({ action: "work" }) with no occupationId lists what exists here.'
        });
    }

    // The regard, before the floor. This is the general form of what used to be
    // a hard ceiling check: a job the asker has outgrown is refused because it
    // is beneath them, in the same call that refuses one pitched far over their
    // head, out of the same table. The refusal states the measured gap rather
    // than a constant, and the constant survives only as the documented rung
    // where the mortal half of the board runs out.
    const jobRegard = regardOf(occupation, asker);
    if (jobRegard.refused) {
        return guidingError(
            'work_not_put_to_them',
            `Nobody would put ${cultivator.name} on ${occupation.name}. ${jobRegard.reaction}`,
            {
                band: jobRegard.band,
                gap: jobRegard.gap,
                occupationOrdinal: occupation.minOrdinal,
                currentOrdinal: cultivator.realmOrdinal,
                apparentOrdinal: jobRegard.apparentOrdinal,
                mortalCeilingOrdinal: MORTAL_WORK_CEILING_ORDINAL,
                hint: jobRegard.band === 'dismissed'
                    ? `The mortal half of the board runs out at ordinal ${MORTAL_WORK_CEILING_ORDINAL}. cultivation_manage({ action: "work" }) with no occupationId shows what IS being put to somebody at ${rankName(cultivator.realmOrdinal)}.`
                    : 'Pitched too far above them to be offered. Something nearer their own rung will be on the same board.'
            }
        );
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
        // AND SAY WHAT IS HIRING, because otherwise this is a wall.
        const alsoHere = OCCUPATIONS
            .filter(o => o.id !== occupation.id)
            .filter(o => (o.settlements as readonly string[]).includes(standing.settlementKind!))
            .filter(o => o.minOrdinal === undefined || cultivator.realmOrdinal >= o.minOrdinal)
            .map(o => o.name);

        return guidingError(
            'work_not_offered_here',
            `Nobody in ${standing.placeName ?? 'this place'} is hiring for ${occupation.name}.`
            + (alsoHere.length > 0
                ? ` What is going here: ${alsoHere.slice(0, 6).join(', ')}.`
                : ' Nothing here is hiring anybody, which is its own answer about the place.'),
            {
                offeredIn: occupation.settlements,
                standingIn: standing.settlementKind,
                offeredHere: alsoHere,
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

    // Board, advanced against the wage
    const rationsNeeded = Math.max(0, Math.ceil(days / ACTIONS_PER_FULL_SATIETY));
    const requested = args.rations ?? 0;
    const rations = Math.max(requested, rationsNeeded);
    const boardCost = rations * RATION_COST_STONES;
    // Only the part the purse genuinely cannot cover. Somebody with stones
    // pays for their own food and takes no advance at all.
    const advance = Math.max(0, boardCost - cultivator.spiritStones);
    if (advance > 0) repos.cultivators.applyDeltas(cultivator.id, { spiritStones: advance });

    // ── The span. One pass, and the engine owns every outcome in it. ──
    const spanResult = await cultivate({
        action: 'cultivate',
        cultivatorId: cultivator.id,
        days,
        // Fixed, and deliberately not a parameter. See the header.
        focus: 'idle',
        rations,
        autoBreakthrough: true,
        randomEvents: true
    });

    if (typeof spanResult.error === 'string') return spanResult;

    const simulatedDays = Number(spanResult.simulatedDays ?? 0);
    const died = spanResult.died === true;

    // Paid for the days the engine says were worked, never for the days asked for.
    // Cash is the mortal currency; stones are the cultivator's, and the conversion
    // is the one number the whole mortal economy rests on.
    const monthsWorked = simulatedDays / DAYS_PER_MONTH;
    const cashEarned = Math.floor(occupation.cashPerMonth * monthsWorked * jobRegard.yieldMultiplier);
    const stonesEarned = Math.floor(cashToStones(cashEarned));

    // Settled against the advance. A span that earned less than its own board
    // pays nothing and the shortfall is not chased: the house fed somebody who
    // did not work long enough to cover it, which is an ordinary bad month and
    // not a debt system. A death is the same answer the wage already gave.
    const settled = died ? 0 : Math.max(0, stonesEarned - advance);
    let paid = 0;
    if (settled > 0) {
        repos.cultivators.applyDeltas(cultivator.id, { spiritStones: settled });
        paid = settled;
    }

    const after = repos.cultivators.getById(cultivator.id)!;

    return {
        worked: true,
        occupation: describeOccupation(occupation, standing.regionId, asker),
        regard: describeRegard(jobRegard),
        standing: describeStanding(after, standing),
        daysWorked: simulatedDays,
        monthsWorked: round2(monthsWorked),
        cashEarned,
        spiritStonesEarned: paid,
        // What the food cost, said out loud. A wage quoted without its board is
        // the thing that made this action look profitable when it was not.
        rationsBought: rations,
        boardCostStones: boardCost,
        boardAdvancedStones: advance,
        grossSpiritStones: stonesEarned,
        unpaid: died
            ? 'The span ended in a death. Nobody settles a dead labourer\'s account.'
            : stonesEarned > 0 && settled === 0
                ? `The span earned ${stonesEarned} spirit stone(s) and ate ${advance} of board `
                  + 'advanced against it. Nothing was left to hand over.'
                : null,
        spiritStonesNow: after.spiritStones,
        // Carried so the narrator can say whether the work is starving them.
        // Work pays and does not feed, and the two front ends had no way to
        // know it: this path reported wages and nothing else while a cultivator
        // went from full health to half across fourteen years of it.
        satiety: after.satiety,
        // What the hunger is actually costing, and whether they survived it.
        // Satiety alone tells a player they are hungry and never that it is
        // taking their health - measured by playing, health slid from thirty to
        // fifteen across twenty years while the only warning was a number about
        // food. And death here was reported nowhere at all.
        hp: after.hp,
        maxHp: after.maxHp,
        // AND WHAT THE SPAN DID TO THEM.
        untreatedInjuries: untreatedInjuryCount(after.injuries),
        crippledInjuryThreshold: CRIPPLING_UNTREATED_INJURIES,
        alive: after.alive,
        deathCause: after.deathCause ?? null,
        purse: describePurse(after),
        // The whole span, exactly as the cultivation engine resolved it. Wages
        // are the only thing this action adds.
        span: spanResult,
        note:
            'Cultivation ran at zero for the whole span. This is what the money costs, and it is ' +
            'the reason a sect stipend is worth more than the stipend.'
    };
}

/**
 * The board's own sentence, built from what was measured rather than from a
 * constant. Three different facts, three different sentences, and none of them
 * is an unexplained empty list.
 */
function workNote(offered: number, withheld: number, exists: number): string {
    if (offered > 0 && withheld > 0) {
        return `${offered} of the ${exists} things going here are put to them; the other ${withheld} are not, `
            + 'and the reasons are on each. A month spent earning is a month not spent cultivating - that is still the whole of the choice.';
    }
    if (offered > 0) {
        return 'A month spent earning is a month not spent cultivating. That is the whole of the choice.';
    }
    if (withheld > 0) {
        return `There are ${withheld} things going here and not one of them is put to this person. `
            + 'Nothing here is worth their time and everyone present can see what they are. '
            + 'That is a different fact from nobody hiring, and it is the one that applies.';
    }
    return 'Nothing at all is going here - not withheld, absent. Somewhere with more people in it will have some.';
}

/** The banded answer, flattened for the narrator. Facts, never a decision. */
function describeRegard(regard: Regard): Record<string, unknown> {
    return {
        band: regard.band,
        physicalBand: regard.physicalBand,
        gap: regard.gap,
        socialGap: regard.socialGap,
        offered: regard.offered,
        refused: regard.refused,
        yieldMultiplier: round2(regard.yieldMultiplier),
        durationMultiplier: round2(regard.durationMultiplier),
        priceMultiplier: round2(regard.priceMultiplier),
        damageMultiplier: round2(regard.damageMultiplier),
        concealed: regard.concealed,
        apparentOrdinal: regard.apparentOrdinal,
        apparentRank: rankName(regard.apparentOrdinal),
        actualOrdinal: regard.actualOrdinal,
        pressure: regard.pressure,
        reaction: regard.reaction,
        intent: regard.intent,
        note: regard.note
    };
}

function describeOccupation(
    occupation: Occupation,
    regionId: string,
    asker?: RegardAsker
): Record<string, unknown> {
    const regard = asker ? regardOf(occupation, asker) : null;
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
        // What a month of it is actually worth to THIS person, which is the
        // figure that used to be missing entirely.
        cashPerMonthForThem: regard
            ? Math.floor(occupation.cashPerMonth * regard.yieldMultiplier)
            : occupation.cashPerMonth,
        band: regard?.band ?? null,
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
        // THE PROVINCE, BESIDE THE PLACE, BECAUSE HALF THIS BODY IS ABOUT THE
        // PROVINCE AND NOT ABOUT THE PLACE.
        region: standing.regionName,
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

// FORAGE

/**
 * The world's row for the ground somebody is standing on, and the day it is.
 */
async function theGroundUnder(
    run: Run,
    cultivator: Cultivator
): Promise<{ place: LocationRecord; onDay: number } | null> {
    try {
        const world = await worldForRun(run);
        const place = worldLocationFor(world, cultivator.location);
        return place ? { place, onDay: Math.floor(world.currentDay) } : null;
    } catch {
        // A run with no world is a run in a game the world layer is not part
        // of. Not an error, and not a reason to refuse a forage.
        return null;
    }
}

/**
 * What everything on sale here costs today, over and above what the province
 * charges for it.
 */
async function whatTheGroundHereAddsToAPrice(
    run: Run,
    cultivator: Cultivator
): Promise<number> {
    const ground = await theGroundUnder(run, cultivator);
    if (!ground) return 1;
    const world = await worldForRun(run);
    return priceMultiplierInArea(
        world.statuses, world.locations, ground.place.id, ground.onDay
    );
}

export async function handleForage(
    args: z.infer<typeof ForageSchema>,
    cultivate: CultivateRunner
): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const asker: RegardAsker = { ordinal: cultivator.realmOrdinal, approach: args.approach };
    const biome = args.biome as HerbBiome | undefined;

    const reachable = findHerbsForOrdinal(cultivator.realmOrdinal, biome);
    if (reachable.length === 0) {
        return guidingError(
            'nothing_reachable',
            `Nothing that grows ${biome ? `in ${biome}` : 'here'} is within reach at ${rankName(cultivator.realmOrdinal)}.`,
            {
                currentOrdinal: cultivator.realmOrdinal,
                hint: 'The ground where the next grade grows would kill them. Somewhere else, or later.'
            }
        );
    }

    // Draw first, then run the span it actually takes. The count and the
    // duration come off the same regard, so they cannot drift apart.
    const startDay = Math.floor(run.elapsedDays);
    const rng = forStream(run.seed, 'forage', startDay, cultivator.location ?? '', biome ?? '');
    const drawn = forage(asker, rng.next(), {
        biome,
        baseDays: args.days && args.days > 0 ? args.days : FORAGE_BASE_DAYS
    });

    if (!drawn.herb || !drawn.regard) {
        return guidingError('nothing_found', 'The draw came back empty.', {
            hint: 'This should not happen when anything is reachable; report it.'
        });
    }

    const spanResult = await cultivate({
        action: 'cultivate',
        cultivatorId: cultivator.id,
        days: drawn.days,
        focus: 'travelling',
        rations: args.rations ?? 0,
        autoBreakthrough: true,
        randomEvents: true
    });
    if (typeof spanResult.error === 'string') return spanResult;

    const simulatedDays = Number(spanResult.simulatedDays ?? 0);
    const died = spanResult.died === true;

    // Paid for the days the engine says were spent, exactly as wages are. A
    // pass cut short by a death or an interruption yields proportionally.
    const fraction = drawn.days > 0 ? Math.min(1, simulatedDays / drawn.days) : 0;
    const wanted = died ? 0 : Math.floor(drawn.quantity * fraction);

    // AND THE GROUND HAS A NUMBER
    const ground = await theGroundUnder(run, cultivator);
    const draw = ground
        ? drawFromTheGround(ground.place, {
            kind: 'herb',
            grade: drawn.herb.grade,
            wanted,
            onDay: ground.onDay
        })
        : null;
    const taken = draw ? draw.taken : wanted;
    if (draw && recordGroundDraw(ground!.place, draw)) await saveWorldForRun(run);

    if (taken > 0) addToPouch(repos.db, cultivator.id, drawn.herb.id, 'herb', taken);

    const after = repos.cultivators.getById(cultivator.id)!;
    const offered = findOfferedHerbs(asker, biome);
    const band = ground
        ? standingStock(ground.place, 'herb', drawn.herb.grade, ground.onDay)
        : null;

    return {
        foraged: true,
        herb: {
            id: drawn.herb.id,
            name: drawn.herb.name,
            grade: drawn.herb.grade,
            biome: drawn.herb.biome,
            harvestOrdinal: drawn.herb.harvestOrdinal,
            unitValue: drawn.herb.value
        },
        quantityFound: drawn.quantity,
        quantityTaken: taken,
        valueTaken: taken * drawn.herb.value,
        daysAsked: drawn.days,
        daysSpent: simulatedDays,
        regard: describeRegard(drawn.regard),
        // What this ground still holds of the grade that was drawn, and what
        // it holds of everything else. A player must be able to ask what a
        // place still has and get a real answer rather than inferring one from
        // a yield that quietly fell.
        ground: ground
            ? {
                place: ground.place.name,
                grade: drawn.herb.grade,
                remaining: Math.floor(band!.remaining),
                capacity: band!.capacity,
                reading: band!.reading,
                shortfall: draw!.shortfall,
                says: draw!.line,
                stillHas: howTheGroundReads(ground.place, ground.onDay)
            }
            : null,
        // What the ground still puts in front of them, and what it has stopped
        // putting in front of them. The second half is the answer to "why did
        // I not find any qi grass" at Nascent Soul, and it is a real answer.
        offeredHere: offered.length,
        reachableHere: reachable.length,
        walkedPast: reachable.length - offered.length,
        unpaid: died ? 'The pass ended in a death. Nothing was carried out.' : null,
        purse: describePurse(after),
        span: spanResult,
        note:
            'How much came back and how long it took are the same measurement, taken once. Ground '
            + 'far below the person standing on it gives up more of itself in less time, and ground '
            + 'they have outgrown entirely stops being searched at all.'
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// MARKET
// ═══════════════════════════════════════════════════════════════════════════

export async function handleMarket(args: z.infer<typeof MarketSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const standing = standingOf(cultivator);
    const region = requireRegion(standing.regionId);

    // AND WHAT IS TRUE OF THIS GROUND TODAY
    const groundTerm = await whatTheGroundHereAddsToAPrice(run, cultivator);

    // How this market meets this person, resolved once. A stall, an inn floor
    // and a bowl of millet are all pitched at the same rung, so the board is one
    // regard rather than one per line, and the quote moves with it: a counter
    // does not put its usual price to somebody it can see is ten rungs past
    // needing to ask. Tone and a purse move it by at most two rungs; nothing
    // moves what is actually on the board.
    const asker: RegardAsker = { ordinal: cultivator.realmOrdinal, approach: args.approach };
    const boardRegard = regardFor(MORTAL_ECONOMY_REGARD.gate, asker, MORTAL_ECONOMY_REGARD);

    const prices = PRICES.filter(p => args.category === undefined || p.category === args.category)
        .map(p => {
            const list = localPrice(standing.regionId, p.cash);
            const cash = Math.max(1, Math.round(list * groundTerm * boardRegard.priceMultiplier));
            return {
                id: p.id,
                name: p.name,
                category: p.category,
                unit: p.unit,
                cash,
                listCash: list,
                spiritStones: round2(cashToStones(cash)),
                affordable: cultivator.spiritStones * CASH_PER_STONE >= cash,
                note: p.note
            };
        })
        .sort((a, b) => a.cash - b.cash);

    // THE STALL NEXT TO THE COOKING POTS
    const manuals = manualsAStallCarries().map(m => {
        const list = localPrice(standing.regionId, m.cash);
        const cash = Math.max(1, Math.round(list * groundTerm * boardRegard.priceMultiplier));
        return {
            id: `manual-${m.id}`,
            techniqueId: m.id,
            name: m.name,
            category: 'manual' as const,
            unit: 'copy',
            cash,
            listCash: list,
            // THE BOARD QUOTES WHAT THE COUNTER TAKES.
            spiritStones: Math.max(1, Math.ceil(cashToStones(cash))),
            affordable: cultivator.spiritStones >= Math.max(1, Math.ceil(cashToStones(cash))),
            // What it is FOR, said on the board rather than after the purchase.
            // A ceiling nobody can see before committing to it is a trap.
            openAtThisRung: m.requiredOrdinal <= cultivator.realmOrdinal,
            note:
                `Opens at ${rankName(m.requiredOrdinal)} and carries a cultivator as far as `
                + `${rankName(m.cap)}.`
        };
    });

    return {
        standing: describeStanding(cultivator, standing),
        purse: describePurse(cultivator),
        regard: describeRegard(boardRegard),
        prices,
        // Separate from `prices` because a manual is the one line on the board
        // whose usefulness depends on who is reading it: everything else is
        // worth what it costs to anybody, and a road you cannot open yet is
        // worth nothing today whatever you pay for it.
        manuals: args.category === undefined || args.category === 'manual' ? manuals : [],
        cashPerStone: CASH_PER_STONE,
        priceMultiplier: region.priceMultiplier,
        // What is TRUE of this ground today, reported apart from what the
        // province is LIKE. One is a standing property and one lifts.
        groundPriceMultiplier: groundTerm,
        // Observable consequence, not a category: what this ground has left to
        // give somebody standing at this rank.
        groundHereStillGives: canAdvanceHere(standing.regionId, cultivator.realmOrdinal),
        // And WHERE it stops, said as a rung rather than left to be inferred.
        groundCarriesNobodyPast: rankName(region.localCeilingOrdinal),
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
