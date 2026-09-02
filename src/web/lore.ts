/**
 * The speakable world: every name a person in this world could put in a
 * sentence, and the conditions under which they would.
 *
 * ── The problem this file exists to fix ───────────────────────────────────
 * `src/data/cultivation/` holds tens of thousands of lines of world. Almost
 * none of it was reachable in play. `hearsay.ts` drew names from exactly one
 * catalog - `SECTS` - and everything else was read only by the admin register,
 * which means the deep material was visible to the operator and invisible to
 * the player. The world was alive in the test suite and static in the game.
 *
 * Nothing here adds content. It is wiring: one table, built once at module
 * load from the catalogs that already exist, that answers the only question
 * the discovery channels need answered -
 *
 *     what could THIS speaker, standing HERE, plausibly mention right now?
 *
 * ── Reachable means acquirable, never printed ─────────────────────────────
 * docs/world/houses/discovery.md is the constitution: never reference an entity the
 * player has no knowledge record for. So nothing in this file makes a name
 * visible. It makes a name *sayable by somebody in the world*, which is how
 * the player acquires the record, which is what then licenses the name. The
 * order is load-bearing and it is the opposite of the obvious one.
 *
 * ── Three gates, and none of them consult the player ──────────────────────
 * A speaker is not adjusting for their audience. It does not occur to them
 * that explanation is required. So the gates are all facts about the SPEAKER
 * and the PLACE:
 *
 *   floor      the standing at which this name is in a person's working
 *              vocabulary. A carter does not know what an apex sect is; he is
 *              not being cagey, he has never needed the word.
 *   insider    a faction's own people hold their own names whatever their
 *              standing. An outer disciple can name their own sect's sealed
 *              ancestor and a patriarch three provinces away cannot.
 *   locality   where the name belongs. Used for WEIGHT and never for
 *              exclusion, because names do travel - just rarely, and wrong.
 *
 * ── Weighting, so the common case stays common ────────────────────────────
 * Most talk is local, mundane and about sects. The deep material - the ages,
 * the dead civilisations, the Lid theories, what is sealed under somebody's
 * floor - has to stay rare or it stops being deep. Bands are picked first and
 * weighted, then a name is drawn uniformly inside the band, so a catalog with
 * four hundred entries cannot swamp one with four.
 *
 * The deep band is weighted higher for the OVERHEARD channel than for the
 * told one, which is the whole texture discovery.md asks for: deep material
 * arriving mostly as fragments the player cannot resolve and cannot ask about.
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
 *
 * A cultivator deals with, competes against and is bullied by things within
 * roughly two realms of themselves, and can name them the way anyone names
 * their own trade.
 */
export const WORKING_KNOWLEDGE_MARGIN = 8;

/**
 * Power at which a faction becomes common currency regardless of who is
 * speaking.
 *
 * This is what makes the register work. A carter has no business knowing
 * anything about Body Integration politics, and still says "Hollow Court
 * business" the way you would say a bank holiday, because some names are simply
 * in the air. The mundane and the enormous sound identical when both are
 * assumed knowledge, and the speaker's tone cannot distinguish them - because
 * to them both are ordinary.
 */
export const COMMON_CURRENCY_ORDINAL = 33;

/**
 * A floor no speaker can clear, for names only an insider holds.
 *
 * An institution's own dead, its own channel upward and its own reading of the
 * Lid are not things that circulate. They are said inside the walls or they are
 * not said, and `insiderFactionId` is the only way past this number.
 */
export const INSIDER_ONLY_FLOOR = MAX_ORDINAL + WORKING_KNOWLEDGE_MARGIN + 1;

// ─────────────────────────────────────────────────────────────────────────
// SHAPES
// ─────────────────────────────────────────────────────────────────────────

/**
 * How far from ordinary life a name sits, which decides how often it surfaces.
 *
 * Computed against the listener's location rather than baked in, because the
 * Weir Office is local talk in the Marches and a curiosity in the Low Fall,
 * and the same row has to be able to be both.
 */
export type LoreBand = 'local' | 'regional' | 'world' | 'deep';

/**
 * Which catalog a name came out of.
 *
 * Carried on every row for one reason: it is the assertion that stops this
 * regressing. A test can demand that every catalog still has at least one
 * reachable row, so "written but unreachable" fails the build instead of
 * being discovered months later.
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
 *
 * `kind` is a GATE, not a taxonomy. discovery.md names four things the rule
 * covers - a faction, a famous cultivator, a distant city, a historical event -
 * and the knowledge layer has exactly those four kinds. So an age, a dead
 * civilisation, a reading of the Lid and an object that came down from above
 * all file as `event`: they are things that happened or were made, they gate
 * identically, and a player who has heard one of the names cannot tell which
 * category it belongs to anyway. That last part is the point rather than a
 * compromise.
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
 * Factions in the sect catalog, plus the ancient houses, which are sects to
 * the engine.
 *
 * The floor reproduces the rule `speakableFor` has always applied: your own
 * working range, plus anything large enough to be in the air regardless.
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
 *
 * `powerOrdinal` is the floor unmodified, which puts them out of reach of
 * everybody the player will meet for a very long time. That is the design:
 * "nobody at an apex is ever seen, which is the whole reason no sect can name
 * what is above it."
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
 *
 *     "Road's shut past the ford. Sill business, so it'll be shut a while."
 *
 * He says it the way you would say a bank holiday. So a court's NAME is in the
 * air at floor zero even though every court's `startingAwareness` is `unaware`
 * - which is not a contradiction but the entire mechanism. The name is
 * ordinary; what it refers to is not, and the player gets the first without
 * the second and no way to convert one into the other by thinking about it.
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
 *
 * Floor zero, because a Void Refinement cultivator sitting on the gorge vein
 * eleven months a year is a thing the town knows about. It is local knowledge
 * rather than elevated knowledge, and the region gate is what keeps it honest.
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
 *
 * Their own realm is the floor, so a Sword Servant is common gossip and a
 * Sword Elder is not - and their faction is an insider key, so the people they
 * actually stand next to can name them whatever their own standing.
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
 *
 * Two rows of different kinds per wanderer, and the difference is the whole
 * value. The record name sits at his real standing, which is out of everyone's
 * reach. The legends sit low, because a legend is precisely the thing that
 * travels down to people who could never meet him - and they are mutually
 * incompatible, so a player who collects two of them holds two names for
 * something and no reason to connect them.
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
 * How far a sealed ancestor's existence has travelled, read off the catalog's
 * own `awareness` field rather than invented here.
 *
 * `published` is a deterrent and is meant to be known by the parties it is
 * aimed at, which are institutions rather than carters. `rumoured` is the
 * opposite shape: circulating, unverified, mostly right, and exactly the sort
 * of thing an ordinary person repeats. `holder_only` never leaves the walls.
 * `unknown_to_holder` and `forgotten` return null and are unsayable by
 * anybody, which is the correct and permanent state for both.
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
 *
 * Insider only, without exception. A channel is the single most valuable thing
 * an institution has and none of them discuss it; the name of who is on the
 * other end is said inside the walls or nowhere, and the catalog's own naming
 * says as much - "named on the schedule and nowhere else".
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
 *
 * `AGE_FIDELITY` already grades this and is used for nothing else outside the
 * data tests. The present age is the calendar everyone dates by, so it costs
 * nothing to name. An age that survives only as rumour is a name held by
 * people who read.
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
 *
 * Insider only, plus a very high floor, because a house's reading of the Lid
 * is its position rather than a fact in circulation. Somebody hearing "the
 * Containment" said flatly has heard a name for a disagreement they have no
 * idea exists.
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
 *
 * The Azure Cloud Pavilion is a sect row and an apex row and they are the same
 * words. Two rows would let the player acquire the name twice, from two
 * sources, under two ids, which would read as two things - so the shallower
 * one wins and the build order below decides which that is.
 */
function normaliseName(name: string): string {
    return name.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * The table, built once.
 *
 * Ordered shallow to deep on purpose: the dedupe keeps the first row for a
 * name, and where a name is reachable two ways it should be reachable the
 * ordinary way. Somebody who has heard of the Azure Cloud Pavilion has heard
 * of a sect with a front gate, not of the third apex.
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
 *
 * Most talk is local, mundane and about sects. The numbers are shares of a
 * band draw rather than per-row weights, so a catalog's size cannot buy it
 * airtime: four hundred members and four ages compete as two bands, not as
 * four hundred rows against four.
 */
export const TOLD_BAND_WEIGHTS: Record<LoreBand, number> = {
    local: 62,
    regional: 20,
    world: 15,
    deep: 3
};

/**
 * And when they are talking to each other.
 *
 * The deep share is six times the told one, which is the texture discovery.md
 * asks for: the material the world does not explain arrives mostly as
 * fragments from a conversation that was not for the player, where the option
 * to ask is gone and what they end up holding is compromising to admit.
 */
export const OVERHEARD_BAND_WEIGHTS: Record<LoreBand, number> = {
    local: 44,
    regional: 18,
    world: 20,
    deep: 18
};

/**
 * Whether this speaker holds this name at all.
 *
 * Nothing here consults the player. That is the whole point: the speaker is
 * not adjusting for their audience, because it has not occurred to them that
 * they need to.
 */
export function holds(entry: Mentionable, speaker: Speaker): boolean {
    if (entry.insiderFactionId !== null && entry.insiderFactionId === speaker.factionId) return true;
    return entry.floorOrdinal <= speaker.ordinal + WORKING_KNOWLEDGE_MARGIN;
}

/**
 * Everything this speaker could drop into a sentence without thinking.
 *
 * Deliberately not narrowed by place. Where a name belongs is a question about
 * how OFTEN it gets said, not about whether it can be, and that is settled by
 * `bandFor` at the point of the draw. A name that belongs somewhere else is a
 * name that travels rarely and arrives garbled, which is a thing that happens
 * rather than a thing to forbid.
 */
export function mentionableFor(speaker: Speaker): Mentionable[] {
    return LORE.filter(entry => holds(entry, speaker));
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT ANYBODY FROM HERE ALREADY HAS
// ─────────────────────────────────────────────────────────────────────────

/**
 * The geography an ordinary person born in a place grew up holding.
 *
 * discovery.md draws the line at the county: "Their world is the county, the
 * local sect that takes disciples, the market town, and whatever their
 * grandmother believed." The county is not one village. Somebody raised in a
 * temple town can name the market town two days off, the province seat, and
 * the fact that there is a border and something on the other side of it -
 * because everybody around them could, since before they could walk.
 *
 * This is not a revelation and must not be dressed as one. It is the floor the
 * ladder starts from, and the reason it exists is that a cultivator who cannot
 * name anywhere cannot leave, and a cultivator who cannot leave dies on thin
 * ground at the bottom of the ladder without ever having been told there was
 * anywhere else.
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
     *
     * A name and a direction and nothing else. Everybody knows there is a
     * border and roughly what is over it; nobody local can tell you anything
     * useful about it, and several of them are wrong.
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
 *
 * Read straight off `REGIONS` rather than off {@link LORE}, and that is not an
 * oversight. The lore table deduplicates by NAME so that a thing reachable two
 * ways is acquired once - which is right for hearsay and wrong here: a province
 * and the town it is named after collapse into a single row there, and a
 * cultivator seeded from that row would hold "The Low Fall" and then be unable
 * to travel to "Low Fall". The names a person grew up saying are the catalog's
 * own, and this is the one caller that needs them exactly.
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
 *
 * The traveller channel's candidate list. Places only, because a traveller's
 * value is geography: they are the one source a cultivator who never leaves
 * has for the existence of anywhere else.
 */
export function placesInLore(): Mentionable[] {
    return LORE.filter(entry => entry.kind === 'place');
}

/**
 * The region a free-text place name belongs to.
 *
 * A cultivator's `location` is free text by design and the catalogs key on
 * region ids, so this is the join, done by name because the name is what both
 * sides agree on. Returns null rather than guessing, and null means "do not
 * narrow by place" everywhere downstream.
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
 *
 * Two stages rather than one because they answer different questions. The band
 * roll decides how far from ordinary life this sentence is going to reach,
 * which is a property of conversations. The row roll decides which name, which
 * is a property of the catalog. Collapsing them would let whichever catalog
 * happens to be largest decide the register of the world.
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
