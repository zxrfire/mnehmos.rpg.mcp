/**
 * The three floors a house admits at - guest, servant, disciple.
 */

import { REALM_TIERS } from '../../engine/cultivation/realms.js';
import { FACTION_CHARACTER } from './faction-character.js';
import { SECTS, SECT_ADMISSION } from './sects.js';
import type { Sex } from '../../engine/birth/what-sex-somebody-is-and-what-it-is-for.js';

const SECT_BY_ID = new Map(SECTS.map(s => [s.id, s]));

/**
 * Slack above what a faction can reliably produce. One realm, roughly.
 */
export const ABOVE_PRODUCTION = 8;

/**
 * How far below what a house's ground reaches its servants may stand.
 */
export const A_SERVANT_STANDS_THIS_FAR_BELOW_WHAT_THE_GROUND_REACHES = 25;

/**
 * The rung at which sects stop recruiting you and start negotiating with you.
 *
 * Read off the ladder rather than retyped, because `REALM_TIERS` is the
 * authority and this exact sentence is that tier's own description.
 */
const NEGOTIATED_WITH_RATHER_THAN_RECRUITED =
    REALM_TIERS.find(t => t.key === 'core_formation')!.ordinalStart;

export interface HouseFloors {
    /**
     * Taken in without being taken on. Null where the house declares no such
     * door, which is all but one of the catalog.
     */
    guest: number | null;
    /**
     * Taken on at the menial tier. Null where the house has no menial tier at
     * all, in which case rank 0 is already a disciple rank and `disciple` is
     * the only floor below the ladder.
     */
    servant: number | null;
    /** On the disciple track. `Sect.admissionOrdinal`, unchanged. */
    disciple: number;
    /**
     * Whether anything at this house stands below the disciple track.
     */
    hasMenialTier: boolean;
}

/**
 * How far this house's ground and shelf carry somebody it took in.
 */
export function groundReachOf(factionId: string): number | undefined {
    const sect = SECT_BY_ID.get(factionId);
    if (!sect) return undefined;
    const admission = sect.admissionOrdinal;
    const production = FACTION_CHARACTER[factionId]?.production.reliableOrdinal ?? admission;
    return Math.min(sect.powerOrdinal, Math.max(admission, production) + ABOVE_PRODUCTION);
}

/** All three floors, or undefined for a faction that is not in the catalog. */
export function houseFloorsOf(factionId: string): HouseFloors | undefined {
    const sect = SECT_BY_ID.get(factionId);
    if (!sect) return undefined;

    const disciple = sect.admissionOrdinal;
    const hasMenialTier = disciple < NEGOTIATED_WITH_RATHER_THAN_RECRUITED;
    const reach = groundReachOf(factionId)!;

    // A servant is hired for the qi they already carry, so the bar prices the
    // ground they are being let onto rather than anything the house teaches.
    const worthOfStandingHere = reach - A_SERVANT_STANDS_THIS_FAR_BELOW_WHAT_THE_GROUND_REACHES;
    const servant = hasMenialTier ? Math.max(disciple, worthOfStandingHere) : null;

    return {
        guest: SECT_ADMISSION[factionId]?.guestFromOrdinal ?? null,
        servant,
        disciple,
        hasMenialTier
    };
}

/**
 * The floor for being taken on at the menial tier, or the disciple bar where the
 * house has no menial tier.
 */
export function servantBarOf(factionId: string): number | undefined {
    const floors = houseFloorsOf(factionId);
    if (!floors) return undefined;
    return floors.servant ?? floors.disciple;
}

/** The floor for the disciple track. `Sect.admissionOrdinal`, unchanged. */
export function discipleBarOf(factionId: string): number | undefined {
    return houseFloorsOf(factionId)?.disciple;
}

// ─────────────────────────────────────────────────────────────────────────
// THE ONE FLOOR THAT IS NOT A RUNG
// ─────────────────────────────────────────────────────────────────────────

/**
 * Houses that take one sex and not the other.
 */
export const A_HOUSE_THAT_TAKES_ONE_SEX: Readonly<Record<string, Sex>> = Object.freeze({
    /**
     * A Court whose ladder ends in one title held by one person, and whose whole
     * measure of standing is who it has taken and kept.
     */
    'sect-storm-tyrant-court': 'male',
    /**
     * A Court that is a household rather than a school, whose whole measure of
     * standing is the beds it has kept and who it has kept them with.
     */
    'sect-orchid-court': 'female'
});

/**
 * Why the second closed Court is not in the table above, recorded rather than
 * quietly left - the same posture as `FOLD_TRAVEL_ENGINE_GAP`.
 */
export const A_SECOND_CLOSED_COURT_IS_BLOCKED_ON_A_SEAT = {
    what: 'A women-only Court cannot be added to the catalog today without breaking one of two standing rulings, and the choice between them is the design owner\'s.',
    theFirstRuling:
        '"Court" is a TIER MARKER, not a name. `cultivation-courts.test.ts` requires every body called a Court to stand at powerOrdinal 34 or above, and when that rule was written the Azure Mist Court was RAISED from 27 rather than renamed. Combined with this file\'s own ruling that a closed door has to be a Court - a gate is only interesting if what is behind it is worth wanting - a new closed house cannot be small. It has to be a genuine power.',
    theSecondRuling:
        'A power of that size needs a province that supports one, and the only province whose physics and politics do is the Jade Gorge: it is the one place in the world where ground alone carries somebody to the top of the ladder, and the only one with a grant book for an ungranted vein to be an exception to. But `the-map-by-bearing-and-what-crosses-the-water.test.ts` caps the centre at half the map, and the centre is sitting exactly on that cap. Measured: centre 17, everywhere else 17. An eighteenth Jade Gorge house fails it at 18 against 17.',
    whyTheOtherProvincesDoNotWork:
        'Each contradicts the house at its own governing fact rather than at a number. The White Stair is "two institutions and nothing else" in five places and its whole politics is a two-body quarrel. The Yellow Plain\'s thesis is that no institution holds a foot of land. The Silent Cliffs has a localCeilingOrdinal of 6 and no client sects at all. The Drowned Sea has no vein within reach of anybody. The Burial Sands is at bearing `interior`, which the compass test excludes by construction.',
    whatWouldUnblockIt:
        'One sentence from the design owner, and there are three shapes it could take: move an existing body out of the Jade Gorge\'s seating and let the Court take the seat; rule that the centre cap counts something other than raw house count; or rule that this one house may be named something other than a Court, which means re-opening whether a closed door has to sit on a power.',
    whatMustNotBeDoneInstead:
        'Widening the compass guard. It is a structural claim about the shape of the world rather than a threshold on a noisy measurement, and AGENTS.md names the sentence that precedes this mistake: "it is only just under, and my change is obviously fine."'
} as const;

/**
 * Whom this house will admit, or null where it admits anybody.
 */
export function whoAHouseWillTake(factionId: string): Sex | null {
    return A_HOUSE_THAT_TAKES_ONE_SEX[factionId] ?? null;
}

/**
 * Whether this house's door is shut to this person, and the sentence saying so.
 */
export function theDoorIsShutTo(factionId: string, sex: Sex): string | null {
    const takes = whoAHouseWillTake(factionId);
    if (takes === null || takes === sex) return null;
    const name = SECT_BY_ID.get(factionId)?.name ?? factionId;
    return `${name} takes only ${takes === 'female' ? 'women' : 'men'}, and has for as long `
        + 'as anybody can name. It is not a bar you can climb to and it is not one a word '
        + 'from anybody opens - there is no version of this where you are admitted. Whatever '
        + 'you wanted from them, another house is where you will have to want it from.';
}

/**
 * The floor for being taken in without being taken on, where the house
 * declares one. Null where it does not; undefined for an unknown faction.
 */
export function guestFloorOf(factionId: string): number | null | undefined {
    const floors = houseFloorsOf(factionId);
    return floors ? floors.guest : undefined;
}
