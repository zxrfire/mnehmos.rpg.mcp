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
 * ── AND IT READS THE PLATE, NOT THE RUNG ─────────────────────────────────
 *
 * This file used to hand the hall each member's rung and the roll's ordinals,
 * and the hall inferred a plate from `carriesATokenAt` and a wall from
 * `thisHouseCanIssue`. Both were second copies of a fact the plate rows hold,
 * and they came apart once plates were cut after world open: somebody promoted
 * onto the token rung while away read as plated with nothing on the wall, and a
 * house that lost its last Foundation hand read nothing off plates still
 * hanging. So a member carries whether a plate hangs for them, read by
 * `whoHasAPlateOnTheWallOf`, and the hall reads only those. A house that never
 * cut one for anybody is still told nothing, which is the distinction the old
 * gate existed to keep.
 */

import { describe, it, expect } from 'vitest';
import {
    WHEN_SILENCE_BECOMES_A_CAPTIVE,
    issueTo,
    theOnesNobodyCanFind,
    whatTheHallSays,
    whoHasAPlateOnTheWallOf,
    type OneOnTheRoll
} from '../../../src/engine/world/a-house-knows-its-own-by-a-plate-and-a-token.js';

function member(over: Partial<OneOnTheRoll> = {}): OneOnTheRoll {
    return {
        memberId: 'member-1',
        memberName: 'Yan Shuling',
        theyHaveAPlate: true,
        holderIsAlive: true,
        daysSinceAnybodySawThem: 0,
        ...over
    };
}

describe('a house reads its own roll off the plates', () => {
    it('says nothing about somebody who was seen this morning', () => {
        const said = whatTheHallSays({ roll: [member()] });
        expect(said).toHaveLength(1);
        expect(said[0]!.reading).toBe('nothing_yet');
    });

    it('knows the moment one of its own dies', () => {
        const said = whatTheHallSays({
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
            roll: [member({ daysSinceAnybodySawThem: WHEN_SILENCE_BECOMES_A_CAPTIVE })]
        });
        expect(said[0]!.reading).toBe('somebody_has_them');
    });

    it('is not told anything at all about people it never cut a plate for', () => {
        expect(whatTheHallSays({
            roll: [
                member({ theyHaveAPlate: false, holderIsAlive: false }),
                member({ memberId: 'member-2', theyHaveAPlate: false, daysSinceAnybodySawThem: 400 })
            ]
        })).toEqual([]);
    });

    /** Derived, so it cannot drift: the same roll read twice says the same thing. */
    it('is a read and not a write', () => {
        const roll = [member({ daysSinceAnybodySawThem: 400 })];
        const once = whatTheHallSays({ roll });
        const twice = whatTheHallSays({ roll });
        expect(twice).toEqual(once);
        expect(roll[0]!.daysSinceAnybodySawThem).toBe(400);
    });
});

describe('whether a plate hangs is the plate row', () => {
    const cut = (memberId: string, houseId: string) => issueTo({
        memberId, memberName: memberId, houseId, houseName: houseId, plateRoomId: 'hall', onDay: 0
    });

    it('names the members a house cut plates for, and nobody else', () => {
        const a = cut('cut-for', 'house-a');
        const other = cut('elsewhere', 'house-b');
        const hanging = whoHasAPlateOnTheWallOf([a.token, a.plate, other.token, other.plate], 'house-a');
        expect([...hanging]).toEqual(['cut-for']);
    });

    it('and a token carried about is not a plate on the wall', () => {
        const a = cut('cut-for', 'house-a');
        expect(whoHasAPlateOnTheWallOf([a.token], 'house-a').size).toBe(0);
    });
});

describe('who a house would put on a wall outside', () => {
    it('is the ones it knows are alive and cannot find, and nobody else', () => {
        const readings = whatTheHallSays({
            roll: [
                member({ memberId: 'here', daysSinceAnybodySawThem: 0 }),
                member({ memberId: 'dead', holderIsAlive: false }),
                member({
                    memberId: 'taken',
                    memberName: 'Mo Qingzhi',
                    daysSinceAnybodySawThem: WHEN_SILENCE_BECOMES_A_CAPTIVE + 30
                }),
                member({
                    memberId: 'never-plated',
                    theyHaveAPlate: false,
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
            roll: [member({ holderIsAlive: false, daysSinceAnybodySawThem: 900 })]
        });
        expect(theOnesNobodyCanFind(readings)).toEqual([]);
    });
});
