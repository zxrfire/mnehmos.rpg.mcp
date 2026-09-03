/**
 * Who translates one province's rank vocabulary into another's, what they have
 * riding on the answer, and what being wrong about it costs.
 *
 * The tables and the four lookups that read them, together, because the
 * mapping is a dispute BETWEEN provinces and belongs to none of them. The
 * bands being translated are per-province and live in the province files;
 * `local-rank-names.ts` holds only the helper that builds a standard set.
 */

import { MAX_ORDINAL } from '../../../engine/cultivation/realms.js';
import type { LocalRankBand, TitleTranslation } from './region-schema.js';
import { requireRegion } from './the-map.js';

/**
 * The mapping is contested by parties with money on the outcome. This is the
 * politics, the danger and most of the comedy, and it costs the engine
 * nothing because the ordinals never move.
 */
export const TITLE_TRANSLATIONS: readonly TitleTranslation[] = [
    {
        party: 'The Ninefold Ledger',
        mapping: 'Band for band, exactly: Chipping is Qi Condensation, Standing Cut is Foundation Establishment, Keystone is Core Formation, and so on to the top.',
        interest: 'It arbitrates inheritance and debt across the border and needs one table that both sides are bound by. It is also correct, which it regards as incidental.'
    },
    {
        party: 'The Weir Office',
        mapping: 'Keystone sits above Core Formation, and Standing Cut above Foundation Establishment, on the argument that a carver reached it without ambient qi and is therefore worth more.',
        interest: 'Grant fees are priced by rank, and every band it can push upward is revenue. The Office has never submitted the claim to the Ledger for certification.'
    },
    {
        party: 'The Kettle Assay House',
        mapping: 'A third table used for insurance: Standing Cut is read one rank low, at Qi Condensation Perfection, because a carver with no formations and no alchemy fights like a weaker cultivator.',
        interest: 'The Stonewright Consortium underwrites escort contracts and pays out on deaths. Its table is the only one anybody uses commercially, and it is the one that gets outsiders killed.'
    },
    {
        party: 'The House of the Narrow Hour',
        mapping: 'Declines to publish a table on the grounds that a rank is a position in a convergence rather than a title, and that both other tables are answering a question nobody asked.',
        interest: 'It has one reader in the Marches, who has been asked for a mapping eleven times and has refused eleven times, and whose refusal is itself quoted in the Ledger\'s case notes.'
    }
];

/**
 * The gap between the realm and the sub-rank, written down as incidents.
 *
 * Alignment at the realm boundary is reliable: everyone can see that a person
 * has opened a standing face, and nobody argues about which realm that is.
 * Inside the realm there is no correspondence at all, and that is where people
 * die - not because anyone is a fool, but because there is no lookup that
 * settles it and both parties are guessing with confidence.
 */
export const RANK_MISREADINGS: readonly {
    localName: string;
    realmIsClear: string;
    insideIsNot: string;
    systematicDirection: string;
    recordedIncident: string;
}[] = [
    {
        localName: 'Standing Cut',
        realmIsClear:
            'Nobody disputes the realm. A face that stays open is Foundation Establishment and both traditions can see it across a room.',
        insideIsNot:
            'Three courses against four stages, and the courses are not thirds of the same span: a face does not stand at all until it is deep, so the first course already sits where the standard ladder would put Mid to Late.',
        systematicDirection:
            'Outsiders read Standing Cut low, consistently, in the same direction, because "first course" sounds like "Early". Carvers are therefore systematically underestimated by about two stages in the province next door, which is survivable for the carver and not for the person who challenged them.',
        recordedIncident:
            'The Scarwater duel, eleven years ago: a Sword Elder\'s disciple of the Azure Cloud Pavilion at Foundation Perfection accepted a challenge from a "first-course Standing Cut" carver on the assumption that first course meant Early Foundation. It did not. The carver was within a stage of him and immune to the soul-pressure art he opened with, and he died in the street at Scarwater in front of forty people. The Ninefold Ledger case note is the only document in the world that states the sub-division mismatch plainly, and the Kettle Assay House has not revised its insurance table since.'
    }
];

/**
 * The profession that exists in the gap. Placing a foreign cultivator inside a
 * realm cannot be done from a table, so it is done by people, badly, for money.
 */
export const PLACERS = {
    trade: 'placer',
    what:
        'Someone who can look at a cultivator from the other tradition and say, accurately, where inside a realm they sit. The realm is free - anyone can see that. The position inside it is the entire product.',
    whoSellsIt:
        'The Ninefold Ledger, as a second line of business beside ancestral certification, and about nine independents at Scarwater and Kettle who work the border road and undercut it.',
    priceNote:
        'Ledger placement of a single foreign cultivator costs more than a month of cave rent on a decent vein, and is still cheaper than being wrong once.',
    reliability:
        'The Ledger publishes its own error rate, which is roughly one in six, and it is the best figure anybody has. The independents do not publish one.'
} as const;

/**
 * The local name for a rank. This is a relabelling of the shared ladder and
 * nothing else: the ordinal passed in is the ordinal that comes back out.
 */
export function localRankBand(regionId: string, ordinal: number): LocalRankBand | undefined {
    const clamped = Math.max(0, Math.min(MAX_ORDINAL, Math.floor(ordinal)));
    return requireRegion(regionId).cultivation.localRankNames
        .find(b => clamped >= b.fromOrdinal && clamped <= b.toOrdinal);
}

export function localRankName(regionId: string, ordinal: number): string | undefined {
    return localRankBand(regionId, ordinal)?.localName;
}

/** Known cases where the realm is obvious and the position inside it is not. */
export function rankMisreadingFor(localName: string): typeof RANK_MISREADINGS[number] | undefined {
    const needle = localName.trim().toLowerCase();
    return RANK_MISREADINGS.find(m => m.localName.toLowerCase() === needle);
}

/**
 * Read a local title back to the ordinals it covers, with the disputes
 * attached. The band is authoritative; the disputes are what parties in the
 * world believe, and at least one of them is wrong in a way that kills people.
 */
export function translateLocalTitle(regionId: string, localName: string): {
    band: LocalRankBand;
    fromOrdinal: number;
    toOrdinal: number;
    standardName: string;
    disputes: readonly TitleTranslation[];
} | undefined {
    const needle = localName.trim().toLowerCase();
    const band = requireRegion(regionId).cultivation.localRankNames
        .find(b => b.localName.toLowerCase() === needle);
    if (!band) return undefined;
    return {
        band,
        fromOrdinal: band.fromOrdinal,
        toOrdinal: band.toOrdinal,
        standardName: band.standardName,
        disputes: TITLE_TRANSLATIONS
    };
}
