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
 * Measured on a seeded world when this file was written: 944 locations, 879 of
 * them carrying a holder - every precinct, hall, vault, chamber, sect seat and
 * vein - and not one of the settlements. **So a compound had a holder and a
 * town did not**, which is exactly the ground a player spends most of a run on.
 *
 * That was never a hole to be filled by stamping a faction onto every town, and
 * it is now filled by asking the catalog, which had been answering all along:
 * `PREFECTURES` in `data/cultivation/regions.ts` carries `seat` and `places` as
 * `RegionPlace` NAMES with `heldByFactionId` beside them, `null` documented in
 * place as "a real answer... ground the record carries with no name against
 * it". `catalog.ts` now joins that register onto each place and `seedRegions`
 * stamps the column, so 11 of the 23 settlements carry a holder at seeding and
 * 12 carry none on purpose. This file read the register first; the difference
 * is that the world now holds the answer, which is what let the economy charge
 * for it.
 *
 * The chain is unchanged: the column, then the prefecture register, then the
 * region's own politics, and the three run out in different ways which are
 * kept apart:
 *
 *   held                  somebody holds this and can be named
 *   no_holder_of_record   the register carries the ground with nobody's name
 *                         against it. Clear River Ford, Six Li, Nine Hundred Paces
 *   no_authority          the region itself declares nobody holds it, which in
 *                         the catalog today is the Drowned Sea
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
import { whatATownPaysItsHolder, type LocationRecord } from './locations.js';
import { rowById } from './world-state.js';

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
    const chain: LocationRecord[] = [];
    const seen = new Set<string>();
    // `rowById` rather than a Map built here: a chain is three or four steps
    // and this used to pay for a Map over every location in the world to walk
    // them. Measured with `--cpu-prof` on one seed at 1,200 years, that build
    // was 4.1ms per simulated year, entered per house per posting.
    let at: LocationRecord | null = rowById(locations, locationId);
    // `parentId` is data and a cycle in it is survivable rather than fatal,
    // the same posture `places.ts` takes when it walks the same edges.
    while (at && !seen.has(at.id)) {
        seen.add(at.id);
        chain.push(at);
        at = at.parentId ? rowById(locations, at.parentId) : null;
    }
    return chain;
}

/**
 * Whether this ground sits at, or anywhere under, that ground.
 *
 * The same chain `whoHoldsTheGround` walks, read in the other direction, and
 * the inverse question is the one somebody standing in a town actually asks:
 * that read answers *whose ground am I on* by looking UPWARD for a holder, and
 * a settlement is where the chain used to stop: measured on a pinned world, 988
 * of 1063 location records carried a holder and 0 of the 12 places a player's
 * `location` can be did, because the held ones were the compounds, precincts
 * and vaults sitting under those names. The settlements carry their own holder
 * now where the catalog names one, and the twelve that do not are unheld ground
 * rather than an unasked question.
 */
export function sitsWithin(
    locations: readonly LocationRecord[],
    locationId: string | null | undefined,
    containerId: string | null | undefined
): boolean {
    if (!locationId || !containerId) return false;
    return chainFrom(locations, locationId).some(step => step.id === containerId);
}

/**
 * The province this ground is in, as a location id.
 *
 * The nearest `region` ancestor, which is the level `seedRegions` creates and
 * hangs everything else off. Bounded on purpose: the outermost ancestor would
 * be one root for the world, and a province is the largest body somebody
 * standing in a market town has any relationship with.
 */
export function theProvinceAround(
    locations: readonly LocationRecord[],
    locationId: string | null | undefined
): string | null {
    if (!locationId) return null;
    for (const step of chainFrom(locations, locationId)) {
        if (step.kind === 'region') return step.id;
    }
    return null;
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
        // Whether saying the holder's name a second time would be saying
        // anything. Most ground that carries a holder on its own row is a
        // compound, a precinct or a vault, and those are named for the house
        // that holds them - so "Ashen Forge Clan holds Ashen Forge Clan
        // grounds" is the "X is in X" sentence the prefecture branch below has
        // always refused, and it is what naming the place naively produces.
        const groundCarriesTheirName = holderName !== null
            && here.name.toLowerCase().includes(holderName.toLowerCase());
        return {
            ...base,
            holding: 'held',
            answeredAtId: step.id,
            holderFactionId: holder,
            holderName,
            alignment: alignmentOf(holder),
            // THE ONE BRANCH THAT KNEW BOTH NAMES AND NAMED NO PLACE.
            //
            // Every other reading below names the ground it is about - the
            // district, the containing hall, the province that declares nobody
            // holds it, the place the record is silent about. This one, the case
            // where the world has the most to say, read "X holds this ground",
            // and `holding.why` is the first clause of `theGroundUnderYou`'s
            // `why`, which is the whole of what `whoAnswersHere` puts on
            // `facts.lines`. So the answer to "who holds this ground" named the
            // house and left the ground anonymous, with `here.name` in scope and
            // already copied into `base.placeName` on the line above. The
            // headline said the place and the line - the only channel a narrator
            // is ever sent - did not.
            why: step.id === here.id
                ? groundCarriesTheirName
                    ? `${here.name} is held by the house it is named for.`
                    : `${holderName ?? holder} holds ${here.name}.`
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

/**
 * Who collects here, and how much a year, for somebody standing in the town.
 *
 * THE READ THAT WAS ONLY EVER BUILT ONE WAY. A house could always answer what
 * it charges - `levy.on` is a sentence on the parentage record - and no place
 * could answer who charges AT IT. A verb at a city gate would have had to
 * search twenty-one levying houses for one whose `on` sentence mentioned a
 * gate, which is parsing prose, so the fee at a gate that this world charges in
 * every other sentence it writes about itself was unreachable from the ground
 * it is charged on.
 *
 * It answers for ground with no holder too, because a refusal that names the
 * gate is content and an empty answer is not: `holding` says which of the four
 * ways the question ran out, and `why` is the line to hand a narrator.
 */
export interface WhoCollectsHere {
    placeId: string | null;
    placeName: string | null;
    holding: GroundHolding;
    holderFactionId: string | null;
    holderName: string | null;
    /**
     * What the people of this town pay the holder in a year, in stones. Zero
     * for ground nobody holds and for ground that is not a town - a vein, a
     * ruin, a compound - which pay their holder by other means.
     */
    stonesAYear: number;
    why: string;
}

export function whoCollectsHere(
    locations: readonly LocationRecord[],
    locationId: string | null | undefined
): WhoCollectsHere {
    const ground = whoHoldsTheGround(locations, locationId);
    const here = locationId ? rowById(locations, locationId) : null;
    // Only the town itself pays, never an ancestor's town: `whoHoldsTheGround`
    // walks up to find who holds a hall inside a compound inside a city, and
    // charging the hall the city's tax would collect the same town twice.
    const stonesAYear = here && ground.holderFactionId !== null
        && ground.answeredAtId === here.id
        ? whatATownPaysItsHolder(here)
        : 0;
    return {
        placeId: ground.placeId,
        placeName: ground.placeName,
        holding: ground.holding,
        holderFactionId: ground.holderFactionId,
        holderName: ground.holderName,
        stonesAYear,
        why: ground.why
    };
}
