/**
 * The board is what the house needs doing, not a list somebody wrote out.
 *
 * The design owner: *"missions, they need to rank up to inner by completing
 * missions that gives rewards. autogenerate them."*
 *
 * MEASURED FIRST, through the board's own API. `commissionBoard` reads the
 * hand-authored `COMMISSION_ENTRIES` and filters them by ordinal window, and
 * what that leaves a player is:
 *
 *     ordinal  0  Qi Condensation            1 offer
 *     ordinal 12  Qi Condensation            3 offers
 *     ordinal 13  Foundation Establishment   2 offers
 *     ordinal 16  Foundation Establishment   1 offer
 *     ordinal 17  Core Formation             NOTHING
 *     ... and nothing at every rung above it, to Immortal.
 *
 * So two thirds of the ladder has no work on it at all, and the bottom rung -
 * where a new player stands - has exactly one thing to do, worth 10
 * contribution against the 100 that buys the first promotion. The loop the
 * design owner asked for cannot turn.
 *
 * AND THE GENERATOR ALREADY EXISTED. A house in this world already decides to
 * put people on the road: `reasonsOpenTo` gives the reasons THAT house has
 * right now, each gated on a predicate about its actual state - it holds
 * ground, it has a rival, somebody found something, it has a subsidiary that
 * owes it. `postingFor` pitches one of those at a rung. That is a mission. All
 * that was missing was offering one to the player instead of to an NPC.
 *
 * Which is why nothing here invents content. A posted duty is the house's own
 * sending with somebody else's name on it, and a house with no rival posts no
 * work against a rival.
 *
 * ONE PRICING RULE. These go back through `dutyTermsFor` exactly like a
 * catalogue row - contribution, stones, term, refusal and cohort all come out
 * of the same arithmetic. A second pricing path here would be a second opinion
 * about what work is worth.
 */

import type { EncounterEntry } from '../../data/cultivation/encounters.js';
import {
    SENDING_REASONS,
    type AtStake,
    type SendingReason
} from '../../data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import {
    reasonsOpenTo,
    type HouseAsItStands
} from '../world/who-goes-out-for-a-house-and-what-comes-back.js';
import { clampOrdinal } from '../cultivation/realms.js';

/**
 * How far above and below its pitch a posting is still worth offering.
 *
 * A house does not write a separate notice for every rung. It says what needs
 * doing and the people who could plausibly do it read it, which is the band
 * either side.
 */
export const HOW_WIDE_A_NOTICE_READS = 2;

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
 * `scaleFor` and `daysFor` read these, so the reason's own `scale` is what
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
    const place = input.placeName ?? null;
    return {
        // Stable for the same house, reason and rung, so a player who reads the
        // board twice in an afternoon is looking at the same notice both times.
        id: `posted-${input.house.id}-${input.reason.id}-${pitch}`,
        name: place === null
            ? `${input.reason.name}, for ${input.house.name}`
            : `${input.reason.name} at ${place}, for ${input.house.name}`,
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
        tags: tagsFor(input.reason)
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
    /** Where each reason would send them, when the world knows. */
    placeFor?: (reason: SendingReason) => string | null;
}): EncounterEntry[] {
    const out: EncounterEntry[] = [];
    for (const reason of reasonsOpenTo(input.house)) {
        out.push(aPostingAsAnOffer({
            reason,
            house: { id: input.house.id, name: input.house.name },
            pitchOrdinal: input.ordinal,
            placeName: input.placeFor?.(reason) ?? null
        }));
    }
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
}

/**
 * Which posted duty somebody meant, off the reason rather than the title.
 *
 * A generated title reads "An escort at Autumn Gate, for Azure Cloud Pavilion"
 * and a player says "I take the escort". The board's ordinary matcher refuses
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
        const core = reason.name.toLowerCase().replace(/^(?:an?|the)\s+/, '');
        if (core.length < 6 || !said.includes(core)) continue;
        for (const offer of offers) {
            if (offer.id.startsWith(`posted-`) && offer.id.includes(reason.id)) hits.push(offer);
        }
    }
    if (hits.length !== 1) return null;
    return hits[0] ?? null;
}
