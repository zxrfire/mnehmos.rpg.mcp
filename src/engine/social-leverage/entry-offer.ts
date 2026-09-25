/**
 * Where a house seats somebody joining it, and whether it opens the door at all.
 *
 * THE DESIGN OWNER, ON EVERY HOUSE ALIKE: *"same lore. join as outer disciple
 * or external elder. if you're overqualified you promote FAST cuz you can take
 * merit missions and do them easily."* So there are two seats and no third:
 *
 *   the bottom rung   where everybody from outside starts, whatever they stand
 *                     at. `ARRIVAL_RULES` in the catalog says it of the apexes
 *                     and it is true of every house: rank, reputation,
 *                     contribution and titles do not travel.
 *   an elder's seat   the external-elder door, for somebody standing at the
 *                     bar an insider is held to at the house's lowest elder
 *                     rung (`whatAnInsiderMustStandAt`). The owner: *"it ought
 *                     to be the same bar as internal elder, just external."*
 *                     The world's own houses take elders in by the same bar
 *                     (`a-house-takes-in-an-elder-from-outside.ts`). And
 *                     somebody who clears it may still ask for the bottom.
 *
 * This used to seat a newcomer one rung under the house's own people at their
 * height, and a renowned one level with or above them. That was the owner's
 * earlier reading, and it is the one this replaces: nobody is seated by their
 * standing now. What standing buys an overqualified newcomer is speed - the
 * board prices a duty by the strength of whoever takes it, not by their rung
 * (`commissionBoard` in `encounters/duties.ts`), and every rung above is bought
 * with contribution the same way a disciple raised inside buys it.
 *
 * How badly the house wants them still decides one thing: whether the door
 * opens. The owner: *"it might also give a closed door, depends how badly they
 * want you"*.
 */

import { ARRIVAL_RULES } from '../../data/cultivation/governance-and-water-rights.js';
import { getSect } from '../../data/cultivation/sects.js';
import { elderRungOf } from '../cultivation/leadership.js';
import { whatAnInsiderMustStandAt } from '../world/promotion-inside-a-house.js';
import type { Standing } from '../social/what-is-said-about-somebody.js';

/**
 * Which door, or none. `closed_door` covers both NOT wanting somebody and BARELY
 * wanting them: a house does not carry a stranger it is lukewarm about.
 */
export type OfferBand = 'closed_door' | 'outer_disciple' | 'external_elder';

export interface EntryOffer {
    band: OfferBand;
    /** The rung they would be seated at. Null only for a closed door. */
    offered: number | null;
    /**
     * The house's lowest elder rung, where it seats an elder from outside. Null
     * where the ladder has no elder rung below its head.
     */
    elderRung: number | null;
    /** The ordinal an elder from outside must stand at. Null with `elderRung`. */
    elderBar: number | null;
    /** The council's reading, echoed so a caller can say why. */
    leaning: number | null;
    /** One factual line for the mechanical channel. Never narration. */
    line: string;
}

/** What one decider has heard about the asker, off `whatIsSaidAbout`. */
export interface WhatADeciderHasHeard {
    deciderId: string;
    /** How many tellings naming the asker reached them. Zero is the common case. */
    heard: number;
    /** What those tellings add up to. Speech only, never checked against fact. */
    saidToBe: Standing;
}

/**
 * How well a name has travelled, as the `readingOf` term the council takes.
 */
export function renownReading(
    heardBy: readonly WhatADeciderHasHeard[]
): (personId: string) => number {
    const byId = new Map(heardBy.map(h => [h.deciderId, h]));
    return (personId: string): number => {
        const h = byId.get(personId);
        if (!h || h.heard === 0) return 0;
        return h.saidToBe === 'well spoken of' ? 1
            : h.saidToBe === 'ill spoken of' ? -1
                : 0;
    };
}

/**
 * At or below this leaning the door stays shut. NOT SYMMETRIC with anything:
 * a mild dislike shuts it, and no warmth opens a seat the height does not.
 */
const A_CLOSED_DOOR_AT = -0.15;

/**
 * What this house would seat this cultivator at, if they asked today. `leaning`
 * is optional: with none supplied the door is open.
 */
export function entryOfferFor(input: {
    /** The house's own rank ladder. Its last entry is the head. */
    ranks: readonly string[];
    askerOrdinal: number;
    /** `WhereTheBodyLands.leaning`, when the caller has read the council. */
    leaning?: number | null;
    /**
     * The ordinal an elder from outside must stand at, for the house's lowest
     * elder rung. Omitted or null, the house has no elder's door.
     */
    elderBar?: number | null;
    /** They asked to come in at the bottom rung, whatever they clear. */
    atTheBottom?: boolean;
}): EntryOffer {
    const rankCount = input.ranks.length;
    const leaning = input.leaning ?? null;
    const bottom = ARRIVAL_RULES.entryRankIndex;
    // An elder's seat below the head, or none: a house whose ladder is too short
    // to have one seats everybody at the bottom.
    const rung = rankCount > 0 ? Math.min(elderRungOf(rankCount), rankCount - 1) : 0;
    const hasElderDoor = rung > bottom && rung < rankCount - 1
        && input.elderBar !== undefined && input.elderBar !== null;
    const elderRung = hasElderDoor ? rung : null;
    const elderBar = hasElderDoor ? input.elderBar! : null;

    const shut = leaning !== null && leaning <= A_CLOSED_DOOR_AT;
    const clearsTheElderBar = elderBar !== null && input.askerOrdinal >= elderBar;
    const asElder = !shut && clearsTheElderBar && input.atTheBottom !== true;
    const band: OfferBand = shut ? 'closed_door' : asElder ? 'external_elder' : 'outer_disciple';
    const offered = shut ? null : asElder ? elderRung! : bottom;

    const title = (index: number): string => input.ranks[index] ?? '?';
    const theElderDoor = elderRung === null
        ? 'The ladder has no elder rung below its head, so there is no elder\'s door.'
        : `An elder from outside is taken in as ${title(elderRung)} (${elderRung}) from ordinal `
          + `${elderBar}, and they stand at ${input.askerOrdinal}.`;
    const seat = asElder
        ? `They stand at ordinal ${input.askerOrdinal}, past the ${elderBar} the house asks of an `
          + `elder from outside, so it takes them in as ${title(elderRung!)} (${elderRung}), its `
          + 'lowest elder rung, with no merit in it.'
        : 'Nobody from outside is seated by what they stand at: the door opens at '
          + `${title(bottom)} (${bottom}), the bottom rung, and every rung above is bought with `
          + `merit off the house's board. ${clearsTheElderBar
              ? `They clear the elder's bar at ${elderBar} and asked for the bottom rung instead.`
              : theElderDoor}`;

    return {
        band,
        offered,
        elderRung,
        elderBar,
        leaning,
        line: shut
            ? `The body reads them at ${leaning!.toFixed(2)}, which is ${band}, and the door does not open.`
            : `${seat} ${leaning === null
                ? 'No council was read, so the door is open.'
                : `The body reads them at ${leaning.toFixed(2)}, and the door is open.`}`
    };
}

/**
 * What this house would seat this cultivator at, off the catalog. THE ONLY
 * THING IN THIS FILE THAT READS A CATALOG.
 */
export function offerAtTheDoorOf(
    factionId: string,
    askerOrdinal: number,
    leaning?: number | null,
    atTheBottom = false
): EntryOffer | null {
    const sect = getSect(factionId);
    if (!sect) return null;
    const rankCount = sect.ranks.length;
    const rung = Math.min(elderRungOf(rankCount), rankCount - 1);
    return entryOfferFor({
        ranks: sect.ranks,
        askerOrdinal,
        leaning,
        atTheBottom,
        elderBar: whatAnInsiderMustStandAt(
            factionId, rung, rankCount, sect.admissionOrdinal, sect.powerOrdinal)
    });
}
