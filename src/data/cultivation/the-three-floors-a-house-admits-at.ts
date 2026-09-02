/**
 * The three floors a house admits at - guest, servant, disciple.
 *
 * A house does not have one door, and until this file existed the catalog
 * carried one number for all three. The design owner's sentence is the whole
 * of it:
 *
 *   "even servants have ordinals. an apex house would not take in a Qi
 *    Condensation servant when I'm sure they have Core Formation perfectly
 *    willing to be a servant to use their qi."
 *
 * So a servant bar is not zero, and at a strong house it is high. Serving an
 * apex buys access to its ground and its qi, which is worth more than rank at
 * a lesser house, so the queue for a servant's place at the top is full of
 * people who would be disciples somewhere else.
 *
 * WHY A SERVANT'S BAR CAN STAND ABOVE A DISCIPLE'S
 * -----------------------------------------------
 * This reads backwards for about ten seconds and then is obvious. A disciple
 * is admitted for what they might become; the house is buying a future and
 * will spend years, medicine and a teacher's hours making it. A servant is
 * hired for what they can already do - carrying, standing a watch, holding a
 * node, keeping a yard - and the house is buying the qi in the room today. A
 * child at Qi Condensation is a promising disciple and a useless servant, and
 * a Core Formation cultivator willing to sweep an apex's floors for the air
 * is a bargain the house takes every time. Nothing is taught to a servant, so
 * nothing about a servant's bar is priced off the shelf.
 *
 * THE THREE FLOORS
 * ----------------
 *   guest     `SECT_ADMISSION.guestFromOrdinal`, where a house declares one.
 *             Taken in without being taken on: probationers, guest students,
 *             applicants. The Azure Cloud Pavilion's is at ordinal 0 and that
 *             is the real front door of the world's one open apex.
 *   servant   Derived here. What it costs to be taken ON at all - the menial
 *             tier, rank index 0 at the houses that have one.
 *   disciple  `Sect.admissionOrdinal`, untouched. What it costs to stand on
 *             the disciple track, rank index 1 and upward. `rankRealmBand`
 *             derives every band in the catalog from this number, so it must
 *             stay exactly where it is - see the PROBATION FLOOR note in
 *             `governance-and-water-rights.ts`.
 *
 * WHAT 69ed216 GOT RIGHT, WHAT IT GOT WRONG, AND WHAT IT DID NOT DO AT ALL
 * ------------------------------------------------------------------------
 * It was right that the disciple bar must not govern servants. It was wrong
 * that servants therefore have no bar at all, and it floored rank 0 at ordinal
 * 0 to say so.
 *
 * And that floor never moved a single band, which is worth writing down
 * because the commit reads as a behaviour change and is not one. In
 * `rankRealmBand` the floor is one arm of
 * `max(floor, round(admission + span * max(0, t - LAG)))`, and at rank 0
 * `t` is 0, so the second arm is already exactly `admission`. Measured across
 * all 34 houses, floor-at-0 and floor-at-admission give identical rank-0 bands
 * at every one of them. What the commit actually changed was the GUARD: the
 * catalog test that had checked every member against their house's bar was
 * narrowed to `rankIndex > 0`, and rank 0 stopped being checked from below by
 * anything.
 *
 * So the defect this file repairs is a naming and a guard rather than a
 * number: rank 0's floor had no name of its own, no reason of its own, and
 * after that commit nothing asserting it. That matters because
 * `rankRealmBand(...).minOrdinal` is a live player-facing bar -
 * `sect-leadership.ts` and `promotion-inside-a-house.ts` both read it as the
 * rung a person must clear - so an unguarded floor there is the door of every
 * house in the world with nothing standing in it.
 *
 * The reasoning that commit recorded about WHICH houses have a menial tier is
 * kept, and is now derived rather than counted: see `hasMenialTier` below.
 *
 * WHAT THE MEASUREMENT SAID, AND IT IS NOT WHAT THE DESIGN WANTED
 * --------------------------------------------------------------
 * Measured over the whole catalog, every one of the 40 authored rank-0 members
 * stands at or a little above their own house's `admissionOrdinal` - the
 * deltas run 0 to 4 and there is not a single exception. So the roster was
 * authored on the convention that rank 0 sits at the membership bar, and the
 * catalog says so in its own words: the Azure Cloud Pavilion's comment on
 * `admissionOrdinal: 3` calls it "the membership bar, and it is not the door",
 * while `AZURE_CLOUD_INTAKE.theRank` puts the Probationer BELOW the Sword
 * Servant, "which is rank index 0 and the lowest actual rank of the sect".
 *
 * That is a third reading of `admissionOrdinal` - membership, which includes
 * servants - and it disagrees with the brief this file was written to, which
 * calls it the disciple bar. Both readings are written down in the repo. The
 * disagreement is reported rather than resolved, and this file works with the
 * brief's reading because that is the one that leaves `admissionOrdinal` where
 * every band already depends on it.
 *
 * The practical consequence is the honest part. Any servant bar derived from
 * how strong a house is, at the strength the owner's example implies - an
 * apex's servants at Core Formation, ordinal 17 - falls below 32 of the 40
 * authored rank-0 members. Measured, with the lift taken off what a house's
 * ground reaches:
 *
 *   lift = reach - 25   0 members fall below their house's bar   (this file)
 *   lift = reach - 22   8 members fall below
 *   lift = reach - 17  26 members fall below
 *   lift = reach -  9  40 members fall below, i.e. all of them
 *
 * So the constant below is pinned by the roster, not chosen: it is the
 * strongest lift the authored catalog carries with nobody seated illegally.
 * Going further is a re-authoring of the rank-0 population, not a tuning
 * change, and it is a decision for the design owner rather than for this file.
 *
 * AND THE REASON AN APEX CAN RUN AN OPEN DOOR ANYWAY
 * -------------------------------------------------
 * The Azure Cloud Pavilion takes uncultivated mortals off the road and is
 * still not staffed by them, because the door and the destination are
 * different places: it has somewhere to send them. `sect-azure-mist-court`
 * holds from the Pavilion and `sect-azure-dew-sect` one remove further, and a
 * house with a feeder beneath it can take somebody in below its own servant
 * bar because it does not keep them. That is a general rule about grant
 * chains and not a fact about one faction - `getSubsidiariesOf` and
 * `chainToApex` already express the chain.
 *
 * It is NOT wired into the floor, deliberately, and the reason is worth
 * stating so nobody wires it by reflex: at the calibration above, no house
 * that has a subsidiary gets a lift at all, so a chain relief would change no
 * house's floor and would be a rule with no consumer. If the constant is ever
 * pulled down, this is the first thing that has to become code.
 */

import { REALM_TIERS } from '../../engine/cultivation/realms.js';
import { FACTION_CHARACTER } from './faction-character.js';
import { SECTS, SECT_ADMISSION } from './sects.js';
import type { Sex } from '../../engine/birth/what-sex-somebody-is-and-what-it-is-for.js';

const SECT_BY_ID = new Map(SECTS.map(s => [s.id, s]));

/**
 * Slack above what a faction can reliably produce. One realm, roughly.
 *
 * Moved here from `members.ts` so that `groundReachOf` is the single statement
 * of how far a house's ground and shelf carry somebody, read by both the band
 * derivation and the servant bar.
 */
export const ABOVE_PRODUCTION = 8;

/**
 * How far below what a house's ground reaches its servants may stand.
 *
 * PINNED BY MEASUREMENT, NOT CHOSEN. 25 is the largest lift the authored
 * rank-0 roster carries with no member seated below their own house's bar; at
 * 24 three members fall (`member-xi-linzhao` at Lantern Hall,
 * `member-han-shuqing` at the Severed, `member-tang-lingyun` at the Crimson
 * Abyss Hall), and it degrades fast from there. See the header for the table.
 *
 * At this value the lift binds on exactly three houses - the ones whose ground
 * reaches far past what their door asks - and every other house's servant bar
 * is its membership bar. That is a small effect and it is the true one.
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
     *
     * Derived, not listed. A house whose door already stands at the rung where
     * sects stop recruiting and start negotiating has nobody who would sweep
     * its yards - there is no such person to be had at that height, and the
     * house is not offering. Two houses in the catalog are like this and both
     * confirm it in their own rank names: the Hollow Court's rank 0 is Outer
     * Disciple and the Kiln Wardens' is Warden. Every other house's rank 0 is
     * a servant, a hand, a boy, an applicant or a guest.
     */
    hasMenialTier: boolean;
}

/**
 * How far this house's ground and shelf carry somebody it took in.
 *
 * The lower of what its strongest member reached and what it can reliably
 * produce plus one realm of slack. `powerOrdinal` alone is the wrong number -
 * it is the one person a house did not make, and reading it as the ground is
 * how the Sweptground Temple, whose reliable production is Foundation
 * Establishment, comes out looking like the equal of an apex.
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
 * The floor for being taken on at the menial tier, or the disciple bar where
 * the house has no menial tier.
 *
 * This is what `rankRealmBand` floors rank 0 at, and therefore the rung a
 * person has to clear to be taken on as a servant of this house.
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
 *
 *   > "this means we can have female only and male only sects, do IT, this
 *   >  makes playthroughs gated and interesting."
 *
 * The number stays tiny, and that is the design rather than a starting point.
 * The interesting thing about a closed door is that it is closed to YOU, and a
 * world where a third of the houses were closed to everybody would make that
 * ordinary. One or two means a run either meets one of them or does not.
 *
 * **And they are Courts, which is the ruling rather than a preference: a gate is
 * only interesting if what is behind it is worth wanting.** A minor house
 * refusing half of everybody costs those players nothing - they walk past it and
 * the run is identical. What is behind this one is the world's only working
 * lightning curriculum.
 *
 * ── WHY IT IS A BAR AND NOT A NEW MECHANISM ─────────────────────────────
 *
 * It sits beside `servant`, `disciple` and `guest` because it is the same kind
 * of fact: a condition the house states, checked at the door, refused with the
 * reason named. Everything that already asks a house whether it would take
 * somebody asks this in the same breath, and a house that has no entry here
 * takes anybody - which is thirty-three of thirty-five.
 *
 * ── IT GOVERNS ADMISSION AND NOTHING ELSE ───────────────────────────────
 *
 * Not who may marry whom - the household layer neither imports this nor names
 * the field, and a scan of that directory would fail if it did. Not who may be
 * on a roll: **a bar governs admission from outside, and being on a roll from
 * birth or from a word spent is a different relationship to the house.** Not
 * what anybody is worth, is capable of, or may be taught. A closed house is a
 * door, and the rest of the world is on the other side of it.
 *
 * ── THE COURTS THAT MUST NOT CARRY IT ───────────────────────────────────
 *
 * The **Azure Mist Court**'s bar is zero by design with a test asserting it, and
 * the **Hollow Court** is the catalog's exception in every direction - it admits
 * at 29, has no children of its own and sends them out on a word - so a rule
 * hung on it generalises wrongly to everything else. The **Tally Court** is not
 * a house at all: it lives in `DESTROYED_DAO_HOUSES`, dissolved two thousand
 * three hundred years ago, and admits nobody.
 *
 * ── AND WHAT IS STILL MISSING ───────────────────────────────────────────
 *
 * A second Court, taking the other sex, which the design owner asked for as a
 * NEW house built around flowers. It is not here, and the honest reason is that
 * a house in this catalog is seven files rather than one - its own entry, a
 * character entry, a history entry, standing with the others, a parent in the
 * grant chain, a roll, and ground - each with its own guard. **A half-built
 * house is worse than none**, so this table has one row until that one is
 * written properly.
 */
export const A_HOUSE_THAT_TAKES_ONE_SEX: Readonly<Record<string, Sex>> = Object.freeze({
    /**
     * A Court whose ladder ends in one title held by one person, and whose
     * whole measure of standing is who it has taken and kept.
     *
     * `faction-character.ts` gives its unit of value as **collections** -
     * "standing is measured in cultivators the Court has taken and kept, and
     * refusal is treated as a scheduling matter rather than an answer" - and
     * its ranks run Rod Bearer, Storm Servant, Arc Disciple, Thunder Warden,
     * Storm Elder, Storm Tyrant. Every rung of that is named for the rod and
     * the last one is a person. A house that collects what it intends to hand
     * the rod to has an opinion about who stands under it, and this is that
     * opinion: it takes what it can use and it has never wanted anybody else at
     * the rod.
     *
     * It is also a Court, which is the ruling: a gate is only interesting if
     * what is behind it is worth wanting, and what is behind this one is the
     * world's only working lightning curriculum.
     */
    'sect-storm-tyrant-court': 'male'
});

/**
 * Whom this house will admit, or null where it admits anybody.
 *
 * Undefined is not returned: a faction the catalog has never heard of is not a
 * house with a closed door, it is a house nothing is known about, and the
 * honest answer to "would it turn me away for this" is no.
 */
export function whoAHouseWillTake(factionId: string): Sex | null {
    return A_HOUSE_THAT_TAKES_ONE_SEX[factionId] ?? null;
}

/**
 * Whether this house's door is shut to this person, and the sentence saying so.
 *
 * Returns null when it is not - which is almost always - so a caller writes
 * `const shut = theDoorIsShutTo(...)` and has both the answer and the refusal
 * in one. A refusal names a route, and the route here is the only honest one:
 * there is not one, and the other houses are.
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
