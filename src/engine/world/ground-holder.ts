/**
 * Who holds the ground somebody is standing on.
 *
 * Every place in this world belongs to somebody or to nobody, and until now
 * nothing could ask which. The column exists - `LocationRecord.controllingFactionId`,
 * stamped on all 879 held locations at seeding - and the two questions a caller
 * actually has are one level up from it:
 *
 *   WHOSE GROUND IS THIS?      the column, read up the containment chain,
 *                              because a hall belongs to the compound and the
 *                              compound belongs to the house.
 *   AND IF NOBODY'S, WHY NOT?  which is not the same answer as "the record does
 *                              not say", and conflating the two is the defect
 *                              AGENTS.md names: an unwritten field reads as a
 *                              value, and the code around it answers with
 *                              total confidence.
 *
 * ── THE CHAIN, AND WHERE IT RUNS OUT ─────────────────────────────────────
 *
 * Measured on a seeded world: 944 locations, 879 of them carrying a holder -
 * every precinct, hall, vault, chamber, sect seat and vein. The 65 that do not
 * are the five regions, the eighteen settlements, and the wilds, ruins and
 * scars between them. **So a compound has a holder and a town does not**, which
 * is exactly the ground a player spends most of a run standing on.
 *
 * That is not a hole to be filled by stamping a faction onto every town. The
 * catalog already answers it and has never been asked: `PREFECTURES` in
 * `data/cultivation/regions.ts` carries `seat` and `places` as `RegionPlace`
 * NAMES, and `heldByFactionId` with `null` documented in place as "a real
 * answer... ground the record carries with no name against it". Four of the
 * fifteen rows are null. Nothing in `src/` read that table before this file.
 *
 * So the chain is: the column, then the prefecture register, then the region's
 * own politics, and the three run out in different ways which are kept apart:
 *
 *   held                  somebody holds this and can be named
 *   no_holder_of_record   the register carries the ground with nobody's name
 *                         against it. Scarwater, Sixmile, the Dead Verge
 *   no_authority          the region itself declares nobody holds it, which in
 *                         the catalog today is the Drowned Reach
 *   unrecorded            nothing anywhere says. NOT the same as unheld, and
 *                         a caller that treats it as such has invented a
 *                         vacuum out of a missing row
 *
 * ── AND IT IS A PROPERTY READ, NEVER AN IDENTITY ONE ─────────────────────
 *
 * Nothing here branches on a house's name and nothing may. What comes back is
 * a faction id and the alignment on that faction's catalog row, off the same
 * field `willTheHouseBackThis` and `ifCaughtPractising` read - so a house added
 * tomorrow gets whatever behaviour is built on this for free.
 *
 * Pure. Records in, a reading out. No I/O, no RNG, no mutation.
 */

import { PREFECTURES } from '../../data/cultivation/regions.js';
import { getSect } from '../../data/cultivation/sects.js';
import type { SectAlignment } from '../../schema/cultivation.js';
import type { LocationRecord } from './locations.js';

/** How the question was answered, and the three ways it can fail to be. */
export type GroundHolding =
    /** Somebody holds it, and the record says who. */
    | 'held'
    /** The register carries this ground with nobody's name against it. */
    | 'no_holder_of_record'
    /** The place itself declares that nobody holds it and nobody can. */
    | 'no_authority'
    /** Nothing anywhere says. Not a vacuum - an absence of record. */
    | 'unrecorded';

export interface WhoHoldsThisGround {
    /** The location asked about, when it was found. */
    placeId: string | null;
    placeName: string | null;
    holding: GroundHolding;
    /** Which location in the chain actually carried the answer. */
    answeredAtId: string | null;
    holderFactionId: string | null;
    holderName: string | null;
    /**
     * The holder's alignment, off the catalog row.
     *
     * Null for every non-`held` reading, and null for a holder the sect
     * catalog cannot place - a renamed house degrades to "somebody holds this
     * and I cannot say what kind of house they are" rather than silently
     * reading as unheld.
     */
    alignment: SectAlignment | null;
    /** One factual line. What a refusal would name as the route. */
    why: string;
}

/**
 * The region's own declaration, as the seeder wrote it onto the record.
 *
 * `politics` is copied onto `LocationRecord.data` by `seedRegions`, so this is
 * read off the world's own state rather than off the catalog a second time.
 */
const REGION_DECLARES_NOBODY = 'no_authority';

function chainFrom(
    locations: readonly LocationRecord[],
    locationId: string
): LocationRecord[] {
    const byId = new Map(locations.map(l => [l.id, l]));
    const chain: LocationRecord[] = [];
    const seen = new Set<string>();
    let at = byId.get(locationId);
    // `parentId` is data and a cycle in it is survivable rather than fatal,
    // the same posture `places.ts` takes when it walks the same edges.
    while (at && !seen.has(at.id)) {
        seen.add(at.id);
        chain.push(at);
        at = at.parentId ? byId.get(at.parentId) : undefined;
    }
    return chain;
}

/**
 * The prefecture whose register carries this place, by name.
 *
 * By NAME because that is what the catalog stores: a prefecture's `seat` and
 * `places` are `RegionPlace` names, and a seeded settlement's location name is
 * that same string verbatim (`seedRegions` copies `place.name`). Matching on an
 * id would need a field the catalog has never had.
 */
function prefectureCarrying(placeName: string): typeof PREFECTURES[number] | null {
    const wanted = placeName.trim().toLowerCase();
    for (const prefecture of PREFECTURES) {
        if (prefecture.seat.trim().toLowerCase() === wanted) return prefecture;
        if (prefecture.places.some(p => p.trim().toLowerCase() === wanted)) return prefecture;
    }
    return null;
}

function nameOf(factionId: string | null): string | null {
    if (!factionId) return null;
    return getSect(factionId)?.name ?? null;
}

function alignmentOf(factionId: string | null): SectAlignment | null {
    if (!factionId) return null;
    return getSect(factionId)?.alignment ?? null;
}

const NOWHERE: WhoHoldsThisGround = Object.freeze({
    placeId: null,
    placeName: null,
    holding: 'unrecorded' as const,
    answeredAtId: null,
    holderFactionId: null,
    holderName: null,
    alignment: null,
    why: 'There is no place on the record to ask the question of.'
});

/**
 * Who holds the ground under this location.
 *
 * Nearest answer first, which is the same posture as `howNearTheyStand`: a
 * chamber inside a compound is the house's ground even though the province
 * around it is nobody's, and the closest true statement is the right one.
 */
export function whoHoldsTheGround(
    locations: readonly LocationRecord[],
    locationId: string | null | undefined
): WhoHoldsThisGround {
    if (!locationId) return NOWHERE;
    const chain = chainFrom(locations, locationId);
    if (chain.length === 0) return NOWHERE;

    const here = chain[0];
    const base = { placeId: here.id, placeName: here.name };

    // ── THE COLUMN, UP THE CHAIN ─────────────────────────────────────────
    for (const step of chain) {
        const holder = step.controllingFactionId;
        if (!holder) continue;
        const holderName = nameOf(holder);
        return {
            ...base,
            holding: 'held',
            answeredAtId: step.id,
            holderFactionId: holder,
            holderName,
            alignment: alignmentOf(holder),
            why: step.id === here.id
                ? `${holderName ?? holder} holds this ground.`
                : `This is inside ${step.name}, which ${holderName ?? holder} holds.`
        };
    }

    // ── THE REGISTER ─────────────────────────────────────────────────────
    //
    // Only for the place itself and never for its province: a prefecture is a
    // district inside a province, so reading the province's row against a
    // village inside a different district would be answering a question about
    // one piece of ground with the record of another.
    const prefecture = here.name ? prefectureCarrying(here.name) : null;
    if (prefecture) {
        // A district is often named for the town it is run out of, and "X is in
        // X" is the sentence a reader stops trusting. Say the district only
        // where it adds a name the player did not already have.
        const district = prefecture.name.trim().toLowerCase() === here.name.trim().toLowerCase()
            ? here.name
            : `${here.name}, in ${prefecture.name},`;
        const holder = prefecture.heldByFactionId;
        if (holder) {
            const holderName = nameOf(holder);
            return {
                ...base,
                holding: 'held',
                answeredAtId: here.id,
                holderFactionId: holder,
                holderName,
                alignment: alignmentOf(holder),
                why: `${district} is held by ${holderName ?? holder}.`
            };
        }
        return {
            ...base,
            holding: 'no_holder_of_record',
            answeredAtId: here.id,
            holderFactionId: null,
            holderName: null,
            alignment: null,
            why:
                `${district} is on the register with nobody's name against it.`
        };
    }

    // ── WHAT THE REGION SAYS ABOUT ITSELF ────────────────────────────────
    for (const step of chain) {
        if (step.data?.politics === REGION_DECLARES_NOBODY) {
            return {
                ...base,
                holding: 'no_authority',
                answeredAtId: step.id,
                holderFactionId: null,
                holderName: null,
                alignment: null,
                why: `Nobody holds ${step.name}, and everybody has noticed.`
            };
        }
    }

    return {
        ...base,
        holding: 'unrecorded',
        answeredAtId: null,
        holderFactionId: null,
        holderName: null,
        alignment: null,
        why: `Nothing on the record says who holds ${here.name}.`
    };
}
