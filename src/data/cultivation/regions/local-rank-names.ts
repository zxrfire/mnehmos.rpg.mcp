/**
 * How a province relabels the one shared ladder, band for band.
 *
 * The helper only. The five band tables themselves are per-province data and
 * live in the province files that use them, because a change to what the White
 * Stair calls its rungs is a change to the White Stair and to nothing else.
 *
 * Who disputes the mapping, and what being wrong about it costs, is a separate
 * subject and lives in `rank-translation.ts`.
 */

import { REALM_TIERS } from '../../../engine/cultivation/realms.js';
import type { LocalRankBand } from './region-schema.js';

// ─────────────────────────────────────────────────────────────────────────
// LOCAL VOCABULARY
// Every region relabels the same ladder. The Jade Gorge's labels happen to be
// the standard ones, because the standard vocabulary is the Jade Gorge's.
//
// Three of the five speak that vocabulary and two do not, and WHICH three is
// content rather than economy: the Yellow Plain speaks it because every lease in
// nine cities is written in it and no landlord signs a grade he cannot look up,
// and the Drowned Sea speaks it because it has no locals to have a word of
// its own. The Silent Cliffs and the White Stair each reached the same rungs by a
// different road, so each named them.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Standard names, band for band, from the one ladder, with the local account
 * of why the standard names are the ones being used here.
 */
export function standardBandsWith(localTheory: string, subRankNote: string): LocalRankBand[] {
    return REALM_TIERS.map(tier => ({
        fromOrdinal: tier.ordinalStart,
        toOrdinal: tier.ordinalEnd,
        standardName: tier.name,
        localName: tier.name,
        localTheory,
        localSubdivisions: tier.subRanks.length,
        standardSubdivisions: tier.subRanks.length,
        subRankCorrespondence: 'none' as const,
        subRankNote
    }));
}
