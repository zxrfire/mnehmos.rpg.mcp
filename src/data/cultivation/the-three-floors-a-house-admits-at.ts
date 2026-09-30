/**
 * The three floors a house admits at - guest, servant, disciple.
 */

import { REALM_TIERS } from '../../engine/cultivation/realms.js';
import { FACTION_CHARACTER } from './faction-character.js';
import { APEX_INSTITUTIONS } from './governance-and-water-rights.js';
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
 * Houses whose rank 0 is a CLASS rather than a floor.
 *
 * The reach below prices a house's rungs off what it reliably produces, which
 * assumes the ladder is climbed by the people it produces. Two houses say on
 * their own rank rows that theirs is not: everyone from a village intake to a
 * Deity Transformation elder brought in from a subsidiary is Unplaced, and
 * everyone on a face at any realm is a Hand. Pricing rung 0 off their top-end
 * production puts the bottom of the Survey above Core Formation and strands the
 * roll this catalog actually authored - a sixty-year Second Mark, a Sluice-Sworn
 * who carries renewals, a Hand of ninety years - below the floor of their own
 * rank.
 *
 * Derived rather than listed: both declare that realm stops deciding rank below
 * a rung their own pipeline has already passed, which is the fact. The Azure
 * Cloud Pavilion declares the same thing about a rung its pipeline is nowhere
 * near, so its bands are still read off what it turns out, as they should be.
 *
 * This held for free while neither house had a character record under its sect
 * id. Both have one now.
 */
function rankIsAClassRatherThanAFloor(factionId: string): boolean {
    const production = FACTION_CHARACTER[factionId]?.production.reliableOrdinal;
    if (production === undefined) return false;
    return APEX_INSTITUTIONS.some(
        apex => apex.factionId === factionId && apex.ranksByRealmAboveOrdinal < production
    );
}

/**
 * How far this house's ground and shelf carry somebody it took in.
 */
export function groundReachOf(factionId: string): number | undefined {
    const sect = SECT_BY_ID.get(factionId);
    if (!sect) return undefined;
    const admission = sect.admissionOrdinal;
    const production = rankIsAClassRatherThanAFloor(factionId)
        ? admission
        : FACTION_CHARACTER[factionId]?.production.reliableOrdinal ?? admission;
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
