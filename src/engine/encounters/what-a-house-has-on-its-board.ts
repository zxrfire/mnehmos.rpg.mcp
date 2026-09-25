/**
 * The board is what the house needs doing, not a list somebody wrote out.
 *
 * MEASURED FIRST, through the board's own API. `commissionBoard` reads the
 * hand-authored `COMMISSION_ENTRIES` and filters them by ordinal window:
 *
 *     ordinal  0  Qi Condensation            1 offer
 *     ordinal 12  Qi Condensation            3 offers
 *     ordinal 13  Foundation Establishment   2 offers
 *     ordinal 16  Foundation Establishment   1 offer
 *     ordinal 17  Core Formation             NOTHING
 *     ... and nothing at every rung above it, to Immortal.
 *
 * Two thirds of the ladder with nothing on it, against a first promotion that
 * costs 100 contribution.
 *
 * AND THE GENERATOR ALREADY EXISTED. `reasonsOpenTo` gives the reasons THAT
 * house has right now, each gated on a predicate about its actual state, and
 * `postingFor` pitches one at a rung. All that was missing was offering one to
 * the player instead of to an NPC. So nothing here invents content: a house
 * with no rival posts no work against a rival.
 *
 * ONE PRICING RULE. These go back through `dutyTermsFor` exactly like a
 * catalogue row. A second pricing path here would be a second opinion about
 * what work is worth.
 *
 * ── AND THE WALL HELD ONE PITCH, WHICH WAS THE READER'S OWN ──────────────
 *
 * Measured again after the delivery split landed, at ordinal 40 in a house
 * whose strongest NPC stands at 28: five postings, all pitched at 40, all
 * routed to `word_of_mouth` by {@link theTopOfTheWall}'s boundary, and so
 * FIVE REFUSALS AND NO OFFERS. The wall the disciples were reading was not in
 * the list at all, because the list was generated at the reader.
 *
 * The design owner: the board is for disciples, elders can read it, and they
 * could take from it - met with an eyebrow. Which is the standing rule that
 * NOT HAVING THE STANDING TO DO SOMETHING IS NOT THE SAME AS SEEING NOTHING,
 * arriving one rung further up than it was last applied.
 *
 * So where the caller knows what the REST of the house can reach, the wall
 * carries its own top rung as well as the reader's. Whether that is takeable
 * is the caller's question and `takeableOffAWall` answers it; what is decided
 * here is only that the notice exists to be read.
 */

import type { EncounterEntry } from '../../data/cultivation/encounters.js';
import {
    SENDING_REASONS,
    type AtStake,
    type SendingReason
} from '../../data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import {
    NEED_PREDICATES,
    reasonsOpenTo,
    type HouseAsItStands
} from '../world/who-goes-out-for-a-house-and-what-comes-back.js';
import {
    HOUSE_MISSIONS,
    MISSION_RUNGS,
    getHouseMission,
    type HouseMission,
    type MissionRung
} from '../../data/cultivation/what-a-house-posts-for-its-own.js';
import { MAX_ORDINAL, clampOrdinal, realmForOrdinal } from '../cultivation/realms.js';
import { elderRungOf } from '../cultivation/leadership.js';
import { aTaskAsPosted, postedForTag } from './how-a-task-is-worded.js';
import { daysATermRuns } from './how-long-a-duty-runs.js';
import type { RoomPurpose } from '../world/architecture.js';

/**
 * How far above and below its pitch a posting is still worth offering.
 *
 * A house does not write a separate notice for every rung. It says what needs
 * doing and the people who could plausibly do it read it, which is the band
 * either side.
 */
export const HOW_WIDE_A_NOTICE_READS = 2;

/**
 * The room a house's work is posted in, and taken in front of somebody in.
 *
 * The design owner: *"to take a mission YOU HAVE TO REPORT IT TO SOMEONE, THE
 * MISSION HALL WHICH THE MISSION ELDER IS RESPONSIBLE FOR."* A constant beside
 * the board for the same reason `THE_ROOM_COMPLAINTS_GO_TO` sits beside the
 * reporting module: the room is a fact about what this system is for, and the
 * architecture table should not have to know which of its rooms is which
 * system's front door.
 */
export const THE_ROOM_WORK_IS_POSTED_IN: RoomPurpose = 'mission_hall';

/**
 * The highest rung this house still nails up, or null where it nails up
 * nothing at all.
 *
 * `howAnAskReaches` draws the same line from the other side - a posting whose
 * readable band touches the house's ceiling is that house's top work and is
 * carried by a person - so the top of the wall is the rung just under it. One
 * boundary, read twice, rather than a second number that would drift from it.
 *
 * Null below that, which is a small house whose every errand is somebody's
 * word: there is nobody under its top for a notice to be aimed at.
 */
export function theTopOfTheWall(reach: number): number | null {
    const top = Math.floor(reach) - HOW_WIDE_A_NOTICE_READS - 1;
    return Number.isFinite(top) && top >= 0 ? clampOrdinal(top) : null;
}

/**
 * What a reason is, as the encounter layer classifies things.
 *
 * Read off `atStake`, which is the reason's own statement of what is on the
 * line. Nothing here is a new opinion about the reason - it is the same fact
 * in the vocabulary the other table uses.
 */
const WHAT_IS_AT_STAKE_MAKES_IT: Readonly<Record<AtStake, EncounterEntry['kind']>> = {
    stones: 'opportunity',
    the_ground_itself: 'sect_event',
    standing_with_a_house: 'sect_event',
    the_grant: 'sect_event',
    nothing_but_the_party: 'opportunity'
};

/**
 * And what the engine emits when one fires.
 */
const WHAT_IT_READS_AS: Readonly<Record<AtStake, EncounterEntry['simEventKind']>> = {
    stones: 'opportunity',
    the_ground_itself: 'sect_event',
    standing_with_a_house: 'sect_event',
    the_grant: 'sect_event',
    nothing_but_the_party: 'opportunity'
};

/**
 * The tags a posting carries into the pricing.
 *
 * `scaleFor` and `daysATermRuns` read these, so the reason's own `scale` is what
 * decides whether this is an errand, a season or a campaign. The reason's
 * `days` is deliberately NOT carried across: that number is how long a party
 * of the house's own is gone, and what a commission runs to is the board's
 * arithmetic, which already has an answer.
 */
function tagsFor(reason: SendingReason): string[] {
    const out: string[] = ['posted', reason.scale];
    // WHAT IS ON THE LINE, in the other table's words. Standing and a grant are
    // both somebody being owed something, which is what `obligation` means to
    // the term; going out against a rival is the risky one whatever it is for.
    if (reason.atStake === 'standing_with_a_house' || reason.atStake === 'the_grant') {
        out.push('obligation');
    }
    if (reason.needs === 'a_rival') out.push('high-risk');
    // No ceiling means the house will send anybody, at any rung, which is the
    // long open-ended errand rather than the afternoon's job.
    if (reason.ceilingOrdinal === null) out.push('quest');
    return out;
}

/**
 * One posting, as a row the board can price and offer.
 */
export function aPostingAsAnOffer(input: {
    reason: SendingReason;
    house: { id: string; name: string };
    /** The rung it is pitched at, before the reason's own ceiling. */
    pitchOrdinal: number;
    /** Where it goes, when the caller knows. Only ever used in the name. */
    placeName?: string | null;
}): EncounterEntry {
    const ceiling = input.reason.ceilingOrdinal;
    const pitch = clampOrdinal(
        ceiling === null ? input.pitchOrdinal : Math.min(input.pitchOrdinal, ceiling)
    );
    const tags = tagsFor(input.reason);
    return {
        // Stable for the same house, reason and rung, so a player who reads the
        // board twice in an afternoon is looking at the same notice both times.
        id: `posted-${input.house.id}-${input.reason.id}-${pitch}`,
        // Worded with the term the board will price it at, off the same tags.
        name: aTaskAsPosted(
            input.reason.task,
            { house: input.house.name, place: input.placeName ?? null },
            daysATermRuns(new Set(tags))
        ),
        kind: WHAT_IS_AT_STAKE_MAKES_IT[input.reason.atStake] ?? 'sect_event',
        simEventKind: WHAT_IT_READS_AS[input.reason.atStake] ?? 'sect_event',
        weight: input.reason.weight,
        minOrdinal: clampOrdinal(pitch - HOW_WIDE_A_NOTICE_READS),
        maxOrdinal: clampOrdinal(pitch + HOW_WIDE_A_NOTICE_READS),
        interrupts: false,
        // Pitched at the rung, which is what makes the board never run out: a
        // house posts the work it has for the people it has, and the person
        // reading it is one of those people.
        threatOrdinal: pitch,
        summaryTemplate: input.reason.what,
        tokens: [],
        tags: [...tags, postedForTag(input.house.name)]
    };
}

/**
 * Everything this house would put on its board for somebody standing at this
 * rung.
 *
 * The reasons come from the house's own state. A house holding no ground has
 * nothing to stand to; a house with no rival posts nothing against one. So two
 * houses in the same town have different boards, and the same house's board
 * changes when the world does.
 */
export function whatAHouseHasOnItsBoard(input: {
    house: HouseAsItStands;
    /** The rung of the person reading it. */
    ordinal: number;
    /**
     * The highest rung this house has anybody standing on.
     *
     * The design owner: *"this needs to depend on sect ofc. sects only offer
     * work they have disciples able to reach."*
     *
     * Which is the difference between a board and a wish. A house posts the
     * work it has, and the work it has is bounded by the people it could send -
     * a village temple does not put a Core Formation errand on the wall,
     * because nobody there has ever come back from one and nobody there knows
     * what it would take. Somebody standing above their own house's reach is
     * reading a board written for the house, and that is a fact about the house
     * they joined rather than a fact about them.
     *
     * Omit it for no ceiling, which is what a caller without a world knows.
     */
    reachOfTheHouse?: number;
    /**
     * The highest rung the house has anybody OTHER than the reader standing
     * on. The wall is written for those people, so this is what decides where
     * its top notice is pitched.
     *
     * It is a separate number from `reachOfTheHouse` because that one counts
     * the reader - deliberately, so an elder's own ask is not clamped ten rungs
     * beneath them - and a wall written off it would be a wall written for one
     * person. Omit it and the reader's own pitch is the whole board, which is
     * what a caller with no roll to read still knows.
     */
    reachOfTheRest?: number;
    /** Where each reason would send them, when the world knows. */
    placeFor?: (reason: SendingReason) => string | null;
}): EncounterEntry[] {
    const reach = input.reachOfTheHouse;
    const pitch = reach === undefined ? input.ordinal : Math.min(input.ordinal, reach);

    // A WALL IS A WALL: anybody standing in front of it reads all of it. The
    // top notice is added only when the reader stands ABOVE it, because below
    // that the reader's own pitch already IS the wall and a second row would
    // be the same job posted twice.
    const wall = input.reachOfTheRest === undefined
        ? null
        : theTopOfTheWall(input.reachOfTheRest);
    const pitches = wall !== null && wall < pitch ? [pitch, wall] : [pitch];

    // Keyed by id because a reason's own ceiling can clamp two pitches onto one
    // rung, and the same notice twice is what `whichPostingTheyMeant` reads as
    // a player who has not said which.
    const byId = new Map<string, EncounterEntry>();
    for (const reason of reasonsOpenTo(input.house)) {
        for (const pitchedAt of pitches) {
            // Work nobody under the reason's floor can do is not pitched under
            // it, so somebody standing below it is not offered it at all.
            if (reason.floorOrdinal !== null && pitchedAt < reason.floorOrdinal) continue;
            const offer = aPostingAsAnOffer({
                reason,
                house: { id: input.house.id, name: input.house.name },
                pitchOrdinal: pitchedAt,
                placeName: input.placeFor?.(reason) ?? null
            });
            byId.set(offer.id, offer);
        }
    }
    const out = [...byId.values()];
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
}

/**
 * The reason a posted row was made from, or null for a catalogue row.
 *
 * The id is `posted-<house>-<reason>-<pitch>` and this reads the reason back
 * out of it, which is how {@link whichPostingTheyMeant} already identifies a
 * row. What it buys a caller is the reason's own columns - above all `hands`,
 * the number of people that sending puts on the road, which is a fact about the
 * errand rather than about whoever is reading it.
 */
export function theReasonBehind(entryId: string): SendingReason | null {
    if (!entryId.startsWith('posted-')) return null;
    for (const reason of SENDING_REASONS) {
        if (entryId.includes(reason.id)) return reason;
    }
    return null;
}

/**
 * Which posted duty somebody meant, off the reason's handle rather than the title.
 *
 * A generated title reads "Escort a charge of Azure Cloud Pavilion to Autumn
 * Gate within 2 months" and a player says "I take the escort". The board's ordinary matcher refuses
 * that on purpose - `matchScore` will not let ONE WORD name a multi-word thing,
 * because "it" inside "B-it-ter" once resolved to Bitter Frost Needle - and
 * `sharesADistinctivePhrase` wants two consecutive words in common, which one
 * word cannot have.
 *
 * Both guards are right and neither is relaxed here. What is different about a
 * posted duty is that the distinctive part of its name comes from a CLOSED
 * TABLE of about seven reasons, so one word of it is not a guess. The reason is
 * matched, and the offer is found by the reason - the identification is not
 * thrown away and re-derived from the finished sentence.
 *
 * Ambiguity answers null rather than picking. Two reasons in one sentence is a
 * player who has not said which, and the board says so instead of choosing.
 */
export function whichPostingTheyMeant(
    wanted: string,
    offers: readonly EncounterEntry[]
): EncounterEntry | null {
    const said = wanted.toLowerCase();
    const hits: EncounterEntry[] = [];
    for (const reason of SENDING_REASONS) {
        if (!new RegExp(String.raw`\b${reason.said}\b`).test(said)) continue;
        for (const offer of offers) {
            if (offer.id.startsWith(`posted-`) && offer.id.includes(reason.id)) hits.push(offer);
        }
    }
    if (hits.length !== 1) return null;
    return hits[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────
// MISSIONS
// The standing work a house sends its own on, at the rate it pays. Beside the
// reasons rather than among them: a reason is a sending the world itself makes,
// and a mission is posted for the house's own people to be sent on.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Which band of a house's ladder a rung stands in. Off the ladder the roll
 * uses: the elder band starts at `elderRungOf`, and the disciple rungs under it
 * are counted down from there - core just under the elders where the ladder has
 * four disciple rungs, then inner, and outer for the rest, a servant rung
 * included.
 */
function theBandOfARung(rankIndex: number, rankCount: number): MissionRung {
    const elders = elderRungOf(rankCount);
    if (rankIndex >= elders) return 'elder';
    const hasACoreRung = elders >= 4;
    const under = elders - rankIndex;
    if (hasACoreRung && under === 1) return 'core';
    if (under === (hasACoreRung ? 2 : 1)) return 'inner';
    return 'outer';
}

/** The lowest rung of a band on this ladder, or null where the ladder has none. */
export function theFirstRungOf(band: MissionRung, rankCount: number): number | null {
    for (let rung = 0; rung < rankCount; rung++) {
        if (theBandOfARung(rung, rankCount) === band) return rung;
    }
    return null;
}

/** Whether somebody on this rung may take a mission posted to that band: their own or below. */
export function aRungMayTake(rankIndex: number, rankCount: number, band: MissionRung): boolean {
    return MISSION_RUNGS.indexOf(theBandOfARung(rankIndex, rankCount)) >= MISSION_RUNGS.indexOf(band);
}

/**
 * The missions this house posts: those it has the need for, read by the same
 * predicates its reasons are, and pitched no higher than somebody on its roll
 * stands. Which rung of its ladder each is posted to is read where the board
 * is read.
 */
export function theMissionsAHousePosts(house: HouseAsItStands, reachOfTheHouse: number): HouseMission[] {
    return HOUSE_MISSIONS.filter(mission =>
        mission.minOrdinal <= reachOfTheHouse && NEED_PREDICATES[mission.needs](house));
}

/**
 * A mission as a line on the house's board, worded as the task: the house, the
 * place where the caller knows it, and the term.
 */
export function aMissionAsAnOffer(
    mission: HouseMission,
    house: { id: string; name: string },
    placeName: string | null = null
): EncounterEntry {
    return {
        id: `${mission.id}@${house.id}`,
        name: aTaskAsPosted(mission.task, {
            house: house.name,
            place: placeName,
            realm: mission.realmCrossedInto === undefined ? null : realmForOrdinal(mission.realmCrossedInto).name
        }, mission.days),
        kind: 'sect_event',
        simEventKind: 'sect_event',
        weight: 1,
        minOrdinal: 0,
        maxOrdinal: MAX_ORDINAL,
        interrupts: false,
        threatOrdinal: clampOrdinal(mission.minOrdinal),
        summaryTemplate: mission.note,
        tokens: [],
        tags: ['mission', postedForTag(house.name)]
    };
}

/** The mission a board line was made from, or null. */
export function theMissionBehind(entryId: string): HouseMission | null {
    const at = entryId.indexOf('@');
    return at < 0 ? null : getHouseMission(entryId.slice(0, at)) ?? null;
}

/**
 * Whether a board line is a mission held as a post rather than spent in one act: anything above
 * the outer rung. See `web/holding-a-mission-post.ts`.
 */
export function isHeldAsAPost(entryId: string): boolean {
    const mission = theMissionBehind(entryId);
    return mission !== null && mission.rung !== 'outer';
}
