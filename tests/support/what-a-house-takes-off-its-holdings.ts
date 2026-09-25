/**
 * What a house takes off what it holds in a year, read off the catalog.
 *
 * The measurement the tests of the pyramid - the body you answer to is richer
 * than you - and of a house's strength compare against. Nothing in the game
 * asks it: the world charges the same terms off its own rows.
 */

import {
    howMuchRockItHolds,
    whatALevyBringsIn,
    whatItCanPutOnTheGround,
    whatItsTradeBringsIn
} from '../../src/engine/world/seeding.js';
import { whatTheTownsBringIn, type LocationRecord } from '../../src/engine/world/locations.js';
import type { CatalogFaction } from '../../src/engine/world/catalog.js';

/**
 * What a house takes off what it HOLDS in a year: rock, gates, towns, benches.
 *
 * The four terms of the yearly economy that come from the holding, and
 * deliberately not the per-member one beside them. A roll is not a holding: it
 * grows and shrinks with who is alive this decade, and the pyramid - the claim
 * that the body you answer to is richer than you - is a claim about the grant,
 * not about how many people happen to be standing in the compound.
 *
 * Read off the CATALOG, which is what the tests of the pyramid compare: the
 * seeded purse and the yearly economy both charge these terms off the world
 * (`seedWorld`, `applyFactionEconomy`), so this is a measurement beside them
 * rather than a step of either. Before it the only way to ask was to retype
 * four terms, and the first thing that retyped them left the towns out.
 */
export function whatItsHoldingsBringIn(
    cf: Pick<CatalogFaction, 'id' | 'veinWorth' | 'levy' | 'trade' | 'reliableOrdinal'>,
    locations: readonly LocationRecord[]
): number {
    return Math.round(
        howMuchRockItHolds(cf.veinWorth) * 5_000 * (0.5 + whatItCanPutOnTheGround(cf.reliableOrdinal))
        + whatALevyBringsIn(cf.levy)
        + whatTheTownsBringIn(locations, cf.id)
        + whatItsTradeBringsIn(cf.trade)
    );
}
