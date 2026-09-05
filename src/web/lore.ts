/**
 * The speakable world: every name a person in this world could put in a sentence,
 * and the conditions under which they would.
 */

import { MAX_ORDINAL } from '../engine/cultivation/realms.js';
import {
    AGES,
    APEX_INSTITUTIONS,
    COURTS,
    DEAD_CIVILISATIONS,
    DESTROYED_DAO_HOUSES,
    GUEST_ELDERS,
    HELD_INSTRUMENTS,
    IMMORTAL_CHANNELS,
    IMMORTAL_ITEMS,
    LID_THEORIES,
    MEMBERS,
    ORIGIN_ACCOUNTS,
    REGIONS,
    SECTS,
    UNOWNED_ANCESTORS,
    WANDERERS,
    AGE_FIDELITY,
    HIGH_REALM_THRESHOLD,
    getRegionForFaction,
    getBranchesOf
} from '../data/cultivation/index.js';
import { AUCTION_VENUES } from '../data/cultivation/rogues.js';
import type { KnownEntityKind } from './knowledge.js';

// ─────────────────────────────────────────────────────────────────────────
// THE THRESHOLDS
// Moved here from hearsay.ts, which now re-exports them: the numbers belong
// beside the table they filter, and `asked.ts` reads one of them through
// hearsay.ts, so the re-export is load-bearing rather than tidiness.
// ─────────────────────────────────────────────────────────────────────────

/**
 * How far above their own standing a person's working knowledge reaches.
 */
export const WORKING_KNOWLEDGE_MARGIN = 8;

/**
 * Power at which a faction becomes common currency regardless of who is speaking.
 */
export const COMMON_CURRENCY_ORDINAL = 33;

/**
 * A floor no speaker can clear, for names only an insider holds.
 */
export const INSIDER_ONLY_FLOOR = MAX_ORDINAL + WORKING_KNOWLEDGE_MARGIN + 1;

// ─────────────────────────────────────────────────────────────────────────
// SHAPES
// ─────────────────────────────────────────────────────────────────────────

/**
 * How far from ordinary life a name sits, which decides how often it surfaces.
 */
export type LoreBand = 'local' | 'regional' | 'world' | 'deep';

/**
 * Which catalog a name came out of.
 */
export type LoreCatalog =
    | 'sects'
    | 'destroyed-houses'
    | 'apex'
    | 'courts'
    | 'guest-elders'
    | 'members'
    | 'wanderers'
    | 'sealed-held'
    | 'sealed-unowned'
    | 'immortal-channels'
    | 'immortal-items'
    | 'ages'
    | 'dead-civilisations'
    | 'lid-theories'
    | 'origin-accounts'
    | 'regions'
    | 'places'
    | 'auction-venues';

/** Every catalog this module draws from. The regression test's checklist. */
export const LORE_CATALOGS: readonly LoreCatalog[] = [
    'sects', 'destroyed-houses', 'apex', 'courts', 'guest-elders', 'members',
    'wanderers', 'sealed-held', 'sealed-unowned', 'immortal-channels',
    'immortal-items', 'ages', 'dead-civilisations', 'lid-theories',
    'origin-accounts', 'regions', 'places', 'auction-venues'
] as const;

/**
 * One name, and the conditions under which somebody would say it.
 */
export interface Mentionable {
    kind: KnownEntityKind;
    /** Catalog id, or a synthesised one where the catalog row has none. */
    id: string;
    name: string;
    catalog: LoreCatalog;
    /** True where this belongs to the material the world does not discuss. */
    deep: boolean;
    /** Standing at which the name is in a person's working vocabulary. */
    floorOrdinal: number;
    /** Region it belongs to, or null where it belongs to none. */
    regionId: string | null;
    /** Faction whose own people hold the name whatever their standing. */
    insiderFactionId: string | null;
}

/** Who is talking. Never the player, and never adjusted for them. */
export interface Speaker {
    ordinal: number;
    /** Their faction, which is what makes them an insider to anything. */
    factionId: string | null;
}

/** Where the talking is happening. Null means "do not narrow by place". */
export interface Locale {
    regionId: string | null;
}

// ─────────────────────────────────────────────────────────────────────────
// BUILDING THE TABLE
// ─────────────────────────────────────────────────────────────────────────

/** Region a faction sits in, counting branches, so a branch office is local. */
function regionOfFaction(factionId: string): string | null {
    const seat = getRegionForFaction(factionId);
    if (seat) return seat.id;
    const branch = getBranchesOf(factionId)[0];
    return branch ? branch.region.id : null;
}

/**
 * Factions in the sect catalog, plus the ancient houses, which are sects to the
 * engine.
 */
function sectRows(): Mentionable[] {
    return SECTS.map(sect => ({
        kind: 'sect' as const,
        id: sect.id,
        name: sect.name,
        catalog: 'sects' as const,
        deep: false,
        floorOrdinal: sect.powerOrdinal >= COMMON_CURRENCY_ORDINAL ? 0 : sect.powerOrdinal,
        regionId: regionOfFaction(sect.id),
        insiderFactionId: sect.id
    }));
}

/**
 * Houses that no longer exist and are still load-bearing.
 *
 * Deep, and high: a house destroyed nine centuries ago is a name held by
 * archives and by the people standing on its ruins, not by a market town.
 */
function destroyedHouseRows(): Mentionable[] {
    return DESTROYED_DAO_HOUSES.map(house => ({
        kind: 'sect' as const,
        id: house.id,
        name: house.name,
        catalog: 'destroyed-houses' as const,
        deep: true,
        floorOrdinal: 24,
        regionId: null,
        insiderFactionId: house.destroyedBy
    }));
}

/**
 * The institutions above the map.
 */
function apexRows(): Mentionable[] {
    return APEX_INSTITUTIONS.map(apex => ({
        kind: 'sect' as const,
        id: apex.id,
        name: apex.name,
        catalog: 'apex' as const,
        deep: true,
        floorOrdinal: apex.powerOrdinal,
        regionId: null,
        insiderFactionId: apex.id
    }));
}

/**
 * The courts, and the one case discovery.md works through itself.
 */
function courtRows(): Mentionable[] {
    return COURTS.map(court => ({
        kind: 'sect' as const,
        id: court.id,
        name: court.name,
        catalog: 'courts' as const,
        deep: false,
        floorOrdinal: 0,
        regionId: court.grantsInRegionId,
        insiderFactionId: court.embodiedByFactionId
    }));
}

/**
 * Guests seated at a faction, who are visible in a way a distant power is not.
 */
function guestElderRows(): Mentionable[] {
    return GUEST_ELDERS.map(elder => ({
        kind: 'cultivator' as const,
        id: elder.id,
        name: elder.name,
        catalog: 'guest-elders' as const,
        deep: false,
        floorOrdinal: 0,
        regionId: regionOfFaction(elder.hostFactionId),
        insiderFactionId: elder.hostFactionId
    }));
}

/**
 * Named people inside the factions.
 */
function memberRows(): Mentionable[] {
    return MEMBERS.map(member => ({
        kind: 'cultivator' as const,
        id: member.id,
        name: member.name,
        catalog: 'members' as const,
        deep: false,
        floorOrdinal: member.realmOrdinal,
        regionId: regionOfFaction(member.factionId),
        insiderFactionId: member.factionId
    }));
}

/**
 * The unattached, and the versions of them that circulate.
 */
function wandererRows(): Mentionable[] {
    const out: Mentionable[] = [];
    for (const wanderer of WANDERERS) {
        out.push({
            kind: 'cultivator',
            id: wanderer.id,
            name: wanderer.recordName,
            catalog: 'wanderers',
            deep: true,
            floorOrdinal: wanderer.lastOrdinal,
            regionId: null,
            insiderFactionId: wanderer.affiliation.factionId
        });
        for (const legend of wanderer.legends) {
            out.push({
                kind: 'cultivator',
                id: `${wanderer.id}-as-${slug(legend.calledBy)}`,
                name: legend.calledBy,
                catalog: 'wanderers',
                deep: true,
                floorOrdinal: 6,
                regionId: null,
                insiderFactionId: null
            });
        }
    }
    return out;
}

/**
 * How far a sealed ancestor's existence has travelled, read off the catalog's own
 * `awareness` field rather than invented here.
 */
function sealedFloor(awareness: string): number | null {
    switch (awareness) {
        case 'published': return 16;
        case 'rumoured': return 4;
        case 'holder_only': return INSIDER_ONLY_FLOOR;
        default: return null;
    }
}

function heldInstrumentRows(): Mentionable[] {
    const out: Mentionable[] = [];
    for (const held of HELD_INSTRUMENTS) {
        const floor = sealedFloor(held.awareness);
        if (floor === null) continue;
        out.push({
            kind: 'cultivator',
            id: held.id,
            name: held.name,
            catalog: 'sealed-held',
            deep: true,
            floorOrdinal: floor,
            regionId: regionOfFaction(held.holderFactionId),
            insiderFactionId: held.holderFactionId
        });
    }
    return out;
}

function unownedAncestorRows(): Mentionable[] {
    const out: Mentionable[] = [];
    for (const unowned of UNOWNED_ANCESTORS) {
        const floor = sealedFloor(unowned.awareness);
        if (floor === null) continue;
        out.push({
            kind: 'cultivator',
            id: unowned.id,
            name: unowned.name,
            catalog: 'sealed-unowned',
            deep: true,
            floorOrdinal: floor,
            regionId: unowned.sealerFactionId ? regionOfFaction(unowned.sealerFactionId) : null,
            insiderFactionId: unowned.sealerFactionId
        });
    }
    return out;
}

/**
 * The ancestors on the far side of the Lid who still answer.
 */
function immortalChannelRows(): Mentionable[] {
    return IMMORTAL_CHANNELS.map(channel => ({
        kind: 'cultivator' as const,
        id: `channel-${channel.factionId}`,
        name: channel.ancestor.name,
        catalog: 'immortal-channels' as const,
        deep: true,
        floorOrdinal: INSIDER_ONLY_FLOOR,
        regionId: regionOfFaction(channel.factionId),
        insiderFactionId: channel.factionId
    }));
}

/**
 * The consumables that came down from above.
 *
 * High realm, because the whole social consequence of one of these is what it
 * does to a person among people who understand what they are looking at.
 */
function immortalItemRows(): Mentionable[] {
    return IMMORTAL_ITEMS.map(item => ({
        kind: 'event' as const,
        id: item.id,
        name: item.name,
        catalog: 'immortal-items' as const,
        deep: true,
        floorOrdinal: HIGH_REALM_THRESHOLD,
        regionId: null,
        insiderFactionId: null
    }));
}

/**
 * The named ages, floored by how well the record survives them.
 */
function ageRows(): Mentionable[] {
    return AGES.map(age => {
        const fidelity = AGE_FIDELITY[age.id] ?? 'rumour';
        const floor = fidelity === 'full' ? 0 : fidelity === 'partial' ? 12 : 24;
        return {
            kind: 'event' as const,
            id: age.id,
            name: age.name,
            catalog: 'ages' as const,
            // The present age is what people call now. Only the dead ones are
            // deep, and grouping them all as deep would make the calendar rare.
            deep: fidelity !== 'full',
            floorOrdinal: floor,
            regionId: null,
            insiderFactionId: null
        };
    });
}

/** Civilisations that are gone and whose works the present is still using. */
function deadCivilisationRows(): Mentionable[] {
    return DEAD_CIVILISATIONS.map(dead => ({
        kind: 'event' as const,
        id: dead.id,
        name: dead.name,
        catalog: 'dead-civilisations' as const,
        deep: true,
        // A disputed one is a name held by the two people arguing about it.
        floorOrdinal: dead.existence === 'established' ? 20 : 30,
        regionId: null,
        insiderFactionId: null
    }));
}

/**
 * The incompatible readings of the Lid, each held by a serious institution.
 */
function lidTheoryRows(): Mentionable[] {
    return LID_THEORIES.map(theory => ({
        kind: 'event' as const,
        id: theory.id,
        name: theory.name,
        catalog: 'lid-theories' as const,
        deep: true,
        floorOrdinal: 34,
        regionId: null,
        insiderFactionId: theory.heldBy
    }));
}

/**
 * Competing accounts of where cultivation came from, floored by the catalog's
 * own `currency` field: how much of the world actually holds each one.
 */
function originAccountRows(): Mentionable[] {
    const floors: Record<string, number> = {
        most_of_the_world: 0,
        widespread: 6,
        institutional: 18,
        minority: 22,
        two_people: INSIDER_ONLY_FLOOR
    };
    return ORIGIN_ACCOUNTS.map(account => ({
        kind: 'event' as const,
        id: account.id,
        name: account.name,
        catalog: 'origin-accounts' as const,
        deep: true,
        floorOrdinal: floors[account.currency] ?? 22,
        regionId: null,
        insiderFactionId: account.heldBy[0] ?? null
    }));
}

/** The provinces themselves, and every settlement and site inside them. */
function regionRows(): Mentionable[] {
    const out: Mentionable[] = [];
    for (const region of REGIONS) {
        out.push({
            kind: 'place',
            id: region.name,
            name: region.name,
            catalog: 'regions',
            deep: false,
            floorOrdinal: 0,
            regionId: region.id,
            insiderFactionId: null
        });
        for (const place of region.places) {
            out.push({
                kind: 'place',
                id: place.name,
                name: place.name,
                catalog: 'places',
                deep: false,
                floorOrdinal: 0,
                regionId: region.id,
                insiderFactionId: null
            });
        }
    }
    return out;
}

/** Where things are sold, which is the most ordinary talk there is. */
function auctionVenueRows(): Mentionable[] {
    return AUCTION_VENUES.map(venue => ({
        kind: 'place' as const,
        id: venue.id,
        name: venue.name,
        catalog: 'auction-venues' as const,
        deep: false,
        floorOrdinal: 0,
        regionId: venue.regionId,
        insiderFactionId: venue.runByFactionId
    }));
}

function slug(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * One name is one name, however many catalogs it appears in.
 */
function normaliseName(name: string): string {
    return name.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * The table, built once.
 */
function buildLore(): Mentionable[] {
    const rows = [
        ...regionRows(),
        ...auctionVenueRows(),
        ...sectRows(),
        ...courtRows(),
        ...guestElderRows(),
        ...memberRows(),
        ...ageRows(),
        ...originAccountRows(),
        ...destroyedHouseRows(),
        ...deadCivilisationRows(),
        ...lidTheoryRows(),
        ...immortalItemRows(),
        ...heldInstrumentRows(),
        ...unownedAncestorRows(),
        ...immortalChannelRows(),
        ...apexRows(),
        ...wandererRows()
    ];

    const seen = new Set<string>();
    const out: Mentionable[] = [];
    for (const row of rows) {
        const key = normaliseName(row.name);
        if (key.length === 0 || seen.has(key)) continue;
        seen.add(key);
        out.push(row);
    }
    return out;
}

/** Every name anybody in this world could say, with the terms for saying it. */
export const LORE: readonly Mentionable[] = buildLore();

// ─────────────────────────────────────────────────────────────────────────
// WHO COULD SAY WHAT, AND HOW OFTEN
// ─────────────────────────────────────────────────────────────────────────

/**
 * Which band a row falls in for a listener standing in a given place.
 *
 * Deep material is deep wherever it is standing. Everything else is graded by
 * whether it belongs to here, to somewhere else, or to nowhere in particular.
 */
export function bandFor(entry: Mentionable, locale: Locale): LoreBand {
    if (entry.deep) return 'deep';
    if (entry.regionId === null) return 'world';
    if (locale.regionId === null) return 'regional';
    return entry.regionId === locale.regionId ? 'local' : 'regional';
}

/**
 * How often each band should surface when somebody is talking TO the player.
 */
export const TOLD_BAND_WEIGHTS: Record<LoreBand, number> = {
    local: 62,
    regional: 20,
    world: 15,
    deep: 3
};

/**
 * And when they are talking to each other.
 */
export const OVERHEARD_BAND_WEIGHTS: Record<LoreBand, number> = {
    local: 44,
    regional: 18,
    world: 20,
    deep: 18
};

/**
 * Whether this speaker holds this name at all.
 */
export function holds(entry: Mentionable, speaker: Speaker): boolean {
    if (entry.insiderFactionId !== null && entry.insiderFactionId === speaker.factionId) return true;
    return entry.floorOrdinal <= speaker.ordinal + WORKING_KNOWLEDGE_MARGIN;
}

/**
 * Everything this speaker could drop into a sentence without thinking.
 */
export function mentionableFor(speaker: Speaker): Mentionable[] {
    return LORE.filter(entry => holds(entry, speaker));
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT ANYBODY FROM HERE ALREADY HAS
// ─────────────────────────────────────────────────────────────────────────

/**
 * The geography an ordinary person born in a place grew up holding.
 */
export interface LocalGeography {
    /** The region the home place sits in, or null when it is off the map. */
    regionId: string | null;
    /** That region, as a name. Null when it is called what its seat is called. */
    region: GeographyPlace | null;
    /** Every other settlement and site in it. Ordinary local knowledge. */
    neighbours: GeographyPlace[];
    /**
     * Regions the home region has a road to.
     */
    further: GeographyPlace[];
}

/** A place, reduced to what a knowledge record actually files. */
export interface GeographyPlace {
    /** The name, which is also the id an existence record is filed under. */
    id: string;
    name: string;
    regionId: string;
}

/**
 * What somebody from `home` can point at without being told.
 */
export function localGeographyFor(home: string | null | undefined): LocalGeography {
    const regionId = regionOfPlace(home);
    if (regionId === null) {
        return { regionId: null, region: null, neighbours: [], further: [] };
    }

    const region = REGIONS.find(entry => entry.id === regionId) ?? null;
    if (!region) return { regionId, region: null, neighbours: [], further: [] };

    const wantedHome = normaliseName(home ?? '');
    const neighbours: GeographyPlace[] = [];
    for (const place of region.places) {
        if (normaliseName(place.name) === wantedHome) continue;
        neighbours.push({ id: place.name, name: place.name, regionId });
    }

    // The border, and what is past it. Deduplicated because a region can be
    // reachable four ways - a trade route, a refugee flow, a shared office and
    // an argument about a survey are one road as far as a name goes.
    const further: GeographyPlace[] = [];
    const seen = new Set<string>();
    for (const connection of region.connections) {
        if (seen.has(connection.otherRegionId)) continue;
        seen.add(connection.otherRegionId);
        const other = REGIONS.find(entry => entry.id === connection.otherRegionId);
        if (!other) continue;
        further.push({ id: other.name, name: other.name, regionId: other.id });
    }

    // The province's own name, unless a town inside it is called the same
    // thing. Where both exist the town is the one worth holding: it is
    // somewhere a person can walk to, and carrying both would put two spellings
    // of one word in front of a narrator that then has to choose.
    const seatSharesTheName = region.places
        .some(place => normaliseName(place.name) === normaliseName(region.name));

    return {
        regionId,
        region: seatSharesTheName ? null : { id: region.name, name: region.name, regionId },
        neighbours,
        further
    };
}

/**
 * Every place in the table this speaker could name, as plain rows.
 */
export function placesInLore(): Mentionable[] {
    return LORE.filter(entry => entry.kind === 'place');
}

/**
 * The region a free-text place name belongs to.
 */
export function regionOfPlace(place: string | null | undefined): string | null {
    const wanted = (place ?? '').trim().toLowerCase();
    if (wanted.length === 0) return null;
    for (const region of REGIONS) {
        if (region.name.toLowerCase() === wanted) return region.id;
        for (const spot of region.places) {
            if (spot.name.toLowerCase() === wanted) return region.id;
        }
    }
    return null;
}

/** The minimum an RNG has to offer to draw from this table. */
export interface LoreRng {
    int(min: number, max: number): number;
    weighted<K extends string>(weights: Record<K, number>): K;
}

/**
 * Draw one name: band first by weight, then uniformly inside the band.
 */
export function pickWeighted(
    candidates: readonly Mentionable[],
    locale: Locale,
    weights: Record<LoreBand, number>,
    rng: LoreRng
): Mentionable | null {
    if (candidates.length === 0) return null;

    const byBand = new Map<LoreBand, Mentionable[]>();
    for (const entry of candidates) {
        const band = bandFor(entry, locale);
        const bucket = byBand.get(band);
        if (bucket) bucket.push(entry);
        else byBand.set(band, [entry]);
    }

    // Only bands that actually have something. `weighted` throws on an empty
    // table and on a table with no positive weight, and a scene where the one
    // available band happens to be the rarest must still produce a name.
    const table: Partial<Record<LoreBand, number>> = {};
    let total = 0;
    for (const [band, bucket] of byBand) {
        if (bucket.length === 0) continue;
        const weight = weights[band];
        if (weight <= 0) continue;
        table[band] = weight;
        total += weight;
    }
    if (total <= 0) {
        const flat = [...byBand.values()].flat();
        return flat[rng.int(0, flat.length - 1)];
    }

    const band = rng.weighted(table as Record<LoreBand, number>);
    const bucket = byBand.get(band)!;
    return bucket[rng.int(0, bucket.length - 1)];
}
