/**
 * Who a world opens with a storage ring on their hand.
 *
 * Rings are not sold at a counter: they are bartered for, looted, given by a house, or folded by
 * somebody who can fold space. Looting and barter need people who hold one, and before this no
 * seeded person did. `a-storage-ring.ts` is the ring; this decides who has one on day zero.
 *
 * ── THE THRESHOLD IS THE CATALOG'S PRICE, AGAINST THE CATALOG'S EARNINGS ──
 *
 * Nothing states a rarity, so none is picked. Two things are stated:
 *
 *   what a ring costs     `whatARingCosts`: 30,000 stones for the smallest, because it is
 *                         heaven-grade ore worked by a Void Tribulation hand
 *   what a life puts by   `netEarningsPerYear` at their rung, over the years since they were of
 *                         age, on top of what they hold now
 *
 * Somebody holds a ring where what they could have put by covers one, and they hold the best
 * grade it covers. Somebody who can fold one themselves (`couldFoldARing`) holds at least the
 * smallest, made with their own hand. Measured on two seeded worlds: no Qi Condensation cultivator
 * can put by 30,000 in a life at that rung, about one Foundation cultivator in thirty has, about
 * four Core Formation in five have, and everybody from Nascent Soul up. Earning at their present
 * rung for every year of age overstates what somebody who crossed recently has put by; it is the
 * upper bound, stated as that.
 *
 * NO DRAW. Realm, age and purse decide it, so a ring on a hand changes no other stream.
 */

import { netEarningsPerYear } from '../cultivation/origin.js';
import type { TechniqueGrade } from '../../schema/cultivation.js';
import { aStorageRing } from './a-storage-ring.js';
import { couldFoldARing, whatARingCosts, whoCanFoldARing } from './what-a-body-can-carry-and-what-a-ring-holds.js';
import { WORN_TAG, type ObjectRecord } from './possessions.js';
import type { NpcRecord } from './npc-state.js';
import type { WorldState } from './world-state.js';

/** The age somebody starts putting anything by: the youngest the seeder stands anybody up at. */
const OF_AGE = 16;

/** The ring grades a hand below the Lid could come by, smallest first. */
const GRADES_BELOW_THE_LID: readonly TechniqueGrade[] = ['mortal', 'earth', 'heaven'];

/** What somebody could have put by in their life, at their present rung. */
function whatALifePutBy(npc: Pick<NpcRecord, 'spiritStones' | 'cultivation' | 'identity'>, onDay: number): number {
    const years = Math.max(0, (onDay - npc.identity.bornOnDay) / 365 - OF_AGE);
    return Math.max(0, npc.spiritStones) + Math.max(0, netEarningsPerYear(npc.cultivation.realmOrdinal)) * years;
}

/** The grade of ring this person holds, or null for none. */
function theRingTheyWouldHold(
    npc: Pick<NpcRecord, 'spiritStones' | 'cultivation' | 'identity'>,
    onDay: number
): TechniqueGrade | null {
    const putBy = whatALifePutBy(npc, onDay);
    const affordable = GRADES_BELOW_THE_LID.filter(grade => whatARingCosts(grade) <= putBy).at(-1) ?? null;
    if (affordable !== null) return affordable;
    return couldFoldARing('mortal', npc.cultivation.realmOrdinal) ? 'mortal' : null;
}

/** A worn ring for everybody alive who holds one when the world opens. */
export function theRingsAWorldOpensWith(state: Pick<WorldState, 'npcs' | 'currentDay'>): ObjectRecord[] {
    const onDay = Math.floor(state.currentDay);
    const out: ObjectRecord[] = [];
    for (const npc of state.npcs) {
        if (npc.status !== 'alive') continue;
        const grade = theRingTheyWouldHold(npc, onDay);
        if (grade === null) continue;
        // A hand that can fold this grade made it; anybody else bartered for it.
        const folded = couldFoldARing(grade, npc.cultivation.realmOrdinal);
        const ring = aStorageRing({
            id: `ring-${npc.id}`,
            grade,
            ownerId: npc.id,
            ownerName: npc.name,
            ownerOrdinal: npc.cultivation.realmOrdinal
        });
        out.push({
            ...ring,
            // A finished thing stands at an ordinal (`possessions.ts`): a ring at the hand that folds it.
            power: whoCanFoldARing(grade),
            tags: [...ring.tags, WORN_TAG],
            provenance: [{
                onDay,
                holderId: npc.id,
                holderName: npc.name,
                how: folded ? 'crafted' : 'bought',
                source: folded ? 'their own fold' : 'bartered for',
                previousHolderId: null,
                previousHolderName: null,
                factId: null,
                note: ''
            }]
        });
    }
    return out;
}
