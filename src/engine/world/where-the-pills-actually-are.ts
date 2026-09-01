/**
 * Putting the pill catalog into the world, in the two shapes pills come in.
 *
 * `pills.ts` has been a complete table since it was written and the seeder never
 * put one of them anywhere - the same defect `single-use-dao-comprehension-
 * materials.ts` found for artifacts, in the one catalog the economy is supposed
 * to run on. A world with no medicine in it is a world where the alchemy trade,
 * the crossing pill and the whole "resources buy inputs" axis are prices in a
 * document rather than objects somebody is holding.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TWO STORAGE MODELS, AND IT IS THE SAME LINE AS THE TRADE TIERS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `engine/cultivation/buying-and-bartering-pills.ts` decides which pills have a
 * cash price. `pillStorageModel` is that same answer asked a second way, and the
 * fact that one threshold serves both is the good sign rather than a
 * coincidence: a pill is cash-priced exactly where it is fungible, and it is
 * fungible exactly where nobody needs to know which one you took.
 *
 *   COMMODITY -> A COUNT. One number on the holder, in `resources`, and no
 *                provenance at all. This is the doctrine `makeResourceLot`
 *                already states next door - "the 108 stones out of an abandoned
 *                mine are one row; the stones somebody was paid last week are
 *                not tracked at all" - and the one `manuals.ts` uses for a
 *                house's twenty intake primers. A sect goes through hundreds of
 *                Foundation-Guiding Pills a century and not one of them is worth
 *                a row.
 *
 *   BARTER    -> A ROW. One `ObjectRecord` each, with a holder, a provenance
 *                chain and a reason it has not been sold. Where a pill is worth
 *                a favour from somebody your house cannot reach, WHICH one it is
 *                matters, and the day it moves is a day somebody should be able
 *                to ask about two centuries later.
 *
 * `significance` is the switch rather than a new field, because that is what
 * `significance` is for: `mundane` rows deliberately carry no provenance, which
 * is `possessions.ts`'s own stated reason for the field existing.
 *
 * The barter reasons are NOT reinvented here. `whyNotSold` in
 * `single-use-dao-comprehension-materials.ts` already enumerates them and is
 * called directly, so there is exactly one barter model in the engine and it is
 * that one.
 */

import type { WorldState } from './world-state.js';
import { makeObject, type ObjectRecord, type ObjectSignificance } from './possessions.js';
import { whyNotSold } from './single-use-dao-comprehension-materials.js';
import { forStream } from '../cultivation/rng.js';
import { PILLS } from '../../data/cultivation/pills.js';
import { pillStorageModel, pillTradeTier } from '../cultivation/buying-and-bartering-pills.js';
import { pillBandOrdinal } from '../cultivation/breakthrough.js';
import type { Pill } from '../../schema/cultivation.js';

/** Where a house's count of ordinary medicine is kept. One key, one number. */
export function pillStockKey(pillId: string): string {
    return `pill_stock:${pillId}`;
}

/**
 * How many of an ordinary pill a house keeps on the shelf.
 *
 * Scaled off the pill's own price against the house's reach, so a large house
 * holds more of the cheap thing and a small one holds a few - and nobody holds a
 * count of anything that is not a commodity, because a barter pill is a row.
 */
function stockFor(reach: number, pill: Pill, rng: ReturnType<typeof forStream>): number {
    const band = pillBandOrdinal(pill.grade);
    // A house does not stock medicine pitched well above anybody in it.
    if (reach + 4 < band) return 0;
    const scale = Math.max(1, reach) / Math.max(1, pill.value / 20);
    return Math.max(0, Math.round(rng.int(0, 40) * scale));
}

/**
 * How much bookkeeping a pill deserves, read off the trade tier.
 *
 * Never `mundane` for a barter pill and never anything else for a commodity
 * one. The two sides of the threshold get the two ends of the field.
 */
export function significanceOfPill(pill: Pill): ObjectSignificance {
    if (pillTradeTier(pill) === 'commodity') return 'mundane';
    return pill.grade === 'chaos' ? 'legendary' : 'significant';
}

/**
 * Scatter the medicine.
 *
 * Returns the rows; the counts are written onto the factions in place, the same
 * way every other `resources` figure is. Houses that could plausibly have got
 * hold of a barter pill are the ones already working near the height it is
 * pitched at - the identical asymmetry `seedComprehensionMaterials` uses, and
 * for the identical reason: access buys height, height buys access, and a house
 * with neither stays where it is.
 */
export function seedPillStock(state: WorldState): ObjectRecord[] {
    const rng = forStream(state.seed, 'pill-stock');
    const houses = state.factions.filter(f => f.dissolvedOnDay === null);
    const out: ObjectRecord[] = [];

    for (const house of houses) {
        const reach = Number(house.resources.reliable_ordinal ?? house.resources.power_ordinal ?? 0);

        for (const pill of PILLS) {
            if (pillStorageModel(pill) === 'count') {
                // A quantity, and nothing else. No row, no provenance, no
                // question about which one.
                const count = stockFor(reach, pill, rng);
                if (count > 0) house.resources[pillStockKey(pill.id)] = count;
                continue;
            }

            // A row, or nothing. A house holds one of these only if it is
            // working near the height the thing is for.
            const band = pillBandOrdinal(pill.grade);
            if (reach + 8 < band) continue;
            if (!rng.chance(0.18)) continue;

            out.push(makeObject({
                id: `pill-held-${house.id}-${pill.id}`,
                name: pill.name,
                kind: 'pill',
                significance: significanceOfPill(pill),
                power: band,
                description: pill.description,
                possessorId: house.id,
                ownerId: house.id,
                ownerName: house.name,
                locationId: house.seatLocationId,
                tags: ['pill', `grade:${pill.grade}`, 'barter', `effect:${pill.effect}`],
                data: {
                    pillId: pill.id,
                    forOrdinal: band,
                    spent: false,
                    // One barter model, and it lives next door.
                    whyNotSold: whyNotSold(state, house.id, band, rng)
                }
            }));
        }
    }
    return out;
}

/** A barter pill nobody has swallowed yet. */
export function isUnspentPill(object: ObjectRecord): boolean {
    return object.kind === 'pill' && object.tags.includes('barter') && object.data?.spent !== true;
}

/**
 * Swallowing one, which is the only thing you can do with it.
 *
 * The row stays. A pill that vanishes cleanly from the record is a pill nobody
 * can ever be asked about, and the fact that this house held one and spent it on
 * that person is exactly the sort of thing somebody should be able to discover
 * two centuries later. The same discipline `spend` keeps for comprehension
 * materials, for the same reason.
 */
export function swallow(object: ObjectRecord, byId: string, onDay: number): ObjectRecord {
    return {
        ...object,
        possessorId: null,
        tags: [...object.tags, 'spent'],
        data: { ...object.data, spent: true, spentBy: byId, spentOnDay: onDay }
    };
}

/** How many of an ordinary pill this house has on the shelf. */
export function stockHeld(
    holder: { resources: Record<string, number> },
    pillId: string
): number {
    return Number(holder.resources[pillStockKey(pillId)] ?? 0);
}
