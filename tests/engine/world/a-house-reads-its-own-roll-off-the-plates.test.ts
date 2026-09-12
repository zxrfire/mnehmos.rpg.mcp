/**
 * A house learns from its own wall of plates, and the reading is a derivation.
 *
 * MEASURED BEFORE THIS FILE, and it is the reason it exists. Plates were being
 * CUT and never READ. `seedTreasuries` issues a plate and a token for every
 * disciple of every house that can cut one, so a fresh world holds hundreds of
 * them as objects - and `whatThePlateSays`, `whatIsLeftOfThem` and
 * `whatAHouseMakesOfSilence` had no caller anywhere in `src/`. A house could
 * lose a disciple and nothing in the engine noticed, which is precisely the
 * fact `docs/world/houses/trust.md` says a house cannot miss.
 *
 * What is asserted here is the HOUSE'S question rather than the person's: given
 * the roll, what does the hall say today. Three readings, and the middle one is
 * the content - a whole plate over somebody nobody can find is the signature
 * that sends paper out of the compound.
 *
 * AND THE HOUSE-LEVEL GATE IS THE ONE THAT MATTERS. A house with nobody at
 * Foundation cut no plates, so it reads NOTHING off its hall - not "they are
 * fine", not "they are dead". It is not told. That is the difference between a
 * house and a gathering of people, and a reading that quietly returned
 * `nothing_yet` for such a house would have erased it.
 */

import { describe, it, expect } from 'vitest';
import {
    THE_RUNG_A_HOUSE_ISSUES_AT,
    WHEN_SILENCE_BECOMES_A_CAPTIVE,
    platesAreCutAt,
    theOnesNobodyCanFind,
    whatTheHallSays,
    type OneOnTheRoll
} from '../../../src/engine/world/a-house-knows-its-own-by-a-plate-and-a-token.js';

/** A house that can cut plates: somebody on it is at the realm that does. */
const CAN_CUT = [0, 2, platesAreCutAt()];
/** A house that cannot. Everybody on it is under the rung. */
const CANNOT_CUT = [0, 2, platesAreCutAt() - 1];

function member(over: Partial<OneOnTheRoll> = {}): OneOnTheRoll {
    return {
        memberId: 'member-1',
        memberName: 'Yan Shuling',
        rankIndex: THE_RUNG_A_HOUSE_ISSUES_AT,
        holderIsAlive: true,
        daysSinceAnybodySawThem: 0,
        ...over
    };
}

describe('a house reads its own roll off the plates', () => {
    it('says nothing about somebody who was seen this morning', () => {
        const said = whatTheHallSays({ ordinalsOnTheRoll: CAN_CUT, roll: [member()] });
        expect(said).toHaveLength(1);
        expect(said[0]!.reading).toBe('nothing_yet');
    });

    it('knows the moment one of its own dies', () => {
        const said = whatTheHallSays({
            ordinalsOnTheRoll: CAN_CUT,
            roll: [member({ holderIsAlive: false, daysSinceAnybodySawThem: 0 })]
        });
        expect(said[0]!.reading).toBe('they_are_dead');
    });

    /**
     * The whole reason the plate is worth keeping. A shattered plate closes a
     * question; a whole one over somebody nobody can find opens a worse one.
     */
    it('reads a whole plate over a silence as somebody holding them', () => {
        const said = whatTheHallSays({
            ordinalsOnTheRoll: CAN_CUT,
            roll: [member({ daysSinceAnybodySawThem: WHEN_SILENCE_BECOMES_A_CAPTIVE })]
        });
        expect(said[0]!.reading).toBe('somebody_has_them');
    });

    it('is not told anything at all where it could not cut a plate', () => {
        expect(whatTheHallSays({
            ordinalsOnTheRoll: CANNOT_CUT,
            roll: [
                member({ holderIsAlive: false }),
                member({ memberId: 'member-2', daysSinceAnybodySawThem: 400 })
            ]
        })).toEqual([]);
    });

    /**
     * The rung gate is the person-level half and it is separate: a house that
     * CAN cut plates still cut none for its servants, so their silence reads as
     * nothing. Nobody comes looking for somebody nobody put on a wall.
     */
    it('holds no plate for anybody under the rung it issues at', () => {
        const said = whatTheHallSays({
            ordinalsOnTheRoll: CAN_CUT,
            roll: [member({
                rankIndex: THE_RUNG_A_HOUSE_ISSUES_AT - 1,
                daysSinceAnybodySawThem: 400
            })]
        });
        expect(said[0]!.reading).toBe('nothing_yet');
    });

    /** Derived, so it cannot drift: the same roll read twice says the same thing. */
    it('is a read and not a write', () => {
        const roll = [member({ daysSinceAnybodySawThem: 400 })];
        const once = whatTheHallSays({ ordinalsOnTheRoll: CAN_CUT, roll });
        const twice = whatTheHallSays({ ordinalsOnTheRoll: CAN_CUT, roll });
        expect(twice).toEqual(once);
        expect(roll[0]!.daysSinceAnybodySawThem).toBe(400);
    });
});

describe('who a house would put on a wall outside', () => {
    it('is the ones it knows are alive and cannot find, and nobody else', () => {
        const readings = whatTheHallSays({
            ordinalsOnTheRoll: CAN_CUT,
            roll: [
                member({ memberId: 'here', daysSinceAnybodySawThem: 0 }),
                member({ memberId: 'dead', holderIsAlive: false }),
                member({
                    memberId: 'taken',
                    memberName: 'Mo Qingzhi',
                    daysSinceAnybodySawThem: WHEN_SILENCE_BECOMES_A_CAPTIVE + 30
                })
            ]
        });

        const looking = theOnesNobodyCanFind(readings);
        expect(looking.map(row => row.memberId)).toEqual(['taken']);
        expect(looking[0]!.memberName).toBe('Mo Qingzhi');
        expect(looking[0]!.unseenForDays).toBe(WHEN_SILENCE_BECOMES_A_CAPTIVE + 30);
    });

    /**
     * A DEATH IS NOT A SEARCH. The house already knows; there is nothing to ask
     * a stranger for. Posting the dead would make the channel a funeral notice
     * board and would quietly delete the distinction the plate exists to draw.
     */
    it('never puts a death on it', () => {
        const readings = whatTheHallSays({
            ordinalsOnTheRoll: CAN_CUT,
            roll: [member({ holderIsAlive: false, daysSinceAnybodySawThem: 900 })]
        });
        expect(theOnesNobodyCanFind(readings)).toEqual([]);
    });
});
