/**
 * WHO GOES DOWN WITH THE HOUSE.
 *
 * The design owner: a minority stay, fight and die with a house that is
 * finished, rather than scatter. The world already decides who scatters -
 * `releaseTheRoll` sends a fallen house's people to the next house or onto the
 * road, and `whetherTheyFall` decides who gets out when somebody comes for the
 * compound - and in both of those every single person was trying to leave.
 *
 * A DISPOSITION AND NOT A ROLL AT THE MOMENT. It is who somebody is, so it is
 * read the way the world reads who somebody is: deterministically off their own
 * id, with the house they serve in the stream, so the same person answers the
 * same way every time the question is asked and two houses do not get the same
 * answer from one person.
 *
 * ── WHERE IT IS MORE COMMON, AND WHY ─────────────────────────────────────
 *
 * A FAMILY HOUSE. A clan's roll is its blood: leaving is not joining somebody
 * else's hall, it is leaving your own people, and there is nowhere else for that
 * name to be. Twice as common.
 *
 * A RIGHTEOUS ONE. What a righteous house asks of its people is stated and the
 * people who stayed for it are the ones who believed it; a demonic house has
 * never asked anybody to die for it and does not pretend to. Half again for the
 * first, and less than the base for the last, which is the alignment axis the
 * rest of the engine already reads.
 *
 * AND IT STAYS A MINORITY. {@link MOST_PEOPLE_SCATTER} is the ceiling nobody
 * crosses: the interesting fact about the ones who stay is that they are few.
 */

import { forStream } from '../cultivation/rng.js';
import type { NpcRecord } from './npc-state.js';
import type { FactionRecord } from './world-state.js';

/** The tag on somebody who stayed with a house that ended. Followed by the house id. */
export const STAYED_WITH = 'stayed-with:';

/** How many of an ordinary house's people would not walk away from it. */
export const WOULD_NOT_WALK_AWAY = 0.08;

/** A house that is a family, where the roll and the blood are one thing. */
export const A_FAMILY_HOUSE_HOLDS = 2;

/** A house whose people were asked to believe something. */
export const A_RIGHTEOUS_HOUSE_HOLDS = 1.5;

/** A house that never asked. */
export const A_DEMONIC_HOUSE_HOLDS = 0.5;

/** Nobody crosses this: the ones who stay are a minority, always. */
export const MOST_PEOPLE_SCATTER = 0.25;

/** The kinds of house whose roll is a family. */
const A_FAMILY: ReadonlySet<string> = new Set(['clan', 'family', 'bloodline']);

/** What share of this house's people would go down with it. */
export function howManyWouldStay(house: Pick<FactionRecord, 'kind' | 'alignment' | 'tags'>): number {
    const family = A_FAMILY.has(house.kind) || house.tags.includes('bloodline');
    const share = WOULD_NOT_WALK_AWAY
        * (family ? A_FAMILY_HOUSE_HOLDS : 1)
        * (house.alignment === 'righteous' ? A_RIGHTEOUS_HOUSE_HOLDS
            : house.alignment === 'demonic' ? A_DEMONIC_HOUSE_HOLDS : 1);
    return Math.min(MOST_PEOPLE_SCATTER, share);
}

/**
 * Whether this person stays with this house when it ends.
 *
 * Asked at the moment the house ends and answered off who they are, so the same
 * person gives the same answer whether the house was destroyed or dissolved.
 */
export function wouldGoDownWithTheHouse(
    seed: string,
    npc: Pick<NpcRecord, 'id'>,
    house: Pick<FactionRecord, 'id' | 'kind' | 'alignment' | 'tags'>
): boolean {
    return forStream(seed, 'goes-down-with-the-house', npc.id, house.id)
        .chance(howManyWouldStay(house));
}
